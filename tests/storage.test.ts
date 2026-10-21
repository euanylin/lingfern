import { beforeEach, describe, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { advance, attempts, claimSession, createSession, db, recordDictionaryUse, releaseSession, revealHint, saveDraft, sessions, submit } from '../src/data/db';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
describe('local answer transactions', () => {
  it('leaves assistance unchanged when the current application has no hints', async () => {
    const lesson = structuredClone(raw);
    delete (lesson.materials[1].questions[0] as { hints?: unknown }).hints;
    const session = await createSession(lesson); await claimSession(session.id, 'reader');
    for (const question of lesson.materials[0].questions) { await submit(session.id, 'reader', question.answer); await advance(session.id, 'reader'); }
    const before = await sessions.get(session.id);
    expect(await revealHint(session.id, 'reader')).toEqual(before!.assistance);
    expect(await sessions.get(session.id)).toEqual(before);
  });
  it('records dictionary assistance before submission and does not change saved evidence', async () => {
    const s = await createSession(raw); await claimSession(s.id, 'reader');
    const questionId = s.lesson.materials[0].questions[0].id;
    await expect(recordDictionaryUse(s.id, 'other-tab', questionId)).rejects.toThrow('BUSY');
    await recordDictionaryUse(s.id, 'reader', questionId);
    const saved = await submit(s.id, 'reader', 1);
    expect(saved.assistance.dictionaryUsed).toBe(true);
    await recordDictionaryUse(s.id, 'reader', questionId);
    expect(await attempts.get(saved.id)).toEqual(saved);
    await advance(s.id, 'reader');
    expect((await sessions.get(s.id))?.assistance.dictionaryUsed).toBeUndefined();
    await expect(recordDictionaryUse(s.id, 'reader', questionId)).rejects.toThrow('CONFLICT');
  });
  it('persists the real snapshot, assistance, draft and original answer; retries apply once', async () => {
    const session = await createSession(raw);
    await claimSession(session.id, 'tab-a');
    await saveDraft(session.id, 'tab-a', 1);
    await revealHint(session.id, 'tab-a');
    const first = await submit(session.id, 'tab-a', 1);
    expect(first.assistance.hintLevel).toBe(1);
    expect(await submit(session.id, 'tab-a', 1)).toEqual(first);
    await expect(submit(session.id, 'tab-a', 0)).rejects.toThrow('CONFLICT');
    expect(await attempts.count()).toBe(1);
    expect((await sessions.get(session.id))?.lesson).toEqual(raw);
    await advance(session.id, 'tab-a');
    expect((await sessions.get(session.id))?.position).toBe(1);
    expect((await sessions.get(session.id))?.draft).toBeUndefined();
  });
  it('cannot advance before saving and denies another tab, even when submitting directly', async () => {
    const s = await createSession(raw); await claimSession(s.id, 'tab-a');
    await expect(advance(s.id, 'tab-a')).rejects.toThrow('UNSAVED');
    await expect(claimSession(s.id, 'tab-b')).rejects.toThrow('BUSY');
    await expect(submit(s.id, 'tab-b', 1)).rejects.toThrow('BUSY');
    await releaseSession(s.id, 'tab-a'); await claimSession(s.id, 'tab-b');
    expect((await submit(s.id, 'tab-b', 1)).correct).toBe(true);
  });
  it('only lets a Web Lock holder reclaim a lock-marked stale lease', async () => {
    const s = await createSession(raw);
    await claimSession(s.id, 'tab-a', Date.now(), undefined, true);
    await expect(claimSession(s.id, 'tab-b')).rejects.toThrow('BUSY');
    expect((await claimSession(s.id, 'tab-b', Date.now(), undefined, true)).owner).toBe('tab-b');
    await expect(submit(s.id, 'tab-a', 1)).rejects.toThrow('BUSY');
    const legacy = await createSession(raw);
    await claimSession(legacy.id, 'old-tab');
    await expect(claimSession(legacy.id, 'new-tab', Date.now(), undefined, true)).rejects.toThrow('BUSY');
  });
  it('rolls back the answer when session writing fails, including completion', async () => {
    const s = await createSession(raw); await claimSession(s.id, 'tab-a');
    for (const answer of [1, 2, 1]) { await submit(s.id, 'tab-a', answer); await advance(s.id, 'tab-a'); }
    const fail = () => { throw new Error('storage failure'); };
    sessions.hook('updating', fail);
    try { await expect(submit(s.id, 'tab-a', 2)).rejects.toThrow('storage failure'); }
    finally { sessions.hook('updating').unsubscribe(fail); }
    expect(await attempts.count()).toBe(3);
    expect((await sessions.get(s.id))?.status).toBe('active');
    expect((await submit(s.id, 'tab-a', 2)).correct).toBe(true);
    expect((await sessions.get(s.id))?.status).toBe('completed');
  });
});

it('requires completed playback, retains assistance and keeps saved listening evidence immutable', async () => {
  const { default: rawListening } = await import('./fixtures/content/a1-listening.json');
  const { recordPlayback } = await import('../src/data/db');
  const s = await createSession(rawListening); await claimSession(s.id, 'listener');
  const q = s.lesson.materials[0].questions[0];
  if (!('options' in q)) throw new Error('Expected choice question');
  await expect(submit(s.id, 'listener', q.answer)).rejects.toThrow('NO_AUDIO');
  await expect(recordPlayback(s.id, 'listener', q.id, true)).rejects.toThrow('NO_AUDIO');
  await recordPlayback(s.id, 'listener', q.id, false);
  await expect(submit(s.id, 'listener', q.answer)).rejects.toThrow('NO_AUDIO');
  await recordPlayback(s.id, 'listener', q.id, true);
  await revealHint(s.id, 'listener');
  const result = await submit(s.id, 'listener', q.answer);
  expect(result.assistance).toEqual({ hintLevel: 1, playbackRequests: 1, audioCompleted: true, teachingProvided: true });
  await recordPlayback(s.id, 'listener', q.id, false);
  expect(await attempts.get(result.id)).toEqual(result);
  await advance(s.id, 'listener');
  await expect(recordPlayback(s.id, 'listener', q.id, true)).rejects.toThrow('CONFLICT');
  await expect(submit(s.id, 'listener', 0)).rejects.toThrow('NO_AUDIO');
});

it('reuses a completed recording within one discussion but not across distinct materials', async () => {
  const { default: rawC2Listening } = await import('./fixtures/content/c2-listening.json');
  const { recordPlayback } = await import('../src/data/db');
  const session = await createSession(rawC2Listening); await claimSession(session.id, 'listener');
  const [first, second] = session.lesson.materials[0].questions;
  if (!('options' in first) || !('options' in second)) throw new Error('Expected choice questions');
  await recordPlayback(session.id, 'listener', first.id, false);
  await recordPlayback(session.id, 'listener', first.id, true);
  await submit(session.id, 'listener', first.answer);
  await advance(session.id, 'listener');
  expect((await submit(session.id, 'listener', second.answer)).assistance).toMatchObject({ audioCompleted: true, playbackRequests: 0 });
  await advance(session.id, 'listener');
  await expect(submit(session.id, 'listener', 0)).rejects.toThrow('NO_AUDIO');
});

it('saves an A2 table draft, rejects partial submission and preserves the original scored cells', async () => {
  const { default: rawA2 } = await import('./fixtures/content/a2-reading.json');
  const s = await createSession(rawA2); await claimSession(s.id, 'writer');
  const draft = ['11:00', ''];
  await saveDraft(s.id, 'writer', draft);
  expect((await sessions.get(s.id))?.draft).toEqual(draft);
  await expect(submit(s.id, 'writer', draft)).rejects.toThrow('INVALID_ANSWER');
  expect(await attempts.count()).toBe(0);
  const answer = ['eleven', 'nine'];
  const saved = await submit(s.id, 'writer', answer);
  expect(saved).toMatchObject({ answer, correct: true, rule: 'table-authored-variants-v1' });
  expect(await submit(s.id, 'writer', answer)).toEqual(saved);
  await expect(submit(s.id, 'writer', ['11:00', '9:00'])).rejects.toThrow('CONFLICT');
  await advance(s.id, 'writer');
  expect((await sessions.get(s.id))?.draft).toBeUndefined();
});


it('preserves teaching support through answers, advancement, sync and backup without applying it to transfer', async () => {
  const { readSyncEvents } = await import('../src/data/sync');
  const { profiles } = await import('../src/data/db');
  const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup');
  const { questions } = await import('../src/shared/content');
  const { syncEventSchema } = await import('../src/shared/sync');
  await profiles.put({ id: 'local-guest', name: 'Test', createdAt: new Date().toISOString() });
  const session = await createSession(raw); await claimSession(session.id, 'teaching');
  expect(session.assistance.teachingProvided).toBe(true);
  const items = questions(session.lesson);
  for (const [index, { question, material }] of items.entries()) {
    if (!('options' in question)) throw new Error('Expected isolated choice fixture');
    const saved = await submit(session.id, 'teaching', question.answer);
    expect(saved.assistance.teachingProvided).toBe(material.rootId === session.lesson.materials[0].rootId ? true : undefined);
    expect(await submit(session.id, 'teaching', question.answer)).toEqual(saved);
    if (index < items.length - 1) await advance(session.id, 'teaching');
  }
  const events = (await readSyncEvents('local-guest')).filter(event => event.type === 'completion');
  expect(events).toHaveLength(items.length);
  for (const event of events) {
    expect(event.payload.assistance.teachingProvided).toBe(event.payload.rootId === session.lesson.materials[0].rootId ? true : undefined);
    expect(syncEventSchema.safeParse({ ...event, payload: { ...event.payload, assistance: { ...event.payload.assistance, teachingProvided: 'true' } } }).success).toBe(false);
  }
  const restored = await importBackup(await inspectBackup(await exportBackup('local-guest')));
  const saved = await attempts.where('profileId').equals(restored).toArray();
  expect(saved).toHaveLength(items.length);
  for (const answer of saved) expect(answer.assistance.teachingProvided).toBe(answer.rootId === session.lesson.materials[0].rootId ? true : undefined);
  expect((await readSyncEvents(restored)).filter(event => event.type === 'completion')).toEqual(events);
});


it('does not rewrite legacy completion payloads when teaching support is inferred from the lesson', async () => {
  const { bootstrapSyncEvents, profiles, syncEvents } = await import('../src/data/db');
  const { readSyncEvents } = await import('../src/data/sync');
  const { questions } = await import('../src/shared/content');
  await profiles.put({ id: 'local-guest', name: 'Legacy test', createdAt: new Date().toISOString() });
  const session = await createSession(raw); await claimSession(session.id, 'legacy');
  const items = questions(session.lesson);
  for (const [index, { question }] of items.entries()) {
    if (!('options' in question)) throw new Error('Expected isolated choice fixture');
    await submit(session.id, 'legacy', question.answer);
    if (index < items.length - 1) await advance(session.id, 'legacy');
  }
  // Preserve immutable wire summaries when legacy rows lack optional markers.
  for (const saved of await attempts.toArray()) {
    delete saved.assistance.teachingProvided;
    await attempts.put(saved);
  }
  for (const event of await readSyncEvents('local-guest')) if (event.type === 'completion') {
    delete event.payload.assistance.teachingProvided;
    await syncEvents.put({ profileId: 'local-guest', ...event });
  }
  const original = (await readSyncEvents('local-guest')).filter(event => event.type === 'completion');
  await bootstrapSyncEvents('local-guest');
  expect((await readSyncEvents('local-guest')).filter(event => event.type === 'completion')).toEqual(original);
});
