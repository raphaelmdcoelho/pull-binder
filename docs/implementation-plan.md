# Implementation plan

Status: draft, nothing scaffolded yet. Vocabulary follows [GLOSSARY.md](../GLOSSARY.md) (Card, Catalog, Owned card, Collection, Condition, Finish, Language). Rules for grass-ds gaps are in [CLAUDE.md](../CLAUDE.md).

## 1. Agreed decisions

| Area     | Decision                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Angular 22, TypeScript strict, standalone components, signals, PWA (`@angular/service-worker`)                                                                                              |
| UI       | `@grass-ds/*` from npm; temporary shims in `src/app/shared/ui` for the P0 gaps (app shell, tab bar, Select, Search field, Spinner/Skeleton) per `../grass-ds/docs/TODO-FROM-pull-binder.md` |
| i18n     | Transloco, `en` + `pt-BR`, runtime switch (UI language is separate from card **Language**)                                                                                                  |
| Catalog  | TCGdex behind a `CatalogService` adapter; images hotlinked, never re-hosted                                                                                                                 |
| Backend  | Supabase: Postgres, Auth (email + Google), RLS, SQL migrations in repo, local Supabase CLI for dev, one hosted prod project, weekly keep-alive                                              |
| Hosting  | Cloudflare Pages (direct upload from GitHub Actions)                                                                                                                                        |
| Offline  | Installable, opens offline, read-only (no offline writes in MVP)                                                                                                                            |
| Repo     | Public GitHub; Conventional Commits + commitlint + husky + semantic-release, same conventions as grass-ds                                                                                   |
| MVP      | Login; search Catalog; add Owned card (quantity, Condition, Language, Finish); browse/filter Collection                                                                                     |

## 2. Open points to confirm (defaults chosen, cheap to change)

1. **Card snapshot columns.** Default: `owned_cards` stores `card_id` plus a small denormalised snapshot (`card_name`, `set_id`, `set_name`, `card_number`, `image_url`) so the Collection can be filtered, sorted and shown offline without N calls to TCGdex. The snapshot is a cache of Catalog data, not user-editable, refreshed whenever the card is re-fetched. Alternative: ids only and hydrate from TCGdex (smaller DB, slower, filtering by set/name impossible server-side).
2. **Finish "other".** Default: Finish is a fixed set (`normal`, `holo`, `reverse_holo`, `other`); the Catalog restricts which are selectable per Card.
3. **Language values.** Default: TCGdex language codes (`en`, `pt`, `fr`, `de`, `es`, `it`, `ja`, ...), stored as text with a check against a short list kept in one migration.
4. **Test runner.** Default: whatever `ng new` generates for Angular 22; Playwright smoke test added in M7 only.

## 3. Repo layout

```
pull-binder/
  CLAUDE.md  GLOSSARY.md  README.md  LICENSE
  package.json  angular.json  tsconfig*.json  ngsw-config.json
  commitlint.config.js  .releaserc.json  .husky/{commit-msg,pre-commit}
  .github/
    workflows/{ci.yml,release.yml,keepalive.yml}
    dependabot.yml  PULL_REQUEST_TEMPLATE.md
  docs/  implementation-plan.md  adr/  runbook.md
  public/  manifest.webmanifest  icons/  _headers  _redirects  i18n/{en,pt-BR}.json
  supabase/
    config.toml  seed.sql
    migrations/<timestamp>_*.sql
    tests/*.sql                      # pgTAP RLS tests (supabase test db)
  src/
    environments/                    # generated at build, see 6.4
    app/
      app.config.ts  app.routes.ts
      core/        auth/ (session, guards)  supabase/ (client token)  i18n/  pwa/ (update, online status)
      catalog/     catalog.service.ts (abstract port) + tcgdex/ (adapter, mapping, cache)
      collection/  owned-cards.repository.ts  collection.store.ts  pages/ components/
      shared/      ui/ (grass-ds shims, one folder per shim)  pipes/  models/
      features/    login/ search/ collection/ card-detail/ account/
```

Rules: features import `catalog` through the abstract `CatalogService` only; only `core/supabase` and `collection/owned-cards.repository.ts` talk to supabase-js; shims in `shared/ui` carry a `// TODO(grass-ds #n)` comment with the gap number so they are easy to find and delete.

## 4. Milestones (vertical slices, in order)

Each milestone ends green on CI and is releasable via semantic-release.

**M0 Foundations (no features)**

- `ng new`, strict mode, PWA schematic, Transloco, grass-ds packages + tokens/css wired, ESLint, Prettier.
- husky + commitlint + semantic-release config; `ci.yml` (lint, test, build). Branch protection on `main`.
- ADRs: 0001 stack, 0002 CatalogService adapter, 0003 snapshot columns (if confirmed).
- Done when: empty app builds, CI green, first commit message is validated.

**M1 Shell, i18n, shims**

- App shell + top bar, bottom tab bar (Search, Collection, Account), Select, Search field, Spinner/Skeleton shims in `shared/ui`; routing; language switcher (en / pt-BR, persisted in localStorage, default from `navigator.language`).
- Done when: navigable empty screens, both languages, 44px targets, safe-area insets, Lighthouse a11y ≥ 95.

**M2 Supabase + Auth**

- `supabase init`, `config.toml` (Google provider via env, redirect URLs), migration 0001 `profiles` + trigger, RLS + pgTAP test.
- Auth service (signals): email+password sign-up/sign-in/out, password reset, Google OAuth; route guard; login/sign-up screens; session restore.
- Done when: a user can sign up locally, log out, log in with Google against local stack, profile row created, unauthenticated users are redirected.

**M3 Catalog search**

- `CatalogService` port: `searchCards(query, lang, page)`, `getCard(id, lang)`, `listSets(lang)`. TCGdex adapter via `@tcgdex/sdk`, mapped to our `Card` model (id, name, set, number, images, available finishes).
- Search screen: debounced field, skeleton, Load more, empty/error states; card detail page. Results cached in memory + IndexedDB (idb-keyval) with TTL.
- Done when: search works in en and pt, errors/timeouts handled, adapter has unit tests with recorded fixtures.

**M4 Add Owned card**

- Migration 0002 `owned_cards` + RLS + pgTAP tests. Repository with upsert-merge on the natural key (adding the same card/condition/language/finish increments quantity).
- Add sheet/dialog: quantity stepper (shim: number input), Condition select, Language select, Finish select (limited to Finishes the Catalog lists). Toast-like confirmation (own `role="status"`).
- Done when: added cards persist per user; a second user cannot see or change them (pgTAP + manual).

**M5 Browse and filter Collection**

- Collection grid/list, quantity badge, filters (set, Condition, Language, Finish, name text), sort, edit quantity/attributes, delete. Server-side filtering via PostgREST using snapshot columns; paging with Load more.
- Migration 0003 indexes.
- Done when: 1,000 Owned cards stay responsive; filters combine; edits merge correctly when they collide with an existing Owned card.

**M6 PWA + offline read-only**

- Manifest (name, icons incl. maskable, `display: standalone`, theme colours), `ngsw-config.json`, update prompt, online/offline indicator. Collection list persisted to IndexedDB after each successful fetch and served when offline; write actions disabled offline with explanatory message.
- Done when: installable on Android/iOS, airplane-mode launch shows the last Collection and cached card images, add/edit buttons disabled with a hint.

**M7 Release pipeline end to end**

- `release.yml` (see 5.2), Cloudflare project, Supabase migrations job with environment approval, `keepalive.yml`, `_headers`/`_redirects`, README (setup, scripts, architecture), runbook, Playwright smoke test (login page renders, language switch).
- Done when: merging a `feat:` commit to `main` produces vX.Y.Z tag + GitHub Release + live deploy; a migration PR waits for approval.

**M8 Hardening before sharing**

- Security review of RLS/grants (`supabase get_advisors`-style checks), rate-limit/auth settings, error tracking decision, privacy note, swap shims for released grass-ds components as they ship (tracked per gap).

Later (not in plan): Binders, Wishlist, offline writes, prices, import/export.

## 5. CI/CD

### 5.1 `ci.yml` (pull_request + push to non-main)

Jobs run on `ubuntu-latest`, Node pinned via `.nvmrc`, npm cache.

1. `lint`: eslint, prettier --check, commitlint on the PR commits (`--from base --to head`).
2. `test`: unit tests headless.
3. `build`: `ng build` production (config generated as in 6.4 with dummy values), upload `dist` artifact; fail if bundle budgets exceeded.
4. `db` (only when `supabase/**` changed): `supabase start`, `supabase db reset`, `supabase test db`, `supabase db lint`.
   Concurrency: cancel in-progress per ref. Permissions: `contents: read`.

### 5.2 `release.yml` (push to `main`)

Single workflow so the default `GITHUB_TOKEN` limitation (tags it creates do not trigger other workflows) is irrelevant.

1. `release` job: checkout `fetch-depth: 0`, install, run semantic-release (plugins: commit-analyzer, release-notes-generator, changelog, `@semantic-release/npm` with `npmPublish: false`, github, git for `CHANGELOG.md` + `package.json`). Permissions: `contents: write`, `issues: write`, `pull-requests: write`. Output `new_release_published` and `new_release_version` (via `@semantic-release/exec` writing to `$GITHUB_OUTPUT`).
2. `migrate` job (`needs: release`, `if: published`, `environment: production-db` with required reviewer): `supabase link --project-ref $SUPABASE_PROJECT_REF`, `supabase db push`. Runs before deploy so the new frontend never meets an old schema; migrations must stay backward compatible with the previous release (expand/contract).
3. `deploy` job (`needs: [release, migrate]`): checkout at the release tag, generate environment file, `ng build`, `cloudflare/wrangler-action` with `pages deploy dist/pull-binder/browser --project-name=pull-binder --branch=main`. Environment `production` (URL = site URL).
   Concurrency group `release`, no cancel. If `migrate` is skipped (no `supabase/migrations` diff) `deploy` still runs: use `if: always() && needs.release.outputs.published == 'true' && needs.migrate.result != 'failure'`.
   Open question for implementation: whether the approval gate should apply to every release or only releases that contain migrations (the latter needs a path-diff step choosing between two jobs).

### 5.3 `keepalive.yml`

Cron weekly (`0 9 * * 1`) + `workflow_dispatch`. `curl -fsS` POST to `$SUPABASE_URL/rest/v1/rpc/ping` with the publishable key. `ping()` is a `security invoker` SQL function returning `true`, `grant execute ... to anon`. Fails loudly (GitHub emails on failure). GitHub disables scheduled workflows after 60 days of repo inactivity; semantic-release commits and the user's activity cover this, noted in the runbook.

### 5.4 Other

Dependabot (npm + github-actions, weekly, `chore(deps):` prefix to satisfy commitlint). PR template with Conventional Commit reminder. Branch protection: require `lint`, `test`, `build`, linear history, squash merge with PR title validated as Conventional Commit (so the squash message drives semantic-release).

## 6. Data and security

### 6.1 Schema sketch (migrations, SQL only)

```sql
-- 0001
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_locale text check (preferred_locale in ('en','pt-BR')),
  created_at timestamptz not null default now()
);
-- trigger on auth.users insert -> insert profiles row (security definer, search_path = '')

-- 0002
create type public.card_condition as enum
  ('near_mint','lightly_played','moderately_played','heavily_played','damaged');
create type public.card_finish as enum ('normal','holo','reverse_holo','other');

create table public.owned_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id text not null,                       -- TCGdex id, e.g. 'base1-4'
  language text not null,                      -- printed Language, e.g. 'en','pt'
  condition public.card_condition not null,
  finish public.card_finish not null,
  quantity integer not null check (quantity between 1 and 9999),
  -- Catalog snapshot (cache, see open point 1)
  card_name text not null, card_number text, set_id text not null,
  set_name text not null, image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, card_id, language, condition, finish)
);
-- 0003 indexes: (user_id, set_id), (user_id, lower(card_name) text_pattern_ops), (user_id, updated_at desc)
-- moddatetime trigger for updated_at
```

Deleting an Owned card = delete the row (no soft delete). Quantity 0 is not allowed; reaching 0 deletes.

### 6.2 RLS and grants

```sql
alter table public.owned_cards enable row level security;
revoke all on public.owned_cards from anon, authenticated;
grant select, insert, update, delete on public.owned_cards to authenticated;   -- explicit grants: required by Supabase's Data API change
create policy owned_cards_select on public.owned_cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy owned_cards_insert on public.owned_cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy owned_cards_update on public.owned_cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owned_cards_delete on public.owned_cards for delete to authenticated
  using ((select auth.uid()) = user_id);
-- profiles: select/update own row only; no insert policy (trigger creates it)
-- ping(): the only object granted to anon
```

Collection is private by definition (glossary), so no sharing policies. pgTAP tests: user A cannot select/insert-as/update/delete user B's rows; anon sees nothing; unique-key merge behaviour.

### 6.3 Auth configuration

Email sign-up with confirmation on prod (off locally), password min length 8, Google provider, Site URL = production URL, redirect allow-list = prod URL, Cloudflare preview pattern (if used), `http://localhost:4200`. Rate limits left at defaults.

### 6.4 Frontend configuration

The publishable (anon) key and project URL are public by design. Build step writes `src/environments/environment.ts` from env vars (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) via a small node script (`scripts/gen-env.mjs`), so nothing is committed and CI/dev/prod differ only by variables. The service role key is never used in the repo or the frontend.

### 6.5 Catalog, images and PWA caching

- TCGdex responses: service-worker `dataGroups` with `freshness`/short timeout for search, `performance` with long maxAge for card detail by id.
- Images (hotlinked from TCGdex assets): `assetGroups` lazy + `dataGroups` cache with size cap (e.g. 300 entries, 30d). Cross-origin images without CORS are cached opaque; acceptable, but cap entries and verify quota behaviour (opaque responses are padded in quota accounting). Always render with `loading="lazy"`, explicit 63:88 ratio and a fallback on error.
- `_headers`: `ngsw.json` and `index.html` `no-cache`; hashed assets `immutable`. `_redirects`: `/* /index.html 200`. Add a CSP in M8 allowing the Supabase, TCGdex API and TCGdex assets origins.
- Credit/disclaimer in the About screen: not affiliated with Nintendo/The Pokemon Company; card images belong to their owners; data from TCGdex.

## 7. Secrets, variables and environments

| Name                                        | Kind                     | Where                                                             | Used by                                                                                         |
| ------------------------------------------- | ------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`                     | secret                   | GitHub (environment `production-db`)                              | migrate                                                                                         |
| `SUPABASE_DB_PASSWORD`                      | secret                   | GitHub (environment `production-db`)                              | migrate                                                                                         |
| `SUPABASE_PROJECT_REF`                      | variable                 | GitHub repo                                                       | migrate, keepalive                                                                              |
| `SUPABASE_URL`                              | variable                 | GitHub repo                                                       | build, keepalive                                                                                |
| `SUPABASE_PUBLISHABLE_KEY`                  | variable (public)        | GitHub repo                                                       | build, keepalive                                                                                |
| `CLOUDFLARE_API_TOKEN`                      | secret (Pages:Edit only) | GitHub (environment `production`)                                 | deploy                                                                                          |
| `CLOUDFLARE_ACCOUNT_ID`                     | variable                 | GitHub repo                                                       | deploy                                                                                          |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secrets                  | Supabase dashboard (prod) and local `supabase/.env` (git-ignored) | Auth                                                                                            |
| `GITHUB_TOKEN`                              | automatic                |                                                                   | semantic-release (needs write perms, no PAT unless branch protection blocks the release commit) |

If branch protection blocks semantic-release's `git` plugin commit (CHANGELOG/package.json), either drop that plugin (changelog lives in GitHub Releases only) or allow the Actions bot to bypass. Default: drop the `git` plugin to avoid the PAT.

## 8. Manual steps only the user can do

1. **GitHub**: create the public repo `pull-binder`; enable Actions; create environments `production` and `production-db` (required reviewer = you on the latter); set branch protection on `main` after M0 CI exists; set squash-merge with "PR title" as the commit message.
2. **Supabase**: create a free account and ONE prod project (choose a region near you, save the DB password); create an access token (Account > Access Tokens); copy project ref, URL and publishable key. Under Auth > URL Configuration set Site URL and redirect URLs once the Cloudflare URL is known. Confirm "email confirmations" on and review SMTP (the default sender is heavily rate-limited; fine for personal use, a custom SMTP is needed before inviting many users).
3. **Google Cloud**: create a project, OAuth consent screen (External, test mode is fine at first, add yourself as test user, then publish to avoid the 7-day test token expiry), OAuth client of type Web with authorised redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` (and `http://127.0.0.1:54321/auth/v1/callback` for local). Paste client id/secret into Supabase and `supabase/.env`.
4. **Cloudflare**: create a free account; create the Pages project `pull-binder` (Direct Upload, not Git integration); create an API token with "Cloudflare Pages: Edit" scoped to the account; note the account id. Optional later: custom domain.
5. **Add secrets/variables** from section 7 in GitHub.
6. **Local machine**: Docker (for `supabase start`), Node (version in `.nvmrc`), Supabase CLI, `npm login` is NOT needed unless `@grass-ds/*` is private (confirm; if the packages are on a private registry a read token is needed locally and as a CI secret).
7. **Assets**: app name/icon (192, 512, maskable) and theme colour decision.
8. **Decisions**: confirm open points in section 2; decide the project licence (suggested MIT for code) and whether the prod project is also used for demo data.
9. **Ongoing**: approve `production-db` deployments; watch the keep-alive failure email; restore the Supabase project from the dashboard if it ever pauses.

## 9. Risks and mitigations

| Risk                                    | Mitigation                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TCGdex has no published limits/SLA      | Cache aggressively, adapter allows swapping source, self-hostable Docker image as fallback                                |
| Card art IP                             | Hotlink only, personal/non-commercial, disclaimer; revisit before any monetisation                                        |
| Supabase free project pauses            | Weekly keep-alive; accepted by the user; offline read-only softens the impact                                             |
| Migration breaks running app            | Migrations run before deploy and must be expand/contract; approval gate                                                   |
| grass-ds gaps                           | Shims isolated in `shared/ui` with TODO tags; gaps recorded only on grass-ds branch `todo/from-pull-binder` per CLAUDE.md |
| Opaque cached images fill SW quota      | Entry cap + max age; fallback placeholder                                                                                 |
| GitHub disables cron after 60 days idle | Documented; any push re-enables; keep-alive failure is visible                                                            |
| Google OAuth test mode token expiry     | Publish consent screen before real use                                                                                    |

## 10. M2 as built (2026-10-19)

- `owned_cards` indexes ship in the M2 migration (plan had them in M5); `ping()` is its own migration.
- Language is validated by pattern (`^[a-z]{2}(-[a-z]{2})?$`), not a fixed list, so new TCGdex languages need no migration.
- The environment file is committed (public URL and publishable key) instead of generated by `scripts/gen-env.mjs`; revisit if per-environment values are needed in CI.
- Migrations are validated with PGlite (`npm run test:sql`) because Docker is not available on the dev machine; `supabase test db` is still the authority.
- Auth runs the PKCE flow. Email confirmations are expected on in the hosted project; the UI handles both cases.

## 11. M3 as built (2026-10-19)

- `CatalogService` (abstract class) in `src/app/catalog`; `TcgdexCatalogService` uses `HttpClient` against `https://api.tcgdex.net/v2` (no SDK: three endpoints, and the SDK would add weight and hide the cache). `CatalogCache` is memory first, IndexedDB behind it (`idb-keyval`), search pages cached 24 h, cards 7 days, stale data served when the network fails.
- Language: UI `pt-BR` maps to TCGdex `pt`. An empty first page in a non-English language retries in English and says so; `getCard` falls back on 404.
- TCGdex returns no total count, so Load more shows while a page is full (20).
- Images are hotlinked as `<image base>/low.webp` (grid) and `/high.webp` (detail). API and assets send `access-control-allow-origin: *`, so the M6 service worker can cache them without opaque responses.
- `SearchStore` is root-scoped so results survive tab switches; stale answers to older queries are dropped. A card detail page (`/card/:id`) was added because M4's add form starts from it.
- New shim: `pb-card-image` and the card grid CSS (grass-ds gap 9).
