import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import rawReading from './fixtures/content/a1-reading.json';
import rawListening from './fixtures/content/a1-listening.json';
import { inspectCommunityPack } from '../src/data/communityPack';

const encoder = new TextEncoder();
const sha = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join('');

async function packageZip(lesson: Record<string, unknown>, extra: Record<string, Uint8Array> = {}, tamper = false) {
  const files: Record<string, Uint8Array> = {
    'lessons.json': encoder.encode(JSON.stringify([lesson])),
    'sources.json': encoder.encode(JSON.stringify([{ id: lesson.sourceId, title: 'Original draft', author: 'Example author', license: 'Private use', attribution: 'Example author' }])),
    ...extra,
  };
  const manifest = {
    format: 'lingfern-community-content', version: 1, id: 'sample-lessons', language: 'en', levels: [lesson.targetLevel],
    materialCount: (lesson.materials as unknown[]).length,
    files: Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, data]) => [name, { bytes: data.length, sha256: await sha(data) }]))),
  };
  if (tamper) files['sources.json'] = encoder.encode('[]');
  return zipSync({ ...files, 'manifest.json': encoder.encode(JSON.stringify(manifest)) });
}

describe('community lesson packages', () => {
  it('rejects new question or variant IDs beyond the save contract while accepting the exact boundary', async () => {
    for (const field of ['id', 'variantGroup']) {
      const valid = structuredClone(rawReading);
      Object.assign(valid.materials[0].questions[0], { [field]: 'x'.repeat(80) });
      expect((await inspectCommunityPack(await packageZip(valid))).lessons).toHaveLength(1);
      Object.assign(valid.materials[0].questions[0], { [field]: 'x'.repeat(81) });
      await expect(inspectCommunityPack(await packageZip(valid))).rejects.toThrow(field === 'id' ? 'COMMUNITY_LESSON' : 'expected string to have <=80 characters');
    }
  });
  it('imports inert licence text and rejects oversized, control-character and invalid UTF-8 notices', async () => {
    const valid = encoder.encode('Project Gutenberg licence\nSource: https://www.gutenberg.org/policy/license.html');
    for (const name of ['gutenberg-license.txt', 'gutenberg-terms.txt']) {
      expect((await inspectCommunityPack(await packageZip(rawReading, { [name]: valid }))).lessons).toHaveLength(1);
      for (const invalid of [new Uint8Array(65537).fill(65), encoder.encode('licence\u0000'), new Uint8Array([0xff])])
        await expect(inspectCommunityPack(await packageZip(rawReading, { [name]: invalid }))).rejects.toThrow();
    }
  });

  it('imports a source bank without fabricated prewritten lessons, validates attribution and rejects empty banks', async () => {
    const { corpusSchema, corpusLesson } = await import('../src/core/corpus');
    const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
    const makeBank = async (bank: typeof corpus, attribution = true) => {
      const files = {
        'lessons.json': encoder.encode('[]'), 'corpus.json': encoder.encode(JSON.stringify(bank)),
        'sources.json': encoder.encode(JSON.stringify(bank.records.map(record => ({ id: record.id, title: record.title, author: record.authors.join('; '), license: record.licence, attribution: attribution ? record.attribution : 'Incorrect attribution', sourceUrl: record.originalUrl })))),
        'open-reading-CC-BY-4.0.txt': new Uint8Array(readFileSync('public/corpus/open-reading-CC-BY-4.0.txt')),
        'open-reading-NOTICE.md': new Uint8Array(readFileSync('public/corpus/open-reading-NOTICE.md')),
      };
      const manifest = { format: 'lingfern-community-content', version: 1, id: 'source-bank', language: 'en', levels: ['B2'], materialCount: 0, files: Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, bytes]) => [name, { bytes: bytes.length, sha256: await sha(bytes) }]))) };
      return zipSync({ ...files, 'manifest.json': encoder.encode(JSON.stringify(manifest)) });
    };
    const pack = await inspectCommunityPack(await makeBank(corpus));
    expect(pack.lessons).toEqual([]);
    expect(pack.corpus).toEqual(corpus);
    const generated = corpusLesson(pack.corpus!, new Set(), 0)!;
    expect(generated.materials).toHaveLength(2);
    expect(generated.materials.every(material => !!material.credit)).toBe(true);
    await expect(inspectCommunityPack(await makeBank(corpus, false))).rejects.toThrow('COMMUNITY_SOURCE');
    await expect(inspectCommunityPack(await makeBank({ ...corpus, records: [] }))).rejects.toThrow();
    const duplicate = { ...corpus, records: [corpus.records[0], { ...corpus.records[0], id: 'voa-999999' }] };
    await expect(inspectCommunityPack(await makeBank(duplicate))).rejects.toThrow('COMMUNITY_SOURCE');
  });
  it('keeps imported reading material draft and outside official checks', async () => {
    const pack = await inspectCommunityPack(await packageZip({ ...rawReading, reviewStatus: 'approved', official: true }));
    expect(pack.lessons).toHaveLength(1);
    expect(pack.lessons[0].reviewStatus).toBe('draft');
    expect(pack.lessons[0].mode).toBeUndefined();
    expect(pack.lessons[0].communityPackageId).toBe(pack.hash);
    expect(pack.lessons[0].materials[0].rootId).toMatch(new RegExp(`^community:${pack.hash}:`));
    expect(pack.media).toEqual({});
    expect(pack.lessons[0].materials.every(material => material.credit?.attribution === 'Example author' && material.credit.license === 'Private use')).toBe(true);
  });

  it('maps verified local recordings without contacting their source', async () => {
    const files = Object.fromEntries(rawListening.materials.map((material, index) => [`media/word-${index + 1}.mp3`, new Uint8Array(readFileSync(`public${material.audio.src}`))]));
    const lesson = { ...rawListening, materials: rawListening.materials.map((material, index) => ({ ...material, audio: { ...material.audio, src: `media/word-${index + 1}.mp3` } })) };
    const pack = await inspectCommunityPack(await packageZip(lesson, files));
    expect(pack.lessons[0].materials[0].audio?.src).toBe(`/audio/community-${pack.hash}/word-1.mp3`);
    expect(Object.keys(pack.media)).toHaveLength(4);
  });

  it('accepts sourced static PNG illustrations and rejects invalid image data or provenance', async () => {
    const image = new Uint8Array(readFileSync('public/icon-192.png'));
    const illustration = { src: 'media/illustration.png', sha256: await sha(image), alt: { 'zh-Hans': '示例插图', 'zh-Hant': '示例插圖', en: 'Example illustration' }, sourceId: rawReading.sourceId };
    const lesson = { ...rawReading, materials: rawReading.materials.map((material, index) => index ? material : { ...material, illustration }) };
    const pack = await inspectCommunityPack(await packageZip(lesson, { 'media/illustration.png': image }));
    expect(pack.lessons[0].materials[0].illustration?.src).toBe(`/images/community-${pack.hash}/illustration.png`);
    expect(pack.media['illustration.png']).toEqual(image);
    const invalid = new Uint8Array(image);
    invalid[0] = 0;
    await expect(inspectCommunityPack(await packageZip(lesson, { 'media/illustration.png': invalid }))).rejects.toThrow('COMMUNITY_MEDIA');
    const wrongSource = { ...rawReading, materials: rawReading.materials.map((material, index) => index ? material : { ...material, illustration: { ...illustration, sourceId: 'missing' } }) };
    await expect(inspectCommunityPack(await packageZip(wrongSource, { 'media/illustration.png': image }))).rejects.toThrow('COMMUNITY_MEDIA');
  });

  it('accepts a bounded sourced glossary and rejects invalid references', async () => {
    const entry = { term: 'ferncourseword', definition: 'A word used only in this private course.', example: 'This ferncourseword stays local.', sourceId: rawReading.sourceId };
    const dictionary = encoder.encode(JSON.stringify([entry]));
    const pack = await inspectCommunityPack(await packageZip(rawReading, { 'dictionary.json': dictionary }));
    expect(pack.dictionary).toEqual([entry]);
    await expect(inspectCommunityPack(await packageZip(rawReading, { 'dictionary.json': encoder.encode(JSON.stringify([{ ...entry, sourceId: 'missing' }])) }))).rejects.toThrow('COMMUNITY_DICTIONARY');
    await expect(inspectCommunityPack(await packageZip(rawReading, { 'dictionary.json': encoder.encode(JSON.stringify([{ ...entry, term: '<script>' }])) }))).rejects.toThrow('COMMUNITY_DICTIONARY');
  });

  it('rejects changed files and check-mode claims', async () => {
    await expect(inspectCommunityPack(await packageZip(rawReading, {}, true))).rejects.toThrow();
    await expect(inspectCommunityPack(await packageZip({ ...rawReading, mode: 'check' }))).rejects.toThrow('COMMUNITY_LESSON');
    const unknownSource = { ...rawReading, materials: rawReading.materials.map(material => ({ ...material, sourceId: 'missing' })) };
    await expect(inspectCommunityPack(await packageZip(unknownSource))).rejects.toThrow('COMMUNITY_SOURCE');
    const extra = zipSync({ '../escape.txt': encoder.encode('bad'), 'manifest.json': encoder.encode('{}') });
    await expect(inspectCommunityPack(extra)).rejects.toThrow('COMMUNITY_ZIP');
    await expect(inspectCommunityPack(await packageZip(rawReading, { 'media/unused.mp3': encoder.encode('not audio') }))).rejects.toThrow('COMMUNITY_MEDIA');
  });
});
