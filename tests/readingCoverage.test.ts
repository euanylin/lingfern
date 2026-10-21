import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { corpusSchema, corpusDefaultFocus, corpusLesson, corpusMaterial, corpusMaterialRoot, corpusApartments, corpusSpeakers, corpusRestoration, corpusSequence, corpusDates, corpusRequests, corpusRoleActions, corpusAttributionPairs, corpusEvaluation, corpusCondition, corpusActionSelection, corpusQualification, corpusAttribution, corpusAssignment, corpusConcession, corpusQualifiedCause, attributionMatchingPrompt, type Corpus } from '../src/core/corpus';
import { reviewedReading } from '../src/data/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { score, type CorpusQuestionKind, type Lesson } from '../src/shared/content';

const entries = (JSON.parse(readFileSync('content/source-packs.json','utf8')) as {packs:{id:string;path:string;sha256:string;skill:string}[]}).packs.filter(entry=>entry.skill==='reading');
const targets = [
 {phase:0, task:(text:string,seed:number)=>corpusDates(text,seed), operation:'table:Complete each sentence with the year given in the passage.'},
 {phase:1, task:(text:string,seed:number)=>corpusAttributionPairs(text,seed), operation:`matching:${attributionMatchingPrompt}`},
 {phase:2, task:(text:string,seed:number)=>corpusEvaluation(text,seed)},
 {phase:3, task:(text:string,seed:number)=>corpusCondition(text,seed)},
 {phase:4, task:(text:string,seed:number)=>corpusActionSelection(text,seed), operation:'choice:conditional-action'},
 {phase:5, task:(text:string,seed:number)=>corpusQualification(text,seed)},
 {phase:6, task:(text:string,seed:number)=>corpusRequests(text,seed), operation:'matching:Match each action to what the request asks for or rules out.'},
 {phase:7, task:(text:string,seed:number)=>corpusRoleActions(text,seed), operation:'matching:In the paired statement, match each reliance to what needs it.'},
 {phase:8, task:(text:string,seed:number)=>corpusSequence(text,seed), operation:'sequence'},
 {phase:10, task:(text:string,seed:number)=>corpusAttribution(text,seed)},
 {phase:11, task:(text:string,seed:number)=>corpusAssignment(text,seed)},
 {phase:12, task:(text:string,seed:number)=>corpusConcession(text,seed)},
];
type Candidate = { source: Corpus['records'][number]; passage: Corpus['records'][number]['passages'][number] };
const familyOf = (item: Candidate) => item.source.id.split('-')[0];
const ordinaryBank = (bank: Corpus): Corpus => ({ ...bank, records: bank.records.map(source => ({ ...source, passages: source.passages.filter(passage => !passage.quoteProvenance) })).filter(source => source.passages.length) });
const hasQuotes = (bank: Corpus) => bank.records.some(source => source.passages.some(passage => passage.quoteProvenance));
const freshSeed = (bank: Corpus, base: number, slot = 1) => hasQuotes(bank) ? base * 16 + slot : base;
const availableOrdinaryRoots = (bank: Corpus) => new Set(ordinaryBank(bank).records.filter(source => source.passages.some(passage => !passage.startingPoints && passage.wordCount <= 700 && corpusMaterial({ source, passage }, 0, 'C2'))).map(source => source.rootId));

function checkMaterial(material: Lesson['materials'][number], bank: Corpus) {
 const source = bank.records.find(source => source.id === material.sourceId)!;
 expect(source).toBeDefined();
 const passage = source.passages.find(passage => `corpus-${passage.id}` === material.id)!;
 expect(passage).toBeDefined();
 expect(corpusMaterialRoot(source, passage)).toBe(material.rootId);
 expect(material.credit?.sourceUrl).toBe(passage.quoteProvenance?.url ?? passage.sourceProvenance?.sourceUrl ?? source.originalUrl);
 expect(material.blocks[0].text).toBe(passage.text);
 if (source.originalText !== undefined) expect(source.originalText.includes(passage.text)).toBe(true);
 for (const question of material.questions) {
  if ('kind' in question && question.kind === 'response') {
   expect(score(question, 'An interpretation supported by the source.').correct).toBeNull();
   continue;
  }
  if ('kind' in question && question.kind === 'evidence') {
   for (const span of question.spans) expect(passage.text.slice(span.start, span.end)).toBe(span.text);
   for (const index of question.spans.keys()) expect(score(question, index).correct).toBe(question.accepted.includes(index));
  } else if ('kind' in question && question.kind === 'sequence') expect(score(question, question.acceptedOrders[0]).correct).toBe(true);
  else if ('kind' in question && question.kind === 'matching') {
   expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
   expect(score(question, question.pairs.map(pair => question.choices.find(choice => choice !== pair.answer)!)).correct).toBe(false);
  } else if ('kind' in question && question.kind === 'table') {
   expect(score(question, question.rows.map(row => row.answer)).correct).toBe(true);
   expect(score(question, question.rows.map(() => 'INVALID')).correct).toBe(false);
  } else if ('gaps' in question) {
   expect(score(question, question.gaps.map(gap => gap.answer)).correct).toBe(true);
   expect(score(question, question.gaps.map(() => 'INVALID')).correct).toBe(false);
  } else {
   expect(score(question, question.answer).correct).toBe(true);
   expect(score(question, typeof question.answer === 'number' && 'options' in question ? (question.answer + 1) % question.options.length : 'INVALID').correct).toBe(false);
  }
  for (const evidence of [question.evidence, ...(question.additionalEvidence ?? [])]) {
   expect(evidence.start).toBeGreaterThanOrEqual(0);
   expect(evidence.end).toBeGreaterThan(evidence.start);
   expect(evidence.end).toBeLessThanOrEqual(passage.text.length);
   expect(passage.text.slice(evidence.start, evidence.end).trim()).not.toBe('');
  }
 }
 expect(material.questions.some(question => 'kind' in question && question.kind === 'response')).toBe(true);
}

async function readBank(entry: typeof entries[number]) {
 const bytes = readFileSync('public' + entry.path);
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
 const bank = corpusSchema.parse(JSON.parse(new TextDecoder().decode(unzipSync(bytes, { filter: file => file.name === 'corpus.json' })['corpus.json'])));
 bank.records = await reviewedReading(bank.records);
 return bank;
}

// Scan each passage once per rule; bound generation by operations and source families.
function verifyRepresentatives(bank: Corpus, supporting: Candidate[], operation?: string) {
 if (!supporting.length) return;
 const focus = (operation?.split(':')[0] ?? 'evidence') as CorpusQuestionKind;
 // Check exact answers/evidence even when a quote lacks two roots for a fresh session.

 for (const item of supporting.filter(item => item.passage.quoteProvenance)) {
  const material = corpusMaterial(item, 0, 'C2', focus, operation)!;
  expect(material).toBeDefined();
  if (operation) expect(corpusOperation(material.questions[0])).toBe(operation);
  else expect('kind' in material.questions[0] && material.questions[0].kind).toBe('evidence');
  checkMaterial(material, bank);
 }
 const ordinary = ordinaryBank(bank);
 if (availableOrdinaryRoots(bank).size < 2) {
  for (const seed of [0, 1, 16]) expect(corpusLesson(bank, new Set(), seed, 700, 'C2', [], focus, [], operation)).toBeUndefined();
  return;
 }
 supporting = supporting.filter(item => !item.passage.quoteProvenance);
 if (!supporting.length) {
  const baseline = corpusLesson(ordinary, new Set(), 0, 700, 'C2', [], focus, [], operation);
  const fresh = corpusLesson(bank, new Set(), freshSeed(bank, 0), 700, 'C2', [], focus, [], operation);
  expect(fresh?.materials).toEqual(baseline?.materials);
  if (fresh) for (const material of fresh.materials) checkMaterial(material, bank);
  return;
 }
 const chosen: Candidate[] = [];
 for (const item of supporting) if (!chosen.some(other => familyOf(other) === familyOf(item))) chosen.push(item);
 const otherRoot = supporting.find(item => item.source.rootId !== chosen[0].source.rootId);
 if (chosen.length === 1 && otherRoot) chosen.push(otherRoot);
 const reached = new Set<string>();
 for (const representative of chosen) {
  // Expose other roots to reach shorter C2 representatives without changing passage priorities.
  const seen = new Set(supporting.filter(item => item.passage.wordCount >= 700 && item.source.rootId !== representative.source.rootId).map(item => item.passage.id));
  const remaining = supporting.filter(item => !seen.has(item.passage.id));
  const substantial = remaining.filter(item => item.passage.wordCount >= 700);
  const pool = substantial.length ? substantial : remaining;
  const families = [...new Set(pool.map(familyOf))];
  const sameFamily = pool.filter(item => familyOf(item) === familyOf(representative));
  const selected = sameFamily.find(item => item.source.rootId === representative.source.rootId)!;
  expect(selected).toBeDefined();
  const singleFamily = ordinary.records.every(source => familyOf({source, passage: source.passages[0]}) === families[0]);
  const seed = singleFamily ? pool.indexOf(selected) : sameFamily.indexOf(selected) * families.length + families.indexOf(familyOf(selected));
  const lesson = corpusLesson(bank, seen, freshSeed(bank, seed), 700, 'C2', [], focus, [], operation)!;
  const distinctSupportingRoots = new Set(remaining.map(item => item.source.rootId));
  if (operation === `matching:${attributionMatchingPrompt}` && distinctSupportingRoots.size < 2) { expect(lesson, operation).toBeUndefined(); continue; }
  expect(lesson, operation).toBeDefined();
  expect(lesson.materials[0].id).toBe(`corpus-${selected.passage.id}`);
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  if (operation) expect(corpusOperation(lesson.materials[0].questions[0])).toBe(operation);
  else expect('kind' in lesson.materials[0].questions[0] && lesson.materials[0].questions[0].kind).toBe('evidence');
  if (operation && distinctSupportingRoots.size >= 2) expect(corpusOperation(lesson.materials[1].questions[0])).toBe(operation);
  for (const material of lesson.materials) checkMaterial(material, bank);
  if (hasQuotes(bank)) {
   const baseline = corpusLesson(ordinary, seen, seed, 700, 'C2', [], focus, [], operation)!;
   expect(lesson.materials).toEqual(baseline.materials);
   const quotaSlot = corpusLesson(bank, seen, freshSeed(bank, seed, 0), 700, 'C2', [], focus, [], operation)!;
   expect(quotaSlot.materials[0]).toEqual(baseline.materials[0]);
   expect(new Set(quotaSlot.materials.map(material => material.rootId)).size).toBe(2);
   for (const material of quotaSlot.materials) checkMaterial(material, bank);
  }
  reached.add(lesson.materials[0].rootId);
 }
 if (new Set(supporting.map(item => item.source.rootId)).size >= 2) expect(reached.size).toBeGreaterThanOrEqual(2);
}

it.each(entries)('validates every available adult operation in actual $id across distinct roots and source families', async entry => {
 const bank = await readBank(entry);
 const pools = new Map<string, Candidate[]>();
 for (const source of bank.records) for (const passage of source.passages) {
  if (passage.startingPoints || passage.task || passage.wordCount > 700 || passage.wordCount < 120) continue;
  for (const target of targets) {
   const task = target.task(passage.text, 0);
   if (!task) continue;
   const operation = target.operation ?? ('prompt' in task ? `evidence:${task.prompt}` : undefined);
   expect(operation).toBeDefined();
   const pool = pools.get(operation!) ?? [];
   pool.push({source, passage}); pools.set(operation!, pool);
  }
  if (corpusRestoration(passage.text, 0, passage.language)) {
   const pool = pools.get('completion') ?? []; pool.push({source, passage}); pools.set('completion', pool);
  }
  if (corpusQualifiedCause(passage.text, 0)) {
   const pool = pools.get('choice:qualified-cause') ?? []; pool.push({source, passage}); pools.set('choice:qualified-cause', pool);
  }
 }
 if(!pools.size) {
  expect(bank.records.flatMap(source=>source.passages).every(passage=>passage.wordCount<120||passage.wordCount>700||passage.startingPoints)).toBe(true);
  for(const seed of [0,1,16])expect(corpusLesson(bank,new Set(),seed,700,'C2')).toBeUndefined();
  return;
 }
 for (const [operation, supporting] of pools) verifyRepresentatives(bank, supporting, operation);
 const ordinary = ordinaryBank(bank);
 if (availableOrdinaryRoots(bank).size < 2) {
  for (const seed of [0, 1, 16]) expect(corpusLesson(bank, new Set(), seed, 700, 'C2')).toBeUndefined();
  return;
 }
 const ordinaryPools = new Map([...pools].map(([operation, items]) => [operation, items.filter(item => !item.passage.quoteProvenance)]));
 const eligibleIds = new Set([...ordinaryPools.values()].flat().map(item => item.passage.id));
 for (const target of [...targets, {phase: 9, task: (text:string, seed:number) => corpusRestoration(text, seed), operation: 'completion'}, {phase: 13, task: (text:string, seed:number) => corpusQualifiedCause(text, seed), operation: 'choice:qualified-cause'}]) {
  const taskItem = [...ordinaryPools.values()].flat().find(item => target.task(item.passage.text, 0));
  if (!taskItem) continue;
  const task = target.task(taskItem.passage.text, 0)!;
  const operation = target.operation ?? ('prompt' in task ? `evidence:${task.prompt}` : undefined);
  const phase = Array.from({length:36},(_,index)=>index).find(index=>{const [kind,subtype]=corpusDefaultFocus(index,1,'C2');return kind===operation?.split(':')[0]&&(!subtype||subtype===operation);});
  expect(phase).toBeDefined();
  const baseSeed = eligibleIds.size * phase!;
  const lesson = corpusLesson(bank, new Set(), freshSeed(bank, baseSeed), 700, 'C2')!;
  expect(lesson).toBeDefined();
  if (hasQuotes(bank)) expect(lesson.materials).toEqual(corpusLesson(ordinary, new Set(), baseSeed, 700, 'C2')!.materials);
  const missingAttributionPartner = operation === `matching:${attributionMatchingPrompt}` && new Set(ordinaryPools.get(operation)!.map(item => item.source.rootId)).size < 2;
  if (missingAttributionPartner) expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual(['completion', 'completion']);
  else expect(corpusOperation(lesson.materials[0].questions[0])).toBe(operation);
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  for (const material of lesson.materials) checkMaterial(material, bank);
 }
});


it.each(['A1','A2'] as const)('keeps all actual %s beginner operations reachable as exposed materials reduce the pool', point=>{
 const full=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json','utf8')));
 const bank={...full,records:full.records.filter(source=>!source.id.startsWith('lingfern-dialogue-'))};
 const maxWords=point==='A1'?120:160;
 const passages=bank.records.flatMap(source=>source.passages.filter(passage=>passage.startingPoints?.includes(point)&&passage.wordCount<=maxWords));
 expect(passages).toHaveLength(point==='A1'?9:18);
 for(let removed=0;removed<=passages.length-2;removed++) {
  const seen=new Set(passages.slice(0,removed).map(passage=>passage.id));
  const available=passages.filter(passage=>!seen.has(passage.id));
  const expected=new Set<string>();
  for(const passage of available) {
   if(corpusApartments(passage.text,0))expected.add(`${passage.id}:table`);
   if(corpusSpeakers(passage.text,0))expected.add(`${passage.id}:matching`);
   if(corpusSequence(passage.text,0))expected.add(`${passage.id}:sequence`);
   if(corpusRestoration(passage.text,0,passage.language,true))expected.add(`${passage.id}:completion`);
  }
  if(!removed)expect(expected.size).toBe(point==='A1'?25:48);
  const reached=new Set<string>();
  for(let seed=0;seed<available.length*4;seed++) {
   const lesson=corpusLesson(bank,seen,seed,maxWords,point)!;
   expect(lesson).toBeDefined();expect(new Set(lesson.materials.map(material=>material.rootId)).size).toBe(2);
   expect(lesson.materials.every(material=>!seen.has(material.id.slice(7)))).toBe(true);
   const first=lesson.materials[0],question=first.questions[0];
   if('kind' in question)reached.add(`${first.id.slice(7)}:${question.kind}`);
   expect(lesson.teaching!['zh-Hans']).not.toBe(lesson.teaching!.en);
  }
  expect([...reached].sort(),`${point}/${removed} exposed`).toEqual([...expected].sort());
 }
 expect(corpusLesson(bank,new Set(passages.map(passage=>passage.id)),0,maxWords,point)).toBeUndefined();
});

it.each(['A1','A2'] as const)('reaches original-dialogue %s operations from the mixed beginner bank', point=>{
 const bank=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json','utf8')));
 const maxWords=point==='A1'?120:160;
 const lingfern=bank.records.filter(source=>source.id.startsWith('lingfern-dialogue-'));
 expect(lingfern).toHaveLength(50);
 const passages=bank.records.flatMap(source=>source.passages.filter(passage=>passage.startingPoints?.includes(point)&&passage.wordCount<=maxWords));
 const expected=new Set<string>();
 for(const passage of passages) {
  if(corpusApartments(passage.text,0))expected.add(`${passage.id}:table`);
  if(corpusSpeakers(passage.text,0))expected.add(`${passage.id}:matching`);
  if(corpusSequence(passage.text,0))expected.add(`${passage.id}:sequence`);
  if(corpusRestoration(passage.text,0,passage.language,true))expected.add(`${passage.id}:completion`);
 }
 expect(expected.size).toBe((point==='A1'?25:48)+lingfern.length*4);
 const reached=new Set<string>();
 for(let seed=0;seed<passages.length*120&&reached.size<expected.size;seed++) {
  const lesson=corpusLesson(bank,new Set(),seed,maxWords,point)!;
  expect(new Set(lesson.materials.map(material=>material.rootId)).size).toBe(2);
  const first=lesson.materials[0],question=first.questions[0];
  if('kind' in question)reached.add(`${first.id.slice(7)}:${question.kind}`);
 }
 expect([...reached].sort()).toEqual([...expected].sort());
 const roots=new Set<string>();
 for(let seed=0;seed<80;seed++) {
  const lesson=corpusLesson(bank,new Set(),seed,maxWords,point,[], 'table')!;
  expect(lesson.materials[0].rootId).not.toBe(lesson.materials[1].rootId);
  for(const material of lesson.materials) if(material.rootId.startsWith('lingfern-dialogue-'))roots.add(material.rootId);
 }
 expect(roots.size).toBeGreaterThan(10);
}, 60000);


it.each(entries)('honours generic evidence focus in actual $id across distinct roots and source families', async entry => {
 const bank = await readBank(entry);
 const supporting = bank.records.flatMap(source => source.passages.filter(passage => !passage.startingPoints && !passage.task && passage.wordCount <= 700
  && (corpusQualification(passage.text, 0) || corpusAttribution(passage.text, 0) || corpusEvaluation(passage.text, 0) || corpusCondition(passage.text, 0)))
  .map(passage => ({source, passage})));
 verifyRepresentatives(bank, supporting);
});
