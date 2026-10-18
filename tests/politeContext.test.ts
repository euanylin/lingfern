import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusPoliteRequest, corpusLesson, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';
import { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
const ids = ['032ef44a02c3d7cc1936ad07db564be6e5db5b09fddb7a94c6d498dbc085fc5b', 'de6e39ddbe21015e8d355b6624b8109ff9868219123cfe6b9110c7ee24a73ee3'];
const roots = ['gutenberg-book-514', 'gutenberg-book-1661'];
const records = roots.map((root, i) => { const r = corpus.records.find(r => r.rootId === root)!; return { ...r, passages: r.passages.filter(p => p.id === ids[i]) }; });
const bank = { ...corpus, records }, texts = records.map(r => r.passages[0].text), operation = 'choice:polite-request';
it('retains exact acquired full turns, prior object/restraint and knowledge/custody uptake', () => {
  expect(records.map(r => r.passages[0].wordCount)).toEqual([255, 268]);
  for (const [i, r] of records.entries()) {
    expect(sha(texts[i])).toBe(ids[i]); expect(sha(readFileSync(`content/corpus/raw/pg${i ? 1661 : 514}.txt`))).toBe(r.sourceHash);
    const task = corpusPoliteRequest(texts[i], 0)!; expect(task.contextual).toBe(true); expect(task.evidence).toEqual(i ? { start: 852, end: 1019 } : { start: 768, end: 961 });
    expect(task.sentence).toBe(texts[i].slice(task.evidence.start, task.evidence.end));
    expect(task.otherEvidence).toEqual(i ? [{ start: 587, end: 850 }, { start: 1021, end: 1161 }] : [{ start: 689, end: 766 }, { start: 963, end: 1134 }]);
    expect(texts[i].slice(task.otherEvidence[0].start, task.otherEvidence[0].end)).toContain(i ? 'handcuffs' : 'Where did you learn all this sort of thing');
    expect(texts[i].slice(task.otherEvidence[1].start, task.otherEvidence[1].end)).toContain(i ? 'in the custody of the detective' : 'laughed Laurie');
  }
});
it('preserves requests alongside narrated knowledge/constraint rather than inferring from courteous words', () => {
  for (let seed = 0; seed < 12; seed++) for (const [i, text] of texts.entries()) {
    const task = corpusPoliteRequest(text, seed)!; expect(new Set(task.options).size).toBe(3); expect(task).toEqual(corpusPoliteRequest(text, seed));
    const faithful = task.options[task.answer];
    if (i) {
      expect(faithful).toContain('directs the listener to march upstairs'); expect(faithful).toContain('the group can get a cab to carry the listener to the police-station'); expect(faithful).toContain('handcuffs and custody');
      expect(task.options.every(option => option.includes('march upstairs') && option.includes('the group can get a cab to carry the listener to the police-station'))).toBe(true);
      expect(task.options.some(option => option.includes('without any custody restriction'))).toBe(true);
      expect(task.options.some(option => option.includes('offers to march upstairs for the listener, where'))).toBe(true);
      expect(task.options.join(' ')).not.toMatch(/has arrived|completed the cab|royal blood is verified|royal title is verified/);
    } else {
      expect(faithful).toContain('asks the listener to explain “this sort of thing”'); expect(faithful).toContain('already knows');
      expect(task.options.every(option => option.includes('explain “this sort of thing”'))).toBe(true);
      expect(task.options.some(option => option.includes('because the speaker does not know'))).toBe(true); expect(task.options.some(option => option.includes('speaker offers'))).toBe(true);
    }
    expect(task.options.join(' ')).not.toMatch(/Alcott|Doyle|Amy|Laurie|Jones|John Clay/);
  }
});
it('withholds missing or changed narrative/object/restraint, ambiguous roles and unsupported real polite/conditional forms', () => {
  const invalid = [texts[0].replace('knowing perfectly well what he meant', 'not knowing what he meant'), texts[0].replace('but wickedly leaving him', 'and kindly leaving him'), texts[0].replace('Where did you learn all this sort of thing', 'Where did you buy this dress'), texts[0].replace('laughed Laurie', 'laughed Amy'), texts[0].replace('laughed Laurie', 'offered Laurie'), texts[1].replace('handcuffs clattered upon his wrists', 'bracelets sparkled upon his wrists'), texts[1].replace('in the custody of the detective', 'with no restrictions'), texts[1].replace('a stare and a snigger', 'a sincere respectful smile'), texts[1].replace('where we can get a cab', 'where we have taken a cab'), texts[1].replaceAll('John Clay', 'Jones'), texts[1].replace('“It’s no use, John Clay,', '“It’s no use, Someone Else,')];
  for (const text of texts) invalid.push('“' + text + '”', text + '\n\n' + text, text.replace('would you ', 'if you would, would you '), text + '\n\n“Would you mind helping me?”', 'I imagined the following conversation.\n\n' + text);
  for (const text of invalid) expect(corpusPoliteRequest(text, 0), text).toBeUndefined();
  for (const id of ['ef559868eb01cd187692f9132129d374e412ea5254375ab1df7d000450ecfa93', 'f62203ec8653d40118d5856c0f7e3298500e676e741914a44824293464407c93']) {
    const text = corpus.records.flatMap(r => r.passages).find(p => p.id === id)!.text; expect(sha(text)).toBe(id); expect(corpusPoliteRequest(text, 0)).toBeUndefined();
  }
  for (const text of texts) { const task = corpusPoliteRequest(text, 0)!; expect(corpusPoliteRequest(text.slice(task.evidence.start), 0)).toBeUndefined(); expect(corpusPoliteRequest(text.slice(0, task.evidence.end), 0)).toBeUndefined(); }
});
it('derives runtime role names and deterministic rotations while withholding unsupported paragraph separation', () => {
  const changed = [texts[0].replaceAll('Amy', 'Mira').replaceAll('Laurie', 'Robin'), texts[1].replaceAll('Jones', 'Green').replaceAll('John Clay', 'Morgan Reed')];
  fc.assert(fc.property(fc.constantFrom(...texts, ...changed), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusPoliteRequest(text, seed)!; expect(task.contextual).toBe(true); expect(task).toEqual(corpusPoliteRequest(text, seed)); expect(task.answer).toBe((3 - seed % 3) % 3); expect(new Set(task.options).size).toBe(3);
    for (const span of [task.evidence, ...task.otherEvidence]) expect(text.slice(span.start, span.end).trim()).toBe(text.slice(span.start, span.end));
  }), { numRuns: 100 });
  expect(corpusPoliteRequest(texts[0].replaceAll('\n\n', '\n\n\n'), 0)).toBeUndefined();
});
it('uses the same existing operation on two actual C1/C2 contexts, with unchanged scoring and direct Test snapshot', () => {
  for (const point of ['C1', 'C2'] as const) for (const seed of [0, 1, 66, 67, 138, 139]) {
    const forced = seed < 2, lesson = corpusLesson(bank, new Set(), seed, 700, point, [], forced ? 'choice' : undefined, [], forced ? operation : undefined)!;
    lessonSchema.parse(lesson); expect(lesson.materials.map(m => corpusOperation(m.questions[0]))).toEqual([operation, operation]); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.teaching!.en).toContain('custody or transport restrictions'); expect(lesson.workedExample!.en).toContain('The listener is asked to read the note to the speaker'); expect(lesson.workedExample!.en).not.toContain('If a warning'); const test = asTestLesson(lesson); expect(test.workedExample).toBeUndefined(); expect(test.materials.map(m => m.blocks)).toEqual(lesson.materials.map(m => m.blocks));
    for (const [i, { question }] of questions(lesson).entries()) { const tested = [...questions(test)][i].question; expect(tested.hints).toBeUndefined(); if ('kind' in question) expect(score(question, 'I retain the narrated knowledge and constraint.').correct).toBeNull(); else for (let answer = 0; answer < 3; answer++) { expect(score(question, answer).correct).toBe(answer === question.answer); expect(score(tested, answer)).toEqual(score(question, answer)); } }
  }
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) expect(corpusLesson(bank, new Set(), 66, 700, point, [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(ids), 34, 700, 'C2', [], 'choice', [], operation)).toBeUndefined();
});
it('saves actual contextual Practice/Test responses and full recovery exports without replacing saved earlier mind snapshots', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const earlierBank = { ...corpus, records: roots.map((root, i) => { const r = corpus.records.find(r => r.rootId === root)!; return { ...r, passages: r.passages.filter(p => p.id === (i ? '5f75bb9dd52e7c94efb8856f77d5fbd42ff828a88cd2e571f1f4232af89f3025' : 'd45860c4a3fd70a27eed3b8fdcae7d8a5cd57d8421a59b3c003dc9b01cb3ef6b')) }; }) };
    const earlierLesson = corpusLesson(earlierBank, new Set(), 66, 700, 'C2')!, earlier = await createSession(earlierLesson, 'existing-mind');
    const frozen = await sessions.get(earlier.id);
    const practice = corpusLesson(bank, new Set(), 66, 700, 'C2')!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profile = `polite-context-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profile); await claimSession(session.id, 'context-owner');
      for (const [i, { question }] of questions(lesson).entries()) { await markExposure((await sessions.get(session.id))!); const saved = await submit(session.id, 'context-owner', 'kind' in question ? 'I preserve the request and narrated knowledge or custody.' : question.answer); expect(await attempts.get(saved.id)).toEqual(saved); expect((await sessions.get(session.id))!.position).toBe(i); await advance(session.id, 'context-owner'); }
      expect((await sessions.get(session.id))!.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profile)); expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(4);
    }
    expect(await sessions.get(earlier.id)).toEqual(frozen);
    expect((await inspectBackup(await exportBackup('existing-mind'))).records.sessions[0].lesson).toEqual(earlierLesson);
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
