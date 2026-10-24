import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { exposureSchema } from '../src/shared/exposure';
import fc from 'fast-check';
import { corpusSchema, corpusRestoration, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation, qualificationPrompt } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { spokenCorpusLesson, spokenCorpusSchema, maxInstalledSpokenBanks } from '../src/core/spokenCorpus';
import { lessonSchema, questions, score, practiceLocale } from '../src/shared/content';

// Keep synthetic audio metadata within invariant tests.
function bank() {
  const original = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const hash = 'a'.repeat(64);
  return spokenCorpusSchema.parse({ version: 1, communityPackageId: hash, records: original.records.slice(0, 2).map((record, index) => {
    const { passages, ...source } = record;
    const text = passages[0].text.split(/\s+/).slice(0, 45).join(' ');
    return { ...source, clips: [{ id: String(index + 1).repeat(64), text, wordCount: text.split(/\s+/).length, reviewStatus: 'pending', qualityFlags: [], processing: 'Synthetic metadata for bounds testing only.', audioSourceId: `recording-${index}`,
      credit: { attribution: source.attribution, license: source.licence, sourceUrl: source.originalUrl },
      audio: { src: `/audio/community-${hash}/clip-${index}.mp3`, sha256: 'b'.repeat(64), duration: 20, author: 'Test metadata', sourceUrl: source.originalUrl, license: source.licence, synthetic: false },
      segments: [{ start: 0, end: text.length, text, audioStart: .15, audioEnd: 19.8 }] }] };
  }) });
}

it('supports the expanded installed listening catalogue while bounding application banks and ownership', () => {
  const corpus = bank();
  const peers = Array.from({ length: 104 }, () => ({ ...corpus, records: [] }));
  expect(spokenCorpusLesson(corpus, new Set(), 0, 60, undefined, [], undefined, undefined, peers)).toBeDefined();
  expect(() => spokenCorpusLesson(corpus, new Set(), 0, 60, undefined, [], undefined, undefined,
    Array.from({ length: maxInstalledSpokenBanks + 1 }, () => corpus))).toThrow('INVALID_SPOKEN_APPLICATION');
  expect(() => spokenCorpusLesson(corpus, new Set(), 0, 60, undefined, [], undefined, undefined,
    [{ ...corpus, communityPackageId: undefined }])).toThrow('INVALID_SPOKEN_APPLICATION');
});

it('limits short recorded sentences to the allowlisted FLEURS source family', () => {
  const corpus = bank(), source = corpus.records[0];
  const text = 'The river carries fresh water through the valley.';
  source.clips[0] = { ...source.clips[0], text, wordCount: text.split(/\s+/).length,
    segments: [{ start: 0, end: text.length, text, audioStart: .15, audioEnd: 19.8 }] };
  expect(spokenCorpusSchema.safeParse(corpus).success).toBe(false);
  Object.assign(source, { id: 'fleurs-' + '1'.repeat(64), rootId: 'fleurs-work-' + '2'.repeat(64),
    originalUrl: 'https://en.wikivoyage.org/wiki/Example', downloadUrl: 'https://en.wikivoyage.org/wiki/Example',
    licenceUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use' });
  expect(spokenCorpusSchema.safeParse(corpus).success).toBe(true);
  source.downloadUrl = 'https://example.com/not-the-source';
  expect(spokenCorpusSchema.safeParse(corpus).success).toBe(false);
});

it('bounds generated listening to installed media, distinct roots, exact word evidence and unscored interpretations', () => {
  const corpus = bank();
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = spokenCorpusLesson(corpus, new Set(), seed)!;
    expect(lesson).toEqual(spokenCorpusLesson(corpus, new Set(), seed));
    const taught = lesson.materials[0].questions[0];
    expect(lesson.materials[1].questions[0]).toMatchObject({ kind: 'kind' in taught ? taught.kind : undefined });
    expect(lesson.sourceId).toBe(lesson.materials[0].sourceId);
    expect(lesson.materials.every(material => material.sourceId?.startsWith('voa-'))).toBe(true);
    expect(lesson.skill).toBe('listening'); expect(lesson.reviewStatus).toBe('draft'); expect(lesson.mode).toBeUndefined();
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.every(material => material.audio?.src.startsWith(`/audio/community-${corpus.communityPackageId}/`))).toBe(true);
    for (const { material, question } of questions(lesson)) {
      expect(question.evidence.audioEnd).toBeLessThanOrEqual(material.audio!.duration);
      if ('kind' in question && question.kind === 'completion') {
        expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end)).toContain(question.answer);
        expect(score(question, question.answer).correct).toBe(true);
      } else if ('kind' in question && question.kind === 'sequence') {
        expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
        expect(score(question, question.steps).correct).toBe(false);
      } else expect(score(question, 'Interpretation with supporting words.').correct).toBeNull();
    }
    expect(lesson.teaching!['zh-Hans']).toBe(lesson.teaching!.en);
    const seen = new Set(lesson.materials.map(material => material.id.slice('corpus-'.length)));
    expect(spokenCorpusLesson(corpus, seen, seed)).toBeUndefined();
    const wrongPackage = structuredClone(lesson); wrongPackage.materials[0].audio!.src = `/audio/community-${'c'.repeat(64)}/clip.mp3`;
    expect(lessonSchema.safeParse(wrongPackage).success).toBe(false);
  }), { numRuns: 80 });
  expect(spokenCorpusLesson(corpus, new Set(), 0, 8)).toBeUndefined();
  expect(() => spokenCorpusLesson(corpus, new Set(), -1)).toThrow('INVALID_SPOKEN_GENERATION');
  const broken = structuredClone(corpus); broken.records[0].clips[0].segments[0].text = 'Unmatched words';
  expect(spokenCorpusSchema.safeParse(broken).success).toBe(false);
  const expired = structuredClone(corpus); expired.records[0].clips[0].segments[0].audioEnd = 21;
  expect(spokenCorpusSchema.safeParse(expired).success).toBe(false);
});

it('restores generated listening source credits, media references and generator hashes from a local backup without pretending media was backed up', async () => {
  const { createSession, sessions, communityPacks } = await import('../src/data/db');
  const { exportBackup, inspectBackup, importBackup } = await import('../src/data/backup');
  const lesson = spokenCorpusLesson(bank(), new Set(), 7)!;
  const original = await createSession(lesson);
  const inspected = await inspectBackup(await exportBackup('local-guest'));
  const profile = await importBackup(inspected);
  const restored = await sessions.where('profileId').equals(profile).first();
  expect(restored?.lesson).toEqual(lesson);
  expect(restored?.itemHashes).toEqual(original.itemHashes);
  expect(restored?.ruleHashes).toEqual(original.ruleHashes);
  expect(restored?.lesson.materials.every(material => !!material.credit && !!material.audio)).toBe(true);
  expect(await communityPacks.where('profileId').equals(profile).count()).toBe(0);
});

it('withholds quality-flagged recordings without removing their installed source or media', () => {
  const corpus = bank();
  corpus.records[0].clips[0].qualityFlags = ['ASR timestamp outside recording'];
  expect(spokenCorpusLesson(corpus, new Set(), 0)).toBeUndefined();
  expect(corpus.records).toHaveLength(2);
  expect(corpus.records[0].clips[0].audio.src).toContain('/audio/community-');
  const legacy = structuredClone(corpus); Reflect.deleteProperty(legacy.records[0].clips[0], 'qualityFlags');
  expect(spokenCorpusLesson(spokenCorpusSchema.parse(legacy), new Set(), 0)).toBeUndefined();
  const invalid = structuredClone(corpus); invalid.records[0].clips[0].qualityFlags = [''];
  expect(spokenCorpusSchema.safeParse(invalid).success).toBe(false);
});


it('rejects audio segment boundaries inside a generated answer word before installation', () => {
  const corpus = bank();
  const clip = corpus.records[0].clips[0];
  const word = corpusRestoration(clip.text, 0)!;
  const split = word.evidence.start + 2;
  clip.segments = [
    { start: 0, end: split, text: clip.text.slice(0, split), audioStart: .15, audioEnd: 10 },
    { start: split, end: clip.text.length, text: clip.text.slice(split), audioStart: 10, audioEnd: 19.8 },
  ];
  expect(spokenCorpusSchema.safeParse(corpus).success).toBe(false);
});


it('rejects duplicate spoken source IDs despite distinct roots and clip identities', () => {
  const corpus = bank();
  corpus.records[1].id = corpus.records[0].id;
  expect(spokenCorpusSchema.safeParse(corpus).success).toBe(false);
});

it('keeps multiple recordings of one original work under one bounded root', () => {
 const corpus=bank(),original=corpus.records[0].clips[0];
 corpus.records[0].clips=Array.from({length:100},(_,index)=>({...structuredClone(original),id:index.toString(16).padStart(64,'0')}));
 expect(spokenCorpusSchema.safeParse(corpus).success).toBe(true);
 expect(spokenCorpusLesson({...corpus,records:[corpus.records[0]]},new Set(),0,91,'C2')).toBeUndefined();
 corpus.records[0].clips.push({...structuredClone(original),id:'f'.repeat(64)});
 expect(spokenCorpusSchema.safeParse(corpus).success).toBe(false);
});

it('uses source sentence order when a valid recording contains no restoration word', () => {
  const corpus = bank();
  const text = 'The red bus stops by the old shop each day. We get on and sit near the back. Then we go past the park and the lake and head back to the shop.';
  expect(corpusRestoration(text, 0)).toBeUndefined();
  for (const source of corpus.records) {
    const clip = source.clips[0];
    clip.text = text; clip.wordCount = text.split(/\s+/).length;
    clip.segments = [{ start: 0, end: text.length, text, audioStart: .15, audioEnd: 19.8 }];
  }
  const validated = spokenCorpusSchema.parse(corpus);
  for (let seed = 0; seed < 6; seed++) {
    const lesson = spokenCorpusLesson(validated, new Set(), seed)!;
    expect(lesson.materials).toHaveLength(2);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'sequence') throw new Error('Expected listening sequence');
      expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
      expect(question.evidence.audioStart).toBe(.15);
      expect(question.evidence.audioEnd).toBe(19.8);
    }
  }
  validated.records[0].clips[0].qualityFlags = ['Unresolved transcript mismatch'];
  expect(spokenCorpusLesson(validated, new Set(), 0)).toBeUndefined();
});

it('uses source language tokens for listening completion and rejects corrupted token ranges', () => {
  const corpus = bank();
  for (const source of corpus.records) {
    const clip = source.clips[0], word = /\b[a-z]{3,5}\b/.exec(clip.text)!;
    clip.language = { generator: 'spacy-3.8.16/en_core_web_sm-3.8.0', modelSha256: 'a'.repeat(64), reviewStatus: 'pending',
      tokens: [{ start: word.index, end: word.index + word[0].length, lemma: word[0], pos: 'NOUN' }] };
  }
  const validated = spokenCorpusSchema.parse(corpus);
  const lesson = spokenCorpusLesson(validated, new Set(), 0, 60, undefined, [], 'completion')!;
  const question = lesson.materials[0].questions[0];
  if (!('kind' in question) || question.kind !== 'completion') throw new Error('Expected completion');
  const clip = validated.records.find(source => source.rootId === lesson.materials[0].rootId)!.clips[0];
  const token = clip.language!.tokens[0];
  expect(question.answer).toBe(clip.text.slice(token.start, token.end));
  expect(score(question, question.answer).correct).toBe(true);
  expect(question.evidence.audioStart).toBe(.15);
  corpus.records[0].clips[0].language!.tokens[0].end = corpus.records[0].clips[0].text.length + 1;
  expect(spokenCorpusSchema.safeParse(corpus).success).toBe(false);
});

it('keeps complete sentence context through source line wraps with exact word-level audio evidence', () => {
  for (const wrap of [' ', '\n', '\r\n']) {
    const corpus = bank();
    const sentence = `The expedition carries supplies${wrap}across the frozen bay.`;
    for (const source of corpus.records) {
      const clip = source.clips[0];
      clip.text = `${sentence}\n\nEach worker checks the equipment and follows the marked road before returning to the ship with the remaining wooden boxes and tools.`;
      clip.wordCount = clip.text.split(/\s+/).length;
      const words = [...clip.text.matchAll(/\S+/g)];
      clip.segments = words.map((word, index) => ({ start: word.index, end: word.index + word[0].length,
        text: word[0], audioStart: index * .5, audioEnd: index * .5 + .4 }));
    }
    const lesson = spokenCorpusLesson(spokenCorpusSchema.parse(corpus), new Set(), 0, 60, 'B2', [], 'completion')!;
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'completion') throw new Error('Expected completion');
      const context = question.prompt.slice(question.prompt.indexOf('\n') + 1);
      expect(context.replace('________', question.answer)).toBe(sentence);
      const clip = corpus.records.find(source => source.rootId === material.rootId)!.clips[0];
      const segment = clip.segments.find(part => part.start === question.evidence.start)!;
      expect(question.evidence).toEqual({ start: segment.start, end: segment.end, audioStart: segment.audioStart, audioEnd: segment.audioEnd });
      expect(score(question, question.answer).correct).toBe(true);
      expect(score(question, 'incorrect').correct).toBe(false);
    }
  }
});

it('records the listening starting point and retains playable evidence under beginner support', () => {
  const corpus = bank();
  for (const startingPoint of ['A1','A2','B1','B2','C1','C2'] as const) {
    const lesson = spokenCorpusLesson(corpus, new Set(), 0, 60, startingPoint)!;
    expect(lesson.generation).toMatchObject({ startingPoint });
    expect(practiceLocale(lesson, 'zh-Hans')).toBe(startingPoint === 'A1' || startingPoint === 'A2' ? 'zh-Hans' : 'en');
    expect(lesson.materials.map(material => material.audio)).toEqual(spokenCorpusLesson(corpus, new Set(), 0)!.materials.map(material => material.audio));
    expect(lessonSchema.safeParse(lesson).success).toBe(true);
  }
});

it('explains the generated listening task without revealing its answer, with beginner translations only', () => {
  for (const startingPoint of ['A2', 'B1', 'C2'] as const) for (const kind of ['completion', 'sequence'] as const) {
    const lesson = spokenCorpusLesson(bank(), new Set(), 0, 60, startingPoint, [], kind)!;
    expect(lesson.materials[0].questions[0]).toMatchObject({ kind });
    expect(lesson.teaching!.en).toContain(kind === 'sequence' ? 'three sentences' : 'gap');
    expect(lesson.teaching!.en).not.toContain(kind === 'sequence' ? 'gap' : 'three sentences');
    if (kind === 'sequence') {
      expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      const example = lesson.workedExample!.en, sentences = ['Mina opens a window.', 'She looks at the garden.', 'She closes the window.'];
      for (const sentence of sentences) { expect(example).toContain(sentence); expect(example.split(sentence)).toHaveLength(2); }
      expect(example.indexOf(sentences[0])).toBeLessThan(example.indexOf(sentences[1]));
      expect(example.indexOf(sentences[1])).toBeLessThan(example.indexOf(sentences[2]));
      expect(lesson.workedExample!.en).not.toContain('…');
    } else {
      const sourceExample = corpusWorkedExample(lesson.materials[0], 0, startingPoint, true);
      if (sourceExample) expect(lesson.workedExample).toEqual(sourceExample);
      else {
        expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
        expect(lesson.workedExample!.en).toContain('Nora puts the blue cup on the shelf.');
        expect(lesson.workedExample!.en).toContain('Nora puts the ________ cup on the shelf.');
        expect(lesson.workedExample!.en).toContain('Answer: “blue”');
        expect(lesson.workedExample!.en).not.toContain('…');
      }
    }
    if (startingPoint === 'A2') {
      expect(lesson.teaching!['zh-Hans']).toContain(kind === 'sequence' ? '顺序' : '拼写');
      expect(lesson.teaching!['zh-Hant']).toContain(kind === 'sequence' ? '順序' : '拼寫');
      expect(lesson.nextStep!['zh-Hans']).toContain('录音');
    } else expect(lesson.teaching!['zh-Hans']).toBe(lesson.teaching!.en);
  }
});


it('keeps listening preference below source, audio quality and exposure guards', () => {
  const corpus = bank();
  corpus.records[1].title = 'Physics experiment';
  expect(spokenCorpusLesson(corpus, new Set(), 0, 60, 'B1', ['science'])!.materials[0].rootId).toBe(corpus.records[1].rootId);
  corpus.records[1].clips[0].qualityFlags = ['Unresolved audio defect'];
  expect(spokenCorpusLesson(corpus, new Set(), 0, 60, 'B1', ['science'])).toBeUndefined();
  corpus.records[1].clips[0].qualityFlags = [];
  expect(spokenCorpusLesson(corpus, new Set([corpus.records[1].clips[0].id]), 0, 60, 'B1', ['science'])).toBeUndefined();
  corpus.records[1].clips[0].audio.duration = 61;
  expect(spokenCorpusLesson(corpus, new Set(), 0, 60, 'B1', ['science'])).toBeUndefined();
});


it('generates the requested listening task within eligible clips and records the request', () => {
  for (const kind of ['completion', 'sequence'] as const) for (let seed = 0; seed < 20; seed++) {
    const lesson = spokenCorpusLesson(bank(), new Set(), seed, 60, 'B1', [], kind)!;
    expect(lesson.generation).toMatchObject({ focus: kind });
    expect(lesson.materials.every(material => 'kind' in material.questions[0] && material.questions[0].kind === kind)).toBe(true);
  }
  expect(spokenCorpusLesson(bank(), new Set(), 0, 60, 'B1', [], 'matching')).toBeDefined();
});


it('generates exact semantic listening evidence with a different-root same-operation application from current recordings', async () => {
  const corpus = (await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-001'))).spoken!;
  const operation = `evidence:${qualificationPrompt}`;
  for (let seed = 0; seed < 12; seed++) {
    const lesson = spokenCorpusLesson(corpus, new Set(), seed, 35, 'B2', [], 'evidence', operation)!;
    for (const { material, question } of questions(lesson)) expect(exposureSchema.safeParse({ profileId: 'test-profile', rootId: material.rootId, firstSeenAt: '2026-10-03T00:00:00.000Z', lastSeenAt: '2026-10-03T00:00:00.000Z', contacts: [{ sessionId: 'test-session', materialId: material.id, questionId: question.id, variantGroup: question.id, firstSeenAt: '2026-10-03T00:00:00.000Z', lastSeenAt: '2026-10-03T00:00:00.000Z' }] }).success).toBe(true);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected semantic listening evidence');
      expect(`evidence:${question.prompt}`).toBe(operation);
      expect(score(question, question.accepted[0]).correct).toBe(true);
      expect(score(question, (question.accepted[0] + 1) % question.spans.length).correct).toBe(false);
      const clip = corpus.records.find(record => record.rootId === material.rootId)!.clips.find(clip => material.id === `corpus-${clip.id}`)!;
      for (const span of [...question.spans, question.evidence]) {
        if ('text' in span) expect(clip.text.slice(span.start, span.end)).toBe(span.text);
        const segments = clip.segments.filter(segment => segment.end > span.start && segment.start < span.end);
        expect(span.audioStart).toBe(segments[0].audioStart);
        expect(span.audioEnd).toBe(segments.at(-1)!.audioEnd);
      }
    }
    const seen = new Set(lesson.materials.map(material => material.id.slice('corpus-'.length)));
    expect(spokenCorpusLesson(corpus, seen, seed, 35, 'B2', [], 'evidence', operation)?.materials.some(material => seen.has(material.id.slice('corpus-'.length)))).not.toBe(true);
  }
  const beginner = spokenCorpusLesson(corpus, new Set(), 2, 35, 'A2', [], 'evidence')!;
  expect(beginner.materials.every(material => !('kind' in material.questions[0]) || material.questions[0].kind !== 'evidence')).toBe(true);
});

it('follows actual qualified and attributed recordings with contextual unscored interpretation, not a generic summary', async () => {
  const corpus = (await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-001'))).spoken!;
  const qualification = `evidence:${qualificationPrompt}`;
  const attribution = 'evidence:Which sentence explicitly attributes a claim to a named source?';
  const inspected = new Set<string>();
  for (const operation of [qualification, attribution]) for (const point of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = spokenCorpusLesson(corpus, new Set(), seed, 60, point, [], 'evidence', operation)!;
    expect(corpusOperation(lesson.materials[0].questions[0])).toBe(operation);
    expect(lesson.goal.en).toBe(lesson.goal['zh-Hans']);
    expect(lesson.teaching!.en).toBe(lesson.teaching!['zh-Hant']);
    for (const material of lesson.materials) {
      const evidence = material.questions[0], response = material.questions[1];
      if (corpusOperation(evidence) !== operation) continue;
      inspected.add(material.id.slice('corpus-'.length));
      if (!('kind' in response) || response.kind !== 'response') throw new Error('Expected unscored interpretation');
      expect(response.prompt).not.toContain('Summarize');
      expect(response.criteria).toHaveLength(3); expect(response.hints).toHaveLength(3);
      expect(score(response, 'A quoted interpretation preserving uncertainty and source.').correct).toBeNull();
      expect(response.evidence.audioStart).toBeGreaterThanOrEqual(0);
      expect(response.evidence.audioEnd).toBeLessThanOrEqual(material.audio!.duration);
      expect(material.blocks[0].text.slice(response.evidence.start, response.evidence.end)).toBe(material.blocks[0].text);
      expect(response.criteria.every(criterion => criterion.en === criterion['zh-Hans'] && criterion.en === criterion['zh-Hant'])).toBe(true);
      if (operation === qualification) {
        expect(response.prompt).toContain('inference, possibility or belief');
        expect(response.criteria.some(criterion => criterion.en.includes('reported past belief'))).toBe(true);
        expect(response.explanation.en).toContain('possible cause');
      } else {
        expect(response.prompt).toContain('time or numerical limits');
        expect(response.criteria.some(criterion => criterion.en.includes('narrator’s opinion'))).toBe(true);
        expect(response.explanation.en).toContain('does not establish truth');
      }
    }
    if (operation === attribution) {
      // Preserve fallback when only one source supports an operation; claim no transfer.
      expect(corpusOperation(lesson.materials[1].questions[0])).not.toBe(operation);
    }
  }
  expect(inspected.size).toBe(4);
  for (const point of ['A1', 'A2'] as const) {
    const beginner = spokenCorpusLesson(corpus, new Set(), 2, 60, point)!;
    for (const material of beginner.materials) expect(material.questions[1].prompt).toBe('Write one short sentence about what you heard. Use a few words from the recording.');
  }
});

it('prefers a recording supporting the default operation without inventing a same-operation fallback', () => {
  const corpus = bank();
  const texts = ['The visitors entered the museum through the main entrance during the morning.', 'The museum opened its doors in June. Visitors entered through the main gate. The guide described the collection inside.'];
  corpus.records.forEach((record, index) => { const clip = record.clips[0]; clip.text = texts[index]; clip.wordCount = clip.text.split(/\s+/).length; clip.segments = [{ ...clip.segments[0], text: clip.text, start: 0, end: clip.text.length }]; });
  for (const point of ['A2', 'B1', 'C2'] as const) {
    const lesson = spokenCorpusLesson(corpus, new Set(), 0, 20, point)!;
    expect(corpusOperation(lesson.materials[0].questions[0])).toBe('sequence');
    expect(lesson.materials[0].rootId).toBe(corpus.records[1].rootId);
    expect(corpusOperation(lesson.materials[1].questions[0])).toBe('completion');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.communityPackageId).toBe(corpus.communityPackageId);
    const explicit = spokenCorpusLesson(corpus, new Set(), 2, 20, point, [], 'completion')!;
    expect(explicit.materials.every(material => corpusOperation(material.questions[0]) === 'completion')).toBe(true);
  }
  const held = structuredClone(corpus); held.records[1].clips[0].qualityFlags = ['test-hold'];
  expect(spokenCorpusLesson(held, new Set(), 2, 20, 'B1')).toBeUndefined();
  const long = structuredClone(corpus); long.records[1].clips[0].audio.duration = 21;
  expect(spokenCorpusLesson(long, new Set(), 2, 20, 'B1')).toBeUndefined();
});
