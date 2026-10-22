alter table public.project_step_progress
  drop constraint if exists project_step_progress_statuses_object;

update public.project_step_progress
set statuses = (
  select jsonb_object_agg(
    entry.key,
    case
      when entry.value = '"done"'::jsonb then '"submitted"'::jsonb
      when entry.value = '"failed"'::jsonb then '"pending"'::jsonb
      else entry.value
    end
  )
  from jsonb_each(statuses) as entry
);

alter table public.project_step_progress
  add constraint project_step_progress_statuses_object check (
    jsonb_typeof(statuses) = 'object'
    and statuses ?& array['slack', 'consent', 'languageSettings', 'recordings']
    and statuses->>'slack' in ('pending', 'submitted', 'done', 'failed')
    and statuses->>'consent' in ('pending', 'submitted', 'done', 'failed')
    and statuses->>'languageSettings' in ('pending', 'submitted', 'done', 'failed')
    and statuses->>'recordings' in ('pending', 'submitted', 'done', 'failed')
  );

drop policy if exists "testers create their project step progress" on public.project_step_progress;
drop policy if exists "testers update their project step progress" on public.project_step_progress;
drop policy if exists project_step_progress_read_for_reviewers on public.project_step_progress;

create policy project_step_progress_read_for_reviewers
  on public.project_step_progress for select to authenticated
  using (public.can_review_submissions());

revoke insert, update, delete on public.project_step_progress from anon, authenticated;
revoke insert, update, delete on public.project_step_progress from public;
grant select on public.project_step_progress to authenticated;

create table if not exists public.project_step_review_history (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete cascade,
  step_id text not null check (step_id in ('slack', 'consent', 'languageSettings', 'recordings')),
  decision text not null check (decision in ('approved', 'changes_requested')),
  note text not null default '',
  reviewed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists project_step_review_history_tester_idx
  on public.project_step_review_history (project_id, tester_id, step_id, created_at desc);

alter table public.project_step_review_history enable row level security;

drop policy if exists project_step_review_history_read_self_or_reviewer
  on public.project_step_review_history;
create policy project_step_review_history_read_self_or_reviewer
  on public.project_step_review_history for select to authenticated
  using (tester_id = auth.uid() or public.can_review_submissions());

revoke insert, update, delete on public.project_step_review_history from anon, authenticated;
revoke insert, update, delete on public.project_step_review_history from public;
grant select on public.project_step_review_history to authenticated;

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
  step_id text;
  old_status text;
  new_status text;
  step_index integer;
  preceding_step text;
  step_ids text[] := array['slack', 'consent', 'languageSettings', 'recordings'];
  changes_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to submit project steps for review.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_statuses) <> 'object'
    or jsonb_object_length(p_statuses) <> 4
    or jsonb_typeof(p_evidence) <> 'array'
    or not (p_statuses ?& step_ids) then
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

  for step_id in select unnest(step_ids)
  loop
    old_status := coalesce(saved_statuses->>step_id, 'pending');
    new_status := p_statuses->>step_id;

    if new_status not in ('pending', 'submitted', 'done', 'failed') then
      raise exception 'Project step status is invalid.'
        using errcode = '22023';
    end if;

    if new_status is distinct from old_status then
      if old_status not in ('pending', 'failed') or new_status <> 'submitted' then
        raise exception 'Only an unapproved step can be submitted for review.'
          using errcode = '42501';
      end if;

      changes_count := changes_count + 1;
      step_index := array_position(step_ids, step_id);
      if step_index > 1 then
        preceding_step := step_ids[step_index - 1];
        if saved_statuses->>preceding_step is distinct from 'done' then
          raise exception 'The previous project step must be approved before submitting this step.'
            using errcode = 'P0001';
        end if;
      end if;
    end if;
  end loop;

  if changes_count > 1 then
    raise exception 'Submit one project step at a time and wait for its approval.'
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

create or replace function public.fetch_pending_project_step_reviews()
returns table (
  project_id uuid,
  tester_id uuid,
  project_title text,
  tester_name text,
  tester_email text,
  step_id text,
  updated_at timestamptz,
  latest_note text
)
language plpgsql
security definer
set search_path = public
as $$
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
    latest_review.note
  from public.project_step_progress as progress
  join public.projects as project on project.id = progress.project_id
  join public.profiles as profile on profile.id = progress.tester_id
  cross join lateral unnest(array['slack', 'consent', 'languageSettings', 'recordings']) as steps(step_id)
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
    and (
      steps.step_id = 'slack'
      or (steps.step_id = 'consent' and progress.statuses->>'slack' = 'done')
      or (steps.step_id = 'languageSettings' and progress.statuses->>'consent' = 'done')
      or (steps.step_id = 'recordings' and progress.statuses->>'languageSettings' = 'done')
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

  if p_approved and step_index > 1
    and saved_statuses->>step_ids[step_index - 1] is distinct from 'done' then
    raise exception 'Approve the preceding step before reviewing this step.'
      using errcode = 'P0001';
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

revoke all on function public.submit_project_step_progress(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.fetch_pending_project_step_reviews() from public, anon;
revoke all on function public.review_project_step(uuid, uuid, text, boolean, text) from public, anon;
grant execute on function public.submit_project_step_progress(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.fetch_pending_project_step_reviews() to authenticated;
grant execute on function public.review_project_step(uuid, uuid, text, boolean, text) to authenticated;
