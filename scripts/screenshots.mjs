#!/usr/bin/env node
// Captures product screenshots from the seeded local demo into public/screenshots/.
// Usage: npm run screenshots                 builds + starts the app on :3302 against the local Supabase
//        npm run screenshots -- --no-build   reuse an app already running at NEXT_PUBLIC_APP_URL
//        npm run screenshots -- --only=overview,activity
// Prerequisites: `npx supabase start` and a fresh `npm run seed:demo` (see docs/SCREENSHOTS.md).
//
// Before capturing, the script adds a few v2 deliveries to the demo (through the same API the
// dashboard uses) and plays the recipients' side, so the receipts are real: codes requested,
// deliveries opened, files downloaded, one wrong code. The app must run with EMAIL_TRANSPORT=memory
// and E2E_TEST_SUPPORT=1 so the script can read the codes it sends.
import { chromium, request as playwrightRequest } from 'playwright-core';
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
// Codes are read back from the in-memory outbox (app/api/test-support/emails)
process.env.EMAIL_TRANSPORT ??= 'memory';
process.env.E2E_TEST_SUPPORT ??= '1';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3302').replace(/\/$/, '');
const PORT = new URL(APP_URL).port || '3302';
const OUT = 'public/screenshots';
const ADMIN = { email: 'demo@gatekeep.dev', password: 'gatekeep-demo' };
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
// Links in the shots show the address a real instance would have, not localhost
const SHOWN_URL = (process.env.SCREENSHOT_URL || 'https://files.northwind.example').replace(/\/$/, '');
const DAY = 24 * 3600 * 1000;

const HIDE_SCROLLBARS = `
  html { scrollbar-width: none; }
  ::-webkit-scrollbar { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
  nextjs-portal { display: none !important; }`;

const AGENTS = {
    mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

// The demo deliveries this script adds on top of the seed (and the people on them)
const BOARD_PACK = {
    title: 'Q3 board pack',
    files: ['Q3 board deck.pdf', 'pricing-model.xlsx', 'roadmap-2027.xlsx'],
    message: 'The board pack for Thursday. The pricing model is still a draft, so please keep it to the board.',
    people: [
        { identifier: 'ana.morales@northwind.example', method: 'email_code' },
        { identifier: 'li.wei@northwind.example', method: 'email_code' },
        { identifier: 'daniel.kim@harbor-capital.example', method: 'password' },
        { identifier: 'tomas.varga@northwind.example', method: 'email_code' },
    ],
    endsInDays: 14,
    downloadLimit: 5,
};
const BRAND_REFRESH = {
    title: 'Brand refresh — final assets',
    files: ['brand-guidelines-v4.pdf', 'logo-pack.zip', 'hero-shot.png'],
    message: 'Final files for the spring launch: the guidelines, the logo pack in every format and the hero shot.',
    people: [
        { identifier: 'jordan.lee@northwind.example', method: 'email_code' },
        { identifier: 'maya@northwind.example', method: 'email_code' },
    ],
    endsInDays: 30,
};
// Created through the dashboard for the New delivery and Sent shots
const SOW = {
    title: 'Signed SOW — Northwind',
    files: ['northwind-sow.docx'],
    message: 'The countersigned statement of work for the spring launch. Shout if anything looks off.',
    people: ['ops@northwind.example', 'northwind-legal'],
};

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
    await page
        .waitForFunction(() => !document.querySelector('[class*="skeleton" i], [class*="spinner" i], [aria-busy="true"], .animate-pulse'), null, {
            timeout: 20000,
        })
        .catch(() => {});
    await page.waitForTimeout(ms);
}

async function shot(page, name, options = {}) {
    if (only && !only.includes(name)) return;
    const path = `${OUT}/${name}.png`;
    await page.evaluate(
        ([from, to]) => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (node.nodeValue.includes(from)) node.nodeValue = node.nodeValue.replaceAll(from, to);
            }
            document.querySelectorAll('input, textarea').forEach((el) => {
                if (el.value.includes(from)) el.value = el.value.replaceAll(from, to);
            });
        },
        [APP_URL, SHOWN_URL],
    );
    await page.screenshot({ path, ...options });
    // Lossless only: palette quantization visibly bands the UI
    try {
        execSync(`optipng -quiet -o2 "${path}"`, { stdio: 'ignore' });
    } catch {
        // optipng not installed
    }
    console.log(`  ${path}  ${(statSync(path).size / 1024).toFixed(0)} KB`);
}

let ipCounter = 0;
/** Each simulated person gets an address of their own, the way separate visitors would. */
const nextIp = () => `${['203.0.113', '198.51.100', '192.0.2'][ipCounter % 3]}.${(++ipCounter * 37) % 240 + 10}`;

async function newContext(browser, { userAgent, viewport = { width: 1440, height: 900 } } = {}) {
    const ip = nextIp();
    const context = await browser.newContext({
        baseURL: APP_URL,
        viewport,
        deviceScaleFactor: 2,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        userAgent,
        // The app's CSP only allows https://*.supabase.co; the local demo Supabase is plain http
        bypassCSP: true,
    });
    await context.route(`${APP_URL}/api/**`, (route) => route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }));
    await context.addInitScript((css) => {
        document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        });
    }, HIDE_SCROLLBARS);
    return context;
}

async function ok(res, what) {
    if (!res.ok()) throw new Error(`${what} failed: ${res.status()} ${await res.text()}`);
    return res.json();
}

// ---------------------------------------------------------------- demo deliveries and receipts

/** The newest 6-digit code emailed to this address since `after` (codes are sent after the response). */
async function waitForCode(admin, to, after) {
    for (let i = 0; i < 80; i++) {
        const { emails } = await ok(await admin.get(`/api/test-support/emails?to=${encodeURIComponent(to)}`), 'Reading the outbox');
        const codes = emails.filter((e) => e.sentAt > after && /code/i.test(e.subject)).map((e) => e.text.match(/\b(\d{6})\b/)?.[1]).filter(Boolean);
        if (codes.length) return codes[codes.length - 1];
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`No code arrived for ${to}. Is the app running with EMAIL_TRANSPORT=memory and E2E_TEST_SUPPORT=1?`);
}

/** A recipient on their own device: their own cookies, IP and browser. */
async function recipient(userAgent) {
    return playwrightRequest.newContext({ baseURL: APP_URL, extraHTTPHeaders: { 'x-forwarded-for': nextIp(), 'user-agent': userAgent } });
}

async function signInWithCode(admin, code, email, userAgent, { wrongFirst = false } = {}) {
    const person = await recipient(userAgent);
    const since = new Date().toISOString();
    await ok(await person.post(`/api/d/${code}/code`, { data: { email } }), `Requesting a code for ${email}`);
    const otp = await waitForCode(admin, email, since);
    if (wrongFirst) {
        const wrong = String((Number(otp) + 271828) % 1000000).padStart(6, '0');
        await person.post(`/api/d/${code}/session`, { data: { email, code: wrong } });
    }
    await ok(await person.post(`/api/d/${code}/session`, { data: { email, code: otp } }), `Signing in as ${email}`);
    return person;
}

async function fileAction(person, code, fileId, action) {
    await ok(await person.post(`/api/d/${code}/files/${fileId}`, { data: { action } }), `${action} ${fileId}`);
}

async function createDelivery(api, spec, fileIds) {
    const endsAt = spec.endsInDays ? new Date(Date.now() + spec.endsInDays * DAY).toISOString() : undefined;
    const body = {
        title: spec.title,
        message: spec.message,
        fileIds: spec.files.map((name) => fileIds[name]),
        people: spec.people.map((p) => ({ ...p, endsAt, downloadLimit: spec.downloadLimit })),
        sendInvites: true,
    };
    const { delivery, recipients } = await ok(await api.post('/api/deliveries', { data: body }), `Creating "${spec.title}"`);
    return { ...delivery, recipients };
}

async function prepareDemo(page) {
    const api = page.request;
    const { files } = await ok(await api.get('/api/files?all=true&limit=100'), 'Listing files');
    const fileIds = Object.fromEntries(files.map((f) => [f.name, f.id]));
    for (const name of [...BOARD_PACK.files, ...BRAND_REFRESH.files, ...SOW.files]) {
        if (!fileIds[name]) throw new Error(`The demo file ${name} is missing. Run npm run seed:demo first.`);
    }

    const { deliveries } = await ok(await api.get(`/api/deliveries?q=${encodeURIComponent(BOARD_PACK.title)}`), 'Listing deliveries');
    const existing = deliveries.find((d) => d.title === BOARD_PACK.title);
    if (existing) {
        console.log('  The demo deliveries already exist (run npm run seed:demo for a clean set); reusing them.');
        const { deliveries: all } = await ok(await api.get('/api/deliveries?limit=100'), 'Listing deliveries');
        const find = (title) => all.find((d) => d.title === title);
        return { fileIds, board: find(BOARD_PACK.title), brand: find(BRAND_REFRESH.title), created: false };
    }

    // A logo for "Northwind Studio": a monochrome compass mark, rendered here so the demo needs no binary asset
    const logo = await page.context().newPage();
    await logo.setViewportSize({ width: 256, height: 256 });
    await logo.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
      <svg width="256" height="256" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e5e5" stroke-width="5"/>
        <path d="M50 18 L58 50 L50 82 L42 50 Z" fill="#e5e5e5" transform="rotate(40 50 50)"/>
        <circle cx="50" cy="50" r="4.5" fill="#1a1a1a"/>
      </svg></body></html>`);
    const logoPng = await logo.screenshot({ omitBackground: true, type: 'png' });
    await logo.close();
    await ok(
        await api.post('/api/settings/logo', { multipart: { file: { name: 'northwind.png', mimeType: 'image/png', buffer: logoPng } } }),
        'Uploading the demo logo',
    );

    const board = await createDelivery(api, BOARD_PACK, fileIds);
    const brand = await createDelivery(api, BRAND_REFRESH, fileIds);
    console.log(`  Created "${board.title}" (/${board.shortCode}) and "${brand.title}" (/${brand.shortCode})`);

    return { fileIds, board, brand, created: true };
}

/**
 * Receipts: what each person did with their invite. Runs after the dashboard-created delivery, so
 * the newest activity is people opening and downloading rather than you giving access.
 */
async function playRecipients(api, { fileIds, board, brand }) {
    const ana = await signInWithCode(api, board.shortCode, 'ana.morales@northwind.example', AGENTS.mac);
    await fileAction(ana, board.shortCode, fileIds['Q3 board deck.pdf'], 'preview');
    await fileAction(ana, board.shortCode, fileIds['Q3 board deck.pdf'], 'download');
    await fileAction(ana, board.shortCode, fileIds['pricing-model.xlsx'], 'download');
    await ana.dispose();

    // A password recipient who mistypes it once
    const daniel = await recipient(AGENTS.iphone);
    const danielPassword = board.recipients.find((r) => r.identifier === 'daniel.kim@harbor-capital.example')?.password;
    await daniel.post(`/api/d/${board.shortCode}/session`, { data: { identifier: 'daniel.kim@harbor-capital.example', password: 'harbor-2025' } });
    await ok(
        await daniel.post(`/api/d/${board.shortCode}/session`, { data: { identifier: 'daniel.kim@harbor-capital.example', password: danielPassword } }),
        'Signing in with a password',
    );
    await fileAction(daniel, board.shortCode, fileIds['Q3 board deck.pdf'], 'preview');
    await fileAction(daniel, board.shortCode, fileIds['Q3 board deck.pdf'], 'download');
    await daniel.dispose();

    const maya = await signInWithCode(api, brand.shortCode, 'maya@northwind.example', AGENTS.mac);
    await ok(await maya.post(`/api/d/${brand.shortCode}/download-all`, { data: {} }), 'Download all');
    await maya.dispose();

    // An old code typed first, then the right one
    const li = await signInWithCode(api, board.shortCode, 'li.wei@northwind.example', AGENTS.windows, { wrongFirst: true });
    await ok(await li.post(`/api/d/${board.shortCode}/download-all`, { data: {} }), 'Download all');
    await li.dispose();
}


// ---------------------------------------------------------------- captures

async function signInAsOwner(page) {
    await page.goto(`${APP_URL}/login`);
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin/, { timeout: 60000 });
}

async function open(page, path, ready) {
    await page.goto(`${APP_URL}${path}`, { timeout: 90000 });
    if (ready) await ready.waitFor({ timeout: 30000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await settle(page, 1000);
}

/** The composer, filled in, then the Sent panel after sending it (creates the "Signed SOW" delivery). */
async function captureComposer(page, fileIds) {
    const ids = SOW.files.map((name) => fileIds[name]).join(',');
    await open(page, `/admin/deliveries/new?files=${ids}`, page.getByRole('list', { name: 'Files in this delivery' }));
    await page.getByLabel('Title').fill(SOW.title);
    await page.getByLabel('Message').fill(SOW.message);
    await page.getByLabel('Add people').fill(SOW.people.join(', '));
    await page.getByLabel('Add people').press('Enter');
    await page.getByRole('radiogroup', { name: `Access method for ${SOW.people[SOW.people.length - 1]}` }).waitFor();
    await page.getByRole('radio', { name: '30 days', exact: true }).click();
    await page.getByLabel('Download limit').fill('3');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await settle(page, 600);
    await shot(page, 'new-delivery');

    await page.getByRole('button', { name: /^Send to \d+ (person|people)$/ }).click();
    const sent = page.getByTestId('sent-panel');
    await sent.getByRole('heading', { name: /^Delivery sent to/ }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(4500); // let the "Delivery sent" toast go
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 600);
    await shot(page, 'sent');
}

async function captureOwner(browser, demo) {
    const context = await newContext(browser);
    const page = await context.newPage();
    await signInAsOwner(page);

    await open(page, '/admin', page.getByRole('heading', { name: 'Recent files' }));
    await shot(page, 'overview');

    await open(page, '/admin/files', page.getByText('Q3 board deck.pdf').first());
    await shot(page, 'files');

    // Shorter window: the page ends below the recipients table
    await page.setViewportSize({ width: 1440, height: 820 });
    await open(page, `/admin/deliveries/${demo.board.id}`, page.getByRole('table', { name: 'Recipients' }));
    await shot(page, 'delivery');
    await page.setViewportSize({ width: 1440, height: 900 });

    await open(page, '/admin/activity', page.locator('[data-testid="activity-row"]').first());
    await shot(page, 'activity');

    await open(page, '/admin/settings/branding', page.getByRole('heading', { name: 'Message to recipients' }));
    await shot(page, 'settings');
    await context.close();
}

/**
 * Jordan opens the brand refresh delivery with an email code. Recipient pages are a narrow card,
 * so they're captured in a smaller window to stay readable when the image is scaled down.
 */
async function captureRecipient(browser, demo, admin) {
    const email = 'jordan.lee@northwind.example';
    const context = await newContext(browser, { userAgent: AGENTS.mac, viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    await open(page, `/${demo.brand.shortCode}`, page.getByLabel('Email'));
    await page.getByLabel('Email').fill(email);
    const since = new Date().toISOString();
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByLabel('Code').waitFor({ timeout: 20000 });
    const code = await waitForCode(admin, email, since);
    // The code step, waiting for the code (six digits submit on their own)
    await page.getByLabel('Code').focus();
    await settle(page, 500);
    await shot(page, 'recipient-sign-in');

    await page.getByLabel('Code').fill(code);
    await page.getByRole('heading', { level: 1, name: demo.brand.title }).waitFor({ timeout: 30000 });
    await page.getByRole('list', { name: 'Files' }).waitFor();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await settle(page, 1200);
    await shot(page, 'recipient-delivery');
    await context.close();
}

async function main() {
    mkdirSync(OUT, { recursive: true });
    const server = await startApp();
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
    try {
        console.log(`Capturing from ${APP_URL}`);
        const owner = await newContext(browser);
        const page = await owner.newPage();
        await signInAsOwner(page);
        const demo = await prepareDemo(page);

        await captureComposer(page, demo.fileIds);
        if (demo.created) await playRecipients(page.request, demo);
        await captureRecipient(browser, demo, page.request);
        await owner.close();
        await captureOwner(browser, demo);
    } finally {
        await browser.close();
        if (server) process.kill(-server.pid);
    }
}

main().catch((err) => {
    console.error('Screenshots failed:', err.message ?? err);
    process.exit(1);
});
