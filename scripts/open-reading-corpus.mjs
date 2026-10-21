import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { prepareBccampusReading } from './bccampus-reading-corpus.mjs';
// Freeze independent source audits before updating pins; reject empty publication pins.
export const approvedSourceManifestSha256 = '9e47ef00164e3bc3eda9726bf72ab6fc827d40de30536370d2ecda77d78ba05d';
export const independentSourceReviewSha256 = '16346af59a6c263a725179e32dbc9b405b9b35dde0ba6b6b18160bc0a8ecdd60';
export const beginnerSourceReviewSha256 = '02656490f601dc6c1ccb4609f31c85c8ec56a1ae1d242632f3df5b3789022a04';
export const expansionSourceReviewSha256 = '3dfb6323c73f0f22e7990418739db844e7ca88c987ea5dee316c821a88cf0131';
export const bulkSourceReviewSha256 = '764ebb5d7ca3a7c01a600f7d38d4eb012a2b1e41ae32b43ba57e029a15bbcad9';
export const scaleSourceReviewSha256 = 'e6ba0711d004ec1d03c8310146289fa7cfd0ff93f7ff1515c88fb2e00d602da3';
export const literacySourceReviewSha256 = '40e2e301dca002bd68cfe9ebc4943ed604aa250de6449e00bc38411380b748b5';
export const sha = value => createHash('sha256').update(value).digest('hex');
export function paragraphOffsets(canonical, row) {
  const points = Array.from(canonical), text = points.slice(row.start, row.end).join('');
  const parts = canonical.split('\n\n');
  const prefix = parts.slice(0, row.paragraphIndex).join('\n\n') + (row.paragraphIndex ? '\n\n' : '');
  if (!Number.isInteger(row.start) || !Number.isInteger(row.end) || row.start < 0 || row.end <= row.start
    || row.end > points.length || text !== row.text || parts[row.paragraphIndex] !== text
    || Array.from(prefix).length !== row.start || sha(text) !== row.textSha256
    || text.trim().split(/\s+/).length !== row.wordCount || row.wordCount < 120 || row.wordCount > 700)
    throw Error('OPEN_READING_PARAGRAPH');
  return { sourceStart: points.slice(0, row.start).join('').length, sourceEnd: points.slice(0, row.end).join('').length };
}
export async function readFrozenSources(base, expectedManifestSha256) {
  const manifestBytes = await readFile(resolve(base, 'manifest.json'));
  if (sha(manifestBytes) !== expectedManifestSha256) throw Error('OPEN_READING_SOURCE_MANIFEST');
  const manifest = JSON.parse(manifestBytes), data = new Map();
  for (const [path, info] of Object.entries(manifest)) {
    if (!/^(?:raw|acquisition)\/[a-zA-Z0-9_.-]+$|^[a-z-]+\.(?:json|jsonl)$/.test(path)) throw Error('OPEN_READING_PATH');
    const bytes = await readFile(resolve(base, path));
    if (bytes.length !== info.bytes || sha(bytes) !== info.sha256) throw Error('OPEN_READING_SOURCE_HASH');
    data.set(path, bytes);
  }
  return data;
}
/** Allow multiple native paragraphs/list items only in reviewed beginner windows. */
export function beginnerOffsets(canonical, scope) {
  const source = scope.sourceProvenance, parts = canonical.split('\n\n');
  const prefix = parts.slice(0, source.paragraphIndex).join('\n\n') + (source.paragraphIndex ? '\n\n' : '');
  const text = canonical.slice(source.sourceStart, source.sourceEnd);
  if (!Number.isSafeInteger(source.paragraphIndex) || !parts[source.paragraphIndex]
    || prefix.length !== source.sourceStart || Array.from(prefix).length !== source.codePointStart
    || source.sourceEnd <= source.sourceStart || source.sourceEnd > canonical.length
    || source.sourceEnd < canonical.length && canonical.slice(source.sourceEnd, source.sourceEnd + 2) !== '\n\n'
    || !/[.!?]$/.test(text) || Array.from(canonical.slice(0, source.sourceEnd)).length !== source.codePointEnd
    || sha(text) !== source.textSha256 || text.trim().split(/\s+/).length !== scope.wordCount
    || !scope.startingPoints.length || new Set(scope.startingPoints).size !== scope.startingPoints.length
    || scope.startingPoints.some(point => !['A1', 'A2'].includes(point) || scope.wordCount > (point === 'A1' ? 120 : 160))
    || /https?:\/\/|Click play|<|>/.test(text)) throw Error('OPEN_READING_BEGINNER_SCOPE');
  return text;
}
export async function prepareOpenReadingBeginner(shared) {
  const bytes = await readFile('content/corpus/open-reading-beginner-source-review.json');
  if (sha(bytes) !== beginnerSourceReviewSha256) throw Error('OPEN_READING_BEGINNER_REVIEW');
  const review = JSON.parse(bytes), edition = shared.openReadingEdition('bccampus-abealfreader1');
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || review.decision !== 'supported-beginner-text'
    || review.scopes.length !== 7 || !edition || edition.sourceHash !== review.sourceHash) throw Error('OPEN_READING_BEGINNER_REVIEW');
  const data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  const home = data.get('raw/home.html'), prepared = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const report = JSON.parse(data.get('report.json'));
  if (!home || sha(home) !== edition.sourceHash || report.homeRawSha256 !== edition.sourceHash || report.home !== shared.openReadingBookUrl(edition)
    || !home.toString('utf8').includes('Shantel Ivits') || !home.toString('utf8').includes(shared.openReadingLicenceUrl)) throw Error('OPEN_READING_BEGINNER_RIGHTS');
  const passages = review.scopes.map(scope => {
    const source = scope.sourceProvenance, row = prepared.find(row => row.storyId === source.locator);
    const evidence = ledger.find(row => row.storyId === source.locator);
    const raw = data.get(`raw/${source.locator}.html`), canonical = data.get(`raw/${source.locator}.canonical.txt`);
    if (!row || !evidence || !raw || !canonical || sha(raw) !== source.rawSha256 || sha(canonical) !== source.canonicalSha256
      || row.rawSha256 !== source.rawSha256 || row.canonicalSha256 !== source.canonicalSha256 || evidence.rawSha256 !== source.rawSha256
      || row.title !== source.chapter || row.rootId !== edition.rootId || row.url !== source.sourceUrl
      || !/Copyright &copy; 2015[\s\S]*?Shantel Ivits[\s\S]*?https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//.test(raw.toString('utf8')))
      throw Error('OPEN_READING_BEGINNER_RIGHTS');
    const text = beginnerOffsets(new TextDecoder('utf-8', { fatal: true }).decode(canonical), scope);
    if (scope.id !== sha(`${source.workId}\0${source.locator}\0${source.paragraphIndex}\0${text}`)
      || !shared.validOpenReadingBeginnerScope(scope)) throw Error('OPEN_READING_BEGINNER_SCOPE');
    return { id: scope.id, text, wordCount: scope.wordCount, startingPoints: scope.startingPoints, sourceProvenance: source };
  });
  if (new Set(passages.map(p => p.id)).size !== passages.length) throw Error('OPEN_READING_BEGINNER_SCOPE');
  return { review, record: { id: edition.id, rootId: edition.rootId, title: review.title, authors: review.authors,
    originalUrl: shared.openReadingBookUrl(edition), downloadUrl: shared.openReadingDownloadUrl(edition), acquiredAt: new Date(report.acquiredAt).toISOString(),
    language: 'en', licence: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); original prose only, excluding third-party material and media.',
    licenceUrl: shared.openReadingLicenceUrl, attribution: review.attribution, sourceHash: edition.sourceHash, reviewStatus: 'draft',
    permissionReview: 'Original Shantel Ivits prose, Copyright 2015; actual archived home and chapter CC BY 4.0 grants inspected by Codex/AI. Images, audio and other media excluded.',
    editorialReview: 'pending', processing: 'Seven hash-bound complete native paragraph/list windows inspected by Codex/AI for A1/A2 starting-point support; exact canonical whitespace retained. Client generates tasks. No CEFR calibration or audio acceptance.', passages } };
}
async function prepareOpenReadingExpansion(shared) {
  const bytes = await readFile('content/corpus/open-reading-expansion-source-review.json');
  if (!expansionSourceReviewSha256 || sha(bytes) !== expansionSourceReviewSha256) throw Error('OPEN_READING_EXPANSION_REVIEW');
  const review = JSON.parse(bytes);
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || !review.scope || !Array.isArray(review.excludedPassageIds)) throw Error('OPEN_READING_EXPANSION_REVIEW');
  if (sha(await readFile(review.independentReviewPath)) !== review.independentReviewSha256) throw Error('OPEN_READING_EXPANSION_REVIEW');
  const data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  if (sha(data.get('prepared.json')) !== review.preparedSha256 || sha(data.get('source-ledger.json')) !== review.sourceLedgerSha256) throw Error('OPEN_READING_EXPANSION_HASH');
  const rows = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const excluded = new Set(review.excludedPassageIds);
  if (new Set(review.books.map(book => book.id)).size !== review.books.length || new Set(rows.map(row => row.id)).size !== rows.length) throw Error('OPEN_READING_EXPANSION_DUPLICATES');
  if (excluded.size !== review.excludedPassageIds.length || [...excluded].some(id => !rows.some(row => row.id === id))) throw Error('OPEN_READING_EXPANSION_EXCLUSIONS');
  const records = review.books.map(book => {
    const edition = shared.openReadingEdition(book.id), evidence = ledger.find(row => row.workId === book.id);
    if (!edition || !evidence || edition.sourceHash !== book.sourceHash || evidence.collectionSha256 !== book.sourceHash
      || evidence.repository !== edition.repository || evidence.commit !== edition.commit || evidence.title !== book.title
      || evidence.licenceUrl !== shared.openReadingLicenceUrl || evidence.licenseSha256 !== book.licenseSha256 || sha(data.get(evidence.licenseEvidencePath)) !== book.licenseSha256
      || ![shared.openReadingLicenceSha256, 'a706f01f512dcf99caf5367fc60902258ff03aa77b76b13a1f69c5fce788b739', '38a27c0f017da132e9a04ec8be91ead41cf8a55d85018c2de50c2b831dcfac38'].includes(book.licenseSha256))
      throw Error('OPEN_READING_EXPANSION_EDITION');
    const collection = data.get(evidence.collectionPath);
    if (!collection || sha(collection) !== book.sourceHash || !/\burl="https?:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/.test(collection.toString('utf8')))
      throw Error('OPEN_READING_EXPANSION_GRANT');
    if (!book.authorEvidence?.length || !book.authors.length || book.authorEvidence.some(item => !data.has(item.rawPath) || sha(data.get(item.rawPath)) !== item.sha256)) throw Error('OPEN_READING_EXPANSION_AUTHOR');
    const passages = rows.filter(row => row.workId === book.id && !excluded.has(row.id)).map(row => {
      if (row.id !== sha(`${row.workId}\0${row.locator}\0${row.paragraphIndex}\0${row.text}`) || row.licenceUrl !== shared.openReadingLicenceUrl
        || row.preparationStatus !== 'complete-source-paragraph-structural-ready' || sha(data.get(row.rawPath)) !== row.sourceHash
        || sha(data.get(row.canonicalPath)) !== row.canonicalSha256) throw Error('OPEN_READING_EXPANSION_PARAGRAPH');
      const offsets = paragraphOffsets(new TextDecoder('utf-8', { fatal: true }).decode(data.get(row.canonicalPath)), row);
      return { id: row.id, text: row.text, wordCount: row.wordCount, sourceProvenance: { workId: row.workId, chapter: row.chapter, locator: row.locator,
        sourceUrl: row.sourceUrl, rawSha256: row.sourceHash, canonicalSha256: row.canonicalSha256, paragraphIndex: row.paragraphIndex,
        codePointStart: row.start, codePointEnd: row.end, ...offsets, textSha256: row.textSha256 } };
    });
    if (!passages.length || passages.length !== book.paragraphCount || new Set(passages.map(passage => passage.id)).size !== passages.length) throw Error('OPEN_READING_EXPANSION_BOOK');
    return { id: book.id, rootId: edition.rootId, title: book.title, authors: book.authors, attribution: book.attribution,
      originalUrl: shared.openReadingBookUrl(edition), downloadUrl: shared.openReadingDownloadUrl(edition), acquiredAt: new Date(evidence.acquiredAt).toISOString(), language: 'en',
      licence: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); original prose only, excluding third-party material and media.', licenceUrl: shared.openReadingLicenceUrl,
      sourceHash: book.sourceHash, reviewStatus: 'draft', permissionReview: 'Codex/AI verified the actual frozen collection grant, licence and author evidence. Current editions and third-party material have separate rights.',
      editorialReview: 'pending', processing: 'Cloud-prepared complete native paragraphs; original and canonical hashes and exact offsets verified. Client-generated questions; no CEFR calibration or audio acceptance.', passages };
  });
  if (rows.some(row => !excluded.has(row.id) && !records.some(record => record.id === row.workId))) throw Error('OPEN_READING_EXPANSION_UNLISTED');
  return { records, review };
}
async function prepareOpenReadingBulk(shared) {
  const bytes = await readFile('content/corpus/open-reading-bulk-source-review.json');
  if (sha(bytes) !== bulkSourceReviewSha256) throw Error('OPEN_READING_BULK_REVIEW');
  const review = JSON.parse(bytes);
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || review.preparedCount !== 1356 || review.books.length !== 3 || !Array.isArray(review.excludedPassageIds)) throw Error('OPEN_READING_BULK_REVIEW');
  if (sha(await readFile(review.independentReviewPath)) !== review.independentReviewSha256) throw Error('OPEN_READING_BULK_REVIEW');
  const data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  if (sha(data.get('prepared.json')) !== review.preparedSha256 || sha(data.get('source-ledger.json')) !== review.sourceLedgerSha256) throw Error('OPEN_READING_BULK_HASH');
  const rows = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const excluded = new Set(review.excludedPassageIds);
  if (excluded.size !== review.excludedPassageIds.length || rows.length !== review.preparedCount || new Set(rows.map(row => row.id)).size !== rows.length || [...excluded].some(id => !rows.some(row => row.id === id))) throw Error('OPEN_READING_BULK_COUNT');
  const records = review.books.map(book => {
    const edition = shared.openReadingEdition(book.id), evidence = ledger.find(row => row.workId === book.id);
    if (!edition || !evidence || edition.sourceHash !== book.sourceHash || evidence.collectionSha256 !== book.sourceHash
      || evidence.repository !== edition.repository || evidence.commit !== edition.commit || evidence.title !== book.title
      || JSON.stringify(evidence.authors) !== JSON.stringify(book.authors) || evidence.licenceUrl !== shared.openReadingLicenceUrl
      || evidence.licenseSha256 !== book.licenseSha256 || sha(data.get(evidence.licenseEvidencePath)) !== shared.openReadingLicenceSha256)
      throw Error('OPEN_READING_BULK_EDITION');
    const collection = data.get(evidence.collectionPath), preface = data.get(book.authorEvidence[0].rawPath);
    if (!collection || sha(collection) !== book.sourceHash || !/\burl="https?:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/.test(collection.toString('utf8'))
      || !preface || sha(preface) !== book.authorEvidence[0].sha256 || book.authors.some(name => !preface.toString('utf8').includes(name)))
      throw Error('OPEN_READING_BULK_GRANT');
    const passages = rows.filter(row => row.workId === book.id && !excluded.has(row.id)).map(row => {
      if (row.id !== sha(`${row.workId}\0${row.locator}\0${row.paragraphIndex}\0${row.text}`) || row.licenceUrl !== shared.openReadingLicenceUrl
        || row.preparationStatus !== 'complete-source-paragraph-structural-ready' || sha(data.get(row.rawPath)) !== row.sourceHash
        || sha(data.get(row.canonicalPath)) !== row.canonicalSha256) throw Error('OPEN_READING_BULK_PARAGRAPH');
      const offsets = paragraphOffsets(new TextDecoder('utf-8', { fatal: true }).decode(data.get(row.canonicalPath)), row);
      return { id: row.id, text: row.text, wordCount: row.wordCount, sourceProvenance: { workId: row.workId, chapter: row.chapter, locator: row.locator,
        sourceUrl: row.sourceUrl, rawSha256: row.sourceHash, canonicalSha256: row.canonicalSha256, paragraphIndex: row.paragraphIndex,
        codePointStart: row.start, codePointEnd: row.end, ...offsets, textSha256: row.textSha256 } };
    });
    if (passages.length !== book.paragraphCount || new Set(passages.map(passage => passage.id)).size !== passages.length) throw Error('OPEN_READING_BULK_BOOK');
    return { id: book.id, rootId: edition.rootId, title: book.title, authors: book.authors, attribution: book.attribution,
      originalUrl: shared.openReadingBookUrl(edition), downloadUrl: shared.openReadingDownloadUrl(edition), acquiredAt: new Date(evidence.acquiredAt).toISOString(), language: 'en',
      licence: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); original prose only, excluding third-party material and media.', licenceUrl: shared.openReadingLicenceUrl,
      sourceHash: book.sourceHash, reviewStatus: 'draft', permissionReview: 'Codex/AI verified the frozen collection CC BY 4.0 grant, pinned licence text and preface senior authors. Current editions have separate rights.',
      editorialReview: 'pending', processing: 'Cloud-prepared complete native paragraphs from the 2026-10-10 Colab CPU acquisition. Hashes and offsets verified. Sampled openings, middles and endings. Client-generated questions; no CEFR calibration or audio acceptance.', passages };
  });
  if (rows.some(row => !excluded.has(row.id) && !records.some(record => record.id === row.workId))) throw Error('OPEN_READING_BULK_UNLISTED');
  return { records, review };
}
async function prepareOpenReadingScale(shared) {
  const bytes = await readFile('content/corpus/open-reading-scale-source-review.json');
  if (sha(bytes) !== scaleSourceReviewSha256) throw Error('OPEN_READING_SCALE_REVIEW');
  const review = JSON.parse(bytes);
  const acceptedLicences = new Set([shared.openReadingLicenceSha256, '38a27c0f017da132e9a04ec8be91ead41cf8a55d85018c2de50c2b831dcfac38']);
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || review.preparedCount !== 1861 || review.books.length !== 11 || !Array.isArray(review.excludedPassageIds)) throw Error('OPEN_READING_SCALE_REVIEW');
  if (sha(await readFile(review.independentReviewPath)) !== review.independentReviewSha256) throw Error('OPEN_READING_SCALE_REVIEW');
  const data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  if (sha(data.get('prepared.json')) !== review.preparedSha256 || sha(data.get('source-ledger.json')) !== review.sourceLedgerSha256) throw Error('OPEN_READING_SCALE_HASH');
  const rows = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const excluded = new Set(review.excludedPassageIds);
  if (excluded.size !== review.excludedPassageIds.length || rows.length !== review.preparedCount || new Set(rows.map(row => row.id)).size !== rows.length || [...excluded].some(id => !rows.some(row => row.id === id))) throw Error('OPEN_READING_SCALE_COUNT');
  const records = review.books.map(book => {
    const edition = shared.openReadingEdition(book.id), evidence = ledger.find(row => row.workId === book.id);
    if (!edition || !evidence || edition.sourceHash !== book.sourceHash || evidence.collectionSha256 !== book.sourceHash
      || evidence.repository !== edition.repository || evidence.commit !== edition.commit || evidence.title !== book.title
      || evidence.licenceUrl !== shared.openReadingLicenceUrl || evidence.licenseSha256 !== book.licenseSha256
      || !acceptedLicences.has(book.licenseSha256) || sha(data.get(evidence.licenseEvidencePath)) !== book.licenseSha256)
      throw Error('OPEN_READING_SCALE_EDITION');
    const collection = data.get(evidence.collectionPath), authors = data.get(book.authorEvidence[0].rawPath);
    if (!collection || sha(collection) !== book.sourceHash || !/\burl="https?:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/.test(collection.toString('utf8'))
      || !authors || sha(authors) !== book.authorEvidence[0].sha256 || book.authors.some(name => !authors.toString('utf8').includes(name)))
      throw Error('OPEN_READING_SCALE_GRANT');
    const passages = rows.filter(row => row.workId === book.id && !excluded.has(row.id)).map(row => {
      if (row.id !== sha(`${row.workId}\0${row.locator}\0${row.paragraphIndex}\0${row.text}`) || row.licenceUrl !== shared.openReadingLicenceUrl
        || row.preparationStatus !== 'complete-source-paragraph-structural-ready' || sha(data.get(row.rawPath)) !== row.sourceHash
        || sha(data.get(row.canonicalPath)) !== row.canonicalSha256) throw Error('OPEN_READING_SCALE_PARAGRAPH');
      const offsets = paragraphOffsets(new TextDecoder('utf-8', { fatal: true }).decode(data.get(row.canonicalPath)), row);
      return { id: row.id, text: row.text, wordCount: row.wordCount, sourceProvenance: { workId: row.workId, chapter: row.chapter, locator: row.locator,
        sourceUrl: row.sourceUrl, rawSha256: row.sourceHash, canonicalSha256: row.canonicalSha256, paragraphIndex: row.paragraphIndex,
        codePointStart: row.start, codePointEnd: row.end, ...offsets, textSha256: row.textSha256 } };
    });
    if (passages.length !== book.paragraphCount || new Set(passages.map(passage => passage.id)).size !== passages.length) throw Error('OPEN_READING_SCALE_BOOK');
    return { id: book.id, rootId: edition.rootId, title: book.title, authors: book.authors, attribution: book.attribution,
      originalUrl: shared.openReadingBookUrl(edition), downloadUrl: shared.openReadingDownloadUrl(edition), acquiredAt: new Date(evidence.acquiredAt).toISOString(), language: 'en',
      licence: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); original prose only, excluding third-party material and media.', licenceUrl: shared.openReadingLicenceUrl,
      sourceHash: book.sourceHash, reviewStatus: 'draft', permissionReview: 'Codex/AI verified the frozen collection CC BY 4.0 grant, an accepted licence text and the senior-author evidence. Current editions have separate rights.',
      editorialReview: 'pending', processing: 'Cloud-prepared complete native paragraphs from the 2026-10-10 Colab CPU batch of 13 allowlisted books. Hashes and offsets verified. Openings of each admitted book were read. Client-generated questions; no CEFR calibration or audio acceptance.', passages };
  });
  if (rows.some(row => !excluded.has(row.id) && !records.some(record => record.id === row.workId))) throw Error('OPEN_READING_SCALE_UNLISTED');
  return { records, review };
}
async function prepareOpenReadingLiteracy(shared) {
  const bytes = await readFile('content/corpus/open-reading-literacy-source-review.json');
  if (sha(bytes) !== literacySourceReviewSha256) throw Error('OPEN_READING_LITERACY_REVIEW');
  const review = JSON.parse(bytes);
  if (review.version !== 1 || review.reviewer !== 'Codex/AI' || review.preparedCount !== 119 || review.books.length !== 1 || review.excludedPassageIds.length !== 110) throw Error('OPEN_READING_LITERACY_REVIEW');
  if (sha(await readFile(review.independentReviewPath)) !== review.independentReviewSha256) throw Error('OPEN_READING_LITERACY_REVIEW');
  const data = await readFrozenSources(resolve(review.inputDirectory), review.manifestSha256);
  if (sha(data.get('prepared.json')) !== review.preparedSha256 || sha(data.get('source-ledger.json')) !== review.sourceLedgerSha256) throw Error('OPEN_READING_LITERACY_HASH');
  const rows = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const excluded = new Set(review.excludedPassageIds);
  if (rows.length !== review.preparedCount || excluded.size !== review.excludedPassageIds.length || new Set(rows.map(row => row.id)).size !== rows.length || [...excluded].some(id => !rows.some(row => row.id === id))) throw Error('OPEN_READING_LITERACY_COUNT');
  const records = review.books.map(book => {
    const edition = shared.openReadingEdition(book.id), evidence = ledger.find(row => row.workId === book.id), home = data.get(evidence?.licenseEvidencePath);
    if (!edition || !evidence || edition.sourceHash !== book.sourceHash || sha(home) !== book.sourceHash || evidence.title !== book.title
      || JSON.stringify(evidence.authors) !== JSON.stringify(book.authors) || evidence.licenceUrl !== shared.openReadingLicenceUrl
      || !home.toString('utf8').includes('Shantel Ivits') || !home.toString('utf8').includes(shared.openReadingLicenceUrl) || /creativecommons\.org\/licenses\/by-nc/.test(home.toString('utf8')))
      throw Error('OPEN_READING_LITERACY_RIGHTS');
    const passages = rows.filter(row => row.workId === book.id && !excluded.has(row.id)).map(row => {
      const raw = data.get(row.rawPath), canonicalBytes = data.get(row.canonicalPath);
      if (!raw || !canonicalBytes || sha(raw) !== row.sourceHash || sha(canonicalBytes) !== row.canonicalSha256
        || row.id !== sha(`${row.workId}\0${row.locator}\0${row.paragraphIndex}\0${row.text}`) || row.licenceUrl !== shared.openReadingLicenceUrl
        || row.preparationStatus !== 'complete-source-paragraph-structural-ready') throw Error('OPEN_READING_LITERACY_PARAGRAPH');
      const meta = JSON.parse(raw.toString('utf8').match(/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)[1]);
      if (meta['@type'] !== 'Chapter' || meta.license?.url !== shared.openReadingLicenceUrl || meta.author?.[0]?.name !== 'Shantel Ivits' || meta.copyrightHolder?.name !== 'Shantel Ivits') throw Error('OPEN_READING_LITERACY_CHAPTER');
      const canonical = new TextDecoder('utf-8', { fatal: true }).decode(canonicalBytes);
      const offsets = paragraphOffsets(canonical, row);
      if (offsets.sourceStart !== row.sourceStart || offsets.sourceEnd !== row.sourceEnd) throw Error('OPEN_READING_LITERACY_OFFSET');
      return { id: row.id, text: row.text, wordCount: row.wordCount, sourceProvenance: { workId: row.workId, chapter: row.chapter, locator: row.locator,
        sourceUrl: row.sourceUrl, rawSha256: row.sourceHash, canonicalSha256: row.canonicalSha256, paragraphIndex: row.paragraphIndex,
        codePointStart: row.start, codePointEnd: row.end, ...offsets, textSha256: row.textSha256 } };
    });
    if (passages.length !== book.paragraphCount || JSON.stringify(passages.map(passage => passage.id)) !== JSON.stringify(book.paragraphIds)) throw Error('OPEN_READING_LITERACY_BOOK');
    return { id: book.id, rootId: edition.rootId, title: book.title, authors: book.authors, attribution: book.attribution,
      originalUrl: shared.openReadingBookUrl(edition), downloadUrl: shared.openReadingDownloadUrl(edition), acquiredAt: new Date(evidence.acquiredAt).toISOString(), language: 'en',
      licence: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); original prose only, excluding third-party material and media.', licenceUrl: shared.openReadingLicenceUrl,
      sourceHash: book.sourceHash, reviewStatus: 'draft', permissionReview: 'Codex/AI verified the frozen home page and chapter CC BY 4.0 grants and the named author. Media, exercises and short paragraphs stayed out.',
      editorialReview: 'pending', processing: 'Cloud-prepared complete native paragraphs from the 2026-10-10 literacy batch. Hashes and offsets verified. Gutenberg selections, Reader 6 and the State Department PDF pages stayed out. Client-generated questions; no CEFR calibration or audio acceptance.', passages };
  });
  if (rows.some(row => !excluded.has(row.id) && !records.some(record => record.id === row.workId))) throw Error('OPEN_READING_LITERACY_UNLISTED');
  return { records, review };
}
/** Require full raw/rights/parser verification before admitting frozen manifests. */
export async function prepareOpenReading({ check = false } = {}) {
  const approvedBytes = await readFile('content/corpus/open-reading-source-manifest.json');
  if (!approvedSourceManifestSha256 || sha(approvedBytes) !== approvedSourceManifestSha256) throw Error('OPEN_READING_UNFROZEN');
  const approved = JSON.parse(approvedBytes);
  if (!independentSourceReviewSha256 || approved.independentReviewSha256 !== independentSourceReviewSha256 || sha(await readFile(approved.independentReviewPath)) !== independentSourceReviewSha256) throw Error('OPEN_READING_SOURCE_REVIEW');
  if (approved.version !== 1 || approved.sourceReview !== 'Codex/AI' || approved.unjoinedParagraphs !== true) throw Error('OPEN_READING_SOURCE_REVIEW');
  const data = await readFrozenSources(resolve(approved.inputDirectory), approved.manifestSha256);
  for (const name of ['prepared.json', 'source-ledger.json', 'chapters.json', 'ledger-metadata.json']) if (!data.has(name)) throw Error('OPEN_READING_SOURCE_METADATA');
  const rows = JSON.parse(data.get('prepared.json')), ledger = JSON.parse(data.get('source-ledger.json'));
  const metadata = JSON.parse(data.get('ledger-metadata.json'));
  if (sha(data.get('ledger-metadata.json')) !== approved.ledgerMetadataSha256 || metadata.books.length !== ledger.length) throw Error('OPEN_READING_LEDGER_METADATA');
  if (sha(data.get('source-ledger.json')) !== approved.sourceLedgerSha256) throw Error('OPEN_READING_SOURCE_LEDGER');
  if (sha(data.get('prepared.json')) !== approved.preparedSha256 || rows.length !== approved.paragraphCount || new Set(rows.map(row => row.id)).size !== rows.length || new Set(rows.map(row => row.text)).size !== rows.length) throw Error('OPEN_READING_PREPARATION');
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const { corpusSchema } = await server.ssrLoadModule('/src/core/corpus.ts');
    const shared = await server.ssrLoadModule('/src/shared/openReading.ts');
    const { openReadingEdition, openReadingBookUrl, openReadingDownloadUrl, openReadingLicenceUrl, openReadingLicenceSha256 } = shared;
    const records = approved.books.map(book => {
      const edition = openReadingEdition(book.id), originalEvidence = ledger.find(row => row.workId === book.id), bookMetadata = metadata.books.find(row => row.workId === book.id), evidence = originalEvidence && bookMetadata ? { ...originalEvidence, ...bookMetadata } : undefined;
      if (!edition || !evidence || evidence.bookSourceHash !== book.sourceHash || book.sourceHash !== edition.sourceHash || edition.repository && (evidence.repository !== edition.repository || evidence.licenseSha256 !== openReadingLicenceSha256) || evidence.title !== book.title || JSON.stringify(evidence.authors) !== JSON.stringify(book.authors) || evidence.licenceUrl !== openReadingLicenceUrl || edition.commit && evidence.commit !== edition.commit) throw Error('OPEN_READING_EDITION');
      if (evidence.originalUrl !== openReadingBookUrl(edition)) throw Error('OPEN_READING_BOOK_URL');
      if (edition.repository) {
        const licenceEvidence = data.get(evidence.licenseEvidencePath), collection = data.get(evidence.collectionPath), author = data.get(evidence.authorEvidence?.rawPath);
        if (!licenceEvidence || sha(licenceEvidence) !== openReadingLicenceSha256 || !collection || sha(collection) !== evidence.collectionSha256
          || !author || sha(author) !== evidence.authorEvidence.sourceSha256) throw Error('OPEN_READING_BOOK_EVIDENCE');
        const xml = collection.toString('utf8');
        if (!xml.includes(`>${book.title}</md:title>`) || !/\burl="https?:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/.test(xml)) throw Error('OPEN_READING_COLLECTION_GRANT');
      } else {
        const home = data.get(evidence.licenseEvidencePath), exceptions = data.get(evidence.exceptionsEvidencePath);
        if (!home || sha(home) !== edition.sourceHash || !exceptions || sha(exceptions) !== evidence.exceptionsSha256
          || evidence.exceptionsSha256 !== '7277362618f01b7593d4990bf3de89bb334e8f4d06c3b6514f8161fdb15d7827') throw Error('OPEN_READING_BC_EXCEPTIONS');
      }
      const passages = rows.filter(row => row.workId === book.id).map(row => {
        if (row.id !== sha(`${row.workId}\0${row.locator}\0${row.paragraphIndex}\0${row.text}`) || row.licenceUrl !== openReadingLicenceUrl || row.preparationStatus !== 'complete-source-paragraph-structural-ready') throw Error('OPEN_READING_PARAGRAPH_ID');
        const raw = data.get(row.rawPath), canonical = data.get(row.canonicalPath);
        if (!raw || !canonical || sha(raw) !== row.sourceHash || sha(canonical) !== row.canonicalSha256) throw Error('OPEN_READING_SOURCE_HASH');
        const offsets = paragraphOffsets(new TextDecoder('utf-8', { fatal: true }).decode(canonical), row);
        return { id: row.id, text: row.text, wordCount: row.wordCount, sourceProvenance: { workId: row.workId, chapter: row.chapter, locator: row.locator,
          sourceUrl: row.sourceUrl, rawSha256: row.sourceHash, canonicalSha256: row.canonicalSha256, paragraphIndex: row.paragraphIndex,
          codePointStart: row.start, codePointEnd: row.end, ...offsets, textSha256: row.textSha256 } };
      });
      if (!passages.length || passages.length !== book.paragraphCount || new Set(passages.map(p => p.id)).size !== passages.length) throw Error('OPEN_READING_BOOK');
      return { id: book.id, rootId: edition.rootId, title: book.title, authors: book.authors, originalUrl: openReadingBookUrl(edition), downloadUrl: openReadingDownloadUrl(edition),
        acquiredAt: evidence.acquiredAt, language: 'en', licence: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); original prose only, excluding third-party material and media.', licenceUrl: openReadingLicenceUrl,
        attribution: book.attribution, sourceHash: book.sourceHash, reviewStatus: 'draft', permissionReview: approved.permissionReview,
        editorialReview: 'pending', processing: 'Complete unjoined paragraphs; whitespace normalised; raw and canonical hashes verified. No level calibration or audio acceptance.', passages };
    });
    if (rows.some(row => !records.some(record => record.id === row.workId))) throw Error('OPEN_READING_UNLISTED_BOOK');
    const beginner = await prepareOpenReadingBeginner(shared);
    records.push(beginner.record);
    const expansion = await prepareOpenReadingExpansion(shared);
    records.push(...expansion.records);
    const bulk = await prepareOpenReadingBulk(shared);
    records.push(...bulk.records);
    const scale = await prepareOpenReadingScale(shared);
    records.push(...scale.records);
    const literacy = await prepareOpenReadingLiteracy(shared);
    records.push(...literacy.records);
    const bc = await prepareBccampusReading(shared);
    records.push(...bc.records);
    const bank = corpusSchema.parse({ version: 1, records, failures: [] }), serialized = JSON.stringify(bank) + '\n';
    if (Buffer.byteLength(serialized) > 20 * 1024 * 1024) throw Error('OPEN_READING_BANK_LIMIT');
    const license = data.get(approved.licencePath);
    if (!license || sha(license) !== approved.licenceSha256 || sha(license) !== openReadingLicenceSha256) throw Error('OPEN_READING_LICENSE');
    const topics = { version: 1, records: records.map(record => {
      const topic = record.id === beginner.record.id ? beginner.review.topic : [...approved.books, ...expansion.review.books, ...bulk.review.books, ...scale.review.books, ...bc.review.books, ...literacy.review.books].find(book => book.id === record.id).topic;
      if (!['health', 'science', 'society', 'history', 'nature', 'business', 'culture', 'campus'].includes(topic)) throw Error('OPEN_READING_TOPIC');
      return { rootId: record.rootId, sourceHash: record.sourceHash, topic, provenance: { url: record.originalUrl, policyUrl: record.licenceUrl, method: 'Hash-bound original book subject and complete preface reviewed by Codex/AI; chapter roots are not created.' } };
    }) };
    const outputs = [['content/corpus/open-reading-topics.json', JSON.stringify(topics, null, 2) + '\n'], ['content/corpus/open-reading.json', serialized], ['public/corpus/open-reading.json', serialized],
      ['public/corpus/open-reading-CC-BY-4.0.txt', license], ['public/corpus/open-reading-NOTICE.md', approved.notice + '\n' + beginner.review.attribution + '\n' + [...expansion.review.books, ...bulk.review.books, ...scale.review.books, ...bc.review.books, ...literacy.review.books].map(book => book.attribution).join('\n') + '\nOriginal text only; images, audio and other media are excluded.\n']];
    // Validate all inputs and schemas before publication writes.
    for (const [path, value] of outputs) {
      if (check) { if (!Buffer.from(await readFile(path)).equals(Buffer.from(value))) throw Error('OPEN_READING_STALE'); }
      else { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, value); }
    }
    return bank;
  } finally { await server.close(); }
}
if (import.meta.url === new URL(process.argv[1], 'file://' + process.cwd() + '/').href) {
  const bank = await prepareOpenReading({ check: process.argv.includes('--check') });
  console.log(`Verified ${bank.records.length} books and ${bank.records.reduce((n, r) => n + r.passages.length, 0)} complete paragraphs`);
}
