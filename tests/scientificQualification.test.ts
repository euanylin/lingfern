import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusLesson, corpusQualification, corpusSchema, corpusStartingPoint, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation, qualificationPrompt } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { asTestLesson, score } from '../src/shared/content';

const scopes = [
  { root: 'noaa-article-79852449220319', hash: '1c0ff25e48f872ec72d0757eedb2c3e0c3b268144a55b2498873a9866f9d450d',
    start: 0, end: 93, text: 'Scientists estimate that roughly half of the oxygen production on Earth comes from the ocean.' },
  { root: 'noaa-article-215039592644680', hash: '33977c8d5553d7e8f3570ed44bd29d0cff6493de5a454dfb478d7308bf26b46e',
    start: 104, end: 186, text: 'Research suggests, however, that the number of species in the ocean is decreasing.' },
];

it('locates complete scientific inference evidence in two actual NOAA roots without weakening their qualifications', async () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')));
  const ready = await reviewedReading(bank.records);
  for (const scope of scopes) {
    const source = ready.find(source => source.rootId === scope.root)!;
    expect(source, scope.root).toBeDefined();
    const passage = source.passages.find(passage => passage.id === scope.hash)!;
    expect(createHash('sha256').update(passage.text).digest('hex')).toBe(scope.hash);
    expect(passage.text.slice(scope.start, scope.end)).toBe(scope.text);
    for (let seed = 0; seed < 12; seed++) {
      const task = corpusQualification(passage.text, seed)!;
      expect(task).toEqual(corpusQualification(passage.text, seed));
      expect(task.prompt).toBe(qualificationPrompt);
      expect(task.evidence).toEqual({ start: scope.start, end: scope.end });
      expect(task.accepted).toHaveLength(1);
      expect(task.spans[task.accepted[0]].text).toBe(scope.text);
      expect(task.explanation).toContain(scope.text.startsWith('Scientists') ? 'Scientists estimate that' : 'Research suggests, however, that');
      for (const [index, span] of task.spans.entries()) {
        expect(passage.text.slice(span.start, span.end)).toBe(span.text);
        if (!task.accepted.includes(index)) expect(span.text).not.toMatch(/estimate|suggest|likely|might|may|uncertain|unknown/i);
      }
    }
  }
});

it('also scores two more installed research-suggests sentences with the same cue', () => {
  const files = ['public/corpus/additional.json', 'public/corpus/open-reading.json'];
  const extra = [
    { root: 'frontiers-article-10.3389-frym.2017.00025', hash: '95037dd6c5634c1836ae244be3e1b182ab363df01bcfdb5797ef08a79f7ff74a',
      start: 478, end: 599, text: 'Research suggests that when we mind wander, our responses to information from the external world around us are disrupted.' },
    { root: 'openstax-book-psychology-2e', hash: '9122710da434704881e9fc92303815f9e4dfd156868a58ad80b5f57737490d3d',
      start: 753, end: 877, text: 'Research suggests that greater parental involvement is correlated with a greater reduction in use by teen substance abusers.' },
  ];
  const records = files.flatMap(file => corpusSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).records);
  for (const scope of extra) {
    const source = records.find(source => source.rootId === scope.root)!;
    const passage = source.passages.find(passage => passage.id === scope.hash)!;
    expect(passage.text.slice(scope.start, scope.end)).toBe(scope.text);
    for (let seed = 0; seed < 6; seed++) {
      const task = corpusQualification(passage.text, seed)!;
      expect(task.spans[task.accepted[0]].text).toBe(scope.text);
      expect(task.evidence).toEqual({ start: scope.start, end: scope.end });
      expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe(scope.text);
    }
  }
});

it('transfers the same scientific inference operation across the two real roots and scores only exact evidence', () => {
  const all = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')));
  const bank = { ...all, records: all.records.filter(source => scopes.some(scope => scope.root === source.rootId)) };
  const operation = `evidence:${qualificationPrompt}`;
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) {
    for (let seed = 0; seed < 12; seed++) {
      const lesson = corpusLesson(bank, new Set(), seed, 300, point, [], 'evidence', operation)!;
      expect(lesson).toBeDefined();
      expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
      const before = structuredClone(lesson), tested = asTestLesson(lesson);
      expect(tested.mode).toBe('test');
      expect(lesson.teaching).toBeDefined(); expect(lesson.workedExample).toBeDefined();
      expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined(); expect(tested.nextStep).toBeUndefined();
      for (const [materialIndex, material] of lesson.materials.entries()) {
        const scope = scopes.find(scope => scope.root === material.rootId)!;
        expect(material.blocks[0].text).toBe(bank.records.find(source => source.rootId === scope.root)!.passages[0].text);
        const testedMaterial = tested.materials[materialIndex];
        const { questions: practiceQuestions, ...practiceMaterial } = material;
        const { questions: testQuestions, ...testMaterial } = testedMaterial;
        expect(testMaterial).toEqual(practiceMaterial);
        expect(testQuestions.map(question => question.id)).toEqual(practiceQuestions.map(question => question.id));
        expect(testQuestions.map(question => question.prompt)).toEqual(practiceQuestions.map(question => question.prompt));
        expect(testQuestions.map(question => question.evidence)).toEqual(practiceQuestions.map(question => question.evidence));
        expect(testQuestions.map(question => question.hints)).toEqual([undefined, undefined]);
        const question = material.questions[0];
        expect(corpusOperation(question)).toBe(operation);
        if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected scientific inference evidence');
        const testedQuestion = testedMaterial.questions[0];
        if (!('kind' in testedQuestion) || testedQuestion.kind !== 'evidence') throw new Error('Expected unchanged test evidence');
        expect(question.hints).toHaveLength(3);
        expect(testedQuestion.spans).toEqual(question.spans);
        expect(testedQuestion.accepted).toEqual(question.accepted);
        expect(testedQuestion.additionalEvidence).toEqual(question.additionalEvidence);
        expect(question.evidence).toEqual({ start: scope.start, end: scope.end });
        expect(question.spans[question.accepted[0]].text).toBe(scope.text);
        for (const [index, span] of question.spans.entries()) {
          expect(material.blocks[0].text.slice(span.start, span.end)).toBe(span.text);
          expect(score(question, index).correct).toBe(question.accepted.includes(index));
          expect(score(testedQuestion, index)).toEqual(score(question, index));
        }
        const interpretation = material.questions[1];
        expect('kind' in interpretation && interpretation.kind).toBe('response');
        expect(score(interpretation, 'This is an estimate or an inference, preserving its wording.').correct).toBeNull();
        expect(score(testedMaterial.questions[1], 'This is an estimate or an inference, preserving its wording.')).toEqual(score(interpretation, 'This is an estimate or an inference, preserving its wording.'));
      }
      expect(lesson).toEqual(before);
    }
  }
  // Reach the rule through ordinary rotation without forced focus.
  for (const seed of [28, 29, 100, 101]) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2')!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) expect(corpusOperation(material.questions[0])).toBe(operation);
  }
});

it('rejects scientific report ambiguity, malformed boundaries, duplicate evidence and insufficient plain alternatives', () => {
  const direct = 'The team mapped the shore in June. The cliff contains three separate layers.';
  for (const statement of [
    'Scientists do not estimate that oxygen comes from the ocean.',
    'Research suggests that the number of species in the ocean is not decreasing.',
    'If scientists estimate that oxygen comes from the ocean, the team will investigate.',
    'Research suggests that if the sea is warmer, the count changes.',
    'Researchers dispute that scientists estimate that oxygen comes from the ocean.',
    'Research suggests that scientists deny that the ocean is losing species.',
    'Research suggests that the ocean is said to produce oxygen.',
    '“Scientists estimate that roughly half of the oxygen production on Earth comes from the ocean.”',
    '"Scientists estimate that roughly half of the oxygen production on Earth comes from the ocean."',
    'Scientists estimate that the amount of oxygen from the ocean.',
    'Scientists estimate that the amount of oxygen from the ocean is.',
    'Scientists estimate the oxygen production from the ocean.',
    scopes[0].text.slice(0, -1),
    scopes[0].text + '.',
    scopes[0].text + ' ' + scopes[0].text,
    'The speaker began an unfinished quote: “A discussion started. ' + scopes[0].text,
  ]) expect(corpusQualification(statement + ' ' + direct, 0), statement).toBeUndefined();
  const tentative = 'Another group suggests a different origin. The precise amount remains unknown.';
  expect(corpusQualification(scopes[0].text + ' ' + tentative, 0)).toBeUndefined();
  expect(corpusQualification(scopes[1].text + ' ' + tentative + ' The team mapped the shore in June.', 0)).toBeUndefined();
});

it('rejects actual Gutenberg counterfactuals and an Intl-truncated quotation while retaining complete explicit belief wording', () => {
  const gutenberg = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  for (const [root, id, wording] of [
    ['gutenberg-book-1342', '0f236d7e45fa957fb948a0110c1ebe76731fdf8d2b76cd21b1869e11d5f9aa37', 'Had he been a bad prig or a bad coxcomb, he might have been still smarting under his rejection'],
    ['gutenberg-book-161', '1137e9a8854ede87cabad84be25b4d2f3a491b83ed92abf984c8a308947a420b', 'Had he married a more amiable woman, he might have been made still more respectable'],
    ['gutenberg-book-514', 'd08025ca7589ec5592e128eb19cc45aa540a4e65b8fcde55d792255c7fb45788', 'Laurie colored up, but answered frankly, “Why, you see'],
  ]) {
    const source = gutenberg.records.find(source => source.rootId === root)!;
    const passage = source.passages.find(passage => passage.id === id)!;
    expect(createHash('sha256').update(passage.text).digest('hex')).toBe(id);
    expect(passage.text).toContain(wording);
    const index = source.passages.indexOf(passage);
    const withContext = source.passages.slice(Math.max(0, index - 2), index + 1).map(passage => passage.text).join('\n\n');
    for (let seed = 0; seed < 6; seed++) {
      expect(corpusQualification(passage.text, seed), root).toBeUndefined();
      expect(corpusQualification(withContext, seed), root + ' with preceding source paragraphs').toBeUndefined();
    }
  }
  const direct = 'The team mapped the shore in June. The cliff contains three separate layers.';
  for (const clause of [
    'Had the weather stayed warm, the island might have been accessible.',
    'Were the reports correct, the island is thought to have formed earlier.',
    'If the survey is correct, the island is believed to have formed earlier.',
    '_Had the weather stayed warm, the island might have been accessible._',
    '“If the survey is correct, the island is believed to have formed earlier.”',
    'A speaker began: “This explanation follows. The island is thought to have formed after an eruption.',
    'The guide said, “The island is thought to have formed after an eruption. The expedition continued.”',
  ]) expect(corpusQualification(clause + ' ' + direct, 0), clause).toBeUndefined();
  for (const complete of [
    'The island is thought to have formed after an eruption.',
    '“The island is thought to have formed after an eruption.”',
    'The guide said, “The island is thought to have formed after an eruption.”',
    'The islands’ origin is thought to have involved an eruption.',
  ]) {
    const text = complete + ' ' + direct;
    const task = corpusQualification(text, 0)!;
    expect(task.spans[task.accepted[0]].text).toBe(complete);
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(complete);
    expect(task.explanation).toContain('belief, inference or possibility');
  }
});

it('teaches complete qualification interpretations without leaking assessed sentences or changing closed questions', () => {
  const all = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')));
  const bank = { ...all, records: all.records.filter(source => scopes.some(scope => scope.root === source.rootId)) };
  let fallbacks = 0;
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, point, [], 'evidence', `evidence:${qualificationPrompt}`)!;
    const example = corpusWorkedExample(lesson.materials[0], seed, point);
    if (example) expect(lesson.workedExample).toEqual(example);
    else { fallbacks++; expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i); expect(lesson.workedExample!.en).toContain('does not establish'); expect(lesson.workedExample!.en).toContain('not an exact count'); }
    expect(lesson.teaching!.en).toContain('complete qualified claim'); expect(lesson.teaching!.en).toContain('roughly'); expect(lesson.teaching!.en).toContain('does not establish a cause');
    for (const material of lesson.materials) {
      const question = material.questions[0]; if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected exact evidence');
      expect(lesson.workedExample!.en).not.toContain(question.spans[question.accepted[0]].text);
    }
    const original = structuredClone(lesson), reapplied = corpusStartingPoint(lesson, point);
    expect(reapplied.materials).toEqual(original.materials); expect(lesson).toEqual(original);
    expect(lesson.teaching!['zh-Hans']).toBe(lesson.teaching!.en); expect(lesson.teaching!['zh-Hant']).toBe(lesson.teaching!.en);
    const tested = asTestLesson(lesson); expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined(); expect(tested.nextStep).toBeUndefined();
  }
  expect(fallbacks).toBeGreaterThan(0);
  // Keep unused-source regression fixtures outside distributed sources and scored items.
  const fixture = corpusLesson(bank, new Set(), 0, 300, 'B2', [], 'evidence', `evidence:${qualificationPrompt}`)!;
  const other = 'The harbour is thought to have opened after a flood.';
  fixture.materials[0].blocks[0].text += ' ' + other;
  const unused = corpusWorkedExample(fixture.materials[0], fixture.generation!.seed, 'B2');
  expect(unused).toBeDefined(); expect(unused!.en).toContain(other);
  const supported = corpusStartingPoint(fixture, 'B2');
  expect(supported.workedExample).toEqual(unused); expect(supported.materials).toEqual(fixture.materials);

});
