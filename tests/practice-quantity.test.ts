import { expect, it } from 'vitest';
import fc from 'fast-check';
import { answerPointCount, englishWords, quantityBudget, questionSlots, readingWordCount } from '../src/shared/practiceQuantity';
import { asTestLesson, scoreParts, validateAnswer, type Question } from '../src/shared/content';
import { organizePractice, listeningAnswerSpans, listeningSpacingValid } from '../src/core/practiceOrganization';
import { quantityFixture } from './fixtures/quantity-lessons';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });

it.each([[150,2],[300,4],[500,5],[800,7],[1000,9],[1500,11],[2000,12]])('reading baseline: %i words gives %i answer points', (length, expected) => {
  expect(quantityBudget('reading', length).baseline).toBe(expected);
});
it.each([[30,2],[60,3],[120,5],[180,7],[300,11],[480,14],[720,18],[900,20]])('listening baseline: %i seconds gives %i answer points', (length, expected) => {
  expect(quantityBudget('listening', length).baseline).toBe(expected);
});
it('interpolates monotonically across every boundary, handles invalid inputs and caps whole materials', () => {
  for (const skill of ['reading','listening'] as const) {
    let previous = 0;
    for (let length = 1; length <= 4000; length++) { const plan = quantityBudget(skill, length); expect(plan.baseline - previous).toBeGreaterThanOrEqual(0); expect(plan.baseline - previous).toBeLessThanOrEqual(1); expect(plan.baseline).toBeLessThanOrEqual(skill === 'reading' ? 12 : 20); previous = plan.baseline; }
    for (const value of [undefined, 0, -1, NaN, Infinity]) expect(quantityBudget(skill, value).baseline).toBe(0);
  }
  expect(quantityBudget('reading', 2001).preferSegments).toBe(true); expect(quantityBudget('listening', 901).preferSegments).toBe(true);
  fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), length => { expect(quantityBudget('reading', length + 1).baseline).toBeGreaterThanOrEqual(quantityBudget('reading', length).baseline); }));
});
it('counts only source English, with consistent compounds, abbreviations and duplicate paragraph handling', () => {
  expect(englishWords("I'm well-known in the U.S.A. with twenty-one tasks.")).toHaveLength(8);
  expect(readingWordCount({ blocks: [{ id: 'a', text: 'Home\n\nThe well-known author lives in the U.S.A.\n\n中文译文' }, { id: 'b', text: 'The well-known author lives in the U.S.A.' }, { id: 'v', title: 'Vocabulary', text: 'word word word' }] })).toBe(7);
});
it('counts groups by actual independent inputs, including long answers and ordinary multi-selection tasks', () => {
  const q = quantityFixture(300).lesson.materials[0].questions[0];
  const gaps = { kind: 'gap-fill', gaps: Array.from({ length: 4 }, () => ({})) } as Question;
  expect(answerPointCount([q,q,q,gaps])).toBe(7);
  expect(questionSlots({ kind: 'completion', answer: 'more than one word' } as Question)).toBe(1);
  expect(questionSlots({ kind: 'evidence', accepted: [0,1] } as Question)).toBe(1);
  const response: Question = { kind: 'response', id: 'independent', blockId: q.blockId, prompt: 'Answer both questions.', parts: ['Who arrived?', 'Where did they go?'], criteria: [english('Use evidence.'),english('Retain scope.')], explanation: english('Unscored.'), evidence: q.evidence };
  expect(questionSlots(response)).toBe(2); expect(() => validateAnswer(response, ['Maya','The station'])).not.toThrow();
  expect(() => validateAnswer(response, ['Maya',''])).toThrow(); expect(scoreParts(response, ['Maya','The station'])).toHaveLength(2);
});
it.each([150,300,500,800,1000,1500,2500])('applies one reading budget to an oversized old bank at %i words without mutating it', length => {
  const { lesson } = quantityFixture(length), original = structuredClone(lesson);
  const prepared = organizePractice(lesson);
  expect(lesson).toEqual(original);
  for (const material of prepared.materials) { expect(answerPointCount(material.questions)).toBe(material.quantity!.target); expect(answerPointCount(material.questions)).toBeLessThanOrEqual(quantityBudget('reading', length).maximum); expect(material.quantity?.actual).toBe(answerPointCount(material.questions)); }
  expect(answerPointCount(prepared.materials.flatMap(m => m.questions))).toBeLessThanOrEqual(12);
  expect(organizePractice(prepared)).toEqual(prepared);
  expect(asTestLesson(prepared).materials.map(m => m.questions.map(q => q.id))).toEqual(prepared.materials.map(m => m.questions.map(q => q.id)));
  expect(organizePractice({ ...lesson, organization: 'material-v1' }).materials.every(m => !!m.quantity)).toBe(true);
});
it.each([120,180,300,480,720,1200])('supplements listening through independent aligned sentences at %i seconds', seconds => {
  const { lesson, bank } = quantityFixture(400, seconds), prepared = organizePractice(lesson, [bank]);
  expect(answerPointCount(prepared.materials.flatMap(m => m.questions))).toBeLessThanOrEqual(20);
  for (const material of prepared.materials) {
    expect(material.quantity!.actual).toBe(material.quantity!.target); expect(material.quantity!.actual).toBeGreaterThan(2); expect(material.quantity!.actual).toBeLessThanOrEqual(quantityBudget('listening', seconds).maximum);
    expect(listeningSpacingValid(material.questions, 'B2')).toBe(true);
    const spans = material.questions.flatMap(listeningAnswerSpans); expect(spans.at(-1)!.audioEnd).toBeGreaterThan(seconds * .7);
  }
});
it('reduces repetitions and tight timelines, and labels conservative fallback times as estimates', () => {
  const { lesson, bank } = quantityFixture(400, 120);
  const approximate = organizePractice(lesson);
  expect(approximate.materials.some(m => m.quantity?.timing === 'estimated')).toBe(true);
  const tight = structuredClone(lesson); tight.targetLevel = 'A1';
  for (const record of bank.records) for (const clip of record.clips) for (const [index, segment] of clip.segments.entries()) { segment.audioStart = index; segment.audioEnd = index + .5; }
  const limited = organizePractice(tight, [bank]); expect(limited.materials.every(m => m.quantity!.actual < m.quantity!.baseline && m.quantity!.reasons.includes('timing-spacing'))).toBe(true);
  const repeated = quantityFixture(300).lesson;
  for (const m of repeated.materials) m.blocks[0].text = 'A cat sat. '.repeat(100);
  expect(organizePractice(repeated).materials.every(m => m.quantity!.actual < 4)).toBe(true);
});

it('selects a representative subset from an oversized bank and preserves complete groups', () => {
  const { lesson } = quantityFixture(1000);
  for (const material of lesson.materials) {
    const template = material.questions[0];
    const text = material.blocks[0].text;
    material.questions = Array.from(text.matchAll(/[^.]+\./g), (match, index) => ({ ...template, id: `${material.id}-bank-${index}`, evidence: { start: match.index, end: match.index + match[0].length } }));
  }
  const prepared = organizePractice(lesson, [], ['choice']);
  expect(answerPointCount(prepared.materials.flatMap(m => m.questions))).toBe(12);
  for (const m of prepared.materials) {
    expect(m.questions.every(q => lesson.materials.find(old => old.id === m.id)!.questions.some(old => old.id === q.id))).toBe(true);
    expect(m.questions.at(-1)!.evidence.start).toBeGreaterThan(m.blocks[0].text.indexOf('laboratories'));
  }
  const grouped = quantityFixture(300).lesson;
  for (const m of grouped.materials) {
    const q = m.questions[0]; m.blocks[0].text = 'This is a report. ' + 'the '.repeat(145); q.evidence = { start: 0, end: 17 };
    m.questions = [{ kind: 'response', id: q.id, blockId: q.blockId, prompt: '1. Who wrote the report?\n2. Which village was described?', criteria: [english('Use the source.'), english('Retain scope.')], explanation: english('Unscored.'), hints: q.hints, evidence: q.evidence }];
  }
  const groups = organizePractice(grouped);
  expect(groups.materials.every(m => m.questions.length === 1 && questionSlots(m.questions[0]) === 2 && m.quantity!.actual === 2)).toBe(true);
});

it('checks every timed gap, long evidence overlap, slow-level and heavy-input spacing', () => {
  const q = quantityFixture(300, 180).lesson.materials[0].questions[0];
  const timed = (start: number, end: number) => ({ ...q, evidence: { ...q.evidence, audioStart: start, audioEnd: end } });
  expect(listeningSpacingValid([timed(0, 2), timed(13, 14)], 'B2')).toBe(true);
  expect(listeningSpacingValid([timed(0, 2), timed(13, 14)], 'A2')).toBe(false);
  expect(listeningSpacingValid([timed(0, 20), timed(10, 40)], 'B2')).toBe(false);
  const gaps = { kind: 'gap-fill', id: 'timed-gaps', prompt: 'Complete.', blockId: q.blockId, evidence: { start: 0, end: 100, audioStart: 0, audioEnd: 60 }, gaps: [{ evidence: { start: 0, end: 5, audioStart: 0, audioEnd: 2 } }, { evidence: { start: 50, end: 55, audioStart: 9, audioEnd: 10 } }] } as Question;
  expect(listeningSpacingValid([gaps], 'B2')).toBe(false);
  const longPrompt = { ...timed(13, 14), prompt: 'Long options and a demanding prompt. '.repeat(12) };
  expect(listeningSpacingValid([timed(0, 2), longPrompt], 'B2')).toBe(false);
  const invalid = structuredClone(quantityFixture(300, 180).lesson); delete invalid.materials[0].audio;
  expect(() => organizePractice(invalid)).toThrow();
  for (const m of invalid.materials) { delete m.audio; m.blocks[0].text = '中文'; }
  invalid.skill = 'reading'; invalid.materials.forEach(m => m.questions.forEach(q => { q.evidence = { start: 0, end: 1 }; }));
  expect(() => organizePractice(invalid)).toThrow('NO_USABLE_CONTENT');
  const global = quantityFixture(800, 180);
  for (const material of global.lesson.materials) {
    const q = material.questions[0];
    material.questions = [{ ...q, prompt: 'What is the main point?' }, { ...q, id: `${q.id}-duplicate`, prompt: 'What is the main idea?' }];
  }
  expect(organizePractice(global.lesson, [global.bank]).materials.every(m => m.questions.filter(q => /main (point|idea)/.test(q.prompt)).length <= 1)).toBe(true);
  const partial = quantityFixture(400, 180);
  for (const record of partial.bank.records) for (const clip of record.clips) for (const segment of clip.segments) { segment.start += 4; segment.text = segment.text.slice(4); }
  expect(organizePractice(partial.lesson, [partial.bank]).materials.every(m => m.quantity!.timing === 'estimated')).toBe(true);
});
