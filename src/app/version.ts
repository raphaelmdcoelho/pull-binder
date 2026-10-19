/**
 * The deployed version. `scripts/stamp-version.mjs` rewrites this file in the deploy job of
 * release.yml (with the release tag and commit); local and CI builds show "dev".
 */
export const APP_VERSION = 'dev';
export const APP_COMMIT = '';
