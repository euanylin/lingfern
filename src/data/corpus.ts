import disagreementSynthesisScopes from '../../content/corpus/c2-disagreement-synthesis-scopes.json';
import faithfulParaphraseScopes from '../../content/corpus/c2-faithful-paraphrase-scopes.json';
import complexPragmaticsScopes from '../../content/corpus/c2-complex-pragmatics-scopes.json';
import layeredPositionScopes from '../../content/corpus/c2-layered-position-scopes.json';
import rhetoricalFunctionScopes from '../../content/corpus/c2-rhetorical-function-scopes.json';
import nuancedMeaningScopes from '../../content/corpus/c2-nuanced-meaning-scopes.json';
import informationDensityScopes from '../../content/corpus/c1-information-density-scopes.json';
import indirectStanceScopes from '../../content/corpus/c1-indirect-stance-scopes.json';
import argumentBoundariesScopes from '../../content/corpus/c1-argument-boundaries-scopes.json';
import registerAudienceScopes from '../../content/corpus/c1-register-audience-scopes.json';
import discourseOrganizationScopes from '../../content/corpus/c1-discourse-organization-scopes.json';
import implicitIntentionScopes from '../../content/corpus/c1-implicit-intention-scopes.json';
import { admittedLongClip, qualifiedSourceReviews } from '../core/spokenLongAdmission';
import b2ViewAttributionScopes from '../../content/corpus/b2-view-attribution-scopes.json';
import b2InformationSynthesisScopes from '../../content/corpus/b2-information-synthesis-scopes.json';
import b2SpeakerAttitudeScopes from '../../content/corpus/b2-speaker-attitude-scopes.json';
import b2QualifiedConcessionScopes from '../../content/corpus/b2-qualified-concession-scopes.json';
import b2ComparisonScopes from '../../content/corpus/b2-comparison-scopes.json';
import b2ClaimExampleScopes from '../../content/corpus/b2-claim-example-scopes.json';
import b1ProcedureScopes from '../../content/corpus/b1-procedure-scopes.json';
import b1IntentionScopes from '../../content/corpus/b1-intention-scopes.json';
import b1MotiveScopes from '../../content/corpus/b1-motive-scopes.json';
import b1ReferenceScopes from '../../content/corpus/b1-reference-scopes.json';
import b1ConditionScopes from '../../content/corpus/b1-condition-scopes.json';
import b1MainPointScopes from '../../content/corpus/b1-main-point-scopes.json';
import personalGoalScopes from '../../content/corpus/a2-personal-goal-scopes.json';
import orderScopes from '../../content/corpus/a2-order-scopes.json';
import meaningScopes from '../../content/corpus/beginner-meaning-scopes.json';
import retainedListeningPacks from '../../content/corpus/retained-listening-packs.json';
import { corpusSchema, maxCorpusWords, registerCorpusSeenText, type Corpus, type corpusLanguageSchema } from '../core/corpus';
import type { z } from 'zod';
import { offlineGroups } from './offline';
import { spokenCorpusSchema, maxInstalledSpokenBanks } from '../core/spokenCorpus';
import { communityPackageReady } from './communityInstall';
import { communityPacks, sessions } from './db';
import shortReadingScopes from '../../content/corpus/short-reading-scopes.json';
import { loadRuntimeResources, runtimeResources } from './runtimeResources';
type TextReview = typeof import('../../content/corpus/text-review-rules.json')['records'][number];
let reviews: Promise<Map<string, TextReview>> | undefined;
const loadReviews = () => reviews ??= import('../../content/corpus/text-review-rules.json')
  .then(({ default: rules }) => {
    const records = [...rules.records, ...qualifiedSourceReviews];
    if (new Set(records.map(record => record.rootId)).size !== records.length) throw new Error('CORPUS_REVIEW_CONFLICT');
    return new Map(records.map(record => [record.rootId, record]));
  })
  .catch(error => { reviews = undefined; throw error; });
const textDigest = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(value => value.toString(16).padStart(2, '0')).join('');
export async function reviewedExcerpts<T extends { text: string; language?: z.infer<typeof corpusLanguageSchema> }>(source: Pick<Corpus['records'][number], 'rootId' | 'sourceHash' | 'originalText'>, excerpts: T[]): Promise<T[]> {
  const review = (await loadReviews()).get(source.rootId);
  if (!review) {
    const originalHash = source.originalText && excerpts.some(excerpt => admittedLongClip(excerpt)) ? await textDigest(source.originalText) : undefined;
    return excerpts.filter(excerpt => {
      const admitted = admittedLongClip(excerpt);
      if (!admitted) return true;
      // Keep new window reviews scene-bound without replacing earlier short-bank evidence.
      return !('spokenTranscript' in admitted) && admitted.rootId === source.rootId && admitted.sourceHash === source.sourceHash
        && !!source.originalText && originalHash === admitted.originalTextSha256
        && source.originalText.slice(admitted.originalWindow[0], admitted.originalWindow[1]) === excerpt.text;
    });
  }
  if (review.decision === 'withheld-text' || source.sourceHash !== review.articleSha256 || !source.originalText) return [];
  const original = source.originalText;
  if (await textDigest(original) !== review.textSha256) return [];
  const spans = review.excludedSpans;
  if ((await Promise.all(spans.map(async span => span.start < 0 || span.end <= span.start || span.end > original.length || await textDigest(original.slice(span.start, span.end)) !== span.sha256))).some(Boolean)) return [];
  const targets = new Set(('excludedTargets' in review ? review.excludedTargets ?? [] : []).map(word => word.toLowerCase()));
  return excerpts.filter(excerpt => {
    const admitted = admittedLongClip(excerpt);
    if (admitted && 'spokenTranscript' in admitted && admitted.spokenTranscript) {
      // Retain recorded headings/captions and all holds on the bound written source.
      return admitted.rootId === source.rootId && admitted.sourceHash === source.sourceHash
        && admitted.originalTextSha256 === review.textSha256 && admitted.spokenTranscript.sourceRanges.length > 0
        && admitted.spokenTranscript.sourceRanges.every(range => Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end)
          && range.start >= 0 && range.end > range.start && range.end <= original.length
          && original.slice(range.start, range.end) === range.text
          && !spans.some(span => range.start < span.end && range.end > span.start));
    }
    let start = original.indexOf(excerpt.text);
    if (!excerpt.text || start < 0) return false;
    while (start >= 0) {
      if (spans.some(span => start < span.end && start + excerpt.text.length > span.start)) return false;
      start = original.indexOf(excerpt.text, start + 1);
    }
    return true;
  }).map(excerpt => !targets.size || !excerpt.language ? excerpt : { ...excerpt, language: { ...excerpt.language,
    tokens: excerpt.language.tokens.filter(token => !targets.has(excerpt.text.slice(token.start, token.end).toLowerCase())) } });
}
export async function reviewedReading(records: Corpus['records'], maxWords = 700) {
  if (!Number.isInteger(maxWords) || maxWords < 120 || maxWords > maxCorpusWords) throw new Error('INVALID_CORPUS_SELECTION');
  const reviews = await loadReviews();
  return (await Promise.all(records.map(async record => {
    const reviewed = [...await reviewedExcerpts(record, record.passages)];
    for (const passage of reviewed) {
      const scope = [...personalGoalScopes.need, ...personalGoalScopes.preference, ...personalGoalScopes.update, ...personalGoalScopes.reason, ...personalGoalScopes.rule, ...personalGoalScopes.integration, ...b1MainPointScopes.records, ...b1ConditionScopes.records, ...b1ReferenceScopes.records, ...b1MotiveScopes.records, ...b1IntentionScopes.records, ...b1ProcedureScopes.records, ...rhetoricalFunctionScopes.reading, ...disagreementSynthesisScopes.reading, ...faithfulParaphraseScopes.reading, ...complexPragmaticsScopes.reading, ...layeredPositionScopes.reading, ...nuancedMeaningScopes.reading, ...informationDensityScopes.reading, ...indirectStanceScopes.reading, ...argumentBoundariesScopes.reading, ...registerAudienceScopes.reading, ...discourseOrganizationScopes.reading, ...implicitIntentionScopes.reading, ...b2ViewAttributionScopes.reading, ...b2InformationSynthesisScopes.reading, ...b2SpeakerAttitudeScopes.reading, ...b2QualifiedConcessionScopes.reading, ...b2ComparisonScopes.reading, ...b2ClaimExampleScopes.records, ...orderScopes.records, ...meaningScopes.people, ...meaningScopes.location, ...meaningScopes.instruction, ...meaningScopes.quantity, ...meaningScopes.verification, ...meaningScopes.time].find(scope => scope.passageId === passage.id);
      if (scope && (record.rootId !== scope.rootId || record.sourceHash !== scope.sourceHash || await textDigest(passage.text) !== scope.textSha256)) throw new Error('CORPUS_INTEGRITY');
      const projected = meaningScopes.quantity.find(entry => entry.passageId === passage.id);
      if (projected?.end !== undefined && (!Number.isSafeInteger(projected.end) || projected.end <= 0 || projected.end >= passage.text.length || passage.text[projected.end] !== '\n' || !/[.!]$/.test(passage.text.slice(0, projected.end)) || await textDigest(passage.text.slice(0, projected.end)) !== projected.materialSha256)) throw new Error('CORPUS_INTEGRITY');
    }
    for (const scope of [...personalGoalScopes.update, ...personalGoalScopes.reason, ...personalGoalScopes.rule, ...personalGoalScopes.integration].filter(scope => scope.rootId === record.rootId)) {
      const parent = reviewed.find(passage => passage.id === scope.parentId);
      if (!parent) continue;
      const text = parent.text.slice(scope.start, scope.end);
      if (record.sourceHash !== scope.sourceHash || await textDigest(parent.text) !== scope.parentSha256 || scope.start < 0 || scope.end <= scope.start || scope.end > parent.text.length
        || scope.start > 0 && ('lineBoundaries' in scope ? parent.text[scope.start - 1] !== '\n' : parent.text.slice(scope.start - 2, scope.start) !== '\n\n') || scope.end < parent.text.length && ('lineBoundaries' in scope ? parent.text[scope.end] !== '\n' : parent.text.slice(scope.end, scope.end + 2) !== '\n\n')
        || !/^[A-Z][a-z]{1,20}: /.test(text) || !/[.!]$/.test(text) || text.trim().split(/\s+/).length !== scope.words || scope.words > 120
        || await textDigest(text) !== scope.textSha256 || scope.passageId !== scope.textSha256) throw new Error('CORPUS_INTEGRITY');
      if (!reviewed.some(passage => passage.id === scope.passageId)) reviewed.push({ id: scope.passageId, text, wordCount: scope.words, startingPoints: ['A2'] });
    }
    for (const scope of meaningScopes.time.filter(scope => scope.rootId === record.rootId)) {
      const parent = reviewed.find(passage => passage.id === scope.parentId);
      if (!parent || record.sourceHash !== scope.sourceHash) continue;
      const text = parent.text.slice(scope.start, scope.end);
      if (await textDigest(parent.text) !== scope.parentSha256 || scope.start < 0 || scope.end <= scope.start || scope.end > parent.text.length
        || scope.start > 0 && parent.text[scope.start - 1] !== '\n' || scope.end < parent.text.length && parent.text[scope.end] !== '\n'
        || !/^[A-Z][a-z]{1,20}: /.test(text) || !/[.!]$/.test(text) || text.trim().split(/\s+/).length !== scope.words || scope.words > 120
        || await textDigest(text) !== scope.textSha256 || scope.passageId !== scope.textSha256) throw new Error('CORPUS_INTEGRITY');
      if (!reviewed.some(passage => passage.id === scope.passageId)) reviewed.push({ id: scope.passageId, text, wordCount: scope.words, startingPoints: ['A1'] });
    }
    const passages = record.id.startsWith('wikiquote-') || /^(?:openstax|bccampus)-/.test(record.id) ? await Promise.all(reviewed.map(async passage => {
      if (!(passage.quoteProvenance || passage.sourceProvenance) || await textDigest(passage.text) !== (passage.quoteProvenance?.textSha256 ?? passage.sourceProvenance?.textSha256)) throw new Error('CORPUS_INTEGRITY');
      return passage;
    })) : [...reviewed];
    // Use inspected complete paragraphs when the parent exceeds effort limits.
    for (const scope of shortReadingScopes.records.filter(scope => scope.rootId === record.rootId && scope.sourceHash === record.sourceHash && scope.words <= maxWords)) {
      const parent = reviewed.find(passage => passage.id === scope.parentId);
      if (!parent || parent.wordCount <= maxWords || parent.startingPoints || parent.task || parent.quoteProvenance || parent.sourceProvenance
        || await textDigest(parent.text) !== scope.parentSha256) continue;
      const text = parent.text.slice(scope.start, scope.end);
      if (scope.start < 0 || scope.end <= scope.start || scope.end > parent.text.length
        || scope.start > 0 && parent.text.slice(scope.start - 2, scope.start) !== '\n\n'
        || scope.end < parent.text.length && parent.text.slice(scope.end, scope.end + 2) !== '\n\n'
        || scope.words < 120 || text.trim().split(/\s+/).length !== scope.words || await textDigest(text) !== scope.sha256) throw new Error('CORPUS_INTEGRITY');
      if (passages.some(passage => passage.id === scope.sha256)) continue;
      const language = parent.language && { ...parent.language, tokens: parent.language.tokens
        .filter(token => token.start >= scope.start && token.end <= scope.end)
        .map(token => ({ ...token, start: token.start - scope.start, end: token.end - scope.start })) };
      passages.push({ id: scope.sha256, text, wordCount: scope.words, ...(language ? { language } : {}) });
    }
    const review = reviews.get(record.rootId), original = record.originalText;
    if (maxWords <= 700 || review?.decision !== 'accepted-text' || !original || !passages.length) return { ...record, passages };
    // Extend covered adjacent text only; stop at headings, exclusions, or gaps.
    const located = passages.filter(passage => !passage.startingPoints && !passage.task && passage.wordCount <= 700).flatMap(passage => {
      const start = original.indexOf(passage.text);
      return start >= 0 && start === original.lastIndexOf(passage.text) ? [{ passage, start, end: start + passage.text.length }] : [];
    }).sort((a, b) => a.start - b.start);
    const extended: typeof passages = [];
    const texts = new Set(passages.map(passage => passage.text));
    for (let index = 0; index < located.length && passages.length + extended.length < 20000; index++) {
      const first = located[index], parts = [first];
      let end = first.end, words = first.passage.wordCount;
      for (let next = index + 1; next < located.length; next++) {
        const candidate = located[next];
        if (candidate.start < end || !/^\s*$/.test(original.slice(end, candidate.start))
          || words + candidate.passage.wordCount > maxWords || candidate.end - first.start > 12000) break;
        parts.push(candidate); words += candidate.passage.wordCount; end = candidate.end;
      }
      if (words <= 700) continue;
      const text = original.slice(first.start, end);
      if (texts.has(text) || text.trim().split(/\s+/).length !== words
        || review.excludedSpans.some(span => first.start < span.end && end > span.start)) continue;
      const language = first.passage.language;
      const projected = language && parts.every(part => part.passage.language?.generator === language.generator && part.passage.language?.modelSha256 === language.modelSha256)
        ? { ...language, tokens: parts.flatMap(part => part.passage.language!.tokens.map(token => ({ ...token,
          start: token.start + part.start - first.start, end: token.end + part.start - first.start }))) } : undefined;
      extended.push({ id: await textDigest(text), text, wordCount: words, ...(projected ? { language: projected } : {}) });
      texts.add(text);
    }
    return { ...record, passages: [...passages, ...extended] };
  }))).filter(record => record.passages.length);
}
export function mergeReadingRecords(records: Corpus['records']): Corpus['records'] {
  const sources = new Map<string, Corpus['records'][number]>();
  for (const record of records) {
    const prior = sources.get(record.rootId);
    const compatible = prior && prior.sourceHash === record.sourceHash && prior.originalUrl === record.originalUrl && prior.originalText === record.originalText;
    sources.set(record.rootId, compatible ? { ...record, passages: [...new Map([...prior.passages, ...record.passages].map(passage => [passage.id, passage])).values()] } : record);
  }
  return [...sources.values()];
}

const loading = new Map<string, Promise<Corpus>>();
export function loadCorpus(source: 'gutenberg' | 'voa' | 'wikipedia' | 'additional' | 'wikiquote' | 'open-reading' = 'gutenberg', profileId?: string) {
  if (source === 'wikipedia') return (async () => {
    if (!profileId) throw new Error('MISSING_PROFILE');
    const banks = await communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready' && !!pack.corpus).toArray();
    const records = await reviewedReading(banks.flatMap(pack => corpusSchema.parse(pack.corpus).records).filter(record => record.id.startsWith('wikipedia-')));
    if (!records.length || records.length > 3000) throw new Error('MISSING_CORPUS');
    // shortcut: bounded bank scan; index if measured mobile loading warrants it.
    return { version: 1 as const, records: mergeReadingRecords(records), failures: [] };
  })();
  const existing = loading.get(source);
  if (existing) return existing;
  const request = (async () => {
    await loadRuntimeResources();
    const files = offlineGroups.filter(group => group.id === 'corpus' || group.id === 'corpus-open-reading').flatMap(group => group.files).filter(file => file.path === `/corpus/${source}.json`
      || file.path.startsWith(`/corpus/${source}-`) && new RegExp(`^/corpus/${source}-[1-9]\\d*\\.json$`).test(file.path))
      .sort((a, b) => Number(b.path === `/corpus/${source}.json`) - Number(a.path === `/corpus/${source}.json`) || a.path.localeCompare(b.path, 'en', { numeric: true }));
    if (!files?.some(file => file.path === `/corpus/${source}.json`)) throw new Error('MISSING_CORPUS');
    const banks: Corpus[] = [];
    for (const file of files) {
      const response = await fetch(file.path, { credentials: 'omit' });
      if (!response.ok || !response.body) { await response.body?.cancel().catch(() => {}); throw new Error('MISSING_CORPUS'); }
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > file.bytes) throw new Error('CORPUS_INTEGRITY');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (length !== file.bytes || digest !== file.sha256) throw new Error('CORPUS_INTEGRITY');
      banks.push(corpusSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))));
    }
    const records = banks.flatMap(bank => bank.records);
    if (records.length > 3000 || new Set(records.map(record => record.rootId)).size !== records.length) throw new Error('CORPUS_INTEGRITY');
    return { version: 1 as const, records, failures: banks.flatMap(bank => bank.failures) };
  })().catch(error => { loading.delete(source); throw error; });
  loading.set(source, request);
  return request;
}


export async function loadSpokenCorpora(profileId: string) {
  await loadRuntimeResources();
  const banks = await communityPacks.where('profileId').equals(profileId).filter(pack => {
    const current = runtimeResources.sources.packs.find(entry => entry.skill === 'listening' && entry.id === pack.id);
    return pack.state === 'ready' && !!pack.spoken && (!current || current.sha256 === pack.hash);
  }).toArray();
  const siteIds = new Set(runtimeResources.sources.packs.filter(pack => pack.skill === 'listening').map(pack => pack.id));
  if (banks.length > maxInstalledSpokenBanks || banks.filter(pack => !siteIds.has(pack.id) && !retainedListeningPacks.records.some(entry => entry.id === pack.id && entry.sha256 === pack.hash)).length > 100) throw new Error('CORPUS_LIMIT');
  const ready = await Promise.all(banks.map(async pack => {
    if (!await communityPackageReady(pack)) return;
    const spoken = spokenCorpusSchema.parse(pack.spoken);
    if (spoken.communityPackageId !== pack.hash) throw new Error('CORPUS_INTEGRITY');
    const records = (await Promise.all(spoken.records.map(async record => ({ ...record,
      clips: await reviewedExcerpts(record, record.clips) })))).filter(record => record.clips.length);
    if (!records.length) return;
    return { ...spoken, records };
  }));
  return ready.filter((bank): bank is NonNullable<typeof bank> => !!bank);
}

/** Combine verified installed text; bundled sources may be unavailable offline. */
export async function loadReadingCorpus(profileId: string, maxWords = 700): Promise<Corpus> {
  const packs = await communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready' && !!pack.corpus).toArray();
  if (packs.length > 100) throw new Error('CORPUS_LIMIT');
  const installed = packs.flatMap(pack => corpusSchema.parse(pack.corpus).records);
  const bundled = await Promise.allSettled([loadCorpus('voa'), loadCorpus('gutenberg'), loadCorpus('additional'), loadCorpus('wikiquote'), loadCorpus('open-reading')]);
  for (const result of bundled) if (result.status === 'rejected' && result.reason instanceof Error && !(result.reason instanceof TypeError) && result.reason.message !== 'MISSING_CORPUS') throw result.reason;
  const records = await reviewedReading([...bundled.flatMap(result => result.status === 'fulfilled' ? result.value.records : []), ...installed], maxWords);
  if (!records.length) throw new Error('MISSING_CORPUS');
  const sources = new Map(mergeReadingRecords(records).map(record => [record.rootId, record]));
  const history = await sessions.where('profileId').equals(profileId).filter(session => session.lesson.skill === 'reading'
    && session.lesson.mode !== 'check' && session.lesson.generation?.generator === 'corpus-v1'
    && session.lesson.materials.some(material => material.blocks.length === 1 && material.blocks[0].text.trim().split(/\s+/).length > 700)).toArray();
  if (history.length > 50000) throw new Error('CORPUS_LIMIT');
  for (const session of history) {
    if (await textDigest(JSON.stringify(session.lesson)) !== session.contentHash) continue;
    for (const material of session.lesson.materials) {
      const source = sources.get(material.rootId), id = /^corpus-([a-f0-9]{64})$/.exec(material.id)?.[1];
      if (!source || !id || material.sourceId !== source.id || material.blocks.length !== 1) continue;
      const text = material.blocks[0].text;
      if (text.length > 12000 || text.trim().split(/\s+/).length <= 700 && !shortReadingScopes.records.some(scope => scope.sha256 === id) || source.passages.some(passage => passage.id === id)) continue;
      if (id !== await textDigest(text) && id !== await textDigest(`${source.rootId}\0${text}`)) continue;
      registerCorpusSeenText(source, id, text);
    }
  }
  return { version: 1, failures: [], records: [...sources.values()] };
}
