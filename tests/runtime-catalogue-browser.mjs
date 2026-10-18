import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
const origin='http://127.0.0.1:8787',catalogue=JSON.parse(readFileSync('public/resources/catalogue.json'));
const target=catalogue.sources.packs.find(p=>p.skill==='listening'&&p.sourceFamilies.includes('gutenberg'));
const initial=structuredClone(catalogue);initial.sources.packs=initial.sources.packs.filter(p=>p.id!==target.id);
let live=initial;const errors=[],requests=[],layouts=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'reduce'}),page=await context.newPage();
const route=async p=>{p.on('pageerror',e=>errors.push(e.message));await p.route('**/resources/catalogue.json',r=>r.fulfill({json:live}));p.on('request',r=>requests.push(r.url()));};
const sha=b=>createHash('sha256').update(b).digest('hex');
const rows=async p=>p.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('lingfern');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,request=db.transaction('communityPacks').objectStore('communityPacks').getAll();request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>reject(request.error);};}));
try{
 await route(page);await page.goto(origin+'/library');await expect(page.locator('.package-row')).toHaveCount(75);
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active);
 await page.reload();await expect(page.locator('.package-row')).toHaveCount(75);
 assert.equal((await rows(page)).length,0);
 const script=await page.locator('script[type=module][src]').getAttribute('src'),scriptBefore=sha(await (await fetch(origin+script)).arrayBuffer().then(b=>new Uint8Array(b)));
 live=catalogue;await page.goto(origin+'/today');await page.goto(origin+'/library');await expect(page.locator('.package-row')).toHaveCount(76);
 const row=page.locator('.package-row').filter({hasText:target.title['zh-Hans']});await expect(row).toHaveCount(1);await expect(row).toContainText(`${target.clips.toLocaleString()} 段`);await expect(row).toContainText('解压后');
 assert.equal(sha(new Uint8Array(await (await fetch(origin+script)).arrayBuffer())),scriptBefore);
 await row.locator('input').check();await page.getByRole('button',{name:'下载所选资源',exact:true}).click();await expect(row).toContainText('已安装',{timeout:90000});
 assert((await rows(page)).some(p=>p.hash===target.sha256&&p.state==='ready'));
 await row.locator('input').check();const downloading=page.waitForEvent('download');await page.locator('.resource-pack-links a').click();const download=await downloading;const zip='/tmp/lingfern-runtime-catalogue.zip';await download.saveAs(zip);assert.equal(sha(readFileSync(zip)),target.sha256);
 const second=await browser.newContext({viewport:{width:375,height:812},locale:'zh-CN',reducedMotion:'reduce'}),importer=await second.newPage();await route(importer);await importer.goto(origin+'/library');await expect(importer.locator('.package-row')).toHaveCount(76);await importer.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active);await importer.reload();await expect(importer.locator('.package-row')).toHaveCount(76);
 await second.setOffline(true);await importer.locator('.community-import input[type=file]').setInputFiles(zip);await expect(importer.locator('.community-import')).toContainText('资源已安装。',{timeout:90000});
 const installed=await rows(importer);assert.equal(installed.length,1);assert.equal(installed[0].hash,target.sha256);assert.equal(installed[0].state,'ready');
 const clip=installed[0].spoken.records[0].clips[0];const audio=await importer.evaluate(async clip=>{const response=await fetch(clip.audio.src),bytes=await response.arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');const range=await fetch(clip.audio.src,{headers:{Range:'bytes=0-63'}});return {status:response.status,digest,range:range.status,rangeBytes:(await range.arrayBuffer()).byteLength};},clip);assert.equal(audio.status,200);assert.equal(audio.digest,clip.audio.sha256);assert.equal(audio.range,206);assert.equal(audio.rangeBytes,64);
 await importer.goto(origin+'/today');await expect(importer.getByRole('heading',{name:'今日',exact:true})).toBeVisible();await expect(importer.locator('.notice').filter({hasText:/^离线$/})).toBeVisible();
 await second.setOffline(false);
 for(const locale of ['zh-Hans','zh-Hant','en'])for(const theme of ['light','dark'])for(const width of [320,375,1440]){
  await importer.goto(origin+'/settings');const language=importer.locator('.settings-preferences .setting-trigger').nth(0);await language.click();await importer.locator(`[role=option][data-value="${locale}"]`).click();await expect(language).toHaveAttribute('data-value',locale);
  const appearance=importer.locator('.settings-preferences .setting-trigger').nth(1);await appearance.click();await importer.locator(`[role=option][data-value="${theme}"]`).click();await expect(appearance).toHaveAttribute('data-value',theme);
  await importer.setViewportSize({width,height:900});await importer.goto(origin+'/library');await expect(importer.locator('.package-row')).toHaveCount(76);assert(await importer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const geometry=await importer.locator('.package-row').evaluateAll(rows=>rows.map(r=>{const b=r.getBoundingClientRect();return {height:b.height,left:b.left,right:b.right};}));assert(geometry.every(b=>b.height>=44&&b.left>=-1&&b.right<=width+1));layouts.push({locale,theme,width});
 }
 assert.deepEqual(errors,[]);console.log('PASS: data-only catalogue addition, unchanged JS, actual ZIP download, offline ZIP import/hash/Range and Today; 18 UI contexts.');
 writeFileSync('private/verification/i140-runtime-catalogue-browser.json',JSON.stringify({checkedAt:new Date().toISOString(),target,initialRows:75,newRows:76,unchangedScript:{script,sha256:scriptBefore},offlineImport:true,audio,layouts,errors,requests},null,2));await second.close();
}finally{await browser.close();}
