import { beforeEach, expect, it, vi } from 'vitest';
import { db, profiles, settings } from '../src/data/db';
import { readTreeDraft, saveTreeDraft } from '../src/data/treeDraft';
import { blankTree, drawTree, treeForms } from '../src/shared/tree';

const draft = { diagram: drawTree('(Root (A) (B))'), source: '(Root (A) (B))', form: 'constituency' as const, generated: false };
beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(db.tables.map(table => table.clear()));
  await profiles.bulkPut(['p', 'other'].map(id => ({ id, name: id, createdAt: new Date().toISOString() })));
});

it('keeps the latest complete draft per profile without adding history events', async () => {
  await saveTreeDraft('p', draft);
  await saveTreeDraft('other', { ...draft, source: 'unfinished sentence' });
  await saveTreeDraft('p', { ...draft, source: 'new text' });
  expect(await readTreeDraft('p')).toEqual({ ...draft, source: 'new text' });
  expect(await readTreeDraft('other')).toEqual({ ...draft, source: 'unfinished sentence' });
  expect(await readTreeDraft('missing')).toBeUndefined();
  expect(await db.table('syncEvents').count()).toBe(0);
});

it('preserves the previous draft after a write failure or invalid input', async () => {
  await saveTreeDraft('p', draft);
  const put = vi.spyOn(settings, 'put').mockRejectedValueOnce(new Error('QUOTA'));
  await expect(saveTreeDraft('p', { ...draft, source: 'unsaved' })).rejects.toThrow('QUOTA');
  put.mockRestore();
  expect(await readTreeDraft('p')).toEqual(draft);
  await expect(saveTreeDraft('p', { ...draft, source: 'x'.repeat(200_001) })).rejects.toThrow();
  expect(await readTreeDraft('p')).toEqual(draft);
  await settings.put({ key: 'profile:p:treeDraft', value: '{broken' });
  await expect(readTreeDraft('p')).rejects.toThrow();
  expect((await settings.get('profile:p:treeDraft'))?.value).toBe('{broken');
});

it('rejects late writes after profile switching or deletion', async () => {
  await saveTreeDraft('p', draft);
  await settings.put({ key: 'activeProfile', value: 'other' });
  await expect(saveTreeDraft('p', { ...draft, source: 'late' })).rejects.toThrow('TREE_DRAFT_SCOPE_CHANGED');
  expect(await readTreeDraft('p')).toEqual(draft);
  await profiles.delete('other');
  await expect(saveTreeDraft('other', draft)).rejects.toThrow('TREE_DRAFT_SCOPE_CHANGED');
  expect(await readTreeDraft('other')).toBeUndefined();
});


it('ignores cleared drafts in every form but retains unfinished text and a manually edited root', async () => {
  for (const form of treeForms) {
    const cleared = { diagram: blankTree(form), source: '', form, generated: false };
    await saveTreeDraft('p', cleared);
    expect(await readTreeDraft('p'), form).toBeUndefined();
    await saveTreeDraft('p', { ...cleared, source: 'unfinished sentence' });
    expect((await readTreeDraft('p'))?.source, form).toBe('unfinished sentence');
  }
  const edited = blankTree('constituency');
  edited.nodes[0].label = 'CustomRoot';
  await saveTreeDraft('p', { ...draft, diagram: edited, source: '' });
  expect((await readTreeDraft('p'))?.diagram.nodes[0].label).toBe('CustomRoot');
});
