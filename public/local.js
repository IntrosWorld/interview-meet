import { createVoiceQueue } from './local-voice.js';
const $ = id => document.getElementById(id);
let history = [], active, recorder, media, chunks = [], recordingTimer;
let busy = false, whisperReady = false, captureBusy = false, warming = false, speechBusy = false;
let prepared = '', handsFree = false, discarded = false, analyserContext, vadFrame, resumeTimer;
let timing = {}, modelMetrics = '';
let lastVoiceAt = 0, preview, snapshotRequested = false;
const status = text => $('status').textContent = text;
const headers = { 'Content-Type': 'application/json', 'X-Local-Lab': '1' };
function controls() {
  $('send').disabled = busy || captureBusy || warming || handsFree;
  $('new-chat').disabled = busy || captureBusy || handsFree;
  $('target').disabled = busy || captureBusy || warming || handsFree;
  $('model').disabled = busy || captureBusy || warming || handsFree;
  $('automatic').disabled = handsFree || captureBusy || busy;
  $('cancel').hidden = !busy && !speechBusy;
  $('record').disabled = !handsFree && (busy || warming || !whisperReady || (captureBusy && recorder?.state !== 'recording'));
  $('record').textContent = handsFree ? 'End conversation' : recorder?.state === 'recording' ? 'Stop and send' : $('automatic').checked ? 'Start conversation' : 'Record answer';
}
function add(role, text = '') {
  $('messages').querySelector('.local-empty')?.remove();
  const row = document.createElement('div'); row.className = 'local-message'; row.dataset.role = role;
  const label = document.createElement('strong'); label.textContent = role === 'user' ? 'You' : 'Local interviewer';
  const content = document.createElement('span'); content.textContent = text; row.append(label, content); $('messages').append(row);
  $('messages').scrollTop = $('messages').scrollHeight; return content;
}
function voices() {
  const selected = $('voice').value;
  $('voice').replaceChildren(new Option('Voice output off', ''));
  for (const voice of window.speechSynthesis?.getVoices().filter(v => v.localService) || []) $('voice').add(new Option(voice.name, voice.voiceURI));
  $('voice').value = selected;
  if (!$('voice').value && selected) status('Your selected local voice is no longer available. Voice output is off.');
}
if (window.speechSynthesis) { window.speechSynthesis.addEventListener('voiceschanged', voices); voices(); }
function showTiming() {
  $('metrics').textContent = [timing.transcriptionMs != null ? `Recognition: ${timing.transcriptionMs} ms` : '',
    timing.spokenMs != null ? `First spoken audio after pause: ${timing.spokenMs} ms` : '', modelMetrics].filter(Boolean).join(' | ');
}
const voiceQueue = createVoiceQueue(window.speechSynthesis,
  () => window.speechSynthesis?.getVoices().find(v => v.localService && v.voiceURI === $('voice').value),
  () => { if (timing.pauseAt) { timing.spokenMs = Math.round(performance.now() - timing.pauseAt); showTiming(); } },
  playing => { speechBusy = playing; controls(); maybeListen(); });
async function prepare() {
  const key = $('model').value + ':' + $('target').value;
  if (!$('model').value || prepared === key || busy || captureBusy || handsFree || warming) return;
  warming = true; controls(); status('Preparing your model before the conversation…');
  try {
    const r = await fetch('/api/prepare', { method: 'POST', headers, body: JSON.stringify({ model: $('model').value, target: $('target').value }) });
    const data = await r.json(); if (!r.ok) throw Error(data.error);
    prepared = key; status('Model ready. Start a conversation or type a message.');
  } catch (error) { status(error.message); }
  finally { warming = false; controls(); }
}
async function health() {
  try {
    const r = await fetch('/api/status'); if (!r.ok) throw Error(); const data = await r.json();
    const selected = $('model').value; $('model').replaceChildren();
    for (const model of data.models) $('model').add(new Option(model, model));
    $('model').value = data.models.includes(selected) ? selected : data.models.includes(data.defaultModel) ? data.defaultModel : data.models.includes('qwen3:1.7b') ? 'qwen3:1.7b' : data.models[0] || '';
    whisperReady = data.speechReady;
    $('health').textContent = `Ollama: ${data.ollamaReady ? 'ready' : 'not running'}. Whisper: ${data.speechReady ? data.speech.model + ' ready' : 'starting or unavailable'}.`;
  } catch { $('health').textContent = 'Cannot reach local services. Start npm run local and check again.'; }
  controls();
  await prepare();
}
async function send(text) {
  if (busy || !text.trim()) return;
  if (!$('model').value) return status('Start Ollama and install a model, then click Check again.');
  busy = true; controls(); voiceQueue.cancel(); active = new AbortController();
  const turn = { role: 'user', content: text.trim() }; history.push(turn); add('user', turn.content); $('message').value = '';
  const reply = add('assistant'); let answer = '', done = false;
  status('Generating locally… The first reply may take longer while the model loads.');
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers, signal: active.signal, body: JSON.stringify({ model: $('model').value, target: $('target').value, messages: history.slice(-16) }) });
    if (!response.ok) throw Error('The local server rejected this request.');
    let buffer = ''; const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true }); let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!line) continue;
        const data = JSON.parse(line); if (data.error) throw Error(data.error);
        if (data.text) { answer += data.text; reply.textContent = answer; voiceQueue.push(data.text); $('messages').scrollTop = $('messages').scrollHeight; }
        if (data.done) { done = true; modelMetrics = `First token: ${data.firstTokenMs} ms | Generation: ${data.tokensPerSecond ?? '?'} tokens/sec`; showTiming(); }
      }
    }
    if (!done) throw Error('The model stream ended early. Please try again.');
    voiceQueue.push('', true); history.push({ role: 'assistant', content: answer }); status(handsFree && speechBusy ? 'Speaking. I will listen again when the reply ends.' : 'Ready for your next answer.');
  } catch (error) {
    handsFree = false; voiceQueue.cancel();
    if (answer) history.push({ role: 'assistant', content: answer }); else { history.pop(); reply.textContent = 'No reply generated.'; }
    status(error.name === 'AbortError' ? 'Interrupted. You can send another message.' : error.message);
  } finally { busy = false; active = null; controls(); maybeListen(); }
}
$('chat-form').onsubmit = event => { event.preventDefault(); timing = {}; modelMetrics = ''; send($('message').value); };
$('cancel').onclick = () => { endConversation(); status('Interrupted. You can start listening again or type.'); };
$('new-chat').onclick = () => { history = []; $('messages').replaceChildren(); $('metrics').textContent = ''; voiceQueue.cancel(); status('New conversation. Say hello to begin.'); };
$('model').onchange = () => { history = []; $('messages').replaceChildren(); prepare(); };
$('target').onchange = prepare;
$('automatic').onchange = controls;
$('refresh').onclick = health;
$('export-chat').onclick = () => {
  const blob = new Blob([history.map(t => (t.role === 'user' ? 'You' : 'Interviewer') + ': ' + t.content).join('\n\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'local-interview.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function stopVad() { cancelAnimationFrame(vadFrame); analyserContext?.close().catch(() => {}); analyserContext = null; }
function endConversation() {
  handsFree = false; discarded = true; clearTimeout(resumeTimer); clearTimeout(recordingTimer); stopVad();
  if (recorder?.state === 'recording') recorder.stop();
  media?.getTracks().forEach(t => t.stop()); active?.abort(); voiceQueue.cancel(); controls();
}
function maybeListen() {
  clearTimeout(resumeTimer);
  if (handsFree && !busy && !captureBusy && !speechBusy) resumeTimer = setTimeout(() => {
    if (handsFree && !busy && !captureBusy && !speechBusy) startRecording();
  }, 250);
}
function detectPause(stream) {
  analyserContext = new AudioContext(); const source = analyserContext.createMediaStreamSource(stream);
  const analyser = analyserContext.createAnalyser(); analyser.fftSize = 2048; source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize); let lastVoice = 0, voiced = 0, previous = performance.now(), previewRequested = false;
  function tick() {
    if (!handsFree || recorder?.state !== 'recording') return;
    const now = performance.now(), delta = Math.min(50, now - previous); previous = now;
    analyser.getFloatTimeDomainData(samples); const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
    if (rms > .014) { lastVoice = now; lastVoiceAt = now; voiced += delta; previewRequested = false; }
    // Begin recognition during the pause rather than waiting for end-of-turn.
    if (voiced > 200 && now - lastVoice > 100 && !previewRequested && !preview?.pending && recorder.requestData) {
      previewRequested = true; snapshotRequested = true; recorder.requestData();
    }
    if (voiced > 200 && now - lastVoice > Number($('pause').value)) {
      timing = { pauseAt: lastVoice }; recorder.stop(); return;
    }
    vadFrame = requestAnimationFrame(tick);
  }
  vadFrame = requestAnimationFrame(tick);
}
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return status('Recording is unavailable in this browser. Typed chat still works.');
  voiceQueue.cancel(); captureBusy = true; discarded = false; timing = {}; modelMetrics = ''; preview = null; lastVoiceAt = 0; snapshotRequested = false; controls();
  try {
    media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    chunks = []; recorder = new MediaRecorder(media);
    async function transcribe(audio) {
      const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': recorder.mimeType, 'X-Local-Lab': '1' }, body: audio });
      const data = await response.json(); if (!response.ok) throw Error(data.error); return data;
    }
    recorder.ondataavailable = event => {
      if (event.data.size) chunks.push(event.data);
      if (snapshotRequested && recorder.state === 'recording' && chunks.length) {
        snapshotRequested = false;
        const candidate = { through: performance.now(), pending: true, result: null };
        preview = candidate;
        candidate.result = transcribe(new Blob(chunks, { type: recorder.mimeType })).catch(() => null).finally(() => { candidate.pending = false; });
      }
    };
    recorder.onstop = async () => {
      clearTimeout(recordingTimer); stopVad(); media.getTracks().forEach(t => t.stop()); $('record').classList.remove('recording');
      if (discarded) { captureBusy = false; controls(); return; }
      timing.pauseAt ??= performance.now();
      controls(); status('Transcribing with local Whisper…');
      try {
        const audio = new Blob(chunks, { type: recorder.mimeType });
        const candidate = preview;
        const cached = candidate ? await candidate.result : null;
        if (discarded) return;
        // Reuse only a snapshot containing ALL speech detected before the stop.
        const data = cached && candidate.through >= lastVoiceAt ? cached : await transcribe(audio);
        if (discarded) return;
        timing.transcriptionMs = data.transcriptionMs; showTiming(); captureBusy = false; controls();
        if (data.text.trim()) { $('message').value = data.text; await send(data.text); } else status('No clear speech detected. Try again or type a message.');
      } catch (error) { handsFree = false; status(error.message); } finally { captureBusy = false; controls(); maybeListen(); }
    };
    recorder.start(250); $('record').classList.add('recording'); controls(); status(handsFree ? 'Listening. Pause briefly when your answer is finished.' : 'Recording. Click Stop and send when finished.');
    if (handsFree) detectPause(media);
    recordingTimer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 45000);
  } catch { handsFree = false; media?.getTracks().forEach(t => t.stop()); stopVad(); captureBusy = false; controls(); status('Microphone permission was denied or the microphone is unavailable. You can type instead.'); }
}
$('record').onclick = () => {
  if (handsFree) { endConversation(); status('Conversation ended. Microphone off.'); return; }
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  if ($('automatic').checked) {
    const localVoices = window.speechSynthesis?.getVoices().filter(v => v.localService) || [];
    if (!$('voice').value) $('voice').value = (localVoices.find(v => v.lang.startsWith('en')) || localVoices[0])?.voiceURI || '';
    if (!$('voice').value) return status('Choose an installed local voice for hands-free conversation, or turn Hands-free off for typed replies.');
    handsFree = true;
  }
  startRecording();
};
window.addEventListener('pagehide', endConversation);
health();
