import { loadRuntimeResources, runtimeResources } from './runtimeResources';
import { communityPacks } from './db';
import { communityCacheName, communityPackageReady, installCommunityPack } from './communityInstall';
import { notifyResourceChange } from './resourceChanges';

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
export async function removeSourcePack(ids: string | string[], profileId: string) {
  await loadRuntimeResources();
  const selected = [...new Set(typeof ids === 'string' ? [ids] : ids)];
  const entries = selected.map(id => { const entry = sourcePacks.find(pack => pack.id === id); if (!entry) throw new Error('UNKNOWN_PACKAGE'); return entry; });
  await (await import('./installationIntent')).saveInstallationIntents(profileId, selected, false);
  await communityPacks.bulkDelete(entries.map(entry => [profileId, entry.sha256]));
  // Preserve installed media shared by other local profiles.
  const shared = new Set((await communityPacks.toCollection().primaryKeys()).map(key => key[1]));
  try {
    for (let offset = 0; offset < entries.length; offset += 4) await Promise.all(entries.slice(offset, offset + 4).map(async entry => {
      if (shared.has(entry.sha256)) return;
      const name = communityCacheName(entry.sha256);
      await caches.delete(name);
      if (await caches.has(name)) throw new Error('REMOVE_FAILED');
    }));
  } finally { notifyResourceChange(); }
}
