create extension if not exists "uuid-ossp";

create type public.user_role as enum ('tester', 'client', 'admin');
create type public.project_status as enum ('active', 'upcoming', 'completed');
create type public.submission_kind as enum ('bug', 'task');
create type public.submission_status as enum ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'tester',
  name text not null default '',
  email text not null default '',
  avatar_url text,
  country text,
  city text,
  company text,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company text not null,
  short_description text not null default '',
  full_overview text not null default '',
  category text not null,
  project_track text,
  payment_model text,
  status public.project_status not null default 'active',
  deadline date,
  slots_total integer not null default 0 check (slots_total >= 0),
  slots_filled integer not null default 0 check (slots_filled >= 0),
  total_budget numeric(12,2) not null default 0,
  budget_disbursed numeric(12,2) not null default 0,
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  invite_status text,
  selected_devices text[] not null default '{}',
  experience_note text not null default '',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_invite_at timestamptz,
  last_invite_sent_at timestamptz,
  invite_history jsonb not null default '[]'::jsonb,
  unique(project_id, tester_id)
);

create table public.submissions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  kind public.submission_kind not null,
  title text not null,
  details text not null default '',
  status public.submission_status not null default 'under_review',
  bounty_earned numeric(12,2) not null default 0,
  client_feedback text,
  client_rating integer check (client_rating between 1 and 5),
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.attachments (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  mime_type text not null,
  bytes bigint not null default 0,
  secure_url text not null,
  public_id text not null,
  resource_type text not null default 'auto',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_role public.user_role,
  title text not null,
  message text not null,
  type text not null,
  read boolean not null default false,
  project_id uuid references public.projects(id) on delete set null,
  submission_id uuid references public.submissions(id) on delete set null,
  amount numeric(12,2),
  created_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  tester_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  description text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'pending',
  method text,
  reference_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.payout_requests (
  id uuid primary key default uuid_generate_v4(),
  tester_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  destination_account text not null,
  status text not null default 'pending',
  transaction_ref text not null unique,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.applications enable row level security;
alter table public.submissions enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.payout_requests enable row level security;

create policy "profiles are visible to signed in users" on public.profiles for select to authenticated using (true);
create policy "users update their profile" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "projects are visible to signed in users" on public.projects for select to authenticated using (true);
create policy "clients and admins create projects" on public.projects for insert to authenticated with check (client_id = auth.uid() or public.is_admin());
create policy "owners and admins update projects" on public.projects for update to authenticated using (client_id = auth.uid() or public.is_admin()) with check (client_id = auth.uid() or public.is_admin());
create policy "owners and admins delete projects" on public.projects for delete to authenticated using (client_id = auth.uid() or public.is_admin());
create policy "applications visible to participants" on public.applications for select to authenticated using (tester_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()) or public.is_admin());
create policy "testers apply" on public.applications for insert to authenticated with check (tester_id = auth.uid());
create policy "participants update applications" on public.applications for update to authenticated using (tester_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()) or public.is_admin());
create policy "submissions visible to participants" on public.submissions for select to authenticated using (tester_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()) or public.is_admin());
create policy "testers create submissions" on public.submissions for insert to authenticated with check (tester_id = auth.uid());
create policy "clients and admins review submissions" on public.submissions for update to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()) or public.is_admin());
create policy "attachments visible to participants" on public.attachments for select to authenticated using (owner_id = auth.uid() or exists (select 1 from public.submissions s join public.projects p on p.id = s.project_id where s.id = submission_id and p.client_id = auth.uid()) or public.is_admin());
create policy "users add attachments" on public.attachments for insert to authenticated with check (owner_id = auth.uid());
create policy "users see their notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "users update their notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "testers see their wallet" on public.wallet_transactions for select to authenticated using (tester_id = auth.uid() or public.is_admin());
create policy "testers see their payouts" on public.payout_requests for select to authenticated using (tester_id = auth.uid() or public.is_admin());
create policy "testers request payouts" on public.payout_requests for insert to authenticated with check (tester_id = auth.uid());
