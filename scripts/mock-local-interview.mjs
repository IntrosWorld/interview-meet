import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = 'F:/AI_models/interview-meet/mock-interview';
const files = Object.fromEntries(await Promise.all(['intro', 'project', 'auth', 'database', 'challenge', 'testing', 'performance', 'security', 'fallback'].map(async name => [name, (await readFile(`${root}/${name}.wav`)).toString('base64')])));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1365, height: 1000 } });
page.on('pageerror', error => console.log('Browser error:', error.message));
const progress = setInterval(async () => {
  try { console.log('Stage:', await page.locator('#status').innerText()); } catch {}
}, 10000);
await page.addInitScript(({ files }) => {
  window.mockFiles = files; window.nextAnswer = 'intro'; window.mockCaptures = [];
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
    const chosen = window.nextAnswer; window.mockCaptures.push(chosen);
    const bytes = Uint8Array.from(atob(window.mockFiles[chosen]), x => x.charCodeAt(0));
    const context = new AudioContext(); const buffer = await context.decodeAudioData(bytes.buffer);
    const source = context.createBufferSource(); source.buffer = buffer;
    const destination = context.createMediaStreamDestination(); source.connect(destination);
    await context.resume(); source.start(context.currentTime + .2);
    source.onended = () => context.close();
    return destination.stream;
  } } });
}, { files });
const results = [];
try {
  await page.goto('http://127.0.0.1:8010');
  if (process.argv[2]) await page.locator('#model').selectOption(process.argv[2]);
  await page.waitForFunction(() => !document.querySelector('#send').disabled, {}, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#voice').options.length > 1);
  await page.locator('#pause').selectOption('800');
  await page.locator('#record').click();
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(n => document.querySelectorAll('.local-message[data-role=assistant]').length > n, i, { timeout: 90000 });
    await page.waitForFunction(() => /Speaking\.|Ready for your next answer\.|Listening\./.test(document.querySelector('#status').textContent) && document.querySelector('#metrics').textContent.includes('Generation:'), {}, { timeout: 90000 });
    const question = await page.locator('.local-message[data-role=assistant] span').nth(i).innerText();
    await page.waitForFunction(() => document.querySelector('#metrics').textContent.includes('First spoken audio'), {}, { timeout: 30000 });
    const metrics = await page.locator('#metrics').innerText();
    const candidate = await page.locator('.local-message[data-role=user]').last().innerText();
    const result = { turn: i + 1, candidate, interviewer: question, metrics };
    results.push(result); console.log(JSON.stringify(result));
    let answer = /auth|token|login|permission|role-based/i.test(question) ? 'auth'
      : /secur|password|attack|validat/i.test(question) ? 'security'
      : /challenge|difficult|problem|concurr|race|lock|issue/i.test(question) ? 'challenge'
      : /test|verify|reliab/i.test(question) ? 'testing'
      : /perform|scal|cache|index|slow|optimi/i.test(question) ? 'performance'
      : /database|schema|data model|table|postgres|sql/i.test(question) ? 'database'
      : /project|built|build|work|experience|purpose|responsib/i.test(question) ? 'project' : 'fallback';
    await page.evaluate(answer => window.nextAnswer = answer, answer);
  }
  await page.locator('#record').click();
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/mock-local-interview.json', JSON.stringify(results, null, 2));
  await page.screenshot({ path: 'test-results/mock-local-interview.png', fullPage: true });
  console.log('Mock interview finished; microphone stopped.');
} finally { clearInterval(progress); await browser.close(); }
