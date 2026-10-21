import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { spokenAttributionPairs } from '../src/core/spokenAttribution';
import { spokenCondition } from '../src/core/spokenCondition';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { afterAll, describe, expect, it } from 'vitest';
import { corpusDates, corpusRestoration, corpusQualification, corpusAttribution, corpusSequence } from '../src/core/corpus';
import { corpusOperation, corpusPracticeHistory } from '../src/core/corpusPractice';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { questions, score } from '../src/shared/content';
import { exposureSchema } from '../src/shared/exposure';
import type { Attempt, Session } from '../src/data/db';

it('keeps honorifics and name initials with their continuation and rejects unresolved or paragraph-separated names', () => {
  const first = 'The school opened in 1903.';
  for (const last of ['In 1914, both schools were named after Dr. Thomas Hunter.', 'In 1983, Brown married Terrence E. McNally, who became a collaborator.']) {
    const text = first + ' ' + last, task = corpusDates(text, 0)!;
    expect(task.rows[1].label).toContain(last.includes('Hunter') ? 'Dr. Thomas Hunter' : 'Terrence E. McNally, who became a collaborator');
    expect(text.slice(task.otherEvidence[0].start, task.otherEvidence[0].end)).toBe(last);
  }
  for (const last of ['In 1914, both schools were named after Dr.', 'In 1914, both schools were named after Dr. The school continued.', 'In 1914, both schools were named after Dr.\n\nThomas Hunter.', 'In 1983, Brown married Terrence E.']) expect(corpusDates(first + ' ' + last, 0)).toBeUndefined();
});

it('generates timed year tables on all actual eligible recordings while preserving contextual limits, exposure and unscored interpretation', () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string; skill: string }[] };
  let targets = 0;
  const banks = catalogue.packs.filter(pack => pack.skill === 'listening').map(entry => {
    const bytes = readSourcePackFixture(entry.id); expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const raw = JSON.parse(new TextDecoder().decode(unzipSync(bytes, { filter: file => file.name === 'spoken.json' })['spoken.json']));
    const bank = spokenCorpusSchema.parse({ ...raw, communityPackageId: entry.sha256, records: raw.records.map((source: { clips: { audio: { src: string } }[] }) => ({ ...source, clips: source.clips.map(clip => ({ ...clip, audio: { ...clip.audio, src: clip.audio.src.replace(/^media\//, `/audio/community-${entry.sha256}/`) } })) })) });
    const records = bank.records.map(source => ({ ...source, clips: source.clips.filter(clip => !clip.qualityFlags.length && !!corpusDates(clip.text, 0)) })).filter(source => source.clips.length);
    targets += records.reduce((sum, source) => sum + source.clips.length, 0);
    return bank;
  });
  expect(targets).toBe(15);
  const seenTargets = new Set<string>();
  for (const bank of banks) for (const source of bank.records) for (const clip of source.clips.filter(clip => !clip.qualityFlags.length && !!corpusDates(clip.text, 0))) {
    seenTargets.add(clip.id);
    // Bind installed recording paths to their actual packages.
    const other = bank.records.find(record => record.rootId !== source.rootId && record.clips.some(clip => !clip.qualityFlags.length && !!corpusDates(clip.text, 0)))
      ?? bank.records.find(record => record.rootId !== source.rootId && record.clips.some(clip => !clip.qualityFlags.length && !!corpusRestoration(clip.text, 0, clip.language)))!;
    const paired = { ...bank, records: [{ ...source, clips: [clip] }, other] };
    for (const seed of [0, 1, 2, 3, 4, 5]) {
      const lesson = spokenCorpusLesson(paired, new Set(), seed, 91, 'C2', [], 'table')!;
      expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
      expect(lesson.teaching!.en).toContain('timing words'); expect(lesson.teaching!['zh-Hans']).toBe(lesson.teaching!.en);
      for (const material of lesson.materials) {
        const question = material.questions[0], response = material.questions[1];
        if (!('kind' in question) || !('kind' in response) || response.kind !== 'response') throw Error('Expected generated task and response');
        if (question.kind !== 'table') { expect(material.rootId).toBe(other.rootId); expect(score(response, 'A source-supported summary.').correct).toBeNull(); continue; }
        expect(corpusOperation(question)).toBe('table:Listen and complete the years in the table. Write each year in digits.');
        expect(score(question, question.rows.map(row => row.answer)).correct).toBe(true);
        expect(score(question, question.rows.map(() => '9999')).correct).toBe(false);
        const evidence = [question.evidence, ...question.additionalEvidence!];
        expect(evidence).toHaveLength(question.rows.length);
        for (const [index, span] of evidence.entries()) {
          expect(span.audioStart).toBeGreaterThanOrEqual(0); expect(span.audioEnd).toBeLessThanOrEqual(material.audio!.duration);
          expect(span.audioEnd!).toBeGreaterThan(span.audioStart!);
          expect(material.blocks[0].text.slice(span.start, span.end)).toBe(question.rows[index].label.replace('________', question.rows[index].answer));
        }
        expect(response.criteria).toHaveLength(3); expect(response.prompt).toContain('do not infer a cause');
        expect(score(response, 'A date-event explanation with complete timing limits.').correct).toBeNull();
        const time = '2026-10-03T00:00:00.000Z';
        expect(exposureSchema.safeParse({ profileId: 'test', rootId: material.rootId, firstSeenAt: time, lastSeenAt: time, contacts: [{ sessionId: 'test', materialId: material.id, questionId: question.id, variantGroup: question.id, firstSeenAt: time, lastSeenAt: time }] }).success).toBe(true);
      }
      const seen = new Set(lesson.materials.map(material => material.id.slice('corpus-'.length)));
      const next = spokenCorpusLesson(paired, seen, seed, 91, 'C2', [], 'table');
      expect(next?.materials.some(material => seen.has(material.id.slice('corpus-'.length))) ?? false).toBe(false);
    }
  }
  expect(seenTargets.size).toBe(15);
});


it('routes date-table errors separately and keeps table focus within duration, exposure and beginner boundaries', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string }[] };
  const entry = catalogue.packs.find(pack => pack.id === 'wikipedia-listening-015')!;
  const bank = (await inspectCommunityPack(readSourcePackFixture(entry.id))).spoken!;
  const targets = { ...bank, records: bank.records.map(source => ({ ...source, clips: source.clips.filter(clip => !clip.qualityFlags.length && !!corpusDates(clip.text, 0)) })).filter(source => source.clips.length) };
  expect(targets.records.map(source => source.title).sort()).toEqual(['Lärz', 'MicroProse']);
  for (const level of ['B1', 'B2', 'C1', 'C2'] as const) {
    const lesson = spokenCorpusLesson(targets, new Set(), 0, 35, level, [], 'table')!;
    expect(lesson.materials.every(material => 'kind' in material.questions[0] && material.questions[0].kind === 'table')).toBe(true);
  }
  for (const level of ['A1', 'A2'] as const) {
    const lesson = spokenCorpusLesson(targets, new Set(), 0, 35, level, [], 'table')!;
    expect(lesson.materials.every(material => 'kind' in material.questions[0] && material.questions[0].kind !== 'table')).toBe(true);
  }
  expect(spokenCorpusLesson(targets, new Set(), 0, 17, 'B1', [], 'table')).toBeUndefined();
  const blocked = structuredClone(targets); blocked.records.forEach(source => source.clips.forEach(clip => { clip.qualityFlags = ['Unresolved source/audio mismatch']; }));
  expect(spokenCorpusLesson(blocked, new Set(), 0, 35, 'B1', [], 'table')).toBeUndefined();
  const lesson = spokenCorpusLesson(targets, new Set(), 0, 35, 'B1', [], 'table')!;
  const session: Session = { id: 'table-policy', profileId: 'test', lesson, contentHash: 'a'.repeat(64), position: 4, status: 'completed', startedAt: '2026-10-03T00:00:00.000Z', assistance: { hintLevel: 0 }, leaseUntil: 0 };
  const attempts: Attempt[] = questions(lesson).map(({ material, question }, index) => ({ id: `table-${index}`, profileId: 'test', sessionId: session.id, questionId: question.id, rootId: material.rootId, answer: 'kind' in question && question.kind === 'table' ? question.rows.map(() => '9999') : 'A supported explanation', correct: 'kind' in question && question.kind === 'table' ? false : null, rule: 'test-policy', assistance: { hintLevel: 0 }, submittedAt: '2026-10-03T00:01:00.000Z' }));
  expect(corpusPracticeHistory([session], attempts, 'test', 'listening', 'all', 'B1').focus).toMatchObject({ kind: 'table', operation: 'table:Listen and complete the years in the table. Write each year in digits.', reason: 'reteach' });
  for (const seed of [0, 1]) expect(spokenCorpusLesson(targets, new Set(), seed, 35, 'B1')!.materials.every(material => 'kind' in material.questions[0] && material.questions[0].kind === 'table')).toBe(true);
});


it('reaches every available semantic recording through default generation rather than tying operation to source index', async () => {
 const { inspectCommunityPack } = await import('../src/data/communityPack');
 const bank = (await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-001'))).spoken!;
 const clips = bank.records.flatMap(source => source.clips.filter(clip => !clip.qualityFlags.length).map(clip => ({ source, clip })));
 const eligible = clips.filter(({ clip }) => corpusQualification(clip.text,0) || corpusAttribution(clip.text,0));
 expect(eligible).toHaveLength(4);
 const reached = new Set<string>();
 for(let seed=0;seed<clips.length*4;seed++) {
  const lesson=spokenCorpusLesson(bank,new Set(),seed,91,'C2')!;
  const first=lesson.materials[0];
  if('kind' in first.questions[0] && first.questions[0].kind==='evidence') reached.add(first.rootId);
  expect(new Set(lesson.materials.map(material=>material.rootId)).size).toBe(2);
 }
 expect([...reached].sort()).toEqual(eligible.map(({source})=>source.rootId).sort());
 for(const {clip} of eligible) {
  for(let seed=0;seed<clips.length*4;seed++) expect(spokenCorpusLesson(bank,new Set([clip.id]),seed,91,'C2')!.materials.every(material=>material.id!==`corpus-${clip.id}`)).toBe(true);
 }
});


describe('bounded default cycles across all24 actual listening packages', () => {
 const catalogue=regressionSourcePacks as {packs:{id:string;path:string;sha256:string;skill:string}[]};
 const entries=catalogue.packs.filter(pack=>pack.skill==='listening');
 const totals=new Map<string,number[]>();
 it.each(entries.map(entry=>[entry.id,entry] as const))('reaches every eligible recording-operation pair in %s', (_id,entry) => {
  let sequenceCount=0, tableCount=0, semanticCount=0, matchingCount=0;
  const bytes=readSourcePackFixture(entry.id);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
  const raw=JSON.parse(new TextDecoder().decode(unzipSync(bytes,{filter:file=>file.name==='spoken.json'})['spoken.json']));
  const bank=spokenCorpusSchema.parse({...raw,communityPackageId:entry.sha256,records:raw.records.map((source:{clips:{audio:{src:string}}[]})=>({...source,clips:source.clips.map(clip=>({...clip,audio:{...clip.audio,src:clip.audio.src.replace(/^media\//,`/audio/community-${entry.sha256}/`)}}))}))});
  const clips=bank.records.flatMap(source=>source.clips.filter(clip=>!clip.qualityFlags.length));
  const expected=new Set<string>();
  for(const clip of clips) {
   if (['a878f097f0d95dfeabc0ea14710a9919f848944d47b8b2f2ef8c95acb384cd2e', '88db24f39b9ea78a79d819fd60bd6573e1565573cea315cc4abad9e6a506798d'].includes(clip.id)) {
    expect(clip.text).toMatch(/U\.S\. Coast Guard|New York vs\. Homer Simpson/);
    expect(corpusSequence(clip.text, 0)).toBeUndefined();
   }
   if(corpusRestoration(clip.text,0,clip.language))expected.add(`${clip.id}:completion`);
   if(corpusSequence(clip.text,0)){expected.add(`${clip.id}:sequence`);sequenceCount++;}
   if(corpusDates(clip.text,0)){expected.add(`${clip.id}:table`);tableCount++;}
   if(corpusQualification(clip.text,0)||corpusAttribution(clip.text,0)||spokenCondition(clip.text,0)){expected.add(`${clip.id}:evidence`);semanticCount++;}
  }
  for(const clip of clips) if(spokenAttributionPairs(clip.text,0)){expected.add(`${clip.id}:matching`);matchingCount++;}
  const phases=clips.some(clip=>spokenAttributionPairs(clip.text,0))?5:4;
  const reached=new Set<string>();
  for(let seed=0;seed<clips.length*phases;seed++) {
   const lesson=spokenCorpusLesson(bank,new Set(),seed,91,'C2')!;
   const first=lesson.materials[0], question=first.questions[0];
   if('kind' in question)reached.add(`${first.id.slice(7)}:${question.kind}`);
   expect(new Set(lesson.materials.map(material=>material.rootId)).size).toBe(2);
  }
  expect([...reached].sort(),entry.id).toEqual([...expected].sort());
  totals.set(entry.id,[sequenceCount,tableCount,semanticCount,matchingCount]);
 });
 afterAll(() => {
  expect(totals.size).toBe(24);
  const [sequenceCount,tableCount,semanticCount,matchingCount]=[...totals.values()].reduce((sum,counts)=>sum.map((value,index)=>value+counts[index]),[0,0,0,0]);
 // Six initial clips, including U.S. Coast Guard and vs. Homer Simpson, have only two full sentences.
 expect(sequenceCount).toBe(145);expect(tableCount).toBe(15);expect(semanticCount).toBe(8);expect(matchingCount).toBe(2);
 });
});
