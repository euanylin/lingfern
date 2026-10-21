import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { corpusArgumentBoundaries, argumentBoundariesOperation } from '../src/core/corpusArgumentBoundaries';
import { corpusLesson, corpusMaterial } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { qualifiedLongSeconds, admittedLongClip } from '../src/core/spokenLongAdmission';
import { reviewedExcerpts, reviewedReading } from '../src/data/corpus';
import { inspectCommunityPack } from '../src/data/communityPack';
import { asTestLesson, questionSchema, lessonSchema, practiceLocale, score } from '../src/shared/content';
import scopes from '../content/corpus/c1-argument-boundaries-scopes.json';
import reviews from '../content/corpus/text-review-rules.json';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function reading() {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/c1-argument-reading-contexts.zip'));
  expect(sha(bytes)).toBe('7240d1488272899609bf96a73475e46fb9c23643e15929018ebc369b0c70fac4');
  const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
  return { ...pack.corpus!, records: await reviewedReading(pack.corpus!.records, 900) };
}
async function listening() {
  return Promise.all([['80901053', 'd79301122177cc098c3acfd70eda3d02ba6b386ad8feb05451dea07c40da52dd'], ['32907235', 'd6b1e16ffd9b266ba0910401328bc641a33ce66b90632450e1462909bc78720f']].map(async ([id, hash]) => {
    const bytes = new Uint8Array(readFileSync(`tests/fixtures/c1-argument-${id}.zip`)); expect(sha(bytes)).toBe(hash); const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await reviewedExcerpts(r, r.clips) }))) };
  }));
}
it('derives four contextual comparisons per original, rejects all wrong matches and refuses incomplete premises and unsupported universalization', () => {
  for (const scope of [...scopes.reading, ...scopes.listening]) {
    expect(sha(scope.text)).toBe(scope.textSha256); const variants = new Set<string>();
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const f = corpusArgumentBoundaries(scope.text, seed)!; expect(f).toBeDefined();
      const q = questionSchema.parse({ kind: 'matching', id: 'register', blockId: 'block', prompt: f.prompt, pairs: f.pairs, choices: f.choices, evidence: f.evidence, explanation: f.explanation, additionalEvidence: f.otherEvidence.map(e => ({ blockId: 'block', ...e })) });
      if (!('pairs' in q)) throw Error('Expected matching'); variants.add(JSON.stringify(q.pairs)); expect(q.choices.join(' ')).not.toMatch(/\b(?:worker|wealth|prosperity|complexity|corrosion|calendar|city|orbital|comet|reservoir)\b/i); expect(score(q, q.pairs.map(p => p.answer)).correct).toBe(true);
      for (const [i, p] of q.pairs.entries()) for (const wrong of q.choices.filter(c => c !== p.answer)) { const answer = q.pairs.map(p => p.answer); answer[i] = wrong; expect(score(q, answer).correct).toBe(false); }
      for (const span of [q.evidence, ...q.additionalEvidence!]) expect(scope.text.slice(span.start, span.end).length).toBeGreaterThan(10);
      for (const l of ['en', 'zh-Hans', 'zh-Hant'] as const) expect(q.explanation[l].length).toBeGreaterThan(100);
    }), { numRuns: 100 });
    expect(variants.size).toBe(4);
    const explanation = corpusArgumentBoundaries(scope.text, 0)!.explanation.en.toLowerCase();
    const required = scope.rootId.endsWith('3300') ? ['boy', 'makers', 'well-governed'] : scope.rootId.endsWith('205') ? ['necessities', 'wealth', 'well employed'] : scope.rootId.endsWith('89732') ? ['undiscovered', 'syracuse', 'believed'] : ['instability', 'probably', 'peak'];
    for (const word of required) expect(explanation).toContain(word);
    for (const changed of [scope.text.slice(10), scope.text + scope.text, scope.text.replace('the', 'some'), scope.text + ' Another audience.']) expect(corpusArgumentBoundaries(changed, 0)).toBeUndefined();
  }
  for (const text of ['It seems likely, therefore every case is proved.', scopes.reading[0].text.replace('in a well-governed society', 'in every society')]) expect(corpusArgumentBoundaries(text, 0)).toBeUndefined();
  for (const seed of [-1, .5, 0x100000000, NaN]) expect(() => corpusArgumentBoundaries(scopes.reading[0].text, seed)).toThrow('INVALID_ARGUMENT_BOUNDARIES');
  const smith = corpusArgumentBoundaries(scopes.reading[0].text, 0)!; expect(smith.pairs.map(p => p.answer).join(' ')).toContain('narrow claim');
  const walden = corpusArgumentBoundaries(scopes.reading[1].text, 0)!; expect(walden.pairs.map(p => p.answer).join(' ')).toContain('one trait'); expect(walden.pairs.map(p => p.answer)).toContain('A new possibility is considered from a stated starting condition'); expect(walden.explanation.en).toContain('not necessarily the only possible condition');
  const oort = scopes.listening.find(s => s.rootId.endsWith('22385'))!, frame = corpusArgumentBoundaries(oort.text, 0)!;
  for (const e of [frame.evidence, ...frame.otherEvidence]) expect(oort.text.slice(e.start, e.end)).not.toMatch(/independently reviewed|must have had an outer reservoir|Hunrich|reasoned aught/);
});
it('preserves complete native arguments, exact independent originals, no leaked target examples and Practice/Test snapshots', async () => {
  const corpus = await reading(); expect(corpus.records).toHaveLength(2);
  for (const seed of [0, 1, 2, 3, 0xffffffff]) {
    const lesson = corpusLesson(corpus, new Set(), seed, 900, 'C1', [], 'matching', [], argumentBoundariesOperation)!; expect(lesson.goalId).toBe('argument-boundaries-in-context'); lessonSchema.parse(lesson);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    for (const [i, m] of lesson.materials.entries()) { expect(corpusOperation(m.questions[0])).toBe(argumentBoundariesOperation); expect(m.questions[0].hints?.length).toBe(i ? undefined : 3); expect(m.blocks[0].text).toBe(scopes.reading.find(s => s.rootId === m.rootId)!.text); expect(lesson.workedExample!.en).not.toContain(m.blocks[0].text.slice(0, 30)); }
    for (const l of ['en', 'zh-Hans', 'zh-Hant'] as const) { expect(practiceLocale(lesson, l)).toBe('en'); for (const field of ['goal', 'teaching', 'workedExample', 'nextStep'] as const) expect(lesson[field]![l].length).toBeGreaterThan(30); }
    expect(asTestLesson(lesson).materials).toEqual(lesson.materials.map(m => ({ ...m, questions: m.questions.map(q => { const copy = { ...q }; delete copy.hints; return copy; }) })));
  }
  expect(corpus.records[0].passages[0].text).toContain('in a well-governed society'); expect(corpus.records[1].passages[0].text).toContain('I do not speak to those who are well employed');
  for (const source of corpus.records) for (const field of ['rootId', 'sourceHash', 'attribution', 'licence', 'originalUrl'] as const) { const bad = structuredClone(source); bad[field] = 'Changed'; expect(corpusMaterial({ source: bad, passage: bad.passages[0] }, 0, 'C1', 'matching', argumentBoundariesOperation)).toBeUndefined(); }
  for (const source of corpus.records) expect(corpusLesson(corpus, new Set(source.passages.map(p => p.id)), 0, 900, 'C1', [], 'matching', [], argumentBoundariesOperation)).toBeUndefined();
  expect(corpusLesson({ ...corpus, records: corpus.records.slice(0, 1) }, new Set(), 0, 900, 'C1', [], 'matching', [], argumentBoundariesOperation)).toBeUndefined();
  expect(corpusLesson(corpus, new Set(), 0, 500, 'C1', [], 'matching', [], argumentBoundariesOperation)).toBeUndefined();
});
it('bounds new transcript bindings by the unchanged original and remainder holds, preserves holds and never grants audio identity to text-only input', async () => {
  const banks = await listening(); expect(banks.every(b => b.records[0].clips.length === 1)).toBe(true);
  for (const bank of banks) { const source = bank.records[0], clip = source.clips[0], entry = admittedLongClip(clip)!; expect(entry.rootId).toBe(source.rootId);
    expect(admittedLongClip({ text: clip.text })).toBeUndefined();
    // Text eligibility does not grant audio qualification.
    if (!source.originalText!.includes(clip.text)) expect(await reviewedExcerpts(source, [{ text: clip.text }])).toEqual([]);
    for (const edit of [{ rootId: 'wikipedia-article-1' }, { sourceHash: 'f'.repeat(64) }, { originalText: source.originalText + ' Changed.' }]) expect(await reviewedExcerpts({ ...source, ...edit }, [clip])).toEqual([]);
    const review = reviews.records.find(r => r.rootId === source.rootId)!; expect(review.excludedSpans.length).toBeGreaterThan(0); const held = review.excludedSpans[0]; expect(await reviewedExcerpts(source, [{ text: source.originalText!.slice(held.start, held.end) }])).toEqual([]);
    const originalSpans = [...review.excludedSpans]; const bound = admittedLongClip(clip)!; if (!('spokenTranscript' in bound) || !bound.spokenTranscript) throw Error('Missing source binding'); const at = bound.spokenTranscript.sourceRanges[0].start; review.excludedSpans.push({ start: at, end: at + 10, sha256: sha(source.originalText!.slice(at, at + 10)) } as typeof review.excludedSpans[number]);
    try { expect(await reviewedExcerpts(source, [clip])).toEqual([]); } finally { review.excludedSpans.splice(0, review.excludedSpans.length, ...originalSpans); }
    for (const edit of [(c: typeof clip) => { c.text += ' Added.'; }, (c: typeof clip) => { c.audio.sha256 = 'f'.repeat(64); }, (c: typeof clip) => { c.segments[0].audioStart += .01; }]) { const c = structuredClone(clip); edit(c); expect(admittedLongClip(c)).toBeUndefined(); expect(spokenCorpusSchema.safeParse({ ...bank, records: [{ ...source, clips: [c] }] }).success).toBe(false); if (!source.originalText!.includes(c.text)) expect(await reviewedExcerpts(source, [c])).toEqual([]); }
  }
});
it('uses the same listening operation only on two exact usable originals and preserves source-bound timed evidence', async () => {
  const banks = await listening(); expect(qualifiedLongSeconds(banks, 'C1', 75)).toBe(196); expect(qualifiedLongSeconds([banks[0]], 'C1', 75)).toBe(75);
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C2']) expect(qualifiedLongSeconds(banks, point, 91)).toBe(91);
  const held = structuredClone(banks[1]); held.records[0].clips[0].qualityFlags = ['Boundary unresolved']; expect(qualifiedLongSeconds([banks[0], held], 'C1', 75)).toBe(75);
  for (const [primary, application] of [banks, [...banks].reverse()]) for (const seed of [0, 1, 2, 0xffffffff]) {
    const lesson = spokenCorpusLesson(primary, new Set(), seed, 196, 'C1', [], 'matching', [], argumentBoundariesOperation, [application])!;
    expect(lesson.goalId).toBe('argument-boundaries-in-context'); lessonSchema.parse(lesson);
    for (const m of lesson.materials) { expect(corpusOperation(m.questions[0])).toBe(argumentBoundariesOperation); for (const e of [m.questions[0].evidence, ...m.questions[0].additionalEvidence!]) { expect(e.audioEnd).toBeGreaterThan(e.audioStart!); expect(e.audioEnd).toBeLessThanOrEqual(m.audio!.duration); } }
    expect(asTestLesson(lesson).materials.map(m => m.audio)).toEqual(lesson.materials.map(m => m.audio));
    expect(spokenCorpusLesson(primary, new Set([application.records[0].clips[0].id]), seed, 196, 'C1', [], 'matching', [], argumentBoundariesOperation, [application])).toBeUndefined();
    expect(spokenCorpusLesson(primary, new Set(), seed, 120, 'C1', [], 'matching', [], argumentBoundariesOperation, [application])).toBeUndefined();
    expect(spokenCorpusLesson(primary, new Set(), seed, 196, 'C1', [], 'matching', [], argumentBoundariesOperation)).toBeUndefined();
    const altered = structuredClone(application); altered.records[0].attribution += ' Changed'; expect(spokenCorpusLesson(primary, new Set(), seed, 196, 'C1', [], 'matching', [], argumentBoundariesOperation, [altered])).toBeUndefined();
  }
});
it('commits full answers transactionally, preserves failed-save input and recovers exact snapshots in an isolated new profile', async () => {
  const { db, createSession, claimSession, markExposure, submit, advance, attempts, sessions } = await import('../src/data/db'); const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup');
  await Promise.all(db.tables.map(t => t.clear()));
  try { const lesson = corpusLesson(await reading(), new Set(), 0, 900, 'C1', [], 'matching', [], argumentBoundariesOperation)!;
    for (const snapshot of [lesson, asTestLesson(lesson)]) {
      const created = await createSession(snapshot, 'argument-isolated'); let session: import('../src/data/db').Session = await claimSession(created.id, 'owner');
      for (const m of snapshot.materials) { await markExposure(session); const q = m.questions[0]; if (!('pairs' in q)) throw Error('Expected matching'); const answer = q.pairs.map(p => p.answer);
        const failure = vi.spyOn(attempts, 'add').mockRejectedValueOnce(Error('QuotaExceededError')); await expect(submit(session.id, 'owner', answer)).rejects.toThrow('QuotaExceededError'); failure.mockRestore(); expect((await sessions.get(session.id))!.position).toBe(session.position);
        const saved = await submit(session.id, 'owner', answer); expect(saved.correct).toBe(true); expect((await attempts.get(saved.id))!.answer).toEqual(answer); session = await advance(session.id, 'owner'); }
      expect(session.status).toBe('completed');
    }
    const backup = await inspectBackup(await exportBackup('argument-isolated')); const restored = await importBackup(backup); const byMode = (a: typeof lesson, b: typeof lesson) => (a.mode ?? 'practice').localeCompare(b.mode ?? 'practice'); expect((await sessions.where('profileId').equals(restored).toArray()).map(s => s.lesson).sort(byMode)).toEqual(backup.records.sessions.map(s => s.lesson).sort(byMode)); expect(await attempts.where('profileId').equals(restored).count()).toBe(4);
  } finally { await Promise.all(db.tables.map(t => t.clear())); }
});
it('clears the goal focus when the chosen starting point changes away from C1 in either skill', async () => {
  const banks = await listening(), lessons = [corpusLesson(await reading(), new Set(), 0, 900, 'C1', [], 'matching', [], argumentBoundariesOperation)!, spokenCorpusLesson(banks[0], new Set(), 0, 196, 'C1', [], 'matching', [], argumentBoundariesOperation, [banks[1]])!];
  for (const lesson of lessons) { const profileId = 'argument-retarget-'+lesson.skill, at = new Date(Date.now() - 1000).toISOString();
    const session: import('../src/data/db').Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-retarget-only', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: import('../src/data/db').Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if (!('pairs' in q)) throw Error('Expected matching'); return { id: q.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: q.pairs.map(p => q.choices.find(c => c !== p.answer)!), correct: false, rule: 'isolated-retarget-only', assistance: { hintLevel: 0, ...(lesson.skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', 'C1').focus).toEqual(expect.objectContaining({ operation: argumentBoundariesOperation, reason: 'reteach' }));
    for (const point of ['A1', 'A2', 'B1', 'B2', 'C2'] as const) expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', point).focus).toBeUndefined();
  }
});
it('rejects altered provenance and missing scoped notices even if an importer recomputes every package member hash', async () => {
  const { unzipSync, zipSync } = await import('fflate');
  for (const name of ['80901053', '32907235']) {
    const bytes = new Uint8Array(readFileSync(`tests/fixtures/c1-argument-${name}.zip`));
    const rewrite = (edit: (files: Record<string, Uint8Array>) => void) => { const files = unzipSync(bytes); edit(files); const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])); manifest.files = Object.fromEntries(Object.entries(files).filter(([n]) => n !== 'manifest.json').map(([n, data]) => [n, { bytes: data.length, sha256: sha(data) }])); files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); return zipSync(files); };
    await expect(inspectCommunityPack(rewrite(files => { delete files['c1-argument-listening-NOTICE.md']; }))).rejects.toThrow('COMMUNITY_SOURCE');
    await expect(inspectCommunityPack(rewrite(files => { const spoken = JSON.parse(new TextDecoder().decode(files['spoken.json'])); spoken.records[0].originalText += ' Changed.'; files['spoken.json'] = new TextEncoder().encode(JSON.stringify(spoken)); }))).rejects.toThrow('COMMUNITY_SOURCE');
  }
});
