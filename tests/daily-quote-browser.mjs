import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const catalogue=JSON.parse(await readFile('content/daily-quotes.json','utf8'));
const calendar=JSON.parse(await readFile('content/quote-calendar.json','utf8'));
assert.equal(catalogue.source.url,'https://en.wikiquote.org/');
const records=new Map(catalogue.quotes.map(quote=>[quote.id,quote]));
const normalized=text=>text.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en');
const origin='http://127.0.0.1:8787';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({hasTouch:true,locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1440,height:900}});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const externalRequests=[];
await page.route('**/*',route=>{if(route.request().url().startsWith(origin+'/'))return route.continue();externalRequests.push(route.request().url());return route.abort();});
const verifyQuote=async(day,locale='zh-Hans')=>{
 const quote=page.locator('.daily-quote');await expect(quote.locator('blockquote')).not.toBeEmpty();
 const id=await quote.getAttribute('data-quote-id'),record=records.get(id);assert(record,'Displayed quotation belongs to current Wikiquote release');assert(!/\b(?:thou|thee|thy|thine|hath|doth|dost|shalt|whilom|yclept)\b/i.test(record.text),'Archaic wording must remain held');
 assert.equal(normalized(await quote.locator('blockquote').textContent()),normalized(record.text));
 const toggle=quote.locator('button[aria-expanded]');
 if(await toggle.count()){await expect(toggle).toHaveAttribute('aria-expanded','false');await toggle.click();assert.equal(normalized(await quote.locator('blockquote').innerText()),normalized(record.text));await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');}else await expect(toggle).toHaveCount(0);
 await expect(quote.locator('.daily-quote-attribution a')).toHaveAttribute('href',record.url+(record.url.includes('#')?'':'#')+':~:text='+encodeURIComponent(record.text).replace(/-/g,'%2D'));assert.equal(new URL(record.url).hostname,'en.wikiquote.org');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('lingfern:last-daily-quote'))).toBe(id);
 const source=quote.locator('.daily-quote-credit');await expect(source.locator('summary')).toHaveCount(0);
 await expect(quote.locator('.daily-quote-attribution a')).toHaveText(record.pageTitle+(record.locator?' · '+record.locator:''));
 await expect(quote.locator('.daily-quote-attribution a')).toBeVisible();
 if(record.rightsEvidence.kind==='cc-by-4.0')await expect(quote.locator('.daily-quote-license a')).toHaveAttribute('href','https://creativecommons.org/licenses/by/4.0/');
 const association=quote.locator('.daily-quote-event');
 if(await association.count()){const text=await association.innerText();assert(calendar.some(event=>event.date===day.slice(5)&&event.pages.includes(record.pageTitle)&&text.includes(event.labels[locale])),'Date label must belong to today and selected page');}

 assert(!/临近|臨近|Near ·/.test(await quote.innerText()));
 return {id,text:normalized(record.text)};
};
try {
 await page.clock.install({time:new Date('2026-10-07T12:00:00+08:00')});
 await page.goto(origin+'/start');for(let step=0;step<3;step++)await page.getByRole('button',{name:'跳过这一步',exact:true}).click();
 await page.getByRole('button',{name:'保存并继续',exact:true}).click();await page.getByRole('button',{name:'保存并前往今日',exact:true}).click();
 const quote=page.locator('.daily-quote');await verifyQuote('2026-10-07');
 await page.evaluate(()=>window.scrollTo(0,0));await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 const spacing=await page.evaluate(()=>{const stage=document.querySelector('.today-layout').getBoundingClientRect(),header=document.querySelector('header').getBoundingClientRect(),quote=document.querySelector('.daily-quote').getBoundingClientRect();return {top:stage.top-header.bottom,bottom:quote.top-stage.bottom};});assert.deepEqual(spacing,{top:64,bottom:40});
 await page.screenshot({path:'output/playwright/today-layout-1440-light-zh-Hans-online.png'});await page.setViewportSize({width:375,height:900});await page.screenshot({path:'output/playwright/today-layout-375-light-zh-Hans-online.png'});await page.setViewportSize({width:1440,height:900});
 // Avoid the previous quote even with deterministic draws across reloads.
 await page.addInitScript(()=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===1?(values[0]=0,values):original(values);});
 let previous=await verifyQuote('2026-10-07');for(let i=0;i<6;i++){await page.reload();const current=await verifyQuote('2026-10-07');assert.notEqual(current.id,previous.id,'Reload repeated the previous quote');assert.notEqual(current.text,previous.text,'Reload repeated normalized wording');previous=current;}
 // Select actual CC BY records by page/ID, not append order.
 const lastId=await quote.getAttribute('data-quote-id'),lastText=normalized(records.get(lastId).text),available=catalogue.quotes.filter(row=>row.id!==lastId&&normalized(row.text)!==lastText);
 assert(!calendar.some(event=>event.date==='10-07'&&available.some(row=>event.pages.includes(row.pageTitle))));
 const groups=[...new Set(available.map(row=>row.pageTitle))].map(title=>available.filter(row=>row.pageTitle===title)),groupIndex=groups.findIndex(rows=>rows.some(row=>row.rightsEvidence.kind==='cc-by-4.0'));
 assert(groupIndex>=0);const quoteIndex=groups[groupIndex].findIndex(row=>row.rightsEvidence.kind==='cc-by-4.0');
 await page.evaluate(draws=>{crypto.getRandomValues=values=>values instanceof Uint32Array&&values.length===1?(values[0]=draws.shift()??0xffffffff,values):values;},[Math.floor((groupIndex+.5)/groups.length*0x100000000),Math.floor((quoteIndex+.5)/groups[groupIndex].length*0x100000000)]);
 await quote.getByRole('button',{name:'换一句'}).click();await expect(quote.locator('.daily-quote-license a')).toHaveText('CC BY 4.0');await verifyQuote('2026-10-07');
 const first=await quote.getAttribute('data-quote-id');await quote.getByRole('button',{name:'换一句'}).click();await expect(quote).not.toHaveAttribute('data-quote-id',first);assert.notEqual(await quote.getAttribute('data-quote-id'),first);
 await page.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated',undefined,{timeout:30000});await page.reload();const beforeOffline=await verifyQuote('2026-10-07');await context.setOffline(true);await page.reload();const afterOffline=await verifyQuote('2026-10-07');assert.notEqual(afterOffline.text,beforeOffline.text,'Offline reload must exclude localStorage previous text');
 await quote.locator('blockquote').evaluate((el,length)=>el.dataset.fullLength=length,records.get(await quote.getAttribute('data-quote-id')).text.length);
 for(const width of [1440,1200,1024,768,375,320]) {await page.setViewportSize({width,height:900});await quote.scrollIntoViewIfNeeded();const typography=await quote.locator('blockquote').evaluate(el=>({hyphens:getComputedStyle(el).hyphens,wrap:getComputedStyle(el).textWrapStyle,lang:el.lang,size:parseFloat(getComputedStyle(el).fontSize),length:Number(el.dataset.fullLength)}));assert.equal(typography.hyphens,'auto');assert.equal(typography.wrap,'balance');assert.equal(typography.lang,'en-US');assert.equal(typography.size,width<768?18:20,JSON.stringify(typography));assert(await quote.locator('blockquote').evaluate(el=>{const style=getComputedStyle(el);return style.textAlign==='left'||(style.textAlign==='start'&&style.direction==='ltr');}),'English quote must render left-aligned');assert.equal(await quote.locator('h2').evaluate(el=>getComputedStyle(el).position),'absolute');if(width<768){const order=await page.evaluate(()=>{const fern=document.querySelector('.today-hero .fern').getBoundingClientRect(),quote=document.querySelector('.daily-quote').getBoundingClientRect(),practice=document.querySelector('.today-grid').getBoundingClientRect();return fern.bottom<=quote.top&&quote.bottom<=practice.top&&getComputedStyle(document.querySelector('.today-hero h1')).clip!=='auto';});assert(order,'Mobile quote replaces visual Today heading before practice');assert(await quote.locator('blockquote').evaluate(el=>{const style=getComputedStyle(el);return style.textAlign==='left'||(style.textAlign==='start'&&style.direction==='ltr');}),'English quote must render left-aligned');assert.equal(await quote.locator('h2').evaluate(el=>getComputedStyle(el).position),'absolute');}assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await quote.getByRole('button',{name:'换一句'}).boundingBox();assert(bounds.height>=44);if(width===1440||width===375)await page.screenshot({path:`output/playwright/daily-quote-${width}-light-zh-Hans-offline.png`,animations:'disabled'});}
 // Preserve reading and fixed-navigation positions when quote length changes.
 await page.setViewportSize({width:375,height:640});
 await quote.getByRole('button',{name:'换一句'}).scrollIntoViewIfNeeded();
 await page.evaluate(()=>scrollTo(0,document.querySelector('.daily-quote-next').getBoundingClientRect().top+scrollY-200));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const next=quote.getByRole('button',{name:'换一句'});
 const resting=await next.boundingBox();await next.hover();await page.mouse.down();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
 const pressed=await next.boundingBox();
 assert(Math.abs(pressed.width-resting.width)<.1&&Math.abs(pressed.height-resting.height)<.1,'Quote button must not scale under the translucent navigation');
 await page.mouse.up();
 for(const viewport of [{width:320,height:640},{width:375,height:640},{width:390,height:844}]){
 await page.setViewportSize(viewport);await next.scrollIntoViewIfNeeded();
 await page.evaluate(()=>scrollTo(0,document.querySelector('.daily-quote-next').getBoundingClientRect().top+scrollY-200));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 for(let draw=0;draw<8;draw++){
  const before=await page.evaluate(()=>({scroll:scrollY,nav:document.querySelector('.mobile-nav').getBoundingClientRect().top}));
  const beforeText=normalized(await quote.locator('blockquote').innerText());
  await quote.getByRole('button',{name:'换一句'}).tap();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const after=await page.evaluate(()=>({scroll:scrollY,nav:document.querySelector('.mobile-nav').getBoundingClientRect().top}));
  assert.notEqual(normalized(await quote.locator('blockquote').innerText()),beforeText,'Touch redraw must exclude previous wording');
  assert(Math.abs(after.scroll-before.scroll)<=1,JSON.stringify({before,after}));
  assert(Math.abs(after.nav-before.nav)<=1,JSON.stringify({before,after}));
 }
 }
 await page.setViewportSize({width:375,height:480});assert.equal(await page.locator('.mobile-nav').evaluate(el=>getComputedStyle(el).position),'fixed');
 await page.setViewportSize({width:375,height:812});
 if(!process.argv.includes('--quotes-only')){
 // Blur the live backdrop without repainting stationary navigation.
 await page.evaluate(()=>{const layer=document.createElement('div');layer.id='nav-backdrop-regression';Object.assign(layer.style,{position:'fixed',bottom:'0',left:'0',width:'66%',height:'100px',zIndex:'24',pointerEvents:'none'});document.getElementById('root').insertBefore(layer,document.querySelector('.mobile-nav'));});
 const barPixels=[];for(const color of ['#ff00ff','#00ff00','#0000ff']){await page.evaluate(color=>document.getElementById('nav-backdrop-regression').style.background=color,color);barPixels.push(createHash('sha256').update(await page.locator('.mobile-nav').screenshot()).digest('hex'));}assert.equal(new Set(barPixels).size,3,'Live blur must respond to changing backdrop content');
 const blurredLevels=await page.evaluate(async bytes=>{const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,4,canvas.width,1).data,edge=Math.round(canvas.width*.66),levels=new Set();for(let x=edge-40;x<edge+40;x++)levels.add(pixels[x*4]);image.close();return levels.size;},Array.from(await page.locator('.mobile-nav').screenshot()));assert(blurredLevels>6,'Actual backdrop edges must be blurred, not merely transparent');
 // Detect blue/light edges through red-channel contrast to distinguish blur.
 const clearLevels=await page.evaluate(async()=>{const sheet=document.styleSheets[0],index=sheet.cssRules.length;sheet.insertRule('.mobile-nav::before{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',index);return index;});
 const sharpLevels=await page.evaluate(async bytes=>{const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,4,canvas.width,1).data,edge=Math.round(canvas.width*.66),levels=new Set();for(let x=edge-40;x<edge+40;x++)levels.add(pixels[x*4]);image.close();return levels.size;},Array.from(await page.locator('.mobile-nav').screenshot()));assert(sharpLevels<=6,'The same edge probe must reject a transparent surface without blur');await page.evaluate(index=>document.styleSheets[0].deleteRule(index),clearLevels);
 const staticPixels=[];for(let frame=0;frame<4;frame++)staticPixels.push(createHash('sha256').update(await page.locator('.mobile-nav').screenshot()).digest('hex'));assert.equal(new Set(staticPixels).size,1,'Stationary backdrop must not flicker');await page.evaluate(()=>document.getElementById('nav-backdrop-regression').remove());
 }
 for(const [locale,label,title] of [['zh-Hant','语言','每日一句'],['en','語言','Daily quote'],['zh-Hans','Language','每日一句']]) {await page.goto(origin+'/settings');await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('listbox',{name:label,exact:true}).locator(`[data-value="${locale}"]`).click();await expect(page.getByRole('button',{name:locale==='en'?'Language':locale==='zh-Hant'?'語言':'语言',exact:true})).toBeVisible();await page.goto(origin+'/today');await expect(quote.getByRole('heading',{name:title,exact:true})).toBeVisible();await verifyQuote('2026-10-07',locale);}
 await page.clock.setSystemTime(new Date('2026-04-23T12:00:00+08:00'));await page.reload();await verifyQuote('2026-04-23');
 await page.clock.setSystemTime(new Date('2026-10-07T23:59:50+08:00'));await page.reload();const beforeMidnight=await verifyQuote('2026-10-07');await page.clock.fastForward(70000);await expect(page.locator('.today-hero time')).toHaveAttribute('datetime','2026-10-08');const afterMidnight=await verifyQuote('2026-10-08');assert.notEqual(afterMidnight.text,beforeMidnight.text,'Midnight selection must exclude previous wording');await expect(quote.locator('.daily-quote-event')).toHaveCount(0);
 for(const day of ['2026-02-07','2026-12-31','2026-03-01']){await page.clock.setSystemTime(new Date(`${day}T12:00:00+08:00`));await page.reload();await verifyQuote(day);await expect(quote.locator('.daily-quote-event')).toHaveCount(0);}
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await page.setViewportSize({width:375,height:812});await quote.scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/daily-quote-375-dark-zh-Hans-offline.png',animations:'disabled'});
 // Use presentation fixtures to test balanced short final lines.
 const improved=await quote.locator('blockquote').evaluate(el=>{
  const specimen=el.cloneNode(false);specimen.textContent='What a world of happiness their harmony foretells!';el.after(specimen);
  const finalWords=()=>{const node=specimen.firstChild,lines=new Map();for(const match of node.textContent.matchAll(/\S+/g)){const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);const top=range.getBoundingClientRect().top;lines.set(top,(lines.get(top)??0)+1);}return [...lines.values()].at(-1);};
  const repairs=[];for(const text of [specimen.textContent,'We can love nothing but what agrees with us, and we can only follow our taste or our pleasure when we prefer our friends to ourselves; nevertheless it is only by that preference that friendship can be true and perfect.']){specimen.textContent=text;let repaired=false;for(let width=180;width<=700;width+=5){specimen.style.width=`${width}px`;specimen.style.textWrap='wrap';const before=finalWords();specimen.style.textWrap='balance';const after=finalWords();if(before<=2&&after>2)repaired=true;}repairs.push(repaired);}specimen.remove();return repairs;
 });assert.deepEqual(improved,[true,true],'Balanced wrapping should repair short final lines for short and long quotes');
 await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
 console.log((process.argv.includes('--quotes-only')?'Quote-scoped checks (independent backdrop pixel test not run): ':'')+'PASS: Wikiquote-only release, exact date association without nearby/month filtering, distinct localStorage reload/redraw, local midnight rollover/nonrepeat, Dec31/Mar1 no borrowed dates, stable quote press/24 touch redraws/scroll/bottom navigation, short-screen fixed navigation, 3 locales, 6 widths, light/dark/reduced motion, offline reload, no external requests, Today.');
} finally {await browser.close();}
