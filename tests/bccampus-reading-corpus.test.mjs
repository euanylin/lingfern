import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import { prepareBccampusReading } from '../scripts/bccampus-reading-corpus.mjs';

test('frozen BC originals admit18 exact scopes, reject altered support/roots/URLs and retain scoring', async () => {
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false } });
  try {
    const shared = await server.ssrLoadModule('/src/shared/openReading.ts');
    const { corpusSchema, corpusMaterial, corpusAddress, corpusPhone, corpusApartments, corpusRooms } = await server.ssrLoadModule('/src/core/corpus.ts');
    const { corpusOperation } = await server.ssrLoadModule('/src/core/corpusPractice.ts');
    const { score } = await server.ssrLoadModule('/src/shared/content.ts');
    const { records, review } = await prepareBccampusReading(shared);
    const bank = corpusSchema.parse({ version: 1, records, failures: [] });
    assert.deepEqual(records.map(r => r.passages.length), [2, 4, 2, 10]);
    assert.equal(shared.openReadingBeginnerScopes.length, 11);
    assert.equal(shared.openReadingBeginnerScopes.filter(s => s.sourceProvenance.workId === 'bccampus-abealfreader1').length, 7);
    assert.equal(review.excludedPassageIds.length, 21);
    const shorts = records.flatMap(source => source.passages.filter(p => p.startingPoints).map(passage => ({ source, passage })));
    assert.equal(shorts.length, 4);
    for (const source of bank.records) for (const passage of source.passages) {
      assert.equal(source.originalText, undefined);
      assert.equal(passage.sourceProvenance.workId, source.id);
      assert.equal(source.rootId, shared.openReadingEdition(source.id).rootId);
      const level = passage.startingPoints ? 'A2' : 'B1';
      for (const focus of ['completion', 'sequence']) {
        const material = corpusMaterial({ source, passage }, 0, level, focus);
        assert(material && material.questions.some(q => q.kind !== 'response'));
        const q = material.questions[0], evidence = passage.text.slice(q.evidence.start, q.evidence.end);
        if (q.kind === 'completion') {
          assert(evidence.includes(q.answer));
          assert.equal(score(q, q.answer).correct, true);
          assert.equal(score(q, 'Unmatched').correct, false);
        } else if (q.kind === 'sequence') {
          assert(q.acceptedOrders[0].every(sentence => evidence.includes(sentence)));
          assert.equal(score(q, q.acceptedOrders[0]).correct, true);
        }
        assert.throws(() => score(q, null));
      }
      for (const fn of [corpusAddress, corpusPhone, corpusApartments, corpusRooms]) assert.equal(fn(passage.text, 0), undefined);
    }
    for (const { source, passage } of shorts) {
      for (const mutation of [p => { p.startingPoints = ['A1']; }, p => { delete p.startingPoints; }, p => { p.sourceProvenance.paragraphIndex++; }, p => { p.sourceProvenance.rawSha256 = 'a'.repeat(64); }, p => { p.id = 'a'.repeat(64); }]) {
        const altered = structuredClone(source); mutation(altered.passages.find(p => p.id === passage.id));
        assert.equal(corpusSchema.safeParse({ version: 1, records: [altered], failures: [] }).success, false);
      }
      assert.equal(corpusOperation(corpusMaterial({ source, passage }, 0, 'A2', 'choice', 'choice:work-phone')?.questions[0]), 'completion');
    }
    const ordinary = structuredClone(records.find(source => source.id.endsWith('hospitality')));
    ordinary.passages[0].startingPoints = ['A2'];
    assert.equal(corpusSchema.safeParse({ version: 1, records: [ordinary], failures: [] }).success, false);
    for (const locator of ['chapter/../chapter-1', 'chapter/a/b', 'front-matter/chapter-1', 'chapter-1', 'chapter/%2e%2e']) assert.equal(shared.validOpenReadingChapter('bccampus-abealfreader2', `https://opentextbc.ca/abealfreader2/${locator}/`, locator), false);
    const url = 'https://opentextbc.ca/abealfreader2/chapter/chapter-1/';
    assert.equal(shared.validOpenReadingChapter('bccampus-abealfreader2', url, 'chapter/chapter-1'), true);
    assert.equal(shared.validOpenReadingChapter('bccampus-abealfreader2', url + '?x=1', 'chapter/chapter-1'), false);
    const corrupt = { ...shared, openReadingEdition: id => ({ ...shared.openReadingEdition(id), sourceHash: 'a'.repeat(64) }) };
    await assert.rejects(prepareBccampusReading(corrupt), /BCCAMPUS_BOOK_RIGHTS/);
  } finally { await server.close(); }
});
