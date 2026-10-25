import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../src/data/db';
import { loadCorpus } from '../src/data/corpus';
import { installSourcePack, sourcePacks } from '../src/data/sourcePacks';
import { installOfflineResources } from '../src/data/offline';
import { lookupDictionary } from '../src/shared/dictionary';
import { jsonRequest } from '../src/data/syncClient';

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  const cache = { open: vi.fn(async () => ({ put: vi.fn() })), has: vi.fn(async () => false), delete: vi.fn(async () => true) };
  vi.stubGlobal('caches', cache);
  vi.stubGlobal('window', { caches: cache, dispatchEvent: vi.fn() });
  vi.stubGlobal('location', { origin: 'https://lingfern.com' });
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ active: {} }), getRegistration: async () => ({ active: {} }) } });
});
afterEach(() => vi.unstubAllGlobals());

const consumers = [
  { name: 'dictionary', error: 'DICTIONARY_UNAVAILABLE', read: () => lookupDictionary('zzstreamfailure') },
  { name: 'reading corpus', error: 'MISSING_CORPUS', read: () => loadCorpus('voa') },
  { name: 'source package', error: 'MISSING_CORPUS', read: () => installSourcePack(sourcePacks[0].id, 'isolated-stream-test') },
  { name: 'offline resources', error: 'HTTP_OR_TYPE:', read: () => installOfflineResources('grammar', () => {}, new AbortController().signal, 'isolated-stream-test') },
  { name: 'sync API', error: 'SYNC_HTTP_503', read: () => jsonRequest('/api/sync/changes', new AbortController().signal) },
];

it.each(consumers)('cancels rejected $name bodies while retaining the original error', async ({ read, error }) => {
  for (const rejectCancel of [false, true]) {
    const cancel = vi.fn(() => { if (rejectCancel) throw new Error('cancel failed'); });
    const stream = new ReadableStream({ cancel });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 503, headers: { 'Content-Type': 'text/html' } })));
    await expect(read()).rejects.toThrow(error);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(stream.locked).toBe(false);
  }
});

it('releases the offline download reader when its progress consumer throws', async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); }, cancel });
  const response = new Response(stream, { headers: { 'Content-Type': 'application/json' } });
  Object.defineProperty(response, 'type', { value: 'basic' });
  vi.stubGlobal('fetch', vi.fn(async () => response));
  await expect(installOfflineResources('grammar', () => { throw new Error('PROGRESS_FAILED'); }, new AbortController().signal, 'isolated-stream-test')).rejects.toThrow('PROGRESS_FAILED');
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(stream.locked).toBe(false);
});
