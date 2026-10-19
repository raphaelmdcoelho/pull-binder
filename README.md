# Pull Binder

Mobile-first PWA for managing your physical Pokémon TCG cards. Vocabulary: [GLOSSARY.md](GLOSSARY.md). Plan and milestones: [docs/implementation-plan.md](docs/implementation-plan.md).

Status: M0 (tooling), M1 (shell, i18n, UI shims) and M2 (Supabase auth, database schema) and M3 (catalog search) and M4 (add Owned cards) and M5 (browse, filter, sort, edit, remove) are done. M6 (installable PWA, offline read-only Collection) is done.

## Develop

Node 26 (`nvm use`) and npm.

```sh
npm ci
npm start            # http://localhost:4200
npm run lint
npm test -- --watch=false
npm run format:check
npm run build        # dist/pull-binder/browser (production, with the service worker)
npm run icons        # re-render the PWA icons from assets/icons/*.svg
npm run test:sql     # migrations + RLS tests in an in-memory Postgres (no Docker)
```

To try the service worker locally, serve the build: `npx http-server dist/pull-binder/browser -p 8080 -c-1`.

## Supabase

- `supabase/migrations` holds the schema (profiles, owned_cards, enums, RLS, explicit grants, `ping()`); `supabase/tests/database` holds pgTAP tests. Nothing is applied to the hosted project automatically before M7: apply deliberately with `npx supabase link --project-ref <ref>` then `npx supabase db push`.
- `npm run test:sql` runs the migrations and the same test file in PGlite with stubbed Supabase roles. It is a fast guard; with Docker, also run `npx supabase start && npx supabase test db`.
- With Docker: `npx supabase start && npx supabase test db`, then `eval "$(npx supabase status -o env | sed 's/^/export /')" && SUPABASE_URL=$API_URL SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY node scripts/verify-local-rls.mjs` exercises the table through supabase-js as two users (the script refuses non-local URLs), then `npx supabase stop`.
- The browser talks to the project in `src/environments/environment.ts` (URL + publishable key, public by design). Never commit the `service_role` key or the Google client secret. Google is configured in the Supabase dashboard for the hosted project; for the local stack copy `supabase/.env.example` to `supabase/.env`.
- Auth redirects: the hosted project must list `http://localhost:4200/**` (dev) and the production URL under Authentication > URL Configuration.

## Conventions

- **Commits** follow Conventional Commits, checked by commitlint (husky `commit-msg`). Scopes: `app|i18n|ui|catalog|collection|auth|db|pwa|ci|repo|deps|docs|release`. PRs are squash-merged and the PR title is the commit that drives the release.
- **UI** comes from `@grass-ds/*`. Anything grass-ds lacks lives in `src/app/shared/ui` as a shim, tagged with the gap number, and is deleted when grass-ds ships it. Record new gaps in grass-ds as described in [CLAUDE.md](CLAUDE.md).
- **Text** goes in `public/i18n/en.json` and `pt-BR.json`, never hard-coded.
- **Releases** use semantic-release (config in `.releaserc.json`); the release and deploy workflow arrives in M7.

## Licence

MIT. Card names, images and artwork belong to their owners; this project is not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company.
