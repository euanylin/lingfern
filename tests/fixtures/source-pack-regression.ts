import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import catalogue from './source-packs-regression.json';

/** Fixed source bytes for historical semantic regressions, never a learner catalogue. */
export const regressionSourcePacks = catalogue;
export function readSourcePackFixture(id: string): Buffer {
  const entry = catalogue.packs.find(pack => pack.id === id);
  if (!entry) throw new Error(`Missing historical source fixture: ${id}`);
  const bytes = readFileSync(entry.file);
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256)
    throw new Error(`Historical source fixture integrity failed: ${id}`);
  return bytes;
}
