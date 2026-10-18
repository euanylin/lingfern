import { z } from 'zod';
import { lessonSchema } from '../shared/content';

const sourceSchema = z.object({ word: z.string().regex(/^[a-z]+$/), path: z.string().regex(/^\/ipa\/audio\/[a-z]+\.mp3$/), sha256: z.string().regex(/^[a-f0-9]{64}$/), duration: z.number().positive().max(5), author: z.string().min(1), source: z.string().regex(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:[A-Za-z0-9_.-]+$/), license: z.literal('CC BY-SA 3.0') });
const words = new Set(['bed','cat','father','book','cup','bird','pen','bag','tea','dog','key','sun','hat','chair','man','leg','red','yes','no','blue']);
const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });

/** Recognition of individual source words only; not sentence comprehension or ability. */
export function wordListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_WORD_LISTENING_SEED');
  const sources = z.array(sourceSchema).max(100).parse(input);
  if (new Set(sources.map(source => source.word)).size !== sources.length || sources.some(source => source.path !== `/ipa/audio/${source.word}.mp3`)) throw new Error('INVALID_WORD_LISTENING_SOURCES');
  const available = sources.filter(source => words.has(source.word) && !seen.has(source.sha256));
  if (available.length < 2) return;
  const first = available[seed % available.length], remaining = available.filter(source => source !== first);
  const second = remaining[(seed + 1) % remaining.length];
  const materials = [first, second].map((source, index) => {
    const id = `corpus-${source.sha256}`;
    return { id, rootId: `ipa-word-${source.word}`, sourceId: `ipa-word-${source.word}`, title: `Recording ${index + 1}`,
      audio: { src: source.path, sha256: source.sha256, duration: source.duration, author: source.author, sourceUrl: source.source, license: 'CC-BY-SA-3.0', synthetic: false },
      credit: { attribution: `${source.author}; recording transcoded to MP3.`, license: source.license, sourceUrl: source.source },
      blocks: [{ id, text: source.word }], questions: [{ kind: 'completion', id: `${id}-restore`, blockId: id, prompt: 'Listen. Type the word.', answer: source.word, accepted: [source.word],
        evidence: { start: 0, end: source.word.length, audioStart: 0, audioEnd: source.duration },
        hints: [local('Listen again.', '再听一次。', '再聽一次。'), local('Say the sounds slowly.', '慢慢读出听到的音。', '慢慢讀出聽到的音。'), local('Check each letter.', '检查每个字母。', '檢查每個字母。')],
        explanation: local(`You heard “${source.word}”.`, `你听到的是“${source.word}”。`, `你聽到的是「${source.word}」。`),
      }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-words-${first.sha256.slice(0,16)}-${second.sha256.slice(0,16)}`, targetLevel: 'B2', skill: 'listening', reviewStatus: 'draft', sourceId: 'ipa-word-recordings', themes: ['daily-life'], goalId: 'heard-word-recognition', generation: { generator: 'corpus-v1', seed, startingPoint: 'A1' },
    title: local('Listen to words', '听单词', '聽單字'), goal: local('Listen and write the word.', '听录音，写出单词。', '聽錄音，寫出單字。'),
    teaching: local('Listen once. Type the word. Listen again if you need to.', '先听一次，再输入单词。需要时可以重听。', '先聽一次，再輸入單字。需要時可以重聽。'),
    workedExample: local('If you hear “hello”, type hello.', '听到“hello”，就输入 hello。', '聽到「hello」，就輸入 hello。'),
    nextStep: local('Try another recording. Listen for each sound.', '换一段录音，留意每个音。', '換一段錄音，留意每個音。'), materials });
}
