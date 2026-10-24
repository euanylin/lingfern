import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { corpusAddress, corpusLesson, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, questions, score } from '../src/shared/content';
import { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit, type Session } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
import scopes from '../content/corpus/gutenberg-beginner-scopes.json';
const operation = 'choice:requested-address', id = scopes.records[0].textSha256;
const voa = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const gutenberg = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
const source = gutenberg.records.find(record => record.rootId === 'gutenberg-book-45')!;
const passage = source.passages.find(passage => passage.id === id)!;
const bank = { version: 1 as const, failures: [], records: [voa.records.find(record => record.rootId === 'voa-article-3240468')!, { ...source, passages: [passage] }] };

it('retains the existing book, complete A2-only source window and true-name/request distinction', () => {
  expect(source.passages).toHaveLength(351); expect(source.originalText).toBeUndefined();
  expect(source.sourceHash).toBe(scopes.records[0].rawSha256);
  expect(passage.text).toBe(scopes.records[0].text); expect(passage.wordCount).toBe(129); expect(passage.startingPoints).toEqual(['A2']);
  expect(createHash('sha256').update(passage.text).digest('hex')).toBe(id);
  expect(source.passages.find(part => part.id === scopes.records[0].parentId)!.startingPoints).toBeUndefined();
  for (let seed = 0; seed < 12; seed++) {
    const task = corpusAddress(passage.text, seed)!;
    expect(task.options[task.answer]).toBe('Cordelia'); expect(task.fullName).toBe('Anne Shirley');
    expect(new Set(task.options).size).toBe(2);
    expect(task.evidence).toEqual({ start: 480, end: 720 });
    expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe(passage.text.split('\n\n').at(-1));
    expect(corpusAddress(passage.text, seed)).toEqual(task);
  }
  expect(corpusAddress(source.passages.find(part => part.id === scopes.records[0].parentId)!.text, 0)?.name).toBe('Cordelia');
});

it('rejects conflicting, hypothetical, denied, ownerless and truncated requests rather than inventing an address', () => {
  const text = passage.text;
  const invalid = [text.replace('please do call me Cordelia', 'please do call me Anne'), text.replace('Will you please call me Cordelia?', 'Will you please call me Geraldine?'),
    text.replace('please do call me', 'please do not call me'), text.replace('but, oh, please do', 'but, if you can, please do'),
    text.replace('the owner of that name', 'someone else'), text.replace('What’s your name?', 'Where do you live?'),
    text.slice(text.indexOf('“Anne Shirley,”')), text.slice(0, -1), text + '\n\n' + text.split('\n\n').at(-1),
    'She would have said the following words.\n\n' + text, 'This exchange might have happened.\n\n' + text, 'For instance, a child could say.\n\n' + text, 'If that conversation happened, these would be the words.\n\n' + text, 'She did not say the following words.\n\n' + text, '“\n' + text, text + '\n\nShe did not want anyone to call her Cordelia.', text + '\n\nShe changed her mind and no longer wanted to be called Cordelia.', text + '\n\n“Please address me as Susan.”', 'This is an imagined example.\n\n' + text, text + '\n\n“But if you call me Anne please call me Anne spelled with an E.”'];
  for (const value of invalid) expect(corpusAddress(value, 0)).toBeUndefined();
  const renamed = text.replaceAll('Anne Shirley', 'Maya Jones').replaceAll('Cordelia', 'Daisy').replace('And Anne is', 'And Maya is');
  expect(corpusAddress(renamed, 0)?.options).toEqual(['Maya Jones', 'Daisy']);
});

it('uses two genuine roots with identical Practice/Test scoring and preserves A1 limits and missing-partner fallback', () => {
  const reached = new Set<string>();
  for (let seed = 0; seed < 32; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 160, 'A2', [], 'choice', operation)!;
    expect(lesson).toBeDefined(); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual([operation, operation]);
    reached.add(lesson.materials[0].rootId);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      if ('kind' in question) throw new Error('Expected requested-address choice');
      expect(question.explanations?.[question.answer].en).toBe(`The speaker asks to be called ${question.options[question.answer]}.`);
    }
    for (const snapshot of [lesson, asTestLesson(lesson)]) for (const { question } of questions(snapshot)) {
      if ('kind' in question) { expect(question.kind).toBe('response'); expect(score(question, 'Source words.').correct).toBeNull(); }
      else { expect(score(question, question.answer).correct).toBe(true); expect(score(question, 1 - question.answer).correct).toBe(false); }
    }
    expect(asTestLesson(lesson).materials).toEqual(lesson.materials.map(material => ({ ...material, questions: material.questions.map(question => Object.fromEntries(Object.entries(question).filter(([key]) => key !== 'hints' && key !== 'modelAnswer'))) })));
  }
  expect(reached).toEqual(new Set(['voa-article-3240468', 'gutenberg-book-45']));
  expect(corpusLesson({ ...bank, records: [bank.records[1]] }, new Set(), 0, 120, 'A1')).toBeUndefined();
  const one = { ...bank, records: [bank.records[0], voa.records.find(record => record.rootId === 'voa-article-3111026')!] };
  expect(corpusLesson(one, new Set(), 0, 160, 'A2', [], 'choice', operation)).toBeUndefined();
  for (let seed = 0; seed < 16; seed++) {
    const lesson = corpusLesson(one, new Set(), seed, 160, 'A2')!; expect(lesson).toBeDefined();
    expect(lesson.materials.every(material => corpusOperation(material.questions[0]) !== operation)).toBe(true);
  }
});

it('saves both actual-source Practice/Test snapshots and restores all responses and exposures', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 0, 160, 'A2', [], 'choice', operation)!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profileId = `address-${lesson.mode ?? 'practice'}`, created = await createSession(lesson, profileId);
      let current: Session = await claimSession(created.id, 'address-owner');
      for (const { question } of questions(lesson)) {
        await markExposure(current); const saved = await submit(current.id, 'address-owner', 'kind' in question ? 'I quote the requested name.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true); expect(await attempts.get(saved.id)).toEqual(saved);
        current = await advance(current.id, 'address-owner');
      }
      expect((await sessions.get(current.id))!.status).toBe('completed');
      const restored = await inspectBackup(await exportBackup(profileId));
      expect(restored.records.sessions[0].lesson).toEqual(lesson); expect(restored.records.attempts).toHaveLength(4); expect(restored.records.exposures).toHaveLength(2);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
