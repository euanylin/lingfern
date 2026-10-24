import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import catalogue from '../content/source-packs.json';
import scope from '../scripts/supported-listening-allowlist-20261013.json';
import {corpusAttribution,corpusOutcome} from '../src/core/corpus';
import {corpusOperation,corpusPracticeHistory} from '../src/core/corpusPractice';
import type {Attempt,Session} from '../src/data/db';
import {spokenCorpusLesson,spokenCorpusSchema} from '../src/core/spokenCorpus';
import {asTestLesson,questions,score} from '../src/shared/content';
const owl=scope.records.find(r=>r.title==='Barn owl')!.text;
const sega=scope.records.find(r=>r.title==='Sega v. Accolade')!.text;
it('compares finite result direction while retaining Ireland, date, diet and overlap qualification',()=>{
 for(let seed=0;seed<6;seed++){
  const task=corpusOutcome(owl,seed)!;expect(task).toBeTruthy();
  expect(task.options[task.answer]).toBe(owl.replace(' led to ',' resulted in '));
  expect(task.options).toContain(owl.replace(' led to ',' resulted from '));expect(task.options).toContain(owl.replace(' led to ',' did not result in '));
  expect(owl.slice(task.evidence.start,task.evidence.end)).toBe(owl);expect(task.explanations).toHaveLength(3);
 }
 for(const t of [owl.replace('led to','may have led to'),owl.replace('in the 1950s','in the 1960s'),owl.replace('where their ranges overlap','everywhere'),owl.replace(': where their ranges overlap, the vole is now by far the largest prey item.','.'),`“${owl}”`,owl+' '+owl])expect(corpusOutcome(t,0)).toBeUndefined();
});
it.each([
 ['B1',20,'choice','choice:stated-outcome','Barn owl','wikipedia-article-9228'],
 // Retain inspected Anthea claims; the short Envy view has a different attributed definition.
 ['B2',25,'evidence','evidence:Which sentence explicitly attributes a claim to a named source?','Sega v. Accolade','gutenberg-book-836'],
] as const)('generates supported %s two-root %s and preserves ownership, scoring, Test and exhaustion',(level,bound,kind,operation,title,otherRoot)=>{
 const row=scope.records.find(r=>r.title===title)!;
 const banks=catalogue.packs.filter(p=>p.skill==='listening').map(p=>{
  const files=unzipSync(new Uint8Array(readFileSync('public'+p.path)),{filter:f=>f.name==='spoken.json'});
  const bank=JSON.parse(new TextDecoder().decode(files['spoken.json']));
  for(const source of bank.records)for(const clip of source.clips)clip.audio.src=clip.audio.src.replace(/^media\//,`/audio/community-${p.sha256}/`);
  return spokenCorpusSchema.parse({...bank,communityPackageId:p.sha256});
 });
 const first=banks.find(b=>b.records.some(r=>r.clips.some(c=>c.id===row.localPreparedId)))!;
 const primary={...first,records:first.records.filter(r=>r.rootId===row.rootId).map(r=>({...r,clips:r.clips.filter(c=>c.id===row.localPreparedId)}))};
 const other=banks.find(b=>b.records.some(r=>r.rootId===otherRoot&&r.clips.some(c=>c.audio.duration<=bound&&(kind==='choice'?corpusOutcome(c.text,0):corpusAttribution(c.text,0)))))!;
 const application={...other,records:other.records.filter(r=>r.rootId===otherRoot).map(r=>({...r,clips:r.clips.filter(c=>c.audio.duration<=bound&&(kind==='choice'?corpusOutcome(c.text,0):corpusAttribution(c.text,0)))}))};
 for(let seed=0;seed<6;seed++){
  const lesson=spokenCorpusLesson(primary,new Set(),seed,bound,level,[],kind,operation,[application])!;expect(lesson).toBeTruthy();
  expect(new Set(lesson.materials.map(m=>m.rootId))).toEqual(new Set([row.rootId,otherRoot]));
  for(const m of lesson.materials){expect(m.audio!.duration).toBeLessThanOrEqual(bound);expect(m.communityPackageId??lesson.communityPackageId).toBe(m.rootId===row.rootId?primary.communityPackageId:application.communityPackageId);expect(corpusOperation(m.questions[0])).toBe(operation);}
  for(const {question:q} of questions(lesson)){
   const response='kind'in q&&q.kind==='response';const answer=response?'Source-supported interpretation':'kind'in q&&q.kind==='evidence'?q.accepted[0]:'answer'in q?q.answer:undefined;
   expect(score(q,answer!).correct).toBe(response?null:true);
   if(!response)expect(score(q,'kind'in q&&q.kind==='evidence'?q.spans.findIndex((_,i)=>!q.accepted.includes(i)):((q as {answer:number}).answer+1)%(q as {options:string[]}).options.length).correct).toBe(false);
  }
  if(title==='Barn owl')expect(lesson.teaching!.en).toContain('the claim is limited to overlapping ranges');
  const assessed=structuredClone(lesson.materials);for(const m of assessed)for(const q of m.questions){delete q.hints;if('modelAnswer'in q)delete q.modelAnswer;}
  expect(asTestLesson(lesson).materials).toEqual(assessed);
  const seen=new Set([...primary.records,...application.records].flatMap(r=>r.clips.map(c=>c.id)));
  expect(spokenCorpusLesson(primary,seen,seed,bound,level,[],kind,operation,[application])).toBeUndefined();
  const at='2026-10-13T13:50:00.000Z';
  const session:Session={id:'supported-history-test',profileId:'synthetic-test',lesson,contentHash:'a'.repeat(64),position:4,status:'completed',startedAt:at,assistance:{hintLevel:0},leaseUntil:0};
  const attempts:Attempt[]=questions(lesson).map(({material,question:q},i)=>({id:'supported-answer-'+i,profileId:session.profileId,sessionId:session.id,questionId:q.id,rootId:material.rootId,
   answer:'kind'in q&&q.kind==='response'?'Synthetic interpretation':0,correct:'kind'in q&&q.kind==='response'?null:false,rule:'synthetic-history-only',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));
  const history=corpusPracticeHistory([session],attempts,session.profileId,'listening','all',level);
  expect(history.needsSupport).toBe(true);expect(history.maxSeconds).toBe(bound);
  expect(spokenCorpusLesson(primary,history.seen,seed,history.maxSeconds,level,[],kind,operation,[application])).toBeUndefined();
 }
});
it('locates the complete named company allegation with two distinct complete source alternatives',()=>{
 for(let seed=0;seed<6;seed++){
  const task=corpusAttribution(sega,seed)!;expect(task).toBeTruthy();expect(task.spans).toHaveLength(3);
  expect(task.spans[task.accepted[0]].text).toBe("Sega argued that Accolade had infringed upon its copyrights because Accolade's games contained Sega's material.");
  expect(task.spans.some(s=>s.text==='The case was heard by Judge Barbara A. Caulfield.')).toBe(true);
  for(const span of task.spans)expect(sega.slice(span.start,span.end)).toBe(span.text);
 }
 for(const t of [sega.replace('Sega argued','A company argued'),sega.replace('had infringed','might have infringed'),sega.replace('Sega argued','Sega denied'),sega.slice(sega.indexOf('Sega argued')),`“${sega}”`])expect(corpusAttribution(t,0)).toBeUndefined();
});
