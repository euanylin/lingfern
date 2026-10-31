export async function mutateResourceCache<T>(name: string, work: (assertActive: () => void) => Promise<T>, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(name, { signal }, () => work(() => {}));
  // Isolate the fallback mutex so cache I/O cannot delay answer transactions.
  const { default: Dexie } = await import('dexie');
  const mutex = new Dexie('lingfern-resource-mutations');
  mutex.version(1).stores({ locks: 'name' });
  try {
    return await mutex.transaction('rw', mutex.table('locks'), async transaction => {
      // A queued transaction does not own its stores until its first request runs.
      await mutex.table('locks').get(name);
      signal?.throwIfAborted();
      let abort!: () => void, failure: unknown;
      const aborted = new Promise<never>((_, reject) => { abort = () => reject(failure ?? (signal?.aborted ? signal.reason : new Error('RESOURCE_MUTATION_ABORTED'))); });
      transaction.on('abort', abort);
      try {
        const working = Dexie.ignoreTransaction(() => work(() => { if (!transaction.active) throw new Error('RESOURCE_MUTATION_ABORTED'); })).catch(error => { failure = error; throw error; });
        return await Promise.race([Dexie.waitFor(working, Infinity), aborted]);
      } finally { transaction.on('abort').unsubscribe(abort); }
    });
  } finally { mutex.close(); }
}
