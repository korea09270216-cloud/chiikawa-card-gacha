const scene = document.querySelector('#scene');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let pointer = {x:-10000,y:-10000};
let magnets = [];
let motionFrame = 0;
let lastMotion = 0;
let burstAt = -10000;
let burstPower = 0;
let particles = [];
let audio;

export function refreshMagnetic() {
  const previous = new Map(magnets.map((state) => [state.el,state]));
  magnets = [...document.querySelectorAll('[data-magnetic]')].map((el) => previous.get(el) || {el,base:Number(el.dataset.base||0),rx:0,ry:0,lift:0,rotation:0});
  pointer = {x:-10000,y:-10000};
  startMotion();
}

function startMotion() {
  if (motionFrame || reduceMotion.matches || document.hidden) return;
  lastMotion=performance.now();
  motionFrame=requestAnimationFrame(updateMotion);
}

function updateMotion(time) {
  motionFrame=0;
  if (reduceMotion.matches || document.hidden) return;
  const dt=Math.min(.05,(time-lastMotion)/1000);lastMotion=time;
  const measurements=magnets.map((state)=>({state,rect:state.el.getBoundingClientRect()}));
  for(const {state,rect} of measurements){
    if(!rect.width || !rect.height)continue;
    const dx=pointer.x-(rect.left+rect.width/2),dy=pointer.y-(rect.top+rect.height/2);
    const distance=Math.hypot(dx,dy),radius=Math.max(260,rect.width*1.7);
    const active=finePointer.matches && ['bundles','sealed','revealed'].includes(scene.dataset.phase);
    const hover=active && pointer.x>-9999;
    const strength=hover ? Math.max(0,1-distance/radius) : 0;
    // Tilt is proportional to where the pointer is across the whole viewport (smooth, no direction flip at the centre),
    // so left/right/up/down always lean the surface toward the cursor. Idle sway only runs while no pointer drives it.
    const lean=(offset,half)=>Math.tanh(2.2*Math.max(-1,Math.min(1,offset/half)))/Math.tanh(2.2);
    const nx=hover?lean(dx,innerWidth/2):0,ny=hover?lean(dy,innerHeight/2):0;
    const ease=1-Math.exp(-dt/(hover?.1:.16));
    const cardIdle=!hover && state.el.classList.contains('card-magnetic') && scene.dataset.phase==='revealed';
    const idleX=cardIdle?Math.cos(time/2600)*2.5:0;
    const idleY=cardIdle?Math.sin(time/1850)*8.5:0;
    state.rx+=(idleX-ny*11-state.rx)*ease;
    state.ry+=(idleY+nx*14-state.ry)*ease;
    state.rotation+=(nx*2-state.rotation)*ease;
    state.lift+=(-7*strength-state.lift)*ease;
    state.el.style.transform=`perspective(1000px) translateY(${state.lift.toFixed(2)}px) rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg) rotateZ(${(state.base+state.rotation).toFixed(2)}deg)`;
    state.el.classList.toggle('influenced',strength>.01);
    // Fixed light: the glint position changes with surface orientation, never with pointer coordinates.
    state.el.style.setProperty('--reflection-x',`${(50+state.ry*4.5+state.rx*2).toFixed(2)}%`);
  }
  motionFrame=requestAnimationFrame(updateMotion);
}
function settle(){pointer={x:-10000,y:-10000};}
function stopMotion(){cancelAnimationFrame(motionFrame);motionFrame=0;magnets.forEach((s)=>{s.el.style.removeProperty('transform');s.el.classList.remove('influenced');s.rx=s.ry=s.rotation=s.lift=0;});}
window.addEventListener('pointermove',(event)=>{if(event.pointerType!=='touch')pointer={x:event.clientX,y:event.clientY};},{passive:true});
window.addEventListener('blur',settle);
window.addEventListener('scroll',settle,{passive:true});
document.addEventListener('mouseleave',settle);
document.addEventListener('mouseout',(event)=>{if(!event.relatedTarget)settle();});
finePointer.addEventListener('change',()=>{settle();startMotion();});

// Grade presets live in grades.js (globalThis.GradeFX); without it every effect falls back to the SSS look below.
const BASE_FX={rgb:[255,201,102],light:[255,243,207],rays:{gain:1,prism:0,resid:1},burst:{count:110,speed:300,size:2.4,life:1,star:0},dust:0,palette:[[255,201,102],[255,243,207]],
  timing:{charge:1200},sound:{notes:[392,587.33,783.99,1174.66,1567.98,2349.32,3135.96],gap:.1,delay:.45,level:.04,tail:2.1,charge:1,impact:1,suspense:1,whoosh:1,boom:0,sting:false}};
const fxOf=(grade)=>{const table=globalThis.GradeFX?.table;return table?.[grade]||table?.SSS||BASE_FX;};
// Low-end phones get fewer particles; nobody gets more than MAX_PARTICLES alive at once.
const MAX_PARTICLES=320;
const lowEnd=typeof navigator!=='undefined'&&((navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=2);
let burstFx=null;
let dust=[];
const pickColor=(palette)=>palette[Math.random()<.5?0:Math.floor(Math.random()*palette.length)];

// Only cosmetic particles use Math.random. Card selection uses crypto in app.js.
export function burstLight(power=1,grade){
  const fx=fxOf(grade??scene.dataset.grade);
  burstAt=performance.now();burstPower=power;burstFx=fx;
  if(reduceMotion.matches)return;
  const rect=document.querySelector('#pack-position').getBoundingClientRect();
  const x=innerWidth/2,y=power<.4?rect.top+rect.height*.106:innerHeight*.47;
  const b=fx.burst,count=Math.max(0,Math.min(MAX_PARTICLES-particles.length,Math.round(b.count*power*(lowEnd?.6:1))));
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2,speed=50+Math.random()*b.speed*power;
    particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,born:burstAt,life:(1700+Math.random()*1700)*b.life,size:.8+Math.random()*(power>.4?b.size:b.size*.625),star:Math.random()<b.star,color:pickColor(fx.palette)});
  }
}
// Cuts sounds already scheduled (skip / leaving the result) and clears the particles.
export function stopFx(){
  particles=[];dust=[];
  const old=bus;bus=null;
  if(old)try{old.gain.setTargetAtTime(0,audio.currentTime,.03);setTimeout(()=>{try{old.disconnect();}catch{/* Already gone. */}},500);}catch{/* Audio is optional. */}
}
export function resetEffects(){burstAt=-10000;burstPower=0;burstFx=null;particles=[];dust=[];stopFx();settle();}

// Small cached glow sprites replace per-particle shadowBlur (much cheaper on phones). 'star' adds a four-point sparkle.
const sprites=new Map();
function sprite(star,color){
  const key=(star?'s':'d')+color;
  if(sprites.has(key))return sprites.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const g=canvas.getContext('2d');
  if(!g){sprites.set(key,null);return null;}
  const c=color.join(','),glow=g.createRadialGradient(16,16,0,16,16,16);
  glow.addColorStop(0,'rgba(255,255,255,.95)');glow.addColorStop(.18,`rgba(${c},.95)`);glow.addColorStop(.5,`rgba(${c},.26)`);glow.addColorStop(1,`rgba(${c},0)`);
  g.fillStyle=glow;g.fillRect(0,0,32,32);
  if(star){
    const h=g.createLinearGradient(0,0,32,0),v=g.createLinearGradient(0,0,0,32);
    for(const line of [h,v]){line.addColorStop(0,`rgba(${c},0)`);line.addColorStop(.5,'rgba(255,255,255,.9)');line.addColorStop(1,`rgba(${c},0)`);}
    g.fillStyle=h;g.fillRect(0,15,32,2);g.fillStyle=v;g.fillRect(15,0,2,32);
  }
  sprites.set(key,canvas);return canvas;
}
let lastDust=0;
function spawnDust(fx,time){
  const wide=innerWidth<=600,cw=Math.min(wide?290:360,innerWidth*(wide?.73:.72),innerHeight*(wide?.43:.44));
  const cap=Math.round(fx.dust*(lowEnd?.5:1));
  if(dust.length>=cap||time-lastDust<110)return;
  lastDust=time;
  dust.push({x:innerWidth/2+(Math.random()-.5)*cw*1.25,y:innerHeight/2-15+(Math.random()-.2)*cw*1.2,vy:-(9+Math.random()*16),sway:Math.random()*6.28,born:time,life:3200+Math.random()*2400,size:.9+Math.random()*1.4,color:pickColor(fx.palette)});
}

function createRayRenderer(){
  const canvas=document.querySelector('#light-canvas');
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
  if(!gl)return null;
  const vertex='attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}';
  const fragment=`precision mediump float;
    uniform vec2 u_resolution;uniform float u_time;uniform float u_power;uniform vec3 u_color;uniform float u_prism;
    float volume(vec3 p){
      float r=length(p.xy);float angle=atan(p.y,p.x);
      float streak=pow(max(0.,sin(angle*18.+sin(p.z*.7)+u_time*.12)),12.);
      streak+=pow(max(0.,sin(angle*31.-u_time*.07)),24.)*.4;
      float haze=exp(-r*r*1.6)*.15;
      return (streak*.4*exp(-r*.9)+haze)*exp(-abs(p.z)*.55);
    }
    void main(){
      vec2 uv=(gl_FragCoord.xy*2.-u_resolution)/u_resolution.y;uv.y-=.06;
      vec3 origin=vec3(0.,0.,4.);vec3 ray=normalize(vec3(uv,-2.));
      float fog=0.;float transmittance=1.;
      for(int i=0;i<20;i++){
        vec3 p=origin+ray*(1.5+float(i)*.27);
        fog+=volume(p)*transmittance*.12;transmittance*=.97;
      }
      float edge=1.-smoothstep(.4,1.6,length(uv));
      vec3 rainbow=.5+.5*cos(6.2832*(atan(uv.y,uv.x)*.159+vec3(0.,.33,.67)+u_time*.02));
      vec3 color=mix(u_color,rainbow,u_prism)*fog*u_power*edge;
      gl_FragColor=vec4(color,1.);
    }`;
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader;}
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  if(!vs||!fs)return null;
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const resolution=gl.getUniformLocation(program,'u_resolution'),timeUniform=gl.getUniformLocation(program,'u_time'),powerUniform=gl.getUniformLocation(program,'u_power'),colorUniform=gl.getUniformLocation(program,'u_color'),prismUniform=gl.getUniformLocation(program,'u_prism');
  let lost=false,lastPower=-1,lastTint='';
  canvas.addEventListener('webglcontextlost',(event)=>{event.preventDefault();lost=true;});
  return {
    resize(width,height){const scale=Math.min(1,850/width);canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(resolution,canvas.width,canvas.height);},
    render(time,power,color,prism){if(lost)return;if(power===0&&lastPower===0)return;lastPower=power;const tint=`${color}|${prism}`;if(tint!==lastTint){lastTint=tint;gl.uniform3f(colorUniform,color[0]/255,color[1]/255,color[2]/255);gl.uniform1f(prismUniform,prism);}gl.uniform1f(timeUniform,(time/1000)%1200);gl.uniform1f(powerUniform,power);gl.drawArrays(gl.TRIANGLES,0,6);}
  };
}

function createSpace(){
  const canvas=document.querySelector('#space'),ctx=canvas.getContext('2d');
  if(!ctx)return;
  let rays=null;
  try{rays=createRayRenderer();}catch{/* CSS bloom remains available. */}
  let width=innerWidth,height=innerHeight,stars=[],frame=0,lastFrame=0;
  function resize(){
    width=innerWidth;height=innerHeight;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    stars=Array.from({length:Math.min(150,Math.max(45,Math.round(width*height/11000)))},()=>({x:Math.random()*width,y:Math.random()*height,r:.3+Math.random()*.65,alpha:.12+Math.random()*.35,phase:Math.random()*6.28}));
    rays?.resize(width,height);
    draw(performance.now());
  }
  function draw(time){
    ctx.clearRect(0,0,width,height);
    for(const star of stars){
      const flicker=reduceMotion.matches?1:.8+.2*Math.sin(time*.0005+star.phase);
      ctx.fillStyle=`rgba(211,220,235,${star.alpha*flicker})`;
      ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();
    }
    const now=fxOf(scene.dataset.grade);
    if(!reduceMotion.matches){
      ctx.globalCompositeOperation='lighter';
      particles=particles.filter((p)=>time-p.born<p.life);
      for(const p of particles){
        const seconds=(time-p.born)/1000,alpha=Math.max(0,1-(time-p.born)/p.life),image=sprite(p.star,p.color);if(!image)continue;
        const x=p.x+p.vx*seconds,y=p.y+p.vy*seconds+seconds*seconds*12,size=p.size*(p.star?7:4.2);
        ctx.globalAlpha=alpha*(p.star?.65+.35*Math.sin(time*.012+p.x):.9);ctx.drawImage(image,x-size/2,y-size/2,size,size);
      }
      // Quiet star dust keeps drifting around a high-grade card once it is shown (not when only inspecting an owned card).
      if(now.dust>0 && scene.dataset.phase==='revealed' && !scene.classList.contains('previewing'))spawnDust(now,time);
      dust=dust.filter((d)=>time-d.born<d.life);
      for(const d of dust){
        const t=(time-d.born)/d.life,image=sprite(true,d.color);if(!image)continue;
        const size=d.size*7,x=d.x+Math.sin(d.sway+t*5)*10,y=d.y+d.vy*t*d.life/1000;
        ctx.globalAlpha=Math.sin(Math.PI*t)*(.5+.4*Math.sin(time*.006+d.sway));ctx.drawImage(image,x-size/2,y-size/2,size,size);
      }
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }
    const age=Math.max(0,(time-burstAt)/1000),burstFor=burstFx||now;
    const residual=scene.dataset.phase==='revealed'?.17*now.rays.resid:0;
    const burst=burstPower*Math.exp(-age*.65)*2.8*burstFor.rays.gain;
    const power=reduceMotion.matches?0:Math.max(residual,burst),tint=burst>residual?burstFor:now;
    rays?.render(time,power<.005?0:power,tint.rgb,tint.rays.prism);
  }
  function tick(time){frame=0;if(document.hidden)return;if(time-lastFrame>33){lastFrame=time;draw(time);}if(!reduceMotion.matches)frame=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(frame);frame=0;if(!document.hidden){draw(performance.now());if(!reduceMotion.matches)frame=requestAnimationFrame(tick);}}
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',sync);
  reduceMotion.addEventListener('change',sync);
  resize();sync();
}
try{createSpace();}catch{/* A black stage still works without canvas support. */}
document.addEventListener('visibilitychange',()=>{settle();document.hidden?stopMotion():startMotion();});
reduceMotion.addEventListener('change',()=>{settle();reduceMotion.matches?stopMotion():startMotion();});

function getAudio(){
  try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});return audio;}catch{return null;}
}
// Every effect sound goes through one bus (+ a soft limiter) so stopFx() can cut whatever is still scheduled.
let master=null,bus=null;
function out(ac){
  if(!master){master=ac.createDynamicsCompressor();master.threshold.value=-16;master.knee.value=20;master.ratio.value=5;master.attack.value=.004;master.release.value=.25;master.connect(ac.destination);}
  if(!bus){bus=ac.createGain();bus.connect(master);}
  return bus;
}
const soundOf=(grade)=>fxOf(grade??scene.dataset.grade).sound;
function ping(ac,dest,frequency,at,level,tail,type='sine'){
  const osc=ac.createOscillator(),gain=ac.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency*.94,at);osc.frequency.exponentialRampToValueAtTime(frequency,at+.035);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+tail);
  osc.connect(gain).connect(dest);osc.start(at);osc.stop(at+tail+.05);
}
export function playRip(unlockOnly=false){
  const ac=getAudio();if(!ac||unlockOnly)return;
  try{
    const length=Math.round(ac.sampleRate*1.25),buffer=ac.createBuffer(1,length,ac.sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<length;i++){const t=i/ac.sampleRate;samples[i]=(Math.random()*2-1)*(.4+.6*Math.abs(Math.sin(t*250)));}
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(700,ac.currentTime);filter.frequency.exponentialRampToValueAtTime(4000,ac.currentTime+1.1);filter.Q.value=.65;
    gain.gain.setValueAtTime(0,ac.currentTime);gain.gain.linearRampToValueAtTime(.17,ac.currentTime+.08);gain.gain.setValueAtTime(.14,ac.currentTime+.85);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+1.25);
    source.connect(filter).connect(gain).connect(out(ac));source.start();source.stop(ac.currentTime+1.27);
  }catch{/* Audio is optional. */}
}
// Reveal: low grades are one short "pop" arpeggio; every step up adds notes, a low boom, sparkles and a longer tail; SSS ends with a stinger.
export function playReveal(grade){
  const ac=getAudio();if(!ac)return;
  try{
    const s=soundOf(grade),dest=out(ac),now=ac.currentTime;
    s.notes.forEach((frequency,i)=>ping(ac,dest,frequency,now+s.delay+i*s.gap,Math.max(.012,s.level-i*.003),s.tail));
    if(s.boom>0){
      const osc=ac.createOscillator(),gain=ac.createGain(),at=now+.04;osc.type='sine';osc.frequency.setValueAtTime(130,at);osc.frequency.exponentialRampToValueAtTime(42,at+.55);
      gain.gain.setValueAtTime(.12*s.boom,at);gain.gain.exponentialRampToValueAtTime(.001,at+1.1);osc.connect(gain).connect(dest);osc.start(at);osc.stop(at+1.15);
    }
    if(s.boom>=.5)for(let i=0,pings=Math.round(s.boom*4);i<pings;i++)ping(ac,dest,[2093,2637.02,3135.96,3951.07][i%4],now+s.delay+.15+i*.17,.012,.55);
    if(s.sting){
      const filter=ac.createBiquadFilter(),gain=ac.createGain(),at=now+.05;filter.type='lowpass';filter.frequency.setValueAtTime(500,at);filter.frequency.exponentialRampToValueAtTime(3400,at+.5);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.034,at+.22);gain.gain.exponentialRampToValueAtTime(.0001,at+1.7);filter.connect(gain).connect(dest);
      [196,293.66,392,493.88].forEach((frequency)=>{const osc=ac.createOscillator();osc.type='sawtooth';osc.frequency.value=frequency;osc.detune.value=(Math.random()-.5)*10;osc.connect(filter);osc.start(at);osc.stop(at+1.75);});
    }
  }catch{/* Audio is optional. */}
}

export function playCharge(grade){
  const ac=getAudio();if(!ac)return;
  try{
    const fx=fxOf(grade??scene.dataset.grade),s=fx.sound,dest=out(ac),at=ac.currentTime,d=Math.max(.3,(fx.timing.charge||1200)/1000-.05);
    const osc=ac.createOscillator(),gain=ac.createGain();osc.type='triangle';osc.frequency.setValueAtTime(60,at);osc.frequency.exponentialRampToValueAtTime(260,at+d);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.055*s.charge,at+d-.1);gain.gain.exponentialRampToValueAtTime(.001,at+d+.1);osc.connect(gain).connect(dest);osc.start();osc.stop(at+d+.15);
    const rumble=ac.createOscillator(),rgain=ac.createGain();rumble.type='sine';rumble.frequency.setValueAtTime(38,at);rumble.frequency.linearRampToValueAtTime(70,at+d+.05);rgain.gain.setValueAtTime(0,at);rgain.gain.linearRampToValueAtTime(.08*s.charge,at+d-.05);rgain.gain.exponentialRampToValueAtTime(.001,at+d+.15);rumble.connect(rgain).connect(dest);rumble.start();rumble.stop(at+d+.2);
    if(s.boom>=.8){
      const shimmer=ac.createOscillator(),sgain=ac.createGain();shimmer.type='sine';shimmer.frequency.setValueAtTime(520,at);shimmer.frequency.exponentialRampToValueAtTime(2300,at+d);sgain.gain.setValueAtTime(0,at);sgain.gain.linearRampToValueAtTime(.014,at+d-.05);sgain.gain.exponentialRampToValueAtTime(.0001,at+d+.12);shimmer.connect(sgain).connect(dest);shimmer.start();shimmer.stop(at+d+.15);
    }
  }catch{}
}
export function playImpact(grade){
  const ac=getAudio();if(!ac)return;
  try{
    const k=soundOf(grade).impact,dest=out(ac),at=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(135,at);osc.frequency.exponentialRampToValueAtTime(35,at+.6);gain.gain.setValueAtTime(.13*k,at);gain.gain.exponentialRampToValueAtTime(.001,at+1.2);osc.connect(gain).connect(dest);osc.start();osc.stop(at+1.25);
    const buffer=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),air=ac.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(5000,at);filter.frequency.exponentialRampToValueAtTime(180,at+.9);air.gain.setValueAtTime(0,at);air.gain.linearRampToValueAtTime(.1*k,at+.1);air.gain.exponentialRampToValueAtTime(.001,at+1);source.connect(filter).connect(air).connect(dest);source.start();source.stop(at+1.05);
  }catch{}
}
export function playSuspense(grade){
  const ac=getAudio();if(!ac)return;
  try{
    const k=soundOf(grade).suspense,dest=out(ac);if(!k)return;
    [1174.66,1567.98].forEach((frequency,i)=>{const at=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency,at);osc.frequency.linearRampToValueAtTime(frequency+6,at+2.2);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime((i?.012:.025)*k,at+.15);gain.gain.exponentialRampToValueAtTime(.0001,at+2.6);osc.connect(gain).connect(dest);osc.start();osc.stop(at+2.65);});
  }catch{}
}
export function playWhoosh(grade){
  const ac=getAudio();if(!ac)return;
  try{
    const k=soundOf(grade).whoosh,dest=out(ac),at=ac.currentTime,length=Math.round(ac.sampleRate*.9),buffer=ac.createBuffer(1,length,ac.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.Q.value=1.2;filter.frequency.setValueAtTime(250,at);filter.frequency.exponentialRampToValueAtTime(3200,at+.8);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.09*k,at+.35);gain.gain.exponentialRampToValueAtTime(.001,at+.9);
    source.connect(filter).connect(gain).connect(dest);source.start();source.stop(at+.92);
  }catch{}
}
// A short paper-tear grain per drag step; louder the further the tear advanced.
let lastGrain=0;
export function playTearGrain(progress){
  const ac=getAudio();if(!ac)return;
  const now=performance.now();if(now-lastGrain<55)return;lastGrain=now;
  try{
    const at=ac.currentTime,length=Math.round(ac.sampleRate*.06),buffer=ac.createBuffer(1,length,ac.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1800+progress*2600;filter.Q.value=.8;gain.gain.value=.05+progress*.05;
    source.connect(filter).connect(gain).connect(out(ac));source.start();
  }catch{}
}
// Title unlocked: a short bell chime that starts with the popup's entrance; higher tiers add notes and ring longer (quiet, no boom).
const TITLE_CHIME={common:[783.99,1174.66],rare:[783.99,987.77,1318.51],epic:[659.25,880,1318.51,1760],legend:[523.25,783.99,1046.5,1568,2093.01]};
export function playTitle(tier){
  const ac=getAudio();if(!ac)return;
  try{
    const notes=TITLE_CHIME[tier]||TITLE_CHIME.common,dest=out(ac),at=ac.currentTime+.4;
    notes.forEach((frequency,i)=>ping(ac,dest,frequency,at+i*.085,.042,.75+i*.12));
  }catch{}
}
