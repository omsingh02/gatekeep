#!/usr/bin/env node
// Turns off two-factor sign-in for an account that lost its authenticator app: removes the account's
// authenticator apps (Supabase Auth MFA factors) with the service-role key, after asking to confirm.
// The account then signs in with its password alone and can set two-factor sign-in up again.
// Usage: npm run reset-two-factor                          (reads .env.local / .env, asks for the email)
//        npm run reset-two-factor -- owner@example.com
//        printf 'owner@example.com\nyes\n' | npm run reset-two-factor
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
    process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
// Read answers line by line, like create-admin: rl.question() drops lines that arrive before it is
// called, which breaks piped input (scripts, Docker, CI). An async iterator queues them instead.
const lines = rl[Symbol.asyncIterator]();
const ask = async (question) => {
    rl.output.write(question);
    const { value = '' } = await lines.next();
    if (!process.stdin.isTTY) rl.output.write('\n'); // piped answers aren't echoed
    return value.trim();
};
const finish = (code, message) => {
    rl.close();
    if (message) (code === 0 ? console.log : console.error)(message);
    process.exit(code);
};

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function allUsers() {
    const users = [];
    for (let page = 1; ; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) return users;
    }
}

let users;
try {
    users = await allUsers();
} catch (error) {
    finish(1, `Couldn't list the accounts: ${error.message}`);
}

// Offer the owner as the default when there's exactly one (marked by create-admin or OWNER_EMAILS)
const ownerEmails = (process.env.OWNER_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const owners = users.filter((u) => u.app_metadata?.role === 'owner' || (u.email && ownerEmails.includes(u.email.toLowerCase())));
const suggested = owners.length === 1 ? owners[0].email : '';

const email = (process.argv[2] || (await ask(suggested ? `Account email [${suggested}]: ` : 'Account email: ')) || suggested).toLowerCase();
const user = users.find((u) => u.email?.toLowerCase() === email);
if (!user) finish(1, `No account with the email ${email || '(none)'}.`);

const { data: listed, error: listError } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
if (listError) finish(1, `Couldn't read ${user.email}'s two-factor sign-in: ${listError.message}`);
const factors = listed.factors ?? [];
const verified = factors.filter((f) => f.status === 'verified');
if (factors.length === 0) finish(0, `Two-factor sign-in is already off for ${user.email}. Nothing changed.`);

const apps = verified.length === 1 ? '1 authenticator app' : `${verified.length} authenticator apps`;
console.log(
    verified.length
        ? `${user.email} has two-factor sign-in on (${apps}).`
        : `${user.email} has an unfinished two-factor setup (no code was ever confirmed).`
);
const answer = await ask(`Turn off two-factor sign-in for ${user.email}? Type "yes" to continue: `);
if (answer.toLowerCase() !== 'yes') finish(1, 'Nothing changed.');

for (const factor of factors) {
    const { error } = await supabase.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
    if (error) finish(1, `Couldn't remove an authenticator app: ${error.message}. Run this again to retry.`);
}
finish(
    0,
    `Two-factor sign-in is off for ${user.email}. Sign in with the password, then set it up again in Settings → Account.\n` +
        'If someone else might know the password, also set a new one with npm run create-admin: that signs out every device.'
);
