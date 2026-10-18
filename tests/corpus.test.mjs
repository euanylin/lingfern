import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, processBook, processArticle } from '../scripts/corpus.mjs';
import { prepareBeginnerPassage } from '../scripts/gutenberg-beginner-reading.mjs';

test('Gutenberg beginner scope preserves the parent and rejects altered sources and boundaries before writing', async () => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const corpus = JSON.parse(await readFile('content/corpus/gutenberg.json', 'utf8'));
  const scopes = JSON.parse(await readFile('content/corpus/gutenberg-beginner-scopes.json', 'utf8'));
  const scope = scopes.records[0], record = corpus.records.find(record => record.rootId === 'gutenberg-book-45');
  const raw = await readFile('content/corpus/raw/pg45.txt', 'utf8'), metadata = await readFile('content/corpus/raw/pg45-metadata.html', 'utf8'), policy = await readFile('content/corpus/gutenberg-license.html', 'utf8');
  const passage = prepareBeginnerPassage(record, scope, raw, metadata, policy);
  assert.equal(passage.wordCount, 129);
  assert.deepEqual(passage.startingPoints, ['A2']);
  assert.equal(passage.text, record.passages.find(part => part.id === scope.parentId).text.slice(811, 1531));
  for (const change of [{ bookId: 11 }, { start: scope.start + 1 }, { end: scope.end - 1 }, { words: 130 }, { startingPoints: ['A1'] }, { reviewer: 'unreviewed' }, { decision: 'withheld' }, { textSha256: '0'.repeat(64) }, { canonicalSha256: '0'.repeat(64) }, { parentId: '0'.repeat(64) }, { parentScopeEnd: 1532 }, { context: { ...scope.context, afterSha256: '0'.repeat(64) } }])
    assert.throws(() => prepareBeginnerPassage(record, { ...scope, ...change }, raw, metadata, policy), /INVALID_GUTENBERG_BEGINNER_SCOPE/);
  for (const change of [{ id: 'voa-45' }, { rootId: 'gutenberg-book-11' }, { originalUrl: 'https://www.gutenberg.org/ebooks/11' }, { downloadUrl: 'https://www.gutenberg.org/cache/epub/11/pg11.txt' }, { sourceHash: '0'.repeat(64) }, { originalText: raw }, { permissionReview: 'worldwide' }])
    assert.throws(() => prepareBeginnerPassage({ ...record, ...change }, scope, raw, metadata, policy), /INVALID_GUTENBERG_BEGINNER_SCOPE/);
  for (const args of [[raw + 'changed', metadata, policy], [raw, metadata + 'changed', policy], [raw, metadata, policy + 'changed']])
    assert.throws(() => prepareBeginnerPassage(record, scope, ...args), /INVALID_GUTENBERG_BEGINNER_SCOPE/);
  const directory = await mkdtemp(join(tmpdir(), 'lingfern-gutenberg-beginner-'));
  try {
    await mkdir(join(directory, 'content/corpus/raw'), { recursive: true });
    const path = join(directory, 'content/corpus/gutenberg.json'), scopePath = join(directory, 'content/corpus/gutenberg-beginner-scopes.json');
    const original = structuredClone(corpus);
    original.records.find(record => record.rootId === 'gutenberg-book-45').passages = record.passages.filter(part => part.id !== passage.id);
    await writeFile(path, JSON.stringify(original));
    await writeFile(scopePath, JSON.stringify(scopes));
    await writeFile(join(directory, 'content/corpus/raw/pg45.txt'), raw);
    await writeFile(join(directory, 'content/corpus/raw/pg45-metadata.html'), metadata);
    await writeFile(join(directory, 'content/corpus/gutenberg-license.html'), policy);
    const run = script => spawnSync(process.execPath, [resolve(script)], { cwd: directory, encoding: 'utf8' });
    assert.equal(run('scripts/gutenberg-beginner-reading.mjs').status, 0);
    const valid = await readFile(path, 'utf8'), result = JSON.parse(valid);
    const expected = structuredClone(original);
    expected.records.find(record => record.rootId === 'gutenberg-book-45').passages.push(passage);
    assert.deepEqual(result, expected);
    assert.equal(run('scripts/gutenberg-beginner-reading.mjs').status, 0);
    assert.equal(await readFile(path, 'utf8'), valid);
    for (const change of [{ start: scope.start + 1 }, { context: { ...scope.context, beforeSha256: '0'.repeat(64) } }, { startingPoints: ['A1'] }]) {
      await writeFile(scopePath, JSON.stringify({ ...scopes, records: [{ ...scope, ...change }] }));
      for (const script of ['scripts/gutenberg-beginner-reading.mjs', 'scripts/corpus-package.mjs']) {
        const failed = run(script);
        assert.notEqual(failed.status, 0);
        assert.match(failed.stderr, /INVALID_GUTENBERG_BEGINNER_SCOPE/);
        assert.equal(await readFile(path, 'utf8'), valid);
      }
    }
    await writeFile(scopePath, JSON.stringify(scopes));
    result.records.find(record => record.rootId === 'gutenberg-book-45').passages.find(part => part.id === passage.id).startingPoints = ['A1'];
    await writeFile(path, JSON.stringify(result));
    assert.match(run('scripts/gutenberg-beginner-reading.mjs').stderr, /GUTENBERG_BEGINNER_OUTPUT_CHANGED/);
    assert.equal(await readFile(path, 'utf8'), JSON.stringify(result));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('corpus preprocessing preserves original words, root-independent text identities and source boundaries', () => {
  const paragraph = Array.from({ length: 130 }, (_, i) => `word${i}`).join(' ');
  const raw = `Title: Test\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\n\nCHAPTER I\n\n${paragraph}\n\nCHAPTER II\n\n${paragraph}\n\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\nLicence outside excerpts`;
  const passages = processBook(raw);
  assert.equal(passages.length, 1);
  assert.equal(passages[0].text, paragraph);
  assert.equal(passages[0].wordCount, 130);
  assert.equal(passages[0].id, hash(paragraph));
  assert.deepEqual(processBook(raw.replaceAll('\n', '\r\n')), passages);
  assert.throws(() => processBook('Unbounded source text'), /MISSING_SOURCE_BOUNDARIES/);
});

test('USGS preparation retains three frozen media-separated scopes and rejects changes before publishing', async () => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'lingfern-usgs-scope-'));
  try {
    await mkdir(join(directory, 'content/corpus/raw'), { recursive: true });
    for (const path of ['content/corpus/gutenberg.json', 'content/corpus/gutenberg-beginner-scopes.json', 'content/corpus/gutenberg-license.html', 'content/corpus/raw/pg45.txt', 'content/corpus/raw/pg45-metadata.html'])
      await writeFile(join(directory, path), await readFile(path));
    await mkdir(join(directory, 'content/corpus/additional/raw'), { recursive: true });
    await mkdir(join(directory, 'public/corpus'), { recursive: true });
    const source = JSON.parse(await readFile('content/corpus/usgs-water-cycle.json', 'utf8'));
    const capture = await readFile('content/corpus/additional/raw/usgs-water-cycle-web-capture.txt', 'utf8');
    const sourcePath = join(directory, 'content/corpus/usgs-water-cycle.json'), capturePath = join(directory, 'content/corpus/additional/raw/usgs-water-cycle-web-capture.txt');
    const corpusPath = join(directory, 'content/corpus/additional.json'), topicsPath = join(directory, 'content/corpus/additional-topics.json');
    const publicPath = join(directory, 'public/corpus/additional.json');
    await writeFile(sourcePath, JSON.stringify(source)); await writeFile(capturePath, capture);
    const old = JSON.parse(await readFile('content/corpus/additional.json', 'utf8')).records.filter(record => !record.id.startsWith('usgs-'));
    await writeFile(corpusPath, JSON.stringify({ version: 1, failures: [], records: old }));
    await writeFile(topicsPath, JSON.stringify({ version: 1, records: [] }));
    await writeFile(publicPath, 'PUBLIC_UNCHANGED');
    const run = (pack = false) => spawnSync(process.execPath, [resolve(pack ? 'scripts/corpus-package.mjs' : 'scripts/additional-corpus.mjs'), ...(!pack ? ['--usgs'] : [])], { cwd: directory, encoding: 'utf8' });
    assert.equal(run().status, 0);
    const valid = await readFile(corpusPath, 'utf8'), validTopics = await readFile(topicsPath, 'utf8');
    const records = JSON.parse(valid).records, prepared = records.at(-1);
    assert.deepEqual(records.slice(0, -1), old);
    assert.equal(prepared.originalText, undefined);
    assert.deepEqual(prepared.passages.map(p => p.wordCount), [231, 156, 304]);
    assert(prepared.passages.every(p => p.id === hash(p.text) && !p.startingPoints));
    assert.equal(run().status, 0); assert.equal(await readFile(corpusPath, 'utf8'), valid); assert.equal(await readFile(topicsPath, 'utf8'), validTopics);
    const changes = [
      s => { s.source += '?untrusted=1'; }, s => { s.rightsPolicy = 'https://www.usgs.gov/'; }, s => { s.author = 'Someone else'; },
      s => { s.captureSha256 = '0'.repeat(64); }, s => { s.reviewer = 'unreviewed'; }, s => { s.decision = 'withheld'; },
      s => { s.regionalRights = 'worldwide'; }, s => { s.acquiredAt = 'invalid'; }, s => { s.blocks.pop(); },
      s => { s.blocks[0].sha256 = '0'.repeat(64); }, s => { s.blocks[0].words += 1; }, s => { s.blocks[0].lineNumbers.push(41); },
      s => { s.blocks[0].text += '\n\n' + s.blocks[1].text; },
    ];
    for (const change of changes) {
      const invalid = structuredClone(source); change(invalid); await writeFile(sourcePath, JSON.stringify(invalid));
      for (const pack of [false, true]) { const result = run(pack); assert.notEqual(result.status, 0); assert.match(result.stderr, /INVALID_USGS_(?:SOURCE|SCOPE)/); }
      assert.equal(await readFile(corpusPath, 'utf8'), valid); assert.equal(await readFile(topicsPath, 'utf8'), validTopics); assert.equal(await readFile(publicPath, 'utf8'), 'PUBLIC_UNCHANGED');
    }
    const changedCapture = capture.replace('Water moves naturally', 'Water changes naturally'), selfDeclared = structuredClone(source);
    selfDeclared.captureSha256 = hash(changedCapture);
    await writeFile(sourcePath, JSON.stringify(selfDeclared)); await writeFile(capturePath, changedCapture);
    for (const pack of [false, true]) { const result = run(pack); assert.notEqual(result.status, 0); assert.match(result.stderr, /INVALID_USGS_SOURCE/); }
    assert.equal(await readFile(corpusPath, 'utf8'), valid); assert.equal(await readFile(publicPath, 'utf8'), 'PUBLIC_UNCHANGED');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('inspected short articles retain headings without weakening book or passage bounds', () => {
  const section = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
  const text = `${section}\n\nOverview\n\n${section}`;
  assert.deepEqual(processArticle(text), []);
  assert.deepEqual(processArticle(text, true), [{ id: hash(text), text, wordCount: 121 }]);
  assert.deepEqual(processArticle(section, true), []);
  assert.deepEqual(processArticle(Array(701).fill('word').join(' '), true), []);
  const longSection = Array(60).fill('x'.repeat(100)).join(' ');
  assert.deepEqual(processArticle(`${longSection}\n\nOverview\n\n${longSection}`, true), []);
  const connected = Array(130).fill('word').join(' ');
  assert.deepEqual(processArticle(connected, true), processArticle(connected));
});

test('reviewed exclusions preserve complete contiguous source sentences without joining or padding short fragments', () => {
  const before = 'Before ' + Array(130).fill('reading').join(' ') + '.';
  const after = 'After ' + Array(125).fill('writing').join(' ') + '.';
  const bad = 'This sentence contains a disputed current claim.';
  const text = `${before}\n\n${bad}\n\n${after}`;
  const start = text.indexOf('current'), span = { start, end: start + 7, text: 'current' };
  const passages = processArticle(text, true, [span]);
  assert.deepEqual(passages.map(p => p.text), [before, after]);
  assert(passages.every(p => text.includes(p.text) && p.wordCount >= 120 && p.wordCount <= 700 && p.id === hash(p.text)));
  const short = Array(70).fill('word').join(' ') + '.';
  const separated = `${short}\n\n${bad}\n\n${short}`;
  const badStart = separated.indexOf(bad);
  assert.deepEqual(processArticle(separated, true, [{ start: badStart, end: badStart + bad.length, text: bad }]), []);
  assert.deepEqual(processArticle(text, true, [{ start: 0, end: text.length, text }]), []);
  for (const spans of [[{ ...span, text: 'changed' }], [{ ...span, start: -1 }], [span, span]])
    assert.throws(() => processArticle(text, true, spans), /INVALID_SPAN_EXCLUSION/);
});


test('additional beginner excerpts reject changed review scope without publishing partial corpus', async () => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'lingfern-beginner-review-'));
  try {
    await mkdir(join(directory, 'content/corpus'), { recursive: true });
    await mkdir(join(directory, 'public/corpus'), { recursive: true });
    const sources = await readFile('content/corpus/voa-beginners.json', 'utf8');
    const review = JSON.parse(await readFile('content/corpus/voa-beginner-review.json', 'utf8'));
    await writeFile(join(directory, 'content/corpus/voa-beginners.json'), sources);
    const reviewPath = join(directory, 'content/corpus/voa-beginner-review.json');
    await writeFile(reviewPath, JSON.stringify(review));
    const corpusPath = join(directory, 'public/corpus/voa.json');
    await writeFile(corpusPath, JSON.stringify({ version: 1, failures: [], records: [] }));
    const run = () => spawnSync(process.execPath, [resolve('scripts/beginner-corpus.mjs')], { cwd: directory, encoding: 'utf8' });
    assert.equal(run().status, 0);
    const valid = await readFile(corpusPath, 'utf8');
    assert.equal(JSON.parse(valid).records.reduce((count, source) => count + source.passages.length, 0), 14);
    for (const change of [{ sha256: '0'.repeat(64) }, { startingPoints: ['A1'] }, { start: 1.5 }, { end: 999999 }, { reviewer: 'unreviewed' }, { decision: 'withheld' }]) {
      const invalid = structuredClone(review);
      Object.assign(invalid.records.find(record => record.additionalExcerpts).additionalExcerpts[0], change);
      await writeFile(reviewPath, JSON.stringify(invalid));
      const result = run();
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /INVALID_REVIEWED_BEGINNER_EXCERPT/);
      assert.equal(await readFile(corpusPath, 'utf8'), valid);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('additional VOA support retains adult text and rejects changed hashes, boundaries and exclusions before writing', async () => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'lingfern-voa-support-'));
  try {
    await mkdir(join(directory, 'content/corpus'), { recursive: true });
    await mkdir(join(directory, 'public/corpus'), { recursive: true });
    const sources = JSON.parse(await readFile('content/corpus/voa-additional-sources.json', 'utf8'));
    const source = sources.records.find(record => record.supportedExcerpts);
    const sourcesPath = join(directory, 'content/corpus/voa-additional-sources.json');
    const publicPath = join(directory, 'public/corpus/voa.json'), contentPath = join(directory, 'content/corpus/voa.json');
    await writeFile(sourcesPath, JSON.stringify(sources));
    await writeFile(publicPath, await readFile('public/corpus/voa.json'));
    const run = () => spawnSync(process.execPath, [resolve('scripts/additional-voa.mjs')], { cwd: directory, encoding: 'utf8' });
    assert.equal(run().status, 0);
    const valid = await readFile(publicPath, 'utf8'), prepared = JSON.parse(valid).records.find(record => record.rootId === `voa-article-${source.id}`);
    assert.equal(prepared.originalText, source.text);
    for (const original of sources.records.filter(record => record.excludedSpans.length)) {
      const published = JSON.parse(valid).records.find(record => record.rootId === `voa-article-${original.id}`);
      assert.equal(published.originalText, undefined, 'Held text must not leak through source metadata');
      assert.equal(published.acquiredAt, original.acquiredAt ?? sources.acquiredAt);
      for (const passage of published.passages) {
        const start = original.text.indexOf(passage.text);
        assert(start >= 0);
        assert(!original.excludedSpans.some(span => start < span.end && start + passage.text.length > span.start));
      }
    }
    assert(prepared.passages.some(passage => passage.text === source.text && !passage.startingPoints));
    const excerpt = source.supportedExcerpts[0], passage = prepared.passages.find(passage => passage.id === excerpt.sha256);
    assert.equal(passage.text, source.text.slice(excerpt.start, excerpt.end));
    assert.equal(passage.wordCount, 106);
    assert.deepEqual(passage.startingPoints, ['A2']);
    const changes = [
      record => { record.supportedExcerpts[0].sha256 = '0'.repeat(64); },
      record => { record.supportedExcerpts[0].sourceHash = '0'.repeat(64); },
      record => { record.supportedExcerpts[0].startingPoints = ['A1']; },
      record => { record.supportedExcerpts[0].start += 1; },
      record => { record.supportedExcerpts[0].end -= 1; },
      record => { record.supportedExcerpts[0].start = 1.5; },
      record => { record.supportedExcerpts[0].end = 999999; },
      record => { record.supportedExcerpts[0].reviewer = 'unreviewed'; },
      record => { record.supportedExcerpts[0].decision = 'withheld'; },
      record => { record.excludedSpans = [{ start: excerpt.start, end: excerpt.start + 4 }]; },
    ];
    for (const change of changes) {
      const invalid = structuredClone(sources);
      change(invalid.records.find(record => record.id === source.id));
      await writeFile(sourcesPath, JSON.stringify(invalid));
      const result = run();
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /INVALID_VOA_SUPPORTED_EXCERPT/);
      assert.equal(await readFile(publicPath, 'utf8'), valid);
      assert.equal(await readFile(contentPath, 'utf8'), JSON.stringify(JSON.parse(valid), null, 2) + '\n');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
