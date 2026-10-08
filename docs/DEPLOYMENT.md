# Deployment

Gatekeep runs anywhere Next.js runs. This guide covers Supabase setup (required), then Vercel.
For your own server, see [DOCKER.md](DOCKER.md) after steps 1–3.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (the free plan is fine to start).
2. Apply the schema — tables, RLS policies, functions and the private `files` storage bucket:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>   # asks for the database password
   npx supabase db push
   ```

   No CLI? Paste each file in `supabase/migrations/` into the SQL editor, **in filename order**.
3. **Authentication → Providers → Email**: turn off *Allow new users to sign up*. Only the admin signs in.

## 2. Environment variables

Copy `.env.example` to `.env.local` (local / Docker) or add them in your host's dashboard.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL (**Project Settings → API**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role key — server only, never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL used in share links, e.g. `https://files.example.com` |
| `OWNER_EMAILS` | existing installs | Sign-in email(s) of the owner, comma-separated. Not needed if you created the account with `npm run create-admin` (it marks the owner) |
| `CRON_SECRET` | ✅ (prod) | Random string (`openssl rand -hex 32`). Authenticates the daily keep-alive job |
| `RESEND_API_KEY` | recommended | Sends invites, email codes, owner notifications and password resets. Without it, recipients use passwords |
| `EMAIL_FROM` | with Resend | Sender on a domain verified in Resend, e.g. `Gatekeep <noreply@example.com>`. Emails appear as "{your name} via Gatekeep", with replies going to you |
| `GATEKEEP_TIMEZONE` | – | IANA time zone for dates in emails, e.g. `Europe/London` (default `UTC`) |

### Supabase Auth URLs

In Supabase → **Authentication → URL Configuration**, set **Site URL** to your public URL. The
owner's "Forgot password?" email links straight to `https://<your-domain>/reset-password` (using
`NEXT_PUBLIC_APP_URL`), so no redirect URL is needed for it. Adding
`https://<your-domain>/reset-password` to **Redirect URLs** does no harm: the page also accepts
Supabase's own recovery redirects.

Settings → **System status** in the dashboard checks email, the daily job, sign-ups, storage and
migrations, and says what to change for each.

## 3. Owner account

```bash
npm run create-admin     # prompts for email + password; re-run to reset the password
```

Only the **owner** can use the dashboard. `create-admin` marks the account it creates (or resets) as the owner.
A signed-in account that isn't the owner is sent back to the sign-in page, and the admin APIs return 403,
so even if sign-ups are enabled on your Supabase project, nobody else can use your instance. Keep sign-ups
off anyway (step 1).

## 4. Vercel

Use the **Deploy with Vercel** button in the README, or:

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production   # …repeat for each variable above
vercel deploy --prod
```

Connecting the GitHub repo in Vercel gives preview deployments for pull requests and production
deployments on merge to `main`. Add your domain under **Project → Settings → Domains**, set
`NEXT_PUBLIC_APP_URL` to it and redeploy.

### Dependabot and the deployment quota

Vercel's Hobby plan allows 100 deployments a day, and every Dependabot PR would otherwise get a preview
build. `vercel.json` disables deployments for `dependabot/**` branches; GitHub Actions still tests them.

## 5. Keep the database awake

Supabase pauses free-tier projects after about a week without activity, which takes the whole app down
(share links show "We couldn't load this link"). `vercel.json` schedules `/api/cron/keep-alive` daily at
06:00 UTC; it runs a one-row query and only accepts Vercel's `Bearer $CRON_SECRET`.

```bash
vercel crons ls                          # confirm the job is registered
vercel crons run /api/cron/keep-alive    # trigger it now
```

If the project is already paused: Supabase dashboard → project → **Restore project**.

## 6. Monitoring

`GET /api/health` returns `200 {"status":"ok"}` when the app can reach the database and `503` otherwise.
Point any uptime monitor (UptimeRobot, Better Stack, …) at it to get alerted on outages.

## 7. Plan limits

On Supabase's free plan, check **Storage → Settings** for the global upload size limit — the app accepts
files up to 100 MB, so raise the limit (paid plans) or expect larger uploads to fail. Also check
**Database → Backups** for what your plan retains before storing anything you can't lose.

## Upgrading an existing deployment

> **Upgrading from 1.0.x:** the dashboard is now owner-only. Before deploying, either set
> `OWNER_EMAILS=<your sign-in email>` or run `npm run create-admin` against your project with your
> existing email (it keeps your account, sets the password you enter, and marks it as the owner).

Pull the latest code, then apply any new files in `supabase/migrations/`:

- **CLI**: `npx supabase db push` applies only migrations it hasn't recorded.
  If your database was set up by pasting SQL, the CLI doesn't know those were applied — mark them first:
  `npx supabase migration repair --status applied <timestamp> …` for every migration already in your
  database, then `db push`.
- **SQL editor**: paste just the new migration files, in order. All migrations are idempotent
  (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) where possible.

See [CHANGELOG.md](../CHANGELOG.md) for what changed in each release.
