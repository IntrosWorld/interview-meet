const { app, BrowserWindow, Menu, session, dialog, shell, ipcMain } = require('electron');
const path = require('node:path');
const { startBrowserLogin } = require('./browser-login.cjs');
const OFFICIAL = 'https://interview-meet.mohitnaik.tech';
const LOCAL = 'http://127.0.0.1:8010';
let window;
let pendingLogin, credential;
ipcMain.handle('desktop:credential', event => {
  const frame = event.senderFrame;
  if (!window || event.sender !== window.webContents || frame !== event.sender.mainFrame) throw Error('Unauthorized frame');
  const url = new URL(frame.url);
  if (url.origin !== OFFICIAL || url.pathname !== '/desktop/complete' || !credential || credential.expires < Date.now()) throw Error('Authorization expired');
  const token = credential.token; credential = null; return token;
});
function trusted(url) { try { return [OFFICIAL, LOCAL].includes(new URL(url).origin); } catch { return false; } }
function protect(contents) {
  contents.on('will-navigate', (event, url) => {
    const u = new URL(url);
    if (u.origin === OFFICIAL && ['/login', '/signup'].includes(u.pathname)) { event.preventDefault(); void open('gemini'); return; }
    if (!trusted(url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(OFFICIAL + '/')) { void open('gemini'); return { action: 'deny' }; }
    return { action: 'deny' };
  });
}
async function open(engine, coding = false) {
  pendingLogin?.cancel(); pendingLogin = null; credential = null;
  if (engine === 'gemini') {
    const attempt = startBrowserLogin(url => shell.openExternal(url)); pendingLogin = attempt;
    try {
      const token = await attempt.result;
      if (pendingLogin !== attempt) return;
      pendingLogin = null; credential = { token, expires: Date.now() + 30000 };
    } catch (error) { if (pendingLogin === attempt) { pendingLogin = null; dialog.showErrorBox('Desktop sign-in', error.message); } return; }
  }
  // Switching destroys the old renderer and microphone. Cloud storage never enters local mode.
  const previous = window;
  window = new BrowserWindow({ width: 1400, height: 950, title: 'Interview Meet', webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true,
    preload: engine === 'gemini' ? path.join(__dirname, 'preload.cjs') : undefined,
    partition: engine === 'gemini' ? 'persist:official-website' : 'local-interview',
  } });
  previous?.destroy();
  const destination = engine === 'gemini' ? `${OFFICIAL}/desktop/complete?mode=${coding ? 'coding' : 'interview'}` : `${LOCAL}/desktop/${coding ? 'coding' : 'interview'}`;
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
app.on('before-quit', () => { const attempt = pendingLogin; pendingLogin = null; attempt?.cancel(); credential = null; });
app.on('window-all-closed', () => app.quit());
