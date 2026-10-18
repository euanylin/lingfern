import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { attributionMatchingPrompt, corpusAttribution, corpusAttributionPairs, corpusLesson, corpusSchema, corpusViewpoints, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';
import { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const corpora = ['voa', 'gutenberg'].map(name => corpusSchema.parse(JSON.parse(readFileSync(`public/corpus/${name}.json`, 'utf8'))));
const roots = ['voa-article-3574029', 'gutenberg-book-11'], ids = ['d7d3014ff0ffbd37775f2232b10d26b0b88a6e8c3adffd65cc267a42c1192776', '6f3f9909263d23c0f1fb79232b4a6ae284dbc66103f49979c6a5cacd9e6afed2'];
const records = corpora.map((corpus, i) => { const r = corpus.records.find(r => r.rootId === roots[i])!; return { ...r, passages: r.passages.filter(p => p.id === ids[i]) }; });
const bank = { version: 1 as const, failures: [], records }, texts = records.map(r => r.passages[0].text), operation = `matching:${attributionMatchingPrompt}`;
it('retains actual complete dialogue turns, unique contiguous claims, source hashes and narrative owners', () => {
  expect(records.map(r => r.passages[0].wordCount)).toEqual([197, 290]);
  expect(sha(readFileSync('content/corpus/raw/pg11.txt'))).toBe(records[1].sourceHash);
  const original = JSON.parse(readFileSync('content/corpus/voa-additional-sources.json', 'utf8')).records.find((r: { id: number }) => r.id === 3574029);
  expect(sha(original.text)).toBe(records[0].sourceHash);
  for (let i = 0; i < 2; i++) {
    expect(sha(texts[i])).toBe(ids[i]); const task = corpusAttributionPairs(texts[i], 0)!;
    expect([task.evidence, ...task.otherEvidence]).toEqual(i ? [{ start: 554, end: 811 }, { start: 813, end: 976 }] : [{ start: 594, end: 757 }, { start: 759, end: 875 }]);
    expect(task.pairs.map(p => p.answer)).toEqual(i ? ['the Pigeon', 'Alice'] : ['Phil', 'Anna']); expect(task.pairs.map(p => p.label)).toEqual(i ? [texts[i].slice(686, 810), texts[i].slice(868, 975)] : [texts[i].slice(728, 757), texts[i].slice(809, 875)]);
    for (const [index, span] of [task.evidence, ...task.otherEvidence].entries()) expect(texts[i].slice(span.start, span.end)).toContain(task.pairs[index].label);
    expect(task.choices).not.toContain(i ? 'Lewis Carroll' : 'VOA Learning English');
  }
});
it('preserves opinion denial, limited agreement and complete conditional/possessive tail with exact ownership scoring', () => {
  for (let seed = 0; seed < 12; seed++) for (const [i, text] of texts.entries()) {
    const task = corpusAttributionPairs(text, seed)!; expect(task).toEqual(corpusAttributionPairs(text, seed)); expect(new Set(task.choices).size).toBe(2); expect(new Set(task.pairs.map(p => p.label)).size).toBe(2);
    expect(task.pairs.find(p => p.answer === (i ? 'Alice' : 'Anna'))!.label).toBe(i ? 'but I’m not looking for eggs, as it happens; and if I was, I shouldn’t want _yours_: I don’t like them raw.' : "But I don't think city people are rude. I think they're just busy.");
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2', [], 'matching', [], operation)!;
    for (const material of lesson.materials) {
      const question = material.questions[0]; if (!('kind' in question) || question.kind !== 'matching') throw Error('Expected attribution matching');
      expect(score(question, question.pairs.map(p => p.answer)).correct).toBe(true); expect(score(question, question.pairs.map(p => p.answer).reverse()).correct).toBe(false);
      const response = material.questions[1]; if (!('kind' in response) || response.kind !== 'response') throw Error('Expected unscored comparison'); expect(score(response, 'I compare both complete statements without turning their claims into established facts.').correct).toBeNull(); expect(response.prompt).toContain('If the passage supports no contrast, say so.');
      expect(response.explanation.en).toContain('do not establish'); expect(response.explanation.en).not.toMatch(/logically contradict|proves the allegation|never eats eggs/);
      expect(question.hints![1].en).toContain('dialogue label'); const example = corpusWorkedExample(material, seed); if (example) for (const pair of question.pairs) expect(example.en).not.toContain(pair.label);
    }
    const viewpoint = corpusViewpoints(text, seed)!; expect(new Set(viewpoint.names)).toEqual(new Set(task.choices));
  }
  // Extending matching must not turn multi-sentence dialogue into a sentence-attribution evidence task.
  for (const text of texts) expect(corpusAttribution(text, 0)).toBeUndefined();
});
it('withholds changed negation, incomplete tail, wrong owners, repeated claims and imagined/nested source scopes', () => {
  const invalid = [texts[0].replace("I don't think city", 'I think city'), texts[0].replace("I think they're just busy.", ''), texts[0].replace('Anna: Well, I agree.', 'Phil: Well, I agree.'), texts[0].replace('People in the country are friendly.', 'People in the city are friendly.'), texts[1].replace('I’m not looking for eggs', 'I’m looking for eggs'), texts[1].replace('and if I was, I shouldn’t want _yours_: I don’t like them raw.', ''), texts[1].replace('said Alice hastily', 'said Someone hastily'), texts[1].replaceAll('Pigeon', 'Alice')];
  for (const text of texts) { const task = corpusAttributionPairs(text, 0)!; invalid.push('“' + text + '”', text + '\n\n' + text, 'I imagined the following conversation.\n\n' + text, text + '\n\nRobin: ' + task.pairs[0].label, text.slice(0, task.otherEvidence[0].end - 1)); }
  for (const text of invalid) expect(corpusAttributionPairs(text, 0), text).toBeUndefined();
  const controls = ['c3d7065b388f94c08645e2d2d718aea8b90924db693288636fda6943c032ed92', '465a0d573fe15013191e746639ed2eb014fdb91b6e8035253c9af33b21b6dcc2', 'bf17b43f38544daee2ecbb05cd5c7bd3d1aa990f26b2c6feac8252d7d7db6032'];
  for (const id of controls) { const part = corpora.flatMap(c => c.records.flatMap(r => r.passages)).find(p => p.id === id)!; expect(sha(part.text)).toBe(id); expect(corpusAttributionPairs(part.text, 0)).toBeUndefined(); }
});
it('derives runtime voices and source spans over arbitrary deterministic seeds', () => {
  const changed = [texts[0].replaceAll('Phil', 'Robin').replaceAll('Anna', 'Mira'), texts[1].replaceAll('Pigeon', 'Dove').replaceAll('Alice', 'Mira')];
  fc.assert(fc.property(fc.constantFrom(...texts, ...changed), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusAttributionPairs(text, seed)!; expect(task).toEqual(corpusAttributionPairs(text, seed));
    for (const [i, span] of [task.evidence, ...task.otherEvidence].entries()) expect(text.slice(span.start, span.end)).toContain(task.pairs[i].label);
    expect(new Set(task.choices).size).toBe(2); expect(task.pairs.every(p => p.label.length <= 240 && text.includes(p.label))).toBe(true);
  }), { numRuns: 100 });
  expect(corpusAttributionPairs(changed[0], 0)!.choices).toEqual(['Robin', 'Mira']); expect(corpusAttributionPairs(changed[1], 0)!.choices).toEqual(['the Dove', 'Mira']);
});
it('uses existing default slots for genuine B2/C1/C2 transfer with identical Test questions and bounded level availability', () => {
  for (const point of ['B2', 'C1', 'C2'] as const) for (const seed of [2, 3, 38, 39]) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, point)!; lessonSchema.parse(lesson);
    expect(lesson.materials.map(m => corpusOperation(m.questions[0]))).toEqual([operation, operation]); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.teaching!.en).toContain('named source'); const test = asTestLesson(lesson); expect(test.workedExample).toBeUndefined(); expect(test.materials.map(m => m.blocks)).toEqual(lesson.materials.map(m => m.blocks));
    for (const [i, { question }] of questions(lesson).entries()) { const tested = [...questions(test)][i].question; expect(tested.hints).toBeUndefined(); if ('kind' in question && question.kind === 'matching') expect(score(tested, question.pairs.map(p => p.answer))).toEqual(score(question, question.pairs.map(p => p.answer))); else expect(score(tested, 'A comparison with quotations.').correct).toBeNull(); }
  }
  for (const point of ['A1', 'A2'] as const) expect(corpusLesson(bank, new Set(), 0, 300, point, [], 'matching', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(), 0, 220, 'B1', [], 'matching', [], operation)).toBeUndefined(); expect(corpusLesson(bank, new Set(), 0, 300, 'B1', [], 'matching', [], operation)?.materials).toHaveLength(2);
  expect(corpusLesson(bank, new Set(ids), 2, 300, 'B2')).toBeUndefined();
});
it('withholds explicit matching without a partner and uses common completion for ordinary practice', () => {
  const original = corpora[1].records.find(r => r.rootId === roots[1])!, unrelated = original.passages.find(p => p.id === '74375eb5b38cf800400db4d1475e11e3d90cb29662bb2c1ed39d8073431393e2')!;
  const missing = { ...bank, records: [records[0], { ...original, passages: [unrelated] }] };
  expect(corpusAttributionPairs(unrelated.text, 0)).toBeUndefined();
  expect(corpusLesson(missing, new Set(), 0, 300, 'B2', [], 'matching', [], operation)).toBeUndefined();
  for (const seed of [2, 3]) { const lesson = corpusLesson(missing, new Set(), seed, 300, 'B2')!; expect(lesson.materials.map(m => corpusOperation(m.questions[0]))).toEqual(['completion', 'completion']); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2); }
});
it('saves actual dialogue Practice/Test and recovery snapshots without replacing earlier saved source claims', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const earlierLesson = corpusLesson(bank, new Set(), 0, 300, 'B2', [], 'completion')!, earlier = await createSession(earlierLesson, 'existing-dialogue-reading'), frozen = await sessions.get(earlier.id);
    const practice = corpusLesson(bank, new Set(), 2, 300, 'B2')!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profile = `dialogue-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profile); await claimSession(session.id, 'dialogue-owner');
      for (const [i, { question }] of questions(lesson).entries()) { await markExposure((await sessions.get(session.id))!); const answer = 'kind' in question && question.kind === 'matching' ? question.pairs.map(p => p.answer) : 'I retain each voice, denial, limits and conditional alternative.'; const saved = await submit(session.id, 'dialogue-owner', answer); expect(await attempts.get(saved.id)).toEqual(saved); expect((await sessions.get(session.id))!.position).toBe(i); await advance(session.id, 'dialogue-owner'); }
      expect((await sessions.get(session.id))!.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profile)); expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(4);
    }
    expect(await sessions.get(earlier.id)).toEqual(frozen); expect((await inspectBackup(await exportBackup('existing-dialogue-reading'))).records.sessions[0].lesson).toEqual(earlierLesson);
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
