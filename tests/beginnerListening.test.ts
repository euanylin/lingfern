import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import sources from '../public/audio/a1-sentences/SENTENCES.json';
import words from '../public/ipa/SOURCES.json';
import { sentenceListeningLesson, sentencePolarityLesson, sentenceDescriptionLesson } from '../src/core/beginnerListening';
import { wordListeningLesson } from '../src/core/wordListening';
import { beginnerSentenceReady, corpusPracticeHistory, corpusOperation } from '../src/core/corpusPractice';
import { score, practiceLocale, asTestLesson } from '../src/shared/content';
import type { Attempt, Session } from '../src/data/db';

it('uses real short recordings, exact phrase evidence and unused worked examples without repeating roots or clips', () => {
  for (const source of sources) expect(createHash('sha256').update(readFileSync('public' + source.audio.src)).digest('hex')).toBe(source.audio.sha256);
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = sentenceListeningLesson(sources, new Set(), seed)!;
    expect(lesson).toEqual(sentenceListeningLesson(sources, new Set(), seed));
    expect(practiceLocale(lesson, 'zh-Hant')).toBe('zh-Hant');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.mode).toBeUndefined();
    for (const material of lesson.materials) {
      const source = sources.find(source => source.rootId === material.rootId)!;
      expect(material.audio).toEqual(source.audio);
      expect(material.audio!.duration).toBeLessThanOrEqual(12);
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'completion') throw new Error('Expected source completion');
      expect(score(question, question.answer).correct).toBe(true);
      expect(score(question, 'unheard').correct).toBe(false);
      const segment = source.segments.find(segment => segment.start === question.evidence.start)!;
      expect(question.evidence).toEqual({ start: segment.start, end: segment.end, audioStart: segment.audioStart, audioEnd: segment.audioEnd });
      expect(question.prompt.split('\n')[1].replace('________', question.answer)).toBe(segment.text);
    }
    const question = lesson.materials[0].questions[0];
    if (!('answer' in question) || typeof question.answer !== 'string') throw new Error('Expected word');
    const quotes = [...lesson.workedExample!.en.matchAll(/“([^”]+)”/g)].map(match => match[1]);
    expect(quotes[0].replace('________', quotes[1])).toBe(quotes[2]);
    expect(lesson.materials[0].blocks[0].text).toContain(quotes[2]);
    expect(quotes[2].toLowerCase()).not.toContain(question.answer.toLowerCase());
    const seen=new Set(lesson.materials.map(material=>material.audio!.sha256));
    const next=sentenceListeningLesson(sources,seen,seed);
    expect(next?.materials.every(material=>!seen.has(material.audio!.sha256))).toBe(true);
    expect(sentenceListeningLesson(sources,new Set(sources.slice(1).map(source=>source.audio.sha256)),seed)).toBeUndefined();
  }));
  expect(sentenceListeningLesson([], new Set(), 0)).toBeUndefined();
  expect(() => sentenceListeningLesson(sources, new Set(), -1)).toThrow();
  expect(() => sentenceListeningLesson([sources[0], sources[0]], new Set(), 0)).toThrow();
  for (const mutate of [
    (source: typeof sources[number]) => { source.audio.src = 'https://example.com/audio.mp3'; },
    (source: typeof sources[number]) => { source.segments[0].audioEnd = 20; },
    (source: typeof sources[number]) => { source.segments[0].end++; },
    (source: typeof sources[number]) => { source.rootId = 'voa-article-1'; },
  ]) {
    const bad = structuredClone(sources); mutate(bad[0]);
    expect(() => sentenceListeningLesson(bad, new Set(), 0)).toThrow();
  }
});

it('requires two unfamiliar word applications and completed unassisted audio before the A1 progression gate', () => {
  // Keep policy fixtures out of learner corpora and real profiles.
  const first = wordListeningLesson(words, new Set(), 0)!;
  const second = wordListeningLesson(words, new Set(first.materials.map(material => material.audio!.sha256)), 0)!;
  const history: Session[] = [first, second].map((lesson, index) => ({ id: `sentence-policy-${index}`, profileId: 'sentence-policy', lesson,
    contentHash: 'a'.repeat(64), position: 1, status: 'completed', startedAt: `2026-09-0${index + 1}T00:00:00.000Z`, assistance: { hintLevel: 0 }, leaseUntil: 0 }));
  const answers: Attempt[] = history.flatMap(session => session.lesson.materials.map(material => ({ id: `${session.id}-${material.id}`, profileId: session.profileId,
    sessionId: session.id, questionId: material.questions[0].id, rootId: material.rootId, answer: '', correct: true, rule: 'isolated policy',
    assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 }, submittedAt: session.startedAt })));
  const route = (saved = answers) => corpusPracticeHistory(history, saved, 'sentence-policy', 'listening', 'all', 'A1');
  expect(corpusPracticeHistory(history.slice(0, 1), answers.slice(0, 2), 'sentence-policy', 'listening', 'all', 'A1').independent).toBe(false);
  expect(route().independent).toBe(true);
  expect(beginnerSentenceReady(history, answers, 'sentence-policy')).toBe(true);
  const earlier: Session={...history[0],id:'earlier-other-goal',startedAt:'2026-08-01T00:00:00.000Z',lesson:{...first,skill:'reading',goalId:'other-goal'}};
  expect(beginnerSentenceReady([earlier,...history],answers,'sentence-policy')).toBe(false);
  const shortLesson=sentenceListeningLesson(sources,new Set(),0)!;
  const shortSession: Session={...history[0],id:'sentence-policy-short',lesson:shortLesson,startedAt:'2026-09-03T00:00:00.000Z'};
  const shortAnswers: Attempt[]=shortLesson.materials.map((material,index)=>({...answers[0],id:`sentence-short-${index}`,sessionId:shortSession.id,questionId:material.questions[0].id,rootId:material.rootId,submittedAt:shortSession.startedAt}));
  expect(corpusPracticeHistory([...history,shortSession],[...answers,...shortAnswers],'sentence-policy','listening','all','A1').independent).toBe(false);
  expect(beginnerSentenceReady([...history,shortSession],[...answers,...shortAnswers],'sentence-policy')).toBe(true);
  for(const change of [{correct:false},{assistance:{hintLevel:1,audioCompleted:true,playbackRequests:1}},{assistance:{hintLevel:0,audioCompleted:true,playbackRequests:2}}])
    expect(beginnerSentenceReady([...history,shortSession],[...answers,...shortAnswers.map((answer,index)=>index===1?{...answer,...change}:answer)],'sentence-policy')).toBe(false);
  const remedial=wordListeningLesson(words,new Set([...first.materials,...second.materials].map(material=>material.audio!.sha256)),0)!;
  const remedialSession: Session={...history[0],id:'sentence-remedial-word',lesson:remedial,startedAt:'2026-09-04T00:00:00.000Z'};
  const remedialAnswers: Attempt[]=remedial.materials.map((material,index)=>({...answers[0],id:`remedial-${index}`,sessionId:remedialSession.id,questionId:material.questions[0].id,rootId:material.rootId,submittedAt:remedialSession.startedAt}));
  const failedShort=shortAnswers.map((answer,index)=>index===1?{...answer,correct:false}:answer);
  expect(beginnerSentenceReady([...history,shortSession,remedialSession],[...answers,...failedShort,...remedialAnswers],'sentence-policy')).toBe(true);
  expect(beginnerSentenceReady([...history,shortSession,remedialSession],[...answers,...failedShort,...remedialAnswers.map(answer=>({...answer,assistance:{hintLevel:1,audioCompleted:true,playbackRequests:1}}))],'sentence-policy')).toBe(false);
  for (const change of [{ correct: false }, { assistance: { hintLevel: 1, audioCompleted: true, playbackRequests: 1 } },
    { assistance: { hintLevel: 0, audioCompleted: false, playbackRequests: 1 } }, { assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 2 } }])
    expect(route(answers.map((answer, index) => index === 3 ? { ...answer, ...change } : answer)).independent).toBe(false);
});

it('generates source-bound affirmative/negative meaning on distinct works without changing people or actions', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = sentencePolarityLesson(sources, new Set(), seed)!;
    expect(lesson).toEqual(sentencePolarityLesson(sources, new Set(), seed));
    expect(lesson.goalId).toBe('heard-polarity-verification');
    expect(lesson.targetLevel).toBe('A1');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.some(material => ['voa-article-3168920', 'voa-article-3225958'].includes(material.rootId))).toBe(true);
    expect(lesson.materials.every(material => !['voa-article-3126527', 'voa-article-3111026'].includes(material.rootId))).toBe(true);
    expect(lesson.workedExample!.en).toContain('Made-up');
    expect(lesson.materials[0].questions[0].hints).toHaveLength(3);
    expect(lesson.materials[1].questions[0].hints).toBeUndefined();
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    for (const material of lesson.materials) {
      const source = sources.find(source => source.rootId === material.rootId)!;
      expect(material.audio).toEqual(source.audio);
      const question = material.questions[0];
      if ('kind' in question) throw new Error('Expected polarity choice');
      expect(corpusOperation(question)).toBe('choice:heard-polarity');
      expect(question.id.length).toBeLessThanOrEqual(80);
      expect(new Set(question.options).size).toBe(2);
      expect(source.text).toContain(question.options[question.answer]);
      expect(question.prompt).not.toContain(question.options[question.answer]);
      const segment = source.segments.find(segment => segment.start === question.evidence.start)!;
      expect(question.evidence).toEqual({ start: segment.start, end: segment.end, audioStart: segment.audioStart, audioEnd: segment.audioEnd });
      for (let answer = 0; answer < 2; answer++) expect(score(question, answer).correct).toBe(answer === question.answer);
      expect(() => score(question, -1)).toThrow();
      expect(() => score(question, '')).toThrow();
    }
    const expected = structuredClone(lesson.materials);
    for (const material of expected) for (const question of material.questions) delete question.hints;
    expect(asTestLesson(lesson).materials).toEqual(expected);
    expect(asTestLesson(lesson).teaching).toBeUndefined();
    const seen = new Set(lesson.materials.map(material => material.audio!.sha256));
    const next = sentencePolarityLesson(sources, seen, seed)!;
    expect(next.materials.every(material => !seen.has(material.audio!.sha256))).toBe(true);
    for (const material of next.materials) seen.add(material.audio!.sha256);
    expect(sentencePolarityLesson(sources, seen, seed)).toBeUndefined();
  }), { numRuns: 500, seed: 3168920 });
  const book = sources.find(source => source.rootId === 'voa-article-3168920')!;
  const gym = sources.find(source => source.rootId === 'voa-article-3225958')!;
  expect(sentencePolarityLesson(sources, new Set([book.audio.sha256]), 0)!.materials.some(material => material.rootId === gym.rootId)).toBe(true);
  expect(sentencePolarityLesson(sources.filter(source => source !== book && source !== gym), new Set(), 0)).toBeUndefined();
  expect(sentencePolarityLesson([book], new Set(), 0)).toBeUndefined();
  expect(() => sentencePolarityLesson(sources, new Set(), -1)).toThrow();
});

it('retains the reviewed room correction and supplies another unseen same-goal pair before exhaustion', () => {
  const gym = sources.find(source => source.rootId === 'voa-article-3225958')!;
  expect(gym.text).toBe("Oh, Pete. This is not the gym. That's right, Anna. This is the mailroom.");
  const first = sentencePolarityLesson(sources, new Set(), 0)!;
  const seen = new Set(first.materials.map(material => material.audio!.sha256));
  const next = sentencePolarityLesson(sources, seen, 0)!;
  expect(next).toBeDefined();
  expect(next.materials.every(material => !seen.has(material.audio!.sha256))).toBe(true);
  expect(next.materials.some(material => material.rootId === gym.rootId)).toBe(true);
  for (const material of next.materials) seen.add(material.audio!.sha256);
  expect(sentencePolarityLesson(sources, seen, 0)).toBeUndefined();
  const altered = { ...gym, text: 'This is not the gym.', segments: [{ start: 0, end: 20, text: 'This is not the gym.', audioStart: 0, audioEnd: 2 }] };
  altered.segments[0].end = altered.text.length;
  expect(sentencePolarityLesson([altered, sources[0]], new Set(), 0)).toBeUndefined();
});

it('refuses contradictory polarity, unreviewed conditions, deictic claims and questions as facts', () => {
  const book = sources.find(source => source.rootId === 'voa-article-3168920')!;
  const rewrite = (source: typeof book, text: string) => ({ ...source, text,
    segments: [{ start: 0, end: text.length, text, audioStart: 0, audioEnd: source.audio.duration }] });
  for (const text of ['It is not a pen. It is a pen.', "I'm not reading. I am reading.", 'It is not a pen if it is red.'])
    expect(sentencePolarityLesson([rewrite(book, text), sources[0]], new Set(), 0)).toBeUndefined();
  for (const text of ['You are there. Are you there?', 'Are you reading the news?', 'It is beautiful but sometimes not.'])
    expect(sentencePolarityLesson([book, rewrite(sources[0], text)], new Set(), 0)).toBeUndefined();
});


it('hears explicit descriptions rather than a mentioned location or negated object', () => {
  const identitySources = sources.filter(source => ['voa-article-3113733', 'voa-article-3168920'].includes(source.rootId));
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = sentenceDescriptionLesson(sources, new Set(), seed)!;
    expect(lesson).toEqual(sentenceDescriptionLesson(sources, new Set(), seed));
    expect(lesson.goalId).toBe('heard-explicit-description');
    expect(lesson.targetLevel).toBe('A1');
    expect(new Set(lesson.materials.map(material => material.rootId))).toEqual(new Set(identitySources.map(source => source.rootId)));
    expect(lesson.materials[0].questions[0].hints).toHaveLength(3);
    expect(lesson.materials[1].questions[0].hints).toBeUndefined();
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
      expect(lesson.goal![locale]).toBeTruthy(); expect(lesson.teaching![locale]).toBeTruthy();
      expect(lesson.workedExample![locale]).toBeTruthy(); expect(lesson.nextStep![locale]).toBeTruthy();
    }
    for (const material of lesson.materials) {
      const source = identitySources.find(source => source.rootId === material.rootId)!;
      expect(material.audio).toEqual(source.audio);
      const q = material.questions[0]; if ('kind' in q) throw new Error('Expected description choice');
      expect(corpusOperation(q)).toBe('choice:heard-description');
      expect(q.id.length).toBeLessThanOrEqual(80);
      expect(q.options[q.answer]).toBe(material.rootId === 'voa-article-3113733' ? 'I come from a small town.' : 'It is a book.');
      expect(q.options[1 - q.answer]).toBe(material.rootId === 'voa-article-3113733' ? 'I come from D.C.' : 'It is a pen.');
      expect(q.evidence).toEqual({ start: 0, end: source.text.length, audioStart: source.segments[0].audioStart, audioEnd: source.segments.at(-1)!.audioEnd });
      for (let answer = 0; answer < 2; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      expect(() => score(q, 2)).toThrow();
      expect(q.explanations![1 - q.answer].en).toContain(q.options[1 - q.answer]);
    }
    const test = asTestLesson(lesson), materials = structuredClone(lesson.materials);
    for (const material of materials) delete material.questions[0].hints;
    expect(test.materials).toEqual(materials); expect(test.teaching).toBeUndefined();
    expect(sentenceDescriptionLesson(sources, new Set([lesson.materials[0].audio!.sha256]), seed)).toBeUndefined();
  }), { numRuns: 200, seed: 3113733 });
  expect(sentenceDescriptionLesson([], new Set(), 0)).toBeUndefined();
  expect(sentenceDescriptionLesson(identitySources.slice(0, 1), new Set(), 0)).toBeUndefined();
  const altered = (text: string) => ({ ...identitySources[1], text, segments: [{ start: 0, end: text.length, text, audioStart: .2, audioEnd: 5.9 }] });
  for (const text of ['It is not a book. It is a book. It is a big book.', 'It is not a pen. It is a book. It is a big pen.', 'Is it a pen? It is a book.', 'It might be a book.', 'It is only a book.']) {
    expect(sentenceDescriptionLesson([identitySources[0], altered(text)], new Set(), 0)).toBeUndefined();
  }
  expect(() => sentenceDescriptionLesson(sources, new Set(), -1)).toThrow();
});
