import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { sha, readFrozenSources, paragraphOffsets } from './open-reading-corpus.mjs';
import { corpusShards } from './corpus-shards.mjs';

// Pin only after the independent edition, rights and source review is frozen.
export const gutenbergExpansionReviewSha256 = '2f85bd8d990ea153efb28878a3ddf670ddfbbf89473739ee299e07a07dbe04e6';
export async function prepareGutenbergExpansion(corpus) {
  const bytes = await readFile('content/corpus/gutenberg-expansion-source-review.json');
  if (!gutenbergExpansionReviewSha256 || sha(bytes) !== gutenbergExpansionReviewSha256) throw Error('GUTENBERG_EXPANSION_REVIEW');
  const review = JSON.parse(bytes);
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || !review.scope || !Array.isArray(review.excludedPassageIds)
    || sha(await readFile(review.independentReviewPath)) !== review.independentReviewSha256) throw Error('GUTENBERG_EXPANSION_REVIEW');
  if (review.acquisitionEvidence && sha(await readFile(review.acquisitionEvidence.metadataPath)) !== review.acquisitionEvidence.sha256) throw Error('GUTENBERG_EXPANSION_ACQUISITION');
  if (sha(await readFile(review.independentConfigPath)) !== review.independentConfigSha256) throw Error('GUTENBERG_EXPANSION_REVIEW');
  const data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  for (const [name, expected] of [['prepared.json', review.preparedSha256], ['source-ledger.json', review.sourceLedgerSha256], ['exclusions.jsonl', review.exclusionsSha256], ['raw/gutenberg-license.html', review.licenseSha256]]) {
    if (!expected || !data.has(name) || sha(data.get(name)) !== expected) throw Error('GUTENBERG_EXPANSION_HASH');
  }
  const rows = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const excluded = new Set(review.excludedPassageIds), rowIds = new Set(rows.map(row => row.id));
  if (rowIds.size !== rows.length || excluded.size !== review.excludedPassageIds.length || [...excluded].some(id => !rowIds.has(id))) throw Error('GUTENBERG_EXPANSION_EXCLUSIONS');
  const held = data.get('exclusions.jsonl').toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const chapters = JSON.parse(data.get('chapters.json'));
  const coordinates = [...rows, ...held].map(row => `${row.workId}\0${row.paragraphIndex}`);
  if (new Set(coordinates).size !== coordinates.length || coordinates.length !== chapters.reduce((n, chapter) => n + chapter.paragraphs, 0)) throw Error('GUTENBERG_EXPANSION_CONSERVATION');
  for (const row of [...rows, ...held]) {
    const canonical = new TextDecoder('utf-8', { fatal: true }).decode(data.get(row.canonicalPath));
    const parts = canonical.split('\n\n'), prefix = parts.slice(0, row.paragraphIndex).join('\n\n') + (row.paragraphIndex ? '\n\n' : '');
    if (parts[row.paragraphIndex] !== row.text || sha(row.text) !== row.textSha256 || Array.from(prefix).length !== row.start
      || row.end !== row.start + Array.from(row.text).length || prefix.length !== row.sourceStart || row.sourceEnd !== prefix.length + row.text.length
      || sha(data.get(row.rawPath)) !== row.sourceHash || sha(data.get(row.canonicalPath)) !== row.canonicalSha256) throw Error('GUTENBERG_EXPANSION_CONSERVATION');
  }
  if (new Set(review.books.map(book => book.id)).size !== review.books.length) throw Error('GUTENBERG_EXPANSION_SOURCE');
  const incomingRoots = new Set(review.books.map(book => book.rootId));
  const previousHashes = new Set(corpus.records.filter(record => !incomingRoots.has(record.rootId)).flatMap(record => record.passages.map(passage => sha(passage.text.replace(/\s+/g, ' ').trim()))));
  const previousRoots = new Set(corpus.records.map(record => record.rootId)), admitted = new Set();
  const acquisition = JSON.parse(await readFile(review.acquisitionEvidence.metadataPath));
  if (acquisition.archiveSha256 !== review.archiveSha256 || review.selectedEligible.length !== rows.length - excluded.size
    || review.selectedEligible.some(selected => !rows.some(row => row.id === selected.id && !excluded.has(row.id) && row.textSha256 === selected.textSha256 && row.workId === selected.workId && row.paragraphIndex === selected.paragraphIndex && row.sourceStart === selected.sourceStart && row.sourceEnd === selected.sourceEnd))) throw Error('GUTENBERG_EXPANSION_REVIEW');
  const records = review.books.map(book => {
    const source = ledger.find(row => row.workId === book.id), number = book.id.slice('gutenberg-'.length);
    if (!['2530', '14474', '1408'].includes(number) || !source || source.rootId !== book.rootId || book.rootId !== `gutenberg-book-${number}`
      || source.bookSourceHash !== book.sourceHash || source.originalUrl !== book.originalUrl
      || book.originalUrl !== `https://www.gutenberg.org/ebooks/${number}` || book.downloadUrl !== `https://www.gutenberg.org/cache/epub/${number}/pg${number}.txt`
      || source.metadataPath !== book.metadataPath || source.metadataSha256 !== book.metadataSha256
      || sha(data.get(book.metadataPath)) !== book.metadataSha256 || !book.permissionReview?.scope || !book.permissionReview?.decision
      || book.licenceUrl !== 'https://www.gutenberg.org/policy/license.html' || !book.licence.includes('USA')) throw Error('GUTENBERG_EXPANSION_SOURCE');
    const capture = acquisition.rows.find(row => row.workId === book.id);
    if (!capture || capture.sourceHash !== book.sourceHash || capture.acquiredAt !== book.acquiredAt) throw Error('GUTENBERG_EXPANSION_ACQUISITION');
    const passages = rows.filter(row => row.workId === book.id && !excluded.has(row.id)).map(row => {
      if (row.rootId !== book.rootId || row.sourceHash !== book.sourceHash || row.sourceUrl !== book.downloadUrl
        || row.rawPath !== `raw/pg${number}.txt` || sha(data.get(row.rawPath)) !== book.sourceHash
        || row.canonicalPath !== source.canonicalPath || sha(data.get(row.canonicalPath)) !== row.canonicalSha256
        || row.canonicalSha256 !== source.canonicalSha256 || row.licenceUrl !== book.licenceUrl
        || row.id !== sha(`${row.workId}\0${row.locator}\0${row.paragraphIndex}\0${row.text}`)
        || row.preparationStatus !== 'complete-source-paragraph-structural-ready-USA-only-rights-pending-other-territories') throw Error('GUTENBERG_EXPANSION_PARAGRAPH');
      const offsets = paragraphOffsets(new TextDecoder('utf-8', { fatal: true }).decode(data.get(row.canonicalPath)), row);
      if (offsets.sourceStart !== row.sourceStart || offsets.sourceEnd !== row.sourceEnd) throw Error('GUTENBERG_EXPANSION_UTF16');
      const id = sha(row.text), normalized = sha(row.text.replace(/\s+/g, ' ').trim());
      if (previousHashes.has(normalized) || admitted.has(normalized)) throw Error('GUTENBERG_EXPANSION_DUPLICATE_TEXT');
      admitted.add(normalized);
      return { id, text: row.text, wordCount: row.wordCount };
    });
    if (!passages.length || passages.length !== book.paragraphCount) throw Error('GUTENBERG_EXPANSION_COUNT');
    return { id: book.id, rootId: book.rootId, title: book.title, authors: book.authors, originalUrl: book.originalUrl, downloadUrl: book.downloadUrl,
      acquiredAt: book.acquiredAt, language: 'en', licence: book.licence, licenceUrl: book.licenceUrl, attribution: book.attribution,
      sourceHash: book.sourceHash, reviewStatus: 'draft', permissionReview: `${book.permissionReview.reviewer}: ${book.permissionReview.decision}. ${book.permissionReview.scope}`,
      editorialReview: 'pending', processing: 'Cloud-prepared complete native paragraphs; raw edition, metadata, full licence, exclusions and exact codepoint/UTF16 boundaries verified. Historic source prose; no current scientific or worldwide rights assertion. Questions generated locally.', passages };
  });
  if (new Set(records.map(record => record.rootId)).size !== records.length || rows.some(row => !excluded.has(row.id) && !records.some(record => record.id === row.workId))) throw Error('GUTENBERG_EXPANSION_UNLISTED');
  for (const record of records) {
    const existing = corpus.records.filter(source => source.rootId === record.rootId);
    if (existing.length > 1 || existing.length && JSON.stringify(existing[0]) !== JSON.stringify(record)) throw Error('GUTENBERG_EXPANSION_CHANGED_ROOT');
  }
  const expanded = { ...corpus, records: [...corpus.records, ...records.filter(record => !previousRoots.has(record.rootId))] };
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { corpusSchema } = await server.ssrLoadModule('/src/core/corpus.ts');
    for (const shard of corpusShards(expanded)) corpusSchema.parse(JSON.parse(shard));
  } finally { await server.close(); }
  const outputs = review.books.flatMap(book => {
    const number = book.id.slice('gutenberg-'.length);
    return [`raw/pg${number}.txt`, book.metadataPath].map(path => ({ path: `content/corpus/${path}`, bytes: data.get(path), sha256: sha(data.get(path)) }));
  });
  outputs.push({ path: 'content/corpus/raw/gutenberg-expansion-license.html', bytes: data.get('raw/gutenberg-license.html'), sha256: review.licenseSha256 });
  return { corpus: expanded, review, outputs };
}
