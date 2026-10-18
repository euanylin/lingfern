import { beforeEach, expect, it } from 'vitest';
import rawCheck from './fixtures/content/a1-check-reading.json';
import rawLearning from './fixtures/content/a1-reading.json';
import { advance, attempts, beginCheck, claimSession, createSession, db, recordDictionaryUse, revealHint, sessions, submit } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
import { questions } from '../src/shared/content';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it.each([0, 1, 2, 3, 4])('preserves %i correct answers and precise evidence in a completed saved check snapshot', async correct => {
  const session = await createSession(rawCheck);
  await claimSession(session.id, 'owner');
  await beginCheck(session.id, 'owner');
  const items = questions(session.lesson);
  for (const [index, { question }] of items.entries()) {
    if (!('options' in question)) throw new Error('Expected isolated choice fixture');
    await submit(session.id, 'owner', index < correct ? question.answer : (question.answer + 1) % question.options.length);
    if (index < items.length - 1) await advance(session.id, 'owner');
  }
  expect((await sessions.get(session.id))?.status).toBe('completed');
  const saved = await attempts.where('sessionId').equals(session.id).toArray();
  expect(saved).toHaveLength(items.length);
  expect(saved.filter(answer => answer.correct).length).toBe(correct);
  expect(saved.every(answer => answer.assistance.hintLevel === 0 && !answer.assistance.dictionaryUsed)).toBe(true);
  const backup = await inspectBackup(await exportBackup(session.profileId));
  expect(backup.records.sessions.find(record => record.id === session.id)?.lesson).toEqual(session.lesson);
  expect(backup.records.attempts.filter(record => record.sessionId === session.id)).toEqual(saved);
});

it('rejects familiar source roots and assistance without losing the stored check snapshot', async () => {
  const lesson = structuredClone(rawCheck);
  lesson.materials[0].rootId = rawLearning.materials[0].rootId;
  await createSession(rawLearning);
  const session = await createSession(lesson);
  await claimSession(session.id, 'owner');
  await expect(beginCheck(session.id, 'owner')).rejects.toThrow('CHECK_EXPOSED');
  await expect(revealHint(session.id, 'owner')).rejects.toThrow('CHECK_RESTRICTED');
  await expect(recordDictionaryUse(session.id, 'owner', lesson.materials[0].questions[0].id)).rejects.toThrow('CHECK_RESTRICTED');
  expect((await sessions.get(session.id))?.checkStartedAt).toBeUndefined();
  expect((await sessions.get(session.id))?.lesson).toEqual(session.lesson);
  expect(await attempts.where('sessionId').equals(session.id).count()).toBe(0);
});
