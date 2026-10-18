import { z } from 'zod';
import type { Lesson } from './content';

export const readingAnnotationSchema = z.object({
  materialId: z.string().min(1).max(160),
  note: z.string().max(4000),
  highlights: z.array(z.object({ blockId: z.string().min(1).max(160), start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1).max(4000) }).strict()).max(50),
}).strict();
export const readingAnnotationsSchema = z.array(readingAnnotationSchema).max(20);
export type ReadingAnnotation = z.infer<typeof readingAnnotationSchema>;
export function readingHighlightsOverlap(left: ReadingAnnotation['highlights'][number], right: ReadingAnnotation['highlights'][number]) {
  return left.blockId === right.blockId && left.start < right.end && right.start < left.end;
}

export function validateReadingAnnotations(lesson: Lesson, value: unknown) {
  const annotations = readingAnnotationsSchema.parse(value);
  const ids = new Set<string>();
  for (const annotation of annotations) {
    const material = lesson.materials.find(item => item.id === annotation.materialId);
    if (!material || ids.has(annotation.materialId)) throw new Error('ANNOTATION_SOURCE');
    ids.add(annotation.materialId);
    for (const mark of annotation.highlights) {
      const block = material.blocks.find(item => item.id === mark.blockId);
      if (!block || mark.start >= mark.end || block.text.slice(mark.start, mark.end) !== mark.text || mark.end > block.text.length) throw new Error('ANNOTATION_SOURCE');
    }
  }
  return annotations;
}
