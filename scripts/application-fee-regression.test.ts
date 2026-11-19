import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/202611190001_application_fees_tinypesa.sql', 'utf8');
const server = readFileSync('server.js', 'utf8');
const projectBoard = readFileSync('src/components/ProjectBoard.tsx', 'utf8');
const projectRepository = readFileSync('src/lib/projectRepository.ts', 'utf8');

assert.match(migration, /application_fee_kes integer not null default 0/i);
assert.match(migration, /create table if not exists public\.application_fee_payments/i);
assert.match(migration, /add column if not exists tinypesa_request_id text/i);
assert.match(migration, /now\(\) \+ interval '10 minutes'/i);
assert.match(migration, /tinypesa_request_id text unique/i);
assert.match(migration, /provider_external_reference text unique/i);
assert.match(migration, /status = 'paid'[\s\S]*status in \('pending', 'initiating'\) and hold_expires_at > now\(\)/i);
assert.match(migration, /A confirmed M-Pesa application fee is required/i);
assert.match(migration, /p_amount_kes is distinct from target_payment\.amount_kes/i);
assert.match(server, /\/express\/initialize\//);
assert.match(server, /provider_external_reference/);
assert.match(server, /\/express\/get_status\//);
assert.match(server, /account_no: externalReference/);
assert.match(server, /p_phone_number: String\(status\.msisdn/);
assert.match(server, /\/api\/tinypesa\/stk\/application-fee/);
assert.doesNotMatch(server, /\/mpesa\/stkpush\/v1\/processrequest/);
assert.match(server, /record_application_fee_payment_result/);
assert.match(server, /claim_application_fee_refund/);
assert.match(server, /requireAdmin\(req\.headers\.authorization\)/);
assert.match(projectBoard, /beginApplicationFeeCheckout[\s\S]*waitForApplicationFeePayment/);
assert.match(projectRepository, /application_fee_kes: project\.applicationFeeKes \|\| 0/);

console.info('Application fee regression checks passed');
