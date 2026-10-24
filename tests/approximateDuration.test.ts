import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusQualifiedTiming, corpusLesson, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';
import { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const shards = ['gutenberg', 'gutenberg-2'].map(name => corpusSchema.parse(JSON.parse(readFileSync(`public/corpus/${name}.json`, 'utf8'))));
const ids = ['553a6f80d1df5b6176ac54f5c9e8db8c55a361c050ecc39164176f07882d723a', '16d96ca487c4b510fbbf91e7c370bca2352a69d40fc95f073f9e9212c7a7972e'];
const originals = ['gutenberg-book-1400', 'gutenberg-book-1998'].map(root => shards.flatMap(shard => shard.records).find(source => source.rootId === root)!);
const bank = { ...shards[0], records: originals.map((source, index) => ({ ...source, passages: source.passages.filter(part => part.id === ids[index]) })) };
const texts = bank.records.map(source => source.passages[0].text), operation = 'choice:qualified-timing';
it('retains actual source hashes, complete duration statements and exact independent context', () => {
  expect(bank.records.map(source => source.passages[0].wordCount)).toEqual([242, 500]);
  for (const [index, source] of originals.entries()) {
    expect(sha(readFileSync(`content/corpus/raw/pg${index ? 1998 : 1400}.txt`))).toBe(source.sourceHash);
    expect(sha(texts[index])).toBe(ids[index]);
    const task = corpusQualifiedTiming(texts[index], 0)!;
    expect(texts[index].slice(task.evidence.start, task.evidence.end)).toBe(task.sentence);
    expect(task.otherEvidence).toHaveLength(1);
    const anchor = texts[index].slice(task.otherEvidence[0].start, task.otherEvidence[0].end);
    expect(anchor).toContain(index ? 'my brother' : 'stage-coach');
    expect(anchor).toContain(index ? 'first part of this book' : 'London');
  }
  expect(corpusQualifiedTiming(texts[1], 0)!.sentence).toBe('The first part of “Zarathustra” was written in about ten days—that is to say, from the beginning to about the middle of February 1883.');
});
it('preserves every duration, date, title and endpoint while testing precision and scope', () => {
  for (const [index, text] of texts.entries()) for (let seed = 0; seed < 12; seed++) {
    const task = corpusQualifiedTiming(text, seed)!;
    expect(task).toEqual(corpusQualifiedTiming(text, seed)); expect(new Set(task.options).size).toBe(3);
    expect(task.options[task.answer]).toBe(task.sentence.replace(index ? 'written in about' : 'a journey of about', index ? 'written in approximately' : 'a journey of approximately'));
    expect(task.explanations[task.answer]).toContain('elapsed duration');
    for (const option of task.options) {
      expect(option.match(/\b(?:five|ten|1883)\b/g)).toEqual(task.sentence.match(/\b(?:five|ten|1883)\b/g));
      expect(option).toContain(index ? 'from the beginning to about the middle of February 1883' : 'from our town to the metropolis');
    }
    expect(task.options.some(option => option.startsWith(index ? 'The whole of “Zarathustra”' : 'Every journey'))).toBe(true);
    expect(task.options.some(option => option.includes('exactly'))).toBe(true);
    expect(task.options.some(option => option.includes('Every part'))).toBe(false);
  }
});
it('withholds quoted, conditional, duplicate, incomplete and mismatched contexts and real same-book negatives', () => {
  for (const [index, text] of texts.entries()) {
    const task = corpusQualifiedTiming(text, 0)!, target = task.sentence, anchor = text.slice(task.otherEvidence[0].start, task.otherEvidence[0].end);
    const invalid = [target, '“' + text, text.replace(target, 'If ' + target), text.replace(target, 'The author said that ' + target), text.replace(target, '“' + target + '”'),
      text.replace(target, target + ' ' + target), text.replace(anchor, ''), text.replace(anchor, '“' + anchor), text.replace(target, target.replace('about', 'exactly')),
      text.replace(target, target.replace(index ? 'days' : 'hours', 'seconds'))];
    if (index) invalid.push(text.replace('ten days occupied', 'eleven days occupied'), text.replace('that is to say, ', ''), text.replace('February 1883', 'February'), text.replace('“Zarathustra”', '“Zarathustra'), text.replace('The first part', 'The whole'));
    else invalid.push(text.replace('London.', 'Paris.'), text.replace('The journey', 'Every journey'), text.replace('five hours', 'one hour'));
    for (const value of invalid) expect(corpusQualifiedTiming(value, 0), value).toBeUndefined();
  }
  for (const id of ['3ed425a5eff2acbaae70036f0cc10675f263f3381545bf7021551dbe5989886d', '4fa9f2041863aedd7c8d0e7404361c1a5ca5224e24541616b850c15864f5c89d', 'c823e90022c3093ccddfe15c28b86a7881562c48d44f2c3ee43b3ce0e52fb741']) {
    const passage = originals.flatMap(source => source.passages).find(part => part.id === id)!;
    expect(sha(passage.text)).toBe(id); expect(corpusQualifiedTiming(passage.text, 0)).toBeUndefined();
  }
});
it('uses runtime slots and deterministic rotations without a source-ID approval rule', () => {
  const changed = [texts[0].replace('five hours', 'seven hours'), texts[1].replaceAll('ten days', 'eleven days').replace('February 1883', 'March 1884').replaceAll('Zarathustra', 'Another Work')];
  fc.assert(fc.property(fc.constantFrom(...texts, ...changed), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusQualifiedTiming(text, seed)!; expect(task).toEqual(corpusQualifiedTiming(text, seed));
    expect(task.options[task.answer]).toContain('approximately'); expect(new Set(task.options).size).toBe(3);
  }), { numRuns: 100 });
});
it('transfers the same operation at C1/C2 with identical Test snapshots and safe lower-level withholding', () => {
  for (const point of ['C1', 'C2'] as const) for (const seed of [0, 1, 54, 55, 126, 127]) {
    const lesson = corpusLesson(bank, new Set(), seed, point === 'C1' ? 900 : 1200, point, [], seed < 2 ? 'choice' : undefined, seed < 2 ? operation : undefined)!;
    lessonSchema.parse(lesson); expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual([operation, operation]);
    expect(lesson.teaching!.en).toContain('participant, quantity, clarifying timeline');
    const test = asTestLesson(lesson); expect(test.materials.map(material => material.blocks)).toEqual(lesson.materials.map(material => material.blocks));
    for (const [index, { question }] of questions(lesson).entries()) {
      const tested = [...questions(test)][index].question; expect(tested.hints).toBeUndefined();
      if ('kind' in question) expect(score(question, 'The approximate duration retains its scope.').correct).toBeNull();
      else for (let answer = 0; answer < 3; answer++) { expect(question.hints![1].en).toContain('“about”'); expect(score(question, answer).correct).toBe(answer === question.answer); expect(score(tested, answer)).toEqual(score(question, answer)); }
    }
  }
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) expect(corpusLesson(bank, new Set(), 54, 1200, point, [], 'choice', operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(ids), 32, 1200, 'C2', [], 'choice', operation)).toBeUndefined();
});
it('saves both actual generated modes transactionally and exports complete recoverable answers', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 54, 900, 'C1')!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profile = `duration-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profile);
      await claimSession(session.id, 'duration-owner');
      for (const [index, { question }] of questions(lesson).entries()) {
        await markExposure((await sessions.get(session.id))!);
        const saved = await submit(session.id, 'duration-owner', 'kind' in question ? 'I retain the approximate duration and its original scope.' : question.answer);
        expect(await attempts.get(saved.id)).toEqual(saved); expect((await sessions.get(session.id))!.position).toBe(index);
        await advance(session.id, 'duration-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed');
      const backup = await inspectBackup(await exportBackup(profile)); expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(4);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
