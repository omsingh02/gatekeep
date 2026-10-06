<p align="center">
  <img src="public/assets/logo-gatekeep-mascot-wordmark-light.svg" alt="Gatekeep" height="64" />
</p>

<p align="center"><b>Self-hosted, access-controlled file sharing.</b><br/>
Upload once, share a short link, and decide exactly who can open it — and for how long.</p>

<p align="center">
  <a href="https://github.com/omsingh02/file-share/actions/workflows/ci.yml"><img src="https://github.com/omsingh02/file-share/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fomsingh02%2Ffile-share&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_APP_URL,CRON_SECRET&envDescription=Supabase%20project%20keys%2C%20your%20public%20URL%20and%20a%20random%20cron%20secret&envLink=https%3A%2F%2Fgithub.com%2Fomsingh02%2Ffile-share%2Fblob%2Fmain%2Fdocs%2FDEPLOYMENT.md&project-name=gatekeep&repository-name=gatekeep"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
</p>

---

## Why Gatekeep

Public links leak. Cloud drives want everyone to have an account. Gatekeep sits in between: you own the
storage, every recipient gets their own password, and you can see — and revoke — every access.

- **Short share links** — every file gets a code like `/aB3xY9`.
- **Per-recipient passwords** — grant access to an email or username, one at a time or in bulk.
- **Public links** — or share with anyone who has the link *and* its password.
- **Expiry & download limits** — grants lapse on a date and/or after N downloads.
- **Live revocation** — revoke a named recipient's grant and their open session ends immediately.
- **In-browser preview** — images, video, audio, PDF, text/code and Office documents.
- **Folders** — organise files into nested folders.
- **Email notifications** — optional, via [Resend](https://resend.com).
- **Analytics & audit log** — every view, download and denied attempt, with the reason.
- **Hardened** — RLS on every table, bcrypt passwords, hashed httpOnly sessions, brute-force throttling, strict CSP/HSTS.

## Self-host in 10 minutes

You need a free [Supabase](https://supabase.com) project and either a Vercel account or any machine with Docker.

```bash
git clone https://github.com/omsingh02/file-share.git gatekeep && cd gatekeep
npm install
cp .env.example .env.local          # paste your Supabase URL + keys
npx supabase link --project-ref <your-project-ref>
npx supabase db push                # tables, RLS, storage bucket
npm run create-admin                # the account you sign in with
```

Then pick a host:

| | |
|---|---|
| **Vercel** (recommended) | Click **Deploy with Vercel** above, or `vercel deploy`. The daily keep-alive cron is configured in `vercel.json`. → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| **Docker** | `docker compose up -d --build` — app + keep-alive sidecar. → [docs/DOCKER.md](docs/DOCKER.md) |
| **Local** | `npm run dev` → http://localhost:3000 |

Point an uptime monitor at `GET /api/health` (200 when the database is reachable, 503 otherwise).

## Stack

| Layer | Tech |
|---|---|
| App | Next.js 16 (App Router, Route Handlers, `proxy.ts`), React 19, TypeScript |
| UI | Tailwind CSS v4, lucide-react |
| Data / Auth / Storage | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| Email | Resend (optional) |
| Tests / CI | Vitest, ESLint, GitHub Actions |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run create-admin` | Create the admin user, or reset its password |

## Documentation

- [Deployment](docs/DEPLOYMENT.md) — Supabase, environment variables, Vercel, keep-alive, upgrading
- [Docker](docs/DOCKER.md) — self-host on your own server
- [Architecture](docs/ARCHITECTURE.md) — request flow, data model, security model
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
