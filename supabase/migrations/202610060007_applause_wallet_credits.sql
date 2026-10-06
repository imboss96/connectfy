alter table public.project_applause_approval_email_outbox
  add column if not exists approved_amount numeric(12,2) not null default 0
    check (approved_amount >= 0);

update public.project_applause_approval_email_outbox as email
set approved_amount = coalesce(
  (
    select schedule.amount
    from public.project_payroll_schedule as schedule
    where schedule.project_id = email.project_id
      and schedule.source_key = email.source_key
  ),
  (
    select settings.payroll_amount
    from public.project_operations_settings as settings
    where settings.project_id = email.project_id
  ),
  0
);

create or replace function public.set_applause_approval_email_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(settings.payroll_amount, 0)
    into new.approved_amount
    from public.project_operations_settings as settings
    where settings.project_id = new.project_id;

  new.approved_amount := coalesce(new.approved_amount, 0);
  return new;
end;
$$;

drop trigger if exists project_applause_approval_email_amount on public.project_applause_approval_email_outbox;
create trigger project_applause_approval_email_amount
  before insert on public.project_applause_approval_email_outbox
  for each row
  execute function public.set_applause_approval_email_amount();

drop policy if exists "testers view their project payroll credits" on public.project_payroll_schedule;
create policy "testers view their project payroll credits"
  on public.project_payroll_schedule for select to authenticated
  using (profile_id = auth.uid());

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
