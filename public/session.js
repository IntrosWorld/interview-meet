import { api, requireUser, authenticateSocket } from './auth.js';
export { authenticateSocket };
let id = null, saving = Promise.resolve(), timer, stopped = false;
const transcript = document.getElementById('transcript');
const notice = document.createElement('p'); notice.className = 'notice'; notice.setAttribute('role', 'status');
transcript.parentElement.append(notice);
function turns() {
  return [...transcript.children].map(row => ({
    role: /AI Interviewer|Gemini/i.test(row.querySelector('.speaker')?.textContent || '') ? 'assistant'
      : /System/i.test(row.querySelector('.speaker')?.textContent || '') ? 'system' : 'user',
    text: (row.querySelector('.text')?.textContent || '').slice(0, 16000)
  })).filter(t => t.text).slice(-1000);
}
export async function beginSession(mode, target) {
  await requireUser();
  await saving.catch(() => {});
  const result = await api('interviews', { method: 'POST', body: JSON.stringify({ mode, target }) });
  id = result.id; stopped = false; transcript.replaceChildren(); notice.textContent = 'Interview history is saved to your account.';
}
export function saveSession(status = 'active') {
  if (!id || (stopped && status === 'active')) return saving;
  const sessionId = id, snapshot = turns();
  if (status !== 'active') stopped = true;
  saving = saving.catch(() => {}).then(() => api('interviews/' + sessionId, {
    method: 'PATCH', body: JSON.stringify({ transcript: snapshot, status }), keepalive: true
  })).then(() => { notice.textContent = status === 'active' ? 'Transcript saved.' : 'Session saved. Find it in My interviews.'; })
    .catch(error => { notice.textContent = 'Could not save: ' + error.message; throw error; });
  saving.catch(() => {});
  return saving;
}
new MutationObserver(() => {
  clearTimeout(timer);
  if (id && !stopped) timer = setTimeout(() => saveSession().catch(() => {}), 2000);
}).observe(transcript, { childList: true, subtree: true, characterData: true });
window.addEventListener('pagehide', () => { if (id && !stopped) saveSession('interrupted').catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (document.hidden && id && !stopped) saveSession().catch(() => {}); });
