import {readFile} from 'node:fs/promises';
import {zipSync} from 'fflate';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const resources=JSON.parse(await readFile('content/resource-packs.json'));
const grammar=resources.packs.find(pack=>pack.id==='grammar');
const lesson=JSON.parse(await readFile('tests/fixtures/content/a1-reading.json'));
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
const files={'lessons.json':encode([lesson]),'sources.json':encode([{id:lesson.sourceId,title:'Private UI regression',author:'Test fixture',license:'Private test use',attribution:'Isolated test fixture'}])};
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const manifest={format:'lingfern-community-content',version:1,id:'ui-import-test',language:'en',levels:['A1'],materialCount:lesson.materials.length,files:Object.fromEntries(await Promise.all(Object.entries(files).map(async([name,bytes])=>[name,{bytes:bytes.length,sha256:await sha(bytes)}])))};
const custom=Buffer.from(zipSync({...files,'manifest.json':encode(manifest)}));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:375,height:812}}),page=await context.newPage();
 await page.goto('http://127.0.0.1:8787/library');
 await expect(page.getByRole('heading',{name:'资源导入',exact:true})).toBeVisible();
 await expect(page.locator('.library-page input[type=file]')).toHaveCount(1);
 await page.getByLabel('导入 ZIP',{exact:true}).setInputFiles([{name:'grammar.zip',mimeType:'application/zip',buffer:await readFile('public'+grammar.path)},{name:'private.zip',mimeType:'application/zip',buffer:custom}]);
 await expect(page.locator('.community-import [role=status]')).toHaveText('资源已安装。');
 await expect(page.locator('.package-row').filter({hasText:'英语用法词典'})).toContainText('已安装');
 const installed=page.locator('.installed-resources');
 await expect(installed).not.toHaveAttribute('open');
 assert(await installed.evaluate(element=>element.previousElementSibling?.classList.contains('offline-install')&&element.nextElementSibling?.classList.contains('community-import')));
 assert(await page.locator('.community-import').evaluate(element=>element===document.querySelector('.library-page').lastElementChild));
 await expect(installed).not.toContainText('英语用法词典');
 for(const width of [1440,1200,1024,768,375,320]){await page.setViewportSize({width,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await installed.locator(':scope > summary').click();
 await expect(installed).toContainText('ui-import-test');
 await page.getByLabel('导入 ZIP',{exact:true}).setInputFiles({name:'invalid.zip',mimeType:'application/zip',buffer:Buffer.from('invalid')});
 await expect(page.locator('.community-import [role=status]')).toContainText('资源包无效');
 await expect(installed).toContainText('ui-import-test');
 await page.reload();await expect(installed).not.toHaveAttribute('open');
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
 for(const width of [1440,375,320]) {
  await page.setViewportSize({width,height:812});
  await expect(page.getByRole('searchbox',{name:'搜索内容'})).toBeVisible();
  const offlineBounds=await page.locator('.offline-install').boundingBox(),installedBounds=await installed.boundingBox();
  assert(installedBounds.y-offlineBounds.y-offlineBounds.height<=48,'Installed list follows offline content without reserved scroll gap');
  await expect(page.locator('.footer-wordmark')).toHaveCount(0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===375)await page.screenshot({path:'output/playwright/library-spacing-375-dark-zh-Hans-collapsed.png',animations:'disabled'});

 }
 await context.setOffline(true);await page.goto('http://127.0.0.1:8787/library/grammar');
 await expect(page.locator('.grammar-results details').first()).toBeVisible();
 await page.goto('http://127.0.0.1:8787/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 console.log('PASS: one ZIP input; mixed official/private install; immediate offline-list status; installed list between offline content and final import/collapsed/reopen; bad ZIP preserves packages; six widths; always-visible search, installed-list spacing and footer separation; installed grammar offline; Today. Isolated private regression fixture only.');
}finally{await browser.close();}
