---
title: 04 - System Architecture
tags: [ai-interviewer, architecture, data-flow]
---

# 04 - System architecture

## Components

```mermaid
flowchart TB
    subgraph Browser["Browser"]
      UI["HTML/CSS controls"]
      MIC["getUserMedia microphone"]
      WA["Web Audio API"]
      CAM["local camera preview"]
      CM["CodeMirror / textarea"]
      WSC["WebSocket client"]
    end

    subgraph Node["Node.js process"]
      H["Hono routes"]
      WSS["ws WebSocketServer"]
      AD["message adapter"]
      GS["Gemini Live SDK session"]
    end

    G["Google Gemini Live API"]

    UI --> WSC
    MIC --> WA --> WSC
    CM --> WSC
    CAM --> UI
    H --> UI
    WSC <-->|"JSON messages"| WSS
    WSS <--> AD <--> GS <--> G
    WSC --> WA
```

The camera currently stays local. Only microphone audio, text, code, language, topic, and control messages travel through the socket.

## Startup sequence

```mermaid
sequenceDiagram
    participant N as Node process
    participant E as .env
    participant G as Gemini Live
    participant H as HTTP server
    participant B as Browser

    N->>E: Load GOOGLE_API_KEY
    N->>G: ai.live.connect(model, config, callbacks)
    G-->>N: onopen
    G-->>N: setupComplete
    N->>H: listen on PORT or 8000
    B->>H: GET /
    H-->>B: public/index.html
    Note over B: UI still says Disconnected
    B->>H: WebSocket upgrade after Start click
    H-->>B: WebSocket open
    Note over B: UI changes to Connected
```

In the current code, an API failure can prevent the HTTP server from starting because Gemini is connected before `serve(...)` is called. A more resilient design starts HTTP first, reports AI availability separately, and creates a Gemini session per browser connection.

## Voice turn data flow

```mermaid
sequenceDiagram
    participant M as Microphone
    participant B as Browser
    participant S as Node server
    participant G as Gemini
    participant P as Speakers

    M->>B: Float32 samples at requested 16 kHz
    B->>B: Clamp and convert to signed PCM16
    B->>B: Encode bytes as Base64
    B->>S: realtimeInput JSON
    S->>G: session.sendRealtimeInput(media blob)
    G-->>S: LiveServerMessage audio chunk
    S-->>B: audioStream JSON
    B->>B: Base64 -> PCM16 -> Float32
    B->>P: Schedule AudioBuffer at returned sample rate
    G-->>S: outputTranscription chunk
    S-->>B: textStream JSON
    B->>B: Append chunk to transcript
```

## Text turn data flow

The browser sends:

```json
{
  "type": "contentUpdateText",
  "text": "I would use a hash map."
}
```

The server calls `session.sendClientContent` with one user turn and `turnComplete: true`. “Turn complete” tells the model it may respond now. This differs from live audio, which is sent as an ongoing realtime stream.

## State ownership

| State | Owner | Examples |
|---|---|---|
| API credential | Server process | `GOOGLE_API_KEY` |
| Gemini conversation | Currently global server session | system instruction, prior turns |
| Connection state | Browser and server socket | open, closing, closed |
| Microphone/camera streams | Browser | `MediaStream`, audio nodes |
| UI mode | Browser | interview started, coding panel open |
| Code draft | Browser | CodeMirror contents |
| Last reviewed code | Browser and server hints | duplicate/follow-up logic |

## Important architectural limitations

### Global session

All connected browser sockets are stored in a `Set`, and Gemini output is broadcast to every open socket. This is acceptable only for a single-user demo. Multi-user production code needs a mapping:

```ts
const sessions = new Map<WebSocket, LiveSession>();
```

Each socket should receive output only from its own session.

### No protocol validation

The server parses arbitrary JSON and trusts fields after light string conversion. Production code should validate message shape and size, reject unknown types, and rate-limit audio chunks.

### Browser APIs are capability-dependent

- Microphone and camera require permission.
- Secure contexts are required outside localhost.
- Web Speech recognition is not consistently supported across browsers.
- Audio playback can be suspended until a user gesture.

### Backpressure is not explicit

Audio chunks are sent whenever `onaudioprocess` fires. The code does not inspect `ws.bufferedAmount`. A slow network could accumulate memory. Production code should pause or drop according to a defined threshold.

Next: [[05_Backend_Foundation/05 Backend Foundation|05 - Backend Foundation]].

