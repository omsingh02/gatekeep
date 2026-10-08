import { expect, test } from '@playwright/test';
import { DEMO, SIGN_IN_HEADING, newVisitor, signInAsAdmin, unlock } from './helpers';

test('landing, sign-in and health respond', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gatekeep/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Secure file delivery with receipts.');
    await expect(page.getByRole('link', { name: 'Deploy your own' }).first()).toHaveAttribute('href', /vercel\.com\/new\/clone/);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to Gatekeep' })).toBeVisible();

    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', database: 'up' });
});

test('the dashboard requires signing in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
});

test('unknown and malformed delivery links return 404', async ({ page }) => {
    for (const path of ['/zzzzzz', '/ab.cd']) {
        const response = await page.goto(path);
        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: /doesn.t lead anywhere/ })).toBeVisible();
        await expect(page.getByText('Check you copied all of it, or ask the person who sent it.')).toBeVisible();
    }
});

test('a v1 link opens the delivery page with the sender, never the file, before signing in', async ({ browser, baseURL }) => {
    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    await page.goto(`/${DEMO.share.code}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Avery Stone sent you files' })).toBeVisible();
    await expect(page.getByText('Northwind Studio', { exact: true })).toBeVisible();
    await expect(page.getByText('hero-shot.png')).toHaveCount(0);
    for (const word of ['admin', 'owner', 'instance', 'grant', 'session']) {
        expect((await page.locator('body').innerText()).toLowerCase()).not.toContain(word);
    }
    await visitor.close();
});

test('a wrong password is rejected', async ({ browser, baseURL }) => {
    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    await page.goto(`/${DEMO.share.code}`);
    await unlock(page, DEMO.share.recipient, 'definitely-not-the-password');
    await expect(page.getByRole('alert').filter({ hasText: "That email, username or password doesn't match." })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: SIGN_IN_HEADING })).toBeVisible();

    // The right password opens it
    await page.getByLabel('Password', { exact: true }).fill(DEMO.share.password);
    await page.getByRole('button', { name: 'Unlock delivery' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'hero-shot.png' })).toBeVisible();
    await visitor.close();
});

test('the product page answers "email code or password?" in a few questions', async ({ page }) => {
    await page.goto('/');
    const helper = page.locator('#access').getByRole('region', { name: 'Which should I use?' });

    // Knows the email, can send email, no second channel: email code
    await helper.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(helper.getByText('Can your Gatekeep send email?')).toBeVisible();
    await helper.getByRole('button', { name: 'Yes', exact: true }).click();
    await helper.getByRole('button', { name: 'No', exact: true }).click();
    await expect(helper.getByTestId('access-method-result')).toContainText('Use an email code');
    await expect(helper.getByRole('link', { name: 'How email codes work' })).toHaveAttribute('href', /ACCESS-METHODS\.md#email-code-recommended$/);

    // No email address: a password, after one question
    await helper.getByRole('button', { name: 'Start over' }).click();
    await helper.getByRole('button', { name: 'No', exact: true }).click();
    await expect(helper.getByTestId('access-method-result')).toContainText('Use a password');
    await expect(helper.getByRole('link', { name: 'How passwords work' })).toBeVisible();

    // The FAQ entry opens the same helper in a dialog
    await page.locator('#faq summary', { hasText: 'Email code or password?' }).click();
    await page.locator('#faq').getByRole('button', { name: 'Help me choose' }).click();
    await expect(page.getByRole('dialog', { name: 'Which should I use?' })).toBeVisible();
});

test('the homepage is the product page or the branded welcome, as set in Settings', async ({ page, browser, baseURL }) => {
    await signInAsAdmin(page);
    const reset = () => page.request.patch('/api/settings', { data: { homepage: 'landing' } });
    try {
        const named = await page.request.patch('/api/settings', { data: { displayName: 'Avery Stone', organization: 'Northwind Studio' } });
        expect(named.ok()).toBeTruthy();

        await page.goto('/admin/settings/branding');
        await page.getByRole('radio', { name: 'Branded welcome' }).check();
        await page.getByRole('button', { name: 'Save homepage' }).click();
        await expect(page.getByText('Homepage saved')).toBeVisible();

        const visitor = await newVisitor(browser, baseURL!);
        const home = await visitor.newPage();
        await home.goto('/');
        await expect(home.getByRole('heading', { level: 1, name: 'Northwind Studio' })).toBeVisible();
        await expect(home.getByText('Files from Northwind Studio are delivered securely through this site. Use the link you were sent.')).toBeVisible();
        await expect(home.getByRole('link', { name: 'Sign in to send files' })).toHaveAttribute('href', '/login');
        await expect(home.getByText('Sent with Gatekeep')).toBeVisible();
        await expect(home.getByRole('link', { name: 'Deploy your own' })).toHaveCount(0);
        expect(await home.locator('body').innerText()).not.toContain(DEMO.admin.email);

        await page.reload();
        await page.getByRole('radio', { name: 'Product page' }).check();
        await page.getByRole('button', { name: 'Save homepage' }).click();
        await expect(page.getByText('Homepage saved')).toBeVisible();

        await home.reload();
        await expect(home.getByRole('heading', { level: 1 })).toContainText('Secure file delivery with receipts.');
        await visitor.close();
    } finally {
        await reset();
    }
});
