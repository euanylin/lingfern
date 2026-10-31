import { messages } from '../locales';
import { liveQuery } from 'dexie';
import { settings, syncClocks } from '../data/db';
import { useEffect, useState } from 'react';
import { allowSyncUpload, prepareAutoSync, storedSyncConsent, readSyncState, requestSyncNow, stopSyncUpload, syncConfigurationPending, syncConnectionError, type SyncState } from '../data/syncClient';
import { canonicalJson, type SyncDownloadScope } from '../shared/sync';
import type { SessionSummary } from '../shared/auth';
import type { Locale } from '../shared/content';
import { SettingsPicker } from './SettingsPicker';

const labels = messages('syncControls');

export function SyncControls({ locale, profileId, scope, summary, refresh }: { locale: Locale; profileId: string; scope: SyncDownloadScope; summary: SessionSummary; refresh: () => void }) {
  const t = labels[locale];
  const [data, setData] = useState<{ enabled: boolean; state?: SyncState; revision: number; configuring: boolean }>();
  const [failed, setFailed] = useState(false), [saving, setSaving] = useState(false), [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let alive = true, observer: { unsubscribe(): void } | undefined;
    void prepareAutoSync(profileId, summary).then(() => {
      if (!alive) return;
      observer = liveQuery(async () => {
        const consent = storedSyncConsent((await settings.get(`profile:${profileId}:syncConsent`))?.value);
        return { enabled: Boolean(consent && canonicalJson(consent.scope) === canonicalJson(scope)), state: await readSyncState(profileId, scope), revision: (await syncClocks.get(profileId))?.localRevision ?? 0, configuring: await syncConfigurationPending(profileId) };
      }).subscribe({ next(value) { setData(value); setFailed(false); }, error() { setFailed(true); } });
    }).catch(() => { if (alive) setFailed(true); });
    const connection = () => setOnline(navigator.onLine);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    return () => { alive = false; observer?.unsubscribe(); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); };
  }, [profileId, scope.accountId, scope.profileId, scope.bindingVersion, summary]);
  async function toggle(value: string) {
    setSaving(true); setFailed(false);
    try { if (value === 'on') await allowSyncUpload(profileId, scope, summary); else await stopSyncUpload(profileId, scope); }
    catch { setFailed(true); }
    finally { setSaving(false); }
  }
  async function request() {
    try { await requestSyncNow(profileId, scope); setFailed(false); }
    catch { setFailed(true); }
  }
  const state = data?.state, changed = syncConnectionError(state?.error);
  const phase = !data?.enabled ? 'disabled' : !online ? 'offline' : data.configuring || state?.phase === 'synced' && data.revision > (state.localRevision ?? -1) ? 'pending' : state?.phase ?? 'pending';
  const problem = changed ? t.changed : state?.error?.includes('CONFLICT') || state?.error === 'SYNC_REMOTE_INVALID' || state?.error === 'SYNC_INTEGRITY' ? t.conflict : state?.error?.includes('CAPACITY') || state?.error === 'SYNC_RESPONSE_LIMIT' ? t.capacity : state?.error?.includes('LIMIT') || state?.error === 'SYNC_HTTP_429' ? t.limited : t.failed;
  const canSync = data?.enabled && !data.configuring && online && state?.phase !== 'syncing' && !saving;
  return <section className="sync-controls"><h3 className="sr-only">{t.title}</h3>
    <SettingsPicker label={t.auto} value={data?.enabled === false ? 'off' : 'on'} options={[{ value: 'on', label: t.on }, { value: 'off', label: t.off }]} disabled={!data || data.configuring || saving} onChange={value => void toggle(value)}/>
    <div className="sync-summary">{data && <p role="status" data-sync-status={failed ? 'error' : phase}>{failed || phase === 'error' ? problem : t[phase]}</p>}
    {!data && failed && <p role="status">{t.failed}</p>}
    {state?.lastSuccessAt && <p className="muted">{t.lastSuccess}: <time dateTime={state.lastSuccessAt}><bdi>{new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.lastSuccessAt))}</bdi></time></p>}</div>
    {data?.enabled && !data.configuring && online && <div className="backup-actions"><button className={canSync ? 'primary' : undefined} type="button" disabled={!canSync} onClick={() => void request()}>{state?.phase === 'error' ? t.retry : t.sync}</button>{changed && <button type="button" onClick={refresh}>{t.refresh}</button>}</div>}
  </section>;
}
