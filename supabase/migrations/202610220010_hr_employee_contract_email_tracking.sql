alter table public.hr_employees
  add column if not exists employment_contract_sent_at timestamptz,
  add column if not exists employment_contract_terms jsonb;
