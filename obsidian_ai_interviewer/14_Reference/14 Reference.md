---
title: 14 - Reference
tags: [ai-interviewer, reference, glossary, commands]
---

# 14 - Reference

## Current routes

| Route | Result |
|---|---|
| `GET /` | Main general interview page |
| `GET /coding` | Dedicated coding interview page |
| WebSocket `/` | Browser message transport |

## Current environment variables

| Name | Required | Default | Purpose |
|---|---:|---:|---|
| `GOOGLE_API_KEY` | Yes | none | Gemini Developer API authentication |
| `PORT` | No | `8000` | HTTP/WebSocket listener port |

The legacy `server.js` uses `GEMINI_API_KEY`; that is not the variable used by the active `server.ts`.

## Current commands

```powershell
# Install according to package.json/package-lock
npm install

# Start TypeScript in watch mode
npm run dev

# Check repository changes
git status --short

# Confirm the local listener
Get-NetTCPConnection -LocalPort 8000 -State Listen

# Confirm the home page
Invoke-WebRequest http://localhost:8000 -UseBasicParsing
```

## Message quick reference

| Direction | Type | Main fields |
|---|---|---|
| Browser → server | `startInterview` | `interviewTarget` |
| Browser → server | `contentUpdateText` | `text` |
| Browser → server | `realtimeInput` | `audioData` |
| Browser → server | `startCodingInterview` | `language`, `topic` |
| Browser → server | `codeSnapshot` | `language`, `topic`, `code` |
| Browser → server | `codingVoiceDoubtStart` | `language`, `topic` |
| Browser → server | `liveCodeUpdate` | `language`, `topic`, `code`, `requestReview`, `codeChanged` |
| Server → browser | `audioStream` | `data`, `mimeType` |
| Server → browser | `textStream` | `data` |
| Server → browser | `error` | `message` |

## Important source functions

### `server.ts`

- `createBlob`: marks Base64 browser audio as 16 kHz PCM.
- `debug`: JSON-serializes Gemini messages for logging.
- `main`: creates SDK/session, routes, server, and socket handlers.

### `public/index.html`

- `connectWebSocket`: opens lazy browser connection.
- `startRecording` / `stopRecording`: microphone graph lifecycle.
- `convertFloat32ToInt16`: capture sample conversion.
- `arrayBufferToBase64`: JSON-safe audio encoding.
- `base64ToFloat32AudioData`: model-audio decoding.
- `playAudioQueue`: gapless scheduled playback.
- `appendGeminiText`: streaming transcript assembly.
- `sanitizeGeminiChunk`: editor command detection/removal.
- `toggleCamera`: local preview lifecycle.
- `submitCode`: explicit, deduplicated embedded code submission.
- `resetSessionState`: restore idle UI.

### `public/coding.html`

- `initEditor`: CodeMirror setup with textarea fallback.
- `updateEditorMode`: maps selected language to syntax mode.
- `queueDraftOnly`: preserves local-only draft behavior.
- `requestCodeReview`: changed/unchanged review protocol.
- `createAndStartRecognition`: optional browser speech recognition.
- `maybeTriggerVoiceReview`: phrase matching plus cooldown.
- `ensureAudioContextUnlocked`: browser autoplay handling.
- `resetState`: coding-session cleanup.

## Glossary

**AudioContext** — Web Audio graph and scheduling clock.

**Base64** — binary-to-text representation; not encryption.

**CORS** — browser HTTP cross-origin access rules. It does not replace authentication.

**Gemini Live** — streaming, bidirectional Gemini session interface.

**Hono** — lightweight web framework using Fetch-style handlers.

**Inline data** — SDK message part containing encoded binary content plus MIME metadata.

**Little-endian** — byte order where the least significant byte appears first; used by this PCM decode logic.

**Modality** — response form such as audio or text.

**PCM16** — raw signed 16-bit audio samples without a file container.

**RMS** — root mean square signal magnitude; used as a simple speaking indicator.

**Turn complete** — marker indicating a user content turn is ready for model response.

**WebSocket** — long-lived full-duplex connection established through an HTTP upgrade.

**WeakMap** — key/value collection whose object keys do not prevent garbage collection.

## Suggested next refactors

1. Create a Gemini session per browser socket.
2. Share browser audio/socket code between the two pages.
3. Add message schemas and protocol types.
4. Add explicit `ready`, `turnComplete`, and structured UI-command events.
5. Replace `ScriptProcessorNode` with AudioWorklet.
6. Stop microphone tracks explicitly during cleanup.
7. Move inline CSS/JS into static files.
8. Add health/readiness routes and tests.
9. Align or remove legacy helper files.
10. Add authentication, quotas, privacy policy, and production telemetry.

Return to [[README|Vault Home]] or [[00_Start_Here/00 Start Here|Start Here]].

