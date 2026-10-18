# pull-binder

Mobile-first Angular PWA for managing physical Pokémon TCG cards. Vocabulary lives in [GLOSSARY.md](GLOSSARY.md); use those terms.

## grass-ds work

pull-binder consumes the sibling design system `grass-ds` (`../grass-ds`). When pull-binder needs something grass-ds lacks (a missing component, a limitation, a documentation gap), the work is recorded in grass-ds, never only in this repo.

- All information created for grass-ds TODOs (gap notes, issue drafts, TODO files, ADR proposals) must live on a **dedicated branch** in the grass-ds project, never on `main` and never as untracked files in its working tree. Branch name: `todo/from-pull-binder`.
- Before writing, check out that branch in grass-ds (create it from `main` if it does not exist). Commit there with Conventional Commits using the grass-ds scopes `tokens|css|angular|catalog|repo|deps|release`, typically `docs(repo): ...`.
- Do not merge that branch into `main` and do not push to `main` of grass-ds unless the user asks.
- The `consultant` agent is the one that researches and edits grass-ds. Tell it this rule whenever it is asked to record a gap.

## Git and GitHub

- Remote: `origin` is https://github.com/raphaelmdcoelho/pull-binder.git (public). Default branch: `main`.
- Commits follow Conventional Commits, enforced by the husky `commit-msg` hook (commitlint). Allowed scopes: `app|i18n|ui|catalog|collection|auth|db|pwa|ci|repo|deps|docs|release`. Never bypass the hooks with `--no-verify`.
- The user has authorised committing completed, verified work (lint, tests and build green) in logical commits. Pushing, opening PRs, and creating tags or releases still need an explicit request from the user; releases are produced only by the `release.yml` workflow.
- Never commit secrets, `.env*` files or the `.maestri/` folder.
