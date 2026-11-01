import Dexie from 'dexie';
import { attempts, db, exposures, feedbackNotes, profiles, sessions, settings, syncClocks, syncEvents, type Session } from './db';
import { appendSyncEvent, boundedReferences, readSyncEvents } from './sync';
import { exposureContactKey, projectSyncEvents } from '../shared/sync';
import { questions } from '../shared/content';
import { profileIdSchema } from '../shared/repository';

export async function deleteLocalProfile(profileId: string, expectedName: string) {
  profileIdSchema.parse(profileId);
  const remove = () => db.transaction('rw', db.tables, async () => {
    const profile = await profiles.get(profileId);
    if (!profile || profile.name !== expectedName || (await settings.get('activeProfile'))?.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
    if (await sessions.where('profileId').equals(profileId).filter(session => !!session.owner && session.leaseUntil > Date.now()).count()) throw new Error('BUSY');
    const lease = await settings.get(`profile:${profileId}:syncLease`);
    if (lease && JSON.parse(lease.value).expiresAt > Date.now()) throw new Error('BUSY');
    for (const table of db.tables) {
      if (table.name === 'profiles' || table.name === 'settings') continue;
      if (table.name === 'exposures') await table.where('[profileId+rootId]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).delete();
      else await table.where('profileId').equals(profileId).delete();
    }
    await settings.where('key').startsWith(`profile:${profileId}:`).delete();
    await profiles.delete(profileId);
    // Keep only an opaque local marker so delayed writes cannot resurrect deleted data.
    await syncClocks.put({ profileId, deviceId: crypto.randomUUID(), counter: 0, deleted: true });
    let next = await profiles.toCollection().first();
    if (!next) {
      next = { id: crypto.randomUUID(), name: 'Local profile', createdAt: new Date().toISOString() };
      await profiles.add(next);
    }
    await settings.put({ key: 'activeProfile', value: next.id });
    return next.id;
  });
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(`lingfern-sync:${profileId}`, { ifAvailable: true }, lock => {
    if (!lock) throw new Error('BUSY');
    return remove();
  });
  return remove();
}

async function purge(profileId: string) {
  const projected = projectSyncEvents(await readSyncEvents(profileId, db, ['deletion']));
  const deleted = projected.deletedRecords;
  // Without tombstones there is nothing to erase or resolve against local IDs.
  for (const attempt of deleted.size ? await attempts.where('profileId').equals(profileId).toArray() : []) {
    const event = await Dexie.waitFor(boundedReferences({ type: 'deletion', payload: { target: 'record', targetId: attempt.syncRecordId ?? attempt.id } }));
    if (event.type !== 'deletion' || !deleted.has(event.payload.targetId)) continue;
    await feedbackNotes.where('attemptId').equals(attempt.id).filter(note => note.profileId === profileId).delete();
    await attempts.delete(attempt.id);
    const session = await sessions.get(attempt.sessionId);
    if (session?.profileId === profileId) await sessions.update(session.id, { workspace: undefined, draft: undefined, readingAnnotations: undefined, recordsDeleted: true, owner: undefined, leaseUntil: 0 });
  }
  for (const exposure of projected.deletedExposures.size || projected.deletedContacts.size ? await exposures.where('profileId').equals(profileId).toArray() : []) {
    if (projected.deletedExposures.has(exposure.rootId)) { await exposures.delete([profileId, exposure.rootId]); continue; }
    if (!exposure.contacts?.length) continue;
    const kept = [];
    for (const contact of exposure.contacts) {
      const session = await sessions.get(contact.sessionId);
      const reference = await Dexie.waitFor(boundedReferences({ type: 'exposure', payload: { materialId: contact.materialId, variantGroup: contact.variantGroup, questionId: contact.questionId, sessionId: session?.syncSessionId ?? contact.sessionId, rootId: exposure.rootId } }));
      if (reference.type === 'exposure' && projected.deletedContacts.has(exposureContactKey(reference.payload))) continue;
      kept.push(contact);
    }
    if (kept.length === exposure.contacts.length) continue;
    if (!kept.length) await exposures.delete([profileId, exposure.rootId]);
    else await exposures.put({ ...exposure, contacts: kept, firstSeenAt: kept.map(contact => contact.firstSeenAt).sort()[0], lastSeenAt: kept.map(contact => contact.lastSeenAt).sort().at(-1)! });
  }
  // Full-session tombstones also remove restored snapshots on other devices.
  const localSessions = deleted.size ? await sessions.where('profileId').equals(profileId).toArray() : [];
  const removed = new Set<string>();
  for (const session of localSessions) {
    const markers = await Dexie.waitFor(Promise.all(questions(session.lesson).map(item => boundedReferences({ type: 'deletion', payload: { target: 'record', targetId: `${session.syncSessionId ?? session.id}:${item.question.id}` } }))));
    if (markers.length && markers.every(marker => marker.type === 'deletion' && deleted.has(marker.payload.targetId))) removed.add(session.id);
  }
  for (const session of localSessions) if (removed.has(session.id) && localSessions.some(sibling => !removed.has(sibling.id)
    && (!!session.practiceGroupId && sibling.practiceGroupId === session.practiceGroupId || !!session.checkGroupId && sibling.checkGroupId === session.checkGroupId))) removed.delete(session.id);
  if (removed.size) {
    for (const exposure of await exposures.where('profileId').equals(profileId).toArray()) {
      const contacts = exposure.contacts?.filter(contact => !removed.has(contact.sessionId));
      // Keep root familiarity without orphan references in profile backups.
      if (contacts && contacts.length !== exposure.contacts!.length) await exposures.put({ ...exposure, contacts });
    }
    await sessions.bulkDelete([...removed]);
  }
}

// Retain immutable batches and minimal tombstones; erase private answers and feedback.
export async function purgeDeletedRecords(profileId: string) {
  profileIdSchema.parse(profileId);
  await db.transaction('rw', [attempts, exposures, feedbackNotes, sessions, syncEvents], () => purge(profileId));
}

export async function deleteLearningRecord(profileId: string, recordId: string, removeExposure = false) {
  profileIdSchema.parse(profileId);
  const event = await boundedReferences({ type: 'deletion', payload: { target: 'record', targetId: recordId } });
  if (event.type !== 'deletion') throw new Error('NOT_FOUND');
  await db.transaction('rw', [attempts, exposures, feedbackNotes, sessions, settings, syncEvents, syncClocks], async () => {
    const active = await settings.get('activeProfile');
    if (active && active.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
    const local = await attempts.where('profileId').equals(profileId).filter(attempt => (attempt.syncRecordId ?? attempt.id) === recordId).first();
    const original = await readSyncEvents(profileId);
    const projected = projectSyncEvents(original);
    if (local) {
      const session = await sessions.get(local.sessionId);
      if (!session || session.profileId !== profileId || session.status === 'active') throw new Error('BUSY');
    } else if (!original.some(item => item.type === 'completion' && item.payload.recordId === event.payload.targetId) && !projected.deletedRecords.has(event.payload.targetId)) throw new Error('NOT_FOUND');
    if (removeExposure) {
      const completion = original.find(item => item.type === 'completion' && item.payload.recordId === event.payload.targetId);
      const session = local && await sessions.get(local.sessionId);
      const contact = completion?.type === 'completion' ? completion.payload : local ? { rootId: local.rootId, sessionId: session?.syncSessionId ?? local.sessionId, questionId: local.questionId } : undefined;
      if (contact) {
        const marker = await Dexie.waitFor(boundedReferences({ type: 'deletion', payload: { target: 'exposure_contact', targetId: contact.rootId, sessionId: contact.sessionId, questionId: contact.questionId } }));
        if (marker.type === 'deletion' && marker.payload.target === 'exposure_contact' && !projected.deletedContacts.has(exposureContactKey({ ...marker.payload, rootId: marker.payload.targetId }))) await appendSyncEvent(profileId, marker);
      }
    }
    if (!projected.deletedRecords.has(event.payload.targetId)) await appendSyncEvent(profileId, event);
    await purge(profileId);
  });
}

// Retain tombstones so sync cannot restore deleted answers or contacts.

export async function restartPractice(profileId: string, sessionId: string) {
  profileIdSchema.parse(profileId);
  await db.transaction('rw', [attempts, exposures, feedbackNotes, sessions, settings, syncEvents, syncClocks], async () => {
    const active = await settings.get('activeProfile');
    if (active && active.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
    const current = await sessions.get(sessionId);
    if (!current || current.profileId !== profileId) throw new Error('NOT_FOUND');
    if (current.lesson.mode === 'check' || current.checkGroupId || current.status !== 'active') throw new Error('PRACTICE_RESTRICTED');
    const selected = current.practiceGroupId
      ? await sessions.where('profileId').equals(profileId).filter(session => session.practiceGroupId === current.practiceGroupId).toArray()
      : [current];
    if (selected.some(session => session.profileId !== profileId || session.lesson.mode === 'check' || session.checkGroupId || session.lesson.mode !== current.lesson.mode || !['active', 'completed'].includes(session.status))
      || current.practiceGroupId && (selected.length !== 2 || new Set(selected.map(session => session.lesson.skill)).size !== 2)) throw new Error('PRACTICE_RESTRICTED');
    if (selected.some(session => session.owner && session.leaseUntil > Date.now())) throw new Error('BUSY');
    await deleteSessions(profileId, selected, true);
  });
}

export async function deleteLearningSession(profileId: string, sessionId: string) {
  profileIdSchema.parse(profileId);
  await db.transaction('rw', [attempts, exposures, feedbackNotes, sessions, settings, syncEvents, syncClocks], async () => {
    const active = await settings.get('activeProfile');
    if (active && active.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
    const current = await sessions.get(sessionId);
    if (!current || current.profileId !== profileId) throw new Error('NOT_FOUND');
    const selected = await sessions.where('profileId').equals(profileId).filter(session => session.id === sessionId
      || !!current.practiceGroupId && session.practiceGroupId === current.practiceGroupId
      || !!current.checkGroupId && session.checkGroupId === current.checkGroupId).toArray();
    if (selected.some(session => session.owner && session.leaseUntil > Date.now())) throw new Error('BUSY');
    await deleteSessions(profileId, selected, false);
  });
}

async function deleteSessions(profileId: string, selected: Session[], removeExposure: boolean) {
  const original = projectSyncEvents(await readSyncEvents(profileId));
  const recordIds = new Set<string>();
  for (const session of selected) {
    const local = await attempts.where('sessionId').equals(session.id).filter(attempt => attempt.profileId === profileId).toArray();
    for (const attempt of local) recordIds.add(attempt.syncRecordId ?? attempt.id);
    for (const item of questions(session.lesson)) {
      recordIds.add(`${session.syncSessionId ?? session.id}:${item.question.id}`);
      if (removeExposure) {
        const marker = await Dexie.waitFor(boundedReferences({ type: 'deletion', payload: { target: 'exposure_contact', targetId: item.material.rootId, sessionId: session.syncSessionId ?? session.id, questionId: item.question.id } }));
        if (marker.type === 'deletion' && marker.payload.target === 'exposure_contact' && !original.deletedContacts.has(exposureContactKey({ ...marker.payload, rootId: marker.payload.targetId }))) await appendSyncEvent(profileId, marker);
      }
    }
    for (const attempt of local) await feedbackNotes.where('attemptId').equals(attempt.id).filter(note => note.profileId === profileId).delete();
  }
  for (const recordId of recordIds) {
    const marker = await Dexie.waitFor(boundedReferences({ type: 'deletion', payload: { target: 'record', targetId: recordId } }));
    if (marker.type === 'deletion' && !original.deletedRecords.has(marker.payload.targetId)) await appendSyncEvent(profileId, marker);
  }
  // Resolve restored contact IDs before removing immutable snapshots.
  await purge(profileId);
  for (const session of selected) {
    await attempts.where('sessionId').equals(session.id).filter(attempt => attempt.profileId === profileId).delete();
    await sessions.delete(session.id);
  }
}
