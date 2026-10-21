import { messages } from '../locales';
import { useEffect, useId, useRef, useState } from 'react';
import type { z } from 'zod';
import type { Locale } from '../shared/content';
import { sessionSummarySchema } from '../shared/auth';
import { sharingConnectionsSchema, sharingSummariesSchema, sharingRevokedSchema } from '../shared/sharing';
import { jsonRequest } from '../data/syncClient';

const labels = messages('sharingManagement');
export function SharingManagement({ locale, accountId }: { locale: Locale; accountId: number }) {
  const t = labels[locale], id = useId();
  const [open, setOpen] = useState(false), [toast, setToast] = useState('');
  const root = useRef<HTMLDetailsElement>(null), disclosure = useRef<HTMLElement>(null);
  const focusIndex = useRef<number | undefined>(undefined);
  const [data, setData] = useState<{ connections: z.infer<typeof sharingConnectionsSchema>['connections']; shares: z.infer<typeof sharingSummariesSchema>['shares'] }>();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const operation = useRef<AbortController | undefined>(undefined);
  const cooldown = useRef(0);
  useEffect(() => () => operation.current?.abort(), [accountId]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (focusIndex.current === undefined) return;
    const buttons = root.current?.querySelectorAll<HTMLButtonElement>('[data-revoke]');
    (buttons?.[Math.min(focusIndex.current, buttons.length - 1)] ?? disclosure.current)?.focus();
    focusIndex.current = undefined;
  }, [data]);
  async function run(path?: string, title?: string) {
    if (operation.current) return;
    if (Date.now() < cooldown.current) { setMessage(t.limited); return; }
    if (!navigator.onLine) { setMessage(t.offline); return; }
    if (path && !confirm(`${title}\n\n${t.confirm}`)) return;
    const nextFocus = Array.from(root.current?.querySelectorAll('[data-revoke]') ?? []).indexOf(document.activeElement!);
    const controller = new AbortController(); operation.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    setBusy(true); setMessage(''); setToast('');
    try {
      const session = sessionSummarySchema.parse(await jsonRequest('/api/session', signal));
      if (session.account?.id !== accountId || !session.csrfToken) throw new Error('SHARING_ACCOUNT_CHANGED');
      if (path) sharingRevokedSchema.parse(await jsonRequest(path, signal, { method: 'DELETE', headers: { 'X-CSRF-Token': session.csrfToken } }));
      // Read sequentially so cancellation needs no private text.
      const connections = sharingConnectionsSchema.parse(await jsonRequest('/api/ai/connections', signal)).connections;
      const shares = sharingSummariesSchema.parse(await jsonRequest('/api/ai/shares', signal)).shares;
      if (sessionSummarySchema.parse(await jsonRequest('/api/session', signal)).account?.id !== accountId) throw new Error('SHARING_ACCOUNT_CHANGED');
      signal.throwIfAborted();
      if (path) {
        focusIndex.current = Math.max(0, nextFocus);
        setToast(messages('sharingManagement', { name: title ?? '' })[locale].done);
      }
      setData({ connections, shares });
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
  const granted = (seconds: number) => messages('sharingManagement', { date: new Date(seconds * 1000).toLocaleDateString(locale) })[locale].granted;
  return <><details className="sharing-management service-disclosure" ref={root} onToggle={event => { const expanded = event.currentTarget.open; setOpen(expanded); if (expanded && !data) void run(); }}><summary ref={disclosure} aria-controls={`${id}-permissions`} aria-expanded={open}>{t.title}</summary>
    {open && <button className="sharing-refresh" type="button" aria-label={t.load} aria-busy={busy} disabled={busy} onClick={() => void run()}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5M20 7l-3-2"/></svg></button>}
    <div id={`${id}-permissions`} aria-busy={busy}>
    {(busy || message) && <p className="muted" role="status">{busy ? t.loading : message}</p>}
    {data && <><h3>{t.shares}</h3>{!data.shares.length && <p className="sharing-empty">{t.empty}</p>}{data.shares.map(share => <article key={share.id}><div><h4>{share.title}</h4><p>{granted(share.createdAt)}<br/>{data.connections.find(client => client.id === share.connectionId)?.name}<br/>{t.profile}: {share.profileId}<br/>{t.expires}: {date(share.expiresAt)}</p></div><button className="service-danger" data-revoke type="button" disabled={busy} aria-label={`${t.revokeShare}: ${share.title}`} onClick={() => void run(`/api/ai/shares/${share.id}`, share.title)}>{t.revoke}</button></article>)}
    <h3>{t.clients}</h3>{!data.connections.length && <p className="sharing-empty">{t.empty}</p>}{data.connections.map(client => <article key={client.id}><div><h4>{client.name}</h4><p>{granted(client.createdAt)}<br/>{[client.contextsRead ? t.context : '', client.materialsRead ? t.material : ''].filter(Boolean).join(' · ')}<br/>{t.expires}: {date(client.expiresAt)}</p></div><button className="service-danger" data-revoke type="button" disabled={busy} aria-label={`${t.revokeClient}: ${client.name}`} onClick={() => void run(`/api/ai/connections/${client.id}`, client.name)}>{t.revoke}</button></article>)}</>}
    </div>
  </details><div className="service-toast" role="status" aria-live="polite" aria-atomic="true">{toast}</div></>;
}
