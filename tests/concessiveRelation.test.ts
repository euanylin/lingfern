import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusConcessiveRelation, corpusLesson, corpusMaterial, corpusSchema, selectCorpusPassage } from '../src/core/corpus';
import { concessiveRelationPrompt, corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { advance, attempts, claimSession, createSession, db, exposures, markExposure, sessions, submit, type Attempt, type Session } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';

const operation = 'choice:concessive-relation';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const all = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
const ids = ['ef202a2166b9829fd031de1fe92504ecc05d972c15b4caf2d242b002dda83e0a', '84549a31485cec2df49b4271f6550f2687d5f710956044635c18b7e85450b6c7'];
const shortIds = ['e0da49a1e832fd637ebbf4fe6484437b2afb79ae24d26f895049357d7160b861', '925ea766654e6c4fed099457bac0aa7c562a545296372687b9b58abf58b6ed69'];
const scopes = JSON.parse(readFileSync('content/corpus/gutenberg-long-scopes.json', 'utf8')).records as { bookId: number; textSha256: string; rawSha256: string; start: number; end: number; words: number; passages: string[] }[];
const bank = { ...all, records: all.records.filter(source => [84, 1228].some(id => source.rootId === `gutenberg-book-${id}`))
  .map(source => ({ ...source, passages: source.passages.filter(passage => ids.includes(passage.id)) })) };
const shortBank = { ...all, records: bank.records.map(source => ({ ...source, passages: all.records.find(record => record.id === source.id)!.passages.filter(passage => shortIds.includes(passage.id)) })) };

it('retains actual continuous source, raw hashes, both new scopes and every constituent short passage', async () => {
  expect(bank.records.map(source => source.rootId).sort()).toEqual(['gutenberg-book-1228', 'gutenberg-book-84']);
  expect((await reviewedReading(bank.records, 1200)).map(source => source.rootId).sort()).toEqual(bank.records.map(source => source.rootId).sort());
  for (const source of bank.records) {
    const passage = source.passages[0], scope = scopes.find(scope => scope.textSha256 === passage.id)!;
    const raw = readFileSync(`content/corpus/raw/pg${scope.bookId}.txt`, 'utf8');
    const body = raw.slice(raw.indexOf('\n', raw.indexOf('*** START OF')), raw.indexOf('*** END OF')).replace(/\r/g, '').normalize('NFC');
    const canonical = body.split(/\n\s*\n/).map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
    expect(sha(raw)).toBe(source.sourceHash); expect(source.sourceHash).toBe(scope.rawSha256);
    expect(passage.text).toBe(canonical.slice(scope.start, scope.end)); expect(sha(passage.text)).toBe(passage.id);
    expect(passage.wordCount).toBe(scope.bookId === 84 ? 702 : 705); expect(source.originalText).toBeUndefined();
    expect(scope.passages).toHaveLength(2);
    for (const id of scope.passages) expect(passage.text).toContain(all.records.find(record => record.id === source.id)!.passages.find(part => part.id === id)!.text);
    expect(selectCorpusPassage({ ...bank, records: [source] }, new Set([passage.id]), 0, 1200)).toBeUndefined();
    const mixed = { ...source, passages: [passage, ...shortBank.records.find(record => record.id === source.id)!.passages] };
    expect(selectCorpusPassage({ ...bank, records: [mixed] }, new Set([passage.id]), 0, 1200)).toBeUndefined();
    expect(selectCorpusPassage({ ...bank, records: [mixed] }, new Set(shortIds), 0, 1200)).toBeUndefined();
  }
});

it('changes only the unique cue and preserves the exact asserted clauses and complete adjacent antecedents', () => {
  for (const source of [...bank.records, ...shortBank.records]) for (let seed = 0; seed < 12; seed++) {
    const text = source.passages[0].text, task = corpusConcessiveRelation(text, seed)!;
    expect(task).toBeDefined(); expect(task).toEqual(corpusConcessiveRelation(text, seed));
    expect(task.prompt).toBe(concessiveRelationPrompt); expect(text.slice(task.evidence.start, task.evidence.end)).toBe(task.sentence);
    const anchor = text.slice(task.otherEvidence.start, task.otherEvidence.end);
    expect(task.otherEvidence.end).toBeLessThan(task.evidence.start);
    if (source.rootId.endsWith('-84')) {
      expect(anchor).toBe('These sublime and magnificent scenes afforded me the greatest consolation that I was capable of receiving.');
      expect(task.sentence).toContain('did not remove my grief');
    } else {
      expect(anchor).toContain('originated with Pallas'); expect(anchor).toContain('must either at first'); expect(anchor).toContain('or the hybrids must have become');
      expect(task.sentence).toContain('seems to me the most probable'); expect(task.sentence).toContain('no direct evidence');
    }
    expect(new Set(task.options).size).toBe(3);
    expect(task.options[task.answer]).toBe(task.sentence.replace('although', 'even though'));
    expect(task.options.filter((_option, index) => index !== task.answer).sort()).toEqual(['because', 'only because'].map(cue => task.sentence.replace('although', cue)).sort());
  }
});

it('transfers one actual operation across both short and long roots at existing advanced bounds and preserves Test scoring', () => {
  for (const actual of [shortBank, bank]) for (const point of ['C1', 'C2'] as const) for (const seed of [0, 1, 2, 42, 43, 114, 115]) {
    const forced = seed < 3;
    const lesson = corpusLesson(actual, new Set(), seed, point === 'C1' ? 900 : 1200, point, [], forced ? 'choice' : undefined, forced ? operation : undefined)!;
    lessonSchema.parse(lesson); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal.en).toContain('concession'); expect(lesson.teaching!.en).toContain('both clauses and their references'); expect(lesson.teaching!.en).not.toContain('action that follows');
    const original = structuredClone(lesson), tested = asTestLesson(lesson);
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const q = material.questions[0], tq = tested.materials[index].questions[0];
      if ('kind' in q || 'kind' in tq) throw Error('Expected choice');
      expect(corpusOperation(q)).toBe(operation); expect(corpusOperation(tq)).toBe(operation);
      expect(q.options).toEqual(tq.options); expect(q.answer).toBe(tq.answer); expect(q.additionalEvidence).toEqual(tq.additionalEvidence);
      expect(q.evidence).toEqual(tq.evidence); expect(tested.materials[index].blocks).toEqual(material.blocks);
      expect(q.hints).toHaveLength(3); expect(tq.hints).toBeUndefined();
      for (let answer = 0; answer < 3; answer++) { expect(score(q, answer).correct).toBe(answer === q.answer); expect(score(tq, answer)).toEqual(score(q, answer)); }
      expect(score(material.questions[1], 'The clauses coexist without an added cause.').correct).toBeNull();
      expect(material.questions[1].additionalEvidence).toEqual(q.additionalEvidence);
    }
    expect(lesson).toEqual(original);
  }
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) {
    expect(corpusLesson(bank, new Set(), 0, 1200, point, [], 'choice', operation)).toBeUndefined();
    expect(corpusMaterial({ source: bank.records[0], passage: bank.records[0].passages[0] }, 0, point, 'choice', operation)).toBeUndefined();
  }
  expect(corpusLesson({ ...bank, records: [bank.records[0]] }, new Set(), 0, 1200, 'C2', [], 'choice', operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(ids), 0, 1200, 'C2', [], 'choice', operation)).toBeUndefined();
});

it('withholds missing, mismatched, quoted, conditional, duplicate and unsupported reference frames', () => {
  for (const source of shortBank.records) {
    const text = source.passages[0].text, task = corpusConcessiveRelation(text, 0)!;
    const anchor = text.slice(task.otherEvidence.start, task.otherEvidence.end), valid = anchor + ' ' + task.sentence;
    const negative = [task.sentence, valid.replace('although', 'if'), valid.replace('although', 'because'), valid.replace('although', 'even though'),
      valid.replace('although', 'although perhaps'), valid.replace('although', 'although if'), valid.replace('although', 'although, although'),
      valid.replace(task.sentence, 'If possible, ' + task.sentence), 'The narrator said “' + valid + '”', 'The narrator said "' + valid + '"',
      valid + ' ' + valid, valid.replace(anchor, 'The meeting ended.'), valid.replace('They elevated', 'They might have elevated'),
      valid.replace('This latter alternative', 'This former alternative'), valid.replace('On this view', 'On a different view'),
      valid.replace('no direct evidence', 'direct evidence'), valid.replace('did not remove', 'did remove'),
      valid.replace('seems to me the most probable', 'is proven true'), valid.replace('must either at first', 'might at first'),
      valid.replace('or the hybrids must have become', 'or some groups remained sterile, or the hybrids must have become'),
      valid.replace(task.sentence, 'Other people watched the scene. ' + task.sentence), valid.slice(0, -1),
    ].filter(value => value !== valid);
    for (const value of negative) expect(corpusConcessiveRelation(value, 0), value).toBeUndefined();
  }
  for (const seed of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusConcessiveRelation('', seed)).toThrow('INVALID_CORPUS_CONCESSIVE_RELATION');
  expect(() => corpusConcessiveRelation('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_CONCESSIVE_RELATION');
  expect(corpusConcessiveRelation('', 0)).toBeUndefined();
});

it('rejects the actual uncertain Gulliver reference and NOAA formal-it concession', () => {
  const gulliver = all.records.find(source => source.rootId === 'gutenberg-book-829')!;
  const passage = gulliver.passages.find(part => part.id === '6fb65a953e7bc1277e51cd11300f7f2bccf235647d58b35a7a2b0be9d395bfdb')!;
  expect(sha(readFileSync('content/corpus/raw/pg829.txt'))).toBe(gulliver.sourceHash);
  expect(sha(passage.text)).toBe(passage.id); expect(passage.text).toContain('heard, or at least thought I heard');
  expect(passage.text).toContain('This gave me some faint hopes of relief, although');
  const noaa = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8'))).records.find(source => source.rootId === 'noaa-article-79852449220319')!;
  const oxygen = noaa.passages.find(part => part.id === '1c0ff25e48f872ec72d0757eedb2c3e0c3b268144a55b2498873a9866f9d450d')!;
  expect(sha(readFileSync('content/corpus/additional/raw/noaa-79852449220319.html'))).toBe(noaa.sourceHash);
  expect(sha(oxygen.text)).toBe(oxygen.id); expect(oxygen.text).toContain('It’s important to remember that although');
  for (let seed = 0; seed < 3; seed++) {
    expect(corpusConcessiveRelation(passage.text, seed)).toBeUndefined(); expect(corpusConcessiveRelation(oxygen.text, seed)).toBeUndefined();
  }
});

it('keeps ordinary practice usable without a same-operation partner while explicit focus is withheld', () => {
  const noaa = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8'))).records.find(source => source.rootId === 'noaa-article-79852449220319')!;
  const one = { ...bank, records: [bank.records[0], noaa] };
  const lesson = corpusLesson(one, new Set(), 42, 1200, 'C2')!;
  expect(lesson).toBeDefined(); expect(lesson.materials[0].rootId).toBe(bank.records[0].rootId);
  expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === 'completion')).toBe(true);
  expect(corpusLesson(one, new Set(), 42, 1200, 'C2', [], 'choice', operation)).toBeUndefined();
  const installed = corpusLesson(one, new Set(), 42, 1200, 'C2', [], undefined, undefined, bank)!;
  expect(installed.materials[0].rootId).toBe(lesson.materials[0].rootId);
  expect(installed.materials[0].blocks).toEqual(lesson.materials[0].blocks);
  expect(installed.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
});

it('keeps bounded cue generation deterministic for arbitrary seeds without source IDs', () => {
  fc.assert(fc.property(fc.constantFrom(...shortBank.records.map(source => source.passages[0].text)), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusConcessiveRelation(text, seed)!;
    expect(task).toEqual(corpusConcessiveRelation(text, seed)); expect(new Set(task.options).size).toBe(3);
    expect(task.options[task.answer]).toBe(task.sentence.replace('although', 'even though'));
    expect(text.slice(task.otherEvidence.start, task.otherEvidence.end).length).toBeGreaterThan(100);
  }), { numRuns: 100 });
});

it('saves actual Practice/Test exposure and answer transactions and exports recoverable unchanged snapshots', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 42, 1200, 'C2')!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profileId = `concession-db-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profileId);
      let current: Session = await claimSession(session.id, 'concession-owner');
      for (const [index, { material, question }] of questions(lesson).entries()) {
        expect(current.position).toBe(index); await markExposure(current);
        expect((await exposures.get([profileId, material.rootId]))!.contacts).toContainEqual(expect.objectContaining({ questionId: question.id, variantGroup: question.id }));
        expect(question.id.length).toBeLessThanOrEqual(80);
        const saved = await submit(session.id, 'concession-owner', 'kind' in question ? 'I retain the antecedent and both qualified contrasting ideas.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true); expect(await attempts.get(saved.id)).toEqual(saved);
        expect((await sessions.get(session.id))!.position).toBe(index); current = await advance(session.id, 'concession-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed');
      const backup = await inspectBackup(await exportBackup(profileId)); expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(4);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('recommends the same reading operation only at C1/C2 and leaves saved learning intact', () => {
  const lesson = corpusLesson(bank, new Set(), 42, 1200, 'C2')!, at = new Date(Date.now() - 10000).toISOString();
  const session: Session = { id: 'concession-history', profileId: 'isolated-concession', lesson, contentHash: 'a'.repeat(64), position: 3, status: 'completed', startedAt: at, assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(material => {
    const question = material.questions[0]; if ('kind' in question) throw Error('Expected choice');
    const answer = (question.answer + 1) % 3;
    return { id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, questionId: question.id, rootId: material.rootId, answer, ...score(question, answer), assistance: { hintLevel: 0 }, submittedAt: at };
  });
  const snapshot = JSON.stringify({ session, records });
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
    const route = corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', point);
    if (point === 'C1' || point === 'C2') expect(route.focus).toMatchObject({ operation, kind: 'choice', reason: 'reteach' });
    else expect(route.focus).toBeUndefined();
    expect(route.seen).toEqual(new Set(ids));
  }
  expect(corpusPracticeHistory([session], records, session.profileId, 'listening', 'all', 'C2').focus).toBeUndefined();
  expect(JSON.stringify({ session, records })).toBe(snapshot);
});
