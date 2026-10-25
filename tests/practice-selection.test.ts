import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { db } from '../src/data/db';
import { corpusSchema } from '../src/core/corpus';
import { asTestLesson, topicSchema } from '../src/shared/content';
import { practiceSelectionSchema, practiceSelectionMatches, readPracticeSelection } from '../src/shared/practiceSelection';
import { practiceMaterials, prepareCorpusPractice } from '../src/app/prepareCorpusPractice';
import { loadReadingCorpus } from '../src/data/corpus';
import { installSourcePack } from '../src/data/sourcePacks';
import personal from '../public/audio/a2-speech/PERSONAL.json';

vi.mock('../src/data/corpus', () => ({ loadReadingCorpus: vi.fn(), loadSpokenCorpora: vi.fn(async () => []) }));
vi.mock('../src/data/sourcePacks', () => ({ installSourcePack: vi.fn(), sourcePacks: [], installedSourcePacks: vi.fn(async () => new Set()) }));
vi.mock('../src/data/offline', () => ({ offlineGroupReady: vi.fn(async () => true) }));

const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
const base = { locale: 'en' as const, profileId: 'isolated-selection', history: [], records: [], online: false };
beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  vi.mocked(loadReadingCorpus).mockResolvedValue(corpus);
  vi.spyOn(crypto, 'getRandomValues').mockReturnValue(new Uint32Array([0, 0]));
});

it('reads legacy single choices, rejects duplicate kinds and falls back to an available selected kind', async () => {
  expect(readPracticeSelection('{"kind":"completion","materials":[]}')).toEqual({ topics: [], kinds: ['completion'], materials: [] });
  expect(practiceSelectionSchema.safeParse({ kinds: ['choice', 'choice'], materials: [] }).success).toBe(false);
  expect(practiceSelectionSchema.safeParse({ kind: 'choice', kinds: ['completion'], materials: [] }).success).toBe(false);
  const selection = { topics: [], kinds: ['choice' as const, 'completion' as const], materials: corpus.records.slice(0, 32).map(record => record.rootId) };
  const result = await prepareCorpusPractice({ ...base, skill: 'reading', preferences: { reading: 'B2', interests: [], step: 4, completed: true }, selection });
  expect(result.lesson).toBeDefined();
  expect(practiceSelectionMatches(result.lesson!, selection)).toBe(true);
  expect(result.lesson!.materials.flatMap(material => material.questions).some(question => 'gaps' in question || 'kind' in question && question.kind === 'completion')).toBe(true);
});

it('uses only selected reading roots and one requested kind, including additional questions and Test', async () => {
  const roots = corpus.records.slice(0, 32).map(record => record.rootId);
  const choices = await practiceMaterials(base.profileId, 'reading', { reading: 'B2', interests: [], step: 4, completed: true });
  const topics = new Map(__LINGFERN_SOURCE_TOPICS__.map(item => [item.rootId, item]));
  for (const choice of choices) { const source = corpus.records.find(record => record.rootId === choice.value)!; const topic = topics.get(source.rootId); expect(choice.group).toBe(topic?.sourceHash === source.sourceHash ? topic.topic : 'general'); }
  const selection = { topics: [], kinds: ['completion' as const], materials: roots };
  const result = await prepareCorpusPractice({ ...base, skill: 'reading', preferences: { reading: 'B2', interests: [], step: 4, completed: true }, selection });
  expect(result.lesson).toBeDefined();
  expect(practiceSelectionMatches(result.lesson!, selection)).toBe(true);
  expect(new Set(result.lesson!.materials.map(material => material.rootId)).size).toBe(2);
  const test = asTestLesson(result.lesson!);
  expect(practiceSelectionMatches(test, selection)).toBe(true);
  expect(test.materials.map(material => material.id)).toEqual(result.lesson!.materials.map(material => material.id));
  expect(installSourcePack).not.toHaveBeenCalled();
});

it('retains exact A1 word recordings and A2 same-operation source guards under explicit choices', async () => {
  const wordSelection = { topics: [], kinds: ['completion' as const], materials: ['ipa-word-cat', 'ipa-word-bed'] };
  const words = await prepareCorpusPractice({ ...base, skill: 'listening', preferences: { listening: 'A1', interests: [], step: 4, completed: true }, selection: wordSelection });
  expect(words.lesson?.goalId).toBe('heard-word-recognition');
  expect(practiceSelectionMatches(words.lesson!, wordSelection)).toBe(true);
  const selection = { topics: [], kinds: ['choice' as const], materials: personal.need.map(source => source.rootId) };
  const result = await prepareCorpusPractice({ ...base, skill: 'listening', preferences: { listening: 'A2', interests: [], step: 4, completed: true }, selection });
  expect(result.lesson?.goalId).toBe('heard-stated-need');
  expect(practiceSelectionMatches(result.lesson!, selection)).toBe(true);
  expect(new Set(result.lesson!.materials.map(material => material.rootId)).size).toBe(2);
});

it('does not substitute unavailable, exhausted, or incompatible selected materials', async () => {
  const preferences = { listening: 'A1' as const, interests: [], step: 4, completed: true };
  for (const selection of [{ topics: [], kinds: [], materials: ['removed', 'ipa-word-cat', 'ipa-word-bed'] }, { topics: [], kinds: ['table' as const], materials: ['ipa-word-cat', 'ipa-word-bed'] }]) expect((await prepareCorpusPractice({ ...base, skill: 'listening', preferences, selection })).lesson).toBeUndefined();
  expect(practiceSelectionSchema.safeParse({ materials: Array.from({ length: 33 }, (_, index) => `root-${index}`) }).success).toBe(false);
  const choices = await practiceMaterials(base.profileId, 'listening', preferences);
  expect(choices.some(item => item.value === 'ipa-word-cat')).toBe(true);
  expect(choices.every(item => item.value.startsWith('ipa-word-'))).toBe(true);
  expect(choices.every(item => practiceSelectionSchema.safeParse({ materials: [item.value] }).success)).toBe(true);
});

it('migrates single saved topics without accepting duplicate, conflicting or unknown topics', () => {
  expect(readPracticeSelection('{"topic":"science","kind":"choice","materials":[]}')).toEqual({ topics: ['science'], kinds: ['choice'], materials: [] });
  expect(readPracticeSelection(undefined)).toEqual({ topics: [], kinds: [], materials: [] });
  expect(practiceSelectionSchema.parse({ topics: topicSchema.options, materials: [] }).topics).toEqual(topicSchema.options);
  for (const value of [{ topics: ['science', 'science'] }, { topic: 'science', topics: ['culture'] }, { topics: ['unknown'] }, { topics: 'science' }]) expect(practiceSelectionSchema.safeParse({ ...value, materials: [] }).success).toBe(false);
});

it('accepts any chosen topic and retains A1 daily-life practice when other chosen topics have no material', async () => {
  const selection = { topics: ['science' as const, 'daily-life' as const], kinds: ['completion' as const], materials: ['ipa-word-cat', 'ipa-word-bed'] };
  const result = await prepareCorpusPractice({ ...base, skill: 'listening', preferences: { listening: 'A1', interests: [], step: 4, completed: true }, selection });
  expect(result.lesson?.goalId).toBe('heard-word-recognition');
  expect(practiceSelectionMatches(result.lesson!, selection)).toBe(true);
  expect(practiceSelectionMatches(asTestLesson(result.lesson!), selection)).toBe(true);
  expect(practiceSelectionMatches(result.lesson!, { ...selection, topics: ['science', 'travel'] })).toBe(false);
  expect((await prepareCorpusPractice({ ...base, skill: 'listening', preferences: { listening: 'A1', interests: [], step: 4, completed: true }, selection: { ...selection, topics: ['science', 'travel'] } })).lesson).toBeUndefined();
});

it('generates combined topic and kind choices and matches untagged saved material by its actual text', async () => {
  const selection = { topics: ['science' as const, 'daily-life' as const], kinds: ['completion' as const], materials: [] };
  const result = await prepareCorpusPractice({ ...base, skill: 'reading', preferences: { reading: 'B2', interests: [], step: 4, completed: true }, selection });
  expect(result.lesson).toBeDefined();
  expect(practiceSelectionMatches(result.lesson!, selection)).toBe(true);
  const saved = structuredClone(result.lesson!); delete saved.themes;
  expect(practiceSelectionMatches(saved, selection)).toBe(true);
  expect(practiceSelectionMatches({ ...saved, materials: saved.materials.map(material => ({ ...material, title: 'A neutral heading', blocks: material.blocks.map(block => ({ ...block, text: 'No selected subject appears here.' })) })) }, selection)).toBe(false);
});

it('keeps both automatic and material-filtered reading objective on the ordinary seed branch', async () => {
  const random = vi.spyOn(crypto, 'getRandomValues');
  try {
    for (const selection of [undefined, { topics: [], kinds: [], materials: corpus.records.slice(0, 32).map(record => record.rootId) }]) {
      let found = false;
      for (let offset = 0; offset < 10 && !found; offset++) {
        random.mockReturnValue(new Uint32Array([0, 65536 + offset]));
        const result = await prepareCorpusPractice({ ...base, skill: 'reading', preferences: { reading: 'B2', interests: [], step: 4, completed: true }, selection });
        if (!result.lesson) continue;
        expect(result.lesson.materials.flatMap(material => material.questions).every(question => !('criteria' in question))).toBe(true); found = true;
      }
      expect(found).toBe(true);
    }
  } finally { random.mockRestore(); }
});
