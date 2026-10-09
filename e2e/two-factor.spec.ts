import { spawnSync } from 'node:child_process';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RUN_ID, newVisitor, outbox } from './helpers';
import { localSupabaseEnv } from './supabase-env';
import { totp, wrongTotp } from './totp';

/**
 * Two-factor sign-in, end to end, with a dedicated owner account (the demo admin and the other specs
 * never have it on). Codes are generated here the way an authenticator app does (e2e/totp.ts).
 */
test.describe.configure({ mode: 'serial' });

const env = localSupabaseEnv();
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = () =>
    createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

const account = { email: `two-factor-${RUN_ID}@example.test`, password: `Two-factor-${RUN_ID}-pass` };
const WRONG_CODE = "That code doesn't match. Enter the code your authenticator app shows now.";
const OWNER_APIS = ['/api/deliveries', '/api/files', '/api/activity', '/api/settings', '/api/status'];

let userId = '';
let folderId = '';
let secret = '';
let totpAvailable = true;

const storagePath = () => `${userId}/two-factor-probe.txt`;

test.beforeAll(async () => {
    const { data, error } = await service.auth.admin.createUser({ ...account, email_confirm: true, app_metadata: { role: 'owner' } });
    expect(error).toBeNull();
    userId = data.user!.id;

    // Something of this account's in a table and in Storage, so "can't see it" means refused, not empty
    const { data: folder, error: folderError } = await service.from('folders').insert({ name: `Two-factor ${RUN_ID}`, uploaded_by: userId }).select('id').single();
    expect(folderError).toBeNull();
    folderId = folder!.id;
    const { error: uploadError } = await service.storage.from('files').upload(storagePath(), 'two-factor probe', { contentType: 'text/plain' });
    expect(uploadError).toBeNull();

    // Supabase Auth only offers authenticator apps when supabase/config.toml turns them on, which a local
    // stack started before that change doesn't have yet. CI always starts from the current config.
    const probe = anonClient();
    await probe.auth.signInWithPassword(account);
    const { data: enrolled, error: enrollError } = await probe.auth.mfa.enroll({ factorType: 'totp' });
    if (enrollError?.code === 'mfa_totp_enroll_not_enabled') {
        if (process.env.CI) throw new Error('Authenticator apps (TOTP) are off in this Supabase: check [auth.mfa.totp] in supabase/config.toml');
        totpAvailable = false;
    } else {
        expect(enrollError).toBeNull();
        await probe.auth.mfa.unenroll({ factorId: enrolled!.id });
    }
});

test.afterAll(async () => {
    if (!userId) return;
    await service.storage.from('files').remove([storagePath()]);
    await service.from('folders').delete().eq('uploaded_by', userId);
    await service.from('owner_settings').delete().eq('owner_id', userId);
    await service.auth.admin.deleteUser(userId);
});

test.beforeEach(() => {
    test.skip(!totpAvailable, 'Local Supabase has authenticator apps off: restart it (npx supabase stop && npx supabase start) to apply supabase/config.toml');
});

async function signInWithPassword(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
}

async function expectCodeStep(page: Page) {
    await expect(page.getByRole('heading', { name: 'Two-factor sign-in' })).toBeVisible();
    await expect(page.getByText('Enter the 6-digit code from your authenticator app.')).toBeVisible();
}

async function enterCode(scope: Page | Locator, label: string | RegExp, code: string, button: string) {
    await scope.getByLabel(label).fill(code);
    await scope.getByRole('button', { name: button }).click();
}

async function factorsOf(id: string) {
    const { data, error } = await service.auth.admin.mfa.listFactors({ userId: id });
    expect(error).toBeNull();
    return data!.factors;
}

async function twoFactorCheck(page: Page) {
    const status = await (await page.request.get('/api/status')).json();
    return status.checks.find((c: { id: string }) => c.id === 'twoFactor') as { ok: boolean; label: string };
}

test('turning it on in Settings → Account', async ({ browser, baseURL }) => {
    const context = await newVisitor(browser, baseURL!);
    const page = await context.newPage();
    try {
        // Without two-factor sign-in, the password is enough
        await signInWithPassword(page);
        await page.waitForURL('**/admin');
        expect(await twoFactorCheck(page)).toMatchObject({ ok: false, label: 'Two-factor sign-in is off' });

        await page.goto('/admin/settings/account');
        const section = page.locator('#two-factor');
        await expect(section.getByText('Off', { exact: true })).toBeVisible();

        // A setup abandoned half-way (cancelled, or the page left) never blocks the next one
        await section.getByRole('button', { name: 'Set up two-factor sign-in' }).click();
        await expect(section.getByRole('img', { name: 'QR code that adds Gatekeep to your authenticator app' })).toBeVisible();
        await section.getByRole('button', { name: 'Cancel' }).click();
        await expect.poll(async () => (await factorsOf(userId)).length).toBe(0);
        await section.getByRole('button', { name: 'Set up two-factor sign-in' }).click();
        await expect(section.getByLabel('Setup key')).not.toBeEmpty();
        await page.reload();
        await section.getByRole('button', { name: 'Set up two-factor sign-in' }).click();

        // The QR code, and the setup key for people who can't scan it
        await expect(section.getByRole('img', { name: 'QR code that adds Gatekeep to your authenticator app' })).toHaveAttribute('src', /^data:image\/svg\+xml/);
        await expect(section.getByText(/Whoever manages this Gatekeep's server can turn two-factor sign-in off/)).toContainText('npm run reset-two-factor');
        secret = (await section.getByLabel('Setup key').innerText()).trim();
        expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
        const pending = await factorsOf(userId);
        expect(pending.map((f) => f.status)).toEqual(['unverified']);

        // It only counts as on once a code from the app checks out
        await enterCode(section, '6-digit code', wrongTotp(secret), 'Turn on two-factor sign-in');
        await expect(section.getByText(WRONG_CODE)).toBeVisible();
        expect((await factorsOf(userId)).map((f) => f.status)).toEqual(['unverified']);

        await enterCode(section, '6-digit code', totp(secret), 'Turn on two-factor sign-in');
        await expect(section.getByText('On', { exact: true })).toBeVisible();
        expect((await factorsOf(userId)).map((f) => f.status)).toEqual(['verified']);
        expect(await twoFactorCheck(page)).toMatchObject({ ok: true, label: 'Two-factor sign-in is on' });

        // Changing the password now takes a code too, and this browser stays fully signed in
        const next = `${account.password}-2`;
        await page.getByLabel('Current password').fill(account.password);
        await page.getByLabel('New password', { exact: true }).fill(next);
        await page.getByLabel('Confirm new password').fill(next);
        await enterCode(page, 'Code from your authenticator app', wrongTotp(secret), 'Change password');
        await expect(page.getByText(WRONG_CODE)).toBeVisible();
        await enterCode(page, 'Code from your authenticator app', totp(secret), 'Change password');
        await expect(page.getByText('Password changed. Other browsers and devices are signed out.')).toBeVisible();
        account.password = next;
        expect((await page.request.get('/api/deliveries')).status()).toBe(200);
        await page.goto('/admin/settings/account');
        await expect(page).toHaveURL(/\/admin\/settings\/account$/);
    } finally {
        await context.close();
    }
});

test('signing in asks for the code, and nothing works with the password alone', async ({ browser, baseURL }) => {
    const context = await newVisitor(browser, baseURL!);
    const page = await context.newPage();
    try {
        await signInWithPassword(page);
        await expectCodeStep(page);

        // The password-only session: the dashboard sends it back to the code step…
        for (const path of ['/admin', '/admin/settings/account']) {
            await page.goto(path);
            await expect(page).toHaveURL(/\/login\?step=code$/);
            await expectCodeStep(page);
        }
        // …and every owner API refuses it
        for (const path of OWNER_APIS) {
            const res = await page.request.get(path);
            expect(res.status(), path).toBe(403);
            expect(await res.json(), path).toEqual({
                error: 'Enter the code from your authenticator app to finish signing in.',
                code: 'ERR_TWO_FACTOR_REQUIRED',
            });
        }

        // A wrong code is refused
        await enterCode(page, 'Code', wrongTotp(secret), 'Sign in');
        await expect(page.getByText(WRONG_CODE)).toBeVisible();

        // The right one signs in, and everything works
        await enterCode(page, 'Code', totp(secret), 'Sign in');
        await page.waitForURL('**/admin');
        for (const path of OWNER_APIS) expect((await page.request.get(path)).status(), path).toBe(200);
        await page.goto('/login');
        await page.waitForURL('**/admin');
    } finally {
        await context.close();
    }
});

test('the database API refuses a password-only session too (public anon key + supabase-js)', async () => {
    const direct: SupabaseClient = anonClient();
    const { data: signedIn, error } = await direct.auth.signInWithPassword(account);
    expect(error).toBeNull();
    expect(JSON.parse(Buffer.from(signedIn.session!.access_token.split('.')[1], 'base64url').toString()).aal).toBe('aal1');

    // Tables: the account's rows are hidden and nothing can be written
    const { data: folders } = await direct.from('folders').select('id').eq('id', folderId);
    expect(folders).toEqual([]);
    for (const table of ['files', 'folders', 'deliveries', 'delivery_files', 'delivery_recipients', 'activity', 'owner_settings']) {
        const { data } = await direct.from(table).select('*').limit(1);
        expect(data ?? [], table).toEqual([]);
    }
    const { error: insertError } = await direct.from('folders').insert({ name: 'Should not exist', uploaded_by: userId });
    expect(insertError, 'insert with the password alone').not.toBeNull();
    const { data: renamed } = await direct.from('folders').update({ name: 'Renamed' }).eq('id', folderId).select('id');
    expect(renamed ?? []).toEqual([]);
    const { error: settingsError } = await direct.from('owner_settings').upsert({ owner_id: userId, display_name: 'Mallory' });
    expect(settingsError, 'owner_settings with the password alone').not.toBeNull();

    // Storage: the account's file can't be read, listed or replaced, and nothing can be added
    const { error: downloadError } = await direct.storage.from('files').download(storagePath());
    expect(downloadError).not.toBeNull();
    const { data: listed } = await direct.storage.from('files').list(userId);
    expect(listed ?? []).toEqual([]);
    for (const bucket of ['files', 'branding']) {
        const { error: uploadError } = await direct.storage.from(bucket).upload(`${userId}/added-${RUN_ID}.png`, Buffer.from('x'), { contentType: 'image/png' });
        expect(uploadError, `upload to ${bucket}`).not.toBeNull();
    }

    // With the code, the same session reads its rows again
    const { data: factors } = await direct.auth.mfa.listFactors();
    const { error: verifyError } = await direct.auth.mfa.challengeAndVerify({ factorId: factors!.totp[0].id, code: totp(secret) });
    expect(verifyError).toBeNull();
    const { data: visible } = await direct.from('folders').select('id').eq('id', folderId);
    expect(visible).toEqual([{ id: folderId }]);
    const { data: added, error: addError } = await direct.from('folders').insert({ name: `Added ${RUN_ID}`, uploaded_by: userId }).select('id').single();
    expect(addError).toBeNull();
    await service.from('folders').delete().eq('id', added!.id);

    // Nothing changed while it was refused
    const { data: folder } = await service.from('folders').select('name').eq('id', folderId).single();
    expect(folder!.name).toBe(`Two-factor ${RUN_ID}`);
    const { data: settings } = await service.from('owner_settings').select('display_name').eq('owner_id', userId).maybeSingle();
    expect(settings?.display_name ?? null).not.toBe('Mallory');
});

test('"Use a different account" signs out from the code step', async ({ browser, baseURL }) => {
    const context = await newVisitor(browser, baseURL!);
    const page = await context.newPage();
    try {
        await signInWithPassword(page);
        await expectCodeStep(page);
        await page.getByRole('button', { name: 'Use a different account' }).click();
        await expect(page.getByRole('heading', { name: 'Sign in to Gatekeep' })).toBeVisible();
        await page.goto('/admin');
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole('heading', { name: 'Sign in to Gatekeep' })).toBeVisible();
    } finally {
        await context.close();
    }
});

test('a password reset link also ends at the code step', async ({ browser, baseURL, request }) => {
    const before = (await outbox(request, account.email)).length;
    const sent = await request.post('/api/account/forgot-password', {
        headers: { 'x-forwarded-for': `10.253.${Math.floor(Math.random() * 250)}.1` },
        data: { email: account.email },
    });
    expect(sent.ok()).toBeTruthy();
    let link: string | undefined;
    for (let i = 0; i < 40 && !link; i++) {
        link = (await outbox(request, account.email))
            .slice(before)
            .map((e) => e.text.match(/https?:\/\/\S+\/reset-password\?\S+/)?.[0])
            .find(Boolean);
        if (!link) await new Promise((r) => setTimeout(r, 250));
    }
    expect(link, 'reset email').toBeTruthy();

    const context = await newVisitor(browser, baseURL!);
    const page = await context.newPage();
    try {
        await page.goto(link!.replace(/[).,]+$/, ''));
        await expect(page.getByRole('heading', { name: 'Two-factor sign-in' })).toBeVisible();
        await expect(page.getByText('then choose a new password')).toBeVisible();
        // The link alone doesn't open the dashboard
        expect((await page.request.get('/api/deliveries')).status()).toBe(403);

        await enterCode(page, 'Code', wrongTotp(secret), 'Continue');
        await expect(page.getByText(WRONG_CODE)).toBeVisible();
        await enterCode(page, 'Code', totp(secret), 'Continue');

        const next = `${account.password}-reset`;
        await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
        await page.getByLabel('New password', { exact: true }).fill(next);
        await page.getByLabel('Confirm new password').fill(next);
        await page.getByRole('button', { name: 'Set new password' }).click();
        await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
        account.password = next;
        await page.getByRole('button', { name: 'Go to the dashboard' }).click();
        await page.waitForURL('**/admin');
    } finally {
        await context.close();
    }
});

test('turning it off takes a fresh code', async ({ browser, baseURL }) => {
    const context = await newVisitor(browser, baseURL!);
    const page = await context.newPage();
    try {
        await signInWithPassword(page);
        await enterCode(page, 'Code', totp(secret), 'Sign in');
        await page.waitForURL('**/admin');

        await page.goto('/admin/settings/account');
        const section = page.locator('#two-factor');
        await expect(section.getByText('On', { exact: true })).toBeVisible();
        await section.getByRole('button', { name: 'Turn off two-factor sign-in' }).click();
        const dialog = page.getByRole('dialog', { name: 'Turn off two-factor sign-in?' });
        await enterCode(dialog, 'Code', wrongTotp(secret), 'Turn off two-factor sign-in');
        await expect(dialog.getByText(WRONG_CODE)).toBeVisible();
        expect((await factorsOf(userId)).map((f) => f.status)).toEqual(['verified']);

        await enterCode(dialog, 'Code', totp(secret), 'Turn off two-factor sign-in');
        await expect(dialog).toBeHidden();
        await expect(section.getByText('Off', { exact: true })).toBeVisible();
        expect(await factorsOf(userId)).toEqual([]);
    } finally {
        await context.close();
    }

    // The password alone signs in again
    const fresh = await newVisitor(browser, baseURL!);
    const again = await fresh.newPage();
    try {
        await signInWithPassword(again);
        await again.waitForURL('**/admin');
        expect((await again.request.get('/api/deliveries')).status()).toBe(200);
    } finally {
        await fresh.close();
    }
});

test('npm run reset-two-factor removes the authenticator app after confirming', async () => {
    // Turn it on again, the way the settings page does
    const client = anonClient();
    await client.auth.signInWithPassword(account);
    const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({ factorType: 'totp' });
    expect(enrollError).toBeNull();
    const { error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId: enrolled!.id, code: totp(enrolled!.totp.secret) });
    expect(verifyError).toBeNull();
    expect((await factorsOf(userId)).map((f) => f.status)).toEqual(['verified']);

    const run = (input: string) =>
        spawnSync('node', ['scripts/reset-two-factor.mjs'], { input, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 30_000 });

    // Anything but "yes" changes nothing
    const declined = run(`${account.email}\nno\n`);
    expect(declined.status, declined.stderr).toBe(1);
    expect(declined.stderr).toContain('Nothing changed.');
    expect(await factorsOf(userId)).toHaveLength(1);

    const confirmed = run(`${account.email}\nyes\n`);
    expect(confirmed.status, confirmed.stderr).toBe(0);
    expect(confirmed.stdout).toContain(`Two-factor sign-in is off for ${account.email}.`);
    expect(await factorsOf(userId)).toEqual([]);

    // Run again: already off
    const again = run(`${account.email}\n`);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('already off');
});
