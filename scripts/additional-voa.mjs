import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hash, processArticle } from './corpus.mjs';

export async function prepareAdditionalVOA() {
  const sources = JSON.parse(await readFile('content/corpus/voa-additional-sources.json', 'utf8'));
  const corpus = JSON.parse(await readFile('public/corpus/voa.json', 'utf8'));
  for (const source of sources.records) {
    if (hash(source.text) !== source.sha256 || source.reviewer !== 'Codex/AI'
      || !/^https:\/\/learningenglish\.voanews\.com\/a\/[a-z0-9-]+\/\d+\.html$/.test(source.url)) throw new Error('VOA_SOURCE_INTEGRITY');
    const excluded = source.excludedSpans.map(span => ({ ...span, text: source.text.slice(span.start, span.end) }));
    const passages = processArticle(source.text, true, excluded);
    for (const excerpt of source.supportedExcerpts ?? []) {
      const text = source.text.slice(excerpt.start, excerpt.end), wordCount = text.trim().split(/\s+/).length;
      if (!Number.isSafeInteger(excerpt.start) || !Number.isSafeInteger(excerpt.end) || excerpt.start <= 0 || excerpt.end <= excerpt.start || excerpt.end > source.text.length
        || source.text[excerpt.start - 1] !== '\n' || excerpt.end < source.text.length && source.text[excerpt.end] !== '\n'
        || excerpt.sourceHash !== source.sha256 || hash(text) !== excerpt.sha256 || excerpt.reviewer !== 'Codex/AI' || excerpt.decision !== 'supported-beginner-text'
        || JSON.stringify(excerpt.startingPoints) !== '["A2"]' || wordCount < 40 || wordCount > 160 || text.length > 12000
        || !/^[A-Z][a-z]{1,20}: /.test(text) || !/[.!?]$/.test(text) || excluded.some(span => excerpt.start < span.end && excerpt.end > span.start)) throw new Error('INVALID_VOA_SUPPORTED_EXCERPT');
      passages.push({ id: hash(text), text, wordCount, startingPoints: excerpt.startingPoints });
    }
    if (!passages.length || passages.some(passage => hash(passage.text) !== passage.id || !source.text.includes(passage.text))) throw new Error('VOA_PREPARATION_FAILED');
    const id = `voa-${source.id}`, rootId = `voa-article-${source.id}`;
    corpus.records = corpus.records.filter(record => record.rootId !== rootId);
    corpus.records.push({ id, rootId, title: source.title, authors: [source.author], originalUrl: source.url, downloadUrl: source.url,
      acquiredAt: source.acquiredAt ?? sources.acquiredAt, language: 'en', licence: 'Original VOA Learning English text: public domain with attribution. No agency content or media included.',
      licenceUrl: sources.permissionUrl, attribution: `${source.title} — ${source.author}. VOA Learning English (${source.url}).`,
      // Preserve held text as evidence even when every passage excludes it.
      sourceHash: source.sha256, ...(!excluded.length ? { originalText: source.text } : {}), reviewStatus: 'draft', editorialReview: 'pending',
      permissionReview: source.permissionReview ?? 'Official VOA own-author text and reuse policy checked2026-10-08. Captured page text only; no agency media or third-party song lyrics included.',
      processing: 'Complete specified official-page prose/conversation capture; SHA binds retained text, not HTML response bytes. Whitespace-normalised contiguous paragraphs only; configured exclusions never spliced. Codex/AI inspected retained text scope. No authored questions or CEFR calibration.', passages });
  }
  await writeFile('public/corpus/voa.json', JSON.stringify(corpus) + '\n');
  await writeFile('content/corpus/voa.json', JSON.stringify(corpus, null, 2) + '\n');
  return sources.records.length;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Prepared ${await prepareAdditionalVOA()} additional official VOA texts.`);
