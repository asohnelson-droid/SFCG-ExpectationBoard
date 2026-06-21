# ExpectationBoard

A real-time platform for facilitators to collect, manage, and visualize participant expectations during workshops and peacebuilding events. Participants join with a 6-digit code from their phone, submit anonymous expectations, and facilitators can display them live on a projector during the session. A secondary module supports pre/post-test knowledge assessments with manual scoring and review.

## Stack

React 19 + TypeScript, Vite, Tailwind CSS v4, Firebase (Authentication + Firestore), react-i18next (English/French), Recharts, Framer Motion.

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Firebase project's web app config (Firebase Console > Project Settings > General > Your apps).
3. Run the dev server:
   ```
   npm run dev
   ```
4. Type-check at any time with `npm run lint`.

## Project structure

- `src/pages` — top-level routed pages (landing, dashboard, event detail, live display, participant submission, test-taking, test review/analytics)
- `src/components` — shared UI and the `test/` subfolder for assessment-building components
- `src/context/AuthContext.tsx` — Google sign-in, session state, and the user's `role` (`admin` | `facilitator`)
- `src/services/aiScoringService.ts` — objective (auto) scoring logic; AI-assisted scoring for open-ended answers is currently disabled, see the comment at the top of that file for how to re-enable it safely
- `src/i18n` — English/French translation files
- `firestore.rules` / `firestore.indexes.json` — Firestore security rules and required composite indexes
- `firebase-blueprint.json` — reference documentation of the Firestore data model (not deployed, just docs)

## Roles

Anyone who signs in with Google can act as a facilitator (create and manage their own events). A separate `admin` role exists for cross-account moderation (deleting any submission/test/user) but isn't currently wired to a dedicated page. Granting admin requires an existing admin or a one-time manual step — see `DEPLOYMENT.md`.

## Known limitations

- Objective test scoring runs client-side using an answer key delivered to the browser as soon as a test loads. This is fine for informal pre/post knowledge checks, but a participant using browser devtools could technically see the correct answers before submitting. Closing this fully requires moving scoring to a server-side Cloud Function and splitting answer keys into a non-public collection — flagged as a recommended next hardening step in `DEPLOYMENT.md`.
- AI-assisted scoring for open-ended questions is disabled (see `src/services/aiScoringService.ts`). Manual scoring in the Test Review screen covers this in the meantime.

## Deployment

See `DEPLOYMENT.md` for the full runbook: Firebase Hosting setup, environment variables, custom domain, CI/CD via GitHub Actions, and the one-time admin bootstrap step.
