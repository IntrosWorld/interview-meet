// Keep the web interview/coding DOM and route local actions into the local engine.
const $ = id => document.getElementById(id);
const coding = document.body.classList.contains('coding-page');
function rename(from, to) { const element = $(from); element.id = to; return element; }
const nav = document.createElement('nav');
nav.className = 'app-nav';
nav.innerHTML = '<a class="wordmark" href="/desktop/interview">Interview Meet</a><div class="nav-links"><a href="/desktop/interview">Interview room</a><a href="/desktop/coding">Coding practice</a><a href="https://interview-meet.mohitnaik.tech/login?next=/interview" target="_blank" rel="noopener">Gemini · sign in on official website</a></div><span>Local model</span>';
document.body.prepend(nav);
const setup = document.createElement('details');
setup.open = true;
setup.innerHTML = '<summary>Local model & voice</summary><label>Model<select id="model"></select></label><label>Reply voice<select id="voice"></select></label><label><input id="automatic" type="checkbox" checked> Hands-free conversation</label><label>Pause before sending<select id="pause"><option value="800">0.8 seconds</option><option value="450">0.45 seconds</option><option value="1500">1.5 seconds</option></select></label><p id="health" class="helper" role="status"></p><button id="refresh" class="btn secondary">Check again</button><button id="new-chat" class="btn secondary">New conversation</button><button id="export-chat" class="btn secondary">Export transcript</button><p id="metrics" class="helper"></p>';
const style = document.createElement('style');
style.textContent = 'details{margin:20px 0}details>label{display:block;margin:12px 0}details button{margin:5px 5px 0 0}.local-message{padding:12px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.local-message strong{display:block;font-size:11px;margin-bottom:6px}.local-message span{white-space:pre-wrap}#messages{height:240px;overflow:auto}#status{font-size:12px;color:var(--muted);margin:12px 0}';
document.head.append(style);
rename('transcript', 'messages');
let camera;
if (!coding) {
  document.querySelector('.controls-section').append(setup);
  rename('interview-target-input', 'target'); $('target').maxLength = 300;
  rename('startBtn', 'record'); rename('stopBtn', 'cancel');
  rename('text-form', 'chat-form'); rename('text-input', 'message'); rename('send-text-btn', 'send');
  $('message').disabled = false; $('send').disabled = false;
  rename('status-text', 'status');
  $('gemini-status').textContent = 'Local';
  $('cameraBtn').onclick = async () => {
    if (camera) { camera.getTracks().forEach(t => t.stop()); camera = null; $('user-video').srcObject = null; $('user-video').classList.remove('active'); $('cameraBtn').textContent = 'Enable Camera'; return; }
    try { camera = await navigator.mediaDevices.getUserMedia({ video: true }); $('user-video').srcObject = camera; $('user-video').classList.add('active'); $('cameraBtn').textContent = 'Disable Camera'; } catch { $('status').textContent = 'Camera unavailable or permission denied.'; }
  };
  document.querySelectorAll('[data-target]').forEach(button => button.onclick = () => { $('target').value = button.dataset.target; $('target').dispatchEvent(new Event('change')); });
  // Same embedded coding panel as the website; no automatic code execution.
  $('coding-panel').classList.remove('hidden');
  $('submit-code-btn').onclick = () => submit(`Review my ${$('code-language').value} solution:\n${$('code-editor').value}`);
} else {
  document.querySelector('.left').append(setup);
  rename('topic', 'target'); $('target').maxLength = 300;
  rename('voice-btn', 'record'); rename('end-btn', 'cancel'); rename('conn-status', 'status');
  const form = document.createElement('form'); form.id = 'chat-form';
  form.innerHTML = '<label for="message">Ask a follow-up</label><input id="message" required maxlength="12000" placeholder="Type your answer"><button id="send" class="btn primary">Send</button>';
  document.querySelector('.right').append(form);
  $('code-editor').disabled = false; $('review-now-btn').disabled = false; $('start-btn').disabled = false;
  $('start-btn').onclick = () => {
    if (!$('language').value || !$('target').value.trim()) { $('status').textContent = 'Choose a language and topic first.'; return; }
    submit(`Start a coding interview in ${$('language').value} about ${$('target').value}. Give one problem with constraints and examples. Wait for my solution.`);
  };
  $('review-now-btn').onclick = () => submit(`Review my ${$('language').value} solution. Explain correctness and complexity; do not execute it:\n${$('code-editor').value}`);
  $('language').onchange = () => { $('editor-lang-pill').textContent = `Mode: ${$('language').value || 'none'}`; };
  $('code-editor').oninput = () => { const code = $('code-editor').value; $('editor-stats-pill').textContent = `${code.split('\n').length} lines | ${code.length} chars`; };
  if (window.CodeMirror) {
    const editor = window.CodeMirror.fromTextArea($('code-editor'), { lineNumbers: true, mode: 'javascript', indentUnit: 2, lineWrapping: true });
    editor.on('change', () => { editor.save(); $('code-editor').oninput(); });
    const modes = { JavaScript: 'javascript', TypeScript: 'text/typescript', Python: 'python', Java: 'text/x-java', 'C++': 'text/x-c++src', Go: 'go' };
    $('language').addEventListener('change', () => editor.setOption('mode', modes[$('language').value] || 'text/plain'));
  }
}
function submit(text) { if ($('send').disabled) return; $('message').value = text.slice(0, 12000); $('chat-form').requestSubmit(); }
await import('./local.js');
window.addEventListener('pagehide', () => camera?.getTracks().forEach(t => t.stop()));
