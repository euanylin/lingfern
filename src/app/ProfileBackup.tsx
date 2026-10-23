import { messages } from '../locales';
import { useEffect, useState } from 'react';
import type { Locale } from '../shared/content';
import type { BackupInspection } from '../data/backup';
import { profiles, settings, type Profile } from '../data/db';
import { SettingsPicker } from './SettingsPicker';

const labels = messages('profileBackup');

export function ProfileBackup({ locale, activeProfile, onProfileChange }: { locale: Locale; activeProfile: string; onProfileChange: () => Promise<void> }) {
  const t = labels[locale];
  const [items, setItems] = useState<Profile[]>([]);
  const [inspection, setInspection] = useState<BackupInspection>();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const name = (value: string) => value.replace('Local profile', t.local);
  useEffect(() => { void profiles.toArray().then(setItems).catch(() => setMessage(t.failed)); }, [activeProfile, t.failed]);
  async function download() {
    setBusy(true); setMessage('');
    try {
      const { exportBackup } = await import('../data/backup');
      const bytes = await exportBackup(activeProfile);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
      const a = document.createElement('a'); a.href = url; a.download = `lingfern-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch { setMessage(t.failed); } finally { setBusy(false); }
  }
  async function choose(file?: File) {
    setFileName(file?.name ?? '');
    setInspection(undefined); setMessage('');
    if (!file) return;
    if (file.size > 32 * 1024 * 1024) { setMessage(t.bad); return; }
    setBusy(true);
    try { const { inspectBackup } = await import('../data/backup'); setInspection(await inspectBackup(new Uint8Array(await file.arrayBuffer()))); }
    catch { setMessage(t.bad); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!inspection) return;
    setBusy(true); setMessage('');
    try {
      const { importBackup } = await import('../data/backup');
      await importBackup(inspection);
      setItems(await profiles.toArray()); setInspection(undefined); setFileName(''); await onProfileChange(); setMessage(t.done);
    } catch { setMessage(t.failed); }
    finally { setBusy(false); }
  }
  async function switchProfile(id: string) {
    if (id === activeProfile) return;
    setBusy(true); setMessage('');
    try { await settings.put({ key: 'activeProfile', value: id }); await onProfileChange(); }
    catch { setMessage(t.failed); }
    finally { setBusy(false); }
  }
  return <section className="profile-backup"><h2>{t.title}</h2>
    <p className="muted">{t.note}</p>
    <div className="backup-profile-row">
    <SettingsPicker label={t.profile} value={activeProfile} disabled={busy} options={items.map(profile => ({ value: profile.id, label: name(profile.name) }))} onChange={value => void switchProfile(value)}/>
    </div>
    <div className="backup-actions"><button className="primary backup-download" type="button" disabled={busy} onClick={() => void download()}>{busy ? t.busy : t.export}</button>
    <label className="backup-file-label"><input className="sr-only" type="file" accept=".zip,application/zip" aria-label={t.choose} disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ''; }}/><span className="button backup-file-button">{t.choose}</span>{fileName && <span className="backup-file-name">{fileName}</span>}</label></div>
    {inspection && <div className="backup-preview"><strong>{t.preview}：{name(inspection.summary.profileName)}</strong><p>{t.sessions} {inspection.summary.sessions} · {t.attempts} {inspection.summary.attempts} · {t.exposures} {inspection.summary.exposures} · {t.memories} {inspection.summary.memories} · {t.reviews} {inspection.summary.memoryReviews} · {t.feedback} {inspection.summary.feedbackNotes} · {t.size} {(inspection.summary.bytes / 1024).toFixed(1)} KB</p><button type="button" disabled={busy} onClick={() => void restore()}>{t.import}</button></div>}
    {message && <p role="status" className={message === t.done ? 'muted' : 'error'}>{message}</p>}
  </section>;
}
