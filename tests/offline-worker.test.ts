import { expect, it, vi } from 'vitest';
import { cachedFilesPresent, waitForOfflineWorker } from '../src/data/offline';
import { communityPackageReady, communityMarker, installCommunityPack } from '../src/data/communityInstall';
import { communityPacks } from '../src/data/db';
import { lessonSchema } from '../src/shared/content';
import listening from './fixtures/content/a1-listening.json';

it('checks complete cached URL sets once without opening media responses or accepting another origin', async () => {
  vi.stubGlobal('location', { origin: 'https://lingfern.test' });
  const keys = vi.fn(async () => [new Request('https://lingfern.test/audio/test.mp3'), new Request('https://foreign.test/audio/other.mp3')]);
  const match = vi.fn(() => { throw new Error('MEDIA_BODY_OPENED'); }), cache = { keys, match } as unknown as Cache;
  try {
    expect(await cachedFilesPresent(cache, ['/audio/test.mp3', '/audio/test.mp3'])).toBe(true);
    expect(keys).toHaveBeenCalledTimes(1);
    expect(await cachedFilesPresent(cache, ['/audio/other.mp3'])).toBe(false);
    expect(await cachedFilesPresent(cache, ['/audio/test.mp3?different=1'])).toBe(false);
    expect(match).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});

it('requires every media key and the installation marker without creating a missing cache', async () => {
  const lesson = lessonSchema.parse(listening), hash = 'f'.repeat(64), pack = { hash, lessons: [lesson] };
  const paths = [communityMarker(hash), ...lesson.materials.map(material => material.audio!.src)];
  let available = [...paths];
  const cache = { keys: vi.fn(async () => available.map(path => new Request(new URL(path, 'https://lingfern.test')))) };
  const storage = { has: vi.fn(async () => true), open: vi.fn(async () => cache) };
  vi.stubGlobal('location', { origin: 'https://lingfern.test' }); vi.stubGlobal('window', { caches: storage }); vi.stubGlobal('caches', storage);
  try {
    expect(await communityPackageReady(pack)).toBe(true);
    available = paths.slice(0, -1); expect(await communityPackageReady(pack)).toBe(false);
    available = paths.slice(1); expect(await communityPackageReady(pack)).toBe(false);
    storage.has.mockResolvedValue(false); const opened = storage.open.mock.calls.length;
    expect(await communityPackageReady(pack)).toBe(false); expect(storage.open).toHaveBeenCalledTimes(opened);
  } finally { vi.unstubAllGlobals(); }
});

it('waits for activation before installation, bounds unsupported startup and respects cancellation', async () => {
  vi.useFakeTimers();
  try {
    let activate!: (registration: { active: object }) => void;
    vi.stubGlobal('navigator', { serviceWorker: { ready: new Promise(resolve => { activate = resolve; }) } });
    let finished = false;
    const waiting = waitForOfflineWorker().then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    activate({ active: {} });
    await waiting;
    expect(finished).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.stubGlobal('navigator', { serviceWorker: { ready: new Promise(() => {}) } });
    const unavailable = expect(waitForOfflineWorker()).rejects.toThrow('UNSUPPORTED');
    await vi.advanceTimersByTimeAsync(10_000);
    await unavailable;
    expect(vi.getTimerCount()).toBe(0);
    const controller = new AbortController();
    controller.abort();
    await expect(waitForOfflineWorker(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it('cancels an in-progress activation wait immediately and releases its timeout', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  vi.stubGlobal('navigator', { serviceWorker: { ready: new Promise(() => {}) } });
  let outcome: unknown;
  const waiting = waitForOfflineWorker(controller.signal).catch(error => { outcome = error; });
  try {
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  } finally { await vi.runAllTimersAsync(); await waiting; vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it.each(['storage', 'readiness'])('does not register a cached package after cancellation during %s', async phase => {
  const profileId = `cancelled-install-${phase}`, hash = 'c'.repeat(64), controller = new AbortController();
  const cache = { keys: async () => {
    if (phase === 'readiness') controller.abort();
    return [new Request(new URL(communityMarker(hash), 'https://lingfern.test'))];
  } };
  const storage = { has: async () => true, open: async () => cache, delete: vi.fn() };
  vi.stubGlobal('location', { origin: 'https://lingfern.test' });
  vi.stubGlobal('window', { caches: storage }); vi.stubGlobal('caches', storage);
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ active: {} }) }, storage: { persist: async () => {
    if (phase === 'storage') controller.abort();
    return true;
  } } });
  try {
    await expect(installCommunityPack({ id: 'cached-reading', hash, lessons: [], sources: [], dictionary: [], media: {} }, profileId, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(await communityPacks.get([profileId, hash])).toBeUndefined();
    expect(storage.delete).not.toHaveBeenCalled();
  } finally { await communityPacks.delete([profileId, hash]); vi.unstubAllGlobals(); }
});

it('rolls back staged installation when cancelled while its ready marker is written', async () => {
  const profileId = 'cancelled-install-marker', hash = 'd'.repeat(64), controller = new AbortController();
  const cache = { put: vi.fn(async () => { controller.abort(); }) };
  const storage = { has: async () => false, open: async () => cache, delete: vi.fn(async () => true) };
  vi.stubGlobal('window', { caches: storage }); vi.stubGlobal('caches', storage);
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ active: {} }) } });
  try {
    await expect(installCommunityPack({ id: 'reading-install', hash, lessons: [], sources: [], dictionary: [], media: {} }, profileId, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(await communityPacks.get([profileId, hash])).toBeUndefined();
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(storage.delete.mock.calls).toEqual([[`lingfern-community-${hash}`], [`lingfern-community-${hash}`]]);
  } finally { await communityPacks.delete([profileId, hash]); vi.unstubAllGlobals(); }
});
