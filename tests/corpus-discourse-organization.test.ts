import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { corpusDiscourseOrganization, discourseOrganizationOperation } from '../src/core/corpusDiscourseOrganization';
import { corpusLesson, corpusMaterial, corpusSchema, sentenceSegments } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { qualifiedLongSeconds, admittedLongClip } from '../src/core/spokenLongAdmission';
import { reviewedExcerpts, reviewedReading } from '../src/data/corpus';
import { inspectCommunityPack } from '../src/data/communityPack';
import { asTestLesson, questionSchema, lessonSchema, practiceLocale, score } from '../src/shared/content';
import scopes from '../content/corpus/c1-discourse-organization-scopes.json';
import admission from '../content/corpus/long-listening-admission.json';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function reading() {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const records = corpus.records.filter(r => scopes.reading.some(s => s.rootId === r.rootId)).map(r => ({ ...r, passages: r.passages.filter(p => scopes.reading.some(s => s.passageId === p.id)) }));
  return { ...corpus, records: await reviewedReading(records, 900) };
}
async function listening() {
  return Promise.all([['173253389', 'e9a74ab40037c9915f8b944cbbc460c46af5ada959de2e570f32ace7681fa049'], ['72723504', '5deab44e2ae2270c91d1c515cd86b485f5fb81d04a2be9522f4e85d1804e1492']].map(async ([id, hash]) => {
    const bytes = new Uint8Array(readFileSync(`tests/fixtures/c1-discourse-${id}.zip`)); expect(sha(bytes)).toBe(hash); const pack = await inspectCommunityPack(bytes); expect(pack.lessons).toEqual([]);
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await reviewedExcerpts(r, r.clips) }))) };
  }));
}
it('generates different structural comparisons while retaining the complete contexts and rejects every wrong role mapping', () => {
  for (const scope of [...scopes.reading, ...scopes.listening]) {
    expect(sha(scope.text)).toBe(scope.textSha256); expect(scope.parts.every(p => !/overview|background|proposal/i.test(p.label))).toBe(true); const variants = new Set<string>();
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const f = corpusDiscourseOrganization(scope.text, seed)!; expect(f).toBeDefined();
      const q = questionSchema.parse({ kind: 'matching', id: 'discourse', blockId: 'block', prompt: f.prompt, pairs: f.pairs, choices: f.choices, evidence: f.evidence, explanation: f.explanation, additionalEvidence: f.otherEvidence.map(e => ({ blockId: 'block', ...e })) });
      if (!('pairs' in q)) throw Error('Expected matching'); variants.add(JSON.stringify(q.pairs));
      expect(score(q, q.pairs.map(p => p.answer)).correct).toBe(true);
      for (const [i, p] of q.pairs.entries()) for (const wrong of q.choices.filter(c => c !== p.answer)) { const answer = q.pairs.map(p => p.answer); answer[i] = wrong; expect(score(q, answer).correct).toBe(false); }
      const spans = [q.evidence, ...q.additionalEvidence!]; for (const e of spans) expect(scope.text.slice(e.start, e.end).length).toBeGreaterThan(30); expect(spans.reduce((n, e) => n + e.end - e.start, 0)).toBeLessThan(scope.text.length * .8);
      for (const l of ['en', 'zh-Hans', 'zh-Hant'] as const) expect(q.explanation[l].length).toBeGreaterThan(100);
    }), { numRuns: 100 });
    if (scope.parts.length === 3) expect(variants.size).toBe(4);
    for (const changed of [scope.text.slice(10), scope.text + scope.text, scope.text.replace('the', 'some'), scope.text + ' Unrelated material.']) expect(corpusDiscourseOrganization(changed, 0)).toBeUndefined();
  }
  for (const seed of [-1, .5, 0x100000000, NaN]) expect(() => corpusDiscourseOrganization(scopes.reading[0].text, seed)).toThrow('INVALID_DISCOURSE_ORGANIZATION');
  expect(corpusDiscourseOrganization('First Monday, then Tuesday. Therefore all things always improve.', 0)).toBeUndefined();
});
it('pairs the same reading operation across two independent originals, preserving hypotheses, narrative progression and Test conditions', async () => {
  const corpus = await reading(); expect(corpus.records).toHaveLength(2);
  for (const seed of [0, 1, 2, 3, 0xffffffff]) {
    const lesson = corpusLesson(corpus, new Set(), seed, 900, 'C1', [], 'matching', discourseOrganizationOperation)!;
    expect(lesson.goalId).toBe('discourse-organization-in-context'); lessonSchema.parse(lesson);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    for (const [i, m] of lesson.materials.entries()) { expect(corpusOperation(m.questions[0])).toBe(discourseOrganizationOperation); expect(m.questions[0].hints?.length).toBe(i ? undefined : 3); expect(m.blocks[0].text).toBe(scopes.reading.find(s => s.rootId === m.rootId)!.text); }
    for (const l of ['en', 'zh-Hans', 'zh-Hant'] as const) { expect(practiceLocale(lesson, l)).toBe('en'); for (const field of ['goal', 'teaching', 'workedExample', 'nextStep'] as const) expect(lesson[field]![l].length).toBeGreaterThan(30); }
    expect(asTestLesson(lesson).materials).toEqual(lesson.materials.map(m => ({ ...m, questions: m.questions.map(q => { const copy = { ...q }; delete copy.hints; return copy; }) })));
  }
  const darwin = corpusDiscourseOrganization(scopes.reading.find(s => s.rootId.endsWith('1228'))!.text, 0)!;
  expect(darwin.pairs.at(-1)!.answer).toContain('lack of direct evidence');
  const novel = corpusDiscourseOrganization(scopes.reading.find(s => s.rootId.endsWith('-84'))!.text, 0)!;
  expect(novel.pairs.map(p => p.answer).join(' ')).toContain('general reflection');
  for (const source of corpus.records) for (const field of ['rootId', 'sourceHash', 'attribution', 'licence', 'originalUrl'] as const) { const bad = structuredClone(source); bad[field] = 'Changed'; expect(corpusMaterial({ source: bad, passage: bad.passages[0] }, 0, 'C1', 'matching', discourseOrganizationOperation)).toBeUndefined(); }
  for (const seen of [new Set(corpus.records[0].passages.map(p => p.id)), new Set(corpus.records[1].passages.map(p => p.id))]) expect(corpusLesson(corpus, seen, 0, 900, 'C1', [], 'matching', discourseOrganizationOperation)).toBeUndefined();
  expect(corpusLesson({ ...corpus, records: corpus.records.slice(0, 1) }, new Set(), 0, 900, 'C1', [], 'matching', discourseOrganizationOperation)).toBeUndefined();
  expect(corpusLesson(corpus, new Set(), 0, 700, 'C1', [], 'matching', discourseOrganizationOperation)).toBeUndefined();
});
it('preserves continuous reader additions separately from the unchanged written source and never exempts a text-only or forged excerpt', async () => {
  const banks = await listening(); expect(banks.every(b => b.records[0].clips.length === 1)).toBe(true);
  const source = banks[0].records[0], clip = source.clips[0]; expect(source.originalText!.includes(clip.text)).toBe(false);
  expect(clip.text).toContain('The table of contents will now be read.'); expect(clip.text).toContain('Image Map of Iowa');
  const entry = admittedLongClip(clip)!; expect('spokenTranscript' in entry).toBe(true);
  expect(await reviewedExcerpts(source, [{ text: clip.text }])).toEqual([]);
  for (const edit of [(c: typeof clip) => { c.text += ' Added.'; }, (c: typeof clip) => { c.audio.sha256 = 'f'.repeat(64); }, (c: typeof clip) => { c.segments[0].audioStart += .01; }]) { const c = structuredClone(clip); edit(c); expect(admittedLongClip(c)).toBeUndefined(); expect(spokenCorpusSchema.safeParse({ ...banks[0], records: [{ ...source, clips: [c] }] }).success).toBe(false); expect(await reviewedExcerpts(source, [c])).toEqual([]); }
  for (const edit of [{ rootId: 'wikipedia-article-1' }, { sourceHash: 'f'.repeat(64) }, { originalText: source.originalText + ' Changed.' }]) expect(await reviewedExcerpts({ ...source, ...edit }, [clip])).toEqual([]);
  const bound = admission.records.find(r => r.rootId === source.rootId)!;
  if (!('spokenTranscript' in bound) || !bound.spokenTranscript) throw Error('Missing transcript binding');
  for (const range of bound.spokenTranscript.sourceRanges) { expect(sha(range.text)).toBe(range.sha256); expect(source.originalText!.slice(range.start, range.end)).toBe(range.text); }
  const review = (await import('../content/corpus/text-review-rules.json')).default.records.find(r => r.rootId === source.rootId)!;
  const originalSpans = [...review.excludedSpans]; review.excludedSpans.push({ start: 0, end: 10, sha256: sha(source.originalText!.slice(0, 10)), reason: 'Isolated new hold test' } as typeof review.excludedSpans[number]);
  try { expect(await reviewedExcerpts(source, [clip])).toEqual([]); } finally { review.excludedSpans.splice(0, review.excludedSpans.length, ...originalSpans); }
});
it('extends effort only for the same operation on two qualified roots, without relaxing unknown clips or ordinary level conditions', async () => {
  const banks = await listening(); expect(qualifiedLongSeconds(banks, 'C1', 75)).toBe(209); expect(qualifiedLongSeconds([banks[0]], 'C1', 75)).toBe(75);
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C2']) expect(qualifiedLongSeconds(banks, point, 91)).toBe(91);
  expect(qualifiedLongSeconds(banks, 'C1', 35)).toBe(35);
  const implicit = (await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c1-implicit-115022507.zip')))).spoken!;
  expect(qualifiedLongSeconds([banks[0], implicit], 'C1', 75)).toBe(75);
  const held = structuredClone(banks[1]); held.records[0].clips[0].qualityFlags = ['Boundary unresolved']; expect(qualifiedLongSeconds([banks[0], held], 'C1', 75)).toBe(75);
  const altered = structuredClone(banks[1]); altered.records[0].sourceHash = 'f'.repeat(64); expect(qualifiedLongSeconds([banks[0], altered], 'C1', 75)).toBe(75);
  for (const [primary, application] of [banks, [...banks].reverse()]) for (const seed of [0, 1, 2, 0xffffffff]) {
    const lesson = spokenCorpusLesson(primary, new Set(), seed, 209, 'C1', [], 'matching', discourseOrganizationOperation, [application])!;
    expect(lesson.goalId).toBe('discourse-organization-in-context'); lessonSchema.parse(lesson);
    for (const m of lesson.materials) { expect(corpusOperation(m.questions[0])).toBe(discourseOrganizationOperation); for (const e of [m.questions[0].evidence, ...m.questions[0].additionalEvidence!]) { expect(e.audioEnd).toBeGreaterThan(e.audioStart!); expect(e.audioEnd).toBeLessThanOrEqual(m.audio!.duration); } }
    const test = asTestLesson(lesson); expect(test.materials.map(m => m.audio)).toEqual(lesson.materials.map(m => m.audio));
    expect(spokenCorpusLesson(primary, new Set([application.records[0].clips[0].id]), seed, 209, 'C1', [], 'matching', discourseOrganizationOperation, [application])).toBeUndefined();
    expect(spokenCorpusLesson(primary, new Set(), seed, 196, 'C1', [], 'matching', discourseOrganizationOperation, [application])).toBeUndefined();
    expect(spokenCorpusLesson(primary, new Set(), seed, 209, 'C1', [], 'matching', discourseOrganizationOperation)).toBeUndefined();
  }
});
it('commits complete matching answers before advancement and restores the exact lesson into another isolated profile', async () => {
  const { db, createSession, claimSession, markExposure, submit, advance, attempts, sessions } = await import('../src/data/db'); const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup');
  await Promise.all(db.tables.map(t => t.clear()));
  try { const lesson = corpusLesson(await reading(), new Set(), 0, 900, 'C1', [], 'matching', discourseOrganizationOperation)!;
    for (const snapshot of [lesson, asTestLesson(lesson)]) {
      const created = await createSession(snapshot, 'discourse-isolated'); let session: import('../src/data/db').Session = await claimSession(created.id, 'owner');
      for (const m of snapshot.materials) { await markExposure(session); const q = m.questions[0]; if (!('pairs' in q)) throw Error('Expected matching'); const answer = q.pairs.map(p => p.answer);
        const failure = vi.spyOn(attempts, 'add').mockRejectedValueOnce(Error('QuotaExceededError')); await expect(submit(session.id, 'owner', answer)).rejects.toThrow('QuotaExceededError'); failure.mockRestore(); expect((await sessions.get(session.id))!.position).toBe(session.position);
        const saved = await submit(session.id, 'owner', answer); expect(saved.correct).toBe(true); expect((await attempts.get(saved.id))!.answer).toEqual(answer); session = await advance(session.id, 'owner'); }
      expect(session.status).toBe('completed');
    }
    const backup = await inspectBackup(await exportBackup('discourse-isolated')); const restored = await importBackup(backup); const byMode = (a: typeof lesson, b: typeof lesson) => (a.mode ?? 'practice').localeCompare(b.mode ?? 'practice'); expect((await sessions.where('profileId').equals(restored).toArray()).map(s => s.lesson).sort(byMode)).toEqual(backup.records.sessions.map(s => s.lesson).sort(byMode)); expect(await attempts.where('profileId').equals(restored).count()).toBe(4);
  } finally { await Promise.all(db.tables.map(t => t.clear())); }
});

it('keeps discourse-organization retries at C1 and clears that incompatible focus after a chosen starting-point change in either skill', async () => {
  const { corpusPracticeHistory } = await import('../src/core/corpusPractice'); const { spokenCorpusLesson } = await import('../src/core/spokenCorpus'); const banks = await listening();
  const read = corpusLesson(await reading(), new Set(), 0, 900, 'C1', [], 'matching', discourseOrganizationOperation)!;
  const heard = spokenCorpusLesson(banks[0], new Set(), 0, 209, 'C1', [], 'matching', discourseOrganizationOperation, [banks[1]])!;
  for (const lesson of [read, heard]) {
    const profileId = `discourse-retarget-${lesson.skill}`, at = new Date(Date.now() - 1000).toISOString();
    const session: import('../src/data/db').Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-retarget-only', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: import('../src/data/db').Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if (!('pairs' in q)) throw Error('Expected matching'); return { id: q.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: q.pairs.map(p => q.choices.find(c => c !== p.answer)!), correct: false, rule: 'isolated-retarget-only', assistance: { hintLevel: 0, ...(lesson.skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', 'C1').focus).toEqual(expect.objectContaining({ operation: discourseOrganizationOperation, reason: 'reteach' }));
    for (const point of ['A1', 'A2', 'B1', 'B2', 'C2'] as const) expect(corpusPracticeHistory([session], records, profileId, lesson.skill, 'all', point).focus).toBeUndefined();
  }
});
it('rejects a changed listening source, credit, creator, original or required notice even when a package manifest is recomputed', async () => {
  const { unzipSync, zipSync } = await import('fflate');
  const bytes = new Uint8Array(readFileSync('tests/fixtures/c1-discourse-173253389.zip'));
  const rewrite = (edit: (entries: Record<string, Uint8Array>) => void) => { const entries = unzipSync(bytes); edit(entries); const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])); manifest.files = Object.fromEntries(Object.entries(entries).filter(([name]) => name !== 'manifest.json').map(([name, data]) => [name, { bytes: data.length, sha256: sha(data) }])); entries['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); return zipSync(entries); };
  await expect(inspectCommunityPack(rewrite(entries => { delete entries['c1-discourse-listening-NOTICE.md']; }))).rejects.toThrow('COMMUNITY_SOURCE');
  await expect(inspectCommunityPack(rewrite(entries => { const spoken = JSON.parse(new TextDecoder().decode(entries['spoken.json'])); spoken.records[0].originalText += ' Changed source.'; entries['spoken.json'] = new TextEncoder().encode(JSON.stringify(spoken)); }))).rejects.toThrow('COMMUNITY_SOURCE');
  const banks = await listening();
  for (const edit of [
    (b: typeof banks[number]) => { b.records[0].sourceHash = 'f'.repeat(64); },
    (b: typeof banks[number]) => { b.records[0].attribution += ' Forged credit.'; },
    (b: typeof banks[number]) => { b.records[0].clips[0].credit.attribution += ' Forged voice.'; },
    (b: typeof banks[number]) => { b.records[0].clips[0].audio.author = 'Unverified narrator'; },
    (b: typeof banks[number]) => { b.records[0].clips[0].audio.duration += .001; },
  ]) { const broken = structuredClone(banks[0]); edit(broken); expect(spokenCorpusLesson(broken, new Set(), 0, 209, 'C1', [], 'matching', discourseOrganizationOperation, [banks[1]])).toBeUndefined(); }
});
it('keeps legal initials and both reported experts inside complete evidence sentences, without crossing paragraphs or speaker turns', () => {
  const darwin = scopes.reading.find(s => s.rootId.endsWith('1228'))!, iowa = scopes.listening.find(s => s.rootId.endsWith('76546697'))!;
  for (const scope of [darwin, iowa]) {
    const q = corpusDiscourseOrganization(scope.text, 0)!;
    const quotes = [q.evidence, ...q.otherEvidence].map(e => scope.text.slice(e.start, e.end));
    expect(quotes.every(quote => !/(?:\bMr\.|\bCapt\.|\b[A-Z]\.)$/.test(quote))).toBe(true);
    if (scope === darwin) expect(quotes.find(q => q.includes('I am assured'))).toContain('Mr. Blyth and Capt. Hutton');
    else expect(quotes.find(q => q.includes('Supreme Court'))).toContain('less than 432 square miles, end quote.');
  }
  const text = 'The judges are Mr. Blyth and Capt. Hutton. They are reported as witnesses.';
  expect(sentenceSegments(text).map(s => s.segment.trim())).toEqual(['The judges are Mr. Blyth and Capt. Hutton.', 'They are reported as witnesses.']);
  for (const separator of ['\n\n', '\nMina: ']) { const source = 'The case was L.K.' + separator + 'Rita described another subject.'; const segments = sentenceSegments(source); expect(segments.map(s => s.segment).join('')).toBe(source); expect(segments[0].segment.trim()).toBe('The case was L.K.'); expect(segments.every(s => !s.segment.includes('L.K.') || !s.segment.includes('Rita'))).toBe(true); }
});
