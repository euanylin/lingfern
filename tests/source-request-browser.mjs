import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const dependence = process.argv.includes('--dependence');
const dependencePrompt = 'In the paired statement, match each reliance to what needs it.';
const sourceIds = ['wikipedia-reading-008', 'wikipedia-reading-017'];
const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8'));
const digest = text => createHash('sha256').update(text).digest('hex');
const expectedSources = [{ rootId: 'wikipedia-article-9228', passageId: '3aa87fe6472ecddd65ad7e1f19ae44535fad3c6171604282ced63550231b3c9e', sourceHash: '4c2951c9734f8c7f93cca86d6d6eb8d20dced544c34bafcacf15316bae84e67f', originalHash: 'a6eaa292705a9d8246afe5a7a3211575ccbd3a8f199612adc4177f0f448d8732', textHash: '3ca26b581aa826199f84a7c42f043d039b4760ad0c3597466e442795c9ace4bd', words: 247, sentenceStart: 961, sentenceEnd: 1107, sourceStart: 46918, sentence: 'The land-based ecosystem depends upon topsoil and fresh water, and the oceanic ecosystem depends on dissolved nutrients washed down from the land.' }, { rootId: 'wikipedia-article-46203885', passageId: 'd1460f5ff5f38bfcf5938487bc71d77a77b22cdf05fd3a9e7b1446b233eb817a', sourceHash: '6b23af6b276cb35d8ac1401e2d5b05a5c14fee04f3f5ddbc91bde8258f2b9f57', originalHash: '3f0ef371bda838775c7622c8a66ad2c0d45cebef54b8fdadac25307ca0055928', textHash: '43fd589b2abf535be4e14007a0eda51221371fd69b5b7ce057f3567c92b3a949', words: 274, sentenceStart: 330, sentenceEnd: 530, sourceStart: 790, sentence: 'As designed, the Defuser cannot look at the manual and must rely on the Experts to instruct them; similarly, the Experts cannot see the bomb, and must rely on the Defuser to describe the bomb to them.' }];
const roles = process.argv.includes('--roles'), viewpoints = process.argv.includes('--viewpoints'), family = viewpoints ? 'viewpoints' : roles ? 'role' : 'request';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false}});
let practiceSeed, expectedLesson, relianceOperation, corpusOperation;
try {
 const core=await server.ssrLoadModule('/src/core/corpus.ts');
 if(dependence) { const practice=await server.ssrLoadModule('/src/core/corpusPractice.ts'); relianceOperation=practice.pairedRelianceOperation; corpusOperation=practice.corpusOperation; }
 const {inspectCommunityPack}=await server.ssrLoadModule('/src/data/communityPack.ts');
 const {reviewedReading}=await server.ssrLoadModule('/src/data/corpus.ts');
 const installed=[];
 if (dependence) for (const entry of catalogue.packs.filter(pack => sourceIds.includes(pack.id)).sort((a,b)=>a.sha256.localeCompare(b.sha256))) { const bytes=readFileSync('public'+entry.path); assert.equal(digest(bytes),entry.sha256); installed.push(...(await inspectCommunityPack(bytes)).corpus.records); }
 const bank=(await inspectCommunityPack(readFileSync(`tests/fixtures/source-packs/wikipedia-reading-${viewpoints?'003':'017'}.zip`))).corpus;
 const merged=await reviewedReading([...['voa','gutenberg'].flatMap(source=>JSON.parse(readFileSync('public/corpus/'+source+'.json','utf8')).records), ...(dependence?installed:bank.records)],300);
 const records=[...new Map(merged.map(record=>[record.rootId,record])).values()];
 if(dependence) for(const expected of expectedSources) { const source=records.find(source=>source.rootId===expected.rootId); assert(source); assert.equal(source.sourceHash,expected.sourceHash); assert.equal(digest(source.originalText),expected.originalHash); const passage=source.passages.find(passage=>passage.id===expected.passageId); assert(passage); assert.equal(digest(passage.text),expected.textHash); assert.equal(passage.wordCount,expected.words); assert.equal(source.originalText.slice(expected.sourceStart,expected.sourceStart+passage.text.length),passage.text); assert.equal(passage.text.slice(expected.sentenceStart,expected.sentenceEnd),expected.sentence); }
 const pool=records.flatMap(source=>source.passages).filter(p=>!p.startingPoints&&p.wordCount<=300&&(p.task||core.corpusRestoration(p.text,0,p.language)||core.corpusSequence(p.text,0)||core.corpusQualification(p.text,0)||core.corpusAttribution(p.text,0)||core.corpusDates(p.text,0)||core.corpusRequests(p.text,0)||core.corpusRoleActions(p.text,0)||core.corpusAttributionPairs(p.text,0)||core.corpusEvaluation(p.text,0)||core.corpusCondition(p.text,0)||core.corpusAssignment(p.text,0)||core.corpusConcession(p.text,0)||core.corpusActionSelection(p.text,0)||core.corpusQualifiedCause(p.text,0)));
 const targetRoot=viewpoints?'wikipedia-article-1620586':roles?'wikipedia-article-46203885':'wikipedia-article-18362';
 const phase=dependence?7:viewpoints?1:roles?7:6;
 for(const [index,p] of pool.entries()) {
  if(!(viewpoints?core.corpusAttributionPairs(p.text,0):dependence||roles?core.corpusRoleActions(p.text,0):core.corpusRequests(p.text,0)))continue;
  const seed=phase*pool.length+index, lesson=core.corpusLesson({version:1,failures:[],records},new Set(),seed,300,'B2');
  const prompt=lesson?.materials[0].questions[0].prompt;
  if(dependence ? lesson?.materials.every(material=>material.questions[0].prompt===dependencePrompt&&expectedSources.some(expected=>expected.rootId===material.rootId&&material.id==='corpus-'+expected.passageId)) : prompt&&lesson.materials.some(material=>material.rootId===targetRoot)&&(viewpoints?prompt===core.attributionMatchingPrompt:roles?prompt.startsWith('In the paired statement'):prompt.startsWith('Match each action'))){practiceSeed=seed;expectedLesson=lesson;break;}
 }
 assert.notEqual(practiceSeed,undefined,'Normal default generation must reach the requested semantic operation');
}finally{await server.close();}
const origin = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(), downloads = [];
await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
page.on('response', response => { if (response.url().includes('/source-packs/')) downloads.push(response.url()); });
async function rows(table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, request = db.transaction(table).objectStore(table).getAll(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
  }), table);
}
async function answer(question) {
  if (question.kind === 'completion') await page.locator('.completion-answer input').fill(question.answer);
  else if (question.kind === 'table') for (const [i, row] of question.rows.entries()) await page.locator('.answer-table input').nth(i).fill(row.answer);
  else if (question.kind === 'matching') for (const pair of question.pairs) { await page.getByRole('button', { name: pair.label, exact: true }).click(); await page.getByRole('option', { name: pair.answer, exact: true }).click(); }
  else if (question.kind === 'sequence') for (const step of question.acceptedOrders[0]) await page.locator('.sequence-choices button').filter({ hasText: step }).click();
  else if (question.kind === 'evidence') await page.locator('input[name=answer]').nth(question.accepted[0]).check();
  else if (question.kind === 'response') await page.locator('.response-answer textarea').fill('The passage gives an instruction. I would support my interpretation with its exact wording.');
  else throw Error('Unexpected task');
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback')).toBeVisible();
}
async function openSheet() {
 await expect(page.locator('.question-panel')).toBeVisible();
 const toggle=page.locator('.question-sheet-toggle');
 if(await toggle.isVisible() && await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
}
async function runDependence() {
 await page.goto(origin+'/library');
 await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated');
 await page.reload();
 const resource=page.locator('.package-row').filter({hasText:'阅读语料'});
 await resource.getByRole('checkbox').check(); await page.getByRole('button',{name:'下载所选资源',exact:true}).click(); await expect(resource).toContainText('已安装',{timeout:90000});
 await page.goto(origin+'/start'); for(let step=0;step<3;step++) await page.getByRole('button',{name:'跳过这一步',exact:true}).click();
 for(const skill of ['听力','阅读']) await page.getByRole('group',{name:skill,exact:true}).getByLabel(/^B2 ·/).check();
 await page.getByRole('button',{name:'保存并继续',exact:true}).click(); await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();
 const installed=new Set();
 for(const id of sourceIds) {
  const available=catalogue.packs.filter(pack=>pack.skill==='reading'&&!installed.has(pack.id)&&pack.minWords!==null&&pack.minWords<=300);
  const packSeed=available.findIndex(pack=>pack.id===id); assert(packSeed>=0);
  await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=seed,values[1]=0,values):original(values);},packSeed);
  await page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:'开始',exact:true}).click(); await expect(page.getByRole('dialog')).toBeVisible({timeout:90000});
  assert(downloads.some(url=>url.endsWith('/'+id+'.zip'))); await page.getByRole('dialog').getByRole('button',{name:'关闭详情',exact:true}).click(); installed.add(id);
 }
 await context.setOffline(true); await page.reload();
 await page.evaluate(seed=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===2?(values[0]=0,values[1]=seed,values):original(values);},practiceSeed);
 await page.locator('.corpus-practice[data-skill=reading]').getByRole('button',{name:'开始',exact:true}).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('dialog').locator('[data-mode=practice]').click();
 const session=(await rows('sessions'))[0]; assert.equal(session.lesson.generation.seed,practiceSeed); assert.equal(session.lesson.generation.startingPoint,'B2'); assert(!session.lesson.mode);
 assert.deepEqual(session.lesson.materials.map(material=>material.rootId).sort(),expectedSources.map(source=>source.rootId).sort());
 for(const material of session.lesson.materials) {
  const expected=expectedSources.find(source=>source.rootId===material.rootId); assert.equal(material.id,'corpus-'+expected.passageId); assert.equal(digest(material.blocks[0].text),expected.textHash); assert.equal(material.questions.length,2);
  const question=material.questions[0]; assert.equal(question.kind,'matching'); assert.equal(question.prompt,dependencePrompt); assert.equal(corpusOperation(question),relianceOperation); assert.equal(question.pairs.length,2); if(material.rootId==='wikipedia-article-9228') assert.deepEqual([...question.pairs].sort((a,b)=>a.label.localeCompare(b.label)),[{label:'topsoil and fresh water',answer:'land-based ecosystem'},{label:'dissolved nutrients washed down from the land',answer:'oceanic ecosystem'}].sort((a,b)=>a.label.localeCompare(b.label))); assert.equal(material.blocks[0].text.slice(question.evidence.start,question.evidence.end),expected.sentence); assert.equal(material.questions[1].kind,'response');
 }
 const questions=session.lesson.materials.flatMap(material=>material.questions);
 console.log('ACTUAL_DEPENDENCE_SESSION',JSON.stringify({seed:practiceSeed,generation:session.lesson.generation,materials:session.lesson.materials.map(material=>({rootId:material.rootId,textHash:digest(material.blocks[0].text),pairs:material.questions[0].pairs,evidence:material.blocks[0].text.slice(material.questions[0].evidence.start,material.questions[0].evidence.end)}))}));
 for(const locale of ['zh-Hans','zh-Hant','en']) for(const theme of ['light','dark']) {
  await page.goto(origin+'/settings'); await page.getByRole('button',{name:/^(语言|語言|Language)$/}).click(); await page.getByRole('listbox').locator(`[data-value="${locale}"]`).click(); await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await page.getByRole('button',{name:/^(外观|外觀|Appearance)$/}).click(); await page.getByRole('listbox').locator(`[data-value="${theme}"]`).click(); await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await page.goto(origin+'/learn/'+session.id); await openSheet();
  for(const width of [1440,1200,1024,768,375,320]) {
   await page.setViewportSize({width,height:812}); await openSheet(); const panel=page.locator('.question-panel'); await panel.evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
   const bounds=await panel.boundingBox(); assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=width+1); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const button of await page.locator('.matching-answers button').all()) {const box=await button.boundingBox();assert(box&&box.width>=44&&box.height>=44);assert(await button.evaluate(element=>element.scrollWidth<=element.clientWidth));}
   if([1440,320].includes(width)) await page.screenshot({path:`output/playwright/dependence-matching-${width}-${theme}-${locale}-offline.png`});
  }
 }
 await page.goto(origin+'/settings'); await page.getByRole('button',{name:'Language',exact:true}).click(); await page.getByRole('listbox').locator('[data-value="zh-Hans"]').click(); await expect(page.locator('html')).toHaveAttribute('lang','zh-Hans'); await page.getByRole('button',{name:'外观',exact:true}).click();await page.getByRole('listbox').locator('[data-value="light"]').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.goto(origin+'/learn/'+session.id); await openSheet();
 for(const height of [480,360]) {await page.setViewportSize({width:375,height});await openSheet();const panel=page.locator('.question-panel');await panel.evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));const bounds=await panel.boundingBox();assert(bounds&&bounds.y>=-1&&bounds.y+bounds.height<=height+1);}
 await page.setViewportSize({width:375,height:812});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(const button of await page.locator('.matching-answers button').all())assert(await button.evaluate(element=>element.scrollWidth<=element.clientWidth));await page.evaluate(()=>{document.documentElement.style.fontSize='';});
 for(const [index,question] of questions.entries()) {
  if(index) {await page.getByRole('button',{name:'下一题',exact:true}).click();await expect(page.locator('.feedback')).toHaveCount(0);await expect(page.locator('#learning-question form h2')).toHaveText(question.prompt);await openSheet();}
  if(index===2) {for(const pair of question.pairs){await page.getByRole('button',{name:pair.label,exact:true}).click();await page.getByRole('option',{name:question.choices.find(choice=>choice!==pair.answer),exact:true}).click();}await page.getByRole('button',{name:'保存答案',exact:true}).click();}
  else if(question.kind==='response') {const material=session.lesson.materials[Math.floor(index/2)];const primary=material.questions[0];const quote=material.blocks[0].text.slice(primary.evidence.start,primary.evidence.end);await page.locator('.response-answer textarea').fill(`The passage links each reliance to what needs it: “${quote}”. I preserve both relationships and their limits.`);await page.getByRole('button',{name:'保存答案',exact:true}).click();}
  else await answer(question);
  await expect(page.locator('.feedback')).toContainText(index===0?'回答正确':index===2?'再看一看':'未自动评分');
  if(question.kind==='matching') {const material=session.lesson.materials[Math.floor(index/2)];await expect(page.locator('.feedback')).toContainText(material.blocks[0].text.slice(question.evidence.start,question.evidence.end));}
  await page.reload();await openSheet();assert.equal((await rows('attempts')).length,index+1);
  if(index===0) {await page.goto(origin+'/today');await page.locator('.corpus-practice[data-skill=reading]').getByRole('button').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').locator('[data-mode=practice]').click();await expect(page).toHaveURL(origin+'/learn/'+session.id);await openSheet();assert.equal((await rows('sessions')).length,1);}
 }
 const attempts=await rows('attempts');assert.equal(attempts.filter(attempt=>attempt.correct===true).length,1);assert.equal(attempts.filter(attempt=>attempt.correct===false).length,1);assert.equal(attempts.filter(attempt=>attempt.correct===null).length,2);assert.equal((await rows('sessions'))[0].status,'completed');
 await page.keyboard.press('Escape');const credit=page.locator('.source');await expect(credit).toContainText(session.lesson.materials.at(-1).credit.attribution);await expect(credit).toContainText(session.lesson.materials.at(-1).credit.license);assert(await page.locator('.learning-grid').evaluate(grid=>!!(grid.compareDocumentPosition(grid.nextElementSibling)&Node.DOCUMENT_POSITION_FOLLOWING)));await credit.scrollIntoViewIfNeeded();await expect(credit).toBeVisible();await page.screenshot({path:'output/playwright/dependence-source-375-light-zh-Hans-offline.png',fullPage:true});
 await page.goto(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 console.log('PASS: actual008/017/core reading downloads; default phase7 dependence seed; exact247/274word SHA windows and two roots; offline matching1correct1incorrect+2unscored responses, four save/reloads and Today resume; three locales/two themes/six widths/44px/short/200percent/sourcefooter. No authored lesson or focus injection; B2 effort starting point is not calibrated ability.');
}
try {
 if (dependence) await runDependence(); else {
  await page.goto(origin + '/library');
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated');
  await page.reload(); await page.goto(origin + '/start');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
  for (const skill of ['听力', '阅读']) await page.getByRole('group', { name: skill, exact: true }).getByLabel(/^B2 ·/).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
  // Download actual pack017 through the normal learner flow.
  await page.evaluate(({ packSeed, seed }) => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 2 ? (values[0] = packSeed, values[1] = seed, values) : original(values); }, { packSeed: viewpoints ? 2 : 16, seed: practiceSeed });
  await page.locator('.corpus-practice[data-skill=reading]').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 90000 });
  assert(downloads.some(url => url.endsWith(viewpoints ? '/wikipedia-reading-003.zip' : '/wikipedia-reading-017.zip')));
  await context.setOffline(true);
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const session = (await rows('sessions'))[0];
  assert.deepEqual(session.lesson.materials,expectedLesson.materials,'Native normal preparation must match actual merged SSR source/evidence/scoring');
  console.log('ACTUAL_SESSION',JSON.stringify({expectedSeed:practiceSeed,generation:session.lesson.generation,materials:session.lesson.materials.map(material=>({rootId:material.rootId,prompt:material.questions[0].prompt}))}));
  assert.equal(new Set(session.lesson.materials.map(material => material.rootId)).size, 2);
  const taught = session.lesson.materials[0].questions[0];
  if (['completion', 'sequence'].includes(taught.kind)) assert.equal(session.lesson.materials[1].questions[0].kind, taught.kind);
  const questions = session.lesson.materials.flatMap(material => material.questions);
  const targetRoot=viewpoints?'wikipedia-article-1620586':roles?'wikipedia-article-46203885':'wikipedia-article-18362';
  const target = questions.findIndex(question => session.lesson.materials.some(material=>material.rootId===targetRoot&&material.questions.some(candidate=>candidate.id===question.id))&&(viewpoints ? question.kind === 'response' && question.prompt.startsWith('Compare the statements attributed') : question.id.endsWith(`-${family}`)));
  assert(target >= 0, 'Actual downloaded source did not generate the request task');
  for (let i = 0; i < target; i++) { await answer(questions[i]); await page.getByRole('button', { name: '下一题', exact: true }).click(); }
  const controls = page.locator(viewpoints ? '.response-answer' : '.matching-answers');
  await expect(controls).toBeVisible();
  await expect(page.locator('#learning-question h2')).toContainText(viewpoints ? 'Compare the statements attributed' : roles ? 'match each reliance' : 'what the request asks for or rules out');
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    const toggle = page.locator('.question-sheet-toggle');
    if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    await expect(controls).toBeVisible();
    const panel = page.locator('.question-panel');
    await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const bounds = await panel.boundingBox();
    assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Answer card extends outside the viewport');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
    if ([1440, 320].includes(width)) await page.screenshot({ path: `output/playwright/${family}-matching-${width}-light-zh-Hans-offline.png` });
  }
  if (viewpoints) {
    for (const height of [640, 480]) {
      await page.setViewportSize({ width: 375, height });
      const bounds = await page.locator('.question-panel').boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 375 && bounds.y >= -1 && bounds.y + bounds.height <= height + 1);
      await page.locator('.response-answer textarea').scrollIntoViewIfNeeded();
      await expect(page.locator('.response-answer textarea')).toBeVisible();
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) >= 32);
    await page.locator('.response-answer textarea').scrollIntoViewIfNeeded();
    assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
    const bounds = await page.locator('.question-panel').boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 375);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await answer(questions[target]);
  await expect(page.locator('.feedback')).toContainText(viewpoints ? '未自动评分' : '回答正确');
  await expect(page.locator('.feedback')).toContainText(viewpoints ? 'According to' : roles ? 'Defuser cannot look at the manual' : 'Please always refer to our bricks');
  const saved = (await rows('attempts')).find(row => row.questionId === questions[target].id);
  assert(saved.correct === (viewpoints ? null : true) && saved.rootId === (viewpoints ? 'wikipedia-article-1620586' : roles ? 'wikipedia-article-46203885' : 'wikipedia-article-18362'));
  if (viewpoints) {
    await expect(page.locator('.feedback blockquote')).toHaveCount(2);
    const criteria = page.locator('.self-assessment fieldset');
    await expect(criteria).toHaveCount(3);
    for (const [index, label] of ['Included', 'Needs revision', 'Unsure'].entries()) await criteria.nth(index).getByRole('radio', { name: label, exact: true }).check();
    await page.getByRole('button', { name: 'Save self-assessment', exact: true }).click();
    await expect(page.getByText('Self-assessment saved.', { exact: true })).toBeVisible();
    const assessed = (await rows('attempts')).find(row => row.questionId === questions[target].id);
    assert.deepEqual(assessed.selfAssessment, ['met', 'revise', 'unsure']);
    assert.equal(assessed.correct, null);
  }
  await page.screenshot({ path: `output/playwright/${family}-matching-375-light-zh-Hans-offline.png` });
  await page.reload(); await expect(page.locator('.feedback')).toContainText(viewpoints ? '未自动评分' : '回答正确');
  if (viewpoints) await expect(page.locator('.self-assessment input:checked')).toHaveCount(3);
  assert.equal((await rows('attempts')).filter(row => row.questionId === questions[target].id).length, 1);
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  console.log(`PASS: actual source download; local ${family}${viewpoints ? ' open comparison' : ' matching'} on an unfamiliar root; offline response/scoring/save/reload and six widths1440/1200/1024/768/375/320. No authored lesson import.`);
 }
} finally { await browser.close(); }
