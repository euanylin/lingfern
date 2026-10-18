import { z } from 'zod';
import course from '../../content/dictionary-course.json';

export const senseSchema = z.object({ id: z.string().min(1), pos: z.enum(['noun', 'verb', 'adjective', 'adverb']), definition: z.string().min(1), example: z.string().optional() }).strict();
export const bucketSchema = z.record(z.string(), z.array(senseSchema));
export const formsSchema = z.record(z.string(), z.array(z.string().min(1)));
const headwordsSchema = z.array(z.string().min(1)).min(1).max(150_000);
const courseSchema = z.object({ reviewStatus: z.literal('draft'), source: z.string(), entries: z.array(z.object({ term: z.string(), senseId: z.string().nullable(), definition: z.string().min(1), example: z.string().min(1) }).strict()) }).strict();
export const courseEntries = courseSchema.parse(course).entries;
export type DictionarySense = z.infer<typeof senseSchema>;
const base = '/dictionary/oewn-2025/';
const cache = new Map<string, Promise<unknown>>();
async function asset<T>(name: string, schema: z.ZodType<T>): Promise<T> {
  if (!cache.has(name)) cache.set(name, fetch(base + name).then(response => {
    if (!response.ok) throw new Error('DICTIONARY_UNAVAILABLE');
    return response.json();
  }).then(value => schema.parse(value)).catch(error => { cache.delete(name); throw error; }));
  return cache.get(name) as Promise<T>;
}

export function normaliseTerm(value: string) {
  const term = value.normalize('NFKC').toLocaleLowerCase('en-US').trim().replace(/\s+/g, ' ');
  return term.length <= 80 && /^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u.test(term) ? term : '';
}

function distanceWithin(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let closest = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
      closest = Math.min(closest, current[j]);
    }
    if (closest > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

export function rankDictionarySuggestions(raw: string, headwords: string[]) {
  const term = normaliseTerm(raw);
  if (!term) return [];
  const limit = Math.min(4, Math.max(2, Math.ceil(term.length / 3)));
  const matches: { word: string; distance: number; prefix: boolean }[] = [];
  for (const word of headwords) {
    const prefix = word.startsWith(term);
    if (!prefix && Math.abs(word.length - term.length) > limit) continue;
    const distance = prefix ? word.length - term.length : distanceWithin(term, word, limit);
    if (prefix || distance <= limit) matches.push({ word, distance, prefix });
  }
  matches.sort((a, b) => a.distance - b.distance || Number(b.prefix) - Number(a.prefix) || a.word.localeCompare(b.word, 'en'));
  return matches.slice(0, 64).map(match => match.word);
}

export async function suggestDictionary(raw: string) {
  if (!normaliseTerm(raw)) return [];
  const indexed = rankDictionarySuggestions(raw, await asset('headwords.json', headwordsSchema).catch(() => []));
  return rankDictionarySuggestions(raw, [...new Set([...indexed, ...courseEntries.map(entry => normaliseTerm(entry.term))])]);
}

export function candidateTerms(value: string, forms: Record<string, string[]>) {
  const term = normaliseTerm(value);
  if (!term) return [];
  const candidates = new Set(forms[term] ?? []);
  if (term.length > 3 && term.endsWith('ies')) candidates.add(term.slice(0, -3) + 'y');
  if (term.length > 3 && term.endsWith('es')) candidates.add(term.slice(0, -2));
  if (term.length > 2 && term.endsWith('s')) candidates.add(term.slice(0, -1));
  if (term.length > 4 && term.endsWith('ing')) {
    const stem = term.slice(0, -3);
    candidates.add(stem);
    candidates.add(stem + 'e');
    if (stem.at(-1) === stem.at(-2)) candidates.add(stem.slice(0, -1));
  }
  if (term.length > 3 && term.endsWith('ed')) {
    const stem = term.slice(0, -2);
    candidates.add(stem);
    candidates.add(stem + 'e');
    if (stem.at(-1) === stem.at(-2)) candidates.add(stem.slice(0, -1));
  }
  if (term.length > 4 && term.endsWith('ied')) candidates.add(term.slice(0, -3) + 'y');
  candidates.delete(term);
  return [...candidates].slice(0, 12);
}

async function senses(term: string) {
  const first = term[0];
  const bucket = /^[a-z]$/.test(first) ? first : '0';
  return (await asset(`${bucket}.json`, bucketSchema))[term] ?? [];
}

export async function lookupDictionary(raw: string) {
  const term = normaliseTerm(raw);
  if (!term) return { term: '', matched: '', senses: [] as DictionarySense[], course: [] as typeof courseEntries };
  const course = courseEntries.filter(entry => normaliseTerm(entry.term) === term);
  let matched = term;
  let found = await senses(term).catch(error => { if (course.length) return [] as DictionarySense[]; throw error; });
  if (!found.length && course[0]?.senseId) {
    const mapped = await resolveSense(course[0].senseId).catch(() => undefined);
    if (mapped) { matched = mapped.term; found = [mapped.sense]; }
  }
  if (!found.length && !course.length) {
    const forms = await asset('forms.json', formsSchema);
    for (const candidate of candidateTerms(term, forms)) {
      found = await senses(candidate);
      if (found.length) { matched = candidate; break; }
    }
  }
  const senseId = course[0]?.senseId;
  if (senseId) found = [...found].sort((a, b) => Number(b.id === senseId) - Number(a.id === senseId));
  return { term, matched, senses: found, course };
}


// OEWN sense keys include their lemma. Resolve only an exact ID from the installed public dictionary.
async function resolveSense(memoryId: string) {
  const match = /^([^%]{1,80})%[1-5]:[0-9]{2}:[0-9]{2}:[^:]*:[^:]*$/.exec(memoryId);
  if (!match) return undefined;
  const term = normaliseTerm(match[1].replaceAll('_', ' '));
  if (!term) return undefined;
  const sense = (await senses(term)).find(entry => entry.id === memoryId);
  return sense && { term, sense };
}

export async function lookupDictionarySense(memoryId: string) {
  const mapped = await resolveSense(memoryId);
  return mapped && { term: mapped.term, definition: mapped.sense.definition };
}
