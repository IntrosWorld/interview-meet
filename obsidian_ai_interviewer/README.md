---
title: AI Interviewer - Complete Build Guide
aliases:
  - AI Interviewer Vault
tags:
  - ai-interviewer
  - gemini-live
  - websocket
  - typescript
---

# AI Interviewer - complete build guide

This Obsidian vault explains how to rebuild the project from an empty directory, why each major block exists, and how data travels from the browser microphone to Gemini and back to the speakers.

> [!warning] Protect the API key
> Never paste a real API key into these notes, source control, screenshots, or frontend JavaScript. The real key belongs only in the ignored root `.env` file.

## Chronological learning path

1. [[00_Start_Here/00 Start Here|Start here and use the vault]]
2. [[01_Project_Scope/01 Project Scope|Define the product and its behavior]]
3. [[02_Prerequisites_and_Setup/02 Prerequisites and Setup|Install tools and configure the project]]
4. [[03_Project_Structure/03 Project Structure|Understand every repository file]]
5. [[04_System_Architecture/04 System Architecture|Understand the complete runtime architecture]]
6. [[05_Backend_Foundation/05 Backend Foundation|Build the TypeScript, Hono, and WebSocket server]]
7. [[06_Gemini_Live_Integration/06 Gemini Live Integration|Connect and configure Gemini Live]]
8. [[07_WebSocket_Protocol/07 WebSocket Protocol|Define all browser/server messages]]
9. [[08_Main_Interview_UI/08 Main Interview UI|Build the main interview page]]
10. [[09_Real_Time_Audio/09 Real-Time Audio|Capture, encode, stream, decode, and play audio]]
11. [[10_Coding_Interview_Mode/10 Coding Interview Mode|Build the coding test and live review page]]
12. [[11_End_to_End_Build/11 End-to-End Build|Recreate the project in a reliable order]]
13. [[12_Testing_and_Debugging/12 Testing and Debugging|Verify each layer and solve common failures]]
14. [[13_Security_and_Production/13 Security and Production|Harden and deploy the application]]
15. [[14_Reference/14 Reference|Use the glossary, commands, and message reference]]

## What this project uses

| Layer | Technology | Purpose |
|---|---|---|
| Browser UI | HTML, CSS, vanilla JavaScript | Interview controls, transcript, camera, editor |
| Browser audio | Web Audio API | Microphone capture and Gemini audio playback |
| Browser speech recognition | Web Speech API | Optional coding-review trigger phrases |
| Code editor | CodeMirror 5 from CDN | Syntax highlighting and editor behavior |
| HTTP server | Hono + `@hono/node-server` | Serves the two HTML pages |
| Browser transport | `ws` WebSocket server | Bidirectional low-latency messages |
| AI SDK | `@google/genai` | Gemini Live session, audio, and transcription |
| Runtime | Node.js + TypeScript + `tsx` | Runs `server.ts` without a manual compile step |

## Source-of-truth warning

The running application uses `server.ts`. The root `server.js` is an older Express/raw-WebSocket experiment and is not started by `npm run dev`. The notes explain it as a legacy artifact but build from the current TypeScript implementation.

## Recommended Obsidian settings

- Open `obsidian_ai_interviewer` as a vault.
- Turn on **Files and links → Automatically update internal links**.
- Turn on **Core plugins → Backlinks**, **Outline**, and **Graph view**.
- Keep the numbered folders because the number establishes the intended reading order.

## Current local run command

From the repository root:

```powershell
npm run dev
```

Then open `http://localhost:8000`. The initial **Disconnected** label is expected: the browser creates its WebSocket only after **Start Interview** or **Start Coding Test** is clicked.

