import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { corpusOperation } from '../src/core/corpusPractice';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { score, practiceLocale, lessonSchema } from '../src/shared/content';
import { corpusViewpoints, corpusRoleActions, corpusRequests, corpusDates, corpusWorkedExample, corpusAttribution, corpusEvidence, corpusQualification, corpusApartments, corpusSpeakers, corpusSequence, corpusLesson, corpusSchema, corpusRestoration, corpusStartingPoint, selectCorpusPassage } from '../src/core/corpus';

it.each([
  { id: 'frontiers-10.3389-frym.2019.00079', rootId: 'frontiers-article-10.3389-frym.2019.00079', url: 'https://kids.frontiersin.org/articles/10.3389/frym.2019.00079' },
  { id: 'plos-10.1371-journal.pone.0330001', rootId: 'plos-article-10.1371-journal.pone.0330001', url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0330001' },
])('binds new article DOI, family, source link and licence: $id', ({ id, rootId, url }) => {
  const source = JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')).records[0];
  const record = { ...source, id, rootId, originalUrl: url, downloadUrl: url, licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' };
  expect(corpusSchema.safeParse({ version: 1, records: [record], failures: [] }).success).toBe(true);
  for (const mutation of [{ rootId: rootId + '1' }, { id: id + '1' }, { originalUrl: url + '1' }, { downloadUrl: url + '1' },
    { licenceUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' }, { originalUrl: 'https://unverified.example/article' }])
    expect(corpusSchema.safeParse({ version: 1, records: [{ ...record, ...mutation }], failures: [] }).success).toBe(false);
});

it('excludes malformed source markers from scored and demonstrated sentence orders without joining across them', () => {
  const clean = 'The museum opened its doors in June. Visitors entered through the main gate. The guide described the collection inside.';
  for (const marker of ['[citation needed]', '[', '["broken reference']) {
    const damaged = `The report contains an unresolved source ${marker}`;
    const text = `${damaged}\n\n${clean}`;
    for (let seed = 0; seed < 6; seed++) {
      const task = corpusSequence(text, seed)!;
      expect(task.acceptedOrders[0]).toEqual(corpusSequence(clean, seed)!.acceptedOrders[0]);
      expect(text.slice(task.evidence.start, task.evidence.end).trim()).toBe(clean);
    }
    expect(corpusSequence(`The museum opened its doors in June. ${damaged}\n\nThe guide described the collection inside.`, 0)).toBeUndefined();
    const material = corpusLesson(corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8'))), new Set(), 0, 300)!.materials[0];
    const task = corpusSequence(clean, 0)!;
    material.blocks[0].text = `${clean} ${damaged}\n\nThe guards waited near the entrance. The guests arrived before lunchtime. The curator welcomed the group inside.`;
    material.questions[0] = { kind: 'sequence', id: 'sequence-marker', blockId: material.blocks[0].id, prompt: 'Arrange the source sentences.', ...task, hints: [], explanation: { en: 'Source order.', 'zh-Hans': 'Source order.', 'zh-Hant': 'Source order.' } };
    const example = corpusWorkedExample(material, 0)!;
    expect(example.en).toContain('The guards waited near the entrance.');
    expect(example.en).not.toContain(marker);
  }
});

it('validates the acquired corpus and generates only original-word practice without reusing exposed passages', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  expect(corpus.records.length).toBeGreaterThanOrEqual(10);
  const seen = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const selected = selectCorpusPassage(corpus, seen, seed, 300)!;
    expect(seen.has(selected.passage.id)).toBe(false);
    expect(selected.passage.wordCount).toBeLessThanOrEqual(300);
    expect(selected.source.rootId).toBe(`gutenberg-book-${selected.source.id.slice(10)}`);
    const task = corpusRestoration(selected.passage.text, seed)!;
    expect(selected.passage.text.slice(task.evidence.start, task.evidence.end)).toBe(task.answer);
    expect(task.text.replace('________', task.answer)).toBe(selected.passage.text);
    expect(corpusRestoration(selected.passage.text, seed)).toEqual(task);
    seen.add(selected.passage.id);
  }
  expect(selectCorpusPassage(corpus, new Set(corpus.records.flatMap(source => source.passages.map(passage => passage.id))), 0)).toBeUndefined();
  expect(() => corpusRestoration('text', -1)).toThrow('INVALID_CORPUS_GENERATION');
  const invalid = structuredClone(corpus); invalid.records[0].originalUrl = 'https://other.example/';
  expect(corpusSchema.safeParse(invalid).success).toBe(false);
  const mismatch = structuredClone(corpus); mismatch.records[0].passages[0].wordCount++;
  expect(corpusSchema.safeParse(mismatch).success).toBe(false);
  const giant = structuredClone(corpus); giant.records[0].rootId = 'wikipedia-article-' + '1'.repeat(161);
  expect(corpusSchema.safeParse(giant).success).toBe(false);
});

it('builds source-preserving lessons from different books and leaves summaries unscored', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const seen = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    const lesson = corpusLesson(corpus, seen, seed)!;
    expect(lesson).toEqual(corpusLesson(corpus, seen, seed));
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const taught = lesson.materials[0].questions[0];
    if ('kind' in taught && ['completion', 'sequence'].includes(taught.kind)) expect(lesson.materials[1].questions[0]).toMatchObject({ kind: taught.kind });
    for (const material of lesson.materials) {
      const passage = corpus.records.find(source => source.id === material.sourceId)!.passages.find(passage => `corpus-${passage.id}` === material.id)!;
      expect(material.blocks[0].text).toBe(passage.text);
      const source = corpus.records.find(source => source.id === material.sourceId)!;
      expect(material.credit).toEqual({ attribution: source.attribution, license: source.licence, sourceUrl: source.originalUrl });
      expect(seen.has(passage.id)).toBe(false);
      const [restoration, response] = material.questions;
      if (!('kind' in restoration)) throw new Error('Expected source restoration');
      if (restoration.kind === 'completion') expect(passage.text.slice(restoration.evidence.start, restoration.evidence.end)).toContain(restoration.answer);
      else if (restoration.kind === 'evidence') {
        expect(score(restoration, restoration.accepted[0]).correct).toBe(true);
        for (const span of restoration.spans) expect(passage.text.slice(span.start, span.end)).toBe(span.text);
        expect(restoration.prompt).toContain('inference or possibility');
        expect(restoration.id.length).toBeLessThanOrEqual(80);
      } else if (restoration.kind === 'table') {
        expect(score(restoration, restoration.rows.map(row => row.answer)).correct).toBe(true);
        for (const row of restoration.rows) expect(passage.text).toContain(row.label.replace('________', row.answer));
      } else {
        if (restoration.kind !== 'sequence') throw new Error('Expected source sequence');
        expect(score(restoration, restoration.acceptedOrders[0]).correct).toBe(true);
        expect(score(restoration, restoration.steps).correct).toBe(false);
        const evidence = passage.text.slice(restoration.evidence.start, restoration.evidence.end);
        let end = 0;
        for (const sentence of restoration.acceptedOrders[0]) { const start = evidence.indexOf(sentence, end); expect(start).toBeGreaterThanOrEqual(end); end = start + sentence.length; }
      }
      expect('kind' in response ? response.kind : undefined).toBe('response');
      expect('modelAnswer' in response).toBe(false);
      seen.add(passage.id);
    }
    expect(lesson.teaching!.en).toBe(lesson.teaching!['zh-Hans']);
    expect(lesson.reviewStatus).toBe('draft');
  }
  expect(corpusLesson(corpus, new Set(corpus.records.flatMap(source => source.passages.map(passage => passage.id))), 0)).toBeUndefined();
});

it('generates explicit qualification evidence with unique source options and avoids ambiguous modal uses', () => {
  const text = 'The island is thought to have formed after an eruption. The team mapped the shore in June. The cliff contains three separate layers. Another group suggests a different origin.';
  for (let seed = 0; seed < 6; seed++) {
    const task = corpusQualification(text, seed)!;
    expect(task).toEqual(corpusQualification(text, seed));
    expect(task.spans[task.accepted[0]].text).toBe('The island is thought to have formed after an eruption.');
    expect(task.spans.some(span => span.text.includes('suggests'))).toBe(false);
    for (const span of task.spans) expect(text.slice(span.start, span.end)).toBe(span.text);
    expect(task.explanation).toContain('is thought to');
  }
  for (const phrase of ['You may have this book.', 'The actor appears to the audience.'])
    expect(corpusQualification(phrase + ' The team mapped the shore in June. The cliff contains three separate layers.', 0)).toBeUndefined();
  expect(corpusQualification('It is likely to rain tomorrow. Perhaps the team will stay. The road could be closed.', 0)).toBeUndefined();
  expect(() => corpusQualification(text, -1)).toThrow('INVALID_CORPUS_QUALIFICATION');
});

it('retains explicit suspected-that qualification and excludes equally qualified alternatives', () => {
  const text = "Atlas is an inner satellite of Saturn. Atlas was discovered by Richard Terrile in 1980. Because the orbits of Prometheus and Pandora are chaotic, it is suspected that Atlas's may be as well.";
  const extra = 'It is believed that the ridge formed from ring material.';
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  corpus.records = corpus.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text: text + ' ' + extra, wordCount: 48, language: undefined, task: undefined }] }));
  for (let seed = 0; seed < 6; seed++) {
    const task = corpusQualification(text + ' ' + extra, seed)!;
    expect(task.accepted).toHaveLength(1);
    const lesson = corpusLesson(corpus, new Set(), seed, 300, 'B2', [], 'evidence')!;
    const example = lesson.workedExample!;
    expect(example.en).toMatch(/is (?:suspected|believed) that/);
    const question = lesson.materials[0].questions[0];
    if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected evidence');
    for (const span of question.spans) expect(example.en).not.toContain(span.text);
    const accepted = task.spans[task.accepted[0]];
    expect(task.explanation).toContain(accepted.text.includes('suspected') ? 'is suspected that' : 'is believed that');
    for (const [index, span] of task.spans.entries()) {
      expect((text + ' ' + extra).slice(span.start, span.end)).toBe(span.text);
      if (index !== task.accepted[0]) expect(span.text).not.toMatch(/suspected|believed/);
    }
  }
  expect(corpusQualification('The officer suspected the visitor. The museum displays tools from the site. The team mapped the shore in June.', 0)).toBeUndefined();
  expect(corpusQualification('It is suspected that the ridge formed from dust. It is believed that the dust arrived earlier. The team mapped the shore in June.', 0)).toBeUndefined();
});

it('does not mark explicit possibility or tentative wording as an incorrect qualification option', () => {
  const target = 'The island is thought to have formed after an eruption.';
  const direct = 'The team mapped the shore in June. The cliff contains three separate layers.';
  for (const alternative of [
    'The harbour’s original purpose remains the subject of debate.',
    'The harbour’s original purpose is disputed.',
    'The harbour’s original purpose is unknown.',
    'It is possible that the harbour served another town.',
    'The harbour potentially served another town.',
    'The harbour presumably served another town.',
    'Apparently, the harbour served another town.',
    'A tentative explanation links the harbour to another town.',
    'It is plausible that the harbour served another town.',
    'The harbour was presumed to serve another town.',
    'A probable explanation links the harbour to another town.',
  ]) {
    for (let seed = 0; seed < 3; seed++) {
      const text = target + ' ' + alternative + ' ' + direct;
      const task = corpusQualification(text, seed)!;
      expect(task.spans).toHaveLength(3);
      expect(task.spans[task.accepted[0]].text).toBe(target);
      expect(task.spans.some(span => span.text === alternative)).toBe(false);
    }
    expect(corpusQualification(target + ' ' + alternative + ' The team mapped the shore in June.', 0)).toBeUndefined();
  }
});

it('generates source attribution evidence without treating attributed claims as verified facts', () => {
  const text = 'According to Alice Smith, the harbour served a nearby town. The museum displays tools from the site. According to Robert Jones, the ridge formed from loose material. The team mapped the shore in June.';
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  corpus.records = corpus.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text, wordCount: text.split(/\s+/).length, language: undefined, task: undefined }] }));
  let ordinary = false;
  for (let seed = 0; seed < 72; seed++) {
    const task = corpusAttribution(text, seed)!;
    expect(task).toEqual(corpusAttribution(text, seed));
    expect(task.spans[task.accepted[0]].text).toMatch(/^According to/);
    for (const [index, span] of task.spans.entries()) {
      expect(text.slice(span.start, span.end)).toBe(span.text);
      if (index !== task.accepted[0]) expect(span.text).not.toContain('According to');
    }
    const lesson = corpusLesson(corpus, new Set(), seed, 300, 'B2', [], 'evidence')!;
    expect(lesson.materials[0].questions[0].prompt).toBe(task.prompt);
    expect(lesson.teaching!.en).toContain('does not prove');
    const question = lesson.materials[0].questions[0];
    if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected attribution evidence');
    expect(score(question, question.accepted[0]).correct).toBe(true);
    expect(score(question, (question.accepted[0] + 1) % 3).correct).toBe(false);
    const example = lesson.workedExample!;
    expect(example.en).toMatch(/attribution (?:does not prove it true|proves neither truth nor the writer’s endorsement)/);
    for (const span of question.spans) expect(example.en).not.toContain(span.text);
    expect(example.en).toBe(example['zh-Hans']); expect(example.en).toBe(example['zh-Hant']);
    ordinary ||= corpusLesson(corpus, new Set(), seed, 300, 'B2')!.materials[0].questions[0].prompt === task.prompt;
  }
  expect(ordinary).toBe(true);
  for (const prefix of ['According to the timetable,', 'According to them,', 'According to Alice Smith,'])
    expect(corpusAttribution(prefix + ' yes. The team mapped the shore in June. The museum displays tools from the site.', 0)).toBeUndefined();
  expect(corpusAttribution('According to Alice Smith, the harbour served a nearby town. Robert Jones said the harbour served another town. The team mapped the shore in June.', 0)).toBeUndefined();
  for (const marker of ['[', '["', '[citation needed]'])
    expect(corpusAttribution('According to Alice Smith, the harbour served a nearby town.' + marker + ' The museum displays tools from the site. The team mapped the shore in June.', 0)).toBeUndefined();
  expect(() => corpusAttribution(text, -1)).toThrow('INVALID_CORPUS_ATTRIBUTION');
});

it('excludes competing named-source reports and malformed evidence alternatives', () => {
  const target = 'According to Alice Smith, the harbour served a nearby town.';
  const direct = 'The museum displays tools from the site. The team mapped the shore in June.';
  for (const verb of ['added', 'adds', 'commented', 'comments', 'remarked', 'remarks', 'concluded', 'concludes', 'responded', 'responds', 'maintained', 'maintains', 'acknowledged', 'acknowledges', 'stressed', 'stresses', 'told the team', 'tells the team', 'explained', 'explains', 'suggested', 'suggests', 'asserted', 'asserts', 'insisted', 'insists', 'noted', 'notes', 'observed', 'observes', 'warned', 'warns']) {
    const alternative = 'Robert Jones ' + verb + ' that the harbour served another town.';
    for (let seed = 0; seed < 3; seed++) {
      const task = corpusAttribution(target + ' ' + alternative + ' ' + direct, seed)!;
      const accepted = task.spans[task.accepted[0]].text;
      const supportedReport = ['suggested', 'suggests', 'noted', 'notes'].includes(verb);
      expect(accepted === target || supportedReport && accepted === alternative).toBe(true);
      expect(task.spans.some(span => span.text === (accepted === target ? alternative : target))).toBe(false);
    }
    expect(corpusAttribution(target + ' ' + alternative + ' The team mapped the shore in June.', 0)).toBeUndefined();
  }
  for (const marker of ['[', '["', '[citation needed]']) {
    const malformed = 'The old harbour served another town.' + marker;
    for (let seed = 0; seed < 3; seed++) {
      // ICU may attach citation-needed markup to the next sentence.
      const text = target + ' ' + malformed + ' ' + direct + ' The road follows the northern edge of the shore.';
      const task = corpusEvidence(text, { prompt: 'Find the named source.', evidenceText: target, explanation: 'Read the named attribution.' }, seed);
      expect(task.spans.some(span => span.text.includes(marker))).toBe(false);
      for (const span of task.spans) expect(text.slice(span.start, span.end)).toBe(span.text);
    }
    expect(() => corpusEvidence(target + ' ' + malformed + ' The team mapped the shore in June.', { prompt: 'Find the named source.', evidenceText: target, explanation: 'Read the named attribution.' }, 0)).toThrow('INSUFFICIENT_SOURCE_SPANS');
  }
});

it('withholds ambiguous named-source evidence in the actual Wipeout passage', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const bank = (await inspectCommunityPack(new Uint8Array(readSourcePackFixture('wikipedia-reading-029')))).corpus!;
  const passage = bank.records.find(source => source.rootId === 'wikipedia-article-31962411')!.passages.find(passage => passage.id === '9165c3400bc62264618cecc56c9fb8249350e8c353feb8ac197cb75157ebe80f')!;
  expect(passage.text).toContain('Roberts added');
  for (const seed of [0, 1, 2, 3, 7, 37, 0xffffffff]) expect(corpusAttribution(passage.text, seed)).toBeUndefined();
});

it('uses only credited original VOA texts and preserves distinct article roots', async () => {
  const { createHash } = await import('node:crypto');
  const digest = (text: string) => createHash('sha256').update(text).digest('hex');
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const beginners = JSON.parse(readFileSync('content/corpus/voa-beginners.json', 'utf8')) as { rootId: string; text: string }[];
  const additional = JSON.parse(readFileSync('content/corpus/voa-additional-sources.json', 'utf8')) as { records: { id: number; text: string; sha256: string; excludedSpans?: { start: number; end: number }[]; supportedExcerpts?: { start: number; end: number; sha256: string; startingPoints: ('A1' | 'A2')[] }[] }[] };
  const oldProse = JSON.parse(readFileSync('content/corpus/voa-excerpts.json', 'utf8')) as { records: { id: number; text: string }[] };
  const lingfern = corpus.records.filter(record => record.id.startsWith('lingfern-dialogue-'));
  expect(lingfern).toHaveLength(50);
  expect(corpus.records.filter(record => !record.id.startsWith('lingfern-dialogue-'))).toHaveLength(5 + beginners.length + additional.records.length);
  expect(corpus.records.filter(record => record.passages[0].startingPoints && !record.id.startsWith('lingfern-dialogue-')).map(record => record.rootId).sort()).toEqual(beginners.map(source => source.rootId).sort());
  const standard = corpus.records.filter(record => !record.passages[0].startingPoints);
  expect(standard).toHaveLength(5 + additional.records.length);
  // Preserve the original 16 source hashes when adding roots.
  for (const original of beginners) {
    const retained = corpus.records.find(record => record.rootId === original.rootId)!;
    expect(retained.originalText).toBe(original.text);
    expect(retained.sourceHash).toBe(digest(original.text));
  }
  for (const original of oldProse.records.filter(original => corpus.records.some(record => record.id === `voa-${original.id}`))) {
    const retained = corpus.records.find(record => record.id === `voa-${original.id}`)!;
    expect(retained.sourceHash).toBe(digest(original.text));
    expect(retained.passages[0].text).toBe(original.text);
  }
  for (const original of additional.records) {
    const retained = corpus.records.find(record => record.id === `voa-${original.id}`)!;
    expect(retained.originalText).toBe(original.excludedSpans?.length ? undefined : original.text);
    expect(retained.sourceHash).toBe(original.sha256);
    expect(original.sha256).toBe(digest(original.text));
    expect(retained.passages.every(passage => original.text.includes(passage.text))).toBe(true);
    expect(retained.passages.filter(passage => passage.startingPoints).map(passage => ({ text: passage.text, id: passage.id, startingPoints: passage.startingPoints }))).toEqual((original.supportedExcerpts ?? []).map(excerpt => ({ text: original.text.slice(excerpt.start, excerpt.end), id: excerpt.sha256, startingPoints: excerpt.startingPoints })));
  }
  for (const id of ['voa-7897823', 'voa-3357760']) expect(corpus.records.some(record => record.id === id)).toBe(false);
  const seen = new Set<string>();
  const passageCount = standard.reduce((count, source) => count + source.passages.length, 0);
  let lessons = 0;
  for (let seed = 0; seed < passageCount; seed++) {
    const lesson = corpusLesson(corpus, seen, seed, 700);
    if (!lesson) break;
    lessons++;
    expect(lesson.sourceId).toBe('voa-corpus');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const source = corpus.records.find(source => source.id === material.sourceId)!;
      const passage = source.passages.find(passage => passage.text === material.blocks[0].text)!;
      expect(passage).toBeDefined();
      expect(passage.id).toBe(digest(passage.text));
      expect(source.licenceUrl).toBe('https://learningenglish.voanews.com/p/6861.html');
      expect(source.editorialReview).toBe('pending');
      expect(material.audio).toBeUndefined();
      expect(passage.task).toBeUndefined();
      expect(seen.has(passage.id)).toBe(false);
      for (const question of material.questions) {
        if ('kind' in question && question.kind === 'response') { expect(score(question, 'A supported interpretation').correct).toBeNull(); continue; }
        if ('kind' in question && question.kind === 'sequence') expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
        else if ('kind' in question && question.kind === 'evidence') {
          for (const span of question.spans) expect(material.blocks[0].text.slice(span.start, span.end)).toBe(span.text);
          expect(score(question, question.accepted[0]).correct).toBe(true);
        } else if ('kind' in question && question.kind === 'matching') expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
        else if ('kind' in question && question.kind === 'table') expect(score(question, question.rows.map(row => row.answer)).correct).toBe(true);
        else if ('gaps' in question) expect(score(question, question.gaps.map(gap => gap.answer)).correct).toBe(true);
        else expect(score(question, question.answer).correct).toBe(true);
        if (question.evidence) {
          expect(question.evidence.start).toBeGreaterThanOrEqual(0);
          expect(question.evidence.end).toBeLessThanOrEqual(passage.text.length);
          expect(passage.text.slice(question.evidence.start, question.evidence.end)).not.toBe('');
        }
      }
      seen.add(passage.id);
    }
  }
  expect(lessons).toBeGreaterThan(1);
  expect(corpusLesson(corpus, seen, 0, 700)).toBeUndefined();
});

it('uses the complete Louis interview for A2 speaker transfer across actual roots while withholding it from A1', () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const louis = bank.records.find(source => source.rootId === 'voa-article-3355849')!;
  const introduction = bank.records.find(source => source.rootId === 'voa-article-3113733')!;
  const passage = louis.passages.find(passage => passage.startingPoints)!;
  expect(passage.wordCount).toBe(106);
  expect(passage.startingPoints).toEqual(['A2']);
  expect(passage.text.startsWith('Anna: Oh! Excuse me. I am Anna Matteo from The News.')).toBe(true);
  expect(passage.text.endsWith('Louis: You’re very welcome. Bye!')).toBe(true);
  expect(louis.originalText).toContain(passage.text);
  const paired = { ...bank, records: [{ ...louis, passages: [passage] }, introduction] };
  const roots = new Set<string>();
  for (const seed of [...Array(32).keys(), 0xffffffff]) {
    const lesson = corpusLesson(paired, new Set(), seed, 160, 'A2', [], 'matching', 'matching:Who says each sentence? Match it to a person.')!;
    lessonSchema.parse(lesson);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      roots.add(material.rootId);
      const question = material.questions[0];
      expect(question.prompt).toBe('Who says each sentence? Match it to a person.');
      if (!('kind' in question) || question.kind !== 'matching') throw new Error('MISSING_SPEAKER_MATCHING');
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => question.choices.find(choice => choice !== pair.answer)!)).correct).toBe(false);
      const evidence = [question.evidence, ...(question.additionalEvidence ?? [])];
      for (const [index, pair] of question.pairs.entries()) {
        const quote = material.blocks[0].text.slice(evidence[index].start, evidence[index].end);
        expect(quote.startsWith(`${pair.answer}:`)).toBe(true);
        expect(quote).toContain(pair.label);
      }
      const response = material.questions[1];
      expect('kind' in response && response.kind).toBe('response');
      expect(score(response, 'I use a quotation from the interview.').correct).toBeNull();
    }
    expect(lesson.teaching!['zh-Hans']).not.toBe(lesson.teaching!.en);
    expect(lesson.teaching!['zh-Hant']).not.toBe(lesson.teaching!.en);
  }
  expect([...roots].sort()).toEqual([louis.rootId, introduction.rootId].sort());
  expect(corpusLesson(paired, new Set(), 0, 120, 'A1')).toBeUndefined();
  expect(corpusLesson(paired, new Set([passage.id, ...introduction.passages.map(passage => passage.id)]), 0, 160, 'A2')).toBeUndefined();
});

it('rejects absent or repeated semantic evidence annotations', () => {
  const corpus = JSON.parse(readFileSync('public/corpus/voa.json', 'utf8'));
  corpus.records[0].passages[0].task = { prompt: 'Find evidence.', evidenceText: 'An invented sentence is not source evidence.', explanation: 'Unsupported.' };
  expect(corpusSchema.safeParse(corpus).success).toBe(false);
  expect(() => corpusEvidence('One original sentence.', { prompt: 'Find evidence.', evidenceText: 'One original sentence.', explanation: 'Supported.' }, -1)).toThrow('INVALID_CORPUS_EVIDENCE');
  expect(() => corpusEvidence('One original sentence.', { prompt: 'Find evidence.', evidenceText: 'An invented sentence.', explanation: 'Unsupported.' }, 0)).toThrow('INVALID_CORPUS_EVIDENCE');
});

it('restores only three distinct consecutive original sentences with exact source evidence', () => {
  const text = '😀 The first sentence introduces the subject. The next sentence adds a specific detail. The final sentence qualifies the claim.';
  for (let seed = 0; seed < 30; seed++) {
    const task = corpusSequence(text, seed)!;
    expect(task).toEqual(corpusSequence(text, seed));
    expect(task.steps).not.toEqual(task.acceptedOrders[0]);
    expect(new Set(task.steps)).toEqual(new Set(task.acceptedOrders[0]));
    expect(task.acceptedOrders[0].join(' ')).toBe(text.slice(task.evidence.start, task.evidence.end).trim());
  }
  expect(corpusSequence('Only one complete sentence is available here.', 0)).toBeUndefined();
  expect(corpusSequence(Array(3).fill('The exact same sentence appears again.').join(' '), 0)).toBeUndefined();
  expect(() => corpusSequence(text, -1)).toThrow('INVALID_CORPUS_SEQUENCE');
  expect(() => corpusSequence('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_SEQUENCE');
});


it('rejects ambiguous duplicate reading source IDs and roots before generation', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  for (const field of ['id', 'rootId'] as const) {
    const duplicate = structuredClone(corpus);
    duplicate.records[1][field] = duplicate.records[0][field];
    expect(corpusSchema.safeParse(duplicate).success).toBe(false);
  }
});

it('generates evidence and sequence tasks even when the source has no restoration word', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  corpus.records = corpus.records.slice(0, 2);
  const sentences = ['The red bus stops by the old shop.', 'We get on and sit near the back.', 'Then we go past the park and the lake.'];
  const text = Array.from({ length: 5 }, () => sentences.join(' ')).join(' ');
  expect(corpusRestoration(text, 0)).toBeUndefined();
  for (const source of corpus.records) {
    source.passages = [{ ...source.passages[0], text, wordCount: text.split(/\s+/).length,
      task: { prompt: 'Which sentence says where we sit?', evidenceText: sentences[1], explanation: 'The sentence names our seat.' } }];
    // Keep one unique target within bounded short-word excerpts.
    source.passages[0].text = text.replaceAll(sentences[1], 'We get on and wait near the back.').replace('We get on and wait near the back.', sentences[1]);
  }
  const validated = corpusSchema.parse(corpus);
  const evidenceLesson = corpusLesson(validated, new Set(), 0)!;
  expect(evidenceLesson.materials).toHaveLength(2);
  for (const material of evidenceLesson.materials) {
    const question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected evidence');
    expect(score(question, question.accepted[0]).correct).toBe(true);
  }
  // Seed 1 sequences the second source while preserving the first source's annotation.
  delete validated.records[1].passages[0].task;
  const sequenceLesson = corpusLesson(validated, new Set(), 1)!;
  const question = sequenceLesson.materials[0].questions[0];
  if (!('kind' in question) || question.kind !== 'sequence') throw new Error('Expected sequence');
  expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
});

it('offers distinct original evidence alternatives and rejects insufficient unique spans', () => {
  const target = 'The speaker says the shop is closed today.';
  const repeated = 'The bus stops near the park each day.';
  const other = 'We can take a taxi to the next town.';
  const task = { prompt: 'Which sentence says the shop is closed?', evidenceText: target, explanation: 'The source explicitly says it is closed.' };
  const text = [target, repeated, repeated, other].join(' ');
  for (let seed = 0; seed < 3; seed++) {
    const question = corpusEvidence(text, task, seed);
    expect(new Set(question.spans.map(span => span.text)).size).toBe(3);
    expect(question.spans[question.accepted[0]].text).toBe(target);
    for (const span of question.spans) expect(text.slice(span.start, span.end)).toBe(span.text);
  }
  expect(() => corpusEvidence([target, repeated, repeated].join(' '), task, 0)).toThrow('INSUFFICIENT_SOURCE_SPANS');
});

it('skips unusable excerpts without weakening distinct-root or exposure rules', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const repeated = Array.from({ length: 24 }, () => 'We go to the shop.').join(' ');
  const unusable = { ...corpus.records[0].passages[0], id: 'f'.repeat(64), text: repeated, wordCount: 120 };
  delete unusable.task;
  corpus.records[0].passages.unshift(unusable);
  const eligible = corpusSchema.parse(corpus);
  for (let seed = 0; seed < 8; seed++) {
    const lesson = corpusLesson(eligible, new Set(), seed)!;
    expect(lesson.materials).toHaveLength(2);
    expect(lesson.materials.some(material => material.id === 'corpus-' + unusable.id)).toBe(false);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  }
  const seen = new Set(eligible.records.flatMap(source => source.passages.filter(p => p.id !== unusable.id).map(p => p.id)));
  expect(corpusLesson(eligible, seen, 0)).toBeUndefined();
  expect(() => corpusLesson(eligible, new Set(), -1)).toThrow();
});

it('uses bounded source language annotations for shorter content words and rejects bad spans', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const passage = corpus.records[0].passages[0];
  const match = /\b[a-z]{3,5}\b/.exec(passage.text)!;
  passage.language = { generator: 'spacy-3.8.16/en_core_web_sm-3.8.0', modelSha256: 'a'.repeat(64), reviewStatus: 'pending',
    tokens: [{ start: match.index, end: match.index + match[0].length, lemma: match[0], pos: 'NOUN' }] };
  const checked = corpusSchema.parse(corpus);
  const restored = corpusRestoration(passage.text, 0, checked.records[0].passages[0].language)!;
  expect(restored.answer).toBe(match[0]);
  expect(restored.evidence).toEqual({ start: match.index, end: match.index + match[0].length });
  passage.language.tokens[0].end = passage.text.length + 1;
  expect(corpusSchema.safeParse(corpus).success).toBe(false);
});

it('retains an annotated base-form clue without changing the exact source answer', () => {
  const text = 'She was reading the letters.';
  const language = { generator: 'spacy-3.8.16/en_core_web_sm-3.8.0' as const, modelSha256: 'a'.repeat(64), reviewStatus: 'pending' as const,
    tokens: [{ start: 4, end: 7, lemma: 'be', pos: 'VERB' as const }, { start: 8, end: 15, lemma: 'read', pos: 'VERB' as const }] };
  expect(corpusRestoration(text, 0, language)).toMatchObject({ answer: 'was', lemma: 'be', evidence: { start: 4, end: 7 } });
  expect(corpusRestoration(text, 1, language)).toMatchObject({ answer: 'reading', lemma: 'read' });
  language.tokens[1].lemma = 'reading';
  expect(corpusRestoration(text, 1, language)!.lemma).toBeUndefined();
});

it('does not replace an empty annotation with arbitrary word-length targets', () => {
  const text = Array(8).fill('The production introduces the subject. The audience follows the account. The narrator completes the explanation.').join(' ');
  const language = { generator: 'spacy-3.8.16/en_core_web_sm-3.8.0' as const, modelSha256: 'a'.repeat(64), reviewStatus: 'pending' as const, tokens: [] };
  expect(corpusRestoration(text, 0)).toBeDefined();
  expect(corpusRestoration(text, 0, language)).toBeUndefined();
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  corpus.records = corpus.records.slice(0, 2);
  for (const source of corpus.records) source.passages = [{ ...source.passages[0], text, wordCount: text.split(/\s+/).length, language, task: undefined }];
  const lesson = corpusLesson(corpusSchema.parse(corpus), new Set(), 0)!;
  for (const material of lesson.materials) {
    const question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'sequence') throw new Error('Expected source sequence fallback');
    expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
  }
});

it('preserves sources and scores while applying self-chosen beginner support separately from source level', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const base = corpusLesson(corpus, new Set(), 0, 500)!;
  for (const startingPoint of ['A1','A2','B1','B2','C1','C2'] as const) {
    const lesson = lessonSchema.parse(corpusStartingPoint(base, startingPoint));
    expect(lesson.generation).toEqual({ ...base.generation, startingPoint });
    expect(lesson.targetLevel).toBe(base.targetLevel);
    expect(lesson.materials.map(material => material.blocks)).toEqual(base.materials.map(material => material.blocks));
    expect(lesson.materials.map(material => material.questions[0])).toEqual(base.materials.map(material => material.questions[0]));
    expect(practiceLocale(lesson, 'zh-Hant')).toBe(startingPoint === 'A1' || startingPoint === 'A2' ? 'zh-Hant' : 'en');
    const response = lesson.materials[0].questions.find(question => 'kind' in question && question.kind === 'response')!;
    expect(score(response, 'A short answer.').correct).toBeNull();
    if (startingPoint === 'A1' || startingPoint === 'A2') {
      expect(response.prompt).toContain('one short sentence');
      expect(lesson.teaching!['zh-Hans']).not.toBe(lesson.teaching!.en);
    } else expect(lesson.materials).toEqual(base.materials);
  }
  expect(base.generation).not.toHaveProperty('startingPoint');
});

it('restricts beginner reading to explicitly supported original dialogue without falling back to longer unreviewed text', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  for (const point of ['A1','A2'] as const) {
    for (let seed = 0; seed < 20; seed++) {
      const lesson = corpusLesson(corpus, new Set(), seed, 120, point)!;
      expect(lesson.generation).toMatchObject({ startingPoint: point });
      for (const material of lesson.materials) {
        const source = corpus.records.find(source => source.rootId === material.rootId)!;
        expect(source.passages.some(passage => passage.startingPoints?.includes(point))).toBe(true);
        const passage = source.passages.find(passage => passage.text === material.blocks[0].text)!;
        expect(passage.startingPoints).toContain(point);
        const originalText = source.originalText ?? (JSON.parse(readFileSync('content/corpus/voa-additional-sources.json', 'utf8')) as { records: { id: number; text: string }[] }).records.find(record => `voa-${record.id}` === source.id)!.text;
        expect(originalText.includes(passage.text)).toBe(true);
        expect(passage.wordCount).toBeLessThanOrEqual(passage === source.passages[0] ? 80 : 160);
        if (passage !== source.passages[0]) expect(passage.startingPoints).toEqual(['A2']);
        expect(source.passages[0].task).toBeUndefined();
      }
    }
    expect(corpusLesson({ ...corpus, records: corpus.records.filter(record => record.passages.every(passage => !passage.startingPoints)) }, new Set(), 0, 120, point)).toBeUndefined();
  }
  const a2Only = { ...corpus, records: corpus.records.filter(record => record.passages.some(passage => passage.startingPoints?.includes('A2')) && record.passages.every(passage => !passage.startingPoints?.includes('A1'))) };
  expect(a2Only.records).toHaveLength(7);
  expect(corpusLesson(a2Only, new Set(), 0, 120, 'A1')).toBeUndefined();
  expect(corpusLesson(a2Only, new Set(), 0, 120, 'A2')).toBeDefined();
  expect(corpus.records.some(record => record.rootId === 'voa-article-3261789')).toBe(false);
});


it('generates unambiguous speaker matching with exact cited turns and bounded scoring', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const dialogues = corpus.records.filter(source => source.passages[0].startingPoints);
  const roots = new Set<string>();
  fc.assert(fc.property(fc.integer({ min: 0, max: 10000 }), seed => {
    for (const source of dialogues) {
      const text = source.passages[0].text;
      const task = corpusSpeakers(text, seed);
      expect(task).toEqual(corpusSpeakers(text, seed));
      if (!task) continue;
      roots.add(source.rootId);
      expect(task.pairs).toHaveLength(2);
      expect(new Set(task.choices).size).toBe(2);
      for (const [index, pair] of task.pairs.entries()) {
        const evidence = index ? task.otherEvidence : task.evidence;
        const cited = text.slice(evidence.start, evidence.end);
        expect(cited.startsWith(pair.answer + ':')).toBe(true);
        expect(cited.endsWith(pair.label)).toBe(true);
        expect(pair.label.length).toBeLessThanOrEqual(80);
        expect(task.choices).toContain(pair.answer);
      }
    }
    const lesson = corpusLesson(corpus, new Set(), seed, 120, 'A1')!;
    for (const material of lesson.materials) for (const question of material.questions) {
      if ('kind' in question && question.kind === 'matching') {
        expect(question.id.length).toBeLessThanOrEqual(80);
        expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
        expect(score(question, question.pairs.map(pair => question.choices.find(name => name !== pair.answer)!)).correct).toBe(false);
      }
    }
  }), { numRuns: 80 });
  expect(roots.size).toBeGreaterThanOrEqual(3);
  expect(corpusSpeakers('Anna: I live in a small apartment.\nPete: I live in a small apartment.', 0)).toBeUndefined();
  expect(corpusSpeakers('Anna: I live in a small apartment.\nAnna: I cook dinner in the kitchen.', 0)).toBeUndefined();
  expect(corpusSpeakers('Anna: Where is the supermarket?\nPete: Where is the supermarket?', 0)).toBeUndefined();
  expect(corpusSpeakers('The passage has no labelled speakers.', 0)).toBeUndefined();
  expect(() => corpusSpeakers('text', -1)).toThrow('INVALID_CORPUS_SPEAKERS');
  expect(() => corpusSpeakers('x'.repeat(12001), 0)).toThrow('INVALID_CORPUS_SPEAKERS');
});


it('generates apartment tables from explicit dialogue with exact evidence and scoring', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const text = corpus.records.find(source => source.rootId === 'voa-article-3113733')!.passages[0].text;
  fc.assert(fc.property(fc.integer({ min: 0, max: 10000 }), seed => {
    const task = corpusApartments(text, seed)!;
    expect(task).toEqual(corpusApartments(text, seed));
    expect(task.rows).toHaveLength(2);
    const facts = { Jonathan: 'B4', Anna: 'C2', Pete: 'D7' };
    for (const row of task.rows) expect(facts[row.label as keyof typeof facts]).toBe(row.answer);
    expect(new Set(task.rows.map(row => row.label)).size).toBe(2);
    for (const [index, row] of task.rows.entries()) {
      const span = [task.evidence, ...task.otherEvidence][index];
      expect(text.slice(span.start, span.end).startsWith(row.label + ':')).toBe(true);
      expect(text.slice(span.start, span.end)).toContain('partment ' + row.answer);
    }
    const lesson = corpusLesson(corpus, new Set(), seed, 120, 'A1')!;
    for (const material of lesson.materials) for (const question of material.questions) if ('rows' in question) {
      expect(score(question, question.rows.map(row => row.answer)).correct).toBe(true);
      expect(score(question, question.rows.map(() => 'X99')).correct).toBe(false);
    }
  }), { numRuns: 80 });
  const first = 'Anna: I am in apartment A1.';
  for (const other of ['Pete: I am not in apartment B2.', 'Pete: She is in apartment B2.', 'Pete: “I am in apartment B2.”', 'Anna: I am in apartment B2.', 'Pete: I am in apartment A1.'])
    expect(corpusApartments(first + '\n' + other, 0)).toBeUndefined();
  expect(() => corpusApartments(text, -1)).toThrow('INVALID_CORPUS_APARTMENTS');
});


it('works through unused source wording without revealing completion or sequence answers', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const material = structuredClone(corpusLesson(corpus, new Set(), 0, 300, 'B2', [], 'completion')!.materials[0]);
  const question = material.questions[0];
  if (!('kind' in question) || question.kind !== 'completion') throw new Error('Expected completion');
  const assessed = 'The visitor entered quietly. ';
  const unused = 'The librarian welcomed the arriving students.';
  material.blocks[0].text = assessed + unused;
  question.answer = 'quietly'; question.evidence = { start: 0, end: assessed.length };
  const example = corpusWorkedExample(material, 0, 'B2')!;
  expect(example.en).toContain(unused);
  expect(example.en).not.toContain('quietly');
  expect(example['zh-Hans']).toBe(example.en);
  const gap = example.en.match(/Example: “([^”]+)” → “([^”]+)”/)!
  expect(gap[1].replace('________', gap[2])).toBe(unused);
  expect(corpusWorkedExample(material, 0, 'A2')!['zh-Hans']).toContain('核对拼写');
  expect(corpusWorkedExample(material, 0, 'A2')!['zh-Hant']).toContain('核對拼寫');
  expect(corpusWorkedExample(material, 0, 'B2', true)!.en).toContain('speaker says');
  material.blocks[0].text = assessed;
  expect(corpusWorkedExample(material, 0)).toBeUndefined();
  material.blocks[0].text = assessed + 'The visitor waited quietly beside the entrance.';
  expect(corpusWorkedExample(material, 0)).toBeUndefined();

  const ordered = ['The guide opened the front gate.', 'The visitors followed the path.', 'The group arrived at the museum.'];
  const other = ['A curator welcomed the visitors.', 'The room contained several paintings.', 'Everyone looked at the largest picture.'];
  material.blocks[0].text = [...ordered, ...other].join(' ');
  material.questions[0] = { kind: 'sequence', id: 'example-sequence', blockId: material.blocks[0].id,
    prompt: 'Arrange the sentences.', steps: [...ordered].reverse(), acceptedOrders: [ordered],
    evidence: { start: 0, end: ordered.join(' ').length }, explanation: { en: 'Order', 'zh-Hans': 'Order', 'zh-Hant': 'Order' } };
  const sequence = corpusWorkedExample(material, 0)!;
  for (const sentence of ordered) expect(sequence.en).not.toContain(sentence);
  expect(sequence.en).toContain(other.map(sentence => `“${sentence}”`).join(' → '));
  material.blocks[0].text = [...ordered, ...ordered].join(' ');
  expect(corpusWorkedExample(material, 0)).toBeUndefined();
});


it('generates exact-year tables with independent examples and rejects ambiguous date rows', () => {
  const text = 'The library opened in 1991. The hall was rebuilt in 2002. The garden reopened in 2013.';
  for (let seed = 0; seed < 12; seed++) {
    const task = corpusDates(text, seed)!;
    expect(task.rows).toHaveLength(2);
    expect(task).toEqual(corpusDates(text, seed));
    for (const [index, row] of task.rows.entries()) {
      const span = [task.evidence, ...task.otherEvidence][index];
      expect(row.label.replace('________', row.answer)).toBe(text.slice(span.start, span.end));
    }
  }
  expect(corpusDates('The library opened in 1991 and closed in 2002. The hall was rebuilt in 2013.', 0)).toBeUndefined();
  expect(corpusDates('The kingdom ended in 1991 BCE. The hall was rebuilt in 2013.', 0)).toBeUndefined();
  expect(corpusDates('The path extends for 1991 metres. The hall was rebuilt in 2013.', 0)).toBeUndefined();
  expect(corpusDates('The valley is covered in 1991 metres of ice. The hall was rebuilt in 2013.', 0)).toBeUndefined();
  expect(corpusDates('The library opened in 1991. The library opened in 1991.', 0)).toBeUndefined();
  expect(() => corpusDates(text, -1)).toThrow('INVALID_CORPUS_DATES');
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  // Test parsing here; verify actual source-bank generation separately.
  corpus.records = corpus.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text,
    wordCount: text.split(/\s+/).length }] }));
  let tables = 0;
  for (let seed = 0; seed < 40; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 300, 'B2', [], 'table')!;
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'table') continue;
      tables++;
      expect(score(question, question.rows.map(row => row.answer)).correct).toBe(true);
      expect(score(question, question.rows.map(() => '0000')).correct).toBe(false);
      const example = corpusWorkedExample(material, seed, 'B2');
      if (example) {
        expect(example.en).toBe(example['zh-Hans']);
        for (const row of question.rows) expect(example.en).not.toContain('“' + row.answer + '”');
      }
    }
  }
  expect(tables).toBeGreaterThan(0);
});

it('demonstrates speaker matching with unused exact dialogue and localized beginner support', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  let examples = 0;
  for (let seed = 0; seed < 24; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 120, 'A1', [], 'matching')!;
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'matching') continue;
      const example = corpusWorkedExample(material, seed, 'A1');
      if (!example) continue;
      examples++;
      expect(example).toEqual(corpusWorkedExample(material, seed, 'A1'));
      expect(example['zh-Hans']).toContain('示例：');
      expect(example['zh-Hant']).toContain('名字說明');
      expect(corpusWorkedExample(material, seed, 'B1')!['zh-Hans']).toBe(example.en);
      const text = material.blocks.find(block => block.id === question.blockId)!.text;
      const quotes = [...example.en.matchAll(/“([^”]+)”/g)].map(match => match[1]);
      const quote = quotes[0], start = text.indexOf(quote), end = start + quote.length;
      expect(start).toBeGreaterThanOrEqual(0);
      expect(text.lastIndexOf(quote)).toBe(start);
      expect(quote).toMatch(/^[A-Z][a-z]+(?: [A-Z][a-z]+)?: /);
      for (const pair of question.pairs) expect(example.en).not.toContain(pair.label);
      for (const range of [question.evidence, ...question.additionalEvidence!])
        expect(start >= range.end || end <= range.start).toBe(true);
      const covered = structuredClone(material);
      covered.questions[0] = { ...question, evidence: { start: 0, end: text.length } };
      expect(corpusWorkedExample(covered, seed, 'A1')).toBeUndefined();
    }
  }
  const fixture = corpusLesson(corpus, new Set(), 0, 120, 'A1', [], 'matching')!.materials[0];
  const question = fixture.questions[0];
  if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected matching fixture');
  const text = 'Anna: I live in a small apartment.\nPete: I cook dinner in the kitchen.\nMaria: Today I live in a small apartment.\nJohn: I read quietly in the evening.';
  const task = corpusSpeakers(text, 0)!;
  fixture.blocks[0].text = text;
  fixture.questions[0] = { ...question, pairs: task.pairs, choices: task.choices, evidence: task.evidence,
    additionalEvidence: [{ blockId: question.blockId, ...task.otherEvidence }] };
  const example = corpusWorkedExample(fixture, 0, 'A1')!;
  expect(example.en).toContain('John: I read quietly in the evening.');
  expect(example.en).not.toContain('I live in a small apartment.');
  expect(examples).toBeGreaterThan(0);
});

it('reserves a distinct apartment fact for teaching without leaking scored rows', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const seenNames = new Set<string>(), exampleNames = new Set<string>();
  let ordinaryTables = 0;
  for (let seed = 0; seed < 18; seed++) {
    const ordinary = corpusLesson(corpus, new Set(), seed, 120, 'A1')!;
    const first = ordinary.materials[0].questions[0];
    if ('kind' in first && first.kind === 'table') { ordinaryTables++; expect(ordinary.workedExample?.en).toContain('code after'); }
    const lesson = corpusLesson(corpus, new Set(), seed, 120, 'A1', [], 'table')!;
    const material = lesson.materials[0], question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'table') throw new Error('Expected apartment table');
    const before = structuredClone(material);
    const example = corpusWorkedExample(material, seed, 'A1')!;
    expect(example.en).toContain('code after');
    expect(example['zh-Hans']).toContain('名字与');
    expect(example['zh-Hant']).toContain('名字與');
    expect(lesson.workedExample).toEqual(example);
    expect(corpusWorkedExample(material, seed, 'B1')!['zh-Hans']).toBe(example.en);
    const text = material.blocks[0].text;
    const quote = [...example.en.matchAll(/“([^”]+)”/g)][0][1];
    const start = text.indexOf(quote), end = start + quote.length;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(text.lastIndexOf(quote)).toBe(start);
    exampleNames.add(quote.split(':')[0]);
    for (const row of question.rows) {
      seenNames.add(row.label);
      expect(example.en).not.toContain(row.label);
      expect(example.en).not.toContain(row.answer);
    }
    for (const range of [question.evidence, ...question.additionalEvidence!])
      expect(start >= range.end || end <= range.start).toBe(true);
    expect(score(question, question.rows.map(row => row.answer)).correct).toBe(true);
    expect(material).toEqual(before);
    const covered = structuredClone(material);
    covered.questions[0] = { ...question, evidence: { start: 0, end: text.length } };
    expect(corpusWorkedExample(covered, seed, 'A1')).toBeUndefined();
  }
  expect(ordinaryTables).toBeGreaterThan(0);
  for (const name of ['Anna', 'Jonathan', 'Pete']) {
    expect(seenNames.has(name)).toBe(true);
    expect(exampleNames.has(name)).toBe(true);
  }
  expect(seenNames.size).toBeGreaterThan(6);
  const two = 'Anna: I am in apartment A1.\nPete: I am in apartment B2.';
  const task = corpusApartments(two, 0)!;
  expect(task.rows).toHaveLength(2);
  const material = corpusLesson(corpus, new Set(), 0, 120, 'A1', [], 'table')!.materials[0];
  const question = material.questions[0];
  if (!('kind' in question) || question.kind !== 'table') throw new Error('Expected apartment table');
  material.blocks[0].text = two;
  material.questions[0] = { ...question, rows: task.rows, evidence: task.evidence,
    additionalEvidence: task.otherEvidence.map(range => ({ blockId: question.blockId, ...range })) };
  expect(corpusWorkedExample(material, 0, 'A1')).toBeUndefined();
});

it('demonstrates qualification on an unused exact sentence without revealing a scored option', () => {
  const text = 'The island is thought to have formed after an eruption. The team mapped the shore in June. The cliff contains three separate layers. The old harbour may have been used by traders. The museum displays tools from the site.';
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  // Test extraction here; verify normal source downloads in browsers.
  corpus.records = corpus.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text,
    wordCount: text.split(/\s+/).length, language: undefined, task: undefined }] }));
  for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 300, 'B2', [], 'evidence')!;
    const material = lesson.materials[0], question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected qualification evidence');
    const example = corpusWorkedExample(material, seed, 'B2')!;
    expect(lesson.workedExample).toEqual(example);
    expect(example).toEqual(corpusWorkedExample(material, seed, 'B2'));
    const quotes = [...example.en.matchAll(/“([^”]+)”/g)].map(match => match[1]);
    expect(text).toContain(quotes[0]);
    expect(quotes[0]).toContain(quotes[1]);
    expect(['is thought to', 'may have been']).toContain(quotes[1]);
    for (const span of question.spans) expect(example.en).not.toContain(span.text);
    const start = text.indexOf(quotes[0]), end = start + quotes[0].length;
    for (const range of [question.evidence, ...question.spans]) expect(start >= range.end || end <= range.start).toBe(true);
    for (const level of ['B1', 'B2', 'C1', 'C2'] as const) {
      const localized = corpusWorkedExample(material, seed, level)!;
      expect(localized.en).toBe(localized['zh-Hans']);
      expect(localized.en).toBe(localized['zh-Hant']);
    }
    expect(score(question, question.accepted[0]).correct).toBe(true);
    expect(score(question, (question.accepted[0] + 1) % question.spans.length).correct).toBe(false);
    const covered = structuredClone(material);
    covered.questions[0] = { ...question, additionalEvidence: [{ blockId: question.blockId, start: 0, end: text.length }] };
    expect(corpusWorkedExample(covered, seed, 'B2')).toBeUndefined();
    const unrelated = structuredClone(material);
    unrelated.questions[0] = { ...question, prompt: 'Which sentence names the location?' };
    expect(corpusWorkedExample(unrelated, seed, 'B2')).toBeUndefined();
    const sole = structuredClone(material);
    sole.blocks[0].text = text.replace('The old harbour may have been used by traders.', 'The old harbour served the nearby town.');
    if (quotes[0].includes('harbour')) expect(corpusWorkedExample(sole, seed, 'B2')).toBeUndefined();
  }
});

it('matches explicit requested and ruled-out naming actions without manufacturing general obligations', () => {
  const sentence = "Please always refer to our bricks as 'LEGO Bricks or Toys' and not 'LEGOS.'";
  const other = "Please refer to the tickets as 'passes' and not 'vouchers'.";
  for (let seed = 0; seed < 8; seed++) {
    const task = corpusRequests(sentence, seed)!;
    expect(sentence.slice(task.evidence.start, task.evidence.end)).toBe(sentence);
    expect(task.pairs.find(pair => pair.answer === 'Requested')!.label).toContain('LEGO Bricks or Toys');
    expect(task.pairs.find(pair => pair.answer === 'Ruled out')!.label).toBe("refer to our bricks as 'LEGOS'");
    expect(task).toEqual(corpusRequests(sentence, seed));
  }
  for (const text of ["Please refer to the tickets as 'passes'.", "Please never refer to the tickets as 'passes' and not 'vouchers'.", "Please refer to the tickets as 'passes' and not 'PASSES'.", "Please refer to the tickets as 'passes' and not 'passes.'", sentence + ' ' + sentence, 'Players must press the buttons to play a note.'])
    expect(corpusRequests(text, 0)).toBeUndefined();
  expect(() => corpusRequests(sentence, -1)).toThrow('INVALID_CORPUS_REQUESTS');
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const text = sentence + ' ' + other + ' ' + corpus.records[0].passages[0].text;
  corpus.records = corpus.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text, wordCount: text.split(/\s+/).length, task: undefined, language: undefined }] }));
  const lesson = corpusLesson(corpus, new Set(), 0, 700, 'B2', [], 'matching')!;
  const question = lesson.materials[0].questions[0];
  if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected request matching');
  expect(question.prompt).toContain('request');
  expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
  expect(score(question, question.pairs.map(pair => pair.answer === 'Requested' ? 'Ruled out' : 'Requested')).correct).toBe(false);
  expect(lesson.teaching!.en).toContain('and not');
  expect(lesson.workedExample!.en).toContain(other);
  expect(lesson.workedExample!.en).not.toContain(sentence);
  expect(lesson.workedExample!.en).toBe(lesson.workedExample!['zh-Hans']);
});

 it('preserves reciprocal named reliance and rejects ambiguous general duties', () => {
  const sentence = 'As designed, the Defuser cannot look at the manual and must rely on the Experts to instruct them; similarly, the Experts cannot see the bomb, and must rely on the Defuser to describe the bomb to them.';
  for (let seed = 0; seed < 8; seed++) {
    const task = corpusRoleActions(sentence, seed)!;
    expect(sentence.slice(task.evidence.start, task.evidence.end)).toBe(sentence);
    expect(task.pairs.find(pair => pair.answer === 'Defuser')!.label).toBe('rely on the Experts to instruct them');
    expect(task.pairs.find(pair => pair.answer === 'Experts')!.label).toBe('rely on the Defuser to describe the bomb to them');
    expect(task).toEqual(corpusRoleActions(sentence, seed));
  }
  for (const text of [sentence + ' ' + sentence, sentence.replace('the Experts to instruct', 'the Guide to instruct'),
    'The Reader cannot see the screen and must ask for help; similarly, the Listener cannot hear the audio, and must request help.',
    'The Guide cannot see Alex and must ask Sam to instruct them; similarly, the Helper cannot see Jo, and must ask Kim to describe Jo to them.'])
    expect(corpusRoleActions(text, 0)).toBeUndefined();
  expect(() => corpusRoleActions(sentence, -1)).toThrow('INVALID_CORPUS_ROLES');
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const text = sentence + ' ' + corpus.records[0].passages[0].text;
  corpus.records = corpus.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text, wordCount: text.split(/\s+/).length, task: undefined, language: undefined }] }));
  const lesson = corpusLesson(corpus, new Set(), 0, 700, 'B2', [], 'matching')!;
  const question = lesson.materials[0].questions[0];
  if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected role matching');
  expect(question.prompt).toContain('match each reliance');
  expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
  expect(score(question, [...question.pairs.map(pair => pair.answer)].reverse()).correct).toBe(false);
});

 it('compares two named attributed statements without inventing disagreement or automatic tone scores', () => {
  const text = 'According to James Barr, it involves concentrating authority in the canonical text and not in the people or events. According to Childs, it represents an entirely new departure, replacing the entire historical-critical method.';
  for (let seed = 0; seed < 8; seed++) {
    const task = corpusViewpoints(text, seed)!;
    expect(new Set(task.names)).toEqual(new Set(['James Barr', 'Childs']));
    for (const span of [task.evidence, ...task.otherEvidence]) expect(text.slice(span.start, span.end)).toMatch(/^According to /);
    expect(task).toEqual(corpusViewpoints(text, seed));
  }
  for (const invalid of [text.replace('Childs', 'Barr'), text.replace('Childs', 'James Barr'), text.split('. ')[0] + '.', 'He said it was useful. He also said it was new.']) expect(corpusViewpoints(invalid, 0)).toBeUndefined();
  expect(() => corpusViewpoints(text, -1)).toThrow('INVALID_CORPUS_VIEWPOINTS');
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const padded = text + ' ' + corpus.records[0].passages[0].text;
  corpus.records = corpus.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text: padded, wordCount: padded.split(/\s+/).length, task: undefined, language: undefined }] }));
  const lesson = corpusLesson(corpus, new Set(), 0, 700, 'B2')!;
  for (const material of lesson.materials) {
    const response = material.questions[1];
    if (!('kind' in response) || response.kind !== 'response') throw new Error('Expected open comparison');
    expect(response.prompt).toContain('If the passage supports no contrast');
    expect(response.criteria).toHaveLength(3);
    expect(response.additionalEvidence).toHaveLength(1);
    expect('modelAnswer' in response).toBe(false);
    expect(score(response, 'The two sources emphasise different aspects.').correct).toBeNull();
    expect(response.criteria.every(criterion => criterion.en === criterion['zh-Hans'] && criterion.en === criterion['zh-Hant'])).toBe(true);
  }
});

it('matches only explicit room activities and keeps them separate from speaker matching', async () => {
  const { corpusRooms, roomMatchingPrompt } = await import('../src/core/corpus');
  const text = 'Maya: We cook in the kitchen.\nNoah: I relax in the living room.\nMaya: I wash in the bathroom.';
  for (let seed = 0; seed < 8; seed++) {
    const task = corpusRooms(text, seed)!;
    expect(new Set(task.choices).size).toBe(2);
    for (const [index, pair] of task.pairs.entries()) expect(text.slice([task.evidence, task.otherEvidence][index].start, [task.evidence, task.otherEvidence][index].end)).toContain(`${pair.label} in the ${pair.answer}.`);
  }
  for (const invalid of [text + '\nNoah: I cook in the bedroom.', 'Maya: I might cook in the kitchen.\nNoah: I do not relax in the living room.', 'Maya: We cook in the kitchen.\nNoah: I eat in the kitchen.']) expect(corpusRooms(invalid, 0)).toBeUndefined();
  const repeated = 'Maya: I cook in the kitchen.\nNoah: I cook in the kitchen.\nMaya: I relax in the living room.\nNoah: I relax in the living room.';
  expect(corpusRooms(repeated.split('\n').slice(0, 3).join('\n') + '\nMaya: I cook in the bedroom.', 0)).toBeUndefined();
  expect(corpusRooms(repeated, 0)?.pairs).toEqual([{ label: 'cook', answer: 'kitchen' }, { label: 'relax', answer: 'living room' }]);
  expect(corpusRooms(repeated + '\nMaya: I cook in the bedroom.', 0)).toBeUndefined();
  expect(corpusSpeakers(repeated, 0)).toBeUndefined();
  for (const qualification of ['I do not cook in the kitchen.', 'I might cook in the kitchen.', 'I cook in the kitchen only if it is clean.', "I don't cook."]) expect(corpusRooms(repeated + '\nMaya: ' + qualification, 0)).toBeUndefined();
  expect(corpusRooms(repeated.replaceAll('kitchen.', 'kitchen!'), 0)?.pairs).toHaveLength(2);
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const task = corpusRooms(repeated, seed)!;
    expect(task.pairs).toHaveLength(2);
    for (const pair of task.pairs) expect(pair.answer).toBe(pair.label === 'cook' ? 'kitchen' : 'living room');
    expect(corpusRooms(repeated.split('\n').slice(0, 3).join('\n') + '\nMaya: I cook in the bedroom.', seed)).toBeUndefined();
  }), { numRuns: 500, seed: 20261007 });
  expect(() => corpusRooms(text, -1)).toThrow('INVALID_CORPUS_ROOMS');
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  for (const point of ['A1', 'A2'] as const) {
    const lesson = corpusLesson(bank, new Set(), 0, point === 'A1' ? 120 : 160, point, [], 'matching', `matching:${roomMatchingPrompt}`)!;
    const material = lesson.materials[0], question = material.questions[0];
    expect(material.rootId === 'voa-article-3168971' || material.rootId.startsWith('lingfern-dialogue-')).toBe(true);
    if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected room matching');
    expect(question.prompt).toBe(roomMatchingPrompt);
    expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
    expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
    expect(lesson.materials[1].rootId).not.toBe(material.rootId);
    expect(lesson.materials[1].questions[0].prompt).toBe(roomMatchingPrompt);
    expect(lesson.workedExample!.en).toMatch(/^Example: “.+” → (?:rest|wash|sleep): .+\./);
    for (const pair of question.pairs) expect(lesson.workedExample!.en).not.toContain(pair.answer);
    const excluded = corpusLesson(bank, new Set([material.id.slice(7)]), 0, 160, point, [], 'matching', `matching:${roomMatchingPrompt}`);
    expect(excluded?.materials.some(part => part.id === material.id) ?? false).toBe(false);
    const speaker = corpusLesson(bank, new Set(), 0, 160, point, [], 'matching', 'matching:Who says each sentence? Match it to a person.')!;
    expect(speaker.materials.every(part => part.questions[0].prompt === 'Who says each sentence? Match it to a person.')).toBe(true);
  }
});

it('separates a beginner requested address from a full introduction and unrelated actions', async () => {
  const { corpusAddress } = await import('../src/core/corpus');
  const { corpusOperation, requestedAddressPrompt } = await import('../src/core/corpusPractice');
  const text = 'Maya: I am your teacher, Maya Jones. But, please call me Maya.';
  for (let seed = 0; seed < 10; seed++) {
    const task = corpusAddress(text, seed)!;
    expect(task.options[task.answer]).toBe('Maya');
    expect(task.options).toEqual(seed % 2 ? ['Maya', 'Maya Jones'] : ['Maya Jones', 'Maya']);
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(text);
  }
  for (const invalid of [text.replace('please call', 'do not call'), text.replace('please call me Maya', 'please call me Noah'), text + '\nNoah: Please call me Noah.', 'Maya: Maya Jones said “please call me Maya”.']) expect(corpusAddress(invalid, 0)).toBeUndefined();
  expect(() => corpusAddress(text, -1)).toThrow('INVALID_CORPUS_ADDRESS');
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  for (const point of ['A1', 'A2'] as const) for (let seed = 0; seed < 4; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 160, point, [], 'choice', 'choice:requested-address')!;
    const material = lesson.materials[0], question = material.questions[0];
    expect(material.rootId === 'voa-article-3240468' || material.rootId.startsWith('lingfern-dialogue-')).toBe(true);
    if ('kind' in question) throw new Error('Expected requested-address choice');
    expect(question.prompt).toBe(requestedAddressPrompt);
    expect(corpusOperation(question)).toBe('choice:requested-address');
    const requestedName = corpusAddress(material.blocks[0].text, seed)!.name;
    expect(question.options[question.answer]).toBe(requestedName);
    expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end)).toContain(`please call me ${requestedName}`);
    expect(score(question, question.answer).correct).toBe(true);
    expect(score(question, 1 - question.answer).correct).toBe(false);
    expect(lesson.materials[1].rootId).not.toBe(material.rootId);
    expect(corpusOperation(lesson.materials[1].questions[0])).toBe('choice:requested-address');
    expect(lesson.workedExample!.en).not.toContain('Caty');
    expect(lesson.goal.en).toBe('Find the requested name.');
    expect(question.hints?.[2]['zh-Hans']).toContain('不是打电话');
    const excluded = corpusLesson(bank, new Set([material.id.slice(7)]), seed, 160, point, [], 'choice', 'choice:requested-address');
    expect(excluded?.materials.some(part => part.id === material.id) ?? false).toBe(false);
  }
});

it.each(['A1', 'A2'] as const)('states each %s beginner first-task goal in all locales independently of the application task', async point => {
  const { corpusOperation } = await import('../src/core/corpusPractice');
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const beginnerBook = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8'))).records.find(source => source.rootId === 'gutenberg-book-45')!;
  bank.records.push({ ...beginnerBook, passages: beginnerBook.passages.filter(passage => passage.startingPoints) });
  bank.records = await (await import('../src/data/corpus')).reviewedReading(bank.records, 120);
  const goals: Record<string, string[]> = {
    completion: ['Find the missing word.', '找到缺少的词。', '找到缺少的詞。'],
    sequence: ['Put sentences in text order.', '按文中的顺序排列句子。', '按文中的順序排列句子。'],
    'table:Write each person’s apartment code.': ['Match people to apartment codes.', '把人物与公寓编号对应。', '把人物與公寓編號對應。'],
    'matching:Who says each sentence? Match it to a person.': ['Match sentences to speakers.', '把句子与说话者配对。', '把句子與說話者配對。'],
    'matching:Match each activity to its room.': ['Match activities to rooms.', '把活动与房间配对。', '把活動與房間配對。'],
    'choice:work-phone': ['Find the work phone number.', '找到工作电话。', '找到工作電話。'],
    'choice:requested-address': ['Find the requested name.', '找到请求使用的称呼。', '找到請求使用的稱呼。'],
    'choice:stated-origin': ['Find the place the person says they are from.', '找到这个人说自己来自的地方。', '找到這個人說自己來自的地方。'],
    'choice:stated-intention': ['Find what the person wants to do.', '找到这个人想做的事。', '找到這個人想做的事。'],
    'matching:Who? Match each description to a person.': ['Find who gives each simple description of themselves.', '找出是谁在描述自己。', '找出是誰在描述自己。'],
    'choice:stated-location': ['Find the stated place relationship.', '找到原文明说的地点关系。', '找到原文明說的地點關係。'],
    'choice:basic-instruction': ['Follow the stated action and order.', '保留指令中的动作和先后。', '保留指令中的動作和先後。'],
    'choice:small-quantity': ['Read a small count and keep it with the right item.', '读懂小数量，并对应到正确的对象。', '讀懂小數量，並對應到正確的對象。'],
    'choice:stated-time': ['Find the written clock time for the asked event.', '找到题目所问事情的书面时刻。', '找到題目所問事情的書面時刻。'],
    'choice:detail-verification': ['Check a written detail against the text.', '用原文核对一条书面信息。', '用原文核對一條書面資訊。'],
  };
    const operations = new Set<string>();
    const cycle = bank.records.reduce((count, source) => count + source.passages.filter(passage => passage.startingPoints?.includes(point)).length, 0);
    for (let seed = 0; seed < cycle * (point === 'A2' ? 24 : 45); seed++) {
      const lesson = corpusLesson(bank, new Set(), seed, point === 'A1' ? 120 : 160, point)!;
      const operation = corpusOperation(lesson.materials[0].questions[0]);
      if (!operation) throw new Error('Missing first-task operation');
      operations.add(operation);
      expect([lesson.goal.en, lesson.goal['zh-Hans'], lesson.goal['zh-Hant']]).toEqual(goals[operation]);
      const changed = { ...lesson, materials: [lesson.materials[0], lesson.materials[0]] };
      expect(corpusStartingPoint(changed, point).goal).toEqual(lesson.goal);
    }
    expect([...operations].sort()).toEqual(Object.keys(goals).filter(operation => point === 'A2' ? !['matching:Who? Match each description to a person.', 'choice:stated-location', 'choice:basic-instruction', 'choice:small-quantity', 'choice:detail-verification', 'choice:stated-time'].includes(operation) : operation !== 'choice:stated-origin').sort());
}, 20000);

it('keeps the teaching source while finding a same-operation reading application in installed texts', () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const attributed = 'According to Alice Smith, the harbour served a nearby town. The museum displays tools from the site. According to Robert Jones, the ridge formed from loose material. The team mapped the shore in June.';
  const unrelated = 'The museum opened its doors in June. Visitors entered through the main gate. The guide described the collection inside. The guests waited near the entrance.';
  const source = (index: number, text: string) => ({ ...bank.records[index], passages: [{ ...bank.records[index].passages[0], text, wordCount: text.split(/\s+/).length, language: undefined, task: undefined }] });
  const primary = { ...bank, records: [source(0, attributed), source(1, unrelated)] };
  const installed = { ...bank, records: [source(0, unrelated), source(2, attributed)] };
  const operation = 'evidence:Which sentence explicitly attributes a claim to a named source?';
  for (let seed = 0; seed < 6; seed++) {
    const previous = corpusLesson(primary, new Set(), seed, 300, 'B2', [], 'evidence', operation)!;
    expect(previous.materials[1].questions[0].prompt).not.toBe(previous.materials[0].questions[0].prompt);
    const lesson = corpusLesson(primary, new Set(), seed, 300, 'B2', [], 'evidence', operation, installed)!;
    expect(lesson.materials[0].rootId).toBe(bank.records[0].rootId);
    expect(lesson.materials[0].blocks[0].text).toBe(attributed);
    expect(lesson.materials[1].rootId).toBe(bank.records[2].rootId);
    expect(lesson.materials[1].credit).toEqual({ attribution: bank.records[2].attribution, license: bank.records[2].licence, sourceUrl: bank.records[2].originalUrl });
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected attributed application');
      expect(question.prompt).toBe(previous.materials[0].questions[0].prompt);
      expect(score(question, question.accepted[0]).correct).toBe(true);
      expect(score(question, (question.accepted[0] + 1) % 3).correct).toBe(false);
    }
    const excluded = corpusLesson(primary, new Set([installed.records[1].passages[0].id]), seed, 300, 'B2', [], 'evidence', operation, installed)!;
    expect(excluded.materials[1].rootId).not.toBe(bank.records[2].rootId);
    const long = { ...installed, records: [{ ...installed.records[1], passages: [{ ...installed.records[1].passages[0], wordCount: 301 }] }] };
    expect(corpusLesson(primary, new Set(), seed, 300, 'B2', [], 'evidence', operation, long)!.materials[1].rootId).not.toBe(bank.records[2].rootId);
  }
  const alone = { ...primary, records: primary.records.slice(0, 1) };
  expect(corpusLesson(alone, new Set(), 0, 300, 'B2', [], 'evidence', operation)).toBeUndefined();
  expect(corpusLesson(alone, new Set(), 0, 300, 'B2', [], 'evidence', operation, installed)?.materials).toHaveLength(2);
});

it('respects exact matching focus when a passage supports several semantic families', async () => {
  const { corpusOperation } = await import('../src/core/corpusPractice');
  const bank = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const text = "Please refer to the tickets as 'passes' and not 'vouchers'. As designed, the Defuser cannot look at the manual and must rely on the Experts to instruct them; similarly, the Experts cannot see the bomb, and must rely on the Defuser to describe the bomb to them. According to Alice Smith, the harbour served a nearby town. According to Robert Jones, the ridge formed from loose material.";
  bank.records = bank.records.slice(0, 2).map(source => ({ ...source, passages: [{ ...source.passages[0], text, wordCount: text.split(/\s+/).length, language: undefined, task: undefined }] }));
  for (const prompt of ['Match each action to what the request asks for or rules out.', 'In the paired statement, match each reliance to what needs it.', 'Match each claim to the source named in the passage.']) for (let seed = 0; seed < 6; seed++) {
    const operation = `matching:${prompt}`;
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2', [], 'matching', operation)!;
    for (const material of lesson.materials) {
      const question = material.questions[0];
      expect(corpusOperation(question)).toBe(operation);
      if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected focused matching');
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
    }
  }
});

it('retains the supporting source but falls back together when its semantic partner is unavailable', () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const plain = 'The museum opened its doors in June. Visitors entered through the main gate. The guide described the collection inside. The guests waited near the entrance.';
  const attributed = 'According to Alice Smith, the harbour served a nearby town. According to Robert Jones, the ridge formed from loose material. ' + plain;
  bank.records = bank.records.slice(0, 2).map((source, index) => { const text = index ? attributed : plain; return { ...source, passages: [{ ...source.passages[0], text, wordCount: text.split(/\s+/).length, language: undefined, task: undefined }] }; });
  for (const seed of [2, 3]) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2')!;
    expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual(['completion', 'completion']);
    expect(lesson.materials[0].rootId).toBe(bank.records[1].rootId);
    if (lesson.generation?.generator !== 'corpus-v1') throw new Error('Expected corpus generation');
    expect(lesson.generation.focus).toBeUndefined();
  }
  const fallback = corpusLesson(bank, new Set(), 0, 300, 'B2')!;
  expect(fallback.materials[0].questions[0]).toMatchObject({ kind: 'completion' });
  const explicit = corpusLesson(bank, new Set(), 2, 300, 'B2', [], 'completion')!;
  expect(explicit.materials.every(material => 'kind' in material.questions[0] && material.questions[0].kind === 'completion')).toBe(true);
});

it('retains complete honorific names in actual beginner ordering and speaker tasks', () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const passage = bank.records.find(record => record.rootId === 'voa-article-3240468')!.passages[0];
  for (let seed = 0; seed < 20; seed++) {
    const ordered = corpusSequence(passage.text, seed)!;
    expect(ordered.acceptedOrders[0].some(step => /\bMs\.$/.test(step))).toBe(false);
    for (const step of ordered.steps) expect(passage.text).toContain(step);
    const speakers = corpusSpeakers(passage.text, seed);
    for (const pair of speakers?.pairs ?? []) expect(pair.label).not.toMatch(/\bMs\.$/);
  }
  expect(corpusSequence(passage.text, 0)!.acceptedOrders[0]).toContain('Anna: Thank you, Ms. Weaver.');
  expect(corpusSequence('The organiser introduced Dr.\n\nThe audience waited near the entrance. The visitors returned to the hallway.', 0)).toBeUndefined();
  for (const text of [
    'In Dr. Mario World, and similar to prior Dr. Mario games, the player removed viruses from the screen by matching their colors with that of a pill capsule. The player oriented a single pill capsule against an array of viruses and obstacles.',
    'Because alcoholic beverages have been ordered at both tables, Daniel\'s behavior becomes more erratic. He dumps pepper (which Stuart is allergic to) on Stuart\'s order and then forgets to change out of the Mrs. Doubtfire costume before returning to Lundy\'s table.',
  ]) expect(corpusSequence(text, 0)).toBeUndefined();
});

it('keeps honorific continuations in actual evidence alternatives', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string }[] };
  for (const [id, passageId, generator] of [
    ['wikipedia-reading-007', 'c27f347f41dac17cd241aed0f478442252f39912a4df837692a84bdb7edcfa0e', corpusQualification],
    ['wikipedia-reading-010', '73674a736bb19f36d6d741dd5e178404cae044b3dc00d731e4b49a57b21ddbc0', corpusAttribution],
    ['wikipedia-reading-017', '381645442bb1deb84b536b019202cea464c7f1d4767238d81679cf115fa4c834', corpusQualification],
    ['wikipedia-reading-021', '013eebaf0a9337dc98eb26ba694904e17ef8c5bee840c38c230aaa790fab8630', corpusAttribution],
  ] as const) {
    const entry = catalogue.packs.find(pack => pack.id === id)!;
    const bank = (await inspectCommunityPack(readSourcePackFixture(entry.id))).corpus!;
    const passage = bank.records.flatMap(record => record.passages).find(passage => passage.id === passageId)!;
    for (let seed = 0; seed < 3; seed++) {
      const task = generator(passage.text, seed)!;
      expect(task).toBeDefined();
      for (const span of task.spans) {
        expect(span.text).not.toMatch(/\b(?:Dr|Mr|Mrs|Ms|Prof|St)\.(?:\s*[A-Z]\.)*$/);
        if (span.text.includes('Dr. E.H.')) expect(span.text).toContain('Schulz and Dr. R. Frercks.');
        expect((span.text.match(/"/g)?.length ?? 0) % 2).toBe(0);
        expect(passage.text.slice(span.start, span.end)).toBe(span.text);
      }
      if (generator === corpusAttribution) for (const [index, span] of task.spans.entries()) {
        if (!task.accepted.includes(index)) expect(span.text).not.toMatch(/\b(?:writing|considered|thought|called|described|applauded)\b/i);
      }
    }
  }
});

it('locates complete explicit assignments without inferring causal duties or completion', async () => {
  const { corpusAssignment, assignmentPrompt } = await import('../src/core/corpus');
  const context = 'The team was tasked with checking the doors and windows before opening. The building was constructed in 1990. A garden stood beside the entrance.';
  for (let seed = 0; seed < 8; seed++) {
    const task = corpusAssignment(context, seed)!;
    expect(task.prompt).toBe(assignmentPrompt);
    expect(context.slice(task.evidence.start, task.evidence.end)).toBe(context.split('. ')[0] + '.');
    expect(task.spans[task.accepted[0]].text).toContain('doors and windows before opening');
    for (const text of [context.replace('was tasked', 'was not tasked'), context.replace('was tasked', 'might be tasked'), 'If funding arrives, ' + context, context.replace('was tasked with', 'was responsible for'), context + ' ' + context.split('. ')[0] + '.']) expect(corpusAssignment(text, seed)).toBeUndefined();
  }
  expect(() => corpusAssignment(context, -1)).toThrow('INVALID_CORPUS_ASSIGNMENT');
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string }[] };
  const { reviewedReading } = await import('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const records = [];
  for (const id of ['wikipedia-reading-017', 'wikipedia-reading-030']) {
    const entry = catalogue.packs.find(pack => pack.id === id)!;
    const bank = (await inspectCommunityPack(readSourcePackFixture(entry.id))).corpus!;
    records.push(...await reviewedReading(bank.records));
  }
  const bank = { version: 1 as const, failures: [], records };
  for (let seed = 0; seed < 8; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2', [], 'evidence', `evidence:${assignmentPrompt}`)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal.en).toContain('assigned task');
    expect(lesson.teaching!.en).toContain('proof that it was completed');
    for (const material of lesson.materials) {
      const question = material.questions[0], response = material.questions[1];
      if (!('kind' in question) || question.kind !== 'evidence' || !('kind' in response) || response.kind !== 'response') throw new Error('Expected assignment/evidence and unscored explanation');
      expect(question.prompt).toBe(assignmentPrompt);
      for (const index of question.spans.keys()) expect(score(question, index).correct).toBe(question.accepted.includes(index));
      expect(response.prompt).toContain('without assuming completion');
      expect(score(response, 'I would preserve the full action and its conditions.').correct).toBeNull();
    }
  }
});

it('locates reviewed infinitive assignments without mistaking a unit posting for a task', async () => {
  const { corpusAssignment, assignmentPrompt } = await import('../src/core/corpus');
  const context = 'The assistants were assigned to keep a constant watch before launch. The vehicle stood beside the entrance. The team arrived early that morning.';
  expect(corpusAssignment(context, 0)?.spans.some(span => span.text.includes('assigned to keep'))).toBe(true);
  for (const replacement of ['were assigned to the division', 'were assigned to a station', 'were not assigned to keep', 'might be assigned to keep', 'were assigned to supervise?']) {
    expect(corpusAssignment(context.replace('were assigned to keep', replacement), 0)).toBeUndefined();
  }
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string }[] };
  const { reviewedReading } = await import('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const records = [];
  for (const id of ['wikipedia-reading-010', 'wikipedia-reading-012', 'wikipedia-reading-016']) {
    const entry = catalogue.packs.find(pack => pack.id === id)!;
    records.push(...await reviewedReading((await inspectCommunityPack(readSourcePackFixture(entry.id))).corpus!.records));
  }
  for (const [rootId, passageId] of [
    ['wikipedia-article-18739', 'bc9328acbe83956128099a8a226685c22c8ca6b36632922dea355f9f7305ae29'],
    ['wikipedia-article-1267838', 'bd5e34498af6bb58266e3f7e9273b22165e6c47cc1c6995b554055186b22913a'],
    ['wikipedia-article-58719', '771202b26ceee41ac3636c947e6ae7f37152b5994783c1d5c2e4dddeaf9cea6c'],
  ]) {
    const passage = records.find(record => record.rootId === rootId)!.passages.find(passage => passage.id === passageId)!;
    for (let seed = 0; seed < 8; seed++) {
      const task = corpusAssignment(passage.text, seed)!;
      expect(passage.text.slice(task.evidence.start, task.evidence.end)).toContain('assigned to');
      expect(task.spans[task.accepted[0]].text).toBe(passage.text.slice(task.evidence.start, task.evidence.end));
      expect(task.spans.filter((_, index) => !task.accepted.includes(index)).every(span => !/assign|task|dut|request/i.test(span.text))).toBe(true);
    }
  }
  const lesson = corpusLesson({ version: 1, failures: [], records }, new Set(), 0, 300, 'B2', [], 'evidence', `evidence:${assignmentPrompt}`)!;
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  expect(lesson.materials.every(material => material.questions[0].prompt === assignmentPrompt)).toBe(true);
});


it('preserves the explicit compose assignment and withholds uncertain, reported and broken targets', async () => {
  const { corpusAssignment } = await import('../src/core/corpus');
  const statement = "Staff writer Norman Stiles, who also wrote the episode in which Mr. Hooper's death was explained, was assigned to compose the script.";
  const neutral = ' The building stood beside a garden. The team arrived on Monday morning.';
  expect(corpusAssignment(statement + neutral, 0)?.spans.some(span => span.text === statement)).toBe(true);
  for (const text of [
    statement.replace('was assigned', 'was not assigned'), statement.replace('was assigned', 'might be assigned'),
    statement.replace('was assigned', 'may have been assigned'), 'If funding arrives, ' + statement,
    statement.replace('was assigned', 'was reportedly assigned'), statement.replace('was assigned', 'was possibly assigned'),
    'Dana said Alex was assigned to compose the script.',
    'The newspaper reported that ' + statement, 'The newspaper wrote that ' + statement,
    `A witness said, “The meeting opened. ${statement} The meeting ended.”`, `A witness said, "The meeting opened. ${statement} The meeting ended."`,
    statement.replace('compose the script.', 'the production team.'), statement.replace('script.', 'script?'),
    statement.replace('script.', 'script [citation needed].'), "Hooper's death was explained, was assigned to compose the script.",
    statement + ' ' + statement,
  ]) expect(corpusAssignment(text + neutral, 0), text).toBeUndefined();
  expect(corpusAssignment(statement, 0)).toBeUndefined();
});

it('transfers compose assignment across actual roots with exact scoring and assistance-free Test', async () => {
  const { createHash } = await import('node:crypto');
  const { corpusAssignment, assignmentPrompt } = await import('../src/core/corpus');
  const { reviewedReading } = await import('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const { asTestLesson } = await import('../src/shared/content');
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const records = [];
  for (const [pack, root, id] of [
    ['wikipedia-reading-025', 'wikipedia-article-10935109', 'e699d1e8017e6b3b34a3085ec863582f47d496427ce2b0581af79b4b832dc3d4'],
    ['wikipedia-reading-017', 'wikipedia-article-81194517', '8bcf86babc09a8ef59e72a03b783c8272e5fdca98e27fd45f71dd60e03657227'],
  ] as const) {
    const entry = catalogue.packs.find(entry => entry.id === pack)!;
    const bytes = readSourcePackFixture(entry.id); expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const source = (await reviewedReading((await inspectCommunityPack(bytes)).corpus!.records, 300)).find(source => source.rootId === root)!;
    const passage = source.passages.find(passage => id ? passage.id === id : passage.wordCount <= 300 && !!corpusAssignment(passage.text, 0))!;
    expect(passage).toBeDefined(); records.push({ ...source, passages: [passage] });
  }
  const operation = `evidence:${assignmentPrompt}`, bank = { version: 1 as const, failures: [], records };
  for (let seed = 0; seed < 7; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2', [], 'evidence', operation)!;
    lessonSchema.parse(lesson); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const question = material.questions[0], response = material.questions[1];
      if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected evidence');
      expect(question.prompt).toBe(assignmentPrompt);
      const evidence = material.blocks[0].text.slice(question.evidence.start, question.evidence.end);
      expect(question.spans[question.accepted[0]].text).toBe(evidence);
      if (material.rootId === 'wikipedia-article-10935109') {
        expect(evidence).toMatch(/^Staff writer Norman Stiles,/); expect(evidence).toContain("Mr. Hooper's death was explained, was assigned to compose the script.");
        expect(question.spans.filter((_, index) => !question.accepted.includes(index)).every(span => !span.text.startsWith("Hooper's death"))).toBe(true);
      }
      for (const index of question.spans.keys()) expect(score(question, index).correct).toBe(question.accepted.includes(index));
      expect(score(response, 'An assignment does not establish its completion.').correct).toBeNull();
    }
    const tested = asTestLesson(lesson);
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
    for (const [index, material] of tested.materials.entries()) {
      expect(material.questions.map(question => question.hints)).toEqual([undefined, undefined]);
      expect(material.questions[0].prompt).toBe(assignmentPrompt);
      expect(material.questions[0].evidence).toEqual(lesson.materials[index].questions[0].evidence);
    }
    expect(corpusLesson(bank, new Set(lesson.materials.map(material => material.id.slice(7))), seed, 300, 'B2', [], 'evidence', operation)).toBeUndefined();
  }
});

it('keeps actual date-table name context and rejects a split quoted review', async () => {
  const { reviewedReading } = await import('../src/data/corpus');
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string }[] };
  for (const [id, root, passageId] of [
    ['wikipedia-reading-008', 'wikipedia-article-45094397', '11e0f0d3b006230bdcf7983e9a08c538f6f4b9ab22a36c833006d0f1bc25118a'],
    ['wikipedia-reading-028', 'wikipedia-article-344149', 'af009d3aab09b0e601009ced8727f0be8f6efdb0b2ecd5f92b0006c60e49144c'],
  ]) {
    const entry = catalogue.packs.find(pack => pack.id === id)!;
    const records = await reviewedReading((await inspectCommunityPack(readSourcePackFixture(entry.id))).corpus!.records);
    const passage = records.find(record => record.rootId === root)!.passages.find(p => p.id === passageId)!;
    for (let seed = 0; seed < 6; seed++) {
      const task = corpusDates(passage.text, seed);
      if (root.endsWith('344149')) expect(task).toBeUndefined();
      else {
        const row = task!.rows.find(row => row.answer === '1910')!;
        expect(row.label).toBe('His son, Harry Brodribb Irving, produced a new adaptation by J. Comyns Carr in ________.');
        for (const [index, row] of task!.rows.entries()) {
          const span = [task!.evidence, ...task!.otherEvidence][index];
          expect(passage.text.slice(span.start, span.end)).toBe(row.label.replace('________', row.answer));
        }
      }
    }
  }
});


it('distinguishes the actual beginner work contact from the wrong answered number', async () => {
  const { corpusPhone } = await import('../src/core/corpus');
  const { corpusOperation, workPhonePrompt } = await import('../src/core/corpusPractice');
  const { score } = await import('../src/shared/content');
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const source = bank.records.find(source => source.rootId === 'voa-article-3126527')!;
  const text = source.passages[0].text;
  for (let seed = 0; seed < 12; seed++) {
    const task = corpusPhone(text, seed)!;
    expect(task.options[task.answer]).toBe('555-8986');
    expect(task.options[1-task.answer]).toBe('555-8689');
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe("Marsha's work number is 555-8986.");
    for (const level of ['A1','A2'] as const) {
      const lesson = corpusLesson(bank, new Set(), seed, 160, level, [], 'choice', 'choice:work-phone')!;
      const question = lesson.materials[0].questions[0];
      if ('kind' in question) throw Error('Expected phone choice');
      expect(question.prompt).toBe(workPhonePrompt);
      expect(corpusOperation(question)).toBe('choice:work-phone');
      expect(score(question, question.answer).correct).toBe(true);
      expect(score(question, 1-question.answer).correct).toBe(false);
      expect(lesson.materials[0].rootId).not.toBe(lesson.materials[1].rootId);
      expect(corpusOperation(lesson.materials[1].questions[0])).toBe('choice:work-phone');
      expect(lesson.workedExample!.en).not.toContain('555-');
    }
  }
  for (const invalid of [text.replace('555-8689','555-8986'), text.replace('You have the wrong number.','You have the right number.'), text.replace("work number is", "work number is not"),text.replace('No. This is', 'Maybe. This is'),text+"\nHer work number is 555-7777."]) expect(corpusPhone(invalid,0)).toBeUndefined();
  expect(() => corpusPhone(text,-1)).toThrow('INVALID_CORPUS_PHONE');
});


it('locates complete explicit concessive clauses without inventing tone or removing their limits', async () => {
  const { corpusConcession, concessionPrompt } = await import('../src/core/corpus');
  const text = 'Although the bridge was damaged, the route remained open to pedestrians. The museum holds a collection of local maps. Visitors enter through the eastern gate.';
  for (let seed=0;seed<6;seed++) {
    const task=corpusConcession(text,seed)!;
    expect(task.prompt).toBe(concessionPrompt);
    expect(corpusConcession(text.replace('Although','Even though'),seed)?.spans.some(span=>span.text.startsWith('Even though'))).toBe(true);
    expect(task.spans[task.accepted[0]].text).toBe(text.split('. ')[0]+'.');
    expect(task.explanation).toContain('not establish');
  }
  for (const invalid of [text.replace('Although','Because'),text.replace(', the route remained open to pedestrians',''),text.replace('Although the bridge was damaged','Although the bridge was “damaged'), 'Although the bridge was damaged, the route remained open. However, visitors waited. Despite the rain, the museum opened.']) expect(corpusConcession(invalid,0)).toBeUndefined();
  expect(()=>corpusConcession(text,-1)).toThrow('INVALID_CORPUS_CONCESSION');
  const catalogue = regressionSourcePacks as {packs:{id:string;path:string}[]};
  const entry = catalogue.packs.find(p=>p.id==='wikipedia-reading-001')!;
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const { reviewedReading } = await import('../src/data/corpus');
  const records = (await reviewedReading((await inspectCommunityPack(readSourcePackFixture(entry.id))).corpus!.records)).filter(r=>['wikipedia-article-1308988','wikipedia-article-40685706'].includes(r.rootId)).map(r=>({...r,passages:r.passages.filter(p=>['b070ae93015667ae7f73824e41a3953daaad96ff8e46bcba428d115482d9a202','1296ca9b8b54ecfe7a08fbe94a0508cd7d98956db2a0e79b9636b0a0b4bf9dd2'].includes(p.id))}));
  for(let seed=0;seed<6;seed++) {
    const lesson=corpusLesson({version:1,failures:[],records},new Set(),seed,300,'B2',[],'evidence',`evidence:${concessionPrompt}`)!;
    expect(new Set(lesson.materials.map(m=>m.rootId)).size).toBe(2);
    for(const material of lesson.materials) {
      const q=material.questions[0],response=material.questions[1];
      if(!('kind' in q)||q.kind!=='evidence'||!('kind' in response)||response.kind!=='response')throw Error('Expected concession evidence and unscored interpretation');
      expect(q.prompt).toBe(concessionPrompt);
      expect(q.id.length).toBeLessThanOrEqual(80);
      expect(q.spans[q.accepted[0]].text).toBe(material.blocks[0].text.slice(q.evidence!.start,q.evidence!.end));
      expect(response.prompt).toContain('both clauses');
    }
  }

});

it('retains postposed concessions and rejects quoted, nested or incomplete cues', async () => {
  const { corpusConcession, concessionPrompt } = await import('../src/core/corpus');
  const tail = ' The museum holds a collection of local maps. Visitors enter through the eastern gate.';
  for (const cue of ['although', 'even though']) {
    const sentence = `The route remained open to pedestrians, ${cue} the bridge was damaged.`;
    for (let seed = 0; seed < 7; seed++) {
      const task = corpusConcession(sentence + tail, seed)!;
      expect(task.spans[task.accepted[0]].text).toBe(sentence);
      expect((sentence + tail).slice(task.evidence.start, task.evidence.end)).toBe(sentence);
    }
  }
  for (const sentence of [
    'The route remained open to pedestrians, though.',
    'The route remained open to pedestrians, although.',
    'The route remained open to pedestrians because the bridge was repaired.',
    'The guide explains "although the bridge was damaged, the route remained open".',
    'The report says that although repairs were incomplete, the route remained open.',
    'The route remained open, although the bridge was damaged, even though repairs continued.',
  ]) expect(corpusConcession(sentence + tail, 0)).toBeUndefined();
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const { reviewedReading } = await import('../src/data/corpus');
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string }[] };
  const records = [];
  for (const [packId, passageId] of [
    ['wikipedia-reading-001', '68ded8509eea2eb633cf30ca19d578d9daaad8f49a7d61401a2348ef8537de31'],
    ['wikipedia-reading-002', 'ed4dec1f01eea7eb7297fbe8d2dd03c22a71146dd1ded88b572c7c690b3e74e4'],
  ]) {
    const entry = catalogue.packs.find(pack => pack.id === packId)!;
    const reviewed = await reviewedReading((await inspectCommunityPack(readSourcePackFixture(entry.id))).corpus!.records);
    if (packId === 'wikipedia-reading-001') {
      const label = reviewed.flatMap(record => record.passages).find(passage => passage.id === 'bda3a6cd7407c0f7d0160b8df4ec0144e49149227748f5a96396443dfc6cfd03')!;
      const task = corpusConcession(label.text, 0)!;
      expect(task.spans.every(span => !span.text.endsWith('Bros.'))).toBe(true);
      expect(task.spans.some(span => span.text.includes('Warner Bros. Records so that'))).toBe(true);
    }
    records.push(...reviewed
      .flatMap(record => record.passages.some(passage => passage.id === passageId) ? [{ ...record, passages: record.passages.filter(passage => passage.id === passageId) }] : []));
  }
  for (let seed = 0; seed < 7; seed++) {
    const lesson = corpusLesson({ version: 1, failures: [], records }, new Set(), seed, 300, 'B2', [], 'evidence', `evidence:${concessionPrompt}`)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected concession evidence');
      expect(question.prompt).toBe(concessionPrompt);
      expect(material.blocks[0].text.slice(question.evidence!.start, question.evidence!.end)).toBe(question.spans[question.accepted[0]].text);
      expect(score(question, question.accepted[0]).correct).toBe(true);
    }
  }
  // Do not truncate source options at title abbreviations.
  const abbreviation = 'The market remained difficult, even though records sold well as imports. In 1992, Ivo signed a distribution deal with Warner Bros. Records for the United States. Only a few acts had other recording deals. The label later changed its distribution arrangements.';
  expect(corpusConcession(abbreviation, 0)?.spans.every(span => !span.text.endsWith('Bros.'))).toBe(true);
});

it('uses only hash-reviewed contiguous A2 workplace excerpts with distinct application roots', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const review = JSON.parse(readFileSync('content/corpus/voa-beginner-review.json', 'utf8'));
  const additional = { ...corpus, records: corpus.records.flatMap(source => {
    const entries = review.records.find((entry: { rootId: string }) => entry.rootId === source.rootId)?.additionalExcerpts ?? [];
    return entries.length ? [{ ...source, passages: source.passages.filter(passage => entries.some((entry: { sha256: string }) => entry.sha256 === passage.id)) }] : [];
  }) };
  expect(additional.records).toHaveLength(2);
  expect(additional.records.map(source => source.passages[0].wordCount)).toEqual([124, 82]);
  for (const source of additional.records) {
    expect(source.passages).toHaveLength(1);
    const entry = review.records.find((entry: { rootId: string }) => entry.rootId === source.rootId).additionalExcerpts[0];
    expect(source.originalText!.slice(entry.start, entry.end)).toBe(source.passages[0].text);
    expect(source.passages[0].startingPoints).toEqual(['A2']);
    expect(source.passages[0].task).toBeUndefined();
  }
  expect(corpusLesson(additional, new Set(), 0, 160, 'A1')).toBeUndefined();
  for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(additional, new Set(), seed, 160, 'A2', [], 'matching')!;
    expect(lessonSchema.safeParse(lesson).success).toBe(true);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      expect('kind' in question && question.kind).toBe('matching');
      if (!('pairs' in question)) throw new Error('MISSING_WORKPLACE_MATCHING');
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => question.choices.find(choice => choice !== pair.answer)!)).correct).toBe(false);
      const text = material.blocks[0].text;
      for (const cited of [question.evidence, ...(question.additionalEvidence ?? [])]) expect(text.slice(cited.start, cited.end)).toMatch(/^(Anna|Anne|Jonathan): /);
    }
  }
});

it('bounds new official source families to their own host, licence and stable root', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const record = corpus.records[0];
  for (const [family, url, licenceUrl] of [
    ['nasa', 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/air-pressure/', 'https://www.nasa.gov/nasa-brand-center/images-and-media/'],
    ['noaa', 'https://oceanservice.noaa.gov/facts/coral.html', 'https://oceanservice.noaa.gov/about/faq.html'],
  ]) {
    const source = { ...record, id: `${family}-1`, rootId: `${family}-article-1`, originalUrl: url, downloadUrl: url, licenceUrl };
    expect(corpusSchema.safeParse({ ...corpus, records: [source] }).success).toBe(true);
    for (const altered of [{ ...source, rootId: `${family}-article-2` }, { ...source, licenceUrl: record.licenceUrl }, { ...source, downloadUrl: record.downloadUrl }, { ...source, originalUrl: url + '?remote=1' }, { ...source, originalUrl: url.replace('.gov', '.gov.evil.example') }]) expect(corpusSchema.safeParse({ ...corpus, records: [altered] }).success).toBe(false);
  }
});

it('keeps the approved USGS page on one root and three media-separated prose scopes', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional.json', 'utf8')));
  const source = corpus.records.find(record => record.id === 'usgs-68924980278435')!;
  expect(source).toBeDefined();
  expect(source.rootId).toBe('usgs-article-68924980278435');
  expect(source.originalText).toBeUndefined();
  expect(source.passages.map(passage => passage.wordCount)).toEqual([231, 156, 304]);
  expect(source.licence).toContain('public domain in the USA; rights outside the USA unverified');
  for (const passage of source.passages) {
    expect(passage.id).toBe(createHash('sha256').update(passage.text).digest('hex'));
    expect(passage.startingPoints).toBeUndefined();
    expect(passage.text).not.toMatch(/Pixabay|Tobias|Thomas Ehrhardt|Viewed from space|A reservoir is a human-made lake/);
  }
  const url = source.originalUrl;
  const changes = [
    { id: 'usgs-1', rootId: 'usgs-article-1' }, { rootId: 'usgs-article-1' },
    { id: 'nasa-68924980278435' }, { rootId: 'noaa-article-68924980278435' },
    { id: 'voa-3431138', originalUrl: 'https://learningenglish.voanews.com/a/lets-learn-english-lesson-26-this-game-is-fun/3431138.html', downloadUrl: 'https://learningenglish.voanews.com/a/lets-learn-english-lesson-26-this-game-is-fun/3431138.html', licenceUrl: 'https://learningenglish.voanews.com/p/6861.html' },
    ...['voa', 'gutenberg', 'wikipedia'].map(family => ({ id: `${family}-3431138`, rootId: `${family}-${family === 'gutenberg' ? 'book' : 'article'}-3431138` })),
    { licenceUrl: 'https://oceanservice.noaa.gov/about/faq.html' }, { downloadUrl: corpus.records[0].downloadUrl },
    ...[url.replace('https:', 'http:'), url.replace('www.usgs.gov', 'www.usgs.gov.evil.example'), url + '?remote=1', url + '#part', url + '/',
      url.replace('water-cycle', 'other'), url.replace('/water-cycle', '/%77ater-cycle')].map(originalUrl => ({ originalUrl, downloadUrl: originalUrl })),
  ];
  for (const change of changes) expect(corpusSchema.safeParse({ version: 1, failures: [], records: [{ ...source, ...change }] }).success).toBe(false);
});
