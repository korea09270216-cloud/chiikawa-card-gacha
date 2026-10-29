// Proximity motion follows the supplied magnetic-field playbook:
// direction × maximum angle × clamp(1 - distance / radius, 0, 1).
const finePointer = matchMedia('(min-width: 600px) and (hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let enabled = !reducedMotion.matches;
let pointer = {x:-10000,y:-10000};
let states = [];
let motionFrame = 0;
let previousTime = 0;
let lightControl = null;
const lerp = (a,b,t) => a+(b-a)*t;

export function refreshMagnetic() {
  const previous = new Map(states.map((state) => [state.el,state]));
  states = [...document.querySelectorAll('[data-magnetic]')].map((el,index) => previous.get(el) || {el,index,base:Number(el.dataset.base || 0),x:0,y:0,rx:0,ry:0,rz:0});
  settlePointer();
  startMotion();
}

function resetTransforms() {
  states.forEach((state) => {
    state.x = state.y = state.rx = state.ry = state.rz = 0;
    state.el.style.removeProperty('transform');
    state.el.style.removeProperty('--shine-x');
    state.el.style.removeProperty('--shine-y');
    state.el.classList.remove('influenced');
  });
}

export function setEffectsEnabled(value) {
  enabled = value;
  if (!enabled || reducedMotion.matches) {
    cancelAnimationFrame(motionFrame);
    motionFrame = 0;
    resetTransforms();
  } else startMotion();
  lightControl?.sync();
}

function settlePointer() { pointer = {x:-10000,y:-10000}; }
window.addEventListener('pointermove',(event) => { if (event.pointerType !== 'touch') pointer = {x:event.clientX,y:event.clientY}; },{passive:true});
window.addEventListener('scroll',settlePointer,{passive:true});
window.addEventListener('blur',settlePointer);
document.addEventListener('mouseleave',settlePointer);

function startMotion() {
  if (!motionFrame && enabled && finePointer.matches && !reducedMotion.matches && !document.hidden) {
    previousTime = performance.now();
    motionFrame = requestAnimationFrame(animateMotion);
  }
}

function animateMotion(time) {
  motionFrame = 0;
  if (!enabled || !finePointer.matches || reducedMotion.matches || document.hidden) return;
  const dt = Math.min((time-previousTime)/1000,.05);
  previousTime = time;
  const openDialog = document.querySelector('dialog[open]');
  const measurements = states.map((state) => ({state,rect:state.el.getBoundingClientRect()}));
  for (const {state,rect} of measurements) {
    const el = state.el;
    if (rect.height === 0 || rect.bottom < -60 || rect.top > innerHeight + 60) continue;
    // Reveal and proximity never compete for the same transform.
    if (el.closest('.revealing')) continue;
    const dx = pointer.x-(rect.left+rect.width/2);
    const dy = pointer.y-(rect.top+rect.height/2);
    const distance = Math.hypot(dx,dy);
    const radius = el.classList.contains('stage-card') ? 380 : Math.max(180,rect.width*1.65);
    const strength = openDialog && !openDialog.contains(el) ? 0 : Math.max(0,Math.min(1,1-distance/radius));
    const ux = distance ? dx/distance : 0;
    const uy = distance ? dy/distance : 0;
    const influenced = strength > 0;
    const approach = 1-Math.exp(-dt/(influenced ? .10 : .15));
    const idle = el.classList.contains('stage-card') ? Math.sin(time/1250+state.index*1.3)*3 : 0;
    state.y = lerp(state.y,influenced ? -8*strength : idle,approach);
    state.rx = lerp(state.rx,-uy*9*strength,approach);
    state.ry = lerp(state.ry,ux*11*strength,approach);
    state.rz = lerp(state.rz,ux*3*strength,approach);
    el.style.transform = `perspective(900px) translateY(${state.y.toFixed(2)}px) rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg) rotateZ(${(state.base+state.rz).toFixed(2)}deg)`;
    el.classList.toggle('influenced',influenced);
    if (influenced) {
      el.style.setProperty('--shine-x',`${Math.max(0,Math.min(100,(pointer.x-rect.left)/rect.width*100))}%`);
      el.style.setProperty('--shine-y',`${Math.max(0,Math.min(100,(pointer.y-rect.top)/rect.height*100))}%`);
    }
  }
  motionFrame = requestAnimationFrame(animateMotion);
}

finePointer.addEventListener('change',() => {
  settlePointer();
  if (!finePointer.matches) {cancelAnimationFrame(motionFrame);motionFrame=0;resetTransforms();}
  else startMotion();
});
document.addEventListener('visibilitychange',() => {
  settlePointer();
  if (document.hidden) {cancelAnimationFrame(motionFrame);motionFrame=0;}
  else startMotion();
  lightControl?.sync();
});

// A small volumetric ray marcher, with rays integrated through a procedural
// shaft field and an analytic ray/plane ground intersection. No hardware RTX
// dependency: WebGL 1, 24 samples, capped resolution and 30 fps.
function createLightRenderer() {
  const canvas = document.querySelector('#light-canvas');
  const gl = canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:false});
  if (!gl) return null;
  const vertexSource = `attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}`;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_pointer;
    float shafts(vec3 p){
      vec3 source=vec3(0.3+u_pointer.x*0.15,5.8,0.0);
      vec3 lightVector=p-source;
      float angle=atan(lightVector.x,-lightVector.y);
      float drift=u_time*0.025;
      float streak=pow(max(0.,sin(angle*37.+drift+sin(lightVector.z*.6)*.2)),18.);
      streak+=pow(max(0.,sin(angle*71.-drift*.7)),32.)*.35;
      float cone=1.-smoothstep(.10,.60,abs(angle-.22));
      float depth=exp(-abs(p.z)*.20);
      float dust=.8+.2*sin(p.x*1.8+p.y*2.1+p.z*.7+u_time*.12);
      return streak*cone*depth*dust;
    }
    void main(){
      vec2 uv=(gl_FragCoord.xy*2.-u_resolution)/u_resolution.y;
      vec3 origin=vec3(0.,.3,7.);
      vec3 ray=normalize(vec3(uv.x,uv.y-.05,-2.8));
      float fog=0.;
      float transmittance=1.;
      for(int i=0;i<24;i++){
        float t=2.+float(i)*.36;
        vec3 p=origin+ray*t;
        float density=shafts(p)*.045;
        fog+=transmittance*density;
        transmittance*=.975;
      }
      float ground=0.;
      if(ray.y<-.01){
        float hit=(-1.8-origin.y)/ray.y;
        vec3 p=origin+ray*hit;
        ground=shafts(p)*exp(-length(p.xz-vec2(1.,0.))*.65)*.15;
      }
      float vignette=1.-smoothstep(.6,1.6,length(uv*vec2(.5,.7)));
      float mask=smoothstep(-1.,.25,uv.x);
      vec3 gold=vec3(1.,.85,.48)*(fog*.63+ground)*vignette*mask;
      gl_FragColor=vec4(gold,1.);
    }`;
  function compile(type,source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {gl.deleteShader(shader);return null;}
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER,vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER,fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program,'a_position');
  gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const resolution = gl.getUniformLocation(program,'u_resolution');
  const timeUniform = gl.getUniformLocation(program,'u_time');
  const pointerUniform = gl.getUniformLocation(program,'u_pointer');
  let frame = 0;
  let lastTime = 0;
  let visible = true;
  let lost = false;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(1,900/rect.width);
    canvas.width = Math.max(1,Math.round(rect.width*scale));
    canvas.height = Math.max(1,Math.round(rect.height*scale));
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(resolution,canvas.width,canvas.height);
  }
  function render(time) {
    frame=0;
    if (!enabled || reducedMotion.matches || document.hidden || !visible || lost) return;
    if (time-lastTime >= 33) {
      lastTime=time;
      gl.uniform1f(timeUniform,time/1000);
      gl.uniform2f(pointerUniform,pointer.x < 0 ? 0 : pointer.x/innerWidth-.5,pointer.y < 0 ? 0 : pointer.y/innerHeight-.5);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
    frame=requestAnimationFrame(render);
  }
  function sync() {
    cancelAnimationFrame(frame);frame=0;
    if (enabled && !reducedMotion.matches && !document.hidden && visible && !lost) frame=requestAnimationFrame(render);
  }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {visible=entry.isIntersecting;sync();}).observe(canvas);
  canvas.addEventListener('webglcontextlost',(event) => {event.preventDefault();lost=true;sync();document.body.classList.remove('has-webgl');});
  canvas.addEventListener('webglcontextrestored',() => {location.reload();});
  document.body.classList.add('has-webgl');
  resize();sync();
  return {sync};
}
try { lightControl = createLightRenderer(); }
catch { document.body.classList.remove('has-webgl'); }
refreshMagnetic();
