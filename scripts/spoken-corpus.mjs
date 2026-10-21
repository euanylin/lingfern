import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const run = promisify(execFile);
const api = 'https://commons.wikimedia.org/w/api.php';
const directory = new URL('../private/corpus/spoken/', import.meta.url);
const reportFile = new URL('../content/corpus/spoken-report.json', import.meta.url);
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');

export function acquisitionOrder(records) {
  const priority = item => item.transcriptStatus === 'rejected-source' ? 2 : item.audioStatus === 'verified-download' && item.transcriptStatus === 'downloaded-source' ? 1 : 0;
  return [...records].sort((a, b) => priority(a) - priority(b) || a.duration - b.duration);
}

export function recording(page) {
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata;
  const value = key => meta?.[key]?.value ?? '';
  if (!Number.isSafeInteger(page.pageid) || page.pageid <= 0 || !info || typeof info.url !== 'string' || !/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(info.url)) return null;
  if (typeof info.descriptionurl !== 'string' || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(info.descriptionurl)) return null;
  if (!Number.isSafeInteger(info.size) || info.size <= 0) return null;
  if (!/^(?:CC BY(?:-SA)? (?:[234]\.0|2\.5)|CC0|Public domain)$/.test(value('LicenseShortName'))) return null;
  if (value('Restrictions') || /speech synthesis|text.to.speech|parts or simplified|unreviewed spoken/i.test(value('Categories'))) return null;
  if (!Number.isFinite(info.duration) || info.duration < 60 || info.duration > 7200 || info.size > 50000000 || !/^[a-f0-9]{40}$/.test(info.sha1)) return null;
  // Use exact recorded revisions, not current article text.
  const description = value('ImageDescription').replaceAll('&amp;', '&');
  const links = [...description.matchAll(/href="(https:\/\/en\.wikipedia\.org\/[^"<>]+)"/g)].map(match => new URL(match[1]));
  const article = links.find(url => /^\d+$/.test(url.searchParams.get('oldid') ?? '') && (url.pathname.startsWith('/wiki/') || url.pathname === '/w/index.php'));
  if (!article || !Number.isSafeInteger(Number(article.searchParams.get('oldid'))) || Number(article.searchParams.get('oldid')) <= 0) return null;
  const title = (article.pathname.startsWith('/wiki/') ? decodeURIComponent(article.pathname.slice(6)) : article.searchParams.get('title'))?.replaceAll('_', ' ').trim().normalize('NFC');
  if (!title || /^(?:Wikipedia|File|Template|Help|Portal|User|Talk|Category):/i.test(title)) return null;
  return { fileId: page.pageid, title, articleUrl: article.href, revision: Number(article.searchParams.get('oldid')), audioUrl: info.url, audioSourceUrl: info.descriptionurl, sourceSha1: info.sha1, expectedBytes: info.size, duration: info.duration, licence: value('LicenseShortName'), licenceUrl: value('LicenseUrl'), artistHtml: value('Artist'), creditHtml: value('Credit'), recordedAt: value('DateTimeOriginal'), categories: value('Categories'), reviewStatus: 'pending', transcriptStatus: 'not-acquired', audioStatus: 'not-acquired' };
}

let apiRequests = Promise.resolve();
let sourceBackoff = false;
async function download(url, limit) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['commons.wikimedia.org', 'upload.wikimedia.org', 'api.wikimedia.org'].includes(parsed.hostname) || parsed.username || parsed.password) throw new Error('UNTRUSTED_SOURCE');
  if (parsed.hostname === 'upload.wikimedia.org') return bytes(url, limit);
  // Serialize API calls; pool static recording downloads only.
  const request = apiRequests.then(() => bytes(url, limit));
  apiRequests = request.catch(() => {});
  return request;
}
async function bytes(url, limit) {
  if (sourceBackoff) throw new Error('SOURCE_LONG_BACKOFF');
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(new URL(url).hostname === 'upload.wikimedia.org' ? 600000 : 120000), headers: { 'User-Agent': 'LingfernCorpus/0.1 (https://lingfern.com)' } });
    if (![429, 503].includes(response.status)) break;
    const retry = response.headers.get('retry-after');
    const seconds = retry === null ? 5 : /^\d+$/.test(retry) ? Number(retry) : Math.max(0, (Date.parse(retry) - Date.now()) / 1000);
    await response.body?.cancel();
    if (!Number.isFinite(seconds) || seconds > 300) { sourceBackoff = true; throw new Error('SOURCE_LONG_BACKOFF'); }
    await delay(Math.max(5, seconds) * 1000);
  }
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const chunks = []; let size = 0;
  if (Number(response.headers.get('content-length')) > limit) throw new Error('SOURCE_TOO_LARGE');
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('SOURCE_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function query(parameters) {
  const data = JSON.parse(await download(`${api}?${new URLSearchParams({ action: 'query', format: 'json', maxlag: '5', ...parameters })}`, 12000000));
  if (data.error) throw new Error(`API_${data.error.code}`);
  return data;
}
async function save(file, data) {
  const temporary = new URL(file.href + '.tmp');
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
  await rename(temporary, file);
}
export function counts(records) {
  const audio = records.filter(item => item.audioStatus === 'verified-download');
  const articles = records.filter(item => item.transcriptStatus === 'downloaded-source');
  return { candidates: records.length, distinctArticles: new Set(records.map(item => item.title)).size, downloadedAudio: new Set(audio.map(item => item.sourceSha1)).size, downloadedArticleRevisions: new Set(articles.map(item => item.articlePageId ?? item.revision)).size, downloadedPairs: new Set(articles.filter(item => item.audioStatus === 'verified-download').map(item => item.articlePageId ?? item.revision)).size, reviewedUsablePairs: 0, published: false };
}
export function articleIdentity(html, revision, expectedTitle) {
  if (!html.includes(`about="//en.wikipedia.org/wiki/Special:Redirect/revision/${revision}"`) || !/<body\b[^>]*lang="en"/.test(html) || !/property="mw:pageNamespace" content="0"/.test(html)) throw new Error('ARTICLE_VERSION');
  const pageId = Number(html.match(/property="mw:pageId" content="(\d+)"/)?.[1]);
  const link = html.match(/rel="dc:isVersionOf" href="([^"<>]+)"/)?.[1];
  if (!Number.isSafeInteger(pageId) || pageId <= 0 || !link) throw new Error('ARTICLE_ID');
  const url = new URL(link.replaceAll('&amp;', '&'), 'https://en.wikipedia.org');
  if (url.hostname !== 'en.wikipedia.org' || !url.pathname.startsWith('/wiki/')) throw new Error('ARTICLE_ID');
  const title = decodeURIComponent(url.pathname.slice(6)).replaceAll('_', ' ').normalize('NFC');
  if (title.toLowerCase() !== expectedTitle.replaceAll('_', ' ').trim().normalize('NFC').toLowerCase()) throw new Error('ARTICLE_TITLE_MISMATCH');
  return { pageId, title };
}
export async function verifyAudio(bytes, file, item) {
  if (bytes.length !== item.expectedBytes || digest(bytes, 'sha1') !== item.sourceSha1) throw new Error('AUDIO_INTEGRITY');
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', fileURLToPath(file)], { timeout: 15000 });
  const probe = JSON.parse(stdout);
  const duration = Number(probe.format.duration);
  if (!probe.streams.some(stream => stream.codec_type === 'audio') || !Number.isFinite(duration) || duration < 60 || duration > 7200) throw new Error('AUDIO_PROBE');
  await run('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-i', fileURLToPath(file), '-f', 'null', '-'], { timeout: 60000 });
  return { sha256: digest(bytes), duration };
}
async function main() {
  const target = Number(process.argv.find(argument => argument.startsWith('--target='))?.slice(9) ?? 1000);
  if (!Number.isInteger(target) || target < 1 || target > 3000) throw new Error('INVALID_TARGET');
  await mkdir(directory, { recursive: true });
  await mkdir(new URL('audio/', directory), { recursive: true });
  await mkdir(new URL('articles/', directory), { recursive: true });
  const indexFile = new URL('index.json', directory);
  let state = await readFile(indexFile, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return { files: [], records: [], indexed: false }; throw error; });
  const failures = [];
  let writes = Promise.resolve();
  const checkpoint = () => {
    writes = writes.then(async () => {
      await save(indexFile, state);
      await save(reportFile, { updatedAt: new Date().toISOString(), targetArticles: target, targetAudio: target, ...counts(state.records), exclusions: state.files.length - state.records.length, discoveredFiles: state.files.length, failures, note: 'Downloaded recordings remain in private/ quarantine. No level assignment, transcription alignment, editorial approval or public distribution is claimed. Category files and article revisions are counted separately; fragments and repeated articles are not independent materials.' });
    });
    return writes;
  };
  if (!state.indexed) {
    const files = [];
    let continuation = {};
    do {
      const result = await query({ list: 'categorymembers', cmtitle: 'Category:Spoken English Wikipedia', cmtype: 'file', cmlimit: '500', ...continuation });
      files.push(...result.query.categorymembers);
      continuation = result.continue;
      if (files.length > 5000) throw new Error('CATEGORY_LIMIT');
      console.log(`Discovered ${files.length} official file records`);
    } while (continuation);
    state.files = [...new Map(files.map(file => [file.pageid, file])).values()];
    state.indexed = true;
    await checkpoint();
  }
  const seen = new Set(state.records.map(item => item.title.replaceAll('_', ' ').trim().normalize('NFC').toLowerCase()));
  const seenRevisions = new Set(state.records.map(item => item.revision));
  const inspected = new Set(process.argv.includes('--refresh-metadata') ? state.records.map(item => item.fileId) : state.inspected ?? []);
  for (let offset = 0; offset < state.files.length; offset += 50) {
    const batch = state.files.slice(offset, offset + 50).filter(file => !inspected.has(file.pageid));
    if (!batch.length) continue;
    const data = await query({ prop: 'imageinfo', iiprop: 'url|extmetadata|sha1|size', pageids: batch.map(file => file.pageid).join('|') });
    for (const page of Object.values(data.query.pages)) {
      inspected.add(page.pageid);
      const item = recording(page);
      if (!item || seen.has(item.title.toLowerCase()) || seenRevisions.has(item.revision)) continue;
      seen.add(item.title.toLowerCase()); seenRevisions.add(item.revision); state.records.push(item);
    }
    state.inspected = [...inspected];
    await checkpoint();
    console.log(`Retained ${state.records.length} distinct recorded article candidates`);
  }
  // Validate cached historical sources because API results may be merged targets.
  for (const item of state.records.filter(item => item.transcriptStatus === 'downloaded-source' || item.transcriptStatus === 'rejected-source')) {
    try {
      const bytes = await readFile(new URL(`articles/${item.revision}.html`, directory));
      if (digest(bytes) !== item.articleSha256) throw new Error('ARTICLE_INTEGRITY');
      articleIdentity(new TextDecoder('utf-8', { fatal: true }).decode(bytes), item.revision, item.title);
      item.transcriptStatus = 'downloaded-source';
    } catch (error) { item.transcriptStatus = 'rejected-source'; failures.push({ fileId: item.fileId, stage: 'article', error: error.message }); }
  }
  await checkpoint();
  const acquire = async item => {
    const audioFile = new URL(`audio/${item.fileId}.ogg`, directory);
    try {
      let bytes = await readFile(audioFile).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!bytes || bytes.length !== item.expectedBytes || digest(bytes, 'sha1') !== item.sourceSha1) {
        bytes = await download(item.audioUrl, 50000000);
        if (bytes.length !== item.expectedBytes || digest(bytes, 'sha1') !== item.sourceSha1) throw new Error('AUDIO_INTEGRITY');
        await writeFile(new URL(audioFile.href + '.tmp'), bytes);
        await rename(new URL(audioFile.href + '.tmp'), audioFile);
      }
      const verified = await verifyAudio(bytes, audioFile, item);
      item.audioSha256 = verified.sha256; item.decodedDuration = verified.duration;
      item.audioStatus = 'verified-download';
    } catch (error) { item.audioStatus = 'failed'; failures.push({ fileId: item.fileId, stage: 'audio', error: error.message }); }
    const articleFile = new URL(`articles/${item.revision}.html`, directory);
    const existingArticle = await readFile(articleFile).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (item.transcriptStatus !== 'rejected-source' && (!existingArticle || digest(existingArticle) !== item.articleSha256)) {
      try {
        const source = await download(`https://api.wikimedia.org/core/v1/wikipedia/en/revision/${item.revision}/html`, 8000000);
        const html = new TextDecoder('utf-8', { fatal: true }).decode(source);
        const { pageId } = articleIdentity(html, item.revision, item.title);
        await writeFile(new URL(articleFile.href + '.tmp'), source);
        await rename(new URL(articleFile.href + '.tmp'), articleFile);
        item.articlePageId = pageId;
        item.transcriptStatus = 'downloaded-source'; item.articleSha256 = digest(source);
      } catch (error) { item.transcriptStatus = 'failed'; failures.push({ fileId: item.fileId, stage: 'article', error: error.message }); }
    }
  };
  // shortcut: six bounded downloads; review limits before adding crawls or retries.
  const ordered = acquisitionOrder(state.records);
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < ordered.length) {
      if (sourceBackoff) break;
      const progress = counts(state.records);
      if (progress.downloadedPairs >= target) break;
      await acquire(ordered[next++]);
      await checkpoint();
      const current = counts(state.records);
      if (current.downloadedPairs % 10 === 0) console.log(`Downloaded ${current.downloadedAudio}/${target} audio; ${current.downloadedArticleRevisions}/${target} exact articles; ${current.downloadedPairs} distinct paired roots`);
    }
  }));
  await checkpoint();
  if (counts(state.records).downloadedPairs < target) {
    process.exitCode = 1;
    console.error(`Quota remains incomplete: ${counts(state.records).downloadedPairs}/${target} verified distinct pairs; saved checkpoint.`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
