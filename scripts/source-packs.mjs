import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {createServer} from 'vite';
import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {createTopicPacks,coverageKeys,excludeHeldAudio,excludeUnavailableAudio,inferSourceTopic,sha} from './topic-packs.mjs';
import {readSourceReview,reviewedExcerpt,reviewedAudioHolds} from './corpus-review.mjs';
import {excludeUnavailableReading} from './reading-availability.mjs';
import {cloudListeningInputs} from './cloud-listening.mjs';
import {recoveredListeningInputs,recoveredListeningBatchInputs,recoveredListeningContinuationInputs} from './recovered-listening.mjs';
import {continuedListeningInputs} from './continued-listening.mjs';
import {appendShortListening} from './short-listening.mjs';
const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-source-packs',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const {inspectCommunityPack}=await server.ssrLoadModule('/src/data/communityPack.ts');
const {spokenCorpusLesson}=await server.ssrLoadModule('/src/core/spokenCorpus.ts');
const {gutenbergTerms}=await server.ssrLoadModule('/src/shared/sourceLicence.ts');
const {corpusSchema}=await server.ssrLoadModule('/src/core/corpus.ts');
const {corpusLesson}=await server.ssrLoadModule('/src/core/corpus.ts');
const readingRules=await server.ssrLoadModule('/src/core/corpus.ts');
const {spokenCondition}=await server.ssrLoadModule('/src/core/spokenCondition.ts');
const {spokenAttributionPairs}=await server.ssrLoadModule('/src/core/spokenAttribution.ts');
const rows=[], catalogue=[], topicInputs=[], excludedHeldAudio=[], preparedListeningIdentities=[], preparedPublicFiles=[], excludedUnavailableReading=[];
const original=JSON.parse(await readFile('private/corpus/spoken/processed.json','utf8')).records;
const byRoot=new Map(original.map(source=>[source.rootId,source]));
const reviewed=await readSourceReview(original);
const allowed=new Set(reviewed.records.map(source=>source.rootId));
const reviewRules=JSON.stringify({version:1,records:[...reviewed.spanExclusions].map(([rootId,spans])=>{
 const source=byRoot.get(rootId);
 return {rootId,articleSha256:source.articleSha256,textSha256:source.textSha256,decision:allowed.has(rootId)?'accepted-text':'withheld-text',excludedTargets:reviewed.targetExclusions.get(rootId)??[],excludedSpans:spans.map(({start,end,text})=>({start,end,sha256:createHash('sha256').update(text).digest('hex')}))};
})},null,2)+'\n';
if(process.argv.includes('--check')) {if(await readFile('content/corpus/text-review-rules.json','utf8')!==reviewRules)throw Error('SOURCE_REVIEW_RULES');}
else await writeFile('content/corpus/text-review-rules.json',reviewRules);
const previousCatalogue=JSON.parse(await readFile('content/source-packs.json','utf8'));
const sentenceClips=JSON.parse(await readFile('private/corpus/spoken/sentence-listening-clips/index.json','utf8'));
const audioReview=JSON.parse(await readFile('private/corpus/spoken/codex-audio-holds.json','utf8'));
reviewedAudioHolds(original,sentenceClips.records,audioReview);
const heldAudioBytes=new Set(audioReview.records.map(entry=>entry.clipSha256));
if(byRoot.size!==original.length)throw Error('DUPLICATE_ACQUIRED_ROOT');
if(!process.argv.includes('--check'))await mkdir('public/source-packs',{recursive:true});
// Preserve draft review status and source-specific licences; this is not editorial approval.

const topicTitles={campus:{'zh-Hans':'校园与教育','zh-Hant':'校園與教育',en:'Campus and education'},'daily-life':{'zh-Hans':'日常生活','zh-Hant':'日常生活',en:'Daily life'},science:{'zh-Hans':'科学','zh-Hant':'科學',en:'Science'},culture:{'zh-Hans':'文化与艺术','zh-Hant':'文化與藝術',en:'Culture and arts'},travel:{'zh-Hans':'旅行','zh-Hant':'旅行',en:'Travel'},technology:{'zh-Hans':'技术','zh-Hant':'技術',en:'Technology'},nature:{'zh-Hans':'自然','zh-Hant':'自然',en:'Nature'},environment:{'zh-Hans':'环境','zh-Hant':'環境',en:'Environment'},history:{'zh-Hans':'历史','zh-Hant':'歷史',en:'History'},literature:{'zh-Hans':'文学','zh-Hant':'文學',en:'Literature'},music:{'zh-Hans':'音乐','zh-Hant':'音樂',en:'Music'},film:{'zh-Hans':'影视与戏剧','zh-Hant':'影視與戲劇',en:'Film and theatre'},sport:{'zh-Hans':'体育','zh-Hant':'體育',en:'Sport'},health:{'zh-Hans':'健康','zh-Hant':'健康',en:'Health'},business:{'zh-Hans':'商业','zh-Hant':'商業',en:'Business'},society:{'zh-Hans':'社会','zh-Hant':'社會',en:'Society'},language:{'zh-Hans':'语言','zh-Hant':'語言',en:'Language'},food:{'zh-Hans':'饮食','zh-Hant':'飲食',en:'Food'}};
const topicRecords=(await Promise.all(['source-topics','additional-topics','open-reading-topics'].map(async name=>JSON.parse(await readFile('content/corpus/'+name+'.json','utf8').catch(error=>{if(error.code==='ENOENT')return '{"version":1,"records":[]}';throw error;}))))).flatMap(metadata=>metadata.records);
const topicOverrides=new Map(topicRecords.map(record=>[record.rootId,record]));
if(topicOverrides.size!==topicRecords.length)throw Error('DUPLICATE_TOPIC_SOURCE');
const topicDecisions=[];
const classify=record=>{
 const override=topicOverrides.get(record.rootId);
 if(override && (override.sourceHash!==record.sourceHash||!topicTitles[override.topic]))throw Error('TOPIC_SOURCE_CHANGED: '+record.rootId);
 const categories=byRoot.get(record.rootId)?.categories??'';
 const inferred=inferSourceTopic(record,categories);
 const topic=override?.topic??inferred.topic;
 if(!topicDecisions.some(entry=>entry.rootId===record.rootId))topicDecisions.push({rootId:record.rootId,sourceHash:record.sourceHash,topic,method:override?'hash-bound source topic metadata':inferred.method,...(!override?{evidence:inferred.evidence}:{})});
 return topic;
};
for(const [skill,directory] of [['reading','private/corpus/spoken/reviewed-reading-packs'],['listening','private/corpus/spoken/reviewed-listening-packs']]) {
 const inventory=JSON.parse(await readFile(directory+'/inventory.json','utf8'));
 for(const entry of inventory.packs){
  if(entry.bytes > 25*1024*1024)throw Error('STATIC_ASSET_LIMIT: '+entry.id);
  const bytes=new Uint8Array(await readFile(directory+'/'+entry.id+'.zip'));
  const pack=await inspectCommunityPack(bytes); if(pack.hash!==entry.sha256)throw Error(entry.id);
  if(pack.lessons.length || pack.sources.some(source => !/^(?:CC BY(?:-SA)? (?:[234]\.0|2\.5)(?: under Wikimedia Terms of Use; source-specific exceptions require review)?|CC-BY-SA-(?:[234]\.0|2\.5)|CC0|Public domain)$/.test(source.license))) throw Error('SOURCE_RIGHTS: '+entry.id);
  const bank=skill==='reading'?pack.corpus:pack.spoken;
  
  for(const source of bank.records){
   const acquired=byRoot.get(source.rootId);
   if(!allowed.has(source.rootId))throw Error('WITHHELD_SOURCE: '+source.rootId);
   if(!acquired||source.sourceHash!==acquired.articleSha256||source.title!==acquired.title||source.originalText!==acquired.text)throw Error('ACQUIRED_SOURCE_CHANGED: '+source.rootId);
   for(const excerpt of skill==='reading'?source.passages:source.clips){
    if(!reviewedExcerpt(acquired.text,excerpt.text,reviewed.spanExclusions.get(source.rootId)))throw Error('WITHHELD_SPAN: '+source.rootId);
    const targets=new Set((reviewed.targetExclusions.get(source.rootId)??[]).map(word=>word.toLowerCase()));
    if(targets.size&&(!excerpt.language||excerpt.language.tokens.some(token=>targets.has(excerpt.text.slice(token.start,token.end).toLowerCase()))))throw Error('WITHHELD_TARGET: '+source.rootId);
   }
   const peers=bank.records.filter(r=>r!==source);
   let result;
   for(const peer of peers){
    const test={...bank,records:[source,peer]};
    for(let seed=0;seed<3&&!result;seed++) result=skill==='reading'?corpusLesson(test,new Set(),seed,700,'C2'):spokenCorpusLesson(test,new Set(),seed,91,'C2');
    if(result&&result.materials.some(m=>m.rootId===source.rootId))break; result=undefined;
   }
   const clipAudit=[];
   if(skill==='listening')for(const clip of source.clips){
    let generates=false;
    if(!clip.qualityFlags.length)for(const peer of peers){
     const test={...bank,records:[{...source,clips:[clip]},peer]};
     for(let seed=0;seed<3&&!generates;seed++)generates=!!spokenCorpusLesson(test,new Set(),seed,91,'C2')?.materials.some(material=>material.id==='corpus-'+clip.id);
     if(generates)break;
    }
    clipAudit.push({id:clip.id,audioSha256:clip.audio.sha256,generates,reason:generates?'generated':clip.qualityFlags.length?'quality flags':'no supported task and distinct-root partner'});
   }
   rows.push({skill,rootId:source.rootId,title:source.title,generates:!!result,reason:result?'generated':skill==='reading'&&!source.passages.length?'no eligible prepared passage':skill==='listening'&&source.clips.every(clip=>clip.qualityFlags.length)?'quality flags':'no supported task and distinct-root partner',flags:skill==='listening'?[...new Set(source.clips.flatMap(c=>c.qualityFlags))]:[],...(skill==='listening'?{clips:clipAudit}:{})});
  }
  const rawFiles=unzipSync(bytes,{filter:file=>['corpus.json','spoken.json','sources.json'].includes(file.name)});
  const rawRecords=JSON.parse(new TextDecoder().decode(rawFiles[skill==='reading'?'corpus.json':'spoken.json'])).records;
  const sources=JSON.parse(new TextDecoder().decode(rawFiles['sources.json']));
  const media=Object.fromEntries(Object.entries(pack.media).map(([name,bytes])=>['media/'+name,bytes]));
  if(skill==='listening')preparedListeningIdentities.push(...coverageKeys(rawRecords.map(record=>({skill,record}))));
  const safeReading=skill==='reading'?excludeUnavailableReading(rawRecords,readingRules.corpusMaterial):{records:rawRecords,excluded:[]};
  excludedUnavailableReading.push(...safeReading.excluded);
  const safeAudio=skill==='listening'?excludeHeldAudio(rawRecords,heldAudioBytes):{records:safeReading.records,excluded:[]};
  excludedHeldAudio.push(...safeAudio.excluded);
  for(const record of safeAudio.records)topicInputs.push({skill,topic:classify(record),record,sources,media});
 }
}
// Keep the owning prepared Gutenberg bank consistent with its public shards.
// Its exclusions are already counted by the public input pass below.
const preparedGutenbergPath='content/corpus/gutenberg.json';
const preparedGutenberg=JSON.parse(await readFile(preparedGutenbergPath,'utf8'));
corpusSchema.parse(preparedGutenberg);
const safePreparedGutenberg=excludeUnavailableReading(preparedGutenberg.records,readingRules.corpusMaterial);
if(safePreparedGutenberg.excluded.length){
 if(process.argv.includes('--check'))throw Error('UNAVAILABLE_PREPARED_READING: '+preparedGutenbergPath);
 await writeFile(preparedGutenbergPath,JSON.stringify({...preparedGutenberg,records:safePreparedGutenberg.records})+'\n');
}
// Only explicit prepared public corpus files enter the new text directory.
const corpusNames=await readdir('public/corpus');
const publicCorpusNames=['voa','gutenberg','additional','wikiquote','open-reading'].flatMap(family=>corpusNames.filter(name=>new RegExp(`^${family}(?:-[1-9]\\d*)?\\.json$`).test(name)).sort((a,b)=>Number(b===family+'.json')-Number(a===family+'.json')||a.localeCompare(b,'en',{numeric:true})).map(name=>name.slice(0,-5)));
for(const name of publicCorpusNames) {
 const path='public/corpus/'+name+'.json';
 let value=await readFile(path,'utf8');
 let bank=corpusSchema.parse(JSON.parse(value));
 const safeReading=excludeUnavailableReading(bank.records,readingRules.corpusMaterial);
 excludedUnavailableReading.push(...safeReading.excluded);
 if(safeReading.excluded.length){
  if(process.argv.includes('--check'))throw Error('UNAVAILABLE_PREPARED_READING: '+path);
  bank={...bank,records:safeReading.records};
  value=JSON.stringify(bank)+'\n';
  await writeFile(path,value);
 }
 preparedPublicFiles.push({path:'/corpus/'+name+'.json',bytes:Buffer.byteLength(value),sha256:sha(value),roots:bank.records.length,passages:bank.records.reduce((total,record)=>total+record.passages.length,0)});
 for(const record of bank.records) {
  if(topicInputs.some(entry=>entry.skill==='reading'&&entry.record.rootId===record.rootId))throw Error('DUPLICATE_PREPARED_SOURCE: '+record.rootId);
  topicInputs.push({skill:'reading',topic:classify(record),record,sources:[{id:record.id,title:record.title,author:record.authors.join('; '),license:record.licence,attribution:record.attribution,sourceUrl:record.originalUrl}],media:{}});
 }
}
const readingExclusionJournal=excludedUnavailableReading.length?{scope:'Exact current-rule reading preparation exclusions only; raw source, originalText, daily quotes, earlier journals and saved learning retained.',excluded:excludedUnavailableReading}:JSON.parse(await readFile('private/corpus/unavailable-reading-exclusions.json','utf8').catch(error=>{if(error.code==='ENOENT')return '{"excluded":[]}';throw error;}));
if(!process.argv.includes('--check')&&excludedUnavailableReading.length)await writeFile('private/corpus/unavailable-reading-exclusions.json',JSON.stringify(readingExclusionJournal,null,2)+'\n');
// Three bounded derived windows augment the same original works, not new original recordings.
const shortListening=appendShortListening(topicInputs);
for(const entry of topicInputs.filter(e=>e.skill==='listening')){
 const clips=entry.record.clips.filter(c=>shortListening.accepted.some(r=>r.id===c.id&&r.rootId===entry.record.rootId));
 if(clips.length)preparedListeningIdentities.push(...coverageKeys([{...entry,record:{...entry.record,clips}}]));
}
const safeListeningIdentities=coverageKeys(topicInputs.filter(entry=>entry.skill==='listening'));
const heldIdentities=excludedHeldAudio.map(clip=>`listening\0${clip.rootId}\0${clip.sourceHash}\0${clip.id}\0${clip.excerptSha256}`);
if(JSON.stringify(preparedListeningIdentities.sort())!==JSON.stringify([...safeListeningIdentities,...heldIdentities].sort()))throw Error('TOPIC_HELD_COVERAGE');
const cloud=cloudListeningInputs();
const cloudIdentities=new Set(cloud.entries.flatMap(entry=>entry.record.clips.map(clip=>entry.record.rootId+'\0'+clip.id)));
topicInputs.push(...cloud.entries);
const recovered=recoveredListeningInputs();
topicInputs.push(...recovered.entries);
const recoveredBatch=recoveredListeningBatchInputs();
topicInputs.push(...recoveredBatch.entries);
const continuation=recoveredListeningContinuationInputs();
for(const entry of continuation.entries){entry.topic=inferSourceTopic(entry.record).topic;topicInputs.push(entry);}
const continued=continuedListeningInputs();
for(const entry of continued.entries){entry.topic=inferSourceTopic(entry.record).topic;topicInputs.push(entry);}
const unavailableAudio=[];
for(let index=topicInputs.length-1;index>=0;index--){
 const entry=topicInputs[index];if(entry.skill!=='listening')continue;
 const result=excludeUnavailableAudio([entry.record],clip=>{
  for(let seed=0;seed<Math.max(24,clip.wordCount*2);seed++)if(readingRules.corpusRestoration(clip.text,seed,clip.language)||readingRules.corpusSequence(clip.text,seed)||readingRules.corpusQualification(clip.text,seed)||readingRules.corpusAttribution(clip.text,seed)||readingRules.corpusDates(clip.text,seed)||readingRules.corpusOutcome(clip.text,seed)||spokenCondition(clip.text,seed)||spokenAttributionPairs(clip.text,seed))return true;
  return false;
 });
 unavailableAudio.push(...result.excluded);
 if(result.records.length)entry.record=result.records[0];else topicInputs.splice(index,1);
}
const activeCloudIdentities=new Set(topicInputs.filter(entry=>entry.skill==='listening').flatMap(entry=>entry.record.clips.map(clip=>entry.record.rootId+'\0'+clip.id)).filter(id=>cloudIdentities.has(id)));
cloud.report.publicSelection={activeClips:activeCloudIdentities.size,excludedUnsupported:unavailableAudio.filter(clip=>cloudIdentities.has(clip.rootId+'\0'+clip.id)).length};
const recoveredIds=new Set(recovered.report.retained.map(clip=>clip.rootId+'\0'+clip.id));
const recoveredActive=topicInputs.filter(entry=>entry.skill==='listening').flatMap(entry=>entry.record.clips.filter(clip=>recoveredIds.has(entry.record.rootId+'\0'+clip.id)));
if(recoveredActive.length!==recovered.report.applied)throw Error('RECOVERED_LISTENING_COVERAGE');
const recoveredBatchIds=new Set(recoveredBatch.report.retained.map(clip=>clip.rootId+'\0'+clip.id));
const recoveredBatchActive=topicInputs.filter(entry=>entry.skill==='listening').flatMap(entry=>entry.record.clips.filter(clip=>recoveredBatchIds.has(entry.record.rootId+'\0'+clip.id)));
if(recoveredBatchActive.length!==recoveredBatch.report.applied)throw Error('RECOVERED_LISTENING_BATCH_COVERAGE');
const continuationIds=new Set(continuation.report.retained.map(clip=>clip.rootId+'\0'+clip.id));
const continuationActive=topicInputs.filter(entry=>entry.skill==='listening').flatMap(entry=>entry.record.clips.filter(clip=>continuationIds.has(entry.record.rootId+'\0'+clip.id)));
if(continuationActive.length!==continuation.report.applied)throw Error('RECOVERED_CONTINUATION_COVERAGE');
const continuedIds=new Set(continued.report.retained.map(clip=>clip.rootId+'\0'+clip.id));
const continuedActive=topicInputs.filter(entry=>entry.skill==='listening').flatMap(entry=>entry.record.clips.filter(clip=>continuedIds.has(entry.record.rootId+'\0'+clip.id)));
if(continuedActive.length!==continued.report.applied)throw Error('CONTINUED_LISTENING_COVERAGE');
if(!process.argv.includes('--check'))await writeFile('private/corpus/continued-listening-application.json',JSON.stringify(continued.report,null,2)+'\n');
if(!process.argv.includes('--check'))await writeFile('private/corpus/recovered-listening-continuation-application.json',JSON.stringify(continuation.report,null,2)+'\n');
if(!process.argv.includes('--check'))await writeFile('private/corpus/recovered-listening-batch-application.json',JSON.stringify(recoveredBatch.report,null,2)+'\n');
if(!process.argv.includes('--check'))await writeFile('private/corpus/recovered-listening-application.json',JSON.stringify(recovered.report,null,2)+'\n');
if(!process.argv.includes('--check'))await writeFile('private/corpus/cloud-listening-application.json',JSON.stringify(cloud.report,null,2)+'\n');
if(!process.argv.includes('--check'))await writeFile('private/corpus/unavailable-audio-exclusions.json',JSON.stringify({scope:'Public preparation cleanup only; raw media, historical journals and saved learning retained.',excluded:unavailableAudio},null,2)+'\n');
if(!process.argv.includes('--check'))await writeFile('private/corpus/short-listening-application-20261013.json',JSON.stringify(shortListening,null,2)+'\n');
const themed=createTopicPacks(topicInputs,topicTitles,gutenbergTerms), packedIdentities=[];
for(const pack of themed) {
 const file=pack.entry.skill==='reading'?'corpus.json':'spoken.json',serialized=unzipSync(pack.bytes,{filter:entry=>entry.name===file})[file];
 packedIdentities.push(...coverageKeys(JSON.parse(new TextDecoder().decode(serialized)).records.map(record=>({skill:pack.entry.skill,record}))));
 const inspected=await inspectCommunityPack(pack.bytes);
 if(inspected.hash!==pack.entry.sha256)throw Error('TOPIC_PACKAGE_INTEGRITY');
 if(process.argv.includes('--check')){if(!Buffer.from(pack.bytes).equals(await readFile('public'+pack.entry.path)))throw Error('SOURCE_ASSET: '+pack.entry.id);}
 else await writeFile('public'+pack.entry.path,pack.bytes);
 const bank=pack.entry.skill==='reading'?inspected.corpus:inspected.spoken;
 const bounds=pack.entry.skill==='reading'?[120,160,220,300,500,700]:[8,12,20,25,35,60,75,91];
 const minimum=bounds.find(value=>pack.entry.skill==='reading'?corpusLesson(bank,new Set(),0,value,'B2'):spokenCorpusLesson(bank,new Set(),0,value,'B2'))??null;
 catalogue.push({...pack.entry,minWords:pack.entry.skill==='reading'?minimum:null,minSeconds:pack.entry.skill==='listening'?minimum:null});
}
if(JSON.stringify(coverageKeys(topicInputs))!==JSON.stringify(packedIdentities.sort()))throw Error('TOPIC_SERIALIZED_EXCERPT_COVERAGE');
if(!process.argv.includes('--check'))await writeFile('private/corpus/theme-pack-coverage.json',JSON.stringify({verifiedAt:new Date().toISOString(),kind:'Exact source/excerpt/hash conservation; not rights/audio/level approval',inputEqualsSerializedOutput:true,identities:packedIdentities,excludedHeldAudio,packs:catalogue.map(pack=>({id:pack.id,sha256:pack.sha256,path:pack.path}))},null,2)+'\n');
// Preserve the separately prepared, exact reviewed teaching windows during bulk regeneration.
const teachingPacks=JSON.parse(await readFile('content/corpus/teaching-source-packs.json','utf8'));
if(teachingPacks.version!==1||!Array.isArray(teachingPacks.packs))throw Error('TEACHING_SOURCE_CATALOGUE');
for(const entry of teachingPacks.packs){
 if(!/^(?:reading|listening)-[a-z-]+-[a-f0-9]{12}$/.test(entry.id)||!['reading','listening'].includes(entry.skill)||entry.path!=='/source-packs/'+entry.id+'.zip'||catalogue.some(pack=>pack.id===entry.id))throw Error('TEACHING_SOURCE_PATH');
 const bytes=new Uint8Array(await readFile('public'+entry.path)),pack=await inspectCommunityPack(bytes),bank=entry.skill==='reading'?pack.corpus:pack.spoken;
 if(bytes.length!==entry.bytes||pack.hash!==entry.sha256||pack.id!==entry.id||pack.lessons.length||!bank||bank.records.length!==entry.roots||bank.records.reduce((sum,record)=>sum+(record.passages??record.clips).length,0)!==(entry.passages??entry.clips))throw Error('TEACHING_SOURCE_PACK');
 catalogue.push(entry);
}
// Delete replaced generated outputs; recovery points are managed by the project backup chain.
const obsoleteThemes=previousCatalogue.packs.filter(entry=>/^(?:reading|listening)-[a-z-]+-[a-f0-9]{12}$/.test(entry.id)&&!catalogue.some(current=>current.sha256===entry.sha256));
const retainedPath='content/corpus/retained-listening-packs.json';
const retained=JSON.parse(await readFile(retainedPath,'utf8'));
for(const entry of obsoleteThemes.filter(entry=>entry.skill==='listening')){
 const known=retained.records.find(record=>record.id===entry.id);
 if(known&&known.sha256!==entry.sha256)throw Error('RETAINED_SITE_PACK_CHANGED');
 if(!known)retained.records.push({id:entry.id,sha256:entry.sha256});
}
const retainedBytes=JSON.stringify(retained,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(retainedPath,'utf8')!==retainedBytes)throw Error('RETAINED_SITE_PACKS');}
else await writeFile(retainedPath,retainedBytes);
if(!process.argv.includes('--check'))for(const entry of obsoleteThemes){
 if(entry.path!=='/source-packs/'+entry.id+'.zip')throw Error('OBSOLETE_TOPIC_PATH');
 const bytes=await readFile('public'+entry.path);
 if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw Error('OBSOLETE_TOPIC_INTEGRITY');
 await unlink('public'+entry.path);
}
for(const file of await readdir('public/source-packs'))if(file.endsWith('.zip')&&!catalogue.some(pack=>pack.path==='/source-packs/'+file))throw Error('UNLISTED_SOURCE_ASSET: '+file);
const manifest=JSON.stringify({version:1,packs:catalogue},null,2)+'\n';
if(process.argv.includes('--check')) {if(await readFile('content/source-packs.json','utf8')!==manifest)throw Error('SOURCE_CATALOGUE');}
else { await writeFile('content/source-packs.json',manifest); await writeFile('content/corpus/runtime-audit.json',JSON.stringify({checkedAt:new Date().toISOString(),kind:'automated generation and package integrity; not editorial or audio listening approval',textReview:reviewed.review,teachingSupplement:{sourceOnly:true,manifest:'content/corpus/teaching-source-packs.json',manifestSha256:sha(await readFile('content/corpus/teaching-source-packs.json')),packs:teachingPacks.packs.map(({id,sha256,path})=>({id,sha256,path})),readingContexts:teachingPacks.packs.reduce((n,p)=>n+(p.passages??0),0),continuousRecordings:teachingPacks.packs.reduce((n,p)=>n+(p.clips??0),0),scope:'Separate already-inspected complete source windows; current source/teaching/audio decisions and original holds retained. Integrity and local installation are not CEFR/rights/device/effect approval.'},topicCoverage:{preparedPublicFiles,inputExcerptCount:coverageKeys(topicInputs).length,outputExcerptCount:coverageKeys(themed.flatMap(pack=>pack.inputs)).length,identitySha256:sha(JSON.stringify(coverageKeys(topicInputs))),roots:[...new Set(topicInputs.map(entry=>entry.skill+':'+entry.record.rootId))].length,packs:themed.length,withheldTextRoots:reviewed.review.withheld.length,excludedHeldAudio,unavailableAudio,unavailableReading:{newlyExcluded:excludedUnavailableReading.length,journalRows:readingExclusionJournal.excluded},decisions:topicDecisions},acquired:original.map(source=>({rootId:source.rootId,textSha256:source.textSha256,audioSha256:source.audioSha256,readingPrepared:rows.some(row=>row.skill==='reading'&&row.rootId===source.rootId),listeningPrepared:rows.some(row=>row.skill==='listening'&&row.rootId===source.rootId)})),rows},null,2)+'\n'); }
console.log(JSON.stringify({topicPackages:catalogue.length,sourceFamilies:[...new Set(catalogue.flatMap(pack=>pack.sourceFamilies))].sort(),preparedPublicFiles,readingSafeRoots:new Set(topicInputs.filter(entry=>entry.skill==='reading').map(entry=>entry.record.rootId)).size,listeningSafeRoots:new Set(topicInputs.filter(entry=>entry.skill==='listening').map(entry=>entry.record.rootId)).size,excludedHeldClips:excludedHeldAudio.length,reading:rows.filter(r=>r.skill==='reading').length,readingUsable:rows.filter(r=>r.skill==='reading'&&r.generates).length,listening:rows.filter(r=>r.skill==='listening').length,listeningUsable:rows.filter(r=>r.skill==='listening'&&r.generates).length,listeningClips:rows.flatMap(row=>row.clips??[]).length,listeningUsableClips:rows.flatMap(row=>row.clips??[]).filter(clip=>clip.generates).length,eligibleBanks:Object.fromEntries([8,12,20,25,35,60,75,91].map(s=>[s,catalogue.filter(e=>e.skill==='listening'&&e.minSeconds!==null&&e.minSeconds<=s).length]))}));
await server.close();
