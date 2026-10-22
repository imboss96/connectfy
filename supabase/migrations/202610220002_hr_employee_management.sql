create table if not exists public.hr_employees (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  job_title text not null,
  department text not null default '',
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contract', 'intern')),
  employment_status text not null default 'active'
    check (employment_status in ('active', 'on_leave', 'inactive', 'terminated')),
  hire_date date not null default current_date,
  compensation_type text not null default 'salary'
    check (compensation_type in ('salary', 'hourly')),
  compensation_rate numeric(12, 2) not null default 0 check (compensation_rate >= 0),
  compensation_currency text not null default 'USD'
    check (compensation_currency ~ '^[A-Z]{3}$'),
  pay_frequency text not null default 'monthly'
    check (pay_frequency in ('weekly', 'biweekly', 'monthly')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_onboarding_tasks (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  title text not null,
  description text not null default '',
  due_date date,
  is_required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'completed', 'waived')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (
    (status = 'completed' and completed_at is not null and completed_by is not null)
    or (status <> 'completed' and completed_at is null and completed_by is null)
  )
);

create table if not exists public.hr_attendance_records (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  clocked_in_at timestamptz not null default now(),
  clocked_out_at timestamptz,
  created_at timestamptz not null default now(),
  check (clocked_out_at is null or clocked_out_at > clocked_in_at)
);

create unique index if not exists hr_attendance_one_open_clock_per_employee_idx
  on public.hr_attendance_records (employee_id)
  where clocked_out_at is null;

create table if not exists public.hr_leave_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  leave_type text not null check (leave_type in ('annual', 'sick', 'personal', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  requested_days numeric(5, 2) not null check (requested_days > 0),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  review_note text not null default '',
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (
    (status = 'pending' and decided_by is null and decided_at is null)
    or (status <> 'pending' and decided_by is not null and decided_at is not null)
  )
);

create table if not exists public.hr_payroll_records (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_amount numeric(12, 2) not null check (gross_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'planned' check (status in ('planned', 'paid', 'void')),
  paid_at timestamptz,
  notes text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  check ((status = 'paid' and paid_at is not null) or (status <> 'paid' and paid_at is null))
);

create table if not exists public.hr_performance_reviews (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  rating integer not null check (rating between 1 and 5),
  summary text not null,
  strengths text not null default '',
  growth_goals text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists hr_onboarding_tasks_employee_idx
  on public.hr_onboarding_tasks (employee_id, status, due_date);
create index if not exists hr_attendance_records_employee_idx
  on public.hr_attendance_records (employee_id, clocked_in_at desc);
create index if not exists hr_leave_requests_employee_idx
  on public.hr_leave_requests (employee_id, status, created_at desc);
create index if not exists hr_payroll_records_employee_idx
  on public.hr_payroll_records (employee_id, period_end desc);
create index if not exists hr_performance_reviews_employee_idx
  on public.hr_performance_reviews (employee_id, period_end desc);

alter table public.hr_employees enable row level security;
alter table public.hr_onboarding_tasks enable row level security;
alter table public.hr_attendance_records enable row level security;
alter table public.hr_leave_requests enable row level security;
alter table public.hr_payroll_records enable row level security;
alter table public.hr_performance_reviews enable row level security;

drop policy if exists hr_employees_read_self_or_admin on public.hr_employees;
create policy hr_employees_read_self_or_admin on public.hr_employees
  for select to authenticated
  using (public.is_admin() or profile_id = auth.uid());

drop policy if exists hr_employees_manage_admin on public.hr_employees;
create policy hr_employees_manage_admin on public.hr_employees
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists hr_onboarding_read_self_or_admin on public.hr_onboarding_tasks;
create policy hr_onboarding_read_self_or_admin on public.hr_onboarding_tasks
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hr_employees employee
      where employee.id = employee_id and employee.profile_id = auth.uid()
    )
  );

drop policy if exists hr_onboarding_manage_admin on public.hr_onboarding_tasks;
create policy hr_onboarding_manage_admin on public.hr_onboarding_tasks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists hr_attendance_read_self_or_admin on public.hr_attendance_records;
create policy hr_attendance_read_self_or_admin on public.hr_attendance_records
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hr_employees employee
      where employee.id = employee_id and employee.profile_id = auth.uid()
    )
  );

drop policy if exists hr_attendance_manage_admin on public.hr_attendance_records;
create policy hr_attendance_manage_admin on public.hr_attendance_records
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists hr_leave_read_self_or_admin on public.hr_leave_requests;
create policy hr_leave_read_self_or_admin on public.hr_leave_requests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hr_employees employee
      where employee.id = employee_id and employee.profile_id = auth.uid()
    )
  );

drop policy if exists hr_leave_create_self on public.hr_leave_requests;
create policy hr_leave_create_self on public.hr_leave_requests
  for insert to authenticated
  with check (
    status = 'pending'
    and decided_by is null
    and decided_at is null
    and exists (
      select 1 from public.hr_employees employee
      where employee.id = employee_id
        and employee.profile_id = auth.uid()
        and employee.employment_status = 'active'
    )
  );

drop policy if exists hr_leave_manage_admin on public.hr_leave_requests;
create policy hr_leave_manage_admin on public.hr_leave_requests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists hr_payroll_read_self_or_admin on public.hr_payroll_records;
create policy hr_payroll_read_self_or_admin on public.hr_payroll_records
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hr_employees employee
      where employee.id = employee_id and employee.profile_id = auth.uid()
    )
  );

drop policy if exists hr_payroll_manage_admin on public.hr_payroll_records;
create policy hr_payroll_manage_admin on public.hr_payroll_records
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists hr_performance_read_self_or_admin on public.hr_performance_reviews;
create policy hr_performance_read_self_or_admin on public.hr_performance_reviews
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hr_employees employee
      where employee.id = employee_id and employee.profile_id = auth.uid()
    )
  );

drop policy if exists hr_performance_manage_admin on public.hr_performance_reviews;
create policy hr_performance_manage_admin on public.hr_performance_reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.hr_clock_in()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  employee public.hr_employees%rowtype;
  attendance_id uuid;
begin
  select * into employee
  from public.hr_employees
  where profile_id = auth.uid()
    and employment_status = 'active'
  for update;

  if not found then
    raise exception 'An active employee record is required to clock in.'
      using errcode = 'P0001';
  end if;

  insert into public.hr_attendance_records (employee_id)
  values (employee.id)
  returning id into attendance_id;

  return attendance_id;
end;
$$;

create or replace function public.hr_clock_out()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  attendance_id uuid;
begin
  update public.hr_attendance_records attendance
  set clocked_out_at = now()
  where attendance.id = (
    select record.id
    from public.hr_attendance_records record
    join public.hr_employees employee on employee.id = record.employee_id
    where employee.profile_id = auth.uid()
      and record.clocked_out_at is null
    for update of record
    limit 1
  )
  returning attendance.id into attendance_id;

  if attendance_id is null then
    raise exception 'There is no active time entry to clock out.'
      using errcode = 'P0001';
  end if;

  return attendance_id;
end;
$$;

create or replace function public.hr_complete_onboarding_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hr_onboarding_tasks task
  set status = 'completed',
      completed_at = now(),
      completed_by = auth.uid()
  where task.id = p_task_id
    and task.status = 'pending'
    and exists (
      select 1 from public.hr_employees employee
      where employee.id = task.employee_id
        and employee.profile_id = auth.uid()
    );

  if not found then
    raise exception 'The onboarding task is unavailable or already complete.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.hr_clock_in() from public, anon;
revoke all on function public.hr_clock_out() from public, anon;
revoke all on function public.hr_complete_onboarding_task(uuid) from public, anon;
grant execute on function public.hr_clock_in() to authenticated;
grant execute on function public.hr_clock_out() to authenticated;
grant execute on function public.hr_complete_onboarding_task(uuid) to authenticated;

grant select, insert, update on public.hr_employees to authenticated;
grant select, insert, update on public.hr_onboarding_tasks to authenticated;
grant select, insert, update on public.hr_attendance_records to authenticated;
grant select, insert, update on public.hr_leave_requests to authenticated;
grant select, insert, update on public.hr_payroll_records to authenticated;
grant select, insert, update on public.hr_performance_reviews to authenticated;
