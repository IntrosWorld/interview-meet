# Local conversation experiment

Branch: `local`, based on `redesign`. This is a separate loopback-only lab, not a replacement deployment. The Gemini/Firebase/Neon application is unchanged. The lab imports none of their clients, does not load `.env`, and sends inference/audio only to local services. It uses locally hosted CSS, icons, and fonts.

## What runs locally

- Conversation: an installed Ollama model, default `qwen3:1.7b` with thinking disabled.
- Speech recognition: faster-whisper `tiny.en`, CPU `int8`, English only.
- Spoken replies: browser speech synthesis, restricted to voices with `localService=true` (installed Windows voices). Voice output defaults off; choose a voice in the UI to enable it.
- Context: the page keeps recent messages in memory and sends up to 16 turns for each reply. No cloud history synchronization. Export a plain-text transcript if you want to keep it.

Speech is **turn-based**. Click Record answer, speak, then Stop and send. Whisper transcribes the recorded audio, Ollama streams a response, and the selected local voice speaks sentences as they arrive. There is no continuous speech-to-speech model or automatic interruption detection. Typed chat works if Whisper is unavailable.

## Start

Requirements: Node 22+, Python with `faster-whisper`, and running Ollama with an installed model. This machine already had Ollama and Python dependencies. For a new Python environment:

```powershell
python -m pip install -r local-requirements.txt
```

Ollama is installed at `F:\Ollama`. The existing model store is `F:\Users\Micro\.ollama\models`; no new LLM download was needed. If Ollama is not running, start its app or run `ollama serve` in another terminal. You can check installed models with `ollama list`.

```powershell
npm install
npm run local
```

Open http://127.0.0.1:8010. Choose a model and target role, then type a message. To hear spoken replies, choose an installed voice under Reply voice. Allow microphone access to record. Recordings are capped at 45 seconds. Interrupt cancels generation and queued speech. Ctrl+C stops the Node and Whisper processes started by the launcher; it does not stop an already-running Ollama application.

## Model storage on F:

All new Whisper model downloads and Hugging Face caches are configured under:

```text
F:\AI_models\interview-meet\
  whisper\          # faster-whisper model cache, about 75 MB model weights
  huggingface\      # ancillary Hugging Face cache
  test-audio.wav    # synthetic speech used in the experiment, not microphone audio
```

On Windows without symlink support, Hugging Face may store duplicate copies of cache files. Those copies also stay on F:. No model files are committed to Git.

For future Ollama downloads, keep `OLLAMA_MODELS` pointed at the existing F: store **before starting its server**:

```powershell
$env:OLLAMA_MODELS = 'F:\Users\Micro\.ollama\models'
ollama serve
# In a different terminal, only if a model is missing:
ollama pull qwen3:1.7b
```

Do not restart or change an existing Ollama service just to run the lab. The service's configured model location controls where `ollama pull` writes, not the client terminal's environment alone.

Optional launcher environment variables (set in your PowerShell terminal, not `.env`): `LOCAL_PYTHON` (Python executable), `LOCAL_PORT` (default 8010), `LOCAL_MODEL` (default qwen3:1.7b), `LOCAL_MODEL_DIR` (must be on F:), `LOCAL_WHISPER_MODEL` (default tiny.en), `OLLAMA_URL` (default http://127.0.0.1:11434). `LOCAL_SPEECH_URL` can point the Node-only command at a separately managed worker; the included Python worker listens on 8766.

## Measurements on this machine

Intel Core Ultra 5 125H, about 16 GB RAM, Intel Arc integrated graphics. Ollama reported CPU inference. Single short interview prompt, 2048 context, thinking disabled, maximum 90 output tokens. These are small exploratory samples, not general speed guarantees. The first round after switching models includes loading; the second repeats the prompt and benefits from cached context.

| Model | First round: first token | Repeated prompt: first token | Repeated prompt: tokens/sec | Repeated prompt: full reply |
|---|---:|---:|---:|---:|
| Qwen3 1.7B | 5.73 s | 0.24 s | 25.6 | 0.71 s |
| Granite 3.3 2B | 7.75 s | 0.14 s | 16.0 | 2.56 s |
| Llama 3.2 3B | 10.90 s | 0.38 s | 10.0 | 5.80 s |

Qwen was the best starting point for this CPU: fast generation and a concise follow-up. In the actual app with its longer system prompt, a first model load took 7.54 s to first token; a repeated warm start took 0.25 s. A follow-up with new conversation context took 1.79 s to first token and 2.42 s for the complete reply. Context growth, CPU load, and longer answers increase latency. Short responses are deliberate.

Whisper transcribed a 7.76-second **synthetic Windows speech** recording in 1.28 seconds (1.43 seconds through the local HTTP proxy), reproducing the test sentence correctly. This does not establish accuracy for accents, room noise, or live microphones. The browser recording path was tested with injected test audio; speaker output uses installed local voices and is less natural than Gemini Live.

## Checks

```powershell
npm run local:typecheck
npm run local:test
npm run local:bench
```

The local suite tests request-origin protection, input validation, streaming/context, safe text rendering, cancellation, backend failures, missing speech service, phone layout, and absence of third-party browser requests. It uses a mock Ollama service so tests need no model. The separate benchmark calls real Ollama. Browser chat and Whisper were also checked against real installed services.

## Limits and boundaries

- No Gemini API calls, no API charges for local inference. Initial package/model downloads still require internet.
- English-only recognition for now. CPU Whisper and system TTS are separate components, not an end-to-end speech model.
- Small models may repeat questions, make mistakes, or give weak code feedback. No scoring reliability is claimed.
- The server binds to 127.0.0.1, requires a custom header for POSTs, and rejects different browser origins. Do not expose it via a public tunnel without authentication and rate limits.
- `npm run local` runs on your computer. A Vercel deployment cannot access your PC's `localhost` services. Nothing in this branch was promoted to production.

References: [Ollama chat API](https://docs.ollama.com/api/chat), [thinking controls](https://docs.ollama.com/capabilities/thinking), [Qwen3 models](https://ollama.com/library/qwen3), [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
