create table public.project_applause_approval_email_outbox (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null,
  recipient_email text not null,
  recipient_name text not null,
  project_title text not null,
  project_company text not null,
  project_description text not null default '',
  project_deadline text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (project_id, profile_id)
);

create index project_applause_approval_outbox_pending_idx
  on public.project_applause_approval_email_outbox (next_attempt_at, created_at)
  where status = 'pending';

alter table public.project_applause_approval_email_outbox enable row level security;
revoke all on public.project_applause_approval_email_outbox from anon, authenticated;
grant all on public.project_applause_approval_email_outbox to service_role;

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
        lower(trim(profile.email)) in (
          lower(trim(new.tester_email)),
          lower(trim(new.google_email))
        )
        or lower(trim(profile.profile_data #>> '{testerProfile,uTestId}')) in (
          lower(trim(new.tester_id)),
          lower(trim(new.utest_id))
        )
      )
    order by case
      when lower(trim(profile.email)) = lower(trim(new.tester_email)) then 0
      when lower(trim(profile.email)) = lower(trim(new.google_email)) then 1
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

drop trigger if exists project_applause_queue_completion_approval on public.project_applause_status;
create trigger project_applause_queue_completion_approval
  after insert or update of status on public.project_applause_status
  for each row
  execute function public.queue_applause_completion_approval_email();

create or replace function public.claim_project_applause_approval_email()
returns setof public.project_applause_approval_email_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_email public.project_applause_approval_email_outbox%rowtype;
begin
  update public.project_applause_approval_email_outbox as email
  set status = 'processing',
      attempt_count = email.attempt_count + 1,
      locked_until = now() + interval '2 minutes',
      updated_at = now()
  where email.id = (
    select candidate.id
    from public.project_applause_approval_email_outbox as candidate
    where (
      candidate.status = 'pending'
      and candidate.next_attempt_at <= now()
    ) or (
      candidate.status = 'processing'
      and candidate.locked_until < now()
    )
    order by candidate.created_at
    for update skip locked
    limit 1
  )
  returning email.* into claimed_email;

  if claimed_email.id is not null then
    return next claimed_email;
  end if;
  return;
end;
$$;

create or replace function public.complete_project_applause_approval_email(
  p_outbox_id uuid,
  p_succeeded boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_applause_approval_email_outbox
  set status = case
        when p_succeeded then 'sent'
        when attempt_count >= 8 then 'failed'
        else 'pending'
      end,
      sent_at = case when p_succeeded then now() else null end,
      provider_message_id = case when p_succeeded then p_provider_message_id else null end,
      last_error = case when p_succeeded then null else left(coalesce(p_error, 'Email delivery failed'), 2000) end,
      next_attempt_at = case
        when p_succeeded then next_attempt_at
        else now() + make_interval(secs => least(3600, 30 * (2 ^ least(attempt_count, 7))::integer))
      end,
      locked_until = null,
      updated_at = now()
  where id = p_outbox_id
    and status = 'processing';

  if not found then
    raise exception 'The claimed Applause approval email was not found or is no longer processing';
  end if;
end;
$$;

revoke all on function public.claim_project_applause_approval_email() from public, anon, authenticated;
revoke all on function public.complete_project_applause_approval_email(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_project_applause_approval_email() to service_role;
grant execute on function public.complete_project_applause_approval_email(uuid, boolean, text, text) to service_role;

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

notify pgrst, 'reload schema';
