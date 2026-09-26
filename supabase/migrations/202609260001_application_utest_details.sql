create table public.application_utest_details (
  application_id uuid primary key references public.applications(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null default '',
  utest_id text not null default '',
  utest_email text not null default '',
  date_of_birth date,
  age_range text not null default '',
  country text not null default '',
  smartphone text not null default '',
  device_confirmation text not null default '',
  has_valid_id boolean not null default false,
  willing_voice_recording boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_utest_details enable row level security;

create policy "application uTest details visible to participants" on public.application_utest_details
  for select to authenticated
  using (
    tester_id = auth.uid()
    or exists (
      select 1
      from public.applications a
      join public.projects p on p.id = a.project_id
      where a.id = application_id and p.client_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "testers add their application uTest details" on public.application_utest_details
  for insert to authenticated
  with check (
    tester_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.tester_id = auth.uid()
    )
  );

create policy "testers update their application uTest details" on public.application_utest_details
  for update to authenticated
  using (tester_id = auth.uid() or public.is_admin())
  with check (tester_id = auth.uid() or public.is_admin());