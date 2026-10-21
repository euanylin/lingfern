import { interestWords, validateInterests } from '../shared/topicMatch';
export { corpusInterestMatch } from '../shared/topicMatch';
import { disagreementSynthesisPrompt, disagreementSynthesisOperation } from './corpusDisagreementSynthesis';
import { faithfulParaphrasePrompt, faithfulParaphraseOperation } from './corpusFaithfulParaphrase';
import { complexPragmaticsPrompt, complexPragmaticsOperation } from './corpusComplexPragmatics';
import { layeredPositionPrompt, layeredPositionOperation } from './corpusLayeredPosition';
import { rhetoricalFunctionPrompt, rhetoricalFunctionOperation } from './corpusRhetoricalFunction';
import { nuancedMeaningPrompt, nuancedMeaningOperation } from './corpusNuancedMeaning';
import { informationDensityPrompt, informationDensityOperation } from './corpusInformationDensity';
import { indirectStancePrompt, indirectStanceOperation } from './corpusIndirectStance';
import { argumentBoundariesPrompt, argumentBoundariesOperation } from './corpusArgumentBoundaries';
import { registerAudiencePrompt, registerAudienceOperation } from './corpusRegisterAudience';
import { discourseOrganizationPrompt, discourseOrganizationOperation } from './corpusDiscourseOrganization';
import { implicitIntentionPrompt, implicitIntentionOperation } from './corpusImplicitIntention';
import { viewAttributionPrompt, viewAttributionOperation } from './corpusViewAttribution';
import { informationSynthesisPrompt, informationSynthesisOperation } from './corpusInformationSynthesis';
import { speakerAttitudePrompt, speakerAttitudeOperation } from './corpusSpeakerAttitude';
import { qualifiedConcessionPrompt, qualifiedConcessionOperation } from './corpusQualifiedConcession';
import { comparisonPrompt, comparisonOperation } from './corpusComparison';
import { claimExampleOperation } from './corpusClaimExamples';
import { proceduralPlanPrompt } from './corpusProceduralPlan';
import { specificIntentionPrompt } from './corpusSpecificIntention';
import { narrativeMotivePrompt } from './corpusNarrativeMotive';
import { conditionalMeaningPrompt } from './corpusConditionalMeaning';
import { mainPointPrompt } from './corpusMainPoint';
import shortListeningOverlaps from '../../content/corpus/short-listening-overlaps.json';
import { referencePrompt } from './corpusReference';
import type { Attempt, Session } from '../data/db';
import type { GoalReview } from '../data/goalReview';
import { teachingSupport, type Lesson, type CorpusQuestionKind } from '../shared/content';
import type { Preferences } from '../shared/preferences';

// Effort bounds for a chosen starting point, not reviewed source difficulty or ability.
export const startingBounds = {
  A1: { words: [120, 120, 160], seconds: [8, 8, 12] },
  A2: { words: [120, 160, 220], seconds: [12, 20, 25] },
  B1: { words: [160, 220, 300], seconds: [20, 35, 60] },
  B2: { words: [220, 300, 500], seconds: [25, 60, 91] },
  C1: { words: [500, 900, 1200], seconds: [35, 75, 91] },
  C2: { words: [700, 1200, 1800], seconds: [60, 91, 91] },
} as const;

// A new source only tests transfer when it repeats the taught operation.
// ponytail: fixed generated prompts identify semantic matching/evidence families; richer tasks need explicit operation metadata.
export const pairedReliancePrompt = 'In the paired statement, match each reliance to what needs it.';
export const pairedRelianceOperation = `matching:${pairedReliancePrompt}`;
export const qualificationPrompt = 'Which sentence uses wording that marks a claim as a belief, inference or possibility?';
export const politeRequestPrompt = 'Which interpretation preserves the speaker’s request?';
export const qualifiedTimingPrompt = 'Which summary preserves the timing qualification and what it applies to?';
export const concessiveRelationPrompt = 'Which wording preserves the stated concession and its context?';
export const explicitContrastPrompt = 'Which wording preserves the stated contrast with the previous claim?';
export const negatedNecessityPrompt = 'Which wording preserves the statement’s qualification?';
export const outcomePrompt = 'Which wording preserves the stated development-to-result relation?';
export const qualifiedCausePrompt = 'How does the sentence distinguish what happened from its proposed explanation?';
export const actionSelectionPrompt = 'What must the player do';
export const statedOriginPrompt = 'Where does ';
export const statedIntentionPrompt = 'What does “I want to” mean here?';
export const personalGoalPrompts = { need: 'Read the stated need.', preference: 'Read the stated preference.', update: 'Read the updated statement.', reason: 'Read the stated reason.', rule: 'Read the stated rule.', integration: 'Combine two stated clues.' } as const;
export const plannedOrderPrompt = 'What is the planned order of these actions?';
export const workPhonePrompt = 'What is the work phone number?';
export const requestedAddressPrompt = 'What name does the speaker request?';
export const stageActionPrompt = 'Which action is required';
export const beginnerPolarityPrompt = 'Listen. Which statement matches the recording?';
export const heardIntegrationPrompt = 'Listen and combine two stated details.';
export const heardRulePrompt = 'Listen for the stated rule.';
export const heardReasonPrompt = 'Listen for the stated reason.';
export const heardChangePrompt = 'Listen. Which change does the recording report?';
export const heardActionOrderPrompt = 'Listen. Which action order is stated?';
export const heardPersonalNeedPrompt = 'Listen. What action is needed now?';
export const heardPersonalPreferencePrompt = 'Listen. What does ';
export const heardNumericPrompts = { count: 'Listen. How many?', time: 'Listen. What time?' } as const;
export const heardMeaningPrompts = { location: 'Listen. Which location is stated?', instruction: 'Listen. What are you asked to do?', verification: 'Listen. Which detail is correct?' } as const;
export const heardDescriptionPrompt = 'Listen. Which description answers the question?';
export const readingPolarityPrompt = 'Read. Does the text say this?';
export function corpusOperation(question: Lesson['materials'][number]['questions'][number] | undefined) {
  if (question && 'kind' in question && question.kind === 'matching' && question.prompt === indirectStancePrompt) return indirectStanceOperation;
  if (question && 'kind' in question && question.kind === 'matching' && question.prompt === argumentBoundariesPrompt) return argumentBoundariesOperation;
  if (question && 'kind' in question && question.kind === 'matching' && question.prompt === registerAudiencePrompt) return registerAudienceOperation;
  if (question && 'kind' in question && question.kind === 'matching' && question.prompt === discourseOrganizationPrompt) return discourseOrganizationOperation;
  if (question && !('kind' in question) && question.prompt.startsWith(rhetoricalFunctionPrompt)) return rhetoricalFunctionOperation;
  if (question && !('kind' in question) && question.prompt.startsWith(disagreementSynthesisPrompt)) return disagreementSynthesisOperation;
  if (question && !('kind' in question) && question.prompt.startsWith(faithfulParaphrasePrompt)) return faithfulParaphraseOperation;
  if (question && !('kind' in question) && question.prompt.startsWith(complexPragmaticsPrompt)) return complexPragmaticsOperation;
  if (question && !('kind' in question) && question.prompt.startsWith(layeredPositionPrompt)) return layeredPositionOperation;
  if (question && !('kind' in question) && question.prompt.startsWith(nuancedMeaningPrompt)) return nuancedMeaningOperation;
  if (question && !('kind' in question) && question.prompt === informationDensityPrompt) return informationDensityOperation;
  if (question && !('kind' in question) && question.prompt === implicitIntentionPrompt) return implicitIntentionOperation;
  if (question && !('kind' in question) && question.prompt === viewAttributionPrompt) return viewAttributionOperation;
  if (question && !('kind' in question) && question.prompt === informationSynthesisPrompt) return informationSynthesisOperation;
  if (question && !('kind' in question) && question.prompt === speakerAttitudePrompt) return speakerAttitudeOperation;
  if (question && !('kind' in question) && question.prompt === qualifiedConcessionPrompt) return qualifiedConcessionOperation;
  if (question && !('kind' in question) && question.prompt === comparisonPrompt) return comparisonOperation;
  if (question && !('kind' in question) && question.prompt === mainPointPrompt) return 'choice:main-point';
  if (question && !('kind' in question)) for (const [kind, prompt] of Object.entries(personalGoalPrompts)) if (question.prompt.startsWith(prompt + '\n')) return `choice:personal-${kind}`;
  if (question && !('kind' in question) && question.prompt === plannedOrderPrompt) return 'choice:planned-order';
  if (question && !('kind' in question) && question.prompt.startsWith('Read the time stated for this question.\n')) return 'choice:stated-time';
  if (question && !('kind' in question) && question.prompt.startsWith('How many? Read the stated count.\n')) return 'choice:small-quantity';
  if (question && !('kind' in question) && question.prompt.startsWith('Read. Is this detail correct?\n')) return 'choice:detail-verification';
  if (question && !('kind' in question) && question.prompt.startsWith('Where is the place?\n')) return 'choice:stated-location';
  if (question && !('kind' in question) && question.prompt.startsWith('What are you asked to do?\n')) return 'choice:basic-instruction';
  if (!question) return;
  if (!('kind' in question) && question.prompt.startsWith(heardReasonPrompt + '\n')) return 'choice:heard-stated-reason';
  if (!('kind' in question) && question.prompt.startsWith(heardRulePrompt + '\n')) return 'choice:heard-stated-rule';
  if (!('kind' in question) && question.prompt.startsWith(heardIntegrationPrompt + '\n')) return 'choice:heard-short-integration';
  if (!('kind' in question) && question.prompt === heardChangePrompt) return 'choice:heard-state-change';
  if (!('kind' in question) && question.prompt === heardActionOrderPrompt) return 'choice:heard-action-order';
  if (!('kind' in question) && question.prompt === heardPersonalNeedPrompt) return 'choice:heard-personal-need';
  if (!('kind' in question) && question.prompt.startsWith(heardPersonalPreferencePrompt) && / say they like(?:d)?\?$/.test(question.prompt)) return 'choice:heard-personal-preference';
  if (!('kind' in question) && (question.prompt.startsWith(readingPolarityPrompt + '\n') || question.prompt === 'Read. Does the text say yes or no about this object or place?')) return 'choice:stated-polarity';
  if (!('kind' in question)) for (const [kind, prompt] of Object.entries(heardNumericPrompts)) if (question.prompt.startsWith(prompt + '\n')) return `choice:heard-${kind}`;
  if (!('kind' in question)) for (const [kind, prompt] of Object.entries(heardMeaningPrompts)) if (question.prompt === prompt) return `choice:heard-${kind}`;
  if (!('kind' in question) && question.prompt === beginnerPolarityPrompt) return 'choice:heard-polarity';
  if (!('kind' in question) && question.prompt.startsWith(heardDescriptionPrompt + '\n')) return 'choice:heard-description';
  if (!('kind' in question) && question.prompt.startsWith(referencePrompt + '\n')) return 'choice:reference';
  if (!('kind' in question) && /^What does “I want to” mean here\?\n[A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})?: “[a-z ]{2,80}”$/.test(question.prompt)) return 'choice:stated-intention';
  if (!('kind' in question) && question.prompt === politeRequestPrompt) return 'choice:polite-request';
  if (!('kind' in question) && question.prompt === qualifiedTimingPrompt) return 'choice:qualified-timing';
  if (!('kind' in question) && question.prompt === concessiveRelationPrompt) return 'choice:concessive-relation';
  if (!('kind' in question) && question.prompt === explicitContrastPrompt) return 'choice:explicit-contrast';
  if (!('kind' in question) && question.prompt === outcomePrompt) return 'choice:stated-outcome';
  if (!('kind' in question) && /^Where does [A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20})? say they are from\?$/.test(question.prompt)) return 'choice:stated-origin';
  if (!('kind' in question) && question.prompt.startsWith(negatedNecessityPrompt + '\n')) return 'choice:negated-necessity';
  if (!('kind' in question) && question.prompt === conditionalMeaningPrompt) return 'choice:condition-outcome';
  if (!('kind' in question) && question.prompt.startsWith(proceduralPlanPrompt + '\n')) return 'choice:procedural-plan';
  if (!('kind' in question) && question.prompt.startsWith(specificIntentionPrompt + '\n')) return 'choice:specific-intention';
  if (!('kind' in question) && question.prompt.startsWith(narrativeMotivePrompt + '\n')) return 'choice:narrative-motive';
  if (!('kind' in question) && question.prompt.startsWith(qualifiedCausePrompt + '\n')) return 'choice:qualified-cause';
  if (!('kind' in question) && question.prompt === workPhonePrompt) return 'choice:work-phone';
  if (!('kind' in question) && question.prompt === requestedAddressPrompt) return 'choice:requested-address';
  if (!('kind' in question)) return question.prompt.startsWith(actionSelectionPrompt + ' if ') || question.prompt.startsWith(stageActionPrompt + ' ') ? 'choice:conditional-action' : undefined;
  if (question.kind === 'response') return;
  if (question.kind === 'matching' && question.prompt === pairedReliancePrompt) return pairedRelianceOperation;
  return question.kind === 'matching' || question.kind === 'evidence' || question.kind === 'table'
    ? `${question.kind}:${question.prompt}` : question.kind;
}

/** Local practice conditions only; never a level or ability estimate. */
export function corpusPracticeHistory(history: Session[], records: Attempt[], profileId: string, skill: 'reading' | 'listening', source: 'voa' | 'gutenberg' | 'wikipedia' | 'all', startingPoint?: Preferences['reading'], reviews: ReadonlyMap<string, Pick<GoalReview, 'state' | 'nextSuggestedAt'>> = new Map(), goalId?: string) {
  const point = startingPoint ?? 'B2';
  if (!Object.hasOwn(startingBounds, point)) throw new Error('INVALID_CORPUS_STARTING_POINT');
  const bounds = startingBounds[point];
  const seen = new Set(history.filter(session => session.profileId === profileId && session.lesson.generation?.generator === 'corpus-v1')
    .flatMap(session => session.lesson.materials.map(material => material.id))
    .filter(id => id.startsWith('corpus-')).map(id => id.slice('corpus-'.length)));
  // Only direct overlaps: a seen long clip must not transitively hide an untouched neighbour.
  const originalSeen = new Set(seen);
  for (const scope of shortListeningOverlaps.records) {
    if (originalSeen.has(scope.id)) for (const id of scope.overlappingIds) seen.add(id);
    else if (scope.overlappingIds.some(id => originalSeen.has(id))) seen.add(scope.id);
  }
  const originals = history.filter(session => session.profileId === profileId && session.lesson.skill === skill
    && session.lesson.generation?.generator === 'corpus-v1' && session.lesson.mode !== 'check' && (!goalId || session.lesson.goalId === goalId)
    && (source === 'all' || skill === 'listening' || session.lesson.materials.every(material => material.sourceId?.startsWith(source + '-'))));
  const grouped = new Map<string, Attempt[]>();
  for (const record of records) if (record.profileId === profileId) {
    const group = grouped.get(record.sessionId) ?? [];
    group.push(record); grouped.set(record.sessionId, group);
  }
  const answersFor = (session: Session) => {
    const expected = new Map(session.lesson.materials.flatMap(material => material.questions.map(question => [question.id, material.rootId] as const)));
    return (grouped.get(session.id) ?? []).filter(answer => expected.get(answer.questionId) === answer.rootId);
  };
  const lastSaved = (session: Session) => answersFor(session).reduce((last, answer) => answer.submittedAt > last ? answer.submittedAt : last, session.startedAt);
  const recent = originals.filter(session => session.status === 'completed' && !session.recordsDeleted)
    .sort((a, b) => lastSaved(b).localeCompare(lastSaved(a)) || b.id.localeCompare(a.id))[0];
  const active = originals.find(session => session.status === 'active' && !session.recordsDeleted);
  const expected = new Set(recent?.lesson.materials.flatMap(material => material.questions
    .filter(question => !('kind' in question) || question.kind !== 'response').map(question => question.id)) ?? []);
  const distinct = new Map<string, Attempt>();
  if (recent) for (const answer of answersFor(recent)) if (expected.has(answer.questionId) && typeof answer.correct === 'boolean') {
    const prior = distinct.get(answer.questionId);
    if (!prior || answer.submittedAt > prior.submittedAt || answer.submittedAt === prior.submittedAt && answer.id > prior.id)
      distinct.set(answer.questionId, answer);
  }
  const scored = [...distinct.values()];
  const scoredHistory = recent ? answersFor(recent).filter(answer => expected.has(answer.questionId) && typeof answer.correct === 'boolean') : [];
  const needsSupport = scoredHistory.some(answer => !answer.correct || answer.assistance.hintLevel > 0 || answer.assistance.dictionaryUsed
    || skill === 'listening' && (answer.assistance.playbackRequests ?? 0) > 1);
  const completed = originals.filter(session => session.status === 'completed' && !session.recordsDeleted);
  const now = Date.now();
  const applicationRoots = new Set<string>();
  const targetOperation = recent && corpusOperation(recent.lesson.materials[0].questions[0]);
  // ponytail: history scan per application root; index first reservations if large profiles need it.
  for (const session of completed) {
    if (!recent || !targetOperation || session.lesson.goalId !== recent.lesson.goalId
      || corpusOperation(session.lesson.materials[0].questions[0]) !== targetOperation) continue;
    const startedAt = Date.parse(session.startedAt);
    if (!Number.isFinite(startedAt) || startedAt > now + 300000) continue;
    for (const material of session.lesson.materials.slice(1)) {
      const scoredQuestions = material.questions.filter(question => !('kind' in question) || question.kind !== 'response');
      if (!scoredQuestions.length || scoredQuestions.some(question => corpusOperation(question) !== targetOperation)) continue;
      // Reservations are conservative exposure evidence across reading/listening, including interrupted units.
      if (history.some(other => {
        if (other.profileId !== profileId || other.id === session.id
          || !other.lesson.materials.some(prior => prior.rootId === material.rootId)) return false;
        const priorStart = Date.parse(other.startedAt);
        // An uncertain reservation cannot establish that this source was unfamiliar.
        return !Number.isFinite(priorStart) || priorStart > now + 300000 || priorStart <= startedAt;
      })) continue;
      const required = new Set(material.questions.filter(question => !('kind' in question) || question.kind !== 'response').map(question => question.id));
      const saved = answersFor(session).filter(answer => answer.rootId === material.rootId && required.has(answer.questionId));
      if (required.size && new Set(saved.map(answer => answer.questionId)).size === required.size && saved.every(answer => answer.correct === true
        && Number.isFinite(Date.parse(answer.submittedAt)) && Date.parse(answer.submittedAt) <= now + 300000
        && !teachingSupport(session.lesson, answer.rootId, answer.assistance.teachingProvided)
        && !answer.assistance.hintLevel && !answer.assistance.dictionaryUsed
        && (skill !== 'listening' || answer.assistance.audioCompleted === true && (answer.assistance.playbackRequests ?? 0) <= 1))) applicationRoots.add(material.rootId);
    }
  }
  const recentApplication = recent?.lesson.materials.slice(1).some(material => applicationRoots.has(material.rootId));
  const independent = expected.size >= 2 && distinct.size === expected.size && !needsSupport && applicationRoots.size >= 2 && !!recentApplication
    && scored.every(answer => Number.isFinite(Date.parse(answer.submittedAt)) && Date.parse(answer.submittedAt) <= now + 300000
      && (skill !== 'listening' || answer.assistance.audioCompleted === true));
  const condition = needsSupport ? 0 : independent ? 2 : 1;
  const byOperation = new Map<string, Map<string, { kind: CorpusQuestionKind; correct: boolean; helped: boolean; at: string; goalKey: string }>>();
  const firstQuestions = new Set<string>();
  const events = completed.flatMap(session => answersFor(session).map(answer => ({ session, answer })))
    .sort((a, b) => a.answer.submittedAt.localeCompare(b.answer.submittedAt) || a.answer.id.localeCompare(b.answer.id));
  for (const { session, answer } of events) {
    const question = session.lesson.materials.flatMap(material => material.questions).find(item => item.id === answer.questionId);
    if (!question || !corpusOperation(question)
      || typeof answer.correct !== 'boolean' || !Number.isFinite(Date.parse(answer.submittedAt)) || Date.parse(answer.submittedAt) > now + 300000) continue;
    const key = `${answer.rootId}:${answer.questionId}`;
    if (firstQuestions.has(key)) continue;
    firstQuestions.add(key);
    const kind = ('kind' in question ? question.kind : 'choice') as CorpusQuestionKind;
    const operation = corpusOperation(question)!;
    const roots = byOperation.get(operation) ?? new Map();
    roots.set(answer.rootId, { kind, correct: answer.correct, helped: answer.assistance.hintLevel > 0 || !!answer.assistance.dictionaryUsed
      || skill === 'listening' && (answer.assistance.playbackRequests ?? 0) > 1, at: answer.submittedAt, goalKey: `${session.lesson.skill}:${session.lesson.targetLevel}:${session.lesson.goalId}` });
    byOperation.set(operation, roots);
  }
  const focusCandidates = [...byOperation].flatMap(([operation, roots]) => {
    if (operation === rhetoricalFunctionOperation && point !== 'C2') return [];
    if (operation === disagreementSynthesisOperation && point !== 'C2') return [];
    if (operation === faithfulParaphraseOperation && point !== 'C2') return [];
    if (operation === complexPragmaticsOperation && point !== 'C2') return [];
    if (operation === layeredPositionOperation && point !== 'C2') return [];
    if (operation === nuancedMeaningOperation && point !== 'C2') return [];
    if ((operation === informationDensityOperation || operation === indirectStanceOperation || operation === argumentBoundariesOperation || operation === registerAudienceOperation || operation === implicitIntentionOperation || operation === discourseOrganizationOperation) && point !== 'C1') return [];
    if ((operation === viewAttributionOperation || operation === informationSynthesisOperation || operation === speakerAttitudeOperation || operation === qualifiedConcessionOperation || operation === claimExampleOperation || operation === comparisonOperation) && point !== 'B2') return [];
    if ((operation === 'choice:concessive-relation' || operation === 'choice:qualified-timing' || operation === 'choice:polite-request') && skill !== 'reading') return [];
    if (operation === 'choice:stated-outcome' && (skill !== 'listening' || point === 'A1' || point === 'A2')) return [];
    if (['choice:main-point', 'choice:condition-outcome', 'choice:narrative-motive', 'choice:specific-intention', 'choice:procedural-plan'].includes(operation ?? '') && point !== 'B1') return [];
    if (['choice:planned-order', 'choice:personal-need', 'choice:personal-preference', 'choice:personal-update', 'choice:personal-reason', 'choice:personal-rule', 'choice:personal-integration'].includes(operation) && (skill !== 'reading' || point !== 'A2')) return [];
    if ((operation.startsWith('choice:heard-personal-') || operation === 'choice:heard-action-order' || operation === 'choice:heard-state-change' || operation === 'choice:heard-stated-reason' || operation === 'choice:heard-stated-rule' || operation === 'choice:heard-short-integration') && (skill !== 'listening' || point !== 'A2')) return [];
    if (operation === 'choice:stated-origin' && point !== 'A2') return [];
    if (operation === 'choice:stated-intention' && (skill !== 'reading' || point !== 'A1' && point !== 'A2')) return [];
    if ((operation === 'choice:negated-necessity' || operation === 'choice:concessive-relation' || operation === 'choice:qualified-timing' || operation === 'choice:polite-request') && point !== 'C1' && point !== 'C2') return [];
    if (operation === 'choice:explicit-contrast' && point !== 'B2') return [];
    const recent = [...roots.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-5);
    const last = recent.at(-1)!;
    const review = reviews.get(last.goalKey);
    const due = review?.state === 'review_due' && !!review.nextSuggestedAt && Date.parse(review.nextSuggestedAt) <= now;
    if (last.correct && !last.helped && !due) return [];
    const reteach = recent.length >= 2 && recent.slice(-2).every(answer => !answer.correct);
    return [{ kind: last.kind, operation, reason: reteach ? 'reteach' as const : due ? 'review' as const : 'retry' as const, at: due ? review!.nextSuggestedAt! : last.at }];
  }).sort((a, b) => Number(b.reason === 'reteach') - Number(a.reason === 'reteach') || Number(b.reason === 'review') - Number(a.reason === 'review') || (a.reason === 'review' && b.reason === 'review' ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));
  const focus = focusCandidates[0];
  return { seen, originals, active, recent, recentSavedAt: recent ? lastSaved(recent) : undefined, needsSupport, independent, focus,
    maxWords: bounds.words[condition], maxSeconds: bounds.seconds[condition] };
}


export function corpusInterestScore(title: string, text: string, interests: Preferences['interests'], seed = 0) {
  validateInterests(interests);
  const desired = interests[seed % interests.length];
  return Math.max(0, ...interests.map(interest => {
    const titleHits = new Set([...title.matchAll(interestWords[interest])].map(match => match[0].toLowerCase())).size;
    const bodyHits = new Set([...text.matchAll(interestWords[interest])].map(match => match[0].toLowerCase())).size;
    return Math.min(3, titleHits) * 4 + Math.min(3, bodyHits) + (interest === desired && titleHits + bodyHits > 0 ? 20 : 0);
  }));
}
/** Structural effort proxy only; never a CEFR estimate or a source-approval gate. */
// ponytail: sentence length and word length approximate effort; reviewed lexical/grammar profiles would replace these signals when available.
export function corpusPreferenceScore(title: string, text: string, interests: Preferences['interests'], seed: number, point?: Preferences['reading'], seconds?: number) {
  const words = text.match(/[a-z]+(?:['’][a-z]+)?/gi) ?? [];
  const sentences = Math.max(1, (text.match(/[.!?](?=["'’”)]?(?:\s|$))/g) ?? []).length);
  const load = words.length / sentences / 8 + words.filter(word => word.length >= 9).length / Math.max(1, words.length) * 8
    + (seconds ? Math.max(0, words.length * 60 / seconds - 130) / 70 : 0);
  const target = { A1: 1, A2: 1.5, B1: 2.5, B2: 3.5, C1: 4.5, C2: 5.5 };
  const distance = point ? Math.floor(Math.abs(load - target[point]) / 1.25) : 0;
  return -distance * 100 + Math.min(40, corpusInterestScore(title, text, interests, seed));
}
// ponytail: rank a bounded local candidate list; measured mobile cost would justify precomputed source features.
export function corpusPreferencePool<T>(items: T[], describe: (item: T) => { title: string; text: string; seconds?: number }, interests: Preferences['interests'], seed: number, point?: Preferences['reading']): T[] {
  validateInterests(interests);
  if (!interests.length || !items.length) return items;
  const ranked = items.map(item => { const value = describe(item); return { item, score: corpusPreferenceScore(value.title, value.text, interests, seed, point, value.seconds) }; });
  const best = ranked.reduce((best, item) => Math.max(best, item.score), -Infinity);
  return ranked.filter(item => item.score === best).map(item => item.item);
}

// ponytail: exact lexical candidate preference; sense correspondence still requires context review.
export function corpusReviewMatch(text: string, terms: readonly string[] = []) {
  if (terms.length > 100) throw new Error('CORPUS_REVIEW_LIMIT');
  return terms.some(term => /^[a-z][a-z '-]{0,79}$/i.test(term) && new RegExp(`(?<![a-z])${term.replace(/\s+/g, '\\s+')}(?![a-z])`, 'i').test(text));
}

/** Retain the completed word prerequisite while evaluating short-sentence support separately. */
export function beginnerSentenceReady(history: Session[], records: Attempt[], profileId: string) {
  const word = corpusPracticeHistory(history, records, profileId, 'listening', 'all', 'A1', undefined, 'heard-word-recognition');
  const sentence = corpusPracticeHistory(history, records, profileId, 'listening', 'all', 'A1', undefined, 'heard-sentence-completion');
  return word.independent && (!sentence.needsSupport || !!word.recentSavedAt && !!sentence.recentSavedAt && word.recentSavedAt > sentence.recentSavedAt);
}
