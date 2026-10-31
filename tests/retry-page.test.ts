import { afterEach, beforeEach, expect, it, vi } from 'vitest';

class Preload {
  constructor(public href: string, public rel = 'modulepreload') {}
}
let preloads: Preload[];
const reload = vi.fn();
const address = { href: 'https://lingfern.test/library/dictionary', origin: 'https://lingfern.test', reload };
const asset = 'https://lingfern.test/assets/Dictionary-synthetic.js';
const script = () => new Response('export const synthetic = true;', { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });

beforeEach(() => {
  vi.resetModules(); reload.mockClear(); address.href = 'https://lingfern.test/library/dictionary';
  vi.stubGlobal('location', address); preloads = [];
  vi.stubGlobal('document', { querySelectorAll: () => preloads.filter(link => link.rel === 'modulepreload') });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function fail(url = asset, rel = 'modulepreload') {
  preloads.push(new Preload(url, rel));
}

it('refreshes only same-origin public module preloads with reload caching before the explicit page retry', async () => {
  const { retryPage } = await import('../src/app/retryPage');
  address.href = 'https://lingfern.test/library/dictionary?q=synthetic#preserved';
  fail(); fail();
  fail('https://external.test/assets/external.js'); fail('https://lingfern.test/api/private.js');
  fail('https://lingfern.test/assets/other.js?private=1'); fail('https://lingfern.test/assets/style.js', 'stylesheet');
  fail('http://%');
  const response = script(), fetcher = vi.fn().mockResolvedValueOnce(response).mockImplementation(async () => script()); vi.stubGlobal('fetch', fetcher);
  await retryPage(new AbortController().signal);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(asset, expect.objectContaining({ cache: 'reload', credentials: 'omit', redirect: 'error', signal: expect.any(AbortSignal) }));
  expect(response.bodyUsed).toBe(true); expect(reload).toHaveBeenCalledTimes(1);
  expect(address.href).toBe('https://lingfern.test/library/dictionary?q=synthetic#preserved');
  await retryPage(new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(2); expect(reload).toHaveBeenCalledTimes(2);
});

it.each(['http', 'html', 'network'])('keeps failed modules available for the next explicit retry after %s failure', async failure => {
  const { retryPage } = await import('../src/app/retryPage'); fail();
  const fetcher = vi.fn().mockImplementationOnce(async () => {
    if (failure === 'network') throw new TypeError('Synthetic network failure');
    return failure === 'http' ? new Response('Unavailable', { status: 503 }) : new Response('<html>Unavailable</html>', { headers: { 'Content-Type': 'text/html' } });
  }).mockImplementationOnce(async () => script());
  vi.stubGlobal('fetch', fetcher);
  await expect(retryPage(new AbortController().signal)).rejects.toThrow();
  expect(reload).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
  await retryPage(new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(2); expect(reload).toHaveBeenCalledTimes(1);
});

it('does not reload another route or a cancelled caller after recovery work finishes', async () => {
  const { retryPage } = await import('../src/app/retryPage'); fail();
  const controller = new AbortController();
  vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(); return script(); }));
  await expect(retryPage(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(reload).not.toHaveBeenCalled();
  fail();
  vi.stubGlobal('fetch', vi.fn(async () => { address.href = 'https://lingfern.test/today'; return script(); }));
  await retryPage(new AbortController().signal);
  expect(reload).not.toHaveBeenCalled();
});

it('retains ordinary explicit reload behavior without failed modules and ignores already-cancelled callers', async () => {
  const { retryPage } = await import('../src/app/retryPage');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController(); controller.abort();
  await expect(retryPage(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetcher).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
  await retryPage(new AbortController().signal);
  expect(fetcher).not.toHaveBeenCalled(); expect(reload).toHaveBeenCalledTimes(1);
});

it.each([404, 410])('keeps the normal explicit reload when an obsolete module hash is gone (%s)', async status => {
  const { retryPage } = await import('../src/app/retryPage'); fail();
  const response = new Response('Old build unavailable', { status });
  const fetcher = vi.fn(async () => response); vi.stubGlobal('fetch', fetcher);
  await retryPage(new AbortController().signal);
  expect(response.bodyUsed).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1); expect(reload).toHaveBeenCalledTimes(1);
});

it('recovers without newer AbortSignal static methods and bounds stalled recovery', async () => {
  const { retryPage } = await import('../src/app/retryPage'); fail();
  vi.stubGlobal('AbortSignal', {});
  const fetcher = vi.fn(async () => script()); vi.stubGlobal('fetch', fetcher);
  await retryPage(new AbortController().signal);
  expect(reload).toHaveBeenCalledTimes(1);
  reload.mockClear(); vi.useFakeTimers();
  fetcher.mockImplementation((_url?: unknown, options?: { signal: AbortSignal }) => new Promise<Response>((_resolve, reject) => {
    options!.signal.addEventListener('abort', () => reject(options!.signal.reason), { once: true });
  }));
  const timedOut = expect(retryPage(new AbortController().signal)).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(10000); await timedOut;
  expect(fetcher).toHaveBeenCalledTimes(2); expect(reload).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

it('cancels other in-flight preload requests when one recovery fails', async () => {
  const { retryPage } = await import('../src/app/retryPage'); fail(); fail('https://lingfern.test/assets/other.js');
  let pendingSignal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url === asset) return new Response('Unavailable', { status: 503 });
    pendingSignal = options.signal!;
    return await new Promise<Response>((_resolve, reject) => pendingSignal!.addEventListener('abort', () => reject(pendingSignal!.reason), { once: true }));
  }));
  await expect(retryPage(new AbortController().signal)).rejects.toThrow('MODULE_RETRY_FAILED');
  expect(pendingSignal?.aborted).toBe(true); expect(reload).not.toHaveBeenCalled();
});
