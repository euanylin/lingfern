import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {expect,it} from 'vitest';
import catalogue from '../content/source-packs.json';
import {corpusAttribution,corpusAttributionPairs} from '../src/core/corpus';
import {corpusOperation,corpusPracticeHistory} from '../src/core/corpusPractice';
import {spokenCorpusLesson,spokenCorpusSchema,type SpokenCorpus} from '../src/core/spokenCorpus';
import {asTestLesson,questions,score} from '../src/shared/content';
import type {Attempt,Session} from '../src/data/db';
const id='0c859fe0f5d6df248c475e869da3838dd70072ca46d9ccd601b5d629556c4b2a';
const segaId='289dac8499604a19adfe98286c9a2b1287027fb69862681c4901ab7f60321fe0';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const banks:SpokenCorpus[]=catalogue.packs.filter(p=>p.skill==='listening').map(p=>{
 const bytes=readFileSync('public'+p.path);expect(sha(bytes)).toBe(p.sha256);
 const files=unzipSync(bytes,{filter:f=>f.name==='spoken.json'}),raw=JSON.parse(new TextDecoder().decode(files['spoken.json']));
 for(const source of raw.records)for(const clip of source.clips)clip.audio.src=clip.audio.src.replace(/^media\//,`/audio/community-${p.sha256}/`);
 return spokenCorpusSchema.parse({...raw,communityPackageId:p.sha256});
});
const selected=(id:string)=>{const b=banks.find(b=>b.records.some(s=>s.clips.some(c=>c.id===id)))!;return {...b,records:b.records.filter(s=>s.clips.some(c=>c.id===id)).map(s=>({...s,clips:s.clips.filter(c=>c.id===id)}))};};
const book=selected(id),sega=selected(segaId),text=book.records[0].clips[0].text;
it('locates the complete named speech and keeps the claim’s subject distinct from its source',()=>{
 for(let seed=0;seed<12;seed++){
  const task=corpusAttribution(text,seed)!;expect(task).toBeTruthy();expect(task.spans).toHaveLength(3);
  expect(task.spans[task.accepted[0]].text).toBe('“It\'s Andy Foger!” said Tom, in a whisper.');
  expect(task.explanation).toContain('said Tom');expect(task.explanation).not.toContain('said Andy');
  for(const span of task.spans)expect(text.slice(span.start,span.end)).toBe(span.text);
  expect(task.spans.filter((_,i)=>!task.accepted.includes(i)).every(s=>!s.text.includes('said'))).toBe(true);
 }
 expect(corpusAttributionPairs(text,0)).toBeUndefined();
});
it('refuses changed/missing/quoted/hypothetical context, repeated claims, speaker substitutions and incomplete utterances',()=>{
 for(const damaged of [text.slice(text.indexOf('“')),text.replace('As he got nearer to the ground','After a dream'),text.replace('the cyclist','another person'),text.replace('said Tom','said Andy'),text.replace('said Tom','thought Tom'),text.replace('“It\'s Andy Foger!”','“Who is Andy Foger?”'),text.replace('” said',' said'),text+' '+text,`Imagine this. ${text}`,`“${text}”`])expect(corpusAttribution(damaged,0)).toBeUndefined();
});
it('generates two distinct supported B1 original works at20s with exact evidence, scoring, teaching and Test equality',()=>{
 for(let seed=0;seed<8;seed++){
  const operation='evidence:Which sentence explicitly attributes a claim to a named source?';
  const lesson=spokenCorpusLesson(book,new Set(),seed,20,'B1',[],'evidence',[],operation,[sega])!;expect(lesson).toBeTruthy();
  expect(new Set(lesson.materials.map(m=>m.rootId))).toEqual(new Set(['gutenberg-book-1282','wikipedia-article-24495502']));
  expect(lesson.teaching!.en).toContain('character making the claim');expect(lesson.workedExample!.en).toContain('Mira makes a claim about Leo');expect(lesson.workedExample!.en).not.toMatch(/Tom|Foger|Accolade/);
  for(const m of lesson.materials){expect(m.audio!.duration).toBeLessThanOrEqual(20);expect(corpusOperation(m.questions[0])).toBe(operation);expect(m.communityPackageId??lesson.communityPackageId).toBe(m.rootId==='gutenberg-book-1282'?book.communityPackageId:sega.communityPackageId);}
  for(const {material,question:q}of questions(lesson)){
   expect(material.blocks[0].text.slice(q.evidence.start,q.evidence.end)).toBeTruthy();expect(q.evidence.audioStart).toBeGreaterThanOrEqual(0);expect(q.evidence.audioEnd).toBeLessThanOrEqual(material.audio!.duration);
   if('kind'in q&&q.kind==='response'){expect(score(q,'Synthetic source-supported explanation.').correct).toBeNull();expect(q.hints![0].en).toContain('before or after');}
   else if('kind'in q&&q.kind==='evidence'){expect(score(q,q.accepted[0]).correct).toBe(true);expect(score(q,q.spans.findIndex((_,i)=>!q.accepted.includes(i))).correct).toBe(false);expect(q.hints).toHaveLength(3);}
   else throw Error('Expected closed attribution and unscored explanation');
  }
  const tested=asTestLesson(lesson),expected=structuredClone(lesson.materials);for(const m of expected)for(const q of m.questions){delete q.hints;if('modelAnswer'in q)delete q.modelAnswer;}
  expect(tested.materials).toEqual(expected);expect(tested.teaching).toBeUndefined();expect(tested.workedExample).toBeUndefined();
  const at='2026-10-13T14:00:00.000Z';const session:Session={id:'postposed-test',profileId:'synthetic-test',lesson,contentHash:'a'.repeat(64),position:4,status:'completed',startedAt:at,assistance:{hintLevel:0},leaseUntil:0};
  const attempts:Attempt[]=questions(lesson).map(({material,question},i)=>({id:'postposed-'+i,profileId:session.profileId,sessionId:session.id,questionId:question.id,rootId:material.rootId,answer:'kind'in question&&question.kind==='response'?'Synthetic explanation':0,correct:'kind'in question&&question.kind==='response'?null:false,rule:'synthetic-test-only',assistance:{hintLevel:0,audioCompleted:true,playbackRequests:1},submittedAt:at}));
  const history=corpusPracticeHistory([session],attempts,session.profileId,'listening','all','B1');expect(history.needsSupport).toBe(true);expect(history.maxSeconds).toBe(20);
  expect(spokenCorpusLesson(book,history.seen,seed,history.maxSeconds,'B1',[],'evidence',[],operation,[sega])).toBeUndefined();
  expect(spokenCorpusLesson(book,new Set(),seed,15,'B1',[],'evidence',[],operation,[sega])).toBeUndefined();
 }
});
