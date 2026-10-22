import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const appSource = readFileSync(path.resolve('src/App.tsx'), 'utf8');
const loginPageSource = readFileSync(path.resolve('src/components/LoginPage.tsx'), 'utf8');
const referralMigration = readFileSync(
  path.resolve('supabase/migrations/202610220012_link_google_signup_referrals.sql'),
  'utf8'
);

assert.match(appSource, /signInWithOAuth\(\{\s*provider: 'google'/);
assert.match(appSource, /redirectTo: returnUrl\.toString\(\)/);
assert.match(appSource, /client\.rpc\('link_google_signup_referral'/);
assert.match(loginPageSource, /onGoogleAuth\(isSignUp \? 'signup' : 'login'\)/);
assert.match(referralMigration, /current_profile\.created_at < now\(\) - interval '1 hour'/i);
assert.match(referralMigration, /on conflict \(referred_tester_id\) do nothing/i);
assert.match(referralMigration, /grant execute on function public\.link_google_signup_referral\(text\) to authenticated/i);

console.info('Google Auth regression checks passed');
