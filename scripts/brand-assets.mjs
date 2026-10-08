#!/usr/bin/env node
// Regenerates every Gatekeep Mono brand asset (logo, icons, Open Graph cards, README banners,
// email logo) from the glyph in components/ds/Logo.tsx. Monochrome only (docs/DESIGN.md).
// Usage: node scripts/brand-assets.mjs   (needs Chromium: CHROMIUM_PATH, default /usr/bin/chromium)
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const GLYPH = 'M17.5 31a14.5 14.5 0 0 1 29 0v20a2 2 0 0 1-2 2h-25a2 2 0 0 1-2-2zM29.75 37.4a5.6 5.6 0 1 1 4.5 0L36 45.5h-8z';
const GLYPH_TRANSFORM = 'translate(32 32.5) scale(1.15) translate(-32 -34.75)';
const INK = '#1a1a1a';
const PAPER = '#f5f5f5';

/** The mark as SVG. `fullBleed` drops the rounded corners (apple-touch-icon is masked by iOS). */
function markSvg({ tile = PAPER, glyph = INK, fullBleed = false, size } = {}) {
    const dims = size ? ` width="${size}" height="${size}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dims} role="img" aria-label="Gatekeep"><rect width="64" height="64" rx="${fullBleed ? 0 : 14}" fill="${tile}"/><path fill="${glyph}" fill-rule="evenodd" d="${GLYPH}" transform="${GLYPH_TRANSFORM}"/></svg>`;
}

// 1. Static SVGs
writeFileSync('public/brand/logo-mark.svg', markSvg() + '\n');
writeFileSync('app/icon.svg', markSvg() + '\n');

const page = (body, { bg = INK } = {}) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:${bg};font-family:'Inter Variable',Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:${PAPER}}
  .mono{font-family:'JetBrains Mono','JetBrainsMono Nerd Font Mono',ui-monospace,monospace}
</style></head><body>${body}</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });

async function render(path, html, width, height, { transparent = false, scale = 1 } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path, omitBackground: transparent });
    await ctx.close();
    console.log(`  ${path}`);
}

const centered = (svg) => `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${svg}</div>`;

// 2. Raster icons
await render('public/brand/logo-mark-512.png', page(centered(markSvg({ size: 512 })), { bg: 'transparent' }), 512, 512, { transparent: true });
await render('app/apple-icon.png', page(centered(markSvg({ size: 180, fullBleed: true }))), 180, 180);
// Email logo: dark tile + white glyph for light email clients (64px at 2x)
await render('public/brand/logo-mark-email.png', page(centered(markSvg({ tile: INK, glyph: '#ffffff', size: 128 })), { bg: 'transparent' }), 128, 128, { transparent: true });
for (const s of [16, 32, 48]) {
    await render(`/tmp/gk-favicon-${s}.png`, page(centered(markSvg({ size: s })), { bg: 'transparent' }), s, s, { transparent: true });
}
execFileSync('python3', [
    '-c',
    "from PIL import Image; ims=[Image.open(f'/tmp/gk-favicon-{s}.png').convert('RGBA') for s in (16,32,48)]; ims[2].save('app/favicon.ico', sizes=[(16,16),(32,32),(48,48)], append_images=ims[:2])",
]);
console.log('  app/favicon.ico');

// 3. Social cards: flat ink canvas, mono logo, headline, one line of subtext, a flat receipt card
function card(width, height) {
    const pad = Math.round(width * 0.06);
    const rows = [
        ['maya@acme.co', 'Opened', '2 min ago', '#4ade80'],
        ['j.chen', 'Downloaded 2 of 3', '1 hour ago', '#4ade80'],
        ['unknown', 'Denied · wrong password', '3 hours ago', '#f87171'],
    ]
        .map(
            ([who, what, when, dot]) => `
        <div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-top:1px solid #333">
          <span style="width:8px;height:8px;border-radius:999px;background:${dot};flex:none"></span>
          <span class="mono" style="font-size:17px;color:#e0e0e0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${who}</span>
          <span style="font-size:16px;color:#a3a3a3;white-space:nowrap">${what}</span>
          <span style="font-size:15px;color:#737373;white-space:nowrap;width:88px;text-align:right">${when}</span>
        </div>`
        )
        .join('');
    return page(`
    <div style="width:${width}px;height:${height}px;padding:${pad}px;display:flex;flex-direction:column;justify-content:space-between;background:${INK}">
      <div style="display:flex;align-items:center;gap:16px">
        ${markSvg({ size: 52 })}
        <span style="font-size:34px;font-weight:600;letter-spacing:-0.02em">Gatekeep</span>
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:48px">
        <div style="max-width:${Math.round(width * 0.42)}px">
          <h1 style="font-size:${Math.round(width * 0.052)}px;line-height:1.08;font-weight:600;letter-spacing:-0.025em;color:${PAPER}">Secure file delivery with receipts.</h1>
          <p style="margin-top:22px;font-size:${Math.round(width * 0.018)}px;line-height:1.4;color:#a3a3a3;white-space:nowrap">Send it. See who opened it. Take it back.</p>
        </div>
        <div style="width:${Math.round(width * 0.46)}px;flex:none;border:1px solid #3a3a3a;border-radius:10px;background:#212121;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px">
            <span style="font-size:18px;font-weight:600;color:${PAPER}">Q3 board pack</span>
            <span style="font-size:14px;color:#a3a3a3;border:1px solid #3a3a3a;border-radius:5px;padding:3px 8px">Activity</span>
          </div>
          ${rows}
        </div>
      </div>
      <div style="display:flex;gap:10px;font-size:16px;color:#a3a3a3">
        <span style="border:1px solid #3a3a3a;border-radius:6px;padding:6px 12px">Open source · MIT</span>
        <span style="border:1px solid #3a3a3a;border-radius:6px;padding:6px 12px">Self-hosted · Next.js + Supabase</span>
      </div>
    </div>`);
}
await render('app/opengraph-image.png', card(1200, 630), 1200, 630);
await render('app/twitter-image.png', card(1200, 630), 1200, 630);
await render('.github/social-preview.png', card(1280, 640), 1280, 640);

// 4. README banners (transparent, for GitHub dark and light themes)
function banner(dark) {
    const text = dark ? PAPER : INK;
    const sub = dark ? '#a3a3a3' : '#525252';
    const mark = dark ? markSvg({ size: 96 }) : markSvg({ tile: INK, glyph: '#ffffff', size: 96 });
    return page(
        `<div style="width:1280px;height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px">
          <div style="display:flex;align-items:center;gap:28px">${mark}<span style="font-size:84px;font-weight:600;letter-spacing:-0.03em;color:${text}">Gatekeep</span></div>
          <p style="font-size:28px;color:${sub}">Secure file delivery with receipts.</p>
        </div>`,
        { bg: 'transparent' }
    );
}
await render('public/brand/readme-banner-dark.png', banner(true), 1280, 320, { transparent: true });
await render('public/brand/readme-banner-light.png', banner(false), 1280, 320, { transparent: true });

await browser.close();
