alter table public.application_utest_details
  drop constraint if exists application_utest_details_screener_status_check;

alter table public.application_utest_details
  add constraint application_utest_details_screener_status_check
  check (screener_submission_status in ('not_started', 'queued', 'pending', 'submitted', 'failed'));

alter table public.application_utest_details
  add column if not exists screener_submission_error text;

create table if not exists public.application_screener_outbox (
  application_id uuid primary key references public.applications(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'approval_pending', 'approval_failed', 'submitted', 'failed', 'ambiguous')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  retry_after timestamptz,
  finished_at timestamptz
);

alter table public.application_screener_outbox
  add column if not exists retry_after timestamptz;

alter table public.application_screener_outbox
  drop constraint if exists application_screener_outbox_status_check;

alter table public.application_screener_outbox
  add constraint application_screener_outbox_status_check
  check (status in ('queued', 'processing', 'approval_pending', 'approval_failed', 'submitted', 'failed', 'ambiguous'));

alter table public.application_screener_outbox enable row level security;
revoke all on public.application_screener_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.application_screener_outbox to service_role;

create or replace function public.queue_consented_application_screener()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.screener_submission_status := 'not_started';
      new.screener_submission_error := null;
      new.screener_submitted_at := null;
    elsif new.screener_submission_status is distinct from old.screener_submission_status
       or new.screener_submission_error is distinct from old.screener_submission_error
       or new.screener_submitted_at is distinct from old.screener_submitted_at then
      raise exception 'Application screener submission status is managed by the backend';
    elsif old.screener_submission_status = 'failed'
       and new.screener_consent is true
       and new.screener_consent_at is not null
       and row(
         new.full_name, new.utest_id, new.utest_email, new.date_of_birth, new.phone_number,
         new.country, new.gmail_email, new.gender, new.gender_other, new.fluent_languages,
         new.language_other, new.has_valid_id, new.recording_space_available,
         new.screener_device_type, new.screener_device_other, new.screener_os_version,
         new.utest_account_screenshot_url, new.screener_consent, new.screener_consent_at
       ) is distinct from row(
         old.full_name, old.utest_id, old.utest_email, old.date_of_birth, old.phone_number,
         old.country, old.gmail_email, old.gender, old.gender_other, old.fluent_languages,
         old.language_other, old.has_valid_id, old.recording_space_available,
         old.screener_device_type, old.screener_device_other, old.screener_os_version,
         old.utest_account_screenshot_url, old.screener_consent, old.screener_consent_at
       )
       and exists (
         select 1
         from public.applications application
         where application.id = new.application_id
           and application.status = 'pending'
       ) then
      new.screener_submission_status := 'queued';
      new.screener_submission_error := null;
      new.screener_submitted_at := null;
    end if;
  end if;

  if new.screener_submission_status = 'not_started'
     and new.screener_consent is true
     and new.screener_consent_at is not null
     and exists (
       select 1
       from public.applications application
       where application.id = new.application_id
         and application.status = 'pending'
     ) then
    new.screener_submission_status := 'queued';
    new.screener_submission_error := null;
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_consented_application_screener()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.screener_submission_status = 'queued'
     and new.screener_consent is true
     and new.screener_consent_at is not null then
    insert into public.application_screener_outbox (application_id)
    values (new.application_id)
    on conflict (application_id) do update
    set status = 'queued',
        last_error = null,
        updated_at = now(),
        claimed_at = null,
        retry_after = null,
        finished_at = null
    where public.application_screener_outbox.status = 'failed';
  end if;
  return new;
end;
$$;

drop trigger if exists queue_consented_application_screener_before_write on public.application_utest_details;
create trigger queue_consented_application_screener_before_write
  before insert or update
  on public.application_utest_details
  for each row execute function public.queue_consented_application_screener();

drop trigger if exists enqueue_consented_application_screener_after_write on public.application_utest_details;
create trigger enqueue_consented_application_screener_after_write
  after insert or update
  on public.application_utest_details
  for each row execute function public.enqueue_consented_application_screener();

create or replace function public.claim_application_screener_submission()
returns table (application_id uuid, resume_approval boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.application_screener_outbox%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the screener worker may claim application submissions';
  end if;

  update public.application_screener_outbox outbox
  set status = 'ambiguous',
      last_error = 'The worker stopped while the external submission was in progress. Reconcile the Google Form before retrying.',
      updated_at = now(),
      retry_after = null,
      finished_at = now()
  where outbox.status = 'processing'
    and outbox.claimed_at < now() - interval '10 minutes';
  update public.application_utest_details details
  set screener_submission_error = 'The worker stopped while the external submission was in progress. Reconcile the Google Form before retrying.'
  where details.screener_submission_status = 'pending'
    and exists (
      select 1
      from public.application_screener_outbox outbox
      where outbox.application_id = details.application_id
        and outbox.status = 'ambiguous'
        and outbox.updated_at > now() - interval '10 minutes'
    );

  select outbox.* into claimed
  from public.application_screener_outbox outbox
  where outbox.status = 'queued'
     or (
       outbox.status = 'approval_pending'
       and outbox.retry_after <= now()
       and outbox.attempt_count < 8
     )
  order by outbox.created_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  application_id := claimed.application_id;
  resume_approval := claimed.status = 'approval_pending';
  update public.application_screener_outbox outbox
  set status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      claimed_at = now(),
      retry_after = null,
      updated_at = now()
  where outbox.application_id = claimed.application_id;

  if not resume_approval then
    update public.application_utest_details details
    set screener_submission_status = 'pending',
        screener_submission_error = null
    where details.application_id = claimed.application_id
      and details.screener_submission_status = 'queued';
  end if;

  return next;
end;
$$;

create or replace function public.complete_application_screener_submission(
  p_application_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the screener worker may complete application submissions';
  end if;
  if p_status not in ('approval_pending', 'approval_failed', 'submitted', 'failed', 'ambiguous') then
    raise exception 'Invalid application screener completion status';
  end if;

  update public.application_screener_outbox
  set status = p_status,
      last_error = nullif(left(coalesce(p_error, ''), 1000), ''),
      updated_at = now(),
      retry_after = case when p_status = 'approval_pending' then now() + interval '1 minute' else null end,
      finished_at = case when p_status = 'approval_pending' then null else now() end
  where application_id = p_application_id
    and status in ('processing', 'approval_pending');
  if not found then
    raise exception 'Application screener job is not currently processing';
  end if;

  update public.application_utest_details
  set screener_submission_status = case
        when p_status in ('submitted', 'approval_pending', 'approval_failed') then 'submitted'
        when p_status = 'failed' then 'failed'
        else 'pending'
      end,
      screener_submitted_at = case
        when p_status in ('submitted', 'approval_pending', 'approval_failed') then coalesce(screener_submitted_at, now())
        else screener_submitted_at
      end,
      screener_submission_error = nullif(left(coalesce(p_error, ''), 1000), '')
  where application_id = p_application_id;
end;
$$;

revoke all on function public.claim_application_screener_submission() from public, anon, authenticated;
grant execute on function public.claim_application_screener_submission() to service_role;
revoke all on function public.complete_application_screener_submission(uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_application_screener_submission(uuid, text, text) to service_role;

do $$
declare
  newest_application_id uuid;
begin
  select details.application_id into newest_application_id
  from public.application_utest_details details
  join public.applications application on application.id = details.application_id
  where application.status = 'pending'
    and details.screener_consent is true
    and details.screener_consent_at is not null
    and details.screener_submission_status = 'not_started'
  order by application.applied_at desc
  limit 1;

  if newest_application_id is not null then
    update public.application_utest_details
    set screener_submission_status = 'queued'
    where application_id = newest_application_id;
  end if;
end;
$$;
