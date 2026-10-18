import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusMaterial, corpusSchema, corpusStatedOrigin } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { advance, attempts, claimSession, createSession, db, exposures, markExposure, sessions, submit, type Attempt, type Session } from '../src/data/db';
import { asTestLesson, questions, score } from '../src/shared/content';
import { exportBackup, inspectBackup } from '../src/data/backup';
import design from './fixtures/stated-origin-design.json';

const operation = 'choice:stated-origin';
const sha = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const bank = { ...corpus, records: corpus.records.filter(source => design.positives.some(scope => scope.rootId === source.rootId))
  .map(source => ({ ...source, passages: source.passages.filter(passage => design.positives.some(scope => scope.inspectedSupportPassage.id === passage.id)) })) };

it('retains exact complete conversations, admitted excerpts, rights/support and all evidence on the two actual roots', async () => {
  expect(sha(readFileSync('public/corpus/voa.json'))).toBe('d6ee2ce177e1c0037f6f7b0f533af12547f163e02082253d5053bfd5f8026af0');
  expect((await reviewedReading(bank.records, 160)).map(source => source.rootId).sort()).toEqual(design.positives.map(scope => scope.rootId).sort());
  for (const scope of design.positives) {
    const source = bank.records.find(source => source.rootId === scope.rootId)!;
    const passage = source.passages[0], inspected = scope.inspectedSupportPassage, meaning = scope.semanticDesign;
    expect(source.originalText).toBe(scope.originalText); expect(sha(source.originalText!)).toBe(scope.sourceHash);
    expect(source.sourceHash).toBe(scope.sourceHash); expect(source.licence).toBe(scope.sourceMetadata.licence);
    expect(source.permissionReview).toBe(scope.sourceMetadata.permissionReview);
    expect(passage.text).toBe(inspected.text); expect(passage.startingPoints).toEqual(inspected.startingPoints);
    expect(passage.wordCount).toBe(inspected.wordCount); expect(sha(passage.text)).toBe(inspected.id);
    expect(source.originalText!.slice(inspected.start, inspected.end)).toBe(passage.text);
    for (let seed = 0; seed < 8; seed++) {
      const task = corpusStatedOrigin(passage.text, seed)!;
      expect(task).toEqual(corpusStatedOrigin(passage.text, seed)); expect(task.name).toBe(meaning.subject);
      expect(task.prompt).toBe(meaning.question.en);
      expect(task.options[task.answer]).toBe(meaning.correctOption);
      expect(task.options[1 - task.answer]).toBe(meaning.incorrectOption);
      expect(task.evidence).toEqual({ start: meaning.correctEvidence.passageStart, end: meaning.correctEvidence.passageEnd });
      expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe(meaning.correctEvidence.text);
      expect(task.otherEvidence).toHaveLength(2);
      expect(passage.text.slice(task.otherEvidence[0].start, task.otherEvidence[0].end)).toContain('from?');
      expect(passage.text.slice(task.otherEvidence[1].start, task.otherEvidence[1].end)).toBe(meaning.incorrectOptionEvidence.context.replace('\n', '\n\n'));
    }
  }
});

it('finds exactly two supported A2 roots and one supported A1 root without changing source availability', async () => {
  const ready = await reviewedReading(corpus.records, 160);
  const matches = ready.flatMap(source => source.passages.filter(passage => passage.startingPoints?.length && corpusStatedOrigin(passage.text, 0))
    .map(passage => ({ root: source.rootId, points: passage.startingPoints! })));
  expect(matches.map(match => match.root).sort()).toEqual(design.positives.map(scope => scope.rootId).sort());
  expect(matches.filter(match => match.points.includes('A1')).map(match => match.root)).toEqual([design.positives[0].rootId]);
  expect(matches.filter(match => match.points.includes('A2'))).toHaveLength(2);
  const reached = new Set<string>();
  const available = ready.reduce((count, source) => count + source.passages.filter(passage => passage.startingPoints?.includes('A2') && passage.wordCount <= 160).length, 0);
  for (let seed = available * 19; seed < available * 20; seed++) {
    const lesson = corpusLesson({ ...corpus, records: ready }, new Set(), seed, 160, 'A2')!;
    if (corpusOperation(lesson.materials[0].questions[0]) !== operation) continue;
    expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    reached.add(lesson.materials[0].rootId);
  }
  expect(reached).toEqual(new Set(design.positives.map(scope => scope.rootId)));
});

it('transfers the same stated-origin relation with simple three-language teaching and identical Test scoring', () => {
  for (let seed = 0; seed < 8; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 160, 'A2', [], 'choice', [], operation)!;
    expect(lesson).toBeDefined(); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const before = structuredClone(lesson), tested = asTestLesson(lesson);
    expect(lesson.goal).toEqual({ en: 'Find the place the person says they are from.', 'zh-Hans': '找到这个人说自己来自的地方。', 'zh-Hant': '找到這個人說自己來自的地方。' });
    expect(lesson.teaching!['zh-Hans']).toContain('不要推断出生地、居住地或国籍');
    expect(lesson.teaching!['zh-Hant']).toContain('不要推斷出生地、居住地或國籍');
    expect(lesson.teaching!.en).not.toContain('action that follows');
    expect(lesson.workedExample!.en).toContain('does not state');
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined(); expect(tested.nextStep).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const source = bank.records.find(source => source.rootId === material.rootId)!;
      const scope = design.positives.find(scope => scope.rootId === material.rootId)!;
      expect(material.blocks[0].text).toBe(source.passages[0].text);
      expect(material.credit).toEqual({ attribution: source.attribution, license: source.licence, sourceUrl: source.originalUrl });
      const question = material.questions[0], testQuestion = tested.materials[index].questions[0];
      if ('kind' in question || 'kind' in testQuestion) throw Error('Expected existing choice schema');
      expect(corpusOperation(question)).toBe(operation); expect(corpusOperation(testQuestion)).toBe(operation);
      expect(question.id.length).toBeLessThanOrEqual(80);
      expect(question.options[question.answer]).toBe(scope.semanticDesign.correctOption);
      expect(question.hints).toHaveLength(3); expect(testQuestion.hints).toBeUndefined();
      expect(testQuestion.options).toEqual(question.options); expect(testQuestion.answer).toBe(question.answer);
      expect(testQuestion.evidence).toEqual(question.evidence); expect(testQuestion.additionalEvidence).toEqual(question.additionalEvidence);
      expect(tested.materials[index].blocks).toEqual(material.blocks);
      for (let answer = 0; answer < 2; answer++) {
        expect(score(question, answer).correct).toBe(answer === question.answer);
        expect(score(testQuestion, answer)).toEqual(score(question, answer));
      }
      expect(score(material.questions[1], 'I quote the person’s stated origin.').correct).toBeNull();
      expect(material.questions[1].hints![2]['zh-Hans']).toContain('保留回答的意思');
      expect(tested.materials[index].questions[1].hints).toBeUndefined();
    }
    expect(lesson).toEqual(before);
  }
  for (const seed of [38, 39, 148, 149]) expect(corpusLesson(bank, new Set(), seed, 160, 'A2')!.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
  for (const point of ['A1', 'B1', 'B2', 'C1', 'C2'] as const) {
    expect(corpusLesson(bank, new Set(), 0, 160, point, [], 'choice', [], operation)).toBeUndefined();
    expect(corpusMaterial({ source: bank.records[0], passage: bank.records[0].passages[0] }, 0, point, 'choice', operation)).toBeUndefined();
  }
  expect(corpusLesson(bank, new Set(bank.records.map(source => source.passages[0].id)), 0, 160, 'A2', [], 'choice', [], operation)).toBeUndefined();
  for (const source of bank.records) expect(corpusLesson(bank, new Set([source.passages[0].id]), 0, 160, 'A2', [], 'choice', [], operation)).toBeUndefined();
});

it('rejects all21 isolated actual-passage mutations through helper and product focus rather than another task fallback', () => {
  expect(design.negativeDesigns).toHaveLength(21);
  const source = bank.records.find(source => source.rootId === design.positives[1].rootId)!;
  const original = source.passages[0];
  for (const negative of design.negativeDesigns) {
    const change = negative.exactIsolatedMutation;
    expect(original.text.slice(change.baseStart, change.baseEnd)).toBe(change.baseText);
    const text = original.text.slice(0, change.baseStart) + change.replacementText + original.text.slice(change.baseEnd);
    expect(sha(text)).toBe(negative.mutatedAnalysisTextSha256);
    const passage = { ...original, text };
    for (let seed = 0; seed < 3; seed++) {
      expect(corpusStatedOrigin(text, seed), negative.name).toBeUndefined();
      const material = corpusMaterial({ source, passage }, seed, 'A2', 'choice', operation);
      expect(corpusOperation(material?.questions[0]), negative.name).not.toBe(operation);
      const altered = { ...bank, records: [{ ...source, passages: [passage] }, bank.records[0]] };
      const lesson = corpusLesson(altered, new Set(), seed, 160, 'A2', [], 'choice', [], operation);
      expect(lesson?.materials.some(material => material.rootId === source.rootId && corpusOperation(material.questions[0]) === operation), negative.name).not.toBe(true);
    }
  }
});

it('fails closed for place aliases, arbitrary capitalised names, identity, adjacency, incomplete or duplicate evidence', () => {
  const text = 'Mira: Where are you from?\nRobin: I am from a small town.\nMira: Welcome to D.C.';
  expect(corpusStatedOrigin(text, 0)?.place).toBe('a small town');
  const bad = [
    text.replace('a small town', 'The News'), text.replace('a small town', 'Northwind'),
    text.replace('a small town', 'China or D.C.'), text.replace('a small town', 'not China'),
    text.replace('a small town', 'D.C.'), text.replace('a small town', 'Washington, D.C.'),
    text.replace('I am', 'I must be'), text.replace('I am', 'I might be'), text.replace('I am', 'She is'),
    text.replace('I am from a small town.', 'I am from a small town. I am from China.'),
    text.replace('I am from a small town.', 'My name is Mira. I am from a small town.'),
    text.replace('Robin:', 'Mira:'), text.replace('Where are you from?', 'Where were you born?'),
    text.replace('Where are you from?', 'Where do you live?'),
    text.replace('Robin:', 'Mira: Wait a moment.\nRobin:'), text.replace('Robin:', 'Wait a moment.\nRobin:'),
    text.replace('Mira: Welcome', 'Taylor: Welcome'), text.replace('D.C.', 'China and D.C.'),
    text.replace('town.', 'town'), text.replace('town.', 'town..'), text.replace('town.', 'town?'),
    text + '\nRobin: I am from a small town.', text + '\nRobin: I was from China.',
    'Narrator: “The conversation begins.\n' + text + '\nNarrator: ”',
  ];
  for (const value of bad) expect(corpusStatedOrigin(value, 0), value).toBeUndefined();
  for (const seed of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusStatedOrigin(text, seed)).toThrow('INVALID_CORPUS_STATED_ORIGIN');
  expect(() => corpusStatedOrigin('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_STATED_ORIGIN');
});

it('keeps saved history intact but recommends this operation only at its supported A2 route after a starting-point switch', () => {
  const lesson = corpusLesson(bank, new Set(), 0, 160, 'A2', [], 'choice', [], operation)!;
  const session: Session = { id: 'origin-history', profileId: 'origin-policy', lesson, contentHash: 'a'.repeat(64), position: 3, status: 'completed',
    startedAt: new Date(Date.now() - 100000).toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(material => {
    const question = material.questions[0]; if ('kind' in question) throw Error('Expected choice');
    const answer = 1 - question.answer;
    return { id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, rootId: material.rootId,
      questionId: question.id, answer, ...score(question, answer), submittedAt: new Date(Date.now() - 50000).toISOString(), assistance: { hintLevel: 0 } };
  });
  const snapshot = JSON.stringify({ session, records });
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
    const route = corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', point);
    if (point === 'A2') expect(route.focus).toMatchObject({ kind: 'choice', operation, reason: 'reteach' });
    else expect(route.focus).toBeUndefined();
    expect(route.seen).toEqual(new Set(bank.records.map(source => source.passages[0].id)));
    expect(JSON.stringify({ session, records })).toBe(snapshot);
  }
});

it('saves every actual Practice/Test answer and exposure, finishes both roots and validates the portable backup', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 0, 160, 'A2', [], 'choice', [], operation)!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profileId = `origin-db-${lesson.mode ?? 'practice'}`;
      const session = await createSession(lesson, profileId);
      let current: Session = await claimSession(session.id, 'origin-owner');
      for (const [position, { material, question }] of questions(lesson).entries()) {
        expect(current.position).toBe(position); await markExposure(current);
        expect((await exposures.get([profileId, material.rootId]))!.contacts).toContainEqual(expect.objectContaining({ questionId: question.id, variantGroup: question.id }));
        expect(question.id.length).toBeLessThanOrEqual(80);
        const saved = await submit(session.id, 'origin-owner', 'kind' in question ? 'The person states the origin in this quoted answer.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true); expect(await attempts.get(saved.id)).toEqual(saved);
        expect((await sessions.get(session.id))!.position).toBe(position);
        if (lesson.mode === 'test') expect(saved.assistance).toEqual({ hintLevel: 0 });
        current = await advance(session.id, 'origin-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed');
      expect(await attempts.where('sessionId').equals(session.id).count()).toBe(4);
      const inspection = await inspectBackup(await exportBackup(profileId));
      expect(inspection.records.sessions[0].lesson).toEqual(lesson);
      expect(inspection.records.attempts.filter(record => record.correct === null)).toHaveLength(2);
      expect(inspection.records.exposures).toHaveLength(2);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('rotates only the two exact grounded options for arbitrary seeds and different speaker names', () => {
  fc.assert(fc.property(fc.constantFrom('Mira', 'Robin', 'Morgan'), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (name, seed) => {
    const text = `Taylor: Where are you from?\n${name}: I am from a small town.\nTaylor: Welcome to D.C.`;
    const task = corpusStatedOrigin(text, seed)!;
    expect(task).toBeDefined(); expect(task).toEqual(corpusStatedOrigin(text, seed));
    expect(task.name).toBe(name); expect(task.options[task.answer]).toBe('a small town');
    expect(task.options[1 - task.answer]).toBe('D.C.');
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(`${name}: I am from a small town.`);
    expect(task.options).toHaveLength(2); expect(new Set(task.options).size).toBe(2);
  }), { numRuns: 100 });
});
