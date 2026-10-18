import { z } from 'zod';
import { boundedBody, digest, privateJson, randomSecret, type AuthEnv } from './auth';

export async function webhookRoute(request: Request, env: AuthEnv): Promise<Response | undefined> {
  if (new URL(request.url).pathname !== '/api/auth/webhook') return;
  if (request.method !== 'POST') return privateJson({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!env.AUTH_DB || !env.GITHUB_WEBHOOK_SECRET) return privateJson({ error: 'WEBHOOK_NOT_CONFIGURED' }, 503);
  const signature = request.headers.get('X-Hub-Signature-256') ?? '';
  const delivery = request.headers.get('X-GitHub-Delivery') ?? '';
  if (!/^sha256=[a-f0-9]{64}$/.test(signature) || !/^[a-f0-9-]{36}$/i.test(delivery)) return privateJson({ error: 'WEBHOOK_SIGNATURE' }, 401);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return privateJson({ error: 'CONTENT_TYPE' }, 415);
  try {
    const raw = await boundedBody(request.body, 262144);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signed = Uint8Array.from(signature.slice(7).match(/../g)!, byte => parseInt(byte, 16));
    if (!await crypto.subtle.verify('HMAC', key, signed, raw)) return privateJson({ error: 'WEBHOOK_SIGNATURE' }, 401);
    const kind = request.headers.get('X-GitHub-Event');
    const rawEvent: unknown = JSON.parse(new TextDecoder().decode(raw));
    const hash = await digest(raw), db = env.AUTH_DB;
    const guard = 'EXISTS(SELECT 1 FROM webhook_deliveries WHERE id=? AND body_hash=? AND applied=0)';
    const changes: D1PreparedStatement[] = [];
    if (kind === 'github_app_authorization') {
      const event = z.object({ action: z.literal('revoked'), sender: z.object({ id: z.number().int().positive() }) }).parse(rawEvent);
      changes.push(
        db.prepare(`DELETE FROM shared_contexts WHERE account_id=? AND ${guard}`).bind(event.sender.id, delivery, hash),
        db.prepare(`UPDATE mcp_connections SET revoked=1 WHERE account_id=? AND ${guard}`).bind(event.sender.id, delivery, hash),
        db.prepare(`UPDATE accounts SET revoked=1,encrypted_tokens='',refresh_lease=NULL,refresh_until=0 WHERE id=? AND ${guard}`).bind(event.sender.id, delivery, hash),
        db.prepare(`DELETE FROM sessions WHERE account_id=? AND ${guard}`).bind(event.sender.id, delivery, hash),
        db.prepare(`UPDATE repository_bindings SET disabled=1 WHERE account_id=? AND ${guard}`).bind(event.sender.id, delivery, hash),
        db.prepare(`DELETE FROM binding_intents WHERE account_id=? AND ${guard}`).bind(event.sender.id, delivery, hash),
      );
    } else if (kind === 'installation') {
      const event = z.object({ action: z.string(), installation: z.object({ id: z.number().int().positive() }) }).parse(rawEvent);
      if (!['deleted', 'suspend', 'created', 'unsuspend', 'new_permissions_accepted'].includes(event.action)) return privateJson({ accepted: true, applied: false }, 202);
      const disabled = ['deleted', 'suspend'].includes(event.action) ? 1 : 0;
      const accounts = '(SELECT account_id FROM repository_bindings WHERE installation_id=? UNION SELECT account_id FROM binding_intents WHERE installation_id=?)';
      changes.push(db.prepare(`INSERT INTO installation_states(id,version,disabled) SELECT ?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET version=excluded.version,disabled=excluded.disabled`).bind(event.installation.id, randomSecret(), disabled, delivery, hash));
      if (disabled) changes.push(
        db.prepare(`DELETE FROM shared_contexts WHERE account_id IN ${accounts} AND ${guard}`).bind(event.installation.id, event.installation.id, delivery, hash),
        db.prepare(`UPDATE mcp_connections SET revoked=1 WHERE account_id IN ${accounts} AND ${guard}`).bind(event.installation.id, event.installation.id, delivery, hash),
        db.prepare(`UPDATE accounts SET revoked=1,encrypted_tokens='',refresh_lease=NULL,refresh_until=0 WHERE id IN ${accounts} AND ${guard}`).bind(event.installation.id, event.installation.id, delivery, hash),
        db.prepare(`DELETE FROM sessions WHERE account_id IN ${accounts} AND ${guard}`).bind(event.installation.id, event.installation.id, delivery, hash),
      );
      changes.push(
        db.prepare(`UPDATE repository_bindings SET disabled=1 WHERE installation_id=? AND ${guard}`).bind(event.installation.id, delivery, hash),
        db.prepare(`DELETE FROM binding_intents WHERE installation_id=? AND ${guard}`).bind(event.installation.id, delivery, hash),
      );
    } else if (kind === 'installation_repositories') {
      const event = z.object({ action: z.string(), installation: z.object({ id: z.number().int().positive() }) }).parse(rawEvent);
      // Any selection change requires fresh inspection, without automatically disabling identity.
      changes.push(
        db.prepare(`INSERT INTO installation_states(id,version,disabled) SELECT ?,?,0 WHERE ${guard} ON CONFLICT(id) DO UPDATE SET version=excluded.version`).bind(event.installation.id, randomSecret(), delivery, hash),
        db.prepare(`UPDATE repository_bindings SET disabled=1 WHERE installation_id=? AND ${guard}`).bind(event.installation.id, delivery, hash),
        db.prepare(`DELETE FROM binding_intents WHERE installation_id=? AND ${guard}`).bind(event.installation.id, delivery, hash),
      );
    } else if (kind === 'repository') {
      const event = z.object({ action: z.string(), repository: z.object({ id: z.number().int().positive() }) }).parse(rawEvent);
      if (!['publicized', 'privatized', 'transferred', 'deleted', 'archived', 'unarchived', 'renamed'].includes(event.action)) return privateJson({ accepted: true, applied: false }, 202);
      changes.push(
        db.prepare(`INSERT INTO repository_states(id,version) SELECT ?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET version=excluded.version`).bind(event.repository.id, randomSecret(), delivery, hash),
        db.prepare(`UPDATE repository_bindings SET disabled=1 WHERE repository_id=? AND ${guard}`).bind(event.repository.id, delivery, hash),
        db.prepare(`DELETE FROM binding_intents WHERE repository_id=? AND ${guard}`).bind(event.repository.id, delivery, hash),
      );
    } else return privateJson({ accepted: true, applied: false }, 202);
    // Receipt and invalidation commit together; a duplicate cannot revoke a later login.
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO webhook_deliveries(id,body_hash,received_at) VALUES(?,?,?)').bind(delivery, hash, Math.floor(Date.now() / 1000)),
      ...changes,
      db.prepare('UPDATE webhook_deliveries SET applied=1 WHERE id=? AND body_hash=?').bind(delivery, hash),
    ]);
    const receipt = await db.prepare('SELECT body_hash FROM webhook_deliveries WHERE id=?').bind(delivery).first<{ body_hash: string }>();
    return receipt?.body_hash === hash ? privateJson({ accepted: true }, 202) : privateJson({ error: 'WEBHOOK_DELIVERY_CONFLICT' }, 409);
  } catch (error) {
    if (error instanceof Error && error.message === 'BODY_SIZE') return privateJson({ error: 'BODY_SIZE' }, 413);
    return error instanceof z.ZodError || error instanceof SyntaxError ? privateJson({ error: 'WEBHOOK_INVALID' }, 400) : privateJson({ error: 'WEBHOOK_UNAVAILABLE' }, 503);
  }
}
