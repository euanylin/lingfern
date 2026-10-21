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
