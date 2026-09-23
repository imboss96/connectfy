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

## 2. Configure local environment

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These values are required. The login page uses Supabase password authentication and Google OAuth and will not open the application without a valid authenticated session.

For Google OAuth, enable Google under **Authentication > Providers** in Supabase and add the local and production callback URLs. Supabase uses the application origin as the OAuth redirect.

## 3. Configure Cloudinary

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

## 4. Run

```powershell
npm install
npm run dev
```

The current domain workflow context still contains sample data while the remaining mutations are being moved server-side, but authentication is always enforced through Supabase.
