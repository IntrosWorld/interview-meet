# Desktop interview and coding

On branch `aaa`. Run `npm run local` in one terminal, then `npm run desktop` in another. This is a development Electron shell, not a packaged installer. Ollama must already be running. Model downloads remain on F: as before.

If Electron's executable is missing because npm blocks install scripts, run `npm run desktop:install` first. It downloads the official runtime with its cache on F: and a three-minute timeout. During implementation this machine's GitHub download stalled, so the Electron window and real production sign-in could not be launch-tested. All 11 browser tests passed, including both shared desktop room routes.

The Model menu offers Local Interview, Local Coding, Gemini Interview and Gemini Coding. Switching destroys the previous window, stopping its microphone and active work. Local mode needs no account; conversation context remains in memory. Coding drafts are sent only when you start a problem or explicitly request review; they are never executed.

Local pages at `/desktop/interview` and `/desktop/coding` derive directly from the website's `index.html` and `coding.html`, with its shared `design.css` and `room.css`. They replace the cloud controller with the local streaming/Whisper/timed-voice controller. CodeMirror and its language modes are served locally without CDN dependencies. Local voice answers use Whisper; code review is requested explicitly with Review Now.

Gemini mode opens `https://interview-meet.mohitnaik.tech/desktop/authorize` in the default system browser. Sign in using the existing Google or email/password login, then explicitly approve connecting the desktop. The app listens on an ephemeral port bound only to 127.0.0.1. A state value binds the callback to the current attempt, and an S256 PKCE proof binds code redemption to the initiating app. Codes expire after two minutes and are atomically consumed in Neon. Desktop attempts time out after three minutes or can be cancelled by switching models.

Only the authorization code and state appear in the loopback URL, not Firebase tokens. Electron exchanges the code over HTTPS and keeps the returned Firebase custom token briefly in main-process memory. A narrow, one-use IPC handler releases it only to the official `/desktop/complete` top-level page in the active window. That page signs in with Firebase and replaces itself with the interview or coding room. Browser and desktop login sessions are separate; signing out in one does not automatically sign out the other. No Gemini key is needed in Electron or the local service.

Renderers are sandboxed with Node disabled and context isolation enabled. The credential-only preload is enabled on the official completion page, never on local pages. Navigation is restricted to local/official origins and sign-in links restart browser login. Media permissions are limited to trusted app origins. Google login runs in the normal browser rather than an embedded Google window.

## Enable on the official website

1. Apply `database/002_desktop_login.sql` in the existing Neon database's SQL editor. It stores only code hashes, PKCE challenges, user IDs and expiration timestamps—not passwords or raw codes.
2. Deploy this branch's website changes to the official domain. The desktop cannot use this feature against the old deployed website.
3. Keep the existing `DATABASE_URL`, Firebase web configuration and `FIREBASE_SERVICE_ACCOUNT_JSON` on the website server. The service account must be able to sign Firebase custom tokens; when using the existing JSON private-key credential this is done locally by the Admin SDK. Do not add a desktop Gemini key.
4. Start local services and Electron; choose Gemini from Model. Approve the browser prompt, then return to the app. If your website sign-in is older than ten minutes, sign out and sign in again before approval.

This is a purpose-built Firebase desktop handoff using PKCE, not a general OAuth authorization server. It follows the external-browser/loopback approach described in [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html) and uses [Firebase custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens) for the app session.

Checks: `npm run desktop:test-auth`, `npm run typecheck`, `npm test`, `npm run local:test`. Auth tests exercise callback rejection, wrong proof, concurrent replay, expiration, recent sign-in, correct loopback completion and cancellation with mocked storage/token issuance. A live Neon/Firebase/Gemini session needs deployment, migration and the account owner to sign in; automated tests do not use real credentials. Electron runtime download remains unavailable on this machine, so full desktop launch is not verified.
