import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canAccessAdminTab
} from '../src/lib/adminPermissions';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/202610220002_hr_employee_management.sql', import.meta.url),
  'utf8'
);

assert.equal(canAccessAdminTab('super_admin', 'hr'), true);
assert.equal(canAccessAdminTab('project_manager', 'hr'), false);
assert.equal(canAccessAdminTab('reviewer', 'hr'), false);

for (const table of [
  'hr_employees',
  'hr_onboarding_tasks',
  'hr_attendance_records',
  'hr_leave_requests',
  'hr_payroll_records',
  'hr_performance_reviews'
]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
}

assert.match(migration, /profile_id = auth\.uid\(\)/i);
assert.match(migration, /create policy hr_leave_create_self/i);
assert.match(migration, /status = 'pending'/i);
assert.match(migration, /create or replace function public\.hr_clock_in\(\)/i);
assert.match(migration, /create or replace function public\.hr_clock_out\(\)/i);
assert.match(migration, /create or replace function public\.hr_complete_onboarding_task/i);
assert.match(migration, /hr_attendance_one_open_clock_per_employee_idx/i);
assert.match(migration, /public\.is_admin\(\)/i);
assert.doesNotMatch(migration, /create_payout_request|mpesa|paypal/i);

console.log('HR employee management regression checks passed');
