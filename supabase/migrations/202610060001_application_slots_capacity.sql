create or replace function public.guard_project_application_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_capacity integer;
  submitted_count integer;
begin
  if exists (
    select 1
    from public.applications
    where project_id = new.project_id
      and tester_id = new.tester_id
  ) then
    return new;
  end if;

  select slots_total
    into slot_capacity
    from public.projects
    where id = new.project_id
    for update;

  if not found then
    raise exception 'The selected project does not exist';
  end if;

  select count(*)::integer
    into submitted_count
    from public.applications
    where project_id = new.project_id;

  if submitted_count >= slot_capacity then
    raise exception 'This project has no remaining slots';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_guard_project_capacity on public.applications;
create trigger applications_guard_project_capacity
  before insert on public.applications
  for each row
  execute function public.guard_project_application_capacity();

create or replace function public.sync_project_application_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_project_id uuid;
  submitted_count integer;
begin
  affected_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;

  perform 1
    from public.projects
    where id = affected_project_id
    for update;

  select count(*)::integer
    into submitted_count
    from public.applications
    where project_id = affected_project_id;

  update public.projects
    set slots_filled = submitted_count,
        status = case
          when submitted_count >= slots_total then 'closed'
          else status
        end,
        updated_at = now()
    where id = affected_project_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_sync_project_slots on public.applications;
create trigger applications_sync_project_slots
  after insert or delete on public.applications
  for each row
  execute function public.sync_project_application_slots();

create or replace function public.reopen_project_after_slot_increase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slots_total <= new.slots_filled then
    update public.projects
      set status = 'closed',
          updated_at = now()
      where id = new.id
        and status <> 'closed';
  elsif new.slots_total > old.slots_total
    and old.slots_filled >= old.slots_total
    and new.status = 'closed' then
    update public.projects
      set status = 'active',
          updated_at = now()
      where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_reopen_after_slot_increase on public.projects;
create trigger projects_reopen_after_slot_increase
  after update of slots_total on public.projects
  for each row
  execute function public.reopen_project_after_slot_increase();

update public.projects as project
set slots_filled = (
      select count(*)::integer
      from public.applications as application
      where application.project_id = project.id
    ),
    status = case
      when (
        select count(*)
        from public.applications as application
        where application.project_id = project.id
      ) >= project.slots_total then 'closed'
      else project.status
    end,
    updated_at = now();
