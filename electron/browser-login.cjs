const { createServer } = require('node:http');
const { randomBytes, createHash } = require('node:crypto');
const OFFICIAL = 'https://interview-meet.mohitnaik.tech';
const random = () => randomBytes(32).toString('base64url');
function startBrowserLogin(openExternal, exchange = async (code, verifier) => {
  const response = await fetch(OFFICIAL + '/api/desktop/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, verifier }), signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw Error('Authorization failed. Start sign-in again.');
  const body = await response.json(); if (typeof body.token !== 'string') throw Error('Invalid authorization response');
  return body.token;
}) {
  const verifier = random(), state = random();
  let settled = false, accepting = false, timer, resolve, reject;
  const result = new Promise((yes, no) => { resolve = yes; reject = no; });
  const finish = (error, token) => { if (settled) return; settled = true; clearTimeout(timer); server.close(); if (error) reject(error); else resolve(token); };
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Type', 'text/plain');
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== '/callback' || url.searchParams.get('state') !== state || !/^[\w-]{43}$/.test(url.searchParams.get('code') || '') || accepting) { res.writeHead(400); res.end('Invalid or inactive desktop sign-in.'); return; }
    accepting = true;
    try {
      const token = await exchange(url.searchParams.get('code'), verifier);
      res.end('Signed in. You can close this tab and return to Interview Meet.'); finish(null, token);
    } catch (error) { res.writeHead(400); res.end('Sign-in failed. Return to the app and try again.'); finish(error); }
  });
  server.on('error', error => finish(error));
  server.listen(0, '127.0.0.1', async () => {
    if (settled) { server.close(); return; }
    const url = new URL('/desktop/authorize', OFFICIAL);
    url.searchParams.set('redirect', `http://127.0.0.1:${server.address().port}/callback`);
    url.searchParams.set('challenge', createHash('sha256').update(verifier).digest('base64url'));
    url.searchParams.set('state', state);
    try { await openExternal(url.href); } catch (error) { finish(error); }
  });
  timer = setTimeout(() => finish(Error('Sign-in timed out. Try again.')), 180000);
  return { result, cancel: () => finish(Error('Sign-in cancelled.')) };
}
module.exports = { startBrowserLogin };
