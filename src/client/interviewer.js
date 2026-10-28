import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sampleViseme } from './audio-visemes.js';

const host = document.getElementById('avatar-stage');
const state = document.getElementById('avatar-state');
if (host) initialize().catch(error => {
  state.textContent = '3D view unavailable. Voice and text still work.';
  host.dataset.ready = 'error'; console.warn('Avatar renderer:', error.message);
});

async function initialize() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Animated 3D interviewer'); host.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#30353c');
  const camera = new THREE.PerspectiveCamera(16.45, 16 / 9, .05, 30);
  camera.position.set(.01, 1.62, 1.60); camera.lookAt(0, 1.57, 0);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = .18; room.dispose(); pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffe6cf, 2.2); key.position.set(-1.3, 2.8, 1.65); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-1; key.shadow.camera.right=1; key.shadow.camera.top=2; key.shadow.camera.bottom=0; key.shadow.normalBias=.005;
  key.target.position.set(0,1.5,0); scene.add(key,key.target);
  const fill = new THREE.DirectionalLight(0xbcd8ff,.7); fill.position.set(1.5,1.8,.8); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc68d,2); rim.position.set(.8,2.4,-.7); scene.add(rim);
  const ambient = new THREE.HemisphereLight(0xe8eef7,0x292c34,.35); scene.add(ambient);
  const loader = new GLTFLoader();
  const config=await fetch('/api/avatar').then(r=>r.ok?r.json():{}).catch(()=>({}));
  const [person,studio] = await Promise.all([loader.loadAsync(config.character||'/assets/models/interviewer.glb'),loader.loadAsync('/assets/models/interviewer-studio.glb')]);
  const faceMeshes=[], rest=new Map(); let head, neck;
  person.scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow=true; o.receiveShadow=true;
      if (o.morphTargetDictionary) faceMeshes.push(o);
      const mats=Array.isArray(o.material)?o.material:[o.material];
      for(const m of mats) { m.envMapIntensity=.35; if(m.map) m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy()); }
    }
    if(o.name==='Head') head=o;
    if(o.name==='Neck') neck=o;
  });
  for(const bone of [head,neck]) if(bone) rest.set(bone,bone.quaternion.clone());
  studio.scene.traverse(o=>{if(o.isMesh) o.receiveShadow=true;});
  scene.add(studio.scene,person.scene);
  await renderer.compileAsync(scene,camera);
  host.dataset.ready='true'; state.textContent='Ready';
  let phrase='', phraseStart=0, rate=14, speaking=false, boundaryStart=0, boundaryIndex=0, nextBlink=2.4, blinkStart=-10, time=0, frame, last=performance.now(), motion=true;
  let audioTimelines=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const debug={ready:true, speaking:false, frames:0, jaw:0, morphMeshes:faceMeshes.length, drawCalls:0};
  host.avatarDiagnostics=debug;
  function morph(name,value,smoothing=.3) {
    for(const mesh of faceMeshes) {
      const i=mesh.morphTargetDictionary[name];
      if(i!=null) mesh.morphTargetInfluences[i]=THREE.MathUtils.lerp(mesh.morphTargetInfluences[i],value,smoothing);
    }
  }
  function speech(event) {
    const d=event.detail;
    if(d.type==='audio'||d.type==='pcm'){audioTimelines.push(d);state.textContent=d.type==='pcm'?'Speaking · audio-driven':'Speaking · audio-timed';return;}
    if(d.type==='start') { phrase=d.text; phraseStart=time; boundaryStart=time; boundaryIndex=0; rate=14*(d.rate||1); speaking=true; state.textContent='Speaking'; }
    if(d.type==='boundary') { boundaryIndex=d.charIndex; boundaryStart=time; }
    if(d.type==='end'||d.type==='cancel') { speaking=false; audioTimelines=[];state.textContent='Ready'; }
  }
  window.addEventListener('interviewer:speech',speech);
  function resize() { const w=host.clientWidth,h=host.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); }
  const observer=new ResizeObserver(resize); observer.observe(host); resize();
  document.getElementById('avatar-motion').onclick=()=>{motion=!motion; document.getElementById('avatar-motion').textContent=motion?'Pause idle motion':'Resume idle motion';};
  function animate(now) {
    frame=requestAnimationFrame(animate); if(document.hidden||!host.getBoundingClientRect().height) { last=now; return; }
    if(now-last<1000/30) return;
    time+=Math.min(.05,(now-last)/1000); last=now;
    if(time>nextBlink) { blinkStart=time; nextBlink=time+3+Math.random()*3; }
    const phase=(time-blinkStart)/.18, blink=phase>=0&&phase<1?Math.sin(phase*Math.PI):0;
    morph('eyeBlinkLeft',motion&&!reduced.matches?blink:0,.7); morph('eyeBlinkRight',motion&&!reduced.matches?blink:0,.7);
    audioTimelines=audioTimelines.filter(t=>t.context.currentTime<t.start+t.duration+.05);
    const audio=audioTimelines.find(t=>t.context.currentTime>=t.start&&t.context.currentTime<t.start+t.duration);
    const elapsed=audio?audio.context.currentTime-audio.start:0;
    const energy=audio?.type==='pcm'?(audio.envelope[Math.floor(elapsed/audio.step)]||0):0;
    const precise=audio?(audio.type==='pcm'?{shape:energy>.025?'aa':'sil',weight:energy}:sampleViseme(audio,elapsed)):null;
    if(audioTimelines.length)speaking=Boolean(audio);
    const index=Math.min(phrase.length-1,boundaryIndex+Math.floor((time-boundaryStart)*rate));
    const letter=speaking?(phrase[index]||' ').toLowerCase():' ';
    const vowel=/[aeiouy]/.test(letter), closed=/[bmp]/.test(letter), round=/[ou]/.test(letter);
    const pulse=.65+.35*Math.sin((time-phraseStart)*27);
    const jaw=precise?(precise.shape==='aa'?.18:precise.shape==='sil'||precise.shape==='PP'?0:.06)*precise.weight:speaking&&!closed&&letter.trim()? (vowel?.24:.1)*pulse:0;
    morph('jawOpen',jaw,.65);
    for(const shape of ['aa','E','I','O','U','PP','FF','TH','DD','kk','CH','SS','nn','RR']) {
      const estimated=shape==='aa'&&speaking&&vowel&&!round?.4*pulse:shape==='O'&&speaking&&round?.35:shape==='PP'&&speaking&&closed?.5:shape==='FF'&&speaking&&/[fv]/.test(letter)?.25:0;
      morph('viseme_'+shape,precise?(precise.shape===shape?precise.weight*.7:0):estimated,.65);
    }
    morph('mouthSmileLeft',.02); morph('mouthSmileRight',.02);
    if(head) { head.quaternion.copy(rest.get(head)); if(motion&&!reduced.matches) head.rotateY(Math.sin(time*.54)*.018).rotateX(Math.sin(time*.73)*.009+(speaking?Math.sin(time*2.4)*.007:0)); }
    if(neck) { neck.quaternion.copy(rest.get(neck)); if(motion&&!reduced.matches) neck.rotateZ(Math.sin(time*.36)*.006); }
    renderer.render(scene,camera); Object.assign(debug,{speaking,jaw,frames:debug.frames+1,drawCalls:renderer.info.render.calls,timingMode:audio?'audio-clock':'estimated',viseme:precise?.shape||null});
  }
  frame=requestAnimationFrame(animate);
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('interviewer:speech',speech);
    scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material])){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});
    environment.dispose(); renderer.dispose();
  },{once:true});
}
