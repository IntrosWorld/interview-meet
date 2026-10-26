# Blender interviewer

Created through the live Blender 5.1 MCP connection on branch `local`. Blender is the editable source of truth; Three.js displays its exported assets in the local lab. The 3D asset pipeline skill guided the GLB separation, preserved facial-shape naming and runtime checks.

## Files

- `art/interviewer-studio.blend`: packed editable character, wardrobe, studio, camera, lights, facial shape keys and an eight-second demonstration performance (frames 1–240 at 30 fps).
- `art/renders/interviewer-final0001.png`: Cycles 48-sample denoised still at 1600×900.
- `public/models/interviewer.glb`: runtime character including skinning and facial shapes.
- `public/models/interviewer-studio.glb`: runtime studio geometry.
- `scripts/build-interviewer-studio.py`: reproducible scene construction script. Execute inside a NEW/verified scene; it clears that scene before building. Do not run it over unrelated unsaved Blender work.
- `src/client/interviewer.js`: Three.js renderer and runtime facial motion.
- `public/local-voice.js`: browser utterance start/boundary/end/cancel hooks.

The portrait camera is at eye level with a 16:9 head/shoulders/upper-chest crop. The character wears charcoal outerwear over an ivory shirt. The Blender scene includes a desk and full body for editing, but those are outside the webcam frame. Soft key/fill/rim lights and eye catchlights are explicit scene objects. Cycles skin uses subtle procedural roughness/bump and subsurface scattering; these effects do not fully transfer to glTF materials.

## Run and edit

Open the `.blend` file in Blender, use camera view (Numpad 0), and scrub the timeline for the preview performance. Frame 1 is the neutral portrait. Material and lighting controls are named in the Outliner. Facial keys such as `jawOpen`, `viseme_aa`, `viseme_O` and `eyeBlinkLeft` are preserved for runtime animation.

After editing source JavaScript, run `npm run avatar:build`. The browser bundle includes Three.js and GLTFLoader; no runtime CDN is required. `npm run local` serves the talking scene at http://127.0.0.1:8010. Choose a local reply voice or start hands-free mode to hear and see responses.

The browser renderer caps pixel ratio at 1.5 and targets at most 30 fps, with a 1024 shadow map. Idle motion can be paused and respects reduced-motion preference. Chat and voice remain usable if WebGL cannot initialize. Canvas resources are disposed on page exit. Test with `npm run local:test`.

## Honest quality limits

This is an interactive cinematic prototype, **not a photorealistic AAA digital human**. The reused CC0 human asset has visible limitations in hair geometry, garment topology, skin texture detail and facial anatomy. Studio lighting cannot replace scanned geometry, high-resolution skin maps, groomed hair or an actor-quality performance rig. An AAA target requires a higher-fidelity licensed/scanned character and a dedicated look-development pass.

Lip motion starts and stops with actual browser speech events and uses word-boundary callbacks where supplied. The individual mouth shapes are estimated from text and elapsed time, not measured phoneme/audio alignment. System SpeechSynthesis does not expose its waveform or reliable phoneme timestamps. Accurate lip-sync would require a local TTS engine that outputs audio plus phoneme timings (or an audio-to-viseme model). The Cycles still is not a claim that the WebGL renderer is pixel-identical.

Base character provenance and CC0 attribution are included in `public/models/ATTRIBUTION.md`.
