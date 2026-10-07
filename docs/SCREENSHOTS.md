# Demo environment & screenshots

The screenshots in the README and on the landing page come from a **local** Supabase seeded with fictional
data (Northwind, Acme, …). Nothing touches a real project, and every run produces the same images.

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

Creates the admin **demo@gatekeep.dev / gatekeep-demo**, six folders, 13 files (a generated product shot,
a PDF and release notes are real content; the rest are placeholders with realistic sizes), 16 access grants
and ~220 access-log entries over the last 30 days. It refuses to run against a non-local Supabase unless you
pass `-- --force`, and it is safe to re-run: the demo admin and everything they own is recreated.

To click around yourself, run `npm run dev` with the local env (see `.env.demo.example`) and open
`http://localhost:3000/aB3xY9` — recipient **maya@northwind.example / northwind-preview**.

## 3. Capture screenshots

```bash
npm run screenshots
```

Builds the app against the local Supabase, starts it on port 3302, signs in as the demo admin and writes
retina PNGs (1440×900 @2x, dark mode; mobile 390×844 @3x) to `public/screenshots/`:

| File | Shows |
|---|---|
| `overview.png` / `overview-full.png` | Dashboard: stats, uploader, recent uploads and shares |
| `dashboard.png` | All uploads with folders |
| `access.png` | Manage-access dialog with several recipients |
| `analytics.png` | Analytics tab |
| `share-unlock.png` / `mobile-unlock.png` | Recipient sign-in for a share link |
| `share-preview.png` / `mobile-share.png` | Unlocked image preview |

Options: `--no-build` reuses an app already running at `NEXT_PUBLIC_APP_URL`; `--only=access,analytics`
re-captures just those images. PNGs are losslessly recompressed with `optipng` when it is installed.

The screenshot browser bypasses the app's Content-Security-Policy, which only allows `https://*.supabase.co`
and so blocks the plain-http local Supabase. Production is unaffected.

## 4. Stop

```bash
npx supabase stop
```
