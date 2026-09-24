import assert from 'node:assert/strict';
import { formatProjectEmailType } from '../src/lib/emailService';

assert.equal(formatProjectEmailType('application'), 'application');
assert.equal(formatProjectEmailType('invite'), 'invite');
assert.equal(formatProjectEmailType('accepted'), 'accepted');
assert.equal(formatProjectEmailType('rejected'), 'rejected');
assert.equal(formatProjectEmailType('declined'), 'declined');
assert.equal(formatProjectEmailType('unknown' as any), 'application');

console.log('email stage regression checks passed');
