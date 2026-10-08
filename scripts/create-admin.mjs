#!/usr/bin/env node
// Creates (or resets the password of) the owner account that signs in at /login, and marks it
// as the owner (app_metadata.role = "owner"); only the owner can use the dashboard.
// Usage: npm run create-admin            (reads .env.local / .env)
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
// Read answers line by line. rl.question() drops lines that arrive before it is called,
// which breaks piped input (scripts, Docker, CI) — an async iterator queues them instead.
const lines = rl[Symbol.asyncIterator]();
let muted = false;
rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); }; // hide typed password characters
const ask = async (question, hidden = false) => {
    rl.output.write(question);
    muted = hidden;
    const { value = '' } = await lines.next();
    muted = false;
    if (hidden) rl.output.write('\n');
    return value.trim();
};

const email = await ask('Admin email: ');
const password = await ask('Password (min 8 chars): ', true);
rl.close();

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
    console.error('Enter a valid email and a password of at least 8 characters.');
    process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'owner' },
});

if (!error) {
    console.log(`Created owner ${created.user.email}. Sign in at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`);
    process.exit(0);
}

if (!/already (been )?registered|already exists/i.test(error.message)) {
    console.error(`Failed: ${error.message}`);
    process.exit(1);
}

// Existing user: reset their password instead
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (listError || !existing) {
    console.error(`User exists but could not be updated: ${listError?.message ?? 'not found'}`);
    process.exit(1);
}
const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    app_metadata: { ...existing.app_metadata, role: 'owner' },
});
if (updateError) {
    console.error(`Failed to reset password: ${updateError.message}`);
    process.exit(1);
}
console.log(`Updated password for ${email} and marked it as the owner.`);
