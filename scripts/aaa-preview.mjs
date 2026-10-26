import { mkdir, writeFile } from 'node:fs/promises';

const folder = 'F:/AI_models/interview-meet/aaa';
const response = await fetch('http://127.0.0.1:8767/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Welcome to your interview. Tell me about a project you are proud of, and the biggest challenge you solved.' }),
});
if (!response.ok) throw new Error(`Speech worker returned ${response.status}; start npm run local first.`);
const result = await response.json();
if (!result.audio || !Array.isArray(result.visemes)) throw new Error('Invalid speech response');
await mkdir(folder, { recursive: true });
await writeFile(`${folder}/preview.wav`, Buffer.from(result.audio, 'base64'));
await writeFile(`${folder}/preview-timing.json`, JSON.stringify({ visemes: result.visemes }, null, 2));
console.log(`Saved synthetic preview audio and timing to ${folder}`);
