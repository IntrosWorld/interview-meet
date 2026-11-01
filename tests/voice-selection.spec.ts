import { test, expect } from '@playwright/test';

for (const mode of ['interview', 'coding']) {
  test(`${mode} defaults to male and sends the selected voice when starting`, async ({ page }) => {
    await page.route('**/assets/session.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      export async function authenticateSocket() {}
      export async function beginSession() {}
      export async function saveSession() {}
    ` }));
    await page.route('**/assets/interviewer.bundle.js', route => route.fulfill({ body: '' }));
    await page.addInitScript(() => {
      const w = window as any;
      w.sent = [];
      w.WebSocket = class {
        static OPEN = 1; static CONNECTING = 0;
        readyState = 1; onopen: any; onclose: any;
        constructor() { setTimeout(() => this.onopen?.(), 0); }
        send(message: string) { w.sent.push(JSON.parse(message)); }
        close() { this.readyState = 3; this.onclose?.(); }
      };
      w.AudioContext = class {
        state = 'running'; destination = {}; currentTime = 0;
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
        createMediaStreamSource(stream: any) { return { mediaStream: stream, connect() {}, disconnect() {} }; }
        createScriptProcessor() { return { connect() {}, disconnect() {} }; }
        createBuffer() { return {}; }
        createBufferSource() { return { connect() {}, start() {}, disconnect() {} }; }
      };
      Object.defineProperty(navigator, 'mediaDevices', { value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] })
      } });
    });
    await page.goto('/' + mode);
    await expect(page.getByLabel('Interviewer voice')).toHaveValue('male');
    await page.getByLabel('Interviewer voice').selectOption('female');
    if (mode === 'interview') {
      await page.locator('#interview-target-input').fill('Backend engineer');
      await page.locator('#startBtn').click();
    } else {
      await page.locator('#language').selectOption('JavaScript');
      await page.locator('#topic').fill('Arrays');
      await page.locator('#start-btn').click();
    }
    await expect.poll(() => page.evaluate(() => (window as any).sent[0]?.voiceStyle)).toBe('female');
    await expect(page.getByLabel('Interviewer voice')).toBeDisabled();
    await page.locator(mode === 'interview' ? '#stopBtn' : '#end-btn').click();
    await expect(page.getByLabel('Interviewer voice')).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel('Interviewer voice')).toHaveValue('female');
  });
}
