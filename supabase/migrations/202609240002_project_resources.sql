create table if not exists public.project_resources (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  url text not null check (url ~* '^https?://'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_resources_project_id_idx on public.project_resources(project_id, sort_order);

alter table public.project_resources enable row level security;

create policy "project resources are visible to signed in users"
  on public.project_resources for select to authenticated using (true);

create policy "project owners and admins create resources"
  on public.project_resources for insert to authenticated
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.is_admin()
  );

create policy "project owners and admins update resources"
  on public.project_resources for update to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.is_admin()
  );

create policy "project owners and admins delete resources"
  on public.project_resources for delete to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.is_admin()
  );
