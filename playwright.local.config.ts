import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/local',
  use: { baseURL: 'http://127.0.0.1:8011', channel: 'chrome' },
  webServer: [
    { command: 'node tests/local/ollama-fixture.mjs', url: 'http://127.0.0.1:11435/api/tags' },
    { command: 'npx tsx src/local-server.ts', url: 'http://127.0.0.1:8011', env: { LOCAL_PORT: '8011', OLLAMA_URL: 'http://127.0.0.1:11435', LOCAL_SPEECH_URL: 'http://127.0.0.1:18766' } },
  ],
});
