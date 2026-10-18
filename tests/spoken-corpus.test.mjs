import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { saveProcessing } from '../scripts/spoken-process.mjs';
import { recording, counts, articleIdentity, acquisitionOrder } from '../scripts/spoken-corpus.mjs';

test('bulk spoken corpus requires explicit rights, recorded revision and complete human source; counts never imply review', async () => {
  const page = { pageid: 12, imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.ogg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Example.ogg', sha1: 'a'.repeat(40), size: 100, duration: 180, extmetadata: { LicenseShortName: { value: 'CC BY-SA 3.0' }, ImageDescription: { value: '<a href="https://en.wikipedia.org/wiki/Example?oldid=123">Example</a>' }, Categories: { value: 'Spoken English Wikipedia' } } }] };
  const item = recording(page);
  assert.equal(item.title, 'Example'); assert.equal(item.revision, 123);
  assert.equal(item.transcriptStatus, 'not-acquired');
  assert.equal(recording({ ...page, imageinfo: [{ ...page.imageinfo[0], url: 'https://example.com/untrusted.ogg' }] }), null);
  for (const value of ['Unreviewed spoken articles - English', 'Spoken Wikipedia articles using English-language speech synthesis', 'Spoken English Wikipedia of parts or simplified versions of articles']) {
    const changed = structuredClone(page); changed.imageinfo[0].extmetadata.Categories.value = value;
    assert.equal(recording(changed), null);
  }
  const badEvidence = structuredClone(page); badEvidence.imageinfo[0].descriptionurl = 'https://example.com/rights';
  assert.equal(recording(badEvidence), null);
  const missingRevision = structuredClone(page); missingRevision.imageinfo[0].extmetadata.ImageDescription.value = '<a href="https://en.wikipedia.org/wiki/Example">Example</a>';
  assert.equal(recording(missingRevision), null);
  const unknownLicence = structuredClone(page); unknownLicence.imageinfo[0].extmetadata.LicenseShortName.value = 'All rights reserved';
  assert.equal(recording(unknownLicence), null);
  for (const value of ['CC BY 2.5', 'CC BY-SA 2.5']) {
    const compatible = structuredClone(page); compatible.imageinfo[0].extmetadata.LicenseShortName.value = value;
    assert.equal(recording(compatible).licence, value);
  }
  const publicDomain = structuredClone(page); publicDomain.imageinfo[0].extmetadata.LicenseShortName.value = 'CC0';
  assert.equal(recording(publicDomain).title, 'Example');
  const ordered = [
    { ...item, fileId: 1, duration: 60, audioStatus: 'verified-download', transcriptStatus: 'downloaded-source' },
    { ...item, fileId: 2, duration: 600, audioStatus: 'failed', transcriptStatus: 'failed' },
    { ...item, fileId: 3, duration: 60, transcriptStatus: 'rejected-source' },
    { ...item, fileId: 4, duration: 120, audioStatus: 'verified-download', transcriptStatus: 'failed' },
  ];
  assert.deepEqual(acquisitionOrder(ordered).map(record => record.fileId), [4, 2, 1, 3]);
  assert.deepEqual(ordered.map(record => record.fileId), [1, 2, 3, 4]);
  const result = counts([item, { ...item, audioStatus: 'verified-download' }]);
  assert.equal(result.distinctArticles, 1); assert.equal(result.downloadedAudio, 1);
  assert.equal(result.downloadedArticleRevisions, 0); assert.equal(result.reviewedUsablePairs, 0); assert.equal(result.published, false);
  const html = '<html about="//en.wikipedia.org/wiki/Special:Redirect/revision/123"><meta property="mw:pageNamespace" content="0"><meta property="mw:pageId" content="456"><link rel="dc:isVersionOf" href="//en.wikipedia.org/wiki/Example"><body lang="en">Original</body></html>';
  assert.deepEqual(articleIdentity(html, 123, 'Example'), { pageId: 456, title: 'Example' });
  assert.deepEqual(articleIdentity(html.replace('/wiki/Example', '/wiki/Long_Example'), 123, 'Long_Example'), { pageId: 456, title: 'Long Example' });
  assert.throws(() => articleIdentity(html, 124, 'Example'), /ARTICLE_VERSION/);
  assert.throws(() => articleIdentity(html, 123, 'Different original article'), /ARTICLE_TITLE_MISMATCH/);
  const folder = await mkdtemp(`${tmpdir()}/lingfern-spoken-`);
  const directory = pathToFileURL(folder + '/');
  const reportFile = new URL('completed-report.json', directory);
  try {
    await saveProcessing(directory, reportFile, [{ id: 'completed' }], { count: 1 }, true);
    await saveProcessing(directory, reportFile, [], { count: 0 }, false);
    assert.equal(JSON.parse(await readFile(new URL('processed.json', directory), 'utf8')).records[0].id, 'completed');
    assert.deepEqual(JSON.parse(await readFile(reportFile, 'utf8')), { count: 1, complete: true });
    assert.deepEqual(JSON.parse(await readFile(new URL('processing-progress.json', directory), 'utf8')), { count: 0, complete: false });
  } finally { await rm(folder, { recursive: true, force: true }); }
});
