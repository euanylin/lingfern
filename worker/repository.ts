import { z } from 'zod';
import { bindRepositorySchema, inspectRepositorySchema, profileIdSchema, repositoryMarkerSchema, repositoryNameSchema } from '../src/shared/repository';
import { ApiError, boundedBody, digest, githubCredential, privateJson, randomSecret, requireSession, revokeAccount, syncEnabled, type AuthEnv, type WebSession } from './auth';
import { github } from './github';
import { syncUploadSchema, syncKnownFilesSchema, syncByteLimit, validateSyncBatch } from '../src/shared/sync';

const ownerSchema = z.object({ id: z.number().int().positive(), login: z.string().regex(/^[a-zA-Z0-9-]{1,39}$/), type: z.string() });
const installationSchema = z.object({ id: z.number().int().positive(), account: ownerSchema, repository_selection: z.enum(['all', 'selected']), permissions: z.record(z.string(), z.string()), suspended_at: z.string().nullable() });
const installationsSchema = z.object({ total_count: z.number().int().nonnegative(), installations: z.array(installationSchema).max(100) });
const repositorySchema = z.object({ id: z.number().int().positive(), name: repositoryNameSchema, owner: ownerSchema, private: z.boolean(), fork: z.boolean(), archived: z.boolean(), disabled: z.boolean(), default_branch: z.string().min(1).max(255), permissions: z.object({ push: z.boolean(), pull: z.boolean() }) });
const repositoriesSchema = z.object({ total_count: z.number().int().nonnegative(), repositories: z.array(repositorySchema).max(100) });
const shaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const treeSchema = z.object({ truncated: z.boolean(), tree: z.array(z.object({ path: z.string().max(200), mode: z.string(), type: z.enum(['blob', 'tree', 'commit']), sha: shaSchema, size: z.number().int().nonnegative().optional() })).max(10002) });
type InstallationState = { version: string; disabled: number };
type Intent = { hash: string; session_hash: string; account_id: number; profile_id: string; repository_id: number; installation_id: number; installation_version: string; repository_version: string; repository_name: string; expires_at: number };
const readyInstallation = (installation: z.infer<typeof installationSchema>, id: number) => installation.account.id === id && installation.account.type === 'User' && installation.repository_selection === 'selected' && !installation.suspended_at && installation.permissions.contents === 'write' && installation.permissions.metadata === 'read' && Object.keys(installation.permissions).every(key => ['contents', 'metadata'].includes(key));
const readyRepository = (repository: z.infer<typeof repositorySchema>, id: number) => repository.owner.id === id && repository.owner.type === 'User' && repository.private && !repository.fork && !repository.archived && !repository.disabled && repository.permissions.push && repository.permissions.pull;

async function installations(api: ReturnType<typeof github>, accountId: number) {
  const user = z.object({ id: z.number().int().positive() }).parse((await api('GET /user')).data);
  if (user.id !== accountId) throw new ApiError('ACCOUNT_CHANGED', 403);
  const result = installationsSchema.parse((await api('GET /user/installations', { per_page: 100 })).data);
  if (result.total_count > result.installations.length) throw new ApiError('REPOSITORY_CAPACITY', 413);
  return result.installations;
}
async function installedRepositories(api: ReturnType<typeof github>, installationId: number) {
  const result = repositoriesSchema.parse((await api('GET /user/installations/{installation_id}/repositories', { installation_id: installationId, per_page: 100 })).data);
  if (result.total_count > result.repositories.length) throw new ApiError('REPOSITORY_CAPACITY', 413);
  return result.repositories;
}
async function inspect(api: ReturnType<typeof github>, accountId: number, choice: z.infer<typeof inspectRepositorySchema>, fixedCommit?: string, sinceCommit?: string) {
  const installation = (await installations(api, accountId)).find(value => value.id === choice.installationId);
  if (!installation || !readyInstallation(installation, accountId)) throw new ApiError('INSTALLATION_SCOPE', 403);
  const selected = (await installedRepositories(api, installation.id)).find(value => value.id === choice.repositoryId && value.name === choice.name);
  if (!selected) throw new ApiError('REPOSITORY_ACCESS', 403);
  const repository = repositorySchema.parse((await api('GET /repos/{owner}/{repo}', { owner: installation.account.login, repo: selected.name })).data);
  if (repository.id !== selected.id || !readyRepository(repository, accountId)) throw new ApiError('REPOSITORY_UNSAFE', 409);
  const path = { owner: repository.owner.login, repo: repository.name };
  let commit: unknown;
  try { commit = (await api('GET /repos/{owner}/{repo}/commits/{ref}', { ...path, ref: fixedCommit ?? repository.default_branch })).data; }
  catch (error) { if (error && typeof error === 'object' && 'status' in error && error.status === 409) throw new ApiError('REPOSITORY_UNINITIALISED', 409); throw error; }
  const head = z.object({ sha: shaSchema, commit: z.object({ tree: z.object({ sha: shaSchema }) }) }).parse(commit);
  if (head.sha === sinceCommit) return { repository, existing: true, head: head.sha, tree: [] as z.infer<typeof treeSchema>['tree'], unchanged: true };
  const tree = treeSchema.parse((await api('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { ...path, tree_sha: head.commit.tree.sha, recursive: '1' })).data);
  if (tree.truncated || tree.tree.length > 10002 || tree.tree.reduce((size, entry) => size + (entry.size ?? 0), 0) > 20 * 1024 * 1024) throw new ApiError('REPOSITORY_CAPACITY', 413);
  const marker = tree.tree.find(entry => entry.path === 'profile.json');
  for (const entry of tree.tree) {
    const ordinary = ['README.md', 'README', '.gitignore', 'LICENSE', 'profile.json'].includes(entry.path);
    const record = /^records\/[\w-]{1,64}\/[\w-]{1,64}\.json$/.test(entry.path);
    const directory = entry.type === 'tree' && /^records(?:\/[\w-]{1,64})?$/.test(entry.path) && marker;
    if (directory && entry.mode === '040000') continue;
    if (entry.type !== 'blob' || entry.mode !== '100644' || (!ordinary && !(marker && record)) || entry.size === undefined || entry.size > (record ? 256000 : 65536)) throw new ApiError('REPOSITORY_NOT_DEDICATED', 409);
  }
  if (marker) {
    if (marker.size! > 1024) throw new ApiError('REPOSITORY_MARKER', 409);
    const blob = z.object({ encoding: z.literal('base64'), content: z.string().max(2048) }).parse((await api('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', { ...path, file_sha: marker.sha })).data);
    let profile: z.infer<typeof repositoryMarkerSchema>;
    try { profile = repositoryMarkerSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(blob.content.replaceAll('\n', '')), c => c.charCodeAt(0))))); }
    catch { throw new ApiError('REPOSITORY_MARKER', 409); }
    if (profile.profileId !== choice.profileId) throw new ApiError('PROFILE_MISMATCH', 409);
  }
  return { repository, existing: Boolean(marker), head: head.sha, tree: tree.tree };
}
async function input<T>(request: Request, schema: z.ZodType<T>, limit = 4096): Promise<T> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ApiError('CONTENT_TYPE', 415);
  try { return schema.parse(JSON.parse(new TextDecoder().decode(await boundedBody(request.body, limit)))); }
  catch (error) { if (error instanceof Error && error.message === 'BODY_SIZE') throw new ApiError('SYNC_CAPACITY', 413); throw new ApiError('REPOSITORY_INPUT', 400); }
}

const cursorSchema = z.object({ accountId: z.number().int().positive(), profileId: profileIdSchema, bindingVersion: z.string().regex(/^[\w-]{43}$/), installationVersion: z.string().min(1).max(64), repositoryVersion: z.string().min(1).max(64), commit: shaSchema, index: z.number().int().min(0).max(5000), expiresAt: z.number().int().positive() }).strict();
type Cursor = z.infer<typeof cursorSchema>;
async function cursorKey(secret: string) {
  return crypto.subtle.importKey('raw', Uint8Array.from(atob(secret), c => c.charCodeAt(0)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function sealCursor(value: Cursor, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('lingfern-sync-cursor-v1') }, await cursorKey(secret), new TextEncoder().encode(JSON.stringify(value))));
  return btoa(Array.from([...iv, ...encrypted], c => String.fromCharCode(c)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function openCursor(token: string, secret: string): Promise<Cursor> {
  try {
    if (!/^[\w-]{1,4096}$/.test(token)) throw new Error('format');
    const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode('lingfern-sync-cursor-v1') }, await cursorKey(secret), bytes.slice(12));
    const cursor = cursorSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)));
    if (cursor.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('expired');
    return cursor;
  } catch { throw new ApiError('SYNC_CURSOR_INVALID', 400); }
}
async function syncBinding(request: Request, env: AuthEnv, session: WebSession, profileId: string, encrypted: string) {
  const db = env.AUTH_DB!;
  const binding = await db.prepare('SELECT b.*,i.version AS installation_version,r.version AS repository_version FROM repository_bindings b JOIN installation_states i ON i.id=b.installation_id JOIN repository_states r ON r.id=b.repository_id WHERE b.account_id=? AND b.profile_id=? AND b.disabled=0 AND i.disabled=0').bind(session.id, profileId).first<{ repository_id: number; installation_id: number; repository_name: string; binding_version: string; installation_version: string; repository_version: string }>();
  if (!binding?.binding_version) throw new ApiError('SYNC_NOT_BOUND', 409);
  const allowed = async () => {
    await requireSession(request, env, request.method === 'POST');
    const current = await db.prepare('SELECT b.profile_id FROM repository_bindings b JOIN installation_states i ON i.id=b.installation_id JOIN repository_states r ON r.id=b.repository_id JOIN accounts a ON a.id=b.account_id WHERE b.account_id=? AND b.profile_id=? AND b.binding_version=? AND b.disabled=0 AND i.version=? AND i.disabled=0 AND r.version=? AND a.revoked=0 AND a.encrypted_tokens=?').bind(session.id, profileId, binding.binding_version, binding.installation_version, binding.repository_version, encrypted).first();
    if (!current) throw new ApiError('AUTHORISATION_CHANGED', 409);
  };
  return { binding, allowed };
}

export async function repositoryRoute(request: Request, env: AuthEnv): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!['/api/auth/setup', '/api/sync/repositories', '/api/sync/inspect', '/api/sync/bind', '/api/sync/disconnect', '/api/sync/batches', '/api/sync/changes'].includes(url.pathname)) return;
  const write = ['/api/sync/inspect', '/api/sync/bind', '/api/sync/disconnect', '/api/sync/batches'].includes(url.pathname);
  if (request.method !== (write ? 'POST' : 'GET')) return privateJson({ error: 'METHOD_NOT_ALLOWED' }, 405);
  let generation: { accountId: number; encrypted: string } | undefined;
  try {
    const session = await requireSession(request, env, write), db = env.AUTH_DB!, now = Math.floor(Date.now() / 1000);
    if (['/api/sync/changes', '/api/sync/batches'].includes(url.pathname) && !syncEnabled(env)) throw new ApiError('SYNC_UNAVAILABLE', 503);
    const key = await digest(`repository:${session.id}:${Math.floor(now / 60)}`);
    await db.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(now).run();
    const limit = await db.prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, now + 120).first<{ count: number }>();
    if (!limit || limit.count > 20) { const response = privateJson({ error: 'RATE_LIMITED' }, 429); response.headers.set('Retry-After', '60'); return response; }
    if (url.pathname === '/api/sync/disconnect') {
      const value = await input(request, z.object({ profileId: profileIdSchema, confirm: z.literal(true) }).strict());
      await db.batch([db.prepare('DELETE FROM repository_bindings WHERE account_id=? AND profile_id=?').bind(session.id, value.profileId), db.prepare('DELETE FROM binding_intents WHERE account_id=? AND profile_id=?').bind(session.id, value.profileId)]);
      return privateJson({ disconnected: true });
    }
    const credential = await githubCredential(env, session.id);
    generation = { accountId: session.id, encrypted: credential.encrypted };
    const api = github(credential.access);
    if (url.pathname === '/api/sync/changes') {
      if (url.search.length > 8192 || [...url.searchParams.keys()].some(key => !['profileId', 'cursor', 'metadata', 'known', 'sinceCommit'].includes(key)) || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)) throw new ApiError('REPOSITORY_INPUT', 400);
      const profile = profileIdSchema.safeParse(url.searchParams.get('profileId'));
      if (!profile.success) throw new ApiError('REPOSITORY_INPUT', 400);
      const metadata = url.searchParams.get('metadata');
      if (metadata !== null && metadata !== '1') throw new ApiError('REPOSITORY_INPUT', 400);
      const since = url.searchParams.get('sinceCommit');
      if (since !== null && (metadata !== '1' || url.searchParams.has('cursor') || !shaSchema.safeParse(since).success)) throw new ApiError('REPOSITORY_INPUT', 400);
      let known: z.infer<typeof syncKnownFilesSchema> = [];
      try { known = syncKnownFilesSchema.parse(JSON.parse(url.searchParams.get('known') ?? '[]')); } catch { throw new ApiError('REPOSITORY_INPUT', 400); }
      const cursor = url.searchParams.has('cursor') ? await openCursor(url.searchParams.get('cursor')!, env.TOKEN_ENCRYPTION_KEY!) : undefined;
      const { binding, allowed } = await syncBinding(request, env, session, profile.data, credential.encrypted);
      if (cursor && (cursor.accountId !== session.id || cursor.profileId !== profile.data || cursor.bindingVersion !== binding.binding_version || cursor.installationVersion !== binding.installation_version || cursor.repositoryVersion !== binding.repository_version)) throw new ApiError('SYNC_CURSOR_INVALID', 400);
      await allowed();
      const checked = await inspect(api, session.id, { installationId: binding.installation_id, repositoryId: binding.repository_id, name: binding.repository_name, profileId: profile.data }, cursor?.commit, since ?? undefined);
      if (checked.unchanged) {
        await allowed();
        return privateJson({ scope: { accountId: session.id, profileId: profile.data, bindingVersion: binding.binding_version }, commit: checked.head, unchanged: true });
      }
      if (!checked.existing || (cursor && checked.head !== cursor.commit)) throw new ApiError('SYNC_REMOTE_INVALID', 409);
      const records = checked.tree.filter(entry => /^records\/[^/]+\/[^/]+\.json$/.test(entry.path)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      if (records.length > 5000) throw new ApiError('REPOSITORY_CAPACITY', 413);
      const index = cursor?.index ?? 0;
      if (index > records.length) throw new ApiError('SYNC_CURSOR_INVALID', 400);
      const page = []; let size = 0;
      for (const entry of records.slice(index, index + 10)) { if (size + entry.size! > 2 * 1024 * 1024) break; page.push(entry); size += entry.size!; }
      const files = page.map(entry => { const [, deviceId, name] = entry.path.split('/'); return { deviceId, batchId: name.slice(0, -5), blobSha: entry.sha, bytes: entry.size! }; });
      const batches: { batch: z.infer<typeof syncUploadSchema>['batch']; hash: string; blobSha: string }[] = [];
      if (!metadata) {
        const missing = page.filter((_, position) => !known.some(item => item.deviceId === files[position].deviceId && item.batchId === files[position].batchId && item.blobSha === files[position].blobSha));
        // Fetch two blobs at once; never return partial-page cursors on failure.
        for (let offset = 0; offset < missing.length; offset += 2) {
          await allowed();
          const pair = await Promise.all(missing.slice(offset, offset + 2).map(async entry => {
            const blob = z.object({ encoding: z.literal('base64'), content: z.string().max(360000) }).parse((await api('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', { owner: checked.repository.owner.login, repo: checked.repository.name, file_sha: entry.sha })).data);
            try {
              const bytes = Uint8Array.from(atob(blob.content.replaceAll('\n', '')), c => c.charCodeAt(0));
              if (bytes.byteLength !== entry.size || bytes.byteLength > syncByteLimit) throw new Error('size');
              const payload = await validateSyncBatch(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
              const [ , deviceId, name ] = entry.path.split('/');
              if (payload.batch.profileId !== profile.data || payload.batch.deviceId !== deviceId || payload.batch.batchId !== name.slice(0, -5)) throw new Error('ownership');
              return { batch: payload.batch, hash: payload.hash, blobSha: entry.sha };
            } catch { throw new ApiError('SYNC_REMOTE_INVALID', 409); }
          }));
          batches.push(...pair);
        }
      }
      await allowed();
      const state: Cursor = cursor ?? { accountId: session.id, profileId: profile.data, bindingVersion: binding.binding_version, installationVersion: binding.installation_version, repositoryVersion: binding.repository_version, commit: checked.head, index, expiresAt: now + 3600 };
      const nextIndex = index + page.length;
      return privateJson({ scope: { accountId: session.id, profileId: profile.data, bindingVersion: binding.binding_version }, commit: checked.head, cursor: url.searchParams.get('cursor') ?? await sealCursor(state, env.TOKEN_ENCRYPTION_KEY!), ...(nextIndex < records.length ? { nextCursor: await sealCursor({ ...state, index: nextIndex }, env.TOKEN_ENCRYPTION_KEY!) } : {}), total: records.length, files, batches });
    }
    if (url.pathname === '/api/sync/batches') {
      const value = await input(request, syncUploadSchema, syncByteLimit + 4096);
      let payload: Awaited<ReturnType<typeof validateSyncBatch>>;
      try { payload = await validateSyncBatch(value.batch); } catch { throw new ApiError('SYNC_CAPACITY', 413); }
      if (payload.hash !== value.hash) throw new ApiError('SYNC_INTEGRITY', 400);
      const { binding, allowed } = await syncBinding(request, env, session, payload.batch.profileId, credential.encrypted);
      if (value.scope.accountId !== session.id || value.scope.profileId !== payload.batch.profileId || value.scope.bindingVersion !== binding.binding_version) throw new ApiError('AUTHORISATION_CHANGED', 409);
      const file = `records/${payload.batch.deviceId}/${payload.batch.batchId}.json`;
      const readExisting = async (checked: Awaited<ReturnType<typeof inspect>>) => {
        const entry = checked.tree.find(entry => entry.path === file);
        if (!entry) return false;
        const blob = z.object({ encoding: z.literal('base64'), content: z.string().max(360000) }).parse((await api('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', { owner: checked.repository.owner.login, repo: checked.repository.name, file_sha: entry.sha })).data);
        try {
          const bytes = Uint8Array.from(atob(blob.content.replaceAll('\n', '')), char => char.charCodeAt(0));
          if (bytes.byteLength > syncByteLimit) throw new Error('size');
          const existing = await validateSyncBatch(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
          if (existing.hash !== payload.hash) throw new ApiError('SYNC_BATCH_CONFLICT', 409);
        } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('SYNC_REMOTE_INVALID', 409); }
        return true;
      };
      // Attempt once plus three retries without overwriting existing paths.
      for (let attempt = 0; attempt <= 3; attempt++) {
        await allowed();
        const checked = await inspect(api, session.id, { installationId: binding.installation_id, repositoryId: binding.repository_id, name: binding.repository_name, profileId: payload.batch.profileId });
        if (!checked.existing) throw new ApiError('REPOSITORY_MARKER', 409);
        if (await readExisting(checked)) { await allowed(); return privateJson({ scope: value.scope, batchId: payload.batch.batchId, hash: payload.hash, previouslyWritten: true }); }
        if (checked.tree.filter(entry => /^records\/[^/]+\/[^/]+\.json$/.test(entry.path)).length >= 5000 || checked.tree.reduce((size, entry) => size + (entry.size ?? 0), 0) + payload.bytes.byteLength > 20 * 1024 * 1024) throw new ApiError('REPOSITORY_CAPACITY', 413);
        await allowed();
        try {
          const written = await api('PUT /repos/{owner}/{repo}/contents/{path}', { owner: checked.repository.owner.login, repo: checked.repository.name, path: file, branch: checked.repository.default_branch, message: 'Save Lingfern structured batch', content: btoa(Array.from(payload.bytes, byte => String.fromCharCode(byte)).join('')) });
          const created = z.object({ content: z.object({ sha: shaSchema }) }).parse(written.data);
          await readExisting({ ...checked, tree: [...checked.tree, { path: file, mode: '100644', type: 'blob', sha: created.content.sha, size: payload.bytes.byteLength }] });
          await allowed();
          return privateJson({ scope: value.scope, batchId: payload.batch.batchId, hash: payload.hash, previouslyWritten: false });
        } catch (error) {
          const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
          if (status !== 409 && status !== 422) throw error;
          if (attempt === 3) throw new ApiError('SYNC_PENDING', 409);
          // Respect 422 retry timing for races/rate limits; defer long waits to later client rounds.

          const headers = error && typeof error === 'object' && 'response' in error ? (error.response as { headers?: Record<string, string> })?.headers : undefined;
          const retry = Number(headers?.['retry-after'] ?? 0);
          const reset = headers?.['x-ratelimit-remaining'] === '0' ? Math.max(0, Number(headers['x-ratelimit-reset']) * 1000 - Date.now()) : 0;
          const wait = Math.max(retry * 1000, reset, 200 * 2 ** attempt + Math.random() * 200);
          if (!Number.isFinite(wait) || wait > 2000) { const response = privateJson({ error: 'SYNC_RATE_LIMITED' }, 429); response.headers.set('Retry-After', String(Number.isFinite(wait) ? Math.max(1, Math.ceil(wait / 1000)) : 60)); return response; }
          await new Promise(resolve => setTimeout(resolve, wait));
        }
      }
    }
    if (url.pathname === '/api/auth/setup' || url.pathname === '/api/sync/repositories') {
      const list = await installations(api, session.id);
      if (url.pathname === '/api/auth/setup') {
        const parsed = z.coerce.number().int().positive().safe().safeParse(url.searchParams.get('installation_id'));
        if (!parsed.success) throw new ApiError('REPOSITORY_INPUT', 400);
        const id = parsed.data;
        if (!list.some(installation => installation.id === id && readyInstallation(installation, session.id))) throw new ApiError('INSTALLATION_SCOPE', 403);
        return new Response(null, { status: 303, headers: { ...Object.fromEntries(privateJson(null).headers), Location: '/settings' } });
      }
      const repositories = [];
      const personal = list.filter(installation => readyInstallation(installation, session.id));
      if (personal.length > 1) throw new ApiError('GITHUB_RESPONSE', 502);
      for (const installation of personal) {
        // Personal ownership limits this App to one relevant installation.
        for (const repository of await installedRepositories(api, installation.id)) if (readyRepository(repository, session.id)) repositories.push({ installationId: installation.id, repositoryId: repository.id, name: repository.name });
      }
      if (repositories.length > 100) throw new ApiError('REPOSITORY_CAPACITY', 413);
      const slug = env.GITHUB_APP_SLUG && /^[a-z0-9-]+$/.test(env.GITHUB_APP_SLUG) ? env.GITHUB_APP_SLUG : undefined;
      return privateJson({ repositories, ...(slug ? { installationUrl: `https://github.com/apps/${slug}/installations/new` } : {}) });
    }
    if (url.pathname === '/api/sync/inspect') {
      const choice = await input(request, inspectRepositorySchema);
      const before = await db.prepare('SELECT version,disabled FROM installation_states WHERE id=?').bind(choice.installationId).first<InstallationState>();
      const repositoryBefore = await db.prepare('SELECT version FROM repository_states WHERE id=?').bind(choice.repositoryId).first<{ version: string }>();
      const repositoryVersion = repositoryBefore?.version ?? randomSecret();
      const checked = await inspect(api, session.id, choice);
      const version = before?.version ?? randomSecret();
      // Let revocation during inspection override verification.
      const state = await db.prepare('INSERT INTO installation_states(id,version,disabled) VALUES(?,?,0) ON CONFLICT(id) DO UPDATE SET disabled=0 WHERE version=? RETURNING version').bind(choice.installationId, version, before?.version ?? '').first<{ version: string }>();
      if (!state) throw new ApiError('AUTHORISATION_CHANGED', 409);
      await db.prepare('INSERT OR IGNORE INTO repository_states(id,version) VALUES(?,?)').bind(choice.repositoryId, repositoryVersion).run();
      const other = await db.prepare('SELECT profile_id,account_id FROM repository_bindings WHERE repository_id=?').bind(choice.repositoryId).first<{ profile_id: string; account_id: number }>();
      if (other && (other.profile_id !== choice.profileId || other.account_id !== session.id)) throw new ApiError('PROFILE_MISMATCH', 409);
      const intent = randomSecret(), expiresAt = now + 300;
      await db.prepare('DELETE FROM binding_intents WHERE expires_at<?').bind(now).run();
      const staged = await db.prepare('INSERT INTO binding_intents(hash,session_hash,account_id,profile_id,repository_id,installation_id,installation_version,repository_name,expires_at,repository_version) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM repository_states WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM installation_states WHERE id=? AND version=? AND disabled=0) RETURNING hash').bind(await digest(intent), session.hash, session.id, choice.profileId, choice.repositoryId, choice.installationId, state.version, choice.name, expiresAt, repositoryVersion, choice.repositoryId, repositoryVersion, choice.installationId, state.version).first();
      if (!staged) throw new ApiError('AUTHORISATION_CHANGED', 409);
      return privateJson({ intent, name: choice.name, owner: checked.repository.owner.login, profileId: choice.profileId, existing: checked.existing, expiresAt });
    }
    const value = await input(request, bindRepositorySchema);
    const intent = await db.prepare('UPDATE binding_intents SET consumed=1 WHERE hash=? AND session_hash=? AND account_id=? AND expires_at>? AND consumed=0 RETURNING *').bind(await digest(value.intent), session.hash, session.id, now).first<Intent>();
    if (!intent) throw new ApiError('BINDING_EXPIRED', 409);
    const state = await db.prepare('SELECT version,disabled FROM installation_states WHERE id=?').bind(intent.installation_id).first<InstallationState>();
    if (!state || state.disabled || state.version !== intent.installation_version) throw new ApiError('AUTHORISATION_CHANGED', 409);
    const checked = await inspect(api, session.id, { installationId: intent.installation_id, repositoryId: intent.repository_id, name: intent.repository_name, profileId: intent.profile_id });
    const path = { owner: checked.repository.owner.login, repo: checked.repository.name };
    if (!checked.existing) {
      const current = repositorySchema.parse((await api('GET /repos/{owner}/{repo}', path)).data);
      if (current.id !== intent.repository_id || !readyRepository(current, session.id)) throw new ApiError('REPOSITORY_UNSAFE', 409);
      const stillAllowed = await db.prepare('SELECT hash FROM binding_intents WHERE hash=? AND consumed=1 AND expires_at>unixepoch() AND EXISTS(SELECT 1 FROM installation_states WHERE id=? AND version=? AND disabled=0) AND EXISTS(SELECT 1 FROM repository_states WHERE id=? AND version=?)').bind(intent.hash, intent.installation_id, intent.installation_version, intent.repository_id, intent.repository_version).first();
      if (!stillAllowed || !await requireSession(request, env, true)) throw new ApiError('AUTHORISATION_CHANGED', 409);
      await api('PUT /repos/{owner}/{repo}/contents/{path}', { ...path, path: 'profile.json', branch: checked.repository.default_branch, message: 'Initialise Lingfern profile marker', content: btoa(JSON.stringify({ product: 'Lingfern', formatVersion: 1, profileId: intent.profile_id })) });
      // Omit sha so existing markers cannot be overwritten, even in races.
      await inspect(api, session.id, { installationId: intent.installation_id, repositoryId: intent.repository_id, name: intent.repository_name, profileId: intent.profile_id });
    }
    const bindingVersion = randomSecret();
    const saved = await db.prepare('INSERT INTO repository_bindings(account_id,profile_id,repository_id,installation_id,owner_login,repository_name,branch,updated_at,binding_version) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM installation_states WHERE id=? AND version=? AND disabled=0) AND EXISTS(SELECT 1 FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE sessions.hash=? AND accounts.revoked=0 AND sessions.expires_at>unixepoch() AND sessions.absolute_expires_at>unixepoch()) AND EXISTS(SELECT 1 FROM binding_intents WHERE hash=? AND consumed=1 AND expires_at>unixepoch()) AND EXISTS(SELECT 1 FROM repository_states WHERE id=? AND version=?) ON CONFLICT(account_id,profile_id) DO UPDATE SET repository_id=excluded.repository_id,installation_id=excluded.installation_id,owner_login=excluded.owner_login,repository_name=excluded.repository_name,branch=excluded.branch,disabled=0,updated_at=excluded.updated_at,binding_version=excluded.binding_version RETURNING profile_id').bind(session.id, intent.profile_id, intent.repository_id, intent.installation_id, checked.repository.owner.login, checked.repository.name, checked.repository.default_branch, now, bindingVersion, intent.installation_id, intent.installation_version, session.hash, intent.hash, intent.repository_id, intent.repository_version).first();
    if (!saved) throw new ApiError('AUTHORISATION_CHANGED', 409);
    return privateJson({ binding: { name: checked.repository.name, owner: checked.repository.owner.login, profileId: intent.profile_id, disabled: false, bindingVersion }, syncAvailable: syncEnabled(env) });
  } catch (error) {
    if (error instanceof ApiError) return privateJson({ error: error.code }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return privateJson({ error: 'GITHUB_RESPONSE' }, 502);
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    if (status === 401 && generation && env.AUTH_DB) {
      try { await revokeAccount(env.AUTH_DB, generation.accountId, generation.encrypted); }
      catch { return privateJson({ error: 'AUTH_UNAVAILABLE' }, 503); }
    }
    const upstreamHeaders = error && typeof error === 'object' && 'response' in error ? (error.response as { headers?: Record<string, string> })?.headers : undefined;
    if (status === 429 || (status === 403 && (upstreamHeaders?.['retry-after'] || upstreamHeaders?.['x-ratelimit-remaining'] === '0'))) { const response = privateJson({ error: 'SYNC_RATE_LIMITED' }, 429); const retry = Number(upstreamHeaders?.['retry-after'] ?? 60); const reset = upstreamHeaders?.['x-ratelimit-remaining'] === '0' ? Number(upstreamHeaders['x-ratelimit-reset']) - Date.now() / 1000 : 0; response.headers.set('Retry-After', String(Math.ceil(Math.max(1, Number.isFinite(retry) ? retry : 60, Number.isFinite(reset) ? reset : 60)))); return response; }
    if (status === 401 || status === 403) return privateJson({ error: 'GITHUB_PERMISSION' }, 403);
    if (status === 404 || status === 409 || status === 422) return privateJson({ error: 'REPOSITORY_UNAVAILABLE' }, 409);
    return privateJson({ error: 'REPOSITORY_FAILED' }, 503);
  }
}
