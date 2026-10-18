import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { excludeUnavailableReading, readingGenerationAvailable } from '../scripts/reading-availability.mjs';

test('preparation probes later seeds and actual declared beginner support without inventing levels', () => {
 const source = { id: 'voa-1', rootId: 'voa-article-1', sourceHash: 'source', title: 'Title', originalText: 'raw', passages: [] };
 const passage = { id: 'passage', text: 'Untouched.', wordCount: 1, startingPoints: ['A2'] };
 const seen = [];
 assert(readingGenerationAvailable(source, passage, (_item, seed, level, kind) => { seen.push({ seed, level, kind }); return seed === 17 && level === 'A2' && kind === 'completion' ? {} : undefined; }));
 assert(seen.every(x => x.level === 'A2'));
 assert(seen.some(x => x.seed === 17));
 const result = excludeUnavailableReading([{ ...source, passages: [passage] }], () => undefined);
 assert.deepEqual(result.records, []);
 assert.equal(result.excluded[0].passageId, passage.id);
 assert.equal(result.excluded[0].text, passage.text);
 assert.equal(source.originalText, 'raw');
});

test('actual core rejects numerical/uppercase structure and preserves source metadata and usable prose', async () => {
 const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
 try {
  const { corpusMaterial } = await server.ssrLoadModule('/src/core/corpus.ts');
  const bad = { id: 'bad', text: '1701 1 17 8 1702 1 9 6 1703 1 16 0 1704 2 6 6 1705 1 10 0', wordCount: 25 };
  const shortQuote = { id: 'quote', text: 'To be, or not to be.', wordCount: 6, quoteProvenance: {} };
  const good = { id: 'good', text: 'The children carefully watched the bright windows before returning to the classroom.', wordCount: 13 };
  const source = { id: 'gutenberg-3300', rootId: 'gutenberg-book-3300', title: 'Title', authors: ['Author'], sourceHash: 'source', licence: 'Retained', originalText: 'Complete original retained', passages: [bad, good, shortQuote] };
  const result = excludeUnavailableReading([source], corpusMaterial);
  assert.deepEqual(result.excluded.map(x => x.passageId), ['bad', 'quote']);
  assert.deepEqual(result.records[0], { ...source, passages: [good] });
  assert.deepEqual(source.passages, [bad, good, shortQuote]);
  assert.equal(result.excluded[1].quote, true);
 } finally { await server.close(); }
});
