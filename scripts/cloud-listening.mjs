import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const tokens=text=>[...text.matchAll(/[a-z]+(?:['’][a-z]+)?|\d+/gi)];
const normalized=text=>tokens(text).map(match=>match[0].toLowerCase().replaceAll('’',"'"));

/** Preserve source typography and cloud timestamps without inventing words or times. */
export function cloudSegments(text,audit,duration) {
 assert.deepEqual(normalized(text),normalized(audit.text),'CLOUD_TRANSCRIPT_CHANGED');
 const source=tokens(text),result=[];let cursor=0,previous=0;
 for(const segment of audit.segments) {
  const words=normalized(segment.text);if(!words.length)continue;
  assert.deepEqual(source.slice(cursor,cursor+words.length).map(match=>match[0].toLowerCase().replaceAll('’',"'")),words,'CLOUD_SEGMENT_CHANGED');
  assert(Number.isFinite(segment.start)&&Number.isFinite(segment.end)&&segment.start>=previous&&segment.end>segment.start&&segment.end<=duration,'CLOUD_TIMING');
  const start=cursor===0?0:source[cursor].index,end=cursor+words.length===source.length?text.length:source[cursor+words.length].index;
  result.push({start,end,text:text.slice(start,end),audioStart:segment.start,audioEnd:segment.end});
  cursor+=words.length;previous=segment.end;
 }
 assert.equal(cursor,source.length,'CLOUD_MISSING_WORDS');assert(result.length>0&&result.length<=100,'CLOUD_SEGMENT_LIMIT');
 return result;
}

/** Adapt frozen candidates only; ignore uncertain rereview outputs. */
export function cloudListeningInputs() {
 const scopeBytes=readFileSync('content/corpus/cloud-listening-sources.json');
 assert.equal(sha(scopeBytes),'89a7202536e1f9e2df662430b8305ac1f9199e297b031e9aceab7630abf9e31c','CLOUD_RIGHTS_SCOPE_CHANGED');
 const scope=JSON.parse(scopeBytes);
 const admitted=new Map(scope.sources.map(row=>[row.bookId,row])),entries=new Map(),exclusions=[],retained=[],inputHashes=[];
 const batches=['private/corpus/listening-scale-20261009/cloud-results-final','private/corpus/listening-expansion-20261009/recovery-a100/cloud-results'];
 let total=0;
 for(const directory of batches) {
  const read=name=>{const bytes=readFileSync(directory+'/'+name);inputHashes.push({path:directory+'/'+name,sha256:sha(bytes)});return JSON.parse(bytes);};
  const clips=read('prepared-clips.json'),audits=new Map(read('asr-diagnostics.json').map(row=>[row.id,row]));total+=clips.length;
  assert.equal(sha(readFileSync(directory+'/prepared-clips.json')),directory===batches[0]?'52b027f9ab36e83a95004d11ed20c83ff28799b01a94a049fbb16a207a1075d6':'a7c7f538cae8bca8d197bdda0f915a54db03ebe687fbf69e628f9bf1e91926c2','CLOUD_FROZEN_POOL_CHANGED');
  const speakers=new Map(readFileSync(directory+'/decoded-input/LibriSpeech/SPEAKERS.TXT','utf8').split(/\r?\n/).filter(line=>!line.startsWith(';')&&line.includes('|')).map(line=>{const fields=line.split('|').map(x=>x.trim());return[fields[0],fields[4]];}));
  for(const clip of clips) {
   const bookId=clip.sourceBookOrProgrammeId.replace('gutenberg-book-',''),source=admitted.get(bookId),words=clip.text.trim().split(/\s+/).length;
   const reasons=clip.family!=='librispeech'?['specific-voices-music-and-third-party-rights-unaccepted']:!source?['original-work-rights-or-canonical-root-unresolved']:words<30||words>180?['outside-existing-listening-word-bound']:[];
   if(reasons.length){exclusions.push({id:clip.id,family:clip.family,reasons});continue;}
   assert.equal(clip.sourceHash,source.sourceHash,'CLOUD_SOURCE_CHANGED');assert.equal(sha(clip.text),clip.textSha256,'CLOUD_TEXT_CHANGED');
   const original=readFileSync(directory+'/original-books/'+bookId+'.txt');assert.equal(sha(original),source.sourceHash,'CLOUD_ORIGINAL_CHANGED');
   assert.equal(original.toString('utf8').slice(clip.originalTextSpan.start,clip.originalTextSpan.end),clip.text,'CLOUD_SOURCE_SPAN');
   const bytes=readFileSync(directory+'/'+clip.audioPath);assert.equal(sha(bytes),clip.audioSha256,'CLOUD_AUDIO_CHANGED');
   const audit=audits.get(clip.id);assert(audit&&!audit.error&&audit.flags.length===0&&audit.wordErrorRate===0,'CLOUD_AUDIT');assert.equal(audit._source.sha256,clip.originalAudioSha256,'CLOUD_AUDIT_SOURCE');
   let segments;try{segments=cloudSegments(clip.text,audit,clip.duration);}catch(error){exclusions.push({id:clip.id,family:clip.family,reasons:[error.message]});continue;}
   const author=speakers.get(clip.id.split('-')[0]);assert(author,'CLOUD_READER_CREDIT');
   const id=sha('librispeech\0'+clip.id+'\0'+clip.audioSha256),audioSourceId='librispeech-'+clip.id,filename='media/librispeech-'+clip.id+'.mp3';
   let entry=entries.get(bookId);
   if(!entry){
    const record={id:'gutenberg-'+bookId,rootId:source.rootId,title:source.title,authors:source.authors,originalUrl:'https://www.gutenberg.org/ebooks/'+bookId,downloadUrl:source.sourceUrl,acquiredAt:'2026-10-09T00:00:00.000Z',language:'en',licence:source.licence,licenceUrl:'https://www.gutenberg.org/policy/license.html',attribution:source.attribution,sourceHash:source.sourceHash,reviewStatus:'draft',permissionReview:source.permissionReview,editorialReview:'pending',processing:'Cloud-prepared exact original-source LibriSpeech recordings. Automatic diagnostics; no full auditory or calibrated-level claim.',clips:[]};
    entry={skill:'listening',topic:source.topic,record,sources:[{id:record.id,title:record.title,author:record.authors.join('; '),license:record.licence,attribution:record.attribution,sourceUrl:record.originalUrl}],media:{}};entries.set(bookId,entry);
   }
   assert.equal(entry.record.sourceHash,clip.sourceHash,'CLOUD_ROOT_EDITION_CONFLICT');
   const audioCredit={id:audioSourceId,title:source.title+' — LibriSpeech recording',author,license:'CC BY 4.0',attribution:author+'; LibriSpeech, Vassil Panayotov and Daniel Povey. FLAC converted to MP3.',sourceUrl:'https://www.openslr.org/12/'};
   entry.sources.push(audioCredit);entry.media[filename]=bytes;
   entry.record.clips.push({id,text:clip.text,wordCount:words,segments,reviewStatus:'pending',qualityFlags:[],processing:'Cloud full decode; unique exact source span; zero ASR word disagreement. '+audit._source.model+'@'+audit.modelRevision+'. Automatic segment alignment; full auditory review unperformed.',audioSourceId,audio:{src:filename,sha256:clip.audioSha256,duration:clip.duration,author,sourceUrl:audioCredit.sourceUrl,license:audioCredit.license,synthetic:false},credit:{attribution:source.attribution+' Recording: '+audioCredit.attribution,license:source.licence+'; recording: CC BY 4.0',sourceUrl:entry.record.originalUrl}});
   retained.push({candidateId:clip.id,id,rootId:source.rootId,audioSha256:clip.audioSha256,sourceHash:clip.sourceHash,textSha256:clip.textSha256});
  }
 }
 assert.equal(total,1414,'CLOUD_FROZEN_POOL');assert.equal(retained.length+exclusions.length,total,'CLOUD_CONSERVATION');assert.equal(new Set(retained.map(row=>row.id)).size,retained.length,'CLOUD_DUPLICATE');
 return {entries:[...entries.values()],report:{candidates:total,applied:retained.length,held:exclusions.length,retained,exclusions,inputHashes,rereviewUsed:false,auditoryAcceptance:false}};
}
