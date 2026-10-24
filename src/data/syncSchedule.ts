import { liveQuery } from 'dexie';
import { db, settings, syncClocks } from './db';
import { prepareAutoSync, storedSyncConsent, syncConfigurationPending, syncControlKey, synchronize } from './syncClient';
import type { SessionSummary } from '../shared/auth';
import { profileIdSchema } from '../shared/repository';

export function startSyncSchedule(profileId: string, onMerge: () => Promise<void>, summary: SessionSummary) {
  profileIdSchema.parse(profileId);
  let stopped = false, running = false, again = false, waking = false;
  let operation: AbortController | undefined, consentId = '';
  let debounce: ReturnType<typeof setTimeout> | undefined, dirtySince = 0;
  let deferredWake: ReturnType<typeof setTimeout> | undefined;
  let applied = 0, merging: Promise<void> | undefined;
  const received = () => db.table('syncBatches').where('[profileId+state]').equals([profileId, 'received']).count();
  const baseline = received().then(count => { applied = count; });
  const foreground = () => !stopped && document.visibilityState === 'visible' && navigator.onLine;
  const apply = async () => {
    if (merging) return merging;
    merging = (async () => {
      await baseline;
      while (!stopped) {
        const count = await received();
        if (count === applied) return;
        await onMerge(); applied = count;
      }
    })().finally(() => { merging = undefined; });
    return merging;
  };
  async function run(wake = false) {
    if (!foreground()) { operation?.abort(); return; }
    if (running) { again = true; waking ||= wake; return; }
    running = true;
    try {
      await baseline;
      if (await syncConfigurationPending(profileId)) return;
      const consent = await prepareAutoSync(profileId, summary);
      if (!consent || !foreground()) return;
      consentId = consent.id;
      operation = new AbortController();
      const result = await synchronize(profileId, consent, apply, operation.signal, wake);
      if (result) {
        clearTimeout(deferredWake);
        deferredWake = setTimeout(() => void run(true), Math.max(0, result.wakeAt - Date.now()));
      }
    } catch {
      // The coordinator retains scoped failure/retry state; local learning stays available.
    } finally {
      operation = undefined; running = false;
      if (again && !stopped) {
        const wakeAgain = waking; again = false; waking = false;
        void run(wakeAgain);
      }
    }
  }
  const wake = () => { if (foreground()) void run(true); else operation?.abort(); };
  let revision: number | undefined, requested: string | undefined, storedConsent: string | undefined, association: string | undefined, configuring = false, observed = false;
  const observer = liveQuery(async () => {
    const consent = (await settings.get(`profile:${profileId}:syncConsent`))?.value;
    const stored = storedSyncConsent(consent);
    return {
      consent, consentId: stored?.id,
      request: stored ? (await settings.get(syncControlKey(profileId, stored.scope, 'request')))?.value : undefined,
      active: (await settings.get('activeProfile'))?.value,
      association: (await settings.get(`profile:${profileId}:syncAccount`))?.value,
      configuring: await syncConfigurationPending(profileId),
      revision: (await syncClocks.get(profileId))?.localRevision ?? 0,
      received: await received(),
    };
  }).subscribe({
    next(value) {
      if (value.configuring || value.active && value.active !== profileId || operation && (value.consentId !== consentId || observed && value.association !== association)) operation?.abort();
      if (value.received !== applied) void apply().catch(() => {});
      if (!observed || requested !== value.request || association !== value.association || configuring !== value.configuring || storedConsent !== value.consent && (!operation || value.consentId !== consentId)) void run(!observed || requested === value.request);
      storedConsent = value.consent; requested = value.request;
      association = value.association;
      configuring = value.configuring;
      observed = true;
      if (revision !== undefined && value.revision !== revision) {
        dirtySince ||= Date.now();
        clearTimeout(debounce);
        debounce = setTimeout(() => { dirtySince = 0; void run(); }, Math.max(0, Math.min(2000, dirtySince + 10000 - Date.now())));
      }
      revision = value.revision;
    },
    error() { operation?.abort(); },
  });
  const timer = setInterval(() => { void run(); }, 15000);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake); window.addEventListener('offline', wake);
  return () => {
    stopped = true; operation?.abort(); clearInterval(timer); clearTimeout(debounce); clearTimeout(deferredWake); observer.unsubscribe();
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake); window.removeEventListener('offline', wake);
  };
}
