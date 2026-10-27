import { ready, requireUser, api, completeDesktopSignIn } from './auth.js';
const status = document.getElementById('desktop-status');
const button = document.getElementById('desktop-approve');
try {
  await ready;
  if (location.pathname === '/desktop/complete') {
    if (!window.interviewDesktop?.takeCredential) throw Error('Return to the desktop app and start sign-in again.');
    const token = await window.interviewDesktop.takeCredential();
    if (!token) throw Error('Desktop authorization expired. Start again.');
    await completeDesktopSignIn(token);
    location.replace(new URLSearchParams(location.search).get('mode') === 'coding' ? '/coding' : '/interview');
  } else {
    const query = new URLSearchParams(location.search);
    const redirect = query.get('redirect'), challenge = query.get('challenge'), state = query.get('state');
    let u; try { u = new URL(redirect); } catch { throw Error('Invalid desktop request'); }
    if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || !u.port || u.pathname !== '/callback' || u.search || u.hash || u.username || u.password || !/^[\w-]{43}$/.test(challenge || '') || !/^[\w-]{43}$/.test(state || '')) throw Error('Invalid desktop request');
    const user = await requireUser();
    status.textContent = `Continue as ${user.email || 'your account'}?`; button.hidden = false;
    button.onclick = async () => {
      button.disabled = true;
      try {
        const { code } = await api('desktop/authorize', { method: 'POST', body: JSON.stringify({ challenge, redirect }) });
        u.searchParams.set('code', code); u.searchParams.set('state', state);
        location.replace(u.href);
      } catch (error) { status.textContent = error.message; button.disabled = false; }
    };
  }
} catch (error) { status.textContent = error.message; }
