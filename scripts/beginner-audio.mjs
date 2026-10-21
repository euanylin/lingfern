import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const approvals=JSON.parse(await readFile('private/corpus/voa-course/short-sentences/approved-clips.json','utf8'));
const roots=JSON.parse(await readFile('content/corpus/voa-beginners.json','utf8'));
const configurations=[{number:2,rootId:'voa-article-3113733',name:'voa-introductions-short',start:3.88,end:10.02,ids:[1,2,3]},
 {number:5,rootId:'voa-article-3168971',name:'voa-kitchen-short',start:21.98,end:29.90,ids:[2,3]},
 {number:3,rootId:'voa-article-3126527',name:'voa-supermarket-short',start:85.06,end:90.26,ids:[20,21]},
 {number:4,rootId:'voa-article-3168920',name:'voa-objects-short',start:38.84,end:44.94,ids:[11,12,13]},
 {number:7,rootId:'voa-article-3240468',name:'voa-reading-short',start:104.10,end:109.90,ids:[46,47,48]},
 {number:1,rootId:'voa-article-3111026',name:'voa-greeting-short',start:5.42,end:10.12,ids:[3,4]},
 {number:6,rootId:'voa-article-3225958',name:'voa-gym-short',start:44.82,end:53.44,ids:[11,12]}];
const staging='private/corpus/voa-course/short-sentences/staging';
await mkdir(staging,{recursive:true});
const results=await Promise.allSettled(configurations.map(async cfg=>{
 const provenance=[1,2].includes(cfg.number)?JSON.parse(await readFile('private/corpus/voa-course/conversations.json','utf8')).records.find(record=>record.rootId===cfg.rootId):[3,4].includes(cfg.number)?JSON.parse(await readFile('private/corpus/voa-course/additional-conversations.json','utf8')).records.find(record=>record.rootId===cfg.rootId):JSON.parse(await readFile(`private/corpus/voa-course/lesson-${cfg.number}-source.json`,'utf8'));
 if(!provenance)throw Error('MISSING_PROVENANCE');
 const root=roots.find(r=>r.rootId===cfg.rootId);if(!root)throw Error('MISSING_ROOT');
 const approval=approvals.records.find(record=>record.configuration.rootId===cfg.rootId);
 if(!approval||JSON.stringify(approval.configuration)!==JSON.stringify(cfg)||sha(root.text)!==approval.sourceTextSha256)throw Error('SOURCE_REVIEW_MISMATCH');
 const rawPath=`private/corpus/voa-course/lesson-${cfg.number}.mp3`,asrPath=`private/corpus/voa-course/lesson-${cfg.number}.transcript.json`;
 const raw=await readFile(rawPath),asrBytes=await readFile(asrPath),asr=JSON.parse(asrBytes);
 if(sha(raw)!==approval.rawAudioSha256||sha(asrBytes)!==approval.asrSha256||sha(raw)!==asr._source.sha256||sha(raw)!==(provenance.audioSha256??provenance.sha256))throw Error('RAW_AUDIO_CHANGED');
 // Normalize typographic apostrophes only; preserve exact words and other punctuation.
 const sourceText=root.text.replace(/^[A-Za-z]+: /gm,'').replace(/’/g,"'");
 const parts=cfg.ids.map(id=>asr.segments.find(s=>s.id===id));
 if(parts.some(s=>!s||s.start<cfg.start||s.end>cfg.end))throw Error('SEGMENT_OUTSIDE_CLIP');
 const selected=parts.map(s=>s.text.trim());
 for(const text of selected)if(!sourceText.includes(text))throw Error(`SOURCE_MISMATCH ${text}`);
 if(sha(selected.join(' '))!==approval.selectedTextSha256)throw Error('SELECTED_TEXT_REVIEW_MISMATCH');
 const path=`/audio/a1-sentences/${cfg.name}.mp3`,stagedPath=`${staging}/${cfg.name}.mp3`;
 await run('ffmpeg',['-v','error','-nostdin','-y','-ss',String(cfg.start),'-i',rawPath,'-t',String(cfg.end-cfg.start),'-vn','-ac','1','-ar','22050','-b:a','64k','-map_metadata','-1',stagedPath]);
 await run('ffmpeg',['-v','error','-xerror','-nostdin','-i',stagedPath,'-f','null','-']);
 const {stdout}=await run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',stagedPath]);
 const duration=Number(JSON.parse(stdout).format.duration);let offset=0;
 const segments=parts.map((s,i)=>{const text=selected[i],start=offset;offset+=text.length+1;return {start,end:start+text.length,text,audioStart:Number((s.start-cfg.start).toFixed(3)),audioEnd:Number((s.end-cfg.start).toFixed(3))};});
 return {rootId:root.rootId,title:root.title,text:selected.join(' '),audio:{src:path,sha256:sha(await readFile(stagedPath)),duration,author:'VOA Learning English',sourceUrl:root.url,license:'VOA Learning English original production (public domain)',synthetic:false},segments,
 review:{...approval.review,preparedAt:new Date().toISOString(),sourceTextSha256:sha(root.text),rawAudioSha256:sha(raw),rawAudioDownloadUrl:provenance.downloadUrl??provenance.audioUrl??provenance.audio,rawAcquiredAt:provenance.acquiredAt,asrSha256:sha(asrBytes),asrModel:asr._source.model,sourceStart:cfg.start,sourceEnd:cfg.end,segmentIds:cfg.ids,permissionUrl:'https://learningenglish.voanews.com/p/6861.html',permissionCheckedAt:approval.review.permissionCheckedAt??'2026-10-03'}};
}));
const failures=results.flatMap((result,index)=>result.status==='rejected'?[new Error(`Lesson ${configurations[index].number}: ${result.reason.message}`,{cause:result.reason})]:[]);
if(failures.length)throw new AggregateError(failures,'Beginner audio batch failed; published manifest unchanged');
const records=results.map(result=>result.value);
await mkdir('public/audio/a1-sentences',{recursive:true});
for(const cfg of configurations)await copyFile(`${staging}/${cfg.name}.mp3`,`public/audio/a1-sentences/${cfg.name}.mp3`);
await mkdir('private/corpus/voa-course/short-sentences',{recursive:true});
await writeFile('private/corpus/voa-course/short-sentences/review.json',JSON.stringify(records,null,2)+'\n');
await writeFile('public/audio/a1-sentences/SENTENCES.json',JSON.stringify(records.map(record=>({rootId:record.rootId,title:record.title,text:record.text,audio:record.audio,segments:record.segments})),null,2)+'\n');
console.log(records.map(r=>({rootId:r.rootId,text:r.text,duration:r.audio.duration,sha256:r.audio.sha256})));
