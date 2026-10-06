# Architecture

## Overview

```
                ┌──────────────────────────── Vercel ────────────────────────────┐
 Owner ───────▶ │  /login ─▶ /admin (files, access, analytics)                   │
                │     │            │                                             │
                │  proxy.ts (session check on /admin, /login)                    │
                │                  ▼                                             │
                │  Route Handlers /api/*  ──────────────┐                        │
 Recipient ───▶ │  /[shortCode] ─▶ /api/verify ─▶ /api/access/{stream,download}  │
                └──────────────────────────────────────┬─────────────────────────┘
                                                       ▼
                              Supabase: Postgres (RLS) · Auth · Storage · Realtime
                                                       │
                                                       ▼
                                               Resend (access emails)
```

## Directory layout

| Path | Purpose |
|---|---|
| `app/page.tsx` | Public landing page |
| `app/login` | Owner sign-in (Supabase Auth, email + password) |
| `app/(admin)/admin` | Dashboard: files, access management, analytics. Guarded by `proxy.ts` **and** the group layout |
| `app/[shortCode]` | Recipient-facing share page: server `page.tsx` 404s unknown codes, `ShareView.tsx` handles sign-in, preview and download |
| `app/api/files` | List / update / delete files, `presign` + `confirm` two-step upload, `stats` |
| `app/api/folders` | Folder CRUD and contents |
| `app/api/access` | Grant / revoke access; `stream` (SSE: live access-status updates via Supabase Realtime) and `download` (signed URL) |
| `app/api/verify` | Verifies a recipient and sets an httpOnly access cookie |
| `app/api/analytics` | Aggregated access-log data for the dashboard |
| `app/api/cron/keep-alive` | Daily Vercel Cron (`vercel.json`) that pings the database so Supabase never pauses it |
| `components/admin` | Dashboard components (FileUploader, FileList, AccessManager, AnalyticsDashboard, ShareList) |
| `components/public` | Recipient components (FilePreview) |
| `components/ui` | Design-system primitives (Button, Card, Modal, Toast, Skeleton, …) |
| `lib/supabase` | Browser, server and service-role clients + shared queries |
| `lib/utils` | Crypto, tokens, rate limiting, validation, sanitisation, logging, short codes |
| `lib/env.ts` | Validated, normalised environment configuration |
| `supabase/migrations` | Ordered SQL migrations |

## Key flows

### Upload
1. Admin selects files in `FileUploader`.
2. `POST /api/files/presign` validates type/size and returns a signed Storage upload URL + short code.
3. The browser uploads directly to Supabase Storage (no file bytes pass through Vercel functions).
4. `POST /api/files/confirm` records the file row.

### Share & access
1. Admin creates grants in `AccessManager` (`POST /api/access`): a recipient identifier (email or username) plus a password, or a **public** grant (password only). Grants can have an expiry and a download limit. Email recipients can be notified through Resend.
2. Recipient opens `/<shortCode>`. The server page returns 404 unless the code matches a live file, then the client posts identifier + password to `POST /api/verify`.
3. The password is checked against the grant's bcrypt hash. On success the server issues a random 24-hour session token (stored hashed on the grant) in an **httpOnly, SameSite=Strict** cookie `access_<shortCode>`; later visits re-verify with the cookie alone.
4. `/api/access/stream` pushes live grant-status changes (e.g. revocation) to the page over SSE.
5. `/api/access/download` re-validates the session token and grant, then returns a short-lived signed Storage URL.
6. Every attempt — allowed or denied — is written to `access_log` with a denial reason and request ID.

## Data model

| Table | Notes |
|---|---|
| `files` | Metadata, storage path, base62 `short_code`, `expires_at`, `deleted_at` (soft delete), `folder_id` |
| `folders` | Self-referencing tree, depth-limited by trigger |
| `file_access` | Grants: `user_identifier` + `identifier_type` (email/username) or `is_public`; bcrypt `password_hash`; `expires_at`, `max_downloads`/`download_count`; hashed `session_token` + `session_expires_at` |
| `access_log` | Audit trail: action, outcome, reason, IP, user agent, request ID |

All tables have RLS enabled. Admin-only operations use the service-role client on the server; it is never exposed to the browser.

## Security model

- **AuthN**: Supabase Auth for the owner; `proxy.ts` redirects unauthenticated `/admin` requests, and the admin layout re-checks server-side.
- **AuthZ**: RLS policies + server-side grant checks on every recipient request.
- **Credentials**: grant passwords are bcrypt-hashed; session tokens are random, hashed at rest and delivered as httpOnly cookies. Hashes are never returned by the API.
- **Abuse**: rate limiting on verification, access-grant and upload-presign endpoints (`lib/utils/ratelimit.ts`).
- **Headers**: CSP, HSTS, X-Frame-Options, nosniff, Referrer- and Permissions-Policy (see `next.config.ts`).
- **Input**: short codes, identifiers and names are validated and sanitised before use.
- **Types**: `lib/types.ts` mirrors the migrations so every Supabase query is fully typed; update it with each new migration.
