alter table public.payout_requests
  add column if not exists currency text not null default 'USD',
  add column if not exists exchange_rate numeric(18,8),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_at timestamptz,
  add column if not exists kes_amount bigint,
  add column if not exists safaricom_conversation_id text,
  add column if not exists safaricom_originator_conversation_id text,
  add column if not exists safaricom_transaction_id text,
  add column if not exists safaricom_result jsonb,
  add column if not exists failure_reason text,
  add column if not exists approved_kes_amount bigint,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists payout_requests_safaricom_conversation_id_idx
  on public.payout_requests (safaricom_conversation_id)
  where safaricom_conversation_id is not null;

create unique index if not exists payout_requests_safaricom_originator_conversation_id_idx
  on public.payout_requests (safaricom_originator_conversation_id)
  where safaricom_originator_conversation_id is not null;

drop policy if exists "testers request payouts" on public.payout_requests;
drop policy if exists "testers see their payouts" on public.payout_requests;
create policy "testers and admins see payout requests" on public.payout_requests
  for select to authenticated
  using (tester_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.payout_requests from anon, authenticated;
grant select on public.payout_requests to authenticated;
grant all on public.payout_requests to service_role;

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

  if p_tester_id is null or p_amount is null or p_amount < 10 then
    raise exception 'Payout amount must be at least USD 10.00';
  end if;

  if p_method not in ('PayPal', 'Payoneer', 'Direct Bank Wire', 'Wise', 'Safaricom M-Pesa') then
    raise exception 'Unsupported payout method';
  end if;

  if coalesce(trim(p_destination_account), '') = '' then
    raise exception 'A payout destination is required';
  end if;

  if p_method = 'Safaricom M-Pesa'
    and (p_exchange_rate is null or p_exchange_rate <= 0 or p_kes_amount is null or p_kes_amount < 1) then
    raise exception 'A valid USD to KES quote is required for M-Pesa payouts';
  end if;

  select role::text
  into tester_role
  from public.profiles
  where id = p_tester_id
  for update;

  if not found then
    raise exception 'Tester profile not found';
  end if;
  if tester_role <> 'tester' then
    raise exception 'Only tester accounts can request tester payouts';
  end if;

  select coalesce(sum(submission.bounty_earned), 0)
    - coalesce((
      select sum(request.amount)
      from public.payout_requests as request
      where request.tester_id = p_tester_id
        and request.status <> 'failed'
    ), 0)
  into available_usd
  from public.submissions as submission
  where submission.tester_id = p_tester_id
    and submission.status = 'approved';

  if p_amount > available_usd then
    raise exception 'Payout exceeds available balance';
  end if;

  insert into public.payout_requests (
    tester_id,
    amount,
    method,
    destination_account,
    status,
    transaction_ref,
    currency,
    exchange_rate,
    exchange_rate_source,
    exchange_rate_at,
    kes_amount,
    requested_at
  )
  values (
    p_tester_id,
    round(p_amount, 2),
    p_method,
    trim(p_destination_account),
    'pending',
    p_transaction_ref,
    'USD',
    p_exchange_rate,
    p_exchange_rate_source,
    p_exchange_rate_at,
    case when p_method = 'Safaricom M-Pesa' then p_kes_amount else null end,
    now()
  )
  returning * into created_request;

  return created_request;
end;
$$;

revoke all on function public.create_payout_request(uuid, numeric, text, text, text, numeric, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_payout_request(uuid, numeric, text, text, text, numeric, bigint, text, timestamptz) to service_role;

notify pgrst, 'reload schema';
