<p align="center">
  <img src="public/assets/logo-gatekeep-mascot-wordmark-light.svg" alt="Gatekeep" height="64" />
</p>

<p align="center"><b>Self-hosted, access-controlled file sharing.</b><br/>
Upload once, share with a short link, and decide exactly who can open it — and for how long.</p>

---

## What it does

Gatekeep is a private file-sharing service for a single owner (or small team) that needs more control than a public link:

- **Short share links** — every file/folder gets a code like `/aB3xY9`.
- **Per-recipient access** — grant access to specific emails, individually or in bulk, with optional expiry.
- **Email verification** — recipients prove ownership of their email before they can view or download.
- **In-browser preview** — images, video, audio, PDF, text/code and Office documents.
- **Folders** — nested (depth-limited) folders, shared as a unit.
- **Expiring files & public links** — files can auto-expire; public links can be toggled per file.
- **Analytics & audit log** — every view, download and denial is logged with reason and request ID.
- **Hardened by default** — RLS on every table, httpOnly access cookies, rate limiting, CSP/HSTS headers, input sanitisation.

## Stack

| Layer | Tech |
|---|---|
| App | Next.js 16 (App Router, Route Handlers, `proxy.ts`), React 19, TypeScript |
| UI | Tailwind CSS v4, lucide-react |
| Data / Auth / Storage | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| Email | Resend (optional) |
| Hosting | Vercel |

## Quick start

```bash
git clone https://github.com/omsingh02/file-share.git
cd file-share
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:3000
```

### Database

Migrations live in [`supabase/migrations`](supabase/migrations) and are ordered by timestamp.

```bash
# with the Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste each file, in order, into the Supabase SQL editor. Then create a private Storage bucket named `files`
and an admin user under **Authentication → Users**.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — request flow, data model, security model
- [Deployment](docs/DEPLOYMENT.md) — Supabase + Vercel setup, environment variables
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
