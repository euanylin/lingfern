import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { concessionPrompt, corpusConcession, corpusLesson, corpusSchema, selectCorpusPassage } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const digest = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
const scopes = JSON.parse(readFileSync('content/corpus/gutenberg-long-scopes.json', 'utf8')) as { records: { bookId: number; start: number; end: number; textSha256: string; rawSha256: string; words: number; passages: string[] }[] };
const scope = scopes.records.find(scope => scope.bookId === 1228)!;
const source = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8'))).records.find(source => source.rootId === 'gutenberg-book-1228')!;
const long = source.passages.find(passage => passage.id === scope.textSha256)!;
const sentence = 'I may venture to express my conviction of the high value of such studies, although they have been very commonly neglected by naturalists.';
const operation = `evidence:${concessionPrompt}`;

it('preserves the actual 924-word continuous Darwin scope, all short texts and containment exposure', () => {
  const raw = readFileSync('content/corpus/raw/pg1228.txt', 'utf8');
  expect(digest(raw)).toBe(scope.rawSha256);
  const body = raw.slice(raw.indexOf('\n', raw.indexOf('*** START OF')), raw.indexOf('*** END OF')).replace(/\r/g, '').normalize('NFC');
  const canonical = body.split(/\n\s*\n/).map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
  expect(long.text).toBe(canonical.slice(scope.start, scope.end));
  expect(long.id).toBe(digest(long.text)); expect(long.wordCount).toBe(924);
  expect(source.sourceHash).toBe(scope.rawSha256); expect(source.originalText).toBeUndefined();
  const short = scope.passages.map(id => source.passages.find(passage => passage.id === id)!);
  expect(short).toHaveLength(3); expect(short.every(passage => long.text.includes(passage.text))).toBe(true);
  expect(short.reduce((sum, passage) => sum + passage.wordCount, 0)).toBe(long.wordCount);
  const bank = { version: 1 as const, failures: [], records: [{ ...source, passages: [long, ...short] }] };
  expect(selectCorpusPassage(bank, new Set(), 0, 700)?.passage.id).not.toBe(long.id);
  expect(selectCorpusPassage(bank, new Set([long.id]), 0, 1200)).toBeUndefined();
  for (const passage of short) {
    const next = selectCorpusPassage(bank, new Set([passage.id]), 0, 1200, [], [], 'C2');
    expect(next).toBeDefined(); expect(next?.passage.id).not.toBe(long.id);
  }
});

it('scores exact complete concessive clauses while retaining uncertainty and unscored interpretation', () => {
  for (let seed = 0; seed < 7; seed++) {
    const task = corpusConcession(long.text, seed)!;
    expect(long.text.slice(task.evidence.start, task.evidence.end)).toBe(sentence);
    expect(task.spans[task.accepted[0]].text).toBe(sentence);
    for (const span of task.spans) expect(long.text.slice(span.start, span.end)).toBe(span.text);
    expect(task.spans.filter((_, index) => !task.accepted.includes(index)).every(span => !/although|even though/i.test(span.text))).toBe(true);
  }
});

it('reaches long concession through the native no-history C2 cycle and transfers it to actual NASA, NOAA and Wikipedia roots', async () => {
  const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8')) as { packs: { skill: string; topic: string; path: string; sha256: string }[] };
  const bound = corpusPracticeHistory([], [], 'local-guest', 'reading', 'all', 'C2');
  expect(bound.maxWords).toBe(1200); expect(bound.seen.size).toBe(0);
  for (const [topic, root, id] of [
    ['science', 'nasa-article-194222171056800', '45a61b715b2ef49bb21676318402c5743e8d11e2048b5ddbad0286e543199ae3'],
    ['nature', 'noaa-article-217121916223523', '7f12d83a8b2e9e2dd95af5bcb5b782a03fe22a2e802ac52ef3e426885362843d'],
    ['business', 'wikipedia-article-1938', '05b4109e26a670c81de5437b420a80a2170e76b84bbff610023fb95199ed99ad'],
  ]) {
    const banks = catalogue.packs.filter(pack => pack.skill === 'reading' && pack.topic === topic).map(entry => {
      const bytes = readFileSync('public' + entry.path); expect(digest(bytes)).toBe(entry.sha256);
      return corpusSchema.parse(JSON.parse(new TextDecoder().decode(unzipSync(bytes, { filter: file => file.name === 'corpus.json' })['corpus.json'])));
    });
    const peer = (await reviewedReading(banks.flatMap(bank => bank.records))).find(record => record.rootId === root)!;
    const passage = peer.passages.find(passage => passage.id === id)!;
    expect(corpusConcession(passage.text, 0)).toBeDefined();
    const actual = { version: 1 as const, failures: [], records: [{ ...source, passages: [long] }, { ...peer, passages: [passage] }] };
    // Use two eligible passages so seed 24 reaches the concession cycle.
    for (const seed of [24, 25]) {
      const lesson = corpusLesson(actual, bound.seen, seed, bound.maxWords, 'C2')!;
      lessonSchema.parse(lesson);
      expect(lesson.materials.map(material => material.rootId)).toEqual([source.rootId, root]);
      expect(lesson.materials[0].blocks[0].text).toBe(long.text);
      for (const material of lesson.materials) {
        const question = material.questions[0]; expect(corpusOperation(question)).toBe(operation);
        if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected concessive evidence');
        for (const [index, span] of question.spans.entries()) {
          expect(material.blocks[0].text.slice(span.start, span.end)).toBe(span.text);
          expect(score(question, index).correct).toBe(question.accepted.includes(index));
        }
        expect(score(material.questions[1], 'I quote both clauses and retain their limits.').correct).toBeNull();
      }
      const tested = asTestLesson(lesson); lessonSchema.parse(tested);
      expect(tested.mode).toBe('test'); expect(tested.id).toBe(lesson.id);
      expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
      expect(tested.materials.every(material => material.questions.every(question => !question.hints))).toBe(true);
      for (const [index, material] of tested.materials.entries()) {
        expect(material.blocks).toEqual(lesson.materials[index].blocks);
        expect(material.questions[0].evidence).toEqual(lesson.materials[index].questions[0].evidence);
        const question = material.questions[0];
        if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected unchanged Test evidence');
        for (const index of question.spans.keys()) expect(score(question, index).correct).toBe(question.accepted.includes(index));
        expect(score(material.questions[1], 'I preserve uncertainty and attribution.').correct).toBeNull();
      }
    }
  }
});
