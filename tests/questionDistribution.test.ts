import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusDefaultFocus, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';

it.each(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const)('balances reading kinds without hiding semantic subtypes at %s', point => {
  const counts = new Map<string, number>(), operations = new Set<string>();
  for (let phase = 0; phase < 360; phase++) {
    const [kind, operation] = corpusDefaultFocus(phase * 7, 7, point);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    operations.add(operation ?? kind);
  }
  expect(counts.size).toBe(point === 'A1' || point === 'A2' ? 5 : 6);
  expect(new Set(counts.values()).size).toBe(1);
  expect(operations.size).toBe({ A1: 14, A2: 16, B1: 20, B2: 21, C1: 24, C2: 24 }[point]);
  if (point === 'C2') for (const operation of ['choice:nuanced-meaning', 'choice:rhetorical-function', 'choice:layered-position', 'choice:complex-pragmatics', 'choice:faithful-paraphrase', 'choice:disagreement-synthesis']) expect(operations.has(operation)).toBe(true);
  if (point === 'C1') for (const operation of ['choice:information-density', 'choice:implicit-intention', 'matching:discourse-organization', 'matching:register-audience', 'matching:argument-boundaries', 'matching:indirect-stance']) expect(operations.has(operation)).toBe(true);
});

// Keep synthetic metadata in tests; support only ordering and exact-word restoration here.
function sparseBank() {
  const original = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const hash = 'a'.repeat(64);
  return spokenCorpusSchema.parse({ version: 1, communityPackageId: hash, records: original.records.slice(0, 2).map((record, index) => {
    const { passages, ...source } = record;
    expect(passages.length).toBeGreaterThan(0);
    const text = `Maya opens the window and looks at the ${index ? 'station' : 'garden'} outside her house. She puts a blue cup on the wooden shelf beside the door. Then she closes the window and walks into the kitchen.`;
    return { ...source, clips: [{ id: String(index + 1).repeat(64), text, wordCount: text.split(/\s+/).length, reviewStatus: 'pending', qualityFlags: [], processing: 'Synthetic distribution test.', audioSourceId: `test-${index}`,
      credit: { attribution: source.attribution, license: source.licence, sourceUrl: source.originalUrl },
      audio: { src: `/audio/community-${hash}/test-${index}.mp3`, sha256: 'b'.repeat(64), duration: 20, author: 'Test', sourceUrl: source.originalUrl, license: source.licence, synthetic: false },
      segments: [{ start: 0, end: text.length, text, audioStart: 0, audioEnd: 20 }] }] };
  }) });
}

it.each(['A2', 'B1', 'C2'] as const)('balances only supported listening kinds at %s and preserves focus/review', point => {
  const bank = sparseBank(), counts = new Map<string, number>();
  for (let seed = 0; seed < 64; seed++) {
    const lesson = spokenCorpusLesson(bank, new Set(), seed, 60, point, ['daily-life'])!;
    const operation = corpusOperation(lesson.materials[0].questions[0])!;
    counts.set(operation, (counts.get(operation) ?? 0) + 1);
    expect(lesson.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
    const focused = spokenCorpusLesson(bank, new Set(), seed, 60, point, [], 'completion', ['garden'])!;
    expect(focused.materials.every(material => corpusOperation(material.questions[0]) === 'completion')).toBe(true);
    expect(focused.materials[0].rootId).toBe(bank.records[0].rootId);
    expect(spokenCorpusLesson(bank, new Set(bank.records.flatMap(source => source.clips.map(clip => clip.id))), seed, 60, point)).toBeUndefined();
  }
  expect(Object.fromEntries(counts)).toEqual({ sequence: 32, completion: 32 });
});
