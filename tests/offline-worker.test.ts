import { expect, it, vi } from 'vitest';
import { cachedFilesPresent, waitForOfflineWorker } from '../src/data/offline';
import { communityPackageReady, communityMarker } from '../src/data/communityInstall';
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
