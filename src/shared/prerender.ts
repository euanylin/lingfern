import { z } from 'zod';
import { localeSchema } from './locale';
import { publicPages } from './seo';

export const publicPageStateSchema = z.object({
  path: z.string().refine(path => Object.hasOwn(publicPages, path)),
  day: z.iso.date(),
  locale: localeSchema.optional(),
  grammar: z.unknown().optional(),
  ipa: z.unknown().optional(),
  sounds: z.unknown().optional(),
}).strict();
export type PublicPageState = z.infer<typeof publicPageStateSchema>;
