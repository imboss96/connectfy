alter table public.project_operations_settings
  alter column payroll_scheduled_date type date
  using nullif(trim(payroll_scheduled_date::text), '')::date;

notify pgrst, 'reload schema';
