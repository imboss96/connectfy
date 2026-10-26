create table public.ambassador_reward_payable_accruals (
  id uuid primary key default uuid_generate_v4(),
  reward_id uuid references public.ambassador_rewards(id) on delete set null,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  reference_id text not null unique,
  ambassador_id uuid references public.profiles(id) on delete set null,
  ambassador_name text not null,
  referred_tester_id uuid references public.profiles(id) on delete set null,
  referred_tester_name text not null,
  submission_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  project_title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  accrued_at timestamptz not null
);

create unique index ambassador_reward_payable_reward_idx
  on public.ambassador_reward_payable_accruals (reward_id)
  where reward_id is not null;

create unique index ambassador_reward_payable_wallet_transaction_idx
  on public.ambassador_reward_payable_accruals (wallet_transaction_id)
  where wallet_transaction_id is not null;

create index ambassador_reward_payable_accrued_at_idx
  on public.ambassador_reward_payable_accruals (accrued_at desc);

alter table public.ambassador_reward_payable_accruals enable row level security;

create policy "super admins view ambassador reward payables"
  on public.ambassador_reward_payable_accruals
  for select to authenticated
  using (public.can_view_submission_payables());

revoke all on public.ambassador_reward_payable_accruals from anon, authenticated;
grant select on public.ambassador_reward_payable_accruals to authenticated;

create or replace function public.record_ambassador_reward_payable_accrual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward public.ambassador_rewards%rowtype;
  ambassador_name_snapshot text;
  referred_name_snapshot text;
  project_name_snapshot text;
begin
  if new.type <> 'credit_referral'
    or new.status <> 'completed'
    or new.amount <= 0 then
    return new;
  end if;

  select *
    into reward
    from public.ambassador_rewards
    where 'AMB-' || upper(replace(id::text, '-', '')) = new.reference_id
      and ambassador_id = new.tester_id;

  if not found then
    raise exception 'Unable to record referral payable: matching ambassador reward not found';
  end if;

  select coalesce(nullif(trim(name), ''), id::text)
    into ambassador_name_snapshot
    from public.profiles
    where id = reward.ambassador_id;

  select coalesce(nullif(trim(name), ''), id::text)
    into referred_name_snapshot
    from public.profiles
    where id = reward.referred_tester_id;

  select coalesce(title, 'Project')
    into project_name_snapshot
    from public.projects
    where id = reward.project_id;

  insert into public.ambassador_reward_payable_accruals (
    reward_id,
    wallet_transaction_id,
    reference_id,
    ambassador_id,
    ambassador_name,
    referred_tester_id,
    referred_tester_name,
    submission_id,
    project_id,
    project_title,
    amount,
    currency,
    accrued_at
  )
  values (
    reward.id,
    new.id,
    new.reference_id,
    reward.ambassador_id,
    coalesce(ambassador_name_snapshot, reward.ambassador_id::text),
    reward.referred_tester_id,
    coalesce(referred_name_snapshot, reward.referred_tester_id::text),
    reward.submission_id,
    reward.project_id,
    coalesce(project_name_snapshot, 'Project'),
    round(new.amount, 2),
    'USD',
    new.created_at
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.record_ambassador_reward_payable_accrual() from public, anon, authenticated;

create trigger record_ambassador_reward_payable_accrual
  after insert or update of type, status, amount on public.wallet_transactions
  for each row
  execute function public.record_ambassador_reward_payable_accrual();

insert into public.ambassador_reward_payable_accruals (
  reward_id,
  wallet_transaction_id,
  reference_id,
  ambassador_id,
  ambassador_name,
  referred_tester_id,
  referred_tester_name,
  submission_id,
  project_id,
  project_title,
  amount,
  currency,
  accrued_at
)
select
  reward.id,
  wallet.id,
  wallet.reference_id,
  reward.ambassador_id,
  coalesce(nullif(trim(ambassador.name), ''), reward.ambassador_id::text),
  reward.referred_tester_id,
  coalesce(nullif(trim(referred.name), ''), reward.referred_tester_id::text),
  reward.submission_id,
  reward.project_id,
  coalesce(project.title, 'Project'),
  round(wallet.amount, 2),
  'USD',
  wallet.created_at
from public.wallet_transactions as wallet
join public.ambassador_rewards as reward
  on wallet.reference_id = 'AMB-' || upper(replace(reward.id::text, '-', ''))
 and wallet.tester_id = reward.ambassador_id
left join public.profiles as ambassador on ambassador.id = reward.ambassador_id
left join public.profiles as referred on referred.id = reward.referred_tester_id
left join public.projects as project on project.id = reward.project_id
where wallet.type = 'credit_referral'
  and wallet.status = 'completed'
  and wallet.amount > 0
on conflict do nothing;

notify pgrst, 'reload schema';
