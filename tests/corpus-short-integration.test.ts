import type { Session } from '../src/data/db';
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{expect,it}from'vitest';import fc from'fast-check';
import{corpusLesson,corpusSchema,corpusShortIntegration}from'../src/core/corpus';import{reviewedReading}from'../src/data/corpus';import{corpusOperation}from'../src/core/corpusPractice';import{asTestLesson,score}from'../src/shared/content';import scopes from'../content/corpus/a2-personal-goal-scopes.json';
const original=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json','utf8'))),op='choice:personal-integration';
it('requires both exact clues with four crossed options, specific half-errors, three-language support and a different-original unassisted application',async()=>{
 const bank={...original,records:await reviewedReading(original.records,160)};
 fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{const l=corpusLesson(bank,new Set(),seed,160,'A2',[],'choice',[],op)!;expect(l.goalId).toBe('short-two-clue-integration');expect(l.materials.map(m=>m.rootId).sort()).toEqual(scopes.integration.map(s=>s.rootId).sort());
  for(const[i,m]of l.materials.entries()){
   const q=m.questions[0];if('kind'in q)throw Error('Expected choice');expect(corpusOperation(q)).toBe(op);expect(q.options).toHaveLength(4);expect(new Set(q.options).size).toBe(4);expect(q.hints?.length).toBe(i?undefined:3);expect(q.additionalEvidence).toHaveLength(1);expect(q.explanations.map(x=>x.en.split('. ')[0]).sort()).toEqual(['Both clues match','Check both clues','Check the first clue','Check the second clue'].sort());
   expect(createHash('sha256').update(m.blocks[0].text).digest('hex')).toBe(scopes.integration.find(s=>s.rootId===m.rootId)!.textSha256);
   for(let a=0;a<4;a++)expect(score(q,a).correct).toBe(a===q.answer);for(const bad of[-1,4,'1'])expect(()=>score(q,bad)).toThrow();const first=m.blocks[0].text.slice(q.evidence.start,q.evidence.end),second=m.blocks[0].text.slice(q.additionalEvidence![0].start,q.additionalEvidence![0].end);expect(first.length).toBeGreaterThan(40);expect(second.length).toBeGreaterThan(30);
   if(m.rootId==='voa-article-3293986'){expect(first).toContain('before we get ice cream');expect(second).toContain('on this street on the corner');expect(q.options[q.answer]).toContain('before getting ice cream');}else{expect(first).toContain('Saturday night');expect(second).toContain('or you can perform');expect(q.options[q.answer]).toContain('with food or a performance');}
   for(const locale of['en','zh-Hans','zh-Hant']as const){expect(l.teaching![locale].length).toBeGreaterThan(100);expect(l.workedExample![locale]).not.toMatch(/Anna|Marsha|party|library|ice cream/);for(const e of q.explanations)expect(e[locale].length).toBeGreaterThan(65);}
  }
  const bare=structuredClone(l.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(l).materials).toEqual(bare);expect(l).toEqual(JSON.parse(JSON.stringify(l)));
 }),{numRuns:150});
 for(const s of scopes.integration){expect(corpusLesson(bank,new Set([s.passageId]),0,120,'A2',[],'choice',[],op)).toBeUndefined();expect(corpusLesson({...bank,records:bank.records.filter(r=>r.rootId===s.rootId)},new Set(),0,120,'A2',[],'choice',[],op)).toBeUndefined();}
 for(const point of['A1','B1','B2','C1','C2']as const)expect(corpusLesson(bank,new Set(),0,160,point,[],'choice',[],op)).toBeUndefined();
});
it('rejects either missing or changed clue, ambiguity, reversed evidence context, unrelated sequence and duplicate competing contexts',async()=>{
 const bank=await reviewedReading(original.records,120),[library,party]=scopes.integration.map(s=>bank.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!.text);
 for(const t of[library.replace('before we get ice cream','after we get ice cream'),library.replace('on this street on the corner','on another street'),party.replaceAll('Saturday night','Saturday morning'),party.replace('food, or you can perform','food and you must perform'),library.split('\n').reverse().join('\n'),library+'\n'+library,party+'\n'+party,library+'\n'+party,'First she opened the door. Then she left.'])expect(corpusShortIntegration(t,0)).toBeUndefined();
 expect(()=>corpusShortIntegration('',-1)).toThrow();expect(()=>corpusShortIntegration('x'.repeat(12001),0)).toThrow();
});
it('retains originals and verifies both exact source/parent/view hashes and full single/double-newline dialogue turns',async()=>{
 const snapshot=structuredClone(original),bank=await reviewedReading(original.records,120);expect(original).toEqual(snapshot);
 for(const s of scopes.integration){const r=original.records.find(r=>r.rootId===s.rootId)!,p=r.passages.find(p=>p.id===s.parentId)!,v=bank.flatMap(r=>r.passages).find(p=>p.id===s.passageId)!;expect(v.text).toBe(p.text.slice(s.start,s.end));expect(v.wordCount).toBe(s.words);expect(s.end===p.text.length||p.text[s.end]==='\n').toBe(true);await expect(reviewedReading([{...r,sourceHash:'0'.repeat(64)}])).rejects.toThrow('CORPUS_INTEGRITY');await expect(reviewedReading([{...r,passages:r.passages.map(x=>x.id===p.id?{...x,text:x.text+' changed'}:x)}])).rejects.toThrow('CORPUS_INTEGRITY');}
});

it('saves both real generated skills and both modes through exposure/answer transactions and portable backup within the existing ID bound',async()=>{
 const {advance,attempts,claimSession,createSession,db,exposures,markExposure,recordPlayback,sessions,submit}=await import('../src/data/db');const {exportBackup,inspectBackup}=await import('../src/data/backup');const {integrationListeningSources,shortIntegrationListeningLesson}=await import('../src/core/a2Listening');
 await Promise.all(db.tables.map(t=>t.clear()));try{const bank={...original,records:await reviewedReading(original.records,160)},reading=corpusLesson(bank,new Set(),0,160,'A2',[],'choice',[],op)!,listening=shortIntegrationListeningLesson(integrationListeningSources,new Set(),0)!;
 for(const practice of[reading,listening])for(const lesson of[practice,asTestLesson(practice)]){const profileId=`integration-${lesson.skill}-${lesson.mode??'practice'}`,session=await createSession(lesson,profileId);let current: Session=await claimSession(session.id,'integration-owner');
  for(const[position,material]of lesson.materials.entries()){const q=material.questions[0];if('kind'in q)throw Error('Expected choice');expect(q.id.length).toBeLessThanOrEqual(80);expect(q.id).toBe(`${material.id}-int`);expect(current.position).toBe(position);await markExposure(current);expect((await exposures.get([profileId,material.rootId]))!.contacts).toContainEqual(expect.objectContaining({questionId:q.id,variantGroup:q.id}));if(lesson.skill==='listening'){await recordPlayback(session.id,'integration-owner',q.id,false);await recordPlayback(session.id,'integration-owner',q.id,true);}const saved=await submit(session.id,'integration-owner',q.answer);expect(saved.correct).toBe(true);expect(await attempts.get(saved.id)).toEqual(saved);expect((await sessions.get(session.id))!.position).toBe(position);current=await advance(session.id,'integration-owner');}
  expect((await sessions.get(session.id))!.status).toBe('completed');const backup=await inspectBackup(await exportBackup(profileId));expect(backup.records.sessions[0].lesson).toEqual(lesson);expect(backup.records.attempts).toHaveLength(2);expect(backup.records.exposures).toHaveLength(2);
 }
 }finally{await Promise.all(db.tables.map(t=>t.clear()));}
});
