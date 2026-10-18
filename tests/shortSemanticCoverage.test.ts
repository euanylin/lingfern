import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {expect,it} from 'vitest';
import fc from 'fast-check';
import catalogue from '../content/source-packs.json';
import {corpusLesson,corpusRoleActions,corpusQualifiedCause,corpusSchema,filterCorpusRoots,corpusStartingPoint} from '../src/core/corpus';
import {pairedRelianceOperation,corpusOperation,startingBounds} from '../src/core/corpusPractice';
import {reviewedReading,mergeReadingRecords} from '../src/data/corpus';
import {asTestLesson,questions,score} from '../src/shared/content';
const definitions='Momentum is a measure of the motion of an object and depends on both its mass and its velocity. Angular momentum is a measure of the motion of a spinning or revolving object and depends on its mass, velocity, and distance from the point around which it revolves.';
const trees='The trees inside the parks were growing more slowly, probably because they are bigger.';
const storm='Possibly due to its fast forward motion, the storm became disorganized and weakened.';
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
let sources: ReturnType<typeof corpusSchema.parse>['records']|undefined;
function current(){return sources??=mergeReadingRecords(catalogue.packs.filter(pack=>pack.skill==='reading').flatMap(pack=>{
 const bytes=readFileSync('public'+pack.path);expect(sha(bytes)).toBe(pack.sha256);
 return corpusSchema.parse(JSON.parse(new TextDecoder().decode(unzipSync(bytes,{filter:file=>file.name==='corpus.json'})['corpus.json']))).records;
}));}
it('matches complete adjacent self-contained definitions without inferring reciprocity or resolving outside pronouns',()=>{
 fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{const task=corpusRoleActions(definitions,seed)!;expect(task).toBeDefined();expect(task).toEqual(corpusRoleActions(definitions,seed));expect(definitions.slice(task.evidence.start,task.evidence.end)).toBe(definitions);expect(new Map(task.pairs.map(pair=>[pair.answer,pair.label]))).toEqual(new Map([
  ['Momentum','both its mass and its velocity'],['Angular momentum','its mass, velocity, and distance from the point around which it revolves'],
 ]));}),{numRuns:64,seed:13});
 for(const text of [definitions.replace('Angular momentum','Momentum'),definitions.replace('Angular momentum','It'),definitions.replace('depends on','may depend on'),definitions.replace('both its mass','not its mass'),definitions.replace('is a measure','might be a measure'),definitions.replace('a spinning or revolving object','that object'),definitions.replace('its mass, velocity','the same mass, velocity'),definitions.replace('point around which it revolves','point around which they revolve'),definitions.replace('Momentum','Result'),definitions+' '+definitions,'If '+definitions,`“${definitions}”`,`A witness said “First imagine this. ${definitions} It did not happen.”`])expect(corpusRoleActions(text,0),text).toBeUndefined();
 expect(corpusRoleActions(definitions.replace('Momentum','Movement').replace('Angular momentum','Rotating movement'),0)).toBeDefined();
});
it('keeps the observed event distinct from a leading or trailing tentative cause under strict scope and quotation failures',()=>{
 for(const sentence of [trees,storm,trees.replace('trees inside the parks','plants outside the garden').replace('are bigger','were older')])for(let seed=0;seed<8;seed++){const task=corpusQualifiedCause(sentence,seed)!;expect(task).toBeDefined();expect(sentence.slice(task.evidence.start,task.evidence.end)).toBe(sentence);expect(task.options[task.answer]).toBe('The passage states what happened but only proposes an explanation.');expect(task.explanations[task.answer]).toContain('does not verify');}
 for(const text of [trees.replace('were growing','may have been growing'),trees.replace('probably because','because'),trees.replace('they are','it is'),trees.replace('were growing','were not growing'),trees.replace('The trees','They'),storm.replace('Possibly due to','Due to'),storm.replace('became','might have become'),storm.replace('its fast forward motion','its reported fast forward motion'),storm.replace('weakened.','weakened, according to a witness.'),storm+' '+storm,`“The story began. ${trees} No one observed it.”`,`A witness said that ${storm}`,`Imagine ${trees}`])expect(corpusQualifiedCause(text,0),text).toBeUndefined();
});
it.each([
  [160,pairedRelianceOperation,'matching',['wikipedia-article-9228','openstax-book-astronomy-2e']],
  [220,pairedRelianceOperation,'matching',['wikipedia-article-9228','openstax-book-astronomy-2e']],
  [220,'choice:qualified-cause','choice',['frontiers-article-10.3389-frym.2022.729784','wikipedia-article-3511662']],
  [300,'choice:qualified-cause','choice',['frontiers-article-10.3389-frym.2022.729784','wikipedia-article-3511662']],

] as const)('generates supported/normal semantics at %i words for %s with exact source, feedback, teaching and two roots', async (bounds, operation, kind, roots) => {
 const bank={version:1 as const,failures:[],records:(await reviewedReading(current(),bounds)).filter(source=>roots.includes(source.rootId as never))};for(const point of ['B1','B2']as const)for(let seed=0;seed<8;seed++){
  const lesson=corpusLesson(bank,new Set(),seed,bounds,point,[],kind,[],operation)!;expect(lesson).toBeDefined();expect(new Set(lesson.materials.map(m=>m.rootId))).toEqual(new Set(roots));expect(lesson.teaching!.en).toBeTruthy();expect(lesson.workedExample!.en).toContain('Example:');
  for(const {material,question:q}of questions(lesson)){expect(material.blocks[0].text.split(/\s+/).length).toBeLessThanOrEqual(bounds);const text=material.blocks[0].text.slice(q.evidence.start,q.evidence.end);expect(text).toBeTruthy();
   if('kind'in q&&q.kind==='response'){expect(score(q,'Source-supported interpretation.').correct).toBeNull();continue;}
   expect(corpusOperation(q)).toBe(operation);if('kind'in q&&q.kind==='matching'){expect(score(q,q.pairs.map(p=>p.answer)).correct).toBe(true);expect(score(q,[...q.pairs.map(p=>p.answer)].reverse()).correct).toBe(false);}else if(!('kind'in q)){expect(score(q,q.answer).correct).toBe(true);expect(score(q,(q.answer+1)%q.options.length).correct).toBe(false);}
  }
  if(operation==='choice:qualified-cause'){expect(lesson.teaching!.en).toContain('CWD means large pieces of dead wood');expect(corpusStartingPoint(lesson,point).teaching).toEqual(lesson.teaching);}
  const test=asTestLesson(lesson);expect(test.teaching).toBeUndefined();expect(test.workedExample).toBeUndefined();expect(test.materials.map(m=>m.blocks)).toEqual(lesson.materials.map(m=>m.blocks));expect(test.materials.flatMap(m=>m.questions).every(q=>!q.hints)).toBe(true);
  expect(corpusLesson(filterCorpusRoots(bank,new Set(roots)),new Set(),seed,bounds,point,[],kind,[],operation)).toBeUndefined();
 }
});
it('retains four original cause roots at the actual independent B2 bound without fresh-root or snapshot shortcuts',async()=>{
 const roots=['frontiers-article-10.3389-frym.2022.729784','wikipedia-article-3511662','wikipedia-article-159895','wikipedia-article-40685706'];const maxWords=startingBounds.B2.words[2];const bank={version:1 as const,failures:[],records:(await reviewedReading(current(),maxWords)).filter(source=>roots.includes(source.rootId))};
 const first=corpusLesson(bank,new Set(),0,maxWords,'B2',[],'choice',[],'choice:qualified-cause')!;expect(first).toBeDefined();const seen=new Set(first.materials.map(m=>m.rootId));const second=corpusLesson(filterCorpusRoots(bank,seen),new Set(),1,maxWords,'B2',[],'choice',[],'choice:qualified-cause')!;expect(second).toBeDefined();expect(new Set([...first.materials,...second.materials].map(m=>m.rootId))).toEqual(new Set(roots));for(const lesson of [first,second])expect(lesson.materials.every(m=>corpusOperation(m.questions[0])==='choice:qualified-cause')).toBe(true);expect(corpusLesson(filterCorpusRoots(bank,new Set(roots)),new Set(),2,maxWords,'B2',[],'choice',[],'choice:qualified-cause')).toBeUndefined();
});
