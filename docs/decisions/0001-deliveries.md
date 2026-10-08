# 0001: Deliveries are the unit of sharing

- **Status:** accepted for v2
- **Context:** see [PRODUCT.md](../PRODUCT.md)

## Problem

In v1, access hangs off individual **files**: every file has a short code, and `file_access` rows give one person (or "public") access to one file. That model can't express the product:

- You can't send several files, or a folder, as one link.
- Access, activity and notifications are per file, so "did Maya get the Q3 pack?" has no answer.
- Requests (clients uploading to you) have nowhere to live.
- The access method is always a password, which the v1 invite email even contained.

## Decision

Introduce **deliveries**. A delivery has one link, a title, an optional message, one or more files and one or more recipients. A **request** is a delivery that receives files instead of sending them. Files become private content that you deliver; uploading no longer creates a link.

### Tables (new)

```
deliveries
  id uuid pk, owner_id uuid → auth.users, short_code text unique (base62, 6+)
  kind text ('send' | 'request'), title text, message text null
  request_folder_id uuid null → folders           -- request: where uploads land
  request_max_files int null, request_max_file_mb int null
  created_at, updated_at, deleted_at

delivery_files                                   -- kind = 'send'
  delivery_id → deliveries, file_id → files, position int, pk (delivery_id, file_id)

delivery_recipients
  id uuid pk, delivery_id → deliveries
  kind text ('person' | 'anyone')                -- anyone = "Anyone with the password"
  identifier text null (lowercased), identifier_type text null ('email' | 'username')
  method text ('email_code' | 'password')        -- anyone ⇒ password; username ⇒ password
  password_hash text null                        -- method = password
  ends_at timestamptz null, download_limit int null, download_count int default 0
  open_count int default 0, last_opened_at timestamptz null
  session_token_hash text null, session_expires_at timestamptz null
  removed_at timestamptz null                    -- "remove access" keeps the row for receipts
  created_at, updated_at
  unique (delivery_id, identifier) where identifier is not null and removed_at is null
  unique (delivery_id) where kind = 'anyone' and removed_at is null

verification_codes
  id uuid pk, recipient_id → delivery_recipients, code_hash text, expires_at,
  attempts int default 0, consumed_at null, created_at

activity
  id uuid pk, owner_id, delivery_id null, recipient_id null, file_id null
  type text ('opened' | 'previewed' | 'downloaded' | 'downloaded_all' | 'denied' | 'code_sent'
             | 'uploaded' | 'access_given' | 'access_removed' | 'invite_sent')
  reason text null ('wrong_password' | 'wrong_code' | 'not_on_delivery' | 'ended' | 'download_limit'
                    | 'removed' | 'throttled' | 'code_expired')
  actor text null (identifier shown in the feed), ip text null, user_agent text null, request_id text null
  created_at
  index (owner_id, created_at desc), (delivery_id, created_at desc)

owner_settings                                   -- one row per owner
  owner_id pk, display_name, organization, logo_path null, recipient_message null
  default_method ('email_code' | 'password'), default_ends_in_days int null, default_download_limit int null
  notify_opened bool default true, notify_downloaded bool default false,
  notify_denied bool default true, notify_uploaded bool default true
  homepage text ('landing' | 'branded') default 'branded'
```

RLS is enabled on every table, with owner-scoped policies. The app uses the service role on the server, as v1 does.

### Recipient flow

`/{code}` stays the URL (v1 links keep working).

1. **Identify:**
   - Email-code recipients enter their email. `POST /api/d/{code}/code` **always** answers "If that email has access, we sent a code". It sends a 6-digit code (valid 10 minutes, 5 attempts) only when the email is on the delivery, with the same timing either way.
   - Password recipients enter an email or username plus the password.
   - "Anyone" recipients enter the password.
2. **Verify:** `POST /api/d/{code}/session` with code or password. Credentials are checked first; then `ends_at`, `removed_at` and the download limit. Success sets an httpOnly `gk_{code}` cookie (24 h). Failures return one message.
3. **Use:**
   - `GET /api/d/{code}` returns the delivery (title, message, sender display name, files, the recipient's ends-at and downloads left).
   - `POST /api/d/{code}/files/{fileId}` with `action: preview | download` returns a 60-second signed URL. Only `download` counts.
   - Download all is zipped **in the browser** (`client-zip`) from per-file URLs and counts as one download. That avoids serverless time limits.
4. **Requests:** a verified recipient uploads with `POST /api/d/{code}/uploads` (presign + confirm, limits enforced). Files are owned by the owner and land in `request_folder_id`.

Live removal: removing access sets `removed_at` and clears the session. Open delivery pages are notified via Supabase Realtime, as in v1.

### Owner API

| Resource | Endpoints |
|---|---|
| Deliveries | `GET/POST /api/deliveries`, `GET/PATCH/DELETE /api/deliveries/{id}` |
| Recipients | `POST /api/deliveries/{id}/recipients`, `PATCH/DELETE …/recipients/{rid}`, `POST …/recipients/{rid}/invite` (resend) |
| Activity | `GET /api/activity?delivery=&type=&from=&to=&cursor=`, `GET /api/activity/export` (CSV) |
| Settings | `GET/PATCH /api/settings`, `POST /api/settings/logo`, `POST /api/account/password` |
| Status | `GET /api/status`: email configured, cron secret set, sign-ups disabled, bucket present, migrations, version |

Everything is behind `validateAuth` (owner-only).

### Notifications

When an `activity` row is written, matching `owner_settings.notify_*` sends one email. Opens are deduplicated (first open per recipient per delivery per 24 h). Denials are batched: after 3 denials for the same delivery within 15 minutes, one alert is sent. Uploads send one email per request session. Emails use the light template in [DESIGN.md](../DESIGN.md#components-variants-and-states).

### Migration from v1 (`20261009000000_deliveries.sql`)

1. For every non-deleted file with a short code, create a `send` delivery that keeps the **same short code**, has the file name as its title and the file's owner, plus one `delivery_files` row.
2. Copy each `file_access` row to `delivery_recipients`:
   - `method = 'password'`; `kind = 'anyone'` when `is_public`.
   - Carry over the end date, download limit and counts.
   - Clear session tokens, so recipients unlock once more.
3. Copy `access_log` to `activity`: `opened` or `denied` with the mapped reason.
4. Keep `file_access` and `access_log` read-only for one release, and drop them in v2.1. `files.short_code` becomes nullable; new uploads don't get one.

## Consequences

- **Good:** one link per delivery, one place for receipts, per-recipient methods, requests for free, and v1 links keep working.
- **Cost:** new API surface and a recipient page rewrite. The dashboard gains a Deliveries area that replaces Shares.
- **Risk:** the migration must be correct on real data. It's covered by the `migrations` CI job, plus an e2e test that opens a migrated v1 link.
