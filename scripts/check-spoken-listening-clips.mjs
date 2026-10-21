import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { listeningRuns, recording } from './spoken-listening-clips.mjs';

const directory = process.argv.find(arg => arg.startsWith('--directory='))?.slice(12) ?? 'private/corpus/spoken/listening-clips';
const index = JSON.parse(await readFile(`${directory}/index.json`, 'utf8'));
assert.equal(index.complete, true, 'Finite preparation must finish before acceptance');
const raw = JSON.parse(await readFile('private/corpus/spoken/processed.json', 'utf8'));
const sources = new Map(raw.records.map(source => [source.rootId, source]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const alignments = JSON.parse(await readFile('private/corpus/spoken/alignment-candidates.json', 'utf8'));
const sentenceCandidates = [];
for (const alignment of alignments.records) {
  const source = sources.get(alignment.rootId);
  assert(source && sha(source.text) === alignment.textSha256 && source.audioSha256 === alignment.audioSha256);
  const candidates = listeningRuns(source.text, alignment.segments, source.decodedDuration).slice(0, 2);
  sentenceCandidates.push({ rootId: source.rootId, clips: candidates.map(({ start, end, wordCount, segments }) =>
    ({ start, end, wordCount, audioStart: segments[0].audioStart, audioEnd: segments.at(-1).audioEnd })) });
}
const audits = new Map(JSON.parse(await readFile('private/corpus/spoken/asr-audit.json', 'utf8')).records.map(row => [row.fileId, row]));
const roots = new Set(), clips = new Set();
const runtime = JSON.parse(await readFile('content/corpus/runtime-audit.json', 'utf8'));
const preparedRoots = new Set(index.records.map(record => record.rootId));
const flaggedRoots = new Set(runtime.rows.filter(row => row.skill === 'listening' && !row.generates && row.flags.length && preparedRoots.has(row.rootId)).map(row => row.rootId));
const candidates = [];
const clipTranscripts = [];
const words = text => text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?|[0-9]+/g) ?? [];
let bytes = 0;
for (const record of index.records) {
  const source = sources.get(record.rootId);
  assert(source && !roots.has(record.rootId)); roots.add(record.rootId);
  assert.equal(record.textSha256, sha(source.text));
  assert.equal(record.audioSha256, source.audioSha256);
  const audit = audits.get(record.fileId);
  assert(audit && !audit.error && audit.audioSha256 === record.audioSha256);
  assert.deepEqual(record.qualityFlags, [...new Set([...source.qualityFlags, ...audit.flags])].sort());
  assert.deepEqual(record.provenance.audioSourceUrl, source.audioSourceUrl);
  assert(record.clips.length >= 1 && record.clips.length <= 2);
  for (const clip of record.clips) {
    if (process.argv.includes('--sentences')) assert(sentenceCandidates.find(row => row.rootId === record.rootId)?.clips.some(candidate => candidate.start === clip.start && candidate.end === clip.end), 'CLIP_SENTENCE_BOUNDARY');
    assert(!clips.has(clip.id)); clips.add(clip.id);
    assert.equal(clip.text, source.text.slice(clip.start, clip.end));
    assert.equal(clip.wordCount, clip.text.trim().split(/\s+/).length);
    assert(clip.wordCount >= 30 && clip.wordCount <= 180);
    assert.equal(clip.file, `audio/${clip.id}.mp3`);
    const path = `${directory}/${clip.file}`;
    assert.equal(sha(await readFile(path)), clip.sha256);
    assert(Math.abs(await recording(path) - clip.duration) < .01);
    assert(clip.originalAudioStart >= 0 && clip.originalAudioEnd <= source.decodedDuration);
    assert(Math.abs(clip.duration - (clip.originalAudioEnd - clip.originalAudioStart)) < .2);
    let lastEnd = 0, lastAudio = 0;
    for (const segment of clip.segments) {
      assert.equal(clip.text.slice(segment.start, segment.end), segment.text);
      assert(segment.start >= lastEnd && segment.end > segment.start && segment.end <= clip.text.length);
      assert(segment.audioStart >= lastAudio && segment.audioEnd > segment.audioStart && segment.audioEnd <= clip.duration);
      assert(!/[\p{L}\p{N}]/u.test(clip.text.slice(lastEnd, segment.start)));
      lastEnd = segment.end; lastAudio = segment.audioEnd;
    }
    assert(!/[\p{L}\p{N}]/u.test(clip.text.slice(lastEnd)));
    assert.equal(clip.reviewStatus, 'pending'); bytes += (await stat(path)).size;
    if (flaggedRoots.has(record.rootId)) {
      let transcriptBytes;
      try { transcriptBytes = await readFile(`${directory}/${clip.file.replace(/\.mp3$/, '.transcript.json')}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (transcriptBytes) {
        assert(transcriptBytes.length <= 1024 * 1024);
        const transcript = JSON.parse(transcriptBytes);
        assert.equal(transcript._source.sha256, clip.sha256);
        assert.equal(transcript._source.language, 'en');
        assert.equal(transcript._source.model, 'mlx-community/whisper-large-v3-turbo');
        assert(typeof transcript.text === 'string' && transcript.text.trim());
        assert(Array.isArray(transcript.segments) && transcript.segments.length <= 1000);
        assert(transcript.segments.every(segment => Number.isFinite(segment.start) && Number.isFinite(segment.end)
          && segment.start >= 0 && segment.end > segment.start && typeof segment.text === 'string'));
        // shortcut: lexical equality is diagnostic; review numbers, names, and senses in context.
        clipTranscripts.push({ rootId: record.rootId, title: source.title, id: clip.id, clipSha256: clip.sha256,
          transcriptSha256: sha(transcriptBytes), model: transcript._source.model, duration: clip.duration,
          sourceText: clip.text, recognizedText: transcript.text, segments: transcript.segments.map(({ start, end, text }) => ({ start, end, text })),
          lexicalEqual: JSON.stringify(words(clip.text)) === JSON.stringify(words(transcript.text)),
          timestampOverrun: transcript.segments.some(segment => segment.end > clip.duration + .2),
          reviewStatus: 'automatic-transcription-only' });
      }
      candidates.push({ rootId: record.rootId, title: source.title, id: clip.id,
      sourceTextSha256: record.textSha256, sourceAudioSha256: record.audioSha256, clipSha256: clip.sha256,
      originalAudioStart: clip.originalAudioStart, originalAudioEnd: clip.originalAudioEnd, duration: clip.duration,
      inheritedFlags: record.qualityFlags,
      observedTextFlags: [
        ...(/\[\[|\]\]|\{\{|\}\}/.test(clip.text) ? ['residual markup inside this excerpt'] : []),
        ...(/[\p{Script=Han}\p{Script=Cyrillic}]/u.test(clip.text) ? ['non-English script inside this excerpt'] : []),
      ], reviewStatus: 'not-listened', file: clip.file });
    }
  }
}
assert.equal(roots.size, index.roots); assert.equal(clips.size, index.clips);
const report = { verifiedAt: new Date().toISOString(), roots: roots.size, clips: clips.size, bytes, seconds: index.audioSeconds,
  fullClipDecode: clips.size, humanReviewed: 0, approvedListeningTasks: 0, published: false };
await writeFile(`${directory}/verification.json`, JSON.stringify(report, null, 2) + '\n');
assert.equal(new Set(candidates.map(clip => clip.rootId)).size, flaggedRoots.size);
await writeFile(`${directory}/review-candidates.json`, JSON.stringify({ verifiedAt: report.verifiedAt,
  scope: 'Verified clip identity and local text diagnostics only. Inherited full-recording flags remain in force; absence inside an excerpt is not audio/transcript approval.',
  roots: flaggedRoots.size, clips: candidates.length, records: candidates.sort((a, b) => a.duration - b.duration) }, null, 2) + '\n');
await writeFile(`${directory}/clip-transcript-diagnostics.json`, JSON.stringify({ verifiedAt: report.verifiedAt,
  scope: 'Hash-bound local retranscription of installed draft excerpts. Lexical equality and timestamp diagnostics are not audio, sense, suitability, rights or editorial approval. Inherited quality flags remain unchanged.',
  expected: candidates.length, inspected: clipTranscripts.length, complete: clipTranscripts.length === candidates.length,
  lexicalEqual: clipTranscripts.filter(row => row.lexicalEqual).length,
  timestampOverruns: clipTranscripts.filter(row => row.timestampOverrun).length,
  audioApprovals: 0, flagsCleared: 0, records: clipTranscripts }, null, 2) + '\n');
await writeFile(`${directory}/sentence-boundary-candidates.json`, JSON.stringify({ verifiedAt: report.verifiedAt,
  scope: 'Exact existing alignment boundaries trimmed to native complete-sentence candidates. No new clips encoded, source flags cleared or packages published; grammatical/audio/editorial acceptance remains pending.',
  examinedRoots: sentenceCandidates.length, candidateRoots: sentenceCandidates.filter(row => row.clips.length).length,
  clips: sentenceCandidates.reduce((sum, row) => sum + row.clips.length, 0), records: sentenceCandidates }, null, 2) + '\n');
const textFlagRoots = new Set(candidates.filter(row => row.inheritedFlags.every(flag =>
  /^(?:residual source markup|non-English-script passage)/.test(flag))).map(row => row.rootId));
if (directory === 'private/corpus/spoken/listening-clips') await writeFile('content/corpus/listening-review-diagnostics.json', JSON.stringify({ checkedAt: report.verifiedAt,
  scope: 'Clip identity, full decoding, source-boundary candidates and local ASR diagnostics only; not audio/transcript editorial or rights approval. All inherited restrictions remain in force.',
  flaggedRoots: flaggedRoots.size, flaggedClips: candidates.length,
  clipsWithLocalMarkupOrHanCyrillic: candidates.filter(row => row.observedTextFlags.length).length,
  onlySourceTextFlagRoots: textFlagRoots.size,
  sourceTextFlagRootsWithoutLocalMarkers: [...textFlagRoots].filter(rootId => !candidates.some(row => row.rootId === rootId && row.observedTextFlags.length)).length,
  locallyRetranscribedClips: clipTranscripts.length, retranscriptionComplete: clipTranscripts.length === candidates.length,
  lexicalEqualClips: clipTranscripts.filter(row => row.lexicalEqual).length,
  asrTimestampOverruns: clipTranscripts.filter(row => row.timestampOverrun).length,
  completeSentenceCandidateRoots: sentenceCandidates.filter(row => row.clips.length).length,
  completeSentenceCandidateClips: sentenceCandidates.reduce((sum, row) => sum + row.clips.length, 0),
  audioTranscriptApprovals: 0, flagsCleared: 0 }, null, 2) + '\n');
console.log(JSON.stringify(report));
