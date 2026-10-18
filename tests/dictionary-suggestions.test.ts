import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { rankDictionarySuggestions, lookupDictionary, lookupDictionarySense, suggestDictionary } from '../src/shared/dictionary';

describe('dictionary suggestions', () => {
  it('puts an exact entry first, then closer spellings and prefixes, with a 64-item cap', () => {
    const words = ['application', 'apply', 'aple', 'apples', 'apple'];
    const matches = rankDictionarySuggestions('  APPLE  ', words);
    expect(matches[0]).toBe('apple');
    expect(matches[1]).toBe('apples');
    expect(rankDictionarySuggestions('apple', [...words, ...Array.from({ length: 80 }, (_, index) => `apple${index}`)])).toHaveLength(64);
    expect(rankDictionarySuggestions('', words)).toEqual([]);
  });

  it('keeps phrases and accented terms queryable', () => {
    expect(rankDictionarySuggestions('front desk', ['desk', 'front desk', 'front door'])[0]).toBe('front desk');
    expect(rankDictionarySuggestions('cafe', ['coffee', 'café'])).toContain('café');
  });
});

for (const failure of ['offline', 'invalid']) it(`bundled course lookup survives ${failure} dictionary resources without inventing other entries`, async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { if (failure === 'offline') throw new Error('OFFLINE'); return new Response('null'); }));
  try {
    expect((await suggestDictionary('provided'))[0]).toBe('provided');
    const entry = await lookupDictionary('provided');
    expect(entry.course[0].definition).toContain('Only if a stated condition is met');
    expect(entry.senses).toEqual([]);
    const request = await lookupDictionary('call me');
    expect(request.course[0].definition).toContain('With a name after it');
    expect(request.course[0].definition).toContain('phone you');
    expect(request.course[0].senseId).toBeNull();
    expect(request.senses).toEqual([]);
    if (failure === 'offline') await expect(lookupDictionary('zebrawordnotincourse')).rejects.toThrow('OFFLINE');
  } finally { vi.unstubAllGlobals(); }
});


it('finds bundled course phrases beside an older installed index without duplicate suggestions', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(['call', 'calling', 'provided']))));
  try {
    expect((await suggestDictionary('call me'))[0]).toBe('call me');
    const provided = await suggestDictionary('provided');
    expect(provided.filter(term => term === 'provided')).toHaveLength(1);
    expect(provided).toHaveLength(new Set(provided).size);
  } finally { vi.unstubAllGlobals(); }
});

it('prioritises inspected course senses without assigning swimming-pool equivalence', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(await readFile('public' + url, 'utf8'))));
  try {
    for (const [term, id] of [['book', 'book%1:06:00::'], ['record', 'record%2:32:01::'], ['work out', 'work_out%2:29:00::'], ['upstairs', 'upstairs%4:02:00::'], ['request', 'request%1:10:01::'], ['concession', 'concession%1:10:02::'], ['show', 'show%1:04:00::']]) {
      const result = await lookupDictionary(term);
      expect(result.senses[0].id).toBe(id);
      expect(result.course[0].senseId).toBe(id);
      expect(result.senses.length).toBeGreaterThan(1);
    }
    for (const term of ['pool', 'awesome', 'link', 'roommate']) expect((await lookupDictionary(term)).course[0].senseId).toBeNull();
    const cafe = await lookupDictionary(' CAFE\u0301 ');
    expect(cafe.term).toBe('café');
    expect(cafe.matched).toBe('cafe');
    expect(cafe.senses.map(sense => sense.id)).toEqual(['cafe%1:06:00::']);
    expect(await lookupDictionarySense(cafe.senses[0].id)).toEqual({ term: 'cafe', definition: cafe.senses[0].definition });
    expect((await lookupDictionary('résumé')).senses.some(sense => sense.id.startsWith('resume%'))).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});
