create table if not exists public.hr_adjustments (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('time', 'pay')),
  attendance_record_id uuid references public.hr_attendance_records(id),
  amount numeric(12, 2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  previous_clocked_in_at timestamptz,
  previous_clocked_out_at timestamptz,
  new_clocked_in_at timestamptz,
  new_clocked_out_at timestamptz,
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (
    (
      adjustment_type = 'pay'
      and attendance_record_id is null
      and amount is not null
      and amount <> 0
      and currency is not null
      and previous_clocked_in_at is null
      and previous_clocked_out_at is null
      and new_clocked_in_at is null
      and new_clocked_out_at is null
    )
    or (
      adjustment_type = 'time'
      and attendance_record_id is not null
      and amount is null
      and currency is null
      and previous_clocked_in_at is not null
      and previous_clocked_out_at is not null
      and new_clocked_in_at is not null
      and new_clocked_out_at is not null
      and new_clocked_out_at > new_clocked_in_at
    )
  )
);

create index if not exists hr_adjustments_employee_created_idx
  on public.hr_adjustments (employee_id, created_at desc);

alter table public.hr_adjustments enable row level security;

drop policy if exists hr_adjustments_read_self_or_admin on public.hr_adjustments;
create policy hr_adjustments_read_self_or_admin on public.hr_adjustments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hr_employees employee
      where employee.id = employee_id and employee.profile_id = auth.uid()
    )
  );

revoke all on public.hr_adjustments from anon, authenticated;
grant select on public.hr_adjustments to authenticated;

revoke insert, update, delete on public.hr_attendance_records from anon, authenticated;
grant select on public.hr_attendance_records to authenticated;

create or replace function public.hr_record_adjustment(
  p_employee_id uuid,
  p_adjustment_type text,
  p_reason text,
  p_amount numeric default null,
  p_attendance_record_id uuid default null,
  p_clocked_in_at timestamptz default null,
  p_clocked_out_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  employee public.hr_employees%rowtype;
  attendance public.hr_attendance_records%rowtype;
  adjustment_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only a Super Admin can record HR adjustments'
      using errcode = '42501';
  end if;

  select * into employee
  from public.hr_employees
  where id = p_employee_id
    and compensation_type = 'hourly'
  for update;

  if not found then
    raise exception 'An hourly employee record is required for an adjustment.'
      using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Enter a reason for the adjustment.'
      using errcode = 'P0001';
  end if;

  if p_adjustment_type = 'pay' then
    if p_amount is null or p_amount = 0
      or p_attendance_record_id is not null
      or p_clocked_in_at is not null
      or p_clocked_out_at is not null then
      raise exception 'A pay adjustment requires a non-zero amount only.'
        using errcode = 'P0001';
    end if;

    insert into public.hr_adjustments (
      employee_id, adjustment_type, amount, currency, reason, created_by
    )
    values (
      employee.id, 'pay', p_amount, employee.compensation_currency,
      trim(p_reason), auth.uid()
    )
    returning id into adjustment_id;

    return adjustment_id;
  end if;

  if p_adjustment_type <> 'time'
    or p_amount is not null
    or p_attendance_record_id is null
    or p_clocked_in_at is null
    or p_clocked_out_at is null
    or p_clocked_out_at <= p_clocked_in_at then
    raise exception 'A time correction requires a completed entry and valid corrected times.'
      using errcode = 'P0001';
  end if;

  select * into attendance
  from public.hr_attendance_records
  where id = p_attendance_record_id
    and employee_id = employee.id
  for update;

  if not found or attendance.clocked_out_at is null then
    raise exception 'The completed attendance entry could not be found.'
      using errcode = 'P0001';
  end if;

  if attendance.clocked_in_at = p_clocked_in_at
    and attendance.clocked_out_at = p_clocked_out_at then
    raise exception 'The corrected times must differ from the existing entry.'
      using errcode = 'P0001';
  end if;

  update public.hr_attendance_records
  set clocked_in_at = p_clocked_in_at,
      clocked_out_at = p_clocked_out_at
  where id = attendance.id;

  insert into public.hr_adjustments (
    employee_id,
    adjustment_type,
    attendance_record_id,
    previous_clocked_in_at,
    previous_clocked_out_at,
    new_clocked_in_at,
    new_clocked_out_at,
    reason,
    created_by
  )
  values (
    employee.id,
    'time',
    attendance.id,
    attendance.clocked_in_at,
    attendance.clocked_out_at,
    p_clocked_in_at,
    p_clocked_out_at,
    trim(p_reason),
    auth.uid()
  )
  returning id into adjustment_id;

  return adjustment_id;
end;
$$;

revoke all on function public.hr_record_adjustment(uuid, text, text, numeric, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.hr_record_adjustment(uuid, text, text, numeric, uuid, timestamptz, timestamptz) to authenticated;
