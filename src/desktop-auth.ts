import { createHash, randomBytes } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { neon } from '@neondatabase/serverless';
import { bodyLimit } from 'hono/body-limit';
import type { Hono } from 'hono';

export const hashCode = (value: string) => createHash('sha256').update(value).digest('base64url');
export function validCallback(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const u = new URL(value); return u.protocol === 'http:' && u.hostname === '127.0.0.1' && !!u.port && u.pathname === '/callback' && !u.search && !u.hash && !u.username && !u.password; } catch { return false; }
}
export const validChallenge = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export function registerDesktopAuth(app: Hono, dependencies?: { sql: any; mint: (uid: string) => Promise<string> }) {
  // Register after account authentication middleware. No browser-supplied uid is trusted.
  app.post('/api/account/desktop/authorize', async c => {
    const body = await c.req.json().catch(() => null);
    if (!body || !validChallenge(body.challenge) || !validCallback(body.redirect)) return c.json({ error: 'Invalid desktop authorization' }, 400);
    if (!dependencies && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return c.json({ error: 'Desktop sign-in is not configured on the website yet. The owner needs to add the Firebase service-account signing credential.' }, 503);
    const user = c.get('user' as never) as { uid: string; auth_time: number };
    if (Date.now() / 1000 - user.auth_time > 600) return c.json({ error: 'Please sign out and sign in again before linking this desktop.' }, 401);
    const sql = dependencies?.sql || neon(process.env.DATABASE_URL!);
    const code = randomBytes(32).toString('base64url');
    await sql`DELETE FROM desktop_login_codes WHERE expires_at < now()`;
    await sql`INSERT INTO desktop_login_codes (code_hash, challenge, firebase_uid) VALUES (${hashCode(code)}, ${body.challenge}, ${user.uid})`;
    return c.json({ code });
  });
  app.use('/api/desktop/*', bodyLimit({ maxSize: 4096 }));
  app.post('/api/desktop/exchange', async c => {
    c.header('Cache-Control', 'no-store');
    const body = await c.req.json().catch(() => null);
    if (!body || !validChallenge(body.code) || typeof body.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(body.verifier)) return c.json({ error: 'Invalid authorization code' }, 400);
    const sql = dependencies?.sql || neon(process.env.DATABASE_URL!);
    // Atomic consume: wrong proof cannot consume a code, concurrent replay cannot succeed.
    const rows = await sql`DELETE FROM desktop_login_codes WHERE code_hash = ${hashCode(body.code)} AND challenge = ${hashCode(body.verifier)} AND expires_at > now() RETURNING firebase_uid`;
    if (rows.length !== 1) return c.json({ error: 'Authorization expired or already used. Start again.' }, 401);
    // Initialize Firebase in this serverless instance even if authorization ran elsewhere.
    let token: string;
    if (dependencies) token = await dependencies.mint(rows[0].firebase_uid);
    else { const { ensureFirebase } = await import('./accounts.js'); ensureFirebase(); token = await getAuth().createCustomToken(rows[0].firebase_uid); }
    return c.json({ token });
  });
}
