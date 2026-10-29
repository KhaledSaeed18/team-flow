import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const repo = 'https://github.com/KhaledSaeed18/team-flow';

/**
 * The marketing page is a plain Astro page at `/`; Starlight serves the docs from `src/content/docs/docs`, so they
 * live under `/docs`.
 */
export default defineConfig({
  site: 'https://teamflow.local',
  integrations: [
    starlight({
      title: 'TeamFlow',
      description: 'A real-time, keyboard-first agile workspace.',
      social: [{ icon: 'github', label: 'GitHub', href: repo }],
      editLink: { baseUrl: `${repo}/edit/main/apps/site/` },
      customCss: ['@fontsource-variable/schibsted-grotesk', './src/styles/starlight.css'],
      sidebar: [
        { label: 'Start here', items: ['docs', 'docs/getting-started'] },
        { label: 'Using TeamFlow', items: [{ autogenerate: { directory: 'docs/guides' } }] },
        { label: 'Architecture', items: [{ autogenerate: { directory: 'docs/architecture' } }] },
        { label: 'Reference', items: [{ autogenerate: { directory: 'docs/reference' } }] },
      ],
    }),
  ],
});
