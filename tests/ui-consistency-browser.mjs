import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const root='src/app',files=(await readdir(root)).filter(name=>name.endsWith('.tsx'));
for(const file of files){const source=await readFile(`${root}/${file}`,'utf8');assert(!/<select\b/.test(source),`${file}: use SettingsPicker`);assert(!/style=\{\{[^}]*#[\da-f]{3,8}/i.test(source),`${file}: use colour tokens`);}
const origin='http://127.0.0.1:8787',browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
try{
 await page.goto(origin+'/start');for(let step=0;step<3;step++)await page.getByRole('button',{name:'跳过这一步',exact:true}).click();await page.getByRole('button',{name:'保存并继续',exact:true}).click();await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeAttached();
 const routes=['today','progress','library','library/dictionary','library/saved','library/ipa','library/grammar','settings','settings/about','start'];
 let views=0;
 for(const locale of ['zh-Hans','zh-Hant','en']){
  await page.goto(origin+'/settings');const language=page.locator('.settings-preferences .setting-trigger').first();await language.click();await page.locator(`.setting-menu [data-value="${locale}"]`).click();await expect(language).toHaveAttribute('data-value',locale);
  for(const theme of ['light','dark'])for(const width of [1440,375,320])for(const route of routes){
   await page.setViewportSize({width,height:812});await page.goto(`${origin}/${route}`);await expect(page.locator('main h1').first()).toBeAttached();await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route}/${locale}/${theme}/${width}: overflow`);
   assert.equal(await page.locator('main select').count(),0);
   const mobileNav=page.locator('.mobile-nav');
   if(width<768&&await mobileNav.isVisible()) {
    assert.equal(await mobileNav.evaluate(el=>getComputedStyle(el).contain),'paint');
    assert.equal(await mobileNav.evaluate(el=>getComputedStyle(el,'::before').zIndex),'0');
    assert(await mobileNav.locator('a').evaluateAll(links=>links.every(el=>getComputedStyle(el).zIndex==='1'&&el.getBoundingClientRect().height>=44)));
    if(route==='today') {
     const resting=await mobileNav.boundingBox();
     for(const link of await mobileNav.locator('a').all()) {
      await link.hover();await page.mouse.wheel(0,150);await page.mouse.move(8,100);
      const after=await mobileNav.boundingBox();
      assert(Math.abs(after.y-resting.y)<1&&Math.abs(after.height-resting.height)<1,'Navigation must not shift during hover/scroll');
      assert.equal(await link.evaluate(el=>getComputedStyle(el).transform),'none');
      await link.focus();assert(await link.evaluate(el=>getComputedStyle(el).outlineStyle==='solid'));
     }
    }
   }
   for(const field of await page.locator('main input:not([type=radio],[type=checkbox],[type=file],[type=range]),main textarea').all()){
    if(!await field.isVisible())continue;await field.focus();assert(await field.evaluate(element=>{const style=getComputedStyle(element);return style.outlineStyle==='none'&&style.boxShadow.includes('inset')&&style.borderRadius===getComputedStyle(document.documentElement).getPropertyValue('--corner-radius').trim();}));await field.blur();
   }
   if(locale==='zh-Hans'&&['settings','library/ipa','today'].includes(route)&&[375,1440].includes(width))await page.screenshot({animations:'disabled',path:`output/playwright/ui-audit-${route.replaceAll('/','-')}-${width}-${theme}.png`});views++;
  }
 }
 await page.goto(origin+'/start');await page.getByRole('button',{name:'Skip this step',exact:true}).click();await expect(page.locator('.first-run-choices .option').first()).toBeVisible();await page.locator('.first-run-choices input[type=radio]').last().check();
 assert(await page.locator('.first-run-choices .option').last().evaluate(element=>{const style=getComputedStyle(element);return style.borderRadius===getComputedStyle(document.documentElement).getPropertyValue('--corner-radius').trim()&&style.boxShadow.includes('inset');}));
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.first-run-choices .option').last().evaluate(element=>getComputedStyle(element).transitionDuration),'0s');
 await page.goto(origin+'/settings');await page.locator('.settings-preferences .setting-trigger').first().click();await page.locator('.setting-menu [data-value="zh-Hans"]').click();await expect(page.locator('.settings-preferences .setting-trigger').first()).toHaveAttribute('data-value','zh-Hans');await page.goto(origin+'/today');await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeAttached();assert.deepEqual(errors,[]);
 console.log(`PASS: ${files.length} component source inventory; ${views} route/locale/theme/viewport combinations, shared input focus/radius, existing pickers, selected rows, contained navigation hover/scroll/focus, reduced motion and Today. Conditional account/learning states use separate browser runners.`);
}finally{await browser.close();}
