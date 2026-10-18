import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusRhetoricalFunction, rhetoricalFunctionOperation, rhetoricalFunctionPrompt } from '../src/core/corpusRhetoricalFunction';
import { corpusLesson, corpusMaterial, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { asTestLesson, lessonSchema, practiceLocale, questionSchema, score } from '../src/shared/content';
import scopes from '../content/corpus/c2-rhetorical-function-scopes.json';
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function bank() {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/c2-rhetoric-reading-contexts.zip'));
  expect(sha(bytes)).toBe('19afac36feddc1ae0911ab59759f238fe3bc48494762f50dcb26d4a8890599ab');
  const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
  return { ...pack.corpus!, records: await reviewedReading(pack.corpus!.records, 1200) };
}
it('compares specific rhetorical mechanisms and contextual effects across complete accounts and rejects every wrong option for arbitrary seeds', () => {
  for (const scope of scopes.reading) {
    expect(sha(scope.text)).toBe(scope.textSha256); expect(scope.text.split(/\s+/).length).toBeGreaterThan(500);
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const frame = corpusRhetoricalFunction(scope.text, seed)!; expect(frame).toBeDefined();
      const q = questionSchema.parse({ id: 'rhetoric-q', blockId: 'block', ...frame, additionalEvidence: frame.additionalEvidence.map(e => ({ ...e, blockId: 'block' })) });
      if ('kind' in q) throw Error('Expected choice'); expect(q.prompt.startsWith(rhetoricalFunctionPrompt + '\nA: ')).toBe(true); expect(q.prompt).toContain('\nB: ');
      for (let answer = 0; answer < 4; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      for (const invalid of [-1, 4, '1', []]) expect(() => score(q, invalid)).toThrow();
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.explanations[q.answer].en).not.toContain('borrows the specific effect');
      expect(scope.text.slice(q.evidence.start, q.evidence.end)).toBe(scope.text.slice(scope.parts[pairs[Math.floor(seed / 4) % 6][0]].start, scope.parts[pairs[Math.floor(seed / 4) % 6][0]].end));
      for (const span of q.additionalEvidence!) expect(scope.text.slice(span.start, span.end).length).toBeGreaterThan(20);
      for (const explanation of q.explanations) for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) expect(explanation[locale].length).toBeGreaterThan(25);
    }), { numRuns: 100 });
    for (const changed of [scope.text.slice(10), scope.text + scope.text, scope.text.replace('the', 'some'), scope.text + ' Another claim.']) expect(corpusRhetoricalFunction(changed, 0)).toBeUndefined();
  }
  for (const seed of [-1, .5, 0x100000000, NaN]) expect(() => corpusRhetoricalFunction(scopes.reading[0].text, seed)).toThrow('INVALID_RHETORICAL_FUNCTION');
  expect(corpusRhetoricalFunction('Would you mind opening the window?', 0)).toBeUndefined();
});
it('uses intact native paragraphs and original rights, rather than stitching the old source fragments', async () => {
  const corpus = await bank(); expect(corpus.records).toHaveLength(2);
  for (const scope of scopes.reading) {
    const source = corpus.records.find(r => r.rootId === scope.rootId)!; expect(source.sourceHash).toBe(scope.sourceHash);
    const policy = JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')).records.find((r: { rootId: string }) => r.rootId === source.rootId); expect(source.permissionReview).toBe(policy.permissionReview); expect(source.licence).toBe(policy.licence);
    expect(source.passages[0].text).toBe(scope.text); expect(source.passages[0].id).toBe(scope.textSha256);
    const raw = readFileSync(`content/corpus/raw/pg${source.id.slice(10)}.txt`, 'utf8'); expect(sha(raw)).toBe(scope.sourceHash);
    const body = raw.slice(raw.indexOf('\n', raw.indexOf('*** START OF')), raw.indexOf('*** END OF')).replace(/\r/g, '').normalize('NFC').split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
    expect(sha(body)).toBe(scope.nativeScope.canonicalSha256); expect(body.slice(scope.nativeScope.start, scope.nativeScope.end)).toBe(scope.text);
    expect(body.slice(scope.nativeScope.start - 2, scope.nativeScope.start)).toBe('\n\n'); expect(body.slice(scope.nativeScope.end, scope.nativeScope.end + 2)).toBe('\n\n');
  }
});
it('pairs the same goal on independent originals, provides the shared three optional hints then none, and preserves the complete Test snapshot', async () => {
  const corpus = await bank(); const lesson = corpusLesson(corpus, new Set(), 0, 1200, 'C2', [], 'choice', [], rhetoricalFunctionOperation)!;
  expect(lesson).toBeDefined(); lessonSchema.parse(lesson); expect(lesson.goalId).toBe('rhetorical-function-in-context');
  expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
  expect(lesson.materials.map(m => corpusOperation(m.questions[0]))).toEqual([rhetoricalFunctionOperation, rhetoricalFunctionOperation]);
  expect(lesson.materials[0].questions[0].hints).toHaveLength(3); expect(lesson.materials[1].questions[0].hints).toBeUndefined();
  for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) { expect(practiceLocale(lesson, locale)).toBe('en'); for (const field of ['goal', 'teaching', 'workedExample', 'nextStep'] as const) expect(lesson[field]?.[locale].length).toBeGreaterThan(25); }
  const test = asTestLesson(lesson); expect(test.mode).toBe('test'); expect(test.materials).toEqual(lesson.materials.map(m => ({ ...m, questions: m.questions.map(q => { const copy = { ...q }; delete copy.hints; return copy; }) }))); for (const m of test.materials) expect(m.questions[0].hints).toBeUndefined(); expect(test.generation).toEqual(lesson.generation);
  for (const m of lesson.materials) expect(lesson.workedExample!.en).not.toContain(m.blocks[0].text.slice(0, 40));
});
it('fails closed for unavailable independent applications, changed source identity, insufficient context, budgets, seen roots and wrong levels', async () => {
  const corpus = await bank(); const before = structuredClone(corpus); const generate = (c = corpus, seen = new Set<string>(), max = 1200, point: 'C1' | 'B2' | 'C2' = 'C2') => corpusLesson(c, seen, 0, max, point, [], 'choice', [], rhetoricalFunctionOperation);
  expect(generate({ ...corpus, records: [corpus.records[0]] })).toBeUndefined(); expect(generate(corpus, new Set(), 700)).toBeUndefined();
  for (const point of ['B2', 'C1'] as const) expect(generate(corpus, new Set(), 1200, point)).toBeUndefined();
  for (const source of corpus.records) { expect(generate(corpus, new Set([source.passages[0].id]))).toBeUndefined(); for (const field of ['sourceHash', 'rootId', 'attribution', 'licence', 'originalUrl'] as const) { const bad = structuredClone(source); bad[field] = 'Changed'; expect(corpusMaterial({ source: bad, passage: bad.passages[0] }, 0, 'C2', 'choice', rhetoricalFunctionOperation)).toBeUndefined(); } }
  const duplicate = structuredClone(corpus); duplicate.records[1] = { ...duplicate.records[0], id: 'gutenberg-1' }; expect(() => corpusSchema.parse(duplicate)).toThrow(); expect(corpus).toEqual(before);
});
it('saves each answer transactionally and restores exact source/assistance/scoring snapshots into another isolated profile', async () => {
  const { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } = await import('../src/data/db');
  const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup'); await Promise.all(db.tables.map(t => t.clear()));
  try { const lesson = corpusLesson(await bank(), new Set(), 0, 1200, 'C2', [], 'choice', [], rhetoricalFunctionOperation)!;
    for (const snapshot of [lesson, asTestLesson(lesson)]) { const profileId = `rhetoric-${snapshot.mode ?? 'practice'}`; const created = await createSession(snapshot, profileId); let current: import('../src/data/db').Session = await claimSession(created.id, 'owner');
      for (const m of snapshot.materials) { await markExposure(current); const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); const result = await submit(created.id, 'owner', q.answer); expect(result.correct).toBe(true); expect((await attempts.get(result.id))!.answer).toBe(q.answer); current = await advance(created.id, 'owner'); }
      expect(current.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profileId)); expect(backup.records.sessions[0].lesson).toEqual(snapshot); const restored = await importBackup(backup); expect((await sessions.where('profileId').equals(restored).toArray())[0].lesson).toEqual(snapshot); expect(await attempts.where('profileId').equals(restored).count()).toBe(2);
    }
  } finally { await Promise.all(db.tables.map(t => t.clear())); }
});

const listeningInputs = [
  ['tests/fixtures/c2-rhetoric-kennedy-inaugural.zip', '65069b630c5acb89beded7d8c8cfc3d0e5a9a18e4d80d17e98c41b2ac1c3867b'],
  ['tests/fixtures/c2-rhetoric-eisenhower-farewell.zip', '0075a080abb54fda7d80d1f048734a43ed8a1779bb76d55cc74bed85bf8bff9d'],
];
async function heardBanks() {
  return Promise.all(listeningInputs.map(async ([path, hash]) => {
    const bytes = new Uint8Array(readFileSync(path)); expect(sha(bytes)).toBe(hash); const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
    const { reviewedExcerpts } = await import('../src/data/corpus');
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await reviewedExcerpts(r, r.clips) }))) };
  }));
}
it('retains specific rhetorical effects in source-bound complete listening contexts', async () => {
  const { spokenCorpusLesson } = await import('../src/core/spokenCorpus');
  const { qualifiedLongSeconds } = await import('../src/core/spokenLongAdmission'); const banks = await heardBanks(); expect(banks.every(b => b.records[0].clips.length === 1)).toBe(true);
  expect(qualifiedLongSeconds(banks, 'C2', 91)).toBe(210); expect(qualifiedLongSeconds(banks, 'C2', 60)).toBe(60);
  expect(qualifiedLongSeconds(banks, 'B2', 91)).toBe(91); expect(qualifiedLongSeconds(banks, 'C1', 91)).toBe(91);
  expect(qualifiedLongSeconds([banks[0]], 'C2', 91)).toBe(91);
  for (const scope of scopes.listening) {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const frame = corpusRhetoricalFunction(scope.text, seed)!; expect(frame).toBeDefined(); const q = questionSchema.parse({ id: 'heard-rhetoric', blockId: 'block', ...frame, additionalEvidence: frame.additionalEvidence.map(e => ({ ...e, blockId: 'block' })) }); if ('kind' in q) throw Error('Expected choice');
      for (let answer = 0; answer < 4; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.explanations[q.answer].en).not.toContain('borrows the specific effect');
    }), { numRuns: 100 });
  }
  for (const seed of [0, 1, 2, 0xffffffff]) {
    const lesson = spokenCorpusLesson(banks[0], new Set(), seed, 210, 'C2', [], 'choice', [], rhetoricalFunctionOperation, [banks[1]])!;
    expect(lesson).toBeDefined(); expect(lesson.goalId).toBe('rhetorical-function-in-context'); lessonSchema.parse(lesson); expect(lesson.workedExample!.en).toContain('Ten meetings'); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === rhetoricalFunctionOperation)).toBe(true);
    for (const [i, m] of lesson.materials.entries()) { expect(m.questions[0].hints?.length).toBe(i ? undefined : 3); const q = m.questions[0]; for (const e of [q.evidence, ...q.additionalEvidence!]) { expect(e.audioStart).toBeGreaterThanOrEqual(0); expect(e.audioEnd).toBeLessThanOrEqual(m.audio!.duration); expect(e.audioEnd).toBeGreaterThan(e.audioStart!); } }
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) expect(practiceLocale(lesson, locale)).toBe('en');
    const test = asTestLesson(lesson); expect(test.materials.map(m => m.blocks)).toEqual(lesson.materials.map(m => m.blocks)); expect(test.materials.map(m => m.audio)).toEqual(lesson.materials.map(m => m.audio));
    expect(spokenCorpusLesson(banks[0], new Set(), seed, 75, 'C2', [], 'choice', [], rhetoricalFunctionOperation, [banks[1]])).toBeUndefined();
    expect(spokenCorpusLesson(banks[0], new Set(), seed, 210, 'C2', [], 'choice', [], rhetoricalFunctionOperation)).toBeUndefined();
    for (const point of ['B2', 'C1'] as const) expect(spokenCorpusLesson(banks[0], new Set(), seed, 210, point, [], 'choice', [], rhetoricalFunctionOperation, [banks[1]])).toBeUndefined();
  }
});
it('retains exact listening identity and rejects changed audio, segment times, text, credits, excluded or exposed applications', async () => {
  const { spokenCorpusLesson } = await import('../src/core/spokenCorpus'); const banks = await heardBanks(), before = structuredClone(banks);
  const application = banks[1], original = application.records[0].clips[0];
  for (const edit of [(c: typeof original) => { c.text += ' Another claim.'; }, (c: typeof original) => { c.audio.sha256 = '0'.repeat(64); }, (c: typeof original) => { c.audio.duration += .01; }, (c: typeof original) => { c.audio.author = 'Another voice'; }, (c: typeof original) => { c.audio.license = 'Public domain'; }, (c: typeof original) => { c.segments[0].audioEnd -= .01; }, (c: typeof original) => { c.credit.attribution = 'Wrong credit'; }, (c: typeof original) => { c.qualityFlags.push('Unresolved source conflict'); }]) {
    const bad = structuredClone(application); edit(bad.records[0].clips[0]); expect(spokenCorpusLesson(banks[0], new Set(), 0, 210, 'C2', [], 'choice', [], rhetoricalFunctionOperation, [bad])).toBeUndefined();
  }
  expect(spokenCorpusLesson(banks[0], new Set([original.id]), 0, 210, 'C2', [], 'choice', [], rhetoricalFunctionOperation, [application])).toBeUndefined(); expect(banks).toEqual(before);
});
it('checks source-specific offline notices without breaking the original two long-source packages', async () => {
  const { unzipSync, zipSync } = await import('fflate');
  for (const path of ['tests/fixtures/long-reference-history.zip', 'tests/fixtures/long-reference-seo.zip', ...listeningInputs.map(([path]) => path)]) {
    const bytes = new Uint8Array(readFileSync(path)); await expect(inspectCommunityPack(bytes)).resolves.toBeDefined();
    const files = unzipSync(bytes), name = path.includes('c2-rhetoric') ? path.split('/').at(-1)!.replace('.zip', '-NOTICE.md') : 'long-listening-NOTICE.md';
    for (const missing of [true, false]) { const changed = { ...files }, manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])); if (missing) { delete changed[name]; delete manifest.files[name]; } else { changed[name] = new TextEncoder().encode('Incorrect notice'); manifest.files[name] = { bytes: changed[name].length, sha256: sha(changed[name]) }; } changed['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); await expect(inspectCommunityPack(zipSync(changed))).rejects.toThrow('COMMUNITY_SOURCE'); }
  }
});

it('keeps rhetoric retries at C2 and clears that incompatible focus after a chosen starting-point change in either skill', async () => {
  const { corpusPracticeHistory } = await import('../src/core/corpusPractice'); const { spokenCorpusLesson } = await import('../src/core/spokenCorpus'); const banks = await heardBanks();
  const reading = corpusLesson(await bank(), new Set(), 0, 1200, 'C2', [], 'choice', [], rhetoricalFunctionOperation)!;
  const heard = spokenCorpusLesson(banks[0], new Set(), 0, 210, 'C2', [], 'choice', [], rhetoricalFunctionOperation, [banks[1]])!;
  for (const lesson of [reading, heard]) {
    const profileId = `rhetoric-retarget-${lesson.skill}`, at = new Date(Date.now() - 1000).toISOString();
    const session: import('../src/data/db').Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-retarget-only', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: import('../src/data/db').Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: q.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-retarget-only', assistance: { hintLevel: 0, ...(lesson.skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', 'C2').focus).toEqual(expect.objectContaining({ operation: rhetoricalFunctionOperation, reason: 'reteach' }));
    for (const point of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', point).focus).toBeUndefined();
  }
});

it('composes six context-specific two-move comparisons instead of distributing fixed per-question option lists', () => {
  const keys = [
    ['opposed verdicts', 'permanence as self-evident', 'described punishment', 'covert agents'],
    ['second vulnerable', 'value and staged success', 'breaking accumulated resistance', 'enduring felt impact'],
    ['inverted capacity', 'reversal in the means', 'two instrumental motives', 'institution beyond hostile'],
    ['origin-image', 'threatened dependent', 'tasks of shaping', 'democratic inheritance'],
  ];
  for (const [i, scope] of [...scopes.reading, ...scopes.listening].entries()) {
    const frames = Array.from({ length: 24 }, (_, seed) => corpusRhetoricalFunction(scope.text, seed)!);
    expect(frames.every(Boolean)).toBe(true); expect(new Set(frames.map(f => JSON.stringify(f.options))).size).toBe(24);
    for (const [p, [a, b]] of pairs.entries()) {
      const f = frames[p * 4], correct = f.options[f.answer].toLowerCase();
      expect(correct).toContain(keys[i][a]); expect(correct).toContain(keys[i][b]);
      for (const slot of [a, b]) expect(f.prompt).toContain(scope.text.slice(scope.parts[slot].start, scope.parts[slot].end));
      expect(f.additionalEvidence.length).toBeGreaterThanOrEqual(2);
      for (const e of f.explanations) expect(e['zh-Hans']).toBe(e.en);
      expect(f.explanations[f.answer].en).toContain('A:'); expect(f.explanations[f.answer].en).toContain('B:');
      for (const [index, e] of f.explanations.entries()) if (index !== f.answer) expect(e.en).toContain('borrows the specific effect');
    }
  }
});

it('rejects absent contextual evidence, invalid spans and a frame containing competing edits rather than guessing', () => {
  const part = scopes.reading[0].parts[0], before = structuredClone(part);
  try {
    part.contextEvidence = []; expect(corpusRhetoricalFunction(scopes.reading[0].text, 0)).toBeUndefined();
    Object.assign(part, structuredClone(before)); part.contextEvidence[0].end = scopes.reading[0].text.length + 1; expect(corpusRhetoricalFunction(scopes.reading[0].text, 0)).toBeUndefined();
    Object.assign(part, structuredClone(before)); part.end = scopes.reading[0].parts[1].end; expect(corpusRhetoricalFunction(scopes.reading[0].text, 0)).toBeUndefined();
    Object.assign(part, structuredClone(before)); const second = scopes.reading[0].parts[1], saved = structuredClone(second); try { Object.assign(second, part); expect(corpusRhetoricalFunction(scopes.reading[0].text, 0)).toBeUndefined(); } finally { Object.assign(second, saved); }
  } finally { Object.assign(part, before); }
});

it('keeps the new official speech provenance exact and rejects short-clip, host, licence, reading and outside-source exemptions', async () => {
  const { spokenCorpusSchema } = await import('../src/core/spokenCorpus');
  const { validCorpusSource } = await import('../src/core/corpus');
  const { reviewedExcerpts } = await import('../src/data/corpus');
  for (const bank of await heardBanks()) {
    const source = bank.records[0]; expect(validCorpusSource(source)).toBe(true);
    for (const changed of [{ sourceHash: 'f'.repeat(64) }, { originalUrl: source.originalUrl + '?changed=1', downloadUrl: source.originalUrl + '?changed=1' }, { licenceUrl: 'https://www.archives.gov/global-pages/privacy.html' === source.licenceUrl ? 'https://www.jfklibrary.org/asset-viewer/archives/jfkwha-001' : 'https://www.archives.gov/global-pages/privacy.html' }, { id: 'voa-123', rootId: 'voa-article-123' }, { originalUrl: 'https://www.presidency.ucsb.edu.evil.example/documents/farewell-radio-and-television-address-the-american-people', downloadUrl: 'https://www.presidency.ucsb.edu.evil.example/documents/farewell-radio-and-television-address-the-american-people' }]) {
      const forged = { ...source, ...changed }; expect(validCorpusSource(forged)).toBe(false); expect(spokenCorpusSchema.safeParse({ ...bank, records: [forged] }).success).toBe(false);
    }
    const text = 'An isolated metadata-only forgery claims a different short recording contains these invented ordinary words for a test. It must not borrow the official speech identity or become a newly eligible recording through its short duration.';
    const clip = { ...source.clips[0], id: 'e'.repeat(64), text, wordCount: text.split(/\s+/).length, audio: { ...source.clips[0].audio, duration: 20 }, segments: [{ start: 0, end: text.length, text, audioStart: 0, audioEnd: 20 }] };
    const bad = spokenCorpusSchema.safeParse({ ...bank, records: [{ ...source, clips: [clip] }] }); expect(bad.success).toBe(false);
    if (bad.success) throw Error('Expected a provenance failure'); expect(bad.error.issues.some(i => i.message === 'Long listening source identity mismatch')).toBe(true);
    const reading = corpusSchema.safeParse({ version: 1, records: [{ ...source, passages: [] }], failures: [] }); expect(reading.success).toBe(false);
    if (reading.success) throw Error('Expected reading refusal'); expect(reading.error.issues.some(i => i.message === 'Only the exact qualified listening window is admitted for this speech')).toBe(true);
    expect(await reviewedExcerpts({ ...source, originalText: source.originalText + ' Changed outside the excerpt.' }, source.clips)).toEqual([]);
  }
});

it('recognizes actual retained legacy speech roots without rewriting saved lessons or making an exposed source unfamiliar', async () => {
  const { qualifiedKnownRoots } = await import('../src/core/spokenLongAdmission');
  const { corpusPracticeHistory } = await import('../src/core/corpusPractice');
  const { spokenCorpusLesson } = await import('../src/core/spokenCorpus');
  const banks = await heardBanks(), lesson = spokenCorpusLesson(banks[0], new Set(), 0, 210, 'C2', [], 'choice', [], rhetoricalFunctionOperation, [banks[1]])!;
  for (const [legacy, root] of [['kennedy-inaugural', 'jfk-speech-19610120-inaugural'], ['eisenhower-farewell', 'eisenhower-speech-19610117-farewell']]) {
    expect(qualifiedKnownRoots([legacy]).has(root)).toBe(true); expect(qualifiedKnownRoots([root]).has(legacy)).toBe(true);
    expect(qualifiedKnownRoots([], [{ rootId: 'isolated-alias-test-only', sourceId: legacy }]).has(root)).toBe(true);
    const prior = structuredClone(lesson); const material = prior.materials.find(m => m.rootId === root)!; prior.materials = [{ ...material, rootId: legacy, sourceId: legacy }];
    const at = new Date(Date.now() - 1000).toISOString(), session: import('../src/data/db').Session = { id: 'legacy-rhetoric-isolated', profileId: 'legacy-rhetoric-isolated', lesson: prior, status: 'active', position: 0, startedAt: at, contentHash: 'isolated-alias-test-only', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const before = structuredClone(session); corpusPracticeHistory([session], [], session.profileId, 'listening', 'all', 'C2');
    expect(qualifiedKnownRoots(prior.materials.map(m => m.rootId), prior.materials).has(root)).toBe(true); expect(session).toEqual(before);
  }
});
