create table if not exists public.project_application_restriction_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.project_application_restriction_settings enable row level security;
revoke all on public.project_application_restriction_settings from public, anon, authenticated;

insert into public.project_application_restriction_settings (singleton, enabled)
values (true, true)
on conflict (singleton) do nothing;

create or replace function public.get_project_application_restriction()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to view the project application restriction.'
      using errcode = '42501';
  end if;

  return coalesce(
    (
      select settings.enabled
      from public.project_application_restriction_settings as settings
      where settings.singleton
    ),
    true
  );
end;
$$;

create or replace function public.set_project_application_restriction(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Super Admin access is required to change the project application restriction.'
      using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'The project application restriction must be enabled or disabled.'
      using errcode = '22023';
  end if;

  insert into public.project_application_restriction_settings (
    singleton, enabled, updated_at, updated_by
  ) values (
    true, p_enabled, now(), auth.uid()
  )
  on conflict (singleton) do update
  set enabled = excluded.enabled,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
end;
$$;

create or replace function public.enforce_tester_project_application_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from new.tester_id then
    return new;
  end if;

  if tg_op = 'INSERT'
    and (new.status <> 'pending' or new.invite_status is not null) then
    raise exception 'Tester applications must start pending and cannot set an invitation status.'
      using errcode = 'P0001';
  end if;

  perform 1
  from public.profiles
  where id = new.tester_id
  for update;

  if public.get_project_application_restriction()
    and exists (
      select 1
      from public.applications as application
      where application.tester_id = new.tester_id
        and application.project_id <> new.project_id
        and application.status <> 'rejected'
        and application.invite_status is distinct from 'declined'
        and (
          not exists (
            select 1
            from public.submissions as submission
            where submission.tester_id = application.tester_id
              and submission.project_id = application.project_id
              and not exists (
                select 1
                from public.submissions as resubmission
                where resubmission.resubmission_of = submission.id
              )
          )
          or exists (
            select 1
            from public.submissions as submission
            where submission.tester_id = application.tester_id
              and submission.project_id = application.project_id
              and submission.status <> 'approved'
              and not exists (
                select 1
                from public.submissions as resubmission
                where resubmission.resubmission_of = submission.id
              )
          )
        )
    ) then
    raise exception 'Submit at least one deliverable for your current project and have every submission approved before applying to another project.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.get_project_application_restriction() from public, anon;
revoke all on function public.set_project_application_restriction(boolean) from public, anon;
grant execute on function public.get_project_application_restriction() to authenticated;
grant execute on function public.set_project_application_restriction(boolean) to authenticated;
