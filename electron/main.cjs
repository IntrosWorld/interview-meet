const { app, BrowserWindow, Menu, session, dialog } = require('electron');
const OFFICIAL = 'https://interview-meet.mohitnaik.tech';
const LOCAL = 'http://127.0.0.1:8010';
let window;
function trusted(url) { try { return [OFFICIAL, LOCAL].includes(new URL(url).origin); } catch { return false; } }
function authOrigin(url) { try { const u = new URL(url); return u.protocol === 'https:' && (u.hostname === 'accounts.google.com' || u.hostname.endsWith('.firebaseapp.com')); } catch { return false; } }
function protect(contents) {
  contents.on('will-navigate', (event, url) => { if (!trusted(url) && !authOrigin(url)) event.preventDefault(); });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(OFFICIAL + '/')) { open('gemini'); return { action: 'deny' }; }
    if (authOrigin(url)) return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } } };
    return { action: 'deny' };
  });
}
async function open(engine, coding = false) {
  // Switching destroys the old renderer and microphone. Cloud storage never enters local mode.
  const previous = window;
  window = new BrowserWindow({ width: 1400, height: 950, title: 'Interview Meet', webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true,
    partition: engine === 'gemini' ? 'persist:official-website' : 'local-interview',
  } });
  previous?.destroy();
  const destination = engine === 'gemini' ? `${OFFICIAL}/login?next=${coding ? '/coding' : '/interview'}` : `${LOCAL}/desktop/${coding ? 'coding' : 'interview'}`;
  try { await window.loadURL(destination); } catch { dialog.showErrorBox('Unable to open Interview Meet', engine === 'local' ? 'Start npm run local, then choose Local again from the Model menu.' : 'The official website could not be reached. Check your internet connection.'); }
}
app.on('web-contents-created', (_, contents) => protect(contents));
app.whenReady().then(() => {
  for (const name of ['persist:official-website', 'local-interview']) {
    const s = session.fromPartition(name);
    s.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'media' && trusted(contents.getURL())));
    s.setPermissionCheckHandler((contents, permission, origin) => permission === 'media' && trusted(origin) && !!contents && trusted(contents.getURL()));
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Model', submenu: [
      { label: 'Local · Interview', click: () => open('local') },
      { label: 'Local · Coding', click: () => open('local', true) },
      { type: 'separator' },
      { label: 'Gemini · Sign in on official website', click: () => open('gemini') },
      { label: 'Gemini · Coding', click: () => open('gemini', true) },
      { type: 'separator' }, { role: 'quit' },
    ] }, { role: 'editMenu' }, { role: 'viewMenu' },
  ]));
  open('local');
});
app.on('window-all-closed', () => app.quit());
