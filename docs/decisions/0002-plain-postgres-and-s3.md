# 0002: Run on plain Postgres and S3-compatible storage

- **Status:** accepted for v3 (3.0.0)
- **Context:** Gatekeep's goal is an open-source tool people self-host ([PRODUCT.md](../PRODUCT.md)). Single owner today, teams possible later.

## Problem

Gatekeep 2.x is built on Supabase: its database API (PostgREST), row-level security, Auth, Storage and Realtime. That made the hosted version quick to build, but it's the wrong foundation for self-hosting:

- **Heavy.** Self-hosted Supabase is about ten containers (Postgres, GoTrue, PostgREST, Storage, Realtime, Kong, Studio and more), several GB of memory and a set of JWT secrets and keys. Gatekeep's Docker image doesn't include any of it, so "self-hosted" today still means "your own Supabase project".
- **Attack surface we don't need.** Supabase serves the database to browsers through a public key. Gatekeep never uses that: every query comes from its own server. 2.0.1 fixed a vulnerability that existed only because of it (privileged functions callable with the anon key), and 2.1.0's two-factor sign-in needed restrictive RLS policies for the same reason.
- **Little of it is used.**

| Supabase part | What Gatekeep uses it for | Inventory (2.1.1) |
|---|---|---|
| Postgres | All data | 10 tables, 24 migrations |
| PostgREST + RLS | Every query, from the server only | 60 files import a Supabase client; 128 table queries; 7 RPCs; 37 RLS policies |
| Auth | **Only the owner's** sign-in: password, reset, two-factor, sessions. Recipients already use Gatekeep's own sessions and codes | ~45 auth calls |
| Storage | Private `files` bucket (signed upload and download URLs, remove, list), public `branding` bucket (logo) | ~15 calls |
| Realtime | Closing a recipient's open page the moment access is removed (polling fallback exists) | 1 route |

## Decision

Gatekeep 3.0 runs on **any Postgres** and **any S3-compatible storage** (or a local disk), and handles the owner's sign-in itself. Supabase stays usable, but only as one provider of Postgres and S3-compatible storage.

The reference self-host becomes `docker compose up`: **the app, Postgres and optionally MinIO**.

### Database access: Kysely on `pg`

- **[Kysely](https://kysely.dev)**, a typed SQL query builder, over a `pg` pool, configured by one `DATABASE_URL`.
  - SQL stays the source of truth: migrations remain plain `.sql` files.
  - Kysely's types are a hand-maintained `Database` interface. It replaces today's `lib/types.ts`, which mirrors the same tables.
- **Repositories.** All queries move into `lib/db/<area>.ts` (deliveries, recipients, files, folders, activity, settings, users, sessions). Routes never touch a database client directly.
- **No public database API, so no RLS.** The app's server is the only client. Ownership is enforced in the repositories, as `requireOwner` + owner-scoped loaders already do today, and the tests cover it. The privileged RPCs (counters, soft delete, totals, schema version) become ordinary SQL in the repositories; there is no `SECURITY DEFINER` function left to expose.
- **Serverless.**
  - On Vercel, `DATABASE_URL` points at a pooled endpoint (Supabase's transaction pooler, Neon's pooled URL, PgBouncer). The `pg` pool stays small.
  - Kysely and `pg` don't use named prepared statements, so transaction pooling is safe.
- **Not chosen:**
  - Drizzle: wants the TypeScript schema as the source of truth, which would duplicate the SQL migrations.
  - Prisma: separate engine binary and its own schema language; heavier on serverless.
  - Raw `pg`: no types.

### Schema and migrations

- **New migration lineage in `db/migrations/`**, applied by Gatekeep's own runner:
  - `npm run db:migrate`;
  - a `gatekeep_migrations` table;
  - an advisory lock, so two app instances can't migrate at once;
  - one transaction per file.
  - The Docker image runs it on start. Elsewhere it's a deploy step.
- **`0001_baseline.sql`:** the 2.1.1 schema without anything Supabase-specific. No `auth.*` or `storage.*` references, no RLS policies, no `anon`/`authenticated`/`service_role` grants, no Realtime publication, and no 1.x tables (`file_access`, `access_log`; 3.0 drops them as planned for 2.1).
- **Identity tables** (designed so teams can come later):
  ```
  users           id uuid pk, email citext unique, password_hash text, role text ('owner'),
                  totp_secret_enc text null, totp_enabled_at timestamptz null,
                  created_at, updated_at, last_sign_in_at
  user_sessions   id uuid pk, user_id → users, token_hash text unique, two_factor_at timestamptz null,
                  created_at, last_seen_at, expires_at, ip text, user_agent text
  auth_tokens     id uuid pk, user_id → users, purpose text ('password_reset'), token_hash text unique,
                  expires_at, used_at null
  ```
  The `owner_id`/`uploaded_by` foreign keys on `files`, `folders`, `deliveries`, `activity` and `owner_settings` point to `users`, not `auth.users`.
- **`supabase/migrations/` is frozen at 2.1.1** and kept for 2.x installs and their upgrade.

### Upgrading a 2.x (Supabase) install

`npm run db:migrate` detects a 2.x Supabase schema (`gatekeep_schema_version()` is present and the `auth` schema exists) and runs `0001_from_supabase_2x.sql` instead of the baseline. It:
- creates `users`, `user_sessions` and `auth_tokens`;
- copies the owner(s) from `auth.users`, keeping the same ids. `encrypted_password` is bcrypt, so passwords keep working;
- points the foreign keys at `users`;
- drops RLS policies, Supabase-only grants, the `SECURITY DEFINER` functions and the 1.x tables;
- marks the baseline as applied.

What carries over:
- **Two-factor:** the TOTP secret is copied from `auth.mfa_factors.secret` when it's a plain base32 secret. If the provider encrypts it, the owner sets two-factor up again after upgrading.
- **Sessions:** everyone signs in once more.
- **Files:** stay where they are. Supabase Storage can be used through its S3-compatible endpoint, or copied with `npm run storage:copy`.

Upgrading requires 2.1.1 first, so the 1.x conversion and every 2.x migration have run.

### Storage: one interface, three drivers

`lib/storage` exposes:
- `uploadUrl(key, type, size)`
- `downloadUrl(key, { filename, seconds })`
- `previewUrl(key, seconds)`
- `head(key)`
- `remove(keys)`
- `list(prefix)`
- `put(key, bytes)`, for the logo

Drivers:
- **`s3`:** any S3-compatible service (AWS, R2, Backblaze, MinIO, Supabase Storage's S3 endpoint). Presigned PUT and GET signed with [`aws4fetch`](https://github.com/mhart/aws4fetch), which is small and works anywhere `fetch` does. Settings: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.
- **`local`:** files under `GATEKEEP_DATA_DIR`. Upload and download go through app routes, with URLs signed by HMAC with `GATEKEEP_SECRET` and the same short lifetimes. This needs a long-running server (Docker); it's refused on serverless.
- **`supabase`:** the current Storage API. Only for the 3.0 transition and removed later; new installs use `s3`.

The logo moves into the files store and is served by an app route (`/brand/logo`) with long caching, so no public bucket is needed. Signed URL lifetimes stay as documented in [ARCHITECTURE.md](../ARCHITECTURE.md#signed-urls).

### Owner sign-in

Owner sign-in follows the pattern recipients already use: random session tokens, stored hashed, in an httpOnly cookie.

- **Passwords:** bcrypt (`bcryptjs`, already a dependency).
- **Two-factor:**
  - TOTP per RFC 6238, implemented with `node:crypto` (the e2e suite already has a tested implementation);
  - a ±1 step window, and a code can't be used twice;
  - the secret is encrypted with AES-256-GCM under a key derived from `GATEKEEP_SECRET`.
- **Two-factor progress:** a session records `two_factor_at`. `proxy.ts` and `requireOwner` check it, as they check `aal2` today.
- **Password reset:** a one-time token, stored hashed with an expiry, sent by email. Without email, the server admin uses `npm run create-admin`, which already exists for this.
- **Throttling:** failed sign-ins and code checks are counted in the database, the same as recipient throttling.
- **Signed-in devices** lists `user_sessions` and can end any of them.
- **Owner role:** "owner" is `users.role = 'owner'`. This replaces the `app_metadata.role` / `OWNER_EMAILS` check.

### Live updates

Supabase Realtime is removed. A recipient's open page re-checks its access every 15 seconds, and whenever the tab becomes visible, through the existing session endpoint. `LISTEN/NOTIFY` with SSE is possible later for Docker deployments but isn't needed.

### Configuration

- **Required:** `DATABASE_URL` and `GATEKEEP_SECRET` (at least 32 random bytes).
- **Storage:** `STORAGE_DRIVER=s3|local`. Docker defaults to `local`; elsewhere `s3` is required.
- **Removed:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAILS`.
- **CSP:** allows the configured S3 origin instead of `*.supabase.co`.
- **System status:** gains checks for the database connection, migrations, storage (a write/read/delete probe) and `GATEKEEP_SECRET`.

### Deployment targets

1. **Docker Compose (reference self-host):** `app` (migrates on start) + `postgres:17` + optional `minio`, and the existing daily-job container. Volumes for the database and data.
2. **Vercel + managed Postgres + S3:** for example Neon or Supabase Postgres, with R2 or Supabase Storage's S3 endpoint. Same image of the app, no code differences.

### Testing and CI

- **CI:** e2e runs against service containers (Postgres and MinIO) instead of `supabase start`. That's faster, and it's the self-host stack itself.
- **Two extra jobs:**
  - `local` storage on Docker;
  - the 2.x → 3.0 upgrade, applied to a database built from the frozen `supabase/migrations` and seeded.
- Every phase keeps the full e2e suite green. Specs only change where they assert Supabase internals (for example the 2.0.1 database-API test, which becomes "there is no database API").

## Phases

Each phase is a PR into the `v3` integration branch. A draft PR `v3 → main` runs CI on the combined branch, and 2.x fixes on `main` are merged into `v3` as they land.

| Phase | Scope | App still on Supabase? |
|---|---|---|
| **P1 Foundations** | Kysely + `pg`, `lib/db` scaffolding, migration runner, `0001_baseline.sql`, `0001_from_supabase_2x.sql`, identity tables; CI job that migrates a plain Postgres and a 2.1.1 Supabase-schema database | Yes |
| **P2 Storage** | `lib/storage` with `supabase`, `s3`, `local` drivers; logo via app route; app switched to the interface | Yes (data and auth) |
| **P3 Data** | Every table query and RPC moved to `lib/db` repositories on Kysely | Auth only |
| **P4 Owner sign-in** | Users, sessions, two-factor, reset, signed-in devices; `proxy.ts` / `requireOwner` on Gatekeep sessions; `create-admin` and `reset-two-factor` rewritten | No |
| **P5 Cleanup** | Realtime replaced by re-checks; `@supabase/*` removed; CSP; `supabase` storage driver kept only for transition | No |
| **P6 Release** | Docker Compose (Postgres + MinIO), DOCKER/DEPLOYMENT rewrite, 2.x → 3.0 upgrade guide, seed and screenshots on the plain stack, CI on the plain stack; **3.0.0** | No |

## Consequences

- **Good:**
  - Self-hosting is three small containers.
  - There's no public database API to secure.
  - Any Postgres and any S3-compatible store works.
  - CI and local development are faster.
  - Owner sign-in can do things Supabase made awkward, such as listing and ending sessions.
- **Costs:**
  - We own owner authentication: sessions, password reset, two-factor and throttling. It must be implemented carefully and tested as thoroughly as the recipient flow already is.
  - A one-time, scripted upgrade for 2.x installs.
  - A large but mechanical data-layer change.
- **Unchanged:** the recipient experience, links, emails, the dashboard and the design.

## Open questions (settled during implementation)

- **SMTP:** self-hosters expect it alongside Resend. `nodemailer` was removed in 1.x over an advisory, so re-adding it needs a maintained, audited version.
- **2FA secrets on hosted Supabase:** whether `auth.mfa_factors.secret` is readable plain base32 there, which decides whether two-factor survives the upgrade.
- **Large uploads:** a single presigned PUT handles today's 100 MB cap. S3 multipart would be needed beyond 5 GB.
