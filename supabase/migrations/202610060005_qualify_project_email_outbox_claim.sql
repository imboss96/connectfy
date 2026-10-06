create or replace function public.claim_project_email_outbox()
returns table (id uuid, payload jsonb, attempt_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_email_outbox as expired
  set status = 'failed',
      locked_until = null,
      last_error = coalesce(expired.last_error, 'Delivery worker lease expired after the final attempt.'),
      updated_at = now()
  where expired.status = 'processing'
    and expired.locked_until < now()
    and expired.attempt_count >= 8;

  return query
  with next_email as (
    select outbox.id
    from public.project_email_outbox as outbox
    where (
      (outbox.status = 'pending' and outbox.next_attempt_at <= now())
      or
      (outbox.status = 'processing' and outbox.locked_until < now())
    )
    and outbox.attempt_count < 8
    order by outbox.next_attempt_at, outbox.created_at
    limit 1
    for update skip locked
  )
  update public.project_email_outbox as outbox
  set status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      locked_until = now() + interval '5 minutes',
      updated_at = now()
  from next_email
  where outbox.id = next_email.id
  returning outbox.id, outbox.payload, outbox.attempt_count;
end;
$$;

revoke all on function public.claim_project_email_outbox() from public, anon, authenticated;
grant execute on function public.claim_project_email_outbox() to service_role;

notify pgrst, 'reload schema';
