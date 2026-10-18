import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {sha} from './topic-packs.mjs';
export const shortListeningReviewSha256='416518ebbf934d49283e47be3e8074e555b4956588da5ed5016efbcf285c9ed1';
export const shortListeningPackSha256='3d085117223e3d6032ba013b79f0e81b97cb5e66e7b76800f32b7988f2c21e65';

/** Merge pinned reviewed native windows; retain every original clip and media byte. */
export function appendShortListening(entries) {
 const previous=appendReviewedWindows(entries,'private/verification/short-listening-window-review-20261013.json',shortListeningReviewSha256,'private/corpus/spoken/short-teaching-packs-headroom-v4/wikipedia-listening-001.zip',shortListeningPackSha256,3);
 const outcome=appendReviewedWindows(entries,'private/verification/short-outcome-review-20261013.json','f50f89fccfacbb73881a1e706d084a4698f58d091ec963a03e24ec4e39ff0161','private/corpus/spoken/short-outcome-packs-20261013/wikipedia-listening-001.zip','dce411c45b34385edd4ca4901d739d5b82089a1c67a4c094ff87d8cd43e21ea2',1);
 const batch=appendReviewedWindows(entries,'private/verification/coverage-batch-source-review-20261013.json','3f0ed8580a0e7a6759bc47b715c9342823eb894fd0ee8555b778fa9c6577d0f4','private/corpus/spoken/coverage-batch-packs-20261013/wikipedia-listening-001.zip','b8d4ad987089cecec7a4468fb2c08acf43c04b8bbad8d3217b973b10199848cb',3,75);
 const supported=appendReviewedWindows(entries,'private/verification/supported-listening-review-20261013.json','fe8bf558f2e51ea63019e85b9791dc401afb78063b3334db696e5b205d52b4cb','private/corpus/supported-listening-20261013/windows.zip','14d7ca139be5b3f3bd398c4e09c2f914f2063ac88236596a3dd74f6809c42a2b',2,20);
 return {accepted:[...previous.accepted,...outcome.accepted,...batch.accepted,...supported.accepted],withheld:[...previous.withheld,...outcome.withheld,...batch.withheld,...supported.withheld],heldEncodings:[...previous.heldEncodings,...outcome.heldEncodings,...batch.heldEncodings,...supported.heldEncodings]};
}
function appendReviewedWindows(entries,reviewPath,reviewHash,packPath,packHash,count,maxSeconds=35) {
 const reviewBytes=readFileSync(reviewPath);assert.equal(sha(reviewBytes),reviewHash);
 const review=JSON.parse(reviewBytes),accepted=review.records.filter(r=>r.decision==='accepted-targeted-window-local');assert.equal(accepted.length,count);
 const bytes=readFileSync(packPath);assert.equal(sha(bytes),packHash);
 const files=unzipSync(bytes),bank=JSON.parse(new TextDecoder().decode(files['spoken.json'])),sources=JSON.parse(new TextDecoder().decode(files['sources.json']));assert.equal(bank.records.reduce((n,r)=>n+r.clips.length,0),count);
 for(const source of bank.records){
  const target=entries.find(e=>e.skill==='listening'&&e.record.rootId===source.rootId);assert(target,'SHORT_LISTENING_ORIGINAL_REQUIRED');assert.equal(target.record.sourceHash,source.sourceHash);assert.equal(target.record.originalText,source.originalText);
  for(const credit of sources.filter(s=>s.id===source.id||source.clips.some(c=>c.audioSourceId===s.id))){const original=target.sources.find(s=>s.id===credit.id);assert(original);assert.deepEqual(original,credit,'SHORT_LISTENING_SOURCE_CREDIT');}
  for(const clip of source.clips){const decision=accepted.find(r=>r.rootId===source.rootId&&r.id===clip.id);assert(decision);assert.equal(decision.sourceHash,source.sourceHash);assert.equal(decision.preparedAudioSha256,clip.audio.sha256);assert.equal(clip.qualityFlags.length,0);assert(clip.audio.duration<=Math.min(maxSeconds,decision.maxPreparationSeconds??35)&&clip.wordCount>=30);
  const scopeText=Buffer.from(source.originalText,'utf16le').subarray(decision.sourceSpan.start*2,decision.sourceSpan.end*2).toString('utf16le');assert.equal(scopeText,clip.text);assert.equal(sha(files[clip.audio.src]),clip.audio.sha256);
  const existing=target.record.clips.find(c=>c.id===clip.id);
  if(existing){assert.deepEqual(existing,clip);assert.equal(sha(target.media[clip.audio.src]),clip.audio.sha256);continue;}
  target.record={...target.record,clips:[...target.record.clips,clip]};target.media={...target.media,[clip.audio.src]:files[clip.audio.src]};
  }
 }
 return {accepted:accepted.map(r=>({rootId:r.rootId,id:r.id,audioSha256:r.preparedAudioSha256})),withheld:[...review.records.filter(r=>r.decision!=='accepted-targeted-window-local'),...(review.withheld??[])],heldEncodings:review.heldEncodings??[]};
}
