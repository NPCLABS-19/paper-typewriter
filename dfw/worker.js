import { CreateMLCEngine } from '@mlc-ai/web-llm';
import { STYLE } from './prose.js';

let engine;
let busy=false;
self.addEventListener('message',async({data})=>{
  if (busy || data.type!=='rewrite') return;
  busy=true;
  try {
    if (!engine) engine=await CreateMLCEngine('Qwen2.5-1.5B-Instruct-q4f32_1-MLC',{
      initProgressCallback:({progress})=>self.postMessage({type:'progress',value:progress}),
    });
    self.postMessage({type:'ready'});
    const stream=await engine.chat.completions.create({
      stream:true, max_tokens:1500, temperature:.65,
      messages:[{role:'system',content:STYLE},{role:'user',content:data.text}],
    });
    for await(const part of stream){
      const value=part.choices[0]?.delta?.content;
      if(value) self.postMessage({type:'chunk',value});
    }
    self.postMessage({type:'done'});
  } catch {
    self.postMessage({type:'error'});
  } finally {busy=false;}
});
