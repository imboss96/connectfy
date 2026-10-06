alter table public.project_payroll_schedule
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create or replace function public.queue_applause_completion_approval_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_profile public.profiles%rowtype;
begin
  if lower(trim(new.status)) <> 'claimed complete'
    or (
      tg_op = 'UPDATE'
      and lower(trim(old.status)) = 'claimed complete'
    ) then
    return new;
  end if;

  select profile.*
    into matched_profile
    from public.profiles as profile
    where profile.role = 'tester'
      and nullif(trim(profile.email), '') is not null
      and (
        nullif(lower(trim(profile.email)), '') in (
          nullif(lower(trim(new.tester_email)), ''),
          nullif(lower(trim(new.google_email)), '')
        )
        or nullif(lower(trim(profile.profile_data #>> '{testerProfile,uTestId}')), '') in (
          nullif(lower(trim(new.tester_id)), ''),
          nullif(lower(trim(new.utest_id)), '')
        )
      )
    order by case
      when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(new.tester_email)), '') then 0
      when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(new.google_email)), '') then 1
      else 2
    end, profile.id
    limit 1;

  if matched_profile.id is null then
    return new;
  end if;

  insert into public.project_applause_approval_email_outbox (
    project_id,
    profile_id,
    source_key,
    recipient_email,
    recipient_name,
    project_title,
    project_company,
    project_description,
    project_deadline
  )
  select
    new.project_id,
    matched_profile.id,
    new.source_key,
    matched_profile.email,
    coalesce(nullif(trim(matched_profile.name), ''), split_part(matched_profile.email, '@', 1)),
    project.title,
    project.company,
    project.short_description,
    coalesce(project.deadline, '')
  from public.projects as project
  where project.id = new.project_id
  on conflict (project_id, profile_id) do nothing;

  return new;
end;
$$;

update public.project_payroll_schedule as schedule
set profile_id = matched_profile.id
from public.project_applause_status as source
cross join lateral (
  select profile.id
  from public.profiles as profile
  where profile.role = 'tester'
    and nullif(trim(profile.email), '') is not null
    and (
      nullif(lower(trim(profile.email)), '') in (
        nullif(lower(trim(source.tester_email)), ''),
        nullif(lower(trim(source.google_email)), '')
      )
      or nullif(lower(trim(profile.profile_data #>> '{testerProfile,uTestId}')), '') in (
        nullif(lower(trim(source.tester_id)), ''),
        nullif(lower(trim(source.utest_id)), '')
      )
    )
  order by case
    when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(source.tester_email)), '') then 0
    when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(source.google_email)), '') then 1
    else 2
  end, profile.id
  limit 1
) as matched_profile
where schedule.project_id = source.project_id
  and schedule.source_key = source.source_key
  and schedule.profile_id is null;

update public.project_payroll_schedule
set status = 'cancelled',
    updated_at = now()
where status = 'scheduled'
  and profile_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_payroll_schedule_requires_tester_profile'
      and conrelid = 'public.project_payroll_schedule'::regclass
  ) then
    alter table public.project_payroll_schedule
      add constraint project_payroll_schedule_requires_tester_profile
      check (status <> 'scheduled' or profile_id is not null)
      not valid;
  end if;
end;
$$;

alter table public.project_payroll_schedule
  validate constraint project_payroll_schedule_requires_tester_profile;

create or replace function public.cancel_project_payroll_for_deleted_tester()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_payroll_schedule
  set status = 'cancelled',
      updated_at = now()
  where profile_id = old.id
    and status = 'scheduled';

  return old;
end;
$$;

drop trigger if exists cancel_project_payroll_before_tester_delete on public.profiles;
create trigger cancel_project_payroll_before_tester_delete
  before delete on public.profiles
  for each row
  execute function public.cancel_project_payroll_for_deleted_tester();

create index if not exists project_payroll_schedule_profile_idx
  on public.project_payroll_schedule (profile_id, scheduled_date, status);

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
  where nullif(trim(row_data.source_key), '') is not null
  on conflict (project_id, source_key) do update
  set status = excluded.status,
      tester_id = excluded.tester_id,
      tester_email = excluded.tester_email,
      google_email = excluded.google_email,
      consent_name = excluded.consent_name,
      id_scan_status = excluded.id_scan_status,
      utest_id = excluded.utest_id,
      issues = excluded.issues,
      synced_at = excluded.synced_at;

  get diagnostics imported_count = row_count;

  delete from public.project_applause_status as saved
  where saved.project_id = p_project_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_rows) as row_data(source_key text)
      where row_data.source_key = saved.source_key
    );

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
      profile_id,
      tester_id,
      tester_email,
      amount,
      scheduled_date,
      status
    )
    select
      source.project_id,
      source.source_key,
      matched_profile.id,
      source.tester_id,
      matched_profile.email,
      payout_amount,
      payout_date,
      'scheduled'
    from public.project_applause_status as source
    cross join lateral (
      select profile.id, profile.email
      from public.profiles as profile
      where profile.role = 'tester'
        and nullif(trim(profile.email), '') is not null
        and (
          nullif(lower(trim(profile.email)), '') in (
            nullif(lower(trim(source.tester_email)), ''),
            nullif(lower(trim(source.google_email)), '')
          )
          or nullif(lower(trim(profile.profile_data #>> '{testerProfile,uTestId}')), '') in (
            nullif(lower(trim(source.tester_id)), ''),
            nullif(lower(trim(source.utest_id)), '')
          )
        )
      order by case
        when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(source.tester_email)), '') then 0
        when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(source.google_email)), '') then 1
        else 2
      end, profile.id
      limit 1
    ) as matched_profile
    where source.project_id = p_project_id
      and lower(trim(source.status)) = 'claimed complete'
    on conflict (project_id, source_key) do update
    set profile_id = excluded.profile_id,
        tester_id = excluded.tester_id,
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

notify pgrst, 'reload schema';
