drop trigger if exists applications_enqueue_project_approval_email on public.applications;

update public.project_email_outbox
set status = 'failed',
    locked_until = null,
    last_error = 'Automatic project invitation email delivery was disabled. An admin can send the invitation manually.',
    updated_at = now()
where status in ('pending', 'processing');

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
      updated_at = transaction_timestamp()
  where id = target_application.id;
end;
$$;

revoke all on function public.approve_application_after_screener(uuid) from public, anon, authenticated;
grant execute on function public.approve_application_after_screener(uuid) to service_role;
