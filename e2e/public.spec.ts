import { expect, test } from '@playwright/test';
import { DEMO, newVisitor, unlock } from './helpers';

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

test('unknown and malformed share links return 404', async ({ page }) => {
    for (const path of ['/zzzzzz', '/ab.cd']) {
        const response = await page.goto(path);
        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: /doesn.t lead anywhere/ })).toBeVisible();
    }
});

test('a wrong password is rejected', async ({ browser, baseURL }) => {
    const visitor = await newVisitor(browser, baseURL!);
    const page = await visitor.newPage();
    await page.goto(`/${DEMO.share.code}`);
    await unlock(page, DEMO.share.recipient, 'definitely-not-the-password');
    await expect(page.getByRole('alert').filter({ hasText: "That email, username or password doesn't match." })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This file is protected' })).toBeVisible();
    await visitor.close();
});
