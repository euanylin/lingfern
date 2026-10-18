import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusAddress, corpusApartments, corpusPhone, corpusRooms, corpusSchema } from '../src/core/corpus';

const bank = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/open-reading.json', 'utf8')));
const reader = bank.records.find(record => record.id === 'bccampus-abealfreader5')!;

it('admits Reader 5 as one root and does not treat its paragraphs as the four singleton operations', () => {
  expect(reader.rootId).toBe('bccampus-book-abealfreader5');
  expect(reader.passages).toHaveLength(9);
  expect(new Set(reader.passages.map(passage => passage.id)).size).toBe(9);
  for (const passage of reader.passages) {
    expect(passage.wordCount).toBeGreaterThanOrEqual(120);
    expect(passage.wordCount).toBeLessThanOrEqual(700);
    expect(passage.sourceProvenance?.workId).toBe(reader.id);
    expect(corpusAddress(passage.text, 0)).toBeUndefined();
    expect(corpusApartments(passage.text, 0)).toBeUndefined();
    expect(corpusRooms(passage.text, 0)).toBeUndefined();
    expect(corpusPhone(passage.text, 0)).toBeUndefined();
  }
});

it('uses fifty original dialogues as further roots for the four beginner operations', () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const sources = bank.records.filter(record => record.id.startsWith('lingfern-dialogue-'));
  expect(sources).toHaveLength(50);
  expect(new Set(sources.map(source => source.rootId)).size).toBe(50);
  for (const source of sources) {
    const text = source.passages[0].text;
    expect(source.authors).toEqual(['Lingfern']);
    expect(source.licence).toBe('CC BY 4.0. Original Lingfern dialogue.');
    expect(corpusAddress(text, 0)?.name).toBeTruthy();
    expect(corpusApartments(text, 0)?.rows).toHaveLength(2);
    expect(corpusRooms(text, 0)?.pairs).toHaveLength(2);
    expect(corpusPhone(text, 0)?.number).toMatch(/^[0-9]{3}-[0-9]{4}$/);
  }
  const source = sources.find(record => record.id === 'lingfern-dialogue-neighbors')!;
  const text = source.passages[0].text;
  expect(source.rootId).not.toMatch(/^voa-/);
  expect(corpusAddress(text, 0)?.name).toBe('Lena');
  const codes = corpusApartments(text, 0)?.rows.map(row => row.answer) ?? [];
  expect(codes).toHaveLength(2);
  expect(codes.every(code => ['A2', 'B5', 'C6'].includes(code))).toBe(true);
  expect(corpusRooms(text, 0)?.pairs.map(pair => pair.answer).sort()).toEqual(['bedroom', 'kitchen']);
  expect(corpusPhone(text, 0)?.number).toBe('555-0142');
  expect(corpusAddress(text + '\nOmar: Please call me Omar.', 0)).toBeUndefined();
  expect(corpusPhone(text.replace('555-2401', '555-0142'), 0)).toBeUndefined();
  expect(corpusRooms(text + '\nLena: I cook dinner in the kitchen.', 0)).toBeUndefined();
  expect(corpusApartments(text + '\nNora: I am in apartment A2.', 0)).toBeUndefined();
});

it('does not treat a poem line about sleeping in the blast as a room activity', () => {
  const line = 'While I sleep in the arms of the blast.';
  expect(corpusRooms(line, 0)).toBeUndefined();
  expect(corpusRooms(`Name: ${line}\nPete: I cook in the kitchen.`, 0)).toBeUndefined();
});
