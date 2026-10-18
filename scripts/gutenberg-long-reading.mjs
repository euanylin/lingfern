import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { canonicalBook, hash, processBook } from './corpus.mjs';

export function prepareLongPassage(record, scope, raw, metadata, policy) {
  const invalid = () => { throw Error('INVALID_GUTENBERG_LONG_SCOPE'); };
  if (scope.reviewer !== 'Codex/AI' || scope.decision !== 'accepted-source-scope' || !/^\d+$/.test(String(scope.bookId))
    || record.rootId !== `gutenberg-book-${scope.bookId}` || record.id !== `gutenberg-${scope.bookId}`
    || record.originalUrl !== `https://www.gutenberg.org/ebooks/${scope.bookId}`
    || record.downloadUrl !== `https://www.gutenberg.org/cache/epub/${scope.bookId}/pg${scope.bookId}.txt`
    || record.sourceHash !== scope.rawSha256 || hash(raw) !== scope.rawSha256
    || hash(metadata) !== scope.metadataSha256 || hash(policy) !== scope.policySha256
    || !/Public domain in the USA\./.test(metadata) || !/property="dcterms:language"[^>]*content="en"/.test(metadata)
    || record.licence !== 'Public domain in the USA; other jurisdictions require verification'
    || record.permissionReview !== 'USA public-domain label verified; regional review pending') invalid();
  const canonical = canonicalBook(raw), text = canonical.slice(scope.start, scope.end);
  if (hash(canonical) !== scope.canonicalSha256 || canonical.length !== scope.canonicalChars
    || !Number.isInteger(scope.start) || !Number.isInteger(scope.end) || scope.start < 0 || scope.end <= scope.start || scope.end > canonical.length
    || text.length > 12000 || hash(text) !== scope.textSha256 || text.trim().split(/\s+/).length !== scope.words
    || scope.words <= 700 || scope.words > 1800 || !Array.isArray(scope.passages) || scope.passages.length < 2
    || new Set(scope.passages).size !== scope.passages.length) invalid();
  const context = scope.context;
  if (!context || !Number.isInteger(context.beforeStart) || !Number.isInteger(context.afterEnd)
    || context.beforeStart < 0 || context.beforeStart > scope.start || context.afterEnd < scope.end || context.afterEnd > canonical.length
    || hash(canonical.slice(context.beforeStart, scope.start)) !== context.beforeSha256
    || hash(canonical.slice(scope.end, context.afterEnd)) !== context.afterSha256) invalid();
  const original = new Map(processBook(raw).map(passage => [passage.id, passage]));
  let end = scope.start;
  const parts = scope.passages.map((id, index) => {
    const passage = record.passages.find(passage => passage.id === id), acquired = original.get(id);
    if (!passage || !acquired || passage.text !== acquired.text || passage.wordCount !== acquired.wordCount
      || hash(passage.text) !== passage.id || passage.wordCount > 700 || passage.startingPoints || passage.task) invalid();
    const start = canonical.indexOf(passage.text);
    if (start < 0 || start !== canonical.lastIndexOf(passage.text) || start < end
      || (index === 0 && start !== scope.start) || !/^\s*$/.test(canonical.slice(end, start))) invalid();
    end = start + passage.text.length;
    return { passage, start };
  });
  if (end !== scope.end || parts.reduce((words, { passage }) => words + passage.wordCount, 0) !== scope.words) invalid();
  const language = parts[0].passage.language;
  const projected = language && parts.every(({ passage }) => passage.language?.generator === language.generator && passage.language?.modelSha256 === language.modelSha256)
    ? { ...language, tokens: parts.flatMap(({ passage, start }) => passage.language.tokens.map(token => ({ ...token,
      start: token.start + start - scope.start, end: token.end + start - scope.start }))) } : undefined;
  return { id: scope.textSha256, text, wordCount: scope.words, ...(projected ? { language: projected } : {}) };
}

export async function prepareGutenbergLongReading(check = false) {
  const path = 'content/corpus/gutenberg.json', corpus = JSON.parse(await readFile(path, 'utf8'));
  const scopes = JSON.parse(await readFile('content/corpus/gutenberg-long-scopes.json', 'utf8'));
  if (scopes.version !== 1 || new Set(scopes.records.map(scope => scope.textSha256)).size !== scopes.records.length) throw Error('INVALID_GUTENBERG_LONG_SCOPE');
  const policy = await readFile('content/corpus/gutenberg-license.html', 'utf8');
  for (const scope of scopes.records) {
    const record = corpus.records.find(record => record.rootId === `gutenberg-book-${scope.bookId}`);
    if (!record || record.originalText) throw Error('INVALID_GUTENBERG_LONG_SCOPE');
    const raw = await readFile(`content/corpus/raw/pg${scope.bookId}.txt`, 'utf8');
    const metadata = await readFile(`content/corpus/raw/pg${scope.bookId}-metadata.html`, 'utf8');
    const passage = prepareLongPassage(record, scope, raw, metadata, policy), existing = record.passages.find(item => item.id === passage.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(passage) || check && !existing) throw Error('GUTENBERG_LONG_OUTPUT_CHANGED');
    if (!existing) record.passages.push(passage);
  }
  if (!check) await writeFile(path, JSON.stringify(corpus, null, 2) + '\n');
  return corpus;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareGutenbergLongReading(process.argv.includes('--check'));
