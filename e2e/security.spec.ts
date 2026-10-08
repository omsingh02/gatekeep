import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { DEMO, RUN_ID, newVisitor, signInAsAdmin, unlock } from './helpers';
import { localSupabaseEnv } from './supabase-env';

const CREDENTIALS_ERROR = "That email, username or password doesn't match. Check what you were sent and try again.";

let ipCounter = 0;
/** Each API caller gets its own client IP, like separate people would. */
const ip = () => ({ 'x-forwarded-for': `10.250.${++ipCounter % 250}.${Math.floor(Math.random() * 250) + 1}` });

function serviceClient() {
    const env = localSupabaseEnv();
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

async function firstFileId(request: APIRequestContext): Promise<string> {
    const res = await request.get('/api/files?limit=50');
    expect(res.ok()).toBeTruthy();
    const { files } = await res.json();
    expect(files.length).toBeGreaterThan(0);
    return files[0].id;
}

/** A delivery of one file with no recipients yet; returns its id and link code. */
async function createDelivery(owner: APIRequestContext, title: string, extra: Record<string, unknown> = {}) {
    const res = await owner.post('/api/deliveries', {
        data: { title, fileIds: [await firstFileId(owner)], sendInvites: false, ...extra },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    return { id: body.delivery.id as string, code: body.delivery.shortCode as string, recipients: body.recipients as { id: string; label: string }[] };
}

test('a signed-in account that is not the owner cannot use the dashboard or any owner API', async ({ browser, baseURL }) => {
    const admin = serviceClient();
    const stranger = { email: `stranger-${RUN_ID}@example.test`, password: `stranger-${RUN_ID}` };
    const { data, error } = await admin.auth.admin.createUser({ ...stranger, email_confirm: true });
    expect(error).toBeNull();

    // Real ids, so a 403 can't be a 404 in disguise
    const { data: delivery } = await admin.from('deliveries').select('id').is('deleted_at', null).limit(1).single();
    const { data: recipient } = await admin.from('delivery_recipients').select('id').eq('delivery_id', delivery!.id).limit(1).maybeSingle();
    const { data: file } = await admin.from('files').select('id').is('deleted_at', null).limit(1).single();

    const context = await newVisitor(browser, baseURL!);
    const page = await context.newPage();
    try {
        await page.goto('/login');
        await page.getByLabel('Email').fill(stranger.email);
        await page.getByLabel('Password').fill(stranger.password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        await page.waitForURL('**/login?reason=not-owner');
        await expect(page.getByText("That account isn't the owner of this Gatekeep.")).toBeVisible();
        await page.goto('/admin');
        await page.waitForURL('**/login?reason=not-owner');

        const api = page.request;
        const calls: [string, () => ReturnType<APIRequestContext['get']>][] = [
            ['GET /api/files', () => api.get('/api/files')],
            ['PATCH /api/files/{id}', () => api.patch(`/api/files/${file!.id}`, { data: { folderId: null } })],
            ['GET /api/files/{id}/url', () => api.get(`/api/files/${file!.id}/url?action=download`)],
            ['POST /api/files/presign', () => api.post('/api/files/presign', { data: { filename: 'x.txt', fileSize: 1, mimeType: 'text/plain' } })],
            ['GET /api/deliveries', () => api.get('/api/deliveries')],
            ['POST /api/deliveries', () => api.post('/api/deliveries', { data: { title: 'Nope', fileIds: [file!.id] } })],
            ['GET /api/deliveries/{id}', () => api.get(`/api/deliveries/${delivery!.id}`)],
            ['DELETE /api/deliveries/{id}', () => api.delete(`/api/deliveries/${delivery!.id}`)],
            [
                'POST /api/deliveries/{id}/recipients',
                () => api.post(`/api/deliveries/${delivery!.id}/recipients`, { data: { people: [{ identifier: stranger.email, method: 'password' }] } }),
            ],
            ...(recipient
                ? ([
                      [
                          'PATCH /api/deliveries/{id}/recipients/{rid}',
                          () => api.patch(`/api/deliveries/${delivery!.id}/recipients/${recipient.id}`, { data: { regeneratePassword: true } }),
                      ],
                      ['DELETE /api/deliveries/{id}/recipients/{rid}', () => api.delete(`/api/deliveries/${delivery!.id}/recipients/${recipient.id}`)],
                  ] as [string, () => ReturnType<APIRequestContext['get']>][])
                : []),
            ['GET /api/activity', () => api.get('/api/activity')],
            ['GET /api/activity/export', () => api.get('/api/activity/export')],
            ['GET /api/settings', () => api.get('/api/settings')],
        ];
        for (const [name, call] of calls) {
            expect((await call()).status(), name).toBe(403);
        }
    } finally {
        await context.close();
        await admin.auth.admin.deleteUser(data.user!.id);
    }
});

test('the v1 API is gone', async ({ request }) => {
    for (const path of ['/api/access', '/api/access/download', '/api/access/stream', '/api/verify', '/api/analytics']) {
        expect((await request.post(path, { data: {} })).status(), path).toBe(404);
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
    const recipient = `Case-${RUN_ID}@Example.COM`;
    const password = `limit-${RUN_ID}`;
    const delivery = await createDelivery(page.request, `Limit ${RUN_ID}`, {
        people: [{ identifier: recipient, identifierType: 'email', method: 'password', password, downloadLimit: 1 }],
    });
    expect(delivery.recipients.map((r) => r.label)).toEqual([recipient.toLowerCase()]);

    const visitor = await newVisitor(browser, baseURL!);
    const api = visitor.request;
    try {
        // Typed in a different case than it was given
        const session = await api.post(`/api/d/${delivery.code}/session`, {
            headers: ip(),
            data: { identifier: recipient.toUpperCase(), password },
        });
        expect(session.ok()).toBeTruthy();
        const view = await session.json();
        expect(view.recipient).toMatchObject({ label: recipient.toLowerCase(), downloadsLeft: 1 });
        // Signing in never hands out a file URL: every URL is asked for (and recorded) separately
        expect(JSON.stringify(view)).not.toMatch(/"url"/);

        const fileUrl = `/api/d/${delivery.code}/files/${view.delivery.files[0].id}`;
        for (let i = 0; i < 3; i++) {
            const preview = await api.post(fileUrl, { headers: ip(), data: { action: 'preview' } });
            expect(preview.ok()).toBeTruthy();
            expect(await preview.json()).toMatchObject({ downloadCount: 0, downloadsLeft: 1 });
        }
        const download = await api.post(fileUrl, { headers: ip(), data: { action: 'download' } });
        expect(download.ok()).toBeTruthy();
        expect(await download.json()).toMatchObject({ downloadCount: 1, downloadsLeft: 0 });

        const again = await api.post(fileUrl, { headers: ip(), data: { action: 'download' } });
        expect(again.status()).toBe(403);
        expect((await again.json()).code).toBe('ERR_DOWNLOAD_LIMIT');
        // Previews keep working after the limit
        expect((await api.post(fileUrl, { headers: ip(), data: { action: 'preview' } })).ok()).toBeTruthy();
    } finally {
        await visitor.close();
        await page.request.delete(`/api/deliveries/${delivery.id}`);
    }
});

test('giving access rejects short passwords, past end dates and download limits below 1', async ({ page }) => {
    await signInAsAdmin(page);
    const delivery = await createDelivery(page.request, `Validation ${RUN_ID}`, {
        people: [{ identifier: `ok-${RUN_ID}`, identifierType: 'username', method: 'password' }],
    });
    const person = { identifier: `v-${RUN_ID}`, identifierType: 'username', method: 'password' };
    const cases: [Record<string, unknown>, string][] = [
        [{ password: 'short' }, 'Use a password of at least 8 characters.'],
        [{ password: 'long-enough-1', endsAt: '2001-01-01T00:00:00Z' }, 'Pick an end date in the future.'],
        [{ password: 'long-enough-1', downloadLimit: -2 }, 'The download limit must be a whole number of at least 1.'],
    ];
    try {
        for (const [settings, message] of cases) {
            // Adding someone to a delivery
            const add = await page.request.post(`/api/deliveries/${delivery.id}/recipients`, { data: { people: [{ ...person, ...settings }] } });
            expect(add.status()).toBe(400);
            expect((await add.json()).error).toBe(message);

            // Anyone with the password
            const anyone = await page.request.post(`/api/deliveries/${delivery.id}/recipients`, { data: { anyone: settings } });
            expect(anyone.status()).toBe(400);
            expect((await anyone.json()).error).toBe(message);

            // Changing someone who's already on it
            const change = await page.request.patch(`/api/deliveries/${delivery.id}/recipients/${delivery.recipients[0].id}`, { data: settings });
            expect(change.status()).toBe(400);
            expect((await change.json()).error).toBe(message);
        }

        // A delivery created with invalid access isn't created at all
        const before = (await (await page.request.get(`/api/deliveries?q=${encodeURIComponent(`Rejected ${RUN_ID}`)}`)).json()).total;
        const rejected = await page.request.post('/api/deliveries', {
            data: { title: `Rejected ${RUN_ID}`, fileIds: [await firstFileId(page.request)], people: [{ ...person, password: 'short' }] },
        });
        expect(rejected.status()).toBe(400);
        expect((await rejected.json()).error).toBe('Use a password of at least 8 characters.');
        expect((await (await page.request.get(`/api/deliveries?q=${encodeURIComponent(`Rejected ${RUN_ID}`)}`)).json()).total).toBe(before);

        // Nobody was added along the way
        const detail = await (await page.request.get(`/api/deliveries/${delivery.id}`)).json();
        expect(detail.delivery.recipients.map((r: { label: string }) => r.label)).toEqual([`ok-${RUN_ID}`]);
    } finally {
        await page.request.delete(`/api/deliveries/${delivery.id}`);
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

test("the database API only serves Gatekeep's server: no privileged functions or tables for the public key", async () => {
    const env = localSupabaseEnv();
    const service = serviceClient();
    const { data: file } = await service.from('files').select('id, uploaded_by').is('deleted_at', null).limit(1).single();
    expect(file).toBeTruthy();
    const { data: recipient } = await service.from('delivery_recipients').select('id, download_count').limit(1).single();
    expect(recipient).toBeTruthy();

    // What an outsider has: the public anon key from the site's JavaScript, the owner's id (part of the
    // public logo URL) and a file id (visible to recipients)
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const calls: [string, Record<string, unknown>][] = [
        ['soft_delete_file', { p_file_id: file!.id, p_user_id: file!.uploaded_by }],
        ['delete_file_cascade', { p_file_id: file!.id, p_user_id: file!.uploaded_by }],
        ['complete_file_deletion', { p_file_id: file!.id }],
        ['cleanup_soft_deleted_files', { older_than_hours: 0 }],
        ['gk_count_download', { p_recipient_id: recipient!.id }],
        ['gk_count_open', { p_recipient_id: recipient!.id }],
        ['migrate_v1_to_v2', {}],
    ];
    for (const [fn, args] of calls) {
        const { error } = await anon.rpc(fn, args);
        expect(error, `anon can call ${fn}`).not.toBeNull();
    }

    // Signed in as the owner, the functions are still server-only (the app calls them with the service role)
    const owner = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await owner.auth.signInWithPassword(DEMO.admin);
    expect(signInError).toBeNull();
    for (const [fn, args] of calls) {
        const { error } = await owner.rpc(fn, args);
        expect(error, `a signed-in account can call ${fn}`).not.toBeNull();
    }

    // Tables aren't readable with the public key at all, not even as empty results
    for (const table of ['files', 'deliveries', 'delivery_recipients', 'activity', 'verification_codes', 'owner_settings']) {
        const { error } = await anon.from(table).select('*').limit(1);
        expect(error, `anon can read ${table}`).not.toBeNull();
    }

    // Nothing changed
    const { data: after } = await service.from('files').select('deleted_at').eq('id', file!.id).single();
    expect(after!.deleted_at).toBeNull();
    const { data: recipientAfter } = await service.from('delivery_recipients').select('download_count').eq('id', recipient!.id).single();
    expect(recipientAfter!.download_count).toBe(recipient!.download_count);
});
