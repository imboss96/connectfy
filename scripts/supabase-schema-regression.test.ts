import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const crmSource = readFileSync(path.resolve('src/components/CRMSection.tsx'), 'utf8');
const migrationSource = readFileSync(path.resolve('supabase/migrations/202609240001_admin_invite_function.sql'), 'utf8');

assert.ok(
  !crmSource.includes('last_sign_in_at'),
  'CRM profile query must not request a last_sign_in_at column that does not exist in the current profiles schema.'
);

assert.ok(
  migrationSource.includes('grant execute on function public.invite_user_as_admin'),
  'Admin invite SQL must grant execution access to authenticated users.'
);

console.log('supabase schema regression checks passed');
