# Deployment

Gatekeep runs anywhere Next.js runs. This guide covers Supabase setup (required), then Vercel.
For your own server, see [DOCKER.md](DOCKER.md) after steps 1–3.

**Running 1.x already?** See [Upgrading from 1.x to 2.0](#upgrading-from-1x-to-20).

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (the free plan is fine to start).
2. Apply the schema — tables, RLS policies, functions, the private `files` bucket and the public `branding`
   bucket (for your logo):

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

In Supabase → **Authentication → URL Configuration**:

- Set **Site URL** to your public URL, e.g. `https://files.example.com`.
- Add `https://<your-domain>/reset-password` to **Redirect URLs**. Gatekeep's own "Forgot password?" email
  links straight to that page (using `NEXT_PUBLIC_APP_URL`), so it works without this entry, but the entry
  lets recovery emails sent by Supabase itself (for example from the Supabase dashboard) land there too.

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

## Upgrading from 1.x to 2.0

2.0 replaces per-file links with deliveries ([CHANGELOG.md](../CHANGELOG.md)). The upgrade keeps every
existing link working: each 1.x link becomes a one-file delivery with **the same code**, each grant becomes a
password recipient with the same password, end date, download limit and counts, and the access log becomes
activity. Plan about 15 minutes; none of the database steps takes the site down.

Do these in order.

1. **Back up the database.** Supabase → **Database → Backups** (paid plans), or
   `pg_dump "<connection string>" > gatekeep-1x.sql` with the connection string from **Project Settings →
   Database**.
2. **Make sure you're the owner.** The 2.0 dashboard and owner APIs only work for the owner account. Either
   set `OWNER_EMAILS=<your sign-in email>` in your host's environment (Vercel: **Project → Settings →
   Environment Variables**; Docker: `.env`), or run `npm run create-admin` against the project with your
   existing email: it keeps the account, sets the password you enter and marks it as the owner. Skip this
   and signing in sends you back with "That account isn't the owner of this Gatekeep."
3. **Run the three new migrations, in this order.** 1.x keeps working on the migrated database, so do this
   before deploying 2.0.

   | Order | File | What it does |
   |---|---|---|
   | 1 | `20261008000000_case-insensitive-recipients.sql` | Lowercases 1.x recipient emails and usernames |
   | 2 | `20261009000000_deliveries.sql` | New tables and policies, the `branding` bucket, and `migrate_v1_to_v2()`, which it runs to copy your 1.x links, grants and access log |
   | 3 | `20261009000100_delivery-counters.sql` | Atomic open and download counters |

   - **SQL editor:** open each file from `supabase/migrations/`, paste it into **SQL Editor → New query** and
     run it, in the order above. Each file is safe to run twice.
   - **CLI:** `npx supabase link --project-ref <project-ref>`, then `npx supabase db push`. If you set the
     database up by pasting SQL, the CLI doesn't know which migrations already ran: check with
     `npx supabase migration list`, mark every 1.x migration (up to and including `20261007000100`) as
     applied with `npx supabase migration repair --status applied <timestamp> …`, then `npx supabase db push`.
4. **Check the `branding` bucket.** Migration 2 creates it: in **Storage** there should be a **public** bucket
   named `branding` next to the private `files` bucket. If it's missing (for example because the SQL ran as a
   role that can't write to `storage.buckets`), create it: name `branding`, **Public bucket** on, file size
   limit 2 MB, allowed MIME types `image/png, image/jpeg, image/webp`. It only ever holds your logo. Keep
   `files` **private**.
5. **Add the reset page to Supabase Auth.** In **Authentication → URL Configuration**, check that **Site URL**
   is your public URL and add `https://<your-domain>/reset-password` to **Redirect URLs**
   ([why](#supabase-auth-urls)).
6. **Set the email variables** (recommended) in your host's environment:
   - `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified in Resend). They power invites, email
     codes, your notifications and password resets. Without them, recipients sign in with passwords only.
   - `GATEKEEP_TIMEZONE` (optional): an IANA name such as `Europe/London`, for dates in emails. Default UTC.
   - `CRON_SECRET`, if it isn't set yet: the daily job now also sends "access ends soon" reminders.
7. **Deploy 2.0.** Vercel: push or merge to your production branch, or run `vercel deploy --prod`
   (environment changes only apply to new deployments). Docker: update the checkout to 2.0 and run
   `docker compose up -d --build` ([DOCKER.md](DOCKER.md#updating)).
8. **Catch up.** Run `select migrate_v1_to_v2();` once in the SQL editor. It copies whatever the 1.x
   dashboard created or changed between step 3 and the deploy, and skips everything already copied. (A link
   created in that window is also converted the first time someone opens it.)
9. **Check.** Sign in, open **Settings → System status** (every check should pass), and fill in
   **Settings → Profile**: recipients see your name and organization instead of "someone". Open one of your
   1.x links in a private window to see what recipients see.

### What recipients notice

- Their link is the same, and it opens the new delivery page.
- They sign in once more, with the email or username and password they already have (1.x sessions aren't
  carried over). Names are no longer case-sensitive. A public 1.x link asks for its password, as "Anyone with
  the password".
- End dates, download limits and the downloads they've used carry over.
- From now on you can switch people to email codes, add files, or remove one person's access, all on the
  delivery.

### After the upgrade

- The 1.x tables `file_access` and `access_log` stay in the database, read-only, for one release; 2.1 drops
  them. Nothing in 2.0 reads or writes them.
- New uploads have no link of their own: send them in a delivery.
- The 1.x API (`/api/access`, `/api/verify`, `/api/analytics`) is gone. If you scripted against it, use the
  delivery API ([ARCHITECTURE.md](ARCHITECTURE.md)).

### Rolling back

Redeploy the 1.x build you ran before (Vercel: **Deployments →** your last 1.x deployment **→ Promote to
Production**; Docker: check out that release and `docker compose up -d --build`). Leave the database as it is:
apart from making `files.short_code` optional and lowercasing recipient names, the 2.0 migrations only add
(tables, columns, functions, policies and a bucket), so 1.x runs on it. Then:

- 1.x links work again with the grants as they were at the upgrade (or at your last `migrate_v1_to_v2()`), and
  recipients sign in once more.
- Nothing done in 2.0 shows up in 1.x: deliveries, people added or removed, activity, settings. Files uploaded
  in 2.0 appear without a link, so they can't be shared from 1.x.
- 1.0.0 matches recipient names exactly, and they're now lowercase, so recipients type them in lowercase.

To return the database to exactly how it was, restore the backup from step 1 instead. Files uploaded since
then stay in Storage but aren't listed.

## Later upgrades

Update to the new release, read [CHANGELOG.md](../CHANGELOG.md), and apply any new files in
`supabase/migrations/` **before** deploying:

- **CLI**: `npx supabase db push` applies only migrations it hasn't recorded.
  If your database was set up by pasting SQL, the CLI doesn't know those were applied — mark them first:
  `npx supabase migration repair --status applied <timestamp> …` for every migration already in your
  database, then `db push`.
- **SQL editor**: paste just the new migration files, in order. Migrations are written to be safe to run
  twice (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) where possible.

Settings → **System status** says "Database needs migrating" when this version expects a newer schema.
