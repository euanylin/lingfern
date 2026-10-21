import { liveQuery } from 'dexie';
import { db, settings } from './db';
import { nextSyncUpload, readSyncDownload } from './sync';
import { downloadSyncPage, readSyncConsent, uploadSyncBatch } from './syncClient';
import { profileIdSchema } from '../shared/repository';

// Run one page/batch per foreground round, at least one minute apart.
export function startSyncSchedule(profileId: string, onMerge: () => Promise<void>) {
  profileIdSchema.parse(profileId);
  let stopped = false, running = false, last = -Infinity, retryAt = 0, failures = 0, paused = false, consentId = '';
  let operation: AbortController | undefined, statusKey = '';
  let dirty = true;
  const foreground = () => !stopped && document.visibilityState === 'visible' && navigator.onLine;
  async function run(remote = false) {
    if (!foreground() || running || Date.now() - last < 60000 || Date.now() < retryAt) return;
    running = true;
    try {
      const consent = await readSyncConsent(profileId);
      if (!consent || !foreground()) return;
      if (consent.id !== consentId) { consentId = consent.id; paused = false; failures = 0; retryAt = 0; }
      if (paused) return;
      statusKey = `profile:${profileId}:syncSchedule:${consent.scope.accountId}:${consent.scope.bindingVersion}`;
      const progress = await readSyncDownload(profileId, consent.scope);
      if (!dirty && !progress?.nextCursor && !remote) return;
      const pending = await nextSyncUpload(profileId, consent.scope);
      if (!pending) dirty = false;
      if (!pending && !progress?.nextCursor && !remote) return;
      if (!foreground()) return;
      last = Date.now(); operation = new AbortController();
      const page = await downloadSyncPage(profileId, consent.scope, operation.signal);
      if (page.results.includes('conflict')) throw new Error('SYNC_BATCH_CONFLICT');
      if (page.results.includes('received')) await onMerge();
      operation.signal.throwIfAborted();
      await uploadSyncBatch(profileId, consent, operation.signal);
      failures = 0; retryAt = 0;
      await settings.put({ key: statusKey, value: 'done' });
    } catch (error) {
      if (operation?.signal.aborted || stopped) return;
      const code = error instanceof Error ? error.message : '';
      if (['SYNC_BUSY', 'SYNC_RETRY_LATER'].includes(code)) return;
      const retryable = error instanceof TypeError || ['SYNC_HTTP_500', 'SYNC_HTTP_502', 'SYNC_HTTP_503', 'SYNC_HTTP_504', 'SYNC_PENDING', 'RATE_LIMITED', 'SYNC_RATE_LIMITED', 'REPOSITORY_FAILED', 'AUTH_UNAVAILABLE'].includes(code) || (error instanceof Error && error.name === 'TimeoutError');
      failures++;
      paused = !retryable || failures > 2;
      retryAt = Date.now() + failures * 60000 + Math.random() * 10000;
      if (statusKey) await settings.put({ key: statusKey, value: paused ? 'paused' : 'retry' }).catch(() => {});
    } finally { operation = undefined; running = false; }
  }
  const wake = () => { if (foreground()) void run(true); else operation?.abort(); };
  const timer = setInterval(() => { void run(); }, 60000);
  let completed: number | undefined, savedConsent: string | undefined, eventCount: number | undefined;
  const observer = liveQuery(async () => ({
    completed: await db.table('sessions').where('profileId').equals(profileId).filter(session => session.status === 'completed').count(),
    events: await db.table('syncEvents').where('profileId').equals(profileId).count(),
    consent: (await settings.get(`profile:${profileId}:syncConsent`))?.value,
    active: (await settings.get('activeProfile'))?.value,
  })).subscribe({
    next(value) {
      if (value.active && value.active !== profileId || savedConsent !== undefined && savedConsent !== value.consent) operation?.abort();
      if (eventCount !== undefined && eventCount !== value.events) dirty = true;
      eventCount = value.events;
      const changed = completed !== undefined && value.completed > completed;
      completed = value.completed; savedConsent = value.consent;
      if (changed) void run();
    },
    error() { operation?.abort(); paused = true; },
  });
  document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake); window.addEventListener('offline', wake);
  void run(true);
  return () => { stopped = true; operation?.abort(); clearInterval(timer); observer.unsubscribe(); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); window.removeEventListener('offline', wake); };
}
