import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowed } from '../scripts/release-files.mjs';

test('publication allowlist excludes original/private/credential/diagnostic paths without deleting them', () => {
  for (const file of ['LICENSES/private.key', 'LICENSES/unlisted.txt', 'private/a.json', 'backup/a.json', 'content/corpus/raw/pg1.txt', 'content/corpus/additional/raw/a.html', '.env', '.dev.vars.local', 'worker/key.pem', 'public/a.log', 'public/../private/a', '/src/a', 'src\\a', 'docs/history/a.md', 'node_modules/a', 'output/a.png', 'Signature/01_Pure_Black.svg', 'Signature/04_Forest_Green.svg', 'logo/README.md', 'logo/horizontal-light.svg', 'logo/symbol-green.svg', 'public/logo/horizontal-dark.svg']) assert.equal(allowed(file),false,file);
  for (const file of ['LICENSE', 'NOTICE', 'LICENSING.md', 'BRAND.md', 'LICENSES/CC-BY-4.0.txt', 'backup/README.md', 'docs/history/README.md', 'docs/brand-assets.md', 'public/icon.svg', 'docs/README.zh-CN.md', 'docs/user-guide.md', 'src/app/App.tsx', 'worker/auth.ts', 'worker/migrations/0008_mcp_login.sql', 'public/resources/catalogue.json', 'public/source-packs/accepted.zip', 'content/corpus/text-review-rules.json', 'package-lock.json', '.github/workflows/checks.yml']) assert.equal(allowed(file),true,file);
});

test('release guard refuses unconfigured and local-only settings before any real deployment', async () => {
  const { checkReleaseConfig } = await import('../scripts/release-config.mjs');
  const config={name:'lingfern',workers_dev:false,preview_urls:false,vars:{GITHUB_CLIENT_ID:'synthetic-app',SYNC_ENABLED:'true'},d1_databases:[{binding:'AUTH_DB',database_id:'11111111-1111-1111-1111-111111111111',migrations_dir:'worker/migrations'}],kv_namespaces:[{binding:'OAUTH_KV',id:'1'.repeat(32)}],assets:{not_found_handling:'none',run_worker_first:['/api/*','/mcp']}};
  assert.doesNotThrow(()=>checkReleaseConfig(config));
  for(const change of [c=>{c.vars.SYNC_ENABLED='false';},c=>{c.vars.LOCAL_AUTH='true';},c=>{c.vars.TOKEN_ENCRYPTION_KEY='synthetic';},c=>{c.d1_databases[0].database_id='00000000-0000-0000-0000-000000000000';},c=>{c.kv_namespaces=[];},c=>{c.assets.run_worker_first=['/*'];}]){const bad=structuredClone(config);change(bad);assert.throws(()=>checkReleaseConfig(bad));}
});
