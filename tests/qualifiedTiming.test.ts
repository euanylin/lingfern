import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusQualifiedTiming, corpusLesson, corpusSchema } from '../src/core/corpus';
import { qualifiedTimingPrompt, corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { advance, attempts, claimSession, createSession, db, exposures, markExposure, sessions, submit, type Attempt, type Session } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';

const operation = 'choice:qualified-timing';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const pg = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
const agency = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')));
const shortIds = ['384791af263672c098c013f505cb2dd17ee94cca8a3506c72d4893942696f801', '7f12d83a8b2e9e2dd95af5bcb5b782a03fe22a2e802ac52ef3e426885362843d'];
const longId = 'feef72ffc91f662bafea9e284bbd90e1e32f746dc8daba73bf415cc74016ecc7';
const originals = [pg.records.find(source => source.rootId === 'gutenberg-book-1228')!, agency.records.find(source => source.rootId === 'noaa-article-217121916223523')!];
const bank = { ...pg, records: originals.map(source => ({ ...source, passages: source.passages.filter(passage => shortIds.includes(passage.id)) })) };
const longBank = { ...bank, records: bank.records.map((source, index) => index === 0 ? { ...source, passages: [originals[0].passages.find(passage => passage.id === longId)!] } : source) };
const texts = [...bank.records.map(source => source.passages[0].text), longBank.records[0].passages[0].text];

it('retains actual acquired texts, source hashes and complete prepared long boundaries', async () => {
  expect(bank.records.map(source => source.passages[0].wordCount)).toEqual([404, 287]);
  expect((await reviewedReading(bank.records, 900)).map(source => source.rootId).sort()).toEqual(originals.map(source => source.rootId).sort());
  expect(sha(readFileSync('content/corpus/raw/pg1228.txt'))).toBe(originals[0].sourceHash);
  expect(sha(readFileSync('content/corpus/additional/raw/noaa-217121916223523.html'))).toBe(originals[1].sourceHash);
  for (const text of texts) expect([longId, ...shortIds]).toContain(sha(text));
  const scope = JSON.parse(readFileSync('content/corpus/gutenberg-long-scopes.json', 'utf8')).records.find((scope: { textSha256: string }) => scope.textSha256 === longId);
  expect(scope.words).toBe(1012); expect(scope.passages).toHaveLength(3);
  for (const id of scope.passages) expect(texts[2]).toContain(originals[0].passages.find(passage => passage.id === id)!.text);
  expect(texts[2]).toContain('Mr. Birch informs me'); expect(texts[2]).toContain('previous dynasty');
});

it('preserves distinct estimate/date qualifications, complete scope, all numbers and the independent lower bound', () => {
  for (const text of texts) for (let seed = 0; seed < 12; seed++) {
    const task = corpusQualifiedTiming(text, seed)!;
    expect(task).toEqual(corpusQualifiedTiming(text, seed)); expect(task.prompt).toBe(qualifiedTimingPrompt);
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(task.sentence);
    expect(new Set(task.options).size).toBe(3);
    for (const option of task.options) expect(option.match(/\d[\d,]*/g)).toEqual(task.sentence.match(/\d[\d,]*/g));
    if (task.sentence.startsWith('It takes')) {
      expect(task.options[task.answer]).toBe('A parcel (any given cubic meter) of water is estimated to take 1,000 years to complete its journey along the belt.');
      expect(task.otherEvidence).toHaveLength(1);
      const anchor = text.slice(task.otherEvidence[0].start, task.otherEvidence[0].end);
      expect(anchor).toContain('Tidal currents'); expect(anchor).toContain('Surface currents'); expect(anchor).toContain('global conveyor belt');
      expect(task.options.filter((_, index) => index !== task.answer)).toContain('A parcel (any given cubic meter) of water takes exactly 1,000 years to complete its journey along the belt.');
      expect(task.options.some(option => /approximately|every parcel/i.test(option))).toBe(false);
    } else {
      expect(task.options[task.answer]).toBe(task.sentence.replace('about the year', 'around the year'));
      expect(task.options.every(option => option.endsWith('never less than 20,000 pigeons were taken with the court.'))).toBe(true);
      expect(task.options.filter((_, index) => index !== task.answer).some(option => option.includes('by everyone in India'))).toBe(true);
      expect(task.options.some(option => /BCE|CE|3000|at most|exactly 20,000/.test(option))).toBe(false);
    }
  }
});

it('withholds uninspected syntax, quoted/reported/conditional targets, missing context and duplicate targets', () => {
  for (const text of bank.records.map(source => source.passages[0].text)) {
    const task = corpusQualifiedTiming(text, 0)!, sentence = task.sentence;
    const invalid = [text.replace(sentence, 'If ' + sentence), text.replace(sentence, 'The author said that ' + sentence), text.replace(sentence, '“' + sentence + '”'), '“' + text,
      text.replace(sentence, sentence + ' ' + sentence), text.replace(sentence, sentence.replace('estimated', 'approximately').replace('about the year', 'in exactly')),
      text.replace(sentence, sentence.replace('It takes', 'It might take').replace('were much valued', 'were not much valued')),
      text.replace(sentence, sentence.replace('years', 'seconds').replace('much valued', 'first recorded'))];
    if (sentence.startsWith('It takes')) invalid.push(sentence, text.replace('Tidal currents occur', 'Tidal currents may occur'), text.replace('(any given cubic meter)', '(some cubic meter)'), text.replace('1,000 years', '1,000 year'), text.replace('1,000 years', '1 years'));
    else invalid.push(text.replace('never less than', 'at most'), ...['Everyone', 'Every Person', 'All People', 'Each Person', 'Everybody', 'The Whole Population', 'The Entire Population', 'Both Parents', 'No Person'].map(actor => text.replace('Akber Khan', actor)), text.replace('the year 1600', 'the year 1600 BCE'));
    for (const value of invalid) expect(corpusQualifiedTiming(value, 0), value).toBeUndefined();
  }
  expect(corpusQualifiedTiming('In this account, The Whole Population means every person in India. ' + texts[0].replace('Akber Khan', 'The Whole Population'), 0)).toBeUndefined();
  for (const seed of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusQualifiedTiming('', seed)).toThrow('INVALID_CORPUS_QUALIFIED_TIMING');
  expect(() => corpusQualifiedTiming('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_QUALIFIED_TIMING'); expect(corpusQualifiedTiming('', 0)).toBeUndefined();
});

it('rejects real non-temporal about/second and the attributed conflicting earliest record', () => {
  for (const id of ['ef7a4e06c06c1bcb0ef2789316d9acc784a3f57cfbb77f8bd55a51a13f684193', '8f1886d3af1b4821f989d288ad111c9eb1d90897832a4042f5a1d4ad1ff4da12']) {
    const source = agency.records.find(source => source.passages.some(part => part.id === id))!, passage = source.passages.find(part => part.id === id)!;
    expect(sha(passage.text)).toBe(id); expect(sha(readFileSync(`content/corpus/additional/raw/${source.id}.html`))).toBe(source.sourceHash);
    for (let seed = 0; seed < 3; seed++) expect(corpusQualifiedTiming(passage.text, seed)).toBeUndefined();
  }
  const text = texts[0].slice(987, 1298); expect(sha(text)).toBe('14b70759ba4cbfcff4d7ccdf5124c40d20e8e685fa91b24852e896b89ac23d33');
  expect(corpusQualifiedTiming(text, 0)).toBeUndefined();
});

it('uses genuine same-operation roots at C1/C2, identical Test scoring and unscored interpretation', () => {
  for (const point of ['C1', 'C2'] as const) for (const actual of point === 'C1' ? [bank] : [bank, longBank]) for (const seed of [0, 1, 2, 54, 55, 126, 127]) {
    const forced = seed < 3, lesson = corpusLesson(actual, new Set(), seed, point === 'C1' ? 900 : 1200, point, [], forced ? 'choice' : undefined, forced ? operation : undefined)!;
    lessonSchema.parse(lesson); expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual([operation, operation]);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.teaching!.en).toContain('minimum bounds'); expect(lesson.goal.en).toContain('timing qualification');
    const test = asTestLesson(lesson); expect(test.materials.map(material => material.blocks)).toEqual(lesson.materials.map(material => material.blocks));
    for (const [index, { material, question }] of questions(lesson).entries()) {
      expect(question.id.length).toBeLessThanOrEqual(80); expect(question.evidence).toBeDefined();
      const tested = [...questions(test)][index].question;
      if ('kind' in question) { expect(question.kind).toBe('response'); expect(score(question, 'I retain the timing and its scope.').correct).toBeNull(); }
      else for (let option = 0; option < 3; option++) { expect(score(question, option).correct).toBe(option === question.answer); expect(score(tested, option)).toEqual(score(question, option)); }
      expect(tested.hints).toBeUndefined(); expect(material.blocks[0].text.slice(question.evidence!.start, question.evidence!.end).length).toBeGreaterThan(100);
    }
  }
  const emptyNlp = { ...bank, records: bank.records.map(source => ({ ...source, passages: source.passages.map(passage => ({ ...passage, language: { generator: 'spacy-3.8.16/en_core_web_sm-3.8.0' as const, modelSha256: '0'.repeat(64), reviewStatus: 'pending' as const, tokens: [] } })) })) };
  corpusSchema.parse(emptyNlp);
  expect(corpusLesson(emptyNlp, new Set(), 54, 1200, 'C2', [], 'choice', operation)!.materials.map(material => corpusOperation(material.questions[0]))).toEqual([operation, operation]);
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) expect(corpusLesson(bank, new Set(), 54, 1200, point, [], 'choice', operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(shortIds), 32, 1200, 'C2', [], 'choice', operation)).toBeUndefined();
});

it('keeps ordinary practice usable without a timing partner and installed application preserves the primary', () => {
  const other = agency.records.find(source => source.rootId === 'noaa-article-79852449220319')!;
  const one = { ...bank, records: [bank.records[0], other] }, lesson = corpusLesson(one, new Set(), 54, 1200, 'C2')!;
  expect(lesson).toBeDefined(); expect(lesson.materials[0].rootId).toBe(bank.records[0].rootId);
  expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === 'completion')).toBe(true);
  expect(corpusLesson(one, new Set(), 54, 1200, 'C2', [], 'choice', operation)).toBeUndefined();
  const installed = corpusLesson(one, new Set(), 54, 1200, 'C2', [], undefined, undefined, bank)!;
  expect(installed.materials[0].rootId).toBe(lesson.materials[0].rootId); expect(installed.materials[0].blocks).toEqual(lesson.materials[0].blocks);
  expect(installed.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
});

it('generates deterministic bounded choices from runtime slots for arbitrary seeds', () => {
  fc.assert(fc.property(fc.constantFrom(...texts), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusQualifiedTiming(text, seed)!; expect(task).toEqual(corpusQualifiedTiming(text, seed)); expect(new Set(task.options).size).toBe(3);
    expect(task.options[task.answer]).not.toContain('exactly'); expect(task.options[task.answer]).not.toContain('everyone');
  }), { numRuns: 100 });
  const changed = texts[0].replace('Akber Khan', 'Jordan Smith').replace('1600', '1700').replace('20,000', '30,000');
  expect(corpusQualifiedTiming(changed, 0)!.options[0]).toContain('Jordan Smith in India, around the year 1700; never less than 30,000');
  expect(corpusQualifiedTiming(texts[1].replace('1,000', '2,000'), 0)!.options[0]).toContain('2,000 years');
  expect(corpusQualifiedTiming(texts[1].replace('1,000 years', '1 year'), 0)!.options[0]).toContain('1 year');
});

it('saves actual Practice/Test transactions, exposures and recoverable snapshots', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(longBank, new Set(), 54, 1200, 'C2')!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profileId = `timing-db-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profileId);
      let current: Session = await claimSession(session.id, 'timing-owner');
      for (const [index, { material, question }] of questions(lesson).entries()) {
        expect(current.position).toBe(index); await markExposure(current);
        expect((await exposures.get([profileId, material.rootId]))!.contacts).toContainEqual(expect.objectContaining({ questionId: question.id }));
        const saved = await submit(session.id, 'timing-owner', 'kind' in question ? 'I keep the qualified time and separate quantity bound.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true); expect(await attempts.get(saved.id)).toEqual(saved);
        expect((await sessions.get(session.id))!.position).toBe(index); current = await advance(session.id, 'timing-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profileId));
      expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(4);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('recommends qualification fidelity only for advanced reading while preserving saved data', () => {
  const lesson = corpusLesson(bank, new Set(), 54, 1200, 'C2')!, at = new Date(Date.now() - 10000).toISOString();
  const session: Session = { id: 'timing-history', profileId: 'isolated-timing', lesson, contentHash: 'a'.repeat(64), position: 3, status: 'completed', startedAt: at, assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(material => {
    const question = material.questions[0]; if ('kind' in question) throw Error('Expected choice'); const answer = (question.answer + 1) % 3;
    return { id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, questionId: question.id, rootId: material.rootId, answer, ...score(question, answer), assistance: { hintLevel: 0 }, submittedAt: at };
  });
  const snapshot = JSON.stringify({ session, records });
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
    const route = corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', point);
    if (point === 'C1' || point === 'C2') expect(route.focus).toMatchObject({ operation, kind: 'choice', reason: 'reteach' }); else expect(route.focus).toBeUndefined();
  }
  expect(corpusPracticeHistory([session], records, session.profileId, 'listening', 'all', 'C2').focus).toBeUndefined(); expect(JSON.stringify({ session, records })).toBe(snapshot);
});
