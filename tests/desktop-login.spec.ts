import { test, expect } from '@playwright/test';

test('desktop approval requires account authentication on the real server', async ({ request }) => {
  const denied = await request.post('/api/account/desktop/authorize', { data: { challenge: 'a'.repeat(43), redirect: 'http://127.0.0.1:54321/callback' } });
  expect(denied.status()).toBe(401);
  expect((await request.post('/api/desktop/exchange', { data: {} })).status()).toBe(400);
  const page = await request.get('/desktop/authorize');
  expect(page.headers()['cache-control']).toBe('no-store');
  expect(page.headers()['referrer-policy']).toBe('no-referrer');
});

test('browser requires explicit approval and returns only code and state', async ({ page }) => {
  await page.route('**/assets/auth.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const ready=Promise.resolve();
    export async function requireUser(){return {email:'test@example.test'};}
    export async function api(){return {code:'${'c'.repeat(43)}'};}
    export async function completeDesktopSignIn(){}
  ` }));
  let callback = '';
  await page.route('http://127.0.0.1:54321/callback?**', route => { callback = route.request().url(); return route.fulfill({ body: 'Return to the app.' }); });
  const query = new URLSearchParams({ redirect: 'http://127.0.0.1:54321/callback', challenge: 'a'.repeat(43), state: 'b'.repeat(43) });
  await page.goto('/desktop/authorize?' + query);
  await expect(page.getByRole('button', { name: 'Allow desktop sign-in' })).toBeVisible();
  expect(callback).toBe('');
  await page.getByRole('button', { name: 'Allow desktop sign-in' }).click();
  await expect.poll(() => callback).toContain('/callback?');
  const url = new URL(callback);
  expect([...url.searchParams.keys()].sort()).toEqual(['code', 'state']);
  expect(url.searchParams.get('state')).toBe('b'.repeat(43));
});

test('browser rejects non-loopback desktop callbacks', async ({ page }) => {
  await page.route('**/assets/auth.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export const ready=Promise.resolve(); export function requireUser(){} export function api(){} export function completeDesktopSignIn(){}' }));
  await page.goto('/desktop/authorize?redirect=https://evil.test/callback&challenge=' + 'a'.repeat(43) + '&state=' + 'b'.repeat(43));
  await expect(page.locator('#desktop-status')).toHaveText('Invalid desktop request');
  await expect(page.locator('#desktop-approve')).toBeHidden();
});
