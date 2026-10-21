import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recoveredPreparedText,verifyRecoveredListening,verifyRecoveredBatch,recoveredBatchContextSha256} from '../scripts/recovered-listening.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const gates={sourceRights:true,sourceRoot:true,sourceContext:true,transcript:true,fullDecode:true,wordTiming:true,continuousWindow:true,acousticBoundary:true,mediaHash:true};
const kinds=['rights-context','boundary','processing','media-validation'];

// Test adapters with synthetic media without granting recording acceptance.
function fixture() {
 const processing=JSON.parse(readFileSync('private/verification/listening360-scott-processing-20261012/verification.json'));
 const approved=JSON.parse(readFileSync('private/verification/listening360-scott-rights-closure-20261012/verification.json'));
 const source=approved.source,files=new Map();files.set(source.path,readFileSync(source.path));
 const clips=['2299-6524-0025'].map(id=>{
  const window=processing.windows.find(row=>row.id===id);assert(window);
  for(const path of [window.audioPath,window.transcriptPath,window.rawResultPath])files.set(path,readFileSync(path));
  const audioPath='private/verification/recovered-listening-test/'+id+'.mp3',audio=Buffer.from('isolated synthetic media '+id);files.set(audioPath,audio);
  const evidence=kinds.map(kind=>{const path='private/verification/recovered-listening-test/'+kind+'.json',bytes=Buffer.from(JSON.stringify({fixture:true,kind}));files.set(path,bytes);return {kind,path,sha256:sha(bytes)};});
  return {id,text:window.text,sourceSpan:window.sourceSpan,rawResultPath:window.rawResultPath,rawResultSha256:window.rawResultSha256,originalAudioPath:window.audioPath,originalAudioSha256:window.audioSha256,transcriptPath:window.transcriptPath,transcriptSha256:window.transcriptSha256,audioPath,audioSha256:sha(audio),duration:window.duration,gates:{...gates},evidence};
 });
 const scope={version:1,scope:{regions:['mainland-China','USA'],use:'local',published:false},sources:[{bookId:'11579',canonicalBookId:'11579',rootId:'gutenberg-book-11579',sourcePath:source.path,sourceHash:source.sha256,sourceUrl:'https://www.gutenberg.org/cache/epub/11579/pg11579.txt',title:'Scott’s Last Expedition, Volume I',authors:['Robert Falcon Scott'],licence:'Public-domain scoped text; Project Gutenberg terms retained',attribution:'Scott; electronic edition credits retained',permissionReview:'Isolated adapter test, not approval',topic:'history',acquiredAt:'2026-10-12T00:00:00.000Z',clips}]};
 return {scope,files,read:path=>{assert(files.has(path),'unknown fixture path');return files.get(path);}};
}



test('scoped one-window adapter omits whole-book text and preserves original root, credits, bytes and exact word times',()=>{
 const f=fixture(),result=verifyRecoveredListening(f.scope,f.read);assert.equal(result.entries.length,1);const entry=result.entries[0];assert.equal(entry.record.rootId,'gutenberg-book-11579');assert.equal(entry.record.originalText,undefined);assert.equal(entry.record.clips.length,1);assert.equal(entry.sources.length,2);assert.deepEqual(result.report.retained.map(row=>row.candidateId),['2299-6524-0025']);assert.equal(result.report.published,false);assert.equal(result.report.physicalDeviceAccepted,false);assert.equal(result.report.frozenCloudPoolRead,false);
 for(let i=0;i<1;i++){const clip=entry.record.clips[i],input=f.scope.sources[0].clips[i];const prepared=recoveredPreparedText(input.text,input.sourceSpan.start);assert.equal(clip.text,prepared.text);assert.equal(clip.segments.map(part=>part.text).join(''),prepared.text);assert.deepEqual(result.report.retained[i].preparedOffsetToOriginalOffset,prepared.preparedOffsetToOriginalOffset);assert.equal(sha(entry.media[clip.audio.src]),input.audioSha256);assert.equal(clip.audio.author,'cpalmer17');assert.equal(clip.segments.length,46);assert.deepEqual(clip.qualityFlags,[]);}
});

test('source/window/territory gates cannot be bypassed by quality flags, extra windows or changed evidence',()=>{
 const mutations=[s=>s.scope.published=true,s=>s.scope.regions.push('worldwide'),s=>s.sources[0].rootId='gutenberg-book-999',s=>s.sources[0].canonicalBookId='999',s=>s.sources[0].sourceHash='0'.repeat(64),s=>s.sources[0].clips[0].sourceSpan.start++,s=>s.sources[0].clips[0].text+=' again',s=>s.sources[0].clips[0].id='2299-6524-0011',s=>s.sources[0].clips.push(structuredClone(s.sources[0].clips[0])),s=>s.sources[0].clips[0].id='2299-6524-0010',s=>s.sources[0].clips[0].qualityFlags=[],s=>delete s.sources[0].clips[0].gates.wordTiming,s=>s.sources[0].clips[0].gates.acousticBoundary=false,s=>s.sources[0].clips[0].gates.sourceRights='true',s=>s.sources[0].clips[0].evidence[0].sha256='0'.repeat(64),s=>s.sources[0].clips[0].evidence.pop(),s=>s.sources[0].clips[0].evidence[0].path='private/verification/../escape',s=>s.sources[0].clips[0].evidence[0].kind='made-up',s=>s.sources[0].clips[0].duration=Infinity,s=>s.sources[0].clips[0].originalAudioSha256='0'.repeat(64)];
 for(const mutate of mutations){const f=fixture();mutate(f.scope);assert.throws(()=>verifyRecoveredListening(f.scope,f.read));}
});

test('actual read bytes bind source, MP3, transcript, raw word array and evidence, not their declarations alone',()=>{
 for(const field of ['sourcePath','audioPath','transcriptPath','rawResultPath']){const f=fixture(),source=f.scope.sources[0],path=field==='sourcePath'?source.sourcePath:source.clips[0][field];f.files.set(path,Buffer.from('corrupt'));assert.throws(()=>verifyRecoveredListening(f.scope,f.read),/RECOVERED_FILE_HASH/);}
 const f=fixture(),clip=f.scope.sources[0].clips[0],raw=JSON.parse(f.files.get(clip.rawResultPath));raw.segments[0].words[0].word='Changed';const bytes=Buffer.from(JSON.stringify(raw));f.files.set(clip.rawResultPath,bytes);clip.rawResultSha256=sha(bytes);assert.throws(()=>verifyRecoveredListening(f.scope,f.read),/RECOVERED_RAW_SEGMENT/);
});


test('Scott print reflow preserves two full sentences and exact punctuation/source offset mapping',()=>{
 const f=fixture(),input=f.scope.sources[0].clips[0],prepared=recoveredPreparedText(input.text,input.sourceSpan.start);
 assert(!/[\r\n]/.test(prepared.text));assert.equal(prepared.text.split(/(?<=[.!?]) +/).length,2);
 assert.equal(prepared.text,'Evans is in charge of the road and periodically goes along searching for bad places and bridging cracks with boards and snow. Bowers checks every case as it comes on shore and dashes off to the ship to arrange the precedence of different classes of goods.');
 assert.equal(prepared.text.replace(/\s/g,''),input.text.replace(/\s/g,''));
 assert.equal(prepared.preparedOffsetToOriginalOffset.length,prepared.text.length+1);
 for(let i=0;i<prepared.text.length;i++){const original=input.text[prepared.preparedOffsetToOriginalOffset[i]-input.sourceSpan.start];if(prepared.text[i]!==' ')assert.equal(prepared.text[i],original);else assert(/[ \r\n]/.test(original));if(i)assert(prepared.preparedOffsetToOriginalOffset[i]>prepared.preparedOffsetToOriginalOffset[i-1]);}
 assert.equal(prepared.preparedOffsetToOriginalOffset.at(-1),input.sourceSpan.end);
 const r=verifyRecoveredListening(f.scope,f.read),retained=r.report.retained[0];assert.equal(retained.sourceTextSha256,sha(input.text));assert.equal(retained.preparedTextSha256,sha(prepared.text));assert.deepEqual(retained.sourceSpan,input.sourceSpan);
 assert.equal(r.entries[0].record.clips[0].segments.map(w=>w.text).join(''),prepared.text);
 const folded=recoveredPreparedText('A  b.\r\n\r\nC d.',10);assert.equal(folded.text,'A b. C d.');assert.equal(folded.preparedOffsetToOriginalOffset.at(-1),23);
});


// Verify cloud completion/member bytes; use mutated review fixtures only to test guards.
const batchBase='private/verification/listening360-cloud-processing-20261012',batchId='2775-134792-0012';
function batchFixture(cpu=false) {
 const files=new Map(),base=batchBase+'/partial-output/restored',paths={job:base+'/job.json',complete:batchBase+'/cloud-execution-observations.json',output:batchBase+'/full-output/output-manifest.json',recovery:batchBase+'/partial-output/verification.json',independent:batchBase+'/partial-output/independent-verification.json',context:'private/verification/listening360-full-source-audit-20261012/source-context-977-snapshot423.json',authority:'content/corpus/cloud-listening-sources.json',export:'private/verification/listening360-manifest-hash-recovery-20261011-095201/scale-export-manifest.json'};
 for(const p of Object.values(paths))files.set(p,readFileSync(p));
 const context=JSON.parse(files.get(paths.context)).windows.find(w=>w.id===batchId),processingPath=base+'/windows/'+batchId+'.json',processing=JSON.parse(readFileSync(processingPath));
 const originalBase='private/verification/listening360-decoded-originals-recovery-20261011-101300/restored/',sourcePath='private/verification/listening360-public-originals-recovery-cli-20261011/original-books/'+context.bookId+'.txt',originalAudioPath=originalBase+processing.input.audioPath,transcriptPath=originalBase+processing.input.transcriptPath,rawResultPath=base+'/raw/'+batchId+'.json',bindingPath=base+'/raw/'+batchId+'.binding.json',audioPath=base+'/'+processing.media.path,diagnosticPath=batchBase+'/cpu-media-20261012/diagnostics/'+batchId+'.json';
 for(const p of [sourcePath,originalAudioPath,transcriptPath,rawResultPath,bindingPath,audioPath,processingPath,diagnosticPath,'private/verification/listening360-decoded-originals-recovery-20261011-101300/restored/decoded-input/LibriSpeech/SPEAKERS.TXT'])files.set(p,readFileSync(p));
 const ref=path=>({path,sha256:sha(files.get(path))}),put=(name,value)=>{const path='private/verification/recovered-batch-test/'+name+'.json';files.set(path,Buffer.from(JSON.stringify(value)));return ref(path);};
 const actualReview=JSON.parse(readFileSync('private/verification/listening360-ai-text-review-a-20261012/decisions.json')).find(row=>row.id===batchId);assert.equal(actualReview.decision,'pass-ai-text');
 const w={id:batchId,processingPath,processingSha256:sha(files.get(processingPath)),rawResultPath,rawResultSha256:sha(files.get(rawResultPath)),bindingPath,bindingSha256:sha(files.get(bindingPath)),sourcePath,sourceSha256:context.sourceHash,originalAudioPath,originalAudioSha256:processing.input.audioSha256,transcriptPath,transcriptSha256:processing.input.transcriptSha256,audioPath,audioSha256:sha(files.get(audioPath))};
 let boundaryRef={id:batchId,...ref(diagnosticPath)},supplemental=[];
 if(cpu){
  // Keep CPU replacements and missing-media inventories as unapproved test fixtures.
  const diagnostic=JSON.parse(files.get(diagnosticPath)),media=Buffer.from('isolated new CPU media bytes'),newPath=diagnosticPath.replace(/diagnostics\/[^/]+$/,'media/'+batchId+'.mp3');files.set(newPath,media);
  diagnostic.media={path:'media/'+batchId+'.mp3',bytes:media.length,sha256:sha(media),decode:{...processing.media.decode,engine:'ffmpeg-cpu-full-stream-f32le',allFinite:true},independentNewCPUEncoding:true,restoresOldCloudMediaIdentity:false,oldCloudMediaExpected:processing.media};files.set(diagnosticPath,Buffer.from(JSON.stringify(diagnostic)));boundaryRef={id:batchId,...ref(diagnosticPath)};supplemental=[boundaryRef];w.audioPath=newPath;w.audioSha256=sha(media);
  const recovery=JSON.parse(files.get(paths.recovery)),independent=JSON.parse(files.get(paths.independent));delete recovery.members['media/'+batchId+'.mp3'];independent.completeMediaDiagnosticIds=independent.completeMediaDiagnosticIds.filter(id=>id!==batchId);files.set(paths.recovery,Buffer.from(JSON.stringify(recovery)));files.set(paths.independent,Buffer.from(JSON.stringify(independent)));
 }
 const scope={version:1,scope:{regions:['USA'],use:'local',published:false},job:ref(paths.job),completionReport:ref(paths.complete),outputManifest:ref(paths.output),recoveryReview:ref(paths.recovery),independentReview:ref(paths.independent),contextReview:{path:paths.context,sha256:recoveredBatchContextSha256},textReview:put('text',{rows:[actualReview]}),boundaryReview:put('boundary',{rows:[boundaryRef]}),supplementalMediaReview:put('supplemental',{rows:supplemental}),windows:[w]};
 return {files,scope,processing,read:p=>{assert(files.has(p),'unknown batch fixture path');return files.get(p);},change:(ref,mutate)=>{const data=JSON.parse(files.get(ref.path));mutate(data);const bytes=Buffer.from(JSON.stringify(data));files.set(ref.path,bytes);ref.sha256=sha(bytes);}};
}

test('complete cloud execution with partial retrieval applies only an individually complete USA window',()=>{
 const f=batchFixture(),r=verifyRecoveredBatch(f.scope,f.read);assert.equal(r.entries.length,1);assert.equal(r.entries[0].record.rootId,'gutenberg-book-135');assert.equal(r.entries[0].record.originalText,undefined);assert.equal(r.report.applied,1);assert.equal(r.report.completeProcessingWindows,4256);assert.equal(r.report.all4256Retrieved,false);assert.equal(r.report.recoveredDiagnosticWindows,3342);assert.equal(r.report.comprehensiveSemanticApproval,false);assert.equal(r.report.physicalDeviceAccepted,false);assert.equal(r.report.otherRegionsUnverified,true);assert.deepEqual(r.report.regions,['USA']);const c=r.entries[0].record.clips[0];assert.equal(c.segments.map(w=>w.text).join(''),c.text);assert(!/[\r\n]/.test(c.text));assert.equal(sha(r.entries[0].media[c.audio.src]),f.scope.windows[0].audioSha256);
});

test('partial scope still requires the actual all-4256 cloud terminal, output pin and exact original members',()=>{
 for(const mutation of [f=>f.scope.scope.regions.push('mainland-China'),f=>f.scope.windows.push(structuredClone(f.scope.windows[0])),f=>f.scope.windows[0].id='unknown',f=>f.scope.windows[0].qualityFlags=[],f=>f.scope.contextReview.sha256='0'.repeat(64),f=>f.scope.windows[0].sourceSha256='0'.repeat(64),f=>f.scope.outputManifest.sha256='0'.repeat(64)]){const f=batchFixture();mutation(f);assert.throws(()=>verifyRecoveredBatch(f.scope,f.read));}
 for(const mutate of [x=>x.actualProgressObservations.at(-1).completed=25,x=>x.actualProgressObservations.at(-1).status='running',x=>x.firstCheckpoint.jobIdentitySha256='0'.repeat(64),x=>x.actualProgressObservations.at(-1).outputManifestSha256='0'.repeat(64)]){const f=batchFixture();f.change(f.scope.completionReport,mutate);assert.throws(()=>verifyRecoveredBatch(f.scope,f.read));}
 for(const mutate of [x=>x.all4256Retrieved=true,x=>delete x.members['raw/'+batchId+'.json'],x=>delete x.members['raw/'+batchId+'.binding.json'],x=>delete x.members['windows/'+batchId+'.json'],x=>x.members['raw/'+batchId+'.json'].recoveryMethod='declared-pass',x=>x.members['raw/'+batchId+'.json'].bytes++]){const f=batchFixture();f.change(f.scope.recoveryReview,mutate);assert.throws(()=>verifyRecoveredBatch(f.scope,f.read));}
 const f=batchFixture();f.change(f.scope.independentReview,x=>{x.completeDiagnosticIds=x.completeDiagnosticIds.filter(id=>id!==batchId);x.windows--;});assert.throws(()=>verifyRecoveredBatch(f.scope,f.read));
});

test('AI holds/hash mismatches and measured boundary holds cannot be replaced by declared passed flags',()=>{
 for(const mutate of [x=>x.rows[0].decision='held-ai-text',x=>x.rows[0].contextSha256='0'.repeat(64),x=>x.rows[0].sourceTextSha256='0'.repeat(64),x=>x.rows[0].reviewer='',x=>x.rows[0].inspectedScope='']){const f=batchFixture();f.change(f.scope.textReview,mutate);assert.throws(()=>verifyRecoveredBatch(f.scope,f.read));}
 for(const mutate of [x=>x.voiceBoundary.technicalVoiceBoundaryDiagnosticPassed=false,x=>x.voiceBoundary.frameRMS.fill(0),x=>x.voiceBoundary.frameRMS[0]=1,x=>x.voiceBoundary.headMarginSeconds=0,x=>x.originalDecode.pcmSha256='0'.repeat(64),x=>x.rawResult.sha256='0'.repeat(64)]){const f=batchFixture(),boundary=JSON.parse(f.files.get(f.scope.boundaryReview.path)),ref=boundary.rows[0];f.change(ref,mutate);f.change(f.scope.boundaryReview,x=>x.rows[0]=ref);assert.throws(()=>verifyRecoveredBatch(f.scope,f.read));}
});

test('independent new CPU media has separate identity and rejects changed new bytes/hash/decode',()=>{
 const f=batchFixture(true),r=verifyRecoveredBatch(f.scope,f.read);assert.equal(r.report.supplementalMediaCount,1);assert.equal(r.report.all4256Retrieved,false);assert.notEqual(f.scope.windows[0].audioSha256,f.processing.media.sha256);
 for(const mutate of [x=>x.media.sha256='0'.repeat(64),x=>x.media.bytes++,x=>x.media.decode.peak=1,x=>x.media.restoresOldCloudMediaIdentity=true,x=>x.media.independentNewCPUEncoding=false,x=>x.media.oldCloudMediaExpected.sha256='0'.repeat(64)]){const f=batchFixture(true),boundary=JSON.parse(f.files.get(f.scope.boundaryReview.path)),ref=boundary.rows[0];f.change(ref,mutate);f.change(f.scope.boundaryReview,x=>x.rows[0]=ref);f.change(f.scope.supplementalMediaReview,x=>x.rows[0]=ref);assert.throws(()=>verifyRecoveredBatch(f.scope,f.read));}
});

test('batch binds actual source, original FLAC, transcript, raw, binding and media bytes',()=>{
 for(const field of ['sourcePath','originalAudioPath','transcriptPath','processingPath','rawResultPath','bindingPath','audioPath']){const f=batchFixture();f.files.set(f.scope.windows[0][field],Buffer.from('corrupt'));assert.throws(()=>verifyRecoveredBatch(f.scope,f.read),/RECOVERED_BATCH_FILE_CHANGED/);}
 const f=batchFixture(),w=f.scope.windows[0],d=JSON.parse(f.files.get(w.processingPath));d.strictWordTimingDiagnosticPassed=false;const bytes=Buffer.from(JSON.stringify(d));f.files.set(w.processingPath,bytes);w.processingSha256=sha(bytes);assert.throws(()=>verifyRecoveredBatch(f.scope,f.read),/RECOVERED_BATCH_OUTPUT_MEMBER_HASH/);
});

test('continuation keeps original cloud pins and rejects contradictory GPU text, changed new media and widened regions',()=>{
 const scope=JSON.parse(readFileSync('content/corpus/recovered-listening-continuation-sources.json'));scope.windows=scope.windows.slice(0,1);
 const cache=new Map(),read=path=>{if(!cache.has(path))cache.set(path,readFileSync(path));return cache.get(path);};
 assert.equal(verifyRecoveredBatch(scope,read).report.applied,1);
 const widened=structuredClone(scope);widened.scope.regions.push('mainland-China');assert.throws(()=>verifyRecoveredBatch(widened,read),/RECOVERED_BATCH_REGIONS/);
 const path=scope.textReview.path,text=JSON.parse(read(path));const selected=text.rows.find(row=>row.id===scope.windows[0].id);selected.actualModelDecision.parsed.completeSentences=false;
 const bytes=Buffer.from(JSON.stringify(text)),changed=structuredClone(scope);changed.textReview.sha256=sha(bytes);
 assert.throws(()=>verifyRecoveredBatch(changed,p=>p===path?bytes:read(p)),/RECOVERED_EXTENSION_ACTUAL_TEXT/);
 const media=scope.windows[0].audioPath;assert.throws(()=>verifyRecoveredBatch(scope,p=>p===media?Buffer.from('changed actual bytes'):read(p)),/RECOVERED_BATCH_FILE_CHANGED/);
});
