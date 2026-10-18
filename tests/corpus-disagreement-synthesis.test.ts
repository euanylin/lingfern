import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { corpusLesson, corpusMaterial, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { asTestLesson, lessonSchema, practiceLocale, questionSchema, score } from '../src/shared/content';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
import { expect, it, vi } from 'vitest';
import fc from 'fast-check';
import scopes from '../content/corpus/c2-disagreement-synthesis-scopes.json';
import { corpusDisagreementSynthesis, disagreementSynthesisOperation, disagreementSynthesisPrompt, disagreementSynthesisSupport, heardDisagreementSynthesisSupport } from '../src/core/corpusDisagreementSynthesis';

const contexts = [...scopes.reading, ...scopes.listening];
const oracle = [
  ['allows mathematical study to strengthen analysis', 'contrasts draughts as a clearer test'],
  ['Objectors reject a chance-population implication', 'while admitting difficulty with particular mammals'],
  ['Adherents claim politics is surpassed', 'crash led many techno-utopians to revise some beliefs'],
  ['Affirmative readers align poet and speaker', 'retaining their competing bases'],
];
it('synthesizes the actual represented differences without inventing shared assent, complete reversal or a definitive winner', () => {
  contexts.forEach((scope, i) => {
    const q = corpusDisagreementSynthesis(scope.text, 0)!;
    expect(q.answer).toBe(0); expect(q.prompt.startsWith(disagreementSynthesisPrompt + '\nA: ')).toBe(true);
    for (const key of oracle[i]) expect(q.options[q.answer]).toContain(key);
    expect(q.options[1]).not.toBe(q.options[q.answer]);
    expect(q.explanations[q.answer].en).toContain(['permits a benefit without identity', 'not the opponents’ concession', 'different levels', 'not equate ironic distance with defective writing'][i]);
    expect(scope.text.slice(q.evidence.start, q.evidence.end)).toBe(scope.text.slice(scope.parts[0].start, scope.parts[0].end));
    expect(q.additionalEvidence.some(s => s.start === scope.parts[1].start && s.end === scope.parts[1].end)).toBe(true);
  });
});

it('covers all six quotation pairs and four answer positions without losing exact contextual evidence', () => {
  for (const scope of contexts) {
    const prompts = new Set<string>(), keys = [0, 0, 0, 0];
    for (let seed = 0; seed < 24; seed++) {
      const q = corpusDisagreementSynthesis(scope.text, seed)!;
      prompts.add(q.prompt); keys[q.answer]++;
      expect(new Set(q.options).size).toBe(4);
      expect(q.options.every(v => v.startsWith('A: ') && v.includes(' B: '))).toBe(true);
      expect(q.explanations).toHaveLength(4);
      for (const span of [q.evidence, ...q.additionalEvidence]) {
        expect(span.start).toBeGreaterThanOrEqual(0); expect(span.end).toBeGreaterThan(span.start); expect(span.end).toBeLessThanOrEqual(scope.text.length);
        expect(scope.text.slice(span.start, span.end).trim().length).toBeGreaterThan(0);
      }
      for (let index = 0; index < 4; index++) expect(q.explanations[index].en.trim().length).toBeGreaterThan(80);
    }
    expect(prompts.size).toBe(6); expect(keys).toEqual([6, 6, 6, 6]);
  }
});

it('is deterministic and bounded over the accepted32bit seed domain', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    for (const scope of contexts) {
      const q = corpusDisagreementSynthesis(scope.text, seed)!;
      expect(q).toEqual(corpusDisagreementSynthesis(scope.text, seed));
      expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(4);
    }
  }), { numRuns: 30 });
  for (const seed of [-1, .5, 0x100000000, NaN, Infinity]) expect(() => corpusDisagreementSynthesis(contexts[0].text, seed)).toThrow('INVALID_DISAGREEMENT_SYNTHESIS');
  expect(() => corpusDisagreementSynthesis('x'.repeat(12001), 0)).toThrow('INVALID_DISAGREEMENT_SYNTHESIS');
});

it('refuses an unknown or altered context instead of applying a short lexical cue without its source', () => {
  expect(corpusDisagreementSynthesis('Yet to calculate is not in itself to analyse.', 0)).toBeUndefined();
  for (const scope of contexts) {
    expect(corpusDisagreementSynthesis(scope.text + ' Changed outside the quoted wording.', 0)).toBeUndefined();
    const part = scope.parts[0], changed = scope.text.slice(0, part.start) + 'Changed' + scope.text.slice(part.end);
    expect(corpusDisagreementSynthesis(changed, 0)).toBeUndefined();
  }
});

it('refuses missing context evidence, invalid spans and duplicate relation assignments', () => {
  const scope = scopes.reading[0], original = structuredClone(scope.parts);
  try {
    scope.parts[0].contextEvidence = []; expect(corpusDisagreementSynthesis(scope.text, 0)).toBeUndefined();
    scope.parts = structuredClone(original); scope.parts[0].start = -1; expect(corpusDisagreementSynthesis(scope.text, 0)).toBeUndefined();
    scope.parts = structuredClone(original); scope.parts[0].contextEvidence[0].end = scope.text.length + 1; expect(corpusDisagreementSynthesis(scope.text, 0)).toBeUndefined();
    scope.parts = structuredClone(original); scope.parts[1] = structuredClone(scope.parts[0]); expect(corpusDisagreementSynthesis(scope.text, 0)).toBeUndefined();
  } finally { scope.parts = original; }
  expect(corpusDisagreementSynthesis(scope.text, 0)).toBeDefined();
});

it('provides English instruction for each interface locale and a complete unscored example without exposing a source answer', () => {
  for (const support of [disagreementSynthesisSupport, heardDisagreementSynthesisSupport]) {
    expect(support.hints).toHaveLength(3);
    for (const value of [support.goal, support.teaching, support.workedExample, support.nextStep, ...support.hints]) {
      expect(value['zh-Hans']).toBe(value.en); expect(value['zh-Hant']).toBe(value.en);
    }
    expect(support.workedExample.en).toContain('minutes record no vote');
    expect(support.workedExample.en).toContain('Jo’s concession does not mean adopting Em’s timing condition');
    for (const scope of contexts) for (const part of scope.parts) expect(support.workedExample.en).not.toContain(scope.text.slice(part.start, part.end));
  }
});

async function bank() {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/c2-synthesis-reading-contexts.zip'));
  expect(sha(bytes)).toBe('43bf71a575ba7d4a28db573389cd4705826b9a3c3c09cd0189b52600a8efc957');
  const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
  return { ...pack.corpus!, records: await reviewedReading(pack.corpus!.records, 1200) };
}
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
  const corpus = await bank(); const lesson = corpusLesson(corpus, new Set(), 0, 1200, 'C2', [], 'choice', [], disagreementSynthesisOperation)!;
  expect(lesson).toBeDefined(); lessonSchema.parse(lesson); expect(lesson.goalId).toBe('disagreement-synthesis');
  expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
  expect(lesson.materials.map(m => corpusOperation(m.questions[0]))).toEqual([disagreementSynthesisOperation, disagreementSynthesisOperation]);
  for (const material of lesson.materials) expect(material.questions[0].id.length).toBeLessThanOrEqual(80);
  expect(lesson.materials[0].questions[0].hints).toHaveLength(3); expect(lesson.materials[1].questions[0].hints).toBeUndefined();
  for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) { expect(practiceLocale(lesson, locale)).toBe('en'); for (const field of ['goal', 'teaching', 'workedExample', 'nextStep'] as const) expect(lesson[field]?.[locale].length).toBeGreaterThan(25); }
  const test = asTestLesson(lesson); expect(test.mode).toBe('test'); expect(test.materials).toEqual(lesson.materials.map(m => ({ ...m, questions: m.questions.map(q => { const copy = { ...q }; delete copy.hints; return copy; }) }))); for (const m of test.materials) expect(m.questions[0].hints).toBeUndefined(); expect(test.generation).toEqual(lesson.generation);
  for (const m of lesson.materials) expect(lesson.workedExample!.en).not.toContain(m.blocks[0].text.slice(0, 40));
});
it('fails closed for unavailable independent applications, changed source identity, insufficient context, budgets, seen roots and wrong levels', async () => {
  const corpus = await bank(); const before = structuredClone(corpus); const generate = (c = corpus, seen = new Set<string>(), max = 1200, point: 'C1' | 'B2' | 'C2' = 'C2') => corpusLesson(c, seen, 0, max, point, [], 'choice', [], disagreementSynthesisOperation);
  expect(generate({ ...corpus, records: [corpus.records[0]] })).toBeUndefined(); expect(generate(corpus, new Set(), 700)).toBeUndefined(); expect(generate(corpus, new Set(), 1100)).toBeUndefined();
  for (const point of ['B2', 'C1'] as const) expect(generate(corpus, new Set(), 1200, point)).toBeUndefined();
  for (const source of corpus.records) { expect(generate(corpus, new Set([source.passages[0].id]))).toBeUndefined(); for (const field of ['sourceHash', 'rootId', 'attribution', 'licence', 'originalUrl'] as const) { const bad = structuredClone(source); bad[field] = 'Changed'; expect(corpusMaterial({ source: bad, passage: bad.passages[0] }, 0, 'C2', 'choice', disagreementSynthesisOperation)).toBeUndefined(); } }
  const duplicate = structuredClone(corpus); duplicate.records[1] = { ...duplicate.records[0], id: 'gutenberg-1' }; expect(() => corpusSchema.parse(duplicate)).toThrow(); expect(corpus).toEqual(before);
});
it('saves each answer transactionally and restores exact source/assistance/scoring snapshots into another isolated profile', async () => {
  const { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } = await import('../src/data/db');
  const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup'); await Promise.all(db.tables.map(t => t.clear()));
  try { const lesson = corpusLesson(await bank(), new Set(), 0, 1200, 'C2', [], 'choice', [], disagreementSynthesisOperation)!;
    for (const snapshot of [lesson, asTestLesson(lesson)]) { const profileId = `synthesis-${snapshot.mode ?? 'practice'}`; const created = await createSession(snapshot, profileId); let current: import('../src/data/db').Session = await claimSession(created.id, 'owner');
      for (const m of snapshot.materials) { await markExposure(current); const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); const beforeCount = await attempts.where('sessionId').equals(created.id).count(); const failure = vi.spyOn(attempts, 'add').mockRejectedValueOnce(Error('QuotaExceededError')); await expect(submit(created.id, 'owner', q.answer)).rejects.toThrow('QuotaExceededError'); failure.mockRestore(); expect((await sessions.get(created.id))!.position).toBe(current.position); expect(await attempts.where('sessionId').equals(created.id).count()).toBe(beforeCount); const result = await submit(created.id, 'owner', q.answer); expect(result.correct).toBe(true); expect((await attempts.get(result.id))!.answer).toBe(q.answer); current = await advance(created.id, 'owner'); }
      expect(current.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profileId)); expect(backup.records.sessions[0].lesson).toEqual(snapshot); const restored = await importBackup(backup); expect((await sessions.where('profileId').equals(restored).toArray())[0].lesson).toEqual(snapshot); expect(await attempts.where('profileId').equals(restored).count()).toBe(2);
    }
  } finally { vi.restoreAllMocks(); await Promise.all(db.tables.map(t => t.clear())); }
});

const listeningInputs = [
  ['tests/fixtures/c2-synthesis-74092955.zip', 'e5b81d16572cdf2ca624e66d2a446ff2406eda29d30bee3db5cb90fc6959fd1a'],
  ['tests/fixtures/c2-synthesis-50803327.zip', '055cb8f0c43ce435b1ebfe9f494303bc2cad92921467d25def970408162f8ca7'],
];
async function heardBanks() {
  return Promise.all(listeningInputs.map(async ([path, hash]) => {
    const bytes = new Uint8Array(readFileSync(path)); expect(sha(bytes)).toBe(hash); const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
    const { reviewedExcerpts } = await import('../src/data/corpus');
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await reviewedExcerpts(r, r.clips) }))) };
  }));
}
it('retains reported ideological and literary disputes without a fabricated settlement in source-bound complete listening contexts', async () => {
  const { spokenCorpusLesson } = await import('../src/core/spokenCorpus');
  const { qualifiedLongSeconds } = await import('../src/core/spokenLongAdmission'); const banks = await heardBanks(); expect(banks.every(b => b.records[0].clips.length === 1)).toBe(true);
  expect(qualifiedLongSeconds(banks, 'C2', 91)).toBe(207); expect(qualifiedLongSeconds(banks, 'C2', 60)).toBe(60);
  expect(qualifiedLongSeconds(banks, 'B2', 91)).toBe(91); expect(qualifiedLongSeconds(banks, 'C1', 91)).toBe(91);
  expect(qualifiedLongSeconds([banks[0]], 'C2', 91)).toBe(91);
  for (const scope of scopes.listening) {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const frame = corpusDisagreementSynthesis(scope.text, seed)!; expect(frame).toBeDefined(); const q = questionSchema.parse({ id: 'heard-synthesis', blockId: 'block', ...frame, additionalEvidence: frame.additionalEvidence.map(e => ({ ...e, blockId: 'block' })) }); if ('kind' in q) throw Error('Expected choice');
      for (let answer = 0; answer < 4; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.explanations[q.answer].en).not.toContain('borrows the specific effect');
    }), { numRuns: 100 });
  }
  for (const seed of [0, 1, 2, 0xffffffff]) {
    const lesson = spokenCorpusLesson(banks[0], new Set(), seed, 207, 'C2', [], 'choice', [], disagreementSynthesisOperation, [banks[1]])!;
    expect(lesson).toBeDefined(); expect(lesson.goalId).toBe('disagreement-synthesis'); lessonSchema.parse(lesson); expect(lesson.workedExample!.en).toContain('At a library meeting'); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === disagreementSynthesisOperation)).toBe(true);
    for (const [i, m] of lesson.materials.entries()) { expect(m.questions[0].hints?.length).toBe(i ? undefined : 3); const q = m.questions[0]; for (const e of [q.evidence, ...q.additionalEvidence!]) { expect(e.audioStart).toBeGreaterThanOrEqual(0); expect(e.audioEnd).toBeLessThanOrEqual(m.audio!.duration); expect(e.audioEnd).toBeGreaterThan(e.audioStart!); } }
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) expect(practiceLocale(lesson, locale)).toBe('en');
    const test = asTestLesson(lesson); expect(test.materials.map(m => m.blocks)).toEqual(lesson.materials.map(m => m.blocks)); expect(test.materials.map(m => m.audio)).toEqual(lesson.materials.map(m => m.audio));
    expect(spokenCorpusLesson(banks[0], new Set(), seed, 75, 'C2', [], 'choice', [], disagreementSynthesisOperation, [banks[1]])).toBeUndefined();
    expect(spokenCorpusLesson(banks[0], new Set(), seed, 207, 'C2', [], 'choice', [], disagreementSynthesisOperation)).toBeUndefined();
    for (const point of ['B2', 'C1'] as const) expect(spokenCorpusLesson(banks[0], new Set(), seed, 207, point, [], 'choice', [], disagreementSynthesisOperation, [banks[1]])).toBeUndefined();
  }
});
it('retains exact listening identity and rejects changed audio, segment times, text, credits, excluded or exposed applications', async () => {
  const { spokenCorpusLesson } = await import('../src/core/spokenCorpus'); const banks = await heardBanks(), before = structuredClone(banks);
  const application = banks[1], original = application.records[0].clips[0];
  for (const edit of [(c: typeof original) => { c.text += ' Another claim.'; }, (c: typeof original) => { c.audio.sha256 = '0'.repeat(64); }, (c: typeof original) => { c.audio.duration += .01; }, (c: typeof original) => { c.audio.author = 'Another voice'; }, (c: typeof original) => { c.audio.license = 'Public domain'; }, (c: typeof original) => { c.segments[0].audioEnd -= .01; }, (c: typeof original) => { c.credit.attribution = 'Wrong credit'; }, (c: typeof original) => { c.qualityFlags.push('Unresolved source conflict'); }]) {
    const bad = structuredClone(application); edit(bad.records[0].clips[0]); expect(spokenCorpusLesson(banks[0], new Set(), 0, 207, 'C2', [], 'choice', [], disagreementSynthesisOperation, [bad])).toBeUndefined();
  }
  expect(spokenCorpusLesson(banks[0], new Set([original.id]), 0, 207, 'C2', [], 'choice', [], disagreementSynthesisOperation, [application])).toBeUndefined(); expect(banks).toEqual(before);
});
it('checks source-specific offline notices without breaking the original two long-source packages', async () => {
  const { unzipSync, zipSync } = await import('fflate');
  for (const path of ['tests/fixtures/long-reference-history.zip', 'tests/fixtures/long-reference-seo.zip', ...listeningInputs.map(([path]) => path)]) {
    const bytes = new Uint8Array(readFileSync(path)); await expect(inspectCommunityPack(bytes)).resolves.toBeDefined();
    const files = unzipSync(bytes), name = path.includes('c2-synthesis') ? 'c2-synthesis-listening-NOTICE.md' : 'long-listening-NOTICE.md';
    for (const missing of [true, false]) { const changed = { ...files }, manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])); if (missing) { delete changed[name]; delete manifest.files[name]; } else { changed[name] = new TextEncoder().encode('Incorrect notice'); manifest.files[name] = { bytes: changed[name].length, sha256: sha(changed[name]) }; } changed['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); await expect(inspectCommunityPack(zipSync(changed))).rejects.toThrow('COMMUNITY_SOURCE'); }
  }
});

it('keeps synthesis retries at C2 and clears that incompatible focus after a chosen starting-point change in either skill', async () => {
  const { corpusPracticeHistory } = await import('../src/core/corpusPractice'); const { spokenCorpusLesson } = await import('../src/core/spokenCorpus'); const banks = await heardBanks();
  const reading = corpusLesson(await bank(), new Set(), 0, 1200, 'C2', [], 'choice', [], disagreementSynthesisOperation)!;
  const heard = spokenCorpusLesson(banks[0], new Set(), 0, 207, 'C2', [], 'choice', [], disagreementSynthesisOperation, [banks[1]])!;
  for (const lesson of [reading, heard]) {
    const profileId = `synthesis-retarget-${lesson.skill}`, at = new Date(Date.now() - 1000).toISOString();
    const session: import('../src/data/db').Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-retarget-only', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: import('../src/data/db').Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: q.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-retarget-only', assistance: { hintLevel: 0, ...(lesson.skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', 'C2').focus).toEqual(expect.objectContaining({ operation: disagreementSynthesisOperation, reason: 'reteach' }));
    for (const point of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', point).focus).toBeUndefined();
  }
});


it('scores every actual two-part synthesis and rejects malformed answers across all source contexts', () => {
  for (const scope of contexts) for (let seed = 0; seed < 24; seed++) {
    const frame = corpusDisagreementSynthesis(scope.text, seed)!;
    const q = questionSchema.parse({ id: 'layered-score', blockId: 'block', ...frame, additionalEvidence: frame.additionalEvidence.map(e => ({ ...e, blockId: 'block' })) });
    if ('kind' in q) throw Error('Expected choice');
    for (let answer = 0; answer < 4; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
    for (const invalid of [-1, 4, '1', []]) expect(() => score(q, invalid)).toThrow();
  }
});

it('rejects changed full written sources outside the played window and preserves existing source holds', async () => {
  const { unzipSync, zipSync } = await import('fflate');
  const { reviewedExcerpts } = await import('../src/data/corpus');
  const banks = await heardBanks();
  for (const bank of banks) {
    const source = bank.records[0];
    expect(await reviewedExcerpts({ ...source, originalText: source.originalText + ' Changed outside the selected context.' }, source.clips)).toEqual([]);
  }
  for (const [path] of listeningInputs) {
    const files = unzipSync(new Uint8Array(readFileSync(path))), spoken = JSON.parse(new TextDecoder().decode(files['spoken.json']));
    spoken.records[0].originalText += ' Changed outside the selected context.';
    files['spoken.json'] = new TextEncoder().encode(JSON.stringify(spoken));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    manifest.files['spoken.json'] = { bytes: files['spoken.json'].length, sha256: sha(files['spoken.json']) };
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectCommunityPack(zipSync(files))).rejects.toThrow('COMMUNITY_SOURCE');
  }
});

it('retains the original precise text holds instead of admitting excluded adjacent passages through a new window', async () => {
  const { reviewedExcerpts } = await import('../src/data/corpus');
  const rules = JSON.parse(readFileSync('content/corpus/text-review-rules.json', 'utf8')).records;
  for (const bank of await heardBanks()) {
    const source = bank.records[0], clip = source.clips[0], rule = rules.find((r: { rootId: string }) => r.rootId === source.rootId);
    expect(rule.decision).toBe('accepted-text'); expect(rule.excludedSpans.length).toBeGreaterThan(0);
    for (const hold of rule.excludedSpans) {
      const text = source.originalText!.slice(hold.start, hold.end);
      expect(await reviewedExcerpts(source, [{ text }])).toEqual([]);
    }
    expect(await reviewedExcerpts({ ...source, originalText: undefined }, [clip])).toEqual([]);
    expect(await reviewedExcerpts({ ...source, sourceHash: '0'.repeat(64) }, [clip])).toEqual([]);
    expect(await reviewedExcerpts(source, [clip])).toEqual([clip]);
  }
});

it('keeps recording speakers separate from article authors, including the omitted speaker template parameter', async () => {
  const expected = new Map([['wikipedia-article-361239', 'The Modeler'], ['wikipedia-article-344149', 'User:Shayday~enwiki']]);
  for (const bank of await heardBanks()) for (const source of bank.records) {
    const clip = source.clips[0], author = expected.get(source.rootId)!;
    expect(clip.audio.author).toBe(author); expect(clip.audio.author).not.toContain('Authors of the article');
    expect(clip.credit.attribution).toContain(author); expect(source.attribution).not.toBe(author);
    const scope = scopes.listening.find(s => s.rootId === source.rootId)!;
    expect(scope.audio.author).toBe(author); expect(scope.credit.attribution).toBe(clip.credit.attribution);
  }
});
