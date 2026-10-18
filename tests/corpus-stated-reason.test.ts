import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusSchema, corpusStatedReason } from '../src/core/corpus';
import { reviewedReading } from '../src/data/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';
import scopes from '../content/corpus/a2-personal-goal-scopes.json';
const original = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8'))), operation='choice:personal-reason';
it('teaches the explicit reason rather than habit, with real source evidence, both scores and independent unassisted application',async()=>{
 const bank={...original,records:await reviewedReading(original.records,160)};
 fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{
  const l=corpusLesson(bank,new Set(),seed,160,'A2',[],'choice',[],operation)!;expect(l.goalId).toBe('explicit-stated-reason');expect(l.materials.map(m=>m.rootId).sort()).toEqual(scopes.reason.map(s=>s.rootId).sort());
  for(const[i,m]of l.materials.entries()){
   const q=m.questions[0];if('kind'in q)throw new Error('Expected choice');expect(corpusOperation(q)).toBe(operation);expect(q.hints?.length).toBe(i?undefined:3);
   expect(createHash('sha256').update(m.blocks[0].text).digest('hex')).toBe(scopes.reason.find(s=>s.rootId===m.rootId)!.textSha256);const exact=m.blocks[0].text.slice(q.evidence.start,q.evidence.end);expect(exact).toContain('because');
   const activity=m.rootId==='voa-article-3312239';expect(q.options[q.answer]).toBe(activity?'it’s Shakespeare’s birthday':'it is good for you');expect(q.options[1-q.answer]).toBe(activity?'she always listens to drum bands':'she always jogs');
   expect(score(q,q.answer).correct).toBe(true);expect(score(q,1-q.answer).correct).toBe(false);for(const bad of[-1,2,'1'])expect(()=>score(q,bad)).toThrow();
   expect(q.explanations[q.answer].en).toContain(activity?'usual habit':'proposed trial');
   for(const locale of['en','zh-Hans','zh-Hant']as const){expect(q.explanations[1-q.answer][locale].length).toBeGreaterThan(60);expect(l.teaching![locale].length).toBeGreaterThan(100);expect(l.workedExample![locale]).not.toMatch(/Anna|Shakespeare|jog|drum/);}
  }
  const bare=structuredClone(l.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(l).materials).toEqual(bare);expect(l).toEqual(JSON.parse(JSON.stringify(l)));
 }),{numRuns:150});
 for(const s of scopes.reason){expect(corpusLesson(bank,new Set([s.passageId]),0,120,'A2',[],'choice',[],operation)).toBeUndefined();expect(corpusLesson({...bank,records:bank.records.filter(r=>r.rootId===s.rootId)},new Set(),0,120,'A2',[],'choice',[],operation)).toBeUndefined();}
 for(const point of['A1','B1','B2','C1','C2']as const)expect(corpusLesson(bank,new Set(),0,160,point,[],'choice',[],operation)).toBeUndefined();
});
it('rejects absent/replaced causal cues, changed habits or hypothetical actions, duplicates and competing unscoped contexts',async()=>{
 const bank=await reviewedReading(original.records,120),texts=scopes.reason.map(s=>bank.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!.text),[activity,trial]=texts;
 for(const text of[activity.replaceAll('because','although'),activity.replace('I never listen','I always listen'),activity.replace('today I am listening','today I might listen'),trial.replace('because','although'),trial.replace('I will try','I might try'),trial.replace('Okay, I never jog.','Okay, I always jog.'),activity+'\n'+activity,trial+'\n'+trial,activity+'\n'+trial])expect(corpusStatedReason(text,0)).toBeUndefined();
 expect(corpusStatedReason('She opened the door. Then she went outside.',0)).toBeUndefined();expect(()=>corpusStatedReason('',-1)).toThrow();expect(()=>corpusStatedReason('x'.repeat(12001),0)).toThrow();
});
it('preserves full originals and verifies both contiguous whole-turn projections/source/parent hashes',async()=>{
 const snapshot=structuredClone(original),records=await reviewedReading(original.records,120);expect(original).toEqual(snapshot);
 for(const s of scopes.reason){const source=original.records.find(r=>r.rootId===s.rootId)!;const parent=source.passages.find(p=>p.id===s.parentId)!;const view=records.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!;expect(view.text).toBe(parent.text.slice(s.start,s.end));expect(view.wordCount).toBe(s.words);expect(view.startingPoints).toEqual(['A2']);await expect(reviewedReading([{...source,sourceHash:'0'.repeat(64)}])).rejects.toThrow('CORPUS_INTEGRITY');await expect(reviewedReading([{...source,passages:source.passages.map(p=>p.id===s.parentId?{...p,text:p.text+' changed'}:p)}])).rejects.toThrow('CORPUS_INTEGRITY');}
});
