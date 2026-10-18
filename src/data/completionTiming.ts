import { canonicalJson, compareSyncEvents, eventHash, projectSyncEvents, type SyncEvent } from '../shared/sync';
import { db, settings, syncEvents, syncClocks } from './db';
import { appendSyncEvent, readSyncEvents } from './sync';

export type CompletionTime = { id: string; recordId: string; deviceId: string; originalTime: string; time: string; hash: string; invalid: boolean };

export async function completionTiming(events: SyncEvent[], now = Date.now()) {
  const sources = projectSyncEvents(events).completions;
  const latest = new Map<string, Extract<SyncEvent, { type: 'completion_timing' }>>();
  for (const event of [...events].sort(compareSyncEvents)) if (event.type === 'completion_timing') latest.set(event.payload.sourceId, event);
  const times = new Map<string, string>(), invalidRecords = new Set<string>(), rows: CompletionTime[] = [];
  for (const source of sources) {
    const confirmation = latest.get(source.id);
    if (!confirmation && Date.parse(source.occurredAt) <= now + 5 * 60_000) continue;
    const hash = await eventHash(source);
    const invalid = !!confirmation && (confirmation.payload.sourceHash !== hash || Date.parse(confirmation.payload.time) < 0);
    if (invalid) invalidRecords.add(source.payload.recordId);
    else if (confirmation) times.set(source.id, confirmation.payload.time);
    if (confirmation || Date.parse(source.occurredAt) > now + 5 * 60_000) rows.push({ id: source.id, recordId: source.payload.recordId, deviceId: source.deviceId, originalTime: source.occurredAt, time: times.get(source.id) ?? source.occurredAt, hash, invalid });
  }
  const recordTimes = new Map<string, string>();
  for (const source of sources) {
    const time = times.get(source.id);
    if (!time) continue;
    const previous = recordTimes.get(source.payload.recordId);
    if (previous && previous !== time) invalidRecords.add(source.payload.recordId);
    recordTimes.set(source.payload.recordId, time);
  }
  for (const row of rows) if (invalidRecords.has(row.recordId)) row.invalid = true;
  return { times, recordTimes, invalidRecords, rows };
}

export async function confirmCompletionTime(profileId: string, sourceId: string, sourceHash: string, time: string) {
  if (!Number.isFinite(Date.parse(time)) || new Date(time).toISOString() !== time || Date.parse(time) < 0 || Date.parse(time) > Date.now() + 5 * 60_000) throw new Error('COMPLETION_CLOCK');
  const events = await readSyncEvents(profileId), source = events.find(event => event.id === sourceId);
  if (!source || source.type !== 'completion' || await eventHash(source) !== sourceHash || projectSyncEvents(events).deletedRecords.has(source.payload.recordId)) throw new Error('COMPLETION_INVALID');
  await db.transaction('rw', settings, syncEvents, syncClocks, async () => {
    const active = await settings.get('activeProfile');
    if (active && active.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
    if (canonicalJson(await readSyncEvents(profileId)) !== canonicalJson(events)) throw new Error('SYNC_LOCAL_CHANGED');
    await appendSyncEvent(profileId, { type: 'completion_timing', payload: { sourceId, sourceHash, time } });
  });
}
