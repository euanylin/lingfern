import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import credits from '../content/about-credits.json';
import pkg from '../package.json';
import packs from '../content/source-packs.json';
import teaching from '../content/corpus/teaching-source-packs.json';
import audio from '../content/audio-sources.json';

it('preserves the project licences, attribution and separate artwork terms verbatim', () => {
  for (const [source, published] of [['LICENSE', 'LICENSE'], ['NOTICE', 'NOTICE'], ['BRAND.md', 'BRAND.md'], ['LICENSES/CC-BY-4.0.txt', 'CC-BY-4.0.txt']]) {
    expect(readFileSync(`public/licenses/lingfern/${published}`, 'utf8')).toBe(readFileSync(source, 'utf8'));
  }
});

it('credits every direct installed package with its actual declared licence', () => {
  const represented = credits.software.concat(credits.development).flatMap(project => project.packages);
  expect(represented.sort()).toEqual([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)].sort());
  for (const project of credits.software.concat(credits.development)) for (const name of project.packages) {
    const installed = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
    expect(project.license, name).toBe(installed.license);
  }
  expect(existsSync('public/licenses/octicons/LICENSE')).toBe(true);
});

it('credits every distributed corpus family without conflating recording and text terms', () => {
  const distributed = new Set([...packs.packs, ...teaching.packs].flatMap(pack => pack.sourceFamilies));
  expect(new Set(credits.corpora.flatMap(source => source.families))).toEqual(distributed);
  const notices = readFileSync('public/THIRD_PARTY_NOTICES.md', 'utf8');
  for (const source of credits.corpora) expect(notices).toContain(`[${source.name}](${source.url})`);
  for (const source of audio) {
    expect(source.license).toBeTruthy(); expect(source.licenseUrl).toBeTruthy(); expect(source.changes).toBeTruthy();
    expect(notices).toContain(source.author); expect(notices).toContain(source.source);
  }
  expect(credits.corpora.find(source => source.name.startsWith('FLEURS'))!.terms).toContain('transcripts: CC BY-SA 4.0');
  expect(credits.corpora.find(source => source.name.startsWith('LibriSpeech'))!.terms).toContain('separate text rights');
  for (const link of notices.matchAll(/\]\(([^)]+)\)/g)) if (!/^https?:/.test(link[1])) expect(existsSync(`public/${link[1]}`), link[1]).toBe(true);
});
