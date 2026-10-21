import { z } from 'zod';
import type { Lesson, Question } from './content';

export const quantityRevision = 1;
const readingAnchors = [[50, 1], [150, 2], [300, 4], [500, 5], [800, 7], [1000, 9], [1500, 11], [2000, 12]] as const;
const listeningAnchors = [[15, 1], [30, 2], [60, 3], [120, 5], [180, 7], [300, 11], [480, 14], [720, 18], [900, 20]] as const;
const readingBands = [[80, 1, 2], [200, 2, 3], [400, 3, 5], [700, 4, 6], [1000, 6, 8], [1500, 8, 10], [Infinity, 10, 12]] as const;
const listeningBands = [[30, 1, 2], [60, 2, 3], [120, 3, 5], [180, 5, 7], [300, 7, 11], [480, 10, 14], [720, 13, 18], [Infinity, 17, 20]] as const;

export function quantityBudget(skill: Lesson['skill'], length: number | undefined) {
  if (typeof length !== 'number' || !Number.isFinite(length) || length <= 0) return { baseline: 0, minimum: 0, maximum: 0, preferSegments: false };
  const anchors = skill === 'reading' ? readingAnchors : listeningAnchors;
  const [, minimum, maximum] = (skill === 'reading' ? readingBands : listeningBands).find(([limit]) => length < limit)!;
  let value: number = anchors[0][1];
  if (length >= anchors.at(-1)![0]) value = anchors.at(-1)![1];
  else for (let index = 1; index < anchors.length; index++) {
    const [right, high] = anchors[index], [left, low] = anchors[index - 1];
    if (length >= left && length <= right) { value = low + (high - low) * (length - left) / (right - left); break; }
  }
  return { baseline: Math.min(maximum, Math.max(minimum, Math.round(value))), minimum, maximum, preferSegments: length > (skill === 'reading' ? 2000 : 900) };
}

// Apostrophes, hyphenated compounds, initialisms and numbers each form one word.
export function englishWords(text: string) {
  return text.match(/(?:[A-Za-z]\.){2,}|[A-Za-z0-9]+(?:['’\-‐‑][A-Za-z0-9]+)*(?:[.,][0-9]+)*/g) ?? [];
}

export function readingBody(material: Pick<Lesson['materials'][number], 'blocks'>) {
  const seen = new Set<string>();
  const paragraphs: { blockId: string; start: number; end: number; text: string }[] = [];
  for (const block of material.blocks) {
    if (/^(?:navigation|vocabulary|glossary|word list|translation|answers?|explanations?)$/i.test(block.title?.trim() ?? '')) continue;
    for (const match of block.text.matchAll(/[^\r\n]+(?:\r?\n(?!\s*\r?\n)[^\r\n]+)*/g)) {
      const text = match[0], key = text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key || /^(?:home|next|previous|back|contents|table of contents|navigation)$/i.test(key) || seen.has(key)) continue;
      seen.add(key); paragraphs.push({ blockId: block.id, start: match.index, end: match.index + text.length, text });
    }
  }
  return paragraphs;
}

export const readingWordCount = (material: Pick<Lesson['materials'][number], 'blocks'>) => readingBody(material).reduce((sum, part) => sum + englishWords(part.text).length, 0);
export const afterListeningQuestion = (question: Question) => /\b(?:main (?:point|idea)|overall|purpose of (?:the|this)|speaker.s attitude|summari[sz]e)\b/i.test(question.prompt);
export const questionSlots = (question: Question): number => 'gaps' in question ? question.gaps.length : 'rows' in question ? question.rows.length : 'pairs' in question ? question.pairs.length : 'criteria' in question ? question.parts?.length ?? 1 : 1;
export const answerPointCount = (questions: readonly Question[]) => questions.reduce((sum, question) => sum + questionSlots(question), 0);

export function listeningSpacing(level: Lesson['targetLevel'], heavy = false) {
  const slow = level === 'A1' || level === 'A2' || heavy;
  return { minimum: slow ? 20 : 12, preferred: slow ? 32 : 25, response: slow ? 5 : 3 };
}

export const quantityReportSchema = z.object({
  revision: z.literal(quantityRevision), length: z.number().nonnegative(), baseline: z.number().int().min(0).max(20),
  target: z.number().int().min(0).max(20), actual: z.number().int().min(0).max(20),
  timing: z.enum(['not-applicable', 'provided', 'aligned', 'estimated']), preferSegments: z.boolean(),
  reasons: z.array(z.enum(['insufficient-independent-points', 'unsupported-question-kind', 'timing-spacing', 'incomplete-slot-timing', 'complexity', 'intact-groups', 'estimated-timing', 'session-budget'])).max(8),
}).strict();
