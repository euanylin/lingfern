import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const coverageOutput=process.argv.find(arg=>arg.startsWith('--coverage-output='))?.slice(18);
if(process.argv.includes('--coverage')&&(!coverageOutput||!/^private\/corpus\/teaching-[a-z0-9-]+\.json$/.test(coverageOutput)||fs.existsSync(coverageOutput)))throw Error('Coverage requires a fresh private/corpus/teaching-*.json output path.');
const generatorHashes=['scripts/check-starting-points.mjs','src/core/corpus.ts','src/core/corpusPractice.ts','src/core/beginnerListening.ts','src/core/wordListening.ts','src/core/spokenCorpus.ts','src/core/spokenAttribution.ts','src/core/corpusReference.ts','src/core/spokenLongAdmission.ts','content/corpus/long-listening-admission.json','src/data/corpus.ts','src/shared/content.ts'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
// Probe actual starting bounds and packages without claiming CEFR calibration.
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {inspectCommunityPack}=await server.ssrLoadModule('/src/data/communityPack.ts');
 const {corpusLesson,corpusSchema}=await server.ssrLoadModule('/src/core/corpus.ts');
 const {spokenCorpusLesson}=await server.ssrLoadModule('/src/core/spokenCorpus.ts');
 const {corpusOperation,corpusPracticeHistory}=await server.ssrLoadModule('/src/core/corpusPractice.ts');
 const {reviewedReading,reviewedExcerpts,mergeReadingRecords}=await server.ssrLoadModule('/src/data/corpus.ts');
 const {sentenceListeningLesson,sentencePolarityLesson}=await server.ssrLoadModule('/src/core/beginnerListening.ts');
 const sentenceSources=JSON.parse(fs.readFileSync('public/audio/a1-sentences/SENTENCES.json'));
 const {wordListeningLesson}=await server.ssrLoadModule('/src/core/wordListening.ts');
 const {questions,score,practiceLocale}=await server.ssrLoadModule('/src/shared/content.ts');
 const cat=JSON.parse(fs.readFileSync('content/source-packs.json'));
 const banks=[];
 for(const entry of cat.packs) {
  const pack=await inspectCommunityPack(new Uint8Array(fs.readFileSync('public'+entry.path)));
  assert.equal(pack.hash,entry.sha256);assert.equal(pack.lessons.length,0);
  if(pack.spoken)pack.spoken={...pack.spoken,records:(await Promise.all(pack.spoken.records.map(async record=>({...record,clips:await reviewedExcerpts(record,record.clips)})))).filter(record=>record.clips.length)};
  banks.push({skill:entry.skill,id:entry.id,hash:pack.hash,pack});
 }
 const bundledPaths=[];
 function readFamily(family) {
  const paths=fs.readdirSync('public/corpus').filter(name=>new RegExp(`^${family}(?:-[1-9]\\d*)?\\.json$`).test(name)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true})).map(name=>'public/corpus/'+name);
  assert(paths.includes(`public/corpus/${family}.json`),'missing corpus family');bundledPaths.push(...paths);
  const records=paths.flatMap(path=>corpusSchema.parse(JSON.parse(fs.readFileSync(path))).records);
  assert.equal(new Set(records.map(record=>record.rootId)).size,records.length,'duplicate bundled root');
  return {version:1,failures:[],records};
 }
 const rawAdditional=readFamily('additional'),rawBundled=readFamily('voa'),rawGutenberg=readFamily('gutenberg'),rawWikiquote=readFamily('wikiquote'),rawOpenReading=readFamily('open-reading');
 const bundled={...rawBundled,records:await reviewedReading(rawBundled.records)};
 const readingByBounds=new Map();
 async function readingForBounds(maxWords) {
  if(readingByBounds.has(maxWords))return readingByBounds.get(maxWords);
  const bundled={...rawBundled,records:await reviewedReading(rawBundled.records,maxWords)};
  const gutenberg={...rawGutenberg,records:await reviewedReading(rawGutenberg.records,maxWords)};
  const additional={...rawAdditional,records:await reviewedReading(rawAdditional.records,maxWords)};
  const wikiquote={...rawWikiquote,records:await reviewedReading(rawWikiquote.records,maxWords)};
  const openReading={...rawOpenReading,records:await reviewedReading(rawOpenReading.records,maxWords)};
  const candidates=await Promise.all(banks.filter(bank=>bank.skill==='reading').map(async bank=>({id:bank.id,bank:{...bank.pack.corpus,records:await reviewedReading(bank.pack.corpus.records,maxWords)}})));
  // Match loadReadingCorpus's bundled-then-installed precedence.
  const application={version:1,failures:[],records:mergeReadingRecords([...bundled.records,...gutenberg.records,...additional.records,...wikiquote.records,...openReading.records,...candidates.flatMap(candidate=>candidate.bank.records)])};
  const reviewed={bundled,candidates:[{id:'bundled-gutenberg',bank:gutenberg},{id:'bundled-additional',bank:additional},{id:'bundled-wikiquote',bank:wikiquote},{id:'bundled-open-reading',bank:openReading},...candidates],application};readingByBounds.set(maxWords,reviewed);return reviewed;
 }
 const applicationListening=banks.filter(bank=>bank.skill==='listening').map(bank=>bank.pack.spoken);
 if(process.argv.includes('--coverage')) {
  const {teachingCoverage}=await import('./teaching-coverage.mjs');
  await teachingCoverage({server,readingForBounds,applicationListening,banks,bundledPaths,generatorHashes,outputPath:coverageOutput});
 } else {
 const result=[];
 for(const level of ['A1','A2','B1','B2','C1','C2']) for(const skill of ['reading','listening']) for(const samplingPhase of ['initial','dispersed',...(process.argv.includes('--installed')?['installed-dispersed']:[])]) {
  const bounds=corpusPracticeHistory([],[],'audit',skill,'all',level);
  const reading=skill==='reading'?await readingForBounds(bounds.maxWords):undefined;
  const sourceFamilies={primary:{},application:{}};
  const roots=new Set(),types=new Set(),operations=new Map();let lessons=0,longestMaterialWords=0,longestAudioSeconds=0,crossPackageApplications=0,crossPackageOnlyLessons=0;const available=new Set();
  const candidates=skill==='reading'?['A1','A2'].includes(level)?[{id:'bundled-voa',bank:reading.bundled}]:reading.candidates:banks.filter(b=>b.skill===skill).map(b=>({id:b.id,bank:b.pack.spoken}));
  if(skill==='listening'&&level==='A1')candidates.splice(0,candidates.length,{id:'bundled-words',bank:JSON.parse(fs.readFileSync('public/ipa/SOURCES.json'))});
  for(const {id,bank} of candidates)for(let index=0;index<13;index++) {
   // Sample the full 32-bit seed space to cover long operation cycles.
   const seed=samplingPhase==='initial'?index:Math.imul(index+1,0x9e3779b1)>>>0;
   const installed=samplingPhase==='installed-dispersed';
   const lesson=skill==='reading'?corpusLesson(bank,new Set(),seed,bounds.maxWords,level,[],undefined,undefined,installed?reading.application:undefined):level==='A1'?wordListeningLesson(bank,new Set(),seed):spokenCorpusLesson(bank,new Set(),seed,bounds.maxSeconds,level,[],undefined,undefined,installed?applicationListening:[]);
   if(!lesson)continue;
   if(installed) {
    // Compare identical ordinary seeds when installed sources enable the Wikiquote quota.
    const singleSeed=skill==='reading'&&!['A1','A2'].includes(level)&&reading.application.records.some(source=>source.passages.some(passage=>passage.quoteProvenance))&&!bank.records.some(source=>source.passages.some(passage=>passage.quoteProvenance))?Math.floor(seed/16):seed;
    const single=skill==='reading'?corpusLesson(bank,new Set(),singleSeed,bounds.maxWords,level):level==='A1'?wordListeningLesson(bank,new Set(),seed):spokenCorpusLesson(bank,new Set(),seed,bounds.maxSeconds,level);
    const newOutcome = skill === 'listening' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:stated-outcome';
    const newlyAvailableOutcome = newOutcome && (!single || corpusOperation(single.materials[0].questions[0]) !== 'choice:stated-outcome');
    const newConcession = skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:concessive-relation';
    const newlyAvailableConcession = newConcession && (!single || corpusOperation(single.materials[0].questions[0]) !== 'choice:concessive-relation');
    const newAddress = skill === 'reading' && level === 'A2' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:requested-address';
    const newlyAvailableAddress = newAddress && (!single || corpusOperation(single.materials[0].questions[0]) !== 'choice:requested-address');
    if(newAddress)assert(lesson.materials.length===2&&lesson.materials.every(material=>corpusOperation(material.questions[0])==='choice:requested-address'),`${level} ${id}: address needs genuine same-operation application`);
    const newRequest = skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:polite-request';
    const newlyAvailableRequest = newRequest && (!single || corpusOperation(single.materials[0].questions[0]) !== 'choice:polite-request');
    if (newRequest) assert(lesson.materials.length === 2 && lesson.materials.every(material => corpusOperation(material.questions[0]) === 'choice:polite-request'), `${level} ${id}: request needs genuine same-operation application`);
    const newTiming = skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'choice:qualified-timing';
    const newlyAvailableTiming = newTiming && (!single || corpusOperation(single.materials[0].questions[0]) !== 'choice:qualified-timing');
    if (newTiming) assert(lesson.materials.length === 2 && lesson.materials.every(material => corpusOperation(material.questions[0]) === 'choice:qualified-timing'), `${level} ${id}: timing needs genuine same-operation application`);
    if (newOutcome) assert(lesson.materials.length === 2 && lesson.materials.every(material => corpusOperation(material.questions[0]) === 'choice:stated-outcome'), `${level} ${id}: outcome needs genuine same-operation application`);
    if (newConcession) assert(lesson.materials.length === 2 && lesson.materials.every(material => corpusOperation(material.questions[0]) === 'choice:concessive-relation'), `${level} ${id}: concession needs genuine same-operation application`);
    const newAttribution = skill === 'reading' && corpusOperation(lesson.materials[0].questions[0]) === 'matching:Match each claim to the source named in the passage.';
    const newlyAvailableAttribution = newAttribution && (!single || corpusOperation(single.materials[0].questions[0]) !== 'matching:Match each claim to the source named in the passage.');
    if (newAttribution) assert(lesson.materials.length === 2 && lesson.materials.every(material => corpusOperation(material.questions[0]) === 'matching:Match each claim to the source named in the passage.'), `${level} ${id}: attribution needs genuine same-operation application`);
    if (newlyAvailableAttribution && single) {
     assert.equal(corpusOperation(single.materials[0].questions[0]), 'completion');
     for (const key of ['id','rootId','blocks']) assert.deepEqual(lesson.materials[0][key], single.materials[0][key], `${level} ${id}: attribution changed the primary excerpt`);
    }
    if(single && !newlyAvailableOutcome && !newlyAvailableConcession && !newlyAvailableTiming && !newlyAvailableRequest && !newlyAvailableAttribution && !newlyAvailableAddress)assert.deepEqual(lesson.materials[0],single.materials[0],`${level} ${id}: installed application changed taught source`);
    else {
     if (!single) crossPackageOnlyLessons++;
     const material=lesson.materials[0],source=bank.records.find(record=>record.rootId===material.rootId);
     assert(source,`${level} ${id}: installed application changed primary source`);
     const excerpt=(source.passages??source.clips).find(excerpt=>'corpus-'+excerpt.id===material.id);
     assert(excerpt,`${level} ${id}: missing primary excerpt`);assert.equal(material.blocks[0].text,excerpt.text);
    }
    const primaryRoots=new Set((skill==='listening'&&level==='A1'?[]:bank.records).map(record=>record.rootId));
    if(skill==='reading'||level!=='A1')crossPackageApplications+=lesson.materials.slice(1).filter(material=>!primaryRoots.has(material.rootId)).length;
    if(skill==='listening'&&level!=='A1')for(const material of lesson.materials) {
     const owner=applicationListening.find(other=>other.communityPackageId===(material.communityPackageId??lesson.communityPackageId));
     assert(owner,`${level} ${id}: lost immutable audio owner`);
     assert(owner.records.some(record=>record.rootId===material.rootId&&record.clips.some(clip=>clip.audio.sha256===material.audio.sha256)),`${level} ${id}: audio belongs to another source`);
    }
   }
   lessons++;available.add(id);assert.equal(new Set(lesson.materials.map(m=>m.rootId)).size,lesson.materials.length);
   assert.equal(practiceLocale(lesson,'zh-Hans'),['A1','A2'].includes(level)?'zh-Hans':'en');
   for(const [materialIndex,material] of lesson.materials.entries()) {
    const role=materialIndex===0?'primary':'application',family=material.sourceId?.split('-')[0]??'unknown';
    sourceFamilies[role][family]=(sourceFamilies[role][family]??0)+1;
    const words=material.blocks.reduce((sum,block)=>sum+block.text.trim().split(/\s+/).length,0);
    if(skill==='reading')assert(words<=bounds.maxWords,`${level} ${id} ${material.id}: ${words} words exceeds ${bounds.maxWords}`);
    else {assert(material.audio,`${level} ${id}: missing playable audio`);assert(material.audio.duration<=bounds.maxSeconds,`${level} ${id} ${material.id}: audio exceeds ${bounds.maxSeconds} seconds`);longestAudioSeconds=Math.max(longestAudioSeconds,material.audio.duration);}
    longestMaterialWords=Math.max(longestMaterialWords,words);
   }
   const operation=corpusOperation(lesson.materials[0].questions[0]);assert(operation,`${level} ${id}: missing first operation`);
   const coverage=operations.get(operation)??{operation,firstRoots:new Set(),applicationRoots:new Set(),sampledLessons:0,sameOperationApplications:0};
   coverage.firstRoots.add(lesson.materials[0].rootId);coverage.sampledLessons++;
   for(const material of lesson.materials.slice(1)) {
    const scored=material.questions.filter(q=>q.kind!=='response');
    if(scored.length&&scored.every(q=>corpusOperation(q)===operation)){coverage.sameOperationApplications++;coverage.applicationRoots.add(material.rootId);}
   }
   operations.set(operation,coverage);
   for(const {material,question:q} of questions(lesson)) {
    roots.add(material.rootId);types.add(q.kind??'choice');
    const answer=q.kind==='response'?'A supported response':q.kind==='sequence'?q.acceptedOrders[0]:q.kind==='evidence'?q.accepted[0]:q.kind==='table'?q.rows.map(r=>r.answer):q.kind==='matching'?q.pairs.map(p=>p.answer):q.answer;
    assert.equal(score(q,answer).correct,q.kind==='response'?null:true);
   }
  }
  assert(lessons > 0, `${level} ${skill} must generate usable practice`);
  assert.equal(Object.values(sourceFamilies.primary).reduce((sum,count)=>sum+count,0),lessons);
  assert.equal(Object.values(sourceFamilies.application).reduce((sum,count)=>sum+count,0),lessons);
  result.push({level,skill,samplingPhase,maxWords:bounds.maxWords,maxSeconds:bounds.maxSeconds,sampledLessons:lessons,sourceFamilies,sampledRoots:roots.size,usableBanks:available.size,questionKinds:[...types].sort(),longestMaterialWords,longestAudioSeconds,crossPackageApplications,crossPackageOnlyLessons,operationCoverage:[...operations.values()].map(row=>({...row,firstRoots:[...row.firstRoots].sort(),applicationRoots:[...row.applicationRoots].sort()}))});
 }
 const beginnerOperations=[];
 for(const level of ['A1','A2']) {
  const {maxWords}=corpusPracticeHistory([],[],'audit','reading','all',level);
  const beginnerBank={...bundled,records:[...bundled.records,...rawGutenberg.records.map(source=>({...source,passages:source.passages.filter(passage=>passage.startingPoints?.includes(level))})).filter(source=>source.passages.length)]};
  const passageCount=beginnerBank.records.flatMap(source=>source.passages).filter(passage=>passage.startingPoints?.includes(level)&&passage.wordCount<=maxWords).length;
  const operations=new Map();
  const operationCount=level==='A2'?9:8;
  const familyCounts=new Map();
  for(const source of beginnerBank.records){const count=source.passages.filter(passage=>passage.startingPoints?.includes(level)&&passage.wordCount<=maxWords).length;if(count)familyCounts.set(source.id.split('-')[0],(familyCounts.get(source.id.split('-')[0])??0)+count);}
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  // Select within mixed families as well as cycling operations.
  const sampledLessons=[...familyCounts.values()].reduce((period,count)=>{const selectionPeriod=count*familyCounts.size;return period/gcd(period,selectionPeriod)*selectionPeriod;},passageCount*operationCount);
  for(let seed=0;seed<sampledLessons;seed++) {
   const lesson=corpusLesson(beginnerBank,new Set(),seed,maxWords,level);assert(lesson);
   for(const {question:q} of questions(lesson)) {
    const answer=q.kind==='response'?'A supported response':q.kind==='sequence'?q.acceptedOrders[0]:q.kind==='evidence'?q.accepted[0]:q.kind==='table'?q.rows.map(r=>r.answer):q.kind==='matching'?q.pairs.map(p=>p.answer):q.answer;
    assert.equal(score(q,answer).correct,q.kind==='response'?null:true);
   }
   const operation=corpusOperation(lesson.materials[0].questions[0]);assert(operation);
   const row=operations.get(operation)??{operation,roots:new Set(),applicationRoots:new Set(),sampledLessons:0,sameOperationApplications:0};
   row.roots.add(lesson.materials[0].rootId);row.sampledLessons++;
   if(corpusOperation(lesson.materials[1].questions[0])===operation){row.sameOperationApplications++;row.applicationRoots.add(lesson.materials[1].rootId);}
   operations.set(operation,row);
  }
  assert.deepEqual([...operations.keys()].sort(),['completion','sequence','table:Write each person’s apartment code.','matching:Who says each sentence? Match it to a person.','matching:Match each activity to its room.','choice:requested-address','choice:work-phone','choice:stated-intention',...(level==='A2'?['choice:stated-origin']:[])].sort());
  const intention=operations.get('choice:stated-intention');assert(intention.roots.has('voa-article-3225958')&&intention.roots.has('voa-article-3126527'));assert.equal(intention.sameOperationApplications,intention.sampledLessons);
  if(level==='A2'){const address=operations.get('choice:requested-address');assert(new Set([...address.roots,...address.applicationRoots]).has('gutenberg-book-45')&&new Set([...address.roots,...address.applicationRoots]).has('voa-article-3240468'));assert.equal(address.sameOperationApplications,address.sampledLessons);const origin=operations.get('choice:stated-origin');assert(origin.roots.has('voa-article-3113733')&&origin.roots.has('voa-article-3355849'));assert.equal(origin.sameOperationApplications,origin.sampledLessons);}
  beginnerOperations.push({level,sampledLessons,scope:'Full bounded default beginner operation-cycle generation/scoring; not source suitability or CEFR approval.',operations:[...operations.values()].map(row=>({...row,roots:[...row.roots].sort(),applicationRoots:[...row.applicationRoots].sort()}))});
 }
 const sentenceRoots=new Set();
 for(let seed=0;seed<13;seed++) {
  const lesson=sentenceListeningLesson(sentenceSources,new Set(),seed);assert(lesson);
  assert.equal(practiceLocale(lesson,'zh-Hans'),'zh-Hans');
  assert.equal(new Set(lesson.materials.map(material=>material.rootId)).size,2);
  for(const {material,question} of questions(lesson)) {
   assert(material.audio.duration<=12);sentenceRoots.add(material.rootId);
   assert.equal(question.kind,'completion');assert.equal(score(question,question.answer).correct,true);
  }
 }
 const sentenceProgression={startingPoint:'A1',skill:'listening',scope:'Short-utterance generation after the separately tested independent word-application gate; not initial/default word practice or CEFR calibration.',sampledLessons:13,sampledRoots:sentenceRoots.size};
 const polarityRoots=new Set();
 for(let seed=0;seed<13;seed++) {
  const lesson=sentencePolarityLesson(sentenceSources,new Set(),seed);assert(lesson);
  assert.equal(new Set(lesson.materials.map(material=>material.rootId)).size,2);
  for(const {material,question} of questions(lesson)) {
   polarityRoots.add(material.rootId);assert.equal(corpusOperation(question),'choice:heard-polarity');
   assert(material.blocks[0].text.includes(question.options[question.answer]));
   for(let option=0;option<question.options.length;option++)assert.equal(score(question,option).correct,option===question.answer);
  }
 }
 sentenceProgression.polarity={scope:'Separate atomic present-be affirmative/negative meaning after the word gate, including the exact reviewed room correction; two negative roots, not mature coverage or CEFR.',sampledLessons:13,roots:[...polarityRoots].sort()};
 for(const input of generatorHashes)assert.equal(createHash('sha256').update(fs.readFileSync(input.path)).digest('hex'),input.sha256,'Audit generator changed during verification');
 fs.writeFileSync('private/corpus/starting-point-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),scope:'Actual runtime-reviewed starting-point effort bounds; separate seeds0–12 and13 dispersed32-bit seeds per current source bank. Optional installed-dispersed phase uses runtime-reviewed five bundled reading families in ordinary-loader order and all current source banks at the same per-level word bound for application only, retaining existing-operation primary teaching and immutable listening owners. Reserved outcome/concession/timing/request/attribution phases may replace their unavailable single-bank fallback only with two genuine same-operation roots; all previously available operations retain strict primary equality. Overlapping samples are not unique content counts. Word/audio bounds, scoring and exact-operation coverage are not CEFR suitability, exhaustive coverage or source/audio approval.',generatorHashes,sourceHashes:banks.map(({id,hash})=>({id,sha256:hash})),bundledHashes:['content/corpus/text-review-rules.json',...bundledPaths,'public/ipa/SOURCES.json','public/audio/a1-sentences/SENTENCES.json'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')})),rows:result,beginnerOperations,sentenceProgression},null,2));console.log(JSON.stringify({rows:result,beginnerOperations}));
 }
}finally{await server.close()}
