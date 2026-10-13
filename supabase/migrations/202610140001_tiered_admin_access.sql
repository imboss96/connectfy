alter table public.profiles
  add column if not exists admin_access_level text;

update public.profiles
set admin_access_level = 'super_admin'
where role = 'admin'
  and admin_access_level is null;

update public.profiles
set admin_access_level = 'super_admin'
where role = 'admin'
  and admin_access_level not in ('super_admin', 'project_manager', 'reviewer');

update public.profiles
set admin_access_level = null
where role <> 'admin'
  and admin_access_level is not null;

alter table public.profiles
  drop constraint if exists profiles_admin_access_level_check;

alter table public.profiles
  add constraint profiles_admin_access_level_check
  check (
    (role = 'admin' and admin_access_level is not null and admin_access_level in ('super_admin', 'project_manager', 'reviewer'))
    or (role <> 'admin' and admin_access_level is null)
  );

create or replace function public.is_admin()
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
      and role = 'admin'
      and admin_access_level = 'super_admin'
  );
$$;

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
      and role = 'admin'
      and admin_access_level in ('super_admin', 'project_manager')
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
      and role = 'admin'
      and admin_access_level in ('super_admin', 'project_manager', 'reviewer')
  );
$$;

drop policy if exists "clients and admins create projects" on public.projects;
create policy "clients and admins create projects" on public.projects
  for insert to authenticated
  with check (
    public.can_manage_projects()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  );

drop policy if exists "clients and admins update projects" on public.projects;
create policy "clients and admins update projects" on public.projects
  for update to authenticated
  using (
    public.can_manage_projects()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  )
  with check (
    public.can_manage_projects()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  );

drop policy if exists "clients and admins delete projects" on public.projects;
create policy "clients and admins delete projects" on public.projects
  for delete to authenticated
  using (
    public.can_manage_projects()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  );

drop policy if exists "applications visible to participants" on public.applications;
create policy "applications visible to participants" on public.applications
  for select to authenticated
  using (
    tester_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.client_id = auth.uid()
    )
    or public.can_manage_projects()
  );

drop policy if exists "admins create project invitations" on public.applications;
create policy "admins create project invitations" on public.applications
  for insert to authenticated
  with check (
    public.can_manage_projects()
    and status = 'approved'
    and invite_status = 'invited'
  );

drop policy if exists "participants update applications" on public.applications;
create policy "participants update applications" on public.applications
  for update to authenticated
  using (
    tester_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.client_id = auth.uid()
    )
    or public.can_manage_projects()
  )
  with check (
    tester_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.client_id = auth.uid()
    )
    or public.can_manage_projects()
  );

drop policy if exists "submissions visible to participants" on public.submissions;
create policy "submissions visible to participants" on public.submissions
  for select to authenticated
  using (
    tester_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.client_id = auth.uid()
    )
    or public.can_review_submissions()
  );

drop policy if exists "clients and admins review submissions" on public.submissions;
create policy "clients and admins review submissions" on public.submissions
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.client_id = auth.uid()
    )
    or public.can_review_submissions()
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.client_id = auth.uid()
    )
    or public.can_review_submissions()
  );

drop policy if exists "attachments visible to participants" on public.attachments;
create policy "attachments visible to participants" on public.attachments
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.submissions s
      join public.projects p on p.id = s.project_id
      where s.id = submission_id
        and (p.client_id = auth.uid() or public.can_review_submissions())
    )
    or public.is_admin()
  );

drop policy if exists "profiles visible to owners admins and project clients" on public.profiles;
create policy "profiles visible to owners admins and project clients" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (public.can_manage_projects() and role = 'tester')
    or exists (
      select 1
      from public.applications a
      join public.projects p on p.id = a.project_id
      where a.tester_id = profiles.id and p.client_id = auth.uid()
    )
    or exists (
      select 1
      from public.submissions s
      where s.tester_id = profiles.id and public.can_review_submissions()
    )
  );

drop policy if exists "application uTest details visible to participants" on public.application_utest_details;
create policy "application uTest details visible to participants" on public.application_utest_details
  for select to authenticated
  using (
    tester_id = auth.uid()
    or exists (
      select 1
      from public.applications a
      join public.projects p on p.id = a.project_id
      where a.id = application_id
        and (p.client_id = auth.uid() or public.can_manage_projects())
    )
    or public.is_admin()
  );

drop policy if exists "testers update their application uTest details" on public.application_utest_details;
create policy "testers update their application uTest details" on public.application_utest_details
  for update to authenticated
  using (tester_id = auth.uid() or public.can_manage_projects())
  with check (tester_id = auth.uid() or public.can_manage_projects());

drop policy if exists "project owners and admins create resources" on public.project_resources;
create policy "project owners and admins create resources" on public.project_resources
  for insert to authenticated
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.can_manage_projects()
  );

drop policy if exists "project owners and admins update resources" on public.project_resources;
create policy "project owners and admins update resources" on public.project_resources
  for update to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.can_manage_projects()
  )
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.can_manage_projects()
  );

drop policy if exists "project owners and admins delete resources" on public.project_resources;
create policy "project owners and admins delete resources" on public.project_resources
  for delete to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.can_manage_projects()
  );

create or replace function public.guard_project_application_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
    and not public.can_manage_projects()
    and coalesce(auth.role(), '') <> 'service_role'
    and not exists (
      select 1
      from public.projects as project
      where project.id = new.project_id and project.client_id = auth.uid()
    ) then
    raise exception 'Only the project owner or a project manager can approve an application';
  end if;
  return new;
end;
$$;

create or replace function public.invite_user_as_admin(p_email text, p_access_level text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_id uuid;
  auth_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only super admins can invite administrators';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'Email is required';
  end if;
  if p_access_level is null or p_access_level not in ('super_admin', 'project_manager', 'reviewer') then
    raise exception 'A valid administrator access level is required';
  end if;

  select id into matched_id
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if matched_id is null then
    select id into auth_user_id
    from auth.users
    where lower(email) = lower(trim(p_email))
    limit 1;
    if auth_user_id is null then
      raise exception 'No user profile found for that email. Ask the user to sign up first.';
    end if;

    insert into public.profiles (id, email, name, avatar_url, role, admin_access_level, profile_data)
    values (auth_user_id, lower(trim(p_email)), '', null, 'admin', p_access_level, '{}'::jsonb)
    on conflict (id) do update
      set email = excluded.email,
          role = 'admin',
          admin_access_level = excluded.admin_access_level,
          updated_at = now();
    return auth_user_id;
  end if;

  update public.profiles
  set role = 'admin',
      admin_access_level = p_access_level,
      updated_at = now()
  where id = matched_id;

  return matched_id;
end;
$$;

create or replace function public.invite_user_as_admin(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.invite_user_as_admin(p_email, 'reviewer');
$$;

grant execute on function public.invite_user_as_admin(text, text) to authenticated;
grant execute on function public.invite_user_as_admin(text) to authenticated;

create or replace function public.dismiss_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_super_admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only super admins can remove administrator access';
  end if;
  if p_user_id is null then
    raise exception 'A user ID is required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own administrator access';
  end if;

  perform profile.id
  from public.profiles as profile
  where profile.role = 'admin'
  order by profile.id
  for update;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'admin'
  ) then
    raise exception 'The selected user is not an administrator';
  end if;

  select count(*) into remaining_super_admin_count
  from public.profiles
  where role = 'admin'
    and admin_access_level = 'super_admin'
    and id <> p_user_id;

  if remaining_super_admin_count = 0
    and exists (
      select 1 from public.profiles
      where id = p_user_id and admin_access_level = 'super_admin'
    ) then
    raise exception 'The last super admin cannot be removed';
  end if;

  update public.profiles
  set role = 'tester',
      admin_access_level = null,
      updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.dismiss_admin(uuid) to authenticated;

notify pgrst, 'reload schema';

--This is for the all users and admin users to be able to see the new admin_access_level column in the profiles table