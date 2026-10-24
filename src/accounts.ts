import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { neon } from '@neondatabase/serverless';
import type { Hono } from 'hono';
import { randomUUID } from 'node:crypto';

export async function verifyToken(token: string): Promise<DecodedIdToken> {
  if (!process.env.FIREBASE_PROJECT_ID) throw new Error('Authentication is not configured');
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    initializeApp(serviceAccount
      ? { credential: cert(JSON.parse(serviceAccount)), projectId: process.env.FIREBASE_PROJECT_ID }
      : { projectId: process.env.FIREBASE_PROJECT_ID });
  }
  return getAuth().verifyIdToken(token);
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error('Interview storage is not configured');
  return neon(process.env.DATABASE_URL);
}

export function registerAccounts(app: Hono) {
  app.get('/api/config', (c) => c.json({
    firebase: { apiKey: process.env.FIREBASE_WEB_API_KEY, authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID, appId: process.env.FIREBASE_APP_ID },
    storageEnabled: Boolean(process.env.DATABASE_URL),
  }));

  app.use('/api/account/*', async (c, next) => {
    const header = c.req.header('Authorization') || '';
    if (!header.startsWith('Bearer ')) return c.json({ error: 'Sign in to continue' }, 401);
    try { c.set('user' as never, await verifyToken(header.slice(7)) as never); }
    catch { return c.json({ error: 'Your sign-in expired. Please sign in again.' }, 401); }
    c.header('Cache-Control', 'no-store');
    await next();
  });

  app.onError((error, c) => {
    console.error('Request failed:', error.message);
    return c.json({ error: 'Unable to complete this request. Check your server configuration and try again.' }, 503);
  });

  app.get('/api/account/profile', async (c) => {
    const user = c.get('user' as never) as DecodedIdToken;
    const sql = database();
    const rows = await sql`INSERT INTO users (firebase_uid, email, display_name)
      VALUES (${user.uid}, ${user.email || ''}, ${user.name || ''})
      ON CONFLICT (firebase_uid) DO UPDATE SET email = EXCLUDED.email,
        display_name = EXCLUDED.display_name, updated_at = now()
      RETURNING firebase_uid, email, display_name, created_at`;
    return c.json(rows[0]);
  });

  app.get('/api/account/interviews', async (c) => {
    const user = c.get('user' as never) as DecodedIdToken;
    const sql = database();
    const before = c.req.query('before');
    if (before && Number.isNaN(Date.parse(before))) return c.json({ error: 'Invalid cursor' }, 400);
    const rows = await sql`SELECT id, mode, target, status, started_at, ended_at
      FROM interviews WHERE firebase_uid = ${user.uid}
      AND started_at < ${before || '9999-12-31'}::timestamptz ORDER BY started_at DESC LIMIT 31`;
    return c.json({ interviews: rows.slice(0, 30), nextCursor: rows.length > 30 ? rows[29].started_at : null });
  });

  app.post('/api/account/interviews', async (c) => {
    const user = c.get('user' as never) as DecodedIdToken;
    const body = await c.req.json().catch(() => null);
    if (!body || !['voice', 'coding'].includes(body.mode) || typeof body.target !== 'string'
      || !body.target.trim() || body.target.length > 300) return c.json({ error: 'Choose a valid interview target' }, 400);
    const sql = database();
    const id = randomUUID();
    await sql`INSERT INTO users (firebase_uid, email, display_name)
      VALUES (${user.uid}, ${user.email || ''}, ${user.name || ''}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO interviews (id, firebase_uid, mode, target)
      VALUES (${id}, ${user.uid}, ${body.mode}, ${body.target.trim()})`;
    return c.json({ id }, 201);
  });

  app.get('/api/account/interviews/:id', async (c) => {
    const user = c.get('user' as never) as DecodedIdToken;
    const sql = database();
    const rows = await sql`SELECT * FROM interviews WHERE id = ${c.req.param('id')} AND firebase_uid = ${user.uid}`;
    return rows.length ? c.json(rows[0]) : c.json({ error: 'Interview not found' }, 404);
  });

  app.patch('/api/account/interviews/:id', async (c) => {
    const user = c.get('user' as never) as DecodedIdToken;
    const body = await c.req.json().catch(() => null);
    if (!body || !Array.isArray(body.transcript) || body.transcript.length > 1000
      || body.transcript.some((t: any) => !t || !['user', 'assistant', 'system'].includes(t.role)
        || typeof t.text !== 'string' || t.text.length > 16000)
      || !['active', 'completed', 'interrupted'].includes(body.status)) return c.json({ error: 'Invalid interview update' }, 400);
    if (JSON.stringify(body.transcript).length > 500000) return c.json({ error: 'Transcript is too large' }, 413);
    const sql = database();
    const rows = await sql`UPDATE interviews SET transcript = ${JSON.stringify(body.transcript)}::jsonb,
      status = ${body.status}, ended_at = CASE WHEN ${body.status} = 'active' THEN NULL ELSE now() END
      WHERE id = ${c.req.param('id')} AND firebase_uid = ${user.uid} RETURNING id`;
    return rows.length ? c.json(rows[0]) : c.json({ error: 'Interview not found' }, 404);
  });

  app.delete('/api/account/interviews/:id', async (c) => {
    const user = c.get('user' as never) as DecodedIdToken;
    const sql = database();
    const rows = await sql`DELETE FROM interviews WHERE id = ${c.req.param('id')} AND firebase_uid = ${user.uid} RETURNING id`;
    return rows.length ? c.json({ deleted: true }) : c.json({ error: 'Interview not found' }, 404);
  });
}
