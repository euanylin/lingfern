import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloudSegments} from '../scripts/cloud-listening.mjs';

test('cloud alignment preserves original words and rejects missing, changed or invalid timed speech',()=>{
 const text='“We went home!”\r\nThen we slept.';
 const audit={text:'We went home. Then we slept.',segments:[{text:'We went home.',start:.1,end:2},{text:'Then we slept.',start:2.2,end:4}]};
 const segments=cloudSegments(text,audit,4.2);
 assert.equal(segments.map(row=>row.text).join(''),text);
 assert.equal(segments[1].audioStart,2.2);
 for(const mutation of [row=>row.text+=' again',row=>row.segments.pop(),row=>row.segments[1].start=1,row=>row.segments[1].end=5,row=>row.segments[1].text='Then we woke.']){
  const changed=structuredClone(audit);mutation(changed);assert.throws(()=>cloudSegments(text,changed,4.2));
 }
});
