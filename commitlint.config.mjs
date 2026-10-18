export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'app',
        'i18n',
        'ui',
        'catalog',
        'collection',
        'auth',
        'db',
        'pwa',
        'ci',
        'repo',
        'deps',
        'docs',
        'release',
      ],
    ],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
