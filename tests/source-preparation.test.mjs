import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { paragraphOffsets, sha } from '../scripts/open-reading-corpus.mjs';
import { recoveredWordSegments } from '../scripts/recovered-listening.mjs';

// Keep portable guards in CI; actual corpus evidence stays in the separate local suite.

test('changed source review fails its hard pin before opening raw sources', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lingfern-pg-review-'));
  try {
    await mkdir(join(directory, 'content/corpus'), { recursive: true });
    const bytes = await readFile('content/corpus/gutenberg-expansion-source-review.json');
    await writeFile(join(directory, 'content/corpus/gutenberg-expansion-source-review.json'), Buffer.concat([bytes, Buffer.from(' ')]));
    const moduleUrl = new URL('../scripts/gutenberg-expansion.mjs', import.meta.url).href;
    const code = `const {prepareGutenbergExpansion}=await import(${JSON.stringify(moduleUrl)});try{await prepareGutenbergExpansion({version:1,records:[],failures:[]});process.exit(1)}catch(e){if(e.message!=='GUTENBERG_EXPANSION_REVIEW')throw e}`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('word alignment keeps source typography and actual per-word bounds, rejects incomplete raw text and words',()=>{
 const text='“We went home!”\r\nThen we slept.';
 const raw={language:'en',text:'We went home. Then we slept.',segments:[{text:'We went home.',words:[{word:'We',start:.1,end:.4},{word:'went',start:.4,end:.8},{word:'home',start:.8,end:1.1}]},{text:'Then we slept.',words:[{word:'Then',start:1.3,end:1.6},{word:'we',start:1.6,end:1.8},{word:'slept',start:1.8,end:2.2}]}]};
 const segments=recoveredWordSegments(text,raw,2.5);assert.equal(segments.length,6);assert.equal(segments.map(row=>row.text).join(''),text);assert.equal(segments[3].audioStart,1.3);
 for(const mutate of [r=>r.text+=' again',r=>r.segments[1].words.pop(),r=>r.segments[1].words[0].start=.5,r=>r.segments[1].words[2].end=3,r=>r.segments[0].words[0].start=NaN,r=>r.segments[0].words[0].word='We again',r=>r.language='fr',r=>r.segments[0].text='We got home.']) {const value=structuredClone(raw);mutate(value);assert.throws(()=>recoveredWordSegments(text,value,2.5));}
});

test('a changed expansion source review cannot reach raw sources or publication', async () => {
 const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
 const { tmpdir } = await import('node:os');
 const { join, resolve } = await import('node:path');
 const { spawnSync } = await import('node:child_process');
 const directory = await mkdtemp(join(tmpdir(), 'lingfern-expansion-negative-'));
 try {
  await mkdir(join(directory, 'content/corpus'), { recursive: true });
  await mkdir(join(directory, 'public/corpus'), { recursive: true });
  await writeFile(join(directory, 'content/corpus/reading-expansion-source-review.json'), JSON.stringify({ version: 1, reviewer: 'Codex/AI', sources: [] }));
  await writeFile(join(directory, 'public/corpus/additional.json'), 'unchanged');
  const script = `import {prepareReadingExpansion} from ${JSON.stringify(new URL('file://' + resolve('scripts/reading-expansion.mjs')).href)};await prepareReadingExpansion({},{});`;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(child.status, 0); assert.match(child.stderr, /READING_EXPANSION_REVIEW/);
  assert.equal(await readFile(join(directory, 'public/corpus/additional.json'), 'utf8'), 'unchanged');
 } finally { await rm(directory, { recursive: true, force: true }); }
});

test('converts codepoint offsets without splitting or joining complete paragraphs', () => {
 const text = 'This scientific paragraph has several sentences. '.repeat(22).trim();
 const first = 'An astral symbol 😀 precedes this paragraph.';
 const canonical = first + '\n\n' + text;
 const start = Array.from(first + '\n\n').length;
 const row = { start, end:start+Array.from(text).length, paragraphIndex:1,text,textSha256:sha(text),wordCount:text.split(/\s+/).length };
 assert.deepEqual(paragraphOffsets(canonical,row),{sourceStart:first.length+2,sourceEnd:canonical.length});
 for(const bad of [{start:start+1},{end:row.end-1},{paragraphIndex:0},{textSha256:sha('wrong')},{wordCount:119}]) assert.throws(()=>paragraphOffsets(canonical,{...row,...bad}));
 const joined=first+'\n\n'+text;
 assert.throws(()=>paragraphOffsets(canonical,{...row,start:0,end:Array.from(canonical).length,text:joined,textSha256:sha(joined),wordCount:joined.split(/\s+/).length}));
});

test('changed beginner source-review bytes cannot reach source loading or publication', async () => {
 const { mkdtemp,mkdir,writeFile,readFile,rm }=await import('node:fs/promises');
 const { tmpdir }=await import('node:os');
 const { join,resolve }=await import('node:path');
 const { spawnSync }=await import('node:child_process');
 const directory=await mkdtemp(join(tmpdir(),'lingfern-beginner-review-negative-'));
 try {
  await mkdir(join(directory,'content/corpus'),{recursive:true});
  await mkdir(join(directory,'public/corpus'),{recursive:true});
  await writeFile(join(directory,'public/corpus/open-reading.json'),'unchanged');
  const original=JSON.parse(await readFile('content/corpus/open-reading-beginner-source-review.json','utf8'));
  const script=`import {prepareOpenReadingBeginner} from ${JSON.stringify(new URL('file://'+resolve('scripts/open-reading-corpus.mjs')).href)};await prepareOpenReadingBeginner({});`;
  for(const field of ['manifestSha256','reviewer','sourceHash','scopes']) {
   const bad=structuredClone(original);bad[field]=field==='scopes'?[]:'altered';
   await writeFile(join(directory,'content/corpus/open-reading-beginner-source-review.json'),JSON.stringify(bad));
   const child=spawnSync(process.execPath,['--input-type=module','--eval',script],{cwd:directory,encoding:'utf8'});
   assert.notEqual(child.status,0);assert.match(child.stderr,/OPEN_READING_BEGINNER_REVIEW/);
   assert.equal(await readFile(join(directory,'public/corpus/open-reading.json'),'utf8'),'unchanged');
  }
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('tampered preparation and approval cannot write public files', async () => {
 const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
 const { tmpdir } = await import('node:os');
 const { join, resolve } = await import('node:path');
 const { spawnSync } = await import('node:child_process');
 const directory=await mkdtemp(join(tmpdir(),'lingfern-open-reading-negative-'));
 try {
  await mkdir(join(directory,'content/corpus'),{recursive:true});
  await mkdir(join(directory,'public/corpus'),{recursive:true});
  await writeFile(join(directory,'public/corpus/open-reading.json'),'existing exact corpus');
  for(const mutation of ['changed-prepared-and-manifest','unknown-book','modern-commit','changed-license','wrong-boundary','dirty-source-id']) {
   await writeFile(join(directory,'content/corpus/open-reading-source-manifest.json'),JSON.stringify({version:1,sourceReview:'Codex/AI',unjoinedParagraphs:true,mutation}));
   const child=spawnSync(process.execPath,[resolve('scripts/open-reading-corpus.mjs')],{cwd:directory,encoding:'utf8'});
   assert.notEqual(child.status,0);assert.match(child.stderr,/OPEN_READING_UNFROZEN/);
   assert.equal(await readFile(join(directory,'public/corpus/open-reading.json'),'utf8'),'existing exact corpus');
  }
 } finally { await rm(directory,{recursive:true,force:true}); }
});

test('source bytes and rewritten manifest remain bound to the frozen manifest digest', async () => {
 const { readFrozenSources } = await import('../scripts/open-reading-corpus.mjs');
 const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
 const { tmpdir } = await import('node:os');
 const { join } = await import('node:path');
 const base=await mkdtemp(join(tmpdir(),'lingfern-reading-source-hash-'));
 try {
  const original=Buffer.from('[]'), manifest=JSON.stringify({'prepared.json':{bytes:original.length,sha256:sha(original)}});
  await writeFile(join(base,'prepared.json'),original);await writeFile(join(base,'manifest.json'),manifest);
  expectMap(await readFrozenSources(base,sha(manifest)),original);
  const altered=Buffer.from('[{"foreign":"source"}]');await writeFile(join(base,'prepared.json'),altered);
  await assert.rejects(readFrozenSources(base,sha(manifest)),/OPEN_READING_SOURCE_HASH/);
  await writeFile(join(base,'manifest.json'),JSON.stringify({'prepared.json':{bytes:altered.length,sha256:sha(altered)}}));
  await assert.rejects(readFrozenSources(base,sha(manifest)),/OPEN_READING_SOURCE_MANIFEST/);
 } finally { await rm(base,{recursive:true,force:true}); }
 function expectMap(map,bytes) { assert.deepEqual(map.get('prepared.json'),bytes); }
});
