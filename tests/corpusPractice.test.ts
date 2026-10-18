import shortListeningOverlaps from '../content/corpus/short-listening-overlaps.json';
import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { corpusLesson, corpusSchema, selectCorpusPassage, corpusApartments } from '../src/core/corpus';
import { corpusInterestMatch, corpusInterestScore, corpusPreferencePool, corpusPreferenceScore, corpusOperation, corpusPracticeHistory, qualificationPrompt } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import type { Attempt, Session } from '../src/data/db';
import { levelSchema, topicSchema } from '../src/shared/content';

// Isolated policy metadata; no synthetic learner profile enters application assets.
const lesson = corpusLesson(corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8'))), new Set(), 0)!;
const profile = 'policy-test';
const transferLesson = corpusLesson(corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8'))), new Set(), 0, 300, 'B2', [], 'completion')!;
function session(id = 'session', skill: 'reading' | 'listening' = 'reading', sourceLesson = lesson): Session {
  return { id, profileId: profile, lesson: { ...sourceLesson, skill }, contentHash: 'a'.repeat(64), position: 4,
    status: 'completed', startedAt: '2026-09-01T00:00:00.000Z', assistance: { hintLevel: 0 }, leaseUntil: 0 };
}
function answers(s: Session): Attempt[] {
  return s.lesson.materials.flatMap(material => material.questions
    .filter(question => !('kind' in question) || question.kind !== 'response')
    .map(question => ({ id: s.id + '-' + question.id, profileId: profile, sessionId: s.id,
      questionId: question.id, rootId: material.rootId, answer: '', correct: true, rule: 'test-policy',
      assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 1 },
      submittedAt: '2026-09-02T00:00:00.000Z' })));
}
const route = (sessions: Session[], records: Attempt[], skill: 'reading' | 'listening' = 'reading') =>
  corpusPracticeHistory(sessions, records, profile, skill, 'voa');

it('uses the current qualification operation without rewriting a saved lesson', () => {
  const original = structuredClone(transferLesson);
  const material = original.materials[0], question = material.questions[0];
  const oldPrompt = qualificationPrompt;
  material.questions[0] = { kind: 'evidence', id: question.id, blockId: material.blocks[0].id, prompt: oldPrompt,
    spans: [0, 1, 2].map(start => ({ blockId: material.blocks[0].id, start, end: start + 1, text: material.blocks[0].text[start] })),
    accepted: [0], evidence: question.evidence, hints: question.hints,
    explanation: 'explanation' in question ? question.explanation : question.explanations[0] };
  const saved = session('old-qualified-prompt', 'listening', original);
  const records = answers(saved); records[0].correct = false;
  expect(corpusOperation(material.questions[0])).toBe(`evidence:${qualificationPrompt}`);
  expect(route([saved], records, 'listening').focus).toMatchObject({ reason: 'retry', operation: `evidence:${qualificationPrompt}` });
  expect(material.questions[0].prompt).toBe(oldPrompt);
});

it('keeps unrelated matching errors separate and does not let another operation mask a retry', () => {
  const make = (id: string, prompt: string, at: string) => {
    const s = session(id, 'reading', structuredClone(transferLesson));
    s.lesson.materials.forEach(material => { material.rootId += '-' + id; });
    const material = s.lesson.materials[0], q = material.questions[0];
    material.questions[0] = { kind: 'matching', id: q.id, blockId: material.blocks[0].id, prompt,
      pairs: [{ label: 'Action', answer: 'Role' }], choices: ['Role', 'Other'], evidence: { start: 0, end: 10 },
      hints: q.hints, explanation: 'explanation' in q ? q.explanation : q.explanations[0] };
    return { s, saved: answers(s).map((answer, index) => ({ ...answer, correct: !!index, submittedAt: at })) };
  };
  const request = make('request', 'Match each action to its request.', '2026-09-02T00:00:00.000Z');
  const role = make('role', 'Match each reliance to its role.', '2026-09-03T00:00:00.000Z');
  const histories = [request.s, role.s], saved = [...request.saved, ...role.saved];
  expect(route(histories, saved).focus).toMatchObject({ kind: 'matching', operation: corpusOperation(role.s.lesson.materials[0].questions[0]), reason: 'retry' });
  role.saved[0].correct = true;
  expect(route(histories, [...request.saved, ...role.saved]).focus).toMatchObject({ operation: corpusOperation(request.s.lesson.materials[0].questions[0]), reason: 'retry' });
  const again = make('request-again', request.s.lesson.materials[0].questions[0].prompt, '2026-09-04T00:00:00.000Z');
  expect(route([...histories, again.s], [...request.saved, ...role.saved, ...again.saved]).focus?.reason).toBe('reteach');
});

it('retries the requested semantic matching operation through actual source-package generation', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string }[] };
  const entry = catalogue.packs.find(pack => pack.id === 'wikipedia-reading-017')!;
  const bank = (await inspectCommunityPack(readSourcePackFixture(entry.id))).corpus!;
  // Both operations are checked against the exact package below; discovering their names is not the retry contract.
  const operations = [
    'matching:Match each action to what the request asks for or rules out.',
    'matching:In the paired statement, match each reliance to what needs it.',
  ];
  expect(new Set(operations).size).toBe(2);
  for (const operation of operations) for (let seed = 0; seed < 8; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 300, 'B2', [], 'matching', [], operation)!;
    expect(corpusOperation(lesson.materials[0].questions[0])).toBe(operation);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const seen = new Set([lesson.materials[0].id.slice('corpus-'.length)]);
    const next = corpusLesson(bank, seen, seed, 300, 'B2', [], 'matching', [], operation);
    expect(next?.materials.some(material => seen.has(material.id.slice('corpus-'.length)))).not.toBe(true);
  }
});

it('keeps apartment and date table errors in separate operations', () => {
  const make = (id: string, prompt: string, at: string) => {
    const s = session(id, 'reading', structuredClone(transferLesson));
    s.lesson.materials.forEach(material => { material.rootId += '-' + id; });
    for (const material of s.lesson.materials) {
      const q = material.questions[0];
      material.questions[0] = { kind: 'table', id: q.id, blockId: material.blocks[0].id, prompt,
      rows: [{ label: 'First', answer: '1', accepted: ['1'] }, { label: 'Second', answer: '2', accepted: ['2'] }],
      evidence: q.evidence, hints: q.hints, explanation: 'explanation' in q ? q.explanation : q.explanations[0] };
    }
    return { s, saved: answers(s).map((answer, index) => ({ ...answer, correct: !!index, submittedAt: at })) };
  };
  const apartment = make('apartment', 'Write each person’s apartment code.', '2026-09-02T00:00:00.000Z');
  const date = make('date', 'Complete each sentence with the year given in the passage.', '2026-09-03T00:00:00.000Z');
  expect(corpusOperation(apartment.s.lesson.materials[0].questions[0])).not.toBe(corpusOperation(date.s.lesson.materials[0].questions[0]));
  expect(route([apartment.s, date.s], [...apartment.saved, ...date.saved]).focus?.reason).toBe('retry');
  date.saved[0].correct = true;
  expect(route([apartment.s, date.s], [...apartment.saved, ...date.saved]).focus?.operation).toBe(`table:${apartment.s.lesson.materials[0].questions[0].prompt}`);
  const correct = [...apartment.saved, ...date.saved].map(answer => ({ ...answer, correct: true }));
  expect(route([apartment.s, date.s], correct).independent).toBe(false);
  const same = structuredClone(apartment.s);
  same.lesson.materials.forEach(material => { material.questions[0].prompt = date.s.lesson.materials[0].questions[0].prompt; });
  expect(route([same, date.s], correct).independent).toBe(true);
});

it('requires all distinct scored questions before recommending longer practice', () => {
  const s = session(), saved = answers(s);
  expect(route([], []).maxWords).toBe(300);
  expect(route([s], saved).independent).toBe(false);
  expect(route([s], saved).maxWords).toBe(300);
  const duplicate = { ...saved[0], id: 'duplicate' };
  expect(route([s], [saved[0], duplicate]).independent).toBe(false);
  expect(route([s], [saved[0], duplicate]).maxWords).toBe(300);
  const response = s.lesson.materials[0].questions[1];
  const unscored = { ...saved[0], id: 'summary', questionId: response.id, correct: null, assistance: { hintLevel: 3 } };
  expect(route([s], [...saved, unscored]).independent).toBe(false);
  expect(route([s], [unscored]).independent).toBe(false);
});

it('keeps wrong answers and assistance separate from unsupported success', () => {
  const s = session(), saved = answers(s);
  for (const change of [{ correct: false }, { assistance: { hintLevel: 1 } }, { assistance: { hintLevel: 0, dictionaryUsed: true } }]) {
    const result = route([s], [{ ...saved[0], ...change }, saved[1]]);
    expect(result.needsSupport).toBe(true); expect(result.maxWords).toBe(220); expect(result.independent).toBe(false);
  }
});

it('accounts for actual audio completion and repeated listening without changing reading', () => {
  const s = session('audio', 'listening'), saved = answers(s);
  expect(route([s], saved, 'listening').maxSeconds).toBe(60);
  saved[0].assistance.playbackRequests = 2;
  expect(route([s], saved, 'listening').maxSeconds).toBe(25);
  expect(route([s], saved, 'reading').recent).toBeUndefined();
  saved[0].assistance.playbackRequests = 1;
  delete saved[0].assistance.audioCompleted;
  expect(route([s], saved, 'listening').maxSeconds).toBe(60);
});

it('uses actual last saved time and ignores deleted, foreign-profile and foreign-source tasks', () => {
  const old = session('old'), newer = { ...session('new'), startedAt: '2026-09-03T00:00:00.000Z' };
  const oldAnswers = answers(old).map(answer => ({ ...answer, submittedAt: '2026-09-05T00:00:00.000Z' }));
  expect(route([newer, old], [...answers(newer), ...oldAnswers]).recent?.id).toBe('old');
  old.recordsDeleted = true;
  expect(route([newer, old], [...answers(newer), ...oldAnswers]).recent?.id).toBe('new');
  const check: Session = { ...newer, lesson: { ...newer.lesson, mode: 'check' } };
  expect(route([check], answers(check)).originals).toHaveLength(0);
  const foreign = { ...newer, profileId: 'another-profile' };
  expect(route([foreign], answers(foreign)).originals).toHaveLength(0);
  expect(route([newer], answers(newer).map(answer => ({ ...answer, profileId: 'another-profile' }))).independent).toBe(false);
  expect(corpusPracticeHistory([newer], answers(newer), profile, 'reading', 'gutenberg').originals).toHaveLength(0);
});

it('retains earlier mistakes and assistance when a later retry is correct', () => {
  const s = session(), saved = answers(s);
  for (const change of [{ correct: false }, { assistance: { hintLevel: 2 } }, { assistance: { hintLevel: 0, dictionaryUsed: true } }]) {
    const earlier = { ...saved[0], ...change, id: 'earlier', submittedAt: '2026-09-01T12:00:00.000Z' };
    expect(route([s], [earlier, ...saved]).maxWords).toBe(220);
    expect(route([s], [earlier, ...saved]).independent).toBe(false);
  }
  const listening = session('replay', 'listening'), audioAnswers = answers(listening);
  const replay = { ...audioAnswers[0], id: 'earlier-replay', submittedAt: '2026-09-01T12:00:00.000Z',
    assistance: { hintLevel: 0, audioCompleted: true, playbackRequests: 2 } };
  expect(route([listening], [replay, ...audioAnswers], 'listening').maxSeconds).toBe(25);
});

it('reserves generated source excerpts across skills and sources without mixing profiles', () => {
  const reading = session(), listening = session('heard', 'listening');
  listening.lesson = { ...listening.lesson, materials: listening.lesson.materials.map((material, index) => ({ ...material, id: 'corpus-' + String(index + 1).repeat(64), sourceId: 'wikipedia-1' })) };
  const foreign = { ...session('foreign'), profileId: 'other', lesson: { ...lesson, materials: lesson.materials.map(material => ({ ...material, id: 'corpus-' + 'f'.repeat(64) })) } };
  const result = route([reading, listening, foreign], []);
  expect(result.seen.has('1'.repeat(64))).toBe(true);
  expect(result.seen.has('2'.repeat(64))).toBe(true);
  expect(result.seen.has('f'.repeat(64))).toBe(false);
  expect(result.originals).toEqual([reading]);
});

it('uses each chosen starting point for effort bounds without changing curriculum labels or saved evidence', () => {
  expect(() => corpusPracticeHistory([], [], profile, 'reading', 'all', 'invalid' as never)).toThrow('INVALID_CORPUS_STARTING_POINT');
  const words = [120, 160, 220, 300, 900, 1200], seconds = [8, 20, 35, 60, 75, 91];
  for (const [index, level] of levelSchema.options.entries()) {
    for (const skill of ['reading', 'listening'] as const) {
      const s = session(skill, skill), saved = answers(s);
      const baseline = corpusPracticeHistory([], [], profile, skill, 'all', level);
      expect(baseline.maxWords).toBe(words[index]); expect(baseline.maxSeconds).toBe(seconds[index]);
      const independent = corpusPracticeHistory([s], saved, profile, skill, 'all', level);
      expect(independent.maxWords).toBeGreaterThanOrEqual(baseline.maxWords);
      expect(independent.maxSeconds).toBeGreaterThanOrEqual(baseline.maxSeconds);
      const wrong = [{ ...saved[0], correct: false }, saved[1]];
      const supported = corpusPracticeHistory([s], wrong, profile, skill, 'all', level);
      expect(supported.maxWords).toBeLessThanOrEqual(baseline.maxWords);
      expect(supported.maxSeconds).toBeLessThanOrEqual(baseline.maxSeconds);
      expect(s.lesson.targetLevel).toBe(lesson.targetLevel);
    }
  }
});


it('prefers interest wording only within eligible fresh sources and falls back without blocking', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const source = corpus.records.find(record => record.rootId === 'voa-article-3113733')!;
  const passage = source.passages[0];
  const others = corpus.records.filter(record => record.rootId !== source.rootId && !corpusInterestMatch(record.title + '\n' + record.passages[0].text, ['daily-life']));
  const scoped = { ...corpus, records: [...others, source] };
  for (let seed = 0; seed < 20; seed++) {
    expect(selectCorpusPassage(scoped, new Set(), seed, 120, ['daily-life'])?.source.rootId).toBe(source.rootId);
    expect(selectCorpusPassage(scoped, new Set([passage.id]), seed, 120, ['daily-life'])?.source.rootId).not.toBe(source.rootId);
    const generated = corpusLesson(corpus, new Set(), seed, 120, 'A1', ['daily-life'])!;
    expect(generated.materials.every(material => corpusInterestMatch(material.title + '\n' + material.blocks[0].text, ['daily-life']))).toBe(true);
    expect(new Set(generated.materials.map(material => material.rootId)).size).toBe(2);
    expect(generated.materials.every(material => material.blocks[0].text.trim().split(/\s+/).length <= 80)).toBe(true);
  }
  expect(corpusInterestMatch('Conscience and hotelier', ['science', 'travel'])).toBe(false);
  expect(corpusInterestMatch('UNIVERSITY classroom', ['campus'])).toBe(true);
  expect(() => corpusInterestMatch('text', ['science', 'science'])).toThrow('INVALID_CORPUS_INTERESTS');
  expect(selectCorpusPassage(scoped, new Set(scoped.records.flatMap(record => record.passages.map(item => item.id))), 0, 120, ['daily-life'])).toBeUndefined();
});


it('routes first scored errors and help to task focus without counting retries as new contexts', () => {
  const first = session('first'), saved = answers(first);
  const kind = first.lesson.materials[0].questions[0];
  if (!('kind' in kind)) throw new Error('Expected generated kind');
  const wrong = [{ ...saved[0], correct: false }, saved[1]];
  expect(route([first], wrong).focus).toMatchObject({ kind: kind.kind, reason: 'retry' });
  const repeat = session('repeat');
  expect(route([first, repeat], [...wrong, ...answers(repeat).map((answer, index) => ({ ...answer, correct: !!index }))]).focus?.reason).toBe('retry');
  const different = session('different');
  different.lesson = { ...different.lesson, materials: different.lesson.materials.map(material => ({ ...material, rootId: material.rootId + '-new' })) };
  const again = answers(different).map(answer => ({ ...answer, correct: false, submittedAt: '2026-09-03T00:00:00.000Z' }));
  expect(route([first, different], [...wrong, ...again]).focus).toMatchObject({ kind: kind.kind, reason: 'reteach' });
  expect(route([first], saved.map((answer, index) => index ? answer : { ...answer, assistance: { hintLevel: 1 } })).focus).toMatchObject({ kind: kind.kind, reason: 'retry' });
  expect(route([first], wrong.map(answer => ({ ...answer, submittedAt: '2050-01-01T00:00:00.000Z' }))).focus).toBeUndefined();
  expect(route([{ ...first, status: 'active' }], wrong).focus).toBeUndefined();
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  for (const focus of ['completion', 'sequence', 'matching', 'table'] as const) for (let seed = 0; seed < 20; seed++) {
    const next = corpusLesson(corpus, new Set(), seed, 120, 'A1', ['travel'], focus)!;
    expect(next.generation).toMatchObject({ focus });
    expect(next.materials[0].questions[0]).toMatchObject({ kind: focus });
    expect(next.materials[1].questions[0]).toMatchObject({ kind: focus });
    if (focus === 'table') {
      const roots = corpus.records.filter(source => source.passages.some(passage => passage.startingPoints?.includes('A1') && passage.wordCount <= 120 && corpusApartments(passage.text, seed)));
      expect(new Set(roots.map(source => source.rootId)).size).toBe(51);
    }
    expect(new Set(next.materials.map(material => material.rootId)).size).toBe(2);
  }
  expect(corpusLesson(corpus, new Set(), 0, 120, 'A1', [], 'evidence')).toBeDefined();
});


it('prioritizes verified due recurrence below repeated errors and above assistance', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T00:00:00Z'));
  try {
    const first = session('first'), saved = answers(first);
    const key = `${first.lesson.skill}:${first.lesson.targetLevel}:${first.lesson.goalId}`;
    const due = new Map([[key, { state: 'review_due' as const, nextSuggestedAt: '2026-09-03T00:00:00.000Z' }]]);
    const select = (history: Session[], records: Attempt[]) => corpusPracticeHistory(history, records, profile, 'reading', 'all', undefined, due);
    expect(select([first], saved).focus?.reason).toBe('review');
    expect(select([first], saved.map((answer, index) => index ? answer : { ...answer, assistance: { hintLevel: 1 } })).focus?.reason).toBe('review');
    const other = session('other');
    other.lesson = { ...other.lesson, materials: other.lesson.materials.map(material => ({ ...material, rootId: material.rootId + '-other' })) };
    const wrong = [...saved, ...answers(other)].map(answer => ({ ...answer, correct: false }));
    expect(select([first, other], wrong).focus?.reason).toBe('reteach');
    const future = new Map([[key, { state: 'review_due' as const, nextSuggestedAt: '2026-09-06T00:00:00.000Z' }]]);
    expect(corpusPracticeHistory([first], saved, profile, 'reading', 'all', undefined, future).focus).toBeUndefined();
    expect(select([{ ...first, status: 'active' }], saved).focus).toBeUndefined();
  } finally { vi.useRealTimers(); }
});


it('matches review candidates by whole lexical forms, not regex input or asserted word senses', async () => {
  const { corpusReviewMatch } = await import('../src/core/corpusPractice');
  expect(corpusReviewMatch('A bank by the river.', ['bank'])).toBe(true);
  expect(corpusReviewMatch('banking', ['bank'])).toBe(false);
  expect(corpusReviewMatch('They take   off.', ['take off'])).toBe(true);
  expect(corpusReviewMatch('anything', ['.*'])).toBe(false);
  expect(() => corpusReviewMatch('bank', Array(101).fill('bank'))).toThrow('CORPUS_REVIEW_LIMIT');
});


it('requires two fresh complete application roots and never counts taught or previously reserved contexts', () => {
  for (const skill of ['reading', 'listening'] as const) {
    const first = session('first', skill, transferLesson), second = session('second', skill, transferLesson);
    second.startedAt = '2026-09-03T00:00:00.000Z';
    second.lesson = { ...second.lesson, materials: second.lesson.materials.map(material => ({ ...material, rootId: material.rootId + '-second' })) };
    const firstAnswers = answers(first), secondAnswers = answers(second).map(answer => ({ ...answer, submittedAt: '2026-09-04T00:00:00.000Z' }));
    for (const s of [first, second]) {
      const list = s === first ? firstAnswers : secondAnswers;
      list.find(answer => answer.rootId === s.lesson.materials[0].rootId)!.assistance.teachingProvided = true;
    }
    const all = [...firstAnswers, ...secondAnswers];
    expect(route([first], firstAnswers, skill).independent).toBe(false);
    expect(route([first, second], all, skill).independent).toBe(true);
    expect(route([first, second], all, skill)[skill === 'reading' ? 'maxWords' : 'maxSeconds']).toBe(skill === 'reading' ? 500 : 91);
    const application = secondAnswers.find(answer => answer.rootId === second.lesson.materials[1].rootId)!;
    for (const assistance of [{ hintLevel: 1 }, { hintLevel: 0, teachingProvided: true }, { hintLevel: 0, dictionaryUsed: true }]) {
      expect(route([first, second], all.map(answer => answer === application ? { ...answer, assistance } : answer), skill).independent).toBe(false);
    }
    expect(route([first, second], all.filter(answer => answer !== application), skill).independent).toBe(false);
    expect(route([first, second], all.map(answer => answer === application ? { ...answer, submittedAt: '2050-01-01T00:00:00.000Z' } : answer), skill).independent).toBe(false);
    const taught = secondAnswers.find(answer => answer.rootId === second.lesson.materials[0].rootId)!;
    for (const submittedAt of ['2050-01-01T00:00:00.000Z', 'invalid-date']) {
      expect(route([first, second], all.map(answer => answer === taught ? { ...answer, submittedAt } : answer), skill).independent).toBe(false);
    }
    expect(route([first, second], [...firstAnswers, firstAnswers[0], secondAnswers[0]], skill).independent).toBe(false);
    const prior = { ...session('reserved', skill === 'reading' ? 'listening' : 'reading'), status: 'ended' as const,
      startedAt: '2026-08-01T00:00:00.000Z', lesson: { ...first.lesson, materials: [{ ...first.lesson.materials[0], rootId: first.lesson.materials[1].rootId }] } };
    expect(route([prior, first, second], all, skill).independent).toBe(false);
    for (const startedAt of ['invalid-date', '2050-01-01T00:00:00.000Z']) {
      expect(route([{ ...prior, startedAt }, first, second], all, skill).independent).toBe(false);
      expect(route([first, { ...second, startedAt }], all, skill).independent).toBe(false);
    }
    expect(route([first, { ...second, recordsDeleted: true }], all, skill).independent).toBe(false);
  }
});

 it('does not treat unrelated operations or matching meanings as successful transfer', () => {
  const first = session('first', 'reading', transferLesson), second = session('second', 'reading', transferLesson);
  second.startedAt = '2026-09-03T00:00:00.000Z';
  second.lesson = { ...second.lesson, materials: second.lesson.materials.map(material => ({ ...material, rootId: material.rootId + '-second' })) };
  const all = [...answers(first), ...answers(second).map(answer => ({ ...answer, submittedAt: '2026-09-04T00:00:00.000Z' }))];
  expect(route([first, second], all).independent).toBe(true);
  const changed = structuredClone(second);
  const question = changed.lesson.materials[1].questions[0];
  changed.lesson.materials[1].questions[0] = { kind: 'sequence', id: question.id, blockId: changed.lesson.materials[1].blocks[0].id,
    prompt: 'Restore the sentences.', steps: ['One.', 'Two.', 'Three.'], acceptedOrders: [['One.', 'Two.', 'Three.']], evidence: { start: 0, end: 10 }, hints: question.hints, explanation: 'explanation' in question ? question.explanation : question.explanations[0] };
  expect(route([first, changed], all).independent).toBe(false);
  expect(route([first, changed], all).maxWords).toBe(300);
  const matching = [first, second].map(s => ({ ...s, lesson: { ...s.lesson, materials: s.lesson.materials.map(material => ({ ...material, questions: material.questions.map((q, index) => index ? q : {
    kind: 'matching' as const, id: q.id, blockId: material.blocks[0].id, prompt: 'Match each action to its request.', pairs: [{ label: 'Action', answer: 'Requested' }], choices: ['Requested', 'Ruled out'], evidence: { start: 0, end: 10 }, hints: q.hints, explanation: 'explanation' in q ? q.explanation : q.explanations[0],
  }) })) } }));
  expect(route(matching, all).independent).toBe(true);
  const unrelated = structuredClone(matching);
  unrelated[1].lesson.materials[1].questions[0].prompt = 'Match each reliance to its role.';
  expect(route(unrelated, all).independent).toBe(false);
});


it('supports all expanded interests, title relevance, rotating preferences and comparable structural effort', () => {
  const examples = ['University students', 'Apartment kitchen', 'Physics experiment', 'Museum festival', 'Airport hotel', 'Computer software', 'Wildlife forest', 'Climate pollution', 'Ancient empire', 'Poetry fiction', 'Songs orchestra', 'Cinema movies', 'Football grand prix', 'Medical hospital', 'Business workplace', 'Democracy society', 'Linguistics dialect', 'Cooking recipe'];
  expect(topicSchema.options).toHaveLength(18);
  topicSchema.options.forEach((topic, index) => expect(corpusInterestMatch(examples[index], [topic])).toBe(true));
  expect(corpusInterestMatch('cathedral programmingly hotelier', ['nature', 'technology', 'travel'])).toBe(false);
  expect(corpusInterestScore('Football', 'A match happened.', ['sport'])).toBeGreaterThan(corpusInterestScore('Overview', 'Football '.repeat(30), ['sport']));
  const text = 'We read the words and talk about them. '.repeat(6);
  const topics = [{ title: 'Music', text }, { title: 'Football', text }];
  expect(corpusPreferencePool(topics, item => item, ['music', 'sport'], 0, 'B1')[0].title).toBe('Music');
  expect(corpusPreferencePool(topics, item => item, ['music', 'sport'], 1, 'B1')[0].title).toBe('Football');
  const accessible = { title: 'Science', text: 'Science tells us how the world works and helps us think about things we can see each day around us. '.repeat(5) };
  const demanding = { title: 'Science', text: ('Scientists examine the evidence while researchers explain how different processes change over time, although the results of each experiment depend on several assumptions about the environment and cannot establish a single cause for every observation. ').repeat(4) };
  expect(corpusPreferencePool([demanding, accessible], item => item, ['science'], 0, 'B1')).toEqual([accessible]);
  expect(corpusPreferencePool([accessible, demanding], item => item, ['science'], 0, 'C2')).toEqual([demanding]);
  expect(corpusPreferenceScore('Science', accessible.text, ['science'], 0, 'B1', 45)).toBeGreaterThan(corpusPreferenceScore('Science', accessible.text, ['science'], 0, 'B1', 10));
  expect(corpusPreferencePool(topics, item => item, [], 0, 'B1')).toBe(topics);
  expect(corpusPreferencePool(topics, item => item, ['health'], 0, 'B1')).toHaveLength(2);
});

it('selects eligible reading source families before their differently sized passage pools', () => {
  const original = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const passage = original.records[0].passages.find(item => item.wordCount <= 300)!;
  const source = original.records[0];
  const make = (family: 'voa' | 'gutenberg' | 'wikipedia', count: number) => ({ ...source, id: `${family}-1`,
    passages: Array.from({ length: count }, (_, index) => ({ ...passage, id: `${family}-${index}` })) });
  for (const count of [1, 7, 101]) {
    const corpus = { ...original, records: [make('voa', 1), make('gutenberg', 7), make('wikipedia', count)] };
    const selected = Array.from({ length: 300 }, (_, seed) => selectCorpusPassage(corpus, new Set(), seed, 300)!);
    for (const family of ['voa', 'gutenberg', 'wikipedia']) expect(selected.filter(item => item.source.id === `${family}-1`)).toHaveLength(100);
    const reviewed = { ...corpus, records: corpus.records.map(record => record.id === 'voa-1' ? { ...record, passages: record.passages.map(item => ({ ...item, text: item.text + ' orchidmarker' })) } : record) };
    const bounded = { ...corpus, records: corpus.records.map(record => record.id === 'voa-1' ? { ...record, passages: record.passages.map(item => ({ ...item, wordCount: 301 })) } : record) };
    for (let seed = 0; seed < 20; seed++) {
      expect(selectCorpusPassage(reviewed, new Set(), seed, 300, [], ['orchidmarker'])?.source.id).toBe('voa-1');
      expect(selectCorpusPassage(bounded, new Set(), seed, 300)?.source.id).not.toBe('voa-1');
    }
    const seen = new Set(['voa-0']);
    for (let seed = 0; seed < 20; seed++) expect(selectCorpusPassage(corpus, seen, seed, 300)?.source.id).not.toBe('voa-1');
    const single = { ...corpus, records: [make('gutenberg', 7)] };
    for (let seed = 0; seed < 20; seed++) expect(selectCorpusPassage(single, new Set(), seed, 300)?.passage.id).toBe(`gutenberg-${seed % 7}`);
    expect(selectCorpusPassage(corpus, new Set(corpus.records.flatMap(record => record.passages.map(item => item.id))), 0, 300)).toBeUndefined();
  }
});

it('reserves admitted short listening overlaps in both directions and preserves foreign-profile isolation', () => {
  for (const scope of shortListeningOverlaps.records.filter(scope => scope.overlappingIds.length)) {
    for (const id of [scope.id, ...scope.overlappingIds]) {
      const saved = session('overlap', 'listening');
      saved.lesson = { ...saved.lesson, materials: saved.lesson.materials.map((material, index) => ({ ...material, id: 'corpus-' + (index ? 'f'.repeat(64) : id) })) };
      const result = corpusPracticeHistory([saved], [], profile, 'listening', 'all', 'B1');
      expect(result.seen.has(scope.id)).toBe(true);
      if (id === scope.id) for (const other of scope.overlappingIds) expect(result.seen.has(other)).toBe(true);
      const foreign = corpusPracticeHistory([{ ...saved, profileId: 'another' }], [], profile, 'listening', 'all', 'B1');
      expect(foreign.seen.has(scope.id)).toBe(false);
    }
  }
});
