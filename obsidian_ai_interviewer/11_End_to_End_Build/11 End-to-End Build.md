---
title: 11 - End-to-End Build
tags: [ai-interviewer, tutorial, build-from-scratch]
---

# 11 - End-to-end build from an empty folder

This is the recommended implementation order. Finish and test each milestone before adding the next.

## Milestone 1 - Bootstrap

1. Create the folder and initialize npm/Git.
2. Install dependencies listed in [[02_Prerequisites_and_Setup/02 Prerequisites and Setup|Prerequisites and Setup]].
3. Add `.gitignore`, `.env.example`, and local `.env`.
4. Add the `dev` and `typecheck` scripts.
5. Create `public/index.html` and `server.ts`.

Do not begin with microphone streaming. First prove HTTP works.

## Milestone 2 - Minimal HTTP server

```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';

const app = new Hono();

app.get('/', async (c) => {
  return c.html(await readFile('./public/index.html', 'utf8'));
});

serve({ fetch: app.fetch, port: 8000 });
console.log('http://localhost:8000');
```

Minimal page:

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>AI Interviewer</title></head>
<body><h1>AI Interviewer</h1></body>
</html>
```

Test `Invoke-WebRequest http://localhost:8000` and verify HTTP 200.

## Milestone 3 - Browser WebSocket echo

Attach `WebSocketServer` to the same server and echo one test message. This isolates WebSocket routing from Gemini complexity.

Server concept:

```ts
wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'ready' }));
  socket.on('message', (raw) => {
    socket.send(raw.toString());
  });
});
```

Browser concept:

```js
const ws = new WebSocket(`ws://${location.host}`);
ws.onopen = () => ws.send(JSON.stringify({ type: 'ping' }));
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

Only proceed when the browser receives both messages.

## Milestone 4 - Gemini text turn

1. Validate `GOOGLE_API_KEY`.
2. Construct `GoogleGenAI` in Node.
3. Connect to one supported Live model.
4. Ask for audio plus output transcription.
5. Send a short `startInterview` text turn.
6. Forward transcription as `textStream`.

At this stage, you can build a text-only candidate input even though model output is audio. Seeing transcription proves the AI path works.

## Milestone 5 - Output audio

1. Detect `part.inlineData.data` in Gemini messages.
2. forward Base64 and MIME type as `audioStream`;
3. decode little-endian PCM16 in the browser;
4. create an `AudioBuffer` at the MIME sample rate;
5. schedule chunks with `nextStartTime`.

Test with headphones and a single browser tab.

## Milestone 6 - Microphone input

1. Ask permission from a Start click handler.
2. create a mono audio graph;
3. convert Float32 samples to PCM16;
4. Base64-encode the bytes;
5. send `realtimeInput` while the socket is open;
6. forward it with `session.sendRealtimeInput`.

First log chunk count and byte length, never raw audio or Base64.

## Milestone 7 - Interview controls

Add target validation and the state transition:

```text
Idle -> Connecting -> Active -> Ending -> Idle
```

Disable buttons that are invalid in the current state. Release browser resources on End.

## Milestone 8 - Transcript streaming

Create transcript rows with `textContent`. Maintain one active Gemini row and append partial text until the model turn ends or a short inactivity timeout fires.

## Milestone 9 - Camera preview

Request video separately from audio and assign it to a muted `<video autoplay playsinline>`. Keep the preview local. Stop tracks when disabled.

## Milestone 10 - Embedded coding round

Start with an explicit server message such as `{ type: 'uiCommand', command: 'openEditor' }` if designing fresh. If matching the current project, detect and remove `[[OPEN_EDITOR]]`/`[[CLOSE_EDITOR]]` from transcription.

Submit a language header and code in a completed text turn. Prevent identical submissions.

## Milestone 11 - Dedicated coding page

1. Add `/coding` route and page.
2. Add language/topic validation.
3. Load CodeMirror with a textarea fallback.
4. keep drafts local;
5. send only explicit reviews;
6. distinguish changed draft from unchanged follow-up;
7. add optional voice trigger last.

## Milestone 12 - Make sessions per browser

Before deployment, move Gemini connection creation into the browser socket handler:

```ts
wss.on('connection', async (socket) => {
  const session = await createGeminiSession({
    onAudio: (data, mimeType) => sendJson(socket, { type: 'audioStream', data, mimeType }),
    onText: (data) => sendJson(socket, { type: 'textStream', data }),
  });

  socket.on('message', (raw) => handleClientMessage(session, socket, raw));
  socket.on('close', () => session.close());
});
```

Do not broadcast AI output globally.

## Milestone 13 - Validation and resilience

- schema-validate every message;
- add maximum sizes and rate limits;
- return errors to the correct browser;
- time out stalled Gemini setup;
- retry only safe transient failures;
- expose a `/health` endpoint;
- add graceful shutdown;
- test cleanup and reconnect paths.

## Milestone 14 - Production transport

- deploy behind HTTPS/WSS;
- configure WebSocket proxy upgrades;
- restrict allowed origins;
- provide authentication;
- store secrets in the platform’s secret manager;
- add logs/metrics without storing raw audio;
- add explicit consent and retention policies.

## Definition of done

- [ ] A new developer can clone, configure, and start the app.
- [ ] General voice interview works end to end.
- [ ] Typed answers work without microphone access.
- [ ] Audio plays without gaps at the correct rate.
- [ ] End releases microphone/camera/audio/socket resources.
- [ ] Coding review sends only on explicit request.
- [ ] Two simultaneous users cannot hear each other.
- [ ] Secrets and transcripts do not enter Git/logs.
- [ ] Invalid messages cannot crash the process.
- [ ] The app works behind HTTPS and WSS.

Next: [[12_Testing_and_Debugging/12 Testing and Debugging|12 - Testing and Debugging]].

