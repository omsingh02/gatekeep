import { expect, test } from '@playwright/test';
import { DEMO, SIGN_IN_HEADING, newVisitor, unlock } from './helpers';

test('landing, sign-in and health respond', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gatekeep/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Share files with');

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
