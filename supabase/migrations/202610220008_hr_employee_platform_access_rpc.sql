create or replace function public.hr_update_employee_platform_access(
  p_profile_id uuid,
  p_admin_access_level text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only a Super Admin can update employee platform access.'
      using errcode = '42501';
  end if;

  if p_profile_id is null then
    raise exception 'An employee profile is required.'
      using errcode = '22023';
  end if;

  if p_admin_access_level is not null
    and p_admin_access_level not in ('project_manager', 'reviewer') then
    raise exception 'Employee platform access must be Project Manager, Reviewer, or none.'
      using errcode = '22023';
  end if;

  update public.profiles
  set admin_access_level = p_admin_access_level,
      updated_at = now()
  where id = p_profile_id
    and role <> 'admin'
  returning id into updated_profile_id;

  if updated_profile_id is null then
    raise exception 'The employee profile was not found or is an Admin account.'
      using errcode = 'P0002';
  end if;

  return updated_profile_id;
end;
$$;

revoke all on function public.hr_update_employee_platform_access(uuid, text) from public, anon;
grant execute on function public.hr_update_employee_platform_access(uuid, text) to authenticated;

notify pgrst, 'reload schema';
