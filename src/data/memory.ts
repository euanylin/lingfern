import Dexie from 'dexie';
import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';
import { lookupDictionarySense } from '../shared/dictionary';
import { canonicalJson, eventHash, compareSyncEvents, projectSyncEvents, type SyncEvent } from '../shared/sync';
import { appendSyncEvent, readSyncEvents } from './sync';
import { db, memories, memoryReviews, syncEvents, syncClocks, settings, type MemoryReview, type Memory } from './db';


export async function reviewTimes(memoryId: string, events: SyncEvent[]) {
  const times = new Map<string, string>();
  const sources = new Map(events.map(event => [event.id, event]));
  const latest = new Map<string, Extract<SyncEvent, { type: 'review_timing' }>>();
  for (const event of [...events].sort(compareSyncEvents)) if (event.type === 'review_timing' && event.payload.memoryId === memoryId) latest.set(event.payload.sourceId, event);
  for (const event of latest.values()) {
    const source = sources.get(event.payload.sourceId);
    if (Date.parse(event.payload.time) < 0 || !source || (source.type !== 'memory_review' && source.type !== 'saved_item') || source.payload.memoryId !== memoryId || (source.type === 'saved_item' && !source.payload.saved) || await eventHash(source) !== event.payload.sourceHash) throw new Error('REVIEW_TIMING_INVALID');
    times.set(source.id, event.payload.time);
  }
  return times;
}

export async function reviewTimeline(profileId: string, memoryId: string) {
  const events = await readSyncEvents(profileId);
  let times = new Map<string, string>();
  try { times = await reviewTimes(memoryId, events); } catch (error) { if (!(error instanceof Error) || error.message !== 'REVIEW_TIMING_INVALID') throw error; }
  return Promise.all(events.filter(event => (event.type === 'memory_review' || event.type === 'saved_item' && event.payload.saved) && event.payload.memoryId === memoryId).map(async event => ({ id: event.id, type: event.type, originalTime: event.occurredAt, time: times.get(event.id) ?? event.occurredAt, hash: await eventHash(event), deviceId: event.deviceId })));
}

export async function confirmReviewTime(profileId: string, memoryId: string, sourceId: string, sourceHash: string, time: string) {
  if (!Number.isFinite(Date.parse(time)) || new Date(time).toISOString() !== time || Date.parse(time) > Date.now() + 5 * 60_000 || Date.parse(time) < 0) throw new Error('REVIEW_CLOCK');
  const events = await readSyncEvents(profileId), source = events.find(event => event.id === sourceId);
  if (!source || (source.type !== 'memory_review' && source.type !== 'saved_item') || source.payload.memoryId !== memoryId || (source.type === 'saved_item' && !source.payload.saved) || await eventHash(source) !== sourceHash) throw new Error('REVIEW_INVALID');
  await db.transaction('rw', settings, syncEvents, syncClocks, async () => {
    const active = await settings.get('activeProfile');
    if (active && active.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
    if (JSON.stringify(await readSyncEvents(profileId)) !== JSON.stringify(events)) throw new Error('SYNC_LOCAL_CHANGED');
    await appendSyncEvent(profileId, { type: 'review_timing', payload: { memoryId, sourceId, sourceHash, time } });
  });
}

export const memoryConfigId = 'ts-fsrs-5.4.2-retention-0.90-fuzz-off';
const scheduler = fsrs({ request_retention: 0.90, enable_fuzz: false });

export function replayMemory(savedAt: string, events: MemoryReview[], counters = new Map<string, number>()): Card | undefined {
  if (!events.length) return undefined;
  const unique = new Map<string, MemoryReview>();
  for (const event of events) {
    const prior = unique.get(event.id);
    if (prior && canonicalJson(prior) !== canonicalJson(event)) throw new Error('REVIEW_CONFLICT');
    if (event.configId !== memoryConfigId || !Number.isFinite(Date.parse(event.occurredAt)) || ![1, 2, 3, 4].includes(event.rating)) throw new Error('REVIEW_INVALID');
    unique.set(event.id, event);
  }
  let card = createEmptyCard(new Date(savedAt));
  let previous = Date.parse(savedAt);
  for (const event of [...unique.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || (counters.get(a.id) ?? 0) - (counters.get(b.id) ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const time = Date.parse(event.occurredAt);
    if (time < previous) throw new Error('REVIEW_CLOCK');
    card = scheduler.next(card, new Date(time), event.rating as Grade).card;
    previous = time;
  }
  return card;
}

export async function saveSense(profileId: string, memoryId: string, term: string, definition: string) {
  if (!memoryId || !term || !definition) throw new Error('MEMORY_INVALID');
  await projectMemories(profileId);
  await db.transaction('rw', memories, syncEvents, syncClocks, async () => {
    if (!await memories.get([profileId, memoryId])) {
      await memories.add({ profileId, memoryId, term, definition, savedAt: new Date().toISOString(), reviewEnabled: false });
      await appendSyncEvent(profileId, { type: 'saved_item', payload: { memoryId, saved: true, reviewEnabled: false } });
    }
  });
}

export async function removeSense(profileId: string, memoryId: string) {
  await projectMemories(profileId);
  await db.transaction('rw', memories, memoryReviews, syncEvents, syncClocks, async () => {
    if (!await memories.get([profileId, memoryId]) && !projectSyncEvents(await readSyncEvents(profileId)).savedItems.get(memoryId)?.payload.saved) return;
    await memoryReviews.where('[profileId+memoryId]').equals([profileId, memoryId]).delete();
    await memories.delete([profileId, memoryId]);
    await appendSyncEvent(profileId, { type: 'saved_item', payload: { memoryId, saved: false, reviewEnabled: false } });
  });
}

export async function enableReview(profileId: string, memoryId: string) {
  await projectMemories(profileId);
  await db.transaction('rw', memories, syncEvents, syncClocks, async () => {
    const saved = await memories.get([profileId, memoryId]);
    if (!saved) throw new Error('MEMORY_MISSING');
    if (saved.reviewEnabled) return;
    await memories.update([profileId, memoryId], { reviewEnabled: true });
    await appendSyncEvent(profileId, { type: 'saved_item', payload: { memoryId, saved: true, reviewEnabled: true } });
  });
}

export async function rateMemory(profileId: string, memoryId: string, rating: 1 | 2 | 3 | 4, id: string = crypto.randomUUID(), occurredAt = new Date().toISOString()) {
  const projected = await projectMemories(profileId);
  const problem = projected.problems.find(item => item.memoryId === memoryId);
  if (problem) throw new Error(problem.code);
  return db.transaction('rw', memories, memoryReviews, syncEvents, syncClocks, async () => {
    if (JSON.stringify(await readSyncEvents(profileId)) !== projected.eventSignature) throw new Error('SYNC_LOCAL_CHANGED');
    const saved = await memories.get([profileId, memoryId]);
    if (!saved?.reviewEnabled) throw new Error('REVIEW_DISABLED');
    const existing = await memoryReviews.get([profileId, id]);
    if (existing) {
      if (existing.profileId !== profileId || existing.memoryId !== memoryId || existing.rating !== rating || existing.occurredAt !== occurredAt) throw new Error('REVIEW_CONFLICT');
      return saved;
    }
    if (Date.parse(occurredAt) > Date.now() + 5 * 60_000) throw new Error('REVIEW_CLOCK');
    const event: MemoryReview = { id, profileId, memoryId, occurredAt, rating, assistance: { answerRevealed: true, hintUsed: false }, configId: memoryConfigId };
    const prior = await memoryReviews.where('[profileId+memoryId]').equals([profileId, memoryId]).toArray();
    const counters = new Map((await readSyncEvents(profileId)).map(event => [event.id, event.counter]));
    counters.set(id, ((await syncClocks.get(profileId))?.counter ?? 0) + 1);
    const times = await Dexie.waitFor(reviewTimes(memoryId, await readSyncEvents(profileId)));
    const card = replayMemory(saved.savedAt, [...prior.map(row => ({ ...row, occurredAt: times.get(row.id) ?? row.occurredAt })), event], counters);
    await memoryReviews.add(event);
    await appendSyncEvent(profileId, { type: 'memory_review', payload: { memoryId, rating, assistance: event.assistance, configId: event.configId } }, db, { id: event.id, occurredAt: event.occurredAt });
    await memories.update([profileId, memoryId], { card });
    return { ...saved, card };
  });
}


export type MemoryProblem = { memoryId: string; code: 'DICTIONARY_UNAVAILABLE' | 'REVIEW_CLOCK' | 'REVIEW_INVALID' | 'REVIEW_CONFLICT' | 'REVIEW_ORDER' | 'REVIEW_TIMING_INVALID' };

export function memoryDue(item: Memory, now = Date.now()) {
  const saved = Date.parse(item.savedAt), due = item.card ? new Date(item.card.due).getTime() : saved;
  return item.reviewEnabled && Number.isFinite(saved) && saved >= 0 && saved <= now && Number.isFinite(due) && due >= saved && due <= now;
}

export async function dueMemories(profileId: string, now = Date.now()) {
  const projected = await projectMemories(profileId, now);
  const blocked = new Set(projected.problems.map(problem => problem.memoryId));
  return projected.items.filter(item => item.profileId === profileId && !blocked.has(item.memoryId) && memoryDue(item, now))
    .sort((a, b) => new Date(a.card?.due ?? a.savedAt).getTime() - new Date(b.card?.due ?? b.savedAt).getTime() || a.memoryId.localeCompare(b.memoryId));
}

// Resolve public definitions outside IndexedDB without rewriting events.
export async function projectMemories(profileId: string, now = Date.now()) {
  const snapshot = await db.transaction('r', memories, memoryReviews, syncEvents, async () => ({
    items: await memories.where('profileId').equals(profileId).toArray(),
    reviews: await memoryReviews.where('profileId').equals(profileId).toArray(),
    events: await readSyncEvents(profileId),
  }));
  const merged = projectSyncEvents(snapshot.events);
  const eventsByMemory = new Map<string, typeof snapshot.events>();
  for (const event of snapshot.events) if (event.type === 'saved_item' || event.type === 'memory_review') {
    const group = eventsByMemory.get(event.payload.memoryId) ?? [];
    group.push(event); eventsByMemory.set(event.payload.memoryId, group);
  }
  const items = new Map<string, Memory>(snapshot.items.map(item => [item.memoryId, item]));
  const problems: MemoryProblem[] = [];
  const originals: MemoryReview[] = [];
  const counters = new Map(snapshot.events.map(event => [event.id, event.counter]));
  for (const [memoryId, latest] of merged.savedItems) {
    if (!latest.payload.saved) { items.delete(memoryId); continue; }
    const changes = (eventsByMemory.get(memoryId) ?? []).filter(event => event.type === 'saved_item');
    const reset = changes.filter(event => event.type === 'saved_item' && !event.payload.saved).at(-1);
    const first = changes.find(event => event.type === 'saved_item' && event.payload.saved && (!reset || compareSyncEvents(event, reset) > 0))!;
    let item = items.get(memoryId);
    if (!item) {
      let meaning;
      try { meaning = await lookupDictionarySense(memoryId); } catch { /* Keep received IDs pending until their dictionary is available. */ }
      if (!meaning) { problems.push({ memoryId, code: 'DICTIONARY_UNAVAILABLE' }); continue; }
      item = { profileId, memoryId, ...meaning, savedAt: first.occurredAt, reviewEnabled: latest.payload.reviewEnabled };
    }
    let savedAt = reset ? first.occurredAt : item.savedAt < first.occurredAt ? item.savedAt : first.occurredAt;
    const events: MemoryReview[] = reset ? [] : snapshot.reviews.filter(event => event.memoryId === memoryId);
    const wire = (eventsByMemory.get(memoryId) ?? []).filter(event => event.type === 'memory_review').filter(event => !reset || compareSyncEvents(event, reset) > 0);
    for (const event of wire) events.push({ id: event.id, profileId, memoryId, occurredAt: event.occurredAt, rating: event.payload.rating, assistance: event.payload.assistance, configId: event.payload.configId });
    let card: Card | undefined;
    let problem: MemoryProblem['code'] | undefined;
    try {
      const times = await reviewTimes(memoryId, snapshot.events);
      if (times.has(first.id)) savedAt = times.get(first.id)!;
      const effective = events.map(event => ({ ...event, occurredAt: times.get(event.id) ?? event.occurredAt }));
      if (Date.parse(savedAt) > now + 5 * 60_000 || effective.some(event => Date.parse(event.occurredAt) > now + 5 * 60_000)) throw new Error('REVIEW_CLOCK');
      const devicesByTime = new Map<string, Set<string>>();
      for (const event of wire) {
        const time = times.get(event.id) ?? event.occurredAt;
        const devices = devicesByTime.get(time) ?? new Set<string>();
        devices.add(event.deviceId); devicesByTime.set(time, devices);
      }
      if ([...devicesByTime.values()].some(devices => devices.size > 1)) throw new Error('REVIEW_ORDER');
      card = replayMemory(savedAt, effective, counters);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (!['REVIEW_CLOCK', 'REVIEW_INVALID', 'REVIEW_CONFLICT', 'REVIEW_ORDER', 'REVIEW_TIMING_INVALID'].includes(code)) throw error;
      problem = code as MemoryProblem['code']; problems.push({ memoryId, code: problem });
    }
    // Quarantine invalid/colliding originals without replacing review rows.
    if (!problem) {
      const unique = new Map(events.map(event => [event.id, event]));
      originals.push(...unique.values());
    }
    items.set(memoryId, { ...item, savedAt: problem ? item.savedAt : savedAt, reviewEnabled: latest.payload.reviewEnabled, card: problem ? item.card : card });
  }
  await db.transaction('rw', memories, memoryReviews, syncEvents, syncClocks, async () => {
    if ((await syncClocks.get(profileId))?.deleted) throw new Error('PROFILE_DELETED');
    const current = { items: await memories.where('profileId').equals(profileId).toArray(), reviews: await memoryReviews.where('profileId').equals(profileId).toArray(), events: await readSyncEvents(profileId) };
    // shortcut: compare profile snapshots; use revision tokens if large queues slow projection.
    if (JSON.stringify(current) !== JSON.stringify(snapshot)) throw new Error('SYNC_LOCAL_CHANGED');
    for (const [memoryId, latest] of merged.savedItems) {
      if (!latest.payload.saved) {
        await memories.delete([profileId, memoryId]);
        await memoryReviews.where('[profileId+memoryId]').equals([profileId, memoryId]).delete();
      } else if (items.has(memoryId)) {
        await memories.put(items.get(memoryId)!);
        const reset = (eventsByMemory.get(memoryId) ?? []).filter(event => event.type === 'saved_item' && !event.payload.saved).at(-1);
        if (reset && !problems.some(problem => problem.memoryId === memoryId)) await memoryReviews.where('[profileId+memoryId]').equals([profileId, memoryId]).delete();
      }
    }
    for (const event of originals) {
      const prior = await memoryReviews.get([profileId, event.id]);
      if (prior && canonicalJson(prior) !== canonicalJson(event)) throw new Error('REVIEW_CONFLICT');
      await memoryReviews.put(event);
    }
  });
  return { items: [...items.values()], problems, eventSignature: JSON.stringify(snapshot.events) };
}
