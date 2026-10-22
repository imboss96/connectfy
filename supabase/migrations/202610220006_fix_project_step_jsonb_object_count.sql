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

  select count(*) into status_key_count
  from jsonb_object_keys(p_statuses);
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

revoke all on function public.submit_project_step_progress(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_project_step_progress(uuid, jsonb, jsonb) to authenticated;
