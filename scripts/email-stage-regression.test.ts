import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatProjectEmailType } from '../src/lib/emailService';

assert.equal(formatProjectEmailType('application'), 'application');
assert.equal(formatProjectEmailType('invite'), 'invite');
assert.equal(formatProjectEmailType('accepted'), 'accepted');
assert.equal(formatProjectEmailType('rejected'), 'rejected');
assert.equal(formatProjectEmailType('declined'), 'declined');
assert.equal(formatProjectEmailType('utest_update_required'), 'utest_update_required');
assert.equal(formatProjectEmailType('unknown' as any), 'application');

const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const edgeSource = fs.readFileSync(new URL('../supabase/functions/project-email/index.ts', import.meta.url), 'utf8');

assert.match(serverSource, /new uTest account created less than 7 days ago/i);
assert.match(edgeSource, /new uTest account.*less than 7 days ago/i);
assert.match(edgeSource, /Account Settings.*uTest Details/i);

console.log('email stage regression checks passed');
