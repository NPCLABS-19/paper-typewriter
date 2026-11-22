import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Typewriter, COLUMNS, WARNING_COLUMN, STORAGE_KEY } from '../engine.js';
import { chromium } from 'playwright';
const args=['--enable-unsafe-swiftshader'];
const launch=async()=>{try{return await chromium.launch({args});}catch{return await chromium.launch({channel:'chrome',args});}};

const model=new Typewriter();
let bells=0;
for(let i=0;i<COLUMNS;i++){const r=model.type('A');assert.equal(r.accepted,true);if(r.bell)bells++;assert.equal(r.bell,i===WARNING_COLUMN-1);}
assert.equal(bells,1);assert.equal(model.full,true);assert.equal(model.type('B').accepted,false);assert.equal(model.column,COLUMNS);
assert.equal(model.returnCarriage(),COLUMNS);assert.equal(model.column,0);model.type('!');
const original=model.text;const saved=model.serialize();const restored=new Typewriter(JSON.parse(JSON.stringify(saved)));assert.equal(restored.text,original);
const previous=restored.activeId;restored.newDocument();assert.equal(restored.text,'');restored.select(previous);assert.equal(restored.text,original);
assert.equal(restored.type('\n').accepted,false);
const oldDraft=restored.text;restored.type('é','l');
assert.equal(new Typewriter(JSON.parse(JSON.stringify(restored.serialize()))).ribbonAt(restored.row,restored.column-1),'l');
restored.eraseLast();assert.equal(restored.text,oldDraft);
for(let i=0;i<14;i++){restored.newDocument();restored.type(String(i%10));}
assert.equal(restored.documents.length,10);assert.equal(restored.current.number,16);assert.equal(restored.documents[0].number,7);
const corrections = new Typewriter();
assert.equal(corrections.eraseLast(), null);
corrections.type('é');
corrections.returnCarriage();
assert.equal(corrections.eraseLast().char, '\n');
assert.equal(corrections.eraseLast().char, 'é');
assert.equal(corrections.text, '');
console.log('PASS model: erase characters and returns, 68-column lock, one margin bell, restore, preserved sheets');

const browser=await launch();
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
  window.__audio=[];
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(when,...args){window.__audio.push({duration:this.buffer?.duration,when,current:this.context.currentTime,rate:this.playbackRate.value});return start.call(this,when,...args);};
});
const url=process.env.TEST_URL||'http://127.0.0.1:4400/';
await page.goto(url);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
const text=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).documents.find(d=>d.id===JSON.parse(localStorage.getItem(key)).activeId).lines.join('\n'),STORAGE_KEY);
const persist=()=>page.waitForTimeout(180);
await page.keyboard.type('A page, a thought.');
await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).documents[0].lines[0]==='A page, a thought.',STORAGE_KEY);
await page.keyboard.press('Backspace');await persist();assert.equal(await text(),'A page, a thought');
await page.keyboard.press('Delete');await persist();assert.equal(await text(),'A page, a though');
await page.keyboard.press('ControlOrMeta+z');await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('ControlOrMeta+Backspace');await page.keyboard.press('ArrowLeft');await page.keyboard.type('t.!');await persist();assert.equal(await text(),'A page, a thought.!');
for (const [type,data] of [['historyUndo',null],['insertReplacementText','AUTOCORRECT'],['insertFromPaste','PASTE']]) await page.locator('#key-input').evaluate((el,{type,data})=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:type,data,bubbles:true,cancelable:true})),{type,data});
await persist();assert.equal(await text(),'A page, a thought.!');
async function instrumentMotion() {
  await page.waitForSelector('html.has-rig',{state:'attached'});
  await page.evaluate(async()=>{
  const {rigFor}=await import('./assets/machine.mjs?v=1');
  const rig=rigFor(document.querySelector('#machine-view'));
  window.mechanism=rig;
  const draw=rig.draw.bind(rig);
  window.steps=[];
  rig.draw=()=>{
    draw();
    const m=rig.machine;
    steps.push({carriage:m.paper.carriage.position.x,roller:m.paper.cylinder.rotation.x,
      key:m.keys.get('X')[0].rotation.x,bar:m.bars?.bars.get('X').motion?.value||0,
      ribbon:m.lift.value,spool:m.tape.spools[0].rotation.y,lever:m.paper.lever.rotation.y,
      ball:m.element?.ballPivot.rotation.y,carrier:m.element?.carrier.position.x});
  };
  });
}
await instrumentMotion();
const initial=await page.evaluate(()=>({x:mechanism.machine.paper.carriage.position.x, spool:mechanism.machine.tape.spools[0].rotation.y}));
await page.keyboard.type(' x');
await page.waitForFunction(({x,spool})=>steps.some(frame=>frame.key>.02 && frame.bar>.1 && frame.ribbon>.08)&&steps.some(frame=>frame.carriage<x-.13&&frame.spool<spool),initial);
await page.evaluate(()=>{window.steps=[];});
await page.keyboard.press('Enter');
await page.waitForFunction(({x})=>steps.some(frame=>frame.lever<-.12)&&steps.some(frame=>frame.carriage>x+.4&&frame.roller<-.10),initial);
await page.keyboard.type('Buffered through return.x');await page.keyboard.press('Backspace');await page.waitForTimeout(600);assert.equal(await text(),'A page, a thought.! x\nBuffered through return.');
await page.reload();await page.waitForTimeout(250);assert.equal(await text(),'A page, a thought.! x\nBuffered through return.');assert.equal(await page.locator('#impressions .impression').count(),Array.from((await text()).replace(/\s/g,'')).length);
await page.keyboard.press('Escape');await page.locator('#new-sheet').click();await page.locator('#keep-typing').click();assert.equal(await text(),'A page, a thought.! x\nBuffered through return.');
await page.keyboard.press('Escape');await page.locator('#new-sheet').click();await page.locator('#tear-page').click();assert(await page.locator('.torn-page').count());await page.waitForTimeout(950);assert.equal(await page.locator('.torn-page').count(),0);
await page.mouse.click(720,400);await page.keyboard.type('a'.repeat(60));await persist();assert.equal((await text()).length,60);
let audio=await page.evaluate(()=>window.__audio);assert(audio.some(x=>x.duration>1 && x.duration<1.2),'real margin bell played');
await page.keyboard.type('b'.repeat(12));await persist();assert.equal((await text()).length,68);assert.equal(await page.locator('#margin-hint').textContent(),'Enter to return');
await page.keyboard.press('Backspace');await persist();assert.equal((await text()).length,67);assert.equal(await page.locator('#margin-hint').textContent(),'');
await page.keyboard.type('c');await page.keyboard.press('Enter');await page.keyboard.type('next');await page.waitForFunction(key=>{const state=JSON.parse(localStorage.getItem(key));return state.documents.find(doc=>doc.id===state.activeId).lines.at(-1)==='next';},STORAGE_KEY);
await page.keyboard.press('Escape');
const download=page.waitForEvent('download');await page.locator('#save-text').click();const file=await download;assert(file.suggestedFilename().endsWith('.txt'));assert.equal(await fs.readFile(await file.path(),'utf8'),await text());
const imageDownload=page.waitForEvent('download');await page.locator('#save-image').click();const png=await imageDownload;assert(png.suggestedFilename().endsWith('.png'));const pngBytes=await fs.readFile(await png.path());assert.equal(pngBytes.toString('hex',0,8),'89504e470d0a1a0a');
await page.locator('#sound-toggle').click();assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'),'false');await page.keyboard.press('Escape');const count=await page.evaluate(()=>window.__audio.length);await page.keyboard.type(' muted');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__audio.length),count);
await page.keyboard.press('Escape');assert.equal(await page.locator('#sheets option').count(),2);const options=await page.locator('#sheets option').evaluateAll(els=>els.map(e=>e.value));await page.locator('#sheets').selectOption(options[0]);await persist();assert.equal(await text(),'A page, a thought.! x\nBuffered through return.');
await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.value),'olympia');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'menu-toggle');await page.keyboard.press('Enter');assert(await page.locator('#controls').evaluate(e=>e.open));await page.keyboard.press('Escape');
await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});let axe=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(axe.violations.map(v=>v.id),[]);
await page.keyboard.press('Escape');axe=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(axe.violations.map(v=>v.id),[]);await page.keyboard.press('Escape');
await instrumentMotion();
await page.keyboard.press('Escape');await page.locator('#sound-toggle').click();await page.keyboard.press('Escape');
await page.evaluate(()=>{window.__audio=[];});
await page.keyboard.type('a');
await page.waitForFunction(()=>window.__audio.some(sample=>sample.duration>.16&&sample.duration<.17));
await page.locator('[value=lettera]').check();
assert.equal(await page.locator('#machine-view').getAttribute('data-machine'),'lettera');
await page.evaluate(()=>{window.__audio=[];});
await page.keyboard.type('a',{delay:100});
await page.waitForFunction(()=>window.__audio.some(sample=>sample.duration>.18&&sample.duration<.19));
await page.locator('[value=selectric]').check();
assert.equal(await page.locator('#machine-view').getAttribute('data-machine'),'selectric');
await page.keyboard.press('Escape');await page.locator('#new-sheet').click();await page.locator('#tear-page').click();await page.waitForTimeout(1000);
await page.evaluate(()=>{window.steps=[];window.__audio=[];});
await page.keyboard.type('B'.repeat(68),{delay:35});
await page.waitForFunction(key=>{const doc=JSON.parse(localStorage.getItem(key));return doc.documents.find(sheet=>sheet.id===doc.activeId).lines.length===2;},STORAGE_KEY);
assert.equal(await text(),'B'.repeat(68)+'\n');
const electric=await page.evaluate(()=>({ball:steps.some(frame=>Math.abs(frame.ball||0)>.2),slide:steps.some(frame=>frame.carrier>1)&&steps.some(frame=>frame.carrier< -1),stationary:steps.every(frame=>frame.carriage===0)}));
assert.deepEqual(electric,{ball:true,slide:true,stationary:true});
await page.waitForFunction(()=>window.__audio.some(sample=>sample.duration>.12&&sample.duration<.13)&&window.__audio.some(sample=>sample.duration>.37&&sample.duration<.39));
assert.equal(await page.getByRole('radio',{name:/Selectric II/}).isChecked(),true);
console.log('PASS three distinct recording sets, Selectric typeball, automatic return and stationary Selectric platen');
await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.type(' reduced');await persist();const transform=await page.locator('#carriage').evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(120);assert.equal(await page.locator('#carriage').evaluate(e=>getComputedStyle(e).transform),transform);
console.log('PASS desktop: Backspace and Delete, blocked replacement and undo, vertical strike, lateral advance, paper feed, buffered returns, persistence, bell, lock, text/PNG exports, mute, archive, keyboard navigation, axe, reduced motion');

const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const mp=await mobile.newPage();await mp.goto(url);await mp.tap('#desk');
for(const char of ['t','e','h',' '])await mp.locator('#key-input').evaluate((el,char)=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:char,bubbles:true,cancelable:true})),char);
await mp.locator('#key-input').evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertReplacementText',data:'the ',bubbles:true,cancelable:true})));
await mp.locator('#key-input').evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.dispatchEvent(new CompositionEvent('compositionend',{data:'é',bubbles:true}));});
await mp.waitForTimeout(200);const mt=await mp.evaluate(k=>JSON.parse(localStorage.getItem(k)).documents[0].lines[0],STORAGE_KEY);assert.equal(mt,'teh é');
assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await mp.locator('#key-input').evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true})));
await mp.waitForTimeout(180);
assert.equal(await mp.evaluate(k=>JSON.parse(localStorage.getItem(k)).documents[0].lines[0],STORAGE_KEY),'teh ');
assert.equal(await mp.locator('#key-input').inputValue(),'\u2060');
await mp.screenshot({path:'.shots/mobile-typed.png'});await mp.locator('#menu-toggle').tap();await mp.screenshot({path:'.shots/mobile-menu.png'});assert(await mp.locator('#controls').isVisible());
await mp.keyboard.press('Escape');await mp.keyboard.type('a'.repeat(63));await mp.waitForTimeout(250);
const layout=await mp.evaluate(()=>{
  const paper=document.querySelector('#paper').getBoundingClientRect();
  const letters=[...document.querySelectorAll('#impressions .impression')].map(node=>node.getBoundingClientRect());
  return {center: Math.abs(paper.x+paper.width/2-innerWidth/2)<1, wrapped: letters.at(-1).top>letters[0].top,
    allInside: letters.every(rect=>rect.left>=paper.left && rect.right<=paper.right)};
});
assert.deepEqual(layout,{center:true,wrapped:true,allInside:true});
await mp.emulateMedia({reducedMotion:'reduce'});
for(let i=0;i<29;i++){await mp.keyboard.press('Enter');await mp.keyboard.type('line');}
await mp.waitForTimeout(180);
const offset=()=>mp.locator('#carriage').evaluate(el=>el.getBoundingClientRect().top);
const afterFeed=await offset();
const cdp=await mobile.newCDPSession(mp);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:180}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y:395}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert(await offset()>afterFeed+50,'swipe reveals earlier lines');
await mp.keyboard.type('!');await mp.waitForTimeout(230);
assert(Math.abs(await offset()-afterFeed)<1,'typing returns to the active line');
console.log('PASS mobile: Backspace, IME, centered sheet, wrapping inside margins, review, return to writing');
assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors');
await browser.close();
