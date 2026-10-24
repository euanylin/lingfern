import type Dexie from 'dexie';
import { db } from './db';
import { profileIdSchema } from '../shared/repository';
import { lookupHistorySchema, lookupRecordSchema, type LookupRecord as Lookup } from '../shared/lookupHistory';
import { canonicalJson, projectLookupHistory, type SyncEvent } from '../shared/sync';
import { appendSyncEvent, readSyncEvents } from './sync';

export type LookupRecord = Lookup & { id: string };
const types: SyncEvent['type'][] = ['lookup', 'lookup_remove', 'lookup_clear'];
const key = (profileId: string) => `profile:${profileIdSchema.parse(profileId)}:lookupHistory`;

// Backfill changed legacy arrays once without re-creating already deleted events.
export async function migrateLookupHistory(profileId: string, database: Dexie = db) {
  profileIdSchema.parse(profileId);
  await database.transaction('rw', ['settings', 'syncEvents', 'syncClocks'], async () => {
    const settings = database.table('settings'), row = await settings.get(key(profileId));
    if (!row) return;
    if (row.value.length > 65536) throw new Error('LOOKUP_HISTORY_INVALID');
    const history = lookupHistorySchema.parse(JSON.parse(row.value));
    const marker = `profile:${profileId}:lookupHistorySync`;
    if ((await settings.get(marker))?.value === row.value) return;
    const events = await readSyncEvents(profileId, database, types);
    const known = new Set(events.filter(event => event.type === 'lookup').map(event => canonicalJson(event.payload)));
    for (const record of history.reverse()) if (!known.has(canonicalJson(record))) {
      await appendSyncEvent(profileId, { type: 'lookup', payload: record }, database, { occurredAt: record.lookedUpAt });
      known.add(canonicalJson(record));
    }
    await settings.put({ key: marker, value: row.value });
  });
}

export async function readLookupHistory(profileId: string, database: Dexie = db): Promise<LookupRecord[]> {
  profileIdSchema.parse(profileId);
  return projectLookupHistory(await readSyncEvents(profileId, database, types));
}

export async function recordLookup(profileId: string, kind: Lookup['kind'], term: string, database: Dexie = db) {
  const record = lookupRecordSchema.parse({ kind, term: term.normalize('NFKC').trim().replace(/\s+/g, ' '), lookedUpAt: new Date().toISOString() });
  await migrateLookupHistory(profileId, database);
  await appendSyncEvent(profileId, { type: 'lookup', payload: record }, database);
}

function observedLookups(events: SyncEvent[]) {
  const seen = new Map<string, number>();
  for (const event of events) if (event.type === 'lookup') seen.set(event.deviceId, Math.max(seen.get(event.deviceId) ?? 0, event.counter));
  return Object.fromEntries(seen);
}

export async function removeLookup(profileId: string, recordId: string, database: Dexie = db) {
  await migrateLookupHistory(profileId, database);
  await database.transaction('rw', ['syncEvents', 'syncClocks'], async () => {
    const events = await readSyncEvents(profileId, database, types);
    const record = projectLookupHistory(events).find(record => record.id === recordId);
    if (record) await appendSyncEvent(profileId, { type: 'lookup_remove', payload: { kind: record.kind, term: record.term, seen: observedLookups(events) } }, database);
  });
}

export async function clearLookupHistory(profileId: string, database: Dexie = db) {
  await migrateLookupHistory(profileId, database);
  await database.transaction('rw', ['syncEvents', 'syncClocks'], async () => {
    const events = await readSyncEvents(profileId, database, types);
    if (projectLookupHistory(events).length) await appendSyncEvent(profileId, { type: 'lookup_clear', payload: { seen: observedLookups(events) } }, database);
  });
}

export function lookupHistoryUrl(record: Lookup) {
  const { kind, term } = lookupRecordSchema.parse({ kind: record.kind, term: record.term, lookedUpAt: record.lookedUpAt });
  return `/library/${kind}?q=${encodeURIComponent(term)}`;
}
