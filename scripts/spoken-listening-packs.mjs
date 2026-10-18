import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';
import { chromium } from '@playwright/test';
import { readCorpusLanguage } from './corpus-language.mjs';
import { readSourceReview, reviewedLanguage, reviewedExcerpt, reviewedAudioHolds, groupSpokenSources } from './corpus-review.mjs';

const directory = 'private/corpus/spoken';
const annotationPath = process.argv.find(arg => arg.startsWith('--language='))?.slice(11);
const annotations = await readCorpusLanguage(annotationPath);
const sourceAnnotations = await readCorpusLanguage(process.argv.find(arg => arg.startsWith('--source-language='))?.slice(18));
const clipsDirectory = process.argv.find(arg => arg.startsWith('--clips='))?.slice(8) ?? `${directory}/listening-clips`;
const prepared = JSON.parse(await readFile(`${clipsDirectory}/index.json`, 'utf8'));
if (!prepared.complete || prepared.humanReviewed !== 0) throw new Error('EXPECTED_COMPLETE_DRAFT_BANK');
const raw = JSON.parse(await readFile(`${directory}/processed.json`, 'utf8'));
const audioHolds = reviewedAudioHolds(raw.records, prepared.records, JSON.parse(await readFile(`${directory}/codex-audio-holds.json`, 'utf8')));
const reviewed = await readSourceReview(raw.records, process.argv.find(arg => arg.startsWith('--review='))?.slice(9));
const allowed = new Set(reviewed.records.map(record => record.rootId));
prepared.records = prepared.records.filter(record => allowed.has(record.rootId));
const originals = new Map(raw.records.map(record => [record.rootId, record.text]));
prepared.records = prepared.records.map(record => ({ ...record, clips: record.clips.filter(clip => reviewedExcerpt(originals.get(record.rootId), clip.text, reviewed.spanExclusions.get(record.rootId))) })).filter(record => record.clips.length);
if (!annotationPath && !sourceAnnotations.size && prepared.records.some(record => reviewed.targetExclusions.get(record.rootId)?.length)) throw new Error('TARGET_REVIEW_REQUIRES_LANGUAGE');
const reading = JSON.parse(await readFile(`${directory}/reading-packs/inventory.json`, 'utf8'));
const sources = new Map();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const entry of reading.packs) {
  const bytes = await readFile(`${directory}/reading-packs/${entry.id}.zip`);
  if (sha(bytes) !== entry.sha256) throw new Error('SOURCE_BANK_INTEGRITY');
  for (const record of JSON.parse(new TextDecoder().decode(unzipSync(bytes)['corpus.json'])).records) {
    const { passages, ...source } = record;
    if (!passages || !source.originalText) throw new Error('MISSING_ORIGINAL_SOURCE');
    sources.set(record.rootId, source);
  }
}
// Reuse the installed inert browser HTML parser for contributor names; no HTML is rendered in the app.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let authors;
try {
  const page = await browser.newPage(); await page.context().setOffline(true);
  authors = await page.evaluate(values => values.map(html => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('script,style').forEach(node => node.remove());
    return document.body.textContent.replace(/\s+/g, ' ').trim();
  }), prepared.records.map(record => record.provenance.artistHtml));
} finally { await browser.close(); }
const authorByRoot = new Map(prepared.records.map((record, index) => [record.rootId, authors[index]]));
const groupingPath = process.argv.find(arg => arg.startsWith('--group-roots='))?.slice(14);
if (groupingPath) prepared.records = groupSpokenSources(prepared.records, JSON.parse(await readFile(groupingPath, 'utf8')));
const target = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? `${directory}/listening-packs`;
await mkdir(target, { recursive: true });
const packs = [];
for (let offset = 0; offset < prepared.records.length;) {
  const batch = prepared.records.slice(offset, offset + (prepared.records.length - offset === 31 ? 31 : 30));
  const id = `wikipedia-listening-${String(offset / 30 + 1).padStart(3, '0')}`;
  const files = {}, credits = [];
  const records = [];
  for (const record of batch) {
    const author = authorByRoot.get(record.rootId);
    const source = sources.get(record.rootId);
    if (!source || !author || author.length > 300) throw new Error('SOURCE_CREDIT');
    const textSource = { id: source.id, title: source.title, author: source.authors.join('; '), license: source.licence, attribution: source.attribution, sourceUrl: source.originalUrl };
    const audioSource = { id: `recording-${record.fileId}`, title: `${source.title} — original recording`, author: author, license: record.provenance.licence,
      attribution: `${author}. Original recording of ${source.title}.`, sourceUrl: record.provenance.audioSourceUrl };
    credits.push(textSource, audioSource);
    const excludedTargets = reviewed.targetExclusions.get(record.rootId);
    const clips = [];
    for (const clip of record.clips) {
      const full = sourceAnnotations.get(record.rootId);
      if (sourceAnnotations.size && !full) throw new Error('SOURCE_LANGUAGE_MISSING');
      if (full && full.textHash !== record.textSha256) throw new Error('SOURCE_LANGUAGE_CHANGED');
      const annotation = annotations.get(clip.id) ?? (full ? { textHash: sha(clip.text), language: { ...full.language,
        tokens: full.language.tokens.filter(token => token.start >= clip.start && token.end <= clip.end)
          .map(token => ({ ...token, start: token.start - clip.start, end: token.end - clip.start })) } } : undefined);
      if (annotationPath && (!annotation || annotation.textHash !== sha(clip.text))) throw new Error('Missing or changed clip annotation');
      const bytes = await readFile(`${clipsDirectory}/${clip.file}`);
      if (sha(bytes) !== clip.sha256) throw new Error('RECORDING_INTEGRITY');
      const filename = `media/${clip.id}.mp3`; files[filename] = bytes;
      clips.push({ ...(annotation ? { language: reviewedLanguage(clip.text, annotation.language, excludedTargets) } : {}), id: clip.id, text: clip.text, wordCount: clip.wordCount, segments: clip.segments, reviewStatus: 'pending', qualityFlags: [...record.qualityFlags, ...(audioHolds.has(clip.id) ? [audioHolds.get(clip.id)] : [])], processing: `${clip.processing} Automatic transcript: ${record.model}@${record.modelRevision}.`,
        audioSourceId: audioSource.id, audio: { src: filename, sha256: clip.sha256, duration: clip.duration, author: audioSource.author, sourceUrl: audioSource.sourceUrl, license: audioSource.license, synthetic: false },
        credit: { attribution: `${textSource.attribution} Recording: ${audioSource.attribution}`, license: `${textSource.license}; recording: ${audioSource.license}`, sourceUrl: textSource.sourceUrl } });
    }
    records.push({ ...source, processing: `${source.processing} Automatically matched original-recording excerpts; Codex audio/transcript and suitability review pending.`, clips });
  }
  files['lessons.json'] = Buffer.from('[]');
  files['sources.json'] = Buffer.from(JSON.stringify(credits));
  files['spoken.json'] = Buffer.from(JSON.stringify({ version: 1, records }));
  if (files['spoken.json'].length > 5 * 1024 * 1024) throw new Error('BANK_LIMIT');
  const manifest = { format: 'lingfern-community-content', version: 1, id, language: 'en', levels: ['B2'], materialCount: 0,
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha(bytes) }])) };
  const zip = zipSync(Object.fromEntries(Object.entries({ ...files, 'manifest.json': Buffer.from(JSON.stringify(manifest)) }).map(([name, bytes]) => [name, [bytes, { mtime: new Date('1980-01-01T00:00:00Z') }]])), { level: 6 });
  if (zip.length > 100 * 1024 * 1024) throw new Error('BANK_LIMIT');
  await writeFile(`${target}/${id}.zip`, zip);
  packs.push({ id, bytes: zip.length, sha256: sha(zip), roots: batch.length, clips: records.reduce((sum, source) => sum + source.clips.length, 0) });
  offset += batch.length;
}
const result = { roots: prepared.records.length, clips: prepared.records.reduce((sum, record) => sum + record.clips.length, 0), seconds: prepared.records.reduce((sum, record) => sum + record.clips.reduce((total, clip) => total + clip.duration, 0), 0), textReview: reviewed.review, independentlyReviewed: 0, approvedChecks: 0, published: false, packs };
await writeFile(`${target}/inventory.json`, JSON.stringify(result, null, 2) + '\n');
await writeFile(`${target}/README.md`, '# Local original-recording banks\n\nExplicit local import/review only; hash-bound text withholding applied, without audio or publication approval; separate ShareAlike text/audio terms and named recording contributors are retained. The ZIPs listed in inventory.json contain source recordings and automatically matched draft transcripts, not prewritten lessons or approved checks. The browser generates exact-word and self-assessed interpretation practice from two different original roots, scoped to one installed ZIP. B2 is the existing draft route, not validated material difficulty or learner ability. Keep these ZIPs: learning backups retain generated sessions but not the full installed media bank. Quality flags and ASR model revisions are retained. Flagged clips and legacy clips missing audit metadata are withheld from new practice; all unflagged clips still await actual audio/transcript review. No publication or independent editorial approval.\n');
console.log(JSON.stringify({ roots: result.roots, clips: result.clips, packs: packs.length, bytes: packs.reduce((sum, pack) => sum + pack.bytes, 0), published: false }));
