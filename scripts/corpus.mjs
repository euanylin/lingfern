import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const hash = text => createHash('sha256').update(text).digest('hex');
export function canonicalBook(raw) {
  const start = raw.match(/^\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/m);
  const end = raw.match(/^\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/m);
  if (!start || !end || end.index <= start.index) throw new Error('MISSING_SOURCE_BOUNDARIES');
  const body = raw.slice(start.index + start[0].length, end.index).replace(/\r/g, '').normalize('NFC');
  return body.split(/\n\s*\n/).map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}
export function processBook(raw) {
  const paragraphs = canonicalBook(raw).split('\n\n');
  const passages = [];
  let pending = [];
  let words = 0;
  const flush = () => {
    if (words >= 120 && words <= 700) {
      const text = pending.join('\n\n');
      passages.push({ id: hash(text), text, wordCount: words });
    }
    pending = []; words = 0;
  };
  for (const paragraph of paragraphs) {
    const count = paragraph.split(/\s+/).length;
    if (count > 700 || count < 5 || /^(?:CHAPTER|CONTENTS|ILLUSTRATION|BOOK|PART)\b/i.test(paragraph)) { flush(); continue; }
    if (words + count > 500) flush();
    pending.push(paragraph); words += count;
    if (words >= 240) flush();
  }
  flush();
  return [...new Map(passages.map(passage => [passage.id, passage])).values()];
}

export function processArticle(text, reviewed = false, excludedSpans = []) {
  if (excludedSpans.length) {
    let end = 0;
    for (const span of excludedSpans) {
      if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < end || span.end <= span.start || span.end > text.length || text.slice(span.start, span.end) !== span.text) throw new Error('INVALID_SPAN_EXCLUSION');
      end = span.end;
    }
    const chunks = [];
    let pending = '';
    // Drop the entire intersecting sentence; never splice across a reviewed exclusion.
    for (const part of new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)) {
      if (excludedSpans.some(span => part.index < span.end && part.index + part.segment.length > span.start)) {
        if (pending.trim()) chunks.push(pending.trim());
        pending = '';
      } else pending += part.segment;
    }
    if (pending.trim()) chunks.push(pending.trim());
    const passages = chunks.flatMap(chunk => processArticle(chunk, reviewed)).filter(passage => text.includes(passage.text));
    return [...new Map(passages.map(passage => [passage.id, passage])).values()];
  }
  const passages = processBook(`*** START OF THE PROJECT GUTENBERG EBOOK LOCAL BOUNDARY ***\n${text}\n*** END OF THE PROJECT GUTENBERG EBOOK LOCAL BOUNDARY ***`);
  const wordCount = text.trim().split(/\s+/).length;
  // Keep short headings and their context together only for an inspected whole article.
  if (!passages.length && reviewed && wordCount >= 120 && wordCount <= 700 && text.length <= 12000)
    passages.push({ id: hash(text), text, wordCount });
  return passages;
}

const ids = [1661, 1342, 11, 84, 2701, 98, 1400, 35, 36, 76, 74, 829, 1260, 120, 174, 345, 161, 209, 158, 215,
  55, 45, 113, 514, 768, 64317, 205, 1228, 2276, 1497, 1232, 3300, 1080, 2147, 521, 2500, 132, 27827, 2814, 1998];
const origin = 'https://www.gutenberg.org';
const directory = new URL('../content/corpus/', import.meta.url);
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: 'error' });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 8000000) throw new Error('SOURCE_TOO_LARGE');
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}
async function main() {
  await mkdir(new URL('raw/', directory), { recursive: true });
  const records = [];
  const failures = [];
  const previous = JSON.parse(await readFile(new URL('gutenberg.json', directory), 'utf8').catch(() => '{"records":[]}'));
  const cachedOrDownload = async (path, url) => {
    try { return await readFile(new URL(path, directory), 'utf8'); }
    catch { return download(url); }
  };
  const licence = await cachedOrDownload('gutenberg-license.html', `${origin}/policy/license.html`);
  await writeFile(new URL('gutenberg-license.html', directory), licence);
  for (const id of ids) {
    try {
      const pageUrl = `${origin}/ebooks/${id}`;
      const page = await cachedOrDownload(`raw/pg${id}-metadata.html`, pageUrl);
      if (!/Public domain in the USA\./.test(page)) throw new Error('UNVERIFIED_RIGHTS');
      if (!/property="dcterms:language"[^>]*content="en"/.test(page)) throw new Error('NOT_ENGLISH');
      const title = page.match(/itemprop="headline"[^>]*>([^<]+)/)?.[1]?.trim();
      const authors = [...page.matchAll(/itemprop="creator"[^>]*>([^<]+)/g)].map(match => match[1].trim());
      if (!title || !authors.length || authors.some(author => !/-\s*(16|17|18|19)\d{2}\b/.test(author) || Number(author.match(/-\s*((?:16|17|18|19)\d{2})\b/)[1]) > 1955)) throw new Error('AUTHOR_DATE_REVIEW_REQUIRED');
      const url = `${origin}/cache/epub/${id}/pg${id}.txt`;
      let raw;
      try { raw = await readFile(new URL(`raw/pg${id}.txt`, directory), 'utf8'); }
      catch { raw = await download(url); }
      if (!/^Language:\s*English\s*$/m.test(raw.replace(/\r/g, ''))) throw new Error('TEXT_LANGUAGE_MISMATCH');
      const passages = processBook(raw);
      if (!passages.length) throw new Error('NO_USABLE_PASSAGES');
      await writeFile(new URL(`raw/pg${id}.txt`, directory), raw);
      await writeFile(new URL(`raw/pg${id}-metadata.html`, directory), page);
      const prior = previous.records.find(record => record.id === `gutenberg-${id}` && record.sourceHash === hash(raw));
      records.push(prior ?? { id: `gutenberg-${id}`, rootId: `gutenberg-book-${id}`, title, authors, originalUrl: pageUrl, downloadUrl: url, acquiredAt: new Date().toISOString(), language: 'en', licence: 'Public domain in the USA; other jurisdictions require verification', licenceUrl: `${origin}/policy/license.html`, attribution: `${title} — ${authors.join('; ')}. Source: Project Gutenberg (${pageUrl}).`, sourceHash: hash(raw), reviewStatus: 'draft', permissionReview: 'USA public-domain label verified; regional review pending', editorialReview: 'pending', processing: 'Removed Gutenberg boundary/licence sections from excerpts; retained complete raw file and licence separately. Whitespace normalisation only. No factual rewriting; excerpts from the same book share one root.', passages });
      console.log(`Collected ${id}: ${passages.length} passages`);
    } catch (error) { failures.push({ id, error: error.message }); console.log(`Uncollected ${id}: ${error.message}`); }
    await writeFile(new URL('gutenberg.json', directory), JSON.stringify({ version: 1, records, failures }, null, 2) + '\n');
  }
  const passages = records.flatMap(record => record.passages);
  const report = { sources: records.length, passages: passages.length, words: passages.reduce((sum, passage) => sum + passage.wordCount, 0), distinctTexts: new Set(passages.map(passage => passage.id)).size, failures, reviewedExercises: 0, published: false };
  await writeFile(new URL('report.json', directory), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
