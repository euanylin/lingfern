import { z } from 'zod';

export const profileIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const repositoryNameSchema = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/).refine(value => !['.', '..'].includes(value));
const repositoryChoiceSchema = z.object({ installationId: z.number().int().positive(), repositoryId: z.number().int().positive(), name: repositoryNameSchema }).strict();
export const repositoryChoicesSchema = z.object({ repositories: z.array(repositoryChoiceSchema).max(100), installationUrl: z.string().regex(/^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new$/).optional() }).strict();
export const inspectRepositorySchema = repositoryChoiceSchema.extend({ profileId: profileIdSchema }).strict();
export const repositoryMarkerSchema = z.object({ product: z.literal('Lingfern'), formatVersion: z.literal(1), profileId: profileIdSchema }).strict();
export const bindingIntentSchema = z.object({ intent: z.string().regex(/^[\w-]{43}$/), name: repositoryNameSchema, owner: z.string().regex(/^[a-zA-Z0-9-]{1,39}$/), profileId: profileIdSchema, existing: z.boolean(), expiresAt: z.number().int().positive() }).strict();
export const bindRepositorySchema = z.object({ intent: z.string().regex(/^[\w-]{43}$/), confirm: z.literal(true) }).strict();
export const repositoryBindingSchema = z.object({ name: repositoryNameSchema, owner: z.string().regex(/^[a-zA-Z0-9-]{1,39}$/), profileId: profileIdSchema, disabled: z.boolean(), bindingVersion: z.string().regex(/^[\w-]{43}$/).optional() }).strict();
export type RepositoryChoice = z.infer<typeof repositoryChoiceSchema>;
export type BindingIntent = z.infer<typeof bindingIntentSchema>;
