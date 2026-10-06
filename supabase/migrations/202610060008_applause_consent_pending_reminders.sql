create table public.project_applause_consent_reminder_email_outbox (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null,
  recipient_email text not null,
  recipient_name text not null,
  utest_id text not null default '',
  project_title text not null,
  project_amount numeric(12,2) not null default 0 check (project_amount >= 0),
  project_lock_date text not null default '',
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

create index project_applause_consent_reminder_pending_idx
  on public.project_applause_consent_reminder_email_outbox (next_attempt_at, created_at)
  where status = 'pending';

alter table public.project_applause_consent_reminder_email_outbox enable row level security;
revoke all on public.project_applause_consent_reminder_email_outbox from public, anon, authenticated;
grant all on public.project_applause_consent_reminder_email_outbox to service_role;

create or replace function public.queue_project_applause_consent_reminders(
  p_project_id uuid,
  p_source_keys text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  project_amount numeric(12,2);
  queued_count integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can send Applause consent reminders';
  end if;

  if p_project_id is null then
    raise exception 'A project is required';
  end if;

  if p_source_keys is null or cardinality(p_source_keys) = 0 or cardinality(p_source_keys) > 5000 then
    raise exception 'Select between 1 and 5000 consent-pending rows';
  end if;

  select coalesce(settings.payroll_amount, 0)
    into project_amount
    from public.project_operations_settings as settings
    where settings.project_id = p_project_id;

  if not found then
    raise exception 'Configure this project integration before sending consent reminders';
  end if;

  insert into public.project_applause_consent_reminder_email_outbox as existing_reminder (
    project_id,
    profile_id,
    source_key,
    recipient_email,
    recipient_name,
    utest_id,
    project_title,
    project_amount,
    project_lock_date
  )
  select distinct on (source.project_id, matched_profile.id)
    source.project_id,
    matched_profile.id,
    source.source_key,
    matched_profile.email,
    coalesce(nullif(trim(matched_profile.name), ''), split_part(matched_profile.email, '@', 1)),
    coalesce(
      nullif(trim(source.utest_id), ''),
      nullif(trim(source.tester_id), ''),
      nullif(trim(matched_profile.profile_data #>> '{testerProfile,uTestId}'), ''),
      ''
    ),
    project.title,
    coalesce(project_amount, 0),
    coalesce(project.deadline::text, '')
  from public.project_applause_status as source
  join public.projects as project on project.id = source.project_id
  cross join lateral (
    select profile.id, profile.email, profile.name, profile.profile_data
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
    and source.source_key = any(p_source_keys)
    and lower(trim(coalesce(source.consent_name, ''))) = 'pending'
  order by source.project_id, matched_profile.id, source.source_key
  on conflict (project_id, profile_id) do update
  set source_key = excluded.source_key,
      recipient_email = excluded.recipient_email,
      recipient_name = excluded.recipient_name,
      utest_id = excluded.utest_id,
      project_title = excluded.project_title,
      project_amount = excluded.project_amount,
      project_lock_date = excluded.project_lock_date,
      status = 'pending',
      attempt_count = 0,
      next_attempt_at = now(),
      locked_until = null,
      last_error = null,
      sent_at = null,
      updated_at = now()
  where existing_reminder.status in ('sent', 'failed');

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

revoke all on function public.queue_project_applause_consent_reminders(uuid, text[]) from public, anon;
grant execute on function public.queue_project_applause_consent_reminders(uuid, text[]) to authenticated;

create or replace function public.claim_project_applause_consent_reminder_email()
returns setof public.project_applause_consent_reminder_email_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_email public.project_applause_consent_reminder_email_outbox%rowtype;
begin
  update public.project_applause_consent_reminder_email_outbox as expired
  set status = 'failed',
      locked_until = null,
      last_error = coalesce(expired.last_error, 'Delivery worker lease expired after the final attempt.'),
      updated_at = now()
  where expired.status = 'processing'
    and expired.locked_until < now()
    and expired.attempt_count >= 8;

  update public.project_applause_consent_reminder_email_outbox as email
  set status = 'processing',
      attempt_count = email.attempt_count + 1,
      locked_until = now() + interval '2 minutes',
      updated_at = now()
  where email.id = (
    select candidate.id
    from public.project_applause_consent_reminder_email_outbox as candidate
    where (
      (candidate.status = 'pending' and candidate.next_attempt_at <= now())
      or (candidate.status = 'processing' and candidate.locked_until < now())
    )
    and candidate.attempt_count < 8
    order by candidate.next_attempt_at, candidate.created_at
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

create or replace function public.complete_project_applause_consent_reminder_email(
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
  update public.project_applause_consent_reminder_email_outbox
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
    raise exception 'The claimed consent reminder email was not found or is no longer processing';
  end if;
end;
$$;

revoke all on function public.claim_project_applause_consent_reminder_email() from public, anon, authenticated;
revoke all on function public.complete_project_applause_consent_reminder_email(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_project_applause_consent_reminder_email() to service_role;
grant execute on function public.complete_project_applause_consent_reminder_email(uuid, boolean, text, text) to service_role;

notify pgrst, 'reload schema';
