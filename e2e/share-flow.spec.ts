import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { RUN_ID, SIGN_IN_HEADING, newVisitor, signInAsAdmin, unlock } from './helpers';

// One owner shares one file with one recipient, end to end: the v1 dashboard gives access, and the
// link opens the v2 delivery page (the file's link is converted to a delivery on first visit).
// The steps depend on each other (the grant needs the upload, the revisit needs the unlock), so they run in order.
test.describe.configure({ mode: 'serial' });

const fileName = `e2e-${RUN_ID}.txt`;
const fileBody = `Hello from the Gatekeep end-to-end tests (${RUN_ID}).`;
const recipient = { username: `e2e-${RUN_ID}`, password: `pw-${RUN_ID}-Secure!` };

let owner: BrowserContext;
let ownerPage: Page;
let visitor: BrowserContext;
let visitorPage: Page;
let shareUrl: string;

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

async function openAccessManager() {
    // /admin/files rather than /admin: the dashboard's Recent Shares list (behind the modal)
    // also shows this recipient with a Revoke button
    await ownerPage.goto('/admin/files');
    const row = ownerPage.locator('tr', { hasText: fileName });
    await row.getByTitle('Manage access').click();
    await expect(ownerPage.getByRole('heading', { name: 'Manage File Access' })).toBeVisible();
}

test('owner uploads a file from the dashboard', async () => {
    const confirm = ownerPage.waitForResponse((r) => r.url().endsWith('/api/files/confirm') && r.request().method() === 'POST');
    await ownerPage.locator('input[type="file"]:not([webkitdirectory])').setInputFiles({
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(fileBody),
    });
    expect((await confirm).ok()).toBe(true);
    await expect(ownerPage.locator('tr', { hasText: fileName })).toBeVisible();
});

test('owner grants access and gets a ready-to-send invite', async () => {
    await openAccessManager();
    await ownerPage.getByPlaceholder('Enter username').fill(recipient.username);
    await ownerPage.getByPlaceholder('Enter password').first().fill(recipient.password);
    await ownerPage.getByRole('button', { name: 'Grant Access', exact: true }).click();

    await expect(ownerPage.getByText('Access granted — send them this invite')).toBeVisible();
    const invite = ownerPage.locator('pre', { hasText: 'Password:' });
    await expect(invite).toContainText(`I've shared "${fileName}" with you.`);
    await expect(invite).toContainText(`Username: ${recipient.username}`);
    await expect(invite).toContainText(`Password: ${recipient.password}`);

    const link = (await invite.textContent())?.match(/Link: (\S+)/)?.[1];
    expect(link).toMatch(/\/[A-Za-z0-9]{6}$/);
    shareUrl = link!;
});

test('recipient unlocks, previews and downloads the file', async () => {
    await visitorPage.goto(shareUrl);
    await unlock(visitorPage, recipient.username, recipient.password);

    await expect(visitorPage.getByRole('heading', { level: 1, name: fileName })).toBeVisible();
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
    await expect(visitorPage.getByRole('heading', { level: 1, name: fileName })).toBeVisible();
    await expect(visitorPage.getByRole('heading', { level: 1, name: SIGN_IN_HEADING })).toHaveCount(0);
});

test("removing the recipient's access ends their open page at once", async () => {
    // The v1 grant became a recipient of the delivery behind the link; remove it the v2 way
    const code = new URL(shareUrl).pathname.slice(1);
    const list = await (await ownerPage.request.get(`/api/deliveries?q=${encodeURIComponent(fileName)}`)).json();
    const delivery = list.deliveries.find((d: { shortCode: string }) => d.shortCode === code);
    expect(delivery).toBeTruthy();
    const detail = await (await ownerPage.request.get(`/api/deliveries/${delivery.id}`)).json();
    const person = detail.delivery.recipients.find((r: { label: string }) => r.label === recipient.username);
    expect((await ownerPage.request.delete(`/api/deliveries/${delivery.id}/recipients/${person.id}`)).ok()).toBeTruthy();

    // No reload: the open page is told
    await expect(visitorPage.getByRole('heading', { name: 'Your access was removed' })).toBeVisible();
    await expect(visitorPage.getByRole('heading', { level: 1, name: fileName })).toHaveCount(0);

    // And stays that way
    await visitorPage.reload();
    await expect(visitorPage.getByRole('heading', { name: 'Your access was removed' })).toBeVisible();
});
