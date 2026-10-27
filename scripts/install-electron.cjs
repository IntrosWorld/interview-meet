const { spawn } = require('node:child_process');
// Explicit install for npm configurations that disable dependency postinstall scripts.
const child = spawn(process.execPath, [require.resolve('electron/install.js')], {
  env: { ...process.env, ELECTRON_CACHE: 'F:/AI_models/electron-cache' },
  stdio: 'inherit', windowsHide: true,
});
const timeout = setTimeout(() => { console.error('Electron download timed out. Check access to GitHub releases, then retry npm run desktop:install.'); child.kill(); }, 180000);
child.on('error', error => { clearTimeout(timeout); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(timeout); process.exitCode = code ?? 1; });
