import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { expect, it } from 'vitest';
import { corpusLesson, corpusQualifiedCause, corpusSchema, corpusMaterial } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory, qualifiedCausePrompt } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { inspectCommunityPack } from '../src/data/communityPack';
import type { Attempt, Session } from '../src/data/db';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const event = "Alonso stopped his car with an electrical issue – possibly a short circuit from the wet conditions – to become the race's first retirement on lap 3.";
const withheldSignal = 'The primary base was at Zhuzhou, toward which all the aircraft navigated, but Halsey never sent the planned signal to alert them, apparently because of a possible threat to the task force.';
const operation = 'choice:qualified-cause';
it('withholds reversed and crossed quotation prefixes while retaining closed nested quotations', () => {
  for (const prefix of ['An inverted ”remark“. ', "A crossed “remark' and story”'. "])
    expect(corpusQualifiedCause(prefix + event, 0), prefix).toBeUndefined();
  expect(corpusQualifiedCause('An unrelated "closed \'remark\'" is recorded. ' + event, 0)).toBeDefined();
});
async function actual() {
  const records = [];
  for (const [number, root, text, words] of [['001', 'wikipedia-article-40685706', event, 732], ['007', 'wikipedia-article-159895', withheldSignal, 786]] as const) {
    const pack = await inspectCommunityPack(readSourcePackFixture(`wikipedia-reading-${number}`));
    const source = (await reviewedReading(pack.corpus!.records, 1200)).find(source => source.rootId === root)!;
    const passage = source.passages.find(passage => passage.wordCount === words && passage.text.includes(text))!;
    expect(passage).toBeDefined();
    records.push({ ...source, passages: [passage] });
  }
  return corpusSchema.parse({ version: 1, failures: [], records });
}

it('preserves complete actual sentences and rotates certainty-scope options with exact source evidence', async () => {
  const corpus = await actual();
  for (const [index, source] of corpus.records.entries()) {
    const passage = source.passages[0], sentence = index ? withheldSignal : event;
    for (let seed = 0; seed < 7; seed++) {
      const task = corpusQualifiedCause(passage.text, seed)!;
      expect(task.sentence).toBe(sentence);
      expect(task.prompt).toBe(qualifiedCausePrompt + '\n' + sentence);
      expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe(sentence);
      expect(task.options[task.answer]).toBe('The passage states what happened but only proposes an explanation.');
      expect(task.answer).toBe((3 - seed % 3) % 3);
      const material = corpusMaterial({ source, passage }, seed, 'C1', 'choice', operation)!;
      const question = material.questions[0], response = material.questions[1];
      if ('kind' in question || !('kind' in response) || response.kind !== 'response') throw new Error('Expected choice and unscored interpretation');
      expect(corpusOperation(question)).toBe(operation);
      expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end)).toBe(sentence);
      expect(response.evidence).toEqual(question.evidence);
      expect(response.prompt).toContain('real-world fact');
      expect(score(response, 'I distinguish the directly stated event from its tentative explanation.').correct).toBeNull();
      for (let answer = 0; answer < 3; answer++) expect(score(question, answer).correct).toBe(answer === task.answer);
      expect(question.explanations[question.answer].en).toContain('does not verify');
      expect(question.hints).toHaveLength(3);
    }
  }
});

it('repeats the same operation across distinct real roots and converts it to automatic test without assistance', async () => {
  const corpus = await actual();
  for (let seed = 0; seed < 7; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 1200, 'C1', [], 'choice', [], operation)!;
    expect(lesson).toBeDefined(); lessonSchema.parse(lesson);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
    expect(lesson.teaching!.en).toContain('explanation'); expect(lesson.goal.en).toContain('tentative explanation');
    expect(lesson.workedExample!.en).toContain('does not independently verify');
    const tested = asTestLesson(lesson);
    expect(tested.id).toBe(lesson.id); expect(tested.mode).toBe('test');
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
    for (const material of tested.materials) for (const question of material.questions) expect(question.hints).toBeUndefined();
    expect(tested.materials.map(material => material.questions[0].evidence)).toEqual(lesson.materials.map(material => material.questions[0].evidence));
  }
  const automatic = corpusLesson(corpus, new Set(), 26, 1200, 'C1')!;
  expect(automatic.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
  expect(corpusMaterial({ source: corpus.records[0], passage: corpus.records[0].passages[0] }, 0, 'A1', 'choice', operation)?.questions[0].prompt.startsWith(qualifiedCausePrompt)).not.toBe(true);
});

it('keeps ordinary mixed practice available without counting unrelated applications as transfer', async () => {
  const primary = await actual();
  const pack = await inspectCommunityPack(readSourcePackFixture('wikipedia-reading-001'));
  const available = (await reviewedReading(pack.corpus!.records, 1200)).filter(source => !primary.records.some(record => record.rootId === source.rootId))
    .flatMap(source => { const passage = source.passages.find(passage => passage.wordCount > 700 && passage.wordCount <= 1200 && !corpusQualifiedCause(passage.text, 0)); return passage ? [{ ...source, passages: [passage] }] : []; });
  expect(available.length).toBeGreaterThanOrEqual(2);
  const history: Session[] = [], records: Attempt[] = [];
  for (const [index, source] of primary.records.entries()) {
    const lesson = corpusLesson({ ...primary, records: [source] }, new Set(), 0, 1200, 'C1', [], 'choice', [], operation, { ...primary, records: [available[index]] })!;
    expect(lesson).toBeDefined(); lessonSchema.parse(lesson);
    expect(corpusOperation(lesson.materials[0].questions[0])).toBe(operation);
    expect(corpusOperation(lesson.materials[1].questions[0])).toBe('completion');
    const session: Session = { id: `mixed-${index}`, profileId: 'isolated-policy', lesson, contentHash: 'a'.repeat(64), position: 3,
      status: 'completed', startedAt: new Date(Date.now() - 100000 + index * 1000).toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 };
    history.push(session);
    for (const material of lesson.materials) for (const question of material.questions) if (!('kind' in question) || question.kind !== 'response') records.push({
      id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, questionId: question.id, rootId: material.rootId,
      answer: '', correct: true, rule: 'isolated-policy', assistance: { hintLevel: 0 }, submittedAt: new Date(Date.now() - 50000 + index * 1000).toISOString(),
    });
  }
  expect(new Set(history.flatMap(session => session.lesson.materials.map(material => material.rootId))).size).toBe(4);
  const result = corpusPracticeHistory(history, records, 'isolated-policy', 'reading', 'all', 'C1');
  expect(result.needsSupport).toBe(false);
  expect(result.independent).toBe(false);
  expect(result.maxWords).toBe(900);
});

it('supports the narrow grammatical structures without memorised names or article IDs', () => {
  for (const sentence of [
    'Mira stopped the machine with a wiring fault – possibly a short circuit from the damp conditions – to prevent further damage.',
    'The station was open, but Morgan never sent the warning, apparently because of a possible fault in the radio.',
    'The machine stopped, apparently because of a possible fault in the wiring.',
  ]) expect(corpusQualifiedCause(sentence, 1)?.sentence).toBe(sentence);
});

it('withholds interior sentences of multi-sentence quotations, including fictional or denied events', () => {
  const event = 'The director retired in June, apparently because of a possible illness.';
  for (const [open, close] of [['“', '”'], ['"', '"'], ['‘', '’'], ["'", "'"]]) {
    const text = `The archive displays a fictional speech: ${open}The meeting opened with a song. ${event} The crowd left in silence.${close} The curator says no such event occurred.`;
    for (let seed = 0; seed < 7; seed++) expect(corpusQualifiedCause(text, seed)).toBeUndefined();
  }
  expect(corpusQualifiedCause(`The curator said “The museum is open.” ${event}`, 0)?.sentence).toBe(event);
  expect(corpusQualifiedCause(`The visitors' tickets were checked. ${event}`, 0)?.sentence).toBe(event);
  expect(corpusQualifiedCause(`The curator said “She read ‘a story’. ${event} Then she left.”`, 0)).toBeUndefined();
  expect(corpusQualifiedCause(`The curator said “The meeting opened. ${event}`, 0)).toBeUndefined();
});

it('rejects quoted, hypothetical, uncertain-primary, repeated-cue, ambiguous and malformed claims', () => {
  const negative = [
    'The minister sent a parcel – possibly a gift from the mayor – to the museum.',
    'The captain returned a box – possibly a parcel from the harbour – to the station.',
    'The minister stopped his car with an issue – possibly a report from the mayor – to prevent further delay.',
    `“${event}”`, `'${event}'`, `The witness said ${event}`, `He stopped${event.slice('Alonso stopped'.length)}`,
    event.replace('Alonso stopped', 'Alonso might have stopped'), event.replace('Alonso stopped', 'If Alonso stopped'),
    event.replace('possibly a short', 'possibly a possible short'), event.replace('possibly a short', 'probably a short'),
    event.replace('a short circuit', 'no short circuit'), event.replace('the wet conditions', 'the conditions were wet'),
    event.replace('to become', 'to possibly become'), event.replace('Alonso stopped', 'Alonso reportedly stopped'),
    event.replace('electrical issue', 'possible electrical issue'), event.replace(' – to become', ' – and became'),
    event.replace('conditions –', 'conditions'), event.replace('3.', '3?'),
    withheldSignal.replace('apparently because', 'certainly because'), withheldSignal.replace('a possible threat', 'a threat'),
    withheldSignal.replace('a possible threat', 'a possible possible threat'), withheldSignal.replace('a possible threat', 'a possible threat that was not real'),
    withheldSignal.replace('Halsey never sent', 'Halsey could have sent'), withheldSignal.replace('The primary base', 'Its primary base'),
    `Critics denied ${event}`, `Critics disputed ${event}`, `According to a witness, ${event}`,
    event.replace('Alonso stopped', 'The report claims Alonso stopped'),
    event.replace('to become', 'to become uncertain but Alonso lost'),
    `${event} ${event}`, 'Alonso stopped because of the wet conditions.',
  ];
  for (const sentence of negative) expect(corpusQualifiedCause(sentence, 0), sentence).toBeUndefined();
  for (const seed of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusQualifiedCause(event, seed)).toThrow('INVALID_CORPUS_QUALIFIED_CAUSE');
  expect(() => corpusQualifiedCause('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_QUALIFIED_CAUSE');
  expect(corpusQualifiedCause('', 0)).toBeUndefined();
});
