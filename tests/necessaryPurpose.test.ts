import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusCondition, conditionPrompt, corpusLesson, corpusSchema, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { asTestLesson, score } from '../src/shared/content';

const scopes = [
  { root: 'nasa-article-10702250177615', sourceHash: '2d914289acbf053ec2dff324c3cdd53fa46fdd3844e46f8274a438532c1ea745',
    id: '23db41dafebd66c8551164c361e9c6997f5774db358dd23d28c9732b502e00b9', start: 181, end: 243,
    text: 'To generate lift, the airplane must be pushed through the air.' },
  { root: 'nasa-article-269667200623591', sourceHash: '6cbd8df07043bf31b13afb601e3bf2640a509837c4235db59a276c0a7009284a',
    id: '82f1b4926a8d508bb54b27500696985603ab26ed6ada2497751fdf3cb8a159d1', start: 1255, end: 1333,
    text: 'The fuselage must be designed with enough strength to withstand these torques.' },
];
const operation = `evidence:${conditionPrompt}`;
const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')));
const bank = { ...corpus, records: corpus.records.filter(source => scopes.some(scope => source.rootId === scope.root)) };

it('retains exact necessary-purpose statements and context from two hash-verified prepared NASA sources', async () => {
  const ready = await reviewedReading(bank.records);
  expect(ready.map(source => source.rootId).sort()).toEqual(scopes.map(scope => scope.root).sort());
  for (const scope of scopes) {
    const source = ready.find(source => source.rootId === scope.root)!;
    expect(source.sourceHash).toBe(scope.sourceHash);
    expect(createHash('sha256').update(readFileSync(`content/corpus/additional/raw/${source.id}.html`)).digest('hex')).toBe(scope.sourceHash);
    const passage = source.passages.find(passage => passage.id === scope.id)!;
    expect(createHash('sha256').update(passage.text).digest('hex')).toBe(scope.id);
    expect(passage.text.slice(scope.start, scope.end)).toBe(scope.text);
    for (let seed = 0; seed < 12; seed++) {
      const task = corpusCondition(passage.text, seed)!;
      expect(task).toEqual(corpusCondition(passage.text, seed));
      expect(task.prompt).toBe(conditionPrompt);
      expect(task.evidence).toEqual({ start: scope.start, end: scope.end });
      expect(task.spans[task.accepted[0]].text).toBe(scope.text);
      expect(task.accepted).toHaveLength(1);
      expect(task.explanation).toContain('does not guarantee the outcome');
      for (const [index, span] of task.spans.entries()) {
        expect(passage.text.slice(span.start, span.end)).toBe(span.text);
        if (!task.accepted.includes(index)) expect(span.text).not.toMatch(/\b(?:must|only|if|when|required|necessary)\b/i);
      }
    }
  }
});

it('transfers required-condition evidence between the actual roots at ordinary effort and preserves Test scoring', () => {
  for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2', [], 'evidence', [], operation)!;
    expect(lesson).toBeDefined();
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const before = structuredClone(lesson), tested = asTestLesson(lesson);
    expect(tested.mode).toBe('test');
    expect(lesson.teaching).toBeDefined(); expect(lesson.workedExample).toBeDefined();
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined(); expect(tested.nextStep).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const scope = scopes.find(scope => scope.root === material.rootId)!;
      const source = bank.records.find(source => source.rootId === scope.root)!;
      expect(material.blocks[0].text).toBe(source.passages.find(passage => passage.id === scope.id)!.text);
      expect(material.credit).toEqual({ attribution: source.attribution, license: source.licence, sourceUrl: source.originalUrl });
      const question = material.questions[0], testQuestion = tested.materials[index].questions[0];
      expect(corpusOperation(question)).toBe(operation);
      if (!('kind' in question) || question.kind !== 'evidence' || !('kind' in testQuestion) || testQuestion.kind !== 'evidence') throw Error('Expected necessary-condition evidence');
      expect(question.evidence).toEqual({ start: scope.start, end: scope.end });
      expect(testQuestion.spans).toEqual(question.spans); expect(testQuestion.accepted).toEqual(question.accepted);
      expect(testQuestion.evidence).toEqual(question.evidence); expect(testQuestion.prompt).toBe(question.prompt);
      expect(tested.materials[index].blocks).toEqual(material.blocks);
      expect(tested.materials[index].rootId).toBe(material.rootId);
      expect(question.hints).toHaveLength(3); expect(testQuestion.hints).toBeUndefined();
      for (const [choice, span] of question.spans.entries()) {
        expect(material.blocks[0].text.slice(span.start, span.end)).toBe(span.text);
        expect(score(question, choice).correct).toBe(question.accepted.includes(choice));
        expect(score(testQuestion, choice)).toEqual(score(question, choice));
      }
      expect('kind' in material.questions[1] && material.questions[1].kind).toBe('response');
      expect(score(material.questions[1], 'The stated requirement alone does not guarantee the outcome.').correct).toBeNull();
      expect(score(tested.materials[index].questions[1], 'The stated requirement alone does not guarantee the outcome.').correct).toBeNull();
      expect(tested.materials[index].questions[1].hints).toBeUndefined();
      expect(corpusWorkedExample(material, seed, 'B2')).toBeUndefined();
    }
    expect(lesson).toEqual(before);
  }
  for (const seed of [24, 25, 26, 132, 133, 134]) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2')!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) expect(corpusOperation(material.questions[0])).toBe(operation);
  }
  for (const point of ['A1', 'A2'] as const) expect(corpusLesson(bank, new Set(), 0, 300, point, [], 'evidence', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(scopes.map(scope => scope.id)), 0, 300, 'B2', [], 'evidence', [], operation)).toBeUndefined();
});

it('rejects epistemic must, sufficient conditions, reports, incomplete context and ambiguous alternatives', () => {
  const direct = 'The workshop opened in June. Engineers inspect the building every morning.';
  for (const statement of [
    'To generate lift, the airplane can be pushed through the air.',
    'To generate lift, the airplane must not be pushed through the air.',
    'To generate no lift, the airplane must be pushed through the air.',
    'If the airplane is pushed through the air, lift is generated.',
    'To generate lift, the airplane must be pushed through the air if the wings are intact.',
    'To generate lift, the airplane must be pushed through the air unless the engine fails.',
    'Were the weather calmer, the airplane would be pushed through the air.',
    'The airplane must have been pushed through the air.',
    'Judging by its motion, the airplane must be pushed through the air.',
    'The engineer believes that to generate lift, the airplane must be pushed through the air.',
    'The engineer said, “To generate lift, the airplane must be pushed through the air.”',
    'An unfinished quotation begins: “The workshop opened. ' + scopes[0].text,
    'The wings generate lift to hold the plane in the air.',
    'The airplane must be pushed through the air.',
    scopes[1].text,
    direct + ' ' + scopes[1].text,
    scopes[0].text.slice(0, -1),
    scopes[0].text + '.',
    scopes[0].text + ' ' + scopes[0].text,
    'To generate lift, the airplane must be pushed through the apparently still air.',
  ]) expect(corpusCondition(statement + ' ' + direct, 0), statement).toBeUndefined();
  expect(corpusCondition(scopes[0].text + ' The gate opens only if the lamp is lit.', 0)).toBeUndefined();
  expect(corpusCondition(scopes[0].text + ' The gate opens only if the lamp is lit. The workshop opened in June.', 0)).toBeUndefined();
});

it('does not establish a these-context from a quoted, hypothetical or uncertain noun mention', () => {
  const direct = 'The workshop opened in June. Engineers inspect the building every morning.';
  for (const previous of [
    'The engineer said “torques”.',
    'If the controls move, the aircraft generates torques.',
    'The aircraft might rotate because of torques.',
    'The aircraft rotates because of “torques”.',
    'The aircraft rotates if the controls generate torques.',
    'The aircraft rotates because of what might be torques.',
    'The aircraft does not rotate because of torques.',
    'The aircraft rotates because of allegedly generated torques.',
    'The engineer mentions torques.',
    'Torques and the aircraft.',
  ]) {
    const text = previous + ' ' + scopes[1].text + ' ' + direct;
    for (let seed = 0; seed < 3; seed++) expect(corpusCondition(text, seed), previous).toBeUndefined();
  }
  const source = bank.records.find(source => source.rootId === scopes[1].root)!;
  const passage = source.passages.find(passage => passage.id === scopes[1].id)!;
  expect(passage.text).toContain('In flight, the aircraft rotates around the center of gravity because of torques generated by the elevator, rudder, and ailerons.');
  expect(corpusCondition(passage.text, 0)!.spans[0].text).toBe(scopes[1].text);
});
