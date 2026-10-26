import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { db } from '../src/data/db';
import { installOfflineResources, offlineCacheName, offlineGroups, offlineMarker } from '../src/data/offline';
import { installResourcePack } from '../src/data/resourcePack';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

const group = offlineGroups.find(group => group.id === 'grammar')!;
const files = Object.fromEntries(group.files.map(file => [file.path.slice(1), new Uint8Array(readFileSync(`public${file.path}`))]));
const installers = [
  { name: 'download', install: (signal: AbortSignal) => installOfflineResources(group.id, () => {}, signal, 'cancelled-resource-test') },
  { name: 'ZIP import', install: (signal: AbortSignal) => installResourcePack({ id: group.id, files }, 'cancelled-resource-test', signal) },
];

it.each(installers.flatMap(installer => ['cached', 'marker', 'final readiness'].map(phase => ({ ...installer, phase }))))('rejects $name cancellation during $phase without deleting an existing complete cache', async ({ install, phase }) => {
  const controller = new AbortController(), paths = new Set(phase === 'cached' ? [offlineMarker(group.id), ...group.files.map(file => file.path)] : []);
  const cache = {
    put: vi.fn(async (path: string) => { paths.add(path); if (path === offlineMarker(group.id) && phase === 'marker') controller.abort(); }),
    keys: async () => { if (phase === 'cached' || phase === 'final readiness') controller.abort(); return [...paths].map(path => new Request(new URL(path, 'https://lingfern.test'))); },
  };
  const storage = { open: async () => cache, has: async () => paths.size > 0, delete: vi.fn(async () => { paths.clear(); return true; }) };
  vi.stubGlobal('location', { origin: 'https://lingfern.test' });
  vi.stubGlobal('window', { caches: storage, dispatchEvent: vi.fn() }); vi.stubGlobal('caches', storage);
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ active: {} }), getRegistration: async () => ({ active: {} }) } });
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    const response = new Response(new Uint8Array(files[path.split('?')[0].slice(1)]), { headers: { 'Content-Type': path.includes('.json') ? 'application/json' : 'text/plain' } });
    Object.defineProperty(response, 'type', { value: 'basic' }); return response;
  }));
  try {
    await expect(install(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    if (phase === 'cached') { expect(storage.delete).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled(); expect(paths.size).toBe(group.files.length + 1); }
    else { expect(storage.delete).toHaveBeenCalledExactlyOnceWith(offlineCacheName(group.id)); expect(paths.size).toBe(0); }
  } finally { vi.unstubAllGlobals(); }
});
