import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { messages } from '../locales';
import type { Locale } from '../shared/content';
import { deletionCopy } from './DeleteRecord';
import { closeModal, showModal } from './modal';

export function DeleteHistory({ locale, title, linked = false, onDelete, onChange }: { locale: Locale; title: string; linked?: boolean; onDelete: () => Promise<void>; onChange?: () => Promise<void> }) {
  const t = messages('historyDeletion')[locale], common = deletionCopy[locale];
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLButtonElement>(null), pending = useRef(false);
  const headingId = useId();
  useEffect(() => { if (confirming) { showModal(dialog.current); cancel.current?.focus(); } }, [confirming]);
  function close() {
    if (pending.current) return;
    closeModal(dialog.current, () => { setConfirming(false); setError(''); trigger.current?.focus(); });
  }
  async function remove() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    let deleted = false;
    try {
      await onDelete(); deleted = true;
      await onChange?.();
      closeModal(dialog.current, () => { setConfirming(false); document.getElementById('main')?.focus(); });
    } catch { setError(deleted ? common.refresh : common.failed); }
    finally { pending.current = false; setBusy(false); }
  }
  return <><button type="button" className="history-delete" ref={trigger} aria-label={`${t.remove}: ${title}`} onClick={() => setConfirming(true)}>{t.remove}</button>
    {confirming && createPortal(<dialog ref={dialog} className="practice-restart-dialog" aria-labelledby={headingId} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <h2 id={headingId}>{common.confirm}</h2><p lang="en" dir="ltr">{title}</p>{linked && <p>{t.linked}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="practice-restart-actions"><button type="button" ref={cancel} disabled={busy} onClick={close}>{common.cancel}</button><button type="button" className="offline-remove-confirm" disabled={busy} onClick={() => void remove()}>{common.confirm}</button></div>
    </dialog>, document.body)}
  </>;
}
