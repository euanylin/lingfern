import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Test-only staging keeps fictional recordings out of the normal site and packs.
const stage = process.env.LINGFERN_OFFLINE_FIXTURES === '1' ? '/tmp/lingfern-offline-fixtures-resources' : '/tmp/lingfern-test-fixtures-resources';
await rm(stage, { recursive: true, force: true });
await mkdir(`${stage}/content`, { recursive: true });
await cp('content/source-packs.json', `${stage}/content/source-packs.json`);
await cp('public', `${stage}/public`, { recursive: true });
await cp('tests/fixtures/public', `${stage}/public`, { recursive: true });
const env = { ...process.env, LINGFERN_RESOURCE_PUBLIC_ROOT: `${stage}/public`, LINGFERN_RESOURCE_CATALOGUE_ROOT: `${stage}/content` };
for (const script of ['offline-resources', 'resource-packs', 'runtime-resources']) {
  const result = spawnSync(process.execPath, [`scripts/${script}.mjs`], { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Fixture resource build failed: ${script}`);
}
