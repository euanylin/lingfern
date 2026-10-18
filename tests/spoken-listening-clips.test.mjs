import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listeningRuns, clipPreparationOptions, shortWindowBounds, recording } from '../scripts/spoken-listening-clips.mjs';

test('listening candidates retain exact UTF-16 source runs and reject word gaps, mismatches and invalid times', () => {
  const sentence = 'These original words describe a historical event using exact source wording and retain the evidence without making any unsupported claim about the learner or the accuracy of automatic speech recognition.';
  const text = `🌿 ${sentence} ${sentence}`;
  const first = { start: 3, end: 3 + sentence.length, text: sentence, audioStart: 1, audioEnd: 15 };
  const second = { ...first, start: first.end + 1, end: text.length, audioStart: 15.2, audioEnd: 30 };
  const found = listeningRuns(text, [first, second], 31);
  assert.equal(found.length, 1); assert.equal(found[0].text, text.slice(3));
  const gapText = text.slice(0, first.end) + ' Omitted word. ' + sentence;
  const shifted = { ...second, start: first.end + 15, end: gapText.length };
  assert.equal(listeningRuns(gapText, [first, shifted], 31).length, 2);
  assert.throws(() => listeningRuns(text, [{ ...first, text: 'invented transcript' }], 31), /ALIGNMENT_INTEGRITY/);
  assert.throws(() => listeningRuns(text, [{ ...first, audioEnd: 32 }], 31), /ALIGNMENT_INTEGRITY/);
  assert.throws(() => listeningRuns(text, [first], NaN), /ALIGNMENT_INTEGRITY/);
  assert.equal(listeningRuns(text, [first, { ...second, audioStart: 18 }], 31).length, 2);
});

test('does not cut a listening run mid-sentence or invent a timestamp inside an aligned segment', () => {
  const complete = 'These original words describe a historical event using exact source wording and retain the evidence without making any unsupported claim about the learner or the accuracy of automatic speech recognition.';
  const text = `An earlier sentence begins here and continues. ${complete} A final sentence continues beyond the matched audio.`;
  const start = text.indexOf(complete), end = start + complete.length;
  const segments = [
    { start: 11, end: start - 2, text: text.slice(11, start - 2), audioStart: 0, audioEnd: 3 },
    { start, end: end - 1, text: complete.slice(0, -1), audioStart: 3, audioEnd: 18 },
    { start: end + 1, end: text.indexOf('beyond') - 1, text: text.slice(end + 1, text.indexOf('beyond') - 1), audioStart: 18, audioEnd: 23 },
  ];
  const found = listeningRuns(text, segments, 30);
  assert.equal(found.length, 1); assert.equal(found[0].text, complete);
  assert.equal(found[0].segments.length, 1); assert.equal(found[0].segments[0].audioStart, 3);
  assert.equal(listeningRuns(text, [{ start: 11, end: text.indexOf('beyond') - 1, text: text.slice(11, text.indexOf('beyond') - 1), audioStart: 0, audioEnd: 23 }], 30).length, 0);
});


const longLimits = { minSeconds: 120, maxSeconds: 479.5, maxWords: 1200, maxCharacters: 12000 };
function alignedSentences(count, seconds = 40) {
  const sentence = 'These original words describe a historical event using exact source wording and retain the evidence without making any unsupported claim about the learner or the accuracy of automatic speech recognition.';
  const text = Array(count).fill(sentence).join(' ');
  const segments = Array.from({ length: count }, (_, index) => ({ start: index * (sentence.length + 1), end: index * (sentence.length + 1) + sentence.length,
    text: sentence, audioStart: index * seconds, audioEnd: (index + 1) * seconds }));
  return { text, segments, duration: count * seconds };
}

test('long runs are bounded complete contiguous source windows; short defaults stay identical', () => {
  const input = alignedSentences(15);
  const defaults = listeningRuns(input.text, input.segments, input.duration);
  assert.deepEqual(defaults, listeningRuns(input.text, input.segments, input.duration, { minSeconds: 8, maxSeconds: 90, maxWords: 180, maxCharacters: 12000 }));
  assert.equal(defaults[0].segments.length, 2);
  const long = listeningRuns(input.text, input.segments, input.duration, longLimits);
  assert.deepEqual(long.map(run => run.segments.length), [11, 4]);
  for (const run of long) {
    assert.equal(run.text, input.text.slice(run.start, run.end));
    assert.ok(run.wordCount <= 1200 && run.text.length <= 12000);
    const seconds = run.segments.at(-1).audioEnd - run.segments[0].audioStart;
    assert.ok(seconds >= 120 && seconds <= 479.5);
  }
  const oversized = alignedSentences(1, 500);
  assert.equal(listeningRuns(oversized.text, oversized.segments, oversized.duration, longLimits).length, 0);
  const short = alignedSentences(2);
  assert.equal(listeningRuns(short.text, short.segments, short.duration, longLimits).length, 0);
  assert.equal(listeningRuns(input.text, input.segments, input.duration, { ...longLimits, maxWords: 120 }).every(run => run.wordCount <= 120), true);
  assert.equal(listeningRuns(input.text, input.segments, input.duration, { ...longLimits, maxCharacters: 600 }).length, 0);
});

test('long mode never crosses missing words, reversed audio or long silence', () => {
  const input = alignedSentences(6);
  const gap = input.text.slice(0, input.segments[3].start) + 'Missing spoken words. ' + input.text.slice(input.segments[3].start);
  const shifted = input.segments.map((segment, index) => index < 3 ? segment : { ...segment, start: segment.start + 22, end: segment.end + 22 });
  const runs = listeningRuns(gap, shifted, input.duration, longLimits);
  assert.deepEqual(runs.map(run => run.segments.length), [3, 3]);
  const silence = input.segments.map((segment, index) => index < 3 ? segment : { ...segment, audioStart: segment.audioStart + 2, audioEnd: segment.audioEnd + 2 });
  assert.deepEqual(listeningRuns(input.text, silence, input.duration + 2, longLimits).map(run => run.segments.length), [3, 3]);
  const reversed = input.segments.map((segment, index) => index === 3 ? { ...segment, audioStart: 119 } : segment);
  assert.deepEqual(listeningRuns(input.text, reversed, input.duration, longLimits).map(run => run.segments.length), [3, 3]);
});

test('long output is explicitly scoped and isolated from short preparation and legacy indexes', async () => {
  const short = clipPreparationOptions([]);
  assert.equal(short.target, 'private/corpus/spoken/listening-clips'); assert.equal(short.limits, undefined);
  const long = clipPreparationOptions(['--long', '--root=wikipedia-spoken-1', '--span=1:2000']);
  assert.equal(long.target, 'private/corpus/spoken/listening-long-clips/wikipedia-spoken-1'); assert.deepEqual(long.limits, longLimits); assert.equal(long.recordingLimit, 480);
  assert.throws(() => clipPreparationOptions(['--root=a']), /LONG_ROOT_REQUIRED/);
  assert.throws(() => clipPreparationOptions(['--long']), /LONG_ROOT_REQUIRED/);
  assert.throws(() => clipPreparationOptions(['--long', '--root=']), /LONG_ROOT_REQUIRED/);
  assert.throws(() => clipPreparationOptions(['--long', '--root=a', '--span=1:2000', '--output=private/corpus/spoken/listening-clips']), /CLIP_OUTPUT_MODE_MISMATCH/);
  assert.throws(() => clipPreparationOptions(['--output=private/corpus/spoken/listening-long-clips']), /CLIP_OUTPUT_MODE_MISMATCH/);
  assert.throws(() => clipPreparationOptions(['--long', '--root=a', '--span=1:2000', '--output=elsewhere'], { records: [] }), /CLIP_OUTPUT_MODE_MISMATCH/);
  assert.throws(() => clipPreparationOptions(['--output=elsewhere'], { mode: 'long' }), /CLIP_OUTPUT_MODE_MISMATCH/);
  assert.throws(() => clipPreparationOptions(['--long', '--root=a']), /LONG_SPAN_REQUIRED/);
  assert.throws(() => clipPreparationOptions(['--long', '--root=a', '--span=2:1']), /LONG_SPAN_REQUIRED/);
  assert.throws(() => clipPreparationOptions(['--long', '--root=a', '--span=1:2000'], { mode: 'long', scope: { rootId: 'a', start: 2, end: 2000 } }), /CLIP_OUTPUT_SCOPE_MISMATCH/);
  assert.doesNotThrow(() => clipPreparationOptions(['--long', '--root=a', '--span=1:2000'], { mode: 'long' }));
  for (const limits of [{ maxSeconds: 481 }, { minSeconds: NaN }, { maxWords: 1201 }, { maxCharacters: 12001 }, { minSeconds: 120, maxSeconds: 90 }])
    assert.throws(() => listeningRuns('Example.', [], 10, limits), /INVALID_CLIP_LIMITS/);
  await assert.rejects(recording('not-read.mp3', 601), /INVALID_CLIP_LIMITS/);
});

test('short windows require an exact root/span, isolated output and real duration under 35 seconds', () => {
  const args = ['--short-window', '--root=wikipedia-article-1', '--span=100:500'];
  const options = clipPreparationOptions(args);
  assert.equal(options.mode, 'short-window'); assert.equal(options.recordingLimit, 35);
  assert.deepEqual(options.limits, { minSeconds: 8, maxSeconds: 34.5, maxWords: 180, maxCharacters: 12000 });
  assert.equal(options.target, 'private/corpus/spoken/listening-short-clips/wikipedia-article-1');
  for (const invalid of [['--short-window'], ['--short-window', '--root=a'], [...args, '--long'], [...args, '--output=private/corpus/spoken/listening-clips']]) assert.throws(() => clipPreparationOptions(invalid));
  assert.throws(() => clipPreparationOptions(args, { mode: 'short', scope: options.scope }), /CLIP_OUTPUT_MODE_MISMATCH/);
  assert.throws(() => clipPreparationOptions(args, { mode: 'short-window', scope: { ...options.scope, end: 501 } }), /CLIP_OUTPUT_SCOPE_MISMATCH/);
  const input = alignedSentences(2, 20);
  assert.deepEqual(listeningRuns(input.text, input.segments, input.duration, options.limits).map(run => run.segments.length), [1, 1]);
});

test('short-window margins stop before neighbouring speech and refuse gapless boundaries', () => {
  const segments = [{ start: 0, end: 10, audioStart: 0, audioEnd: 2 }, { start: 11, end: 60, audioStart: 2.2, audioEnd: 12 }, { start: 61, end: 80, audioStart: 12.14, audioEnd: 15 }];
  const excerpt = { segments: [segments[1]] };
  const bounds = shortWindowBounds(excerpt, segments, 15);
  assert.ok(Math.abs(bounds.start - 2.1) < 1e-9); assert.ok(Math.abs(bounds.end - 12.07) < 1e-9);
  assert.ok(bounds.start > segments[0].audioEnd && bounds.end < segments[2].audioStart);
  assert.throws(() => shortWindowBounds(excerpt, [{ ...segments[0], audioEnd: 2.2 }, ...segments.slice(1)], 15), /SHORT_BOUNDARY_NO_GAP/);
  assert.throws(() => shortWindowBounds(excerpt, [...segments.slice(0, 2), { ...segments[2], audioStart: 12 }], 15), /SHORT_BOUNDARY_NO_GAP/);
  assert.throws(() => shortWindowBounds({ segments: [{ start: 900, end: 950 }] }, segments, 15), /ALIGNMENT_INTEGRITY/);
});
