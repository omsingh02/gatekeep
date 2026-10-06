# Contributing

1. Fork and create a branch: `git checkout -b feat/<short-name>`.
2. `npm install && cp .env.example .env.local` and point it at a **non-production** Supabase project.
3. Schema changes go in a new timestamped file in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`). Never edit an applied migration.
4. Run `npm run lint && npm run build` before opening a PR.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, …).
