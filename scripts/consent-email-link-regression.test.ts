import assert from 'node:assert/strict';
import fs from 'node:fs';

const serverSource = fs.readFileSync('server.js', 'utf8');
const consentSource = fs.readFileSync('src/lib/projectConsent.js', 'utf8');
const guidedStepsSource = fs.readFileSync('src/components/GuidedProjectSteps.tsx', 'utf8');

assert.match(serverSource, /import \{ PROJECT_CONSENT_URL \} from '\.\/src\/lib\/projectConsent\.js'/);
assert.match(serverSource, /const consentCallToAction = payload\.applauseFollowUpKind === 'consent_signature'/);
assert.match(serverSource, /href="\$\{safeConsentLink\}"/);
assert.match(serverSource, /Open and sign your consent form/);
assert.match(serverSource, /payload\.applauseFollowUpKind === 'consent_signature'[\s\S]*?PROJECT_CONSENT_URL/);
assert.match(guidedStepsSource, /import \{ PROJECT_CONSENT_URL \} from '\.\.\/lib\/projectConsent\.js'/);
assert.match(consentSource, /export const PROJECT_CONSENT_URL = 'https:\/\/prod-data-collection\.cloud\.utest\.com\//);

console.info('Consent email link regression checks passed');
