create table public.project_step_progress (
  project_id uuid not null references public.projects(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  statuses jsonb not null default '{"slack":"pending","consent":"pending","languageSettings":"pending","recordings":"pending"}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, tester_id),
  constraint project_step_progress_statuses_object check (
    jsonb_typeof(statuses) = 'object'
    and statuses ?& array['slack', 'consent', 'languageSettings', 'recordings']
    and statuses->>'slack' in ('pending', 'done', 'failed')
    and statuses->>'consent' in ('pending', 'done', 'failed')
    and statuses->>'languageSettings' in ('pending', 'done', 'failed')
    and statuses->>'recordings' in ('pending', 'done', 'failed')
  ),
  constraint project_step_progress_evidence_array check (jsonb_typeof(evidence) = 'array')
);

alter table public.project_step_progress enable row level security;

create policy "testers view their project step progress"
  on public.project_step_progress for select to authenticated
  using (
    tester_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.projects p
      where p.id = project_step_progress.project_id and p.client_id = auth.uid()
    )
  );

create policy "testers create their project step progress"
  on public.project_step_progress for insert to authenticated
  with check (
    tester_id = auth.uid()
    and exists (
      select 1
      from public.applications a
      where a.project_id = project_step_progress.project_id and a.tester_id = auth.uid()
    )
  );

create policy "testers update their project step progress"
  on public.project_step_progress for update to authenticated
  using (tester_id = auth.uid())
  with check (
    tester_id = auth.uid()
    and exists (
      select 1
      from public.applications a
      where a.project_id = project_step_progress.project_id and a.tester_id = auth.uid()
    )
  );
