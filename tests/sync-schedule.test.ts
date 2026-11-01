import { afterEach, expect, it, vi } from 'vitest';
import { db } from '../src/data/db';
import * as client from '../src/data/syncClient';
import { startSyncSchedule } from '../src/data/syncSchedule';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('retries a failed initial batch count on the next wake without reloading', async () => {
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: true });
  const count = vi.spyOn(db.Collection.prototype, 'count').mockRejectedValueOnce(new Error('TEMPORARY_STORAGE_FAILURE'));
  const prepare = vi.spyOn(client, 'prepareAutoSync').mockResolvedValue(undefined);
  const stop = startSyncSchedule('p', async () => {}, { account: null, syncAvailable: false });
  try {
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(count).toHaveBeenCalled());
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(prepare).toHaveBeenCalled());
  } finally { stop(); }
});
