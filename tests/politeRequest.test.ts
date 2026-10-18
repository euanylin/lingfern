import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusPoliteRequest, corpusLesson, corpusSchema } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, questions, score } from '../src/shared/content';
import { type Session, type Attempt, advance, attempts, claimSession, createSession, db, markExposure, sessions, submit } from '../src/data/db';
import { exportBackup, inspectBackup } from '../src/data/backup';
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json', 'utf8')));
const ids = ['5f75bb9dd52e7c94efb8856f77d5fbd42ff828a88cd2e571f1f4232af89f3025', 'd45860c4a3fd70a27eed3b8fdcae7d8a5cd57d8421a59b3c003dc9b01cb3ef6b'];
const roots = ['gutenberg-book-1661', 'gutenberg-book-514'];
const records = roots.map((root, index) => { const source = corpus.records.find(source => source.rootId === root)!; return { ...source, passages: source.passages.filter(part => part.id === ids[index]) }; });
const bank = { ...corpus, records }, texts = records.map(record => record.passages[0].text), operation = 'choice:polite-request';
it('uses complete actual dialogue turns, full actions and recorded uptake from two acquired roots', () => {
  expect(records.map(r => r.passages[0].wordCount)).toEqual([314, 243]);
  for (const [i, record] of records.entries()) {
    expect(sha(texts[i])).toBe(ids[i]); expect(sha(readFileSync(`content/corpus/raw/pg${i ? 514 : 1661}.txt`))).toBe(record.sourceHash);
    const task = corpusPoliteRequest(texts[i], 0)!; expect(task.evidence).toEqual(i ? { start: 152, end: 223 } : { start: 658, end: 1210 });
    expect(task.sentence).toBe(texts[i].slice(task.evidence.start, task.evidence.end));
    const uptake = task.otherEvidence[0]; expect(texts[i].slice(uptake.start, uptake.end)).toBe(i ? '“Not at all. You are sixteen now, quite old enough to be my confidant, and my experience will be useful to you by-and-by, perhaps, in your own affairs of this sort.”' : 'I held the little printed slip to the light.');
    expect(task.options[task.answer]).toBe(i ? 'A polite request for the listener to tell the speaker what the listener would say.' : 'A polite request for the listener to read the advertised description of Mr. Hosmer Angel to the speaker.');
    expect(task.options.join(' ')).not.toMatch(/Holmes|Alcott|Jo|Meg|Mr\. Brooke/);
  }
});
it('rotates three unique interpretations, preserves embedded hypothetical content and derives runtime name slots', () => {
  const altered = texts[0].replaceAll('Watson', 'Jordan').replaceAll('Hosmer Angel', 'Morgan Reed');
  fc.assert(fc.property(fc.constantFrom(...texts, altered), fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (text, seed) => {
    const task = corpusPoliteRequest(text, seed)!; expect(task).toEqual(corpusPoliteRequest(text, seed)); expect(new Set(task.options).size).toBe(3);
    expect(task.options.filter(option => option.startsWith('A polite request'))).toHaveLength(1);
    expect(task.options.filter(option => option.startsWith('Only a question'))).toHaveLength(1);
    expect(task.options.filter(option => option.startsWith('An offer'))).toHaveLength(1);
    expect(task.answer).toBe((3 - seed % 3) % 3);
    if (text.includes('what you’d say')) expect(task.options.every(option => option.includes('would say'))).toBe(true);
    if (text.includes('Morgan Reed')) expect(task.options.every(option => option.includes('Morgan Reed'))).toBe(true);
  }), { numRuns: 100 });
});
it('withholds real permission, self-delay, past-inference and ambiguous feasibility questions plus incomplete/imagined requests', () => {
  for (const id of ['a514bc22a78863714d16a485e015676afa01364351e352cd3257aad962cd98da', '5ad8d0710d1644c7614afba83d104474c27931f10a6ca82e854c8b96bb0f1ad5', 'd6e471f2e9617b021f659b0af48524a101d22d053cf8850c74b742baf6f0a3b2', '7102e785630628385eae776427ac61f6ffc8f3209f81bac0788f9f4a81b0cafd']) {
    const text = corpus.records.flatMap(r => r.passages).find(p => p.id === id)!.text; expect(sha(text)).toBe(id); expect(corpusPoliteRequest(text, 0)).toBeUndefined();
  }
  const invalid = ['imagined', 'imagining', 'pretended', 'supposing'].map(verb => texts[0].replace('I noted, in passing', `I ${verb} saying this: I noted, in passing`)).concat([texts[0].replace('I noted, in passing', 'If I imagined saying this, I noted, in passing'), texts[0].replace('I noted, in passing', 'I would say that I noted, in passing'), texts[1] + '\n\n“Would you mind Handel for a familiar name?”', texts[0].replace('I held the little printed slip to the light.', 'I refused to read the slip.'), texts[0].replace('a gentleman named Hosmer Angel.', 'a gentleman named Someone Else.'), texts[0].replace('Would you mind reading me', 'Could you possibly read me'), texts[1].replace('Jo more respectfully', 'Meg more respectfully'), texts[1].replace('Jo couldn’t help', 'Meg couldn’t help'), texts[1].replace('Not at all.', 'No, I will not.'), texts[1].replace('telling me what you’d say', 'telling him what you’d say'), texts[1].replace('telling me what you’d say', 'telling me what you said'), texts[1].slice(152)]);
  for (const text of texts) invalid.push('“' + text + '”', text + '\n\n' + text, text.replace('Would you mind', 'If you could, would you mind'), text.replace('?”', '?'), text.slice(0, corpusPoliteRequest(text, 0)!.evidence.end));
  for (const text of invalid) expect(corpusPoliteRequest(text, 0), text).toBeUndefined();
  for (const seed of [-1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusPoliteRequest(texts[0], seed)).toThrow('INVALID_CORPUS_POLITE_REQUEST');
  expect(() => corpusPoliteRequest('a'.repeat(12001), 0)).toThrow('INVALID_CORPUS_POLITE_REQUEST');
});
it('generates normal C1/C2 same-operation application, identical Test scoring and safe missing-partner fallback', () => {
  for (const point of ['C1', 'C2'] as const) for (const seed of [0, 1, 66, 67, 138, 139]) {
    const forced = seed < 2, lesson = corpusLesson(bank, new Set(), seed, 700, point, [], forced ? 'choice' : undefined, [], forced ? operation : undefined)!;
    lessonSchema.parse(lesson); expect(lesson.materials.map(m => corpusOperation(m.questions[0]))).toEqual([operation, operation]); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.teaching!.en).toContain('hypothetical “would say”'); expect(lesson.workedExample!.en).toContain('The listener is asked to read the note to the speaker'); expect(lesson.workedExample!.en).not.toContain('If a warning'); const test = asTestLesson(lesson); expect(test.workedExample).toBeUndefined();
    expect(test.materials.map(m => m.blocks)).toEqual(lesson.materials.map(m => m.blocks));
    for (const [i, { question }] of questions(lesson).entries()) {
      const tested = [...questions(test)][i].question; expect(tested.hints).toBeUndefined();
      if ('kind' in question) expect(score(question, 'The listener is asked to perform the action, retaining hypothetical content.').correct).toBeNull();
      else for (let answer = 0; answer < 3; answer++) { expect(score(question, answer).correct).toBe(answer === question.answer); expect(score(tested, answer)).toEqual(score(question, answer)); }
    }
  }
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) expect(corpusLesson(bank, new Set(), 66, 1200, point, [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(ids), 34, 700, 'C2', [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(), 66, 250, 'C2', [], 'choice', [], operation)).toBeUndefined();
  const substitute = corpus.records.find(r => r.rootId === 'gutenberg-book-1228')!;
  const missing = { ...bank, records: [records[0], { ...substitute, passages: substitute.passages.slice(0, 1) }] };
  const ordinary = corpusLesson(missing, new Set(), 66, 700, 'C2')!; expect(ordinary.materials[0].rootId).toBe(roots[0]); expect(ordinary.materials.map(m => corpusOperation(m.questions[0]))).toEqual(['completion', 'completion']);
  expect(corpusLesson(missing, new Set(), 66, 700, 'C2', [], 'choice', [], operation)).toBeUndefined();
  const installed = corpusLesson(missing, new Set(), 66, 700, 'C2', [], undefined, [], undefined, bank)!; expect(installed.materials.map(m => corpusOperation(m.questions[0]))).toEqual([operation, operation]); expect(installed.materials[0].rootId).toBe(roots[0]);
});
it('saves both actual Practice/Test snapshots transactionally, exposes their roots and exports full recovery data', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 66, 700, 'C2')!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const profile = `polite-${lesson.mode ?? 'practice'}`, session = await createSession(lesson, profile); await claimSession(session.id, 'polite-owner');
      for (const [index, { question }] of questions(lesson).entries()) {
        await markExposure((await sessions.get(session.id))!); const saved = await submit(session.id, 'polite-owner', 'kind' in question ? 'I retain the action, its recipient and hypothetical content.' : question.answer);
        expect(await attempts.get(saved.id)).toEqual(saved); expect((await sessions.get(session.id))!.position).toBe(index); await advance(session.id, 'polite-owner');
      }
      expect((await sessions.get(session.id))!.status).toBe('completed'); const backup = await inspectBackup(await exportBackup(profile)); expect(backup.records.sessions[0].lesson).toEqual(lesson); expect(backup.records.attempts).toHaveLength(4);
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});

it('routes saved request support only within reading C1/C2 without changing saved snapshots', () => {
  const lesson = corpusLesson(bank, new Set(), 66, 700, 'C2')!, at = new Date(Date.now() - 10000).toISOString();
  const session: Session = { id: 'polite-history', profileId: 'polite-history', lesson, contentHash: 'a'.repeat(64), position: 3, status: 'completed', startedAt: at, assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const records: Attempt[] = lesson.materials.map(material => {
    const question = material.questions[0]; if ('kind' in question) throw Error('Expected choice');
    const answer = (question.answer + 1) % 3;
    return { id: `${session.id}:${question.id}`, profileId: session.profileId, sessionId: session.id, questionId: question.id, rootId: material.rootId, answer, ...score(question, answer), submittedAt: at, assistance: { hintLevel: 0 } };
  });
  const frozen = JSON.stringify(session);
  expect(corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', 'C2').focus?.operation).toBe(operation);
  for (const point of ['A1', 'A2', 'B1', 'B2'] as const) expect(corpusPracticeHistory([session], records, session.profileId, 'reading', 'all', point).focus?.operation).not.toBe(operation);
  expect(corpusPracticeHistory([session], records, session.profileId, 'listening', 'all', 'C2').focus?.operation).not.toBe(operation);
  expect(JSON.stringify(session)).toBe(frozen);
});
