/** Reuse bounded sentence rules; keep new media private and unaccepted. */
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {listeningRuns} from './spoken-listening-clips.mjs';
const root='/content/lingfern-listening-20261009',read=name=>JSON.parse(readFileSync(`${root}/${name}`)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const rows=read('librispeech-candidates-screened.json'),matches=new Map(read('original-text-matches.json').map(row=>[row.id,row])),audits=new Map(read('asr-diagnostics.json').map(row=>[row.id,row]));
const agency=read('agency-prepared-final-reviewed.json'),agencyAudits=new Map(read('agency-asr-diagnostics.json').map(row=>[row.id,row]));
const clips=[],excluded=[];mkdirSync(`${root}/candidate-mp3`,{recursive:true});
const topics=new Map([['2300','science'],['820','technology'],['15263','history'],['19215','history'],['6812','history'],['732','history'],['833','society'],['2529','society'],['1572','society'],['20019','arts'],['11667','education']]);
for(const row of rows){
 const source=matches.get(row.id),audit=audits.get(row.id),reasons=[...row.excludedReasons];
 if(!source||source.matches!==1)reasons.push('missing-unique-original-book-span');
 else if(!source.sentenceBoundaryDiagnostic)reasons.push('original-source-sentence-boundary-pending');
 if(!audit||audit.error||audit.flags?.length||audit.wordErrorRate!==0)reasons.push('non-exact-ASR-or-audit-pending');
 if(reasons.length){excluded.push({id:row.id,family:row.family,bookId:row.bookId,reasons});continue;}
 const path=`candidate-mp3/${row.id}.mp3`;execFileSync('ffmpeg',['-nostdin','-v','error','-i',`${root}/${row.audioPath}`,'-ac','1','-ar','22050','-codec:a','libmp3lame','-b:a','64k',`${root}/${path}`],{stdio:'pipe'});
 clips.push({id:row.id,family:'librispeech',sourceBookOrProgrammeId:`gutenberg-book-${row.bookId}`,topic:topics.get(row.bookId)??'literature',sourceUrl:source.sourceUrl,sourceHash:source.sourceHash,
  originalTextSpan:{start:source.start,end:source.end,offsetUnit:source.offsetUnit},text:source.text,textSha256:source.textSha256,originalAudioSha256:row.audioSha256,audioPath:path,audioSha256:hash(readFileSync(`${root}/${path}`)),
  originalAudioWindow:{start:0,end:row.duration},reviewStatus:'pending',canonicalRootAcceptance:'pending-original-work-mapping',audioAcceptance:'not-auditorily-accepted',rightsAcceptance:'pending-exact-original-work-and-regional-scope',
  boundary:'Whole official utterance only; exact source sentence diagnostic and zero ASR-word disagreement do not constitute auditory, source-rights or teaching approval.'});
}
for(const row of agency){
 const audit=agencyAudits.get(row.id);if(!audit||audit.flags.length){excluded.push({id:row.id,family:row.family,reasons:['automatic-alignment-or-audit-pending']});continue;}
 const windows=listeningRuns(row.text,audit.exactSourceSegments,row.duration);
 for(const [index,window]of windows.entries()){
  const start=Math.max(0,window.segments[0].audioStart-.15),end=Math.min(row.duration,window.segments.at(-1).audioEnd+.2),path=`candidate-mp3/${row.id}-${index}.mp3`;
  execFileSync('ffmpeg',['-nostdin','-v','error','-ss',String(start),'-i',`${root}/${row.audioPath}`,'-t',String(end-start),'-ac','1','-ar','22050','-codec:a','libmp3lame','-b:a','64k',`${root}/${path}`],{stdio:'pipe'});
  clips.push({id:`${row.id}-${index}`,family:row.family,sourceBookOrProgrammeId:row.id==='noaa-hurricane-response'?'noaa-original-hurricane-response':row.id,topic:row.family==='nasa'?'science':row.id==='noaa-monitor-mapping'?'history':row.id==='noaa-navigation-response'?'technology':'nature',
   sourceUrl:row.sourceUrl,sourceHash:row.textSha256,text:window.text,textSha256:hash(window.text),originalTextSpan:{start:window.start,end:window.end,offsetUnit:'utf16-code-units'},
   segments:window.segments,originalAudioSha256:row.audioSha256,originalAudioWindow:{start,end},audioPath:path,audioSha256:hash(readFileSync(`${root}/${path}`)),
   reviewStatus:'pending',canonicalRootAcceptance:'pending-original-work-mapping',audioAcceptance:'not-auditorily-accepted',rightsAcceptance:row.rightsAcceptance,boundary:'Existing bounded complete-sentence rule; full window, edge margins, speaker attribution and music/third-party rights remain unaccepted.'});
 }
 if(!windows.length)excluded.push({id:row.id,family:row.family,reasons:['no-current-bounded-full-sentence-window']});
}
for(const clip of clips){const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',`${root}/${clip.audioPath}`],{encoding:'utf8'}).trim());if(!Number.isFinite(duration)||duration<=0||duration>91)throw Error('CLIP_DURATION');execFileSync('ffmpeg',['-nostdin','-v','error','-xerror','-i',`${root}/${clip.audioPath}`,'-f','null','-'],{stdio:'pipe'});clip.duration=duration;}
const groups={};for(const clip of clips)(groups[`${clip.family}:${clip.topic}`]??=[]).push(clip.id);
writeFileSync(`${root}/prepared-clips.json`,JSON.stringify(clips));writeFileSync(`${root}/candidate-exclusions.json`,JSON.stringify(excluded));writeFileSync(`${root}/candidate-topic-groups.json`,JSON.stringify(groups,null,2));
const report={preparedAt:new Date().toISOString(),clips:clips.length,sourceBookOrProgrammeIds:new Set(clips.map(clip=>clip.sourceBookOrProgrammeId)).size,families:[...new Set(clips.map(clip=>clip.family))],topicGroups:Object.fromEntries(Object.entries(groups).map(([key,ids])=>[key,ids.length])),exclusionRecords:excluded.length,accepted:0,published:false};writeFileSync(`${root}/clip-preparation-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
