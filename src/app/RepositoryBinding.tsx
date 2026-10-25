import { messages } from '../locales';
import { useId, useState } from 'react';
import { bindingIntentSchema, repositoryBindingSchema, repositoryChoicesSchema, type BindingIntent, type RepositoryChoice } from '../shared/repository';
import type { Locale } from '../shared/content';
import type { SessionSummary } from '../shared/auth';
import { SettingsPicker } from './SettingsPicker';
import { jsonRequest, pauseSyncConfiguration } from '../data/syncClient';

const labels = messages('repositoryBinding');
const syncLabels = messages('syncControls');
function RepositorySetup({ locale, installationUrl = 'https://github.com/settings/installations', busy = false, onFind }: { locale: Locale; installationUrl?: string; busy?: boolean; onFind?: () => void }) {
  const t = labels[locale];
  return <ol className="repository-steps"><li><a href="https://github.com/new?name=lingfern-data" target="_blank" rel="noopener noreferrer" aria-label={`${t.create} (${t.newWindow})`}>{t.create} <span aria-hidden="true">↗</span></a><p className="muted">{t.setup}</p></li><li><a href={installationUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t.install} (${t.newWindow})`}>{t.install} <span aria-hidden="true">↗</span></a></li><li><button type="button" disabled={busy || !onFind} onClick={onFind}>{t.find}</button></li></ol>;
}
export function RepositoryBinding({ locale, profileId, localProfileId, summary, reload }: { locale: Locale; profileId: string; localProfileId: string; summary: SessionSummary; reload: () => Promise<void> }) {
  const id = useId();
  const t = labels[locale], binding = summary.bindings?.find(value => value.profileId === profileId);
  const [choices, setChoices] = useState<RepositoryChoice[]>();
  const [selected, setSelected] = useState('');
  const [installationUrl, setInstallationUrl] = useState('https://github.com/settings/installations');
  const [intent, setIntent] = useState<BindingIntent>();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function call(path: string, body?: unknown) {
    return jsonRequest(path, AbortSignal.timeout(30000), body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': summary.csrfToken! }, body: JSON.stringify(body) } : {});
  }
  function fail(error: unknown) {
    const code = error instanceof Error ? error.message : '';
    const key = ['REPOSITORY_UNSAFE', 'REPOSITORY_NOT_DEDICATED', 'REPOSITORY_MARKER'].includes(code) ? 'unsafe' : code === 'REPOSITORY_UNINITIALISED' ? 'uninitialised' : code === 'REPOSITORY_UNAVAILABLE' ? 'unavailable' : code === 'PROFILE_MISMATCH' ? 'mismatch' : ['BINDING_EXPIRED', 'AUTHORISATION_CHANGED'].includes(code) ? 'expired' : code === 'REPOSITORY_CAPACITY' ? 'capacity' : ['GITHUB_PERMISSION', 'INSTALLATION_SCOPE', 'REPOSITORY_ACCESS', 'UNAUTHENTICATED'].includes(code) ? 'permission' : code === 'RATE_LIMITED' ? 'limited' : 'failed';
    setMessage(t[key]);
  }
  async function repositories() {
    const result = repositoryChoicesSchema.parse(await call('/api/sync/repositories'));
    setChoices(result.repositories);
    const choice = binding ? result.repositories.find(value => value.name === binding.name) : result.repositories.find(value => value.name === 'lingfern-data') ?? result.repositories[0];
    setSelected(String(choice?.repositoryId ?? ''));
    if (binding && !choice) setMessage(t.unavailable);
    if (result.installationUrl) setInstallationUrl(result.installationUrl);
    return result.repositories;
  }
  async function find() {
    setBusy(true); setMessage(''); setIntent(undefined);
    try { await repositories(); } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setMessage(''); setIntent(undefined);
    try {
      const choice = choices?.find(value => String(value.repositoryId) === selected);
      if (!choice) throw new Error('REPOSITORY_UNAVAILABLE');
      setIntent(bindingIntentSchema.parse(await call('/api/sync/inspect', { ...choice, profileId })));
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function bind() {
    if (!intent) return;
    setBusy(true); setMessage('');
    let resume: (() => Promise<unknown>) | undefined;
    try { resume = await pauseSyncConfiguration(localProfileId); const result = await call('/api/sync/bind', { intent: intent.intent, confirm: true }) as { binding: unknown }; repositoryBindingSchema.parse(result.binding); setIntent(undefined); await reload(); }
    catch (error) { setIntent(undefined); fail(error); } finally { await resume?.().catch(() => setMessage(t.failed)); setBusy(false); }
  }
  async function disconnect() {
    if (!confirm(t.disconnectConfirm)) return;
    setBusy(true); setMessage('');
    let resume: (() => Promise<unknown>) | undefined;
    try { resume = await pauseSyncConfiguration(localProfileId); await call('/api/sync/disconnect', { profileId, confirm: true }); setIntent(undefined); setMessage(t.disconnected); await reload(); }
    catch (error) { fail(error); } finally { await resume?.().catch(() => setMessage(t.failed)); setBusy(false); }
  }
  const connected = binding && !binding.disabled;
  const canInspect = choices?.some(choice => String(choice.repositoryId) === selected);
  const disconnectButton = <button className="service-danger" type="button" disabled={busy} onClick={() => void disconnect()}>{t.disconnect}</button>;
  const setup = <RepositorySetup locale={locale} installationUrl={installationUrl} busy={busy} onFind={() => void find()}/>;
  const configuration = <>{Boolean(choices?.length) && <SettingsPicker label={t.select} value={selected} disabled={busy} options={[...(!selected ? [{ value: '', label: t.select }] : []), ...choices!.map(value => ({ value: String(value.repositoryId), label: value.name }))]} onChange={value => { setSelected(value); setIntent(undefined); }}/>}{(canInspect || binding) && <div className="repository-actions">{canInspect && <button type="button" disabled={busy} onClick={() => void verify()}>{t.inspect}</button>}{binding && disconnectButton}</div>}
    {intent && <div className="backup-preview"><strong>{intent.owner}/{intent.name}</strong><p>{t.verified}</p><p>{intent.existing ? t.existing : t.marker}</p><p className="muted">{t.boundary}</p><div className="backup-actions"><button type="button" disabled={busy} onClick={() => setIntent(undefined)}>{t.cancel}</button><button type="button" disabled={busy} onClick={() => void bind()}>{t.confirm}</button></div></div>}</>;
  const setupPanel = <>{binding && <h4>{t.reset}</h4>}<p className="muted">{syncLabels[locale].detail}</p>{setup}{configuration}{choices?.length === 0 && <p role="status">{t.empty}</p>}</>;
  return <section className="repository-binding"><h3 className="sr-only">{t.title}</h3>
    {connected ? <>
      <details className="repository-reset service-disclosure" onToggle={() => setIntent(undefined)}>
        <summary aria-controls={`${id}-setup`}><span>{t.title}</span><bdi>{binding.owner}/{binding.name}</bdi></summary>
        <div id={`${id}-setup`}>{setupPanel}</div>
      </details>
      {!summary.syncAvailable && <p className="muted" role="status">{t.pending}</p>}
    </> : <>
      {binding && <p className="muted" role="status"><bdi>{binding.owner}/{binding.name}</bdi> · {t.disabled}</p>}
      <div className="repository-configuration">{setupPanel}</div>
    </>}
    {(busy || message) && <p role="status">{busy ? t.busy : message}</p>}
  </section>;
}
