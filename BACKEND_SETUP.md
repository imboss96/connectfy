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

Run each not-yet-applied migration in `supabase/migrations/` in filename order in the Supabase SQL Editor; do not rerun migrations already applied. In particular, admin role management requires `supabase/migrations/202609240001_admin_invite_function.sql` and `supabase/migrations/202610030003_admin_dismissal_function.sql`. Tiered admin access requires `supabase/migrations/202610140001_tiered_admin_access.sql`; existing admins are retained as Super Admins, and new admin invitations can be assigned Super Admin, Project Manager, or Reviewer access. The migration restricts payroll and administrator management to Super Admins, while Project Managers can manage projects and invitations and all three tiers can review submissions. Apply `supabase/migrations/202610140002_project_manager_crm_read_access.sql` after the tiered admin migration to allow Project Managers to view CRM data read-only. Project Managers cannot synchronize CRM sheets, send CRM emails, manage administrators, or view full user records containing payout history. Direct project invitations for registered testers require `supabase/migrations/202610050001_admin_project_invitations.sql`; it also limits profile reads to the profile owner, admins, and clients managing that tester's project. Project-specific operations and payroll require `supabase/migrations/202610040004_project_scoped_operations_payroll.sql`, which creates per-project integrations, completion status and scheduled payroll, adds project ownership to email/onboarding records, and installs the project-scoped Applause status sync RPC. Also apply `supabase/migrations/202610040005_project_eligibility_snapshot_sync.sql` to enable atomic, project-scoped replacement of persisted eligibility-sheet snapshots. Earlier `202610040001` through `202610040003` migrations created the initial single-sheet completion view and sync repairs; the project-scoped migration replaces that sync flow. The guided workspace progress also requires `supabase/migrations/202610130001_project_step_progress.sql`. Reload the PostgREST schema cache after applying migrations.

Apply `supabase/migrations/202610200001_ambassador_referrals.sql` to enable unique tester referral links and the Connectfy Ambassadors dashboard. A referred tester is attributed at account creation; each approved task or bug submission by that tester atomically credits the referrer $5 in their wallet. The migration creates the referral and reward records, wallet credits, notification, and row-level security policies.

If `202610200001_ambassador_referrals.sql` has already been applied, also apply `supabase/migrations/202610200002_fix_ambassador_referral_names.sql` to correct existing referral display names and ensure future referrals show the newly registered tester's name. Apply `supabase/migrations/202610200003_fix_ambassador_payout_balance.sql` to fix payout requests failing because the referral-credit balance query referenced the wrong SQL alias.

Apply `supabase/migrations/202610220001_require_project_completion_before_next_application.sql` to prevent a tester from applying to another project until their current project has at least one current submission and every current submission is approved. Rejected or changes-requested submissions can be resubmitted; the original stays in review history, and only the latest linked submission counts toward completion. The database triggers enforce the same rule as the project board for direct API applications, validate resubmission links, and prevent testers from bypassing the lock by changing their application to rejected.

Apply `supabase/migrations/202610220002_hr_employee_management.sql` after the base schema and tiered-admin access migrations to enable **HR Management**. Super Admins can link an existing Connectfy account to an employee profile and manage its job details, onboarding tasks, leave approvals, payroll records, and performance reviews. Project Managers and reviewers do not receive HR administration access. Employees retain their existing tester or client role and get a separate **Employee HR** area after a Super Admin links their account. Create the account through the normal sign-up flow first; it appears in the HR account selector after its first sign-in.

Apply `supabase/migrations/202610220013_hr_hourly_team_reports_and_adjustments.sql` after the HR employee management migration. Super Admins can view hourly staff time logs and pay adjustments by each employee's current pay period, correct completed time entries with an audit trail, and record signed pay additions or deductions. Adjustment records are immutable through the client and record the administrator, timestamp, and reason; these entries only track HR changes and do not send payments.

Apply `supabase/migrations/202610220004_hr_department_job_title_options.sql` after the HR employee management migration to enable configurable department and job title dropdowns. It seeds QA/Testing, Project Management, HR, Finance, Operations, Internal, QA Tester, Reviewer, Team Leader, Project Manager, Project Reviewer, Moderator, and HR Manager. Super Admins can add, rename, deactivate, and reactivate options in HR Management. Existing employee labels remain visible even if an option is deactivated.

Apply `supabase/migrations/202610220005_hr_job_title_platform_access.sql` after the HR catalog migration to let employee job titles grant additional platform access without replacing the employee's Tester or Client role. Saving a **Project Manager** title grants Project Manager access; **Reviewer** and **Project Reviewer** grant Reviewer access; all other titles clear supplemental access. Existing Admin accounts keep the access level assigned through Admin Management, and HR job titles never grant Super Admin. The migration protects role/access changes from self-escalation and updates project-management and submission-review database checks for these supplemental accounts.

If saving an employee's job title fails while updating platform access, apply `supabase/migrations/202610220008_hr_employee_platform_access_rpc.sql` after the access migration. It routes HR access updates through a narrowly scoped function that verifies the caller is a Super Admin, and the HR dashboard displays database error messages directly.

Apply `supabase/migrations/202610220009_hr_employee_welcome_email_tracking.sql` after the HR employee management migration to track employee email delivery.

Apply `supabase/migrations/202610220010_hr_employee_contract_email_tracking.sql` after the welcome-email tracking migration. New employees receive a welcome email with a draft employment-terms PDF attached. Existing employees receive an updated draft PDF when their job title, compensation type, rate, currency, or pay frequency changes. A saved terms snapshot prevents repeat messages for unchanged terms and allows a later HR save to retry after a failed delivery. Existing employees without a saved contract snapshot receive their first draft PDF the next time HR saves their profile. The PDF is generated from saved HR and profile data and is prominently marked **Draft - For Legal Review - Not a Signed Agreement**; it is a review copy, not a final or signed contract. Deploy/restart the email backend with the current `server.js`, configure at least one supported email provider, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`, and set the frontend `VITE_EMAIL_BACKEND_URL` to that backend's `/api/project-email` endpoint. The HR screen displays email-backend errors and confirms when the backend accepted the message and PDF attachment; acceptance does not guarantee delivery to the recipient's mailbox.

Apply `supabase/migrations/202610220011_disable_automatic_project_emails.sql` to stop application-received, invite-accepted, and project-invitation emails from being sent automatically. Applications still generate in-app notifications, and approving an application no longer sends an email. An admin can use **Send Invite** or **Resend Invite** from the application pipeline when an invitation email is needed; direct project invitations remain an explicit admin action. Pending automatic invitation outbox messages are marked failed rather than sent. Supabase Auth signup confirmations and password resets are separate and are not changed by this migration.

Google sign-in/sign-up is offered alongside email and password authentication through Supabase Auth. To enable it, configure the Google OAuth client in Supabase **Authentication → Providers → Google**, add Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) to the Google OAuth client's authorized redirect URIs, and add the production app URL to Supabase's allowed redirect URLs. Email/password signup confirmation and password reset remain handled by Supabase Auth. Apply `supabase/migrations/202610220012_link_google_signup_referrals.sql` to retain referral attribution for first-time Google signups that arrive with a referral code.

Employee self-service includes onboarding task completion, server-timestamped clock-in/clock-out, leave requests, and read access to their own compensation, payroll history, and performance reviews. HR tables use row-level security to limit employees to their own records. Payroll is tracking-only: adding a record or marking it paid does not send money or invoke the M-Pesa/PayPal payout integrations. No external payment account details are stored by this HR feature.

Apply `supabase/migrations/202610220003_require_project_step_approval.sql` after `202610130001_project_step_progress.sql` and `202610140001_tiered_admin_access.sql` to require a reviewer decision for each project checklist step. Testers submit one step at a time; it remains locked at **Awaiting approval** until a Super Admin, Project Manager, or Reviewer approves it in **Project Step Reviews**. Requesting changes requires a reviewer note and lets the tester resubmit that step. Existing self-marked `Done` statuses are converted to `submitted` during migration so they must be reviewed before dependent steps unlock; previous self-marked `Failed` statuses reset to `pending`. The tester checklist refreshes approvals every 15 seconds and also has a manual refresh button.

If checklist submissions fail with `function jsonb_object_length(jsonb) does not exist`, apply `supabase/migrations/202610220006_fix_project_step_jsonb_object_count.sql`. It replaces the checklist submission function with a supported JSONB key-count check.

Apply `supabase/migrations/202610220007_admin_tester_mode.sql` to let Admin accounts use the Tester workspace and request payouts for their own tester activity without changing their stored Admin role or access level. Admins can switch between workspaces from the top navigation.

After applying both project-operations migrations, open **PM Operations**, choose **Manage** on a project listing, then configure that project’s status sheet, optional eligibility sheet, fixed completion payment, and payment date under **Integrations**. Save the settings and sync from **Completion & issues**; rows marked **Claimed Complete** with an email are added to that project’s payroll schedule. Participant and status views display their saved database snapshots until the next sheet sync. Each project has separate settings and records.

Apply `supabase/migrations/202610150001_project_manager_workflows.sql` after the tiered-admin migration (`202610140001`) and the Applause consent-reminder migrations through `202610060018_queue_consent_reminders_to_sheet_emails.sql`. The workflow migration also ensures the active-recipient unique index needed by its reminder queue function and replaces the Super Admin-only consent queue check so both Super Admins and Project Managers can queue consent reminders. If a previous attempt stopped partway through with an error, use the updated script and rerun it; its table/index, policy, and trigger setup can be safely retried without deleting activity data. It enables Project Managers to access application review and Applause status work, while limiting their project-operations view to completion/status data and withholding payroll schedules, payout settings, and integration controls. A restricted database function supplies only the Applause sheet URL. The **My Tasks** page shows each PM/reviewer their own logged application decisions, submission reviews, account requests, and Applause follow-ups including queued consent reminders; Super Admins see team-wide activity. The migration stores actor-attributed activity and adds the database-side screener confirmation and uTest ID/screenshot checks required before application approval. PMs can send individual settings-video, completion, and consent follow-ups to the contact email shown on each matching Applause row, including users without Connectfy accounts; Google Email is preferred, with Tester Email as fallback. Bulk consent reminders also work for external email contacts. These actions are recorded in Connectfy and do not write back to the source Google Sheet. Follow-up and consent emails ask recipients to download Slack and join the Connectfy Ops workspace for real-time communication. Project Manager syncs update status snapshots only; payroll scheduling and completion-approval emails remain Super Admin sync actions. Restart the local email server or redeploy the email backend after updating `server.js` so it recognizes the `applause_follow_up` email type. For legacy/manual application approvals, the screener confirmation and uTest ID/screenshot checks remain required. The automated, consented Google Form flow is described in section 6.

Apply `supabase/migrations/202610060007_applause_wallet_credits.sql` after `202610060004_platform_member_payroll.sql`. It snapshots the configured project completion amount on the approval email, shows each tester their own approved project payroll in the wallet, and includes scheduled project credits in payout balance validation. A scheduled credit remains in the wallet until it is externally marked paid or cancelled.

Apply `supabase/migrations/202610060008_applause_consent_pending_reminders.sql` after `202610060007_applause_wallet_credits.sql`, then apply `supabase/migrations/202610060009_consent_reminder_email_audit.sql`, `supabase/migrations/202610060012_consent_reminders_for_external_testers.sql`, `supabase/migrations/202610060013_drop_legacy_consent_reminder_profile_unique.sql`, `supabase/migrations/202610060014_dedupe_consent_reminders_by_recipient.sql`, `supabase/migrations/202610060015_prefer_applause_recipient_email.sql`, `supabase/migrations/202610060016_external_reminder_contact_email.sql`, `supabase/migrations/202610060017_match_reminders_by_google_email.sql`, and `supabase/migrations/202610060018_queue_consent_reminders_to_sheet_emails.sql`. In **Completion & issues**, admins can select synced rows with `CONSENT NAME` set to `Pending` and click **Email selected testers**. Rows with an email are queued whether or not they match a registered tester profile. The sheet's Google Email is used when present, falling back to Tester Email. Selected rows sharing the same email produce one reminder per queue operation. Every reminder uses the same `Hello tester` salutation and includes the configured project payout amount, project deadline/lock date, and a Slack link to Kenyan support. The running email backend processes and retries queued reminders through Brevo; clicking again intentionally resends selected recipients that were already sent or failed. Manual sends and their current delivery status appear in that project’s **Emails** history.

For previously approved Applause participants who have a missing or incorrect uTest ID, apply `supabase/migrations/202610070001_admin_utest_details_requests.sql`. In **Completion & issues**, use **Request uTest details** on a completed row. The application is temporarily marked as needing uTest details; the email link requires the tester to sign in, saves the ID to that project application, and restores its earlier application and invite status.

## 2. Configure local environment

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These values are required. The login page uses Supabase password authentication and Google OAuth and will not open the application without a valid authenticated session.

For Google OAuth, enable Google under **Authentication > Providers** in Supabase and add the local and production callback URLs. Supabase uses the application origin as the OAuth redirect.

Accepting a project invitation enforces the same required tester details as applying to a project, including the uTest account screenshot and the ID/voice-recording confirmations. These values are saved to the tester's existing `profiles.profile_data` JSON and the invitation's existing `application_utest_details` row, so no additional migration is needed when the application-detail migrations are already applied.

## 3. Configure project email delivery

This app includes a live project application and invite email path using the Express backend in `server.js`. The frontend calls the backend with the project metadata and candidate email, and the backend sends the message using the Brevo API. Supabase remains responsible for authentication and database access.

When a Super Admin adds a new employee in HR Management, the email backend verifies the signed-in Super Admin and the employee's linked Connectfy profile before sending a welcome email. It explains that the employee's set pay rate is reviewed every two weeks and revisions are based on performance. The email is sent only after the employee profile and any applicable platform access update have succeeded; editing an existing employee does not send another welcome email. If delivery fails, the HR dashboard reports that the employee was created but the email was not sent.

In the submissions review queue, approving a bug report or task deliverable saves its approved status and payout amount to Supabase before notifying the tester. The tester's wallet balance and transaction history are calculated from approved submissions, so the approved project amount is credited once and remains available after signing in again. The same email backend sends the approval notice; it verifies the signed-in administrator or project owner against the saved submission and gets the tester's recipient address from their profile. If email delivery fails after approval, the dashboard reports the email error while leaving the saved approval and wallet credit intact.

Approving an application now updates its status without sending an invitation email. An administrator can send the invitation separately using **Send Invite** or **Resend Invite** in the application pipeline. The legacy `project_email_outbox` worker is disabled by default and only runs when `PROJECT_INVITATION_EMAIL_AUTOMATION_ENABLED=true`; automatic delivery should remain disabled for the current quota-saving configuration. Direct project invitations and manual resends still use the email backend.

Applause sheet syncs also queue a **project completion approved** email when a participant's status first changes to `Claimed Complete`. Only rows matched to a registered Connectfy tester profile are eligible; matching uses the tester's platform email or saved uTest ID, and unmatched sheet participants are never emailed. A persistent `project_applause_approval_email_outbox` row keyed by project and tester prevents duplicate messages across later syncs. The status sync now updates its saved snapshot in place so it can detect newly completed rows without treating every hourly refresh as a new approval. The same backend outbox worker sends these emails and retries delivery failures.

1. Create a Brevo account and generate an SMTP API key.
2. Add the following values to your server environment (not your browser Vite config):

```env
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=admin@connectfy.tech
APP_URL=https://connectfy.tech
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
```

To DM members their Applause project status after an administrator manually clicks **Sync now**, create and install a Slack app in the same workspace as the members. Grant its bot token the `users:read.email`, `im:write`, and `chat:write` scopes, reinstall the app after changing scopes, and set its `xoxb-...` token as `SLACK_BOT_TOKEN` in the backend environment. The project Google Email is used first, with Tester Email as fallback; emails are matched to Slack workspace members. Each matched member receives their project status, consent status, ID scan status, and issues. Duplicate sheet rows with the same email produce one DM per manual sync. Rows without email and emails not found in the workspace are not messaged. Automatic page-load/hourly sheet refreshes do not send Slack DMs. Keep the bot token server-only; never add it to a `VITE_` variable or commit it.

Tester signup and the first project-workspace checklist link users to the Connectfy Slack shared invitation. Users must accept that invitation themselves, preferably with the same email address as their Connectfy account, then open the support channel to introduce themselves. Existing testers can use the same workspace checklist link. This shared-invite flow does not automatically add members to Slack; programmatic invitations require Slack Enterprise admin API access.

Apply `supabase/migrations/202610050002_project_approval_email_outbox.sql` after the earlier migrations. The worker requires `SUPABASE_SERVICE_ROLE_KEY` so it can atomically claim queued jobs and update delivery status; keep this key only in the email backend environment. Never add it to browser variables or expose it through a `VITE_` setting. The migration prevents non-admins and non-owners from approving applications and denies browser roles access to the outbox.

Apply `supabase/migrations/202610060002_applause_approval_email_outbox.sql` to enable uTest/Applause completion approval emails. It adds the project-scoped deduplication/outbox table, updates the Applause sync RPC to preserve status transitions, and adds worker-only claim/complete RPCs. Restart the email backend after applying the migration so its worker begins processing these jobs.

Admins can review queued, sent, and failed completion approval emails in **Approval Email Log**. The log is read from the protected outbox through an admin-authenticated backend endpoint; the browser does not receive direct access to the service-role-only email table.

Apply `supabase/migrations/202610060005_qualify_project_email_outbox_claim.sql` after the legacy approval outbox migration if the backend logs an ambiguous `attempt_count` error while claiming project emails. It qualifies the outbox columns in the claim function; the backend isolates worker queues so an error in one queue does not stop the Applause completion approval email queue.

Apply `supabase/migrations/202610060004_platform_member_payroll.sql` after the Applause outbox migration. It links scheduled project payroll entries to a registered tester profile, cancels any pending legacy schedule that cannot be matched to a Connectfy tester by account email or saved uTest ID, and updates the sync RPC so future schedules are created only for matched platform members. Approval emails and scheduled payments both exclude external sheet-only accounts. Admins can review the approval-backed project schedules under **Payments & Schedules**; that page is a report/export view and does not execute those scheduled payments.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are also required for the backend to verify the signed-in administrator before sending manually requested eligibility, invite, rejection, or uTest-account-update emails. Use the public anon/publishable key for `SUPABASE_ANON_KEY`; these values belong in the email backend environment and are separate from the frontend's `VITE_` build variables.

Email delivery supports Brevo, Mailjet, and Sender. Configure at least one provider. By default, the backend tries Brevo, then Mailjet, then Sender; set `EMAIL_PRIMARY_PROVIDER` to `mailjet` or `sender` to choose a different first provider. It proceeds to the next configured provider only after an explicit quota/rate-limit rejection (including Sender's temporary SMTP rate-limit responses). It does not retry through another provider after network errors or ambiguous server failures, to reduce the risk of duplicate messages. When a provider's limit resets, it is tried first again according to the configured order.

To configure Sender, open **Transactional emails → Setup instructions → SMTP** in the Sender dashboard and create an SMTP user. Set `SENDER_SMTP_USER` and `SENDER_SMTP_PASSWORD` to those generated credentials. Verify the sending domain/address in Sender and set `SENDER_SENDER_EMAIL` to that verified address. The integration uses Sender's TLS SMTP relay and supports the generated PDF attachment used by HR emails.

```env
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=admin@connectfy.tech
MAILJET_API_KEY=...
MAILJET_API_SECRET=...
MAILJET_SENDER_EMAIL=admin@connectfy.tech
MAILJET_SENDER_NAME=Connectfy
SENDER_SMTP_USER=your-sender-smtp-username
SENDER_SMTP_PASSWORD=your-sender-smtp-password
SENDER_SENDER_EMAIL=admin@connectfy.tech
SENDER_SENDER_NAME=Connectfy
EMAIL_PRIMARY_PROVIDER=brevo
```

Create and verify the sender identity/domain with each provider and publish the DNS records that provider requires (SPF/DKIM, plus DMARC). Keep all provider credentials server-side; never use `VITE_` prefixes for them.

3. On the VPS, keep these values server-only in the backend environment:

```env
PORT=3002
CORS_ORIGINS=https://connectfy.tech,https://www.connectfy.tech
```

Set `VITE_EMAIL_BACKEND_URL` in the frontend build environment to the public HTTPS endpoint, for example:

```env
VITE_EMAIL_BACKEND_URL=https://api.connectfy.tech/api/project-email
```

The VPS should expose the backend through Nginx or another HTTPS reverse proxy. Do not expose Brevo or Mailjet credentials through a `VITE_` variable.

Keep this backend process supervised and running continuously. Project invitation outbox delivery is disabled by default. Do not set `PROJECT_INVITATION_EMAIL_AUTOMATION_ENABLED=true` unless you intentionally want automatic invitation emails enabled again and have restored the database queue trigger. The screener worker remains independent and continues processing consented application screeners.

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

Apply `supabase/migrations/202610050003_safaricom_b2c_payouts.sql` and then `supabase/migrations/202610060003_paypal_payouts.sql` after the prior project migrations. They add the USD-to-KES quote snapshot, Safaricom reconciliation fields, and PayPal payout tracking fields; move payout creation behind a server-only database function; and restrict new withdrawals to PayPal or Safaricom M-Pesa. Configure `SUPABASE_SERVICE_ROLE_KEY` in the backend too. Obtain the FX rate from ExchangeRate-API's public USD feed; the quote rate timestamp/source are stored with the payout request, displayed to the reviewer, and the administrator confirms the whole KES amount before dispatch.

Configure PayPal Payouts in the PayPal Developer Dashboard and enable the Payouts permission for the REST app. Use sandbox credentials and PayPal sandbox accounts for testing before switching to a live app and live credentials. Add these server-only values to the backend environment:

```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your-paypal-rest-app-client-id
PAYPAL_CLIENT_SECRET=your-paypal-rest-app-secret
```

Set `PAYPAL_ENV=live` only after the live PayPal app has Payouts access and has been tested. Never expose PayPal secrets through browser/Vite variables or commit them to Git.

The backend endpoints quote USD/KES and create authenticated payout requests; the admin-only payout-review screen dispatches M-Pesa and PayPal requests. Safaricom result/timeout callbacks update M-Pesa payout status. PayPal batch status is reconciled by the backend worker and payout requests remain processing until PayPal confirms an item result. Failed provider transfers release the reserved balance on the tester's next data refresh. Network timeouts and other ambiguous responses remain in `processing`; reconcile them with the provider before taking any retry action to avoid duplicate transfers. The backend's health endpoint reports whether PayPal payouts are configured and the selected environment, but does not disclose credentials.

Before launch, apply `supabase/migrations/202610060006_restrict_profile_role_updates.sql`. It grants authenticated users updates only to profile detail columns, preventing users from promoting themselves by editing `profiles.role`. Admin role changes continue through the admin-only database functions.

## 5. Run

```powershell
npm install
npm run dev
```

The current domain workflow context still contains sample data while the remaining mutations are being moved server-side, but authentication is always enforced through Supabase.

## 6. Configure applicant Applause screener submission

Apply `supabase/migrations/202610170001_application_google_screener.sql`, `supabase/migrations/202610170002_auto_approve_confirmed_screeners.sql`, `supabase/migrations/202610170003_queue_application_screeners.sql`, `supabase/migrations/202610170004_apply_organization_hiring_consent.sql`, and `supabase/migrations/202610170006_reconcile_confirmed_screener.sql` after the application uTest-details migrations. **Only apply migration 004 where the organization hiring agreement explicitly authorized sending applicants' saved personal details and screener answers to Applause through Google Forms.** It records that authorization for all existing pending applications and automatically records it for future pending application details, with `screener_consent_source` identifying the organization hiring agreement. The application form informs applicants that their saved answers will be submitted automatically; they do not need a second consent click. The consent trigger queues pending applications for the trusted backend worker; no public unauthenticated submission endpoint is used. The worker processes one application at a time, uses server-only `SUPABASE_SERVICE_ROLE_KEY` access to load and update its state, and submits only when consent and required answers are valid. It accepts only numeric uTest IDs beginning with `30` and requires a valid uTest account screenshot. The applicant's full legal name, uTest email, ID, phone, country, and DOB come from their saved application details. The Gmail answer comes from the saved Connectfy profile email and must be a `@gmail.com` address. The form's separate Ambassador fields always use the configured values in `submit_google_form.py` (`Ezra Bosley`, `ezrahbosire1@gmail.com`, and `1850796`). Once Google confirms a screener response, Connectfy automatically approves the pending application and records the decision in Team Activity as Connectfy System Bot. The project invitation email is not sent automatically; an admin can send it manually from the application pipeline. **Applause Submissions** displays queued, in-progress, failed, ambiguous, and confirmed screener outcomes and refreshes automatically. For an ambiguous outcome, an administrator can use **I verified the sheet response — reconcile** only after confirming the response exists in the Google Form response sheet; this records the existing response and finishes approval without submitting the form again. The reconciliation function accepts only the configured Applause form URLs and only applications whose outbox status is ambiguous. The worker requires `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and Python/Playwright/Chromium on the VPS. Email delivery of manually sent invitations requires a configured email provider (Brevo or Mailjet).

The email backend host must provide Python 3.10+, Playwright, and Chromium in addition to Node.js:

```powershell
python -m pip install -r requirements-screener.txt
python -m playwright install chromium
```

For a Linux production host, install the same requirements with its Python 3 executable and install Chromium's operating-system dependencies with `python3 -m playwright install --with-deps chromium`. Set `PYTHON_EXECUTABLE` to the Python executable available to the Express process (for example, `python3`). Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured only in the backend's protected environment; never expose the service-role key to the browser. Redeploy/restart the backend after configuration changes.

The backend records consent source and submission state per application. A form response is marked submitted only after Google confirms it was recorded. If confirmation is ambiguous, Connectfy blocks retries to avoid duplicate submissions and surfaces the reconciliation state in **Applause Submissions**.
