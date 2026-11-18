import { z } from 'zod';
import { treeDiagramSchema } from './tree';

const termSchema = z.string().trim().min(1).max(80).regex(/^[^\p{C}]+$/u);
export const lookupBaseSchema = z.object({
  kind: z.enum(['dictionary', 'grammar', 'ipa', 'tree']),
  term: termSchema,
  lookedUpAt: z.iso.datetime(),
  diagram: treeDiagramSchema.optional(),
}).strict();
export const lookupRecordSchema = lookupBaseSchema.superRefine((record, ctx) => {
  if (record.kind === 'tree' && !record.diagram) ctx.addIssue({ code: 'custom', message: 'Tree lookups require a diagram' });
  if (record.kind !== 'tree' && record.diagram) ctx.addIssue({ code: 'custom', message: 'Only tree lookups include a diagram' });
});
export const lookupHistorySchema = z.array(lookupRecordSchema).max(100);
export type LookupRecord = z.infer<typeof lookupRecordSchema>;

export function lookupKey(record: Pick<LookupRecord, 'kind' | 'term'>) {
  const term = record.term.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return JSON.stringify([record.kind, record.kind === 'ipa' ? term : term.toLocaleLowerCase('en')]);
}
