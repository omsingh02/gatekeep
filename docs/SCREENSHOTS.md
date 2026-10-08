# Demo environment & screenshots

The screenshots in the README and on the landing page come from a **local** Supabase seeded with fictional
data (Northwind, Acme, …). Nothing touches a real project, and every run produces the same-looking images.

## Prerequisites

- Docker (running) and Node 20.9+
- Chromium or Chrome — set `CHROMIUM_PATH` if it isn't at `/usr/bin/chromium`
  (e.g. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS)

## 1. Start a local Supabase

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,postgres-meta,supavisor
```

This applies every migration in `supabase/migrations/` (tables, RLS, the `files` bucket). The first run pulls
Docker images and can take a while. `npx supabase status -o env` prints the local URL and keys — they are
the CLI's well-known development keys, not secrets.

## 2. Seed demo data

```bash
npm run seed:demo
```

Creates the owner **demo@gatekeep.dev / gatekeep-demo** (shown to recipients as Avery Stone from Northwind Studio),
six folders, 13 files (a generated product shot, a PDF and release notes are real content; the rest are placeholders
with realistic sizes) and ~220 events over the last 30 days. The data is seeded in the v1 shape and converted by the
same v1 → v2 migration real instances go through, so every v1 link becomes a delivery with the same code. It refuses
to run against a non-local Supabase unless you pass `-- --force`, and it is safe to re-run: the demo owner and
everything they own is recreated.

To click around yourself, run `npm run dev` with the local env (see `.env.demo.example`) and open
`http://localhost:3000/aB3xY9` — recipient **maya@northwind.example / northwind-preview**.

## 3. Capture screenshots

```bash
npm run screenshots
```

Builds the app against the local Supabase, starts it on port 3302 with the in-memory email transport
(`EMAIL_TRANSPORT=memory`, `E2E_TEST_SUPPORT=1`), signs in as the demo owner and first adds to the demo, through the
same API the dashboard uses:

- a Northwind Studio logo (Settings → Branding);
- **Q3 board pack** (3 files, 4 people: three email codes and one password, ends in 14 days, 5 downloads each) and
  **Brand refresh — final assets** (3 files, 2 people with email codes);
- **Signed SOW — Northwind**, created in the New delivery screen itself (one email code, one password);
- receipts: recipients request codes (read back from the in-memory outbox), open the deliveries, preview, download
  and Download all, with one wrong code and one wrong password along the way.

Then it writes retina PNGs (2x, dark mode) to `public/screenshots/`. Links show `https://files.northwind.example`
instead of localhost (set `SCREENSHOT_URL` to change it).

| File | Size | Shows |
|---|---|---|
| `overview.png` | 1440×900 | Overview: stats, recent deliveries, and the start of recent activity and recent files |
| `files.png` | 1440×900 | Files: folders and files under All files |
| `new-delivery.png` | 1440×900 | New delivery, filled in: a file, an email-code and a password recipient, review panel |
| `sent.png` | 1440×900 | The Sent panel right after sending: link, invite sent, the password shown once |
| `delivery.png` | 1440×820 | Delivery detail of Q3 board pack: its status, stats and recipients with status, last opened, downloads |
| `activity.png` | 1440×900 | Activity: totals and the feed (opened, code sent, downloaded all, denied with reason and IP) |
| `settings.png` | 1440×900 | Settings → Branding: logo, message to recipients and its preview |
| `recipient-sign-in.png` | 800×600 | Recipient sign-in on the code step, after entering their email |
| `recipient-delivery.png` | 800×600 | The recipient's delivery page: files, Preview, Download, Download all |

Run it right after `npm run seed:demo`: the demo deliveries are added once, and a second run reuses them but adds
another "Signed SOW — Northwind".

Options: `--no-build` reuses an app already running at `NEXT_PUBLIC_APP_URL` (it must run with
`EMAIL_TRANSPORT=memory` and `E2E_TEST_SUPPORT=1`); `--only=delivery,activity` re-captures just those images.
PNGs are losslessly recompressed with `optipng` when it is installed.

The screenshot browser bypasses the app's Content-Security-Policy, which only allows `https://*.supabase.co`
and so blocks the plain-http local Supabase. Production is unaffected.

## 4. Stop

```bash
npx supabase stop
```
