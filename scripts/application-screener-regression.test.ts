import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isEligibleApplauseUtestId } from '../src/lib/applicationScreener';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/202610170003_queue_application_screeners.sql', import.meta.url),
  'utf8'
);
const hiringConsentMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610170004_apply_organization_hiring_consent.sql', import.meta.url),
  'utf8'
);
const reconciliationMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610170006_reconcile_confirmed_screener.sql', import.meta.url),
  'utf8'
);
const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const submissionsSource = fs.readFileSync(
  new URL('../src/components/ApplicationScreenerSubmissions.tsx', import.meta.url),
  'utf8'
);
const projectBoardSource = fs.readFileSync(
  new URL('../src/components/ProjectBoard.tsx', import.meta.url),
  'utf8'
);
const setupSource = fs.readFileSync(new URL('../BACKEND_SETUP.md', import.meta.url), 'utf8');
const pythonSubmitterSource = fs.readFileSync(new URL('../submit_google_form.py', import.meta.url), 'utf8');

assert.equal(isEligibleApplauseUtestId('3000001'), true, 'the lower uTest ID boundary is eligible');
assert.equal(isEligibleApplauseUtestId('4000001'), true, 'the upper uTest ID boundary is eligible');
assert.equal(isEligibleApplauseUtestId('3000000'), false, 'IDs below the range are not eligible');
assert.equal(isEligibleApplauseUtestId('4000002'), false, 'IDs above the range are not eligible');
assert.equal(isEligibleApplauseUtestId('3000001x'), false, 'uTest IDs must contain digits only');

assert.match(migration, /new\.screener_consent is true/);
assert.match(migration, /new\.screener_consent_at is not null/);
assert.match(migration, /insert into public\.application_screener_outbox/);
assert.match(migration, /for update skip locked/);
assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/);
assert.match(migration, /Application screener submission status is managed by the backend/);
assert.match(migration, /where public\.application_screener_outbox\.status = 'failed'/);
assert.match(migration, /status = 'ambiguous'/);
assert.match(migration, /retry_after <= now\(\)/);
assert.match(migration, /add column if not exists retry_after timestamptz/i);
assert.match(migration, /drop constraint if exists application_screener_outbox_status_check/i);
assert.match(migration, /approval_failed', 'submitted', 'failed', 'ambiguous'/);
assert.match(migration, /order by application\.applied_at desc\s+limit 1/i);

assert.match(serverSource, /const applicationScreenerWorkerEnabled = Boolean\(supabaseServiceUrl && supabaseServiceRoleKey && hasEmailProvider\(\)\)/);
assert.match(serverSource, /claim_application_screener_submission/);
assert.match(serverSource, /complete_application_screener_submission/);
assert.match(serverSource, /approve_application_after_screener/);
assert.match(serverSource, /reconcile_confirmed_application_screener/);
assert.match(serverSource, /requireAdmin\(authorization\)/);
assert.match(serverSource, /Application screener queue worker enabled/);
assert.match(serverSource, /reconcile the form before retrying/i);
assert.match(serverSource, /screener_consent === true/);
assert.match(serverSource, /res\.status\(410\)/);

assert.match(submissionsSource, /Queued for automatic submission/);
assert.match(submissionsSource, /setInterval\(\(\) => void loadSubmissions\(false\), 10000\)/);
assert.match(submissionsSource, /Google confirmed; application approved/);
assert.match(submissionsSource, /An admin can send the invitation manually/);
assert.match(submissionsSource, /I verified the sheet response/);
assert.match(submissionsSource, /reconcile-application-screener/);
assert.doesNotMatch(submissionsSource, /Submit screener/);
assert.match(setupSource, /202610170003_queue_application_screeners\.sql/);
assert.match(setupSource, /202610170004_apply_organization_hiring_consent\.sql/);
assert.match(hiringConsentMigration, /application\.status = 'pending'/);
assert.match(hiringConsentMigration, /application\.tester_id = new\.tester_id/);
assert.match(hiringConsentMigration, /screener_consent_source := 'organization_hiring_agreement'/);
assert.match(hiringConsentMigration, /before insert or update on public\.application_utest_details/);
assert.match(hiringConsentMigration, /update public\.application_utest_details[\s\S]*?application\.status = 'pending'/);
assert.match(reconciliationMigration, /outbox_status is distinct from 'ambiguous'/);
assert.match(reconciliationMigration, /screener_submission_status = 'submitted'/);
assert.match(reconciliationMigration, /status = 'approved'/);
assert.match(reconciliationMigration, /reconcile_confirmed_application_screener[\s\S]*?to service_role/);

assert.match(projectBoardSource, /screenerConsent: true/);
assert.match(projectBoardSource, /isEligibleApplauseUtestId\(applicationDraft\.testerId\)/);
assert.match(projectBoardSource, /uses your prior hiring authorization/);
assert.match(projectBoardSource, /automatically sends your saved application details and screener answers to Applause/);
assert.doesNotMatch(projectBoardSource, /Confirm Applause screener consent/);
assert.match(serverSource, /isEligibleApplauseUtestId\(details\.utest_id\)/);
assert.match(pythonSubmitterSource, /3000001 <= int\(normalized_id\) <= 4000001/);

console.log('application screener regression checks passed');
