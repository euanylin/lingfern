import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha, readFrozenSources, paragraphOffsets, beginnerOffsets } from './open-reading-corpus.mjs';
export const bccampusSourceReviewSha256 = 'fbdd2c6913afd7c78dd7b2e12e1a013738f5de5de22b8d0671bd37377500aa32';
export const bccampusBeginnerReviewSha256 = 'ff8af72a0b6904697752dcc0a62df60268ed901ec874313fcf839fe51c8860ed';
const readJson = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
function chapterMetadata(raw) {
  const match = raw.toString('utf8').match(/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  if (!match) throw Error('BCCAMPUS_CHAPTER_RIGHTS');
  return JSON.parse(match[1]);
}
/** Original frozen cloud native paragraphs; source approvals never generate authored exercises. */
export async function prepareBccampusReading(shared) {
  const bytes = await readFile('content/corpus/bccampus-source-review.json');
  const beginnerBytes = await readFile('content/corpus/bccampus-beginner-source-review.json');
  if (sha(bytes) !== bccampusSourceReviewSha256 || sha(beginnerBytes) !== bccampusBeginnerReviewSha256) throw Error('BCCAMPUS_REVIEW');
  const review = readJson(bytes), beginner = readJson(beginnerBytes);
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || review.books.length !== 4 || review.paragraphIds.length !== 18
    || beginner.reviewer !== 'Codex/AI' || beginner.scopes.length !== 4 || beginner.decision !== 'supported-beginner-text'
    || sha(await readFile(review.independentReviewPath)) !== review.independentReviewSha256) throw Error('BCCAMPUS_REVIEW');
  const timeBytes = await readFile(review.captureTimesPath);
  if (sha(timeBytes) !== review.captureTimesSha256 || sha(await readFile(review.sourceArchivePath)) !== review.sourceArchiveSha256) throw Error('BCCAMPUS_CAPTURE_TIME');
  const times = readJson(timeBytes);
  if (times.archiveSha256 !== review.sourceArchiveSha256 || times.timezoneEvidence.verifiedMappings !== 481) throw Error('BCCAMPUS_CAPTURE_TIME');
  const approvedBytes = await readFile(review.approvedRowsPath);
  if (sha(approvedBytes) !== review.approvedRowsSha256) throw Error('BCCAMPUS_APPROVAL_ROWS');
  const approved = readJson(approvedBytes), data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  if (sha(data.get('prepared.json')) !== review.preparedSha256 || sha(data.get('source-ledger.json')) !== review.sourceLedgerSha256) throw Error('BCCAMPUS_METADATA_HASH');
  const prepared = readJson(data.get('prepared.json')), holds = data.get('exclusions.jsonl').toString('utf8').trim().split('\n').map(JSON.parse), ledger = readJson(data.get('source-ledger.json'));
  const excluded = new Set(review.excludedPassageIds), ids = new Set(approved.map(row => row.id));
  if (ids.size !== 18 || JSON.stringify(approved.map(row => row.id)) !== JSON.stringify(review.paragraphIds)
    || excluded.size !== 21 || prepared.length !== 35 || holds.length !== 2555
    || prepared.some(row => !ids.has(row.id) && !excluded.has(row.id)) || [...excluded].some(id => ids.has(id) || !prepared.some(row => row.id === id))) throw Error('BCCAMPUS_CONSERVATION');
  const records = review.books.map(book => {
    const edition = shared.openReadingEdition(book.id), evidence = ledger.find(row => row.workId === book.id), home = data.get(book.homeRawPath);
    if (!edition || !evidence || edition.rootId !== book.rootId || evidence.rootId !== edition.rootId || evidence.bookSourceHash !== book.sourceHash
      || edition.sourceHash !== book.sourceHash || book.homeRawSha256 !== book.sourceHash || !home || sha(home) !== book.homeRawSha256
      || evidence.originalUrl !== shared.openReadingBookUrl(edition) || evidence.licenceUrl !== shared.openReadingLicenceUrl
      || evidence.schemaMetadata.license.url !== shared.openReadingLicenceUrl || evidence.schemaMetadata.copyrightHolder.name !== book.copyrightHolder) throw Error('BCCAMPUS_BOOK_RIGHTS');
    const capture = times.rows.find(row => row.workId === book.id);
    if (!capture || capture.sourceHash !== book.sourceHash || capture.rawPath !== book.homeRawPath || capture.acquiredAt !== book.acquiredAt || capture.timeSemantics !== review.timeSemantics) throw Error('BCCAMPUS_CAPTURE_TIME');
    const originalAuthors = book.id === 'bccampus-introduction-tourism-hospitality' ? evidence.schemaMetadata.contributor : evidence.schemaMetadata.author;
    if (JSON.stringify(originalAuthors.map(author => author.name)) !== JSON.stringify(book.authors)
      || !book.authors.length || book.authors.length > 32 || book.authors.join('; ').length > 1000 || book.attribution.length > 1000
      || !home.toString('utf8').includes(shared.openReadingLicenceUrl) || !book.authorEvidence.length
      || book.authorEvidence.some(item => !data.has(item.rawPath) || sha(data.get(item.rawPath)) !== item.sha256)) throw Error('BCCAMPUS_AUTHORS');
    const passages = approved.filter(row => row.workId === book.id).map(row => {
      const raw = data.get(row.rawPath), canonicalBytes = data.get(row.canonicalPath), scope = beginner.scopes.find(scope => scope.id === row.id);
      if (!raw || !canonicalBytes || sha(raw) !== row.sourceHash || sha(canonicalBytes) !== row.canonicalSha256 || row.rootId !== edition.rootId
        || row.id !== sha(`${row.workId}\0${row.locator}\0${row.paragraphIndex}\0${row.text}`)
        || !shared.validOpenReadingChapter(row.workId, row.sourceUrl, row.locator)) throw Error('BCCAMPUS_PARAGRAPH_HASH');
      const meta = chapterMetadata(raw);
      if (meta['@type'] !== 'Chapter' || meta.license?.url !== shared.openReadingLicenceUrl) throw Error('BCCAMPUS_CHAPTER_RIGHTS');
      const canonical = new TextDecoder('utf-8', { fatal: true }).decode(canonicalBytes);
      let provenance;
      if (scope) {
        const held = holds.find(item => item.workId === row.workId && item.locator === row.locator && item.paragraphIndex === row.paragraphIndex);
        if (!held || held.reason !== 'below-current-reading-schema-120-words' || held.text !== row.text || held.textSha256 !== row.textSha256
          || !shared.validOpenReadingBeginnerScope(scope) || JSON.stringify(row.startingPoints) !== JSON.stringify(scope.startingPoints)
          || beginnerOffsets(canonical, scope) !== row.text) throw Error('BCCAMPUS_BEGINNER_SCOPE');
        provenance = scope.sourceProvenance;
      } else {
        const original = prepared.find(item => item.id === row.id);
        if (!original || original.text !== row.text || original.preparationStatus !== 'complete-source-paragraph-structural-ready'
          || original.licenceUrl !== shared.openReadingLicenceUrl || row.startingPoints) throw Error('BCCAMPUS_ORDINARY_SCOPE');
        const offsets = paragraphOffsets(canonical, row);
        provenance = { workId: row.workId, chapter: row.chapter, locator: row.locator, sourceUrl: row.sourceUrl,
          rawSha256: row.sourceHash, canonicalSha256: row.canonicalSha256, paragraphIndex: row.paragraphIndex,
          codePointStart: row.start, codePointEnd: row.end, ...offsets, textSha256: row.textSha256 };
      }
      return { id: row.id, text: row.text, wordCount: row.wordCount, ...(scope ? { startingPoints: scope.startingPoints } : {}), sourceProvenance: provenance };
    });
    if (passages.length !== book.paragraphCount || JSON.stringify(passages.map(row => row.id)) !== JSON.stringify(book.paragraphIds)) throw Error('BCCAMPUS_PARAGRAPH_COUNT');
    return { id: book.id, rootId: edition.rootId, title: book.title, authors: book.authors, attribution: book.attribution,
      originalUrl: shared.openReadingBookUrl(edition), downloadUrl: shared.openReadingDownloadUrl(edition), acquiredAt: book.acquiredAt,
      language: 'en', licence: 'CC BY 4.0; original author prose only, excluding third-party material and media.', licenceUrl: shared.openReadingLicenceUrl,
      sourceHash: book.sourceHash, reviewStatus: 'draft', permissionReview: 'Codex/AI inspected exact frozen home and chapter CC BY4.0 grants, original author evidence and exceptions; poetry/media excluded.',
      editorialReview: 'pending', processing: `Cloud native paragraphs and exact source evidence reviewed by Codex/AI. ${review.timeSemantics} Four exact A2 source scopes; client generation, no CEFR calibration or audio acceptance.`, passages };
  });
  if (records.reduce((sum, record) => sum + record.passages.length, 0) !== 18) throw Error('BCCAMPUS_UNLISTED');
  return { records, review };
}
