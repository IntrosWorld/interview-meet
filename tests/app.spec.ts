import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

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
  test(`screens and theme work at ${size.width}px`, async ({ page }) => {
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
      await page.getByRole('button', { name: 'Toggle color theme' }).click();
      await page.screenshot({ path: `test-results/${size.width}-${path.replaceAll('/', '') || 'room'}-dark.png`, fullPage: true });
      await page.getByRole('button', { name: 'Toggle color theme' }).click();
    }
    expect(errors).toEqual([]);
  });
}
