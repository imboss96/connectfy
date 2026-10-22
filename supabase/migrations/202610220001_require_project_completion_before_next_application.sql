alter table public.submissions
  add column if not exists resubmission_of uuid references public.submissions(id) on delete set null;

create unique index if not exists submissions_single_resubmission_idx
  on public.submissions (resubmission_of)
  where resubmission_of is not null;

create or replace function public.validate_submission_resubmission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  original_submission record;
begin
  if new.resubmission_of is null then
    return new;
  end if;

  if new.resubmission_of = new.id then
    raise exception 'A submission cannot be a resubmission of itself.'
      using errcode = 'P0001';
  end if;

  select id, tester_id, project_id, kind, status
    into original_submission
    from public.submissions
    where id = new.resubmission_of
    for update;

  if not found then
    raise exception 'The submission to resubmit could not be found.'
      using errcode = 'P0001';
  end if;

  if original_submission.tester_id <> new.tester_id
    or original_submission.project_id <> new.project_id
    or original_submission.kind <> new.kind then
    raise exception 'A resubmission must belong to the same tester, project, and submission type as the original.'
      using errcode = 'P0001';
  end if;

  if original_submission.status not in ('rejected', 'changes_requested') then
    raise exception 'Only rejected submissions or submissions requiring changes can be resubmitted.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_submission_resubmission_before_insert
  on public.submissions;
create trigger validate_submission_resubmission_before_insert
  before insert on public.submissions
  for each row
  execute function public.validate_submission_resubmission();

drop trigger if exists validate_submission_resubmission_before_update
  on public.submissions;
create trigger validate_submission_resubmission_before_update
  before update of resubmission_of, tester_id, project_id on public.submissions
  for each row
  execute function public.validate_submission_resubmission();

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

  if exists (
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

create or replace function public.prevent_tester_application_lock_bypass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.tester_id then
    if new.tester_id is distinct from old.tester_id
      or new.project_id is distinct from old.project_id then
      raise exception 'Testers cannot move an application to another tester or project.'
        using errcode = 'P0001';
    end if;

    if old.status is distinct from 'rejected' and new.status = 'rejected' then
      raise exception 'Only the project owner or an administrator can reject an application.'
        using errcode = 'P0001';
    end if;

    if old.invite_status is distinct from 'declined'
      and new.invite_status = 'declined'
      and (old.status <> 'approved' or old.invite_status <> 'invited') then
      raise exception 'Only an invited tester can decline a project invitation.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_tester_project_completion_before_application_insert
  on public.applications;
drop trigger if exists enforce_tester_project_completion_before_application_update
  on public.applications;
create trigger enforce_tester_project_completion_before_application_insert
  before insert on public.applications
  for each row
  execute function public.enforce_tester_project_application_completion();

drop trigger if exists prevent_tester_application_lock_bypass_before_update
  on public.applications;
create trigger prevent_tester_application_lock_bypass_before_update
  before update on public.applications
  for each row
  execute function public.prevent_tester_application_lock_bypass();

create trigger enforce_tester_project_completion_before_application_update
  before update of project_id, tester_id on public.applications
  for each row
  execute function public.enforce_tester_project_application_completion();
