import { messages } from '../locales';
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { Locale } from '../shared/content';
import { sessionSummarySchema, type SessionSummary } from '../shared/auth';
import { createShareSchema, sharingConnectionsSchema, sharingSummariesSchema } from '../shared/sharing';
import { attempts, db, profiles, settings } from '../data/db';
import { jsonRequest } from '../data/syncClient';
import { SettingsPicker } from './SettingsPicker';

const labels = messages('sharingUpload');
// Key by exact content so edits invalidate approval.
export function SharingUpload({ locale, profileId, attemptId, title, text }: { locale: Locale; profileId: string; attemptId: string; title: string; text: string }) {
  const t = labels[locale];
  const [session, setSession] = useState<SessionSummary>();
  const [profileName, setProfileName] = useState('');
  const [clients, setClients] = useState<z.infer<typeof sharingConnectionsSchema>['connections']>();
  const [clientId, setClientId] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [message, setMessage] = useState('');
  const operation = useRef<AbortController | undefined>(undefined), cooldown = useRef(0);
  useEffect(() => () => operation.current?.abort(), []);
  const tooLarge = title.length > 120 || new TextEncoder().encode(JSON.stringify({ title, text })).length > 32768;
  async function localScope() {
    return db.transaction('r', settings, attempts, profiles, async () => {
      const active = await settings.get('activeProfile'), attempt = await attempts.get(attemptId), profile = await profiles.get(profileId);
      if ((active?.value ?? 'local-guest') !== profileId || attempt?.profileId !== profileId || !profile) throw new Error('SHARING_SCOPE_CHANGED');
      return profile.name;
    });
  }
  async function run(upload = false) {
    if (operation.current || submitted || upload && (!confirmed || !clientId || tooLarge)) return;
    if (Date.now() < cooldown.current) { setMessage(t.limited); return; }
    if (!navigator.onLine) { setMessage(t.offline); return; }
    const controller = new AbortController(); operation.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    setBusy(true); setMessage('');
    let sent = false;
    try {
      const name = await localScope();
      const current = sessionSummarySchema.parse(await jsonRequest('/api/session', signal));
      if (!current.account || !current.csrfToken) { setSession(undefined); setClients(undefined); setMessage(t.login); return; }
      if (upload && current.account.id !== session?.account?.id) throw new Error('SHARING_SCOPE_CHANGED');
      const live = sharingConnectionsSchema.parse(await jsonRequest('/api/ai/connections', signal)).connections.filter(client => client.contextsRead === 1 && client.expiresAt * 1000 > Date.now());
      if (sessionSummarySchema.parse(await jsonRequest('/api/session', signal)).account?.id !== current.account.id) throw new Error('SHARING_SCOPE_CHANGED');
      if (!upload) { setSession(current); setProfileName(name); setClients(live); setClientId(''); setConfirmed(false); return; }
      const client = live.find(client => client.id === clientId);
      if (!client) throw new Error('SHARING_SCOPE_CHANGED');
      const value = createShareSchema.parse({ profileId, connectionId: clientId, title, text, confirm: true });
      await localScope(); signal.throwIfAborted();
      // A lost response may hide a successful upload; require explicit retry.
      sent = true; setSubmitted(true);
      const result = sharingSummariesSchema.shape.shares.element.parse(await jsonRequest('/api/ai/shares', signal, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': current.csrfToken }, body: JSON.stringify(value) }));
      if (result.profileId !== profileId || result.connectionId !== clientId || result.title !== value.title) throw new Error('SHARING_RESPONSE');
      signal.throwIfAborted();
      setMessage(`${t.done} ${new Date(Math.min(result.expiresAt, client.expiresAt) * 1000).toLocaleString(locale)}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = error instanceof Error ? error.message : '';
      const retryAt = error instanceof Error && error.cause && typeof error.cause === 'object' && 'retryAt' in error.cause ? Number(error.cause.retryAt) : 0;
      if (Number.isFinite(retryAt)) cooldown.current = retryAt;
      setConfirmed(false); if (!sent) { setSession(undefined); setClients(undefined); }
      setMessage(sent ? t.uncertain : code === 'SHARING_SCOPE_CHANGED' ? t.changed : code.endsWith('NOT_CONFIGURED') ? t.unavailable : code.endsWith('RATE_LIMITED') ? t.limited : t.failed);
    } finally {
      if (operation.current === controller) operation.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <details className="sharing-upload"><summary>{t.title}</summary><button type="button" disabled={busy || submitted} onClick={() => void run()}>{busy ? t.loading : t.load}</button>
    {tooLarge && <p className="error" role="alert">{t.large}</p>}
    {clients && session?.account && <><p>{t.account}: <strong>{session.account.login}</strong><br/>{t.profile}: {profileName}</p>
      {!clients.length ? <p>{t.empty}</p> : <><SettingsPicker label={t.client} value={clientId} disabled={busy || submitted} options={[{ value: '', label: t.choose }, ...clients.map(client => ({ value: client.id, label: client.name }))]} onChange={value => { setClientId(value); setConfirmed(false); }}/>
      <article className="ai-preview"><h4>{t.preview}: {title}</h4><p>{text}</p></article><p className="muted">{t.lifetime} {t.copies}</p>
      <label className="ai-request"><input type="checkbox" disabled={busy || submitted || tooLarge || !clientId} checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>{t.confirm}</label>
      <button type="button" disabled={busy || submitted || tooLarge || !confirmed || !clientId} onClick={() => void run(true)}>{busy ? t.busy : t.send}</button></>}
    </>}
    <p role="status" aria-live="polite">{message}</p><a href="/settings#mcp">{t.settings}</a>
  </details>;
}
