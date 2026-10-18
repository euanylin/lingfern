import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { corpusSchema, corpusLesson, corpusMaterial, corpusMaterialRoot, corpusAddress, corpusPhone, corpusRooms, corpusApartments, corpusSpeakers, corpusStatedOrigin, corpusStatedIntention } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { score } from '../src/shared/content';
import { openReadingBeginnerScopes } from '../src/shared/openReading';

const bank = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/open-reading.json', 'utf8')));
const source = bank.records.find(record => record.id === 'bccampus-abealfreader1')!;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const isolated = () => ({ version: 1 as const, records: [structuredClone(source)], failures: [] });

it('pairs the new book with a genuinely different existing source using the same operation', () => {
  const voa = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const paired = corpusSchema.parse({ version: 1, records: [source, ...voa.records], failures: [] });
  for (const point of ['A1', 'A2'] as const) for (const operation of ['completion', 'sequence'] as const) {
    let includesBook = 0;
    for (let seed = 0; seed < 64; seed++) {
      const lesson = corpusLesson(paired, new Set(), seed, point === 'A1' ? 120 : 160, point, [], operation);
      if (!lesson?.materials.some(material => material.rootId === source.rootId)) continue;
      expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
      expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
      includesBook++;
    }
    expect(includesBook, `${point}:${operation}`).toBeGreaterThan(0);
  }
});

it('retains seven reviewed source windows, including the complete native tomato list, under one book root', async () => {
  expect(source.passages).toHaveLength(7);
  expect(source.originalText).toBeUndefined();
  expect(source.passages.map(passage => passage.wordCount)).toEqual([145, 30, 85, 103, 16, 112, 156]);
  expect(new Set(source.passages.map(passage => corpusMaterialRoot(source, passage)))).toEqual(new Set(['bccampus-book-abealfreader1']));
  for (const passage of source.passages) {
    expect(passage.task).toBeUndefined();
    expect(sha(passage.text)).toBe(passage.sourceProvenance!.textSha256);
    expect(passage.text).not.toMatch(/https?:\/\/|Click play|<img|<iframe/);
    const scope = openReadingBeginnerScopes.find(scope => scope.id === passage.id)!;
    expect(passage.sourceProvenance).toEqual(scope.sourceProvenance);
  }
  const tomatoes = source.passages.find(passage => passage.sourceProvenance!.locator === 'grow-your-own-tomatoes')!.text;
  expect(tomatoes).toContain('You need:\n\nTomato seeds\n\nA big pot (50 cm deep)\n\nPotting soil (many big food shops sell this)\n\nA window');
  expect(await reviewedReading([source])).toEqual([source]);
  expect(corpusLesson(isolated(), new Set(), 0, 160, 'A2')).toBeUndefined();
  expect(corpusLesson(isolated(), new Set(), 0, 120, 'A1')).toBeUndefined();
});

it('uses the existing generator and scorer for exact-source word restoration and source order at each supported starting point', () => {
  let checks = 0;
  for (const passage of source.passages) for (const point of passage.startingPoints!) {
    expect(passage.wordCount).toBeLessThanOrEqual(point === 'A1' ? 120 : 160);
    for (let seed = 0; seed < 32; seed++) for (const focus of ['completion', 'sequence'] as const) {
      const material = corpusMaterial({ source, passage }, seed, point, focus)!;
      const question = material.questions[0];
      expect(corpusOperation(question)).toBe(focus);
      const evidence = passage.text.slice(question.evidence!.start, question.evidence!.end);
      expect(evidence.length).toBeGreaterThan(0);
      if ('kind' in question && question.kind === 'completion') {
        expect(evidence).toContain(question.answer);
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, 'unrelated').correct).toBe(false);
      } else if ('steps' in question) {
        expect(question.acceptedOrders[0].every(sentence => evidence.includes(sentence))).toBe(true);
        expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
        expect(score(question, question.acceptedOrders[0].toReversed()).correct).toBe(false);
      } else throw Error('UNEXPECTED_BEGINNER_OPERATION');
      checks++;
    }
    for (const helper of [corpusAddress, corpusPhone, corpusRooms, corpusApartments, corpusSpeakers, corpusStatedOrigin, corpusStatedIntention])
      expect(helper(passage.text, 0)).toBeUndefined();
  }
  expect(checks).toBe(576);
});

it('does not admit other ranges, sources, unsupported levels or ordinary-paragraph exemptions', async () => {
  for (const mutation of ['id', 'level', 'no-level', 'duplicate-level', 'duplicate-scope', 'A1-too-long', 'raw', 'canonical', 'start', 'end', 'index', 'chapter', 'url', 'work', 'text-hash', 'root', 'source-hash', 'licence', 'ordinary-support', 'ordinary-short']) {
    const invalid = isolated(), record = invalid.records[0], passage = record.passages[0], provenance = passage.sourceProvenance!;
    switch (mutation) {
      case 'id': passage.id = 'a'.repeat(64); break;
      case 'level': passage.startingPoints = ['A1']; break;
      case 'no-level': delete passage.startingPoints; break;
      case 'duplicate-level': passage.startingPoints = ['A2', 'A2']; break;
      case 'duplicate-scope': record.passages.push(structuredClone(passage)); break;
      case 'A1-too-long': passage.wordCount = 121; passage.startingPoints = ['A1']; break;
      case 'raw': provenance.rawSha256 = 'a'.repeat(64); break;
      case 'canonical': provenance.canonicalSha256 = 'a'.repeat(64); break;
      case 'start': provenance.sourceStart++; provenance.codePointStart++; break;
      case 'end': provenance.sourceEnd--; provenance.codePointEnd--; break;
      case 'index': provenance.paragraphIndex++; break;
      case 'chapter': provenance.chapter = 'Wrong story'; break;
      case 'url': provenance.sourceUrl = 'https://opentextbc.ca/physicalgeology2ed/chapter/chapter-1/'; break;
      case 'work': provenance.workId = 'bccampus-physical-geology-2e'; break;
      case 'text-hash': provenance.textSha256 = 'a'.repeat(64); break;
      case 'root': record.rootId = 'bccampus-book-chapter-1'; break;
      case 'source-hash': record.sourceHash = 'a'.repeat(64); break;
      case 'licence': record.licenceUrl = 'https://www.gutenberg.org/policy/license.html'; break;
      case 'ordinary-support': invalid.records = [structuredClone(bank.records[0])]; invalid.records[0].passages[0].startingPoints = ['A2']; break;
      case 'ordinary-short': invalid.records = [structuredClone(bank.records[0])]; invalid.records[0].passages[0].wordCount = 119; break;
    }
    expect(corpusSchema.safeParse(invalid).success, mutation).toBe(false);
  }
  const altered = structuredClone(source);
  altered.passages[0].text = altered.passages[0].text.replace('grandma', 'Grandma');
  await expect(reviewedReading([altered])).rejects.toThrow('CORPUS_INTEGRITY');
});
