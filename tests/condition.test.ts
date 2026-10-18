import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusCondition, conditionPrompt, corpusLesson, corpusSchema, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { score } from '../src/shared/content';
import { exposureSchema } from '../src/shared/exposure';
const rule = 'Visitors may enter only if they have a ticket and the room is open.';
const neutral = 'The building has a central hall. The entrance faces the garden.';
it('preserves full combined prerequisites without generating a sufficient-permission score', () => {
  const text = rule + ' ' + neutral;
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const task = corpusCondition(text, seed)!;
    expect(task).toEqual(corpusCondition(text, seed));
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(rule);
    expect(task.spans[task.accepted[0]].text).toBe(rule);
    expect(task.explanation).toContain('does not guarantee');
    for (const span of task.spans) expect(text.slice(span.start, span.end)).toBe(span.text);
  }), { numRuns: 64 });
  for (const seed of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusCondition(text, seed)).toThrow('INVALID_CORPUS_CONDITION');
  expect(() => corpusCondition('x'.repeat(12001), 0)).toThrow();
});
it('withholds chronology, biconditionals, unresolved references and competing procedural requirements', () => {
  for (const target of [
    'It was only when the team arrived that the room opened.',
    'The team arrived at six; only when they reached the hall did the room open.',
    'The console works if and only if the code is present.',
    'These tasks receive payment only if they meet the deadline.',
    'Visitors, who normally enter only when the hall is open, stayed outside.',
    'The rule [citation needed] applies only if the hall is open.',
    'Dana said "The hall opens only if the team arrives.',
  ]) expect(corpusCondition(target + ' ' + neutral, 0)).toBeUndefined();
  const other = 'Visitors can proceed by presenting their identification card.';
  const text = rule + ' ' + other + ' ' + neutral;
  expect(corpusCondition(text, 0)!.spans.some(span => span.text === other)).toBe(false);
  expect(corpusCondition(rule + ' ' + other + ' The entrance faces the garden.', 0)).toBeUndefined();
  expect(corpusCondition(rule + ' A host named Mr. Green opens the door. ' + neutral, 0)!.spans.some(span => /Mr\.$|^Green/.test(span.text))).toBe(false);
});
it('withholds the actual quoted Only if conversational metaphor instead of treating it as a prerequisite', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const source = corpus.records.find(source => source.rootId === 'gutenberg-book-514')!;
  const sourceHash = '36831477b339dbcd7e7206119d77e9e58b9727ef3c299d1a1dc4446e1db97850';
  expect(source.sourceHash).toBe(sourceHash);
  expect(createHash('sha256').update(readFileSync('content/corpus/raw/pg514.txt')).digest('hex')).toBe(sourceHash);
  const passage = source.passages.find(passage => passage.id === '46377ef0589173a02c9b955f32061729c7433270636237f2133003a2c485e6ff')!;
  expect(createHash('sha256').update(passage.text).digest('hex')).toBe(passage.id);
  const statement = '“Only if Brooke is going to be a thermometer, I must mind and have fair weather for him to report.”';
  expect(passage.text.slice(132, 231)).toBe(statement);
  for (let seed = 0; seed < 6; seed++) expect(corpusCondition(passage.text, seed)).toBeUndefined();
  for (const [opening, closing] of [['“', '”'], ['"', '"'], ['‘', '’'], ["'", "'"]]) {
    expect(corpusCondition(`${opening}Only if a ticket is presented, the visitor enters.${closing} ${neutral}`, 0)).toBeUndefined();
  }
  const unquoted = 'Only if a ticket is presented, the visitor enters.';
  expect(corpusCondition(unquoted + ' ' + neutral, 0)!.spans[0].text).toBe(unquoted);
});
it('withholds the actual source-initial And only when he clause whose context was cut away', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const source = corpus.records.find(source => source.rootId === 'gutenberg-book-1998')!;
  const sourceHash = '0854ebabe235d46c8e5e099418c5189b1df0848898c552009b70d924b9065d05';
  expect(source.sourceHash).toBe(sourceHash);
  expect(createHash('sha256').update(readFileSync('content/corpus/raw/pg1998.txt')).digest('hex')).toBe(sourceHash);
  const passage = source.passages.find(passage => passage.id === '2a912962ded0664148809bcc15a0f46c8f449d42a98f3586f335c3edfb001619')!;
  expect(createHash('sha256').update(passage.text).digest('hex')).toBe(passage.id);
  expect(passage.text.slice(0, 86)).toBe('And only when he turneth away from himself will he o’erleap his own shadow—and verily!');
  for (let seed = 0; seed < 6; seed++) expect(corpusCondition(passage.text, seed)).toBeUndefined();
  for (const prefix of ['', 'And ']) for (const clause of ['he has a ticket', 'she has a ticket', 'his ticket is checked', 'her ticket is checked', 'their ticket is checked', 'its ticket is checked']) {
    const statement = `${prefix}Only when ${clause}, the tour starts.`;
    expect(corpusCondition(statement + ' ' + neutral, 0), statement).toBeUndefined();
  }
  const complete = source.passages.find(passage => passage.id === 'f3df1476a2111852284bf041dde5365099c22b1b5d305eb17caef3df9ffe9c85')!;
  expect(createHash('sha256').update(complete.text).digest('hex')).toBe(complete.id);
  expect(complete.text).toContain('I cook every chance in MY pot.');
  const explicit = corpusCondition(complete.text, 0)!;
  expect(explicit.evidence).toEqual({ start: 1227, end: 1294 });
  expect(explicit.spans[explicit.accepted[0]].text).toBe('And only when it hath been quite cooked do I welcome it as MY food.');
  const background = 'Mira has registered for the tour.';
  const statement = 'Only when she presents her ticket, the tour starts.';
  const task = corpusCondition(background + ' ' + statement + ' ' + neutral, 0)!;
  expect(task.spans[task.accepted[0]].text).toBe(statement);
  expect(task.evidence).toEqual({ start: background.length + 1, end: background.length + 1 + statement.length });
});
it('uses actual source packages for the same condition operation on unfamiliar roots at B1–C2', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const banks = await Promise.all(['003', '004', '010', '011', '017', '020', '026', '027', '028'].map(async suffix => {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const bank = (await inspectCommunityPack(bytes)).corpus!;
    return { ...bank, records: await reviewedReading(bank.records) };
  }));
  const all = { version: 1 as const, failures: [], records: banks.flatMap(bank => bank.records) };
  const candidates = all.records.flatMap(source => source.passages.filter(passage => !!corpusCondition(passage.text, 0)).map(passage => ({ source, passage })));
  expect(candidates).toHaveLength(13); expect(new Set(candidates.map(item => item.source.rootId)).size).toBe(12);
  const full = { ...all, records: candidates.map(item => ({ ...item.source, passages: [item.passage] })) };
  const operation = `evidence:${conditionPrompt}`;
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 6; seed++) {
    const lesson = corpusLesson(full, new Set(), seed, point === 'B1' ? 220 : 700, point, [], 'evidence', [], operation)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal.en).toBe(lesson.goal['zh-Hans']);
    expect(lesson.workedExample!.en).toContain('ticket');
    for (const material of lesson.materials) {
      const question = material.questions[0]; expect(corpusOperation(question)).toBe(operation);
      if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected condition evidence');
      expect(score(question, question.accepted[0]).correct).toBe(true);
      expect(score(question, (question.accepted[0] + 1) % 3).correct).toBe(false);
      expect(question.explanation.en).toBe(question.explanation['zh-Hant']);
      const text = material.blocks[0].text;
      for (const span of question.spans) expect(text.slice(span.start, span.end)).toBe(span.text);
      const example = corpusWorkedExample(material, seed);
      if (example) for (const span of question.spans) expect(example.en).not.toContain(span.text);
      const response = material.questions[1]; expect(response.prompt).toContain('guarantee');
      expect(score(response, 'The prerequisite does not remove the other stated restriction.').correct).toBeNull();
      const time = '2026-10-03T00:00:00.000Z';
      expect(exposureSchema.safeParse({ profileId: 'test', rootId: material.rootId, firstSeenAt: time, lastSeenAt: time, contacts: [{ sessionId: 'test', materialId: material.id, questionId: question.id, variantGroup: question.id, firstSeenAt: time, lastSeenAt: time }] }).success).toBe(true);
    }
  }
  const narrow = { ...full, records: candidates.filter(item => item.passage.wordCount <= 220).map(item => ({ ...item.source, passages: [item.passage] })) };
  expect(narrow.records).toHaveLength(2);
  for (const seed of [6, 7]) expect(corpusLesson(narrow, new Set(), seed, 220, 'B1')!.materials.every(material => material.questions[0].prompt === conditionPrompt)).toBe(true);
  for (const point of ['A1', 'A2'] as const) expect(corpusLesson(full, new Set(), 0, 700, point, [], 'evidence', [], operation)).toBeUndefined();
}, 20000);


it('retains actual recipient and program eligibility restrictions with relative clauses and historical context', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const roots = ['wikipedia-article-376221', 'wikipedia-article-14298059'];
  const records = [];
  for (const suffix of ['005', '007']) {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const bank = (await inspectCommunityPack(bytes)).corpus!;
    records.push(...(await reviewedReading(bank.records)).filter(source => roots.includes(source.rootId)));
  }
  const bank = { version: 1 as const, failures: [], records };
  const operation = `evidence:${conditionPrompt}`;
  for (const seed of [0, 1, 2, 7, 31, 127, 65535]) {
    const lesson = corpusLesson(bank, new Set(), seed, 500, 'B2', [], 'evidence', [], operation)!;
    expect(new Set(lesson.materials.map(material => material.rootId))).toEqual(new Set(roots));
    expect(lesson.teaching?.en).toContain('recipient restriction');
    for (const material of lesson.materials) {
      const text = material.blocks[0].text, question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected condition evidence');
      expect(corpusOperation(question)).toBe(operation);
      const accepted = question.spans[question.accepted[0]].text;
      expect(accepted).toBe(material.rootId === roots[0]
        ? 'Permits were only issued to those involved in the relief or reconstruction effort, and were used to prevent the early return of some of those evacuated.'
        : 'It was open only to native-born American citizens of parents who had been citizens of the United States for at least ten years.');
      for (const [index, span] of question.spans.entries()) {
        expect(text.slice(span.start, span.end)).toBe(span.text);
        expect(score(question, index).correct).toBe(question.accepted.includes(index));
        if (!question.accepted.includes(index)) expect(span.text).not.toMatch(/required|To become|called for|only|as long as|limited to/i);
      }
      expect(question.explanation.en).toContain('does not guarantee');
      expect(material.questions[1].prompt).toContain('guarantee');
      expect(score(material.questions[1], 'This historical restriction alone does not establish permission.').correct).toBeNull();
      expect(exposureSchema.safeParse({ profileId: 'test', rootId: material.rootId, firstSeenAt: '2026-10-08T00:00:00.000Z', lastSeenAt: '2026-10-08T00:00:00.000Z', contacts: [{ sessionId: 'test', materialId: material.id, questionId: question.id, variantGroup: question.id, firstSeenAt: '2026-10-08T00:00:00.000Z', lastSeenAt: '2026-10-08T00:00:00.000Z' }] }).success).toBe(true);
    }
  }
}, 20000);

it('withholds unsupported recipient parses and competing bare eligibility distractors', () => {
  for (const verb of ['issued', 'given', 'granted']) for (const be of ['is', 'are', 'was', 'were']) for (const position of [0, 1]) {
    const subject = ['is', 'was'].includes(be) ? 'A permit' : 'Permits';
    const restriction = `${subject} ${be} ${position ? `${verb} only` : `only ${verb}`} to residents with tickets.`;
    const text = restriction + ' ' + neutral;
    for (const seed of [0, 1, 31]) {
      const task = corpusCondition(text, seed)!;
      expect(task.spans[task.accepted[0]].text).toBe(restriction);
      expect(text.slice(task.evidence.start, task.evidence.end)).toBe(restriction);
    }
  }
  for (const statement of [
    'Permits were not only issued to residents with tickets.',
    'No permits were only issued to residents with tickets.',
    'If permits were only issued to residents with tickets, the office closed.',
    'The committee denied that permits were only issued to residents with tickets.',
    "Permits were only issued to those who didn't return early.",
    'Permits were only issued to Alice.',
    'Permits were only issued yesterday.',
    'Permits might be issued only to residents with tickets.',
    'Permits were only issued to residents with tickets unless the chief intervened.',
    'Dana said "Permits were only issued to those involved in repairs."',
    'It was open only to citizens of the region.',
    'This program was open only to citizens of the region.',
    'Permits were only issued to those not involved in repairs.',
  ]) expect(corpusCondition(statement + ' ' + neutral, 0)).toBeUndefined();
  const statement = 'Permits were only issued to residents with tickets.';
  expect(corpusCondition(statement + ' The office admitted citizens of the region. ' + neutral, 0)!.spans.some(span => /admitted/.test(span.text))).toBe(false);
  expect(corpusCondition(statement + ' The office admitted citizens of the region. The entrance faces the garden.', 0)).toBeUndefined();
});
