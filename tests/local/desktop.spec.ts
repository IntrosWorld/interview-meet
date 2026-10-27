import { test, expect } from '@playwright/test';

test('desktop interview reuses web layout with local conversation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/desktop/interview');
  await expect(page.locator('h1')).toHaveText('Make your next answer count.');
  await expect(page.locator('#model')).toHaveValue('qwen3:1.7b');
  await page.locator('#target').fill('Backend engineer');
  await page.locator('#message').fill('Hello');
  await page.locator('#send').click();
  await expect(page.locator('#status')).toHaveText('Ready for your next answer.');
  await expect(page.locator('#messages')).toContainText('Local interviewer');
  expect(errors).toEqual([]);
});

test('desktop coding sends requested code review without executing code', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/desktop/coding');
  await expect(page.locator('#model')).toHaveValue('qwen3:1.7b');
  await page.locator('#language').selectOption('JavaScript');
  await page.locator('#target').fill('Arrays');
  await page.locator('.CodeMirror').click();
  await page.keyboard.type('function sum(a,b) { return a+b; }');
  await page.locator('#review-now-btn').click();
  await expect(page.locator('#status')).toHaveText('Ready for your next answer.');
  await expect(page.locator('#messages')).toContainText('function sum');
  await expect(page.locator('.app-nav a', { hasText: 'Gemini' })).toHaveAttribute('href', 'https://interview-meet.mohitnaik.tech/login?next=/interview');
  expect(errors).toEqual([]);
});
