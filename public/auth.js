import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';

let auth;
export const ready = (async () => {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Unable to load sign-in settings. Please try again.');
  const config = await response.json();
  if (!config.firebase.apiKey || !config.firebase.projectId || !config.firebase.authDomain) {
    throw new Error('Sign-in is not configured yet. Add the Firebase settings described in SETUP.md.');
  }
  auth = getAuth(initializeApp(config.firebase));
  await new Promise(resolve => { const off = onAuthStateChanged(auth, () => { off(); resolve(); }); });
  return auth;
})();
// Surfaces display setup errors when they await ready.
ready.catch(() => {});
export async function requireUser() {
  await ready;
  if (!auth.currentUser) {
    location.assign('/login?next=' + encodeURIComponent(location.pathname));
    throw new Error('Sign in to continue');
  }
  return auth.currentUser;
}
export async function api(path, options = {}) {
  const user = await requireUser();
  const response = await fetch('/api/account/' + path, { ...options, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken(), ...options.headers
  }});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}
export async function authenticateSocket(socket) {
  const user = await requireUser();
  const token = await user.getIdToken();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Sign-in timed out. Try again.')), 12000);
    const finish = error => { clearTimeout(timer); socket.removeEventListener('message', receive); error ? reject(error) : resolve(); };
    const receive = event => { const m = JSON.parse(event.data); if (m.type === 'authenticated') finish(); else if (m.type === 'error') finish(new Error(m.message)); };
    socket.addEventListener('message', receive);
    socket.send(JSON.stringify({ type: 'authenticate', token }));
  });
}

const nav = document.createElement('nav');
nav.className = 'app-nav';
nav.setAttribute('aria-label', 'Main navigation');
nav.innerHTML = `<a class="wordmark" href="/">Interview Meet<img class="brand-mark" src="/assets/images/interview-meet-logo.png" width="34" height="34" alt=""></a>
  <div class="nav-links"><a href="/interview"><i class="ph ph-microphone" aria-hidden="true"></i>Interview room</a><a href="/coding"><i class="ph ph-code" aria-hidden="true"></i>Coding practice</a><a href="/history"><i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i>My interviews</a></div>
  <div class="nav-account"><a href="/login" id="account-link">Log in</a><a class="button small" href="/signup" id="signup-link">Get started <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a></div>`;
document.body.prepend(nav);
const iconMap = {
  '#startBtn': 'microphone', '#stopBtn': 'stop', '#cameraBtn': 'video-camera',
  '#send-text-btn': 'arrow-up', '#submit-code-btn': 'paper-plane-tilt',
  '#start-btn': 'play', '#end-btn': 'stop', '#voice-btn': 'microphone',
  '#review-now-btn': 'code-block', '#google-signin': 'google-logo',
  '#auth-submit': 'arrow-right', '#reset-password': 'key',
};
function decorateControls() {
  for (const [selector, icon] of Object.entries(iconMap)) {
    const control = document.querySelector(selector);
    if (control && !control.querySelector('.ph')) {
      const glyph = document.createElement('i'); glyph.className = 'ph ph-' + icon; glyph.setAttribute('aria-hidden', 'true');
      control.prepend(glyph, document.createTextNode(' '));
    }
  }
}
decorateControls();
new MutationObserver(decorateControls).observe(document.body, { childList: true, subtree: true });
for (const link of nav.querySelectorAll('.nav-links a')) if (link.pathname === location.pathname) link.setAttribute('aria-current', 'page');
// This redesign intentionally uses a single white theme on every surface.
ready.then(() => onAuthStateChanged(auth, user => {
  if (!user) return;
  document.getElementById('account-link').textContent = user.displayName || user.email?.split('@')[0] || 'My account';
  document.getElementById('account-link').href = '/history';
  const logout = document.getElementById('signup-link');
  logout.textContent = 'Sign out';
  logout.href = '#';
  logout.onclick = async event => { event.preventDefault(); await signOut(auth); location.assign('/login'); };
})).catch(() => {});

const form = document.getElementById('auth-form');
if (form) {
  const signup = location.pathname === '/signup';
  document.title = (signup ? 'Create account' : 'Welcome back') + ' | Interview Meet';
  document.getElementById('auth-title').textContent = signup ? 'Your next chapter starts here.' : 'Good to have you back.';
  document.getElementById('auth-intro').textContent = signup ? 'Create an account to save your practice and see how far you have come.' : 'Sign in to pick up your practice and revisit past interviews.';
  document.getElementById('name-field').hidden = !signup;
  document.getElementById('name').required = signup;
  document.getElementById('password').autocomplete = signup ? 'new-password' : 'current-password';
  document.getElementById('auth-submit').textContent = signup ? 'Create account' : 'Log in';
  document.getElementById('auth-switch').innerHTML = signup ? 'Already have an account? <a href="/login">Log in</a>' : 'New to Interview Meet? <a href="/signup">Create an account</a>';
  document.getElementById('reset-password').hidden = signup;
  const status = document.getElementById('auth-status');
  const destination = () => { const next = new URLSearchParams(location.search).get('next'); return ['/', '/interview', '/coding', '/history'].includes(next) ? next : '/history'; };
  const messages = { 'auth/invalid-credential': 'Email or password is incorrect.', 'auth/email-already-in-use': 'This email already has an account. Try logging in.', 'auth/popup-closed-by-user': 'Sign-in was cancelled. You can try again.', 'auth/weak-password': 'Use a password with at least 8 characters.', 'auth/too-many-requests': 'Too many attempts. Please wait and try again.', 'auth/unauthorized-domain': 'This domain needs to be added to Firebase authorized domains.' };
  const run = async action => {
    const buttons = [...form.querySelectorAll('button'), document.getElementById('google-signin')];
    buttons.forEach(b => b.disabled = true); status.textContent = 'Please wait…';
    try { await ready; await action(); } catch (error) { status.textContent = messages[error.code] || error.message; }
    finally { buttons.forEach(b => b.disabled = false); }
  };
  form.addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const email = form.elements.email.value.trim(), password = form.elements.password.value;
    if (signup) { const result = await createUserWithEmailAndPassword(auth, email, password); await updateProfile(result.user, { displayName: form.elements.name.value.trim() }); }
    else await signInWithEmailAndPassword(auth, email, password);
    location.assign(destination());
  }); });
  document.getElementById('google-signin').onclick = () => run(async () => { await signInWithPopup(auth, new GoogleAuthProvider()); location.assign(destination()); });
  document.getElementById('reset-password').onclick = () => run(async () => {
    if (!form.elements.email.value.trim()) throw new Error('Enter your email above first.');
    await sendPasswordResetEmail(auth, form.elements.email.value.trim()); status.textContent = 'If an account exists, a reset link has been sent. Check your inbox.';
  });
  ready.catch(error => status.textContent = error.message);
}
