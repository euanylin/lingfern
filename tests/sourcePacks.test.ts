import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { installSourcePack, sourcePacks } from '../src/data/sourcePacks';
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
