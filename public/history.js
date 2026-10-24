import { api, requireUser } from './auth.js';
if (location.pathname === '/history') {
  document.getElementById('auth-view').hidden = true;
  document.getElementById('history-view').hidden = false;
  document.title = 'My interviews | Interview Meet';
  const status = document.getElementById('history-status');
  const list = document.getElementById('history-list');
  const more = document.getElementById('load-more');
  const detail = document.getElementById('interview-detail');
  let interviews = [], cursor;
  const text = (tag, value, cls) => { const e = document.createElement(tag); e.textContent = value; if (cls) e.className = cls; return e; };
  const formatDate = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  async function show(id) {
    const content = document.getElementById('detail-content');
    content.textContent = 'Loading transcript…'; detail.showModal();
    try {
      const interview = await api('interviews/' + id);
      document.getElementById('detail-title').textContent = interview.target;
      content.replaceChildren(text('p', formatDate(interview.started_at), 'muted'));
      for (const turn of interview.transcript) {
        const row = text('div', '', 'transcript-entry'); row.append(text('strong', { user: 'You', assistant: 'AI Interviewer', system: 'Session' }[turn.role]), document.createTextNode(turn.text)); content.append(row);
      }
      if (!interview.transcript.length) content.append(text('p', 'No transcript was captured for this session.', 'muted'));
    } catch (error) { content.textContent = error.message; }
  }
  function render() {
    list.replaceChildren();
    document.getElementById('total-count').textContent = interviews.length;
    for (const mode of ['voice', 'coding']) document.getElementById(mode + '-count').textContent = interviews.filter(i => i.mode === mode).length;
    const filter = document.getElementById('history-filter').value;
    const visible = interviews.filter(i => filter === 'all' || i.mode === filter);
    for (const interview of visible) {
      const row = text('article', '', 'history-row'), info = text('div', '');
      info.append(text('span', interview.mode === 'voice' ? 'Voice interview' : 'Coding practice', 'badge'), text('h3', interview.target), text('p', formatDate(interview.started_at) + ' · ' + interview.status));
      const actions = text('div', '', 'row-actions');
      const view = text('button', 'View transcript', 'button outline'); view.onclick = () => show(interview.id);
      const remove = text('button', 'Delete', 'button outline');
      remove.onclick = async () => {
        if (!confirm('Delete this interview and its transcript?')) return;
        remove.disabled = true;
        try { await api('interviews/' + interview.id, { method: 'DELETE' }); interviews = interviews.filter(i => i.id !== interview.id); render(); }
        catch (error) { status.textContent = error.message; remove.disabled = false; }
      };
      actions.append(view, remove); row.append(info, actions); list.append(row);
    }
    if (!visible.length) {
      const empty = text('section', '', 'empty'); empty.append(text('h2', interviews.length ? 'No matching sessions' : 'Your first practice starts here'), text('p', 'Your interview transcripts will appear here after you start a session.', 'muted'));
      const start = text('a', 'Try a voice interview', 'button'); start.href = '/'; empty.append(start); list.append(empty);
    }
  }
  async function load() {
    more.disabled = true;
    try {
      await requireUser(); await api('profile');
      const result = await api('interviews' + (cursor ? '?before=' + encodeURIComponent(cursor) : ''));
      interviews.push(...result.interviews); cursor = result.nextCursor; more.hidden = !cursor; status.textContent = ''; render();
    } catch (error) { status.textContent = error.message; const retry = text('button', 'Retry', 'button outline'); retry.onclick = load; status.append(' ', retry); }
    finally { more.disabled = false; }
  }
  document.getElementById('history-filter').onchange = render;
  document.getElementById('close-detail').onclick = () => detail.close();
  more.onclick = load; load();
}
