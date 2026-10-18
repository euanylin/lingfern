import { beforeEach, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { organizePractice } from '../src/core/practiceOrganization';
import { lessonSchema, questions, type Question, type Answer } from '../src/shared/content';
import { attempts, claimSession, createSession, db, saveWorkspaceDraft, selectWorkspaceQuestion, sessions, submitWorkspace } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
const answerFor = (question: Question): Answer => 'gaps' in question ? question.gaps.map(gap => gap.answer) : 'rows' in question ? question.rows.map(row => row.answer) : 'pairs' in question ? question.pairs.map(pair => pair.answer) : 'steps' in question ? question.acceptedOrders[0] : 'spans' in question ? question.accepted[0] : 'criteria' in question ? 'A supported response.' : question.answer;
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
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
