---
title: 07 - WebSocket Protocol
tags: [ai-interviewer, websocket, protocol, json]
---

# 07 - WebSocket protocol

HTTP loads the page once. WebSocket then carries many messages in both directions without repeated request setup.

## Connection URL

Both pages derive the scheme and host:

```js
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
ws = new WebSocket(`${protocol}//${window.location.host}`);
```

- localhost over HTTP becomes `ws://localhost:8000`;
- a deployed HTTPS page becomes `wss://example.com`;
- using `window.location.host` preserves the current hostname and port.

## Browser-to-server messages

### `startInterview`

```json
{
  "type": "startInterview",
  "interviewTarget": "Backend Engineer L4 at Stripe"
}
```

Starts the general interview. The server ignores an empty target.

### `contentUpdateText`

```json
{
  "type": "contentUpdateText",
  "text": "I would begin by clarifying the latency requirement."
}
```

Creates one complete typed user turn.

### `realtimeInput`

```json
{
  "type": "realtimeInput",
  "audioData": "BASE64_PCM16_BYTES"
}
```

Carries a microphone chunk. The backend declares it as 16 kHz PCM.

### `startCodingInterview`

```json
{
  "type": "startCodingInterview",
  "language": "Python",
  "topic": "Graphs"
}
```

Starts coding-only mode and initializes an empty per-socket snapshot.

### `codeSnapshot`

```json
{
  "type": "codeSnapshot",
  "language": "Python",
  "topic": "Graphs",
  "code": "def bfs(graph, start): ..."
}
```

The backend supports this message for saving context, although the current `coding.html` does not send drafts automatically. That deliberate privacy/token choice keeps edits local.

### `codingVoiceDoubtStart`

Tells Gemini that the candidate is about to ask a spoken doubt. The backend can first send the latest saved code context with `turnComplete: false`, then wait for audio. The current dedicated coding page uses browser speech recognition to trigger `liveCodeUpdate` instead, so this message is available but not central to the active UI flow.

### `liveCodeUpdate`

New-code review:

```json
{
  "type": "liveCodeUpdate",
  "language": "JavaScript",
  "topic": "Arrays",
  "code": "function solve(values) { ... }",
  "requestReview": true,
  "codeChanged": true
}
```

Follow-up on unchanged code:

```json
{
  "type": "liveCodeUpdate",
  "language": "JavaScript",
  "topic": "Arrays",
  "code": "",
  "requestReview": true,
  "codeChanged": false
}
```

This distinction avoids repeatedly sending the entire code draft and gives Gemini a different follow-up instruction.

## Server-to-browser messages

### `audioStream`

```json
{
  "type": "audioStream",
  "data": "BASE64_PCM16_BYTES",
  "mimeType": "audio/pcm;rate=24000"
}
```

The browser decodes, creates an `AudioBuffer`, and schedules playback.

### `textStream`

```json
{
  "type": "textStream",
  "data": "Tell me about a time..."
}
```

`data` may be a fragment. The UI appends chunks to the active Gemini transcript line and finalizes it after roughly 900 ms without new text.

### `error`

```json
{
  "type": "error",
  "message": "Human-readable server error"
}
```

The browser already handles this type, but the active backend does not consistently send it. Add it to failure paths so errors are visible without opening the terminal.

## Dispatch behavior in `server.ts`

The message handler uses an `if/else if` chain keyed by `message.type`. This is straightforward but not type-safe. A scalable alternative:

```ts
type ClientMessage =
  | { type: 'startInterview'; interviewTarget: string }
  | { type: 'contentUpdateText'; text: string }
  | { type: 'realtimeInput'; audioData: string }
  | { type: 'startCodingInterview'; language: string; topic: string }
  | { type: 'liveCodeUpdate'; language: string; topic: string; code: string; requestReview: boolean; codeChanged: boolean };

function isClientMessage(value: unknown): value is ClientMessage {
  // Runtime schema validation still required.
  return Boolean(value && typeof value === 'object' && 'type' in value);
}
```

TypeScript types protect developers, while a runtime validator protects the server from arbitrary network input. Libraries such as Zod can enforce maximum lengths and allowed enum values.

## Protocol rules to add for production

- Define a protocol version, for example `{ "v": 1, ... }`.
- Send a server `ready` message only after Gemini setup completes.
- Cap JSON message size and reject oversized Base64 payloads.
- Check `ws.bufferedAmount` before sending more audio.
- Include request/session identifiers for tracing.
- Return structured errors with a stable `code` and user-safe `message`.
- Authenticate the WebSocket upgrade.
- Never broadcast one user’s output to another user.

Next: [[08_Main_Interview_UI/08 Main Interview UI|08 - Main Interview UI]].

