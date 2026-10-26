import { test, expect } from '@playwright/test';

test('loopback API requires its custom request header and rejects cross origins', async ({ request }) => {
  expect((await request.post('/api/chat', { data: {} })).status()).toBe(403);
  expect((await request.post('/api/chat', { headers: { 'X-Local-Lab': '1', Origin: 'https://outside.test' }, data: {} })).status()).toBe(403);
  expect((await request.post('/api/chat', { headers: { 'X-Local-Lab': '1' }, data: {} })).status()).toBe(400);
});

test('streams chat, keeps context, and renders model text safely', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:8011')) outside.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('#model')).toHaveValue('qwen3:1.7b');
  await page.locator('#message').fill('<script>example</script>');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Ready for your next answer.');
  await expect(page.locator('#messages')).toContainText('I received 1 turns.');
  expect(await page.locator('#messages script').count()).toBe(0);
  await page.locator('#message').fill('An API'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#messages')).toContainText('I received 3 turns.');
  await expect(page.locator('#metrics')).toContainText('tokens/sec');
  expect(outside).toEqual([]);
});

test('interrupts generation and allows a new conversation', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#model')).toHaveValue('qwen3:1.7b');
  await page.locator('#message').fill('long'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#messages')).toContainText('more');
  await page.getByRole('button', { name: 'Interrupt' }).click();
  await expect(page.locator('#status')).toContainText('Interrupted');
  await page.getByRole('button', { name: 'New conversation' }).click();
  await expect(page.locator('#messages')).toBeEmpty();
});

test('shows generation errors and unavailable Whisper clearly', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('#health')).toContainText('unavailable');
  await expect(page.locator('#record')).toBeDisabled();
  await page.locator('#message').fill('fail'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Could not run');
  await expect(page.locator('#send')).toBeEnabled();
  const result = await request.post('/api/transcribe', { headers: { 'X-Local-Lab': '1' }, data: 'not audio' });
  expect(result.status()).toBe(503);
});

test('fits a phone without a cloud login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.locator('#model')).toHaveValue('qwen3:1.7b');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/local-mobile.png', fullPage: true });
});
