import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
const interests=process.argv.includes('--interests')?['science']:[];
const multi=process.env.LINGFERN_SPOKEN_FAMILY==='condition-multi';
const postposed=process.env.LINGFERN_SPOKEN_FAMILY==='condition-postposed';
let multiBackup;
const focusedFallback=process.env.LINGFERN_FOCUS_FALLBACK==='1';
const origin='http://127.0.0.1:8787';
const condition=multi||postposed||process.env.LINGFERN_SPOKEN_FAMILY==='condition';
const attribution=process.env.LINGFERN_SPOKEN_FAMILY==='attribution';
const table=process.env.LINGFERN_SPOKEN_FAMILY==='table';
const matching=process.env.LINGFERN_SPOKEN_FAMILY==='matching';
const sequence=process.env.LINGFERN_SPOKEN_FAMILY==='sequence';
const family=matching?'matching':multi?'condition-multi':postposed?'condition-postposed':condition?'condition':sequence?'sequence':table?'table':attribution?'attribution':'qualification';
const packId=matching?'wikipedia-listening-009':postposed?'wikipedia-listening-005':condition?'wikipedia-listening-010':table?'wikipedia-listening-015':'wikipedia-listening-001';
const catalogue=JSON.parse(await readFile('content/source-packs.json'));
let packSeed=catalogue.packs.filter(pack=>pack.skill==='listening'&&pack.minSeconds!==null&&pack.minSeconds<=60).findIndex(pack=>pack.id===packId);
assert(packSeed>=0);
// Derive deterministic normal-entry seeds from current packages, not temporary fixtures.
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false}});
let selection;
try {
 const {inspectCommunityPack}=await server.ssrLoadModule('/src/data/communityPack.ts');
 const {spokenCorpusLesson}=await server.ssrLoadModule('/src/core/spokenCorpus.ts');
 const corpus=(await inspectCommunityPack(await readFile('public/source-packs/'+packId+'.zip'))).spoken;
 const applications=multi?[(await inspectCommunityPack(await readFile('tests/fixtures/source-packs/wikipedia-listening-005.zip'))).spoken]:[];
 for(let seed=0;seed<300;seed++) {
  const lesson=spokenCorpusLesson(corpus,new Set(),seed,focusedFallback?91:60,focusedFallback?'C2':'B2',interests,undefined,[],undefined,applications);
  if(lesson&&(matching?lesson.materials.every(material=>material.questions[0].kind==='matching'):postposed?lesson.materials.every(material=>material.questions[0].prompt.includes('uses “if” or “unless”')):condition?lesson.materials[0].questions[0].prompt.includes('uses “if” or “unless”'):sequence?lesson.materials.every(material=>material.questions[0].kind==='sequence'):table?lesson.materials.every(material=>material.questions[0].kind==='table'):attribution
   ?lesson.materials[0].questions[0].kind==='evidence'&&lesson.materials[0].questions[0].prompt.includes('attributes')&&lesson.materials[1].questions[0].kind==='completion'
   :lesson.materials.every(material=>material.questions[0].kind==='evidence'&&material.questions[0].prompt.includes('inference')))) {
   const duration=lesson.materials.reduce((sum,material)=>sum+material.audio.duration,0);
   if(!selection||duration<selection.duration)selection={seed,duration,roots:lesson.materials.map(material=>material.rootId)};
  }
 }
 assert(selection,attribution?'Current package must support named-source evidence with an honest unrelated-operation fallback':'Current package must support two distinct qualification recordings through normal entry');
} finally {await server.close();}
const browser=await chromium.launch({channel:'chrome',headless:true});
let context=await browser.newContext({locale:'zh-CN',viewport:{width:375,height:812}}),page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
const rows=table=>page.evaluate(table=>new Promise((resolve,reject)=>{const open=indexedDB.open('lingfern');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,q=db.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}),table);
async function expand(){await expect(page.locator('.listening-layout .question-panel')).toHaveCSS('position','static');await expect(page.locator('.question-sheet-toggle')).toBeHidden();await expect(page.locator('.question-sheet-scrim')).toHaveCount(0);}
try {
 await page.goto(origin+'/start');for(let step=0;step<(interests.length?2:3);step++)await page.getByRole('button',{name:'跳过这一步',exact:true}).click();if(interests.length){await page.getByLabel('科学',{exact:true}).check();await page.getByRole('button',{name:'保存并继续',exact:true}).click();}
 await page.getByRole('group',{name:'听力',exact:true}).getByLabel(focusedFallback?/^C2 ·/:/^B2 ·/).check();await page.getByRole('button',{name:'保存并继续',exact:true}).click();await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();
 await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated');await page.reload();await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 if(multi){await page.goto(origin+'/library');await page.getByLabel('导入 ZIP').setInputFiles('tests/fixtures/source-packs/wikipedia-listening-005.zip');await expect(page.locator('.community-import').getByRole('status').filter({hasText:'资源已安装'})).toBeVisible({timeout:90000});await page.goto(origin+'/today');packSeed=catalogue.packs.filter(pack=>pack.skill==='listening'&&pack.minSeconds!==null&&pack.minSeconds<=60&&pack.id!=='wikipedia-listening-005').findIndex(pack=>pack.id===packId);}
 await page.evaluate(({seed,packSeed})=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=packSeed,values[1]=seed,values):original(values);},{seed:selection.seed,packSeed});
 await page.locator('.corpus-practice[data-skill=listening]').getByRole('button',{name:'开始',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible({timeout:90000});await dialog.locator('button[data-mode=practice]').click();
 await page.waitForURL(/\/learn\//);
 const session=(await rows('sessions'))[0];assert.deepEqual(session.lesson.materials.map(material=>material.rootId),selection.roots);
 if(multi){assert(session.lesson.materials.every(material=>material.questions[0].prompt.includes('uses “if” or “unless”')));assert(session.lesson.materials[1].communityPackageId);assert.notEqual(session.lesson.materials[1].communityPackageId,session.lesson.communityPackageId);}
 if(matching) assert(session.lesson.materials.every(material=>material.questions[0].kind==='matching'));
 else if(postposed) {assert(session.lesson.materials.every(material=>material.questions[0].prompt.includes('uses “if” or “unless”')));assert.deepEqual(session.lesson.materials.map(material=>material.title).sort(),['Colocation centre','Cookie Clicker']);}
 else if(condition) assert.match(session.lesson.materials[0].questions[0].prompt,/uses “if” or “unless”/);
 else if(sequence) assert(session.lesson.materials.every(material=>material.questions[0].kind==='sequence'));
 else if(table) assert(session.lesson.materials.every(material=>material.questions[0].kind==='table'));
 else if(attribution) {
  assert.match(session.lesson.materials[0].questions[0].prompt,/attributes/);
  assert.equal(session.lesson.materials[1].questions[0].kind,'completion');
 }else assert(session.lesson.materials.every(material=>material.questions[0].kind==='evidence'&&material.questions[0].prompt.includes('inference')));
 await context.setOffline(true);

 const questions=session.lesson.materials.flatMap(material=>material.questions.map(question=>({material,question})));
 for(const [index,{material,question}]of questions.entries()) {
  if(question.kind!=='response') {
  console.log('Playing question',index);
  if(index===0) {
   const slider=page.getByRole('slider',{name:'播放进度',exact:true});await expect(slider).toBeEnabled();assert.equal((await page.locator('.audio-play').textContent()).trim(),'');const playBounds=await page.locator('.audio-play').boundingBox();assert(playBounds.width>=44&&playBounds.height>=44);
   await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.1);
   await page.getByRole('button',{name:'暂停',exact:true}).click();
   const track=await slider.boundingBox();assert(track);await page.mouse.move(track.x+track.width*.2,track.y+track.height/2);await page.mouse.down();await page.mouse.move(track.x+track.width*.6,track.y+track.height/2,{steps:5});await page.mouse.up();assert(await page.locator('audio').evaluate(audio=>audio.currentTime>audio.duration*.4));
   await slider.focus();await slider.press('End');await slider.press('ArrowLeft');await slider.press('ArrowLeft');
   const sought=await page.locator('audio').evaluate(audio=>({time:audio.currentTime,duration:audio.duration}));assert(sought.time>sought.duration-1);
   await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio').ended);
   await expect(page.getByRole('status').filter({hasText:'录音已播放'})).toHaveCount(0);assert(!(await rows('sessions'))[0].assistance.audioCompleted);
   await slider.press('Home');assert(await page.locator('audio').evaluate(audio=>audio.currentTime<.1));
   for(const width of [1440,1200,1024,768,375,320]) {await page.setViewportSize({width,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await slider.boundingBox();assert(bounds&&bounds.height>=44&&bounds.width>=44);}
   for(const width of [1440,375]) {await page.setViewportSize({width,height:812});await page.emulateMedia({colorScheme:'dark'});await page.locator('.audio-player').scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/modern-player-${width}-dark-zh-Hans-offline.png`,animations:'disabled'});}await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width:375,height:812});
  }

  await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();
  try { await page.waitForFunction(()=>document.querySelector('audio')?.currentTime>0,undefined,{timeout:10000}); } catch(error) { console.log(await page.locator('audio').evaluate(audio=>({src:audio.currentSrc,paused:audio.paused,time:audio.currentTime,ready:audio.readyState,error:audio.error?.code})));console.log((await rows('sessions')).map(session=>({position:session.position,assistance:session.assistance})));throw error; }
  await expect(page.getByRole('status').filter({hasText:'录音已播放'})).toBeVisible({timeout:60000});
  }
  await expand();
  if(question.kind==='evidence')await page.locator('.evidence-option input').nth(focusedFallback&&index===2?(question.accepted[0]+1)%3:question.accepted[0]).check();
  else if(question.kind==='completion')await page.locator('.completion-answer input').fill(question.answer);
  else if(question.kind==='sequence') {
   for(const width of [1440,1200,1024,768,375,320]) {
    await page.setViewportSize({width,height:812});await expand();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const button of await page.locator('.sequence-choices button').all()) {
     const bounds=await button.boundingBox();assert(bounds&&bounds.width>=44&&bounds.height>=44);
    }
   }
   for(const height of [480,360]) {
    await page.setViewportSize({width:375,height});await expand();
    for(const button of await page.locator('.sequence-choices button').all()) {
     await button.scrollIntoViewIfNeeded();const bounds=await button.boundingBox();assert(bounds&&bounds.y>=0&&bounds.y+bounds.height<=height+1);
    }
   }
   await page.setViewportSize({width:375,height:812});await expand();
   for(const step of question.acceptedOrders[0])await page.getByRole('button',{name:`添加步骤: ${step}`,exact:true}).click();
   await page.screenshot({path:`output/playwright/spoken-sequence-order-${index}-375-light-zh-Hans-offline.png`,animations:'disabled'});
  }
  else if(question.kind==='matching') {
   for(const width of [1440,1200,1024,768,375,320]) {
    await page.setViewportSize({width,height:812});await expand();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const control of await page.locator('.matching-answers .setting-trigger').all()) {const bounds=await control.boundingBox();assert(bounds&&bounds.width>=44&&bounds.height>=44);}
   }
   for(const height of [480,360]) {
    await page.setViewportSize({width:375,height});await expand();
    for(const control of await page.locator('.matching-answers .setting-trigger').all()) {await control.scrollIntoViewIfNeeded();const bounds=await control.boundingBox();assert(bounds&&bounds.y>=0&&bounds.y+bounds.height<=height+1);}
   }
   await page.setViewportSize({width:375,height:812});await expand();
   for(const pair of question.pairs) {await page.getByRole('button',{name:pair.label,exact:true}).click();await page.getByRole('listbox',{name:pair.label,exact:true}).getByRole('option',{name:pair.answer,exact:true}).click();}
   await page.screenshot({path:`output/playwright/spoken-matching-fields-${index}-375-light-zh-Hans-offline.png`,animations:'disabled'});
  }
  else if(question.kind==='table') {
   for(const width of [1440,1200,1024,768,375,320]) {
    await page.setViewportSize({width,height:812});await expand();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await page.locator('.answer-table').evaluate(element=>element.scrollWidth<=element.clientWidth));
    for(const input of await page.locator('.answer-table input').all()) {const bounds=await input.boundingBox();assert(bounds&&bounds.width>=44&&bounds.height>=44);assert.equal(await input.getAttribute('inputmode'),'numeric');}
    if([1440,320].includes(width))await page.screenshot({path:`output/playwright/spoken-table-fields-${index}-${width}-light-zh-Hans-offline.png`,animations:'disabled'});
   }
   for(const height of [480,360]) {
    await page.setViewportSize({width:375,height});await expand();
    await page.locator('.question-panel').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    const panel=await page.locator('.question-panel').boundingBox();assert(panel&&panel.x>=-1&&panel.x+panel.width<=376);
    for(const input of await page.locator('.answer-table input').all()) {
     await input.scrollIntoViewIfNeeded();const bounds=await input.boundingBox();
     assert(bounds&&bounds.width>=44&&bounds.height>=44&&bounds.y>=-1&&bounds.y+bounds.height<=height+1);
    }
    const save=page.getByRole('button',{name:'保存答案',exact:true});await save.scrollIntoViewIfNeeded();
    const button=await save.boundingBox();assert(button&&button.width>=44&&button.height>=44&&button.y>=-1&&button.y+button.height<=height+1);
   }
   await page.setViewportSize({width:375,height:812});await expand();
   await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('.answer-table').evaluate(element=>element.scrollWidth<=element.clientWidth));
   await page.evaluate(()=>{document.documentElement.style.fontSize='';});
   for(const [row,value] of question.rows.entries()) await page.locator('.answer-table input').nth(row).fill(index===2&&row===0?'9999':value.answer);
  }
  else {
   if(material.questions[0].kind==='table') {assert.match(question.prompt,/do not infer a cause/);assert.equal(question.criteria.length,3);}
   if(material.questions[0].kind==='evidence') {
    assert.match(question.prompt,condition ? material.questions[0].kind==='evidence' ? /condition and outcome/ : /Summarize/ : attribution?/time or numerical limits/:/inference, possibility or belief/);
    assert.equal(question.criteria.length,3);
   }
   await expect(page.locator('.question-panel')).toContainText(question.prompt);
   for(const width of [1440,1200,1024,768,375,320]) {
    await page.setViewportSize({width,height:812});await expand();
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    assert(await page.locator('.response-answer').evaluate(element=>element.scrollWidth<=element.clientWidth));
   }
   for(const height of [480,360]) {
    await page.setViewportSize({width:375,height});await expand();
    await page.locator('.question-panel').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    const bounds=await page.locator('.question-panel').boundingBox();assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=376);
    await page.getByRole('button',{name:'保存答案',exact:true}).scrollIntoViewIfNeeded();
    const button=await page.getByRole('button',{name:'保存答案',exact:true}).boundingBox();assert(button&&button.width>=44&&button.height>=44);
   }
   await page.setViewportSize({width:375,height:812});await expand();
   await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
   assert(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))>=32);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('.response-answer').evaluate(element=>element.scrollWidth<=element.clientWidth));
   await page.evaluate(()=>{document.documentElement.style.fontSize='';});
   await page.locator('.question-sheet-content').evaluate(element=>{element.scrollTop=0;});
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   const promptBounds=await page.locator('#learning-question h2').boundingBox();
   const contentBounds=await page.locator('.question-sheet-content').boundingBox();
   assert(promptBounds&&contentBounds&&promptBounds.y>=contentBounds.y-1&&promptBounds.x>=contentBounds.x-1&&promptBounds.x+promptBounds.width<=contentBounds.x+contentBounds.width+1);
   await page.screenshot({path:`output/playwright/spoken-${family}-prompt-${index}-375-light-zh-Hans-offline.png`,animations:'disabled'});
   // Check post-resize compositing separately from fresh offline recovery.
   await page.evaluate(()=>new Promise(resolve=>{let frames=8;const tick=()=>--frames?requestAnimationFrame(tick):resolve();requestAnimationFrame(tick);}));
   await page.screenshot({path:`output/playwright/spoken-${family}-prompt-${index}-settled-375-light-zh-Hans-offline.png`,animations:'disabled'});
   await page.reload();await expand();
   await page.locator('.question-sheet-content').evaluate(element=>{element.scrollTop=0;});
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   await expect(page.locator('#learning-question h2')).toHaveText(question.prompt);
   await page.screenshot({path:`output/playwright/spoken-${family}-prompt-${index}-reloaded-375-light-zh-Hans-offline.png`,animations:'disabled'});
   await page.locator('.response-answer textarea').fill(table
    ?`The recording states “${material.blocks[0].text}”. I retain each event and all timing limits; date order alone does not establish a cause. Different historical or planned situations must stay distinct. The statements provide the evidence for each recorded year.`
    :attribution&&material.questions[0].kind==='evidence'
    ?`The recording attributes to Atlantic Records “${material.blocks[0].text.slice(material.questions[0].evidence.start,material.questions[0].evidence.end)}”. The claim concerns worldwide solo sales over 100 million as of 2002; attribution does not independently verify it or make it the narrator’s personal opinion.`
    :`The recording includes “${material.blocks[0].text.slice(material.questions[0].evidence.start,material.questions[0].evidence.end)}”. I retain the claim’s context and distinguish the recorded words from my interpretation.`);
  }
  await page.getByRole('button',{name:'保存答案',exact:true}).click();await expect(page.locator('.feedback')).toContainText(question.kind!=='response'?((table||focusedFallback)&&index===2?'再看一看':'回答正确'):'已保存');
  if(question.kind==='response') {
   assert.equal((await rows('attempts')).find(attempt=>attempt.questionId===question.id).correct,null);
   await page.reload();await expect(page.locator('.feedback')).toContainText('已保存');await expand();
   assert.equal((await rows('attempts')).filter(attempt=>attempt.sessionId===session.id).length,index+1);
   await page.setViewportSize({width:375,height:812});
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   await page.screenshot({path:`output/playwright/spoken-${family}-interpretation-${index}-375-light-zh-Hans-offline.png`,animations:'disabled'});
  }
  if(question.kind==='evidence') {
   for(const width of [1440,1200,1024,768,375,320]){await page.setViewportSize({width,height:900});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);const bounds=await page.locator('.question-panel').boundingBox();assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=width+1);}
   await page.setViewportSize({width:375,height:812});await expand();
   assert.equal(await page.locator('header').count(),1);
   assert.match(await page.locator('header').evaluate(header=>getComputedStyle(header,'::before').backdropFilter),/blur\(16px\)/);
   await expect(page.locator('.question-sheet-scrim')).toHaveCount(0);
   const header=await page.locator('header').boundingBox();assert(header&&header.y===0&&header.height<=72);
   // Layout may settle before the previous compositor frame completes.
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   await page.screenshot({path:`output/playwright/spoken-${family}-evidence-${index}-375-light-zh-Hans-offline.png`,animations:'disabled'});
   await page.reload();await expect(page.locator('.feedback')).toContainText(focusedFallback&&index===2?'再看一看':'回答正确');await expand();
   assert.equal((await rows('attempts')).filter(attempt=>attempt.sessionId===session.id).length,index+1);
   await expect(page.locator('.question-panel')).toHaveAttribute('data-open','true');
   assert.match(await page.locator('header').evaluate(header=>getComputedStyle(header,'::before').backdropFilter),/blur\(16px\)/);
   await expand();
  }
  if(multi&&index===0){
   await page.goto(origin+'/settings');const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载备份'}).click();multiBackup=await readFile(await(await download).path());
   await page.goto(origin+'/learn/'+session.id);await expect(page.locator('.feedback')).toContainText('回答正确');await expand();
  }
  if(index<questions.length-1)await page.getByRole('button',{name:'下一题',exact:true}).click();
 }
 const attempts=await rows('attempts');assert.equal(attempts.length,4);assert.equal(attempts.filter(attempt=>attempt.correct===true).length,table||focusedFallback?1:2);assert.equal(attempts.filter(attempt=>attempt.correct===null).length,2);assert.equal(attempts.filter(attempt=>attempt.correct===false).length,table||focusedFallback?1:0);
 for(const {question} of questions) { const attempt=attempts.find(attempt=>attempt.questionId===question.id);assert(attempt);assert.equal(attempt.assistance.audioCompleted,true);assert.equal(attempt.assistance.playbackRequests,question.kind!=='response'?(question.id===questions[0].question.id?3:1):0); }
 await page.getByRole('link',{name:'返回今日',exact:true}).click();await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();assert.deepEqual(errors,[]);
 if(multi){
  await context.close();context=await browser.newContext({locale:'zh-CN',viewport:{width:375,height:812},colorScheme:'light'});page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await page.goto(origin+'/settings');const chooser=page.waitForEvent('filechooser');await page.locator('.backup-file-button').click();await(await chooser).setFiles({name:'multi-source.zip',mimeType:'application/zip',buffer:multiBackup});
  await expect(page.locator('.backup-preview')).toContainText('任务 1 · 作答 1');await page.getByRole('button',{name:'导入为新档案'}).click();await expect(page.getByRole('status').filter({hasText:'已建立新档案并导入记录。'})).toBeVisible();
  const restored=(await rows('sessions'))[0];assert.deepEqual(restored.lesson,session.lesson);assert.equal((await rows('communityPacks')).length,0);
  await page.goto(origin+'/learn/'+restored.id);await expect(page.locator('.feedback')).toContainText('回答正确');
  for(const [materialIndex,material]of restored.lesson.materials.entries()){
   const hash=material.communityPackageId??restored.lesson.communityPackageId,entry=catalogue.packs.find(pack=>pack.sha256===hash);assert(entry);
   await context.setOffline(false);await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();const repair=page.getByRole('button',{name:'恢复音频',exact:true});await expect(repair).toBeEnabled();
   const savedCount=(await rows('attempts')).length;
   await page.route('**'+entry.path,route=>route.fulfill({status:404,body:'Not found'}));await repair.click();await expect(page.getByText('恢复失败，请重试。',{exact:true})).toBeVisible();assert.equal((await rows('attempts')).length,savedCount);await page.unroute('**'+entry.path);
   const corrupt=Buffer.from(await readFile('public'+entry.path));corrupt[0]^=1;await page.route('**'+entry.path,route=>route.fulfill({status:200,contentType:'application/zip',body:corrupt}));await repair.click();await expect(repair).toHaveAttribute('aria-busy','false');await expect(page.getByText('恢复失败，请重试。',{exact:true})).toBeVisible();assert.equal((await rows('attempts')).length,savedCount);await page.unroute('**'+entry.path);
   await repair.click();await expect(repair).toHaveCount(0,{timeout:90000});assert((await rows('communityPacks')).some(pack=>pack.hash===hash&&pack.profileId===restored.profileId));
   await context.setOffline(true);await page.reload();await page.locator('audio').evaluate(audio=>audio.playbackRate=4);await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'播放 / 重听',exact:true})).toBeVisible({timeout:60000});await expand();
   if(materialIndex===1){const q=material.questions[0];await page.locator('.evidence-option input').nth(q.accepted[0]).check();await page.getByRole('button',{name:'保存答案',exact:true}).click();await expect(page.locator('.feedback')).toContainText('回答正确');}
   await page.getByRole('button',{name:'下一题',exact:true}).click();await expand();await page.locator('.response-answer textarea').fill('The condition and outcome remain linked. I keep other stated requirements and quote the complete statement: '+material.blocks[0].text);
   await page.getByRole('button',{name:'保存答案',exact:true}).click();await expect(page.locator('.feedback')).toContainText('已保存');if(materialIndex===0)await page.getByRole('button',{name:'下一题',exact:true}).click();
  }
  assert.deepEqual((await rows('sessions'))[0].lesson,session.lesson);assert.equal((await rows('attempts')).length,4);assert.equal(new Set((await rows('attempts')).map(attempt=>attempt.id)).size,4);
  await page.goto(origin+'/library');const toggle=page.getByRole('button',{name:/内容列表/});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await page.getByRole('checkbox',{name:/^听力 · 010/}).check();await page.getByRole('button',{name:'删除所选资源',exact:true}).click();await expect.poll(async()=>(await rows('communityPacks')).some(pack=>pack.id==='wikipedia-listening-010')).toBe(false);assert((await rows('communityPacks')).some(pack=>pack.id==='wikipedia-listening-005'));assert.equal((await rows('attempts')).length,4);
  await page.goto(origin+'/learn/'+restored.id);await page.locator('audio').evaluate(audio=>audio.playbackRate=4);await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'播放 / 重听',exact:true})).toBeVisible({timeout:60000});await page.screenshot({path:'output/playwright/multi-source-restored-375-light-zh-Hans-offline.png'});await page.goto(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();assert.deepEqual(errors,[]);
  console.log('PASS: two immutable source packages; same conditional operation on distinct roots; fresh-profile actual backup, independent404/corrupt repairs and offline playback for both owners; deleting010 preserves005 and all four saved answers.');
 }
 if(focusedFallback) {
  await context.setOffline(false);
  const installed=new Set((await rows('communityPacks')).map(pack=>pack.id));
  const remaining=catalogue.packs.filter(pack=>pack.skill==='listening'&&pack.minSeconds!==null&&pack.minSeconds<=60&&!installed.has(pack.id));
  const newPack=remaining.findIndex(pack=>pack.id==='wikipedia-listening-005');assert(newPack>=0);
  await page.evaluate(({packSeed,seed})=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=packSeed,values[1]=seed,values):original(values);},{packSeed:newPack,seed:selection.seed});
  await page.locator('.corpus-practice[data-skill=listening]').getByRole('button',{name:'开始',exact:true}).click();
  const retry=page.getByRole('dialog');await expect(retry).toBeVisible({timeout:90000});
  await retry.locator('button[data-mode=practice]').click();
  const created=(await rows('sessions')).find(item=>item.id!==session.id);assert(created);
  assert.match(created.lesson.materials[0].questions[0].prompt,/inference/);
  assert.equal(created.lesson.communityPackageId,session.lesson.communityPackageId);
  assert((await rows('communityPacks')).some(pack=>pack.id==='wikipedia-listening-005'));
  assert(!session.lesson.materials.some(old=>created.lesson.materials.some(next=>next.id===old.id)));
  console.log('PASS: new unrelated source package installed; retry retains the installed exact qualification operation and unseen clips.');
  await page.goto(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 }
 console.log(`PASS: ${family}; normal first listening-pack download and client semantic generation; ${multi?'two conditional roots in distinct immutable packages':postposed?'two conditional roots, including a postposed condition':condition?'one condition root with unrelated-operation fallback (not transfer)':attribution?'one attribution root with unrelated-operation fallback (not transfer)':'two distinct same-operation recording roots'}; two actual offline complete playbacks; contextual unscored responses; four transactional saves/reloads without duplicates; six-width evidence/response bounds, short screens,200% text,44px save and Today.`);
}catch(error){console.log('Failure URL',page.url());console.log('Page errors',errors);console.log(await page.locator('body').innerText());await page.screenshot({path:'output/playwright/spoken-evidence-failure.png'});throw error;}finally{await context.close();await browser.close();}
