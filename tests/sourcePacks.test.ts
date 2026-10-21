import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { installSourcePack, removeSourcePack, sourcePacks } from '../src/data/sourcePacks';
import { communityPacks, db } from '../src/data/db';
import { installCommunityPack } from '../src/data/communityInstall';
import { inspectCommunityPack } from '../src/data/communityPack';
import { corpusLesson } from '../src/core/corpus';
vi.mock('../src/data/communityInstall', () => ({ installCommunityPack: vi.fn(), communityPackageReady: vi.fn(), communityCacheName: (hash: string) => `lingfern-community-${hash}` }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const entry = sourcePacks.find(pack => pack.skill === 'reading')!;
const bytes = new Uint8Array(readFileSync('public' + entry.path));
it('installs the real source-only package through the existing validated installer', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)));
  await installSourcePack(entry.id, 'isolated-profile');
  expect(installCommunityPack).toHaveBeenCalledWith(expect.objectContaining({ hash: entry.sha256, lessons: [], corpus: expect.any(Object) }), 'isolated-profile', undefined);
});
it('rejects missing, truncated, oversized and altered source downloads before installation', async () => {
  const altered = bytes.slice(); altered[100] ^= 1;
  for (const response of [new Response(null, { status: 404 }), new Response(bytes.slice(0, -1)), new Response(new Uint8Array(bytes.length + 1)), new Response(altered)]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(installSourcePack(entry.id, 'isolated-profile')).rejects.toThrow();
  }
  expect(installCommunityPack).not.toHaveBeenCalled();
});

it('removes a selected batch without deleting another profile’s shared media or unrelated packages', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  const [first, shared, unrelated] = sourcePacks;
  const record = (profileId: string, entry: typeof first) => ({ profileId, hash: entry.sha256, id: entry.id, lessons: [], sources: [], state: 'ready' as const, installedAt: new Date().toISOString() });
  await communityPacks.bulkPut([record('isolated-profile', first), record('isolated-profile', shared), record('other-profile', shared), record('isolated-profile', unrelated)]);
  const names = new Set([first, shared, unrelated].map(entry => `lingfern-community-${entry.sha256}`));
  const cache = { delete: vi.fn(async (name: string) => names.delete(name)), has: vi.fn(async (name: string) => names.has(name)) };
  const changed = vi.fn();
  vi.stubGlobal('window', { dispatchEvent: changed }); vi.stubGlobal('caches', cache);
  await removeSourcePack([first.id, shared.id, first.id], 'isolated-profile');
  expect(cache.delete.mock.calls).toEqual([[`lingfern-community-${first.sha256}`]]);
  expect(await communityPacks.get(['other-profile', shared.sha256])).toBeDefined();
  expect(await communityPacks.get(['isolated-profile', unrelated.sha256])).toBeDefined();
  expect(await communityPacks.get(['isolated-profile', first.sha256])).toBeUndefined();
  expect(changed).toHaveBeenCalledTimes(1);
});
it('generates from the repaired inspected whole article and retains excluded spelling targets', async () => {
  let inspected;
  for (const entry of sourcePacks.filter(pack => pack.skill === 'reading')) {
    const candidate = await inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)));
    expect(candidate.hash).toBe(entry.sha256);
    if (candidate.corpus!.records.some(record => record.rootId === 'wikipedia-article-10427125')) { inspected = candidate; break; }
  }
  expect(inspected, 'Repaired exact source must remain in a current theme package').toBeDefined();
  const bank = inspected!.corpus!;
  const source = bank.records.find(record => record.rootId === 'wikipedia-article-10427125')!;
  expect(source.passages).toHaveLength(1);
  const passage = source.passages[0];
  expect(passage.text).toBe(source.originalText);
  expect(passage.language!.tokens.length).toBeGreaterThan(0);
  expect(passage.language!.tokens.some(token => /^Barratt?$/i.test(passage.text.slice(token.start, token.end)))).toBe(false);
  const peer = bank.records.find(record => record !== source && record.passages.length)!;
  const lesson = corpusLesson({ ...bank, records: [source, peer] }, new Set(), 0, 700, 'B2');
  expect(lesson?.materials.some(material => material.rootId === source.rootId)).toBe(true);
});
