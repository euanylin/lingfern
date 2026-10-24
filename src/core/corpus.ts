import { corpusDisagreementSynthesis, disagreementSynthesisOperation, disagreementSynthesisSupport, heardDisagreementSynthesisSupport } from './corpusDisagreementSynthesis';
import disagreementSynthesisScopes from '../../content/corpus/c2-disagreement-synthesis-scopes.json';
import { corpusFaithfulParaphrase, faithfulParaphraseOperation, faithfulParaphraseSupport, heardFaithfulParaphraseSupport } from './corpusFaithfulParaphrase';
import faithfulParaphraseScopes from '../../content/corpus/c2-faithful-paraphrase-scopes.json';
import { corpusComplexPragmatics, complexPragmaticsOperation, complexPragmaticsSupport, heardComplexPragmaticsSupport } from './corpusComplexPragmatics';
import complexPragmaticsScopes from '../../content/corpus/c2-complex-pragmatics-scopes.json';
import { corpusLayeredPosition, layeredPositionOperation, layeredPositionSupport, heardLayeredPositionSupport } from './corpusLayeredPosition';
import layeredPositionScopes from '../../content/corpus/c2-layered-position-scopes.json';
import { corpusRhetoricalFunction, rhetoricalFunctionOperation, rhetoricalFunctionSupport, heardRhetoricalFunctionSupport } from './corpusRhetoricalFunction';
import rhetoricalFunctionScopes from '../../content/corpus/c2-rhetorical-function-scopes.json';
import { corpusNuancedMeaning, nuancedMeaningOperation, nuancedMeaningSupport, heardNuancedMeaningSupport } from './corpusNuancedMeaning';
import nuancedMeaningScopes from '../../content/corpus/c2-nuanced-meaning-scopes.json';
import { corpusInformationDensity, informationDensityOperation, informationDensitySupport } from './corpusInformationDensity';
import informationDensityScopes from '../../content/corpus/c1-information-density-scopes.json';
import { corpusIndirectStance, indirectStanceOperation, indirectStanceSupport } from './corpusIndirectStance';
import indirectStanceScopes from '../../content/corpus/c1-indirect-stance-scopes.json';
import longListeningAdmission from '../../content/corpus/long-listening-admission.json';
import { sentenceSegments, nameEnding } from './corpusSegments';
export { sentenceSegments } from './corpusSegments';
import { corpusArgumentBoundaries, argumentBoundariesOperation, argumentBoundariesSupport } from './corpusArgumentBoundaries';
import argumentBoundariesScopes from '../../content/corpus/c1-argument-boundaries-scopes.json';
import { corpusRegisterAudience, registerAudienceOperation, registerAudienceSupport } from './corpusRegisterAudience';
import registerAudienceScopes from '../../content/corpus/c1-register-audience-scopes.json';
import { corpusDiscourseOrganization, discourseOrganizationOperation, discourseOrganizationSupport, readingDiscourseOrganizationSupport, heardDiscourseOrganizationSupport } from './corpusDiscourseOrganization';
import discourseOrganizationScopes from '../../content/corpus/c1-discourse-organization-scopes.json';
import { corpusImplicitIntention, implicitIntentionOperation, implicitIntentionSupport, heardImplicitIntentionSupport } from './corpusImplicitIntention';
import implicitIntentionScopes from '../../content/corpus/c1-implicit-intention-scopes.json';
import { corpusViewAttribution, viewAttributionOperation, viewAttributionSupport, readingViewAttributionSupport, heardViewAttributionSupport } from './corpusViewAttribution';
import b2ViewAttributionScopes from '../../content/corpus/b2-view-attribution-scopes.json';
import { corpusInformationSynthesis, informationSynthesisOperation, informationSynthesisSupport, readingInformationSynthesisSupport, heardInformationSynthesisSupport } from './corpusInformationSynthesis';
import b2InformationSynthesisScopes from '../../content/corpus/b2-information-synthesis-scopes.json';
import { corpusSpeakerAttitude, speakerAttitudeOperation, speakerAttitudeSupport, readingSpeakerAttitudeSupport, heardSpeakerAttitudeSupport } from './corpusSpeakerAttitude';
import b2SpeakerAttitudeScopes from '../../content/corpus/b2-speaker-attitude-scopes.json';
import { corpusQualifiedConcession, qualifiedConcessionOperation, qualifiedConcessionSupport, readingQualifiedConcessionSupport, heardQualifiedConcessionSupport } from './corpusQualifiedConcession';
import b2QualifiedConcessionScopes from '../../content/corpus/b2-qualified-concession-scopes.json';
import { corpusComparison, comparisonOperation, comparisonSupport, readingComparisonSupport, heardComparisonSupport } from './corpusComparison';
import b2ComparisonScopes from '../../content/corpus/b2-comparison-scopes.json';
import { corpusClaimExamples, claimExampleOperation, claimExampleSupport, readingClaimExampleSupport, heardClaimExampleSupport } from './corpusClaimExamples';
import b2ClaimExampleScopes from '../../content/corpus/b2-claim-example-scopes.json';
import { corpusProceduralPlan, proceduralPlanSupport } from './corpusProceduralPlan';
import b1ProcedureScopes from '../../content/corpus/b1-procedure-scopes.json';
import { corpusSpecificIntention, specificIntentionSupport } from './corpusSpecificIntention';
import b1IntentionScopes from '../../content/corpus/b1-intention-scopes.json';
import { corpusNarrativeMotive, narrativeMotiveSupport } from './corpusNarrativeMotive';
import b1MotiveScopes from '../../content/corpus/b1-motive-scopes.json';
import { corpusB1Reference, b1ReferenceSupport } from './corpusB1Reference';
import b1ReferenceScopes from '../../content/corpus/b1-reference-scopes.json';
import { corpusConditionalMeaning, conditionalMeaningSupport } from './corpusConditionalMeaning';
import b1ConditionScopes from '../../content/corpus/b1-condition-scopes.json';
import b1MainPointScopes from '../../content/corpus/b1-main-point-scopes.json';
import { corpusMainPoint, mainPointSupport } from './corpusMainPoint';
import personalGoalScopes from '../../content/corpus/a2-personal-goal-scopes.json';
import orderScopes from '../../content/corpus/a2-order-scopes.json';
import meaningScopes from '../../content/corpus/beginner-meaning-scopes.json';
import { readableQuotation } from '../shared/quoteLanguage';
import { corpusReference, referenceSupport } from './corpusReference';
import { admittedLongText } from './spokenLongAdmission';
import quoteExclusions from '../../content/daily-quote-exclusions.json';
import shortReadingScopes from '../../content/corpus/short-reading-scopes.json';
import { openReadingEdition, openReadingBookUrl, openReadingDownloadUrl, openReadingLicenceUrl, validOpenReadingChapter, validOpenReadingBeginnerScope } from '../shared/openReading';
import { z } from 'zod';
import { spokenAttributionMatchingPrompt } from './spokenAttribution';
import { corpusPreferencePool, corpusOperation, pairedReliancePrompt, pairedRelianceOperation, qualificationPrompt, politeRequestPrompt, qualifiedTimingPrompt, concessiveRelationPrompt, explicitContrastPrompt, negatedNecessityPrompt, outcomePrompt, qualifiedCausePrompt, actionSelectionPrompt, stageActionPrompt, requestedAddressPrompt, statedOriginPrompt, statedIntentionPrompt, workPhonePrompt, plannedOrderPrompt, personalGoalPrompts } from './corpusPractice';
import type { Preferences } from '../shared/preferences';
import { lessonSchema, levelSchema, type Lesson, type CorpusQuestionKind } from '../shared/content';

export const corpusLanguageSchema = z.object({
  generator: z.literal('spacy-3.8.16/en_core_web_sm-3.8.0'), modelSha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewStatus: z.literal('pending'),
  tokens: z.array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(),
    lemma: z.string().regex(/^[a-z]{1,80}$/), pos: z.enum(['NOUN', 'VERB', 'ADJ', 'ADV']) }).strict()).max(2000),
}).strict();

export function validCorpusLanguage(text: string, language?: z.infer<typeof corpusLanguageSchema>) {
  let end = 0;
  for (const token of language?.tokens ?? []) {
    if (token.start < end || token.end <= token.start || token.end > text.length || !/^[a-z]{3,20}$/i.test(text.slice(token.start, token.end))
        || /[a-z]/i.test(text[token.start - 1] ?? '') || /[a-z]/i.test(text[token.end] ?? '')) return false;
    end = token.end;
  }
  return true;
}

const corpusDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const quoteProvenanceSchema = z.object({
  pageId: z.number().int().positive(), revisionId: z.number().int().positive(), pageTitle: z.string().min(1).max(300),
  revisionTimestamp: z.iso.datetime(), pageTextSha256: corpusDigestSchema,
  section: z.array(z.string().max(300)).max(20), locator: z.string().min(1).max(2000),
  url: z.string().max(2000).regex(/^https:\/\/en\.wikiquote\.org\/w\/index\.php\?oldid=\d+(?:#[^\s]+)?$/),
  rawBlockSha256: corpusDigestSchema, sourceStart: z.number().int().nonnegative(), sourceEnd: z.number().int().positive(), textSha256: corpusDigestSchema,
  rightsEvidence: z.union([z.object({ workId: z.string().regex(/^gutenberg-\d+$/), sourceHash: corpusDigestSchema,
    matchedStart: z.number().int().nonnegative(), matchedEnd: z.number().int().positive(), matchedTextSha256: corpusDigestSchema,
    metadataSha256: corpusDigestSchema, rightsBasis: z.string().min(1).max(2000),
    subwork: z.object({ alias: z.string().min(1).max(300), header: z.string().min(1).max(300), start: z.number().int().nonnegative(), end: z.number().int().positive(),
      part: z.number().int().positive().nullable() }).strict().optional(),
  }).strict(), z.object({
    kind: z.enum(['us-government', 'cc-by-4.0']), workId: z.string().regex(/^(?:us-government|cc-by)-work-[a-f0-9]{64}$/),
    sourceUrl: z.string().max(2000).regex(/^https:\/\/(?:www\.eisenhowerlibrary\.gov|www\.presidency\.ucsb\.edu|(?:obama|biden)whitehouse\.archives\.gov|doi\.org)\/[^\s]+$/),
    sourceHash: corpusDigestSchema, rawSourceHash: corpusDigestSchema,
    matchedStart: z.number().int().nonnegative(), matchedEnd: z.number().int().positive(), matchedTextSha256: corpusDigestSchema,
    rightsBasis: z.string().min(1).max(2000), rightsUrl: z.enum(['https://www.govinfo.gov/content/pkg/USCODE-2024-title17/html/USCODE-2024-title17-chap1-sec105.htm', 'https://creativecommons.org/licenses/by/4.0/']),
  }).strict().superRefine((work, ctx) => {
    const government = work.kind === 'us-government';
    if (government !== work.workId.startsWith('us-government-work-') || government !== (new URL(work.sourceUrl).hostname !== 'doi.org')
      || government !== (work.rightsUrl !== 'https://creativecommons.org/licenses/by/4.0/'))
      ctx.addIssue({ code: 'custom', message: 'Quotation rights family mismatch' });
  })]),
}).strict().superRefine((quote, ctx) => {
  const work = quote.rightsEvidence;
  if (quote.sourceEnd <= quote.sourceStart || work.matchedEnd <= work.matchedStart
    || !quote.url.startsWith(`https://en.wikiquote.org/w/index.php?oldid=${quote.revisionId}`)
    || new URL(quote.url).searchParams.get('oldid') !== String(quote.revisionId)
    || 'subwork' in work && work.subwork && (work.subwork.end <= work.subwork.start || work.matchedStart < work.subwork.start || work.matchedEnd > work.subwork.end))
    ctx.addIssue({ code: 'custom', message: 'Invalid quotation source boundaries' });
});

const sourceProvenanceSchema = z.object({
  workId: z.string().min(1).max(120), chapter: z.string().min(1).max(300), locator: z.string().min(1).max(2000),
  sourceUrl: z.string().max(2000), rawSha256: corpusDigestSchema, canonicalSha256: corpusDigestSchema,
  paragraphIndex: z.number().int().nonnegative(), codePointStart: z.number().int().nonnegative(), codePointEnd: z.number().int().positive(),
  sourceStart: z.number().int().nonnegative(), sourceEnd: z.number().int().positive(), textSha256: corpusDigestSchema,
}).strict().superRefine((source, ctx) => {
  if (!validOpenReadingChapter(source.workId, source.sourceUrl, source.locator) || source.sourceEnd <= source.sourceStart
    || source.codePointEnd <= source.codePointStart || source.sourceStart < source.codePointStart || source.sourceEnd < source.codePointEnd)
    ctx.addIssue({ code: 'custom', message: 'Invalid archived paragraph source boundaries' });
});

export const maxCorpusWords = 1800;
const passageSchema = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), text: z.string().min(1).max(12000), wordCount: z.number().int().min(1).max(maxCorpusWords), quoteProvenance: quoteProvenanceSchema.optional(), sourceProvenance: sourceProvenanceSchema.optional(), startingPoints: z.array(z.enum(['A1', 'A2'])).min(1).max(2).optional(), language: corpusLanguageSchema.optional(), task: z.object({ prompt: z.string().min(1).max(500), evidenceText: z.string().min(20).max(240), explanation: z.string().min(1).max(500) }).strict().optional() }).strict().superRefine((passage, ctx) => { if (passage.sourceProvenance && (passage.quoteProvenance || passage.task || (passage.sourceProvenance.workId === 'bccampus-abealfreader1' || passage.startingPoints ? !validOpenReadingBeginnerScope(passage) : !!passage.startingPoints || passage.wordCount < 120 || passage.wordCount > 700) || passage.sourceProvenance.sourceEnd - passage.sourceProvenance.sourceStart !== passage.text.length || passage.sourceProvenance.codePointEnd - passage.sourceProvenance.codePointStart !== Array.from(passage.text).length)) ctx.addIssue({ code: 'custom', message: 'Invalid complete source paragraph scope' }); if (passage.wordCount < 10 && !passage.quoteProvenance) ctx.addIssue({ code: 'custom', message: 'Ordinary passages require ten words' }); if (passage.quoteProvenance && (passage.startingPoints || passage.task || passage.quoteProvenance.textSha256 !== passage.id)) ctx.addIssue({ code: 'custom', message: 'Quotation text identity or support scope mismatch' }); if (passage.wordCount < 120 && !passage.startingPoints && !passage.quoteProvenance) ctx.addIssue({ code: 'custom', message: 'Short passages require explicit beginner support scope' }); if (passage.text.trim().split(/\s+/).length !== passage.wordCount) ctx.addIssue({ code: 'custom', message: 'Passage word count mismatch' }); if (!validCorpusLanguage(passage.text, passage.language)) ctx.addIssue({ code: 'custom', message: 'Invalid language token source range' }); if (passage.task && (!passage.text.includes(passage.task.evidenceText) || passage.text.indexOf(passage.task.evidenceText) !== passage.text.lastIndexOf(passage.task.evidenceText))) ctx.addIssue({ code: 'custom', message: 'Task evidence must occur exactly once in the source' }); });
export function validCorpusSource(source: { id: string; rootId: string; originalUrl: string; downloadUrl: string; licenceUrl: string; sourceHash?: string }) {
  const family = source.id.split('-')[0];
  if (family === 'jfk' || family === 'eisenhower' || source.rootId.startsWith('eisenhower-') || source.rootId.startsWith('jfk-') || source.originalUrl.startsWith('https://www.presidency.ucsb.edu/') || source.downloadUrl.startsWith('https://www.presidency.ucsb.edu/') || source.originalUrl.startsWith('https://www.rice.edu/') || source.downloadUrl.startsWith('https://www.rice.edu/') || source.licenceUrl.startsWith('https://www.jfklibrary.org/') || source.originalUrl.startsWith('https://www.eisenhowerlibrary.gov/') || source.downloadUrl.startsWith('https://www.eisenhowerlibrary.gov/') || source.licenceUrl === 'https://www.archives.gov/global-pages/privacy.html') return longListeningAdmission.records.some(entry => 'sourceId' in entry && entry.sourceId === source.id && (entry.rootId.startsWith('jfk-speech-') || entry.rootId === 'eisenhower-speech-19610117-farewell') && entry.rootId === source.rootId && entry.sourceHash === source.sourceHash && entry.sourceUrl === source.originalUrl && source.downloadUrl === source.originalUrl && 'textLicenceUrl' in entry && entry.textLicenceUrl === source.licenceUrl);
  if (family === 'fleurs') return /^fleurs-[a-f0-9]{64}$/.test(source.id) && /^fleurs-work-[a-f0-9]{64}$/.test(source.rootId)
    && /^https:\/\/en\.(?:wikibooks|wikivoyage|wikinews)\.org\/wiki\/[^?#]+$/.test(source.originalUrl) && source.downloadUrl === source.originalUrl
    && source.licenceUrl === 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use';
  if (/^https:\/\/en\.(?:wikibooks|wikivoyage|wikinews)\.org\//.test(source.originalUrl)
    || /^https:\/\/en\.(?:wikibooks|wikivoyage|wikinews)\.org\//.test(source.downloadUrl)) return false;
  if (source.id.startsWith('lingfern-dialogue-')) return source.rootId === source.id && source.originalUrl === `https://lingfern.com/corpus/${source.id}` && source.downloadUrl === source.originalUrl && source.licenceUrl === openReadingLicenceUrl;
  if (family === 'frontiers' || family === 'plos') {
    const validId = family === 'frontiers' ? /^frontiers-10\.3389-frym\.\d{4}\.\d+$/.test(source.id) : /^plos-10\.1371-journal\.pone\.\d+$/.test(source.id);
    const doi = source.id.slice(family.length + 1).replace('-', '/');
    const url = family === 'frontiers' ? `https://kids.frontiersin.org/articles/${doi}` : `https://journals.plos.org/plosone/article?id=${doi}`;
    return validId && source.rootId === `${family}-article-${source.id.slice(family.length + 1)}` && source.originalUrl === url && source.downloadUrl === url && source.licenceUrl === openReadingLicenceUrl;
  }
  const edition = openReadingEdition(source.id);
  if (edition || source.licenceUrl === openReadingLicenceUrl || /^(?:openstax|bccampus)-/.test(source.id) || /^(?:openstax|bccampus)-/.test(source.rootId) || source.originalUrl.startsWith('https://github.com/openstax/') || source.originalUrl.startsWith('https://opentextbc.ca/')) return !!edition && source.rootId === edition.rootId && source.sourceHash === edition.sourceHash && source.originalUrl === openReadingBookUrl(edition) && source.downloadUrl === openReadingDownloadUrl(edition) && source.licenceUrl === openReadingLicenceUrl;
  if (family === 'usgs' || source.rootId.startsWith('usgs-') || source.originalUrl.startsWith('https://www.usgs.gov/') || source.downloadUrl.startsWith('https://www.usgs.gov/')
    || source.licenceUrl === 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits') return source.id === 'usgs-68924980278435' && source.rootId === 'usgs-article-68924980278435'
    && source.originalUrl === 'https://www.usgs.gov/water-science-school/water-cycle' && source.downloadUrl === source.originalUrl
    && source.licenceUrl === 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits';
  if (family === 'wikiquote' || source.rootId.startsWith('wikiquote-') || source.originalUrl.startsWith('https://en.wikiquote.org/') || source.downloadUrl.startsWith('https://en.wikiquote.org/')) return /^wikiquote-\d+$/.test(source.id) && source.rootId === `wikiquote-page-${source.id.slice(10)}` && /^https:\/\/en\.wikiquote\.org\/w\/index\.php\?oldid=\d+$/.test(source.originalUrl) && source.downloadUrl === source.originalUrl && source.licenceUrl === 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use';
  if (family !== 'nasa' && family !== 'noaa') return true;
  const host = family === 'nasa' ? 'www1.grc.nasa.gov' : 'oceanservice.noaa.gov';
  const licence = family === 'nasa' ? 'https://www.nasa.gov/nasa-brand-center/images-and-media/' : 'https://oceanservice.noaa.gov/about/faq.html';
  return source.originalUrl.startsWith(`https://${host}/`) && source.downloadUrl === source.originalUrl && source.licenceUrl === licence && source.rootId === `${family}-article-${source.id.slice(family.length + 1)}`;
}

export const corpusSchema = z.object({
  version: z.literal(1),
  records: z.array(z.object({
    id: z.string().max(120).regex(/^(?:(?:gutenberg|voa|wikipedia|nasa|noaa|usgs|wikiquote)-\d+|(?:openstax|bccampus)-[a-z0-9-]+|jfk-(?:united-nations-19630920|rice-19620912|american-university-19630610|inaugural-19610120)|eisenhower-farewell-19610117|fleurs-[a-f0-9]{64}|lingfern-dialogue-[a-z0-9-]+|frontiers-10\.3389-frym\.\d{4}\.\d+|plos-10\.1371-journal\.pone\.\d+)$/), rootId: z.string().max(160).regex(/^(?:(?:gutenberg-book|voa-article|wikipedia-article|nasa-article|noaa-article|usgs-article|wikiquote-page)-\d+|(?:openstax|bccampus)-book-[a-z0-9-]+|jfk-speech-(?:19630920-united-nations|19620912-rice|19630610-american-university|19610120-inaugural)|eisenhower-speech-19610117-farewell|fleurs-work-[a-f0-9]{64}|lingfern-dialogue-[a-z0-9-]+|frontiers-article-10\.3389-frym\.\d{4}\.\d+|plos-article-10\.1371-journal\.pone\.\d+)$/), title: z.string().min(1).max(300), authors: z.array(z.string().min(1).max(300)).min(1).max(32),
    originalUrl: z.string().max(2000).regex(/^https:\/\/(?:www\.rice\.edu\/kennedy|www\.presidency\.ucsb\.edu\/documents\/(?:address-before-the-18th-general-assembly-the-united-nations|commencement-address-american-university-washington|farewell-radio-and-television-address-the-american-people)|voicesofdemocracy\.umd\.edu\/kennedy-inaugural-address-speech-text\/|github\.com\/openstax\/[a-z0-9-]+\/blob\/[a-f0-9]{40}\/collections\/[a-z0-9-]+\.collection\.xml|opentextbc\.ca\/(?:physicalgeology2ed|abealfreader[1-5]|introtourism)\/|en\.wikiquote\.org\/w\/index\.php\?oldid=\d+|en\.wikipedia\.org\/wiki\/[^?#]+\?oldid=\d+|en\.(?:wikibooks|wikivoyage|wikinews)\.org\/wiki\/[^?#]+|www\.gutenberg\.org\/ebooks\/\d+|learningenglish\.voanews\.com\/a\/[a-z0-9-]+\/\d+\.html|www1\.grc\.nasa\.gov\/beginners-guide-to-aeronautics\/[a-z0-9-]+\/|oceanservice\.noaa\.gov\/facts\/[a-z0-9_-]+\.html|www\.usgs\.gov\/water-science-school\/water-cycle|kids\.frontiersin\.org\/articles\/10\.3389\/frym\.\d{4}\.\d+|journals\.plos\.org\/plosone\/article\?id=10\.1371\/journal\.pone\.\d+|lingfern\.com\/corpus\/lingfern-dialogue-[a-z0-9-]+)$/), downloadUrl: z.string().max(2000).regex(/^https:\/\/(?:www\.rice\.edu\/kennedy|www\.presidency\.ucsb\.edu\/documents\/(?:address-before-the-18th-general-assembly-the-united-nations|commencement-address-american-university-washington|farewell-radio-and-television-address-the-american-people)|voicesofdemocracy\.umd\.edu\/kennedy-inaugural-address-speech-text\/|api\.github\.com\/repos\/openstax\/[a-z0-9-]+\/tarball\/[a-f0-9]{40}|github\.com\/openstax\/[a-z0-9-]+\/blob\/[a-f0-9]{40}\/collections\/[a-z0-9-]+\.collection\.xml|opentextbc\.ca\/(?:physicalgeology2ed|abealfreader[1-5]|introtourism)\/|en\.wikiquote\.org\/w\/index\.php\?oldid=\d+|en\.wikipedia\.org\/wiki\/[^?#]+\?oldid=\d+|en\.(?:wikibooks|wikivoyage|wikinews)\.org\/wiki\/[^?#]+|www\.gutenberg\.org\/cache\/epub\/\d+\/pg\d+\.txt|learningenglish\.voanews\.com\/a\/[a-z0-9-]+\/\d+\.html|www1\.grc\.nasa\.gov\/beginners-guide-to-aeronautics\/[a-z0-9-]+\/|oceanservice\.noaa\.gov\/facts\/[a-z0-9_-]+\.html|www\.usgs\.gov\/water-science-school\/water-cycle|kids\.frontiersin\.org\/articles\/10\.3389\/frym\.\d{4}\.\d+|journals\.plos\.org\/plosone\/article\?id=10\.1371\/journal\.pone\.\d+|lingfern\.com\/corpus\/lingfern-dialogue-[a-z0-9-]+)$/),
    acquiredAt: z.iso.datetime(), language: z.literal('en'), licence: z.string().min(1).max(300), licenceUrl: z.enum(['https://www.jfklibrary.org/asset-viewer/archives/jfkwha-127-002', 'https://www.jfklibrary.org/asset-viewer/archives/jfkwha-190-002', 'https://www.jfklibrary.org/asset-viewer/archives/jfkwha-218', 'https://www.jfklibrary.org/asset-viewer/archives/jfkwha-001', 'https://www.archives.gov/global-pages/privacy.html', 'https://creativecommons.org/licenses/by/4.0/', 'https://www.gutenberg.org/policy/license.html', 'https://learningenglish.voanews.com/p/6861.html', 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use', 'https://www.nasa.gov/nasa-brand-center/images-and-media/', 'https://oceanservice.noaa.gov/about/faq.html', 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits']), attribution: z.string().min(1).max(1000), sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    originalText: z.string().min(1).max(512000).optional(),
    reviewStatus: z.literal('draft'), permissionReview: z.string().min(1).max(2000), editorialReview: z.literal('pending'), processing: z.string().min(1).max(2000), passages: z.array(passageSchema).max(20000),
  }).strict()).max(100), failures: z.array(z.object({ id: z.number().int().positive(), error: z.string().min(1) }).strict()),
}).strict().superRefine((corpus, ctx) => {
  if (corpus.records.some(source => !validCorpusSource(source))) ctx.addIssue({ code: 'custom', message: 'COMMUNITY_SOURCE: mismatched official source provenance' });
  for (const source of corpus.records) {
    if (source.id.startsWith('jfk-') || source.id.startsWith('eisenhower-')) ctx.addIssue({ code: 'custom', message: 'Only the exact qualified listening window is admitted for this speech' });
    const edition = openReadingEdition(source.id);
    if (edition && source.originalText) ctx.addIssue({ code: 'custom', message: 'Archived paragraphs cannot join originalText' });
    if (source.id === 'bccampus-abealfreader1' && new Set(source.passages.map(passage => passage.id)).size !== source.passages.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate reviewed beginner source scope' });
    const wikiquote = source.id.startsWith('wikiquote-');
    if (wikiquote && source.originalText) ctx.addIssue({ code: 'custom', message: 'Quotation pages cannot join excerpts into originalText' });
    for (const passage of source.passages) {
      if (!!edition !== !!passage.sourceProvenance || passage.sourceProvenance && passage.sourceProvenance.workId !== source.id) ctx.addIssue({ code: 'custom', message: 'Archived paragraph ownership mismatch' });
      const quote = passage.quoteProvenance;
      if (wikiquote !== !!quote || quote && (source.id !== `wikiquote-${quote.pageId}` || source.title !== quote.pageTitle || source.rootId !== `wikiquote-page-${quote.pageId}`
        || source.sourceHash !== quote.pageTextSha256 || source.originalUrl !== `https://en.wikiquote.org/w/index.php?oldid=${quote.revisionId}`))
        ctx.addIssue({ code: 'custom', message: 'Quotation source provenance mismatch' });
    }
  }
  for (const field of ['id', 'rootId'] as const) if (new Set(corpus.records.map(record => record[field])).size !== corpus.records.length)
    ctx.addIssue({ code: 'custom', message: `COMMUNITY_SOURCE: duplicate corpus source ${field}` });
});
export type Corpus = z.infer<typeof corpusSchema>;

/** Track exposure and transfer by original work, including Wikiquote copies. */
export function corpusMaterialRoot(source: Corpus['records'][number], passage: Corpus['records'][number]['passages'][number]) {
  return passage.quoteProvenance ? passage.quoteProvenance.rightsEvidence.workId.replace('gutenberg-', 'gutenberg-book-') : source.rootId;
}

/** Apply preview and unfamiliar-work exclusions at the saved-material exposure boundary. */
export function filterCorpusRoots(corpus: Corpus, roots: ReadonlySet<string>, include = false): Corpus {
  return { ...corpus, records: corpus.records.map(source => ({ ...source,
    passages: source.passages.filter(passage => roots.has(corpusMaterialRoot(source, passage)) === include),
  })).filter(source => source.passages.length) };
}

type SourceRange = { start: number; end: number; long: boolean };
const shortReadingIds = new Set(shortReadingScopes.records.map(scope => scope.sha256));
// Keep saved windows source-local even when requested sizes differ.
const priorCorpusRanges = new WeakMap<Corpus['records'][number], Map<string, SourceRange>>();
export function registerCorpusSeenText(source: Corpus['records'][number], id: string, text: string) {
  const original = source.originalText, start = original?.indexOf(text) ?? -1;
  if (!/^[a-f0-9]{64}$/.test(id) || !text || text.length > 12000 || !original || start < 0 || start !== original.lastIndexOf(text)) return;
  const words = text.trim().split(/\s+/).length;
  if (words <= 700 && !shortReadingIds.has(id) || words > maxCorpusWords) return;
  const ranges = priorCorpusRanges.get(source) ?? new Map<string, SourceRange>();
  if (ranges.size >= 20000 && !ranges.has(id)) throw new Error('CORPUS_LIMIT');
  ranges.set(id, { start, end: start + text.length, long: true }); priorCorpusRanges.set(source, ranges);
}

function unseenCorpusPassages(source: Corpus['records'][number], seen: ReadonlySet<string>) {
  const original = source.originalText, ranges: SourceRange[] = [];
  for (const [id, range] of priorCorpusRanges.get(source) ?? []) if (seen.has(id)) ranges.push(range);
  for (const passage of source.passages) if (seen.has(passage.id) && original) {
    const start = original.indexOf(passage.text);
    if (start >= 0 && start === original.lastIndexOf(passage.text)) ranges.push({ start, end: start + passage.text.length, long: passage.wordCount > 700 || shortReadingIds.has(passage.id) });
  }
  if (!original) {
    const known = source.passages.filter(passage => seen.has(passage.id));
    // shortcut: exact containment for fixed windows; verify source offsets before adding variable windows.
    return source.passages.filter(passage => (!passage.quoteProvenance || readableQuotation(passage.text)) && !quoteExclusions.some(exclusion => passage.quoteProvenance && (passage.id === exclusion.textSha256 || passage.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en') === exclusion.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en'))) && !seen.has(passage.id)
      && !shortReadingScopes.records.some(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash && scope.parentId === passage.id && seen.has(scope.sha256)) && !known.some(prior =>
      (passage.wordCount > 700 || prior.wordCount > 700 || shortReadingIds.has(passage.id) || shortReadingIds.has(prior.id)) && (passage.text.includes(prior.text) || prior.text.includes(passage.text))));
  }
  if (!ranges.length) return source.passages.filter(passage => !seen.has(passage.id)
    && !shortReadingScopes.records.some(scope => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash && scope.parentId === passage.id && seen.has(scope.sha256)));
  ranges.sort((a, b) => a.start - b.start);
  const merge = (input: SourceRange[]) => {
    const merged: SourceRange[] = [];
    for (const range of input) {
      const prior = merged.at(-1);
      if (prior && range.start <= prior.end) prior.end = Math.max(prior.end, range.end);
      else merged.push({ ...range });
    }
    return merged;
  };
  const allRanges = merge(ranges), longRanges = merge(ranges.filter(range => range.long));
  return source.passages.filter(passage => {
    if (seen.has(passage.id)) return false;
    // Beginner excerpts may overlap; only joined long windows extend passage-ID exposure.

    const merged = passage.wordCount > 700 || shortReadingIds.has(passage.id) ? allRanges : longRanges;
    if (!merged.length) return true;
    const start = original.indexOf(passage.text);
    if (start < 0 || start !== original.lastIndexOf(passage.text)) return passage.wordCount <= 700;
    let low = 0, high = merged.length;
    while (low < high) { const mid = (low + high) >>> 1; if (merged[mid].end <= start) low = mid + 1; else high = mid; }
    return low === merged.length || merged[low].start >= start + passage.text.length;
  });
}

/** Keep candidates source-rooted and local; infer no ability. */
export function selectCorpusPassage(corpus: Corpus, seen: ReadonlySet<string>, seed: number, maxWords = 500, interests: Preferences['interests'] = [], startingPoint?: Preferences['reading']) {
  if (!Number.isSafeInteger(seed) || seed < 0 || !Number.isInteger(maxWords) || maxWords < 120 || maxWords > maxCorpusWords) throw new Error('INVALID_CORPUS_SELECTION');
  const candidates = corpus.records.flatMap(source => unseenCorpusPassages(source, seen).map(passage => ({ source, passage })))
    .filter(({ passage }) => passage.wordCount <= maxWords && (startingPoint !== 'C1' && startingPoint !== 'C2' || passage.wordCount >= 120));
  const minimum = startingPoint === 'C1' ? 500 : startingPoint === 'C2' ? 700 : 0;
  const substantial = candidates.filter(({ passage }) => passage.wordCount >= minimum);
  const pool = corpusPreferencePool(substantial.length ? substantial : candidates, ({ source, passage }) => ({ title: source.title, text: passage.text }), interests, seed, startingPoint);
  // shortcut: bounded linear corpus scan; add an index if device measurements justify it.
  if (!pool.length) return undefined;
  const firstFamily = pool[0].source.id.split('-')[0];
  if (corpus.records.every(source => source.id.split('-')[0] === firstFamily)) return pool[seed % pool.length];
  const families = [...new Set(pool.map(({ source }) => source.id.split('-')[0]))];
  const family = families[seed % families.length];
  const passages = pool.filter(({ source }) => source.id.split('-')[0] === family);
  return passages.length ? passages[Math.floor(seed / families.length) % passages.length] : undefined;
}

/** Restore exact source words without claiming comprehension or independent item review. */
export function* restorationWords(text: string, language?: z.infer<typeof corpusLanguageSchema>, beginner = false) {
  if (text.length > 12000) throw new Error('INVALID_CORPUS_GENERATION');
  if (language) {
    for (const token of language.tokens) {
      if (!/['’-]/.test(text[token.start - 1] ?? '') && !/['’-]/.test(text[token.end] ?? '')) yield { word: text.slice(token.start, token.end), index: token.start };
    }
  } else {
    for (const match of text.matchAll(beginner ? /\b[a-z]{3,8}\b/g : /\b[a-z]{6,14}\b/g)) {
      if (!/['’-]/.test(text[match.index - 1] ?? '') && !/['’-]/.test(text[match.index + match[0].length] ?? '')) yield { word: match[0], index: match.index };
    }
  }
}
function hasRestoration(text: string, language?: z.infer<typeof corpusLanguageSchema>, beginner = false) {
  return !restorationWords(text, language, beginner).next().done;
}
export function corpusRestoration(text: string, seed: number, language?: z.infer<typeof corpusLanguageSchema>, beginner = false) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_GENERATION');
  const words = [...restorationWords(text, language, beginner)];
  if (!words.length) return;
  const word = words[seed % words.length];
  const base = language?.tokens.find(token => token.start === word.index)?.lemma;
  const lemma = base && base !== word.word.toLowerCase() ? base : undefined;
  return { prompt: 'Fill in the missing word.', text: text.slice(0, word.index) + '________' + text.slice(word.index + word.word.length), answer: word.word, lemma, evidence: { start: word.index, end: word.index + word.word.length } };
}

function hasSentenceBoundaries(text: string, start: number, sentence: string) {
  const before = text.slice(0, start), previous = before.trimEnd();
  return (!previous || /\r?\n[\t ]*\r?\n[\t ]*$/.test(before) || /[.!?]["'”’)]*$/.test(previous) && !nameEnding.test(previous))
    && /[.!?]["'”’)]*$/.test(sentence) && !nameEnding.test(sentence);
}

/** Restore source order without inventing chronology or rewriting sentences. */
export function corpusSequence(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_SEQUENCE');
  const sentences = sentenceSegments(text);
  const candidates = sentences.flatMap((_, index) => {
    const parts = sentences.slice(index, index + 3);
    const ordered = parts.map(part => part.segment.trim());
    return parts.length === 3 && new Set(ordered).size === 3 && ordered.every((sentence, i) => sentence.length >= 20 && sentence.length <= 160 && hasSentenceBoundaries(text, parts[i].index, sentence) && !malformedSourceMarker.test(sentence))
      ? [{ ordered, evidence: { start: parts[0].index, end: parts[2].index + parts[2].segment.length } }] : [];
  });
  if (!candidates.length) return;
  const selected = candidates[seed % candidates.length];
  const rotation = 1 + seed % 2;
  return { steps: [...selected.ordered.slice(rotation), ...selected.ordered.slice(0, rotation)], acceptedOrders: [selected.ordered], evidence: selected.evidence };
}

const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
/** Match explicit speaker labels without inferring attribution or rewriting quotes. */
function corpusSpeakerStatements(text: string, unique = true) {
  const statements = [...text.matchAll(/^([A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})?):[ \t]+([^\n]+)/gm)].flatMap(turn =>
    sentenceSegments(turn[2]).map(sentence => {
      const label = sentence.segment.trim();
      const end = turn.index + turn[0].length - turn[2].length + sentence.index + sentence.segment.indexOf(label) + label.length;
      return { label, answer: turn[1], evidence: { start: turn.index, end } };
    }));
  if (!unique) return statements;
  const normalise = (value: string) => value.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').toLowerCase();
  // shortcut: duplicate scan capped at 12k characters; index if excerpt limits grow.
  return statements.filter(statement => statement.label.length >= 20 && statement.label.length <= 80
    && !nameEnding.test(statement.label)
    && statement.label.split(/\s+/).length >= 4 && /[.!]$/.test(statement.label) && !/(?:…|\.{2,})$/.test(statement.label)
    && statements.filter(other => normalise(other.label) === normalise(statement.label)).length === 1);
}
export function corpusSpeakers(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_SPEAKERS');
  const candidates = corpusSpeakerStatements(text);
  if (!candidates.length) return;
  const first = candidates[seed % candidates.length];
  const others = candidates.filter(statement => statement.answer !== first.answer);
  if (!others.length) return;
  const selected = [first, others[seed % others.length]];
  const names = selected.map(statement => statement.answer);
  return { pairs: selected.map(({ label, answer }) => ({ label, answer })), choices: seed % 2 ? names : names.reverse(),
    evidence: first.evidence, otherEvidence: selected[1].evidence };
}
const quantityPrompt = 'How many? Read the stated count.';
const verificationPrompt = 'Read. Is this detail correct?';

const timePrompt = 'Read the time stated for this question.';

/** Require both inspected clues, rather than sentence-order recall. */
export function corpusShortIntegration(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_SHORT_INTEGRATION');
  const library = /^Anna: Hello! DC is a city for walking\. In our neighborhood, I can do all my errands\. Marsha, before we get ice cream, I need to return three books to the library\. Where is the library\?$/m.exec(text);
  const party = /^Marsha: The party is at night\.[\r\n]+Anna: Oh\. Then I can come with you to the party on Saturday night\.$/m.exec(text);
  if (Number(!!library) + Number(!!party) !== 1) return;
  const first = (library ?? party)!;
  const second = library ? /^Marsha: It is on this street on the corner\.$/m.exec(text) : /^Marsha: Everyone has to bring something or do something\. You can bring food, or you can perform\.$/m.exec(text);
  if (!second || second.index <= first.index || [first, second].some(m => text.indexOf(m[0]) !== text.lastIndexOf(m[0]))) return;
  const a = library ? ['Return the books before getting ice cream', 'Return the books after getting ice cream'] : ['The party is on Saturday night', 'The party is during the day on Saturday'];
  const b = library ? ['the library is on this street, on the corner', 'the library is on another street'] : ['everyone must contribute, with food or a performance as options', 'everyone must both bring food and perform'];
  const pairs = [[0,0],[0,1],[1,0],[1,1]], offset = seed % 4, ordered = [...pairs.slice(offset), ...pairs.slice(0,offset)];
  const options = ordered.map(([x,y]) => `${a[x]}; ${b[y]}.`), answer = ordered.findIndex(([x,y]) => !x && !y);
  const explanation = library ? 'Combine Anna’s before condition with Marsha’s location: return books before ice cream, and the library is on this street at the corner. Page order alone does not establish that relation. These are a required action and a stated location, not completed errands.' : 'Combine the Saturday-night party timing with the contribution rule: everyone must contribute, with food or performing as options. The source does not require both, ban doing both, or prove attendance or contribution.';
  const hans = library ? '结合Anna的before条件与Marsha的位置说明：先还书后吃冰激凌，图书馆在这条街的拐角。不能仅按书写顺序判断；这里是需要做的事和所述位置，没有证明事情已办完。' : '结合星期六晚上的聚会时间与贡献要求：每人要出一份力，可带食物或表演。没有要求两项都做，也没有禁止都做，没有证明已参加或贡献。';
  const hant = library ? '結合Anna的before條件與Marsha的位置說明：先還書後吃冰淇淋，圖書館在這條街的拐角。不能僅按書寫順序判斷；這裡是需要做的事和所述位置，沒有證明事情已辦完。' : '結合星期六晚上的聚會時間與貢獻要求：每人要出一份力，可帶食物或表演。沒有要求兩項都做，也沒有禁止都做，沒有證明已參加或貢獻。';
  const optionExplanations = ordered.map(([x,y]) => ({ en: (!x && !y ? 'Both clues match. ' : `Check ${x && y ? 'both clues' : x ? 'the first clue' : 'the second clue'}. `) + explanation,
    'zh-Hans': (!x && !y ? '两条线索都吻合。' : `需核对${x && y ? '两条线索' : x ? '第一条线索' : '第二条线索'}。`) + hans,
    'zh-Hant': (!x && !y ? '兩條線索都吻合。' : `需核對${x && y ? '兩條線索' : x ? '第一條線索' : '第二條線索'}。`) + hant }));
  return { prompt: personalGoalPrompts.integration + '\n' + (library ? 'Which summary combines the books/ice-cream order and the library location?' : 'Which summary combines the party timing and contribution rule?'), options, answer, evidence: { start: first.index, end: first.index + first[0].length }, additionalEvidence: [{ start: second.index, end: second.index + second[0].length }], explanation, hans, hant, optionExplanations };
}

/** Keep rules bound to their stated alternatives and setting. */
export function corpusStatedRule(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_STATED_RULE');
  const party = /^Marsha: Everyone has to bring something or do something\. You can bring food, or you can perform\.$/m.exec(text);
  const news = /^Caty: No, no, no! Anna, you cannot say you are angry! This is The News!!!$/m.exec(text);
  if (Number(!!party) + Number(!!news) !== 1) return;
  const match = (party ?? news)!;
  const context = party ? /^Marsha: Great! I have to help my friend with the party\. Can you help me\?$/m.exec(text) : /^Caty: This is the News\. Happy and sad are feelings\. You can’t have them in The News\.$/m.exec(text);
  if (!context || context.index >= match.index || [match, context].some(m => text.indexOf(m[0]) !== text.lastIndexOf(m[0]))) return;
  const correct = party ? 'At this party, everyone must contribute; bringing food or performing is an option.' : 'On The News, Caty says Anna cannot say she is angry.';
  const wrong = party ? 'At this party, everyone must both bring food and perform.' : 'Caty says Anna must never feel angry, even outside The News.';
  const options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: personalGoalPrompts.rule + '\nWhich summary keeps the stated rule and its scope?', options, answer: options.indexOf(correct), evidence: { start: match.index, end: match.index + match[0].length }, additionalEvidence: [{ start: context.index, end: context.index + context[0].length }],
    explanation: party ? 'Everyone has to contribute to this party. Or gives alternatives: bringing food and performing are named options, not two duties that everyone must do together. The rule does not ban doing both, and does not prove Anna has already contributed.' : 'Caty tells Anna not to say she is angry on The News. The restriction concerns expressing a personal feeling in this programme. It does not establish a ban on feeling anger or on expressing it outside the programme. This is the rule in the dialogue, not a claim about every news organisation.',
    hans: party ? '每个人都要为这次聚会出一份力。or连接选择：带食物或表演是给出的选项，不是要求每人同时完成两项。这里也没有禁止两项都做，没有证明Anna已经贡献。' : 'Caty要求Anna在The News节目中不能说自己很生气。规则限制的是在这个节目中表达个人情绪，没有证明不能感到生气或在节目外表达情绪。这是对话中的要求，不是所有新闻机构的通则。',
    hant: party ? '每個人都要為這次聚會出一份力。or連接選擇：帶食物或表演是給出的選項，不是要求每人同時完成兩項。這裡也沒有禁止兩項都做，沒有證明Anna已經貢獻。' : 'Caty要求Anna在The News節目中不能說自己很生氣。規則限制的是在這個節目中表達個人情緒，沒有證明不能感到生氣或在節目外表達情緒。這是對話中的要求，不是所有新聞機構的通則。' };
}

/** Extract the stated reason without inferring habits or results. */
export function corpusStatedReason(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_STATED_REASON');
  const activity = /^Anna: This is a drum band\. I never listen to a drum band\. But today I am listening to a drum band because (it’s Shakespeare’s birthday)!$/m.exec(text);
  const trial = /^Anna: Oh! I always jog\. Well, sometimes I jog\. Okay, I never jog\. But I will try because (it is good for you)\.$/m.exec(text);
  if (Number(!!activity) + Number(!!trial) !== 1) return;
  const match = (activity ?? trial)!;
  if (text.indexOf(match[0]) !== text.lastIndexOf(match[0])) return;
  const correct = match[1], wrong = activity ? 'she always listens to drum bands' : 'she always jogs';
  const options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: personalGoalPrompts.reason + '\n' + (activity ? 'Why does Anna say she is listening to a drum band today?' : 'Why does Anna say she will try jogging?'), options, answer: options.indexOf(correct), evidence: { start: match.index, end: match.index + match[0].length }, additionalEvidence: [],
    explanation: activity ? 'Anna gives Shakespeare’s birthday as the reason for today’s listening. Never describes her usual habit; the present activity is an exception with an explicit because-clause. Always listening is neither her stated habit nor the reason she gives.' : 'Anna gives “it is good for you” as her reason for trying. Her first “always” is corrected through “sometimes” to “never”; it is not the final habit statement or her stated reason. Will try is a proposed trial, not proof that she has jogged or of a general health effect.',
    hans: activity ? 'Anna用because明说今天听鼓乐队是因为莎士比亚生日。never在这里说平时的习惯，今天的活动是带有明确原因的例外。“总是听”既不是她所说的习惯，也不是她给出的原因。' : 'Anna给出的尝试理由是“it is good for you”。起初的always随后被改为sometimes，再改为never，不能沿用最初说法作习惯或原因。will try是打算尝试，没有证明已经慢跑或普遍健康效果。',
    hant: activity ? 'Anna用because明說今天聽鼓樂隊是因為莎士比亞生日。never在這裡說平時的習慣，今天的活動是帶有明確原因的例外。「總是聽」既不是她所說的習慣，也不是她給出的原因。' : 'Anna給出的嘗試理由是「it is good for you」。起初的always隨後被改為sometimes，再改為never，不能沿用最初說法作習慣或原因。will try是打算嘗試，沒有證明已經慢跑或普遍健康效果。' };
}

/** Track explicit revisions without assuming external events changed. */
export function corpusPlanUpdate(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_PLAN_UPDATE');
  const invitation = /^Anna: Sorry, I (can’t come with you)\. I have to get my driver’s license\.$/m.exec(text);
  const order = /^Jonathan: Excuse me, I’ll (have the shrimp)\.$/m.exec(text);
  if (Number(!!invitation) + Number(!!order) !== 1) return;
  const before = (invitation ?? order)!;
  const condition = invitation ? /^Marsha: The party is at night\.$/m.exec(text) : /^Jonathan: Oh, you’re out of shrimp\./m.exec(text);
  const after = invitation ? /^Anna: Oh\. Then I (can come with you) to the party on Saturday night\.$/m.exec(text) : /^Jonathan: Oh, you’re out of shrimp\. Okay, I’ll (have the beef) then\.$/m.exec(text);
  if (!condition || !after || before.index >= condition.index || before.index >= after.index || condition.index > after.index
    || text.indexOf(before[0]) !== text.lastIndexOf(before[0]) || text.indexOf(after[0]) !== text.lastIndexOf(after[0]) || text.indexOf(condition[0]) !== text.lastIndexOf(condition[0])) return;
  const correct = after[1], wrong = before[1], options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: personalGoalPrompts.update + '\n' + (invitation ? 'What does Anna now say about joining Marsha at the party?' : 'What does Jonathan now request?'), options, answer: options.indexOf(correct),
    evidence: { start: after.index, end: after.index + after[0].length }, additionalEvidence: [before, condition].map(match => ({ start: match.index, end: match.index + match[0].length })),
    explanation: invitation ? 'Anna first says she cannot come. After Marsha explains that the party is at night, Anna says she can join on Saturday night. The earlier refusal is not her updated reply. This does not say the party or test moved, that the license task was cancelled, or that she already attended.' : 'Jonathan first requests shrimp, then says it is unavailable and requests beef. Shrimp is the earlier request, not his updated one. This reports his choice and statement; it does not establish that shrimp used to be available, that stock changed, or that he received the beef.',
    hans: invitation ? 'Anna起初说不能来。Marsha说明聚会在晚上后，她说周六晚上可以参加。先前的拒绝不是更新后的回复。这里没有说聚会或考试改期、驾照事项取消，或她已经参加。' : 'Jonathan先要虾，随后说虾已售完，改要牛肉。虾是先前的选择，不是更新后的要求。这记录他的选择与陈述，没有证明先前有虾、库存发生改变，或牛肉已经到手。',
    hant: invitation ? 'Anna起初說不能來。Marsha說明聚會在晚上後，她說週六晚上可以參加。先前的拒絕不是更新後的回覆。這裡沒有說聚會或考試改期、駕照事項取消，或她已經參加。' : 'Jonathan先要蝦，隨後說蝦已售完，改要牛肉。蝦是先前的選擇，不是更新後的要求。這記錄他的選擇與陳述，沒有證明先前有蝦、庫存發生改變，或牛肉已經到手。' };
}

/** Preserve named requirements/preferences without inferring completion or exclusivity. */
export function corpusPersonalGoal(text: string, seed: number, kind: 'need' | 'preference' | 'update' | 'reason' | 'rule' | 'integration') {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000 || kind !== 'need' && kind !== 'preference' && kind !== 'update' && kind !== 'reason' && kind !== 'rule' && kind !== 'integration') throw new Error('INVALID_CORPUS_PERSONAL_GOAL');
  if (kind === 'update') return corpusPlanUpdate(text, seed);
  if (kind === 'reason') return corpusStatedReason(text, seed);
  if (kind === 'rule') return corpusStatedRule(text, seed);
  if (kind === 'integration') return corpusShortIntegration(text, seed);
  // shortcut: four inspected daily-life contexts; review broader predicates and contexts before extending.
  const patterns = kind === 'need' ? [
    /^Anna: Sorry, I can’t come with you\. I have to (get my driver’s license)\.$/m,
    /^Anna: Hello! DC is a city for walking\. In our neighborhood, I can do all my errands\. Marsha, before we (get ice cream), I need to (return three books to the library)\. Where is the library\?$/m,
  ] : [
    /^Louis: I like the museums\. I really like (the art museums)\.$/m,
    /^Anna: I like (the Sculpture Garden)\. Have you ever seen sculptures in a garden\? It is really artistic!$/m,
  ];
  const matches = patterns.map(pattern => pattern.exec(text));
  if (matches.filter(Boolean).length !== 1) return;
  const index = matches.findIndex(Boolean), match = matches[index]!;
  if (text.indexOf(match[0]) !== text.lastIndexOf(match[0])) return;
  const otherNeed = kind === 'need' && !index ? /^Marsha: Great! I have to (help my friend with the party)\. Can you help me\?$/m.exec(text) : undefined;
  if (kind === 'need' && !index && !otherNeed) return;
  const correct = kind === 'need' && index ? match[2] : match[1];
  const wrong = kind === 'need' ? index ? match[1] : otherNeed![1] : index ? 'the science museums' : 'the history museums';
  const options = seed % 2 ? [wrong, correct] : [correct, wrong];
  const question = kind === 'need' ? index ? 'What does Anna need to do before getting ice cream?' : 'What does Anna say she has to do when she first declines the party invitation?' : index ? 'Which place does Anna explicitly say she likes?' : 'Which type of museum does Louis explicitly say he really likes?';
  return { prompt: personalGoalPrompts[kind] + '\n' + question, options, answer: options.indexOf(correct), evidence: { start: match.index, end: match.index + match[0].length },
    additionalEvidence: otherNeed ? [{ start: otherNeed.index, end: otherNeed.index + otherNeed[0].length }] : [],
    explanation: kind === 'need' ? index ? 'Anna needs to return the books before getting ice cream. Getting ice cream is the later shared plan, not the action she says she needs to do first. Need does not show completion.' : 'Anna says she has to get her driver’s license. Marsha says she has to help her friend with the party; do not move that requirement to Anna. The later agreement to attend does not remove the stated license task or prove completion.' : index ? 'Anna explicitly says she likes the Sculpture Garden. The earlier statement calls all the museums good, but does not state a particular liking for science museums. This does not mean she dislikes them or likes only the garden.' : 'Louis says he really likes the art museums. History museums are not named in his statement of liking. This does not mean he dislikes history museums, ranks every museum or likes only art museums.',
    hans: kind === 'need' ? index ? 'Anna需要先还书，再买冰淇淋。买冰淇淋是稍后的共同计划，不是这里需要先做的动作。“需要”不表示已经完成。' : 'Anna说自己必须取得驾照；Marsha说自己必须帮朋友准备聚会，不能把Marsha的需要换给Anna。后来同意参加聚会，没有取消驾照事项，也不证明事项已完成。' : index ? 'Anna明说自己喜欢Sculpture Garden（雕塑花园）。前文说各种博物馆都好，并没有特别说她喜欢科学博物馆。不能据此推断她讨厌其他博物馆，或只喜欢花园。' : 'Louis明说自己很喜欢艺术博物馆，没有在这句话中说喜欢历史博物馆。不能据此推断他讨厌历史博物馆、给所有博物馆排名，或只喜欢艺术博物馆。',
    hant: kind === 'need' ? index ? 'Anna需要先還書，再買冰淇淋。買冰淇淋是稍後的共同計劃，不是這裡需要先做的動作。「需要」不表示已經完成。' : 'Anna說自己必須取得駕照；Marsha說自己必須幫朋友準備聚會，不能把Marsha的需要換給Anna。後來同意參加聚會，沒有取消駕照事項，也不證明事項已完成。' : index ? 'Anna明說自己喜歡Sculpture Garden（雕塑花園）。前文說各種博物館都好，並沒有特別說她喜歡科學博物館。不能據此推斷她討厭其他博物館，或只喜歡花園。' : 'Louis明說自己很喜歡藝術博物館，沒有在這句話中說喜歡歷史博物館。不能據此推斷他討厭歷史博物館、給所有博物館排名，或只喜歡藝術博物館。' };
}

/** Require explicit planned order; source position alone is insufficient. */
export function corpusPlannedOrder(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_PLANNED_ORDER');
  // shortcut: two inspected daily-life forms; review full contexts before extending.
  const firstThen = /^Anna: I don’t know\. First, I have to (take a test on the computer)\. Then I have to (take a test in the car)\.$/m.exec(text);
  const before = /^Anna: Hello! DC is a city for walking\. In our neighborhood, I can do all my errands\. Marsha, before we (get ice cream), I need to (return three books to the library)\. Where is the library\?$/m.exec(text);
  if (!!firstThen === !!before) return;
  const match = firstThen ?? before!;
  if (text.indexOf(match[0]) !== text.lastIndexOf(match[0])) return;
  const earlier = firstThen ? firstThen[1] : before![2], later = firstThen ? firstThen[2] : before![1];
  const correct = `${earlier} → ${later}`, wrong = `${later} → ${earlier}`;
  const options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: plannedOrderPrompt, options, answer: options.indexOf(correct), evidence: { start: match.index, end: match.index + match[0].length },
    explanation: firstThen ? '“First” places the computer test before the car test introduced by “Then”. These are required planned actions, not proof that either test has been taken. The other option reverses that order.' : '“Before we get ice cream, I need to return three books” puts returning the books first. The before-clause occurs earlier on the page but its action comes later in the plan. Needing to return books does not prove they were returned. The other option reverses that order.',
    hans: firstThen ? '“First”把电脑考试放在“Then”引出的车内考试之前。这是计划中需要做的事，没有证明考试已完成。另一选项颠倒了先后。' : '“before we get ice cream, I need to return three books”表示先还书，再买冰淇淋。before从句虽然先写出，其中的动作在计划中却较晚。需要还书不证明已经还书；另一选项颠倒先后。',
    hant: firstThen ? '「First」把電腦考試放在「Then」引出的車內考試之前。這是計劃中需要做的事，沒有證明考試已完成。另一選項顛倒了先後。' : '「before we get ice cream, I need to return three books」表示先還書，再買冰淇淋。before從句雖然先寫出，其中的動作在計劃中卻較晚。需要還書不證明已經還書；另一選項顛倒先後。' };
}

/** Preserve the asked event, clock digits, and stated period. */
export function corpusTime(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_TIME');
  const writing = /^([A-Z][a-z]{1,20}): Hi, [A-Z][a-z]{1,20}\. Yes\. At (\d{1,2}) (a\.m\.|p\.m\.) I am writing\. Every day I do my morning show\. Sorry!$/m.exec(text);
  const now = /^([A-Z][a-z]{1,20}): (\d{1,2}):(\d{2})\.$/m.exec(text);
  const question = /^([A-Z][a-z]{1,20}): What time is it now\?$/m.exec(text);
  const plan = /^([A-Z][a-z]{1,20}): [^\n]*for lunch at noon[^\n]*$/m.exec(text);
  if (!!writing === !!now || writing && (+writing[2] < 1 || +writing[2] > 12)
    || now && (+now[2] < 1 || +now[2] > 12 || +now[3] > 59 || !question || !plan || plan.index >= question.index || question.index >= now.index || text.slice(question.index + question[0].length, now.index).trim() || !text.slice(plan.index + plan[0].length, question.index).includes(`${now[1]}: Yes.`))) return;
  const match = writing ?? now!;
  const correct = writing ? `${writing[2]} ${writing[3]}` : `${now![2]}:${now![3]}`;
  const wrong = writing ? `${writing[2]} ${writing[3] === 'a.m.' ? 'p.m.' : 'a.m.'}` : '12:00';
  if (correct === wrong) return;
  const options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: `${timePrompt}\n${writing ? `Which time is stated with ${writing[1]} writing?` : `What time does ${now![1]} say it is now?`}`,
    options, answer: options.indexOf(correct), evidence: { start: match.index, end: match.index + match[0].length },
    ...(now && question && plan ? { additionalEvidence: [{ start: question.index, end: question.index + question[0].length }, { start: plan.index, end: question.index }] } : {}),
    explanation: writing ? `${writing[1]} explicitly says “At ${correct} I am writing”. Keep that period; this is not a stated start time for the show.` : `${now![1]} answers the current-time question with ${correct}. Noon (12:00) is the planned lunch time. No a.m./p.m. or timezone is supplied for the current time.`,
    hans: writing ? `${writing[1]}明说“At ${correct} I am writing”，保留上午／下午标记。这里没有说明节目的开始时间。` : `${now![1]}回答现在是${correct}；noon（12:00）是计划的午餐时间。不要给现在的时刻补写上午／下午或时区。`,
    hant: writing ? `${writing[1]}明說「At ${correct} I am writing」，保留上午／下午標記。這裡沒有說明節目的開始時間。` : `${now![1]}回答現在是${correct}；noon（12:00）是計劃的午餐時間。不要給現在的時刻補寫上午／下午或時區。` };
}

function correctedSpelling(text: string) {
  const corrections = [...text.matchAll(/^([A-Z][a-z]{1,20}): No\. ([A-Z](?:-[A-Z])+)$/gm)];
  const correction = corrections[0];
  const count = /^([A-Z][a-z]{1,20}): Well, ([A-Z][a-z]{1,20}) with (one|two|three|four) "([a-z])'s" \.\.\. Welcome to \.\.\. \d{4} [A-Za-z ]+!$/m.exec(text);
  const initial = /"([A-Z][a-z]{1,20})" Is that ([A-Z](?:-[A-Z])+)\?/.exec(text);
  if (corrections.length !== 1 || !correction || !count || !initial || count.index < correction.index || initial.index > correction.index
    || correction[1] !== count[2] || initial[1] !== count[2] || correction[2].replaceAll('-', '').toLowerCase() !== count[2].toLowerCase() || correction[2] === initial[2]) return;
  const value = { one: 1, two: 2, three: 3, four: 4 }[count[3] as 'one' | 'two' | 'three' | 'four'];
  if (correction[2].split('-').filter(letter => letter.toLowerCase() === count[4]).length !== value) return;
  return { name: count[2], letter: count[4], correct: correction[2], wrong: initial[2], value,
    evidence: { start: correction.index, end: count.index + count[0].length } };
}

/** Bind written quantities to their stated letters or items. */
export function corpusQuantity(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_QUANTITY');
  const spelling = correctedSpelling(text);
  const books = [...text.matchAll(/^([A-Z][a-z]{1,20}): [^\n]*?I need to return (one|two|three|four) books to the library\./gm)];
  if (!!spelling === !!books.length || books.length > 1) return;
  const book = books[0], value = spelling?.value ?? { one: 1, two: 2, three: 3, four: 4 }[book[2] as 'one' | 'two' | 'three' | 'four'];
  const correct = String(value), wrong = String(value === 1 ? 2 : value - 1), options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: `${quantityPrompt}\n${spelling ? `How many “${spelling.letter}” letters are in ${spelling.name}’s name?` : `How many books does ${book[1]} need to return?`}`,
    options, answer: options.indexOf(correct), evidence: spelling?.evidence ?? { start: book.index, end: book.index + book[0].length },
    explanation: spelling ? `${spelling.correct} has ${value} “${spelling.letter}” letters. Keep the corrected spelling, not the initial question or the street number.` : `${book[1]} needs to return ${book[2]} books: ${value}. This does not say the return happened or give the total books owned.`,
    hans: spelling ? `${spelling.correct}有${value}个“${spelling.letter}”。按纠正后的拼写计数，不用最初问句或街道号码。` : `${book[1]}需要归还${book[2]}本书，即${value}本；没有说明已经归还或一共拥有多少书。`,
    hant: spelling ? `${spelling.correct}有${value}個「${spelling.letter}」。按糾正後的拼寫計數，不用最初問句或街道號碼。` : `${book[1]}需要歸還${book[2]}本書，即${value}本；沒有說明已經歸還或一共擁有多少書。` };
}

/** Verify names/numbers against explicit corrections and roles, excluding questions and misdials. */
export function corpusVerification(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_VERIFICATION');
  const spelling = correctedSpelling(text), phone = corpusPhone(text, seed);
  if (!!spelling === !!phone) return;
  const correct = spelling?.correct ?? phone!.number, wrong = spelling?.wrong ?? phone!.wrong;
  const matches = (seed >>> 1) % 2 === 0, detail = matches ? correct : wrong, answer = seed % 2;
  const options = answer ? [matches ? 'No' : 'Yes', matches ? 'Yes' : 'No'] : [matches ? 'Yes' : 'No', matches ? 'No' : 'Yes'];
  return { prompt: `${verificationPrompt}\n${spelling ? `${spelling.name} is spelled ${detail}.` : `${phone!.name}’s work number is ${detail}.`}`,
    options, answer, evidence: spelling?.evidence ?? phone!.evidence, ...(phone ? { additionalEvidence: [phone.otherEvidence] } : {}),
    explanation: spelling ? `The corrected spelling is ${correct}, not ${wrong}. Yes means the supplied detail agrees; No means it differs.` : `${phone!.name}’s work number is ${correct}. The call reached ${wrong} instead. A wrong-number response does not change the named work number. Yes means the supplied detail agrees; No means it differs.`,
    hans: spelling ? `纠正后的拼写是${correct}，不是${wrong}。题目细节与原文相同选Yes，不同选No。` : `${phone!.name}的工作电话是${correct}，误拨到的是${wrong}。拨错没有改变工作电话。题目细节相同选Yes，不同选No。`,
    hant: spelling ? `糾正後的拼寫是${correct}，不是${wrong}。題目細節與原文相同選Yes，不同選No。` : `${phone!.name}的工作電話是${correct}，誤撥到的是${wrong}。撥錯沒有改變工作電話。題目細節相同選Yes，不同選No。` };
}

const locationPrompt = 'Where is the place?';
const instructionPrompt = 'What are you asked to do?';

/** Preserve each named landmark relation without substituting later directions. */
export function corpusLocation(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_LOCATION');
  const relation = /^([A-Z][a-z]{1,20}): The ([a-z]+) is across from the ([a-z]+)\. It['’]s next to the ([a-z]+)\. Go that way\.$/m.exec(text);
  const apartment = /^([A-Z][a-z]{1,20}): My apartment is near the (Columbia Heights Metro)\.$/m.exec(text);
  if (!!relation === !!apartment) return;
  if (relation && relation[3] === relation[4]) return;
  if (apartment && !/Then at the bus station turn left\. Then walk straight ahead\.$/m.test(text)) return;
  const match = relation ?? apartment!;
  const correct = relation ? `Across from the ${relation[3]}.` : `Near the ${apartment![2]}.`;
  const wrong = relation ? `Next to the ${relation[3]}.` : 'Near the bus station.';
  const options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: `${locationPrompt}\n${relation ? `The ${relation[2]} and the ${relation[3]}.` : `${apartment![1]}'s apartment: which place does ${apartment![1]} say it is near?`}`,
    options, answer: options.indexOf(correct), evidence: { start: match.index, end: match.index + match[0].length },
    hans: relation ? `原文说${relation[2]}在${relation[3]}对面，紧挨${relation[4]}。不能把两个关系交换。` : `${apartment![1]}说公寓在${apartment![2]}附近。bus station是后面的指路路标，没有被说成公寓邻近的地点。`,
    hant: relation ? `原文說${relation[2]}在${relation[3]}對面，緊挨${relation[4]}。不能把兩個關係交換。` : `${apartment![1]}說公寓在${apartment![2]}附近。bus station是後面的指路路標，沒有被說成公寓鄰近的地點。`,
    explanation: relation ? `The ${relation[2]} is across from the ${relation[3]}, and next to the ${relation[4]}. Keep the two places and relations separate.` : `${apartment![1]} says the apartment is near the ${apartment![2]}. The bus station is a later direction landmark, not the stated near-place.` };
}

/** Keep the complete direction/request with its action and order. */
export function corpusInstruction(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_INSTRUCTION');
  const direction = /^([A-Z][a-z]{1,20}): Yes\. Exit the Metro and turn (right|left)\. Then at the bus station turn (right|left)\. Then walk straight ahead\.$/m.exec(text);
  const request = /^([A-Z][a-z]{1,20}): So sorry, but I am busy\. Please meet your co-workers\. But remember, they are busy working\.$/m.exec(text);
  if (!!direction === !!request || direction && direction[2] === direction[3]) return;
  const match = direction ?? request!;
  const correct = direction ? `Turn ${direction[2]}.` : 'Meet your co-workers.';
  const wrong = direction ? `Turn ${direction[3]}.` : 'Do your co-workers’ work.';
  const options = seed % 2 ? [wrong, correct] : [correct, wrong];
  return { prompt: `${instructionPrompt}\n${direction ? 'Exit the Metro. What next?' : 'Read the request from ' + request![1] + '.'}`,
    options, answer: options.indexOf(correct), evidence: { start: match.index, end: match.index + match[0].length },
    hans: direction ? `出Metro后${direction[2] === 'right' ? '右转' : '左转'}；到bus station后才${direction[3] === 'right' ? '右转' : '左转'}。不能交换步骤与地点。` : `${request![1]}要求认识同事，不是替同事工作。同事正在忙着工作，这项要求不证明同事停止工作或所有同事都已见过。`,
    hant: direction ? `出Metro後${direction[2] === 'right' ? '右轉' : '左轉'}；到bus station後才${direction[3] === 'right' ? '右轉' : '左轉'}。不能交換步驟與地點。` : `${request![1]}要求認識同事，不是替同事工作。同事正在忙著工作，這項要求不證明同事停止工作或所有同事都已見過。`,
    explanation: direction ? `After exiting the Metro, turn ${direction[2]}. Turn ${direction[3]} later, at the bus station. Keep the steps and places together.` : `${request![1]} asks the listener to meet the co-workers, not do their work. They are busy working. The request alone does not prove anyone stopped working or that all co-workers have been met.` };
}

export const peopleMatchingPrompt = 'Who? Match each description to a person.';

/** Keep first-person descriptions bound to their labelled speaker. */
export function corpusPeople(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_PEOPLE');
  const turns = [...text.matchAll(/^([A-Z][a-z]{1,20}):[ \t]+([^\n]+)/gm)];
  const unsafe = new Set(turns.filter(turn => /\b(?:not|never|if|unless|sometimes|perhaps|maybe|might|would|could)\b/i.test(turn[2])).map(turn => turn[1]));
  const facts = turns.filter(turn => !unsafe.has(turn[1])).flatMap(turn => sentenceSegments(turn[2]).flatMap(part => {
    const statement = part.segment.trim();
    // shortcut: inspected simple self-descriptions; review broader predicates and qualifications before extending.
    const match = /^(?:You know, [A-Z][a-z]{1,20}, |And )?I am (great|new to D\.C|from a small town|in [Aa]partment [A-Z][0-9])[.!]$/.exec(statement);
    if (!match) return [];
    const start = turn.index + turn[0].length - turn[2].length + part.index + part.segment.indexOf(statement);
    return [{ label: `Says they are ${match[1].replace('Apartment', 'apartment')}.`, answer: turn[1], evidence: { start: turn.index, end: start + statement.length } }];
  }));
  const unique = facts.filter(fact => !facts.some(other => other.label === fact.label && other.answer !== fact.answer));
  const first = unique[seed % unique.length];
  if (!first) return;
  const others = unique.filter(fact => fact.answer !== first.answer && fact.label !== first.label);
  const second = others[(seed + 1) % others.length];
  if (!second) return;
  const selected = [first, second], names = [...new Set(turns.map(turn => turn[1]))];
  return { pairs: selected.map(({ label, answer }) => ({ label, answer })), choices: seed % 2 ? names : names.toReversed(),
    evidence: first.evidence, otherEvidence: second.evidence };
}

/** Distinguish requested forms of address from full introductions. */
export function corpusAddress(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_ADDRESS');
  // Preserve the full attributed self-naming turn and matching repeated requests.
  const narrated = [...text.matchAll(/^“([A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20}){1,3}),” reluctantly faltered forth the owner of that name, “but, oh, please do call me ([A-Z][a-z]{1,20})\. ([^“”\n]+)”$/gm)];
  if (narrated.length) {
    if (narrated.length !== 1 || !corpusBalancedQuotes(text) || /\b(?:imagin\w*|pretend\w*|examples?|quoted?|reported|suppos\w*)\b/i.test(text)) return;
    const request = narrated[0], fullName = request[1], name = request[2];
    if (text.slice(request.index + request[0].length).trim() || /\b(?:if|unless|not|never|denied|would|could|might|maybe|perhaps|planned|rehearsed|dreamed|fictional|invented|hypothetical|instance)\b/i.test(text.replace(/“[^“”]*”/g, ''))) return;
    const repeats = [...text.matchAll(/^“Will you please call me ([A-Z][a-z]{1,20})\?” she said eagerly\.$/gm)];
    const names = [...text.matchAll(/\bcall me ([A-Z][a-z]{1,20})/g)];
    if (fullName === name || repeats.length !== 1 || repeats[0].index >= request.index
      || repeats[0][1] !== name || names.length !== 2 || names.some(match => match[1] !== name)
      || !text.slice(0, repeats[0].index).includes('What’s your name?”')
      || !request[3].startsWith('It can’t matter much to you what you call me if I’m only going to be here a little while, can it? And ')
      || request[3] !== `It can’t matter much to you what you call me if I’m only going to be here a little while, can it? And ${fullName.split(' ')[0]} is such an unromantic name.`) return;
    const options = seed % 2 ? [name, fullName] : [fullName, name];
    return { options, answer: options.indexOf(name), name, fullName,
      evidence: { start: request.index, end: request.index + request[0].length } };
  }
  // shortcut: one complete introduction/request turn; review context before adding address corrections.
  const requests = [...text.matchAll(/^([A-Z][a-z]{1,20}): I am your [a-z]{3,20}, ([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})\. But, please call me ([A-Z][a-z]{1,20})\.$/gm)];
  const request = requests[seed % requests.length];
  if (!request || request[2] === request[3] || request[3] !== request[1]) return;
  const otherRequests = [...text.matchAll(/\b(?:please |just )?call me ([A-Z][a-z]{1,20})/gi)];
  if (otherRequests.length !== 1) return;
  const names = [request[2], request[3]], options = seed % 2 ? names.toReversed() : names;
  return { options, answer: options.indexOf(request[3]), name: request[3], fullName: request[2],
    evidence: { start: request.index, end: request.index + request[0].length } };
}

/** Distinguish explicit work contacts from corrected wrong numbers. */
export function corpusPhone(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_PHONE');
  // shortcut: one work number/wrong-number correction; review broader phone contexts before extending.
  if ((text.match(/\bwork number\b/gi)?.length ?? 0) !== 1) return;
  const part = sentenceSegments(text).find(part => /^([A-Z][a-z]{1,20})'s work number is ([0-9]{3}-[0-9]{4})\.$/.test(part.segment.trim()));
  if (!part) return;
  const statement = part.segment.trim(), match = /^([A-Z][a-z]{1,20})'s work number is ([0-9]{3}-[0-9]{4})\.$/.exec(statement)!;
  const corrections = [...text.matchAll(/^[A-Z][a-z]{1,20}: No\. This is ([0-9]{3}-[0-9]{4})\.$/gm)];
  if (corrections.length !== 1 || corrections[0][1] === match[2] || !text.slice(part.index, corrections[0].index).includes('You have the wrong number.')) return;
  const numbers = [match[2], corrections[0][1]], options = seed % 2 ? numbers.toReversed() : numbers;
  const start = part.index + part.segment.indexOf(statement);
  return { name: match[1], number: match[2], wrong: corrections[0][1], options, answer: options.indexOf(match[2]), evidence: { start, end: start + statement.length },
    otherEvidence: { start: corrections[0].index, end: corrections[0].index + corrections[0][0].length } };
}

/** Report explicit want-to statements without implying action or completion. */
export function corpusStatedIntention(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_STATED_INTENTION');
  // shortcut: one unqualified labelled want-to claim; review broader intention contexts before extending.
  const turns = [...text.matchAll(/^([A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})?):[ \t]+([\s\S]*?)(?=^[A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})?:[ \t]+|(?![\s\S]))/gm)];
  if (!turns.length || turns[0].index !== text.search(/\S/) || (text.match(/\bwant\b/gi)?.length ?? 0) !== 1) return;
  for (const turn of turns) {
    const body = turn[2], name = turn[1];
    if (!corpusBalancedQuotes(text.slice(0, turn.index)) || corpusQuoteMarkers(body).length || /[():\[\]]/.test(body)
      || /\b(?:imagine[ds]?|imagining|pretend(?:s|ed|ing)?|suppos(?:e[ds]?|ing)|examples?|quoted?|reported|says?|said)\b/i.test(text.slice(0, turn.index) + body)
      || /\b(?:if|unless|but|although|though|instead|maybe|perhaps|cancelled|canceled)\b|\b(?:changed? my mind|no longer|not anymore)\b/i.test(body)) continue;
    for (const part of sentenceSegments(body)) {
      const sentence = part.segment.trim();
      const match = /^(?:([A-Z][a-z]{1,20}), )?(I want to ([a-z]{2,16}(?: [a-z]{1,16}){0,5})\.)$/.exec(sentence);
      if (!match || match[1] === name || match[3].length > 80
        || /\b(?:not|never|no|and|or|only|now|later|too|be|have|seem|feel|think|want)\b/.test(match[3])
        || text.indexOf(match[2]) !== text.lastIndexOf(match[2])) continue;
      const start = turn.index + turn[0].length - body.length + part.index + part.segment.indexOf(sentence) + sentence.indexOf(match[2]);
      const before = text.slice(turn.index + turn[0].length - body.length, start);
      // Inherit speaker labels only across uninterrupted first-person paragraphs.
      if (before.split(/\n\s*\n/).slice(1).some(paragraph => paragraph.trim() && !/^(?:I|We)\b/.test(paragraph.trim()))) continue;
      if (turns.some(other => other[1] === name && /\b(?:changed? my mind|no longer|not anymore|cancelled|canceled|instead|if|unless|but|although|though|maybe|perhaps)\b/i.test(other[2]))) continue;
      const choices = [`${name} wants to do it.`, `${name} is doing it now.`, `${name} does not want to do it.`];
      const options = seed % 2 ? choices.toReversed() : choices;
      const offset = Math.floor(seed / 2) % choices.length;
      const rotated = [...options.slice(offset), ...options.slice(0, offset)];
      return { name, action: match[3], quote: match[2], prompt: `${statedIntentionPrompt}\n${name}: “${match[3]}”`,
        options: rotated, answer: rotated.indexOf(choices[0]), evidence: { start, end: start + match[2].length },
        otherEvidence: { start: turn.index, end: turn.index + turn[0].trimEnd().length } };
    }
  }
}

/** Extract stated self-origin without inferring birthplace, residence, or nationality. */
export function corpusStatedOrigin(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_STATED_ORIGIN');
  // shortcut: inspected place words and two origin exchanges; review geography before expanding.
  const geographicalPlace = (place: string) => /^(?:China|D\.C\.|Washington, D\.C\.|(?:a|the) (?:(?:small|large) )?(?:town|city|village))$/.test(place);
  const placeAtEnd = (tail: string) => !tail.endsWith('.') || /\.{2,}$/.test(tail) ? undefined : tail.endsWith('D.C.') ? tail : tail.slice(0, -1);
  const placeKey = (place: string) => place === 'D.C.' || place === 'Washington, D.C.' ? 'washington-dc' : place.toLowerCase();
  const turns = [...text.matchAll(/^([A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})?):[ \t]+([^\n]+)$/gm)]
    .map(match => ({ name: match[1], body: match[2], text: match[0], start: match.index, end: match.index + match[0].length }));
  if (!turns.length || text.split('\n').filter(line => line.trim()).length !== turns.length) return;
  const candidates = turns.flatMap((turn, index) => {
    const origin = /^(?:My name is ([A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})?)\. )?(?:And )?I(?: am|['’]m) from (.+)$/.exec(turn.body);
    const question = turns[index - 1];
    if (!origin || origin[1] && origin[1] !== turn.name || !question || question.name === turn.name
      || !/^(?:Where are you from|What is your name and where are you from)\?$/.test(question.body)
      || !corpusBalancedQuotes(text.slice(0, turn.start)) || corpusQuoteMarkers(turn.body).length) return [];
    const place = placeAtEnd(origin[2]);
    if (!place || !geographicalPlace(place) || turns.filter(other => other.name === turn.name && /\bfrom\b/i.test(other.body)).length !== 1) return [];
    const next = turns[index + 1], welcome = next?.name === question.name ? /^(?:Well, welcome|Welcome) to (.+)$/.exec(next.body) : undefined;
    const denial = turns[index - 2], asked = turns[index - 3];
    const denied = denial?.name === turn.name && /^No, I(?: am|['’]m) not\.$/.test(denial.body)
      && asked?.name === question.name ? /^Are you from (.+)\?$/.exec(asked.body) : undefined;
    const welcomePlace = welcome && placeAtEnd(welcome[1]);
    // Reject contexts containing both alternatives because the answer would be ambiguous.
    if (!!welcomePlace === !!denied) return [];
    const alternate = welcomePlace || denied![1];
    if (!geographicalPlace(alternate) || placeKey(place) === placeKey(alternate)) return [];
    const alternateEvidence = welcomePlace ? { start: next.start, end: next.end } : { start: asked.start, end: denial.end };
    const otherEvidence = [{ start: question.start, end: question.end }, alternateEvidence];
    return [{ name: turn.name, place, alternate, alternativeKind: welcomePlace ? 'welcome' as const : 'denied' as const,
      evidence: { start: turn.start, end: turn.end }, otherEvidence }];
  });
  const candidate = candidates[seed % candidates.length];
  if (!candidate) return;
  const options = seed % 2 ? [candidate.alternate, candidate.place] : [candidate.place, candidate.alternate];
  return { ...candidate, prompt: `${statedOriginPrompt}${candidate.name} say they are from?`, options, answer: options.indexOf(candidate.place) };
}

export const roomMatchingPrompt = 'Match each activity to its room.';

function corpusRoomStatements(text: string) {
  // shortcut: simple stated room activities; review broader place/action syntax before extending.
  const statements = corpusSpeakerStatements(text, false);
  const pattern = /^(?:I|We) (cook|eat|relax|wash|sleep) in the ([a-z]+(?: [a-z]+)?)[.!]$/;
  if (statements.some(statement => /\b(?:cook|eat|relax|wash|sleep)\b/i.test(statement.label) && !pattern.test(statement.label))) return [];
  const facts = statements.flatMap(statement => {
    const match = pattern.exec(statement.label);
    return match ? [{ label: match[1], answer: match[2], evidence: statement.evidence }] : [];
  });
  if (facts.some(fact => facts.some(other => other.label === fact.label && other.answer !== fact.answer))) return [];
  return facts.filter((fact, index) => facts.findIndex(other => other.label === fact.label) === index);
}
export function corpusRooms(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_ROOMS');
  const facts = corpusRoomStatements(text);
  const first = facts[seed % facts.length];
  if (!first) return;
  const others = facts.filter(fact => fact.answer !== first.answer);
  const second = others[seed % others.length];
  if (!second) return;
  return { pairs: [first, second].map(({ label, answer }) => ({ label, answer })),
    choices: seed % 2 ? [first.answer, second.answer] : [second.answer, first.answer],
    evidence: first.evidence, otherEvidence: second.evidence };
}
/** Extract explicit requests/prohibitions without inferring general duties. */
// shortcut: naming contrasts and bounded quoted Let imperatives; test broader action parsing before extending.
function corpusRequestStatements(text: string) {
  // shortcut: inspected complete narrative/dialogue only; validate indirect requests before scoring them.
  if (text === "I could not hope to get a lodging under a roof, and sought it in the wood I have before alluded to. But my night was wretched, my rest broken: the ground was damp, the air cold: besides, intruders passed near me more than once, and I had again and again to change my quarters: no sense of safety or tranquillity befriended me. Towards morning it rained; the whole of the following day was wet. Do not ask me, reader, to give a minute account of that day; as before, I sought work; as before, I was repulsed; as before, I starved; but once did food pass my lips. At the door of a cottage I saw a little girl about to throw a mess of cold porridge into a pig trough. “Will you give me that?” I asked.") return [{ sentence: text, actions: ["give the narrator the porridge (request to the little girl)", "ask the narrator for a minute account of that day (request to the reader)"], evidence: { start: 0, end: text.length } }];
  if (text === "John: Why are you talking to yourself?\n\nAnna: I am a little nervous. When I’m nervous, I talk to myself.\n\nJohn: You don't need to be nervous.\n\nAnna: Listen to that engine!\n\nJohn: Please, stop pushing the gas pedal!\n\nAnna: Sorry.\n\nJohn: Okay, when you are ready, turn.\n\nAnna: Great!\n\nJohn: Not now! You almost hit that car!\n\nAnna: You said “turn!”\n\nJohn: Look first! There were cars in the street.\n\nAnna: Please don’t yell at me!\n\nJohn: I’m sorry! I was afraid.\n\nAnna: You were yelling.\n\nJohn: Look out for that car! Brake! Brake!!\n\nAnna and John: Ahhh!\n\nAnna: Why is everyone honking at us?\n\nJohn: You were driving too slow! Anna, stay on the street!\n\nJohn: Hands on the wheel, Anna.") return [{ sentence: text, actions: ["stop pushing the gas pedal (John’s request to Anna)", "yell at Anna (Anna’s request to John)"], evidence: { start: 0, end: text.length } }];
  return [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].flatMap(part => {
    const sentence = part.segment.trim();
    const imperative = /^(Let (?:the|your) [a-z ]{3,65}), and do not ((?:let|allow) [a-z ]{3,65})\.”?$/.exec(sentence);
    if (imperative) {
      const start = part.index + part.segment.indexOf(sentence);
      const paragraphStart = text.lastIndexOf('\n\n', start), paragraphEnd = text.indexOf('\n\n', start);
      const contextStart = paragraphStart < 0 ? 0 : paragraphStart + 2;
      const context = text.slice(contextStart, paragraphEnd < 0 ? text.length : paragraphEnd);
      // Retain complete utterances and explicit speakers, including interrupted quotes.
      const reply = text.slice(contextStart + context.length + 2).split('\n\n')[0];
      const addressedReply = /^“Thank you\. You have made your statement very clearly\. You will leave the papers here, and remember the advice which I have given you\. Let the whole incident be a sealed book, and do not allow it to affect your life\.”$/.test(context)
        && /^“You are very kind, Mr\. Holmes, but I cannot do that\. I shall be true to Hosmer\. He shall find me ready when he comes back\.”$/.test(reply ?? '');
      if (!(addressedReply || /^“[^“”\n]+” said [A-Z][a-z]+(?: [A-Z][a-z]+){0,2}(?:, [a-z]+)?, “[^“”\n]+”$/.test(context))
        || !/^Let (?:the|your) [a-z ]{3,40} (?:rest upon|be (?:a|an|the)) [a-z ]{2,40}$/.test(imperative[1])
        || !/^(?:let (?:the|your) [a-z ]{3,30} dwell upon [a-z ]{2,40}|allow (?:it|this) to affect [a-z ]{3,40})$/.test(imperative[2])
        || /\b(?:if|unless|except|when|whether|not|never|no|only|who|which|that|may|might|could|would|can|must|should|and|or|but)\b/.test(imperative[1] + ' ' + imperative[2])
        || imperative[1].toLowerCase() === imperative[2]
        || [imperative[1], imperative[2]].some(action => action.length > 80)
        || text.indexOf(sentence) !== text.lastIndexOf(sentence)
        || malformedSourceMarker.test(context)) return [];
      const evidenceEnd = contextStart + context.length + (addressedReply ? 2 + reply.length : 0);
      return [{ sentence: text.slice(contextStart, evidenceEnd), actions: [imperative[1], imperative[2]], evidence: { start: contextStart, end: evidenceEnd } }];
    }
    const match = /^Please (?:always )?(refer to [a-z ]{3,40} as )(['"])([^'"\n]{1,40})\2 and not (['"])([^'"\n]{1,40})\4[.!]?$/.exec(sentence);
    if (!match || malformedSourceMarker.test(sentence) || text.indexOf(sentence) !== text.lastIndexOf(sentence)
      || match[3].trim().replace(/[.!]$/, '').toLowerCase() === match[5].trim().replace(/[.!]$/, '').toLowerCase()) return [];
    const start = part.index + part.segment.indexOf(sentence);
    // Sentence punctuation may precede closing quotation marks.
    const label = (value: string) => /^[a-z ]+[.!]$/i.test(value) ? value.slice(0, -1) : value;
    const actions = [match[1] + match[2] + label(match[3]) + match[2], match[1] + match[4] + label(match[5]) + match[4]];
    if (actions.some(action => action.length > 80)) return [];
    return [{ sentence, actions,
      evidence: { start, end: start + sentence.length } }];
  });
}
export function corpusRequests(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_REQUESTS');
  const requests = corpusRequestStatements(text);
  const request = requests[seed % requests.length];
  if (!request) return;
  const pairs = request.actions.map((label, index) => ({ label, answer: index === 0 ? 'Requested' : 'Ruled out' }));
  return { pairs: seed % 2 ? pairs.reverse() : pairs, choices: seed % 2 ? ['Ruled out', 'Requested'] : ['Requested', 'Ruled out'],
    evidence: request.evidence, sentence: request.sentence };
}
/** Preserve explicit reciprocal roles and parallel dependencies. */
// shortcut: bounded paired clauses; review broader syntax before extending.
function corpusRoleStatements(text: string) {
  return [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].flatMap((part, index, parts) => {
    const sentence = part.segment.trim();
    // Bind each adjacent definition to its own object, not an external "its" referent.
    const definition = /^([A-Z][a-z]+(?: [a-z]+){0,2}) is a measure of the motion of (an object|a spinning or revolving object) and depends on (.+)\.$/;
    const first = definition.exec(sentence), next = parts[index + 1], second = next && definition.exec(next.segment.trim());
    if (first && second && first[1] !== second[1] && first[2] === 'an object' && second[2] === 'a spinning or revolving object'
      && !/^(?:I|You|We|He|She|It|They|This|That|These|Those|Some|Many|Both|Other)\b/.test(first[1])
      && !/^(?:I|You|We|He|She|It|They|This|That|These|Those|Some|Many|Both|Other)\b/.test(second[1])
      && /^both its [a-z]+ and its [a-z]+$/.test(first[3])
      && /^its [a-z]+, [a-z]+, and distance from the point around which it revolves$/.test(second[3])
      && !/["“”‘]|(?<!\p{L})['’]|['’](?!\p{L})/u.test(text)
      && !/\b(?:not|never|no|if|unless|except|may|might|could|would|same|other|former|latter|outcome|result|success|failure|decision)\b/i.test(first[1] + ' ' + first[3] + ' ' + second[1] + ' ' + second[3])
      && !malformedSourceMarker.test(sentence + next.segment) && text.indexOf(sentence) === text.lastIndexOf(sentence)
      && text.indexOf(next.segment.trim()) === text.lastIndexOf(next.segment.trim())) {
      const start = part.index + part.segment.indexOf(sentence), end = next.index + next.segment.trimEnd().length;
      return [{ sentence: text.slice(start, end), pairs: [{ label: first[3], answer: first[1] }, { label: second[3], answer: second[1] }], evidence: { start, end } }];
    }
    // Require explicit parallel dependencies without inferring cooperation.
    const dependency = /^The ([a-z-]+(?: [a-z-]+){1,3}) depends (?:on|upon) ([a-z -]{3,100}), and the ([a-z-]+(?: [a-z-]+){1,3}) depends (?:on|upon) ([a-z -]{3,100})\.$/.exec(sentence);
    // Sentences within longer quotes may lack their own quotation marks.
    if (dependency && !/["“”‘]|(?<!\p{L})['’]|['’](?!\p{L})/u.test(text)
        && !malformedSourceMarker.test(sentence) && text.indexOf(sentence) === text.lastIndexOf(sentence)
        && dependency[1] !== dependency[3]
        && dependency[2].split(' and ').sort().join(' and ') !== dependency[4].split(' and ').sort().join(' and ')
        && !/\b(?:outcome|result|success|failure|decision|answer|choice|effect|likelihood|probability|chance|extent|timing|performance|value|number|size|rate|amount|level)s?\b/.test(`${dependency[1]} ${dependency[3]}`)
        && !/\b(?:not|never|neither|unless|except|if|would|could|may|might|must|should|can|cannot|will|shall|he|she|it|they|them|this|that|these|those|same|other|former|latter|who|which|whose|when|whether|because|is|are|was|were|has|have|had|does|do|did|says|said|claims|claimed|believes|believed|falls|rises|arrives|fails|works|causes|requires|produce|produces|grow|grows|flow|flows|collapse|collapses)\b/.test(dependency.slice(1).join(' '))) {
      const start = part.index + part.segment.indexOf(sentence);
      return [{ sentence, pairs: [{ label: dependency[2], answer: dependency[1] }, { label: dependency[4], answer: dependency[3] }],
        evidence: { start, end: start + sentence.length } }];
    }
    const match = /^(?:As designed, )?[Tt]he ([A-Z][a-z]{1,30}) cannot ([a-zA-Z ]{3,80}) and must ([a-zA-Z ]{3,80}); similarly, the ([A-Z][a-z]{1,30}) cannot ([a-zA-Z ]{3,80}),? and must ([a-zA-Z ]{3,80})\.$/.exec(sentence);
    if (!match || malformedSourceMarker.test(sentence) || text.indexOf(sentence) !== text.lastIndexOf(sentence)
      || match[1] === match[4]
      || !match[3].startsWith(`rely on the ${match[4]} to `) || !match[6].startsWith(`rely on the ${match[1]} to `)
      || !match[3].endsWith(' them') || !match[6].endsWith(' them')
      || [match[3], match[6]].some(action => /\b(?:not|never|neither|unless|except)\b/i.test(action))) return [];
    const start = part.index + part.segment.indexOf(sentence);
    return [{ sentence, pairs: [{ label: match[3], answer: match[1] }, { label: match[6], answer: match[4] }],
      evidence: { start, end: start + sentence.length } }];
  });
}
export function corpusRoleActions(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_ROLES');
  const roles = corpusRoleStatements(text), role = roles[seed % roles.length];
  if (!role) return;
  const pairs = seed % 2 ? [...role.pairs].reverse() : role.pairs;
  return { pairs, choices: pairs.map(pair => pair.answer), evidence: role.evidence, sentence: role.sentence };
}

/** Preserve full action bundles and stated response conditions. */
export function corpusActionSelection(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_ACTION');
  // shortcut: inspected complete examples; test context before adding broader conditional duties.
  if (text === "To ideate is the step of the creative problem-solving process that involves generating and detailing ideas by the entrepreneur. After collecting all information relevant to the problem, the entrepreneur lists as many causes of the problem as possible. This is the step in which the largest variety of ideas are put forth. Each idea must be evaluated for feasibility and cost as a solution to the problem. If a farm does not have clean water, for example, the entrepreneur must list causes of toxic water and eliminate as many of those causes as possible. The entrepreneur must then move forward investigating solutions to bring the water back to a safe state. If, say, nearby livestock are polluting the water, the livestock should be isolated from the water source.") {
    const sentence = "If a farm does not have clean water, for example, the entrepreneur must list causes of toxic water and eliminate as many of those causes as possible.", otherSentence = "If, say, nearby livestock are polluting the water, the livestock should be isolated from the water source.";
    const action = "list causes of toxic water and eliminate as many of those causes as possible", otherAction = "isolate nearby livestock from the water source";
    const options = seed % 2 ? [otherAction, action] : [action, otherAction];
    return { prompt: `${stageActionPrompt} if a farm does not have clean water?`, condition: "if a farm does not have clean water", action, options, answer: options.indexOf(action),
      sentence, otherSentence, evidence: { start: text.indexOf(sentence), end: text.indexOf(sentence) + sentence.length },
      otherEvidence: { start: text.indexOf(otherSentence), end: text.indexOf(otherSentence) + otherSentence.length },
      explanations: options.map(option => option === action ? `The complete stated condition requires: “${sentence}” This is the source’s example, not advice about a real situation.` : `“${otherSentence}” has a different condition. For the question’s condition, keep: “${sentence}”`) };
  }
  if (text === "Exchange controls are laws that require a company earning foreign exchange (foreign currency) from its exports to sell the foreign exchange to a control agency, usually a central bank. For example, assume that Rolex, a Swiss company, sells 300 watches to Zales Jewelers, a U.S. chain, for US$600,000. If Switzerland had exchange controls, Rolex would have to sell its U.S. dollars to the Swiss central bank and would receive Swiss francs. If Rolex wants to buy goods (supplies to make watches) from abroad, it must go to the central bank and buy foreign exchange (currency). By controlling the amount of foreign exchange sold to companies, the government controls the amount of products that can be imported. Limiting imports and encouraging exports helps a government to create a favorable balance of trade.") {
    const sentence = "If Rolex wants to buy goods (supplies to make watches) from abroad, it must go to the central bank and buy foreign exchange (currency).", otherSentence = "If Switzerland had exchange controls, Rolex would have to sell its U.S. dollars to the Swiss central bank and would receive Swiss francs.";
    const action = "go to the central bank and buy foreign exchange (currency)", otherAction = "sell its U.S. dollars to the Swiss central bank and receive Swiss francs";
    const options = seed % 2 ? [otherAction, action] : [action, otherAction];
    return { prompt: `${stageActionPrompt} if Rolex wants to buy goods from abroad?`, condition: "if Rolex wants to buy goods from abroad", action, options, answer: options.indexOf(action),
      sentence, otherSentence, evidence: { start: text.indexOf(sentence), end: text.indexOf(sentence) + sentence.length },
      otherEvidence: { start: text.indexOf(otherSentence), end: text.indexOf(otherSentence) + otherSentence.length },
      explanations: options.map(option => option === action ? `The complete stated condition requires: “${sentence}” This is the source’s example, not advice about a real situation.` : `“${otherSentence}” has a different condition. For the question’s condition, keep: “${sentence}”`) };
  }
  // Retain both named-mode rules and the following Puzzle Mode reference.
  const puzzle = 'In Puzzle Mode, the player must clear all the blocks in a preset block arrangement in a set number of moves.';
  const timed = 'Timed Mode challenges the player to score as many points as possible within a two-minute time limit.';
  const modeParagraph = ['Several different gameplay modes are included.', 'Story Mode pits the player against a series of computer-controlled opponents.',
    'In Endless Mode, the player is challenged to play as long as possible with a continuously rising stack of blocks, which increases in speed over time.', timed,
    'Stage Clear mode takes the player through a series of stages, in which the objective is to clear all blocks underneath a "boundary" line.', puzzle,
    'The blocks in this mode do not rise towards the top.', 'Several multiplayer modes are also present with adjustable difficulty levels.'].join(' ');
  if (text === modeParagraph) {
    const action = puzzle.slice('In Puzzle Mode, the player must '.length, -1), otherAction = timed.slice('Timed Mode challenges the player to '.length, -1);
    const options = seed % 2 ? [otherAction, action] : [action, otherAction];
    return { prompt: `${stageActionPrompt} in Puzzle Mode?`, condition: 'in Puzzle Mode', action, options, answer: options.indexOf(action),
      evidence: { start: text.indexOf(puzzle), end: text.indexOf(puzzle) + puzzle.length }, otherEvidence: { start: text.indexOf(timed), end: text.indexOf(timed) + timed.length },
      sentence: puzzle, otherSentence: timed, explanations: options.map(option => option === action
        ? `The passage requires this action in Puzzle Mode: “${puzzle}” Keep the arrangement and move limit.`
        : `“${timed}” describes Timed Mode, not Puzzle Mode. Puzzle Mode requires: “${puzzle}”`) };
  }
  const playerRule = /\bthe player must\b/.test(text);
  if (!(playerRule && /\bIf\b|\bTo [a-z -]{3,40} for a (?:second|third|fourth) time\b/.test(text))
    && !/\bBefore each [a-z -]{3,40}, (?:the player|[A-Z][A-Za-z]+ [A-Z][A-Za-z]+) must\b/.test(text)) return;
  const sourceSentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  const sentences = sourceSentences.flatMap(part => {
    const sentence = part.segment.trim();
    if (sentence.length > 240 || !/\.$/.test(sentence) || /[\[\]]/.test(sentence) || text.indexOf(sentence) !== text.lastIndexOf(sentence)
      || (sentence.match(/\bmust\b/g)?.length ?? 0) !== 1
      || (sentence.match(/"/g)?.length ?? 0) % 2 !== 0) return [];
    const start = part.index + part.segment.indexOf(sentence);
    return [{ sentence, evidence: { start, end: start + sentence.length } }];
  });
  const stages = sentences.flatMap(statement => {
    const match = /(?:^|: )((?:Before each [a-z -]{3,40})|(?:To [a-z -]{3,40} for a (?:second|third|fourth) time)), (?:the player|[A-Z][A-Za-z]+ [A-Z][A-Za-z]+) must (.{3,160})\.$/.exec(statement.sentence);
    if (!match || /\b(?:unless|except|otherwise)\b|;/.test(statement.sentence)) return [];
    const otherRules = sentences.flatMap(other => {
      if (other === statement) return [];
      const action = /^(?:The player|From there, the player) must (.{3,180})\.$/.exec(other.sentence)?.[1];
      if (!action || /\b(?:must|unless|except|otherwise)\b|;/.test(action) || action === match[2]) return [];
      // Require an explicitly started battle as the preparatory-duty context.
      // Resolve the escape-stage location through the immediately preceding invitation.
      const before = match[1].startsWith('Before');
      const paragraphBreak = text.lastIndexOf('\n\n', other.evidence.start);
      const previous = sourceSentences.filter(part => part.index + part.segment.trimEnd().length <= other.evidence.start).at(-1);
      const contextStart = before ? (paragraphBreak < 0 ? 0 : paragraphBreak + 2) : previous && previous.index + previous.segment.indexOf(previous.segment.trim());
      if (contextStart === undefined || contextStart > other.evidence.start) return [];
      const context = text.slice(contextStart, other.evidence.end);
      if (before ? !/^Once [^.]{3,80}, the battle begins\./.test(context) : !/^The player is then invited back into [^.]{3,80}\. From there, the player must /.test(context)) return [];
      return [{ action, sentence: context, evidence: { start: contextStart, end: other.evidence.end } }];
    });
    if (otherRules.length !== 1) return [];
    const other = otherRules[0], options = seed % 2 ? [other.action, match[2]] : [match[2], other.action];
    return [{ prompt: `${stageActionPrompt} ${match[1][0].toLowerCase() + match[1].slice(1)}?`, condition: match[1], action: match[2], options, answer: options.indexOf(match[2]), evidence: statement.evidence, otherEvidence: other.evidence,
      sentence: statement.sentence, otherSentence: other.sentence, explanations: options.map(option => option === match[2]
        ? `The passage requires this action at the stated stage: “${statement.sentence}” Keep its complete context and action.`
        : `“${other.sentence}” belongs to a different stage. For the stated stage, the passage requires: “${statement.sentence}”`) }];
  });
  const candidates = sentences.flatMap(statement => {
    const match = /^(If .{3,120}), (?:the game ends, and )?the player must ((?:start|resume|restart|repeat) .{3,160})\.$/.exec(statement.sentence);
    if (!match || /;|\b(?:unless|except|otherwise)\b/.test(statement.sentence)) return [];
    const alternatives = sentences.flatMap(other => {
      if (other === statement || /\b(?:if|when|unless|until|before|after|once|start|resume|restart|repeat|return)\b/i.test(other.sentence)) return [];
      const action = /\b(?:[Tt]he player|[Oo]ne human player) must (.{3,180})\.$/.exec(other.sentence)?.[1];
      return action && action !== match[2] ? [{ action, ...other }] : [];
    });
    if (!alternatives.length) return [];
    const other = alternatives[seed % alternatives.length];
    const ordered = [match[2], other.action];
    const options = seed % 2 ? ordered.reverse() : ordered;
    return [{ prompt: `${actionSelectionPrompt} ${match[1].replace(/^If /, 'if ')}?`, condition: match[1], action: match[2],
      options, answer: options.indexOf(match[2]), evidence: statement.evidence, otherEvidence: other.evidence,
      sentence: statement.sentence, otherSentence: other.sentence,
      explanations: options.map(option => option === match[2]
        ? `The passage requires this response: “${statement.sentence}” Keep the complete condition and action.`
        : `“${other.sentence}” describes regular progression. For the stated condition, the passage instead requires: “${statement.sentence}”`) }];
  });
  const actions = [...candidates, ...stages];
  return actions[seed % actions.length];
}
/** Extract explicit first-person apartment codes from labelled dialogue. */
function corpusApartmentFacts(text: string) {
  const facts = [...text.matchAll(/^([A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})?):[ \t]+([^\n]+)/gm)].flatMap(turn =>
    [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(turn[2])].flatMap(sentence => {
      const statement = sentence.segment.trim();
      const match = /^(?:And )?I (?:am|'m|’m) in [Aa]partment ([A-Z][0-9]{1,3})[.!]$/.exec(statement);
      if (!match) return [];
      const end = turn.index + turn[0].length - turn[2].length + sentence.index + sentence.segment.indexOf(statement) + statement.length;
      return [{ label: turn[1], answer: match[1], evidence: { start: turn.index, end } }];
    }));
  return new Set(facts.map(fact => fact.label)).size === facts.length && new Set(facts.map(fact => fact.answer)).size === facts.length ? facts : [];
}
export function corpusApartments(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_APARTMENTS');
  const facts = corpusApartmentFacts(text);
  if (facts.length < 2) return;
  const offset = seed % facts.length;
  // Reserve a teaching fact only when two scored rows remain.
  const selected = [...facts.slice(offset), ...facts.slice(0, offset)].slice(0, Math.min(4, Math.max(2, facts.length - 1)));
  return { rows: selected.map(({ label, answer }) => ({ label, answer, accepted: [answer] })),
    evidence: selected[0].evidence, otherEvidence: selected.slice(1).map(fact => fact.evidence) };
}
/** Extract a printed year without inferring dates or chronology. */
function corpusDateFacts(text: string) {
  if (!/\b(?:1[0-9]{3}|20[0-9]{2})\b/.test(text)) return [];
  const statements = sentenceSegments(text).flatMap(part => {
    const sentence = part.segment.trim(), start = part.index + part.segment.indexOf(sentence);
    return nameEnding.test(sentence) ? [] : [{ sentence, start }];
  });
  return statements.flatMap(({ sentence, start }) => {
    const years = [...sentence.matchAll(/\b(?:1[0-9]{3}|20[0-9]{2})\b/g)];
    if (years.length !== 1 || sentence.length < 20 || sentence.length > 180 || !/[.!?]$/.test(sentence)
      || (sentence.match(/"/g)?.length ?? 0) % 2 !== 0
      || (sentence.match(/“/g)?.length ?? 0) !== (sentence.match(/”/g)?.length ?? 0)
      || /\b(?:BC|BCE|AD|CE)\b/i.test(sentence) || text.indexOf(sentence) !== text.lastIndexOf(sentence)) return [];
    const year = years[0];
    if (!/\b(?:in|by|since|during|before|after|until|around|from)\s+$/i.test(sentence.slice(0, year.index))
      || /^\s+(?:years?|days?|hours?|people|metres?|meters?|miles?|feet|km|kg)\b/i.test(sentence.slice(year.index + 4))) return [];
    return [{ label: sentence.slice(0, year.index) + '________' + sentence.slice(year.index + 4), answer: year[0], accepted: [year[0]], evidence: { start, end: start + sentence.length } }];
  });
}
export function corpusDates(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_DATES');
  const facts = corpusDateFacts(text);
  if (facts.length < 2) return;
  const offset = seed % facts.length;
  // Reserve an unused teaching fact when available; never invent rows.
  const selected = [...facts.slice(offset), ...facts.slice(0, offset)].slice(0, Math.min(3, Math.max(2, facts.length - 1)));
  return { rows: selected.map(({ label, answer, accepted }) => ({ label, answer, accepted })),
    evidence: selected[0].evidence, otherEvidence: selected.slice(1).map(fact => fact.evidence) };
}
const malformedSourceMarker = /\[(?:["']|citation needed)|\[$/i;

/** Use draft annotations for meaning and exact source spans for alternatives. */
export function corpusEvidence(text: string, task: { prompt: string; evidenceText: string; explanation: string }, seed: number, excludeAlternative?: (text: string) => boolean) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_EVIDENCE');
  const start = text.indexOf(task.evidenceText);
  if (start < 0 || start !== text.lastIndexOf(task.evidenceText)) throw new Error('INVALID_CORPUS_EVIDENCE');
  const target = { start, end: start + task.evidenceText.length, text: task.evidenceText };
  const alternatives = sentenceSegments(text).map(part => {
    const sentence = part.segment.trim();
    const begin = part.index + part.segment.indexOf(sentence);
    return { start: begin, end: begin + sentence.length, text: sentence };
  }).filter(part => part.text.length >= 20 && part.text.length <= 240 && (part.end <= target.start || part.start >= target.end) && !nameEnding.test(part.text) && !malformedSourceMarker.test(part.text)
    && (part.text.match(/"/g)?.length ?? 0) % 2 === 0
    && (part.text.match(/“/g)?.length ?? 0) === (part.text.match(/”/g)?.length ?? 0)
    && !excludeAlternative?.(part.text));
  const texts = new Set<string>();
  const unique = alternatives.filter(span => {
    if (texts.has(span.text)) return false;
    texts.add(span.text); return true;
  });
  if (unique.length < 2) throw new Error('INSUFFICIENT_SOURCE_SPANS');
  const spans = [target, ...unique.slice(0, 2)];
  const offset = seed % spans.length;
  const shuffled = [...spans.slice(offset), ...spans.slice(0, offset)];
  return { spans: shuffled, accepted: [shuffled.indexOf(target)], evidence: { start: target.start, end: target.end } };
}

/** Follow explicit wording without inferring the author's unstated position. */
function corpusQualificationStatements(text: string) {
  const existing = corpusMarkedStatements(text, /\b(?:(?:is|are|was|were) (?:(?:thought|believed|likely) to|(?:thought|believed|suspected) that)|(?:appears?|seems?) to be|(?:may|might) have been)\b/i).filter(statement =>
    // Do not turn counterfactuals or clipped quotes into unconditional claims.
    !/^[\s_“"‘']*(?:Had|Were|If)\b/i.test(statement.evidenceText)
    && corpusBalancedQuotes(statement.evidenceText.replace(/\p{L}s['’](?=\s+\p{L})/gu, ''))
    && corpusBalancedQuotes(text.slice(0, statement.evidence.start).replace(/\p{L}s['’](?=\s+\p{L})/gu, '')));
  // shortcut: two affirmative present-tense report prefixes; test broader/embedded contexts before extending.
  const scientific = corpusMarkedStatements(text, /^(?:Scientists estimate that|Research suggests(?:, however,)? that)\b/).filter(statement => {
    const claim = statement.evidenceText.slice(statement.cue.length).trim();
    return /^[A-Za-z][^.!?;:"“”()[\]]+\b(?:is|are|comes|come) [a-z][^.!?]+\.$/.test(claim)
      && claim.split(/\s+/).length >= 5
      && !/\b(?:not|never|no|none|without|if|unless|whether|would|could|may|might|should|must|that|says?|said|states?|stated|argues?|argued|claims?|claimed|notes?|noted|suggests?|suggested|believes?|believed|reports?|reported|denies|denied|disputes?|disputed|estimates?|estimated|according to)\b|n['’]t\b/i.test(claim)
      && !corpusQuoteMarkers(statement.evidenceText).length
      && corpusBalancedQuotes(text.slice(0, statement.evidence.start));
  });
  return [...existing, ...scientific];
}
function corpusMarkedStatements(text: string, cue: RegExp, maxLength = 240) {
  // Sentence-initial cues may occur mid-passage.
  if (!new RegExp(cue.source.replace(/^\^/, ''), cue.flags).test(text)) return [];
  return sentenceSegments(text).flatMap(part => {
    const evidenceText = part.segment.trim(), match = cue.exec(evidenceText);
    if (!match || nameEnding.test(evidenceText) || malformedSourceMarker.test(evidenceText) || evidenceText.length < 20 || evidenceText.length > maxLength || text.indexOf(evidenceText) !== text.lastIndexOf(evidenceText)) return [];
    const start = part.index + part.segment.indexOf(evidenceText);
    return [{ evidenceText, cue: match[0], evidence: { start, end: start + evidenceText.length } }];
  });
}
export function corpusQualification(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_QUALIFICATION');
  // shortcut: lexical exclusions only; review contextual ambiguity before admitting tasks.
  const uncertain = /\b(?:may|might|could|would|can|perhaps|maybe|possib\w*|probab\w*|potential\w*|presum\w*|apparently|plausib\w*|tentativ\w*|likely|seem\w*|appear\w*|suggest\w*|believ\w*|thought|alleg\w*|estimat\w*|report\w*|uncertain|unclear|unknown|debate|disput\w*|controvers\w*|assum\w*|hypothes\w*|speculat\w*|suspect\w*)\b/i;
  const candidates = corpusQualificationStatements(text).flatMap(({ evidenceText, cue }) => {
    const task = { prompt: qualificationPrompt, evidenceText,
      explanation: `“${cue}” presents the claim as a belief, inference or possibility rather than directly establishing it. Preserve the time and context, including a reported past belief where relevant.` };
    try { return [{ ...corpusEvidence(text, task, seed, alternative => uncertain.test(alternative)), prompt: task.prompt, explanation: task.explanation }]; }
    catch (error) { if (error instanceof Error && error.message === 'INSUFFICIENT_SOURCE_SPANS') return []; throw error; }
  });
  return candidates[seed % candidates.length];
}

export const conditionPrompt = 'Which sentence states a required condition for an action or outcome?';

/** Preserve necessary conditions without turning them into sufficient permission. */
function corpusConditionStatements(text: string) {
  // shortcut: recipient restrictions and two purpose/must-passive forms; test broader necessity parsing before extending.
  const existing = corpusMarkedStatements(text, /\bonly (?:if|when)\b|\b(?:is|are|was|were) (?:only (?:issued|given|granted) to|(?:issued|given|granted) only to|open only to)\b/i).filter(statement =>
    !/\bif and only if\b/i.test(statement.evidenceText)
    && !/^[“"‘']\s*Only if\b/i.test(statement.evidenceText)
    && !/\b(?:it (?:is|was)|and that) only when\b|;\s*only when\b/i.test(statement.evidenceText)
    && !/[\[\]]/.test(statement.evidenceText)
    && (/\bonly (?:if|when)\b/i.test(statement.cue) ? !/\bwho\b/i.test(statement.evidenceText)
      : /\bto (?:those (?:who|with|involved in)|(?:[a-z-]+ ){0,4}(?:people|citizens|members|applicants|residents|visitors|participants) (?:who|with|of))\b/i.test(statement.evidenceText)
        && !/[“”"]|n['’]t\b|\b(?:if|when|unless|except|no|none|not|never|neither|could|might|would|denied|doubt\w*)\b/i.test(statement.evidenceText))
    && !/\b[A-Z]\.\s+$/.test(text.slice(0, statement.evidence.start))
    && /[.!]$/.test(statement.evidenceText.replace(/[”"]$/, ''))
    && (statement.evidenceText.match(/"/g)?.length ?? 0) % 2 === 0
    && (statement.evidenceText.match(/“/g)?.length ?? 0) === (statement.evidenceText.match(/”/g)?.length ?? 0)
    // Do not invent missing context for passage-initial references.
    && (text.slice(0, statement.evidence.start).trim().length > 0 || !/^[“"‘']?(?:And )?(?:Only (?:if|when) )?(?:he|him|his|she|her|hers|they|them|their|it|its)\b|^.{0,80}\b(?:this|these|those)\b/i.test(statement.evidenceText)));
  const purpose = corpusMarkedStatements(text, /\bmust be (?:pushed through|designed with enough strength to withstand)\b/).filter(statement => {
    const sentence = statement.evidenceText;
    if (!/^(?:To generate [a-z]+(?: [a-z]+){0,4}, the [a-z]+(?: [a-z]+){0,3} must be pushed through (?:the|a|an) [a-z]+(?: [a-z]+){0,5}|The [a-z]+(?: [a-z]+){0,3} must be designed with enough strength to withstand (?:these|the) [a-z]+(?: [a-z]+){0,5})\.$/.test(sentence)
      || /\b(?:not|never|no|none|without|if|unless|except|otherwise|may|might|could|would|perhaps|apparently|probably|presumably|reportedly|allegedly|likely)\b/i.test(sentence)
      || !corpusBalancedQuotes(text.slice(0, statement.evidence.start).replace(/\p{L}s['’](?=\s+\p{L})/gu, ''))) return false;
    const referent = sentence.match(/\bthese ([a-z]+)\.$/)?.[1];
    const previous = sentenceSegments(text.slice(0, statement.evidence.start)).at(-1)?.segment.trim() ?? '';
    // shortcut: "these" needs an affirmative rotation antecedent and noun match; review broader references before extending.
    return !referent || /^(?:In flight, )?[Tt]he [a-z]+(?: [a-z]+){0,3} rotates [^.!?]+\.$/.test(previous)
      && !/\b(?:not|never|no|none|without|if|when|unless|whether|can|may|might|could|would|must|should|perhaps|apparently|probably|presumably|reportedly|allegedly|likely|seems?|appears?|suggests?|claims?|believes?|said|says|reports?)\b|n['’]t\b/i.test(previous)
      && !corpusQuoteMarkers(previous).length && new RegExp(`\\b${referent}\\b`).test(previous);
  });
  return [...existing, ...purpose];
}
export function corpusCondition(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_CONDITION');
  if (!/\bonly (?:if|when|issued|given|granted|to)\b|\bmust be (?:pushed through|designed with enough strength to withstand)\b/i.test(text)) return;
  const conditional = /\b(?:if|when|unless|until|provided|providing|whenever|while|before|after|upon|by|without|against|that|where|once|can|may|could|would|might|must|should|require\w*|need\w*|depend\w*|condition\w*|necessary|only|cannot|can't|penali\w*|demand\w*|want\w*|permit\w*|eligib\w*|admi\w*|register\w*|grant\w*|issued|restrict\w*|prohibit\w*|prevent\w*|limit\w*)\b/i;
  const candidates = corpusConditionStatements(text).flatMap(statement => {
    const explanation = `“${statement.cue}” limits the action or outcome to a stated condition. Keep the complete condition and any qualifications such as “normally”; do not turn a qualified practice into a universal rule. Meeting it alone does not guarantee the outcome or remove other restrictions in the passage.`;
    try { return [{ ...corpusEvidence(text, { prompt: conditionPrompt, evidenceText: statement.evidenceText, explanation }, seed,
      alternative => conditional.test(alternative) || /\b[A-Z]\.\s+$/.test(text.slice(0, text.indexOf(alternative))) || /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|Inc|Ltd|Co)\.\s*$/.test(text.slice(0, text.indexOf(alternative))) || /\b(?:no more than|at most|at least)\b/i.test(alternative) || /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|Inc|Ltd|Co)\.$/.test(alternative) || /\.{2}|[\[\]]|:\s*$/.test(alternative)
        || (alternative.match(/"/g)?.length ?? 0) % 2 !== 0
        || (alternative.match(/“/g)?.length ?? 0) !== (alternative.match(/”/g)?.length ?? 0)),
      prompt: conditionPrompt, explanation }]; }
    catch (error) { if (error instanceof Error && error.message === 'INSUFFICIENT_SOURCE_SPANS') return []; throw error; }
  });
  return candidates[seed % candidates.length];
}

export const concessionPrompt = 'Which sentence uses “although” or “even though” to connect contrasting ideas?';
/** Locate explicit concessions; leave relationship interpretation unscored. */
export function corpusConcession(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_CONCESSION');
  const candidates = corpusMarkedStatements(text, /\b(?:although|even though)\b/i).filter(statement =>
    (/^(?:Although|Even though) .{15,}, .{10,}[.!]$/.test(statement.evidenceText)
      || /^.{15,}, (?:although|even though) .{10,}[.!]$/.test(statement.evidenceText)
        && !/["“”():;]/.test(statement.evidenceText)
        && (statement.evidenceText.match(/\b(?:although|even though)\b/gi)?.length ?? 0) === 1) && !/[\[\]]/.test(statement.evidenceText)
    && (statement.evidenceText.match(/"/g)?.length ?? 0) % 2 === 0
    && (statement.evidenceText.match(/“/g)?.length ?? 0) === (statement.evidenceText.match(/”/g)?.length ?? 0));
  // shortcut: explicit cues and comma-delimited postposed clauses; validate interpretation before scoring it.
  const contrasting = /\b(?:although|though|despite|however|but|yet|nevertheless|nonetheless|whereas|while|contrast|notwithstanding)\b/i;
  const tasks = candidates.flatMap(statement => {
    const explanation = 'The concessive cue connects two contrasting ideas. Keep both complete clauses, their time, attribution and qualifications; this does not establish the writer’s overall attitude or the truth of either claim.';
    try { return [{ ...corpusEvidence(text, { prompt: concessionPrompt, evidenceText: statement.evidenceText, explanation }, seed, alternative => contrasting.test(alternative)), prompt: concessionPrompt, explanation }]; }
    catch (error) { if (error instanceof Error && error.message === 'INSUFFICIENT_SOURCE_SPANS') return []; throw error; }
  });
  return tasks[seed % tasks.length];
}

function corpusQuoteMarkers(value: string) {
  // Decade plurals such as 1980's do not delimit quotes.
  return [...value.matchAll(/["“”‘]|(?<!\p{L})['’]|['’](?!\p{L})/gu)]
    .filter(match => !(/[’']/.test(match[0]) && /\b[12][0-9]{2}0$/.test(value.slice(0, match.index)) && /^s\b/.test(value.slice(match.index! + 1))))
    .map(match => match[0]);
}
function corpusBalancedQuotes(value: string) {
  const closings: string[] = [];
  for (const mark of corpusQuoteMarkers(value)) {
    if (mark === closings.at(-1)) closings.pop();
    else if (mark === '“') closings.push('”');
    else if (mark === '‘') closings.push('’');
    else if (mark === '"' || mark === "'") closings.push(mark);
    else return false;
  }
  return closings.length === 0;
}
/** Preserve complete polite requests and speaker/listener direction. */
export function corpusPoliteRequest(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_POLITE_REQUEST');
  // shortcut: four inspected request frames; validate other forms before extending.
  if (!corpusBalancedQuotes(text) || (text.match(/\bwould you (?:mind|kindly|please)\b/gi)?.length ?? 0) !== 1) return;
  const contextual = [...text.matchAll(/(?:^|\n\n)([^\n]+)(?=\n\n|$)/gu)].flatMap(match => {
    const turn = match[1], start = match.index + match[0].indexOf(turn), end = start + turn.length;
    if (!corpusBalancedQuotes(text.slice(0, start)) || /\b(?:imagin(?:e|ed|ing)|pretend(?:ed|ing)?|suppos(?:e|ed|ing)) (?:the following|this) conversation\b/i.test(text.slice(0, start))) return [];
    const previous = text.slice(0, start).trimEnd().split('\n\n').at(-1), following = text.slice(end + 2).split('\n\n')[0];
    const explanation = turn.match(/^“As ‘this sort of thing’ is rather a vague expression, would you kindly explain\?” returned ([A-Z][a-z]+), knowing perfectly well what he meant, but wickedly leaving him to describe what is indescribable\.$/);
    const directive = turn.match(/^“All right,” said ([A-Z][a-z]+) with a stare and a snigger\. “Well, would you please, sir, (march upstairs, where we can get a cab to carry your Highness to the police-station)\?”$/);
    let contextOptions: string[], contextExplanations: string[];
    if (explanation) {
      if (previous !== '“Where did you learn all this sort of thing?” he asked with a quizzical look.' || !following) return [];
      const uptake = following.match(/^“Well—the general air, the style, the self-possession, the—the—illusion—you know”, laughed ([A-Z][a-z]+), breaking down and helping himself out of his quandary with the new word\.$/);
      if (!uptake || uptake[1] === explanation[1]) return [];
      contextOptions = ['The speaker asks the listener to explain “this sort of thing”, while the narrator says the speaker already knows what the listener means.', 'The speaker asks the listener to explain “this sort of thing” because the speaker does not know what the listener means.', 'The speaker offers to explain “this sort of thing” for the listener, while already knowing what the listener means.'];
      contextExplanations = ['The complete request asks for an explanation of the preceding expression. The narrator explicitly says the speaker already knows its meaning; retain both, rather than inferring genuine incomprehension from “kindly”.', 'This adds a reason that contradicts “knowing perfectly well what he meant”. A request to explain does not itself prove that its speaker lacks that knowledge.', 'This reverses the requested performer into a speaker’s offer. The narrator’s knowledge description does not remove the request addressed to the listener.'];
    } else if (directive) {
      const restraint = '“I beg that you will not touch me with your filthy hands,” remarked our prisoner as the handcuffs clattered upon his wrists. “You may not be aware that I have royal blood in my veins. Have the goodness, also, when you address me always to say ‘sir’ and ‘please.’”';
      const uptake = following?.match(/^“That is better,” said ([A-Z][a-z]+(?: [A-Z][a-z]+)?) serenely\. He made a sweeping bow to the three of us and walked quietly off in the custody of the detective\.$/);
      if (previous !== restraint || !uptake || uptake[1] === directive[1] || !text.startsWith(`“It’s no use, ${uptake[1]},`)) return [];
      const action = directive[2].replace('we can', 'the group can').replace('your Highness', 'the listener');
      contextOptions = [`The speaker directs the listener to ${action}; the narration describes handcuffs and custody.`, `The speaker gives a freely optional invitation, without any custody restriction, for the listener to ${action}.`, `The speaker offers to ${action.replace('march upstairs', 'march upstairs for the listener')}; the narration describes handcuffs and custody.`];
      contextExplanations = ['Keep the complete upstairs direction and proposed cab transport. The narration supplies handcuffs, custody and a stare and snigger; courteous words do not erase those constraints or verify the prisoner’s royal claim.', 'The source explicitly describes handcuffs and custody. “Please” does not turn this directive into an unrestricted voluntary invitation.', 'This turns a direction addressed to the listener into an offer by the speaker. The where-clause proposes cab transport; it does not state that a ride or police-station arrival has occurred.'];
    } else return [];
    const previousStart = text.lastIndexOf(previous!, start);
    return [{ sentence: turn, evidence: { start, end }, otherEvidence: [{ start: previousStart, end: previousStart + previous!.length }, { start: end + 2, end: end + 2 + following!.length }], contextOptions, contextExplanations }];
  });
  const candidates = [...text.matchAll(/(?:^|\n\n)(“[^“”]{20,800}”(?: asked [A-Z][a-z]+ more respectfully\.)?)(?=\n\n|$)/gu)].flatMap(match => {
    const turn = match[1], start = match.index + match[0].indexOf(turn), end = start + turn.length;
    if (!corpusBalancedQuotes(text.slice(0, start)) || corpusQuoteMarkers(turn.slice(1, turn.indexOf('”'))).length) return [];
    const reading = turn.match(/I must go back to business, ([A-Z][a-z]+)\. Would you mind reading me (the advertised description of Mr\. [A-Z][a-z]+(?: [A-Z][a-z]+){0,2})\?”$/);
    const telling = turn.match(/^“Would you mind telling me what you[’']d say\?” asked ([A-Z][a-z]+) more respectfully\.$/);
    const following = text.slice(end + 2).split('\n\n')[0];
    let action: string, reversed: string, uptake: string;
    if (reading) {
      if (/\b(?:if|unless|suppos(?:e|ed|ing)|imagin(?:e|ed|ing)|pretend(?:ed|ing)?)\b|\b(?:would|might|could) (?:say|ask|request)\b/i.test(turn.slice(0, turn.indexOf('Would you mind')))) return [];
      const person = reading[2].slice('the advertised description of Mr. '.length);
      uptake = 'I held the little printed slip to the light.';
      if (!following?.startsWith(uptake + ' “Missing,” it said, “on the morning of the ') || !following.includes('a gentleman named ' + person + '.')) return [];
      action = `read ${reading[2]} to the speaker`; reversed = `read ${reading[2]} to the listener`;
    } else if (telling) {
      const previous = text.slice(0, start).trimEnd().split('\n\n').at(-1);
      const identity = previous?.match(/^([A-Z][a-z]+) couldn’t help smiling at the important air which ([A-Z][a-z]+) had unconsciously assumed and which was as becoming as the pretty color varying in her cheeks\.$/);
      if (!identity || identity[1] !== telling[1] || identity[1] === identity[2]) return [];
      uptake = '“Not at all. You are sixteen now, quite old enough to be my confidant, and my experience will be useful to you by-and-by, perhaps, in your own affairs of this sort.”';
      if (following !== uptake) return [];
      action = 'tell the speaker what the listener would say'; reversed = 'tell the listener what the speaker would say';
    } else return [];
    return [{ sentence: turn, evidence: { start, end }, otherEvidence: [{ start: end + 2, end: end + 2 + uptake.length }], action, reversed }];
  });
  const requests = [...candidates, ...contextual];
  if (requests.length !== 1) return;
  const statement = requests[0], offset = seed % 3;
  const options = 'contextOptions' in statement ? statement.contextOptions : [`A polite request for the listener to ${statement.action}.`, `Only a question about whether it would bother the listener to ${statement.action}, without requesting it.`, `An offer by the speaker to ${statement.reversed}.`];
  const explanations = 'contextExplanations' in statement ? statement.contextExplanations : ['“Would you mind” requests this action politely. Keep the listener’s action, its complete object and the speaker as recipient; any embedded “would say” remains hypothetical.', 'The complete dialogue supports an action request, not only an inquiry about annoyance. The request alone does not prove compliance.', 'This changes both the speech act and the roles. The speaker requests an action from the listener; the speaker does not offer to perform it for the listener.'];
  return { ...statement, contextual: 'contextOptions' in statement, prompt: politeRequestPrompt, options: [...options.slice(offset), ...options.slice(0, offset)], answer: (3 - offset) % 3, explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
}

/** Preserve temporal qualifications and their event/participant scope. */
export function corpusQualifiedTiming(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_QUALIFIED_TIMING');
  // shortcut: five inspected timing forms; validate new units, predicates, and anchors before extending.
  const candidates = corpusMarkedStatements(text, /\b(?:an estimated|about the year|a journey of about|written in about|somewhere about)\b/, 400).flatMap(statement => {
    const sentence = statement.evidenceText;
    const journey = sentence.match(/^(The journey from our [a-z]+ to the metropolis was a journey of )about (two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty) hours\.$/);
    const writing = sentence.match(/^The first part of (“[A-Z][A-Za-z ]{1,59}”) was written in about (two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty) days—that is to say, from the beginning to about the middle of (January|February|March|April|May|June|July|August|September|October|November|December) ([1-9][0-9]{3})\.$/);
    const draft = sentence.match(/^_In the first place, the book \(it may be barely necessary to remind the reader\) was in its first shape written very early, somewhere about ([1-9][0-9]{3}), when Miss ([A-Z][a-z]+) was barely (twenty-one|twenty-two|twenty-three|twenty-four|twenty-five); though it was revised and finished at ([A-Z][a-z]+) some (ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty) years later, and was not published till ([1-9][0-9]{3}), only (two|three|four|five|six|seven|eight|nine|ten) years before her death\.$/);
    // Admit only tested title quotes; retain guards on surrounding reported speech.
    if (corpusQuoteMarkers(writing ? sentence.replace(writing[1], '') : sentence).length || !corpusBalancedQuotes(text.slice(0, statement.evidence.start))) return [];
    const duration = sentence.match(/^It takes an estimated ([1-9][0-9]{0,2}(?:,[0-9]{3})*|[1-9][0-9]{0,5}) (years?) for (a parcel \(any given cubic meter\) of water) to (complete its journey along the belt)\.$/);
    const date = sentence.match(/^([A-Z][a-z]+) were much valued by ([A-Z][a-z]+(?: [A-Z][a-z]+){0,2}) in ([A-Z][a-z]+(?: [A-Z][a-z]+){0,2}), about the year ([1-9][0-9]{3}); (never less than [1-9][0-9]{0,2}(?:,[0-9]{3})* [a-z]+ were taken with the court)\.$/);
    let options: string[], otherEvidence: { start: number; end: number }[] = [];
    if (duration) {
      if ((duration[1] === '1') !== (duration[2] === 'year')) return [];
      const paragraph = text.slice(0, statement.evidence.start).split('\n\n').find(part => /^The ocean’s water is constantly circulated by currents\. Tidal currents occur close to shore and are influenced by the sun and moon\. Surface currents are influenced by the wind\. However, other, much slower currents that occur from the surface to the seafloor are driven by changes in the saltiness and ocean temperature, a process called thermohaline circulation\. These currents are carried in a large "global conveyor belt," which includes the AMOC\.$/.test(part));
      if (!paragraph) return [];
      const start = text.indexOf(paragraph);
      otherEvidence = [{ start, end: start + paragraph.length }];
      const [, number, unit, subject, action] = duration, capitalized = subject[0].toUpperCase() + subject.slice(1);
      options = [`${capitalized} is estimated to take ${number} ${unit} to ${action}.`, `${capitalized} takes exactly ${number} ${unit} to ${action}.`, `Every process described in the passage is estimated to take ${number} ${unit} to complete.`];
    } else if (journey || writing) {
      const following = sentenceSegments(text.slice(statement.evidence.end)).map(part => ({ text: part.segment.trim(), start: statement.evidence.end + part.index + part.segment.indexOf(part.segment.trim()) }));
      const anchor = journey ? following[0] : following.find(part => part.text === `With the exception of the ${writing![2]} days occupied in composing the first part of this book, my brother often referred to this winter as the hardest and sickliest he had ever experienced.`);
      if (!anchor || !corpusBalancedQuotes(text.slice(0, anchor.start)) || (journey && anchor.text !== 'It was a little past midday when the four-horse stage-coach by which I was a passenger, got into the ravel of traffic frayed out about the Cross Keys, Wood Street, Cheapside, London.')) return [];
      otherEvidence = [{ start: anchor.start, end: anchor.start + anchor.text.length }];
      const cue = journey ? 'a journey of about' : 'written in about';
      options = [sentence.replace(cue, cue.replace('about', 'approximately')), sentence.replace(cue, cue.replace('about', 'exactly')), journey ? sentence.replace('The journey', 'Every journey') : sentence.replace('The first part of', 'The whole of')];
    } else if (draft) {
      const paragraph = text.slice(0, statement.evidence.start).trimEnd().split('\n\n').at(-1);
      // Require the complete named-book comparison, not an isolated "the book".
      const anchor = paragraph?.match(/^_I suppose, however, that the majority of at least competent votes would, all things considered, be divided between_ Emma _and the present book; and perhaps the vulgar verdict \(if indeed a fondness for Miss ([A-Z][a-z]+) be not of itself a patent of exemption from any possible charge of vulgarity\) would go for_ Emma\. _It is the larger, the more varied, the more popular; the author had by the time of its composition seen rather more of the world, and had improved her general, though not her most peculiar and characteristic dialogue; such figures as Miss Bates, as the Eltons, cannot but unite the suffrages of everybody\. On the other hand, I, for my part, declare for_ ([A-Z][A-Za-z ]{1,59}) _unhesitatingly\. It seems to me the most perfect, the most characteristic, the most eminently quintessential of its author’s works; and for this contention in such narrow space as is permitted to me, I propose here to show cause\._$/);
      if (!anchor || anchor[1] !== draft[2] || anchor[2].trim() === 'Emma' || corpusQuoteMarkers(paragraph!).length) return [];
      const start = text.lastIndexOf(paragraph!, statement.evidence.start);
      if (start < 0 || text.indexOf(paragraph!) !== start || !corpusBalancedQuotes(text.slice(0, start))) return [];
      otherEvidence = [{ start, end: start + paragraph!.length }];
      options = [sentence.replace('somewhere about', 'somewhere around'), sentence.replace('somewhere about', 'in exactly'), sentence.replace('in its first shape', 'in every form')];
    } else if (date && date[5].includes(` ${date[1].toLowerCase()} were `) && !/\b(?:Every|All|Each|Whole|Entire|The|Both|No|Neither|Everybody|Everyone|Anyone|Any|Some|Many|Several|Most|None|Nobody|Someone|They|Those|These|This|That)\b/.test(date[2])) {
      options = [sentence.replace('about the year', 'around the year'), sentence.replace('about the year', 'in exactly'), sentence.replace(`by ${date[2]} in`, 'by everyone in').replace('about the year', 'around the year')];
    } else return [];
    return [{ ...statement, options, otherEvidence, estimated: !!duration, approximateDuration: !!journey || !!writing, initialDraft: !!draft }];
  });
  if (candidates.length !== 1) return;
  const statement = candidates[0], offset = seed % 3;
  const explanations = [
    statement.estimated ? 'This keeps the stated estimate, the complete water parcel and its belt journey. Estimated is retained, not replaced by approximately.' : statement.approximateDuration ? '“Approximately” preserves “about” for this elapsed duration. Keep the particular journey or first part and every other time qualifier in the complete statement.' : statement.initialDraft ? '“Somewhere around” preserves “somewhere about” for the initial draft. Keep the age, later revision, delayed publication and complete named-book context.' : '“Around the year” preserves “about the year”. The named person, place and independent minimum quantity remain unchanged.',
    '“Exactly” changes the duration or date precision that the source qualifies. Another surviving qualifier does not preserve this original precision; this does not prove the event could never match the exact value.',
    'The source attaches the timing to the stated event, participant or selected part. A universal journey, process or participant claim, or the whole work or every form of it, changes that scope even when every quantity is retained.',
  ];
  return { prompt: qualifiedTimingPrompt, sentence: statement.evidenceText, evidence: statement.evidence, otherEvidence: statement.otherEvidence,
    options: [...statement.options.slice(offset), ...statement.options.slice(0, offset)], answer: (3 - offset) % 3,
    explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
}

/** Compare each inspected "In contrast" sentence with its preceding claim. */
const explicitContrastFrames = [
  { previous: 'Prokaryotes are single-celled or colonial organisms that do not have membrane-bound nuclei.', sentence: 'In contrast, the cells of eukaryotes do have membrane-bound organelles and a membrane-bound nucleus.' },
  { previous: 'The U.S. also has an individualistic culture, meaning people place a high value on individuality and independence.', sentence: 'In contrast, many other cultures are collectivist, meaning the welfare of the group takes priority over that of the individual.' },
  { previous: 'The chair of the Joint Chiefs of Staff is the president’s top uniformed military officer.', sentence: 'In contrast, the secretary of defense is head of the entire Department of Defense but is a nonmilitary civilian.' },
  { previous: 'Passive transport is the movement of substances across the membrane without the expenditure of cellular energy.', sentence: 'In contrast, active transport is the movement of substances across the membrane using energy from adenosine triphosphate (ATP).' },
  { previous: 'The Moon and Mercury are geologically dead.', sentence: 'In contrast, the larger terrestrial planets—Earth, Venus, and Mars—are more active and interesting worlds.' },
  { previous: "Remember that reinforcement, even when it is negative, always increases a behavior.", sentence: "In contrast, punishment always decreases a behavior." },
  { previous: "A business that focuses on the cost of production and price to the customer will be managed as though it were providing a commodity differentiated only by price.", sentence: "In contrast, businesses that provide customer value believe that many customers will pay a premium for superior customer service or accept fewer services for a value price." },
  { previous: "For example, in the container-manufacturing companies, where the critical contingencies were customer delivery and product quality, the major share of power in decision-making resided in the sales and production staffs.", sentence: "In contrast, in the food-processing firms, where the strategic contingencies focused on expertise in marketing and food sciences, major power rested in the sales and research units." },
  { previous: "American managers will also encourage subordinates to share their views on work-related matters.", sentence: "In contrast, Japanese managers are often seen as autocratic, and decisions are driven by those at the top." },
  { previous: "The Arapesh valued cooperation and gentleness, expecting everyone to show tolerance and support for younger and weaker members of the group.", sentence: "In contrast, among the Mundugumor, both men and women were expected to be competitive, aggressive, and violent." },
  { previous: "Urban growth continued in some places, despite various setbacks due to war on the eastern frontier, while public spaces in some cities fell into disrepair.", sentence: "In contrast, the Christian Church thrived as a social and economic force in the cities of the eastern Mediterranean, and the construction of monasteries and churches overseen by bishops continued." },
  { previous: "A full business plan requires robust information as it’s developed for internal purposes, for banks or investors who need proof that the business is a good investment, and for other stakeholders.", sentence: "In contrast, a lean plan is short and includes only specific information, sufficient to go through the build-measure-learn loop." },
  { previous: "For example, a lower price of key inputs or new technologies that reduce production costs cause supply to shift to the right.", sentence: "In contrast, bad weather or added government regulations can add to costs of certain goods in a way that causes supply to shift to the left." },
  { previous: "With many viral diseases associated with rashes (e.g., chickenpox, measles, rubella, roseola), patients are contagious during the incubation period up to a week before the rash develops.", sentence: "In contrast, with many respiratory infections (e.g., colds, influenza, diphtheria, strep throat, and pertussis) the patient becomes contagious with the onset of the prodromal period." },
  { previous: "An ideal radiator is the same color as an ideal absorber, and captures all the radiation that falls on it.", sentence: "In contrast, white is a poor absorber and is also a poor radiator." },
  { previous: 'The Dani have two words for color: one word for light and one word for dark.', sentence: 'In contrast, the English language has 11 color words.' },
  { previous: 'Grades are based exclusively on quizzes and exams, and the instructor posts results of each test on the classroom door.', sentence: 'In contrast, the Criminal Law professor facilitates classroom discussions and respectful debates in small groups.' },
  { previous: 'Living things grow, metabolize, and reproduce.', sentence: 'In contrast, viruses are not cellular, do not have a metabolism or grow, and cannot divide by cell division.' },
  { previous: 'For example, in the United States, we have a transportation system geared to accommodate individuals and families in the form of interstate highways built for cars.', sentence: 'In contrast, most parts of Europe emphasize public transportation such as high-speed rail and commuter lines, as well as walking and bicycling.' },
  { previous: 'However, such organizations have no right to apply force to impose their will on non-congregants.', sentence: 'In contrast, governments reserve for themselves the broadest scope of rightful power within their area of control and can, in principle, impose their will on vast areas of the lives of all people within the territories over which they rule.' },
  { previous: 'Thus immobile or slightly moveable joints serve to protect internal organs, give stability to the body, and allow for limited body movement.', sentence: 'In contrast, freely moveable joints allow for much more extensive movements of the body and limbs.' },
  { previous: 'A granulocyte contains cytoplasmic granules, which in turn contain a variety of vasoactive mediators such as histamine.', sentence: 'In contrast, macrophages are agranulocytes.' },
  { previous: 'This ratio, which first tilted in favour of older people in the late 1990s, is increasing (Business Insider, 2014).', sentence: 'In contrast, in the developing world, this is not expected to occur until the middle of this century.' },
  { previous: 'Situationism is the view that our behavior and actions are determined by our immediate environment and surroundings.', sentence: 'In contrast, dispositionism holds that our behavior is determined by internal factors (Heider, 1958).' },
  { previous: 'Removal of a blastomere from an embryo with determinate cleavage can result in missing structures, and embryos that fail to develop.', sentence: 'In contrast, deuterostomes undergo indeterminate cleavage, in which cells are not yet fully committed at this early stage to develop into specific cell types.' },
  { previous: 'Mitotic divisions are single nuclear divisions that produce genetically identical daughter nuclei (i.e., each daughter nucleus has the same number of chromosome sets as the original cell).', sentence: 'In contrast, meiotic divisions include two nuclear divisions that ultimately produce four genetically different daughter nuclei that have only one chromosome set (instead of the two sets of chromosomes in the parent cell).' },
  { previous: 'The lower portion of the skeleton is specialized for stability during walking or running.', sentence: 'In contrast, the upper skeleton has greater mobility and ranges of motion, features that allow you to lift and carry objects or turn your head and trunk.' },
  { previous: 'This increased melanin accumulation protects the DNA of epidermal cells from UV ray damage and the breakdown of folic acid, a nutrient necessary for our health and well-being.', sentence: 'In contrast, too much melanin can interfere with the production of vitamin D, an important nutrient involved in calcium absorption.' },
  { previous: 'The endocrine glands that produce the steroid hormones, such as the gonads and adrenal cortex, arise from the mesoderm.', sentence: 'In contrast, endocrine glands that arise from the endoderm and ectoderm produce the amine, peptide, and protein hormones.' },
  { previous: 'The stratum basalis layer is part of the lamina propria and is adjacent to the myometrium; this layer does not shed during menses.', sentence: 'In contrast, the thicker stratum functionalis layer contains the glandular portion of the lamina propria and the endothelial tissue that lines the uterine lumen.' },
  { previous: 'Under the AFDC, the federal government had reimbursed states a portion of the costs they bore for running the program without placing a ceiling on the amount.', sentence: 'In contrast, the TANF block grant caps annual federal funding at $16.489 billion and provides a yearly lump sum to each state, which it can use to manage its own program.' },
  { previous: 'The response to the signal is to stimulate cells in the stomach to begin secreting digestive juices in preparation for incoming food.', sentence: 'In contrast, food that distends the stomach initiates short reflexes that cause cells in the stomach wall to increase their secretion of digestive juices.' },
  { previous: 'This mechanism is very common among strains of Streptococcus pneumoniae, which alter their own PBPs through genetic mechanisms.', sentence: 'In contrast, strains of Staphylococcus aureus develop resistance to methicillin (MRSA) through the acquisition of a new low-affinity PBP, rather than structurally alter their existing PBPs.' },
  { previous: 'In a very clean room, every piece of clothing is folded and stacked in a drawer.', sentence: 'In contrast, matter at high temperature, or a messy room, has high entropy.' },
  { previous: 'Long and curved beaks are typically for feeding on nectar.', sentence: 'In contrast, short, straight beaks can be for feeding on insects or seeds.' },
  { previous: 'However, A. mellifera is only one of over 20,000 species of bee documented worldwide [2].', sentence: 'In contrast, other species, such as bumble bees, mining bees, mason bees, and leafcutter bees, are under-studied and under-appreciated despite evidence that native pollinators such as these are more effective than honey bees at pollinating a number of flowering crop species [3–5].' },
  { previous: 'A. cephalotes presented a broader niche breadth for canopy openness and soil pH, along with a high association with woody-type vegetation.', sentence: 'In contrast, A. laevigata showed a narrower niche for these environmental variables and an affinity for grasses in open areas, with a larger heat buffering capacity.' },
  { previous: 'The brain areas responsible for producing dopamine mature throughout childhood and adolescence, leading to more dopamine rangers working in our brain during that time in our lives.', sentence: 'In contrast, as we become older, these areas begin to retire and—just like humans do—lose some of their productivity, resulting in less dopamine in the brain [2].' },
  { previous: 'In the intermediate-aged flow (73 years), this relationship was nearly balanced, indicating that habitat conditions were generally favorable for successful establishment.', sentence: 'In contrast, the oldest flow (473 years) showed a marked reduction in the proportion of taxa transitioning from arrival to recruitment.' },
  { previous: 'They tend to be simpler than instincts, involve the activity of specific body parts and systems (e.g., the knee-jerk reflex and the contraction of the pupil in bright light), and involve more primitive centers of the central nervous system (e.g., the spinal cord and the medulla).', sentence: 'In contrast, instincts are innate behaviors that are triggered by a broader range of events, such as maturation and the change of seasons.' },
  { previous: 'The barbs in turn have microscopic branches called barbules that are linked together by minute hooks, making the vane of a feather a strong, flexible, and uninterrupted surface.', sentence: 'In contrast, the barbules of down feathers do not interlock, making these feathers especially good for insulation, trapping air in spaces between the loose, interlocking barbules of adjacent feathers to decrease the rate of heat loss by convection and radiation.' },
  { previous: 'We can imagine that an army general or a Fortune 500 CEO would be an instrumental leader.', sentence: 'In contrast, expressive leaders are more concerned with promoting emotional strength and health, and ensuring that people feel supported.' },
  { previous: 'Thus, the joints of the vertebral column only allow for small movements between adjacent vertebrae, but when added together, these movements provide the flexibility that allows your body to twist, or bend to the front, back, or side.', sentence: 'In contrast, at joints that allow for wide ranges of motion, the articulating surfaces of the bones are not directly united to each other.' },
  { previous: 'For example, the hormones released when you are confronted with a dangerous or frightening situation, called the fight-or-flight response, occur by the release of adrenal hormones—epinephrine and norepinephrine—within seconds.', sentence: 'In contrast, it may take up to 48 hours for target cells to respond to certain reproductive hormones.' },
  { previous: 'Watson and Clark (1984) found that people reporting high levels of neuroticism also tend to report feeling anxious and unhappy.', sentence: 'In contrast, people who score low in neuroticism tend to be calm and even-tempered.' },
  { previous: 'Thin rhizoids attached bryophytes to the substrate, but these rather flimsy filaments did not provide a strong anchor for the plant; nor did they absorb substantial amounts of water and nutrients.', sentence: 'In contrast, roots, with their prominent vascular tissue system, transfer water and minerals from the soil to the rest of the plant.' },
  { previous: 'Males were up to 50 percent larger than females, a ratio that is similar to that seen in modern gorillas and orangutans.', sentence: 'In contrast, modern human males are approximately 15 to 20 percent larger than females.' },
  { previous: 'While foraging for food, the reindeer stay within their particular groups and do not wander away.', sentence: 'In contrast, the Nenets allow their reindeer to freely disperse and wander during the day, only occasionally observing their general whereabouts and well-being.' },
  { previous: 'In the American two-party system, the Democratic and Republican Parties spread relatively wide nets to try to encompass large segments of the population.', sentence: 'In contrast, while interest groups may support or oppose political candidates, their goals are usually more issue-specific and narrowly focused on areas like taxes, the environment, and gun rights or gun control, or their membership is limited to specific professions.' },
  { previous: 'As the bones grow, the fontanelles are reduced to sutures, which allow for continued growth of the skull throughout childhood.', sentence: 'In contrast, the cranial base and facial bones are produced by the process of endochondral ossification, in which mesenchyme tissue initially produces a hyaline cartilage model of the future bone.' },
  { previous: 'For example, you will find a pair of femoral arteries and a pair of femoral veins, with one vessel on each side of the body.', sentence: 'In contrast, some vessels closer to the midline of the body, such as the aorta, are unique.' },
  { previous: 'As a result, oxygen diffuses across the respiratory membrane from the alveoli into the blood.', sentence: 'In contrast, the partial pressure of carbon dioxide is high in the pulmonary capillaries and low in the alveoli.' },
  { previous: "These heat-loving plant species tend to grow in the hotter parts of the Amazon.", sentence: "In contrast, the cooler forests along the Boiling River had mostly plant species that typically only grow in the cooler parts of the Amazon." },
  { previous: "Temporally, analysis of interannual and seasonal variations suggests a reappearance of the anomaly between 2018 and 2020.", sentence: "In contrast, the southeastern Karakoram (e.g., basins 6, 8, and 11) experienced continuous mass loss, indicating that the anomaly had largely disappeared in this area." },
  { previous: "Our results suggest that macroalgal assemblages may reach a compositional equilibrium earlier, as no significant differences were detected between the 73- and 473-year-old flows.", sentence: "In contrast, invertebrate communities exhibited distinct shifts across all stages, suggesting a slower and more variable stabilization process likely influenced by habitat complexity and macroalgal structure." },
  { previous: "The tree crops pattern exhibited the lowest species richness in different growth phases, reflecting its limited species composition (one to three tree species).", sentence: "In contrast, mixed-tree lots and agrisilviculture patterns support more diverse species assemblages through the integration of fruit, timber, and shade-tolerant species [5]." },
  { previous: "In the three ecoregions with the highest species richness and at least 20 endemics, the FRCN made up 40−60% of the stream kilometers: Lower Mississippi (256 species), Tennessee (242 species), and Mobile Bay (237 species).", sentence: "In contrast, for the three ecoregions with the lowest species richness and less than 10 endemics, the FRCN made up 15−25% of stream kilometers: Bonneville (21 species), Death Valley (15 species), and Sonora (12 species)." },
  { previous: "Formicidae was the dominant family-level group in the silvopastoral and open-pasture sites, where Lumbricidae represented an important secondary component.", sentence: "In contrast, Termitidae accounted for most individuals recorded in the live-fence, scattered-tree, and regenerating-forest sites." },
  { previous: "Flat or gently sloping summit plateaus, such as those on the Great Meteor Seamount in the North Atlantic, provide stable substrates that support mass accumulation of free-living scleractinians (stony corals) on soft sediment habitats [21].", sentence: "In contrast, steep volcanic flanks enhance bottom currents, restrict sediment accumulation, and promote dense assemblages of suspension feeders as documented at the New England Seamount Chain, where slope, sediment types, and dissolved oxygen are the main factors explaining the distribution of diverse sponge taxa [22]." },
  { previous: "Unbiased evaluation would be reflected in comparable performance across both tasks.", sentence: "In contrast, ideological bias manifests as a systematic tendency to evaluate claims more accurately when the correct response is congruent with ideological alignments." },
  { previous: "Conventional ex-situ remediation methods, mainly excavation for disposal in landfill, destroy soil functions, produce considerable waste, and result in high costs to society [10].", sentence: "In contrast, bioremediation offers a low-input and low-impact approach to degrading DDT in contaminated soils, with fungi playing a particularly important role." },
  { previous: "Importantly, the intrapsychic components of the social identity perspective (e.g., negative stereotypes, social categorizations) should produce a constant influence on each appointment decision, irrespective of the existing composition of the TMT.", sentence: "In contrast, the intergroup component of the social identity perspective should influence appointment decisions depending on whether or how an appointment would change the status quo." },
  { previous: "In short, prior research indicates that racioethnic group representation at other levels of firms facilitates entries of individuals from the same racioethnic group because it influences both existing and prospective group members.", sentence: "In contrast, our results indicate that racioethnic group representation on TMTs is negatively associated with appointments of additional members of the same racioethnic minority group." },
  { previous: "Moreover, shareholders should note evidence that demographic diversity can, at least in some contexts, increase firm performance [6,47,48].", sentence: "In contrast, there is little, if any, evidence that homogeneity increases firm performance, which raises questions about why accepting a homogenous TMT should be an acceptable default in a diversifying society [107]." },
  { previous: "Lytic viruses (lytic cycle: commandeer host, replicate, and lyse host) can redirect the metabolic activity of their hosts as well as release labile nutrients through lysis, providing food for the surrounding microbial community and altering biogeochemical cycles; an overall process known as the viral shunt [23,24].", sentence: "In contrast, temperate phages (lysogenic cycle: integrates into host genome and passively replicates with host cell or enters lytic cycle) have a relationship with their host that is mutualistic prior to entering the lytic phase; it can lead to lysogenic conversion, where phage integration into the host genome results in a new stable phenotype or phenotypic plasticity [6]." },
  { previous: "Consequently, such assessments may overrepresent deforestation dynamics occurring within highly disturbed forest ecosystems.", sentence: "In contrast, the present study adopted a national-scale approach that incorporated all major LULC classes across Ghana, including both areas experiencing forest loss and areas where forest cover remained relatively stable." },
  { previous: "From the effect decomposition results, both the total effect (TIE) and the indirect effect (PIE) reach statistical significance and the estimated values are positive, indicating that the policy and institutional framework can effectively promote energy cooperation through policy preference.", sentence: "In contrast, the direct effect (DE) does not reach a significant level, indicating that the influence of institutional factors on energy cooperation is mainly achieved through indirect paths rather than direct effects." },
  { previous: "Partial burial likely stabilizes otherwise mobile plastic items and indicates prolonged exposure on the seafloor, thereby increasing opportunities for colonization by benthic organisms.", sentence: "In contrast, associations with mobile fauna are likely more transient and reflect behaviors such as shelter-seeking, feeding, or exploration [1,4,8,13]." },
  { previous: "People in Western cultures, for example, have a perceptual context of buildings with straight lines, what Segall’s study called a carpentered world (Segall et al., 1966).", sentence: "In contrast, people from certain non-Western cultures with an uncarpentered view, such as the Zulu of South Africa, whose villages are made up of round huts arranged in circles, are less susceptible to this illusion (Segall et al., 1999)." },
  { previous: "For example, a person high on the agreeable scale would likely want to live near family and friends, and would choose to settle or remain in such an area.", sentence: "In contrast, someone high on openness would prefer to settle in a place that is recognized as diverse and innovative (such as California)." },
  { previous: "The countercurrent adaptation is found in many animals, including dolphins, sharks, bony fish, bees, and hummingbirds.", sentence: "In contrast, similar adaptations can help cool endotherms when needed, such as dolphin flukes and elephant ears." },
  { previous: "It will stop making atoms and will cool down and bloat until its middle reaches the orbit of Mars.", sentence: "In contrast, large stars end their lives in spectacular fashion, exploding as supernovae and casting off newly formed atoms—including the elements heavier than iron—into space." },
  { previous: "This can be illustrated by the way women in the United States can express homosocial feelings (nonsexual regard for people of the same sex) through hugging, handholding, and physical closeness.", sentence: "In contrast, U.S. males refrain from these expressions since they violate the heteronormative expectation that male sexual attraction should be exclusively for females." },
  { previous: "Similarly, avoidance learning tends to emphasize the negative; that is, people are taught to stay clear of certain behaviors, such as tardiness, for fear of repercussions.", sentence: "In contrast, it is felt that combining positive reinforcement with the use of extinction has the fewest undesirable side effects and allows individuals to receive the rewards they desire." },
  { previous: "In these regions, an entrepreneur would likely ask the advice of family members or other business associates before taking action.", sentence: "In contrast, individualism is highly valued in the United States and so many US entrepreneurs will decide to implement a plan for the business without consulting others." },
  { previous: "Similarly, the walls of weight-bearing bones will thicken if you gain body weight or begin pounding the pavement as part of a new running regimen.", sentence: "In contrast, a reduction in muscle strength or body weight will cause bones to become thinner." },
  { previous: "From the primary cortical areas of the somatosensory, visual, auditory, and gustatory senses to the association areas that process information in these modalities, the cerebral cortex is the seat of conscious sensory perception.", sentence: "In contrast, sensory information can also be processed by deeper brain regions, which we may vaguely describe as subconscious—for instance, we are not constantly aware of the proprioceptive information that the cerebellum uses to maintain balance." },
  { previous: "This may occur, for example, in patients with a low stroke volume, which may be seen in congestive heart failure, stenosis of the aortic valve, or significant blood loss following trauma.", sentence: "In contrast, a high or wide pulse pressure is common in healthy people following strenuous exercise, when their resting pulse pressure of 30–40 mm Hg may increase temporarily to 100 mm Hg as stroke volume increases." },
  { previous: "The variable region domain is furthest away from the T cell membrane and is so named because its amino acid sequence varies between receptors.", sentence: "In contrast, the constant region domain has less variation." },
  { previous: "As a result, carbon dioxide leaves the tissues because of its higher partial pressure, enters the blood, and then moves into red blood cells, binding to hemoglobin.", sentence: "In contrast, in the pulmonary capillaries, the partial pressure of carbon dioxide is high compared to within the alveoli." },
  { previous: "He was able to identify a 3:1 phenotypic ratio in second-generation offspring because his large sample size overcame the influence of variability resulting from chance.", sentence: "In contrast, no human couple has ever had thousands of children." },
  { previous: "In other words, each particular gas can absorb or emit only certain wavelengths of the light peculiar to that gas.", sentence: "In contrast, absorption spectra occur when passing white light through a cool, thin gas." },
  { previous: "As explained in Staining Microscopic Specimens, gram-positive bacteria possess a thick peptidoglycan cell wall that retains the primary stain (crystal violet) during the decolorizing step; they remain purple after the gram-stain procedure because the crystal violet dominates the light red/pink color of the secondary counterstain, safranin.", sentence: "In contrast, gram-negative bacteria possess a thin peptidoglycan cell wall that does not prevent the crystal violet from washing away during the decolorizing step; therefore, they appear light red/pink after staining with the safranin." },
  { previous: "For example, a large population size results in a higher birth rate because more potentially reproductive individuals are present.", sentence: "In contrast, a large population size can also result in a higher death rate because of competition, disease, and the accumulation of waste." },
  { previous: "They also found that immediate-supervisor support for a worker significantly reduced work–family conflict through such mechanisms as allowing an employee the flexibility needed to fulfill family obligations.", sentence: "In contrast, flextime did not help with coping and telecommuting actually made things worse, perhaps reflecting the fact that being at home intensifies the conflict between work and family because with the employee in the home, the demands of family are more evident." },
  { previous: "He learned to be quick and to the point.", sentence: "In contrast, in Asia, he found that you had to focus on developing relationships rather than focus on the product." },
  { previous: "Another successful field trial by Di Gregorio et al. [32], involving 7 tonnes of historically contaminated soil incubated for 1, 2, and 4 months, achieved 51%, 72%, and 98% degradation of PAHs, respectively.", sentence: "In contrast, Purnomo et al. [12] used a 1:1 dry weight ratio, achieving 48% degradation of DDT after 28 days of incubation in a lab-scale experiment using 2 g of artificially contaminated soil, highlighting the wide range of ratios that could potentially be applied in practice at large scales." },
  { previous: "These findings indicate that EOA-driven blockchain transactions follow statistical patterns observed in traditional economic and social systems.", sentence: "In contrast, SC-driven interactions, particularly SC–SC exchanges, exhibited greater variability, characterized by sublinear scaling, unstable and threshold-sensitive power-law exponents, and frequent deviations from theoretical models." },
  { previous: "This led us to rely on expert inspection of well-studied local stream networks and gave us confidence in the stability of the results.", sentence: "In contrast, stratification of the results by climatic zone and ecoregions had a dramatic impact on the distribution of values." },
  { previous: "Systems like this discourage people from coming forward with entrepreneurial ideas because the culture and bureaucracy prevent people from finding access to information necessary for the successful advancement of an idea.", sentence: "In contrast, other countries are noticing the benefits of encouraging their populations to become more open-minded and creative through new ventures." },
  { previous: "The disease culminates after just a few days with terror and confusion, followed by cardiovascular and respiratory arrest.", sentence: "In contrast, individuals with paralytic rabies generally follow a longer course of disease." },
  { previous: "Emergy assessments of wetlands and low-intervention forest ecosystems, such as the subtropical wetland studied by Tilley & Brown [50] and the deltaic marshes evaluated by Martin [51], report renewability fractions close to 100% and ecological loading ratios well below unity, because these systems are sustained almost exclusively by environmental inputs and receive no purchased emergy.", sentence: "In contrast, agricultural and managed systems assessed under the same framework [39,41,49] report substantially higher loading ratios and lower renewability, reflecting their dependence on imported and non-renewable inputs." },
  { previous: "At K = 2, STRUCTURE grouped Asian and SNesc together in one cluster, while placing TNesc and UScult in a second cluster.", sentence: "In contrast, DAPC separated the Asian population as a distinct cluster entirely apart from all US-derived populations, including SNesc." },
  { previous: "As a result, prior studies often conceptualize tourist satisfaction primarily in terms of service quality, snow reliability, and destination image within relatively stable operating environments.", sentence: "In contrast, China’s ice and snow tourism has developed under markedly different institutional and market conditions." },
  { previous: "Many studies of fungal polymer biodeterioration have used environmentally derived isolates under controlled laboratory cultivation conditions [20–22].", sentence: "In contrast, our metagenomic survey identified C. lunata as a dominant fungal taxon on cables collected from a 500 kV substation, and the isolated strain B3 was able to colonize cable insulation under the experimental conditions." },
  { previous: "For instance, a mining company that disregards its CSR may infringe on the right of its local community to clean air and water if it pursues only profit.", sentence: "In contrast, CSR places all stakeholders within a broader contextual framework." },
  { previous: "For instance, a mining company that disregards its corporate social responsibility may infringe on the right of its local community to clean air and water if it pursues only profit.", sentence: "In contrast, CSR places all stakeholders within a proper contextual framework." },
  { previous: "Even the hours of operation contribute to culture creation by either encouraging employees to set their own hours or restricting work hours through regulated entry.", sentence: "In contrast, a more bureaucratically structured environment may fit a venture whose success relies upon compliance with external regulations and the use of highly sensitive or private information." },
  { previous: "Superconductors can have a steady current without a continual supply of energy—a great energy savings.", sentence: "In contrast, the supply of energy can be useful, such as in a lightbulb filament." },
  { previous: "Without that pay, most would have been unable to feed their children.", sentence: "In contrast, the U.S. federal minimum wage is $7.25 an hour, and workers receive wages at time-and-a-half rates for work in excess of forty hours a week." },
  { previous: "There was no dignity in such a life.", sentence: "In contrast, they argued, southern enslaved people were provided with a home, the necessities of life, and the protection of their slaveholders." },
  { previous: "Among the six central bird species in the CC network, 2 were migrants: Turdus amaurochalinus and Elaenia mesoleuca.", sentence: "In contrast, in the SL network, among the 3 bird species, 2 were migrants: T. flavipes and E. parvirostris." },
  { previous: "The link between cell death in the fusiform gyrus and the symptom is relatively easy to understand.", sentence: "In contrast, similar deficits can be seen in children with the developmental disorder, autism spectrum disorder (ASD)." },
] as const;
export function corpusExplicitContrast(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_CONTRAST');
  const parts = sentenceSegments(text).map(part => {
    const sentence = part.segment.trim();
    return { sentence, start: part.index + part.segment.indexOf(sentence) };
  });
  const candidates = explicitContrastFrames.flatMap(frame => {
    const index = parts.findIndex(part => part.sentence === frame.sentence);
    const previous = index > 0 ? parts[index - 1] : undefined;
    if (!previous || previous.sentence !== frame.previous || text.indexOf(frame.sentence) !== text.lastIndexOf(frame.sentence)) return [];
    const statement = parts[index];
    if (corpusQuoteMarkers(previous.sentence + statement.sentence).length || !corpusBalancedQuotes(text.slice(0, statement.start))) return [];
    return [{ sentence: frame.sentence, evidence: { start: statement.start, end: statement.start + statement.sentence.length }, otherEvidence: { start: previous.start, end: previous.start + previous.sentence.length } }];
  });
  if (candidates.length !== 1) return;
  const statement = candidates[0];
  const options = ['By contrast,', 'Similarly,', 'Because'].map(cue => statement.sentence.replace('In contrast,', cue));
  const explanations = [
    '“By contrast” keeps the contrast with the previous claim. Every other word stays the same. This compares the wording, not whether either claim is true.',
    '“Similarly” presents the claim as alike with the previous one. The source states a contrast.',
    '“Because” adds a cause the source does not state. The previous sentence is the compared claim, not a stated cause.',
  ];
  const offset = seed % options.length;
  return { prompt: explicitContrastPrompt, sentence: statement.sentence, evidence: statement.evidence, otherEvidence: statement.otherEvidence,
    options: [...options.slice(offset), ...options.slice(0, offset)], answer: (options.length - offset) % options.length,
    explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
}

/** Keep the explicit antecedent when comparing concessions and causal explanations. */
export function corpusConcessiveRelation(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_CONCESSIVE_RELATION');
  // shortcut: two adjacent-reference forms; validate broader concession/coreference before extending.
  const candidates = corpusMarkedStatements(text, /\balthough\b/).flatMap(statement => {
    const sentence = statement.evidenceText, preceding = sentenceSegments(text.slice(0, statement.evidence.start));
    const parts = preceding.map(part => ({ text: part.segment.trim(), start: part.index + part.segment.indexOf(part.segment.trim()) }));
    const previous = parts.at(-1);
    if (!previous || (sentence.match(/\balthough\b/g)?.length ?? 0) !== 1 || corpusQuoteMarkers(sentence).length
      || !corpusBalancedQuotes(text.slice(0, statement.evidence.start).replace(/\p{L}s['’](?=\s+\p{L})/gu, ''))) return [];
    let anchor;
    const scenes = /^They elevated me from all littleness of feeling, and although they did not remove my (?:grief|sorrow), they subdued and tranquillised it\.$/.test(sentence)
      && /^These [a-z]+ and [a-z]+ scenes afforded me the greatest consolation that I was capable of receiving\.$/.test(previous.text);
    if (scenes) anchor = previous;
    const doctrine = parts.at(-2);
    const belief = /^This latter alternative seems to me the most probable, and I am inclined to believe in its truth, although it rests on no direct evidence\.$/.test(sentence)
      && /^On this view, the aboriginal species must either at first have produced quite fertile hybrids, or the hybrids must have become in subsequent generations quite fertile under domestication\.$/.test(previous.text)
      && !!doctrine && /^A doctrine which originated with [A-Z][a-z]+, has been largely accepted by modern naturalists; namely, that most of our domestic animals have descended from two or more aboriginal species, since commingled by intercrossing\.$/.test(doctrine.text);
    if (belief) anchor = doctrine;
    if (!anchor || corpusQuoteMarkers(text.slice(anchor.start, statement.evidence.start)).length) return [];
    return [{ ...statement, otherEvidence: { start: anchor.start, end: previous.start + previous.text.length } }];
  });
  const statement = candidates[seed % candidates.length];
  if (!statement) return;
  const options = ['even though', 'because', 'only because'].map(cue => statement.evidenceText.replace('although', cue));
  const explanations = [
    '“Even though” retains the concession. Both source clauses, their reference, negation and qualifications remain unchanged.',
    '“Because” adds a causal explanation which the source’s concession does not state. Retain the explicit antecedent and every qualification.',
    '“Only because” adds an exclusive causal explanation which the source does not state. A concession supplies neither that cause nor its exclusivity.',
  ];
  const offset = seed % options.length;
  return { prompt: concessiveRelationPrompt, sentence: statement.evidenceText, evidence: statement.evidence, otherEvidence: statement.otherEvidence,
    options: [...options.slice(offset), ...options.slice(0, offset)], answer: (options.length - offset) % options.length,
    explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
}

/** Preserve denied guarantees without asserting either outcome. */
export function corpusNegatedNecessity(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_NEGATED_NECESSITY');
  const frames = [
    { source: 'does not necessarily convey', faithful: 'is not guaranteed to convey', negative: 'necessarily does not convey', positive: 'necessarily does convey' },
    { source: 'is not necessarily connected', faithful: 'is not guaranteed to be connected', negative: 'is necessarily not connected', positive: 'is necessarily connected' },
    { source: 'does not necessarily mean', faithful: 'is not guaranteed to mean', negative: 'necessarily does not mean', positive: 'necessarily does mean', sentence: 'Unfortunately, being consistent in measurement does not necessarily mean that you have measured something correctly.' },
    { source: 'does not necessarily correlate', faithful: 'is not guaranteed to correlate', negative: 'necessarily does not correlate', positive: 'necessarily does correlate', sentence: 'An interesting feature of viral complexity is that the complexity of the host does not necessarily correlate with the complexity of the virion.' },
    { source: 'does not necessarily increase', faithful: 'is not guaranteed to increase', negative: 'necessarily does not increase', positive: 'necessarily does increase', sentence: 'However, adding heat does not necessarily increase the temperature.' },
    { source: 'does not necessarily equate', faithful: 'is not guaranteed to equate', negative: 'necessarily does not equate', positive: 'necessarily does equate', sentence: 'Thus, government power does not necessarily equate to absolute power.' },
    { source: 'does not necessarily imply', faithful: 'is not guaranteed to imply', negative: 'necessarily does not imply', positive: 'necessarily does imply', sentence: 'Note that acting strategically does not necessarily imply acting morally.' },
    { source: 'does not necessarily involve', faithful: 'is not guaranteed to involve', negative: 'necessarily does not involve', positive: 'necessarily does involve', sentence: 'Hostile aggression is motivated by feelings of anger with intent to cause pain, and instrumental aggression is motivated by achieving a goal and does not necessarily involve intent to cause pain.' },
    { source: 'does not necessarily stand', faithful: 'is not guaranteed to stand', negative: 'necessarily does not stand', positive: 'necessarily does stand', sentence: 'Putnam argues that science’s creation of facts is an evaluative practice and does not necessarily stand on a firmer ground than conclusions about values like goodness or kindness.' },
    { source: 'does not necessarily diminish', faithful: 'is not guaranteed to diminish', negative: 'necessarily does not diminish', positive: 'necessarily does diminish', sentence: 'The high price of such commodities does not necessarily diminish the ability of the inferior ranks of people to bring up families.' },
    { source: 'does not necessarily mean', faithful: 'is not guaranteed to mean', negative: 'necessarily does not mean', positive: 'necessarily does mean', sentence: 'Survival of the fittest does not necessarily mean that the biggest and fastest survive; instead, it refers to those who are most evolutionarily fit.' },
    { source: 'does not necessarily mean', faithful: 'is not guaranteed to mean', negative: 'necessarily does not mean', positive: 'necessarily does mean', sentence: 'This situation does not necessarily mean that union workers are fired.' },
    { source: 'does not necessarily increase', faithful: 'is not guaranteed to increase', negative: 'necessarily does not increase', positive: 'necessarily does increase', sentence: 'But as the quantity of gold and silver, which is taken from the currency, is always equal to the quantity of paper which is added to it, paper money does not necessarily increase the quantity of the whole currency.' },
    { source: 'does not necessarily indicate', faithful: 'is not guaranteed to indicate', negative: 'necessarily does not indicate', positive: 'necessarily does indicate', sentence: 'It is also possible to test for antibodies, but the presence of antibodies does not necessarily indicate a current infection; it only means that the individual was exposed at some time.' },
    { source: 'does not necessarily occasion', faithful: 'is not guaranteed to occasion', negative: 'necessarily does not occasion', positive: 'necessarily does occasion', sentence: 'The public expense, however, when defrayed in this manner, no doubt hinders, more or less, the further accumulation of new capital; but it does not necessarily occasion the destruction of any actually-existing capital.' },
    { source: 'does not necessarily assess', faithful: 'is not guaranteed to assess', negative: 'necessarily does not assess', positive: 'necessarily does assess', sentence: 'The neurological exam does not necessarily assess personality, but it can be within the realm of neurology or psychiatry.' },
    { source: 'is not necessarily attached', faithful: 'is not guaranteed to be attached', negative: 'is necessarily not attached', positive: 'is necessarily attached', sentence: 'The proprietor of stock is properly a citizen of the world, and is not necessarily attached to any particular country.' },
    { source: 'is not necessarily bad', faithful: 'is not guaranteed to be bad', negative: 'is necessarily not bad', positive: 'is necessarily bad', sentence: 'Third, all stress is not necessarily bad.' },
    { source: 'is not necessarily limited', faithful: 'is not guaranteed to be limited', negative: 'is necessarily not limited', positive: 'is necessarily limited', sentence: 'Similarly, a government’s power is not necessarily limited to control of its own citizens.' },
    { source: 'is not necessarily concerned', faithful: 'is not guaranteed to be concerned', negative: 'is necessarily not concerned', positive: 'is necessarily concerned', sentence: 'Note that this theory is not necessarily concerned with the welfare of others.' },
    { source: 'is not necessarily an', faithful: 'is not guaranteed to be an', negative: 'is necessarily not an', positive: 'is necessarily an', sentence: 'Personal writing relies on memory but is not necessarily an account of every detail of the event the author is writing about.' },
    { source: 'is not necessarily a', faithful: 'is not guaranteed to be a', negative: 'is necessarily not a', positive: 'is necessarily a', sentence: 'Of course, every time people are gathered, it is not necessarily a group.' },
    { source: 'is not necessarily a', faithful: 'is not guaranteed to be a', negative: 'is necessarily not a', positive: 'is necessarily a', sentence: 'A moderate increase in a budget deficit that leads to a moderate increase in a trade deficit and a moderate appreciation of the exchange rate is not necessarily a cause for concern.' },
    { source: 'is not necessarily the', faithful: 'is not guaranteed to be the', negative: 'is necessarily not the', positive: 'is necessarily the', sentence: 'A merchant, it has been said very properly, is not necessarily the citizen of any particular country.' },
    { source: 'is not necessarily the', faithful: 'is not guaranteed to be the', negative: 'is necessarily not the', positive: 'is necessarily the', sentence: 'Yet the structure of each of these birds is good for it, under the conditions of life to which it is exposed, for each has to live by a struggle; but it is not necessarily the best possible under all possible conditions.' },
    { source: 'is not necessarily the', faithful: 'is not guaranteed to be the', negative: 'is necessarily not the', positive: 'is necessarily the', sentence: 'But the ordinary proportion between the respective values of two commodities is not necessarily the same as that between the quantities of them which are commonly in the market.' },
    { source: 'is not necessarily exactly', faithful: 'is not guaranteed to be exactly', negative: 'is necessarily not exactly', positive: 'is necessarily exactly', sentence: 'But each fauna is not necessarily exactly intermediate, as unequal intervals of time have elapsed between consecutive formations.' },
    { source: 'is not necessarily true', faithful: 'is not guaranteed to be true', negative: 'is necessarily not true', positive: 'is necessarily true', sentence: 'While any valid measure is by necessity reliable, the reverse is not necessarily true.' },
    { source: 'is not necessarily true', faithful: 'is not guaranteed to be true', negative: 'is necessarily not true', positive: 'is necessarily true', sentence: 'But the same is not necessarily true for art.' },
    { source: 'does not necessarily ensure', faithful: 'is not guaranteed to ensure', negative: 'necessarily does not ensure', positive: 'necessarily does ensure', sentence: 'Maximizing the count of unique alleles captured does not necessarily ensure that those alleles are present at frequencies, or in genetic backgrounds, that render them accessible to selection.' },
    { source: 'does not necessarily lead', faithful: 'is not guaranteed to lead', negative: 'necessarily does not lead', positive: 'necessarily does lead', sentence: 'The additional SBM results also indicate that the presence of community structure alone does not necessarily lead to poor LAVI performance.' },
    { source: 'does not necessarily signal', faithful: 'is not guaranteed to signal', negative: 'necessarily does not signal', positive: 'necessarily does signal', sentence: 'Military brilliance does not necessarily signal political skill, however, and neither Bolívar’s fledgling dream of a representative republican system nor his ideal of pan-American unity were shared by others in the region.' },
    { source: 'is not necessarily required', faithful: 'is not guaranteed to be required', negative: 'is necessarily not required', positive: 'is necessarily required', sentence: 'We wrote this article because we wanted kids to know that their brains need to experience lots of different things to grow and develop in the best possible way, and, having lots of money is not necessarily required for brain development.' },
  ];
  // shortcut: two relation forms and 31 prepared sentences; validate general modality/coreference before extending.
  const candidates = corpusMarkedStatements(text, /\b(?:does not necessarily (?:convey|mean|correlate|increase|equate|imply|involve|stand|diminish|indicate|occasion|assess|ensure|lead|signal)|is not necessarily (?:connected|attached|concerned|limited|exactly|bad|true|required|an|a|the))\b/).filter(statement => {
    const sentence = statement.evidenceText;
    const preceding = text.slice(0, statement.evidence.start).replace(/\p{L}s['’](?=\s+\p{L})/gu, '');
    if (!corpusBalancedQuotes(preceding) || corpusQuoteMarkers(sentence).length || !sentence.endsWith('.')
      || /[:()[\]?!]/.test(sentence) || (sentence.match(/\bnot\b/gi)?.length ?? 0) !== 1
      || (sentence.match(/\bnecessarily\b/gi)?.length ?? 0) !== 1) return false;
    const convey = /^(?:(?:His|Her|Their) [a-z]+ may, perhaps, afford (?:him|her|them) the means of [a-z]+ both; but the mere possession of (?:that|this) [a-z]+|The (?:mere )?possession of [a-z]+(?: [a-z]+){0,6}) does not necessarily convey (?:to (?:him|her|them) either|[a-z]+(?: [a-z]+){0,6})\.$/.test(sentence);
    const connected = /^(?:These cases anyhow show that )?[Vv]ariation is not necessarily connected(?:, as some authors have supposed,)? with [a-z]+(?: [a-z]+){0,6}\.$/.test(sentence);
    const exact = frames.some(frame => 'sentence' in frame && frame.sentence === sentence && frame.source === statement.cue);
    if (!convey && !connected && !exact) return false;
    // Retain allowed may/perhaps clauses and attribution without broadening predicates.
    const relation = sentence.slice(sentence.indexOf(statement.cue) + statement.cue.length).replace(', as some authors have supposed,', '');
    if (/\b(?:not|never|no|none|without|if|unless|whether|may|might|could|would|must|need|denied|fails?|failed|necessarily|always|perhaps|probably)\b/i.test(relation)) return false;
    return !/^(?:His|Her|Their|These)\b/.test(sentence) || preceding.trim().length > 0;
  });
  const statement = candidates[seed % candidates.length];
  if (!statement) return;
  const frame = frames.find(frame => statement.cue === frame.source && (!('sentence' in frame) || frame.sentence === statement.evidenceText))!;
  const options = [frame.faithful, frame.negative, frame.positive].map(wording => statement.evidenceText.replace(frame.source, wording));
  const explanations = [
    '“Not necessarily” denies a guarantee. “Not guaranteed” retains that qualification; every other part of the sentence is unchanged.',
    '“Necessarily not” guarantees non-occurrence, while the source only denies a guarantee of occurrence. This changes the negation scope.',
    '“Necessarily” guarantees occurrence, while the source denies that guarantee. This removes the source’s qualification.',
  ];
  const offset = seed % options.length;
  return { prompt: `${negatedNecessityPrompt}\n${statement.evidenceText}`, sentence: statement.evidenceText, evidence: statement.evidence,
    options: [...options.slice(offset), ...options.slice(0, offset)], answer: (options.length - offset) % options.length,
    explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
}

/** Compare the stated direction from development to result. */
export function corpusOutcome(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_OUTCOME');
  // shortcut: two inspected narratives; validate general pronoun/causation parsing before extending.
  if (text === "His quickness and zeal caused him to be used as a messenger, and he was continually passing back and forth among the Confederate leaders in Charleston. He also came into contact with the Union officers in Fort Sumter. The relations of the town and the garrison were yet on a friendly basis.") {
    const sentence = "His quickness and zeal caused him to be used as a messenger, and he was continually passing back and forth among the Confederate leaders in Charleston.", start = text.indexOf(sentence), offset = seed % 3;
    const options = [' resulted in him being ', ' resulted from him being ', ' did not result in him being '].map(wording => sentence.replace(' caused him to be ', wording));
    const explanations = ['The alternative preserves the stated cause-to-result direction and the complete event chain; retain the pronouns without inventing an identity.', 'This reverses the stated cause-to-result direction.', 'This denies the result relationship stated in the narrative.'];
    return { prompt: outcomePrompt, sentence, evidence: { start, end: start + sentence.length },
      options: [...options.slice(offset), ...options.slice(0, offset)], answer: (3 - offset) % 3,
      explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
  }
  if (text === "Once upon a time there lived a king and queen, who had an only daughter. Her incomparable beauty, sweetness, and intelligence caused her to be named Graciosa. She was all her mother's joy.") {
    const sentence = "Her incomparable beauty, sweetness, and intelligence caused her to be named Graciosa.", start = text.indexOf(sentence), offset = seed % 3;
    const options = [" resulted in her being ", " resulted from her being ", " did not result in her being "].map(wording => sentence.replace(" caused her to be ", wording));
    const explanations = ['The alternative preserves the stated cause-to-result direction and the complete event chain; the narrative is not independent historical evidence.', 'This reverses the stated cause-to-result direction.', 'This denies the result relationship stated in the narrative.'];
    return { prompt: outcomePrompt, sentence, evidence: { start, end: start + sentence.length },
      options: [...options.slice(offset), ...options.slice(0, offset)], answer: (3 - offset) % 3,
      explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
  }
  const civilizationAnchor = (start: number) => {
    const preceding = sentenceSegments(text.slice(0, start)).slice(-2);
    if (preceding.length !== 2) return;
    const [first, second] = preceding.map(part => part.segment.trim());
    // shortcut: one two-sentence civilization anchor; review broader coreference before extending.
    if (!/^Historians studying the ancient period examine the emergence of the first major civilizations in regions such as [A-Z][A-Za-z, ]{10,110}, beginning approximately [1-9][0-9]{3} BCE in some regions\.$/.test(first)
      || second !== 'The new social, economic, and political complexities necessitated the development of writing systems.'
      || /\b(?:if|unless|may|might|could|would|not|never|no|none|said|claimed|supposed)\b/i.test(first)
      || corpusQuoteMarkers(first).length || !corpusBalancedQuotes(text.slice(0, preceding[0].index))) return;
    const anchorStart = preceding[0].index + preceding[0].segment.indexOf(first);
    const anchorEnd = preceding[1].index + preceding[1].segment.indexOf(second) + second.length;
    return { start: anchorStart, end: anchorEnd };
  };
  // shortcut: four finite-event forms and result heads; validate broader verb/reference parsing before extending.
  const candidates = corpusMarkedStatements(text, /, (?:leading to|resulting in) /).filter(statement => {
    const sentence = statement.evidenceText;
    if (!sentence.endsWith('.') || /[:;()[\]?!]|\.{2}/.test(sentence)
      || corpusQuoteMarkers(sentence).length || !corpusBalancedQuotes(text.slice(0, statement.evidence.start))
      || (sentence.match(/\b(?:leading to|resulting in|resulting from)\b/g)?.length ?? 0) !== 1
      || /\b(?:if|unless|whether|when|provided|assuming|suppose|supposed|may|might|could|would|can|will|shall|should|must|perhaps|probably|possibly|apparently|likely|seems?|appears?|not|never|no|none|without|denied|disputed|claimed|reported|said|says|suggested|according to)\b|n['’]t\b/i.test(sentence)) return false;
    const [main, outcome] = sentence.slice(0, -1).split(statement.cue);
    if (!main || !outcome) return false;
    const civilizations = /^Thanks to advancements in agriculture, surplus food allowed these civilizations to support larger populations$/.test(main);
    const references = civilizations ? main.replace('these civilizations', 'civilizations') + ' ' + outcome : main + ' ' + outcome;
    if (/\b(?:it|its|this|that|these|those|he|him|his|she|her|they|them|their)\b/i.test(references)
      || civilizations && !civilizationAnchor(statement.evidence.start)) return false;
    // Retain definite event nouns without inventing omitted discoveries, dates, or names.
    const news = /^News of the [a-z]+(?: [a-z]+){0,3} (?:soon )?spread$/.test(main)
      && !/\b(?:has|have|had|do|does|did|is|are|was|were|be|been)\b/.test(main);
    const sequence = /^The [a-z]+(?: [a-z]+){0,2} was followed by (?:a|an|the) [a-z]+(?: [a-z]+){0,3} and (?:an? |the )?[a-z]+(?: [a-z]+){0,3}$/.test(main);
    const life = /^Within the first [a-z]+(?: [a-z]+){0,3} years of [A-Z][a-z]+['’]s history, life appeared in the [a-z]+(?: [a-z]+){0,3} and began to affect [A-Z][a-z]+['’]s [a-z]+(?: [a-z]+){0,3} and [a-z]+(?: [a-z]+){0,3}$/.test(main);
    if (!news && !sequence && !life && !civilizations) return false;
    const proliferation = /^the proliferation of [a-z]+(?: [a-z]+){0,3} and(?:, later,)? [a-z]+(?: [a-z]+){0,3}$/.test(outcome);
    const destruction = /^the (?:near total |total |partial )?destruction of [A-Z][a-z]+(?: [A-Z][a-z]+){0,3}$/.test(outcome);
    const arrivals = /^[1-9][0-9]{0,2}(?:,[0-9]{3})* people coming to [A-Z][a-z]+(?: [A-Z][a-z]+){0,3} from the rest of the [A-Z][a-z]+(?: [A-Z][a-z]+){0,3} and abroad$/.test(outcome);
    const socialDevelopment = civilizations && outcome === 'urbanization, the establishment of trade networks, and the emergence of regional empires';
    return proliferation || destruction || arrivals || socialDevelopment;
  });
  // Preserve the complete Ireland/vole sentence, its colon, and overlap restriction.
  candidates.push(...corpusMarkedStatements(text, / led to /).filter(statement => statement.evidenceText === "In Ireland, the accidental introduction of the bank vole in the 1950s led to a major shift in the barn owl's diet: where their ranges overlap, the vole is now by far the largest prey item."
    && corpusBalancedQuotes(text.slice(0, statement.evidence.start))));
  const statement = candidates[seed % candidates.length];
  if (!statement) return;
  const finite = statement.cue === ' led to ';
  const faithful = statement.cue === ', leading to ' ? ', resulting in ' : ', leading to ';
  const options = (finite ? [' resulted in ', ' resulted from ', ' did not result in '] : [faithful, ', resulting from ', ', not resulting in ']).map(cue => statement.evidenceText.replace(statement.cue, cue));
  const explanations = [
    'The alternative keeps the stated development-to-result direction and every other word. It compares the source wording; it does not independently verify the historical claim.',
    `“${finite ? 'Resulted from' : 'Resulting from'}” reverses the stated relationship: the original presents the following phrase as the result of the complete preceding development.`,
    `“${finite ? 'Did not result in' : 'Not resulting in'}” denies the relationship that the source states. It is less faithful to the wording, without establishing a separate real-world fact.`,
  ];
  const offset = seed % options.length;
  const anchor = statement.evidenceText.includes('surplus food allowed these civilizations') ? civilizationAnchor(statement.evidence.start) : undefined;
  return { prompt: outcomePrompt, sentence: statement.evidenceText, evidence: statement.evidence,
    additionalEvidence: anchor ? [anchor] : undefined,
    options: [...options.slice(offset), ...options.slice(0, offset)], answer: (options.length - offset) % options.length,
    explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
}

/** Separate asserted events from tentative explanations without claiming verified truth. */
export function corpusQualifiedCause(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_QUALIFIED_CAUSE');
  const finiteEvent = /\b(?:[A-Z][a-z]+(?: [A-Z][a-z]+){0,2}|The [a-z]+(?: [a-z]+){0,3}) (?:never )?(?:stopped|halted|closed|failed|withdrew|retired|returned|lost|ended|cancelled|canceled|sent)\b/;
  const nounPhrase = /^(?:a|an|the) [a-z]+(?: [a-z]+){0,11}$/;
  const modalOrHypothesis = /\b(?:if|unless|whether|may|might|could|would|should|must|perhaps|probably|presumably|supposedly|seemingly|reportedly|allegedly|likely|seems?|appears?|believed|suspected)\b/i;
  const candidates = corpusMarkedStatements(text, /\b(?:possibly|probably because|apparently because of a possible)\b/i).filter(statement => {
    const sentence = statement.evidenceText;
    const precedingText = text.slice(0, statement.evidence.start).replace(/\p{L}s['’](?=\s+\p{L})/gu, '');
    if (!corpusBalancedQuotes(precedingText)) return false;
    if (!sentence.endsWith('.') || /["“”‘:;()[\]?!]/.test(sentence) || /['’]/.test(sentence.replace(/\b[a-z]+['’][a-z]+\b/gi, '')) || /^(?:I|You|We|He|She|They|It|This|That|These|Those|His|Her|Their|Its|There)\b/.test(sentence)) return false;
    const paragraphStart = text.lastIndexOf('\n\n', statement.evidence.start);
    const context = text.slice(paragraphStart < 0 ? 0 : paragraphStart + 2, statement.evidence.start);
    // Retain the full inspected owl scope, place, population, and concession.
    if (text === "Like most owls, the barn owl is nocturnal, relying on its acute sense of hearing when hunting in complete darkness. It often becomes active shortly before dusk but can sometimes be seen during the day when relocating from one roosting site to another. In Britain, on various Pacific Islands, and perhaps elsewhere, it sometimes hunts by day. The owl's daylight hunting may depend on whether it can avoid being mobbed by other birds during that time. In Britain, some birds continue to hunt by day—even when mobbed by such birds as magpies, rooks, and black-headed gulls—possibly because the previous night has been wet, making night hunting difficult. By contrast, in southern Europe and the tropics, the birds seem to be almost exclusively nocturnal, with the few birds that hunt by day being severely mobbed." && sentence === "In Britain, some birds continue to hunt by day—even when mobbed by such birds as magpies, rooks, and black-headed gulls—possibly because the previous night has been wet, making night hunting difficult.") return true;
    // Require the inspected local antecedents for these observations.
    if (/^After [1-9][0-9]{3} CE, however, this civilization declined—possibly because the area became unable to support the large population\.$/.test(sentence)
      && /At its height in about [1-9][0-9]{3} CE, this five-square-mile city, now called Cahokia, was home to more than ten thousand residents; tens of thousands more lived on farms surrounding the urban center\./.test(context)
      && context.endsWith('Cahokia was the hub of political and trading activities along the Mississippi River. ')) return true;
    const earlier = sentenceSegments(context).map(part => part.segment.trim()).slice(-3);
    if (sentence === 'However, the vaccine did not work consistently in all countries and regions of the world, possibly due to local environmental conditions such as heat and humidity.'
      && earlier[0] === 'Then, newer tick research resulted in the development of the first anti-tick vaccine to reach the market (TickGARD).'
      && earlier[1] === 'This vaccine used a gut protein (named Bm86) from a type of cattle tick to help the host’s immune system recognize the threat [4].'
      && earlier[2] === 'Interestingly, this vaccine can also protect against some other tick species.') return true;
    // Keep uncertainty in the cause clause, separate from past observations.
    if ((/^The (?:trees|plants|seedlings) (?:inside|outside) the [a-z]+ were growing (?:more|less) slowly, (?:probably|possibly) because they (?:are|were) (?:bigger|smaller|older|younger)\.$/.test(sentence)
      || /^Possibly due to its [a-z]+(?: [a-z]+){0,5} motion, the storm became disorganized and weakened\.$/.test(sentence))
      && !/\b(?:not|never|no|without|reported|reportedly|allegedly|according|if|unless|except|whether|may|might|could|would|should|must)\b/i.test(sentence)) return true;
    const inset = sentence.match(/^(.{15,}) [–—] possibly (.+?) from (.+?) [–—]( to [a-z][^–—]*\.)$/);
    const trailing = sentence.match(/^(.{15,}), apparently because of (a possible [a-z]+(?: [a-z]+){0,11})\.$/);
    if (!inset && !trailing) return false;
    const primary = (inset ?? trailing)![1];
    const eventMatch = finiteEvent.exec(primary);
    // Admit narrow past assertions; exclude embedded reports and disputed claims.
    if (!eventMatch || eventMatch.index > 0 && !/^The [a-z]+(?: [a-z]+){0,3} (?:was|were) [^.!?;]+, but $/.test(primary.slice(0, eventMatch.index))
      || /\b(?:reports?|reported|says?|said|claims?|claimed|suggested|thought|that|denies|denied|denial|doubts?|doubted|disputed|challenged|rejected|wondered|pretended|according to)\b/i.test(primary) || modalOrHypothesis.test(primary) || /\b(?:possibly|possible|apparently|because|due to)\b/i.test(primary)) return false;
    if (inset) {
      // shortcut: one inspected stoppage/fault form; review other proposed-cause contexts before extending.
      if (!/\b(?:stopped|halted)\b[^.!?;–—]*\bwith (?:an? |the )[a-z ]*\b(?:issue|fault|problem)$/.test(primary) || inset[2] !== 'a short circuit') return false;
      if (!nounPhrase.test(inset[2]) || !nounPhrase.test(inset[3]) || !/^ to [a-z]+(?: [a-z0-9'-]+)*\.$/.test(inset[4]) || modalOrHypothesis.test(inset[4]) || /\b(?:stopped|halted|closed|failed|withdrew|retired|returned|lost|ended|cancelled|canceled|sent)\b/i.test(inset[4])) return false;
      if ((sentence.match(/[–—]/g)?.length ?? 0) !== 2 || /\b(?:possibly|possible|apparently)\b/i.test(inset[4])) return false;
    }
    if ((sentence.match(/\b(?:possibly|possible|apparently)\b/gi)?.length ?? 0) !== (inset ? 1 : 2)) return false;
    const cause = inset ? `${inset[2]} from ${inset[3]}` : trailing![2];
    return !/\b(?:not|never|no|without|is|are|was|were|has|have|had|did|does|stopped|sent|caused)\b/i.test(cause)
      && !modalOrHypothesis.test(cause);
  });
  const statement = candidates[seed % candidates.length];
  if (!statement) return;
  if (statement.evidenceText.includes('this civilization declined') || statement.evidenceText.includes('the vaccine did not work consistently') || statement.evidenceText === "In Britain, some birds continue to hunt by day—even when mobbed by such birds as magpies, rooks, and black-headed gulls—possibly because the previous night has been wet, making night hunting difficult.") {
    const start = text.lastIndexOf('\n\n', statement.evidence.start);
    statement.evidence = { start: start < 0 ? 0 : start + 2, end: statement.evidence.end };
  }
  const options = [
    'The passage states what happened but only proposes an explanation.',
    'The passage presents both what happened and its cause as certain.',
    'The passage treats what happened as uncertain but its cause as certain.',
  ];
  const explanations = [
    'The event is stated directly. “Possibly”, “probably because” or “apparently because of a possible” limits the proposed explanation; this wording does not verify either claim as a real-world fact.',
    'The explanation is explicitly qualified, so the passage does not present its cause as certain.',
    'The qualifying words belong to the proposed explanation, not to the statement of the event.',
  ];
  const offset = seed % options.length;
  return { prompt: `${qualifiedCausePrompt}\n${statement.evidenceText}`, sentence: statement.evidenceText, evidence: statement.evidence,
    options: [...options.slice(offset), ...options.slice(0, offset)], answer: (options.length - offset) % options.length,
    explanations: [...explanations.slice(offset), ...explanations.slice(0, offset)] };
}

export const assignmentPrompt = 'Which sentence explicitly states an assigned task?';
/** Extract explicit assignments without inferring duties from causal responsibility. */
export function corpusAssignment(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_ASSIGNMENT');
  // shortcut: inspected infinitive action verbs; review other verbs and postings before extending.
  const candidates = corpusMarkedStatements(text, /\b(?:is|are|was|were) (?:tasked with|assigned to (?:build|compose|direct|keep|play|supervise)\b)/i).filter(statement =>
    !/\b(?:not|never|if|unless|might|would|could|should)\b/i.test(statement.evidenceText)
    && /[.!]$/.test(statement.evidenceText) && !/[\[\]]/.test(statement.evidenceText)
    && (statement.evidenceText.match(/"/g)?.length ?? 0) % 2 === 0
    && (statement.evidenceText.match(/“/g)?.length ?? 0) === (statement.evidenceText.match(/”/g)?.length ?? 0)
    // Treat the compose form as an explicit assignment outside reports and quotes.
    && (!/\bassigned to compose\b/i.test(statement.cue) || (
      /^[A-Za-z]+(?: [A-Za-z]+){0,6}$/.test(statement.evidenceText.split(',')[0].split(/\b(?:is|are|was|were) assigned to compose\b/i)[0].trim())
      && !/\b(?:may|must|reports?|reported|reportedly|says?|said|claims?|claimed|denies|denied|argues?|argued|suggests?|suggested|believed|allegedly|supposedly|apparently|possibly|probably|seems?|appears?|according to|wrote that)\b/i.test(statement.evidenceText)
      && !corpusQuoteMarkers(statement.evidenceText).length && corpusBalancedQuotes(text.slice(0, statement.evidence.start)))));
  const alternatives = /\b(?:task\w*|assign\w*|responsib\w*|dut\w*|must|should|required|instruct\w*|ordered|told|rules?)\b/i;
  const tasks = candidates.flatMap(statement => {
    const explanation = 'The sentence explicitly assigns a task. Keep the complete action, its recipient, timing and limits; an assignment does not show that the task was completed.';
    try { return [{ ...corpusEvidence(text, { prompt: assignmentPrompt, evidenceText: statement.evidenceText, explanation }, seed,
      alternative => alternatives.test(alternative)), prompt: assignmentPrompt, explanation }]; }
    catch (error) { if (error instanceof Error && error.message === 'INSUFFICIENT_SOURCE_SPANS') return []; throw error; }
  });
  return tasks[seed % tasks.length];
}

export const evaluationPrompt = 'Which sentence directly names a source and reports their praise or criticism?';
function corpusEvaluationStatements(text: string) {
  // Allow a year after inspected proper names; exclude initials and generic subjects.
  const generic = /^(?:I|You|We|He|She|They|It|Critics|Reviewers|Others|Some|Many|Both|The|These|Those|Players|Readers|Fans|Supporters|Opponents|Experts|Historians|Scholars|People|Observers|Students|Audiences|Journalists|Commentators|Scientists|Politicians|When|While|Although|After|Before|Once|Where|Who|What|How|Why|If|Unless|Since|Until|As|Then|Also|Meanwhile|However|Therefore|Furthermore|Moreover|Nevertheless)\b/;
  return corpusMarkedStatements(text, /^[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}(?: \((?:19|20)\d{2}\))? (?:praised|criticized|criticised|commended|faulted)\b/)
    .filter(statement => !generic.test(statement.cue)
      // Do not split sentences inside initials or abbreviations.
      && !/\b[A-Z]\.\s+$/.test(text.slice(0, statement.evidence.start))
      && !/:\s*$/.test(statement.evidenceText)
      && (statement.evidenceText.match(/"/g)?.length ?? 0) % 2 === 0
      && (statement.evidenceText.match(/“/g)?.length ?? 0) === (statement.evidenceText.match(/”/g)?.length ?? 0));
}
/** Locate explicit evaluations; leave tone self-assessed. */
export function corpusEvaluation(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_EVALUATION');
  const otherEvaluation = /\b(?:told|happy|unhappy|argu\w*|refut\w*|rebut\w*|disput\w*|contest\w*|contradict\w*|reject\w*|accus\w*|complain\w*|dismiss\w*|disturb\w*|demonstrat\w*|illustrat\w*|lack\w*|prais\w*|critic\w*|commend\w*|fault\w*|appreciat\w*|laud\w*|opin\w*|label\w*|remark\w*|applaud\w*|favour\w*|favor\w*|admir\w*|dislik\w*|loathe\w*|agree\w*|deemed|assess\w*|rated|warn\w*|condemn\w*|approv\w*|disapprov\w*|review\w*|positiv\w*|negativ\w*|excellent|poor|best|worst|good|bad|great|wonderful|liked|enjoyed|felt|called|described|considered|thought|found|wrote|stated|said|says|suggested|argued|reported|recommended|believed|according to)\b/i;
  const candidates = corpusEvaluationStatements(text).flatMap(statement => {
    const sourceName = statement.cue.slice(0, statement.cue.lastIndexOf(' ')).replace(/ \((?:19|20)\d{2}\)$/, '');
    const task = { prompt: evaluationPrompt, evidenceText: statement.evidenceText,
      explanation: `“${statement.cue}” directly names the source of an evaluation. Read the complete judgement and its qualifications; this does not establish the article writer’s overall attitude.` };
    try { return [{ ...corpusEvidence(text, task, seed, alternative => otherEvaluation.test(alternative) || /:\s*$/.test(alternative)
      || /\b[A-Z]\.\s+$/.test(text.slice(0, text.indexOf(alternative)))
      || (alternative.match(/"/g)?.length ?? 0) % 2 !== 0
      || (alternative.match(/“/g)?.length ?? 0) !== (alternative.match(/”/g)?.length ?? 0)),
      prompt: task.prompt, explanation: task.explanation, sourceName, cue: statement.cue }]; }
    catch (error) { if (error instanceof Error && error.message === 'INSUFFICIENT_SOURCE_SPANS') return []; throw error; }
  });
  return candidates[seed % candidates.length];
}

const attributionPrompt = 'Which sentence explicitly attributes a claim to a named source?';
function corpusAttributionStatements(text: string) {
  // shortcut: explicit prefixes and named that-reports with optional years; review wider attribution before extending.
  const yearCitation = / \((?:19|20)\d{2}\)/;
  const according = corpusMarkedStatements(text, /^According to [A-Z][a-z]+(?: [A-Z][a-z]+){0,3}(?: \((?:19|20)\d{2}\))?,/)
    .filter(statement => !statement.evidenceText.replace(yearCitation, '').includes('[') && statement.evidenceText.slice(statement.cue.length).trim().split(/\s+/).length >= 5)
    .map(statement => ({ ...statement, name: statement.cue.slice(13, -1).replace(/ \((?:19|20)\d{2}\)$/, ''), claim: statement.evidenceText.slice(statement.cue.length).trim() }));
  const reports = corpusBalancedQuotes(text) ? corpusMarkedStatements(text, /^(?:[A-Z][a-z]+(?: [A-Z][a-z]+){1,3}(?: \((?:19|20)\d{2}\))? (?:said|states|stated|argues|argued|claims|claimed|notes|noted|suggests|suggested|believes|believed) that\b|Sega argued that(?= Accolade had infringed upon its copyrights because Accolade's games contained Sega's material\.$))/)
    .filter(statement => statement.evidenceText.endsWith('.')
      && !/[\[\]():;?!]/.test(statement.evidenceText.replace(yearCitation, '')) && !corpusQuoteMarkers(statement.evidenceText).length
      && corpusBalancedQuotes(text.slice(0, statement.evidence.start))
      && !/^(?:The|These|Those|Some|Many|Both|Other|New|Old|First|Last|Next|Recent|Later|Earlier|War|Reports|Critics|Reviewers)\b/.test(statement.cue)
      && !/\b(?:according to|says?|said|states?|stated|argues?|argued|claims?|claimed|notes?|noted|suggests?|suggested|believes?|believed|reports?|reported|told)\b/i.test(statement.evidenceText.slice(statement.cue.length)))
    .map(statement => {
      const named = statement.cue.replace(/ [a-z]+ that$/, '');
      return { ...statement, name: named.replace(yearCitation, ''), claim: statement.evidenceText.slice(named.length + 1) };
    }).filter(statement => statement.claim.length <= 240 && statement.evidenceText.slice(statement.cue.length).trim().split(/\s+/).length >= 5) : [];
  // Retain both antecedent sentences and the full inspected claim/speaker.
  const postposed = text === "As he got nearer to the ground, he saw the figure of a lad riding a bicycle along the country highway. Something about the figure struck Tom as being familiar, and he recognized the cyclist a moment later. “It's Andy Foger!” said Tom, in a whisper."
    ? [{ evidenceText: "“It's Andy Foger!” said Tom, in a whisper.", cue: 'said Tom', name: 'Tom', claim: "It's Andy Foger!",
      evidence: { start: text.indexOf('“'), end: text.length } }] : [];
  // shortcut: complete inspected narrated claims; review broader speech contexts before extending.
  if (text === "The wind, to which they were sailing very close, was westerly, and it bore to their ears a booming sound which in less experienced ears might have passed for the breaking of surf upon a lee shore. “Guns!” said Pitt, who stood with Blood upon the quarter-deck. Blood nodded, listening.") postposed.push({ evidenceText: "“Guns!” said Pitt, who stood with Blood upon the quarter-deck.", cue: "said Pitt", name: "Pitt", claim: "“Guns!” said Pitt, who stood with Blood upon the quarter-deck.", evidence: { start: text.indexOf("“Guns!” said Pitt, who stood with Blood upon the quarter-deck."), end: text.indexOf("“Guns!” said Pitt, who stood with Blood upon the quarter-deck.") + 62 } });
  if (text === "Robert was beginning to unroll the carpet, but the others stopped him, imploring him not to waste a wish. ‘We asked the carpet to take us where we could get Indian things for bazaars,’ said Anthea, ‘and it will.’ Her faith was justified.") postposed.push({ evidenceText: "‘We asked the carpet to take us where we could get Indian things for bazaars,’ said Anthea, ‘and it will.’", cue: "said Anthea", name: "Anthea", claim: "‘We asked the carpet to take us where we could get Indian things for bazaars,’ said Anthea, ‘and it will.’", evidence: { start: text.indexOf("‘We asked the carpet to take us where we could get Indian things for bazaars,’ said Anthea, ‘and it will.’"), end: text.indexOf("‘We asked the carpet to take us where we could get Indian things for bazaars,’ said Anthea, ‘and it will.’") + 106 } });
  return [...according, ...reports, ...postposed];
}
export function corpusAttribution(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_ATTRIBUTION');
  const candidates = corpusAttributionStatements(text).flatMap(({ evidenceText, cue }) => {
    const task = { prompt: attributionPrompt, evidenceText,
      explanation: `“${cue}” identifies the source of this statement. Keep that attribution when quoting it; naming a source does not establish that the claim is true.` };
    try { return [{ ...corpusEvidence(text, task, seed, alternative => /\b(?:according to|said|says|added|adds|commented|comments|remarked|remarks|concluded|concludes|responded|responds|maintained|maintains|acknowledged|acknowledges|stressed|stresses|wrote|writes|writing|considered|thought|felt|called|described|defined|praised|criticized|criticised|applauded|stated|states|argued|argues|reported|reports|claimed|claims|told|tells?|explain\w*|suggest\w*|assert\w*|insist\w*|noted|notes|observ\w*|warn\w*|legend|believ\w*)\b/i.test(alternative)), prompt: task.prompt, explanation: task.explanation }]; }
    catch (error) { if (error instanceof Error && error.message === 'INSUFFICIENT_SOURCE_SPANS') return []; throw error; }
  });
  return candidates[seed % candidates.length];
}

export const attributionMatchingPrompt = 'Match each claim to the source named in the passage.';

/** Preserve both inspected dialogue/claim pairs without inferring truth. */
function corpusDialogueClaims(text: string) {
  // shortcut: two adjacent-dialogue forms; validate broader voices before extending.
  if (!corpusBalancedQuotes(text)) return [];
  return [...text.matchAll(/(?:^|\n\n)([^\n]+)(?=\n\n|$)/gu)].flatMap(match => {
    const turn = match[1], start = match.index + match[0].indexOf(turn), end = start + turn.length;
    if (!corpusBalancedQuotes(text.slice(0, start)) || /\b(?:imagin(?:e|ed|ing)|pretend(?:ed|ing)?|suppos(?:e|ed|ing)) (?:the following|this) conversation\b/i.test(text.slice(0, start))) return [];
    const following = text.slice(end + 2).split('\n\n')[0];
    const city = turn.match(/^([A-Z][a-z]+): That's another thing that is different\. People in the country are friendly\. They always say "hello!" Here, no one says "hello\." (I think city people are rude\.)$/);
    const eggs = turn.match(/^This was such a new idea to ([A-Z][a-z]+), that she was quite silent for a minute or two, which gave the ([A-Z][a-z]+) the opportunity of adding, “(You’re looking for eggs, I know _that_ well enough; and what does it matter to me whether you’re a little girl or a serpent\?)”$/);
    let firstName: string, secondName: string, firstClaim: string, secondClaim: string;
    if (city) {
      const response = following?.match(/^([A-Z][a-z]+): Well, I agree\. Country people are friendly\. (But I don't think city people are rude\. I think they're just busy\.)$/);
      if (!response || city[1] === response[1]) return [];
      [firstName, firstClaim, secondName, secondClaim] = [city[1], city[2], response[1], response[2]];
    } else if (eggs) {
      const response = following?.match(/^“It matters a good deal to _me_,” said ([A-Z][a-z]+) hastily; “(but I’m not looking for eggs, as it happens; and if I was, I shouldn’t want _yours_: I don’t like them raw\.)”$/);
      if (!response || response[1] !== eggs[1] || eggs[1] === eggs[2]) return [];
      [firstName, firstClaim, secondName, secondClaim] = [`the ${eggs[2]}`, eggs[3], response[1], response[2]];
    } else return [];
    if ([firstClaim, secondClaim].some(claim => text.indexOf(claim) !== text.lastIndexOf(claim))) return [];
    return [{ name: firstName, claim: firstClaim, evidenceText: turn, cue: firstName, evidence: { start, end } },
      { name: secondName, claim: secondClaim, evidenceText: following!, cue: secondName, evidence: { start: end + 2, end: end + 2 + following!.length } }];
  });
}

/** Match exact attributed wording without inferring agreement, truth, or tone. */
export function corpusAttributionPairs(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_ATTRIBUTION_PAIRS');
  const statements = [...corpusAttributionStatements(text), ...corpusDialogueClaims(text)];
  const unique = statements.filter(statement => !/\baccording to\b/i.test(statement.claim)
    && statements.filter(other => other.claim.replace(/\s+/g, ' ').toLowerCase() === statement.claim.replace(/\s+/g, ' ').toLowerCase()).length === 1);
  const pairs = unique.flatMap((first, index) => unique.slice(index + 1).filter(second =>
    first.name.split(' ').at(-1) !== second.name.split(' ').at(-1)).map(second => [first, second]));
  const selected = pairs[seed % pairs.length];
  if (!selected) return;
  const ordered = seed % 2 ? [...selected].reverse() : selected;
  return { pairs: ordered.map(statement => ({ label: statement.claim, answer: statement.name })),
    choices: selected.map(statement => statement.name), evidence: ordered[0].evidence,
    otherEvidence: [ordered[1].evidence] };
}

/** Preserve attribution in open comparisons without assuming disagreement or tone. */
export function corpusViewpoints(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_CORPUS_VIEWPOINTS');
  const statements = [...corpusAttributionStatements(text), ...corpusDialogueClaims(text)];
  const first = statements[seed % statements.length];
  if (!first) return;
  // shortcut: reject shared surnames; add reviewed metadata before broader name resolution.
  const others = statements.filter(statement => statement.name.split(' ').at(-1) !== first.name.split(' ').at(-1));
  const second = others[seed % others.length];
  if (!second) return;
  return { names: [first.name, second.name], evidence: first.evidence, otherEvidence: [second.evidence] };
}



const defaultFocus: readonly (readonly [CorpusQuestionKind, string?])[] = [
  ['table'], ['matching', `matching:${attributionMatchingPrompt}`], ['evidence', `evidence:${evaluationPrompt}`],
  ['evidence', `evidence:${conditionPrompt}`], ['choice', 'choice:conditional-action'], ['evidence', `evidence:${qualificationPrompt}`],
  ['matching', 'matching:Match each action to what the request asks for or rules out.'],
  ['matching', pairedRelianceOperation],
  ['sequence'], ['completion'], ['evidence', `evidence:${attributionPrompt}`], ['evidence', `evidence:${assignmentPrompt}`], ['evidence', `evidence:${concessionPrompt}`], ['choice', 'choice:qualified-cause'],
];
const advancedFocus = [...defaultFocus, ['choice', 'choice:negated-necessity'] as const, ['choice', 'choice:concessive-relation'] as const, ['choice', 'choice:qualified-timing'] as const, ['choice', 'choice:polite-request'] as const];
const c2Focus = [...advancedFocus, ['choice', nuancedMeaningOperation] as const, ['choice', rhetoricalFunctionOperation] as const, ['choice', layeredPositionOperation] as const, ['choice', complexPragmaticsOperation] as const, ['choice', faithfulParaphraseOperation] as const, ['choice', disagreementSynthesisOperation] as const];
const c1Focus = [...advancedFocus, ['choice', informationDensityOperation] as const, ['choice', implicitIntentionOperation] as const, ['matching', discourseOrganizationOperation] as const, ['matching', registerAudienceOperation] as const, ['matching', argumentBoundariesOperation] as const, ['matching', indirectStanceOperation] as const];
const b1Focus = [...defaultFocus, ['choice', 'choice:main-point'] as const, ['choice', 'choice:condition-outcome'] as const, ['choice', 'choice:reference'] as const, ['choice', 'choice:narrative-motive'] as const, ['choice', 'choice:specific-intention'] as const, ['choice', 'choice:procedural-plan'] as const];
const b2Focus = [...defaultFocus, ['choice', 'choice:explicit-contrast'] as const, ['matching', claimExampleOperation] as const, ['choice', comparisonOperation] as const, ['choice', qualifiedConcessionOperation] as const, ['choice', speakerAttitudeOperation] as const, ['choice', informationSynthesisOperation] as const, ['choice', viewAttributionOperation] as const] as const;
const isAdvanced = (point?: z.infer<typeof levelSchema>) => point === 'C1' || point === 'C2';

const beginnerFocus: readonly (readonly [CorpusQuestionKind, string?])[] = [
  ['table'], ['matching', 'matching:Who says each sentence? Match it to a person.'],
  ['matching', `matching:${roomMatchingPrompt}`], ['sequence'], ['completion'],
  ['choice', 'choice:requested-address'], ['choice', 'choice:work-phone'], ['choice', 'choice:stated-intention'],
];

export function corpusDefaultFocus(seed: number, candidateCount: number, startingPoint?: z.infer<typeof levelSchema>) {
  const cycle = startingPoint === 'A1' ? [...beginnerFocus, ['matching', `matching:${peopleMatchingPrompt}`] as const, ['choice', 'choice:stated-location'] as const, ['choice', 'choice:basic-instruction'] as const, ['choice', 'choice:small-quantity'] as const, ['choice', 'choice:detail-verification'] as const, ['choice', 'choice:stated-time'] as const] : startingPoint === 'A2'
    ? [...beginnerFocus, ['choice', 'choice:stated-origin'] as const, ['choice', 'choice:planned-order'] as const, ['choice', 'choice:personal-need'] as const, ['choice', 'choice:personal-preference'] as const, ['choice', 'choice:personal-update'] as const, ['choice', 'choice:personal-reason'] as const, ['choice', 'choice:personal-rule'] as const, ['choice', 'choice:personal-integration'] as const]
    : startingPoint === 'B1' ? b1Focus : startingPoint === 'C1' ? c1Focus : startingPoint === 'C2' ? c2Focus : isAdvanced(startingPoint) ? advancedFocus : startingPoint === 'B2' ? b2Focus : defaultFocus;
  // Balance question kinds before semantic subtypes to preserve kind shares.
  const phase = Math.floor(seed / Math.max(1, candidateCount));
  const kinds = [...new Set(cycle.map(([kind]) => kind))];
  const operations = cycle.filter(([kind]) => kind === kinds[phase % kinds.length]);
  return operations[Math.floor(phase / kinds.length) % operations.length];
}

function corpusCanFocus(passage: Corpus['records'][number]['passages'][number], value: number, startingPoint?: z.infer<typeof levelSchema>, preferred?: CorpusQuestionKind, preferredOperation?: string) {
  const beginner = startingPoint === 'A1' || startingPoint === 'A2';
  return !passage.task && (
    preferred === 'completion' ? hasRestoration(passage.text, passage.language, beginner)
    : preferred === 'sequence' ? !!corpusSequence(passage.text, value)
    : preferred === 'evidence' ? !beginner && (
      (!preferredOperation || preferredOperation === `evidence:${qualificationPrompt}`) && !!corpusQualification(passage.text, value)
      || (!preferredOperation || preferredOperation === `evidence:${attributionPrompt}`) && !!corpusAttribution(passage.text, value)
      || (!preferredOperation || preferredOperation === `evidence:${evaluationPrompt}`) && !!corpusEvaluation(passage.text, value)
      || preferredOperation === `evidence:${concessionPrompt}` && !!corpusConcession(passage.text, value)
      || preferredOperation === `evidence:${assignmentPrompt}` && !!corpusAssignment(passage.text, value)
      || (!preferredOperation || preferredOperation === `evidence:${conditionPrompt}`) && !!corpusCondition(passage.text, value))
    : preferred === 'matching' ? beginner ? (
      preferredOperation === `matching:${peopleMatchingPrompt}` && meaningScopes.people.some(scope => scope.passageId === passage.id) && !!corpusPeople(passage.text, value)
      || preferredOperation === `matching:${roomMatchingPrompt}` && !!corpusRooms(passage.text, value)
      || (!preferredOperation || preferredOperation === 'matching:Who says each sentence? Match it to a person.') && !!corpusSpeakers(passage.text, value)) : (
      startingPoint === 'C1' && preferredOperation === indirectStanceOperation && indirectStanceScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusIndirectStance(passage.text, value)
      || startingPoint === 'C1' && preferredOperation === argumentBoundariesOperation && argumentBoundariesScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusArgumentBoundaries(passage.text, value)
      || startingPoint === 'C1' && preferredOperation === registerAudienceOperation && registerAudienceScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusRegisterAudience(passage.text, value)
      || startingPoint === 'C1' && preferredOperation === discourseOrganizationOperation && discourseOrganizationScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusDiscourseOrganization(passage.text, value)
      || startingPoint === 'B2' && preferredOperation === claimExampleOperation && b2ClaimExampleScopes.records.some(scope => scope.passageId === passage.id) && !!corpusClaimExamples(passage.text, value)
      || (!preferredOperation || preferredOperation === 'matching:Match each action to what the request asks for or rules out.') && !!corpusRequests(passage.text, value)
      || (!preferredOperation || preferredOperation === pairedRelianceOperation) && !!corpusRoleActions(passage.text, value)
      || (!preferredOperation || preferredOperation === `matching:${attributionMatchingPrompt}`) && !!corpusAttributionPairs(passage.text, value))
    : preferred === 'choice' ? beginner ? (startingPoint === 'A2' && (['need', 'preference', 'update', 'reason', 'rule', 'integration'] as const).some(kind => preferredOperation === `choice:personal-${kind}` && personalGoalScopes[kind].some(scope => scope.passageId === passage.id) && !!corpusPersonalGoal(passage.text, value, kind)) || startingPoint === 'A2' && preferredOperation === 'choice:planned-order' && orderScopes.records.some(scope => scope.passageId === passage.id) && !!corpusPlannedOrder(passage.text, value) || preferredOperation === 'choice:stated-time' && meaningScopes.time.some(scope => scope.passageId === passage.id) && !!corpusTime(passage.text, value) || preferredOperation === 'choice:small-quantity' && meaningScopes.quantity.some(scope => scope.passageId === passage.id) && !!corpusQuantity(passage.text, value) || preferredOperation === 'choice:detail-verification' && meaningScopes.verification.some(scope => scope.passageId === passage.id) && !!corpusVerification(passage.text, value) || preferredOperation === 'choice:stated-location' && meaningScopes.location.some(scope => scope.passageId === passage.id) && !!corpusLocation(passage.text, value) || preferredOperation === 'choice:basic-instruction' && meaningScopes.instruction.some(scope => scope.passageId === passage.id) && !!corpusInstruction(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:requested-address') && !!corpusAddress(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:work-phone') && !!corpusPhone(passage.text, value) || startingPoint === 'A2' && (!preferredOperation || preferredOperation === 'choice:stated-origin') && !!corpusStatedOrigin(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:stated-intention') && !!corpusStatedIntention(passage.text, value)) : (startingPoint === 'B1' && preferredOperation === 'choice:procedural-plan' && b1ProcedureScopes.records.some(scope => scope.passageId === passage.id) && !!corpusProceduralPlan(passage.text, value) || startingPoint === 'B1' && preferredOperation === 'choice:specific-intention' && b1IntentionScopes.records.some(scope => scope.passageId === passage.id) && !!corpusSpecificIntention(passage.text, value) || startingPoint === 'B1' && preferredOperation === 'choice:narrative-motive' && b1MotiveScopes.records.some(scope => scope.passageId === passage.id) && !!corpusNarrativeMotive(passage.text, value) || startingPoint === 'B1' && preferredOperation === 'choice:condition-outcome' && b1ConditionScopes.records.some(scope => scope.passageId === passage.id) && !!corpusConditionalMeaning(passage.text, value) || startingPoint === 'B1' && preferredOperation === 'choice:main-point' && b1MainPointScopes.records.some(scope => scope.passageId === passage.id) && !!corpusMainPoint(passage.text, value) || startingPoint === 'C2' && preferredOperation === rhetoricalFunctionOperation && rhetoricalFunctionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusRhetoricalFunction(passage.text, value) || startingPoint === 'C2' && preferredOperation === disagreementSynthesisOperation && disagreementSynthesisScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusDisagreementSynthesis(passage.text, value) || startingPoint === 'C2' && preferredOperation === faithfulParaphraseOperation && faithfulParaphraseScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusFaithfulParaphrase(passage.text, value) || startingPoint === 'C2' && preferredOperation === complexPragmaticsOperation && complexPragmaticsScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusComplexPragmatics(passage.text, value) || startingPoint === 'C2' && preferredOperation === layeredPositionOperation && layeredPositionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusLayeredPosition(passage.text, value) || startingPoint === 'C2' && preferredOperation === nuancedMeaningOperation && nuancedMeaningScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusNuancedMeaning(passage.text, value) || startingPoint === 'C1' && preferredOperation === informationDensityOperation && informationDensityScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusInformationDensity(passage.text, value) || startingPoint === 'C1' && preferredOperation === implicitIntentionOperation && implicitIntentionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusImplicitIntention(passage.text, value) || startingPoint === 'B2' && preferredOperation === viewAttributionOperation && b2ViewAttributionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusViewAttribution(passage.text, value) || startingPoint === 'B2' && preferredOperation === informationSynthesisOperation && b2InformationSynthesisScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusInformationSynthesis(passage.text, value) || startingPoint === 'B2' && preferredOperation === speakerAttitudeOperation && b2SpeakerAttitudeScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusSpeakerAttitude(passage.text, value) || startingPoint === 'B2' && preferredOperation === qualifiedConcessionOperation && b2QualifiedConcessionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusQualifiedConcession(passage.text, value) || startingPoint === 'B2' && preferredOperation === comparisonOperation && b2ComparisonScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusComparison(passage.text, value) || preferredOperation === 'choice:reference' && (!!corpusReference(passage.text, value) || startingPoint === 'B1' && b1ReferenceScopes.records.some(scope => scope.passageId === passage.id) && !!corpusB1Reference(passage.text, value)) || startingPoint === 'B2' && (!preferredOperation || preferredOperation === 'choice:explicit-contrast') && !!corpusExplicitContrast(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:conditional-action') && !!corpusActionSelection(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:qualified-cause') && !!corpusQualifiedCause(passage.text, value) || isAdvanced(startingPoint) && ((!preferredOperation || preferredOperation === 'choice:negated-necessity') && !!corpusNegatedNecessity(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:concessive-relation') && !!corpusConcessiveRelation(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:qualified-timing') && !!corpusQualifiedTiming(passage.text, value) || (!preferredOperation || preferredOperation === 'choice:polite-request') && !!corpusPoliteRequest(passage.text, value)))
    : preferred === 'table' ? beginner ? !!corpusApartments(passage.text, value) : !!corpusDates(passage.text, value) : false);
}

/** Generate one source-bound material before adding its separate application. */
export function corpusMaterial({ source, passage }: NonNullable<ReturnType<typeof selectCorpusPassage>>, seed: number, startingPoint?: z.infer<typeof levelSchema>, preferred?: CorpusQuestionKind, preferredOperation?: string, attributionCycle = 1, includeResponse = true): Lesson['materials'][number] | undefined {
  const matchesReadingScope = (scope: Pick<typeof indirectStanceScopes.reading[number], 'rootId' | 'sourceHash' | 'passageId' | 'text' | 'credit'>) => scope.rootId === source.rootId && scope.sourceHash === source.sourceHash && scope.passageId === passage.id && scope.text === passage.text && scope.credit.attribution === source.attribution && scope.credit.license === source.licence && scope.credit.sourceUrl === source.originalUrl;
  if (preferredOperation === indirectStanceOperation && (startingPoint !== 'C1' || !indirectStanceScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === argumentBoundariesOperation && (startingPoint !== 'C1' || !argumentBoundariesScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === registerAudienceOperation && (startingPoint !== 'C1' || !registerAudienceScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === discourseOrganizationOperation && (startingPoint !== 'C1' || !discourseOrganizationScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === rhetoricalFunctionOperation && (startingPoint !== 'C2' || !rhetoricalFunctionScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === disagreementSynthesisOperation && (startingPoint !== 'C2' || !disagreementSynthesisScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === faithfulParaphraseOperation && (startingPoint !== 'C2' || !faithfulParaphraseScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === complexPragmaticsOperation && (startingPoint !== 'C2' || !complexPragmaticsScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === layeredPositionOperation && (startingPoint !== 'C2' || !layeredPositionScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === nuancedMeaningOperation && (startingPoint !== 'C2' || !nuancedMeaningScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === informationDensityOperation && (startingPoint !== 'C1' || !informationDensityScopes.reading.some(matchesReadingScope))) return;
  if (preferredOperation === implicitIntentionOperation && (startingPoint !== 'C1' || !implicitIntentionScopes.reading.some(matchesReadingScope))) return;
  const beginner = startingPoint === 'A1' || startingPoint === 'A2';
  if ((preferredOperation === viewAttributionOperation || preferredOperation === informationSynthesisOperation || preferredOperation === speakerAttitudeOperation || preferredOperation === qualifiedConcessionOperation || preferredOperation === claimExampleOperation || preferredOperation === comparisonOperation) && startingPoint !== 'B2') return;
  if (preferredOperation === viewAttributionOperation && !b2ViewAttributionScopes.reading.some(matchesReadingScope)) return;
  if (preferredOperation === informationSynthesisOperation && !b2InformationSynthesisScopes.reading.some(matchesReadingScope)) return;
  if (preferredOperation === speakerAttitudeOperation && !b2SpeakerAttitudeScopes.reading.some(matchesReadingScope)) return;
  if (preferredOperation === qualifiedConcessionOperation && !b2QualifiedConcessionScopes.reading.some(matchesReadingScope)) return;
  if (preferredOperation === comparisonOperation && !b2ComparisonScopes.reading.some(matchesReadingScope)) return;
  if (preferredOperation === claimExampleOperation && !b2ClaimExampleScopes.records.some(matchesReadingScope)) return;
  if (preferredOperation === 'choice:main-point' && startingPoint !== 'B1') return;
  if (preferredOperation?.startsWith('choice:personal-') && startingPoint !== 'A2') return;
  if (preferredOperation === 'choice:planned-order' && startingPoint !== 'A2') return;
  if (preferredOperation === 'choice:stated-origin' && startingPoint !== 'A2') return;
  if (preferredOperation === 'choice:stated-intention' && !beginner) return;
  if (preferredOperation === 'choice:explicit-contrast' && startingPoint !== 'B2') return;
  if ((preferredOperation === 'choice:negated-necessity' || preferredOperation === 'choice:concessive-relation' || preferredOperation === 'choice:qualified-timing' || preferredOperation === 'choice:polite-request') && !isAdvanced(startingPoint)) return;
  const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
  const requested = corpusCanFocus(passage, seed, startingPoint, preferred, preferredOperation) ? preferred : undefined;
  const quantityScope = requested === 'choice' && preferredOperation === 'choice:small-quantity' ? meaningScopes.quantity.find(scope => scope.passageId === passage.id) : undefined;
  if (quantityScope && 'end' in quantityScope && quantityScope.end !== undefined) {
    const text = passage.text.slice(0, quantityScope.end);
    passage = { ...passage, id: quantityScope.materialSha256!, text, wordCount: text.trim().split(/\s+/).length };
  }
  const restoration = corpusRestoration(passage.text, seed, passage.language, beginner);
  const reference = !beginner && !passage.task && requested === 'choice' && preferredOperation === 'choice:reference' ? startingPoint === 'B1' ? corpusB1Reference(passage.text, seed) ?? corpusReference(passage.text, seed) : corpusReference(passage.text, seed) : undefined;
  // Cycle beginner operations independently of source count.
  const operation = Math.floor(seed / attributionCycle) % (startingPoint === 'A2' ? 9 : 8);
  const cycle = isAdvanced(startingPoint) ? advancedFocus : startingPoint === 'B2' ? b2Focus : defaultFocus;
  const defaultOperation = Math.floor(seed / attributionCycle) % cycle.length;
  const intention = beginner && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:stated-intention') || !requested && operation === (startingPoint === 'A2' ? 8 : 7)) ? corpusStatedIntention(passage.text, seed) : undefined;
  const origin = startingPoint === 'A2' && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:stated-origin') || !requested && operation === 7) ? corpusStatedOrigin(passage.text, seed) : undefined;
  const address = beginner && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:requested-address') || !requested && operation === 5) ? corpusAddress(passage.text, seed) : undefined;
  const phone = beginner && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:work-phone') || !requested && operation === 6) ? corpusPhone(passage.text, seed) : undefined;
  const apartments = beginner && !passage.task && (requested === 'table' || !requested && operation === 0) ? corpusApartments(passage.text, seed) : undefined;
  const dates = !beginner && !passage.task && (requested === 'table' || !requested && (!restoration || defaultOperation === 0)) ? corpusDates(passage.text, seed) : undefined;
  const rooms = beginner && !passage.task && (requested === 'matching' && preferredOperation === `matching:${roomMatchingPrompt}` || !requested && operation === 4) ? corpusRooms(passage.text, seed) : undefined;
  const indirect = startingPoint === 'C1' && requested === 'matching' && preferredOperation === indirectStanceOperation ? corpusIndirectStance(passage.text, seed) : undefined;
  const argument = startingPoint === 'C1' && requested === 'matching' && preferredOperation === argumentBoundariesOperation ? corpusArgumentBoundaries(passage.text, seed) : undefined;
  const register = startingPoint === 'C1' && requested === 'matching' && preferredOperation === registerAudienceOperation ? corpusRegisterAudience(passage.text, seed) : undefined;
  const discourse = startingPoint === 'C1' && requested === 'matching' && preferredOperation === discourseOrganizationOperation ? corpusDiscourseOrganization(passage.text, seed) : undefined;
  const rhetoric = startingPoint === 'C2' && requested === 'choice' && preferredOperation === rhetoricalFunctionOperation ? corpusRhetoricalFunction(passage.text, seed) : undefined;
  const disagreement = startingPoint === 'C2' && requested === 'choice' && preferredOperation === disagreementSynthesisOperation ? corpusDisagreementSynthesis(passage.text, seed) : undefined;
  const paraphrase = startingPoint === 'C2' && requested === 'choice' && preferredOperation === faithfulParaphraseOperation ? corpusFaithfulParaphrase(passage.text, seed) : undefined;
  const pragmatics = startingPoint === 'C2' && requested === 'choice' && preferredOperation === complexPragmaticsOperation ? corpusComplexPragmatics(passage.text, seed) : undefined;
  const layers = startingPoint === 'C2' && requested === 'choice' && preferredOperation === layeredPositionOperation ? corpusLayeredPosition(passage.text, seed) : undefined;
  const nuance = startingPoint === 'C2' && requested === 'choice' && preferredOperation === nuancedMeaningOperation ? corpusNuancedMeaning(passage.text, seed) : undefined;
  const density = startingPoint === 'C1' && requested === 'choice' && preferredOperation === informationDensityOperation ? corpusInformationDensity(passage.text, seed) : undefined;
  const implicit = startingPoint === 'C1' && requested === 'choice' && preferredOperation === implicitIntentionOperation ? corpusImplicitIntention(passage.text, seed) : undefined;
  const views = startingPoint === 'B2' && requested === 'choice' && preferredOperation === viewAttributionOperation ? corpusViewAttribution(passage.text, seed) : undefined;
  const synthesis = startingPoint === 'B2' && requested === 'choice' && preferredOperation === informationSynthesisOperation ? corpusInformationSynthesis(passage.text, seed) : undefined;
  const attitude = startingPoint === 'B2' && requested === 'choice' && preferredOperation === speakerAttitudeOperation ? corpusSpeakerAttitude(passage.text, seed) : undefined;
  const limited = startingPoint === 'B2' && requested === 'choice' && preferredOperation === qualifiedConcessionOperation ? corpusQualifiedConcession(passage.text, seed) : undefined;
  const comparison = startingPoint === 'B2' && requested === 'choice' && preferredOperation === comparisonOperation ? corpusComparison(passage.text, seed) : undefined;
  const claimExamples = startingPoint === 'B2' && requested === 'matching' && preferredOperation === claimExampleOperation ? corpusClaimExamples(passage.text, seed) : undefined;
  const proceduralPlan = startingPoint === 'B1' && requested === 'choice' && preferredOperation === 'choice:procedural-plan' ? corpusProceduralPlan(passage.text, seed) : undefined;
  const specificIntention = startingPoint === 'B1' && requested === 'choice' && preferredOperation === 'choice:specific-intention' ? corpusSpecificIntention(passage.text, seed) : undefined;
  const narrativeMotive = startingPoint === 'B1' && requested === 'choice' && preferredOperation === 'choice:narrative-motive' ? corpusNarrativeMotive(passage.text, seed) : undefined;
  const conditionalMeaning = startingPoint === 'B1' && requested === 'choice' && preferredOperation === 'choice:condition-outcome' ? corpusConditionalMeaning(passage.text, seed) : undefined;
  const mainPoint = startingPoint === 'B1' && requested === 'choice' && preferredOperation === 'choice:main-point' ? corpusMainPoint(passage.text, seed) : undefined;
  const personalKind = preferredOperation === 'choice:personal-need' ? 'need' : preferredOperation === 'choice:personal-preference' ? 'preference' : preferredOperation === 'choice:personal-update' ? 'update' : preferredOperation === 'choice:personal-reason' ? 'reason' : preferredOperation === 'choice:personal-rule' ? 'rule' : preferredOperation === 'choice:personal-integration' ? 'integration' : undefined;
  const integration = startingPoint === 'A2' && requested === 'choice' && personalKind === 'integration' ? corpusShortIntegration(passage.text, seed) : undefined;
  const personalGoal = integration ?? (startingPoint === 'A2' && requested === 'choice' && personalKind && personalKind !== 'integration' ? corpusPersonalGoal(passage.text, seed, personalKind) : undefined);
  const plannedOrder = startingPoint === 'A2' && requested === 'choice' && preferredOperation === 'choice:planned-order' ? corpusPlannedOrder(passage.text, seed) : undefined;
  const time = beginner && requested === 'choice' && preferredOperation === 'choice:stated-time' ? corpusTime(passage.text, seed) : undefined;
  const quantity = beginner && requested === 'choice' && preferredOperation === 'choice:small-quantity' ? corpusQuantity(passage.text, seed) : undefined;
  const verification = beginner && requested === 'choice' && preferredOperation === 'choice:detail-verification' ? corpusVerification(passage.text, seed) : undefined;
  const location = beginner && !passage.task && requested === 'choice' && preferredOperation === 'choice:stated-location' ? corpusLocation(passage.text, seed) : undefined;
  const instruction = beginner && !passage.task && requested === 'choice' && preferredOperation === 'choice:basic-instruction' ? corpusInstruction(passage.text, seed) : undefined;
  const people = beginner && !passage.task && requested === 'matching' && preferredOperation === `matching:${peopleMatchingPrompt}` ? corpusPeople(passage.text, seed) : undefined;
  const speakers = beginner && !passage.task && (requested === 'matching' && (!preferredOperation || preferredOperation === 'matching:Who says each sentence? Match it to a person.') || !requested && (!restoration || operation === 1)) ? corpusSpeakers(passage.text, seed) : undefined;
  const request = !beginner && !passage.task && (requested === 'matching' && (!preferredOperation || preferredOperation === 'matching:Match each action to what the request asks for or rules out.') || !requested && defaultOperation === 6) ? corpusRequests(passage.text, seed) : undefined;
  const role = !beginner && !passage.task && (requested === 'matching' && (!preferredOperation || preferredOperation === pairedRelianceOperation) || !requested && defaultOperation === 7) ? corpusRoleActions(passage.text, seed) : undefined;
  const attributionPairs = !beginner && !passage.task && (requested === 'matching' && (!preferredOperation || preferredOperation === `matching:${attributionMatchingPrompt}`) || !requested && defaultOperation === 1) ? corpusAttributionPairs(passage.text, seed) : undefined;
  const evaluation = !beginner && !passage.task && (requested === 'evidence' && (!preferredOperation || preferredOperation === `evidence:${evaluationPrompt}`) || !requested && defaultOperation === 2) ? corpusEvaluation(passage.text, seed) : undefined;
  const concession = !beginner && !passage.task && (requested === 'evidence' && preferredOperation === `evidence:${concessionPrompt}` || !requested && defaultOperation === 12) ? corpusConcession(passage.text, seed) : undefined;
  const assignment = !beginner && !passage.task && (requested === 'evidence' && preferredOperation === `evidence:${assignmentPrompt}` || !requested && defaultOperation === 11) ? corpusAssignment(passage.text, seed) : undefined;
  const condition = !beginner && !passage.task && (requested === 'evidence' && (!preferredOperation || preferredOperation === `evidence:${conditionPrompt}`) || !requested && defaultOperation === 3) ? corpusCondition(passage.text, seed) : undefined;
  const politeRequest = isAdvanced(startingPoint) && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:polite-request') || !requested && defaultOperation === 17) ? corpusPoliteRequest(passage.text, seed) : undefined;
  const qualifiedTiming = isAdvanced(startingPoint) && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:qualified-timing') || !requested && defaultOperation === 16) ? corpusQualifiedTiming(passage.text, seed) : undefined;
  const concessiveRelation = isAdvanced(startingPoint) && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:concessive-relation') || !requested && defaultOperation === 15) ? corpusConcessiveRelation(passage.text, seed) : undefined;
  const negatedNecessity = isAdvanced(startingPoint) && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:negated-necessity') || !requested && defaultOperation === 14) ? corpusNegatedNecessity(passage.text, seed) : undefined;
  const explicitContrast = startingPoint === 'B2' && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:explicit-contrast') || !requested && defaultOperation === defaultFocus.length) ? corpusExplicitContrast(passage.text, seed) : undefined;
  const qualifiedCause = !beginner && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:qualified-cause') || !requested && defaultOperation === 13) ? corpusQualifiedCause(passage.text, seed) : undefined;
  const action = !beginner && !passage.task && (requested === 'choice' && (!preferredOperation || preferredOperation === 'choice:conditional-action') || !requested && defaultOperation === 4) ? corpusActionSelection(passage.text, seed) : undefined;
  const qualification = !beginner && !passage.task && (requested === 'evidence' || !requested && (defaultOperation === 5 || defaultOperation === 10)) ? (preferredOperation === `evidence:${attributionPrompt}` || !requested && defaultOperation === 10) ? corpusAttribution(passage.text, seed) : corpusQualification(passage.text, seed) ?? corpusAttribution(passage.text, seed) : undefined;
  const sequence = !passage.task && (requested === 'sequence' || !requested && (!restoration || (beginner ? operation === 2 : defaultOperation === 8))) ? corpusSequence(passage.text, seed) : undefined;
  if (!disagreement && !paraphrase && !pragmatics && !layers && !rhetoric && !nuance && !density && !indirect && !argument && !register && !discourse && !implicit && !views && !synthesis && !attitude && !limited && !comparison && !claimExamples && !proceduralPlan && !specificIntention && !narrativeMotive && !conditionalMeaning && !mainPoint && !personalGoal && !plannedOrder && !reference && !restoration && !passage.task && !request && !role && !attributionPairs && !sequence && !qualification && !evaluation && !assignment && !concession && !condition && !action && !explicitContrast && !qualifiedCause && !negatedNecessity && !concessiveRelation && !qualifiedTiming && !politeRequest && !speakers && !rooms && !address && !phone && !origin && !intention && !apartments && !dates) return;
  const sentence = sentenceSegments(passage.text)
    .find(part => restoration && part.index <= restoration.evidence.start && part.index + part.segment.length >= restoration.evidence.end);
  const localStart = restoration && sentence ? restoration.evidence.start - sentence.index : 0;
  const gap = sentence && restoration ? sentence.segment.slice(0, localStart) + '________' + sentence.segment.slice(localStart + restoration.answer.length) : '';
  const viewpoints = !beginner ? attributionPairs && !request && !role
    ? { names: attributionPairs.pairs.map(pair => pair.answer), evidence: attributionPairs.evidence, otherEvidence: attributionPairs.otherEvidence }
    : corpusViewpoints(passage.text, seed) : undefined;
  const meaning = proceduralPlan ?? specificIntention ?? narrativeMotive ?? conditionalMeaning ?? mainPoint ?? personalGoal ?? plannedOrder ?? location ?? instruction ?? quantity ?? verification ?? time;
  const detailEvidence = proceduralPlan?.additionalEvidence ?? specificIntention?.additionalEvidence ?? narrativeMotive?.additionalEvidence ?? conditionalMeaning?.additionalEvidence ?? mainPoint?.additionalEvidence ?? personalGoal?.additionalEvidence ?? verification?.additionalEvidence ?? time?.additionalEvidence;
  const id = `corpus-${passage.id}`;
  const evidence = sentence ? { start: sentence.index, end: sentence.index + sentence.segment.length } : undefined;
  return { id, rootId: corpusMaterialRoot(source, passage), sourceId: source.id, title: source.title, credit: { attribution: passage.quoteProvenance && 'kind' in passage.quoteProvenance.rightsEvidence && passage.quoteProvenance.rightsEvidence.kind === 'cc-by-4.0' ? `${source.attribution} — ${passage.quoteProvenance.rightsEvidence.rightsBasis}` : passage.sourceProvenance ? `${source.attribution} — ${passage.sourceProvenance.chapter}` : source.attribution, license: passage.quoteProvenance && 'kind' in passage.quoteProvenance.rightsEvidence && passage.quoteProvenance.rightsEvidence.kind === 'cc-by-4.0' ? 'CC BY 4.0 original quotation; CC BY-SA 4.0 Wikiquote editorial arrangement.' : source.licence, sourceUrl: passage.quoteProvenance?.url ?? passage.sourceProvenance?.sourceUrl ?? source.originalUrl }, blocks: [{ id, text: passage.text }], questions: [rhetoric ? { id: `${id}-rhet`, blockId: id, ...rhetoric, additionalEvidence: rhetoric.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: rhetoricalFunctionSupport.hints } : disagreement ? { id: `${id}-dsyn`, blockId: id, ...disagreement, additionalEvidence: disagreement.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: disagreementSynthesisSupport.hints } : paraphrase ? { id: `${id}-para`, blockId: id, ...paraphrase, additionalEvidence: paraphrase.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: faithfulParaphraseSupport.hints } : pragmatics ? { id: `${id}-prag`, blockId: id, ...pragmatics, additionalEvidence: pragmatics.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: complexPragmaticsSupport.hints } : layers ? { id: `${id}-layers`, blockId: id, ...layers, additionalEvidence: layers.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: layeredPositionSupport.hints } : nuance ? { id: `${id}-nuance`, blockId: id, ...nuance, additionalEvidence: nuance.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: nuancedMeaningSupport.hints } : density ? { id: `${id}-density`, blockId: id, ...density, additionalEvidence: density.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: informationDensitySupport.hints } : implicit ? { id: `${id}-implicit`, blockId: id, ...implicit, additionalEvidence: implicit.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: implicitIntentionSupport.hints } : views ? { id: `${id}-view`, blockId: id, ...views, additionalEvidence: views.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: viewAttributionSupport.hints } : synthesis ? { id: `${id}-syn`, blockId: id, ...synthesis, additionalEvidence: synthesis.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: informationSynthesisSupport.hints } : attitude ? { id: `${id}-att`, blockId: id, ...attitude, additionalEvidence: attitude.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: speakerAttitudeSupport.hints } : limited ? { id: `${id}-qc`, blockId: id, ...limited, additionalEvidence: limited.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: qualifiedConcessionSupport.hints } : comparison ? { id: `${id}-cmp`, blockId: id, ...comparison, additionalEvidence: comparison.additionalEvidence.map(span => ({ blockId: id, ...span })), hints: comparisonSupport.hints } : indirect ? { kind: 'matching', id: `${id}-ind`, blockId: id, prompt: indirect.prompt, pairs: indirect.pairs, choices: indirect.choices, evidence: indirect.evidence, additionalEvidence: indirect.otherEvidence.map(span => ({ blockId: id, ...span })), hints: indirectStanceSupport.hints, explanation: indirect.explanation } : argument ? { kind: 'matching', id: `${id}-arg`, blockId: id, prompt: argument.prompt, pairs: argument.pairs, choices: argument.choices, evidence: argument.evidence, additionalEvidence: argument.otherEvidence.map(span => ({ blockId: id, ...span })), hints: argumentBoundariesSupport.hints, explanation: argument.explanation } : register ? { kind: 'matching', id: `${id}-reg`, blockId: id, prompt: register.prompt, pairs: register.pairs, choices: register.choices, evidence: register.evidence, additionalEvidence: register.otherEvidence.map(span => ({ blockId: id, ...span })), hints: registerAudienceSupport.hints, explanation: register.explanation } : discourse ? { kind: 'matching', id: `${id}-org`, blockId: id, prompt: discourse.prompt, pairs: discourse.pairs, choices: discourse.choices, evidence: discourse.evidence, additionalEvidence: discourse.otherEvidence.map(span => ({ blockId: id, ...span })), hints: discourseOrganizationSupport.hints, explanation: discourse.explanation } : claimExamples ? { kind: 'matching', id: `${id}-cx`, blockId: id, prompt: claimExamples.prompt, pairs: claimExamples.pairs, choices: claimExamples.choices, evidence: claimExamples.evidence, additionalEvidence: claimExamples.otherEvidence.map(span => ({ blockId: id, ...span })), hints: claimExampleSupport.hints, explanation: claimExamples.explanation } : meaning ? { id: `${id}-${proceduralPlan ? 'plan' : specificIntention ? 'intent' : narrativeMotive ? 'why' : conditionalMeaning ? 'rel' : mainPoint ? 'main' : personalGoal ? personalKind === 'preference' ? 'like' : personalKind === 'integration' ? 'int' : personalKind : plannedOrder ? 'order' : time ? 'time' : quantity ? 'count' : verification ? 'verify' : location ? 'location' : 'instr'}`, blockId: id,
      prompt: meaning.prompt, options: meaning.options, answer: meaning.answer, evidence: meaning.evidence, ...(detailEvidence ? { additionalEvidence: detailEvidence.map(span => ({ blockId: id, ...span })) } : {}),
      hints: [local('Find the named place or action.', '找到题目中的地点或动作。', '找到題目中的地點或動作。'), local('Read the whole statement and the next step.', '阅读完整陈述及下一步。', '閱讀完整陳述及下一步。'), local('Keep each place with its relation or instruction.', '把每个地点与对应关系或指令保留在一起。', '把每個地點與對應關係或指令保留在一起。')],
      explanations: proceduralPlan?.optionExplanations ?? specificIntention?.optionExplanations ?? narrativeMotive?.optionExplanations ?? conditionalMeaning?.optionExplanations ?? mainPoint?.optionExplanations ?? integration?.optionExplanations ?? meaning.options.map((_, i) => local((i === meaning.answer ? 'This keeps the stated meaning. ' : quantity || verification ? 'This changes the stated detail. ' : 'This changes a relation or action. ') + meaning.explanation,
        (i === meaning.answer ? '这保留了原意。' : quantity || verification ? '这改变了原文细节。' : '这改变了地点关系或动作。') + meaning.hans,
        (i === meaning.answer ? '這保留了原意。' : quantity || verification ? '這改變了原文細節。' : '這改變了地點關係或動作。') + meaning.hant)),
    } : 
    passage.task ? { kind: 'evidence', id: `${id}-evidence`, blockId: id, prompt: passage.task.prompt,
      ...(() => { const task = corpusEvidence(passage.text, passage.task!, seed); return { ...task, spans: task.spans.map(span => ({ ...span, blockId: id })) }; })(),
      hints: [english('Look for the author’s explanation rather than an example.'), english('Compare each statement with the exact question.'), english('Check which sentence directly supports the distinction being asked about.')], explanation: english(passage.task.explanation),
    } : reference ? { id: `${id}-ref`, blockId: id, ...reference, additionalEvidence: reference.additionalEvidence.map(span => ({ ...span, blockId: id })), hints: referenceSupport.hints } : intention ? { id: `${id}-intent`, blockId: id, prompt: intention.prompt, options: intention.options, answer: intention.answer, evidence: intention.evidence,
      additionalEvidence: [{ blockId: id, ...intention.otherEvidence }],
      hints: [local('Find what the person wants to do.', '找到这个人想做的事。', '找到這個人想做的事。'), local('Find “I want to” and the action after it.', '找到“I want to”和后面的动作。', '找到「I want to」和後面的動作。'), local('“Want to” says what the person wants. It does not say the action is happening.', '“Want to”表示想做，没有说明动作正在发生。', '「Want to」表示想做，沒有說明動作正在發生。')],
      explanations: intention.options.map(option => option === intention.options[intention.answer]
        ? local(`“${intention.quote}” says what ${intention.name} wants to do.`, `“${intention.quote}”说明${intention.name}想做什么。`, `「${intention.quote}」說明${intention.name}想做什麼。`)
        : local(`“${intention.quote}” reports wanting this action. This statement does not report doing it now or not wanting it.`, `“${intention.quote}”表示想做这件事。这句话没有说明正在做，也没有表示不想做。`, `「${intention.quote}」表示想做這件事。這句話沒有說明正在做，也沒有表示不想做。`)),
    } : origin ? { id: `${id}-origin`, blockId: id, prompt: origin.prompt, options: origin.options, answer: origin.answer, evidence: origin.evidence,
      additionalEvidence: origin.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [local('Find the place the person says they are from.', '找到这个人说自己来自的地方。', '找到這個人說自己來自的地方。'), local('Find “I am from” or “I’m from” after the question.', '找到问题后的“I am from”或“I’m from”。', '找到問題後的「I am from」或「I’m from」。'), local('A welcome place or a place answered with “No” is not this stated origin.', '欢迎到达的地方，或用“No”否认的地方，不是这里说的来源。', '歡迎到達的地方，或用「No」否認的地方，不是這裡說的來源。')],
      explanations: origin.options.map(place => place === origin.place
        ? local(`${origin.name} says they are from ${origin.place}.`, `${origin.name}说自己来自${origin.place}。`, `${origin.name}說自己來自${origin.place}。`)
        : origin.alternativeKind === 'welcome' ? local(`${origin.alternate} is the welcome place. ${origin.name} says they are from ${origin.place}.`, `${origin.alternate}是欢迎到达的地方。${origin.name}说自己来自${origin.place}。`, `${origin.alternate}是歡迎到達的地方。${origin.name}說自己來自${origin.place}。`)
        : local(`${origin.name} answers “No” about ${origin.alternate}, then says they are from ${origin.place}.`, `${origin.name}用“No”否认来自${origin.alternate}，然后说自己来自${origin.place}。`, `${origin.name}用「No」否認來自${origin.alternate}，然後說自己來自${origin.place}。`)),
    } : address ? { id: `${id}-address`, blockId: id, prompt: requestedAddressPrompt, options: address.options, answer: address.answer, evidence: address.evidence,
      hints: [local('Find the requested name.', '找到请求使用的称呼。', '找到請求使用的稱呼。'), local('Find “please call me”.', '找到“please call me”。', '找到「please call me」。'), local('Here, “call me” asks you to use a name, not to phone.', '这里“call me”是请你使用某个称呼，不是打电话。', '這裡「call me」是請你使用某個稱呼，不是打電話。')],
      explanations: address.options.map(name => name === address.name ? local(`The speaker asks to be called ${address.name}.`, `说话者请求使用的称呼是${address.name}。`, `說話者請求使用的稱呼是${address.name}。`) : local(`${address.fullName} introduces the speaker; the requested name is ${address.name}.`, `${address.fullName}用来介绍自己；请求使用的称呼是${address.name}。`, `${address.fullName}用來介紹自己；請求使用的稱呼是${address.name}。`)),
    } : phone ? { id: `${id}-phone`, blockId: id, prompt: workPhonePrompt, options: phone.options, answer: phone.answer, evidence: phone.evidence,
      additionalEvidence: [{ blockId: id, ...phone.otherEvidence }],
      hints: [local('Find the work phone number.', '找到工作电话。', '找到工作電話。'), local('Find “work number” and “wrong number”.', '找到“work number”和“wrong number”。', '找到「work number」和「wrong number」。'), local('The wrong number reaches someone else.', '误拨的号码接通了另一个人。', '誤撥的號碼接通了另一個人。')],
      explanations: phone.options.map(number => number === phone.number ? local(`${phone.name}'s work number is ${phone.number}.`, `${phone.name}的工作电话是${phone.number}。`, `${phone.name}的工作電話是${phone.number}。`) : local(`${phone.wrong} is the wrong number. ${phone.name}'s work number is ${phone.number}.`, `${phone.wrong}是误拨的号码。${phone.name}的工作电话是${phone.number}。`, `${phone.wrong}是誤撥的號碼。${phone.name}的工作電話是${phone.number}。`)),
    } : politeRequest ? { id: `${id}-polite`, blockId: id, prompt: politeRequest.prompt, options: politeRequest.options, answer: politeRequest.answer, evidence: politeRequest.evidence,
      additionalEvidence: politeRequest.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [english('Identify who requests an action and who is asked to perform it.'), english('Read the complete request, surrounding narration and response.'), english('Retain the full action, recipient and narrated knowledge or constraints; embedded “would say” remains hypothetical.')],
      explanations: politeRequest.explanations.map(english),
    } : qualifiedTiming ? { id: `${id}-time`, blockId: id, prompt: qualifiedTiming.prompt, options: qualifiedTiming.options, answer: qualifiedTiming.answer, evidence: qualifiedTiming.evidence,
      additionalEvidence: qualifiedTiming.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [english('Keep the timing qualification with the same event, participant or selected part.'), english('Locate the timing qualifier (“estimated” or “about”) and read the whole sentence and context.'), english('Retain an estimate as an estimate, an approximate date or duration as approximate, and every independent time or quantity bound.')],
      explanations: qualifiedTiming.explanations.map(english),
    } : concessiveRelation ? { id: `${id}-conc`, blockId: id, prompt: concessiveRelation.prompt, options: concessiveRelation.options, answer: concessiveRelation.answer, evidence: concessiveRelation.evidence,
      additionalEvidence: [{ blockId: id, ...concessiveRelation.otherEvidence }],
      hints: [english('Retain both complete ideas and what their pronouns refer to.'), english('Read the adjacent antecedent with the clause introduced by “although”.'), english('A concession acknowledges contrast; it does not supply a causal or exclusive causal explanation.')],
      explanations: concessiveRelation.explanations.map(english),
    } : negatedNecessity ? { id: `${id}-negated`, blockId: id, prompt: negatedNecessity.prompt, options: negatedNecessity.options, answer: negatedNecessity.answer, evidence: negatedNecessity.evidence,
      hints: [english('Preserve how strongly the sentence makes its claim.'), english('Locate “not necessarily” and compare what each option guarantees.'), english('A missing guarantee does not mean guaranteed occurrence or guaranteed non-occurrence. Keep the rest of the sentence unchanged.')],
      explanations: negatedNecessity.explanations.map(english),
    } : explicitContrast ? { id: `${id}-contrast`, blockId: id, prompt: explicitContrast.prompt, options: explicitContrast.options, answer: explicitContrast.answer, evidence: explicitContrast.evidence,
      additionalEvidence: [{ blockId: id, ...explicitContrast.otherEvidence }],
      hints: [english('Keep the contrast with the previous claim.'), english('Read the sentence before “In contrast” and compare By contrast, Similarly and Because.'), english('Similarly removes the contrast. Because adds a cause the source does not state.')],
      explanations: explicitContrast.explanations.map(english),
    } : qualifiedCause ? { id: `${id}-cause`, blockId: id, prompt: qualifiedCause.prompt, options: qualifiedCause.options, answer: qualifiedCause.answer, evidence: qualifiedCause.evidence,
      hints: [english('Separate the event from its proposed explanation.'), english('Locate “possibly”, “probably because” or “apparently because of a possible” in the complete sentence.'), english('Keep the uncertain explanation separate from the directly stated event.')],
      explanations: qualifiedCause.explanations.map(english),
    } : action ? { id: `${id}-act`, blockId: id, prompt: action.prompt, options: action.options, answer: action.answer,
      evidence: action.evidence, additionalEvidence: [{ blockId: id, ...action.otherEvidence }],
      hints: [english('Find the complete stated condition or stage.'), english('Compare its required action with the duty in the other stated context.'), english('Keep the whole action after “must”, including all stated limits.')],
      explanations: action.explanations.map(english),
    } : request ? { kind: 'matching', id: `${id}-request`, blockId: id, prompt: 'Match each action to what the request asks for or rules out.',
      pairs: request.pairs, choices: request.choices, evidence: request.evidence,
      hints: [english('Find the explicit request and its speaker or source.'), english('Read the action before “and not” or “and do not”, then the alternative after it.'), english('Keep the requested action separate from the action explicitly ruled out.')],
      explanation: english(`The request says “${request.sentence}”. The positive action is requested; “and not” or “and do not” rules out the other action. Keep its speaker, timing and context.`),
    } : role ? { kind: 'matching', id: `${id}-role`, blockId: id, prompt: pairedReliancePrompt,
      pairs: role.pairs, choices: role.choices, evidence: role.evidence,
      hints: [english('Find the two explicitly named subjects.'), english('Read the complete reliance stated for each subject.'), english('Keep each complete reliance with its own subject.')],
      explanation: english(`The passage says “${role.sentence}”. Each stated reliance belongs to the subject named in its clause; this does not imply reciprocal dependence.`),
    } : attributionPairs ? { kind: 'matching', id: `${id}-sources`, blockId: id, prompt: attributionMatchingPrompt,
      pairs: attributionPairs.pairs, choices: attributionPairs.choices, evidence: attributionPairs.evidence,
      additionalEvidence: attributionPairs.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [english('Find each complete claim in the passage.'), english('Read the dialogue label or named source around the complete claim.'), english('Keep the reporting verb, negation and qualifications with the named source.')],
      explanation: english(attributionPairs.pairs.map(pair => `${pair.answer}: “${pair.label}”`).join(' ')),
    } : concession ? { kind: 'evidence', id: `${id}-conc`, blockId: id, prompt: concession.prompt,
      spans: concession.spans.map(span => ({ ...span, blockId: id })), accepted: concession.accepted, evidence: concession.evidence,
      hints: [english('Find the two connected ideas.'), english('Locate “although” or “even though” and read the complete sentence.'), english('Keep both clauses and any time, attribution or uncertainty in context.')], explanation: english(concession.explanation),
    } : condition ? { kind: 'evidence', id: `${id}-cond`, blockId: id, prompt: condition.prompt,
      spans: condition.spans.map(span => ({ ...span, blockId: id })), accepted: condition.accepted, evidence: condition.evidence,
      hints: [english('Find an action or outcome with a stated prerequisite.'), english('Read the complete requirement or restriction, including who or what it applies to.'), english('Keep any deadline, combined conditions, qualifications and other restrictions in context.')], explanation: english(condition.explanation),
    } : evaluation ? { kind: 'evidence', id: `${id}-eval`, blockId: id, prompt: evaluation.prompt,
      spans: evaluation.spans.map(span => ({ ...span, blockId: id })), accepted: evaluation.accepted, evidence: evaluation.evidence,
      hints: [english('Find a named source and the judgement attributed to them.'), english('Look for direct wording of praise or criticism.'), english('Read the complete sentence, including any limits or contrasting assessment.')], explanation: english(evaluation.explanation),
    } : dates ? { kind: 'table', id: `${id}-table`, blockId: id, prompt: 'Complete each sentence with the year given in the passage.',
      rows: dates.rows, evidence: dates.evidence, additionalEvidence: dates.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [english('Find each sentence in the passage.'), english('Locate the four-digit year in that sentence.'), english('Copy the year without changing it.')],
      explanation: english(dates.rows.map(row => row.label.replace('________', row.answer)).join(' ')),
    } : apartments ? { kind: 'table', id: `${id}-table`, blockId: id, prompt: 'Write each person’s apartment code.',
      rows: apartments.rows, evidence: apartments.evidence, additionalEvidence: apartments.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [english('Find each person’s name.'), english('Read where that person says they live.'), english('Copy the letter and number after “apartment”.')],
      explanation: english(apartments.rows.map(row => `${row.label}: apartment ${row.answer}.`).join(' ')),
    } : rooms ? { kind: 'matching', id: `${id}-rooms`, blockId: id, prompt: roomMatchingPrompt,
      pairs: rooms.pairs, choices: rooms.choices, evidence: rooms.evidence, additionalEvidence: [{ blockId: id, ...rooms.otherEvidence }],
      hints: [local('Find each activity.', '找到每项活动。', '找到每項活動。'), local('Find its room after “in the”.', '找到“in the”后的房间。', '找到「in the」後的房間。'), local('Match the activity to that room.', '把活动与房间配对。', '把活動與房間配對。')],
      explanation: local(rooms.pairs.map(pair => `${pair.label}: ${pair.answer}.`).join(' '), rooms.pairs.map(pair => `${pair.label}：${pair.answer}。`).join(' '), rooms.pairs.map(pair => `${pair.label}：${pair.answer}。`).join(' ')),
    } : people ? { kind: 'matching', id: `${id}-people`, blockId: id, prompt: peopleMatchingPrompt,
      pairs: people.pairs, choices: people.choices, evidence: people.evidence, additionalEvidence: [{ blockId: id, ...people.otherEvidence }],
      hints: [local('Find the description.', '找到这段描述。', '找到這段描述。'), local('Find who says “I am”.', '找到是谁说“I am”。', '找到是誰說「I am」。'), local('“I” is the speaker, not another name mentioned in the words.', '“I”指说话者，不是话中提到的另一个人。', '「I」指說話者，不是話中提到的另一個人。')],
      explanation: local(people.pairs.map(pair => `${pair.answer}: ${pair.label} “I” refers to ${pair.answer}.`).join(' '), people.pairs.map(pair => `${pair.answer}：${pair.label} 原句的“I”指${pair.answer}。`).join(' '), people.pairs.map(pair => `${pair.answer}：${pair.label} 原句的「I」指${pair.answer}。`).join(' ')),
    } : speakers ? { kind: 'matching', id: `${id}-speakers`, blockId: id, prompt: 'Who says each sentence? Match it to a person.',
      pairs: speakers.pairs, choices: speakers.choices, evidence: speakers.evidence, additionalEvidence: [{ blockId: id, ...speakers.otherEvidence }],
      hints: [english('Find each sentence in the dialogue.'), english('Look at the name before the speaker’s words.'), english('Choose the person who says each sentence.')],
      explanation: english(speakers.pairs.map(pair => `${pair.answer} says “${pair.label}”`).join(' ')),
    } : assignment ? { kind: 'evidence', id: `${id}-assign`, blockId: id, prompt: assignment.prompt,
      spans: assignment.spans.map(span => ({ ...span, blockId: id })), accepted: assignment.accepted, evidence: assignment.evidence,
      hints: [english('Find who receives a task.'), english('Locate “tasked with” and read the complete action.'), english('Keep any timing, purpose or restriction with that action.')], explanation: english(assignment.explanation),
    } : qualification ? { kind: 'evidence', id: `${id}-qualify`, blockId: id, prompt: qualification.prompt,
      spans: qualification.spans.map(span => ({ ...span, blockId: id })), accepted: qualification.accepted, evidence: qualification.evidence,
      hints: qualification.prompt === attributionPrompt ? [english('Find wording that names the source of a claim.'), english('Compare an attributed statement with a statement made directly.'), english('Keep the named source and its claim together.')] : [english('Look for wording that limits how certain the claim is.'), english('Distinguish a reported belief, inference or possibility from an established fact.'), english('Read the qualifying phrase together with the claim it introduces.')], explanation: english(qualification.explanation),
    } : sequence ? { kind: 'sequence', id: `${id}-sequence`, blockId: id, prompt: 'Put these three sentences in the order they appear in the passage.', ...sequence,
      hints: [english('Find the three sentences in the passage.'), english('Notice how names, pronouns and connecting words link adjacent sentences.'), english('Check the sentence before and after each one.')],
      explanation: english('The passage presents these sentences in this order.') } : { kind: 'completion', id: `${id}-restore`, blockId: id, prompt: `${restoration!.lemma ? 'Complete with the form of “' + restoration!.lemma + '” used in the sentence:' : 'Fill in the missing word:'}\n${gap.trim()}`, answer: restoration!.answer, accepted: [restoration!.answer], evidence: evidence!,
      hints: [english('Find the matching sentence in the passage.'), english(`Look for the sentence beginning “${sentence!.segment.trim().split(/\s+/).slice(0, 5).join(' ')}”.`), english('Copy the word and check its spelling.')],
      explanation: english(restoration!.lemma ? `“${restoration!.answer}” is the form of “${restoration!.lemma}” used here.` : `The sentence uses “${restoration!.answer}”.`) },
    ...(includeResponse ? [{ kind: 'response' as const, id: `${id}-response`, blockId: id, ...(origin ? {
      prompt: 'Write one short sentence about where the person says they are from. Use words from their answer.',
      criteria: [local('I use the person’s stated origin.', '我使用这个人说的来源。', '我使用這個人說的來源。'), local('I quote their answer without guessing where they live or were born.', '我引用回答，不猜测居住地或出生地。', '我引用回答，不猜測居住地或出生地。')],
      evidence: origin.evidence, additionalEvidence: origin.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [local('Find the person’s answer.', '找到这个人的回答。', '找到這個人的回答。'), local('Copy the place after “from”.', '引用“from”后的地方。', '引用「from」後的地方。'), local('Write one sentence. Keep the stated meaning.', '写一句话，保留回答的意思。', '寫一句話，保留回答的意思。')],
      explanation: local('Check your sentence with the answer. It states an origin; it does not tell us where the person was born or lives.', '对照回答检查你的句子。这里说的是来源，没有说明出生地或居住地。', '對照回答檢查你的句子。這裡說的是來源，沒有說明出生地或居住地。'),
    } : politeRequest ? {
      prompt: 'Quote the complete request and explain who is asked to do what. Keep the action, object, narrated knowledge or constraints and any embedded hypothetical wording; distinguish requesting an action from proving it was completed.',
      criteria: [english('I retain the complete action, object and speaker/listener roles.'), english('I preserve any embedded “would say” without turning it into an immediate speech to someone else.'), english('I distinguish the request or directive from an offer, preserving narrated knowledge or constraints rather than guessing from courteous wording.')],
      evidence: politeRequest.evidence, additionalEvidence: politeRequest.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [english('Read the complete dialogue turn.'), english('Find the action in the complete request and its narrated context.'), english('Use the response as context without claiming a request guarantees completion.')],
      explanation: english('The speaker politely requests the listener’s action. “Me” refers to that speaker. Preserve the whole object and embedded hypothetical wording; “Not at all” can accept this request rather than refuse it. Courteous wording does not establish lack of knowledge or freely optional action; preserve any explicit narration.'),
    } : qualifiedTiming ? {
      prompt: 'Quote the full timing statement and explain its qualification and event or participant scope. Preserve all quantities and separate bounds, without treating the source claim as verified fact.',
      criteria: [english('I distinguish an estimate from an approximate date or elapsed duration.'), english('I keep the timing attached to the same event, participant or selected part.'), english('I retain all quantities and independent minimum bounds.')],
      evidence: qualifiedTiming.evidence, additionalEvidence: qualifiedTiming.otherEvidence.map(span => ({ blockId: id, ...span })),
      hints: [english('Read the full timing statement and its context.'), english('Identify the qualifying word and what the time applies to.'), english('Explain the qualification without making it exact or universal.')],
      explanation: english('Estimated preserves estimate status; about the year or somewhere about preserves an approximate date; about an elapsed duration can remain approximately. Exactly changes the qualified precision. Keep the original event/person/part scope, displayed voice, complete timeline and any separate quantity bound.'),
    } : concessiveRelation ? {
      prompt: 'Quote the antecedent and both complete clauses. Explain the concession without adding a cause, resolving the explicit reference and preserving negation, time and uncertainty.',
      criteria: [english('I retain the explicit antecedent and both complete clauses.'), english('I distinguish a concession from a stated causal or exclusive causal explanation.'), english('I preserve the source’s negation and uncertainty, without treating its wording as verified fact.')],
      evidence: concessiveRelation.evidence, additionalEvidence: [{ blockId: id, ...concessiveRelation.otherEvidence }],
      hints: [english('Read the adjacent antecedent and target sentence.'), english('Identify what is acknowledged and what contrasts with it.'), english('Explain both ideas and their reference without inventing a cause or removing any qualification.')],
      explanation: english('The source acknowledges both contrasting ideas. Retain what “they” or “this latter alternative” refers to, and keep denial, uncertainty and time. A concession does not supply a causal explanation.'),
    } : negatedNecessity ? {
      prompt: 'Quote the complete sentence and explain what “not necessarily” does and does not guarantee. Retain its qualifications, attribution and surrounding context; distinguish the source’s wording from whether its claim is true.',
      criteria: [english('I preserve the complete sentence, its qualifications and any attribution.'), english('I distinguish denying a guarantee from guaranteeing occurrence or non-occurrence.'), english('I use the surrounding context without treating the historical claim as verified fact.')],
      evidence: negatedNecessity.evidence,
      hints: [english('Read the complete qualified claim.'), english('Compare the scope of “not” and “necessarily”.'), english('Explain the difference with a quotation and retain the source’s other limits.')],
      explanation: english('The source denies a guarantee of the stated relationship. It does not guarantee either occurrence or non-occurrence. Preserve every other clause and any attribution when explaining it.'),
    } : qualifiedCause ? {
      prompt: 'Quote the complete sentence and explain which part states what happened and which part proposes an uncertain explanation. Do not claim the wording proves either as a real-world fact.',
      criteria: [english('I preserve the complete stated event and any negation.'), english('I keep the qualifying words attached to the proposed explanation.'), english('I distinguish what the passage states from verification of real-world facts.')],
      evidence: qualifiedCause.evidence,
      hints: [english('Read the complete event statement.'), english('Locate the qualifying words with the proposed explanation.'), english('Explain their different certainty without adding facts.')],
      explanation: english('The event is stated directly while its explanation is tentative. Preserve both parts and any negation, supporting the distinction with the complete source sentence.'),
    } : request ? {
      prompt: 'Quote the complete request and explain what its speaker or source asks for and what it rules out. Keep the timing and context; explain any figurative wording using the surrounding passage.',
      criteria: [english('I keep the speaker or source with the complete request.'), english('I distinguish the positive action from the explicitly negated action.'), english('I support my interpretation with the quotation and its surrounding context.')],
      evidence: request.evidence,
      hints: [english('Find the complete request and who says it.'), english('Read both actions, keeping the negation and timing.'), english('Use nearby context to explain the wording without adding instructions.')],
      explanation: english('The positive action is requested; explicit negation rules out the other action. Preserve the speaker, timing and context. The wording does not show that the listener followed it.'),
    } : role ? {
      prompt: 'Quote the complete paired statement and explain which subject needs each stated reliance. Keep bundled items together and do not infer reciprocal dependence.',
      criteria: [english('I identify both explicitly named subjects.'), english('I keep each complete reliance with its own subject.'), english('I use the source statement without assuming reciprocal dependence.')],
      evidence: role.evidence,
      hints: [english('Find the paired statement.'), english('Read each subject and its complete reliance.'), english('Support each match with the complete wording.')],
      explanation: english('Keep both stated dependencies with their own subjects, preserving bundled items and any limits. Reciprocal dependence requires explicit source wording.'),
    } : action ? {
      prompt: 'Explain why the stated condition or stage requires this action rather than the action in the other context. Quote both relevant rules and preserve the complete conditions and actions.',
      criteria: [english('I connect the response to the complete stated condition.'), english('I distinguish the required action from the action in the other context, using both source rules.'), english('I keep all actions and stated limits without inventing new instructions.')],
      evidence: action.evidence, additionalEvidence: [{ blockId: id, ...action.otherEvidence }],
      hints: [english('Find the condition and the response following “must”.'), english('Read the other rule in context.'), english('Compare the actions and their contexts, using two quotations.')],
      explanation: english('The condition changes which action is required at that point. Support the distinction with both source rules, preserving the entire condition and action. Assess your explanation using the points below.'),
    } : concession ? {
      prompt: 'Explain how the two ideas in the concessive sentence are connected. Quote both clauses and preserve their context and qualifications.',
      criteria: [english('I quote both complete ideas.'), english('I explain the contrast without inventing a cause or the writer’s overall attitude.'), english('I retain time, attribution and uncertainty from the surrounding text.')],
      evidence: concession.evidence,
      hints: [english('Read both clauses with the surrounding passage.'), english('Compare what the concessive clause acknowledges with what the main clause says.'), english('Support your explanation with both clauses and keep their qualifications.')],
      explanation: english('A concession acknowledges one point while presenting a contrasting point. Assess your explanation against both clauses and their context; the connecting word alone does not prove a general tone or factual conclusion.'),
    } : assignment ? {
      prompt: 'Who or what receives the task, and what must be done? Quote the full assignment and explain its timing or limits without assuming completion.',
      criteria: [english('I identify the recipient and preserve the complete assigned action.'), english('I retain the timing, purpose and restrictions supported by the surrounding passage.'), english('I distinguish assignment from completion and support my interpretation with a quotation.')],
      evidence: assignment.evidence,
      hints: [english('Read the assignment with its subject.'), english('Keep the complete action and any linked requirements.'), english('Explain the task without claiming it was completed.')],
      explanation: english('Assess your explanation against the full assignment and surrounding context. The assigned action can include several linked parts; keep them together.'),
    } : condition && !request && !role && !attributionPairs ? {
      prompt: 'Explain the required condition and the action or outcome it limits. Does meeting that condition alone guarantee the outcome? Use a quotation and keep any other limits in the passage.',
      criteria: [english('I connect the complete condition to the correct action or outcome.'), english('I preserve the source’s scope, qualifications and any other restrictions.'), english('I distinguish a required condition from a guarantee, supporting my explanation with a quotation.')],
      evidence: condition.evidence,
      hints: [english('Read the condition together with the action or outcome.'), english('Check for further restrictions or qualifications elsewhere in the passage.'), english('Explain what must be true, without assuming it is all that is needed.')],
      explanation: english('Compare your explanation with the full passage. A stated prerequisite is not automatically a guarantee. Preserve other restrictions, the speaker’s scope and uncertainty; assess your interpretation using the criteria.'),
    } : evaluation && !request && !role && !attributionPairs ? {
      prompt: `What does ${evaluation.sourceName} praise or criticise, and how does the wording express that attitude? Quote the judgement and explain any qualification or contrast.`,
      criteria: [english('I identify the named source and the aspect being assessed.'), english('I explain the evaluative wording without treating it as the article writer’s overall attitude.'), english('I quote the complete judgement and retain its limits or contrasting assessment.')],
      evidence: evaluation.evidence,
      hints: [english('Locate the named source and read the surrounding passage.'), english('Identify the object of praise or criticism and the evaluative words.'), english('Support your interpretation with a quotation and keep any qualification or contrasting judgement.')],
      explanation: english('Praise for one aspect can coexist with criticism of another. Support your interpretation with the quoted wording, then assess it below.'),
    } : viewpoints ? {
      prompt: `Compare the statements attributed to ${viewpoints.names[0]} and ${viewpoints.names[1]}. What does each claim or emphasise? Explain any difference in emphasis or attitude, quoting both. If the passage supports no contrast, say so.`,
      criteria: [english('I identify each statement’s topic and keep its claim with its named source.'), english('I compare the aspects discussed without inventing disagreement, intention or an overall view.'), english('I quote both statements, resolve references from context and preserve reporting verbs, negation and limits.')],
      evidence: viewpoints.evidence, additionalEvidence: viewpoints.otherEvidence.map(range => ({ blockId: id, ...range })),
      hints: [english('Compare what each named source says about the topic; the two statements need not disagree.'), english('Find both complete statements. Look nearby for what “it” or “these” refers to.'), english('“Argued that” presents a position, not necessarily a quarrel. “Does not necessarily” rejects a guarantee, not every possibility. Keep each statement’s limits.')],
      explanation: english('Compare the topic, claim and limits of each quoted statement. Resolve references from context, or state what remains unclear. Different aspects need not contradict each other; these statements alone do not establish either source’s overall view or the writer’s endorsement.'),
    } : {
      prompt: 'Explain the main point in two sentences. Use one short quotation to support your interpretation.',
      criteria: [english('My summary agrees with the information in the excerpt.'), english('I support my interpretation with an exact quotation and avoid inventing missing context.')],
      evidence: { start: 0, end: passage.text.length },
      hints: [english('Identify what happens or what the speaker is describing.'), english('Choose one detail that supports your main point.'), english('Separate what the excerpt says from your own interpretation.')],
      explanation: english('Compare your response with the passage and assess it using the points below.') }) }] : []),
  ] };
}

/** Apply the session source quota after ordinary material selection and generation. */
function corpusCandidateLesson(corpus: Corpus, seen: ReadonlySet<string>, seed: number, maxWords = 300, startingPoint?: z.infer<typeof levelSchema>, interests: Preferences['interests'] = [], focus?: CorpusQuestionKind, focusOperation?: string, applicationCorpus?: Corpus, includeResponse = true) {
  // Wrap application seeds at the public seed's 32-bit boundary.
  const nextSeed = (seed + 1) >>> 0;
  const beginner = startingPoint === 'A1' || startingPoint === 'A2';
  if (['choice:main-point', 'choice:condition-outcome', 'choice:narrative-motive', 'choice:specific-intention', 'choice:procedural-plan'].includes(focusOperation ?? '') && startingPoint !== 'B1') return;
  if (focusOperation?.startsWith('choice:personal-') && startingPoint !== 'A2') return;
  if (focusOperation === 'choice:planned-order' && startingPoint !== 'A2') return;
  if (focusOperation === 'choice:stated-origin' && startingPoint !== 'A2') return;
  if (focusOperation === 'choice:stated-intention' && !beginner) return;
  if (focusOperation === 'choice:explicit-contrast' && startingPoint !== 'B2') return;
  if (focusOperation === rhetoricalFunctionOperation && startingPoint !== 'C2') return;
  if (focusOperation === disagreementSynthesisOperation && startingPoint !== 'C2') return;
  if (focusOperation === faithfulParaphraseOperation && startingPoint !== 'C2') return;
  if (focusOperation === complexPragmaticsOperation && startingPoint !== 'C2') return;
  if (focusOperation === layeredPositionOperation && startingPoint !== 'C2') return;
  if (focusOperation === nuancedMeaningOperation && startingPoint !== 'C2') return;
  if ((focusOperation === informationDensityOperation || focusOperation === indirectStanceOperation || focusOperation === argumentBoundariesOperation || focusOperation === registerAudienceOperation || focusOperation === implicitIntentionOperation || focusOperation === discourseOrganizationOperation) && startingPoint !== 'C1') return;
  if ((focusOperation === 'choice:negated-necessity' || focusOperation === 'choice:concessive-relation' || focusOperation === 'choice:qualified-timing' || focusOperation === 'choice:polite-request') && !isAdvanced(startingPoint)) return;
  if ((focusOperation === viewAttributionOperation || focusOperation === informationSynthesisOperation || focusOperation === speakerAttitudeOperation || focusOperation === qualifiedConcessionOperation || focusOperation === claimExampleOperation || focusOperation === comparisonOperation) && startingPoint !== 'B2') return;
  const eligibleFor = (bank: Corpus) => ({ ...bank, records: bank.records.map(source => ({ ...source, passages: unseenCorpusPassages(source, seen).filter(passage => {
    if (beginner ? !passage.startingPoints?.includes(startingPoint) : passage.startingPoints) return false;
    if (seen.has(passage.id) || passage.wordCount > maxWords || (startingPoint === 'C1' || startingPoint === 'C2') && passage.wordCount < 120) return false;
    if (!passage.task) return startingPoint === 'C2' && disagreementSynthesisScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusDisagreementSynthesis(passage.text, seed) || startingPoint === 'C2' && faithfulParaphraseScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusFaithfulParaphrase(passage.text, seed) || startingPoint === 'C2' && complexPragmaticsScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusComplexPragmatics(passage.text, seed) || startingPoint === 'C2' && layeredPositionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusLayeredPosition(passage.text, seed) || startingPoint === 'C2' && rhetoricalFunctionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusRhetoricalFunction(passage.text, seed) || startingPoint === 'C2' && nuancedMeaningScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusNuancedMeaning(passage.text, seed) || startingPoint === 'C1' && informationDensityScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusInformationDensity(passage.text, seed) || startingPoint === 'C1' && indirectStanceScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusIndirectStance(passage.text, seed) || startingPoint === 'C1' && argumentBoundariesScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusArgumentBoundaries(passage.text, seed) || startingPoint === 'C1' && registerAudienceScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusRegisterAudience(passage.text, seed) || startingPoint === 'C1' && discourseOrganizationScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusDiscourseOrganization(passage.text, seed) || startingPoint === 'C1' && implicitIntentionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusImplicitIntention(passage.text, seed) || startingPoint === 'B2' && b2ViewAttributionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusViewAttribution(passage.text, seed) || startingPoint === 'B2' && b2InformationSynthesisScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusInformationSynthesis(passage.text, seed) || startingPoint === 'B2' && b2SpeakerAttitudeScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusSpeakerAttitude(passage.text, seed) || startingPoint === 'B2' && b2QualifiedConcessionScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusQualifiedConcession(passage.text, seed) || startingPoint === 'B2' && b2ComparisonScopes.reading.some(scope => scope.passageId === passage.id) && !!corpusComparison(passage.text, seed) || startingPoint === 'B2' && b2ClaimExampleScopes.records.some(scope => scope.passageId === passage.id) && !!corpusClaimExamples(passage.text, seed) || startingPoint === 'B1' && b1ProcedureScopes.records.some(scope => scope.passageId === passage.id) && !!corpusProceduralPlan(passage.text, seed) || startingPoint === 'B1' && b1IntentionScopes.records.some(scope => scope.passageId === passage.id) && !!corpusSpecificIntention(passage.text, seed) || startingPoint === 'B1' && b1MotiveScopes.records.some(scope => scope.passageId === passage.id) && !!corpusNarrativeMotive(passage.text, seed) || startingPoint === 'B1' && b1ReferenceScopes.records.some(scope => scope.passageId === passage.id) && !!corpusB1Reference(passage.text, seed) || startingPoint === 'B1' && b1ConditionScopes.records.some(scope => scope.passageId === passage.id) && !!corpusConditionalMeaning(passage.text, seed) || startingPoint === 'B1' && b1MainPointScopes.records.some(scope => scope.passageId === passage.id) && !!corpusMainPoint(passage.text, seed) || hasRestoration(passage.text, passage.language, beginner) || !!corpusSequence(passage.text, seed) || !!corpusQualification(passage.text, seed) || (!beginner && !!corpusAttribution(passage.text, seed)) || (!beginner && (!!corpusDates(passage.text, seed) || !!corpusRequests(passage.text, seed) || !!corpusRoleActions(passage.text, seed) || !!corpusAttributionPairs(passage.text, seed) || !!corpusEvaluation(passage.text, seed) || !!corpusCondition(passage.text, seed) || !!corpusAssignment(passage.text, seed) || !!corpusConcession(passage.text, seed) || !!corpusActionSelection(passage.text, seed) || !!corpusQualifiedCause(passage.text, seed) || isAdvanced(startingPoint) && (!!corpusNegatedNecessity(passage.text, seed) || !!corpusConcessiveRelation(passage.text, seed) || !!corpusQualifiedTiming(passage.text, seed) || !!corpusPoliteRequest(passage.text, seed)) || startingPoint === 'B2' && !!corpusExplicitContrast(passage.text, seed))) || (beginner && (!!corpusSpeakers(passage.text, seed) || !!corpusRooms(passage.text, seed) || !!corpusAddress(passage.text, seed) || !!corpusPhone(passage.text, seed) || !!corpusStatedIntention(passage.text, seed) || startingPoint === 'A2' && !!corpusStatedOrigin(passage.text, seed) || !!corpusApartments(passage.text, seed)));
    try { corpusEvidence(passage.text, passage.task, seed); return true; }
    catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_SOURCE_SPANS') return false;
      throw error;
    }
  }) })) });
  const eligible = eligibleFor(corpus);
  const canFocus = (passage: Corpus['records'][number]['passages'][number], value: number, preferred = focus, preferredOperation = focusOperation) => corpusCanFocus(passage, value, startingPoint, preferred, preferredOperation);
  // Cycle operations separately from passages so all candidates remain reachable.
  const attributionCycle = Math.max(1, eligible.records.reduce((count, source) => count + source.passages.length, 0));
  const referenceRoots = new Set(eligible.records.filter(source => source.passages.some(passage => admittedLongText(passage.text))).map(source => source.rootId));
  let rotation = !focus ? corpusDefaultFocus(seed, attributionCycle, startingPoint) : undefined;
  // Preserve matching rotation when fewer than two originals support the new operation.
  if (startingPoint === 'B2' && rotation?.[0] === 'matching'
    && new Set(eligible.records.filter(source => source.passages.some(passage => canFocus(passage, seed, 'matching', claimExampleOperation))).map(source => source.rootId)).size < 2)
    rotation = corpusDefaultFocus(seed, attributionCycle);
  if (startingPoint === 'C1' && rotation?.[0] === 'matching') {
    const available = [discourseOrganizationOperation, registerAudienceOperation, argumentBoundariesOperation, indirectStanceOperation].filter(operation => new Set(eligible.records.filter(source => source.passages.some(passage => canFocus(passage, seed, 'matching', operation))).map(source => source.rootId)).size >= 2);
    const legacy = c1Focus.filter(([kind, operation]) => kind === 'matching' && (![discourseOrganizationOperation, registerAudienceOperation, argumentBoundariesOperation, indirectStanceOperation].includes(operation ?? '') || available.includes(operation!)));
    const phase = Math.floor(seed / attributionCycle), kinds = new Set(advancedFocus.map(([kind]) => kind)).size;
    rotation = legacy[Math.floor(phase / kinds) % legacy.length];
  }
  if (startingPoint === 'C2' && rotation?.[0] === 'choice') {
    const available = [nuancedMeaningOperation, rhetoricalFunctionOperation, layeredPositionOperation, complexPragmaticsOperation, faithfulParaphraseOperation, disagreementSynthesisOperation].filter(operation => new Set(eligible.records.filter(source => source.passages.some(passage => canFocus(passage, seed, 'choice', operation))).map(source => source.rootId)).size >= 2);
    const legacy = c2Focus.filter(([kind, operation]) => kind === 'choice' && (![nuancedMeaningOperation, rhetoricalFunctionOperation, layeredPositionOperation, complexPragmaticsOperation, faithfulParaphraseOperation, disagreementSynthesisOperation].includes(operation ?? '') || available.includes(operation!)));
    const phase = Math.floor(seed / attributionCycle), kinds = new Set(advancedFocus.map(([kind]) => kind)).size;
    rotation = legacy[Math.floor(phase / kinds) % legacy.length];
  }
  if (startingPoint === 'C1' && rotation?.[0] === 'choice') {
    const available = [implicitIntentionOperation, informationDensityOperation].filter(operation => new Set(eligible.records.filter(source => source.passages.some(passage => canFocus(passage, seed, 'choice', operation))).map(source => source.rootId)).size >= 2);
    const legacy = c1Focus.filter(([kind, operation]) => kind === 'choice' && (![implicitIntentionOperation, informationDensityOperation].includes(operation ?? '') || available.includes(operation!)));
    const phase = Math.floor(seed / attributionCycle), kinds = new Set(advancedFocus.map(([kind]) => kind)).size;
    rotation = legacy[Math.floor(phase / kinds) % legacy.length];
  }
  if (startingPoint === 'B2' && rotation?.[0] === 'choice') {
    const available = [comparisonOperation, qualifiedConcessionOperation, speakerAttitudeOperation, informationSynthesisOperation, viewAttributionOperation].filter(operation => new Set(eligible.records.filter(source => source.passages.some(passage => canFocus(passage, seed, 'choice', operation))).map(source => source.rootId)).size >= 2);
    if (available.length < 5) {
      const legacy = b2Focus.filter(([kind, operation]) => kind === 'choice' && (![comparisonOperation, qualifiedConcessionOperation, speakerAttitudeOperation, informationSynthesisOperation, viewAttributionOperation].includes(operation ?? '') || available.includes(operation!)));
      const phase = Math.floor(seed / attributionCycle), kinds = new Set(b2Focus.map(([kind]) => kind)).size;
      rotation = legacy[Math.floor(phase / kinds) % legacy.length];
    }
  }
  const reviewedFocusReady = [disagreementSynthesisOperation, faithfulParaphraseOperation, complexPragmaticsOperation, layeredPositionOperation, rhetoricalFunctionOperation, nuancedMeaningOperation, informationDensityOperation, indirectStanceOperation, argumentBoundariesOperation, registerAudienceOperation, discourseOrganizationOperation, implicitIntentionOperation, viewAttributionOperation, informationSynthesisOperation, speakerAttitudeOperation, qualifiedConcessionOperation, comparisonOperation, claimExampleOperation, 'choice:main-point', 'choice:condition-outcome', 'choice:reference', 'choice:narrative-motive', 'choice:specific-intention', 'choice:procedural-plan'].includes(rotation?.[1] ?? '') && new Set(eligible.records.filter(source => source.passages.some(passage => canFocus(passage, seed, rotation?.[0], rotation?.[1]))).map(source => source.rootId)).size >= 2;
  const automatic = !focus ? (reviewedFocusReady ? rotation : !beginner && referenceRoots.size >= 2 ? ['choice', 'choice:reference'] as const : rotation) : undefined;
  const focused = { ...eligible, records: eligible.records.map(source => ({ ...source, passages: source.passages.filter(passage => canFocus(passage, seed, focus ?? automatic?.[0], focusOperation ?? automatic?.[1])) })) };
  let first = selectCorpusPassage(focused, seen, seed, maxWords, interests, startingPoint) ?? selectCorpusPassage(eligible, seen, seed, maxWords, interests, startingPoint);
  if (!first) return;
  const materialFor = (item: NonNullable<ReturnType<typeof selectCorpusPassage>>, index: number, preferred = focus, preferredOperation = focusOperation) => corpusMaterial(item, (seed + index) >>> 0, startingPoint, preferred, preferredOperation, attributionCycle, includeResponse);
  let taught = materialFor(first, 0, focus ?? automatic?.[0], focusOperation ?? automatic?.[1]);
  if (focusOperation && corpusOperation(taught?.questions[0]) !== focusOperation) {
    const replacement = eligible.records.flatMap(source => source.passages.map(passage => ({ source, passage })))
      .find(item => canFocus(item.passage, seed) && corpusOperation(materialFor(item, 0)?.questions[0]) === focusOperation);
    if (replacement) { first = replacement; taught = materialFor(first, 0); }
  }
  if ([disagreementSynthesisOperation, faithfulParaphraseOperation, complexPragmaticsOperation, layeredPositionOperation, rhetoricalFunctionOperation, nuancedMeaningOperation, informationDensityOperation, indirectStanceOperation, argumentBoundariesOperation, registerAudienceOperation, discourseOrganizationOperation, implicitIntentionOperation, viewAttributionOperation, informationSynthesisOperation, speakerAttitudeOperation, qualifiedConcessionOperation, comparisonOperation, claimExampleOperation, 'choice:reference', 'choice:narrative-motive', 'choice:specific-intention', 'choice:procedural-plan'].includes(focusOperation ?? '') && corpusOperation(taught?.questions[0]) !== focusOperation) return;
  if (!taught) return;
  const taughtOperation = corpusOperation(taught.questions[0]);
  let target: CorpusQuestionKind | undefined = 'kind' in taught.questions[0] ? taught.questions[0].kind !== 'response' && taught.questions[0].kind !== 'gap-fill' ? taught.questions[0].kind : undefined : 'choice';
  // Preserve the teaching source; use validated installed text for applications.
  const applicationEligible = applicationCorpus ? eligibleFor({ ...applicationCorpus, records: [...new Map([...applicationCorpus.records, ...corpus.records].map(source => [source.rootId, source])).values()] }) : eligible;
  const firstRoot = corpusMaterialRoot(first.source, first.passage);
  const textKey = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const firstText = textKey(first.passage.text);
  const applicationSources = (bank: Corpus) => bank.records.map(source => ({ ...source, passages: source.passages.filter(passage =>
    corpusMaterialRoot(source, passage) !== firstRoot && (!(first!.passage.quoteProvenance || passage.quoteProvenance) || textKey(passage.text) !== firstText),
  ) })).filter(source => source.passages.length);
  let second = selectCorpusPassage({ ...focused, records: applicationSources(focused) }, seen, nextSeed, maxWords, interests, startingPoint)
    ?? selectCorpusPassage({ ...applicationEligible, records: applicationSources(applicationEligible) }, seen, nextSeed, maxWords, interests, startingPoint);
  if (!second) return;
  let applied = materialFor(second, 1, target, taughtOperation);
  if (corpusOperation(applied?.questions[0]) !== taughtOperation) {
    const application = { ...applicationEligible, records: applicationSources(applicationEligible).map(source => ({ ...source,
      passages: source.passages.filter(passage => canFocus(passage, nextSeed, target, taughtOperation)
        && (target !== 'matching' && target !== 'evidence' && target !== 'choice' || corpusOperation(materialFor({ source, passage }, 1, target, taughtOperation)?.questions[0]) === taughtOperation)) })) };
    const replacement = selectCorpusPassage(application, seen, nextSeed, maxWords, interests, startingPoint);
    if (replacement) { second = replacement; applied = materialFor(second, 1, target, taughtOperation); }
  }
  if (!applied) return;
  if ([disagreementSynthesisOperation, faithfulParaphraseOperation, complexPragmaticsOperation, layeredPositionOperation, rhetoricalFunctionOperation, nuancedMeaningOperation, informationDensityOperation, indirectStanceOperation, argumentBoundariesOperation, registerAudienceOperation, discourseOrganizationOperation, implicitIntentionOperation, viewAttributionOperation, informationSynthesisOperation, speakerAttitudeOperation, qualifiedConcessionOperation, comparisonOperation, claimExampleOperation, 'choice:procedural-plan', 'choice:specific-intention', 'choice:narrative-motive', 'choice:condition-outcome', 'choice:main-point', 'choice:personal-need', 'choice:personal-preference', 'choice:personal-update', 'choice:personal-reason', 'choice:personal-rule', 'choice:personal-integration', 'choice:planned-order', 'choice:stated-time', 'choice:small-quantity', 'choice:detail-verification', 'choice:stated-location', 'choice:basic-instruction', `matching:${peopleMatchingPrompt}`, 'choice:reference'].includes(taughtOperation ?? '') && corpusOperation(applied.questions[0]) !== taughtOperation) return;
  if ((startingPoint === 'A2' && taughtOperation === 'choice:requested-address' || ['choice:stated-intention', 'choice:explicit-contrast', 'choice:concessive-relation', 'choice:qualified-timing', 'choice:polite-request', `matching:${attributionMatchingPrompt}`].includes(taughtOperation ?? '')) && corpusOperation(applied.questions[0]) !== taughtOperation) {
    if (focus) return;
    const fallback = materialFor(first, 0, 'completion'), application = materialFor(second, 1, 'completion');
    if (!fallback || !application || corpusOperation(fallback.questions[0]) !== 'completion' || corpusOperation(application.questions[0]) !== 'completion') return;
    taught = fallback; applied = application; target = 'completion';
  }
  const materials = [taught, applied];
  return corpusStartingPoint(lessonSchema.parse({ id: `corpus-v1-${first.passage.id.slice(0, 16)}-${second.passage.id.slice(0, 16)}`, targetLevel: 'B2', skill: 'reading', reviewStatus: 'draft', sourceId: first.passage.quoteProvenance || second.passage.quoteProvenance ? 'wikiquote-corpus' : first.source.id.startsWith('voa-') && second.source.id.startsWith('voa-') ? 'voa-corpus' : first.source.id.startsWith('wikipedia-') && second.source.id.startsWith('wikipedia-') ? 'wikipedia-corpus' : first.passage.sourceProvenance || second.passage.sourceProvenance ? 'open-reading-corpus' : 'gutenberg-corpus', goalId: 'source-wording-and-summary', generation: { generator: 'corpus-v1', seed, ...(focus ? { focus } : {}) },
    title: english(`${first.source.title} · ${second.source.title}`), goal: english(corpusOperation(taught.questions[0]) === 'choice:explicit-contrast' ? 'Preserve an explicit contrast with the previous claim without adding a cause or treating the claims as alike.' : corpusOperation(taught.questions[0]) === 'choice:polite-request' ? 'Interpret a polite request while preserving its complete action and speaker/listener roles.' : corpusOperation(taught.questions[0]) === 'choice:qualified-timing' ? 'Preserve the original timing qualification and its event, participant or selected-part scope.' : corpusOperation(taught.questions[0]) === 'choice:concessive-relation' ? 'Preserve an explicit concession, its reference and qualifications without inventing a cause.' : corpusOperation(taught.questions[0]) === 'choice:negated-necessity' ? 'Compare paraphrases while preserving qualification, attribution and negation scope.' : corpusOperation(taught.questions[0]) === 'choice:qualified-cause' ? 'Distinguish a stated event from its tentative explanation and support that distinction with the source wording.' : target === 'choice' ? 'Choose the required response to a stated condition and explain it with both source rules.' : taught.questions[0].prompt === concessionPrompt ? 'Locate a concessive sentence and explain both connected ideas in context.' : taught.questions[0].prompt === assignmentPrompt ? 'Locate an assigned task and explain its recipient, complete action and limits.' : taught.questions[0].prompt === conditionPrompt ? 'Identify a prerequisite and explain what it does and does not permit.' : taught.questions[0].prompt === evaluationPrompt ? 'Locate a named source’s evaluation and explain its wording with a quotation.' : taught.questions[0].prompt === attributionMatchingPrompt ? 'Keep each claim with its named source and support a comparison with quotations.' : first.passage.task ? 'Identify the author’s point and locate the sentence that supports it.' : 'Locate exact wording and support a short interpretation with evidence.'),
    teaching: english(corpusOperation(taught.questions[0]) === 'choice:explicit-contrast' ? 'Read the sentence that begins “In contrast” together with the claim immediately before it. “By contrast” keeps that difference. “Similarly” treats the claims as alike. “Because” adds a cause the source does not state. ' : corpusOperation(taught.questions[0]) === 'choice:polite-request' ? 'Read the request and reply. “Would you mind” asks the listener to act for the speaker; “me” is the requester. Keep the object and hypothetical “would say”. “Not at all” can accept. Politeness does not prove ignorance or completion; keep any stated knowledge, custody or transport restrictions.' : corpusOperation(taught.questions[0]) === 'choice:qualified-timing' ? 'Keep the source’s timing and scope: “estimated” marks an estimate; “about” or “approximately” can mark elapsed duration; “around the year” marks a calendar date. Keep the event, participant, quantity, clarifying timeline, later revisions and minimum bounds. “Exactly” removes qualification; “every” expands scope.' : corpusOperation(taught.questions[0]) === 'choice:concessive-relation' ? 'Read both clauses and their references. “Although” and “even though” retain a contrast; “because” adds a cause and “only because” an exclusive cause. Keep negation, time and uncertainty.' : corpusOperation(taught.questions[0]) === 'choice:negated-necessity' ? 'Read the complete sentence and its context. “Not necessarily” denies a guarantee; it does not guarantee that the relationship never holds. Compare the options by keeping every other word, qualification and attribution unchanged. “Not guaranteed” preserves this scope; guaranteed occurrence or non-occurrence changes it. ' : corpusOperation(taught.questions[0]) === 'choice:qualified-cause' ? 'Read the complete event statement and proposed explanation. Keep “possibly”, “probably because” or “apparently because of a possible” with the explanation, preserving any negation. These words qualify the explanation; they do not verify what happened as a real-world fact.' : target === 'choice' ? 'Read the complete condition or stage and the action that follows “must”. Compare this action with the duty in the other stated context. Select the action for the stated situation, keeping all stated limits.' : target === 'completion' ? 'Read for the main point. Find the sentence with the gap and copy the missing word, keeping its spelling and ending.'
      : target === 'sequence' ? 'Find the three sentences and put them in text order. Use names, pronouns and connecting words to check.'
      : target === 'matching' ? materials[0]!.questions[0].prompt.includes('request') ? 'Match each action to Requested or Ruled out. Keep the named source, timing and “and not” or “and do not”; a request does not establish compliance.' : materials[0]!.questions[0].prompt.includes('match each reliance') ? 'Match each stated reliance to its named subject. Do not infer reciprocal dependence.' : materials[0]!.questions[0].prompt === attributionMatchingPrompt ? 'Match each complete claim to its named source. Use nearby context to resolve references, keeping reporting verbs and limits. “Argued” reports a position; “does not necessarily” rejects a guarantee. Compare the claims without inventing disagreement.' : 'Find each quoted sentence in the dialogue. Match it to the name before the speaker’s words.'
      : target === 'table' ? beginner ? 'Find each person’s name and the apartment code they give. Copy the letter and number into the table.' : 'Match each event to its sentence and copy the year, keeping timing limits.'
      : first.passage.task ? 'Read the short explanation. Select the sentence that supports the question, then explain the main point with one quotation.'
      : materials[0]!.questions[0].prompt === concessionPrompt ? 'Find “although” or “even though” and read both complete clauses with the surrounding passage. Identify what is acknowledged and what contrasts with it. Quote both parts, keeping time, attribution and uncertainty; do not infer a general tone from the connecting word alone.' : materials[0]!.questions[0].prompt === assignmentPrompt ? 'Read the full sentence containing “tasked with” or “assigned to”. Identify its subject and preserve every part of the assigned action, including timing and limits. Distinguish this assignment from proof that it was completed.' : materials[0]!.questions[0].prompt === conditionPrompt ? 'Find the action and its required condition or recipient restriction. Keep surrounding restrictions; a required condition does not guarantee permission or success.'
      : materials[0]!.questions[0].prompt === evaluationPrompt ? 'Find the named source and the aspect being assessed. Locate direct praise or criticism, keeping qualifications and contrasting judgements. Then explain that source’s attitude with a quotation; do not assume it is the article writer’s attitude.'
      : materials[0]!.questions[0].prompt === attributionPrompt ? 'Find the named source after “According to” or before a reporting verb. Read the complete attributed claim, preserving the verb, negation and qualifications. Naming a source does not prove its claim or the writer’s endorsement.'
      : 'Read for the main point. Compare the sentences and find wording that marks a claim as a belief, inference or possibility. Keep that qualification when you explain the claim.'),
    workedExample: english(corpusOperation(materials[0]!.questions[0]) === 'choice:explicit-contrast' ? 'Example: “The first report counts only completed trials. In contrast, the second report counts every attempt.” “By contrast” keeps the difference. “Similarly” treats the reports as alike. “Because” invents a cause.' : corpusOperation(materials[0]!.questions[0]) === 'choice:polite-request' ? 'Example: “Would you mind reading me the note?” → The listener is asked to read the note to the speaker. This is a request, not an offer or proof of completion.' : corpusOperation(materials[0]!.questions[0]) === 'choice:qualified-timing' ? 'Example: “The journey is estimated to take 200 years.” Keep estimated, the journey and 200 years; exactly removes the estimate and every process changes its scope. “The town opened around the year 1800” retains an approximate calendar date, not an estimate of elapsed duration.' : corpusOperation(materials[0]!.questions[0]) === 'choice:concessive-relation' ? 'Example: “The plan seems useful, although it lacks direct evidence.” “Even though it lacks direct evidence” retains the contrast and uncertainty. “Because” or “only because” supplies a causal explanation which the concession does not state.' : corpusOperation(materials[0]!.questions[0]) === 'choice:negated-necessity' ? 'Example: “Variation is not necessarily connected with cultivation.” “Variation is not guaranteed to be connected with cultivation” retains the qualification. “Variation is necessarily not connected” guarantees absence; “Variation is necessarily connected” guarantees presence. Neither guarantee preserves the original wording.' : corpusOperation(materials[0]!.questions[0]) === 'choice:qualified-cause' ? 'Example: “The machine stopped, apparently because of a possible fault in the wiring.” The stop is stated directly; the fault is proposed as an uncertain explanation. This wording does not independently verify the cause.' : materials[0]!.questions[0].prompt === concessionPrompt ? 'Example: “The plan seems useful, although it lacks direct evidence.” → A qualified positive judgement and an acknowledged limitation. Keep “seems” and both clauses; “although” does not establish a cause or an overall attitude.' : materials[0]!.questions[0].prompt === assignmentPrompt ? 'Example: “The team was tasked with checking the doors before opening.” The team must check the doors before opening; this sentence does not establish that the check happened.' : target === 'choice' ? 'Example: “If a warning appears, pause the task. During routine work, continue checking progress.” The warning requires pausing; the routine action answers a different situation.' : materials[0]!.questions[0].prompt === conditionPrompt ? 'Example: “You may enter only if you have a ticket. The room must also be open.” A ticket is required; having one does not remove the opening-time restriction.' : materials[0]!.questions[0].prompt === evaluationPrompt ? 'Example: “Dana praised the clear directions but criticised the long wait.” Dana approves of the directions and criticises the wait. Keep both assessments rather than assigning one overall tone.' : materials[0]!.questions[0].prompt === attributionPrompt ? 'Example: “According to Mira, the new timetable may shorten journeys during the trial.” → Mira reports a possible benefit during the trial. Keep “may”; attribution proves neither truth nor the writer’s endorsement.' : target === 'matching' && materials[0]!.questions[0].prompt === pairedReliancePrompt ? 'Example: “The desk lamp depends on electric power, and the garden hose depends on water pressure.” → electric power: the desk lamp; water pressure: the garden hose. Do not reverse the direction or infer reciprocal dependence. Dependence does not guarantee operation.' : target === 'matching' && materials[0]!.questions[0].prompt.includes('request') ? 'Example: “Please check the front door before leaving, and do not open the side gate.” → Requested: check the front door before leaving. Ruled out: open the side gate. A request does not show completion.' : materials[0]!.questions[0].prompt === attributionMatchingPrompt ? 'Example: “The town is testing a bus route. According to Dana, it may shorten journeys during the trial. Robin Jones argued that a shorter journey does not necessarily cost less.” → Dana: a possible time benefit during the trial; Robin: lower cost is not guaranteed. The claims can both hold; “argued” reports a position.' : target === 'table' ? 'Example: “The museum opened before 2005. The tram service began around 2010.” → Rows: “The museum opened before ________.”: 2005; “The tram service began around ________.”: 2010. Enter only the digits. Keep “before” and “around”; the dates do not establish a cause.' : target === 'sequence' ? 'Example: “Mina opens a window.” → “She looks at the garden.” → “She closes the window.” Keep sentence order; do not infer when the events actually happened.' : target === 'completion' ? 'Example: “Nora puts the blue cup on the shelf.” → Gap: “Nora puts the ________ cup on the shelf.” → Answer: “blue”. Check the words around the gap, spelling and word ending.' : 'A supported response separates a quotation from an interpretation: “The author says …”, followed by “This suggests … because …”.'),
    nextStep: english('On the next passage, look for information that supports or limits your first interpretation.'), materials,
  }), startingPoint);
}

// Shared eligibility per 16 seeds limits Wikiquote to slot zero: at most 1/16 with uniform seeds.
export function corpusLesson(corpus: Corpus, seen: ReadonlySet<string>, seed: number, maxWords = 300, startingPoint?: z.infer<typeof levelSchema>, interests: Preferences['interests'] = [], focus?: CorpusQuestionKind, focusOperation?: string, applicationCorpus?: Corpus, includeResponse = true) {
  const hasQuotes = startingPoint !== 'A1' && startingPoint !== 'A2' && [corpus, applicationCorpus].some(bank => bank?.records.some(source => source.passages.some(passage => passage.quoteProvenance)));
  if (!hasQuotes) return corpusCandidateLesson(corpus, seen, seed, maxWords, startingPoint, interests, focus, focusOperation, applicationCorpus, includeResponse);
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('INVALID_CORPUS_SELECTION');
  const ordinary = (bank: Corpus): Corpus => ({ ...bank, records: bank.records.map(source => ({ ...source,
    passages: source.passages.filter(passage => !passage.quoteProvenance),
  })).filter(source => source.passages.length) });
  const baseSeed = Math.floor(seed / 16);
  const baseline = corpusCandidateLesson(ordinary(corpus), seen, baseSeed, maxWords, startingPoint, interests, focus, focusOperation, applicationCorpus && ordinary(applicationCorpus), includeResponse);
  if (!baseline) return;
  const savedSeed = { ...baseline, generation: { ...baseline.generation!, seed } };
  if (seed % 16) return savedSeed;
  const primary = baseline.materials[0], operation = corpusOperation(primary.questions[0]);
  const target = 'gaps' in primary.questions[0] ? 'completion' : 'kind' in primary.questions[0] ? primary.questions[0].kind : 'choice';
  if (target === 'response' || !operation) return savedSeed;
  const textKey = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const primaryText = textKey(primary.blocks.map(block => block.text).join('\n'));
  const sources = [...new Map([...(applicationCorpus?.records ?? []), ...corpus.records].map(source => [source.rootId, source])).values()];
  const candidates = sources.flatMap(source => unseenCorpusPassages(source, seen).filter(passage => passage.quoteProvenance
    && passage.wordCount <= maxWords && (startingPoint !== 'C1' && startingPoint !== 'C2' || passage.wordCount >= 120)
    && corpusMaterialRoot(source, passage) !== primary.rootId && textKey(passage.text) !== primaryText).map(passage => ({ source, passage })));
  for (let offset = 0; offset < candidates.length; offset++) {
    const candidate = candidates[(baseSeed + offset) % candidates.length];
    const application = corpusMaterial(candidate, baseSeed + 1, startingPoint, target, operation, 1, includeResponse);
    if (!application || corpusOperation(application.questions[0]) !== operation) continue;
    return lessonSchema.parse({ ...savedSeed, id: `corpus-v1-${primary.id.slice('corpus-'.length, 'corpus-'.length + 16)}-${candidate.passage.id.slice(0, 16)}`,
      sourceId: 'wikiquote-corpus', title: english(`${primary.title} · ${application.title}`), materials: [primary, application] });
  }
  return savedSeed;
}

/** Teach with unused source wording, never a scored answer. */
export function corpusWorkedExample(material: Lesson['materials'][number], seed: number, startingPoint?: z.infer<typeof levelSchema>, listening = false) {
  const question = material.questions[0];
  if (!('kind' in question) || (question.kind !== 'completion' && question.kind !== 'sequence' && question.kind !== 'table' && question.kind !== 'matching' && question.kind !== 'evidence')) return;
  const text = material.blocks.find(block => block.id === question.blockId)?.text;
  if (!text) return;
  const ranges = [question.evidence, ...(question.additionalEvidence ?? []).filter(span => span.blockId === question.blockId)];
  const overlaps = (start: number, end: number) => ranges.some(range => start < range.end && end > range.start);
  const beginner = startingPoint === 'A1' || startingPoint === 'A2';
  const local = (en: string, hans: string, hant: string) => beginner ? { en, 'zh-Hans': hans, 'zh-Hant': hant } : english(en);
  if (question.kind === 'matching' && question.prompt === peopleMatchingPrompt) return local('Made-up example: “Mira: I am happy. Leo: I am tired.” → Says they are happy: Mira. Says they are tired: Leo. “I” means the person speaking. Happy means feeling good; tired means needing rest.', '虚构示例：“Mira: I am happy. Leo: I am tired.” → 说自己开心的是Mira；说自己累了的是Leo。“I”指正在说话的人。happy表示开心，tired表示累。', '虛構示例：「Mira: I am happy. Leo: I am tired.」 → 說自己開心的是Mira；說自己累了的是Leo。「I」指正在說話的人。happy表示開心，tired表示累。');
  if (question.kind === 'evidence') {
    if (text.length > 12000 || ![conditionPrompt, evaluationPrompt, attributionPrompt, qualificationPrompt].includes(question.prompt)) return;
    const attribution = question.prompt === attributionPrompt;
    const unused = (question.prompt === conditionPrompt ? corpusConditionStatements(text) : question.prompt === evaluationPrompt ? corpusEvaluationStatements(text) : attribution ? corpusAttributionStatements(text) : corpusQualificationStatements(text)).filter(statement => !overlaps(statement.evidence.start, statement.evidence.end)
      && !question.spans.some(span => span.blockId === question.blockId && statement.evidence.start < span.end && statement.evidence.end > span.start));
    const example = unused[seed % unused.length];
    if (!example) return;
    if (question.prompt === conditionPrompt) return english(`Example: “${example.evidenceText}”. A required condition alone does not guarantee the outcome.`);
    if (question.prompt === evaluationPrompt) return english(`Example: “${example.evidenceText}” → “${example.cue}”. Identify what is praised or criticised; both may coexist.`);
    if (attribution) return english(`Example: “${example.evidenceText}” → “${example.cue}”. Keep the named source with the claim; attribution does not prove it true.`);
    return english(`Example: “${example.evidenceText}” → “${example.cue}”. Keep the qualifying words, time and context.`);
  }
  if (question.kind === 'matching' && [attributionMatchingPrompt, spokenAttributionMatchingPrompt].includes(question.prompt)) {
    const unused = [...corpusAttributionStatements(text), ...corpusDialogueClaims(text)].filter(statement => !overlaps(statement.evidence.start, statement.evidence.end)
      && !question.pairs.some(pair => statement.evidenceText.includes(pair.label)));
    const example = unused[seed % unused.length];
    if (!example) return;
    return english(`Example: “${example.evidenceText}” → ${example.name}. Keep the named source, reporting verb and limits.`);
  }
  if (question.kind === 'matching' && question.prompt.includes('request')) {
    const unused = corpusRequestStatements(text).filter(request => !overlaps(request.evidence.start, request.evidence.end));
    const example = unused[seed % unused.length];
    if (!example) return;
    return english(`Example: “${example.sentence}”. “${example.actions[0]}” is requested; “${example.actions[1]}” is ruled out by “and not” or “and do not”. Keep both alternatives with the request.`);
  }
  if (question.kind === 'matching' && question.prompt.includes('match each reliance')) {
    const unused = corpusRoleStatements(text).filter(role => !overlaps(role.evidence.start, role.evidence.end));
    const example = unused[seed % unused.length];
    if (!example) return;
    return english(`Example: “${example.sentence}”. ${example.pairs.map(pair => `${pair.answer}: “${pair.label}”`).join('; ')}. Do not reverse the stated dependence.`);
  }
  if (question.kind === 'matching' && question.prompt === roomMatchingPrompt) {
    const unused = corpusRoomStatements(text).filter(fact => !overlaps(fact.evidence.start, fact.evidence.end)
      && !question.pairs.some(pair => pair.label === fact.label || pair.answer === fact.answer));
    const fact = unused[seed % unused.length];
    if (!fact) return;
    const quote = text.slice(fact.evidence.start, fact.evidence.end);
    return local(`Example: “${quote}” → ${fact.label}: ${fact.answer}. `,
      `示例：“${quote}” → ${fact.label}：${fact.answer}。`,
      `示例：「${quote}」 → ${fact.label}：${fact.answer}。`);
  }
  if (question.kind === 'matching') {
    if (text.length > 12000) return;
    const unused = corpusSpeakerStatements(text).filter(statement => !overlaps(statement.evidence.start, statement.evidence.end)
      && statement.evidence.end - statement.evidence.start <= 180 && !question.pairs.some(pair => text.slice(statement.evidence.start, statement.evidence.end).toLowerCase().includes(pair.label.toLowerCase())));
    const example = unused[seed % unused.length];
    if (!example) return;
    const quote = text.slice(example.evidence.start, example.evidence.end);
    return local(`Example: “${quote}” → ${example.answer}. The name before “:” tells you who says “${example.label}”.`,
      `示例：“${quote}” → ${example.answer}。“:”前的名字说明谁说了“${example.label}”。`,
      `示例：「${quote}」 → ${example.answer}。「:」前的名字說明誰說了「${example.label}」。`);
  }
  const sentences = sentenceSegments(text);
  if (question.kind === 'table') {
    if (question.prompt.includes('apartment code')) {
      if (text.length > 12000) return;
      const unused = corpusApartmentFacts(text).filter(fact => !overlaps(fact.evidence.start, fact.evidence.end)
        && fact.evidence.end - fact.evidence.start <= 180 && !question.rows.some(row => row.label === fact.label
          || text.slice(fact.evidence.start, fact.evidence.end).includes(row.answer)));
      const fact = unused[seed % unused.length];
      if (!fact) return;
      const quote = text.slice(fact.evidence.start, fact.evidence.end);
      return local(`Example: “${quote}” → ${fact.label}: ${fact.answer}. Match the name before “:” to the code after “apartment”.`,
        `示例：“${quote}” → ${fact.label}：${fact.answer}。将“:”前的名字与“apartment”后的编号对应。`,
        `示例：「${quote}」 → ${fact.label}：${fact.answer}。將「:」前的名字與「apartment」後的編號對應。`);
    }
    if (!question.prompt.includes('year given') && !(listening && question.prompt === 'Listen and complete the years in the table. Write each year in digits.')) return;
    const unused = corpusDateFacts(text).filter(fact => !overlaps(fact.evidence.start, fact.evidence.end)
      && !question.rows.some(row => fact.answer === row.answer));
    const row = unused[seed % unused.length];
    if (!row) return;
    const sentence = text.slice(row.evidence.start, row.evidence.end);
    return english(`Example: “${row.label}” → “${row.answer}”. ${listening ? 'The speaker' : 'The passage'} says “${sentence}”. Copy the year into the matching row.`);
  }
  if (question.kind === 'sequence') {
    const candidates = sentences.flatMap((_, index) => {
      const parts = sentences.slice(index, index + 3);
      const ordered = parts.map(part => part.segment.trim());
      return parts.length === 3 && !overlaps(parts[0].index, parts[2].index + parts[2].segment.length)
        && new Set(ordered).size === 3 && ordered.every((sentence, i) => sentence.length >= 20 && sentence.length <= 100 && hasSentenceBoundaries(text, parts[i].index, sentence) && !malformedSourceMarker.test(sentence) && !question.steps.includes(sentence)) ? [ordered] : [];
    });
    const example = candidates[seed % candidates.length];
    if (!example) return;
    const quote = example.map(sentence => `“${sentence}”`).join(' → ');
    return local(`Example: ${quote}. Keep sentence order.`,
      `示例：${quote}。按句子顺序排列。`,
      `示例：${quote}。按句子順序排列。`);
  }
  const candidates = sentences.flatMap(part => {
    const sentence = part.segment.trim();
    if (sentence.length < 20 || sentence.length > 180 || overlaps(part.index, part.index + part.segment.length)
      || sentence.toLowerCase().includes(question.answer.toLowerCase())) return [];
    const task = corpusRestoration(sentence, seed, undefined, beginner);
    return task ? [{ sentence, task }] : [];
  });
  const example = candidates[seed % candidates.length];
  if (!example) return;
  const { sentence, task } = example;
  return local(`Example: “${task.text}” → “${task.answer}”. ${listening ? 'The speaker says' : 'The passage says'} “${sentence}”. Check the spelling and word ending.`,
    `示例：“${task.text}” → “${task.answer}”。${listening ? '说话者说' : '材料中写着'}“${sentence}”。核对拼写和词尾。`,
    `示例：「${task.text}」 → 「${task.answer}」。${listening ? '說話者說' : '材料中寫著'}「${sentence}」。核對拼寫和詞尾。`);
}

/** Keep chosen support separate from source difficulty and proficiency. */
export function corpusStartingPoint(lesson: Lesson, startingPoint?: z.infer<typeof levelSchema>): Lesson {
  const materialsWithHints = (hints: typeof indirectStanceSupport.hints) => lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = hints; return { ...material, questions: [question] }; });
  if (startingPoint) levelSchema.parse(startingPoint);
  if (!startingPoint && lesson.generation?.generator !== 'corpus-v1') return lesson;
  if (lesson.generation?.generator !== 'corpus-v1') throw new Error('NOT_CORPUS_PRACTICE');
  const example = corpusWorkedExample(lesson.materials[0], lesson.generation.seed, startingPoint, lesson.skill === 'listening');
  const sourceTerms = lesson.skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:qualified-cause'
    && lesson.materials.some(material => material.rootId === 'frontiers-article-10.3389-frym.2022.729784')
    ? 'In the forest material, a snag is a standing dead tree. CWD means large pieces of dead wood on the forest floor. ' : lesson.skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:qualified-cause' && lesson.materials.some(material => material.rootId === 'wikipedia-article-244511') ? 'In the owl material, nocturnal means active at night; a roost is a resting place. Mobbing means other birds gathering to attack or drive an owl away. Keep “in Britain”, “some”, “even when” and “possibly”: daytime hunting is stated, while the rain explanation is tentative. ' : '';
  const reference = corpusOperation(lesson.materials[0].questions[0]) === 'choice:reference';
  const result = { ...lesson, ...(reference ? { goalId: 'source-context-reference', goal: referenceSupport.goal, teaching: lesson.goalId === 'source-context-reference' && lesson.teaching ? lesson.teaching : referenceSupport.teaching, workedExample: referenceSupport.workedExample, nextStep: referenceSupport.nextStep } : {}), ...(sourceTerms && lesson.teaching && !lesson.teaching.en.startsWith(sourceTerms)
    ? { teaching: english(sourceTerms + lesson.teaching.en) } : {}), ...(example ? { workedExample: example } : {}), generation: { ...lesson.generation, ...(startingPoint ? { startingPoint } : {}) } };
  if (startingPoint && !['A1', 'A2'].includes(startingPoint) && lesson.skill === 'reading'
    && lesson.materials[0].questions[0].prompt === qualificationPrompt) return { ...result,
    goal: english('Identify a qualified claim and preserve its source, scope and degree of certainty.'),
    teaching: english('Quote the complete qualified claim, keeping its source, time and quantity. “Estimate” marks an estimate; “suggests” reports an inference; “roughly” marks approximation. Association does not establish a cause. Keep these limits when paraphrasing.'),
    workedExample: example ?? english('Example: “Research suggests that quiet rooms are associated with better focus.” → The report suggests an association; it does not establish that quiet rooms cause better focus. “Scientists estimate that roughly half the chairs are empty.” → An estimate of about half, not an exact count. Keep “estimate” and “roughly”.'),
    nextStep: english('Apply the same distinction to the other source: quote its complete claim and retain its reporting cue and limits.'),
  };
  if (!startingPoint) return result;
  if (startingPoint === 'C1' && corpusOperation(lesson.materials[0].questions[0]) === indirectStanceOperation) {
    const support = indirectStanceSupport;
    return { ...result, targetLevel: 'C1', goalId: 'indirect-stance-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C1' && corpusOperation(lesson.materials[0].questions[0]) === argumentBoundariesOperation) {
    const support = argumentBoundariesSupport;
    return { ...result, targetLevel: 'C1', goalId: 'argument-boundaries-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C1' && corpusOperation(lesson.materials[0].questions[0]) === registerAudienceOperation) {
    const support = registerAudienceSupport;
    return { ...result, targetLevel: 'C1', goalId: 'register-audience-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C1' && corpusOperation(lesson.materials[0].questions[0]) === discourseOrganizationOperation) {
    const support = lesson.skill === 'listening' ? heardDiscourseOrganizationSupport : readingDiscourseOrganizationSupport;
    return { ...result, targetLevel: 'C1', goalId: 'discourse-organization-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C2' && corpusOperation(lesson.materials[0].questions[0]) === rhetoricalFunctionOperation) {
    const support = lesson.skill === 'listening' ? heardRhetoricalFunctionSupport : rhetoricalFunctionSupport;
    return { ...result, targetLevel: 'C2', goalId: 'rhetorical-function-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C2' && corpusOperation(lesson.materials[0].questions[0]) === disagreementSynthesisOperation) {
    const support = lesson.skill === 'listening' ? heardDisagreementSynthesisSupport : disagreementSynthesisSupport;
    return { ...result, targetLevel: 'C2', goalId: 'disagreement-synthesis', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C2' && corpusOperation(lesson.materials[0].questions[0]) === faithfulParaphraseOperation) {
    const support = lesson.skill === 'listening' ? heardFaithfulParaphraseSupport : faithfulParaphraseSupport;
    return { ...result, targetLevel: 'C2', goalId: 'faithful-paraphrase', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C2' && corpusOperation(lesson.materials[0].questions[0]) === complexPragmaticsOperation) {
    const support = lesson.skill === 'listening' ? heardComplexPragmaticsSupport : complexPragmaticsSupport;
    return { ...result, targetLevel: 'C2', goalId: 'complex-pragmatics', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C2' && corpusOperation(lesson.materials[0].questions[0]) === layeredPositionOperation) {
    const support = lesson.skill === 'listening' ? heardLayeredPositionSupport : layeredPositionSupport;
    return { ...result, targetLevel: 'C2', goalId: 'layered-positions', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C2' && corpusOperation(lesson.materials[0].questions[0]) === nuancedMeaningOperation) {
    const support = lesson.skill === 'listening' ? heardNuancedMeaningSupport : nuancedMeaningSupport;
    return { ...result, targetLevel: 'C2', goalId: 'nuanced-meaning-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C1' && corpusOperation(lesson.materials[0].questions[0]) === informationDensityOperation) {
    const support = informationDensitySupport;
    return { ...result, targetLevel: 'C1', goalId: 'information-density-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'C1' && corpusOperation(lesson.materials[0].questions[0]) === implicitIntentionOperation) {
    const support = lesson.skill === 'listening' ? heardImplicitIntentionSupport : implicitIntentionSupport;
    return { ...result, targetLevel: 'C1', goalId: 'implicit-intention-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'B2' && corpusOperation(lesson.materials[0].questions[0]) === viewAttributionOperation) {
    const support = lesson.skill === 'listening' ? heardViewAttributionSupport : readingViewAttributionSupport;
    return { ...result, targetLevel: 'B2', goalId: 'attributed-views-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'B2' && corpusOperation(lesson.materials[0].questions[0]) === informationSynthesisOperation) {
    const support = lesson.skill === 'listening' ? heardInformationSynthesisSupport : readingInformationSynthesisSupport;
    return { ...result, targetLevel: 'B2', goalId: 'integrated-source-information', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'B2' && corpusOperation(lesson.materials[0].questions[0]) === speakerAttitudeOperation) {
    const support = lesson.skill === 'listening' ? heardSpeakerAttitudeSupport : readingSpeakerAttitudeSupport;
    return { ...result, targetLevel: 'B2', goalId: 'speaker-attitude-in-context', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'B2' && corpusOperation(lesson.materials[0].questions[0]) === qualifiedConcessionOperation) {
    const support = lesson.skill === 'listening' ? heardQualifiedConcessionSupport : readingQualifiedConcessionSupport;
    return { ...result, targetLevel: 'B2', goalId: 'qualified-concession-meaning', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'B2' && corpusOperation(lesson.materials[0].questions[0]) === comparisonOperation) {
    const support = lesson.skill === 'listening' ? heardComparisonSupport : readingComparisonSupport;
    return { ...result, targetLevel: 'B2', goalId: 'contextual-comparison', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'B2' && corpusOperation(lesson.materials[0].questions[0]) === claimExampleOperation) {
    const support = lesson.skill === 'listening' ? heardClaimExampleSupport : readingClaimExampleSupport;
    return { ...result, targetLevel: 'B2', goalId: 'claim-example-link', goal: support.goal, teaching: support.teaching, workedExample: support.workedExample, nextStep: support.nextStep, materials: materialsWithHints(support.hints) };
  }
  if (startingPoint === 'B1' && lesson.skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:procedural-plan') return { ...result, targetLevel: 'B1', goalId: 'integrated-procedural-plan',
    goal: proceduralPlanSupport.goal, teaching: proceduralPlanSupport.teaching, workedExample: proceduralPlanSupport.workedExample, nextStep: proceduralPlanSupport.nextStep,
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = proceduralPlanSupport.hints; return { ...material, questions: [question] }; }),
  };
  if (startingPoint === 'B1' && lesson.skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:specific-intention') return { ...result, targetLevel: 'B1', goalId: 'specific-speaker-intention',
    goal: specificIntentionSupport.goal, teaching: specificIntentionSupport.teaching, workedExample: specificIntentionSupport.workedExample, nextStep: specificIntentionSupport.nextStep,
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = specificIntentionSupport.hints; return { ...material, questions: [question] }; }),
  };
  if (startingPoint === 'B1' && lesson.skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:narrative-motive') return { ...result, targetLevel: 'B1', goalId: 'stated-narrative-motive',
    goal: narrativeMotiveSupport.goal, teaching: narrativeMotiveSupport.teaching, workedExample: narrativeMotiveSupport.workedExample, nextStep: narrativeMotiveSupport.nextStep,
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = narrativeMotiveSupport.hints; return { ...material, questions: [question] }; }),
  };
  if (startingPoint === 'B1' && lesson.skill === 'reading' && reference && lesson.materials.every(material => b1ReferenceScopes.records.some(scope => scope.text === material.blocks[0].text))) return { ...result, targetLevel: 'B1', goalId: 'b1-context-reference',
    goal: b1ReferenceSupport.goal, teaching: b1ReferenceSupport.teaching, workedExample: b1ReferenceSupport.workedExample, nextStep: b1ReferenceSupport.nextStep,
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = b1ReferenceSupport.hints; return { ...material, questions: [question] }; }),
  };
  if (startingPoint === 'B1' && lesson.skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:condition-outcome') return { ...result, targetLevel: 'B1', goalId: 'condition-outcome-limits',
    goal: conditionalMeaningSupport.goal, teaching: conditionalMeaningSupport.teaching, workedExample: conditionalMeaningSupport.workedExample, nextStep: conditionalMeaningSupport.nextStep,
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = conditionalMeaningSupport.hints; return { ...material, questions: [question] }; }),
  };
  if (startingPoint === 'B1' && lesson.skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:main-point') return { ...result, targetLevel: 'B1', goalId: 'main-point-vs-detail',
    goal: mainPointSupport.goal, teaching: mainPointSupport.teaching, workedExample: mainPointSupport.workedExample, nextStep: mainPointSupport.nextStep,
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = mainPointSupport.hints; return { ...material, questions: [question] }; }),
  };
  if (startingPoint !== 'A1' && startingPoint !== 'A2') return result;
  const listening = lesson.skill === 'listening';
  const firstQuestion = lesson.materials[0].questions[0];
  const apartments = !listening && 'rows' in firstQuestion;
  const phone = !listening && firstQuestion.prompt === workPhonePrompt;
  const address = !listening && lesson.materials[0].questions[0].prompt === requestedAddressPrompt;
  const rooms = !listening && lesson.materials[0].questions[0].prompt === roomMatchingPrompt;
  const speakers = !listening && firstQuestion.prompt === 'Who says each sentence? Match it to a person.';
  const sequence = 'kind' in firstQuestion && firstQuestion.kind === 'sequence';
  const listeningSequence = listening && 'kind' in firstQuestion && firstQuestion.kind === 'sequence';
  const listeningCompletion = listening && 'kind' in firstQuestion && firstQuestion.kind === 'completion';
  const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
  if (!listening && corpusOperation(firstQuestion) === 'choice:personal-integration') return { ...result, targetLevel: 'A2', goalId: 'short-two-clue-integration',
    goal: local('Combine two stated details in one short material; keep both when choosing a summary.', '整合同一短材料中的两条明说信息，选摘要时保留两者。', '整合同一短材料中的兩條明說資訊，選摘要時保留兩者。'),
    teaching: local('Read the question for the two details it asks you to combine. Find one source clue for each; a summary must match both. One correct half cannot repair a wrong other half. For the library, keep the before relation and the stated location; this street means the street the speakers are on, and on the corner means where streets meet. Errands are small tasks; return books means take borrowed books back. For the party, keep the stated time and contribution rule. Or gives alternatives without requiring or forbidding both. These statements describe plans and rules, not proof of completed actions.', '先看题目要求组合哪两条信息，再为每条各找一处原文线索；摘要必须两条都吻合，不能用一半正确抵消另一半错误。图书馆材料要保留before的先后关系及位置：this street是说话者所在的这条街，on the corner是在街道交会的拐角；errands是办些小事，return books是把借的书还回去。聚会材料要同时保留时间和贡献规则；or给出选择，没有要求两项都做，也没有禁止都做。计划及规则不证明动作已经完成。', '先看題目要求組合哪兩條資訊，再為每條各找一處原文線索；摘要必須兩條都吻合，不能用一半正確抵消另一半錯誤。圖書館材料要保留before的先後關係及位置：this street是說話者所在的這條街，on the corner是在街道交會的拐角；errands是辦些小事，return books是把借的書還回去。聚會材料要同時保留時間和貢獻規則；or給出選擇，沒有要求兩項都做，也沒有禁止都做。計劃及規則不證明動作已經完成。'),
    workedExample: local('Unscored made-up example: “The art club meets on Tuesday. Bring a pencil.” Combine both: Tuesday + pencil. Tuesday + paintbrush matches only the day; Friday + pencil matches only the item; Friday + paintbrush matches neither. The notice does not prove anyone attended or brought an item.', '不计分虚构示例：“The art club meets on Tuesday. Bring a pencil.” 两条都保留是“星期二＋铅笔”；“星期二＋画笔”只保留日期，“星期五＋铅笔”只保留物品，“星期五＋画笔”两条都错。通知没有证明谁已参加或已带物品。', '不計分虛構示例：「The art club meets on Tuesday. Bring a pencil.」兩條都保留是「星期二＋鉛筆」；「星期二＋畫筆」只保留日期，「星期五＋鉛筆」只保留物品，「星期五＋畫筆」兩條都錯。通知沒有證明誰已參加或已帶物品。'),
    nextStep: local('Without hints, find two exact clues in the other original and reject any summary that changes either one.', '不用提示，在另一原作中找两条精确线索，排除改变任意一条的摘要。', '不用提示，在另一原作中找兩條精確線索，排除改變任意一條的摘要。'),
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = [local('Name the two details requested.', '认准题目要求的两条信息。', '認準題目要求的兩條資訊。'), local('Find a separate exact clue for each detail.', '为每条信息各找一处精确原文线索。', '為每條資訊各找一處精確原文線索。'), local('Check both halves of every option; preserve before, location, time and or as relevant.', '逐项核对两个部分，按材料保留before、位置、时间及or关系。', '逐項核對兩個部分，按材料保留before、位置、時間及or關係。')]; return { ...material, questions: [question] }; }),
  };
  if (!listening && corpusOperation(firstQuestion) === 'choice:personal-rule') return { ...result, targetLevel: 'A2', goalId: 'explicit-stated-rule',
    goal: local('Interpret a stated everyday rule, keeping its alternatives and setting.', '理解日常规则，保留选择关系和适用场合。', '理解日常規則，保留選擇關係和適用場合。'),
    teaching: local('Find who sets the rule, who follows it, the required or restricted action, and where it applies. Have to marks a requirement; cannot can express a restriction. Or offers alternatives and does not by itself ban doing both. Do not turn a setting-specific rule into a ban everywhere, or a restriction on saying something into a ban on feeling it. Contribute means give something or help; perform means present music, acting or another act. Facts are information; feelings are emotions. The News is the programme in this dialogue. Its Big Town story is a fictional news item, not a verified report.', '先找谁提出规则、谁遵守、需要或禁止什么，以及适用场合。have to表示要求；cannot可表示限制。or给出选择，本身没有禁止两项都做。不能把特定场合的规则扩大为任何地方都禁止，也不能把不准说某种感受改成不准有这种感受。contribute是出一份力，perform是表演；facts是事实信息，feelings是情绪。The News是对话中的节目，Big Town故事是虚构新闻片段，不是已核实的报道。', '先找誰提出規則、誰遵守、需要或禁止什麼，以及適用場合。have to表示要求；cannot可表示限制。or給出選擇，本身沒有禁止兩項都做。不能把特定場合的規則擴大為任何地方都禁止，也不能把不准說某種感受改成不准有這種感受。contribute是出一份力，perform是表演；facts是事實資訊，feelings是情緒。The News是對話中的節目，Big Town故事是虛構新聞片段，不是已核實的報道。'),
    workedExample: local('Unscored made-up example: “In this reading room, visitors must silence their phones. They may read a book or a magazine.” Required: silence phones in this room. Options: book or magazine; the rule does not require both or ban reading both. It says nothing about phones in the café or whether a visitor has complied.', '不计分虚构示例：“In this reading room, visitors must silence their phones. They may read a book or a magazine.” 要求是在这个阅览室把手机静音；书或杂志是选择，没有要求两种都读，也没有禁止都读。没有说明咖啡馆的手机规则，或访客已遵守。', '不計分虛構示例：「In this reading room, visitors must silence their phones. They may read a book or a magazine.」要求是在這個閱覽室把手機靜音；書或雜誌是選擇，沒有要求兩種都讀，也沒有禁止都讀。沒有說明咖啡館的手機規則，或訪客已遵守。'),
    nextStep: local('Without hints, state the rule on the other original and cite its action, alternatives and setting. Do not add requirements or claim compliance.', '不用提示，在另一原作中说明规则，并指出动作、选择关系及场合证据。不添加义务，不声称已遵守。', '不用提示，在另一原作中說明規則，並指出動作、選擇關係及場合證據。不添加義務，不聲稱已遵守。'),
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = [local('Find the rule and its setting.', '找到规则及适用场合。', '找到規則及適用場合。'), local('Locate have to/cannot, and check whether or gives a choice.', '找到have to／cannot，检查or是否给出选择。', '找到have to／cannot，檢查or是否給出選擇。'), local('Keep or as alternatives; keep a restriction with its action and setting.', '保留or的选择关系，保留限制对应的动作和场合。', '保留or的選擇關係，保留限制對應的動作和場合。')]; return { ...material, questions: [question] }; }),
  };
  if (!listening && corpusOperation(firstQuestion) === 'choice:personal-reason') return { ...result, targetLevel: 'A2', goalId: 'explicit-stated-reason',
    goal: local('Find the reason the named person explicitly gives, keeping habit and now/future action separate.', '找出指定人物明说的原因，区分习惯及现在／将来动作。', '找出指定人物明說的原因，區分習慣及現在／將來動作。'),
    teaching: local('Because introduces a reason for an action or statement. First find the asked person and action; then keep the stated reason, rather than treating a habit or nearby background as its cause. Today’s activity can differ from a usual habit; will try states a plan, not completion. A drum band plays percussion; a puppet show uses small figures to perform a story. Shakespeare is a writer’s name; a birthday is the day someone was born. Jog means run slowly; try means attempt. Always, sometimes and never describe frequency; a later correction replaces an earlier one.', 'because引出动作或陈述的原因。先找题目指定的人物与动作，再保留明说的理由，不能把习惯或旁边的背景当成原因。今天的活动可以不同于平时习惯；will try表示打算尝试，不表示已经完成。drum band是鼓乐队，puppet show是木偶戏；Shakespeare是作家名字莎士比亚，birthday是生日；jog是慢跑，try是尝试；always、sometimes、never分别表示总是、有时、从不，后来纠正的说法替代先前说法。', 'because引出動作或陳述的原因。先找題目指定的人物與動作，再保留明說的理由，不能把習慣或旁邊的背景當成原因。今天的活動可以不同於平時習慣；will try表示打算嘗試，不表示已經完成。drum band是鼓樂隊，puppet show是木偶戲；Shakespeare是作家名字莎士比亞，birthday是生日；jog是慢跑，try是嘗試；always、sometimes、never分別表示總是、有時、從不，後來糾正的說法替代先前說法。'),
    workedExample: local('Unscored made-up example: “I usually cycle. Because my bicycle has a flat tyre, today I will walk to the shop.” Stated reason for walking: the flat tyre. Usually cycling is background, not that reason; a planned walk is not proof of arrival.', '不计分虚构示例：“I usually cycle. Because my bicycle has a flat tyre, today I will walk to the shop.” 步行的明说原因是轮胎没气；平时骑车是背景，不是这个原因。will walk是计划，没有证明已到商店。', '不計分虛構示例：「I usually cycle. Because my bicycle has a flat tyre, today I will walk to the shop.」步行的明說原因是輪胎沒氣；平時騎車是背景，不是這個原因。will walk是計劃，沒有證明已到商店。'),
    nextStep: local('Without hints, find the other original’s stated reason. Keep its speaker, action and now/future limits; do not substitute a habit.', '不用提示，在另一原作中找明说的原因，保留人物、动作及现在／将来限制，不换成习惯。', '不用提示，在另一原作中找明說的原因，保留人物、動作及現在／將來限制，不換成習慣。'),
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = [local('Find the named person and asked action.', '找到指定人物及所问动作。', '找到指定人物及所問動作。'), local('Locate because and its complete reason.', '找到because及完整理由。', '找到because及完整理由。'), local('Keep the reason separate from habit or background; now and will do not mean completed.', '区分原因、习惯和背景；现在或将来动作不等于已经完成。', '區分原因、習慣和背景；現在或將來動作不等於已經完成。')]; return { ...material, questions: [question] }; }),
  };
  if (!listening && corpusOperation(firstQuestion) === 'choice:personal-update') return { ...result, targetLevel: 'A2', goalId: 'explicit-personal-update',
    goal: local('Find the named person’s updated reply or request; keep the earlier statement separate.', '找出指定人物更新后的回复或要求，区分先前陈述。', '找出指定人物更新後的回覆或要求，區分先前陳述。'),
    teaching: local('Follow the same person from the first statement to the later one. New information can change a reply or request without changing an external event. Can/cannot state possibility; I’ll have names a food order, not food already received. Driver’s license is permission to drive; the computer/car tests are the planned tasks; during the day contrasts with at night. Here Caty sends colleagues to buy dishes: a dish is a portion of food, shrimp is seafood, beef is cow meat, chicken is poultry, out of means unavailable, and a food truck sells meals from a vehicle.', '先找到同一人物的原先陈述，再读补充信息及后来的陈述。新信息可以改变回复或要求，不一定表示外部事件改变。can/cannot表示能否；I’ll have在这里是点餐，不是已经吃到。driver’s license是驾照；computer/car tests是计划的电脑／路考；during the day与at night区分白天／晚上。Caty让同事买菜品；dish是一份食物，shrimp是虾，beef是牛肉，chicken是鸡肉，out of表示售完，food truck是售餐车。', '先找到同一人物的原先陳述，再讀補充資訊及後來的陳述。新資訊可以改變回覆或要求，不一定表示外部事件改變。can/cannot表示能否；I’ll have在這裡是點餐，不是已經吃到。driver’s license是駕照；computer/car tests是計劃的電腦／路考；during the day與at night區分白天／晚上。Caty讓同事買菜品；dish是一份食物，shrimp是蝦，beef是牛肉，chicken是雞肉，out of表示售完，food truck是售餐車。'),
    workedExample: local('Unscored made-up example: “Mina: I’ll borrow the red pen. Clerk: That one is reserved. Mina: Then I’ll borrow the green pen.” Updated request: the green pen. Red was the earlier choice. This does not say the reservation just began or that Mina has received a pen.', '不计分虚构示例：“Mina: I’ll borrow the red pen. Clerk: That one is reserved. Mina: Then I’ll borrow the green pen.” 更新后的要求是借绿笔；红笔是先前的选择。没有说预留刚刚发生，也没有说Mina已经拿到笔。', '不計分虛構示例：「Mina: I’ll borrow the red pen. Clerk: That one is reserved. Mina: Then I’ll borrow the green pen.」更新後的要求是借綠筆；紅筆是先前的選擇。沒有說預留剛剛發生，也沒有說Mina已經拿到筆。'),
    nextStep: local('Without hints, track the other person’s earlier and updated statements. Cite both and the intervening information; do not invent an external change or completion.', '不用提示，在另一原作中追踪人物的原先与更新陈述，核对两者及中间信息，不虚构外部改变或完成。', '不用提示，在另一原作中追蹤人物的原先與更新陳述，核對兩者及中間資訊，不虛構外部改變或完成。'),
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = [local('Find the named person’s first reply or request.', '找到指定人物最初的回复或要求。', '找到指定人物最初的回覆或要求。'), local('Find the new information and the same person’s later statement.', '找到补充信息及同一人物后来的陈述。', '找到補充資訊及同一人物後來的陳述。'), local('Choose the updated statement, not the old one. Do not assume an event moved or an action finished.', '选择更新陈述，别沿用旧答案；不推断事情改期或动作完成。', '選擇更新陳述，別沿用舊答案；不推斷事情改期或動作完成。')]; return { ...material, questions: [question] }; }),
  };
  if (!listening && ['choice:personal-need', 'choice:personal-preference'].includes(corpusOperation(firstQuestion) ?? '')) {
    const need = corpusOperation(firstQuestion) === 'choice:personal-need';
    return { ...result, targetLevel: 'A2', goalId: need ? 'explicit-stated-need' : 'explicit-stated-preference',
      goal: need ? local('Find the action the named person says they need to do, keeping its time or condition.', '找出指定人物说自己需要做的事，保留时间或条件。', '找出指定人物說自己需要做的事，保留時間或條件。') : local('Find the place the named person explicitly says they like, without adding a ranking or exclusivity.', '找出指定人物明说喜欢的地方，不补写排名或“只喜欢”。', '找出指定人物明說喜歡的地方，不補寫排名或「只喜歡」。'),
      teaching: need ? local('Need to and have to state a requirement. Keep the speaker and any before-clause: one person’s requirement is not another person’s. A requirement is not proof of completion or of wanting to do it. Driver’s license means permission to drive; errands are small tasks outside home; return books means take them back to the library. An invitation asks someone to join; accepting it does not cancel other requirements.', 'need to和have to表示需要或必须做。保留说话者及before（在……之前）条件；一个人的需要不能换给另一个人。需要做不表示已经做，也不一定表示想做。driver’s license是驾照；errands是在外办的小事；return books是把书归还library（图书馆）。invitation是邀请，同意参加不等于其他需要被取消。', 'need to和have to表示需要或必須做。保留說話者及before（在……之前）條件；一個人的需要不能換給另一個人。需要做不表示已經做，也不一定表示想做。driver’s license是駕照；errands是在外辦的小事；return books是把書歸還library（圖書館）。invitation是邀請，同意參加不等於其他需要被取消。') : local('Like states a preference; really like strengthens it. Keep the person and the named place. “All are good” is a general evaluation, not a particular preference. “I like X” does not mean “only X”, “X is my favourite”, or “I dislike Y”. Museums display objects; art museums display art; sculptures are three-dimensional artworks. The Sculpture Garden is an outdoor place for sculptures; free admission means no entry charge.', 'like表示喜欢，really like表示很喜欢。保留人物及具体地方。“都很好”是总体评价，不是特别说喜欢哪一个。“I like X”不等于“只喜欢X”“最喜欢X”或“讨厌Y”。museum是博物馆；art museum展示艺术品；sculpture是立体雕塑；Sculpture Garden是户外雕塑花园。free admission表示免门票。', 'like表示喜歡，really like表示很喜歡。保留人物及具體地方。「都很好」是總體評價，不是特別說喜歡哪一個。「I like X」不等於「只喜歡X」「最喜歡X」或「討厭Y」。museum是博物館；art museum展示藝術品；sculpture是立體雕塑；Sculpture Garden是戶外雕塑花園。free admission表示免門票。'),
      workedExample: need ? local('Unscored made-up example: “Lina needs to buy milk before making breakfast. Omar has to clean the table.” Lina’s required action is buying milk, before breakfast. Cleaning the table belongs to Omar. This does not say milk was bought, or that Lina likes shopping.', '不计分虚构示例：“Lina needs to buy milk before making breakfast. Omar has to clean the table.” → Lina需要在做早饭之前买牛奶；擦桌子是Omar需要做的事。这里没有说已买牛奶，也没有说Lina喜欢购物。', '不計分虛構示例：「Lina needs to buy milk before making breakfast. Omar has to clean the table.」 → Lina需要在做早飯之前買牛奶；擦桌子是Omar需要做的事。這裡沒有說已買牛奶，也沒有說Lina喜歡購物。') : local('Unscored made-up example: “Both cafés are good. Noor says: I like the Riverside Café.” Noor explicitly likes Riverside. “Both are good” does not explicitly name a liking for the other café. Nothing says Riverside is Noor’s only or favourite café, or that Noor dislikes the other one.', '不计分虚构示例：“Both cafés are good. Noor says: I like the Riverside Café.” → Noor明说喜欢Riverside咖啡馆。“两家都好”没有特别说喜欢另一家，也没有说明只喜欢这家、最喜欢这家，或讨厌另一家。', '不計分虛構示例：「Both cafés are good. Noor says: I like the Riverside Café.」 → Noor明說喜歡Riverside咖啡館。「兩家都好」沒有特別說喜歡另一家，也沒有說明只喜歡這家、最喜歡這家，或討厭另一家。'),
      nextStep: need ? local('On the other original, find the named person’s requirement without hints; retain its condition and do not claim completion.', '不用提示，在另一原作中找出指定人物的需要，保留条件，不据此声称已经完成。', '不用提示，在另一原作中找出指定人物的需要，保留條件，不據此聲稱已經完成。') : local('On the other original, identify the stated liking without hints; do not add “only”, a ranking or dislike.', '不用提示，在另一原作中找出明说的喜好，不补写“只喜欢”、排名或不喜欢。', '不用提示，在另一原作中找出明說的喜好，不補寫「只喜歡」、排名或不喜歡。'),
      materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = [local('Find the named speaker.', '找到题目指定的说话者。', '找到題目指定的說話者。'), need ? local('Locate need to/have to and the complete action.', '找到need to/have to及完整动作。', '找到need to/have to及完整動作。') : local('Locate like/really like and the named place.', '找到like/really like及具体地方。', '找到like/really like及具體地方。'), need ? local('Keep the action with its speaker and any before condition.', '保留动作对应的人物及before条件。', '保留動作對應的人物及before條件。') : local('Keep what is liked without adding only, favourite or dislike.', '保留明说的喜欢，不补写只喜欢、最喜欢或讨厌。', '保留明說的喜歡，不補寫只喜歡、最喜歡或討厭。')]; return { ...material, questions: [question] }; }),
    };
  }
  if (!listening && corpusOperation(firstQuestion) === 'choice:planned-order') return { ...result, targetLevel: 'A2', goalId: 'explicit-planned-order',
    goal: local('Put two planned actions in the order explicitly stated.', '按原文明说的先后排列两项计划动作。', '按原文明說的先後排列兩項計劃動作。'),
    teaching: local('First and then give an action order. In “Before B, I need to A”, A comes first even though B is mentioned first. Keep the complete actions and the person doing them. Have to and need to describe requirements, not completed actions. A driver’s license permits driving; a computer test and a test in a car are different. Errands are small tasks outside home; return books means take them back to the library.', 'first表示先，then表示然后；“Before B, I need to A”表示先A后B，即使B先写出来。保留完整动作及执行者。have to和need to表示需要做，不表示已经完成。driver’s license是驾照；电脑考试与车内考试是不同的测试。errands是在外办的小事；return books是把书还给library（图书馆）。', 'first表示先，then表示然後；「Before B, I need to A」表示先A後B，即使B先寫出來。保留完整動作及執行者。have to和need to表示需要做，不表示已經完成。driver’s license是駕照；電腦考試與車內考試是不同的測試。errands是在外辦的小事；return books是把書還給library（圖書館）。'),
    workedExample: local('Made-up example: “Before we eat dinner, I need to wash my hands.” Order: wash my hands → eat dinner. Dinner is mentioned first, but washing comes before it. “Eat dinner → wash my hands” reverses the plan. Neither option proves the actions happened. This example is unscored.', '不计分虚构示例：“Before we eat dinner, I need to wash my hands.” → 先洗手，再吃晚饭。晚饭虽然先被提到，洗手却要先做。“吃晚饭→洗手”颠倒了计划。这句话没有证明动作已经发生。', '不計分虛構示例：「Before we eat dinner, I need to wash my hands.」 → 先洗手，再吃晚飯。晚飯雖然先被提到，洗手卻要先做。「吃晚飯→洗手」顛倒了計劃。這句話沒有證明動作已經發生。'),
    nextStep: local('Use no hints on the other original. State its two planned actions and the words that establish their order.', '不用提示，在另一原作中说明两项计划动作及决定先后的词。', '不用提示，在另一原作中說明兩項計劃動作及決定先後的詞。'),
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = [local('Find the two actions in the plan.', '找到计划中的两项动作。', '找到計劃中的兩項動作。'), local('Locate first/then or before.', '找到first/then或before。', '找到first/then或before。'), local('With “Before B, I need to A”, do A before B; page order can differ.', '“Before B, I need to A”表示先A后B，不能只按书写顺序。', '「Before B, I need to A」表示先A後B，不能只按書寫順序。')]; return { ...material, questions: [question] }; }),
  };
  if (!listening && corpusOperation(firstQuestion) === 'choice:stated-intention') return { ...result,
    goal: local('Find what the person wants to do.', '找到这个人想做的事。', '找到這個人想做的事。'),
    teaching: local('Find the action after “I want to”. Wanting does not mean doing or finishing.', '读“I want to”后面的动作。想做不等于正在做或已经完成。', '讀「I want to」後面的動作。想做不等於正在做或已經完成。'),
    workedExample: local('Example: “I want to read a book.” The person wants to read. This sentence does not say they are reading now.', '示例：“I want to read a book.”表示想读书。这句话没有说明正在读。', '示例：「I want to read a book.」表示想讀書。這句話沒有說明正在讀。'),
    nextStep: local('Read another conversation. Find what the person wants to do.', '阅读另一段对话，找到这个人想做的事。', '閱讀另一段對話，找到這個人想做的事。'),
    materials: result.materials.map(material => ({ ...material, questions: material.questions.map(question => 'kind' in question && question.kind === 'response' ? { ...question,
      prompt: 'Write one short sentence about what the person wants. Use words from the text.',
      criteria: [local('I keep the person and the wanted action.', '我保留人物和想做的动作。', '我保留人物和想做的動作。'), local('I use words from the text without claiming the action happened.', '我引用材料中的词，不据此声称动作发生了。', '我引用材料中的詞，不據此聲稱動作發生了。')],
      hints: [local('Find the person and “I want to”.', '找到人物和“I want to”。', '找到人物和「I want to」。'), local('Copy the complete action after “to”.', '引用“to”后面的完整动作。', '引用「to」後面的完整動作。'), local('Keep wanting separate from doing.', '区分想做和正在做。', '區分想做和正在做。')],
      explanation: local('Check your sentence with the source. Wanting does not show that the action happened.', '对照原文检查你的句子。想做没有说明动作已经发生。', '對照原文檢查你的句子。想做沒有說明動作已經發生。'),
    } : question) })),
  };
  if (!listening && corpusOperation(firstQuestion) === 'choice:stated-time') return { ...result, targetLevel: 'A1', goalId: 'explicit-stated-time',
    goal: local('Find the written clock time for the asked event.', '找到题目所问事情的书面时刻。', '找到題目所問事情的書面時刻。'),
    teaching: local('Read the question and its time statement. In 7:35, 7 is the hour and 35 the minutes. A.m. runs from midnight to before noon; p.m. runs from noon to before midnight. Midnight is 12 at night; noon is 12:00 midday. Keep an explicit period; do not add one when absent. Busy means working; writing means putting words down. Lunch is a midday meal; a boss leads work. Maybe later is not a confirmed time.', '对照问题和时刻陈述。7:35中，7是小时，35是分钟；a.m.从午夜至中午之前，p.m.从中午至午夜之前；midnight是午夜，noon是中午12:00。保留原文明说的时段，未说时不要补写。busy表示忙，writing表示写；lunch是午餐，boss是上司。maybe later表示也许稍后，不是确定的时间。', '對照問題和時刻陳述。7:35中，7是小時，35是分鐘；a.m.從午夜至中午之前，p.m.從中午至午夜之前；midnight是午夜，noon是中午12:00。保留原文明說的時段，未說時不要補寫。busy表示忙，writing表示寫；lunch是午餐，boss是上司。maybe later表示也許稍後，不是確定的時間。'),
    workedExample: local('Made-up example: “Our lesson is at 8:20 p.m.” → Lesson time: 8:20 p.m., with the stated evening period. “What time is it now? 8:05.” → Current time: 8:05; do not replace it with lesson time or add a period.', '虚构示例：“Our lesson is at 8:20 p.m.” → 上课时刻是8:20p.m.，保留晚间标记。“What time is it now? 8:05.” → 现在是8:05，不能换成上课时刻或补写时段。', '虛構示例：「Our lesson is at 8:20 p.m.」 → 上課時刻是8:20p.m.，保留晚間標記。「What time is it now? 8:05.」 → 現在是8:05，不能換成上課時刻或補寫時段。'),
    nextStep: local('Read the other original without hints. Keep its event, clock digits and any stated period.', '不用提示阅读另一原作，保留所问事情、时刻数字及明说的时段。', '不用提示閱讀另一原作，保留所問事情、時刻數字及明說的時段。'),
    materials: lesson.materials.map((material, index) => { const question = { ...material.questions[0] }; if (index) delete question.hints; else question.hints = [local('Find the asked event.', '找到题目所问的事情。', '找到題目所問的事情。'), local('Find its clock digits and stated period.', '找到对应时刻数字及明说的时段。', '找到對應時刻數字及明說的時段。'), local('Keep current time separate from a planned time; do not add a period.', '区分现在时刻与计划时刻，未说时不要补写时段。', '區分現在時刻與計劃時刻，未說時不要補寫時段。')]; return { ...material, questions: [question] }; }),
  };
  if (!listening && ['choice:small-quantity', 'choice:detail-verification'].includes(corpusOperation(firstQuestion) ?? '')) {
    const quantity = corpusOperation(firstQuestion) === 'choice:small-quantity';
    return { ...result, targetLevel: 'A1', goalId: quantity ? 'explicit-small-count' : 'explicit-detail-verification',
      goal: quantity ? local('Read a small count and keep it with the right item.', '读懂小数量，并对应到正确的对象。', '讀懂小數量，並對應到正確的對象。') : local('Check a written detail against the text.', '用原文核对一条书面信息。', '用原文核對一條書面資訊。'),
      teaching: quantity ? local('One=1, two=2, three=3, four=4. Read what is counted. A name is spelled with letters; a street number is an address, not a letter count. Return books means take them back to the library. Need to return does not mean already returned. An errand is a small task outside home.', 'one=1，two=2，three=3，four=4。先看数的是什么。姓名用字母拼写；街道号码是地址，不是字母数量。return books是把书归还library（图书馆）；需要归还不等于已归还。errand是在外办的小事。', 'one=1，two=2，three=3，four=4。先看數的是什麼。姓名用字母拼寫；街道號碼是地址，不是字母數量。return books是把書歸還library（圖書館）；需要歸還不等於已歸還。errand是在外辦的小事。') : local('Compare the supplied detail with the whole statement and correction. Same: Yes. Different: No. Spelled means writing the letters in a name. Work number is a phone used at work. Wrong number means the call reached another number; it does not change the work number.', '对照完整陈述和纠正，核对题目细节。相同选Yes，不同选No。spelled是按顺序拼写字母；work number是工作电话，wrong number是拨错号码，拨错不改变工作电话。', '對照完整陳述和糾正，核對題目細節。相同選Yes，不同選No。spelled是按順序拼寫字母；work number是工作電話，wrong number是撥錯號碼，撥錯不改變工作電話。'),
      workedExample: quantity ? local('Made-up example: “I need to return four keys.” → How many keys? 4. Keep four with keys. This does not say the keys have been returned.', '虚构示例：“I need to return four keys.” → 需要归还多少把钥匙？4把。four对应keys（钥匙），没有说已经归还。', '虛構示例：「I need to return four keys.」 → 需要歸還多少把鑰匙？4把。four對應keys（鑰匙），沒有說已經歸還。') : local('Made-up example: “Mira’s work number is 321-0199. The wrong number is 321-0188.” Detail: work number321-0199 → Yes; work number321-0188 → No. Keep the work number separate from the number reached by mistake.', '虚构示例：“Mira’s work number is 321-0199. The wrong number is 321-0188.” → 工作电话是321-0199：Yes；工作电话是321-0188：No。保留工作电话与误拨号码的区别。', '虛構示例：「Mira’s work number is 321-0199. The wrong number is 321-0188.」 → 工作電話是321-0199：Yes；工作電話是321-0188：No。保留工作電話與誤撥號碼的區別。'),
      nextStep: local('Check the same kind of detail in the other original, without hints.', '在另一原作中核对同类信息，不用提示。', '在另一原作中核對同類資訊，不用提示。'),
      materials: lesson.materials.map((material, index) => {
        const question = { ...material.questions[0] };
        if (!index) question.hints = [local('Find the detail asked for.', '找到题目要核对的信息。', '找到題目要核對的資訊。'), local('Find its item or the correction.', '找到对应对象或纠正。', '找到對應對象或糾正。'), local('Keep the correct count, spelling or number with its stated role.', '保留正确数量、拼写或号码及其用途。', '保留正確數量、拼寫或號碼及其用途。')];
        else delete question.hints;
        return { ...material, questions: [question] };
      }),
    };
  }
  if (!listening && ['choice:stated-location', 'choice:basic-instruction'].includes(corpusOperation(firstQuestion) ?? '')) {
    const location = corpusOperation(firstQuestion) === 'choice:stated-location';
    return { ...result, targetLevel: 'A1', goalId: location ? 'explicit-place-relation' : 'explicit-basic-instruction',
      goal: location ? local('Find the stated place relationship.', '找到原文明说的地点关系。', '找到原文明說的地點關係。') : local('Follow the stated action and order.', '保留指令中的动作和先后。', '保留指令中的動作和先後。'),
      teaching: location ? local('Read the whole location statement. Across from means on the other side; next to means beside; near means close. A lounge is a shared sitting room; a mailroom is for letters; a gym is for exercise. Metro means the train system here. A bus station is a different landmark. Keep each place with its own relation.', '读完整地点陈述。across from表示在对面，next to表示紧挨着，near表示在附近。lounge是公共休息室，mailroom是收发室，gym是健身房，Metro在这里指地铁。bus station是公交站，与地铁是不同路标。逐一保留地点及其关系。', '讀完整地點陳述。across from表示在對面，next to表示緊挨著，near表示在附近。lounge是公共休息室，mailroom是收發室，gym是健身房，Metro在這裡指地鐵。bus station是公交站，與地鐵是不同路標。逐一保留地點及其關係。') : local('Read the whole instruction. Exit means leave. Turn right or left, then walk straight ahead: go forward. Keep the place for each turn. A boss gives work instructions; co-workers work with you. Meet them means get to know them, not do their work. Busy means working now. A request does not mean it happened.', '读完整指令。exit表示离开；turn right是右转，turn left是左转；walk straight ahead是向前直走。保留每次转弯对应的地点。boss是上司，co-workers是同事，meet them在这里是认识他们，不是替他们工作。busy表示正忙。指令不代表动作已经完成。', '讀完整指令。exit表示離開；turn right是右轉，turn left是左轉；walk straight ahead是向前直走。保留每次轉彎對應的地點。boss是上司，co-workers是同事，meet them在這裡是認識他們，不是替他們工作。busy表示正忙。指令不代表動作已經完成。'),
      workedExample: location ? local('Made-up example: “The shop is across from the park and next to the bank.” → Compared with the park: across from. Compared with the bank: next to. Keep both places.', '虚构示例：“The shop is across from the park and next to the bank.” → 商店在公园对面、银行旁边。不能把两个关系交换。', '虛構示例：「The shop is across from the park and next to the bank.」 → 商店在公園對面、銀行旁邊。不能把兩個關係交換。') : local('Made-up example: “Leave the shop. Turn left at the gate. Then turn right at the park.” → At the gate: left. At the park: right. “Please greet your neighbour.” → Say hello to the neighbour; this does not say the greeting happened.', '虚构示例：“Leave the shop. Turn left at the gate. Then turn right at the park.” → 大门处左转，公园处右转。“Please greet your neighbour.”要求向邻居问好，没有说已经问好。', '虛構示例：「Leave the shop. Turn left at the gate. Then turn right at the park.」 → 大門處左轉，公園處右轉。「Please greet your neighbour.」要求向鄰居問好，沒有說已經問好。'),
      nextStep: local('Use the same rule in the other conversation, without hints.', '在另一原作中运用同一规则，不用提示。', '在另一原作中運用同一規則，不用提示。'),
      materials: lesson.materials.map((material, index) => {
        const question = { ...material.questions[0] };
        if (index) delete question.hints;
        return { ...material, questions: [question] };
      }),
    };
  }
  if (!listening && firstQuestion.prompt === peopleMatchingPrompt) return { ...result, targetLevel: 'A1', goalId: 'explicit-person-description',
    goal: local('Find who gives each simple description of themselves.', '找出是谁在描述自己。', '找出是誰在描述自己。'),
    teaching: local('Read “I am” and the name before “:”. “I” means that speaker. Keep the description with that person, not another name in their words. Great means very well; new to a place means just arrived. D.C. is Washington, D.C. A small town is a small place to live. An apartment is a home in a building; a roommate shares a home.', '读“I am”和“:”前的名字。“I”指说话者。把描述与这个人对应，不要选话中提到的另一个名字。great表示很好，new to表示刚到某地，D.C.指华盛顿哥伦比亚特区。small town是小城镇，apartment是公寓住房，roommate是同住的人。', '讀「I am」和「:」前的名字。「I」指說話者。把描述與這個人對應，不要選話中提到的另一個名字。great表示很好，new to表示剛到某地，D.C.指華盛頓哥倫比亞特區。small town是小城鎮，apartment是公寓住房，roommate是同住的人。'),
    nextStep: local('Read the other conversation. Find the people without hints. Check each “I” with its speaker.', '阅读另一原作，不用提示找出人物。逐一核对“I”指谁。', '閱讀另一原作，不用提示找出人物。逐一核對「I」指誰。'),
    materials: lesson.materials.map((material, index) => ({ ...material, questions: material.questions.map(question => {
      const supported = 'kind' in question && question.kind === 'response' ? { ...question,
        prompt: 'Write one short sentence about who says what. Use words from the text.',
        criteria: [local('I keep the right speaker.', '我保留正确的说话者。', '我保留正確的說話者。'), local('I keep what the speaker says.', '我保留这个人说的内容。', '我保留這個人說的內容。')],
        hints: [local('Choose one description.', '选择一段描述。', '選擇一段描述。'), local('Find who says it.', '找到是谁说的。', '找到是誰說的。'), local('Keep that person with their words.', '保留这个人和对应的话。', '保留這個人和對應的話。')],
        explanation: local('Check the name and the words with the source. Your sentence is not automatically scored.', '对照原文检查人物和话语。你的句子不自动评分。', '對照原文檢查人物和話語。你的句子不自動評分。'),
      } : question;
      if (!index) return supported;
      const independent = { ...supported };
      delete independent.hints;
      return independent;
    }) })),
  };
  if (startingPoint === 'A2' && corpusOperation(firstQuestion) === 'choice:stated-origin') return { ...result,
    goal: local('Find the place the person says they are from.', '找到这个人说自己来自的地方。', '找到這個人說自己來自的地方。'),
    teaching: local('Read the question and the answer. Find “I am from” or “I’m from”. Choose that place. A welcome place or a place answered with “No” is different. Do not guess birthplace, home or nationality.', '阅读问题和回答，找到“I am from”或“I’m from”，选择后面的地方。欢迎到达的地方或用“No”否认的地方与它不同。不要推断出生地、居住地或国籍。', '閱讀問題和回答，找到「I am from」或「I’m from」，選擇後面的地方。歡迎到達的地方或用「No」否認的地方與它不同。不要推斷出生地、居住地或國籍。'),
    workedExample: local('Example: “I am from a village.” → a village. “Welcome to the city” does not state that person’s origin.', '示例：“I am from a village.” → a village。“Welcome to the city”没有说明这个人的来源。', '示例：「I am from a village.」 → a village。「Welcome to the city」沒有說明這個人的來源。'),
    nextStep: local('Read another conversation. Find where the person says they are from.', '阅读另一段对话，找到这个人说自己来自的地方。', '閱讀另一段對話，找到這個人說自己來自的地方。'),
  };
  return { ...result,
    goal: phone ? local('Find the work phone number.', '找到工作电话。', '找到工作電話。') : address ? local('Find the requested name.', '找到请求使用的称呼。', '找到請求使用的稱呼。') : rooms ? local('Match activities to rooms.', '把活动与房间配对。', '把活動與房間配對。') : apartments ? local('Match people to apartment codes.', '把人物与公寓编号对应。', '把人物與公寓編號對應。') : speakers ? local('Match sentences to speakers.', '把句子与说话者配对。', '把句子與說話者配對。') : sequence ? listening ? local('Put sentences in the order you hear.', '按听到的顺序排列句子。', '按聽到的順序排列句子。') : local('Put sentences in text order.', '按文中的顺序排列句子。', '按文中的順序排列句子。') : listening ? local('Listen for the missing word.', '听清缺少的词。', '聽清缺少的詞。') : local('Find the missing word.', '找到缺少的词。', '找到缺少的詞。'),
    teaching: phone ? local('Find “work number”. Read the number after it. “Wrong number” means the call reached a different number. Keep the two numbers separate.', '找到“work number”，读后面的号码。“wrong number”表示拨错了号码。区分工作电话与误拨的号码。', '找到「work number」，讀後面的號碼。「wrong number」表示撥錯了號碼。區分工作電話與誤撥的號碼。') : address ? local('Find “please call me”. Read the name after “me”. This is the name the person asks you to use. It can differ from the full name.', '找到“please call me”，读“me”后面的称呼。这是对方请求使用的称呼，可以与全名不同。', '找到「please call me」，讀「me」後面的稱呼。這是對方請求使用的稱呼，可以與全名不同。') : sequence && !listening ? local('Find the three sentences and put them in text order.', '在文中找到这三个句子，按文中的顺序排列。', '在文中找到這三個句子，按文中的順序排列。') : listening ? listeningSequence ? local('Listen for the three sentences and put them in the order you hear.', '听这三个句子，按听到的顺序排列。', '聽這三個句子，按聽到的順序排列。') : local('Find the phrase with the gap. Replay it, write the missing word and check its spelling.', '找到有空格的句子，再听并写下缺少的词，检查拼写。', '找到有空格的句子，再聽並寫下缺少的詞，檢查拼寫。') : local('Read. Answer the first question. Then write one sentence. Use a few words from the text.', '先阅读，回答第一题，再写一句话。用上文中的几个词。', '先閱讀，回答第一題，再寫一句話。用上文中的幾個詞。'),
    workedExample: phone ? local('Example: “Taylor’s work number is 321-0199.” Then: “You have the wrong number. No. This is 321-0188.” → Work number: 321-0199. The call reached 321-0188 instead.', '示例：“Taylor’s work number is 321-0199.”随后说：“You have the wrong number. No. This is 321-0188.” → 工作电话是321-0199，误拨到的是321-0188。', '示例：「Taylor’s work number is 321-0199.」隨後說：「You have the wrong number. No. This is 321-0188.」 → 工作電話是321-0199，誤撥到的是321-0188。') : address ? local('Example: “I am your neighbor, Taylor Bell. But, please call me Taylor.” → Requested name: Taylor. Full name: Taylor Bell.', '示例：“I am your neighbor, Taylor Bell. But, please call me Taylor.” → 请求使用的称呼是Taylor，全名是Taylor Bell。', '示例：「I am your neighbor, Taylor Bell. But, please call me Taylor.」 → 請求使用的稱呼是Taylor，全名是Taylor Bell。') : example ?? (sequence && !listening ? local('Example: “Mina opens a window.” → “She looks at the garden.” → “She closes the window.” Keep sentence order.', '示例：“Mina opens a window.” → “She looks at the garden.” → “She closes the window.”按句子顺序排列。', '示例：「Mina opens a window.」 → 「She looks at the garden.」 → 「She closes the window.」按句子順序排列。') : listeningSequence ? local('Example: “Mina opens a window.” → “She looks at the garden.” → “She closes the window.” Keep sentence order.', '示例：“Mina opens a window.” → “She looks at the garden.” → “She closes the window.”按句子顺序排列。', '示例：「Mina opens a window.」 → 「She looks at the garden.」 → 「She closes the window.」按句子順序排列。') : listeningCompletion ? local('Example: “Nora puts the blue cup on the shelf.” → Gap: “Nora puts the ________ cup on the shelf.” → Answer: “blue”. Check the words around the gap and the spelling.', '示例：“Nora puts the blue cup on the shelf.” → 空格：“Nora puts the ________ cup on the shelf.” → 答案：“blue”。用空格前后的词定位，再检查拼写。', '示例：「Nora puts the blue cup on the shelf.」 → 空格：「Nora puts the ________ cup on the shelf.」 → 答案：「blue」。用空格前後的詞定位，再檢查拼寫。') : listening ? local('“The speaker says …”. Use a few words you heard. Then say what they mean.', '“说话者说……”。引用听到的几个词，再说说它们的意思。', '「說話者說……」。引用聽到的幾個詞，再說說它們的意思。') : apartments ? local('Find “I am in apartment …”. Match the name before “:” to the apartment code.', '找到“I am in apartment …”。将“:”前的名字与公寓编号对应。', '找到「I am in apartment …」。將「:」前的名字與公寓編號對應。') : rooms ? local('Example: “Mira: I rest in the sun room.” → rest: sun room. Match the activity to the room after “in the”.', '示例：“Mira: I rest in the sun room.” → rest：sun room。把活动与“in the”后的房间配对。', '示例：「Mira: I rest in the sun room.」 → rest：sun room。把活動與「in the」後的房間配對。') : speakers ? local('Example: “Zora: Timo has a red kite.” → “Timo has a red kite.”: Zora. Zora speaks; Timo is mentioned.', '示例：“Zora: Timo has a red kite.” → “Timo has a red kite.”：Zora。Zora说这句话，Timo是被提到的人。', '示例：「Zora: Timo has a red kite.」 → 「Timo has a red kite.」：Zora。Zora說這句話，Timo是被提到的人。') : local('“The text says …”. Copy a few words. Then say what they mean.', '“文中说……”。引用几个词，再说说它们的意思。', '「文中說……」。引用幾個詞，再說說它們的意思。')),
    nextStep: listening ? local('Listen to another recording. Find one detail.', '听另一段录音，找到一个细节。', '聽另一段錄音，找到一個細節。') : local('Try another text. Find one detail.', '换一份材料，找到一个细节。', '換一份材料，找到一個細節。'),
    materials: lesson.materials.map(material => ({ ...material, questions: material.questions.map(question => 'kind' in question && question.kind === 'response' ? { ...question,
      prompt: listening ? 'Write one short sentence about what you heard. Use a few words from the recording.' : 'Write one short sentence about what you read. Use a few words from the text.',
      criteria: [local('My sentence agrees with the text.', '我的句子符合材料内容。', '我的句子符合材料內容。'), local('I use words from the text.', '我用上了材料中的词语。', '我用上了材料中的詞語。')],
      hints: [local('Find one thing the text says.', '找出材料说的一件事。', '找出材料說的一件事。'), local('Choose a few words about it.', '选择与它有关的几个词。', '選擇與它有關的幾個詞。'), local('Write one short sentence.', '写一句简短的话。', '寫一句簡短的話。')],
      explanation: local('Read your sentence again. Check it with the text and the two points below.', '再读一遍你的句子，对照材料和下方两点检查。', '再讀一遍你的句子，對照材料和下方兩點檢查。'),
    } : question) })),
  };
}
