import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = JSON.parse(await readFile('content/corpus/voa-beginners.json', 'utf8'));
const review = JSON.parse(await readFile('content/corpus/voa-beginner-review.json', 'utf8'));
for (const source of sources) if (!review.records.some(record => record.rootId === source.rootId && record.title === source.title && record.originalUrl === source.url && record.textSha256 === sha(source.text) && record.decision === 'supported-beginner-text')) throw new Error('UNREVIEWED_BEGINNER_SOURCE');
const corpus = JSON.parse(await readFile('public/corpus/voa.json', 'utf8'));
corpus.records = corpus.records.filter(record => !sources.some(source => source.rootId === record.rootId));
for (const source of sources) {
  const startingPoints = source.startingPoints ?? ['A1', 'A2'];
  if (!startingPoints.length || new Set(startingPoints).size !== startingPoints.length || startingPoints.some(point => !['A1', 'A2'].includes(point)) || source.startingPoints && JSON.stringify(review.records.find(record => record.rootId === source.rootId)?.startingPoints) !== JSON.stringify(startingPoints)) throw new Error('INVALID_BEGINNER_SUPPORT_SCOPE');
  const turns = source.text.split('\n');
  let text = '';
  for (const turn of turns) { const next = text ? text + '\n' + turn : turn; if (next.trim().split(/\s+/).length > 80) break; text = next; }
  if (/(?:…|\.{2,})\s*$/.test(text)) { const end = Math.max(text.lastIndexOf('. '), text.lastIndexOf('! '), text.lastIndexOf('? ')); if (end >= 0) text = text.slice(0, end + 1); }
  if (text.trim().split(/\s+/).length < 10 || !source.text.startsWith(text)) throw new Error('INVALID_BEGINNER_EXCERPT');
  const additional = (review.records.find(record => record.rootId === source.rootId).additionalExcerpts ?? []).map(excerpt => {
    const text = source.text.slice(excerpt.start, excerpt.end), wordCount = text.trim().split(/\s+/).length;
    if (!Number.isSafeInteger(excerpt.start) || !Number.isSafeInteger(excerpt.end) || excerpt.start <= 0 || excerpt.end <= excerpt.start || excerpt.end > source.text.length || source.text[excerpt.start - 1] !== '\n' || (excerpt.end < source.text.length && source.text[excerpt.end] !== '\n') || sha(text) !== excerpt.sha256 || excerpt.decision !== 'supported-beginner-text' || excerpt.reviewer !== 'Codex/AI' || JSON.stringify(excerpt.startingPoints) !== '["A2"]' || !startingPoints.includes('A2') || wordCount < 40 || wordCount > 160 || !/[.!?]$/.test(text)) throw new Error('INVALID_REVIEWED_BEGINNER_EXCERPT');
    return { id: sha(text), text, wordCount, startingPoints: excerpt.startingPoints };
  });
  const id = source.rootId.replace('voa-article-', 'voa-');
  corpus.records.push({ id, rootId: source.rootId, title: source.title, authors: ['VOA Learning English'], originalUrl: source.url, downloadUrl: source.url, acquiredAt: new Date(source.acquiredAt).toISOString(), language: 'en',
    licence: 'Original VOA Learning English text: public domain with attribution.', licenceUrl: 'https://learningenglish.voanews.com/p/6861.html', attribution: `VOA Learning English, ${source.title}. ${source.url}`, sourceHash: sha(source.text), originalText: source.text,
    reviewStatus: 'draft', permissionReview: 'Original attributed VOA dialogue text only; general VOA reuse terms checked2026-10-01. No third-party media adopted.', editorialReview: 'pending', processing: 'Codex inspected complete captured conversation; An unchanged turn-bounded prefix up to80 words; additional contiguous A2 excerpts individually hash-bound in voa-beginner-review.json. Beginner support scope only, not calibrated CEFR. No authored tasks.',
    passages: [{ id: sha(text), text, wordCount: text.trim().split(/\s+/).length, startingPoints }, ...additional] });
}
let dialogues = { records: [] };
try { dialogues = JSON.parse(await readFile('content/corpus/lingfern-dialogues.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
corpus.records = corpus.records.filter(record => !record.id.startsWith('lingfern-dialogue-'));
for (const source of dialogues.records) {
  const text = source.text.replace(/\s+$/, '');
  if (source.id !== source.rootId || !source.id.startsWith('lingfern-dialogue-') || !['A1', 'A2'].every(point => source.startingPoints.includes(point))) throw new Error('INVALID_LINGFERN_DIALOGUE');
  corpus.records.push({ id: source.id, rootId: source.rootId, title: source.title, authors: ['Lingfern'], originalUrl: `https://lingfern.com/corpus/${source.id}`, downloadUrl: `https://lingfern.com/corpus/${source.id}`, acquiredAt: '2026-10-10T13:40:00.000Z', language: 'en',
    licence: 'CC BY 4.0. Original Lingfern dialogue.', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', attribution: `${source.title} — Lingfern original dialogue. CC BY 4.0.`, sourceHash: sha(text), originalText: text,
    reviewStatus: 'draft', permissionReview: 'Maintainer authorised this original dialogue on 2026-10-10 for the four beginner singleton operations. It is not a third-party source.', editorialReview: 'pending', processing: 'Original dialogue. The existing parsers generate the questions. No parser rule was widened.',
    passages: [{ id: sha(text), text, wordCount: text.trim().split(/\s+/).length, startingPoints: source.startingPoints }] });
}
await writeFile('public/corpus/voa.json', JSON.stringify(corpus)+'\n');
await writeFile('content/corpus/voa.json', JSON.stringify(corpus, null, 2)+'\n');
console.log(`Retained ${sources.length} reviewed original beginner dialogues and ${dialogues.records.length} Lingfern dialogues; no authored questions.`);
