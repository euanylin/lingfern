import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusNuancedMeaning, nuancedMeaningOperation, nuancedMeaningPrompt } from '../src/core/corpusNuancedMeaning';
import { corpusLesson, corpusMaterial, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { asTestLesson, lessonSchema, practiceLocale, questionSchema, score } from '../src/shared/content';
import scopes from '../content/corpus/c2-nuanced-meaning-scopes.json';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function bank() {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/c2-nuance-reading-contexts.zip'));
  expect(sha(bytes)).toBe('0af3abb9ad45f3823d7cdf3916f9056ba2d578ab9449039e1a972865dab24e4d');
  const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
  return { ...pack.corpus!, records: await reviewedReading(pack.corpus!.records, 1200) };
}
it('compares contextual scope and commitment across complete contexts and rejects every wrong option for arbitrary seeds', () => {
  for (const scope of scopes.reading) {
    expect(sha(scope.text)).toBe(scope.textSha256); expect(scope.text.split(/\s+/).length).toBeGreaterThan(500);
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const frame = corpusNuancedMeaning(scope.text, seed)!; expect(frame).toBeDefined();
      const q = questionSchema.parse({ id: 'nuance-q', blockId: 'block', ...frame, additionalEvidence: frame.additionalEvidence.map(e => ({ ...e, blockId: 'block' })) });
      if ('kind' in q) throw Error('Expected choice'); expect(q.prompt.startsWith(nuancedMeaningPrompt + '\nOriginal: ')).toBe(true); expect(q.prompt).toContain('\nProposed: ');
      for (let answer = 0; answer < 4; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      for (const invalid of [-1, 4, '1', []]) expect(() => score(q, invalid)).toThrow();
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.explanations[q.answer].en).not.toContain('this alternative');
      expect(scope.text.slice(q.evidence.start, q.evidence.end)).toBe(scope.text.slice(scope.parts[Math.floor(seed / 4) % 4].start, scope.parts[Math.floor(seed / 4) % 4].end));
      for (const span of q.additionalEvidence!) expect(scope.text.slice(span.start, span.end).length).toBeGreaterThan(20);
      for (const explanation of q.explanations) for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) expect(explanation[locale].length).toBeGreaterThan(25);
    }), { numRuns: 100 });
    for (const changed of [scope.text.slice(10), scope.text + scope.text, scope.text.replace('the', 'some'), scope.text + ' Another claim.']) expect(corpusNuancedMeaning(changed, 0)).toBeUndefined();
  }
  for (const seed of [-1, .5, 0x100000000, NaN]) expect(() => corpusNuancedMeaning(scopes.reading[0].text, seed)).toThrow('INVALID_NUANCED_MEANING');
  expect(corpusNuancedMeaning('Would you mind opening the window?', 0)).toBeUndefined();
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
  const corpus = await bank(); const lesson = corpusLesson(corpus, new Set(), 0, 1200, 'C2', [], 'choice', [], nuancedMeaningOperation)!;
  expect(lesson).toBeDefined(); lessonSchema.parse(lesson); expect(lesson.goalId).toBe('nuanced-meaning-in-context');
  expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
  expect(lesson.materials.map(m => corpusOperation(m.questions[0]))).toEqual([nuancedMeaningOperation, nuancedMeaningOperation]);
  expect(lesson.materials[0].questions[0].hints).toHaveLength(3); expect(lesson.materials[1].questions[0].hints).toBeUndefined();
  for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) { expect(practiceLocale(lesson, locale)).toBe('en'); for (const field of ['goal', 'teaching', 'workedExample', 'nextStep'] as const) expect(lesson[field]?.[locale].length).toBeGreaterThan(25); }
  const test = asTestLesson(lesson); expect(test.mode).toBe('test'); expect(test.materials).toEqual(lesson.materials.map(m => ({ ...m, questions: m.questions.map(q => { const copy = { ...q }; delete copy.hints; return copy; }) }))); for (const m of test.materials) expect(m.questions[0].hints).toBeUndefined(); expect(test.generation).toEqual(lesson.generation);
  for (const m of lesson.materials) expect(lesson.workedExample!.en).not.toContain(m.blocks[0].text.slice(0, 40));
});
it('fails closed for unavailable independent applications, changed source identity, insufficient context, budgets, seen roots and wrong levels', async () => {
  const corpus = await bank(); const before = structuredClone(corpus); const generate = (c = corpus, seen = new Set<string>(), max = 1200, point: 'C1' | 'B2' | 'C2' = 'C2') => corpusLesson(c, seen, 0, max, point, [], 'choice', [], nuancedMeaningOperation);
  expect(generate({ ...corpus, records: [corpus.records[0]] })).toBeUndefined(); expect(generate(corpus, new Set(), 500)).toBeUndefined();
  for (const point of ['B2', 'C1'] as const) expect(generate(corpus, new Set(), 1200, point)).toBeUndefined();
  for (const source of corpus.records) { expect(generate(corpus, new Set([source.passages[0].id]))).toBeUndefined(); for (const field of ['sourceHash', 'rootId', 'attribution', 'licence', 'originalUrl'] as const) { const bad = structuredClone(source); bad[field] = 'Changed'; expect(corpusMaterial({ source: bad, passage: bad.passages[0] }, 0, 'C2', 'choice', nuancedMeaningOperation)).toBeUndefined(); } }
  const duplicate = structuredClone(corpus); duplicate.records[1] = { ...duplicate.records[0], id: 'gutenberg-1' }; expect(() => corpusSchema.parse(duplicate)).toThrow(); expect(corpus).toEqual(before);
});
it('saves each answer transactionally and restores exact source/assistance/scoring snapshots into another isolated profile', async () => {
  const { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } = await import('../src/data/db');
  const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup'); await Promise.all(db.tables.map(t => t.clear()));
  try { const lesson = corpusLesson(await bank(), new Set(), 0, 1200, 'C2', [], 'choice', [], nuancedMeaningOperation)!;
    for (const snapshot of [lesson, asTestLesson(lesson)]) { const profileId = `nuance-${snapshot.mode ?? 'practice'}`; const created = await createSession(snapshot, profileId); let current: import('../src/data/db').Session = await claimSession(created.id, 'owner');
      for (const m of snapshot.materials) { await markExposure(current); const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); const result = await submit(created.id, 'owner', q.answer); expect(result.correct).toBe(true); expect((await attempts.get(result.id))!.answer).toBe(q.answer); current = await advance(created.id, 'owner'); }
      expect(current.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profileId)); expect(backup.records.sessions[0].lesson).toEqual(snapshot); const restored = await importBackup(backup); expect((await sessions.where('profileId').equals(restored).toArray())[0].lesson).toEqual(snapshot); expect(await attempts.where('profileId').equals(restored).count()).toBe(2);
    }
  } finally { await Promise.all(db.tables.map(t => t.clear())); }
});

const listeningInputs = [
  ['tests/fixtures/c2-nuance-140128449.zip', '8159812541865fe7d38ac79d7d88fb82d67555a0c79f765493ebe1e4a0a66c08'],
  ['tests/fixtures/c2-nuance-80901052.zip', '6839de1e254c7a6908c1e406ac36b491567647d64bc111ec738e56953ae13e22'],
];
async function heardBanks() {
  return Promise.all(listeningInputs.map(async ([path, hash]) => {
    const bytes = new Uint8Array(readFileSync(path)); expect(sha(bytes)).toBe(hash); const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
    const { reviewedExcerpts } = await import('../src/data/corpus');
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await reviewedExcerpts(r, r.clips) }))) };
  }));
}
it('distinguishes reported claims, evidential commitment and continuing states in complete source-bound listening contexts', async () => {
  const { spokenCorpusLesson } = await import('../src/core/spokenCorpus');
  const { qualifiedLongSeconds } = await import('../src/core/spokenLongAdmission'); const banks = await heardBanks(); expect(banks.every(b => b.records[0].clips.length === 1)).toBe(true);
  expect(qualifiedLongSeconds(banks, 'C2', 91)).toBe(220); expect(qualifiedLongSeconds(banks, 'C2', 60)).toBe(60);
  expect(qualifiedLongSeconds(banks, 'B2', 91)).toBe(91); expect(qualifiedLongSeconds(banks, 'C1', 91)).toBe(91);
  expect(qualifiedLongSeconds([banks[0]], 'C2', 91)).toBe(91);
  for (const scope of scopes.listening) {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const frame = corpusNuancedMeaning(scope.text, seed)!; expect(frame).toBeDefined(); const q = questionSchema.parse({ id: 'heard-nuance', blockId: 'block', ...frame, additionalEvidence: frame.additionalEvidence.map(e => ({ ...e, blockId: 'block' })) }); if ('kind' in q) throw Error('Expected choice');
      for (let answer = 0; answer < 4; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.explanations[q.answer].en).not.toContain('this alternative');
    }), { numRuns: 100 });
  }
  for (const seed of [0, 1, 2, 0xffffffff]) {
    const lesson = spokenCorpusLesson(banks[0], new Set(), seed, 220, 'C2', [], 'choice', [], nuancedMeaningOperation, [banks[1]])!;
    expect(lesson).toBeDefined(); expect(lesson.goalId).toBe('nuanced-meaning-in-context'); lessonSchema.parse(lesson); expect(lesson.workedExample!.en).toContain('Jo reports'); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === nuancedMeaningOperation)).toBe(true);
    for (const [i, m] of lesson.materials.entries()) { expect(m.questions[0].hints?.length).toBe(i ? undefined : 3); const q = m.questions[0]; for (const e of [q.evidence, ...q.additionalEvidence!]) { expect(e.audioStart).toBeGreaterThanOrEqual(0); expect(e.audioEnd).toBeLessThanOrEqual(m.audio!.duration); expect(e.audioEnd).toBeGreaterThan(e.audioStart!); } }
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) expect(practiceLocale(lesson, locale)).toBe('en');
    const test = asTestLesson(lesson); expect(test.materials.map(m => m.blocks)).toEqual(lesson.materials.map(m => m.blocks)); expect(test.materials.map(m => m.audio)).toEqual(lesson.materials.map(m => m.audio));
    expect(spokenCorpusLesson(banks[0], new Set(), seed, 75, 'C2', [], 'choice', [], nuancedMeaningOperation, [banks[1]])).toBeUndefined();
    expect(spokenCorpusLesson(banks[0], new Set(), seed, 220, 'C2', [], 'choice', [], nuancedMeaningOperation)).toBeUndefined();
    for (const point of ['B2', 'C1'] as const) expect(spokenCorpusLesson(banks[0], new Set(), seed, 220, point, [], 'choice', [], nuancedMeaningOperation, [banks[1]])).toBeUndefined();
  }
});
it('retains exact listening identity and rejects changed audio, segment times, text, credits, excluded or exposed applications', async () => {
  const { spokenCorpusLesson } = await import('../src/core/spokenCorpus'); const banks = await heardBanks(), before = structuredClone(banks);
  const application = banks[1], original = application.records[0].clips[0];
  for (const edit of [(c: typeof original) => { c.text += ' Another claim.'; }, (c: typeof original) => { c.audio.sha256 = '0'.repeat(64); }, (c: typeof original) => { c.audio.duration += .01; }, (c: typeof original) => { c.audio.author = 'Another voice'; }, (c: typeof original) => { c.audio.license = 'Public domain'; }, (c: typeof original) => { c.segments[0].audioEnd -= .01; }, (c: typeof original) => { c.credit.attribution = 'Wrong credit'; }, (c: typeof original) => { c.qualityFlags.push('Unresolved source conflict'); }]) {
    const bad = structuredClone(application); edit(bad.records[0].clips[0]); expect(spokenCorpusLesson(banks[0], new Set(), 0, 220, 'C2', [], 'choice', [], nuancedMeaningOperation, [bad])).toBeUndefined();
  }
  expect(spokenCorpusLesson(banks[0], new Set([original.id]), 0, 220, 'C2', [], 'choice', [], nuancedMeaningOperation, [application])).toBeUndefined(); expect(banks).toEqual(before);
});
it('checks source-specific offline notices without breaking the original two long-source packages', async () => {
  const { unzipSync, zipSync } = await import('fflate');
  for (const path of ['tests/fixtures/long-reference-history.zip', 'tests/fixtures/long-reference-seo.zip', ...listeningInputs.map(([path]) => path)]) {
    const bytes = new Uint8Array(readFileSync(path)); await expect(inspectCommunityPack(bytes)).resolves.toBeDefined();
    const files = unzipSync(bytes), name = path.includes('c2-nuance') ? 'c2-nuance-listening-NOTICE.md' : 'long-listening-NOTICE.md';
    for (const missing of [true, false]) { const changed = { ...files }, manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])); if (missing) { delete changed[name]; delete manifest.files[name]; } else { changed[name] = new TextEncoder().encode('Incorrect notice'); manifest.files[name] = { bytes: changed[name].length, sha256: sha(changed[name]) }; } changed['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); await expect(inspectCommunityPack(zipSync(changed))).rejects.toThrow('COMMUNITY_SOURCE'); }
  }
});

it('keeps nuance retries at C2 and clears that incompatible focus after a chosen starting-point change in either skill', async () => {
  const { corpusPracticeHistory } = await import('../src/core/corpusPractice'); const { spokenCorpusLesson } = await import('../src/core/spokenCorpus'); const banks = await heardBanks();
  const reading = corpusLesson(await bank(), new Set(), 0, 1200, 'C2', [], 'choice', [], nuancedMeaningOperation)!;
  const heard = spokenCorpusLesson(banks[0], new Set(), 0, 220, 'C2', [], 'choice', [], nuancedMeaningOperation, [banks[1]])!;
  for (const lesson of [reading, heard]) {
    const profileId = `nuance-retarget-${lesson.skill}`, at = new Date(Date.now() - 1000).toISOString();
    const session: import('../src/data/db').Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-retarget-only', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: import('../src/data/db').Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: q.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-retarget-only', assistance: { hintLevel: 0, ...(lesson.skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', 'C2').focus).toEqual(expect.objectContaining({ operation: nuancedMeaningOperation, reason: 'reteach' }));
    for (const point of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', point).focus).toBeUndefined();
  }
});

it('distinguishes every inspected contextual edit and all rotated alternatives, without reducing the task to a local cue', () => {
  const keys = [
    ['conditional possibility', 'Mayor would report', 'restricted freedom', 'future capacity'],
    ['instrument', 'earlier ignorance', 'categorical impossibility', 'causal conjecture'],
    ['automatic approval', 'unconditional recurring requirement', 'umbrella', 'best or most likely'],
    ['less qualified', 'intervening working period', 'majority', 'observation claim'],
  ];
  for (const [i, scope] of [...scopes.reading, ...scopes.listening].entries()) {
    const frames = Array.from({ length: 16 }, (_, seed) => corpusNuancedMeaning(scope.text, seed)!);
    expect(frames.every(Boolean)).toBe(true); expect(new Set(frames.map(f => JSON.stringify(f.options))).size).toBe(16);
    for (let part = 0; part < 4; part++) {
      const f = frames[part * 4]; expect(f.options[f.answer].toLowerCase()).toContain(keys[i][part].toLowerCase());
      expect(f.additionalEvidence.length).toBeGreaterThanOrEqual(1);
      expect(f.prompt).toContain(scope.text.slice(scope.parts[part].start, scope.parts[part].end));
      for (const e of f.additionalEvidence) expect(scope.text.slice(e.start, e.end).length).toBeGreaterThan(20);
      for (const e of f.explanations) expect(e['zh-Hans']).toBe(e.en);
    }
  }
});

it('rejects absent contextual evidence, invalid spans and a frame containing competing edits rather than guessing', () => {
  const part = scopes.reading[0].parts[0], before = structuredClone(part);
  try {
    part.contextEvidence = []; expect(corpusNuancedMeaning(scopes.reading[0].text, 0)).toBeUndefined();
    Object.assign(part, structuredClone(before)); part.contextEvidence[0].end = scopes.reading[0].text.length + 1; expect(corpusNuancedMeaning(scopes.reading[0].text, 0)).toBeUndefined();
    Object.assign(part, structuredClone(before)); part.end = scopes.reading[0].parts[1].end; expect(corpusNuancedMeaning(scopes.reading[0].text, 0)).toBeUndefined();
  } finally { Object.assign(part, before); }
});
