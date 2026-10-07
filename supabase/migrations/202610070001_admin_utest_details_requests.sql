create table public.application_utest_update_requests (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references public.applications(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  previous_status text not null,
  previous_invite_status text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index application_utest_update_requests_pending_app_uidx
  on public.application_utest_update_requests (application_id)
  where status = 'pending';

alter table public.application_utest_update_requests enable row level security;
revoke all on public.application_utest_update_requests from public, anon, authenticated;
grant select on public.application_utest_update_requests to authenticated;

create policy "admins view application uTest update requests"
  on public.application_utest_update_requests for select to authenticated
  using (public.is_admin());

create or replace function public.request_application_utest_details(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application public.applications%rowtype;
  request_id uuid;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can request application uTest details';
  end if;

  select * into target_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Project application not found'; end if;

  select id into request_id
  from public.application_utest_update_requests
  where application_id = target_application.id and status = 'pending'
  limit 1;

  if request_id is null then
    insert into public.application_utest_update_requests (
      application_id, project_id, tester_id, previous_status,
      previous_invite_status, requested_by
    ) values (
      target_application.id,
      target_application.project_id,
      target_application.tester_id,
      case when target_application.status = 'needs_utest_update' then 'approved' else target_application.status end,
      target_application.invite_status,
      auth.uid()
    ) returning id into request_id;
  end if;

  update public.applications
  set status = 'needs_utest_update',
      invite_status = null,
      updated_at = now()
  where id = target_application.id;

  return request_id;
end;
$$;

create or replace function public.complete_application_utest_details_request(
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
  if auth.uid() is null then raise exception 'Sign in to update your project application'; end if;
  if normalized_utest_id = '' or length(normalized_utest_id) > 120 then
    raise exception 'Enter a valid uTest ID';
  end if;
  if normalized_utest_email <> '' and normalized_utest_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid uTest email address';
  end if;

  select * into target_application
  from public.applications
  where id = p_application_id and tester_id = auth.uid()
  for update;
  if not found then raise exception 'This project application does not belong to your signed-in account'; end if;

  select * into pending_request
  from public.application_utest_update_requests
  where application_id = target_application.id
    and tester_id = auth.uid()
    and status = 'pending'
  for update;
  if not found then raise exception 'There is no pending uTest details request for this application'; end if;

  select name into tester_name from public.profiles where id = auth.uid();
  insert into public.application_utest_details (
    application_id, tester_id, full_name, utest_id, utest_email
  ) values (
    target_application.id, auth.uid(), coalesce(tester_name, ''), normalized_utest_id, normalized_utest_email
  )
  on conflict (application_id) do update
  set utest_id = excluded.utest_id,
      utest_email = case when excluded.utest_email = '' then public.application_utest_details.utest_email else excluded.utest_email end,
      updated_at = now();

  update public.applications
  set status = pending_request.previous_status,
      invite_status = pending_request.previous_invite_status,
      updated_at = now()
  where id = target_application.id;

  update public.application_utest_update_requests
  set status = 'completed', completed_at = now()
  where id = pending_request.id;
end;
$$;

revoke all on function public.request_application_utest_details(uuid) from public, anon;
grant execute on function public.request_application_utest_details(uuid) to authenticated;
revoke all on function public.complete_application_utest_details_request(uuid, text, text) from public, anon;
grant execute on function public.complete_application_utest_details_request(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
