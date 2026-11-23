import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { STORAGE_KEY } from '../engine.js';

const base=process.env.TEST_URL||'http://127.0.0.1:4400/';
const galleryURL=new URL('gallery.html',base).href;
const date=new Date(2026,10,23,11);
const format=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const args=['--enable-unsafe-swiftshader'];
const browser=await chromium.launch({args}).catch(()=>chromium.launch({channel:'chrome',args}));
const legacy=Array.from({length:10},(_,index)=>{
  const text=[
    'I meant to write down what happened at the station.',
    'The room was quiet when I arrived.',
    'She was still reading by the window.',
    'Day four. At least I sat down at the machine.',
    'On the long way back, I took a different street.',
  ][index%5];
  const created=new Date(2026,10,index<5?21:22,11,index).toISOString();
  const initial=['o','l','s'][index%3];
  return {id:`legacy-${index}`,number:index+1,created,lines:[text,'There should be time to finish that thought tomorrow.'],ribbons:[initial.repeat(text.length)]};
});
const fixture={version:1,activeId:legacy.at(-1).id,documents:legacy};
const screenshots=process.env.GALLERY_SCREENSHOTS;
if(screenshots)await fs.mkdir(screenshots,{recursive:true});

async function seed(page) {
  await page.goto(new URL('dfw.html',base).href);
  await page.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key:STORAGE_KEY,fixture});
}
async function axe(page) {
  await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  assert.deepEqual(await page.evaluate(async()=> (await window.axe.run({runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(result=>result.id)),[]);
}
try{
  const desktop=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});
  const page=await desktop.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(date);
  await seed(page);
  await page.goto(base);
  await page.waitForSelector('html.has-rig',{state:'attached'});
  for(let index=0;index<3;index++){
    await page.keyboard.press('Escape');
    await page.locator('#new-sheet').click();
    await page.locator('#tear-page').click();
    await page.locator(`#machines input[value="${['olympia','lettera','selectric'][index]}"]`).check();
    await page.keyboard.type([
      'Today is day one of my thirty-day project.',
      'The thought came back while I was making tea.',
      'There were three chairs, and nobody had moved any of them.',
    ][index]);
  }
  await page.keyboard.press('Escape');
  await Promise.all([page.waitForURL(galleryURL),page.getByRole('link',{name:/Draft gallery/}).click()]);
  await page.locator('.draft-card').first().waitFor();
  assert.equal(await page.locator('.draft-card').count(),13);
  assert.deepEqual(await page.locator('.draft-day h2').allTextContents(),
    [date,new Date(2026,10,22,11),new Date(2026,10,21,11)].map(value=>format.format(value)));
  assert.equal(await page.locator('.draft-card').first().locator('.sheet-machine').textContent(),'IBM Selectric II');
  assert.equal(await page.locator('.draft-card').count(),await page.locator('.draft-card .sheet-machine svg').count());
  assert.match(await page.locator('.draft-card').first().locator('.sheet-preview').textContent(),/^There were three chairs/);
  await axe(page);
  if(screenshots)await page.screenshot({path:`${screenshots}/desktop.png`});

  // Delete the short-term snapshot in this test profile. The full IndexedDB archive must survive.
  await page.evaluate(key=>localStorage.removeItem(key),STORAGE_KEY);
  await page.reload();
  await page.locator('.draft-card').first().waitFor();
  assert.equal(await page.locator('.draft-card').count(),13);
  await page.getByRole('link',{name:/Open page 02,.*Olivetti Lettera 22/}).click();
  await page.waitForSelector('html[data-model=lettera]',{state:'attached'});
  assert.match(await page.locator('#readable-document').textContent(),/^The room was quiet/);
  await page.reload();
  await page.waitForSelector('html[data-model=lettera]',{state:'attached'});
  assert.match(await page.locator('#readable-document').textContent(),/^The room was quiet/);
  assert.deepEqual(errors,[]);

  const mobile=await browser.newContext({...devices['iPhone 13'],deviceScaleFactor:1});
  const phone=await mobile.newPage();
  await phone.goto(galleryURL);
  await phone.getByText('Drafts will appear here after you type on a sheet.').waitFor();
  await seed(phone);
  await phone.goto(galleryURL);
  await phone.locator('.draft-card').first().waitFor();
  assert.equal(await phone.locator('.draft-card').count(),10);
  assert(await phone.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await axe(phone);
  if(screenshots)await phone.screenshot({path:`${screenshots}/mobile.png`});
  await phone.locator('.draft-card').first().tap();
  await phone.waitForSelector('html[data-model=olympia]',{state:'attached'});
  console.log('PASS legacy archive migration, 13 retained drafts, date grouping, saved typewriter icons, durable reopening, and mobile gallery');
}finally{await browser.close();}
