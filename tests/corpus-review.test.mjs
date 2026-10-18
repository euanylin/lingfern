import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { filterReviewedSources, reviewedLanguage, reviewedExcerpt, reviewedAudioHolds, groupSpokenSources } from '../scripts/corpus-review.mjs';

test('text reviews are hash-bound, withhold only inspected defects and never approve uninspected sources', () => {
  const hash = text => createHash('sha256').update(text).digest('hex');
  const sources = ['one', 'two', 'three'].map(text => ({ rootId: text, title: text, text, textSha256: hash(text), articleSha256: hash('original-' + text) }));
  const review = { version: 1, reviewer: 'Codex/AI', reviewedAt: '2026-10-01T12:00:00.000Z', scope: 'Isolated regression texts.', records: sources.slice(0, 2).map((source, i) => ({ rootId: source.rootId, title: source.title, textSha256: source.textSha256, articleSha256: source.articleSha256, decision: i ? 'withheld-text' : 'accepted-text', notes: 'Regression decision.', permissionReview: 'pending', audioReview: 'not-inspected', questionReview: 'not-inspected' })) };
  const result = filterReviewedSources(sources, review);
  assert.deepEqual(result.records.map(source => source.rootId), ['one', 'three']);
  assert.equal(result.review.uninspected, 1); assert.equal(result.review.publicationApproved, false);
  assert.equal(result.review.audioApproved, 0); assert.equal(result.review.permissionsApproved, 0);
  assert.throws(() => filterReviewedSources([{ ...sources[0], text: 'changed' }, ...sources.slice(1)], review), /REVIEW_SOURCE_CHANGED/);
  assert.throws(() => filterReviewedSources(sources, { ...review, records: [...review.records, review.records[0]] }), /DUPLICATE_REVIEW/);
  assert.throws(() => filterReviewedSources(sources, { ...review, records: [{ ...review.records[0], rootId: 'unknown' }] }), /REVIEW_SOURCE_CHANGED/);
  assert.throws(() => filterReviewedSources(sources, { ...review, records: [{ ...review.records[0], articleSha256: hash('different-revision') }] }), /REVIEW_SOURCE_CHANGED/);
  assert.throws(() => filterReviewedSources(sources, { ...review, records: [{ ...review.records[0], decision: 'approved-everything' }] }));
  assert.throws(() => filterReviewedSources(sources, { ...review, records: [{ ...review.records[0], excludedTargets: ['missing'] }] }), /INVALID_TARGET_EXCLUSION/);
  assert.throws(() => filterReviewedSources(sources, { ...review, records: [{ ...review.records[0], excludedTargets: ['one', 'ONE'] }] }), /INVALID_TARGET_EXCLUSION/);
  const span = { start: 0, end: 3, text: 'one' };
  assert.deepEqual(filterReviewedSources(sources, { ...review, records: [{ ...review.records[0], excludedSpans: [span] }] }).review.excludedSpans.one, [span]);
  for (const excludedSpans of [[{ ...span, end: 4 }], [{ ...span, text: 'two' }], [span, span]])
    assert.throws(() => filterReviewedSources(sources, { ...review, records: [{ ...review.records[0], excludedSpans }] }), /INVALID_SPAN_EXCLUSION/);
});

test('span restrictions exclude intersecting and ambiguous excerpts while retaining exact source wording', () => {
  const original = '😀 History. Current capacity. History.';
  const start = original.indexOf('Current');
  const spans = [{ start, end: start + 'Current capacity.'.length, text: 'Current capacity.' }];
  assert.equal(reviewedExcerpt(original, 'History.', spans), true);
  assert.equal(reviewedExcerpt(original, 'capacity', spans), false);
  assert.equal(reviewedExcerpt(original, 'History. Current', spans), false);
  assert.equal(reviewedExcerpt(original, 'History.', [{ start: original.lastIndexOf('History.'), end: original.length }]), false);
  assert.throws(() => reviewedExcerpt(original, 'Rewritten history', spans), /REVIEW_EXCERPT_SOURCE_MISMATCH/);
  assert.throws(() => reviewedExcerpt(original, '', spans), /REVIEW_EXCERPT_SOURCE_MISMATCH/);
});

test('reviewed spelling exclusions remove source targets without changing prose or other annotations', () => {
  const text = 'Barratt was reading.';
  const language = { tokens: [{ start: 0, end: 7, lemma: 'barratt', pos: 'NOUN' }, { start: 12, end: 19, lemma: 'read', pos: 'VERB' }] };
  const checked = reviewedLanguage(text, language, ['BARRATT']);
  assert.deepEqual(checked.tokens, [language.tokens[1]]);
  assert.equal(language.tokens.length, 2);
  assert.equal(reviewedLanguage(text, language), language);
  assert.throws(() => reviewedLanguage(text, undefined, ['Barratt']), /TARGET_REVIEW_REQUIRES_LANGUAGE/);
  assert.deepEqual(reviewedLanguage(text, { tokens: [language.tokens[0]] }, ['Barratt']).tokens, []);
});

test('audio holds survive preparation while remaining bound to exact source and clip bytes', () => {
  const sha = value => createHash('sha256').update(value).digest('hex');
  const source = { rootId: 'one', text: 'Original words.', textSha256: sha('Original words.'), audioSha256: sha('full recording') };
  const clip = { id: sha('clip identity'), sha256: sha('clip bytes') }, other = { id: sha('other clip'), sha256: sha('other bytes') };
  const prepared = [{ rootId: 'one', clips: [clip, other] }];
  const entry = { rootId: 'one', id: clip.id, sourceTextSha256: source.textSha256, sourceAudioSha256: source.audioSha256, clipSha256: clip.sha256, journalSha256: sha('journal'), reason: 'Extra preceding words in cached ASR; audition pending.' };
  const review = { version: 1, records: [entry] };
  assert(reviewedAudioHolds([source], prepared, review).has(clip.id));
  assert(!reviewedAudioHolds([source], prepared, review).has(other.id));
  assert(reviewedAudioHolds([source], [], review).has(clip.id));
  const alias = { ...clip, id: sha('alternate identity, same recording bytes') };
  assert(reviewedAudioHolds([source], [{ rootId: 'one', clips: [alias, other] }], review).has(alias.id));
  assert.throws(() => reviewedAudioHolds([source], prepared, { ...review, records: [entry, entry] }), /DUPLICATE_AUDIO_HOLD/);
  assert.throws(() => reviewedAudioHolds([{ ...source, text: 'Changed words.' }], prepared, review), /AUDIO_HOLD_SOURCE_CHANGED/);
  assert.throws(() => reviewedAudioHolds([{ ...source, audioSha256: sha('new recording') }], prepared, review), /AUDIO_HOLD_SOURCE_CHANGED/);
  assert.throws(() => reviewedAudioHolds([source], [{ rootId: 'one', clips: [{ ...clip, sha256: other.sha256 }] }], review), /AUDIO_HOLD_CLIP_CHANGED/);
});


test('source grouping preserves every record, recording and quality flag and fails closed on changed recipes', () => {
  const records = Array.from({ length: 8 }, (_, index) => ({ rootId: `root-${index}`, textSha256: String(index + 1).repeat(64),
    clips: [{ id: String(index + 1).repeat(64), sha256: 'a'.repeat(64), qualityFlags: index ? [] : ['held'] }] }));
  const recipe = { version: 1, roots: [records[5], records[2]].map(record => ({ rootId: record.rootId, textSha256: record.textSha256,
    clips: record.clips.map(({ id, sha256 }) => ({ id, sha256 })) })) };
  const before = structuredClone(records), grouped = groupSpokenSources(records, recipe);
  assert.deepEqual(records, before);
  assert.deepEqual(grouped.slice(0, 2).map(record => record.rootId), ['root-5', 'root-2']);
  assert.deepEqual(new Set(grouped), new Set(records));
  assert.strictEqual(grouped.find(record => record.rootId === 'root-0'), records[0]);
  for (const mutate of [value => { value.roots[0].textSha256 = 'b'.repeat(64); },
    value => { value.roots[0].clips[0].sha256 = 'b'.repeat(64); }, value => { value.roots[1] = value.roots[0]; },
    value => { value.roots[0].rootId = 'missing'; }]) {
    const bad = structuredClone(recipe); mutate(bad);assert.throws(() => groupSpokenSources(records, bad));
  }
});
