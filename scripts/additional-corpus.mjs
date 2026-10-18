import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from '@playwright/test';
import {processArticle} from './corpus.mjs';
const run=promisify(execFile),hash=text=>createHash('sha256').update(text).digest('hex');
const directory='content/corpus/additional';
const families=[{family:'nasa',author:'NASA Glenn Research Center',index:'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/learn-about-aerodynamics/',policy:'https://www.nasa.gov/nasa-brand-center/images-and-media/',pattern:/^https:\/\/www1\.grc\.nasa\.gov\/beginners-guide-to-aeronautics\/[a-z0-9-]+\/$/,licence:'NASA factual/editorial reuse under official media guidelines; no endorsement; excluded third-party content',topic:'science'}, {family:'noaa',author:'NOAA National Ocean Service',index:'https://oceanservice.noaa.gov/facts/oceanfacts-basics.html',policy:'https://oceanservice.noaa.gov/about/faq.html',pattern:/^https:\/\/oceanservice\.noaa\.gov\/facts\/[a-z0-9_-]+\.html$/,licence:'NOAA public information; copying/distribution permitted unless otherwise noted; credit NOAA and no endorsement',topic:'nature'}];
const allowed=url=>families.some(f=>f.pattern.test(url)||url===f.policy)||url==='https://oceanservice.noaa.gov/disclaimer.html';
async function acquire(url,file){if(!allowed(url))throw Error('UNTRUSTED_ADDITIONAL_SOURCE');try{return await readFile(file,'utf8');}catch{}const {stdout}=await run('curl',['--fail','--silent','--show-error','--max-time','45','--max-filesize','3000000',url],{maxBuffer:3000000});await writeFile(file,stdout);return stdout;}
export function continuousParagraphBlocks(paragraphs) {
 const blocks=[];let pending=[];let start=0;
 const flush=()=>{if(pending.length)blocks.push({startParagraph:start,endParagraph:start+pending.length,text:pending.join('\n\n')});pending=[];};
 paragraphs.forEach((paragraph,index)=>{if(!paragraph.keep){flush();return;}if(!pending.length)start=index;pending.push(paragraph.text);});flush();return blocks;
}
export async function prepareUSGS(publish = true) {
 const source=JSON.parse(await readFile('content/corpus/usgs-water-cycle.json','utf8'));
 const capture=await readFile(`${directory}/raw/usgs-water-cycle-web-capture.txt`,'utf8');
 if(source.version!==1||source.source!=='https://www.usgs.gov/water-science-school/water-cycle'||source.rightsPolicy!=='https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits'
  ||source.author!=='U.S. Geological Survey Water Science School'||source.captureSha256!=='d4243f4110d98aedc6f87b08ea5b6c5aac1b70eab1fad4fab809074f79287cd4'||source.captureSha256!==hash(capture)||source.reviewer!=='Codex/AI'||source.decision!=='accepted-exact-plain-text-scopes'
  ||source.regionalRights!=='unverified'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source.acquiredAt)||source.blocks?.length!==3)throw Error('INVALID_USGS_SOURCE');
 const page=capture.split('Copyrights and Credits |')[0];
 const lines=new Map([...page.matchAll(/L(\d+): ([\s\S]*?)(?=L\d+: |$)/g)].map(match=>[Number(match[1]),match[2].replace(/cite\d+†([^]+)/g,(_,label)=>label.split('†')[0]).replace(/\s+/g,' ').trim().normalize('NFC')]));
 const scopes=[[30,31,33,34],[43,44,47],[56,57,58,60,61,64]];
 const scopeHashes=['95269b02b3554bec5de0d18e00f6bbd13540cde2a314db44b2ca7ff8736cc38e','a6db0af96e55d4ff55b193b8c8f428840b61260022107b1da4adb6923732badc','f036cdcf60763ae4d5c289d9290023c8602facfebf18e4a69304280e8c6360e1'];
 const passages=source.blocks.map((block,index)=>{
  const text=scopes[index].map(line=>lines.get(line)).join('\n\n'),wordCount=text.trim().split(/\s+/).length;
  if(JSON.stringify(block.lineNumbers)!==JSON.stringify(scopes[index])||block.text!==text||hash(text)!==block.sha256||block.sha256!==scopeHashes[index]||wordCount!==block.words||wordCount<120||wordCount>700||text.length>12000)throw Error('INVALID_USGS_SCOPE');
  return {id:block.sha256,text,wordCount};
 });
 const record={id:'usgs-68924980278435',rootId:'usgs-article-68924980278435',title:'Water cycle',authors:[source.author],originalUrl:source.source,downloadUrl:source.source,acquiredAt:source.acquiredAt,language:'en',
  licence:'USGS-authored plain text: public domain in the USA; rights outside the USA unverified. Third-party media and captions excluded.',licenceUrl:source.rightsPolicy,
  attribution:`${source.author}, Water cycle. ${source.source}. Plain-text excerpts; U.S. public domain; rights outside the U.S. unverified.`,sourceHash:source.captureSha256,reviewStatus:'draft',editorialReview:'pending',
  permissionReview:'Codex/AI inspected three exact agency-authored prose scopes and official copyright policy. NASA/Pixabay media and caption prose excluded; regional rights unverified. No whole-site/media permission or endorsement.',
  processing:'Exact frozen official web-tool text capture, not raw HTTP HTML (download returned403). Link wrappers/NBSP normalised only. Three separate scope hashes retain source words/paragraphs; no originalText joining across excluded media/captions. Source evidence and exclusions retained in content/corpus/usgs-water-cycle.json. No audio, authored tasks or CEFR calibration.',passages};
 if (!publish) return record;
 const corpus=JSON.parse(await readFile('content/corpus/additional.json','utf8')),topics=JSON.parse(await readFile('content/corpus/additional-topics.json','utf8'));
 corpus.records=[...corpus.records.filter(item=>item.rootId!==record.rootId),record];
 topics.records=[...topics.records.filter(item=>item.rootId!==record.rootId),{rootId:record.rootId,sourceHash:record.sourceHash,topic:'nature',provenance:{url:record.originalUrl,policyUrl:record.licenceUrl,method:'Exact Codex/AI source-scope review: water state/storage/movement and human/environment effects.'}}];
 await writeFile('content/corpus/additional.json',JSON.stringify(corpus,null,2)+'\n');
 await writeFile('content/corpus/additional-topics.json',JSON.stringify(topics,null,2)+'\n');
 return record;
}
function boundaryRegression(){const left='The first retained source paragraph describes a complete independent observation. '.repeat(14).trim(),right='The later retained source paragraph describes a different independent observation. '.repeat(14).trim();const blocks=continuousParagraphBlocks([{text:left,keep:true},{text:'Excluded external paragraph.',keep:false},{text:right,keep:true}]);assert.equal(blocks.length,2);const passages=blocks.flatMap(block=>processArticle(block.text,true));assert.equal(passages.length,2);assert(passages.every(p=>!p.text.includes('observation.\n\nThe later')));assert.equal(continuousParagraphBlocks([{text:left,keep:true},{text:right,keep:true}]).length,1);}
async function main(){
await prepareUSGS();
await mkdir(`${directory}/raw`,{recursive:true});await mkdir(`${directory}/policies`,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({javaScriptEnabled:false});await context.route('**/*',route=>route.abort());const page=await context.newPage();
const records=[],failures=[],evidence=[],policies=[],topics={};
try{
 for(const family of families){
  const policyPath=`${directory}/policies/${family.family}.html`,policy=await acquire(family.policy,policyPath);policies.push({family:family.family,url:family.policy,path:policyPath,sha256:hash(policy)});
  const listingPath=`${directory}/raw/${family.family}-listing.html`,listing=await acquire(family.index,listingPath);await page.setContent(listing);
  const urls=await page.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')));
  const candidates=[...new Set(urls.map(h=>{try{return new URL(h,family.index).href;}catch{return '';}}).filter(url=>family.pattern.test(url)&&url!==family.index&&!url.endsWith('/seasickness.html')))];
  let accepted=0;
  for(const url of candidates){if(accepted>=20)break;const id=Number.parseInt(hash(url).slice(0,12),16),rootId=`${family.family}-article-${id}`,rawPath=`${directory}/raw/${family.family}-${id}.html`;
   try{const raw=await acquire(url,rawPath);await page.setContent(raw);const extracted=await page.evaluate(family=>{
    const title=document.querySelector('h1')?.textContent?.replace(/\s+/g,' ').trim();
    const region=family==='nasa'?document.querySelector('.usa-layout-docs-main_content'):document.querySelector('.col-md-9');if(!title||!region)throw Error('MISSING_ARTICLE_REGION');
    const body=region.cloneNode(true),excluded='script,style,form,aside,nav,header,figure,figcaption,blockquote,video,audio,iframe,.breadcrumbs,.gform_wrapper,.float-right,.caption,.card,.alert,.figure-caption,.jumbotron,footer';
    const transcripts=[...body.querySelectorAll('h1,h2,h3,h4,h5')].filter(h=>/video transcript/i.test(h.textContent));
    const paragraphs=[...body.querySelectorAll('p')].map(p=>{
      const t=p.textContent.replace(/\s+/g,' ').trim().normalize('NFC');
      const common=!p.querySelector('img')&&!p.closest(excluded)&&t.split(/\s+/).length>=8&&!transcripts.some(h=>h.compareDocumentPosition(p)&4)
        &&!/^Related|^Last updated|^Author:|^How to cite|^NASA Official|^Page Editor|^Contact|^Image credit|^Credit:/i.test(t)&&!/:$/.test(t)&&!/Rachel Carson/i.test(t);
      const dependent=family==='nasa'&&(/^(?:where|Notice that the acceleration is a constant|To understand dynamic pressure, we begin)/i.test(t)||/point[s]? [“\"]0|m1 and V1|L\/D ratio.*low L\/D ratio/i.test(t)
        ||/\\\(|\\\)|\b(?:figures?|slides?|diagrams?|simulations?|simulators?|calculators?|programs?|screens?|below|above|equations?|code|click|widgets?|graphs?|graphics?|buttons?|panel|telemetry|input|output|countdown|three ways|front view|side view|lower left|upper right|upper left|tables?)\b/i.test(t));
      return {text:t,keep:common&&!dependent};
    });
    const markers=[...body.querySelectorAll('[copyright],a[href]')].filter(a=>/copyright|used with permission|all rights reserved|©/i.test(a.textContent)).map(a=>a.textContent.trim());
    return {title,paragraphEntries:paragraphs,markers,paragraphs:paragraphs.filter(p=>p.keep).length,bodyText:region.textContent.replace(/\s+/g,' ').trim(),updated:document.querySelector('meta[property="article:modified_time"]')?.content??null};
   },family.family);
   extracted.blocks=continuousParagraphBlocks(extracted.paragraphEntries);extracted.text=extracted.blocks.map(block=>block.text).join('\n\n');
   if(extracted.markers.length||/used with permission|all rights reserved|©/i.test(extracted.text))throw Error('THIRD_PARTY_TEXT_REVIEW_REQUIRED');
   if(family.family==='noaa'&&!/Author:\s*NOAA/i.test(raw.replace(/<[^>]*>/g,'')))throw Error('NOAA_AUTHOR_NOT_VERIFIED');
   const passages=[...new Map(extracted.blocks.flatMap(block=>processArticle(block.text,true)).map(p=>[p.id,p])).values()];if(!passages.length)throw Error('NO_USABLE_COMPLETE_PARAGRAPHS');
   const textPath=`${directory}/raw/${family.family}-${id}.txt`;await writeFile(textPath,extracted.text+'\n');
   records.push({id:`${family.family}-${id}`,rootId,title:extracted.title,authors:[family.author],originalUrl:url,downloadUrl:url,acquiredAt:new Date().toISOString(),language:'en',licence:family.licence,licenceUrl:family.policy,attribution:`${extracted.title} — ${family.author}. ${url}`,sourceHash:hash(raw),...(extracted.blocks.length===1?{originalText:extracted.text}:{}),reviewStatus:'draft',permissionReview:'Official agency policy archived; agency-authored plain-text paragraphs only. Images, captions, video, diagrams, quotations, navigation and third-party embedded content excluded. No new licence imposed on agency text; no endorsement. Retain hash-bound Codex text inspection separately before publication; teaching tasks are Lingfern rule-generated and are not official agency material.',editorialReview:'pending',processing:'DOM paragraph extraction and whitespace normalization only; complete raw HTML retained. NASA entire paragraphs dependent on missing diagrams, formulas or simulation controls excluded; excluded paragraphs form hard boundaries; each contiguous block generates passages separately. Fragmented sources omit originalText to prevent joined long windows. No factual rewriting; original URL determines stable numeric source/root. No audio collected.',passages});
   topics[rootId]=family.family==='nasa'?'science':'nature';evidence.push({rootId,url,rawPath,rawSha256:hash(raw),textPath,textSha256:hash(extracted.text),title:extracted.title,paragraphs:extracted.paragraphs,continuousBlocks:extracted.blocks.map(block=>({...block,textSha256:hash(block.text)})),originalTextProvided:extracted.blocks.length===1,words:extracted.text.split(/\s+/).length,modifiedMetadata:extracted.updated,sourceVersion:{acquiredAt:new Date().toISOString(),pageUpdatedMarkers:[...raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').matchAll(/(?:Last updated|Page Last Updated):?\s*([A-Z][a-z]+ \d{1,2}, \d{4}|\d{2}\/\d{2}\/\d{2})/gi)].map(match=>match[1]),immutableArchive:'rawSha256; official current HTML copy at acquisition, not permanent publisher revision URL'},sourceAuthor:family.author,policyUrl:family.policy,policySha256:hash(policy),decision:'pending-exact-text-inspection',excludedMedia:true});accepted++;console.log(`Collected ${family.family} ${accepted}: ${extracted.title}`);
   }catch(error){failures.push({id,error:String(error.message).slice(0,300)});console.log(`Skipped ${family.family}: ${url} ${error.message}`);}
  }
 }
 const extra=await acquire('https://oceanservice.noaa.gov/disclaimer.html',`${directory}/policies/noaa-disclaimer.html`);policies.push({family:'noaa',url:'https://oceanservice.noaa.gov/disclaimer.html',sha256:hash(extra)});
 await writeFile('content/corpus/additional.json',JSON.stringify({version:1,records,failures},null,2)+'\n');
 await writeFile(`${directory}/provenance.json`,JSON.stringify({version:1,acquiredAt:new Date().toISOString(),policies,records:evidence,uncollected:[{family:'usgs',url:'https://www.usgs.gov/water-science-school/science/evaporation-and-water-cycle',reason:'Actual official response403CloudFront; not collected or accepted'}],audioAcquired:0},null,2)+'\n');
 await writeFile('content/corpus/additional-topics.json',JSON.stringify({version:1,records:records.map(record=>({rootId:record.rootId,sourceHash:record.sourceHash,topic:topics[record.rootId],provenance:{url:record.originalUrl,policyUrl:record.licenceUrl,method:'Official agency educational science source identity; exact topic reviewed by Codex/AI.'}}))},null,2)+'\n');
 await prepareUSGS();
 console.log(JSON.stringify({collectedNASA_NOAASources:records.length,collectedNASA_NOAAFamilies:Object.fromEntries(families.map(f=>[f.family,records.filter(r=>r.id.startsWith(f.family+'-')).length])),collectedNASA_NOAAPassages:records.reduce((s,r)=>s+r.passages.length,0),preparedUSGSSources:1,preparedUSGSScopes:3,failures:failures.length,audio:0}));
}finally{await context.close();await browser.close();}

}
if(process.argv[1]===fileURLToPath(import.meta.url)){boundaryRegression();if(process.argv.includes('--test'))console.log('Contiguous paragraph boundary regression passed');else if(process.argv.includes('--usgs'))console.log(`Prepared ${ (await prepareUSGS()).passages.length } exact USGS prose scopes`);else await main();}
