import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Corpus } from '../src/core/corpus';
import { corpusLesson } from '../src/core/corpus';
import { prepareCorpusPractice } from '../src/app/CorpusPractice';
import { loadReadingCorpus, loadSpokenCorpora } from '../src/data/corpus';
import { installSourcePack, sourcePacks } from '../src/data/sourcePacks';

vi.mock('../src/core/corpus', async importOriginal => ({ ...await importOriginal<typeof import('../src/core/corpus')>(), corpusLesson: vi.fn() }));
vi.mock('../src/data/corpus', async importOriginal => ({ ...await importOriginal<typeof import('../src/data/corpus')>(), loadReadingCorpus: vi.fn(), loadSpokenCorpora: vi.fn() }));
vi.mock('../src/data/sourcePacks', async importOriginal => ({ ...await importOriginal<typeof import('../src/data/sourcePacks')>(), installedSourcePacks: vi.fn(async () => new Set()), installSourcePack: vi.fn() }));
// Node fixtures have no installed built-in audio cache; actual offline installation is browser-tested.
vi.mock('../src/data/offline', async importOriginal => ({ ...await importOriginal<typeof import('../src/data/offline')>(), offlineGroupReady: vi.fn(async () => false) }));
vi.mock('../src/data/memory', () => ({ dueMemories: vi.fn(async () => []) }));
vi.mock('../src/core/spokenCorpus', async importOriginal => ({ ...await importOriginal<typeof import('../src/core/spokenCorpus')>(), spokenCorpusLesson: vi.fn() }));
vi.mock('../src/core/wordListening', () => ({ wordListeningLesson: vi.fn() }));
import { spokenCorpusLesson, type SpokenCorpus } from '../src/core/spokenCorpus';
import { wordListeningLesson } from '../src/core/wordListening';
import { corpusInterestMatch, corpusOperation } from '../src/core/corpusPractice';
import { sentencePolarityLesson } from '../src/core/beginnerListening';
import type { Attempt, Session } from '../src/data/db';
import wordSources from '../public/ipa/SOURCES.json';
import sentenceSources from '../public/audio/a1-sentences/SENTENCES.json';

beforeEach(() => { vi.mocked(corpusLesson).mockReset(); vi.mocked(spokenCorpusLesson).mockReset(); vi.mocked(loadReadingCorpus).mockReset(); vi.mocked(loadSpokenCorpora).mockReset(); vi.mocked(installSourcePack).mockReset(); vi.mocked(wordListeningLesson).mockReset(); });
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

it('generates A1 reading polarity without an audio prerequisite and excludes roots seen in either skill', async () => {
  const base = { locale: 'zh-Hans' as const, profileId: 'reading-polarity-route', preferences: { reading: 'A1' as const, interests: [], step: 4, completed: true }, online: false, skill: 'reading' as const };
  vi.spyOn(crypto, 'getRandomValues').mockReturnValue(new Uint32Array([1, 1]));
  const result = await prepareCorpusPractice({ ...base, history: [], records: [] });
  expect(result.lesson?.goalId).toBe('stated-polarity-verification');
  expect(result.lesson!.materials.every(material => !material.audio)).toBe(true);
  expect(loadReadingCorpus).not.toHaveBeenCalled(); expect(installSourcePack).not.toHaveBeenCalled();
  const lesson = result.lesson!, at = new Date(Date.now() - 10000).toISOString();
  const prior: Session = { id: 'reading-polarity-completed', profileId: base.profileId, lesson, contentHash: 'a'.repeat(64), position: 1, status: 'completed', startedAt: at, assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(material => ({ id: material.id, profileId: base.profileId, sessionId: prior.id, questionId: material.questions[0].id, rootId: material.rootId, answer: 0, correct: false, rule: 'isolated-route-test', assistance: { hintLevel: 0 }, submittedAt: at }));
  vi.mocked(corpusLesson).mockClear();
  expect((await prepareCorpusPractice({ ...base, history: [prior], records })).lesson).toBeUndefined();
  expect(corpusLesson).not.toHaveBeenCalled();
  vi.mocked(loadReadingCorpus).mockResolvedValue({ version: 1, records: [], failures: [] });
  const heard = sentencePolarityLesson(sentenceSources, new Set(), 1)!;
  const heardPrior = { ...prior, lesson: heard };
  const afterListening = await prepareCorpusPractice({ ...base, history: [heardPrior], records: [] });
  expect(afterListening.lesson?.goalId).toBe('stated-polarity-verification');
  expect(afterListening.lesson!.materials.every(material => !heard.materials.some(old => old.rootId === material.rootId))).toBe(true);
  expect(corpusLesson).not.toHaveBeenCalled();
});

it('routes the new A1 meaning operation only after real word prerequisites, and never changes operation on exhaustion', async () => {
  const { wordListeningLesson: realWords } = await vi.importActual<typeof import('../src/core/wordListening')>('../src/core/wordListening');
  const profileId = 'polarity-routing-only', at = Date.now() - 10000;
  const first = realWords(wordSources, new Set(), 0)!;
  const second = realWords(wordSources, new Set(first.materials.map(material => material.audio!.sha256)), 0)!;
  const history: Session[] = [first, second].map((lesson, index) => ({ id: `polarity-words-${index}`, profileId, lesson,
    contentHash: 'a'.repeat(64), position: 1, status: 'completed', startedAt: new Date(at + index * 1000).toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 }));
  const answers = (session: Session, correct: boolean): Attempt[] => session.lesson.materials.flatMap(material => material.questions.map(question => ({
    id: `${session.id}:${question.id}`, profileId, sessionId: session.id, questionId: question.id, rootId: material.rootId,
    answer: 'kind' in question && question.kind === 'completion' ? correct ? question.answer : 'unheard' : !('kind' in question) ? correct ? question.answer : (question.answer + 1) % question.options.length : 0, correct, rule: 'isolated-routing-test',
    assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: session.startedAt,
  })));
  const records = history.flatMap(session => answers(session, true));
  const base = { locale: 'zh-Hans' as const, profileId, preferences: { listening: 'A1' as const, interests: [], step: 4, completed: true }, online: true, skill: 'listening' as const };
  vi.spyOn(crypto, 'getRandomValues').mockReturnValue(new Uint32Array([1, 1]));
  for (const [seed, kind] of [[9, 'location'], [10, 'instruction'], [11, 'verification'], [6, 'count'], [7, 'time']] as const) {
    vi.mocked(crypto.getRandomValues).mockReturnValue(new Uint32Array([seed, seed]));
    const current = (await prepareCorpusPractice({ ...base, history, records })).lesson!;
    expect(current.goalId).toBe(`heard-explicit-${kind}`);
    const failed: Session = { ...history[0], id: `failed-${kind}`, lesson: current, startedAt: new Date(at + 2000).toISOString() };
    vi.mocked(wordListeningLesson).mockClear();
    expect((await prepareCorpusPractice({ ...base, history: [...history, failed], records: [...records, ...answers(failed, false)] })).lesson).toBeUndefined();
    expect(wordListeningLesson).not.toHaveBeenCalled();
  }
  vi.mocked(crypto.getRandomValues).mockReturnValue(new Uint32Array([6, 6]));
  const countLesson = (await prepareCorpusPractice({ ...base, history, records })).lesson!;
  const completedCount: Session = { ...history[0], id: 'count-to-clock', lesson: countLesson, startedAt: new Date(at + 2000).toISOString() };
  const countAnswers = answers(completedCount, true).map((answer, index) => ({ ...answer, assistance: { ...answer.assistance, hintLevel: index ? 0 : 3 } }));
  vi.mocked(crypto.getRandomValues).mockReturnValue(new Uint32Array([7, 7]));
  const nextClock = await prepareCorpusPractice({ ...base, history: [...history, completedCount], records: [...records, ...countAnswers] });
  expect(nextClock.lesson?.goalId).toBe('heard-explicit-time');
  expect(nextClock.lesson!.materials.every(material => !countLesson.materials.some(old => old.rootId === material.rootId))).toBe(true);
  vi.mocked(crypto.getRandomValues).mockReturnValue(new Uint32Array([1, 1]));
  const before = structuredClone({ history, records });
  const result = await prepareCorpusPractice({ ...base, history, records });
  expect(result.lesson?.goalId).toBe('heard-polarity-verification');
  expect({ history, records }).toEqual(before);
  expect(installSourcePack).not.toHaveBeenCalled();
  expect((await prepareCorpusPractice({ ...base, history: history.slice(0, 1), records: records.slice(0, 2) })).lesson?.goalId).not.toBe('heard-polarity-verification');
  vi.mocked(crypto.getRandomValues).mockReturnValue(new Uint32Array([5, 5]));
  const description = (await prepareCorpusPractice({ ...base, history, records })).lesson!;
  expect(description.goalId).toBe('heard-explicit-description');
  const described: Session = { ...history[0], id: 'description-incorrect', lesson: description, startedAt: new Date(at + 2000).toISOString() };
  vi.mocked(wordListeningLesson).mockClear();
  expect((await prepareCorpusPractice({ ...base, history: [...history, described], records: [...records, ...answers(described, false)] })).lesson).toBeUndefined();
  expect(wordListeningLesson).not.toHaveBeenCalled();
  const seenDescription: Session = { ...described, lesson: { ...description, skill: 'reading' } };
  const afterSeen = await prepareCorpusPractice({ ...base, history: [...history, seenDescription], records });
  expect(afterSeen.lesson?.goalId).not.toBe('heard-explicit-description');
  expect(afterSeen.lesson?.materials.every(material => !description.materials.some(old => old.rootId === material.rootId))).not.toBe(false);
  vi.mocked(crypto.getRandomValues).mockReturnValue(new Uint32Array([1, 1]));
  const lesson = sentencePolarityLesson(sentenceSources, new Set(), 1)!;
  const session: Session = { ...history[0], id: 'polarity-incorrect', lesson, startedAt: new Date(at + 2000).toISOString() };
  const nextLesson = sentencePolarityLesson(sentenceSources, new Set(lesson.materials.map(material => material.audio!.sha256)), 1)!;
  const nextSession: Session = { ...session, id: 'polarity-second-incorrect', lesson: nextLesson, startedAt: new Date(at + 3000).toISOString() };
  expect((await prepareCorpusPractice({ ...base, history: [...history, session], records: [...records, ...answers(session, false)] })).lesson?.goalId).toBe('heard-polarity-verification');
  const readSession: Session = { ...session, id: 'polarity-seen-in-reading', lesson: { ...lesson, skill: 'reading' } };
  const afterReading = await prepareCorpusPractice({ ...base, history: [...history, readSession], records });
  expect(afterReading.lesson?.goalId).toBe('heard-polarity-verification');
  expect(afterReading.lesson!.materials.every(material => !readSession.lesson.materials.some(read => read.rootId === material.rootId))).toBe(true);
  vi.mocked(wordListeningLesson).mockClear();
  const exhausted = await prepareCorpusPractice({ ...base, history: [...history, session, nextSession], records: [...records, ...answers(session, false), ...answers(nextSession, false)] });
  expect(exhausted.lesson).toBeUndefined();
  expect(wordListeningLesson).not.toHaveBeenCalled();
});

it('uses all available reading sources after a normal online package install with no interests', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const entry = sourcePacks.find(pack => pack.skill === 'reading' && pack.sourceFamilies.includes('wikipedia'))!;
  const downloaded = await inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)));
  expect(downloaded.hash).toBe(entry.sha256);
  expect(downloaded.id).toBe(entry.id);
  const bundled = ['voa', 'gutenberg'].flatMap(source => (JSON.parse(readFileSync(`${source === 'gutenberg' ? 'content' : 'public'}/corpus/${source}.json`, 'utf8')) as Corpus).records);
  const merged: Corpus = { version: 1, failures: [], records: [...bundled, ...downloaded.corpus!.records] };
  vi.mocked(installSourcePack).mockResolvedValue(downloaded);
  vi.mocked(loadReadingCorpus).mockResolvedValue(merged);
  const result = await prepareCorpusPractice({ locale: 'zh-Hans', profileId: 'mixed-download-regression', preferences: { reading: 'B1', interests: [], step: 4, completed: true }, history: [], records: [], online: true, skill: 'reading' });
  expect(installSourcePack).toHaveBeenCalledTimes(1);
  expect(loadReadingCorpus).toHaveBeenCalledWith('mixed-download-regression', 220);
  expect(corpusLesson).toHaveBeenCalled();
  for (const call of vi.mocked(corpusLesson).mock.calls) {
    expect(call[0].records).toEqual(merged.records);
    expect(['voa-', 'gutenberg-', 'wikipedia-'].every(prefix => call[0].records.some(record => record.id.startsWith(prefix)))).toBe(true);
  }
  expect(result.downloadFailed).toBe(false);
});

const readingBank = () => JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')) as Corpus;
const base = { locale: 'zh-Hans' as const, profileId: 'isolated-topic-selection', history: [], records: [], online: false };

it('hard-filters reading passages for the selected topic while preserving source metadata and preferences', async () => {
  vi.spyOn(crypto, 'getRandomValues').mockReturnValue(new Uint32Array([0, 0]));
  const bank = readingBank(), saved = structuredClone(bank);
  const preferences = { reading: 'A1' as const, interests: ['science' as const], step: 4, completed: true };
  const originalPreferences = structuredClone(preferences);
  vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson);
  const result = await prepareCorpusPractice({ ...base, preferences, skill: 'reading', topic: 'daily-life' });
  expect(result.lesson).toBeDefined();
  expect(new Set(result.lesson!.materials.map(material => material.rootId)).size).toBe(2);
  expect(result.lesson!.materials.every(material => corpusInterestMatch(material.title + '\n' + material.blocks[0].text, ['daily-life']))).toBe(true);
  for (const call of vi.mocked(corpusLesson).mock.calls) {
    expect(call[5]).toEqual(['daily-life']);
    for (const record of call[0].records) {
      const original = saved.records.find(source => source.rootId === record.rootId)!;
      expect({ ...record, passages: original.passages }).toEqual(original);
      for (const passage of record.passages) {
        expect(original.passages).toContainEqual(passage);
        expect(corpusInterestMatch(record.title + '\n' + passage.text, ['daily-life'])).toBe(true);
      }
    }
  }
  expect(bank).toEqual(saved); expect(preferences).toEqual(originalPreferences);
});

it('does not replace a reading topic without eligible material with an unrelated topic', async () => {
  const bank = readingBank(), original = bank.records[0];
  const unrelated = { ...bank, records: [{ ...original, title: 'A blank heading', passages: [{ ...original.passages[0], text: 'There is nothing about the requested subject here.' }] }] };
  vi.mocked(loadReadingCorpus).mockResolvedValue(unrelated);
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson);
  const result = await prepareCorpusPractice({ ...base, preferences: { reading: 'A1', interests: [], step: 4, completed: true }, skill: 'reading', topic: 'science' });
  expect(result).toEqual({ lesson: undefined, reason: undefined, downloadFailed: false });
  expect(vi.mocked(corpusLesson).mock.calls.every(call => call[0].records.length === 0)).toBe(true);
});

it('downloads only metadata-matching reading topic packages without trusting their topic as passage evidence', async () => {
  const bank = readingBank(); vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
  vi.spyOn(crypto, 'getRandomValues').mockReturnValue(new Uint32Array([0, 0]));
  const chosen = sourcePacks.find(pack => pack.skill === 'reading' && pack.topic === 'science' && pack.minWords !== null && pack.minWords <= 220)!;
  expect(chosen).toBeDefined();
  vi.mocked(installSourcePack).mockResolvedValue({ corpus: bank } as Awaited<ReturnType<typeof installSourcePack>>);
  await prepareCorpusPractice({ ...base, online: true, preferences: { reading: 'B1', interests: ['travel'], step: 4, completed: true }, skill: 'reading', topic: 'science' });
  expect(installSourcePack).toHaveBeenCalledWith(chosen.id, base.profileId);
  for (const call of vi.mocked(corpusLesson).mock.calls) expect(call[0].records.every(record => record.passages.every(passage => corpusInterestMatch(record.title + '\n' + passage.text, ['science'])))).toBe(true);
});

it('filters listening primary and application clips inside their guarded banks without changing source or audio metadata', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const entry = sourcePacks.find(pack => pack.skill === 'listening' && pack.topic === 'science')!;
  const downloaded = await inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)));
  const source = downloaded.spoken!.records[0], clip = source.clips[0];
  // Isolated orchestration fixtures: no audio/content acceptance or production installation.
  const bank: SpokenCorpus = { ...downloaded.spoken!, records: [
    { ...source, title: 'A neutral heading', clips: [{ ...clip, text: 'A science experiment in a laboratory.' }, { ...clip, text: 'A passport for a journey.' }] },
    { ...source, rootId: 'isolated-secondary-root', title: 'Another heading', clips: [{ ...clip, text: 'A physics experiment.' }] },
  ] };
  const original = structuredClone(bank);
  vi.mocked(loadSpokenCorpora).mockResolvedValue([bank]);
  await prepareCorpusPractice({ ...base, preferences: { listening: 'B1', interests: ['travel'], step: 4, completed: true }, skill: 'listening', topic: 'science' });
  expect(spokenCorpusLesson).toHaveBeenCalled();
  for (const call of vi.mocked(spokenCorpusLesson).mock.calls) {
    expect(call[5]).toEqual(['science']);
    for (const selected of [call[0], ...(call[9] ?? [])]) for (const record of selected.records) for (const item of record.clips) {
      expect(corpusInterestMatch(record.title + '\n' + item.text, ['science'])).toBe(true);
      expect(bank.records.find(source => source.rootId === record.rootId)!.clips).toContainEqual(item);
    }
  }
  expect(bank).toEqual(original);
});

it('returns no listening task rather than unrelated audio when the topic is absent', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const entry = sourcePacks.find(pack => pack.skill === 'listening')!;
  const bank = (await inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)))).spoken!;
  vi.mocked(loadSpokenCorpora).mockResolvedValue([{ ...bank, records: bank.records.map(record => ({ ...record, title: 'A journey', clips: record.clips.map(clip => ({ ...clip, text: 'A passport for a journey.' })) })) }]);
  const result = await prepareCorpusPractice({ ...base, preferences: { listening: 'B1', interests: [], step: 4, completed: true }, skill: 'listening', topic: 'science' });
  expect(result.lesson).toBeUndefined(); expect(spokenCorpusLesson).not.toHaveBeenCalled(); expect(wordListeningLesson).not.toHaveBeenCalled();
});

it('keeps A1 word listening limited to daily-life instead of substituting it for another selected topic', async () => {
  const preferences = { listening: 'A1' as const, interests: [], step: 4, completed: true };
  expect(await prepareCorpusPractice({ ...base, online: true, preferences, skill: 'listening', topic: 'science' })).toEqual({ downloadFailed: false });
  expect(wordListeningLesson).not.toHaveBeenCalled(); expect(loadSpokenCorpora).not.toHaveBeenCalled(); expect(installSourcePack).not.toHaveBeenCalled();
  await prepareCorpusPractice({ ...base, online: true, preferences, skill: 'listening', topic: 'daily-life' });
  expect(wordListeningLesson).toHaveBeenCalled();
});

it('rejects an invalid runtime topic before loading or downloading material', async () => {
  await expect(prepareCorpusPractice({ ...base, skill: 'reading', topic: 'invalid-topic' as 'science' })).rejects.toThrow();
  expect(loadReadingCorpus).not.toHaveBeenCalled(); expect(installSourcePack).not.toHaveBeenCalled();
});

it('preserves unfiltered default listening banks and preference interests when no topic is selected', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const entry = sourcePacks.find(pack => pack.skill === 'listening')!;
  const bank = (await inspectCommunityPack(new Uint8Array(readFileSync('public' + entry.path)))).spoken!;
  vi.mocked(loadSpokenCorpora).mockResolvedValue([bank]);
  const preferences = { listening: 'B1' as const, interests: ['travel' as const], step: 4, completed: true };
  await prepareCorpusPractice({ ...base, preferences, skill: 'listening' });
  expect(spokenCorpusLesson).toHaveBeenCalled();
  for (const call of vi.mocked(spokenCorpusLesson).mock.calls) { expect(call[0]).toEqual(bank); expect(call[5]).toEqual(preferences.interests); expect(call[9]).toEqual([bank]); }
});
it.each(['reading','listening'] as const)('stops exhausted focused %s entry without changing the requested operation or original history',async skill=>{
 const {corpusLesson:generate,corpusSchema}=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
 const bank=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json','utf8')));
 const lesson={...generate(bank,new Set(),0,300,'B2',[],'completion')!,skill};
 const session:import('../src/data/db').Session={id:'exhausted-focus',profileId:base.profileId,lesson,contentHash:'a'.repeat(64),position:4,status:'completed',startedAt:'2026-09-01T00:00:00.000Z',assistance:{hintLevel:0},leaseUntil:0};
 const records:import('../src/data/db').Attempt[]=lesson.materials.flatMap(m=>m.questions.filter(q=>!('kind'in q)||q.kind!=='response').map(q=>({id:q.id,profileId:base.profileId,sessionId:session.id,questionId:q.id,rootId:m.rootId,answer:'INVALID',correct:false,rule:'test-only',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:'2026-09-02T00:00:00.000Z'})));
 vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
 const {inspectCommunityPack}=await import('../src/data/communityPack');const entry=sourcePacks.find(p=>p.skill==='listening')!;vi.mocked(loadSpokenCorpora).mockResolvedValue([(await inspectCommunityPack(new Uint8Array(readFileSync('public'+entry.path)))).spoken!]);
 const other={...generate(bank,new Set(),0,300,'B2',[],'sequence')!,skill};
 for(const primaryMatches of [false,true]){
  const fallback=structuredClone(other);if(primaryMatches)fallback.materials[0]=structuredClone(lesson.materials[0]);
  vi.mocked(corpusLesson).mockReturnValue(fallback);vi.mocked(spokenCorpusLesson).mockReturnValue(fallback);
  const before=structuredClone({session,records});const result=await prepareCorpusPractice({...base,skill,preferences:{[skill]:'B1',interests:[],step:4,completed:true},history:[session],records});
  expect(result.lesson).toBeUndefined();expect(result.downloadFailed).toBe(false);expect({session,records}).toEqual(before);
 }
});

it.each(['explicit-person-description', 'explicit-place-relation', 'explicit-basic-instruction', 'explicit-small-count', 'explicit-detail-verification', 'explicit-stated-time'])('routes actual A1 %s and refuses seen cross-skill roots without substituting another goal', async goal => {
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const bank = actual.corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 120);
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson);
  vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
  const seed = Array.from({ length: 2000 }, (_, i) => i * 2).find(seed => actual.corpusLesson(bank, new Set(), seed, 120, 'A1')?.goalId === goal);
  expect(seed).toBeDefined();
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, seed!]); return array; });
  const profileId = 'isolated-people-routing', preferences = { reading: 'A1' as const, interests: [], step: 4, completed: true };
  const first = (await prepareCorpusPractice({ skill: 'reading', locale: 'zh-Hans', history: [], records: [], online: false, profileId, preferences })).lesson!;
  expect(first.goalId).toBe(goal);
  const old: Session = { id: 'heard-original', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson: { ...first, skill: 'listening' }, status: 'active', position: 0, startedAt: '2026-10-15T00:00:00.000Z' };
  const after = (await prepareCorpusPractice({ skill: 'reading', locale: 'zh-Hans', history: [old], records: [], online: false, profileId, preferences })).lesson;
  expect(after?.goalId).not.toBe(goal);
  expect(installSourcePack).not.toHaveBeenCalled();
});

it('routes inspected A2 planned order and stops same-goal transfer after cross-skill exposure', async () => {
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const bank = actual.corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 120);
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson); vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 1800]); return array; });
  const base = { skill: 'reading' as const, locale: 'zh-Hans' as const, online: false, profileId: 'isolated-planned-order', preferences: { reading: 'A2' as const, interests: [], step: 4, completed: true } };
  const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
  expect(lesson.goalId).toBe('explicit-planned-order');
  const session: Session = { id: 'order-seen-in-listening', profileId: base.profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson: { ...lesson, skill: 'listening' }, status: 'active', position: 0, startedAt: '2026-10-15T00:00:00.000Z' };
  expect((await prepareCorpusPractice({ ...base, history: [session], records: [] })).lesson?.goalId).not.toBe('explicit-planned-order');
  expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set(lesson.materials.map(m => m.rootId)) })).lesson?.goalId).not.toBe('explicit-planned-order');
});

it.each([['need', 2175], ['preference', 2550]] as const)('routes actual A2 %s and refuses exposed or previewed independent work', async (kind, seed) => {
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const bank = actual.corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 160);
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson); vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, seed]); return array; });
  const base = { skill: 'reading' as const, locale: 'zh-Hans' as const, online: false, profileId: `isolated-personal-${kind}`, preferences: { reading: 'A2' as const, interests: [], step: 4, completed: true } };
  const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
  expect(lesson.goalId).toBe(`explicit-stated-${kind}`);
  const old: Session = { id: 'seen-other-skill', profileId: base.profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson: { ...lesson, skill: 'listening' }, status: 'active', position: 0, startedAt: '2026-10-15T00:00:00.000Z' };
  expect((await prepareCorpusPractice({ ...base, history: [old], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);
  expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set(lesson.materials.map(m => m.rootId)) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it.each([['need', 5], ['preference', 6]] as const)('routes A2 hearing %s locally without a source download and stops focused exhaustion', async (kind, seed) => {
  const profileId = `isolated-a2-heard-${kind}`, preferences = { listening: 'A2' as const, interests: [], step: 4, completed: true };
  const base = { skill: 'listening' as const, locale: 'zh-Hans' as const, online: true, profileId, preferences };
  vi.mocked(loadSpokenCorpora).mockResolvedValue([]);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, seed]); return array; });
  const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
  expect(lesson?.goalId).toBe(`heard-stated-${kind}`); expect(loadSpokenCorpora).not.toHaveBeenCalled(); expect(installSourcePack).not.toHaveBeenCalled();
  const at = new Date(Date.now() - 1000).toISOString();
  const session: Session = { id: 'heard-personal-completed', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-route-test', assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: at }));
  const unchanged = structuredClone({ session, records });
  vi.mocked(installSourcePack).mockClear(); vi.mocked(loadSpokenCorpora).mockClear();
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
  expect(installSourcePack).not.toHaveBeenCalled(); expect(loadSpokenCorpora).not.toHaveBeenCalled(); expect({ session, records }).toEqual(unchanged);
  const otherSkill: Session = { ...session, lesson: { ...lesson, skill: 'reading' }, status: 'active' };
  expect((await prepareCorpusPractice({ ...base, history: [otherSkill], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);
  expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set(lesson.materials.map(m => m.rootId)) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('keeps the A2 supported12-second budget when a complete liking pair requires a longer source', async () => {
  const { personalListeningLesson } = await import('../src/core/a2Listening');
  const data = (await import('../public/audio/a2-speech/PERSONAL.json')).default;
  const lesson = personalListeningLesson(data.need, new Set(), 0, 'need')!;
  const profileId = 'isolated-a2-listening-budget', start = Date.now() - 5000;
  const session: Session = { id: 'needed-support', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: new Date(start).toISOString() };
  const records: Attempt[] = lesson.materials.map((m, i) => ({ id: m.id, profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: true, rule: 'isolated-budget-test', assistance: { hintLevel: i ? 0 : 3, audioCompleted: true, playbackRequests: 1 }, submittedAt: new Date(start + 1000 + i * 1000).toISOString() }));
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 6]); return array; });
  vi.mocked(loadSpokenCorpora).mockResolvedValue([]);
  const base = { skill: 'listening' as const, locale: 'zh-Hans' as const, online: true, profileId, preferences: { listening: 'A2' as const, interests: [], step: 4, completed: true } };
  const { corpusPracticeHistory } = await import('../src/core/corpusPractice');
  expect(corpusPracticeHistory([session], records, profileId, 'listening', 'all', 'A2').maxSeconds).toBe(12);
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson?.goalId).not.toBe('heard-stated-preference');
  const unassisted = records.map(a => ({ ...a, assistance: { ...a.assistance, hintLevel: 0 } }));
  expect(corpusPracticeHistory([session], unassisted, profileId, 'listening', 'all', 'A2').maxSeconds).toBe(20);
  expect((await prepareCorpusPractice({ ...base, history: [session], records: unassisted })).lesson?.goalId).toBe('heard-stated-preference');
  vi.mocked(crypto.getRandomValues).mockImplementation(array => { (array as Uint32Array).set([0, 7]); return array; });
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson?.goalId).not.toBe('heard-explicit-action-order');
  expect((await prepareCorpusPractice({ ...base, history: [session], records: unassisted })).lesson?.goalId).toBe('heard-explicit-action-order');
  vi.mocked(crypto.getRandomValues).mockImplementation(array => { (array as Uint32Array).set([0, 8]); return array; });
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson?.goalId).toBe('heard-reported-state-change');
  vi.mocked(crypto.getRandomValues).mockImplementation(array => { (array as Uint32Array).set([0, 9]); return array; });
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson?.goalId).not.toBe('heard-stated-reason');
  expect((await prepareCorpusPractice({ ...base, history: [session], records: unassisted })).lesson?.goalId).toBe('heard-stated-reason');
});

it('routes ordinary A2 temporal order locally, excludes cross-skill history/previews and stops focused exhaustion', async () => {
  const profileId = 'isolated-a2-order';
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 7]); return array; });
  vi.mocked(loadSpokenCorpora).mockResolvedValue([]);
  const base = { skill: 'listening' as const, locale: 'zh-Hans' as const, online: true, profileId, preferences: { listening: 'A2' as const, interests: [], step: 4, completed: true }, history: [] as Session[], records: [] as Attempt[] };
  vi.mocked(installSourcePack).mockClear();
  const lesson = (await prepareCorpusPractice(base)).lesson!; expect(lesson.goalId).toBe('heard-explicit-action-order'); expect(installSourcePack).not.toHaveBeenCalled();
  const at = new Date(Date.now() - 1000).toISOString();
  const session: Session = { id: 'order-done', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-order-test', assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: at }));
  const unchanged = structuredClone({ session, records }); vi.mocked(installSourcePack).mockClear();
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined(); expect(installSourcePack).not.toHaveBeenCalled(); expect({ session, records }).toEqual(unchanged);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'reading' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);
  expect((await prepareCorpusPractice({ ...base, previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes actual A2 updated statements and rejects cross-skill exposure or exhausted focused partners', async () => {
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const bank = actual.corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 160);
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson); vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 2925]); return array; });
  const base = { skill: 'reading' as const, locale: 'zh-Hans' as const, online: false, profileId: 'isolated-updated-statement', preferences: { reading: 'A2' as const, interests: [], step: 4, completed: true } };
  const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;expect(lesson.goalId).toBe('explicit-personal-update');
  const at = new Date(Date.now() - 1000).toISOString();
  const session: Session = { id: 'update-done', profileId: base.profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId: base.profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-update-test', assistance: { hintLevel: 0 }, submittedAt: at }));
  const before = structuredClone({ session, records });expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect({ session, records }).toEqual(before);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'listening' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);
  expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes ordinary A2 reported changes locally, preserves cross-skill/preview exclusions and stops focused exhaustion', async () => {
  const profileId = 'isolated-a2-heard-change';
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 8]); return array; });vi.mocked(loadSpokenCorpora).mockResolvedValue([]);
  const base = { skill: 'listening' as const, locale: 'zh-Hans' as const, online: true, profileId, preferences: { listening: 'A2' as const, interests: [], step: 4, completed: true }, history: [] as Session[], records: [] as Attempt[] };
  vi.mocked(installSourcePack).mockClear();const lesson = (await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('heard-reported-state-change');expect(installSourcePack).not.toHaveBeenCalled();
  const at = new Date(Date.now() - 1000).toISOString();const session: Session = { id: 'change-done', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-change-test', assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: at }));
  const unchanged = structuredClone({ session, records });vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect({ session, records }).toEqual(unchanged);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'reading' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes actual A2 stated reasons, excludes heard/previewed originals and stops exhausted focused application', async () => {
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');const bank = actual.corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 160);
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 3300]); return array; });
  const base = { skill: 'reading' as const, locale: 'zh-Hans' as const, online: false, profileId: 'isolated-stated-reason', preferences: { reading: 'A2' as const, interests: [], step: 4, completed: true } };const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;expect(lesson.goalId).toBe('explicit-stated-reason');
  const at = new Date(Date.now() - 1000).toISOString();const session: Session = { id: 'reason-done', profileId: base.profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId: base.profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-reason-test', assistance: { hintLevel: 0 }, submittedAt: at }));const original = structuredClone({ session, records });expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect({ session, records }).toEqual(original);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'listening' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes actual A2 stated rules, excludes heard/previewed originals and stops exhausted focused application', async () => {
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');const bank = actual.corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 160);
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 3675]); return array; });
  const base = { skill: 'reading' as const, locale: 'zh-Hans' as const, online: false, profileId: 'isolated-stated-rule', preferences: { reading: 'A2' as const, interests: [], step: 4, completed: true } };const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;expect(lesson.goalId).toBe('explicit-stated-rule');
  const at = new Date(Date.now() - 1000).toISOString();const session: Session = { id: 'rule-done', profileId: base.profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId: base.profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-rule-test', assistance: { hintLevel: 0 }, submittedAt: at }));const original = structuredClone({ session, records });expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect({ session, records }).toEqual(original);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'listening' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes actual A2 short integration, excludes heard/previewed originals and stops exhausted focused application', async () => {
  const actual = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');const bank = actual.corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 160);
  vi.mocked(corpusLesson).mockImplementation(actual.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 4050]); return array; });
  const base = { skill: 'reading' as const, locale: 'zh-Hans' as const, online: false, profileId: 'isolated-short-integration', preferences: { reading: 'A2' as const, interests: [], step: 4, completed: true } };const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;expect(lesson.goalId).toBe('short-two-clue-integration');
  const at = new Date(Date.now() - 1000).toISOString();const session: Session = { id: 'integration-done', profileId: base.profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId: base.profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-rule-test', assistance: { hintLevel: 0 }, submittedAt: at }));const original = structuredClone({ session, records });expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect({ session, records }).toEqual(original);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'listening' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes ordinary A2 heard reasons locally, preserves source/topic exclusions and refuses exhausted focused application', async () => {
  const profileId = 'isolated-a2-heard-reason';vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 9]); return array; });vi.mocked(loadSpokenCorpora).mockResolvedValue([]);
  const base = { skill: 'listening' as const, locale: 'zh-Hans' as const, online: true, profileId, preferences: { listening: 'A2' as const, interests: [], step: 4, completed: true }, history: [] as Session[], records: [] as Attempt[] };
  vi.mocked(installSourcePack).mockClear();const lesson = (await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('heard-stated-reason');expect(installSourcePack).not.toHaveBeenCalled();
  const at = new Date(Date.now() - 1000).toISOString();const session: Session = { id: 'heard-reason-done', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-heard-reason-test', assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: at }));const unchanged = structuredClone({ session, records });vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect({ session, records }).toEqual(unchanged);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'reading' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, topic: 'technology' })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes ordinary A2 heard rules locally, preserves source/topic exclusions and refuses exhausted focused application', async () => {
  const profileId = 'isolated-a2-heard-rule';vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 10]); return array; });vi.mocked(loadSpokenCorpora).mockResolvedValue([]);
  const base = { skill: 'listening' as const, locale: 'zh-Hans' as const, online: true, profileId, preferences: { listening: 'A2' as const, interests: [], step: 4, completed: true }, history: [] as Session[], records: [] as Attempt[] };
  vi.mocked(installSourcePack).mockClear();const lesson = (await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('heard-stated-rule');expect(installSourcePack).not.toHaveBeenCalled();
  const at = new Date(Date.now() - 1000).toISOString();const session: Session = { id: 'heard-rule-done', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-heard-rule-test', assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: at }));const unchanged = structuredClone({ session, records });vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect({ session, records }).toEqual(unchanged);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'reading' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, topic: 'technology' })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes ordinary A2 heard short integration locally, preserves source/topic exclusions and refuses exhausted focused application', async () => {
  const profileId = 'isolated-a2-heard-integration';vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array).set([0, 11]); return array; });vi.mocked(loadSpokenCorpora).mockResolvedValue([]);
  const base = { skill: 'listening' as const, locale: 'zh-Hans' as const, online: true, profileId, preferences: { listening: 'A2' as const, interests: [], step: 4, completed: true }, history: [] as Session[], records: [] as Attempt[] };
  vi.mocked(installSourcePack).mockClear();const lesson = (await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('heard-short-two-clue-integration');expect(installSourcePack).not.toHaveBeenCalled();
  const at = new Date(Date.now() - 1000).toISOString();const session: Session = { id: 'heard-integration-done', profileId, contentHash: 'isolated-test', assistance: { hintLevel: 0 }, leaseUntil: 0, lesson, status: 'completed', position: 1, startedAt: at };
  const records: Attempt[] = lesson.materials.map(m => ({ id: m.id, profileId, sessionId: session.id, questionId: m.questions[0].id, rootId: m.rootId, answer: 0, correct: false, rule: 'isolated-heard-integration-test', assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: at }));const unchanged = structuredClone({ session, records });vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect({ session, records }).toEqual(unchanged);
  expect((await prepareCorpusPractice({ ...base, history: [{ ...session, lesson: { ...lesson, skill: 'reading' }, status: 'active' }], records: [] })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({ ...base, topic: 'technology' })).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes B1 native-book main points through ordinary preparation and excludes exposed/previewed independent work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),{default:scopes}=await import('../content/corpus/b1-main-point-scopes.json');const manifest=JSON.parse(readFileSync('content/offline-resources.json','utf8')),groups:{id:string;files:{path:string}[]}[]=Array.isArray(manifest)?manifest:manifest.groups;let records:Corpus['records']=[];for(const f of groups.flatMap(g=>g.files).filter(f=>/^\/corpus\/open-reading(?:-[1-9]\d*)?\.json$/.test(f.path)))records.push(...core.corpusSchema.parse(JSON.parse(readFileSync('public'+f.path,'utf8'))).records);records=records.filter(r=>scopes.records.some(s=>s.rootId===r.rootId)).map(r=>({...r,passages:r.passages.filter(p=>scopes.records.some(s=>s.passageId===p.id))}));const bank={version:1 as const,failures:[],records:await(await import('../src/data/corpus')).reviewedReading(records,220)};vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,30]);return a;});const base={skill:'reading'as const,locale:'zh-Hans'as const,online:false,profileId:'isolated-b1-main-reading',preferences:{reading:'B1'as const,interests:[],step:4,completed:true}};const lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson.goalId).toBe('main-point-vs-detail');const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'main-reading-done',profileId:base.profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const answers:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId:base.profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-main-point',assistance:{hintLevel:0},submittedAt:at}));expect((await prepareCorpusPractice({...base,history:[session],records:answers})).lesson).toBeUndefined();expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'listening'}}],records:[]})).lesson?.goalId).not.toBe(lesson.goalId);
});
it('routes B1 heard main points locally with intact argument windows, four choices and strict source/topic exhaustion',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,6]);return a;});vi.mocked(loadSpokenCorpora).mockResolvedValue([]);const profileId='isolated-b1-main-listening',base={skill:'listening'as const,locale:'zh-Hans'as const,online:true,profileId,preferences:{listening:'B1'as const,interests:[],step:4,completed:true},history:[]as Session[],records:[]as Attempt[]};const lesson=(await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('main-point-vs-detail');expect(installSourcePack).not.toHaveBeenCalled();const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'main-heard-done',profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const records:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-main-point',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect((await prepareCorpusPractice({...base,previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,topic:'sport'})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'reading'}}]})).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes B1 native-book conditional mechanisms through ordinary preparation and excludes exposed/previewed independent work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),{default:scopes}=await import('../content/corpus/b1-condition-scopes.json');const manifest=JSON.parse(readFileSync('content/offline-resources.json','utf8')),groups:{id:string;files:{path:string}[]}[]=Array.isArray(manifest)?manifest:manifest.groups;let records:Corpus['records']=[];for(const f of groups.flatMap(g=>g.files).filter(f=>/^\/corpus\/open-reading(?:-[1-9]\d*)?\.json$/.test(f.path)))records.push(...core.corpusSchema.parse(JSON.parse(readFileSync('public'+f.path,'utf8'))).records);records=records.filter(r=>scopes.records.some(s=>s.rootId===r.rootId)).map(r=>({...r,passages:r.passages.filter(p=>scopes.records.some(s=>s.passageId===p.id))}));const bank={version:1 as const,failures:[],records:await(await import('../src/data/corpus')).reviewedReading(records,220)};vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,42]);return a;});const base={skill:'reading'as const,locale:'zh-Hans'as const,online:false,profileId:'isolated-b1-conditional-reading',preferences:{reading:'B1'as const,interests:[],step:4,completed:true}};const lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson.goalId).toBe('condition-outcome-limits');const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'conditional-reading-done',profileId:base.profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const answers:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId:base.profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-condition-outcome',assistance:{hintLevel:0},submittedAt:at}));expect((await prepareCorpusPractice({...base,history:[session],records:answers})).lesson).toBeUndefined();expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'listening'}}],records:[]})).lesson?.goalId).not.toBe(lesson.goalId);
});
it('routes B1 heard conditional meaning locally with intact narrated utterances, four choices and strict source/topic exhaustion',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,7]);return a;});vi.mocked(loadSpokenCorpora).mockResolvedValue([]);const profileId='isolated-b1-main-listening',base={skill:'listening'as const,locale:'zh-Hans'as const,online:true,profileId,preferences:{listening:'B1'as const,interests:[],step:4,completed:true},history:[]as Session[],records:[]as Attempt[]};const lesson=(await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('condition-outcome-limits');expect(installSourcePack).not.toHaveBeenCalled();const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'conditional-heard-done',profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const records:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-conditional',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect((await prepareCorpusPractice({...base,previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,topic:'sport'})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'reading'}}]})).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes B1 native-book context references through ordinary preparation and excludes exposed/previewed independent work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),{default:scopes}=await import('../content/corpus/b1-reference-scopes.json');const manifest=JSON.parse(readFileSync('content/offline-resources.json','utf8')),groups:{id:string;files:{path:string}[]}[]=Array.isArray(manifest)?manifest:manifest.groups;let records:Corpus['records']=[];for(const f of groups.flatMap(g=>g.files).filter(f=>/^\/corpus\/open-reading(?:-[1-9]\d*)?\.json$/.test(f.path)))records.push(...core.corpusSchema.parse(JSON.parse(readFileSync('public'+f.path,'utf8'))).records);records=records.filter(r=>scopes.records.some(s=>s.rootId===r.rootId)).map(r=>({...r,passages:r.passages.filter(p=>scopes.records.some(s=>s.passageId===p.id))}));const bank={version:1 as const,failures:[],records:await(await import('../src/data/corpus')).reviewedReading(records,220)};vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,54]);return a;});const base={skill:'reading'as const,locale:'zh-Hans'as const,online:false,profileId:'isolated-b1-reference-reading',preferences:{reading:'B1'as const,interests:[],step:4,completed:true}};const lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson.goalId).toBe('b1-context-reference');const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'reference-reading-done',profileId:base.profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const answers:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId:base.profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-condition-outcome',assistance:{hintLevel:0},submittedAt:at}));expect((await prepareCorpusPractice({...base,history:[session],records:answers})).lesson).toBeUndefined();expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'listening'}}],records:[]})).lesson?.goalId).not.toBe(lesson.goalId);
});
it('routes B1 heard resumed-list and inference references locally with intact narrated utterances, three choices and strict source/topic exhaustion',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,8]);return a;});vi.mocked(loadSpokenCorpora).mockResolvedValue([]);const profileId='isolated-b1-main-listening',base={skill:'listening'as const,locale:'zh-Hans'as const,online:true,profileId,preferences:{listening:'B1'as const,interests:[],step:4,completed:true},history:[]as Session[],records:[]as Attempt[]};const lesson=(await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('b1-context-reference');expect(installSourcePack).not.toHaveBeenCalled();const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'reference-heard-done',profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const records:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-reference',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect((await prepareCorpusPractice({...base,previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,topic:'sport'})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'reading'}}]})).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes B1 stated narrative motives through ordinary preparation and excludes exposed/previewed independent work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),{default:scopes}=await import('../content/corpus/b1-motive-scopes.json');const manifest=JSON.parse(readFileSync('content/offline-resources.json','utf8')),groups:{id:string;files:{path:string}[]}[]=Array.isArray(manifest)?manifest:manifest.groups;let records:Corpus['records']=[];for(const f of groups.flatMap(g=>g.files).filter(f=>/^\/corpus\/gutenberg(?:-[1-9]\d*)?\.json$/.test(f.path)))records.push(...core.corpusSchema.parse(JSON.parse(readFileSync('public'+f.path,'utf8'))).records);records=records.filter(r=>scopes.records.some(s=>s.rootId===r.rootId)).map(r=>({...r,passages:r.passages.filter(p=>scopes.records.some(s=>s.passageId===p.id))}));const bank={version:1 as const,failures:[],records:await(await import('../src/data/corpus')).reviewedReading(records,220)};vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,66]);return a;});const base={skill:'reading'as const,locale:'zh-Hans'as const,online:false,profileId:'isolated-b1-motive-reading',preferences:{reading:'B1'as const,interests:[],step:4,completed:true}};const lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson.goalId).toBe('stated-narrative-motive');const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'motive-reading-done',profileId:base.profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const answers:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId:base.profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-narrative-motive',assistance:{hintLevel:0},submittedAt:at}));expect((await prepareCorpusPractice({...base,history:[session],records:answers})).lesson).toBeUndefined();expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'listening'}}],records:[]})).lesson?.goalId).not.toBe(lesson.goalId);
});
it('routes B1 heard stated narrative reasons locally with intact narrated utterances, three choices and strict source/topic exhaustion',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,9]);return a;});vi.mocked(loadSpokenCorpora).mockResolvedValue([]);const profileId='isolated-b1-main-listening',base={skill:'listening'as const,locale:'zh-Hans'as const,online:true,profileId,preferences:{listening:'B1'as const,interests:[],step:4,completed:true},history:[]as Session[],records:[]as Attempt[]};const lesson=(await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('stated-narrative-motive');expect(installSourcePack).not.toHaveBeenCalled();const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'motive-heard-done',profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const records:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-motive',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect((await prepareCorpusPractice({...base,previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,topic:'sport'})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'reading'}}]})).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes B1 specific speaker intentions through ordinary preparation and excludes exposed/previewed independent work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),{default:scopes}=await import('../content/corpus/b1-intention-scopes.json');const manifest=JSON.parse(readFileSync('content/offline-resources.json','utf8')),groups:{id:string;files:{path:string}[]}[]=Array.isArray(manifest)?manifest:manifest.groups;let records:Corpus['records']=[];for(const f of groups.flatMap(g=>g.files).filter(f=>/^\/corpus\/(?:gutenberg|voa)(?:-[1-9]\d*)?\.json$/.test(f.path)))records.push(...core.corpusSchema.parse(JSON.parse(readFileSync('public'+f.path,'utf8'))).records);records=records.filter(r=>scopes.records.some(s=>s.rootId===r.rootId));const reviewed=await(await import('../src/data/corpus')).reviewedReading(records,220);const bank={version:1 as const,failures:[],records:reviewed.map(r=>({...r,passages:r.passages.filter(p=>scopes.records.some(s=>s.passageId===p.id))}))};vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,78]);return a;});const base={skill:'reading'as const,locale:'zh-Hans'as const,online:false,profileId:'isolated-b1-intention-reading',preferences:{reading:'B1'as const,interests:[],step:4,completed:true}};const lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson.goalId).toBe('specific-speaker-intention');const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'intention-reading-done',profileId:base.profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const answers:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId:base.profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-specific-intention',assistance:{hintLevel:0},submittedAt:at}));expect((await prepareCorpusPractice({...base,history:[session],records:answers})).lesson).toBeUndefined();expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'listening'}}],records:[]})).lesson?.goalId).not.toBe(lesson.goalId);
});
it('routes B1 heard concrete undertakings and suggestions locally with intact narrated utterances, three choices and strict source/topic exhaustion',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,10]);return a;});vi.mocked(loadSpokenCorpora).mockResolvedValue([]);const profileId='isolated-b1-main-listening',base={skill:'listening'as const,locale:'zh-Hans'as const,online:true,profileId,preferences:{listening:'B1'as const,interests:[],step:4,completed:true},history:[]as Session[],records:[]as Attempt[]};const lesson=(await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('specific-speaker-intention');expect(installSourcePack).not.toHaveBeenCalled();const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'intention-heard-done',profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const records:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-intention',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect((await prepareCorpusPractice({...base,previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,topic:'sport'})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'reading'}}]})).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes B1 integrated action plans from unchanged local-import source works through ordinary preparation and excludes exposed/previewed independent work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),{default:scopes}=await import('../content/corpus/b1-procedure-scopes.json');const{unzipSync,strFromU8}=await import('fflate');let records:Corpus['records']=['public/source-packs/reading-history-67e4adbf524b.zip','public/source-packs/reading-society-06aa22b571e4.zip'].flatMap(path=>core.corpusSchema.parse(JSON.parse(strFromU8(unzipSync(readFileSync(path))['corpus.json']))).records);records=records.filter(r=>scopes.records.some(s=>s.rootId===r.rootId));const reviewed=await(await import('../src/data/corpus')).reviewedReading(records,220);const bank={version:1 as const,failures:[],records:reviewed.map(r=>({...r,passages:r.passages.filter(p=>scopes.records.some(s=>s.passageId===p.id))}))};vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,90]);return a;});const base={skill:'reading'as const,locale:'zh-Hans'as const,online:false,profileId:'isolated-b1-plan-reading',preferences:{reading:'B1'as const,interests:[],step:4,completed:true}};const lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson.goalId).toBe('integrated-procedural-plan');const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'plan-reading-done',profileId:base.profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const answers:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId:base.profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-procedural-plan',assistance:{hintLevel:0},submittedAt:at}));expect((await prepareCorpusPractice({...base,history:[session],records:answers})).lesson).toBeUndefined();expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'listening'}}],records:[]})).lesson?.goalId).not.toBe(lesson.goalId);
});

it('routes B1 heard multi-step plans with repetition, completion conditions and concurrent activity locally with intact narrated utterances, three choices and strict source/topic exhaustion',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,11]);return a;});vi.mocked(loadSpokenCorpora).mockResolvedValue([]);const profileId='isolated-b1-main-listening',base={skill:'listening'as const,locale:'zh-Hans'as const,online:true,profileId,preferences:{listening:'B1'as const,interests:[],step:4,completed:true},history:[]as Session[],records:[]as Attempt[]};const lesson=(await prepareCorpusPractice(base)).lesson!;expect(lesson.goalId).toBe('integrated-procedural-plan');expect(installSourcePack).not.toHaveBeenCalled();const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'procedure-heard-done',profileId,contentHash:'isolated-fixture',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},leaseUntil:0,lesson,status:'completed',position:1,startedAt:at};const records:Attempt[]=lesson.materials.map(m=>({id:m.id,profileId,sessionId:session.id,questionId:m.questions[0].id,rootId:m.rootId,answer:0,correct:false,rule:'isolated-intention',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));vi.mocked(installSourcePack).mockClear();expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();expect(installSourcePack).not.toHaveBeenCalled();expect((await prepareCorpusPractice({...base,previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,topic:'sport'})).lesson?.goalId).not.toBe(lesson.goalId);expect((await prepareCorpusPractice({...base,history:[{...session,status:'active',lesson:{...lesson,skill:'reading'}}]})).lesson?.goalId).not.toBe(lesson.goalId);
});


it('excludes seen original roots across skills for new B2 claim/example practice, without substituting an unrelated target on exhaustion', async () => {
  const { corpusLesson: readingFactory, corpusSchema } = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const { spokenCorpusLesson: heardFactory } = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const { reviewedReading } = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { claimExampleOperation } = await import('../src/core/corpusClaimExamples');
  const scopes = (await import('../content/corpus/b2-claim-example-scopes.json')).default;
  const readingBank = { version: 1 as const, failures: [], records: await reviewedReading(corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional-2.json', 'utf8'))).records.filter(r => scopes.records.some(s => s.rootId === r.rootId)), 300) };
  const banks = await Promise.all(['history', 'seo'].map(async name => (await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/long-reference-${name}.zip`)))).spoken!));
  const reading = readingFactory(readingBank, new Set(), 0, 300, 'B2', [], 'matching', [], claimExampleOperation)!;
  const heard = heardFactory(banks[0], new Set(), 0, 196, 'B2', [], 'matching', [], claimExampleOperation, [banks[1]])!;
  vi.spyOn(crypto, 'getRandomValues').mockReturnValue(new Uint32Array([0, 0]));
  for (const lesson of [reading, heard]) {
    const skill = lesson.skill as 'reading' | 'listening', profileId = `claim-root-${skill}`;
    // Isolated routing history only; browser acceptance must complete actual ordinary prerequisites.
    const prior: Session = { id: 'seen-other-clip', profileId, lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] }, contentHash: 'a'.repeat(64), position: 0, status: 'active', startedAt: new Date(Date.now() - 1000).toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 };
    vi.mocked(loadReadingCorpus).mockResolvedValue(readingBank); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.mocked(corpusLesson).mockReset(); vi.mocked(spokenCorpusLesson).mockReset();
    const factory = skill === 'reading' ? vi.mocked(corpusLesson) : vi.mocked(spokenCorpusLesson);
    factory.mockReturnValueOnce(lesson);
    const result = await prepareCorpusPractice({ locale: 'zh-Hans', profileId, preferences: { reading: 'B2', listening: 'B2', interests: [], step: 4, completed: true }, history: [prior], records: [], online: false, skill });
    expect(result.lesson).toBeUndefined(); expect(factory.mock.calls.length).toBeGreaterThanOrEqual(2);
    const retry = factory.mock.calls[1]; expect(retry[0].records.some(r => r.rootId === lesson.materials[0].rootId)).toBe(false);
    expect(retry[6]).toBe('matching'); expect(retry[8]).toBe(claimExampleOperation);
    if (skill === 'listening') expect(vi.mocked(spokenCorpusLesson).mock.calls[1][9]!.every(b => b.records.every(r => r.rootId !== lesson.materials[0].rootId))).toBe(true);
  }
});

it('reaches B2 content comparisons through ordinary reading/listening preparation and stops on focused exhaustion or exposed original work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),heard=await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus'),data=await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus'),{inspectCommunityPack}=await import('../src/data/communityPack'),{default:scopes}=await import('../content/corpus/b2-comparison-scopes.json'),{comparisonOperation}=await import('../src/core/corpusComparison');
 const originals=['additional-2','additional-3'].flatMap(name=>core.corpusSchema.parse(JSON.parse(readFileSync(`public/corpus/${name}.json`,'utf8'))).records).filter(r=>scopes.reading.some(s=>s.rootId===r.rootId)),bank={version:1 as const,failures:[],records:(await data.reviewedReading(originals,300)).map(r=>({...r,passages:r.passages.filter(p=>scopes.reading.some(s=>s.passageId===p.id))}))};
 const banks=await Promise.all(['3001ad98a847','46f2fd165c2d'].map(async name=>{const p=await inspectCommunityPack(new Uint8Array(readFileSync(`public/source-packs/listening-literature-${name}.zip`)));return{...p.spoken!,records:p.spoken!.records.map(r=>({...r,clips:r.clips.filter(c=>scopes.listening.some(s=>s.clipId===c.id))})).filter(r=>r.clips.length)};}));
 for(const[skill,seed]of[['reading',42],['listening',2]]as const){
  vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,seed]);return a;});
  const profileId=`comparison-${skill}-ordinary-route`,base={profileId,locale:'zh-Hans'as const,skill,online:false,preferences:{reading:'B2'as const,listening:'B2'as const,interests:[],step:4,completed:true}},lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson?.goalId).toBe('contextual-comparison');expect(lesson.materials.every(m=>corpusOperation(m.questions[0])===comparisonOperation)).toBe(true);
  const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'comparison-retry',profileId,lesson,status:'completed',position:1,startedAt:at,contentHash:'isolated-route-history',assistance:{hintLevel:0},leaseUntil:0},records:Attempt[]=lesson.materials.map(m=>{const q=m.questions[0];if('kind'in q)throw Error('Expected choice');return{id:m.id,profileId,sessionId:session.id,questionId:q.id,rootId:m.rootId,answer:(q.answer+1)%q.options.length,correct:false,rule:'isolated-comparison-route-only',assistance:{hintLevel:0,...(skill==='listening'?{audioCompleted:true,playbackRequests:1}:{})},submittedAt:at};});
  expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();
  const exposure:Session={...session,id:'comparison-other-skill-exposure',status:'active',lesson:{...lesson,skill:skill==='reading'?'listening':'reading',materials:[{...lesson.materials[0],id:'corpus-'+'f'.repeat(64)}]}};
  expect((await prepareCorpusPractice({...base,history:[exposure],records:[]})).lesson?.goalId).not.toBe('contextual-comparison');expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe('contextual-comparison');expect(installSourcePack).not.toHaveBeenCalled();vi.restoreAllMocks();
 }
});

it('reaches B2 content qualified-concessions through ordinary reading/listening preparation and stops on focused exhaustion or exposed original work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),heard=await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus'),data=await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus'),{inspectCommunityPack}=await import('../src/data/communityPack'),{default:scopes}=await import('../content/corpus/b2-qualified-concession-scopes.json'),{qualifiedConcessionOperation}=await import('../src/core/corpusQualifiedConcession');
 const originals=['additional'].flatMap(name=>core.corpusSchema.parse(JSON.parse(readFileSync(`public/corpus/${name}.json`,'utf8'))).records).filter(r=>scopes.reading.some(s=>s.rootId===r.rootId)),bank={version:1 as const,failures:[],records:(await data.reviewedReading(originals,300)).map(r=>({...r,passages:r.passages.filter(p=>scopes.reading.some(s=>s.passageId===p.id))}))};
 const banks=await Promise.all(['film-8405478b469c','food-fa11203d2148'].map(async name=>{const p=await inspectCommunityPack(new Uint8Array(readFileSync(`public/source-packs/listening-${name}.zip`)));return{...p.spoken!,records:p.spoken!.records.map(r=>({...r,clips:r.clips.filter(c=>scopes.listening.some(s=>s.clipId===c.id))})).filter(r=>r.clips.length)};}));
 for(const[skill,seed]of[['reading',42],['listening',2]]as const){
  vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,seed]);return a;});
  const profileId=`qualified-concession-${skill}-ordinary-route`,base={profileId,locale:'zh-Hans'as const,skill,online:false,preferences:{reading:'B2'as const,listening:'B2'as const,interests:[],step:4,completed:true}},lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson?.goalId).toBe('qualified-concession-meaning');expect(lesson.materials.every(m=>corpusOperation(m.questions[0])===qualifiedConcessionOperation)).toBe(true);
  const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'qualified-concession-retry',profileId,lesson,status:'completed',position:1,startedAt:at,contentHash:'isolated-route-history',assistance:{hintLevel:0},leaseUntil:0},records:Attempt[]=lesson.materials.map(m=>{const q=m.questions[0];if('kind'in q)throw Error('Expected choice');return{id:m.id,profileId,sessionId:session.id,questionId:q.id,rootId:m.rootId,answer:(q.answer+1)%q.options.length,correct:false,rule:'isolated-qualified-concession-route-only',assistance:{hintLevel:0,...(skill==='listening'?{audioCompleted:true,playbackRequests:1}:{})},submittedAt:at};});
  expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();
  const exposure:Session={...session,id:'qualified-concession-other-skill-exposure',status:'active',lesson:{...lesson,skill:skill==='reading'?'listening':'reading',materials:[{...lesson.materials[0],id:'corpus-'+'f'.repeat(64)}]}};
  expect((await prepareCorpusPractice({...base,history:[exposure],records:[]})).lesson?.goalId).not.toBe('qualified-concession-meaning');expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe('qualified-concession-meaning');expect(installSourcePack).not.toHaveBeenCalled();vi.restoreAllMocks();
 }
});

it('reaches B2 content speaker-attitudes through ordinary reading/listening preparation and stops on focused exhaustion or exposed original work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),heard=await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus'),data=await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus'),{inspectCommunityPack}=await import('../src/data/communityPack'),{default:scopes}=await import('../content/corpus/b2-speaker-attitude-scopes.json'),{speakerAttitudeOperation}=await import('../src/core/corpusSpeakerAttitude');
 const originals=['gutenberg'].flatMap(name=>core.corpusSchema.parse(JSON.parse(readFileSync(`public/corpus/${name}.json`,'utf8'))).records).filter(r=>scopes.reading.some(s=>s.rootId===r.rootId)),bank={version:1 as const,failures:[],records:(await data.reviewedReading(originals,300)).map(r=>({...r,passages:r.passages.filter(p=>scopes.reading.some(s=>s.passageId===p.id))}))};
 const banks=await Promise.all(['film-c775bba280f5','history-286f50ab0076'].map(async name=>{const p=await inspectCommunityPack(new Uint8Array(readFileSync(`public/source-packs/listening-${name}.zip`)));return{...p.spoken!,records:p.spoken!.records.map(r=>({...r,clips:r.clips.filter(c=>scopes.listening.some(s=>s.clipId===c.id))})).filter(r=>r.clips.length)};}));
 for(const[skill,seed]of[['reading',42],['listening',1]]as const){
  vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,seed]);return a;});
  const profileId=`speaker-attitude-${skill}-ordinary-route`,base={profileId,locale:'zh-Hans'as const,skill,online:false,preferences:{reading:'B2'as const,listening:'B2'as const,interests:[],step:4,completed:true}},lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson?.goalId).toBe('speaker-attitude-in-context');expect(lesson.materials.every(m=>corpusOperation(m.questions[0])===speakerAttitudeOperation)).toBe(true);
  const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'speaker-attitude-retry',profileId,lesson,status:'completed',position:1,startedAt:at,contentHash:'isolated-route-history',assistance:{hintLevel:0},leaseUntil:0},records:Attempt[]=lesson.materials.map(m=>{const q=m.questions[0];if('kind'in q)throw Error('Expected choice');return{id:m.id,profileId,sessionId:session.id,questionId:q.id,rootId:m.rootId,answer:(q.answer+1)%q.options.length,correct:false,rule:'isolated-speaker-attitude-route-only',assistance:{hintLevel:0,...(skill==='listening'?{audioCompleted:true,playbackRequests:1}:{})},submittedAt:at};});
  expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();
  const exposure:Session={...session,id:'speaker-attitude-other-skill-exposure',status:'active',lesson:{...lesson,skill:skill==='reading'?'listening':'reading',materials:[{...lesson.materials[0],id:'corpus-'+'f'.repeat(64)}]}};
  expect((await prepareCorpusPractice({...base,history:[exposure],records:[]})).lesson?.goalId).not.toBe('speaker-attitude-in-context');expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe('speaker-attitude-in-context');expect(installSourcePack).not.toHaveBeenCalled();vi.restoreAllMocks();
 }
});

it('reaches B2 content information synthesis through ordinary reading/listening preparation and stops on focused exhaustion or exposed original work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),heard=await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus'),data=await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus'),{inspectCommunityPack}=await import('../src/data/communityPack'),{default:scopes}=await import('../content/corpus/b2-information-synthesis-scopes.json'),{informationSynthesisOperation}=await import('../src/core/corpusInformationSynthesis');
 const originals=['additional-2'].flatMap(name=>core.corpusSchema.parse(JSON.parse(readFileSync(`public/corpus/${name}.json`,'utf8'))).records).filter(r=>scopes.reading.some(s=>s.rootId===r.rootId)),bank={version:1 as const,failures:[],records:(await data.reviewedReading(originals,300)).map(r=>({...r,passages:r.passages.filter(p=>scopes.reading.some(s=>s.passageId===p.id))}))};
 const banks=await Promise.all(['environment-8f04d34c9dd6','nature-7632fc9e8a15'].map(async name=>{const p=await inspectCommunityPack(new Uint8Array(readFileSync(`public/source-packs/listening-${name}.zip`)));return{...p.spoken!,records:p.spoken!.records.map(r=>({...r,clips:r.clips.filter(c=>scopes.listening.some(s=>s.clipId===c.id))})).filter(r=>r.clips.length)};}));
 for(const[skill,seed]of[['reading',42],['listening',1]]as const){
  vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,seed]);return a;});
  const profileId=`information-synthesis-${skill}-ordinary-route`,base={profileId,locale:'zh-Hans'as const,skill,online:false,preferences:{reading:'B2'as const,listening:'B2'as const,interests:[],step:4,completed:true}},lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson?.goalId).toBe('integrated-source-information');expect(lesson.materials.every(m=>corpusOperation(m.questions[0])===informationSynthesisOperation)).toBe(true);
  const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'information-synthesis-retry',profileId,lesson,status:'completed',position:1,startedAt:at,contentHash:'isolated-route-history',assistance:{hintLevel:0},leaseUntil:0},records:Attempt[]=lesson.materials.map(m=>{const q=m.questions[0];if('kind'in q)throw Error('Expected choice');return{id:m.id,profileId,sessionId:session.id,questionId:q.id,rootId:m.rootId,answer:(q.answer+1)%q.options.length,correct:false,rule:'isolated-information-synthesis-route-only',assistance:{hintLevel:0,...(skill==='listening'?{audioCompleted:true,playbackRequests:1}:{})},submittedAt:at};});
  expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();
  const exposure:Session={...session,id:'information-synthesis-other-skill-exposure',status:'active',lesson:{...lesson,skill:skill==='reading'?'listening':'reading',materials:[{...lesson.materials[0],id:'corpus-'+'f'.repeat(64)}]}};
  expect((await prepareCorpusPractice({...base,history:[exposure],records:[]})).lesson?.goalId).not.toBe('integrated-source-information');expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe('integrated-source-information');expect(installSourcePack).not.toHaveBeenCalled();vi.restoreAllMocks();
 }
});

it('reaches B2 content view attribution through ordinary reading/listening preparation and stops on focused exhaustion or exposed original work',async()=>{
 const core=await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus'),heard=await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus'),data=await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus'),{inspectCommunityPack}=await import('../src/data/communityPack'),{default:scopes}=await import('../content/corpus/b2-view-attribution-scopes.json'),{viewAttributionOperation}=await import('../src/core/corpusViewAttribution');
 const originals=['additional','additional-3'].flatMap(name=>core.corpusSchema.parse(JSON.parse(readFileSync(`public/corpus/${name}.json`,'utf8'))).records).filter(r=>scopes.reading.some(s=>s.rootId===r.rootId)),bank={version:1 as const,failures:[],records:(await data.reviewedReading(originals,300)).map(r=>({...r,passages:r.passages.filter(p=>scopes.reading.some(s=>s.passageId===p.id))}))};
 const banks=await Promise.all(['film-c7bcc554baf5','literature-f2d368bd45bc'].map(async name=>{const p=await inspectCommunityPack(new Uint8Array(readFileSync(`public/source-packs/listening-${name}.zip`)));return{...p.spoken!,records:p.spoken!.records.map(r=>({...r,clips:r.clips.filter(c=>scopes.listening.some(s=>s.clipId===c.id))})).filter(r=>r.clips.length)};}));
 for(const[skill,seed]of[['reading',42],['listening',2]]as const){
  vi.mocked(corpusLesson).mockImplementation(core.corpusLesson);vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);vi.mocked(loadReadingCorpus).mockResolvedValue(bank);vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);vi.spyOn(crypto,'getRandomValues').mockImplementation(a=>{(a as Uint32Array).set([0,seed]);return a;});
  const profileId=`view-attribution-${skill}-ordinary-route`,base={profileId,locale:'zh-Hans'as const,skill,online:false,preferences:{reading:'B2'as const,listening:'B2'as const,interests:[],step:4,completed:true}},lesson=(await prepareCorpusPractice({...base,history:[],records:[]})).lesson!;expect(lesson?.goalId).toBe('attributed-views-in-context');expect(lesson.materials.every(m=>corpusOperation(m.questions[0])===viewAttributionOperation)).toBe(true);
  const at=new Date(Date.now()-1000).toISOString(),session:Session={id:'view-attribution-retry',profileId,lesson,status:'completed',position:1,startedAt:at,contentHash:'isolated-route-history',assistance:{hintLevel:0},leaseUntil:0},records:Attempt[]=lesson.materials.map(m=>{const q=m.questions[0];if('kind'in q)throw Error('Expected choice');return{id:m.id,profileId,sessionId:session.id,questionId:q.id,rootId:m.rootId,answer:(q.answer+1)%q.options.length,correct:false,rule:'isolated-view-attribution-route-only',assistance:{hintLevel:0,...(skill==='listening'?{audioCompleted:true,playbackRequests:1}:{})},submittedAt:at};});
  expect((await prepareCorpusPractice({...base,history:[session],records})).lesson).toBeUndefined();
  const exposure:Session={...session,id:'view-attribution-other-skill-exposure',status:'active',lesson:{...lesson,skill:skill==='reading'?'listening':'reading',materials:[{...lesson.materials[0],id:'corpus-'+'f'.repeat(64)}]}};
  expect((await prepareCorpusPractice({...base,history:[exposure],records:[]})).lesson?.goalId).not.toBe('attributed-views-in-context');expect((await prepareCorpusPractice({...base,history:[],records:[],previewRoots:new Set([lesson.materials[0].rootId])})).lesson?.goalId).not.toBe('attributed-views-in-context');expect(installSourcePack).not.toHaveBeenCalled();vi.restoreAllMocks();
 }
});

it('reaches C1 implicit intention through ordinary preparation using the full native exchanges and excludes exposed roots and exhausted focused retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c1-implicit-reading-contexts.zip')));
  const bank = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 900) };
  vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(loadReadingCorpus).mockResolvedValue(bank);
  // This installed pair excludes newer operations; retain its original ordinary seed rather than the full-menu phase.
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, 78]); return a; });
  const profileId = 'implicit-ordinary-route', base = { profileId, locale: 'zh-Hans' as const, skill: 'reading' as const, online: false, preferences: { reading: 'C1' as const, listening: 'C1' as const, interests: [], step: 4, completed: true } };
  const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
  expect(lesson?.goalId).toBe('implicit-intention-in-context'); expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:implicit-intention')).toBe(true);
  expect(lesson.materials.every(m => m.blocks[0].text.split(/\s+/).length > 700)).toBe(true);
  const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: 'implicit-retry', profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-route-history', assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-implicit-route-only', assistance: { hintLevel: 0 }, submittedAt: at }; });
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
  const exposed: Session = { ...session, id: 'implicit-listening-exposure', status: 'active', lesson: { ...lesson, skill: 'listening', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
  expect((await prepareCorpusPractice({ ...base, history: [exposed], records: [] })).lesson?.goalId).not.toBe('implicit-intention-in-context');
  expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('implicit-intention-in-context');
  expect(installSourcePack).not.toHaveBeenCalled();
});

it('reaches C1 implicit-purpose listening from its actual installed pair at cold-start bounds and excludes previews, prior contact and exhausted retries', async () => {
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus'); const { inspectCommunityPack } = await import('../src/data/communityPack');
  const banks = await Promise.all(['115022507', '159833654'].map(async id => { const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c1-implicit-${id}.zip`))); return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) }; }));
  vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks); vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, 0]); return a; });
  const profileId = 'heard-implicit-ordinary', base = { profileId, locale: 'zh-Hans' as const, skill: 'listening' as const, online: false, preferences: { reading: 'C1' as const, listening: 'C1' as const, interests: [], step: 4, completed: true } };
  const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!; expect(lesson?.goalId).toBe('implicit-intention-in-context'); expect(spokenCorpusLesson).toHaveBeenCalledWith(expect.anything(), expect.anything(), 0, 196, 'C1', expect.anything(), undefined, expect.anything(), undefined, expect.anything());
  const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: 'heard-implicit-retry', profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-heard-history', assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-heard-implicit-route-only', assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: at }; });
  expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
  const exposed: Session = { ...session, id: 'heard-implicit-reading-contact', status: 'active', lesson: { ...lesson, skill: 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
  expect((await prepareCorpusPractice({ ...base, history: [exposed], records: [] })).lesson?.goalId).not.toBe('implicit-intention-in-context'); expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('implicit-intention-in-context'); expect(installSourcePack).not.toHaveBeenCalled();
});

it('reaches C1 density from each actual installed source pair and excludes exposed originals and exhausted same-goal retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c1-density-reading-contexts.zip')));
  const reading = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 900) };
  const banks = await Promise.all(['114180837', '82513489'].map(async id => {
    const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c1-density-${id}.zip`)));
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) };
  }));
  for (const [skill, seed] of [['reading', 78], ['listening', 0]] as const) {
    vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);
    vi.mocked(loadReadingCorpus).mockResolvedValue(reading); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, seed]); return a; });
    const profileId = `density-ordinary-${skill}`, base = { profileId, locale: 'zh-Hans' as const, skill, online: false, preferences: { reading: 'C1' as const, listening: 'C1' as const, interests: [], step: 4, completed: true } };
    const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
    expect(lesson?.goalId).toBe('information-density-in-context');
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:information-density')).toBe(true);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-density-route', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-density-route-only', assistance: { hintLevel: 0, ...(skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
    const exposure: Session = { ...session, id: 'density-other-skill-exposure', status: 'active', lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
    expect((await prepareCorpusPractice({ ...base, history: [exposure], records: [] })).lesson?.goalId).not.toBe('information-density-in-context');
    expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('information-density-in-context');
    expect(installSourcePack).not.toHaveBeenCalled(); vi.restoreAllMocks();
  }
});

it('reaches C2 nuanced meaning from each actual installed source pair and excludes exposed originals and exhausted same-goal retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c2-nuance-reading-contexts.zip')));
  const reading = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 1200) };
  const banks = await Promise.all(['140128449', '80901052'].map(async id => {
    const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c2-nuance-${id}.zip`)));
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) };
  }));
  for (const [skill, seed] of [['reading', 78], ['listening', 0]] as const) {
    vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);
    vi.mocked(loadReadingCorpus).mockResolvedValue(reading); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, seed]); return a; });
    const profileId = `nuance-ordinary-${skill}`, base = { profileId, locale: 'zh-Hans' as const, skill, online: false, preferences: { reading: 'C2' as const, listening: 'C2' as const, interests: [], step: 4, completed: true } };
    const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
    expect(lesson?.goalId).toBe('nuanced-meaning-in-context');
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:nuanced-meaning')).toBe(true);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-nuance-route', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-nuance-route-only', assistance: { hintLevel: 0, ...(skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
    const exposure: Session = { ...session, id: 'nuance-other-skill-exposure', status: 'active', lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
    expect((await prepareCorpusPractice({ ...base, history: [exposure], records: [] })).lesson?.goalId).not.toBe('nuanced-meaning-in-context');
    expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('nuanced-meaning-in-context');
    expect(installSourcePack).not.toHaveBeenCalled(); vi.restoreAllMocks();
  }
});

it('reaches C2 rhetorical function from each actual installed source pair and excludes exposed originals and exhausted same-goal retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c2-rhetoric-reading-contexts.zip')));
  const reading = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 1200) };
  const banks = await Promise.all(['kennedy-inaugural', 'eisenhower-farewell'].map(async id => {
    const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c2-rhetoric-${id}.zip`)));
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) };
  }));
  for (const [skill, seed] of [['reading', 78], ['listening', 0]] as const) {
    vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);
    vi.mocked(loadReadingCorpus).mockResolvedValue(reading); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, seed]); return a; });
    const profileId = `rhetoric-ordinary-${skill}`, base = { profileId, locale: 'zh-Hans' as const, skill, online: false, preferences: { reading: 'C2' as const, listening: 'C2' as const, interests: [], step: 4, completed: true } };
    const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
    expect(lesson?.goalId).toBe('rhetorical-function-in-context');
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:rhetorical-function')).toBe(true);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-rhetoric-route', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-rhetoric-route-only', assistance: { hintLevel: 0, ...(skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
    const exposure: Session = { ...session, id: 'rhetoric-other-skill-exposure', status: 'active', lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
    expect((await prepareCorpusPractice({ ...base, history: [exposure], records: [] })).lesson?.goalId).not.toBe('rhetorical-function-in-context');
    expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('rhetorical-function-in-context');
    if (skill === 'listening') for (const material of lesson.materials) {
      const legacy = material.rootId.startsWith('jfk-') ? 'kennedy-inaugural' : 'eisenhower-farewell';
      const prior = { ...session, id: 'rhetoric-legacy-exposure', lesson: { ...lesson, materials: [{ ...material, rootId: legacy, sourceId: legacy }] } };
      const before = structuredClone(prior);
      expect((await prepareCorpusPractice({ ...base, history: [prior], records: [] })).lesson?.goalId).not.toBe('rhetorical-function-in-context');
      expect(prior).toEqual(before);
    }
    expect(installSourcePack).not.toHaveBeenCalled(); vi.restoreAllMocks();
  }
});

it('reaches C2 layered positions from each actual installed source pair and excludes exposed originals and exhausted same-goal retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c2-layered-reading-contexts.zip')));
  const reading = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 1200) };
  const banks = await Promise.all(['135291761', '17450584'].map(async id => {
    const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c2-layered-${id}.zip`)));
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) };
  }));
  for (const [skill, seed] of [['reading', 78], ['listening', 0]] as const) {
    vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);
    vi.mocked(loadReadingCorpus).mockResolvedValue(reading); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, seed]); return a; });
    const profileId = `layered-ordinary-${skill}`, base = { profileId, locale: 'zh-Hans' as const, skill, online: false, preferences: { reading: 'C2' as const, listening: 'C2' as const, interests: [], step: 4, completed: true } };
    const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
    expect(lesson?.goalId).toBe('layered-positions');
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:layered-position')).toBe(true);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-layered-route', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-layered-route-only', assistance: { hintLevel: 0, ...(skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
    const exposure: Session = { ...session, id: 'layered-other-skill-exposure', status: 'active', lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
    expect((await prepareCorpusPractice({ ...base, history: [exposure], records: [] })).lesson?.goalId).not.toBe('layered-positions');
    expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('layered-positions');
    expect(installSourcePack).not.toHaveBeenCalled(); vi.restoreAllMocks();
  }
});

it('reaches C2 complex pragmatics from each actual installed source pair and excludes exposed originals and exhausted same-goal retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c2-pragmatics-reading-contexts.zip')));
  const reading = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 1200) };
  const banks = await Promise.all(['5308', '2776'].map(async id => {
    const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c2-pragmatics-${id}.zip`)));
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) };
  }));
  for (const [skill, seed] of [['reading', 78], ['listening', 0]] as const) {
    vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);
    vi.mocked(loadReadingCorpus).mockResolvedValue(reading); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, seed]); return a; });
    const profileId = `pragmatics-ordinary-${skill}`, base = { profileId, locale: 'zh-Hans' as const, skill, online: false, preferences: { reading: 'C2' as const, listening: 'C2' as const, interests: [], step: 4, completed: true } };
    const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
    expect(lesson?.goalId).toBe('complex-pragmatics');
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:complex-pragmatics')).toBe(true);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-pragmatics-route', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-pragmatics-route-only', assistance: { hintLevel: 0, ...(skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
    const exposure: Session = { ...session, id: 'pragmatics-other-skill-exposure', status: 'active', lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
    expect((await prepareCorpusPractice({ ...base, history: [exposure], records: [] })).lesson?.goalId).not.toBe('complex-pragmatics');
    expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('complex-pragmatics');
    expect(installSourcePack).not.toHaveBeenCalled(); vi.restoreAllMocks();
  }
});

it('keeps faithful paraphrase within the existing ordinary support condition, excludes exposed originals and fails exhausted retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c2-paraphrase-reading-contexts.zip')));
  const reading = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 1800) };
  const banks = await Promise.all(['17880244', '61774362'].map(async id => {
    const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c2-paraphrase-${id}.zip`)));
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) };
  }));
  for (const [skill, seed] of [['reading', 78], ['listening', 0]] as const) {
    vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);
    vi.mocked(loadReadingCorpus).mockResolvedValue(reading); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, seed]); return a; });
    const profileId = `paraphrase-route-${skill}`, base = { profileId, locale: 'zh-Hans' as const, skill, online: false, preferences: { reading: 'C2' as const, listening: 'C2' as const, interests: [], step: 4, completed: true } };
    const at = Date.now() - 10000, history: Session[] = [], records: Attempt[] = [];
    if (skill === 'reading') {
      expect((await prepareCorpusPractice({ ...base, history, records })).lesson?.goalId).not.toBe('faithful-paraphrase');
      const snapshot = core.corpusLesson(reading, new Set(), 0, 1800, 'C2', [], 'choice', [], 'choice:faithful-paraphrase')!;
      // Isolated synthetic history tests the existing support threshold; browser acceptance earns it through actual Today sessions.
      for (let n = 0; n < 2; n++) {
        const lesson = structuredClone(snapshot); lesson.goalId = 'source-wording-and-summary';
        for (const [i, m] of lesson.materials.entries()) {
          m.id = `corpus-${String(n * 2 + i + 1).padStart(64, '0')}`; m.rootId = `isolated-support-${n}-${i}`;
          for (const b of m.blocks) b.id = m.id;
          for (const q of m.questions) { q.id = `${m.id}-para`; q.blockId = m.id; for (const e of q.additionalEvidence ?? []) e.blockId = m.id; }
        }
        const startedAt = new Date(at + n * 1000).toISOString();
        const session: Session = { id: `isolated-support-${n}`, profileId, lesson, status: 'completed', position: 1, startedAt, contentHash: 'isolated-support-only', assistance: { hintLevel: 0 }, leaseUntil: 0 };
        history.push(session);
        records.push(...lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: q.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: q.answer, correct: true, rule: 'isolated-support-only', assistance: { hintLevel: 0 }, submittedAt: startedAt }; }));
      }
    }
    const lesson = (await prepareCorpusPractice({ ...base, history, records })).lesson!;
    expect(lesson?.goalId).toBe('faithful-paraphrase');
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:faithful-paraphrase')).toBe(true);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    const startedAt = new Date(at + 4000).toISOString(), session: Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt, contentHash: 'isolated-paraphrase-route', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const failed: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-paraphrase-route-only', assistance: { hintLevel: 0, ...(skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: startedAt }; });
    expect((await prepareCorpusPractice({ ...base, history: [...history, session], records: [...records, ...failed] })).lesson).toBeUndefined();
    const exposure: Session = { ...session, id: 'paraphrase-other-skill-exposure', status: 'active', lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
    expect((await prepareCorpusPractice({ ...base, history: [...history, exposure], records })).lesson?.goalId).not.toBe('faithful-paraphrase');
    expect((await prepareCorpusPractice({ ...base, history, records, previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('faithful-paraphrase');
    expect(installSourcePack).not.toHaveBeenCalled(); vi.restoreAllMocks();
  }
});


it('reaches C2 disagreement-preserving synthesis from each actual installed source pair and excludes exposed originals and exhausted same-goal retries', async () => {
  const core = await vi.importActual<typeof import('../src/core/corpus')>('../src/core/corpus');
  const heard = await vi.importActual<typeof import('../src/core/spokenCorpus')>('../src/core/spokenCorpus');
  const data = await vi.importActual<typeof import('../src/data/corpus')>('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const raw = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/c2-synthesis-reading-contexts.zip')));
  const reading = { ...raw.corpus!, records: await data.reviewedReading(raw.corpus!.records, 1200) };
  const banks = await Promise.all(['74092955', '50803327'].map(async id => {
    const pack = await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/c2-synthesis-${id}.zip`)));
    return { ...pack.spoken!, records: await Promise.all(pack.spoken!.records.map(async r => ({ ...r, clips: await data.reviewedExcerpts(r, r.clips) }))) };
  }));
  for (const [skill, seed] of [['reading', 78], ['listening', 0]] as const) {
    vi.mocked(corpusLesson).mockImplementation(core.corpusLesson); vi.mocked(spokenCorpusLesson).mockImplementation(heard.spokenCorpusLesson);
    vi.mocked(loadReadingCorpus).mockResolvedValue(reading); vi.mocked(loadSpokenCorpora).mockResolvedValue(banks);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(a => { (a as Uint32Array).set([0, seed]); return a; });
    const profileId = `synthesis-ordinary-${skill}`, base = { profileId, locale: 'zh-Hans' as const, skill, online: false, preferences: { reading: 'C2' as const, listening: 'C2' as const, interests: [], step: 4, completed: true } };
    const lesson = (await prepareCorpusPractice({ ...base, history: [], records: [] })).lesson!;
    expect(lesson?.goalId).toBe('disagreement-synthesis');
    expect(lesson.materials.every(m => corpusOperation(m.questions[0]) === 'choice:disagreement-synthesis')).toBe(true);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    const at = new Date(Date.now() - 1000).toISOString(), session: Session = { id: profileId, profileId, lesson, status: 'completed', position: 1, startedAt: at, contentHash: 'isolated-synthesis-route', assistance: { hintLevel: 0 }, leaseUntil: 0 };
    const records: Attempt[] = lesson.materials.map(m => { const q = m.questions[0]; if ('kind' in q) throw Error('Expected choice'); return { id: m.id, profileId, sessionId: session.id, questionId: q.id, rootId: m.rootId, answer: (q.answer + 1) % q.options.length, correct: false, rule: 'isolated-synthesis-route-only', assistance: { hintLevel: 0, ...(skill === 'listening' ? { audioCompleted: true, playbackRequests: 1 } : {}) }, submittedAt: at }; });
    expect((await prepareCorpusPractice({ ...base, history: [session], records })).lesson).toBeUndefined();
    const exposure: Session = { ...session, id: 'synthesis-other-skill-exposure', status: 'active', lesson: { ...lesson, skill: skill === 'reading' ? 'listening' : 'reading', materials: [{ ...lesson.materials[0], id: 'corpus-' + 'f'.repeat(64) }] } };
    expect((await prepareCorpusPractice({ ...base, history: [exposure], records: [] })).lesson?.goalId).not.toBe('disagreement-synthesis');
    expect((await prepareCorpusPractice({ ...base, history: [], records: [], previewRoots: new Set([lesson.materials[0].rootId]) })).lesson?.goalId).not.toBe('disagreement-synthesis');
    expect(installSourcePack).not.toHaveBeenCalled(); vi.restoreAllMocks();
  }
});
