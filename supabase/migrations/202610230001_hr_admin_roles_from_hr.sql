alter table public.hr_employees
  add column if not exists previous_platform_role text
  check (previous_platform_role in ('tester', 'client'));

alter table public.hr_employees
  add column if not exists hr_platform_access_level text
  check (hr_platform_access_level in ('super_admin', 'project_manager', 'reviewer'));

insert into public.hr_option_catalog (category, label, sort_order)
values ('job_title', 'Super Admin', 80)
on conflict do nothing;

drop trigger if exists protect_profile_platform_access on public.profiles;

update public.hr_employees employee
set previous_platform_role = profile.role,
    hr_platform_access_level = case
      when lower(trim(employee.job_title)) = 'super admin' then 'super_admin'
      when lower(trim(employee.job_title)) = 'project manager' then 'project_manager'
      when lower(trim(employee.job_title)) in ('reviewer', 'project reviewer') then 'reviewer'
      else profile.admin_access_level
    end
from public.profiles profile
where profile.id = employee.profile_id
  and profile.role in ('tester', 'client')
  and (
    lower(trim(employee.job_title)) in ('super admin', 'project manager', 'reviewer', 'project reviewer')
    or profile.admin_access_level in ('project_manager', 'reviewer')
  );

update public.profiles profile
set role = 'admin',
    admin_access_level = case
      when lower(trim(employee.job_title)) = 'super admin' then 'super_admin'
      when lower(trim(employee.job_title)) = 'project manager' then 'project_manager'
      when lower(trim(employee.job_title)) in ('reviewer', 'project reviewer') then 'reviewer'
      else profile.admin_access_level
    end,
    updated_at = now()
from public.hr_employees employee
where employee.profile_id = profile.id
  and employee.previous_platform_role is not null;

create trigger protect_profile_platform_access
  before update of role, admin_access_level on public.profiles
  for each row
  execute function public.protect_profile_platform_access();

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
  employee public.hr_employees%rowtype;
  current_role text;
  current_access_level text;
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
    and p_admin_access_level not in ('super_admin', 'project_manager', 'reviewer') then
    raise exception 'Employee platform access must be Super Admin, Project Manager, Reviewer, or none.'
      using errcode = '22023';
  end if;

  select * into employee
  from public.hr_employees
  where profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'The profile is not linked to an employee record.'
      using errcode = 'P0002';
  end if;

  select role, admin_access_level
  into current_role, current_access_level
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'The employee profile could not be found.'
      using errcode = 'P0002';
  end if;

  if employee.previous_platform_role is null and current_role = 'admin' then
    raise exception 'Existing Admin accounts keep their access level from Admin Management.'
      using errcode = 'P0001';
  end if;

  if employee.previous_platform_role is not null
    and (
      current_role <> 'admin'
      or current_access_level is distinct from employee.hr_platform_access_level
    ) then
    raise exception 'This account access was changed outside HR. Review it in Admin Management before changing the HR job title.'
      using errcode = 'P0001';
  end if;

  if p_admin_access_level is null then
    if employee.previous_platform_role is not null then
      update public.profiles
      set role = employee.previous_platform_role,
          admin_access_level = null,
          updated_at = now()
      where id = p_profile_id;

      update public.hr_employees
      set previous_platform_role = null,
          hr_platform_access_level = null,
          updated_by = auth.uid(),
          updated_at = now()
      where id = employee.id;
    elsif current_role <> 'admin' then
      update public.profiles
      set admin_access_level = null,
          updated_at = now()
      where id = p_profile_id;
    end if;
  else
    if employee.previous_platform_role is null then
      if current_role not in ('tester', 'client') then
        raise exception 'Only Tester or Client employee accounts can be assigned platform access through HR.'
          using errcode = 'P0001';
      end if;

      update public.hr_employees
      set previous_platform_role = current_role,
          hr_platform_access_level = p_admin_access_level,
          updated_by = auth.uid(),
          updated_at = now()
      where id = employee.id;
    end if;

    update public.profiles
    set role = 'admin',
        admin_access_level = p_admin_access_level,
        updated_at = now()
    where id = p_profile_id;

    if employee.previous_platform_role is not null then
      update public.hr_employees
      set hr_platform_access_level = p_admin_access_level,
          updated_by = auth.uid(),
          updated_at = now()
      where id = employee.id;
    end if;
  end if;

  return p_profile_id;
end;
$$;

revoke all on function public.hr_update_employee_platform_access(uuid, text) from public, anon;
grant execute on function public.hr_update_employee_platform_access(uuid, text) to authenticated;

notify pgrst, 'reload schema';
