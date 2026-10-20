import { travelVariant } from './fixtures/variants';
import { beforeEach, describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import raw from './fixtures/content/a1-reading.json';
import matching from './fixtures/content/a1-matching-reading.json';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { attempts, claimSession, createSession, db, exposures, feedbackNotes, markExposure, profiles, saveDraft, saveFeedbackNote, sessions, settings, submit } from '../src/data/db';
import { gutenbergTerms } from '../src/shared/sourceLicence';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

describe('local ZIP backup', () => {
  it.each(['x'.repeat(91), `${'x'.repeat(79)}𝒜`, '𝒜'.repeat(46)])('exports an older overlong profile label without altering its records or weakening imports', async name => {
    const original = await createSession(raw);
    await claimSession(original.id, 'tab', Date.now(), undefined, true);
    const answer = await submit(original.id, 'tab', 1);
    await profiles.put({ id: 'local-guest', name, createdAt: new Date().toISOString() });
    const zip = await exportBackup('local-guest');
    const inspected = await inspectBackup(zip);
    expect(inspected.summary.profileName.length).toBeLessThanOrEqual(80);
    expect(new TextDecoder().decode(new TextEncoder().encode(inspected.summary.profileName))).toBe(inspected.summary.profileName);
    expect(inspected.records.sessions[0].lesson).toEqual(original.lesson);
    expect(inspected.records.attempts).toEqual([answer]);
    expect((await profiles.get('local-guest'))?.name).toBe(name);
    const files = unzipSync(zip);
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    manifest.profileName = 'x'.repeat(81);
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow();
  });

  it('includes complete Gutenberg notice/terms only with credited session content and retains them after restore', async () => {
    const empty = unzipSync(await exportBackup('local-guest'));
    expect(empty['gutenberg-license.txt']).toBeUndefined();
    const credited = { ...raw, id: 'gutenberg-backup-fixture', materials: raw.materials.map(material => ({ ...material, credit: { attribution: 'Synthetic backup provenance fixture', license: 'Project Gutenberg terms', sourceUrl: 'https://www.gutenberg.org/ebooks/1661' } })) };
    const session = await createSession(credited);
    await claimSession(session.id, 'tab', Date.now(), undefined, true);
    await submit(session.id, 'tab', 1);
    const files = unzipSync(await exportBackup('local-guest'));
    expect(new TextDecoder().decode(files['gutenberg-license.txt'])).toBe(gutenbergTerms);
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    expect(manifest.version).toBe(5);
    expect(manifest.files['gutenberg-license.txt']).toMatchObject({ bytes: new TextEncoder().encode(gutenbergTerms).length, count: 1 });
    const inspection = await inspectBackup(zipSync(files));
    const restoredId = await importBackup(inspection);
    expect((await sessions.where('profileId').equals(restoredId).first())?.lesson).toEqual(session.lesson);
    expect(await attempts.where('profileId').equals(restoredId).count()).toBe(1);
    expect(new TextDecoder().decode(unzipSync(await exportBackup(restoredId))['gutenberg-license.txt'])).toBe(gutenbergTerms);
  });
  it('requires complete terms when a current backup contains Gutenberg credits', async () => {
    await createSession({ ...raw, materials: raw.materials.map(material => ({ ...material, credit: { attribution: 'Synthetic fixture', license: 'Project Gutenberg terms', sourceUrl: 'https://www.gutenberg.org/ebooks/1661' } })) });
    const files = unzipSync(await exportBackup('local-guest'));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    delete files['gutenberg-license.txt']; delete manifest.files['gutenberg-license.txt'];
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_INTEGRITY');
    expect(await sessions.count()).toBe(1);
  });
  it('rejects forged terms metadata/content and unexpected archive names without changing records', async () => {
    const session = await createSession(raw);
    const original = unzipSync(await exportBackup('local-guest'));
    const encoder = new TextEncoder();
    const termsFile = 'gutenberg-license.txt';
    for (const mode of ['hash', 'bytes', 'count', 'text', 'truncated', 'control', 'oversize', 'missing', 'unlisted', 'name', 'old-version']) {
      const files: Record<string, Uint8Array> = { ...original, [termsFile]: encoder.encode(gutenbergTerms) };
      const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
      if (mode === 'text') files[termsFile] = encoder.encode('<script>untrusted</script>');
      if (mode === 'truncated') files[termsFile] = encoder.encode(gutenbergTerms.slice(0, gutenbergTerms.indexOf('Section 5.')));
      if (mode === 'control') files[termsFile] = encoder.encode(gutenbergTerms + '\0');
      if (mode === 'oversize') files[termsFile] = encoder.encode(gutenbergTerms + 'x'.repeat(64 * 1024));
      manifest.files[termsFile] = { bytes: files[termsFile].length, count: 1, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(files[termsFile]))), value => value.toString(16).padStart(2, '0')).join('') };
      if (mode === 'hash') manifest.files[termsFile].sha256 = '0'.repeat(64);
      if (mode === 'bytes') manifest.files[termsFile].bytes++;
      if (mode === 'count') manifest.files[termsFile].count = 2;
      if (mode === 'missing') delete files[termsFile];
      if (mode === 'unlisted') delete manifest.files[termsFile];
      if (mode === 'name') { files['../gutenberg-license.txt'] = files[termsFile]; delete files[termsFile]; }
      if (mode === 'old-version') manifest.version = 4;
      files['manifest.json'] = encoder.encode(JSON.stringify(manifest));
      await expect(inspectBackup(zipSync(files)), mode).rejects.toThrow();
      expect(await sessions.count()).toBe(1);
      expect(await sessions.get(session.id)).toBeDefined();
    }
  });
  it('retains generated snapshots and rejects concurrent duplicate instances atomically', async () => {
    const lesson = travelVariant(123).lesson!;
    const results = await Promise.allSettled([createSession(lesson), createSession(lesson)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await sessions.count()).toBe(1);
    const original = (await sessions.toArray())[0];
    const inspected = await inspectBackup(await exportBackup('local-guest'));
    const restoredId = await importBackup(inspected);
    const restored = await sessions.where('profileId').equals(restoredId).first();
    expect(restored?.lesson).toEqual(lesson);
    expect(restored?.contentHash).toBe(original.contentHash);
    expect(restored?.ruleHashes).toEqual(original.ruleHashes);
    expect(restored?.itemHashes).toEqual(original.itemHashes);
    expect(Object.keys(restored?.itemHashes ?? {})).toHaveLength(4);
    expect(restored?.ruleHashes?.generator).toMatch(/^[a-f0-9]{64}$/);
    expect(restored?.ruleHashes?.scoring).toMatch(/^[a-f0-9]{64}$/);
    expect(restored?.lesson.generation).toEqual({ generator: 'travel-v1', seed: 123, index: 123 });
  });
  it('restores an incomplete matching draft and its later scored answer', async () => {
    const session = await createSession(matching);
    await claimSession(session.id, 'tab', Date.now(), undefined, true);
    await saveDraft(session.id, 'tab', ['library', '']);
    const draft = await inspectBackup(await exportBackup('local-guest'));
    expect(draft.records.sessions[0].draft).toEqual(['library', '']);
    const restoredId = await importBackup(draft);
    expect((await sessions.where('profileId').equals(restoredId).first())?.draft).toEqual(['library', '']);
    await submit(session.id, 'tab', ['library', 'park']);
    const saved = await inspectBackup(await exportBackup('local-guest'));
    expect(saved.records.attempts[0]).toMatchObject({ answer: ['library', 'park'], correct: true, rule: 'matching-authored-pairs-v1' });
  });
  it('restores verified records into a separate profile while preserving the original', async () => {
    const original = await createSession(raw);
    await claimSession(original.id, 'tab', Date.now(), undefined, true);
    await markExposure(original);
    const answer = await submit(original.id, 'tab', 1);
    await saveFeedbackNote({ id: crypto.randomUUID(), profileId: 'local-guest', attemptId: answer.id, kind: 'text', content: 'Review the location clue.', unknownReferences: false, createdAt: new Date().toISOString() });
    const zip = await exportBackup('local-guest');
    const inspected = await inspectBackup(zip);
    expect(inspected.summary).toMatchObject({ sessions: 1, attempts: 1, exposures: 1, feedbackNotes: 1 });
    expect(inspected.records.sessions[0].owner).toBeUndefined();
    expect(inspected.records.sessions[0].lockMode).toBeUndefined();
    const importedId = await importBackup(inspected);
    const restored = await sessions.where('profileId').equals(importedId).first();
    expect(restored?.id).not.toBe(original.id);
    expect(restored?.lesson).toEqual(original.lesson);
    expect(restored?.leaseUntil).toBe(0);
    expect(await attempts.where('profileId').equals(importedId).count()).toBe(1);
    expect(await exposures.where('profileId').equals(importedId).count()).toBe(1);
    const exposure = await exposures.where('profileId').equals(importedId).first();
    expect(exposure?.contacts?.[0].sessionId).toBe(restored?.id);
    expect(exposure?.contacts?.[0].questionId).toBe(original.lesson.materials[0].questions[0].id);
    expect(await feedbackNotes.where('profileId').equals(importedId).count()).toBe(1);
    expect((await feedbackNotes.where('profileId').equals(importedId).first())?.attemptId).toBe((await attempts.where('profileId').equals(importedId).first())?.id);
    expect(await sessions.get(original.id)).toMatchObject({ profileId: 'local-guest' });
    expect((await settings.get('activeProfile'))?.value).toBe(importedId);
  });
  it('rejects corrupt bytes, forged sizes and altered manifest without changing local records', async () => {
    const original = await createSession(raw);
    const zip = await exportBackup('local-guest');
    const corrupt = new Uint8Array(zip); corrupt[0] ^= 0xff;
    await expect(inspectBackup(corrupt)).rejects.toThrow();
    const forged = new Uint8Array(zip);
    const view = new DataView(forged.buffer);
    const central = forged.findIndex((_, i) => i + 4 < forged.length && view.getUint32(i, true) === 0x02014b50);
    view.setUint32(central + 24, 0xffffffff, true);
    await expect(inspectBackup(forged)).rejects.toThrow('BACKUP_ZIP');
    const link = new Uint8Array(zip);
    const linkView = new DataView(link.buffer);
    linkView.setUint32(central + 38, 0xa0000000, true);
    await expect(inspectBackup(link)).rejects.toThrow('BACKUP_ZIP');
    const files = unzipSync(zip);
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    manifest.files['sessions.json'].sha256 = '0'.repeat(64);
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_INTEGRITY');
    const traversal = { ...unzipSync(zip) };
    traversal['../sessions.json'] = traversal['sessions.json'];
    delete traversal['sessions.json'];
    await expect(inspectBackup(zipSync(traversal))).rejects.toThrow('BACKUP_ZIP');
    expect(await sessions.count()).toBe(1);
    expect(await sessions.get(original.id)).toBeDefined();
  });
  it('stops a ZIP whose actual expansion exceeds the limit despite forged size headers', async () => {
    const original = await createSession(raw);
    const bomb = zipSync({
      'manifest.json': new TextEncoder().encode('{}'),
      'sessions.json': new Uint8Array(65 * 1024 * 1024),
      'attempts.json': new TextEncoder().encode('[]'),
      'exposures.json': new TextEncoder().encode('[]'),
      'memories.json': new TextEncoder().encode('[]'),
      'memoryReviews.json': new TextEncoder().encode('[]'),
      'feedbackNotes.json': new TextEncoder().encode('[]'),
      'syncEvents.json': new TextEncoder().encode('[]'),
      'syncBatches.json': new TextEncoder().encode('[]'),
      'syncClocks.json': new TextEncoder().encode('[]'),
      'syncConflicts.json': new TextEncoder().encode('[]'),
    }, { level: 9 });
    const view = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
    const central = bomb.findIndex((_, i) => i + 46 < bomb.length && view.getUint32(i, true) === 0x02014b50 && new TextDecoder().decode(bomb.subarray(i + 46, i + 46 + view.getUint16(i + 28, true))) === 'sessions.json');
    view.setUint32(view.getUint32(central + 42, true) + 22, 1024, true);
    view.setUint32(central + 24, 1024, true);
    await expect(inspectBackup(bomb)).rejects.toThrow('BACKUP_SIZE');
    expect(await sessions.get(original.id)).toBeDefined();
  });
  it('rolls back profile creation and every record if the import transaction fails', async () => {
    const original = await createSession(raw);
    await claimSession(original.id, 'tab');
    await submit(original.id, 'tab', 1);
    const inspected = await inspectBackup(await exportBackup('local-guest'));
    const fail = () => { throw new Error('disk failed'); };
    attempts.hook('creating', fail);
    try { await expect(importBackup(inspected)).rejects.toThrow('disk failed'); }
    finally { attempts.hook('creating').unsubscribe(fail); }
    expect(await sessions.count()).toBe(1);
    expect(await attempts.count()).toBe(1);
    expect(await profiles.count()).toBe(0);
    expect(await settings.get('activeProfile')).toBeUndefined();
  });
  it('rejects internally consistent hashes when answer references do not match the snapshot', async () => {
    const session = await createSession(raw);
    await claimSession(session.id, 'tab');
    await submit(session.id, 'tab', 1);
    const files = unzipSync(await exportBackup('local-guest'));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    const saved = JSON.parse(new TextDecoder().decode(files['attempts.json']));
    saved[0].rootId = 'unrelated-root';
    files['attempts.json'] = new TextEncoder().encode(JSON.stringify(saved));
    manifest.files['attempts.json'].bytes = files['attempts.json'].length;
    manifest.files['attempts.json'].sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', files['attempts.json'])), value => value.toString(16).padStart(2, '0')).join('');
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_REFERENCE');
  });
  it('rejects a forged ended status on a learning session', async () => {
    await createSession(raw);
    const files = unzipSync(await exportBackup('local-guest'));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    const saved = JSON.parse(new TextDecoder().decode(files['sessions.json']));
    saved[0].status = 'ended';
    files['sessions.json'] = new TextEncoder().encode(JSON.stringify(saved));
    manifest.files['sessions.json'].bytes = files['sessions.json'].length;
    manifest.files['sessions.json'].sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', files['sessions.json'])), value => value.toString(16).padStart(2, '0')).join('');
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_REFERENCE');
  });
  it.each([1, 2, 3, 4])('rejects obsolete backup version %i without changing records', async version => {
    const session = await createSession(raw);
    const files = unzipSync(await exportBackup('local-guest'));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    manifest.version = version;
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow();
    expect(await sessions.get(session.id)).toEqual(session);
  });
});

it('reopens the current database without losing snapshots, drafts, answers or settings', async () => {
  const session = await createSession(raw);
  await claimSession(session.id, 'tab');
  await submit(session.id, 'tab', 1);
  await profiles.put({ id: 'local-guest', name: 'Local profile', createdAt: new Date().toISOString() });
  await settings.put({ key: 'locale', value: 'en' });
  const savedSession = await sessions.get(session.id);
  const savedAnswers = await attempts.toArray();
  const schemas = db.tables.map(table => ({ name: table.name, key: table.schema.primKey.src, indexes: table.schema.indexes.map(index => index.src) }));
  expect(schemas).toHaveLength(16);
  expect(db.verno).toBe(8);
  db.close();
  await db.open();
  expect(db.tables.map(table => ({ name: table.name, key: table.schema.primKey.src, indexes: table.schema.indexes.map(index => index.src) }))).toEqual(schemas);
  expect(await sessions.get(session.id)).toEqual(savedSession);
  expect(await attempts.toArray()).toEqual(savedAnswers);
  expect((await profiles.get('local-guest'))?.name).toBe('Local profile');
  expect((await settings.get('locale'))?.value).toBe('en');
});
