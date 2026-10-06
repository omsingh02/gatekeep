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
| `app/[shortCode]` | Recipient-facing share page: verification + preview + download |
| `app/api/files` | List / update / delete files, `presign` + `confirm` two-step upload, `stats` |
| `app/api/folders` | Folder CRUD and contents |
| `app/api/access` | Grant / revoke access; `stream` (SSE: live access-status updates via Supabase Realtime) and `download` (signed URL) |
| `app/api/verify` | Verifies a recipient and sets an httpOnly access cookie |
| `app/api/analytics` | Aggregated access-log data for the dashboard |
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
1. Admin grants access to one or more emails in `AccessManager` (`POST /api/access`), optionally with an expiry. An email is sent through Resend if configured.
2. Recipient opens `/<shortCode>` and submits their email to `POST /api/verify`.
3. On success the server issues a random session token (stored hashed on the grant) in an **httpOnly** cookie `access_<shortCode>`.
4. `/api/access/stream` pushes live grant-status changes (e.g. revocation) to the page over SSE.
5. `/api/access/download` re-validates the session token and grant, then returns a short-lived signed Storage URL.
6. Every attempt — allowed or denied — is written to `access_log` with a denial reason and request ID.

## Data model

| Table | Notes |
|---|---|
| `files` | Metadata, storage path, `short_code`, `is_public`, `expires_at`, `folder_id` |
| `folders` | Self-referencing tree, depth-limited by trigger |
| `file_access` | (file, email) grants with optional expiry, hashed `session_token` + `session_expires_at` |
| `access_log` | Audit trail: action, outcome, reason, IP, user agent, request ID |

All tables have RLS enabled. Admin-only operations use the service-role client on the server; it is never exposed to the browser.

## Security model

- **AuthN**: Supabase Auth for the owner; `proxy.ts` redirects unauthenticated `/admin` requests, and the admin layout re-checks server-side.
- **AuthZ**: RLS policies + server-side grant checks on every recipient request.
- **Tokens**: random session tokens, hashed at rest, delivered as httpOnly cookies.
- **Abuse**: rate limiting on verification, access-grant and upload-presign endpoints (`lib/utils/ratelimit.ts`).
- **Headers**: CSP, HSTS, X-Frame-Options, nosniff, Referrer- and Permissions-Policy (see `next.config.ts`).
- **Input**: short codes, emails and names are validated and sanitised before use.
