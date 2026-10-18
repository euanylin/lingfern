import { createHash } from 'node:crypto';
import { writeCorpusShards } from './corpus-shards.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { prepareOpenReading } from './open-reading-corpus.mjs';
import { prepareGutenbergLongReading } from './gutenberg-long-reading.mjs';
import { prepareGutenbergBeginnerReading } from './gutenberg-beginner-reading.mjs';
const { prepareUSGS } = await import('./additional-corpus.mjs');
await prepareGutenbergBeginnerReading(false, false);
await prepareUSGS(false);
await prepareOpenReading();
await prepareUSGS();
await prepareGutenbergLongReading();
await prepareGutenbergBeginnerReading();
const { prepareGutenbergExpansion } = await import('./gutenberg-expansion.mjs');
const gutenbergExpansion = await prepareGutenbergExpansion(JSON.parse(await readFile('content/corpus/gutenberg.json', 'utf8')));
const corpus = gutenbergExpansion.corpus;
await mkdir('content/corpus/raw', { recursive: true });
for (const output of gutenbergExpansion.outputs) {
  await writeFile(output.path, output.bytes);
}
await writeFile('content/corpus/gutenberg.json', JSON.stringify(corpus, null, 2) + '\n');
const sourceTopics = JSON.parse(await readFile('content/corpus/source-topics.json', 'utf8'));
const newBookRoots = new Set(gutenbergExpansion.review.books.map(book => book.rootId));
sourceTopics.records = [...sourceTopics.records.filter(record => !newBookRoots.has(record.rootId)), ...gutenbergExpansion.review.books.map(book => ({ rootId: book.rootId, sourceHash: book.sourceHash, topic: book.topic, provenance: { url: book.originalUrl, policyUrl: book.licenceUrl, method: 'Hash-bound historical original book subject, edition and rights reviewed by Codex/AI.' } }))];
await writeFile('content/corpus/source-topics.json', JSON.stringify(sourceTopics, null, 2) + '\n');
const directory = 'public/corpus';
await mkdir(directory, { recursive: true });
await writeCorpusShards('gutenberg', corpus);
const licence = await readFile('content/corpus/gutenberg-license.html', 'utf8');
const text = licence.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n\s*\n/g, '\n\n');
await writeFile(`${directory}/LICENSE.txt`, `Source: https://www.gutenberg.org/policy/license.html\n\n${text.trim()}\n`);
const excerpts = JSON.parse(await readFile('content/corpus/voa-excerpts.json', 'utf8'));
const digest = text => createHash('sha256').update(text).digest('hex');
const review = JSON.parse(await readFile('content/corpus/voa-review.json', 'utf8'));
const accepted = excerpts.records.filter(record => {
  const decision = review.records.find(item => item.id === record.id);
  if (!decision || decision.sourceHash !== digest(record.text) || !['accepted-text', 'withheld'].includes(decision.decision)) throw new Error('CORPUS_REVIEW_MISMATCH');
  return decision.decision === 'accepted-text';
});
const voa = { version: 1, failures: [], records: accepted.map(record => ({
  id: `voa-${record.id}`, rootId: `voa-article-${record.id}`, title: record.title, authors: [record.author], originalUrl: record.url, downloadUrl: record.url, acquiredAt: excerpts.acquiredAt, language: 'en',
  licence: 'Original VOA Learning English text: public domain with attribution. No agency content, reader letters, images or audio included.', licenceUrl: excerpts.permissionUrl,
  attribution: `${record.title} — ${record.author}. VOA Learning English (${record.url}).`, sourceHash: digest(record.text), reviewStatus: 'draft', permissionReview: 'Official own-author byline and Learning English permission checked; excerpt only.', editorialReview: 'pending', processing: 'Contiguous official-page excerpt, preserving words and paragraph boundaries. Reader letter and unrelated site content excluded. No audio acquisition.',
  passages: [{ id: digest(record.text), text: record.text, wordCount: record.wordCount }],
})) };
await writeFile(`${directory}/voa.json`, JSON.stringify(voa) + '\n');
const { prepareAdditionalVOA } = await import('./additional-voa.mjs');
await prepareAdditionalVOA();
await import('./beginner-corpus.mjs');
const preparedVOA = JSON.parse(await readFile(`${directory}/voa.json`, 'utf8'));
const additional = JSON.parse(await readFile('content/corpus/additional.json', 'utf8'));
const { prepareReadingExpansion } = await import('./reading-expansion.mjs');
const expanded = await prepareReadingExpansion(preparedVOA, additional);
preparedVOA.records = expanded.voa.records;
additional.records = expanded.additional.records;
await writeFile('content/corpus/voa.json', JSON.stringify(preparedVOA, null, 2) + '\n');
await writeFile('content/corpus/additional.json', JSON.stringify(additional, null, 2) + '\n');
await writeCorpusShards('voa', preparedVOA);
await writeCorpusShards('additional', additional);
const topics = JSON.parse(await readFile('content/corpus/additional-topics.json', 'utf8'));
const incomingRoots = new Set(expanded.review.sources.map(source => source.rootId));
topics.records = [...topics.records.filter(record => !incomingRoots.has(record.rootId)), ...expanded.review.sources.map(source => ({ rootId: source.rootId, sourceHash: source.sourceHash, topic: source.topic,
  provenance: { url: source.originalUrl, policyUrl: source.licenceUrl, method: 'Hash-bound article source, permission and native-paragraph scope review by Codex/AI.' } }))];
await writeFile('content/corpus/additional-topics.json', JSON.stringify(topics, null, 2) + '\n');
await writeFile(`${directory}/reading-expansion-NOTICE.md`, expanded.review.sources.map(source => source.attribution + '\n' + source.licence).join('\n\n') + '\nOriginal text only; third-party content, media and excluded scopes are retained privately, outside learning selection.\n');
await writeFile(`${directory}/VOA-LICENSE.txt`, 'Source: https://learningenglish.voanews.com/p/6861.html\nVOA Learning English original texts may be reprinted for educational and commercial purposes with credit. Agency content is excluded. This package contains credited own-author prose and conversations, with no images, reader letters, third-party song lyrics or audio. Codex source text inspection is recorded in content/corpus/voa-review.json, content/corpus/voa-beginner-review.json and content/corpus/voa-additional-sources.json; no audio included.\n');
await writeFile('content/corpus/voa-report.json', JSON.stringify({ sources: preparedVOA.records.length, passages: preparedVOA.records.reduce((sum, record) => sum + record.passages.length, 0), beginnerDialogueSources: preparedVOA.records.filter(record => record.passages.some(passage => passage.startingPoints)).length, words: preparedVOA.records.reduce((sum, item) => sum + item.passages.reduce((total, passage) => total + passage.wordCount, 0), 0), completeArticles: 0, audio: 0, reviewedExercises: 0, withheld: excerpts.records.length - accepted.length, reviewer: review.reviewer, published: false }, null, 2) + '\n');
await writeFile('content/corpus/catalogue.json', JSON.stringify([...corpus.records, ...preparedVOA.records, ...additional.records].map(({ id, title, authors, originalUrl }) => ({ id, title, authors, originalUrl })), null, 2) + '\n');
console.log(`Prepared ${corpus.records.length} Gutenberg source records plus ${preparedVOA.records.length} VOA texts and ${additional.records.length} agency-text records; ${corpus.records.reduce((sum, record) => sum + record.passages.length, 0)} local draft excerpts. No publication or whole-source editorial approval.`);
