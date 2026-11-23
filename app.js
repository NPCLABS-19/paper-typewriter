import { Typewriter, COLUMNS } from './engine.js?v=archive';
import { MechanicalSound } from './sound.js?v=mechanics-2';
import { MACHINES, draftMachine } from './profiles.js?v=archive';
import { loadArchive, saveArchive, saveBackup } from './archive.js';

const $ = s => document.querySelector(s);
const root = document.documentElement;
const input = $('#key-input');
// Keep a character behind the native caret so phone keyboards send Backspace.
const inputAnchor = '\u2060';
const eraseKey = Symbol('erase');
const ribbonTexture = new Image();
ribbonTexture.src = new URL('./assets/ribbon-ink.png', import.meta.url).href;
const impressions = $('#impressions');
const carriage = $('#carriage');
const paper = $('#paper');
const paperStock = $('#paper-stock');
const writingPoint = $('#writing-point');
const guide = $('#guide');
const typebar = $('#typebar');
const slug = $('#type-slug');
const headRail = $('#head-rail');
const menu = $('#controls');
const pagePrompt = $('#new-page-prompt');
const menuToggle = $('#menu-toggle');
const readable = $('#readable-document');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(pointer: coarse)');
const gsap = window.gsap;
const { db, stored } = await loadArchive();
let archiveDatabase = db;
const machine = new Typewriter(stored);
const openingURL = new URL(location.href);
const requestedSheet = openingURL.searchParams.get('draft');
if (requestedSheet) {
  machine.select(requestedSheet);
  openingURL.searchParams.delete('draft');
  history.replaceState(null,'',openingURL);
}
const sound = new MechanicalSound();
let profileId = 'olympia';
let rig;
let autoTimer;
let virtualShift = false;
const ribbonProfiles = {o:MACHINES.olympia,l:MACHINES.lettera,s:MACHINES.selectric};
try {
  const preferences = JSON.parse(localStorage.getItem('paper.preferences') || '{}');
  sound.enabled = preferences.sound !== false;
  sound.setVolume(typeof preferences.volume === 'number' ? preferences.volume : .65);
  if (Object.hasOwn(MACHINES,preferences.machine)) profileId = preferences.machine;
} catch {}
if (requestedSheet && machine.activeId === requestedSheet) profileId = draftMachine(machine.current) || profileId;
sound.select(profileId);
if (requestedSheet) persistPreferences();
let cw = 12, lh = 29;
let paperHeight = 0;
let paperLeft = 0;
let writingInset = 32;
let inset = 32;
let displayColumns = COLUMNS;
let rowStarts = [0];
let rowWraps = [[0]];
let anchor = { x: innerWidth / 2, y: innerHeight * .58 };
const driver = { feed: 0, review: 0, headX: 0 };
let strikeTween;
let returning = false;
let tearing = false;
let pending = [];
let saveTimer;
let hideControls;
let isComposing = false;
let lastComposition = '';
let lastCompositionAt = 0;
let storageNoticeShown = false;

function toast(message) {
  $('#toast').textContent = message;
  gsap.killTweensOf('#toast');
  gsap.set('#toast', {opacity: 1, y: 0});
  gsap.to('#toast', {opacity: 0, y: -3, duration: reduceMotion.matches ? 0 : .4, delay: 2.1});
}
function persist(immediate = false) {
  clearTimeout(saveTimer);
  const write = () => {
    const recent = machine.documents.slice(-10);
    if (!recent.includes(machine.current)) recent.unshift(machine.current);
    function backup() {
      try {
        saveBackup(machine.activeId,archiveDatabase ? recent : machine.documents);
        return true;
      } catch { return false; }
    }
    function showStorage(available) {
      if (!available && !storageNoticeShown) {
        toast('Browser storage is unavailable. Save a copy from the menu.');
        storageNoticeShown = true;
      }
      $('#storage-status').textContent = available ? 'Drafts stay saved in this browser.' : 'Browser storage is unavailable. Save a copy.';
    }
    // A synchronous snapshot covers navigation while the archive transaction finishes.
    const backedUp = backup();
    if (!archiveDatabase) { showStorage(backedUp); return; }
    saveArchive(archiveDatabase,[structuredClone(machine.current)]).then(() => showStorage(true)).catch(() => {
      archiveDatabase = undefined;
      showStorage(backup() || backedUp);
    });
  };
  if (immediate) write(); else saveTimer = setTimeout(write, 120);
}
function persistPreferences() {
  try { localStorage.setItem('paper.preferences', JSON.stringify({sound: sound.enabled, volume: sound.volume, machine: profileId})); } catch {}
}
function updateSoundControls() {
  $('#sound-toggle').setAttribute('aria-pressed', String(sound.enabled));
  $('#volume').value = String(Math.round(sound.volume * 100));
}
function applyCarriage() {
  const offset = driver.review - driver.feed;
  const travel = rig && MACHINES[profileId].kind === 'manual' ? innerWidth / 2 - driver.headX : 0;
  paper.style.setProperty('--carriage-travel', `${travel}px`);
  gsap.set([carriage, paperStock], {y: offset});
  gsap.set(guide, {x: driver.headX});
  const reviewing = driver.review > 1;
  if (guide.hidden !== reviewing) {
    guide.hidden = reviewing;
    headRail.hidden = reviewing;
  }
  rig?.frame({x:driver.headX,feed:-offset});
}
function displayPosition(row, column) {
  const offsets = rowWraps[row];
  const wrap = offsets.findLastIndex(start => start <= column);
  const x = column - offsets[wrap];
  return [x % displayColumns, rowStarts[row] + wrap + Math.floor(x / displayColumns)];
}
function wrapOffsets(line) {
  const characters = Array.from(line);
  const offsets = [0];
  let start = 0;
  while (characters.length - start > displayColumns) {
    const limit = start + displayColumns;
    const space = characters.lastIndexOf(' ', limit - 1);
    start = space > start ? space + 1 : limit;
    offsets.push(start);
  }
  return offsets;
}
function layoutRows() {
  let next = 0;
  rowWraps = machine.current.lines.map(wrapOffsets);
  rowStarts = rowWraps.map(offsets => {
    const start = next;
    next += offsets.length;
    return start;
  });
}
function layoutActiveLine() {
  const offsets = wrapOffsets(machine.current.lines[machine.row]);
  const previous = rowWraps[machine.row];
  if (offsets.length === previous.length && offsets.every((offset, i) => offset === previous[i])) return;
  rowWraps[machine.row] = offsets;
  for (let node = impressions.lastElementChild; node && Number(node.dataset.row) === machine.row; node = node.previousElementSibling) {
    positionImpression(node, machine.row, Number(node.dataset.column));
  }
}
function headPosition(column) {
  return paperLeft + inset + (column + .5) * cw;
}
function updateWritingPoint() {
  const position = machine.full ? machine.column - 1 : machine.column;
  const [column, row] = displayPosition(machine.row, position);
  writingPoint.style.left = `${(column + (machine.full ? 1 : 0)) * cw + 1}px`;
  writingPoint.style.top = `${row * lh + lh * .73}px`;
  const feed = row * lh;
  paperStock.style.height = `${paperHeight + Math.max(feed, driver.feed)}px`;
  const blank = machine.row === 0 && machine.column === 0;
  paper.dataset.blank = blank;
  const parked = blank && rig && MACHINES[profileId].kind === 'manual';
  return {feed, headX: parked ? innerWidth / 2 : headPosition(column + (machine.full ? 1 : 0))};
}
function positionImpression(node, row, column) {
  const [x, y] = displayPosition(row, column);
  node.style.left = `${x * cw}px`;
  node.style.top = `${y * lh}px`;
}
function measure() {
  const css = getComputedStyle(root);
  cw = parseFloat(css.getPropertyValue('--char'));
  lh = parseFloat(css.getPropertyValue('--line'));
  const view = window.visualViewport;
  const height = view ? view.height : innerHeight;
  const offsetTop = view?.offsetTop || 0;
  const narrow = innerWidth <= 740 || (touch.matches && innerWidth <= 950);
  root.classList.toggle('keyboard-open', narrow && height < innerHeight * .76);
  const platenPosition = narrow ? (height < 440 ? .61 : .705) : .54;
  anchor = {x: innerWidth / 2, y: offsetTop + height * (rig ? platenPosition : narrow ? .72 : .575)};
  root.style.setProperty('--stage-height', `${height}px`);
  root.style.setProperty('--stage-offset', `${offsetTop}px`);
  root.style.setProperty('--guide-x', `${anchor.x}px`);
  root.style.setProperty('--guide-y', `${anchor.y}px`);
  input.style.top = `${anchor.y - 30}px`;
  inset = parseFloat(getComputedStyle(paper).paddingLeft);
  paperHeight = paper.clientHeight;
  const bounds = paper.getBoundingClientRect();
  paperLeft = (innerWidth - bounds.width) / 2;
  writingInset = Math.max(8, paperHeight - lh * .73 - (narrow ? 43 : 59));
  root.style.setProperty('--writing-inset', `${writingInset}px`);
  root.style.setProperty('--strike-y', `${bounds.top + writingInset + lh * .73}px`);
  rig?.resize(innerWidth,innerHeight,bounds.width,bounds.top+writingInset+lh*.73);
  const width = paper.clientWidth - 2 * inset;
  const textWidth = narrow && rig ? Math.min(width, innerWidth/2 - 15) : width;
  displayColumns = Math.max(1, Math.min(COLUMNS, Math.floor(textWidth / cw)));
  if (narrow && rig) inset = (paper.clientWidth - displayColumns*cw)/2;
  paper.style.setProperty('--writing-left', `${inset}px`);
  layoutRows();
  for (const node of impressions.children) {
    positionImpression(node, Number(node.dataset.row), Number(node.dataset.column));
  }
  Object.assign(driver, updateWritingPoint());
  driver.review = Math.min(driver.review, driver.feed);
  applyCarriage();
}
function inkVariation(index, char, profile) {
  const n = Math.abs(Math.sin((index + 1) * 127.1 + char.codePointAt(0) * 311.7) * 43758.5453) % 1;
  const density = Math.round(n * profile.variation * 49);
  return {opacity: 1 - n * profile.variation, pressure: profile.pressure + n * profile.variation * 1.5,
    color:`rgb(${profile.ink.map(channel=>channel+density).join(' ')})`, grainOffset: Math.floor(n * 96),
    y: (n - .5) * profile.variation * 3, angle: (n - .5) * profile.variation * 4};
}
function impression(char, row, column) {
  if (char === ' ') return;
  const node = document.createElement('span');
  node.className = 'impression';
  node.textContent = char;
  node.dataset.row = row;
  node.dataset.column = column;
  positionImpression(node, row, column);
  const stamp = ribbonProfiles[machine.ribbonAt(row,column)] || MACHINES.olympia;
  const variation = inkVariation(row * COLUMNS + column, char, stamp);
  node.style.opacity = variation.opacity;
  node.style.setProperty('--ink-pressure', `${variation.pressure}px`);
  node.style.setProperty('--ribbon-color', variation.color);
  node.style.translate = `0 ${variation.y}px`;
  node.style.rotate = `${variation.angle}deg`;
  impressions.append(node);
  return node;
}
function updateReadable() {
  // Update text at line boundaries and after a short pause without announcing every letter.
  clearTimeout(updateReadable.timer);
  updateReadable.timer = setTimeout(() => { readable.textContent = machine.text; }, 200);
}
function refreshSheets() {
  const sheets=document.createDocumentFragment();
  for (const doc of machine.documents) {
    const option = new Option(`Page ${String(doc.number).padStart(2, '0')}${doc.lines.some(l => l.length) ? ' · ' + (doc.lines.find(l => l.trim()) || '').trim().slice(0, 16) : ' · blank'}`, doc.id);
    option.selected = doc.id === machine.activeId;
    sheets.append(option);
  }
  $('#sheets').replaceChildren(sheets);
}
function renderDocument() {
  clearTimeout(autoTimer);
  impressions.replaceChildren();
  layoutRows();
  machine.current.lines.forEach((line, row) => Array.from(line).forEach((char, column) => impression(char, row, column)));
  gsap.killTweensOf(driver);
  driver.feed = 0;
  slug.textContent = '';
  Object.assign(driver, {review: 0, ...updateWritingPoint()});
  applyCarriage();
  readable.textContent = machine.text;
  refreshMarginHint();
  refreshSheets();
}
function refreshMarginHint() {
  const show = machine.full && !MACHINES[profileId].autoReturn;
  const hint = $('#margin-hint');
  gsap.set(hint,{opacity:show?1:0,overwrite:true});
  hint.textContent = show ? 'Enter to return' : '';
}
function strikeMotion(char, row, column, node) {
  if (reduceMotion.matches) return;
  const [strikeColumn] = displayPosition(row, column);
  gsap.killTweensOf(driver);
  driver.headX = headPosition(strikeColumn);
  applyCarriage();
  if (rig) {
    rig.strike(char);
    node.style.setProperty('--impact-delay',`${MACHINES[profileId].strike}s`);
    node.classList.add('fresh-impression');
    return;
  }
  slug.textContent = char;
  strikeTween?.kill();
  strikeTween = gsap.timeline()
    .to(typebar, {yPercent: -95, rotateX: 0, duration: .037, ease: 'power2.in'})
    .to(typebar, {yPercent: 0, rotateX: 14, duration: .096, ease: 'power3.out'}, '+=.012');
  node.classList.add('fresh-impression');
}
function showMargin() {
  $('#margin-hint').textContent = 'Enter to return';
  gsap.to('#margin-hint', {opacity: 1, duration: reduceMotion.matches ? 0 : .2, overwrite: true});
}
function eraseCharacter() {
  if (tearing) return;
  if (returning) {
    pending.push(eraseKey);
    return;
  }
  const erased = machine.eraseLast();
  if (!erased) return;
  clearTimeout(autoTimer);
  rig?.press('Backspace');
  rig?.step();
  if (erased.char !== ' ' && erased.char !== '\n') impressions.lastElementChild.remove();
  sound.space();
  if (machine.full) showMargin();
  else {
    gsap.set('#margin-hint', {opacity: 0, overwrite: true});
    $('#margin-hint').textContent = '';
  }
  if (erased.char === '\n') layoutRows();
  else layoutActiveLine();
  movePaper(.12);
  persist();
  updateReadable();
}
function writeCharacter(char) {
  if (tearing) return;
  if (returning) { pending.push(char); return; }
  const profile = MACHINES[profileId];
  // Start the physical carriage at the left margin only when a blank sheet is used.
  if (rig && profile.kind === 'manual' && !reduceMotion.matches && machine.row === 0 && machine.column === 0 && Math.abs(driver.headX-innerWidth/2)<1) {
    returning = true;
    pending.push(char);
    rig.return(.18, true);
    sound.space();
    gsap.to(driver,{headX:headPosition(0),duration:.18,ease:'power2.inOut',overwrite:true,onUpdate:applyCarriage,onComplete:finishReturn});
    return;
  }
  if (machine.full && profile.autoReturn) {
    returnCarriage(true);
    if (returning) {pending.push(char);return;}
  }
  const result = machine.type(char,profileId[0]);
  if (!result.accepted) {
    if (result.locked) {rig?.press(char);sound.locked();showMargin();}
    return;
  }
  layoutActiveLine();
  if (char === ' ') {rig?.press(' ');rig?.step();sound.space();}
  else {
    sound.strike(result.column);
    const node = impression(char, result.row, result.column);
    strikeMotion(char, result.row, result.column, node);
  }
  movePaper(profile.step, undefined, char === ' ' ? 0 : profile.strike);
  if (result.bell && !profile.autoReturn) {rig?.ding();sound.bell();}
  if (machine.full) {
    if (profile.autoReturn) autoTimer = setTimeout(()=>returnCarriage(true),(profile.strike+profile.step)*1000);
    else showMargin();
  }
  persist(); updateReadable();
}
function returnCarriage(automatic = false) {
  if (tearing) return;
  if (returning) { pending.push('\n'); return; }
  clearTimeout(autoTimer);
  const distance = machine.returnCarriage();
  const profile = MACHINES[profileId];
  const duration = profile.returnBase + (distance / COLUMNS) * profile.returnTravel;
  rig?.return(duration,automatic);
  sound.carriage(duration, distance);
  returning = true;
  gsap.to('#margin-hint', {opacity: 0, duration: .12});
  layoutRows();
  movePaper(duration, finishReturn);
  persist(); updateReadable();
}
function movePaper(duration, onComplete, delay = 0) {
  const target = updateWritingPoint();
  const instant = reduceMotion.matches;
  gsap.to(driver, {
    ...target, review: 0, duration: instant ? 0 : duration, delay: instant ? 0 : delay,
    ease: returning ? MACHINES[profileId].autoReturn ? 'power4.inOut' : 'power3.inOut' : 'power2.out', overwrite: true, onUpdate: applyCarriage, onComplete,
  });
}
function finishReturn() {
  returning = false;
  const buffered = pending;
  pending = [];
  for (const key of buffered) {
    if (key === '\n') returnCarriage();
    else if (key === eraseKey) eraseCharacter();
    else writeCharacter(key);
  }
}
function appendText(text) {
  for (const char of Array.from(text)) {
    if (char === '\n' || char === '\r') returnCarriage();
    else if (char === '\t') { for (const result of machine.tab()) if (result.bell) sound.bell(); layoutActiveLine(); movePaper(.058); persist(); }
    else writeCharacter(char);
  }
}
function focusPaper() {
  if (!menu.open && !pagePrompt.open) input.focus({preventScroll: true});
}
function resetNativeInput() {
  input.value = inputAnchor;
  input.setSelectionRange(inputAnchor.length, inputAnchor.length);
}
function revealControls() {
  document.body.classList.add('show-controls');
  clearTimeout(hideControls);
  hideControls = setTimeout(() => { if (!menu.open) document.body.classList.remove('show-controls'); }, 1700);
}
function openMenu() {
  if (menu.open || pagePrompt.open || tearing) return;
  refreshSheets();
  persist(true);
  menu.showModal();
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('show-controls');
  if (!reduceMotion.matches) gsap.fromTo(menu, {y: 8, opacity: 0}, {y: 0, opacity: 1, duration: .18, ease: 'power2.out'});
}
function closeMenu() { menu.close(); }
$('#touch-type').addEventListener('click',()=>{sound.unlock();focusPaper();});
$('#touch-return').addEventListener('click',()=>{sound.unlock();focusPaper();returnCarriage();});
function activateControl(control) {
  if (!control || menu.open || pagePrompt.open || tearing) return;
  if (control === '⇧') {
    virtualShift = !virtualShift;
    rig?.shift(virtualShift,'ShiftLeft');
    sound.shift();
  } else if (control === '↵' || control === 'feed') returnCarriage();
  else if (control === '⌫') eraseCharacter();
  else {
    const upper = '1234567890-=[];,./';
    const symbols = '!@#$%^&*()_+{}:<>?';
    const shifted = symbols[upper.indexOf(control)] || control;
    writeCharacter(control === 'SPACE' ? ' ' : virtualShift ? shifted : control.toLowerCase());
    if (virtualShift) {virtualShift=false;rig?.shift(false,'ShiftLeft');}
  }
}
menu.addEventListener('close', () => { menuToggle.setAttribute('aria-expanded', 'false'); revealControls(); focusPaper(); });
menu.addEventListener('cancel', event => {event.preventDefault();closeMenu();});
menu.addEventListener('click', event => { if (event.target !== menu) return; const rect=menu.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeMenu(); });
menuToggle.addEventListener('click', () => {sound.unlock();menu.open ? closeMenu() : openMenu();});
$('#desk').addEventListener('pointerdown', event => {
  if (event.target.closest('button,dialog,a,input,select,#machines') || pagePrompt.open) return;
  sound.unlock();
  if(event.pointerType==='touch') {
    touchReview={id:event.pointerId,x:event.clientX,y:event.clientY,startY:driver.review,dragged:false};
    $('#desk').setPointerCapture(event.pointerId);
  } else {
    focusPaper();
    activateControl(rig?.pick(event.clientX,event.clientY));
  }
});
let touchReview=null;
$('#desk').addEventListener('pointermove',event=>{
  if(!touchReview || touchReview.id!==event.pointerId || menu.open || pagePrompt.open || tearing || returning)return;
  const dx=event.clientX-touchReview.x,dy=event.clientY-touchReview.y;
  if(Math.abs(dx)+Math.abs(dy)>10)touchReview.dragged=true;
  if(!touchReview.dragged)return;
  gsap.killTweensOf(driver);
  driver.review=Math.max(0,Math.min(driver.feed,touchReview.startY+dy));
  applyCarriage();
});
function endReview(event){
  if(!touchReview || event.pointerId!==touchReview.id)return;
  if(!touchReview.dragged) {
    const control=rig?.pick(event.clientX,event.clientY);
    if(control) activateControl(control);
    else focusPaper();
  }
  touchReview=null;
}
$('#desk').addEventListener('pointerup',endReview);
$('#desk').addEventListener('pointercancel',()=>{touchReview=null;});
const lighting = {x: .46, y: .32};
function applyLighting() {
  gsap.set(paper, {'--light-x': `${36 + lighting.x * 22}%`, '--light-y': `${12 + lighting.y * 28}%`});
  if (rig) {rig.light(lighting.x,lighting.y);return;}
  const photo = $('.typewriter-front').getBoundingClientRect();
  gsap.set('#desk', {'--reflect-x': `${(lighting.x * innerWidth - photo.left) / photo.width * 100}%`, '--reflect-y': `${(lighting.y * innerHeight - photo.top) / photo.height * 100}%`});
}
document.addEventListener('pointermove', event => {
  revealControls();
  if (reduceMotion.matches || touch.matches) return;
  gsap.to(lighting, {x: event.clientX / innerWidth, y: event.clientY / innerHeight, duration: .3, ease: 'power2.out', overwrite: true, onUpdate: applyLighting});
}, {passive: true});
document.addEventListener('pointerleave', () => {
  if (!reduceMotion.matches) gsap.to(lighting, {x: .46, y: .32, duration: .7, ease: 'power2.out', overwrite: true, onUpdate: applyLighting});
});
document.addEventListener('pointerdown', () => {sound.unlock();}, {once: true});

async function readySound() { if (!sound.buffers.size) await sound.unlock(); }
// Physical keyboards are handled here. The textarea is only an input bridge for touch/IME.
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); if(pagePrompt.open)pagePrompt.close();else menu.open ? closeMenu() : openMenu(); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveText(); return; }
  if (menu.open || pagePrompt.open || tearing) return;
  if (event.target.closest?.('#machines') && [' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
  if (event.key === 'Tab') { revealControls(); return; } // keep native keyboard navigation
  if (event.metaKey || event.ctrlKey) {
    if (['z','y','x','v','a','b','i','u','Backspace','Delete'].includes(event.key) || ['Backspace','Delete'].includes(event.key)) event.preventDefault();
    return;
  }
  if (event.isComposing || event.key === 'Process' || isComposing) return;
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    focusPaper();
    eraseCharacter();
    return;
  }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Insert'].includes(event.key)) {event.preventDefault();return;}
  if (event.key === 'Shift' && !event.repeat) {rig?.shift(true,event.code);sound.unlock().then(() => sound.shift());return;}
  if (event.altKey && event.key.length !== 1) return;
  if (event.key === 'Enter' || event.key.length === 1) {
    // Enter/Space must activate a focused utility control normally.
    if (document.activeElement?.closest('button,a,select') && ['Enter',' '].includes(event.key)) return;
    event.preventDefault(); focusPaper();
    readySound().then(() => {});
    if (event.repeat) return; // a held mechanical key makes one impression
    if (event.key === 'Enter') returnCarriage(); else writeCharacter(event.key);
  }
});
document.addEventListener('keyup',event=>{if(event.key==='Shift')rig?.shift(false,event.code);});
window.addEventListener('blur',()=>{rig?.shift(false,'ShiftLeft');rig?.shift(false,'ShiftRight');});
input.addEventListener('beforeinput', event => {
  const type = event.inputType;
  if (event.isComposing || isComposing || type === 'insertCompositionText') return;
  event.preventDefault();
  sound.unlock();
  if(menu.open || pagePrompt.open || tearing) return;
  if(type === 'deleteContentBackward' || type === 'deleteContentForward') {
    if (event.cancelable) eraseCharacter();
    return;
  }
  if (type === 'insertText' && event.data) {
    if (event.data === lastComposition && performance.now() - lastCompositionAt < 80) return;
    appendText(event.data);
  } else if (type === 'insertLineBreak' || type === 'insertParagraph') returnCarriage();
  // Replacement, history, paste, drop and formatting operations are rejected.
});
input.addEventListener('input', event => {
  if (isComposing) return;
  if (!menu.open && !pagePrompt.open && (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward')) eraseCharacter();
  resetNativeInput();
});
input.addEventListener('compositionstart', () => {isComposing = true;});
input.addEventListener('compositionend', event => {
  isComposing = false;
  if (event.data) {lastComposition=event.data;lastCompositionAt=performance.now();appendText(event.data);}
  resetNativeInput();
});
for (const event of ['paste','cut','drop']) input.addEventListener(event, e => e.preventDefault());
$('#desk').addEventListener('wheel', event => {
  if (menu.open || pagePrompt.open || tearing || returning || !driver.feed || event.ctrlKey) return;
  event.preventDefault();
  const next = Math.max(0, Math.min(driver.feed, driver.review - event.deltaY));
  gsap.to(driver, {review: next, duration: reduceMotion.matches ? 0 : .15, overwrite: true, onUpdate: applyCarriage});
}, {passive: false});

function filename(ext) {
  const index = machine.current.number;
  return `paper-${String(index).padStart(2,'0')}-${new Date(machine.current.created).toISOString().slice(0,10)}.${ext}`;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function saveText() { persist(true); download(new Blob([machine.text], {type:'text/plain;charset=utf-8'}), filename('txt')); toast('Text saved'); }
async function saveImage() {
  const button = $('#save-image'); button.disabled = true;
  try {
    await document.fonts.load('30px Typewriter');
    await ribbonTexture.decode().catch(() => {});
    const scale = 1.34, pitch = 17.7, line = 45.6, margin = 116;
    const height = Math.max(2036, Math.ceil(margin * 2 + machine.current.lines.length * line));
    if (height > 30000) {toast('This sheet is very long. Use Print / save PDF.');return;}
    const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=height;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#f5efdf';ctx.fillRect(0,0,canvas.width,canvas.height);
    const grain=document.createElement('canvas');grain.width=180;grain.height=180;
    const g=grain.getContext('2d');const pixels=g.createImageData(180,180);
    for(let i=0;i<pixels.data.length;i+=4){const n=96+Math.random()*100;pixels.data.set([n,n,n-3,12],i);}g.putImageData(pixels,0,0);
    ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,canvas.width,canvas.height);
    const ribbon = ribbonTexture.naturalWidth ? ctx.createPattern(ribbonTexture, 'repeat') : null;
    ctx.font='29.5px Typewriter';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    machine.current.lines.forEach((text,row)=>Array.from(text).forEach((char,col)=>{
      if (char === ' ') return;
      const stamp = ribbonProfiles[machine.ribbonAt(row,col)] || MACHINES.olympia;
      const ink = inkVariation(row * COLUMNS + col, char,stamp);
      ctx.save();
      ctx.globalAlpha = ink.opacity;
      ctx.translate(margin + col * pitch, margin + row * line + ink.y * scale);
      ctx.rotate(ink.angle * Math.PI / 180);
      ribbon?.setTransform(new DOMMatrix().translate(ink.grainOffset, ink.grainOffset * 2).scale(scale / 2));
      ctx.fillStyle = stamp === MACHINES.olympia && ribbon ? ribbon : ink.color;
      ctx.strokeStyle = ink.color;
      ctx.lineWidth = ink.pressure * scale;
      ctx.strokeText(char, 0, 0);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }));
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('Image export failed');
    download(blob,filename('png'));toast('Paper saved');
  } catch {toast('Could not save the image. Try saving text or PDF.');}
  finally {button.disabled=false;}
}
function preparePrint() {
  const target=$('#print-output'); target.replaceChildren();
  const page=document.createElement('div');page.className='print-sheet';page.textContent=machine.text;target.append(page);
}
$('#save-text').addEventListener('click', saveText);
$('#save-image').addEventListener('click', saveImage);
$('#print-paper').addEventListener('click', () => {preparePrint();window.print();});
window.addEventListener('beforeprint',preparePrint);
$('#sound-toggle').addEventListener('click', () => {sound.enabled=!sound.enabled;sound.motor();updateSoundControls();persistPreferences();if(sound.enabled)sound.unlock().then(()=>sound.space());});
$('#volume').addEventListener('input', event => {sound.setVolume(Number(event.target.value)/100);persistPreferences();});
$('#volume').addEventListener('change',()=>sound.space());
$('#fullscreen').addEventListener('click', async () => {
  try {if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();closeMenu();}
  catch {toast('Use your browser’s fullscreen command.');}
});
if (!root.requestFullscreen) $('#fullscreen').hidden=true;
function askNewPage() {
  if(pagePrompt.open || tearing || returning) return;
  persist(true);
  if(menu.open)menu.close();
  pagePrompt.showModal();
  $('#keep-typing').focus();
  if(!reduceMotion.matches)gsap.fromTo(pagePrompt,{opacity:0,y:5},{opacity:1,y:0,duration:.16,ease:'power2.out'});
}
function tearAndStart() {
  if(tearing || returning)return;
  persist(true);tearing=true;
  const oldPage=document.createElement('div');oldPage.className='torn-page';oldPage.setAttribute('aria-hidden','true');
  const bounds=paper.getBoundingClientRect();
  Object.assign(oldPage.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`});
  const oldInk=document.createElement('div');oldInk.className='torn-ink';oldInk.style.transform=carriage.style.transform;oldInk.style.left=`${inset}px`;oldInk.style.top=`${writingInset}px`;oldInk.append(...Array.from(impressions.children, node => node.cloneNode(true)));oldPage.append(oldInk);
  if(!reduceMotion.matches)$('#desk').append(oldPage);
  if(pagePrompt.open)pagePrompt.close();if(menu.open)menu.close();
  machine.newDocument();pending=[];renderDocument();persist(true);
  rig?.loadSheet();
  sound.play('tear',{gain:.72,rate:1.35});
  const finish=()=>{oldPage.remove();tearing=false;focusPaper();};
  if(reduceMotion.matches){finish();return;}
  gsap.timeline({onComplete:finish})
    .to(oldPage,{y:-7,x:3,rotation:.35,duration:.12,ease:'power2.in'})
    .to(oldPage,{y:-innerHeight*1.2,x:innerWidth*.1,rotation:-4.5,skewX:2,duration:.72,ease:'power2.in'},'>');
}
pagePrompt.addEventListener('close',()=>{if(!tearing)focusPaper();});
pagePrompt.addEventListener('cancel',event=>{event.preventDefault();pagePrompt.close();});
$('#keep-typing').addEventListener('click',()=>pagePrompt.close());
$('#tear-page').addEventListener('click',tearAndStart);
$('#new-sheet').addEventListener('click',askNewPage);
$('#sheets').addEventListener('change', event => {
  if(returning)return;
  persist(true);
  machine.select(event.target.value);
  const original=draftMachine(machine.current);
  if(original && original!==profileId){
    profileId=original;
    sound.select(profileId);
    applyProfile();
    persistPreferences();
  }
  renderDocument();
  persist(true);
  closeMenu();
});
window.addEventListener('resize',measure);
window.visualViewport?.addEventListener('resize',measure);
window.visualViewport?.addEventListener('scroll',measure);
window.addEventListener('pagehide',()=>persist(true));
document.addEventListener('visibilitychange',()=>{sound.motor();if(document.hidden)persist(true);});
reduceMotion.addEventListener('change',()=>{gsap.killTweensOf(lighting);gsap.killTweensOf(driver);strikeTween?.kill();gsap.set(typebar,{yPercent:0,rotateX:14});Object.assign(driver,{review:0,...updateWritingPoint()});applyCarriage();if(returning)finishReturn();});
if(!navigator.platform.toLowerCase().includes('mac'))$('#save-shortcut').textContent='Ctrl S';
if(touch.matches)$('#review-help').textContent='Swipe the paper to read';
resetNativeInput();updateSoundControls();measure();renderDocument();persist(true);
const models = $('#machines');
function applyProfile() {
  models.querySelector(`[value="${profileId}"]`).checked = true;
  root.dataset.model = profileId;
  rig?.select(profileId);
  refreshMarginHint();
  if (!returning) {
    gsap.killTweensOf(driver);
    Object.assign(driver,updateWritingPoint());
  }
  applyCarriage();
}
models.addEventListener('change',event=>{
  if (!Object.hasOwn(MACHINES,event.target.value)) return;
  if (returning) {applyProfile();return;}
  clearTimeout(autoTimer);
  profileId=event.target.value;
  virtualShift=false;
  sound.select(profileId);
  sound.unlock();
  applyProfile();
  persistPreferences();
});
applyProfile();
import('./assets/machine.mjs?v=studio').then(({MechanicalRig})=>{
  const canvas=$('#machine-view');
  const next=new MechanicalRig(canvas);
  next.select(profileId);
  rig=next;
  canvas.hidden=false;
  root.classList.add('has-rig');
  measure();
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    rig=null;
    canvas.hidden=true;
    root.classList.remove('has-rig');
    measure();
  });
}).catch(()=>{});
// Decoding before the first gesture removes first-strike latency; no audio plays before input.
if (window.AudioContext || window.webkitAudioContext) {
  // The suspended context decodes samples; only a real gesture resumes playback.
  sound.warmAlternates();
}
// Global key handling lets typing start immediately while the first Tab reaches the skip link.
