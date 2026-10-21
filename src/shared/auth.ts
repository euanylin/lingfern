import { z } from 'zod';
import { profileIdSchema, repositoryBindingSchema } from './repository';

// Local association proves neither a website session nor upload consent.
export const syncAccountSchema = z.object({ accountId: z.number().int().positive(), profileId: profileIdSchema }).strict();

export const sessionSummarySchema = z.object({
  account: z.object({ id: z.number().int().positive(), login: z.string().min(1).max(39) }).nullable(),
  csrfToken: z.string().min(43).max(43).optional(),
  syncAvailable: z.boolean(),
  bindings: z.array(repositoryBindingSchema).max(100).optional(),
}).strict();
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export const disconnectSummarySchema = z.object({ disconnected: z.literal(true), providerRevoked: z.boolean() }).strict();
