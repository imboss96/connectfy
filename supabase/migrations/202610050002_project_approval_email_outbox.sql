create table public.project_email_outbox (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references public.applications(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  tester_id uuid references public.profiles(id) on delete set null,
  email_type text not null check (email_type = 'invite'),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index project_email_outbox_pending_idx
  on public.project_email_outbox (next_attempt_at, created_at)
  where status = 'pending';

create index project_email_outbox_stale_processing_idx
  on public.project_email_outbox (locked_until)
  where status = 'processing';

alter table public.project_email_outbox enable row level security;
revoke all on public.project_email_outbox from anon, authenticated;
grant all on public.project_email_outbox to service_role;

create or replace function public.guard_project_application_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from new.status
    )
    and not public.is_admin()
    and coalesce(auth.role(), '') <> 'service_role'
    and not exists (
      select 1
      from public.projects as project
      where project.id = new.project_id
        and project.client_id = auth.uid()
    ) then
    raise exception 'Only the project owner or an administrator can approve an application';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_guard_project_approval on public.applications;
create trigger applications_guard_project_approval
  before insert or update of status on public.applications
  for each row
  execute function public.guard_project_application_approval();

create or replace function public.enqueue_project_approval_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_name text;
  recipient_email text;
  project_title text;
  project_company text;
  project_description text;
  project_category text;
  project_deadline text;
  email_payload jsonb;
begin
  if new.status <> 'approved'
    or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;

  select profile.name, profile.email,
         project.title, project.company,
         coalesce(nullif(trim(project.short_description), ''), nullif(trim(project.full_overview), ''), ''),
         project.category, project.deadline::text
  into recipient_name, recipient_email,
       project_title, project_company,
       project_description, project_category, project_deadline
  from public.profiles as profile
  join public.projects as project on project.id = new.project_id
  where profile.id = new.tester_id;

  email_payload := jsonb_build_object(
    'type', 'invite',
    'toEmail', coalesce(recipient_email, ''),
    'toName', coalesce(nullif(trim(recipient_name), ''), 'Tester'),
    'projectTitle', coalesce(project_title, 'Connectfy project'),
    'projectCompany', coalesce(project_company, 'Connectfy'),
    'projectDescription', coalesce(project_description, ''),
    'projectCategory', coalesce(project_category, 'QA / testing'),
    'projectDeadline', project_deadline,
    'applicationId', new.id,
    'projectId', new.project_id
  );

  insert into public.project_email_outbox (
    application_id,
    project_id,
    tester_id,
    email_type,
    payload,
    status,
    last_error
  )
  values (
    new.id,
    new.project_id,
    new.tester_id,
    'invite',
    email_payload,
    case
      when coalesce(trim(recipient_email), '') = '' then 'failed'
      else 'pending'
    end,
    case
      when coalesce(trim(recipient_email), '') = '' then 'Applicant profile has no email address.'
      else null
    end
  );

  return new;
end;
$$;

drop trigger if exists applications_enqueue_project_approval_email on public.applications;
create trigger applications_enqueue_project_approval_email
  after insert or update of status on public.applications
  for each row
  execute function public.enqueue_project_approval_email();

create or replace function public.claim_project_email_outbox()
returns table (id uuid, payload jsonb, attempt_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_email_outbox
  set status = 'failed',
      locked_until = null,
      last_error = coalesce(last_error, 'Delivery worker lease expired after the final attempt.'),
      updated_at = now()
  where status = 'processing'
    and locked_until < now()
    and attempt_count >= 8;

  return query
  with next_email as (
    select outbox.id
    from public.project_email_outbox as outbox
    where (
      (outbox.status = 'pending' and outbox.next_attempt_at <= now())
      or
      (outbox.status = 'processing' and outbox.locked_until < now())
    )
    and outbox.attempt_count < 8
    order by outbox.next_attempt_at, outbox.created_at
    limit 1
    for update skip locked
  )
  update public.project_email_outbox as outbox
  set status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      locked_until = now() + interval '5 minutes',
      updated_at = now()
  from next_email
  where outbox.id = next_email.id
  returning outbox.id, outbox.payload, outbox.attempt_count;
end;
$$;

create or replace function public.complete_project_email_outbox(
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
declare
  current_attempt integer;
begin
  select attempt_count
  into current_attempt
  from public.project_email_outbox
  where id = p_outbox_id
    and status = 'processing'
  for update;

  if not found then
    raise exception 'Project email outbox item is not currently processing';
  end if;

  update public.project_email_outbox
  set status = case
        when p_succeeded then 'sent'
        when current_attempt >= 8 then 'failed'
        else 'pending'
      end,
      provider_message_id = case when p_succeeded then p_provider_message_id else provider_message_id end,
      last_error = case when p_succeeded then null else left(coalesce(p_error, 'Email delivery failed'), 2000) end,
      next_attempt_at = case
        when p_succeeded or current_attempt >= 8 then next_attempt_at
        else now() + make_interval(secs => least(3600, 15 * (2 ^ greatest(current_attempt - 1, 0))::integer))
      end,
      locked_until = null,
      sent_at = case when p_succeeded then now() else null end,
      updated_at = now()
  where id = p_outbox_id;

  if p_succeeded then
    update public.applications
    set last_invite_sent_at = now(),
        updated_at = now()
    where id = (
      select application_id
      from public.project_email_outbox
      where id = p_outbox_id
    )
      and status = 'approved';
  end if;
end;
$$;

revoke all on function public.claim_project_email_outbox() from public, anon, authenticated;
revoke all on function public.complete_project_email_outbox(uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.guard_project_application_approval() from public, anon, authenticated;
revoke all on function public.enqueue_project_approval_email() from public, anon, authenticated;
grant execute on function public.claim_project_email_outbox() to service_role;
grant execute on function public.complete_project_email_outbox(uuid, boolean, text, text) to service_role;

notify pgrst, 'reload schema';
