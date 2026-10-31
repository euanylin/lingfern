import { expect, it, vi } from 'vitest';
import fc from 'fast-check';
import * as reviewModule from '../src/data/goalReview';
import a1Reading from './fixtures/content/a1-reading.json';
import a2Reading from './fixtures/content/a2-reading.json';
import a1Listening from './fixtures/content/a1-listening.json';
import { lessonSchema } from '../src/shared/content';
import { activeCombinedPractice, selectPractice } from '../src/data/practice';
import { goalReviews } from '../src/data/goalReview';
import type { Attempt, Session } from '../src/data/db';

const lessons = [a1Reading, a1Listening, a2Reading].map(raw => lessonSchema.parse(raw));
const session = (lesson = lessons[0], status: Session['status'] = 'completed', id = lesson.id, startedAt = '2026-09-27T10:00:00Z'): Session => ({
  id, profileId: 'local-guest', lesson, contentHash: 'test', position: 0,
  status, startedAt, assistance: { hintLevel: 0 }, leaseUntil: 0,
});
const responses = (source: Session, material = 0, correct = true, hintLevel = 0): Attempt[] => source.lesson.materials[material].questions.map((question, index) => ({
  id: `${source.id}:${question.id}`, sessionId: source.id, profileId: source.profileId,
  questionId: question.id, rootId: source.lesson.materials[material].rootId,
  answer: 0, correct, rule: 'exact-option-v1', assistance: { hintLevel }, submittedAt: new Date(Date.parse(source.startedAt) + (index + 1) * 60_000).toISOString(),
}));
const tomorrow = new Date('2026-09-28T12:00:00Z');

it('resumes the first eligible combined skill without changing its saved pair order', () => {
  const reading = { ...session(lessons[0], 'active', 'reading'), practiceGroupId: 'pair' };
  const listening = { ...session(lessons[1], 'active', 'listening'), practiceGroupId: 'pair' };
  expect(activeCombinedPractice([listening, reading])).toEqual({ session: reading, peers: [listening, reading] });
  reading.status = 'completed';
  expect(activeCombinedPractice([listening, reading])).toEqual({ session: listening, peers: [listening, reading] });
  listening.status = 'completed';
  expect(activeCombinedPractice([listening, reading])).toBeUndefined();
});

it('keeps combined recovery restrictions equivalent across incomplete, deleted and mixed groups', () => {
  fc.assert(fc.property(fc.array(fc.record({
    group: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
    status: fc.constantFrom('active' as const, 'completed' as const, 'ended' as const),
    listening: fc.boolean(), deleted: fc.boolean(),
    mode: fc.constantFrom(undefined, 'test' as const, 'check' as const),
  }), { maxLength: 50 }), rows => {
    const history = rows.map((row, index): Session => ({
      ...session(lessons[row.listening ? 1 : 0], row.status, String(index)),
      lesson: { ...lessons[row.listening ? 1 : 0], mode: row.mode },
      practiceGroupId: row.group === undefined ? undefined : `group-${row.group}`,
      recordsDeleted: row.deleted ? true : undefined,
    }));
    const expected = history.find(item => item.practiceGroupId && item.status === 'active' && !item.recordsDeleted
      && history.filter(peer => peer.practiceGroupId === item.practiceGroupId).length === 2
      && history.filter(peer => peer.practiceGroupId === item.practiceGroupId).every(peer => !peer.recordsDeleted && peer.lesson.mode !== 'check' && peer.lesson.mode === item.lesson.mode)
      && history.some(peer => peer.practiceGroupId === item.practiceGroupId && peer.lesson.skill === 'reading')
      && history.some(peer => peer.practiceGroupId === item.practiceGroupId && peer.lesson.skill === 'listening')
      && (item.lesson.skill === 'reading' || history.some(peer => peer.practiceGroupId === item.practiceGroupId && peer.lesson.skill === 'reading' && peer.status === 'completed')));
    const result = activeCombinedPractice(Object.freeze(history));
    expect(result?.session).toBe(expected);
    if (expected) expect(result?.peers).toEqual(history.filter(item => item.practiceGroupId === expected.practiceGroupId));
  }), { seed: 20261030, numRuns: 500 });
});

it('bounds history traversal when deleted reading records leave many inactive combined pairs', () => {
  let reads = 0;
  const history = Array.from({ length: 1000 }, (_, index): Session => ({
    ...session(lessons[index % 2], 'active', String(index)), recordsDeleted: index % 2 ? undefined : true,
    get practiceGroupId() { reads++; return `pair-${Math.floor(index / 2)}`; },
  }));
  expect(activeCombinedPractice(history)).toBeUndefined();
  expect(reads).toBeLessThan(history.length * 8);
});

it('skips history analysis when no eligible catalogue lesson can be selected', () => {
  const review = vi.spyOn(reviewModule, 'goalReviews'), done = session(), answers = responses(done);
  try {
    expect(selectPractice([], [done], answers, 'reading')).toBeUndefined();
    expect(selectPractice([lessons[1]], [done], answers, 'reading')).toBeUndefined();
    expect(selectPractice(lessons, [done], answers, 'reading', () => false)).toBeUndefined();
    expect(review).not.toHaveBeenCalled();
  } finally { review.mockRestore(); }
});

it('keeps reading and listening choices separate, preferring a saved task', () => {
  const reading = session(lessons[0], 'active');
  const listening = session(lessons[1]);
  expect(selectPractice(lessons, [reading, listening], responses(listening, 0, false), 'reading', undefined, tomorrow))
    .toMatchObject({ lesson: lessons[0], session: reading, reason: 'resume' });
  expect(selectPractice(lessons, [reading, listening], responses(listening, 0, false), 'listening', undefined, tomorrow))
    .toMatchObject({ lesson: lessons[1], reason: 'retry' });
});

it('revisits a due helped example before suggesting a fresh one', () => {
  const done = session();
  expect(selectPractice(lessons, [done], responses(done, 0, true, 1), 'reading', undefined, tomorrow))
    .toMatchObject({ lesson: lessons[0], reason: 'retry' });
  expect(selectPractice(lessons, [done], responses(done), 'reading', undefined, new Date('2026-09-27T12:00:00Z')))
    .toMatchObject({ lesson: lessons[2], reason: 'new' });
  expect(selectPractice(lessons, [], [], 'reading')).toMatchObject({ lesson: lessons[0], reason: 'first' });
});

it('does not suggest unavailable offline audio or fabricate endless new examples', () => {
  expect(selectPractice(lessons, [], [], 'listening', lesson => lesson.skill === 'reading')).toBeUndefined();
  const first = session(lessons[0]);
  const second = session(lessons[2]);
  expect(selectPractice(lessons, [first, second], [...responses(first), ...responses(second)], 'reading', undefined, new Date('2026-09-27T12:00:00Z'))).toBeUndefined();
});

it('schedules different-material success without advancing for same-day repetition, and resets after a failure', () => {
  const first = session();
  const second = session(lessons[0], 'completed', 'second', '2026-09-28T10:00:00Z');
  const repeat = session(lessons[0], 'completed', 'repeat', '2026-09-28T11:00:00Z');
  const failed = session(lessons[0], 'completed', 'failed', '2026-09-29T10:00:00Z');
  // Test recurrence with two distinct application roots, excluding the taught root.
  second.lesson = { ...second.lesson, materials: second.lesson.materials.map((material, index) => index ? { ...material, rootId: material.rootId + '-second' } : material) };
  repeat.lesson = second.lesson;
  const review = (history: Session[], answers: Attempt[], now: Date) => goalReviews(lessons, history, answers, now).get('reading:A1:place-and-item')!;
  expect(review([first], responses(first, 1), new Date('2026-09-27T12:00:00Z'))).toMatchObject({ state: 'independent', independentMaterials: 1, nextSuggestedAt: '2026-09-28T10:02:00.000Z' });
  const two = [...responses(first, 1), ...responses(second, 1)];
  expect(review([first, second], two, new Date('2026-09-28T12:00:00Z'))).toMatchObject({ state: 'independent', independentMaterials: 2, nextSuggestedAt: '2026-10-01T10:02:00.000Z' });
  const repeated = review([first, second, repeat], [...two, ...responses(repeat, 1)], new Date('2026-09-28T12:00:00Z'));
  expect(repeated.nextSuggestedAt).toBe('2026-10-01T10:02:00.000Z');
  expect(repeated.independentMaterials).toBe(2);
  const afterFailure = review([first, second, repeat, failed], [...two, ...responses(repeat, 1), ...responses(failed, 1, false)], new Date('2026-09-29T12:00:00Z'));
  expect(afterFailure).toMatchObject({ state: 'with_help', independentMaterials: 2, nextSuggestedAt: '2026-09-30T10:02:00.000Z', lastResult: 'incorrect' });
  expect(afterFailure.recent.at(-1)).toMatchObject({ rootId: first.lesson.materials[1].rootId, result: 'incorrect', supportLevel: 0 });
  expect(selectPractice(lessons, [first, second], two, 'reading', undefined, new Date('2026-10-02T00:00:00Z'))).toMatchObject({ reason: 'review' });
});

it('ignores partial and interrupted checks when deriving an independent material result', () => {
  const partial = session(lessons[0], 'active');
  expect(goalReviews(lessons, [partial], responses(partial).slice(0, 1), tomorrow).get('reading:A1:place-and-item')).toMatchObject({ state: 'new', practicedMaterials: 1, independentMaterials: 0, lastPracticedAt: '2026-09-27T10:01:00.000Z' });
  const ended = { ...session(lessons[0], 'ended'), lesson: { ...lessons[0], mode: 'check' as const } };
  expect(goalReviews(lessons, [ended], responses(ended), tomorrow).get('reading:A1:place-and-item')).toMatchObject({ state: 'new', independentMaterials: 0 });
});

it('prioritizes re-teaching after two complete incorrect materials without advancing the interval', () => {
  const first = session();
  const second = session(lessons[0], 'completed', 'second', '2026-09-27T11:00:00Z');
  const answers = [...responses(first, 0, false), ...responses(second, 1, false)];
  expect(selectPractice(lessons, [first, second], answers, 'reading', undefined, new Date('2026-09-27T12:00:00Z')))
    .toMatchObject({ lesson: lessons[0], reason: 'reteach' });
  expect(goalReviews(lessons, [first, second], answers, new Date('2026-09-27T12:00:00Z')).get('reading:A1:place-and-item'))
    .toMatchObject({ state: 'with_help', independentMaterials: 0, nextSuggestedAt: '2026-09-28T11:02:00.000Z' });
});
