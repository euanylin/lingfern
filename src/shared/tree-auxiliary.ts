// Normalize only unambiguous auxiliary spellings; saved/displayed tokens keep their surface form.
const spellings = new Map([["'m", 'am'], ["'re", 'are'], ["'ve", 'have'], ["'ll", 'will']]);
const negativeStems = new Map([['ca', 'can'], ['wo', 'will'], ['sha', 'shall']]);

export function auxiliaryKey(word: string, negated = false) {
  const key = word.toLocaleLowerCase('en').replaceAll('’', "'");
  return spellings.get(key) ?? (negated ? negativeStems.get(key) : undefined) ?? key;
}
