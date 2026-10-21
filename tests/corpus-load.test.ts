import retainedListeningPacks from '../content/corpus/retained-listening-packs.json';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { loadCorpus } from '../src/data/corpus';
import { communityPacks } from '../src/data/db';
import { inspectCommunityPack } from '../src/data/communityPack';
import { sourcePacks } from '../src/data/sourcePacks';
import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import textReview from '../content/corpus/text-review-report.json';
import reviewRules from '../content/corpus/text-review-rules.json';
vi.mock('../src/data/communityInstall', () => ({ communityPackageReady: vi.fn(async () => true) }));
afterEach(() => vi.unstubAllGlobals());
it('applies exact reviewed spans and spelling exclusions to older excerpts without changing stored source text', async () => {
  const { reviewedExcerpts } = await import('../src/data/corpus');
  const expectedRules = textReview.records.map(record => ({ rootId: record.rootId, articleSha256: record.articleSha256,
    textSha256: record.textSha256, decision: record.decision, excludedTargets: record.excludedTargets ?? [],
    excludedSpans: (record.excludedSpans ?? []).map(span => ({ start: span.start, end: span.end, sha256: createHash('sha256').update(span.text).digest('hex') })) }));
  // Keep later exact Luther exclusions separate from the frozen review report.
  const religiousSpan = { start: 64194, end: 65009, sha256: '5ccb4e3b29ff2d3ef9e6f26f020c97c87e9cb6ce3f344f39374982e0bce72f70' };
  expectedRules.find(record => record.rootId === 'wikipedia-article-7567080')!.excludedSpans.push(religiousSpan);
  expect(reviewRules.records).toEqual(expectedRules);
  const originals = regressionSourcePacks.packs.filter(pack => pack.skill === 'reading').flatMap(pack => JSON.parse(strFromU8(unzipSync(readSourcePackFixture(pack.id))['corpus.json'])).records);
  const luther = originals.find((record: { rootId: string }) => record.rootId === 'wikipedia-article-7567080');
  const excludedText = luther.originalText.slice(religiousSpan.start, religiousSpan.end);
  expect(createHash('sha256').update(excludedText).digest('hex')).toBe(religiousSpan.sha256);
  expect(await reviewedExcerpts(luther, [{ text: excludedText }])).toEqual([]);
  const review = textReview.records.find(record => record.rootId === 'wikipedia-article-400970')!;
  const original = originals.find((record: { rootId: string }) => record.rootId === review.rootId);
  const source = { rootId: original.rootId, sourceHash: original.sourceHash, originalText: original.originalText };
  const clean = original.originalText.slice(review.excludedSpans![0].end, review.excludedSpans![1].start);
  const excerpts = [{ text: original.originalText }, { text: clean }, { text: 'not source wording' }];
  expect(await reviewedExcerpts(source, excerpts)).toEqual([{ text: clean }]);
  const compactSpan = reviewRules.records.find(record => record.rootId === review.rootId)!.excludedSpans[0];
  const spanHash = compactSpan.sha256;
  try {
    compactSpan.sha256 = '0'.repeat(64);
    expect(await reviewedExcerpts(source, excerpts)).toEqual([]);
  } finally { compactSpan.sha256 = spanHash; }
  expect(excerpts[0].text).toBe(original.originalText);
  for (const changed of [{ ...source, sourceHash: '0'.repeat(64) }, { ...source, originalText: source.originalText + 'changed' }, { ...source, originalText: undefined }])
    expect(await reviewedExcerpts(changed, excerpts)).toEqual([]);
  const targetSource = originals.find((record: { rootId: string }) => record.rootId === 'wikipedia-article-10427125');
  const start = targetSource.originalText.indexOf('Barratt');
  expect(start).toBeGreaterThanOrEqual(0);
  const language = { generator: 'spacy-3.8.16/en_core_web_sm-3.8.0' as const, modelSha256: '0'.repeat(64), reviewStatus: 'pending' as const,
    tokens: [{ start, end: start + 7, lemma: 'barratt', pos: 'NOUN' as const }] };
  const filtered = await reviewedExcerpts({ rootId: targetSource.rootId, sourceHash: targetSource.sourceHash, originalText: targetSource.originalText }, [{ text: targetSource.originalText, language }]);
  expect(filtered[0].language!.tokens).toEqual([]);
  expect(language.tokens).toHaveLength(1);
});
it('rejects corrupt corpus bytes and retries with a verified complete package', async () => {
  const fetch = vi.fn(async path => new Response(readFileSync('public' + path))).mockResolvedValueOnce(new Response('{"version":1}'));
  vi.stubGlobal('fetch', fetch);
  await expect(loadCorpus()).rejects.toThrow('CORPUS_INTEGRITY');
  const corpus = await loadCorpus();
  const prepared = JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8'));
  expect(corpus.records).toEqual(prepared.records);
  expect(corpus.records.length).toBeGreaterThanOrEqual(35);
  expect(corpus.records.reduce((sum, source) => sum + source.passages.length, 0)).toBeGreaterThanOrEqual(12317);
  for (const source of corpus.records) expect(source.sourceHash).toBe(createHash('sha256').update(readFileSync(`content/corpus/raw/pg${source.id.slice('gutenberg-'.length)}.txt`)).digest('hex'));
  expect(await loadCorpus()).toBe(corpus);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch).toHaveBeenLastCalledWith('/corpus/gutenberg-2.json', { credentials: 'omit' });
});

it('rejects a corrupt second Gutenberg file and reloads all files without losing any source or passage', async () => {
  vi.resetModules();
  const { loadCorpus: load } = await import('../src/data/corpus');
  let corrupt = true;
  const fetch = vi.fn(async path => new Response(path === '/corpus/gutenberg-2.json' && corrupt ? '{"version":1}' : readFileSync('public' + path)));
  vi.stubGlobal('fetch', fetch);
  await expect(load('gutenberg')).rejects.toThrow('CORPUS_INTEGRITY');
  corrupt = false;
  const corpus = await load('gutenberg');
  const original = JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8'));
  expect(corpus.records).toEqual(original.records);
  expect(corpus.failures).toEqual(original.failures);
  expect(corpus.records).toHaveLength(38);
  expect(corpus.records.reduce((sum, record) => sum + record.passages.length, 0)).toBe(12846);
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(await load('gutenberg')).toBe(corpus);
});

it('combines available text sources without a learner source selector', async () => {
  const { loadReadingCorpus } = await import('../src/data/corpus');
  vi.stubGlobal('fetch', vi.fn(async path => new Response(readFileSync('public' + path))));
  const corpus = await loadReadingCorpus('source-free-test');
  expect(corpus.records.some(record => record.id.startsWith('voa-'))).toBe(true);
  expect(corpus.records.some(record => record.id.startsWith('gutenberg-'))).toBe(true);
  expect(new Set(corpus.records.map(record => record.rootId)).size).toBe(corpus.records.length);
});

it.each(['voa', 'additional'] as const)('loads every %s shard in numeric order and rejects corrupt later bytes', async family => {
  vi.resetModules();
  const { loadCorpus: load } = await import('../src/data/corpus');
  const { runtimeResources } = await import('../src/data/runtimeResources');
  const group = runtimeResources.offline.groups.find(group => group.id === 'corpus')!;
  const files = group.files;
  const record = JSON.parse(readFileSync(`public/corpus/${family}.json`, 'utf8')).records[0];
  const paths = [`/corpus/${family}.json`, `/corpus/${family}-2.json`, `/corpus/${family}-10.json`];
  const bodies = paths.map((_, index) => JSON.stringify({ version: 1, failures: [], records: [{ ...record, id: record.id.replace(/\d+$/, String(9000000 + index)), rootId: record.rootId.replace(/\d+$/, String(9000000 + index)) }] }));
  const declared = bodies.map((body, index) => ({ path: paths[index], bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') }));
  let corrupt = true;
  const fetch = vi.fn(async path => new Response(path === paths[1] && corrupt ? '{}' : bodies[paths.indexOf(path)]));
  vi.stubGlobal('fetch', fetch);
  try {
    group.files = [declared[2], declared[0], declared[1]];
    await expect(load(family)).rejects.toThrow('CORPUS_INTEGRITY');
    corrupt = false;
    const corpus = await load(family);
    expect(corpus.records.map(item => item.id)).toEqual([0, 1, 2].map(index => record.id.replace(/\d+$/, String(9000000 + index))));
    expect(fetch.mock.calls.slice(2).map(call => call[0])).toEqual(paths);
    expect(await load(family)).toBe(corpus);
  } finally { group.files = files; }
});

it('withholds rejected roots from every installed-source loader without deleting saved packages', async () => {
  const { loadReadingCorpus, loadSpokenCorpora } = await import('../src/data/corpus');
  const profileId = 'withholding-regression', rejected = 'wikipedia-article-16640011';
  try {
    for (const skill of ['reading', 'listening']) {
      const pack = await inspectCommunityPack(readSourcePackFixture(skill === 'reading' ? 'wikipedia-reading-001' : 'wikipedia-listening-010'));
      if (pack.corpus) {
        const index = pack.corpus.records.findIndex(record => record.id.startsWith('wikipedia-'));
        expect(index).toBeGreaterThanOrEqual(0);
        pack.corpus.records[index] = { ...pack.corpus.records[index], rootId: rejected };
      }
      if (pack.spoken) pack.spoken.records[0] = { ...pack.spoken.records[0], rootId: rejected };
      await communityPacks.put({ ...pack, profileId, state: 'ready', installedAt: '2026-10-02T00:00:00.000Z' });
    }
    vi.stubGlobal('fetch', vi.fn(async path => new Response(readFileSync('public' + path))));
    expect((await loadCorpus('wikipedia', profileId)).records.some(record => record.rootId === rejected)).toBe(false);
    expect((await loadReadingCorpus(profileId)).records.some(record => record.rootId === rejected)).toBe(false);
    const spoken = await loadSpokenCorpora(profileId);
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken.every(bank => bank.records.every(record => record.rootId !== rejected))).toBe(true);
    const saved = await communityPacks.where('profileId').equals(profileId).toArray();
    expect(saved).toHaveLength(2);
    expect(saved.every(pack => (pack.corpus?.records ?? pack.spoken?.records)?.some(record => record.rootId === rejected))).toBe(true);
  } finally { await communityPacks.where('profileId').equals(profileId).delete(); }
});

it('uses the current site listening edition for new practice while retaining older media records', async () => {
  const { loadSpokenCorpora } = await import('../src/data/corpus');
  const profileId = 'listening-edition-regression';
  const entry = sourcePacks.find(pack => pack.skill === 'listening')!;
  const pack = await inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)));
  const oldHash = 'f'.repeat(64);
  const old = { ...pack, hash: oldHash, spoken: { ...pack.spoken!, communityPackageId: oldHash,
    records: pack.spoken!.records.map(record => ({ ...record, clips: record.clips.map(clip => ({ ...clip,
      audio: { ...clip.audio, src: clip.audio.src.replace(pack.hash, oldHash) } })) })) } };
  try {
    await communityPacks.put({ ...old, profileId, state: 'ready', installedAt: '2026-10-01T00:00:00.000Z' });
    expect(await loadSpokenCorpora(profileId)).toEqual([]);
    await communityPacks.put({ ...pack, profileId, state: 'ready', installedAt: '2026-10-02T00:00:00.000Z' });
    const loaded = await loadSpokenCorpora(profileId);
    expect(loaded.map(bank => bank.communityPackageId)).toEqual([pack.hash]);
    expect(loaded[0].records.map(record => record.rootId)).toEqual(pack.spoken!.records.map(record => record.rootId));
    expect(await communityPacks.get([profileId, oldHash])).toBeDefined();
    expect(await communityPacks.where('profileId').equals(profileId).count()).toBe(2);
  } finally { await communityPacks.where('profileId').equals(profileId).delete(); }
});

it('loads the complete expanded site catalogue without raising the custom-package allowance', async () => {
  const { loadSpokenCorpora } = await import('../src/data/corpus');
  const profileId = 'expanded-listening-regression';
  const entries = sourcePacks.filter(pack => pack.skill === 'listening');
  expect(entries.length).toBeGreaterThan(100);
  try {
    for (const entry of entries) {
      const pack = await inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)));
      await communityPacks.put({ ...pack, profileId, state: 'ready', installedAt: '2026-10-12T00:00:00.000Z' });
    }
    expect(await loadSpokenCorpora(profileId)).toHaveLength(entries.length);
    for (const entry of retainedListeningPacks.records) {
      const current = entries.find(pack => pack.id.startsWith(entry.id.slice(0, entry.id.lastIndexOf('-') + 1)))!;
      const pack = await inspectCommunityPack(new Uint8Array(readFileSync('public' + current.path)));
      // Test retained identity separately from original-archive conservation.
      const spoken = structuredClone(pack.spoken!);
      spoken.communityPackageId = entry.sha256;
      for (const record of spoken.records) for (const clip of record.clips) clip.audio.src = clip.audio.src.replace(pack.hash, entry.sha256);
      await communityPacks.put({ ...pack, id: entry.id, hash: entry.sha256, spoken, profileId,
        state: 'ready', installedAt: '2026-10-13T00:00:00.000Z' });
    }
    const sample = (await communityPacks.where('profileId').equals(profileId).toArray())[0];
    for (let index = 0; index < 100; index++) {
      const hash = index.toString(16).padStart(64, '0'), spoken = structuredClone(sample.spoken!);
      spoken.communityPackageId = hash;
      for (const record of spoken.records) for (const clip of record.clips) clip.audio.src = clip.audio.src.replace(sample.hash, hash);
      await communityPacks.put({ ...sample, profileId, id: `custom-limit-${index}`, hash, spoken });
    }
    expect(await loadSpokenCorpora(profileId)).toHaveLength(entries.length + retainedListeningPacks.records.length + 100);
    await communityPacks.put({ ...sample, id: 'custom-limit-100',
      hash: (100).toString(16).padStart(64, '0') });
    await expect(loadSpokenCorpora(profileId)).rejects.toThrow('CORPUS_LIMIT');
  } finally { await communityPacks.where('profileId').equals(profileId).delete(); }
}, 30000);

it('retains every passage when one immutable source is split across installed topic packages', async () => {
  const { loadReadingCorpus } = await import('../src/data/corpus');
  const source = JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')).records[0];
  const rootId = 'gutenberg-book-9000000', profileId = 'topic-shards-regression';
  const record = { ...source, id: 'gutenberg-9000000', rootId };
  const parts = [source.passages.slice(0, 4), source.passages.slice(3, 6)];
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Offline'); }));
  try {
    for (const [index, passages] of parts.entries()) await communityPacks.put({ id: `topic-shard-${index}`, hash: String(index + 1).repeat(64), profileId, state: 'ready', installedAt: new Date().toISOString(), lessons: [], sources: [], dictionary: [], corpus: { version: 1, failures: [], records: [{ ...record, passages }] } });
    const loaded = await loadReadingCorpus(profileId);
    expect(loaded.records.find(item => item.rootId === rootId)?.passages).toEqual(source.passages.slice(0, 6));
    const changed = await communityPacks.get([profileId, '2'.repeat(64)]);
    await communityPacks.put({ ...changed!, corpus: { ...changed!.corpus!, records: [{ ...record, sourceHash: 'f'.repeat(64), passages: parts[1] }] } });
    expect((await loadReadingCorpus(profileId)).records.find(item => item.rootId === rootId)?.passages).toEqual(parts[1]);
  } finally { await communityPacks.where('profileId').equals(profileId).delete(); }
});

it('loads every open-reading shard from its separate bounded resource group', async () => {
  vi.resetModules();
  const { loadCorpus: load } = await import('../src/data/corpus');
  const fetch = vi.fn(async path => new Response(readFileSync('public' + path)));
  vi.stubGlobal('fetch', fetch);
  const corpus = await load('open-reading');
  const files = JSON.parse(readFileSync('content/offline-resources.json', 'utf8')).groups
    .find((group: { id: string }) => group.id === 'corpus-open-reading').files as { path: string }[];
  expect(corpus.records).toEqual(files.flatMap(file => JSON.parse(readFileSync('public' + file.path, 'utf8')).records));
  expect(fetch.mock.calls.map(call => call[0])).toEqual(files.map(file => file.path));
});
