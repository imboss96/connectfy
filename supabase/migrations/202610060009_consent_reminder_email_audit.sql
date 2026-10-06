alter table public.project_applause_consent_reminder_email_outbox
  add column if not exists queued_by uuid references public.profiles(id) on delete set null;

drop trigger if exists project_applause_queue_consent_pending_reminder on public.project_applause_status;
drop function if exists public.queue_applause_consent_pending_reminder();

create or replace function public.set_applause_consent_reminder_queued_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and tg_op = 'INSERT' then
    new.queued_by := auth.uid();
  elsif auth.uid() is not null
    and new.status = 'pending'
    and old.status in ('sent', 'failed') then
    new.queued_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists project_applause_consent_reminder_queued_by on public.project_applause_consent_reminder_email_outbox;
create trigger project_applause_consent_reminder_queued_by
  before insert or update on public.project_applause_consent_reminder_email_outbox
  for each row
  execute function public.set_applause_consent_reminder_queued_by();

notify pgrst, 'reload schema';
