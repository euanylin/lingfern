import { expect, type BrowserContext, type Page } from '@playwright/test';
import { validateSyncBatch, type SyncBatch } from '../../src/shared/sync';
import type { LookupRecord } from '../../src/data/lookupHistory';

// Synthetic immutable provider shared by isolated browser devices; never fall through to real APIs.
export function autoSyncFixture() {
  const scope = { accountId: 1, profileId: 'local-guest', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  type Stored = Awaited<ReturnType<typeof validateSyncBatch>> & { blobSha: string };
  const records = new Map<string, Stored>(), snapshots = new Map<string, Stored[]>();
  let serial = 1, failures = 0, failCode = 'REPOSITORY_FAILED', lost = false;
  const commit = () => serial.toString(16).padStart(40, '0');
  const calls: string[] = [], uploads: SyncBatch[] = [];
  async function add(batch: SyncBatch) {
    const value = await validateSyncBatch(batch), key = `${batch.deviceId}/${batch.batchId}`;
    const prior = records.get(key);
    if (prior && prior.hash !== value.hash) throw new Error('SYNTHETIC_IMMUTABLE_CONFLICT');
    if (!prior) records.set(key, { ...value, blobSha: (++serial).toString(16).padStart(40, '0') });
  }
  async function attach(context: BrowserContext) {
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      calls.push(url.pathname);
      if (url.pathname === '/api/session') return route.fulfill({ json: summary });
      if (failures && url.pathname.startsWith('/api/sync/')) { failures--; return route.fulfill({ status: failCode === 'UNAUTHENTICATED' ? 401 : 503, json: { error: failCode } }); }
      if (url.pathname === '/api/sync/batches') {
        const value = request.postDataJSON();
        expect(value.scope).toEqual(scope); expect(request.headers()['x-csrf-token']).toBe(summary.csrfToken);
        const existed = records.has(`${value.batch.deviceId}/${value.batch.batchId}`);
        uploads.push(value.batch); await add(value.batch);
        if (lost) { lost = false; return route.fulfill({ status: 503, json: { error: 'SYNC_PENDING' } }); }
        return route.fulfill({ json: { scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: existed } });
      }
      if (url.pathname === '/api/sync/changes') {
        const query = url.searchParams;
        if (query.get('sinceCommit') === commit()) return route.fulfill({ json: { scope, commit: commit(), unchanged: true } });
        const cursor = query.get('cursor') ?? `${commit()}:0`;
        const [head, offsetText] = cursor.split(':'), offset = Number(offsetText);
        if (!query.has('cursor')) snapshots.set(head, [...records.values()]);
        const snapshot = snapshots.get(head);
        if (!snapshot) return route.fulfill({ status: 400, json: { error: 'SYNC_CURSOR_INVALID' } });
        const page = snapshot.slice(offset, offset + 10);
        const files = page.map(value => ({ deviceId: value.batch.deviceId, batchId: value.batch.batchId, blobSha: value.blobSha, bytes: value.bytes.length }));
        const known = JSON.parse(query.get('known') ?? '[]') as typeof files;
        return route.fulfill({ json: { scope, commit: head, cursor, total: snapshot.length, ...(offset + 10 < snapshot.length ? { nextCursor: `${head}:${offset + 10}` } : {}), files, batches: query.has('metadata') ? [] : page.filter(value => !known.some(file => file.deviceId === value.batch.deviceId && file.batchId === value.batch.batchId && file.blobSha === value.blobSha)).map(({ batch, hash, blobSha }) => ({ batch, hash, blobSha })) } });
      }
      return route.fulfill({ status: 404, json: { error: 'SYNTHETIC_API_NOT_FOUND' } });
    });
  }
  return { scope, summary, calls, uploads, records, add, attach, fail(count = 1, code = 'REPOSITORY_FAILED') { failures = count; failCode = code; }, loseAck() { lost = true; } };
}

export async function connectSync(page: Page) {
  await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async () => { const { settings } = await import('/src/data/db.ts' as string); await settings.put({ key: 'profile:local-guest:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'local-guest' }) }); });
}
export async function syncState(page: Page) {
  return page.evaluate(async () => { const { settings, syncClocks } = await import('/src/data/db.ts' as string); const key = `profile:local-guest:autoSync:1:local-guest:${'a'.repeat(43)}:`; const row = await settings.get(key + 'state'); return row ? { ...JSON.parse(row.value), currentRevision: (await syncClocks.get('local-guest'))?.localRevision ?? 0, requested: (await settings.get(key + 'request'))?.value } : undefined; });
}
export async function synced(page: Page) {
  try { await expect.poll(async () => { const state = await syncState(page); return { ...state, settled: state?.phase === 'synced' && state.localRevision === state.currentRevision && state.requestId === state.requested }; }).toMatchObject({ phase: 'synced', settled: true }); }
  catch (error) { throw new Error(`Synthetic sync state: ${JSON.stringify(await syncState(page))}`, { cause: error }); }
}
export async function lookup(page: Page, term: string, kind: 'dictionary' | 'grammar' | 'ipa' = 'dictionary') { await page.evaluate(async ({ term, kind }) => { const { recordLookup } = await import('/src/data/lookupHistory.ts' as string); await recordLookup('local-guest', kind, term); }, { term, kind }); }
export async function history(page: Page): Promise<LookupRecord[]> { return page.evaluate(async () => (await import('/src/data/lookupHistory.ts' as string)).readLookupHistory('local-guest')); }
export async function syncNow(page: Page) { await page.evaluate(async () => { const { readSyncConsent, requestSyncNow } = await import('/src/data/syncClient.ts' as string); const consent = await readSyncConsent('local-guest'); if (!consent) throw new Error('NO_SYNTHETIC_CONSENT'); await requestSyncNow('local-guest', consent.scope); }); }
