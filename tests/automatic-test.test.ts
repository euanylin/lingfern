import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { corpusLesson, corpusSchema } from '../src/core/corpus';
import { asTestLesson, lessonSchema, questions, score, type Answer } from '../src/shared/content';
import { advance, attempts, beginCheck, claimSession, createCombinedPractice, createSession, db, recordDictionaryUse, revealHint, saveSelfAssessment, sessions, submit } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import listening from './fixtures/content/a1-listening.json';
import independent from './fixtures/content/a1-check-reading.json';

const practice = corpusLesson(corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8'))), new Set(), 0, 300, 'B2', [], 'completion')!;
const testLesson = asTestLesson(practice);
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('reuses generated questions, IDs, answers and exact evidence while removing all assistance', () => {
  const before = structuredClone(practice);
  expect(testLesson.id).toBe(practice.id);
  expect(testLesson.mode).toBe('test'); expect(testLesson.reviewStatus).toBe('draft');
  expect(testLesson.generation).toEqual(practice.generation);
  expect(testLesson.teaching).toBeUndefined(); expect(testLesson.workedExample).toBeUndefined(); expect(testLesson.nextStep).toBeUndefined();
  expect(questions(testLesson)).toHaveLength(4);
  for (const [index, { material, question }] of questions(testLesson).entries()) {
    const original = questions(practice)[index];
    const expected = structuredClone(original.question);
    delete expected.hints;
    if ('criteria' in expected) delete expected.modelAnswer;
    expect(question).toEqual(expected);
    expect(material.blocks).toEqual(original.material.blocks);
    expect(question.id).toBe(original.question.id); expect(question.evidence).toEqual(original.question.evidence);
    expect(question.hints).toBeUndefined();
    if ('criteria' in question) expect(question.modelAnswer).toBeUndefined();
    else if ('kind' in question && question.kind === 'completion') expect(score(question, question.answer).correct).toBe(true);
  }
  expect(practice).toEqual(before);
  expect(asTestLesson(testLesson)).toEqual(testLesson);
  expect(() => asTestLesson(lessonSchema.parse(independent))).toThrow('INVALID_TEST');
  for (const invalid of [
    { ...testLesson, teaching: practice.teaching },
    { ...testLesson, expectedMinutes: 10 },
    { ...testLesson, materials: [testLesson.materials[0]] },
    { ...testLesson, materials: testLesson.materials.map(material => ({ ...material, questions: material.questions.map(question => ({ ...question, hints: practice.materials[0].questions[0].hints })) })) },
    { ...testLesson, materials: testLesson.materials.map(material => ({ ...material, questions: material.questions.map(question => 'criteria' in question ? { ...question, modelAnswer: 'Unrequested assistance' } : question) })) },
  ]) expect(lessonSchema.safeParse(invalid).success).toBe(false);
});

it('keeps practice and test variants separate and blocks assistance without an independent-check introduction', async () => {
  const normal = await createSession(practice), tested = await createSession(testLesson);
  expect(normal.contentHash).not.toBe(tested.contentHash);
  expect(tested.assistance).toEqual({ hintLevel: 0 }); expect(tested.checkDeviceId).toBeUndefined();
  await expect(createSession(testLesson)).rejects.toThrow('VARIANT_ALREADY_SAVED');
  await claimSession(tested.id, 'tester');
  await expect(beginCheck(tested.id, 'tester')).rejects.toThrow('CHECK_RESTRICTED');
  const first = questions(testLesson)[0].question;
  await expect(revealHint(tested.id, 'tester')).rejects.toThrow('CHECK_RESTRICTED');
  await expect(recordDictionaryUse(tested.id, 'tester', first.id)).rejects.toThrow('CHECK_RESTRICTED');
  for (const { question } of questions(testLesson)) {
    const answer: Answer = 'criteria' in question ? 'My interpretation is supported by the quoted passage.' : 'kind' in question && question.kind === 'completion' ? question.answer : (() => { throw new Error('Expected completion'); })();
    const saved = await submit(tested.id, 'tester', answer);
    expect(saved.correct).toBe('criteria' in question ? null : true);
    expect(saved.assistance).toEqual({ hintLevel: 0 });
    if ('criteria' in question) {
      expect(saved.rule).toBe('open-response-unscored-v1');
      await expect(saveSelfAssessment(tested.id, 'tester', question.id, ['met', 'met'])).rejects.toThrow('CONFLICT');
    }
    await advance(tested.id, 'tester');
  }
  const finished = (await sessions.get(tested.id))!;
  expect(finished.status).toBe('completed'); expect(finished.checkStartedAt).toBeUndefined();
  expect(await attempts.where('sessionId').equals(tested.id).count()).toBe(4);
  expect(finished.lesson.mode).toBe('test'); expect(finished.checkDeviceId).toBeUndefined();
});

it('atomically groups two test snapshots and restores the same modes and unscored responses', async () => {
  const listeningTest = asTestLesson(lessonSchema.parse(listening));
  for (const pair of [[testLesson, listening], [practice, listeningTest]]) {
    await expect(createCombinedPractice(pair[0], pair[1])).rejects.toThrow('PRACTICE_RESTRICTED');
    expect(await sessions.count()).toBe(0);
  }
  const pair = await createCombinedPractice(testLesson, listeningTest);
  expect(pair[0].practiceGroupId).toBe(pair[1].practiceGroupId);
  expect(pair.every(session => session.lesson.mode === 'test' && !session.checkGroupId && !session.checkDeviceId)).toBe(true);
  await claimSession(pair[0].id, 'pair-test');
  const first = questions(testLesson)[0].question;
  if (!('kind' in first) || first.kind !== 'completion') throw new Error('Expected completion');
  await submit(pair[0].id, 'pair-test', first.answer); await advance(pair[0].id, 'pair-test');
  await submit(pair[0].id, 'pair-test', 'A saved interpretation without a formal score.');
  const bytes = await exportBackup('local-guest'), inspection = await inspectBackup(bytes);
  const importedProfile = await importBackup(inspection);
  const restored = await sessions.where('profileId').equals(importedProfile).toArray();
  expect(restored).toHaveLength(2);
  expect(restored.every(session => session.lesson.mode === 'test' && session.practiceGroupId === pair[0].practiceGroupId)).toBe(true);
  expect(restored.find(session => session.lesson.skill === 'reading')!.lesson).toEqual(testLesson);
  expect((await attempts.where('profileId').equals(importedProfile).toArray()).some(attempt => attempt.correct === null)).toBe(true);
  await expect(inspectBackup(await exportBackup(importedProfile))).resolves.toBeDefined();
  const files = unzipSync(bytes), rows = JSON.parse(new TextDecoder().decode(files['sessions.json']));
  const changedSession = rows.find((session: { lesson: { skill: string } }) => session.lesson.skill === 'listening');
  changedSession.lesson = lessonSchema.parse(listening);
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  changedSession.contentHash = hash(changedSession.lesson);
  changedSession.itemHashes = Object.fromEntries(questions(changedSession.lesson).map(item => [item.question.id, hash(item)]));
  const changed = new TextEncoder().encode(JSON.stringify(rows)); files['sessions.json'] = changed;
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  manifest.files['sessions.json'].bytes = changed.length;
  manifest.files['sessions.json'].sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', changed))].map(value => value.toString(16).padStart(2, '0')).join('');
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_REFERENCE');
});
