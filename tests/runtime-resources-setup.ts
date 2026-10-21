import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { loadUiLocale } from '../src/locales';
import { localeSchema } from '../src/shared/locale';

await Promise.all(localeSchema.options.map(loadUiLocale));

// Seed isolated Node fixtures without importing production catalogues.
vi.mock('../src/data/runtimeResources', async () => {
  const module = await vi.importActual<typeof import('../src/data/runtimeResources')>('../src/data/runtimeResources');
  module.applyRuntimeCatalogue(JSON.parse(readFileSync('public/resources/catalogue.json', 'utf8')));
  return { ...module, loadRuntimeResources: vi.fn(async () => module.runtimeResources) };
});
