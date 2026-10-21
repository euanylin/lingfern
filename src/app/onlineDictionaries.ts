const encodeTerm = (query: string) => encodeURIComponent(query).replace(/['()*!]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
export const onlineDictionaries = [
  { id: 'cambridge', name: 'Cambridge Dictionary', shortName: 'Cambridge', domain: 'dictionary.cambridge.org', url: (query: string) => `https://dictionary.cambridge.org/search/english/?q=${encodeTerm(query)}` },
  { id: 'oxford', name: 'Oxford Learner’s Dictionaries', shortName: 'Oxford', domain: 'www.oxfordlearnersdictionaries.com', url: (query: string) => `https://www.oxfordlearnersdictionaries.com/search/english/?q=${encodeTerm(query)}` },
  { id: 'wiktionary', name: 'Wiktionary', shortName: 'Wiktionary', domain: 'en.wiktionary.org', url: (query: string) => `https://en.wiktionary.org/w/index.php?search=${encodeTerm(query)}` },
  { id: 'merriam-webster', name: 'Merriam-Webster', shortName: 'Merriam-Webster', domain: 'www.merriam-webster.com', url: (query: string) => `https://www.merriam-webster.com/dictionary/${encodeTerm(query)}` },
] as const;

export type OnlineDictionaryId = (typeof onlineDictionaries)[number]['id'];
export function defaultOnlineDictionary(value?: string): OnlineDictionaryId {
  return onlineDictionaries.find(dictionary => dictionary.id === value)?.id ?? 'cambridge';
}
export function onlineDictionaryUrl(query: string, id?: string) {
  const term = query.trim();
  if (!term) return undefined;
  return onlineDictionaries.find(dictionary => dictionary.id === defaultOnlineDictionary(id))!.url(term);
}

/** Use Cambridge's grammar dataset for grammar searches. */
export function cambridgeGrammarUrl(query: string) {
  const term = query.normalize('NFKC').trim();
  return term ? `https://dictionary.cambridge.org/search/direct/?datasetsearch=british-grammar&q=${encodeTerm(term)}` : 'https://dictionary.cambridge.org/grammar/british-grammar/';
}
