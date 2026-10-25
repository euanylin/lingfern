import { beforeEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { unzipSync, zipSync } from 'fflate';
import { automaticQuestionKinds } from '../src/shared/practiceSelection';
import { organizePractice } from '../src/core/practiceOrganization';
import { asTestLesson, lessonSchema, questions, type Lesson } from '../src/shared/content';
import { validateWorkspace } from '../src/shared/practiceWorkspace';
import { attempts, bootstrapSyncEvents, claimSession, createSession, db, saveWorkspaceDraft, sessions, settings, skipWorkspaceQuestion, submitWorkspace, syncEvents } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { progressRecords } from '../src/data/progress';
import { practiceCardProgress } from '../src/app/PracticeCard';
import { quantityFixture } from './fixtures/quantity-lessons';
const raw = JSON.parse(readFileSync(new URL('./fixtures/content/a1-reading.json', import.meta.url), 'utf8')) as Lesson;
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
function mixedLesson() {
  const lesson = structuredClone(raw); lesson.id = 'isolated-subjective-skip';
  for (const material of lesson.materials) material.questions.push({ kind: 'response', id: `${material.id}-response`, blockId: material.blocks[0].id, prompt: 'Explain the source wording.', evidence: material.questions[0].evidence, criteria: [english('Use the source.'), english('Preserve its meaning.')], hints: material.questions[0].hints, explanation: english('Compare with the source.') });
  return lessonSchema.parse(lesson);
}
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('limits automatic open-response eligibility to about one seed in ten without changing explicit kinds', () => {
  let mixed = 0;
  for (let high = 0; high < 100; high++) for (const low of [0, 1234, 65535]) {
    const kinds = automaticQuestionKinds((high << 16) + low); if (!kinds.length) mixed++;
    expect(automaticQuestionKinds((high << 16) + low, ['table', 'choice'])).toEqual(['table', 'choice']);
  }
  expect(mixed).toBe(30);
  for (const skill of ['reading', 'listening'] as const) {
    const { lesson, bank } = quantityFixture(400, skill === 'listening' ? 180 : undefined), before = structuredClone(lesson);
    for (const material of lesson.materials) { const q = material.questions[0]; material.questions.push({ kind: 'response', id: `${q.id}-response`, blockId: q.blockId, prompt: 'Summarize the source.', evidence: q.evidence, criteria: [english('Use the source.'), english('Preserve meaning.')], hints: q.hints, explanation: english('Not scored.') }); }
    const frozen = structuredClone(lesson), result = organizePractice(lesson, skill === 'listening' ? [bank] : [], automaticQuestionKinds(1 << 16));
    expect(questions(result).every(item => !('criteria' in item.question))).toBe(true);
    expect(lesson).toEqual(frozen); expect(before.materials.length).toBe(result.materials.length);
    expect(asTestLesson(result).materials.map(material => material.questions.map(q => q.id))).toEqual(result.materials.map(material => material.questions.map(q => q.id)));
  }
});

it('persists skip/undo without losing partial answers, submits only real answers and preserves backup/sync', async () => {
  for (const testMode of [false, true]) {
    const lesson = testMode ? asTestLesson(mixedLesson()) : mixedLesson(), session = await createSession(lesson, 'p'); await claimSession(session.id, 'owner');
    const all = questions(lesson), open = all.filter(item => 'criteria' in item.question), first = open[0].question;
    await saveWorkspaceDraft(session.id, 'owner', first.id, 'Retained partial response.');
    await skipWorkspaceQuestion(session.id, 'owner', first.id, true);
    const partialBackup = await inspectBackup(await exportBackup('p'));
    expect(partialBackup.records.sessions.find(item => item.id === session.id)!.workspace?.skipped).toContain(first.id);
    await skipWorkspaceQuestion(session.id, 'owner', first.id, false);
    expect((await sessions.get(session.id))!.workspace?.drafts[first.id]).toBe('Retained partial response.');
    await expect(submitWorkspace(session.id, 'owner')).rejects.toThrow('UNSAVED');
    for (const item of all) {
      if ('criteria' in item.question) await skipWorkspaceQuestion(session.id, 'owner', item.question.id, true);
      else { if (!('options' in item.question)) throw new Error('NO_CHOICE'); await saveWorkspaceDraft(session.id, 'owner', item.question.id, item.question.answer); }
    }
    const result = await submitWorkspace(session.id, 'owner');
    expect(result.attempts).toHaveLength(4); expect(result.attempts.every(attempt => attempt.correct)).toBe(true);
    expect(result.attempts.some(attempt => open.some(item => item.question.id === attempt.questionId))).toBe(false);
    expect(practiceCardProgress([result.session], result.attempts)).toMatchObject({ answered: 6, total: 6 });
    expect(progressRecords([], [result.session], result.attempts).valid).toHaveLength(4);
    expect((await submitWorkspace(session.id, 'owner')).attempts).toEqual(result.attempts);
    const archive = await inspectBackup(await exportBackup('p')), restored = await importBackup(archive);
    expect((await sessions.where('profileId').equals(restored).toArray()).find(item => item.contentHash === session.contentHash)?.workspace?.skipped).toEqual(open.map(item => item.question.id));
    await syncEvents.where('profileId').equals('p').delete();
    await settings.delete('profile:p:syncBootstrap');
    await bootstrapSyncEvents('p');
    const completions = (await syncEvents.toArray()).filter(row => row.profileId === 'p' && row.type === 'completion' && row.payload.sessionId === session.id);
    expect(completions).toHaveLength(4);
    expect(completions.some(row => row.type === 'completion' && open.some(item => item.question.id === row.payload.questionId))).toBe(false);
    const count = await syncEvents.count(); await bootstrapSyncEvents('p'); expect(await syncEvents.count()).toBe(count);
  }
});

it('rejects objective, foreign, committed and strict-check skips and rolls back failed writes', async () => {
  const lesson = mixedLesson(), session = await createSession(lesson, 'p'); await claimSession(session.id, 'owner');
  const open = questions(lesson).find(item => 'criteria' in item.question)!.question.id, objective = lesson.materials[0].questions[0].id;
  await expect(skipWorkspaceQuestion(session.id, 'other', open, true)).rejects.toThrow('BUSY');
  for (const id of [objective, 'foreign']) await expect(skipWorkspaceQuestion(session.id, 'owner', id, true)).rejects.toThrow('INVALID_ANSWER');
  for (const skipped of [[objective], [open, open], ['foreign']]) expect(() => validateWorkspace(lesson, { drafts: {}, assistance: {}, skipped })).toThrow();
  const fail = () => { throw new Error('DISK_FULL'); }; sessions.hook('updating', fail);
  try { await expect(skipWorkspaceQuestion(session.id, 'owner', open, true)).rejects.toThrow('DISK_FULL'); } finally { sessions.hook('updating').unsubscribe(fail); }
  expect((await sessions.get(session.id))!.workspace?.skipped).toBeUndefined();
  const { default: rawCheck } = await import('./fixtures/content/a1-check-reading.json');
  const check = await createSession(rawCheck, 'p'); await claimSession(check.id, 'owner');
  await expect(skipWorkspaceQuestion(check.id, 'owner', rawCheck.materials[0].questions[0].id, true)).rejects.toThrow('CONFLICT');
  expect(await attempts.count()).toBe(0);
  const { submit, advance } = await import('../src/data/db');
  for (let index = 0; index < 3; index++) { const question = questions(lesson)[index].question; await submit(session.id, 'owner', 'criteria' in question ? 'A real response.' : 'options' in question ? question.answer : 0); if (index < 2) await advance(session.id, 'owner'); }
  const committed = await attempts.get(`${session.id}:${open}`);
  await expect(skipWorkspaceQuestion(session.id, 'owner', open, true)).rejects.toThrow('INVALID_ANSWER');
  expect(await attempts.get(`${session.id}:${open}`)).toEqual(committed);
  const files = unzipSync(await exportBackup('p')), manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  const saved = JSON.parse(new TextDecoder().decode(files['sessions.json'])); saved.find((item: { id: string }) => item.id === session.id).workspace = { drafts: {}, assistance: {}, skipped: [open] };
  files['sessions.json'] = new TextEncoder().encode(JSON.stringify(saved));
  manifest.files['sessions.json'].bytes = files['sessions.json'].length;
  manifest.files['sessions.json'].sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', files['sessions.json'])), byte => byte.toString(16).padStart(2, '0')).join('');
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_REFERENCE');
});

it('keeps playback bookkeeping stable across same-file groups but rejects another recording', async () => {
  const { groupedListening } = await import('./fixtures/workspace-lessons');
  const { markExposure, recordPlayback, selectWorkspaceQuestion } = await import('../src/data/db');
  const session = await createSession(groupedListening(), 'audio-p'), original = await claimSession(session.id, 'owner'), [first, same, other] = session.lesson.materials;
  await selectWorkspaceQuestion(session.id, 'owner', same.questions[0].id);
  await recordPlayback(session.id, 'owner', first.questions[0].id, false); await recordPlayback(session.id, 'owner', first.questions[0].id, true);
  await expect(markExposure(original)).resolves.toBeUndefined();
  expect((await sessions.get(session.id))!.assistance.audioCompleted).toBe(true);
  await selectWorkspaceQuestion(session.id, 'owner', other.questions[0].id);
  await expect(recordPlayback(session.id, 'owner', first.questions[0].id, true)).rejects.toThrow('CONFLICT');
  await expect(markExposure(original)).rejects.toThrow('CONFLICT');
});

it('does not manufacture an answer or score when every open-response group is skipped', async () => {
  const lesson = mixedLesson(); for (const material of lesson.materials) material.questions = material.questions.filter(question => 'criteria' in question);
  const session = await createSession(lesson, 'p'); await claimSession(session.id, 'owner');
  for (const { question } of questions(lesson)) await skipWorkspaceQuestion(session.id, 'owner', question.id, true);
  const result = await submitWorkspace(session.id, 'owner');
  expect(result.session.status).toBe('completed'); expect(result.attempts).toEqual([]);
  expect(progressRecords([], [result.session], []).valid).toHaveLength(0);
  expect((await syncEvents.toArray()).filter(event => event.type === 'completion')).toEqual([]);
  await expect(inspectBackup(await exportBackup('p'))).resolves.toBeDefined();
});
