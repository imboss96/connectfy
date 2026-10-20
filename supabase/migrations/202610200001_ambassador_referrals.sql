alter table public.profiles
  add column if not exists referral_code text;

update public.profiles
set referral_code = upper(replace(uuid_generate_v4()::text, '-', ''))
where referral_code is null;

alter table public.profiles
  alter column referral_code set default upper(replace(uuid_generate_v4()::text, '-', '')),
  alter column referral_code set not null;

create unique index if not exists profiles_referral_code_unique
  on public.profiles (referral_code);

create table if not exists public.ambassador_referrals (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references public.profiles(id) on delete cascade,
  referred_tester_id uuid not null references public.profiles(id) on delete cascade,
  referred_tester_name text not null default '',
  referral_code text not null,
  created_at timestamptz not null default now(),
  constraint ambassador_referrals_no_self_referral check (ambassador_id <> referred_tester_id),
  constraint ambassador_referrals_referred_tester_unique unique (referred_tester_id)
);

create index if not exists ambassador_referrals_ambassador_created_idx
  on public.ambassador_referrals (ambassador_id, created_at desc);

alter table public.ambassador_referrals enable row level security;

drop policy if exists "ambassadors see their referrals" on public.ambassador_referrals;
create policy "ambassadors see their referrals"
  on public.ambassador_referrals
  for select
  to authenticated
  using (ambassador_id = auth.uid() or public.is_admin());

create table if not exists public.ambassador_rewards (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references public.profiles(id) on delete cascade,
  referred_tester_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid not null unique,
  project_id uuid references public.projects(id) on delete set null,
  amount numeric(12,2) not null default 5.00 check (amount = 5.00),
  created_at timestamptz not null default now()
);

create index if not exists ambassador_rewards_ambassador_created_idx
  on public.ambassador_rewards (ambassador_id, created_at desc);

alter table public.ambassador_rewards enable row level security;

drop policy if exists "ambassadors see their rewards" on public.ambassador_rewards;
create policy "ambassadors see their rewards"
  on public.ambassador_rewards
  for select
  to authenticated
  using (ambassador_id = auth.uid() or public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referral_code text;
  v_referred_tester_name text;
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  v_referral_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
  if v_referral_code <> '' then
    select id, name
      into v_referrer_id, v_referred_tester_name
      from public.profiles
      where referral_code = v_referral_code
        and role = 'tester'
        and id <> new.id;

    if v_referrer_id is not null then
      insert into public.ambassador_referrals (
        ambassador_id,
        referred_tester_id,
        referred_tester_name,
        referral_code
      )
      values (v_referrer_id, new.id, coalesce(v_referred_tester_name, ''), v_referral_code)
      on conflict (referred_tester_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_referral_code_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.referral_code is distinct from old.referral_code
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Referral codes cannot be changed.';
  end if;

  if new.referral_code is null or trim(new.referral_code) = '' then
    new.referral_code := upper(replace(uuid_generate_v4()::text, '-', ''));
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_referral_code_before_insert on public.profiles;
create trigger profiles_protect_referral_code_before_insert
  before insert on public.profiles
  for each row
  execute function public.prevent_referral_code_change();

drop trigger if exists profiles_protect_referral_code_before_update on public.profiles;
create trigger profiles_protect_referral_code_before_update
  before update of referral_code on public.profiles
  for each row
  execute function public.prevent_referral_code_change();

create or replace function public.credit_ambassador_for_approved_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ambassador_id uuid;
  v_reward_id uuid;
  v_project_title text;
begin
  if new.status <> 'approved'
    or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;

  select ambassador_id
    into v_ambassador_id
    from public.ambassador_referrals
    where referred_tester_id = new.tester_id;

  if v_ambassador_id is null then
    return new;
  end if;

  insert into public.ambassador_rewards (
    ambassador_id,
    referred_tester_id,
    submission_id,
    project_id
  )
  values (v_ambassador_id, new.tester_id, new.id, new.project_id)
  on conflict (submission_id) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return new;
  end if;

  select title
    into v_project_title
    from public.projects
    where id = new.project_id;

  insert into public.wallet_transactions (
    tester_id,
    type,
    amount,
    description,
    project_id,
    status,
    reference_id
  )
  values (
    v_ambassador_id,
    'credit_referral',
    5.00,
    'Ambassador reward: approved work by your referral' ||
      case when v_project_title is not null then ' for ' || v_project_title else '' end,
    new.project_id,
    'completed',
    'AMB-' || upper(replace(v_reward_id::text, '-', ''))
  );

  insert into public.notifications (
    user_id,
    target_role,
    title,
    message,
    type,
    project_id,
    amount
  )
  values (
    v_ambassador_id,
    'tester',
    'Ambassador reward credited: +$5.00',
    'A tester you referred had work approved. $5.00 has been credited to your wallet.',
    'earning',
    new.project_id,
    5.00
  );

  return new;
end;
$$;

drop trigger if exists credit_ambassador_after_submission_insert on public.submissions;
create trigger credit_ambassador_after_submission_insert
  after insert on public.submissions
  for each row
  execute function public.credit_ambassador_for_approved_submission();

drop trigger if exists credit_ambassador_after_submission_status_update on public.submissions;
create trigger credit_ambassador_after_submission_status_update
  after update of status on public.submissions
  for each row
  execute function public.credit_ambassador_for_approved_submission();

create or replace function public.create_payout_request(
  p_tester_id uuid,
  p_amount numeric,
  p_method text,
  p_destination_account text,
  p_transaction_ref text,
  p_exchange_rate numeric default null,
  p_kes_amount bigint default null,
  p_exchange_rate_source text default null,
  p_exchange_rate_at timestamptz default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  available_usd numeric(12,2);
  tester_role text;
  created_request public.payout_requests;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Payout requests must be created by the payment backend';
  end if;

  if p_tester_id is null or p_amount is null or p_amount < 10 or p_amount > 100000 then
    raise exception 'Payout amount must be between USD 10.00 and USD 100,000.00';
  end if;

  if p_method is null or p_method not in ('PayPal', 'Safaricom M-Pesa') then
    raise exception 'Only PayPal and Safaricom M-Pesa payouts are supported';
  end if;

  if coalesce(trim(p_destination_account), '') = '' then
    raise exception 'A payout destination is required';
  end if;

  if p_method = 'PayPal'
    and trim(p_destination_account) !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$' then
    raise exception 'Enter a valid PayPal email address';
  end if;

  if p_method = 'Safaricom M-Pesa'
    and (p_exchange_rate is null or p_exchange_rate <= 0 or p_kes_amount is null or p_kes_amount < 1) then
    raise exception 'A valid USD to KES quote is required for M-Pesa payouts';
  end if;

  select role::text into tester_role
  from public.profiles
  where id = p_tester_id
  for update;

  if not found then raise exception 'Tester profile not found'; end if;
  if tester_role <> 'tester' then raise exception 'Only tester accounts can request tester payouts'; end if;

  select
    coalesce((
      select sum(submission.bounty_earned)
      from public.submissions as submission
      where submission.tester_id = p_tester_id
        and submission.status = 'approved'
    ), 0)
    + coalesce((
      select sum(schedule.amount)
      from public.project_payroll_schedule as schedule
      where schedule.profile_id = p_tester_id
        and schedule.status = 'scheduled'
    ), 0)
    + coalesce((
      select sum(transaction.amount)
      from public.wallet_transactions as wallet_credit
      where wallet_credit.tester_id = p_tester_id
        and wallet_credit.type = 'credit_referral'
        and wallet_credit.status = 'completed'
    ), 0)
    - coalesce((
      select sum(request.amount)
      from public.payout_requests as request
      where request.tester_id = p_tester_id
        and request.status <> 'failed'
    ), 0)
  into available_usd;

  if p_amount > available_usd then raise exception 'Payout exceeds available balance'; end if;

  insert into public.payout_requests (
    tester_id, amount, method, destination_account, status, transaction_ref,
    currency, exchange_rate, exchange_rate_source, exchange_rate_at, kes_amount, requested_at
  ) values (
    p_tester_id, round(p_amount, 2), p_method, trim(p_destination_account), 'pending', p_transaction_ref,
    'USD', case when p_method = 'Safaricom M-Pesa' then p_exchange_rate else null end,
    case when p_method = 'Safaricom M-Pesa' then p_exchange_rate_source else null end,
    case when p_method = 'Safaricom M-Pesa' then p_exchange_rate_at else null end,
    case when p_method = 'Safaricom M-Pesa' then p_kes_amount else null end, now()
  ) returning * into created_request;

  return created_request;
end;
$$;

revoke all on function public.create_payout_request(uuid, numeric, text, text, text, numeric, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_payout_request(uuid, numeric, text, text, text, numeric, bigint, text, timestamptz) to service_role;

notify pgrst, 'reload schema';
