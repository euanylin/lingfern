import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, it, vi } from 'vitest';
import fc from 'fast-check';
import design from './fixtures/stated-outcome-design.json';
import { corpusOutcome } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory, outcomePrompt } from '../src/core/corpusPractice';
import { spokenCorpusLesson, spokenCorpusSchema, type SpokenCorpus } from '../src/core/spokenCorpus';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';
import { advance, attempts, claimSession, communityPacks, createSession, db, exposures, markExposure, recordPlayback, sessions, submit, type Attempt, type Session } from '../src/data/db';
import { communityCacheName, communityMarker } from '../src/data/communityInstall';
import { exportBackup, inspectBackup } from '../src/data/backup';

const operation = 'choice:stated-outcome';
const sha = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
const packed = new Map<string, SpokenCorpus>();
for (const entry of design.positive) {
  const path = 'public' + entry.package.path;
  if (!packed.has(path)) {
    const bytes = readFileSync('tests/fixtures/source-packs/' + entry.package.id + '.zip');
    expect(sha(bytes)).toBe(entry.package.sha256);
    const members = unzipSync(bytes), member = members['spoken.json'];
    expect(member.length).toBe(entry.package.spokenMember.bytes); expect(sha(member)).toBe(entry.package.spokenMember.sha256);
    const parsed = { ...JSON.parse(new TextDecoder().decode(member)), communityPackageId: sha(bytes) } as SpokenCorpus;
    for (const source of parsed.records) for (const clip of source.clips) clip.audio.src = `/audio/community-${parsed.communityPackageId}/${clip.audio.src.split('/').at(-1)}`;
    packed.set(path, spokenCorpusSchema.parse(parsed));
  }
}
const banks = design.positive.map(entry => {
  const bank = packed.get('public' + entry.package.path)!;
  return { ...bank, records: bank.records.filter(source => source.rootId === entry.rootId)
    .map(source => ({ ...source, clips: source.clips.filter(clip => clip.id === entry.completeClip.id) })) };
});
const generated = (seed = 0, point: 'B1' | 'B2' | 'C1' | 'C2' = 'B2') => spokenCorpusLesson(banks[0], new Set(), seed, 91, point, [], 'choice', [], operation, banks.slice(1))!;

it('extracts three exact retained packed statements, keeping every qualifier, full chain and source option', () => {
  for (const entry of design.positive) {
    const source = packed.get('public' + entry.package.path)!.records.find(source => source.rootId === entry.rootId)!;
    const clip = source.clips.find(clip => clip.id === entry.completeClip.id)!;
    expect(source.sourceHash).toBe(entry.sourceHash); expect(clip.text).toBe(entry.completeClip.text);
    expect(sha(clip.text)).toBe(entry.completeClip.textSha256); expect(clip.qualityFlags).toEqual([]);
    const members = unzipSync(readFileSync('tests/fixtures/source-packs/' + entry.package.id + '.zip'));
    expect(sha(members[entry.package.audioMember.name])).toBe(entry.package.audioMember.sha256);
    expect(clip.audio.sha256).toBe(entry.package.audioMember.sha256);
    for (let seed = 0; seed < 12; seed++) {
      const task = corpusOutcome(clip.text, seed)!;
      expect(task).toEqual(corpusOutcome(clip.text, seed)); expect(task.prompt).toBe(outcomePrompt);
      expect(task.sentence).toBe(entry.target.sentence);
      expect(task.evidence).toEqual({ start: entry.target.start, end: entry.target.end });
      expect(clip.text.slice(task.evidence.start, task.evidence.end)).toBe(task.sentence);
      const cue = `, ${entry.target.marker} `;
      const [before, after] = task.sentence.split(cue);
      expect(task.options[task.answer]).toBe(before + (entry.target.marker === 'leading to' ? ', resulting in ' : ', leading to ') + after);
      expect(task.options.filter((_option, index) => index !== task.answer).sort()).toEqual([before + ', resulting from ' + after, before + ', not resulting in ' + after].sort());
      expect(task.additionalEvidence).toBeUndefined(); expect(new Set(task.options).size).toBe(3);
      expect(task.options.every(option => option.startsWith(before) && option.endsWith(after))).toBe(true);
    }
  }
});

it('requires the full inspected two-sentence civilization anchor and keeps prospective History audio withheld', () => {
  const history = design.historyProspective, scope = history.preparedScope, target = history.target;
  expect(sha(scope.text)).toBe(scope.textSha256); expect(scope.text.split(/\s+/)).toHaveLength(73);
  expect(history.admission.current814PackedClip).toBe(false); expect(scope.preparedAudioCreated).toBe(false);
  expect(history.longExistingCandidate.wordCount).toBe(391); expect(history.longExistingCandidate.duration).toBeGreaterThan(91);
  for (const text of [scope.text, history.longExistingCandidate.text]) {
    const task = corpusOutcome(text, 0)!; expect(task.sentence).toBe(target.sentence);
    expect(task.additionalEvidence).toEqual([{ start: target.additionalEvidence.start, end: target.additionalEvidence.end }]);
    expect(text.slice(task.additionalEvidence![0].start, task.additionalEvidence![0].end)).toBe(target.additionalEvidence.quote);
    expect(task.options[task.answer]).toContain('surplus food allowed these civilizations to support larger populations, resulting in');
  }
  for (const text of [target.sentence, scope.text.slice(scope.text.indexOf('The new social')), scope.text.replace('first major civilizations', 'ancient writings'),
    scope.text.replace('Historians studying', 'If historians studying'), scope.text.replace('examine', 'might examine'),
    scope.text.replace('Historians studying', '“Historians studying').replace('in some regions.', 'in some regions.”'),
    scope.text.replace('The new social, economic, and political complexities necessitated the development of writing systems.', 'A writer mentioned civilizations.'),
    scope.text.replace('Thanks to advancements', 'A separate unrelated event occurred. Thanks to advancements')]) expect(corpusOutcome(text, 0)).toBeUndefined();
});

it('rejects real theoretical, quoted, conditional and physical-route examples without clearing their source gates', () => {
  for (const entry of design.negative) expect(corpusOutcome(entry.completeClip.text, 0)).toBeUndefined();
  const physical = 'At the end of the room there was a little staircase, leading to a darkened chamber.';
  const gradations = 'I have been surprised to find how very generally gradations, leading to the most complex instincts, can be discovered.';
  const theory = 'It may not be a logical deduction, but to my imagination it is satisfactory to look at instincts as consequences of one general law, leading to the advancement of all organic beings.';
  for (const text of [physical, gradations, theory]) expect(corpusOutcome(text, 0)).toBeUndefined();
  const good = design.positive[0].target.sentence;
  const mutations = [good.replace('soon spread', 'might soon spread'), 'If the discovery was announced, ' + good,
    good.replace('soon spread', 'never spread'), good.replace('soon spread', 'did not spread'), `“${good}”`, `"${good}"`,
    'The historian said, “' + good, good + ' ' + good, good.slice(0, -1), good + '.',
    good.replace('News of the discovery', 'It'), good.replace('the discovery', 'this discovery'), good.replace('the discovery', 'their discovery'),
    good.replace('abroad.', 'abroad, leading to the partial destruction of Lisbon.'), good.replace('resulting in', 'resulting from'),
    good.replace('people coming', 'people might be coming'), good.replace('soon spread', 'said that news spread'),
    good.replace('soon spread', 'has spread'), good.replace('soon spread', 'spreads'), good.replace('300,000', 'perhaps 300,000'),
    good.replace('abroad.', 'abroad?'), good.replace('abroad.', 'abroad; the claim was disputed.'),
    good.replace('the discovery', 'the supposed discovery'), good.replace('resulting in', 'possibly resulting in')];
  for (const text of mutations) for (const seed of [0, 1, 2]) expect(corpusOutcome(text, seed)).toBeUndefined();
  for (const seed of [-1, .5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusOutcome(good, seed)).toThrow('INVALID_CORPUS_OUTCOME');
  expect(() => corpusOutcome('a'.repeat(12001), 0)).toThrow('INVALID_CORPUS_OUTCOME');
});

it('uses the same operation across distinct real listening roots and Test snapshots with exact scoring', () => {
  const roots = new Set<string>();
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 9; seed++) {
    const lesson = generated(seed, point); expect(lesson).toBeDefined(); lessonSchema.parse(lesson);
    const tested = asTestLesson(lesson); expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
    expect(tested.nextStep).toBeUndefined(); expect(lesson.teaching!.en).not.toContain('action that follows');
    expect(lesson.materials[0].rootId).not.toBe(lesson.materials[1].rootId);
    for (const [index, material] of lesson.materials.entries()) {
      roots.add(material.rootId); const question = material.questions[0], testQuestion = tested.materials[index].questions[0];
      if ('kind' in question || 'kind' in testQuestion) throw Error('Expected shared choice');
      expect(corpusOperation(question)).toBe(operation); expect(question.prompt).toBe(outcomePrompt);
      expect(question.prompt).not.toContain(material.blocks[0].text); expect(question.id.length).toBeLessThanOrEqual(80);
      expect(testQuestion.options).toEqual(question.options); expect(testQuestion.answer).toBe(question.answer);
      expect(testQuestion.evidence).toEqual(question.evidence); expect(tested.materials[index].blocks).toEqual(material.blocks);
      expect(tested.materials[index].audio).toEqual(material.audio); expect(testQuestion.hints).toBeUndefined();
      for (let answer = 0; answer < question.options.length; answer++) {
        expect(score(question, answer).correct).toBe(answer === question.answer); expect(score(testQuestion, answer)).toEqual(score(question, answer));
      }
      expect(score(material.questions[1], 'The source states a development and its result.').correct).toBeNull();
      expect(tested.materials[index].questions[1].hints).toBeUndefined();
    }
  }
  expect(roots.size).toBeGreaterThanOrEqual(2);
  for (const point of ['A1', 'A2'] as const) expect(spokenCorpusLesson(banks[0], new Set(), 0, 91, point, [], 'choice', [], operation, banks.slice(1))).toBeUndefined();
  expect(spokenCorpusLesson(banks[0], new Set(design.positive.map(entry => entry.completeClip.id)), 0, 91, 'B2', [], 'choice', [], operation, banks.slice(1))).toBeUndefined();
});

it('only recommends saved outcome focus in non-beginner listening while preserving history bytes', () => {
  const lesson = generated(), startedAt = new Date(Date.now() - 100000).toISOString(), submittedAt = new Date(Date.now() - 50000).toISOString();
  const session: Session = { id: 'outcome-history', profileId: 'isolated-outcome-history', lesson, contentHash: 'a'.repeat(64), position: 3, status: 'completed', startedAt, assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(material => {
    const question = material.questions[0]; if ('kind' in question) throw Error('Expected choice');
    const answer = (question.answer + 1) % 3;
    return { id: `${session.id}:${question.id}`, sessionId: session.id, profileId: session.profileId, questionId: question.id, rootId: material.rootId,
      answer, ...score(question, answer), assistance: { hintLevel: 0, audioCompleted: true }, submittedAt };
  });
  const snapshot = JSON.stringify({ session, records });
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) for (const skill of ['reading', 'listening'] as const) {
    const route = corpusPracticeHistory([session], records, session.profileId, skill, 'all', point);
    if (skill === 'listening' && point !== 'A1' && point !== 'A2') expect(route.focus).toMatchObject({ kind: 'choice', operation, reason: 'reteach' });
    else expect(route.focus).toBeUndefined();
    expect(JSON.stringify({ session, records })).toBe(snapshot);
  }
});

it('keeps ordinary tasks available when effort, seen roots or flagged partners cannot supply outcome transfer', () => {
  const lisbon = design.positive.find(entry => entry.rootId === 'wikipedia-article-352339')!;
  const primary = packed.get('public' + lisbon.package.path)!;
  const foreign = banks.filter(bank => !bank.records.some(source => source.rootId === lisbon.rootId));
  const scenarios = [
    { max: 35, seen: new Set<string>(), foreign },
    { max: 91, seen: new Set(foreign.flatMap(bank => bank.records.flatMap(source => source.clips.map(clip => clip.id)))), foreign },
    { max: 91, seen: new Set<string>(), foreign: foreign.map(bank => ({ ...bank, records: bank.records.map(source => ({ ...source, clips: source.clips.map(clip => ({ ...clip, qualityFlags: ['Isolated quality-gate mutation'] })) })) })) },
  ];
  for (const scenario of scenarios) {
    expect(spokenCorpusLesson(primary, scenario.seen, 0, scenario.max, 'B1', [], 'choice', [], operation, scenario.foreign)).toBeUndefined();
    let ordinary = 0;
    for (let seed = 0; seed < 20; seed++) {
      const lesson = spokenCorpusLesson(primary, scenario.seen, seed, scenario.max, 'B1', [], undefined, [], undefined, scenario.foreign);
      if (lesson) { ordinary++; expect(corpusOperation(lesson.materials[0].questions[0])).not.toBe(operation); }
    }
    expect(ordinary).toBeGreaterThan(0);
  }
  const ordinaryRoots = new Set<string>();
  for (let seed = 0; seed < 10; seed++) {
    const lesson = spokenCorpusLesson(banks[0], new Set(), seed, 91, 'B2', [], undefined, [], undefined, banks.slice(1));
    if (corpusOperation(lesson?.materials[0].questions[0]) === operation) {
      expect(lesson!.materials.every(material => corpusOperation(material.questions[0]) === operation)).toBe(true);
      lesson!.materials.forEach(material => ordinaryRoots.add(material.rootId));
    }
  }
  expect(ordinaryRoots.size).toBeGreaterThanOrEqual(2);
});

it('keeps full history-pack primary phases identical when installed outcome partners are added', () => {
  const gold = design.positive.find(entry => entry.rootId === 'wikipedia-article-58296')!;
  const primary = packed.get('public' + gold.package.path)!;
  const partners = banks.filter(bank => !bank.records.some(source => source.rootId === gold.rootId));
  expect(primary.records.length).toBeGreaterThan(1);
  expect([...new Set(primary.records.filter(source => source.clips.some(clip => !clip.qualityFlags.length && corpusOutcome(clip.text, 0))).map(source => source.rootId))]).toEqual([gold.rootId]);
  // Actual installed-audit regression: Adelaide table 4ee7a699...18319c5 replaced Cupcake completion 893da712...ac5ad.
  // The original log omitted its seed; cover every exact dispersed audit seed rather than inventing one.
  const seeds = Array.from({ length: 13 }, (_unused, index) => Math.imul(index + 1, 0x9e3779b1) >>> 0);
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) {
    const maxSeconds = corpusPracticeHistory([], [], 'isolated-history-phases', 'listening', 'all', point).maxSeconds;
    expect(spokenCorpusLesson(primary, new Set(), seeds[0], maxSeconds, point, [], 'choice', [], operation)).toBeUndefined();
    for (const seed of seeds) {
      const scope = `${point} seed ${seed} maxSeconds ${maxSeconds}`;
      const single = spokenCorpusLesson(primary, new Set(), seed, maxSeconds, point);
      const installed = spokenCorpusLesson(primary, new Set(), seed, maxSeconds, point, [], undefined, [], undefined, partners);
      expect(single, scope + ': ordinary single-pack entry remains available').toBeDefined();
      expect(installed, scope + ': installed application entry remains available').toBeDefined();
      expect(corpusOperation(single!.materials[0].questions[0]), scope + ': no single-root outcome').not.toBe(operation);
      const material = installed!.materials[0];
      if (corpusOperation(material.questions[0]) !== operation) {
        expect(material, scope + ': application installation must not rephase primary').toEqual(single!.materials[0]);
        continue;
      }
      expect(installed!.materials).toHaveLength(2);
      expect(new Set(installed!.materials.map(item => item.rootId)).size, scope).toBe(2);
      expect(installed!.materials.every(item => corpusOperation(item.questions[0]) === operation), scope).toBe(true);
      const source = primary.records.find(source => source.rootId === material.rootId)!;
      expect(source, scope + ': primary remains in its original complete package').toBeDefined();
      const clip = source.clips.find(clip => `corpus-${clip.id}` === material.id)!;
      expect(clip, scope + ': primary retains exact original clip').toBeDefined();
      expect(material.blocks[0].text, scope).toBe(clip.text); expect(material.audio, scope).toEqual(clip.audio);
      expect(material.sourceId, scope).toBe(source.id); expect(material.credit, scope).toEqual(clip.credit);
      expect(material.communityPackageId ?? installed!.communityPackageId, scope).toBe(primary.communityPackageId);
      const application = installed!.materials[1], owner = partners.find(bank => bank.records.some(source => source.rootId === application.rootId))!;
      expect(application.communityPackageId ?? installed!.communityPackageId, scope).toBe(owner.communityPackageId);
      expect(application.audio!.src, scope).toContain(`/audio/community-${owner.communityPackageId}/`);
      expect(application.blocks[0].text, scope).toBe(owner.records.find(source => source.rootId === application.rootId)!.clips[0].text);
    }
  }
  // Default B1's 35-second effort bound cannot admit the history pack's sole 55.43-second outcome clip.
  // Its existing independent-application upper bound is 60 seconds; the other points use default effort bounds.
  // B1 below is a pure effort-bound test, not a default UI route, a real profile achievement or CEFR acceptance.
  for (const [point, maxSeconds] of [['B1', 60], ['B2', 60], ['C1', 75], ['C2', 91]] as const) {
    let reached = false;
    for (let index = 0; index < 512; index++) {
      const seed = Math.imul(index + 1, 0x9e3779b1) >>> 0;
      const lesson = spokenCorpusLesson(primary, new Set(), seed, maxSeconds, point, [], undefined, [], undefined, partners);
      if (corpusOperation(lesson?.materials[0].questions[0]) !== operation) continue;
      const scope = `${point} seed ${seed} maxSeconds ${maxSeconds}`;
      expect(lesson!.materials).toHaveLength(2);
      expect(new Set(lesson!.materials.map(material => material.rootId)).size, scope).toBe(2);
      expect(lesson!.materials.every(material => corpusOperation(material.questions[0]) === operation), scope).toBe(true);
      for (const [position, material] of lesson!.materials.entries()) {
        const owner = position === 0 ? primary : partners.find(bank => bank.records.some(source => source.rootId === material.rootId))!;
        const source = owner.records.find(source => source.rootId === material.rootId)!;
        const clip = source.clips.find(clip => `corpus-${clip.id}` === material.id)!;
        expect(material.blocks[0].text, scope).toBe(clip.text); expect(material.audio, scope).toEqual(clip.audio);
        expect(material.sourceId, scope).toBe(source.id); expect(material.credit, scope).toEqual(clip.credit);
        expect(material.communityPackageId ?? lesson!.communityPackageId, scope).toBe(owner.communityPackageId);
      }
      reached = true; break;
    }
    expect(reached, `${point} ordinary outcome must be reachable within 512 dispersed seeds at ${maxSeconds}s`).toBe(true);
  }
});

it('saves actual Practice/Test choices and unscored explanations before advancing and preserves bounded backup references', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  const files = new Map<string, Map<string, Response>>();
  const cacheApi = { has: async (name: string) => files.has(name), open: async (name: string) => ({ match: async (path: string) => files.get(name)?.get(path)?.clone() }) };
  vi.stubGlobal('window', { caches: cacheApi }); vi.stubGlobal('caches', cacheApi);
  try {
    const practice = generated();
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profileId = `outcome-db-${lesson.mode ?? 'practice'}`;
      for (const [path, bank] of packed) {
        const entry = design.positive.find(entry => 'public' + entry.package.path === path);
        if (!entry) continue;
        const hash = bank.communityPackageId!, members = unzipSync(readFileSync('tests/fixtures/source-packs/' + entry.package.id + '.zip'));
        await communityPacks.put({ id: entry.package.id, hash, profileId, lessons: [], sources: [], spoken: bank, state: 'ready', installedAt: new Date().toISOString() });
        const cached = new Map([[communityMarker(hash), new Response('ready')]]);
        for (const material of lesson.materials) if ((material.communityPackageId ?? lesson.communityPackageId) === hash) {
          const member = members['media/' + material.audio!.src.split('/').at(-1)!];
          cached.set(material.audio!.src, new Response(new Uint8Array(member), { headers: { 'Content-Type': 'audio/mpeg' } }));
        }
        files.set(communityCacheName(hash), cached);
      }
      const session = await createSession(lesson, profileId);
      let current: Session = await claimSession(session.id, 'outcome-owner');
      for (const [position, { material, question }] of questions(lesson).entries()) {
        expect(current.position).toBe(position); await markExposure(current);
        expect(question.id.length).toBeLessThanOrEqual(80);
        expect((await exposures.get([profileId, material.rootId]))!.contacts).toContainEqual(expect.objectContaining({ questionId: question.id, variantGroup: question.id }));
        // Exercise the real playback-completion transaction; this simulated event is not auditory acceptance.
        if (!current.assistance.audioCompleted) {
          await expect(submit(session.id, 'outcome-owner', 'kind' in question ? 'A response.' : question.answer)).rejects.toThrow('NO_AUDIO');
          await recordPlayback(session.id, 'outcome-owner', question.id, false);
          await recordPlayback(session.id, 'outcome-owner', question.id, true);
        }
        const saved = await submit(session.id, 'outcome-owner', 'kind' in question ? 'The complete development is followed by its stated result.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true); expect(await attempts.get(saved.id)).toEqual(saved);
        expect((await sessions.get(session.id))!.position).toBe(position); current = await advance(session.id, 'outcome-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed');
      const backup = await inspectBackup(await exportBackup(profileId)); expect(backup.records.sessions[0].lesson).toEqual(lesson);
      expect(backup.records.attempts.filter(record => record.correct === null)).toHaveLength(2); expect(backup.records.exposures).toHaveLength(2);
    }
  } finally { vi.unstubAllGlobals(); await Promise.all(db.tables.map(table => table.clear())); }
});

it('deterministically rotates exactly three complete paraphrases for arbitrary seeds without broadening source frames', () => {
  fc.assert(fc.property(fc.constantFrom(...design.positive), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (entry, seed) => {
    const task = corpusOutcome(entry.completeClip.text, seed)!; expect(task).toEqual(corpusOutcome(entry.completeClip.text, seed));
    expect(task.options).toHaveLength(3); expect(new Set(task.options).size).toBe(3);
    expect(entry.completeClip.text.slice(task.evidence.start, task.evidence.end)).toBe(entry.target.sentence);
    expect(task.options[task.answer]).not.toContain('resulting from'); expect(task.options[task.answer]).not.toContain('not resulting');
  }), { numRuns: 100 });
});
