import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusLesson, corpusSchema, corpusStartingPoint, corpusWorkedExample, concessionPrompt } from '../src/core/corpus';
import { asTestLesson, score } from '../src/shared/content';

const attributionPrompt = 'Which sentence explicitly attributes a claim to a named source?';
const additional = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')));
const open = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/open-reading.json', 'utf8')));
const attributionHashes: Record<string, string> = {
  d7401fc92dfe88dbccc6d9fa8f4da936aaf31265ec0a43f6b46d09bc09d742cb: '22b22ccd494d6b0b3534213847694af748cc14a53a15b2b90a9c5266600bcd44',
  eca66248958c56e975e5d2c7fb88e7873325c29bed23d88acfb5696b9a9bdcdd: '0e2a33c9fc87ab8d09a0d67445981b1ba74b4eff84a10224fc2305c1ee8ca292',
};
const concession = { ...additional, records: additional.records.filter(source => ['nasa-article-194222171056800', 'noaa-article-217121916223523'].includes(source.rootId)) };
const attribution = { ...open, records: ['d7401fc92dfe88dbccc6d9fa8f4da936aaf31265ec0a43f6b46d09bc09d742cb', 'eca66248958c56e975e5d2c7fb88e7873325c29bed23d88acfb5696b9a9bdcdd'].map(id => {
  const source = open.records.find(source => source.passages.some(passage => passage.id === id))!;
  return { ...source, passages: source.passages.filter(passage => passage.id === id) };
}) };

for (const [prompt, bank] of [[concessionPrompt, concession], [attributionPrompt, attribution]] as const) it(`demonstrates ${prompt} with complete unscored examples and unchanged exact tasks`, () => {
  let fallbacks = 0;
  for (const level of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, level, [], 'evidence', [], `evidence:${prompt}`)!;
    for (const source of bank.records) for (const passage of source.passages) expect(createHash('sha256').update(passage.text).digest('hex')).toBe(attributionHashes[passage.id] ?? passage.id);
    expect(lesson).toBeDefined(); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const unused = corpusWorkedExample(lesson.materials[0], seed, level);
    if (unused) expect(lesson.workedExample).toEqual(unused);
    else {
      fallbacks++;
      expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      if (prompt === concessionPrompt) {
        expect(lesson.workedExample!.en).toContain('Keep “seems” and both clauses');
        expect(lesson.workedExample!.en).toContain('does not establish a cause');
        expect(lesson.workedExample!.en).toContain('overall attitude');
      } else {
        expect(lesson.workedExample!.en).toContain('Mira reports a possible benefit during the trial');
        expect(lesson.workedExample!.en).toContain('Keep “may”');
        expect(lesson.workedExample!.en).toContain('writer’s endorsement');
        expect(lesson.workedExample!.en).toContain('attribution proves neither truth');
      }
    }
    for (const material of lesson.materials) {
      const question = material.questions[0]; if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected evidence');
      expect(question.prompt).toBe(prompt);
      expect(lesson.workedExample!.en).not.toContain(question.spans[question.accepted[0]].text);
      for (const [index, span] of question.spans.entries()) {
        expect(material.blocks[0].text.slice(span.start, span.end)).toBe(span.text);
        expect(score(question, index).correct).toBe(question.accepted.includes(index));
      }
      expect(score(material.questions[1], 'A source-supported interpretation.').correct).toBeNull();
    }
    const saved = structuredClone(lesson); expect(corpusStartingPoint(lesson, level).materials).toEqual(saved.materials); expect(lesson).toEqual(saved);
    expect(lesson.workedExample!['zh-Hans']).toBe(lesson.workedExample!.en); expect(lesson.workedExample!['zh-Hant']).toBe(lesson.workedExample!.en);
    const tested = asTestLesson(lesson); expect(tested.workedExample).toBeUndefined(); expect(tested.teaching).toBeUndefined(); expect(tested.nextStep).toBeUndefined();
  }
  expect(fallbacks).toBeGreaterThan(0);
});

it('preserves the original unused-source attribution demonstration instead of the fallback', () => {
  const fixture = corpusLesson(attribution, new Set(), 0, 300, 'B2', [], 'evidence', [], `evidence:${attributionPrompt}`)!;
  // Isolated regression wording, never a distributed source or scored item.
  const other = 'According to Dana, the harbour served a nearby town.';
  fixture.materials[0].blocks[0].text += ' ' + other;
  const example = corpusWorkedExample(fixture.materials[0], 0, 'B2');
  expect(example).toBeDefined(); expect(example!.en).toContain(other);
  expect(corpusStartingPoint(fixture, 'B2').workedExample).toEqual(example);
});
