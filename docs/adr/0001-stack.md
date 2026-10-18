# 0001 Stack

Status: accepted (2026-10-18)

## Decision

- Angular 22, strict TypeScript, standalone components, signals, `@angular/service-worker` PWA.
- UI from `@grass-ds/angular` and `@grass-ds/css` 0.6.0 (npm). Gaps are covered by temporary shims in `src/app/shared/ui` and recorded in grass-ds, never only here.
- Transloco for `en` and `pt-BR`, switched at runtime. The UI language is not the Language printed on a card.
- Supabase (Postgres, Auth, RLS) for data; TCGdex for the Catalog; Cloudflare Pages for hosting; GitHub Actions for CI and releases. All on free tiers.
- npm as package manager (the sibling grass-ds uses pnpm; nothing here is shared with it).

## Consequences

Everything is replaceable behind a service (`CatalogService`, the owned-cards repository). The plan and milestones are in [implementation-plan.md](../implementation-plan.md).
