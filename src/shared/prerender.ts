import { z } from 'zod';
import { publicPages } from './seo';

export const publicPageStateSchema = z.object({
  path: z.string().refine(path => Object.hasOwn(publicPages, path)),
  day: z.iso.date(),
  grammar: z.unknown().optional(),
  ipa: z.unknown().optional(),
  sounds: z.unknown().optional(),
}).strict();
export type PublicPageState = z.infer<typeof publicPageStateSchema>;
