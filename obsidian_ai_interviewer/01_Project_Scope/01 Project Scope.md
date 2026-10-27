---
title: 01 - Project Scope
tags: [ai-interviewer, requirements, product]
---

# 01 - Project scope

## Problem statement

Traditional interview practice is usually asynchronous: a candidate reads questions, writes answers, and later checks a solution. This project creates a live interviewer that can speak, listen, transcribe its own output, accept text, and review code during a continuous session.

## Functional requirements

### General interview

1. The candidate supplies an interview target.
2. The browser opens a WebSocket to the local backend.
3. The backend asks Gemini to start the interview for that target.
4. The browser captures microphone audio continuously.
5. Gemini hears the audio and sends spoken responses.
6. The browser plays the response and renders its transcription.
7. The candidate can also send typed answers.
8. The candidate can end the session and release microphone resources.

### Coding round inside the main interview

The system prompt permits two invisible control tokens:

```text
[[OPEN_EDITOR]]
[[CLOSE_EDITOR]]
```

The browser removes those tokens from visible transcription. It uses them as commands to show or hide the embedded coding panel. A phrase-based fallback also detects sentences such as “start coding round” in case the model omits the token.

### Coding-only assessment

1. Choose one supported language and enter a topic.
2. Start a WebSocket session.
3. Ask Gemini for exactly one coding problem.
4. Enable CodeMirror and keep draft changes in the browser.
5. Send code only when the candidate asks for review.
6. Avoid resending identical code; request follow-up feedback instead.
7. Optionally detect phrases such as “can you check now” with browser speech recognition.

## Non-functional requirements

- **Low latency:** use streaming rather than recording a complete file.
- **Secret isolation:** keep `GOOGLE_API_KEY` on the server.
- **Browser safety:** ask for microphone/camera permission only after a user gesture.
- **Readable state:** clearly show connected, listening, speaking, and review states.
- **Graceful cleanup:** close streams, audio contexts, timers, and sockets.
- **Useful failure messages:** distinguish API, socket, microphone, and autoplay problems.

## Current design decisions

### Vanilla frontend

The project intentionally avoids a frontend build system. Each page contains its HTML, CSS, and JavaScript in one file. This makes the demo easy to run but makes large-scale maintenance harder.

### Hono backend

Hono provides small route definitions while `@hono/node-server` adapts Hono’s Fetch-style handler to Node’s HTTP server.

### One Gemini session at process startup

The current backend opens one Gemini Live session before serving the site and shares it across browser clients. This is simple for a single-user local demonstration.

> [!danger] Production limitation
> A shared session can mix context and responses between users. A production server must create one Gemini session per authenticated browser session and close it when that browser disconnects.

### Lazy browser connection

The page initially displays **Disconnected**. This does not mean the server is down. The browser intentionally calls `new WebSocket(...)` only after the candidate clicks Start. This also aligns audio setup with a user gesture required by browser autoplay rules.

## Out of scope in the current repository

- user accounts and authentication;
- database persistence;
- interview history and scoring dashboards;
- server-side code execution;
- camera frames sent to Gemini;
- rate limits, quotas, and billing controls;
- multi-instance session coordination;
- automated unit or end-to-end tests.

These are described as extensions in [[13_Security_and_Production/13 Security and Production|Security and Production]].

Next: [[02_Prerequisites_and_Setup/02 Prerequisites and Setup|02 - Prerequisites and Setup]].

