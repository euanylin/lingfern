import { beforeEach, expect, it } from 'vitest';
import { db, memories, memoryReviews, profiles, settings, savePreferences, bootstrapSyncEvents } from '../src/data/db';
import { memoryConfigId, enableReview, rateMemory, removeSense, saveSense } from '../src/data/memory';
import { appendSyncEvent, readSyncEvents, pendingSyncBatch } from '../src/data/sync';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('captures actual bookmark/remove/re-save and opted-in original review metadata without private text', async () => {
  await saveSense('p', 'sense', 'private word', 'private definition');
  await saveSense('p', 'sense', 'private word', 'private definition');
  await enableReview('p', 'sense');
  await enableReview('p', 'sense');
  const id = crypto.randomUUID(), occurredAt = new Date().toISOString();
  await rateMemory('p', 'sense', 3, id, occurredAt);
  await rateMemory('p', 'sense', 3, id, occurredAt);
  const events = await readSyncEvents('p');
  expect(events.map(event => event.type)).toEqual(['saved_item', 'saved_item', 'memory_review']);
  expect(events[2]).toMatchObject({ id, occurredAt, payload: { memoryId: 'sense', rating: 3 } });
  const batch = (await pendingSyncBatch('p'))!;
  expect(JSON.stringify(batch)).not.toContain('private');
  expect(JSON.stringify(batch)).not.toContain('card');
  await removeSense('p', 'sense');
  await removeSense('p', 'sense');
  await saveSense('p', 'sense', 'word', 'definition');
  expect((await readSyncEvents('p')).filter(event => event.type === 'saved_item').map(event => event.payload.saved)).toEqual([true, true, false, true]);
});

it('commits preferences and locale with their matching events atomically', async () => {
  await profiles.add({ id: 'p', name: 'Profile', createdAt: new Date().toISOString() });
  const preferences = { interests: ['travel'], step: 4, completed: true };
  await savePreferences('p', preferences, 'zh-Hant');
  expect((await readSyncEvents('p')).map(event => event.type)).toEqual(['preferences', 'setting']);
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  db.table('syncEvents').hook('creating', fail);
  try {
    await expect(savePreferences('p', { interests: [], step: 0, completed: false }, 'en')).rejects.toThrow('STORAGE_FAILURE');
    expect((await profiles.get('p'))?.preferences).toEqual(preferences);
    expect((await settings.get('profile:p:locale'))?.value).toBe('zh-Hant');
    expect(await readSyncEvents('p')).toHaveLength(2);
  } finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
});

it('rolls back bookmark and review writes when the matching event cannot be stored', async () => {
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  db.table('syncEvents').hook('creating', fail);
  try {
    await expect(saveSense('p', 'sense', 'word', 'definition')).rejects.toThrow('STORAGE_FAILURE');
    expect(await memories.count()).toBe(0);
  } finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
  await saveSense('p', 'sense', 'word', 'definition');
  await enableReview('p', 'sense');
  const before = await memories.get(['p', 'sense']);
  db.table('syncEvents').hook('creating', fail);
  try {
    await expect(rateMemory('p', 'sense', 3)).rejects.toThrow('STORAGE_FAILURE');
    expect(await memoryReviews.count()).toBe(0);
    expect(await memories.get(['p', 'sense'])).toEqual(before);
  } finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
});

it('captures completed summaries and started-check contacts without unfinished answers', async () => {
  const { createSession, claimSession, submit, advance, beginCheck } = await import('../src/data/db');
  const { default: learning } = await import('./fixtures/content/a1-reading.json');
  const { default: check } = await import('./fixtures/content/a1-check-reading.json');
  const session = await createSession(learning, 'p'); await claimSession(session.id, 'owner');
  for (const answer of [1, 2, 1]) { await submit(session.id, 'owner', answer); await advance(session.id, 'owner'); }
  expect(await readSyncEvents('p')).toHaveLength(0);
  await submit(session.id, 'owner', 2);
  await submit(session.id, 'owner', 2);
  const events = await readSyncEvents('p');
  expect(events.filter(event => event.type === 'completion')).toHaveLength(4);
  expect(events.filter(event => event.type === 'exposure')).toHaveLength(4);
  expect(JSON.stringify(events)).not.toContain('"answer"');
  expect(JSON.stringify(events)).not.toContain('"blocks"');
  const checked = await createSession(check, 'p'); await claimSession(checked.id, 'owner'); await beginCheck(checked.id, 'owner');
  const question = checked.lesson.materials[0].questions[0];
  if (!('options' in question)) throw new Error('Expected choices');
  await submit(checked.id, 'owner', question.answer);
  const current = await readSyncEvents('p');
  expect(current.filter(event => event.type === 'completion')).toEqual(events.filter(event => event.type === 'completion'));
  expect(current.filter(event => event.type === 'exposure')).toHaveLength(5);
  expect(JSON.stringify(current.filter(event => event.type === 'exposure'))).not.toMatch(/"(?:answer|draft|blocks|correct)":/);
});

it('keeps long imported sense IDs locally and sends a deterministic bounded reference', async () => {
  const id = 'sense-'.repeat(40);
  await saveSense('p', id, 'word', 'definition');
  await removeSense('p', id);
  const events = await readSyncEvents('p');
  const references = events.filter(event => event.type === 'saved_item').map(event => event.payload.memoryId);
  expect(references[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(references[1]).toBe(references[0]);
  expect(await memories.get(['p', id])).toBeUndefined();
});

it('keeps the last answer incomplete if its completion events cannot commit', async () => {
  const { createSession, claimSession, submit, advance, sessions, attempts } = await import('../src/data/db');
  const { default: learning } = await import('./fixtures/content/a1-reading.json');
  const session = await createSession(learning, 'p'); await claimSession(session.id, 'owner');
  for (const answer of [1, 2, 1]) { await submit(session.id, 'owner', answer); await advance(session.id, 'owner'); }
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  db.table('syncEvents').hook('creating', fail);
  try {
    await expect(submit(session.id, 'owner', 2)).rejects.toThrow('STORAGE_FAILURE');
    expect(await attempts.count()).toBe(3);
    expect((await sessions.get(session.id))?.status).toBe('active');
    expect(await readSyncEvents('p')).toHaveLength(0);
  } finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
  await submit(session.id, 'owner', 2);
  expect((await sessions.get(session.id))?.status).toBe('completed');
  expect(await readSyncEvents('p')).toHaveLength(8);
});

it('captures existing originals once and preserves review identities across a restored device', async () => {
  const { createSession, claimSession, submit, advance, beginCheck, markExposure, sessions, attempts, exposures } = await import('../src/data/db');
  const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup');
  const { default: learning } = await import('./fixtures/content/a1-reading.json');
  const { default: check } = await import('./fixtures/content/a1-check-reading.json');
  const id = 'local-guest';
  await profiles.put({ id, name: 'Original', createdAt: '2020-01-01T00:00:00.000Z', preferences: { interests: ['travel'], step: 4, completed: true } });
  const completed = await createSession(learning, id); await claimSession(completed.id, 'owner');
  for (const answer of [1, 2, 1]) { await submit(completed.id, 'owner', answer); await advance(completed.id, 'owner'); }
  await submit(completed.id, 'owner', 2);
  const unfinished = await createSession(check, id); await claimSession(unfinished.id, 'owner'); await beginCheck(unfinished.id, 'owner');
  const practice = await createSession(learning, id); await claimSession(practice.id, 'owner'); await markExposure(practice);
  await db.table('syncEvents').clear(); await db.table('syncClocks').clear();
  const reviewId = crypto.randomUUID();
  await memories.put({ profileId: id, memoryId: 'sense', term: 'private term', definition: 'private definition', savedAt: '2020-01-01T00:00:00.000Z', reviewEnabled: true });
  await memoryReviews.put({ profileId: id, memoryId: 'sense', id: reviewId, rating: 3, occurredAt: '2020-01-02T00:00:00.000Z', configId: memoryConfigId, assistance: { answerRevealed: true, hintUsed: false } });
  await settings.put({ key: `profile:${id}:locale`, value: 'en' });
  const before = [await sessions.toArray(), await attempts.toArray(), await exposures.toArray(), await memories.toArray(), await memoryReviews.toArray()];
  await Promise.all([bootstrapSyncEvents(id), bootstrapSyncEvents(id)]);
  const events = await readSyncEvents(id);
  expect(events.filter(event => event.type === 'completion')).toHaveLength(4);
  expect(events.filter(event => event.type === 'exposure')).toHaveLength(6);
  expect(events.find(event => event.type === 'memory_review')).toMatchObject({ id: reviewId, occurredAt: '2020-01-02T00:00:00.000Z', payload: { rating: 3 } });
  expect(events.filter(event => event.type === 'preferences')).toHaveLength(1);
  expect(events.filter(event => event.type === 'setting')).toHaveLength(1);
  expect(events.some(event => event.type === 'exposure' && event.payload.sessionId === unfinished.id)).toBe(true);
  expect(events.some(event => event.type === 'completion' && event.payload.sessionId === unfinished.id)).toBe(false);
  expect(JSON.stringify(events)).not.toContain('private');
  expect(JSON.stringify(events)).not.toContain('"answer"');
  expect([await sessions.toArray(), await attempts.toArray(), await exposures.toArray(), await memories.toArray(), await memoryReviews.toArray()]).toEqual(before);
  const restored = await importBackup(await inspectBackup(await exportBackup(id)));
  await bootstrapSyncEvents(restored);
  expect(await readSyncEvents(restored)).toEqual(events);
  expect((await db.table('syncClocks').get(restored)).deviceId).not.toBe((await db.table('syncClocks').get(id)).deviceId);
});

it('does not resurrect tombstoned records or stale bookmarks during legacy capture', async () => {
  const { createSession, claimSession, submit, advance } = await import('../src/data/db');
  const { default: learning } = await import('./fixtures/content/a1-reading.json');
  const session = await createSession(learning, 'p'); await claimSession(session.id, 'owner');
  for (const answer of [1, 2, 1]) { await submit(session.id, 'owner', answer); await advance(session.id, 'owner'); }
  await submit(session.id, 'owner', 2);
  await db.table('syncEvents').clear(); await db.table('syncClocks').clear();
  const recordId = `${session.id}:${session.lesson.materials[0].questions[0].id}`;
  const rootId = session.lesson.materials[0].rootId;
  await appendSyncEvent('p', { type: 'deletion', payload: { target: 'record', targetId: recordId } });
  await appendSyncEvent('p', { type: 'deletion', payload: { target: 'exposure', targetId: rootId } });
  await memories.put({ profileId: 'p', memoryId: 'sense', term: 'word', definition: 'definition', savedAt: '2020-01-01T00:00:00.000Z', reviewEnabled: true });
  await memoryReviews.put({ profileId: 'p', memoryId: 'sense', id: crypto.randomUUID(), rating: 3, occurredAt: '2020-01-02T00:00:00.000Z', configId: memoryConfigId, assistance: { answerRevealed: true, hintUsed: false } });
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: false, reviewEnabled: false } });
  const before = await readSyncEvents('p');
  await bootstrapSyncEvents('p');
  const after = await readSyncEvents('p');
  for (const event of before) expect(after).toContainEqual(event);
  expect(after.filter(event => event.type === 'completion')).toHaveLength(3);
  expect(after.some(event => event.type === 'completion' && event.payload.recordId === recordId)).toBe(false);
  expect(after.some(event => event.type === 'exposure' && event.payload.rootId === rootId)).toBe(false);
  expect(after.filter(event => event.type === 'saved_item')).toHaveLength(1);
  expect(after.filter(event => event.type === 'memory_review')).toHaveLength(0);
  expect(await memories.count()).toBe(1);
  expect(await memoryReviews.count()).toBe(1);
});

it('rolls back the migration marker and all queued originals when storage fails', async () => {
  await profiles.put({ id: 'p', name: 'Original', createdAt: new Date().toISOString(), preferences: { interests: [], step: 4, completed: true } });
  await memories.put({ profileId: 'p', memoryId: 'sense', term: 'word', definition: 'definition', savedAt: '2020-01-01T00:00:00.000Z', reviewEnabled: false });
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  settings.hook('creating', fail);
  try { await expect(bootstrapSyncEvents('p')).rejects.toThrow('STORAGE_FAILURE'); }
  finally { settings.hook('creating').unsubscribe(fail); }
  expect(await readSyncEvents('p')).toEqual([]);
  expect(await db.table('syncClocks').count()).toBe(0);
  expect(await settings.get('profile:p:syncBootstrap')).toBeUndefined();
  expect(await memories.count()).toBe(1);
  await bootstrapSyncEvents('p');
  expect(await readSyncEvents('p')).toHaveLength(2);
});

it('migrates ended-check contacts once without exposing unopened checks or manufacturing results', async () => {
  const { createSession, claimSession, beginCheck, endCheck } = await import('../src/data/db');
  const { default: check } = await import('./fixtures/content/a1-check-reading.json');
  const ended = await createSession(check, 'p'); await claimSession(ended.id, 'owner'); await beginCheck(ended.id, 'owner'); await endCheck(ended.id, 'owner');
  const unopened = await createSession(check, 'p');
  await db.table('syncEvents').clear(); await db.table('syncClocks').clear();
  await bootstrapSyncEvents('p'); const events = await readSyncEvents('p');
  expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ type: 'exposure', payload: { sessionId: ended.id } });
  expect(JSON.stringify(events)).not.toContain(unopened.id);
  expect(JSON.stringify(events)).not.toMatch(/"(?:answer|draft|blocks|correct|assistance)"/);
  await bootstrapSyncEvents('p'); expect(await readSyncEvents('p')).toEqual(events);
});
