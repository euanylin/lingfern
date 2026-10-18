import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hash, processBook } from '../scripts/corpus.mjs';
import { prepareLongPassage, prepareGutenbergLongReading } from '../scripts/gutenberg-long-reading.mjs';

const corpus = JSON.parse(await readFile('content/corpus/gutenberg.json', 'utf8'));
const scopes = JSON.parse(await readFile('content/corpus/gutenberg-long-scopes.json', 'utf8'));
const policy = await readFile('content/corpus/gutenberg-license.html', 'utf8');
const sources = await Promise.all(scopes.records.map(async scope => ({ scope,
  record: corpus.records.find(record => record.rootId === `gutenberg-book-${scope.bookId}`),
  raw: await readFile(`content/corpus/raw/pg${scope.bookId}.txt`, 'utf8'),
  metadata: await readFile(`content/corpus/raw/pg${scope.bookId}-metadata.html`, 'utf8'),
})));

test('actual prepared long Gutenberg excerpts retain exact acquired continuity and every existing short passage', async () => {
  for (const { record, scope, raw, metadata } of sources) {
    const passage = prepareLongPassage(record, scope, raw, metadata, policy);
    assert.equal(hash(passage.text), scope.textSha256);
    assert.equal(passage.wordCount, scope.words);
    assert.equal(passage.language, undefined);
    assert.equal(record.originalText, undefined);
    for (const original of processBook(raw)) {
      const preserved = record.passages.find(item => item.id === original.id);
      assert(preserved);
      assert.equal(preserved.text, original.text);
      assert.equal(preserved.wordCount, original.wordCount);
    }
    for (const id of scope.passages) assert(passage.text.includes(record.passages.find(short => short.id === id).text));
    assert.deepEqual(record.passages.find(item => item.id === passage.id), passage);
  }
  const prepared = await prepareGutenbergLongReading(true);
  assert.deepEqual(prepared, corpus);
  assert.deepEqual(sources.map(({ scope }) => scope.words), [986, 1051, 924, 702, 705, 1012, 745]);
});

test('long source preparation rejects hash, rights, context, ordering and source boundary changes', () => {
  for (const { record, scope, raw, metadata } of sources) {
    for (const change of [
      item => { item.rawSha256 = '0'.repeat(64); },
      item => { item.metadataSha256 = '0'.repeat(64); },
      item => { item.policySha256 = '0'.repeat(64); },
      item => { item.canonicalSha256 = '0'.repeat(64); },
      item => { item.textSha256 = '0'.repeat(64); },
      item => { item.start += 1; },
      item => { item.end -= 1; },
      item => { item.words -= 1; },
      item => { item.start = 1.5; },
      item => { item.context.beforeSha256 = '0'.repeat(64); },
      item => { item.context.afterEnd += 1; },
      item => { item.passages.reverse(); },
      item => { item.passages.pop(); },
      item => { item.passages[1] = item.passages[0]; },
      item => { item.decision = 'withheld'; },
      item => { item.reviewer = 'unreviewed'; },
    ]) {
      const changed = structuredClone(scope); change(changed);
      assert.throws(() => prepareLongPassage(record, changed, raw, metadata, policy), /INVALID_GUTENBERG_LONG_SCOPE/);
    }
    assert.throws(() => prepareLongPassage(record, scope, raw + 'changed', metadata, policy), /INVALID_GUTENBERG_LONG_SCOPE/);
    for (const change of [
      item => { item.rootId = 'gutenberg-book-1'; },
      item => { item.permissionReview = 'globally approved'; },
      item => { item.licence = 'CC0'; },
      item => { item.passages.find(passage => passage.id === scope.passages[0]).text += ' invented text'; },
    ]) {
      const changed = structuredClone(record); change(changed);
      assert.throws(() => prepareLongPassage(changed, scope, raw, metadata, policy), /INVALID_GUTENBERG_LONG_SCOPE/);
    }
  }
});

test('existing bounded NLP annotations project onto their unchanged long source positions', () => {
  const { record, scope, raw, metadata } = sources[0], annotated = structuredClone(record);
  for (const id of scope.passages) {
    const passage = annotated.passages.find(item => item.id === id), match = /\b[a-z]{6,14}\b/.exec(passage.text);
    passage.language = { generator: 'spacy-3.8.16/en_core_web_sm-3.8.0', modelSha256: 'a'.repeat(64), reviewStatus: 'pending',
      tokens: [{ start: match.index, end: match.index + match[0].length, lemma: match[0], pos: 'NOUN' }] };
  }
  const prepared = prepareLongPassage(annotated, scope, raw, metadata, policy);
  assert.equal(prepared.language.tokens.length, scope.passages.length);
  for (const [index, token] of prepared.language.tokens.entries()) {
    const short = annotated.passages.find(item => item.id === scope.passages[index]), original = short.language.tokens[0];
    assert.equal(prepared.text.slice(token.start, token.end), short.text.slice(original.start, original.end));
    assert.equal(token.start, prepared.text.indexOf(short.text) + original.start);
  }
});

test('a changed second source cannot partially overwrite the prepared corpus', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'lingfern-gutenberg-scope-'));
  try {
    await mkdir(join(directory, 'content/corpus/raw'), { recursive: true });
    const preparedPath = join(directory, 'content/corpus/gutenberg.json');
    const pending = structuredClone({ version: 1, failures: [], records: sources.map(({ record }) => record) });
    for (const record of pending.records) record.passages = record.passages.filter(passage => passage.wordCount <= 700);
    const original = JSON.stringify(pending);
    await writeFile(preparedPath, original);
    const changed = structuredClone(scopes);
    changed.records[1].rawSha256 = '0'.repeat(64);
    await writeFile(join(directory, 'content/corpus/gutenberg-long-scopes.json'), JSON.stringify(changed));
    await writeFile(join(directory, 'content/corpus/gutenberg-license.html'), policy);
    for (const { scope, raw, metadata } of sources) {
      await writeFile(join(directory, `content/corpus/raw/pg${scope.bookId}.txt`), raw);
      await writeFile(join(directory, `content/corpus/raw/pg${scope.bookId}-metadata.html`), metadata);
    }
    const result = spawnSync(process.execPath, [resolve('scripts/gutenberg-long-reading.mjs')], { cwd: directory, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /INVALID_GUTENBERG_LONG_SCOPE/);
    assert.equal(await readFile(preparedPath, 'utf8'), original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
