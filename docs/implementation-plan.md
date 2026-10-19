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

### 5.1 `ci.yml` (pull_request)

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
   Decided in M7: the gate applies only to releases that add or change files under `supabase/migrations` (see section 16).

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

## 12. M4 as built (2026-10-19)

- `OwnedCardsRepository` (port) with a Supabase implementation. Adding inserts first; on a unique-key conflict (23505) it reads the row and updates `quantity` with a compare-and-swap (`.eq('quantity', old)`), retrying up to 4 times, and refreshes the snapshot columns. No SQL change was needed, so the hosted project needs nothing new. A server-side `add_owned_card` RPC would make it one atomic round trip; consider it if concurrent-tab races show up.
- `image_url` stores the Catalog image **base** URL (no size suffix); the app adds `/low.webp` or `/high.webp`.
- The add dialog (`gr-dialog`) is hosted once per page and opened with a Card or a card id (the search grid's quick add fetches the Card through the Catalog first). Language defaults to the Card's language, finishes are limited to the Card's own.
- Feedback: `StatusService` + `pb-status-region` (an always-present live region; role=status for success, role=alert for errors) stand in for a toast.
- The Collection page lists Owned cards newest first (up to 1000, no filters yet). The store reloads after an add and is cleared on sign-out.
- Verified on the local stack with Docker: real pgTAP 18/18 and `scripts/verify-local-rls.mjs` 15/15 (two real users, conflicts, compare-and-swap, cross-user isolation, anon).
- Missing grass-ds components used as shims: Toast (gap 7), Stepper (gap 11), Image/card grid (gap 9). Still missing and worked around with plain markup: Badge/Chip (gap 8, condition/language/finish shown as a text list), Empty state (gap 6), Select hint/error styling.

## 13. Interim deploy to Cloudflare Pages (2026-10-19)

Files: `public/_headers` (hashed JS/CSS immutable; `index.html`, `ngsw.json`, the service worker files, the manifest and `i18n/*` always revalidate; a few safe default headers), `public/_redirects` (`/* /index.html 200`, so deep links and the OAuth return URL load the SPA) and `.github/workflows/deploy.yml`.

`deploy.yml` runs on every push to `main` (and by hand). It first checks that `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_PROJECT_NAME` are set. If any is missing it prints a notice and ends green without building. Otherwise it runs `npm ci && npm run build` and `cloudflare/wrangler-action@v3` with `pages deploy dist/pull-binder/browser --branch=main`. It has no access to Supabase secrets; the app config only contains public values.

Compatibility with M7: the same three steps become the `deploy` job of `release.yml` (running after the release and the gated migration job, on the tag). When that lands, delete `deploy.yml` so a push does not deploy twice. The secret and variable names stay the same.

What the user must configure (once):

1. **Cloudflare project.** Dashboard, Workers & Pages, Create, Pages, "Upload assets" (Direct Upload, not Git). Name it, for example `pull-binder` (the URL is `https://<name>.pages.dev`), upload any small file to create it. The workflow replaces it on its first run. (CLI alternative: `npx wrangler pages project create pull-binder --production-branch main`.)
2. **API token.** My Profile, API Tokens, Create Token, Custom token: permission _Account, Cloudflare Pages, Edit_, account resources limited to your account. Nothing else.
3. **Account ID.** Shown on the right of the Workers & Pages overview (or in the dashboard URL).
4. **GitHub.** Repository Settings, Secrets and variables, Actions: secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; variable `CLOUDFLARE_PROJECT_NAME` (the project name from step 1).
5. **Run it.** Push to `main` or use Actions, Deploy, Run workflow. The first green run publishes to `https://<name>.pages.dev`.
6. **Supabase.** Authentication, URL Configuration: add `https://<name>.pages.dev/**` to Redirect URLs (and make it the Site URL once it is the main address). Without this, e-mail confirmation links and Google sign-in return to the wrong place.
7. **Google OAuth client.** Google Cloud Console, APIs & Services, Credentials, your Web client: add `https://<name>.pages.dev` to Authorised JavaScript origins. The authorised redirect URI stays `https://cfqqwlggqybyjhtkkiha.supabase.co/auth/v1/callback`.

Notes: only production (`--branch=main`) deploys use the project URL; Cloudflare also gives each deploy a unique `https://<hash>.<name>.pages.dev` address that is not in the Supabase or Google lists, so sign-in only works on the main URL. A custom domain, when added, needs the same two entries.

## 14. M5 as built (2026-10-19)

- `OwnedCardsRepository` gained `list(query, page)`, `summarize(query)`, `listSets()`, `update(id, patch)` and `remove(id)`. Everything runs in Postgres through supabase-js: `ilike` on `card_name` (typed `%`, `_` and `\` are escaped), `eq` filters for set, condition, language and finish, multi-column `order` ending in `id`, and `range` paging with one extra row to learn if more pages exist (30 per page, Load more button).
- Summary counts (distinct Owned cards and total copies) cover everything that matches the filters, not just the loaded pages. Without PostgREST aggregates (off by default), `summarize` reads only the `quantity` column in 1000-row chunks (capped at 50 chunks); `listSets` does the same for `set_id, set_name`. At a few thousand Owned cards this is cheap; a `collection_summary` RPC would replace it if collections grow far beyond that.
- Name search is a contains-match, which the existing `(user_id, lower(card_name) text_pattern_ops)` index cannot serve (it only helps prefix searches). Per user the table is small enough that a scan is fine; a `pg_trgm` index is the upgrade path. No migration was needed or written.
- Editing quantity and Condition: a Condition that already exists for the same card, Language and Finish **merges** the two (copies added, the edited row deleted). The merge is two statements (compare-and-swap add, then delete) and restores the target if the delete fails, so copies are never duplicated or lost; an atomic RPC (`merge_owned_cards`) would remove the small window and can be added later with a migration. Language and Finish identify an Owned card, so they are not editable (remove and add instead).
- Removing asks first in a Dialog (Cancel has the initial focus), states how many copies go and that it cannot be undone, then announces the result in the status region. There is no undo, so nothing promises one.
- The view state (filters, sort, loaded pages) lives in the root `CollectionStore`; filter and sort changes keep the current list on screen (`aria-busy`) while the new one loads. Sign-out resets it.
- Filters use a native `<details>` disclosure (shim for the missing bottom sheet, grass-ds gap 13), a Select per filter with "Any", and a Clear filters button; empty Collection and "filters hide everything" are different states.
- Local stack: pgTAP 18/18, `scripts/verify-local-rls.mjs` 23/23 (adds escaped ilike, ordering + range paging, the 23505 that triggers a merge, delete returning rows). The pgTAP test no longer assumes an empty database (it failed after the script had created users).

## 15. M6 as built (2026-10-19)

- **Name and icons.** The app is "Pull Binder" everywhere (index title, manifest `name` and `short_name`, `app.name` in both languages). The icons are an original leaf monogram on the theme green (#2f6f3a): `assets/icons/icon.svg` (rounded, "any") and `icon-maskable.svg` (full bleed, artwork inside the safe zone). `npm run icons` (`scripts/generate-icons.mjs`, devDependency `@resvg/resvg-js`) renders `public/icons/icon-{192,512}.png`, `icon-maskable-{192,512}.png`, `apple-touch-icon.png` (180), `favicon.svg` and `favicon.ico` (16/32/48). The PNGs are committed, so a normal build needs no image tooling. No Pokémon/Nintendo artwork.
- **Manifest.** `id` and `scope` `/`, `start_url` `/collection` (signed-out visitors are redirected to the login by the guard), `display: standalone`, `orientation: portrait`, theme #2f6f3a, white background, categories, `any` and `maskable` as separate icon entries, shortcuts to Search and Collection. `viewport-fit=cover` was already set and the shell pads with `env(safe-area-inset-*)`; index.html adds the Apple touch icon and the iOS web-app meta tags.
- **`ngsw-config.json`.** `app` (prefetch): index, manifest, favicons, `i18n/*.json`, icons, the hashed JS/CSS and the woff2 fonts, so a first launch while online is enough to start offline. `assets` (lazy) covers any other static image. Data groups: `tcgdex-api` (`https://api.tcgdex.net/v2/**`, strategy `freshness`, 4 s timeout, 200 entries, 7 days) and `tcgdex-images` (`https://assets.tcgdex.net/**`, strategy `performance`, 600 entries, 30 days). Both set `cacheOpaqueResponses: false`; `pb-card-image` now sets `crossorigin="anonymous"` (TCGdex sends `access-control-allow-origin: *`), so the responses are CORS responses and are really cached (an opaque response is not, and would count several MB of quota each). **Supabase is in no group, so the service worker never caches it.** Deviation: the Angular service worker has no stale-while-revalidate strategy. `freshness` (network first, cache after 4 s or on failure) gives the offline fallback; the app's own IndexedDB `CatalogCache` (M3) already serves stale-while-error and avoids repeat requests.
- **Update flow.** `UpdateService` (root) listens to `SwUpdate.versionUpdates` (`VERSION_READY`) and `unrecoverable`, checks every hour and whenever the app becomes visible. `pb-system-banners` (under the top bar, inside an always-present `aria-live="polite"` region) offers Reload (activates the version, then reloads) and Later. Nothing reloads by itself, so a half-filled form is never lost.
- **Connectivity.** `ConnectivityService` exposes an `online` signal from `navigator.onLine` and the window events. The banner says what still works. Add (search quick add, card detail, the Add dialog), Edit and Remove are disabled while offline with an explanatory note (`aria-describedby`), and the three dialogs and `CollectionStore.update/remove` also refuse (`offline` error) in case the connection drops while one is open. Search offline: the SW and `CatalogCache` answer searches already made; a new one shows "You're offline and this search isn't saved on this device". A 502/503/504 (what the service worker answers for a dead network) counts as a network error in the Catalog and Collection error mapping.
- **Collection offline.** `CollectionSnapshots` keeps one record in IndexedDB (`pull-binder-collection`): the unfiltered "recently updated" view (loaded pages, summary, sets, `userId`, `savedAt`). `CollectionStore` saves it after each successful unfiltered load, load more, edit, remove and add (when the view is filtered, a write rebuilds it from a fresh first page). Offline, or when the network call fails, the store serves it and applies the filters and sort on the device (`applyCollectionQuery`); the page says when it was saved and, when the user had not scrolled through everything, that only the loaded cards are saved. Returning online reloads the live list. Privacy: the record carries the user id and is only returned to that user, it replaces the previous user's record, and signing out (or the session changing to nobody) deletes it and resets the store.
- **Offline start.** supabase-js retries a failed token refresh for up to about 30 seconds and then reports no session, which would block start-up and then send the user to the login. `AuthService.init` therefore starts from the login stored by the client (`sb-<ref>-auth-token`) when the browser is offline or the client takes over 3 s, and ignores the client's "no session" start-up event in that case. Once online the client refreshes the token itself, or signs the user out if the login was revoked.
- **`_headers`** still matches: `index.html`, `ngsw.json`, the worker files, the manifest and `i18n/*` revalidate; `/main-*`, `/chunk-*`, `/styles-*`, `/media/*` are immutable. Icons and favicons keep Cloudflare's default (revalidate), and the service worker's hash check keeps its copy fresh.
- **Verified in a real Chromium** (served from `dist`, outside the repo): the service worker activates, `Page.getInstallabilityErrors` is empty, the manifest has no errors, an offline reload shows the shell, a seeded expired login plus a saved Collection opens offline with the banner, the saved list, disabled Edit/Remove and working filters, and a TCGdex image and API response land in the SW caches as `cors` responses. Not verified: an actual phone install, and the update prompt against a real second deploy (covered by unit tests with a fake `SwUpdate`).
- **Known limits.** With a "connected but dead" network (`navigator.onLine` true), supabase-js may wait up to about 30 s before the Collection falls back to the saved copy. Offline writes are out of scope (the plan's "Later"). Saved pages only cover what had been scrolled; a very large Collection is partial offline by design.

## 16. M7 as built (2026-10-19)

### Release flow

`.github/workflows/release.yml` runs on every push to `main` (and by hand). Everything is one workflow because tags created with `GITHUB_TOKEN` do not trigger other workflows.

1. **`release`** (permissions `contents: write`): `npx semantic-release` with `commit-analyzer`, `release-notes-generator`, `exec` (writes `published` and `version` to `$GITHUB_OUTPUT`) and `github` (tag `vX.Y.Z` and the GitHub Release; no issue/PR comments, so no extra permissions). No `git` plugin (no commit back to `main`, so branch protection stays strict), no npm publish, no changelog file (the GitHub Release holds the notes). A following step compares the new tag with the previous one and sets `migrations=true` when files under `supabase/migrations` were added or changed. The first release has no previous tag and counts as having migrations.
2. **`migrate`** (only when `migrations=true`, environment **`production-db`**, which the owner configures with required reviewers): `supabase link`, `supabase migration list`, `supabase db push --dry-run`, `supabase db push`, with CLI 2.121.0 pinned. Fails with a pointer to the one-time alignment below if the histories disagree. Missing secrets/variables fail with a clear message.
3. **`deploy`** (environment **`production`**): checks out the tag, installs, stamps the version (`scripts/stamp-version.mjs` rewrites `src/app/version.ts`; the Account page shows `Version 1.2.3 (abc1234)`, local builds show `dev`), builds and runs `cloudflare/wrangler-action@v4` (`wranglerVersion: 4`). It runs when a release was published and `migrate` was skipped or succeeded; a failed or cancelled `migrate` blocks it, so the new front end never meets an old schema. Migrations must therefore stay backward compatible with the previous release (expand, then contract in a later release).

`workflow_dispatch` has a `redeploy` option: it skips semantic-release and deploys the latest tag again (for example after fixing a Cloudflare secret).

**Pushes with no releasable commit** (only `docs`, `test`, `chore`, `ci`, `refactor`, `style`, `build`): no tag, no release, **no deploy**. Rationale: the live site then always equals a tagged, reproducible version shown on the Account page; a docs/CI-only merge cannot change the app; and a deploy that changes nothing still costs a build and risks an unreviewed state. The trade-off is that `chore(deps)` merges (Dependabot) reach the site only with the next `feat`/`fix`; retitle the PR `fix(deps): ...` when a dependency bump must go live (squash merge uses the PR title), or merge it together with a `fix`. The `redeploy` dispatch only redeploys the latest tag, it never ships unreleased commits. Because the history already contains `feat` commits, the first run after the M7 merge creates **v1.0.0** and deploys it.

`ci.yml` (pull requests): `Commitlint` job and `Lint, test, build` job (lint, format check, unit tests, SQL checks, production build, Playwright smoke). `deploy.yml` was deleted. Concurrency cancels superseded PR runs; `release.yml` queues instead of cancelling. Permissions are `contents: read` everywhere except the `release` job (`contents: write`); `keepalive.yml` has none. Third-party actions are pinned by major version (`actions/*@v7`, `cloudflare/wrangler-action@v4`, `supabase/setup-cli@v1`); Dependabot keeps them current.

### One-time migration history alignment

The hosted project recorded its three migrations under the versions the connector generated: `20261019015532` (profiles), `20261019015539` (owned_cards), `20261019015541` (ping). The repository files had been named `20261018120000/0100/0200`, so the CLI would have considered the hosted ones unknown and the local ones unapplied.

**Fix applied in this PR (no hosted change, no manual step):** the three local files were renamed to the hosted versions (`git mv`; contents untouched). The CLI now sees identical histories and `supabase db push` reports "Remote database is up to date". `scripts/validate-sql.mjs` also rejects migration names that are not `<14 digits>_<snake_case>.sql` or that repeat a version.

**Before the first release, the owner should confirm** (read-only) that the histories match:

```sh
npx supabase login                       # or export SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref cfqqwlggqybyjhtkkiha
npx supabase migration list              # Local and Remote columns must show the same 3 versions
npx supabase db push --dry-run           # must say "Remote database is up to date"
```

If instead the Remote column shows other versions than the local files (for example the history was changed again), the alternative that touches only the history table, not the schema, is:

```sh
npx supabase migration repair --status reverted <each remote version not in the repo>
npx supabase migration repair --status applied  <each local version missing remotely>
```

Check the SQL of each file against what is deployed before marking it applied. Never mark a migration applied that has not run.

### Keep-alive

`keepalive.yml` runs weekly (Mondays 09:00 UTC) and by hand. It POSTs to `https://<ref>.supabase.co/rest/v1/rpc/ping` with the publishable key in the `apikey` header (the key is public by design, so it is a variable, not a secret) and fails with an error annotation unless the body is exactly `true`. GitHub disables scheduled workflows after 60 days without repository activity; any push or merged PR re-arms it.

### Playwright smoke test

`npm run e2e` (config `playwright.config.ts`, tests `e2e/smoke.e2e.ts`, Chromium, Pixel 7 profile) runs against the production build served by `scripts/serve-dist.mjs` (static files with the `/* /index.html` fallback, like `_redirects`). Supabase and TCGdex requests are answered by `page.route`, the service worker is blocked, and a test asserts that nothing else leaves localhost. It checks: a signed-out visit to `/collection` redirects to `/login`; the language switch on the Account page (plus the version line); the empty Collection and a mocked empty search; the manifest and its icons are reachable and valid. The sign-in is a fabricated, unexpired session in `localStorage`, so no credentials exist. Locally: `npm run build && npm run e2e` (`npx playwright install chromium` once; `PW_CHROMIUM_PATH` uses an installed browser).

### What the owner must create in GitHub

Repository, Settings, Secrets and variables, Actions:

| Kind     | Name                       | Value                                                             |
| -------- | -------------------------- | ----------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`     | Already set (Cloudflare Pages, Edit)                              |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`    | Already set                                                       |
| Variable | `CLOUDFLARE_PROJECT_NAME`  | Already set (`pull-binder`)                                       |
| Secret   | `SUPABASE_ACCESS_TOKEN`    | Supabase dashboard, Account, Access Tokens (a new personal token) |
| Secret   | `SUPABASE_DB_PASSWORD`     | The database password of the project                              |
| Variable | `SUPABASE_PROJECT_REF`     | `cfqqwlggqybyjhtkkiha`                                            |
| Variable | `SUPABASE_PUBLISHABLE_KEY` | The public `sb_publishable_...` key (same as in `environment.ts`) |

Settings, Environments:

- **`production-db`**: add yourself under Required reviewers (and tick "Prevent self-review" only if someone else can approve). Optionally restrict deployment branches to `main`. Secrets can live at repository level.
- **`production`**: no reviewers needed (deploys after the gate). Restrict to `main` if you like.

Settings, Actions, General: Workflow permissions can stay "Read repository contents" (the release job asks for `contents: write` itself). Enable "Allow GitHub Actions to create and approve pull requests" only if you later want it; it is not needed.

### Branch protection for `main` (Settings, Branches, Add rule, or a ruleset)

- Require a pull request before merging (no direct pushes; include administrators if you want the rule to bind you too).
- Require status checks to pass: **`Commitlint`** and **`Lint, test, build`**; require branches to be up to date.
- Allow squash merging only, default message "Pull request title"; the PR title must be a Conventional Commit because it becomes the commit semantic-release reads.
- Require linear history; block force pushes and deletions.
- Do not require signed commits unless you set up signing (the release bot's tag is not a commit on `main`).
- Because the release job pushes only a tag and never a commit, no bypass for `github-actions[bot]` is needed.

### Risks

- A failed `deploy` after a successful `release` leaves a tag and Release without a live deploy: re-run the job or use the `redeploy` dispatch; do not re-run `release`.
- Rejecting the `production-db` approval leaves the tag without a deploy and the migration unapplied.
- The Cloudflare per-deploy hash URLs are still not in the Supabase/Google redirect lists (only the main URL signs in).
