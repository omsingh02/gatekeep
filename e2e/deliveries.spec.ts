import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { DEMO, RUN_ID, newVisitor, signInAsAdmin } from './helpers';
import { localSupabaseEnv } from './supabase-env';

// API-level tests for v2 deliveries (docs/decisions/0001-deliveries.md). They share state, so they run in order.
test.describe.configure({ mode: 'serial' });

const CREDENTIALS = "That email, username or password doesn't match. Check what you were sent and try again.";
const WRONG_CODE = "That code doesn't match or has expired. Use the code in the latest email, or send a new one.";
const CODE_SENT = "If that email has access, we've sent it a 6-digit code. It works for 10 minutes.";

let ipCounter = 0;
const ip = () => ({ 'x-forwarded-for': `10.251.${++ipCounter % 250}.${Math.floor(Math.random() * 250) + 1}` });

const codeEmail = `Code-${RUN_ID}@Example.test`.toLowerCase();
const pwUser = `pw-${RUN_ID}`;

const state: {
    owner?: APIRequestContext;
    ownerContext?: BrowserContext;
    deliveryId?: string;
    code?: string;
    passwords?: { person: string; anyone: string };
    codeRecipientId?: string;
    fileIds?: string[];
} = {};

/** Emails captured by the app's memory transport. */
async function outbox(api: APIRequestContext, to: string) {
    const res = await api.get(`/api/test-support/emails?to=${encodeURIComponent(to)}`);
    expect(res.ok()).toBeTruthy();
    return (await res.json()).emails as { subject: string; text: string; from: string }[];
}

/** Wait for an email matching the subject (sent after the response, so poll). */
async function waitForEmail(api: APIRequestContext, to: string, subject: RegExp, after = 0) {
    for (let i = 0; i < 40; i++) {
        const emails = (await outbox(api, to)).slice(after).filter((e) => subject.test(e.subject));
        if (emails.length) return emails[emails.length - 1];
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`No email to ${to} matching ${subject}`);
}

async function requestCode(api: APIRequestContext, code: string, email: string): Promise<string> {
    const before = (await outbox(api, email)).length;
    const res = await api.post(`/api/d/${code}/code`, { headers: ip(), data: { email } });
    expect(res.ok()).toBeTruthy();
    const message = await waitForEmail(api, email, /is your code for/, before);
    return message.subject.match(/^(\d{6})/)![1];
}

test.beforeAll(async ({ browser, baseURL }) => {
    state.ownerContext = await browser.newContext({ baseURL, bypassCSP: true });
    const page = await state.ownerContext.newPage();
    await signInAsAdmin(page);
    state.owner = state.ownerContext.request;
    const files = await state.owner.get('/api/files?limit=50');
    state.fileIds = (await files.json()).files.slice(0, 2).map((f: { id: string }) => f.id);
});

test.afterAll(async () => {
    await state.ownerContext?.close();
});

test('owner creates a delivery with two files, an email-code person, a password person and anyone access', async () => {
    const owner = state.owner!;
    await owner.patch('/api/settings', { data: { displayName: 'Avery Stone', organization: 'Northwind Studio' } });

    const res = await owner.post('/api/deliveries', {
        data: {
            title: `Q3 board pack ${RUN_ID}`,
            message: 'Here are the files we discussed.',
            fileIds: state.fileIds,
            people: [
                { identifier: `Code-${RUN_ID}@Example.test`, method: 'email_code', downloadLimit: 1 },
                { identifier: pwUser, method: 'password' },
            ],
            anyone: {},
        },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.delivery.files).toHaveLength(2);
    expect(body.delivery.link).toMatch(/\/[0-9A-Za-z]{6}$/);

    const byLabel = Object.fromEntries(body.recipients.map((r: { label: string }) => [r.label, r]));
    expect(byLabel[codeEmail]).toMatchObject({ method: 'email_code', password: null, inviteSent: true });
    expect(byLabel[pwUser]).toMatchObject({ method: 'password', inviteSent: false });
    expect(byLabel['Anyone with the password']).toMatchObject({ method: 'password' });
    expect(byLabel[pwUser].password).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    expect(byLabel[pwUser].password).not.toBe(byLabel['Anyone with the password'].password);
    expect(byLabel[pwUser].inviteText).not.toContain(byLabel[pwUser].password);

    state.deliveryId = body.delivery.id;
    state.code = body.delivery.shortCode;
    state.codeRecipientId = byLabel[codeEmail].id;
    state.passwords = { person: byLabel[pwUser].password, anyone: byLabel['Anyone with the password'].password };

    const invite = await waitForEmail(owner, codeEmail, /sent you/);
    expect(invite.subject).toBe(`Avery Stone sent you "Q3 board pack ${RUN_ID}"`);
    expect(invite.from).toContain('Avery Stone via Gatekeep');
    expect(invite.text).toContain(body.delivery.link);
    expect(invite.text).not.toContain(state.passwords.person);
    expect(invite.text).not.toContain(state.passwords.anyone);
});

test('before signing in, recipients see who sent it but not what it is', async ({ request }) => {
    const res = await request.get(`/api/d/${state.code}`);
    const body = await res.json();
    expect(body).toMatchObject({
        verified: false,
        sender: { name: 'Avery Stone', label: 'Avery Stone from Northwind Studio' },
        access: { emailCode: true, password: true, anyone: true },
    });
    expect(JSON.stringify(body)).not.toContain('Q3 board pack');
});

test('code requests answer the same for unknown emails, and only real recipients get a code', async ({ request }) => {
    const unknown = `nobody-${RUN_ID}@example.test`;
    const [a, b] = await Promise.all([
        request.post(`/api/d/${state.code}/code`, { headers: ip(), data: { email: unknown } }),
        request.post(`/api/d/${state.code}/code`, { headers: ip(), data: { email: codeEmail } }),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    expect(await a.json()).toEqual(await b.json());
    expect((await a.json()).message).toBe(CODE_SENT);

    await waitForEmail(request, codeEmail, /is your code for/);
    await new Promise((r) => setTimeout(r, 500));
    expect(await outbox(request, unknown)).toHaveLength(0);
});

test('email code → session → files; previews are free, downloads count, and the limit holds', async ({ browser, baseURL }) => {
    const visitor = await newVisitor(browser, baseURL!);
    const api = visitor.request;
    try {
        const code = await requestCode(api, state.code!, codeEmail);
        const session = await api.post(`/api/d/${state.code}/session`, { headers: ip(), data: { email: codeEmail, code } });
        expect(session.status()).toBe(200);
        const view = await session.json();
        expect(view.verified).toBe(true);
        expect(view.delivery.title).toBe(`Q3 board pack ${RUN_ID}`);
        expect(view.delivery.files).toHaveLength(2);
        expect(view.recipient.downloadsLeft).toBe(1);

        // The same code doesn't work twice
        const reuse = await api.post(`/api/d/${state.code}/session`, { headers: ip(), data: { email: codeEmail, code } });
        expect(reuse.status()).toBe(403);

        const fileId = view.delivery.files[0].id;
        for (let i = 0; i < 3; i++) {
            const preview = await api.post(`/api/d/${state.code}/files/${fileId}`, { headers: ip(), data: { action: 'preview' } });
            expect(preview.ok()).toBeTruthy();
            expect((await preview.json()).downloadsLeft).toBe(1);
        }
        const download = await api.post(`/api/d/${state.code}/files/${fileId}`, { headers: ip(), data: { action: 'download' } });
        expect(download.ok()).toBeTruthy();
        expect(await download.json()).toMatchObject({ downloadCount: 1, downloadsLeft: 0 });

        const again = await api.post(`/api/d/${state.code}/files/${fileId}`, { headers: ip(), data: { action: 'download' } });
        expect(again.status()).toBe(403);
        expect((await again.json()).code).toBe('ERR_DOWNLOAD_LIMIT');
        const all = await api.post(`/api/d/${state.code}/download-all`, { headers: ip() });
        expect(all.status()).toBe(403);

        // The cookie keeps them signed in
        const revisit = await api.get(`/api/d/${state.code}`);
        expect((await revisit.json()).verified).toBe(true);

        // The owner heard about the open
        await waitForEmail(api, DEMO.admin.email, new RegExp(`${codeEmail.replace(/[.]/g, '\\.')} opened`));
    } finally {
        await visitor.close();
    }
});

test('wrong codes and wrong passwords answer exactly like strangers', async ({ request }) => {
    const send = (data: Record<string, string>) => request.post(`/api/d/${state.code}/session`, { headers: ip(), data });

    const wrongCode = await send({ email: codeEmail, code: '000000' });
    const strangerCode = await send({ email: `nobody-${RUN_ID}@example.test`, code: '123456' });
    expect(wrongCode.status()).toBe(403);
    expect((await wrongCode.json()).error).toBe(WRONG_CODE);
    expect(await strangerCode.json()).toEqual(await wrongCode.json());

    const wrongPassword = await send({ identifier: pwUser, password: 'not-the-password' });
    const strangerPassword = await send({ identifier: `nobody-${RUN_ID}`, password: 'whatever-123' });
    const wrongAnyone = await send({ password: 'not-the-password' });
    expect((await wrongPassword.json()).error).toBe(CREDENTIALS);
    expect(await strangerPassword.json()).toEqual(await wrongPassword.json());
    expect(await wrongAnyone.json()).toEqual(await wrongPassword.json());
});

test('password people and anyone with the password get in; download all counts once', async ({ browser, baseURL }) => {
    for (const data of [{ identifier: pwUser.toUpperCase(), password: state.passwords!.person }, { password: state.passwords!.anyone }]) {
        const visitor = await newVisitor(browser, baseURL!);
        const api = visitor.request;
        try {
            const session = await api.post(`/api/d/${state.code}/session`, { headers: ip(), data });
            expect(session.status()).toBe(200);
            const all = await api.post(`/api/d/${state.code}/download-all`, { headers: ip() });
            expect(all.ok()).toBeTruthy();
            const body = await all.json();
            expect(body.files).toHaveLength(2);
            expect(body.downloadCount).toBe(1);
            expect(body.files[0].url).toMatch(/^http/);
        } finally {
            await visitor.close();
        }
    }
});

test('removing access ends an open session immediately', async ({ browser, baseURL }) => {
    const visitor = await newVisitor(browser, baseURL!);
    const api = visitor.request;
    try {
        const session = await api.post(`/api/d/${state.code}/session`, { headers: ip(), data: { identifier: pwUser, password: state.passwords!.person } });
        expect(session.ok()).toBeTruthy();
        const view = await session.json();

        const delivery = await (await state.owner!.get(`/api/deliveries/${state.deliveryId}`)).json();
        const person = delivery.delivery.recipients.find((r: { label: string }) => r.label === pwUser);
        const removed = await state.owner!.delete(`/api/deliveries/${state.deliveryId}/recipients/${person.id}`);
        expect(removed.ok()).toBeTruthy();

        const file = await api.post(`/api/d/${state.code}/files/${view.delivery.files[0].id}`, { headers: ip(), data: { action: 'preview' } });
        expect(file.status()).toBe(403);
        expect((await file.json()).code).toBe('ERR_REMOVED');
        const page = await (await api.get(`/api/d/${state.code}`)).json();
        expect(page).toMatchObject({ verified: false, notice: 'Avery Stone removed your access to this delivery.' });

        // And their old password no longer opens it
        const retry = await api.post(`/api/d/${state.code}/session`, { headers: ip(), data: { identifier: pwUser, password: state.passwords!.person } });
        expect(retry.status()).toBe(403);
    } finally {
        await visitor.close();
    }
});

test('request: a recipient uploads a file, it lands in the chosen folder, and the owner is told once', async ({ browser, baseURL }) => {
    const owner = state.owner!;
    const folders = (await (await owner.get('/api/folders')).json()).folders;
    const folder = folders[0];
    const email = `uploader-${RUN_ID}@example.test`;

    const created = await owner.post('/api/deliveries', {
        data: {
            kind: 'request',
            title: `Signed contracts ${RUN_ID}`,
            request: { folderId: folder.id, maxFiles: 2, maxFileMb: 5 },
            people: [{ identifier: email, method: 'email_code' }],
        },
    });
    expect(created.status()).toBe(201);
    const request = (await created.json()).delivery;
    expect(request.kind).toBe('request');
    await waitForEmail(owner, email, /asked you to upload files/);

    const visitor = await newVisitor(browser, baseURL!);
    const api = visitor.request;
    try {
        const code = await requestCode(api, request.shortCode, email);
        expect((await api.post(`/api/d/${request.shortCode}/session`, { headers: ip(), data: { email, code } })).ok()).toBeTruthy();

        const tooBig = await api.post(`/api/d/${request.shortCode}/uploads`, {
            headers: ip(),
            data: { filename: 'huge.pdf', size: 6 * 1024 * 1024, mimeType: 'application/pdf' },
        });
        expect(tooBig.status()).toBe(400);

        const bytes = Buffer.from(`%PDF-1.4\n% Gatekeep e2e ${RUN_ID}\n`);
        const start = await api.post(`/api/d/${request.shortCode}/uploads`, {
            headers: ip(),
            data: { filename: 'signed-contract.pdf', size: bytes.length, mimeType: 'application/pdf' },
        });
        expect(start.ok()).toBeTruthy();
        const { uploadUrl, path } = await start.json();
        const put = await api.put(uploadUrl, { data: bytes, headers: { 'content-type': 'application/pdf' } });
        expect(put.ok()).toBeTruthy();

        const confirm = await api.post(`/api/d/${request.shortCode}/uploads/confirm`, {
            headers: ip(),
            data: { path, filename: 'signed-contract.pdf', mimeType: 'application/pdf' },
        });
        expect(confirm.status()).toBe(201);
        const uploaded = (await confirm.json()).file;
        expect(uploaded.size).toBe(bytes.length);

        const before = (await outbox(api, DEMO.admin.email)).length;
        expect((await api.post(`/api/d/${request.shortCode}/uploads/complete`, { headers: ip() })).ok()).toBeTruthy();
        const notice = await waitForEmail(api, DEMO.admin.email, /uploaded 1 file to/, before);
        expect(notice.text).toContain('signed-contract.pdf');
        expect(notice.text).toContain(folder.name);

        const file = await (await owner.get(`/api/files/${uploaded.id}`)).json();
        expect(file.file.folder_id).toBe(folder.id);
        expect(file.file.received_via_delivery_id).toBe(request.id);
    } finally {
        await visitor.close();
    }
});

test('activity records every step and exports as CSV', async () => {
    const owner = state.owner!;
    const res = await owner.get(`/api/activity?delivery=${state.deliveryId}&limit=100`);
    expect(res.ok()).toBeTruthy();
    const { items } = await res.json();
    const types = new Set(items.map((i: { type: string }) => i.type));
    for (const type of ['access_given', 'invite_sent', 'code_sent', 'opened', 'previewed', 'downloaded', 'downloaded_all', 'denied', 'access_removed']) {
        expect(types, `missing ${type}`).toContain(type);
    }
    expect(items.find((i: { type: string }) => i.type === 'denied').reasonLabel).toBeTruthy();

    const page1 = await (await owner.get(`/api/activity?delivery=${state.deliveryId}&limit=3`)).json();
    expect(page1.items).toHaveLength(3);
    const page2 = await (await owner.get(`/api/activity?delivery=${state.deliveryId}&limit=3&cursor=${page1.nextCursor}`)).json();
    expect(page2.items[0].id).not.toBe(page1.items[2].id);

    const csv = await owner.get(`/api/activity/export?delivery=${state.deliveryId}`);
    expect(csv.headers()['content-type']).toContain('text/csv');
    const text = await csv.text();
    expect(text.split('\r\n')[0]).toBe('Time (UTC),Event,Reason,Person,Delivery,File,IP address,Browser,Request ID');
    expect(text).toContain('Downloaded all');
});

test('a v1 link keeps working after the upgrade', async ({ browser, baseURL }) => {
    const visitor = await newVisitor(browser, baseURL!);
    const api = visitor.request;
    try {
        const session = await api.post(`/api/d/${DEMO.share.code}/session`, {
            headers: ip(),
            data: { identifier: DEMO.share.recipient, password: DEMO.share.password },
        });
        expect(session.status()).toBe(200);
        const view = await session.json();
        expect(view.delivery.files).toHaveLength(1);
        expect(view.delivery.files[0].name).toBe('hero-shot.png');
    } finally {
        await visitor.close();
    }
});

test('settings and status are for the owner only', async ({ browser, baseURL }) => {
    const owner = state.owner!;
    const status = await (await owner.get('/api/status')).json();
    expect(status.checks.find((c: { id: string }) => c.id === 'email').ok).toBe(true);
    expect(status.checks.find((c: { id: string }) => c.id === 'migrations').ok).toBe(true);

    const bad = await owner.patch('/api/settings', { data: { defaultDownloadLimit: 0 } });
    expect(bad.status()).toBe(400);

    const env = localSupabaseEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const stranger = { email: `stranger2-${RUN_ID}@example.test`, password: `stranger-${RUN_ID}` };
    const { data } = await admin.auth.admin.createUser({ ...stranger, email_confirm: true });
    const context = await newVisitor(browser, baseURL!);
    try {
        const page = await context.newPage();
        await page.goto('/login');
        await page.getByLabel('Email').fill(stranger.email);
        await page.getByLabel('Password').fill(stranger.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL('**/login?reason=not-owner');
        for (const path of ['/api/deliveries', '/api/activity', '/api/settings', '/api/status', `/api/deliveries/${state.deliveryId}`]) {
            expect((await page.request.get(path)).status(), path).toBe(403);
        }
    } finally {
        await context.close();
        await admin.auth.admin.deleteUser(data.user!.id);
    }
});

test('the daily job reminds recipients whose access ends soon, once', async ({ request }) => {
    const email = `ending-${RUN_ID}@example.test`;
    const created = await state.owner!.post('/api/deliveries', {
        data: {
            title: `Ending soon ${RUN_ID}`,
            fileIds: state.fileIds!.slice(0, 1),
            people: [{ identifier: email, method: 'email_code', endsAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }],
            sendInvites: false,
        },
    });
    expect(created.status()).toBe(201);

    const run = () => request.get('/api/cron/keep-alive', { headers: { authorization: 'Bearer e2e-cron-secret' } });
    const first = await (await run()).json();
    expect(first.ok).toBe(true);
    expect(first.endingSoonSent).toBeGreaterThanOrEqual(1);
    const reminder = await waitForEmail(request, email, /ends soon/);
    expect(reminder.text).toContain(`Ending soon ${RUN_ID}`);

    await run();
    expect((await outbox(request, email)).filter((e) => /ends soon/.test(e.subject))).toHaveLength(1);
});

test('forgot password answers the same for any email', async ({ request }) => {
    const [owner, stranger] = await Promise.all([
        request.post('/api/account/forgot-password', { headers: ip(), data: { email: DEMO.admin.email } }),
        request.post('/api/account/forgot-password', { headers: ip(), data: { email: `nobody-${RUN_ID}@example.test` } }),
    ]);
    expect(owner.status()).toBe(200);
    expect(await owner.json()).toEqual(await stranger.json());
    const reset = await waitForEmail(request, DEMO.admin.email, /Reset your Gatekeep password/);
    expect(reset.text).toContain('/auth/v1/verify');
});
