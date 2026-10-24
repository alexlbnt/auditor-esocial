import { defineConfig, devices } from '@playwright/test';

const PORTA = 3100;

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORTA}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // O build roda antes (CI e npm run test:e2e:completo); aqui só sobe o servidor.
    command: `npm run start -- -p ${PORTA}`,
    url: `http://localhost:${PORTA}/auditorias/nova`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
