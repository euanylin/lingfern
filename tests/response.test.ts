import { beforeEach, expect, it } from 'vitest';
import raw from './fixtures/content/b1-summary-reading.json';
import { lessonSchema, questions, score, validateAnswer } from '../src/shared/content';
import { advance, attempts, claimSession, createSession, db, saveDraft, saveSelfAssessment, sessions, submit } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { progressRecords } from '../src/data/progress';
import { readFileSync } from 'node:fs';
import { corpusLesson, corpusSchema } from '../src/core/corpus';
import { goalReviews } from '../src/data/goalReview';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('validates response evidence and limits without assigning correctness', () => {
  const lesson = lessonSchema.parse(raw);
  expect(questions(lesson)).toHaveLength(2);
  for (const { question } of questions(lesson)) {
    if (!('criteria' in question)) throw new Error('Expected response');
    for (const answer of [question.modelAnswer!, 'A different response.']) expect(score(question, answer)).toEqual({ correct: null, rule: 'open-response-unscored-v1' });
    for (const answer of ['', '  ', 'a'.repeat(4001), 1, ['text']]) expect(() => validateAnswer(question, answer)).toThrow();
    expect(() => validateAnswer(question, '', true)).not.toThrow();
  }
  expect(lessonSchema.safeParse({ ...raw, mode: 'check' }).success).toBe(false);
});

it('saves an optional self-assessment separately and restores it without creating mastery', async () => {
  const session = await createSession(raw); await claimSession(session.id, 'tab');
  const question = questions(session.lesson)[0].question;
  const answer = 'We need to wait for Friday’s email before making travel plans. The workshop might move online if the room cannot be used.';
  await saveDraft(session.id, 'tab', answer);
  expect((await inspectBackup(await exportBackup('local-guest'))).records.sessions[0].draft).toBe(answer);
  await expect(saveSelfAssessment(session.id, 'tab', question.id, ['met', 'met', 'met'])).rejects.toThrow('UNSAVED');
  const original = await submit(session.id, 'tab', answer);
  await expect(saveSelfAssessment(session.id, 'other', question.id, ['met', 'met', 'met'])).rejects.toThrow('BUSY');
  await expect(saveSelfAssessment(session.id, 'tab', question.id, ['met', 'met'])).rejects.toThrow();
  const assessed = await saveSelfAssessment(session.id, 'tab', question.id, ['met', 'met', 'met']);
  expect(assessed).toEqual({ ...original, selfAssessment: ['met', 'met', 'met'] });
  const fail = () => { throw new Error('disk full'); };
  attempts.hook('updating', fail);
  try { await expect(saveSelfAssessment(session.id, 'tab', question.id, ['revise', 'met', 'met'])).rejects.toThrow('disk full'); }
  finally { attempts.hook('updating').unsubscribe(fail); }
  expect(await attempts.get(original.id)).toEqual(assessed);
  const current = (await sessions.get(session.id))!;
  expect(progressRecords([session.lesson], [current], [assessed]).valid[0].mark).toBe('◇');
  const review = [...goalReviews([session.lesson], [current], [assessed]).values()][0];
  expect(review).toMatchObject({ practicedMaterials: 1, independentMaterials: 0, recent: [] });
  expect(review.nextSuggestedAt).toBeUndefined();
  const backup = await inspectBackup(await exportBackup('local-guest'));
  const profile = await importBackup(backup);
  expect(await attempts.where('profileId').equals(profile).first()).toMatchObject({ answer, correct: null, selfAssessment: ['met', 'met', 'met'] });
  await attempts.update(original.id, { correct: true });
  await expect(inspectBackup(await exportBackup('local-guest'))).rejects.toThrow('BACKUP_REFERENCE');
});


it('schedules complete mixed client practice without scoring the open response or granting mastery', async () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const lesson = corpusLesson(corpus, new Set(), 0, 120, 'A1')!;
  const session = await createSession(lesson); await claimSession(session.id, 'tab');
  for (const { question } of questions(lesson)) {
    const answer = 'criteria' in question ? 'Anna meets people in the apartment building.' : 'rows' in question ? question.rows.map(row => row.answer) : 'pairs' in question ? question.pairs.map(pair => pair.answer) : 'steps' in question ? question.acceptedOrders[0] : 'answer' in question ? question.answer : 0;
    await submit(session.id, 'tab', answer);
    await advance(session.id, 'tab');
  }
  const current = (await sessions.get(session.id))!;
  const saved = await attempts.toArray();
  const at = Math.max(...saved.map(item => Date.parse(item.submittedAt)));
  const review = [...goalReviews([lesson], [current], saved, new Date(at + 1)).values()][0];
  expect(review).toMatchObject({ state: 'new', independentMaterials: 0, recentlyConsistent: false, recent: [] });
  expect(Date.parse(review.nextSuggestedAt!)).toBe(at + 86400000);
  expect([...goalReviews([lesson], [current], saved, new Date(at + 86400001)).values()][0].state).toBe('review_due');
  expect([...goalReviews([lesson], [{ ...current, status: 'active' }], saved, new Date(at + 86400001)).values()][0].nextSuggestedAt).toBeUndefined();
});
