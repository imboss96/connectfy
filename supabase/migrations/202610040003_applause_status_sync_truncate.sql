create or replace function public.sync_applause_project_status(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  imported_count integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can sync Applause project statuses';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Applause status rows must be provided as an array';
  end if;

  if jsonb_array_length(p_rows) > 10000 then
    raise exception 'Applause status import exceeds the 10000 row limit';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'Applause status import cannot be empty';
  end if;

  truncate table public.applause_project_status;

  insert into public.applause_project_status (
    source_key,
    status,
    tester_id,
    tester_email,
    google_email,
    consent_name,
    id_scan_status,
    utest_id,
    issues,
    synced_at
  )
  select
    row_data.source_key,
    coalesce(row_data.status, ''),
    coalesce(row_data.tester_id, ''),
    coalesce(row_data.tester_email, ''),
    coalesce(row_data.google_email, ''),
    coalesce(row_data.consent_name, ''),
    coalesce(row_data.id_scan_status, ''),
    coalesce(row_data.utest_id, ''),
    coalesce(row_data.issues, ''),
    now()
  from jsonb_to_recordset(p_rows) as row_data(
    source_key text,
    status text,
    tester_id text,
    tester_email text,
    google_email text,
    consent_name text,
    id_scan_status text,
    utest_id text,
    issues text
  )
  where nullif(trim(row_data.source_key), '') is not null;

  get diagnostics imported_count = row_count;
  return imported_count;
end;
$$;

notify pgrst, 'reload schema';
