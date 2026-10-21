import { openReadingLicenceUrl, openReadingLicenceSha256 } from '../shared/openReading';
import { z } from 'zod';
import { lessonSchema, levelSchema, type Lesson } from '../shared/content';
import { normaliseTerm } from '../shared/dictionary';
import { unpackZip } from './zip';
import { spokenCorpusSchema, type SpokenCorpus } from '../core/spokenCorpus';
import longAdmission from '../../content/corpus/long-listening-admission.json';
import { exposureQuestionIdSchema, exposureRootIdSchema } from '../shared/exposure';
import { corpusSchema, type Corpus } from '../core/corpus';

const decoder = new TextDecoder('utf-8', { fatal: true });
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const digest = async (bytes: Uint8Array) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))));
const fileSchema = z.object({ bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const manifestSchema = z.object({
  format: z.literal('lingfern-community-content'), version: z.literal(1), id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  language: z.literal('en'), levels: z.array(levelSchema).min(1).max(6), materialCount: z.number().int().nonnegative().max(100),
  files: z.record(z.string(), fileSchema),
}).strict();
const sourceSchema = z.object({ id: z.string().min(1).max(120), title: z.string().min(1).max(300), author: z.string().min(1).max(1000), license: z.string().min(1).max(300), attribution: z.string().min(1).max(1000), sourceUrl: z.url().startsWith('https://').optional() });
export type CommunitySource = z.infer<typeof sourceSchema>;
const dictionaryEntrySchema = z.object({ term: z.string().min(1).max(80), definition: z.string().min(1).max(800), example: z.string().min(1).max(500), sourceId: z.string().min(1).max(120) }).strict();
export type CommunityDictionaryEntry = z.infer<typeof dictionaryEntrySchema>;

export type CommunityPack = { id: string; hash: string; lessons: Lesson[]; sources: CommunitySource[]; dictionary: CommunityDictionaryEntry[]; corpus?: Corpus; spoken?: SpokenCorpus; media: Record<string, Uint8Array> };

function validPng(bytes: Uint8Array) {
  if (bytes.length < 33 || bytes.length > 2 * 1024 * 1024 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR' || !width || !height || width > 2048 || height > 2048 || width * height > 4_000_000) return false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    if (length > bytes.length - offset - 12) return false;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === 'acTL') return false;
    offset += length + 12;
    if (type === 'IEND') return length === 0 && offset === bytes.length;
  }
  return false;
}

export async function inspectCommunityPack(bytes: Uint8Array): Promise<CommunityPack> {
  const files = unpackZip(bytes, {
    maxCompressed: 100 * 1024 * 1024, maxExpanded: 300 * 1024 * 1024, maxFiles: 2000,
    allowName: name => ['manifest.json', 'lessons.json', 'sources.json', 'dictionary.json', 'corpus.json', 'spoken.json', 'gutenberg-license.txt', 'gutenberg-terms.txt', 'wikiquote-CC-BY-SA-4.0.txt', 'wikiquote-README.md', 'open-reading-CC-BY-4.0.txt', 'open-reading-NOTICE.md', 'librispeech-CC-BY-4.0.txt', 'librispeech-NOTICE.md', 'fleurs-CC-BY-4.0.txt', 'fleurs-CC-BY-SA-4.0.txt', 'fleurs-NOTICE.md', ...longAdmission.notices.map(notice => notice.name), ...longAdmission.records.flatMap(entry => 'notices' in entry ? (entry.notices ?? []).map(notice => notice.name) : [])].includes(name) || /^media\/[a-z0-9-]+\.(mp3|png)$/.test(name), error: 'COMMUNITY',
  });
  const parseJson = (name: string, max: number): unknown => {
    const data = files[name];
    if (!data || data.length > max) throw new Error('COMMUNITY_MANIFEST');
    return JSON.parse(decoder.decode(data));
  };
  const manifest = manifestSchema.parse(parseJson('manifest.json', 64 * 1024));
  for (const name of ['gutenberg-license.txt', 'gutenberg-terms.txt']) if (files[name]) {
    if (files[name].length > 64 * 1024 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(decoder.decode(files[name]))) throw new Error('COMMUNITY_SOURCE');
  }
  const names = Object.keys(files).filter(name => name !== 'manifest.json');
  if (!files['lessons.json'] || !files['sources.json'] || names.length !== Object.keys(manifest.files).length || names.some(name => !manifest.files[name])) throw new Error('COMMUNITY_MANIFEST');
  for (const name of names) {
    const info = manifest.files[name];
    if (!info || files[name].length !== info.bytes || await digest(files[name]) !== info.sha256) throw new Error('COMMUNITY_INTEGRITY');
    if (name.endsWith('.mp3') && (info.bytes > 20 * 1024 * 1024 || !((files[name][0] === 0x49 && files[name][1] === 0x44 && files[name][2] === 0x33) || (files[name][0] === 0xff && (files[name][1] & 0xe0) === 0xe0)))) throw new Error('COMMUNITY_MEDIA');
    if (name.endsWith('.png') && !validPng(files[name])) throw new Error('COMMUNITY_MEDIA');
  }
  const sources = z.array(sourceSchema).min(1).max(100).parse(parseJson('sources.json', 1024 * 1024));
  const sourceIds = new Set(sources.map(source => source.id));
  if (sourceIds.size !== sources.length) throw new Error('COMMUNITY_SOURCE');
  const dictionary = files['dictionary.json'] ? z.array(dictionaryEntrySchema).max(1000).parse(parseJson('dictionary.json', 1024 * 1024)) : [];
  if (dictionary.some(entry => !normaliseTerm(entry.term) || !sourceIds.has(entry.sourceId))) throw new Error('COMMUNITY_DICTIONARY');
  const corpus = files['corpus.json'] ? corpusSchema.parse(parseJson('corpus.json', 5 * 1024 * 1024)) : undefined;
  if (corpus && (!corpus.records.length || corpus.records.some(record => {
    const source = sources.find(source => source.id === record.id);
    return !source || source.attribution !== record.attribution || source.license !== record.licence || source.sourceUrl !== record.originalUrl;
  }) || new Set(corpus.records.map(record => record.rootId)).size !== corpus.records.length)) throw new Error('COMMUNITY_SOURCE');
  if (corpus?.records.some(record => record.id.startsWith('wikiquote-'))) {
    for (const name of ['wikiquote-CC-BY-SA-4.0.txt', 'wikiquote-README.md']) {
      if (!files[name]?.length || files[name].length > 64 * 1024 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(decoder.decode(files[name]))) throw new Error('COMMUNITY_SOURCE');
    }
    for (const record of corpus.records) for (const passage of record.passages) {
      if (passage.quoteProvenance && await digest(new TextEncoder().encode(passage.text)) !== passage.quoteProvenance.textSha256) throw new Error('COMMUNITY_INTEGRITY');
    }
  }
  if (corpus?.records.some(record => record.licenceUrl === openReadingLicenceUrl)) {
    for (const name of ['open-reading-CC-BY-4.0.txt', 'open-reading-NOTICE.md']) {
      if (!files[name]?.length || files[name].length > 64 * 1024 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(decoder.decode(files[name]))) throw new Error('COMMUNITY_SOURCE');
    }
    if (await digest(files['open-reading-CC-BY-4.0.txt']) !== openReadingLicenceSha256) throw new Error('COMMUNITY_SOURCE');
    for (const record of corpus.records) for (const passage of record.passages) {
      if (passage.sourceProvenance && await digest(new TextEncoder().encode(passage.text)) !== passage.sourceProvenance.textSha256) throw new Error('COMMUNITY_INTEGRITY');
    }
  }
  const rawSpoken = files['spoken.json'] ? spokenCorpusSchema.parse(parseJson('spoken.json', 5 * 1024 * 1024)) : undefined;
  if (rawSpoken?.records.some(record => record.clips.some(clip => clip.wordCount > 180 || clip.audio.duration > 91))) {
    for (const record of rawSpoken.records.filter(record => record.clips.some(clip => clip.wordCount > 180 || clip.audio.duration > 91))) {
      const admitted = longAdmission.records.find(entry => entry.rootId === record.rootId);
      if (!admitted || !record.originalText || await digest(new TextEncoder().encode(record.originalText)) !== admitted.originalTextSha256) throw new Error('COMMUNITY_SOURCE');
      for (const notice of ('notices' in admitted && admitted.notices ? admitted.notices : longAdmission.notices)) if (!files[notice.name] || await digest(files[notice.name]) !== notice.sha256) throw new Error('COMMUNITY_SOURCE');
    }
  }
  if (rawSpoken?.records.some(record => record.id.startsWith('fleurs-'))) {
    for (const name of ['fleurs-CC-BY-4.0.txt', 'fleurs-CC-BY-SA-4.0.txt', 'fleurs-NOTICE.md']) {
      if (!files[name]?.length || files[name].length > 64 * 1024 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(decoder.decode(files[name]))) throw new Error('COMMUNITY_SOURCE');
    }
  }
  if (rawSpoken?.communityPackageId) throw new Error('COMMUNITY_SOURCE');
  const raw = z.array(z.record(z.string(), z.unknown())).min(corpus || rawSpoken ? 0 : 1).max(50).parse(parseJson('lessons.json', 5 * 1024 * 1024));
  const hash = await digest(bytes);
  const usedMedia = new Set<string>();
  const spoken = rawSpoken ? spokenCorpusSchema.parse({ ...rawSpoken, communityPackageId: hash, records: rawSpoken.records.map(record => {
    const source = sources.find(source => source.id === record.id);
    if (!source || source.attribution !== record.attribution || source.license !== record.licence || source.sourceUrl !== record.originalUrl) throw new Error('COMMUNITY_SOURCE');
    return { ...record, clips: record.clips.map(clip => {
      const audioSource = sources.find(source => source.id === clip.audioSourceId);
      const name = clip.audio.src;
      if (!audioSource || audioSource.sourceUrl !== clip.audio.sourceUrl || audioSource.license !== clip.audio.license || !files[name] || clip.audio.sha256 !== manifest.files[name]?.sha256) throw new Error('COMMUNITY_MEDIA');
      usedMedia.add(name);
      return { ...clip, audio: { ...clip.audio, author: audioSource.author, src: `/audio/community-${hash}/${name.slice(6)}` },
        credit: { attribution: `${source.attribution} Recording: ${audioSource.attribution}`, license: `${source.license}; recording: ${audioSource.license}`, sourceUrl: source.sourceUrl } };
    }) };
  }) }) : undefined;
  const lessons = raw.map(item => {
    if (item.mode || typeof item.id !== 'string' || !item.id || typeof item.sourceId !== 'string' || !sourceIds.has(item.sourceId)) throw new Error('COMMUNITY_LESSON');
    const materials = z.array(z.record(z.string(), z.unknown())).parse(item.materials);
    const converted = materials.map(material => {
      if ('communityPackageId' in material) throw new Error('COMMUNITY_SOURCE');
      if (typeof material.rootId !== 'string' || !material.rootId) throw new Error('COMMUNITY_LESSON');
      const source = sources.find(source => source.id === (material.sourceId ?? item.sourceId));
      if (!source) throw new Error('COMMUNITY_SOURCE');
      const rootId = `community:${hash}:${material.rootId}`;
      if (!exposureRootIdSchema.safeParse(rootId).success) throw new Error('COMMUNITY_LESSON');
      const scoped: Record<string, unknown> = { ...material, rootId, credit: { attribution: source.attribution, license: source.license, ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}) } };
      if (material.illustration) {
        const illustration = z.record(z.string(), z.unknown()).parse(material.illustration);
        const name = String(illustration.src);
        if (!/^media\/[a-z0-9-]+\.png$/.test(name) || !files[name] || illustration.sha256 !== manifest.files[name]?.sha256 || typeof illustration.sourceId !== 'string' || !sourceIds.has(illustration.sourceId)) throw new Error('COMMUNITY_MEDIA');
        usedMedia.add(name);
        scoped.illustration = { ...illustration, src: `/images/community-${hash}/${name.slice(6)}` };
      }
      if (!material.audio) return scoped;
      const audio = z.record(z.string(), z.unknown()).parse(material.audio);
      const name = String(audio.src);
      if (!/^media\/[a-z0-9-]+\.mp3$/.test(name) || !files[name] || audio.sha256 !== manifest.files[name]?.sha256) throw new Error('COMMUNITY_MEDIA');
      usedMedia.add(name);
      return { ...scoped, audio: { ...audio, src: `/audio/community-${hash}/${name.slice(6)}` } };
    });
    const safe = { ...item };
    delete safe.official;
    return lessonSchema.parse({ ...safe, materials: converted, id: `community:${hash}:${item.id}`, sourceId: `community:${hash}:${item.sourceId}`, communityPackageId: hash, reviewStatus: 'draft' });
  });
  if (new Set(lessons.map(item => item.id)).size !== lessons.length || lessons.reduce((count, lesson) => count + lesson.materials.length, 0) !== manifest.materialCount || (lessons.length > 0 && new Set(lessons.map(item => item.targetLevel)).size !== manifest.levels.length) || lessons.some(lesson => !manifest.levels.includes(lesson.targetLevel))) throw new Error('COMMUNITY_MANIFEST');
  // Preserve legacy reads; enforce exposure/sync limits on new imports.
  if (lessons.some(lesson => lesson.materials.some(material => material.questions.some(question =>
    !exposureQuestionIdSchema.safeParse(question.id).success || 'variantGroup' in question && question.variantGroup && !exposureQuestionIdSchema.safeParse(question.variantGroup).success)))) throw new Error('COMMUNITY_LESSON');
  const media: Record<string, Uint8Array> = Object.create(null);
  for (const name of names.filter(item => item.startsWith('media/'))) {
    if (!usedMedia.has(name)) throw new Error('COMMUNITY_MEDIA');
    media[name.slice(6)] = files[name];
  }
  return { id: manifest.id, hash, lessons, sources, dictionary, ...(corpus ? { corpus } : {}), ...(spoken ? { spoken } : {}), media };
}
