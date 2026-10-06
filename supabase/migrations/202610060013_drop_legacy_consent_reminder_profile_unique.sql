-- Remove the legacy one-reminder-per-profile constraint. Reminders are now
-- deduplicated per imported Applause source row instead.
alter table public.project_applause_consent_reminder_email_outbox
  drop constraint if exists project_applause_consent_reminder_ema_project_id_profile_id_key;

alter table public.project_applause_consent_reminder_email_outbox
  drop constraint if exists project_applause_consent_reminder_email_outbox_project_id_profile_id_key;

create unique index if not exists project_applause_consent_reminder_source_uidx
  on public.project_applause_consent_reminder_email_outbox (project_id, source_key);

notify pgrst, 'reload schema';
