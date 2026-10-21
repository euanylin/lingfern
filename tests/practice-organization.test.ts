import { expect, it } from 'vitest';
import admission from '../content/corpus/long-listening-admission.json';
import raw from './fixtures/content/a1-reading.json';
import { alignedGapQuestion, listeningGapSpacing, organizePractice, readingQuestionPlan } from '../src/core/practiceOrganization';
import { answerPointCount, quantityBudget } from '../src/shared/practiceQuantity';
import { asTestLesson, lessonSchema, score, scoreParts, validateAnswer } from '../src/shared/content';

const reading = lessonSchema.parse(raw);
it('retains old snapshots and makes deterministic, source-bound, distinct additional questions before Test conversion', () => {
  const original = structuredClone(reading);
  const next = organizePractice(reading);
  expect(reading).toEqual(original); expect(next.organization).toBe('material-v1');
  expect(organizePractice(reading)).toEqual(next); expect(organizePractice(next)).toEqual(next);
  const test = asTestLesson(next);
  expect(test.materials.map(material => material.questions.map(({ hints: _hints, ...question }) => { void _hints; return question; }))).toEqual(next.materials.map(material => material.questions.map(({ hints: _hints, ...question }) => { void _hints; return question; })));
  expect(test.materials.every(material => material.questions.every(question => !question.hints))).toBe(true);
});

it('plans from length, useful information, structure, genre, complexity and level, with a bounded effort budget', () => {
  const base = reading.materials[0];
  const material = (text: string, title = 'A research report') => ({ ...base, title, blocks: [{ id: base.blocks[0].id, text }] });
  const sentence = 'Researchers collected different mineral specimens from nearby mountains and carefully recorded their findings. ';
  const sample = (count: number) => Array.from({ length: count }, (_, index) => `${sentence} Observation ${index + 1} has a separate documented context.`).join(' ');
  const short = readingQuestionPlan(material(sample(8)), 'B2');
  const medium = readingQuestionPlan(material(sample(30)), 'B2');
  const long = readingQuestionPlan(material(sample(65)), 'C2');
  expect(short.target).toBeLessThan(medium.target); expect(medium.target).toBeLessThanOrEqual(long.target);
  const plain = readingQuestionPlan(material(sentence.repeat(30)), 'B2');
  const structured = readingQuestionPlan(material(Array.from({ length: 15 }, (_, index) => `However, in ${2005 + index} researchers collected several mineral specimens. `).join('\n\n')), 'B2');
  expect(structured.paragraphs).toBeGreaterThan(plain.paragraphs); expect(structured.relations).toBeGreaterThan(plain.relations);
  expect(readingQuestionPlan(material(sentence.repeat(30)), 'A1').minutes).toBeLessThan(plain.minutes);
  expect(readingQuestionPlan(material('A cat sat. '.repeat(30)), 'B2').useful).toBe(0);
});

const phrases = ['The workshop requires careful preparation.', 'The visitors gathered beside the entrance.', 'The gardener selected another container.', 'The children discovered several colourful insects.', 'The team recorded important observations.'];
function alignedMaterial() {
  const text = phrases.join(' '), base = reading.materials[0]; let at = 0;
  const segments = phrases.map((text, index) => { const result = { start: at, end: at + text.length, text, audioStart: index * 20, audioEnd: index * 20 + 5 }; at += text.length + 1; return result; });
  return { material: { ...base, audio: { src: '/audio/a1-words/word-1.mp3', duration: 91, sha256: 'a'.repeat(64), author: 'test', sourceUrl: 'local:original', license: 'test' }, blocks: [{ id: base.blocks[0].id, text }], questions: [] } as typeof base, segments };
}
it('uses exact segment bounds and adequate spaces, never interpolates word timestamps or overfills short/unreliable audio', () => {
  const { material, segments } = alignedMaterial();
  const question = alignedGapQuestion(material, segments, 'B1', 3)!;
  expect(question).toBeDefined(); if (!('gaps' in question)) throw new Error('NO_GAPS');
  expect(question.gaps.length).toBeGreaterThanOrEqual(2);
  for (const gap of question.gaps) {
    expect(material.blocks[0].text.slice(gap.evidence.start, gap.evidence.end)).toBe(gap.answer);
    expect(segments.some(segment => gap.evidence.audioStart === segment.audioStart && gap.evidence.audioEnd === segment.audioEnd)).toBe(true);
  }
  for (let index = 1; index < question.gaps.length; index++) expect(question.gaps[index].evidence.audioStart! - question.gaps[index - 1].evidence.audioEnd!).toBeGreaterThanOrEqual(listeningGapSpacing(material.blocks[0].text.split(/\s+/).length, 91, 'B1'));
  const answers = question.gaps.map(gap => gap.answer);
  expect(score(question, answers).correct).toBe(true);
  const partial = [...answers]; partial[1] = 'incorrect';
  expect(scoreParts(question, partial).filter(part => part.correct)).toHaveLength(answers.length - 1); expect(score(question, partial).correct).toBe(false);
  expect(() => validateAnswer(question, answers.map(() => ''), true)).not.toThrow();
  expect(() => validateAnswer(question, answers.map(() => ''))).toThrow();
  expect(alignedGapQuestion(material, [], 'B1', 0)).toBeUndefined();
  expect(alignedGapQuestion({ ...material, audio: { ...material.audio!, duration: 5 } }, segments, 'B1', 0)).toBeUndefined();
  expect(alignedGapQuestion(material, segments.map(segment => ({ ...segment, text: 'forged' })), 'B1', 0)).toBeUndefined();
  expect(listeningGapSpacing(250, 60, 'A1')).toBeGreaterThan(listeningGapSpacing(90, 60, 'C2'));
});

it('does not let a full-passage unscored response suppress distinct source-bound questions', () => {
  const lesson = structuredClone(reading), material = lesson.materials[0];
  material.blocks[0].text += '\n\n' + ['butterflies', 'containers', 'vegetables', 'waterfalls', 'architects', 'libraries', 'astronauts', 'musicians', 'mountains', 'hospitals', 'workshops', 'newspapers', 'buildings', 'paintings', 'passengers', 'neighbours', 'batteries', 'forests', 'crystals', 'dolphins', 'volcanoes', 'telescopes', 'carpenters', 'orchards', 'fountains', 'printers', 'bicycles', 'harbours', 'satellites', 'laboratories'].map(word => `The ${word} featured in a separate observation. Its context was described in the local report with several details about the original setting and its particular significance.`).join('\n\n');
  material.questions.push({ kind: 'response', id: 'whole-reflection', blockId: material.blocks[0].id, prompt: 'Summarize with evidence.', evidence: { start: 0, end: material.blocks[0].text.length }, criteria: [reading.teaching!, reading.workedExample!], hints: [reading.teaching!, reading.teaching!, reading.teaching!], explanation: reading.teaching! });
  const result = organizePractice(lesson);
  expect(result.materials[0].questions.length).toBeGreaterThan(material.questions.length);
  const extra = result.materials[0].questions.filter(question => 'kind' in question && question.kind === 'completion');
  expect(extra.length).toBeGreaterThan(1);
  expect(new Set(extra.map(question => 'answer' in question ? question.answer : '')).size).toBe(extra.length);
});

it('builds multi-gap tasks from retained real long-window alignment evidence without inventing times', () => {
  const inspected = admission.records[0], clip = inspected.clip;
  const material = { ...reading.materials[0], rootId: inspected.rootId, blocks: [{ id: 'real-aligned', text: clip.text }], questions: [],
    audio: { src: '/audio/fixture-only/alignment-not-played.mp3', sha256: clip.audioSha256, duration: clip.duration, author: clip.author, sourceUrl: clip.sourceUrl, license: clip.license } };
  const question = alignedGapQuestion(material, clip.segments, 'B2', 4)!;
  expect(question).toBeDefined(); if (!('gaps' in question)) throw new Error('NO_GAPS');
  expect(question.gaps.length).toBeGreaterThanOrEqual(3);
  expect(question.gaps.every(gap => clip.segments.some(segment => segment.audioStart === gap.evidence.audioStart && segment.audioEnd === gap.evidence.audioEnd && segment.start <= gap.evidence.start && segment.end >= gap.evidence.end))).toBe(true);
});

it('rejects forged multi-gap source ranges, duplicated markers and false timeline evidence', async () => {
  const { multiGapListening } = await import('./fixtures/workspace-lessons');
  const valid = multiGapListening(); expect(() => lessonSchema.parse(valid)).not.toThrow();
  const mutate = (change: (question: Extract<import('../src/shared/content').Question, {kind: 'gap-fill'}>) => void) => { const copy = structuredClone(valid); const question = copy.materials[0].questions[0]; if (!('gaps' in question)) throw new Error('NO_GAPS'); change(question); return copy; };
  expect(() => lessonSchema.parse(mutate(question => question.gaps[1].id = question.gaps[0].id))).toThrow();
  expect(() => lessonSchema.parse(mutate(question => question.gaps[0].answer = 'not-recorded'))).toThrow();
  expect(() => lessonSchema.parse(mutate(question => question.gaps[1].evidence.audioStart = 0))).toThrow();
  expect(() => lessonSchema.parse(mutate(question => question.passage = question.passage.replace('{{g1}}', 'revealed')))).toThrow();
});

it('excludes every additional evidence range when expanding a passage', () => {
  const lesson = structuredClone(reading), material = lesson.materials[0], block = material.blocks[0];
  block.text += '\n\nThe butterflies arrived beside the waterfalls. The astronauts inspected the containers. The musicians described the vegetables.';
  material.questions[0].additionalEvidence = [{ blockId: block.id, start: 0, end: block.text.length }];
  expect(organizePractice(lesson).materials[0].questions.every(question => material.questions.some(original => original.id === question.id))).toBe(true);
});

it('caps rich whole sources at twelve points without increasing quantity for harder CEFR levels', () => {
  const text = Array.from({ length: 80 }, (_, index) => `However, observation ${index + 1} records a separate mineral discovery in location ${index + 2}. Researchers describe this particular finding and its surrounding context.`).join('\n\n');
  const material = { ...reading.materials[0], title: 'Field notes', blocks: [{ id: reading.materials[0].blocks[0].id, text }] };
  const plan = readingQuestionPlan(material, 'C2', ['science']);
  expect(plan.genre).toBe('expository'); expect(plan.target).toBe(quantityBudget('reading', plan.words).baseline); expect(plan.target).toBeLessThanOrEqual(12); expect(plan.target).toBeLessThanOrEqual(plan.maximum);
  expect(readingQuestionPlan(material, 'A1', ['science']).target).toBe(plan.target);
  const repeated = { ...material, blocks: [{ ...material.blocks[0], text: 'The butterflies appeared in the garden. '.repeat(100) }] };
  expect(readingQuestionPlan(repeated, 'C2').useful).toBe(1);
});

it('does not retest dates already used as additional objective evidence in another block', () => {
  const lesson = structuredClone(reading), material = lesson.materials[0];
  const text = 'The library opened in 1991. The hall was rebuilt in 2013. The museum closed in 2020.';
  material.blocks.push({ id: 'dated-events', text });
  material.questions[0].additionalEvidence = [{ blockId: 'dated-events', start: 0, end: text.length }];
  // Provide enough untouched information to exceed the old pre-generation question count.
  material.blocks.push({ id: 'separate-observations', text: Array.from({ length: 14 }, (_, index) => `However, the research team reported observation ${index + 1} with several distinctive environmental conditions.`).join('\n\n') });
  const without = structuredClone(lesson); without.materials[0].questions[0].additionalEvidence = undefined;
  without.materials[1].blocks.push({ id: 'application-dates', text: text + ' ' + Array.from({length: 220}, () => 'context').join(' ') });
  const table = organizePractice(without, [], ['table']); expect(table.materials[0].questions.some(question => 'rows' in question && question.blockId === 'dated-events')).toBe(true);
  expect(answerPointCount(table.materials[0].questions)).toBeLessThanOrEqual(quantityBudget('reading', readingQuestionPlan(without.materials[0], 'A1').words).maximum);
  const selected = organizePractice(lesson).materials[0].questions;
  expect(selected.some(question => question.id === material.questions[0].id) && selected.some(question => 'rows' in question && question.blockId === 'dated-events')).toBe(false);
});
