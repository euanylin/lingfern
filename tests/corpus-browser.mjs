import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
const interests=process.argv.includes('--interests')?['technology','sport']:[];
const workplace=process.argv.includes('--workplace');
const phone=process.argv.includes('--phone');
const address=process.argv.includes('--address');
const kind = address||phone?'choice':process.argv.includes('--sequence')?'sequence':process.argv.includes('--table') ? 'table' : process.argv.includes('--completion') ? 'completion' : 'matching';
const rooms=process.argv.includes('--rooms');
const point=process.argv.includes('--a2')?'A2':'A1';
const maxWords=point==='A1'?120:160;
const requestedRoot = process.argv.find(arg => arg.startsWith('--root='))?.slice(7);
const screenshot = (point==='A2'?'a2-':'')+(kind === 'table' ? 'apartment-example' : kind==='completion'?'word-example':kind==='sequence'?'sequence-example':phone?'phone-example':address?'address-example':rooms?'room-example':'speaker-example') + (requestedRoot ? '-'+requestedRoot+(workplace?'-workplace':'-expanded') : '');
const bank=JSON.parse(await readFile('public/corpus/voa.json','utf8'));
const workplaceIds=bank.records.flatMap(source=>source.passages.slice(1).map(passage=>passage.id));
let seed,root;
const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-corpus-browser',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{const {corpusLesson}=await server.ssrLoadModule('/src/core/corpus.ts');for(let candidate=0;candidate<180;candidate++){
 const lesson=corpusLesson(bank,new Set(),candidate,maxWords,point,interests);
 if(lesson&&(lesson.materials[0].questions[0].kind??'choice')===kind&&(!rooms||lesson.materials[0].questions[0].prompt==='Match each activity to its room.')&&(phone?lesson.materials[0].questions[0].prompt==='What is the work phone number?':address?lesson.materials[0].questions[0].prompt==='What name does the speaker request?':lesson.workedExample.en.startsWith('Example:'))&&(!requestedRoot||lesson.materials[0].rootId===requestedRoot)&&(!workplace||bank.records.some(source=>source.passages.slice(1).some(passage=>passage.text===lesson.materials[0].blocks[0].text&&workplaceIds.includes(passage.id))))){seed=candidate;root=lesson.materials[0].rootId;break;}
}}finally{await server.close();}
assert(seed!==undefined);
const origin='http://127.0.0.1:8787',browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({locale:'zh-CN',viewport:{width:375,height:812}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
const rows=table=>page.evaluate(table=>new Promise((resolve,reject)=>{const open=indexedDB.open('lingfern');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,q=db.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}),table);
try{
 await page.goto(origin+'/library');await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated',undefined,{timeout:30000});await page.reload();
 const pack=page.locator('.package-row').filter({hasText:'阅读语料'});await pack.getByRole('checkbox').check();await page.getByRole('button',{name:'下载所选资源',exact:true}).click();await expect(pack).toContainText('已安装',{timeout:90000});await page.goto(origin+'/start');
 for(let step=0;step<(interests.length?2:3);step++)await page.getByRole('button',{name:'跳过这一步',exact:true}).click();if(interests.length){await expect(page.locator('.first-run input[type=checkbox]')).toHaveCount(18);for(const label of ['科技与互联网','体育','科学','自然与动物','音乐'])await page.getByLabel(label,{exact:true}).check();await expect(page.getByLabel('健康',{exact:true})).toBeDisabled();for(const label of ['科学','自然与动物','音乐'])await page.getByLabel(label,{exact:true}).uncheck();await expect(page.getByLabel('健康',{exact:true})).toBeEnabled();for(const width of [1440,768,375,320]){await page.setViewportSize({width,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.screenshot({path:'output/playwright/interests-18-320-light-zh-Hans.png'});await page.getByRole('button',{name:'保存并继续',exact:true}).click();}
 await page.getByRole('group',{name:'阅读',exact:true}).getByLabel(new RegExp('^'+point+' ·')).check();await page.getByRole('button',{name:'保存并继续',exact:true}).click();await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();if(interests.length)assert.deepEqual((await rows('profiles'))[0].preferences.interests,interests);
 await page.getByRole('link',{name:'设置',exact:true}).click();await expect(page).toHaveURL(origin+'/settings');await page.getByRole('link',{name:'今日',exact:true}).click();await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 await page.setViewportSize({width:1440,height:900});await context.setOffline(true);await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=0,values[1]=seed,values):original(values);},seed);
 await page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:'开始',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible({timeout:90000});
 await page.goBack();await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();await page.setViewportSize({width:375,height:812});
 await page.reload();await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=0,values[1]=seed,values):original(values);},seed);await page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:'开始',exact:true}).click();await expect(dialog).toBeVisible({timeout:90000});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(origin+'/today');
 await page.reload();await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=0,values[1]=seed,values):original(values);},seed);await page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:'开始',exact:true}).click();await expect(dialog).toBeVisible({timeout:90000});
 await dialog.getByRole('button',{name:'关闭',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(origin+'/today');
 await page.reload();await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=0,values[1]=seed,values):original(values);},seed);await page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:'开始',exact:true}).click();await expect(dialog).toBeVisible({timeout:90000});
await expect(dialog.locator('.task-detail-credits')).toBeVisible();
 assert(await dialog.evaluate(el=>el.querySelector('.primary').compareDocumentPosition(el.querySelector('.task-detail-credits')) & Node.DOCUMENT_POSITION_FOLLOWING));
 await dialog.locator('button[data-mode=practice]').click();
 await expect(page.locator('.learning-grid + .source')).toBeVisible();
 await page.goBack();await expect(page).toHaveURL(origin+'/today');await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();await page.goForward();await expect(page.locator('.learning-grid + .source')).toBeVisible();
 await page.locator('.learning-grid + .source').scrollIntoViewIfNeeded();
 assert(await page.evaluate(()=>document.querySelector('.source').getBoundingClientRect().top-document.querySelector('.learning-grid').getBoundingClientRect().bottom<=24));
 assert(await page.evaluate(()=>document.querySelector('.source').getBoundingClientRect().bottom <= document.querySelector('.question-panel').getBoundingClientRect().top));
 const session=(await rows('sessions'))[0];assert.equal(session.lesson.materials[0].rootId,root);const material=session.lesson.materials[0],question=material.questions[0];assert.equal(question.kind??'choice',kind);if(workplace)assert(bank.records.some(source=>source.passages.slice(1).some(passage=>passage.text===material.blocks[0].text&&passage.startingPoints.join(',')==='A2')));
 await expect(page.locator('.lead')).toContainText(session.lesson.goal['zh-Hans']);await expect(page.locator('.teaching')).toContainText(session.lesson.workedExample['zh-Hans']);assert(phone?session.lesson.workedExample['zh-Hans'].includes('work number'):address?session.lesson.workedExample['zh-Hans'].includes('please call me'):session.lesson.workedExample['zh-Hans'].startsWith('示例：'));
 await page.locator('.teaching p').last().scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/${screenshot}-detail-375-light-zh-Hans-offline.png`});
 const quotes=[...session.lesson.workedExample['zh-Hans'].matchAll(/“([^”]+)”/g)].map(m=>m[1]);if(!address&&!phone)assert(material.blocks[0].text.includes(quotes[question.kind==='completion'?2:0]));if(question.kind==='completion'){assert.equal(quotes[0].replace(/_+/g,quotes[1]),quotes[2]);assert(!quotes[2].toLowerCase().includes(question.answer.toLowerCase()));}for(const row of question.kind==='matching'?question.pairs:question.kind==='table'?question.rows:[]){assert(!session.lesson.workedExample['zh-Hans'].includes(row.label));if(question.kind==='table')assert(!session.lesson.workedExample['zh-Hans'].includes(row.answer));}
 await page.locator('.question-sheet-toggle').click();await page.waitForFunction(()=>Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.question-panel')).transform).m42)<1);
 if(address||phone)await page.getByRole('radio',{name:question.options[question.answer],exact:true}).check();else if(question.kind==='completion')await page.locator('.completion-answer input').fill(question.answer);else if(question.kind==='sequence'){for(const step of question.acceptedOrders[0])await page.locator('.sequence-choices button').filter({hasText:step}).click();}else if(question.kind==='table'){for(const [index,row]of question.rows.entries())await page.locator('.answer-table input').nth(index).fill(row.answer);}else for(const pair of question.pairs){await page.getByRole('button',{name:pair.label,exact:true}).click();await page.getByRole('listbox',{name:pair.label,exact:true}).getByRole('option',{name:pair.answer,exact:true}).click();}
 for(const width of [1440,1200,1024,768,375,320]) {
  await page.setViewportSize({width,height:812});
  const toggle=page.locator('.question-sheet-toggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const control of await page.locator('.sequence-choices button,.matching-answers button,.answer-table input,.completion-answer input,.option').all()) {
   const bounds=await control.boundingBox();assert(bounds&&bounds.width>=44&&bounds.height>=44);
  }
 }
 for(const height of [480,360]) {
  await page.setViewportSize({width:375,height});
  for(const control of await page.locator('.sequence-choices button,.matching-answers button,.answer-table input,.completion-answer input,.option').all()) {
   await control.scrollIntoViewIfNeeded();const bounds=await control.boundingBox();assert(bounds&&bounds.y>=0&&bounds.y+bounds.height<=height+1);
  }
 }
 await page.setViewportSize({width:375,height:812});
 await page.screenshot({path:`output/playwright/${screenshot}-inputs-375-light-zh-Hans-offline.png`});
 await page.getByRole('button',{name:'保存答案',exact:true}).click();await expect(page.locator('.feedback')).toContainText('回答正确');
 await context.setOffline(true);await page.reload();await expect(page.locator('.feedback')).toContainText('回答正确');assert.equal((await rows('attempts')).length,1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`output/playwright/${screenshot}-375-light-zh-Hans-offline.png`});
 if(process.argv.includes('--reselect')) {
  const before=(await rows('sessions')).find(item=>item.id===session.id),savedBefore=await rows('attempts');
  await page.goto(origin+'/today');const practice=page.locator('.corpus-practice[data-skill=reading]');await expect(practice.getByRole('button',{name:'继续',exact:true})).toBeVisible();
  for(const width of [1440,1200,768,375,320]){await page.setViewportSize({width,height:812});const control=practice.getByRole('button',{name:'重来',exact:true});await expect(control).toBeVisible();const box=await control.boundingBox(),left=await practice.getByRole('button',{name:'继续',exact:true}).boundingBox();assert(box.width>=44&&box.height>=44);assert(Math.abs(left.y-box.y)<1&&Math.abs(left.width-box.width)<1&&Math.abs(left.height-box.height)<1&&left.x+left.width<box.x);assert(await practice.locator('.practice-actions button').evaluateAll(buttons=>{const styles=buttons.map(button=>getComputedStyle(button));return ['backgroundColor','color','borderRadius','fontSize','fontWeight'].every(key=>styles[0][key]===styles[1][key]);}));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.setViewportSize({width:375,height:812});await practice.screenshot({path:'output/playwright/practice-reselect-reading-375-light-zh-Hans-offline.png'});
  await practice.getByRole('button',{name:'重来',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();assert.equal((await rows('sessions')).length,1);assert.deepEqual(await rows('attempts'),savedBefore);
  await practice.getByRole('button',{name:'重来',exact:true}).click();await page.getByRole('dialog').locator('button[data-mode=practice]').click();await expect(page.locator('.passage')).toBeVisible();const all=await rows('sessions');assert.equal(all.length,2);const fresh=all.find(item=>item.id!==session.id);assert.notEqual(fresh.lesson.id,session.lesson.id);assert(fresh.lesson.materials.every(material=>!session.lesson.materials.some(old=>old.id===material.id)));const kept=all.find(item=>item.id===session.id);for(const field of ['lesson','contentHash','status','position','draft'])assert.deepEqual(kept[field],before[field]);assert.deepEqual(await rows('attempts'),savedBefore);
  await page.goto(origin+'/today');await page.locator('.records-link').click();await page.locator(`.history a[href="/learn/${session.id}"]`).click();await expect(page.locator('.feedback')).toContainText('回答正确');
 }
 for(const [locale,label,correct] of [['zh-Hant','语言','回答正確'],['en','語言','Correct'],['zh-Hans','Language','回答正确']]) {
  await page.goto(origin+'/settings');await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('listbox',{name:label,exact:true}).locator(`[data-value="${locale}"]`).click();await expect(page.getByRole('button',{name:locale==='en'?'Language':locale==='zh-Hant'?'語言':'语言',exact:true})).toBeVisible();
  if(address){await page.goto(origin+'/library/dictionary');await page.getByRole('combobox').fill('call me');await page.getByRole('option',{name:'call me',exact:true}).click();await expect(page.getByText('With a name after it, asks someone to use that name for you. It can also ask someone to phone you.',{exact:true})).toBeVisible();assert.equal((await rows('attempts')).length,1);}
  await page.goto(origin+'/learn/'+session.id);await expect(page.locator('.lead')).toContainText(session.lesson.goal[locale]);await expect(page.locator('.teaching')).toContainText(session.lesson.workedExample[locale]);await expect(page.locator('.feedback')).toContainText(correct);
  await page.setViewportSize({width:320,height:640});await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const control of await page.locator('.sequence-choices button,.matching-answers button,.option').all()) {const bounds=await control.boundingBox();assert(bounds&&bounds.width>=44&&bounds.height>=44);}
  await page.screenshot({path:`output/playwright/${screenshot}-320-light-${locale}-200pct-offline.png`});if(process.argv.includes('--reselect')){await page.goto(origin+'/today');await expect(page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:locale==='en'?'Restart':locale==='zh-Hant'?'重來':'重来',exact:true})).toBeVisible();await page.goto(origin+'/learn/'+session.id);}await page.evaluate(()=>document.documentElement.style.fontSize='');assert.equal((await rows('attempts')).length,1);
 }
 await page.goto(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();assert.deepEqual(errors,[]);console.log(`PASS: actual Library download, client-generated ${point} ${kind}, ${phone?'localized phone method without answer preview':address?'localized request method without answer preview and three-language offline call me lookup':'unused exact-source localized example'}, correct scoring/save/offline reopen,six widths, short-screen control reachability and Today; no authored exercise import.`);
 if(process.argv.includes('--reselect'))console.log('PASS: reselection preview/cancel/new start retains old session/answer, actual History recovery, three-language entry and five-width44px targets.');
}finally{await context.close();await browser.close();}
