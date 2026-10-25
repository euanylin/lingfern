import { loadRuntimeResources, runtimeResources } from './runtimeResources';
import { db, settings, syncEvents, syncClocks } from './db';
import { appendSyncEvent, readSyncEvents } from './sync';
import { projectSyncEvents } from '../shared/sync';

export async function officialContentHash(id: string) {
  await loadRuntimeResources();
  const source = runtimeResources.sources.packs.find(pack => pack.id === id);
  if (source) return source.sha256;
  const group = runtimeResources.offline.groups.find(group => group.id === id);
  if (!group) throw new Error('UNKNOWN_PACKAGE');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(group.files)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function saveInstallationIntent(profileId: string, id: string, wanted: boolean) {
  return saveInstallationIntents(profileId, [id], wanted);
}

export async function saveInstallationIntents(profileId: string, ids: string[], wanted: boolean) {
  await loadRuntimeResources();
  const choices = await Promise.all([...new Set(ids)].map(async id => {
    const currentHash = [...runtimeResources.offline.groups, ...runtimeResources.sources.packs].some(group => group.id === id) ? await officialContentHash(id) : undefined;
    if (wanted && !currentHash) throw new Error('UNKNOWN_PACKAGE');
    return { id, currentHash };
  }));
  try {
    await db.transaction('rw', settings, syncEvents, syncClocks, async () => {
      const active = await settings.get('activeProfile');
      if (active && active.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
      const installations = projectSyncEvents(await readSyncEvents(profileId, db, ['installation'])).installations;
      for (const { id, currentHash } of choices) {
        const previous = installations.get(id);
        const contentHash = !wanted && previous ? previous.payload.contentHash : currentHash;
        if (!contentHash) throw new Error('UNKNOWN_PACKAGE');
        if (previous?.payload.contentHash === contentHash && previous.payload.wanted === wanted) continue;
        await appendSyncEvent(profileId, { type: 'installation', payload: { contentId: id, contentHash, wanted } });
      }
    });
  } catch (cause) { throw new Error('INSTALLATION_INTENT_FAILED', { cause }); }
}

export async function readInstallationIntents(profileId: string) {
  // Read Dexie before other awaits so liveQuery tracks its dependencies.
  const intentions = projectSyncEvents(await readSyncEvents(profileId, db, ['installation'])).installations;
  await loadRuntimeResources();
  const current = new Set<string>(), unavailable = new Set<string>();
  for (const event of intentions.values()) {
    if (!event.payload.wanted) continue;
    const id = event.payload.contentId;
    if ([...runtimeResources.offline.groups, ...runtimeResources.sources.packs].some(group => group.id === id) && await officialContentHash(id) === event.payload.contentHash) current.add(id);
    else unavailable.add(id);
  }
  return { current, unavailable };
}
