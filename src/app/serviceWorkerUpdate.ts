export function checkServiceWorkerUpdate(registration: ServiceWorkerRegistration, preparing: () => void, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (registration.waiting) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    let worker: ServiceWorker | null = null, finished = false;
    const cleanup = () => {
      clearTimeout(timeout);
      registration.removeEventListener('updatefound', observe);
      worker?.removeEventListener('statechange', changed);
      signal.removeEventListener('abort', aborted);
    };
    const complete = (error?: unknown, available?: boolean) => {
      if (finished) return;
      finished = true; cleanup();
      if (available === undefined) reject(error); else resolve(available);
    };
    const changed = () => {
      if (finished) return;
      if (registration.waiting || worker?.state === 'activated') complete(undefined, true);
      else if (registration.installing && registration.installing !== worker) observe();
      else if (worker?.state === 'redundant') complete(new Error('UPDATE_INSTALL_FAILED'));
    };
    const observe = () => {
      if (finished) return;
      const next = registration.installing;
      if (next && next !== worker) {
        worker?.removeEventListener('statechange', changed);
        worker = next; worker.addEventListener('statechange', changed);
        // Downloading a discovered update needs its own budget after the quick version check.
        clearTimeout(timeout);
        timeout = setTimeout(() => complete(new Error('UPDATE_TIMEOUT')), 120000);
        preparing();
      }
      changed();
    };
    const aborted = () => complete(signal.reason);
    let timeout = setTimeout(() => complete(new Error('UPDATE_TIMEOUT')), 15000);
    registration.addEventListener('updatefound', observe);
    signal.addEventListener('abort', aborted, { once: true });
    observe();
    // Reuse an installation already in progress instead of queueing another check.
    if (!worker && !finished) {
      try {
        void registration.update().then(() => {
          observe();
          if (!worker && !finished) complete(undefined, false);
        }, error => complete(error));
      } catch (error) { complete(error); }
    }
  });
}

// Another tab may activate a worker outside this tab's Workbox lifecycle.
export async function activateWaitingUpdate(container: ServiceWorkerContainer, registration: ServiceWorkerRegistration) {
  const worker = registration.waiting;
  if (!worker) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timeout); container.removeEventListener('controllerchange', changed); };
    const changed = () => {
      if (container.controller !== worker) return;
      cleanup(); resolve();
    };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('UPDATE_TIMEOUT')); }, 15000);
    container.addEventListener('controllerchange', changed);
    try { worker.postMessage({ type: 'SKIP_WAITING' }); changed(); }
    catch (error) { cleanup(); reject(error); }
  });
}
