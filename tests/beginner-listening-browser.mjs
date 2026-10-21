import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const sentenceSources=JSON.parse(await readFile('public/audio/a1-sentences/SENTENCES.json','utf8'));
assert.equal(sentenceSources.length%2,0);
const origin='http://127.0.0.1:8787';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({locale:'zh-CN',viewport:{width:375,height:812}}),page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
const rows=table=>page.evaluate(table=>new Promise((resolve,reject)=>{const open=indexedDB.open('lingfern');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,q=db.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}),table);
async function start() {
 await page.locator('.corpus-practice[data-skill=listening]').getByRole('button',{name:'开始',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.locator('button[data-mode=practice]').click();
 return (await rows('sessions')).find(session=>page.url().endsWith(session.id));
}
async function answer(material, correct=true) {
 await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'录音已播放'})).toBeVisible({timeout:20000});
 if(await page.locator('.question-sheet-toggle').getAttribute('aria-expanded')==='false')await page.locator('.question-sheet-toggle').click();
 await page.waitForFunction(()=>Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.question-panel')).transform).m42)<1);
 await page.locator('.completion-answer input').fill(correct?material.questions[0].answer:'unheard');
 await page.getByRole('button',{name:'保存答案',exact:true}).click();
 await expect(page.locator('.feedback')).toContainText(correct?'回答正确':'再看一看');
}
try {
 await page.goto(origin+'/library');await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated');await page.reload();
 for(const label of ['IPA 发音与录音','初级短句听力'])await page.locator('.package-row').filter({hasText:label}).getByRole('checkbox').check();
 await page.getByRole('button',{name:'下载所选资源',exact:true}).click();
 for(const label of ['IPA 发音与录音','初级短句听力'])await expect(page.locator('.package-row').filter({hasText:label})).toContainText('已安装',{timeout:90000});
 await page.goto(origin+'/start');for(let step=0;step<3;step++)await page.getByRole('button',{name:'跳过这一步',exact:true}).click();
 await page.getByRole('group',{name:'听力',exact:true}).getByLabel(/^A1 ·/).check();await page.getByRole('button',{name:'保存并继续',exact:true}).click();await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();
 await context.setOffline(true);
 // Fix selection only; use real playback, answering, transactions, and routing.
 await page.evaluate(()=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=0,values[1]=0,values):original(values);});
 const usedRoots=new Set();
 for(let unit=0;unit<2;unit++) {
  const session=await start();assert.equal(session.lesson.goalId,'heard-word-recognition');
  for(const [index,material] of session.lesson.materials.entries()) {
   assert(!usedRoots.has(material.rootId));usedRoots.add(material.rootId);
   await answer(material);
   if(!index)await page.getByRole('button',{name:'下一题',exact:true}).click();
  }
  await page.getByRole('link',{name:'返回今日',exact:true}).click();
 }
 const shortRoots=new Set();
 for(let unit=0;unit<sentenceSources.length/2;unit++) {
 console.log('Short-sentence unit',unit);
 const session=await start();assert.equal(session.lesson.goalId,'heard-sentence-completion');assert.equal(session.lesson.generation.startingPoint,'A1');
 assert.equal(new Set(session.lesson.materials.map(material=>material.rootId)).size,2);
 for(const [index,material] of session.lesson.materials.entries()) {
  assert(material.audio.src.startsWith('/audio/a1-sentences/'));assert(!shortRoots.has(material.rootId));shortRoots.add(material.rootId);
  await answer(material,unit!==0||index!==0);
  if(!index) {
   await expect(page.locator('.teaching')).toContainText(session.lesson.workedExample['zh-Hans']);
   await page.screenshot({path:`output/playwright/a1-short-sentences-${unit}-375-light-zh-Hans-offline.png`,animations:'disabled'});
   for(const width of [1440,1200,1024,768,375,320]) {
    await page.setViewportSize({width,height:900});
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    const bounds=await page.locator('.question-panel').boundingBox();assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=width+1);
   }
   await page.setViewportSize({width:375,height:320});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.setViewportSize({width:375,height:812});await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.evaluate(()=>document.documentElement.style.fontSize='');
   await page.reload();await expect(page.locator('.feedback')).toContainText(unit===0?'再看一看':'回答正确');
   assert.equal((await rows('attempts')).filter(attempt=>attempt.sessionId===session.id).length,1);
   if(await page.locator('.question-sheet-toggle').getAttribute('aria-expanded')==='false')await page.locator('.question-sheet-toggle').click();
   await page.waitForFunction(()=>Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.question-panel')).transform).m42)<1);
   await page.getByRole('button',{name:'下一题',exact:true}).click();
  }
 }
 await page.getByRole('link',{name:'返回今日',exact:true}).click();await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 if(unit===0) {
  const remedial=await start();assert.equal(remedial.lesson.goalId,'heard-word-recognition');
  for(const [index,material]of remedial.lesson.materials.entries()) {assert(!usedRoots.has(material.rootId));usedRoots.add(material.rootId);await answer(material);if(!index)await page.getByRole('button',{name:'下一题',exact:true}).click();}
  await page.getByRole('link',{name:'返回今日',exact:true}).click();await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 }
 }
 assert.deepEqual([...shortRoots].sort(),sentenceSources.map(source=>source.rootId).sort());
 const attempts=await rows('attempts');assert.equal(attempts.length,6+sentenceSources.length);assert.equal(attempts.filter(attempt=>attempt.correct===false).length,1);assert.equal(attempts.filter(attempt=>attempt.correct===true).length,attempts.length-1);assert(attempts.every(attempt=>attempt.assistance.audioCompleted===true&&attempt.assistance.playbackRequests===1));
 await page.locator('.corpus-practice[data-skill=listening]').getByRole('button',{name:'开始',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('听单词');
 await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: actual IPA/short-audio download; two fresh complete word applications unlock source-generated short sentences; real native audio playback, evidence/scoring/save, disconnected reload without duplicate, every installed short root, one incorrect answer followed by real word remediation and resumed sentences, exhausted-source fallback and Today at375px.');
}finally{await context.close();await browser.close();}
