import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildProfileHelpWhatsAppUrl,
  CONNECTFY_WHATSAPP_NUMBER
} from '../src/lib/profileSupportContacts.js';

const profileSettingsSource = fs.readFileSync(
  new URL('../src/components/ProfileSettings.tsx', import.meta.url),
  'utf8'
);
const supportContactsSource = fs.readFileSync(
  new URL('../src/lib/profileSupportContacts.js', import.meta.url),
  'utf8'
);
const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const edgeSource = fs.readFileSync(new URL('../supabase/functions/project-email/index.ts', import.meta.url), 'utf8');
const email = 'tester+profile@example.com';
const whatsappUrl = new URL(buildProfileHelpWhatsAppUrl(email));

assert.equal(whatsappUrl.hostname, 'wa.me');
assert.equal(whatsappUrl.pathname, `/${CONNECTFY_WHATSAPP_NUMBER}`);
assert.equal(
  whatsappUrl.searchParams.get('text'),
  `Hi Connectfy team, I need help completing my profile. My account email is ${email}.`
);
assert.match(whatsappUrl.pathname, /254703147873/);
assert.match(profileSettingsSource, /href={CONNECTFY_SLACK_INVITE_URL}/);
assert.match(profileSettingsSource, /href={buildProfileHelpWhatsAppUrl\(email \|\| testerProfile\.email\)}/);
assert.match(profileSettingsSource, /href={`tel:\$\{CONNECTFY_SUPPORT_PHONE\}`}/);
assert.match(supportContactsSource, /CONNECTFY_SUPPORT_PHONE = '\+254703147873'/);
for (const emailBackendSource of [serverSource, edgeSource]) {
  const profileRequestTemplate = emailBackendSource.slice(
    emailBackendSource.indexOf("if (payload.type === 'profile_update_request')"),
    emailBackendSource.indexOf("if (payload.type === 'employee_welcome')")
  );
  assert.match(profileRequestTemplate, /buildProfileHelpWhatsAppUrl\(payload\.toEmail\)/);
  assert.match(profileRequestTemplate, /Message us on WhatsApp/);
  assert.match(profileRequestTemplate, /CONNECTFY_SUPPORT_PHONE/);
  assert.match(profileRequestTemplate, /CONNECTFY_SLACK_INVITE_URL/);
}

console.info('Profile support contacts regression checks passed');
