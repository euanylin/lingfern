import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {expect,it} from 'vitest';
import catalogue from '../content/source-packs.json';
import scopes from '../content/corpus/short-reading-scopes.json';
import {corpusLesson,corpusSchema,filterCorpusRoots,selectCorpusPassage,registerCorpusSeenText} from '../src/core/corpus';
import {corpusOperation} from '../src/core/corpusPractice';
import {reviewedReading,mergeReadingRecords} from '../src/data/corpus';
import {asTestLesson,questions,score} from '../src/shared/content';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
function current(){return mergeReadingRecords(catalogue.packs.filter(pack=>pack.skill==='reading').flatMap(pack=>{
 const bytes=readFileSync('public'+pack.path);expect(createHash('sha256').update(bytes).digest('hex')).toBe(pack.sha256);
 const bank=corpusSchema.parse(JSON.parse(new TextDecoder().decode(unzipSync(bytes,{filter:file=>file.name==='corpus.json'})['corpus.json'])));
 return bank.records.filter(record=>scopes.records.some(scope=>scope.rootId===record.rootId)||record.rootId==='wikipedia-article-182053'||record.rootId==='openstax-book-introduction-philosophy'||record.rootId==='gutenberg-book-1661');
}));}
it('projects only inspected intact paragraph scopes and preserves original records, provenance and token offsets',async()=>{
 const original=current(),before=JSON.stringify(original),records=await reviewedReading(original,220);
 expect(JSON.stringify(original)).toBe(before);
 for(const scope of scopes.records){const source=records.find(source=>source.rootId===scope.rootId)!;const parent=source.passages.find(p=>p.id===scope.parentId)!;
  expect(sha(parent.text)).toBe(scope.parentSha256);expect(parent.text.slice(scope.start,scope.end)).toHaveLength(scope.end-scope.start);
  const projected=(await reviewedReading(original,scope.words)).find(s=>s.rootId===scope.rootId)!;const added=projected.passages.find(p=>p.id===scope.sha256)!;expect(added,scope.rootId).toBeDefined();expect(sha(added.text)).toBe(scope.sha256);expect(added.wordCount).toBe(scope.words);
  for(const token of added.language?.tokens??[])expect(parent.text.slice(token.start+scope.start,token.end+scope.start)).toBe(added.text.slice(token.start,token.end));
  corpusSchema.parse({version:1,failures:[],records:[source]});
 }
 const large=await reviewedReading(original,700);for(const scope of scopes.records)expect(large.find(s=>s.rootId===scope.rootId)!.passages.some(p=>p.id===scope.sha256)).toBe(false);
 const changed=structuredClone(original.filter(s=>scopes.records.some(scope=>scope.rootId===s.rootId)));for(const s of changed)for(const p of s.passages)if(scopes.records.some(scope=>scope.rootId===s.rootId&&scope.parentId===p.id))p.text=p.text.replace(/./,'X');
 const withheld=await reviewedReading(changed,220);for(const scope of scopes.records)expect(withheld.find(s=>s.rootId===scope.rootId)?.passages.some(p=>p.id===scope.sha256)??false).toBe(false);
});
it('closes exact B1 short action/request and supported matching/assignment pairs without relaxing bounds or scoring',async()=>{
 const original=current();for(const [maxWords,kind,operation,expectedRoots]of [
  [220,'choice','choice:conditional-action',['wikipedia-article-198435','wikipedia-article-3016491']],
  [220,'matching','matching:Match each action to what the request asks for or rules out.',['gutenberg-book-1661','wikipedia-article-18362']],
  [160,'matching','matching:Match each claim to the source named in the passage.',['voa-article-3574029','gutenberg-book-2814']],
  [160,'evidence','evidence:Which sentence explicitly states an assigned task?',['wikipedia-article-2639573','openstax-book-introduction-philosophy']],
 ] as const){const records=(await reviewedReading(original,maxWords)).filter(s=>expectedRoots.includes(s.rootId as never));const bank={version:1 as const,failures:[],records};
  for(let seed=0;seed<8;seed++){const lesson=corpusLesson(bank,new Set(),seed,maxWords,'B1',[],kind,operation)!;expect(lesson).toBeDefined();expect(lesson.materials.map(m=>m.rootId).sort()).toEqual([...expectedRoots].sort());
   expect(lesson.teaching!.en).toBeTruthy();expect(lesson.workedExample!.en).toContain('Example:');
   for(const {material,question:q}of questions(lesson)){expect(material.blocks[0].text.split(/\s+/).length).toBeLessThanOrEqual(maxWords);const evidence=material.blocks[0].text.slice(q.evidence.start,q.evidence.end);expect(evidence).toBeTruthy();
    if('kind' in q&&q.kind==='response'){expect(score(q,'Source-supported interpretation.').correct).toBeNull();continue;}
    expect(corpusOperation(q)).toBe(operation);const answer='kind' in q&&q.kind==='matching'?q.pairs.map(p=>p.answer):'kind' in q&&q.kind==='evidence'?q.accepted[0]:'answer'in q?q.answer:'';expect(score(q,answer).correct).toBe(true);
    const wrong='kind' in q&&q.kind==='matching'?[...q.pairs.map(p=>p.answer)].reverse():'kind' in q&&q.kind==='evidence'?q.spans.findIndex((_,i)=>!q.accepted.includes(i)):1-(q as {answer:number}).answer;expect(score(q,wrong).correct).toBe(false);
   }
   const test=asTestLesson(lesson);expect(test.teaching).toBeUndefined();expect(test.workedExample).toBeUndefined();expect(test.materials.map(m=>m.blocks)).toEqual(lesson.materials.map(m=>m.blocks));expect(test.materials.flatMap(m=>m.questions).every(q=>!q.hints)).toBe(true);
   const seen=new Set(lesson.materials.map(m=>m.rootId));expect(corpusLesson(filterCorpusRoots(bank,seen),new Set(),seed,maxWords,'B1',[],kind,operation)).toBeUndefined();
  }
 }
});

it('rejects both parent-to-short and saved-short-to-parent exposure across changed bounds',async()=>{
 const originals=current();
 for(const scope of scopes.records){
  const original=originals.find(s=>s.rootId===scope.rootId)!;const projected=(await reviewedReading([original],scope.words))[0];
  const short=projected.passages.find(p=>p.id===scope.sha256)!;const parent=projected.passages.find(p=>p.id===scope.parentId)!;
  const source={...projected,passages:[parent,short]};
  expect(selectCorpusPassage({version:1,failures:[],records:[source]},new Set([parent.id]),0,scope.words)).toBeUndefined();
  const larger={...original,passages:[parent]};registerCorpusSeenText(larger,short.id,short.text);
  expect(selectCorpusPassage({version:1,failures:[],records:[larger]},new Set([short.id]),0,700)).toBeUndefined();
  expect(selectCorpusPassage({version:1,failures:[],records:[{...larger,originalText:undefined}]},new Set([short.id]),0,700)).toBeUndefined();
 }
});
