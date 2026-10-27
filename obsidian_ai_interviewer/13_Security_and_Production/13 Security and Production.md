---
title: 13 - Security and Production
tags: [ai-interviewer, security, production, deployment]
---

# 13 - Security and production

The current project is a local single-user demo. Deploying it unchanged would create privacy, isolation, cost, and reliability risks.

## Secrets

- Keep `GOOGLE_API_KEY` only in server-side environment variables.
- Never send it through WebSocket messages or embed it in HTML.
- Use the hosting platform’s secret manager, not a committed `.env`.
- Restrict the key where the provider supports it.
- Rotate immediately if it appears in Git history or logs.
- Run secret scanning in CI.

## Per-user session isolation

The highest-priority architectural change is replacing the shared Gemini session and broadcast set. Create one AI session for each accepted/authenticated browser socket.

Without this change, one user can receive another user’s model audio/transcript and contribute to the same AI context.

## Authentication and authorization

Add authenticated HTTP sessions or short-lived signed tokens. Validate the token during WebSocket upgrade. Do not accept arbitrary cross-site WebSocket connections.

## Origin and CORS policy

The current `cors()` middleware allows broad cross-origin access. Production should list the exact frontend origin. Validate the WebSocket `Origin` header separately because CORS is primarily an HTTP browser policy and does not automatically secure WebSockets.

## Input validation

For each message type enforce:

- allowed fields;
- field types;
- enum values for language/message type;
- maximum target/topic/text/code length;
- maximum audio chunk size;
- overall message rate;
- valid Base64 where required.

Close abusive sockets with an appropriate policy violation code.

## Cost controls

- authenticate users;
- limit concurrent sessions per user/IP;
- enforce maximum session duration and idle timeout;
- limit audio bitrate/chunk rate;
- cap code-review requests;
- track usage and alarms;
- close Gemini immediately when browser disconnects.

## Privacy and consent

Voice, transcripts, interview answers, and code can be personal or confidential. Before recording/storing anything:

- obtain explicit consent;
- explain which provider processes the data;
- document retention and deletion;
- encrypt stored records;
- restrict staff access;
- avoid storing raw audio unless the product requires it;
- support deletion/export where applicable.

The current app streams data and does not implement a database, but provider processing and server logs still matter.

## Transport security

Use HTTPS and WSS outside localhost. Configure the reverse proxy to support long-lived upgrades and suitable idle timeouts.

Example proxy concepts:

```text
HTTP/1.1 upgrade enabled
Upgrade header forwarded
Connection: upgrade forwarded
read timeout longer than expected interview turn/session
request body limits compatible with audio messages
```

## Content Security Policy

The pages contain inline CSS/JS and load fonts/CodeMirror from CDNs, which makes a strict CSP harder. For production:

1. move scripts/styles to separate local files;
2. self-host dependencies or use pinned versions plus integrity metadata;
3. disallow unneeded origins;
4. avoid `unsafe-inline` when possible;
5. keep transcript rendering on `textContent`.

## Error handling

Do not expose SDK stack traces or provider internals to browsers. Send safe structured errors:

```json
{
  "type": "error",
  "code": "AI_SESSION_UNAVAILABLE",
  "message": "The interview service is temporarily unavailable."
}
```

Log internal details with a correlation ID.

## Availability

- Start HTTP independently from Gemini so `/health` can report degraded state.
- Distinguish liveness from readiness.
- Apply bounded reconnect/backoff for transient failures.
- Do not retry user turns blindly because that can duplicate model responses/cost.
- close orphan sessions during shutdown.
- if horizontally scaling, use sticky connections or an explicit session-routing design.

## Code execution warning

The current project reviews code as text and does not run it. If execution is added, never use the main Node process or host shell. Use a dedicated sandbox with:

- no secrets;
- no network by default;
- read-only minimal filesystem;
- CPU/memory/process limits;
- strict wall-clock timeout;
- output-size limit;
- disposable environment;
- language/runtime allowlist.

## Production readiness checklist

- [ ] One Gemini session per authorized socket.
- [ ] HTTPS/WSS and strict allowed origins.
- [ ] Runtime schema validation and size limits.
- [ ] Rate, concurrency, idle, and duration limits.
- [ ] Provider failures returned safely to the correct browser.
- [ ] Secrets managed and rotated outside Git.
- [ ] Logging excludes secrets, raw audio, and unnecessary transcripts.
- [ ] Consent, retention, deletion, and privacy notices exist.
- [ ] Graceful process shutdown closes all external sessions.
- [ ] Automated and real-device tests cover reconnect/cleanup.
- [ ] Dependencies are audited and deliberately upgraded.

Next: [[14_Reference/14 Reference|14 - Reference]].

