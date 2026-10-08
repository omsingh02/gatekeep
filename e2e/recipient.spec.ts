import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { RUN_ID, SIGN_IN_HEADING, newVisitor, outbox, signInAsAdmin, unlock, waitForEmail } from './helpers';

// The recipient's delivery page (/{code}) driven through the browser: sign in with an email code,
// download all (counted once), live removal, the download limit, and uploading to a request.
test.describe.configure({ mode: 'serial' });

const state: {
    ownerContext?: BrowserContext;
    owner?: APIRequestContext;
    fileIds?: string[];
} = {};

test.beforeAll(async ({ browser, baseURL }) => {
    state.ownerContext = await browser.newContext({ baseURL, bypassCSP: true });
    const page = await state.ownerContext.newPage();
    await signInAsAdmin(page);
    state.owner = state.ownerContext.request;
    await state.owner.patch('/api/settings', { data: { displayName: 'Avery Stone', organization: 'Northwind Studio' } });
    const files = (await (await state.owner.get('/api/files?limit=50')).json()).files as { id: string; mimeType?: string; mime_type?: string }[];
    state.fileIds = files.slice(0, 2).map((f) => f.id);
    expect(state.fileIds).toHaveLength(2);
});

test.afterAll(async () => {
    await state.ownerContext?.close();
});

async function createDelivery(data: Record<string, unknown>) {
    const res = await state.owner!.post('/api/deliveries', { data: { sendInvites: false, ...data } });
    expect(res.status()).toBe(201);
    return (await res.json()) as {
        delivery: { id: string; shortCode: string; title: string; files: { name: string }[] };
        recipients: { id: string; label: string; password: string | null }[];
    };
}

async function recipientState(deliveryId: string, label: string) {
    const detail = await (await state.owner!.get(`/api/deliveries/${deliveryId}`)).json();
    return detail.delivery.recipients.find((r: { label: string }) => r.label === label) as { id: string; downloadCount: number };
}

test('email code: the code step never says who is on the delivery, and the code opens it', async ({ browser, baseURL }) => {
    const email = `code-${RUN_ID}@example.test`;
    const { delivery } = await createDelivery({
        title: `Board pack ${RUN_ID}`,
        message: 'Here are the files for Thursday.',
        fileIds: state.fileIds,
        people: [{ identifier: email, method: 'email_code', downloadLimit: 5, endsAt: new Date(Date.now() + 6 * 86400e3).toISOString() }],
    });

    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    try {
        await page.goto(`/${delivery.shortCode}`);
        await expect(page.getByRole('heading', { level: 1, name: 'Avery Stone sent you files' })).toBeVisible();
        await expect(page.getByText(delivery.title)).toHaveCount(0);

        // A stranger gets exactly the same answer
        const stranger = `nobody-${RUN_ID}@example.test`;
        await page.getByLabel('Email').fill(stranger);
        await page.getByRole('button', { name: 'Send code' }).click();
        await expect(page.getByText(`If ${stranger} has access, we sent a code. It expires in 10 minutes.`)).toBeVisible();
        await expect(page.getByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
        await page.getByRole('button', { name: 'Use a different email' }).click();

        const before = (await outbox(visitor.request, email)).length;
        await page.getByLabel('Email').fill(email);
        await page.getByRole('button', { name: 'Send code' }).click();
        await expect(page.getByText(`If ${email} has access, we sent a code. It expires in 10 minutes.`)).toBeVisible();
        const message = await waitForEmail(visitor.request, email, /is your code for/, before);
        const code = message.subject.match(/^(\d{6})/)![1];

        // A wrong code is explained inline
        await page.getByLabel('Code').fill('000000');
        await expect(page.getByRole('alert').filter({ hasText: "That code doesn't match or has expired." })).toBeVisible();

        // Pasting the code with spaces works, and six digits open it without pressing anything
        await page.getByLabel('Code').fill(`${code.slice(0, 3)} ${code.slice(3)}`);
        await expect(page.getByRole('heading', { level: 1, name: delivery.title })).toBeVisible();
        await expect(page.getByText('Here are the files for Thursday.')).toBeVisible();
        await expect(page.getByText(/^Access ends \w{3} \d{1,2} · in \d days$/)).toBeVisible();
        await expect(page.getByText('5 of 5 downloads left')).toBeVisible();
        expect(await page.getByRole('list', { name: 'Files' }).getByRole('listitem').count()).toBe(2);
    } finally {
        await visitor.close();
    }
});

test('Download all builds one zip in the browser and counts as one download', async ({ browser, baseURL }) => {
    const person = `zip-${RUN_ID}`;
    const { delivery, recipients } = await createDelivery({
        title: `Zip ${RUN_ID}`,
        fileIds: state.fileIds,
        people: [{ identifier: person, method: 'password', downloadLimit: 3 }],
    });
    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    try {
        await page.goto(`/${delivery.shortCode}`);
        await unlock(page, person, recipients.find((r) => r.label === person)!.password!);
        await expect(page.getByRole('heading', { level: 1, name: delivery.title })).toBeVisible();

        const calls: string[] = [];
        page.on('request', (r) => {
            if (/\/api\/d\/[^/]+\/(download-all|files\/)/.test(r.url())) calls.push(new URL(r.url()).pathname);
        });
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download all' }).click();
        const zip = await download;
        expect(zip.suggestedFilename()).toBe(`${delivery.title}.zip`);
        const bytes = readFileSync((await zip.path())!);
        expect(bytes.subarray(0, 2).toString()).toBe('PK');
        for (const file of delivery.files) expect(bytes.includes(Buffer.from(file.name))).toBe(true);

        await expect(page.getByRole('note').filter({ hasText: `Saved ${delivery.title}.zip` })).toBeVisible();
        await expect(page.getByText('2 of 3 downloads left')).toBeVisible();
        expect(calls).toEqual([`/api/d/${delivery.shortCode}/download-all`]);
        expect((await recipientState(delivery.id, person)).downloadCount).toBe(1);
    } finally {
        await visitor.close();
    }
});

test('at the download limit, downloads stop but previews still work', async ({ browser, baseURL }) => {
    const person = `limit-${RUN_ID}`;
    const { delivery, recipients } = await createDelivery({
        title: `Limit ${RUN_ID}`,
        fileIds: state.fileIds,
        people: [{ identifier: person, method: 'password', downloadLimit: 1 }],
    });
    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    try {
        await page.goto(`/${delivery.shortCode}`);
        await unlock(page, person, recipients.find((r) => r.label === person)!.password!);
        const name = delivery.files[0].name;
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: `Download ${name}` }).click();
        await download;

        await expect(page.getByRole('note').filter({ hasText: "You've used all your downloads" })).toBeVisible();
        await expect(page.getByText('No downloads left')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Download all' })).toBeDisabled();
        await expect(page.getByRole('button', { name: `Download ${name}` })).toBeDisabled();

        await page.getByRole('button', { name, exact: true }).click();
        await expect(page.getByRole('dialog', { name })).toBeVisible();
        await page.keyboard.press('Escape');
    } finally {
        await visitor.close();
    }
});

test('removing access switches an open page to "access removed" without a reload', async ({ browser, baseURL }) => {
    const person = `live-${RUN_ID}`;
    const { delivery, recipients } = await createDelivery({
        title: `Live ${RUN_ID}`,
        fileIds: state.fileIds,
        people: [{ identifier: person, method: 'password' }],
    });
    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    try {
        const stream = page.waitForResponse((r) => r.url().endsWith(`/api/d/${delivery.shortCode}/stream`));
        await page.goto(`/${delivery.shortCode}`);
        await unlock(page, person, recipients.find((r) => r.label === person)!.password!);
        await expect(page.getByRole('heading', { level: 1, name: delivery.title })).toBeVisible();
        expect((await stream).status()).toBe(200);

        const rid = recipients.find((r) => r.label === person)!.id;
        expect((await state.owner!.delete(`/api/deliveries/${delivery.id}/recipients/${rid}`)).ok()).toBeTruthy();

        await expect(page.getByRole('heading', { name: 'Your access was removed' })).toBeVisible({ timeout: 40_000 });
        await expect(page.getByText('Avery Stone removed your access to this delivery.')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: delivery.title })).toHaveCount(0);
        await expect(page.getByRole('textbox')).toHaveCount(0);

        // "I have a new invite" leads back to signing in
        await page.getByRole('button', { name: 'I have a new invite' }).click();
        await expect(page.getByRole('heading', { level: 1, name: SIGN_IN_HEADING })).toBeVisible();
    } finally {
        await visitor.close();
    }
});

test('request: the recipient sees what was asked for, uploads files with progress, and the owner gets them', async ({ browser, baseURL }) => {
    const email = `upload-${RUN_ID}@example.test`;
    const folders = (await (await state.owner!.get('/api/folders')).json()).folders as { id: string; name: string }[];
    const created = await state.owner!.post('/api/deliveries', {
        data: {
            kind: 'request',
            title: `Signed contract ${RUN_ID}`,
            request: { folderId: folders[0].id, maxFiles: 3, maxFileMb: 5 },
            people: [{ identifier: email, method: 'email_code' }],
            sendInvites: false,
        },
    });
    expect(created.status()).toBe(201);
    const request = (await created.json()).delivery as { id: string; shortCode: string; title: string };

    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    try {
        await page.goto(`/${request.shortCode}`);
        await expect(page.getByRole('heading', { level: 1, name: 'Avery Stone asked you for files' })).toBeVisible();
        const before = (await outbox(visitor.request, email)).length;
        await page.getByLabel('Email').fill(email);
        await page.getByRole('button', { name: 'Send code' }).click();
        const code = (await waitForEmail(visitor.request, email, /is your code for/, before)).subject.match(/^(\d{6})/)![1];
        await page.getByLabel('Code').fill(code);

        await expect(page.getByText('Avery Stone asked you for files')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: request.title })).toBeVisible();
        await expect(page.getByText('Up to 3 files, 5 MB each').first()).toBeVisible();

        await page.locator('input[type="file"]').setInputFiles([
            { name: 'signed-contract.pdf', mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${RUN_ID}\n`) },
            { name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Notes\n') },
            { name: 'setup.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') },
        ]);
        await expect(page.getByRole('note').filter({ hasText: "setup.exe can't be sent." })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Sent 2 files to Avery Stone' })).toBeVisible();
        await expect(page.getByRole('list', { name: "Files you've sent" }).getByRole('listitem')).toHaveCount(2);

        // The owner has them, in the request's folder
        const files = (await (await state.owner!.get(`/api/files?folderId=${folders[0].id}&limit=100`)).json()).files as {
            originalFilename: string;
        }[];
        const names = files.map((f) => f.originalFilename);
        expect(names).toEqual(expect.arrayContaining(['signed-contract.pdf', 'notes.md']));

        // One more fits; then the request is full
        await page.getByRole('button', { name: 'Add more files' }).click();
        await page.locator('input[type="file"]').setInputFiles([{ name: 'id-scan.png', mimeType: 'image/png', buffer: readFileSync('app/apple-icon.png') }]);
        await expect(page.getByRole('heading', { name: 'Sent 1 file to Avery Stone' })).toBeVisible();
        await page.reload();
        await expect(page.getByText("You've sent all the files this request takes")).toBeVisible();
        await expect(page.getByRole('list', { name: "Files you've sent" }).getByRole('listitem')).toHaveCount(3);
    } finally {
        await visitor.close();
    }
});
