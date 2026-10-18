# PullBinder

Mobile-first PWA for managing your physical Pokémon TCG cards. Vocabulary: [GLOSSARY.md](GLOSSARY.md). Plan and milestones: [docs/implementation-plan.md](docs/implementation-plan.md).

Status: M0 (tooling) and M1 (shell, i18n, UI shims) are done. Login, catalog search and the collection come in later milestones.

## Develop

Node 26 (`nvm use`) and npm.

```sh
npm ci
npm start            # http://localhost:4200
npm run lint
npm test -- --watch=false
npm run format:check
npm run build        # dist/pull-binder/browser (production, with the service worker)
```

To try the service worker locally, serve the build: `npx http-server dist/pull-binder/browser -p 8080 -c-1`.

## Conventions

- **Commits** follow Conventional Commits, checked by commitlint (husky `commit-msg`). Scopes: `app|i18n|ui|catalog|collection|auth|db|pwa|ci|repo|deps|docs|release`. PRs are squash-merged and the PR title is the commit that drives the release.
- **UI** comes from `@grass-ds/*`. Anything grass-ds lacks lives in `src/app/shared/ui` as a shim, tagged with the gap number, and is deleted when grass-ds ships it. Record new gaps in grass-ds as described in [CLAUDE.md](CLAUDE.md).
- **Text** goes in `public/i18n/en.json` and `pt-BR.json`, never hard-coded.
- **Releases** use semantic-release (config in `.releaserc.json`); the release and deploy workflow arrives in M7.

## Licence

MIT. Card names, images and artwork belong to their owners; this project is not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company.
