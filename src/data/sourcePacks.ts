import { loadRuntimeResources, runtimeResources } from './runtimeResources';
import { communityPacks } from './db';
import { communityCacheName, communityPackageReady, installCommunityPack } from './communityInstall';

export const sourcePacks = runtimeResources.sources.packs;
export function listeningSourcePack(hash?: string) {
  return sourcePacks.find(pack => pack.skill === 'listening' && pack.sha256 === hash);
}
export function isSourcePack(hash: string) {
  return sourcePacks.some(pack => pack.sha256 === hash);
}
export async function installedSourcePacks(profileId: string) {
  await loadRuntimeResources();
  const packs = await communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready').toArray();
  const ready = await Promise.all(packs.map(async pack => await communityPackageReady(pack) ? pack.hash : undefined));
  return new Set(sourcePacks.filter(pack => ready.includes(pack.sha256)).map(pack => pack.id));
}
export async function installSourcePack(id: string, profileId: string, signal?: AbortSignal, onProgress: (bytes: number) => void = () => {}) {
  await loadRuntimeResources();
  const entry = sourcePacks.find(pack => pack.id === id || pack.sha256 === id);
  if (!entry) throw new Error('UNKNOWN_PACKAGE');
  await (await import('./installationIntent')).saveInstallationIntent(profileId, entry.id, true);
  const response = await fetch(entry.path, { cache: 'no-cache', redirect: 'error', credentials: 'omit', signal });
  if (!response.ok || !response.body) throw new Error('MISSING_CORPUS');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > entry.bytes) throw new Error('CORPUS_INTEGRITY');
      chunks.push(value); onProgress(length);
    }
  } finally { await reader.cancel(); }
  if (length !== entry.bytes) throw new Error('CORPUS_INTEGRITY');
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const { inspectCommunityPack } = await import('./communityPack');
  const { reviewedExcerpts, reviewedReading } = await import('./corpus');
  const pack = await inspectCommunityPack(bytes);
  const bank = pack.corpus ?? pack.spoken;
  const excerpts = pack.corpus?.records.reduce((sum, record) => sum + record.passages.length, 0) ?? pack.spoken?.records.reduce((sum, record) => sum + record.clips.length, 0);
  const audioSeconds = pack.spoken?.records.reduce((sum, record) => sum + record.clips.reduce((seconds, clip) => seconds + clip.audio.duration, 0), 0) ?? 0;
  if (!bank || bank.records.length !== entry.roots || excerpts !== (entry.passages ?? entry.clips) || Math.abs(audioSeconds - entry.audioSeconds) > .000001) throw new Error('CORPUS_INTEGRITY');
  if (pack.hash !== entry.sha256 || pack.id !== entry.id) throw new Error('CORPUS_INTEGRITY');
  await installCommunityPack(pack, profileId, signal);
  return { ...pack,
    ...(pack.corpus ? { corpus: { ...pack.corpus, records: await reviewedReading(pack.corpus.records) } } : {}),
    ...(pack.spoken ? { spoken: { ...pack.spoken, records: (await Promise.all(pack.spoken.records.map(async record => ({ ...record,
      clips: await reviewedExcerpts(record, record.clips) })))).filter(record => record.clips.length) } } : {}) };
}
export async function removeSourcePack(id: string, profileId: string) {
  await loadRuntimeResources();
  const entry = sourcePacks.find(pack => pack.id === id);
  if (!entry) throw new Error('UNKNOWN_PACKAGE');
  await (await import('./installationIntent')).saveInstallationIntent(profileId, id, false);
  await communityPacks.delete([profileId, entry.sha256]);
  // Media may be shared with another local profile; never remove its installed files.
  if (!await communityPacks.filter(pack => pack.hash === entry.sha256).count()) await caches.delete(communityCacheName(entry.sha256));
}
