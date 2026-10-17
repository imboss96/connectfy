alter table public.application_utest_details
  add column if not exists gmail_email text not null default '',
  add column if not exists gender text not null default '',
  add column if not exists gender_other text not null default '',
  add column if not exists fluent_languages text[] not null default '{}',
  add column if not exists language_other text not null default '',
  add column if not exists recording_space_available boolean,
  add column if not exists screener_device_type text not null default '',
  add column if not exists screener_device_other text not null default '',
  add column if not exists screener_os_version text not null default '',
  add column if not exists screener_consent boolean not null default false,
  add column if not exists screener_consent_at timestamptz,
  add column if not exists screener_submission_status text not null default 'not_started',
  add column if not exists screener_submitted_at timestamptz;

alter table public.application_utest_details
  add constraint application_utest_details_screener_status_check
  check (screener_submission_status in ('not_started', 'pending', 'submitted', 'failed'));
