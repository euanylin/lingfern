import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareGutenbergExpansion } from '../scripts/gutenberg-expansion.mjs';
import { sha } from '../scripts/open-reading-corpus.mjs';

async function baselineCorpus() {
  const current = JSON.parse(await readFile('content/corpus/gutenberg.json'));
  const review = JSON.parse(await readFile('content/corpus/gutenberg-expansion-source-review.json'));
  const ids = new Set(review.books.map(book => book.id));
  return { ...current, records: current.records.filter(record => !ids.has(record.id)) };
}

test('frozen Gutenberg expansion preserves every current record and admits only reviewed native paragraphs', async () => {
  const corpus = await baselineCorpus();
  const before = JSON.stringify(corpus);
  const { corpus: expanded, review, outputs } = await prepareGutenbergExpansion(corpus);
  assert.equal(JSON.stringify(corpus), before);
  assert.deepEqual(expanded.records.slice(0, corpus.records.length), corpus.records);
  const reviewedRoots = new Set(review.books.map(book => book.rootId));
  const added = expanded.records.filter(record => reviewedRoots.has(record.rootId));
  assert.deepEqual(added.map(record => record.id).sort(), ['gutenberg-1408', 'gutenberg-14474', 'gutenberg-2530'].sort());
  assert.equal(added.reduce((sum, record) => sum + record.passages.length, 0), review.books.reduce((sum, book) => sum + book.paragraphCount, 0));
  for (const record of added) {
    assert(record.licence.includes('USA'));
    for (const passage of record.passages) {
      assert.equal(passage.id, sha(passage.text));
      assert.equal(passage.wordCount, passage.text.trim().split(/\s+/).length);
      assert(passage.wordCount >= 120 && passage.wordCount <= 700);
      assert.equal(passage.sourceProvenance, undefined);
    }
  }
  assert.equal(outputs.length, 7);
  for (const output of outputs) assert.equal(sha(output.bytes), output.sha256);
});

test('Gutenberg expansion rejects root collisions and duplicate current text instead of replacing originals', async () => {
  const corpus = await baselineCorpus();
  const { corpus: expanded } = await prepareGutenbergExpansion(corpus);
  const incoming = expanded.records.find(record => record.id === 'gutenberg-2530');
  assert.deepEqual((await prepareGutenbergExpansion(expanded)).corpus, expanded);
  await assert.rejects(prepareGutenbergExpansion({ ...corpus, records: [...corpus.records, { ...incoming, sourceHash: '0'.repeat(64) }] }), /GUTENBERG_EXPANSION_CHANGED_ROOT/);
  const collision = { ...corpus.records[0], passages: [{ ...incoming.passages[0], text: incoming.passages[0].text.replace(/ /g, '  ') }] };
  await assert.rejects(prepareGutenbergExpansion({ ...corpus, records: [...corpus.records, collision] }), /GUTENBERG_EXPANSION_DUPLICATE_TEXT/);
});



