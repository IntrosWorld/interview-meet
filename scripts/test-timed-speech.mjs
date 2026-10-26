import assert from 'node:assert/strict';
const t=performance.now();
const response=await fetch('http://127.0.0.1:8767/synthesize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Hello. Please tell me about your last project.'})});
assert.equal(response.status,200);const data=await response.json();
const audio=Buffer.from(data.audio,'base64');assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.toString('ascii',8,12),'WAVE');
let position=12,rate,alignment,bytes;
while(position+8<=audio.length){const id=audio.toString('ascii',position,position+4),size=audio.readUInt32LE(position+4);if(id==='fmt '){rate=audio.readUInt32LE(position+12);alignment=audio.readUInt16LE(position+20);}if(id==='data')bytes=size;position+=8+size+(size%2);}
const duration=bytes/(rate*alignment);
assert.ok(Number.isFinite(duration)&&duration>0);assert.ok(data.visemes.length>10);
assert.ok(data.visemes.every((v,i)=>Number.isInteger(v.id)&&v.id>=0&&v.id<=21&&v.time>=0&&v.time<=duration+.1&&v.duration>=0&&(!i||v.time>=data.visemes[i-1].time)));
console.log(JSON.stringify({renderMs:Math.round(performance.now()-t),audioSeconds:+duration.toFixed(3),visemeCount:data.visemes.length,checks:'WAV header, duration, sorted engine timestamps and viseme IDs passed'}));
