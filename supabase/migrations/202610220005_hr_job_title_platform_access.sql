alter table public.profiles
  drop constraint if exists profiles_admin_access_level_check;

alter table public.profiles
  add constraint profiles_admin_access_level_check
  check (
    (
      role = 'admin'
      and admin_access_level in ('super_admin', 'project_manager', 'reviewer')
    )
    or (
      role <> 'admin'
      and (
        admin_access_level is null
        or admin_access_level in ('project_manager', 'reviewer')
      )
    )
  );

create or replace function public.can_manage_projects()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        (role = 'admin' and admin_access_level = 'super_admin')
        or admin_access_level = 'project_manager'
      )
  );
$$;

create or replace function public.can_review_submissions()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        (role = 'admin' and admin_access_level = 'super_admin')
        or admin_access_level in ('project_manager', 'reviewer')
      )
  );
$$;

create or replace function public.protect_profile_platform_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    old.role is distinct from new.role
    or old.admin_access_level is distinct from new.admin_access_level
  ) and not coalesce(public.is_admin(), false) then
    raise exception 'Only a Super Admin can change platform roles or access levels.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_platform_access on public.profiles;

update public.profiles as profile
set admin_access_level = case
  when lower(trim(employee.job_title)) = 'project manager' then 'project_manager'
  when lower(trim(employee.job_title)) in ('reviewer', 'project reviewer') then 'reviewer'
  else null
end
from public.hr_employees as employee
where employee.profile_id = profile.id
  and profile.role <> 'admin';

create trigger protect_profile_platform_access
  before update of role, admin_access_level on public.profiles
  for each row
  execute function public.protect_profile_platform_access();
