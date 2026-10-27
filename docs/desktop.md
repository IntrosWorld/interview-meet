# Desktop interview and coding

On branch `aaa`. Run `npm run local` in one terminal, then `npm run desktop` in another. This is a development Electron shell, not a packaged installer. Ollama must already be running. Model downloads remain on F: as before.

If Electron's executable is missing because npm blocks install scripts, run `npm run desktop:install` first. It downloads the official runtime with its cache on F: and a three-minute timeout. During implementation this machine's GitHub download stalled, so the Electron window and real production sign-in could not be launch-tested. All 11 browser tests passed, including both shared desktop room routes.

The Model menu offers Local Interview, Local Coding, Gemini Interview and Gemini Coding. Switching destroys the previous window, stopping its microphone and active work. Local mode needs no account; conversation context remains in memory. Coding drafts are sent only when you start a problem or explicitly request review; they are never executed.

Local pages at `/desktop/interview` and `/desktop/coding` derive directly from the website's `index.html` and `coding.html`, with its shared `design.css` and `room.css`. They replace the cloud controller with the local streaming/Whisper/timed-voice controller. CodeMirror and its language modes are served locally without CDN dependencies. Local voice answers use Whisper; code review is requested explicitly with Review Now.

Gemini mode loads only `https://interview-meet.mohitnaik.tech/login` with the interview or coding destination. It uses the existing website Firebase sign-in and server-side authentication. No Gemini API key is needed in Electron or the local server; the website operator must keep its existing Gemini key and Firebase server configuration on the website's backend. This is website mode inside Electron, not a new unauthenticated local Gemini proxy. Logging out is done on the official website. Local and official website storage use separate Electron sessions.

Email/password login is supported by the existing site. Google may reject sign-in in embedded browsers; if that occurs, use email/password on the official site. External system-browser Google login with a desktop handoff would require a separate authorization-code/PKCE flow and has not been implemented. Never paste ID tokens or API keys into the app.

Renderers are sandboxed with Node disabled and context isolation enabled; no preload or privileged IPC bridge is exposed. Navigation and popups are restricted to the local/official site and HTTPS Firebase/Google sign-in origins. Media permissions are limited to trusted app origins.

Checks: `npm run local:typecheck`, `npm run local:test`. A live production Firebase/Gemini session needs the account owner to sign in; automated tests do not use real credentials.
