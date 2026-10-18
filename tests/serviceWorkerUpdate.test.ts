import { afterEach, expect, it, vi } from 'vitest';
import { activateWaitingUpdate } from '../src/app/serviceWorkerUpdate';

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
