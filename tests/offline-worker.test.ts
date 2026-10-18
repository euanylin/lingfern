import { expect, it, vi } from 'vitest';
import { waitForOfflineWorker } from '../src/data/offline';

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
