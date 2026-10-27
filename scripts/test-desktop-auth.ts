import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { hashCode, validCallback, registerDesktopAuth } from '../src/desktop-auth.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { startBrowserLogin } = require('../electron/browser-login.cjs');

test('callback allowlist rejects remote hosts, credentials, query, and wrong paths', () => {
  assert.equal(validCallback('http://127.0.0.1:54321/callback'), true);
  for (const value of ['https://evil.test/callback', 'http://localhost:80/callback', 'http://127.0.0.1:1234/other', 'http://127.0.0.1:1234/callback?x=1', 'http://u@127.0.0.1:1234/callback']) assert.equal(validCallback(value), false);
});

test('server authorization: validation, PKCE, atomic replay rejection, expiration, and recent sign-in', async () => {
  const records = new Map<string, { challenge: string; uid: string; expires: number }>();
  let fresh = true;
  const sql = async (strings: TemplateStringsArray, ...v: any[]) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO')) { records.set(v[0], { challenge: v[1], uid: v[2], expires: Date.now() + 120000 }); return []; }
    if (query.includes('RETURNING')) { const r = records.get(v[0]); if (!r || r.challenge !== v[1] || r.expires < Date.now()) return []; records.delete(v[0]); return [{ firebase_uid: r.uid }]; }
    return [];
  };
  const app = new Hono();
  app.use('/api/account/*', async (c, next) => { c.set('user' as never, { uid: 'verified-user', auth_time: fresh ? Date.now()/1000 : 0 } as never); await next(); });
  registerDesktopAuth(app, { sql, mint: async uid => 'custom-for-' + uid });
  const post = (path: string, body: any) => app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const verifier = 'a'.repeat(43), challenge = hashCode(verifier);
  const authorize = () => post('/api/account/desktop/authorize', { challenge, redirect: 'http://127.0.0.1:54321/callback' });
  const { code } = await (await authorize()).json();
  assert.equal((await post('/api/desktop/exchange', { code, verifier: 'b'.repeat(43) })).status, 401);
  const responses = await Promise.all([post('/api/desktop/exchange', { code, verifier }), post('/api/desktop/exchange', { code, verifier })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
  const next = await (await authorize()).json(); records.get(hashCode(next.code))!.expires = 0;
  assert.equal((await post('/api/desktop/exchange', { code: next.code, verifier })).status, 401);
  fresh = false; assert.equal((await authorize()).status, 401);
  assert.equal((await post('/api/desktop/exchange', {})).status, 400);
});

test('loopback callback rejects wrong state then exchanges proof and closes', async () => {
  let opened!: URL;
  let notify!: () => void;
  const ready = new Promise<void>(resolve => notify = resolve);
  const attempt = startBrowserLogin(async (url: string) => { opened = new URL(url); notify(); }, async (code: string, verifier: string) => {
    assert.equal(code, 'c'.repeat(43)); assert.equal(hashCode(verifier), opened.searchParams.get('challenge')); return 'test-credential';
  });
  await ready;
  const callback = new URL(opened.searchParams.get('redirect')!);
  callback.searchParams.set('code', 'c'.repeat(43)); callback.searchParams.set('state', 'wrong');
  assert.equal((await fetch(callback)).status, 400);
  callback.searchParams.set('state', opened.searchParams.get('state')!);
  assert.equal((await fetch(callback)).status, 200);
  assert.equal(await attempt.result, 'test-credential');
});

test('cancel releases loopback listener and rejects pending login', async () => {
  const attempt = startBrowserLogin(async () => {});
  const rejection = assert.rejects(attempt.result, /cancelled/); attempt.cancel(); await rejection;
});
