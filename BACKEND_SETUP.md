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

1. Create a Brevo account and generate an SMTP API key.
2. Add the following values to your server environment (not your browser Vite config):

```env
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=admin@connectfy.tech
APP_URL=https://connectfy.tech
```

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

## 5. Run

```powershell
npm install
npm run dev
```

The current domain workflow context still contains sample data while the remaining mutations are being moved server-side, but authentication is always enforced through Supabase.
