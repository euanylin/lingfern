import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { corpusLesson, corpusSchema, corpusStatedIntention } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { asTestLesson, questions, score } from '../src/shared/content';
import { db, createSession, claimSession, markExposure, submit, advance, sessions, attempts, type Session, type Attempt } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const roots = ['voa-article-3225958', 'voa-article-3126527', 'voa-article-3431138'];
const bank = { ...corpus, records: corpus.records.filter(record => roots.includes(record.rootId)).map(record => ({ ...record, passages: record.passages.slice(0, 1) })) };
const source = bank.records.find(record => record.rootId === roots[2])!, passage = source.passages[0];
const operation = 'choice:stated-intention';

it('keeps the actual Jean museum wish in a complete A2 window with the correct speaker and unchanged source', () => {
  const source = corpus.records.find(record => record.rootId === 'voa-article-3753664')!;
  const passage = source.passages.find(part => part.id === '60f0fd68abda60479c1d748763f09cccd5bfa10af2c23e1f20aca4f2f118dc85')!;
  expect(source.sourceHash).toBe('d9e8bbafd40f8d2ed9a4e81856883bde3d029a0ab03a0cf0cce44bbcafcf008d');
  expect(sha(source.originalText!)).toBe(source.sourceHash);
  expect(passage.text).toBe(source.originalText!.slice(623, 1031));
  expect(passage.wordCount).toBe(73); expect(passage.startingPoints).toEqual(['A2']);
  for (let seed = 0; seed < 12; seed++) {
    const task = corpusStatedIntention(passage.text, seed)!;
    expect(task.name).toBe('Jean'); expect(task.action).toBe('see an unusual museum');
    expect(task.evidence).toEqual({ start: 197, end: 229 }); expect(task.otherEvidence).toEqual({ start: 191, end: 229 });
    expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe('I want to see an unusual museum.');
    expect(task.options[task.answer]).toBe('Jean wants to do it.');
  }
  for (const text of [
    passage.text.replace('Jean: I want to', 'I want to'),
    passage.text.replace('I want to see', 'If I want to see'),
    passage.text.replace('I want to see', 'I do not want to see'),
    passage.text + '\n\nJean: But I changed my mind.',
  ]) expect(corpusStatedIntention(text, 0)).toBeUndefined();
});

it('transfers the same intention operation to a genuinely different speaker without widening A1 or Test assistance', () => {
  const jean = corpus.records.find(record => record.rootId === 'voa-article-3753664')!;
  const mixed = { ...bank, records: [...bank.records, { ...jean, passages: jean.passages.filter(part => part.startingPoints) }] };
  const positions = new Set<number>();
  for (let seed = 0; seed < 48; seed++) {
    const lesson = corpusLesson(mixed, new Set(), seed, 160, 'A2', [], 'choice', [], operation)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const test = asTestLesson(lesson);
    lesson.materials.forEach((material, index) => {
      const question = material.questions[0], tested = test.materials[index].questions[0];
      if ('kind' in question || 'kind' in tested) throw Error('Expected existing intention choice');
      expect(corpusOperation(question)).toBe(operation); expect(tested.hints).toBeUndefined();
      for (let answer = 0; answer < 3; answer++) expect(score(tested, answer)).toEqual(score(question, answer));
      if (material.rootId === jean.rootId) { positions.add(index); expect(question.options[question.answer]).toBe('Jean wants to do it.'); }
    });
    expect(corpusLesson(mixed, new Set(), seed, 120, 'A1', [], 'choice', [], operation)!.materials.every(material => material.rootId !== jean.rootId)).toBe(true);
  }
  expect([...positions].sort()).toEqual([0, 1]);
  expect(corpusLesson(mixed, new Set(jean.passages.map(part => part.id)), 0, 160, 'A2', [], 'choice', [], operation)!.materials.every(material => material.rootId !== jean.rootId)).toBe(true);
});

it('retains the complete official source and an unchanged A2-only77word prefix with precise scoped evidence', () => {
  expect(sha(source.originalText!)).toBe('47114abbfd115fff3430e7f689f620b5558f4f9d656e7ea0146f87a27fe00693');
  expect(source.sourceHash).toBe(sha(source.originalText!)); expect(source.originalText!.startsWith(passage.text)).toBe(true);
  expect(passage.id).toBe('4f5109de3a942b5ca813f757f8969ed524eecd007d2dd9d5eef14d2d15dd2534');
  expect(passage.startingPoints).toEqual(['A2']); expect(passage.wordCount).toBe(77);
  expect(corpusStatedIntention(source.originalText!, 0)).toBeUndefined();
  const permutations = new Set<string>();
  for (let seed = 0; seed < 6; seed++) {
    const task = corpusStatedIntention(passage.text, seed)!;
    expect(task.evidence).toEqual({ start: 199, end: 231 }); expect(task.otherEvidence).toEqual({ start: 193, end: 231 });
    expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe('I want to learn more about them.');
    expect(task.prompt).toBe('What does “I want to” mean here?\nAnna: “learn more about them”');
    expect(task.options[task.answer]).toBe('Anna wants to do it.'); permutations.add(task.options.join('|'));
  }
  expect(permutations.size).toBe(6);
});

it('generates genuine third-root application without adding it to A1 and keeps exact Practice/Test answers and source evidence', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 48; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 160, 'A2', [], 'choice', [], operation)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const test = asTestLesson(lesson);
    lesson.materials.forEach((material, index) => {
      seen.add(material.rootId); const question = material.questions[0], tested = test.materials[index].questions[0];
      if ('kind' in question || 'kind' in tested) throw Error('Expected intention choice');
      expect(corpusOperation(question)).toBe(operation); expect(tested.options).toEqual(question.options);
      expect(tested.evidence).toEqual(question.evidence); expect(tested.additionalEvidence).toEqual(question.additionalEvidence);
      expect(tested.hints).toBeUndefined();
      for (let answer = 0; answer < 3; answer++) expect(score(tested, answer)).toEqual(score(question, answer));
      expect(score(material.questions[1], 'The source reports a wish.').correct).toBeNull();
    });
    const beginner = corpusLesson(bank, new Set(), seed, 120, 'A1', [], 'choice', [], operation)!;
    expect(beginner.materials.every(material => material.rootId !== roots[2])).toBe(true);
  }
  expect([...seen].sort()).toEqual([...roots].sort());
  expect(corpusLesson(bank, new Set(bank.records.flatMap(record => record.passages.map(part => part.id))), 0, 160, 'A2', [], 'choice', [], operation)).toBeUndefined();
});

it('retains the two-unfamiliar-application-root gate and rejects prior exposure, help and a failed new-root answer', () => {
  const materials = new Map<string, Session['lesson']['materials'][number]>();
  let template: Session['lesson'] | undefined;
  for (let seed = 0; seed < 24; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 160, 'A2', [], 'choice', [], operation)!; template = lesson;
    for (const material of lesson.materials) materials.set(material.rootId, material);
  }
  const now = Date.now(), profileId = 'third-root-history';
  const history: Session[] = [roots[0], roots[2]].map((root, index) => ({ id: `third-${index}`, profileId,
    lesson: { ...template!, materials: [materials.get(roots[1])!, materials.get(root)!] }, contentHash: 'a'.repeat(64), position: 3,
    status: 'completed', startedAt: new Date(now - (3 - index) * 60000).toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 }));
  const records: Attempt[] = history.flatMap(session => session.lesson.materials.map(material => {
    const question = material.questions[0]; if ('kind' in question) throw Error('Expected intention choice');
    return { id: `${session.id}:${question.id}`, sessionId: session.id, profileId, rootId: material.rootId, questionId: question.id,
      answer: question.answer, ...score(question, question.answer), submittedAt: new Date(Date.parse(session.startedAt) + 10000).toISOString(), assistance: { hintLevel: 0 } };
  }));
  const route = (sessions: Session[], answers = records) => corpusPracticeHistory(sessions, answers, profileId, 'reading', 'all', 'A2');
  expect(route(history).independent).toBe(true);
  expect(route(history.slice(0, 1)).independent).toBe(false);
  const prior = { ...history[0], id: 'prior-new-root', status: 'active' as const, startedAt: new Date(now - 300000).toISOString(), lesson: history[1].lesson };
  expect(route([prior, ...history]).independent).toBe(false);
  expect(route(history, records.map(record => record.rootId === roots[2] ? { ...record, assistance: { hintLevel: 1 } } : record)).independent).toBe(false);
  expect(route(history, records.map(record => record.rootId === roots[2] ? { ...record, correct: false } : record)).independent).toBe(false);
});

it('saves and restores actual third-root Practice/Test snapshots and unscored responses transactionally', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = Array.from({ length: 48 }, (_, seed) => corpusLesson(bank, new Set(), seed, 160, 'A2', [], 'choice', [], operation)!)
      .find(lesson => lesson.materials[1].rootId === roots[2])!;
    expect(practice).toBeDefined();
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profileId = `third-root-${lesson.mode ?? 'practice'}`, created = await createSession(lesson, profileId);
      let current: Session = await claimSession(created.id, 'third-owner');
      for (const { question } of questions(lesson)) {
        await markExposure(current);
        const saved = await submit(current.id, 'third-owner', 'kind' in question ? 'I quote the stated wish.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true); expect(await attempts.get(saved.id)).toEqual(saved);
        current = await advance(current.id, 'third-owner');
      }
      expect((await sessions.get(current.id))!.status).toBe('completed');
      const restored = await inspectBackup(await exportBackup(profileId));
      expect(restored.records.sessions[0].lesson).toEqual(lesson); expect(restored.records.attempts).toHaveLength(4);
      expect(restored.records.exposures).toHaveLength(2);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
