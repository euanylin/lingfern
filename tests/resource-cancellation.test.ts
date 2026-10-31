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
  const controller = new AbortController(), name = offlineCacheName(group.id), marker = offlineMarker(group.id);
  const entries = new Map<string, Map<string, Response>>();
  const key = (request: RequestInfo | URL) => new URL(request instanceof Request ? request.url : String(request), 'https://lingfern.test').pathname;
  let cancelledAt: string | undefined;
  const cancel = () => { cancelledAt = phase; controller.abort(); };
  if (phase === 'cached') entries.set(name, new Map([
    ...group.files.map(file => [file.path, new Response(new Uint8Array(files[file.path.slice(1)]))] as const),
    [marker, new Response(group.version)],
  ]));
  const put = vi.fn(async (cacheName: string, request: RequestInfo | URL, response: Response) => {
    const path = key(request);
    entries.get(cacheName)!.set(path, response.clone());
    if (cacheName === name && path === marker && phase === 'marker') cancel();
  });
  const storage = {
    open: async (cacheName: string) => {
      const values = entries.get(cacheName) ?? new Map<string, Response>(); entries.set(cacheName, values);
      return {
        put: (request: RequestInfo | URL, response: Response) => put(cacheName, request, response),
        match: async (request: RequestInfo | URL) => values.get(key(request))?.clone(),
        keys: async () => {
          if (cacheName === name && (phase === 'cached' || phase === 'final readiness' && values.has(marker))) cancel();
          return [...values.keys()].map(path => new Request(new URL(path, 'https://lingfern.test')));
        },
      };
    },
    has: async (cacheName: string) => entries.has(cacheName),
    delete: vi.fn(async (cacheName: string) => entries.delete(cacheName)),
  };
  vi.stubGlobal('location', { origin: 'https://lingfern.test' });
  vi.stubGlobal('window', { caches: storage, dispatchEvent: vi.fn() }); vi.stubGlobal('caches', storage);
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ active: {} }), getRegistration: async () => ({ active: {} }) } });
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    const response = new Response(new Uint8Array(files[path.split('?')[0].slice(1)]), { headers: { 'Content-Type': path.includes('.json') ? 'application/json' : 'text/plain' } });
    Object.defineProperty(response, 'type', { value: 'basic' }); return response;
  }));
  try {
    await expect(install(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelledAt).toBe(phase);
    expect(storage.delete.mock.calls.some(([deleted]) => deleted === name)).toBe(false);
    expect([...entries.keys()]).toEqual([name]);
    const retained = entries.get(name)!;
    expect(retained.size).toBe(group.files.length + 1);
    expect(await retained.get(marker)!.clone().text()).toBe(group.version);
    for (const file of group.files) expect(new Uint8Array(await retained.get(file.path)!.clone().arrayBuffer())).toEqual(files[file.path.slice(1)]);
    if (phase === 'cached') {
      expect(storage.delete).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    } else if (install === installers[0].install) {
      expect(storage.delete).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(new RegExp(`^${name}-staged-`)));
    } else expect(storage.delete).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
