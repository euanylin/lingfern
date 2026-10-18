import { messages } from '../locales';
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { Locale } from '../shared/content';
import { sessionSummarySchema } from '../shared/auth';
import { sharingConnectionsSchema, sharingSummariesSchema, sharingRevokedSchema } from '../shared/sharing';
import { jsonRequest } from '../data/syncClient';

const labels = messages('sharingManagement');
export function SharingManagement({ locale, accountId }: { locale: Locale; accountId: number }) {
  const t = labels[locale];
  const [data, setData] = useState<{ connections: z.infer<typeof sharingConnectionsSchema>['connections']; shares: z.infer<typeof sharingSummariesSchema>['shares'] }>();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const operation = useRef<AbortController | undefined>(undefined);
  const cooldown = useRef(0);
  useEffect(() => () => operation.current?.abort(), [accountId]);
  async function run(path?: string, title?: string) {
    if (operation.current) return;
    if (Date.now() < cooldown.current) { setMessage(t.limited); return; }
    if (!navigator.onLine) { setMessage(t.offline); return; }
    if (path && !confirm(`${title}\n\n${t.confirm}`)) return;
    const controller = new AbortController(); operation.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    setBusy(true); setMessage('');
    try {
      const session = sessionSummarySchema.parse(await jsonRequest('/api/session', signal));
      if (session.account?.id !== accountId || !session.csrfToken) throw new Error('SHARING_ACCOUNT_CHANGED');
      if (path) sharingRevokedSchema.parse(await jsonRequest(path, signal, { method: 'DELETE', headers: { 'X-CSRF-Token': session.csrfToken } }));
      // Sequential reads keep rejection and cancellation observable; no private text is requested.
      const connections = sharingConnectionsSchema.parse(await jsonRequest('/api/ai/connections', signal)).connections;
      const shares = sharingSummariesSchema.parse(await jsonRequest('/api/ai/shares', signal)).shares;
      if (sessionSummarySchema.parse(await jsonRequest('/api/session', signal)).account?.id !== accountId) throw new Error('SHARING_ACCOUNT_CHANGED');
      signal.throwIfAborted();
      setData({ connections, shares }); if (path) setMessage(t.done);
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = error instanceof Error ? error.message : '';
      const retryAt = error instanceof Error && error.cause && typeof error.cause === 'object' && 'retryAt' in error.cause ? Number(error.cause.retryAt) : 0;
      if (Number.isFinite(retryAt)) cooldown.current = retryAt;
      setData(undefined);
      setMessage(code === 'SHARING_ACCOUNT_CHANGED' ? t.changed : code.endsWith('NOT_CONFIGURED') ? t.unavailable : code.endsWith('RATE_LIMITED') ? t.limited : t.failed);
    } finally {
      if (operation.current === controller) operation.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const date = (seconds: number) => new Date(seconds * 1000).toLocaleString(locale);
  return <details className="sharing-management"><summary>{t.title}</summary>
    <button type="button" disabled={busy} onClick={() => void run()}>{busy ? t.loading : t.load}</button>
    <p role="status" aria-live="polite">{message}</p>
    {data && <><h3>{t.shares}</h3>{!data.shares.length && <p>{t.empty}</p>}{data.shares.map(share => <article key={share.id}><h4>{share.title}</h4><p>{data.connections.find(client => client.id === share.connectionId)?.name}<br/>{t.profile}: {share.profileId}<br/>{t.expires}: {date(share.expiresAt)}</p><button type="button" disabled={busy} onClick={() => void run(`/api/ai/shares/${share.id}`, share.title)}>{t.revokeShare}</button></article>)}
    <h3>{t.clients}</h3>{!data.connections.length && <p>{t.empty}</p>}{data.connections.map(client => <article key={client.id}><h4>{client.name}</h4><p>{[client.contextsRead ? t.context : '', client.materialsRead ? t.material : ''].filter(Boolean).join(' · ')}<br/>{t.expires}: {date(client.expiresAt)}</p><button type="button" disabled={busy} onClick={() => void run(`/api/ai/connections/${client.id}`, client.name)}>{t.revokeClient}</button></article>)}</>}
  </details>;
}
