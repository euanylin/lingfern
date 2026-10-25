import { lookupDictionarySense } from '../shared/dictionary';
import { projectSyncEvents, type SyncEvent } from '../shared/sync';
import { appendSyncEvent, readSyncEvents } from './sync';
import { db, memories, syncEvents, syncClocks, type Memory } from './db';

export async function saveSense(profileId: string, memoryId: string, term: string, definition: string) {
  if (!memoryId || !term || !definition) throw new Error('MEMORY_INVALID');
  await projectMemories(profileId);
  await db.transaction('rw', memories, syncEvents, syncClocks, async () => {
    if (!await memories.get([profileId, memoryId])) {
      await memories.add({ profileId, memoryId, term, definition, savedAt: new Date().toISOString() });
      await appendSyncEvent(profileId, { type: 'saved_item', payload: { memoryId, saved: true } });
    }
  });
}

export async function removeSense(profileId: string, memoryId: string) {
  await projectMemories(profileId);
  await db.transaction('rw', memories, syncEvents, syncClocks, async () => {
    if (!await memories.get([profileId, memoryId]) && !projectSyncEvents(await readSyncEvents(profileId, db, ['saved_item'])).savedItems.get(memoryId)?.payload.saved) return;
    await memories.delete([profileId, memoryId]);
    await appendSyncEvent(profileId, { type: 'saved_item', payload: { memoryId, saved: false } });
  });
}

export type MemoryProblem = { memoryId: string; code: 'DICTIONARY_UNAVAILABLE' };

// Resolve public definitions outside IndexedDB without rewriting events.
export async function projectMemories(profileId: string) {
  const snapshot = await db.transaction('r', memories, syncEvents, async () => ({
    items: await memories.where('profileId').equals(profileId).toArray(),
    events: await readSyncEvents(profileId, db, ['saved_item']),
  }));
  type SavedEvent = Extract<SyncEvent, { type: 'saved_item' }>;
  const changes = new Map<string, { latest: SavedEvent; first?: SavedEvent; reset: boolean }>();
  // Events are ordered by their logical clock; keep the current saved cycle in one pass.
  for (const event of snapshot.events) if (event.type === 'saved_item') {
    const prior = changes.get(event.payload.memoryId);
    changes.set(event.payload.memoryId, {
      latest: event,
      first: event.payload.saved ? prior?.first ?? event : undefined,
      reset: !event.payload.saved || !!prior?.reset,
    });
  }
  const items = new Map<string, Memory>(snapshot.items.map(item => [item.memoryId, item]));
  const problems: MemoryProblem[] = [];
  for (const [memoryId, { latest, first, reset }] of changes) {
    if (!latest.payload.saved) { items.delete(memoryId); continue; }
    const firstSavedAt = first!.occurredAt;
    let item = items.get(memoryId);
    if (!item) {
      let meaning;
      try { meaning = await lookupDictionarySense(memoryId); } catch { /* Keep received IDs pending until their dictionary is available. */ }
      if (!meaning) { problems.push({ memoryId, code: 'DICTIONARY_UNAVAILABLE' }); continue; }
      item = { profileId, memoryId, ...meaning, savedAt: firstSavedAt };
    }
    const savedAt = reset ? firstSavedAt : item.savedAt < firstSavedAt ? item.savedAt : firstSavedAt;
    items.set(memoryId, { ...item, savedAt });
  }
  await db.transaction('rw', memories, syncEvents, syncClocks, async () => {
    if ((await syncClocks.get(profileId))?.deleted) throw new Error('PROFILE_DELETED');
    const current = { items: await memories.where('profileId').equals(profileId).toArray(), events: await readSyncEvents(profileId, db, ['saved_item']) };
    // shortcut: compare profile snapshots; use revision tokens if large queues slow projection.
    const alreadyProjected = current.items.length === items.size && current.items.every(item => JSON.stringify(item) === JSON.stringify(items.get(item.memoryId)));
    if (JSON.stringify(current.events) !== JSON.stringify(snapshot.events) || JSON.stringify(current.items) !== JSON.stringify(snapshot.items) && !alreadyProjected) throw new Error('SYNC_LOCAL_CHANGED');
    const currentItems = new Map(current.items.map(item => [item.memoryId, item]));
    for (const [memoryId, { latest }] of changes) {
      if (!latest.payload.saved) {
        if (currentItems.has(memoryId)) await memories.delete([profileId, memoryId]);
      } else if (items.has(memoryId) && JSON.stringify(currentItems.get(memoryId)) !== JSON.stringify(items.get(memoryId))) await memories.put(items.get(memoryId)!);
    }
  });
  return { items: [...items.values()], problems };
}
