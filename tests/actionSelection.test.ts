import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusActionSelection, corpusLesson } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { questions, score } from '../src/shared/content';
import { exposureSchema } from '../src/shared/exposure';
import type { Attempt, Session } from '../src/data/db';

const conditional = 'If Maya loses all lives, the player must resume from checkpoint A and repeat the last section.';
const routine = 'The player must complete both objectives and then exit the stage.';
it('selects the complete source response under the full stated condition with bounded deterministic variation', () => {
  const text = conditional + ' ' + routine;
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const task = corpusActionSelection(text, seed)!;
    expect(task).toEqual(corpusActionSelection(text, seed));
    expect(task.options).toHaveLength(2);
    expect(new Set(task.options).size).toBe(2);
    expect(task.options[task.answer]).toBe('resume from checkpoint A and repeat the last section');
    expect(task.options[1 - task.answer]).toBe('complete both objectives and then exit the stage');
    expect(task.prompt).toBe('What must the player do if Maya loses all lives?');
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(conditional);
    expect(text.slice(task.otherEvidence.start, task.otherEvidence.end)).toBe(routine);
    expect(task.explanations[1 - task.answer]).toContain(conditional);
    expect(task.explanations[1 - task.answer]).toContain(routine);
  }), { numRuns: 64 });
  for (const seed of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusActionSelection(text, seed)).toThrow('INVALID_CORPUS_ACTION');
  expect(() => corpusActionSelection('x'.repeat(12001), 0)).toThrow();
});
it('withholds incomplete, competing, inferred and restricted source rules rather than inventing alternatives', () => {
  expect(corpusActionSelection(conditional, 0)).toBeUndefined();
  expect(corpusActionSelection(conditional + ' The player must restart from the last checkpoint.', 0)).toBeUndefined();
  for (const sentence of [
    'Only if Maya loses all lives, the player must resume from checkpoint A.',
    'If Maya loses all lives, the player must have misunderstood the rules.',
    'If Maya loses all lives, the player must resume from checkpoint A unless a bonus is available.',
    'If Maya loses all lives, the player must resume from checkpoint A; otherwise play continues.',
    'If Maya loses all lives, the player must resume from checkpoint A [citation needed].',
    'If Maya loses all lives, the player must resume from "checkpoint A.',
  ]) expect(corpusActionSelection(sentence + ' ' + routine, 0)).toBeUndefined();
});
it('generates and routes actual source actions on two distinct roots without scoring explanations or exposing sources twice', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const banks = await Promise.all(['018', '021'].map(async suffix => {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id); expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const bank = (await inspectCommunityPack(bytes)).corpus!;
    return { ...bank, records: await reviewedReading(bank.records) };
  }));
  const all = { version: 1 as const, failures: [], records: banks.flatMap(bank => bank.records) };
  const candidates = all.records.flatMap(source => source.passages.filter(passage => !!corpusActionSelection(passage.text, 0)).map(passage => ({ source, passage })));
  expect(candidates.map(row => row.source.title).sort()).toEqual(['Mario Party (video game)', 'Perfect Dark']);
  const scoped = { ...all, records: candidates.map(({ source, passage }) => ({ ...source, passages: [passage] })) };
  for (const level of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 6; seed++) {
    const lesson = corpusLesson(scoped, new Set(), seed, 300, level, [], 'choice', [], 'choice:conditional-action')!;
    expect(lesson.generation?.generator).toBe('corpus-v1');
    if (lesson.generation?.generator !== 'corpus-v1') throw Error('Expected corpus generation');
    expect(lesson.generation.focus).toBe('choice');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal.en).toBe(lesson.goal['zh-Hans']); expect(lesson.teaching!.en).toBe(lesson.teaching!['zh-Hant']);
    expect(lesson.workedExample!.en).toContain('warning');
    for (const material of lesson.materials) {
      const question = material.questions[0], response = material.questions[1];
      expect(corpusOperation(question)).toBe('choice:conditional-action');
      if ('kind' in question) throw Error('Expected ordinary choice question');
      expect(score(question, question.answer).correct).toBe(true); expect(score(question, 1 - question.answer).correct).toBe(false);
      const text = material.blocks[0].text;
      expect(text.slice(question.evidence.start, question.evidence.end)).toContain('If ');
      expect(question.additionalEvidence).toHaveLength(1);
      for (const option of question.options) { expect(text).toContain(option); expect(lesson.workedExample!.en).not.toContain(option); }
      expect(score(response, 'A comparison retaining both rules and the conditional response.').correct).toBeNull();
      expect(response.prompt).toContain('both relevant rules');
      const time = '2026-10-03T00:00:00.000Z';
      expect(exposureSchema.safeParse({ profileId: 'test', rootId: material.rootId, firstSeenAt: time, lastSeenAt: time, contacts: [{ sessionId: 'test', materialId: material.id, questionId: question.id, variantGroup: question.id, firstSeenAt: time, lastSeenAt: time }] }).success).toBe(true);
    }
    const seen = new Set(lesson.materials.map(material => material.id.slice('corpus-'.length)));
    expect(corpusLesson(scoped, seen, seed, 300, level, [], 'choice')).toBeUndefined();
  }
  for (const point of ['A1', 'A2'] as const) expect(corpusLesson(scoped, new Set(), 0, 700, point, [], 'choice')).toBeUndefined();
  expect(corpusLesson(scoped, new Set(), 0, 220, 'B1', [], 'choice')).toBeUndefined();
  const automatic = Array.from({ length: 32 }, (_, seed) => corpusLesson(scoped, new Set(), seed, 300, 'B2')!).filter(lesson => corpusOperation(lesson.materials[0].questions[0]) === 'choice:conditional-action');
  expect(automatic.length).toBeGreaterThan(0);
  for (const lesson of automatic) expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === 'choice:conditional-action')).toBe(true);

  const lesson = corpusLesson(scoped, new Set(), 0, 300, 'B2', [], 'choice')!;
  const session: Session = { id: 'action-policy', profileId: 'test', lesson, contentHash: 'a'.repeat(64), position: 4, status: 'completed', startedAt: '2026-10-03T00:00:00.000Z', assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const attempts: Attempt[] = questions(lesson).map(({ material, question }, index) => ({ id: `action-${index}`, profileId: 'test', sessionId: session.id, questionId: question.id, rootId: material.rootId,
    answer: 'kind' in question ? 'A saved explanation' : 1 - question.answer, correct: 'kind' in question ? null : false, rule: 'test-policy', assistance: { hintLevel: 0 }, submittedAt: '2026-10-03T00:01:00.000Z' }));
  const history = corpusPracticeHistory([session], attempts, 'test', 'reading', 'all', 'B2');
  expect(history.focus).toMatchObject({ kind: 'choice', operation: 'choice:conditional-action', reason: 'reteach' });
  expect(history.independent).toBe(false);
  // Unclassified old choices cannot acquire this semantic operation through their option shape alone.
  expect(corpusOperation({ ...lesson.materials[0].questions[0], prompt: 'An unrelated choice' })).toBeUndefined();
});

it('retains distinct preparatory and later-stage contexts without unresolved references or competing actions', () => {
  const before = 'Before each match, Team Captains must choose the team and assign all roles.';
  const battle = 'Once teams are determined, the battle begins. The player must dodge incoming attacks and protect all teammates.';
  const third = 'To escape for a third time, the player must collect all parts and repair the machine.';
  const previous = 'The player is then invited back into the house for more puzzles. From there, the player must find every ingredient and make the soup.';
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    for (const text of [before + '\n\n' + battle, before.replace('Team Captains', 'the player') + '\n\n' + battle, previous + ' ' + third]) {
      const task = corpusActionSelection(text, seed)!;
      expect(task).toEqual(corpusActionSelection(text, seed));
      expect(task.options).toHaveLength(2); expect(text).toContain(task.options[task.answer]);
      expect(text.slice(task.otherEvidence.start, task.otherEvidence.end)).toBe(task.otherSentence);
      expect(task.otherSentence).toContain(text.startsWith('Before') ? 'the battle begins' : 'invited back');
      expect(task.prompt).toContain(text.startsWith('Before') ? 'before each match' : 'for a third time');
    }
  }), { numRuns: 64 });
  expect(corpusActionSelection(before + ' The player must dodge incoming attacks.', 0)).toBeUndefined();
  expect(corpusActionSelection(third + ' From there, the player must find every ingredient.', 0)).toBeUndefined();
  expect(corpusActionSelection(before + '\n\n' + battle + ' The player must heal all teammates.', 0)).toBeUndefined();
  expect(corpusActionSelection(before.replace('roles.', 'roles unless a substitute is available.') + '\n\n' + battle, 0)).toBeUndefined();
});

it('generates stage choices from two actual sources with full action bundles and contextual unscored application', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const records = (await Promise.all(['008', '009'].map(async suffix => {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id); expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const bank = (await inspectCommunityPack(bytes)).corpus!;
    return reviewedReading(bank.records);
  }))).flat();
  const targets = records.flatMap(source => source.passages.filter(p => corpusActionSelection(p.text, 0)?.prompt.startsWith('Which action is required ')).map(p => ({ ...source, passages: [p] })));
  expect(targets.map(source => source.title).sort()).toEqual(['Gotcha Force', 'I Spy Spooky Mansion']);
  const bank = { version: 1 as const, failures: [], records: targets };
  for (const seed of [0, 1, 2, 3, 4, 5]) for (const level of ['B1', 'B2', 'C1', 'C2'] as const) {
    const lesson = corpusLesson(bank, new Set(), seed, 500, level, [], 'choice', [], 'choice:conditional-action')!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.teaching!.en).toContain('condition or stage');
    for (const material of lesson.materials) {
      const question = material.questions[0], response = material.questions[1];
      if ('kind' in question || !('kind' in response) || response.kind !== 'response') throw Error('Expected choice and response');
      expect(corpusOperation(question)).toBe('choice:conditional-action');
      expect(score(question, question.answer).correct).toBe(true); expect(score(question, 1 - question.answer).correct).toBe(false);
      expect(question.additionalEvidence).toHaveLength(1);
      expect(response.prompt).toContain('both relevant rules'); expect(response.prompt).not.toContain('play resumes');
      expect(score(response, 'Both complete source contexts and action bundles.').correct).toBeNull();
      for (const option of question.options) expect(material.blocks[0].text).toContain(option);
      for (const explanation of question.explanations ?? []) expect(explanation.en).toContain(material.blocks[0].text.slice(question.evidence.start, question.evidence.end));
    }
    const seen = new Set(lesson.materials.map(material => material.id.slice('corpus-'.length)));
    expect(corpusLesson(bank, seen, seed, 500, level, [], 'choice')).toBeUndefined();
  }
  for (const point of ['A1', 'A2'] as const) expect(corpusLesson(bank, new Set(), 0, 700, point, [], 'choice')).toBeUndefined();
  expect(corpusLesson(bank, new Set(), 0, 220, 'B1', [], 'choice')).toBeUndefined();
});
