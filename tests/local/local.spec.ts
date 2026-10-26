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

test('hands-free detects a pause, speaks early, resumes listening, and stops cleanly', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any; w.voiceStarts = 0; w.listens = 0;
    w.SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [{ voiceURI: 'test-local', name: 'Test local voice', lang: 'en-US', localService: true }],
      addEventListener() {}, cancel() {}, speak(u: any) { w.voiceStarts++; setTimeout(() => u.onstart?.(), 5); setTimeout(() => u.onend?.(), 80); }
    } });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      w.listens++; return { getTracks: () => [{ stop() {} }] };
    } } });
    w.MediaRecorder = class {
      state = 'inactive'; mimeType = 'audio/wav'; ondataavailable: any; onstop: any;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['test audio']) }); queueMicrotask(() => this.onstop?.()); }
    };
    w.AudioContext = class {
      born = performance.now();
      createMediaStreamSource() { return { connect() {} }; }
      createAnalyser() { let frames = 0; return { fftSize: 2048, getFloatTimeDomainData(a: Float32Array) { a.fill(frames++ < 25 ? .1 : 0); } }; }
      close() { return Promise.resolve(); }
    };
  });
  await page.route('**/api/status', route => route.fulfill({ json: { defaultModel: 'qwen3:1.7b', models: ['qwen3:1.7b'], ollamaReady: true, speechReady: true, speech: { model: 'tiny.en' } } }));
  await page.route('**/api/transcribe', route => route.fulfill({ json: { text: 'I built an API', transcriptionMs: 25 } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start conversation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start conversation', exact: true }).click();
  await expect(page.locator('#messages')).toContainText('You said: I built an API');
  await expect.poll(() => page.evaluate(() => (window as any).voiceStarts)).toBeGreaterThan(0);
  await expect(page.locator('#metrics')).toContainText('First spoken audio after pause');
  await expect.poll(() => page.evaluate(() => (window as any).listens)).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'End conversation', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Conversation ended. Microphone off.');
  await expect(page.getByRole('button', { name: 'Start conversation', exact: true })).toBeEnabled();
});

test('voice output queues the first phrase before sentence completion', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    (window as any).SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    const { createVoiceQueue } = await import('/assets/local-voice.js');
    const queued: string[] = [];
    const synth = { speak: (u: SpeechSynthesisUtterance) => queued.push(u.text), cancel() {} };
    const voice = { localService: true };
    const queue = createVoiceQueue(synth, () => voice, () => {});
    queue.push('What did you learn ');
    const early = queued.length;
    queue.push('from this project?'); queue.push('', true);
    return { early, queued };
  });
  expect(result.early).toBe(1);
  expect(result.queued.join(' ')).toBe('What did you learn from this project?');
});
