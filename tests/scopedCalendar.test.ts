import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusQualifiedTiming, corpusLesson, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';
import { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
const ids = ['475e7b09f3cc7d9742ab0acc800fdacb1a307be979a31039e33576562c8c48f5', 'feef72ffc91f662bafea9e284bbd90e1e32f746dc8daba73bf415cc74016ecc7'];
const sources = ['gutenberg-book-1342', 'gutenberg-book-1228'].map(root => corpus.records.find(source => source.rootId === root)!);
const bank = { ...corpus, records: sources.map((source, index) => ({ ...source, passages: source.passages.filter(part => part.id === ids[index]) })) };
const texts = bank.records.map(source => source.passages[0].text), operation = 'choice:qualified-timing';
it('retains exact complete acquired long windows, named-book context and all initial/revised/publication dates', () => {
  expect(bank.records.map(source => source.passages[0].wordCount)).toEqual([745, 1012]);
  for (const [index, source] of sources.entries()) {
    expect(sha(readFileSync(`content/corpus/raw/pg${index ? 1228 : 1342}.txt`))).toBe(source.sourceHash); expect(sha(texts[index])).toBe(ids[index]);
  }
  const scope = JSON.parse(readFileSync('content/corpus/gutenberg-long-scopes.json', 'utf8')).records.find((record: { bookId: number }) => record.bookId === 1342);
  expect(scope.start).toBe(2308); expect(scope.end).toBe(6814); expect(scope.words).toBe(745); expect(scope.passages).toHaveLength(3);
  for (const id of scope.passages) expect(texts[0]).toContain(sources[0].passages.find(part => part.id === id)!.text);
  const task = corpusQualifiedTiming(texts[0], 0)!;
  expect(task.evidence).toEqual({ start: 919, end: 1242 }); expect(task.sentence.length).toBe(323);
  expect(task.otherEvidence).toEqual([{ start: 0, end: 917 }]); expect(texts[0].slice(0, 917)).toContain('declare for_ Pride and Prejudice _unhesitatingly');
  expect(sha(task.sentence)).toBe('d6b5493c9f88afd42436ab57782c9de850f00c76b00b7fe80762a769ff9bbf62');
});
it('preserves full source qualifications while changing only calendar precision or first-shape scope', () => {
  for (let seed = 0; seed < 12; seed++) {
    const task = corpusQualifiedTiming(texts[0], seed)!;
    expect(task).toEqual(corpusQualifiedTiming(texts[0], seed)); expect(new Set(task.options).size).toBe(3);
    expect(task.options[task.answer]).toBe(task.sentence.replace('somewhere about', 'somewhere around'));
    expect(task.explanations[task.answer]).toContain('initial draft');
    for (const option of task.options) {
      expect(option.match(/\d+/g)).toEqual(['1796', '1813']); expect(option).toContain('barely twenty-one');
      expect(option).toContain('though it was revised and finished at Chawton some fifteen years later, and was not published till 1813, only four years before her death.');
      expect(option).not.toContain('somewhere exactly'); expect(option).not.toContain('published in 1796');
    }
    expect(task.options.some(option => option.includes('in exactly 1796'))).toBe(true); expect(task.options.some(option => option.includes('in every form'))).toBe(true);
  }
});
it('withholds incomplete or ambiguous book anchors, quoted/conditional/duplicate targets and altered timeline syntax', () => {
  const task = corpusQualifiedTiming(texts[0], 0)!, target = task.sentence, anchor = texts[0].slice(0, 917);
  const invalid = [target, texts[0].slice(919), texts[0].replace(anchor, ''), texts[0].replace('declare for_ Pride and Prejudice _unhesitatingly', 'declare for_ the book _unhesitatingly'), texts[0].replace(anchor, anchor + '\n\n' + anchor), texts[0].replace('fondness for Miss Austen', 'fondness for Miss Other'), texts[0].replaceAll('Pride and Prejudice', 'Emma'), texts[0].replaceAll('Pride and Prejudice', 'Emma  '),
    texts[0].replace(target, 'If ' + target), texts[0].replace(target, 'The author said that ' + target), texts[0].replace(target, '“' + target + '”'), '“' + texts[0], texts[0].replace(target, target + ' ' + target), texts[0].replace(target, target.replace('was in its', 'might have been in its')),
    texts[0].replace('somewhere about 1796', 'about 1796'), texts[0].replace('somewhere about 1796', 'somewhere about 1796 BCE'), texts[0].replace('not published till', 'published in'), texts[0].replace('some fifteen years later', 'fifteen years earlier'), texts[0].replace('in its first shape', 'in every form'), texts[0].replace('before her death', 'after her death')];
  for (const value of invalid) expect(corpusQualifiedTiming(value, 0), value).toBeUndefined();
  for (const id of ['c254099f2e568d1bb88a25d3b1358f4897e02d1b6278661a78d6ce88477a29a5', 'f35bc489efacfb6c355f27290a4d393cf059db7b4610addfd060ca33c8611cd4', '5e637bd8976e537e211ca95b6c7d082e3b23d72011a5c7f871dcb41dbcab23ce', '376969a3370eef404927ac6e4203d40a56226a9ab096d354189be94588078883']) {
    const text = sources[0].passages.find(part => part.id === id)!.text; expect(sha(text)).toBe(id); expect(corpusQualifiedTiming(text, 0)).toBeUndefined();
  }
});
it('generates deterministic runtime name/date/title slots without hardcoded source-ID answers', () => {
  const changed = texts[0].replaceAll('Miss Austen', 'Miss Jordan').replaceAll('Pride and Prejudice', 'Another Book').replace('1796', '1800').replace('1813', '1817').replace('twenty-one', 'twenty-two').replace('Chawton', 'Village').replace('fifteen years', 'sixteen years');
  fc.assert(fc.property(fc.constantFrom(texts[0], changed), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusQualifiedTiming(text, seed)!; expect(task).toEqual(corpusQualifiedTiming(text, seed)); expect(new Set(task.options).size).toBe(3); expect(task.options[task.answer]).toContain('somewhere around');
  }), { numRuns: 100 });
});
it('uses two genuine calendar roots at C1/C2 without changing the advanced cycle or Test scoring', () => {
  for (const point of ['C1', 'C2'] as const) for (const seed of [0, 1, 54, 55, 126, 127]) {
    const eligible = point === 'C1' ? { ...bank, records: [bank.records[0], { ...sources[1], passages: sources[1].passages.filter(part => part.id === '384791af263672c098c013f505cb2dd17ee94cca8a3506c72d4893942696f801') }] } : bank;
    const lesson = corpusLesson(eligible, new Set(), seed, point === 'C1' ? 900 : 1200, point, [], seed < 2 ? 'choice' : undefined, [], seed < 2 ? operation : undefined)!;
    lessonSchema.parse(lesson); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual([operation, operation]);
    expect(lesson.teaching!.en).toContain('later revisions');
    const test = asTestLesson(lesson); expect(test.materials.map(material => material.blocks)).toEqual(lesson.materials.map(material => material.blocks));
    for (const [index, { question }] of questions(lesson).entries()) {
      const tested = [...questions(test)][index].question; expect(tested.hints).toBeUndefined();
      if ('kind' in question) expect(score(question, 'I retain the draft date and later revision/publication qualifications.').correct).toBeNull();
      else for (let answer = 0; answer < 3; answer++) { expect(score(question, answer).correct).toBe(answer === question.answer); expect(score(tested, answer)).toEqual(score(question, answer)); }
    }
  }
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) expect(corpusLesson(bank, new Set(), 54, 1200, point, [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(ids), 32, 1200, 'C2', [], 'choice', [], operation)).toBeUndefined();
});
it('saves actual calendar Practice/Test answers, exposures and full recovery exports', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 54, 1200, 'C2')!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profile = `calendar-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profile);
      await claimSession(session.id, 'calendar-owner');
      for (const [index, { question }] of questions(lesson).entries()) {
        await markExposure((await sessions.get(session.id))!);
        const saved = await submit(session.id, 'calendar-owner', 'kind' in question ? 'The first-shape date remains approximate; later revision and publication remain separate.' : question.answer);
        expect(await attempts.get(saved.id)).toEqual(saved); expect((await sessions.get(session.id))!.position).toBe(index); await advance(session.id, 'calendar-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profile)); expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(4);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
