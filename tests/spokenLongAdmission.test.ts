import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { inspectCommunityPack } from '../src/data/communityPack';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { qualifiedLongSeconds } from '../src/core/spokenLongAdmission';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, questions, score } from '../src/shared/content';
const files = ['history', 'seo'].map(name => new Uint8Array(readFileSync(`tests/fixtures/long-reference-${name}.zip`)));
const hashes = ['5e2c7f25dfbea0ad5722ba2f41cd62bbe45f4d982208be32d1afb8404034fac9', '9f3cc12ffe375ff5a455a889d13a21e0553de5a120e461023aaa77781e19a18f'];
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
async function banks() { return Promise.all(files.map(bytes => inspectCommunityPack(bytes))); }
function rewrite(bytes: Uint8Array, edit: (entries: Record<string, Uint8Array>) => void) {
  const entries = unzipSync(bytes); edit(entries);
  const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
  manifest.files = Object.fromEntries(Object.entries(entries).filter(([name]) => name !== 'manifest.json').map(([name, data]) => [name, { bytes: data.length, sha256: sha(data) }]));
  entries['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); return zipSync(entries);
}
it('pins real source/media packages, derives the same reference operation across two original works, and preserves Test snapshots', async () => {
  expect(files.map(sha)).toEqual(hashes);
  const packs = await banks();
  expect(packs.every(pack => !pack.lessons.length)).toBe(true);
  const [primary, application] = packs.map(pack => pack.spoken!);
  for (let seed = 0; seed < 24; seed++) {
    const lesson = spokenCorpusLesson(primary, new Set(), seed, 196, 'C1', [], undefined, [], undefined, [application])!;
    expect(lesson).toBeDefined();
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goalId).toBe('source-context-reference');
    const withoutHints = structuredClone(lesson.materials);
    for (const material of withoutHints) for (const question of material.questions) delete question.hints;
    expect(asTestLesson(lesson).materials).toEqual(withoutHints);
    for (const material of lesson.materials) {
      expect(corpusOperation(material.questions[0])).toBe('choice:reference');
      const q = material.questions[0]; if ('kind' in q) throw new Error('Expected reference choice');
      expect(q.prompt).not.toContain(material.blocks[0].text.slice(q.evidence.start, q.evidence.end));
      expect(q.additionalEvidence![0].audioEnd).toBeLessThanOrEqual(q.evidence.audioStart!);
      for (let answer = 0; answer < q.options.length; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      expect(score(material.questions[1], 'A source-supported interpretation.').correct).toBeNull();
      expect(material.audio!.src).toContain(material === lesson.materials[0] ? primary.communityPackageId : application.communityPackageId);
    }
    expect(questions(lesson)).toHaveLength(4);
    expect(spokenCorpusLesson(primary, new Set([application.records[0].clips[0].id]), seed, 196, 'C1', [], 'choice', [], 'choice:reference', [application])).toBeUndefined();
  }
  expect(spokenCorpusLesson(primary, new Set(), 0, 91, 'C1', [], 'choice', [], 'choice:reference', [application])).toBeUndefined();
  for (const point of ['A1', 'A2', 'B1', 'C2'] as const) expect(spokenCorpusLesson(primary, new Set(), 0, 196, point, [], 'choice', [], 'choice:reference', [application])).toBeUndefined();
  expect(qualifiedLongSeconds([primary, application], 'C1', 75)).toBe(196);
  expect(qualifiedLongSeconds([primary], 'C1', 75)).toBe(75);
  expect(qualifiedLongSeconds([primary, application], 'C1', 35)).toBe(35);
  expect(qualifiedLongSeconds([primary, application], 'B2', 60)).toBe(60);
  expect(qualifiedLongSeconds([primary, application], 'B2', 91)).toBe(196);
  expect(qualifiedLongSeconds([primary, application], 'C2', 91)).toBe(91);
  const held = structuredClone(application); held.records[0].clips[0].qualityFlags = ['Unresolved boundary'];
  expect(qualifiedLongSeconds([primary, held], 'C1', 75)).toBe(75);
  expect(spokenCorpusLesson(primary, new Set(), 0, 196, 'C1', [], 'choice', [], 'choice:reference', [held])).toBeUndefined();
});
it('rejects forged long identities/text/times/media/creator/rights and changed original text or offline licence notices', async () => {
  const [pack] = await banks(); const bank = pack.spoken!;
  for (const edit of [
    (b: typeof bank) => { b.records[0].clips[0].text += ' '; },
    (b: typeof bank) => { b.records[0].clips[0].audio.sha256 = 'f'.repeat(64); },
    (b: typeof bank) => { b.records[0].clips[0].audio.duration += .001; },
    (b: typeof bank) => { b.records[0].clips[0].audio.author = 'Another speaker'; },
    (b: typeof bank) => { b.records[0].clips[0].audio.license = 'Public domain'; },
    (b: typeof bank) => { b.records[0].clips[0].segments[0].audioStart += .001; },
    (b: typeof bank) => { b.records[0].sourceHash = 'e'.repeat(64); },
    (b: typeof bank) => { b.records[0].rootId = 'wikipedia-article-1'; },
    (b: typeof bank) => { b.records[0].licence = 'Public domain'; },
  ]) { const broken = structuredClone(bank); edit(broken); expect(spokenCorpusSchema.safeParse(broken).success).toBe(false); }
  await expect(inspectCommunityPack(rewrite(files[0], entries => { delete entries['long-listening-CC-BY-SA-4.0.txt']; }))).rejects.toThrow('COMMUNITY_SOURCE');
  await expect(inspectCommunityPack(rewrite(files[0], entries => { entries['long-listening-NOTICE.md'] = new TextEncoder().encode('Forged notice.'); }))).rejects.toThrow('COMMUNITY_SOURCE');
  await expect(inspectCommunityPack(rewrite(files[0], entries => {
    const s = JSON.parse(new TextDecoder().decode(entries['spoken.json'])); s.records[0].originalText += ' Forged source.'; entries['spoken.json'] = new TextEncoder().encode(JSON.stringify(s));
  }))).rejects.toThrow('COMMUNITY_SOURCE');
});
