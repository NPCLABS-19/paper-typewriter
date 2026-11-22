import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const dir='.shots/revised';await fs.mkdir(dir,{recursive:true});
let browser;try{browser=await chromium.launch();}catch{browser=await chromium.launch({channel:'chrome'});}
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:4400/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);await page.screenshot({path:`${dir}/desktop-blank.png`});
await page.keyboard.type('Some things are worth putting on paper.',{delay:38});await page.keyboard.press('Enter');await page.waitForTimeout(350);await page.keyboard.type('A little room to write.',{delay:38});await page.waitForTimeout(300);await page.screenshot({path:`${dir}/desktop-writing.png`});
await page.mouse.move(740,650);await page.waitForTimeout(600);await page.screenshot({path:`${dir}/hover-guide.png`});
await page.mouse.move(150,180);await page.waitForTimeout(600);await page.screenshot({path:`${dir}/hover-left.png`});
await page.keyboard.press('Escape');await page.locator('#new-sheet').click();await page.waitForTimeout(250);await page.screenshot({path:`${dir}/new-page-prompt.png`});await page.locator('#tear-page').click();await page.waitForTimeout(340);await page.screenshot({path:`${dir}/tear-frame.png`});await page.waitForTimeout(650);await page.screenshot({path:`${dir}/fresh-page.png`});
await page.keyboard.press('Escape');await page.waitForTimeout(250);await page.screenshot({path:`${dir}/menu.png`});
const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});await mobile.goto('http://127.0.0.1:4400/');await mobile.evaluate(()=>document.fonts.ready);await mobile.tap('#desk');await mobile.keyboard.type('Paper, warm to the touch.',{delay:40});await mobile.waitForTimeout(250);await mobile.screenshot({path:`${dir}/mobile-writing.png`});await mobile.locator('#menu-toggle').tap();await mobile.locator('#new-sheet').tap();await mobile.waitForTimeout(250);await mobile.screenshot({path:`${dir}/mobile-prompt.png`});await mobile.locator('#keep-typing').tap();await mobile.locator('#menu-toggle').tap();await mobile.waitForTimeout(250);await mobile.screenshot({path:`${dir}/mobile-menu.png`});
await page.locator('#controls').evaluate(e=>e.close());await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.type('Still, and clear.');await page.waitForTimeout(200);await page.screenshot({path:`${dir}/reduced-motion.png`});
// Produce a social preview from real vector rendering rather than stock imagery.
const og=await browser.newPage({viewport:{width:1200,height:630}});await og.goto('http://127.0.0.1:4400/');await og.evaluate(()=>document.fonts.ready);await og.keyboard.type('A blank sheet.');await og.keyboard.press('Enter');await og.waitForTimeout(350);await og.keyboard.type('A little room to write.');await og.waitForTimeout(250);await og.screenshot({path:'assets/og.png'});
await browser.close();console.log('Captured revised desktop, mobile, hover, tear, reduced-motion and social preview');
