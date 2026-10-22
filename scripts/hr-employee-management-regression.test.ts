import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canAccessAdminTab
} from '../src/lib/adminPermissions';
import { getHrJobTitleAdminAccess } from '../src/lib/hrJobTitleAccess';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/202610220002_hr_employee_management.sql', import.meta.url),
  'utf8'
);
const catalogMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610220004_hr_department_job_title_options.sql', import.meta.url),
  'utf8'
);
const accessMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610220005_hr_job_title_platform_access.sql', import.meta.url),
  'utf8'
);
const hrSection = fs.readFileSync(new URL('../src/components/HRSection.tsx', import.meta.url), 'utf8');
const appContext = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const emailService = fs.readFileSync(new URL('../src/lib/emailService.ts', import.meta.url), 'utf8');
const emailBackend = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

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

assert.match(catalogMigration, /create table if not exists public\.hr_option_catalog/i);
assert.match(catalogMigration, /category in \('department', 'job_title'\)/i);
assert.match(catalogMigration, /create unique index if not exists hr_option_catalog_category_label_idx/i);
assert.match(catalogMigration, /alter table public\.hr_option_catalog enable row level security/i);
assert.match(catalogMigration, /using \(public\.is_admin\(\)\)\s+with check \(public\.is_admin\(\)\)/i);
for (const label of [
  'QA/Testing',
  'Project Management',
  'Finance',
  'Operations',
  'QA Tester',
  'Team Leader',
  'Project Reviewer',
  'Moderator'
]) {
  assert.ok(catalogMigration.includes(label), `Expected seeded HR option ${label}`);
}
assert.match(hrSection, /Manage department and job title options/i);
assert.match(hrSection, /Project Manager titles add Project Manager access/i);
assert.match(hrSection, /<select[^>]*value=\{jobTitle\}/i);
assert.match(hrSection, /<select[^>]*value=\{department\}/i);
assert.match(hrSection, /from\('hr_option_catalog'\)/i);
assert.doesNotMatch(hrSection, /admin_access_level\s*:\s*jobTitle/i);
assert.match(hrSection, /if \(!selectedEmployee\) \{[\s\S]*?sendProjectEmail\(\{[\s\S]*?type: 'employee_welcome'[\s\S]*?employeeProfileId: targetProfileId/i);
assert.match(hrSection, /employee profile was created, but the welcome email could not be sent/i);
assert.match(emailService, /'employee_welcome'/);
assert.match(emailService, /employee_welcome[\s\S]*?requiresAdminSession/i);
assert.match(emailBackend, /Only Super Admins can send employee welcome emails/i);
assert.match(emailBackend, /Your set pay rate is reviewed every two weeks, and revisions are based on your performance/i);
assert.match(emailBackend, /type === 'employee_welcome'[\s\S]*?<!doctype html>[\s\S]*?role="presentation"[\s\S]*?#0B132B[\s\S]*?#00A3E0[\s\S]*?#007AFF/i);
assert.match(emailBackend, /Your set pay rate is reviewed every two weeks, and any revisions are based on your performance/i);
assert.match(emailBackend, /hr_employees\?profile_id=eq\.\$\{encodeURIComponent\(employeeProfileId\)\}/i);
assert.equal(getHrJobTitleAdminAccess('Project Manager'), 'project_manager');
assert.equal(getHrJobTitleAdminAccess('Reviewer'), 'reviewer');
assert.equal(getHrJobTitleAdminAccess('Project Reviewer'), 'reviewer');
assert.equal(getHrJobTitleAdminAccess('HR Manager'), null);
assert.equal(getHrJobTitleAdminAccess('Moderator'), null);
assert.equal(canAccessAdminTab('project_manager', 'step_reviews'), true);
assert.equal(canAccessAdminTab('reviewer', 'step_reviews'), true);
assert.equal(canAccessAdminTab('project_manager', 'payments'), false);
assert.match(accessMigration, /role <> 'admin'[\s\S]*admin_access_level in \('project_manager', 'reviewer'\)/i);
assert.match(accessMigration, /create or replace function public\.can_manage_projects\(\)/i);
assert.match(accessMigration, /create or replace function public\.can_review_submissions\(\)/i);
assert.match(accessMigration, /protect_profile_platform_access/i);
assert.match(accessMigration, /Only a Super Admin can change platform roles or access levels/i);
assert.match(
  accessMigration,
  /drop trigger if exists protect_profile_platform_access on public\.profiles;[\s\S]*update public\.profiles as profile[\s\S]*from public\.hr_employees as employee[\s\S]*create trigger protect_profile_platform_access/i
);
assert.match(appContext, /hasAdminAccess = role === 'admin'[\s\S]*adminAccessLevel === 'project_manager'[\s\S]*adminAccessLevel === 'reviewer'/i);
assert.match(app, /hasAdminAccess && hasAdminTabAccess/i);

console.log('HR employee management regression checks passed');
