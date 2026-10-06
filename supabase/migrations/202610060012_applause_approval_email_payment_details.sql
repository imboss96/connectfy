alter table public.project_applause_approval_email_outbox
  add column if not exists expected_payment_date date;

update public.project_applause_approval_email_outbox as email
set approved_amount = coalesce(
      (
        select schedule.amount
        from public.project_payroll_schedule as schedule
        where schedule.project_id = email.project_id
          and schedule.source_key = email.source_key
      ),
      (
        select settings.payroll_amount
        from public.project_operations_settings as settings
        where settings.project_id = email.project_id
      ),
      0
    ),
    expected_payment_date = coalesce(
      (
        select schedule.scheduled_date
        from public.project_payroll_schedule as schedule
        where schedule.project_id = email.project_id
          and schedule.source_key = email.source_key
      ),
      (
        select settings.payroll_scheduled_date
        from public.project_operations_settings as settings
        where settings.project_id = email.project_id
      )
    );

create or replace function public.set_applause_approval_email_payment_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select
    coalesce(schedule.amount, settings.payroll_amount, 0),
    coalesce(schedule.scheduled_date, settings.payroll_scheduled_date)
    into new.approved_amount, new.expected_payment_date
    from (select 1) as seed
    left join public.project_payroll_schedule as schedule
      on schedule.project_id = new.project_id
      and schedule.source_key = new.source_key
    left join public.project_operations_settings as settings
      on settings.project_id = new.project_id;

  return new;
end;
$$;

drop trigger if exists project_applause_approval_email_amount
  on public.project_applause_approval_email_outbox;
drop trigger if exists project_applause_approval_email_payment_details
  on public.project_applause_approval_email_outbox;
create trigger project_applause_approval_email_payment_details
  before insert on public.project_applause_approval_email_outbox
  for each row
  execute function public.set_applause_approval_email_payment_details();

notify pgrst, 'reload schema';
