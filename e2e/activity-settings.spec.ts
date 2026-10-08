import { readFileSync } from 'node:fs';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { DEMO, RUN_ID, signInAsAdmin } from './helpers';
import { localSupabaseEnv } from './supabase-env';

// Owner screens: the Activity feed, Settings, and the password flows (change, forgot → reset).
// Tests that change the demo password put it back in afterAll, whatever happens.
test.describe.configure({ mode: 'serial' });

const supabaseEnv = localSupabaseEnv();
const admin = createClient(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL, supabaseEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

let ipCounter = 0;
const ip = () => ({ 'x-forwarded-for': `10.252.${++ipCounter % 250}.${Math.floor(Math.random() * 250) + 1}` });

async function demoUserId(): Promise<string> {
    const result = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (result.error) throw result.error;
    const users: { id: string; email?: string }[] = result.data.users;
    const user = users.find((u) => u.email === DEMO.admin.email);
    if (!user) throw new Error('The demo owner is missing. Run npm run seed:demo.');
    return user.id;
}

async function passwordWorks(password: string): Promise<boolean> {
    const client = createClient(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL, supabaseEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: DEMO.admin.email, password });
    return !error;
}

async function outbox(api: APIRequestContext, to: string) {
    const res = await api.get(`/api/test-support/emails?to=${encodeURIComponent(to)}`);
    expect(res.ok()).toBeTruthy();
    return (await res.json()).emails as { subject: string; text: string }[];
}

test.afterAll(async () => {
    // Leave the demo owner as the seed made it, for the other specs and for people trying the demo
    await admin.auth.admin.updateUserById(await demoUserId(), { password: DEMO.admin.password });
    await admin
        .from('owner_settings')
        .update({ display_name: 'Avery Stone', organization: 'Northwind Studio', default_download_limit: null, notify_downloaded: false })
        .eq('owner_id', await demoUserId());
});

test.describe('activity', () => {
    test('filters the feed by event and period, and exports what is shown as CSV', async ({ page }) => {
        await signInAsAdmin(page);
        await page.goto('/admin/activity');
        await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
        const rows = page.getByTestId('activity-row');
        await expect(rows.first()).toBeVisible();

        // Period totals come from the database, not from the loaded page of events
        const totals = page.getByRole('region', { name: 'Totals for this period' });
        await expect(totals.getByText('Opens')).toBeVisible();
        await expect(totals.getByText('Denied')).toBeVisible();

        // Event filter: only denied attempts, each with a human reason
        await page.getByLabel('Event').selectOption({ label: 'Denied' });
        await expect(page).toHaveURL(/event=denied/);
        await expect(rows.first()).toBeVisible();
        const types = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-type')));
        expect(new Set(types)).toEqual(new Set(['denied']));
        await expect(rows.first()).toContainText('was denied on');

        // A row expands to its receipt details
        await rows.first().getByRole('button').first().click();
        await expect(rows.first().getByText('IP address')).toBeVisible();
        await expect(rows.first().getByText('Request ID')).toBeVisible();

        // Period: All time keeps the filter and is reflected in the URL
        await page.getByRole('radio', { name: 'All time' }).click();
        await expect(page).toHaveURL(/range=all/);
        await expect(page).toHaveURL(/event=denied/);
        await expect(rows.first()).toBeVisible();

        // Export CSV downloads the same filtered feed
        const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
        expect(download.suggestedFilename()).toMatch(/^gatekeep-activity-\d{4}-\d{2}-\d{2}\.csv$/);
        const csv = readFileSync((await download.path())!, 'utf8');
        const lines = csv.trim().split('\r\n');
        expect(lines[0]).toBe('Time (UTC),Event,Reason,Person,Delivery,File,IP address,Browser,Request ID');
        expect(lines.length).toBeGreaterThan(1);
        for (const line of lines.slice(1)) expect(line.split(',')[1]).toBe('Denied');

        // Clearing the filters brings every event back
        await page.getByRole('button', { name: 'Clear filters' }).click();
        await expect(page).toHaveURL(/\/admin\/activity$/);
    });
});

test.describe('settings', () => {
    test('profile saves, and recipients see the new name', async ({ page, playwright, baseURL }) => {
        await signInAsAdmin(page);
        await page.goto('/admin/settings');
        await expect(page).toHaveURL(/\/admin\/settings\/profile$/);

        const name = `Jordan Lee ${RUN_ID}`;
        await page.getByLabel('Your name').fill(name);
        await page.getByLabel('Organization').fill('Acme Legal');
        await expect(page.getByTestId('sender-preview')).toHaveText(`${name} from Acme Legal`);

        // Unsaved changes aren't lost by switching sections
        await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Branding' }).first().click();
        await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
        await page.getByRole('button', { name: 'Keep editing' }).click();
        await expect(page).toHaveURL(/\/profile$/);

        await page.getByRole('button', { name: 'Save profile' }).click();
        await expect(page.getByText('Profile saved')).toBeVisible();

        await page.reload();
        await expect(page.getByLabel('Your name')).toHaveValue(name);

        // The recipient-facing delivery view (no session) names the sender from these settings
        const visitor = await playwright.request.newContext({ baseURL });
        const res = await visitor.get(`/api/d/${DEMO.share.code}`);
        expect(res.ok()).toBeTruthy();
        const view = await res.json();
        expect(view.sender.name).toBe(name);
        expect(view.sender.label).toBe(`${name} from Acme Legal`);
        await visitor.dispose();
    });

    test('sharing defaults and notifications round-trip', async ({ page }) => {
        await signInAsAdmin(page);
        await page.goto('/admin/settings/sharing');
        await page.getByLabel('Download limit').fill('5');
        await page.getByRole('button', { name: 'Save defaults' }).click();
        await expect(page.getByText('Sharing defaults saved')).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Download limit')).toHaveValue('5');

        await page.goto('/admin/settings/notifications');
        await expect(page.getByText(`Sent to ${DEMO.admin.email}`)).toBeVisible();
        const downloads = page.getByRole('switch', { name: 'Someone downloads a file' });
        await expect(downloads).toHaveAttribute('aria-checked', 'false');
        await downloads.click();
        await expect(page.getByText("We'll email you about every download")).toBeVisible();
        const settings = (await (await page.request.get('/api/settings')).json()).settings;
        expect(settings.notifyDownloaded).toBe(true);
        expect(settings.defaultDownloadLimit).toBe(5);
    });

    test('system status lists every check', async ({ page }) => {
        await signInAsAdmin(page);
        await page.goto('/admin/settings/status');
        await expect(page.getByTestId('status-row')).toHaveCount(7);
        await expect(page.getByText('Email is set up')).toBeVisible();
        await expect(page.getByText('Daily job is set up')).toBeVisible();
    });
});

test.describe('password', () => {
    test('change password checks the current one, then works for sign-in', async ({ page }) => {
        const next = `Changed-${RUN_ID}-pass`;
        await signInAsAdmin(page);
        await page.goto('/admin/settings/account');
        await expect(page.getByLabel('Email')).toHaveValue(DEMO.admin.email);

        await page.getByLabel('Current password').fill('not-the-password');
        await page.getByLabel('New password', { exact: true }).fill(next);
        await page.getByLabel('Confirm new password').fill(next);
        await page.getByRole('button', { name: 'Change password' }).click();
        await expect(page.getByText("Your current password isn't right.")).toBeVisible();

        await page.getByLabel('Current password').fill(DEMO.admin.password);
        await page.getByRole('button', { name: 'Change password' }).click();
        await expect(page.getByText('Password changed. Other browsers and devices are signed out.')).toBeVisible();
        await expect(page.getByLabel('Current password')).toHaveValue('');

        expect(await passwordWorks(next)).toBe(true);
        expect(await passwordWorks(DEMO.admin.password)).toBe(false);

        // Put the demo password back through the same API
        const res = await page.request.post('/api/account/password', { data: { currentPassword: next, newPassword: DEMO.admin.password } });
        expect(res.ok()).toBeTruthy();
    });

    test('forgot password → reset link → new password', async ({ page, request }) => {
        const next = `Reset-${RUN_ID}-pass`;

        // The answer never says whether the email belongs to the owner
        const [owner, stranger] = await Promise.all([
            request.post('/api/account/forgot-password', { headers: ip(), data: { email: DEMO.admin.email } }),
            request.post('/api/account/forgot-password', { headers: ip(), data: { email: `nobody-${RUN_ID}@example.test` } }),
        ]);
        expect((await owner.json()).message).toBe((await stranger.json()).message);

        await page.goto('/login');
        await page.getByLabel('Email').fill(DEMO.admin.email);
        await page.getByRole('link', { name: 'Forgot password?' }).click();
        await expect(page).toHaveURL(/\/forgot-password\?email=/);
        await expect(page.getByLabel('Email')).toHaveValue(DEMO.admin.email);

        const before = (await outbox(request, DEMO.admin.email)).length;
        await page.getByRole('button', { name: 'Send reset link' }).click();
        await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

        // The email is sent after the response: wait for it
        let link: string | undefined;
        for (let i = 0; i < 40 && !link; i++) {
            const emails = (await outbox(request, DEMO.admin.email)).slice(before);
            link = emails
                .filter((e) => /Reset your Gatekeep password/.test(e.subject))
                .map((e) => e.text.match(/https?:\/\/\S+\/reset-password\?\S+/)?.[0])
                .find(Boolean);
            if (!link) await page.waitForTimeout(250);
        }
        expect(link, 'reset email').toBeTruthy();
        link = link!.replace(/[).,]+$/, '');

        await page.goto(link);
        await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
        await expect(page).toHaveURL(/\/reset-password$/); // the one-time token is removed from the address bar

        await page.getByLabel('New password', { exact: true }).fill('short');
        await page.getByRole('button', { name: 'Set new password' }).click();
        await expect(page.getByText('Use at least 10 characters.', { exact: true })).toBeVisible();

        await page.getByLabel('New password', { exact: true }).fill(next);
        await page.getByLabel('Confirm new password').fill(next);
        await page.getByRole('button', { name: 'Set new password' }).click();
        await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
        await page.getByRole('button', { name: 'Go to the dashboard' }).click();
        await page.waitForURL('**/admin');
        expect(await passwordWorks(next)).toBe(true);

        // A used link explains itself and offers a new one
        await page.goto(link);
        await expect(page.getByRole('heading', { name: "This reset link doesn't work anymore" })).toBeVisible();
        await page.getByRole('button', { name: 'Send a new link' }).click();
        await expect(page).toHaveURL(/\/forgot-password$/);
    });

    test('auth pages are reachable signed out', async ({ page }) => {
        for (const path of ['/forgot-password', '/reset-password']) {
            const res = await page.goto(path);
            expect(res?.status()).toBe(200);
            await expect(page).toHaveURL(new RegExp(`${path}$`));
        }
        await expect(page.getByRole('heading', { name: "This reset link doesn't work anymore" })).toBeVisible();
    });
});
