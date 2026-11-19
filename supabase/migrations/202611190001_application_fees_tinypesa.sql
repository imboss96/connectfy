alter table public.projects
  add column if not exists application_fee_kes integer not null default 0
    check (application_fee_kes between 0 and 100000);

create table if not exists public.application_fee_payments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  amount_kes integer not null check (amount_kes between 1 and 100000),
  phone_number text not null,
  status text not null default 'pending'
    check (status in ('pending', 'initiating', 'paid', 'applied', 'failed', 'expired', 'refund_pending', 'refunded')),
  terms_accepted_at timestamptz not null default now(),
  hold_expires_at timestamptz,
  stk_claim_token uuid,
  merchant_request_id text,
  tinypesa_request_id text unique,
  provider_external_reference text unique,
  mpesa_receipt text,
  failure_reason text,
  callback_payload jsonb,
  application_id uuid references public.applications(id) on delete set null,
  refund_status text not null default 'none'
    check (refund_status in ('none', 'pending', 'processing', 'completed', 'failed')),
  refund_transaction_ref text,
  refund_conversation_id text unique,
  refund_originator_conversation_id text,
  refund_transaction_id text,
  refund_failure_reason text,
  refund_callback_payload jsonb,
  refund_requested_by uuid references public.profiles(id) on delete set null,
  refund_requested_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_fee_payments
  add column if not exists tinypesa_request_id text,
  add column if not exists provider_external_reference text;

create unique index if not exists application_fee_payments_tinypesa_request_id_key
  on public.application_fee_payments (tinypesa_request_id);

create unique index if not exists application_fee_payments_provider_external_reference_key
  on public.application_fee_payments (provider_external_reference);

create index if not exists application_fee_payments_project_hold_idx
  on public.application_fee_payments (project_id, hold_expires_at)
  where status in ('pending', 'initiating');

create index if not exists application_fee_payments_tester_project_idx
  on public.application_fee_payments (tester_id, project_id, created_at desc);

alter table public.applications
  add column if not exists application_fee_payment_id uuid unique
    references public.application_fee_payments(id) on delete set null;

alter table public.application_fee_payments enable row level security;
revoke all on public.application_fee_payments from anon, authenticated;
grant all on public.application_fee_payments to service_role;

create or replace function public.refresh_project_application_slots(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  occupied_count integer;
begin
  select
    (select count(*)::integer from public.applications where project_id = p_project_id)
    + (
      select count(*)::integer
      from public.application_fee_payments
      where project_id = p_project_id
        and (
          status = 'paid'
          or (status in ('pending', 'initiating') and hold_expires_at > now())
        )
    )
  into occupied_count;

  update public.projects
  set slots_filled = occupied_count,
      status = case
        when (
          select count(*)::integer
          from public.applications
          where project_id = p_project_id
        ) >= slots_total then 'closed'
        else status
      end,
      updated_at = now()
  where id = p_project_id;
end;
$$;

create or replace function public.sync_project_application_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_project_application_slots(old.project_id);
    return old;
  end if;

  perform public.refresh_project_application_slots(new.project_id);
  if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
    perform public.refresh_project_application_slots(old.project_id);
  end if;
  return new;
end;
$$;

drop trigger if exists applications_sync_project_slots on public.applications;
create trigger applications_sync_project_slots
  after insert or update of project_id or delete on public.applications
  for each row
  execute function public.sync_project_application_slots();

create or replace function public.sync_project_application_fee_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_project_application_slots(old.project_id);
    return old;
  end if;

  perform public.refresh_project_application_slots(new.project_id);
  if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
    perform public.refresh_project_application_slots(old.project_id);
  end if;
  return new;
end;
$$;

drop trigger if exists application_fee_payments_sync_project_slots on public.application_fee_payments;
create trigger application_fee_payments_sync_project_slots
  after insert or update of status, hold_expires_at or delete on public.application_fee_payments
  for each row
  execute function public.sync_project_application_fee_slots();

create or replace function public.guard_project_application_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_fee integer;
  slot_capacity integer;
  project_status text;
  submitted_count integer;
  matching_payment_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.application_fee_payment_id is distinct from old.application_fee_payment_id then
      raise exception 'An application fee payment link cannot be changed';
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.applications
    where project_id = new.project_id
      and tester_id = new.tester_id
  ) then
    return new;
  end if;

  select application_fee_kes, slots_total, status::text
    into project_fee, slot_capacity, project_status
    from public.projects
    where id = new.project_id
    for update;

  if not found then
    raise exception 'The selected project does not exist';
  end if;

  if new.application_fee_payment_id is not null then
    if project_status <> 'active' then
      raise exception 'This project is no longer accepting applications';
    end if;
    select id
      into matching_payment_id
      from public.application_fee_payments
      where id = new.application_fee_payment_id
        and project_id = new.project_id
        and tester_id = new.tester_id
        and status = 'paid'
      for update;
    if not found then
      raise exception 'A confirmed M-Pesa application fee is required';
    end if;
  elsif project_fee > 0 then
    raise exception 'Pay the project application fee before applying';
  end if;

  select
    (select count(*)::integer
     from public.applications
     where project_id = new.project_id)
    + (
      select count(*)::integer
      from public.application_fee_payments
      where project_id = new.project_id
        and id is distinct from matching_payment_id
        and (
          status = 'paid'
          or (status in ('pending', 'initiating') and hold_expires_at > now())
        )
    )
  into submitted_count;

  if submitted_count >= slot_capacity then
    raise exception 'This project has no remaining slots';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_guard_project_capacity on public.applications;
create trigger applications_guard_project_capacity
  before insert or update of application_fee_payment_id on public.applications
  for each row
  execute function public.guard_project_application_capacity();

create or replace function public.link_application_fee_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.application_fee_payment_id is not null then
    update public.application_fee_payments
    set status = 'applied',
        application_id = new.id,
        hold_expires_at = null,
        updated_at = now()
    where id = new.application_fee_payment_id
      and project_id = new.project_id
      and tester_id = new.tester_id
      and status = 'paid';

    if not found then
      raise exception 'The M-Pesa application fee is no longer available';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_link_application_fee_payment on public.applications;
create trigger applications_link_application_fee_payment
  after insert on public.applications
  for each row
  execute function public.link_application_fee_payment();

create or replace function public.begin_application_fee_checkout(
  p_project_id uuid,
  p_tester_id uuid,
  p_phone_number text,
  p_terms_accepted boolean
)
returns public.application_fee_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project public.projects;
  existing_payment public.application_fee_payments;
  created_payment public.application_fee_payments;
  occupied_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Application fee checkouts must be created by the payment backend';
  end if;

  update public.application_fee_payments
  set status = 'expired',
      hold_expires_at = null,
      updated_at = now()
  where project_id = p_project_id
    and status in ('pending', 'initiating')
    and hold_expires_at <= now();

  select * into target_project
  from public.projects
  where id = p_project_id
  for update;
  if not found then raise exception 'The selected project does not exist'; end if;
  if target_project.status::text <> 'active' then
    raise exception 'This project is not accepting applications';
  end if;
  if target_project.application_fee_kes <= 0 then
    raise exception 'This project does not require an application fee';
  end if;
  if trim(coalesce(p_phone_number, '')) = '' then
    raise exception 'A valid M-Pesa phone number is required';
  end if;
  if p_terms_accepted is distinct from true then
    raise exception 'Accept the application fee and refund terms before paying';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_tester_id and role::text = 'tester'
  ) then
    raise exception 'Only tester accounts can apply to projects';
  end if;
  if exists (
    select 1 from public.applications
    where project_id = p_project_id and tester_id = p_tester_id
  ) then
    raise exception 'You have already applied to this project';
  end if;

  select * into existing_payment
  from public.application_fee_payments
  where project_id = p_project_id
    and tester_id = p_tester_id
    and status in ('pending', 'initiating', 'paid')
    and (status = 'paid' or hold_expires_at > now())
  order by created_at desc
  limit 1;
  if found then return existing_payment; end if;

  select
    (select count(*)::integer from public.applications where project_id = p_project_id)
    + (select count(*)::integer
       from public.application_fee_payments
       where project_id = p_project_id
         and (
           status = 'paid'
           or (status in ('pending', 'initiating') and hold_expires_at > now())
         ))
  into occupied_count;
  if occupied_count >= target_project.slots_total then
    raise exception 'This project has no remaining slots';
  end if;

  insert into public.application_fee_payments (
    project_id, tester_id, amount_kes, phone_number, hold_expires_at
  ) values (
    p_project_id, p_tester_id, target_project.application_fee_kes, trim(p_phone_number), now() + interval '10 minutes'
  )
  returning * into created_payment;
  return created_payment;
end;
$$;

create or replace function public.claim_application_fee_stk_request(p_payment_id uuid, p_claim_token uuid)
returns public.application_fee_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment public.application_fee_payments;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'M-Pesa checkout requests must be claimed by the payment backend';
  end if;

  select * into target_payment
  from public.application_fee_payments
  where id = p_payment_id
  for update;
  if not found then raise exception 'Application fee checkout was not found'; end if;
  if target_payment.status <> 'pending' or target_payment.tinypesa_request_id is not null then
    return target_payment;
  end if;
  if target_payment.hold_expires_at <= now() then
    update public.application_fee_payments
    set status = 'expired',
        hold_expires_at = null,
        updated_at = now()
    where id = p_payment_id
    returning * into target_payment;
    return target_payment;
  end if;

  update public.application_fee_payments
  set status = 'initiating',
      stk_claim_token = p_claim_token,
      updated_at = now()
  where id = p_payment_id
  returning * into target_payment;
  return target_payment;
end;
$$;

drop function if exists public.record_application_fee_payment_result(text, integer, integer, text, text, jsonb);

create or replace function public.record_application_fee_payment_result(
  p_tinypesa_id text,
  p_external_reference text,
  p_merchant_request_id text,
  p_result_code integer,
  p_amount_kes integer,
  p_receipt text,
  p_phone_number text,
  p_callback_payload jsonb
)
returns public.application_fee_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment public.application_fee_payments;
  project_slots integer;
  target_project_status text;
  occupied_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'TinyPesa callbacks must be processed by the payment backend';
  end if;

  if coalesce(trim(p_tinypesa_id), '') = '' then
    raise exception 'TinyPesa request ID is required';
  end if;

  select * into target_payment
  from public.application_fee_payments
  where provider_external_reference = p_external_reference
  for update;
  if not found then raise exception 'Application fee checkout was not found'; end if;

  if target_payment.tinypesa_request_id is not null
    and target_payment.tinypesa_request_id is distinct from p_tinypesa_id then
    raise exception 'TinyPesa request ID does not match the application fee checkout';
  end if;

  if target_payment.status in ('paid', 'applied', 'refund_pending', 'refunded') then
    return target_payment;
  end if;
  if target_payment.status not in ('pending', 'initiating', 'expired', 'failed') then
    return target_payment;
  end if;

  if coalesce(p_result_code, 1) <> 0 then
    update public.application_fee_payments
    set status = 'failed',
        tinypesa_request_id = p_tinypesa_id,
        merchant_request_id = p_merchant_request_id,
        failure_reason = left(coalesce(
          p_callback_payload #>> '{webhook,Body,stkCallback,ResultDesc}',
          p_callback_payload #>> '{webhook,ResultDesc}',
          'M-Pesa payment was not completed.'
        ), 1000),
        callback_payload = p_callback_payload,
        hold_expires_at = null,
        updated_at = now()
    where id = target_payment.id
    returning * into target_payment;
    return target_payment;
  end if;

  if p_amount_kes is distinct from target_payment.amount_kes
    or p_phone_number is distinct from target_payment.phone_number
    or coalesce(trim(p_receipt), '') = '' then
    update public.application_fee_payments
    set status = 'refund_pending',
        refund_status = 'pending',
        failure_reason = 'Payment confirmation did not match the requested amount, phone number, or receipt.',
        tinypesa_request_id = p_tinypesa_id,
        merchant_request_id = p_merchant_request_id,
        callback_payload = p_callback_payload,
        hold_expires_at = null,
        updated_at = now()
    where id = target_payment.id
    returning * into target_payment;
    return target_payment;
  end if;

  select slots_total, status::text into project_slots, target_project_status
  from public.projects
  where id = target_payment.project_id
  for update;

  select
    (select count(*)::integer from public.applications where project_id = target_payment.project_id)
    + (select count(*)::integer
       from public.application_fee_payments
       where project_id = target_payment.project_id
         and id <> target_payment.id
         and (
           status = 'paid'
           or (status in ('pending', 'initiating') and hold_expires_at > now())
         ))
  into occupied_count;

  update public.application_fee_payments
  set status = case
    when project_slots is null or occupied_count >= project_slots or target_project_status <> 'active' then 'refund_pending'
        else 'paid'
      end,
      refund_status = case
    when project_slots is null or occupied_count >= project_slots or target_project_status <> 'active' then 'pending'
        else 'none'
      end,
      failure_reason = case
    when project_slots is null or occupied_count >= project_slots or target_project_status <> 'active' then 'Payment succeeded after the reserved project slot became unavailable.'
        else null
      end,
      tinypesa_request_id = p_tinypesa_id,
      merchant_request_id = p_merchant_request_id,
      mpesa_receipt = p_receipt,
      callback_payload = p_callback_payload,
      hold_expires_at = null,
      updated_at = now()
  where id = target_payment.id
  returning * into target_payment;
  return target_payment;
end;
$$;

create or replace function public.expire_application_fee_checkouts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Application fee checkouts must be expired by the payment backend';
  end if;

  update public.application_fee_payments
  set status = 'expired',
      hold_expires_at = null,
      updated_at = now()
  where status in ('pending', 'initiating')
    and hold_expires_at <= now();
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.claim_application_fee_refund(
  p_payment_id uuid,
  p_admin_id uuid,
  p_transaction_ref text
)
returns public.application_fee_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment public.application_fee_payments;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Application fee refunds must be initiated by the payment backend';
  end if;

  select * into target_payment
  from public.application_fee_payments
  where id = p_payment_id
  for update;
  if not found then raise exception 'Application fee payment was not found'; end if;
  if target_payment.status not in ('paid', 'applied', 'refund_pending') then
    raise exception 'Only a confirmed application fee can be refunded';
  end if;
  if target_payment.refund_status in ('processing', 'completed') then
    raise exception 'This application fee refund is already processing or completed';
  end if;

  update public.application_fee_payments
  set refund_status = 'processing',
      refund_transaction_ref = p_transaction_ref,
      refund_requested_by = p_admin_id,
      refund_requested_at = now(),
      refund_failure_reason = null,
      updated_at = now()
  where id = p_payment_id
  returning * into target_payment;
  return target_payment;
end;
$$;

create or replace function public.record_application_fee_refund_result(
  p_conversation_id text,
  p_succeeded boolean,
  p_timed_out boolean,
  p_callback_payload jsonb,
  p_failure_reason text,
  p_transaction_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Safaricom callbacks must be processed by the payment backend';
  end if;

  update public.application_fee_payments
  set refund_status = case
        when p_succeeded then 'completed'
        when p_timed_out then 'processing'
        else 'failed'
      end,
      status = case when p_succeeded then 'refunded' else status end,
      refund_failure_reason = case when p_succeeded then null else left(coalesce(p_failure_reason, 'Safaricom refund failed.'), 1000) end,
      refund_transaction_id = coalesce(p_transaction_id, refund_transaction_id),
      refund_callback_payload = p_callback_payload,
      refunded_at = case when p_succeeded then now() else null end,
      updated_at = now()
  where refund_conversation_id = p_conversation_id
    and refund_status = 'processing';
end;
$$;

revoke all on function public.begin_application_fee_checkout(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.claim_application_fee_stk_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_application_fee_payment_result(text, text, text, integer, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.expire_application_fee_checkouts() from public, anon, authenticated;
revoke all on function public.claim_application_fee_refund(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.record_application_fee_refund_result(text, boolean, boolean, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.refresh_project_application_slots(uuid) from public, anon, authenticated;
grant execute on function public.begin_application_fee_checkout(uuid, uuid, text, boolean) to service_role;
grant execute on function public.claim_application_fee_stk_request(uuid, uuid) to service_role;
grant execute on function public.record_application_fee_payment_result(text, text, text, integer, integer, text, text, jsonb) to service_role;
grant execute on function public.expire_application_fee_checkouts() to service_role;
grant execute on function public.claim_application_fee_refund(uuid, uuid, text) to service_role;
grant execute on function public.record_application_fee_refund_result(text, boolean, boolean, jsonb, text, text) to service_role;
grant execute on function public.refresh_project_application_slots(uuid) to service_role;

select public.refresh_project_application_slots(id) from public.projects;

notify pgrst, 'reload schema';
