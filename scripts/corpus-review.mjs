import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reviewSchema = z.object({ version: z.literal(1), reviewer: z.literal('Codex/AI'), reviewedAt: z.iso.datetime(), scope: z.string().min(1), records: z.array(z.object({ rootId: z.string().min(1), title: z.string().min(1), textSha256: hash, articleSha256: hash, decision: z.enum(['accepted-text', 'withheld-text']), excludedTargets: z.array(z.string().regex(/^[a-z]{3,20}$/i)).max(100).optional(), excludedSpans: z.array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1).max(12000) }).strict()).max(100).optional(), notes: z.string().min(1), permissionReview: z.literal('pending'), audioReview: z.literal('not-inspected'), questionReview: z.literal('not-inspected') }).strict()).max(3000) }).strict();

export function filterReviewedSources(sources, input) {
  const review = reviewSchema.parse(input);
  const originals = new Map(sources.map(source => [source.rootId, source]));
  if (originals.size !== sources.length) throw new Error('DUPLICATE_SOURCE');
  const decisions = new Map();
  for (const entry of review.records) {
    const source = originals.get(entry.rootId);
    if (decisions.has(entry.rootId)) throw new Error('DUPLICATE_REVIEW');
    if (!source || source.title !== entry.title || source.articleSha256 !== entry.articleSha256 || source.textSha256 !== entry.textSha256 || createHash('sha256').update(source.text).digest('hex') !== entry.textSha256) throw new Error('REVIEW_SOURCE_CHANGED');
    const excluded = entry.excludedTargets ?? [];
    if (new Set(excluded.map(word => word.toLowerCase())).size !== excluded.length || excluded.some(word => !new RegExp(`\\b${word}\\b`, 'i').test(source.text))) throw new Error('INVALID_TARGET_EXCLUSION');
    let previousEnd = 0;
    for (const span of entry.excludedSpans ?? []) {
      if (span.start < previousEnd || span.end <= span.start || span.end > source.text.length || source.text.slice(span.start, span.end) !== span.text) throw new Error('INVALID_SPAN_EXCLUSION');
      previousEnd = span.end;
    }
    decisions.set(entry.rootId, entry);
  }
  const withheld = review.records.filter(entry => entry.decision === 'withheld-text').map(entry => entry.rootId);
  const targetExclusions = new Map([...decisions].map(([rootId, entry]) => [rootId, entry.excludedTargets ?? []]));
  const spanExclusions = new Map([...decisions].map(([rootId, entry]) => [rootId, entry.excludedSpans ?? []]));
  return { targetExclusions, spanExclusions, records: sources.filter(source => decisions.get(source.rootId)?.decision !== 'withheld-text'), review: { reviewer: review.reviewer, inspected: decisions.size, textCandidates: decisions.size - withheld.length, uninspected: sources.length - decisions.size, withheld, excludedTargets: Object.fromEntries([...targetExclusions].filter(([, words]) => words.length)), excludedSpans: Object.fromEntries([...spanExclusions].filter(([, spans]) => spans.length)), audioApproved: 0, permissionsApproved: 0, publicationApproved: false } };
}

export async function readSourceReview(sources, path = 'private/corpus/spoken/codex-text-review.json') {
  return filterReviewedSources(sources, JSON.parse(await readFile(path, 'utf8')));
}

export function reviewedAudioHolds(sources, prepared, input) {
  const review = z.object({ version: z.literal(1), records: z.array(z.object({ rootId: z.string().min(1), id: hash, sourceTextSha256: hash, sourceAudioSha256: hash, clipSha256: hash, journalSha256: hash, reason: z.string().min(1).max(450) }).strict()).max(10000) }).strict().parse(input);
  const originals = new Map(sources.map(source => [source.rootId, source]));
  const clips = new Map(prepared.flatMap(record => record.clips.map(clip => [clip.id, { ...clip, rootId: record.rootId }])));
  const holds = new Map(), seen = new Set();
  for (const entry of review.records) {
    const source = originals.get(entry.rootId), clip = clips.get(entry.id);
    if (seen.has(entry.id)) throw new Error('DUPLICATE_AUDIO_HOLD');
    seen.add(entry.id);
    if (!source || source.textSha256 !== entry.sourceTextSha256 || source.audioSha256 !== entry.sourceAudioSha256 || createHash('sha256').update(source.text).digest('hex') !== entry.sourceTextSha256) throw new Error('AUDIO_HOLD_SOURCE_CHANGED');
    // A recut clip has a new ID/hash; its predecessor stays held in the journal.
    if (clip && (clip.rootId !== entry.rootId || clip.sha256 !== entry.clipSha256)) throw new Error('AUDIO_HOLD_CLIP_CHANGED');
    holds.set(entry.id, `Codex/AI clip review hold: ${entry.reason}`);
    for (const [id, candidate] of clips) if (candidate.rootId === entry.rootId && candidate.sha256 === entry.clipSha256)
      holds.set(id, `Codex/AI clip review hold: ${entry.reason}`);
  }
  return holds;
}

export function reviewedLanguage(text, language, excludedTargets = []) {
  if (!excludedTargets.length) return language;
  if (!language) throw new Error('TARGET_REVIEW_REQUIRES_LANGUAGE');
  const excluded = new Set(excludedTargets.map(word => word.toLowerCase()));
  return { ...language, tokens: language.tokens.filter(token => !excluded.has(text.slice(token.start, token.end).toLowerCase())) };
}

export function reviewedExcerpt(original, text, excludedSpans = []) {
  if (!excludedSpans.length) return true;
  let start = original.indexOf(text);
  if (!text || start < 0) throw new Error('REVIEW_EXCERPT_SOURCE_MISMATCH');
  // Repeated source wording is allowed only when every occurrence avoids excluded spans.
  while (start >= 0) {
    if (excludedSpans.some(span => start < span.end && start + text.length > span.start)) return false;
    start = original.indexOf(text, start + 1);
  }
  return true;
}


/** Reorder reviewed source records by a hash-bound recipe; never add items or clear flags. */
export function groupSpokenSources(records, input) {
  const recipe = z.object({ version: z.literal(1), roots: z.array(z.object({ rootId: z.string().min(1), textSha256: hash,
    clips: z.array(z.object({ id: hash, sha256: hash }).strict()).min(1).max(2) }).strict()).min(2).max(10) }).strict().parse(input);
  if (new Set(recipe.roots.map(root => root.rootId)).size !== recipe.roots.length) throw new Error('DUPLICATE_GROUP_ROOT');
  const ordered = [...records];
  for (const [position, root] of recipe.roots.entries()) {
    const index = ordered.findIndex(record => record.rootId === root.rootId), source = ordered[index];
    if (!source || source.textSha256 !== root.textSha256 || new Set(root.clips.map(clip => clip.id)).size !== root.clips.length
      || root.clips.some(clip => !source.clips.some(current => current.id === clip.id && current.sha256 === clip.sha256))) throw new Error('GROUP_SOURCE_CHANGED');
    [ordered[position], ordered[index]] = [ordered[index], ordered[position]];
  }
  return ordered;
}
