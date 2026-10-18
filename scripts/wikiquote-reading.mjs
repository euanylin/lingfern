import languageRules from '../content/quote-language-rules.json' with {type:'json'};
const archaic=new RegExp(`\\b(?:${languageRules.archaicForms.join('|')})\\b`,'i');
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {createServer} from 'vite';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
import {wikiquoteInputs} from './wikiquote-inputs.mjs';
const {prepared:original,inventory,index,filtered,screen}=await wikiquoteInputs();
const originals=new Map(original.quotes.map(q=>[q.id,q])),bounds=new Map(index.map(q=>[q.quoteId,q]));
const eligible=new Set(screen.rows.filter(row=>row.decision==='not-strong').map(row=>row.id));
assert.equal(filtered.quotes.length,eligible.size);
const exclusions=JSON.parse(await readFile('content/daily-quote-exclusions.json','utf8'));
const normalized=text=>text.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en');
const records=new Map();
for(const q of filtered.quotes){
 if(archaic.test(q.text)||exclusions.some(exclusion=>exclusion.id===q.id||normalized(exclusion.text)===normalized(q.text)))continue;
 assert(eligible.has(q.id));assert.deepEqual(q,originals.get(q.id));
 const b=bounds.get(q.id);assert(b&&b.pageId===q.pageId&&b.revisionId===q.revisionId&&b.rawBlockSha256===q.rawBlockSha256&&b.displayTextSha256===sha(q.text)&&b.underlyingRootId===q.rightsEvidence.workId.replace('gutenberg-','gutenberg-book-')&&b.underlyingCanonicalStart===q.rightsEvidence.matchedStart&&b.underlyingCanonicalEnd===q.rightsEvidence.matchedEnd);
 let source=records.get(q.pageId);
 if(!source){const url=`https://en.wikiquote.org/w/index.php?oldid=${q.revisionId}`;
  source={id:`wikiquote-${q.pageId}`,rootId:`wikiquote-page-${q.pageId}`,title:q.pageTitle,authors:['English Wikiquote contributors'],originalUrl:url,downloadUrl:url,acquiredAt:new Date(inventory.verifiedAt).toISOString(),language:'en',licence:'CC BY-SA 4.0 editorial arrangement; each quotation retains its original public-domain or CC BY 4.0 source evidence; regional public-domain rights unverified.',licenceUrl:'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',attribution:`English Wikiquote contributors · ${q.pageTitle}; original work and edition evidence retained per quotation.`,sourceHash:b.pageTextSha256,reviewStatus:'draft',permissionReview:'Exact source edition and Wikiquote revision verified; regional rights unverified. Strong religious content excluded.',editorialReview:'pending',processing:'Snapshot verification time is recorded as acquiredAt. Separate exact quotations, no concatenation or beginner level assignment; existing client question-type rules and original-work exposure apply.',passages:[]};records.set(q.pageId,source);
 }
 assert.equal(source.sourceHash,b.pageTextSha256);
 source.passages.push({id:sha(q.text),text:q.text,wordCount:q.text.trim().split(/\s+/).length,quoteProvenance:{pageId:q.pageId,revisionId:q.revisionId,pageTitle:q.pageTitle,revisionTimestamp:b.revisionTimestamp,pageTextSha256:b.pageTextSha256,section:q.section,locator:q.locator,url:q.url,rawBlockSha256:q.rawBlockSha256,sourceStart:b.rawBlockStart,sourceEnd:b.rawBlockEnd,textSha256:sha(q.text),rightsEvidence:q.rightsEvidence}});
}
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {corpusSchema}=await server.ssrLoadModule('/src/core/corpus.ts');
 const sources=[...records.values()],outputs=[];
 for(let i=0;i<sources.length;i+=100){const file=`wikiquote${i?'-'+(i/100+1):''}.json`,bank=corpusSchema.parse({version:1,records:sources.slice(i,i+100),failures:[]});outputs.push([file,JSON.stringify(bank,null,2)+'\n']);}
 // Validate every shard before any public write.
 for(const [file,bytes]of outputs)await writeFile('public/corpus/'+file,bytes);
 for(const file of await readdir('public/corpus'))if(/^wikiquote(?:-[1-9]\d*)?\.json$/.test(file)&&!outputs.some(([name])=>name===file))await unlink('public/corpus/'+file);
 console.log(JSON.stringify({quotes:sources.reduce((count,source)=>count+source.passages.length,0),pages:sources.length,shards:outputs.length,originalWorks:new Set(filtered.quotes.map(q=>q.rightsEvidence.workId)).size,noConcatenation:true,noBeginnerAssignment:true}));
}finally{await server.close();}
