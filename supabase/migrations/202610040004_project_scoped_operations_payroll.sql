create table public.project_operations_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  applause_sheet_url text not null default '',
  eligibility_sheet_url text not null default '',
  payroll_amount numeric(12,2) not null default 0 check (payroll_amount >= 0),
  payroll_scheduled_date date,
  updated_at timestamptz not null default now()
);

create table public.project_applause_status (
  project_id uuid not null references public.projects(id) on delete cascade,
  source_key text not null,
  status text not null default '',
  tester_id text not null default '',
  tester_email text not null default '',
  google_email text not null default '',
  consent_name text not null default '',
  id_scan_status text not null default '',
  utest_id text not null default '',
  issues text not null default '',
  synced_at timestamptz not null default now(),
  primary key (project_id, source_key)
);

create index project_applause_status_project_status_idx
  on public.project_applause_status (project_id, status);

create table public.project_payroll_schedule (
  project_id uuid not null references public.projects(id) on delete cascade,
  source_key text not null,
  tester_id text not null default '',
  tester_email text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  scheduled_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, source_key)
);

create index project_payroll_schedule_date_idx
  on public.project_payroll_schedule (project_id, scheduled_date, status);

alter table public.project_operations_settings enable row level security;
alter table public.project_applause_status enable row level security;
alter table public.project_payroll_schedule enable row level security;

grant select, insert, update on public.project_operations_settings to authenticated;
grant select on public.project_applause_status to authenticated;
grant select on public.project_payroll_schedule to authenticated;

create policy "admins manage project operations settings"
  on public.project_operations_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins view project Applause statuses"
  on public.project_applause_status for select to authenticated
  using (public.is_admin());

create policy "admins view project payroll schedules"
  on public.project_payroll_schedule for select to authenticated
  using (public.is_admin());

alter table public.legacy_sheet_responses
  add column project_id uuid references public.projects(id) on delete cascade;

create index legacy_sheet_responses_project_idx
  on public.legacy_sheet_responses (project_id, source_timestamp desc);

alter table public.legacy_sheet_email_log
  add column project_id uuid references public.projects(id) on delete cascade;

create index legacy_sheet_email_log_project_idx
  on public.legacy_sheet_email_log (project_id, created_at desc);

create or replace function public.sync_project_applause_status(
  p_project_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  imported_count integer;
  payout_amount numeric(12,2);
  payout_date date;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can sync project statuses';
  end if;

  if p_project_id is null then
    raise exception 'A project is required';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Project status rows must be provided as an array';
  end if;

  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 10000 then
    raise exception 'Project status import must contain between 1 and 10000 rows';
  end if;

  select settings.payroll_amount, settings.payroll_scheduled_date
  into payout_amount, payout_date
  from public.project_operations_settings as settings
  where settings.project_id = p_project_id;

  if not found then
    raise exception 'Configure this project integration before syncing its sheet';
  end if;

  delete from public.project_applause_status
  where project_id = p_project_id;

  insert into public.project_applause_status (
    project_id,
    source_key,
    status,
    tester_id,
    tester_email,
    google_email,
    consent_name,
    id_scan_status,
    utest_id,
    issues,
    synced_at
  )
  select
    p_project_id,
    row_data.source_key,
    coalesce(row_data.status, ''),
    coalesce(row_data.tester_id, ''),
    coalesce(row_data.tester_email, ''),
    coalesce(row_data.google_email, ''),
    coalesce(row_data.consent_name, ''),
    coalesce(row_data.id_scan_status, ''),
    coalesce(row_data.utest_id, ''),
    coalesce(row_data.issues, ''),
    now()
  from jsonb_to_recordset(p_rows) as row_data(
    source_key text,
    status text,
    tester_id text,
    tester_email text,
    google_email text,
    consent_name text,
    id_scan_status text,
    utest_id text,
    issues text
  )
  where nullif(trim(row_data.source_key), '') is not null;

  get diagnostics imported_count = row_count;

  update public.project_payroll_schedule as schedule
  set status = 'cancelled',
      updated_at = now()
  where schedule.project_id = p_project_id
    and schedule.status = 'scheduled'
    and not exists (
      select 1
      from public.project_applause_status as source
      where source.project_id = schedule.project_id
        and source.source_key = schedule.source_key
        and lower(trim(source.status)) = 'claimed complete'
    );

  if payout_amount > 0 and payout_date is not null then
    insert into public.project_payroll_schedule (
      project_id,
      source_key,
      tester_id,
      tester_email,
      amount,
      scheduled_date,
      status
    )
    select
      source.project_id,
      source.source_key,
      source.tester_id,
      source.tester_email,
      payout_amount,
      payout_date,
      'scheduled'
    from public.project_applause_status as source
    where source.project_id = p_project_id
      and lower(trim(source.status)) = 'claimed complete'
      and nullif(trim(source.tester_email), '') is not null
    on conflict (project_id, source_key) do update
    set tester_id = excluded.tester_id,
        tester_email = excluded.tester_email,
        amount = excluded.amount,
        scheduled_date = excluded.scheduled_date,
        status = 'scheduled',
        updated_at = now()
    where public.project_payroll_schedule.status <> 'paid';
  else
    update public.project_payroll_schedule as schedule
    set status = 'cancelled',
        updated_at = now()
    where schedule.project_id = p_project_id
      and schedule.status = 'scheduled';
  end if;

  return imported_count;
end;
$$;

revoke all on function public.sync_project_applause_status(uuid, jsonb) from public, anon;
grant execute on function public.sync_project_applause_status(uuid, jsonb) to authenticated;

drop function if exists public.sync_applause_project_status(jsonb);

notify pgrst, 'reload schema';
