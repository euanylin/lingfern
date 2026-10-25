import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogueMaxBytes, resourceCatalogueSchema } from '../src/shared/resourceCatalogue';
const hash = 'a'.repeat(64);
const fixture = () => ({ version: 1, offline: { version: 'r1', groups: [{ id: 'future-dictionary', version: 'v1', bytes: 5, files: [{ path: '/resources/new-book.txt', bytes: 5, sha256: hash }] }] }, sources: { version: 1, packs: [] }, downloads: { version: 1, packs: [{ id: 'future-dictionary', version: 'v1', path: '/packs/future-v1.zip', bytes: 4, sha256: hash }] } });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('runtime resource catalogue trust boundary', () => {
  it('accepts future groups, rejects injection, private paths and metadata mismatch', () => {
    expect(resourceCatalogueSchema.safeParse(fixture()).success).toBe(true);
    for (const path of ['/api/x.json', '/oauth/x', '/mcp/x', '/private/x', '/users/a', '/.well-known/x', '//other.test/x', '/resources/%2e%2e/x', '/resources/../x', '/resources/a?x=1', '/resources/catalogue.json']) {
      const x = fixture(); x.offline.groups[0].files[0].path = path; expect(resourceCatalogueSchema.safeParse(x).success, path).toBe(false);
    }
    const wrong = fixture(); wrong.offline.groups[0].bytes++; expect(resourceCatalogueSchema.safeParse(wrong).success).toBe(false);
    const unknown = fixture(); unknown.downloads.packs[0].version = 'wrong'; expect(resourceCatalogueSchema.safeParse(unknown).success).toBe(false);
    const duplicate = fixture(); duplicate.offline.groups.push(duplicate.offline.groups[0]); expect(resourceCatalogueSchema.safeParse(duplicate).success).toBe(false);
    const oversized = fixture(); oversized.offline.groups[0].files[0].bytes = 25 * 1024 * 1024 + 1; expect(resourceCatalogueSchema.safeParse(oversized).success).toBe(false);
  });
  it('validates source expansion byte and skill accounting', () => {
    const source = { id: 'new-reading', topic: 'culture', title: { 'zh-Hans': '书', 'zh-Hant': '書', en: 'Book' }, skill: 'reading', bytes: 4, sha256: hash, roots: 1, passages: 1, sourceFamilies: ['future-source'], path: '/source-packs/new-reading.zip', minWords: 120, minSeconds: null, expandedBytes: 5, mediaBytes: 0, metadataBytes: 5, audioSeconds: 0 };
    const x = { ...fixture(), sources: { version: 1, packs: [source] } }; expect(resourceCatalogueSchema.safeParse(x).success).toBe(true);
    source.mediaBytes = 1; expect(resourceCatalogueSchema.safeParse(x).success).toBe(false);
  });
  it('shares fetch, preserves arrays on refresh and recovers validated cache without replacing it with bad input', async () => {
    const stored = new Map<string, Response>();
    const put = vi.fn(async (key: string, response: Response) => { stored.set(key, response.clone()); });
    vi.stubGlobal('caches', { open: vi.fn(async () => ({ put, match: async (key: string) => stored.get(key)?.clone() })) });
    const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture()), { headers: { 'Content-Type': 'application/json' } })); vi.stubGlobal('fetch', fetcher);
    const module = await vi.importActual<typeof import('../src/data/runtimeResources')>('../src/data/runtimeResources');
    const identity = module.runtimeResources.offline.groups;
    await Promise.all([module.loadRuntimeResources(true), module.loadRuntimeResources(true)]); expect(fetcher).toHaveBeenCalledTimes(1); expect(put).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toEqual(['/resources/catalogue.json', { cache: 'no-cache', credentials: 'omit', redirect: 'error', signal: undefined }]);
    const next = fixture(); next.offline.groups.push({ id: 'new-group', version: 'v2', bytes: 1, files: [{ path: '/resources/another.txt', bytes: 1, sha256: hash }] });
    fetcher.mockImplementation(async () => new Response(JSON.stringify(next))); await module.loadRuntimeResources(true);
    expect(module.runtimeResources.offline.groups).toBe(identity); expect(identity).toHaveLength(2);
    fetcher.mockImplementation(async () => new Response('x'.repeat(catalogueMaxBytes + 1))); await module.loadRuntimeResources(true); expect(put).toHaveBeenCalledTimes(2); expect(identity).toHaveLength(2);
    fetcher.mockRejectedValue(new Error('offline')); await module.loadRuntimeResources(true); expect(identity).toHaveLength(2);
  });
  it('does not install anything or accept an uncached oversized or invalid catalogue', async () => {
    vi.stubGlobal('caches', undefined); vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    const module = await vi.importActual<typeof import('../src/data/runtimeResources')>('../src/data/runtimeResources');
    await expect(module.loadRuntimeResources(true)).rejects.toThrow(); expect(module.runtimeResources.offline.groups).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'Content-Length': String(catalogueMaxBytes + 1) } })));
    await expect(module.loadRuntimeResources(true)).rejects.toThrow('RESOURCE_CATALOGUE_SIZE');
  });
  it.each([
    [{ status: 503 }, 'RESOURCE_CATALOGUE_HTTP'],
    [{ headers: { 'Content-Type': 'text/html' } }, 'RESOURCE_CATALOGUE_HTTP'],
    [{ headers: { 'Content-Length': String(catalogueMaxBytes + 1) } }, 'RESOURCE_CATALOGUE_SIZE'],
    [{ headers: { 'Content-Length': 'invalid' } }, 'RESOURCE_CATALOGUE_SIZE'],
  ] as const)('cancels a rejected catalogue response before reading its body: %j', async (init, error) => {
    const cancel = vi.fn();
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), init)));
    const module = await vi.importActual<typeof import('../src/data/runtimeResources')>('../src/data/runtimeResources');
    await expect(module.loadRuntimeResources(true)).rejects.toThrow(error);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('cancels a foreign-origin response without hiding its validation error', async () => {
    const cancel = vi.fn(() => { throw new Error('cancel failed'); });
    const response = new Response(new ReadableStream({ cancel }));
    Object.defineProperty(response, 'url', { value: 'https://other.test/resources/catalogue.json' });
    vi.stubGlobal('location', { origin: 'https://lingfern.com' });
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('fetch', vi.fn(async () => response));
    const module = await vi.importActual<typeof import('../src/data/runtimeResources')>('../src/data/runtimeResources');
    await expect(module.loadRuntimeResources(true)).rejects.toThrow('RESOURCE_CATALOGUE_ORIGIN');
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
