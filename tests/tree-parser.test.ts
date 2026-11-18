import { expect, test, vi } from 'vitest';
import { offlineGroupReady } from '../src/data/offline';
import { loadCachedRuntimeResources } from '../src/data/runtimeResources';
import { createTreeParser } from '../src/data/treeParser';

vi.mock('../src/data/offline', () => ({ offlineGroupReady: vi.fn() }));
vi.mock('../src/data/runtimeResources', () => ({ loadCachedRuntimeResources: vi.fn() }));

test('waits for the catalogue before choosing installed models on a cold editor load', async () => {
  const catalogue = Promise.withResolvers<void>();
  vi.mocked(loadCachedRuntimeResources).mockReturnValue(catalogue.promise);
  vi.mocked(offlineGroupReady).mockResolvedValue(false);
  const parser = createTreeParser();
  const pending = parser.parse('She left.', new AbortController().signal, 'constituency');
  expect(offlineGroupReady).not.toHaveBeenCalled();
  catalogue.resolve();
  await expect(pending).resolves.toBeUndefined();
  expect(vi.mocked(offlineGroupReady).mock.calls).toEqual([['tree-stanza'], ['tree-constituency']]);
});
