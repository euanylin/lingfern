import { organizePractice } from '../core/practiceOrganization';
import type { SpokenCorpus } from '../core/spokenCorpus';
import { qualifiedKnownRoots } from '../core/spokenLongAdmission';
import { mainPointListeningLesson, mainPointListeningSources, conditionListeningLesson, conditionListeningSources, referenceListeningLesson, referenceListeningSources, motiveListeningLesson, motiveListeningSources, intentionListeningLesson, intentionListeningSources, procedureListeningLesson, procedureListeningSources } from '../core/b1Listening';
import ruleListeningSources from '../../public/audio/a2-speech/RULE.json';
import { personalListeningLesson, actionOrderListeningLesson, stateChangeListeningLesson, statedReasonListeningLesson, statedRuleListeningLesson, shortIntegrationListeningLesson, integrationListeningSources } from '../core/a2Listening';
import reasonListeningSources from '../../public/audio/a2-speech/REASON.json';
import changeListeningSources from '../../public/audio/a2-speech/UPDATE.json';
import orderListeningSources from '../../public/audio/a2-speech/ORDER.json';
import personalListeningSources from '../../public/audio/a2-speech/PERSONAL.json';
import { sourcePacks, installedSourcePacks, installSourcePack } from '../data/sourcePacks';
import { goalReviews } from '../data/goalReview';
import { dueMemories } from '../data/memory';
import { spokenCorpusLesson } from '../core/spokenCorpus';
import { qualifiedLongSeconds } from '../core/spokenLongAdmission';
import { filterCorpusRoots, corpusLesson } from '../core/corpus';
import { beginnerSentenceReady, corpusInterestMatch, corpusPreferenceScore, corpusOperation, corpusPracticeHistory, corpusReviewMatch } from '../core/corpusPractice';
import { wordListeningLesson } from '../core/wordListening';
import { sentenceListeningLesson, sentencePolarityLesson, sentenceDescriptionLesson, sentenceMeaningLesson, sentenceNumericLesson } from '../core/beginnerListening';
import sentenceSources from '../../public/audio/a1-sentences/SENTENCES.json';
import wordSources from '../../public/ipa/SOURCES.json';
import meaningSources from '../../public/audio/a1-sentences/MEANING.json';
import numericSources from '../../public/audio/a1-sentences/NUMERIC.json';
import { offlineGroupReady } from '../data/offline';
import { exposures } from '../data/db';
import { loadReadingCorpus, loadSpokenCorpora } from '../data/corpus';
import type { Attempt, Session } from '../data/db';
import type { Lesson, Locale } from '../shared/content';
import { topicSchema } from '../shared/content';
import type { Preferences } from '../shared/preferences';


type PracticeReason = 'reteach' | 'retry' | 'review' | 'vocabulary';

export async function prepareCorpusPractice({ profileId, preferences, history, records, online, skill, topic, previewIds = [], previewRoots = new Set<string>() }: {
  locale: Locale; profileId: string; preferences?: Preferences; history: Session[]; records: Attempt[]; online: boolean; skill: 'reading' | 'listening'; topic?: Preferences['interests'][number]; previewIds?: string[]; previewRoots?: ReadonlySet<string>;
}): Promise<{ lesson?: Lesson; reason?: PracticeReason; downloadFailed: boolean }> {
  if (topic !== undefined) topicSchema.parse(topic);
  if (topic && skill === 'listening' && preferences?.listening === 'A1' && topic !== 'daily-life') return { downloadFailed: false };
  // shortcut: Topics use existing keyword signals; adopt reviewed excerpt labels when available.
  const interests = topic ? [topic] : preferences?.interests;
  const ownHistory = history.filter(session => session.profileId === profileId);
  const { seen: reserved, maxWords, maxSeconds } = corpusPracticeHistory(history, records, profileId, skill, 'all', preferences?.[skill]);
  const reviews = goalReviews(ownHistory.map(session => session.lesson), ownHistory, records.filter(record => record.profileId === profileId));
  const { focus } = corpusPracticeHistory(history, records, profileId, skill, 'all', preferences?.[skill], reviews);
  const matchesFocus = (lesson: Lesson) => !!focus && corpusOperation(lesson.materials[0].questions[0]) === focus.operation;
  const reviewTerms = [...new Set((await dueMemories(profileId)).slice(0, 100).map(item => item.term))];
  const matchesReview = (lesson: Lesson) => lesson.materials.some(material => corpusReviewMatch(material.blocks.map(block => block.text).join('\n'), reviewTerms));
  const requestedFocus = focus?.reason === 'retry' && reviewTerms.length ? undefined : focus?.kind;
  const freshReview = focus?.reason === 'review' || reviewTerms.length > 0 && focus?.reason !== 'reteach';
  const contacts = await exposures.where('profileId').equals(profileId).toArray();
  const seen = new Set([...reserved, ...previewIds, ...new Set([...contacts.flatMap(exposure => (exposure.contacts ?? []).map(contact => contact.materialId))].filter(id => id.startsWith('corpus-')).map(id => id.slice('corpus-'.length)))]);
  const seenRoots = qualifiedKnownRoots([...ownHistory.flatMap(session => session.lesson.materials.map(material => material.rootId)), ...contacts.map(contact => contact.rootId)], ownHistory.flatMap(session => session.lesson.materials));
  const [packSeed, seed] = crypto.getRandomValues(new Uint32Array(2));
  let next: Lesson | undefined;
  const alignmentBanks: SpokenCorpus[] = [];
  const personalKinds = ['need', 'preference'] as const;
  const personalKind = skill === 'listening' && preferences?.listening === 'A2'
    ? requestedFocus === 'choice' ? personalKinds.find(kind => focus?.operation === `choice:heard-personal-${kind}`)
      : !requestedFocus && !reviewTerms.length ? personalKinds[seed % 12 - 5] : undefined
    : undefined;
  if (personalKind && (online || await offlineGroupReady('audio-a2'))) next = personalListeningLesson(personalListeningSources[personalKind].filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId)), seen, seed, personalKind);
  if (personalKind && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const actionOrderRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-action-order' : !requestedFocus && !reviewTerms.length && seed % 12 === 7);
  if (actionOrderRequested && (online || await offlineGroupReady('audio-a2'))) next = actionOrderListeningLesson(orderListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId)), seen, seed);
  if (actionOrderRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const stateChangeRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-state-change' : !requestedFocus && !reviewTerms.length && seed % 12 === 8);
  if (stateChangeRequested && (online || await offlineGroupReady('audio-a2'))) next = stateChangeListeningLesson(changeListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId)), seen, seed);
  if (stateChangeRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const statedReasonRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-stated-reason' : !requestedFocus && !reviewTerms.length && seed % 12 === 9);
  if (statedReasonRequested && (online || await offlineGroupReady('audio-a2'))) next = statedReasonListeningLesson(reasonListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (statedReasonRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const statedRuleRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-stated-rule' : !requestedFocus && !reviewTerms.length && seed % 12 === 10);
  if (statedRuleRequested && (online || await offlineGroupReady('audio-a2'))) next = statedRuleListeningLesson(ruleListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (statedRuleRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const shortIntegrationRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-short-integration' : !requestedFocus && !reviewTerms.length && seed % 12 === 11);
  if (shortIntegrationRequested && (online || await offlineGroupReady('audio-a2'))) next = shortIntegrationListeningLesson(integrationListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (shortIntegrationRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const mainPointRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:main-point' : !requestedFocus && !reviewTerms.length && seed % 12 === 6);
  if (mainPointRequested && (online || await offlineGroupReady('audio-b1'))) next = mainPointListeningLesson(mainPointListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (mainPointRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const conditionRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:condition-outcome' : !requestedFocus && !reviewTerms.length && seed % 12 === 7);
  if (conditionRequested && (online || await offlineGroupReady('audio-b1'))) next = conditionListeningLesson(conditionListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (conditionRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const referenceRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:reference' : !requestedFocus && !reviewTerms.length && seed % 12 === 8);
  if (referenceRequested && (online || await offlineGroupReady('audio-b1'))) next = referenceListeningLesson(referenceListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (referenceRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const motiveRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:narrative-motive' : !requestedFocus && !reviewTerms.length && seed % 12 === 9);
  if (motiveRequested && (online || await offlineGroupReady('audio-b1'))) next = motiveListeningLesson(motiveListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (motiveRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const intentionRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:specific-intention' : !requestedFocus && !reviewTerms.length && seed % 12 === 10);
  if (intentionRequested && (online || await offlineGroupReady('audio-b1'))) next = intentionListeningLesson(intentionListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (intentionRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const procedureRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:procedural-plan' : !requestedFocus && !reviewTerms.length && seed % 12 === 11);
  if (procedureRequested && (online || await offlineGroupReady('audio-b1'))) next = procedureListeningLesson(procedureListeningSources.filter(source => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topic || corpusInterestMatch(source.title + '\n' + source.text, [topic]))), seen, seed);
  if (procedureRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };







  let downloadedFallback: Lesson | undefined;
  let downloadFailed = false;
  let downloaded: Awaited<ReturnType<typeof installSourcePack>> | undefined;
  if (!next && online && (skill === 'listening' && preferences?.listening !== 'A1' || skill === 'reading' && !['A1', 'A2'].includes(preferences?.reading ?? 'B2'))) {
    const installedPacks = await installedSourcePacks(profileId);
    const available = sourcePacks.filter(pack => pack.skill === skill && (!topic || pack.topic === topic) && !installedPacks.has(pack.id) && (skill === 'listening' ? pack.minSeconds !== null && pack.minSeconds <= maxSeconds : pack.minWords !== null && pack.minWords <= maxWords));
    if (available.length) {
      try { downloaded = await installSourcePack(available[packSeed % available.length].id, profileId); }
      catch { downloadFailed = true; }
    }
  }
  // New reading downloads join the available collection; listening retains its bank fallback.
  for (const source of skill === 'listening' && downloaded ? [downloaded, undefined] : [undefined]) {
    if (next) break;
    if (skill === 'reading') {
      const polarityRequested = requestedFocus === 'choice' && focus?.operation === 'choice:stated-polarity';
      if (preferences?.reading === 'A1' && (polarityRequested || !requestedFocus && !reviewTerms.length && seed % 2 === 1)
        && (!topic || topic === 'daily-life') && (!interests?.length || interests.includes('daily-life'))) {
        next = sentencePolarityLesson(sentenceSources.filter(source => !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId)), seen, seed, 'reading');
      }
      if (!next && polarityRequested) return { downloadFailed };
      if (!next) {
        const loaded = await loadReadingCorpus(profileId, maxWords);
        const corpus = filterCorpusRoots(topic ? { ...loaded, records: loaded.records.map(record => ({ ...record, passages: record.passages.filter(passage => corpusInterestMatch(record.title + '\n' + passage.text, [topic])) })).filter(record => record.passages.length) } : loaded, previewRoots);
        if (freshReview) next = corpusLesson(filterCorpusRoots(corpus, seenRoots), seen, seed, maxWords, preferences?.reading, interests, requestedFocus, reviewTerms, requestedFocus ? focus?.operation : undefined);
        if (next && focus?.reason !== 'review' && reviewTerms.length && !matchesReview(next)) next = undefined;
        next ??= corpusLesson(corpus, seen, seed, maxWords, preferences?.reading, interests, requestedFocus, reviewTerms, requestedFocus ? focus?.operation : undefined);
        if (next && focus?.reason === 'retry' && reviewTerms.length && !matchesReview(next)) next = corpusLesson(corpus, seen, seed, maxWords, preferences?.reading, interests, focus.kind, [], focus.operation);
        if (next && ['disagreement-synthesis', 'faithful-paraphrase', 'complex-pragmatics', 'layered-positions', 'rhetorical-function-in-context', 'nuanced-meaning-in-context', 'information-density-in-context', 'indirect-stance-in-context', 'argument-boundaries-in-context', 'register-audience-in-context', 'discourse-organization-in-context', 'implicit-intention-in-context', 'attributed-views-in-context', 'integrated-source-information', 'speaker-attitude-in-context', 'qualified-concession-meaning', 'contextual-comparison', 'claim-example-link', 'explicit-stated-reason', 'explicit-personal-update', 'explicit-stated-need', 'explicit-stated-preference', 'explicit-planned-order', 'explicit-person-description', 'explicit-place-relation', 'explicit-basic-instruction', 'explicit-small-count', 'explicit-detail-verification', 'explicit-stated-time'].includes(next.goalId) && next.materials.some(material => seenRoots.has(material.rootId))) next = corpusLesson(filterCorpusRoots(corpus, seenRoots), seen, seed, maxWords, preferences?.reading, interests, ['explicit-person-description', 'claim-example-link', 'discourse-organization-in-context', 'register-audience-in-context', 'argument-boundaries-in-context', 'indirect-stance-in-context'].includes(next.goalId) ? 'matching' : 'choice', reviewTerms, corpusOperation(next.materials[0].questions[0]));
      }
    }
    else if (preferences?.listening === 'A1') {
      if (beginnerSentenceReady(history, records, profileId) && (online || await offlineGroupReady('audio-beginner'))) {
        const available = sentenceSources.filter(source => !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId));
        const numericKinds = ['count', 'time'] as const;
        const numericKind = requestedFocus === 'choice' ? numericKinds.find(kind => focus?.operation === `choice:heard-${kind}`) : !requestedFocus ? numericKinds[seed % 11 - 6] : undefined;
        if (numericKind) {
          next = sentenceNumericLesson(numericSources[numericKind].filter(source => !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId)), seen, seed, numericKind);
          if (!next && requestedFocus === 'choice') return { downloadFailed };
        }
        const kinds = ['location', 'instruction', 'verification'] as const;
        const meaningKind = requestedFocus === 'choice' ? kinds.find(kind => focus?.operation === `choice:heard-${kind}`) : !requestedFocus ? kinds[seed % 7 - 2] : undefined;
        if (!next && meaningKind) {
          next = sentenceMeaningLesson(meaningSources[meaningKind].filter(source => !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId)), seen, seed, meaningKind);
          if (!next && requestedFocus === 'choice') return { downloadFailed };
        }
        const descriptionRequested = requestedFocus === 'choice' && focus?.operation === 'choice:heard-description';
        if (!next && (descriptionRequested || !requestedFocus && seed % 3 === 2)) next = sentenceDescriptionLesson(available, seen, seed);
        if (!next && !descriptionRequested && (requestedFocus === 'choice' || !requestedFocus && seed % 2 === 1)) next = sentencePolarityLesson(available, seen, seed);
        if (!next && requestedFocus !== 'choice') next = sentenceListeningLesson(available, seen, seed);
      }
      if (!next && requestedFocus !== 'choice' && (online || await offlineGroupReady('ipa'))) next = wordListeningLesson(wordSources, seen, seed);
    } else {
      const loadedBanks = await loadSpokenCorpora(profileId);
      alignmentBanks.push(...loadedBanks, ...(source?.spoken ? [source.spoken] : []));
      const installedBanks = topic ? loadedBanks.map(bank => ({ ...bank, records: bank.records.map(record => ({ ...record, clips: record.clips.filter(clip => corpusInterestMatch(record.title + '\n' + clip.text, [topic])) })).filter(record => record.clips.length) })).filter(bank => bank.records.length) : loadedBanks;
      const qualifiedSeconds = qualifiedLongSeconds(installedBanks, preferences?.listening, maxSeconds);
      const banks = (source?.spoken && !interests?.length ? [source.spoken] : installedBanks).map(bank => ({ ...bank, records: bank.records.filter(source => !previewRoots.has(source.rootId)) }));
      for (const freshOnly of freshReview ? [true, false] : [false]) {
        for (let offset = 0; offset < banks.length; offset++) {
          const bank = banks[(packSeed + offset) % banks.length];
          const applicationBanks = installedBanks.map(other => ({ ...other, records: other.records.filter(record => !previewRoots.has(record.rootId) && (!freshOnly || !seenRoots.has(record.rootId))) }));
          const eligible = freshOnly ? { ...bank, records: bank.records.filter(source => !seenRoots.has(source.rootId)) } : bank;
          let candidate = spokenCorpusLesson(eligible, seen, seed, qualifiedSeconds, preferences?.listening, interests, requestedFocus, reviewTerms, requestedFocus ? focus?.operation : undefined, applicationBanks);
          if (candidate && focus?.reason === 'retry' && reviewTerms.length && !matchesReview(candidate)) candidate = spokenCorpusLesson(eligible, seen, seed, qualifiedSeconds, preferences?.listening, interests, focus.kind, [], focus.operation, applicationBanks);
          if (candidate && ['disagreement-synthesis', 'faithful-paraphrase', 'complex-pragmatics', 'layered-positions', 'rhetorical-function-in-context', 'nuanced-meaning-in-context', 'information-density-in-context', 'indirect-stance-in-context', 'argument-boundaries-in-context', 'register-audience-in-context', 'discourse-organization-in-context', 'implicit-intention-in-context', 'attributed-views-in-context', 'integrated-source-information', 'speaker-attitude-in-context', 'qualified-concession-meaning', 'claim-example-link', 'contextual-comparison'].includes(candidate.goalId) && candidate.materials.some(material => seenRoots.has(material.rootId))) {
            const unseen = { ...eligible, records: eligible.records.filter(record => !seenRoots.has(record.rootId)) };
            const unseenApplications = applicationBanks.map(other => ({ ...other, records: other.records.filter(record => !seenRoots.has(record.rootId)) }));
            candidate = spokenCorpusLesson(unseen, seen, seed, qualifiedSeconds, preferences?.listening, interests, ['claim-example-link', 'discourse-organization-in-context', 'register-audience-in-context', 'argument-boundaries-in-context', 'indirect-stance-in-context'].includes(candidate.goalId) ? 'matching' : 'choice', reviewTerms, corpusOperation(candidate.materials[0].questions[0]), unseenApplications);
          }
          if (!candidate) continue;
          const preference = (lesson: Lesson) => corpusPreferenceScore(lesson.materials[0].title, lesson.materials[0].blocks.map(block => block.text).join('\n'), interests ?? [], seed, preferences?.listening, lesson.materials[0].audio?.duration);
          if (!next || matchesReview(next) === matchesReview(candidate) && preference(candidate) > preference(next) || !matchesReview(next) && matchesReview(candidate)) next = candidate;
          if (focus && (focus.reason === 'reteach' || !reviewTerms.length) && matchesFocus(candidate)) { next = candidate; break; }
          if (reviewTerms.length && matchesReview(candidate)) { next = candidate; break; }
          if (!focus && !reviewTerms.length && !interests?.length) { next = candidate; break; }
        }
        if (next && freshOnly && focus?.reason !== 'review' && reviewTerms.length && !matchesReview(next)) next = undefined;
        if (next) break;
      }
    }
    // A new package's unrelated task must not hide an installed focused practice.
    if (source && next && focus && !matchesFocus(next) && !matchesReview(next)) {
      downloadedFallback = next;
      next = undefined;
      continue;
    }
    if (next) break;
  }
  if (downloadedFallback && (!next || !matchesFocus(next) && !matchesReview(next))) next = downloadedFallback;
  if (next && requestedFocus && focus?.operation && next.materials.some(material => corpusOperation(material.questions[0]) !== focus.operation)) next = undefined;
  const reason = next && (matchesReview(next) && focus?.reason !== 'reteach' && focus?.reason !== 'review' ? 'vocabulary' : focus && matchesFocus(next) && (focus.reason !== 'review' || next.materials.every(material => !seenRoots.has(material.rootId))) ? focus.reason : undefined);
  return { lesson: next ? organizePractice(next, alignmentBanks) : undefined, reason, downloadFailed };
}

