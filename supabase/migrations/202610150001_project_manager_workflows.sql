create table if not exists public.project_manager_activity (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  submission_id uuid references public.submissions(id) on delete set null,
  source_key text,
  action text not null,
  project_title text not null default '',
  target_name text not null default '',
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  actor_access_level text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_manager_activity_access_level_check
    check (actor_access_level in ('super_admin', 'project_manager', 'reviewer', 'client'))
);

create index if not exists project_manager_activity_actor_created_idx
  on public.project_manager_activity (actor_id, created_at desc);
create index if not exists project_manager_activity_created_idx
  on public.project_manager_activity (created_at desc);

alter table public.project_manager_activity enable row level security;
revoke all on public.project_manager_activity from public, anon, authenticated;
grant select on public.project_manager_activity to authenticated;

drop policy if exists "admins view their activity and super admins view all" on public.project_manager_activity;
create policy "admins view their activity and super admins view all"
  on public.project_manager_activity for select to authenticated
  using (
    public.is_admin()
    or (
      actor_id = auth.uid()
      and (public.can_manage_projects() or public.can_review_submissions())
    )
  );

create table if not exists public.application_screener_submissions (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  form_url text not null,
  confirmed_at timestamptz not null default transaction_timestamp()
);

create index if not exists application_screener_submissions_application_idx
  on public.application_screener_submissions (application_id, confirmed_at desc);

alter table public.application_screener_submissions enable row level security;
revoke all on public.application_screener_submissions from public, anon, authenticated;
grant select on public.application_screener_submissions to authenticated;

drop policy if exists "admins view application screener confirmations" on public.application_screener_submissions;
create policy "admins view application screener confirmations"
  on public.application_screener_submissions for select to authenticated
  using (public.is_admin() or actor_id = auth.uid());

drop policy if exists "admins view application uTest update requests" on public.application_utest_update_requests;
drop policy if exists "project managers view application uTest update requests" on public.application_utest_update_requests;
create policy "project managers view application uTest update requests"
  on public.application_utest_update_requests for select to authenticated
  using (public.can_manage_projects());

create or replace function public.fetch_project_manager_applications()
returns table (
  id uuid,
  project_id uuid,
  tester_id uuid,
  status text,
  invite_status text,
  selected_devices text[],
  experience_note text,
  applied_at timestamptz,
  accepted_invite_at timestamptz,
  last_invite_sent_at timestamptz,
  invite_history jsonb,
  project jsonb,
  application_utest_details jsonb,
  profiles jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can view the application pipeline';
  end if;
  return query
  select application.id, application.project_id, application.tester_id,
    application.status, application.invite_status, application.selected_devices,
    application.experience_note, application.applied_at, application.accepted_invite_at,
    application.last_invite_sent_at, application.invite_history,
    jsonb_build_object('id', project.id, 'title', project.title, 'company', project.company),
    case when account.application_id is null then '[]'::jsonb else
      jsonb_build_array(jsonb_build_object(
        'utest_id', account.utest_id,
        'utest_email', account.utest_email,
        'utest_account_screenshot_url', account.utest_account_screenshot_url
      )) end,
    jsonb_build_object(
      'id', tester.id,
      'name', tester.name,
      'email', tester.email,
      'profile_data', jsonb_build_object(
        'testerProfile', jsonb_build_object(
          'uTestId', coalesce(account.utest_id, tester.profile_data #>> '{testerProfile,uTestId}', ''),
          'uTestEmail', coalesce(account.utest_email, tester.profile_data #>> '{testerProfile,uTestEmail}', ''),
          'rating', coalesce(tester.profile_data #>> '{testerProfile,rating}', '0'),
          'tier', coalesce(tester.profile_data #>> '{testerProfile,tier}', 'Bronze')
        )
      )
    )
  from public.applications application
  join public.projects project on project.id = application.project_id
  join public.profiles tester on tester.id = application.tester_id
  left join public.application_utest_details account on account.application_id = application.id
  order by application.applied_at desc;
end;
$$;

create or replace function public.match_project_applause_application(
  p_project_id uuid,
  p_emails text[]
)
returns table (
  application_id uuid,
  tester_id uuid,
  tester_name text,
  tester_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can match Applause rows';
  end if;
  if p_project_id is null or p_emails is null or cardinality(p_emails) > 10 then
    raise exception 'A project and a bounded list of contact emails are required';
  end if;
  return query
  select application.id, tester.id, tester.name, tester.email
  from public.applications application
  join public.profiles tester on tester.id = application.tester_id
  where application.project_id = p_project_id
    and nullif(trim(tester.email), '') is not null
    and lower(trim(tester.email)) in (
      select lower(trim(contacts.email))
      from unnest(p_emails) as contacts(email)
      where nullif(trim(contacts.email), '') is not null
    );
end;
$$;

create or replace function public.approve_project_application(
  p_application_id uuid,
  p_screener_submitted boolean,
  p_screener_form_url text,
  p_invite_history jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  account_details public.application_utest_details%rowtype;
  project_owner_id uuid;
  expected_form_url constant text := 'https://docs.google.com/forms/d/e/1FAIpQLSeEPV0KzYwNLeLGlhvtvotOSt7goCnw4GB8bonAqJEQjqCLzA/viewform';
begin
  if p_screener_submitted is distinct from true then
    raise exception 'Confirm that the screener was submitted before approving this application';
  end if;
  if p_screener_form_url is distinct from expected_form_url then
    raise exception 'The required screener form URL is invalid';
  end if;
  if jsonb_typeof(p_invite_history) is distinct from 'array' then
    raise exception 'Invite history must be an array';
  end if;

  select * into target_application
  from public.applications
  where id = p_application_id
  for update;
  if not found then raise exception 'Project application not found'; end if;
  select client_id into project_owner_id
  from public.projects
  where id = target_application.project_id;
  if not coalesce(public.can_manage_projects(), false)
     and not exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'client' and id = project_owner_id
     ) then
    raise exception 'Only the project owner, project managers, or super admins can approve applications';
  end if;
  if target_application.status <> 'pending' then
    raise exception 'Only pending applications can be approved';
  end if;

  select * into account_details
  from public.application_utest_details
  where application_id = target_application.id;
  if not found or nullif(trim(account_details.utest_id), '') is null then
    raise exception 'A uTest ID is required before approval';
  end if;
  if nullif(trim(account_details.utest_account_screenshot_url), '') is null
     or account_details.utest_account_screenshot_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'A valid uTest account screenshot is required before approval';
  end if;

  insert into public.application_screener_submissions (application_id, actor_id, form_url)
  values (target_application.id, auth.uid(), expected_form_url);

  update public.applications
  set status = 'approved',
      invite_status = 'invited',
      invite_history = p_invite_history,
      updated_at = now()
  where id = target_application.id;
end;
$$;

revoke all on function public.approve_project_application(uuid, boolean, text, jsonb) from public, anon;
grant execute on function public.approve_project_application(uuid, boolean, text, jsonb) to authenticated;
revoke all on function public.fetch_project_manager_applications() from public, anon;
grant execute on function public.fetch_project_manager_applications() to authenticated;
revoke all on function public.match_project_applause_application(uuid, text[]) from public, anon;
grant execute on function public.match_project_applause_application(uuid, text[]) to authenticated;

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
    and not coalesce(public.can_manage_projects(), false)
    and coalesce(auth.role(), '') <> 'service_role'
    and not exists (
      select 1 from public.projects project
      where project.id = new.project_id
        and project.client_id = auth.uid()
    ) then
    raise exception 'Only the project owner, project managers, or super admins can approve an application';
  end if;
  return new;
end;
$$;

create or replace function public.log_project_application_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles%rowtype;
  project_name text;
  tester_name text;
  screener_confirmation public.application_screener_submissions%rowtype;
  activity_action text;
begin
  if old.status is not distinct from new.status or new.status not in ('approved', 'rejected', 'needs_utest_update') then
    return new;
  end if;
  if not coalesce(public.can_review_submissions(), false)
     and not exists (
       select 1 from public.projects project
       join public.profiles actor on actor.id = auth.uid()
       where project.id = new.project_id
         and project.client_id = auth.uid()
         and actor.role = 'client'
     ) then
    return new;
  end if;

  select * into actor_profile from public.profiles where id = auth.uid();
  select title into project_name from public.projects where id = new.project_id;
  select name into tester_name from public.profiles where id = new.tester_id;
  activity_action := case new.status
    when 'approved' then 'application_approved'
    when 'rejected' then 'application_rejected'
    else 'application_utest_account_requested'
  end;

  if new.status = 'approved' then
    if old.status = 'needs_utest_update'
       and exists (
         select 1 from public.application_utest_update_requests request
         where request.application_id = new.id
           and request.status = 'pending'
           and request.previous_status = 'approved'
       ) then
      return new;
    end if;
    select * into screener_confirmation
    from public.application_screener_submissions
    where application_id = new.id
      and actor_id = auth.uid()
      and confirmed_at = transaction_timestamp()
    order by confirmed_at desc
    limit 1;
    if not found then
      raise exception 'A new screener confirmation is required before approving this application';
    end if;
  end if;

  insert into public.project_manager_activity (
    project_id, application_id, action, project_title, target_name,
    actor_id, actor_name, actor_access_level, details
  ) values (
    new.project_id, new.id, activity_action, coalesce(project_name, ''),
    coalesce(tester_name, ''),
    actor_profile.id, coalesce(nullif(trim(actor_profile.name), ''), actor_profile.email),
    coalesce(actor_profile.admin_access_level, case when actor_profile.role = 'client' then 'client' end),
    jsonb_build_object('fromStatus', old.status, 'toStatus', new.status)
      || case when new.status = 'approved'
        then jsonb_build_object('screenerConfirmedAt', screener_confirmation.confirmed_at,
          'screenerFormUrl', screener_confirmation.form_url)
        else '{}'::jsonb end
  );
  return new;
end;
$$;

drop trigger if exists applications_log_manager_activity on public.applications;
create trigger applications_log_manager_activity
  after update of status on public.applications
  for each row execute function public.log_project_application_activity();

create or replace function public.log_project_submission_review_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles%rowtype;
  project_name text;
  tester_name text;
  activity_action text;
begin
  if old.status is not distinct from new.status
     or new.status not in ('approved', 'rejected', 'changes_requested')
     or not coalesce(public.can_review_submissions(), false) then
    return new;
  end if;

  select * into actor_profile from public.profiles where id = auth.uid();
  select title into project_name from public.projects where id = new.project_id;
  select name into tester_name from public.profiles where id = new.tester_id;
  activity_action := case new.status
    when 'approved' then 'submission_approved'
    when 'rejected' then 'submission_rejected'
    else 'submission_changes_requested'
  end;

  insert into public.project_manager_activity (
    project_id, submission_id, action, project_title, target_name,
    actor_id, actor_name, actor_access_level, details
  ) values (
    new.project_id, new.id, activity_action, coalesce(project_name, ''),
    coalesce(tester_name, ''),
    actor_profile.id, coalesce(nullif(trim(actor_profile.name), ''), actor_profile.email),
    actor_profile.admin_access_level,
    jsonb_build_object('fromStatus', old.status, 'toStatus', new.status, 'submissionTitle', new.title)
  );
  return new;
end;
$$;

drop trigger if exists submissions_log_manager_review_activity on public.submissions;
create trigger submissions_log_manager_review_activity
  after update of status on public.submissions
  for each row execute function public.log_project_submission_review_activity();

create or replace function public.record_applause_follow_up_activity(
  p_project_id uuid,
  p_source_key text,
  p_action text,
  p_target_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.project_applause_status%rowtype;
  project_name text;
  actor_profile public.profiles%rowtype;
  activity_id uuid;
  expected_status text;
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can record Applause follow-ups';
  end if;
  if p_action is null or p_action not in (
    'settings_video_requested',
    'project_completion_reminded',
    'consent_signature_requested'
  ) then
    raise exception 'Unsupported Applause follow-up action';
  end if;

  expected_status := case p_action
    when 'settings_video_requested' then 'ready for settings check'
    when 'project_completion_reminded' then 'in progress'
    else 'consent form sent'
  end;
  select * into source_row
  from public.project_applause_status
  where project_id = p_project_id and source_key = p_source_key;
  if not found or lower(trim(source_row.status)) <> expected_status then
    raise exception 'This Applause row is no longer in the expected project stage. Sync the sheet and try again';
  end if;

  select title into project_name from public.projects where id = p_project_id;
  select * into actor_profile from public.profiles where id = auth.uid();
  insert into public.project_manager_activity (
    project_id, source_key, action, project_title, target_name,
    actor_id, actor_name, actor_access_level, details
  ) values (
    p_project_id, p_source_key, 'applause_' || p_action, coalesce(project_name, ''),
    coalesce(nullif(trim(p_target_name), ''), 'Applause tester'),
    actor_profile.id, coalesce(nullif(trim(actor_profile.name), ''), actor_profile.email),
    actor_profile.admin_access_level,
    jsonb_build_object('status', source_row.status)
  ) returning id into activity_id;
  return activity_id;
end;
$$;

revoke all on function public.record_applause_follow_up_activity(uuid, text, text, text) from public, anon;
grant execute on function public.record_applause_follow_up_activity(uuid, text, text, text) to authenticated;

drop policy if exists "admins manage project operations settings" on public.project_operations_settings;
drop policy if exists "project managers view project operations settings" on public.project_operations_settings;
create policy "admins manage project operations settings"
  on public.project_operations_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.project_applause_consent_reminder_email_outbox
  alter column profile_id drop not null;
alter table public.project_applause_consent_reminder_email_outbox
  add column if not exists external_recipient boolean not null default false;

drop index if exists public.project_applause_consent_reminder_source_uidx;
create unique index if not exists project_applause_consent_reminder_active_recipient_uidx
  on public.project_applause_consent_reminder_email_outbox (project_id, (lower(trim(recipient_email))))
  where status in ('pending', 'processing');

create or replace function public.get_project_manager_applause_sheet_url(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sheet_url text;
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can view the Applause status sheet';
  end if;
  select settings.applause_sheet_url into sheet_url
  from public.project_operations_settings as settings
  where settings.project_id = p_project_id;
  return sheet_url;
end;
$$;

revoke all on function public.get_project_manager_applause_sheet_url(uuid) from public, anon;
grant execute on function public.get_project_manager_applause_sheet_url(uuid) to authenticated;

drop policy if exists "admins view project Applause statuses" on public.project_applause_status;
drop policy if exists "project managers view project Applause statuses" on public.project_applause_status;
create policy "project managers view project Applause statuses"
  on public.project_applause_status for select to authenticated
  using (public.can_manage_projects());

drop policy if exists "admins view project payroll schedules" on public.project_payroll_schedule;
create policy "admins view project payroll schedules"
  on public.project_payroll_schedule for select to authenticated
  using (public.is_admin());

create or replace function public.queue_applause_completion_approval_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_profile public.profiles%rowtype;
begin
  if coalesce(public.can_manage_projects(), false)
     and not coalesce(public.is_admin(), false) then
    return new;
  end if;
  if lower(trim(new.status)) <> 'claimed complete'
    or (
      tg_op = 'UPDATE'
      and lower(trim(old.status)) = 'claimed complete'
    ) then
    return new;
  end if;

  select profile.* into matched_profile
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
  if matched_profile.id is null then return new; end if;

  insert into public.project_applause_approval_email_outbox (
    project_id, profile_id, source_key, recipient_email, recipient_name,
    project_title, project_company, project_description, project_deadline
  )
  select new.project_id, matched_profile.id, new.source_key, matched_profile.email,
    coalesce(nullif(trim(matched_profile.name), ''), split_part(matched_profile.email, '@', 1)),
    project.title, project.company, project.short_description, coalesce(project.deadline, '')
  from public.projects as project
  where project.id = new.project_id
  on conflict (project_id, profile_id) do nothing;
  return new;
end;
$$;

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
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can sync project statuses';
  end if;
  if p_project_id is null then raise exception 'A project is required'; end if;
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
  if not found then raise exception 'Configure this project integration before syncing its sheet'; end if;

  delete from public.project_applause_status where project_id = p_project_id;
  insert into public.project_applause_status (
    project_id, source_key, status, tester_id, tester_email, google_email,
    consent_name, id_scan_status, utest_id, issues, synced_at
  )
  select p_project_id, row_data.source_key, coalesce(row_data.status, ''),
    coalesce(row_data.tester_id, ''), coalesce(row_data.tester_email, ''),
    coalesce(row_data.google_email, ''), coalesce(row_data.consent_name, ''),
    coalesce(row_data.id_scan_status, ''), coalesce(row_data.utest_id, ''),
    coalesce(row_data.issues, ''), now()
  from jsonb_to_recordset(p_rows) as row_data(
    source_key text, status text, tester_id text, tester_email text,
    google_email text, consent_name text, id_scan_status text,
    utest_id text, issues text
  )
  where nullif(trim(row_data.source_key), '') is not null;
  get diagnostics imported_count = row_count;

  if public.is_admin() then
    update public.project_payroll_schedule as schedule
    set status = 'cancelled', updated_at = now()
    where schedule.project_id = p_project_id and schedule.status = 'scheduled'
      and not exists (
        select 1 from public.project_applause_status as source
        where source.project_id = schedule.project_id
          and source.source_key = schedule.source_key
          and lower(trim(source.status)) = 'claimed complete'
      );

    if payout_amount > 0 and payout_date is not null then
      insert into public.project_payroll_schedule (
        project_id, source_key, tester_id, tester_email, amount, scheduled_date, status
      )
      select source.project_id, source.source_key, source.tester_id, source.tester_email,
        payout_amount, payout_date, 'scheduled'
      from public.project_applause_status as source
      where source.project_id = p_project_id
        and lower(trim(source.status)) = 'claimed complete'
        and nullif(trim(source.tester_email), '') is not null
      on conflict (project_id, source_key) do update
      set tester_id = excluded.tester_id, tester_email = excluded.tester_email,
        amount = excluded.amount, scheduled_date = excluded.scheduled_date,
        status = 'scheduled', updated_at = now()
      where public.project_payroll_schedule.status <> 'paid';
    else
      update public.project_payroll_schedule as schedule
      set status = 'cancelled', updated_at = now()
      where schedule.project_id = p_project_id and schedule.status = 'scheduled';
    end if;
  end if;
  return imported_count;
end;
$$;

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
  project_name text;
  actor_profile public.profiles%rowtype;
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can send Applause consent reminders';
  end if;
  if p_project_id is null then raise exception 'A project is required'; end if;
  if p_source_keys is null or cardinality(p_source_keys) = 0 or cardinality(p_source_keys) > 5000 then
    raise exception 'Select between 1 and 5000 consent-pending rows';
  end if;

  select coalesce(settings.payroll_amount, 0) into project_amount
  from public.project_operations_settings as settings where settings.project_id = p_project_id;
  if not found then raise exception 'Configure this project integration before sending consent reminders'; end if;

  select title into project_name from public.projects where id = p_project_id;
  select * into actor_profile from public.profiles where id = auth.uid();
  if not found then raise exception 'Unable to identify the current project manager'; end if;

  with queued_reminders as (
    insert into public.project_applause_consent_reminder_email_outbox (
      project_id, profile_id, source_key, recipient_email, recipient_name,
      utest_id, project_title, project_amount, project_lock_date, external_recipient
    )
    select distinct on (source.project_id, lower(trim(recipient.email)))
      source.project_id, null, source.source_key, recipient.email, 'tester',
      coalesce(nullif(trim(source.utest_id), ''), nullif(trim(source.tester_id), ''), ''),
      project.title, coalesce(project_amount, 0), coalesce(project.deadline::text, ''), true
    from public.project_applause_status as source
    join public.projects as project on project.id = source.project_id
    cross join lateral (
      select coalesce(
        nullif(trim(source.google_email), ''),
        nullif(trim(source.tester_email), '')
      ) as email
    ) as recipient
    where source.project_id = p_project_id
      and source.source_key = any(p_source_keys)
      and lower(trim(coalesce(source.consent_name, ''))) = 'pending'
      and nullif(trim(recipient.email), '') is not null
    order by source.project_id, lower(trim(recipient.email)), source.source_key
    on conflict (project_id, (lower(trim(recipient_email))))
      where status in ('pending', 'processing')
    do nothing
    returning project_id, source_key, recipient_email, utest_id
  )
  insert into public.project_manager_activity (
    project_id, source_key, action, project_title, target_name,
    actor_id, actor_name, actor_access_level, details
  )
  select queued_reminders.project_id, queued_reminders.source_key,
    'applause_consent_reminder_queued', coalesce(project_name, ''),
    coalesce(nullif(trim(queued_reminders.utest_id), ''), queued_reminders.recipient_email),
    actor_profile.id, coalesce(nullif(trim(actor_profile.name), ''), actor_profile.email),
    actor_profile.admin_access_level,
    jsonb_build_object('recipientEmail', queued_reminders.recipient_email)
  from queued_reminders;

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

create or replace function public.request_application_utest_details(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  request_id uuid;
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can request application uTest details';
  end if;
  select * into target_application from public.applications
    where id = p_application_id for update;
  if not found then raise exception 'Project application not found'; end if;

  select id into request_id from public.application_utest_update_requests
  where application_id = target_application.id and status = 'pending' limit 1;
  if request_id is null then
    insert into public.application_utest_update_requests (
      application_id, project_id, tester_id, previous_status,
      previous_invite_status, requested_by
    ) values (
      target_application.id, target_application.project_id, target_application.tester_id,
      case when target_application.status = 'needs_utest_update' then 'approved' else target_application.status end,
      target_application.invite_status, auth.uid()
    ) returning id into request_id;
  end if;

  update public.applications
  set status = 'needs_utest_update', invite_status = null, updated_at = now()
  where id = target_application.id;
  return request_id;
end;
$$;

create or replace function public.admin_save_application_utest_details(
  p_application_id uuid,
  p_utest_id text,
  p_utest_email text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  pending_request public.application_utest_update_requests%rowtype;
  normalized_utest_id text := trim(coalesce(p_utest_id, ''));
  normalized_utest_email text := trim(coalesce(p_utest_email, ''));
  tester_name text;
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Only project managers and super admins can update application uTest details';
  end if;
  if normalized_utest_id = '' or length(normalized_utest_id) > 120 then
    raise exception 'Enter a valid uTest ID';
  end if;
  if normalized_utest_email <> ''
     and normalized_utest_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid uTest email address';
  end if;

  select * into target_application from public.applications
    where id = p_application_id for update;
  if not found then raise exception 'Project application not found'; end if;
  select name into tester_name from public.profiles where id = target_application.tester_id;

  insert into public.application_utest_details (
    application_id, tester_id, full_name, utest_id, utest_email
  ) values (
    target_application.id, target_application.tester_id, coalesce(tester_name, ''),
    normalized_utest_id, normalized_utest_email
  )
  on conflict (application_id) do update
  set utest_id = excluded.utest_id,
    utest_email = case when excluded.utest_email = ''
      then public.application_utest_details.utest_email else excluded.utest_email end,
    updated_at = now();

  select * into pending_request from public.application_utest_update_requests
  where application_id = target_application.id and status = 'pending' for update;
  if found then
    update public.applications
    set status = pending_request.previous_status,
      invite_status = pending_request.previous_invite_status, updated_at = now()
    where id = target_application.id;
    update public.application_utest_update_requests
    set status = 'completed', completed_at = now()
    where id = pending_request.id;
  end if;
end;
$$;

revoke all on function public.sync_project_applause_status(uuid, jsonb) from public, anon;
grant execute on function public.sync_project_applause_status(uuid, jsonb) to authenticated;
revoke all on function public.queue_project_applause_consent_reminders(uuid, text[]) from public, anon;
grant execute on function public.queue_project_applause_consent_reminders(uuid, text[]) to authenticated;
revoke all on function public.request_application_utest_details(uuid) from public, anon;
grant execute on function public.request_application_utest_details(uuid) to authenticated;
revoke all on function public.admin_save_application_utest_details(uuid, text, text) from public, anon;
grant execute on function public.admin_save_application_utest_details(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
