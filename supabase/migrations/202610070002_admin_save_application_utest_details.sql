create or replace function public.admin_save_application_utest_details(
  p_application_id uuid,
  p_utest_id text,
  p_utest_email text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  pending_request public.application_utest_update_requests%rowtype;
  normalized_utest_id text := trim(coalesce(p_utest_id, ''));
  normalized_utest_email text := trim(coalesce(p_utest_email, ''));
  tester_name text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can update application uTest details';
  end if;
  if normalized_utest_id = '' or length(normalized_utest_id) > 120 then
    raise exception 'Enter a valid uTest ID';
  end if;
  if normalized_utest_email <> '' and normalized_utest_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid uTest email address';
  end if;

  select * into target_application
  from public.applications
  where id = p_application_id
  for update;
  if not found then raise exception 'Project application not found'; end if;

  select name into tester_name
  from public.profiles
  where id = target_application.tester_id;

  insert into public.application_utest_details (
    application_id, tester_id, full_name, utest_id, utest_email
  ) values (
    target_application.id,
    target_application.tester_id,
    coalesce(tester_name, ''),
    normalized_utest_id,
    normalized_utest_email
  )
  on conflict (application_id) do update
  set utest_id = excluded.utest_id,
      utest_email = case
        when excluded.utest_email = '' then public.application_utest_details.utest_email
        else excluded.utest_email
      end,
      updated_at = now();

  select * into pending_request
  from public.application_utest_update_requests
  where application_id = target_application.id
    and status = 'pending'
  for update;

  if found then
    update public.applications
    set status = pending_request.previous_status,
        invite_status = pending_request.previous_invite_status,
        updated_at = now()
    where id = target_application.id;

    update public.application_utest_update_requests
    set status = 'completed',
        completed_at = now()
    where id = pending_request.id;
  end if;
end;
$$;

revoke all on function public.admin_save_application_utest_details(uuid, text, text) from public, anon;
grant execute on function public.admin_save_application_utest_details(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
