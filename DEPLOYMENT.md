# Deployment runbook

## 0. Prerequisites

- Node.js 20+
- A Supabase account and a new project (free tier is fine to start)
- The Supabase CLI: `npm install -g supabase`
- A Vercel account, with the Vercel CLI if you want to deploy manually: `npm install -g vercel`
- A GitHub repo for this code (for CI/CD)
- A Google Cloud project with an OAuth 2.0 Client ID (for facilitator "Sign in with Google")

## 1. Create the Supabase project and run the schema

1. Create a new project at supabase.com. Note your project's URL and anon key (**Project Settings > API**) — you'll need these for `.env.local` and Vercel.
2. Run the migration against your project. Either:
   - Paste the contents of `supabase/migrations/0001_init.sql` into the **SQL Editor** and run it, or
   - `supabase link --project-ref <your-project-ref>` then `supabase db push`
3. In **Authentication > Settings**, enable **"Allow anonymous sign-ins"**. This is what lets participants join events and take tests without creating an account (it's off by default).
4. In **Authentication > Providers > Google**, enable the provider and paste your Google OAuth Client ID and Secret. Add your Supabase callback URL (shown on that page) to the **Authorized redirect URIs** in your Google Cloud OAuth client, and add `http://localhost:3000` and your production domain to **Authorized JavaScript origins**.

## 2. Deploy the Edge Functions

```
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy score-test
supabase functions deploy ai-score-answer
```

`score-test` needs no extra configuration — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

`ai-score-answer` (AI-assisted scoring for open-ended answers, from the Test Review screen) is **optional** and disabled by default, matching the original app's behavior. To enable it:

```
supabase secrets set GEMINI_API_KEY=your-key-here
```

## 3. Environment variables (local dev)

Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and anon key from **Project Settings > API**.

## 4. Bootstrap your admin account

RLS intentionally blocks users from granting themselves the `admin` role from the client (only an existing admin, or you via the SQL Editor, can do this). One-time setup:

1. Sign in to the deployed (or local) app once with the Google account you want as admin — this creates your row in `public.users`.
2. In the Supabase **SQL Editor**, run:
   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```

You won't need to repeat this — from then on you can promote other admins the same way, or build a small admin UI later.

## 5. Vercel setup

1. Import the GitHub repo into Vercel.
2. Framework preset: Vite. Build command `npm run build`, output directory `dist` (already set in `vercel.json`).
3. Add environment variables in **Project Settings > Environment Variables** (Production, Preview, and Development): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Vercel will give you a `*.vercel.app` URL to test against immediately.

## 6. Manual deploy (no CI)

```
npm install
vercel deploy --prod
```

## 7. Connect your custom domain

1. **Vercel Project > Settings > Domains > Add.**
2. Enter your domain and follow Vercel's DNS instructions (a CNAME or A record at your registrar).
3. Wait for DNS propagation and SSL to provision automatically (usually minutes to a few hours).
4. Add the domain to **Google Cloud Console > OAuth Client > Authorized JavaScript origins**, and to **Supabase > Authentication > URL Configuration > Redirect URLs** — Google sign-in will fail on the new domain until both are updated.

## 8. CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` is already set up to: type-check on every push/PR, deploy a preview on pull requests, and deploy to production on push to `main`.

To activate it, add these repository secrets (**GitHub repo > Settings > Secrets and variables > Actions**):

- `VERCEL_TOKEN` — generate at vercel.com/account/tokens
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` — found in `.vercel/project.json` after running `vercel link` locally once

You do **not** need to duplicate `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as GitHub secrets — `vercel pull` fetches whatever you set in the Vercel project's Environment Variables (step 5.3) at build time.

## 9. Post-launch checklist

- [ ] Custom domain connected and SSL active
- [ ] Domain added to Google OAuth client + Supabase redirect URLs
- [ ] Anonymous sign-ins enabled in Supabase Auth settings
- [ ] Your account promoted to `admin` (step 4)
- [ ] Run through the full flow once live: create an event, join with the code from a second device, submit an expectation, confirm it appears on the live display
- [ ] Create a test pre/post-test, take it as a participant, confirm scoring and Test Review work
- [ ] Decide on branding: `src/components/BrandLogo.tsx` ships a neutral placeholder mark — swap in SFCG's official branding (or your own) before going live publicly

## What changed from the Firebase version

- **Answer-key exposure fixed.** The old app sent full `test_questions` (including `correctAnswer`/`rubric`) to the browser as soon as a test loaded — flagged as a known limitation in the original docs. Now, participants read questions through a view (`test_questions_public`) that excludes those columns, and scoring happens entirely inside the `score-test` Edge Function with the service-role key. The browser never sees the answer key.
- **Google sign-in is now redirect-based, not a popup.** Supabase Auth's OAuth flow navigates to Google and back rather than opening a popup window. Functionally equivalent, slightly different UX.
- **Anonymous auth needs an explicit toggle.** Firebase had this on by default; Supabase requires enabling "Allow anonymous sign-ins" (step 1.3).
- **`access_token` is now cryptographically tied to the session.** The old Firestore rules had a fallback path that trusted a client-supplied token even when unauthenticated. The new RLS policies require it to equal `auth.uid()` — every participant (even anonymous ones) is a real Supabase Auth session.
