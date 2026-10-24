import { z } from 'zod';

export const lookupRecordSchema = z.object({
  kind: z.enum(['dictionary', 'grammar', 'ipa']),
  term: z.string().trim().min(1).max(80).regex(/^[^\p{C}]+$/u),
  lookedUpAt: z.iso.datetime(),
}).strict();
export const lookupHistorySchema = z.array(lookupRecordSchema).max(100);
export type LookupRecord = z.infer<typeof lookupRecordSchema>;

export function lookupKey(record: Pick<LookupRecord, 'kind' | 'term'>) {
  const term = record.term.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return JSON.stringify([record.kind, record.kind === 'ipa' ? term : term.toLocaleLowerCase('en')]);
}
