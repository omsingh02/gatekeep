# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report privately via
[GitHub Security Advisories](https://github.com/omsingh02/gatekeep/security/advisories/new).
Include steps to reproduce and the impact. You'll get an acknowledgement within a few days.

## Supported versions

Only the latest release on `main` receives security fixes.

## Hardening checklist for self-hosters

- Keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` server-side only — never prefix them with `NEXT_PUBLIC_`.
- Disable public sign-ups in Supabase (**Authentication → Providers → Email → Allow new users to sign up: off**);
  create the admin with `npm run create-admin`.
- Keep the `files` storage bucket **private** (the migration creates it that way).
- Serve the app over HTTPS only (HSTS is sent by default).
- Monitor `GET /api/health` and review the access log in the dashboard for repeated denied attempts.

## How access is protected

Recipient passwords are bcrypt-hashed; session tokens are random, stored hashed and sent as httpOnly,
SameSite=Strict cookies. Password attempts are throttled per IP and per file using the audit log, so limits
hold across serverless instances. Files are only served through short-lived signed URLs after the grant is
re-checked server-side. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-model).
