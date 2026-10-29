import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // UI strings stay Starlight's defaults; the collection exists so the build need not warn about it.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
