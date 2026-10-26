create table if not exists public.project_step_requirements (
  project_id uuid not null references public.projects(id) on delete cascade,
  step_id text not null check (step_id in ('slack', 'consent', 'languageSettings', 'recordings')),
  is_required boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (project_id, step_id)
);

alter table public.project_step_requirements enable row level security;
revoke all on public.project_step_requirements from public, anon, authenticated;

alter table public.project_step_progress
  drop constraint if exists project_step_progress_statuses_object;

alter table public.project_step_progress
  add constraint project_step_progress_statuses_object check (
    jsonb_typeof(statuses) = 'object'
    and statuses ?& array['slack', 'consent', 'languageSettings', 'recordings']
    and statuses->>'slack' in ('pending', 'submitted', 'done', 'failed', 'skipped')
    and statuses->>'consent' in ('pending', 'submitted', 'done', 'failed', 'skipped')
    and statuses->>'languageSettings' in ('pending', 'submitted', 'done', 'failed', 'skipped')
    and statuses->>'recordings' in ('pending', 'submitted', 'done', 'failed', 'skipped')
  );

create or replace function public.get_project_step_requirements(p_project_id uuid)
returns table (step_id text, is_required boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to view project step requirements.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.projects as project
    where project.id = p_project_id
  ) then
    raise exception 'Project not found.'
      using errcode = 'P0002';
  end if;

  if not coalesce(public.can_manage_projects(), false)
    and not coalesce(public.can_review_submissions(), false)
    and not exists (
      select 1
      from public.applications as application
      where application.project_id = p_project_id
        and application.tester_id = auth.uid()
        and application.status <> 'rejected'
        and application.invite_status is distinct from 'declined'
    ) then
    raise exception 'An active project application is required to view step requirements.'
      using errcode = '42501';
  end if;

  return query
  select steps.step_id, coalesce(requirement.is_required, true)
  from unnest(array['slack', 'consent', 'languageSettings', 'recordings']) with ordinality
    as steps(step_id, step_order)
  left join public.project_step_requirements as requirement
    on requirement.project_id = p_project_id
    and requirement.step_id = steps.step_id
  order by steps.step_order;
end;
$$;

create or replace function public.set_project_step_requirements(
  p_project_id uuid,
  p_requirements jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  step_ids text[] := array['slack', 'consent', 'languageSettings', 'recordings'];
  setting_step_id text;
  requirement_count integer;
begin
  if not coalesce(public.can_manage_projects(), false) then
    raise exception 'Project Manager or Super Admin access is required.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found.'
      using errcode = 'P0002';
  end if;

  if coalesce(jsonb_typeof(p_requirements), '') <> 'object' then
    raise exception 'Project step requirements have an invalid format.'
      using errcode = '22023';
  end if;

  select count(*) into requirement_count from jsonb_object_keys(p_requirements);
  if requirement_count <> 4 or not (p_requirements ?& step_ids) then
    raise exception 'Project step requirements must specify all four steps.'
      using errcode = '22023';
  end if;

  foreach setting_step_id in array step_ids
  loop
    if coalesce(jsonb_typeof(p_requirements->setting_step_id), '') <> 'boolean' then
      raise exception 'Each project step requirement must be true or false.'
        using errcode = '22023';
    end if;
  end loop;

  delete from public.project_step_requirements
  where project_id = p_project_id;

  insert into public.project_step_requirements (
    project_id, step_id, is_required, updated_at, updated_by
  )
  select
    p_project_id,
    steps.step_id,
    (p_requirements->>steps.step_id)::boolean,
    now(),
    auth.uid()
  from unnest(step_ids) as steps(step_id);
end;
$$;

create or replace function public.submit_project_step_progress(
  p_project_id uuid,
  p_statuses jsonb,
  p_evidence jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_statuses jsonb;
  step_ids text[] := array['slack', 'consent', 'languageSettings', 'recordings'];
  current_step_id text;
  prior_step_id text;
  old_status text;
  new_status text;
  step_index integer;
  is_required boolean;
  is_prior_required boolean;
  changes_count integer := 0;
  status_key_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to submit project steps for review.'
      using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_statuses), '') <> 'object'
    or coalesce(jsonb_typeof(p_evidence), '') <> 'array' then
    raise exception 'Project step progress has an invalid format.'
      using errcode = '22023';
  end if;

  select count(*) into status_key_count from jsonb_object_keys(p_statuses);
  if status_key_count <> 4 or not (p_statuses ?& step_ids) then
    raise exception 'Project step progress has an invalid format.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.applications as application
    where application.project_id = p_project_id
      and application.tester_id = auth.uid()
      and application.status <> 'rejected'
      and application.invite_status is distinct from 'declined'
  ) then
    raise exception 'An active project application is required to submit steps.'
      using errcode = '42501';
  end if;

  insert into public.project_step_progress (project_id, tester_id)
  values (p_project_id, auth.uid())
  on conflict (project_id, tester_id) do nothing;

  select progress.statuses into saved_statuses
  from public.project_step_progress as progress
  where progress.project_id = p_project_id
    and progress.tester_id = auth.uid()
  for update;

  foreach current_step_id in array step_ids
  loop
    old_status := coalesce(saved_statuses->>current_step_id, 'pending');
    new_status := p_statuses->>current_step_id;
    select coalesce(requirement.is_required, true) into is_required
    from (select 1) as singleton
    left join public.project_step_requirements as requirement
      on requirement.project_id = p_project_id
      and requirement.step_id = current_step_id;

    if new_status not in ('pending', 'submitted', 'done', 'failed', 'skipped') then
      raise exception 'Project step status is invalid.'
        using errcode = '22023';
    end if;

    if new_status is distinct from old_status then
      if new_status = 'skipped' then
        if is_required or old_status not in ('pending', 'failed') then
          raise exception 'Only an uncompleted optional step can be skipped.'
            using errcode = '42501';
        end if;
      elsif new_status = 'submitted' then
        if old_status not in ('pending', 'failed')
          and not (old_status = 'skipped' and is_required) then
          raise exception 'Only an unapproved step can be submitted for review.'
            using errcode = '42501';
        end if;

        step_index := array_position(step_ids, current_step_id);
        if step_index > 1 then
          for prior_step_id in
            select prior_steps.step_id
            from unnest(step_ids[1:step_index - 1]) as prior_steps(step_id)
          loop
            select coalesce(requirement.is_required, true) into is_prior_required
            from (select 1) as singleton
            left join public.project_step_requirements as requirement
              on requirement.project_id = p_project_id
              and requirement.step_id = prior_step_id;
            if is_prior_required and saved_statuses->>prior_step_id is distinct from 'done' then
              raise exception 'All preceding required steps must be approved before submitting this step.'
                using errcode = 'P0001';
            end if;
          end loop;
        end if;
      else
        raise exception 'Project step status cannot be changed directly.'
          using errcode = '42501';
      end if;
      changes_count := changes_count + 1;
    end if;
  end loop;

  if changes_count > 1 then
    raise exception 'Submit or skip one project step at a time.'
      using errcode = 'P0001';
  end if;

  update public.project_step_progress
  set statuses = p_statuses,
      evidence = p_evidence,
      updated_at = now()
  where project_id = p_project_id
    and tester_id = auth.uid();
end;
$$;

drop function if exists public.fetch_pending_project_step_reviews();

create function public.fetch_pending_project_step_reviews()
returns table (
  project_id uuid,
  tester_id uuid,
  project_title text,
  tester_name text,
  tester_email text,
  step_id text,
  updated_at timestamptz,
  latest_note text,
  is_required boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  step_ids text[] := array['slack', 'consent', 'languageSettings', 'recordings'];
begin
  if not coalesce(public.can_review_submissions(), false) then
    raise exception 'Reviewer or Project Manager access is required.'
      using errcode = '42501';
  end if;

  return query
  select
    progress.project_id,
    progress.tester_id,
    project.title,
    coalesce(nullif(profile.name, ''), profile.email),
    profile.email,
    steps.step_id,
    progress.updated_at,
    latest_review.note,
    coalesce(current_requirement.is_required, true)
  from public.project_step_progress as progress
  join public.projects as project on project.id = progress.project_id
  join public.profiles as profile on profile.id = progress.tester_id
  cross join lateral unnest(step_ids) with ordinality as steps(step_id, step_order)
  left join public.project_step_requirements as current_requirement
    on current_requirement.project_id = progress.project_id
    and current_requirement.step_id = steps.step_id
  left join lateral (
    select history.note
    from public.project_step_review_history as history
    where history.project_id = progress.project_id
      and history.tester_id = progress.tester_id
      and history.step_id = steps.step_id
    order by history.created_at desc
    limit 1
  ) as latest_review on true
  where progress.statuses->>steps.step_id = 'submitted'
    and not exists (
      select 1
      from unnest(step_ids) with ordinality as previous_steps(step_id, step_order)
      left join public.project_step_requirements as requirement
        on requirement.project_id = progress.project_id
        and requirement.step_id = previous_steps.step_id
      where previous_steps.step_order < steps.step_order
        and coalesce(requirement.is_required, true)
        and progress.statuses->>previous_steps.step_id is distinct from 'done'
    )
  order by progress.updated_at asc;
end;
$$;

create or replace function public.review_project_step(
  p_project_id uuid,
  p_tester_id uuid,
  p_step_id text,
  p_approved boolean,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_statuses jsonb;
  step_ids text[] := array['slack', 'consent', 'languageSettings', 'recordings'];
  step_index integer;
  prior_step_id text;
  is_prior_required boolean;
begin
  if not coalesce(public.can_review_submissions(), false) then
    raise exception 'Reviewer or Project Manager access is required.'
      using errcode = '42501';
  end if;

  step_index := array_position(step_ids, p_step_id);
  if step_index is null then
    raise exception 'Project step is invalid.'
      using errcode = '22023';
  end if;

  if not p_approved and nullif(trim(p_note), '') is null then
    raise exception 'Add a review note when requesting changes.'
      using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 2000 then
    raise exception 'Review notes must be 2000 characters or fewer.'
      using errcode = '22023';
  end if;

  select progress.statuses into saved_statuses
  from public.project_step_progress as progress
  where progress.project_id = p_project_id
    and progress.tester_id = p_tester_id
  for update;

  if not found or saved_statuses->>p_step_id is distinct from 'submitted' then
    raise exception 'This step is no longer awaiting approval.'
      using errcode = 'P0001';
  end if;

  if p_approved and step_index > 1 then
    for prior_step_id in
      select prior_steps.step_id
      from unnest(step_ids[1:step_index - 1]) as prior_steps(step_id)
    loop
      select coalesce(requirement.is_required, true) into is_prior_required
      from (select 1) as singleton
      left join public.project_step_requirements as requirement
        on requirement.project_id = p_project_id
        and requirement.step_id = prior_step_id;
      if is_prior_required and saved_statuses->>prior_step_id is distinct from 'done' then
        raise exception 'Approve all preceding required steps before reviewing this step.'
          using errcode = 'P0001';
      end if;
    end loop;
  end if;

  update public.project_step_progress
  set statuses = jsonb_set(
        saved_statuses,
        array[p_step_id],
        to_jsonb(case when p_approved then 'done' else 'failed' end)
      ),
      updated_at = now()
  where project_id = p_project_id
    and tester_id = p_tester_id;

  insert into public.project_step_review_history (
    project_id, tester_id, step_id, decision, note, reviewed_by
  ) values (
    p_project_id,
    p_tester_id,
    p_step_id,
    case when p_approved then 'approved' else 'changes_requested' end,
    coalesce(trim(p_note), ''),
    auth.uid()
  );
end;
$$;

create or replace function public.enforce_required_project_steps_before_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.title in ('Project Completion Checklist', 'Google Selfies Project Completion')
    and exists (
      select 1
      from unnest(array['slack', 'consent', 'languageSettings', 'recordings']) as steps(step_id)
      left join public.project_step_requirements as requirement
        on requirement.project_id = new.project_id
        and requirement.step_id = steps.step_id
      left join public.project_step_progress as progress
        on progress.project_id = new.project_id
        and progress.tester_id = new.tester_id
      where coalesce(requirement.is_required, true)
        and progress.statuses->>steps.step_id is distinct from 'done'
    ) then
    raise exception 'All required project steps must be approved before submitting project completion.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_required_project_steps_before_completion on public.submissions;
create trigger enforce_required_project_steps_before_completion
  before insert on public.submissions
  for each row
  execute function public.enforce_required_project_steps_before_completion();

revoke all on function public.get_project_step_requirements(uuid) from public, anon;
revoke all on function public.set_project_step_requirements(uuid, jsonb) from public, anon;
revoke all on function public.submit_project_step_progress(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.fetch_pending_project_step_reviews() from public, anon;
revoke all on function public.review_project_step(uuid, uuid, text, boolean, text) from public, anon;
grant execute on function public.get_project_step_requirements(uuid) to authenticated;
grant execute on function public.set_project_step_requirements(uuid, jsonb) to authenticated;
grant execute on function public.submit_project_step_progress(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.fetch_pending_project_step_reviews() to authenticated;
grant execute on function public.review_project_step(uuid, uuid, text, boolean, text) to authenticated;
