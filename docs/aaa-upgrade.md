# AAA branch: character evaluation and audio-timed speech

This branch replaces the first character's look with a more detailed local reference and replaces character-rate mouth guesses with **rendered audio plus engine-authored viseme timestamps**. It is a look-development prototype, not a claim of production AAA digital-human quality.

## Try it

Run `npm run local` and open http://127.0.0.1:8010. The launcher starts Ollama's existing client-side proxy, Whisper and a new local timed-speech worker. Ollama itself must already be running. In Reply voice, choose a voice ending in **timed WAV**, or click Start conversation: hands-free mode prefers a timed voice automatically. Existing browser voices remain selectable as an approximate fallback.

The character loader uses the local evaluation export when available and otherwise keeps the redistributable CC0 character. No production deployment or change to the `local` branch was made.

## Audio timing implementation

`scripts/local-tts.py` runs on loopback port 8767. It keeps a PowerShell/System.Speech renderer alive so each phrase does not pay process startup overhead. Installed Windows desktop voices synthesize PCM at an explicit **16 kHz, 16-bit, mono** format. `VisemeReached` events provide the matching audio positions, durations and SAPI viseme IDs. A WAV header is added to the exact PCM buffer; results are returned in memory, not as user transcripts written to disk.

Explicit output format matters: the first implementation's default WAV format produced a sample-rate mismatch with the event positions. A real WAV-duration/timeline validation caught this. The fixed-format version passes bounds checks against the actual audio buffer duration.

Warm render samples took roughly 75–120 ms for a short sentence on this machine. These are synthesis times, not full conversational latency or a real-time guarantee. The Windows voices are still system voices, not neural/actor-quality voice performances.

`public/timed-voice.js` schedules decoded WAV buffers using `AudioContext.currentTime`. Each facial timeline includes that same context, scheduled start and cue list. `src/client/audio-visemes.js` maps SAPI's 22 visual speech classes to Oculus mouth shapes. The face samples the playback clock, with short blend transitions. Interrupt aborts pending fetches, stops scheduled audio sources, clears cue timelines and closes the mouth. Word-boundary or text-length guesses are not used for timed WAV playback.

The Node `/api/synthesize` proxy keeps the same loopback/custom-header/origin protections as the lab. Input is limited to 600 characters and voice names are checked against locally installed voices. No Gemini, cloud TTS, or new TTS model downloads are involved.

## Character and Blender project

The AvatarSDK reference from met4citizen/TalkingHead has richer skin, beard and hair texture detail than the previous MPFB sample and retains facial shapes, teeth and eye rigs. Look development preserves the head/shoulders 16:9 camera, refines skin/eyes, relaxes the arms and adds dark professional outerwear over an ivory inset. The real-time browser receives the exported model; Blender remains the editable scene source.

Local files on F:

- `F:\AI_models\interview-meet\aaa\avatarsdk-reference.glb`: pinned upstream source.
- `F:\AI_models\interview-meet\aaa\interviewer-aaa.glb`: modified runtime export.
- `F:\AI_models\interview-meet\aaa\preview.wav` and `preview-timing.json`: synthetic demo speech and engine cue data.
- `art/aaa/interviewer-aaa.blend`: packed Blender scene, with matching WAV in the Video Sequencer and viseme keyframes at 30 fps starting at frame 15.
- `art/aaa/interviewer-aaa-final.png`: 1920×1080, 96-sample Cycles still.

Open the `.blend` and play/scrub the timeline for the timed demonstration. The live browser does not play that fixed animation; it samples newly generated audio cues for each reply.

## Asset rights and reproducibility

The upstream README identifies `avatarsdk.glb` as an AvatarSDK example created **for non-commercial use**. This does NOT have the CC0 rights of the previous MPFB character. The source model, modified export, derived Blender project and derived renders are kept local on F: and excluded from Git/Vercel upload. Do not use them in a commercial deployment or redistribute them as a production asset without the appropriate license.

Provenance: https://github.com/met4citizen/TalkingHead/tree/46b32ee539c41eb7c6b41fcfc74ae030d1b800a7 (README asset attribution section).

`npm run aaa:assets` downloads/verifies the pinned reference with SHA-256 checking, entirely under F:. With the local speech worker running, `npm run aaa:preview` generates the synthetic preview WAV/timing. With the original studio loaded, run `scripts/build-aaa-lookdev.py` inside Blender. The script creates a separate AAA project; it never saves over the original `art/interviewer-studio.blend`. Then run `npm run avatar:build` for changes to the renderer.

## Verification

- `npm run aaa:test-speech`: real local speech engine; validates RIFF/WAVE structure, PCM duration, sorted timing positions and viseme ID bounds.
- `npm run aaa:test-visemes`: deterministic closure/vowel/silence and boundary checks.
- `npm run local:test`: includes actual Web Audio playback of a test WAV driving the face, plus interruption, hands-free cycling and previous local lab checks.
- `npm run local:typecheck` and `npm run typecheck`: local and main server checks.

## Remaining production-quality gap

The visual asset is an improvement but still lacks a high-end groom, scanned pore/normal/displacement maps, fully tailored garment topology and an actor-quality facial performance. Those require a suitably licensed production character, further art work and GPU profiling. Accurate engine viseme timing solves the synchronization limitation; it does not by itself make either the voice or geometry AAA.
