create or replace function public.next_project_payroll_date(p_today date)
returns date
language sql
immutable
strict
set search_path = public
as $$
  select case
    when extract(day from p_today) < 15
      then date_trunc('month', p_today)::date + 14
    else (date_trunc('month', p_today) + interval '1 month - 1 day')::date
  end;
$$;

create or replace function public.normalize_project_payroll_schedule_date()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  platform_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if new.status = 'scheduled' and new.scheduled_date < platform_today then
    new.scheduled_date := public.next_project_payroll_date(platform_today);
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_project_payroll_schedule_date
  on public.project_payroll_schedule;
create trigger normalize_project_payroll_schedule_date
  before insert or update of scheduled_date, status
  on public.project_payroll_schedule
  for each row
  execute function public.normalize_project_payroll_schedule_date();

create or replace function public.reschedule_missed_project_payroll()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  platform_today date := (now() at time zone 'Africa/Nairobi')::date;
  rescheduled_count integer;
begin
  update public.project_payroll_schedule
  set scheduled_date = public.next_project_payroll_date(platform_today),
      updated_at = now()
  where status = 'scheduled'
    and scheduled_date < platform_today;

  get diagnostics rescheduled_count = row_count;
  return rescheduled_count;
end;
$$;

revoke all on function public.next_project_payroll_date(date) from public, anon, authenticated;
revoke all on function public.normalize_project_payroll_schedule_date() from public, anon, authenticated;
revoke all on function public.reschedule_missed_project_payroll() from public, anon, authenticated;
grant execute on function public.next_project_payroll_date(date) to service_role;
grant execute on function public.reschedule_missed_project_payroll() to service_role;

select public.reschedule_missed_project_payroll();

create extension if not exists pg_cron;

select cron.schedule(
  'reschedule-missed-project-payroll',
  '5 21 * * *',
  'select public.reschedule_missed_project_payroll();'
);

notify pgrst, 'reload schema';
