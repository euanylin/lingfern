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
import { spokenCorpusLesson } from '../core/spokenCorpus';
import { qualifiedLongSeconds } from '../core/spokenLongAdmission';
import { filterCorpusRoots, corpusLesson } from '../core/corpus';
import { beginnerSentenceReady, corpusInterestMatch, corpusPreferenceScore, corpusOperation, corpusPracticeHistory } from '../core/corpusPractice';
import { wordListeningLesson, wordListeningWords } from '../core/wordListening';
import { sentenceListeningLesson, sentencePolarityLesson, sentenceDescriptionLesson, sentenceMeaningLesson, sentenceNumericLesson } from '../core/beginnerListening';
import sentenceSources from '../../public/audio/a1-sentences/SENTENCES.json';
import wordSources from '../../public/ipa/SOURCES.json';
import meaningSources from '../../public/audio/a1-sentences/MEANING.json';
import numericSources from '../../public/audio/a1-sentences/NUMERIC.json';
import { offlineGroupReady } from '../data/offline';
import { communityPackageReady } from '../data/communityInstall';
import { exposures, communityPacks } from '../data/db';
import { loadReadingCorpus, loadSpokenCorpora } from '../data/corpus';
import type { Attempt, Session } from '../data/db';
import type { Lesson, Locale, CorpusQuestionKind } from '../shared/content';
import { topicSchema } from '../shared/content';
import type { Preferences } from '../shared/preferences';
import { practiceSelectionMatches, practiceSelectionSchema, type PracticeSelection } from '../shared/practiceSelection';


const unfamiliarGoals = new Set(["argument-boundaries-in-context", "attributed-views-in-context", "claim-example-link", "complex-pragmatics", "contextual-comparison", "disagreement-synthesis", "discourse-organization-in-context", "explicit-basic-instruction", "explicit-detail-verification", "explicit-person-description", "explicit-personal-update", "explicit-place-relation", "explicit-planned-order", "explicit-small-count", "explicit-stated-need", "explicit-stated-preference", "explicit-stated-reason", "explicit-stated-time", "faithful-paraphrase", "implicit-intention-in-context", "indirect-stance-in-context", "information-density-in-context", "integrated-source-information", "layered-positions", "nuanced-meaning-in-context", "qualified-concession-meaning", "register-audience-in-context", "rhetorical-function-in-context", "speaker-attitude-in-context"]);

const sourceTopics = new Map(__LINGFERN_SOURCE_TOPICS__.map(record => [record.rootId, record]));

type PracticeReason = 'reteach' | 'retry' | 'review';

function shortSources(level: Preferences['listening']) {
  const groups: { level: string; kind: 'choice' | 'completion'; group: string; sources: { rootId: string; title: string; audio: { duration: number } }[]; generate: (input: unknown, seen: ReadonlySet<string>, seed: number) => Lesson | undefined }[] = [];
  const add = (level: string, kind: 'choice' | 'completion', group: string, sources: typeof groups[number]['sources'], generate: typeof groups[number]['generate']) => groups.push({ level, kind, group, sources, generate });
  add('A1', 'completion', 'ipa', wordSources.filter(source => wordListeningWords.has(source.word)).map(source => ({ ...source, rootId: `ipa-word-${source.word}`, title: source.word, audio: { duration: source.duration } })), (input, seen, seed) => wordListeningLesson((input as typeof groups[number]['sources']).map(source => { return wordSources.find(word => `ipa-word-${word.word}` === source.rootId)!; }), seen, seed));
  add('A1', 'completion', 'audio-beginner', sentenceSources, sentenceListeningLesson);
  add('A1', 'choice', 'audio-beginner', sentenceSources, sentencePolarityLesson);
  add('A1', 'choice', 'audio-beginner', sentenceSources, sentenceDescriptionLesson);
  for (const kind of ['location', 'instruction', 'verification'] as const) add('A1', 'choice', 'audio-beginner', meaningSources[kind], (input, seen, seed) => sentenceMeaningLesson(input, seen, seed, kind));
  for (const kind of ['count', 'time'] as const) add('A1', 'choice', 'audio-beginner', numericSources[kind], (input, seen, seed) => sentenceNumericLesson(input, seen, seed, kind));
  for (const kind of ['need', 'preference'] as const) add('A2', 'choice', 'audio-a2', personalListeningSources[kind], (input, seen, seed) => personalListeningLesson(input, seen, seed, kind));
  for (const [sources, generate] of [[orderListeningSources, actionOrderListeningLesson], [changeListeningSources, stateChangeListeningLesson], [reasonListeningSources, statedReasonListeningLesson], [ruleListeningSources, statedRuleListeningLesson], [integrationListeningSources, shortIntegrationListeningLesson]] as const) add('A2', 'choice', 'audio-a2', [...sources], generate);
  for (const [sources, generate] of [[mainPointListeningSources, mainPointListeningLesson], [conditionListeningSources, conditionListeningLesson], [referenceListeningSources, referenceListeningLesson], [motiveListeningSources, motiveListeningLesson], [intentionListeningSources, intentionListeningLesson], [procedureListeningSources, procedureListeningLesson]] as const) add('B1', 'choice', 'audio-b1', [...sources], generate);
  return groups.filter(group => group.level === level);
}

async function importedPracticeLessons(profileId: string, skill: 'reading' | 'listening') {
  const packs = await communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready' && pack.lessons.some(lesson => lesson.skill === skill)).toArray();
  const ready = await Promise.all(packs.map(async pack => await communityPackageReady(pack) ? pack.lessons.filter(lesson => lesson.skill === skill && !lesson.mode) : []));
  return ready.flat();
}

export async function practiceMaterials(profileId: string, skill: 'reading' | 'listening', preferences?: Preferences, history: Session[] = [], records: Attempt[] = [], online = typeof navigator === 'undefined' || navigator.onLine) {
  const { maxWords, maxSeconds } = corpusPracticeHistory(history, records, profileId, skill, 'all', preferences?.[skill]);
  const point = preferences?.[skill] ?? 'B2', beginner = point === 'A1' || point === 'A2';
  const imported = await importedPracticeLessons(profileId, skill);
  const choices = new Map<string, { label: string; group: string }>();
  for (const lesson of imported) for (const material of lesson.materials) choices.set(material.rootId, { label: `${material.title} · ${lesson.title.en}`, group: 'community' });
  const add = (root: string, title: string, hash?: string) => { const source = sourceTopics.get(root); choices.set(root, { label: title, group: source && source.sourceHash === hash && topicSchema.safeParse(source.topic).success ? source.topic : 'general' }); };
  if (skill === 'reading') {
    const corpus = await loadReadingCorpus(profileId, maxWords).catch(error => { if (error instanceof TypeError || error instanceof Error && error.message === 'MISSING_CORPUS') return { version: 1 as const, records: [], failures: [] }; throw error; });
    for (const record of corpus.records) if (record.passages.some(passage => !passage.quoteProvenance && passage.wordCount <= maxWords && (beginner ? passage.startingPoints?.includes(point) : !passage.startingPoints) && (!['C1', 'C2'].includes(point) || passage.wordCount >= 120))) add(record.rootId, record.title, record.sourceHash);
    if (preferences?.reading === 'A1') for (const source of sentenceSources) add(source.rootId, source.title);
  } else {
    if (point !== 'A1') {
      const banks = await loadSpokenCorpora(profileId), seconds = qualifiedLongSeconds(banks, preferences?.listening, maxSeconds);
      for (const bank of banks) for (const record of bank.records) if (record.clips.some(clip => clip.audio.duration <= seconds)) add(record.rootId, record.title, record.sourceHash);
    }
    const sentencesReady = beginnerSentenceReady(history, records, profileId);
    for (const group of shortSources(preferences?.listening)) if ((online || await offlineGroupReady(group.group)) && (group.group !== 'audio-beginner' || sentencesReady)) for (const source of group.sources) if (source.audio.duration <= maxSeconds) add(source.rootId, source.title);
  }
  return [...choices].map(([value, item]) => ({ value, ...item })).sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

async function selectedPractice(selection: PracticeSelection, input: { profileId: string; preferences?: Preferences; online: boolean; skill: 'reading' | 'listening'; interests?: Preferences['interests']; maxWords: number; maxSeconds: number; seen: ReadonlySet<string>; seenRoots: ReadonlySet<string>; previewRoots: ReadonlySet<string>; seed: number; sentencesReady: boolean }, kind?: CorpusQuestionKind) {
  const { profileId, preferences, online, skill, interests, maxWords, maxSeconds, seen, seenRoots, previewRoots, seed } = input;
  const allowed = (root: string, text: string, dailyLife = false) => (!selection.materials.length || selection.materials.includes(root)) && !previewRoots.has(root) && (!selection.topics.length || (dailyLife ? selection.topics.includes('daily-life') : corpusInterestMatch(text, selection.topics)));
  let lesson: Lesson | undefined;
  const banks: SpokenCorpus[] = [];
  if (skill === 'reading') {
    if (preferences?.reading === 'A1' && (!kind || kind === 'choice')) lesson = sentencePolarityLesson(sentenceSources.filter(source => !seenRoots.has(source.rootId) && allowed(source.rootId, source.title + '\n' + source.text, true)), seen, seed, 'reading');
    if (!lesson) {
      const loaded = await loadReadingCorpus(profileId, maxWords);
      const corpus = { ...loaded, records: loaded.records.map(record => ({ ...record, passages: record.passages.filter(passage => allowed(record.rootId, record.title + '\n' + passage.text)) })).filter(record => record.passages.length) };
      lesson = corpusLesson(corpus, seen, seed, maxWords, preferences?.reading, interests, kind, undefined, undefined, !selection.kinds.length);
    }
  } else {
    for (const group of shortSources(preferences?.listening)) {
      if (kind && group.kind !== kind || group.group === 'audio-beginner' && !input.sentencesReady || !online && !await offlineGroupReady(group.group)) continue;
      lesson = group.generate(group.sources.filter(source => source.audio.duration <= maxSeconds && !seenRoots.has(source.rootId) && allowed(source.rootId, source.title + '\n' + ('text' in source ? source.text : source.title), group.level === 'A1')), seen, seed);
      if (lesson) break;
    }
    if (!lesson && preferences?.listening !== 'A1') {
      for (const bank of await loadSpokenCorpora(profileId)) banks.push({ ...bank, records: bank.records.map(record => ({ ...record, clips: record.clips.filter(clip => allowed(record.rootId, record.title + '\n' + clip.text)) })).filter(record => record.clips.length) });
      const seconds = qualifiedLongSeconds(banks, preferences?.listening, maxSeconds);
      for (const bank of banks) {
        lesson = spokenCorpusLesson(bank, seen, seed, seconds, preferences?.listening, interests, kind, undefined, banks, !selection.kinds.length);
        if (lesson) break;
      }
    }
  }
  if (!lesson || unfamiliarGoals.has(lesson.goalId) && lesson.materials.some(material => seenRoots.has(material.rootId))) return;
  const result = organizePractice(lesson, banks, selection.kinds);
  return practiceSelectionMatches(result, selection) ? result : undefined;
}

export async function prepareCorpusPractice({ profileId, preferences, history, records, online, skill, topic, selection, previewIds = [], previewRoots = new Set<string>() }: {
  locale: Locale; profileId: string; preferences?: Preferences; history: Session[]; records: Attempt[]; online: boolean; skill: 'reading' | 'listening'; topic?: Preferences['interests'][number]; selection?: PracticeSelection; previewIds?: string[]; previewRoots?: ReadonlySet<string>;
}): Promise<{ lesson?: Lesson; reason?: PracticeReason; downloadFailed: boolean }> {
  if (selection) selection = practiceSelectionSchema.parse(selection);
  const topics = topic !== undefined ? [topicSchema.parse(topic)] : selection?.topics ?? [];
  if (topics.length && skill === 'listening' && preferences?.listening === 'A1' && !topics.includes('daily-life')) return { downloadFailed: false };
  // shortcut: keyword-based topics; replace with reviewed excerpt labels when available.
  const interests = topics.length ? topics : preferences?.interests;
  const ownHistory = history.filter(session => session.profileId === profileId);
  const { seen: reserved, maxWords, maxSeconds } = corpusPracticeHistory(history, records, profileId, skill, 'all', preferences?.[skill]);
  const reviews = goalReviews(ownHistory.map(session => session.lesson), ownHistory, records.filter(record => record.profileId === profileId));
  const { focus } = corpusPracticeHistory(history, records, profileId, skill, 'all', preferences?.[skill], reviews);
  const matchesFocus = (lesson: Lesson) => !!focus && corpusOperation(lesson.materials[0].questions[0]) === focus.operation;
  const requestedFocus = focus?.kind;
  const freshReview = focus?.reason === 'review';
  const contacts = await exposures.where('profileId').equals(profileId).toArray();
  const seen = new Set([...reserved, ...previewIds, ...new Set([...contacts.flatMap(exposure => (exposure.contacts ?? []).map(contact => contact.materialId))].filter(id => id.startsWith('corpus-')).map(id => id.slice('corpus-'.length)))]);
  const seenRoots = qualifiedKnownRoots([...ownHistory.flatMap(session => session.lesson.materials.map(material => material.rootId)), ...contacts.map(contact => contact.rootId)], ownHistory.flatMap(session => session.lesson.materials));
  const [packSeed, seed] = crypto.getRandomValues(new Uint32Array(2));
  if (selection?.materials.length) {
    const available = new Set((await practiceMaterials(profileId, skill, preferences, history, records, online)).map(item => item.value));
    if (selection.materials.some(root => !available.has(root))) return { downloadFailed: false };
  }
  if (selection?.materials.some(root => root.startsWith('community:'))) {
    const imported = await importedPracticeLessons(profileId, skill);
    const selected = imported.find(lesson => practiceSelectionMatches(lesson, selection));
    return { lesson: selected ? organizePractice(selected, [], selection.kinds) : undefined, downloadFailed: false };
  }
  if (selection && (selection.kinds.length || selection.materials.length)) {
    for (let offset = 0; offset < Math.max(1, selection.kinds.length); offset++) {
      const kind = selection.kinds.length ? selection.kinds[(seed + offset) % selection.kinds.length] : undefined;
      const lesson = await selectedPractice({ ...selection, topics }, { profileId, preferences, online, skill, interests, maxWords, maxSeconds, seen, seenRoots, previewRoots, seed, sentencesReady: beginnerSentenceReady(history, records, profileId) }, kind);
      if (lesson) return { lesson, downloadFailed: false };
    }
    return { downloadFailed: false };
  }
  let next: Lesson | undefined;
  const alignmentBanks: SpokenCorpus[] = [];
  const availableShortSource = (source: { audio: { duration: number }; rootId: string; title: string; text: string }) => source.audio.duration <= maxSeconds && !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId) && (!topics.length || corpusInterestMatch(source.title + '\n' + source.text, topics));
  const personalKinds = ['need', 'preference'] as const;
  const personalKind = skill === 'listening' && preferences?.listening === 'A2'
    ? requestedFocus === 'choice' ? personalKinds.find(kind => focus?.operation === `choice:heard-personal-${kind}`)
      : !requestedFocus ? personalKinds[seed % 12 - 5] : undefined
    : undefined;
  if (personalKind && (online || await offlineGroupReady('audio-a2'))) next = personalListeningLesson(personalListeningSources[personalKind].filter(availableShortSource), seen, seed, personalKind);
  if (personalKind && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const actionOrderRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-action-order' : !requestedFocus && seed % 12 === 7);
  if (actionOrderRequested && (online || await offlineGroupReady('audio-a2'))) next = actionOrderListeningLesson(orderListeningSources.filter(availableShortSource), seen, seed);
  if (actionOrderRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const stateChangeRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-state-change' : !requestedFocus && seed % 12 === 8);
  if (stateChangeRequested && (online || await offlineGroupReady('audio-a2'))) next = stateChangeListeningLesson(changeListeningSources.filter(availableShortSource), seen, seed);
  if (stateChangeRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const statedReasonRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-stated-reason' : !requestedFocus && seed % 12 === 9);
  if (statedReasonRequested && (online || await offlineGroupReady('audio-a2'))) next = statedReasonListeningLesson(reasonListeningSources.filter(availableShortSource), seen, seed);
  if (statedReasonRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const statedRuleRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-stated-rule' : !requestedFocus && seed % 12 === 10);
  if (statedRuleRequested && (online || await offlineGroupReady('audio-a2'))) next = statedRuleListeningLesson(ruleListeningSources.filter(availableShortSource), seen, seed);
  if (statedRuleRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const shortIntegrationRequested = skill === 'listening' && preferences?.listening === 'A2'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:heard-short-integration' : !requestedFocus && seed % 12 === 11);
  if (shortIntegrationRequested && (online || await offlineGroupReady('audio-a2'))) next = shortIntegrationListeningLesson(integrationListeningSources.filter(availableShortSource), seen, seed);
  if (shortIntegrationRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const mainPointRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:main-point' : !requestedFocus && seed % 12 === 6);
  if (mainPointRequested && (online || await offlineGroupReady('audio-b1'))) next = mainPointListeningLesson(mainPointListeningSources.filter(availableShortSource), seen, seed);
  if (mainPointRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const conditionRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:condition-outcome' : !requestedFocus && seed % 12 === 7);
  if (conditionRequested && (online || await offlineGroupReady('audio-b1'))) next = conditionListeningLesson(conditionListeningSources.filter(availableShortSource), seen, seed);
  if (conditionRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const referenceRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:reference' : !requestedFocus && seed % 12 === 8);
  if (referenceRequested && (online || await offlineGroupReady('audio-b1'))) next = referenceListeningLesson(referenceListeningSources.filter(availableShortSource), seen, seed);
  if (referenceRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const motiveRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:narrative-motive' : !requestedFocus && seed % 12 === 9);
  if (motiveRequested && (online || await offlineGroupReady('audio-b1'))) next = motiveListeningLesson(motiveListeningSources.filter(availableShortSource), seen, seed);
  if (motiveRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const intentionRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:specific-intention' : !requestedFocus && seed % 12 === 10);
  if (intentionRequested && (online || await offlineGroupReady('audio-b1'))) next = intentionListeningLesson(intentionListeningSources.filter(availableShortSource), seen, seed);
  if (intentionRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };
  const procedureRequested = skill === 'listening' && preferences?.listening === 'B1'
    && (requestedFocus === 'choice' ? focus?.operation === 'choice:procedural-plan' : !requestedFocus && seed % 12 === 11);
  if (procedureRequested && (online || await offlineGroupReady('audio-b1'))) next = procedureListeningLesson(procedureListeningSources.filter(availableShortSource), seen, seed);
  if (procedureRequested && requestedFocus === 'choice' && !next) return { downloadFailed: false };







  let downloadedFallback: Lesson | undefined;
  let downloadFailed = false;
  let downloaded: Awaited<ReturnType<typeof installSourcePack>> | undefined;
  if (!next && online && (skill === 'listening' && preferences?.listening !== 'A1' || skill === 'reading' && !['A1', 'A2'].includes(preferences?.reading ?? 'B2'))) {
    const installedPacks = await installedSourcePacks(profileId);
    const available = sourcePacks.filter(pack => pack.skill === skill && (!topics.length || topics.some(topic => topic === pack.topic)) && !installedPacks.has(pack.id) && (skill === 'listening' ? pack.minSeconds !== null && pack.minSeconds <= maxSeconds : pack.minWords !== null && pack.minWords <= maxWords));
    if (available.length) {
      try { downloaded = await installSourcePack(available[packSeed % available.length].id, profileId); }
      catch { downloadFailed = true; }
    }
  }
  // Add downloaded reading sources; preserve the listening-bank fallback.
  for (const source of skill === 'listening' && downloaded ? [downloaded, undefined] : [undefined]) {
    if (next) break;
    if (skill === 'reading') {
      const polarityRequested = requestedFocus === 'choice' && focus?.operation === 'choice:stated-polarity';
      if (preferences?.reading === 'A1' && (polarityRequested || !requestedFocus && seed % 2 === 1)
        && (!topics.length || topics.includes('daily-life')) && (!interests?.length || interests.includes('daily-life'))) {
        next = sentencePolarityLesson(sentenceSources.filter(source => !previewRoots.has(source.rootId) && !seenRoots.has(source.rootId)), seen, seed, 'reading');
      }
      if (!next && polarityRequested) return { downloadFailed };
      if (!next) {
        const loaded = await loadReadingCorpus(profileId, maxWords);
        const corpus = filterCorpusRoots(topics.length ? { ...loaded, records: loaded.records.map(record => ({ ...record, passages: record.passages.filter(passage => corpusInterestMatch(record.title + '\n' + passage.text, topics)) })).filter(record => record.passages.length) } : loaded, previewRoots);
        if (freshReview) next = corpusLesson(filterCorpusRoots(corpus, seenRoots), seen, seed, maxWords, preferences?.reading, interests, requestedFocus, requestedFocus ? focus?.operation : undefined);
        next ??= corpusLesson(corpus, seen, seed, maxWords, preferences?.reading, interests, requestedFocus, requestedFocus ? focus?.operation : undefined);
        if (next && unfamiliarGoals.has(next.goalId) && next.materials.some(material => seenRoots.has(material.rootId))) next = corpusLesson(filterCorpusRoots(corpus, seenRoots), seen, seed, maxWords, preferences?.reading, interests, ['explicit-person-description', 'claim-example-link', 'discourse-organization-in-context', 'register-audience-in-context', 'argument-boundaries-in-context', 'indirect-stance-in-context'].includes(next.goalId) ? 'matching' : 'choice', corpusOperation(next.materials[0].questions[0]));
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
      const installedBanks = topics.length ? loadedBanks.map(bank => ({ ...bank, records: bank.records.map(record => ({ ...record, clips: record.clips.filter(clip => corpusInterestMatch(record.title + '\n' + clip.text, topics)) })).filter(record => record.clips.length) })).filter(bank => bank.records.length) : loadedBanks;
      const qualifiedSeconds = qualifiedLongSeconds(installedBanks, preferences?.listening, maxSeconds);
      const banks = (source?.spoken && !interests?.length ? [source.spoken] : installedBanks).map(bank => ({ ...bank, records: bank.records.filter(source => !previewRoots.has(source.rootId)) }));
      for (const freshOnly of freshReview ? [true, false] : [false]) {
        for (let offset = 0; offset < banks.length; offset++) {
          const bank = banks[(packSeed + offset) % banks.length];
          const applicationBanks = installedBanks.map(other => ({ ...other, records: other.records.filter(record => !previewRoots.has(record.rootId) && (!freshOnly || !seenRoots.has(record.rootId))) }));
          const eligible = freshOnly ? { ...bank, records: bank.records.filter(source => !seenRoots.has(source.rootId)) } : bank;
          let candidate = spokenCorpusLesson(eligible, seen, seed, qualifiedSeconds, preferences?.listening, interests, requestedFocus, requestedFocus ? focus?.operation : undefined, applicationBanks);
          if (candidate && unfamiliarGoals.has(candidate.goalId) && candidate.materials.some(material => seenRoots.has(material.rootId))) {
            const unseen = { ...eligible, records: eligible.records.filter(record => !seenRoots.has(record.rootId)) };
            const unseenApplications = applicationBanks.map(other => ({ ...other, records: other.records.filter(record => !seenRoots.has(record.rootId)) }));
            candidate = spokenCorpusLesson(unseen, seen, seed, qualifiedSeconds, preferences?.listening, interests, ['claim-example-link', 'discourse-organization-in-context', 'register-audience-in-context', 'argument-boundaries-in-context', 'indirect-stance-in-context'].includes(candidate.goalId) ? 'matching' : 'choice', corpusOperation(candidate.materials[0].questions[0]), unseenApplications);
          }
          if (!candidate) continue;
          const preference = (lesson: Lesson) => corpusPreferenceScore(lesson.materials[0].title, lesson.materials[0].blocks.map(block => block.text).join('\n'), interests ?? [], seed, preferences?.listening, lesson.materials[0].audio?.duration);
          if (!next || preference(candidate) > preference(next)) next = candidate;
          if (focus && matchesFocus(candidate)) { next = candidate; break; }
          if (!focus && !interests?.length) { next = candidate; break; }
        }
        if (next) break;
      }
    }
    // Unrelated new tasks must not hide installed focused practice.
    if (source && next && focus && !matchesFocus(next)) {
      downloadedFallback = next;
      next = undefined;
      continue;
    }
    if (next) break;
  }
  if (downloadedFallback && (!next || !matchesFocus(next))) next = downloadedFallback;
  if (next && requestedFocus && focus?.operation && next.materials.some(material => corpusOperation(material.questions[0]) !== focus.operation)) next = undefined;
  const reason = next && focus && matchesFocus(next) && (focus.reason !== 'review' || next.materials.every(material => !seenRoots.has(material.rootId))) ? focus.reason : undefined;
  return { lesson: next ? organizePractice(next, alignmentBanks) : undefined, reason, downloadFailed };
}

