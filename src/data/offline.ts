import { loadRuntimeResources, runtimeResources } from './runtimeResources';
import { notifyResourceChange } from './resourceChanges';

export const offlineGroups = runtimeResources.offline.groups;
const group = (id: string) => offlineGroups.find(item => item.id === id);
export const offlineCacheName = (id: string) => {
  const item = group(id);
  if (!item) throw new Error('UNKNOWN_PACKAGE');
  return `lingfern-public-${item.id}-${item.version}`;
};
export const offlineMarker = (id: string) => {
  const item = group(id);
  if (!item) throw new Error('UNKNOWN_PACKAGE');
  return `/offline-complete-${item.id}-${item.version}`;
};

export async function waitForOfflineWorker(signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!('serviceWorker' in navigator)) throw new Error('UNSUPPORTED');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('UNSUPPORTED')), 10_000); })]);
    signal?.throwIfAborted();
    if (!registration.active) throw new Error('UNSUPPORTED');
  } finally { clearTimeout(timeout); }
}

export async function offlineGroupReady(id: string) {
  const item = group(id);
  if (!item || !('caches' in window) || !('serviceWorker' in navigator) || !(await navigator.serviceWorker.getRegistration('/'))?.active) return false;
  const name = offlineCacheName(id);
  if (!await caches.has(name)) return false;
  const cache = await caches.open(name);
  return cachedFilesPresent(cache, [offlineMarker(id), ...item.files.map(file => file.path)]);
}

export async function cachedFilesPresent(cache: Cache, paths: readonly string[]) {
  // Installers store canonical GET URLs without Vary; avoid opening every media body.
  const urls = new Set((await cache.keys()).map(request => request.url));
  return paths.every(path => urls.has(new URL(path, location.origin).href));
}

export async function installedOfflineGroups() {
  await loadRuntimeResources();
  const states = await Promise.all(offlineGroups.map(async item => [item.id, await offlineGroupReady(item.id)] as const));
  return new Set(states.filter(([, ready]) => ready).map(([id]) => id));
}

export async function removeOfflineResources(ids: string | string[], profileId: string) {
  await loadRuntimeResources();
  const selected = [...new Set(typeof ids === 'string' ? [ids] : ids)];
  if (selected.some(id => !group(id))) throw new Error('UNKNOWN_PACKAGE');
  if (!('caches' in window)) throw new Error('UNSUPPORTED');
  await (await import('./installationIntent')).saveInstallationIntents(profileId, selected, false);
  try {
    for (let offset = 0; offset < selected.length; offset += 4) await Promise.all(selected.slice(offset, offset + 4).map(async id => {
      const name = offlineCacheName(id);
      await caches.delete(name);
      if (await caches.has(name)) throw new Error('REMOVE_FAILED');
    }));
  } finally { notifyResourceChange(); }
}

export async function installOfflineResources(id: string, onProgress: (bytes: number) => void, signal: AbortSignal, profileId: string) {
  await loadRuntimeResources();
  const item = group(id);
  if (!item) throw new Error('UNKNOWN_PACKAGE');
  if (!('caches' in window) || !crypto.subtle) throw new Error('UNSUPPORTED');
  await waitForOfflineWorker(signal);
  await (await import('./installationIntent')).saveInstallationIntent(profileId, id, true);
  await navigator.storage?.persist?.().catch(() => false);
  if (await offlineGroupReady(id)) return true;
  const name = offlineCacheName(id);
  const cache = await caches.open(name);
  let completed = 0;
  try {
    for (const file of item.files) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const response = await fetch(`${file.path}?offline-install=${item.version}`, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal });
      const type = response.headers.get('content-type') ?? '';
      if (response.status !== 200 || response.type !== 'basic' || response.url && new URL(response.url).origin !== location.origin || /text\/html/i.test(type) || (file.path.endsWith('.json') && !/json/i.test(type)) || (file.path.endsWith('.mp3') && !/audio\//i.test(type))) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`HTTP_OR_TYPE:${file.path}`);
      }
      if (!response.body) throw new Error(`NO_BODY:${file.path}`);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > file.bytes) throw new Error(`SIZE:${file.path}`);
          chunks.push(value); onProgress(completed + length);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (length !== file.bytes) throw new Error(`SIZE:${file.path}`);
      const body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', body.buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (digest !== file.sha256) throw new Error(`HASH:${file.path}`);
      await cache.put(file.path, new Response(body.buffer, { headers: { 'Content-Type': type, 'Content-Length': String(length) } }));
      completed += length; onProgress(completed);
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    await cache.put(offlineMarker(id), new Response(item.version));
    notifyResourceChange();
    return await offlineGroupReady(id);
  } catch (error) {
    await caches.delete(name);
    notifyResourceChange();
    throw error;
  }
}
