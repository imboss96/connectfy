alter table public.hr_employees
  add column if not exists welcome_email_sent_at timestamptz;

notify pgrst, 'reload schema';
