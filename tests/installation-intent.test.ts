import { beforeEach, expect, it, vi } from 'vitest';
import { installOfflineResources, removeOfflineResources } from '../src/data/offline';
import { installResourcePack } from '../src/data/resourcePack';
import resources from '../content/offline-resources.json';
import { db, settings, syncEvents } from '../src/data/db';
import { officialContentHash, saveInstallationIntent, readInstallationIntents } from '../src/data/installationIntent';
import { appendSyncEvent, readSyncEvents } from '../src/data/sync';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('captures exact official hashes once per choice and preserves scoped intentions through backups', async () => {
  for (const group of resources.groups) expect((await officialContentHash(group.id)).slice(0, 16)).toBe(group.version);
  await expect(officialContentHash('unknown')).rejects.toThrow('UNKNOWN_PACKAGE');
  await saveInstallationIntent('local-guest', 'grammar', true);
  await Promise.all([saveInstallationIntent('local-guest', 'grammar', true), saveInstallationIntent('local-guest', 'grammar', true)]);
  expect(await syncEvents.count()).toBe(1);
  const first = (await readSyncEvents('local-guest'))[0];
  expect(first).toMatchObject({ type: 'installation', payload: { contentId: 'grammar', contentHash: await officialContentHash('grammar'), wanted: true } });
  expect([...(await readInstallationIntents('local-guest')).current]).toEqual(['grammar']);
  expect((await readInstallationIntents('other')).current.size).toBe(0);
  await saveInstallationIntent('local-guest', 'grammar', false);
  expect((await readInstallationIntents('local-guest')).current.size).toBe(0);
  await saveInstallationIntent('local-guest', 'grammar', true);
  expect(await syncEvents.count()).toBe(3);
  const restored = await importBackup(await inspectBackup(await exportBackup('local-guest')));
  expect([...(await readInstallationIntents(restored)).current]).toEqual(['grammar']);
  expect((await readSyncEvents(restored)).find(event => event.id === first.id)).toEqual(first);
});

it('separates unavailable versions and atomically rejects profile changes and failed writes', async () => {
  await appendSyncEvent('local-guest', { type: 'installation', payload: { contentId: 'grammar', contentHash: 'a'.repeat(64), wanted: true } });
  await appendSyncEvent('local-guest', { type: 'installation', payload: { contentId: 'unknown', contentHash: 'b'.repeat(64), wanted: true } });
  expect([...(await readInstallationIntents('local-guest')).unavailable]).toEqual(['grammar', 'unknown']);
  await settings.put({ key: 'activeProfile', value: 'other' });
  await expect(saveInstallationIntent('local-guest', 'grammar', true)).rejects.toThrow('INSTALLATION_INTENT_FAILED');
  const cache = { open: vi.fn(), delete: vi.fn() };
  vi.stubGlobal('window', { caches: cache });
  vi.stubGlobal('caches', cache);
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ active: {} }), getRegistration: async () => ({ active: {} }) } });
  try {
    await expect(installOfflineResources('grammar', () => {}, new AbortController().signal, 'local-guest')).rejects.toThrow('INSTALLATION_INTENT_FAILED');
    await expect(removeOfflineResources('grammar', 'local-guest')).rejects.toThrow('INSTALLATION_INTENT_FAILED');
    await expect(installResourcePack({ id: 'grammar', files: {} }, 'local-guest')).rejects.toThrow('INSTALLATION_INTENT_FAILED');
    expect(cache.open).not.toHaveBeenCalled(); expect(cache.delete).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
  await settings.delete('activeProfile');
  const before = await readSyncEvents('local-guest'), clock = await db.table('syncClocks').get('local-guest');
  const reject = () => { throw new Error('disk failed'); };
  syncEvents.hook('creating', reject);
  try { await expect(saveInstallationIntent('local-guest', 'grammar', true)).rejects.toThrow('INSTALLATION_INTENT_FAILED'); }
  finally { syncEvents.hook('creating').unsubscribe(reject); }
  expect(await readSyncEvents('local-guest')).toEqual(before);
  expect(await db.table('syncClocks').get('local-guest')).toEqual(clock);
  await saveInstallationIntent('local-guest', 'grammar', true);
  expect([...(await readInstallationIntents('local-guest')).current]).toEqual(['grammar']);
  expect([...(await readInstallationIntents('local-guest')).unavailable]).toEqual(['unknown']);
  await saveInstallationIntent('local-guest', 'unknown', false);
  expect((await readInstallationIntents('local-guest')).unavailable.size).toBe(0);
  expect((await readSyncEvents('local-guest')).at(-1)).toMatchObject({ type: 'installation', payload: { contentId: 'unknown', contentHash: 'b'.repeat(64), wanted: false } });
});

it('records new runtime source downloads in the same scoped installation flow', async () => {
  const { sourcePacks } = await import('../src/data/sourcePacks');
  const source = sourcePacks[0];
  expect(await officialContentHash(source.id)).toBe(source.sha256);
  await saveInstallationIntent('local-guest', source.id, true);
  expect((await readInstallationIntents('local-guest')).current.has(source.id)).toBe(true);
  expect((await readSyncEvents('local-guest'))[0].payload).toEqual({ contentId: source.id, contentHash: source.sha256, wanted: true });
  await saveInstallationIntent('local-guest', source.id, false);
  expect((await readInstallationIntents('local-guest')).current.has(source.id)).toBe(false);
});
