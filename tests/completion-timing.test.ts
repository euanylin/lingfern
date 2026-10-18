import { beforeEach, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { lessonSchema, questions } from '../src/shared/content';
import { db, settings, syncEvents } from '../src/data/db';
import { appendSyncEvent, readSyncEvents } from '../src/data/sync';
import { completionTiming, confirmCompletionTime } from '../src/data/completionTiming';
import { mergeLearningRecords } from '../src/data/progress';
import { goalReviews } from '../src/data/goalReview';
import { eventHash } from '../src/shared/sync';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
const lesson = lessonSchema.parse(raw);
async function seed() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson)));
  const contentHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  for (const [index, item] of questions(lesson).entries()) await appendSyncEvent('local-guest', { type: 'completion', payload: { recordId: `record-${index}`, sessionId: 'remote-session', questionId: item.question.id, rootId: item.material.rootId, goalId: lesson.goalId, skill: lesson.skill, level: lesson.targetLevel, mode: 'practice', contentHash, correct: true, assistance: { hintLevel: 0, dictionaryUsed: false, audioCompleted: false, playbackRequests: 0 } } }, db, { occurredAt: '2099-01-01T00:00:00.000Z' });
  return readSyncEvents('local-guest');
}

it('confirms effective completion times without rewriting sources and survives replay and backup', async () => {
  const originals = await seed(), now = new Date('2026-09-30T12:00:00.000Z');
  const initial = await mergeLearningRecords([lesson], [], [], originals);
  expect(goalReviews([lesson], [], [], now, initial.summaries).get('reading:A1:place-and-item')).toMatchObject({ clockAnomaly: true, state: 'new' });
  for (const source of originals) await confirmCompletionTime('local-guest', source.id, await eventHash(source), '2026-09-27T10:00:00.000Z');
  const events = await readSyncEvents('local-guest');
  expect(events.filter(event => event.type === 'completion')).toEqual(originals);
  const effective = await mergeLearningRecords([lesson], [], [], events);
  expect(goalReviews([lesson], [], [], now, effective.summaries).get('reading:A1:place-and-item')).toMatchObject({ clockAnomaly: false, state: 'review_due', independentMaterials: 1 });
  expect((await completionTiming([...events].reverse())).times).toEqual((await completionTiming(events)).times);
  const duplicate = { ...originals[0], id: 'duplicate-source' };
  const duplicated = await mergeLearningRecords([lesson], [], [], [...events, duplicate]);
  expect(duplicated.summaries).toHaveLength(4);
  expect(duplicated.summaries.find(row => row.event.payload.recordId === 'record-0')?.event.occurredAt).toBe('2026-09-27T10:00:00.000Z');
  const disagreement = { id: 'different-confirmation', deviceId: 'other-device', counter: 100, occurredAt: '2026-09-30T10:00:00.000Z', type: 'completion_timing' as const, payload: { sourceId: duplicate.id, sourceHash: await eventHash(duplicate), time: '2026-09-28T10:00:00.000Z' } };
  const paused = await mergeLearningRecords([lesson], [], [], [...events, duplicate, disagreement]);
  expect(paused.summaries).toHaveLength(3);
  expect(paused.timingRows.filter(row => row.recordId === 'record-0').every(row => row.invalid)).toBe(true);


  const restored = await importBackup(await inspectBackup(await exportBackup('local-guest')));
  const replay = await mergeLearningRecords([lesson], [], [], await readSyncEvents(restored));
  expect(replay.summaries).toEqual(effective.summaries);
  const item = questions(lesson)[0];
  const localSession = { id: 'restored-session', syncSessionId: 'remote-session', profileId: 'local-guest', lesson, contentHash: originals[0].type === 'completion' ? originals[0].payload.contentHash : '', position: 0, status: 'completed' as const, startedAt: '2099-01-01T00:00:00.000Z', assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const answer = { id: 'restored-answer', syncRecordId: 'record-0', sessionId: localSession.id, profileId: 'local-guest', questionId: item.question.id, rootId: item.material.rootId, answer: 0, correct: true, rule: 'original-rule', assistance: { hintLevel: 0 }, submittedAt: '2099-01-01T00:00:00.000Z' };
  const local = await mergeLearningRecords([lesson], [localSession], [answer], events);
  expect(local.records[0]).toEqual({ ...answer, submittedAt: '2026-09-27T10:00:00.000Z' });
  expect(answer.submittedAt).toBe('2099-01-01T00:00:00.000Z');
  expect(local.summaries).toHaveLength(3);

  expect(replay.timingRows.every(row => row.originalTime.startsWith('2099') && row.time.startsWith('2026'))).toBe(true);
});

it('rejects changed sources, future/invalid times, profile switches and atomic failure', async () => {
  const [source] = await seed(), hash = await eventHash(source), time = '2026-09-27T10:00:00.000Z';
  await expect(confirmCompletionTime('local-guest', source.id, 'a'.repeat(64), time)).rejects.toThrow('COMPLETION_INVALID');
  await expect(confirmCompletionTime('other', source.id, hash, time)).rejects.toThrow('COMPLETION_INVALID');
  await expect(confirmCompletionTime('local-guest', source.id, hash, '2099-01-01T00:00:00.000Z')).rejects.toThrow('COMPLETION_CLOCK');
  await expect(confirmCompletionTime('local-guest', source.id, hash, 'invalid')).rejects.toThrow('COMPLETION_CLOCK');
  await settings.put({ key: 'activeProfile', value: 'other' });
  await expect(confirmCompletionTime('local-guest', source.id, hash, time)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  await settings.delete('activeProfile');
  const before = await readSyncEvents('local-guest');
  const reject = () => { throw new Error('disk failed'); };
  syncEvents.hook('creating', reject);
  try { await expect(confirmCompletionTime('local-guest', source.id, hash, time)).rejects.toThrow('disk failed'); }
  finally { syncEvents.hook('creating').unsubscribe(reject); }
  expect(await readSyncEvents('local-guest')).toEqual(before);
});

it('excludes invalid confirmations, permits explicit repair and never resurrects deleted records', async () => {
  const [source] = await seed();
  await appendSyncEvent('local-guest', { type: 'completion_timing', payload: { sourceId: source.id, sourceHash: 'a'.repeat(64), time: '2026-09-27T10:00:00.000Z' } });
  const invalid = await mergeLearningRecords([lesson], [], [], await readSyncEvents('local-guest'));
  expect(invalid.summaries).toHaveLength(3); expect(invalid.timingRows.find(row => row.id === source.id)?.invalid).toBe(true);
  const restored = await importBackup(await inspectBackup(await exportBackup('local-guest')));
  expect((await mergeLearningRecords([lesson], [], [], await readSyncEvents(restored))).summaries).toHaveLength(3);
  await settings.put({ key: 'activeProfile', value: 'local-guest' });
  await confirmCompletionTime('local-guest', source.id, await eventHash(source), '2026-09-27T10:00:00.000Z');
  expect((await mergeLearningRecords([lesson], [], [], await readSyncEvents('local-guest'))).summaries).toHaveLength(4);
  await appendSyncEvent('local-guest', { type: 'deletion', payload: { target: 'record', targetId: 'record-0' } });
  await expect(confirmCompletionTime('local-guest', source.id, await eventHash(source), '2026-09-27T10:00:00.000Z')).rejects.toThrow('COMPLETION_INVALID');
  const deleted = await mergeLearningRecords([lesson], [], [], await readSyncEvents('local-guest'));
  expect(deleted.summaries).toHaveLength(3); expect(deleted.timingRows.some(row => row.id === source.id)).toBe(false);
});
