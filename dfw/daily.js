export const DECK_SIZE=20;
const EPOCH=Date.UTC(2026,10,23);
const DAY=86_400_000;
export function localDay(date=new Date()) {
  const year=date.getFullYear(),month=date.getMonth(),day=date.getDate();
  return {index:Math.round((Date.UTC(year,month,day)-EPOCH)/DAY),id:`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`};
}
export function deckFor(words,day) {
  const total=Math.floor(words.length/DECK_SIZE);
  if(!total) return [];
  const index=((day.index%total)+total)%total;
  return words.slice(index*DECK_SIZE,(index+1)*DECK_SIZE);
}
function shuffled(list,seed) {
  const items=[...list];
  for(let i=items.length-1;i>0;i--){
    seed=Math.imul(seed,1664525)+1013904223|0;
    const at=(seed>>>0)%(i+1);
    [items[i],items[at]]=[items[at],items[i]];
  }
  return items;
}
export function questionFor(deck,index,seed) {
  const answer=deck[index];
  const rivals=shuffled(deck.filter(entry=>entry[0]!==answer[0]),seed+index*97);
  const samePart=rivals.filter(entry=>entry[1]===answer[1]);
  const answers=[answer,...(samePart.length>=3?samePart:rivals).slice(0,3)];
  return {answer,choices:shuffled(answers,seed+index*337).map(entry=>entry[0])};
}
export function includesWord(sentence,word) {
  const term=word.toLowerCase();
  const stem=term.endsWith('e')?term.slice(0,-1):term;
  const variants=[term,`${term}s`,`${term}es`,`${stem}ed`,`${term}ed`,`${stem}ing`,`${term}ing`,`${term}ly`];
  if(term.endsWith('y')) variants.push(`${term.slice(0,-1)}ies`,`${term.slice(0,-1)}ied`);
  if(/[aeiou][bdgmnprt]$/.test(term)) variants.push(`${term}${term.at(-1)}ed`,`${term}${term.at(-1)}ing`);
  return (sentence.toLowerCase().match(/[\p{L}]+(?:-[\p{L}]+)*/gu)||[]).some(candidate=>variants.includes(candidate));
}
