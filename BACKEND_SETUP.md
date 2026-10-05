# Connectfy Backend Setup

## 1. Create Supabase project

1. Create a project at https://supabase.com.
2. Open **Project Settings > API**.
3. Copy the project URL and the publishable/anon key.
4. Open the Supabase SQL editor and run:

```text
supabase/migrations/202609230001_connectfy_schema.sql
```

The migration creates profiles, projects, applications, submissions, attachments, notifications, wallet transactions, payout requests, an auth profile trigger, and row-level security policies.

Run these after the first migration:

- `supabase/migrations/202609230002_project_seed_key.sql` adds the unique key needed for repeatable project seeding.
- `supabase/migrations/202609230003_connectfy_owner_admin.sql` marks the single demo owner account as the admin project owner.

Run each not-yet-applied migration in `supabase/migrations/` in filename order in the Supabase SQL Editor; do not rerun migrations already applied. In particular, admin role management requires `supabase/migrations/202609240001_admin_invite_function.sql` and `supabase/migrations/202610030003_admin_dismissal_function.sql`. Direct project invitations for registered testers require `supabase/migrations/202610050001_admin_project_invitations.sql`; it also limits profile reads to the profile owner, admins, and clients managing that tester's project. Project-specific operations and payroll require `supabase/migrations/202610040004_project_scoped_operations_payroll.sql`, which creates per-project integrations, completion status and scheduled payroll, adds project ownership to email/onboarding records, and installs the project-scoped Applause status sync RPC. Also apply `supabase/migrations/202610040005_project_eligibility_snapshot_sync.sql` to enable atomic, project-scoped replacement of persisted eligibility-sheet snapshots. Earlier `202610040001` through `202610040003` migrations created the initial single-sheet completion view and sync repairs; the project-scoped migration replaces that sync flow. Reload the PostgREST schema cache after applying migrations.

After applying both project-operations migrations, open **PM Operations**, choose **Manage** on a project listing, then configure that project’s status sheet, optional eligibility sheet, fixed completion payment, and payment date under **Integrations**. Save the settings and sync from **Completion & issues**; rows marked **Claimed Complete** with an email are added to that project’s payroll schedule. Participant and status views display their saved database snapshots until the next sheet sync. Each project has separate settings and records.

## 2. Configure local environment

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These values are required. The login page uses Supabase password authentication and Google OAuth and will not open the application without a valid authenticated session.

For Google OAuth, enable Google under **Authentication > Providers** in Supabase and add the local and production callback URLs. Supabase uses the application origin as the OAuth redirect.

## 3. Configure project email delivery

This app includes a live project application and invite email path using the Express backend in `server.js`. The frontend calls the backend with the project metadata and candidate email, and the backend sends the message using the Brevo API. Supabase remains responsible for authentication and database access.

When an admin or project owner selects **Approve & Send Invite**, the database records the approval and queues an email in `project_email_outbox` in the same transaction. The email backend polls the outbox, sends the approval email through Brevo, and records the provider response. Failed sends are retried with increasing delays, up to eight attempts; exhausted jobs remain available for investigation in the outbox table. The browser does not send a second approval email, avoiding the former split between the approval update and email request.

1. Create a Brevo account and generate an SMTP API key.
2. Add the following values to your server environment (not your browser Vite config):

```env
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=admin@connectfy.tech
APP_URL=https://connectfy.tech
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

Apply `supabase/migrations/202610050002_project_approval_email_outbox.sql` after the earlier migrations. The worker requires `SUPABASE_SERVICE_ROLE_KEY` so it can atomically claim queued jobs and update delivery status; keep this key only in the email backend environment. Never add it to browser variables or expose it through a `VITE_` setting. The migration prevents non-admins and non-owners from approving applications and denies browser roles access to the outbox.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are also required for the backend to verify the signed-in administrator before sending manually requested eligibility, invite, rejection, or uTest-account-update emails. Use the public anon/publishable key for `SUPABASE_ANON_KEY`; these values belong in the email backend environment and are separate from the frontend's `VITE_` build variables.

3. On the VPS, keep these values server-only in the backend environment:

```env
PORT=3002
CORS_ORIGINS=https://connectfy.tech,https://www.connectfy.tech
```

Set `VITE_EMAIL_BACKEND_URL` in the frontend build environment to the public HTTPS endpoint, for example:

```env
VITE_EMAIL_BACKEND_URL=https://api.connectfy.tech/api/project-email
```

The VPS should expose the backend through Nginx or another HTTPS reverse proxy. Do not expose `BREVO_API_KEY` through a `VITE_` variable.

Keep this backend process supervised and running continuously; its `/health` response reports whether the approval-email outbox worker is enabled. If it is unavailable, approvals still queue transactionally in Supabase and will be picked up after the worker restarts. The outbox provides at-least-once delivery: a process failure after Brevo accepts a message but before the database records success can result in a duplicate on retry.

To inspect queued or failed approval messages in the Supabase SQL editor:

```sql
select id, application_id, project_id, status, attempt_count, next_attempt_at, last_error, created_at
from public.project_email_outbox
where status in ('pending', 'failed')
order by created_at desc;
```

4. The function payload is:

```json
{
  "type": "application",
  "toEmail": "applicant@example.com",
  "toName": "Jane Doe",
  "projectTitle": "Checkout Flow QA",
  "projectCompany": "Northstar Commerce",
  "projectDescription": "Review the checkout flow across mobile and desktop and document defects.",
  "projectDeadline": "2026-10-15",
  "projectCategory": "Payment & Checkout",
  "actionUrl": "https://connectfy.tech/?project=proj_123"
}
```

The subject changes automatically for application vs. invite emails, and the action URL is included in both messages so the tester can open the project and act immediately.

## 4. Configure Cloudinary

1. Create a Cloudinary account.
2. Create an unsigned upload preset under **Settings > Upload > Upload presets**.
3. Restrict the preset to the file types and maximum sizes your review workflow allows.
4. Add these values to `.env.local`:

```env
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
```

Bug evidence and task deliverables upload through `src/lib/cloudinary.ts`. The attachment records retain the secure URL, public ID, resource type, MIME type, and size.

For private evidence in production, replace unsigned browser uploads with a signed upload endpoint or Supabase Edge Function. Never expose a Cloudinary API secret in Vite client variables.

## 4. Seed projects into Supabase

Create and confirm the demo owner user through Supabase Auth. Run the owner migration, then seed projects. The seed command uses the admin owner profile. You can optionally provide a specific profile UUID with `SUPABASE_SEED_CLIENT_ID`. Run it from a server terminal with the secret key kept out of the browser and out of Git:

PowerShell:

```powershell
$env:SUPABASE_URL = 'https://your-project.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'your-server-only-secret-key'
npm run seed:projects
```

The seed script reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optional `SUPABASE_SEED_CLIENT_ID` from `.env.local` or `local.env`. It also accepts the older `SUPABASE_SECRET_KEY` name. Keep those files local; both filenames are ignored by Git.

The command imports the current project catalog, stores the complete project object in `project_data`, and upserts the projects safely. Once seeded, the app loads active projects from Supabase instead of using the browser's hardcoded project catalog.

## Safaricom M-Pesa B2C tester payouts

Connectfy uses Daraja **Business-to-Customer (B2C)** to send approved tester payouts to Kenyan Safaricom numbers. It does not use B2C to collect customer payments. M-Pesa requests remain pending until an administrator reviews the recipient and converted KES amount and confirms the transfer.

Apply for Safaricom Daraja access as a business and enable the B2C product for the organization shortcode. Use Safaricom's sandbox credentials and test data first; request production access, production credentials, and the required B2C transaction limits before enabling production. Set the following values only in the email/payment backend's server environment:

```env
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your-daraja-consumer-key
MPESA_CONSUMER_SECRET=your-daraja-consumer-secret
MPESA_INITIATOR_NAME=your-b2c-initiator-name
MPESA_SECURITY_CREDENTIAL=your-encrypted-initiator-credential
MPESA_SHORTCODE=your-organization-shortcode
MPESA_B2C_COMMAND_ID=BusinessPayment
MPESA_CALLBACK_BASE_URL=https://api.connectfy.tech
MPESA_CALLBACK_TOKEN=long-random-secret-value
```

`MPESA_SECURITY_CREDENTIAL` is the Safaricom-certificate-encrypted initiator password supplied/configured for the Daraja B2C integration; it is not the plain-text initiator password. Keep all Daraja values, `SUPABASE_SERVICE_ROLE_KEY`, and the callback token out of browser/Vite variables and Git. The public callback base URL must resolve to this backend over HTTPS. Safaricom callback URLs include the configured high-entropy token; keep it private and rotate it if exposed.

Apply `supabase/migrations/202610050003_safaricom_b2c_payouts.sql` after the prior project migrations. It adds the USD-to-KES quote snapshot and Safaricom reconciliation fields and moves payout creation behind a server-only database function. Configure `SUPABASE_SERVICE_ROLE_KEY` in the backend too. Obtain the FX rate from ExchangeRate-API's public USD feed; the quote rate timestamp/source are stored with the payout request, displayed to the reviewer, and the administrator confirms the whole KES amount before dispatch.

The backend endpoints quote USD/KES and create authenticated payout requests; the admin-only payout-review screen dispatches M-Pesa requests or confirms a manual payment for existing methods. Safaricom result/timeout callbacks update payout status. A callback failure returns the funds to the available balance on the tester's next data refresh. A network timeout after a request was submitted is deliberately left in `processing`; reconcile it with Safaricom before taking any retry action to avoid sending twice. The backend's health endpoint reports outbox-worker configuration, but does not disclose Daraja credentials.

## 5. Run

```powershell
npm install
npm run dev
```

The current domain workflow context still contains sample data while the remaining mutations are being moved server-side, but authentication is always enforced through Supabase.
