import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/202610170003_queue_application_screeners.sql', import.meta.url),
  'utf8'
);
const hiringConsentMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610170004_apply_organization_hiring_consent.sql', import.meta.url),
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

assert.match(serverSource, /const applicationScreenerWorkerEnabled = outboxWorkerEnabled/);
assert.match(serverSource, /claim_application_screener_submission/);
assert.match(serverSource, /complete_application_screener_submission/);
assert.match(serverSource, /approve_application_after_screener/);
assert.match(serverSource, /Application screener queue worker enabled/);
assert.match(serverSource, /reconcile the form before retrying/i);
assert.match(serverSource, /screener_consent === true/);
assert.match(serverSource, /res\.status\(410\)/);

assert.match(submissionsSource, /Queued for automatic submission/);
assert.match(submissionsSource, /setInterval\(\(\) => void loadSubmissions\(false\), 10000\)/);
assert.match(submissionsSource, /Google confirmed; application approved and invitation queued/);
assert.doesNotMatch(submissionsSource, /Submit screener/);
assert.match(setupSource, /202610170003_queue_application_screeners\.sql/);
assert.match(setupSource, /202610170004_apply_organization_hiring_consent\.sql/);
assert.match(hiringConsentMigration, /application\.status = 'pending'/);
assert.match(hiringConsentMigration, /application\.tester_id = new\.tester_id/);
assert.match(hiringConsentMigration, /screener_consent_source := 'organization_hiring_agreement'/);
assert.match(hiringConsentMigration, /before insert or update on public\.application_utest_details/);
assert.match(hiringConsentMigration, /update public\.application_utest_details[\s\S]*?application\.status = 'pending'/);

assert.match(projectBoardSource, /screenerConsent: true/);
assert.match(projectBoardSource, /uses your prior hiring authorization/);
assert.match(projectBoardSource, /automatically sends your saved application details and screener answers to Applause/);
assert.doesNotMatch(projectBoardSource, /Confirm Applause screener consent/);

console.log('application screener regression checks passed');
