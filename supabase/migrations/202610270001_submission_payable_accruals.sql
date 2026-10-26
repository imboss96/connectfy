create table public.submission_payable_accruals (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null unique,
  project_id uuid not null,
  tester_id uuid not null,
  tester_name text not null,
  submission_title text not null,
  project_title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  accrued_at timestamptz not null default now()
);

create index submission_payable_accruals_accrued_at_idx
  on public.submission_payable_accruals (accrued_at desc);

alter table public.submission_payable_accruals enable row level security;

create or replace function public.can_view_submission_payables()
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

revoke all on function public.can_view_submission_payables() from public, anon;
grant execute on function public.can_view_submission_payables() to authenticated;

create policy "super admins view submission payable accruals"
  on public.submission_payable_accruals
  for select to authenticated
  using (public.can_view_submission_payables());

revoke all on public.submission_payable_accruals from anon, authenticated;
grant select on public.submission_payable_accruals to authenticated;

create or replace function public.record_submission_payable_accrual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  recipient_name text;
begin
  if new.status <> 'approved' or coalesce(new.bounty_earned, 0) <= 0 then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' then
    return new;
  end if;

  select title
    into project_name
    from public.projects
    where id = new.project_id;

  if not found then
    raise exception 'Unable to record submission payable: project not found';
  end if;

  select coalesce(nullif(trim(name), ''), id::text)
    into recipient_name
    from public.profiles
    where id = new.tester_id;

  if not found then
    raise exception 'Unable to record submission payable: tester profile not found';
  end if;

  insert into public.submission_payable_accruals (
    submission_id,
    project_id,
    tester_id,
    tester_name,
    submission_title,
    project_title,
    amount,
    currency,
    accrued_at
  )
  values (
    new.id,
    new.project_id,
    new.tester_id,
    recipient_name,
    new.title,
    project_name,
    round(new.bounty_earned, 2),
    'USD',
    coalesce(new.reviewed_at, now())
  )
  on conflict (submission_id) do nothing;

  return new;
end;
$$;

revoke all on function public.record_submission_payable_accrual() from public, anon, authenticated;

create trigger record_submission_payable_accrual
  after insert or update of status, bounty_earned on public.submissions
  for each row
  execute function public.record_submission_payable_accrual();

insert into public.submission_payable_accruals (
  submission_id,
  project_id,
  tester_id,
  tester_name,
  submission_title,
  project_title,
  amount,
  currency,
  accrued_at
)
select
  submission.id,
  submission.project_id,
  submission.tester_id,
  coalesce(nullif(trim(profile.name), ''), profile.id::text),
  submission.title,
  project.title,
  round(submission.bounty_earned, 2),
  'USD',
  coalesce(submission.reviewed_at, submission.submitted_at, now())
from public.submissions as submission
join public.projects as project on project.id = submission.project_id
join public.profiles as profile on profile.id = submission.tester_id
where submission.status = 'approved'
  and submission.bounty_earned > 0
on conflict (submission_id) do nothing;

notify pgrst, 'reload schema';
