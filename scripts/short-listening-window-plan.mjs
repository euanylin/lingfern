import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {unzipSync} from 'fflate';
import {listeningRuns,shortWindowBounds} from './spoken-listening-clips.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const matrixPath='private/corpus/teaching-coverage-batch-admitted-2026-10-13.json';
const matrix=JSON.parse(fs.readFileSync(matrixPath));
const targets=matrix.rows.filter(r=>r.skill==='listening'&&!['A1','A2'].includes(r.level)).flatMap(r=>r.operations.filter(o=>['attribution','spokenMatching','outcome'].includes(o.name)&&o.roots.length<4).map(o=>({level:r.level,condition:r.condition,maxSeconds:r.maxSeconds,operation:o.name,currentRoots:o.roots,targetRoots:4})));
const sources=JSON.parse(fs.readFileSync('private/corpus/spoken/processed.json')).records;
const alignments=JSON.parse(fs.readFileSync('private/corpus/spoken/alignment-candidates.json')).records;
const reviews=JSON.parse(fs.readFileSync('content/corpus/text-review-rules.json')).records;
const catalogue=JSON.parse(fs.readFileSync('content/source-packs.json'));
const publicSources=new Map();
for(const entry of catalogue.packs.filter(p=>p.skill==='listening')){const bytes=fs.readFileSync('public'+entry.path);assert.equal(sha(bytes),entry.sha256);const files=unzipSync(bytes,{filter:f=>f.name==='spoken.json'});for(const record of JSON.parse(new TextDecoder().decode(files['spoken.json'])).records)if(record.rootId.startsWith('wikipedia-')){if(!publicSources.has(record.rootId))publicSources.set(record.rootId,{...record,clips:[]});publicSources.get(record.rootId).clips.push(...record.clips);}}
const report={scope:'One complete current aligned public-Wikipedia pool batch screen for all missing second/fourth-root attribution/matching/outcome conditions. Proposals only, not audio/source acceptance or preauthored curriculum. No new preparation/ASR/collection or hold reversal.',matrixSha256:sha(fs.readFileSync(matrixPath)),targets,inspectedRoots:0,uniqueSpans:0,rejected:{existing:0,excluded:0,noGap:0,transcript:0},records:[],accepted:0,published:false};
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {corpusAttribution,corpusOutcome}=await server.ssrLoadModule('/src/core/corpus.ts');const {spokenAttributionPairs}=await server.ssrLoadModule('/src/core/spokenAttribution.ts');const detectors={attribution:corpusAttribution,spokenMatching:spokenAttributionPairs,outcome:corpusOutcome};
 for(const aligned of alignments){const source=sources.find(s=>s.rootId===aligned.rootId),publicSource=publicSources.get(aligned.rootId),review=reviews.find(r=>r.rootId===aligned.rootId);if(!source||!publicSource||!review||review.decision!=='accepted-text')continue;
  assert.equal(sha(source.text),aligned.textSha256);assert.equal(source.audioSha256,aligned.audioSha256);assert.equal(publicSource.sourceHash,review.articleSha256);assert.equal(source.text,publicSource.originalText);
  const needed=targets.filter(t=>!t.currentRoots.includes(source.rootId));if(!needed.length)continue;const relevant=new Set(needed.map(t=>t.operation));report.inspectedRoots++;
  const native=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(source.text)].filter(s=>/[.!?]["'’”)\]]*\s*$/.test(s.segment));const seen=new Set();let transcript;
  for(let i=0;i<native.length;i++)for(let end=i;end<Math.min(native.length,i+8);end++){
   const start=native[i].index+(native[i].segment.match(/^[^\p{L}\p{N}]*/u)?.[0].length??0),finish=native[end].index+native[end].segment.trimEnd().length,text=source.text.slice(start,finish);if(text.length>12000||text.trim().split(/\s+/).length>180)break;if(text.trim().split(/\s+/).length<30)continue;
   const operations=[...relevant].filter(name=>detectors[name](text,0));if(!operations.length)continue;
   const segments=aligned.segments.filter(s=>s.start>=start&&s.end<=finish);if(!segments.length||segments.at(-1).audioEnd-segments[0].audioStart>90)continue;const excerpt=listeningRuns(source.text,segments,source.decodedDuration,{minSeconds:8,maxSeconds:90,maxWords:180,maxCharacters:12000}).find(s=>s.start===start&&s.end===finish);if(!excerpt)continue;
   const key=start+':'+finish;if(seen.has(key))continue;seen.add(key);report.uniqueSpans++;
   if(publicSource.clips.some(c=>c.text===text)){report.rejected.existing++;continue;}if(review.excludedSpans.some(s=>start<s.end&&finish>s.start)){report.rejected.excluded++;continue;}
   if(!transcript){const bytes=fs.readFileSync(`private/corpus/spoken/audio/${source.fileId}.transcript.json`);transcript=JSON.parse(bytes);assert.equal(transcript._source.sha256,source.audioSha256);}
   let bounds;try{bounds=shortWindowBounds(excerpt,transcript.segments.map(s=>({audioStart:s.start,audioEnd:s.end})),source.decodedDuration);}catch(e){if(e.message!=='SHORT_BOUNDARY_NO_GAP')throw e;report.rejected.noGap++;continue;}
   const spoken=transcript.segments.filter(s=>s.start>=segments[0].audioStart&&s.end<=segments.at(-1).audioEnd).map(s=>s.text).join(' ');const normalize=t=>t.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(normalize(spoken)!==normalize(text)){report.rejected.transcript++;continue;}
   const fits=needed.filter(t=>operations.includes(t.operation)&&bounds.end-bounds.start<=t.maxSeconds);if(!fits.length)continue;
   report.records.push({rootId:source.rootId,title:source.title,fileId:source.fileId,sourceHash:publicSource.sourceHash,sourceTextSha256:source.textSha256,originalAudioSha256:source.audioSha256,sourceSpan:{start,end:finish},originalAudioStart:bounds.start,originalAudioEnd:bounds.end,text,operations,targets:fits.map(t=>({level:t.level,condition:t.condition,operation:t.operation,maxSeconds:t.maxSeconds})),holdStatus:'Unaccepted candidate; existing precise text/audio holds must be checked before cloud allowlisting and admission.'});
  }
 }
 report.completedAt=new Date().toISOString();
}finally{await server.close();fs.writeFileSync('private/verification/short-listening-batch-plan-20261013.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({inspectedRoots:report.inspectedRoots,uniqueSpans:report.uniqueSpans,candidates:report.records.length,roots:new Set(report.records.map(r=>r.rootId)).size,rejected:report.rejected}));
