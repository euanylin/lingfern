import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {appendShortListening} from '../scripts/short-listening.mjs';
const directory='private/corpus/short-listening-original-packs-20261013';
const roots=new Set(['wikipedia-article-1620586','wikipedia-article-14018','wikipedia-article-24495502','wikipedia-article-9228','wikipedia-article-18855029','wikipedia-article-5042951','wikipedia-article-244511']);
function originals(){const entries=[];for(const pack of JSON.parse(readFileSync(directory+'/catalogue.json')).packs.filter(p=>p.skill==='listening')){const files=unzipSync(readFileSync(directory+'/'+pack.path.split('/').at(-1)));const bank=JSON.parse(new TextDecoder().decode(files['spoken.json']));for(const record of bank.records.filter(r=>roots.has(r.rootId)))entries.push({skill:'listening',topic:pack.topic,record,sources:JSON.parse(new TextDecoder().decode(files['sources.json'])),media:Object.fromEntries(Object.entries(files).filter(([n])=>n.startsWith('media/')))});}return entries;}
test('nine reviewed windows extend original works, retain old clip/media/credits, exclude holds and replay idempotently',()=>{
 const entries=originals(),before=structuredClone(entries);assert.equal(entries.length,7);const report=appendShortListening(entries);assert.equal(report.accepted.length,9);assert.equal(report.withheld.length,4);assert.equal(report.heldEncodings.length,1);
 for(const old of before){const entry=entries.find(e=>e.record.rootId===old.record.rootId);for(const clip of old.record.clips)assert.deepEqual(entry.record.clips.find(c=>c.id===clip.id),clip);for(const[n,b]of Object.entries(old.media))assert.deepEqual(entry.media[n],b);assert.deepEqual(entry.sources,old.sources);assert.equal(entry.record.clips.length,old.record.clips.length+report.accepted.filter(r=>r.rootId===old.record.rootId).length);}
 const once=structuredClone(entries);assert.deepEqual(appendShortListening(entries),report);assert.deepEqual(entries,once);
});
test('missing originals, changed source/context and mismatched credits fail instead of admitting a new root',()=>{
 assert.throws(()=>appendShortListening([]),/ORIGINAL_REQUIRED/);
 for(const field of ['sourceHash','originalText']){const entries=originals();entries[0].record[field]='changed';assert.throws(()=>appendShortListening(entries));}
 const entries=originals();entries[0].sources=entries[0].sources.map(s=>({...s,author:'Changed attribution'}));assert.throws(()=>appendShortListening(entries));
});

test('overlap scopes are exact UTF16 original-source spans and preserve the published predecessor',()=>{
 const scopes=JSON.parse(readFileSync('content/corpus/short-listening-overlaps.json')).records;
 const entries=originals();appendShortListening(entries);
 for(const scope of scopes){const source=entries.find(e=>e.record.rootId===scope.rootId).record;assert.equal(source.sourceHash,scope.sourceHash);const clip=source.clips.find(c=>c.id===scope.id);assert.equal(source.originalText.slice(scope.sourceSpan.start,scope.sourceSpan.end),clip.text);
 const overlaps=source.clips.filter(c=>c.id!==clip.id).filter(c=>{const start=source.originalText.indexOf(c.text);assert(start>=0);assert.equal(source.originalText.indexOf(c.text,start+1),-1);return start<scope.sourceSpan.end&&start+c.text.length>scope.sourceSpan.start;}).map(c=>c.id);
 for(const id of overlaps)assert(scope.overlappingIds.includes(id));
 for(const id of scope.overlappingIds)assert(source.clips.some(c=>c.id===id)||id==='ab135bb41ed7c29e558a3da027df74053ccf0e0833f33bc9b68315c39f959340');
 }
});
