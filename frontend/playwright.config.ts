import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:47318',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'pl-PL',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host localhost',
    url: 'http://localhost:47318',
    reuseExistingServer: !process.env.CI,
  },
})
