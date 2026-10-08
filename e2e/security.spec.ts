import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { DEMO, RUN_ID, newVisitor, signInAsAdmin, unlock } from './helpers';
import { localSupabaseEnv } from './supabase-env';

const CREDENTIALS_ERROR = "That email, username or password doesn't match. Check what you were sent and try again.";

let ipCounter = 0;
/** Each API caller gets its own client IP, like separate people would. */
const ip = () => ({ 'x-forwarded-for': `10.250.${++ipCounter}.${Math.floor(Math.random() * 250) + 1}` });

async function firstFileId(request: APIRequestContext): Promise<string> {
    const res = await request.get('/api/files?limit=50');
    expect(res.ok()).toBeTruthy();
    const { files } = await res.json();
    expect(files.length).toBeGreaterThan(0);
    return files[0].id;
}

test('a signed-in account that is not the owner cannot use the dashboard or APIs', async ({ browser, baseURL }) => {
    const env = localSupabaseEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const stranger = { email: `stranger-${RUN_ID}@example.test`, password: `stranger-${RUN_ID}` };
    const { data, error } = await admin.auth.admin.createUser({ ...stranger, email_confirm: true });
    expect(error).toBeNull();

    const context = await newVisitor(browser, baseURL!);
    const page = await context.newPage();
    try {
        await page.goto('/login');
        await page.getByLabel('Email').fill(stranger.email);
        await page.getByLabel('Password').fill(stranger.password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        await page.waitForURL('**/login?reason=not-owner');
        await expect(page.getByText("That account isn't the owner of this Gatekeep.")).toBeVisible();

        const api = await page.request.get('/api/files');
        expect(api.status()).toBe(403);
        await page.goto('/admin');
        await page.waitForURL('**/login?reason=not-owner');
    } finally {
        await context.close();
        await admin.auth.admin.deleteUser(data.user!.id);
    }
});

test('unknown recipients and wrong passwords get the same answer', async ({ browser, baseURL }) => {
    const messages: string[] = [];
    for (const [identifier, password] of [
        [`nobody-${RUN_ID}@example.test`, 'whatever-123'],
        [DEMO.share.recipient, 'definitely-wrong'],
    ]) {
        const context = await newVisitor(browser, baseURL!);
        const page = await context.newPage();
        await page.goto(`/${DEMO.share.code}`);
        await unlock(page, identifier, password);
        // Next.js also renders an empty route announcer with role="alert"; take the one with text
        const alert = page.getByRole('alert').filter({ hasText: /\S/ });
        await expect(alert).toBeVisible();
        messages.push((await alert.innerText()).trim());
        await context.close();
    }
    expect(messages[0]).toBe(CREDENTIALS_ERROR);
    expect(messages[1]).toBe(messages[0]);
});

test('previews do not use up downloads, and recipients are case-insensitive', async ({ page, browser, baseURL }) => {
    await signInAsAdmin(page);
    const fileId = await firstFileId(page.request);
    const recipient = `Case-${RUN_ID}@Example.COM`;
    const password = `limit-${RUN_ID}`;

    const grant = await page.request.post('/api/access', {
        data: { fileId, userIdentifier: recipient, identifierType: 'email', password, maxDownloads: 1 },
    });
    expect(grant.ok()).toBeTruthy();
    const { access } = await grant.json();
    expect(access.userIdentifier).toBe(recipient.toLowerCase());

    const files = await page.request.get(`/api/files/${fileId}`);
    const shortCode = (await files.json()).file.short_code as string;

    const visitor = await newVisitor(browser, baseURL!);
    const api = visitor.request;
    try {
        // Typed in a different case than it was granted
        const verify = await api.post('/api/verify', {
            headers: ip(),
            data: { shortCode, userIdentifier: recipient.toLowerCase(), password },
        });
        expect(verify.ok()).toBeTruthy();
        expect(await verify.json()).not.toHaveProperty('fileUrl');

        const body = { shortCode, userIdentifier: recipient.toLowerCase() };
        for (let i = 0; i < 3; i++) {
            const preview = await api.post('/api/access/download', { headers: ip(), data: { ...body, action: 'preview' } });
            expect(preview.ok()).toBeTruthy();
        }
        const download = await api.post('/api/access/download', { headers: ip(), data: { ...body, action: 'download' } });
        expect(download.ok()).toBeTruthy();
        expect((await download.json()).downloadCount).toBe(1);

        const again = await api.post('/api/access/download', { headers: ip(), data: { ...body, action: 'download' } });
        expect(again.status()).toBe(403);
    } finally {
        await visitor.close();
        await page.request.delete(`/api/access?id=${access.id}`);
    }
});

test('giving access rejects weak passwords, past end dates and zero download limits', async ({ page }) => {
    await signInAsAdmin(page);
    const fileId = await firstFileId(page.request);
    const base = { fileId, userIdentifier: `v-${RUN_ID}`, identifierType: 'username' };

    const cases: [Record<string, unknown>, string][] = [
        [{ password: 'short' }, 'Use a password of at least 8 characters.'],
        [{ password: 'long-enough-1', expiresAt: '2001-01-01T00:00:00Z' }, 'Pick an end date in the future.'],
        [{ password: 'long-enough-1', maxDownloads: -2 }, 'The download limit must be a whole number of at least 1.'],
    ];
    for (const [settings, message] of cases) {
        const res = await page.request.post('/api/access', { data: { ...base, ...settings } });
        expect(res.status()).toBe(400);
        expect((await res.json()).error).toBe(message);
    }
});

test('files can be moved into a folder and back', async ({ page }) => {
    await signInAsAdmin(page);
    const fileId = await firstFileId(page.request);
    const folders = await page.request.get('/api/folders');
    expect(folders.ok()).toBeTruthy();
    const folder = (await folders.json()).folders[0];

    const moved = await page.request.patch(`/api/files/${fileId}`, { data: { folderId: folder.id } });
    expect(moved.ok()).toBeTruthy();
    expect((await moved.json()).file.folder_id).toBe(folder.id);

    const back = await page.request.patch(`/api/files/${fileId}`, { data: { folderId: null } });
    expect(back.ok()).toBeTruthy();
    expect((await back.json()).file.folder_id).toBeNull();
});
