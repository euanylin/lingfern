import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

/** Inventory seed-0 parsing before bounded generator/support checks. */
export async function teachingCoverage({server,readingForBounds,applicationListening,banks,bundledPaths,generatorHashes,outputPath}) {
 assert(typeof outputPath==='string'&&!fs.existsSync(outputPath),'Use a fresh explicit coverage evidence path; historical reports must not be overwritten.');
 const c=await server.ssrLoadModule('/src/core/corpus.ts');
 const {corpusOperation,startingBounds,pairedRelianceOperation}=await server.ssrLoadModule('/src/core/corpusPractice.ts');
 const {spokenCorpusLesson}=await server.ssrLoadModule('/src/core/spokenCorpus.ts');
 const {spokenAttributionPairs,spokenAttributionMatchingPrompt}=await server.ssrLoadModule('/src/core/spokenAttribution.ts');
 const {spokenCondition}=await server.ssrLoadModule('/src/core/spokenCondition.ts');
 const {wordListeningLesson}=await server.ssrLoadModule('/src/core/wordListening.ts');
 const {questions,score}=await server.ssrLoadModule('/src/shared/content.ts');
 const detectors={completion:c.corpusRestoration,sequence:c.corpusSequence,table:c.corpusDates,
  attributionMatching:c.corpusAttributionPairs,evaluation:c.corpusEvaluation,condition:c.corpusCondition,
  action:c.corpusActionSelection,qualification:c.corpusQualification,request:c.corpusRequests,reliance:c.corpusRoleActions,
  attribution:c.corpusAttribution,assignment:c.corpusAssignment,concession:c.corpusConcession,cause:c.corpusQualifiedCause,
  contrast:c.corpusExplicitContrast,negation:c.corpusNegatedNecessity,concessive:c.corpusConcessiveRelation,
  timing:c.corpusQualifiedTiming,polite:c.corpusPoliteRequest,speakers:c.corpusSpeakers,rooms:c.corpusRooms,
  address:c.corpusAddress,phone:c.corpusPhone,intention:c.corpusStatedIntention,origin:c.corpusStatedOrigin,apartments:c.corpusApartments,
  spokenMatching:spokenAttributionPairs,spokenCondition,outcome:c.corpusOutcome};
 const operations={};
 for(const name of Object.keys(detectors))operations[name]=new Map();
 const detect=(name,excerpt,beginner=false)=>{
  const key=excerpt.id+(name==='completion'&&beginner?':beginner':'');
  if(!operations[name].has(key))operations[name].set(key,!!detectors[name](excerpt.text,0,excerpt.language,beginner));
  return operations[name].get(key);
 };
 // Treat Plan §2.6 lengths as diagnostics, not CEFR or acceptance thresholds.
 const editorialLengths={B1:{reading:[150,400],listening:[45,150]},B2:{reading:[300,750],listening:[90,240]},C1:{reading:[500,1200],listening:[120,360]},C2:{reading:[700,1800],listening:[180,480]}};
 const rows=[];
 for(const level of ['A1','A2','B1','B2','C1','C2'])for(const skill of ['reading','listening'])for(const condition of [0,1,2]) {
  console.log(`Inventory ${level} ${skill} condition ${condition}`);
  const beginner=['A1','A2'].includes(level),bounds={maxWords:startingBounds[level].words[condition],maxSeconds:startingBounds[level].seconds[condition]};
  const reading=skill==='reading'?await readingForBounds(bounds.maxWords):undefined;
  const candidates=skill==='reading'?reading.application.records.flatMap(source=>source.passages.map(excerpt=>({source,excerpt})))
   .filter(({excerpt})=>(beginner?excerpt.startingPoints?.includes(level):!excerpt.startingPoints)&&excerpt.wordCount<=bounds.maxWords&&(!['C1','C2'].includes(level)||excerpt.wordCount>=120))
   :applicationListening.flatMap(bank=>bank.records.flatMap(source=>source.clips.map(excerpt=>({source,excerpt,bank}))))
    .filter(({excerpt})=>!excerpt.qualityFlags.length&&excerpt.audio.duration<=bounds.maxSeconds);
  let names=beginner?['apartments','speakers','rooms','sequence','completion','address','phone','intention',...(level==='A2'?['origin']:[])]:['table','attributionMatching','evaluation','condition','action','qualification','request','reliance','sequence','completion','attribution','assignment','concession','cause',...(level==='B2'?['contrast']:[]),...(['C1','C2'].includes(level)?['negation','concessive','timing','polite']:[])];
  if(skill==='listening')names=beginner?['sequence','completion']:['table','sequence','qualification','attribution','spokenCondition','completion','spokenMatching','outcome'];
  if(skill==='listening'&&level==='A1') {
   const source=JSON.parse(fs.readFileSync('public/ipa/SOURCES.json'));
   const lesson=wordListeningLesson(source,new Set(),0);assert(lesson);
   const wordRoots=new Set();for(let seed=0;seed<source.length;seed++)for(const material of wordListeningLesson(source,new Set(),seed).materials)wordRoots.add(material.rootId);
   const coverage=[{name:'word-completion',roots:[...wordRoots].sort(),sample:checkLesson(lesson)}];
   if(condition===2){const {sentenceListeningLesson}=await server.ssrLoadModule('/src/core/beginnerListening.ts');const sentences=JSON.parse(fs.readFileSync('public/audio/a1-sentences/SENTENCES.json'));const lesson=sentenceListeningLesson(sentences,new Set(),0);assert(lesson);const roots=new Set();for(let seed=0;seed<sentences.length;seed++)for(const material of sentenceListeningLesson(sentences,new Set(),seed).materials)roots.add(material.rootId);coverage.push({name:'sentence-completion',roots:[...roots].sort(),sample:checkLesson(lesson)});}
   rows.push({level,skill,condition,maxSeconds:bounds.maxSeconds,scope:'Built-in word route; short-sentence progression requires the separately tested independent word-application gate.',operations:coverage});continue;
  }
  const coverage=[];
  const range=editorialLengths[level]?.[skill];
  const inLengthBand=({excerpt})=>range&&((skill==='reading'?excerpt.wordCount:excerpt.audio.duration)>=range[0]&&(skill==='reading'?excerpt.wordCount:excerpt.audio.duration)<=range[1]);
  const rootOf=item=>skill==='reading'?c.corpusMaterialRoot(item.source,item.excerpt):item.source.rootId;
  for(const name of names) {
   const matching=candidates.filter(({excerpt})=>detect(name,excerpt,beginner));
   const roots=[...new Set(matching.map(rootOf))].sort();
   let sample;
   if(matching.length) {
    const first=matching[0],second=matching.find(item=>rootOf(item)!==rootOf(first))??candidates.find(item=>rootOf(item)!==rootOf(first));
    if(second) {
     const kind=['apartments','table'].includes(name)?'table':['speakers','rooms','attributionMatching','request','reliance','spokenMatching'].includes(name)?'matching':['sequence','completion'].includes(name)?name:['action','cause','contrast','negation','concessive','timing','polite','address','phone','intention','origin','outcome'].includes(name)?'choice':'evidence';
     let operation;
     if(skill==='reading')operation=corpusOperation(c.corpusMaterial({source:first.source,passage:first.excerpt},0,level,kind)?.questions[0]);
     else operation=name==='spokenMatching'?`matching:${spokenAttributionMatchingPrompt}`:name==='outcome'?'choice:stated-outcome':['qualification','attribution','spokenCondition'].includes(name)?`evidence:${detectors[name](first.excerpt.text,0).prompt}`:undefined;
     // Select explicit operations to avoid generic kinds choosing different subtypes.
     if(skill==='reading'&&!['completion','sequence','table','apartments','speakers'].includes(name)) {
      const task=detectors[name](first.excerpt.text,0);
      const named={action:'choice:conditional-action',cause:'choice:qualified-cause',contrast:'choice:explicit-contrast',negation:'choice:negated-necessity',concessive:'choice:concessive-relation',timing:'choice:qualified-timing',polite:'choice:polite-request',address:'choice:requested-address',phone:'choice:work-phone',intention:'choice:stated-intention',origin:'choice:stated-origin',rooms:`matching:${c.roomMatchingPrompt}`,attributionMatching:`matching:${c.attributionMatchingPrompt}`,request:'matching:Match each action to what the request asks for or rules out.',reliance:pairedRelianceOperation};
      operation=named[name]??`${kind}:${task.prompt}`;
     }
     const pair=[first,second];
     let lesson;
     if(skill==='reading') {
      const bank={version:1,failures:[],records:pair.map(item=>({...item.source,passages:[item.excerpt]}))};
      lesson=c.corpusLesson(bank,new Set(),1,bounds.maxWords,level,[],kind,operation);
     } else {
      const primary=first.bank;
      const other={...second.bank,records:[{...second.source,clips:[second.excerpt]}]};
      lesson=spokenCorpusLesson(primary,new Set(),0,bounds.maxSeconds,level,[],kind,operation,[other]);
     }
     if(lesson) {sample=checkLesson(lesson,operation);if(operation)assert.equal(sample.operation,operation,`${level} ${skill} ${name}: requested operation fell back`);}
    }
   }
   const lengthMatches=matching.filter(inLengthBand);
   assert(lengthMatches.length<=matching.length);
   coverage.push({name,excerpts:matching.length,roots,...(range?{editorialLengthBand:{min:range[0],max:range[1],excerpts:lengthMatches.length,roots:[...new Set(lengthMatches.map(rootOf))].sort()}}:{}),materialStatus:roots.length===0?'missing':roots.length===1?'single-root':'multiple-roots',sample});
  }
  rows.push({level,skill,condition,maxWords:bounds.maxWords,maxSeconds:bounds.maxSeconds,eligibleExcerpts:candidates.length,...(range?{editorialLengthBand:{min:range[0],max:range[1],excerpts:candidates.filter(inLengthBand).length,roots:[...new Set(candidates.filter(inLengthBand).map(rootOf))].sort()}}:{}),operations:coverage});
 }
 function checkLesson(lesson,operation) {
  for(const {question:q} of questions(lesson)) {
   const answer=q.kind==='response'?'Unscored interpretation':q.kind==='sequence'?q.acceptedOrders[0]:q.kind==='evidence'?q.accepted[0]:q.kind==='table'?q.rows.map(row=>row.answer):q.kind==='matching'?q.pairs.map(pair=>pair.answer):q.answer;
   assert.equal(score(q,answer).correct,q.kind==='response'?null:true);
  }
  assert.equal(new Set(lesson.materials.map(material=>material.rootId)).size,lesson.materials.length);
  const actual=corpusOperation(lesson.materials[0].questions[0]);
  return {operation:actual,requestedOperation:operation,sameOperationApplication:lesson.materials.length===2&&lesson.materials.every(material=>corpusOperation(material.questions[0])===actual),roots:lesson.materials.map(material=>material.rootId),ids:lesson.materials.map(material=>material.id),teaching:lesson.teaching,workedExample:lesson.workedExample,nextStep:lesson.nextStep,lesson};
 }
 const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
 for(const input of generatorHashes)assert.equal(sha(input.path),input.sha256);
 const result={verifiedAt:new Date().toISOString(),scope:'Full runtime-reviewed excerpt seed-0 parser inventory at all three actual history bounds (0 support needed, 1 normal including empty history, 2 independent application), all twelve level/skill routes; distinct original roots, not distinct ZIPs. One focused two-root generation/scoring/support sample per available operation. Length-band counts use Plan2.6 editorial starting ranges, not difficulty/approval gates. Parser acceptance is not exhaustive seed reachability, editorial suitability, calibrated CEFR or audio/device acceptance. All source/rights/exclusion/audio holds retained.',generatorHashes:[...generatorHashes,{path:'scripts/teaching-coverage.mjs',sha256:sha('scripts/teaching-coverage.mjs')}],sourceHashes:banks.map(({id,hash})=>({id,sha256:hash})),bundledHashes:[...bundledPaths,'public/ipa/SOURCES.json','public/audio/a1-sentences/SENTENCES.json'].map(path=>({path,sha256:sha(path)})),rows};
 fs.mkdirSync('private/corpus',{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(rows.map(row=>({level:row.level,skill:row.skill,gaps:row.operations.filter(op=>op.materialStatus==='missing'||op.materialStatus==='single-root'||op.sample&&!op.sample.sameOperationApplication).map(op=>({name:op.name,roots:op.roots.length,sample:op.sample?.operation,application:op.sample?.sameOperationApplication}))}))));
}
