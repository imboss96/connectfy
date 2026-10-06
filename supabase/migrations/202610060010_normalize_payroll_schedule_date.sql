-- Older deployments may have stored this optional date as text, including ''.
-- Normalize blank values to NULL and enforce the date type expected by payroll sync.
alter table public.project_operations_settings
  alter column payroll_scheduled_date type date
  using nullif(trim(payroll_scheduled_date::text), '')::date;

notify pgrst, 'reload schema';
