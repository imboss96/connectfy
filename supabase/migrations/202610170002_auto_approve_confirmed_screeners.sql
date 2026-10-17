alter table public.project_manager_activity
  drop constraint if exists project_manager_activity_access_level_check;

alter table public.project_manager_activity
  add constraint project_manager_activity_access_level_check
  check (actor_access_level in ('super_admin', 'project_manager', 'reviewer', 'client', 'system'));

drop policy if exists "admins view their activity and super admins view all" on public.project_manager_activity;
create policy "admins view their activity and super admins view all"
  on public.project_manager_activity for select to authenticated
  using (
    public.is_admin()
    or (
      actor_id = auth.uid()
      and (public.can_manage_projects() or public.can_review_submissions())
    )
    or (
      actor_access_level = 'system'
      and coalesce(public.can_manage_projects(), false)
    )
  );

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
  is_system_actor boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if old.status is not distinct from new.status or new.status not in ('approved', 'rejected', 'needs_utest_update') then
    return new;
  end if;
  if not is_system_actor
     and not coalesce(public.can_review_submissions(), false)
     and not exists (
       select 1 from public.projects project
       join public.profiles actor on actor.id = auth.uid()
       where project.id = new.project_id
         and project.client_id = auth.uid()
         and actor.role = 'client'
     ) then
    return new;
  end if;

  if not is_system_actor then
    select * into actor_profile from public.profiles where id = auth.uid();
  end if;
  select title into project_name from public.projects where id = new.project_id;
  select name into tester_name from public.profiles where id = new.tester_id;
  activity_action := case new.status
    when 'approved' then 'application_approved'
    when 'rejected' then 'application_rejected'
    else 'application_utest_account_requested'
  end;

  if new.status = 'approved' then
    if not is_system_actor
       and old.status = 'needs_utest_update'
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
      and actor_id = case when is_system_actor then new.tester_id else auth.uid() end
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
    case when is_system_actor then null else actor_profile.id end,
    case when is_system_actor
      then 'Connectfy System Bot'
      else coalesce(nullif(trim(actor_profile.name), ''), actor_profile.email)
    end,
    case when is_system_actor
      then 'system'
      else coalesce(actor_profile.admin_access_level, case when actor_profile.role = 'client' then 'client' end)
    end,
    jsonb_build_object('fromStatus', old.status, 'toStatus', new.status)
      || case when new.status = 'approved'
        then jsonb_build_object('screenerConfirmedAt', screener_confirmation.confirmed_at,
          'screenerFormUrl', screener_confirmation.form_url)
        else '{}'::jsonb end
  );
  return new;
end;
$$;

create or replace function public.approve_application_after_screener(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  account_details public.application_utest_details%rowtype;
  expected_form_url constant text := 'https://docs.google.com/forms/d/e/1FAIpQLSeEPV0KzYwNLeLGlhvtvotOSt7goCnw4GB8bonAqJEQjqCLzA/viewform';
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the screener service can automatically approve applications';
  end if;

  select * into target_application
  from public.applications
  where id = p_application_id
  for update;
  if not found then
    raise exception 'Project application not found';
  end if;

  if target_application.status = 'approved' and target_application.invite_status = 'invited' then
    return;
  end if;
  if target_application.status <> 'pending' then
    raise exception 'Only pending applications can be automatically approved';
  end if;

  select * into account_details
  from public.application_utest_details
  where application_id = target_application.id
  for update;
  if not found
     or account_details.screener_submission_status <> 'submitted'
     or account_details.screener_submitted_at is null
     or account_details.screener_consent is distinct from true
     or nullif(trim(account_details.utest_id), '') is null
     or account_details.utest_id !~ '^30[0-9]+$'
     or nullif(trim(account_details.utest_account_screenshot_url), '') is null
     or account_details.utest_account_screenshot_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'Confirmed screener, consent, a uTest ID beginning with 30, and a valid account screenshot are required';
  end if;

  insert into public.application_screener_submissions (application_id, actor_id, form_url)
  values (target_application.id, target_application.tester_id, expected_form_url);

  update public.applications
  set status = 'approved',
      invite_status = 'invited',
      invite_history = coalesce(invite_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'sentAt', to_char(transaction_timestamp(), 'YYYY-MM-DD HH24:MI'),
        'type', 'invite',
        'note', 'Screener confirmed; invitation queued automatically'
      )),
      updated_at = transaction_timestamp()
  where id = target_application.id;
end;
$$;

revoke all on function public.approve_application_after_screener(uuid) from public, anon, authenticated;
grant execute on function public.approve_application_after_screener(uuid) to service_role;
