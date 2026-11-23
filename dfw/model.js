import { STYLE } from './prose.js';

const language={expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]};
let worker;
export async function availableEngines() {
  let native='unavailable';
  try {if(globalThis.LanguageModel?.availability) native=await globalThis.LanguageModel.availability(language);}
  catch { /* A restricted browser can still use the quick pass. */ }
  return {native,gpu: Boolean(navigator.gpu)};
}
export async function nativeRewrite(text,{signal,progress,chunk}) {
  const session=await globalThis.LanguageModel.create({...language,signal,initialPrompts:[{role:'system',content:STYLE}],
    monitor(monitor){monitor.addEventListener('downloadprogress',event=>progress(event.loaded));},
  });
  try {
    progress(1);
    for await(const part of session.promptStreaming(text,{signal})) chunk(part);
  } finally {session.destroy();}
}
export function gpuRewrite(text,{signal,progress,chunk}) {
  if(signal.aborted) return Promise.reject(signal.reason);
  worker ||= new Worker(new URL('../assets/dfw/worker.mjs',import.meta.url),{type:'module',name:'dfw-local-writer'});
  return new Promise((resolve,reject)=>{
    function cleanup(){
      signal.removeEventListener('abort',abort);
      worker?.removeEventListener('message',message);
      worker?.removeEventListener('error',failed);
    }
    function abort(){cleanup();worker?.terminate();worker=undefined;reject(signal.reason);}
    function failed(){cleanup();worker?.terminate();worker=undefined;reject(new Error('Could not run a local language model.'));}
    function message({data}){
      if(data.type==='progress') progress(data.value);
      else if(data.type==='ready') progress(1);
      else if(data.type==='chunk') chunk(data.value);
      else if(data.type==='done') {cleanup();resolve();}
      else if(data.type==='error') failed();
    }
    signal.addEventListener('abort',abort,{once:true});
    worker.addEventListener('error',failed);
    worker.addEventListener('message',message);
    worker.postMessage({type:'rewrite',text});
  });
}
