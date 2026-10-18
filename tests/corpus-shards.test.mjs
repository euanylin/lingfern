import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { corpusShards, writeCorpusShards } from '../scripts/corpus-shards.mjs';

test('bounded shards conserve records, order and first-shard errors without splitting a source', () => {
  fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 200 }), { minLength: 1, maxLength: 320 }), sizes => {
    const records = sizes.map((size, id) => ({ id, text: '叶'.repeat(size) }));
    const corpus = { version: 1, records, failures: [{ url: 'https://example.com', error: 'held' }] };
    const shards = corpusShards(corpus, 2400);
    assert.deepEqual(shards.flatMap(text => JSON.parse(text).records), records);
    assert(shards.every(text => Buffer.byteLength(text) <= 2400 && JSON.parse(text).records.length <= 100));
    assert.deepEqual(JSON.parse(shards[0]).failures, corpus.failures);
    assert(shards.slice(1).every(text => !JSON.parse(text).failures.length));
  }));
  assert.equal(corpusShards({ version: 1, failures: [], records: Array.from({ length: 201 }, (_, id) => ({ id })) }).length, 3);
  assert.throws(() => corpusShards({ version: 1, records: [{ text: 'x'.repeat(3000) }] }, 2400), /CORPUS_SOURCE_TOO_LARGE/);
  assert.throws(() => corpusShards({ version: 1, records: [] }), /MISSING_CORPUS/);
});

test('only regenerated inert family shards are removed; invalid stale inputs cannot cause writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lingfern-shards-'));
  try {
    const corpus = { version: 1, failures: [], records: Array.from({ length: 201 }, (_, id) => ({ id })) };
    await writeFile(join(directory, 'original.txt'), 'retained source');
    await writeCorpusShards('additional', corpus, directory);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'additional-3.json'))).records, [{ id: 200 }]);
    await writeCorpusShards('additional', { ...corpus, records: [{ id: 9 }] }, directory);
    assert.deepEqual((await readdir(directory)).sort(), ['additional.json', 'original.txt']);
    await writeFile(join(directory, 'additional-4.json'), 'not a prepared corpus');
    const previous = await readFile(join(directory, 'additional.json'));
    await assert.rejects(writeCorpusShards('additional', corpus, directory));
    assert.deepEqual(await readFile(join(directory, 'additional.json')), previous);
    await assert.rejects(writeCorpusShards('../raw', corpus, directory), /INVALID_CORPUS_FAMILY/);
    assert.equal(await readFile(join(directory, 'original.txt'), 'utf8'), 'retained source');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
