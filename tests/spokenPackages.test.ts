import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { afterEach, expect, it, vi } from 'vitest';
import { inspectCommunityPack } from '../src/data/communityPack';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { spokenConditionPrompt } from '../src/core/spokenCondition';
import { corpusOperation } from '../src/core/corpusPractice';
import { lessonPackageIds, lessonSchema, materialPackageId, score } from '../src/shared/content';
import { communityLessonReady, communityCacheName, communityMarker } from '../src/data/communityInstall';
import { communityPacks, createSession, profiles, sessions } from '../src/data/db';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';

afterEach(() => vi.unstubAllGlobals());
async function actualPractice() {
  const primary = await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-010'));
  const application = await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-005'));
  const lesson = spokenCorpusLesson(primary.spoken!, new Set(), 0, 91, 'C2', [], 'evidence', [], `evidence:${spokenConditionPrompt}`, [application.spoken!])!;
  return { primary, application, lesson };
}

it('retains two actual package owners and the taught operation, rejecting forged ownership and exposed application', async () => {
  const { primary, application, lesson } = await actualPractice();
  expect(lessonPackageIds(lesson)).toEqual([primary.hash, application.hash]);
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  for (const material of lesson.materials) {
    expect(material.audio!.src).toContain(`/community-${materialPackageId(lesson, material)}/`);
    expect(corpusOperation(material.questions[0])).toBe(`evidence:${spokenConditionPrompt}`);
    const question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected condition evidence');
    expect(score(question, question.accepted[0]).correct).toBe(true);
    expect(score(question, (question.accepted[0] + 1) % 3).correct).toBe(false);
    expect(score(material.questions[1], 'My interpretation.').correct).toBeNull();
  }
  const forged = structuredClone(lesson);
  forged.materials[1].communityPackageId = primary.hash;
  expect(lessonSchema.safeParse(forged).success).toBe(false);
  const undeclared = structuredClone(lesson);
  delete undeclared.materials[1].communityPackageId;
  expect(lessonSchema.safeParse(undeclared).success).toBe(false);
  const wrongPrimary = structuredClone(lesson);
  wrongPrimary.materials[0].communityPackageId = application.hash;
  expect(lessonSchema.safeParse(wrongPrimary).success).toBe(false);
  const approved = { ...lesson, reviewStatus: 'approved' };
  expect(lessonSchema.safeParse(approved).success).toBe(false);
  const seen = new Set([lesson.materials[1].id.slice(7)]);
  const fallback = spokenCorpusLesson(primary.spoken!, seen, 0, 91, 'C2', [], 'evidence', [], `evidence:${spokenConditionPrompt}`, [application.spoken!])!;
  expect(fallback.materials.some(material => material.id === lesson.materials[1].id)).toBe(false);
  expect(lessonPackageIds(fallback)).toEqual([primary.hash, application.hash]);
  expect([lesson.materials[1].title, fallback.materials[1].title].sort()).toEqual(['Colocation centre', 'Cookie Clicker']);
  expect(corpusOperation(fallback.materials[1].questions[0])).toBe(`evidence:${spokenConditionPrompt}`);
  seen.add(fallback.materials[1].id.slice(7));
  const exhausted = spokenCorpusLesson(primary.spoken!, seen, 0, 91, 'C2', [], 'evidence', [], `evidence:${spokenConditionPrompt}`, [application.spoken!])!;
  expect(exhausted.materials.every(material => !seen.has(material.id.slice(7)))).toBe(true);
  expect(lessonPackageIds(exhausted)).toEqual([primary.hash]);
});

it('blocks missing and corrupted second media without storing a session, and restores exact two-owner snapshots', async () => {
  const { primary, application, lesson } = await actualPractice();
  const profileId = 'multiple-source-package-test';
  await profiles.put({ id: profileId, name: 'Isolated test', createdAt: new Date().toISOString() });
  const files = new Map<string, Map<string, Response>>();
  const cacheApi = { has: async (name: string) => files.has(name), open: async (name: string) => ({ match: async (path: string) => files.get(name)?.get(path)?.clone() }) };
  vi.stubGlobal('window', { caches: cacheApi }); vi.stubGlobal('caches', cacheApi);
  for (const pack of [primary, application]) {
    await communityPacks.put({ profileId, hash: pack.hash, id: pack.id, lessons: pack.lessons, sources: pack.sources, spoken: pack.spoken, state: 'ready', installedAt: new Date().toISOString() });
    files.set(communityCacheName(pack.hash), new Map([[communityMarker(pack.hash), new Response('ready')]]));
  }
  const addAudio = (index: number) => {
    const material = lesson.materials[index], hash = materialPackageId(lesson, material)!;
    const pack = hash === primary.hash ? primary : application;
    files.get(communityCacheName(hash))!.set(material.audio!.src, new Response(new Uint8Array(pack.media[material.audio!.src.split('/').at(-1)!]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  };
  addAudio(0);
  expect(await communityLessonReady(lesson, profileId)).toBe(false);
  await expect(createSession(lesson, profileId)).rejects.toThrow('MISSING_MEDIA');
  expect(await sessions.where('profileId').equals(profileId).count()).toBe(0);
  const second = lesson.materials[1];
  files.get(communityCacheName(application.hash))!.set(second.audio!.src, new Response('corrupt', { headers: { 'Content-Type': 'audio/mpeg' } }));
  await expect(createSession(lesson, profileId)).rejects.toThrow('MISSING_MEDIA');
  addAudio(1);
  expect(await communityLessonReady(lesson, profileId)).toBe(true);
  const original = await createSession(lesson, profileId);
  const restoredProfile = await importBackup(await inspectBackup(await exportBackup(profileId)));
  const restored = await sessions.where('profileId').equals(restoredProfile).first();
  expect(restored?.lesson).toEqual(original.lesson);
  expect(restored?.contentHash).toBe(original.contentHash);
  expect(restored?.itemHashes).toEqual(original.itemHashes);
  expect(lessonPackageIds(restored!.lesson)).toEqual([primary.hash, application.hash]);
  expect(await communityPacks.where('profileId').equals(restoredProfile).count()).toBe(0);
});

it('parses a real singleton topic bank without inventing a second root, then transfers through an actual installed peer', async () => {
  const { primary, application, lesson: original } = await actualPractice();
  const root = primary.spoken!.records.find(record => record.rootId === original.materials[0].rootId)!;
  const singleton = spokenCorpusSchema.parse({ ...primary.spoken!, records: [root] });
  expect(singleton.records).toHaveLength(1);
  expect(spokenCorpusLesson(singleton, new Set(), 0, 91, 'C2', [], 'evidence', [], `evidence:${spokenConditionPrompt}`)).toBeUndefined();
  const lesson = spokenCorpusLesson(singleton, new Set(), 0, 91, 'C2', [], 'evidence', [], `evidence:${spokenConditionPrompt}`, [application.spoken!])!;
  expect(lesson).toBeDefined();
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  expect(lesson.materials[0].rootId).toBe(root.rootId);
  expect(lessonPackageIds(lesson)).toEqual([primary.hash, application.hash]);
  expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === `evidence:${spokenConditionPrompt}`)).toBe(true);
});

it('requires both FLEURS transcript and recording licences with the source attribution notice', async () => {
  const { readFileSync } = await import('node:fs');
  const { sourcePacks } = await import('../src/data/sourcePacks');
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import('fflate');
  const entry = sourcePacks.find(pack => pack.skill === 'listening' && pack.sourceFamilies.includes('fleurs'))!;
  const bytes = new Uint8Array(readFileSync('public' + entry.path));
  const original = await inspectCommunityPack(bytes);
  expect(original.spoken!.records.some(record => record.id.startsWith('fleurs-'))).toBe(true);
  for (const name of ['fleurs-CC-BY-4.0.txt', 'fleurs-CC-BY-SA-4.0.txt', 'fleurs-NOTICE.md']) {
    const files = unzipSync(bytes);
    expect(files[name].length).toBeGreaterThan(0);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    delete files[name]; delete manifest.files[name];
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    await expect(inspectCommunityPack(zipSync(files))).rejects.toThrow();
  }
});

it('saves and restores a real newly installed sentence practice and test entirely offline', async () => {
  const { readFileSync } = await import('node:fs');
  const { sourcePacks } = await import('../src/data/sourcePacks');
  const { asTestLesson, questions } = await import('../src/shared/content');
  const { claimSession, submit, recordPlayback, advance, attempts } = await import('../src/data/db');
  const entries = sourcePacks.filter(pack => pack.skill === 'listening' && pack.sourceFamilies.includes('fleurs'));
  const packs = await Promise.all(entries.map(entry => inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)))));
  const primary = packs[0], peers = packs.slice(1).map(pack => pack.spoken!);
  const practice = spokenCorpusLesson(primary.spoken!, new Set(), 0, 91, 'B2', [], 'completion', [], undefined, peers)!;
  expect(practice).toBeDefined();
  const profileId = 'continued-sentence-offline-regression';
  await profiles.put({ id: profileId, name: 'Isolated regression', createdAt: new Date().toISOString() });
  const files = new Map<string, Map<string, Response>>();
  const caches = { has: async (name: string) => files.has(name), open: async (name: string) => ({ match: async (path: string) => files.get(name)?.get(path)?.clone() }) };
  vi.stubGlobal('window', { caches }); vi.stubGlobal('caches', caches);
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  for (const pack of packs.filter(pack => lessonPackageIds(practice).includes(pack.hash))) {
    await communityPacks.put({ profileId, hash: pack.hash, id: pack.id, lessons: [], sources: pack.sources, spoken: pack.spoken, state: 'ready', installedAt: new Date().toISOString() });
    const cache = new Map<string, Response>([[communityMarker(pack.hash), new Response('ready')]]);
    for (const material of practice.materials.filter(material => materialPackageId(practice, material) === pack.hash)) cache.set(material.audio!.src, new Response(new Uint8Array(pack.media[material.audio!.src.split('/').at(-1)!])));
    files.set(communityCacheName(pack.hash), cache);
  }
  for (const lesson of [practice, asTestLesson(practice)]) {
    const session = await createSession(lesson, profileId); await claimSession(session.id, 'regression');
    for (const { material, question } of questions(lesson)) {
      const answer = 'criteria' in question ? 'An interpretation supported by the recording.' : 'kind' in question && question.kind === 'completion' ? question.accepted[0] : (() => { throw new Error('Expected source completion'); })();
      if (question.id === material.questions[0].id) await expect(submit(session.id, 'regression', answer)).rejects.toThrow('NO_AUDIO');
      await recordPlayback(session.id, 'regression', question.id, false); await recordPlayback(session.id, 'regression', question.id, true);
      const saved = await submit(session.id, 'regression', answer); expect(saved.correct).toBe('criteria' in question ? null : true);
      expect(await attempts.get(saved.id)).toEqual(saved); await advance(session.id, 'regression');
    }
    expect((await sessions.get(session.id))!.status).toBe('completed');
  }
  const restoredId = await importBackup(await inspectBackup(await exportBackup(profileId)));
  const restored = await sessions.where('profileId').equals(restoredId).toArray();
  expect(restored.map(session => session.lesson.mode ?? 'practice').sort()).toEqual(['practice', 'test']);
  expect(restored.every(session => session.status === 'completed')).toBe(true);
  expect(await attempts.where('profileId').equals(restoredId).count()).toBe(questions(practice).length * 2);
  expect(fetch).not.toHaveBeenCalled();
});
