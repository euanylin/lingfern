import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { sha, readFrozenSources, paragraphOffsets } from './open-reading-corpus.mjs';
import { corpusShards } from './corpus-shards.mjs';

export const sourceReviewSha256 = 'a25832fbff83393a1be3a12e3d256203b9740254adea7f33c28359ca9316266f';
/** Source acceptance is hash-bound; generated questions remain client rules. */
export async function prepareReadingExpansion(voa, additional) {
  const bytes = await readFile('content/corpus/reading-expansion-source-review.json');
  if (!sourceReviewSha256 || sha(bytes) !== sourceReviewSha256) throw Error('READING_EXPANSION_REVIEW');
  const review = JSON.parse(bytes);
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || !review.scope || !Array.isArray(review.excludedPassageIds)) throw Error('READING_EXPANSION_REVIEW');
  if (sha(await readFile(review.independentReviewPath)) !== review.independentReviewSha256) throw Error('READING_EXPANSION_REVIEW');
  if (sha(await readFile(review.acquisitionEvidence.metadataPath)) !== review.acquisitionEvidence.sha256) throw Error('READING_EXPANSION_ACQUISITION');
  const data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  if (sha(data.get('prepared.json')) !== review.preparedSha256 || sha(data.get('source-ledger.json')) !== review.sourceLedgerSha256) throw Error('READING_EXPANSION_HASH');
  const rows = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const excluded = new Set(review.excludedPassageIds);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error('READING_EXPANSION_DUPLICATE_PASSAGE');
  if (excluded.size !== review.excludedPassageIds.length || [...excluded].some(id => !rows.some(row => row.id === id))) throw Error('READING_EXPANSION_EXCLUSIONS');
  const records = review.sources.map(source => {
    const evidence = ledger.find(row => row.workId === source.id);
    if (!/^(?:voa|frontiers|plos)-/.test(source.id) || !evidence || evidence.rootId !== source.rootId || evidence.sourceHash !== source.sourceHash
      || evidence.sourceUrl !== source.originalUrl || !source.authorEvidence?.length
      || source.authorEvidence.some(item => !data.has(item.rawPath) || sha(data.get(item.rawPath)) !== item.sha256)) throw Error('READING_EXPANSION_SOURCE');
    const passages = rows.filter(row => row.workId === source.id && !excluded.has(row.id)).map(row => {
      if (row.id !== sha(row.text) || row.rootId !== source.rootId || row.sourceHash !== source.sourceHash || row.sourceUrl !== source.originalUrl
        || row.preparationStatus !== 'complete-source-paragraph-structural-ready' || sha(data.get(row.rawPath)) !== row.sourceHash
        || sha(data.get(row.canonicalPath)) !== row.canonicalSha256) throw Error('READING_EXPANSION_PARAGRAPH');
      paragraphOffsets(new TextDecoder('utf-8', { fatal: true }).decode(data.get(row.canonicalPath)), row);
      return { id: row.id, text: row.text, wordCount: row.wordCount };
    });
    if (!passages.length || passages.length !== source.paragraphCount || new Set(passages.map(passage => passage.id)).size !== passages.length) throw Error('READING_EXPANSION_COUNT');
    return { id: source.id, rootId: source.rootId, title: source.title, authors: source.authors, attribution: source.attribution,
      originalUrl: source.originalUrl, downloadUrl: source.originalUrl, acquiredAt: source.acquiredAt, language: 'en',
      licence: source.licence, licenceUrl: source.licenceUrl, sourceHash: source.sourceHash, reviewStatus: 'draft', permissionReview: `${source.permissionReview.reviewer}: ${source.permissionReview.decision}. ${source.permissionReview.scope} ${source.permissionReview.acquisitionTimeScope}`,
      editorialReview: 'pending', processing: 'Cloud-prepared complete native paragraphs. Raw and canonical hashes, native offsets and exclusions verified. No media or joined originalText; questions generated locally. No CEFR calibration or audio acceptance.', passages };
  });
  if (rows.some(row => !excluded.has(row.id) && !records.some(record => record.id === row.workId))) throw Error('READING_EXPANSION_UNLISTED');
  const roots = new Set(records.map(record => record.rootId));
  if (roots.size !== records.length) throw Error('READING_EXPANSION_DUPLICATE_ROOT');
  for (const bank of [voa, additional]) for (const record of bank.records) {
    const incoming = records.find(source => source.rootId === record.rootId);
    if (incoming && incoming.sourceHash !== record.sourceHash) throw Error('READING_EXPANSION_CHANGED_ROOT');
  }
  const result = { voa: { ...voa, records: [...voa.records.filter(record => !roots.has(record.rootId)), ...records.filter(record => record.id.startsWith('voa-'))] },
    additional: { ...additional, records: [...additional.records.filter(record => !roots.has(record.rootId)), ...records.filter(record => !record.id.startsWith('voa-'))] } };
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { corpusSchema } = await server.ssrLoadModule('/src/core/corpus.ts');
    const { topicSchema } = await server.ssrLoadModule('/src/shared/content.ts');
    for (const source of review.sources) topicSchema.parse(source.topic);
    for (const bank of [result.voa, result.additional]) for (const bytes of corpusShards(bank)) corpusSchema.parse(JSON.parse(bytes));
  } finally { await server.close(); }
  return { ...result, review };
}
