import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export async function readCorpusLanguage(annotationPath) {
  const annotations = new Map();
if (annotationPath) {
  let header;
  for await (const line of createInterface({ input: createReadStream(annotationPath), crlfDelay: Infinity })) {
    const item = JSON.parse(line);
    if (!header) {
      header = item;
      if (header.spacy !== '3.8.16' || header.modelVersion !== '3.8.0' || !/^[a-f0-9]{64}$/.test(header.modelFilesSha256)) throw new Error('Unknown NLP provenance');
      continue;
    }
    if (annotations.has(item.rootId)) throw new Error('Duplicate annotation passage');
    annotations.set(item.rootId, { textHash: item.textSha256, language: {
      generator: 'spacy-3.8.16/en_core_web_sm-3.8.0', modelSha256: header.modelFilesSha256, reviewStatus: 'pending',
      tokens: item.tokens.filter(token => ['NOUN', 'VERB', 'ADJ', 'ADV'].includes(token.pos)
        && /^[a-z]{1,80}$/.test(token.lemma) && /^[a-z]{3,20}$/i.test(item.text.slice(token.start, token.end))
        && !/[a-z]/i.test(item.text[token.start - 1] ?? '') && !/[a-z]/i.test(item.text[token.end] ?? ''))
        .map(({ start, end, lemma, pos }) => ({ start, end, lemma, pos })),
    } });
  }
}
  return annotations;
}
