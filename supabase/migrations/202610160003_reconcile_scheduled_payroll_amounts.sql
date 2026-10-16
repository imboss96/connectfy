update public.project_payroll_schedule as schedule
set amount = settings.payroll_amount,
    updated_at = now()
from public.project_operations_settings as settings
where settings.project_id = schedule.project_id
  and schedule.status = 'scheduled'
  and settings.payroll_amount > 0
  and schedule.amount is distinct from settings.payroll_amount;

notify pgrst, 'reload schema';
