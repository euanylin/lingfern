import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusSchema, corpusStatedRule } from '../src/core/corpus';
import { reviewedReading } from '../src/data/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';
import scopes from '../content/corpus/a2-personal-goal-scopes.json';
const original=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json','utf8'))),operation='choice:personal-rule';
it('generates scoped everyday rules from two inspected originals with true alternatives, exact evidence and unassisted application',async()=>{
 const bank={...original,records:await reviewedReading(original.records,160)};
 fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{
  const l=corpusLesson(bank,new Set(),seed,160,'A2',[],'choice',operation)!;expect(l.goalId).toBe('explicit-stated-rule');expect(l.materials.map(m=>m.rootId).sort()).toEqual(scopes.rule.map(s=>s.rootId).sort());
  for(const[i,m]of l.materials.entries()){
   const q=m.questions[0];if('kind'in q)throw new Error('Expected choice');expect(corpusOperation(q)).toBe(operation);expect(q.hints?.length).toBe(i?undefined:3);
   expect(createHash('sha256').update(m.blocks[0].text).digest('hex')).toBe(scopes.rule.find(s=>s.rootId===m.rootId)!.textSha256);
   const party=m.rootId==='voa-article-3406732',exact=m.blocks[0].text.slice(q.evidence.start,q.evidence.end);expect(exact).toContain(party?'or you can perform':'cannot say you are angry');
   expect(q.options[q.answer]).toContain(party?'or performing':'On The News');expect(q.options[1-q.answer]).toContain(party?'both':'outside The News');
   expect(score(q,q.answer).correct).toBe(true);expect(score(q,1-q.answer).correct).toBe(false);for(const bad of[-1,2,'1'])expect(()=>score(q,bad)).toThrow();
   for(const locale of['en','zh-Hans','zh-Hant']as const){expect(q.explanations[1-q.answer][locale].length).toBeGreaterThan(60);expect(l.teaching![locale].length).toBeGreaterThan(100);expect(l.workedExample![locale]).not.toMatch(/Anna|Marsha|Caty|party|News/);}
  }
  const bare=structuredClone(l.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(l).materials).toEqual(bare);expect(l).toEqual(JSON.parse(JSON.stringify(l)));
 }),{numRuns:150});
 for(const s of scopes.rule){expect(corpusLesson(bank,new Set([s.passageId]),0,120,'A2',[],'choice',operation)).toBeUndefined();expect(corpusLesson({...bank,records:bank.records.filter(r=>r.rootId===s.rootId)},new Set(),0,120,'A2',[],'choice',operation)).toBeUndefined();}
 for(const point of['A1','B1','B2','C1','C2']as const)expect(corpusLesson(bank,new Set(),0,160,point,[],'choice',operation)).toBeUndefined();
});
it('rejects changed operators, missing scope, duplicate rules and competing contexts rather than inventing a rule',async()=>{
 const bank=await reviewedReading(original.records,120),[news,party]=scopes.rule.map(s=>bank.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!.text);
 for(const text of[news.replace('cannot say','can say'),news.replaceAll('The News','anywhere'),party.replace('or you can perform','and you must perform'),party.replace('Everyone has to','Someone might'),party.replace('Marsha: Great! I have to help my friend with the party. Can you help me?',''),news+'\n'+news,party+'\n'+party,news+'\n'+party])expect(corpusStatedRule(text,0)).toBeUndefined();
 expect(corpusStatedRule('Anna likes music and must leave soon.',0)).toBeUndefined();expect(()=>corpusStatedRule('',-1)).toThrow();expect(()=>corpusStatedRule('x'.repeat(12001),0)).toThrow();
});
it('preserves originals and validates exact parent, source and whole-turn view hashes',async()=>{
 const snapshot=structuredClone(original),records=await reviewedReading(original.records,120);expect(original).toEqual(snapshot);
 for(const s of scopes.rule){const source=original.records.find(r=>r.rootId===s.rootId)!;const parent=source.passages.find(p=>p.id===s.parentId)!;const view=records.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!;expect(view.text).toBe(parent.text.slice(s.start,s.end));expect(view.wordCount).toBe(s.words);expect(view.startingPoints).toEqual(['A2']);await expect(reviewedReading([{...source,sourceHash:'0'.repeat(64)}])).rejects.toThrow('CORPUS_INTEGRITY');await expect(reviewedReading([{...source,passages:source.passages.map(p=>p.id===s.parentId?{...p,text:p.text+' changed'}:p)}])).rejects.toThrow('CORPUS_INTEGRITY');}
});
