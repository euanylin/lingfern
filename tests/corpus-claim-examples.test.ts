import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{expect,it,vi}from'vitest';import fc from'fast-check';
import{corpusClaimExamples,claimExampleOperation}from'../src/core/corpusClaimExamples';import{corpusLesson,corpusSchema}from'../src/core/corpus';import{corpusOperation}from'../src/core/corpusPractice';import{reviewedReading}from'../src/data/corpus';import{asTestLesson,practiceLocale,questionSchema,score}from'../src/shared/content';import scopes from'../content/corpus/b2-claim-example-scopes.json';import longAdmission from'../content/corpus/long-listening-admission.json';
import{inspectCommunityPack}from'../src/data/communityPack';import{spokenCorpusLesson,spokenCorpusSchema}from'../src/core/spokenCorpus';import{qualifiedLongSeconds}from'../src/core/spokenLongAdmission';
const originals=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/additional-2.json','utf8'))).records.filter(r=>scopes.records.some(s=>s.rootId===r.rootId));
it('binds reviewed claim/example material to its original identity, source hash and unchanged credits, not copied text under a different root',async()=>{
 const bank={version:1 as const,failures:[],records:await reviewedReading(originals,300)};
 for(const record of bank.records)for(const change of[
  {sourceHash:'f'.repeat(64)},
  {id:'frontiers-10.3389-frym.2020.999999',rootId:'frontiers-article-10.3389-frym.2020.999999',originalUrl:'https://kids.frontiersin.org/articles/10.3389/frym.2020.999999',downloadUrl:'https://kids.frontiersin.org/articles/10.3389/frym.2020.999999'},
  {attribution:'Changed author and source credit'},
  {licence:'Public domain'},
 ]){
  const changed={...bank,records:bank.records.map(r=>r===record?{...r,...change}:r)};
  corpusSchema.parse(changed);
  for(const seed of[0,1,0xffffffff])expect(corpusLesson(changed,new Set(),seed,300,'B2',[],'matching',claimExampleOperation)).toBeUndefined();
 }
 expect(corpusLesson(bank,new Set(),0,300,'B2',[],'matching',claimExampleOperation)!.goalId).toBe('claim-example-link');
});
it('maps each locally framed example with intact scope, independent source evidence and genuine wrong-map failures',()=>{
 const retained=longAdmission.records.filter(s=>['wikipedia-article-10772350','wikipedia-article-187946'].includes(s.rootId));expect(retained.map(s=>s.rootId).sort()).toEqual(['wikipedia-article-10772350','wikipedia-article-187946'].sort());for(const source of longAdmission.records.filter(s=>!retained.includes(s)))expect(corpusClaimExamples(source.clip.text,0)).toBeUndefined();
 for(const text of[...scopes.records.map(s=>s.text),...longAdmission.records.filter(s=>['wikipedia-article-10772350','wikipedia-article-187946'].includes(s.rootId)).map(s=>s.clip.text)])fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{const f=corpusClaimExamples(text,seed)!;expect(f).toBeDefined();const q=questionSchema.parse({kind:'matching',id:'isolated-cx',blockId:'block',prompt:f.prompt,pairs:f.pairs,choices:f.choices,evidence:f.evidence,additionalEvidence:f.otherEvidence.map(e=>({blockId:'block',...e})),explanation:f.explanation});if(!('pairs'in q))throw Error('Expected matching');expect(new Set(q.choices).size).toBe(q.choices.length);const answer=q.pairs.map(p=>p.answer);expect(score(q,answer).correct).toBe(true);for(let i=0;i<answer.length;i++)for(const wrong of q.choices.filter(s=>s!==answer[i])){const changed=[...answer];changed[i]=wrong;expect(score(q,changed).correct).toBe(false);}expect(()=>score(q,answer.slice(1))).toThrow();expect(()=>score(q,answer.map(()=>17) as unknown as string[])).toThrow();for(const e of[q.evidence,...q.additionalEvidence!])expect(text.slice(e.start,e.end).length).toBeGreaterThan(25);
 for(const p of q.pairs){if(p.label.includes('zebra mussel')){expect(p.answer).toBe('Economic harm to farming');expect(p.label).toContain('can');}if(p.label.includes('common carp')){expect(p.answer).toBe('Environmental harm to aquatic plants');expect(p.label).toContain('can');}if(p.label.startsWith('Initial error')){expect(p.answer).toBe('Possible mistakes in interpreting echograms');expect(p.label).toContain('would');}if(p.label.startsWith('Concluding'))expect(p.answer).toBe('Mistakes can lead to new discoveries');if(p.label.includes('Hinduism'))expect(p.answer).toBe('Ancient-period formulation of belief and philosophical systems');if(p.label==='Buddhism, Christianity, and Islam')expect(p.answer).toBe('Medieval spread of missionary religions');if(p.label==='humanism and the Enlightenment')expect(p.answer).toBe('Early-modern intellectual developments');if(p.label.includes('HTML'))expect(p.answer).toBe('Vulnerable on-page factors within a webmaster’s control');if(p.label==='PageRank and hyperlink analysis')expect(p.answer).toBe('Additional off-page factors considered alongside on-page factors');expect(p.answer).not.toMatch(/Proof|Every/);}
 for(const locale of['en','zh-Hans','zh-Hant']as const)expect(q.explanation[locale].length).toBeGreaterThan(100);
 }),{numRuns:100});
});
async function longBanks(){return Promise.all(['history','seo'].map(async name=>(await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/long-reference-${name}.zip`)))).spoken!));}
it('uses complete admitted recordings for the same claim/example operation, with exact segment evidence, both source orders and focused exhaustion',async()=>{
 const banks=await longBanks(),before=structuredClone(banks);
 for(const[primary,application]of[banks,[...banks].reverse()])fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{
  const lesson=spokenCorpusLesson(primary,new Set(),seed,196,'B2',[],'matching',claimExampleOperation,[application])!;
  expect(lesson.goalId).toBe('claim-example-link');expect(new Set(lesson.materials.map(m=>m.rootId)).size).toBe(2);
  for(const[i,m]of lesson.materials.entries()){
   const bank=i?application:primary,clip=bank.records[0].clips[0],q=m.questions[0];
   expect(m.blocks[0].text).toBe(clip.text);expect(m.audio).toEqual(clip.audio);expect(m.audio!.duration).toBeGreaterThan(120);expect(m.questions).toHaveLength(1);expect(q.id.length).toBeLessThanOrEqual(80);expect(corpusOperation(q)).toBe(claimExampleOperation);expect(q.hints?.length).toBe(i?undefined:3);
   if(!('kind'in q)||q.kind!=='matching')throw Error('Expected matching');expect(score(q,q.pairs.map(p=>p.answer)).correct).toBe(true);
   for(const e of[q.evidence,...q.additionalEvidence!]){const segments=clip.segments.filter(s=>s.end>e.start&&s.start<e.end);expect(e.audioStart).toBe(segments[0].audioStart);expect(e.audioEnd).toBe(segments.at(-1)!.audioEnd);expect(e.audioEnd).toBeLessThanOrEqual(clip.audio.duration);}
   for(const locale of['en','zh-Hans','zh-Hant']as const){expect(practiceLocale(lesson,locale)).toBe('en');expect(lesson.workedExample![locale]).toContain('Mina');expect(lesson.teaching![locale].length).toBeGreaterThan(200);}
  }
  const bare=structuredClone(lesson.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(lesson).materials).toEqual(bare);
 }),{numRuns:100});
 const[primary,application]=banks;
 for(const bank of banks)expect(spokenCorpusSchema.parse(bank)).toEqual(bank);
 for(const seconds of[25,60,91,125])expect(spokenCorpusLesson(primary,new Set(),0,seconds,'B2',[],'matching',claimExampleOperation,[application])).toBeUndefined();
 for(const point of['A1','A2','B1','C1','C2']as const)expect(spokenCorpusLesson(primary,new Set(),0,196,point,[],'matching',claimExampleOperation,[application])).toBeUndefined();
 expect(spokenCorpusLesson(primary,new Set(),0,196,'B2',[],'matching',claimExampleOperation)).toBeUndefined();
 for(const bank of banks)expect(spokenCorpusLesson(primary,new Set([bank.records[0].clips[0].id]),0,196,'B2',[],'matching',claimExampleOperation,[application])).toBeUndefined();
 const held=structuredClone(application);held.records[0].clips[0].qualityFlags=['Unresolved transcript'];expect(spokenCorpusLesson(primary,new Set(),0,196,'B2',[],'matching',claimExampleOperation,[held])).toBeUndefined();
 expect(qualifiedLongSeconds(banks,'B2',60)).toBe(60);expect(qualifiedLongSeconds(banks,'B2',91)).toBe(196);expect(qualifiedLongSeconds([primary,held],'B2',91)).toBe(91);expect(banks).toEqual(before);
 // Preserve reference tasks on alternate ordinary seeds.
 expect(spokenCorpusLesson(primary,new Set(),0,196,'B2',[],undefined,undefined,[application])!.goalId).toBe('claim-example-link');
 expect(spokenCorpusLesson(primary,new Set(),1,196,'B2',[],undefined,undefined,[application])!.goalId).toBe('source-context-reference');
});
it('saves whole matching vectors atomically in reading/listening Practice/Test and preserves them in a new-profile backup restore',async()=>{
 const{advance,attempts,claimSession,createSession,db,communityPacks,markExposure,recordPlayback,sessions,submit}=await import('../src/data/db');const{exportBackup,importBackup,inspectBackup}=await import('../src/data/backup');
 await Promise.all(db.tables.map(t=>t.clear()));try{
  const bank={version:1 as const,failures:[],records:await reviewedReading(originals,300)},reading=corpusLesson(bank,new Set(),0,300,'B2',[],'matching',claimExampleOperation)!,[primary,application]=await longBanks(),heard=spokenCorpusLesson(primary,new Set(),0,196,'B2',[],'matching',claimExampleOperation,[application])!;
  for(const lesson of[reading,asTestLesson(reading),heard,asTestLesson(heard)]){
   const profileId=`cx-${lesson.skill}-${lesson.mode??'practice'}`;
   if(lesson.skill==='listening'){
    const files=new Map<string,Map<string,Response>>();
    for(const name of['history','seo']){const pack=await inspectCommunityPack(new Uint8Array(readFileSync(`tests/fixtures/long-reference-${name}.zip`)));await communityPacks.put({...pack,profileId,state:'ready',installedAt:new Date().toISOString()});const media=new Map<string,Response>([[`/audio/community-${pack.hash}/ready`,new Response('ready')]]);for(const[path,bytes]of Object.entries(pack.media))media.set(`/audio/community-${pack.hash}/${path}`,new Response(new Uint8Array(bytes),{headers:{'Content-Type':'audio/mpeg'}}));files.set(`lingfern-community-${pack.hash}`,media);}
    const caches={has:async(name:string)=>files.has(name),open:async(name:string)=>({match:async(path:string)=>files.get(name)?.get(path)?.clone()})};vi.stubGlobal('window',{caches});vi.stubGlobal('caches',caches);
   }
   const session=await createSession(lesson,profileId);let current:import('../src/data/db').Session=await claimSession(session.id,'cx-owner');
   for(const m of lesson.materials){const q=m.questions[0];if(!('kind'in q)||q.kind!=='matching')throw Error('Expected matching');await markExposure(current);if(lesson.skill==='listening'){await recordPlayback(session.id,'cx-owner',q.id,false);await recordPlayback(session.id,'cx-owner',q.id,true);}const answer=q.pairs.map(p=>p.answer);const saved=await submit(session.id,'cx-owner',answer);expect(saved.correct).toBe(true);expect((await attempts.get(saved.id))!.answer).toEqual(answer);current=await advance(session.id,'cx-owner');}
   expect((await sessions.get(session.id))!.status).toBe('completed');const checked=await inspectBackup(await exportBackup(profileId));expect(checked.records.sessions[0].lesson).toEqual(lesson);expect(checked.records.attempts).toHaveLength(2);const restored=await importBackup(checked);expect((await sessions.where('profileId').equals(restored).toArray())[0].lesson).toEqual(lesson);expect((await attempts.where('profileId').equals(restored).toArray()).map(a=>a.answer)).toEqual(checked.records.attempts.map(a=>a.answer));
  }
 }finally{vi.unstubAllGlobals();await Promise.all(db.tables.map(t=>t.clear()));}
});
it('rejects changed or uninspected framing, whole-context additions and unsupported seed/size rather than forcing an ambiguous source match',()=>{
 for(const text of[...scopes.records.map(s=>s.text),...longAdmission.records.filter(s=>['wikipedia-article-10772350','wikipedia-article-187946'].includes(s.rootId)).map(s=>s.clip.text)])for(const bad of[text+' invented.',text+text,text.slice(0,-1),text.replace(/can|sometimes|such as|PageRank/,'uninspected')])expect(corpusClaimExamples(bad,0)).toBeUndefined();expect(corpusClaimExamples('For example, a bird flew. All birds can fly.',0)).toBeUndefined();for(const seed of[-1,.5,NaN,0x100000000])expect(()=>corpusClaimExamples('',seed)).toThrow();expect(()=>corpusClaimExamples('x'.repeat(12001),0)).toThrow();
});
it('generates one supported matching target and same-goal unfamiliar application, with three locales, strict Test and focused exhaustion',async()=>{
 expect(originals).toHaveLength(2);const snapshot=structuredClone(originals);const bank={version:1 as const,failures:[],records:await reviewedReading(originals,300)};expect(originals).toEqual(snapshot);
 fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),seed=>{const l=corpusLesson(bank,new Set(),seed,300,'B2',[],'matching',claimExampleOperation)!;expect(l.goalId).toBe('claim-example-link');expect(new Set(l.materials.map(m=>m.rootId)).size).toBe(2);for(const[i,m]of l.materials.entries()){const q=m.questions[0];expect(corpusOperation(q)).toBe(claimExampleOperation);expect(m.questions).toHaveLength(1);expect(q.id.length).toBeLessThanOrEqual(80);expect(q.hints?.length).toBe(i?undefined:3);if(!('pairs'in q))throw Error('Expected matching');expect(score(q,q.pairs.map(p=>p.answer)).correct).toBe(true);const s=scopes.records.find(s=>s.rootId===m.rootId)!;expect(m.blocks[0].text).toBe(s.text);expect(createHash('sha256').update(s.text).digest('hex')).toBe(s.textSha256);for(const locale of['en','zh-Hans','zh-Hant']as const){expect(practiceLocale(l,locale)).toBe('en');expect(l.teaching![locale].length).toBeGreaterThan(100);expect(l.workedExample![locale]).toContain('Mina');expect(l.workedExample![locale]).not.toMatch(/mussel|carp|echogram|Buddhism|PageRank/);}}
 const bare=structuredClone(l.materials);bare.forEach(m=>m.questions.forEach(q=>delete q.hints));expect(asTestLesson(l).materials).toEqual(bare);expect(asTestLesson(l).teaching).toBeUndefined();
 }),{numRuns:150});
 for(const s of scopes.records){expect(corpusLesson(bank,new Set([s.passageId]),0,300,'B2',[],'matching',claimExampleOperation)).toBeUndefined();const r=originals.find(r=>r.rootId===s.rootId)!;await expect(reviewedReading([{...r,sourceHash:'0'.repeat(64)}],300)).rejects.toThrow('CORPUS_INTEGRITY');}expect(corpusLesson({...bank,records:bank.records.slice(0,1)},new Set(),0,300,'B2',[],'matching',claimExampleOperation)).toBeUndefined();expect(corpusLesson(bank,new Set(),0,160,'B2',[],'matching',claimExampleOperation)).toBeUndefined();for(const point of['A1','A2','B1','C1','C2']as const)expect(corpusLesson(bank,new Set(),0,500,point,[],'matching',claimExampleOperation)).toBeUndefined();
});
