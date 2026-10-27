---
title: 12 - Testing and Debugging
tags: [ai-interviewer, testing, debugging, troubleshooting]
---

# 12 - Testing and debugging

Debug one boundary at a time: process, HTTP, browser socket, Gemini session, input audio, then output audio.

## Local smoke test

Start the app:

```powershell
npm run dev
```

Verify the listener:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
```

Verify HTTP:

```powershell
$response = Invoke-WebRequest http://localhost:8000 -UseBasicParsing
$response.StatusCode
```

Expected result is `200`.

## Understand the initial Disconnected label

The server can be healthy while the page says **Disconnected**. In the current frontend, `new WebSocket(...)` is called only after Start. Correct test sequence:

1. load the page;
2. enter/select a target;
3. click Start Interview;
4. allow microphone access;
5. observe `WebSocket client connected` in server logs;
6. observe the status change to Connected.

If the server never logs a browser connection, investigate the button state, JavaScript console, page URL, or WebSocket proxy—not Gemini.

## Log signatures

| Log/event | Meaning |
|---|---|
| `Live Session Opened Successfully` | SDK transport opened |
| `setupComplete` | Gemini accepted Live setup |
| `Server running ...` | HTTP listener created |
| `WebSocket client connected` | Browser completed WebSocket upgrade |
| `Received output transcription` | Model speech transcript arrived |
| `WebSocket client disconnected` | Browser ended/reloaded/socket failed |

## Common failures

### `API key must be set`

Cause: missing or empty `GOOGLE_API_KEY`.

Fix: edit root `.env`, ensure the exact variable name is used, and restart. Do not use the legacy `GEMINI_API_KEY` name from `server.js`.

### HTTP works but UI stays Disconnected after Start

Check browser DevTools:

- Console for JavaScript exceptions.
- Network → WS for the WebSocket handshake.
- whether the requested URL uses the correct `ws:` or `wss:` scheme.
- whether a reverse proxy forwards `Upgrade` and `Connection` headers.

### Microphone denied

Reset site permissions, reload, and click Start again. On remote hosts, use HTTPS. Verify another application is not exclusively using the device.

### Connected but no audio

- Check that `audioStream` frames appear in WS messages.
- Check `AudioContext.state` and call `resume()` from a user gesture.
- Confirm the MIME sample rate.
- Check speaker/output selection and system volume.
- Inspect browser console for `createBuffer` or decode errors.

### Model closes immediately

Possible causes include unsupported/retired model name, key restrictions, quota, region/account eligibility, or invalid Live configuration. Test the exact same model/configuration used by `server.ts`; do not rely on the older helper’s different model.

### Text chunks run together

The UI uses spacing heuristics and a 900 ms timer. Improve the backend protocol by forwarding a model-turn-complete event and assemble transcription by explicit turn identifiers.

### CodeMirror is plain textarea

The CDN may be unreachable or blocked by CSP. Check CSS/script requests. The fallback is functional but lacks highlighting. For reliability, install/bundle editor assets locally.

### Voice trigger unsupported

`SpeechRecognition`/`webkitSpeechRecognition` is browser-dependent. Use a supported Chromium browser or keep using the Review Now button.

## Testing layers to add

### Unit tests

Good pure-function targets:

- Float32-to-PCM16 boundaries (`-1`, `0`, `1`, values outside range);
- PCM16 Base64 round trip;
- MIME sample-rate parsing;
- code normalization and duplicate signatures;
- Gemini control-token sanitation when a token is split across chunks;
- client message schema validation.

### Integration tests

Start the server with a fake Gemini adapter and assert:

- `/` and `/coding` return HTML;
- a WebSocket client can connect;
- client message types invoke the correct adapter method;
- adapter audio/text events go only to the owning socket;
- invalid JSON returns a structured error rather than crashing.

### Browser end-to-end tests

Use a browser automation framework with fake media devices to verify:

- Start button validation;
- status transitions;
- typed-answer transcript;
- coding editor enable/disable;
- explicit review payloads;
- cleanup after End;
- audio autoplay warning behavior.

### Manual real-device tests

Automation cannot fully replace tests for microphone quality, echo, speakers, permissions, and long-session drift. Test headphones and speakers, quiet and noisy rooms, denied permissions, slow networks, and a session of at least 20 minutes.

## Debugging hygiene

- Log message types and byte counts, not raw Base64/audio.
- Redact API keys and authorization values.
- Avoid logging full code/transcripts in production.
- Include a generated session/request ID, never the secret.
- Keep browser and server clocks visible when investigating latency.

Next: [[13_Security_and_Production/13 Security and Production|13 - Security and Production]].

