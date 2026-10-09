import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { RUN_ID, SIGN_IN_HEADING, newVisitor, signInAsAdmin, unlock } from './helpers';
import { localSupabaseEnv } from './supabase-env';

function serviceClient() {
    const env = localSupabaseEnv();
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// One owner sends one file to one recipient, end to end: the file is uploaded on the Files page
// (and gets no link of its own), sent through a delivery with the owner API, and opened on the
// delivery page. The steps depend on each other (the delivery needs the upload, the revisit needs
// the unlock), so they run in order.
test.describe.configure({ mode: 'serial' });

const fileName = `e2e-${RUN_ID}.txt`;
const fileBody = `Hello from the Gatekeep end-to-end tests (${RUN_ID}).`;
const title = `Hello ${RUN_ID}`;
const recipient = { username: `e2e-${RUN_ID}`, password: `pw-${RUN_ID}-Secure!` };

let owner: BrowserContext;
let ownerPage: Page;
let visitor: BrowserContext;
let visitorPage: Page;
let shareUrl: string;
let deliveryId: string;

test.beforeAll(async ({ browser, baseURL }) => {
    owner = await newVisitor(browser, baseURL!);
    ownerPage = await owner.newPage();
    await signInAsAdmin(ownerPage);
    visitor = await newVisitor(browser, baseURL!);
    visitorPage = await visitor.newPage();
});

test.afterAll(async () => {
    await owner?.close();
    await visitor?.close();
});

test('owner uploads a file from the Files page', async () => {
    await ownerPage.goto('/admin/files');
    await ownerPage.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(ownerPage.getByRole('dialog', { name: 'Upload files' })).toBeVisible();
    const confirm = ownerPage.waitForResponse((r) => r.url().endsWith('/api/files/confirm') && r.request().method() === 'POST');
    await ownerPage.locator('input[type="file"]:not([webkitdirectory])').setInputFiles({
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(fileBody),
    });
    expect((await confirm).ok()).toBe(true);
    await expect(ownerPage.getByRole('dialog').getByText('Uploaded 1 file')).toBeVisible();
    await ownerPage.getByRole('button', { name: 'Done' }).click();
    await expect(ownerPage.locator('tr', { hasText: fileName })).toBeVisible();
});

test('the uploaded file has no link of its own; the owner sends it to a person', async () => {
    const list = await (await ownerPage.request.get(`/api/files?search=${encodeURIComponent(fileName)}&all=true`)).json();
    const file = list.files.find((f: { name: string }) => f.name === fileName);
    expect(file).toBeTruthy();
    expect(file).not.toHaveProperty('shortCode');
    // Files are private content: only deliveries have links (docs/decisions/0001-deliveries.md)
    const { data: row } = await serviceClient().from('files').select('short_code').eq('id', file.id).single();
    expect(row!.short_code).toBeNull();

    const created = await ownerPage.request.post('/api/deliveries', {
        data: {
            title,
            fileIds: [file.id],
            people: [{ identifier: recipient.username, identifierType: 'username', method: 'password', password: recipient.password }],
            sendInvites: false,
        },
    });
    expect(created.status()).toBe(201);
    const { delivery } = await created.json();
    expect(delivery.link).toMatch(/\/[0-9A-Za-z]{6}$/);
    shareUrl = delivery.link;
    deliveryId = delivery.id;
});

test('recipient unlocks, previews and downloads the file', async () => {
    await visitorPage.goto(shareUrl);
    await unlock(visitorPage, recipient.username, recipient.password);

    await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(visitorPage.getByText('1 file ·')).toBeVisible();

    await visitorPage.getByRole('button', { name: `Preview ${fileName}` }).click();
    const stage = visitorPage.getByRole('dialog', { name: fileName });
    await expect(stage.locator('pre', { hasText: fileBody })).toBeVisible();
    await visitorPage.keyboard.press('Escape');
    await expect(stage).toHaveCount(0);

    const download = visitorPage.waitForEvent('download');
    const tracked = visitorPage.waitForResponse((r) => /\/api\/d\/[^/]+\/files\//.test(r.url()) && r.request().method() === 'POST');
    await visitorPage.getByRole('button', { name: `Download ${fileName}` }).click();
    expect((await tracked).status()).toBe(200);
    expect((await download).suggestedFilename()).toBe(fileName);
});

test('returning recipient is let straight back in by their sign-in', async () => {
    await visitorPage.reload();
    await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(visitorPage.getByRole('heading', { level: 1, name: SIGN_IN_HEADING })).toHaveCount(0);
});

test("removing the recipient's access ends their open page at once", async () => {
    const detail = await (await ownerPage.request.get(`/api/deliveries/${deliveryId}`)).json();
    const person = detail.delivery.recipients.find((r: { label: string }) => r.label === recipient.username);
    expect((await ownerPage.request.delete(`/api/deliveries/${deliveryId}/recipients/${person.id}`)).ok()).toBeTruthy();

    // No reload: the open page is told
    await expect(visitorPage.getByRole('heading', { name: 'Your access was removed' })).toBeVisible();
    await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toHaveCount(0);

    // And stays that way
    await visitorPage.reload();
    await expect(visitorPage.getByRole('heading', { name: 'Your access was removed' })).toBeVisible();
});
