import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const admitted=JSON.parse(await readFile('private/wikiquote/modern-20261012/admission/prepared-quotes.json','utf8')).quotes;
const exclusions=JSON.parse(await readFile('content/daily-quote-exclusions.json','utf8'));
const expected=(await Promise.all((await readdir('public/corpus')).filter(name=>/^wikiquote(?:-\d+)?\.json$/.test(name)).map(async name=>JSON.parse(await readFile('public/corpus/'+name,'utf8')).records))).flat().flatMap(record=>record.passages);
assert(expected.length>=3000);
const origin='http://127.0.0.1:8787',browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({locale:'zh-CN',viewport:{width:375,height:812}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
try{
 await page.goto(origin+'/library');
 await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated');await page.reload();
 const pack=page.locator('.package-row').filter({hasText:'阅读语料'});await pack.getByRole('checkbox').check();await page.getByRole('button',{name:'下载所选资源',exact:true}).click();await expect(pack).toContainText('已安装',{timeout:90000});
 const installed=await page.evaluate(async()=>{
  const rows=[];
  for(const name of await caches.keys()){
   const cache=await caches.open(name);
   for(const request of await cache.keys())if(/\/corpus\/wikiquote(?:-\d+)?\.json$/.test(new URL(request.url).pathname))rows.push(...(await(await cache.match(request)).json()).records);
  }
  return rows.flatMap(record=>record.passages);
 });
 assert.equal(installed.length,expected.length);
 const installedById=new Map(installed.map(passage=>[passage.id,passage]));
 for(const passage of expected)assert.deepEqual(installedById.get(passage.id),passage);
 for(const quote of admitted){const passage=installed.find(row=>row.text===quote.text);assert(passage);assert.deepEqual(passage.quoteProvenance.rightsEvidence,quote.rightsEvidence);}
 assert(!installed.some(row=>exclusions.some(exclusion=>exclusion.text===row.text)));
 assert(!installed.some(row=>/\b(?:thou|thee|thy|thine|hath|doth|dost|shalt|whilom|yclept)\b/i.test(row.text)));
 await context.setOffline(true);await page.reload();await expect(pack).toContainText('已安装');
 assert.equal((await page.request.get(origin+'/sw.js')).status(),200);assert.deepEqual(errors,[]);
 console.log(`PASS: real reading resource download/install, ${installed.length} exact source excerpts including the retained 19 modern quotes, language/religion holds, installed offline reload; isolated profile only.`);
}finally{await context.close();await browser.close();}
