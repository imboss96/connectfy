create policy "admins create project invitations" on public.applications
  for insert to authenticated
  with check (
    public.is_admin()
    and status = 'approved'
    and invite_status = 'invited'
  );

drop policy if exists "profiles are visible to signed in users" on public.profiles;
create policy "profiles visible to owners admins and project clients" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.applications a
      join public.projects p on p.id = a.project_id
      where a.tester_id = profiles.id
        and p.client_id = auth.uid()
    )
  );
