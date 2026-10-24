import { messages } from '../locales';
import { useEffect, useState, type ReactNode } from 'react';
import { accountProfiles, copyProfileForAccount, readSyncAccount, switchAccountProfile } from '../data/syncAccount';
import type { SessionSummary } from '../shared/auth';
import type { Locale } from '../shared/content';
import { SettingsPicker } from './SettingsPicker';

const labels = messages('syncAccountChoice');

export function SyncAccountChoice({ locale, localProfileId, profileId, summary, onProfileChange, children }: { locale: Locale; localProfileId: string; profileId: string; summary: SessionSummary; onProfileChange: () => Promise<void>; children: ReactNode }) {
  const t = labels[locale], account = summary.account!;
  const [matched, setMatched] = useState(false), [ready, setReady] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [choices, setChoices] = useState<{ value: string; label: string; profileId: string; localProfileId?: string }[]>([]), [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setReady(false); setReadFailed(false); setMessage('');
    void Promise.all([readSyncAccount(localProfileId), accountProfiles(account.id)]).then(([association, items]) => {
      if (!alive) return;
      const options: typeof choices = items.map(item => ({ value: `local:${item.id}`, localProfileId: item.id, profileId: item.logicalProfileId, label: item.nameIsCustom ? item.name : item.name.replace('Local profile', messages('profileBackup')[locale].local) }));
      for (const binding of summary.bindings ?? []) if (!options.some(option => option.profileId === binding.profileId)) options.push({ value: `remote:${binding.profileId}`, profileId: binding.profileId, label: `${binding.owner}/${binding.name}` });
      setChoices(options); setTarget(current => options.some(option => option.value === current) ? current : options[0]?.value ?? '');
      setMatched(association?.accountId === account.id && association.profileId === profileId); setReady(true);
    }).catch(() => { if (alive) { setReadFailed(true); setReady(true); } });
    return () => { alive = false; };
  }, [localProfileId, profileId, account.id, summary.bindings, reload, locale, t.failed]);
  async function choose(copy: boolean) {
    if (!ready || readFailed || busy) return;
    setBusy(true); setMessage('');
    try {
      if (copy) await copyProfileForAccount(localProfileId, account.id);
      else { const selected = choices.find(choice => choice.value === target); await switchAccountProfile(account, selected?.profileId, selected?.localProfileId); }
      await onProfileChange();
    } catch { setMessage(t.failed); }
    finally { setBusy(false); }
  }
  if (readFailed) return <section className="sync-account-choice"><h3>{t.title}</h3><p role="status">{t.failed}</p><button type="button" onClick={() => setReload(value => value + 1)}>{t.retry}</button></section>;
  if (!ready && !matched) return <p role="status">{t.loading}</p>;
  if (matched) return <>{children}</>;
  return <section className="sync-account-choice"><h3>{t.title}</h3><p>{t.choose}</p>
    {choices.length > 1 && <SettingsPicker label={t.target} value={target} disabled={busy} options={choices} onChange={setTarget}/>}
    {choices.length === 1 && <p className="muted">{t.target}: {choices[0].label}</p>}
    <div className="backup-actions"><button type="button" disabled={busy} onClick={() => setMessage(t.kept)}>{t.keep}</button><button type="button" disabled={busy} onClick={() => void choose(false)}>{t.switch}</button><button type="button" disabled={busy} onClick={() => void choose(true)}>{t.copy}</button></div>
    <p className="muted">{t.copyNote}</p>
    {(busy || message) && <p role="status">{busy ? t.busy : message}</p>}
    {message === t.failed && <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>{t.retry}</button>}
  </section>;
}
