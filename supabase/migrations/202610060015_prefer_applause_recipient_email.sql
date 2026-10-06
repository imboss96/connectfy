-- Preserve each Applause participant's own email. A uTest ID match must not
-- redirect or collapse rows that already have a recipient email in the sheet.
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
    matched_profile.id,
    source.source_key,
    recipient.email,
    case when matched_profile.id is null
      then coalesce(nullif(trim(source.utest_id), ''), nullif(trim(source.tester_id), ''), 'uTest tester')
      else coalesce(nullif(trim(matched_profile.name), ''), split_part(matched_profile.email, '@', 1)) end,
    coalesce(nullif(trim(source.utest_id), ''), nullif(trim(source.tester_id), ''), nullif(trim(matched_profile.profile_data #>> '{testerProfile,uTestId}'), ''), ''),
    project.title,
    coalesce(project_amount, 0),
    coalesce(project.deadline::text, ''),
    matched_profile.id is null
  from public.project_applause_status as source
  join public.projects as project on project.id = source.project_id
  left join lateral (
    select profile.id, profile.email, profile.name, profile.profile_data
    from public.profiles as profile
    where profile.role = 'tester'
      and nullif(trim(profile.email), '') is not null
      and (
        lower(trim(profile.email)) in (lower(trim(source.tester_email)), lower(trim(source.google_email)))
        or (
          nullif(trim(source.tester_email), '') is null
          and nullif(trim(source.google_email), '') is null
          and lower(trim(profile.profile_data #>> '{testerProfile,uTestId}')) in (
            lower(trim(source.tester_id)), lower(trim(source.utest_id))
          )
        )
      )
    order by case
      when lower(trim(profile.email)) = lower(trim(source.tester_email)) then 0
      when lower(trim(profile.email)) = lower(trim(source.google_email)) then 1
      else 2 end, profile.id
    limit 1
  ) as matched_profile on true
  cross join lateral (
    select coalesce(
      nullif(trim(source.tester_email), ''),
      nullif(trim(source.google_email), ''),
      nullif(trim(matched_profile.email), '')
    ) as email
  ) as recipient
  where source.project_id = p_project_id
    and source.source_key = any(p_source_keys)
    and lower(trim(coalesce(source.consent_name, ''))) = 'pending'
    and nullif(trim(recipient.email), '') is not null
    and (matched_profile.id is not null or coalesce(nullif(trim(source.utest_id), ''), nullif(trim(source.tester_id), '')) is not null)
  order by source.project_id, lower(trim(recipient.email)), source.source_key
  on conflict (project_id, (lower(trim(recipient_email))))
    where status in ('pending', 'processing')
  do nothing;

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

notify pgrst, 'reload schema';
