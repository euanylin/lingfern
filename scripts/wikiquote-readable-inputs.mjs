import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const root='private/wikiquote/usable-3000-20261012/';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(root+path,'utf8'));
const pins={
 'review.json':'e41c734a1709a170b1d0022bc3336cb5e49931632e08b44e458fbf309a335a2e',
 'prepared-quotes.json':'c2c0cd59f545b77a3da8ab626e43d0ec9b234567a25ce9bee2155df253e1a1d3',
 'reading-index.json':'d1c4c8f4d99268d87069a6c074bb3256cf50d31f42846d1e4f48b9939f14fa84',
};
export async function readableWikiquoteInputs(){
 for(const [name,hash]of Object.entries(pins))assert.equal(sha(await readFile(root+'admission/'+name)),hash,'Reviewed readable quote changed: '+name);
 const review=await json('admission/review.json');
 assert.equal(review.codeSha256,sha(await readFile('scripts/wikiquote-readable-admission-colab.py')));
 assert.equal(review.inputSha256,sha(await readFile(root+'admission-input.json')));
 for(const [name,entry]of Object.entries(review.outputs)){const bytes=await readFile(root+'admission/'+name);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);}
 const prepared=await json('admission/prepared-quotes.json'),index=await json('admission/reading-index.json');
 assert.equal(prepared.quotes.length,2166);assert.equal(index.length,2166);
 assert.deepEqual(prepared.quotes.map(q=>q.id),review.admitted.map(q=>q.id));
 const decisions=new Map();
 for(const batch of review.batchReviews){
  const base=batch.name==='first'?'':'second/';
  for(const [name,hash]of [['source-review.json',batch.reviewSha256],['semantic-review.json',batch.semanticSha256],['sources/collection.json',batch.collectionSha256],['discovery/exact-pending.json',batch.discoverySha256]])assert.equal(sha(await readFile(root+base+name)),hash);
  for(const row of (await json(base+'source-review.json')).records)if(row.decision==='admit-pending-cloud-recheck')decisions.set(row.id,{...row,batch:batch.name});
 }
 assert.equal(decisions.size,2166);
 for(const [i,q]of prepared.quotes.entries()){
  const decision=decisions.get(q.id),accepted=review.admitted[i],b=index[i],e=q.rightsEvidence;
  assert(decision);assert.equal(decision.textSha256,sha(q.text));assert.equal(accepted.textSha256,sha(q.text));
  assert.equal(decision.batch,accepted.batch);assert.equal(decision.bookId,accepted.bookId);
  assert.equal(e.workId,'gutenberg-'+decision.bookId);assert.equal(e.sourceHash,accepted.sourceHash);
  assert.equal(q.id,b.quoteId);assert.equal(sha(q.text),b.displayTextSha256);
  assert.equal(b.underlyingRootId,e.workId.replace('gutenberg-','gutenberg-book-'));
  assert.equal(b.underlyingCanonicalStart,e.matchedStart);assert.equal(b.underlyingCanonicalEnd,e.matchedEnd);
 }
 // Reverify originals using Python's Unicode code-point offsets.
 for(const [key,entry]of Object.entries(review.sourceFiles)){
  const [batch,bid]=key.split(':'),base=batch==='first'?'':'second/';
  const raw=batch==='first'?`sources/raw/${bid}/pg${bid}.txt`:`second/sources/pg${bid}.txt`;
  const metadata=batch==='first'?`sources/metadata/pg${bid}-metadata.rdf`:`second/sources/pg${bid}-metadata.rdf`;
  assert.equal(sha(await readFile(root+raw)),entry.sourceHash);assert.equal(sha(await readFile(root+metadata)),entry.metadataSha256);
  const text=await readFile(root+base+`canonical/pg${bid}.txt`,'utf8');assert.equal(sha(text),entry.canonicalSha256);
  const points=/[\uD800-\uDBFF]/.test(text)?Array.from(text):undefined;
  for(const q of prepared.quotes.filter(q=>decisions.get(q.id).batch===batch&&q.rightsEvidence.workId==='gutenberg-'+bid)){
   const e=q.rightsEvidence;assert.equal(e.sourceHash,entry.sourceHash);assert.equal(e.metadataSha256,entry.metadataSha256);
   assert(e.matchedStart>=0&&e.matchedEnd>e.matchedStart&&e.matchedEnd<=(points?.length??text.length));
   assert.equal(sha(points?points.slice(e.matchedStart,e.matchedEnd).join(''):text.slice(e.matchedStart,e.matchedEnd)),e.matchedTextSha256);
  }
 }
 return {quotes:prepared.quotes,index};
}
