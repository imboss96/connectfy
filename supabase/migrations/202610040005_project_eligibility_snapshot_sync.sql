create or replace function public.sync_project_eligibility_responses(
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
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can sync project eligibility responses';
  end if;

  if p_project_id is null then
    raise exception 'A project is required';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Eligibility response rows must be provided as an array';
  end if;

  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 10000 then
    raise exception 'Eligibility response import must contain between 1 and 10000 rows';
  end if;

  if not exists (
    select 1
    from public.project_operations_settings as settings
    where settings.project_id = p_project_id
  ) then
    raise exception 'Configure this project integration before syncing its eligibility sheet';
  end if;

  delete from public.legacy_sheet_responses
  where project_id = p_project_id;

  insert into public.legacy_sheet_responses (
    source_key,
    source_timestamp,
    consent,
    full_name,
    date_of_birth,
    gender,
    email,
    project_id,
    terms_agreed,
    utest_id,
    matched_profile_id,
    match_status,
    synced_at
  )
  select
    row_data.source_key,
    coalesce(row_data.source_timestamp, ''),
    coalesce(row_data.consent, ''),
    coalesce(row_data.full_name, ''),
    coalesce(row_data.date_of_birth, ''),
    coalesce(row_data.gender, ''),
    coalesce(row_data.email, ''),
    p_project_id,
    coalesce(row_data.terms_agreed, ''),
    coalesce(row_data.utest_id, ''),
    null,
    'unmatched',
    now()
  from jsonb_to_recordset(p_rows) as row_data(
    source_key text,
    source_timestamp text,
    consent text,
    full_name text,
    date_of_birth text,
    gender text,
    email text,
    terms_agreed text,
    utest_id text
  )
  where nullif(trim(row_data.source_key), '') is not null;

  get diagnostics imported_count = row_count;
  if imported_count = 0 then
    raise exception 'Eligibility import contained no valid participant rows';
  end if;

  return imported_count;
end;
$$;

revoke all on function public.sync_project_eligibility_responses(uuid, jsonb) from public, anon;
grant execute on function public.sync_project_eligibility_responses(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
