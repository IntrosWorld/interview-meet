// WAV playback and facial cues share AudioContext.currentTime, not character-rate estimates.
export function createTimedVoiceQueue(getVoice,onStart,onState,onError=()=>{}) {
  let buffer='',first=true,generation=0,chain=Promise.resolve(),pending=0,context,nextTime=0,started=false;
  const sources=new Set(), controllers=new Set(), timers=new Set();
  function enqueue(text) {
    const voice=getVoice(); if(!voice || !text.trim()) return;
    const own=generation; pending++; onState(true);
    chain=chain.catch(()=>{}).then(async()=>{
      if(own!==generation)return;
      const controller=new AbortController(); controllers.add(controller);
      try {
        context ||= new AudioContext(); await context.resume();
        const response=await fetch('/api/synthesize',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Lab':'1'},signal:controller.signal,body:JSON.stringify({text:text.trim(),voice})});
        const data=await response.json(); if(!response.ok)throw Error(data.error);
        if(own!==generation)return;
        const bytes=Uint8Array.from(atob(data.audio),x=>x.charCodeAt(0));
        const audio=await context.decodeAudioData(bytes.buffer); if(own!==generation)return;
        const source=context.createBufferSource(); source.buffer=audio; source.connect(context.destination);
        const start=Math.max(context.currentTime+.025,nextTime); nextTime=start+audio.duration;
        const timeline={type:'audio',context,start,duration:audio.duration,visemes:data.visemes,text:text.trim()};
        window.dispatchEvent(new CustomEvent('interviewer:speech',{detail:timeline}));
        sources.add(source);
        const timer=setTimeout(()=>{timers.delete(timer);if(own===generation&&!started){started=true;onStart();}},Math.max(0,(start-context.currentTime)*1000));
        timers.add(timer);
        source.onended=()=>{
          sources.delete(source); source.disconnect(); if(own!==generation)return;
          pending--; onState(pending>0);
          if(!pending)window.dispatchEvent(new CustomEvent('interviewer:speech',{detail:{type:'end'}}));
        };
        source.start(start);
      } catch(error) {
        if(own===generation){pending--;onState(pending>0);if(error.name!=='AbortError')onError(error.message);}
      } finally {controllers.delete(controller);}
    });
  }
  return {
    push(chunk,flush=false){
      buffer+=chunk;
      while(buffer.trim()){
        let match=buffer.match(/^([\s\S]*?[.!?])(?:\s|$)/);
        if(!match&&first)match=buffer.match(/^((?:\s*\S+\s+){4})/);
        if(!match)break;
        enqueue(match[1]);buffer=buffer.slice(match[0].length);first=false;
      }
      if(flush&&buffer.trim()){enqueue(buffer);buffer='';}
    },
    cancel(){
      generation++;for(const c of controllers)c.abort();controllers.clear();for(const s of sources){try{s.stop();}catch{}}sources.clear();
      for(const t of timers)clearTimeout(t);timers.clear();buffer='';first=true;pending=0;started=false;nextTime=0;chain=Promise.resolve();
      onState(false);window.dispatchEvent(new CustomEvent('interviewer:speech',{detail:{type:'cancel'}}));
    }
  };
}
