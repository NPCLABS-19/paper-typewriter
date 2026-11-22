import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Typewriter, COLUMNS, WARNING_COLUMN, STORAGE_KEY } from '../engine.js';
import { chromium } from 'playwright';
const launch=async()=>{try{return await chromium.launch();}catch{return await chromium.launch({channel:'chrome'});}};

const model=new Typewriter();
let bells=0;
for(let i=0;i<COLUMNS;i++){const r=model.type('A');assert.equal(r.accepted,true);if(r.bell)bells++;assert.equal(r.bell,i===WARNING_COLUMN-1);}
assert.equal(bells,1);assert.equal(model.full,true);assert.equal(model.type('B').accepted,false);assert.equal(model.column,COLUMNS);
assert.equal(model.returnCarriage(),COLUMNS);assert.equal(model.column,0);model.type('!');
const original=model.text;const saved=model.serialize();const restored=new Typewriter(JSON.parse(JSON.stringify(saved)));assert.equal(restored.text,original);
const previous=restored.activeId;restored.newDocument();assert.equal(restored.text,'');restored.select(previous);assert.equal(restored.text,original);
assert.equal(restored.type('\n').accepted,false);
for(let i=0;i<14;i++){restored.newDocument();restored.type(String(i%10));}
assert.equal(restored.documents.length,10);assert.equal(restored.current.number,16);assert.equal(restored.documents[0].number,7);
console.log('PASS model: permanent impressions, 68-column lock, one margin bell, return, restore, preserved sheets');

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
await page.keyboard.type('A page, a thought.');await persist();assert.equal(await text(),'A page, a thought.');
await page.keyboard.press('Backspace');assert(await page.locator('#new-page-prompt').evaluate(e=>e.open));await page.locator('#keep-typing').click();await page.keyboard.press('Delete');await page.keyboard.press('ControlOrMeta+z');await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('ControlOrMeta+Backspace');await page.keyboard.press('ArrowLeft');await page.keyboard.type('!');await persist();assert.equal(await text(),'A page, a thought.!');
for (const [type,data] of [['deleteContentForward',null],['historyUndo',null],['insertReplacementText','AUTOCORRECT'],['insertFromPaste','PASTE']]) await page.locator('#key-input').evaluate((el,{type,data})=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:type,data,bubbles:true,cancelable:true})),{type,data});
await persist();assert.equal(await text(),'A page, a thought.!');
await page.waitForTimeout(120);
const before=await page.locator('#carriage').evaluate(el=>getComputedStyle(el).transform);
await page.keyboard.type(' x');await page.waitForTimeout(100);const after=await page.locator('#carriage').evaluate(el=>getComputedStyle(el).transform);assert.notEqual(before,after);
await page.keyboard.press('Enter');await page.keyboard.type('Buffered through return.');await page.waitForTimeout(600);assert.equal(await text(),'A page, a thought.! x\nBuffered through return.');
await page.reload();await page.waitForTimeout(250);assert.equal(await text(),'A page, a thought.! x\nBuffered through return.');assert.equal(await page.locator('.impression').count(),Array.from((await text()).replace(/\s/g,'')).length);
await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('Backspace');await page.locator('#tear-page').click();assert(await page.locator('.torn-page').count());await page.waitForTimeout(950);assert.equal(await page.locator('.torn-page').count(),0);
await page.mouse.click(720,400);await page.keyboard.type('a'.repeat(60));await persist();assert.equal((await text()).length,60);
let audio=await page.evaluate(()=>window.__audio);assert(audio.some(x=>x.duration>1 && x.duration<1.2),'real margin bell played');
await page.keyboard.type('b'.repeat(12));await persist();assert.equal((await text()).length,68);assert.equal(await page.locator('#margin-hint').textContent(),'Enter to return');
await page.keyboard.press('Enter');await page.keyboard.type('next');await page.waitForTimeout(700);assert((await text()).endsWith('\nnext'));
await page.keyboard.press('Escape');
const download=page.waitForEvent('download');await page.locator('#save-text').click();const file=await download;assert(file.suggestedFilename().endsWith('.txt'));assert.equal(await fs.readFile(await file.path(),'utf8'),await text());
const imageDownload=page.waitForEvent('download');await page.locator('#save-image').click();const png=await imageDownload;assert(png.suggestedFilename().endsWith('.png'));const pngBytes=await fs.readFile(await png.path());assert.equal(pngBytes.toString('hex',0,8),'89504e470d0a1a0a');
await page.locator('#sound-toggle').click();assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'),'false');await page.keyboard.press('Escape');const count=await page.evaluate(()=>window.__audio.length);await page.keyboard.type(' muted');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__audio.length),count);
await page.keyboard.press('Escape');assert.equal(await page.locator('#sheets option').count(),2);const options=await page.locator('#sheets option').evaluateAll(els=>els.map(e=>e.value));await page.locator('#sheets').selectOption(options[0]);await persist();assert.equal(await text(),'A page, a thought.! x\nBuffered through return.');
await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'menu-toggle');await page.keyboard.press('Enter');assert(await page.locator('#controls').evaluate(e=>e.open));await page.keyboard.press('Escape');
await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});let axe=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(axe.violations.map(v=>v.id),[]);
await page.keyboard.press('Escape');axe=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(axe.violations.map(v=>v.id),[]);await page.keyboard.press('Escape');
await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.type(' reduced');await persist();const transform=await page.locator('#carriage').evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(120);assert.equal(await page.locator('#carriage').evaluate(e=>getComputedStyle(e).transform),transform);
console.log('PASS desktop: append-only keyboard and beforeinput, movement, buffered returns, persistence, bell, lock, text/PNG exports, mute, archive, keyboard navigation, axe, reduced motion');

const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const mp=await mobile.newPage();await mp.goto(url);await mp.tap('#desk');
for(const char of ['t','e','h',' '])await mp.locator('#key-input').evaluate((el,char)=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:char,bubbles:true,cancelable:true})),char);
await mp.locator('#key-input').evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertReplacementText',data:'the ',bubbles:true,cancelable:true})));
await mp.locator('#key-input').evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.dispatchEvent(new CompositionEvent('compositionend',{data:'é',bubbles:true}));});
await mp.waitForTimeout(200);const mt=await mp.evaluate(k=>JSON.parse(localStorage.getItem(k)).documents[0].lines[0],STORAGE_KEY);assert.equal(mt,'teh é');
assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await mp.locator('#key-input').evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true})));assert(await mp.locator('#new-page-prompt').evaluate(e=>e.open));await mp.locator('#keep-typing').tap();
await mp.screenshot({path:'.shots/mobile-typed.png'});await mp.locator('#menu-toggle').tap();await mp.screenshot({path:'.shots/mobile-menu.png'});assert(await mp.locator('#controls').isVisible());
console.log('PASS mobile: touch focus, beforeinput, no replacement, IME commit, no overflow, menu');
assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors');
await browser.close();
