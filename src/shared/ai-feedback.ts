import { z } from 'zod';
import type { Lesson } from './content';

const text = z.string().trim().min(1).max(16_000);
const feedbackSchema = z.object({
  explanation: text.optional(),
  evidence: z.array(z.object({ blockId: z.string().min(1).max(80), comment: text }).strict()).max(12).optional(),
  reviewGoals: z.array(z.object({ goalId: z.string().min(1).max(80), suggestion: text }).strict()).max(8).optional(),
  practiceDrafts: z.array(text).max(8).optional(),
}).strict().refine(value => !!(value.explanation || value.evidence?.length || value.reviewGoals?.length || value.practiceDrafts?.length));

export function prepareFeedback(input: string, lesson: Lesson, material: Lesson['materials'][number]) {
  if (new TextEncoder().encode(input).length > 64 * 1024) throw new Error('FEEDBACK_SIZE');
  const draft = feedbackSchema.parse(JSON.parse(input));
  const prose = draft.explanation ? [draft.explanation] : [];
  let unknownReferences = false;
  for (const item of draft.evidence ?? []) {
    if (!material.blocks.some(block => block.id === item.blockId)) unknownReferences = true;
    prose.push(`${item.blockId}: ${item.comment}`);
  }
  for (const item of draft.reviewGoals ?? []) {
    if (item.goalId !== lesson.goalId) unknownReferences = true;
    prose.push(`${item.goalId}: ${item.suggestion}`);
  }
  prose.push(...(draft.practiceDrafts ?? []));
  const content = prose.join('\n\n');
  if (new TextEncoder().encode(content).length > 64 * 1024) throw new Error('FEEDBACK_SIZE');
  if (/<[^>]*>/i.test(content) || /(?:javascript|data):/i.test(content)) throw new Error('FEEDBACK_HTML');
  return { content, unknownReferences };
}
