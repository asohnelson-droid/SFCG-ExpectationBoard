# ExpectationBoard

A real-time platform for facilitators to collect, manage, and visualize participant expectations during workshops and peacebuilding events. Participants join with a 6-digit code from their phone, submit anonymous expectations, and facilitators can display them live on a projector during the session. A secondary module supports pre/post-test knowledge assessments with automatic and manual scoring.

## Stack

React 19 + TypeScript, Vite, Tailwind CSS v4, Supabase (Postgres + Auth + Realtime + Edge Functions), react-i18next (English/French), Recharts, Framer Motion. Hosted on Vercel.

This app was originally built on Firebase (Auth + Firestore) via Google AI Studio and migrated to Supabase/Vercel — see `DEPLOYMENT.md` for the full setup and what changed.

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and anon key (Supabase Dashboard > Project Settings > API).
3. Run the dev server:
   ```
   npm run dev
   ```
4. Type-check at any time with `npm run lint`.

## Project structure

- `src/pages` — top-level routed pages (landing, dashboard, event detail, live display, participant submission, test-taking, test review/analytics)
- `src/components` — shared UI and the `test/` subfolder for assessment-building components
- `src/context/AuthContext.tsx` — Google sign-in (facilitators) + anonymous sign-in (participants), session state, and the user's `role` (`facilitator` | `admin`)
- `src/lib/supabase.ts` — Supabase client + `ensureAnonymousSession()` helper
- `src/lib/mappers.ts` — converts Postgres snake_case rows into the camelCase shapes the UI expects
- `src/services/aiScoringService.ts` — thin client wrapper around the `ai-score-answer` Edge Function
- `src/i18n` — English/French translation files
- `supabase/migrations/0001_init.sql` — full Postgres schema, RLS policies, and the `test_questions_public` view
- `supabase/functions/score-test` — scores a completed test server-side (objective auto-scoring); this is what keeps answer keys out of the browser
- `supabase/functions/ai-score-answer` — facilitator-triggered AI-assisted scoring for open-ended answers

## Roles

Anyone who signs in with Google can act as a facilitator (create and manage their own events). A separate `admin` role exists for cross-account moderation (deleting any submission/test/user) but isn't currently wired to a dedicated page. Granting admin requires an existing admin or a one-time manual step — see `DEPLOYMENT.md`.

## Security note

In the original Firebase version, test answer keys were sent to the browser as soon as a test loaded (flagged as a known limitation in the old docs). This migration closes that gap: `test_questions` (which holds `correct_answer`/`acceptable_answers`/`rubric`) is RLS-restricted to the test's owner/admin only. Participants read questions through `test_questions_public`, a view that excludes those columns entirely. Scoring happens inside the `score-test` Edge Function using the service-role key, which the browser never has access to.

## Deployment

See `DEPLOYMENT.md` for the full runbook: Supabase project setup, running the migration, deploying Edge Functions, Vercel setup, environment variables, and CI/CD via GitHub Actions.
