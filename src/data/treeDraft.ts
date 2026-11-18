import { z } from 'zod';
import { db } from './db';
import { profileIdSchema } from '../shared/repository';
import { isClearedTree, treeDiagramSchema, treeForms } from '../shared/tree';

const treeDraftSchema = z.object({
  diagram: treeDiagramSchema,
  source: z.string().max(200_000),
  form: z.enum(treeForms),
  generated: z.boolean(),
}).strict();
export type TreeDraft = z.infer<typeof treeDraftSchema>;
const key = (profileId: string) => `profile:${profileIdSchema.parse(profileId)}:treeDraft`;

export async function readTreeDraft(profileId: string): Promise<TreeDraft | undefined> {
  const row = await db.table('settings').get(key(profileId));
  if (!row) return;
  if (row.value.length > 4_000_000) throw new Error('TREE_DRAFT_TOO_BIG');
  const draft = treeDraftSchema.parse(JSON.parse(row.value));
  // Clearing is temporary; reopening starts with the worked example instead of an empty board.
  if (isClearedTree(draft.diagram, draft.source, draft.form)) return;
  return draft;
}

export async function saveTreeDraft(profileId: string, draft: TreeDraft) {
  const draftKey = key(profileId);
  const value = JSON.stringify(treeDraftSchema.parse(draft));
  await db.transaction('rw', ['settings', 'profiles'], async () => {
    const active = await db.table('settings').get('activeProfile');
    if (!await db.table('profiles').get(profileId) || active && active.value !== profileId) throw new Error('TREE_DRAFT_SCOPE_CHANGED');
    await db.table('settings').put({ key: draftKey, value });
  });
}
