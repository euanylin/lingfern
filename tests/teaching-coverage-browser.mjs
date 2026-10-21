import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {unzipSync} from 'fflate';
import 'fake-indexeddb/auto';
import {chromium,expect} from '@playwright/test';

const origin='http://127.0.0.1:8787',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const semanticReading=process.argv.includes('--semantic-reading'),shortReading=process.argv.includes('--short-reading'),focusedReading=shortReading||semanticReading;
const inputPath=semanticReading?'private/corpus/teaching-semantic-coverage-2026-10-13.json':shortReading?'private/corpus/teaching-coverage-2026-10-13.json':'private/corpus/teaching-coverage-2026-10-12.json',input=JSON.parse(fs.readFileSync(inputPath));
for(const item of input.generatorHashes)assert.equal(sha(fs.readFileSync(item.path)),item.sha256);
const catalogue=JSON.parse(fs.readFileSync('content/source-packs.json'));
const readingPacks=focusedReading?catalogue.packs.filter(pack=>pack.skill==='reading').map(pack=>{const bytes=fs.readFileSync('public'+pack.path);assert.equal(sha(bytes),pack.sha256);return {pack,bank:JSON.parse(new TextDecoder().decode(unzipSync(bytes,{filter:file=>file.name==='corpus.json'})['corpus.json']))};}):[];
const plans=(semanticReading?[['reading','reliance','B1',0],['reading','cause','B1',1]]:shortReading?[['reading','action','B1',1],['reading','request','B1',1],['reading','attributionMatching','B1',0],['reading','assignment','B1',0]]:[['reading','table','B2',1],['reading','sequence','B2',1],['reading','completion','B2',1],['listening','spokenMatching','B2',1],['listening','outcome','B2',1],['listening','attribution','B2',1]]).map(([skill,name,level,condition])=>{
 const row=input.rows.find(row=>row.level===level&&row.skill===skill&&row.condition===condition);
 const lesson=row.operations.find(operation=>operation.name===name).sample.lesson;
 assert(lesson.materials.length===2);const installs=readingPacks.filter(({bank})=>lesson.materials.some(material=>bank.records.some(source=>source.rootId===material.rootId&&source.passages.some(passage=>passage.text.includes(material.blocks[0].text))))).map(({pack})=>pack);if(focusedReading)assert(installs.length>0);return {skill,name,lesson,installs};
});
const report={startedAt:new Date().toISOString(),scope:'Actual source-generated focused two-root snapshots from the current coverage audit, isolated Chrome profiles. Layout/support, offline saved-answer recovery and generated Test restrictions; not normal random-entry reachability, audio audition, physical devices or CEFR qualification.',auditSha256:sha(fs.readFileSync(inputPath)),matrix:[],runs:[],failures:[]};
const reportPath=semanticReading?'private/verification/semantic-reading-browser-20261013.json':shortReading?'private/verification/short-reading-browser-20261013.json':'private/verification/teaching-coverage-browser-20261012.json',save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');save();
const ssr=await createServer({server:{middlewareMode:true,hmr:false,ws:false}});
const files=new Map();
const cacheApi={has:async name=>files.has(name),open:async name=>({match:async path=>files.get(name)?.get(path)?.clone()})};
globalThis.window={caches:cacheApi};globalThis.caches=cacheApi;
try{
 const {createSession,communityPacks}=await ssr.ssrLoadModule('/src/data/db.ts'),{asTestLesson}=await ssr.ssrLoadModule('/src/shared/content.ts'),{inspectCommunityPack}=await ssr.ssrLoadModule('/src/data/communityPack.ts'),{communityCacheName,communityMarker}=await ssr.ssrLoadModule('/src/data/communityInstall.ts');
 for(const plan of plans){
  if(plan.skill==='listening')for(const hash of new Set([plan.lesson.communityPackageId,...plan.lesson.materials.map(material=>material.communityPackageId)].filter(Boolean))){
   const entry=catalogue.packs.find(pack=>pack.sha256===hash);assert(entry);const bytes=fs.readFileSync('public'+entry.path),members=unzipSync(bytes),pack=await inspectCommunityPack(bytes);assert.equal(pack.hash,hash);
   await communityPacks.put({id:pack.id,hash,profileId:'local-guest',lessons:[],sources:pack.sources,spoken:pack.spoken,state:'ready',installedAt:new Date().toISOString()});
   const cached=new Map([[communityMarker(hash),new Response('ready')]]);
   for(const material of plan.lesson.materials)if((material.communityPackageId??plan.lesson.communityPackageId)===hash){const audio=members['media/'+material.audio.src.split('/').at(-1)];assert.equal(sha(audio),material.audio.sha256);cached.set(material.audio.src,new Response(audio,{headers:{'Content-Type':'audio/mpeg'}}));}
   files.set(communityCacheName(hash),cached);
  }
  plan.practice=await createSession(plan.lesson);plan.test=await createSession(asTestLesson(plan.lesson));
 }
}finally{delete globalThis.window;delete globalThis.caches;await ssr.close();}
const browser=await chromium.launch({channel:'chrome',headless:true});
const rows=(page,table)=>page.evaluate(table=>new Promise((resolve,reject)=>{const open=indexedDB.open('lingfern');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,q=db.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}),table);
async function play(page){await page.getByRole('button',{name:'播放 / 重听',exact:true}).click();await expect.poll(()=>page.locator('audio').evaluate(audio=>Number.isFinite(audio.duration)&&audio.duration>0)).toBe(true);await page.locator('audio').evaluate(audio=>{audio.muted=true;audio.playbackRate=16;});await expect(page.getByText('录音已播放，可以选择并保存。',{exact:true})).toBeVisible({timeout:30000});}
async function questionPane(page){const toggle=page.locator('.question-sheet-toggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();}
try{
 for(const plan of plans)for(const mode of ['practice','test']) {
  const session=plan[mode],context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const run={skill:plan.skill,name:plan.name,mode,lessonHash:session.contentHash,recoveredAnswers:0};report.runs.push(run);save();
  try{
   await page.goto(origin+'/library');await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated');await page.reload();
   if(focusedReading)for(const pack of plan.installs){await page.getByLabel('导入 ZIP',{exact:true}).setInputFiles('public'+pack.path);await expect(page.locator('.community-import [role=status]')).toHaveText('资源已安装。',{timeout:90000});}
   if(plan.skill==='listening')for(const hash of new Set([session.lesson.communityPackageId,...session.lesson.materials.map(material=>material.communityPackageId)].filter(Boolean))){const pack=catalogue.packs.find(pack=>pack.sha256===hash);assert(pack);await page.getByLabel('导入 ZIP',{exact:true}).setInputFiles('public'+pack.path);await expect(page.locator('.community-import [role=status]')).toHaveText('资源已安装。',{timeout:90000});}
   await page.evaluate(session=>new Promise((resolve,reject)=>{const request=indexedDB.open('lingfern');request.onsuccess=()=>{const db=request.result,tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').put(session);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);}),session);
   await page.goto(origin+'/learn/'+session.id);await expect(page.locator('#learning-question h2').first()).toHaveText(session.lesson.materials[0].questions[0].prompt);
   if(plan.skill==='listening')await play(page);
   if(mode==='practice')for(const locale of ['zh-Hans','zh-Hant','en'])for(const theme of ['light','dark'])for(const width of [375,1440])for(const reducedMotion of ['reduce','no-preference']){
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion});
    await page.goto(origin+'/settings');let control=page.locator('.settings-preferences .setting-trigger').nth(0);await control.click();await page.locator(`[role=option][data-value="${locale}"]`).click();await expect(control).toHaveAttribute('data-value',locale);control=page.locator('.settings-preferences .setting-trigger').nth(1);await control.click();await page.locator(`[role=option][data-value="${theme}"]`).click();await expect(control).toHaveAttribute('data-value',theme);
    await page.goto(origin+'/learn/'+session.id);await expect(page.locator('#learning-question h2').first()).toHaveText(session.lesson.materials[0].questions[0].prompt);
    const teaching=page.locator('.teaching');await expect(teaching).toBeVisible();if(await teaching.getAttribute('open')===null)await teaching.locator('summary').click();await expect(teaching.locator('p').last()).toHaveText(session.lesson.workedExample.en);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(focusedReading&&session.lesson.materials[0].questions[0].kind==='matching'){
     await questionPane(page);const trigger=page.locator('.matching-answers .setting-trigger').first();await trigger.click();const option=page.getByRole('option',{name:session.lesson.materials[0].questions[0].pairs[0].answer,exact:true});const bounds=await option.boundingBox();assert(bounds&&bounds.height>=44);if(locale==='zh-Hans'&&reducedMotion==='reduce'&&(theme==='light'&&width===1440||theme==='dark'&&width===375))await page.screenshot({path:`private/verification/short-reading-menu-${plan.name}-${width}-${theme}-20261013.png`,fullPage:true});await option.click();await trigger.click();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    }
    const stored=(await rows(page,'sessions')).find(row=>row.id===session.id);assert.deepEqual(stored.lesson,session.lesson);assert.equal(stored.contentHash,session.contentHash);
    report.matrix.push({name:plan.name,locale,theme,width,reducedMotion});save();
   }
   // Restore Chinese controls for full offline save/reload checks.
   await page.goto(origin+'/settings');let control=page.locator('.settings-preferences .setting-trigger').nth(0);await control.click();await page.locator('[role=option][data-value="zh-Hans"]').click();await expect(control).toHaveAttribute('data-value','zh-Hans');await page.goto(origin+'/learn/'+session.id);
   await context.setOffline(true);await page.reload();await expect(page.locator('#learning-question h2').first()).toHaveText(session.lesson.materials[0].questions[0].prompt);
   const questions=session.lesson.materials.flatMap(material=>material.questions);
   for(const [index,q] of questions.entries()){
    if(index)await page.getByRole('button',{name:'下一题',exact:true}).click();await expect(page.locator('#learning-question h2').first()).toHaveText(q.prompt);await questionPane(page);
    if(plan.skill==='listening'&&index===2)await play(page);
    if(mode==='test')await expect(page.locator('.teaching,.hint,.selection-dictionary,.ai-handoff,.self-assessment,.transcript')).toHaveCount(0);
    if(q.kind==='response')await page.locator('.response-answer textarea').fill('An interpretation supported by the source wording.');
    else if(q.kind==='table')for(const [index,row]of q.rows.entries())await page.locator('.answer-table input').nth(index).fill(row.answer);
    else if(q.kind==='sequence')for(const step of q.acceptedOrders[0])await page.getByRole('button',{name:'添加步骤: '+step,exact:true}).click();
    else if(q.kind==='completion')await page.locator('.completion-answer input').fill(q.answer);
    else if(q.kind==='matching')for(const [index,pair]of q.pairs.entries()){await page.locator('.matching-answers .setting-trigger').nth(index).click();await page.getByRole('option',{name:pair.answer,exact:true}).click();}
    else if(q.kind==='evidence')await page.locator('.option input').nth(q.accepted[0]).check();
    else await page.locator('.option input').nth(q.answer).check();
    await page.getByRole('button',{name:'保存答案',exact:true}).click();await expect(page.locator('.feedback')).toBeVisible();if(mode==='test')await expect(page.locator('.check-result')).toHaveCount(index===questions.length-1?questions.length:0);
    await page.reload();await questionPane(page);await expect(page.locator('.feedback')).toBeVisible();assert.equal((await rows(page,'attempts')).length,index+1);assert.deepEqual((await rows(page,'sessions'))[0].lesson,session.lesson);run.recoveredAnswers++;save();
   }
   const answers=await rows(page,'attempts');assert.equal(answers.filter(answer=>answer.correct===true).length,2);assert.equal(answers.filter(answer=>answer.correct===null).length,2);assert.equal((await rows(page,'sessions'))[0].status,'completed');assert.deepEqual(errors,[]);
   if(focusedReading){
    await context.setOffline(false);await page.goto(origin+'/settings');const pending=page.waitForEvent('download');await page.locator('.profile-backup').getByRole('button',{name:'下载备份',exact:true}).click();const download=await pending,backupPath=`private/verification/${semanticReading?'semantic':'short'}-reading-${plan.name}-${mode}-20261013.zip`;await download.saveAs(backupPath);
    const recovery=await browser.newContext(),restored=await recovery.newPage();try{
     await restored.goto(origin+'/settings');await restored.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated');await restored.reload();await expect(restored.locator('.profile-backup')).toBeVisible();await restored.waitForFunction(()=>!!navigator.serviceWorker.controller);await recovery.setOffline(true);
     await restored.locator('.profile-backup input[type=file]').setInputFiles(backupPath);await expect(restored.locator('.backup-preview')).toBeVisible();await restored.getByRole('button',{name:'导入为新档案',exact:true}).click();await expect(restored.getByText('已建立新档案并导入记录。',{exact:true})).toBeVisible();
     const recovered=(await rows(restored,'sessions')).find(row=>row.contentHash===session.contentHash);assert(recovered);assert.deepEqual(recovered.lesson,session.lesson);assert.equal(recovered.status,'completed');const recoveredAnswers=await rows(restored,'attempts');assert.equal(recoveredAnswers.length,answers.length);assert.deepEqual(recoveredAnswers.map(answer=>[answer.questionId,answer.rootId,answer.answer,answer.correct]),answers.map(answer=>[answer.questionId,answer.rootId,answer.answer,answer.correct]));run.backupRestoredAnswers=recoveredAnswers.length;
     await restored.reload();assert.equal((await rows(restored,'attempts')).length,answers.length);
    }finally{await recovery.close();}
    assert.deepEqual((await rows(page,'sessions'))[0].lesson,session.lesson);assert.deepEqual(await rows(page,'attempts'),answers);
   }
   run.passed=true;save();
  }catch(error){report.failures.push({name:plan.name,mode,error:error.message,state:await page.locator('main').innerText().catch(()=>''),pageErrors:errors});save();throw error;}finally{await context.close();}
 }
 const context=await browser.newContext(),page=await context.newPage();await page.goto(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();const sw=await page.request.get(origin+'/sw.js');assert.equal(sw.status(),200);assert.equal(sha(await sw.body()),sha(fs.readFileSync('dist/sw.js')));report.preview={heading:'今日',swSha256:sha(await sw.body())};await context.close();report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({passed:true,matrix:report.matrix.length,runs:report.runs.length,reportPath}));
}finally{await browser.close();}
