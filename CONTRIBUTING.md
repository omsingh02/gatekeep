# Contributing

1. Fork and create a branch: `git checkout -b feat/<short-name>`.
2. `npm install && cp .env.example .env.local` and point it at a **non-production** Supabase project.
3. Schema changes go in a new timestamped file in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`). Never edit an applied migration.
4. Run `npm run lint && npm test && npm run build` before opening a PR. Add a test in `tests/` for any bug you fix.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, …).

## End-to-end tests

`e2e/` drives a real browser through the whole product — sign in, upload, grant access, unlock as a
recipient, preview, download, return with a session, revoke — against the real app and a **local**
Supabase. Docker is required.

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,postgres-meta,supavisor
npm run test:e2e        # reseeds the local demo data, builds and starts the app on :3304
npx supabase stop
```

- The run refuses to start against a non-local Supabase, because it resets the demo admin's data.
- Locally it uses `/usr/bin/chromium` (or `CHROMIUM_PATH`); otherwise run `npx playwright install chromium`.
- A failed run leaves a trace in `test-results/` — open it with `npx playwright show-trace <trace.zip>`.
- CI runs the same suite in the `e2e` job.

## Email in development and tests

Set `EMAIL_TRANSPORT=memory` to keep emails in the server process instead of sending them. The
end-to-end tests also set `E2E_TEST_SUPPORT=1`, which exposes the captured emails at
`/api/test-support/emails` so tests can read codes and invites. Never set either in production.
