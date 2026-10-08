# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0] — 2026-10-08

Gatekeep becomes **secure file delivery with receipts** ([docs/PRODUCT.md](docs/PRODUCT.md)). Files are no
longer shared one link per file: you send **deliveries** to named people, see everything that happens to
them, and take access back at any moment ([decision 0001](docs/decisions/0001-deliveries.md)). Every 1.x link
keeps working.

**Upgrading an existing instance?** Follow [Upgrading from 1.x to 2.0](docs/DEPLOYMENT.md#upgrading-from-1x-to-20):
the dashboard is now owner-only and three database migrations must run before the new version is deployed.

### Highlights

- **Deliveries.** One link sends one or more files to named people (by email or username) and/or to
  "anyone with the password", with a title and an optional message. Each person has their own access, end
  date and download limit, so you can remove one person without affecting anyone else, and an open page
  closes the moment their access is removed. Deliveries has a searchable list with status filters, a compose
  page with a review panel, a sent panel (invite status per person, passwords shown once, ready-to-paste
  invite text), and a detail page with people, files, activity and **Add people**.
- **Email codes.** Recipients prove who they are with a 6-digit code sent to their inbox (valid 10 minutes,
  5 attempts, resend with a cooldown), or with their own password. Email codes are the default whenever
  email is set up, and a "Which should I use?" helper explains the choice ([docs/ACCESS-METHODS.md](docs/ACCESS-METHODS.md)).
  Invites never contain a password.
- **The delivery page.** Before signing in, recipients see who sent it (your name, organization, logo and
  message) and nothing else. Signed in, they get the files with full-screen previews (images, video, audio,
  PDF, text and code, and Office files through Microsoft's viewer only if they choose it), **Download**, and
  **Download all** as one zip built in the browser that counts as one download. Ended access, removed access
  and the download limit each get a clear page that says what to do next.
- **Receipts, activity and notifications.** Every open, preview, download, upload, code sent, access change
  and denied attempt (with the reason, IP address and browser) is recorded. The **Activity** page filters by
  delivery, event and period, shows totals for the period and the deliveries open now, and exports CSV. You
  get an email on a person's first open (once a day per person), on downloads (optional), once for a burst
  of denied attempts, and when someone uploads to a request. Recipients get an "access ends soon" reminder.
- **Requests.** A request link collects files *from* people into a folder you choose, with the same access
  controls plus file-count and size limits. Recipients drop or choose files, watch each upload, retry
  failures, and get a confirmation; you get one email per batch.
- **Settings and branding.** **Profile** (your name and organization, shown to recipients instead of
  "someone"), **Branding** (logo, message to recipients, live preview), **Sharing defaults** (access method,
  end date, download limit), **Notifications**, **Account** (change password, forgot and reset password,
  sign out everywhere) and **System status**, which checks email, the daily job, sign-ups, storage,
  migrations and the owner, and says what to change.
- **Files and Overview, rebuilt.** Files has folders, search, type filter, sorting, table and grid views,
  bulk **Send**, **Move** and **Delete**, drag-and-drop and folder uploads with per-file progress, cancel and
  retry, and a preview with **Send** and **Download**. Overview shows your files, storage, deliveries and
  opens, a first-run guide and recent files.
- **A new design system: Gatekeep Mono.** One monochrome set of tokens and accessible components for the
  dashboard, the delivery page and emails ([docs/DESIGN.md](docs/DESIGN.md)), one vocabulary
  ([docs/VOICE.md](docs/VOICE.md)), a new logo, icons and social images, and one light email template (with a
  text version) for invites, codes, notifications, access ending and password resets. Emails appear as
  "{your name} via Gatekeep", and replies go to you.
- **A product page, or your own homepage.** `/` explains Gatekeep to anyone who finds your instance: who it's
  for, named recipients vs bearer links, how it works with real screenshots, "Email code or password?" with
  the helper (also in the FAQ), security, self-hosting and an FAQ. Settings → Branding → **Homepage** switches
  it to a simple welcome with your name and logo that points visitors back to their link. A fresh install
  starts with the welcome.

### Security

- **The dashboard and every owner API are owner-only.** In 1.0, any signed-in Supabase account could use
  them, so an instance with sign-ups enabled let strangers upload into its storage. Other accounts are now
  sent back to the sign-in page, and the APIs answer 403. Set `OWNER_EMAILS` or run `npm run create-admin`
  before upgrading.
- **Per-person credentials.** Every password recipient has their own password (generated unless you choose
  one), shown to you once and never emailed. Email codes are hashed, bound to one recipient, single-use, and expire after 10 minutes
  or 5 wrong attempts.
- **Nothing to enumerate.** Code requests, failed sign-ins and "forgot password" answer the same way, with
  the same timing, whether or not the person exists. A delivery's title, files, end date and downloads are
  only shown after the recipient's credentials match.
- **Throttling that holds across serverless instances:** wrong guesses are counted in the database (20 per IP
  and 100 per delivery per 15 minutes), and code requests are limited to 10 per IP per 10 minutes.
- **Downloads are counted atomically:** a download only counts while it's under the limit, in one SQL
  statement, so parallel requests can't slip past it.
- **Sessions** are random tokens, stored hashed, in an httpOnly, SameSite=Strict cookie per delivery
  (24 hours). Removing someone, or changing how they sign in, ends their session at once.
- Request uploads are checked for type, size and count, and the size is read from Storage rather than
  trusted from the browser. Logos are checked by their bytes (PNG, JPEG or WebP, up to 2 MB).
- CSV exports are protected against formula injection.
- Changing the owner password signs out every other browser; Settings → Account can also sign out
  everywhere.
- The v1 `/api/verify` returned an uncounted one-hour download URL. It was fixed, and is now removed with the
  rest of the v1 API.

### Fixed

- Previews no longer use up a recipient's downloads; only real downloads count.
- Recipient emails and usernames are case-insensitive (existing ones are lowercased by a migration).
- Returning recipients are let straight back in for 24 hours; in 1.0 the session cookie was never used.
- Moving files to another folder silently failed (the endpoint didn't exist); bulk move and delete report
  partial failures.
- Giving access rejects passwords under 8 characters, end dates in the past and download limits below 1.
- Long videos and audio keep playing and seeking past the first minute: their preview URLs last 15 minutes,
  and the player fetches a fresh URL and carries on from the same moment if one expires.
- Error messages say what happened and what to do next instead of exposing internals.

### Changed (breaking)

These change how an existing 1.x instance behaves; see the upgrade notes below.

- **Files no longer have links of their own.** Upload into Files, then send them in a delivery. New uploads
  don't get a short code (`files.short_code` is now nullable). Every 1.x link became a one-file delivery
  **with the same code**, titled with the file's name.
- **Recipients unlock once more** after the upgrade: 1.x sessions aren't carried over. Their passwords, end
  dates, download limits and counts are, and a public 1.x link becomes "Anyone with the password".
- **The v1 API is removed:** `/api/access` (with `/download` and `/stream`), `/api/verify` and
  `/api/analytics`. Owners use `/api/deliveries`, `/api/activity` and `/api/settings`; recipients use
  `/api/d/{code}/…` ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)). `GET /api/files` and folder contents no
  longer return `shortCode`, `shortUrl` or v1 grant and log counts, and `/api/files/stats` no longer returns
  `totalAccess`.
- **The v1 tables are read-only.** The migration copies `file_access` into `delivery_recipients` and
  `access_log` into `activity`; nothing writes or reads them any more, and 2.1 drops them.
- The Shares and Analytics pages are replaced by **Deliveries**, **Requests** and **Activity**. The v1
  access-grant email, which contained the password, is gone.
- Email (`RESEND_API_KEY` and `EMAIL_FROM`) now powers invites, email codes, notifications and password
  resets. Without it, recipients use passwords. New optional variable: `GATEKEEP_TIMEZONE` for dates in
  emails.
- The daily job (`/api/cron/keep-alive`) also sends "access ends soon" reminders, purges old email codes and
  reports request uploads whose batch was never completed.
- The repository is `omsingh02/gatekeep`, the product is called Gatekeep everywhere, and the hosted instance
  lives at **https://gatekeep.omsingh.me**.

### Added for self-hosters and contributors

- `GET /api/status` (shown in Settings → System status).
- Page titles per dashboard section, `robots.txt` and a sitemap.
- A local demo (`npm run seed:demo`, seeded in the 1.x shape so it exercises the upgrade) and reproducible
  screenshots of the v2 screens (`npm run screenshots`, which first creates realistic deliveries and
  recipient activity).
- A Playwright end-to-end suite against a local Supabase, run in CI alongside a job that applies every
  migration to a fresh database.
- Issue forms, a pull-request template, Dependabot and a Code of Conduct.

### Upgrade notes

The full, ordered steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#upgrading-from-1x-to-20). In short:

1. Back up the database.
2. Set `OWNER_EMAILS` to your sign-in email (or run `npm run create-admin` with it).
3. Run the new migrations, in order: `20261008000000_case-insensitive-recipients.sql`,
   `20261009000000_deliveries.sql` and `20261009000100_delivery-counters.sql` (SQL editor, or
   `npx supabase db push`). 1.x keeps working on the migrated database.
4. Check that the public `branding` bucket exists, add `https://<your-domain>/reset-password` to Supabase's
   redirect URLs, and set the email variables and `GATEKEEP_TIMEZONE` if you want them.
5. Deploy 2.0, run `select migrate_v1_to_v2();` once more to pick up anything 1.x changed in between, and
   check Settings → System status.

Recipients keep their links and passwords; they sign in once more on the new delivery page. To roll back,
redeploy your previous 1.x build: the 2.0 migrations only add to the schema (and lowercase v1 recipient
names), so 1.x runs on the migrated database. See the guide for what doesn't carry back.

## [1.0.0] — 2026-10-07

First open-source release.

### Added
- Landing page, branded 404 and "try again" error pages; share pages are `noindex`.
- `GET /api/health` for uptime monitors.
- Daily keep-alive cron (`vercel.json`, or the Docker sidecar) so free Supabase projects aren't paused.
- Password brute-force throttling backed by the audit log (20 failures / 15 min per IP, 100 per file).
- Docker image and `docker-compose.yml` for self-hosting without Vercel.
- `npm run create-admin` and a migration that creates the private `files` storage bucket.
- Vitest unit tests; CI runs typecheck, lint, tests and build.
- Docs: deployment, Docker, architecture, contributing, security policy.

### Fixed
- `supabase db push` failed on a fresh project (realtime migration re-added a table to the publication); CI now applies all migrations to a fresh Supabase Postgres.
- Named-recipient previews/downloads failed with 403 (queried columns dropped with the groups feature).
- ~17% of share links could never resolve (generated codes contained `-`/`_` that lookups stripped).
- Unknown links now return 404; database outages show a retryable error instead of a false 404.
- Duplicate folder names at the root weren't detected.
- `/api/access` returned bcrypt password hashes to the browser.
- Analytics counted public links as a unique user; failed lookups wrote invalid audit rows.

### Changed
- Fully typed Supabase schema (`lib/types.ts`); lint is clean and enforced in CI.
- Migrations moved to `supabase/migrations` with timestamps (`supabase db push` compatible).
- `EMAIL_FROM` is now required for email notifications (no hard-coded sender domain).

[Unreleased]: https://github.com/omsingh02/gatekeep/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/omsingh02/gatekeep/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/omsingh02/gatekeep/releases/tag/v1.0.0
