import { messages } from '../locales';
import { useEffect, useState } from 'react';
import { McpSettings } from './McpSettings';
import { SyncControls } from './SyncControls';
import { RepositoryBinding, RepositorySetup } from './RepositoryBinding';
import { SyncAccountChoice } from './SyncAccountChoice';
import { disconnectSummarySchema, sessionSummarySchema, type SessionSummary } from '../shared/auth';
import type { Locale } from '../shared/content';

const labels = messages('githubIdentity');
const disconnectLabels = messages('githubIdentity_disconnectLabels');
export function GithubIdentity({ locale, profileId, localProfileId, onProfileChange }: { locale: Locale; profileId: string; localProfileId: string; onProfileChange: () => Promise<void> }) {
  const t = labels[locale], d = disconnectLabels[locale];
  const [summary, setSummary] = useState<SessionSummary>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'failed'>('loading');
  const [reload, setReload] = useState(0);
  const [disconnected, setDisconnected] = useState<'done' | 'partial' | 'failed'>();
  useEffect(() => {
    const abort = new AbortController();
    setStatus('loading');
    void fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', signal: abort.signal }).then(async response => {
      if (response.status === 503 && (await response.json() as { error?: string }).error === 'AUTH_NOT_CONFIGURED') { if (!abort.signal.aborted) setStatus('unavailable'); return; }
      if (!response.ok) throw new Error('SESSION');
      const next = sessionSummarySchema.parse(await response.json());
      if (abort.signal.aborted) return;
      setSummary(next); setStatus('ready');
    }).catch(() => { if (!abort.signal.aborted) setStatus('failed'); });
    return () => abort.abort();
  }, [reload]);
  const binding = summary?.bindings?.find(binding => binding.profileId === profileId && !binding.disabled);
  async function logout() {
    if (!summary?.csrfToken) return;
    setStatus('loading');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': summary.csrfToken } });
      if (!response.ok) throw new Error('LOGOUT');
      setSummary({ account: null, syncAvailable: false }); setStatus('ready');
    } catch { setStatus('failed'); }
  }
  async function disconnect() {
    if (!summary?.csrfToken || !confirm(d.confirm)) return;
    setStatus('loading'); setDisconnected(undefined);
    try {
      const response = await fetch('/api/auth/disconnect', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': summary.csrfToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
      if (!response.ok) throw new Error('DISCONNECT');
      const result = disconnectSummarySchema.parse(await response.json());
      setSummary({ account: null, syncAvailable: false }); setStatus('ready'); setDisconnected(result.providerRevoked ? 'done' : 'partial');
    } catch { setStatus('failed'); setDisconnected('failed'); }
  }
  return <><section className="github-identity"><h2>{t.title}</h2><p className="muted">{t.description}</p>
    {new URLSearchParams(location.search).get('auth') === 'cancelled' && <p role="status">{t.cancelled}</p>}
    {status === 'ready' ? summary?.account ? <><div className="github-status-line" data-status="connected"><span className="github-status"><span className="github-status-dot" aria-hidden="true"/><span>{t.signedIn}{['zh-Hans', 'zh-Hant', 'ja'].includes(locale) ? '：' : ': '}<bdi>{summary.account.login}</bdi></span></span></div><SyncAccountChoice key={`${summary.account.id}:${localProfileId}:${profileId}`} locale={locale} localProfileId={localProfileId} profileId={profileId} summary={summary} onProfileChange={onProfileChange}><RepositoryBinding locale={locale} profileId={profileId} summary={summary} reload={() => setReload(value => value + 1)}/>{summary.syncAvailable && binding?.bindingVersion && <SyncControls key={`${summary.account.id}:${localProfileId}:${binding.bindingVersion}`} locale={locale} profileId={localProfileId} scope={{ accountId: summary.account.id, profileId, bindingVersion: binding.bindingVersion }} summary={summary} onChange={onProfileChange} refresh={() => setReload(value => value + 1)}/>}</SyncAccountChoice><div className="github-session-actions"><button type="button" onClick={() => void logout()}>{t.logout}</button><button className="service-danger" type="button" onClick={() => void disconnect()}>{d.action}</button></div></> : <div className="github-status-line" data-status="signed-out"><span className="github-status"><span className="github-status-dot" aria-hidden="true"/>{t.signedOut}</span><a className="primary button github-connect" href="/api/auth/start?return=%2Fsettings">{t.connect}</a></div> : <div className="github-status-line" data-status={status}><span className="github-status" role="status"><span className="github-status-dot" aria-hidden="true"/>{status === 'loading' ? t.loading : status === 'unavailable' ? t.unavailable : t.failed}</span>{status === 'unavailable' ? <button className="primary github-connect" type="button" disabled>{t.connect}</button> : status === 'failed' ? summary?.account ? <button type="button" onClick={() => setReload(value => value + 1)}>{t.retry}</button> : <a className="primary button github-connect" href="/api/auth/start?return=%2Fsettings">{t.connect}</a> : null}</div>}
    {status === 'ready' && !summary?.account && <RepositorySetup locale={locale}/>}
    {disconnected && <p role="status">{d[disconnected]}{disconnected === 'partial' && <> <a href="https://github.com/settings/apps" target="_blank" rel="noopener noreferrer">{d.revoke}</a></>}</p>}
  </section><McpSettings key={status === 'ready' ? summary?.account?.id : 'signed-out'} locale={locale} accountId={status === 'ready' ? summary?.account?.id : undefined}/></>;
}
