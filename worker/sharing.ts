import { z } from 'zod';
import { createShareSchema, listSharesSchema, shareIdSchema } from '../src/shared/sharing';
import { ApiError, boundedBody, privateJson, requireSession, type AuthEnv } from './auth';

export type SharingEnv = AuthEnv & { SHARE_ENCRYPTION_KEY?: string };
type Share = { id: string; account_id: number; profile_id: string; connection_id: string; title: string; encrypted_context: string; created_at: number; expires_at: number };
const now = () => Math.floor(Date.now() / 1000);
const aad = (share: Pick<Share, 'id' | 'account_id' | 'profile_id' | 'connection_id'>) => new TextEncoder().encode(JSON.stringify(['lingfern-share-v1', share.id, share.account_id, share.profile_id, share.connection_id]));
async function key(secret: string, usage: KeyUsage) {
  const bytes = Uint8Array.from(atob(secret), character => character.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('SHARE_KEY');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [usage]);
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
async function encrypt(text: string, secret: string, share: Parameters<typeof aad>[0]) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(share) }, await key(secret, 'encrypt'), new TextEncoder().encode(text));
  return JSON.stringify({ iv: encode(iv), data: encode(new Uint8Array(encrypted)) });
}
async function decrypt(share: Share, secret: string) {
  const sealed = z.object({ iv: z.string().max(32), data: z.string().max(65536) }).strict().parse(JSON.parse(share.encrypted_context));
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(sealed.iv), additionalData: aad(share) }, await key(secret, 'decrypt'), decode(sealed.data));
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (bytes.byteLength > 32768) throw new Error('SHARE_SIZE');
  return text;
}
function primary(env: SharingEnv) {
  if (!env.AUTH_DB || !env.SHARE_ENCRYPTION_KEY) throw new ApiError('SHARING_NOT_CONFIGURED', 503);
  return env.AUTH_DB.withSession('first-primary');
}
export async function sharingLimit(db: D1DatabaseSession, accountId: number) {
  const time = now();
  await db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').bind(time).run();
  const value = await db.prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(`sharing:${accountId}:${Math.floor(time / 60)}`, time + 120).first<{ count: number }>();
  if (!value || value.count > 30) throw new ApiError('SHARING_RATE_LIMITED', 429);
}

// Require the OAuth-verified account, client and connection, never tool-supplied IDs.
export async function listSharedContexts(env: SharingEnv, accountId: number, clientId: string, connectionId: string, input: unknown = {}) {
  z.number().int().positive().parse(accountId); z.string().min(1).max(256).parse(clientId); shareIdSchema.parse(connectionId);
  const { cursor, count } = listSharesSchema.parse(input), db = primary(env);
  await sharingLimit(db, accountId);
  const time = now();
  // Use text-free UUID keysets that survive deletion of earlier shares.
  const values = await db.prepare('SELECT s.id,s.profile_id AS profileId,s.title,s.created_at AS createdAt,s.expires_at AS expiresAt FROM shared_contexts s JOIN mcp_connections c ON c.id=s.connection_id JOIN accounts a ON a.id=s.account_id WHERE s.account_id=? AND c.account_id=s.account_id AND c.client_id=? AND c.id=? AND c.revoked=0 AND c.contexts_read=1 AND c.expires_at>? AND s.expires_at>? AND a.revoked=0 AND s.id>? ORDER BY s.id LIMIT ?').bind(accountId, clientId, connectionId, time, time, cursor ?? '', count + 1).all<{ id: string; profileId: string; title: string; createdAt: number; expiresAt: number }>();
  const contexts = values.results.slice(0, count);
  return { contexts, ...(values.results.length > count ? { cursor: contexts.at(-1)!.id } : {}) };
}

// Require the OAuth-verified account, client and connection, never tool-supplied IDs.
export async function readSharedContext(env: SharingEnv, accountId: number, clientId: string, connectionId: string, id: string) {
  z.number().int().positive().parse(accountId); z.string().min(1).max(256).parse(clientId); shareIdSchema.parse(connectionId); shareIdSchema.parse(id);
  const db = primary(env);
  await sharingLimit(db, accountId);
  const share = await db.prepare('SELECT s.* FROM shared_contexts s JOIN mcp_connections c ON c.id=s.connection_id JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.account_id=? AND c.account_id=s.account_id AND c.client_id=? AND c.id=? AND c.revoked=0 AND c.contexts_read=1 AND c.expires_at>? AND s.expires_at>? AND a.revoked=0').bind(id, accountId, clientId, connectionId, now(), now()).first<Share>();
  if (!share) throw new ApiError('SHARE_NOT_FOUND', 404);
  const text = await decrypt(share, env.SHARE_ENCRYPTION_KEY!);
  // Recheck the primary session after decryption to fence concurrent revocation.
  const live = await primary(env).prepare('SELECT s.id FROM shared_contexts s JOIN mcp_connections c ON c.id=s.connection_id JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.account_id=? AND c.account_id=s.account_id AND c.client_id=? AND c.id=? AND c.revoked=0 AND c.contexts_read=1 AND c.expires_at>? AND s.expires_at>? AND a.revoked=0 AND s.encrypted_context=?').bind(id, accountId, clientId, connectionId, now(), now(), share.encrypted_context).first();
  if (!live) throw new ApiError('SHARE_NOT_FOUND', 404);
  return { id: share.id, profileId: share.profile_id, title: share.title, text, createdAt: share.created_at, expiresAt: share.expires_at };
}

export async function cleanupShares(env: SharingEnv) {
  if (env.AUTH_DB) await env.AUTH_DB.prepare('DELETE FROM shared_contexts WHERE expires_at<=? OR account_id IN(SELECT id FROM accounts WHERE revoked=1) OR connection_id IN(SELECT id FROM mcp_connections WHERE revoked=1 OR expires_at<=?)').bind(now(), now()).run();
  if (env.AUTH_DB) await env.AUTH_DB.prepare('DELETE FROM mcp_login_requests WHERE expires_at<=?').bind(now()).run();
}

export async function sharingRoute(request: Request, env: SharingEnv): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (!/^\/api\/ai\/(shares(?:\/[^/]+)?|connections)$/.test(path)) return;
  try {
    const shares = path === '/api/ai/shares', connections = path === '/api/ai/connections', deleting = path.startsWith('/api/ai/shares/');
    if (!(shares && ['GET', 'POST'].includes(request.method) || connections && request.method === 'GET' || deleting && request.method === 'DELETE')) return privateJson({ error: 'METHOD' }, 405);
    const db = primary(env), session = await requireSession(request, { ...env, AUTH_DB: db as unknown as D1Database }, request.method !== 'GET');
    await sharingLimit(db, session.id);
    const time = now();
    if (connections) {
      const values = await db.prepare('SELECT id,name,created_at AS createdAt,expires_at AS expiresAt,contexts_read AS contextsRead,materials_read AS materialsRead FROM mcp_connections WHERE account_id=? AND revoked=0 AND expires_at>? LIMIT 100').bind(session.id, time).all();
      return privateJson({ connections: values.results });
    }
    if (deleting) {
      const id = shareIdSchema.parse(path.slice('/api/ai/shares/'.length));
      const value = await db.prepare('DELETE FROM shared_contexts WHERE id=? AND account_id=? RETURNING id').bind(id, session.id).first();
      return value ? privateJson({ revoked: true }) : privateJson({ error: 'SHARE_NOT_FOUND' }, 404);
    }
    if (request.method === 'GET') {
      const values = await db.prepare('SELECT s.id,s.profile_id AS profileId,s.connection_id AS connectionId,s.title,s.created_at AS createdAt,s.expires_at AS expiresAt FROM shared_contexts s JOIN mcp_connections c ON c.id=s.connection_id WHERE s.account_id=? AND c.account_id=s.account_id AND s.expires_at>? AND c.expires_at>? AND c.revoked=0 AND c.contexts_read=1 ORDER BY s.created_at DESC,s.id LIMIT 20').bind(session.id, time, time).all();
      return privateJson({ shares: values.results });
    }
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ApiError('CONTENT_TYPE', 415);
    let value: z.infer<typeof createShareSchema>;
    try { value = createShareSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedBody(request.body, 65536)))); }
    catch (error) { throw new ApiError(error instanceof Error && error.message === 'BODY_SIZE' ? 'SHARE_SIZE' : 'SHARE_INVALID', error instanceof Error && error.message === 'BODY_SIZE' ? 413 : 400); }
    const share = { id: crypto.randomUUID(), account_id: session.id, profile_id: value.profileId, connection_id: value.connectionId };
    const encrypted = await encrypt(value.text, env.SHARE_ENCRYPTION_KEY!, share);
    const saved = await db.prepare('INSERT INTO shared_contexts(id,account_id,profile_id,connection_id,title,encrypted_context,created_at,expires_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mcp_connections c JOIN accounts a ON a.id=c.account_id JOIN sessions w ON w.account_id=a.id WHERE c.id=? AND c.account_id=? AND c.revoked=0 AND c.contexts_read=1 AND c.expires_at>? AND a.revoked=0 AND w.hash=? AND w.expires_at>? AND w.absolute_expires_at>?) AND (SELECT COUNT(*) FROM shared_contexts s JOIN mcp_connections c ON c.id=s.connection_id WHERE s.account_id=? AND s.expires_at>? AND c.revoked=0 AND c.contexts_read=1 AND c.expires_at>?)<20 RETURNING id').bind(share.id, session.id, value.profileId, value.connectionId, value.title, encrypted, time, time + 86400, value.connectionId, session.id, time, session.hash, time, time, session.id, time, time).first();
    if (!saved) throw new ApiError('SHARE_NOT_ALLOWED_OR_FULL', 409);
    return privateJson({ id: share.id, profileId: value.profileId, connectionId: value.connectionId, title: value.title, createdAt: time, expiresAt: time + 86400 }, 201);
  } catch (error) {
    const response = privateJson({ error: error instanceof ApiError ? error.code : error instanceof z.ZodError ? 'SHARE_INVALID' : 'SHARING_FAILED' }, error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 503);
    if (response.status === 429) response.headers.set('Retry-After', '60');
    return response;
  }
}
