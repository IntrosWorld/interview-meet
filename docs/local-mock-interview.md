# Local mock interview results

Two five-turn backend developer mock interviews were run in the actual local browser app. Synthetic Windows speech recordings were injected as the microphone stream; Whisper and Ollama were real local services. Replies used a local Windows voice with the browser muted during automation. Timing uses the speech-synthesis start event, not a physical measurement of audible output.

Hands-free mode completed the listen → recognize → generate → speak → listen cycle without manual per-turn clicks. Each test was ended with End conversation and the microphone was stopped. The pause threshold was **800 ms**, the relaxed option, rather than the 450 ms fast default.

| Model | Spoken reply start after detected end of speech | Observation |
|---|---|---|
| Qwen3 0.6B | 1.86–2.15 seconds | Fast and generally conversational, but its opening question was unrelated to the requested interview. |
| Qwen3 1.7B | 2.21–2.89 seconds | Slower, but more focused technical questions and follow-ups. |

The larger model asked about database transactions, error handling, consistency, and concurrent access. Example sequence:

Candidate: I built a library API in Node and Express with PostgreSQL.

Interviewer: How did you handle database transactions and error handling in your API?

Later follow-up: How did you manage conflicts when multiple users tried to access the same book at the same time?

## Problems observed

- The 0.6B opening was “What do you enjoy most about working with me?” This is not a useful interview opening. Its later questions were relevant, but the model is not a reliable interviewer yet.
- Whisper misheard “PostgreSQL” as “Post-Press QL.” The small model repeated that error rather than correcting it.
- The energy-based pause detector sometimes ended synthetic multi-sentence answers after the first sentence. Natural pauses can be mistaken for the end of an answer, even at 800 ms. The longer pause setting or manual recording mode is preferable for reflective answers until endpoint detection is improved.
- The scripted candidate uses keyword-selected prepared answers. This verifies context and turn-taking, not a realistic assessment of candidate quality. No scoring or grading reliability is claimed.
- Longer context and recognition work made the full mock slower than the earlier two short, warm 1.4-second samples. The earlier number should not be generalized to complete interviews.

## Artifacts

`test-results/mock-local-interview-fast.json` and `test-results/mock-local-interview-balanced.json` contain the transcripts and timings. `test-results/mock-local-interview.png` contains the last session screenshot. These generated test artifacts are ignored by Git. Synthetic voice fixtures are stored on F: under `F:\AI_models\interview-meet\mock-interview`.

The local-only driver is `scripts/mock-local-interview.mjs`. With those voice fixtures present and the lab running, invoke it with no arguments for the default fast model or with `qwen3:1.7b` for the larger model. This is a manual real-service smoke test, separate from the deterministic mock-based test suite.
