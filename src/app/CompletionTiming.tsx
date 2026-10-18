import { messages } from '../locales';
import { useState } from 'react';
import { confirmCompletionTime, type CompletionTime } from '../data/completionTiming';
import type { Locale } from '../shared/content';

const labels = messages('completionTiming');

export function CompletionTiming({ locale, profileId, rows, onChange }: { locale: Locale; profileId: string; rows: CompletionTime[]; onChange: () => Promise<void> }) {
  const t = labels[locale];
  const [drafts, setDrafts] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  if (!rows.length) return null;
  const localTime = (time: string) => { const date = new Date(time); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 23); };
  async function confirm(row: CompletionTime) {
    setBusy(true); setFailed(false);
    try { await confirmCompletionTime(profileId, row.id, row.hash, new Date(drafts[row.id] ?? localTime(row.time)).toISOString()); await onChange(); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <details className="review-timing completion-timing"><summary>{t.title}</summary><p className="muted">{t.detail}</p>{rows.map(row => <div key={row.id}><p className="muted">{row.deviceId} / {row.recordId}<br/>{t.original}: <time>{row.originalTime}</time></p>{row.invalid && <p className="error" role="status">{t.invalid}</p>}<label>{t.time}<input type="datetime-local" step="0.001" disabled={busy} value={drafts[row.id] ?? localTime(row.time)} onChange={event => setDrafts(current => ({ ...current, [row.id]: event.target.value }))}/></label><button type="button" disabled={busy} onClick={() => void confirm(row)}>{t.confirm}</button></div>)}{failed && <p className="error" role="status">{t.failed}</p>}</details>;
}
