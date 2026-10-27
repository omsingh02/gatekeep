import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { RUN_ID, newVisitor, outbox, signInAsAdmin, waitForEmail } from './helpers';

test.describe.configure({ mode: 'serial' });

const codeEmail = `ops-code-${RUN_ID}@example.test`;
const passwordUser = `ops-user-${RUN_ID}`;

const state: {
    ownerContext?: BrowserContext;
    owner?: APIRequestContext;
    fileIds?: string[];
} = {};

async function createDelivery(data: Record<string, unknown>) {
    const res = await state.owner!.post('/api/deliveries', { data: { sendInvites: false, ...data } });
    expect(res.status()).toBe(201);
    return res.json();
}

test.beforeAll(async ({ browser, baseURL }) => {
    state.ownerContext = await browser.newContext({ baseURL, bypassCSP: true });
    const page = await state.ownerContext.newPage();
    await signInAsAdmin(page);
    state.owner = state.ownerContext.request;
    const files = (await (await state.owner.get('/api/files?limit=50')).json()).files as { id: string }[];
    state.fileIds = files.slice(0, 2).map((f) => f.id);
    expect(state.fileIds).toHaveLength(2);
    await page.close();
});

test.afterAll(async () => {
    await state.ownerContext?.close();
});

test('new delivery composer validates common user mistakes before sending', async () => {
    const page = await state.ownerContext!.newPage();
    try {
        await page.goto('/admin/deliveries/new');
        await expect(page.getByRole('heading', { name: 'New delivery' })).toBeVisible();

        await page.getByRole('button', { name: 'Create delivery' }).click();
        await expect(page.getByText('Choose at least one file.')).toBeVisible();
        await expect(page.getByText('Add at least one person, or turn on anyone with the password.')).toBeVisible();
        await expect(page.getByText('Give the delivery a title.')).toBeVisible();

        await page.getByRole('checkbox', { name: /^Select / }).first().check();

        await page.getByLabel('Add people').fill('not-an-email@');
        await page.getByLabel('Add people').press('Enter');
        await expect(page.getByText(/isn't a valid email address/)).toBeVisible();

        await page.getByLabel('Add people').fill(passwordUser);
        await page.getByLabel('Add people').press('Enter');

        await page.getByLabel('Download limit').fill('0');
        await page.getByRole('button', { name: 'Create delivery' }).click();
        await expect(page.getByText('Enter a whole number of at least 1, or leave it empty.')).toBeVisible();

        await page.getByLabel('Download limit').fill('2');
        await page.getByRole('button', { name: 'Create delivery' }).click();
        await expect(page.getByRole('heading', { name: 'Delivery created' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'View delivery' })).toBeVisible();
    } finally {
        await page.close();
    }
});

test('recipient sign-in handles wrong inputs and recovers to a successful sign-in', async ({ browser, baseURL }) => {
    const created = await createDelivery({
        title: `Frontend mistakes ${RUN_ID}`,
        fileIds: state.fileIds,
        people: [
            { identifier: codeEmail, method: 'email_code' },
            { identifier: passwordUser, method: 'password' },
        ],
        anyone: {},
    });

    const recipients = created.recipients as { label: string; password: string | null }[];
    const linkCode = created.delivery.shortCode as string;
    const title = created.delivery.title as string;
    const anyone = recipients.find((r) => r.label === 'Anyone with the password');
    expect(anyone?.password).toBeTruthy();

    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    try {
        await page.goto(`/${linkCode}`);

        await page.getByRole('button', { name: 'Send code' }).click();
        await expect(page.getByText('Enter the email address the invite was sent to.')).toBeVisible();

        await page.getByLabel('Email').fill('wrong-email');
        await page.getByRole('button', { name: 'Send code' }).click();
        await expect(page.getByText('Enter the email address the invite was sent to.')).toBeVisible();

        const before = (await outbox(visitor.request, codeEmail)).length;
        await page.getByLabel('Email').fill(codeEmail);
        await page.getByRole('button', { name: 'Send code' }).click();
        await expect(page.getByText(`If ${codeEmail} has access, we sent a code. It expires in 10 minutes.`)).toBeVisible();
        await waitForEmail(visitor.request, codeEmail, /is your code for/, before);

        await page.getByLabel('Code').fill('12');
        await page.getByRole('button', { name: 'Open delivery' }).click();
        await expect(page.getByText('Enter the 6-digit code from the email.')).toBeVisible();

        await page.getByRole('button', { name: 'Use a different email' }).click();
        await page.getByRole('button', { name: 'I have a password' }).click();

        await page.getByRole('button', { name: 'Unlock delivery' }).click();
        await expect(page.getByText('Enter your password.')).toBeVisible();

        await page.getByLabel('Email or username').fill(passwordUser);
        await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
        await page.getByRole('button', { name: 'Unlock delivery' }).click();
        await expect(page.getByText("That email, username or password doesn't match.")).toBeVisible();

        await page.getByLabel('Email or username').fill('');
        await page.getByLabel('Password', { exact: true }).fill(anyone!.password!);
        await page.getByRole('button', { name: 'Unlock delivery' }).click();
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    } finally {
        await visitor.close();
    }
});

test('settings unsaved-change dialog supports discarding edits and navigating away', async () => {
    const page = await state.ownerContext!.newPage();
    const unsavedName = `Discard me ${RUN_ID}`;
    try {
        await page.goto('/admin/settings/profile');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

        await page.getByLabel('Your name').fill(unsavedName);
        await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Branding' }).first().click();

        const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
        await expect(confirm).toBeVisible();
        await confirm.getByRole('button', { name: 'Discard changes' }).click();
        await expect(page).toHaveURL(/\/admin\/settings\/branding$/);

        await page.goto('/admin/settings/profile');
        await expect(page.getByLabel('Your name')).not.toHaveValue(unsavedName);
    } finally {
        await page.close();
    }
});
