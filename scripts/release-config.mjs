import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function checkReleaseConfig(config) {
  assert.equal(config.name, 'lingfern');
  assert.equal(config.workers_dev, false); assert.equal(config.preview_urls, false);
  assert(!config.vars?.LOCAL_AUTH, 'LOCAL_AUTH must never reach production');
  assert.equal(config.vars?.SYNC_ENABLED, 'true', 'First launch requires accepted and enabled sync');
  assert(/^(?!REQUIRES_APPROVAL$)[A-Za-z0-9_.-]{3,100}$/.test(config.vars?.GITHUB_CLIENT_ID ?? ''), 'Actual App client ID required');
  assert(!Object.keys(config.vars ?? {}).some(name => /SECRET|ENCRYPTION_KEY|TOKEN/.test(name)), 'Secrets must use protected Worker secrets');
  const db=config.d1_databases?.find(item=>item.binding==='AUTH_DB'), kv=config.kv_namespaces?.find(item=>item.binding==='OAUTH_KV');
  assert(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(db?.database_id ?? '') && /[1-9a-f]/.test(db.database_id), 'Actual D1 ID required');
  assert.equal(db.migrations_dir,'worker/migrations');
  assert(/^[a-f0-9]{32}$/.test(kv?.id ?? '') && /[1-9a-f]/.test(kv.id), 'Separate actual OAuth KV required');
  assert.equal(config.assets?.not_found_handling,'none'); assert(Array.isArray(config.assets.run_worker_first) && !config.assets.run_worker_first.includes('/*'));
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  checkReleaseConfig(JSON.parse(await readFile('wrangler.jsonc','utf8')));
  console.log('Production configuration guard passed; real acceptance and deployment approval remain separate.');
}
