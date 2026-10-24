import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

// Fixture authentication exercises UI/storage wiring without real cloud credentials.
const fixtureAuth = `export async function requireUser(){return {uid:'fixture-user'}};
export async function authenticateSocket(){};
export async function api(path,options={}){const r=await fetch('/fixture/'+path,options);const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}`;

test('history renders stored transcripts, filters and deletes records', async ({ page }) => {
  await page.route('**/assets/auth.js', route => route.fulfill({ contentType: 'text/javascript', body: fixtureAuth }));
  let deleted = false;
  await page.route('**/fixture/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'DELETE') deleted = true;
    const data = path.endsWith('/profile') ? {} : path.endsWith('/interviews') ? {
      interviews: [{ id: 'fixture', mode: 'coding', target: 'Python arrays', status: 'completed', started_at: '2026-10-24T10:00:00Z' }], nextCursor: null
    } : { target: 'Python arrays', started_at: '2026-10-24T10:00:00Z', transcript: [{ role: 'user', text: 'My answer <script>must stay text</script>' }] };
    await route.fulfill({ json: data });
  });
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Python arrays' })).toBeVisible();
  await page.getByRole('button', { name: 'View transcript' }).click();
  await expect(page.locator('#detail-content')).toContainText('My answer <script>must stay text</script>');
  expect(await page.locator('#detail-content script').count()).toBe(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.selectOption('#history-filter', 'voice');
  await expect(page.getByRole('heading', { name: 'No matching sessions' })).toBeVisible();
  await page.selectOption('#history-filter', 'all');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your first practice starts here' })).toBeVisible();
  expect(deleted).toBeTruthy();
});

test('session saving serializes transcript updates and completion', async ({ page }) => {
  await page.route('**/assets/auth.js', route => route.fulfill({ contentType: 'text/javascript', body: fixtureAuth }));
  const updates: any[] = [];
  await page.route('**/fixture/interviews**', async route => {
    if (route.request().method() === 'PATCH') updates.push(route.request().postDataJSON());
    await route.fulfill({ json: { id: 'fixture' } });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const session = await import('/assets/session.js');
    await session.beginSession('voice', 'Engineer');
    const row = document.createElement('div');
    row.innerHTML = '<span class="speaker">You</span><span class="text">A real answer</span>';
    document.getElementById('transcript')!.append(row);
    await session.saveSession('active');
    await session.saveSession('completed');
  });
  expect(updates.map(u => u.status)).toEqual(['active', 'completed']);
  expect(updates[1].transcript).toEqual([{ role: 'user', text: 'A real answer' }]);
});

test('private APIs reject anonymous requests', async ({ request }) => {
  for (const path of ['profile', 'interviews', 'interviews/not-owned']) {
    const result = await request.get('/api/account/' + path);
    expect(result.status()).toBe(401);
    expect(await result.json()).toHaveProperty('error');
  }
  expect((await request.post('/api/account/interviews', { data: { mode: 'voice', target: 'Engineer' } })).status()).toBe(401);
  expect((await request.patch('/api/account/interviews/other', { data: {} })).status()).toBe(401);
  expect((await request.delete('/api/account/interviews/other')).status()).toBe(401);
  expect((await request.get('/api/account/profile', { headers: { Authorization: 'Bearer invalid' } })).status()).toBe(401);
});

test('websocket rejects an anonymous interview before opening AI session', async () => {
  const result = await new Promise<any>((resolve, reject) => {
    const socket = new WebSocket('ws://localhost:8017');
    const timeout = setTimeout(() => { socket.terminate(); reject(new Error('Socket timed out')); }, 5000);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'startInterview', interviewTarget: 'Engineer' })));
    socket.on('message', data => { clearTimeout(timeout); socket.close(); resolve(JSON.parse(String(data))); });
    socket.on('error', reject);
  });
  expect(result).toEqual({ type: 'error', message: 'Sign in before starting an interview' });
});

test('public config contains no server secrets', async ({ request }) => {
  const response = await request.get('/api/config');
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(Object.keys(data).sort()).toEqual(['firebase', 'storageEnabled']);
  expect(JSON.stringify(data)).not.toMatch(/DATABASE_URL|GOOGLE_API_KEY|private_key|SERVICE_ACCOUNT/);
});

for (const size of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`screens stay white at ${size.width}px including dark system preference`, async ({ page }) => {
    await page.setViewportSize(size);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const path of ['/', '/coding', '/login', '/signup', '/history']) {
      await page.goto(path);
      await expect(page.getByRole('navigation')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      if (path === '/login' || path === '/signup') {
        await expect(page.locator('#auth-status')).toContainText('Sign-in is not configured');
        await expect(page.locator('#name-field')).toBeVisible({ visible: path === '/signup' });
      }
      if (path === '/history') await expect(page.locator('#history-status')).toContainText('Sign-in is not configured');
      await page.screenshot({ path: `test-results/${size.width}-${path.replaceAll('/', '') || 'room'}-light.png`, fullPage: true });
      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
      await page.screenshot({ path: `test-results/${size.width}-${path.replaceAll('/', '') || 'room'}-white.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
