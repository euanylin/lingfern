import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createTopicPacks, sha } from './topic-packs.mjs';
import { canonicalBook } from './corpus.mjs';

// Preparation only: reuse inspected bulk-source windows; ordinary builds read the saved public catalogue.
const check = process.argv.includes('--check'), inputPath = 'private/corpus/teaching-contexts/inputs.json';
const input = JSON.parse(await readFile(inputPath, 'utf8'));
assert.equal(input.version, 1); assert.equal(input.entries.length, 48);
const scopes = (await Promise.all(['c1-implicit-intention', 'c1-discourse-organization', 'c1-register-audience', 'c1-argument-boundaries', 'c1-indirect-stance', 'c1-information-density', 'c2-nuanced-meaning', 'c2-rhetorical-function', 'c2-layered-position', 'c2-complex-pragmatics', 'c2-faithful-paraphrase', 'c2-disagreement-synthesis'].map(async name => JSON.parse(await readFile(`content/corpus/${name}-scopes.json`, 'utf8'))))).flatMap(s => s.reading);
const admissions = JSON.parse(await readFile('content/corpus/long-listening-admission.json', 'utf8')).records;
const originalCatalogue = JSON.parse(await readFile('content/source-packs.json', 'utf8'));
const titles = Object.fromEntries(originalCatalogue.packs.map(p => [p.topic, Object.fromEntries(Object.entries(p.title).map(([locale, title]) => [locale, title.split(' · ')[1]]))]));
const load = async file => {
  assert.match(file.path, /^private\/corpus\/teaching-contexts\/[a-f0-9]{64}(?:-[a-zA-Z0-9._-]+)?\.(?:mp3|txt|md)$/);
  const bytes = await readFile(file.path); assert.equal(sha(bytes), file.sha256); return bytes;
};
const entries = [];
for (const entry of input.entries) {
  const record = entry.record;
  assert(['reading', 'listening'].includes(entry.skill) && titles[entry.topic]);
  if (entry.skill === 'reading') {
    assert.match(record.id, /^gutenberg-\d+$/);
    assert.equal(record.rootId, 'gutenberg-book-' + record.id.slice('gutenberg-'.length));
    const raw = await readFile(`content/corpus/raw/pg${record.id.slice('gutenberg-'.length)}.txt`);
    assert.equal(sha(raw), record.sourceHash);
    const canonical = canonicalBook(raw.toString());
    for (const passage of record.passages) {
      const scope = scopes.find(s => s.rootId === record.rootId && s.passageId === passage.id); assert(scope?.nativeScope);
      assert.equal(scope.sourceHash, record.sourceHash); assert.equal(sha(passage.text), scope.textSha256);
      assert.equal(sha(canonical), scope.nativeScope.canonicalSha256);
      assert.equal(canonical.slice(scope.nativeScope.start, scope.nativeScope.end), passage.text);
      assert.equal(passage.wordCount, passage.text.trim().split(/\s+/).length);
    }
  } else {
    for (const clip of record.clips) {
      const a = admissions.find(a => a.rootId === record.rootId && a.clip.id === clip.id); assert(a);
      assert.equal(a.sourceHash, record.sourceHash); assert.equal(a.sourceUrl, record.originalUrl);
      assert.equal(a.originalTextSha256, sha(record.originalText)); assert.equal(record.licence, a.textLicence);
      assert(record.attribution.startsWith(a.textAttributionPrefix));
      for (const key of ['text', 'duration', 'author', 'license', 'sourceUrl']) assert.equal(key === 'text' ? clip.text : clip.audio[key], a.clip[key]);
      assert.equal(clip.audio.sha256, a.clip.audioSha256);
      for (const notice of a.notices ?? []) assert.equal(entry.notices[notice.name]?.sha256, notice.sha256);
    }
  }
  entries.push({ ...entry, media: Object.fromEntries(await Promise.all(Object.entries(entry.media).map(async ([name, file]) => [name, await load(file)]))), notices: Object.fromEntries(await Promise.all(Object.entries(entry.notices).map(async ([name, file]) => [name, await load(file)]))) });
}
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { inspectCommunityPack } = await server.ssrLoadModule('/src/data/communityPack.ts');
  const { reviewedReading, reviewedExcerpts } = await server.ssrLoadModule('/src/data/corpus.ts');
  const { corpusLesson } = await server.ssrLoadModule('/src/core/corpus.ts');
  const { spokenCorpusLesson } = await server.ssrLoadModule('/src/core/spokenCorpus.ts');
  const { gutenbergTerms } = await server.ssrLoadModule('/src/shared/sourceLicence.ts');
  const packed = createTopicPacks(entries, titles, gutenbergTerms), catalogue = [];
  for (const pack of packed) {
    const inspected = await inspectCommunityPack(pack.bytes); assert.equal(inspected.hash, pack.entry.sha256); assert.equal(inspected.lessons.length, 0);
    const skill = pack.entry.skill, bank = skill === 'reading' ? inspected.corpus : inspected.spoken;
    if (skill === 'reading') assert.equal((await reviewedReading(bank.records, 1800)).reduce((n, r) => n + r.passages.length, 0), pack.entry.passages);
    else for (const r of bank.records) assert.equal((await reviewedExcerpts(r, r.clips)).length, r.clips.length);
    const bounds = skill === 'reading' ? [120, 160, 220, 300, 500, 700, 1200, 1800] : [8, 12, 20, 25, 35, 60, 75, 91, 120, 150, 180, 220];
    const minimum = bounds.find(value => skill === 'reading' ? corpusLesson(bank, new Set(), 0, value, 'B2') : spokenCorpusLesson(bank, new Set(), 0, value, 'B2')) ?? null;
    const summary = [...new Set(pack.inputs.map(e => e.record.title))].slice(0, 2).join(' / ').slice(0, 120);
    catalogue.push({ ...pack.entry, title: Object.fromEntries(Object.entries(pack.entry.title).map(([locale, title]) => [locale, title + ' · ' + summary])), minWords: skill === 'reading' ? minimum : null, minSeconds: skill === 'listening' ? minimum : null });
  }
  // Validate every source/notice before writing; retain all older site packages byte-for-byte.
  const manifestPath = 'content/corpus/teaching-source-packs.json', prior = JSON.parse(await readFile(manifestPath, 'utf8').catch(e => { if (e.code === 'ENOENT') return '{"version":1,"packs":[]}'; throw e; }));
  const merged = originalCatalogue.packs.filter(p => !prior.packs.some(old => old.id === p.id));
  for (const pack of packed) {
    const target = 'public' + pack.entry.path, existing = await readFile(target).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
    if (check) assert(existing?.equals(pack.bytes), 'TEACHING_SOURCE_ASSET: ' + target);
    else { await mkdir('public/source-packs', { recursive: true }); if (existing) assert(existing.equals(pack.bytes), 'TEACHING_SOURCE_CHANGED: ' + target); else await writeFile(target, pack.bytes, { flag: 'wx' }); }
  }
  assert(!catalogue.some(p => merged.some(old => old.id === p.id)));
  const manifest = JSON.stringify({ version: 1, packs: catalogue }, null, 2) + '\n', full = JSON.stringify({ version: 1, packs: [...merged, ...catalogue] }, null, 2) + '\n';
  if (check) { assert.equal(await readFile(manifestPath, 'utf8'), manifest); assert.equal(await readFile('content/source-packs.json', 'utf8'), full); }
  else { await writeFile(manifestPath, manifest); await writeFile('content/source-packs.json', full); }
  console.log(JSON.stringify({ sourceOnly: true, sourceRecords: entries.length, readingRoots: entries.filter(e => e.skill === 'reading').length, listeningRoots: entries.filter(e => e.skill === 'listening').length, packages: catalogue.length, bytes: catalogue.reduce((n, p) => n + p.bytes, 0), olderPackagesRetained: merged.length, check }));
} finally { await server.close(); }
