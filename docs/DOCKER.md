# Self-hosting with Docker

Run Gatekeep on any server with Docker instead of Vercel. The database, auth and file storage still live in
Supabase (hosted or [self-hosted](https://supabase.com/docs/guides/self-hosting)).

## Prerequisites

- Docker with the Compose plugin
- A Supabase project set up as in [DEPLOYMENT.md](DEPLOYMENT.md) steps 1–2 (migrations applied, private `files`
  bucket, admin user created)

## Run

```bash
git clone https://github.com/omsingh02/gatekeep.git gatekeep
cd gatekeep
cp .env.example .env        # fill in the values
docker compose up -d --build
```

The app listens on `http://localhost:3000`. Compose starts two services:

| Service | Purpose |
|---|---|
| `app` | The Next.js server (standalone build, runs as a non-root user) |
| `cron` | Calls `/api/cron/keep-alive` daily with `CRON_SECRET` so a free-tier Supabase project isn't paused |

### Build-time vs runtime variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_APP_URL` are inlined into the
  browser bundle **at build time**. Changing them requires `docker compose up -d --build`.
- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` and `CRON_SECRET` are read **at runtime** from `.env`
  and are never baked into the image.

## HTTPS / reverse proxy

Put the container behind a TLS-terminating reverse proxy and set `NEXT_PUBLIC_APP_URL` to the public HTTPS URL.
Example with [Caddy](https://caddyserver.com/):

```
files.example.com {
    reverse_proxy localhost:3000
}
```

The app sends HSTS and `secure` cookies in production, so serve it over HTTPS.

## Updating

```bash
git pull
docker compose up -d --build
```

Apply any new files in `supabase/migrations` to your database (`supabase db push`) before or after updating.
