#!/usr/bin/env node
// Captures product screenshots from the seeded local demo into public/screenshots/.
// Usage: npm run screenshots                 builds + starts the app on :3302 against the local Supabase
//        npm run screenshots -- --no-build   reuse an app already running at NEXT_PUBLIC_APP_URL
// Prerequisites: `npx supabase start` and `npm run seed:demo` (see docs/SCREENSHOTS.md).
import { chromium } from 'playwright-core';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';

for (const file of ['.env.demo']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const status = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const vars = Object.fromEntries([...status.matchAll(/^([A-Z_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]));
    process.env.NEXT_PUBLIC_SUPABASE_URL = vars.API_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= vars.ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= vars.SERVICE_ROLE_KEY;
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3302').replace(/\/$/, '');
const PORT = new URL(APP_URL).port || '3302';
const OUT = 'public/screenshots';
const ADMIN = { email: 'demo@gatekeep.dev', password: 'gatekeep-demo' };
const SHARE = { code: 'aB3xY9', recipient: 'maya@northwind.example', password: 'northwind-preview' };
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const HIDE_SCROLLBARS = `
  html { scrollbar-width: none; }
  ::-webkit-scrollbar { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
  nextjs-portal { display: none !important; }`;

async function isUp() {
    try {
        return (await fetch(APP_URL, { redirect: 'manual' })).status < 500;
    } catch {
        return false;
    }
}

async function startApp() {
    if (await isUp()) return null;
    if (process.argv.includes('--no-build')) throw new Error(`Nothing is running at ${APP_URL}`);
    console.log('Building the app against the local demo Supabase…');
    execSync('npx next build', { stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
    const server = spawn('npx', ['next', 'start', '-p', PORT], { env: process.env, stdio: 'ignore', detached: true });
    for (let i = 0; i < 60 && !(await isUp()); i++) await new Promise((r) => setTimeout(r, 1000));
    if (!(await isUp())) throw new Error('App did not start');
    return server;
}

async function settle(page, ms = 600) {
    // Wait for skeletons/spinners to disappear, then let transitions finish
    await page.waitForFunction(() => !document.querySelector('[class*="skeleton" i], [class*="spinner" i], [aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(ms);
}

async function shot(page, name, options = {}) {
    if (only && !only.includes(name)) return;
    const path = `${OUT}/${name}.png`;
    await page.screenshot({ path, ...options });
    // Lossless only: palette quantization visibly bands the UI's gradients
    try {
        execSync(`optipng -quiet -o2 "${path}"`, { stdio: 'ignore' });
    } catch {
        // optipng not installed
    }
    console.log(`  ${path}  ${(statSync(path).size / 1024).toFixed(0)} KB`);
}

async function newContext(browser, { mobile = false } = {}) {
    const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: mobile ? 3 : 2,
        isMobile: mobile,
        hasTouch: mobile,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        // The app's CSP only allows https://*.supabase.co; the local demo Supabase is plain http
        bypassCSP: true,
    });
    await context.addInitScript((css) => {
        document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        });
    }, HIDE_SCROLLBARS);
    return context;
}

async function fillUnlockForm(page) {
    await page.goto(`${APP_URL}/${SHARE.code}`);
    await page.locator('input[type="email"], input[placeholder*="@"]').first().fill(SHARE.recipient);
    await page.locator('input[type="password"]').first().fill(SHARE.password);
}

// /api/verify allows 5 attempts a minute per IP; wait it out instead of failing on back-to-back runs
async function submitUnlock(page) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const [response] = await Promise.all([
            page.waitForResponse((r) => r.url().endsWith('/api/verify') && r.request().method() === 'POST' && r.request().postData()?.includes('password')),
            page.locator('button[type="submit"]').click(),
        ]);
        if (response.status() !== 429) return;
        console.log('  rate limited by /api/verify, waiting 61 s…');
        await page.waitForTimeout(61_000);
    }
    throw new Error('Could not unlock the demo share');
}

// After unlocking, the file is only fetched once the recipient asks for the preview
async function showPreview(page) {
    await page.getByRole('button', { name: /show preview/i }).click({ timeout: 20000 });
    await page.waitForFunction(() => [...document.images].some((img) => img.complete && img.naturalWidth > 600), null, { timeout: 20000 });
}

async function captureShare(browser) {
    const context = await newContext(browser);
    const page = await context.newPage();
    await fillUnlockForm(page);
    await settle(page, 300);
    await shot(page, 'share-unlock');

    await submitUnlock(page);
    await showPreview(page);
    await settle(page);
    await shot(page, 'share-preview');
    await context.close();

    const mobile = await newContext(browser, { mobile: true });
    const mpage = await mobile.newPage();
    await fillUnlockForm(mpage);
    await settle(mpage, 300);
    await shot(mpage, 'mobile-unlock');
    await submitUnlock(mpage);
    await showPreview(mpage);
    await settle(mpage);
    await shot(mpage, 'mobile-share');
    await mobile.close();
}

async function captureAdmin(browser) {
    const context = await newContext(browser);
    const page = await context.newPage();
    await page.goto(`${APP_URL}/login`);
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin/, { timeout: 20000 });

    // Overview: stats, recent files, shares
    await page.waitForLoadState('networkidle').catch(() => {});
    await settle(page, 1200);
    await shot(page, 'overview');
    await shot(page, 'overview-full', { fullPage: true });

    // Access manager for the hero image (most recent upload, listed first), scrolled to its recipients
    const row = page.locator('tr, [role="row"], li, div').filter({ hasText: 'hero-shot.png' }).filter({ has: page.locator('[title="Manage access"]') }).last();
    await row.locator('[title="Manage access"]').first().click();
    await page.getByText(SHARE.recipient).first().waitFor({ timeout: 15000 });
    await page.getByText('Current Access Grants').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await settle(page, 800);
    await shot(page, 'access');
    await page.keyboard.press('Escape');
    await page.reload();

    // Analytics page
    await page.goto(`${APP_URL}/admin/analytics`);
    await page.getByText('Most Accessed Files').waitFor({ timeout: 20000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await settle(page, 1500);
    await shot(page, 'analytics');

    // Files: folders + files at the root
    await page.goto(`${APP_URL}/admin/files`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await settle(page, 1000);
    await shot(page, 'dashboard');
    await context.close();
}

async function main() {
    mkdirSync(OUT, { recursive: true });
    const server = await startApp();
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
    try {
        console.log(`Capturing from ${APP_URL}`);
        await captureShare(browser);
        await captureAdmin(browser);
    } finally {
        await browser.close();
        if (server) process.kill(-server.pid);
    }
}

main().catch((err) => {
    console.error('Screenshots failed:', err.message ?? err);
    process.exit(1);
});
