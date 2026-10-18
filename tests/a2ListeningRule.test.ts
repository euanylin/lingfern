import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { statedRuleListeningLesson } from '../src/core/a2Listening';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';
import sources from '../public/audio/a2-speech/RULE.json';
it('preserves required/optional force, exact conditions, source/audio evidence and independent application',()=>{
 fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{
  const l=statedRuleListeningLesson(sources,new Set(),seed)!;expect(l.goalId).toBe('heard-stated-rule');expect(new Set(l.materials.map(m=>m.rootId)).size).toBe(2);
  for(const[i,m]of l.materials.entries()){
   expect(createHash('sha256').update(readFileSync('public'+m.audio!.src)).digest('hex')).toBe(m.audio!.sha256);const q=m.questions[0];if('kind'in q)throw new Error('Expected choice');expect(corpusOperation(q)).toBe('choice:heard-stated-rule');expect(q.hints?.length).toBe(i?undefined:3);
   expect(score(q,q.answer).correct).toBe(true);expect(score(q,1-q.answer).correct).toBe(false);for(const bad of[-1,2,'1'])expect(()=>score(q,bad)).toThrow();expect(q.evidence).toEqual({start:0,end:m.blocks[0].text.length,audioStart:0,audioEnd:m.audio!.duration});
   if(m.rootId==='wikipedia-article-45262844'){expect(q.options[q.answer]).toContain('must select');expect(q.options[1-q.answer]).toContain('without first selecting');expect(q.explanations[q.answer].en).toContain('player can never change');}
   else{expect(q.options[q.answer]).toContain('could keep');expect(q.options[1-q.answer]).toContain('had to stop');expect(q.explanations[q.answer].en).toContain('before stage five');}
   expect(m.credit!.license).toContain('CC BY-SA 3.0');expect(m.credit!.license).toContain('4.0');
   for(const locale of['en','zh-Hans','zh-Hant']as const){expect(q.explanations[1-q.answer][locale].length).toBeGreaterThan(70);expect(l.teaching![locale].length).toBeGreaterThan(100);expect(l.workedExample![locale]).not.toMatch(/Mario|Peach|Bowser|resident|simulation/);}
  }
  const bare=structuredClone(l.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(l).materials).toEqual(bare);expect(asTestLesson(l).teaching).toBeUndefined();
 }),{numRuns:150});
});
it('withholds unseen/altered/ambiguous source frames or evidence, duplicates and exhausted independent application',()=>{
 expect(statedRuleListeningLesson([],new Set(),0)).toBeUndefined();expect(statedRuleListeningLesson(sources.filter(s=>s.audio.duration<=12),new Set(),0)).toBeUndefined();expect(statedRuleListeningLesson(sources.filter(s=>s.audio.duration<=20),new Set(),0)).toBeDefined();for(const s of sources){expect(statedRuleListeningLesson([s],new Set(),0)).toBeUndefined();expect(statedRuleListeningLesson(sources,new Set([s.audio.sha256]),0)).toBeUndefined();}
 expect(()=>statedRuleListeningLesson([sources[0],sources[0]],new Set(),0)).toThrow(/DUPLICATE/);for(const seed of[-1,.5,NaN,0x100000000])expect(()=>statedRuleListeningLesson(sources,new Set(),seed)).toThrow();
 for(const mutate of[(s:typeof sources[number])=>{s.text=s.text.replace('requires','permits');},(s:typeof sources[number])=>{s.text+=' invented because';},(s:typeof sources[number])=>{s.segments.pop();},(s:typeof sources[number])=>{s.segments[0].audioEnd=99;},(s:typeof sources[number])=>{s.sourceHash='0'.repeat(64);},(s:typeof sources[number])=>{s.credit.license='unrestricted';},(s:typeof sources[number])=>{s.audio.author='other';}]){const input=structuredClone(sources);mutate(input[0]);expect(()=>statedRuleListeningLesson(input,new Set(),0)).toThrow();}
 const l=statedRuleListeningLesson(sources,new Set(),0)!;for(const change of[(m:typeof l.materials[number])=>{m.audio!.sha256='0'.repeat(64);},(m:typeof l.materials[number])=>{m.blocks[0].text+=' invented';},(m:typeof l.materials[number])=>{m.credit!.license='global public domain';}]){const x=structuredClone(l);change(x.materials[0]);expect(lessonSchema.safeParse(x).success).toBe(false);}
});
