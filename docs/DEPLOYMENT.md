# Deployment

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply migrations: `supabase link --project-ref <ref> && supabase db push`
   (or run each file in `supabase/migrations` in order in the SQL editor).
3. **Storage** → create a **private** bucket named `files`.
4. **Authentication** → add your admin user (email + password). Disable public sign-ups.

## 2. Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role key (server only — never prefix with `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL, e.g. `https://dl.example.com` |
| `RESEND_API_KEY` | – | Enables access-granted emails |
| `EMAIL_FROM` | – | Sender, e.g. `Gatekeep <noreply@example.com>` |
| `CRON_SECRET` | ✅ (prod) | Random string (`openssl rand -hex 32`). Authenticates the daily keep-alive cron |

## 3. Vercel

```bash
npm i -g vercel
vercel link                      # select / create the project
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# …repeat for each variable above
vercel deploy                    # preview
vercel deploy --prod             # production
```

Connecting the GitHub repo in the Vercel dashboard enables preview deployments for every pull request
and production deployments on merge to `main`.

## 4. Keep the database awake

Supabase pauses free-tier projects after about a week without activity, which takes the whole app down
(share links show "We couldn't load this link"). `vercel.json` schedules `/api/cron/keep-alive` daily at
06:00 UTC; it runs a one-row query. Set `CRON_SECRET` in production so only Vercel can call it.

```bash
vercel crons ls                          # confirm the job is registered
vercel crons run /api/cron/keep-alive    # trigger it now
```

If the project is already paused: Supabase dashboard → project → **Restore project**.

## 5. Custom domain

Add the domain under **Project → Settings → Domains**, then set `NEXT_PUBLIC_APP_URL` to it and redeploy.
