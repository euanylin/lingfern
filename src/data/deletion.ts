import Dexie from 'dexie';
import { attempts, db, exposures, feedbackNotes, sessions, settings, syncClocks, syncEvents } from './db';
import { appendSyncEvent, boundedReferences, readSyncEvents } from './sync';
import { exposureContactKey, projectSyncEvents } from '../shared/sync';
import { questions } from '../shared/content';
import { profileIdSchema } from '../shared/repository';

async function purge(profileId: string) {
  const projected = projectSyncEvents(await readSyncEvents(profileId));
  const deleted = projected.deletedRecords;
  for (const attempt of await attempts.where('profileId').equals(profileId).toArray()) {
    const event = await Dexie.waitFor(boundedReferences({ type: 'deletion', payload: { target: 'record', targetId: attempt.syncRecordId ?? attempt.id } }));
    if (event.type !== 'deletion' || !deleted.has(event.payload.targetId)) continue;
    await feedbackNotes.where('attemptId').equals(attempt.id).filter(note => note.profileId === profileId).delete();
    await attempts.delete(attempt.id);
    const session = await sessions.get(attempt.sessionId);
    if (session?.profileId === profileId) await sessions.update(session.id, { workspace: undefined, draft: undefined, readingAnnotations: undefined, recordsDeleted: true, owner: undefined, leaseUntil: 0 });
  }
  for (const exposure of await exposures.where('profileId').equals(profileId).toArray()) {
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
}

// Keep immutable structured batches and the minimal tombstone; erase private answer/feedback text.
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

// Restart removes only the current practice snapshots. Tombstones keep sealed sync
// batches from restoring their answers or exposure contacts on another device.
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
    const original = projectSyncEvents(await readSyncEvents(profileId));
    const recordIds = new Set<string>();
    for (const session of selected) {
      const local = await attempts.where('sessionId').equals(session.id).filter(attempt => attempt.profileId === profileId).toArray();
      for (const attempt of local) recordIds.add(attempt.syncRecordId ?? attempt.id);
      for (const item of questions(session.lesson)) {
        recordIds.add(`${session.syncSessionId ?? session.id}:${item.question.id}`);
        const marker = await Dexie.waitFor(boundedReferences({ type: 'deletion', payload: { target: 'exposure_contact', targetId: item.material.rootId, sessionId: session.syncSessionId ?? session.id, questionId: item.question.id } }));
        if (marker.type === 'deletion' && marker.payload.target === 'exposure_contact' && !original.deletedContacts.has(exposureContactKey({ ...marker.payload, rootId: marker.payload.targetId }))) await appendSyncEvent(profileId, marker);
      }
      for (const attempt of local) await feedbackNotes.where('attemptId').equals(attempt.id).filter(note => note.profileId === profileId).delete();
    }
    for (const recordId of recordIds) {
      const marker = await Dexie.waitFor(boundedReferences({ type: 'deletion', payload: { target: 'record', targetId: recordId } }));
      if (marker.type === 'deletion' && !original.deletedRecords.has(marker.payload.targetId)) await appendSyncEvent(profileId, marker);
    }
    // Resolve restored contact IDs while their immutable snapshots still exist.
    await purge(profileId);
    for (const session of selected) {
      await attempts.where('sessionId').equals(session.id).filter(attempt => attempt.profileId === profileId).delete();
      await sessions.delete(session.id);
    }
  });
}
