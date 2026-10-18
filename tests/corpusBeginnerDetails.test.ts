import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusSchema, corpusQuantity, corpusVerification } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';
import { exposureQuestionIdSchema } from '../src/shared/exposure';
import scopes from '../content/corpus/beginner-meaning-scopes.json';
const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

it.each(['quantity', 'verification'] as const)('generates exact native %s meaning, same-goal independent application and source-preserving snapshots', family => {
  const operation = family === 'quantity' ? 'choice:small-quantity' : 'choice:detail-verification';
  const meanings = new Set<string>();
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = corpusLesson(bank, new Set(), seed, 120, 'A1', [], 'choice', [], operation)!;
    expect(lesson).toBeDefined(); expect(lesson.targetLevel).toBe('A1'); expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    expect(lesson).toEqual(corpusLesson(bank, new Set(), seed, 120, 'A1', [], 'choice', [], operation));
    expect(lesson.materials.map(m => m.rootId).sort()).toEqual(scopes[family].map(s => s.rootId).sort());
    for (const [index, material] of lesson.materials.entries()) {
      const scope = scopes[family].find(s => s.rootId === material.rootId)!;
      const parent = bank.records.find(r => r.rootId === material.rootId)!.passages.find(p => p.id === scope.passageId)!;
      const text = material.blocks[0].text;
      const projected = family === 'quantity' ? scopes.quantity.find(s => s.rootId === material.rootId) : undefined;
      expect(text).toBe(projected?.end === undefined ? parent.text : parent.text.slice(0, projected.end));
      expect(material.id).toBe('corpus-' + sha(text));
      if (projected?.end !== undefined) { expect(text).not.toContain('what are those'); expect(text.endsWith('I can return the books here.')).toBe(true); expect(parent.text).toContain('what are those'); }
      expect(material.questions).toHaveLength(1); const q = material.questions[0]; if ('kind' in q) throw new Error('Expected choice');
      expect(corpusOperation(q)).toBe(operation); expect(exposureQuestionIdSchema.safeParse(q.id).success).toBe(true);
      expect(q.hints?.length).toBe(index ? undefined : 3); expect(text.slice(q.evidence.start, q.evidence.end).length).toBeGreaterThan(20);
      const correct = family === 'quantity' ? material.rootId === 'voa-article-3111026' ? '2' : '3' : q.prompt.includes('A-N-N-A.') || q.prompt.includes('555-8986.') ? 'Yes' : 'No';
      expect(q.options[q.answer]).toBe(correct); meanings.add(material.rootId + ':' + correct);
      expect(score(q, q.answer).correct).toBe(true); expect(score(q, 1 - q.answer).correct).toBe(false);
      for (const bad of [-1, 2, 'Yes']) expect(() => score(q, bad)).toThrow();
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(lesson.teaching![locale].length).toBeGreaterThan(30); expect(lesson.workedExample![locale]).not.toContain('Anna');
        expect(q.explanations[q.answer][locale].length).toBeGreaterThan(20); expect(q.explanations[1 - q.answer][locale].length).toBeGreaterThan(20);
      }
    }
    const expected = structuredClone(lesson.materials); expected.forEach(m => m.questions.forEach(q => delete q.hints));
    expect(asTestLesson(lesson).materials).toEqual(expected); expect(asTestLesson(lesson).workedExample).toBeUndefined();
  }), { numRuns: 500 });
  expect(meanings.size).toBe(family === 'quantity' ? 2 : 4);
  const one = { ...bank, records: bank.records.filter(r => r.rootId === scopes[family][0].rootId) };
  expect(corpusLesson(one, new Set(), 0, 120, 'A1', [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(bank.records.flatMap(r => r.passages.map(p => p.id))), 0, 120, 'A1', [], 'choice', [], operation)).toBeUndefined();
});

it('rejects unsupported, inconsistent or insufficient numeric/correction evidence and altered admitted text', async () => {
  const welcome = bank.records.find(r => r.rootId === 'voa-article-3111026')!.passages.find(p => p.startingPoints?.includes('A1'))!.text;
  for (const text of [welcome.replace('two "n\'s"', 'three "n\'s"'), welcome.replace('A-N-N-A', 'A-N-A'), 'Anna: I do not need to return three books to the library.', 'Anna: I need to return twenty books to the library.']) expect(corpusQuantity(text, 0)).toBeUndefined();
  for (const text of [welcome.replace('Anna: No. A-N-N-A', 'Anna: Maybe A-N-N-A'), 'Marsha’s work number might be 555-8986.']) expect(corpusVerification(text, 0)).toBeUndefined();
  expect(() => corpusQuantity('', -1)).toThrow(); expect(() => corpusVerification('', -1)).toThrow();
  const { reviewedReading } = await import('../src/data/corpus');
  for (const scope of [...scopes.quantity, ...scopes.verification]) {
    const source = bank.records.find(r => r.rootId === scope.rootId)!;
    await expect(reviewedReading([{ ...source, passages: source.passages.map(p => p.id === scope.passageId ? { ...p, text: p.text + '\nChanged.' } : p) }])).rejects.toThrow('CORPUS_INTEGRITY');
  }
});

it('saves and recovers both detail operations through actual exposure and answer transactions in Practice/Test', async () => {
  const { db, createSession, claimSession, sessions, markExposure, submit, advance, attempts } = await import('../src/data/db');
  const { exportBackup, inspectBackup } = await import('../src/data/backup');
  try {
    for (const operation of ['choice:small-quantity', 'choice:detail-verification']) {
      const practice = corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'choice', [], operation)!;
      for (const lesson of [practice, asTestLesson(practice)]) {
        const profile = operation.replace(':', '-') + (lesson.mode ?? 'practice'), session = await createSession(lesson, profile); await claimSession(session.id, 'detail-owner');
        for (const material of lesson.materials) {
          const q = material.questions[0]; if ('kind' in q) throw new Error('Expected choice');
          await markExposure((await sessions.get(session.id))!); const saved = await submit(session.id, 'detail-owner', q.answer);
          expect(await attempts.get(saved.id)).toEqual(saved); expect(saved.correct).toBe(true);
          if (material.rootId !== lesson.materials[0].rootId || lesson.mode) expect(saved.assistance.teachingProvided).toBeUndefined();
          await advance(session.id, 'detail-owner');
        }
        const backup = await inspectBackup(await exportBackup(profile)); expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(2);
      }
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('reads literal clock time in two retained native contexts without substituting lunch time or inventing a period', async () => {
  const { reviewedReading } = await import('../src/data/corpus');
  const original = structuredClone(bank), runtime = { ...bank, records: await reviewedReading(bank.records, 120) };
  expect(bank).toEqual(original);
  const roots = scopes.time.map(s => s.rootId).sort();
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = corpusLesson(runtime, new Set(), seed, 120, 'A1', [], 'choice', [], 'choice:stated-time')!;
    expect(lesson).toBeDefined(); expect(lesson.materials.map(m => m.rootId).sort()).toEqual(roots);
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    lesson.materials.forEach((material, index) => {
      const q = material.questions[0]; if ('kind' in q) throw new Error('Expected clock choice');
      expect(corpusOperation(q)).toBe('choice:stated-time'); expect(exposureQuestionIdSchema.safeParse(q.id).success).toBe(true);
      expect(q.options[q.answer]).toBe(material.rootId === 'voa-article-3253185' ? '10 a.m.' : '11:50');
      if (material.rootId === 'voa-article-3413753') { const cited = q.additionalEvidence!.map(span => material.blocks[0].text.slice(span.start, span.end)); expect(cited[0]).toContain('What time is it now?'); expect(cited[1]).toContain('lunch at noon'); expect(cited[1]).toContain('Jonathan: Yes.'); }
      expect(q.hints?.length).toBe(index ? undefined : 3);
      expect(sha(material.blocks[0].text)).toBe(scopes.time.find(s => s.rootId === material.rootId)!.textSha256);
      expect(score(q, q.answer).correct).toBe(true); expect(score(q, 1 - q.answer).correct).toBe(false);
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(lesson.teaching![locale]).not.toContain('11:50'); expect(lesson.workedExample![locale]).not.toContain('11:50');
        expect(q.explanations[1 - q.answer][locale].length).toBeGreaterThan(20);
      }
    });
    const expected = structuredClone(lesson.materials); expected.forEach(m => m.questions.forEach(q => delete q.hints)); expect(asTestLesson(lesson).materials).toEqual(expected);
  }), { numRuns: 500 });
  const one = { ...runtime, records: runtime.records.filter(r => r.rootId === roots[0]) };
  expect(corpusLesson(one, new Set(), 0, 120, 'A1', [], 'choice', [], 'choice:stated-time')).toBeUndefined();
  for (const scope of scopes.time) {
    const source = bank.records.find(r => r.rootId === scope.rootId)!;
    await expect(reviewedReading([{ ...source, passages: source.passages.map(p => p.id === scope.parentId ? { ...p, text: p.text.replace('11:50', '11:05').replace('10 a.m.', '10 p.m.') } : p) }])).rejects.toThrow('CORPUS_INTEGRITY');
  }
  const { corpusTime } = await import('../src/core/corpus');
  for (const text of ['Jonathan: 11:50.', 'Anne: At 10 a.m. I might be writing.', 'Anne: Hi, Anna. Yes. At 13 a.m. I am writing. Every day I do my morning show. Sorry!']) expect(corpusTime(text, 0)).toBeUndefined();
});
