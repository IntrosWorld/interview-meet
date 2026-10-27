---
title: 10 - Coding Interview Mode
tags: [ai-interviewer, coding, codemirror, speech-recognition]
---

# 10 - Coding interview mode

The dedicated coding page at `/coding` is independent from the embedded textarea on the main page. It has its own UI, state, socket client, transcript, audio player, and CodeMirror integration.

## Page layout

The left panel contains language/topic configuration, Start/End controls, and connection/sync indicators. The right side contains the code editor and transcript. This layout keeps problem discussion visible while editing.

## CodeMirror loading

The page loads CodeMirror 5 CSS, core JavaScript, several language modes, bracket helpers, and a dark theme from cdnjs.

```js
editor = window.CodeMirror.fromTextArea(codeEditor, {
  mode: 'text/plain',
  theme: 'material-darker',
  lineNumbers: true,
  styleActiveLine: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  indentUnit: 2,
  tabSize: 2,
  readOnly: 'nocursor',
});
```

CodeMirror transforms the fallback `<textarea>` into an editor. If the CDN fails, the code keeps the textarea and attaches a normal input listener, so basic editing still works.

### Language mapping

```js
const LANGUAGE_TO_MODE = {
  JavaScript: 'javascript',
  TypeScript: 'text/typescript',
  Python: 'python',
  Java: 'text/x-java',
  'C++': 'text/x-c++src',
  Go: 'go',
};
```

The human-facing select value differs from CodeMirror’s mode identifier. `updateEditorMode` bridges them and updates the visible mode pill.

## Draft privacy and token control

Every editor change calls `queueDraftOnly()`:

- update line/character statistics;
- show “Draft changed (not sent)”;
- keep code inside the browser;
- tell the user how to request a review.

This is an excellent default because sending code on every keystroke would consume bandwidth/tokens, flood the model, and expose partial drafts unnecessarily.

## Requesting a review

Reviews can be triggered by:

- clicking **Review Now**;
- pressing Ctrl+Enter or Cmd+Enter;
- enabling the voice trigger and saying a matching phrase.

`requestCodeReview` normalizes Windows newlines and removes trailing whitespace. It compares the result with `lastReviewedCode`.

If changed, the full draft is sent. If unchanged, an empty code string plus `codeChanged: false` asks the backend for a follow-up on the existing context.

## Backend review branches

The `liveCodeUpdate` handler has three meaningful paths:

### New draft

It sends:

```text
CODE_REVIEW_UPDATE language=Python topic=Graphs

<candidate code>

Review in this order: correctness, complexity, and edge cases.
End with one concise follow-up question.
```

### Unchanged draft follow-up

It does not resend code. It tells Gemini to give one concrete improvement and ask one targeted question.

### Duplicate payload detected server-side

The server’s `WeakMap` remembers the last full payload. If a full duplicate somehow arrives, it requests a specific missing block/improvement instead of repeating generic feedback.

These layers protect against accidental duplicate sends in both the browser and backend.

## Voice review trigger

The Web Speech API is separate from Gemini audio input:

```js
const SpeechRecognitionCtor =
  window.SpeechRecognition || window.webkitSpeechRecognition;
```

Configuration:

- language `en-US`;
- continuous recognition;
- interim results enabled;
- one alternative.

Recognized text is lowercased and searched for phrases such as “review now,” “check my code,” or “is this correct.” A 2.5-second cooldown prevents repeated interim transcripts from sending multiple reviews.

### Recognition lifecycle

Browser speech recognition can end unexpectedly. The page’s `onend` callback restarts it after 350 ms only if:

- voice trigger is still enabled;
- coding session is active;
- WebSocket remains open.

Permission errors disable the feature. Temporary errors display a message and allow restart. The feature is optional because browser support varies.

## Transcript sanitation

Coding responses are cleaned before display:

- remove editor-control tokens that do not apply to coding-only mode;
- turn `\text{value}` into `value`;
- turn `\le` into `<=`;
- remove dollar signs used as LaTeX delimiters.

This improves plain-text readability but is a heuristic. It could remove legitimate dollar signs from a currency problem. Prefer asking for plain text and handling structured Markdown intentionally.

## Audio playback

The coding page reimplements the same Base64 PCM decode and scheduling logic as the main page, with stronger autoplay handling through `ensureAudioContextUnlocked()`.

This duplication is a refactoring opportunity: move shared socket, transcript, PCM, and queue utilities into files under `public/js/`.

## Starting and ending

Start is enabled only when language and topic are non-empty. Clicking it:

1. unlocks browser audio;
2. opens the socket;
3. sends `startCodingInterview`;
4. enables the editor/review controls;
5. locks language/topic fields;
6. marks live review active.

End closes the socket and audio context, stops speech recognition, unlocks configuration fields, disables the editor, and resets state.

## What this page does not do

- It does not execute untrusted code.
- It does not automatically save drafts to disk or a database.
- It does not continuously send code.
- It does not provide deterministic compiler feedback.

If code execution is added, run it only inside a hardened sandbox with strict CPU, memory, time, filesystem, and network limits.

Next: [[11_End_to_End_Build/11 End-to-End Build|11 - End-to-End Build]].

