// Penn Treebank tokenization, following NLTK's TreebankWordTokenizer (Apache-2.0).
const punctuation = new Map(Object.entries({
  '(': '-LRB-', ')': '-RRB-', '[': '-LSB-', ']': '-RSB-', '{': '-LCB-', '}': '-RCB-',
}));
const original = new Map([...punctuation].map(([word, key]) => [key, word]));
const contractions = [/\b(can)(not)\b/gi, /\b(d)('ye)\b/gi, /\b(gim)(me)\b/gi, /\b(gon)(na)\b/gi,
  /\b(got)(ta)\b/gi, /\b(lem)(me)\b/gi, /\b(more)('n)\b/gi, /\b(wan)(na)(?=\s)/gi, / ('t)(is|was)\b/gi];

export function treebankTokens(source) {
  let text = source.normalize('NFKC').trim().replace(/[“”]/gu, '"').replace(/[‘’]/gu, "'");
  text = text.replace(/^"/u, '``').replace(/``/gu, ' `` ').replace(/([ ([{<])("|'')/gu, '$1 `` ')
    .replace(/([:,])([^\p{Decimal_Number}])/gu, ' $1 $2').replace(/([:,])$/u, ' $1 ')
    .replace(/\.\.\./gu, ' ... ').replace(/[;@#$%&]/gu, ' $& ')
    .replace(/([^\.])(\.)([\])}>"']*)\s*$/u, '$1 $2$3 ').replace(/[?!]/gu, ' $& ').replace(/([^'])' /gu, "$1 ' ")
    .replace(/[\][(){}<>]/gu, ' $& ').replace(/--/gu, ' -- ');
  text = ` ${text} `.replace(/''|"/gu, " '' ").replace(/([^' ])('[smd]|') /gi, '$1 $2 ')
    .replace(/([^' ])('ll|'re|'ve|n't) /gi, '$1 $2 ');
  for (const contraction of contractions) text = text.replace(contraction, ' $1 $2 ');
  return text.trim().split(/\s+/u).map(word => punctuation.get(word) ?? word);
}

export function tokenizeHolCcg(tokenizer, words) {
  const ids = [0];
  const lengths = [];
  for (const word of words) {
    const text = (original.get(word) ?? word).replaceAll('\\/', '/');
    const pieces = tokenizer.encode(text, { add_special_tokens: false }).ids;
    if (!pieces.length) throw new Error('CCG_TOKENIZER');
    ids.push(...pieces);
    lengths.push(pieces.length);
  }
  ids.push(2);
  if (ids.length > 512) throw new Error('CCG_TOKENIZER_LENGTH');
  const pooling = new Float32Array(ids.length * words.length);
  let offset = 1;
  for (const [i, length] of lengths.entries()) {
    const begin = i * ids.length + offset;
    pooling.fill(1 / length, begin, begin + length);
    offset += length;
  }
  return { ids, pooling };
}
