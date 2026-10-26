import { showModal } from './modal';
import { messages } from '../locales';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { liveQuery } from 'dexie';
import type { Locale } from '../shared/content';
import type { BackupInspection } from '../data/backup';
import { db, profiles, settings, type Profile } from '../data/db';
import { SettingsPicker } from './SettingsPicker';

const labels = messages('profileBackup');

export function ProfileBackup({ locale, activeProfile, onProfileChange }: { locale: Locale; activeProfile: string; onProfileChange: () => Promise<void> }) {
  const t = labels[locale];
  const segmenter = locale === 'zh-Hans' || locale === 'zh-Hant' ? new Intl.Segmenter(locale, { granularity: 'word' }) : undefined;
  const wrapWords = (text: string) => segmenter ? <span className="backup-copy">{Array.from(segmenter.segment(text), part => part.isWordLike ? <span className="backup-word" key={part.index}>{part.segment}</span> : part.segment)}</span> : text;
  const [items, setItems] = useState<Profile[]>([]);
  const [inspection, setInspection] = useState<BackupInspection>();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState<Profile>();
  const [deleteError, setDeleteError] = useState('');
  const [exporting, setExporting] = useState<string>();
  const [exportName, setExportName] = useState('');
  const [exportError, setExportError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), removeButton = useRef<HTMLButtonElement>(null);
  const exportDialog = useRef<HTMLDialogElement>(null), exportCancel = useRef<HTMLButtonElement>(null), downloadButton = useRef<HTMLButtonElement>(null);
  const revision = useRef(0);
  const name = (value: string, isCustom?: true) => isCustom ? value : value.replace('Local profile', t.local);
  useEffect(() => {
    const observer = liveQuery(() => profiles.toArray()).subscribe({ next: setItems, error: () => setMessage(t.failed) });
    return () => observer.unsubscribe();
  }, [t.failed]);
  useEffect(() => { if (confirming) { showModal(dialog.current); cancel.current?.focus(); } }, [confirming]);
  // React autoFocus runs before showModal; the native attribute controls its initial focus.
  useEffect(() => { if (exporting) { exportCancel.current?.setAttribute('autofocus', ''); showModal(exportDialog.current); } }, [exporting]);
  useEffect(() => { revision.current++; dialog.current?.close(); setConfirming(undefined); setDeleteError(''); exportDialog.current?.close(); setExporting(undefined); setInspection(undefined); setFileName(''); setBusy(false); }, [activeProfile]);
  useEffect(() => () => { revision.current++; }, []);
  function closeExport() { if (busy) return; exportDialog.current?.close(); setExporting(undefined); downloadButton.current?.focus(); }
  function startExport() {
    if (busy) return;
    const now = new Date();
    const timestamp = `lingfern-${[now.getFullYear(), now.getMonth() + 1, now.getDate()].map(part => String(part).padStart(2, '0')).join('-')}`;
    setExporting(timestamp); setExportName(''); setExportError(''); setMessage('');
  }
  function closeDelete() { if (busy) return; dialog.current?.close(); setConfirming(undefined); setDeleteError(''); removeButton.current?.focus(); }
  async function remove() {
    if (!confirming || busy) return;
    const current = revision.current;
    setBusy(true); setDeleteError('');
    try {
      const { deleteLocalProfile } = await import('../data/deletion');
      await deleteLocalProfile(confirming.id, confirming.name);
      dialog.current?.close(); setConfirming(undefined); setInspection(undefined); setFileName('');
      await onProfileChange(); setMessage(t.deleted);
    } catch (error) { if (current === revision.current) setDeleteError(error instanceof Error && error.message === 'BUSY' ? t.deleteBusy : t.failed); }
    finally { if (current === revision.current) setBusy(false); requestAnimationFrame(() => removeButton.current?.focus()); }
  }
  async function download() {
    if (!exporting || busy) return;
    const current = revision.current;
    const filename = (exportName.trim() || exporting).replace(/\.zip$/i, '');
    if (!filename || /[<>:"/\\|?*]/.test(filename) || /[. ]$/.test(filename) || Array.from(filename).some(character => character.charCodeAt(0) < 32)) { setExportError(t.invalidName); return; }
    setBusy(true); setMessage('');
    try {
      const { exportBackup } = await import('../data/backup');
      const bytes = await exportBackup(activeProfile, filename);
      if (current !== revision.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      exportDialog.current?.close(); setExporting(undefined); requestAnimationFrame(() => downloadButton.current?.focus());
    } catch { if (current === revision.current) setExportError(t.failed); } finally { if (current === revision.current) setBusy(false); }
  }
  async function choose(file?: File) {
    if (!file || busy) return;
    const current = revision.current;
    setFileName(file.name);
    setInspection(undefined); setMessage('');
    if (file.size > 32 * 1024 * 1024) { setMessage(t.bad); return; }
    setBusy(true);
    try { const { inspectBackup } = await import('../data/backup'); const checked = await inspectBackup(new Uint8Array(await file.arrayBuffer())); if (current === revision.current) setInspection(checked); }
    catch { if (current === revision.current) setMessage(t.bad); }
    finally { if (current === revision.current) setBusy(false); }
  }
  async function restore() {
    if (!inspection || busy) return;
    const current = revision.current;
    setBusy(true); setMessage('');
    try {
      const { importBackup } = await import('../data/backup');
      const id = await importBackup(inspection, undefined, activeProfile);
      setInspection(undefined); setFileName(''); await onProfileChange();
      if ((await settings.get('activeProfile'))?.value === id) setMessage(t.done);
    } catch { if (current === revision.current) setMessage(t.failed); }
    finally { if (current === revision.current) setBusy(false); }
  }
  async function switchProfile(id: string) {
    if (id === activeProfile || busy) return;
    const current = revision.current;
    setBusy(true); setMessage('');
    try {
      await db.transaction('rw', profiles, settings, async () => {
        if (!await profiles.get(id) || (await settings.get('activeProfile'))?.value !== activeProfile) throw new Error('SYNC_SCOPE_CHANGED');
        await settings.put({ key: 'activeProfile', value: id });
      });
      await onProfileChange();
    } catch { if (current === revision.current) setMessage(t.failed); }
    finally { if (current === revision.current) setBusy(false); }
  }
  return <section className="profile-backup"><h2>{t.title}</h2>
    <p className="muted">{wrapWords(t.shortNote)}</p>
    <div className="backup-profile-row">
    <SettingsPicker label={t.profile} value={activeProfile} disabled={busy} options={items.map(profile => ({ value: profile.id, label: name(profile.name, profile.nameIsCustom) }))} onChange={value => void switchProfile(value)}/>
    </div>
    <div className="backup-actions offline-actions"><button ref={downloadButton} className="primary backup-download" type="button" disabled={busy} onClick={startExport}>{wrapWords(busy ? t.busy : t.export)}</button>
    <label className="backup-file-label"><input className="sr-only" type="file" accept=".zip,application/zip" aria-label={t.choose} disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ''; }}/><span className="button backup-file-button">{wrapWords(t.choose)}</span></label>
    <button ref={removeButton} className="offline-remove" type="button" disabled={busy || !items.some(profile => profile.id === activeProfile)} onClick={() => { setDeleteError(''); setConfirming(items.find(profile => profile.id === activeProfile)); }}>{wrapWords(t.delete)}</button></div>
    {fileName && <p className="backup-file-name">{fileName}</p>}
    {exporting && createPortal(<dialog ref={exportDialog} className="offline-remove-dialog backup-export-dialog" aria-labelledby="backup-export-title" onCancel={event => { event.preventDefault(); closeExport(); }} onClick={event => { if (event.target === event.currentTarget) closeExport(); }}><form onSubmit={event => { event.preventDefault(); void download(); }}><h2 id="backup-export-title">{t.exportTitle}</h2><label className="backup-export-label" htmlFor="backup-export-name">{t.fileName}</label><div className="backup-export-field"><input id="backup-export-name" dir="auto" autoComplete="off" maxLength={80} disabled={busy} value={exportName} placeholder={exporting} data-default={!exportName.trim()} aria-describedby="backup-export-extension" aria-invalid={!!exportError} onChange={event => { setExportName(event.target.value); setExportError(''); }}/><span id="backup-export-extension" className="muted" dir="ltr">.zip</span></div>{exportError && <p className="error" role="alert">{exportError}</p>}<div className="offline-remove-dialog-actions"><button ref={exportCancel} type="button" disabled={busy} onClick={closeExport}>{t.cancel}</button><button className="primary" type="submit" disabled={busy}>{busy ? t.busy : t.save}</button></div></form></dialog>, document.body)}
    {confirming && createPortal(<dialog role="alertdialog" ref={dialog} className="offline-remove-dialog profile-delete-dialog" aria-labelledby="profile-delete-title" aria-describedby="profile-delete-detail" onCancel={event => { event.preventDefault(); closeDelete(); }} onClick={event => { if (event.target === event.currentTarget) closeDelete(); }}><h2 id="profile-delete-title">{t.deleteTitle}</h2><p className="backup-file-name"><bdi>{name(confirming.name, confirming.nameIsCustom)}</bdi></p><p id="profile-delete-detail" className="muted">{t.deleteDetail}</p>{deleteError && <p className="error" role="alert">{deleteError}</p>}<div className="offline-remove-dialog-actions"><button ref={cancel} type="button" disabled={busy} onClick={closeDelete}>{t.cancel}</button><button className="offline-remove-confirm" type="button" disabled={busy} onClick={() => void remove()}>{wrapWords(t.delete)}</button></div></dialog>, document.body)}
    {inspection && <div className="backup-preview"><strong>{t.preview}：{name(inspection.summary.profileName, inspection.summary.nameIsCustom)}</strong><p>{t.sessions} {inspection.summary.sessions} · {t.attempts} {inspection.summary.attempts} · {t.exposures} {inspection.summary.exposures} · {t.memories} {inspection.summary.memories} · {t.feedback} {inspection.summary.feedbackNotes} · {t.size} {(inspection.summary.bytes / 1024).toFixed(1)} KB</p><p className="muted">{t.note}</p><button type="button" disabled={busy} onClick={() => void restore()}>{t.import}</button></div>}
    {message && <p role="status" className={message === t.done || message === t.deleted ? 'muted' : 'error'}>{message}</p>}
  </section>;
}
