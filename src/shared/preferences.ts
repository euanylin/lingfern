import { z } from 'zod';
import { levelSchema, topicSchema } from './content';

export const preferencesSchema = z.object({
  purpose: z.enum(['daily-life', 'study', 'work', 'travel', 'pleasure']).optional(),
  interests: z.array(topicSchema).max(5).refine(items => new Set(items).size === items.length),
  reading: levelSchema.optional(), listening: levelSchema.optional(),
  step: z.number().int().min(0).max(4), completed: z.boolean(),
}).strict().transform(value => {
  // Cleared choices are absent JSON fields, including records saved by older releases.
  for (const key of ['purpose', 'reading', 'listening'] as const) if (value[key] === undefined) delete value[key];
  return value;
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const initialPreferences: Preferences = { interests: [], step: 0, completed: false };
