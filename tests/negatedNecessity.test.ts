import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusMaterial, corpusNegatedNecessity, corpusSchema, corpusWorkedExample, selectCorpusPassage } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory, negatedNecessityPrompt } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import type { Attempt, Session } from '../src/data/db';
import { advance, attempts, claimSession, createSession, db, exposures, markExposure, sessions, submit } from '../src/data/db';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';

const operation = 'choice:negated-necessity';
const design = JSON.parse(readFileSync('tests/fixtures/negated-necessity-design.json', 'utf8')) as {
  scopes: { rootId: string; rawPath: string; sourceHash: string; passageId: string; evidence: string;
    evidenceRange: { start: number; end: number }; evidenceSha256: string; sourceFrame: string; faithfulDesignExample?: string;
    adversarialDesignExamples?: string[]; inspected: { passageIndex: number; id: string; text: string; words: number }[] }[];
  negativeDesigns: { cases: { id: string; text?: string }[] };
};
const raw = JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8'));
const all = corpusSchema.parse({ ...raw, records: raw.records.filter((source: { rootId: string }) => design.scopes.some(scope => scope.rootId === source.rootId)) });
const scopes = design.scopes.slice(0, 2);
const bank = { ...all, records: all.records.filter(source => scopes.some(scope => scope.rootId === source.rootId))
  .map(source => ({ ...source, passages: source.passages.filter(passage => scopes.some(scope => scope.passageId === passage.id)) })) };
const sha = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');

it('uses actual Smith and Darwin passages, with exact raw, passage and full-sentence evidence hashes', async () => {
  expect((await reviewedReading(bank.records, 700)).map(source => source.rootId).sort()).toEqual(scopes.map(scope => scope.rootId).sort());
  for (const scope of design.scopes) {
    const source = all.records.find(source => source.rootId === scope.rootId)!;
    expect(source.sourceHash).toBe(scope.sourceHash);
    expect(sha(readFileSync(scope.rawPath))).toBe(scope.sourceHash);
    for (const inspected of scope.inspected) {
      const actual = source.passages[inspected.passageIndex];
      expect(actual.text).toBe(inspected.text); expect(actual.wordCount).toBe(inspected.words);
      expect(sha(actual.text)).toBe(inspected.id);
    }
    const passage = source.passages.find(passage => passage.id === scope.passageId)!;
    expect(sha(passage.text)).toBe(scope.passageId);
    expect(passage.text.slice(scope.evidenceRange.start, scope.evidenceRange.end)).toBe(scope.evidence);
    expect(sha(scope.evidence)).toBe(scope.evidenceSha256);
    if (!scopes.includes(scope)) { expect(corpusNegatedNecessity(passage.text, 0)).toBeUndefined(); continue; }
    for (let seed = 0; seed < 12; seed++) {
      const task = corpusNegatedNecessity(passage.text, seed)!;
      expect(task).toEqual(corpusNegatedNecessity(passage.text, seed));
      expect(task.sentence).toBe(scope.evidence);
      expect(task.prompt).toBe(negatedNecessityPrompt + '\n' + scope.evidence);
      expect(task.evidence).toEqual({ start: scope.evidenceRange.start, end: scope.evidenceRange.end });
      expect(new Set(task.options).size).toBe(3);
      expect(task.options[task.answer]).toBe(scope.faithfulDesignExample);
      expect(task.options.filter((_option, index) => index !== task.answer).sort()).toEqual(scope.adversarialDesignExamples!.slice().sort());
      const [before, after] = scope.evidence.split(scope.sourceFrame);
      for (const option of task.options) {
        expect(option.startsWith(before)).toBe(true); expect(option.endsWith(after)).toBe(true);
      }
    }
  }
});

it('transfers the operation across the two real roots in forced and ordinary C1/C2 routes and keeps Test scoring', () => {
  for (const point of ['C1', 'C2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 700, point, [], 'choice', [], operation)!;
    expect(lesson).toBeDefined(); lessonSchema.parse(lesson);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal.en).toContain('negation scope'); expect(lesson.teaching!.en).toContain('denies a guarantee');
    expect(lesson.teaching!.en).not.toContain('action that follows'); expect(lesson.workedExample!.en).toContain('Neither guarantee');
    const before = structuredClone(lesson), tested = asTestLesson(lesson);
    expect(tested.id).toBe(lesson.id); expect(tested.mode).toBe('test');
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined(); expect(tested.nextStep).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const scope = scopes.find(scope => scope.rootId === material.rootId)!;
      const source = bank.records.find(source => source.rootId === material.rootId)!;
      expect(material.blocks[0].text).toBe(source.passages[0].text);
      expect(material.credit).toEqual({ attribution: source.attribution, license: source.licence, sourceUrl: source.originalUrl });
      const question = material.questions[0], testQuestion = tested.materials[index].questions[0];
      if ('kind' in question || 'kind' in testQuestion) throw Error('Expected shared choice schema');
      expect(corpusOperation(question)).toBe(operation); expect(corpusOperation(testQuestion)).toBe(operation);
      expect(question.evidence).toEqual({ start: scope.evidenceRange.start, end: scope.evidenceRange.end });
      expect(question.options[question.answer]).toBe(scope.faithfulDesignExample);
      expect(testQuestion.options).toEqual(question.options); expect(testQuestion.answer).toBe(question.answer);
      expect(testQuestion.evidence).toEqual(question.evidence); expect(testQuestion.prompt).toBe(question.prompt);
      expect(tested.materials[index].blocks).toEqual(material.blocks);
      expect(question.hints).toHaveLength(3); expect(testQuestion.hints).toBeUndefined();
      for (let choice = 0; choice < 3; choice++) {
        expect(score(question, choice).correct).toBe(choice === question.answer);
        expect(score(testQuestion, choice)).toEqual(score(question, choice));
      }
      expect(material.questions[1].evidence).toEqual(question.evidence);
      expect(score(material.questions[1], 'This denies a guarantee without guaranteeing absence.').correct).toBeNull();
      expect(score(tested.materials[index].questions[1], 'This denies a guarantee without guaranteeing absence.').correct).toBeNull();
      expect(tested.materials[index].questions[1].hints).toBeUndefined();
      expect(corpusWorkedExample(material, seed, point)).toBeUndefined();
    }
    expect(lesson).toEqual(before);
  }
  for (const point of ['C1', 'C2'] as const) {
    const reached = new Set<string>();
    for (const seed of [28, 29, 64, 65]) {
      const lesson = corpusLesson(bank, new Set(), seed, 700, point)!;
      expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
      reached.add(lesson.materials[0].rootId);
    }
    expect(reached.size).toBe(2);
  }
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) {
    expect(corpusLesson(bank, new Set(), 0, 700, point, [], 'choice', [], operation)).toBeUndefined();
    expect(corpusMaterial({ source: bank.records[0], passage: bank.records[0].passages[0] }, 0, point, 'choice', operation)).toBeUndefined();
    for (let seed = 0; seed < 32; seed++) expect(corpusOperation(corpusLesson(bank, new Set(), seed, 700, point)?.materials[0].questions[0])).not.toBe(operation);
  }
  expect(corpusLesson(bank, new Set(scopes.map(scope => scope.passageId)), 0, 700, 'C2', [], 'choice', [], operation)).toBeUndefined();
});

it('retains stable operation and exposure references in saved snapshots and routes an incorrect choice back to the same operation', () => {
  const lesson = corpusLesson(bank, new Set(), 0, 700, 'C2', [], 'choice', [], operation)!;
  const startedAt = new Date(Date.now() - 100000).toISOString(), submittedAt = new Date(Date.now() - 50000).toISOString();
  const session: Session = { id: 'negation-scope-policy', profileId: 'isolated-negation-policy', lesson: lessonSchema.parse(JSON.parse(JSON.stringify(lesson))),
    contentHash: 'a'.repeat(64), position: 3, status: 'completed', startedAt, assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = session.lesson.materials.map(material => {
    const question = material.questions[0];
    if ('kind' in question) throw Error('Expected choice');
    const answer = (question.answer + 1) % 3;
    return { id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, questionId: question.id,
      rootId: material.rootId, answer, ...score(question, answer), assistance: { hintLevel: 0 }, submittedAt };
  });
  const snapshot = JSON.stringify({ session, records });
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
    const route = corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', point);
    if (point === 'C1' || point === 'C2') expect(route.focus).toMatchObject({ kind: 'choice', operation, reason: 'reteach' });
    else expect(route.focus).toBeUndefined();
    expect(route.seen).toEqual(new Set(scopes.map(scope => scope.passageId)));
    expect(JSON.stringify({ session, records })).toBe(snapshot);
  }
  const history = corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', 'C2');
  expect(history.focus).toMatchObject({ kind: 'choice', operation, reason: 'reteach' });
  expect(history.seen).toEqual(new Set(scopes.map(scope => scope.passageId)));
  expect(history.independent).toBe(false);
  expect(session.lesson.materials.map(material => [material.rootId, material.id, material.questions[0].id])).toEqual(lesson.materials.map(material => [material.rootId, material.id, material.questions[0].id]));
});

it('opens, exposes, saves and advances every actual-source question through database transactions in Practice and Test', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 0, 700, 'C2', [], 'choice', [], operation)!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profileId = `negation-db-${lesson.mode ?? 'practice'}`;
      const session = await createSession(lesson, profileId);
      let current: Session = await claimSession(session.id, 'negation-db-owner');
      const entries = questions(lesson);
      for (const [index, { material, question }] of entries.entries()) {
        expect(current.position).toBe(index);
        await expect(markExposure(current)).resolves.toBeUndefined();
        // This actual transaction catches the cross-schema questionId/variantGroup limit that lessonSchema alone misses.
        const exposure = (await exposures.get([profileId, material.rootId]))!;
        expect(exposure.contacts).toContainEqual(expect.objectContaining({ sessionId: session.id, materialId: material.id,
          questionId: question.id, variantGroup: question.id }));
        expect(question.id.length).toBeLessThanOrEqual(80);
        const answer = 'kind' in question ? 'The quoted wording denies a guarantee while preserving the source’s qualifications.' : question.answer;
        const saved = await submit(session.id, 'negation-db-owner', answer);
        expect(saved.correct).toBe('kind' in question ? null : true);
        expect(await attempts.get(saved.id)).toEqual(saved);
        expect((await sessions.get(session.id))!.position).toBe(index);
        if (lesson.mode === 'test') expect(saved.assistance).toEqual({ hintLevel: 0 });
        current = await advance(session.id, 'negation-db-owner');
      }
      const finished = (await sessions.get(session.id))!;
      expect(finished.status).toBe('completed'); expect(finished.lesson).toEqual(lesson);
      const records = await attempts.where('sessionId').equals(session.id).toArray();
      expect(records).toHaveLength(4);
      expect(records.filter(record => record.correct === true)).toHaveLength(2);
      expect(records.filter(record => record.correct === null)).toHaveLength(2);
      for (const material of lesson.materials) expect((await exposures.get([profileId, material.rootId]))!.contacts).toHaveLength(2);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('fails closed for unsupported modal, quotation, denial, counterfactual, negation and malformed boundaries', () => {
  const direct = 'The possession of that fortune does not necessarily convey political power.';
  const negative = [
    ...design.negativeDesigns.cases.filter(item => item.text && item.id !== 'invalid-seed').map(item => item.text!),
    direct.replace('does not necessarily', 'must not'), direct.replace('does not necessarily', 'need not'),
    direct.replace('does not necessarily', 'may not'), direct.replace('The possession', 'Had the possession'),
    direct.replace('The possession', 'Were the possession'), direct.replace('political power', 'no political power'),
    direct.replace('political power', 'political power without influence'), direct.replace('political power', 'political power if acquired'),
    direct.replace('political power', 'political power that never lasts'), direct.replace('political power', 'political power necessarily'),
    direct + '.', 'The claim is not that ' + direct[0].toLowerCase() + direct.slice(1),
    'If the evidence were stronger, ' + direct[0].toLowerCase() + direct.slice(1),
    'Variation is not necessarily connected with no generation.',
    'Variation is not necessarily connected, as some authors have denied, with generation.',
    'Variation is not necessarily connected with generation, but it must be.',
    'These cases anyhow show that variation is not necessarily connected with generation.',
    scopes[0].evidence,
  ];
  for (const text of negative) for (let seed = 0; seed < 3; seed++) expect(corpusNegatedNecessity(text, seed), text).toBeUndefined();
  for (const [open, close] of [['“', '”'], ['"', '"'], ['‘', '’'], ["'", "'"]]) {
    expect(corpusNegatedNecessity(`The narrator said ${open}The meeting opened. ${direct} Everyone left.${close}`, 0)).toBeUndefined();
    expect(corpusNegatedNecessity(`The narrator said ${open}The meeting opened. ${direct}`, 0)).toBeUndefined();
  }
  expect(corpusNegatedNecessity('The narrator said “The meeting opened.” ' + direct, 0)).toBeDefined();
  for (const seed of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusNegatedNecessity(direct, seed)).toThrow('INVALID_CORPUS_NEGATED_NECESSITY');
  expect(() => corpusNegatedNecessity('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_NEGATED_NECESSITY');
  expect(corpusNegatedNecessity('', 0)).toBeUndefined();
});

it('generates the bounded relation forms without source IDs and preserves untouched wording for arbitrary seeds', () => {
  fc.assert(fc.property(fc.constantFrom(
    'The mere possession of an estate does not necessarily convey influence.',
    'Variation is not necessarily connected with cultivation.',
  ), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusNegatedNecessity(text, seed)!;
    expect(task).toBeDefined(); expect(task).toEqual(corpusNegatedNecessity(text, seed));
    expect(task.sentence).toBe(text); expect(task.evidence).toEqual({ start: 0, end: text.length });
    expect(task.options[task.answer]).toBe(text.replace('does not necessarily convey', 'is not guaranteed to convey').replace('is not necessarily connected', 'is not guaranteed to be connected'));
    expect(new Set(task.options).size).toBe(3);
    expect(task.options.every(option => option.endsWith('.'))).toBe(true);
    expect(corpusNegatedNecessity(text + ' ' + text, seed)).toBeUndefined();
  }), { numRuns: 100 });
});

it('scores thirty-one exact prepared denials of a guarantee and withholds a hedged near-match', () => {
  const bank = { version: 1 as const, failures: [] as [], records: ['public/corpus/open-reading.json', 'public/corpus/additional.json', 'public/corpus/additional-4.json'].flatMap(file => corpusSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).records) };
  const sentences = [
    'Unfortunately, being consistent in measurement does not necessarily mean that you have measured something correctly.',
    'An interesting feature of viral complexity is that the complexity of the host does not necessarily correlate with the complexity of the virion.',
    'However, adding heat does not necessarily increase the temperature.',
    'Thus, government power does not necessarily equate to absolute power.',
    'Note that acting strategically does not necessarily imply acting morally.',
    'Hostile aggression is motivated by feelings of anger with intent to cause pain, and instrumental aggression is motivated by achieving a goal and does not necessarily involve intent to cause pain.',
    'Putnam argues that science’s creation of facts is an evaluative practice and does not necessarily stand on a firmer ground than conclusions about values like goodness or kindness.',
    'Survival of the fittest does not necessarily mean that the biggest and fastest survive; instead, it refers to those who are most evolutionarily fit.',
    'This situation does not necessarily mean that union workers are fired.',
    'It is also possible to test for antibodies, but the presence of antibodies does not necessarily indicate a current infection; it only means that the individual was exposed at some time.',
    'Third, all stress is not necessarily bad.',
    'Similarly, a government’s power is not necessarily limited to control of its own citizens.',
    'The neurological exam does not necessarily assess personality, but it can be within the realm of neurology or psychiatry.',
    'Note that this theory is not necessarily concerned with the welfare of others.',
    'Personal writing relies on memory but is not necessarily an account of every detail of the event the author is writing about.',
    'Of course, every time people are gathered, it is not necessarily a group.',
    'A moderate increase in a budget deficit that leads to a moderate increase in a trade deficit and a moderate appreciation of the exchange rate is not necessarily a cause for concern.',
    'While any valid measure is by necessity reliable, the reverse is not necessarily true.',
    'But the same is not necessarily true for art.',
    'Maximizing the count of unique alleles captured does not necessarily ensure that those alleles are present at frequencies, or in genetic backgrounds, that render them accessible to selection.',
    'The additional SBM results also indicate that the presence of community structure alone does not necessarily lead to poor LAVI performance.',
    'Military brilliance does not necessarily signal political skill, however, and neither Bolívar’s fledgling dream of a representative republican system nor his ideal of pan-American unity were shared by others in the region.',
    'We wrote this article because we wanted kids to know that their brains need to experience lots of different things to grow and develop in the best possible way, and, having lots of money is not necessarily required for brain development.',
  ];
  const frames = sentences.map(sentence => bank.records.flatMap(source => source.passages.filter(passage => passage.text.includes(sentence)).map(passage => ({ source, passage, sentence }))).find(Boolean)!);
  expect(frames.every(Boolean)).toBe(true);
  expect(new Set(frames.map(frame => frame.source.rootId)).size).toBe(17);
  const wealth = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
  const price = wealth.records.flatMap(source => source.passages).find(passage => passage.id === '242d0eb0a19c60f55da1c7db8c212af96e81f75ac822727e109a33debc1015a6')!;
  const diminished = corpusNegatedNecessity(price.text, 0)!;
  expect(diminished.sentence).toBe('The high price of such commodities does not necessarily diminish the ability of the inferior ranks of people to bring up families.');
  expect(diminished.options[diminished.answer]).toContain('is not guaranteed to diminish');
  expect(new Set(diminished.options).size).toBe(3);
  const currency = wealth.records.flatMap(source => source.passages).find(passage => passage.id === 'f2cb55389fbd8e05fa90cefcacf39d7ca78805a66f0a367482da609325231bb3')!;
  const increased = corpusNegatedNecessity(currency.text, 0)!;
  expect(increased.sentence).toBe('But as the quantity of gold and silver, which is taken from the currency, is always equal to the quantity of paper which is added to it, paper money does not necessarily increase the quantity of the whole currency.');
  expect(increased.options[increased.answer]).toContain('is not guaranteed to increase');
  expect(new Set(increased.options).size).toBe(3);
  for (const [id, sentence, faithful] of [
    ['15b1f1b6d64495b55df185d997ac3cae0c436135c44f49dc1b9bb74b9026d4a2', 'The public expense, however, when defrayed in this manner, no doubt hinders, more or less, the further accumulation of new capital; but it does not necessarily occasion the destruction of any actually-existing capital.', 'is not guaranteed to occasion'],
    ['cb8295e82b02', 'The proprietor of stock is properly a citizen of the world, and is not necessarily attached to any particular country.', 'is not guaranteed to be attached'],
    ['17ef4d3fadd9', 'A merchant, it has been said very properly, is not necessarily the citizen of any particular country.', 'is not guaranteed to be the'],
    ['bd731d28589d', 'Yet the structure of each of these birds is good for it, under the conditions of life to which it is exposed, for each has to live by a struggle; but it is not necessarily the best possible under all possible conditions.', 'is not guaranteed to be the'],
    ['975330986f9e', 'But the ordinary proportion between the respective values of two commodities is not necessarily the same as that between the quantities of them which are commonly in the market.', 'is not guaranteed to be the'],
    ['304398357857', 'But each fauna is not necessarily exactly intermediate, as unequal intervals of time have elapsed between consecutive formations.', 'is not guaranteed to be exactly'],
  ] as const) {
    const passage = wealth.records.flatMap(source => source.passages).find(item => item.id.startsWith(id))!;
    const task = corpusNegatedNecessity(passage.text, 0)!;
    expect(task.sentence).toBe(sentence);
    expect(task.options[task.answer]).toContain(faithful);
    expect(new Set(task.options).size).toBe(3);
  }
  for (const frame of frames) for (let seed = 0; seed < 3; seed++) {
    const task = corpusNegatedNecessity(frame.passage.text, seed)!;
    const present = sentences.filter(sentence => frame.passage.text.includes(sentence));
    expect(present).toContain(task.sentence);
    expect(task.options[task.answer]).toContain('not guaranteed');
    expect(task.options).toHaveLength(3);
    expect(new Set(task.options).size).toBe(3);
  }
  const measurement = frames.find(frame => frame.sentence.startsWith('Unfortunately, being consistent'))!.passage.text;
  expect(new Set([0, 1].map(seed => corpusNegatedNecessity(measurement, seed)!.sentence)).size).toBe(2);
  const hedged = bank.records.flatMap(source => source.passages).find(passage => passage.text.includes('does not necessarily mean that it is always prior'))!;
  expect(corpusNegatedNecessity(hedged.text, 0)).toBeUndefined();
  const focused = { version: 1 as const, failures: [] as [], records: [frames[0], frames[2]].map(frame => ({ ...frame.source, passages: [frame.passage] })) };
  const lesson = corpusLesson(focused, new Set(), 0, 900, 'C1', [], 'choice', [], operation)!;
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
});

it('does not use a passage under 120 words for a C1 negation lesson', () => {
  const wealth = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
  const quotes = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/wikiquote-3.json', 'utf8')));
  const hosts = wealth.records.filter(record => record.rootId === 'gutenberg-book-3300' || record.rootId === 'gutenberg-book-1228')
    .map(record => ({ ...record, passages: record.passages.filter(passage => passage.wordCount >= 120 && corpusNegatedNecessity(passage.text, 0)) }))
    .filter(record => record.passages.length);
  const quote = quotes.records.find(record => record.rootId === 'wikiquote-page-189332')!;
  const sentence = 'A merchant, it has been said very properly, is not necessarily the citizen of any particular country.';
  const tiny = { ...quote, passages: quote.passages.filter(passage => passage.text === sentence) };
  expect(hosts).toHaveLength(2);
  expect(tiny.passages).toHaveLength(1);
  const mixed = { ...wealth, records: [...hosts, tiny] };
  for (let seed = 0; seed < 12; seed++) {
    expect(selectCorpusPassage(mixed, new Set(), seed, 900, [], [], 'C1')?.passage.wordCount ?? 0).toBeGreaterThanOrEqual(120);
    const lesson = corpusLesson(mixed, new Set(), seed, 900, 'C1', [], 'choice', [], operation)!;
    expect(lesson.materials.every(material => material.blocks[0].text !== sentence && corpusOperation(material.questions[0]) === operation)).toBe(true);
  }
  const other = quote.passages.find(passage => passage.text !== sentence)!;
  const onlyShort = { ...quotes, records: [tiny, { ...quote, id: 'wikiquote-189333', rootId: 'wikiquote-page-189333', passages: [other] }] };
  expect(selectCorpusPassage(onlyShort, new Set(), 0, 900, [], [], 'C1')).toBeUndefined();
  expect(corpusLesson(onlyShort, new Set(), 0, 900, 'C1', [], 'choice', [], operation)).toBeUndefined();
});
