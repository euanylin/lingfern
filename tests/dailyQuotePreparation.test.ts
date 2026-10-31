import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const choose = vi.fn(), imported = vi.fn(), paintExists = vi.fn(() => true);
const getEntries = performance.getEntriesByName.bind(performance);
const address = { pathname: '/introduction', search: '' };
const publicRoot: { dataset: { publicPage?: string } } = { dataset: {} };
const previous = 'wikiquote-' + 'a'.repeat(64);
const selection = { day: '2026-10-30', quote: { id: 'wikiquote-' + 'b'.repeat(64) } };

beforeEach(() => {
  vi.resetModules(); choose.mockReset(); choose.mockResolvedValue(selection); imported.mockReset(); paintExists.mockReturnValue(true);
  vi.doMock('../src/core/dailyQuoteOnDemand', () => { imported(); return { dailyQuoteOnDemand: choose }; });
  address.pathname = '/introduction'; address.search = '';
  publicRoot.dataset.publicPage = '{"path":"/introduction"}';
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('location', address);
  vi.stubGlobal('document', { getElementById: (id: string) => id === 'root' ? publicRoot : null });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => previous), setItem: vi.fn() });
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 30, 12));
  vi.spyOn(performance, 'getEntriesByName').mockImplementation((name, type) => name === 'first-contentful-paint' && type === 'paint' ? paintExists() ? [{ name, entryType: type, startTime: 1, duration: 0, toJSON: () => ({}) }] : [] : getEntries(name, type));
});
afterEach(() => { vi.doUnmock('../src/core/dailyQuoteOnDemand'); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function observePaint(supported = true) {
  let callback!: (list: { getEntries: () => { name: string }[] }) => void;
  const observe = vi.fn(), disconnect = vi.fn();
  class PaintObserver {
    static supportedEntryTypes = supported ? ['paint'] : ['resource'];
    constructor(listener: typeof callback) { callback = listener; }
    observe = observe;
    disconnect = disconnect;
  }
  vi.stubGlobal('PerformanceObserver', PaintObserver);
  vi.stubGlobal('requestAnimationFrame', vi.fn()); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return { observe, disconnect, deliver: (...names: string[]) => callback({ getEntries: () => names.map(name => ({ name })) }) };
}

it('prepares once without writing storage and hands the same selection to one matching initial choice', async () => {
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  const date = new Date();
  prepareDailyQuote(); prepareDailyQuote();
  const pending = takePreparedDailyQuote(date, previous);
  expect(pending).toBeDefined();
  expect(await pending).toBe(selection);
  expect(choose).toHaveBeenCalledExactlyOnceWith(date, previous);
  expect(takePreparedDailyQuote(date, previous)).toBeUndefined();
  expect(localStorage.getItem).toHaveBeenCalledExactlyOnceWith('lingfern:last-daily-quote');
  expect(localStorage.setItem).not.toHaveBeenCalled();
});

it.each(['day', 'previous', 'route'])('discards an unmatched %s handoff instead of reusing it after returning', async mismatch => {
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  prepareDailyQuote();
  const date = new Date();
  if (mismatch === 'day') date.setDate(date.getDate() + 1);
  if (mismatch === 'route') address.pathname = '/library';
  expect(takePreparedDailyQuote(date, mismatch === 'previous' ? undefined : previous)).toBeUndefined();
  address.pathname = '/introduction';
  expect(takePreparedDailyQuote(new Date(), previous)).toBeUndefined();
  await vi.waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
});

it('discards an unconsumed preparation when navigation leaves and returns to Introduction', async () => {
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  prepareDailyQuote(); address.pathname = '/library'; window.dispatchEvent(new Event('popstate'));
  address.pathname = '/introduction';
  expect(takePreparedDailyQuote(new Date(), previous)).toBeUndefined();
  await vi.waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
});

it('handles an early rejection while preserving the existing component load-error path', async () => {
  const failure = new Error('Synthetic quotation failure'); choose.mockRejectedValue(failure);
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  prepareDailyQuote();
  await vi.waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
  await expect(takePreparedDailyQuote(new Date(), previous)).rejects.toBe(failure);
});

it('does not start quotation requests during SSR or outside canonical Introduction', async () => {
  const { prepareDailyQuote } = await import('../src/app/DailyQuote');
  vi.stubGlobal('window', undefined); prepareDailyQuote();
  vi.stubGlobal('window', new EventTarget());
  for (const path of ['/', '/start', '/today', '/settings', '/library/dictionary']) { address.pathname = path; prepareDailyQuote(); }
  address.pathname = '/introduction'; address.search = '?visual-check=1'; prepareDailyQuote();
  await Promise.resolve();
  expect(choose).not.toHaveBeenCalled();
});

it('starts one import and choice only after the first frame and its post-paint task when FCP is absent', async () => {
  paintExists.mockReturnValue(false);
  vi.stubGlobal('PerformanceObserver', undefined);
  let frame!: FrameRequestCallback;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('requestAnimationFrame', requestFrame); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.assign(window, { setTimeout });
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  const date = new Date(); prepareDailyQuote(); prepareDailyQuote();
  const pending = takePreparedDailyQuote(date, previous);
  expect(pending).toBeDefined(); expect(requestFrame).toHaveBeenCalledTimes(1);
  expect(imported).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  vi.setSystemTime(new Date(2026, 9, 31, 12)); frame(16);
  expect(imported).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  await vi.runOnlyPendingTimersAsync();
  expect(await pending).toBe(selection);
  expect(imported).toHaveBeenCalledTimes(1); expect(choose).toHaveBeenCalledExactlyOnceWith(date, previous);
  expect(takePreparedDailyQuote(date, previous)).toBeUndefined();
});

it.each(['frame', 'task'])('cancels unconsumed post-paint work before its %s when navigation leaves', async phase => {
  paintExists.mockReturnValue(false);
  vi.stubGlobal('PerformanceObserver', undefined);
  let frame!: FrameRequestCallback;
  const cancelFrame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', cancelFrame); Object.assign(window, { setTimeout });
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  prepareDailyQuote();
  if (phase === 'task') frame(16);
  address.pathname = '/settings'; window.dispatchEvent(new Event('popstate'));
  await vi.runOnlyPendingTimersAsync();
  expect(cancelFrame).toHaveBeenCalledTimes(1); expect(imported).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  address.pathname = '/introduction'; expect(takePreparedDailyQuote(new Date(), previous)).toBeUndefined();
});

it('waits for observed FCP and starts one import after a matching handoff, including buffered paint entries', async () => {
  paintExists.mockReturnValue(false);
  const paint = observePaint();
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  const date = new Date(); prepareDailyQuote(); prepareDailyQuote();
  delete publicRoot.dataset.publicPage;
  const pending = takePreparedDailyQuote(date, previous);
  expect(paint.observe).toHaveBeenCalledExactlyOnceWith({ type: 'paint', buffered: true });
  expect(paint.disconnect).not.toHaveBeenCalled();
  paint.deliver('first-paint'); await vi.runOnlyPendingTimersAsync();
  expect(requestAnimationFrame).not.toHaveBeenCalled(); expect(imported).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  paint.deliver('first-paint', 'first-contentful-paint'); paint.deliver('first-contentful-paint');
  expect(await pending).toBe(selection);
  expect(paint.disconnect).toHaveBeenCalledTimes(1);
  expect(imported).toHaveBeenCalledTimes(1); expect(choose).toHaveBeenCalledExactlyOnceWith(date, previous);
  expect(takePreparedDailyQuote(date, previous)).toBeUndefined();
});

it.each(['popstate', 'pagehide'])('disconnects an unconsumed FCP observer on %s and ignores an already-queued callback', async event => {
  paintExists.mockReturnValue(false);
  const paint = observePaint();
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  prepareDailyQuote(); if (event === 'popstate') address.pathname = '/settings'; window.dispatchEvent(new Event(event));
  paint.deliver('first-contentful-paint'); await vi.runOnlyPendingTimersAsync();
  expect(paint.disconnect).toHaveBeenCalledTimes(1);
  expect(imported).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  address.pathname = '/introduction'; expect(takePreparedDailyQuote(new Date(), previous)).toBeUndefined();
});

it.each(['unsupported', 'observe-error'])('keeps the existing frame/task fallback when paint observation is %s', async failure => {
  paintExists.mockReturnValue(false);
  const paint = observePaint(failure !== 'unsupported');
  if (failure === 'observe-error') paint.observe.mockImplementation(() => { throw new Error('Synthetic unsupported observe options'); });
  let frame!: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
  Object.assign(window, { setTimeout });
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  const date = new Date(); prepareDailyQuote(); const pending = takePreparedDailyQuote(date, previous);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(imported).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
  expect(paint.observe).toHaveBeenCalledTimes(failure === 'unsupported' ? 0 : 1);
  expect(paint.disconnect).toHaveBeenCalledTimes(failure === 'unsupported' ? 0 : 1);
  frame(16); expect(imported).not.toHaveBeenCalled(); await vi.runOnlyPendingTimersAsync();
  expect(await pending).toBe(selection); expect(choose).toHaveBeenCalledExactlyOnceWith(date, previous);
});

it('rejects a consumed preparation if the route changes before observed FCP', async () => {
  paintExists.mockReturnValue(false);
  const paint = observePaint();
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  prepareDailyQuote(); const pending = takePreparedDailyQuote(new Date(), previous);
  address.pathname = '/settings'; paint.deliver('first-contentful-paint');
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(paint.disconnect).toHaveBeenCalledTimes(1); expect(imported).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled();
});

it('preserves the original load rejection after observed FCP', async () => {
  paintExists.mockReturnValue(false);
  const failure = new Error('Synthetic post-FCP quotation failure'); choose.mockRejectedValue(failure);
  const paint = observePaint();
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  prepareDailyQuote(); const pending = takePreparedDailyQuote(new Date(), previous);
  paint.deliver('first-contentful-paint');
  await expect(pending).rejects.toBe(failure);
  expect(paint.disconnect).toHaveBeenCalledTimes(1); expect(choose).toHaveBeenCalledTimes(1);
});

it('keeps early frame/task preparation for the first-visit shell without SSR content to paint', async () => {
  paintExists.mockReturnValue(false); delete publicRoot.dataset.publicPage;
  const paint = observePaint();
  let frame!: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
  Object.assign(window, { setTimeout });
  const { prepareDailyQuote, takePreparedDailyQuote } = await import('../src/app/DailyQuote');
  const date = new Date(); prepareDailyQuote(); prepareDailyQuote(); const pending = takePreparedDailyQuote(date, previous);
  expect(paint.observe).not.toHaveBeenCalled(); expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(imported).not.toHaveBeenCalled(); frame(16); await vi.runOnlyPendingTimersAsync();
  expect(await pending).toBe(selection); expect(imported).toHaveBeenCalledTimes(1);
  expect(choose).toHaveBeenCalledExactlyOnceWith(date, previous); expect(paint.disconnect).not.toHaveBeenCalled();
});
