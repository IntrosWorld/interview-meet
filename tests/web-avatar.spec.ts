import { test, expect } from '@playwright/test';

test('female avatar switches live, animates, persists, and can return to male', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/interview');
  const stage = page.locator('#avatar-stage'), select = page.getByLabel('Interviewer avatar');
  await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect(select).toHaveValue('male');
  await select.selectOption('female');
  await expect(stage).toHaveAttribute('data-avatar', 'female');
  await expect(select).toBeEnabled();
  await stage.screenshot({ path: 'test-results/female-avatar.png' });
  await page.evaluate(async () => {
    const context = new AudioContext(); await context.resume();
    window.dispatchEvent(new CustomEvent('interviewer:speech', { detail: {
      type: 'audio', context, start: context.currentTime, duration: 10,
      visemes: [{ id: 1, time: 0, duration: 10 }]
    } }));
  });
  await expect.poll(() => stage.evaluate((e: any) => e.avatarDiagnostics.viseme)).toBe('aa');
  await expect.poll(() => stage.evaluate((e: any) => e.avatarDiagnostics.jaw)).toBeGreaterThan(.01);
  await page.reload();
  await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect(stage).toHaveAttribute('data-avatar', 'female');
  await select.selectOption('male');
  await expect(stage).toHaveAttribute('data-avatar', 'male');
  expect(errors).toEqual([]);
});

test('failed female asset download keeps the current male avatar usable', async ({ page }) => {
  await page.route('**/models/interviewer-female.glb', route => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/interview');
  await expect(page.locator('#avatar-stage')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await page.getByLabel('Interviewer avatar').selectOption('female');
  await expect(page.locator('#avatar-state')).toHaveText('Could not load avatar. Current interviewer kept.');
  await expect(page.getByLabel('Interviewer avatar')).toHaveValue('male');
  await expect(page.getByLabel('Interviewer avatar')).toBeEnabled();
  await expect(page.locator('#avatar-stage')).toHaveAttribute('data-avatar', 'male');
});
test('public 3D interviewer renders and follows playback-clock audio energy', async ({ page }) => {
  await page.goto('/interview');
  await expect(page.locator('#avatar-stage')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await page.evaluate(async () => {
    const context = new AudioContext(); await context.resume();
    window.dispatchEvent(new CustomEvent('interviewer:speech', { detail: { type: 'pcm', context, start: context.currentTime, duration: 10, envelope: Array(500).fill(.8), step: .02 } }));
  });
  await expect.poll(() => page.evaluate(() => (document.getElementById('avatar-stage') as any).avatarDiagnostics.jaw)).toBeGreaterThan(.05);
  await expect(page.locator('#avatar-state')).toHaveText('Speaking · audio-driven');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('interviewer:speech', { detail: { type: 'cancel' } })));
  await expect(page.locator('#avatar-state')).toHaveText('Ready');
  await expect(page.locator('#cameraBtn')).toBeVisible();
});
