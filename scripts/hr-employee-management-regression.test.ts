import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canAccessAdminTab
} from '../src/lib/adminPermissions';
import {
  buildEmployeeContractTermsSnapshot,
  employeeContractTermsChanged
} from '../src/lib/hrEmployeeContract';
import { getHrJobTitleAdminAccess } from '../src/lib/hrJobTitleAccess';
import { buildEmployeeContractPdf } from '../src/lib/employeeContractPdf.js';

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
const platformAccessRpcMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610220008_hr_employee_platform_access_rpc.sql', import.meta.url),
  'utf8'
);
const welcomeEmailTrackingMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610220009_hr_employee_welcome_email_tracking.sql', import.meta.url),
  'utf8'
);
const contractEmailTrackingMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610220010_hr_employee_contract_email_tracking.sql', import.meta.url),
  'utf8'
);
const hrSection = fs.readFileSync(new URL('../src/components/HRSection.tsx', import.meta.url), 'utf8');
const appContext = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const emailService = fs.readFileSync(new URL('../src/lib/emailService.ts', import.meta.url), 'utf8');
const emailBackend = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const contractPdfSource = fs.readFileSync(new URL('../src/lib/employeeContractPdf.js', import.meta.url), 'utf8');

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
assert.match(hrSection, /rpc\('hr_update_employee_platform_access'/i);
assert.match(hrSection, /const getErrorMessage = \(error: unknown, fallback: string\)/i);
assert.doesNotMatch(hrSection, /admin_access_level\s*:\s*jobTitle/i);
assert.match(hrSection, /const shouldSendEmployeeEmail = !selectedEmployee\s*\|\|\s*employeeContractTermsChanged/i);
assert.match(hrSection, /if \(shouldSendEmployeeEmail\) \{[\s\S]*?sendProjectEmail\(\{[\s\S]*?type: 'employee_welcome'[\s\S]*?employeeProfileId: targetProfileId[\s\S]*?welcome_email_sent_at/i);
assert.match(hrSection, /follow-up actions need attention/i);
assert.match(hrSection, /Platform access: \$\{getErrorMessage\(platformAccessError/);
assert.match(hrSection, /employeeEmailPurpose: sentEmployeeEmailPurpose/);
assert.match(hrSection, /employment_contract_terms: contractTerms/i);
assert.match(hrSection, /draft contract PDF accepted by the email service/i);
assert.match(welcomeEmailTrackingMigration, /add column if not exists welcome_email_sent_at timestamptz/i);
assert.match(contractEmailTrackingMigration, /add column if not exists employment_contract_sent_at timestamptz/i);
assert.match(contractEmailTrackingMigration, /add column if not exists employment_contract_terms jsonb/i);
assert.match(emailService, /'employee_welcome'/);
assert.match(emailService, /employee_welcome[\s\S]*?requiresAdminSession/i);
assert.match(emailService, /'contract' \| 'contract_update'/);
assert.match(emailService, /!result\.attachmentFilename/i);
assert.match(emailBackend, /Only Super Admins can send employee welcome emails/i);
assert.match(emailBackend, /Your set pay rate is reviewed every two weeks, and revisions are based on your performance/i);
assert.match(emailBackend, /Your job title or compensation settings have changed/i);
assert.match(emailBackend, /payload\.employeeEmailPurpose === 'pay_update'/);
assert.match(emailBackend, /buildEmployeeContractPdf\(\{ employee, profile: employeeProfile \}\)/);
assert.match(emailBackend, /contentType: 'application\/pdf'/);
assert.match(emailBackend, /requestPayload\.attachment = payload\.emailAttachments/i);
assert.match(emailBackend, /contractAttachmentFilename/);
assert.match(emailBackend, /type === 'employee_welcome'[\s\S]*?<!doctype html>[\s\S]*?role="presentation"[\s\S]*?#0B132B[\s\S]*?#00A3E0[\s\S]*?#007AFF/i);
assert.match(emailBackend, /Your set pay rate is reviewed every two weeks, and any revisions are based on your performance/i);
assert.match(emailBackend, /hr_employees\?profile_id=eq\.\$\{encodeURIComponent\(employeeProfileId\)\}/i);
assert.match(emailService, /does not support employee welcome emails/i);
assert.match(emailService, /did not confirm employee email acceptance/i);
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
assert.match(platformAccessRpcMigration, /create or replace function public\.hr_update_employee_platform_access/i);
assert.match(platformAccessRpcMigration, /if not public\.is_admin\(\) then/i);
assert.match(platformAccessRpcMigration, /p_admin_access_level not in \('project_manager', 'reviewer'\)/i);
assert.match(platformAccessRpcMigration, /where id = p_profile_id\s+and role <> 'admin'/i);
assert.match(platformAccessRpcMigration, /grant execute on function public\.hr_update_employee_platform_access\(uuid, text\) to authenticated/i);
assert.match(
  accessMigration,
  /drop trigger if exists protect_profile_platform_access on public\.profiles;[\s\S]*update public\.profiles as profile[\s\S]*from public\.hr_employees as employee[\s\S]*create trigger protect_profile_platform_access/i
);
assert.match(appContext, /hasAdminAccess = role === 'admin'[\s\S]*adminAccessLevel === 'project_manager'[\s\S]*adminAccessLevel === 'reviewer'/i);
assert.match(app, /hasAdminAccess && hasAdminTabAccess/i);

const currentTerms = buildEmployeeContractTermsSnapshot({
  job_title: 'QA Tester',
  compensation_type: 'hourly',
  compensation_rate: 25,
  compensation_currency: 'USD',
  pay_frequency: 'biweekly'
});
assert.equal(employeeContractTermsChanged(currentTerms, { ...currentTerms }), false);
assert.equal(employeeContractTermsChanged(currentTerms, { ...currentTerms, job_title: 'Senior QA Tester' }), true);
assert.equal(employeeContractTermsChanged(currentTerms, { ...currentTerms, compensation_rate: 26 }), true);
const contractPdf = await buildEmployeeContractPdf({
  employee: {
    job_title: 'QA Tester',
    department: 'QA/Testing',
    employment_type: 'full_time',
    employment_status: 'active',
    hire_date: '2026-01-15',
    compensation_type: 'hourly',
    compensation_rate: 25,
    compensation_currency: 'USD',
    pay_frequency: 'biweekly'
  },
  profile: { name: 'Test Employee', email: 'employee@example.com' }
});
assert.ok(contractPdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
assert.ok(contractPdf.length > 1000);
assert.match(contractPdfSource, /DRAFT - FOR LEGAL REVIEW - NOT A SIGNED AGREEMENT/);
assert.match(contractPdfSource, /employee\.compensation_rate/);
assert.match(contractPdfSource, /profile\.email/);

console.log('HR employee management regression checks passed');
