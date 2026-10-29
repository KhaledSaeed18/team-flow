import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'web',
        'site',
        'worker',
        'db',
        'auth',
        'contract',
        'domain',
        'realtime',
        'email',
        'ui',
        'deps',
        'ci',
        'adr',
        'tooling',
        'release',
      ],
    ],
    'body-max-line-length': [0],
  },
};

export default config;
