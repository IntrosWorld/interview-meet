const $ = id => document.getElementById(id);
let history = [], active, recorder, media, chunks = [], recordingTimer;
let busy = false, whisperReady = false, captureBusy = false, utterance, speechBuffer = '';
const status = text => $('status').textContent = text;
const headers = { 'Content-Type': 'application/json', 'X-Local-Lab': '1' };
function controls() {
  $('send').disabled = busy || captureBusy;
  $('new-chat').disabled = busy || captureBusy;
  $('target').disabled = busy || captureBusy;
  $('model').disabled = busy || captureBusy;
  $('cancel').hidden = !busy;
  $('record').disabled = busy || !whisperReady || (captureBusy && recorder?.state !== 'recording');
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
if (window.speechSynthesis) { speechSynthesis.addEventListener('voiceschanged', voices); voices(); }
function speak(text) {
  const voice = window.speechSynthesis?.getVoices().find(v => v.localService && v.voiceURI === $('voice').value);
  if (!voice || !text.trim()) return;
  utterance = new SpeechSynthesisUtterance(text); utterance.voice = voice; utterance.rate = 1.05; speechSynthesis.speak(utterance);
}
function sentenceSpeech(chunk, flush = false) {
  speechBuffer += chunk;
  const sentence = speechBuffer.match(/^([\s\S]*?[.!?])(?:\s|$)/);
  if (sentence) { speak(sentence[1]); speechBuffer = speechBuffer.slice(sentence[0].length); }
  if (flush && speechBuffer.trim()) { speak(speechBuffer); speechBuffer = ''; }
}
async function health() {
  try {
    const r = await fetch('/api/status'); if (!r.ok) throw Error(); const data = await r.json();
    const selected = $('model').value; $('model').replaceChildren();
    for (const model of data.models) $('model').add(new Option(model, model));
    $('model').value = data.models.includes(selected) ? selected : data.models.includes(data.defaultModel) ? data.defaultModel : data.models[0] || '';
    whisperReady = data.speechReady;
    $('health').textContent = `Ollama: ${data.ollamaReady ? 'ready' : 'not running'}. Whisper: ${data.speechReady ? data.speech.model + ' ready' : 'starting or unavailable'}.`;
  } catch { $('health').textContent = 'Cannot reach local services. Start npm run local and check again.'; }
  controls();
}
async function send(text) {
  if (busy || !text.trim()) return;
  if (!$('model').value) return status('Start Ollama and install a model, then click Check again.');
  busy = true; controls(); speechSynthesis?.cancel(); speechBuffer = ''; active = new AbortController();
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
        if (data.text) { answer += data.text; reply.textContent = answer; sentenceSpeech(data.text); $('messages').scrollTop = $('messages').scrollHeight; }
        if (data.done) { done = true; $('metrics').textContent = `First token: ${data.firstTokenMs} ms | Generation: ${data.tokensPerSecond ?? '?'} tokens/sec | Reply: ${data.totalMs} ms`; }
      }
    }
    if (!done) throw Error('The model stream ended early. Please try again.');
    sentenceSpeech('', true); history.push({ role: 'assistant', content: answer }); status('Ready for your next answer.');
  } catch (error) {
    speechSynthesis?.cancel(); speechBuffer = '';
    if (answer) history.push({ role: 'assistant', content: answer }); else { history.pop(); reply.textContent = 'No reply generated.'; }
    status(error.name === 'AbortError' ? 'Interrupted. You can send another message.' : error.message);
  } finally { busy = false; active = null; controls(); }
}
$('chat-form').onsubmit = event => { event.preventDefault(); send($('message').value); };
$('cancel').onclick = () => { active?.abort(); speechSynthesis?.cancel(); };
$('new-chat').onclick = () => { history = []; $('messages').replaceChildren(); $('metrics').textContent = ''; speechSynthesis?.cancel(); status('New conversation. Say hello to begin.'); };
$('refresh').onclick = health;
$('export-chat').onclick = () => {
  const blob = new Blob([history.map(t => (t.role === 'user' ? 'You' : 'Interviewer') + ': ' + t.content).join('\n\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'local-interview.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('record').onclick = async () => {
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return status('Recording is unavailable in this browser. Typed chat still works.');
  speechSynthesis?.cancel(); captureBusy = true; controls();
  try {
    media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    chunks = []; recorder = new MediaRecorder(media); recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      clearTimeout(recordingTimer); media.getTracks().forEach(t => t.stop()); $('record').classList.remove('recording'); $('record').textContent = 'Record answer';
      controls(); status('Transcribing with local Whisper…');
      try {
        const audio = new Blob(chunks, { type: recorder.mimeType });
        const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': recorder.mimeType, 'X-Local-Lab': '1' }, body: audio });
        const data = await response.json(); if (!response.ok) throw Error(data.error);
        captureBusy = false; controls();
        if (data.text.trim()) { $('message').value = data.text; await send(data.text); } else status('No clear speech detected. Try again or type a message.');
      } catch (error) { status(error.message); } finally { captureBusy = false; controls(); }
    };
    recorder.start(); $('record').textContent = 'Stop and send'; $('record').classList.add('recording'); controls(); status('Recording locally. Click Stop and send when finished (maximum 45 seconds).');
    recordingTimer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 45000);
  } catch { media?.getTracks().forEach(t => t.stop()); captureBusy = false; controls(); status('Microphone permission was denied or the microphone is unavailable. You can type instead.'); }
};
window.addEventListener('pagehide', () => { active?.abort(); clearTimeout(recordingTimer); media?.getTracks().forEach(t => t.stop()); speechSynthesis?.cancel(); });
health();
