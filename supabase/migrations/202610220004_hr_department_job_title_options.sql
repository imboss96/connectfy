create table if not exists public.hr_option_catalog (
  id uuid primary key default uuid_generate_v4(),
  category text not null check (category in ('department', 'job_title')),
  label text not null check (label = trim(label) and label <> ''),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hr_option_catalog_category_label_idx
  on public.hr_option_catalog (category, lower(label));

create index if not exists hr_option_catalog_active_order_idx
  on public.hr_option_catalog (category, is_active, sort_order, label);

alter table public.hr_option_catalog enable row level security;

drop policy if exists hr_option_catalog_manage_super_admin on public.hr_option_catalog;
create policy hr_option_catalog_manage_super_admin on public.hr_option_catalog
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.hr_option_catalog to authenticated;

insert into public.hr_option_catalog (category, label, sort_order)
values
  ('department', 'QA/Testing', 10),
  ('department', 'Project Management', 20),
  ('department', 'HR', 30),
  ('department', 'Finance', 40),
  ('department', 'Operations', 50),
  ('department', 'Internal', 60),
  ('job_title', 'QA Tester', 10),
  ('job_title', 'Reviewer', 20),
  ('job_title', 'Team Leader', 30),
  ('job_title', 'Project Manager', 40),
  ('job_title', 'Project Reviewer', 50),
  ('job_title', 'Moderator', 60),
  ('job_title', 'HR Manager', 70)
on conflict do nothing;
