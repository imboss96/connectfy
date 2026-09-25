create table public.application_drafts (
  project_id uuid not null references public.projects(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, tester_id)
);

alter table public.application_drafts enable row level security;

create policy "testers manage their application drafts" on public.application_drafts
  for all to authenticated
  using (tester_id = auth.uid())
  with check (tester_id = auth.uid());
