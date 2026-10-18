import { expect, it } from 'vitest';
import fc from 'fast-check';
import { canonicalJson, mergeSyncEvents, projectSyncEvents, validateSyncBatch, type SyncEvent } from '../src/shared/sync';

const time = '2026-09-30T00:00:00.000Z';
const saved = (id: string, counter: number, deviceId = 'a', enabled = true): Extract<SyncEvent, { type: 'saved_item' }> => ({ id, counter, deviceId, occurredAt: time, type: 'saved_item', payload: { memoryId: 'sense-1', saved: enabled, reviewEnabled: false } });
const batch = (events: unknown[]) => ({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'a', batchId: 'fixed-batch', events });

it('hashes canonical UTF-8 identically across object key order and rejects private fields', async () => {
  const value = batch([saved('e', 1)]);
  const reordered = Object.fromEntries(Object.entries(value).reverse());
  expect((await validateSyncBatch(value)).hash).toBe((await validateSyncBatch(reordered)).hash);
  expect(canonicalJson({ z: '词', a: 1 })).toBe('{"a":1,"z":"词"}');
  await expect(validateSyncBatch({ ...value, token: 'secret' })).rejects.toThrow();
  await expect(validateSyncBatch(batch([{ ...saved('e', 1), payload: { memoryId: 'sense-1', saved: true, reviewEnabled: false, answer: 'private writing' } }]))).rejects.toThrow();
});

it('bounds event count, decoded UTF-8 bytes, IDs and per-batch device ownership', async () => {
  await expect(validateSyncBatch(batch([]))).rejects.toThrow();
  await expect(validateSyncBatch(batch([saved('e', 1, 'other')]))).rejects.toThrow();
  await expect(validateSyncBatch(batch([saved('e', 1), saved('e', 1)]))).rejects.toThrow();
  await expect(validateSyncBatch({ ...batch([saved('e', 1)]), deviceId: '../escape' })).rejects.toThrow();
  await expect(validateSyncBatch(batch(Array.from({ length: 501 }, (_, i) => saved(`e${i}`, i + 1))))).rejects.toThrow();
  const events: SyncEvent[] = Array.from({ length: 500 }, (_, i) => ({ ...saved(`e${i}`, i + 1), payload: { memoryId: '词'.repeat(160), saved: true, reviewEnabled: false } }));
  await expect(validateSyncBatch(batch(events))).rejects.toThrow('SYNC_CAPACITY');
});

it('isolates same-ID different-payload conflicts without mutating either input', () => {
  const original = [saved('e', 1)];
  expect(() => mergeSyncEvents(original, [saved('e', 1, 'a', false)])).toThrow('SYNC_EVENT_CONFLICT');
  expect(original).toEqual([saved('e', 1)]);
});

it('merges concurrent devices commutatively, associatively and idempotently', () => {
  fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 1000 }), { maxLength: 100 }), counters => {
    const a = counters.map((counter, i) => saved(`a${i}`, counter));
    const b = counters.map((counter, i) => saved(`b${i}`, counter, 'b', false));
    const merged = mergeSyncEvents(a, b);
    expect(merged).toEqual(mergeSyncEvents(b, a));
    expect(mergeSyncEvents(merged, a)).toEqual(merged);
    expect(mergeSyncEvents(mergeSyncEvents(a, b.slice(0, 2)), b.slice(2))).toEqual(merged);
  }));
});

it('orders settings by logical counter/device/ID even with inverted clocks and permits re-saving', () => {
  const old = { ...saved('old', 1, 'a', false), occurredAt: '2099-01-01T00:00:00.000Z' };
  const later = saved('later', 2, 'a', true);
  expect(projectSyncEvents([later, old]).savedItems.get('sense-1')).toEqual(later);
  expect(projectSyncEvents([saved('a', 3), saved('b', 3, 'b', false)]).savedItems.get('sense-1')?.payload.saved).toBe(false);
});

it('record tombstones defeat stale and later updates without removing unrelated new practice', () => {
  const completion: SyncEvent = { id: 'done', deviceId: 'a', counter: 9, occurredAt: time, type: 'completion', payload: { recordId: 'attempt-1', sessionId: 'session-1', questionId: 'q', rootId: 'root', goalId: 'goal', skill: 'reading', level: 'A1', mode: 'practice', contentHash: 'a'.repeat(64), scoringHash: 'b'.repeat(64), correct: true, assistance: { hintLevel: 0, dictionaryUsed: false, audioCompleted: false, playbackRequests: 0 } } };
  const deletion: SyncEvent = { id: 'delete', deviceId: 'b', counter: 1, occurredAt: time, type: 'deletion', payload: { target: 'record', targetId: 'attempt-1' } };
  const another: SyncEvent = { ...completion, id: 'new', payload: { ...completion.payload, recordId: 'attempt-2' } };
  expect(projectSyncEvents([completion, deletion, another]).completions).toEqual([another]);
  expect(projectSyncEvents([another, deletion, completion]).completions).toEqual([another]);
});

it('contact tombstones exclude duplicate old contacts, not other questions or new sessions', () => {
  const old: SyncEvent = { id: 'contact', deviceId: 'a', counter: 90, occurredAt: time, type: 'exposure', payload: { sessionId: 'old-session', questionId: 'q', rootId: 'root', materialId: 'material', variantGroup: 'q' } };
  const marker: SyncEvent = { id: 'remove-contact', deviceId: 'b', counter: 1, occurredAt: time, type: 'deletion', payload: { target: 'exposure_contact', targetId: 'root', sessionId: 'old-session', questionId: 'q' } };
  const fresh: SyncEvent = { ...old, id: 'new-contact', payload: { ...old.payload, sessionId: 'new-session' } };
  const another: SyncEvent = { ...old, id: 'other-question', payload: { ...old.payload, questionId: 'other-q' } };
  const duplicate: SyncEvent = { ...old, id: 'late-duplicate', counter: 100 };
  expect(projectSyncEvents([old, fresh, marker, another, duplicate]).exposures).toEqual([fresh, another]);
  expect(projectSyncEvents([duplicate, another, marker, fresh, old]).exposures).toEqual([fresh, another]);
});
