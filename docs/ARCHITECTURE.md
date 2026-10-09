# Architecture

Gatekeep v2 is built around **deliveries**: one link that sends files to (or requests files from) named recipients, with a receipt for everything that happens. The product is defined in [PRODUCT.md](PRODUCT.md), and the data model is decided in [decisions/0001-deliveries.md](decisions/0001-deliveries.md).

## Overview

```
                ┌──────────────────────────────── Vercel / Docker ─────────────────────────────────┐
 Owner ───────▶ │  /login ─▶ /admin  ──▶ owner API (validateAuth: owner only)                      │
                │                         /api/deliveries · /api/activity · /api/settings ·        │
                │                         /api/account · /api/status · /api/files · /api/folders   │
                │                                                                                  │
 Recipient ───▶ │  /{code}  ──▶ recipient API /api/d/{code}/…                                      │
                │                code → session → files · download-all · uploads · stream          │
                │                                                                                  │
 Vercel Cron ─▶ │  /api/cron/keep-alive  (DB ping + daily jobs)                                    │
                └───────────────┬──────────────────────────────────────────────┬───────────────────┘
                                ▼                                              ▼
                 Supabase: Postgres (RLS) · Auth · Storage · Realtime       Resend (email)
```

## Directory layout (server)

| Path | Purpose |
|---|---|
| `app/api/deliveries` | Owner: list/create deliveries; `[id]` read/update/delete; `[id]/recipients` add, change, remove, resend invite |
| `app/api/d/[code]` | Recipient: delivery view, `code` (request an email code), `session` (sign in/out), `files/[fileId]` (preview/download URL), `download-all`, `uploads` (+ `confirm`, `complete`) for requests, `stream` (SSE for live removal) |
| `app/api/activity` | Owner: activity feed (filters, cursor pagination), `summary` (period totals and deliveries open now) and `export` (CSV) |
| `app/api/settings` | Owner settings; `logo` upload to the public `branding` bucket |
| `app/api/account` | `password` (change, confirming the current one, and a code when two-factor sign-in is on), `forgot-password` (recovery link to `/reset-password`) |
| `app/api/status` | What's set up: email, cron secret, sign-ups, storage, migrations, owner, two-factor sign-in |
| `app/api/cron/keep-alive` | Daily: DB ping, "access ending soon" emails, purge old codes, notify about pending request uploads |
| `app/api/files`, `app/api/folders` | Owner file library (upload via presign + confirm, move, rename, delete, folders); `files/[id]/url` signs a preview or download URL for the owner |
| `lib/api/http.ts` | What every API route shares: `requireOwner`, `jsonError`, `serverError`, `readJson`, `isUuid` (see [API conventions](#api-conventions)) |
| `lib/deliveries/` | The domain: link codes, sessions, email codes, activity + throttles, notifications, settings, parsing/serialization, uploads, CSV, status, daily jobs |
| `lib/files/` | The file library: `library.ts` (file and folder serializers, their types, owner-scoped loaders), `rules.ts` (name rules and their messages, shared with the dashboard) |
| `lib/email/` | `transport.ts` (Resend or in-memory for tests), `template.ts` (the one light email layout), `messages.ts` (every email) |
| `lib/auth/owner.ts` | Who the owner is (`app_metadata.role = 'owner'` or `OWNER_EMAILS`) |
| `lib/auth/twoFactor.ts` | Two-factor sign-in: whether an account has it on, the session's `aal`, `getSignedIn()` for `proxy.ts` and `validateAuth`, code wording |
| `lib/types.ts` | `Database` type mirroring the migrations; update it with every migration |

## API conventions

Every owner route follows these (`/api/deliveries`, `/api/activity`, `/api/settings`, `/api/account/password`, `/api/status`, `/api/files`, `/api/folders`). The recipient API (`/api/d/{code}/…`) uses the same error shape and helpers but signs people in per delivery.

**Auth.** A handler starts with `requireOwner(route, method)` (`lib/api/http.ts`), which is `validateAuth(await getSignedIn(supabase), …)`: the session is checked with the auth server, and an account with [two-factor sign-in](#security-model) must have entered its code in this session. Until then nothing else runs. The route then reads and writes with the service role, so each query is scoped to the owner (`uploaded_by`, `owner_id`) and skips deleted rows. `tests/files-api.test.ts` checks this for every Files and Folders handler.

**Errors** are `{ "error": "…", "code": "ERR_…" }`, nothing more, from `jsonError` and `serverError`. `error` is a sentence for people ([VOICE.md](VOICE.md)): it never names tables, columns, tokens or vendors, so clients can show it. `code` is stable: branch on the code, not the sentence. The same mistake gets the same sentence everywhere (Files and Folders keep theirs in `lib/files/rules.ts`).

| Status | Code | When |
|---|---|---|
| 400 | `ERR_INVALID_INPUT` | The body or query doesn't make sense: a missing or unusable name, nothing to change, a search over 100 characters |
| 400 | `ERR_INVALID_FILE` | A file of a type or size that can't be uploaded |
| 400 | `ERR_NOT_UPLOADED` | Confirming an upload that never reached storage |
| 400 | `ERR_MAX_DEPTH` | A folder inside a folder that is itself inside one (folders are one level deep) |
| 401 | `ERR_UNAUTHORIZED` | Not signed in |
| 403 | `ERR_FORBIDDEN` | Signed in with an account that isn't the owner |
| 403 | `ERR_TWO_FACTOR_REQUIRED` | Two-factor sign-in is on and this session has only entered the password |
| 404 | `ERR_NOT_FOUND` | It doesn't exist, was deleted or belongs to someone else: the answer is the same |
| 409 | `ERR_CONFLICT` | A folder with that name is already there (names are compared ignoring case) |
| 429 | `ERR_RATE_LIMIT` | Too many requests in a short time |
| 502 | `ERR_STORAGE`, `ERR_EMAIL_FAILED` | File storage or email didn't work; nothing was changed, try again |
| 500 | `ERR_SERVER` | Anything unexpected. Logged with `logError`; the answer is always "Something went wrong on our side. Try again in a moment." |

A few routes add codes for things a client handles specially, such as `ERR_EMAIL_NOT_CONFIGURED`, or `ERR_WRONG_PASSWORD` and `ERR_WRONG_CODE` when changing the password.

**Shapes.** JSON fields and query parameters are camelCase. A response comes from a serializer (`serializeFile`, `serializeFolder`, `serializeDeliverySummary`, …), never straight from a database row, so storage paths, owner ids and other columns stay on the server; Files and Folders also select only the columns they return. Times are ISO 8601 strings (`createdAt`, `updatedAt`), sizes are bytes. A file is `{ id, name, size, mimeType, folderId, folderName, createdAt, updatedAt }` everywhere it appears (files in a delivery are the first four); a folder is `{ id, name, parentId, createdAt, updatedAt }`, with `fileCount`, `subfolderCount` and `path` where a route says so.

**Envelopes.** One thing is wrapped in its name: `{ file }`, `{ folder }`, `{ delivery }`, `{ settings }`. A list is wrapped in the plural, with its paging fields beside it: `{ files, … }`, `{ folders }`, `{ deliveries, … }` (activity is a feed: `{ items, nextCursor }`). Creating answers 201 with the new thing; deleting answers `{ ok: true }`. `PATCH` changes only the fields it's given (`null` clears one, so `folderId: null` means All files); for a file, folder, delivery or recipient, a `PATCH` with nothing to change is 400.

**Pagination.** `limit` is 1–100 everywhere; `total` counts everything that matches.

| List | Ask with | Answer |
|---|---|---|
| Files | `page` (from 1), `limit` (default 20) | `{ files, total, page, limit, totalPages }` |
| Deliveries | `offset`, `limit` (default 50) | `{ deliveries, total, limit, offset }` |
| Activity | `cursor`, `limit` (default 50) | `{ items, nextCursor }`, `nextCursor` null at the end |

**Ids** are UUIDs. One that isn't, in the path or as a reference such as `folderId`, is treated like one that doesn't exist: 404 `ERR_NOT_FOUND`, without a database query. An input that is checked as a whole reports a bad reference as 400 `ERR_INVALID_INPUT` instead, for example a delivery's `fileIds`.

**Bodies** are JSON, read with `readJson`: an empty or malformed body counts as `{}`, so it fails the same checks as missing fields.

## Data model

| Table | What it holds |
|---|---|
| `files` | Uploaded files: storage path, name, size, type, folder, soft delete. Files that arrived through a request record `received_via_delivery_id` / `received_from_recipient_id`. `short_code` is only set on v1 files. |
| `folders` | One level of folders under **All files** |
| `deliveries` | `kind` (`send` / `request`), title, optional message, unique `short_code` (the link), owner. Requests have a target folder and optional file-count and size limits. Soft delete. |
| `delivery_files` | Files in a `send` delivery, in order |
| `delivery_recipients` | One row per person (`email` / `username`, lowercased) or one `anyone` row. `method` is `email_code` or `password` (bcrypt hash). `ends_at`, `download_limit` / `download_count`, `open_count` / `last_opened_at`, hashed session token + expiry, `removed_at` (kept for receipts). |
| `verification_codes` | Email codes: SHA-256 of `recipient:code`, 10-minute expiry, attempt count, consumed time. Service role only. |
| `activity` | Every event: `opened`, `previewed`, `downloaded`, `downloaded_all`, `denied` (+ `reason`), `code_sent`, `uploaded`, `access_given`, `access_removed`, `invite_sent`; actor, IP, user agent, request id, `notified_at`. |
| `owner_settings` | Display name and organization (shown to recipients), logo, message to recipients, sharing defaults, notification switches, homepage style (`/` is the product page or a branded welcome; with no row yet, the branded welcome) |

Every table has row-level security with owner-scoped policies. The server uses the service-role client (never sent to the browser). `gk_count_download` and `gk_count_open` are SQL functions that update counters atomically. A download is only counted while under the limit, in one statement.

## Key flows

### Sending a delivery
1. The owner uploads files to the library: `/api/files/presign` checks the type, size and folder and returns a signed upload URL, the browser uploads straight to Storage, and `/api/files/confirm` reads the real size from Storage, checks again and records the file. Files are private content with no link of their own (`short_code` stays null); only deliveries have links.
2. `POST /api/deliveries` creates the delivery with its files and recipients in one call. Each password recipient gets their **own** generated password, returned once to the owner and never emailed. Email recipients get an invite that names the sender, links to the delivery and explains how they'll get in. It contains no secret.

### Recipient sign-in
1. `GET /api/d/{code}` without a session returns only the sender's name, logo and message, plus which ways in exist. The title and files stay hidden.
2. **Email code.** `POST /api/d/{code}/code { email }` always answers "If that email has access, we've sent it a code". The lookup, the code (6 digits, 10 minutes, 5 attempts, at most 3 per 10 minutes) and the email all happen **after** the response, so neither the message nor the timing reveals who is on the delivery.
3. `POST /api/d/{code}/session` with `{ email, code }`, `{ identifier, password }` or `{ password }`:
   - **Credentials are checked first.** "Not on this delivery" and "wrong code/password" answer identically, with a dummy bcrypt check for timing.
   - **Then** the recipient's end date is checked.
   - On success it sets an httpOnly, SameSite=Strict `gk_{code}` cookie (24 hours) and records `opened`.
4. Signed in, the page lists files. `POST /api/d/{code}/files/{id}` with `action: preview | download` re-checks access and returns a signed URL (see [Signed URLs](#signed-urls)); `preview` is free, and `download` counts atomically. **Download all** counts as one download and returns per-file URLs (5 minutes, fetched one after another); the browser builds the zip.
5. `GET /api/d/{code}/stream` (SSE) watches the recipient row via Realtime, with a 30-second polling fallback. It tells an open page the moment access is removed or ends.

### Requests (receiving files)
A `request` delivery uses the same recipients and sign-in.
1. The signed-in recipient starts an upload (`/uploads`); the server checks type, size and count limits and returns a signed upload URL.
2. The browser uploads directly to Storage.
3. `/uploads/confirm` reads the real size from Storage and records the file in the owner's library, in the request's folder.
4. `/uploads/complete` sends the owner one email for the batch. The daily job catches batches that were never completed.

### Receipts and notifications
Every step writes an `activity` row (`lib/deliveries/activity.ts`). Owner emails are sent after the response, per the owner's settings:
- **Opened:** first open per person per delivery per 24 hours.
- **Downloaded:** every download; off by default.
- **Denied:** one alert once 3 denials hit a delivery within 15 minutes, then quiet for 15 minutes.
- **Uploaded:** one email per batch.

`GET /api/activity/export` streams the same feed as CSV, with formula-injection protection.

### Owner account
- **Change password:** `/api/account/password` confirms the current password with a throwaway client before updating. Supabase ends every session of the account when its password changes; the route signs the current browser back in, so only other browsers and devices are signed out. Settings → Account also offers "Sign out everywhere" (`signOut({ scope: 'global' })`).
- **Forgot password:** `/api/account/forgot-password` always answers the same way. It generates a Supabase recovery token and emails a link to `/reset-password?token_hash=…&type=recovery` in Gatekeep's template, but only if the email belongs to the owner. The page verifies the token with `verifyOtp` (it also accepts Supabase's own `#access_token` and `?code=` redirects), then sets the new password with `updateUser`. Linking to the app directly means no Supabase redirect URL has to be configured.

### Upgrade from v1
Migration `20261009000000_deliveries.sql` runs `migrate_v1_to_v2()`, which can safely run more than once:
- Every v1 file link becomes a one-file delivery with **the same code**.
- Every v1 grant becomes a password recipient; a public grant becomes "anyone".
- The v1 access log is copied into `activity`.

Sessions aren't carried over, so recipients unlock once more. A link the 1.x dashboard created after the migration ran (before 2.0 was deployed) is converted the first time someone opens it: `/{code}` and `/api/d/{code}` look for a v1 file with that code and run `migrate_v1_to_v2()` again. Only v1 files have a short code, so this never turns a 2.0 upload into a delivery. The upgrade steps are in [DEPLOYMENT.md](DEPLOYMENT.md#upgrading-from-1x-to-20).

## Security model

- **Owner only:** `validateAuth` rejects any signed-in account that isn't the owner (403). `proxy.ts` and the admin layout redirect such accounts to `/login`.
- **Two-factor sign-in** (Supabase Auth TOTP, set up in Settings → Account):
  - Supabase marks each session `aal1` (password only) or `aal2` (password and a code). An account with a verified factor needs `aal2` everywhere, checked per account, so it works for any number of accounts.
  - `getSignedIn()` (`lib/auth/twoFactor.ts`) checks the session's token with the auth server, which also returns the account's factors, and reads that token's `aal`.
  - `proxy.ts` and the admin layout send a password-only session from `/admin/**` (and `/login`) to `/login?step=code`.
  - `validateAuth` answers 403 `ERR_TWO_FACTOR_REQUIRED`. Without an `aal` it fails closed.
  - The database: migration `20261009000300` adds a RESTRICTIVE policy, *Two-factor sign-in needs the code*, to every public table the `authenticated` role can reach, and one to `storage.objects` for the `files` and `branding` buckets. Both call `private.gk_two_factor_ok()`, Supabase's documented "require `aal2` if the user has a verified factor" check. It's a SECURITY DEFINER function in a schema the API doesn't serve, because `authenticated` can't read `auth.mfa_factors`. This matters because the anon key is public: without it, the password alone could sign in with supabase-js and use the REST API. **A new public table needs the same policy:** re-run the migration, or add it in the new one.
  - The server's service-role client bypasses row-level security, so recipient flows are unaffected.
  - Setup (`app/(admin)/admin/settings/account/TwoFactorSettings.tsx`) enrolls with `mfa.enroll`, shows the QR code and setup key, and only counts as on after `challengeAndVerify`. Unfinished setups are removed before a new one, on cancel and on leaving the page.
  - Turning it off takes a fresh code (Supabase only removes a verified factor from an `aal2` session).
  - A reset link (`/reset-password`) asks for the code before the new password: Supabase refuses to change the password of such an account from an `aal1` session.
  - Changing the password in Settings takes a code too: a throwaway session signs in, enters the code and changes the password itself (ending every other session), and the browser takes that session over, so it stays `aal2`.
  - Lost phone: `npm run reset-two-factor` removes the account's factors with the service role (`auth.admin.mfa`). See [SECURITY.md](../SECURITY.md#lost-authenticator-app).
- **Recipients:** sign in per delivery with an email code or password. Sessions are random tokens, stored hashed and sent as httpOnly cookies. Codes are hashed and bound to the recipient. Nothing about a recipient's access (end date, downloads) is revealed before their credentials match.
- **No enumeration:** code requests, sign-in failures and forgot-password all answer identically whether or not the person exists.
- **Throttling:**
  - Failed guesses are counted in `activity`: 20 per IP and 100 per delivery per 15 minutes. Code requests: 10 per IP per 10 minutes.
  - An in-memory limiter adds a per-instance first line.
  - The limits hold across serverless instances because they're counted in the database.
- **Files:** a private bucket served only through short-lived [signed URLs](#signed-urls), issued after the recipient's access is re-checked. Request uploads are checked against type, size and count limits, and the size is read from Storage.
- **Database API:**
  - Every database function the app calls (counters, file deletion, the 1.x conversion) runs as `SECURITY DEFINER`. It is executable only by the service role, which only the server holds.
  - Functions are server-only by default: a new one has to be granted on purpose.
  - The `anon` role has no table access, so signed-out visitors can't reach the database API at all. The owner's session reads tables under row-level security.
  - `e2e/security.spec.ts` checks all of this with the public key, and `e2e/two-factor.spec.ts` checks two-factor sign-in at every layer (UI, proxy, owner API, REST and Storage with the public key).
- **Headers:** CSP, HSTS, X-Frame-Options, nosniff, Referrer- and Permissions-Policy (`next.config.ts`).

### Signed URLs

Files never pass through the app: the browser fetches them from Storage with a signed URL that the app issues after checking access (`lib/utils/signedUrls.ts`). Anyone holding a URL can use it until it expires, and removing someone's access can't recall a URL they already have, so lifetimes are kept as short as each use allows:

| URL | Lifetime | Why |
|---|---|---|
| Download (owner or recipient) | 60 seconds | Only has to start the download; a download in progress isn't cut off when its URL expires |
| Preview of an image, PDF, text or Office file | 60 seconds | Loaded once, straight away |
| Preview of **video or audio** | 15 minutes | Browsers fetch media in ranges while it plays and on every seek, so each of those requests needs a URL that still works |
| Download all | 5 minutes | The browser fetches the files one after another into the zip |

**The trade-off for media.** A 60-second media URL broke seeking deep into a long video after the first minute. A 15-minute URL keeps most viewing working without a round trip, at the cost of a wider window: the delivery page still closes the moment access is removed, but a media URL copied out of it keeps working for up to 15 minutes instead of one. Previews never count as downloads, but every URL issued is on the record as `previewed`. Even 15 minutes runs out during a long film, so the preview players (`components/product/ResumableMedia.tsx`, used by the recipient's preview stage and the owner's file preview) handle expiry too: when the media element fails after it had loaded, they ask for a fresh URL, which re-checks access (a removed recipient gets the removed page instead) and is recorded as another preview, then carry on from the same `currentTime`, still playing if it was. Media that never loaded, or fails again within 10 seconds of a fresh URL, shows an error with **Try again** instead of looping.

## v1 data after the upgrade

Every link, at `/{code}`, is served by the delivery page (`app/[shortCode]/page.tsx` + `components/recipient/`) and the recipient API, for 1.x links too. The 1.x API (`/api/access`, `/api/verify`, `/api/analytics`) and its screens are gone. The 1.x tables `file_access` and `access_log` are kept, read-only, for one release: `migrate_v1_to_v2()` reads them (at upgrade, and to convert a late 1.x link), and nothing else does. Their types in `lib/types.ts` are marked `@deprecated`. v2.1 drops the tables, the `legacy_*` columns and the late-link conversion.
