import { corpusDisagreementSynthesis, disagreementSynthesisOperation, disagreementSynthesisPrompt, disagreementSynthesisSupport } from './corpusDisagreementSynthesis';
import disagreementSynthesisScopes from '../../content/corpus/c2-disagreement-synthesis-scopes.json';
import { corpusFaithfulParaphrase, faithfulParaphraseOperation, faithfulParaphrasePrompt, faithfulParaphraseSupport } from './corpusFaithfulParaphrase';
import faithfulParaphraseScopes from '../../content/corpus/c2-faithful-paraphrase-scopes.json';
import { corpusComplexPragmatics, complexPragmaticsOperation, complexPragmaticsPrompt, complexPragmaticsSupport } from './corpusComplexPragmatics';
import complexPragmaticsScopes from '../../content/corpus/c2-complex-pragmatics-scopes.json';
import { corpusLayeredPosition, layeredPositionOperation, layeredPositionPrompt, layeredPositionSupport } from './corpusLayeredPosition';
import layeredPositionScopes from '../../content/corpus/c2-layered-position-scopes.json';
import { corpusRhetoricalFunction, rhetoricalFunctionOperation, rhetoricalFunctionPrompt, rhetoricalFunctionSupport } from './corpusRhetoricalFunction';
import rhetoricalFunctionScopes from '../../content/corpus/c2-rhetorical-function-scopes.json';
import { corpusNuancedMeaning, nuancedMeaningOperation, nuancedMeaningPrompt, nuancedMeaningSupport } from './corpusNuancedMeaning';
import nuancedMeaningScopes from '../../content/corpus/c2-nuanced-meaning-scopes.json';
import { corpusInformationDensity, informationDensityOperation, informationDensitySupport, informationDensityPrompt } from './corpusInformationDensity';
import informationDensityScopes from '../../content/corpus/c1-information-density-scopes.json';
import { corpusIndirectStance, indirectStanceOperation, indirectStancePrompt, indirectStanceSupport } from './corpusIndirectStance';
import indirectStanceScopes from '../../content/corpus/c1-indirect-stance-scopes.json';
import { corpusArgumentBoundaries, argumentBoundariesOperation, argumentBoundariesPrompt, argumentBoundariesSupport } from './corpusArgumentBoundaries';
import argumentBoundariesScopes from '../../content/corpus/c1-argument-boundaries-scopes.json';
import { corpusRegisterAudience, registerAudienceOperation, registerAudiencePrompt, registerAudienceSupport } from './corpusRegisterAudience';
import registerAudienceScopes from '../../content/corpus/c1-register-audience-scopes.json';
import { corpusDiscourseOrganization, discourseOrganizationOperation, discourseOrganizationSupport } from './corpusDiscourseOrganization';
import discourseOrganizationScopes from '../../content/corpus/c1-discourse-organization-scopes.json';
import { corpusImplicitIntention, implicitIntentionPrompt, implicitIntentionOperation, implicitIntentionSupport } from './corpusImplicitIntention';
import implicitIntentionScopes from '../../content/corpus/c1-implicit-intention-scopes.json';
import { corpusViewAttribution, viewAttributionPrompt, viewAttributionOperation, viewAttributionSupport } from './corpusViewAttribution';
import viewAttributionScopes from '../../content/corpus/b2-view-attribution-scopes.json';
import { corpusInformationSynthesis, informationSynthesisPrompt, informationSynthesisOperation, informationSynthesisSupport } from './corpusInformationSynthesis';
import informationSynthesisScopes from '../../content/corpus/b2-information-synthesis-scopes.json';
import { corpusSpeakerAttitude, speakerAttitudePrompt, speakerAttitudeOperation, speakerAttitudeSupport } from './corpusSpeakerAttitude';
import speakerAttitudeScopes from '../../content/corpus/b2-speaker-attitude-scopes.json';
import { corpusQualifiedConcession, qualifiedConcessionPrompt, qualifiedConcessionOperation, qualifiedConcessionSupport } from './corpusQualifiedConcession';
import qualifiedConcessionScopes from '../../content/corpus/b2-qualified-concession-scopes.json';
import { corpusComparison, comparisonOperation, comparisonSupport } from './corpusComparison';
import comparisonScopes from '../../content/corpus/b2-comparison-scopes.json';
import { corpusClaimExamples, claimExampleOperation, claimExampleSupport } from './corpusClaimExamples';
import { spokenAttributionPairs, spokenAttributionMatchingPrompt } from './spokenAttribution';
import { spokenCondition, spokenConditionPrompt } from './spokenCondition';
import { corpusReference, referenceSupport } from './corpusReference';
import { admittedLongClip, admittedLongText, maxQualifiedSpokenWords, maxQualifiedSpokenSeconds } from './spokenLongAdmission';
import { z } from 'zod';
import { corpusPreferencePool, corpusReviewMatch, corpusOperation } from './corpusPractice';
import type { Preferences } from '../shared/preferences';
import { corpusSchema, corpusRestoration, corpusSequence, corpusLanguageSchema, validCorpusLanguage, validCorpusSource, corpusStartingPoint, corpusQualification, corpusAttribution, corpusDates, corpusOutcome } from './corpus';
import { lessonSchema, recordingSchema, sourceCreditSchema, levelSchema, type CorpusQuestionKind, type Lesson } from '../shared/content';

const segmentSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1).max(12000), audioStart: z.number().nonnegative(), audioEnd: z.number().positive() }).strict();
const clipSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/), text: z.string().min(1).max(12000), wordCount: z.number().int().min(8).max(maxQualifiedSpokenWords),
  audio: recordingSchema.extend({ src: z.string().regex(/^(?:media\/[a-z0-9-]+\.mp3|\/audio\/community-[a-f0-9]{64}\/[a-z0-9-]+\.mp3)$/), duration: z.number().positive().max(maxQualifiedSpokenSeconds), synthetic: z.literal(false).optional() }),
  language: corpusLanguageSchema.optional(),
  audioSourceId: z.string().min(1).max(120), credit: sourceCreditSchema,
  qualityFlags: z.array(z.string().min(1).max(500)).max(20).default(['Quality audit missing; updated source metadata required.']),
  segments: z.array(segmentSchema).min(1).max(100), reviewStatus: z.literal('pending'), processing: z.string().min(1).max(2000),
}).strict().superRefine((clip, ctx) => {
  let end = 0, time = 0;
  if ((clip.wordCount > 180 || clip.audio.duration > 91) && !admittedLongClip(clip)) ctx.addIssue({ code: 'custom', message: 'Unqualified long listening source/audio' });
  if (!validCorpusLanguage(clip.text, clip.language)) ctx.addIssue({ code: 'custom', message: 'Invalid language token source range' });
  if (clip.text.trim().split(/\s+/).length !== clip.wordCount) ctx.addIssue({ code: 'custom', message: 'Clip word count mismatch' });
  for (const segment of clip.segments) {
    if (segment.start < end || segment.end <= segment.start || segment.end > clip.text.length || clip.text.slice(segment.start, segment.end) !== segment.text
        || /[\p{L}\p{N}]/u.test(clip.text.slice(end, segment.start)) || segment.audioStart < time || segment.audioEnd <= segment.audioStart || segment.audioEnd > clip.audio.duration
        || /[a-z][a-z]/i.test(clip.text.slice(Math.max(0, segment.start - 1), segment.start + 1))
        || /[a-z][a-z]/i.test(clip.text.slice(Math.max(0, segment.end - 1), segment.end + 1)))
      ctx.addIssue({ code: 'custom', message: 'Invalid source/audio segment' });
    end = segment.end; time = segment.audioEnd;
  }
  if (/[\p{L}\p{N}]/u.test(clip.text.slice(end))) ctx.addIssue({ code: 'custom', message: 'Unmatched transcript words' });
});
export const spokenCorpusSchema = z.object({ version: z.literal(1), communityPackageId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  records: z.array(corpusSchema.shape.records.element.omit({ passages: true }).extend({ clips: z.array(clipSchema).min(1).max(100) })).min(1).max(40),
}).strict().superRefine((bank, ctx) => {
  if (bank.records.some(source => !validCorpusSource(source))) ctx.addIssue({ code: 'custom', message: 'Mismatched official source provenance' });
  if (bank.records.some(source => source.clips.some(clip => {
    if (!source.id.startsWith('jfk-') && !source.id.startsWith('eisenhower-') && clip.wordCount <= 180 && clip.audio.duration <= 91) return false;
    const admitted = admittedLongClip(clip);
    return !admitted || admitted.rootId !== source.rootId || admitted.sourceHash !== source.sourceHash || admitted.sourceUrl !== source.originalUrl
      || admitted.textLicence !== source.licence || admitted.textLicenceUrl !== source.licenceUrl || !source.attribution.startsWith(admitted.textAttributionPrefix);
  }))) ctx.addIssue({ code: 'custom', message: 'Long listening source identity mismatch' });
  if (bank.records.some(source => !source.id.startsWith('fleurs-') && source.clips.some(clip => clip.wordCount < 30))) ctx.addIssue({ code: 'custom', message: 'Short listening requires a verified sentence source' });
  const ids = bank.records.flatMap(record => record.clips.map(clip => clip.id));
  if (new Set(bank.records.map(record => record.id)).size !== bank.records.length || new Set(ids).size !== ids.length || new Set(bank.records.map(record => record.rootId)).size !== bank.records.length) ctx.addIssue({ code: 'custom', message: 'Duplicate spoken sources/roots/clips' });
  if (bank.records.some(record => record.clips.some(clip => bank.communityPackageId
    ? !clip.audio.src.startsWith(`/audio/community-${bank.communityPackageId}/`) : !clip.audio.src.startsWith('media/')))) ctx.addIssue({ code: 'custom', message: 'Audio must belong to this package' });
});
export type SpokenCorpus = z.infer<typeof spokenCorpusSchema>;
export const maxInstalledSpokenBanks = 384;
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });

/** Draft exact-word listening and self-assessed interpretation without estimating ability. */
export function spokenCorpusLesson(bank: SpokenCorpus, seen: ReadonlySet<string>, seed: number, maxSeconds = 60, startingPoint?: z.infer<typeof levelSchema>, interests: Preferences['interests'] = [], focus?: CorpusQuestionKind, reviewTerms: readonly string[] = [], focusOperation?: string, applicationBanks: readonly SpokenCorpus[] = [], includeResponse = true) {
  if (!bank.communityPackageId || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isFinite(maxSeconds) || maxSeconds < 8 || maxSeconds > maxQualifiedSpokenSeconds) throw new Error('INVALID_SPOKEN_GENERATION');
  if (applicationBanks.length > maxInstalledSpokenBanks || applicationBanks.some(other => !other.communityPackageId)) throw new Error('INVALID_SPOKEN_APPLICATION');
  const beginner = startingPoint === 'A1' || startingPoint === 'A2';
  if (focusOperation === rhetoricalFunctionOperation && startingPoint !== 'C2') return;
  if (focusOperation === disagreementSynthesisOperation && startingPoint !== 'C2') return;
  if (focusOperation === faithfulParaphraseOperation && startingPoint !== 'C2') return;
  if (focusOperation === complexPragmaticsOperation && startingPoint !== 'C2') return;
  if (focusOperation === layeredPositionOperation && startingPoint !== 'C2') return;
  if (focusOperation === nuancedMeaningOperation && startingPoint !== 'C2') return;
  if ((focusOperation === informationDensityOperation || focusOperation === indirectStanceOperation || focusOperation === argumentBoundariesOperation || focusOperation === registerAudienceOperation || focusOperation === implicitIntentionOperation || focusOperation === discourseOrganizationOperation) && startingPoint !== 'C1') return;
  if ((focusOperation === viewAttributionOperation || focusOperation === informationSynthesisOperation || focusOperation === speakerAttitudeOperation || focusOperation === qualifiedConcessionOperation || focusOperation === claimExampleOperation || focusOperation === comparisonOperation) && startingPoint !== 'B2') return;
  const restore = (text: string, value: number, language?: SpokenCorpus['records'][number]['clips'][number]['language']) => admittedLongText(text) ? undefined : corpusRestoration(text, value, language);
  const sequenceFor = (text: string, value: number) => admittedLongText(text) ? undefined : corpusSequence(text, value);
  const reference = (text: string, value: number, operation = focusOperation) => beginner || operation && operation !== 'choice:reference' ? undefined : corpusReference(text, value);
  const permittedDuration = (clip: SpokenCorpus['records'][number]['clips'][number]) => clip.audio.duration <= maxSeconds && (clip.audio.duration <= 91 && clip.wordCount <= 180 || !!startingPoint && !!admittedLongClip(clip)?.runtimeTargets.includes(startingPoint));
  if (beginner && focusOperation === 'choice:stated-outcome') return;
  const outcome = (text: string, value: number, operation = focusOperation) => admittedLongText(text) || beginner || operation && operation !== 'choice:stated-outcome' ? undefined : corpusOutcome(text, value);
  const dates = (text: string, value: number) => admittedLongText(text) || beginner ? undefined : corpusDates(text, value);
  const semantic = (text: string, value: number, operation = focusOperation) => {
    if (beginner || admittedLongText(text)) return;
    return [corpusQualification(text, value), corpusAttribution(text, value), spokenCondition(text, value)].find(task => task && (!operation || `evidence:${task.prompt}` === operation));
  };
  const matching = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    const text = clip.text;
    if (startingPoint === 'C1' && (!operation || operation === indirectStanceOperation)) {
      const scope = indirectStanceScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
        && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
        && scope.clipId === clip.id && scope.text === text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
        && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
        && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
        && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
      const frame = scope && corpusIndirectStance(text, value >>> 0);
      if (frame) return { ...frame, claimExamples: false, discourse: false };
    }
    if (startingPoint === 'C1' && (!operation || operation === argumentBoundariesOperation)) {
      const scope = argumentBoundariesScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
        && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
        && scope.clipId === clip.id && scope.text === text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
        && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
        && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
        && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
      const frame = scope && corpusArgumentBoundaries(text, value >>> 0);
      if (frame) return { ...frame, claimExamples: false, discourse: false };
    }
    if (startingPoint === 'C1' && (!operation || operation === registerAudienceOperation)) {
      const scope = registerAudienceScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
        && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
        && scope.clipId === clip.id && scope.text === text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
        && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
        && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
        && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
      const frame = scope && corpusRegisterAudience(text, value >>> 0);
      if (frame) return { ...frame, claimExamples: false, discourse: false };
    }
    if (startingPoint === 'C1' && (!operation || operation === discourseOrganizationOperation)) {
      const scope = discourseOrganizationScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
        && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
        && scope.clipId === clip.id && scope.text === text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
        && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
        && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
        && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
      const frame = scope && corpusDiscourseOrganization(text, value >>> 0);
      if (frame) return { ...frame, claimExamples: false, discourse: true };
    }
    if (startingPoint === 'B2' && admittedLongText(text) && (!operation || operation === claimExampleOperation)) {
      const frame = corpusClaimExamples(text, value >>> 0);
      return frame && { ...frame, claimExamples: true, discourse: false };
    }
    if (admittedLongText(text) || beginner || operation && operation !== `matching:${spokenAttributionMatchingPrompt}`) return;
    const frame = spokenAttributionPairs(text, value);
    return frame && { ...frame, prompt: spokenAttributionMatchingPrompt, explanation: english(frame.pairs.map(pair => `${pair.label} → ${pair.answer}`).join(' ')), claimExamples: false, discourse: false };
  };
  const rhetoric = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C2' || operation && operation !== rhetoricalFunctionOperation) return;
    const scope = rhetoricalFunctionScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusRhetoricalFunction(clip.text, value >>> 0);
  };
  const disagreement = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C2' || operation && operation !== disagreementSynthesisOperation) return;
    const scope = disagreementSynthesisScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusDisagreementSynthesis(clip.text, value >>> 0);
  };
  const paraphrase = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C2' || operation && operation !== faithfulParaphraseOperation) return;
    const scope = faithfulParaphraseScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusFaithfulParaphrase(clip.text, value >>> 0);
  };
  const pragmatics = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C2' || operation && operation !== complexPragmaticsOperation) return;
    const scope = complexPragmaticsScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusComplexPragmatics(clip.text, value >>> 0);
  };
  const layers = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C2' || operation && operation !== layeredPositionOperation) return;
    const scope = layeredPositionScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusLayeredPosition(clip.text, value >>> 0);
  };
  const nuance = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C2' || operation && operation !== nuancedMeaningOperation) return;
    const scope = nuancedMeaningScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusNuancedMeaning(clip.text, value >>> 0);
  };
  const density = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C1' || operation && operation !== informationDensityOperation) return;
    const scope = informationDensityScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusInformationDensity(clip.text, value >>> 0);
  };
  const implicit = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'C1' || operation && operation !== implicitIntentionOperation) return;
    const scope = implicitIntentionScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusImplicitIntention(clip.text, value >>> 0);
  };
  const views = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'B2' || operation && operation !== viewAttributionOperation) return;
    const scope = viewAttributionScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusViewAttribution(clip.text, value >>> 0);
  };
  const synthesis = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'B2' || operation && operation !== informationSynthesisOperation) return;
    const scope = informationSynthesisScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusInformationSynthesis(clip.text, value >>> 0);
  };
  const attitude = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'B2' || operation && operation !== speakerAttitudeOperation) return;
    const scope = speakerAttitudeScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusSpeakerAttitude(clip.text, value >>> 0);
  };
  const limited = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'B2' || operation && operation !== qualifiedConcessionOperation) return;
    const scope = qualifiedConcessionScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusQualifiedConcession(clip.text, value >>> 0);
  };
  const comparison = (source: SpokenCorpus['records'][number], clip: SpokenCorpus['records'][number]['clips'][number], value: number, operation = focusOperation) => {
    if (startingPoint !== 'B2' || operation && operation !== comparisonOperation) return;
    const scope = comparisonScopes.listening.find(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash
      && scope.sourceCredit.attribution === source.attribution && scope.sourceCredit.license === source.licence && scope.sourceCredit.sourceUrl === source.originalUrl
      && scope.clipId === clip.id && scope.text === clip.text && scope.audio.sha256 === clip.audio.sha256 && scope.audio.duration === clip.audio.duration
      && scope.audio.author === clip.audio.author && scope.audio.license === clip.audio.license && scope.audio.sourceUrl === clip.audio.sourceUrl
      && scope.credit.attribution === clip.credit.attribution && scope.credit.license === clip.credit.license && scope.credit.sourceUrl === clip.credit.sourceUrl
      && JSON.stringify(scope.segments) === JSON.stringify(clip.segments));
    return scope && corpusComparison(clip.text, value >>> 0);
  };
  const choices = bank.records.flatMap(source => source.clips.map(clip => ({ source, clip, packageId: bank.communityPackageId! }))).filter(({ source, clip }) => !clip.qualityFlags.length && !seen.has(clip.id) && permittedDuration(clip) && (!!restore(clip.text, seed, clip.language) || !!sequenceFor(clip.text, seed) || !!semantic(clip.text, seed) || !!dates(clip.text, seed) || !!matching(source, clip, seed) || !!outcome(clip.text, seed) || !!reference(clip.text, seed) || !!comparison(source, clip, seed) || !!limited(source, clip, seed) || !!attitude(source, clip, seed) || !!synthesis(source, clip, seed) || !!views(source, clip, seed) || !!rhetoric(source, clip, seed) || !!disagreement(source, clip, seed) || !!paraphrase(source, clip, seed) || !!pragmatics(source, clip, seed) || !!layers(source, clip, seed) || !!nuance(source, clip, seed) || !!density(source, clip, seed) || !!implicit(source, clip, seed)));
  const primaryRoots = new Set(bank.records.map(source => source.rootId));
  const foreign = applicationBanks.flatMap(other => other.records.filter(source => !primaryRoots.has(source.rootId)).flatMap(source => source.clips.map(clip => ({ source, clip, packageId: other.communityPackageId! })))).filter(({ clip, packageId }) => !clip.qualityFlags.length && !seen.has(clip.id) && permittedDuration(clip) && clip.audio.src.startsWith(`/audio/community-${packageId}/`));
  const operationKinds: CorpusQuestionKind[] = [];
  if (choices.some(({ clip }) => dates(clip.text, seed))) operationKinds.push('table');
  if (choices.some(({ clip }) => sequenceFor(clip.text, seed))) operationKinds.push('sequence');
  if (choices.some(({ clip }) => semantic(clip.text, seed))) operationKinds.push('evidence');
  if (choices.some(({ clip }) => restore(clip.text, seed, clip.language))) operationKinds.push('completion');
  if (choices.some(({ source, clip }) => matching(source, clip, seed))) operationKinds.push('matching');
  const outcomeRoots = new Set([...choices, ...foreign].filter(({ clip }) => outcome(clip.text, seed)).map(({ source }) => source.rootId));
  if (choices.some(({ clip }) => outcome(clip.text, seed))) operationKinds.push('choice');
  if (choices.some(({ clip }) => reference(clip.text, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const referenceRoots = new Set([...choices, ...foreign].filter(({ clip }) => reference(clip.text, seed)).map(({ source }) => source.rootId));
  const rhetoricAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => rhetoric(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (rhetoricAvailable && choices.some(({ source, clip }) => rhetoric(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const disagreementAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => disagreement(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (disagreementAvailable && choices.some(({ source, clip }) => disagreement(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const paraphraseAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => paraphrase(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (paraphraseAvailable && choices.some(({ source, clip }) => paraphrase(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const pragmaticsAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => pragmatics(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (pragmaticsAvailable && choices.some(({ source, clip }) => pragmatics(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const layersAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => layers(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (layersAvailable && choices.some(({ source, clip }) => layers(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const nuanceAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => nuance(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (nuanceAvailable && choices.some(({ source, clip }) => nuance(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const densityAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => density(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (densityAvailable && choices.some(({ source, clip }) => density(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const implicitAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => implicit(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (implicitAvailable && choices.some(({ source, clip }) => implicit(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const viewsAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => views(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (viewsAvailable && choices.some(({ source, clip }) => views(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const synthesisAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => synthesis(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (synthesisAvailable && choices.some(({ source, clip }) => synthesis(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const attitudeAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => attitude(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (attitudeAvailable && choices.some(({ source, clip }) => attitude(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const limitedAvailable = new Set([...choices, ...foreign].filter(({ source, clip }) => limited(source, clip, seed)).map(({ source }) => source.rootId)).size > 1;
  if (limitedAvailable && choices.some(({ source, clip }) => limited(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const comparisonRoots = new Set([...choices, ...foreign].filter(({ source, clip }) => comparison(source, clip, seed)).map(({ source }) => source.rootId));
  const comparisonAvailable = comparisonRoots.size > 1;
  if (comparisonAvailable && choices.some(({ source, clip }) => comparison(source, clip, seed)) && !operationKinds.includes('choice')) operationKinds.push('choice');
  const referenceAvailable = referenceRoots.size > 1;
  const outcomeAvailable = outcomeRoots.size > 1 && operationKinds.includes('choice');
  if (!operationKinds.length) return;
  if (focusOperation === 'choice:stated-outcome' && !outcomeAvailable) return;
  if (focusOperation === 'choice:reference' && !referenceAvailable) return;
  if (focusOperation === rhetoricalFunctionOperation && !rhetoricAvailable) return;
  if (focusOperation === disagreementSynthesisOperation && !disagreementAvailable) return;
  if (focusOperation === faithfulParaphraseOperation && !paraphraseAvailable) return;
  if (focusOperation === complexPragmaticsOperation && !pragmaticsAvailable) return;
  if (focusOperation === layeredPositionOperation && !layersAvailable) return;
  if (focusOperation === nuancedMeaningOperation && !nuanceAvailable) return;
  if (focusOperation === informationDensityOperation && !densityAvailable) return;
  if (focusOperation === implicitIntentionOperation && !implicitAvailable) return;
  if (focusOperation === viewAttributionOperation && !viewsAvailable) return;
  if (focusOperation === informationSynthesisOperation && !synthesisAvailable) return;
  if (focusOperation === speakerAttitudeOperation && !attitudeAvailable) return;
  if (focusOperation === qualifiedConcessionOperation && !limitedAvailable) return;
  if (focusOperation === comparisonOperation && !comparisonAvailable) return;
  const operationPhases = operationKinds.length;
  const operationCycle = Math.max(1, choices.length);
  let selectedKind = focus && operationKinds.includes(focus) ? focus : operationKinds[Math.floor(seed / operationCycle) % operationPhases];
  // Preserve primary-bank operation phases when installing application partners.
  if (selectedKind === 'choice' && !outcomeAvailable && !referenceAvailable && !comparisonAvailable && !limitedAvailable && !attitudeAvailable && !synthesisAvailable && !viewsAvailable && !implicitAvailable && !densityAvailable && !nuanceAvailable && !rhetoricAvailable && !layersAvailable && !pragmaticsAvailable && !paraphraseAvailable && !disagreementAvailable) {
    if (focus) return;
    selectedKind = operationKinds[Math.floor(seed / operationCycle) % (operationPhases - 1)];
  }
  const focused = choices.filter(({ source, clip }) => selectedKind === 'completion' ? !!restore(clip.text, seed, clip.language) : selectedKind === 'sequence' ? !!sequenceFor(clip.text, seed) : selectedKind === 'table' ? !!dates(clip.text, seed) : selectedKind === 'matching' ? !!matching(source, clip, seed) : selectedKind === 'choice' ? !!outcome(clip.text, seed) || referenceAvailable && !!reference(clip.text, seed) || comparisonAvailable && !!comparison(source, clip, seed) || limitedAvailable && !!limited(source, clip, seed) || attitudeAvailable && !!attitude(source, clip, seed) || synthesisAvailable && !!synthesis(source, clip, seed) || viewsAvailable && !!views(source, clip, seed) || !!rhetoric(source, clip, seed) || !!disagreement(source, clip, seed) || !!paraphrase(source, clip, seed) || !!pragmatics(source, clip, seed) || !!layers(source, clip, seed) || !!nuance(source, clip, seed) || !!density(source, clip, seed) || !!implicit(source, clip, seed) : selectedKind === 'evidence' && !!semantic(clip.text, seed));
  const candidates = focused.length ? focused : choices;
  const review = candidates.filter(({ clip }) => corpusReviewMatch(clip.text, reviewTerms));
  const eligible = review.length ? review : candidates;
  const pool = corpusPreferencePool(eligible, ({ source, clip }) => ({ title: source.title, text: clip.text, seconds: clip.audio.duration }), interests, seed, startingPoint);
  const first = pool[seed % pool.length];
  if (!first) return;
  const materialFor = ({ source, clip, packageId }: (typeof choices)[number], index: number, preferred = focus, operation = focusOperation): Lesson['materials'][number] => {
    const pairs = (preferred === 'matching' || !preferred && operationKinds[Math.floor((seed + index) / operationCycle) % operationPhases] === 'matching') ? matching(source, clip, seed + index, operation) : undefined;
    const table = (preferred === 'table' || !preferred && operationKinds[Math.floor((seed + index) / operationCycle) % operationPhases] === 'table') ? dates(clip.text, seed + index) : undefined;
    const interpretation = (preferred === 'evidence' || !preferred && operationKinds[Math.floor((seed + index) / operationCycle) % operationPhases] === 'evidence') ? semantic(clip.text, seed + index, operation) : undefined;
    const compared = (preferred === 'choice' || !preferred && operationKinds[Math.floor((seed + index) / operationCycle) % operationPhases] === 'choice') ? rhetoric(source, clip, seed + index, operation) ?? disagreement(source, clip, seed + index, operation) ?? paraphrase(source, clip, seed + index, operation) ?? pragmatics(source, clip, seed + index, operation) ?? layers(source, clip, seed + index, operation) ?? nuance(source, clip, seed + index, operation) ?? density(source, clip, seed + index, operation) ?? implicit(source, clip, seed + index, operation) ?? comparison(source, clip, seed + index, operation) ?? limited(source, clip, seed + index, operation) ?? attitude(source, clip, seed + index, operation) ?? synthesis(source, clip, seed + index, operation) ?? views(source, clip, seed + index, operation) : undefined;
    const result = (preferred === 'choice' || !preferred && operationKinds[Math.floor((seed + index) / operationCycle) % operationPhases] === 'choice') ? outcome(clip.text, seed + index, operation) : undefined;
    const referred = !result && preferred === 'choice' ? reference(clip.text, seed + index, operation) : undefined;
    const attributed = interpretation?.prompt.includes('attributes');
    const conditional = interpretation?.prompt === spokenConditionPrompt;
    const audioSpan = (span: { start: number; end: number }) => {
      let start = span.start, end = span.end;
      // Preserve snapshots; omit punctuation belonging to adjacent timed comparison segments.
      if (compared) {
        const text = clip.text.slice(start, end), offset = text.search(/[\p{L}\p{N}]/u);
        if (offset < 0) throw new Error('MISSING_SPOKEN_EVIDENCE');
        start += offset;
        end = span.start + text.replace(/[^\p{L}\p{N}]+$/u, '').length;
      }
      const parts = clip.segments.filter(part => part.end > start && part.start < end);
      if (!parts.length) throw new Error('MISSING_SPOKEN_EVIDENCE');
      return { ...span, audioStart: parts[0].audioStart, audioEnd: parts.at(-1)!.audioEnd };
    };
    const word = restore(clip.text, seed + index, clip.language);
    const segment = word ? clip.segments.find(segment => segment.start <= word.evidence.start && segment.end >= word.evidence.end) : undefined;
    // Ignore printed line wraps during segmentation without shifting offsets or paragraphs.
    const sentence = word ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(clip.text.replace(/(?<![\r\n])\r?\n(?!\r?\n)/g, wrap => ' '.repeat(wrap.length)))]
      .find(part => part.index <= word.evidence.start && part.index + part.segment.length >= word.evidence.end) : undefined;
    const offset = word && sentence ? word.evidence.start - sentence.index : 0;
    const gap = word && sentence ? (clip.text.slice(sentence.index, sentence.index + offset) + '________' + clip.text.slice(sentence.index + offset + word.answer.length, sentence.index + sentence.segment.length)).trim() : '';
    const sequence = (preferred === 'sequence' || preferred !== 'completion' && (!word || operationKinds[Math.floor((seed + index) / operationCycle) % operationPhases] === 'sequence') || !word) ? sequenceFor(clip.text, seed + index) : undefined;
    const sequenceSegments = sequence ? clip.segments.filter(part => part.end > sequence.evidence.start && part.start < sequence.evidence.end) : [];
    const id = `corpus-${clip.id}`;
    return { id, ...(packageId !== bank.communityPackageId ? { communityPackageId: packageId } : {}), rootId: source.rootId, sourceId: source.id, title: source.title, audio: clip.audio, credit: clip.credit, blocks: [{ id, text: clip.text }], questions: [
      compared ? { id: `${id}-cmp`, blockId: id, ...compared, evidence: audioSpan(compared.evidence), additionalEvidence: compared.additionalEvidence.map(span => ({ blockId: id, ...audioSpan(span) })), hints: compared.prompt.startsWith(disagreementSynthesisPrompt) ? disagreementSynthesisSupport.hints : compared.prompt.startsWith(faithfulParaphrasePrompt) ? faithfulParaphraseSupport.hints : compared.prompt.startsWith(complexPragmaticsPrompt) ? complexPragmaticsSupport.hints : compared.prompt.startsWith(layeredPositionPrompt) ? layeredPositionSupport.hints : compared.prompt.startsWith(rhetoricalFunctionPrompt) ? rhetoricalFunctionSupport.hints : compared.prompt.startsWith(nuancedMeaningPrompt) ? nuancedMeaningSupport.hints : compared.prompt === informationDensityPrompt ? informationDensitySupport.hints : compared.prompt === implicitIntentionPrompt ? implicitIntentionSupport.hints : compared.prompt === viewAttributionPrompt ? viewAttributionSupport.hints : compared.prompt === informationSynthesisPrompt ? informationSynthesisSupport.hints : compared.prompt === speakerAttitudePrompt ? speakerAttitudeSupport.hints : compared.prompt === qualifiedConcessionPrompt ? qualifiedConcessionSupport.hints : comparisonSupport.hints }
      : referred ? { id: `${id}-ref`, blockId: id, ...referred, prompt: referred.prompt.split(': “')[0], evidence: audioSpan(referred.evidence), additionalEvidence: referred.additionalEvidence.map(span => ({ ...audioSpan(span), blockId: id })), hints: referenceSupport.hints }
      : result ? { id: `${id}-result`, blockId: id, prompt: result.prompt, options: result.options, answer: result.answer,
        evidence: audioSpan(result.evidence), ...(result.additionalEvidence ? { additionalEvidence: result.additionalEvidence.map(span => ({ ...audioSpan(span), blockId: id })) } : {}),
        hints: [english('Keep the direction of the stated development and result.'), english('Replay the complete sentence containing “leading to” or “resulting in”.'), english('“Resulting in” states the forward outcome; “resulting from” reverses it, and “not resulting in” denies it. Keep every other limit.')],
        explanations: result.explanations.map(english),
      } : pairs ? { kind: 'matching', id: `${id}-${pairs.prompt === indirectStancePrompt ? 'ind' : pairs.prompt === argumentBoundariesPrompt ? 'arg' : pairs.prompt === registerAudiencePrompt ? 'reg' : pairs.discourse ? 'org' : pairs.claimExamples ? 'cx' : 'sources'}`, blockId: id, prompt: pairs.prompt, pairs: pairs.pairs, choices: pairs.choices,
        evidence: audioSpan(pairs.evidence), additionalEvidence: pairs.otherEvidence.map(span => ({ ...audioSpan(span), blockId: id })),
        hints: pairs.prompt === indirectStancePrompt ? indirectStanceSupport.hints : pairs.prompt === argumentBoundariesPrompt ? argumentBoundariesSupport.hints : pairs.prompt === registerAudiencePrompt ? registerAudienceSupport.hints : pairs.discourse ? discourseOrganizationSupport.hints : pairs.claimExamples ? claimExampleSupport.hints : [english('Listen for each named source.'), english('Keep the reporting verb with the complete claim.'), english('Replay the statements and match each claim to its source.')],
        explanation: pairs.explanation,
      } : table ? { kind: 'table', id: `${id}-years`, blockId: id, prompt: 'Listen and complete the years in the table. Write each year in digits.', rows: table.rows,
        evidence: audioSpan(table.evidence), additionalEvidence: table.otherEvidence.map(span => ({ ...audioSpan(span), blockId: id })),
        hints: [english('Listen for the event described by each row.'), english('Replay the statement and keep words such as “before”, “around” and “until”.'), english('Write the year in digits and check that it belongs to the correct event.')],
        explanation: english('Match each heard year to its complete statement. Preserve timing limits: “before” or “around” a year does not mean exactly in that year.'),
      } : interpretation ? { kind: 'evidence', id: `${id}-meaning`, blockId: id, prompt: interpretation.prompt,
        spans: interpretation.spans.map(span => ({ ...span, ...audioSpan(span), blockId: id })), accepted: interpretation.accepted, evidence: audioSpan(interpretation.evidence),
        hints: pairs ? [english('Identify the two named sources.'), english('Replay each complete claim and nearby context.'), english('Compare what is attributed to each source without inventing agreement or disagreement.')] : conditional ? [english('Listen for a condition and its outcome.'), english('Replay the complete sentence and surrounding requirements.'), english('Keep both clauses; do not turn the outcome into an unconditional fact.')] : [english('Listen for wording that qualifies the claim or names its source.'), english('Compare the three quoted sentences with the recording.'), english('Keep an uncertainty marker or named source with the complete claim; it does not establish the claim as true.')],
        explanation: english(interpretation.explanation),
      } : sequence ? { kind: 'sequence', id: `${id}-sequence`, blockId: id, prompt: 'Listen and arrange these three sentences in the order spoken.', ...sequence,
        evidence: { ...sequence.evidence, audioStart: sequenceSegments[0].audioStart, audioEnd: sequenceSegments.at(-1)!.audioEnd },
        hints: [english('Listen for the three sentences.'), english('Use names, pronouns and connecting words to follow their order.'), english('Replay the recording and compare the first and last sentences.')],
        explanation: english('The recording presents these sentences in this order.')
      } : { kind: 'completion', id: `${id}-restore`, blockId: id, prompt: `${word!.lemma ? 'Listen and complete with the form of “' + word!.lemma + '” used by the speaker:' : 'Listen and complete the sentence:'}\n${gap}`, answer: word!.answer, accepted: [word!.answer],
        evidence: { start: segment!.start, end: segment!.end, audioStart: segment!.audioStart, audioEnd: segment!.audioEnd },
        hints: [english('Listen for the missing word in the quoted phrase.'), english('Use the words before and after the gap to locate it.'), english('Replay the phrase and check the spelling of the word you heard.')],
        explanation: english(word!.lemma ? `The speaker uses “${word!.answer}”, a form of “${word!.lemma}”.` : `The speaker uses “${word!.answer}”.`) },
      ...(includeResponse ? [{ kind: 'response' as const, id: `${id}-response`, blockId: id, prompt: referred ? 'Quote the referring expression and its complete context. Explain why the other named entities are not its referent; preserve source scope and time.' : result ? 'Quote the complete development-to-result statement and explain its direction. Retain time, quantities and every event in the chain; distinguish the speaker’s wording from whether it is independently true.' : pairs ? 'Compare the two claims. Quote each named source and retain qualifications and surrounding context.' : conditional ? 'What condition and outcome does the speaker state? Quote both parts and preserve any other requirements. Explain what follows conditionally, without claiming the outcome has already happened.' : table ? 'Explain how the dates relate to the events. Quote the relevant statements and retain words such as “before”, “around” and “until”; do not infer a cause from date order.' : interpretation ? attributed
        ? 'Who is named as the source of the reported claim, and what do they claim? Quote the attribution and preserve any time or numerical limits. Explain why reporting a claim does not make it the narrator’s personal opinion or prove it true.'
        : 'What claim is presented as an inference, possibility or belief, and which words show this? Quote the wording and explain what is and is not established, keeping the time and surrounding context.'
        : 'Summarize what the speaker says in two sentences. Quote a few words you heard to support your interpretation.',
        evidence: { start: 0, end: clip.text.length, audioStart: clip.segments[0].audioStart, audioEnd: clip.segments.at(-1)!.audioEnd },
        criteria: referred ? [english('I quote the referring expression and its complete context.'), english('I identify the referent using the source wording, retaining time and scope.'), english('I explain why nearby words alone do not establish the referent.')] : result ? [english('I quote both the development and the complete stated result.'), english('I retain time, quantities and every event in the chain.'), english('I do not reverse the relationship, invent a sole cause or treat the source wording as independently verified fact.')] : pairs ? [english('I match each named source to its complete claim.'), english('I quote the recording and retain qualifications and surrounding context.'), english('I distinguish a reported claim from my own interpretation.')] : conditional ? [english('I quote both the condition and its outcome.'), english('I preserve other requirements and the surrounding context.'), english('I distinguish a conditional outcome from an unconditional or completed event.')] : table ? [english('I match each recorded date to its correct event.'), english('I retain timing limits and relevant context when quoting the statements.'), english('I distinguish what the dates establish from an inferred sequence or cause.')] : interpretation ? attributed
          ? [english('I keep the named source with its complete reported claim.'), english('I preserve time, quantities and qualifications using words from the recording.'), english('I distinguish an attributed report from the narrator’s opinion and from independently established truth.')]
          : [english('I connect the qualifying words to the correct claim.'), english('I preserve the time and context, including a reported past belief where relevant.'), english('I quote the recording without turning uncertainty or belief into established fact.')]
          : [english('My summary agrees with what the speaker says.'), english('I cite words I heard and avoid inventing missing context.')],
        hints: referred ? referenceSupport.hints : result ? [english('Identify the complete development and its result.'), english('Replay the entire sentence and keep all timing and event limits.'), english('Explain the stated forward relationship with a quotation; do not invent a sole cause or reverse its direction.')] : pairs ? [english('Identify the two named sources.'), english('Replay each complete claim and nearby context.'), english('Compare what is attributed to each source without inventing agreement or disagreement.')] : conditional ? [english('Identify the condition and outcome.'), english('Replay nearby statements for additional requirements.'), english('Explain what the statement establishes without removing its condition.')] : table ? [english('Find the event associated with each date.'), english('Replay the complete statements, including timing words and surrounding context.'), english('Explain the relationship without inventing an exact date, sequence or cause.')] : interpretation ? attributed
          ? [english('Listen for the named source before or after the claim.'), english('Replay the whole statement, including dates and quantities.'), english('Separate who reports the claim from whether it is true or personally endorsed.')]
          : [english('Listen for words that qualify how the claim is presented.'), english('Replay the whole sentence and its surrounding context.'), english('Explain the difference between a stated belief or possibility and an established fact.')]
          : [english('Identify the main situation or event.'), english('Listen for one supporting detail.'), english('Separate the speaker’s words from your interpretation.')],
        explanation: english(referred ? 'Quote both complete statements and retain the source scope. The response is self-assessed; it does not add an objective score.' : result ? 'The recording states a development-to-result relationship. Keep its complete chain and limits; this does not independently verify causation. Assess your interpretation using the points below.' : pairs ? 'Keep each source with its complete claim and surrounding context. Compare your quotations and interpretation with the recording.' : conditional ? 'Keep the condition, outcome and other stated requirements together. Compare your interpretation with the recording and assess it using the points below.' : table ? 'Keep each date with its event and timing limits, supported by the recorded statements. Date order alone does not establish a cause. Assess your explanation using the points below.' : interpretation ? attributed
          ? 'Keep the named source and its reported claim together, retaining dates, quantities and qualifications. Attribution alone does not establish truth or the narrator’s personal opinion. Compare your quotation and interpretation with the recording; assess this response yourself.'
          : 'Keep the qualifying wording with the claim and its time/context. A reported past belief or possible cause must not become an established present fact. Compare your quotation and interpretation with the recording; assess this response yourself.'
          : 'Compare your interpretation with the recording and assess it using the points below.') }] : []),
    ] };
  };
  const taught = materialFor(first, 0, selectedKind);
  const kind = 'kind' in taught.questions[0] ? taught.questions[0].kind : undefined;
  const target = !('kind' in taught.questions[0]) ? 'choice' : kind === 'matching' ? 'matching' : kind === 'table' ? 'table' : kind === 'evidence' ? 'evidence' : kind === 'sequence' ? 'sequence' : 'completion';
  const targetOperation = corpusOperation(taught.questions[0]);
  const other = [...new Map([...choices, ...foreign].filter(item => item.source.rootId !== first.source.rootId).map(item => [item.clip.id, item])).values()];
  const focusedOther = other.filter(({ source, clip }) => target === 'completion' ? !!restore(clip.text, seed + 1, clip.language) : target === 'sequence' ? !!sequenceFor(clip.text, seed + 1) : target === 'table' ? !!dates(clip.text, seed + 1) : target === 'matching' ? !!matching(source, clip, seed + 1, targetOperation) : target === 'choice' ? !!outcome(clip.text, seed + 1, targetOperation) || !!reference(clip.text, seed + 1, targetOperation) || !!comparison(source, clip, seed + 1, targetOperation) || !!limited(source, clip, seed + 1, targetOperation) || !!attitude(source, clip, seed + 1, targetOperation) || !!synthesis(source, clip, seed + 1, targetOperation) || !!views(source, clip, seed + 1, targetOperation) || !!rhetoric(source, clip, seed + 1, targetOperation) || !!disagreement(source, clip, seed + 1, targetOperation) || !!paraphrase(source, clip, seed + 1, targetOperation) || !!pragmatics(source, clip, seed + 1, targetOperation) || !!layers(source, clip, seed + 1, targetOperation) || !!nuance(source, clip, seed + 1, targetOperation) || !!density(source, clip, seed + 1, targetOperation) || !!implicit(source, clip, seed + 1, targetOperation) : target === 'evidence' && !!semantic(clip.text, seed + 1, targetOperation));
  if ((target === 'choice' || targetOperation === claimExampleOperation) && !focusedOther.length) return;
  const otherCandidates = focusedOther.length ? focusedOther : choices.filter(item => item.source.rootId !== first.source.rootId);
  const reviewOther = otherCandidates.filter(({ clip }) => corpusReviewMatch(clip.text, reviewTerms));
  const otherEligible = reviewOther.length ? reviewOther : otherCandidates;
  const secondPool = corpusPreferencePool(otherEligible, ({ source, clip }) => ({ title: source.title, text: clip.text, seconds: clip.audio.duration }), interests, seed + 1, startingPoint);
  const second = secondPool[(seed + 1) % secondPool.length];
  if (!second) return;
  const materials = [taught, materialFor(second, 1, target, targetOperation)];
  const conditional = taught.questions[0].prompt === spokenConditionPrompt;
  const attributed = target === 'evidence' && taught.questions[0].prompt.includes('attributes');
  const narratedAttribution = (attributed || target === 'matching') && materials.some(material => ['corpus-0c859fe0f5d6df248c475e869da3838dd70072ca46d9ccd601b5d629556c4b2a', 'corpus-2934d38c2c9997c9444ae5089cb38dee83b7a234f30704616b5298013cfc1697', 'corpus-bba9dc18c3fca9e625a2c72f1068459a3fc9e4953f901ca56849a50a8e991f95', 'corpus-76f5439a53548b5b3b33b1fa1b007bba2c4ed7c1ea9e4a1cb334c21ae53c552c', 'corpus-947c953b6370f2683f0272bc633e4f96df9a2aec8eb7b48b6df1b1763126e9d6'].includes(material.id));
  return corpusStartingPoint(lessonSchema.parse({ id: `spoken-corpus-v1-${first.clip.id.slice(0, 16)}-${second.clip.id.slice(0, 16)}`, communityPackageId: bank.communityPackageId,
    targetLevel: 'B2', skill: 'listening', reviewStatus: 'draft', sourceId: first.source.id, goalId: 'original-recording-wording-and-summary', generation: { generator: 'corpus-v1', seed, ...(focus ? { focus } : {}) },
    title: english(`${first.source.title} · ${second.source.title}`), goal: english(target === 'choice' ? 'Preserve a stated development-to-result relationship using recorded evidence.' : target === 'matching' ? 'Match claims to named sources and support a comparison with recorded words.' : conditional ? 'Identify the stated condition and outcome, retaining their limits with recorded evidence.' : target === 'table' ? 'Match heard years to their events, preserving timing limits and supporting your explanation with recorded words.' : target === 'evidence' ? attributed ? 'Keep a reported claim with its named source and explain its limits using recorded evidence.' : 'Identify qualified wording and explain the claim without turning uncertainty or belief into fact.' : 'Listen for exact words and support a short interpretation with recorded evidence.'),
    teaching: english((target === 'choice' ? 'Listen to the complete sentence. “Leading to” and “resulting in” state a development followed by its outcome; “led to” and “resulted in” use the past tense. “Resulting from” reverses that relationship; “not resulting in” denies it. Keep the whole event chain, time and quantities.' : target === 'matching' ? 'Match each complete claim to its named source, then compare their wording and limits.' : conditional ? 'Find the condition and outcome. Keep nearby requirements; a conditional outcome is not an unconditional fact.' : target === 'table' ? 'Match each event to its heard year and enter the digits. Keep timing words such as “before”, “around” and “until”.' : target === 'evidence' ? attributed ? 'Keep each claim with its named source, dates, quantities and limits. Attribution does not establish truth or the narrator’s opinion.' : 'Find the qualifying words and keep the claim’s time and context. A past belief or possible cause is not an established present fact.' : target === 'sequence' ? 'Listen for the three sentences and put them in spoken order. Use names, pronouns and connecting words to check.' : 'Use the words around the gap to find the phrase. Replay it, write the missing word and check its spelling and ending.') + (materials.some(material => material.rootId === 'wikipedia-article-244511' && material.blocks[0].text.includes('the bank vole in the 1950s')) ? ' A vole is a small rodent. Here, a species’ range is the area where it lives; the claim is limited to overlapping ranges.' : '') + (materials.some(material => material.id === 'corpus-97824a7503cd2d43a1590e85c2fb6f4afac59bd31ea24eb12d0ce63210c6bd11') ? ' Zeal means strong enthusiasm; a messenger carries messages. This excerpt does not name the person referred to by “he”; retain the pronouns without inventing an identity.' : '') + (materials.some(material => material.id === 'corpus-6ca99d38a5c90f61376e5895fb7ebc621f9adb39556008bf1a8200dea457cac2') ? ' This is a fairy-tale naming claim about the king and queen’s daughter. “Caused her to be named” can be restated as “resulted in her being named”; retain all three stated qualities. The story does not independently establish a real-world cause.' : '') + (materials.some(material => material.id === 'corpus-76f5439a53548b5b3b33b1fa1b007bba2c4ed7c1ea9e4a1cb334c21ae53c552c') ? ' These characters discuss going home after a family disappointment. A stated plan does not establish that they have left.' : '') + (materials.some(material => material.id === 'corpus-947c953b6370f2683f0272bc633e4f96df9a2aec8eb7b48b6df1b1763126e9d6') ? ' This novel describes a battle. Grant is the person discussed, not the source of these predictions. “Likely” means probable, not certain; animosity means hostility.' : '') + (narratedAttribution ? ' In narrated dialogue, a name after “said” identifies the character making the claim. Keep that character separate from the person mentioned in the claim and from the recording’s narrator.' : '')),
    workedExample: english(narratedAttribution ? 'Example: “Leo has arrived,” said Mira. → Mira makes a claim about Leo. Leo is the person mentioned, not the source of this claim. Narrating it does not make it the reader’s personal claim.' : target === 'choice' ? 'Example: “News of the discovery spread, leading to 200 people coming to Riverton from the rest of the United States and abroad.” → Replace “leading to” with “resulting in” to keep the stated result. “Resulting from” reverses the direction; “not resulting in” denies it. Retain 200, both places and the complete event; the example does not independently verify the claim.' : target === 'matching' ? 'Example: “Maya said the service might open next month. Noah argued the opening depended on further funding.” → “said the service might open next month.”: Maya; “argued the opening depended on further funding.”: Noah. Keep “might” and the funding condition. The claims need not disagree; reporting does not prove truth or the narrator’s endorsement.' : conditional ? 'Example: “If the light is green, the gate opens.” The gate opens if the light is green; this does not say it is open now.' : target === 'table' ? 'Example: “The museum opened before 2005. The tram service began around 2010.” → Rows: “The museum opened before ________.”: 2005; “The tram service began around ________.”: 2010. Enter only the digits. “Before” and “around” do not give exact event years; dates do not establish a cause.' : target === 'evidence' ? taught.questions[0].prompt.includes('attributes') ? 'Example: “According to the report, sales rose” names a source; “Sales rose” does not. Naming a source does not prove accuracy.' : 'Example: “It may have been a reason” leaves a possibility open; “It was a reason” states it directly. Keep the uncertainty.' : target === 'sequence' ? 'Example: “Mina opens a window.” → “She looks at the garden.” → “She closes the window.” Keep sentence order.' : target === 'completion' ? 'Example: “Nora puts the blue cup on the shelf.” → Gap: “Nora puts the ________ cup on the shelf.” → Answer: “blue”. Check the words around the gap and the spelling.' : 'Distinguish heard words from interpretation: “The speaker says …”, then “This suggests … because …”.'),
    nextStep: english('On the next unfamiliar recording, listen for a detail that supports or limits your first interpretation.'), ...(targetOperation === 'choice:reference' ? { goal: referenceSupport.goal, workedExample: referenceSupport.workedExample, nextStep: referenceSupport.nextStep, goalId: 'source-context-reference', teaching: Object.fromEntries(Object.entries(referenceSupport.teaching).map(([locale, text]) => [locale, text + (materials.some(material => material.rootId === 'wikipedia-article-10772350') ? ' Civilization: a society with cities and institutions. BCE/CE label historical years; dates and regions remain qualified.' : '') + (materials.some(material => material.rootId === 'wikipedia-article-187946') ? ' A search engine finds web pages; ranking orders results. This is a 2008 historical account, not current SEO advice.' : '')])) } : {}), materials }), startingPoint);
}
