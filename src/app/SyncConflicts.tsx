import { messages } from '../locales';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../data/db';
import { syncConflictReport, type StoredBatch } from '../data/sync';
import type { Locale } from '../shared/content';

const labels = messages('syncConflicts');

export function SyncConflicts({ profileId, locale }: { profileId: string; locale: Locale }) {
  const t = labels[locale];
  const [rows, setRows] = useState<Pick<StoredBatch, 'hash' | 'batchId' | 'deviceId'>[]>([]), [failed, setFailed] = useState(false);
  useEffect(() => {
    setRows([]); setFailed(false);
    const observer = liveQuery(async () => {
      const conflict = await db.table('syncConflicts').where('profileId').equals(profileId).toArray();
      const batches: StoredBatch[] = await db.table('syncBatches').where('[profileId+state]').equals([profileId, 'conflict']).toArray();
      return [...conflict.map(row => ({ hash: row.hash, batchId: row.batch.batchId, deviceId: row.batch.deviceId })), ...batches.map(({ hash, batchId, deviceId }) => ({ hash, batchId, deviceId }))];
    }).subscribe({ next: setRows, error() { setFailed(true); } });
    return () => observer.unsubscribe();
  }, [profileId]);
  async function download(hash: string) {
    setFailed(false);
    try {
      const report = await syncConflictReport(profileId, hash);
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `lingfern-conflict-${hash}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setFailed(true); }
  }
  if (!rows.length && !failed) return null;
  return <section className="sync-conflicts"><h3>{t.title}</h3><p className="muted">{t.detail}</p>{rows.map(row => <div key={row.hash}><p className="muted">{row.deviceId} / {row.batchId}</p><button type="button" onClick={() => void download(row.hash)}>{t.export}</button></div>)}{failed && <p className="error" role="status">{t.failed}</p>}</section>;
}
