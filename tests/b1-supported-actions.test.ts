import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {expect,it} from 'vitest';
import catalogue from '../content/source-packs.json';
import scopes from '../content/corpus/short-reading-scopes.json';
import {corpusActionSelection,corpusLesson,corpusRequests,type Corpus} from '../src/core/corpus';
import {corpusOperation} from '../src/core/corpusPractice';
import {reviewedReading} from '../src/data/corpus';
import {asTestLesson,questions,score} from '../src/shared/content';
const records=new Map<string,Corpus['records'][number]>();
function source(root:string){
 if(!records.size)for(const p of catalogue.packs.filter(p=>p.skill==='reading')){
  const files=unzipSync(new Uint8Array(readFileSync('public'+p.path)),{filter:f=>f.name==='corpus.json'});
  for(const r of (JSON.parse(new TextDecoder().decode(files['corpus.json'])) as Corpus).records)records.set(r.rootId,r);
 }
 return records.get(root)!;
}
function text(root:string){const scope=scopes.records.filter(s=>s.rootId===root).at(-1)!;return source(root).passages.find(p=>p.id===scope.parentId)!.text.slice(scope.start,scope.end);}
it.each([
 ['choice','choice:conditional-action','wikipedia-article-198435','wikipedia-article-94057'],
 ['matching','matching:Match each action to what the request asks for or rules out.','wikipedia-article-18362','gutenberg-book-1661'],
] as const)('generates exact two-root supported B1 %s, scores, preserves Test and exhausts',async(kind,operation,first,second)=>{
 const selected=await reviewedReading([source(first),source(second)],160);
 const bank={version:1 as const,failures:[],records:selected.map(r=>({...r,passages:r.passages.filter(p=>p.text===text(r.rootId))}))};
 expect(bank.records.map(r=>r.passages.length)).toEqual([1,1]);
 for(let seed=0;seed<6;seed++){
  const lesson=corpusLesson(bank,new Set(),seed,160,'B1',[],kind,[],operation)!;expect(lesson).toBeTruthy();
  expect(new Set(lesson.materials.map(m=>m.rootId))).toEqual(new Set([first,second]));
  expect(lesson.teaching).toBeTruthy();expect(lesson.workedExample).toBeTruthy();
  for(const m of lesson.materials){expect(m.blocks[0].text.split(/\s+/).length).toBeLessThanOrEqual(160);expect(corpusOperation(m.questions[0])).toBe(operation);}
  for(const {question:q} of questions(lesson)){
   const answer='kind'in q&&q.kind==='response'?'Source-supported interpretation':'kind'in q&&q.kind==='matching'?q.pairs.map(p=>p.answer):'answer'in q?q.answer:undefined;
   expect(score(q,answer!).correct).toBe('kind'in q&&q.kind==='response'?null:true);
   if(!('kind'in q&&q.kind==='response'))expect(q.hints).toHaveLength(3);
  }
  const assessed=structuredClone(lesson.materials);for(const m of assessed)for(const q of m.questions){delete q.hints;if('modelAnswer'in q)delete q.modelAnswer;}
  expect(asTestLesson(lesson).materials).toEqual(assessed);
  expect(corpusLesson(bank,new Set(lesson.materials.map(m=>m.id.slice(7))),seed,160,'B1',[],kind,[],operation)).toBeUndefined();
 }
});
it('retains all move/time limits and refuses missing, changed, repeated, hypothetical or quoted mode rules',()=>{
 const original=text('wikipedia-article-94057');
 for(let seed=0;seed<6;seed++){
  const task=corpusActionSelection(original,seed)!;expect(task.options[task.answer]).toBe('clear all the blocks in a preset block arrangement in a set number of moves');
  expect(task.options[1-task.answer]).toBe('score as many points as possible within a two-minute time limit');
  expect(original.slice(task.evidence.start,task.evidence.end)).toBe(task.sentence);expect(original.slice(task.otherEvidence.start,task.otherEvidence.end)).toBe(task.otherSentence);
 }
 for(const t of [original.replace('must clear','might clear'),original.replace('Timed Mode challenges','Puzzle Mode challenges'),original.replace('The blocks in this mode do not rise towards the top.',''),`“${original}”`,`Imagine this game. ${original}`,original+original])expect(corpusActionSelection(t,0)).toBeUndefined();
});
it('requires the complete addressed refusal, retains the request as advice and never scores compliance',()=>{
 const original=text('gutenberg-book-1661');const task=corpusRequests(original,0)!;expect(task).toBeTruthy();
 expect(original.slice(task.evidence.start,task.evidence.end)).toContain('but I cannot do that');
 expect(task.pairs).toEqual([{label:'Let the whole incident be a sealed book',answer:'Requested'},{label:'allow it to affect your life',answer:'Ruled out'}]);
 for(const t of [original.slice(0,original.indexOf('“You are very kind')),original.replace('Mr. Holmes','Mr. Watson'),original.replace('cannot do that','will do that'),original.replace('do not allow','allow'),original.replace('Let the whole incident','Let only the whole incident')])expect(corpusRequests(t,0)).toBeUndefined();
});
