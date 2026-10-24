import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {expect,it} from 'vitest';
import catalogue from '../content/source-packs.json';
import {corpusLesson,corpusQualifiedCause} from '../src/core/corpus';
import {corpusOperation} from '../src/core/corpusPractice';
import {reviewedExcerpts,reviewedReading} from '../src/data/corpus';
import {asTestLesson,questions,score} from '../src/shared/content';
import type {Corpus} from '../src/core/corpus';
const records=new Map<string,Corpus['records'][number]>();
function source(root:string){
 if(!records.size)for(const p of catalogue.packs.filter(p=>p.skill==='reading')){
  const files=unzipSync(new Uint8Array(readFileSync('public'+p.path)),{filter:f=>f.name==='corpus.json'});
  for(const r of (JSON.parse(new TextDecoder().decode(files['corpus.json'])) as Corpus).records)records.set(r.rootId,r);
 }
 return records.get(root)!;
}
function paragraph(root:string,needle:string){return source(root).passages.flatMap(p=>p.text.split('\n\n')).find(p=>p.includes(needle))!;}
const cases=[
 ['openstax-book-us-history','this civilization declined'],
 ['frontiers-article-10.3389-frym.2024.1282740','the vaccine did not work consistently'],
] as const;
it('generates and scores both inspected roots at 160 words, preserves Test and stops when both are seen',async()=>{
 const records=(await reviewedReading(cases.map(([root])=>source(root)),160)).map(r=>({...r,
  passages:r.passages.filter(p=>p.text===paragraph(r.rootId,cases.find(([root])=>root===r.rootId)![1]))}));
 expect(records.map(r=>r.passages.length)).toEqual([1,1]);
 const bank={version:1 as const,records,failures:[]};
 const lesson=corpusLesson(bank,new Set(),1,160,'B1',[],'choice','choice:qualified-cause')!;
 expect(lesson).toBeTruthy();expect(new Set(lesson.materials.map(m=>m.rootId))).toEqual(new Set(cases.map(([root])=>root)));
 for(const material of lesson.materials){
  expect(material.blocks[0].text.trim().split(/\s+/).length).toBeLessThanOrEqual(160);
  expect(corpusOperation(material.questions[0])).toBe('choice:qualified-cause');
 }
 for(const {question:q}of questions(lesson)){
  const answer='kind'in q&&q.kind==='response'?'A source-supported interpretation':'answer'in q?q.answer:undefined;
  expect(score(q,answer!).correct).toBe('kind'in q&&q.kind==='response'?null:true);
 }
 const assessed=structuredClone(lesson.materials);
 for(const material of assessed)for(const q of material.questions){delete q.hints;if('modelAnswer'in q)delete q.modelAnswer;}
 expect(asTestLesson(lesson).materials).toEqual(assessed);
 const seen=new Set(lesson.materials.map(m=>m.id.slice('corpus-'.length)));
 expect(corpusLesson(bank,seen,1,160,'B1',[],'choice','choice:qualified-cause')).toBeUndefined();
});
it.each(cases)('preserves the exact source context and uncertainty at the supported B1 bound: %s',(root,needle)=>{
 const text=paragraph(root,needle);expect(text).toBeTruthy();expect(text.trim().split(/\s+/).length).toBeGreaterThanOrEqual(120);expect(text.trim().split(/\s+/).length).toBeLessThanOrEqual(160);
 for(let seed=0;seed<6;seed++){
  const task=corpusQualifiedCause(text,seed)!;expect(task).toBeTruthy();expect(task.options[task.answer]).toBe('The passage states what happened but only proposes an explanation.');
  expect(text.slice(task.evidence.start,task.evidence.end)).toContain(task.sentence);expect(text.slice(task.evidence.start,task.evidence.end)).toContain(root.startsWith('openstax')?'Cahokia':'TickGARD');
 }
});
it('refuses missing, changed, cross-paragraph, reported or quoted antecedents and unqualified explanations',()=>{
 const city=paragraph(cases[0][0],cases[0][1]);const vaccine=paragraph(cases[1][0],cases[1][1]);
 for(const text of [city.slice(city.indexOf('After 1300')),city.replace('Cahokia, was home','Cuzco, was home'),city.replace('After 1300','\n\nAfter 1300'),city.replace('declined—possibly because','declined—because'),city.replace('this civilization declined','this civilization may have declined'),city.replace('After 1300 CE, however,','A historian suggested that after 1300 CE,'),`“${city}”`,vaccine.slice(vaccine.indexOf('However,')),vaccine.replace('(TickGARD)','(OtherVaccine)'),vaccine.replace('However,','A different vaccine was introduced. However,'),vaccine.replace('possibly due to','due to'),vaccine.replace('did not work consistently','may not have worked consistently'),`“${vaccine}”`])expect(corpusQualifiedCause(text,0)).toBeUndefined();
});
it('treats decade plurals as internal apostrophes while retaining real unmatched-quote rejection',()=>{
 const text=paragraph(cases[1][0],cases[1][1]);
 for(const decade of ['1980’s',"1980's",'1960’s'])expect(corpusQualifiedCause(text.replace('1980’s',decade),0)).toBeTruthy();
 for(const damaged of ['1980’','1980‘s','1981’s',"'1980’s"])expect(corpusQualifiedCause(text.replace('1980’s',damaged),0)).toBeUndefined();
});
it('holds the exact prescriptive religious quotation while preserving neutral historical source text',async()=>{
 const r=source('wikipedia-article-7567080');expect(r.originalText).toBeTruthy();const text=r.originalText!;const start=text.indexOf('A piece of paper was later found on which Luther had written his last statement.');const end=text.indexOf('We are beggars: this is true.',start)+'We are beggars: this is true.'.length;expect(start).toBeGreaterThan(0);
 expect(await reviewedExcerpts(r,[{text:text.slice(start,end)}])).toEqual([]);
 const neutral=r.passages.find(p=>!p.text.includes('Holy Writers')&&!p.text.includes('divine Aeneid'))!;expect(await reviewedExcerpts(r,[neutral])).toEqual([neutral]);
});
