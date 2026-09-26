drop policy if exists "clients and admins create projects" on public.projects;
create policy "clients and admins create projects" on public.projects
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  );

drop policy if exists "owners and admins update projects" on public.projects;
create policy "clients and admins update projects" on public.projects
  for update to authenticated
  using (
    public.is_admin()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  )
  with check (
    public.is_admin()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  );

drop policy if exists "owners and admins delete projects" on public.projects;
create policy "clients and admins delete projects" on public.projects
  for delete to authenticated
  using (
    public.is_admin()
    or (
      client_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'client'
      )
    )
  );
