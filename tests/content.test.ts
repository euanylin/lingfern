import { describe, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import rawC2 from './fixtures/content/c2-reading.json';
import rawC2Listening from './fixtures/content/c2-listening.json';
import rawA2 from './fixtures/content/a2-reading.json';
import rawCheck from './fixtures/content/a1-check-reading.json';
import rawCheckTrip from './fixtures/content/a1-check-reading-trip.json';
import rawA2Listening from './fixtures/content/a2-listening.json';
import rawB1 from './fixtures/content/b1-reading.json';
import rawB1Listening from './fixtures/content/b1-listening.json';
import rawB2 from './fixtures/content/b2-reading.json';
import rawB2Listening from './fixtures/content/b2-listening.json';
import rawC1 from './fixtures/content/c1-reading.json';
import rawC1Listening from './fixtures/content/c1-listening.json';
import sources from '../content/sources.json';
import publicAudioSources from '../content/audio-sources.json';
import fixtureAudioSources from './fixtures/audio-sources.json';
const allAudioSources = [...publicAudioSources, ...fixtureAudioSources];
const audioFile = (src: string) => (fixtureAudioSources.some(source => source.path === src) ? 'tests/fixtures/public' : 'public') + src;

it('keeps bundled short recording paths unique for exact source lookup', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  type Source = { audio: { src: string } };
  const paths = ['a2-speech', 'b1-speech'].flatMap(directory => readdirSync(`public/audio/${directory}`).filter(file => file.endsWith('.json')).flatMap(file => {
    const source = JSON.parse(readFileSync(`public/audio/${directory}/${file}`, 'utf8')) as Source[] | { need: Source[]; preference: Source[] };
    return (Array.isArray(source) ? source : [...source.need, ...source.preference]).map(item => item.audio.src);
  }));
  expect(paths.length).toBeGreaterThan(0);
  expect(new Set(paths).size).toBe(paths.length);
});

it('ships one fern source and no handwritten wordmarks or personal artwork', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  for (const directory of ['logo', 'Signature', 'public/logo']) expect(existsSync(directory)).toBe(false);
  expect(existsSync('docs/brand-assets.md')).toBe(true);
  const symbol = readFileSync('public/icon.svg', 'utf8');
  expect(symbol).toContain('viewBox="0.000000 0.000000 256.000000 256.000000"');
  expect(symbol).not.toMatch(/handwritten|wordmark|signature/i);
  for (const file of ['public/icon-192.png', 'public/icon-512.png']) expect(existsSync(file)).toBe(true);
});

it('allows hints to be withdrawn on a distinct application while retaining primary teaching and Test restrictions', () => {
  const faded = structuredClone(raw);
  for (const question of faded.materials[1].questions) delete (question as { hints?: unknown }).hints;
  expect(lessonSchema.safeParse(faded).success).toBe(true);
  const missingPrimary = structuredClone(faded);
  delete (missingPrimary.materials[0].questions[0] as { hints?: unknown }).hints;
  expect(lessonSchema.safeParse(missingPrimary).success).toBe(false);
  const badHints = structuredClone(faded);
  badHints.materials[1].questions[0].hints = raw.materials[0].questions[0].hints.slice(0, 2);
  expect(lessonSchema.safeParse(badHints).success).toBe(false);
  expect(lessonSchema.safeParse({ ...faded, mode: 'test', teaching: undefined, workedExample: undefined, nextStep: undefined }).success).toBe(false);
});

it('normal public assets and every downloadable ZIP exclude fictional test recordings', async () => {
  const { existsSync, readFileSync, readdirSync } = await import('node:fs');
  const { unzipSync } = await import('fflate');
  const { default: resources } = await import('../content/offline-resources.json');
  const { default: packs } = await import('../content/resource-packs.json');
  const { default: retained } = await import('../content/retained-resource-packs.json');
  const { createHash } = await import('node:crypto');
  const downloadable = [...packs.packs, ...retained.packs];
  expect(fixtureAudioSources).toHaveLength(10);
  const normalLessons = (await Promise.all(['voa-a1', 'voa-a2', 'voa-b1', 'voa-b2', 'archival-c1', 'voa-c1', 'archival-c2', 'eisenhower-c2'].map(async name => JSON.parse(readFileSync(`tests/fixtures/retired-content/${name}.json`, 'utf8')) as unknown[]))).flat().map(raw => lessonSchema.parse(raw));
  for (const material of normalLessons.flatMap(lesson => lesson.materials)) if (material.audio) {
    const credit = publicAudioSources.find(source => source.path === material.audio!.src);
    expect(credit?.sha256).toBe(material.audio.sha256);
    expect(credit?.source).toBe(material.audio.sourceUrl);
    expect(credit?.license).toBe(material.audio.license);
  }
  const excluded = new Set(fixtureAudioSources.map(source => source.path));
  for (const path of excluded) expect(existsSync('public' + path)).toBe(false);
  expect(publicAudioSources.every(source => !excluded.has(source.path))).toBe(true);
  expect(resources.groups.flatMap(group => group.files).every(file => !excluded.has(file.path))).toBe(true);
  expect(readdirSync('public/packs').filter(name => name.endsWith('.zip')).sort()).toEqual(downloadable.map(pack => pack.path.split('/').at(-1)!).sort());
  for (const pack of downloadable) {
    const bytes = readFileSync('public' + pack.path);
    expect(bytes.length).toBe(pack.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(pack.sha256);
    const files = unzipSync(bytes);
    expect(Object.keys(files).every(path => !excluded.has('/' + path))).toBe(true);
  }
});
import { lessonSchema, questions, score, validateAnswer, answerText, practiceLocale } from '../src/shared/content';
import rawMatching from './fixtures/content/a1-matching-reading.json';
import archivalC1 from './fixtures/retired-content/archival-c1.json';
import archivalC2 from './fixtures/retired-content/archival-c2.json';

it('historical C1 drafts preserve exact evidence, bounded recordings and unscored interpretation', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  for (const raw of archivalC1) {
    const lesson = lessonSchema.parse(raw);
    expect(lesson.reviewStatus).toBe('draft');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(questions(lesson)).toHaveLength(4);
    expect(practiceLocale(lesson, 'zh-Hant')).toBe('en');
    for (const material of lesson.materials) {
      expect(sources.some(source => source.id === material.sourceId && !source.approved)).toBe(true);
      if (lesson.skill === 'reading') expect(material.blocks[0].text.split(/\s+/).length).toBeGreaterThanOrEqual(lesson.targetLevel === 'C2' ? 700 : 500);
      if (material.audio) {
        expect(material.audio.synthetic).toBe(false);
        expect(material.audio.duration).toBeGreaterThanOrEqual(lesson.targetLevel === 'C2' ? 180 : 120);
        expect(material.audio.duration).toBeLessThanOrEqual(lesson.targetLevel === 'C2' ? 480 : 360);
        expect(createHash('sha256').update(readFileSync('public' + material.audio.src)).digest('hex')).toBe(material.audio.sha256);
      }
    }
    const entries = questions(lesson);
    expect(entries[0].material.blocks[0].text.slice(entries[0].question.evidence.start, entries[0].question.evidence.end)).toContain('depends on man');
    expect(entries[2].material.blocks[0].text.slice(entries[2].question.evidence.start, entries[2].question.evidence.end)).toBe('Let us never negotiate out of fear. But let us never fear to negotiate.');
    for (const { question } of entries) {
      if ('options' in question) for (let answer = 0; answer < question.options.length; answer++) expect(score(question, answer).correct).toBe(answer === question.answer);
      else if ('criteria' in question) {
        expect(score(question, 'The final call to begin does not promise early completion.').correct).toBeNull();
        expect(question.criteria).toHaveLength(2);
      } else throw new Error('Expected choice or open response');
    }
  }
  const listening = lessonSchema.parse(archivalC1[1]);
  for (const altered of [
    { ...listening.materials[0].audio!, sourceUrl: 'https://www.jfklibrary.org/asset-viewer/archives/jfkwha-999' },
    { ...listening.materials[0].audio!, license: 'All government audio is free' },
  ]) {
    const copy = structuredClone(listening); copy.materials[0].audio = altered;
    expect(lessonSchema.safeParse(copy).success).toBe(false);
  }
});

it('C2 historical commitments retain conditions, tentative proposals and English self-assessment', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  for (const raw of archivalC2) {
    const lesson = lessonSchema.parse(raw);
    expect(lesson.targetLevel).toBe('C2');
    expect(lesson.reviewStatus).toBe('draft');
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      expect(archivalC1[0].materials.some(old => old.rootId === material.rootId)).toBe(false);
      expect(sources.some(source => source.id === material.sourceId && !source.approved)).toBe(true);
      if (lesson.skill === 'reading') expect(material.blocks[0].text.split(/\s+/).length).toBeGreaterThanOrEqual(700);
      if (material.audio) {
        expect(material.audio.synthetic).toBe(false);
        expect(material.audio.duration).toBeGreaterThanOrEqual(180);
        expect(material.audio.duration).toBeLessThanOrEqual(480);
        expect(createHash('sha256').update(readFileSync('public' + material.audio.src)).digest('hex')).toBe(material.audio.sha256);
      }
    }
    const entries = questions(lesson);
    expect(entries[0].material.blocks[0].text.slice(entries[0].question.evidence.start, entries[0].question.evidence.end)).toContain('so long as other states do not do so');
    expect(entries[2].material.blocks[0].text.slice(entries[2].question.evidence.start, entries[2].question.evidence.end)).toBe('I include among these possibilities a joint expedition to the moon.');
    expect(entries[2].question.additionalEvidence).toHaveLength(1);
    for (const { question } of entries) {
      if ('options' in question) for (let answer = 0; answer < question.options.length; answer++) expect(score(question, answer).correct).toBe(answer === question.answer);
      else if ('criteria' in question) {
        expect(score(question, 'The contest continues, but its proposed form changes.').correct).toBeNull();
        expect(question.criteria.every(criterion => criterion.en === criterion['zh-Hans'] && criterion.en === criterion['zh-Hant'])).toBe(true);
      } else throw new Error('Expected choice or open interpretation');
    }
  }
});

it('validates and scores all matching rows without rejecting reusable choices', () => {
  const lesson = lessonSchema.parse(rawMatching);
  expect(questions(lesson)).toHaveLength(4);
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
  for (const { question } of questions(lesson)) {
    if (!('pairs' in question)) throw new Error('Expected matching');
    const answers = question.pairs.map(pair => pair.answer);
    expect(score(question, answers)).toEqual({ correct: true, rule: 'matching-authored-pairs-v1' });
    expect(score(question, [...answers].reverse()).correct).toBe(false);
    expect(score(question, answers.map(() => answers[0])).correct).toBe(false);
    expect(() => validateAnswer(question, [answers[0], ''], true)).not.toThrow();
    for (const invalid of [[answers[0]], [answers[0], ''], [answers[0], 'unknown'], answers[0], 0]) expect(() => score(question, invalid)).toThrow('INVALID_ANSWER');
    expect(answerText(question, answers)).toContain(`${question.pairs[0].label}: ${answers[0]}`);
  }
  for (const mutate of [
    (q: typeof rawMatching.materials[0]['questions'][0]) => { q.choices[1] = q.choices[0].toUpperCase(); },
    (q: typeof rawMatching.materials[0]['questions'][0]) => { q.pairs[1].label = q.pairs[0].label; },
    (q: typeof rawMatching.materials[0]['questions'][0]) => { q.pairs[0].answer = 'unknown'; },
  ]) {
    const copy = structuredClone(rawMatching); mutate(copy.materials[0].questions[0]);
    expect(lessonSchema.safeParse(copy).success).toBe(false);
  }
});

describe('development content', () => {
  it('has distinct roots, valid evidence, three hints, three languages and honest source state', () => {
    const lesson = lessonSchema.parse(raw);
    expect(questions(lesson)).toHaveLength(4);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(lesson.reviewStatus).toBe('draft');
    for (const { question } of questions(lesson)) {
      if (!('options' in question)) throw new Error('Expected choice question');
      expect(score(question, question.answer).correct).toBe(true);
      expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
      expect(() => score(question, -1)).toThrow();
    }
  });
  it('rejects leaked identities, out-of-range evidence and invalid answers', () => {
    const copy = structuredClone(raw);
    copy.materials[1].rootId = copy.materials[0].rootId;
    expect(lessonSchema.safeParse(copy).success).toBe(false);
    const bad = structuredClone(raw);
    bad.materials[0].questions[0].evidence.end = 100000;
    expect(lessonSchema.safeParse(bad).success).toBe(false);
  });
});

describe('independent-check draft', () => {
  it('uses a separate root and never carries teaching or hints', () => {
    const lesson = lessonSchema.parse(rawCheck);
    expect(lesson.mode).toBe('check');
    expect(lesson.reviewStatus).toBe('draft');
    expect(lesson.expectedMinutes).toBe(4);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(lesson.materials[0].rootId).not.toBe(raw.materials[0].rootId);
    expect(questions(lesson)).toHaveLength(4);
    for (const { material, question } of questions(lesson)) {
      expect(question.hints).toBeUndefined();
      expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end).length).toBeGreaterThan(0);
      if (!('options' in question)) throw new Error('Expected choice question');
      expect(score(question, question.answer).correct).toBe(true);
    }
    expect(lessonSchema.safeParse({ ...rawCheck, teaching: raw.teaching }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...rawCheck, expectedMinutes: undefined }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...rawCheck, materials: [rawCheck.materials[0], rawCheck.materials[0]] }).success).toBe(false);
    const missingHint = structuredClone(raw);
    delete (missingHint.materials[0].questions[0] as { hints?: unknown }).hints;
    expect(lessonSchema.safeParse(missingHint).success).toBe(false);
    expect(lessonSchema.parse(raw)).toEqual(raw);
  });
  it('keeps the second A1 check on a different root with four evidence-backed responses', () => {
    const first = lessonSchema.parse(rawCheck);
    const second = lessonSchema.parse(rawCheckTrip);
    expect(second.reviewStatus).toBe('draft');
    expect(sources.some(source => source.id === second.sourceId && !source.approved)).toBe(true);
    expect(new Set([...raw.materials.map(material => material.rootId), first.materials[0].rootId, second.materials[0].rootId]).size).toBe(raw.materials.length + 2);
    expect(questions(second)).toHaveLength(4);
    expect(questions(second).map(({ material, question }) => material.blocks[0].text.slice(question.evidence.start, question.evidence.end))).toEqual(['school gate', 'at nine', 'your lunch', 'red sign']);
    for (const { material, question } of questions(second)) {
      expect(question.hints).toBeUndefined();
      expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end).length).toBeGreaterThan(0);
      if (!('options' in question)) throw new Error('Expected choice question');
      expect(score(question, question.answer).correct).toBe(true);
    }
  });
});

describe('listening assets', () => {
  it('matches audio files, source checksums and evidence spans without remote playback URLs', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const { default: rawListening } = await import('./fixtures/content/a1-listening.json');
    const { default: audioSources } = await import('../content/audio-sources.json');
    const lesson = lessonSchema.parse(rawListening);
    expect(questions(lesson)).toHaveLength(4);
    for (const material of lesson.materials) {
      const audio = material.audio!;
      const source = audioSources.find(s => s.path === audio.src)!;
      expect(createHash('sha256').update(readFileSync(audioFile(audio.src))).digest('hex')).toBe(audio.sha256);
      expect(createHash('sha1').update(readFileSync('public/audio/a1-words/' + source.title)).digest('hex')).toBe(source.originalSha1);
      expect(material.blocks[0].text).toBe(source.transcript);
      expect(audio.license).toBe('CC-BY-SA-3.0');
      expect(audio.duration).toBe(source.duration);
    }
    const bad = structuredClone(rawListening);
    bad.materials[0].audio.src = 'https://example.com/audio.mp3';
    expect(lessonSchema.safeParse(bad).success).toBe(false);
    bad.materials[0].audio.src = rawListening.materials[0].audio.src;
    bad.materials[0].questions[0].evidence.audioEnd = 100;
    expect(lessonSchema.safeParse(bad).success).toBe(false);
  });
});

describe('C2 source comparison draft', () => {
  it('keeps two distinct source pairs and valid cross-source evidence', () => {
    const lesson = lessonSchema.parse(rawC2);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(lesson.materials.map(material => material.rootId)).toHaveLength(2);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      expect(material.blocks).toHaveLength(2);
      expect(material.questions[0].additionalEvidence?.[0].blockId).toBe(material.blocks[1].id);
      const question = material.questions[0];
      if (!('options' in question)) throw new Error('Expected choice question');
      expect(score(question, question.answer).correct).toBe(true);
    }
    const bad = structuredClone(rawC2);
    bad.materials[0].questions[0].additionalEvidence![0].end = 100000;
    expect(lessonSchema.safeParse(bad).success).toBe(false);
  });
});

describe('A2 information table draft', () => {
  it('requires complete authored cells and cites both the usual rule and its exception', () => {
    const lesson = lessonSchema.parse(rawA2);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if (!('rows' in question)) throw new Error('Expected table question');
      expect(score(question, question.rows.map(row => row.answer))).toMatchObject({ correct: true, rule: 'table-authored-variants-v1' });
      expect(score(question, question.rows.map(row => row.accepted[1])).correct).toBe(true);
      expect(score(question, [...question.rows.map(row => row.answer)].reverse()).correct).toBe(false);
      expect(score(question, ['11.00', question.rows[1].answer]).correct).toBe(false);
      expect(() => score(question, [question.rows[0].answer, ''])).toThrow('INVALID_ANSWER');
      expect(question.additionalEvidence).toHaveLength(1);
    }
    const bad = structuredClone(rawA2);
    const first = bad.materials[0].questions[0];
    if (!('rows' in first) || !first.rows) throw new Error('Expected table question');
    first.rows[0].accepted = ['12:00'];
    expect(lessonSchema.safeParse(bad).success).toBe(false);
  });
});

describe('A2 evidence-location draft', () => {
  it('accepts two complete source spans and rejects a mismatched quotation', () => {
    const lesson = lessonSchema.parse(rawA2);
    const material = lesson.materials[0];
    const question = material.questions[1];
    if (!('spans' in question)) throw new Error('Expected evidence-location question');
    expect(question.accepted).toEqual([1, 3]);
    for (const span of question.spans) expect(material.blocks[0].text.slice(span.start, span.end)).toBe(span.text);
    for (const index of [1, 3]) expect(score(question, index)).toMatchObject({ correct: true, rule: 'evidence-authored-ranges-v1' });
    for (const index of [0, 2]) expect(score(question, index).correct).toBe(false);
    expect(() => score(question, 4)).toThrow('INVALID_ANSWER');
    const bad = structuredClone(rawA2);
    const invalid = bad.materials[0].questions[1];
    if (!('spans' in invalid) || !invalid.spans) throw new Error('Expected source spans');
    invalid.spans[1].text = 'This text does not match the cited range.';
    expect(lessonSchema.safeParse(bad).success).toBe(false);
  });
});

describe('A2 ordering draft', () => {
  it('accepts two evidence-supported orders and rejects malformed or repeated steps', () => {
    const lesson = lessonSchema.parse(rawA2);
    const question = lesson.materials[1].questions[1];
    if (!('steps' in question)) throw new Error('Expected sequence question');
    expect(question.acceptedOrders).toHaveLength(2);
    for (const order of question.acceptedOrders) expect(score(question, order)).toMatchObject({ correct: true, rule: 'sequence-authored-orders-v1' });
    expect(score(question, question.steps).correct).toBe(false);
    expect(() => score(question, [question.steps[0], question.steps[0], question.steps[1]])).toThrow('INVALID_ANSWER');
    expect(() => score(question, question.steps.slice(0, 2))).toThrow('INVALID_ANSWER');
    const bad = structuredClone(rawA2);
    const invalid = bad.materials[1].questions[1];
    if (!('acceptedOrders' in invalid) || !invalid.acceptedOrders) throw new Error('Expected authored orders');
    invalid.acceptedOrders[0][0] = 'A step absent from the material';
    expect(lessonSchema.safeParse(bad).success).toBe(false);
  });
});

describe('C2 synthetic listening draft', () => {
  it('uses two distinct complete local recordings with timed evidence and declared provenance', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const lesson = lessonSchema.parse(rawC2Listening);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const audio = material.audio!;
      const source = allAudioSources.find(item => item.path === audio.src)!;
      expect(audio.synthetic).toBe(true);
      expect(source.sha256).toBe(audio.sha256);
      expect(createHash('sha256').update(readFileSync(audioFile(audio.src))).digest('hex')).toBe(audio.sha256);
      expect(material.questions[0].additionalEvidence?.[0].blockId).toBe(material.blocks[1].id);
    }
  });
});

describe('A2 short-notice listening draft', () => {
  it('has two local recordings, distinct roots, timed evidence and scorable responses', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const audioSources = allAudioSources;
    const lesson = lessonSchema.parse(rawA2Listening);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const audio = material.audio!;
      expect(audio.synthetic).toBe(true);
      expect(audioSources.find(source => source.path === audio.src)?.sha256).toBe(audio.sha256);
      expect(createHash('sha256').update(readFileSync(audioFile(audio.src))).digest('hex')).toBe(audio.sha256);
      for (const question of material.questions) {
        if ('kind' in question && question.kind === 'completion') {
          expect(score(question, question.answer).correct).toBe(true);
          expect(score(question, '  room 12! ').correct).toBe(true);
          expect(score(question, 'Room Six').correct).toBe(false);
          expect(() => score(question, '')).toThrow('INVALID_ANSWER');
        } else if ('options' in question) {
          expect(score(question, question.answer).correct).toBe(true);
          expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
        } else throw new Error('Unexpected A2 listening question');
        expect(question.evidence.audioEnd).toBeLessThanOrEqual(audio.duration);
      }
    }
  });
  it('rejects duplicate completion variants and an answer absent from the cited audio transcript', () => {
    const duplicate = structuredClone(rawA2Listening);
    const question = duplicate.materials[0].questions[0];
    if (!('accepted' in question) || !question.accepted) throw new Error('Expected completion question');
    question.accepted.push('room twelve!');
    expect(lessonSchema.safeParse(duplicate).success).toBe(false);
    const unsourced = structuredClone(rawA2Listening);
    const other = unsourced.materials[0].questions[0];
    if (!('answer' in other)) throw new Error('Expected completion answer');
    other.answer = 'Room Nine';
    expect(lessonSchema.safeParse(unsourced).success).toBe(false);
  });
});

describe('B1 connected reading draft', () => {
  it('uses connected text with distinct roots, cause/condition evidence and scored choices', () => {
    const lesson = lessonSchema.parse(rawB1);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      expect(material.blocks[0].text.split(/\s+/).length).toBeGreaterThanOrEqual(150);
      for (const question of material.questions) {
        if (!('options' in question)) throw new Error('Expected choice question');
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
        expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end).length).toBeGreaterThan(20);
      }
    }
  });
});

describe('B1 conditional listening draft', () => {
  it('keeps two local 45-second-plus recordings, timed evidence and distinct source roots', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const audioSources = allAudioSources;
    const lesson = lessonSchema.parse(rawB1Listening);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const audio = material.audio!;
      expect(audio.synthetic).toBe(true);
      expect(audio.duration).toBeGreaterThanOrEqual(45);
      expect(audioSources.find(source => source.path === audio.src)?.sha256).toBe(audio.sha256);
      expect(createHash('sha256').update(readFileSync(audioFile(audio.src))).digest('hex')).toBe(audio.sha256);
      for (const question of material.questions) {
        if (!('options' in question)) throw new Error('Expected choice question');
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
        const text = material.blocks[0].text;
        expect(text.slice(question.evidence.start, question.evidence.end).length).toBeGreaterThan(20);
        expect(question.evidence.audioEnd).toBeLessThanOrEqual(audio.duration);
      }
    }
  });
});

describe('B2 survey scope reading draft', () => {
  it('compares respondents with unsupported broader and causal claims across two cases', () => {
    const lesson = lessonSchema.parse(rawB2);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      expect(material.blocks).toHaveLength(2);
      expect(material.blocks.reduce((count, block) => count + block.text.split(/\s+/).length, 0)).toBeGreaterThanOrEqual(300);
      for (const question of material.questions) {
        if (!('options' in question)) throw new Error('Expected choice question');
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
        expect(question.additionalEvidence).toHaveLength(1);
      }
    }
  });
});

describe('B2 survey discussion listening draft', () => {
  it('has two local discussions with timed claim and revision evidence', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const audioSources = allAudioSources;
    const lesson = lessonSchema.parse(rawB2Listening);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const audio = material.audio!;
      expect(audio.synthetic).toBe(true);
      expect(audio.duration).toBeGreaterThanOrEqual(90);
      expect(audio.duration).toBeLessThanOrEqual(240);
      expect(audioSources.find(source => source.path === audio.src)?.sha256).toBe(audio.sha256);
      expect(createHash('sha256').update(readFileSync(audioFile(audio.src))).digest('hex')).toBe(audio.sha256);
      expect(material.blocks).toHaveLength(3);
      expect(material.blocks.reduce((count, block) => count + block.text.split(/\s+/).length, 0)).toBeGreaterThanOrEqual(300);
      for (const question of material.questions) {
        if (!('options' in question)) throw new Error('Expected choice question');
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
        for (const span of [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])]) {
          const block = material.blocks.find(block => block.id === span.blockId)!;
          expect(block.text.slice(span.start, span.end).length).toBeGreaterThan(20);
          expect(span.audioEnd).toBeLessThanOrEqual(audio.duration);
        }
      }
    }
  });
});

describe('C1 approval and indirect-intention drafts', () => {
  it('uses two complete email exchanges with dispersed commitment evidence', () => {
    const lesson = lessonSchema.parse(rawC1);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      expect(material.blocks).toHaveLength(3);
      const words = material.blocks.reduce((count, block) => count + block.text.split(/\s+/).length, 0);
      expect(words).toBeGreaterThanOrEqual(500);
      for (const question of material.questions) {
        if (!('options' in question)) throw new Error('Expected choice question');
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
        expect(question.additionalEvidence).toHaveLength(1);
      }
    }
  });
  it('uses two playable local discussions with timed indirect-intention evidence', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const audioSources = allAudioSources;
    const lesson = lessonSchema.parse(rawC1Listening);
    expect(sources.some(source => source.id === lesson.sourceId && !source.approved)).toBe(true);
    expect(questions(lesson)).toHaveLength(4);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const audio = material.audio!;
      expect(audio.synthetic).toBe(true);
      expect(audio.duration).toBeGreaterThanOrEqual(120);
      expect(audio.duration).toBeLessThanOrEqual(360);
      expect(audioSources.find(source => source.path === audio.src)?.sha256).toBe(audio.sha256);
      expect(createHash('sha256').update(readFileSync(audioFile(audio.src))).digest('hex')).toBe(audio.sha256);
      for (const question of material.questions) {
        if (!('options' in question)) throw new Error('Expected choice question');
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
        for (const span of [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])]) {
          const block = material.blocks.find(block => block.id === span.blockId)!;
          expect(block.text.slice(span.start, span.end).length).toBeGreaterThan(20);
          expect(span.audioEnd).toBeLessThanOrEqual(audio.duration);
        }
      }
    }
  });
});

it('C1 concessions preserve conditional recommendations and cross-paragraph evidence', async () => {
  const raw = (await import('./fixtures/content/c1-concessions-reading.json')).default;
  const lesson = lessonSchema.parse(raw);
  expect(lesson.reviewStatus).toBe('draft');
  expect(sources.find(source => source.id === lesson.sourceId)).toMatchObject({ approved: false, reviewer: null });
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  const roots = [rawC1, rawC1Listening, rawC2, rawB2].flatMap(existing => existing.materials.map(material => material.rootId));
  for (const material of lesson.materials) {
    expect(roots).not.toContain(material.rootId);
    const words = material.blocks.reduce((sum, block) => sum + block.text.split(/\s+/).length, 0);
    expect(words).toBeGreaterThanOrEqual(500);
    expect(words).toBeLessThanOrEqual(1200);
  }
  expect(questions(lesson)).toHaveLength(4);
  for (const { material, question } of questions(lesson)) {
    if (!('options' in question)) throw new Error('Expected authored closed response');
    expect(score(question, question.answer).correct).toBe(true);
    for (const index of question.options.keys()) if (index !== question.answer) expect(score(question, index).correct).toBe(false);
    expect(question.additionalEvidence?.length).toBeGreaterThanOrEqual(1);
    for (const reference of [{ blockId: question.blockId, ...question.evidence }, ...question.additionalEvidence!]) {
      expect(material.blocks.find(block => block.id === reference.blockId)!.text.slice(reference.start, reference.end).length).toBeGreaterThan(30);
    }
  }
});

it('A2 service instructions distinguish request details and required action order', async () => {
  const lesson = lessonSchema.parse((await import('./fixtures/content/a2-services-reading.json')).default);
  expect(lesson.reviewStatus).toBe('draft');
  expect(lesson.goalId).not.toBe(rawA2.goalId);
  expect(sources.find(source => source.id === lesson.sourceId)).toMatchObject({ approved: false, reviewer: null });
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  expect(questions(lesson)).toHaveLength(4);
  expect(lesson.nextStep?.en).toContain('which reply');
  for (const material of lesson.materials) {
    const words = material.blocks.reduce((sum, block) => sum + block.text.split(/\s+/).length, 0);
    expect(words).toBeGreaterThanOrEqual(50);
    expect(words).toBeLessThanOrEqual(180);
    for (const question of material.questions) {
      if ('steps' in question) {
        expect(question.acceptedOrders).toHaveLength(1);
        expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
        expect(score(question, [...question.acceptedOrders[0]].reverse()).correct).toBe(false);
        expect(question.additionalEvidence).toHaveLength(1);
      } else if ('options' in question) {
        for (const index of question.options.keys()) expect(score(question, index).correct).toBe(index === question.answer);
      } else throw new Error('Expected authored choice or sequence');
    }
  }
  const withoutAdvice = { ...lesson, nextStep: undefined };
  expect(lessonSchema.safeParse(withoutAdvice).success).toBe(true);
  expect(lessonSchema.safeParse({ ...rawCheck, nextStep: lesson.nextStep }).success).toBe(false);
});

 it('keeps beginner support localized and advanced practice English across all interface languages', () => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    for (const targetLevel of ['A1', 'A2'] as const) expect(practiceLocale({ targetLevel }, locale)).toBe(locale);
    for (const targetLevel of ['B1', 'B2', 'C1', 'C2'] as const) expect(practiceLocale({ targetLevel }, locale)).toBe('en');
  }
});

it('uses the saved corpus starting point and ignores translated goal exceptions without rewriting snapshots', () => {
  const goals = ['main-point-vs-detail', 'condition-outcome-limits', 'b1-context-reference', 'stated-narrative-motive', 'specific-speaker-intention', 'integrated-procedural-plan', 'claim-example-link', 'contextual-comparison', 'qualified-concession-meaning', 'speaker-attitude-in-context', 'integrated-source-information', 'attributed-views-in-context', 'implicit-intention-in-context', 'discourse-organization-in-context', 'register-audience-in-context', 'argument-boundaries-in-context', 'future-goal'];
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) for (const startingPoint of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) for (const goalId of goals) {
    const lesson = lessonSchema.parse(rawB1);
    lesson.goalId = goalId;
    lesson.generation = { generator: 'corpus-v1', startingPoint, seed: 0 };
    const before = structuredClone(lesson);
    expect(practiceLocale(lesson, locale)).toBe(startingPoint === 'A1' || startingPoint === 'A2' ? locale : 'en');
    expect(lesson).toEqual(before);
  }
});

it('authentic VOA beginner lessons retain distinct roots, local verified audio and source-backed answers', async () => {
  const { default: raw } = await import('./fixtures/retired-content/voa-a1.json');
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  for (const item of raw) {
    const lesson = lessonSchema.parse(item);
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.reviewStatus).toBe('draft');
    for (const { question } of questions(lesson)) {
      if (!('options' in question)) throw new Error('Expected authored choice');
      expect(score(question, question.answer).correct).toBe(true);
      expect(score(question, (question.answer + 1) % question.options.length).correct).toBe(false);
    }
    for (const m of lesson.materials) if (m.audio) {
      expect(createHash('sha256').update(readFileSync('public' + m.audio.src)).digest('hex')).toBe(m.audio.sha256);
      const wrong = structuredClone(lesson); wrong.materials[0].audio!.sourceUrl = 'https://example.com/unverified';
      expect(lessonSchema.safeParse(wrong).success).toBe(false);
    }
  }
});

it('authentic A2 drafts score corrected details, table rows and object order with original audio', async () => {
  const { default: raw } = await import('./fixtures/retired-content/voa-a2.json');
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  for (const item of raw) {
    const lesson = lessonSchema.parse(item);
    expect(lesson.targetLevel).toBe('A2');
    expect(lesson.reviewStatus).toBe('draft');
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    for (const { question } of questions(lesson)) {
      const correct = 'options' in question ? question.answer : 'rows' in question ? question.rows.map(row => row.answer) : 'steps' in question ? question.acceptedOrders[0] : 'pairs' in question ? question.pairs.map(pair => pair.answer) : 'answer' in question ? question.answer : undefined;
      const wrong = 'options' in question ? (question.answer + 1) % question.options.length : Array.isArray(correct) ? [...correct].reverse() : 'unspokenword';
      expect(score(question, correct!).correct).toBe(true);
      expect(score(question, wrong!).correct).toBe(false);
    }
    for (const m of lesson.materials) if (m.audio) {
      expect(createHash('sha256').update(readFileSync('public' + m.audio.src)).digest('hex')).toBe(m.audio.sha256);
    }
  }
});

it('authentic B1/B2 drafts retain English instruction, distinct source roots and scored evidence', async () => {
  const { default: b1 } = await import('./fixtures/retired-content/voa-b1.json');
  const { default: b2 } = await import('./fixtures/retired-content/voa-b2.json');
  const raw = [...b1, ...b2];
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  for (const item of raw) {
    const lesson = lessonSchema.parse(item);
    expect(['B1', 'B2']).toContain(lesson.targetLevel);
    expect(lesson.reviewStatus).toBe('draft');
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.teaching?.['zh-Hans']).toBe(lesson.teaching?.en);
    for (const { question } of questions(lesson)) {
      if (!('options' in question)) throw new Error('Expected authored request choice');
      expect(score(question, question.answer).correct).toBe(true);
      for (let i = 0; i < question.options.length; i++) if (i !== question.answer) expect(score(question, i).correct).toBe(false);
    }
    for (const m of lesson.materials) if (m.audio) expect(createHash('sha256').update(readFileSync('public' + m.audio.src)).digest('hex')).toBe(m.audio.sha256);
  }
});


it('C1 education and C2 balance drafts preserve credited audio, English support and unscored source interpretation', async () => {
  const { default: c1Lessons } = await import('./fixtures/retired-content/voa-c1.json');
  const { default: c2Lessons } = await import('./fixtures/retired-content/eisenhower-c2.json');
  const lessons = [...c1Lessons, ...c2Lessons];
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  expect(lessons).toHaveLength(4);
  for (const raw of lessons) {
    const lesson = lessonSchema.parse(raw);
    expect(['C1', 'C2']).toContain(lesson.targetLevel);
    if (lesson.targetLevel === 'C2' && lesson.skill === 'listening') {
      const invalid = structuredClone(lesson);
      invalid.materials[0].audio!.sourceUrl = 'https://www.eisenhowerlibrary.gov/research/online-documents/unverified-record';
      expect(lessonSchema.safeParse(invalid).success).toBe(false);
    }
    expect(lesson.reviewStatus).toBe('draft');
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.teaching?.['zh-Hans']).toBe(lesson.teaching?.en);
    for (const material of lesson.materials) {
      expect(sources.some(source => source.id === material.sourceId && !source.approved)).toBe(true);
      expect(material.blocks[0].text.split(/\s+/).length).toBeGreaterThanOrEqual(lesson.targetLevel === 'C2' ? 700 : 500);
      if (material.audio) {
        expect(material.audio.synthetic).toBe(false);
        expect(material.audio.duration).toBeGreaterThanOrEqual(lesson.targetLevel === 'C2' ? 180 : 120);
        expect(material.audio.duration).toBeLessThanOrEqual(lesson.targetLevel === 'C2' ? 480 : 360);
        expect(createHash('sha256').update(readFileSync('public' + material.audio.src)).digest('hex')).toBe(material.audio.sha256);
      }
      for (const question of material.questions) {
        if ('options' in question) for (const answer of question.options.keys()) expect(score(question, answer).correct).toBe(answer === question.answer);
        else if ('criteria' in question) {
          expect(score(question, 'An interpretation based on attributed evidence.').correct).toBeNull();
          expect(question.additionalEvidence).toHaveLength(1);
          expect(question.criteria.every(c => c.en === c['zh-Hans'] && c.en === c['zh-Hant'])).toBe(true);
        } else throw new Error('Expected authored choice or interpretation');
      }
    }
  }
});
