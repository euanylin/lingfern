import { offlineCacheName, offlineGroupReady, offlineGroups, offlineMarker, waitForOfflineWorker } from './offline';
import { unpackZip } from './zip';
import { loadRuntimeResources, runtimeResources } from './runtimeResources';

const decoder = new TextDecoder('utf-8', { fatal: true });

export async function inspectResourcePack(bytes: Uint8Array) {
  await loadRuntimeResources();
  const knownPaths = new Set(offlineGroups.flatMap(group => group.files.map(file => file.path.slice(1))));
  if (bytes.length > 20 * 1024 * 1024) throw new Error('PACKAGE_SIZE');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const release = runtimeResources.downloads.packs.find(pack => pack.bytes === bytes.length && pack.sha256 === digest);
  if (!release) throw new Error('PACKAGE_INTEGRITY');
  const files = unpackZip(bytes, { maxCompressed: 20 * 1024 * 1024, maxExpanded: 40 * 1024 * 1024, maxFiles: 2000, allowName: name => name === 'manifest.json' || knownPaths.has(name), error: 'PACKAGE' });
  const manifest = JSON.parse(decoder.decode(files['manifest.json'] ?? new Uint8Array()));
  const group = offlineGroups.find(item => item.id === release.id && item.version === release.version);
  if (manifest.format !== 'lingfern-public-resources' || manifest.version !== 1 || !group || manifest.groupId !== group.id || manifest.groupVersion !== group.version || JSON.stringify(manifest.files) !== JSON.stringify(group.files) || Object.keys(files).length !== group.files.length + 1) throw new Error('PACKAGE_MANIFEST');
  for (const file of group.files) {
    const data = files[file.path.slice(1)];
    if (!data || data.length !== file.bytes || [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)))].map(byte => byte.toString(16).padStart(2, '0')).join('') !== file.sha256) throw new Error('PACKAGE_INTEGRITY');
  }
  return { id: group.id, files };
}

export type ResourcePack = Awaited<ReturnType<typeof inspectResourcePack>>;

// Keep database mutations out of inspection-worker imports.
export async function installResourcePack(pack: ResourcePack, profileId: string, signal?: AbortSignal) {
  const group = offlineGroups.find(item => item.id === pack.id);
  if (!group) throw new Error('PACKAGE_MANIFEST');
  if (!('caches' in window)) throw new Error('UNSUPPORTED');
  await waitForOfflineWorker(signal);
  await (await import('./installationIntent')).saveInstallationIntent(profileId, group.id, true);
  if (await offlineGroupReady(group.id)) return group.id;
  const name = offlineCacheName(group.id);
  const cache = await caches.open(name);
  try {
    for (const file of group.files) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const data = pack.files[file.path.slice(1)];
      const type = file.path.endsWith('.mp3') ? 'audio/mpeg' : file.path.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8';
      await cache.put(file.path, new Response(new Uint8Array(data), { headers: { 'Content-Type': type, 'Content-Length': String(data.length) } }));
    }
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    await cache.put(offlineMarker(group.id), new Response(group.version));
    if (!await offlineGroupReady(group.id)) throw new Error('PACKAGE_INCOMPLETE');
    return group.id;
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
}
