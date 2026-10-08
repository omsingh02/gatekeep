import { readFileSync } from 'node:fs';
import { test, expect, type APIRequest, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { RUN_ID, signInAsAdmin } from './helpers';
import { localSupabaseEnv } from './supabase-env';

// Owner screens that summarise deliveries: the Overview's recent deliveries and activity, the
// status in a delivery's header (including when everyone's access has ended), and a request's
// files received (preview and download).
test.describe.configure({ mode: 'serial' });

const supabaseEnv = localSupabaseEnv();
const admin = createClient(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL, supabaseEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

let ipCounter = 0;
const ip = () => ({ 'x-forwarded-for': `10.253.${++ipCounter % 250}.${Math.floor(Math.random() * 250) + 1}` });

const state: { ownerContext?: BrowserContext; owner?: APIRequestContext; fileIds?: string[] } = {};

interface Created {
    delivery: { id: string; shortCode: string; title: string };
    recipients: { id: string; identifier: string; password: string | null }[];
}

async function createDelivery(data: Record<string, unknown>): Promise<Created> {
    const res = await state.owner!.post('/api/deliveries', { data: { sendInvites: false, ...data } });
    expect(res.status()).toBe(201);
    return res.json();
}

/** A recipient signed in with their password, in a request context of their own. */
async function signInAsRecipient(playwright: { request: APIRequest }, baseURL: string, code: string, identifier: string, password: string) {
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: ip() });
    const res = await api.post(`/api/d/${code}/session`, { data: { identifier, password } });
    expect(res.ok()).toBeTruthy();
    return api;
}

async function upload(api: APIRequestContext, code: string, filename: string, mimeType: string, bytes: Buffer) {
    const start = await api.post(`/api/d/${code}/uploads`, { data: { filename, size: bytes.length, mimeType } });
    expect(start.ok()).toBeTruthy();
    const { uploadUrl, path } = await start.json();
    expect((await api.put(uploadUrl, { data: bytes, headers: { 'content-type': mimeType } })).ok()).toBeTruthy();
    expect((await api.post(`/api/d/${code}/uploads/confirm`, { data: { path, filename, mimeType } })).status()).toBe(201);
}

test.beforeAll(async ({ browser, baseURL }) => {
    state.ownerContext = await browser.newContext({ baseURL, bypassCSP: true });
    const page = await state.ownerContext.newPage();
    await signInAsAdmin(page);
    state.owner = state.ownerContext.request;
    const files = (await (await state.owner.get('/api/files?limit=50')).json()).files as { id: string }[];
    state.fileIds = files.slice(0, 2).map((f) => f.id);
    expect(state.fileIds).toHaveLength(2);
});

test.afterAll(async () => {
    await state.ownerContext?.close();
});

test('the Overview shows recent deliveries and recent activity, with the same rows as their pages', async ({ page, playwright, baseURL }) => {
    const person = `overview-${RUN_ID}@example.test`;
    const title = `Overview check ${RUN_ID}`;
    const { delivery, recipients } = await createDelivery({
        title,
        fileIds: state.fileIds,
        people: [{ identifier: person, method: 'password' }],
    });
    // Their open is the newest event
    const visitor = await signInAsRecipient(playwright, baseURL!, delivery.shortCode, person, recipients[0].password!);
    await visitor.dispose();

    await signInAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();

    // Recent deliveries: the Deliveries table's row, newest first, linking to the delivery
    const deliveries = page.getByRole('table', { name: 'Recent deliveries' });
    const row = deliveries.getByTestId('delivery-row').first();
    await expect(row).toContainText(title);
    await expect(row).toContainText('Active');
    await expect(row).toContainText(person);
    await expect(deliveries.getByTestId('delivery-row')).toHaveCount(5);
    await expect(page.getByRole('link', { name: 'View all deliveries' })).toHaveAttribute('href', '/admin/deliveries');

    // Recent activity: the Activity page's rows, which open to show the details
    const activity = page.getByRole('list', { name: 'Recent activity' });
    await expect(activity.getByTestId('activity-row')).toHaveCount(6);
    const opened = activity.getByTestId('activity-row').first();
    await expect(opened).toHaveAttribute('data-type', 'opened');
    await expect(opened).toContainText(`${person} opened ${title}`);
    await opened.getByRole('button').click();
    await expect(opened.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await expect(opened.getByText('IP address')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View all activity' })).toHaveAttribute('href', '/admin/activity');

    // The stat cards all have a detail line
    for (const detail of [/^\d+ folders?$|^No folders yet$/, /^Across \d+ files?$/, /^\d+ active$/, 'Across all deliveries']) {
        await expect(page.getByText(detail).first()).toBeVisible();
    }

    // Phones get the Deliveries cards, as rows of the same card
    await page.setViewportSize({ width: 390, height: 844 });
    const phoneList = page.getByRole('list', { name: 'Recent deliveries' });
    await expect(phoneList).toBeVisible();
    await expect(phoneList.getByRole('listitem').first()).toContainText(title);
    await phoneList.getByRole('link', { name: title }).click();
    await page.waitForURL(`**/admin/deliveries/${delivery.id}`);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
});

test('a delivery whose access has ended says so in its header, with the ways to give access again', async ({ page }) => {
    const people = [`ended-a-${RUN_ID}@example.test`, `ended-b-${RUN_ID}@example.test`];
    const title = `Ended check ${RUN_ID}`;
    const { delivery, recipients } = await createDelivery({
        title,
        fileIds: state.fileIds,
        people: people.map((identifier) => ({ identifier, method: 'password' })),
    });

    await signInAsAdmin(page);
    await page.goto(`/admin/deliveries/${delivery.id}`);
    // The page header (the app's own header is outside <main>)
    const header = page.locator('main header').filter({ has: page.getByRole('heading', { name: title, level: 1 }) });
    await expect(header.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByText('No one can open this delivery')).toHaveCount(0);

    // Both people's access ended two days ago
    const { error } = await admin
        .from('delivery_recipients')
        .update({ ends_at: new Date(Date.now() - 2 * 86400e3).toISOString() })
        .eq('delivery_id', delivery.id);
    expect(error).toBeNull();

    await page.reload();
    await expect(header.getByText('Ended', { exact: true })).toBeVisible();
    const callout = page.getByRole('note').filter({ hasText: 'No one can open this delivery' });
    await expect(callout).toContainText("Everyone's access has ended");
    await expect(callout.getByRole('button', { name: 'Add people' })).toBeVisible();

    // The Deliveries list says the same
    await page.goto('/admin/deliveries');
    await expect(page.getByTestId('delivery-row').filter({ hasText: title })).toContainText('Ended');

    // Remove one person: the other's end date can be changed straight from the callout
    expect((await state.owner!.delete(`/api/deliveries/${delivery.id}/recipients/${recipients[1].id}`)).ok()).toBeTruthy();
    await page.goto(`/admin/deliveries/${delivery.id}`);
    await expect(callout).toContainText(/'s access ended/);
    await callout.getByRole('button', { name: 'Change end date' }).click();
    const dialog = page.getByRole('dialog', { name: /access$/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(header.getByText('Active', { exact: true })).toBeVisible();
    await expect(callout).toHaveCount(0);

    // Remove the last person too: the header says why no one can open it
    expect((await state.owner!.delete(`/api/deliveries/${delivery.id}/recipients/${recipients[0].id}`)).ok()).toBeTruthy();
    await page.reload();
    await expect(header.getByText('Ended', { exact: true })).toBeVisible();
    await expect(callout).toContainText("You removed everyone's access. Add people to give access again.");
    await expect(page.getByText('All removed')).toBeVisible();
});

test('files received on a request show their size and can be previewed and downloaded', async ({ page, playwright, baseURL }) => {
    const person = `uploads-${RUN_ID}@example.test`;
    const folders = (await (await state.owner!.get('/api/folders')).json()).folders as { id: string; name: string }[];
    const { delivery, recipients } = await createDelivery({
        kind: 'request',
        title: `Received check ${RUN_ID}`,
        request: { folderId: folders[0].id, maxFiles: 5, maxFileMb: 5 },
        people: [{ identifier: person, method: 'password' }],
    });
    const recipient = await signInAsRecipient(playwright, baseURL!, delivery.shortCode, person, recipients[0].password!);
    const png = readFileSync('app/apple-icon.png');
    await upload(recipient, delivery.shortCode, 'id-scan.png', 'image/png', png);
    await upload(recipient, delivery.shortCode, 'redlines.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('PK e2e'));
    await recipient.dispose();

    await signInAsAdmin(page);
    await page.goto(`/admin/requests/${delivery.id}`);
    await page.getByRole('tab', { name: /Files received/ }).click();
    const list = page.getByRole('list', { name: 'Files received' });
    await expect(list.getByTestId('received-file')).toHaveCount(2);

    // Each row: type, size and who sent it
    const image = list.getByTestId('received-file').filter({ hasText: 'id-scan.png' });
    await expect(image).toContainText(`PNG · ${Math.round((png.length / 1024) * 10) / 10} KB · From ${person}`);

    // Images, PDFs, text, audio and video preview in the owner's file preview
    await image.getByRole('button', { name: 'Preview id-scan.png' }).click();
    const preview = page.getByRole('dialog', { name: 'id-scan.png' });
    await expect(preview.getByRole('img', { name: 'id-scan.png' })).toBeVisible();
    await preview.getByRole('button', { name: 'Close' }).click();
    await expect(preview).toBeHidden();

    // A Word file can't be previewed: download only
    const doc = list.getByTestId('received-file').filter({ hasText: 'redlines.docx' });
    await expect(doc.getByRole('button', { name: 'Preview redlines.docx' })).toHaveCount(0);
    const download = page.waitForEvent('download');
    await doc.getByRole('button', { name: 'Download redlines.docx' }).click();
    expect((await download).suggestedFilename()).toBe('redlines.docx');
});
