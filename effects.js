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
    const strength=active ? Math.max(0,1-distance/radius) : 0;
    const ux=distance?dx/distance:0,uy=distance?dy/distance:0;
    const ease=1-Math.exp(-dt/(strength>.01?.1:.16));
    const cardIdle=state.el.classList.contains('card-magnetic') && scene.dataset.phase==='revealed';
    const idleX=cardIdle?Math.cos(time/2600)*2.5:0;
    const idleY=cardIdle?Math.sin(time/1850)*8.5:0;
    state.rx+=(idleX-uy*10*strength-state.rx)*ease;
    state.ry+=(idleY+ux*12*strength-state.ry)*ease;
    state.rotation+=(ux*3*strength-state.rotation)*ease;
    state.lift+=(-7*strength-state.lift)*ease;
    state.el.style.transform=`perspective(1000px) translateY(${state.lift.toFixed(2)}px) rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg) rotateZ(${(state.base+state.rotation).toFixed(2)}deg)`;
    state.el.classList.toggle('influenced',strength>.01);
    // A fixed studio strip light: the reflection changes with surface orientation,
    // never with pointer coordinates. Idle yaw also sweeps it on touch devices.
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
finePointer.addEventListener('change',()=>{settle();startMotion();});

// Only cosmetic particles use Math.random. Card selection uses crypto in app.js.
export function burstLight(power=1){
  burstAt=performance.now();burstPower=power;
  if(reduceMotion.matches)return;
  const rect=document.querySelector('#pack-position').getBoundingClientRect();
  const x=innerWidth/2,y=power<.4?rect.top+rect.height*.106:innerHeight*.47;
  const count=Math.round(70*power);
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2,speed=50+Math.random()*300*power;
    particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,born:burstAt,life:1700+Math.random()*1700,size:.7+Math.random()*1.5});
  }
}
export function resetEffects(){burstAt=-10000;burstPower=0;particles=[];settle();}

function createRayRenderer(){
  const canvas=document.querySelector('#light-canvas');
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
  if(!gl)return null;
  const vertex='attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}';
  const fragment=`precision mediump float;
    uniform vec2 u_resolution;uniform float u_time;uniform float u_power;
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
      vec3 color=vec3(1.,.79,.4)*fog*u_power*edge;
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
  const resolution=gl.getUniformLocation(program,'u_resolution'),timeUniform=gl.getUniformLocation(program,'u_time'),powerUniform=gl.getUniformLocation(program,'u_power');
  let lost=false,lastPower=-1;
  canvas.addEventListener('webglcontextlost',(event)=>{event.preventDefault();lost=true;});
  return {
    resize(width,height){const scale=Math.min(1,850/width);canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(resolution,canvas.width,canvas.height);},
    render(time,power){if(lost)return;if(power===0&&lastPower===0)return;lastPower=power;gl.uniform1f(timeUniform,time/1000);gl.uniform1f(powerUniform,power);gl.drawArrays(gl.TRIANGLES,0,6);}
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
    if(!reduceMotion.matches){
      particles=particles.filter((p)=>time-p.born<p.life);
      for(const p of particles){
        const seconds=(time-p.born)/1000,alpha=Math.max(0,1-(time-p.born)/p.life);
        const x=p.x+p.vx*seconds,y=p.y+p.vy*seconds+seconds*seconds*12;
        ctx.fillStyle=`rgba(255,218,151,${alpha*.85})`;ctx.shadowColor='#ffd282';ctx.shadowBlur=6;
        ctx.fillRect(x,y,p.size,p.size);ctx.shadowBlur=0;
      }
    }
    const age=Math.max(0,(time-burstAt)/1000);
    const residual=scene.dataset.phase==='revealed'?.17:0;
    const power=reduceMotion.matches?0:Math.max(residual,burstPower*Math.exp(-age*.65)*2.8);
    rays?.render(time,power<.005?0:power);
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
export function playRip(unlockOnly=false){
  const ac=getAudio();if(!ac||unlockOnly)return;
  try{
    const length=Math.round(ac.sampleRate*1.25),buffer=ac.createBuffer(1,length,ac.sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<length;i++){const t=i/ac.sampleRate;samples[i]=(Math.random()*2-1)*(.4+.6*Math.abs(Math.sin(t*250)));}
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(700,ac.currentTime);filter.frequency.exponentialRampToValueAtTime(4000,ac.currentTime+1.1);filter.Q.value=.65;
    gain.gain.setValueAtTime(0,ac.currentTime);gain.gain.linearRampToValueAtTime(.17,ac.currentTime+.08);gain.gain.setValueAtTime(.14,ac.currentTime+.85);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+1.25);
    source.connect(filter).connect(gain).connect(ac.destination);source.start();source.stop(ac.currentTime+1.27);
  }catch{/* Audio is optional. */}
}
export function playReveal(){
  const ac=getAudio();if(!ac)return;
  try{[392,587.33,783.99,1174.66,1567.98,2349.32,3135.96].forEach((frequency,i)=>{
    const at=ac.currentTime+.45+i*.1,osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.value=frequency;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.04-i*.003,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+2.1);
    osc.connect(gain).connect(ac.destination);osc.start(at);osc.stop(at+2.15);
  });}catch{/* Audio is optional. */}
}

export function playCharge(){
  const ac=getAudio();if(!ac)return;
  try{const osc=ac.createOscillator(),gain=ac.createGain(),at=ac.currentTime;osc.type='triangle';osc.frequency.setValueAtTime(65,at);osc.frequency.exponentialRampToValueAtTime(210,at+.9);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.045,at+.65);gain.gain.exponentialRampToValueAtTime(.001,at+.95);osc.connect(gain).connect(ac.destination);osc.start();osc.stop(at+1);}catch{}
}
export function playImpact(){
  const ac=getAudio();if(!ac)return;
  try{
    const at=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(135,at);osc.frequency.exponentialRampToValueAtTime(35,at+.6);gain.gain.setValueAtTime(.13,at);gain.gain.exponentialRampToValueAtTime(.001,at+1.2);osc.connect(gain).connect(ac.destination);osc.start();osc.stop(at+1.25);
    const buffer=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),air=ac.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(5000,at);filter.frequency.exponentialRampToValueAtTime(180,at+.9);air.gain.setValueAtTime(0,at);air.gain.linearRampToValueAtTime(.1,at+.1);air.gain.exponentialRampToValueAtTime(.001,at+1);source.connect(filter).connect(air).connect(ac.destination);source.start();source.stop(at+1.05);
  }catch{}
}
export function playSuspense(){
  const ac=getAudio();if(!ac)return;
  try{[1174.66,1567.98].forEach((frequency,i)=>{const at=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency,at);osc.frequency.linearRampToValueAtTime(frequency+6,at+2.2);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(i?.012:.025,at+.15);gain.gain.exponentialRampToValueAtTime(.0001,at+2.6);osc.connect(gain).connect(ac.destination);osc.start();osc.stop(at+2.65);});}catch{}
}
