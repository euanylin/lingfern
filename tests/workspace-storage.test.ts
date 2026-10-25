import { beforeEach, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { organizePractice } from '../src/core/practiceOrganization';
import { lessonSchema, questions, type Question, type Answer } from '../src/shared/content';
import { attempts, claimSession, createSession, db, saveWorkspaceDraft, selectWorkspaceQuestion, sessions, submitWorkspace } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { quantityFixture } from './fixtures/quantity-lessons';
import { questionSlots } from '../src/shared/practiceQuantity';
import { practiceCardProgress } from '../src/app/PracticeCard';
const answerFor = (question: Question): Answer => 'gaps' in question ? question.gaps.map(gap => gap.answer) : 'rows' in question ? question.rows.map(row => row.answer) : 'pairs' in question ? question.pairs.map(pair => pair.answer) : 'steps' in question ? question.acceptedOrders[0] : 'spans' in question ? question.accepted[0] : 'criteria' in question ? question.parts ? question.parts.map(() => 'A supported response.') : 'A supported response.' : question.answer;
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
it('leaves old snapshots intact and saves independent response parts transactionally', async () => {
  const old = lessonSchema.parse(raw), frozen = await createSession(old, 'p');
  const before = await sessions.get(frozen.id);
  organizePractice(old);
  expect(await sessions.get(frozen.id)).toEqual(before);
  const { lesson } = quantityFixture(300);
  for (const m of lesson.materials) {
    const q = m.questions[0]; m.blocks[0].text = 'This is a report. ' + 'the '.repeat(145); q.evidence = { start: 0, end: 17 };
    m.questions = [{ kind: 'response', id: q.id, blockId: q.blockId, prompt: 'Who arrived? Where did they go?', parts: ['Who arrived?', 'Where did they go?'], hints: q.hints, criteria: [old.teaching!, old.workedExample!], explanation: old.teaching!, evidence: q.evidence }];
  }
  const prepared = organizePractice(lesson), current = await createSession(prepared, 'p');
  await claimSession(current.id, 'owner');
  const all = questions(prepared);
  expect(all.every(item => questionSlots(item.question) === 2)).toBe(true);
  await saveWorkspaceDraft(current.id, 'owner', all[0].question.id, ['Maya', '']);
  expect(practiceCardProgress([(await sessions.get(current.id))!], [])).toMatchObject({ answered: 1, total: 4 });
  await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow();
  expect(await attempts.count()).toBe(0);
  for (const item of all) await saveWorkspaceDraft(current.id, 'owner', item.question.id, ['Maya', 'The village']);
  const saved = await submitWorkspace(current.id, 'owner');
  expect(saved.attempts).toHaveLength(2);
  expect(practiceCardProgress([saved.session], saved.attempts)).toMatchObject({ answered: 4, total: 4 });
  expect(saved.session.lesson).toEqual(prepared);
  const archive = await inspectBackup(await exportBackup('p'));
  expect(archive.records.sessions.find(s => s.id === frozen.id)!.lesson).toEqual(old);
  expect(archive.records.sessions.find(s => s.id === current.id)!.lesson).toEqual(prepared);
});
it('stores drafts out of order, restores an isolated backup, and commits once without changing the snapshot', async () => {
  const lesson = organizePractice(lessonSchema.parse(raw)), current = await createSession(lesson, 'p');
  await claimSession(current.id, 'owner');
  const all = questions(lesson);
  for (const item of [...all].reverse()) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  await selectWorkspaceQuestion(current.id, 'owner', all.at(-1)!.question.id);
  expect(await attempts.count()).toBe(0); expect((await sessions.get(current.id))!.lesson).toEqual(lesson);
  const archive = await exportBackup('p'); expect((await inspectBackup(archive)).records.sessions[0].workspace?.drafts).toEqual((await sessions.get(current.id))!.workspace!.drafts);
  const restored = await importBackup(await inspectBackup(archive)); expect(restored).toBeDefined();
  const result = await submitWorkspace(current.id, 'owner'); expect(result.session.status).toBe('completed');
  expect(result.attempts).toHaveLength(all.length); expect(result.attempts.every(attempt => attempt.correct !== false)).toBe(true);
  expect((await submitWorkspace(current.id, 'owner')).attempts).toEqual(result.attempts);
  expect(await attempts.where('sessionId').equals(current.id).count()).toBe(all.length);
  await expect(saveWorkspaceDraft(current.id, 'owner', all[0].question.id, answerFor(all[0].question))).rejects.toThrow('CONFLICT');
});
it('rejects foreign questions, missing answers and failed writes without partial completion; retry is deduplicated', async () => {
  const lesson = organizePractice(lessonSchema.parse(raw)), current = await createSession(lesson, 'p');
  await claimSession(current.id, 'owner');
  await expect(saveWorkspaceDraft(current.id, 'owner', 'unknown', 0)).rejects.toThrow('INVALID_ANSWER');
  await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow('UNSAVED');
  for (const item of questions(lesson)) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  const fail = () => { throw new Error('DISK_FULL'); }; attempts.hook('creating', fail);
  try { await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow('DISK_FULL'); } finally { attempts.hook('creating').unsubscribe(fail); }
  expect(await attempts.count()).toBe(0); expect((await sessions.get(current.id))!.status).toBe('active');
  expect(Object.keys((await sessions.get(current.id))!.workspace!.drafts)).toHaveLength(questions(lesson).length);
  expect((await submitWorkspace(current.id, 'owner')).attempts).toHaveLength(questions(lesson).length);
});

it('uses the shared answer workspace for snapshots without an organization marker', async () => {
  const lesson = lessonSchema.parse(raw), current = await createSession(lesson, 'p');
  await claimSession(current.id, 'owner');
  for (const item of questions(lesson)) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  await selectWorkspaceQuestion(current.id, 'owner', questions(lesson).at(-1)!.question.id);
  const result = await submitWorkspace(current.id, 'owner');
  expect(result.session.lesson).toEqual(lesson);
  expect(result.attempts).toHaveLength(questions(lesson).length);
  expect(result.attempts.every(item => item.correct)).toBe(true);
  expect((await inspectBackup(await exportBackup('p'))).records.sessions[0].lesson).toEqual(lesson);
});

it('keeps strict checks concealed until started, saves drafts and commits all answers atomically', async () => {
  const { default: check } = await import('./fixtures/content/a1-check-reading.json');
  const { beginCheck, revealHint, recordDictionaryUse } = await import('../src/data/db');
  const current = await createSession(check, 'p'); await claimSession(current.id, 'owner');
  const all = questions(current.lesson), first = all[0].question;
  await expect(saveWorkspaceDraft(current.id, 'owner', first.id, answerFor(first))).rejects.toThrow('CONFLICT');
  await expect(selectWorkspaceQuestion(current.id, 'owner', first.id)).rejects.toThrow('CHECK_RESTRICTED');
  await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow('CHECK_RESTRICTED');
  await beginCheck(current.id, 'owner');
  const { validateWorkspace } = await import('../src/shared/practiceWorkspace');
  for (const assistance of [{ hintLevel: 1 }, { hintLevel: 0, dictionaryUsed: true }, { hintLevel: 0, teachingProvided: true }]) expect(() => validateWorkspace(current.lesson, { drafts: {}, assistance: { [current.lesson.materials[0].id]: assistance } })).toThrow('INVALID_WORKSPACE');
  await expect(revealHint(current.id, 'owner')).rejects.toThrow('CHECK_RESTRICTED');
  await expect(recordDictionaryUse(current.id, 'owner', first.id)).rejects.toThrow('CHECK_RESTRICTED');
  await saveWorkspaceDraft(current.id, 'owner', first.id, answerFor(first));
  await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow('UNSAVED');
  expect(await attempts.count()).toBe(0);
  const archive = await inspectBackup(await exportBackup('p'));
  expect(archive.records.sessions[0].workspace?.drafts).toEqual({ [first.id]: answerFor(first) });
  for (const item of all.slice(1)) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  const fail = () => { throw new Error('DISK_FULL'); }; attempts.hook('creating', fail);
  try { await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow('DISK_FULL'); } finally { attempts.hook('creating').unsubscribe(fail); }
  expect(await attempts.count()).toBe(0); expect((await sessions.get(current.id))!.checkEndedAt).toBeUndefined();
  const result = await submitWorkspace(current.id, 'owner');
  expect(result.session).toMatchObject({ status: 'completed', lesson: current.lesson, checkEndedAt: expect.any(String) });
  expect(result.attempts).toHaveLength(all.length);
  expect(result.attempts.every(item => !item.assistance.hintLevel && !item.assistance.dictionaryUsed && !item.assistance.teachingProvided)).toBe(true);
  expect((await submitWorkspace(current.id, 'owner')).attempts).toEqual(result.attempts);
  const completed = await inspectBackup(await exportBackup('p'));
  expect(completed.records.sessions[0].checkEndedAt).toBe(result.session.checkEndedAt);
  const restored = await importBackup(completed);
  expect((await sessions.where('profileId').equals(restored).toArray())[0].lesson).toEqual(current.lesson);
});

it('preserves partial check drafts on ending and rejects foreign-device workspace writes', async () => {
  const { default: check } = await import('./fixtures/content/a1-check-reading.json');
  const { beginCheck, endCheck, settings } = await import('../src/data/db');
  const current = await createSession(check, 'p'); await claimSession(current.id, 'owner'); await beginCheck(current.id, 'owner');
  const first = questions(current.lesson)[0].question;
  await saveWorkspaceDraft(current.id, 'owner', first.id, answerFor(first));
  const before = await sessions.get(current.id);
  await settings.put({ key: 'check-device-id', value: crypto.randomUUID() });
  for (const action of [() => saveWorkspaceDraft(current.id, 'owner', first.id, answerFor(first)), () => selectWorkspaceQuestion(current.id, 'owner', first.id), () => submitWorkspace(current.id, 'owner'), () => endCheck(current.id, 'owner')]) await expect(action()).rejects.toThrow('CHECK_DEVICE');
  expect(await sessions.get(current.id)).toEqual(before);
  await settings.put({ key: 'check-device-id', value: current.checkDeviceId! });
  const ended = await endCheck(current.id, 'owner');
  expect(ended).toMatchObject({ status: 'ended', workspace: before!.workspace, lesson: current.lesson });
  expect(await attempts.count()).toBe(0);
  await expect(saveWorkspaceDraft(current.id, 'owner', first.id, answerFor(first))).rejects.toThrow('CONFLICT');
  await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow('CHECK_RESTRICTED');
  expect((await inspectBackup(await exportBackup('p'))).records.sessions[0].workspace).toEqual(ended.workspace);
});

it('opens saved per-question records in the shared workspace without rewriting or resubmitting them', async () => {
  const { submit, advance, saveDraft } = await import('../src/data/db');
  const lesson = lessonSchema.parse(raw), current = await createSession(lesson, 'p'); await claimSession(current.id, 'owner');
  const all = questions(lesson), first = await submit(current.id, 'owner', answerFor(all[0].question));
  await advance(current.id, 'owner'); await saveDraft(current.id, 'owner', answerFor(all[1].question));
  for (const item of all.slice(2)) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  const result = await submitWorkspace(current.id, 'owner');
  expect(result.session.lesson).toEqual(lesson);
  expect(result.attempts).toHaveLength(all.length);
  expect(result.attempts[0]).toEqual(first);
  expect(result.session.workspace?.drafts).toEqual(Object.fromEntries(all.map(item => [item.question.id, answerFor(item.question)])));
  expect((await inspectBackup(await exportBackup('p'))).records.attempts).toHaveLength(all.length);
});

it('shares completed playback only between exact recordings while preserving group assistance and frozen answers', async () => {
  const { groupedListening } = await import('./fixtures/workspace-lessons');
  const { sameAudio } = await import('../src/shared/practiceWorkspace');
  const { recordPlayback } = await import('../src/data/db');
  const lesson = lessonSchema.parse(groupedListening()), [first, second, other] = lesson.materials;
  expect(sameAudio(first, second)).toBe(true);
  expect(sameAudio(first, { ...second, audio: { ...second.audio!, sha256: '0'.repeat(64) } })).toBe(false);
  expect(sameAudio(first, { ...second, audio: other.audio })).toBe(false);
  const current = await createSession(lesson, 'p'); await claimSession(current.id, 'owner');
  for (const item of questions(lesson)) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  await recordPlayback(current.id, 'owner', first.questions[0].id, false);
  const changed = await selectWorkspaceQuestion(current.id, 'owner', second.questions[0].id);
  expect(changed.assistance).toMatchObject({ playbackRequests: 1, audioCompleted: false, hintLevel: 0 });
  await recordPlayback(current.id, 'owner', second.questions[0].id, true);
  await expect(submitWorkspace(current.id, 'owner')).rejects.toThrow('NO_AUDIO');
  expect(await attempts.count()).toBe(0);
  const back = await selectWorkspaceQuestion(current.id, 'owner', first.questions[0].id);
  expect(back.assistance).toMatchObject({ playbackRequests: 1, audioCompleted: true, teachingProvided: true });
  expect((await selectWorkspaceQuestion(current.id, 'owner', other.questions[0].id)).assistance.audioCompleted).toBe(false);
  await recordPlayback(current.id, 'owner', other.questions[0].id, false); await recordPlayback(current.id, 'owner', other.questions[0].id, true);
  const result = await submitWorkspace(current.id, 'owner');
  expect(result.attempts).toHaveLength(questions(lesson).length);
  expect(result.attempts.every(attempt => attempt.assistance.audioCompleted && attempt.correct !== false)).toBe(true);
  expect(result.attempts.find(attempt => attempt.questionId === second.questions[0].id)!.assistance.teachingProvided).toBeUndefined();
  expect((await sessions.get(current.id))!.lesson).toEqual(lesson);
  expect((await inspectBackup(await exportBackup('p'))).records.sessions[0].workspace?.drafts).toEqual(result.session.workspace?.drafts);
});

it('keeps an existing single-question draft attached to its question when navigating materials', async () => {
  const { saveDraft } = await import('../src/data/db');
  const lesson = lessonSchema.parse(raw), current = await createSession(lesson, 'p'); await claimSession(current.id, 'owner');
  const all = questions(lesson), answer = answerFor(all[0].question);
  await saveDraft(current.id, 'owner', answer);
  const changed = await selectWorkspaceQuestion(current.id, 'owner', all.at(-1)!.question.id);
  expect(changed.workspace?.drafts[all[0].question.id]).toEqual(answer);
  expect(changed.draft).toBeUndefined();
  for (const item of all.slice(1)) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  const submitted = await submitWorkspace(current.id, 'owner');
  expect(submitted.attempts[0].answer).toEqual(answer);
  expect(submitted.attempts.every(attempt => attempt.correct)).toBe(true);
  expect(submitted.session.lesson).toEqual(lesson);
  const archive = await inspectBackup(await exportBackup('p')), restored = await importBackup(archive);
  expect((await sessions.where('profileId').equals(restored).toArray())[0].workspace?.drafts).toEqual(submitted.session.workspace?.drafts);
  expect(submitted.session.contentHash).toBe(current.contentHash);
});

it('can replay unfinished listening groups beside an immutable previously submitted question', async () => {
  const { default: rawListening } = await import('./fixtures/content/c2-listening.json');
  const { submit, recordPlayback, recordDictionaryUse } = await import('../src/data/db');
  const lesson = lessonSchema.parse(rawListening), current = await createSession(lesson, 'p'); await claimSession(current.id, 'owner');
  const [first, second] = lesson.materials;
  await recordPlayback(current.id, 'owner', first.questions[0].id, false); await recordPlayback(current.id, 'owner', first.questions[0].id, true);
  const committed = await submit(current.id, 'owner', answerFor(first.questions[0]));
  await selectWorkspaceQuestion(current.id, 'owner', first.questions[1].id);
  await recordPlayback(current.id, 'owner', first.questions[0].id, false);
  await recordPlayback(current.id, 'owner', first.questions[0].id, true);
  await recordDictionaryUse(current.id, 'owner', first.questions[0].id);
  expect((await sessions.get(current.id))!.assistance).toMatchObject({ playbackRequests: 2, audioCompleted: true, dictionaryUsed: true });
  expect(await attempts.get(committed.id)).toEqual(committed);
  for (const item of questions(lesson).slice(1)) await saveWorkspaceDraft(current.id, 'owner', item.question.id, answerFor(item.question));
  await selectWorkspaceQuestion(current.id, 'owner', second.questions[0].id);
  await recordPlayback(current.id, 'owner', second.questions[0].id, false); await recordPlayback(current.id, 'owner', second.questions[0].id, true);
  const result = await submitWorkspace(current.id, 'owner');
  expect(result.attempts).toHaveLength(4); expect(result.attempts[0]).toEqual(committed);
  expect(result.attempts[1].assistance).toMatchObject({ audioCompleted: true, dictionaryUsed: true });
});


it('counts the persisted single-question draft in the Today progress before the first workspace navigation', async () => {
  const { saveDraft } = await import('../src/data/db');
  const lesson = lessonSchema.parse(raw), current = await createSession(lesson, 'p'); await claimSession(current.id, 'owner');
  const question = questions(lesson)[0].question;
  await saveDraft(current.id, 'owner', answerFor(question));
  expect(practiceCardProgress([(await sessions.get(current.id))!], []).answered).toBe(questionSlots(question));
});
