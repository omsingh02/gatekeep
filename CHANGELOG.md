# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### v2: deliveries (backend)
Gatekeep becomes **secure file delivery with receipts** ([docs/PRODUCT.md](docs/PRODUCT.md)). This release adds the server side; the v2 screens follow.
- **Deliveries:** one link for one or more files, sent to named recipients and/or anyone with the password, with a title and message. **Requests** use the same link and access controls to collect files *from* recipients into a folder you choose.
- **Email codes:** recipients can prove who they are with a 6-digit code sent to their inbox (default when email is set up), or with their own password. Every person gets their own password; invites never contain one.
- **Receipts:** an activity feed of every open, preview, download, upload and denied attempt (with the reason), with filters, pagination and CSV export.
- **Owner notifications:** first open, downloads (optional), a single alert for repeated denied attempts, and request uploads. "Access ending soon" reminders go to recipients.
- **Settings:** your name and organization (shown to recipients instead of "someone"), logo, message to recipients, sharing defaults, notifications. Change password, forgot password, and a system status endpoint.
- **New emails:** one light template; every email says who it's from, and replies go to you.
- **Upgrade:** every v1 link becomes a delivery with the same code. v1 grants and the access log are carried over; recipients unlock once more.

### Security
- **The dashboard and admin APIs are owner-only.** Previously any signed-in Supabase account could use them, so an instance with sign-ups enabled let strangers upload into its storage. Set `OWNER_EMAILS` or run `npm run create-admin` before upgrading.
- The unlock page gives one answer for unknown recipients and wrong passwords (with equal timing), so it can't be used to discover who has access. End dates and download limits are only revealed after the password is accepted.
- `/api/verify` no longer returns an uncounted one-hour download URL.

### Fixed
- Previews no longer use up a recipient's downloads; only real downloads count.
- Recipient emails and usernames are case-insensitive (existing ones are lowercased by a migration).
- Moving files to another folder silently failed (the endpoint didn't exist); bulk move and delete now report partial failures.
- Giving access rejects passwords under 8 characters, end dates in the past and download limits below 1.
- Recipient-facing error messages explain what happened and what to do instead of exposing internals.

### Added
- **Copy invite**: after granting access, a ready-to-send message (link, recipient, password, expiry, download limit) with one-click copy; copy button next to every short link.
- New Gatekeep logo, favicon/app icons, Open Graph and GitHub social-preview images.
- Redesigned landing and sign-in pages; branded access-grant emails.
- Local demo environment (`npm run seed:demo`) and reproducible product screenshots (`npm run screenshots`).
- Issue forms, pull-request template, Dependabot, Code of Conduct.

### Changed
- Dashboard uses the brand's ink palette and line icons for file types (no more emoji).
- Renamed the repository to `omsingh02/gatekeep`; the product is called Gatekeep everywhere.
- The hosted instance moved to **https://gatekeep.omsingh.me**; notification emails come from `noreply@gatekeep.omsingh.me`.

### Fixed
- Returning recipients had to re-enter their password every time — the 24-hour session cookie was never used.
- Dashboard cards were unreadable (light text on white) when the OS was in light mode; colour tokens are now dark-only.
- Image previews on mobile no longer sit in a tall empty frame.
- Landing page layout: an unlayered CSS reset overrode Tailwind's spacing utilities.

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

[Unreleased]: https://github.com/omsingh02/gatekeep/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/omsingh02/gatekeep/releases/tag/v1.0.0
