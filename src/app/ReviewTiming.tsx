import { messages } from '../locales';
import { useEffect, useState } from 'react';
import { confirmReviewTime, reviewTimeline } from '../data/memory';
import type { Locale } from '../shared/content';

const labels = messages('reviewTiming');
const localTime = (time: string) => { const date = new Date(time); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 23); };

export function ReviewTiming({ locale, profileId, memoryId, onChange }: { locale: Locale; profileId: string; memoryId: string; onChange: () => Promise<void> }) {
  const t = labels[locale];
  const [rows, setRows] = useState<Awaited<ReturnType<typeof reviewTimeline>>>([]), [drafts, setDrafts] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; void reviewTimeline(profileId, memoryId).then(rows => { if (alive) { setRows(rows); setDrafts(Object.fromEntries(rows.map(row => [row.id, localTime(row.time)]))); } }).catch(() => { if (alive) setFailed(true); }); return () => { alive = false; }; }, [profileId, memoryId]);
  async function confirm(row: typeof rows[number]) {
    setBusy(true); setFailed(false);
    try { await confirmReviewTime(profileId, memoryId, row.id, row.hash, new Date(drafts[row.id]).toISOString()); await onChange(); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <details className="review-timing"><summary>{t.open}</summary><p className="muted">{t.detail}</p>{rows.map(row => <div key={row.id}><p className="muted">{row.deviceId} / {row.id}<br/>{t.original}: <time>{row.originalTime}</time></p><label>{t.time}<input type="datetime-local" step="0.001" value={drafts[row.id] ?? ''} disabled={busy} onChange={event => setDrafts(current => ({ ...current, [row.id]: event.target.value }))}/></label><button type="button" disabled={busy} onClick={() => void confirm(row)}>{t.confirm}</button></div>)}{failed && <p className="error" role="status">{t.failed}</p>}</details>;
}
