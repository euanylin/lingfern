import { waitForOfflineWorker } from './offline';
import { communityPacks, db, syncClocks, type CommunityPackageRecord } from './db';
import type { CommunityPack } from './communityPack';
import { normaliseTerm } from '../shared/dictionary';
import { materialPackageId, type Lesson } from '../shared/content';

export const communityCacheName = (hash: string) => `lingfern-community-${hash}`;
export const communityMarker = (hash: string) => `/audio/community-${hash}/ready`;

/** Validate immutable recordings before multi-package practice starts. */
export async function communityLessonReady(lesson: Lesson, profileId: string) {
  if (!('caches' in window)) return false;
  for (const material of lesson.materials) {
    const hash = materialPackageId(lesson, material);
    if (!hash || !material.audio) return false;
    const pack = await communityPacks.get([profileId, hash]);
    if (!pack || pack.state !== 'ready' || !await caches.has(communityCacheName(hash))) return false;
    const clip = pack.spoken?.records.find(record => record.rootId === material.rootId)?.clips.find(clip => clip.audio.src === material.audio!.src);
    if (!clip || clip.audio.sha256 !== material.audio.sha256 || clip.text !== material.blocks[0]?.text) return false;
    const cache = await caches.open(communityCacheName(hash));
    if (!await cache.match(communityMarker(hash))) return false;
    const response = await cache.match(material.audio.src);
    if (!response || !/audio\//i.test(response.headers.get('Content-Type') ?? '')) return false;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 32 * 1024 * 1024) return false;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    if (digest !== material.audio.sha256) return false;
  }
  return true;
}

export async function communityDictionary(profileId: string, raw: string) {
  const term = normaliseTerm(raw);
  if (!term) return [];
  const packs = await communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready').toArray();
  return packs.flatMap(pack => (pack.dictionary ?? []).filter(entry => normaliseTerm(entry.term) === term).map(entry => ({ ...entry, source: pack.sources.find(source => source.id === entry.sourceId)?.title ?? pack.id })));
}

export async function communityDictionaryTerms(profileId: string) {
  const packs = await communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready').toArray();
  return [...new Set(packs.flatMap(pack => (pack.dictionary ?? []).map(entry => normaliseTerm(entry.term))))];
}

export async function communityPackageReady(pack: Pick<CommunityPackageRecord, 'hash' | 'lessons' | 'spoken'>) {
  if (!('caches' in window)) return false;
  if (!await caches.has(communityCacheName(pack.hash))) return false;
  const cache = await caches.open(communityCacheName(pack.hash));
  if (!await cache.match(communityMarker(pack.hash))) return false;
  const media = new Set(pack.lessons.flatMap(lesson => lesson.materials.flatMap(material => [material.audio?.src, material.illustration?.src].filter((src): src is string => !!src))));
  for (const record of pack.spoken?.records ?? []) for (const clip of record.clips) media.add(clip.audio.src);
  return (await Promise.all([...media].map(path => cache.match(path)))).every(Boolean);
}

async function checkIllustration(bytes: Uint8Array, signal?: AbortSignal) {
  const decoded = createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
  let bitmap: ImageBitmap | undefined;
  let finished = false;
  void decoded.then(image => { if (finished && !bitmap) image.close(); }, () => {});
  let rejectAbort: ((reason?: unknown) => void) | undefined;
  const abort = () => rejectAbort?.(new DOMException('Cancelled', 'AbortError'));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    bitmap = await Promise.race([
      decoded,
      new Promise<never>((_, reject) => {
        rejectAbort = reject;
        timer = setTimeout(() => reject(new Error('COMMUNITY_MEDIA')), 10_000);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      }),
    ]);
    if (!bitmap.width || !bitmap.height || bitmap.width > 2048 || bitmap.height > 2048) throw new Error('COMMUNITY_MEDIA');
  } finally { finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); bitmap?.close(); }
}

async function checkRecording(bytes: Uint8Array, expected: { duration: number; lastEvidence: number }[], signal?: AbortSignal) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }));
  const audio = new Audio();
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => { clearTimeout(timeout); signal?.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
      const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timeout = setTimeout(() => finish(new Error('COMMUNITY_MEDIA')), 10_000);
      signal?.addEventListener('abort', abort, { once: true });
      audio.onloadedmetadata = () => Number.isFinite(audio.duration) && audio.duration > 0 && expected.every(({ duration, lastEvidence }) => Math.abs(duration - audio.duration) <= Math.max(.5, duration * .1) && lastEvidence <= audio.duration + .1) ? finish() : finish(new Error('COMMUNITY_MEDIA'));
      audio.onerror = () => finish(new Error('COMMUNITY_MEDIA'));
      audio.preload = 'metadata'; audio.src = url; audio.load();
      if (signal?.aborted) abort();
    });
  } finally { audio.onloadedmetadata = null; audio.onerror = null; audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); }
}

export async function installCommunityPack(pack: CommunityPack, profileId: string, signal?: AbortSignal) {
  if (!('caches' in window) || !('serviceWorker' in navigator)) throw new Error('UNSUPPORTED');
  await waitForOfflineWorker(signal);
  await navigator.storage?.persist?.().catch(() => false);
  const previous = await communityPacks.get([profileId, pack.hash]);
  const name = communityCacheName(pack.hash);
  const save = (state: 'ready' | 'staged') => db.transaction('rw', communityPacks, syncClocks, async () => {
    if ((await syncClocks.get(profileId))?.deleted) throw new Error('PROFILE_DELETED');
    await communityPacks.put({ profileId, hash: pack.hash, id: pack.id, lessons: pack.lessons, sources: pack.sources, dictionary: pack.dictionary, ...(pack.corpus ? { corpus: pack.corpus } : {}), ...(pack.spoken ? { spoken: pack.spoken } : {}), state, installedAt: new Date().toISOString() });
  });
  if (await communityPackageReady(pack)) {
    if (previous?.state !== 'ready') await save('ready');
    return;
  }
  for (const [filename, data] of Object.entries(pack.media)) {
    if (filename.endsWith('.png')) { await checkIllustration(data, signal); continue; }
    const path = `/audio/community-${pack.hash}/${filename}`;
    const expected = pack.lessons.flatMap(lesson => lesson.materials.filter(material => material.audio?.src === path).map(material => ({
      duration: material.audio!.duration,
      lastEvidence: Math.max(...material.questions.flatMap(question => [question.evidence.audioEnd ?? 0, ...(question.additionalEvidence ?? []).map(evidence => evidence.audioEnd ?? 0)])),
    })));
    expected.push(...(pack.spoken?.records ?? []).flatMap(record => record.clips.filter(clip => clip.audio.src === path).map(clip => ({ duration: clip.audio.duration, lastEvidence: clip.segments.at(-1)!.audioEnd }))));
    if (!expected.length) throw new Error('COMMUNITY_MEDIA');
    await checkRecording(data, expected, signal);
  }
  await save('staged');
  try {
    await caches.delete(name);
    const cache = await caches.open(name);
    for (const [filename, data] of Object.entries(pack.media)) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const image = filename.endsWith('.png');
      await cache.put(`/${image ? 'images' : 'audio'}/community-${pack.hash}/${filename}`, new Response(new Uint8Array(data), { headers: { 'Content-Type': image ? 'image/png' : 'audio/mpeg', 'Content-Length': String(data.length) } }));
    }
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    await cache.put(communityMarker(pack.hash), new Response('ready'));
    await communityPacks.update([profileId, pack.hash], { state: 'ready' });
  } catch (error) {
    await caches.delete(name);
    await communityPacks.delete([profileId, pack.hash]);
    throw error;
  }
}
