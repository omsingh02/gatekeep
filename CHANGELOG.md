# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- New Gatekeep logo, favicon/app icons, Open Graph and GitHub social-preview images.
- Redesigned landing and sign-in pages; branded access-grant emails.
- Local demo environment (`npm run seed:demo`) and reproducible product screenshots (`npm run screenshots`).
- Issue forms, pull-request template, Dependabot, Code of Conduct.

### Changed
- Renamed the repository to `omsingh02/gatekeep`; the product is called Gatekeep everywhere.

### Fixed
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
