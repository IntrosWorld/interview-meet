---
title: 03 - Project Structure
tags: [ai-interviewer, structure, files]
---

# 03 - Project structure

## Current repository tree

```text
ai_interviewer/
├── .env                       # local secret; never commit
├── .env.example               # safe configuration template
├── .gitignore
├── package.json               # scripts and direct dependencies
├── package-lock.json          # exact dependency graph
├── server.ts                  # current application entry point
├── server.js                  # legacy Express/raw Gemini WebSocket prototype
├── test-connection.js         # old live-model connectivity helper
├── list-models.js             # model-listing helper
├── 6980e...a54.glb            # 3D asset used by the main page
├── public/
│   ├── index.html             # general interview interface
│   └── coding.html            # dedicated coding interview interface
└── obsidian_ai_interviewer/   # this documentation vault
```

## File-by-file explanation

### `server.ts`

This is the authoritative backend because `package.json` runs it. It has four responsibilities:

1. load the API key;
2. connect to Gemini Live;
3. serve HTML over HTTP;
4. translate WebSocket messages between browsers and Gemini.

The file currently keeps these responsibilities together. A larger version should split configuration, Gemini sessions, routes, and socket handlers into modules.

### `public/index.html`

A self-contained page with:

- CSS for a two-participant interview layout;
- a local camera preview;
- interview target and quick-choice chips;
- voice capture and playback;
- typed answers;
- streaming transcript rendering;
- an embedded textarea for coding rounds;
- loading/rendering of the `.glb` avatar asset.

Because CSS and JavaScript are inline, changing this one file changes the entire main UI.

### `public/coding.html`

A second self-contained page specialized for code interviews. It loads CodeMirror from a CDN, supports several languages, tracks local draft statistics, requests reviews on demand, and optionally listens for spoken review phrases.

### `.env` and `.env.example`

`.env.example` communicates required variable names without credentials. `.env` supplies the actual value on the developer’s machine. The current code reads `GOOGLE_API_KEY`.

### `package-lock.json`

This locks transitive versions. Commit it for reproducible installs. Use `npm ci` in CI/CD because it follows the lockfile exactly.

### `server.js`

This file is historical, not active. Evidence:

- it imports `express`, which is not in the current `package.json`;
- it expects `GEMINI_API_KEY`, while the active code expects `GOOGLE_API_KEY`;
- it defaults to port 3000, while the active server defaults to 8000;
- it talks directly to a raw Gemini WebSocket instead of using `@google/genai`;
- no npm script starts it.

Do not copy code from it into the current path without deliberately migrating and testing it. A cleanup commit could move it into `legacy/` or remove it after confirming it is no longer needed.

### `test-connection.js`

This helper checks whether a key can open a Live session, but its hard-coded preview model differs from the current model in `server.ts`. Preview model names change, so a reliable test should import the same model constant as the app.

### `list-models.js`

This helper calls `ai.models.list()` and prints metadata. It is useful when a hard-coded model becomes unavailable. It should validate that the API key exists before constructing the client.

### `.glb` asset

GLB is the binary form of glTF. The main page can use it as a 3D interviewer/avatar asset. Because it is served from the repository root only if explicitly routed, check the page’s loader path and server static handling when changing this asset. The current Hono server only defines `/` and `/coding`; add a binary asset route or static middleware if the browser reports a 404.

## A maintainable future structure

```text
src/
├── config.ts
├── server.ts
├── routes/
│   └── pages.ts
├── gemini/
│   ├── config.ts
│   └── session-manager.ts
└── sockets/
    ├── protocol.ts
    └── connection.ts
public/
├── index.html
├── coding.html
├── css/
├── js/
│   ├── socket-client.js
│   ├── audio.js
│   └── transcript.js
└── assets/
```

Why split it:

- protocol types become testable;
- the same audio client can be reused on both pages;
- one session manager can enforce per-user cleanup;
- CSP and static caching are easier with external scripts/styles;
- files remain short enough to understand and review.

Next: [[04_System_Architecture/04 System Architecture|04 - System Architecture]].

