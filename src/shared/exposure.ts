import { z } from 'zod';
export const exposureQuestionIdSchema = z.string().min(1).max(80);

const contactSchema = z.object({
  sessionId: z.string().min(1).max(80), materialId: z.string().min(1), questionId: exposureQuestionIdSchema,
  variantGroup: exposureQuestionIdSchema, firstSeenAt: z.iso.datetime(), lastSeenAt: z.iso.datetime(),
}).strict();
export const exposureSchema = z.object({
  profileId: z.string().min(1).max(80), rootId: z.string().min(1).max(160), firstSeenAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime().optional(), contacts: z.array(contactSchema).max(50_000).optional(),
}).strict().superRefine((exposure, ctx) => {
  if (exposure.lastSeenAt && exposure.lastSeenAt < exposure.firstSeenAt) ctx.addIssue({ code: 'custom', message: 'Exposure time range is invalid' });
  const keys = new Set<string>();
  for (const contact of exposure.contacts ?? []) {
    const key = JSON.stringify([contact.sessionId, contact.questionId]);
    if (keys.has(key) || contact.firstSeenAt > contact.lastSeenAt || contact.firstSeenAt < exposure.firstSeenAt || !exposure.lastSeenAt || contact.lastSeenAt > exposure.lastSeenAt) ctx.addIssue({ code: 'custom', message: 'Exposure contact is invalid' });
    keys.add(key);
  }
});
export type Exposure = z.infer<typeof exposureSchema>;
