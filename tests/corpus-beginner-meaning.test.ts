import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusSchema, corpusLocation, corpusInstruction } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { exposureQuestionIdSchema } from '../src/shared/exposure';
import { asTestLesson, score } from '../src/shared/content';
import scopes from '../content/corpus/beginner-meaning-scopes.json';
const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));

it.each(['location', 'instruction'] as const)('teaches actual inspected A1 %s meaning with same-goal independent work and precise alternatives', family => {
  const operation = family === 'location' ? 'choice:stated-location' : 'choice:basic-instruction';
  const roots = scopes[family].map(scope => scope.rootId).sort();
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = corpusLesson(bank, new Set(), seed, 120, 'A1', [], 'choice', [], operation)!;
    expect(lesson).toBeDefined(); expect(lesson.targetLevel).toBe('A1');
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    expect(lesson.materials.map(m => m.rootId).sort()).toEqual(roots);
    lesson.materials.forEach((m, i) => {
      expect(m.questions).toHaveLength(1);
      const q = m.questions[0]; if ('kind' in q) throw new Error('Expected meaning choice');
      expect(corpusOperation(q)).toBe(operation);
      expect(exposureQuestionIdSchema.safeParse(q.id).success).toBe(true);
      expect(q.hints?.length).toBe(i ? undefined : 3);
      const scope = scopes[family].find(s => s.rootId === m.rootId)!;
      expect(createHash('sha256').update(m.blocks[0].text).digest('hex')).toBe(scope.textSha256);
      const evidence = m.blocks[0].text.slice(q.evidence.start, q.evidence.end);
      expect(evidence).toMatch(family === 'location' ? /across from|My apartment is near/ : /Exit the Metro|Please meet your co-workers/);
      expect(q.options).toHaveLength(2);
      expect(score(q, q.answer).correct).toBe(true);
      expect(score(q, 1 - q.answer).correct).toBe(false);
      for (const bad of [-1, 2, '1']) expect(() => score(q, bad)).toThrow();
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(q.explanations[q.answer][locale].length).toBeGreaterThan(25);
        expect(q.explanations[1 - q.answer][locale].length).toBeGreaterThan(25);
        expect(lesson.teaching![locale].length).toBeGreaterThan(60);
        expect(lesson.workedExample![locale]).not.toContain('Anna');
      }
    });
    const expected = structuredClone(lesson.materials); expected.forEach(m => m.questions.forEach(q => delete q.hints));
    expect(asTestLesson(lesson).materials).toEqual(expected);
    expect(asTestLesson(lesson).teaching).toBeUndefined();
  }), { numRuns: 500 });
  const one = { ...bank, records: bank.records.filter(r => r.rootId === roots[0]) };
  expect(corpusLesson(one, new Set(), 0, 120, 'A1', [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(bank.records.flatMap(r => r.passages.map(p => p.id))), 0, 120, 'A1', [], 'choice', [], operation)).toBeUndefined();
});

it('rejects incomplete, ambiguous and uninspected direction/location scopes rather than widening source admission', async () => {
  for (const text of ['Pete: The gym is across from the lounge. It’s next to the lounge. Go that way.', 'Pete: If it is open, the gym is across from the lounge.', 'Anna: My apartment is near the Columbia Heights Metro.', 'The gym is across from the lounge.']) expect(corpusLocation(text, 0)).toBeUndefined();
  for (const text of ['Anna: Yes. Exit the Metro and turn right.', 'Anna: Yes. Exit the Metro and turn right. Then at the bus station turn right. Then walk straight ahead.', 'Caty: Please meet your co-workers.']) expect(corpusInstruction(text, 0)).toBeUndefined();
  expect(() => corpusLocation('', -1)).toThrow(); expect(() => corpusInstruction('', -1)).toThrow();
  const { reviewedReading } = await import('../src/data/corpus');
  for (const scope of [...scopes.location, ...scopes.instruction]) {
    const source = bank.records.find(r => r.rootId === scope.rootId)!;
    const changed = { ...source, passages: source.passages.map(p => p.id === scope.passageId ? { ...p, text: p.text + '\nAltered context.' } : p) };
    await expect(reviewedReading([changed])).rejects.toThrow('CORPUS_INTEGRITY');
  }
});

it('saves generated meaning snapshots through the actual exposure, answer and backup protocol', async () => {
  const { createSession, claimSession, markExposure, sessions, submit, advance, attempts, db } = await import('../src/data/db');
  const { exportBackup, inspectBackup } = await import('../src/data/backup');
  const { questions } = await import('../src/shared/content');
  try {
    for (const operation of ['choice:stated-location', 'choice:basic-instruction']) {
      const practice = corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'choice', [], operation)!;
      for (const lesson of [practice, asTestLesson(practice)]) {
        const profile = operation.replace(':', '-') + (lesson.mode ?? 'practice'), session = await createSession(lesson, profile);
        await claimSession(session.id, 'meaning-owner');
        for (const { material, question } of questions(lesson)) {
          if ('kind' in question) throw new Error('Expected choice');
          await markExposure((await sessions.get(session.id))!);
          const saved = await submit(session.id, 'meaning-owner', question.answer);
          expect(await attempts.get(saved.id)).toEqual(saved); expect(saved.correct).toBe(true);
          expect(saved.assistance.hintLevel).toBe(0);
          if (material.rootId !== lesson.materials[0].rootId || lesson.mode) expect(saved.assistance.teachingProvided).toBeUndefined();
          await advance(session.id, 'meaning-owner');
        }
        expect((await sessions.get(session.id))?.status).toBe('completed');
        const backup = await inspectBackup(await exportBackup(profile));
        expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(2);
      }
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
