import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { RUN_ID, signInAsAdmin } from './helpers';

// The owner's Deliveries screens (components/product/deliveries): compose, Sent panel, detail, remove access,
// and the "Which should I use?" helper. API behaviour itself is covered in deliveries.spec.ts.
test.describe.configure({ mode: 'serial' });

const codeEmail = `ui-code-${RUN_ID}@example.test`;
const pwUser = `ui-pw-${RUN_ID}`;

let ipCounter = 0;
const ip = () => ({ 'x-forwarded-for': `10.252.${++ipCounter % 250}.${Math.floor(Math.random() * 250) + 1}` });

async function outbox(api: APIRequestContext, to: string) {
    const res = await api.get(`/api/test-support/emails?to=${encodeURIComponent(to)}`);
    expect(res.ok()).toBeTruthy();
    return (await res.json()).emails as { subject: string; text: string }[];
}

/** The text of a CopyField, found by its accessible name. */
const copyFieldValue = (page: Page, label: string) => page.locator(`[aria-label="${label}"]`).filter({ visible: true }).first();

test('create a delivery with an email-code and a password recipient, then remove access', async ({ page, request }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/deliveries/new');
    await expect(page.getByRole('heading', { name: 'New delivery' })).toBeVisible();

    // Two files from the library
    await page.getByLabel('Select Q3 board deck.pdf').check();
    await page.getByLabel('Select release-notes.md').check();
    await expect(page.getByRole('list', { name: 'Files in this delivery' }).getByRole('listitem')).toHaveCount(2);
    // The title follows the first file
    await expect(page.getByLabel('Title')).toHaveValue('Q3 board deck');

    // Paste two people at once: an email (email code by default) and a username (always a password)
    await page.getByLabel('Add people').fill(`${codeEmail}, ${pwUser}`);
    await page.getByLabel('Add people').press('Enter');
    await expect(page.getByRole('radiogroup', { name: `Access method for ${codeEmail}` }).getByRole('radio', { name: 'Email code' })).toBeChecked();
    const pwMethod = page.getByRole('radiogroup', { name: `Access method for ${pwUser}` });
    await expect(pwMethod.getByRole('radio', { name: 'Password' })).toBeChecked();
    await expect(pwMethod.getByRole('radio', { name: 'Email code' })).toBeDisabled();

    const password = (await copyFieldValue(page, `Password for ${pwUser}`).textContent())!.trim();
    expect(password).toMatch(/^\w{4}-\w{4}-\w{4}$/);

    await page.getByRole('button', { name: 'Send to 2 people' }).click();

    // Sent panel: one invite emailed, the password shown (this once) with a reminder it isn't in the email
    const sent = page.getByTestId('sent-panel');
    await expect(sent.getByRole('heading', { name: 'Delivery sent to 2 people' })).toBeVisible();
    await expect(page.getByText('Delivery sent to 2 people').last()).toBeVisible();
    const rows = sent.getByTestId('sent-recipient');
    await expect(rows.filter({ hasText: codeEmail }).getByText('Invite sent')).toBeVisible();
    await expect(rows.filter({ hasText: pwUser }).getByRole('button', { name: 'Copy invite' })).toBeVisible();
    await expect(copyFieldValue(page, `Password for ${pwUser}`)).toHaveText(password);
    await expect(sent.getByText('Copy the passwords now')).toBeVisible();
    await expect(sent.getByText(/isn't in the invite/)).toBeVisible();

    const link = (await copyFieldValue(page, 'Delivery link').textContent())!.trim();
    const code = link.split('/').pop()!;
    expect(code).toMatch(/^[0-9A-Za-z]{6,}$/);

    // The invite went to the email-code person and holds no secret
    await expect.poll(async () => (await outbox(request, codeEmail)).length).toBeGreaterThan(0);
    const [invite] = await outbox(request, codeEmail);
    expect(invite.text).toContain(link);
    expect(invite.text).not.toContain(password);

    // The password person can sign in with what the Sent panel showed
    const before = await request.post(`/api/d/${code}/session`, { headers: ip(), data: { identifier: pwUser, password } });
    expect(before.status()).toBe(200);

    // Detail page lists both people; the password is never shown again
    await page.getByRole('button', { name: 'View delivery' }).click();
    await page.waitForURL(/\/admin\/deliveries\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Q3 board deck' })).toBeVisible();
    const table = page.getByRole('table', { name: 'Recipients' });
    await expect(table.getByTestId('recipient-row').filter({ hasText: codeEmail })).toContainText('Email code');
    await expect(table.getByTestId('recipient-row').filter({ hasText: pwUser })).toContainText('Password');
    await expect(page.getByText(password)).toHaveCount(0);

    // Remove access
    await page.getByRole('button', { name: `More actions for ${pwUser}` }).filter({ visible: true }).click();
    await page.getByRole('menuitem', { name: 'Remove access' }).click();
    const confirm = page.getByRole('dialog', { name: `Remove ${pwUser}'s access?` });
    await expect(confirm).toContainText('closes right away');
    await confirm.getByRole('button', { name: 'Remove access' }).click();
    await expect(page.getByText(`Removed ${pwUser}'s access`)).toBeVisible();
    await expect(table.getByTestId('recipient-row').filter({ hasText: pwUser })).toContainText('Removed');
    await expect(table.getByTestId('recipient-row').filter({ hasText: codeEmail })).toContainText('Active');

    // …and the removed person can't get back in
    const after = await request.post(`/api/d/${code}/session`, { headers: ip(), data: { identifier: pwUser, password } });
    expect(after.ok()).toBeFalsy();

    // The activity tab tells the story in sentences
    await page.getByRole('tab', { name: /Activity/ }).click();
    await expect(page.getByText(`You removed ${pwUser}'s access`)).toBeVisible();
    await expect(page.getByText(`${pwUser} opened the delivery`)).toBeVisible();
});

test('Help me choose recommends a password when there is no email address', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/deliveries/new');
    await page.getByRole('button', { name: 'Help me choose' }).click();

    const helper = page.getByRole('dialog', { name: 'Which should I use?' });
    await expect(helper.getByText("Do you know each recipient's email address?")).toBeVisible();
    await helper.getByRole('button', { name: 'No', exact: true }).click();

    const result = helper.getByTestId('access-method-result');
    await expect(result).toContainText('Use a password');
    await expect(result).toContainText("there's nowhere to send a code");
    await result.getByRole('button', { name: 'Use password' }).click();
    await expect(helper).toBeHidden();

    // Applied: new email addresses now get a password
    const person = `helper-${RUN_ID}@example.test`;
    await page.getByLabel('Add people').fill(person);
    await page.getByLabel('Add people').press('Enter');
    await expect(page.getByRole('radiogroup', { name: `Access method for ${person}` }).getByRole('radio', { name: 'Password' })).toBeChecked();

    // With an email address and email set up, and no second channel wanted, it's an email code
    await page.getByRole('button', { name: 'Help me choose' }).click();
    await helper.getByRole('button', { name: 'Yes', exact: true }).click();
    // "Can this Gatekeep send email?" is answered from the system status
    await expect(helper.getByText('From system status')).toBeVisible();
    await helper.getByRole('button', { name: 'No', exact: true }).click();
    await expect(result).toContainText('Use an email code');
});
