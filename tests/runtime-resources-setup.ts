import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

// Test-only seeding preserves isolated Node fixtures without a production catalogue import.
vi.mock('../src/data/runtimeResources', async () => {
  const module = await vi.importActual<typeof import('../src/data/runtimeResources')>('../src/data/runtimeResources');
  module.applyRuntimeCatalogue(JSON.parse(readFileSync('public/resources/catalogue.json', 'utf8')));
  return { ...module, loadRuntimeResources: vi.fn(async () => module.runtimeResources) };
});
