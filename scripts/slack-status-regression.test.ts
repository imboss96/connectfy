import assert from 'node:assert/strict';
import fs from 'node:fs';

const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const statusSource = fs.readFileSync(new URL('../src/components/ApplauseStatusSection.tsx', import.meta.url), 'utf8');
const slackServiceSource = fs.readFileSync(new URL('../src/lib/slackStatusService.ts', import.meta.url), 'utf8');
const loginSource = fs.readFileSync(new URL('../src/components/LoginPage.tsx', import.meta.url), 'utf8');
const guidedStepsSource = fs.readFileSync(new URL('../src/components/GuidedProjectSteps.tsx', import.meta.url), 'utf8');
const setupSource = fs.readFileSync(new URL('../BACKEND_SETUP.md', import.meta.url), 'utf8');

assert.match(serverSource, /app\.post\('\/api\/admin\/applause-status-slack-dms'/);
assert.match(serverSource, /await requireAdmin\(authorization\)/);
assert.match(serverSource, /users\.lookupByEmail/);
assert.match(serverSource, /conversations\.open/);
assert.match(serverSource, /chat\.postMessage/);
assert.match(serverSource, /SLACK_BOT_TOKEN/);
assert.match(serverSource, /project_applause_status\?project_id=/);
assert.match(serverSource, /google_email \|\| ''\)\.trim\(\) \|\| String\(row\.tester_email/);
assert.match(serverSource, /Status: \$\{slackSafeText\(row\.status\)\}/);
assert.match(serverSource, /Consent: \$\{slackSafeText\(row\.consent_name\)\}/);
assert.match(serverSource, /ID scan: \$\{slackSafeText\(row\.id_scan_status\)\}/);
assert.match(serverSource, /Issues: \$\{slackSafeText\(row\.issues/);
assert.match(statusSource, /setInterval\(\(\) => void refresh\(controller\.signal\)/);
assert.match(statusSource, /onClick=\{\(\) => void refresh\(undefined, true\)\}/);
assert.match(statusSource, /sendProjectStatusSlackDms\(projectId\)/);
assert.match(slackServiceSource, /\/api\/admin\/applause-status-slack-dms/);
assert.match(loginSource, /join\.slack\.com\/t\/connectfyops\/shared_invite/);
assert.match(loginSource, /same email address/);
assert.match(guidedStepsSource, /join\.slack\.com\/t\/connectfyops\/shared_invite/);
assert.match(guidedStepsSource, /Slack does not add you automatically/);
assert.match(guidedStepsSource, /Open support channel/);
assert.match(setupSource, /users:read\.email`, `im:write`, and `chat:write/);
assert.match(setupSource, /Automatic page-load\/hourly sheet refreshes do not send Slack DMs/);

console.log('Slack status regression checks passed');
