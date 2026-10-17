create or replace function public.reconcile_confirmed_application_screener(
  p_application_id uuid,
  p_form_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  account_details public.application_utest_details%rowtype;
  outbox_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the screener service can reconcile confirmed applications';
  end if;

  if p_form_url is null or p_form_url not in (
    'https://docs.google.com/forms/d/e/1FAIpQLSeEPV0KzYwNLeLGlhvtvotOSt7goCnw4GB8bonAqJEQjqCLzA/viewform',
    'https://docs.google.com/forms/d/e/1FAIpQLSeLvCyrZrRNAmKzIST2YDKmv20jSBSfYQlSwpKhGjGwFrlpKg/viewform'
  ) then
    raise exception 'The form URL is not an approved Connectfy screener';
  end if;

  select * into target_application
  from public.applications
  where id = p_application_id
  for update;
  if not found or target_application.status <> 'pending' then
    raise exception 'Only a pending application can be reconciled';
  end if;

  select * into account_details
  from public.application_utest_details
  where application_id = p_application_id
  for update;
  if not found
     or account_details.screener_submission_status <> 'pending'
     or account_details.screener_consent is distinct from true
     or account_details.screener_consent_at is null
     or account_details.utest_id !~ '^30[0-9]+$'
     or nullif(trim(account_details.utest_account_screenshot_url), '') is null then
    raise exception 'The application is not eligible for confirmed screener reconciliation';
  end if;

  select status into outbox_status
  from public.application_screener_outbox
  where application_id = p_application_id
  for update;
  if outbox_status is distinct from 'ambiguous' then
    raise exception 'The screener outbox is not in an ambiguous state';
  end if;

  update public.application_utest_details
  set screener_submission_status = 'submitted',
      screener_submitted_at = coalesce(screener_submitted_at, transaction_timestamp()),
      screener_submission_error = null
  where application_id = p_application_id;

  update public.application_screener_outbox
  set status = 'submitted',
      last_error = null,
      updated_at = transaction_timestamp(),
      claimed_at = null,
      retry_after = null,
      finished_at = transaction_timestamp()
  where application_id = p_application_id;

  insert into public.application_screener_submissions (application_id, actor_id, form_url)
  values (p_application_id, target_application.tester_id, p_form_url);

  update public.applications
  set status = 'approved',
      invite_status = 'invited',
      invite_history = coalesce(invite_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'sentAt', to_char(transaction_timestamp(), 'YYYY-MM-DD HH24:MI'),
        'type', 'invite',
        'note', 'Externally confirmed screener reconciled by an administrator; invitation queued automatically'
      )),
      updated_at = transaction_timestamp()
  where id = p_application_id;
end;
$$;

revoke all on function public.reconcile_confirmed_application_screener(uuid, text) from public, anon, authenticated;
grant execute on function public.reconcile_confirmed_application_screener(uuid, text) to service_role;
