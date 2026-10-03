import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatProjectEmailType } from '../src/lib/emailService';
import {
  buildLegacySheetEmailHtml,
  buildLegacySheetEmailText,
  LEGACY_SHEET_EMAIL_INSTRUCTIONS,
  LEGACY_SHEET_EMAIL_INTRO,
  LEGACY_SHEET_EMAIL_SUBJECT
} from '../src/lib/legacySheetEmail.js';

assert.equal(formatProjectEmailType('application'), 'application');
assert.equal(formatProjectEmailType('invite'), 'invite');
assert.equal(formatProjectEmailType('accepted'), 'accepted');
assert.equal(formatProjectEmailType('rejected'), 'rejected');
assert.equal(formatProjectEmailType('declined'), 'declined');
assert.equal(formatProjectEmailType('utest_update_required'), 'utest_update_required');
assert.equal(formatProjectEmailType('legacy_sheet_reapply'), 'legacy_sheet_reapply');
assert.equal(formatProjectEmailType('unknown' as any), 'application');

const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const edgeSource = fs.readFileSync(new URL('../supabase/functions/project-email/index.ts', import.meta.url), 'utf8');
const emailLogMigration = fs.readFileSync(new URL('../supabase/migrations/202610030001_legacy_sheet_email_log.sql', import.meta.url), 'utf8');
const crmSource = fs.readFileSync(new URL('../src/components/CRMSection.tsx', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const onboardingSource = fs.readFileSync(new URL('../src/components/LegacyOnboardingSection.tsx', import.meta.url), 'utf8');
const legacyResponseMigration = fs.readFileSync(new URL('../supabase/migrations/202610030002_legacy_sheet_responses.sql', import.meta.url), 'utf8');

assert.match(serverSource, /valid uTest account created within the last 7 days/i);
assert.match(edgeSource, /valid uTest account created within the last 7 days/i);
assert.match(serverSource, /return to Connectfy and reapply/i);
assert.match(edgeSource, /return to Connectfy and reapply/i);
assert.match(serverSource, /https:\/\/www\.utest\.com\/signup/);
assert.match(edgeSource, /https:\/\/www\.utest\.com\/signup/);
assert.match(serverSource, /Only administrators can send legacy sheet emails/);
assert.match(edgeSource, /Only administrators can send legacy sheet emails/);
assert.match(serverSource, /buildLegacySheetEmailHtml/);
assert.match(edgeSource, /buildLegacySheetEmailHtml/);
assert.match(serverSource, /emailType: requestType/);
assert.match(edgeSource, /emailType: payload\.type/);
assert.equal(LEGACY_SHEET_EMAIL_SUBJECT, 'Action required: Create a new uTest account and reapply');
assert.match(buildLegacySheetEmailHtml('Taylor Tester', 'https://connectfy.tech'), /Hello Taylor Tester/);
assert.ok(buildLegacySheetEmailHtml('Taylor Tester', 'https://connectfy.tech').includes(LEGACY_SHEET_EMAIL_INTRO));
assert.ok(buildLegacySheetEmailText('Taylor Tester', 'https://connectfy.tech').includes(LEGACY_SHEET_EMAIL_INSTRUCTIONS));
assert.match(buildLegacySheetEmailHtml('<Taylor>', 'javascript:alert(1)'), /Hello &lt;Taylor&gt;/);
assert.doesNotMatch(buildLegacySheetEmailHtml('Taylor Tester', 'javascript:alert(1)'), /href="javascript:/);
assert.match(emailLogMigration, /create table public\.legacy_sheet_email_log/);
assert.match(emailLogMigration, /using \(public\.is_admin\(\)\)/);
assert.match(crmSource, /\.insert\(\{/);
assert.match(crmSource, /legacy_sheet_email_log/);
assert.match(appSource, /EmailHistorySection/);
assert.match(crmSource, /Sync responses to Connectfy/);
assert.match(legacyResponseMigration, /create table public\.legacy_sheet_responses/);
assert.match(legacyResponseMigration, /using \(public\.is_admin\(\)\)/);
assert.match(onboardingSource, /matched_profile_id/);
assert.match(onboardingSource, /Consent needs review/);
assert.match(onboardingSource, /Tester details need confirmation/);
assert.match(appSource, /LegacyOnboardingSection/);

console.log('email stage regression checks passed');
