import { lessonSchema, type Lesson } from '../../src/shared/content';

const words = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
export const VARIANT_COUNT = 432;
export const VARIANT_ATTEMPTS = 30;
const time = (minutes: number) => `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;

/** Finite fictional notices. Roots and question IDs stay stable across parameter changes. */
export function travelVariant(seed: number, excluded: ReadonlySet<string> = new Set()): { lesson: Lesson | null; attempts: number } {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_SEED');
  for (let attempt = 0; attempt < VARIANT_ATTEMPTS; attempt++) {
    const index = (seed + attempt) % VARIANT_COUNT;
    const id = `travel-variant-v1-${index}`;
    if (excluded.has(id)) continue;
    const departure = 480 + (index % 12) * 30;
    const delay = (Math.floor(index / 12) % 3 + 1) * 5;
    const platform = Math.floor(index / 36) % 4 + 1;
    const destination = ['Westbridge', 'Greenford', 'Lakewood'][Math.floor(index / 144)];
    const materials = ['train', 'coach'].map((vehicle, part) => {
      const rootId = `original-fictional-${vehicle}-change`;
      const oldTime = time(departure + part * 60);
      const newTime = time(departure + part * 60 + delay);
      const oldPlatform = platform;
      const newPlatform = platform % 4 + 1;
      const place = vehicle === 'train' ? 'platform' : 'bay';
      const text = `Fictional practice notice. The ${vehicle} to ${destination} was scheduled for ${oldTime} at ${place} ${oldPlatform}. Today it leaves at ${newTime} from ${place} ${newPlatform} instead. Please follow today's change.`;
      const evidence = { start: text.indexOf('Today'), end: text.indexOf(' Please') };
      return {
        id: `${rootId}-${index}`, rootId, title: `Fictional ${vehicle} departure`,
        blocks: [{ id: rootId, text }],
        questions: [
          { key: 'time', prompt: `When does the ${vehicle} leave today?`, options: [oldTime, newTime, time(departure + part * 60 + 30)], answer: 1 },
          { key: 'place', prompt: `Where should you wait for the ${vehicle} today?`, options: [`${place} ${newPlatform}`, `${place} ${oldPlatform}`, `${place} ${(platform + 1) % 4 + 1}`], answer: 0 },
        ].map(q => ({
          id: `${rootId}-${q.key}`, variantGroup: `${rootId}-${q.key}`, blockId: rootId, prompt: q.prompt, options: q.options, answer: q.answer, evidence,
          hints: [
            words('Find today’s departure, not the original plan.', '找今天的出发安排，不是原计划。', '找今天的出發安排，不是原計劃。'),
            words('Read the sentence starting “Today”.', '看以 Today 开头的句子。', '看以 Today 開頭的句子。'),
            words('“Instead” replaces the earlier time and place.', 'instead 表示替换之前的时间和地点。', 'instead 表示替換之前的時間和地點。'),
          ],
          explanations: q.options.map((_, position) => words(
            `${position === q.answer ? 'Yes.' : 'Check the change.'} Today the ${vehicle} leaves at ${newTime} from ${place} ${newPlatform}; “instead” replaces the earlier plan.`,
            `${position === q.answer ? '正确。' : '请核对变更。'}今天 ${newTime} 从 ${place} ${newPlatform} 出发；instead 表示原安排已被替换。`,
            `${position === q.answer ? '正確。' : '請核對變更。'}今天 ${newTime} 從 ${place} ${newPlatform} 出發；instead 表示原安排已被替換。`,
          )),
        })),
      };
    });
    return { attempts: attempt + 1, lesson: lessonSchema.parse({
      id, targetLevel: 'A2', skill: 'reading', reviewStatus: 'draft', sourceId: 'lingfern-original-travel-variants', goalId: 'departure-changes',
      generation: { generator: 'travel-v1', seed, index },
      title: words('Update a fictional journey', '更新虚构行程', '更新虛構行程'),
      goal: words('Use the changed time and place to update a journey.', '根据变更的时间和地点更新行程。', '根據變更的時間和地點更新行程。'),
      teaching: words('These fictional notices are related practice variants, not independent checks or new source texts. Read the original plan, then find what replaces it today.', '这些虚构通知是相关变式练习，不是独立检测或新根材料。先读原计划，再找今天替换的安排。', '這些虛構通知是相關變式練習，不是獨立檢測或新根材料。先讀原計劃，再找今天替換的安排。'),
      workedExample: words('Example: “Usually 09:00, platform 1. Today 09:10, platform 2 instead.” → Today: 09:10, platform 2.', '示范：“Usually 09:00, platform 1. Today 09:10, platform 2 instead.” → 今天：09:10，2 号站台。', '示範：“Usually 09:00, platform 1. Today 09:10, platform 2 instead.” → 今天：09:10，2 號月台。'),
      materials,
    }) };
  }
  return { lesson: null, attempts: VARIANT_ATTEMPTS };
}
