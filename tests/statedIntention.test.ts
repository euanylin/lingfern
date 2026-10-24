import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusMaterial, corpusSchema, corpusStatedIntention } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { loadReadingCorpus, reviewedReading } from '../src/data/corpus';
import { advance, attempts, claimSession, createSession, db, exposures, markExposure, sessions, submit, type Attempt, type Session } from '../src/data/db';
import { asTestLesson, explanationText, questions, score } from '../src/shared/content';
import { exportBackup, inspectBackup } from '../src/data/backup';

const operation = 'choice:stated-intention';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const scopes = [
  { root: 'voa-article-3225958', id: 'ec9576b120750006e326a7eb8e08319ca62ebcca9e73abfb62db545b25e4151b', source: 'ec9576b120750006e326a7eb8e08319ca62ebcca9e73abfb62db545b25e4151b', words: 64, action: 'work out', start: 32, end: 51, speakerEnd: 69 },
  { root: 'voa-article-3126527', id: 'c815ef0a15cda7177e05eadb882105317896cb135818516fef18afa4f6cb454e', source: '0b6b1056fe15c91946cdead7eeac4c3cc6a7845695de2bdede4260cfa421e18f', words: 78, action: 'cook dinner', start: 78, end: 100, speakerEnd: 193 },
];
const bank = { ...corpus, records: corpus.records.filter(source => scopes.some(scope => scope.root === source.rootId))
  .map(source => ({ ...source, passages: source.passages.filter(passage => scopes.some(scope => scope.id === passage.id)) })) };

it('preserves both actual source hashes, current complete excerpts and exact intention plus labelled speaker evidence', async () => {
  expect(sha(readFileSync('public/corpus/voa.json'))).toBe('d6ee2ce177e1c0037f6f7b0f533af12547f163e02082253d5053bfd5f8026af0');
  expect((await reviewedReading(bank.records, 120)).map(source => source.rootId).sort()).toEqual(scopes.map(scope => scope.root).sort());
  for (const scope of scopes) {
    const source = bank.records.find(source => source.rootId === scope.root)!, passage = source.passages[0];
    expect(source.sourceHash).toBe(scope.source); expect(sha(source.originalText!)).toBe(scope.source);
    expect(source.originalText!.slice(0, passage.text.length)).toBe(passage.text);
    expect(sha(passage.text)).toBe(scope.id); expect(passage.wordCount).toBe(scope.words); expect(passage.startingPoints).toEqual(['A1', 'A2']);
    for (let seed = 0; seed < 12; seed++) {
      const task = corpusStatedIntention(passage.text, seed)!;
      expect(task).toEqual(corpusStatedIntention(passage.text, seed)); expect(task.name).toBe('Anna'); expect(task.action).toBe(scope.action);
      expect(task.evidence).toEqual({ start: scope.start, end: scope.end }); expect(task.otherEvidence).toEqual({ start: 0, end: scope.speakerEnd });
      expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe(`I want to ${scope.action}.`);
      expect(passage.text.slice(task.otherEvidence.start, task.otherEvidence.end)).toMatch(/^Anna:/);
      expect(task.options[task.answer]).toBe('Anna wants to do it.'); expect(new Set(task.options).size).toBe(3);
      expect(task.prompt).toBe(`What does “I want to” mean here?\nAnna: “${scope.action}”`);
    }
  }
});

it('keeps all six option permutations, exact runtime names/actions and scoring for arbitrary bounded seeds', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 6; seed++) seen.add(corpusStatedIntention('Mira: I want to read books.', seed)!.options.join('|'));
  expect(seen.size).toBe(6);
  fc.assert(fc.property(fc.constantFrom('Mira', 'Robin', 'Morgan Lee'), fc.constantFrom('read books', 'cook soup', 'work out'), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (name, action, seed) => {
    const text = `${name}: I live here.\n\nI want to ${action}.`, task = corpusStatedIntention(text, seed)!;
    expect(task).toBeDefined(); expect(task.name).toBe(name); expect(task.action).toBe(action);
    expect(task.options[task.answer]).toBe(`${name} wants to do it.`); expect(task.options).toHaveLength(3);
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(`I want to ${action}.`);
    expect(text.slice(task.otherEvidence.start, task.otherEvidence.end)).toBe(text);
    expect(corpusStatedIntention(text, seed)).toEqual(task);
  }), { numRuns: 100 });
});

it('rejects qualification, questions, quoted or inherited unknown speakers, cancellation, duplicates and incomplete actions', () => {
  const original = bank.records.find(source => source.rootId === scopes[1].root)!.passages[0].text;
  const quote = 'I want to cook dinner.';
  const bad = [
    'Anna: Imagine this conversation.\n\nI want to cook dinner.',
    'Anna: I read an example.\n\nI want to cook dinner.',
    'Anna: I want to cook dinner.\nPete: Okay.\nAnna: Only if the shop is open.',
    original.replace(quote, 'I do not want to cook dinner.'), original.replace(quote, 'I wanted to cook dinner.'),
    original.replace(quote, 'Do you want to cook dinner?'), original.replace(quote, 'I need to cook dinner.'),
    original.replace(quote, 'I am cooking dinner.'), original.replace(quote, 'I cooked dinner.'),
    original.replace(quote, 'If I want to cook dinner, I will call Marsha.'), original.replace(quote, 'I want to cook dinner, but not now.'),
    original.replace(quote, 'I want to cook dinner. But I changed my mind.'), original.replace(quote, 'I want to cook dinner. I no longer intend to cook.'),
    original.replace(quote, 'I want to cook dinner. I do not want to cook dinner.'), original.replace(quote, 'I want to cook dinner. I want to work out.'),
    original.replace(quote, '“I want to cook dinner.”'), original.replace(quote, 'She said I want to cook dinner.'),
    original.replace(quote, 'I want to cook dinner'), original.replace(quote, 'I want to cook dinner..'), original.replace(quote, 'I want to not cook dinner.'),
    original.replace(quote, 'I want to cook dinner and read books.'), original.replace(quote, 'I want to cook dinner now.'),
    original.replace(quote, '(Someone enters)\n\n' + quote), original.replace(quote, 'Someone walked away.\n\n' + quote),
    original.replace(quote, 'UNKNOWN: ' + quote), original.replace('Anna: I am in', 'I am in'),
    'Narrator: “A conversation begins.\n' + original + '\nNarrator: ”',
    original + '\nAnna: I changed my mind.', original + '\nAnna: ' + quote,
  ];
  for (const text of bad) expect(corpusStatedIntention(text, 0), text).toBeUndefined();
  for (const seed of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusStatedIntention(original, seed)).toThrow('INVALID_CORPUS_STATED_INTENTION');
  expect(() => corpusStatedIntention('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_STATED_INTENTION');
  for (const root of ['voa-article-3293986', 'voa-article-3301733']) {
    const source = corpus.records.find(source => source.rootId === root)!; expect(source).toBeDefined();
    for (const passage of source.passages) expect(corpusStatedIntention(passage.text, 0)).toBeUndefined();
  }
});

it('uses simple three-language intention teaching, preserves source evidence and identical Practice/Test scoring on two actual roots', () => {
  for (const point of ['A1', 'A2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 120, point, [], 'choice', operation)!;
    expect(lesson).toBeDefined(); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal!['zh-Hans']).toBe('找到这个人想做的事。'); expect(lesson.goal!['zh-Hant']).toBe('找到這個人想做的事。');
    expect(lesson.teaching!['zh-Hans']).toContain('想做不等于正在做或已经完成'); expect(lesson.workedExample!.en).toContain('read a book');
    expect(lesson.workedExample!.en).not.toMatch(/work out|cook dinner/); expect(lesson.teaching!.en).not.toContain('action that follows');
    const snapshot = structuredClone(lesson), test = asTestLesson(lesson);
    expect(test.teaching).toBeUndefined(); expect(test.workedExample).toBeUndefined(); expect(test.nextStep).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const question = material.questions[0], tested = test.materials[index].questions[0];
      if ('kind' in question || 'kind' in tested) throw Error('Expected existing choice');
      expect(corpusOperation(question)).toBe(operation); expect(corpusOperation(tested)).toBe(operation);
      expect(question.options).toHaveLength(3); expect(question.hints).toHaveLength(3); expect(tested.hints).toBeUndefined();
      expect(tested.options).toEqual(question.options); expect(tested.answer).toBe(question.answer); expect(tested.evidence).toEqual(question.evidence);
      expect(tested.additionalEvidence).toEqual(question.additionalEvidence); expect(test.materials[index].blocks).toEqual(material.blocks);
      for (let answer = 0; answer < 3; answer++) {
        expect(score(question, answer).correct).toBe(answer === question.answer); expect(score(tested, answer)).toEqual(score(question, answer));
        if (answer !== question.answer) expect(explanationText(question, answer, 'en')).toContain('This statement does not report');
      }
      expect(question.explanations!.every(explanation => !explanation.en.includes('is not doing'))).toBe(true);
      expect(score(material.questions[1], 'I quote what the person wants.').correct).toBeNull();
      expect(material.questions[1].hints![2]['zh-Hans']).toBe('区分想做和正在做。'); expect(tested.hints).toBeUndefined();
    }
    expect(lesson).toEqual(snapshot);
  }
});

it('reaches both new beginner default slots and withholds missing/exposed partners or corrupted source assets', async () => {
  for (const point of ['A1', 'A2'] as const) {
    const index = 14, count = point === 'A1' ? 40 : 55;
    for (const seed of [index * 2, index * 2 + 1, (index + count) * 2, (index + count) * 2 + 1]) {
      const lesson = corpusLesson(bank, new Set(), seed, 120, point)!;
      expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
    }
    for (const scope of scopes) expect(corpusLesson(bank, new Set([scope.id]), 0, 120, point, [], 'choice', operation)).toBeUndefined();
    const one = { ...bank, records: [bank.records[0]] };
    expect(corpusLesson(one, new Set(), 0, 120, point, [], 'choice', operation)).toBeUndefined();
    const partner = corpus.records.find(source => source.rootId === 'voa-article-3113733')!;
    const missing = { ...bank, records: [bank.records[0], partner] };
    expect(corpusLesson(missing, new Set(), 0, 120, point, [], 'choice', operation)).toBeUndefined();
    for (const seed of [index * 2, index * 2 + 1]) {
      const lesson = corpusLesson(missing, new Set(), seed, 120, point)!;
      expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual(['completion', 'completion']);
    }
  }
  for (const point of ['B1','B2','C1','C2'] as const) {
    expect(corpusLesson(bank, new Set(), 0, 300, point, [], 'choice', operation)).toBeUndefined();
    expect(corpusMaterial({ source: bank.records[0], passage: bank.records[0].passages[0] }, 0, point, 'choice', operation)).toBeUndefined();
  }
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async path => new Response(String(path) === '/corpus/voa.json' ? JSON.stringify({ ...corpus, records: corpus.records.map(source => ({ ...source, sourceHash: '0'.repeat(64) })) }) : readFileSync('public' + String(path)));
    await expect(loadReadingCorpus('intent-integrity', 120)).rejects.toThrow('CORPUS_INTEGRITY');
  } finally { globalThis.fetch = originalFetch; }
});

it('keeps saved history unchanged and recommends intention only on the supported reading routes', () => {
  const lesson = corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'choice', operation)!;
  const session: Session = { id: 'intent-history', profileId: 'intent-policy', lesson, contentHash: 'a'.repeat(64), position: 3, status: 'completed',
    startedAt: new Date(Date.now() - 100000).toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(material => {
    const question = material.questions[0]; if ('kind' in question) throw Error('Expected choice');
    const answer = (question.answer + 1) % 3;
    return { id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, rootId: material.rootId,
      questionId: question.id, answer, ...score(question, answer), submittedAt: new Date(Date.now() - 50000).toISOString(), assistance: { hintLevel: 0 } };
  });
  const snapshot = JSON.stringify({ session, records });
  for (const point of ['A1','A2','B1','B2','C1','C2'] as const) {
    const route = corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', point);
    if (point === 'A1' || point === 'A2') expect(route.focus).toMatchObject({ kind: 'choice', operation, reason: 'reteach' });
    else expect(route.focus).toBeUndefined();
    expect(JSON.stringify({ session, records })).toBe(snapshot);
  }
  expect(corpusPracticeHistory([session], records, session.profileId, 'listening', 'all', 'A1').focus).toBeUndefined();
});

it('saves all Practice/Test responses, exposure and recovery while retaining an earlier generated completion snapshot', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const earlier = corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'completion')!;
    const previous = await createSession(earlier, 'intent-earlier'), original = JSON.stringify(previous.lesson);
    for (const lesson of [corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'choice', operation)!, asTestLesson(corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'choice', operation)!)]) {
      const profileId = `intent-db-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profileId);
      let current: Session = await claimSession(session.id, 'intent-owner');
      for (const [position, { material, question }] of questions(lesson).entries()) {
        expect(current.position).toBe(position); await markExposure(current);
        expect((await exposures.get([profileId, material.rootId]))!.contacts).toContainEqual(expect.objectContaining({ questionId: question.id }));
        const saved = await submit(session.id, 'intent-owner', 'kind' in question ? 'The person wants to do the quoted action.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true); expect(await attempts.get(saved.id)).toEqual(saved);
        expect((await sessions.get(session.id))!.position).toBe(position);
        if (lesson.mode === 'test') expect(saved.assistance).toEqual({ hintLevel: 0 });
        current = await advance(session.id, 'intent-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed');
      const inspection = await inspectBackup(await exportBackup(profileId));
      expect(inspection.records.sessions[0].lesson).toEqual(lesson); expect(inspection.records.attempts).toHaveLength(4);
      expect(inspection.records.attempts.filter(record => record.correct === null)).toHaveLength(2); expect(inspection.records.exposures).toHaveLength(2);
      expect(JSON.stringify((await sessions.get(previous.id))!.lesson)).toBe(original);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('asks about the explicit want-to statement when another statement reports an ongoing or completed action', () => {
  for (const continuation of ['I am reading books.', 'I read books yesterday.']) {
    const task = corpusStatedIntention(`Mira: I want to read books. ${continuation}`, 0)!;
    expect(task.prompt).toBe('What does “I want to” mean here?\nMira: “read books”');
    expect(task.options[task.answer]).toBe('Mira wants to do it.');
    expect(task.quote).toBe('I want to read books.');
  }
});
