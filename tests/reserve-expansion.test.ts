import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {expect,it} from 'vitest';
import catalogue from '../content/source-packs.json';
import {corpusAttribution,corpusOutcome,corpusRequests,corpusQualifiedCause,corpusActionSelection,corpusLesson,type Corpus} from '../src/core/corpus';
import {spokenCorpusSchema,spokenCorpusLesson,type SpokenCorpus} from '../src/core/spokenCorpus';
import {reviewedReading} from '../src/data/corpus';
import {spokenAttributionPairs,spokenAttributionMatchingPrompt} from '../src/core/spokenAttribution';
import {corpusOperation} from '../src/core/corpusPractice';
import {asTestLesson,questions,score,type Lesson} from '../src/shared/content';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const reading:Corpus['records']=[],spoken:SpokenCorpus[]=[];
for(const pack of catalogue.packs){
 const bytes=readFileSync('public'+pack.path);expect(sha(bytes)).toBe(pack.sha256);
 const member=pack.skill==='reading'?'corpus.json':'spoken.json';const files=unzipSync(bytes,{filter:f=>f.name===member});
 if(!files[member])continue;
 const bank=JSON.parse(new TextDecoder().decode(files[member]));
 if(pack.skill==='reading')reading.push(...bank.records);
 else {for(const source of bank.records)for(const clip of source.clips)clip.audio.src=clip.audio.src.replace(/^media\//,`/audio/community-${pack.sha256}/`);spoken.push(spokenCorpusSchema.parse({...bank,communityPackageId:pack.sha256}));}
}
const attributionIds=['0c859fe0f5d6df248c475e869da3838dd70072ca46d9ccd601b5d629556c4b2a','289dac8499604a19adfe98286c9a2b1287027fb69862681c4901ab7f60321fe0','2934d38c2c9997c9444ae5089cb38dee83b7a234f30704616b5298013cfc1697','bba9dc18c3fca9e625a2c72f1068459a3fc9e4953f901ca56849a50a8e991f95'];
const outcomeRoots=['wikipedia-article-244511','wikipedia-article-9228','gutenberg-book-3653','gutenberg-book-19734'];
const matching=`matching:${spokenAttributionMatchingPrompt}`;
const matchingRoots=['wikipedia-article-14018','wikipedia-article-18855029','gutenberg-book-10123','gutenberg-book-9745'];
const attribution='evidence:Which sentence explicitly attributes a claim to a named source?';
function check(lesson:Lesson,operation:string){
 expect(new Set(lesson.materials.map(m=>m.rootId)).size).toBe(2);
 expect(lesson.teaching).toBeTruthy();expect(lesson.workedExample).toBeTruthy();
 if(operation==='choice:qualified-cause'&&lesson.materials.some(m=>m.rootId==='wikipedia-article-244511')){expect(lesson.teaching!.en).toContain('nocturnal means active at night');expect(lesson.teaching!.en).toContain('“in Britain”, “some”, “even when” and “possibly”');}
 if(operation===matching&&lesson.materials.some(m=>matchingRoots.slice(2).includes(m.rootId))){expect(lesson.teaching!.en).toContain('recording’s narrator');expect(lesson.workedExample!.en).toContain('Mira');}
 for(const m of lesson.materials){expect(corpusOperation(m.questions[0])).toBe(operation);for(const q of m.questions)expect(m.blocks.find(b=>b.id===q.blockId)!.text.slice(q.evidence.start,q.evidence.end)).toBeTruthy();}
 for(const {question:q}of questions(lesson)){
  if('kind' in q && q.kind==='response'){expect(score(q,'Synthetic explanation').correct).toBeNull();continue;}
  if('kind' in q && q.kind==='evidence'){expect(score(q,q.accepted[0]).correct).toBe(true);expect(score(q,q.spans.findIndex((_,i)=>!q.accepted.includes(i))).correct).toBe(false);}
  else if('kind' in q && q.kind==='matching'){expect(score(q,q.pairs.map(p=>p.answer)).correct).toBe(true);expect(score(q,q.pairs.map(p=>q.choices.find(c=>c!==p.answer)!)).correct).toBe(false);expect(()=>score(q,[])).toThrow();expect(()=>score(q,q.pairs.map(()=>''))).toThrow();}
  else if(!('kind' in q)){expect(score(q,q.answer).correct).toBe(true);for(let answer=0;answer<q.options.length;answer++)expect(score(q,answer).correct).toBe(answer===q.answer);expect(()=>score(q,'')).toThrow();}
  else throw Error('Unexpected operation');
 }
 const assessed=structuredClone(lesson.materials);for(const m of assessed)for(const q of m.questions){delete q.hints;if('modelAnswer'in q)delete q.modelAnswer;}
 expect(asTestLesson(lesson).materials).toEqual(assessed);
}
it.each([['B1',attribution,attributionIds],['B2',attribution,attributionIds],['B1','choice:stated-outcome',outcomeRoots],['B1',matching,matchingRoots]] as const)('uses two disjoint pairs and exhausts %s %s', (level,operation,ids)=>{
 const banks=spoken.map(b=>({...b,records:b.records.map(s=>({...s,clips:s.clips.filter(c=>operation===attribution?ids.includes(c.id):ids.includes(s.rootId)&&c.audio.duration<=20&&!!(operation===matching?spokenAttributionPairs(c.text,0):corpusOutcome(c.text,0)))})).filter(s=>s.clips.length)})).filter(b=>b.records.length);
 expect(new Set(banks.flatMap(b=>b.records.map(s=>s.rootId))).size).toBe(4);
 for(let seed=0;seed<8;seed++){
  const seen=new Set<string>(),roots=new Set<string>();
  for(let group=0;group<2;group++){
   const lesson=banks.map(bank=>spokenCorpusLesson(bank,seen,seed,level==='B2'?25:20,level,[],operation===attribution?'evidence':operation===matching?'matching':'choice',operation,banks)).find(Boolean)!;
   expect(lesson).toBeTruthy();check(lesson,operation);
   for(const m of lesson.materials){expect(roots.has(m.rootId)).toBe(false);roots.add(m.rootId);seen.add(m.id.replace(/^corpus-/,''));seen.add(m.rootId);expect(m.audio!.duration).toBeLessThanOrEqual(level==='B2'?25:20);}
  }
  expect(roots.size).toBe(4);for(const bank of banks)expect(spokenCorpusLesson(bank,seen,seed,level==='B2'?25:20,level,[],operation===attribution?'evidence':operation===matching?'matching':'choice',operation,banks)).toBeUndefined();
 }
});
it.each([
 ['choice:qualified-cause','choice',['wikipedia-article-244511','wikipedia-article-3511662','openstax-book-us-history','frontiers-article-10.3389-frym.2024.1282740']],
 ['choice:conditional-action','choice',['wikipedia-article-198435','wikipedia-article-94057','openstax-book-entrepreneurship','openstax-book-introduction-business']],
 ['matching:Match each action to what the request asks for or rules out.','matching',['wikipedia-article-18362','gutenberg-book-1661','gutenberg-book-1260','voa-article-3487865']],
] as const)('uses two disjoint reading pairs and exhausts %s',async(operation,kind,roots)=>{
 const records=await reviewedReading(reading.filter(s=>(roots as readonly string[]).includes(s.rootId)),160);
 const detector=operation==='choice:qualified-cause'?corpusQualifiedCause:kind==='choice'?corpusActionSelection:corpusRequests;
 const bank={version:1 as const,failures:[],records:records.map(s=>({...s,passages:s.passages.filter(p=>p.wordCount<=160&&!!detector(p.text,0))})).filter(s=>s.passages.length)};
 expect(new Set(bank.records.map(s=>s.rootId)).size).toBe(4);
 for(let seed=0;seed<8;seed++){
  const seen=new Set<string>(),used=new Set<string>();
  for(let group=0;group<2;group++){
   const lesson=corpusLesson(bank,seen,seed,160,'B1',[],kind,operation)!;expect(lesson).toBeTruthy();check(lesson,operation);
   for(const m of lesson.materials){expect(used.has(m.rootId)).toBe(false);used.add(m.rootId);seen.add(m.rootId);seen.add(m.id.replace(/^corpus-/,''));expect(m.blocks[0].text.split(/\s+/).length).toBeLessThanOrEqual(160);}
  }
  expect(used.size).toBe(4);expect(corpusLesson(bank,seen,seed,160,'B1',[],kind,operation)).toBeUndefined();
 }
});
it('does not generalize exact inspected frames to altered, repeated, quoted, missing-context or hypothetical texts',async()=>{
 const read=await reviewedReading(reading,160);
 const cases=[...spoken.flatMap(b=>b.records.flatMap(s=>s.clips.filter(c=>attributionIds.slice(2).includes(c.id)).map(c=>[c.text,corpusAttribution] as const))),...spoken.flatMap(b=>b.records.filter(s=>outcomeRoots.slice(2).includes(s.rootId)).flatMap(s=>s.clips.filter(c=>c.audio.duration<=20&&corpusOutcome(c.text,0)).map(c=>[c.text,corpusOutcome] as const))),...read.filter(s=>['openstax-book-entrepreneurship','openstax-book-introduction-business','gutenberg-book-1260','voa-article-3487865'].includes(s.rootId)).flatMap(s=>s.passages.filter(p=>p.wordCount<=160&&(corpusRequests(p.text,0)||corpusActionSelection(p.text,0))).map(p=>[p.text,s.rootId.startsWith('openstax')?corpusActionSelection:corpusRequests] as const))];
 expect(cases.length).toBeGreaterThanOrEqual(8);
 for(const [text,detector]of cases)for(const damaged of [text+text,`Imagine this. ${text}`,`“${text}”`,text.slice(20),text.replace(/said|caused|resulted|must|Please|Do not/, 'might')])expect(detector(damaged,0)).toBeUndefined();
});

it('keeps inspected dialogue exact, timed, qualified and safely scored',()=>{
 const clips=spoken.flatMap(b=>b.records.filter(s=>matchingRoots.slice(2).includes(s.rootId)).flatMap(s=>s.clips)).filter(c=>spokenAttributionPairs(c.text,0));
 expect(clips).toHaveLength(2);
 for(const c of clips){
  const task=spokenAttributionPairs(c.text,0)!;
  expect(spokenAttributionPairs(c.text,1)!.pairs).toEqual(task.pairs.toReversed());
  for(const [i,p]of task.pairs.entries()){const span=i===0?task.evidence:task.otherEvidence[i-1];expect(c.text.slice(span.start,span.end)).toContain(p.answer);expect(p.label).not.toContain(p.answer);}
  for(const changed of [c.text+c.text,`Imagine this. ${c.text}`,c.text.slice(5),c.text.replace('said','might say'),c.text.replace('today','tomorrow').replace('likely','certainly')])expect(spokenAttributionPairs(changed,0)).toBeUndefined();
 }
});

it('retains the complete owl context and every cause qualification without broadening the exact scope',async()=>{
 const source=(await reviewedReading(reading.filter(s=>s.rootId==='wikipedia-article-244511'),160)).find(s=>s.passages.some(p=>p.wordCount===134))!;
 const passage=source.passages.find(p=>p.wordCount===134&&p.text.includes('previous night has been wet'))!;
 expect(passage).toBeTruthy();
 for(let seed=0;seed<8;seed++){const task=corpusQualifiedCause(passage.text,seed)!;expect(task).toBeTruthy();expect(task.sentence).toContain('In Britain, some birds');expect(task.sentence).toContain('even when mobbed');expect(task.sentence).toContain('possibly because');expect(passage.text.slice(task.evidence.start,task.evidence.end)).toContain('barn owl is nocturnal');expect(task.options[task.answer]).toBe('The passage states what happened but only proposes an explanation.');}
 for(const damaged of [passage.text+passage.text,`Imagine this. ${passage.text}`,`“${passage.text}”`,passage.text.slice(passage.text.indexOf('In Britain, some birds')),passage.text.replace('possibly because','because'),passage.text.replace('some birds continue','all birds continue'),passage.text.replace('In Britain, some','In France, some'),passage.text.replace('continue to hunt','may continue to hunt'),passage.text.replace('even when mobbed','unless mobbed')])expect(corpusQualifiedCause(damaged,0)).toBeUndefined();
});
