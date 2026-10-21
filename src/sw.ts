/// <reference lib="webworker" />
import { matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { createPartialResponse } from 'workbox-range-requests';
import { catalogueCacheName, cataloguePath, publicResourcePathSchema, resourceCatalogueSchema } from './shared/resourceCatalogue';

const sw = self as unknown as ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision?: string }> };
let resourcePaths: Promise<Map<string, { id: string; version: string; bytes: number; sha256: string }>> | undefined;
const paths = () => resourcePaths ??= (async () => {
  const cached = await (await caches.open(catalogueCacheName)).match(cataloguePath);
  if (!cached) return new Map();
  const catalogue = resourceCatalogueSchema.parse(await cached.json());
  return new Map(catalogue.offline.groups.flatMap(group => group.files.map(file => [file.path, { id: group.id, version: group.version, bytes: file.bytes, sha256: file.sha256 }] as const)));
})().catch(() => new Map());
const communityMedia = /^\/(?:audio\/community-([a-f0-9]{64})\/[a-z0-9-]+\.mp3|images\/community-([a-f0-9]{64})\/[a-z0-9-]+\.png)$/;

registerRoute(({ request, url }) => request.method === 'GET' && url.origin === sw.location.origin && communityMedia.test(url.pathname) && !url.search && !request.headers.has('Authorization'), async ({ request, url }) => {
  const match = communityMedia.exec(url.pathname)!;
  const hash = match[1] ?? match[2];
  const cache = await caches.open(`lingfern-community-${hash}`);
  if (!await cache.match(`/audio/community-${hash}/ready`)) return new Response('Not found', { status: 404 });
  const response = await cache.match(url.pathname);
  return response ? request.headers.has('Range') ? createPartialResponse(request, response) : response : new Response('Not found', { status: 404 });
});

registerRoute(({ request, url }) => request.method === 'GET' && url.origin === sw.location.origin && url.pathname !== cataloguePath && publicResourcePathSchema.safeParse(url.pathname).success && !url.search && !request.headers.has('Authorization'), async ({ request, url }) => {
  const group = (await paths()).get(url.pathname);
  if (!group) return await matchPrecache(url.pathname) ?? fetch(request);
  const cache = await caches.open(`lingfern-public-${group.id}-${group.version}`);
  if (await cache.match(`/offline-complete-${group.id}-${group.version}`)) {
    const response = await cache.match(url.pathname);
    if (response) return request.headers.has('Range') ? createPartialResponse(request, response) : response;
  }
  // Reuse unchanged IPA files after an online catalogue update.
  if (group.id === 'ipa') for (const name of (await caches.keys()).filter(name => /^lingfern-public-ipa-[a-f0-9]{16}$/.test(name) && name !== `lingfern-public-ipa-${group.version}`).reverse()) {
    try {
      const previous = await caches.open(name), version = name.slice('lingfern-public-ipa-'.length);
      if (!await previous.match(`/offline-complete-ipa-${version}`)) continue;
      const response = await previous.match(url.pathname);
      if (!response?.ok || response.headers.get('Content-Length') !== String(group.bytes)) continue;
      const bytes = await response.clone().arrayBuffer();
      if (bytes.byteLength !== group.bytes) continue;
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
      if (hash === group.sha256) return request.headers.has('Range') ? createPartialResponse(request, response) : response;
    } catch { continue; }
  }
  const firstTask = await matchPrecache(url.pathname);
  if (firstTask) return request.headers.has('Range') ? createPartialResponse(request, firstTask) : firstTask;
  return fetch(request);
});

// @ts-expect-error Workbox injects this manifest literal.
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(({ request, url }) => request.mode === 'navigate' && url.origin === sw.location.origin && (/^\/(introduction|start|today|progress|library(?:\/(?:dictionary|saved|ipa|grammar|history))?|settings(?:\/about)?|learn\/[^/]+)$/.test(url.pathname) || url.pathname === '/'), async ({ request }) => await matchPrecache('/index.html') ?? fetch(request));
sw.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
  if (event.data?.type === 'RESOURCES_CATALOGUE_UPDATED') resourcePaths = undefined;
});
sw.addEventListener('activate', event => { event.waitUntil(sw.clients.claim()); });
