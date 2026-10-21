import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';

const run = promisify(execFile);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Keep exact source runs separate across unmatched words. */
export function listeningRuns(text, segments, duration, limits = {}) {
  const { minSeconds = 8, maxSeconds = 90, maxWords = 180, maxCharacters = Infinity } = limits;
  if (!Number.isFinite(minSeconds) || !Number.isFinite(maxSeconds) || minSeconds < 8 || maxSeconds < minSeconds || maxSeconds > 480
      || !Number.isInteger(maxWords) || maxWords < 30 || maxWords > 1200 || (limits.maxCharacters !== undefined && (!Number.isInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > 12000))) throw new Error('INVALID_CLIP_LIMITS');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('ALIGNMENT_INTEGRITY');
  const runs = [];
  // shortcut: sentence boundaries propose candidates; review grammar and audio separately.
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)]
    .filter(part => /[.!?]["'’”)\]]*\s*$/.test(part.segment))
    .map(part => ({ start: part.index + (part.segment.match(/^[^\p{L}\p{N}]*/u)?.[0].length ?? 0),
      end: part.index + part.segment.trimEnd().length,
      wordEnd: part.index + part.segment.replace(/[.!?]["'’”)\]]*\s*$/, '').trimEnd().length }));
  const sentenceStarts = new Set(sentences.map(sentence => sentence.start));
  const sentenceEnds = new Map(sentences.flatMap(sentence => [[sentence.wordEnd, sentence.end], [sentence.end, sentence.end]]));
  let group = [];
  const finish = () => {
    if (!group.length) return;
    // Keep complete sentences with exact existing alignment boundaries.
    // Never invent segment times to rescue incomplete utterances.
    const first = group.findIndex(segment => sentenceStarts.has(segment.start));
    const last = group.findLastIndex(segment => sentenceEnds.has(segment.end));
    if (first >= 0 && last >= first) {
      const aligned = group.slice(first, last + 1), start = aligned[0].start;
      const end = sentenceEnds.get(aligned.at(-1).end);
      const excerpt = text.slice(start, end), words = excerpt.trim().split(/\s+/).length;
      if (words >= 30 && words <= maxWords && excerpt.length <= maxCharacters && aligned.at(-1).audioEnd - aligned[0].audioStart >= minSeconds
          && (!Object.keys(limits).length || aligned.at(-1).audioEnd - aligned[0].audioStart <= maxSeconds))
        runs.push({ start, end, text: excerpt, wordCount: words, segments: aligned });
    }
    group = [];
  };
  for (const segment of segments) {
    if (!Number.isInteger(segment.start) || !Number.isInteger(segment.end) || segment.start < 0 || segment.end <= segment.start || segment.end > text.length
        || text.slice(segment.start, segment.end) !== segment.text || !Number.isFinite(segment.audioStart) || !Number.isFinite(segment.audioEnd)
        || segment.audioStart < 0 || segment.audioStart >= segment.audioEnd || segment.audioEnd > duration) throw new Error('ALIGNMENT_INTEGRITY');
    const previous = group.at(-1);
    if (previous && (segment.start < previous.end || segment.audioStart < previous.audioEnd
        || /[\p{L}\p{N}]/u.test(text.slice(previous.end, segment.start)) || segment.audioStart - previous.audioEnd > 1.5
        || segment.audioEnd - group[0].audioStart > maxSeconds || text.slice(group[0].start, segment.end).trim().split(/\s+/).length > maxWords
        || text.slice(group[0].start, segment.end).length > maxCharacters)) finish();
    group.push(segment);
  }
  finish();
  return runs;
}

/** Recut within available gaps without including neighboring speech. */
export function shortWindowBounds(excerpt, segments, duration) {
  const first = excerpt.segments[0], last = excerpt.segments.at(-1);
  const index = segments.findIndex(segment => segment.audioStart === first.audioStart && segment.audioEnd === first.audioEnd);
  const final = segments.findIndex(segment => segment.audioStart === last.audioStart && segment.audioEnd === last.audioEnd);
  if (!Number.isFinite(first.audioStart) || !Number.isFinite(last.audioEnd) || index < 0 || final < index || !Number.isFinite(duration)) throw new Error('ALIGNMENT_INTEGRITY');
  const before = index ? segments[index - 1].audioEnd : 0;
  const after = segments[final + 1]?.audioStart ?? duration;
  const start = Math.max(0, first.audioStart - Math.min(.15, (first.audioStart - before) / 2));
  const end = Math.min(duration, last.audioEnd + Math.min(.2, (after - last.audioEnd) / 2));
  if (!Number.isFinite(start) || !Number.isFinite(end) || first.audioStart - start < .01 || end - last.audioEnd < .01) throw new Error('SHORT_BOUNDARY_NO_GAP');
  return { start, end };
}

export async function recording(file, maxSeconds = 91) {
  if (!Number.isFinite(maxSeconds) || maxSeconds < 1 || maxSeconds > 600) throw new Error('INVALID_CLIP_LIMITS');
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0 || duration > maxSeconds) throw new Error('CLIP_DURATION');
  await run('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-'], { maxBuffer: 1024 * 1024 });
  return duration;
}


/** Keep long candidates private and require explicit original-root scope. */
export function clipPreparationOptions(args, previous) {
  const long = args.includes('--long'), short = args.includes('--short-window'), scoped = long || short;
  if (long && short) throw new Error('CLIP_OUTPUT_MODE_MISMATCH');
  const mode = long ? 'long' : short ? 'short-window' : 'short';
  const roots = args.filter(arg => arg.startsWith('--root=')).map(arg => arg.slice(7));
  if (!scoped && roots.length) throw new Error('LONG_ROOT_REQUIRED');
  if (roots.some(root => !/^[a-zA-Z0-9-]+$/.test(root)) || new Set(roots).size !== roots.length || (scoped && !roots.length)) throw new Error('LONG_ROOT_REQUIRED');
  const spanArg = args.find(arg => arg.startsWith('--span='))?.slice(7);
  const span = spanArg?.match(/^(\d+):(\d+)$/)?.slice(1).map(Number);
  if (scoped && (roots.length !== 1 || !span || !span.every(Number.isSafeInteger) || span[0] >= span[1])) throw new Error('LONG_SPAN_REQUIRED');
  const scope = scoped ? { rootId: roots[0], start: span[0], end: span[1] } : undefined;
  if (previous?.scope && JSON.stringify(previous.scope) !== JSON.stringify(scope)) throw new Error('CLIP_OUTPUT_SCOPE_MISMATCH');
  const directory = 'private/corpus/spoken';
  const target = args.find(arg => arg.startsWith('--output='))?.slice(9) ?? `${directory}/${long ? `listening-long-clips/${roots[0]}` : short ? `listening-short-clips/${roots[0]}` : 'listening-clips'}`;
  if (!target || (scoped && basename(resolve(target)) === 'listening-clips') || (long && basename(resolve(target)) === 'listening-clips') || (!long && basename(resolve(target)) === 'listening-long-clips')
      || (previous && (previous.mode ?? 'short') !== mode)) throw new Error('CLIP_OUTPUT_MODE_MISMATCH');
  // Preserve edge margins, MP3 padding, and all evidence.
  const limits = long ? { minSeconds: 120, maxSeconds: 479.5, maxWords: 1200, maxCharacters: 12000 } : short ? { minSeconds: 8, maxSeconds: 34.5, maxWords: 180, maxCharacters: 12000 } : undefined;
  return { long, short, scoped, mode, roots, target, limits, scope, recordingLimit: long ? 480 : short ? 35 : 91 };
}

async function main() {
  const directory = 'private/corpus/spoken';
  const sources = JSON.parse(await readFile(`${directory}/processed.json`, 'utf8'));
  const aligned = JSON.parse(await readFile(`${directory}/alignment-candidates.json`, 'utf8'));
  const byRoot = new Map(sources.records.map(source => [source.rootId, source]));
  const options = clipPreparationOptions(process.argv.slice(2));
  const { target, long, short, scoped, mode, roots, limits, scope, recordingLimit } = options;
  if (!scoped && roots.length) throw new Error('LONG_ROOT_REQUIRED');
  if (roots.some(root => !byRoot.has(root) || !aligned.records.some(row => row.rootId === root))) throw new Error('CLIP_ROOT_NOT_FOUND');
  let previous;
  try { previous = JSON.parse(await readFile(`${target}/index.json`, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  clipPreparationOptions(process.argv.slice(2), previous);
  for (const file of ['index.in-progress.json', 'preparation-mode.json']) {
    try { clipPreparationOptions(process.argv.slice(2), JSON.parse(await readFile(`${target}/${file}`, 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(`${target}/audio`, { recursive: true });
  if (scoped) await writeFile(`${target}/preparation-mode.json`, JSON.stringify({ mode, limits, scope, reviewStatus: 'pending', published: false }));
  const existing = new Map((previous?.records ?? []).flatMap(record => record.clips.map(clip => [clip.id, clip])));
  const records = scoped ? (previous?.records ?? []).filter(record => !roots.includes(record.rootId)) : [];
  const checkpoint = async complete => {
    const report = { version: 1, ...(scoped ? { mode, limits, scope, reviewStatus: 'pending', acceptance: 'Unreviewed scoped candidates; previous clip holds remain in force. Not for package publication.' } : {}), updatedAt: new Date().toISOString(), complete, roots: records.length,
      clips: records.reduce((sum, record) => sum + record.clips.length, 0), audioSeconds: records.reduce((sum, record) => sum + record.clips.reduce((total, clip) => total + clip.duration, 0), 0),
      humanReviewed: 0, approvedListeningTasks: 0, published: false, records };
    const output = `${target}/${complete ? 'index' : 'index.in-progress'}.json`;
    await writeFile(`${output}.tmp`, JSON.stringify(report));
    await rename(`${output}.tmp`, output);
    console.log(JSON.stringify({ ...report, records: undefined }));
  };
  for (const row of aligned.records) {
    if (roots.length && !roots.includes(row.rootId)) continue;
    const source = byRoot.get(row.rootId);
    if (!source || sha(source.text) !== row.textSha256 || source.audioSha256 !== row.audioSha256 || row.offsetUnit !== 'utf16-code-units') throw new Error('SOURCE_INTEGRITY');
    // shortcut: two draft clips per root; review content and mobile timings before expanding.
    const segments = scoped ? row.segments.filter(segment => segment.start >= scope.start && segment.end <= scope.end) : row.segments;
    const selected = listeningRuns(source.text, segments, source.decodedDuration, limits).slice(0, 2);
    if (scoped && (selected.length !== 1 || selected[0].start !== scope.start || selected[0].end !== scope.end)) throw new Error('LONG_SPAN_ALIGNMENT');
    if (!selected.length) continue;
    const audio = `${directory}/audio/${row.fileId}.ogg`;
    if (sha(await readFile(audio)) !== row.audioSha256) throw new Error('AUDIO_INTEGRITY');
    let transcript, transcriptSha256;
    if (short) {
      const bytes = await readFile(`${directory}/audio/${row.fileId}.transcript.json`);
      transcriptSha256 = sha(bytes); transcript = JSON.parse(bytes);
      if (transcript._source?.sha256 !== row.audioSha256 || transcript._source?.model !== row.model || !Array.isArray(transcript.segments)) throw new Error('SOURCE_INTEGRITY');
    }
    const clips = [];
    for (const excerpt of selected) {
      const audioSegments = short ? transcript.segments.map(segment => ({ audioStart: segment.start, audioEnd: segment.end })) : row.segments;
      if (short) {
        const first = excerpt.segments[0], last = excerpt.segments.at(-1);
        const spoken = transcript.segments.filter(segment => segment.start >= first.audioStart && segment.end <= last.audioEnd).map(segment => segment.text).join(' ');
        const normalized = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (normalized(spoken) !== normalized(excerpt.text)) throw new Error('SHORT_TRANSCRIPT_MISMATCH');
      }
      const { start, end } = short ? shortWindowBounds(excerpt, audioSegments, source.decodedDuration) : { start: Math.max(0, excerpt.segments[0].audioStart - .15), end: Math.min(source.decodedDuration, excerpt.segments.at(-1).audioEnd + .2) };
      const id = sha(`${row.audioSha256}\0${row.textSha256}\0${excerpt.start}:${excerpt.end}\0${start}:${end}\0mp3-64k-mono-22050-v1`);
      const filename = `${target}/audio/${id}.mp3`;
      const saved = existing.get(id);
      if (saved) {
        if (sha(await readFile(filename)) !== saved.sha256) throw new Error('CLIP_INTEGRITY');
      } else {
        try { await stat(filename); throw new Error('UNINDEXED_CLIP_REQUIRES_REVIEW'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const temporary = `${filename}.tmp.mp3`;
        await run('ffmpeg', ['-v', 'error', '-xerror', '-ss', String(start), '-i', audio, '-t', String(end - start), '-map_metadata', '-1', '-vn', '-ac', '1', '-ar', '22050', '-af', 'asetpts=PTS-STARTPTS', '-codec:a', 'libmp3lame', '-b:a', '64k', '-n', temporary], { maxBuffer: 1024 * 1024 });
        await recording(temporary, recordingLimit);
        await rename(temporary, filename);
      }
      const duration = await recording(filename, recordingLimit);
      if (long && duration < 120) throw new Error('CLIP_DURATION');
      clips.push({ id, ...excerpt, segments: excerpt.segments.map(segment => ({ ...segment, start: segment.start - excerpt.start, end: segment.end - excerpt.start, audioStart: segment.audioStart - start, audioEnd: segment.audioEnd - start })),
        originalAudioStart: start, originalAudioEnd: end, ...(short ? { transcriptSha256 } : {}), duration, sha256: sha(await readFile(filename)), file: `audio/${id}.mp3`,
        reviewStatus: 'pending', alignmentStatus: 'automatic exact-token candidate', processing: `Original human recording excerpt; ${short ? 'edge margins capped to half the available neighbouring full-ASR speech gap' : '0.15s leading/0.2s trailing margin'}, mono 22050Hz 64kbps MP3. No synthesized speech.` });
    }
    records.push({ rootId: row.rootId, fileId: row.fileId, textSha256: row.textSha256, audioSha256: row.audioSha256,
      provenance: row.provenance, model: row.model, modelRevision: row.modelRevision, qualityFlags: row.qualityFlags, clips });
    if (records.length % 10 === 0) await checkpoint(false);
  }
  await checkpoint(true);
  await writeFile(`${target}/README.md`, (long ? '# Private long listening candidates\n\nPending complete-window audio/transcript and rights review. Old clip quality holds remain in force even when candidate IDs differ. Do not feed this index to public package builders.\n\n' : '') + (long ? '## Original recording excerpts\n\nFinite' : '# Private original recording excerpts\n\nFinite') + ' draft preparation from exact-token alignment candidates. Full recordings remain in the acquisition bank; these bounded clips do not count as new original recordings. Source UTF-16 text offsets, original recording times, clip-local evidence times, hashes and separate text/audio rights are retained. Every output fully decodes. Automatic matching and decode checks do not constitute human transcript, suitability or rights approval. Not published. Separate explicit-import listening packages are built by scripts/spoken-listening-packs.mjs; this index is the preparation record, not evidence of installation or approval. Retain original source data and this index.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
