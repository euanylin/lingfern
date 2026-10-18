import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { createTopicPacks, coverageKeys, excludeHeldAudio, excludeUnavailableAudio, inferSourceTopic, sha } from '../scripts/topic-packs.mjs';

test('unusable public recordings are excluded without changing retained data or raw inputs',()=>{
 const clip=(id,qualityFlags=[])=>({id,qualityFlags,audio:{sha256:sha(id)}});
 const records=[{rootId:'gutenberg-book-1',sourceHash:sha('source'),clips:[clip('valid'),clip('flagged',['word disagreement']),clip('unsupported')]},{rootId:'gutenberg-book-2',sourceHash:sha('other'),clips:[clip('all-flagged',['boundary'])]}];
 const original=structuredClone(records),result=excludeUnavailableAudio(records,c=>c.id==='valid');
 assert.deepEqual(records,original);assert.equal(result.records.length,1);assert.deepEqual(result.records[0].clips,[records[0].clips[0]]);
 assert.deepEqual(result.excluded.map(x=>x.id),['flagged','unsupported','all-flagged']);assert(result.excluded.every(x=>x.audioSha256&&x.excerptSha256));
});
const titles = { science: { 'zh-Hans': '科学', 'zh-Hant': '科學', en: 'Science' } };
const make = (skill, rootId, values) => ({ skill, topic: 'science', record: { id: 'nasa-'+rootId, rootId:'nasa-article-'+rootId, sourceHash:sha(rootId), originalUrl:'https://www.nasa.gov/example/', ...(skill==='reading'?{passages:values}:{clips:values}) }, sources:[{id:'nasa-'+rootId,title:'Science',author:'NASA',license:'Public domain',attribution:'NASA',sourceUrl:'https://www.nasa.gov/example/'}],media:{} });
test('retains exact companion notices and rejects conflicting, oversized or unsafe notice members', () => {
 const a=make('reading','1',[{id:sha('one'),text:'First source.'}]),b=make('reading','2',[{id:sha('two'),text:'Second source.'}]);
 const notice=Buffer.from('Recording credit, unchanged licence and precise holds.\n');
 a.notices={'scoped-NOTICE.md':notice};b.notices={'scoped-NOTICE.md':Buffer.from(notice)};
 const packed=createTopicPacks([a,b],titles)[0],files=unzipSync(packed.bytes);
 assert.deepEqual(Buffer.from(files['scoped-NOTICE.md']),notice);
 assert.deepEqual(coverageKeys(packed.inputs),coverageKeys([a,b]));
 b.notices={'scoped-NOTICE.md':Buffer.from('Different source terms')};assert.throws(()=>createTopicPacks([a,b],titles),/TOPIC_NOTICE_CONFLICT/);
 for(const notices of [{'../escape.txt':notice},{'sources.json':notice},{'large.txt':Buffer.alloc(64*1024+1)}]){
  a.notices=notices;assert.throws(()=>createTopicPacks([a],titles),/TOPIC_NOTICE/);
 }
});
test('keeps immutable quotation package notices independent of daily display documentation', () => {
 const notice=readFileSync('content/corpus/wikiquote-source-NOTICE.md');
 assert.equal(sha(notice),'efcc339291c6d2f0e9e486a0d94a467ace2a7ecac62ef7e1e19f16d69569ef78');
 assert.notEqual(sha(notice),sha(readFileSync('public/daily-quotes/README.md')));
 const entry=make('reading','1',[{id:sha('notice-only-fixture'),text:'Source notice packaging fixture.'}]);
 entry.record.id='wikiquote-1';entry.sources[0].id='wikiquote-1';
 const files=unzipSync(createTopicPacks([entry],titles)[0].bytes);
 assert.deepEqual(Buffer.from(files['wikiquote-README.md']),notice);
});
test('catalogue size and duration statistics equal complete ZIP members without changing their bytes', () => {
 const media=Buffer.from([0x49,0x44,0x33,1,2,3]),path='media/recorded.mp3';
 const clip={id:sha('duration'),text:'Recorded source',audioSourceId:'nasa-1',audio:{src:path,sha256:sha(media),duration:12.75}};
 const entry=make('listening','1',[clip]);entry.media[path]=media;
 const pack=createTopicPacks([entry],titles)[0],files=unzipSync(pack.bytes);
 assert.equal(pack.entry.expandedBytes,Object.values(files).reduce((total,data)=>total+data.length,0));
 assert.equal(pack.entry.mediaBytes,media.length);
 assert.equal(pack.entry.metadataBytes,pack.entry.expandedBytes-media.length);
 assert.equal(pack.entry.audioSeconds,12.75);assert.equal(pack.entry.bytes,pack.bytes.length);
 assert.equal(pack.entry.sha256,sha(pack.bytes));assert.deepEqual(Buffer.from(files[path]),media);
 const reading=createTopicPacks([make('reading','2',[{id:sha('text'),text:'Complete prose'}])],titles)[0];
 assert.equal(reading.entry.audioSeconds,0);assert.equal(reading.entry.mediaBytes,0);
});
test('topic repacking preserves every excerpt byte and deterministically splits one root at the 5MiB metadata boundary', () => {
 const values=Array.from({length:600},(_,index)=>({id:sha('passage-'+index),text:'Scientific report '+index+' '+ 'science '.repeat(1497),wordCount:1500}));
 const entries=[make('reading','1',values),make('reading','2',[values[0]])];
 const packs=createTopicPacks(entries,titles);
 assert(packs.length>1);
 assert.deepEqual(coverageKeys(entries),coverageKeys(packs.flatMap(pack=>pack.inputs)));
 assert.equal(new Set(packs.flatMap(pack=>pack.inputs).map(entry=>entry.record.rootId)).size,2);
 for(const pack of packs) {
  const files=unzipSync(pack.bytes),manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));
  assert(files['corpus.json'].length<=5*1024*1024);assert(pack.bytes.length<=25*1024*1024);
  assert.equal(pack.entry.topic,'science');assert(pack.entry.title.en.startsWith('Reading · Science · nasa-article-'));
  assert(!pack.entry.id.match(/-00\d$/));assert.deepEqual(pack.entry.sourceFamilies,['nasa']);
  for(const [name,info]of Object.entries(manifest.files)){assert.equal(info.bytes,files[name].length);assert.equal(info.sha256,sha(files[name]));}
 }
 assert.equal(new Set(packs.map(pack=>pack.entry.title.en)).size,packs.length);
 assert.deepEqual(createTopicPacks(entries,titles).map(pack=>pack.entry.sha256),packs.map(pack=>pack.entry.sha256));
});
test('keeps held audio flags and exact media hashes; rejects a changed recording', () => {
 const bytes=Buffer.from([0x49,0x44,0x33,1,2,3]),id=sha('clip');
 const clip={id,text:'recorded words',qualityFlags:['Codex/AI clip review hold'],audioSourceId:'recording-1',audio:{src:'media/'+id+'.mp3',sha256:sha(bytes)}};
 const entry=make('listening','1',[clip]);entry.sources.push({id:'recording-1',title:'Recording',author:'Author',license:'CC BY-SA 4.0',attribution:'Author'});entry.media[clip.audio.src]=bytes;
 const packs=createTopicPacks([entry],titles);assert.deepEqual(coverageKeys(packs[0].inputs),coverageKeys([entry]));
 const stored=JSON.parse(new TextDecoder().decode(unzipSync(packs[0].bytes)['spoken.json']));assert.deepEqual(stored.records[0].clips[0],clip);
 entry.media[clip.audio.src]=Buffer.from('changed');assert.throws(()=>createTopicPacks([entry],titles),/TOPIC_AUDIO_CHANGED/);
});
test('retains full companion terms for Gutenberg copies without rewriting source licences', () => {
 const entry=make('reading','1',[{id:sha('p'),text:'exact source'}]);entry.record.originalUrl='https://www.gutenberg.org/ebooks/1';entry.record.licence='Public domain in the USA; regional review pending';
 assert.throws(()=>createTopicPacks([entry],titles),/TOPIC_GUTENBERG_TERMS/);
 const terms='Retained complete licence fixture',pack=createTopicPacks([entry],titles,terms)[0],files=unzipSync(pack.bytes);
 assert.equal(new TextDecoder().decode(files['gutenberg-license.txt']),terms);assert.equal(pack.inputs[0].record.licence,entry.record.licence);
 entry.notices={'gutenberg-license.txt':Buffer.from('Exact collected edition companion terms')};
 const withCompanion=unzipSync(createTopicPacks([entry],titles,terms)[0].bytes);
 assert.equal(new TextDecoder().decode(withCompanion['gutenberg-license.txt']),'Exact collected edition companion terms');
 assert.equal(new TextDecoder().decode(withCompanion['gutenberg-terms.txt']),terms);
 assert.throws(()=>createTopicPacks([entry],titles,'x'.repeat(64*1024+1)),/TOPIC_GUTENBERG_TERMS/);
});

test('explicit held hashes and Codex holds are excluded individually while ordinary pending quality flags remain intact', () => {
 const keep={id:sha('keep'),text:'pending source',audio:{sha256:sha('allowed')},qualityFlags:['Automatic transcript pending']};
 const held={id:sha('held'),text:'held source',audio:{sha256:sha('held')},qualityFlags:[]};
 const noted={id:sha('noted'),text:'noted source',audio:{sha256:sha('noted')},qualityFlags:['Codex/AI clip review hold: exact mismatch']};
 const record={rootId:'root',sourceHash:sha('original'),clips:[keep,held,noted]};
 const result=excludeHeldAudio([record],new Set([held.audio.sha256]));
 assert.deepEqual(result.records[0].clips,[keep]);assert.deepEqual(result.excluded.map(clip=>clip.id),[held.id,noted.id]);
 assert.equal(record.clips.length,3);assert.equal(excludeHeldAudio([{...record,clips:[held]}],new Set([held.audio.sha256])).records.length,0);
});

test('subject labels follow the actual title and introduction rather than incidental full-article interests', () => {
  assert.equal(inferSourceTopic({id:'wikipedia-6',title:'I-35W Mississippi River bridge',originalText:'A steel truss bridge crossed the Mississippi River in Minneapolis.'}).topic,'technology');
  assert.equal(inferSourceTopic({id:'wikipedia-1',title:'Iapetus (moon)',originalText:'Iapetus is a natural satellite.\n\nIts orbit is unusual.\n\nHistory: a university later studied it.'}).topic,'science');
  assert.equal(inferSourceTopic({id:'wikipedia-2',title:'Storm Chasers (TV series)',originalText:'An American documentary television series follows weather researchers.'}).topic,'film');
  assert.equal(inferSourceTopic({id:'wikipedia-3',title:'Ayn Rand',originalText:'Ayn Rand was a Russian-American novelist and philosopher.\n\nShe is known for her fiction.\n\nHer university education appears in later sections.'}).topic,'literature');
  assert.equal(inferSourceTopic({id:'wikipedia-4',title:'Stretford',originalText:'Stretford is a town in England.\n\nIt is part of a metropolitan borough.\n\nSchools include a local grammar school.'}).topic,'society');
  assert.equal(inferSourceTopic({id:'wikipedia-5',title:'An untitled device',originalText:'A general device.'},'Spoken Wikipedia articles about technology|Audio versions from 2012').topic,'technology');
});
