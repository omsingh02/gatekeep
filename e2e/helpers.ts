import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
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
 * Recipient sign-in (/api/d/{code}/session) is rate-limited and throttled per IP, so each
 * simulated person gets an address of their own, the way separate visitors would in production. Only
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

/** The recipient sign-in heading: "Avery Stone sent you files" (or "asked you for files" for a request). */
export const SIGN_IN_HEADING = /(sent|asked) you( for)? files$/;

/**
 * Sign in on a delivery page with a password: as a named person (email or username), or with
 * `identifier: null` as "anyone with the password".
 */
export async function unlock(page: Page, identifier: string | null, password: string) {
    await expect(page.getByRole('heading', { level: 1, name: SIGN_IN_HEADING })).toBeVisible();
    // Deliveries that also accept email codes start on the email step
    const passwordWay = page.getByRole('button', { name: 'I have a password' });
    if (await passwordWay.isVisible()) await passwordWay.click();
    if (identifier !== null) await page.getByLabel('Email or username').fill(identifier);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Unlock delivery' }).click();
}

/** Emails captured by the app's memory transport (EMAIL_TRANSPORT=memory). */
export async function outbox(api: APIRequestContext, to: string) {
    const res = await api.get(`/api/test-support/emails?to=${encodeURIComponent(to)}`);
    expect(res.ok()).toBeTruthy();
    return (await res.json()).emails as { subject: string; text: string; from: string }[];
}

/** Wait for an email matching the subject (codes are sent after the response, so poll). */
export async function waitForEmail(api: APIRequestContext, to: string, subject: RegExp, after = 0) {
    for (let i = 0; i < 40; i++) {
        const emails = (await outbox(api, to)).slice(after).filter((e) => subject.test(e.subject));
        if (emails.length) return emails[emails.length - 1];
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`No email to ${to} matching ${subject}`);
}
