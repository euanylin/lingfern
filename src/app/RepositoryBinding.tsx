import { messages } from '../locales';
import { useState } from 'react';
import { bindingIntentSchema, repositoryBindingSchema, repositoryChoicesSchema, type BindingIntent, type RepositoryChoice } from '../shared/repository';
import type { Locale } from '../shared/content';
import type { SessionSummary } from '../shared/auth';
import { SettingsPicker } from './SettingsPicker';

const labels = messages('repositoryBinding');
const historyLabels = messages('repositoryBinding_historyLabels');
export function RepositoryBinding({ locale, profileId, summary, reload }: { locale: Locale; profileId: string; summary: SessionSummary; reload: () => void }) {
  const h = historyLabels[locale];
  const t = labels[locale], binding = summary.bindings?.find(value => value.profileId === profileId);
  const [choices, setChoices] = useState<RepositoryChoice[]>();
  const [selected, setSelected] = useState('');
  const [installationUrl, setInstallationUrl] = useState('https://github.com/settings/installations');
  const [intent, setIntent] = useState<BindingIntent>();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function call(path: string, body?: unknown) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': summary.csrfToken! }, body: JSON.stringify(body) } : {}) });
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(typeof result === 'object' && result && 'error' in result ? String(result.error) : 'FAILED');
    return result;
  }
  function fail(error: unknown) {
    const code = error instanceof Error ? error.message : '';
    const key = ['REPOSITORY_UNSAFE', 'REPOSITORY_NOT_DEDICATED', 'REPOSITORY_MARKER'].includes(code) ? 'unsafe' : code === 'REPOSITORY_UNINITIALISED' ? 'uninitialised' : code === 'REPOSITORY_UNAVAILABLE' ? 'unavailable' : code === 'PROFILE_MISMATCH' ? 'mismatch' : ['BINDING_EXPIRED', 'AUTHORISATION_CHANGED'].includes(code) ? 'expired' : code === 'REPOSITORY_CAPACITY' ? 'capacity' : ['GITHUB_PERMISSION', 'INSTALLATION_SCOPE', 'REPOSITORY_ACCESS', 'UNAUTHENTICATED'].includes(code) ? 'permission' : code === 'RATE_LIMITED' ? 'limited' : 'failed';
    setMessage(t[key]);
  }
  async function find() {
    setBusy(true); setMessage(''); setIntent(undefined);
    try { const result = repositoryChoicesSchema.parse(await call('/api/sync/repositories')); setChoices(result.repositories); setSelected(String((result.repositories.find(value => value.name === 'lingfern-data') ?? result.repositories[0])?.repositoryId ?? '')); if (result.installationUrl) setInstallationUrl(result.installationUrl); }
    catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function verify() {
    const choice = choices?.find(value => String(value.repositoryId) === selected);
    if (!choice) return;
    setBusy(true); setMessage(''); setIntent(undefined);
    try { setIntent(bindingIntentSchema.parse(await call('/api/sync/inspect', { ...choice, profileId }))); }
    catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function bind() {
    if (!intent) return;
    setBusy(true); setMessage('');
    try { const result = await call('/api/sync/bind', { intent: intent.intent, confirm: true }) as { binding: unknown }; repositoryBindingSchema.parse(result.binding); setIntent(undefined); reload(); }
    catch (error) { setIntent(undefined); fail(error); } finally { setBusy(false); }
  }
  async function disconnect() {
    if (!confirm(t.disconnectConfirm)) return;
    setBusy(true); setMessage('');
    try { await call('/api/sync/disconnect', { profileId, confirm: true }); setIntent(undefined); setMessage(t.disconnected); reload(); }
    catch (error) { fail(error); } finally { setBusy(false); }
  }
  return <section className="repository-binding"><h3>{t.title}</h3>
    {binding && <><p>{t.bound}: <strong>{binding.owner}/{binding.name}</strong></p>{(binding.disabled || !summary.syncAvailable) && <p role="status" className="muted">{binding.disabled ? t.disabled : t.pending}</p>}<button type="button" disabled={busy} onClick={() => void disconnect()}>{t.disconnect}</button></>}
    <ol><li><a href="https://github.com/new?name=lingfern-data" target="_blank" rel="noopener noreferrer">{t.create}</a><p className="muted">{t.setup}</p></li><li><a href={installationUrl} target="_blank" rel="noopener noreferrer">{t.install}</a></li><li><button type="button" disabled={busy} onClick={() => void find()}>{t.find}</button></li></ol>
    {choices?.length === 0 && <p role="status">{t.empty}</p>}
    {Boolean(choices?.length) && <><SettingsPicker label={t.select} value={selected} disabled={busy} options={choices!.map(value => ({ value: String(value.repositoryId), label: value.name }))} onChange={value => { setSelected(value); setIntent(undefined); }}/><button type="button" disabled={busy} onClick={() => void verify()}>{t.inspect}</button></>}
    {intent && <div className="backup-preview"><strong>{intent.owner}/{intent.name}</strong><p>{t.verified}</p><p>{intent.existing ? t.existing : t.marker}</p><p className="muted">{t.boundary}</p><div className="backup-actions"><button type="button" disabled={busy} onClick={() => setIntent(undefined)}>{t.cancel}</button><button type="button" disabled={busy} onClick={() => void bind()}>{t.confirm}</button></div></div>}
    <details className="repository-history"><summary>{h.title}</summary><p>{h.boundary}</p><ol>{h.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="muted">{h.limits}</p><a href="https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository" target="_blank" rel="noopener noreferrer">{h.guide}</a></details>
    {(busy || message) && <p role="status">{busy ? t.busy : message}</p>}
  </section>;
}
