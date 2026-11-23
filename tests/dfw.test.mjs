import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { STORAGE_KEY } from '../engine.js';
import { assess, quickRewrite } from '../dfw/prose.js';
import { deckFor, includesWord, localDay, questionFor } from '../dfw/daily.js';

const draft='I thought it was a simple decision.\nI called anyway. Everyone went quiet.';
const review=assess(draft);
assert.equal(review.sentences,3);
assert(review.notes.some(note=>note.includes('I thought it was a simple decision')));
const quick=quickRewrite(draft);
assert.match(quick,/What I thought, or what I was prepared/);
assert.match(quick,/I called anyway/);
assert.match(quick,/everyone went quiet/i);
assert.doesNotMatch(quickRewrite('I didn’t know how long she would stay.'),/that how/);
assert.equal(quickRewrite('Did we really need another meeting?'),'Did we really need another meeting?');
assert.equal(quickRewrite('I called him that morning.\n\nHe went home.').split('\n\n').length,2);

const bank=JSON.parse(await fs.readFile(new URL('../assets/dfw/words.json',import.meta.url),'utf8'));
const localDate=new Date(2026,10,23,11);
const today=localDay(localDate);
assert.deepEqual(today,{index:0,id:'2026-11-23'});
assert.equal(localDay(new Date(2027,0,1,11)).index,39);
const byDay=Array.from({length:366},(_,index)=>deckFor(bank,{index}));
assert(byDay.every(list=>list.length===20));
assert.equal(new Set(byDay.flat().map(([word])=>word)).size,7320);
const question=questionFor(byDay[0],0,today.index);
assert.deepEqual(question,questionFor(byDay[0],0,today.index));
assert.equal(new Set(question.choices).size,4);
assert(question.choices.includes('inchoate'));
assert(includesWord('The revisions obfuscated the opening.','obfuscate'));
assert(!includesWord('The initiative had anticipated it.','api'));
console.log('PASS prose assessment, quick rewrite, and 366 distinct daily vocabulary decks');

const desktopURL=process.env.TEST_URL||'http://127.0.0.1:4400/';
const dfwURL=new URL('dfw.html',desktopURL).href;
const launchOptions={args:['--enable-unsafe-swiftshader']};
const browser=await chromium.launch(launchOptions).catch(()=>chromium.launch({...launchOptions,channel:'chrome'}));
const errors=[];
const screenshots=process.env.DFW_SCREENSHOTS;
if(screenshots)await fs.mkdir(screenshots,{recursive:true});
async function capture(page,name) {
  if(screenshots)await page.screenshot({path:`${screenshots}/${name}.png`});
}
async function checkAxe(page) {
  if(!await page.evaluate(()=>Boolean(window.axe)))await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async()=> (await axe.run({runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(({id,nodes})=>({id,nodes:nodes.map(node=>node.target)})));
  assert.deepEqual(violations,[]);
}
try {
  const context=await browser.newContext({viewport:{width:1365,height:950},acceptDownloads:true});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(localDate);
  await page.addInitScript(({key,draft})=>{
    localStorage.setItem(key,JSON.stringify({activeId:'dfw-example',documents:[{id:'dfw-example',number:1,lines:draft.split('\n')}]}));
    Object.defineProperty(window,'LanguageModel',{configurable:true,value:{
      async availability(){return 'available';},
      async create({initialPrompts}){
        if(!initialPrompts[0].content.includes('David Foster Wallace'))throw new Error('Missing style prompt.');
        return {
          async *promptStreaming(text,{signal}){
            if(text.startsWith('Stop')){
              signal.throwIfAborted();
              await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
            }
            else {yield 'AI pass: ';yield text;yield ' <b>literal</b>';}
          },
          destroy(){},
        };
      },
    }});
  },{key:STORAGE_KEY,draft});
  await page.goto(desktopURL);
  await page.keyboard.press('Escape');
  await Promise.all([page.waitForURL(dfwURL),page.getByRole('link',{name:/DFW mode/}).click()]);
  assert.equal(await page.getByRole('textbox',{name:'Your draft'}).inputValue(),draft);
  await page.getByRole('button',{name:'Assess & rewrite'}).click();
  assert.equal(await page.locator('#rewrite').textContent(),quick);
  await page.getByText('Quick rewrite · rule-based edit').waitFor();
  await checkAxe(page);
  await page.evaluate(()=>document.fonts.ready);
  await capture(page,'desktop-prose');
  const saved=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save text'}).click();
  const download=await saved;
  assert.equal(download.suggestedFilename(),'dfw-rewrite.txt');
  assert.equal(await fs.readFile(await download.path(),'utf8'),quick);

  await page.getByRole('button',{name:'Rewrite with local AI'}).click();
  await page.getByText('On-device AI rewrite',{exact:true}).waitFor();
  assert.match(await page.locator('#rewrite').textContent(),/^AI pass: /);
  assert.equal(await page.locator('#rewrite b').count(),0);
  await page.getByRole('textbox',{name:'Your draft'}).fill('Stop while the model is still running.');
  await page.getByRole('button',{name:'Rewrite with local AI'}).click();
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await page.getByText('Rewrite stopped.').waitFor();

  await page.getByRole('link',{name:'Daily words'}).click();
  await page.getByRole('heading',{name:'inchoate'}).waitFor();
  assert.equal(await page.locator('#word-list li').count(),20);
  assert.equal(await page.locator('#word-list .example').count(),20);
  await checkAxe(page);
  await capture(page,'desktop-words');
  await page.getByRole('button',{name:'Play the quiz'}).click();
  await page.getByRole('button',{name:'inchoate',exact:true}).click();
  await page.getByText('Correct. The idea was still inchoate,',{exact:false}).waitFor();
  await page.getByLabel('Try using “inchoate” in a sentence.').fill('Her inchoate idea was starting to take shape.');
  await page.getByRole('button',{name:'Check use'}).click();
  await page.getByText('Found “inchoate” or an inflected form',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Next word'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Continue quiz'}).click();
  assert.equal(await page.locator('#quiz-progress').textContent(),'2 / 20');
  for(let index=1;index<20;index++){
    const label=index===1 ? questionFor(byDay[0],index,today.index).choices.find(word=>word!==byDay[0][index][0]) : byDay[0][index][0];
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#quiz-next').click();
  }
  await page.getByText('19 of 20 meanings matched. 1 word used in your own sentences.').waitFor();

  const mobile=await browser.newContext({...devices['iPhone 13'],deviceScaleFactor:1,hasTouch:true});
  const phone=await mobile.newPage();
  phone.on('pageerror',error=>errors.push(error.message));
  await phone.clock.setFixedTime(localDate);
  await phone.goto(dfwURL);
  await phone.getByRole('textbox',{name:'Your draft'}).fill(draft);
  await phone.getByRole('button',{name:'Assess & rewrite'}).tap();
  await phone.getByText('Quick rewrite · rule-based edit').waitFor();
  assert(await phone.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await phone.evaluate(()=>scrollTo(0,0));
  await phone.evaluate(()=>document.fonts.ready);
  await capture(phone,'mobile-prose');
  await phone.getByRole('link',{name:'Daily words'}).tap();
  await phone.getByRole('button',{name:'Play the quiz'}).tap();
  await phone.getByRole('button',{name:'inchoate',exact:true}).tap();
  await phone.getByLabel('Try using “inchoate” in a sentence.').waitFor();
  assert(await phone.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await checkAxe(phone);
  await capture(phone,'mobile-quiz');
  assert.deepEqual(errors,[]);
  console.log('PASS Paper menu, imported draft, rewrite, text export, AI streaming/stop with a simulated local engine, vocabulary quiz and resume, phone layout, accessibility');
}finally{await browser.close();}
