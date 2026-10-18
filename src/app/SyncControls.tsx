import { messages } from '../locales';
import { liveQuery } from 'dexie';
import { settings } from '../data/db';
import { useEffect, useRef, useState } from 'react';
import { allowSyncUpload, downloadSyncPage, readSyncConsent, restartSyncDownload, stopSyncUpload, uploadSyncBatch } from '../data/syncClient';
import { readSyncDownload } from '../data/sync';
import type { SessionSummary } from '../shared/auth';
import type { SyncDownloadScope } from '../shared/sync';
import type { Locale } from '../shared/content';

const labels = messages('syncControls');

export function SyncControls({ locale, profileId, scope, summary, onChange, refresh }: { locale: Locale; profileId: string; scope: SyncDownloadScope; summary: SessionSummary; onChange: () => Promise<void>; refresh: () => void }) {
  const t = labels[locale];
  const [consent, setConsent] = useState<Awaited<ReturnType<typeof readSyncConsent>>>();
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [more, setMore] = useState(false);
  const [message, setMessage] = useState<keyof typeof t>(), [expiredCursor, setExpiredCursor] = useState<string>();
  const operation = useRef<AbortController>(undefined);
  useEffect(() => {
    let alive = true;
    void Promise.all([readSyncConsent(profileId), readSyncDownload(profileId, scope)]).then(([saved, progress]) => {
      if (!alive) return;
      if (saved && saved.scope.accountId === scope.accountId && saved.scope.profileId === scope.profileId && saved.scope.bindingVersion === scope.bindingVersion) setConsent(saved);
      setMore(Boolean(progress?.nextCursor)); setReady(true);
    }).catch(() => { if (alive) { setMessage('failed'); setReady(true); } });
    return () => { alive = false; operation.current?.abort(); };
  }, [profileId, scope.accountId, scope.profileId, scope.bindingVersion]);
  useEffect(() => {
    const observer = liveQuery(() => settings.get(`profile:${profileId}:syncSchedule:${scope.accountId}:${scope.bindingVersion}`)).subscribe({ next(row) { if (row?.value === 'paused' || row?.value === 'retry') setMessage('failed'); else if (row?.value === 'done') setMessage('roundDone'); }, error() { setMessage('failed'); } });
    return () => observer.unsubscribe();
  }, [profileId, scope.accountId, scope.bindingVersion]);
  async function run(action: 'allow' | 'upload' | 'download' | 'rescan') {
    const abort = new AbortController(); operation.current = abort;
    setBusy(true); setMessage(undefined);
    try {
      if (action === 'allow') { const allowed = await allowSyncUpload(profileId, scope, summary); abort.signal.throwIfAborted(); setConsent(allowed); setMessage('allowed'); }
      else if (action === 'upload' && consent) { const result = await uploadSyncBatch(profileId, consent, abort.signal); abort.signal.throwIfAborted(); setMessage(result); }
      else {
        if (action === 'rescan' && expiredCursor) { await restartSyncDownload(profileId, scope, expiredCursor); setExpiredCursor(undefined); }
        const result = await downloadSyncPage(profileId, scope, abort.signal);
        abort.signal.throwIfAborted();
        setMore(Boolean(result.nextCursor)); setMessage(result.results.includes('conflict') ? 'conflict' : result.nextCursor ? 'more' : 'downloaded');
        await onChange();
      }
    } catch (error) {
      if (abort.signal.aborted) return;
      const code = error instanceof Error ? error.message : '';
      if (code === 'SYNC_CURSOR_INVALID') {
        try { setExpiredCursor((await readSyncDownload(profileId, scope))?.cursor); setMessage('expired'); } catch { setMessage('failed'); }
      }
      else setMessage(['SYNC_RETRY_LATER', 'RATE_LIMITED', 'SYNC_RATE_LIMITED', 'SYNC_HTTP_429'].includes(code) ? 'limited' : code === 'SYNC_BUSY' ? 'locked' : code === 'SYNC_BATCH_CONFLICT' ? 'conflict' : ['SYNC_UNAVAILABLE', 'SYNC_SCOPE_CHANGED', 'SYNC_CONSENT_CHANGED', 'AUTHORISATION_CHANGED', 'UNAUTHENTICATED'].includes(code) ? 'changed' : 'failed');
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }
  async function stop() {
    operation.current?.abort(); setBusy(false);
    try { await stopSyncUpload(profileId); setConsent(undefined); setMessage('stopped'); }
    catch { setMessage('failed'); }
  }
  return <section className="sync-controls"><h3>{t.title}</h3><p className="muted">{consent ? t.allowed : t.detail}</p>
    <div className="backup-actions">{!consent && <button type="button" disabled={!ready || busy} onClick={() => void run('allow')}>{t.allow}</button>}
      <button type="button" disabled={!ready || busy || !consent} onClick={() => void run('upload')}>{t.upload}</button>
      <button type="button" disabled={!ready || busy} onClick={() => void run('download')}>{more ? t.next : t.download}</button>
      {(consent || busy) && <button type="button" onClick={() => void stop()}>{t.stop}</button>}
      {expiredCursor && <button type="button" disabled={busy} onClick={() => void run('rescan')}>{t.rescan}</button>}
    </div>
    {(busy || message) && <p role="status">{busy ? t.busy : message && t[message]}</p>}
    {message === 'changed' && <button type="button" onClick={refresh}>{t.refresh}</button>}
  </section>;
}
