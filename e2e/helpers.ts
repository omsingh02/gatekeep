import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Credentials and share created by `scripts/seed-demo.mjs`. */
export const DEMO = {
    admin: { email: 'demo@gatekeep.dev', password: 'gatekeep-demo' },
    share: { code: 'aB3xY9', recipient: 'maya@northwind.example', password: 'northwind-preview' },
};

/** Unique per run so repeated runs never collide with earlier data. */
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let ipCounter = 0;

/**
 * A fresh browser context whose app API calls carry their own client IP.
 * /api/verify rate-limits per IP (5/min), so each simulated person gets an
 * address of their own, the way separate visitors would in production. Only
 * same-origin /api/* requests are rewritten; calls to Supabase are untouched.
 */
export async function newVisitor(browser: Browser, baseURL: string): Promise<BrowserContext> {
    const ip = `10.${(Date.now() >> 8) & 255}.${++ipCounter}.${Math.floor(Math.random() * 250) + 1}`;
    const context = await browser.newContext({ baseURL, bypassCSP: true });
    await context.route(`${baseURL}/api/**`, (route) =>
        route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }),
    );
    return context;
}

export async function signInAsAdmin(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO.admin.email);
    await page.getByLabel('Password').fill(DEMO.admin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/admin');
}

/** Fill and submit the recipient unlock form on a share page. */
export async function unlock(page: Page, identifier: string | null, password: string) {
    await expect(page.getByRole('heading', { name: 'This file is protected' })).toBeVisible();
    if (identifier === null) {
        await page.getByRole('tab', { name: 'Public link' }).click();
    } else {
        await page.getByLabel('Email or username').fill(identifier);
    }
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Unlock file' }).click();
}
