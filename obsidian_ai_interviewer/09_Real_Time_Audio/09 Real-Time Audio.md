---
title: 09 - Real-Time Audio
tags: [ai-interviewer, audio, pcm, base64, web-audio]
---

# 09 - Real-time audio

This is the most technical pipeline in the application.

## Audio representation

Browser audio processing usually supplies normalized `Float32` samples between `-1.0` and `1.0`. Gemini input is sent as signed PCM16: integers between `-32768` and `32767`.

At a nominal 16 kHz mono input:

```text
16,000 samples/second × 2 bytes/sample = 32,000 bytes/second
```

Base64 increases payload size by roughly one third before JSON/WebSocket overhead.

## Request microphone access

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
  },
});
```

- mono reduces bandwidth;
- 16 kHz is sufficient for speech and matches the declared input MIME type;
- echo cancellation helps prevent Gemini’s output from being recaptured;
- noise suppression improves noisy environments.

Browsers may treat `sampleRate` as a preference rather than a guarantee. For strict correctness, inspect the actual audio context rate and resample when required.

## Build the processing graph

```js
audioContext = new AudioContext({ sampleRate: 16000 });
microphone = audioContext.createMediaStreamSource(stream);
processor = audioContext.createScriptProcessor(4096, 1, 1);
microphone.connect(processor);
processor.connect(audioContext.destination);
```

`4096` is the number of frames in each callback. At 16 kHz it represents about 256 ms, trading lower callback overhead for noticeable chunk latency.

> [!note] Modernization
> `ScriptProcessorNode` is deprecated. A modern implementation should use `AudioWorkletNode`, perform conversion off the main thread, and explicitly resample.

Connecting the processor to the destination keeps processing active in some browsers. This can risk microphone monitoring; use a zero-gain node or AudioWorklet design to ensure captured input is not audibly looped back.

## Convert Float32 to PCM16

```js
function convertFloat32ToInt16(samples) {
  const output = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    output[i] = sample < 0
      ? sample * 0x8000
      : sample * 0x7fff;
  }
  return output;
}
```

Step by step:

1. allocate a same-length signed 16-bit array;
2. clamp out-of-range samples to prevent integer overflow;
3. use 32768 for the negative range and 32767 for the positive range;
4. typed-array assignment truncates the floating result to an integer.

## Convert bytes to Base64

```js
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
```

`Int16Array.buffer` is raw binary. A `Uint8Array` exposes individual bytes. `btoa` expects a binary string and returns ASCII Base64 that can be embedded in JSON.

For large chunks, repeated string concatenation can be expensive. Smaller chunks, chunked conversion, binary WebSocket frames, or an efficient encoder can reduce CPU and allocation pressure.

## Send input

```js
ws.send(JSON.stringify({
  type: 'realtimeInput',
  audioData: base64Audio,
}));
```

Before sending, always check `ws.readyState === WebSocket.OPEN`. A production version should also guard against excessive `ws.bufferedAmount`.

## Backend forwarding

The server wraps the Base64 string:

```ts
session.sendRealtimeInput({
  media: {
    data: message.audioData,
    mimeType: 'audio/pcm;rate=16000',
  },
});
```

No decoding/re-encoding is necessary on Node.

## Decode model audio

The browser performs the reverse conversion:

```js
const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
const output = new Float32Array(bytes.length / 2);

for (let i = 0; i < output.length; i++) {
  let sample = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
  if (sample >= 32768) sample -= 65536;
  output[i] = sample / 32768;
}
```

The two bytes are interpreted little-endian. Subtracting 65536 converts unsigned values `32768..65535` into their signed two’s-complement equivalents.

## Determine output rate

```js
function getSampleRate(mimeType) {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 24000;
}
```

The project defaults model output to 24 kHz if metadata is missing. Using the returned MIME rate prevents slow/fast playback.

## Schedule gapless output

```js
if (nextStartTime < audioContext.currentTime) {
  nextStartTime = audioContext.currentTime;
}
source.start(nextStartTime);
nextStartTime += audioBuffer.duration;
```

Starting every chunk “now” could overlap chunks or create gaps. `nextStartTime` forms a continuous timeline. The queue drains quickly by scheduling sources into the future.

## Autoplay policy

Browsers can create an `AudioContext` in the `suspended` state until a click/tap. The coding page explicitly calls `resume()` during its Start action and displays a warning if blocked. The main page relies on Start being a user gesture, but it should adopt the same explicit unlock logic.

## Cleanup

Stopping should:

- set `isRecording = false`;
- disconnect the processor and microphone nodes;
- stop every microphone `MediaStreamTrack` (the current main page disconnects nodes but does not retain/stop the stream tracks explicitly);
- close the `AudioContext`;
- cancel speaking timers;
- clear queued audio;
- close the WebSocket.

## Audio debugging checklist

- Inspect microphone permission in browser site settings.
- Confirm the socket is open before input chunks are sent.
- Log actual capture sample rate, chunk length, and `bufferedAmount`—not audio contents.
- Confirm Gemini’s returned MIME type includes the expected rate.
- Use headphones to distinguish playback failure from echo cancellation.
- Check whether `AudioContext.state` is `running`.
- Do not test microphone capture from a non-secure remote HTTP origin; use HTTPS.

Next: [[10_Coding_Interview_Mode/10 Coding Interview Mode|10 - Coding Interview Mode]].

