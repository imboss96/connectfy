import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const crmSource = readFileSync(path.resolve('src/components/CRMSection.tsx'), 'utf8');
const migrationSource = readFileSync(path.resolve('supabase/migrations/202609240001_admin_invite_function.sql'), 'utf8');
const adminDismissalMigration = readFileSync(path.resolve('supabase/migrations/202610030003_admin_dismissal_function.sql'), 'utf8');
const applauseStatusMigration = readFileSync(path.resolve('supabase/migrations/202610040001_applause_project_status.sql'), 'utf8');
const applauseStatusDeleteGuardMigration = readFileSync(path.resolve('supabase/migrations/202610040002_applause_status_sync_delete_guard.sql'), 'utf8');
const applauseStatusTruncateMigration = readFileSync(path.resolve('supabase/migrations/202610040003_applause_status_sync_truncate.sql'), 'utf8');
const projectOperationsMigration = readFileSync(path.resolve('supabase/migrations/202610040004_project_scoped_operations_payroll.sql'), 'utf8');
const payrollScheduleDateReconciliationMigration = readFileSync(path.resolve('supabase/migrations/202610250001_reconcile_payroll_schedule_date.sql'), 'utf8');
const missedPayrollMigration = readFileSync(path.resolve('supabase/migrations/202610160001_reschedule_missed_payroll.sql'), 'utf8');
const matchedPayrollMigration = readFileSync(path.resolve('supabase/migrations/202610160002_match_applause_payroll_profiles.sql'), 'utf8');
const payrollAmountReconciliationMigration = readFileSync(path.resolve('supabase/migrations/202610160003_reconcile_scheduled_payroll_amounts.sql'), 'utf8');
const eligibilitySnapshotMigration = readFileSync(path.resolve('supabase/migrations/202610040005_project_eligibility_snapshot_sync.sql'), 'utf8');
const approvalEmailOutboxMigration = readFileSync(path.resolve('supabase/migrations/202610050002_project_approval_email_outbox.sql'), 'utf8');
const safaricomPayoutMigration = readFileSync(path.resolve('supabase/migrations/202610050003_safaricom_b2c_payouts.sql'), 'utf8');
const projectStepProgressMigration = readFileSync(path.resolve('supabase/migrations/202610130001_project_step_progress.sql'), 'utf8');
const tieredAdminAccessMigration = readFileSync(path.resolve('supabase/migrations/202610140001_tiered_admin_access.sql'), 'utf8');
const projectManagerCrmMigration = readFileSync(path.resolve('supabase/migrations/202610140002_project_manager_crm_read_access.sql'), 'utf8');
const adminPermissionsSource = readFileSync(path.resolve('src/lib/adminPermissions.ts'), 'utf8');
const projectStepProgressSource = readFileSync(path.resolve('src/lib/projectStepProgress.ts'), 'utf8');
const applauseStatusSource = readFileSync(path.resolve('src/components/ApplauseStatusSection.tsx'), 'utf8');
const projectParticipantsSource = readFileSync(path.resolve('src/components/ProjectParticipantsSection.tsx'), 'utf8');
const projectSheetSyncSource = readFileSync(path.resolve('src/lib/projectSheetSync.ts'), 'utf8');
const projectOperationsSource = readFileSync(path.resolve('src/components/ProjectOperationsSection.tsx'), 'utf8');
const appContextSource = readFileSync(path.resolve('src/context/AppContext.tsx'), 'utf8');

assert.ok(
  !crmSource.includes('last_sign_in_at'),
  'CRM profile query must not request a last_sign_in_at column that does not exist in the current profiles schema.'
);

assert.ok(
  migrationSource.includes('grant execute on function public.invite_user_as_admin'),
  'Admin invite SQL must grant execution access to authenticated users.'
);

assert.ok(
  adminDismissalMigration.includes('grant execute on function public.dismiss_admin(uuid) to authenticated'),
  'Admin dismissal SQL must grant execution access to authenticated users.'
);
assert.ok(adminDismissalMigration.includes('p_user_id = auth.uid()'), 'Admins must not be able to remove their own admin access.');
assert.ok(adminDismissalMigration.includes('remaining_admin_count = 0'), 'The last admin must not be removable.');
assert.ok(crmSource.includes("supabase.rpc('dismiss_admin'"), 'The CRM must call the admin dismissal function.');
assert.ok(crmSource.includes('Remove admin access'), 'The CRM must expose admin dismissal on admin member records.');
assert.match(tieredAdminAccessMigration, /set admin_access_level = 'super_admin'\s+where role = 'admin'\s+and admin_access_level is null/i, 'Existing administrators must retain super-admin access after migration.');
assert.match(tieredAdminAccessMigration, /admin_access_level = 'super_admin'\s*\)/i, 'Super-admin checks must use the persisted access level.');
assert.ok(tieredAdminAccessMigration.includes('public.can_manage_projects()'), 'Project managers must have explicit project-management policies.');
assert.ok(tieredAdminAccessMigration.includes('public.can_review_submissions()'), 'Submission reviewers must have explicit review policies.');
assert.ok(tieredAdminAccessMigration.includes('Only super admins can invite administrators'), 'Only super admins may grant administrator access.');
assert.ok(tieredAdminAccessMigration.includes("p_access_level not in ('super_admin', 'project_manager', 'reviewer')"), 'Admin invitations must validate the requested access level.');
assert.ok(crmSource.includes('p_access_level: inviteAccessLevel'), 'The CRM must pass the selected admin tier to the database.');
assert.match(adminPermissionsSource, /project_manager: new Set\([\s\S]*?'crm'/, 'Project Managers must be able to access the CRM tab.');
assert.ok(crmSource.includes('const isSuperAdmin = adminAccessLevel === \'super_admin\''), 'CRM mutation controls must be limited to Super Admins.');
assert.ok(projectManagerCrmMigration.includes('project managers view Applause statuses'), 'Project Managers must be able to read saved Applause participant records.');
assert.ok(projectManagerCrmMigration.includes('project managers view legacy sheet responses'), 'Project Managers must be able to read saved eligibility responses.');
assert.ok(projectManagerCrmMigration.includes('project managers view legacy email logs'), 'Project Managers must be able to read CRM email history.');

assert.ok(applauseStatusMigration.includes('alter table public.applause_project_status enable row level security'), 'Applause status rows must have RLS enabled.');
assert.ok(applauseStatusMigration.includes('using (public.is_admin())'), 'Only admins may read Applause status rows.');
assert.ok(applauseStatusMigration.includes('if not coalesce(public.is_admin(), false)'), 'Only admins may sync Applause status rows.');
assert.match(applauseStatusMigration, /delete from public\.applause_project_status\s+where source_key <> ''/i, 'The sync must use an explicit WHERE clause when replacing the saved snapshot.');
assert.match(applauseStatusDeleteGuardMigration, /delete from public\.applause_project_status\s+where source_key <> ''/i, 'The repair migration must replace unqualified deletes with a guarded snapshot delete.');
assert.match(applauseStatusTruncateMigration, /truncate table public\.applause_project_status/i, 'The latest sync migration must avoid DELETE safe-update rejection when replacing the snapshot.');
assert.ok(projectOperationsMigration.includes('project_id uuid not null references public.projects(id)'), 'Project Applause status records must be scoped to a project.');
assert.ok(projectOperationsMigration.includes('create table public.project_payroll_schedule'), 'Project completion payroll must be stored in the database.');
assert.ok(projectOperationsMigration.includes('lower(trim(source.status)) = \'claimed complete\''), 'Payroll schedules must be generated only for completed participants.');
assert.ok(projectOperationsMigration.includes('payout_amount') && projectOperationsMigration.includes('payout_date'), 'Payroll schedules must use the configured project amount and pay date.');
assert.match(payrollScheduleDateReconciliationMigration, /alter column payroll_scheduled_date type date\s+using nullif\(trim\(payroll_scheduled_date::text\), ''\)::date/i, 'The latest repair migration must convert empty legacy payroll dates to NULL before the sync RPC reads them.');
assert.match(missedPayrollMigration, /public\.next_project_payroll_date\(platform_today\)/, 'Missed payroll must roll to the upcoming semi-monthly pay date.');
assert.match(missedPayrollMigration, /scheduled_date < platform_today/, 'Only unpaid schedules past their date must be moved.');
assert.match(missedPayrollMigration, /now\(\) at time zone 'Africa\/Nairobi'/, 'Payroll rescheduling must use the platform calendar.');
assert.match(missedPayrollMigration, /cron\.schedule\([\s\S]*?'5 21 \* \* \*'/, 'Overdue payroll must be rescheduled shortly after midnight in Nairobi.');
assert.match(matchedPayrollMigration, /project_id, source_key, profile_id, tester_id, tester_email/, 'Applause payroll entries must include the matched Connectfy tester profile.');
assert.match(matchedPayrollMigration, /cross join lateral \([\s\S]*?profile\.role = 'tester'/, 'Only sheet rows matched to tester profiles may create payroll entries.');
assert.match(matchedPayrollMigration, /profile\.profile_data #>> '\{testerProfile,uTestId\}'/, 'Applause payroll matching must support the stored uTest ID.');
assert.match(payrollAmountReconciliationMigration, /schedule\.status = 'scheduled'/, 'Payroll amount reconciliation must only change unpaid scheduled entries.');
assert.match(payrollAmountReconciliationMigration, /set amount = settings\.payroll_amount/, 'Active schedule amounts must match the configured per-participant rate.');
assert.ok(eligibilitySnapshotMigration.includes('public.sync_project_eligibility_responses'), 'Eligibility sheet sync must use a database RPC.');
assert.ok(eligibilitySnapshotMigration.includes('if not coalesce(public.is_admin(), false)'), 'Only admins may replace project eligibility snapshots.');
assert.match(eligibilitySnapshotMigration, /delete from public\.legacy_sheet_responses\s+where project_id = p_project_id/i, 'Eligibility snapshot replacement must be scoped to the selected project.');
assert.ok(eligibilitySnapshotMigration.includes('grant execute on function public.sync_project_eligibility_responses(uuid, jsonb) to authenticated'), 'Authenticated admins must be able to invoke the eligibility snapshot sync.');
assert.ok(approvalEmailOutboxMigration.includes('create table public.project_email_outbox'), 'Project approval emails must be durably queued in the database.');
assert.ok(approvalEmailOutboxMigration.includes('after insert or update of status on public.applications'), 'The database must queue email in the transaction that approves an application.');
assert.ok(approvalEmailOutboxMigration.includes('public.guard_project_application_approval'), 'Only an admin or project owner may approve an application.');
assert.ok(approvalEmailOutboxMigration.includes('for update skip locked'), 'Concurrent workers must claim distinct outbox items.');
assert.ok(approvalEmailOutboxMigration.includes('attempt_count >= 8'), 'The outbox must stop retrying after its maximum attempts.');
assert.ok(approvalEmailOutboxMigration.includes('grant execute on function public.claim_project_email_outbox() to service_role'), 'Only the server-side worker role may claim email outbox jobs.');
assert.ok(safaricomPayoutMigration.includes('create_payout_request'), 'Payout requests must be created through the server-only balance-checking RPC.');
assert.ok(safaricomPayoutMigration.includes('grant execute on function public.create_payout_request'), 'Only the service role may create payout requests.');
assert.ok(safaricomPayoutMigration.includes('approved_kes_amount'), 'Safaricom amount approval must be auditable.');
assert.ok(safaricomPayoutMigration.includes('safaricom_conversation_id'), 'Safaricom request IDs must be stored for callback reconciliation.');
assert.ok(safaricomPayoutMigration.includes('revoke insert, update, delete on public.payout_requests from anon, authenticated'), 'Browser clients must not directly create or alter payout requests.');
assert.ok(projectStepProgressMigration.includes('create table public.project_step_progress'), 'Project checklist progress must be stored in the database.');
assert.ok(projectStepProgressMigration.includes('alter table public.project_step_progress enable row level security'), 'Project checklist progress must have RLS enabled.');
assert.ok(projectStepProgressMigration.includes("a.tester_id = auth.uid()"), 'Testers may only create progress for projects where they have an application.');
assert.ok(projectStepProgressSource.includes(".upsert("), 'Project checklist changes must be persisted with an upsert.');
assert.match(appContextSource, /\.from\('profiles'\)\s*\.update\(/, 'Authenticated profile saves must update the existing signup-created profile, not require insert permission.');
assert.match(appContextSource, /\.eq\('id', user\.id\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/, 'Profile saves must be scoped to the current user and report missing profile rows.');
assert.doesNotMatch(appContextSource, /\.from\('profiles'\)\s*\.upsert\(/, 'Profile saving must not use an upsert that requires an insert RLS policy.');
assert.ok(projectParticipantsSource.includes("refresh(false)"), 'Opening the project participant view must load the saved database snapshot without syncing the sheet.');
assert.ok(projectParticipantsSource.includes("supabase.rpc('sync_project_eligibility_responses'"), 'Project participant sheet refreshes must persist through the snapshot RPC.');
assert.ok(projectSheetSyncSource.includes('source_timestamp: read(cells, columns.timestamp)'), 'Eligibility sheet timestamps must be persisted with the response rows.');
assert.ok(projectSheetSyncSource.includes('saved database snapshot was left unchanged.'), 'Empty sheet imports must preserve the prior saved snapshot.');
assert.ok(crmSource.includes('Sync sheets now'), 'The global CRM must provide an explicit sheet sync action.');
assert.ok(crmSource.includes('Reload saved data'), 'The global CRM must provide a database-only reload action.');
assert.ok(crmSource.includes("supabase.rpc('sync_project_applause_status'"), 'Global participant sync must persist Applause sheet snapshots through the project RPC.');
assert.ok(projectOperationsSource.includes('Project integrations & payroll'), 'Project operations must expose per-project settings.');
assert.ok(projectOperationsSource.includes('Project payroll schedule'), 'Project operations must show scheduled payroll.');
assert.ok(applauseStatusSource.includes("normalizedStatus === 'claimed complete'"), 'Completed must match the claimed-complete sheet status.');
assert.ok(applauseStatusSource.includes("normalizedStatus === 'ready for settings check'"), 'Ready for settings must match the sheet status.');
assert.ok(applauseStatusSource.includes("normalizedStatus === 'in progress'"), 'In Progress must match the sheet status.');
assert.ok(applauseStatusSource.includes("normalizedStatus === 'consent form sent'"), 'Consent sent must match the sheet status.');
assert.ok(applauseStatusSource.includes("normalizedStatus === ''"), 'Consent not sent must include rows with a blank Status.');
assert.ok(applauseStatusSource.includes("{ id: 'issues', label: 'Issues' }"), 'The completion tracker must expose an Issues tab.');
assert.ok(applauseStatusSource.includes("consentName === 'name mismatch'"), 'The Issues tab must include consent-name mismatches.');
assert.ok(applauseStatusSource.includes("['needs review', 'expired', 'failed'].includes(idScanStatus)"), 'The Issues tab must include the requested ID scan statuses.');
assert.ok(applauseStatusSource.includes("'sync_project_applause_status'"), 'The status view must persist rows through the project-scoped secured sync function.');
assert.ok(applauseStatusSource.includes('{ p_project_id: projectId, p_rows: importedRows }'), 'The status sync request must specify its project.');

console.log('supabase schema regression checks passed');
