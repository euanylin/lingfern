import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { articleIdentity } from './spoken-corpus.mjs';

// Private preprocessing acceptance, never editorial approval or a publish operation.
const directory = new URL('../private/corpus/spoken/', import.meta.url);
const { records } = JSON.parse(await readFile(new URL('processed.json', directory), 'utf8'));
const report = JSON.parse(await readFile(new URL('../content/corpus/spoken-processing-report.json', import.meta.url), 'utf8'));
assert.equal(report.complete, true);
assert.equal(records.length, report.processedArticleAudioPairs);
assert.equal(new Set(records.map(record => record.rootId)).size, records.length);
assert.equal(new Set(records.map(record => record.fileId)).size, records.length);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let words = 0, seconds = 0;
const byRoot = new Map();
// Four independent source/audio pairs at a time; bounded memory, unchanged source order.
for (let offset = 0; offset < records.length; offset += 4) {
  const batch = records.slice(offset, offset + 4);
  const results = await Promise.allSettled(batch.map(async record => {
    const [html, audio] = await Promise.all([
      readFile(new URL(`articles/${record.revision}.html`, directory)),
      readFile(new URL(`audio/${record.fileId}.ogg`, directory)),
    ]);
    assert.equal(digest(html), record.articleSha256, record.rootId);
    articleIdentity(new TextDecoder('utf-8', { fatal: true }).decode(html), record.revision, record.title);
    assert.equal(digest(audio), record.audioSha256, record.rootId);
    assert.equal(digest(record.text), record.textSha256, record.rootId);
    assert.equal(record.audioDecodeStatus, 'full-file verified');
    assert(record.decodedDuration > 0 && Number.isFinite(record.decodedDuration));
    assert.equal(record.wordCount, record.text.split(/\s+/).length);
    assert(record.articleUrl && record.audioSourceUrl && record.textAttribution && record.artistHtml && record.licence);
    assert.equal(record.editorialReview, 'pending');
  }));
  const failures = results.flatMap((result, index) => result.status === 'rejected'
    ? [new Error(`${batch[index].rootId}: ${result.reason.message}`, { cause: result.reason })] : []);
  if (failures.length) throw new AggregateError(failures, 'Source batch verification failed; reports were not replaced.');
  for (const record of batch) {
    words += record.wordCount; seconds += record.decodedDuration;
    byRoot.set(record.rootId, record);
  }
}
assert.equal(words, report.words);
assert(Math.abs(seconds - report.totalAudioSeconds) < 0.001);
const alignment = JSON.parse(await readFile(new URL('alignment-candidates.json', directory), 'utf8'));
const alignedRoots = new Set();
let segments = 0;
for (const candidate of alignment.records) {
  const source = byRoot.get(candidate.rootId);
  assert(source && !alignedRoots.has(candidate.rootId));
  alignedRoots.add(candidate.rootId);
  assert.equal(candidate.textSha256, source.textSha256);
  assert.equal(candidate.audioSha256, source.audioSha256);
  assert.equal(candidate.offsetUnit, 'utf16-code-units');
  let textEnd = 0, audioEnd = 0;
  for (const span of candidate.segments) {
    assert(Number.isInteger(span.start) && Number.isInteger(span.end));
    assert(span.start >= textEnd && span.end > span.start);
    assert.equal(source.text.slice(span.start, span.end), span.text);
    assert(span.audioStart >= audioEnd && span.audioEnd > span.audioStart && span.audioEnd <= source.decodedDuration);
    textEnd = span.end; audioEnd = span.audioEnd; segments++;
  }
}
const result = { checkedAt: new Date().toISOString(), distinctArticleAudioPairs: records.length, words, audioHours: seconds / 3600, unchangedVerifiedFullAudioFiles: records.length, alignedRoots: alignedRoots.size, exactSourceSegments: segments, independentlyReviewed: 0, published: false };
await writeFile(new URL('../content/corpus/spoken-integrity-report.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
// CSV contains provenance and triage metadata only, never learners' records or ASR output.
const columns = ['rootId', 'title', 'wordCount', 'decodedDuration', 'articleUrl', 'audioSourceUrl', 'textLicence', 'licence', 'qualityFlags', 'editorialReview'];
const cell = value => '"' + String(Array.isArray(value) ? value.join('; ') : value).replaceAll('"', '""') + '"';
await writeFile(new URL('inventory.csv', directory), [columns.join(','), ...records.map(record => columns.map(key => cell(record[key])).join(','))].join('\n') + '\n');
console.log(JSON.stringify(result));
