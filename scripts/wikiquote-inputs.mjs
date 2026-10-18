import {modernWikiquoteInputs} from './wikiquote-modern-inputs.mjs';
import {readableWikiquoteInputs} from './wikiquote-readable-inputs.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
export async function wikiquoteInputs(){
const freeze=await json('private/wikiquote/expansion/final-preparation-freeze.json');
for(const path of ['scripts/wikiquote-quotes.py','private/wikiquote/prepared-quotes.json','private/wikiquote/preparation-report.json','private/wikiquote/expansion/new-edition-ledger.json']){
 const bytes=await readFile(path);assert.equal(bytes.length,freeze.files[path].bytes);assert.equal(sha(bytes),freeze.files[path].sha256);
}
const review=await json('private/wikiquote/final-expanded-prepared-independent-review-2026-10-09.json');
assert.equal(review.allRowRawBlockRevisionProvenanceAndNormalizedEditionChecks,'pass');assert.equal(review.stableInputs,true);
for(const name of Object.keys(review.inputHashes))assert.equal(sha(await readFile('private/wikiquote/'+name)),review.inputHashes[name]);
const locatorReview=await json('private/wikiquote/expansion/final-expanded-scopes-independent-review-2026-10-09.json');assert.equal(locatorReview.decision,'PASS limited expanded admission source evidence');assert.equal(locatorReview.preparedRows,review.preparedRows);assert.equal(locatorReview.appearances,review.allMatchedAppearances);
for(const [path,entry] of Object.entries(locatorReview.frozenInputHashes)){assert.equal(entry.sha256,freeze.files[path].sha256);assert.equal(entry.bytes,freeze.files[path].bytes);}


const accepted={
 'scripts/wikiquote-quotes.py':'12bcb4dc0fdbef25b38a0a81696b9fbe57ad589fac32093e9d64b6c96c0aa1a1',
 'private/wikiquote/final-expanded-prepared-independent-review-2026-10-09.json':'b324a648874e583c8a670d79faff9e8f23128fd1e8d90c9ec2359382b2f1cb34',
 'private/wikiquote/expansion/final-expanded-scopes-independent-review-2026-10-09.json':'62c2b44b1b82de3e4fc4146a42a341afd755483c9a856b40fd9d729cdf3be65e',
 'scripts/wikiquote-religion-screen.py':'9e2ce8ba2ae4811a45b363ba4513a7d03aa11e3cd83a8fc62129390b13ad1faa',
 'private/wikiquote/religion-screen/prepared-screen.json':'d743dc322435d721872d47f3780b4d98b19338fdaef6545e177e017eb3aa21cd',
 'private/wikiquote/religion-screen/filtered-prepared-quotes.json':'7bc36728fb967091d77885d677c7b582c62eff945d2ab1f6adce690e084cfb92',
 'private/wikiquote/religion-screen/report.json':'fd9629372eb63f3fa82cadb2140cefadc49ec0d5df3f62271fbab2c511a2ccab',
 'private/wikiquote/expansion/reading-provenance-index-independent-2026-10-09.json':'877d231c8ef5f15fbc3ee64e42cb73acebe44dd3757b8c471b3f25ac5483a05a',
};
for(const [path,hash]of Object.entries(accepted))assert.equal(sha(await readFile(path)),hash,'Reviewed Wikiquote input changed: '+path);
const prepared=await json('private/wikiquote/prepared-quotes.json'),inventory=await json('private/wikiquote/inventory.json');
const filtered=await json('private/wikiquote/religion-screen/filtered-prepared-quotes.json'),screen=await json('private/wikiquote/religion-screen/prepared-screen.json'),religion=await json('private/wikiquote/religion-screen/report.json'),index=await json('private/wikiquote/expansion/reading-provenance-index-independent-2026-10-09.json'),cloud=await json('private/wikiquote/colab/cloud-results/verification.json');
assert.equal(religion.inputSha256['prepared-quotes.json'],freeze.files['private/wikiquote/prepared-quotes.json'].sha256);
for(const name of ['mainspace-pages.jsonl','bullet-block-candidates.jsonl'])assert.equal(religion.inputSha256[name],inventory.output[name].sha256);
assert.equal(cloud.fullProcessingAndReligionVerified,true);
for(const path of ['prepared-quotes.json','religion-screen/filtered-prepared-quotes.json','religion-screen/prepared-screen.json'])assert.equal(sha(await readFile('private/wikiquote/'+path)),cloud.localVerifiedHashes[path]);
assert.equal(screen.rows.length,prepared.quotes.length);assert.equal(index.length,prepared.quotes.length);
const allowed=new Set(screen.rows.filter(row=>row.decision==='not-strong').map(row=>row.id)),original=new Map(prepared.quotes.map(q=>[q.id,q]));
assert.equal(filtered.quotes.length,allowed.size);assert.equal(new Set(filtered.quotes.map(q=>q.id)).size,allowed.size);
for(const quote of filtered.quotes){assert(allowed.has(quote.id));assert.deepEqual(quote,original.get(quote.id));}
const expansionPins = {
  "private/wikiquote/next-expansion/review/edition-expansion-review.json": "4c006c2e0b8af65a12e583e542d192995847d884dc8e09d316cf22923645a846",
  "private/wikiquote/next-expansion/review/root-independent-review-all.json": "b85aa602829e12b5024b0d497eef717196d7b7fa747dba739c1ce7c72c84346d",
  "private/wikiquote/next-expansion/published-inputs/prepared-quotes.json": "fc9eca06616d0bdeb3133d17fb859616c15feeb546c839b45de362df814c5993",
  "private/wikiquote/next-expansion/published-inputs/reading-index.json": "286b275aa9f9aabf65c9a20305f3bd51eac154b29d20934d925eee89cb683911",
  "private/wikiquote/next-expansion/published-inputs/filtered-prepared-quotes.json": "63765df1650fd5262a441e6f87ca032c8011e334a1a68af4b5478e7c79a6056b",
  "private/wikiquote/next-expansion/published-inputs/prepared-screen.json": "f6cad88cabcd999f106030c66fea955b20cf3b20e9b64c2f039ffc875625382d",
  "private/wikiquote/next-expansion/published-inputs/preparation-report.json": "d30213fafd4a2e8075e639d07804f04a43e9746e7ded2529945bc587ac44ccbf"
};
for (const [path, hash] of Object.entries(expansionPins)) assert.equal(sha(await readFile(path)), hash, 'Reviewed Wikiquote expansion changed: ' + path);
const expansion = await json('private/wikiquote/next-expansion/review/edition-expansion-review.json'), sourceReview = await json('private/wikiquote/next-expansion/review/root-independent-review-all.json');
assert.equal(expansion.fullCandidateBlocks, inventory.counts.topLevelBulletBlocks);
assert.equal(expansion.candidateSha256, inventory.output['bullet-block-candidates.jsonl'].sha256);
assert.equal(sourceReview.all313OriginalBodySourceSpansVerified, true); assert.equal(sourceReview.all335RawCandidateRevisionReligionAppearancesVerified, true);
assert.equal(sourceReview.reviewSha256, expansionPins['private/wikiquote/next-expansion/review/edition-expansion-review.json']);
for (const entry of Object.values(expansion.outputs)) { const bytes = await readFile(entry.path); assert.equal(bytes.length, entry.bytes); assert.equal(sha(bytes), entry.sha256); }
for (const [path, expected] of [['private/wikiquote/next-expansion/complete/match/report.json', expansion.cloudReportSha256], ['private/wikiquote/next-expansion/complete/editions/collection.json', expansion.collectionSha256]]) assert.equal(sha(await readFile(path)), expected);
const discovery = await json('private/wikiquote/next-expansion/complete/match/report.json'); assert.equal(discovery.counts.allCandidates, expansion.fullCandidateBlocks);
assert.equal(discovery.existingSha256, accepted['private/wikiquote/religion-screen/filtered-prepared-quotes.json']);
const latestPrepared = await json('private/wikiquote/next-expansion/published-inputs/prepared-quotes.json'), latestFiltered = await json('private/wikiquote/next-expansion/published-inputs/filtered-prepared-quotes.json'), latestScreen = await json('private/wikiquote/next-expansion/published-inputs/prepared-screen.json'), latestIndex = await json('private/wikiquote/next-expansion/published-inputs/reading-index.json');
assert.deepEqual(latestPrepared.quotes.slice(0, prepared.quotes.length), prepared.quotes);
const eligibleExpansion = await json(expansion.outputs.eligible.path), heldExpansion = await json(expansion.outputs.held.path);
assert.deepEqual(latestPrepared.quotes.slice(prepared.quotes.length), [...eligibleExpansion.quotes, ...heldExpansion.map(row => row.quote)]);
assert.deepEqual(latestScreen.rows.slice(0, screen.rows.length), screen.rows);
const latestAllowed = new Set(latestScreen.rows.filter(row => row.decision === 'not-strong').map(row => row.id));
assert.equal(latestIndex.length, latestPrepared.quotes.length); assert.equal(latestScreen.rows.length, latestPrepared.quotes.length);
assert.deepEqual(latestFiltered.quotes, latestPrepared.quotes.filter(quote => latestAllowed.has(quote.id)));
assert.equal(latestFiltered.quotes.length, filtered.quotes.length + sourceReview.eligible);
assert.deepEqual(latestFiltered.quotes.slice(0, filtered.quotes.length), filtered.quotes);
const citedPins = {
  "private/wikiquote/cited-work-expansion/review-adjudicated-final/cited-work-expansion-review.json": "453c505b6a10116479603fb5df4d2fb9b3437cd8c625e158228ec23b208087c3",
  "private/wikiquote/cited-work-expansion/root-independent-source-review.json": "87afd7a72518857e56729e26cfd1903ec8122a281bf9f2b4e1e83a279e0393a8",
  "private/wikiquote/cited-work-expansion/root-experience-paragraph-adjudication.json": "3e2396edf5ea096085b206061a40fc44888de5784085537ae093e9cb080f0966",
  "private/wikiquote/cited-work-expansion/published-inputs/prepared-quotes.json": "20b761b67568608985ae3f68da3baf818195e3ac0fbedf62f24ef0fabb1e09d8",
  "private/wikiquote/cited-work-expansion/published-inputs/filtered-prepared-quotes.json": "bf197eb29c013b56108c6bc7362e43cd85d3394a1968df7756b55e152fe583fc",
  "private/wikiquote/cited-work-expansion/published-inputs/prepared-screen.json": "a8b91a1b0d588700336b4c2853e6d4f2bfab936e62b995abaf08a15c54e2c833",
  "private/wikiquote/cited-work-expansion/published-inputs/reading-index.json": "65ce7b6d74d83bf6b21a1400e1602991c40f99b6c4b48a61d45813f27e8aa268",
  "private/wikiquote/cited-work-expansion/published-inputs/preparation-report.json": "5f15b1ab7d86e78acf60eecba84a3611b6899ef68fca8f3fd24ac861ba71a622"
};
for (const [path, hash] of Object.entries(citedPins)) assert.equal(sha(await readFile(path)), hash, 'Reviewed cited original source changed: ' + path);
const cited = await json('private/wikiquote/cited-work-expansion/review-adjudicated-final/cited-work-expansion-review.json'), independent = await json('private/wikiquote/cited-work-expansion/root-independent-source-review.json');
assert.equal(independent.reviewSha256, citedPins['private/wikiquote/cited-work-expansion/review-adjudicated-final/cited-work-expansion-review.json']);
assert.equal(independent.all83SourceCodepointsIdsAndExactBodySpansVerified, true); assert.equal(independent.all135CandidateRevisionReligionAppearancesVerified, true);
assert.equal(independent.preciseSemanticAdjudicationSha256, citedPins['private/wikiquote/cited-work-expansion/root-experience-paragraph-adjudication.json']);
assert.equal(cited.candidateSha256, inventory.output['bullet-block-candidates.jsonl'].sha256); assert.equal(cited.fullCandidateBlocks, inventory.counts.topLevelBulletBlocks);
for (const entry of Object.values(cited.outputs)) { const bytes = await readFile(entry.path); assert.equal(bytes.length, entry.bytes); assert.equal(sha(bytes), entry.sha256); }
for (const [path, expected] of [['private/wikiquote/cited-work-expansion/full-match/match/report.json', cited.cloudReportSha256], ['private/wikiquote/cited-work-expansion/full-match/collection.json', cited.collectionSha256]]) assert.equal(sha(await readFile(path)), expected);
assert.equal(cited.oldInputHashes.prepared1111, expansionPins['private/wikiquote/next-expansion/published-inputs/prepared-quotes.json']);
assert.equal(cited.oldInputHashes.filtered1057, expansionPins['private/wikiquote/next-expansion/published-inputs/filtered-prepared-quotes.json']);
assert.equal(cited.oldInputHashes.screen1111, expansionPins['private/wikiquote/next-expansion/published-inputs/prepared-screen.json']);
const currentPrepared = await json('private/wikiquote/cited-work-expansion/published-inputs/prepared-quotes.json'), currentFiltered = await json('private/wikiquote/cited-work-expansion/published-inputs/filtered-prepared-quotes.json'), currentScreen = await json('private/wikiquote/cited-work-expansion/published-inputs/prepared-screen.json'), currentIndex = await json('private/wikiquote/cited-work-expansion/published-inputs/reading-index.json'), currentReport = await json('private/wikiquote/cited-work-expansion/published-inputs/preparation-report.json');
const admitted = await json(cited.outputs.eligible.path), held = await json(cited.outputs.held.path);
assert.deepEqual(currentPrepared.quotes.slice(0, latestPrepared.quotes.length), latestPrepared.quotes);
assert.deepEqual(currentPrepared.quotes.slice(latestPrepared.quotes.length), [...admitted.quotes, ...held.filter(row => !row.review.reasons.includes('previous-preparation-preserved-not-new')).map(row => row.quote)]);
assert.deepEqual(currentScreen.rows.slice(0, latestScreen.rows.length), latestScreen.rows); assert.deepEqual(currentIndex.slice(0, latestIndex.length), latestIndex);
const currentAllowed = new Set(currentScreen.rows.filter(row => row.decision === 'not-strong').map(row => row.id));
assert.equal(currentPrepared.quotes.length, 1191); assert.equal(currentIndex.length, currentPrepared.quotes.length); assert.equal(currentScreen.rows.length, currentPrepared.quotes.length);
assert.deepEqual(currentFiltered.quotes, currentPrepared.quotes.filter(quote => currentAllowed.has(quote.id)));
assert.equal(currentFiltered.quotes.length, latestFiltered.quotes.length + independent.eligible);
assert.deepEqual(currentFiltered.quotes.slice(0, latestFiltered.quotes.length), latestFiltered.quotes);
const modern=await modernWikiquoteInputs();
currentPrepared.quotes.push(...modern.quotes);currentFiltered.quotes.push(...modern.quotes);currentIndex.push(...modern.index);
currentScreen.rows.push(...modern.quotes.map(q=>({id:q.id,decision:'not-strong',reason:'individually-inspected-modern-source-context'})));
const readable=await readableWikiquoteInputs();
currentPrepared.quotes.push(...readable.quotes);currentFiltered.quotes.push(...readable.quotes);currentIndex.push(...readable.index);
currentScreen.rows.push(...readable.quotes.map(q=>({id:q.id,decision:'not-strong',reason:'individually-inspected-readable-primary-source-context'})));
currentReport.counts.preparedRows=currentPrepared.quotes.length;
return {freeze, prepared: currentPrepared, inventory, report: currentReport, filtered: currentFiltered, screen: currentScreen, index: currentIndex, cloud,
 preparedSha256: sha(JSON.stringify(currentPrepared))};
}
