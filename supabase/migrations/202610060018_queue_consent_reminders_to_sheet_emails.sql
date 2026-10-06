-- Consent reminders use the Applause sheet's contact emails directly. This
-- avoids routing an external participant through a Connectfy profile match.
update public.project_applause_consent_reminder_email_outbox as reminder
set status = 'failed',
    locked_until = null,
    last_error = 'Recipient address updated. Select this participant again to queue the reminder to the sheet contact email.',
    updated_at = now()
from public.project_applause_status as source
where reminder.project_id = source.project_id
  and reminder.source_key = source.source_key
  and reminder.status = 'pending'
  and coalesce(nullif(trim(source.google_email), ''), nullif(trim(source.tester_email), '')) is not null
  and lower(trim(reminder.recipient_email)) <> lower(trim(coalesce(
    nullif(trim(source.google_email), ''),
    nullif(trim(source.tester_email), '')
  )));

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
  if p_project_id is null then raise exception 'A project is required'; end if;
  if p_source_keys is null or cardinality(p_source_keys) = 0 or cardinality(p_source_keys) > 5000 then
    raise exception 'Select between 1 and 5000 consent-pending rows';
  end if;

  select coalesce(settings.payroll_amount, 0)
    into project_amount
    from public.project_operations_settings as settings
    where settings.project_id = p_project_id;
  if not found then raise exception 'Configure this project integration before sending consent reminders'; end if;

  insert into public.project_applause_consent_reminder_email_outbox (
    project_id, profile_id, source_key, recipient_email, recipient_name, utest_id,
    project_title, project_amount, project_lock_date, external_recipient
  )
  select distinct on (source.project_id, lower(trim(recipient.email)))
    source.project_id,
    null,
    source.source_key,
    recipient.email,
    'tester',
    coalesce(nullif(trim(source.utest_id), ''), nullif(trim(source.tester_id), ''), ''),
    project.title,
    coalesce(project_amount, 0),
    coalesce(project.deadline::text, ''),
    true
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
  do nothing;

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

notify pgrst, 'reload schema';
