import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { localSupabaseEnv } from './e2e/supabase-env';

// End-to-end tests run the real app against a local Supabase (`npx supabase start`).
// See CONTRIBUTING.md → "End-to-end tests".
const PORT = 3304;
const baseURL = `http://localhost:${PORT}`;
const supabase = localSupabaseEnv();

// Locally, prefer the system Chromium; CI uses the browser from `npx playwright install chromium`
const systemChromium = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

export default defineConfig({
    testDir: 'e2e',
    globalSetup: './e2e/global-setup.ts',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL,
        // The local Supabase is plain http, which the production CSP (https://*.supabase.co) doesn't allow
        bypassCSP: true,
        trace: 'retain-on-failure',
        launchOptions: systemChromium && !process.env.CI ? { executablePath: systemChromium } : {},
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `npx next build && npx next start -p ${PORT}`,
        url: `${baseURL}/api/health`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        env: {
            ...supabase,
            NEXT_PUBLIC_APP_URL: baseURL,
            CRON_SECRET: 'e2e-cron-secret',
            // Keep emails in memory and expose them to the tests (app/api/test-support/emails)
            EMAIL_TRANSPORT: 'memory',
            E2E_TEST_SUPPORT: '1',
            NEXT_TELEMETRY_DISABLED: '1',
        },
    },
});
