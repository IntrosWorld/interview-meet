// Windows SAPI's 22 visual speech classes mapped to Oculus mouth shapes.
export const SAPI_SHAPES=['sil','aa','aa','O','E','RR','I','U','O','O','aa','aa','kk','RR','nn','SS','CH','TH','FF','DD','kk','PP'];
export function sampleViseme(timeline,time) {
  if(time<0||time>=timeline.duration)return {shape:'sil',weight:0};
  const cues=timeline.visemes;
  let low=0,high=cues.length-1,index=-1;
  while(low<=high){const mid=(low+high)>>1;if(cues[mid].time<=time){index=mid;low=mid+1;}else high=mid-1;}
  if(index<0)return {shape:'sil',weight:0};
  const cue=cues[index],end=Math.min(cue.time+cue.duration,cues[index+1]?.time??timeline.duration);
  if(time>end+.025)return {shape:'sil',weight:0};
  const shape=SAPI_SHAPES[cue.id]||'sil';
  const fadeIn=Math.min(1,(time-cue.time)/.025),fadeOut=Math.min(1,Math.max(0,end-time)/.035);
  return {shape,weight:shape==='sil'?0:Math.max(.15,Math.min(fadeIn,fadeOut))};
}
