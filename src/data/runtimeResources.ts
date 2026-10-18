import { catalogueCacheName, catalogueMaxBytes, cataloguePath, resourceCatalogueSchema, type ResourceCatalogue } from '../shared/resourceCatalogue';

export const runtimeResources: ResourceCatalogue = { version: 1, offline: { version: '', groups: [] }, sources: { version: 1, packs: [] }, downloads: { version: 1, packs: [] } };
let loaded = false;
let inflight: Promise<ResourceCatalogue> | undefined;
async function readCatalogue(response: Response) {
  if (!response.ok || !response.body || /text\/html/i.test(response.headers.get('content-type') ?? '')) throw new Error('RESOURCE_CATALOGUE_HTTP');
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > catalogueMaxBytes)) throw new Error('RESOURCE_CATALOGUE_SIZE');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > catalogueMaxBytes) throw new Error('RESOURCE_CATALOGUE_SIZE'); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return resourceCatalogueSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)));
}
export function applyRuntimeCatalogue(input: unknown) {
  const value = resourceCatalogueSchema.parse(input);
  runtimeResources.offline.version = value.offline.version;
  runtimeResources.offline.groups.splice(0, runtimeResources.offline.groups.length, ...value.offline.groups);
  runtimeResources.sources.packs.splice(0, runtimeResources.sources.packs.length, ...value.sources.packs);
  runtimeResources.downloads.packs.splice(0, runtimeResources.downloads.packs.length, ...value.downloads.packs);
  loaded = true; return runtimeResources;
}
export async function loadRuntimeResources(force = false, signal?: AbortSignal): Promise<ResourceCatalogue> {
  signal?.throwIfAborted();
  if (inflight) return inflight;
  if (loaded && !force) return runtimeResources;
  inflight = (async () => {
    try {
      const response = await fetch(cataloguePath, { cache: 'no-cache', credentials: 'omit', redirect: 'error', signal });
      if (response.url && typeof location !== 'undefined' && new URL(response.url).origin !== location.origin) throw new Error('RESOURCE_CATALOGUE_ORIGIN');
      const value = await readCatalogue(response); signal?.throwIfAborted();
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(catalogueCacheName);
        await cache.put(cataloguePath, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
        if (typeof navigator !== 'undefined') navigator.serviceWorker?.controller?.postMessage({ type: 'RESOURCES_CATALOGUE_UPDATED' });
      }
      return applyRuntimeCatalogue(value);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (typeof caches !== 'undefined') {
        const cached = await (await caches.open(catalogueCacheName)).match(cataloguePath);
        if (cached) return applyRuntimeCatalogue(await readCatalogue(cached));
      }
      throw error;
    }
  })();
  try { return await inflight; } finally { inflight = undefined; }
}
export { catalogueCacheName, cataloguePath };
