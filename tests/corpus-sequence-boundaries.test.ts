import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { corpusSequence } from '../src/core/corpus';

it('withholds the actual two-sentence Trollope recording rather than scoring printed line fragments', () => {
  const bytes = readFileSync('public/source-packs/listening-history-286f50ab0076.zip');
  const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
  expect(sha(bytes)).toBe('25d6b459dd7a57ed1c885183c9ddbbca26c7d4451d3c61a891963f8e76175ae4');
  const bank = JSON.parse(strFromU8(unzipSync(bytes, { filter: file => file.name === 'spoken.json' })['spoken.json'])) as { records: { rootId: string; clips: { id: string; text: string }[] }[] };
  const text = bank.records.find(record => record.rootId === 'gutenberg-book-5978')!.clips.find(clip => clip.id === '6b1c61792442a4019d5c1d581a5cd9d10dd0400d419c0010458a64a3c4f5524f')!.text;
  expect(sha(text)).toBe('ca93b13b0173306d81dcdebceceebf65772d39b6c79b91c5058f354abd44360f');
  expect([...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text.replace(/\s+/g, ' '))]).toHaveLength(2);
  for (let seed = 0; seed < 32; seed++) expect(corpusSequence(text, seed)).toBeUndefined();
});

it('does not stitch complete sentences across an unfinished printed line', () => {
  const text = 'Mira checks the gate before leaving.\nA printed line without a terminal mark\nHas the main bell already rung? He walks back through the open gate!';
  for (let seed = 0; seed < 8; seed++) expect(corpusSequence(text, seed)).toBeUndefined();
});

it('retains complete consecutive statements, questions and exclamations with exact evidence', () => {
  const text = 'Mira checks the gate before leaving. Has the main bell already rung? He walks back through the open gate!';
  for (let seed = 0; seed < 8; seed++) {
    const frame = corpusSequence(text, seed)!;
    expect(frame).toBeDefined();
    expect(frame.acceptedOrders[0].join(' ')).toBe(text.slice(frame.evidence.start, frame.evidence.end));
    expect(frame.steps.every(step => /[.!?]$/.test(step))).toBe(true);
    expect(frame.steps).not.toEqual(frame.acceptedOrders[0]);
  }
});

it('starts after a wrapped sentence rather than at its final line', () => {
  const tail = 'Mira checks the gate before leaving. Has the main bell already rung? He walks back through the open gate!';
  const text = 'The opening sentence continues\nonto this last printed line.\n' + tail;
  for (let seed = 0; seed < 8; seed++) {
    const frame = corpusSequence(text, seed)!;
    expect(frame.acceptedOrders[0].join(' ')).toBe(tail);
    expect(text.slice(frame.evidence.start, frame.evidence.end)).toBe(tail);
  }
});
