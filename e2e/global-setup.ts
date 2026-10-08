import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { localSupabaseEnv } from './supabase-env';

/** Reseed the local demo data before every run so tests start from a known state. */
export default function globalSetup() {
    // The seed script renders its demo images with Chromium: use the system one locally,
    // or the browser installed by `npx playwright install chromium` in CI.
    const chromiumPath =
        process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath());

    execFileSync('node', ['scripts/seed-demo.mjs'], {
        stdio: 'inherit',
        env: {
            ...process.env,
            ...localSupabaseEnv(),
            CHROMIUM_PATH: chromiumPath,
            NEXT_PUBLIC_APP_URL: 'http://localhost:3304',
        },
    });
}
