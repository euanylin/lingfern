import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
const catalogue=JSON.parse(readFileSync('content/source-packs.json','utf8'));
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false}});
let primary,foreign,seed,expected;
try {
 const {inspectCommunityPack}=await server.ssrLoadModule('/src/data/communityPack.ts');
 const {reviewedReading}=await server.ssrLoadModule('/src/data/corpus.ts');
 const {corpusLesson}=await server.ssrLoadModule('/src/core/corpus.ts');
 const {corpusOperation}=await server.ssrLoadModule('/src/core/corpusPractice.ts');
 const banks=[];
 for(const id of ['wikipedia-reading-006','wikipedia-reading-017']) {
  const entry=catalogue.packs.find(pack=>pack.id===id);
  const pack=await inspectCommunityPack(new Uint8Array(readFileSync('public'+entry.path)));assert.equal(pack.hash,entry.sha256);
  banks.push({entry,bank:pack.corpus});
 }
 primary=banks[0];foreign=banks[1];
 // Match bundled source order and IndexedDB [profileId,hash] package order.
 const installed=[...banks].sort((a,b)=>a.entry.sha256.localeCompare(b.entry.sha256)).flatMap(item=>item.bank.records);
 const records=await reviewedReading([...['voa','gutenberg'].flatMap(source=>JSON.parse(readFileSync('public/corpus/'+source+'.json','utf8')).records),...installed],220);
 const mixed={version:1,failures:[],records:[...new Map(records.map(record=>[record.rootId,record])).values()]};
 assert(['voa-','gutenberg-','wikipedia-'].every(prefix=>mixed.records.some(record=>record.id.startsWith(prefix))));
 for(let index=0;index<2048&&!expected;index++) {
  const value=Math.imul(index+1,0x9e3779b1)>>>0;
  const lesson=corpusLesson(mixed,new Set(),value,220,'B1');
  if(lesson?.materials[0].sourceId.startsWith('gutenberg-')&&lesson.materials.every(material=>material.questions[0].kind==='evidence'&&material.questions[1]?.kind==='response')&&corpusOperation(lesson.materials[0].questions[0])===corpusOperation(lesson.materials[1].questions[0])){seed=value;expected=lesson;}
 }
 assert(expected,'Actual merged available sources must supply a Gutenberg primary with a distinct-root same-operation application');
 assert.notEqual(expected.materials[0].rootId,expected.materials[1].rootId);
 assert(!primary.bank.records.some(record=>record.rootId===expected.materials[0].rootId));
}finally{await server.close();}
const origin='http://127.0.0.1:8787',browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();
const errors=[],downloads=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.url().includes('/source-packs/'))downloads.push(response.url());});
await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
const rows=table=>page.evaluate(table=>new Promise((resolve,reject)=>{const open=indexedDB.open('lingfern');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,request=db.transaction(table).objectStore(table).getAll();request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>reject(request.error);};}),table);
try {
 await page.goto(origin+'/library');await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated');await page.reload();
 const resources=page.locator('.package-row').filter({hasText:'阅读语料'});await resources.getByRole('checkbox').check();await page.getByRole('button',{name:'下载所选资源',exact:true}).click();await expect(resources).toContainText('已安装',{timeout:90000});
 await page.getByLabel('导入 ZIP',{exact:true}).setInputFiles('public'+foreign.entry.path);
 await expect.poll(async()=>(await rows('communityPacks')).some(pack=>pack.hash===foreign.entry.sha256&&pack.state==='ready'),{timeout:90000}).toBe(true);
 await page.goto(origin+'/start');for(let step=0;step<3;step++)await page.getByRole('button',{name:'跳过这一步',exact:true}).click();await page.getByRole('group',{name:'阅读',exact:true}).getByLabel(/^B1 ·/).check();await page.getByRole('button',{name:'保存并继续',exact:true}).click();await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();
 const available=catalogue.packs.filter(pack=>pack.skill==='reading'&&pack.id!==foreign.entry.id&&pack.minWords!==null&&pack.minWords<=220),packSeed=available.findIndex(pack=>pack.id===primary.entry.id);assert(packSeed>=0);
 await page.evaluate(({packSeed,seed})=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=packSeed,values[1]=seed,values):original(values);},{packSeed,seed});
 await page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:'开始',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible({timeout:90000});assert(downloads.some(url=>url.endsWith('/'+primary.entry.id+'.zip')));await expect.poll(async()=>(await rows('communityPacks')).some(pack=>pack.hash===primary.entry.sha256&&pack.state==='ready')).toBe(true);await page.getByRole('dialog').locator('button[data-mode=practice]').click();
 const session=(await rows('sessions'))[0];assert.equal(session.lesson.generation.seed,seed);assert(session.lesson.materials[0].sourceId.startsWith('gutenberg-'));assert.equal(new Set(session.lesson.materials.map(material=>material.rootId)).size,2);assert.equal(session.lesson.materials[0].rootId,expected.materials[0].rootId);assert.equal(session.lesson.materials[1].rootId,expected.materials[1].rootId);assert.deepEqual(session.lesson.materials.map(material=>material.blocks[0].text),expected.materials.map(material=>material.blocks[0].text));assert.deepEqual(session.lesson.materials.map(material=>material.credit),expected.materials.map(material=>material.credit));assert.deepEqual(session.lesson.materials.map(material=>material.questions),expected.materials.map(material=>material.questions));
 await context.setOffline(true);
 for(const [index,question]of session.lesson.materials.flatMap(material=>material.questions).entries()) {
  if(index)await page.getByRole('button',{name:'下一题',exact:true}).click();await expect(page.locator('#learning-question h2').first()).toHaveText(question.prompt);
  const panel=page.locator('.question-panel');if(await panel.getAttribute('data-open')==='false'){const toggle=page.locator('.question-sheet-toggle');await expect(toggle).toBeVisible();await toggle.click();}
  await expect(page.locator('.question-panel')).toHaveAttribute('data-open','true');
  if(question.kind==='evidence')await page.locator('.evidence-option').nth(question.accepted[0]).click();else {assert.equal(question.kind,'response');await page.locator('.response-answer textarea').fill('The wording presents this claim with a qualification. The source wording supports that interpretation.');}
  await page.getByRole('button',{name:'保存答案',exact:true}).click();await expect(page.locator('.feedback')).toContainText(question.kind==='evidence'?'回答正确':'未自动评分');await page.reload();await expect(page.locator('#learning-question h2').first()).toHaveText(question.prompt);await page.locator('.question-sheet-toggle').click();await expect(page.locator('.feedback')).toBeVisible();assert.equal((await rows('attempts')).length,index+1);
 }
 const saved=await rows('attempts');assert.equal(saved.filter(row=>row.correct===true).length,2);assert.equal(saved.filter(row=>row.correct===null).length,2);
 for(const width of [1440,1200,1024,768,375,320]){await page.setViewportSize({width,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.screenshot({path:'output/playwright/reading-cross-package-320-light-zh-Hans-offline.png'});
 await page.goto(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();assert.deepEqual(errors,[]);
 const journal='private/corpus/reading-cross-package-verification.json',prior=existsSync(journal)?JSON.parse(readFileSync(journal,'utf8')):undefined;
 writeFileSync(journal,JSON.stringify({previousRuns:prior?[...(prior.previousRuns??[]),Object.fromEntries(Object.entries(prior).filter(([key])=>key!=='previousRuns'))]:[],verifiedAt:new Date().toISOString(),scope:'Actual core texts and older Wiki install, normal online new Wiki download, full mixed-bank default generation with Gutenberg primary, offline four responses/save/reload; no source/rights/audio acceptance or calibrated ability.',downloaded:{id:primary.entry.id,sha256:primary.entry.sha256},previouslyInstalled:{id:foreign.entry.id,sha256:foreign.entry.sha256},sourceFamilies:['voa','gutenberg','wikipedia'],materialSources:session.lesson.materials.map(material=>material.sourceId),seed,roots:session.lesson.materials.map(material=>material.rootId),savedResponses:saved.length},null,2));
 console.log('PASS: normal online Wiki download installed alongside VOA/Gutenberg and prior Wiki; mixed-bank Gutenberg primary and distinct-root same-operation application, four offline saved/reloaded responses, exact source bytes/credits, six widths and Today.');
}catch(error){await page.screenshot({path:'output/playwright/reading-cross-package-failure.png'});throw error;}finally{await context.close();await browser.close();}
