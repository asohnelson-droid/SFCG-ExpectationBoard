# Deployment runbook

## Why Firebase Hosting

The app already runs on Firebase Auth + Firestore, so Firebase Hosting keeps everything — auth, database, hosting, and (later) any Cloud Functions — under one project, one CLI, one console, and one bill. It gives free SSL, a global CDN, and free custom domain support on the no-cost Spark plan (you only need to upgrade to the pay-as-you-go Blaze plan if you later add Cloud Functions, e.g. for server-side AI scoring). Vercel/Netlify are excellent for the frontend but would mean you're managing two separate platforms for what is otherwise a single coherent app — not worth the split here.

## 0. Prerequisites

- Node.js 20+
- A Google account with access to the Firebase project (`gen-lang-client-0673590503`, the existing AI Studio project this app already uses) — or a new Firebase project if you'd rather start fresh
- Firebase CLI: `npm install -g firebase-tools`
- A GitHub account/repo for this code (for CI/CD)
- Your new domain, once registered

## 1. One-time Firebase project setup

```
firebase login
cd expectationboard
firebase use gen-lang-client-0673590503    # or: firebase use --add, to pick/create a project
```

In the Firebase Console for this project:
1. **Authentication > Sign-in method** — confirm Google sign-in is enabled.
2. **Authentication > Settings > Authorized domains** — add your new domain once you have it (and `localhost` should already be there for local dev).
3. **Firestore Database** — confirm it exists. This project uses a named database (`ai-studio-2ac067ee-261e-48d3-ad0f-4bf39e672285`) rather than `(default)`; if you start a fresh project instead, either keep that same setup or switch `VITE_FIREBASE_FIRESTORE_DATABASE_ID` to blank and use `(default)`.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values from **Project Settings > General > Your apps** in the Firebase Console. For this existing project, the values are already in your local `.env.local` (gitignored, not included in anything you push to GitHub).

## 3. Bootstrap your admin account

Firestore rules intentionally block users from granting themselves the `admin` role from the client (only an existing admin, or you via the console, can do this). One-time setup:

1. Sign in to the deployed (or local) app once with the Google account you want as admin — this creates your `users/{uid}` document.
2. In the Firebase Console, go to **Firestore Database > users**, find your document (matches your email), and add a field: `role` (string) = `admin`.

You won't need to repeat this — from then on you can promote other admins the same way, or build a small admin UI later.

## 4. Manual deploy (one-off, no CI)

```
npm install
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

Firebase will print a `*.web.app` / `*.firebaseapp.com` URL you can test against immediately.

## 5. Connect your custom domain

1. **Firebase Console > Hosting > Add custom domain.**
2. Enter your domain (e.g. `expectationboard.yourdomain.com` or the apex domain).
3. Firebase will give you a TXT record to verify ownership, then an A record (or two) to point the domain at Firebase's hosting IPs. Add both at your domain registrar's DNS settings — the exact steps differ slightly by registrar but the records are the same regardless of where you buy the domain.
4. Wait for DNS propagation (usually minutes to a few hours) and SSL to provision automatically.
5. Add this domain to **Authentication > Settings > Authorized domains** (step 1 above) — Google sign-in will fail with an "unauthorized domain" error until you do.

## 6. CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` is already set up to: type-check, build, deploy a preview channel on pull requests, and deploy to production on push to `main` (including Firestore rules/indexes).

To activate it, add these repository secrets (**GitHub repo > Settings > Secrets and variables > Actions**):

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_FIREBASE_FIRESTORE_DATABASE_ID` — same values as your `.env.local`
- `FIREBASE_PROJECT_ID` — your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT` — a service account JSON with Firebase Hosting + Firestore deploy permissions. Generate via **Firebase Console > Project Settings > Service Accounts > Generate new private key**, then paste the entire JSON file contents as the secret value.

Once those are set, every push to `main` deploys automatically.

## 7. Post-launch checklist

- [ ] Custom domain connected and SSL active
- [ ] Domain added to Firebase Auth authorized domains
- [ ] Your account promoted to `admin` (step 3)
- [ ] Run through the full flow once live: create an event, join with the code from a second device, submit an expectation, confirm it appears on the live display
- [ ] Create a test pre/post-test, take it as a participant, confirm manual review/scoring works in Test Review
- [ ] Decide on branding: `src/components/BrandLogo.tsx` currently ships a neutral placeholder mark rather than the previous hotlinked SFCG logo — see the note in the project summary about whether this should carry SFCG's official branding or its own identity before going live publicly

## Recommended next hardening steps (not done in this pass)

These weren't part of this session's scope but are worth planning for:

1. **Server-side test scoring.** Move objective scoring (and, if you want it back, AI-assisted scoring) into a Cloud Function so answer keys are never sent to the browser before submission. Requires upgrading to the Blaze (pay-as-you-go) plan — Firebase's free tier covers a large volume of function calls before any cost kicks in.
2. **Rate limiting / abuse protection** on the public submission and test-taking endpoints (e.g. App Check) if this is ever shared widely outside controlled workshop settings.
3. A small in-app admin panel for promoting users to `admin` and moderating content, instead of doing it via the Firebase Console.
