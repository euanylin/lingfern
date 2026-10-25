import { messages } from '../locales';
import { useEffect, useState } from 'react';
import { McpSettings } from './McpSettings';
import { SyncControls } from './SyncControls';
import { RepositoryBinding } from './RepositoryBinding';
import { SyncAccountChoice } from './SyncAccountChoice';
import type { useGithubSession } from './useGithubSession';
import type { Locale } from '../shared/content';

const labels = messages('githubIdentity');
const disconnectLabels = messages('githubIdentity_disconnectLabels');
export function GithubIdentity({ locale, profileId, localProfileId, onProfileChange, session }: { session: ReturnType<typeof useGithubSession>; locale: Locale; profileId: string; localProfileId: string; onProfileChange: () => Promise<void> }) {
  const t = labels[locale], d = disconnectLabels[locale];
  const { summary, status, refresh, endSession } = session;
  const [disconnected, setDisconnected] = useState<'done' | 'partial' | 'failed'>();
  const accountId = summary?.account?.id;
  useEffect(() => { if (accountId) setDisconnected(undefined); }, [accountId]);
  const binding = summary?.bindings?.find(binding => binding.profileId === profileId);
  async function disconnect() {
    if (!summary?.csrfToken || !confirm(d.confirm)) return;
    setDisconnected(undefined);
    setDisconnected(await endSession());
  }
  return <><section className="github-identity"><h2>{t.title}</h2><p className="muted">{t.description}</p>
    {new URLSearchParams(location.search).get('auth') === 'cancelled' && <p role="status">{t.cancelled}</p>}
    {status === 'ready' ? summary?.account ? <><div className="github-status-line" data-status="connected"><span className="github-status"><span className="github-status-dot" aria-hidden="true"/><span>{t.signedIn}{['zh-Hans', 'zh-Hant', 'ja'].includes(locale) ? '：' : ': '}<bdi>{summary.account.login}</bdi></span></span></div><SyncAccountChoice key={`${summary.account.id}:${localProfileId}:${profileId}`} locale={locale} localProfileId={localProfileId} profileId={profileId} summary={summary} onProfileChange={onProfileChange}><RepositoryBinding key={JSON.stringify(binding)} locale={locale} profileId={profileId} localProfileId={localProfileId} summary={summary} reload={() => refresh()}/>{summary.syncAvailable && !binding?.disabled && binding?.bindingVersion && <SyncControls key={`${summary.account.id}:${localProfileId}:${binding.bindingVersion}`} locale={locale} profileId={localProfileId} scope={{ accountId: summary.account.id, profileId, bindingVersion: binding.bindingVersion }} summary={summary} refresh={() => void refresh()}/>}</SyncAccountChoice><div className="github-session-actions"><button className="service-danger" type="button" onClick={() => void disconnect()}>{d.action}</button></div></> : <div className="github-status-line" data-status="signed-out"><span className="github-status"><span className="github-status-dot" aria-hidden="true"/>{t.signedOut}</span><a className="primary button github-connect" href="/api/auth/start?return=%2Fsettings">{t.connect}</a></div> : <div className="github-status-line" data-status={status}><span className="github-status" role="status"><span className="github-status-dot" aria-hidden="true"/>{status === 'loading' ? t.loading : status === 'unavailable' ? t.unavailable : t.failed}</span>{status === 'failed' ? summary?.account ? <button type="button" onClick={() => void refresh()}>{t.retry}</button> : <a className="primary button github-connect" href="/api/auth/start?return=%2Fsettings">{t.connect}</a> : null}</div>}
    {disconnected && <p role="status">{d[disconnected]}{disconnected === 'partial' && <> <a href="https://github.com/settings/apps" target="_blank" rel="noopener noreferrer">{d.revoke}</a></>}</p>}
  </section><McpSettings key={status === 'ready' ? summary?.account?.id : 'signed-out'} locale={locale} accountId={status === 'ready' ? summary?.account?.id : undefined}/></>;
}
