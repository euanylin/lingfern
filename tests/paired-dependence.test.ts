import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { corpusLesson, corpusRoleActions, corpusSchema, corpusStartingPoint, corpusWorkedExample } from '../src/core/corpus';
import type { Attempt, Session } from '../src/data/db';
import { corpusPracticeHistory, corpusOperation, pairedRelianceOperation, pairedReliancePrompt } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { inspectCommunityPack } from '../src/data/communityPack';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const parallel = 'The land-based ecosystem depends upon topsoil and fresh water, and the oceanic ecosystem depends on dissolved nutrients washed down from the land.';
const reciprocal = 'As designed, the Defuser cannot look at the manual and must rely on the Experts to instruct them; similarly, the Experts cannot see the bomb, and must rely on the Defuser to describe the bomb to them.';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
async function actual() {
  const records = [];
  for (const [packId, root, id, words, sentence, start, end, textHash] of [
    ['008', 'wikipedia-article-9228', '3aa87fe6472ecddd65ad7e1f19ae44535fad3c6171604282ced63550231b3c9e', 247, parallel, 961, 1107, '3ca26b581aa826199f84a7c42f043d039b4760ad0c3597466e442795c9ace4bd'],
    ['017', 'wikipedia-article-46203885', 'd1460f5ff5f38bfcf5938487bc71d77a77b22cdf05fd3a9e7b1446b233eb817a', 274, reciprocal, 330, 530, '43fd589b2abf535be4e14007a0eda51221371fd69b5b7ce057f3567c92b3a949'],
  ] as const) {
    const pack = await inspectCommunityPack(readSourcePackFixture(`wikipedia-reading-${packId}`));
    const source = (await reviewedReading(pack.corpus!.records, 1800)).find(record => record.rootId === root)!;
    const passage = source.passages.find(passage => passage.id === id)!;
    expect(digest(passage.text)).toBe(textHash); expect(passage.wordCount).toBe(words);
    expect(passage.text.slice(start, end)).toBe(sentence);
    records.push({ ...source, passages: [passage] });
  }
  return corpusSchema.parse({ version: 1, failures: [], records });
}

it('matches actual parallel dependence and reciprocal reliance across two roots with exact evidence for seven seeds', async () => {
  const corpus = await actual();
  for (let seed = 0; seed < 7; seed++) {
    for (const source of corpus.records) {
      const text = source.passages[0].text, task = corpusRoleActions(text, seed)!;
      expect(text.slice(task.evidence.start, task.evidence.end)).toBe(task.sentence);
      if (task.sentence === parallel) expect(new Map(task.pairs.map(pair => [pair.answer, pair.label]))).toEqual(new Map([
        ['land-based ecosystem', 'topsoil and fresh water'], ['oceanic ecosystem', 'dissolved nutrients washed down from the land'],
      ]));
      else expect(task.sentence).toBe(reciprocal);
    }
    const lesson = corpusLesson(corpus, new Set(), seed, 700, 'B2', [], 'matching', [], pairedRelianceOperation)!;
    lessonSchema.parse(lesson); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.teaching!.en).toContain('Do not infer reciprocal dependence');
    for (const material of lesson.materials) {
      const question = material.questions[0], response = material.questions[1];
      if (!('kind' in question) || question.kind !== 'matching' || !('kind' in response) || response.kind !== 'response') throw new Error('Expected paired matching and response');
      expect(question.prompt).toBe(pairedReliancePrompt); expect(corpusOperation(question)).toBe(pairedRelianceOperation);
      expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end)).toBe(corpusRoleActions(material.blocks[0].text, seed)!.sentence);
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, [...question.pairs.map(pair => pair.answer)].reverse()).correct).toBe(false);
      expect(response.evidence).toEqual(question.evidence); expect(score(response, 'I preserve both stated dependencies.').correct).toBeNull();
      expect(response.prompt).toContain('do not infer reciprocal');
      expect(question.hints!.map(hint => hint.en).join(' ')).not.toMatch(/similarly|must|duty/);
    }
    const tested = asTestLesson(lesson);
    expect(tested.materials.map(material => material.questions.map(question => ({ id: question.id, evidence: question.evidence })))).toEqual(lesson.materials.map(material => material.questions.map(question => ({ id: question.id, evidence: question.evidence }))));
    expect(tested.materials.every(material => material.questions.every(question => !question.hints))).toBe(true);
    for (const [index, material] of tested.materials.entries()) {
      const original = lesson.materials[index].questions[0], current = material.questions[0];
      if (!('kind' in original) || original.kind !== 'matching' || !('kind' in current) || current.kind !== 'matching') throw new Error('Expected matching');
      expect(current.pairs).toEqual(original.pairs); expect(current.choices).toEqual(original.choices);
    }
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();

  }
});

it('accepts explicit nominal pairs without article IDs and rejects ambiguous or modified clauses', () => {
  expect(corpusRoleActions('The coastal community depends on fishing and farming, and the mountain community depends upon timber and grazing.', 0)?.pairs).toHaveLength(2);
  for (const text of [
    `“${parallel}”`, `A witness said ${parallel}`, `If ${parallel}`, parallel + ' ' + parallel,
    `A witness said, "First consider the system. ${parallel} That was my claim."`,
    `A witness said, 'First consider the system. ${parallel} That was my claim.'`,
    `A witness said, ‘First consider the system. ${parallel} That was my claim.’`,
    parallel.replace('oceanic ecosystem', 'land-based ecosystem'), parallel.replace('oceanic ecosystem', 'it'),
    parallel.replace('depends upon', 'may depend upon'), parallel.replace('topsoil and fresh water', 'whether rain falls'),
    parallel.replace('topsoil and fresh water', 'water which falls'), parallel.replace('topsoil and fresh water', 'rain arrives'), parallel.replace('topsoil and fresh water', 'farmers produce crops'),
    parallel.replace('land-based ecosystem', 'final outcome'), parallel.replace('land-based ecosystem', 'final result'),
    parallel.replace('land-based ecosystem', 'business success'), parallel.replace('oceanic ecosystem', 'final decision'),
    parallel.replace('topsoil and fresh water', 'not topsoil'), parallel.replace('depends upon', 'does not depend upon'),
    parallel.replace('oceanic ecosystem depends on dissolved nutrients washed down from the land', 'oceanic ecosystem depends on topsoil and fresh water'),
    parallel.replace('oceanic ecosystem depends on dissolved nutrients washed down from the land', 'oceanic ecosystem depends on fresh water and topsoil'),
    parallel.replace('oceanic ecosystem', 'same ecosystem'),
    parallel.replace('oceanic ecosystem', 'oceanic ecosystem that fails'), parallel.replace(', and the', '; the'),
    parallel.replace('fresh water', 'fresh water unless it rains'), parallel.replace('land.', 'land?'),
  ]) expect(corpusRoleActions(text, 0), text).toBeUndefined();
  for (const seed of [-1, NaN, .5, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusRoleActions(parallel, seed)).toThrow('INVALID_CORPUS_ROLES');
  expect(() => corpusRoleActions('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_ROLES');
});

it('keeps ordinary mixed application available without counting it as same-operation transfer', async () => {
  const corpus = await actual();
  const pack = await inspectCommunityPack(readSourcePackFixture('wikipedia-reading-008'));
  const available = (await reviewedReading(pack.corpus!.records)).filter(record => !corpus.records.some(source => source.rootId === record.rootId)
    && record.passages.some(passage => !corpusRoleActions(passage.text, 0)));
  expect(available.length).toBeGreaterThanOrEqual(2);
  const history: Session[] = [], records: Attempt[] = [];
  for (const [index, source] of corpus.records.entries()) {
    const lesson = corpusLesson({ ...corpus, records: [source] }, new Set(), 0, 700, 'B2', [], 'matching', [], pairedRelianceOperation, { ...corpus, records: [available[index]] })!;
    expect(lesson).toBeDefined(); lessonSchema.parse(lesson);
    expect(corpusOperation(lesson.materials[0].questions[0])).toBe(pairedRelianceOperation);
    expect(corpusOperation(lesson.materials[1].questions[0])).not.toBe(pairedRelianceOperation);
    const session: Session = { id: `mixed-reliance-${index}`, profileId: 'isolated-policy', lesson, contentHash: 'a'.repeat(64), position: 3,
      status: 'completed', startedAt: new Date(Date.now() - 100000 + index * 1000).toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 };
    history.push(session);
    for (const material of lesson.materials) for (const question of material.questions) if (!('kind' in question) || question.kind !== 'response') records.push({
      id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, questionId: question.id, rootId: material.rootId,
      answer: '', correct: true, rule: 'isolated-policy', assistance: { hintLevel: 0 }, submittedAt: new Date(Date.now() - 50000 + index * 1000).toISOString(),
    });
  }
  expect(new Set(history.flatMap(session => session.lesson.materials.map(material => material.rootId))).size).toBe(4);
  const result = corpusPracticeHistory(history, records, 'isolated-policy', 'reading', 'all', 'B2');
  expect(result.needsSupport).toBe(false); expect(result.independent).toBe(false); expect(result.maxWords).toBe(300);
});


it('demonstrates the direction of each reliance without leaking answers or changing scored source pairs', async () => {
  const corpus = await actual();
  let fallbacks = 0;
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 300, point, [], 'matching', [], pairedRelianceOperation)!;
    expect(lesson).toBeDefined();
    const example = corpusWorkedExample(lesson.materials[0], seed, point);
    if (example) expect(lesson.workedExample).toEqual(example);
    else {
      fallbacks++;
      expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      expect(lesson.workedExample!.en).toContain('electric power: the desk lamp; water pressure: the garden hose');
      expect(lesson.workedExample!.en).toContain('Do not reverse the direction or infer reciprocal dependence');
      expect(lesson.workedExample!.en).toContain('Dependence does not guarantee operation');
    }
    for (const material of lesson.materials) {
      const question = material.questions[0]; if (!('kind' in question) || question.kind !== 'matching') throw Error('Expected reliance matching');
      expect(corpusOperation(question)).toBe(pairedRelianceOperation);
      for (const pair of question.pairs) expect(lesson.workedExample!.en).not.toContain(pair.label);
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
      expect(score(material.questions[1], 'I keep each stated dependence with its subject.').correct).toBeNull();
    }
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const original = structuredClone(lesson); expect(corpusStartingPoint(lesson, point).materials).toEqual(original.materials); expect(lesson).toEqual(original);
    expect(lesson.workedExample!['zh-Hans']).toBe(lesson.workedExample!.en); expect(lesson.workedExample!['zh-Hant']).toBe(lesson.workedExample!.en);
    const test = asTestLesson(lesson); expect(test.workedExample).toBeUndefined(); expect(test.teaching).toBeUndefined(); expect(test.nextStep).toBeUndefined();
  }
  expect(fallbacks).toBeGreaterThan(0);
  // Keep regression wording outside distributed sources and scored items.
  const fixture = corpusLesson(corpus, new Set(), 0, 300, 'B2', [], 'matching', [], pairedRelianceOperation)!;
  const other = 'The harbour community depends on fishing and farming, and the forest community depends on timber and grazing.';
  fixture.materials[0].blocks[0].text += '\n\n' + other;
  const example = corpusWorkedExample(fixture.materials[0], 0, 'B2');
  expect(example).toBeDefined(); expect(example!.en).toContain(other);
  expect(corpusStartingPoint(fixture, 'B2').workedExample).toEqual(example);
});
