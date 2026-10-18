import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { stateChangeListeningLesson } from '../src/core/a2Listening';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';
import sources from '../public/audio/a2-speech/UPDATE.json';
it('teaches earlier→updated state on two independent originals, without inventing repair/return, dates or universal claims',()=>{
 fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{
  const l=stateChangeListeningLesson(sources,new Set(),seed)!;expect(l.goalId).toBe('heard-reported-state-change');expect(new Set(l.materials.map(m=>m.rootId)).size).toBe(2);
  for(const[i,m]of l.materials.entries()){
   expect(createHash('sha256').update(readFileSync('public'+m.audio!.src)).digest('hex')).toBe(m.audio!.sha256);const q=m.questions[0];if('kind'in q)throw new Error('Expected choice');
   expect(corpusOperation(q)).toBe('choice:heard-state-change');expect(q.hints?.length).toBe(i?undefined:3);expect(score(q,q.answer).correct).toBe(true);expect(score(q,1-q.answer).correct).toBe(false);for(const bad of[-1,2,'1'])expect(()=>score(q,bad)).toThrow();
   expect(m.blocks[0].text.slice(q.evidence.start,q.evidence.end)).toBe(m.blocks[0].text);expect(q.evidence.audioStart).toBeGreaterThanOrEqual(0);expect(q.evidence.audioEnd).toBeLessThanOrEqual(m.audio!.duration);
   if(m.blocks[0].text.startsWith('After')){expect(q.options[q.answer]).toBe('works → no longer works');expect(q.explanations[q.answer].en).toContain('incandescent');expect(q.explanations[q.answer].en).toContain('not an exact lifetime');expect(q.evidence.audioStart).toBeCloseTo(1.66);}
   else{expect(q.options[q.answer]).toBe('in the tomb → removed to the Egyptian Museum in Cairo');expect(q.options[1-q.answer]).toContain('returned to the tomb');expect(m.credit!.license).toContain('CC BY-SA 3.0');expect(m.credit!.license).toContain('transcript CC BY-SA 4.0');expect(m.credit!.license).toContain('recording CC BY 4.0');expect(q.explanations[q.answer].en).toContain('not a verified live location');}
   for(const locale of['en','zh-Hans','zh-Hant']as const){expect(q.explanations[1-q.answer][locale].length).toBeGreaterThan(70);expect(l.teaching![locale].length).toBeGreaterThan(150);expect(l.workedExample![locale]).not.toMatch(/bulb|Cairo|tomb|filament|Museum/);}
  }
  const bare=structuredClone(l.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(l).materials).toEqual(bare);expect(asTestLesson(l).teaching).toBeUndefined();
 }),{numRuns:150});
});
it('fails closed on unknown, changed/ambiguous, duplicate or missing source/evidence and exhausted same-goal application',()=>{
 expect(stateChangeListeningLesson([],new Set(),0)).toBeUndefined();for(const s of sources){expect(stateChangeListeningLesson([s],new Set(),0)).toBeUndefined();expect(stateChangeListeningLesson(sources,new Set([s.audio.sha256]),0)).toBeUndefined();}
 expect(()=>stateChangeListeningLesson([sources[0],sources[0]],new Set(),0)).toThrow(/DUPLICATE/);for(const seed of[-1,.5,NaN,0x100000000])expect(()=>stateChangeListeningLesson(sources,new Set(),seed)).toThrow();
 for(const mutate of[(s:typeof sources[number])=>{s.text=s.text.replace('no longer','still');},(s:typeof sources[number])=>{s.segments[0].audioEnd=99;},(s:typeof sources[number])=>{s.segments.pop();},(s:typeof sources[number])=>{s.sourceHash='0'.repeat(64);},(s:typeof sources[number])=>{s.credit.license='unrestricted';},(s:typeof sources[number])=>{s.audio.author='someone else';}]){const input=structuredClone(sources);mutate(input[0]);expect(()=>stateChangeListeningLesson(input,new Set(),0)).toThrow();}
 const l=stateChangeListeningLesson(sources,new Set(),0)!;for(const change of[(m:typeof l.materials[number])=>{m.audio!.sha256='0'.repeat(64);},(m:typeof l.materials[number])=>{m.blocks[0].text+=' invented';},(m:typeof l.materials[number])=>{m.credit!.license='CC BY 4.0 only';}]){const x=structuredClone(l);change(x.materials[0]);expect(lessonSchema.safeParse(x).success).toBe(false);}
});
