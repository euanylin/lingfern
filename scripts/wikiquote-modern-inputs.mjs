import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root='private/wikiquote/modern-20261012/';
const pins={
 'admission/review.json':'06214950b22ad59129e5ce69bae1155e6d9637a494d6391472b010c4edae35fd',
 'admission/prepared-quotes.json':'5f78631bca29ee94b83500f79a5f5d2b4fd21a2dfcc25671476eea506b5dd4fe',
 'admission/reading-index.json':'ea84c4cc8b5434fd917c79b215c4cbdecc13d88024873479680d8192677c9d22',
};
export async function modernWikiquoteInputs(){
 for(const [name,hash]of Object.entries(pins))assert.equal(sha(await readFile(root+name)),hash,'Reviewed modern quote changed: '+name);
 const review=JSON.parse(await readFile(root+'admission/review.json','utf8'));
 assert.equal(review.codeSha256,sha(await readFile('scripts/wikiquote-modern-admission-colab.py')));
 for(const [name,hash]of Object.entries(review.inputs))assert.equal(sha(await readFile(root+name.replace('era-qualified/','era/'))),hash);
 for(const [name,entry]of Object.entries(review.outputs)){const bytes=await readFile(root+'admission/'+name);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);}
 const prepared=JSON.parse(await readFile(root+'admission/prepared-quotes.json','utf8')),index=JSON.parse(await readFile(root+'admission/reading-index.json','utf8'));
 assert.equal(prepared.quotes.length,19);assert.equal(index.length,19);
 assert.deepEqual(prepared.quotes.map(q=>q.id),review.admitted.map(q=>q.id));
 for(const [i,q]of prepared.quotes.entries()){
  assert.equal(q.quotationYear,review.admitted[i].quotationYear);assert(q.quotationYear>=1950);
  assert.equal(sha(q.text),index[i].displayTextSha256);assert.equal(q.rightsEvidence.sourceHash,review.admitted[i].sourceHash);
  assert.equal(q.rightsEvidence.workId,index[i].underlyingRootId);assert.equal(q.id,index[i].quoteId);
 }
 return {quotes:prepared.quotes,index};
}
