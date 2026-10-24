import { createMcpHandler, McpServer, type AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { levelSchema } from '../src/shared/content';
import { listSharesSchema, shareIdSchema } from '../src/shared/sharing';
import { ApiError, privateJson } from './auth';
import { listSharedContexts, readSharedContext, sharingLimit, type SharingEnv } from './sharing';

const identitySchema = z.object({ accountId: z.number().int().positive(), connectionId: shareIdSchema }).strict();
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const searchMaterialsSchema = z.object({ keywords: z.string().trim().min(1).max(160), level: levelSchema.optional(), skill: z.enum(['reading', 'listening']).optional() }).strict();
const practiceTemplateSchema = z.object({ goalId: z.string().min(1).max(80), level: levelSchema }).strict();
export type TeachingSummary = { id: string; title: string; goal: string; goalId: string; level: z.infer<typeof levelSchema>; skill: 'reading' | 'listening'; reviewStatus: 'draft' | 'approved' };

async function authorize(env: SharingEnv, auth: AuthInfo | undefined, permission?: 'contexts' | 'materials') {
  if (!auth || !auth.token || !auth.clientId || !auth.scopes.includes('mcp:read') || auth.expiresAt === undefined || auth.expiresAt <= Date.now() / 1000) throw new ApiError('MCP_UNAUTHORIZED', 401);
  if (auth.resource?.href !== `${env.LOCAL_AUTH === 'true' ? 'http://127.0.0.1:8787' : 'https://lingfern.com'}/mcp`) throw new ApiError('MCP_UNAUTHORIZED', 401);
  const identity = identitySchema.parse(auth.extra);
  if (!env.AUTH_DB || !env.SHARE_ENCRYPTION_KEY) throw new ApiError('SHARING_NOT_CONFIGURED', 503);
  const connection = await env.AUTH_DB.withSession('first-primary').prepare('SELECT c.contexts_read,c.materials_read FROM mcp_connections c JOIN accounts a ON a.id=c.account_id WHERE c.id=? AND c.account_id=? AND c.client_id=? AND c.revoked=0 AND c.expires_at>? AND a.revoked=0').bind(identity.connectionId, identity.accountId, auth.clientId, Math.floor(Date.now() / 1000)).first<{ contexts_read: number; materials_read: number }>();
  if (!connection) throw new ApiError('MCP_UNAUTHORIZED', 401);
  if (permission && (!auth.scopes.includes(`${permission}:read`) || !connection[`${permission}_read`])) throw new ApiError('MCP_SCOPE', 403);
  return identity;
}

// Require authInfo from the OAuth Provider's protected handler.
// Project catalogue entries from public teaching data, never check banks.
export async function mcpFetch(request: Request, env: SharingEnv, auth: AuthInfo, catalogue: readonly TeachingSummary[]) {
  try {
    if (request.url !== `${env.LOCAL_AUTH === 'true' ? 'http://127.0.0.1:8787' : 'https://lingfern.com'}/mcp`) return privateJson({ error: 'NOT_AVAILABLE' }, 404);
    await authorize(env, auth);
    const handler = createMcpHandler(({ authInfo }) => {
      const server = new McpServer({ name: 'Lingfern', version: '0.1.106' });
      const tool = async (permission: 'contexts' | 'materials', read: (accountId: number, clientId: string, connectionId: string) => Promise<Record<string, unknown>>, limit = false) => {
        try {
          const identity = await authorize(env, authInfo, permission);
          if (limit) await sharingLimit(env.AUTH_DB!.withSession('first-primary'), identity.accountId);
          const value = await read(identity.accountId, authInfo!.clientId, identity.connectionId);
          await authorize(env, authInfo, permission);
          return { structuredContent: value, content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
        } catch (error) { return { isError: true, ...(error instanceof ApiError && error.status === 403 ? { _meta: { 'mcp/www_authenticate': [`Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource/mcp', request.url)}", error="insufficient_scope", scope="mcp:read ${permission}:read"`] } } : {}), content: [{ type: 'text' as const, text: error instanceof ApiError ? error.message : 'MCP_READ_FAILED' }] }; }
      };
      const sharedUrl = `${env.LOCAL_AUTH === 'true' ? 'http://127.0.0.1:8787' : 'https://lingfern.com'}/settings#mcp`;
      server.registerTool('search', { description: 'Search titles of unexpired learning contexts explicitly shared with this client. Use fetch to read a result; this never searches the full learning history.', inputSchema: z.object({ query: z.string().trim().max(160) }).strict(), annotations }, input => tool('contexts', async (accountId, clientId, connectionId) => {
        const { contexts } = await listSharedContexts(env, accountId, clientId, connectionId, { count: 20 });
        const words = input.query.toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
        return { results: contexts.filter(item => words.every(word => item.title.toLocaleLowerCase('en').includes(word))).map(item => ({ id: item.id, title: item.title, url: sharedUrl })) };
      }));
      server.registerTool('fetch', { description: 'Read a context returned by search. Requires an explicit, unexpired share for this client. The URL opens authenticated sharing settings, not a public copy.', inputSchema: z.object({ id: shareIdSchema }).strict(), annotations }, input => tool('contexts', async (accountId, clientId, connectionId) => {
        const value = await readSharedContext(env, accountId, clientId, connectionId, input.id);
        return { id: value.id, title: value.title, text: value.text, url: sharedUrl, metadata: { createdAt: value.createdAt, expiresAt: value.expiresAt } };
      }));
      server.registerTool('list_shared_contexts', { description: 'List learning contexts explicitly shared with this client, without full text.', inputSchema: listSharesSchema, annotations }, input => tool('contexts', (accountId, clientId, connectionId) => listSharedContexts(env, accountId, clientId, connectionId, input)));
      server.registerTool('read_shared_context', { description: 'Read one explicitly shared, unexpired learning context.', inputSchema: z.object({ id: shareIdSchema }).strict(), annotations }, input => tool('contexts', (accountId, clientId, connectionId) => readSharedContext(env, accountId, clientId, connectionId, input.id)));
      server.registerTool('search_materials', { description: 'Search public teaching catalogue summaries; drafts are identified, and check banks are excluded.', inputSchema: searchMaterialsSchema, annotations }, input => tool('materials', async () => ({ materials: catalogue.filter(item => (!input.level || item.level === input.level) && (!input.skill || item.skill === input.skill) && input.keywords.toLocaleLowerCase('en').split(/\s+/).every(word => `${item.title} ${item.goal}`.toLocaleLowerCase('en').includes(word))).slice(0, 10) }), true));
      server.registerTool('get_practice_template', { description: 'Obtain a reviewed practice structure, or an explicit unavailable result. Does not generate validated items.', inputSchema: practiceTemplateSchema, annotations }, () => tool('materials', async () => ({ available: false, reason: 'NO_REVIEWED_TEMPLATE' }), true));
      return server;
    }, { legacy: 'stateless', responseMode: 'json', maxRequestBodySize: 65536, maxSubscriptions: 0, keepAliveMs: 0 });
    try {
      const response = await handler.fetch(request, { authInfo: auth });
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store'); headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Referrer-Policy', 'no-referrer');
      return new Response(response.body, { status: response.status, headers });
    } finally { await handler.close(); }
  } catch (error) {
    const response = privateJson({ error: error instanceof ApiError ? error.message : 'MCP_UNAUTHORIZED' }, error instanceof ApiError ? error.status : 401);
    if (response.status === 401) response.headers.set('WWW-Authenticate', `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource/mcp', request.url)}", error="invalid_token"`);
    return response;
  }
}
