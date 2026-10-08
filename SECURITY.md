# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report privately via
[GitHub Security Advisories](https://github.com/omsingh02/gatekeep/security/advisories/new).
Include steps to reproduce and the impact. You'll get an acknowledgement within a few days.

## Supported versions

| Version | Security fixes |
|---|---|
| 2.x (latest release on `main`) | Yes |
| 1.x | No: upgrade to 2.0 ([guide](docs/DEPLOYMENT.md#upgrading-from-1x-to-20)) |

## Hardening checklist for self-hosters

- **Owner only.** Only the owner account can use the dashboard and owner APIs; any other signed-in account
  gets 403. `npm run create-admin` marks its account as the owner; on instances upgraded from 1.x, set
  `OWNER_EMAILS` to the owner's sign-in email.
- **Turn off sign-ups** in Supabase (**Authentication → Providers → Email → Allow new users to sign up: off**).
  Owner-only access already keeps other accounts out, but there's no reason to let anyone create one.
- **Keep secrets server-side.** `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `CRON_SECRET` must never be
  prefixed with `NEXT_PUBLIC_`. Set a long random `CRON_SECRET` (`openssl rand -hex 32`).
- **Buckets:** keep `files` **private** (the migrations create it that way). The `branding` bucket is public on
  purpose: it only holds your logo, which recipients see before they sign in.
- **Set up email** (`RESEND_API_KEY` and `EMAIL_FROM` on a domain verified in Resend) so recipients can use
  email codes instead of passwords, and so you're told about opens and denied attempts.
- **Serve over HTTPS only.** HSTS and `secure` cookies are sent in production.
- **Watch it:** monitor `GET /api/health`, check **Settings → System status** after every upgrade, and keep
  denied-attempt alerts on (**Settings → Notifications**). The **Activity** page lists every denied attempt
  with its reason and IP address.
- **Do not set** `EMAIL_TRANSPORT` or `E2E_TEST_SUPPORT` in production: they exist for the test suite.

## How access is protected

- **Recipients sign in per delivery**, each as themselves: with a 6-digit code sent to their email (hashed,
  bound to that recipient, single-use, valid 10 minutes, 5 attempts) or with their own password (bcrypt).
  Every person has their own password, shown to the owner once and never emailed; invites never contain a
  secret.
- **Nothing to enumerate.** Code requests, failed sign-ins and "forgot password" answer the same way, with the
  same timing, whether or not the person exists. A delivery's title, files, end date and downloads are only
  shown once the recipient's credentials match.
- **Throttling** is counted in the database, so it holds across serverless instances: 20 failed guesses per IP
  and 100 per delivery per 15 minutes, and 10 code requests per IP per 10 minutes.
- **Sessions** are random tokens, stored hashed and sent as httpOnly, SameSite=Strict cookies scoped to one
  delivery (24 hours). Removing someone, or changing how they sign in, ends their session at once, and an open
  delivery page closes immediately.
- **Files** live in a private bucket and are only reached through short-lived signed URLs, issued after access
  is re-checked: 60 seconds for downloads and most previews, 15 minutes for video and audio previews (which
  stream while they play). Downloads are counted atomically against the limit; previews never count.
- **Request uploads** are checked for type, size and count, and the size is read from Storage.
- **Every attempt leaves a receipt:** opens, previews, downloads, uploads and denied attempts are recorded with
  time, IP address and browser, and can be exported as CSV (with formula-injection protection).
- **The owner account:** changing the password confirms the current one and signs out every other browser;
  password reset links go only to the owner's email.
- **Headers:** CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-model) for details.
