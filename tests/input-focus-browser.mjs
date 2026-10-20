import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:8787/start');
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'跳过这一步',exact:true}).click();
 await page.getByRole('button',{name:'保存并继续',exact:true}).click();
 await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();
 const checks=[];
 for(const locale of ['zh-Hans','zh-Hant','en']) {
  await page.goto('http://127.0.0.1:8787/settings');
  await page.locator('.settings-preferences .setting-trigger').first().click();
  await page.locator(`[role=option][data-value="${locale}"]`).click();
  for(const [route,selectors] of [
   ['dictionary',['.dictionary-search input','.completion-answer input','.answer-table input','.response-answer textarea','.ai-import textarea']],
   ['grammar',['.reference-search input']],
  ]) {
   await page.goto(`http://127.0.0.1:8787/library/${route}`);
   await expect(page.locator(selectors[0])).toBeVisible();
   // Isolated presentation fixtures check other callers of the shared text-focus selector.
   if(route==='dictionary') await page.locator('main').evaluate(main=>main.insertAdjacentHTML('beforeend','<section id="focus-fixtures"><label class="completion-answer">Completion<input></label><div class="answer-table"><label>Table<input></label></div><label class="response-answer">Response<textarea></textarea></label><div class="ai-import"><label>Import<textarea></textarea></label></div></section>'));
   for(const theme of ['light','dark'])for(const width of [1440,375,320])for(const height of [900,480]) {
    await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.emulateMedia({reducedMotion:height===480?'reduce':'no-preference'});
    for(const selector of selectors) {
     const field=page.locator(selector);await field.evaluate(el=>el.blur());
     const before=await field.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
     await field.focus();await expect(field).toBeFocused();
     const after=await field.evaluate(el=>{const s=getComputedStyle(el);return {width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,outline:s.outlineStyle,border:s.borderTopWidth,shadow:s.boxShadow,transform:s.transform};});
     assert.equal(after.width,before.width);assert.equal(after.height,before.height);assert.equal(after.outline,'none');assert.equal(after.border,'1px');assert.equal(after.shadow,'none');assert.equal(after.transform,'none');
     if(width<768) {
      const nav=await page.locator('.mobile-nav').evaluate(el=>({position:getComputedStyle(el).position,height:el.getBoundingClientRect().height,pseudoHeight:parseFloat(getComputedStyle(el,'::before').height)}));
      assert.equal(nav.position,'relative');assert(Math.abs(nav.height-nav.pseudoHeight)<2,'Navigation backdrop must stay inside navigation, not cover the viewport');
      await field.evaluate(el=>el.blur());
      const resting=await page.locator('.mobile-nav').evaluate(el=>({position:getComputedStyle(el).position,height:el.getBoundingClientRect().height,pseudoHeight:parseFloat(getComputedStyle(el,'::before').height)}));
      assert.equal(resting.position,height<=560?'relative':'fixed');assert(Math.abs(resting.height-resting.pseudoHeight)<2);
      await field.focus();
     }
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     checks.push({route,selector,locale,theme,width,height,reducedMotion:height===480});
    }
    await page.locator(selectors[0]).focus();
    if(width===375)await page.screenshot({path:`output/playwright/input-focus-${route}-${width}x${height}-${theme}-${locale}.png`});
   }
  }
 }
 await page.goto('http://127.0.0.1:8787/settings');
 await page.locator('.settings-preferences .setting-trigger').first().click();await page.locator('[role=option][data-value="zh-Hans"]').click();
 const sw=await page.request.get('http://127.0.0.1:8787/sw.js');assert.equal(sw.status(),200);assert(/javascript/.test(sw.headers()['content-type']));
 writeFileSync('private/verification/input-focus-20261011.json',JSON.stringify({passed:true,checks,scope:'Actual dictionary and grammar inputs plus isolated presentation fixtures for four shared text-entry callers; no real learner data',sw:'JavaScript 200',untested:['Physical software keyboard','Safari/iOS','Screen reader']},null,2)+'\n');
 await page.goto('http://127.0.0.1:8787/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
 console.log(`PASS: ${checks.length} focus checks; dictionary/grammar and shared fields; three locales, themes, desktop/narrow/short, confined backdrop, Service Worker and Today.`);
} finally {await browser.close();}
