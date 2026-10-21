import exclusions from '../content/daily-quote-exclusions.json';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { selectCorpusPassage, corpusLesson, corpusMaterial, corpusMaterialRoot, corpusSchema, filterCorpusRoots, type Corpus } from '../src/core/corpus';
import { reviewedReading } from '../src/data/corpus';
import { claimSession, createSession, db, sessions, submit } from '../src/data/db';
import { asTestLesson, questions, score } from '../src/shared/content';
// @ts-expect-error Node-only packaging is JavaScript; this regression exercises its actual ZIP output.
import { createTopicPacks } from '../scripts/topic-packs.mjs';
import { inspectCommunityPack } from '../src/data/communityPack';
import { unzipSync, zipSync } from 'fflate';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
// Isolated synthetic provenance fixtures exercise validation, not source admission or CEFR.
function source(pageId: number, workId: number, text = 'The library contains interesting books. Readers discover different stories and compare their meanings.') {
  const revisionId = pageId + 100, url = `https://en.wikiquote.org/w/index.php?oldid=${revisionId}`, digest = hash(text);
  return { id: `wikiquote-${pageId}`, rootId: `wikiquote-page-${pageId}`, title: `Quote page ${pageId}`, authors: ['Wikiquote contributors'],
    originalUrl: url, downloadUrl: url, acquiredAt: '2026-10-09T00:00:00Z', language: 'en',
    licence: 'CC BY-SA 4.0 editorial arrangement; original quotation rights retained.', licenceUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
    attribution: `Wikiquote page ${pageId}, revision ${revisionId}.`, sourceHash: 'a'.repeat(64), reviewStatus: 'draft', permissionReview: 'Fixture only; regional rights unverified.', editorialReview: 'pending', processing: 'One quotation, no concatenation.',
    passages: [{ id: digest, text, wordCount: text.split(/\s+/).length, quoteProvenance: { pageId, revisionId, pageTitle: `Quote page ${pageId}`, revisionTimestamp: '2026-10-01T00:00:00Z', pageTextSha256: 'a'.repeat(64),
      section: ['Quotes'], locator: 'Fixture work', url: url + '#Quotes', rawBlockSha256: 'b'.repeat(64), sourceStart: 10, sourceEnd: 200, textSha256: digest,
      rightsEvidence: { workId: `gutenberg-${workId}`, sourceHash: 'c'.repeat(64), matchedStart: 30, matchedEnd: 180, matchedTextSha256: 'd'.repeat(64), metadataSha256: 'e'.repeat(64), rightsBasis: 'Fixture source evidence, not accepted material.' } } }],
  };
}
const bank = (...records: ReturnType<typeof source>[]) => corpusSchema.parse({ version: 1, records, failures: [] });
function ordinary(workId: number, text = 'The library contains interesting books. Readers discover different stories and compare their meanings.') {
  const record = source(workId, workId), originalUrl = `https://www.gutenberg.org/ebooks/${workId}`;
  const wording = Array.from({ length: 10 }, () => text).join(' ');
  return { ...record, id: `gutenberg-${workId}`, rootId: `gutenberg-book-${workId}`, originalUrl,
    downloadUrl: `https://www.gutenberg.org/cache/epub/${workId}/pg${workId}.txt`, licenceUrl: 'https://www.gutenberg.org/policy/license.html',
    passages: [{ id: hash(wording), text: wording, wordCount: wording.split(/\s+/).length }] };
}
const ordinaryBank = () => corpusSchema.parse({ version: 1, records: [ordinary(1000), ordinary(1001, 'Careful readers examine thoughtful descriptions. The writer preserves complete evidence and considers another interpretation.')], failures: [] });
const withOrdinary = (quotes: Corpus): Corpus => ({ ...quotes, records: [...ordinaryBank().records, ...quotes.records] });
afterEach(async () => { await db.delete(); await db.open(); });

it('requires quotation provenance tied to the Wikiquote page, revision, text identity and exact source ranges', () => {
  const record = source(1, 100, 'Meaningful quotation.');
  expect(bank(record).records[0].passages[0].wordCount).toBe(2);
  for (const mutate of [
    (r: typeof record) => { r.passages[0].quoteProvenance.pageId = 2; },
    (r: typeof record) => { r.passages[0].quoteProvenance.revisionId = 2; },
    (r: typeof record) => { r.passages[0].quoteProvenance.pageTextSha256 = 'f'.repeat(64); },
    (r: typeof record) => { r.passages[0].quoteProvenance.textSha256 = 'f'.repeat(64); },
    (r: typeof record) => { r.passages[0].quoteProvenance.sourceEnd = 10; },
    (r: typeof record) => { r.passages[0].quoteProvenance.rightsEvidence.matchedEnd = 30; },
    (r: typeof record) => { r.originalUrl = r.originalUrl.replace('en.wikiquote.org', 'en.wikiquote.org.evil.example'); },
  ]) {
    const changed = structuredClone(record); mutate(changed);
    expect(corpusSchema.safeParse({ version: 1, records: [changed], failures: [] }).success).toBe(false);
  }
  const uncredited = JSON.parse(JSON.stringify(record)); delete uncredited.passages[0].quoteProvenance;
  expect(corpusSchema.safeParse({ version: 1, records: [uncredited], failures: [] }).success).toBe(false);
  expect(corpusSchema.safeParse({ version: 1, records: [{ ...record, originalText: record.passages[0].text }], failures: [] }).success).toBe(false);
  const promoted = JSON.parse(JSON.stringify(record)); promoted.passages[0].startingPoints = ['A1'];
  expect(corpusSchema.safeParse({ version: 1, records: [promoted], failures: [] }).success).toBe(false);
  const ordinary = { ...record, id: 'gutenberg-100', rootId: 'gutenberg-book-100', originalUrl: 'https://www.gutenberg.org/ebooks/100', downloadUrl: 'https://www.gutenberg.org/cache/epub/100/pg100.txt', licenceUrl: 'https://www.gutenberg.org/policy/license.html' };
  expect(corpusSchema.safeParse({ version: 1, records: [ordinary], failures: [] }).success).toBe(false);
});

it('checks actual quotation text hashes before reviewed loading rather than trusting a declared identity', async () => {
  const original = bank(source(1, 100));
  expect(await reviewedReading(original.records)).toEqual(original.records);
  const changed = structuredClone(original.records); changed[0].passages[0].text = changed[0].passages[0].text.replace('interesting', 'unfamiliar');
  await expect(reviewedReading(changed)).rejects.toThrow('CORPUS_INTEGRITY');
});

it('keeps exposure and unfamiliar-root filtering at the original-work boundary across different Wikiquote pages', () => {
  const corpus = bank(source(1, 100), source(2, 100, 'Readers consider thoughtful descriptions and preserve complete evidence.'), source(3, 74, 'Every careful reader examines the passage and supports a different interpretation.'));
  expect(corpusMaterialRoot(corpus.records[0], corpus.records[0].passages[0])).toBe('gutenberg-book-100');
  expect(filterCorpusRoots(corpus, new Set(['gutenberg-book-100'])).records.map(r => r.id)).toEqual(['wikiquote-3']);
  expect(filterCorpusRoots(corpus, new Set(['gutenberg-book-100']), true).records.map(r => r.id)).toEqual(['wikiquote-1', 'wikiquote-2']);
  expect(corpusLesson(bank(source(1, 100), source(2, 100, 'Readers consider thoughtful descriptions and preserve complete evidence.')), new Set(), 0, 400, 'B1', [], 'completion')).toBeUndefined();
  expect(corpusLesson(corpus, new Set(), 0, 400, 'A1')).toBeUndefined();
  expect(corpusLesson(corpus, new Set(), 0, 400, 'A2')).toBeUndefined();
  expect(corpusLesson(corpus, new Set(), 0, 400, 'B1', [], 'completion')).toBeUndefined();
  const direct = corpusMaterial({ source: corpus.records[0], passage: corpus.records[0].passages[0] }, 0, 'B1', 'completion')!;
  expect(direct.rootId).toBe('gutenberg-book-100');
  const lesson = corpusLesson(withOrdinary(corpus), new Set(), 0, 400, 'B1', [], 'completion')!;
  expect(lesson.sourceId).toBe('wikiquote-corpus');
  expect(lesson.materials.map(m => m.rootId)).toEqual(['gutenberg-book-1000', 'gutenberg-book-100']);
  expect(lesson.materials[1].credit!.sourceUrl).toBe('https://en.wikiquote.org/w/index.php?oldid=101#Quotes');
  for (const material of lesson.materials) {
    const question = material.questions[0]; if (!('kind' in question) || question.kind !== 'completion') throw Error('Expected completion');
    expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end)).toContain(question.answer);
    expect(score(question, question.answer).correct).toBe(true);
    expect(score(question, 'incorrect').correct).toBe(false);
  }
});

it('rejects apparent transfer to the same original Gutenberg work and identical text under another page', () => {
  const one = bank(source(1, 100)).records[0];
  const ordinary: Corpus['records'][number] = { ...one, id: 'gutenberg-100', rootId: 'gutenberg-book-100', originalUrl: 'https://www.gutenberg.org/ebooks/100', downloadUrl: 'https://www.gutenberg.org/cache/epub/100/pg100.txt', licenceUrl: 'https://www.gutenberg.org/policy/license.html', passages: [{ id: hash('ordinary'), text: 'The reader examines interesting descriptions. '.repeat(30).trim(), wordCount: 150 }] };
  expect(corpusLesson({ version: 1, records: [one, ordinary], failures: [] }, new Set(), 0, 400, 'B1', [], 'completion')).toBeUndefined();
  expect(corpusLesson(bank(source(1, 100), source(2, 74)), new Set(), 0, 400, 'B1', [], 'completion')).toBeUndefined();
  const sameOriginal = corpusLesson(withOrdinary(bank(source(1, 1000))), new Set(), 0, 400, 'B1', [], 'completion')!;
  expect(sameOriginal.materials.every(material => !material.sourceId?.startsWith('wikiquote-'))).toBe(true);
  const sameText = corpusLesson(withOrdinary(bank(source(1, 74, ordinaryBank().records[0].passages[0].text))), new Set(), 0, 400, 'B1', [], 'completion')!;
  expect(sameText.materials.every(material => !material.sourceId?.startsWith('wikiquote-'))).toBe(true);
});

it.each(['B1', 'B2', 'C1', 'C2'] as const)('caps the whole successful session at one independent Wikiquote slot in sixteen for every focus and training entry at %s', level => {
  const corpus = withOrdinary(bank(source(1, 100), source(2, 74, 'Readers consider thoughtful descriptions and preserve complete evidence.')));
  for (const focus of [undefined, 'completion', 'sequence', 'evidence', 'matching', 'table', 'choice'] as const) for (const base of [0, 1, 7, 268435455]) for (const separate of [false, true]) {
    const lessons = Array.from({ length: 16 }, (_, slot) => corpusLesson(separate ? ordinaryBank() : corpus, new Set(), base * 16 + slot, 400, level, [], focus, [], undefined, separate ? corpus : undefined));
    const successful = lessons.filter(lesson => lesson !== undefined);
    expect(successful.length === 0 || successful.length === 16).toBe(true);
    if (!successful.length) continue;
    expect(successful[0].materials[0]).toEqual(corpusLesson(ordinaryBank(), new Set(), base, 400, level, [], focus)!.materials[0]);
    const quoted = successful.filter(lesson => lesson.materials.some(material => material.sourceId?.startsWith('wikiquote-')));
    expect(quoted.length / successful.length).toBeLessThan(1 / 8);
    expect(quoted.length).toBeLessThanOrEqual(1);
    for (let slot = 0; slot < 16; slot++) {
      expect(lessons[slot]!.generation!.seed).toBe(base * 16 + slot);
      expect(lessons[slot]!.materials[0]).toEqual(lessons[1]!.materials[0]);
      expect(lessons[slot]!.materials[0].sourceId).not.toMatch(/^wikiquote-/);
      if (slot) expect(lessons[slot]!.materials).toEqual(lessons[1]!.materials);
      const testing = asTestLesson(lessons[slot]!);
      expect(testing.materials.some(material => material.sourceId?.startsWith('wikiquote-'))).toBe(lessons[slot]!.materials.some(material => material.sourceId?.startsWith('wikiquote-')));
    }
  }
});

it('preserves actual beginner primary teaching and operation cycles when ineligible quotations are installed', () => {
  const voa = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const mixed = { ...voa, records: [...voa.records, ...bank(source(1, 100)).records] };
  for (const level of ['A1', 'A2'] as const) for (let index = 0; index < 13; index++) {
    const seed = Math.imul(index + 1, 0x9e3779b1) >>> 0, maxWords = level === 'A1' ? 120 : 160;
    const baseline = corpusLesson(voa, new Set(), seed, maxWords, level)!;
    expect(baseline).toBeDefined();
    for (const installed of [corpusLesson(mixed, new Set(), seed, maxWords, level), corpusLesson(voa, new Set(), seed, maxWords, level, [], undefined, [], undefined, mixed)]) {
      expect(installed!.materials[0]).toEqual(baseline.materials[0]);
      expect(installed!.materials).toEqual(baseline.materials);
      expect(installed!.generation!.seed).toBe(seed);
      expect(asTestLesson(installed!).materials).toEqual(asTestLesson(baseline).materials);
      expect(installed!.materials.some(material => material.sourceId?.startsWith('wikiquote-'))).toBe(false);
    }
  }
});

it('retains malformed-seed rejection with quotation sampling and beginner exclusion', () => {
  const corpus = withOrdinary(bank(source(1, 100)));
  for (const seed of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) for (const level of ['A1', 'A2', 'B1', 'C2'] as const) {
    expect(() => corpusLesson(corpus, new Set(), seed, 400, level)).toThrow('INVALID_CORPUS_SELECTION');
  }
});

it('keeps real ordinary fallback and review routing when quotations are unsupported, seen, or the only available sources', () => {
  const quoted = bank(source(1, 100, 'It is.'));
  expect(corpusMaterial({ source: quoted.records[0], passage: quoted.records[0].passages[0] }, 0, 'B1', 'completion')).toBeUndefined();
  for (let seed = 0; seed < 32; seed++) {
    expect(corpusLesson(quoted, new Set(), seed, 400, 'B1')).toBeUndefined();
    const result = corpusLesson(withOrdinary(quoted), new Set(), seed, 400, 'B1', [], 'completion')!;
    expect(result).toBeDefined();
    expect(result.materials.every(material => !material.sourceId?.startsWith('wikiquote-'))).toBe(true);
  }
  const reviewQuote = bank(source(1, 100, 'An unfamiliar keyword enters the discussion. Readers examine its meaningful implications and preserve evidence.'));
  const reviewed = corpusLesson(withOrdinary(reviewQuote), new Set(), 0, 400, 'B1', [], 'completion', ['keyword'])!;
  expect(reviewed.materials.every(material => !material.blocks[0].text.includes('keyword'))).toBe(true);
  const seen = new Set([reviewQuote.records[0].passages[0].id]);
  expect(corpusLesson(withOrdinary(reviewQuote), seen, 0, 400, 'B1', [], 'completion')!.materials.every(material => !material.sourceId?.startsWith('wikiquote-'))).toBe(true);
});

it('retains exact quotation snapshots and source identity when Practice and Test sessions are saved and reloaded', async () => {
  const lesson = corpusLesson(withOrdinary(bank(source(1, 100), source(2, 74, 'Readers consider thoughtful descriptions and preserve complete evidence.'))), new Set(), 0, 400, 'B1', [], 'completion')!;
  for (const mode of [undefined, 'test'] as const) {
    const session = await createSession(mode ? asTestLesson(lesson) : lesson, `wikiquote-${mode ?? 'practice'}`);
    await claimSession(session.id, 'quote-tab');
    const question = questions(session.lesson)[0].question;
    if (!('kind' in question) || question.kind !== 'completion') throw Error('Expected completion');
    const attempt = await submit(session.id, 'quote-tab', question.answer);
    expect(attempt.rootId).toBe('gutenberg-book-1000');
    await db.close(); await db.open();
    const restored = await sessions.get(session.id);
    expect(restored!.lesson).toEqual(session.lesson);
    expect(restored!.lesson.materials[1].sourceId).toBe('wikiquote-1');
    expect(restored!.draft).toBe(question.answer);
  }
});

it('packages and imports complete separate quotations with Wikiquote licence notices and refuses missing notices', async () => {
  const corpus = bank(source(1, 100), source(2, 74, 'Readers consider thoughtful descriptions and preserve complete evidence.'));
  const entries = corpus.records.map(record => ({ skill: 'reading', topic: 'literature', record, sources: [{ id: record.id, title: record.title, author: record.authors.join('; '), license: record.licence, attribution: record.attribution, sourceUrl: record.originalUrl }], media: {} }));
  const packs = createTopicPacks(entries, { literature: { en: 'Literature', 'zh-Hans': '文学', 'zh-Hant': '文學' } }, '');
  expect(packs).toHaveLength(1);
  const imported = await inspectCommunityPack(packs[0].bytes);
  expect(imported.corpus!.records).toEqual(corpus.records);
  const files = unzipSync(packs[0].bytes);
  expect(files['wikiquote-CC-BY-SA-4.0.txt']).toBeTruthy();
  delete files['wikiquote-README.md'];
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])); delete manifest.files['wikiquote-README.md'];
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  await expect(inspectCommunityPack(zipSync(files))).rejects.toThrow('COMMUNITY_SOURCE');
});

it('accepts modern original-rights variants with exact ownership and rejects mismatched licences and boundaries', () => {
 const modern = readdirSync('public/corpus').filter(file=>/^wikiquote(?:-\d+)?\.json$/.test(file)).flatMap(file=>JSON.parse(readFileSync('public/corpus/'+file,'utf8')).records).filter(record=>record.passages.some((passage: Corpus['records'][number]['passages'][number])=>'kind' in passage.quoteProvenance!.rightsEvidence));
 expect(modern.length).toBeGreaterThan(0);
 for(const record of modern){
  expect(corpusSchema.safeParse({version:1,records:[record],failures:[]}).success).toBe(true);
  for(const field of ['workId','rightsUrl','sourceUrl','matchedEnd']){
   const changed=structuredClone(record), work=changed.passages.find((p: Corpus['records'][number]['passages'][number])=>'kind' in p.quoteProvenance!.rightsEvidence).quoteProvenance.rightsEvidence;
   work[field]=field==='matchedEnd'?work.matchedStart:field==='rightsUrl'?(work.kind==='us-government'?'https://creativecommons.org/licenses/by/4.0/':'https://www.govinfo.gov/content/pkg/USCODE-2024-title17/html/USCODE-2024-title17-chap1-sec105.htm'):field==='workId'?'gutenberg-1':'https://unverified.example/text';
   expect(corpusSchema.safeParse({version:1,records:[changed],failures:[]}).success).toBe(false);
  }
 }
});
it('leaves legacy installed quote packs parseable while excluding inspected religious wording from new generation', () => {
 const excluded=exclusions[0], record=source(63415,123,excluded.text);
 const legacy=bank(record);
 expect(selectCorpusPassage(legacy,new Set(),0,700)).toBeUndefined();
 for(let seed=0;seed<64;seed++){
  const lesson=corpusLesson(withOrdinary(legacy),new Set(),seed,300,'B2');
  expect(lesson?.materials.some(material=>material.blocks.some(block=>block.text===excluded.text))).toBe(false);
 }
 const whitespace=structuredClone(record);whitespace.passages[0].text='  '+excluded.text.replaceAll(' ','  ');whitespace.passages[0].id=hash(whitespace.passages[0].text);whitespace.passages[0].quoteProvenance.textSha256=whitespace.passages[0].id;
 expect(selectCorpusPassage(bank(whitespace),new Set(),0,700)).toBeUndefined();
});

it('generates and scores unchanged modern source wording, and recovers its saved Practice/Test snapshots', async () => {
 const records: Corpus['records'] = readdirSync('public/corpus').filter(file=>/^wikiquote(?:-\d+)?\.json$/.test(file)).flatMap(file=>JSON.parse(readFileSync('public/corpus/'+file,'utf8')).records);
 const modern = records.flatMap(source=>source.passages.filter(passage=>'kind' in passage.quoteProvenance!.rightsEvidence).map(passage=>({source,passage})));
 expect(modern).toHaveLength(19);
 for(const selected of modern){
  const material=corpusMaterial(selected,0,'B2','completion')!;
  expect(material).toBeDefined();expect(material.blocks[0].text).toBe(selected.passage.text);
  expect(material.rootId).toBe(selected.passage.quoteProvenance!.rightsEvidence.workId);
  const question=material.questions[0];expect('kind' in question && question.kind).toBe('completion');
  if(!('kind' in question) || question.kind!=='completion')throw new Error('EXPECTED_COMPLETION');
  expect(material.blocks[0].text.slice(question.evidence.start,question.evidence.end)).toContain(question.answer);
  expect(score(question,question.answer)?.correct).toBe(true);
 }
 const selected=modern.find(row=>row.passage.quoteProvenance!.rightsEvidence.workId.startsWith('cc-by-'))!;
 const bank=corpusSchema.parse({version:1,records:[{...selected.source,passages:[selected.passage]}],failures:[]});
 const primary=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json','utf8')));
 let lesson: ReturnType<typeof corpusLesson>;
 for(let base=0;base<100 && !lesson;base++){
  const candidate=corpusLesson(primary,new Set(),base*16,300,'B2',[],'completion',[],undefined,bank);
  if(candidate?.materials.some(material=>material.blocks[0].text===selected.passage.text))lesson=candidate;
 }
 expect(lesson).toBeDefined();
 expect(lesson!.materials[0].rootId).not.toBe(lesson!.materials[1].rootId);
 for(const mode of ['practice','test']as const){
  const snapshot=mode==='test'?asTestLesson(lesson!):lesson!;
  const session=await createSession(snapshot,'modern-source-regression');
  const recovered=(await sessions.get(session.id))!;
  expect(recovered.lesson).toEqual(snapshot);
 }
});

it('preserves older readable wording but holds archaic quotation forms in already installed packages', () => {
 const archaic=bank(source(1,123,'Thou shalt consider thy words and preserve thine evidence.'));
 expect(selectCorpusPassage(archaic,new Set(),0,700)).toBeUndefined();
 const older=bank(source(2,123,'Careful readers consider the meaning and preserve complete evidence.'));
 expect(selectCorpusPassage(older,new Set(),0,700)).toBeDefined();
});

it('keeps at least 3000 separate source-bound reading quotes with scorable generated tasks', () => {
 const records: Corpus['records'] = readdirSync('public/corpus').filter(file=>/^wikiquote(?:-\d+)?\.json$/.test(file)).flatMap(file=>corpusSchema.parse(JSON.parse(readFileSync('public/corpus/'+file,'utf8'))).records);
 const passages=records.flatMap(source=>source.passages.map(passage=>({source,passage})));
 expect(passages.length).toBeGreaterThanOrEqual(3000);
 for(const selected of passages){
  const {passage}=selected;
  expect(hash(passage.text)).toBe(passage.quoteProvenance!.textSha256);
  let material: ReturnType<typeof corpusMaterial>;
  for(const level of ['B1','B2','C1','C2']as const)for(const seed of [0,1,17,35]){
   const candidate=corpusMaterial(selected,seed,level,'completion');
   if(candidate?.questions.some(question=>'kind'in question&&question.kind==='completion')){material=candidate;break;}
  }
  expect(material,passage.id).toBeDefined();
  if(!material)throw new Error('UNSCORABLE_QUOTE');
  expect(material.blocks[0].text).toBe(passage.text);
  expect(material.rootId).toBe(corpusMaterialRoot(selected.source,passage));
  for(const question of material.questions)if('kind'in question&&question.kind==='completion'){
   expect(material.blocks[0].text.slice(question.evidence.start,question.evidence.end)).toContain(question.answer);
   expect(score(question,question.answer)?.correct).toBe(true);
  }
 }
});
