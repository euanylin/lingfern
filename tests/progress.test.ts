import { expect, it } from 'vitest';
import rawLearning from './fixtures/content/a1-reading.json';
import rawCheck from './fixtures/content/a1-check-reading.json';
import { asTestLesson, lessonSchema, questions } from '../src/shared/content';
import type { Attempt, Session } from '../src/data/db';
import { fernActivity, progressRecords, mergeLearningRecords } from '../src/data/progress';

import { syncEventSchema, type SyncEvent } from '../src/shared/sync';
import { goalReviews } from '../src/data/goalReview';
import { selectPractice } from '../src/data/practice';
import { advance, claimSession, createSession, db, submit } from '../src/data/db';
import { readSyncEvents } from '../src/data/sync';

const learning = lessonSchema.parse(rawLearning);
const check = lessonSchema.parse(rawCheck);
const session = (id: string, lesson = learning): Session => ({ id, profileId: 'local-guest', lesson, contentHash: 'test', position: 0, status: 'completed', startedAt: '2026-09-27T10:00:00Z', assistance: { hintLevel: 0 }, leaseUntil: 0 });
const response = (owner: Session, index: number, id: string, correct: boolean, hintLevel = 0): Attempt => {
  const item = questions(owner.lesson)[index];
  return { id, sessionId: owner.id, profileId: owner.profileId, questionId: item.question.id, rootId: item.material.rootId, answer: 0, correct, rule: 'test', assistance: { hintLevel }, submittedAt: `2026-09-27T10:0${index}:00Z` };
};

it('weights complete tests above practice, credits partial saved work and deduplicates answers', () => {
  const practice = session('practice'), tested = session('tested', { ...learning, mode: 'test' }), strict = session('strict', check);
  const entries = (owner: Session, count = questions(owner.lesson).length) => progressRecords([], [owner], Array.from({ length: count }, (_, index) => response(owner, index, `${owner.id}-${index}`, false))).valid;
  expect(fernActivity(entries(practice))).toEqual({ reading: 1, listening: 0, tests: 0 });
  expect(fernActivity(entries(tested))).toEqual({ reading: 3, listening: 0, tests: 1 });
  expect(fernActivity(entries(strict))).toEqual({ reading: 3, listening: 0, tests: 1 });
  const partial = entries(tested, 1);
  expect(fernActivity([...partial, ...partial])).toEqual({ reading: 1 / questions(learning).length, listening: 0, tests: 0 });
  const complete = [...entries(practice), ...entries(tested)];
  expect(fernActivity([...complete, ...complete])).toEqual(fernActivity(complete));
  expect(fernActivity([...complete].reverse())).toEqual(fernActivity(complete));
  expect(fernActivity(entries(tested).slice(1)).reading).toBeLessThan(1);
  expect(fernActivity([])).toEqual({ reading: 0, listening: 0, tests: 0 });
});

it('resolves ordinary Test completion summaries from their exact snapshot without changing the wire mode', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const lesson = asTestLesson(learning), created = await createSession(lesson);
    await claimSession(created.id, 'test-owner');
    for (const item of questions(lesson)) {
      if ('kind' in item.question) throw new Error('Expected choice fixture');
      await submit(created.id, 'test-owner', item.question.answer);
      await advance(created.id, 'test-owner');
    }
    const events = await readSyncEvents('local-guest');
    expect(events.filter(event => event.type === 'completion').every(event => event.payload.mode === 'practice')).toBe(true);
    const remote = await mergeLearningRecords([lesson], [], [], events);
    expect(remote.unavailable).toEqual([]);
    expect(remote.summaries).toHaveLength(questions(lesson).length);
    expect(fernActivity(progressRecords([], [], [], remote.summaries).valid)).toEqual({ reading: 3, listening: 0, tests: 1 });
    const mismatched = events.map(event => event.type === 'completion' ? { ...event, payload: { ...event.payload, mode: 'check' as const } } : event);
    expect((await mergeLearningRecords([lesson], [], [], mismatched)).summaries).toEqual([]);
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('groups genuine first responses by goal and root without turning repeats or orphan data into progress', () => {
  const first = session('first');
  const repeat = session('repeat');
  const checked = session('check', check);
  const original = response(first, 0, 'first-answer', true);
  const later = { ...response(repeat, 0, 'repeat-answer', true, 1), submittedAt: '2026-09-28T10:00:00Z' };
  const helped = response(first, 2, 'helped', true, 1);
  const wrong = response(first, 3, 'wrong', false);
  const independentCheck = { ...response(checked, 0, 'checked', true), submittedAt: '2026-09-27T10:05:00Z' };
  const orphan = { ...original, id: 'orphan', sessionId: 'missing' };
  const mismatched = { ...original, id: 'mismatched', profileId: 'another-profile' };
  const result = progressRecords([learning], [first, repeat, checked], [later, helped, wrong, independentCheck, orphan, mismatched, original]);
  const goal = result.goals.find(item => item.lesson.skill === 'reading' && item.lesson.goalId === learning.goalId)!;
  expect(result.valid).toHaveLength(5);
  expect(goal.entries.map(entry => entry.mark)).toEqual(['○', '○', '×', '●']);
  expect(goal.entries.filter(entry => entry.attempt.rootId === original.rootId && entry.attempt.questionId === original.questionId)).toHaveLength(1);
});


it('merges matching summaries without original answers, restores aliases once and excludes tombstones and missing versions', async () => {
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(learning)));
  const contentHash = Array.from(new Uint8Array(hashBytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const events: SyncEvent[] = questions(learning).map((item, index) => syncEventSchema.parse({ id: `remote-${index}`, deviceId: 'device', counter: index + 1, occurredAt: '2026-09-27T10:00:00.000Z', type: 'completion', payload: { recordId: `record-${index}`, sessionId: 'remote-session', questionId: item.question.id, rootId: item.material.rootId, goalId: learning.goalId, skill: learning.skill, level: learning.targetLevel, mode: learning.mode ?? 'practice', contentHash, correct: true, assistance: { hintLevel: 0, dictionaryUsed: false, audioCompleted: false, playbackRequests: 0 } } }));
  const remote = await mergeLearningRecords([learning], [], [], events);
  expect(remote.summaries).toHaveLength(4); expect(remote.unavailable).toEqual([]);
  const progress = progressRecords([learning], [], [], remote.summaries);
  expect(progress.valid).toHaveLength(4);
  expect(progress.valid.every(entry => !entry.localSessionId && !('answer' in entry.attempt))).toBe(true);
  expect(goalReviews([learning], [], [], new Date('2026-09-30T12:00:00Z'), remote.summaries).get('reading:A1:place-and-item')).toMatchObject({ independentMaterials: 1, state: 'review_due' });
  expect(selectPractice([learning], [], [], 'reading', undefined, new Date('2026-09-30T12:00:00Z'), undefined, remote.summaries)).toMatchObject({ reason: 'retry' });
  const local = session('restored');
  const original = { ...response(local, 0, 'restored-answer', true), syncRecordId: 'record-0' };
  const combined = await mergeLearningRecords([learning], [local], [original, { ...original, id: 'another-restored-copy' }], events);
  expect(combined.records).toHaveLength(1); expect(combined.summaries).toHaveLength(3);
  expect(progressRecords([learning], [local], combined.records, combined.summaries).valid).toHaveLength(4);
  expect(fernActivity(progressRecords([learning], [local], combined.records, combined.summaries).valid)).toEqual(fernActivity(progress.valid));
  const missing = await mergeLearningRecords([], [], [], events);
  expect(missing.summaries).toEqual([]); expect(missing.unavailable).toHaveLength(4);
  const deletion = syncEventSchema.parse({ id: 'delete', deviceId: 'old-device', counter: 1, occurredAt: '2026-09-27T00:00:00.000Z', type: 'deletion', payload: { target: 'record', targetId: 'record-0' } });
  const deleted = await mergeLearningRecords([learning], [local], [original], [...events, deletion]);
  expect(deleted.records).toEqual([]); expect(deleted.summaries).toHaveLength(3);
  const conflict = syncEventSchema.parse({ ...events[0], id: 'different-event', occurredAt: '2026-09-27T11:00:00.000Z' });
  const ambiguous = await mergeLearningRecords([learning], [], [], [...events, conflict]);
  expect(ambiguous.conflicting.has('record-0')).toBe(true); expect(ambiguous.summaries).toHaveLength(3);
  const future = remote.summaries.map(row => ({ ...row, event: { ...row.event, occurredAt: '2099-01-01T00:00:00.000Z' } }));
  expect(goalReviews([learning], [], [], new Date('2026-09-30T12:00:00Z'), future).get('reading:A1:place-and-item')).toMatchObject({ clockAnomaly: true, state: 'new', nextSuggestedAt: undefined });
});
