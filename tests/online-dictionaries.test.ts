import { describe, expect, it } from 'vitest';
import { defaultOnlineDictionary, onlineDictionaries, onlineDictionaryUrl } from '../src/app/onlineDictionaries';

describe('external dictionary URLs', () => {
  it('keeps a fixed HTTPS host and the exact trimmed query for every provider', () => {
    const terms = ['apple', 'direct', 'take off', "don't", 'well-being', 'US', 'us', 'café', 'zzzxxyyqq', '  apple  ', 'a&b#c?d/e'];
    for (const dictionary of onlineDictionaries) for (const input of terms) {
      const url = new URL(onlineDictionaryUrl(input, dictionary.id)!);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe(dictionary.domain);
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      const query = dictionary.id === 'merriam-webster' ? decodeURIComponent(url.pathname.slice('/dictionary/'.length)) : url.searchParams.get(dictionary.id === 'wiktionary' ? 'search' : 'q');
      expect(query).toBe(input.trim());
    }
    expect(onlineDictionaryUrl('')).toBeUndefined();
    expect(onlineDictionaryUrl(' \t ')).toBeUndefined();
  });

  it('falls back to Cambridge for missing and invalid defaults', () => {
    expect(defaultOnlineDictionary()).toBe('cambridge');
    expect(defaultOnlineDictionary('unexpected')).toBe('cambridge');
    expect(onlineDictionaryUrl('apple', 'unexpected')).toBe(onlineDictionaryUrl('apple', 'cambridge'));
  });
});
