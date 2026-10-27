---
title: 05 - Backend Foundation
tags: [ai-interviewer, backend, hono, websocket, typescript]
---

# 05 - Backend foundation

This section reconstructs the active `server.ts` from top to bottom.

## Imports

```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleGenAI, Modality } from '@google/genai';
import * as types from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
```

- `serve` creates the actual Node HTTP server.
- `Hono` creates a Fetch-style routing application.
- `cors` adds cross-origin headers. The current wildcard use is convenient but overly broad for production.
- `GoogleGenAI` creates the SDK client; `Modality` avoids spelling response modes manually.
- `types` supplies SDK TypeScript types such as `Blob` and `LiveServerMessage`.
- `WebSocketServer` accepts upgraded browser connections; `WebSocket` provides state constants.
- `readFile` asynchronously loads HTML.
- `dotenv` fills `process.env` from `.env`.

## Configuration and validation

Current code:

```ts
dotenv.config();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
```

A stronger from-scratch version fails with a direct message:

```ts
dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();
if (!GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY in .env');
}

const PORT = Number(process.env.PORT ?? 8000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer from 1 through 65535');
}
```

Validation turns an indirect SDK stack trace into an actionable configuration error.

## Audio blob helper

```ts
export function createBlob(audioData: string): types.Blob {
  return {
    data: audioData,
    mimeType: 'audio/pcm;rate=16000',
  };
}
```

`audioData` is already Base64; the function does not decode it. The SDK’s `Blob` structure carries the encoded bytes and a MIME description. The fixed rate must match the browser’s capture/encoding assumptions.

## Debug helper

```ts
export function debug(data: object): string {
  return JSON.stringify(data);
}
```

This makes nested Gemini messages readable in logs. In production, avoid logging full message bodies because transcripts can contain personal data.

## Main application scope

```ts
async function main() {
  const clients = new Set<WebSocket>();
  const lastCodePayloadBySocket = new WeakMap<WebSocket, string>();
  const latestCodeSnapshotBySocket = new WeakMap<
    WebSocket,
    { language: string; topic: string; code: string }
  >();
  // ...
}

main();
```

Why these collections exist:

- `clients` enables broadcasting Gemini output to connected pages.
- `lastCodePayloadBySocket` prevents identical code-review content from being treated as new code.
- `latestCodeSnapshotBySocket` keeps the last language/topic/draft context for a socket.
- `WeakMap` lets entries become collectible when a socket has no remaining references. It cannot be iterated, which is fine here.

## Serve the pages

```ts
const app = new Hono();
app.use('/*', cors());

app.get('/', async (c) => {
  const html = await readFile('./public/index.html', 'utf-8');
  return c.html(html);
});

app.get('/coding', async (c) => {
  const html = await readFile('./public/coding.html', 'utf-8');
  return c.html(html);
});
```

`c.html(...)` sets an HTML content type. The files are read on every request, which is convenient during development. For production, cache them or use static middleware.

The relative paths depend on the process being launched from the repository root. To make paths independent of the current working directory, resolve them from `import.meta.url`.

## Share the HTTP server with WebSockets

```ts
const server = serve({
  fetch: app.fetch,
  port: Number(process.env.PORT || 8000),
});

const wss = new WebSocketServer({ server });
```

An incoming normal request is handled by Hono. An incoming WebSocket upgrade is handled by `wss`. Both use the same host and port, so the frontend can connect to `window.location.host` without another configuration variable.

## Accept a browser socket

```ts
wss.on('connection', (socket) => {
  clients.add(socket);

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      // dispatch by message.type
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});
```

Every browser message is a UTF-8 JSON string. `data.toString()` converts the `ws` raw data value before parsing. Cleanup prevents broadcasting to stale clients.

## Broadcast helper worth extracting

The current code repeats an open-state check. A reusable version is:

```ts
function sendJson(socket: WebSocket, value: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(value));
  }
}

function broadcast(value: unknown) {
  for (const client of clients) {
    sendJson(client, value);
  }
}
```

## Error boundaries to add

The current `main()` call is not caught. Prefer:

```ts
main().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exitCode = 1;
});
```

Also add process signal handlers that close WebSockets, Gemini sessions, and the HTTP server on `SIGINT`/`SIGTERM`.

Next: [[06_Gemini_Live_Integration/06 Gemini Live Integration|06 - Gemini Live Integration]].

