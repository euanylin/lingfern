import languageRules from '../content/quote-language-rules.json' with {type:'json'};
const archaic=new RegExp(`\\b(?:${languageRules.archaicForms.join('|')})\\b`,'i');
import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {wikiquoteInputs} from './wikiquote-inputs.mjs';
const {preparedSha256,prepared,inventory,report,filtered,screen}=await wikiquoteInputs();
assert.equal(prepared.source,'English Wikiquote only');assert.equal(prepared.quotes.length,report.counts.preparedRows);assert(prepared.quotes.length>1);
const exclusions=JSON.parse(await readFile('content/daily-quote-exclusions.json','utf8'));
for(const exclusion of exclusions) assert.equal(createHash('sha256').update(exclusion.text).digest('hex'),exclusion.textSha256);
const normalized=text=>text.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en');
const admitted=filtered.quotes.filter(quote=>!archaic.test(quote.text)&&!exclusions.some(exclusion=>quote.id===exclusion.id||normalized(quote.text)===normalized(exclusion.text)));
const quotes=admitted.map(quote=>({...quote,section:quote.section.join(' / ')}));
assert.equal(new Set(quotes.map(q=>q.id)).size,quotes.length);assert.equal(new Set(quotes.map(q=>q.text.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en'))).size,quotes.length);
for(const quote of quotes){assert(/^https:\/\/en\.wikiquote\.org\/w\/index\.php\?oldid=\d+(?:#.*)?$/.test(quote.url));assert(quote.revisionId>0&&quote.pageId>0&&quote.text.trim()&&/[A-Za-z]/.test(quote.text)&&quote.pageTitle.trim());assert(!/[<>]|\{\{|\}\}/.test(quote.text));assert(/^[a-f0-9]{64}$/.test(quote.rawBlockSha256));}
const source={title:'English Wikiquote',url:'https://en.wikiquote.org/',license:'CC BY-SA 4.0 editorial arrangement; original quotation rights retained.',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',snapshotDate:inventory.dump.officialDumpDate,dumpSha256:inventory.dump.hashes.sha256,preparedSha256:preparedSha256};
const metadata={source,quoteCount:quotes.length,pageCount:new Set(quotes.map(q=>q.pageId)).size,sourceSnapshot:inventory.counts,preparationCounts:report.counts,admissionScreen:{excluded:screen.rows.filter(row=>row.decision==='exclude').length,uncertain:screen.rows.filter(row=>row.decision==='uncertain').length},admissionOverrides:{excluded:filtered.quotes.length-admitted.length,ids:exclusions.map(exclusion=>exclusion.id)},fullPublicCoverage:false};
for(const [path,value] of [['content/daily-quotes.json',{version:1,source,quotes}],['content/daily-quotes-metadata.json',metadata]]){await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
console.log(JSON.stringify({quoteCount:quotes.length,eligiblePages:metadata.pageCount,sourceSnapshot:inventory.counts,fullPublicCoverage:false}));
