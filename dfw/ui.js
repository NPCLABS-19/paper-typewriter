import { STORAGE_KEY } from '../engine.js';
import { assess, quickRewrite } from './prose.js';
import { availableEngines, gpuRewrite, nativeRewrite } from './model.js';
import { localDay, deckFor, deckIndex, questionFor, includesWord, DECK_SIZE } from './daily.js?v=pronunciation';
import { playPronunciation, stopPronunciation } from './pronunciation.js';

const $ = id => document.getElementById(id);
function el(tag,text,className) {
  const node=document.createElement(tag);
  if(text!=null)node.textContent=text;
  if(className)node.className=className;
  return node;
}
function read(key) {
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
}
function store(key,value) {
  try{localStorage.setItem(key,JSON.stringify(value));}catch{ /* The current tab still works. */ }
}
const source=read(STORAGE_KEY);
const active=source?.documents?.find(page=>page.id===source.activeId);
const sheet=active?.lines?.join('\n') || '';
const draftKey=`paper.dfw.draft.${active?.id||'standalone'}`;
const draft=$('draft-input');
const output=$('rewrite');
const rewriteStatus=$('rewrite-status');
let run;
let engines={native:'unavailable',gpu:false};
let savedDraft;
draft.value=read(draftKey) ?? sheet;
$('use-sheet').hidden=!sheet.trim();
$('draft-origin').textContent=sheet && draft.value===sheet ? 'Loaded from your current sheet' : '';

function updateDraft() {
  const count=(draft.value.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)||[]).length;
  $('draft-count').textContent=`${count} ${count===1?'word':'words'}`;
  $('quick').disabled=count<5 || Boolean(run);
  $('ai').disabled=count<5 || Boolean(run);
}
draft.addEventListener('input',()=>{
  updateDraft();
  $('draft-origin').textContent='';
  clearTimeout(savedDraft);
  savedDraft=setTimeout(()=>store(draftKey,draft.value),160);
  if(output.textContent && !run) rewriteStatus.textContent='Draft changed. Run another pass to include your edits.';
});
window.addEventListener('pagehide',()=>{store(draftKey,draft.value);run?.abort();});
$('use-sheet').addEventListener('click',()=>{
  if(draft.value.trim()===sheet.trim()) {$('draft-origin').textContent='This sheet is already loaded';return;}
  draft.value=draft.value.trim() ? `${draft.value.trimEnd()}\n\n${sheet}` : sheet;
  draft.dispatchEvent(new Event('input'));
  $('draft-origin').textContent='Current sheet inserted';
  draft.focus();
});
updateDraft();

availableEngines().then(options=>{
  engines=options;
  $('ai').hidden=engines.native==='unavailable'&&!engines.gpu;
  const basic='The quick pass edits for rhythm and asides. Your draft stays on this device.';
  $('engine-note').textContent=engines.native==='available' ? 'Local AI is ready. Your draft stays on this device.' :
    engines.native!=='unavailable' ? 'Local AI may download the browser’s language model on first use. Your draft stays on this device.' :
    engines.gpu ? 'Local AI needs a one-time download of about 0.9 GB. Your draft stays on this device.' : basic;
  updateDraft();
});
function drawAssessment(text) {
  const details=assess(text);
  const metrics=el('dl',null,'metrics');
  for(const [name,value] of [['Words',details.words],['Sentences',details.sentences],['Avg. sentence',`${details.average} words`],['Asides',details.asides]]){
    const block=el('div');block.append(el('dt',name),el('dd',`${value}`));metrics.append(block);
  }
  const notes=el('ul',null,'assessment-notes');
  notes.append(...details.notes.map(note=>el('li',note)));
  $('assessment').replaceChildren(metrics,notes);
}
function setRewrite(text) {
  output.textContent=text;
  output.hidden=!text;
  $('rewrite-empty').hidden=Boolean(text);
  $('copy').hidden=!text;
  $('save').hidden=!text;
}
function revealReview(){
  if(!matchMedia('(max-width:600px)').matches)return;
  $('results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
$('quick').addEventListener('click',()=>{
  const original=draft.value.trim();
  drawAssessment(original);
  setRewrite(quickRewrite(original));
  rewriteStatus.textContent='Quick rewrite · rule-based edit';
  revealReview();
});
$('ai').addEventListener('click',async()=>{
  if(run)return;
  const original=draft.value.trim();
  if(original.length>5800){rewriteStatus.textContent='Local AI works best on shorter passages. Use up to 5,800 characters or try the quick rewrite.';revealReview();return;}
  drawAssessment(original);
  const prior=output.textContent;
  run=new AbortController();
  const signal=run.signal;
  updateDraft();
  $('stop').hidden=false;
  rewriteStatus.textContent='Preparing the on-device model…';
  revealReview();
  let result='';
  let lastPercent=-1;
  try {
    const method=engines.native==='unavailable' ? gpuRewrite : nativeRewrite;
    await method(original,{signal,
      progress(value){
        const percent=Math.min(100,Math.max(0,Math.round(value*100)));
        if(percent===lastPercent || signal.aborted)return;
        lastPercent=percent;
        rewriteStatus.textContent=percent<100 ? `Preparing the on-device model… ${percent}%` : 'Rewriting on this device…';
      },
      chunk(part){if(signal.aborted)return;result+=part;output.textContent=result.trimStart();output.hidden=false;$('rewrite-empty').hidden=true;},
    });
    if(!result.trim())throw new Error('The model returned no text.');
    setRewrite(result.trim());
    rewriteStatus.textContent=draft.value.trim()===original ? 'On-device AI rewrite' : 'On-device rewrite of the earlier draft. Run again to include your edits.';
  } catch {
    setRewrite(prior);
    rewriteStatus.textContent=signal.aborted ? 'Rewrite stopped.' : 'The on-device model could not finish. Try again or use Assess & rewrite.';
  } finally {
    run=undefined;
    $('stop').hidden=true;
    updateDraft();
  }
});
$('stop').addEventListener('click',()=>run?.abort());
$('copy').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(output.textContent);rewriteStatus.textContent='Rewrite copied.';}
  catch {rewriteStatus.textContent='Could not access the clipboard. Select the text to copy it, or save it as a file.';}
});
$('save').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([output.textContent],{type:'text/plain;charset=utf-8'}));
  const link=el('a');link.href=url;link.download='dfw-rewrite.txt';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

let wordBank;
let day;
let deck=[];
let exercise;
let training=false;
let loading=false;
const progressKey=()=>`paper.dfw.vocab.${day.id}`;
function readExercise(){
  const old=read(progressKey());
  if(old && Number.isInteger(old.cursor) && Array.isArray(old.answers) && Array.isArray(old.uses))return old;
  return {cursor:0,answers:[],uses:[]};
}
function pronunciationButton(word,position) {
  const button=el('button',null,'pronounce');
  const label=`Hear ${word} in British English`;
  button.type='button';
  button.title=label;
  button.setAttribute('aria-label',label);
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5 5 9H2v6h3l5 4zM14 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/></svg>';
  button.addEventListener('click',()=>{
    $('pronunciation-status').textContent='';
    playPronunciation(deckIndex(wordBank.length,day),position,word,state=>{
      button.dataset.audio=state;
      if(state==='error')$('pronunciation-status').textContent=`Could not play “${word}”. Tap the speaker to try again.`;
    });
  });
  return button;
}
function renderWords() {
  $('word-list').replaceChildren(...deck.map(([word,pos,definition,example],i)=>{
    const row=el('li');
    const heading=el('div',null,'word-heading');
    heading.append(el('h3',word),pronunciationButton(word,i),el('span',pos,'pos'));
    row.append(el('span',String(i+1).padStart(2,'0'),'number'),heading,el('p',definition),el('p',example,'example'));
    return row;
  }));
}
function refreshDay() {
  const next=localDay();
  if(day?.id===next.id || !wordBank)return;
  stopPronunciation();
  day=next;
  deck=deckFor(wordBank,day);
  exercise=readExercise();
  training=false;
  $('practice').hidden=true;
  $('practice-start').hidden=false;
  $('word-list').hidden=false;
  $('day-label').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date());
  $('practice-start').disabled=false;
  updatePracticeLink();
  renderWords();
}
async function loadWords() {
  if(wordBank){refreshDay();return;}
  if(loading)return;
  loading=true;
  $('words-status').textContent='Loading today’s words…';
  try {
    const response=await fetch(new URL('../assets/dfw/words.json',import.meta.url));
    if(!response.ok)throw new Error('Word list is unavailable.');
    wordBank=await response.json();
    if(wordBank.length<DECK_SIZE)throw new Error('Word list is incomplete.');
    $('words-status').textContent='';
    refreshDay();
  }catch{
    wordBank=undefined;
    $('words-status').textContent='Could not load the words. ';
    const retry=el('button','Try again','quiet');retry.addEventListener('click',loadWords,{once:true});$('words-status').append(retry);
  }finally{loading=false;}
}
function updatePracticeLink(){
  $('practice-start').textContent=exercise.cursor>=deck.length?'See your score':exercise.answers.length?'Continue quiz':'Play the quiz';
}
function saveExercise(){store(progressKey(),exercise);updatePracticeLink();}
function renderQuiz(moveFocus=false) {
  if(!training)return;
  stopPronunciation();
  const index=exercise.cursor;
  const answered=exercise.answers[index];
  const completed=index>=deck.length;
  $('practice').hidden=false;
  $('practice-start').hidden=true;
  $('word-list').hidden=true;
  $('quiz-title').textContent=completed?'Today’s score':'Match the meaning';
  $('quiz-progress').textContent=completed?`${deck.length} / ${deck.length}`:`${index+1} / ${deck.length}`;
  $('choices').replaceChildren();
  $('quiz-feedback').textContent='';
  $('quiz-pronounce').replaceChildren();
  $('sentence-form').hidden=true;
  $('sentence-input').value=exercise.uses[index]||'';
  $('quiz-next').hidden=!answered&&!completed;
  $('quiz-next').textContent=completed?'Play again':index===deck.length-1?'See your score':'Next word';
  if(completed){
    const total=deck.reduce((n,entry,i)=>n+Number(exercise.answers[i]===entry[0]),0);
    const sentences=exercise.uses.filter(Boolean).length;
    $('quiz-definition').textContent=`${total} of ${deck.length} meanings matched. ${sentences} ${sentences===1?'word used':'words used'} in your own sentences.`;
  }else{
    const {answer,choices}=questionFor(deck,index,day.index);
    $('quiz-definition').textContent=answer[2];
    $('choices').append(...choices.map(word=>{
      const button=el('button',word);button.type='button';
      if(answered){
        button.disabled=true;
        if(word===answer[0])button.dataset.result='correct';
        else if(word===answered)button.dataset.result='wrong';
      }else button.addEventListener('click',()=>{exercise.answers[index]=word;saveExercise();renderQuiz();$('quiz-feedback').focus();});
      return button;
    }));
    if(answered){
      $('quiz-feedback').textContent=answered===answer[0]?`Correct. ${answer[3]}`:`The word is ${answer[0]}. ${answer[3]}`;
      $('quiz-pronounce').append(pronunciationButton(answer[0],index));
      $('sentence-label').textContent=`Try using “${answer[0]}” in a sentence.`;
      $('sentence-form').hidden=false;
    }
  }
  if(moveFocus)$('quiz-title').focus();
}
$('practice-start').addEventListener('click',()=>{training=true;renderQuiz(true);});
$('practice-close').addEventListener('click',()=>{
  stopPronunciation();
  training=false;
  $('practice').hidden=true;
  $('word-list').hidden=false;
  $('practice-start').hidden=false;
  $('practice-start').focus();
});
$('quiz-next').addEventListener('click',()=>{
  if(exercise.cursor>=deck.length)exercise={cursor:0,answers:[],uses:[]};
  else exercise.cursor++;
  saveExercise();renderQuiz(true);
});
$('sentence-form').addEventListener('submit',event=>{
  event.preventDefault();
  const word=deck[exercise.cursor][0];
  const value=$('sentence-input').value.trim();
  if(value.split(/\s+/).length<5 || !includesWord(value,word)){
    $('quiz-feedback').textContent=`Write at least five words and include “${word}” or an inflected form.`;
    return;
  }
  exercise.uses[exercise.cursor]=value;
  saveExercise();
  $('quiz-feedback').textContent=`Found “${word}” or an inflected form in your sentence. Read it back and check that the meaning fits.`;
  $('quiz-next').focus();
});
function showView() {
  const words=location.hash==='#words';
  if(!words)stopPronunciation();
  $('draft').hidden=words;
  $('words').hidden=!words;
  $(words?'words-nav':'draft-nav').setAttribute('aria-current','page');
  $(words?'draft-nav':'words-nav').removeAttribute('aria-current');
  if(words)loadWords();
}
window.addEventListener('hashchange',showView);
document.addEventListener('visibilitychange',()=>{if(!document.hidden && !$('words').hidden)refreshDay();});
setInterval(()=>{if(!$('words').hidden)refreshDay();},30000);
showView();
