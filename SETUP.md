# Redesign branch setup

The application remains a Hono/Node HTTP server with WebSocket interviews. All redesign work lives on `redesign`. Firebase handles credentials; Neon stores profiles and interview records. Passwords and Firebase refresh tokens are never stored in Neon.

## Run locally

Use Node 22 or newer. Run `npm install`, copy `.env.example` to `.env`, fill in the settings below, then run `npm run dev`. Open http://localhost:8000. `npm run typecheck` checks the server, and `npx playwright test` runs API access-control and desktop/mobile screen checks (requires Chrome).

## Firebase Authentication

1. Create or choose a Firebase project in https://console.firebase.google.com/.
2. Add a Web app in Project settings. Copy its apiKey, authDomain, projectId and appId to `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`.
3. Under Authentication > Sign-in method, enable Email/Password and Google. Set the Google support email.
4. Under Authentication > Settings > Authorized domains, add `localhost`, your deployment hostname and any custom hostname. Preview deployments must also be authorized to use Google sign-in.
5. Server verification uses `FIREBASE_PROJECT_ID` to verify Firebase-issued ID tokens. If your deployment needs explicit Admin credentials, place the service account JSON into the server-only `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable. Never commit a service account key or put it in public assets.

The browser receives only public Firebase web-app settings from `/api/config`. It sends a fresh ID token in Authorization headers. The server verifies it, and every data query scopes records to the verified Firebase UID. WebSockets authenticate with a token in the first message; each socket has its own AI session.

## Neon Postgres

1. Create a project/database at https://console.neon.tech/.
2. Copy the pooled connection URL with SSL to server-only `DATABASE_URL`.
3. Run the complete contents of `database/001_accounts.sql` in the Neon SQL editor. Alternatively run `psql "$DATABASE_URL" -f database/001_accounts.sql` in a shell configured with that variable.
4. Use a dedicated Neon branch for preview/development, separate from production data.

`users` holds Firebase UID, email, display name and dates. `interviews` holds mode, target, session state, timestamps and a JSON transcript. Each index groups history by user and date. The API uses parameterized SQL and never accepts a user ID from the browser. Keep database credentials server-side; this schema relies on the server access checks rather than direct browser database access.

## Pages and behavior

- `/`: voice interview room, role selection, camera, text answers and coding rounds.
- `/coding`: coding editor, spoken questions and explicit review requests.
- `/login`: email/password, Google sign-in, password reset.
- `/signup`: name, email/password and Google sign-up.
- `/history`: real saved sessions, mode filter, paginated history, transcript viewer and deletion.

Starting an interview requires sign-in and working storage. A session record is created before connecting to the interviewer. Transcripts autosave after changes, and End saves a completed session. Input audio transcription captures spoken answers; audio/video recordings are not stored. Unexpected disconnects mark sessions interrupted where possible. Browser shutdown/network loss can interrupt the last save; do not treat transcripts as guaranteed recordings. Active sessions left by an abrupt shutdown remain marked active.

History statistics reflect the loaded page(s), not lifetime totals. No AI evaluation scores are invented. Missing configuration is shown explicitly rather than displaying fake history.

## Vercel

Set the Firebase variables, `DATABASE_URL`, and existing `GOOGLE_API_KEY` in the appropriate Vercel environment. Apply the SQL migration before testing sign-in. The existing `vercel.json` includes `public/**` so CSS, scripts, and HTML are available to the exported server.

The branch is for preview testing. Check WebSocket availability and function lifetime on your hosting plan; the existing function duration is 60 seconds. Longer interviews require a supported long-lived WebSocket runtime or a separate persistent Node server. Page rendering alone does not verify live interview support. Real Google sign-in and Neon round-trip tests require your configured services; the local smoke suite intentionally uses no secrets.

## Verification with real services

Create two test accounts. Sign in with each and complete a short voice and coding interview. Confirm each sees only its own history; copy an interview ID into requests from the other account and expect 404 on GET/PATCH/DELETE. Reload the page and verify the transcript persists. Test Google popup sign-in on the authorized deployment domain and password reset with your email provider. Verify an interrupted connection leaves an appropriate status and saving errors are visible. Delete test interviews afterward.

## Source map

- `src/accounts.ts`: token verification and private account/history endpoints.
- `database/001_accounts.sql`: repeatable initial schema migration.
- `public/auth.js`: Firebase client authentication, navigation and themes.
- `public/history.js`: history loading, filtering, transcript modal and deletion.
- `public/session.js`: session creation and serialized transcript autosaving.
- `public/design.css`, `public/room.css`: shared tokens and responsive all-white layouts.
- `docs/design-notes.md`: design decisions, generated artwork prompt and asset licenses.
- `server.ts`: page/static routes, per-connection AI session and authenticated sockets.

Implementation follows Firebase's ID-token verification and Google sign-in documentation (https://firebase.google.com/docs/auth/admin/verify-id-tokens, https://firebase.google.com/docs/auth/web/google-signin) and Neon's parameterized serverless driver (https://github.com/neondatabase/serverless).
