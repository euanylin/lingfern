import { z } from 'zod';
import { db, settings } from './db';
import { profileIdSchema } from '../shared/repository';

const lookupSchema = z.object({
  kind: z.enum(['dictionary', 'grammar', 'ipa']),
  term: z.string().trim().min(1).max(80).regex(/^[^\p{C}]+$/u),
  lookedUpAt: z.string().datetime(),
}).strict();
export type LookupRecord = z.infer<typeof lookupSchema>;
const historySchema = z.array(lookupSchema).max(100);
const key = (profileId: string) => `profile:${profileIdSchema.parse(profileId)}:lookupHistory`;

export async function readLookupHistory(profileId: string): Promise<LookupRecord[]> {
  const row = await settings.get(key(profileId));
  return row ? historySchema.parse(JSON.parse(row.value)) : [];
}

export async function recordLookup(profileId: string, kind: LookupRecord['kind'], term: string) {
  const record = lookupSchema.parse({ kind, term: term.normalize('NFKC').trim().replace(/\s+/g, ' '), lookedUpAt: new Date().toISOString() });
  const equal = (value: string) => kind === 'ipa' ? value : value.toLocaleLowerCase('en');
  await db.transaction('rw', settings, async () => {
    const previous = await readLookupHistory(profileId);
    const history = [record, ...previous.filter(item => item.kind !== kind || equal(item.term) !== equal(record.term))].slice(0, 100);
    await settings.put({ key: key(profileId), value: JSON.stringify(history) });
  });
}

export function lookupHistoryUrl(record: LookupRecord) {
  const { kind, term } = lookupSchema.parse(record);
  return `/library/${kind}?q=${encodeURIComponent(term)}`;
}
