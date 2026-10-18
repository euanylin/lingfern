import { z } from 'zod';
import { profileIdSchema } from './repository';

export const shareIdSchema = z.uuid();
const timestamp = z.number().int().nonnegative();
export const sharingConnectionsSchema = z.object({ connections: z.array(z.object({ id: shareIdSchema, name: z.string().min(1).max(256), createdAt: timestamp, expiresAt: timestamp, contextsRead: z.union([z.literal(0), z.literal(1)]), materialsRead: z.union([z.literal(0), z.literal(1)]) }).strict()).max(100) }).strict();
export const sharingSummariesSchema = z.object({ shares: z.array(z.object({ id: shareIdSchema, profileId: profileIdSchema, connectionId: shareIdSchema, title: z.string().min(1).max(120), createdAt: timestamp, expiresAt: timestamp }).strict()).max(20) }).strict();
export const sharingRevokedSchema = z.object({ revoked: z.literal(true) }).strict();
export const listSharesSchema = z.object({ cursor: shareIdSchema.optional(), count: z.number().int().min(1).max(20).default(20) }).strict();
export const createShareSchema = z.object({ profileId: profileIdSchema, connectionId: shareIdSchema, title: z.string().trim().min(1).max(120), text: z.string().min(1).max(32768), confirm: z.literal(true) }).strict().refine(value => new TextEncoder().encode(JSON.stringify({ title: value.title, text: value.text })).length <= 32768, 'SHARE_SIZE');
