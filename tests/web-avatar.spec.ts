import { test, expect } from '@playwright/test';
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
