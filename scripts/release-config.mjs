import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function checkReleaseConfig(config) {
  assert.equal(config.name, 'lingfern');
  assert.equal(config.workers_dev, false); assert.equal(config.preview_urls, false);
  assert(!config.vars?.LOCAL_AUTH, 'LOCAL_AUTH must never reach production');
  if (config.env?.local) assert.deepEqual(config.env.local.routes, [], 'Local environment must not inherit production domain routes');
  assert.equal(config.vars?.SYNC_ENABLED, 'true', 'First launch requires accepted and enabled sync');
  assert(/^(?!REQUIRES_APPROVAL$)[A-Za-z0-9_.-]{3,100}$/.test(config.vars?.GITHUB_CLIENT_ID ?? ''), 'Actual App client ID required');
  assert(!Object.keys(config.vars ?? {}).some(name => /SECRET|ENCRYPTION_KEY|TOKEN/.test(name)), 'Secrets must use protected Worker secrets');
  const db=config.d1_databases?.find(item=>item.binding==='AUTH_DB'), kv=config.kv_namespaces?.find(item=>item.binding==='OAUTH_KV');
  assert(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(db?.database_id ?? '') && /[1-9a-f]/.test(db.database_id), 'Actual D1 ID required');
  assert.equal(db.migrations_dir,'worker/migrations');
  assert(/^[a-f0-9]{32}$/.test(kv?.id ?? '') && /[1-9a-f]/.test(kv.id), 'Separate actual OAuth KV required');
  assert.equal(config.assets?.not_found_handling,'none'); assert(Array.isArray(config.assets.run_worker_first) && !config.assets.run_worker_first.includes('/*'));
}
export function ciDeploymentConfig(config, root) {
  checkReleaseConfig(config);
  const result = structuredClone(config);
  // Domain ownership is configured separately; routine CI only updates the existing Worker.
  delete result.routes; delete result.env;
  result.main = path.resolve(root, result.main);
  result.assets.directory = path.resolve(root, result.assets.directory);
  result.d1_databases = result.d1_databases.map(db => ({ ...db, migrations_dir: path.resolve(root, db.migrations_dir) }));
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const config = JSON.parse(await readFile('wrangler.jsonc','utf8'));
  checkReleaseConfig(config);
  if (process.argv[2] === '--ci') {
    assert(process.argv.length === 4 && path.isAbsolute(process.argv[3]), 'Provide one new absolute temporary configuration path');
    await writeFile(process.argv[3], JSON.stringify(ciDeploymentConfig(config, process.cwd()), null, 2) + '\n', { flag: 'wx' });
  } else assert(process.argv.length === 2, 'Unknown release-config arguments');
  console.log('Production configuration guard passed; real acceptance and deployment approval remain separate.');
}
