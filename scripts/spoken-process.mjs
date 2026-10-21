import { readFile, writeFile, stat, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { verifyAudio, articleIdentity } from './spoken-corpus.mjs';

export function prose(html) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script,style,link,iframe,figure,table,sup.reference,.reflist,.references,.navbox,.metadata,.ambox,.mw-editsection').forEach(node => node.remove());
  document.querySelectorAll('br,ul,ol,dl').forEach(node => node.before(document.createTextNode(' ')));
  const blocks = [...document.body.querySelectorAll('h2,h3,h4,p,li,dt,dd')].filter(node => !node.parentElement.closest('li,dt,dd'));
  const sections = [];
  for (const node of blocks) {
    const text = node.textContent.replace(/\s+/g, ' ').trim().normalize('NFC');
    if (!text) continue;
    if (/^H[234]$/.test(node.tagName) && /^(?:References|Notes|Footnotes|Bibliography|Further reading|External links|See also)$/i.test(text)) break;
    sections.push({ type: /^H/.test(node.tagName) ? 'heading' : 'text', text });
  }
  return { title: document.title, sections, text: sections.map(section => section.text).join('\n\n') };
}

async function atomic(file, data) {
  const temporary = new URL(file.href + '.tmp');
  await writeFile(temporary, JSON.stringify(data) + '\n');
  await rename(temporary, file);
}

export async function saveProcessing(directory, reportFile, records, report, complete) {
  await atomic(new URL(complete ? 'processed.json' : 'processed.in-progress.json', directory), { version: 1, records });
  await atomic(complete ? reportFile : new URL('processing-progress.json', directory), { ...report, complete });
}

// Process independent roots concurrently; serialize commits and checkpoints.
export async function processBatchSources(items, { seen, records, failures, processItem, checkpoint }) {
  const groups = new Map();
  for (const item of items) {
    if (item.transcriptStatus !== 'downloaded-source' || item.audioStatus !== 'verified-download' || seen.has(item.articlePageId)) continue;
    if (!groups.has(item.articlePageId)) groups.set(item.articlePageId, []);
    groups.get(item.articlePageId).push(item);
  }
  const roots = [...groups.values()];
  let checkpointCount = records.length;
  for (let offset = 0; offset < roots.length; offset += 4) {
    const batch = roots.slice(offset, offset + 4);
    const results = await Promise.allSettled(batch.map(async candidates => {
      const rejected = [];
      for (const item of candidates) {
        try {
          const result = await processItem(item);
          if (result.failure) rejected.push(result.failure);
          if (result.record) return { record: result.record, failures: rejected };
        } catch (error) {
          rejected.push({ fileId: item.fileId, error: error.message, fatal: true });
          return { failures: rejected, fatal: new Error(`${item.fileId}: ${error.message}`, { cause: error }) };
        }
      }
      return { failures: rejected };
    }));
    const fatal = [];
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === 'rejected') { fatal.push(result.reason); continue; }
      failures.push(...result.value.failures);
      if (result.value.fatal) fatal.push(result.value.fatal);
      if (result.value.record) {
        seen.add(batch[index][0].articlePageId);
        records.push(result.value.record);
      }
    }
    // Require all tasks and checkpoint writes to finish first.
    if (fatal.length || records.length - checkpointCount >= 25) {
      await checkpoint(false);
      checkpointCount = records.length;
    }
    if (fatal.length) throw new AggregateError(fatal, 'Source processing failed; completed files were not replaced.');
  }
}

async function main() {
  const directory = new URL('../private/corpus/spoken/', import.meta.url);
  let state = JSON.parse(await readFile(new URL('index.json', directory), 'utf8'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.context().setOffline(true);
  const records = [];
  const seen = new Set();
  const failures = [];
  const checkpoint = async (complete = false) => {
    const report = { updatedAt: new Date().toISOString(), processedArticleAudioPairs: records.length, words: records.reduce((sum, item) => sum + item.wordCount, 0), totalAudioSeconds: records.reduce((sum, item) => sum + item.decodedDuration, 0), distinctArticleRoots: seen.size, fullAudioDecode: records.length, qualityFlagged: records.filter(item => item.qualityFlags.length).length, failures, reviewedExercises: 0, speechAlignment: 'pending', levelAssignments: 'pending', published: false };
    await saveProcessing(directory, new URL('../content/corpus/spoken-processing-report.json', import.meta.url), records, report, complete);
    console.log(JSON.stringify(report));
  };
  try {
    // Capture newly completed downloads in one bounded catch-up snapshot.
    for (let pass = 0; pass < 2; pass++) {
      if (pass) state = JSON.parse(await readFile(new URL('index.json', directory), 'utf8'));
      await processBatchSources(state.records, { seen, records, failures, checkpoint, processItem: async item => {
        const bytes = await readFile(new URL(`articles/${item.revision}.html`, directory));
        if (createHash('sha256').update(bytes).digest('hex') !== item.articleSha256) throw new Error('ARTICLE_INTEGRITY');
        try { articleIdentity(new TextDecoder('utf-8', { fatal: true }).decode(bytes), item.revision, item.title); }
        catch (error) { return { failure: { fileId: item.fileId, error: error.message } }; }
        const parsed = await page.evaluate(prose, new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!parsed.text || parsed.text.split(/\s+/).length < 80) return {};
        const audioFile = new URL(`audio/${item.fileId}.ogg`, directory);
        try { item.decodedDuration = (await verifyAudio(await readFile(audioFile), audioFile, item)).duration; }
        catch (error) { return { failure: { fileId: item.fileId, error: error.message } }; }
        const words = parsed.text.split(/\s+/).length;
        const rate = words * 60 / item.decodedDuration;
        const qualityFlags = [];
        if (Math.abs(item.decodedDuration - item.duration) > 2) qualityFlags.push('source duration metadata differs from decoded recording: review required');
        if (rate < 65 || rate > 260) qualityFlags.push('source-length/audio-duration mismatch: check narration coverage');
        if (/\[\[|\]\]|\{\{|\}\}/.test(parsed.text)) qualityFlags.push('residual source markup: editorial cleanup required');
        if (/[\p{Script=Han}\p{Script=Cyrillic}]/u.test(parsed.text)) qualityFlags.push('non-English-script passage: English-only practice review required');
        return { record: { ...item, audioRightsEvidenceUrl: item.licenceUrl || item.audioSourceUrl, suitabilityReview: 'pending', title: parsed.title, rootId: `wikipedia-article-${item.articlePageId}`, acquiredAt: (await stat(new URL(`articles/${item.revision}.html`, directory))).mtime.toISOString(), text: parsed.text, sections: parsed.sections, wordCount: words, qualityFlags, textSha256: createHash('sha256').update(parsed.text).digest('hex'), audioDecodeStatus: 'full-file verified', textLicence: 'CC BY-SA 4.0 under Wikimedia Terms of Use; source-specific exceptions require review', textLicenceUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use', textAttribution: `Wikipedia contributors, ${parsed.title}, recorded revision ${item.revision}. ${item.articleUrl}`, authorHistoryUrl: `https://en.wikipedia.org/w/index.php?curid=${item.articlePageId}&action=history`, processing: 'Extracted prose/headings/lists from the recording-linked complete source revision. Removed navigation, images, tables and reference lists; retained raw original HTML. Not a verified verbatim speech transcript.', alignmentStatus: 'pending', levelReview: 'pending', editorialReview: 'pending' } };
      } });
    }
    await checkpoint(true);
  } finally { await browser.close(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
