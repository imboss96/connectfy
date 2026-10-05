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
const eligibilitySnapshotMigration = readFileSync(path.resolve('supabase/migrations/202610040005_project_eligibility_snapshot_sync.sql'), 'utf8');
const approvalEmailOutboxMigration = readFileSync(path.resolve('supabase/migrations/202610050002_project_approval_email_outbox.sql'), 'utf8');
const safaricomPayoutMigration = readFileSync(path.resolve('supabase/migrations/202610050003_safaricom_b2c_payouts.sql'), 'utf8');
const applauseStatusSource = readFileSync(path.resolve('src/components/ApplauseStatusSection.tsx'), 'utf8');
const projectParticipantsSource = readFileSync(path.resolve('src/components/ProjectParticipantsSection.tsx'), 'utf8');
const projectSheetSyncSource = readFileSync(path.resolve('src/lib/projectSheetSync.ts'), 'utf8');
const projectOperationsSource = readFileSync(path.resolve('src/components/ProjectOperationsSection.tsx'), 'utf8');

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
