import { z } from 'zod';
import { questions, validateAnswer, type Lesson, type Question, type Answer } from './content';
export const assistanceSchema = z.object({ hintLevel: z.number().int().min(0).max(3), playbackRequests: z.number().int().nonnegative().optional(), audioCompleted: z.boolean().optional(), dictionaryUsed: z.boolean().optional(), teachingProvided: z.boolean().optional() }).strict();
export const workspaceSchema = z.object({
  drafts: z.record(z.string().min(1).max(80), z.union([z.number(), z.string().max(4000), z.array(z.string().max(4000)).max(12)])),
  assistance: z.record(z.string().min(1).max(160), assistanceSchema), selected: z.string().min(1).max(80).optional(),
}).strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export function validateWorkspace(lesson: Lesson, raw: unknown) {
  const workspace = workspaceSchema.parse(raw), all = questions(lesson);
  if (lesson.organization !== 'material-v1' || lesson.mode === 'check' || workspace.selected && !all.some(item => item.question.id === workspace.selected) || Object.keys(workspace.assistance).some(id => !lesson.materials.some(material => material.id === id))) throw new Error('INVALID_WORKSPACE');
  for (const [id, answer] of Object.entries(workspace.drafts)) {
    const item = all.find(item => item.question.id === id);
    if (!item) throw new Error('INVALID_WORKSPACE');
    validateAnswer(item.question, answer, true);
  }
  return workspace;
}
export function questionSlots(question: Question) { return 'gaps' in question ? question.gaps.length : 'rows' in question ? question.rows.length : 'pairs' in question ? question.pairs.length : 1; }
export function slotAnswered(question: Question, answer: Answer | undefined, slot: number) {
  if (answer === undefined) return false;
  if ('gaps' in question || 'rows' in question || 'pairs' in question) return Array.isArray(answer) && !!answer[slot]?.trim();
  try { validateAnswer(question, answer); return true; } catch { return false; }
}
