create or replace function public.admin_reconcile_application_screener(
  p_project_id uuid,
  p_tester_id uuid,
  p_answers jsonb,
  p_applicant_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_profile public.profiles%rowtype;
  target_project public.projects%rowtype;
  existing_application public.applications%rowtype;
  v_application_id uuid;
  screener_status text;
  normalized_utest_id text;
  applicant_dob date;
  applicant_age integer;
  language_values text[];
begin
  if auth.uid() is null then
    raise exception 'Sign in as a project manager or super admin to reconcile screeners';
  end if;

  select * into admin_profile
  from public.profiles
  where id = auth.uid();
  if not found or admin_profile.role <> 'admin'
      or coalesce(admin_profile.admin_access_level, '') not in ('super_admin', 'project_manager') then
    raise exception 'Only project managers and super admins can reconcile screeners';
  end if;
  if p_applicant_confirmed is distinct from true then
    raise exception 'Confirm that the applicant provided these answers and agreed to screener submission';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Screener answers must be provided as an object';
  end if;
  if not exists (select 1 from public.profiles where id = p_tester_id and role = 'tester') then
    raise exception 'Choose a registered tester account';
  end if;
  perform 1 from public.profiles where id = p_tester_id for update;

  select * into target_project
  from public.projects
  where id = p_project_id
  for update;
  if not found then
    raise exception 'The selected project does not exist';
  end if;

  select * into existing_application
  from public.applications
  where project_id = p_project_id and tester_id = p_tester_id
  for update;

  if found then
    if existing_application.status <> 'pending' then
      raise exception 'Only pending applications can be reconciled';
    end if;
    v_application_id := existing_application.id;
    select screener_submission_status into screener_status
    from public.application_utest_details
    where application_utest_details.application_id = v_application_id
    for update;
    if screener_status in ('queued', 'pending', 'submitted') then
      raise exception 'This screener is already queued, in progress, or submitted';
    end if;
  else
    if exists (select 1 from public.applications where tester_id = p_tester_id) then
      raise exception 'This tester has already applied to a project';
    end if;
    if target_project.status <> 'active'
       or target_project.slots_total <= 0
       or target_project.slots_filled >= target_project.slots_total then
      raise exception 'The selected project is not accepting applications';
    end if;
    insert into public.applications (project_id, tester_id, status, selected_devices, experience_note)
    values (p_project_id, p_tester_id, 'pending', '{}', 'Screener answers verified and entered by an administrator.')
    returning id into v_application_id;
  end if;

  normalized_utest_id := trim(coalesce(p_answers->>'utest_id', ''));
  if normalized_utest_id !~ '^[0-9]{7}$' then
    raise exception 'The Applause screener requires a uTest ID from 3000001 through 4000001';
  end if;
  if normalized_utest_id::bigint < 3000001 or normalized_utest_id::bigint > 4000001 then
    raise exception 'The Applause screener requires a uTest ID from 3000001 through 4000001';
  end if;

  if length(trim(coalesce(p_answers->>'full_name', ''))) not between 1 and 200
     or length(trim(coalesce(p_answers->>'utest_email', ''))) > 254
     or trim(coalesce(p_answers->>'utest_email', '')) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(trim(coalesce(p_answers->>'phone_number', ''))) > 30
     or trim(coalesce(p_answers->>'phone_number', '')) !~ '^\+?[0-9][0-9 ().-]*$'
     or length(regexp_replace(coalesce(p_answers->>'phone_number', ''), '[^0-9]', '', 'g')) not between 7 and 15
     or trim(coalesce(p_answers->>'gmail_email', '')) !~* '^[^[:space:]@]+@gmail\.com$'
     or length(trim(coalesce(p_answers->>'country', ''))) not between 1 and 100
     or length(trim(coalesce(p_answers->>'screener_os_version', ''))) not between 1 and 120 then
    raise exception 'Enter a valid name, email, phone, Gmail address, country, and OS version';
  end if;

  begin
    applicant_dob := (p_answers->>'date_of_birth')::date;
  exception when others then
    raise exception 'Enter a valid date of birth';
  end;
  applicant_age := date_part('year', age(current_date, applicant_dob));
  if applicant_dob >= current_date or applicant_age < 18 then
    raise exception 'Screener applicants must be at least 18 years old';
  end if;

  if coalesce(p_answers->>'gender', '') not in ('Male', 'Female', 'Non-Binary', 'Prefer not to say', 'Other')
     or (p_answers->>'gender' = 'Other' and length(trim(coalesce(p_answers->>'gender_other', ''))) = 0) then
    raise exception 'Choose a valid gender and provide the Other value when selected';
  end if;
  if jsonb_typeof(p_answers->'fluent_languages') is distinct from 'array'
     or jsonb_array_length(p_answers->'fluent_languages') = 0 then
    raise exception 'Choose at least one fluent language';
  end if;
  select array_agg(value) into language_values
  from jsonb_array_elements_text(p_answers->'fluent_languages') as language(value);
  if exists (
    select 1 from unnest(language_values) language(value)
    where value not in ('English', 'Bengali', 'Hindi', 'Bahasa', 'Portuguese', 'Spanish (MX)', 'None of the above', 'Other')
  ) or ('Other' = any(language_values) and length(trim(coalesce(p_answers->>'language_other', ''))) = 0) then
    raise exception 'Choose valid fluent languages and provide the Other value when selected';
  end if;
  if coalesce(p_answers->>'device_type', '') not in (
    'Android (mobile) — camera & mic functional',
    'iOS (mobile) — camera & mic functional',
    'No functional camera/microphone',
    'Other'
  ) or (p_answers->>'device_type' = 'Other' and length(trim(coalesce(p_answers->>'device_other', ''))) = 0) then
    raise exception 'Choose a valid mobile-device type and provide the Other value when selected';
  end if;
    if jsonb_typeof(p_answers->'has_valid_id') is distinct from 'boolean'
      or jsonb_typeof(p_answers->'recording_space_available') is distinct from 'boolean'
      or jsonb_typeof(p_answers->'willing_voice_recording') is distinct from 'boolean' then
    raise exception 'Confirm the applicant ID, recording-space, and voice-recording answers';
  end if;
  if trim(coalesce(p_answers->>'smartphone', '')) = ''
     or trim(coalesce(p_answers->>'utest_account_screenshot_url', '')) !~* '^https?://[^[:space:]]+$' then
    raise exception 'A device description and valid uTest account screenshot URL are required';
  end if;

  insert into public.application_utest_details (
    application_id, tester_id, full_name, utest_id, utest_email, date_of_birth, age_range,
    country, smartphone, device_confirmation, has_valid_id, willing_voice_recording,
    phone_number, gmail_email, gender, gender_other, fluent_languages, language_other,
    recording_space_available, screener_device_type, screener_device_other,
    screener_os_version, utest_account_screenshot_url, screener_consent,
    screener_consent_at, admin_reconciled_by, admin_reconciled_at, updated_at
  ) values (
    v_application_id, p_tester_id, trim(p_answers->>'full_name'), normalized_utest_id,
    trim(p_answers->>'utest_email'), applicant_dob,
    case when applicant_age <= 25 then '18-25' when applicant_age <= 39 then '26-39'
      when applicant_age <= 59 then '40-59' else '60+' end,
    trim(p_answers->>'country'), trim(p_answers->>'smartphone'), trim(p_answers->>'smartphone'),
    (p_answers->>'has_valid_id')::boolean, (p_answers->>'willing_voice_recording')::boolean,
    trim(p_answers->>'phone_number'), trim(p_answers->>'gmail_email'), p_answers->>'gender',
    trim(coalesce(p_answers->>'gender_other', '')), language_values,
    trim(coalesce(p_answers->>'language_other', '')),
    (p_answers->>'recording_space_available')::boolean, p_answers->>'device_type',
    trim(coalesce(p_answers->>'device_other', '')), trim(p_answers->>'screener_os_version'),
    trim(p_answers->>'utest_account_screenshot_url'), true, now(), auth.uid(), now(), now()
  )
  on conflict (application_id) do update set
    full_name = excluded.full_name,
    utest_id = excluded.utest_id,
    utest_email = excluded.utest_email,
    date_of_birth = excluded.date_of_birth,
    age_range = excluded.age_range,
    country = excluded.country,
    smartphone = excluded.smartphone,
    device_confirmation = excluded.device_confirmation,
    has_valid_id = excluded.has_valid_id,
    willing_voice_recording = excluded.willing_voice_recording,
    phone_number = excluded.phone_number,
    gmail_email = excluded.gmail_email,
    gender = excluded.gender,
    gender_other = excluded.gender_other,
    fluent_languages = excluded.fluent_languages,
    language_other = excluded.language_other,
    recording_space_available = excluded.recording_space_available,
    screener_device_type = excluded.screener_device_type,
    screener_device_other = excluded.screener_device_other,
    screener_os_version = excluded.screener_os_version,
    utest_account_screenshot_url = excluded.utest_account_screenshot_url,
    screener_consent = excluded.screener_consent,
    screener_consent_at = excluded.screener_consent_at,
    admin_reconciled_by = excluded.admin_reconciled_by,
    admin_reconciled_at = excluded.admin_reconciled_at,
    updated_at = now();

  return v_application_id;
end;
$$;

alter table public.application_utest_details
  add column if not exists admin_reconciled_by uuid references public.profiles(id),
  add column if not exists admin_reconciled_at timestamptz;

comment on column public.application_utest_details.admin_reconciled_by is
  'Administrator who verified applicant-provided answers and authorization before screener queueing.';

revoke all on function public.admin_reconcile_application_screener(uuid, uuid, jsonb, boolean) from public, anon;
grant execute on function public.admin_reconcile_application_screener(uuid, uuid, jsonb, boolean) to authenticated;