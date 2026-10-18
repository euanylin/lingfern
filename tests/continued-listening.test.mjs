import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyContinuedListening} from '../scripts/continued-listening.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(select=w=>w.id.startsWith('fleurs-')&&!w.raw){const actual=JSON.parse(readFileSync('content/corpus/continued-listening-sources.json')),scope={...actual,evidence:[],windows:[actual.windows.find(select)]},files=new Map();const read=p=>{if(!files.has(p))files.set(p,readFileSync(p));return files.get(p);},change=(ref,fn)=>{const v=JSON.parse(read(ref.path));fn(v);const b=Buffer.from(JSON.stringify(v));files.set(ref.path,b);ref.sha256=sha(b);};return {scope,read,change,files};}
test('continued FLEURS preserves one complete source sentence and its original speaker recording',()=>{const f=fixture(),r=verifyContinuedListening(f.scope,f.read);assert.equal(r.report.applied,1);const c=r.entries[0].record.clips[0];assert.equal(c.segments.map(s=>s.text).join(''),c.text);assert.equal(sha(r.entries[0].media[c.audio.src]),f.scope.windows[0].audio.sha256);assert.equal(r.report.physicalDeviceChecked,false);assert.equal(r.report.published,false);});
test('changed source, stale recording evidence, review holds and invented boundary pass cannot qualify',()=>{for(const mutation of [f=>f.scope.windows[0].sourceSpan.start++,f=>f.scope.windows[0].audio.sha256='0'.repeat(64),f=>f.scope.windows.push(structuredClone(f.scope.windows[0])),f=>f.change(f.scope.windows[0].previousASR,r=>r.text='wrong recording'),f=>f.change(f.scope.rights,r=>{const x=r.rows.find(r=>r.id===f.scope.windows[0].sourceId);x.decision='hold';}),f=>f.change(f.scope.windows[0].diagnostic,d=>d.voiceBoundary.frameRMS.fill(.1)),f=>f.change(f.scope.windows[0].diagnostic,d=>d.originalDecode.samples++),f=>f.change(f.scope.windows[0].diagnostic,d=>d.input.raw.segments[0].words.pop())]){const f=fixture();mutation(f);assert.throws(()=>verifyContinuedListening(f.scope,f.read));}});

test('new cloud ASR remains bound to its model job, raw timing and original LibriSpeech export',()=>{
 const select=w=>!w.id.startsWith('fleurs-')&&w.raw;
 const positive=fixture(select);assert.equal(verifyContinuedListening(positive.scope,positive.read).report.applied,1);
 for(const mutate of [f=>f.change(f.scope.windows[0].job,j=>j.noTranscriptPrompt=false),f=>f.change(f.scope.windows[0].raw,r=>r.segments[0].words.pop()),f=>f.change(f.scope.windows[0].context,c=>c.existingReligiousRuleReasons.push('held')),f=>f.change(f.scope.originalExport,e=>{const k=Object.keys(e.files).find(k=>k.endsWith(f.scope.windows[0].id+'.flac'));e.files[k].sha256='0'.repeat(64);})]){const f=fixture(select);mutate(f);assert.throws(()=>verifyContinuedListening(f.scope,f.read));}
});

test('Wikipedia continuation retains exact native revision, separate recording rights and original holds',()=>{
 const select=w=>w.id.startsWith('wiki-');const f=fixture(select),result=verifyContinuedListening(f.scope,f.read);assert.equal(result.report.applied,1);assert(result.entries[0].record.originalText);assert.match(result.entries[0].record.clips[0].audio.license,/^CC BY-SA [234]\.0$/);
 for(const mutate of [f=>f.scope.windows[0].sourceSpan.end--,f=>f.change(f.scope.sources,r=>{r.sources.find(s=>s.id===f.scope.windows[0].sourceId).audioLicence='CC BY 4.0';}),f=>f.change(f.scope.windows[0].raw,r=>r.segments[0].words.pop()),f=>f.change(f.scope.windows[0].diagnostic,d=>d.voiceBoundary.frameRMS.fill(.1))]){const f=fixture(select);mutate(f);assert.throws(()=>verifyContinuedListening(f.scope,f.read));}
});
