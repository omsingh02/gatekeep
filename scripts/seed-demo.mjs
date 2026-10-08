#!/usr/bin/env node
// Seeds a LOCAL Supabase with fictional demo data for screenshots and trying Gatekeep out.
// Usage: npm run seed:demo            (env from .env.demo / .env.local, or the shell)
//        npm run seed:demo -- --force (allow a non-local Supabase URL — this wipes the demo admin's data!)
// Re-running is safe: the demo admin and everything they own is deleted and recreated.
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

for (const file of ['.env.demo', '.env.local']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
}

// Fall back to the local stack started with `npx supabase start`
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
        const status = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const vars = Object.fromEntries([...status.matchAll(/^([A-Z_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]));
        process.env.NEXT_PUBLIC_SUPABASE_URL = vars.API_URL;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= vars.ANON_KEY;
        process.env.SUPABASE_SERVICE_ROLE_KEY ??= vars.SERVICE_ROLE_KEY;
    } catch {
        // No local stack running; the check below explains what to set
    }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!url || !serviceKey) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.demo.example).');
    process.exit(1);
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url) && !process.argv.includes('--force')) {
    console.error(`Refusing to seed ${url}: not a local Supabase. Pass --force if you really mean it.`);
    process.exit(1);
}

const DEMO_ADMIN = { email: 'demo@gatekeep.dev', password: 'gatekeep-demo' };
const DEMO_SHARE = { shortCode: 'aB3xY9', recipient: 'maya@northwind.example', password: 'northwind-preview' };

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();

// Deterministic pseudo-random numbers so every run produces the same-looking data
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (items) => items[Math.floor(rand() * items.length)];
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const shortCode = () => Array.from({ length: 6 }, () => pick([...BASE62])).join('');

// ---------------------------------------------------------------- demo assets
async function renderAssets() {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

    await page.setContent(`<!doctype html><html><body style="margin:0">
      <div style="width:1600px;height:1000px;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif;
                  background:radial-gradient(1200px 700px at 15% 10%,#6d5ef5 0%,transparent 60%),
                             radial-gradient(900px 700px at 90% 90%,#22d3ee 0%,transparent 55%),
                             linear-gradient(135deg,#0b0b1a,#141633);">
        <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:64px 64px;"></div>
        <div style="position:absolute;left:120px;top:150px;color:#fff;max-width:760px">
          <div style="font-size:22px;letter-spacing:.3em;text-transform:uppercase;opacity:.7">Northwind · Spring launch</div>
          <div style="font-size:104px;font-weight:800;line-height:1.02;margin-top:28px;letter-spacing:-.03em">Ship faster.<br/>Sleep better.</div>
          <div style="font-size:30px;opacity:.75;margin-top:36px;line-height:1.4">The all-new Northwind dashboard — live in every region on April 14.</div>
        </div>
        <div style="position:absolute;right:110px;top:190px;width:560px;height:620px;border-radius:36px;
                    background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(12px);
                    box-shadow:0 40px 120px rgba(0,0,0,.45);padding:40px;box-sizing:border-box;color:#fff">
          <div style="display:flex;gap:10px"><i style="width:14px;height:14px;border-radius:50%;background:#ff5f57"></i>
            <i style="width:14px;height:14px;border-radius:50%;background:#febc2e"></i><i style="width:14px;height:14px;border-radius:50%;background:#28c840"></i></div>
          <div style="font-size:20px;opacity:.6;margin-top:40px">Weekly active teams</div>
          <div style="font-size:72px;font-weight:800;margin-top:6px">48,210</div>
          <div style="font-size:22px;color:#5eead4;margin-top:4px">▲ 31% vs last quarter</div>
          <svg viewBox="0 0 480 200" style="margin-top:36px;width:100%">
            <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".6"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
            <path d="M0 170 C60 160 90 120 140 125 S230 80 280 90 S370 30 480 20 L480 200 L0 200Z" fill="url(#g)"/>
            <path d="M0 170 C60 160 90 120 140 125 S230 80 280 90 S370 30 480 20" fill="none" stroke="#a5f3fc" stroke-width="5"/>
          </svg>
          <div style="display:flex;gap:16px;margin-top:28px">
            ${['Uptime 99.99%', 'p95 84 ms', '12 regions'].map((t) => `<div style="flex:1;padding:14px 0;text-align:center;border-radius:14px;background:rgba(255,255,255,.08);font-size:18px">${t}</div>`).join('')}
          </div>
        </div>
      </div></body></html>`);
    const png = await page.screenshot({ type: 'png' });

    await page.setContent(`<!doctype html><html><body style="font-family:Georgia,serif;padding:56px;color:#111">
      <h1 style="font-family:Inter,system-ui,sans-serif;font-size:34px;margin:0 0 8px">Q3 Board Update</h1>
      <p style="color:#555;margin:0 0 32px;font-family:Inter,system-ui,sans-serif">Northwind Labs · Confidential · Prepared for the board of directors</p>
      <h2 style="font-family:Inter,system-ui,sans-serif">Highlights</h2>
      <ul><li>Revenue up 31% quarter over quarter.</li><li>Net revenue retention of 128%.</li><li>Spring launch on track for April 14.</li></ul>
      <h2 style="font-family:Inter,system-ui,sans-serif">Asks</h2><p>Approve the FY27 hiring plan and the EU data-residency budget.</p>
      </body></html>`);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const markdown = `# Northwind 4.2 release notes

## New
- Live dashboards with per-region drill-down
- SSO for every plan

## Fixed
- CSV exports now respect the selected time zone
- Faster cold starts (p95 84 ms)
`;
    return { png, pdf, markdown: Buffer.from(markdown) };
}

// ---------------------------------------------------------------- reset
async function resetDemoAdmin() {
    const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const existing = list.users.find((u) => u.email === DEMO_ADMIN.email);
    if (existing) {
        const { data: oldFiles } = await supabase.from('files').select('filename').eq('uploaded_by', existing.id);
        if (oldFiles?.length) await supabase.storage.from('files').remove(oldFiles.map((f) => f.filename));
        // Cascades to folders, files, grants and access logs
        const { error: deleteError } = await supabase.auth.admin.deleteUser(existing.id);
        if (deleteError) throw deleteError;
    }
    const { data, error: createError } = await supabase.auth.admin.createUser({
        email: DEMO_ADMIN.email,
        password: DEMO_ADMIN.password,
        app_metadata: { role: 'owner' },
        email_confirm: true,
    });
    if (createError) throw createError;
    return data.user.id;
}

// ---------------------------------------------------------------- seed
async function main() {
    const assets = await renderAssets();
    const adminId = await resetDemoAdmin();

    const folderIds = {};
    const folders = [
        ['Clients', null, 60], ['Acme', 'Clients', 58], ['Northwind', 'Clients', 40],
        ['Design', null, 55], ['Finance', null, 50], ['Product', null, 45],
    ];
    for (const [name, parent, ageDays] of folders) {
        const { data, error } = await supabase.from('folders').insert({
            name,
            parent_id: parent ? folderIds[parent] : null,
            uploaded_by: adminId,
            created_at: iso(ageDays * DAY),
            updated_at: iso(ageDays * DAY),
        }).select('id').single();
        if (error) throw error;
        folderIds[parent ? `${parent}/${name}` : name] = data.id;
    }

    const PDF = 'application/pdf';
    const files = [
        { name: 'hero-shot.png', folder: 'Design', mime: 'image/png', body: assets.png, ageH: 3, code: DEMO_SHARE.shortCode },
        { name: 'Q3 board deck.pdf', folder: null, mime: PDF, body: assets.pdf, size: 2_431_877, ageH: 20 },
        { name: 'release-notes.md', folder: null, mime: 'text/markdown', body: assets.markdown, size: 4_212, ageH: 30 },
        { name: 'launch-teaser.mp4', folder: null, mime: 'video/mp4', size: 48_213_504, ageH: 52 },
        { name: 'contract-acme-signed.pdf', folder: 'Clients/Acme', mime: PDF, body: assets.pdf, size: 1_284_311, ageH: 75 },
        { name: 'brand-guidelines-v4.pdf', folder: 'Design', mime: PDF, body: assets.pdf, size: 9_771_203, ageH: 98 },
        { name: 'roadmap-2027.xlsx', folder: 'Product', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 418_334, ageH: 130 },
        { name: 'acme-invoice-0423.pdf', folder: 'Clients/Acme', mime: PDF, body: assets.pdf, size: 212_448, ageH: 170 },
        { name: 'customer-interviews.mp3', folder: 'Product', mime: 'audio/mpeg', size: 23_455_120, ageH: 210 },
        { name: 'northwind-sow.docx', folder: 'Clients/Northwind', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 88_104, ageH: 260 },
        { name: 'logo-pack.zip', folder: 'Design', mime: 'application/zip', size: 31_902_215, ageH: 330 },
        { name: 'pricing-model.xlsx', folder: 'Finance', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 266_710, ageH: 400 },
        { name: 'team-offsite-photos.zip', folder: null, mime: 'application/zip', size: 86_442_901, ageH: 520 },
    ];

    const fileIds = {};
    for (const f of files) {
        const ext = f.name.split('.').pop();
        const storageName = `${now - f.ageH * HOUR}-${randomUUID()}.${ext}`;
        // Files we never preview get a few placeholder bytes; sizes shown in the UI are realistic
        const body = f.body ?? Buffer.from(`Gatekeep demo placeholder for ${f.name}\n`);
        const { error: uploadError } = await supabase.storage.from('files').upload(storageName, body, { contentType: f.mime });
        if (uploadError) throw uploadError;
        const { data, error } = await supabase.from('files').insert({
            filename: storageName,
            original_filename: f.name,
            file_path: storageName,
            file_size: f.size ?? body.length,
            mime_type: f.mime,
            short_code: f.code ?? shortCode(),
            uploaded_by: adminId,
            folder_id: f.folder ? folderIds[f.folder] : null,
            created_at: iso(f.ageH * HOUR),
            updated_at: iso(f.ageH * HOUR),
        }).select('id').single();
        if (error) throw error;
        fileIds[f.name] = data.id;
    }

    const hash = (password) => bcrypt.hashSync(password, 10);
    const grants = [
        // [file, identifier | null (public), type, password, opts]
        ['hero-shot.png', DEMO_SHARE.recipient, 'email', DEMO_SHARE.password, { access: 14, downloads: 2 }],
        ['hero-shot.png', 'jordan.lee@northwind.example', 'email', 'demo-pass-1', { access: 6, downloads: 1, expiresIn: 7 * DAY }],
        ['hero-shot.png', 'studio-wren', 'username', 'demo-pass-2', { access: 3, max: 5, downloads: 3 }],
        ['hero-shot.png', null, null, 'spring-launch', { access: 41, downloads: 9, expiresIn: 3 * DAY }],
        ['Q3 board deck.pdf', 'ava.chen@boardroom.example', 'email', 'demo-pass-3', { access: 8, max: 3, downloads: 1, expiresIn: 5 * DAY }],
        ['Q3 board deck.pdf', 'marcus.reid@boardroom.example', 'email', 'demo-pass-4', { access: 4, max: 3, downloads: 3, expiresIn: 5 * DAY }],
        ['Q3 board deck.pdf', 'lena.okafor@boardroom.example', 'email', 'demo-pass-5', { access: 2, expiresIn: -2 * DAY }],
        ['Q3 board deck.pdf', 'tomas.varga@boardroom.example', 'email', 'demo-pass-6', { access: 0, expiresIn: 5 * DAY }],
        ['contract-acme-signed.pdf', 'legal@acme.example', 'email', 'demo-pass-7', { access: 5, max: 5, downloads: 2 }],
        ['contract-acme-signed.pdf', 'procurement@acme.example', 'email', 'demo-pass-8', { access: 2, downloads: 1, expiresIn: 30 * DAY }],
        ['acme-invoice-0423.pdf', 'billing@acme.example', 'email', 'demo-pass-9', { access: 3, downloads: 1 }],
        ['launch-teaser.mp4', null, null, 'teaser', { access: 128, downloads: 37 }],
        ['brand-guidelines-v4.pdf', 'studio-wren', 'username', 'demo-pass-10', { access: 11, downloads: 4, expiresIn: 14 * DAY }],
        ['release-notes.md', null, null, 'release', { access: 63, downloads: 12 }],
        ['roadmap-2027.xlsx', 'cto@northwind.example', 'email', 'demo-pass-11', { access: 7, downloads: 2 }],
        ['northwind-sow.docx', 'ops@northwind.example', 'email', 'demo-pass-12', { access: 1, max: 1, downloads: 1 }],
    ];

    const grantRows = [];
    for (const [file, identifier, type, password, o] of grants) {
        const { data, error } = await supabase.from('file_access').insert({
            file_id: fileIds[file],
            user_identifier: identifier,
            identifier_type: identifier ? type : null,
            is_public: identifier === null,
            password_hash: hash(password),
            expires_at: o.expiresIn ? new Date(now + o.expiresIn).toISOString() : null,
            max_downloads: o.max ?? null,
            download_count: o.downloads ?? 0,
            access_count: o.access ?? 0,
            last_accessed: o.access ? iso(Math.floor(rand() * 4 * DAY) + 2 * HOUR) : null,
            notify_on_grant: type === 'email',
            created_at: iso(Math.floor(rand() * 10 * DAY) + DAY),
        }).select('id, file_id, user_identifier').single();
        if (error) throw error;
        grantRows.push({ ...data, weight: Math.max(1, o.access ?? 1) });
    }

    // ~220 audit-log entries over the last 30 days, weighted towards busy grants and recent days.
    // Denials are kept older than 2 hours so the brute-force throttle never trips during a demo.
    const agents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    ];
    const weighted = grantRows.flatMap((g) => Array(g.weight).fill(g));
    const logs = [];
    for (let i = 0; i < 220; i++) {
        const g = pick(weighted);
        const roll = rand();
        const denial = roll < 0.07 ? 'wrong_password' : roll < 0.09 ? 'expired' : roll < 0.1 ? 'download_limit' : roll < 0.11 ? 'no_access_grant' : null;
        const ageMs = Math.floor(Math.pow(rand(), 1.6) * 30 * DAY) + (denial ? 2 * HOUR : 5 * 60 * 1000);
        logs.push({
            file_id: g.file_id,
            user_identifier: g.user_identifier ?? 'public',
            access_granted: denial === null,
            denial_reason: denial,
            ip_address: `${pick(['203.0.113', '198.51.100', '192.0.2'])}.${Math.floor(rand() * 250) + 2}`,
            user_agent: pick(agents),
            request_id: randomUUID().slice(0, 8),
            accessed_at: iso(ageMs),
        });
    }
    const { error: logError } = await supabase.from('access_log').insert(logs);
    if (logError) throw logError;

    // The demo is seeded in the v1 shape on purpose: converting it exercises the same
    // v1 → v2 migration real instances go through (one delivery per v1 link, same code).
    const { error: migrateError } = await supabase.rpc('migrate_v1_to_v2');
    if (migrateError) throw migrateError;

    const { error: settingsError } = await supabase.from('owner_settings').upsert({
        owner_id: adminId,
        display_name: 'Avery Stone',
        organization: 'Northwind Studio',
        recipient_message: 'Files from Northwind Studio. Reach me at avery@northwind.example with any questions.',
    });
    if (settingsError) throw settingsError;

    const { count: deliveryCount } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', adminId);

    console.log(`Seeded ${files.length} files, ${folders.length} folders, ${grants.length} grants, ${logs.length} log entries, ${deliveryCount} deliveries.\n`);
    console.log(`Admin       ${appUrl}/login   ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
    console.log(`Share link  ${appUrl}/${DEMO_SHARE.shortCode}   ${DEMO_SHARE.recipient} / ${DEMO_SHARE.password}`);
}

main().catch((err) => {
    console.error('Seeding failed:', err.message ?? err);
    process.exit(1);
});
