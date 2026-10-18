import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { canonicalBook, hash, processBook } from './corpus.mjs';

export function prepareBeginnerPassage(record, scope, raw, metadata, policy) {
  const invalid = () => { throw Error('INVALID_GUTENBERG_BEGINNER_SCOPE'); };
  if (scope.bookId !== 45 || scope.reviewer !== 'Codex/AI' || scope.decision !== 'supported-beginner-text'
    || JSON.stringify(scope.startingPoints) !== '["A2"]' || record.id !== 'gutenberg-45' || record.rootId !== 'gutenberg-book-45'
    || record.originalUrl !== 'https://www.gutenberg.org/ebooks/45'
    || record.downloadUrl !== 'https://www.gutenberg.org/cache/epub/45/pg45.txt'
    || record.licenceUrl !== 'https://www.gutenberg.org/policy/license.html' || record.originalText
    || record.licence !== 'Public domain in the USA; other jurisdictions require verification'
    || record.permissionReview !== 'USA public-domain label verified; regional review pending'
    || scope.rawSha256 !== '89a5e9fb2e0bb44562a969785385366f94e1da736aebee7d9cdf459eb0b5f9f6'
    || record.sourceHash !== scope.rawSha256 || hash(raw) !== scope.rawSha256
    || scope.metadataSha256 !== '74919352fc0f7bb487a1237a1cc1e59694089bad79f56848be8b395335a0d742'
    || hash(metadata) !== scope.metadataSha256
    || scope.policySha256 !== '3ef4bb881c96ece56ace531fe88b4ffc0d6363a66473ae26ca1ad86bf6a6c4b6'
    || hash(policy) !== scope.policySha256 || !/Public domain in the USA\./.test(metadata)
    || !/property="dcterms:language"[^>]*content="en"/.test(metadata)) invalid();
  const canonical = canonicalBook(raw), text = canonical.slice(scope.start, scope.end);
  if (hash(canonical) !== scope.canonicalSha256 || canonical.length !== scope.canonicalChars
    || scope.start !== 45933 || scope.end !== 46653 || scope.words !== 129 || text !== scope.text
    || scope.textSha256 !== 'bc77a5ca5399ab1e53d269112af8031141ac764308588b0b3b1c87de0fbee873'
    || hash(text) !== scope.textSha256 || text.trim().split(/\s+/).length !== scope.words
    || canonical.indexOf(text) !== scope.start || canonical.lastIndexOf(text) !== scope.start
    || canonical.slice(scope.start - 2, scope.start) !== '\n\n' || canonical.slice(scope.end, scope.end + 2) !== '\n\n') invalid();
  const context = scope.context;
  if (!context || context.beforeStart !== 45133 || context.afterEnd !== 47853
    || context.beforeSha256 !== '05bb3fdd819ba7d520cf6f34c6f6dd03c47b8ada907d719e2cd380c22d5a3fe7'
    || context.afterSha256 !== '25263d45eb0cae23ccf1b3d9b4ab095d6f139c641f40da73a1ce5f09dc4e88ec'
    || hash(canonical.slice(context.beforeStart, scope.start)) !== context.beforeSha256
    || hash(canonical.slice(scope.end, context.afterEnd)) !== context.afterSha256) invalid();
  const parent = record.passages.find(passage => passage.id === scope.parentId);
  const original = processBook(raw).find(passage => passage.id === scope.parentId);
  if (scope.parentId !== 'd64fb628313d2dd4f1c3cc2439d1267a0b849562dee3ded1b507a37ec4e98510'
    || scope.parentWords !== 273 || scope.parentCanonicalStart !== 45122 || scope.parentScopeStart !== 811 || scope.parentScopeEnd !== 1531
    || !parent || !original || parent.text !== original.text || parent.wordCount !== 273 || parent.wordCount !== original.wordCount
    || parent.startingPoints || parent.task || hash(parent.text) !== parent.id
    || canonical.indexOf(parent.text) !== scope.parentCanonicalStart || parent.text.slice(scope.parentScopeStart, scope.parentScopeEnd) !== text) invalid();
  return { id: scope.textSha256, text, wordCount: scope.words, startingPoints: ['A2'] };
}

export async function prepareGutenbergBeginnerReading(check = false, write = true) {
  const path = 'content/corpus/gutenberg.json', corpus = JSON.parse(await readFile(path, 'utf8'));
  const scopes = JSON.parse(await readFile('content/corpus/gutenberg-beginner-scopes.json', 'utf8'));
  if (scopes.version !== 1 || !Array.isArray(scopes.records) || scopes.records.length !== 1) throw Error('INVALID_GUTENBERG_BEGINNER_SCOPE');
  const record = corpus.records.find(record => record.rootId === 'gutenberg-book-45');
  if (!record || corpus.records.filter(record => record.rootId === 'gutenberg-book-45').length !== 1) throw Error('INVALID_GUTENBERG_BEGINNER_SCOPE');
  const passage = prepareBeginnerPassage(record, scopes.records[0], await readFile('content/corpus/raw/pg45.txt', 'utf8'),
    await readFile('content/corpus/raw/pg45-metadata.html', 'utf8'), await readFile('content/corpus/gutenberg-license.html', 'utf8'));
  const existing = record.passages.filter(item => item.id === passage.id);
  if (existing.length > 1 || existing.length && JSON.stringify(existing[0]) !== JSON.stringify(passage) || check && !existing.length)
    throw Error('GUTENBERG_BEGINNER_OUTPUT_CHANGED');
  if (!existing.length) record.passages.push(passage);
  if (!check && write) await writeFile(path, JSON.stringify(corpus, null, 2) + '\n');
  return corpus;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareGutenbergBeginnerReading(process.argv.includes('--check'));
