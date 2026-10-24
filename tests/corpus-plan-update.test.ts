import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusSchema, corpusPlanUpdate } from '../src/core/corpus';
import { reviewedReading } from '../src/data/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';
import scopes from '../content/corpus/a2-personal-goal-scopes.json';
const original = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const operation = 'choice:personal-update';
it('teaches the later personal reply/request with source-bound earlier and intervening evidence, not an invented external change', async () => {
  const bank = { ...original, records: await reviewedReading(original.records, 160) };
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = corpusLesson(bank, new Set(), seed, 160, 'A2', [], 'choice', operation)!;
    expect(lesson).toBeDefined(); expect(lesson.goalId).toBe('explicit-personal-update');
    expect(lesson.materials.map(m => m.rootId).sort()).toEqual(scopes.update.map(s => s.rootId).sort());
    for (const [index, m] of lesson.materials.entries()) {
      const q = m.questions[0]; if ('kind' in q) throw new Error('Expected choice');
      expect(corpusOperation(q)).toBe(operation); expect(q.hints?.length).toBe(index ? undefined : 3);
      expect(createHash('sha256').update(m.blocks[0].text).digest('hex')).toBe(scopes.update.find(s => s.rootId === m.rootId)!.textSha256);
      expect(q.additionalEvidence).toHaveLength(2); const prior = m.blocks[0].text.slice(q.additionalEvidence![0].start, q.additionalEvidence![0].end);
      expect(prior).toMatch(/can’t come|have the shrimp/); expect(m.blocks[0].text.slice(q.evidence.start, q.evidence.end)).toMatch(/Then I can come|have the beef/);
      expect(q.options[q.answer]).toBe(m.rootId === 'voa-article-3406732' ? 'can come with you' : 'have the beef');
      expect(q.options[1 - q.answer]).toBe(m.rootId === 'voa-article-3406732' ? 'can’t come with you' : 'have the shrimp');
      expect(score(q,q.answer).correct).toBe(true);expect(score(q,1-q.answer).correct).toBe(false);
      for (const bad of [-1,2,'1'])expect(()=>score(q,bad)).toThrow();
      for (const locale of ['en','zh-Hans','zh-Hant'] as const) { expect(q.explanations[1-q.answer][locale].length).toBeGreaterThan(70);expect(lesson.teaching![locale].length).toBeGreaterThan(100);expect(lesson.workedExample![locale]).not.toMatch(/Anna|Jonathan|party|shrimp|beef/); }
    }
    const bare=structuredClone(lesson.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(lesson).materials).toEqual(bare);
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
  }),{numRuns:150});
  for(const s of scopes.update){expect(corpusLesson(bank,new Set([s.passageId]),0,160,'A2',[],'choice',operation)).toBeUndefined();expect(corpusLesson({...bank,records:bank.records.filter(r=>r.rootId===s.rootId)},new Set(),0,160,'A2',[],'choice',operation)).toBeUndefined();}
  for(const point of ['A1','B1','B2','C1','C2'] as const)expect(corpusLesson(bank,new Set(),0,160,point,[],'choice',operation)).toBeUndefined();
});
it('rejects absent, hypothetical, reversed, duplicated or conflicting update/context frames',async()=>{
 const bank=await reviewedReading(original.records,160),texts=scopes.update.map(s=>bank.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!.text);const [food,party]=texts;
 for(const text of [party.replace('Marsha: The party is at night.',''),party.replace('Then I can come','Then I might come'),party.replace('Sorry, I can’t come','Sorry, I can come'),food.replace('Oh, you’re out of shrimp.','Oh, you have shrimp.'),food.replace('Okay, I’ll have the beef then.','Okay, I might have the beef then.'),party+'\n'+party,food+'\n'+food,party+'\n'+food])expect(corpusPlanUpdate(text,0)).toBeUndefined();
 const before='Anna: Sorry, I can’t come with you. I have to get my driver’s license.',after='Anna: Oh. Then I can come with you to the party on Saturday night.';expect(corpusPlanUpdate(after+'\nMarsha: The party is at night.\n'+before,0)).toBeUndefined();
 expect(corpusPlanUpdate('Anna: My bus was late, and now it is early.',0)).toBeUndefined();expect(()=>corpusPlanUpdate('',-1)).toThrow();expect(()=>corpusPlanUpdate('x'.repeat(12001),0)).toThrow();
});
it('checks entire parents/projection SHA, exact source and original conservation before short-view generation',async()=>{
 const snapshot=structuredClone(original);for(const scope of scopes.update){const source=original.records.find(r=>r.rootId===scope.rootId)!;await expect(reviewedReading([{...source,sourceHash:'f'.repeat(64)}])).rejects.toThrow('CORPUS_INTEGRITY');await expect(reviewedReading([{...source,passages:source.passages.map(p=>p.id===scope.parentId?{...p,text:p.text+' changed'}:p)}])).rejects.toThrow('CORPUS_INTEGRITY');}
 const result=await reviewedReading(original.records,120);expect(original).toEqual(snapshot);const s=scopes.update[0];const text=result.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!;const parent=original.records.flatMap(r=>r.passages).find(p=>p.id===s.parentId)!;expect(text.text).toBe(parent.text.slice(s.start,s.end));expect(text.wordCount).toBe(113);expect(text.startingPoints).toEqual(['A2']);
});
