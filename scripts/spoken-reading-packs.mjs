import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { readCorpusLanguage } from './corpus-language.mjs';
import { processArticle } from './corpus.mjs';
import { readSourceReview, reviewedLanguage, reviewedExcerpt } from './corpus-review.mjs';

// Local source preparation; production publication and rights acceptance are separate.
const directory = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? 'private/corpus/spoken/reading-packs';
const annotationPath = process.argv.find(arg => arg.startsWith('--language='))?.slice(11);
const annotations = await readCorpusLanguage(annotationPath);
const sourceAnnotations = await readCorpusLanguage(process.argv.find(arg => arg.startsWith('--source-language='))?.slice(18));
const raw = JSON.parse(await readFile('private/corpus/spoken/processed.json', 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const reviewed = await readSourceReview(raw.records, process.argv.find(arg => arg.startsWith('--review='))?.slice(9));
const records = reviewed.records.map(item => {
  if (sha(item.text) !== item.textSha256) throw new Error(`Source changed: ${item.rootId}`);
  const originalUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}?oldid=${item.revision}`;
  const passages = processArticle(item.text, reviewed.targetExclusions.has(item.rootId), reviewed.spanExclusions.get(item.rootId))
    .filter(passage => reviewedExcerpt(item.text, passage.text, reviewed.spanExclusions.get(item.rootId)))
    .map(passage => ({ ...passage, id: sha(`${item.rootId}\0${passage.text}`) }));
  const excludedTargets = reviewed.targetExclusions.get(item.rootId);
  if (excludedTargets?.length && !annotationPath) throw new Error('TARGET_REVIEW_REQUIRES_LANGUAGE');
  if (annotationPath) for (const passage of passages) {
    const full = sourceAnnotations.get(item.rootId), start = item.text.indexOf(passage.text);
    if (full && full.textHash !== item.textSha256) throw new Error('SOURCE_LANGUAGE_CHANGED');
    const annotation = annotations.get(passage.id) ?? (full && start >= 0 && start === item.text.lastIndexOf(passage.text) ? {
      textHash: sha(passage.text), language: { ...full.language, tokens: full.language.tokens
        .filter(token => token.start >= start && token.end <= start + passage.text.length)
        .map(token => ({ ...token, start: token.start - start, end: token.end - start })) },
    } : undefined);
    if (!annotation || annotation.textHash !== sha(passage.text)) throw new Error('Missing or changed passage annotation');
    passage.language = reviewedLanguage(passage.text, annotation.language, excludedTargets);
  }
  return {
    id: `wikipedia-${item.articlePageId}`, rootId: item.rootId, title: item.title, authors: ['Wikipedia contributors'],
    originalUrl, downloadUrl: originalUrl, acquiredAt: item.acquiredAt, language: 'en',
    licence: item.textLicence, licenceUrl: item.textLicenceUrl, attribution: `Wikipedia contributors, ${item.title}, recorded revision ${item.revision}.`,
    sourceHash: item.articleSha256, originalText: item.text, reviewStatus: 'draft',
    permissionReview: 'Recorded revision and general source terms retained; source-specific exceptions and regional permission review pending. Local explicit import only.',
    editorialReview: 'pending', processing: `${item.processing} Bounded excerpts; reviewed exclusions remove whole intersecting sentences without joining across removals. Inspected short continuous remnants may remain whole when headings prevent an eligible excerpt. Full extracted article retained separately. No audio in this reading package.`,
    passages,
  };
});
if (new Set(records.map(record => record.rootId)).size !== records.length) throw new Error('Duplicate original roots');
await mkdir(directory, { recursive: true });
const packs = [];
for (let start = 0; start < records.length;) {
  const batch = records.slice(start, start + (records.length - start === 31 ? 31 : 30));
  if (batch.length < 2) throw new Error('READING_REQUIRES_TWO_SOURCE_ROOTS');
  const id = `wikipedia-reading-${String(start / 30 + 1).padStart(3, '0')}`;
  const files = {
    'lessons.json': Buffer.from('[]'),
    'sources.json': Buffer.from(JSON.stringify(batch.map(record => ({ id: record.id, title: record.title, author: record.authors.join('; '), license: record.licence, attribution: record.attribution, sourceUrl: record.originalUrl })))),
    'corpus.json': Buffer.from(JSON.stringify({ version: 1, records: batch, failures: [] })),
  };
  if (files['corpus.json'].length > 5 * 1024 * 1024) throw new Error(`Reading batch too large: ${id}`);
  const manifest = { format: 'lingfern-community-content', version: 1, id, language: 'en', levels: ['B2'], materialCount: 0,
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha(bytes) }])) };
  const zip = zipSync(Object.fromEntries(Object.entries({ ...files, 'manifest.json': Buffer.from(JSON.stringify(manifest)) }).map(([name, bytes]) => [name, [bytes, { mtime: new Date('1980-01-01T00:00:00Z') }]])), { level: 6 });
  await writeFile(`${directory}/${id}.zip`, zip);
  packs.push({ id, bytes: zip.length, sha256: sha(zip), roots: batch.length, passages: batch.reduce((sum, record) => sum + record.passages.length, 0) });
  start += batch.length;
}
const report = { roots: records.length, words: reviewed.records.reduce((sum, item) => sum + item.wordCount, 0), passages: records.reduce((sum, item) => sum + item.passages.length, 0), audioIncluded: 0, independentlyReviewed: 0, textReview: reviewed.review, published: false, packs };
await writeFile(`${directory}/inventory.json`, JSON.stringify(report, null, 2) + '\n');
await writeFile(`${directory}/README.md`, '# Local source reading bank\n\nExplicit local import/review only. Hash-bound Codex text withholding decisions are applied; uninspected records, audio, generated questions and permissions remain pending. Source texts retain their separate CC BY-SA terms, original revision and contributor links; pending exceptions are not approved for public release. No images or recordings are in these ZIPs. Raw originals and separately licensed full audio remain in the private acquisition bank. The app generates draft exact-word and self-assessed-summary practice locally; B2 is the existing generator routing target, not a validated article level. Retain these ZIPs to reinstall after profile recovery.\n');
console.log(JSON.stringify({ roots: report.roots, passages: report.passages, packages: packs.length, bytes: packs.reduce((sum, item) => sum + item.bytes, 0), audioIncluded: 0, published: false }));
