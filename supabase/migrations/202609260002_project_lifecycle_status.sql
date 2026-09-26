alter type public.project_status add value if not exists 'paused';
alter type public.project_status add value if not exists 'closed';
alter type public.project_status add value if not exists 'ended';
alter type public.project_status add value if not exists 'hidden';

alter table public.projects
  add column if not exists starts_at date;