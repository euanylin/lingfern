import { afterEach, expect, it, vi } from 'vitest';
import { activateWaitingUpdate, checkServiceWorkerUpdate } from '../src/app/serviceWorkerUpdate';

function setup() {
  const events = new EventTarget();
  const worker = { postMessage: vi.fn() };
  const container = Object.assign(events, { controller: null as unknown });
  return { worker, container, activate: () => activateWaitingUpdate(container as ServiceWorkerContainer, { waiting: worker } as unknown as ServiceWorkerRegistration) };
}
afterEach(() => vi.useRealTimers());

it('waits for the actual waiting worker to control this tab, including externally installed updates', async () => {
  const { worker, container, activate } = setup();
  let complete = false;
  const result = activate().then(() => { complete = true; });
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  container.controller = {}; container.dispatchEvent(new Event('controllerchange'));
  await Promise.resolve(); expect(complete).toBe(false);
  container.controller = worker; container.dispatchEvent(new Event('controllerchange'));
  await result; expect(complete).toBe(true);
});
it('handles an already activated worker without waiting for an event that already happened', async () => {
  const { container } = setup();
  await expect(activateWaitingUpdate(container as ServiceWorkerContainer, { waiting: null } as ServiceWorkerRegistration)).resolves.toBeUndefined();
});
it('reports failed activation rather than silently leaving an inert confirmation', async () => {
  vi.useFakeTimers();
  const { activate } = setup();
  const result = expect(activate()).rejects.toThrow('UPDATE_TIMEOUT');
  await vi.advanceTimersByTimeAsync(15000); await result;
});

function checking(installing = false) {
  const worker = Object.assign(new EventTarget(), { state: 'installing' as ServiceWorkerState });
  const registration = Object.assign(new EventTarget(), {
    waiting: null as typeof worker | null,
    installing: installing ? worker : null,
    update: vi.fn(async () => {}),
  });
  const controller = new AbortController(), preparing = vi.fn();
  return { worker, registration, controller, preparing, check: () => checkServiceWorkerUpdate(registration as unknown as ServiceWorkerRegistration, preparing, controller.signal) };
}

it('uses a ready update without a redundant network check', async () => {
  const { worker, registration, check, preparing } = checking();
  registration.waiting = worker;
  await expect(check()).resolves.toBe(true);
  expect(registration.update).not.toHaveBeenCalled(); expect(preparing).not.toHaveBeenCalled();
});
it('reports current only after a successful check with no candidate', async () => {
  const { registration, check, preparing } = checking();
  await expect(check()).resolves.toBe(false);
  expect(registration.update).toHaveBeenCalledOnce(); expect(preparing).not.toHaveBeenCalled();
});
it('reports preparation immediately while keeping an unfinished update unavailable', async () => {
  vi.useFakeTimers();
  const { registration, worker, check, preparing } = checking();
  registration.update.mockImplementation(async () => {
    registration.installing = worker; registration.dispatchEvent(new Event('updatefound'));
  });
  let finished = false; const result = check().then(ready => { finished = true; return ready; });
  expect(preparing).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1800); expect(finished).toBe(false);
  registration.waiting = worker; registration.installing = null; worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
  await expect(result).resolves.toBe(true); expect(vi.getTimerCount()).toBe(0);
});
it('reuses an existing installation without queueing another update', async () => {
  const { registration, worker, check, preparing } = checking(true);
  const result = check();
  expect(preparing).toHaveBeenCalledOnce(); expect(registration.update).not.toHaveBeenCalled();
  registration.waiting = worker; worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
  await expect(result).resolves.toBe(true);
});
it('does not report a failed installation as the latest version', async () => {
  vi.useFakeTimers();
  const { registration, worker, check } = checking(true);
  const result = expect(check()).rejects.toThrow('UPDATE_INSTALL_FAILED');
  registration.installing = null; worker.state = 'redundant'; worker.dispatchEvent(new Event('statechange'));
  await result; expect(vi.getTimerCount()).toBe(0);
});
it('bounds a stalled network check and ignores its late result', async () => {
  vi.useFakeTimers();
  const { registration, worker, check, preparing } = checking();
  let release!: () => void;
  registration.update.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
  const result = expect(check()).rejects.toThrow('UPDATE_TIMEOUT');
  await vi.advanceTimersByTimeAsync(15000); await result;
  registration.installing = worker; registration.dispatchEvent(new Event('updatefound')); release(); await Promise.resolve();
  expect(preparing).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('bounds a stalled installation without making it available', async () => {
  vi.useFakeTimers();
  const { check } = checking(true);
  const result = expect(check()).rejects.toThrow('UPDATE_TIMEOUT');
  await vi.advanceTimersByTimeAsync(15000); await result; expect(vi.getTimerCount()).toBe(0);
});
it.each([false, true])('cancels listeners and timers during an update (installing=%s)', async installing => {
  vi.useFakeTimers();
  const { registration, worker, controller, preparing, check } = checking(installing);
  registration.update.mockImplementation(() => new Promise(() => {}));
  const remove = vi.spyOn(registration, 'removeEventListener'), removeWorker = vi.spyOn(worker, 'removeEventListener');
  const result = expect(check()).rejects.toThrow('Cancelled check');
  controller.abort(new Error('Cancelled check')); await result;
  expect(remove).toHaveBeenCalledWith('updatefound', expect.any(Function));
  if (installing) expect(removeWorker).toHaveBeenCalledWith('statechange', expect.any(Function));
  registration.dispatchEvent(new Event('updatefound')); expect(preparing).toHaveBeenCalledTimes(installing ? 1 : 0);
  expect(vi.getTimerCount()).toBe(0);
});
it('does not begin an aborted check', async () => {
  const { controller, registration, check } = checking();
  controller.abort(); await expect(check()).rejects.toMatchObject({ name: 'AbortError' });
  expect(registration.update).not.toHaveBeenCalled();
});
it('handles another tab activating the candidate without losing the refresh action', async () => {
  const { worker, check } = checking(true);
  const result = check(); worker.state = 'activated'; worker.dispatchEvent(new Event('statechange'));
  await expect(result).resolves.toBe(true);
});
it('cleans up after a synchronous update failure', async () => {
  vi.useFakeTimers();
  const { registration, check } = checking();
  registration.update.mockImplementation(() => { throw new Error('Network failure'); });
  await expect(check()).rejects.toThrow('Network failure'); expect(vi.getTimerCount()).toBe(0);
});


it.each([undefined, null])('keeps a rejected check as a failure even without an Error value (%s)', async reason => {
  const { registration, check } = checking();
  registration.update.mockRejectedValue(reason);
  await expect(check()).rejects.toBe(reason);
});
