import { beforeEach, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { asTestLesson, lessonSchema } from '../src/shared/content';
import { readingHighlightsOverlap, validateReadingAnnotations } from '../src/shared/readingAnnotations';
import { claimSession, createSession, db, saveReadingAnnotation, sessions } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
const lesson = lessonSchema.parse(raw);
const material = lesson.materials[0];
const block = material.blocks[0];
const annotation = { materialId: material.id, note: 'My own reading note', highlights: [{ blockId: block.id, start: 0, end: 5, text: block.text.slice(0, 5) }] };
it('requires bounded exact source spans and unique known materials', () => {
  expect(validateReadingAnnotations(lesson, [annotation])).toEqual([annotation]);
  for (const invalid of [
    [{ ...annotation, materialId: 'unknown' }], [annotation, annotation],
    [{ ...annotation, note: 'x'.repeat(4001) }],
    [{ ...annotation, highlights: [{ ...annotation.highlights[0], start: -1 }] }],
    [{ ...annotation, highlights: [{ ...annotation.highlights[0], text: 'false' }] }],
    [{ ...annotation, highlights: [{ ...annotation.highlights[0], end: block.text.length + 1 }] }],
    [{ ...annotation, highlights: Array.from({ length: 51 }, () => annotation.highlights[0]) }],
  ]) expect(() => validateReadingAnnotations(lesson, invalid)).toThrow();
});
it('saves annotations under the session lease without touching answers or assistance', async () => {
  const session = await createSession(lesson);
  await claimSession(session.id, 'tab', Date.now(), undefined, true);
  const before = await sessions.get(session.id);
  await expect(saveReadingAnnotation(session.id, 'other', annotation)).rejects.toThrow('BUSY');
  await saveReadingAnnotation(session.id, 'tab', annotation);
  const after = await sessions.get(session.id);
  expect(after?.readingAnnotations).toEqual([annotation]);
  expect(after?.assistance).toEqual(before?.assistance);
  expect(after?.draft).toEqual(before?.draft);
  expect(after?.position).toEqual(before?.position);
});
it('permits personal annotations in Test without revealing answers or enabling assistance', async () => {
  const session = await createSession(asTestLesson(lesson));
  await claimSession(session.id, 'tab', Date.now(), undefined, true);
  await saveReadingAnnotation(session.id, 'tab', annotation);
  const saved = await sessions.get(session.id);
  expect(saved?.lesson.mode).toBe('test');
  expect(saved?.assistance.hintLevel).toBe(0);
  expect(saved?.readingAnnotations).toEqual([annotation]);
});
it('preserves notes and exact highlights through ZIP backup and a new profile restore', async () => {
  const session = await createSession(lesson);
  await claimSession(session.id, 'tab', Date.now(), undefined, true);
  await saveReadingAnnotation(session.id, 'tab', annotation);
  const profile = await importBackup(await inspectBackup(await exportBackup(session.profileId)));
  const restored = await sessions.where('profileId').equals(profile).first();
  expect(restored?.readingAnnotations).toEqual([annotation]);
  expect(restored?.profileId).not.toBe(session.profileId);
  expect(restored?.owner).toBeUndefined();
});

it('removes overlapping marks while preserving adjacent spans and other blocks', () => {
  const mark = annotation.highlights[0];
  expect(readingHighlightsOverlap(mark, { ...mark, start: 2, end: 3 })).toBe(true);
  expect(readingHighlightsOverlap(mark, { ...mark, start: 5, end: 7 })).toBe(false);
  expect(readingHighlightsOverlap(mark, { ...mark, blockId: 'other' })).toBe(false);
});
