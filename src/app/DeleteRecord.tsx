import { messages } from '../locales';
import { useState } from 'react';
import { deleteLearningRecord } from '../data/deletion';
import type { Locale } from '../shared/content';

export const deletionCopy = messages('deleteRecord_deletionCopy');

export function DeleteRecord({ locale, profileId, recordId, onChange }: { locale: Locale; profileId: string; recordId: string; onChange: () => Promise<void> }) {
  const t = deletionCopy[locale];
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [deleted, setDeleted] = useState(false), [removeExposure, setRemoveExposure] = useState(false);
  async function remove() {
    setBusy(true); setFailed(false);
    try { await deleteLearningRecord(profileId, recordId, removeExposure); setDeleted(true); setConfirm(false); await onChange(); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <div className="record-delete">{confirm ? <><p className="muted">{t.detail}</p><label className={`option${removeExposure ? ' selected' : ''}`}><input type="checkbox" disabled={busy} checked={removeExposure} onChange={event => setRemoveExposure(event.target.checked)}/><span>{t.exposure}</span></label><p className="muted">{t.effect}</p><div className="backup-actions"><button type="button" disabled={busy} onClick={() => void remove()}>{t.confirm}</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>{t.cancel}</button></div></> : <button type="button" onClick={() => setConfirm(true)}>{t.remove}</button>}{failed && <p role="status">{deleted ? t.refresh : t.failed}</p>}</div>;
}
