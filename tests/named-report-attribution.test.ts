import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { attributionMatchingPrompt, corpusAttributionPairs, corpusAttribution, corpusLesson, corpusSchema, corpusViewpoints } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const digest = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
const report = 'Leigh Alexander argued that appealing to women does not necessarily entail reduced difficulty or complexity.';

it('never offers the actual Envy attributed definition as an unattributed distractor', () => {
  const bytes = readFileSync('public/source-packs/listening-society-9db25ded38c1.zip');
  expect(digest(bytes)).toBe('4d1ddd651986a0e8a9265a67f47461ffa618bc9e3795f73193c9854e001604f2');
  const bank = JSON.parse(strFromU8(unzipSync(bytes, { filter: file => file.name === 'spoken.json' })['spoken.json'])) as { records: { rootId: string; clips: { id: string; text: string }[] }[] };
  const clips = bank.records.find(record => record.rootId === 'wikipedia-article-18855029')!.clips;
  const full = clips.find(clip => clip.id === 'dea3c4cad36eabd94543aa2c09712a43ad08eadc0778c40e8f0f4729f4a8db25')!;
  const short = clips.find(clip => clip.id === 'b7ebddc9c6e679b45415e87010c3ef4fd80f88cad39617aefc69b91706ff3665')!;
  expect(digest(full.text)).toBe('ecf6dfc6edd0d6018a85649f8d59f38823f7a4225942cdb2bc4ceed8f789c48f');
  expect(digest(short.text)).toBe('532077e89a2e6c37cda1b311fc05ede5a8b26d48c01d456d01a5c9fd8cf9e6a5');
  for (let seed = 0; seed < 32; seed++) {
    expect(corpusAttribution(short.text, seed)).toBeUndefined();
    const frame = corpusAttribution(full.text, seed)!;
    expect(frame).toBeDefined();
    expect(frame.spans.every(span => !span.text.startsWith('Aristotle defined'))).toBe(true);
    expect(frame.spans[frame.accepted[0]].text).toBe('Bertrand Russell said that envy was one of the most potent causes of unhappiness.');
  }
});
const according = 'According to Brendan Keogh, these are inherently masculine activities such as fighting and exerting dominance.';
const operation = `matching:${attributionMatchingPrompt}`;
async function actual(maxWords = 300) {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const records = [];
  for (const [suffix, root, id, words, hash] of [
    ['013', 'wikipedia-article-182053', 'c9f3f84d68b09cd36ae600ad14c0c56334a621fdee7b2eb1533637f876877dcb', 143, '1b143bae5b2612baf1c7b4707bd2e8bc37abf5ac12ac1986cd2014e722727e0d'],
    ['004', 'wikipedia-article-3986', '5b15a5d8e4f5da47be48f7696f0ef93f8b676082b4ccadcd91b5b68cef014209', 282, '7f25bd3a493760463f5ae263fdb64cea4dbd1bb27a57cb4eb932061b464e2dd6'],
  ] as const) {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id); expect(digest(bytes)).toBe(entry.sha256);
    const source = (await reviewedReading((await inspectCommunityPack(bytes)).corpus!.records, maxWords)).find(source => source.rootId === root)!;
    const passage = source.passages.find(passage => passage.id === id)!;
    expect(passage.wordCount).toBe(words); expect(digest(passage.text)).toBe(hash);
    records.push({ ...source, passages: [passage] });
  }
  return corpusSchema.parse({ version: 1, failures: [], records });
}

it('keeps named-report verbs, full negation and exact source evidence with both named sources', () => {
  const text = `${according} ${report}`;
  for (let seed = 0; seed < 7; seed++) {
    const task = corpusAttributionPairs(text, seed)!;
    expect(task.pairs.find(pair => pair.answer === 'Leigh Alexander')?.label).toBe(report.slice('Leigh Alexander '.length));
    expect(new Set(task.choices)).toEqual(new Set(['Leigh Alexander', 'Brendan Keogh']));
    for (const [index, span] of [task.evidence, ...task.otherEvidence].entries()) {
      const evidence = text.slice(span.start, span.end), pair = task.pairs[index];
      expect(evidence).toContain(pair.answer); expect(evidence.endsWith(pair.label)).toBe(true);
    }
    expect(corpusViewpoints(text, seed)?.names).toHaveLength(2);
  }
  expect(corpusAttribution(report + ' The trial opened on Monday in the town hall. The doors closed at six in the evening.', 0)).toBeDefined();
});

it('withholds quoted interiors, broken quotes, generic sources, incomplete and nested reports', () => {
  for (const invalid of [
    `A witness said, "First listen. ${report} That is the story."`,
    `A witness said, “First listen. ${report} That is the story.”`,
    `A witness said, 'First listen. ${report} That is the story.'`,
    `A witness said, ‘First listen. ${report} That is the story.’`,
    `An unclosed "remark. ${report}`,
    `An inverted ”remark“. ${report}`, `A crossed “remark' and story”'. ${report}`,
    `The witnesses' testimony is incomplete. ${report}`,
    report.replace('Leigh Alexander', 'The Report'), report.replace('Leigh Alexander', 'Some Reviewers'),
    report.replace('Leigh Alexander', 'She'), report.replace(' argued that ', ' did not argue that '),
    report.replace(' argued that ', ' may argue that '), report.replace(' argued that ', ' argued, if asked, that '),
    report.replace('reduced difficulty', 'what Dana Smith claimed was reduced difficulty'),
    report.replace('reduced difficulty', 'according to Dana, reduced difficulty'),
    report.replace('complexity.', 'complexity?'), report.replace('complexity.', 'complexity [citation needed].'),
    report + ' ' + report,
  ]) expect(corpusAttributionPairs(`${according} ${invalid}`, 0), invalid).toBeUndefined();
  const repeated = `Dana Smith argued that delays may fall during the trial. Robin Jones argued that delays may fall during the trial.`;
  expect(corpusAttributionPairs(repeated, 0)).toBeUndefined();
  const sharedSurname = `Dana Smith argued that delays may fall during the trial. Robin Smith believed that the costs were likely to increase.`;
  expect(corpusAttributionPairs(sharedSurname, 0)).toBeUndefined();
  expect(corpusAttributionPairs(`${according} An unrelated "closed 'remark'" is recorded. ${report}`, 0)).toBeDefined();
});

it('generates actual two-root practice and identical assistance-free Test scoring for seven seeds', async () => {
  const corpus = await actual();
  expect(corpus.records[0].passages[0].text).toContain(report);
  for (let seed = 0; seed < 7; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 300, 'B2', [], 'matching', [], operation)!;
    lessonSchema.parse(lesson); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const question = material.questions[0], response = material.questions[1];
      expect(corpusOperation(question)).toBe(operation);
      if (!('kind' in question) || question.kind !== 'matching') throw Error('Expected matching');
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
      expect(score(response, 'I preserve the source names and their different emphases.').correct).toBeNull();
      expect(question.pairs.some(pair => /^(?:argued|argues) that /.test(pair.label))).toBe(true);
      for (const [index, span] of [question.evidence, ...(question.additionalEvidence ?? [])].entries()) {
        const evidence = material.blocks[0].text.slice(span.start, span.end), pair = question.pairs[index];
        expect(evidence).toContain(pair.answer); expect(evidence.endsWith(pair.label)).toBe(true);
      }
    }
    const tested = asTestLesson(lesson); lessonSchema.parse(tested);
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
    for (const [index, material] of tested.materials.entries()) {
      expect(material.questions[0].evidence).toEqual(lesson.materials[index].questions[0].evidence);
      expect(material.questions[0].hints).toBeUndefined();
      expect(score(material.questions[1], 'A source-supported interpretation.').correct).toBeNull();
    }
    const seen = new Set(lesson.materials.map(material => material.id.slice(7)));
    expect(corpusLesson(corpus, seen, seed, 300, 'B2', [], 'matching', [], operation)).toBeUndefined();
  }
  for (const level of ['A1', 'A2'] as const) expect(corpusLesson(corpus, new Set(), 0, 300, level, [], 'matching', [], operation)).toBeUndefined();
});

it('supports topic, references and limits on the actual short two-root pair without changing Test operations', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const records = [];
  for (const [suffix, root, id, hash] of [
    ['005', 'wikipedia-article-24659645', 'f1c5736aca3f1f46780bd36efb1cf5dcee4ba7b90ba41edbe828b2057315a30d', 'f1d0ebf533d84eee275773e8563c2131a655c4a55d34f4227bb1dcb21f23dac2'],
    ['013', 'wikipedia-article-182053', 'c9f3f84d68b09cd36ae600ad14c0c56334a621fdee7b2eb1533637f876877dcb', '1b143bae5b2612baf1c7b4707bd2e8bc37abf5ac12ac1986cd2014e722727e0d'],
  ] as const) {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id); expect(digest(bytes)).toBe(entry.sha256);
    const source = (await reviewedReading((await inspectCommunityPack(bytes)).corpus!.records, 200)).find(source => source.rootId === root)!;
    const passage = source.passages.find(passage => passage.id === id)!;
    expect(digest(passage.text)).toBe(hash); expect(passage.wordCount).toBeLessThanOrEqual(200);
    records.push({ ...source, passages: [passage] });
  }
  const corpus = corpusSchema.parse({ version: 1, failures: [], records });
  for (let seed = 0; seed < 7; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 200, 'B1', [], 'matching', [], operation)!;
    lessonSchema.parse(lesson);
    expect(lesson.teaching?.en).toContain('each complete claim to its named source');
    expect(lesson.teaching?.en).toContain('rejects a guarantee');
    expect(lesson.workedExample?.en).toContain('bus route');
    expect(lesson.workedExample?.en).not.toMatch(/James Barr|Childs|Keogh|Alexander|canonical|masculine/);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      expect(corpusOperation(material.questions[0])).toBe(operation);
      const response = material.questions[1];
      if (!('kind' in response) || response.kind !== 'response') throw Error('Expected response');
      expect(response.criteria.map(criterion => criterion.en).join(' ')).toContain('resolve references');
      expect(response.hints?.[0].en).toContain('need not disagree');
      expect(response.hints?.[1].en).toContain('“it” or “these”');
      expect(response.hints?.[2].en).toContain('not necessarily a quarrel');
      expect(response.explanation.en).toContain('state what remains unclear');
      expect(score(response, 'A comparison supported by two quotations.').correct).toBeNull();
    }
    const tested = asTestLesson(lesson);
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
    for (const [index, material] of tested.materials.entries()) {
      expect(material.questions.map(question => question.hints)).toEqual([undefined, undefined]);
      expect(material.questions.map(question => question.prompt)).toEqual(lesson.materials[index].questions.map(question => question.prompt));
      expect(material.questions[0].evidence).toEqual(lesson.materials[index].questions[0].evidence);
    }
  }
});

it('accepts a year citation on a proper name and withholds editorial brackets and a colon', () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/open-reading.json', 'utf8')));
  const passageFor = (needle: string) => bank.records.flatMap(source => source.passages.map(passage => ({ source, passage }))).find(item => item.passage.text.includes(needle))!;
  const names = new Map([
    ['According to Maslow (1943)', 'Maslow'],
    ['According to White (2021)', 'White'],
    ['Drew Westen (1998)', 'Drew Westen'],
  ]);
  const frames = [...names.keys()].map(passageFor);
  for (const [index, needle] of [...names.keys()].entries()) {
    const task = corpusAttribution(frames[index].passage.text, 0)!;
    const sentence = frames[index].passage.text.slice(task.evidence.start, task.evidence.end);
    expect(sentence.startsWith(needle)).toBe(true);
    expect(sentence).toContain(needle.split(' (')[0].replace(/^According to /, ''));
  }
  for (const needle of ['According to Jagose (1996)', 'Herbert Blumer (1958)']) {
    const item = passageFor(needle);
    const task = corpusAttribution(item.passage.text, 0);
    if (task) expect(item.passage.text.slice(task.evidence.start, task.evidence.end)).not.toContain(needle);
  }
  const focused = { version: 1 as const, failures: [] as [], records: [frames[0], frames[1]].map(item => ({ ...item.source, passages: [item.passage] })) };
  const lesson = corpusLesson(focused, new Set(), 0, 300, 'B1', [], 'evidence', [], 'evidence:Which sentence explicitly attributes a claim to a named source?')!;
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
});
