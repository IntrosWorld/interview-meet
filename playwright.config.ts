import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:8017', channel: 'chrome' },
  webServer: { command: 'npx tsx server.ts', url: 'http://localhost:8017', env: { PORT: '8017', FIREBASE_WEB_API_KEY: '', FIREBASE_PROJECT_ID: '', DATABASE_URL: '' }, reuseExistingServer: false },
});
