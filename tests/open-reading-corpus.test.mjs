import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginnerOffsets, sha } from '../scripts/open-reading-corpus.mjs';


test('beginner windows retain complete native paragraphs and exact canonical whitespace, with strict supported bounds', async () => {
 const { readFile } = await import('node:fs/promises');
 const review=JSON.parse(await readFile('content/corpus/open-reading-beginner-source-review.json','utf8'));
 for(const scope of review.scopes) {
  const canonical=await readFile(`${review.inputDirectory}/raw/${scope.sourceProvenance.locator}.canonical.txt`,'utf8');
  const text=beginnerOffsets(canonical,scope), p=scope.sourceProvenance;
  assert.equal(sha(text),p.textSha256);
  for(const mutation of ['start','end','index','codepoint','hash','words','unknown-level','duplicate-level']) {
   const bad=structuredClone(scope);
   if(mutation==='start')bad.sourceProvenance.sourceStart++;
   if(mutation==='end')bad.sourceProvenance.sourceEnd--;
   if(mutation==='index')bad.sourceProvenance.paragraphIndex++;
   if(mutation==='codepoint')bad.sourceProvenance.codePointStart++;
   if(mutation==='hash')bad.sourceProvenance.textSha256=sha('wrong');
   if(mutation==='words')bad.wordCount++;
   if(mutation==='unknown-level')bad.startingPoints=['B1'];
   if(mutation==='duplicate-level')bad.startingPoints=['A2','A2'];
   assert.throws(()=>beginnerOffsets(canonical,bad),/OPEN_READING_BEGINNER_SCOPE/);
  }
  if(scope.wordCount>120)assert.throws(()=>beginnerOffsets(canonical,{...scope,startingPoints:['A1']}),/OPEN_READING_BEGINNER_SCOPE/);
 }
});



