import { PACK_SETS, UPCOMING_PACKS } from './packs.js?v=10';
import { boxMarkup } from './box3d.js?v=10';
import { refreshMagnetic, burstLight, resetEffects, stopFx, playCharge, playRip, playImpact, playSuspense, playReveal, playWhoosh, playTearGrain } from './effects.js?v=10';
import './grades.js?v=10';

const $ = (selector) => document.querySelector(selector);
// Keyboard modality flag: the focus ring only shows while the keyboard is in use (see styles.css).
document.addEventListener('keydown',()=>{document.documentElement.dataset.kbd='1';},true);
document.addEventListener('pointerdown',()=>{delete document.documentElement.dataset.kbd;},true);
const scene = $('#scene');
const packButton = $('#pack-button');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const escapeHTML = (value) => String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const countsByPack = new Map();
let activePack = PACK_SETS[0];
let phase = 'packs';
let view = 'packs';
let selectedCard = null;
let collectionPackId = activePack.id;
let sequence = 0;
const timers = new Set();
const packPosition = $('#pack-position');
const TEAR_DONE = .82;
let prepared = null;
let drag = null;
let suppressClick = false;
let finishing = false;

// Saved counts for `length` slots from one storage key, starting at slot `offset`; anything unreadable counts as 0.
function readStored(key,length,offset=0) {
  const counts = Array(length).fill(0);
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored?.version === 1 && Array.isArray(stored.counts)) {
      return counts.map((_,index) => { const value=stored.counts[index-offset]; return Number.isSafeInteger(value) && value>=0 && value<100000000 ? value : 0; });
    }
  } catch { /* Opening remains usable with unavailable or invalid storage. */ }
  return counts;
}
// pack.legacyStorage = old per-pack records folded into this pack (read-only, never deleted): element-wise max from `offset`.
function readCounts(pack) {
  return (pack.legacyStorage||[]).reduce((counts,legacy)=>{
    const old=readStored(legacy.key,pack.cards.length,legacy.offset);
    return counts.map((count,index)=>Math.max(count,old[index]));
  },readStored(pack.storageKey,pack.cards.length));
}
// Counts only ever grow, so merging with another tab's saved copy (element-wise max) never loses a card.
function syncCounts(pack) {
  const fresh = readCounts(pack), counts = (countsByPack.get(pack.id) || fresh).map((count,index) => Math.max(count,fresh[index]));
  countsByPack.set(pack.id,counts);
  return counts;
}
for (const pack of PACK_SETS) countsByPack.set(pack.id,readCounts(pack));
let collectionUnlocked = [...countsByPack.values()].some((counts)=>counts.some((count)=>count>0));
collectionPackId=(PACK_SETS.find((pack)=>countsByPack.get(pack.id).some((count)=>count>0)) || activePack).id;
const getCounts = (pack=activePack) => countsByPack.get(pack.id);
const stable = () => ['bundles','packs','sealed','revealed','collection'].includes(phase);

function setPhase(next) { phase=next;scene.dataset.phase=next; }
function setView(next) { view=next;scene.dataset.view=next; }
function syncNavigation() {
  $('#result-actions').hidden = !stable() || ((view==='bundles' || view==='packs') && !collectionUnlocked);
  // 'Draw again' only makes sense once a card has been drawn (result) or while browsing the collection; on the box / sealed-pack screens the pack itself is the action.
  $('#next-pack').hidden = view!=='result' && view!=='collection';
  // Pack list is the first screen; its twin button is redundant there and on the box screen (whose back button leads to it).
  $('#pack-list-open').hidden = !stable() || view==='packs' || view==='bundles';
  $('#card-list').hidden = !collectionUnlocked;
  $('#card-list').setAttribute('aria-expanded',String(view==='collection'));
  $('#save-card').hidden = view!=='result' || !selectedCard || phase!=='revealed';
  $('#choose-bundle').hidden = view==='packs' || !stable();
  $('#choose-bundle').innerHTML = `<span aria-hidden="true">←</span> ${view==='bundles' ? '카드팩 목록' : '꾸러미 선택'}`;
}
function later(callback,delay) {
  const token=sequence;
  const timer=setTimeout(()=>{timers.delete(timer);if(token===sequence)callback();},delay);
  timers.add(timer);
}
function cancelPending() { sequence++;timers.forEach(clearTimeout);timers.clear(); }
const gradeOf = (card) => card.grade || 'SSS';
// Grade spectacle presets come from grades.js (globalThis.GradeFX). Without it: SSS look and these SSS timings (ms).
const SSS_TIMING = {charge:1200,tear:1150,emerge:1600,reveal:1300,settle:1500};
const timingOf = (grade) => globalThis.GradeFX?.timing(grade) || SSS_TIMING;
function applyGrade(grade) { const fx=globalThis.GradeFX;if(fx)fx.apply(scene,grade);else scene.setAttribute('data-grade',grade); }
function clearGrade() { const fx=globalThis.GradeFX;if(fx)fx.clear(scene);else scene.removeAttribute('data-grade'); }
let live = null; // the draw being opened, once its art is loaded: {card,image,counted,isNew}
// Collection order: the highest grade first. Labels come from grades.js (GradeFX.table) with this fallback.
const COLLECTION_ORDER = ['SSS','SS','S','A','B','C'];
const GRADE_LABEL = {C:'COMMON',B:'UNCOMMON',A:'RARE',S:'SUPER RARE',SS:'ULTRA RARE',SSS:'SECRET RARE'};
const gradeLabel = (grade) => globalThis.GradeFX?.table?.[grade]?.label || GRADE_LABEL[grade] || '';
const packGrades = (pack) => [...new Set(pack.cards.map(gradeOf))].sort((a,b)=>(COLLECTION_ORDER.indexOf(a)+1||99)-(COLLECTION_ORDER.indexOf(b)+1||99));
function randomInt(size) {
  const values=new Uint32Array(1),limit=Math.floor(4294967296/size)*size;
  do{crypto.getRandomValues(values);}while(values[0]>=limit);
  return values[0]%size;
}
// pack.rates 가 있으면 등급을 가중 추첨(0.01 단위)한 뒤 그 등급 카드 중 균등 추첨. 없거나 쓸 수 없는 값이면 팩 전체 균등 추첨.
function randomCard(pack=activePack) {
  const tiers=Object.entries(pack.rates||{}).map(([grade,rate])=>[grade,Math.round(Number(rate)*100)||0]).filter(([grade,weight])=>weight>0 && pack.cards.some((card)=>gradeOf(card)===grade));
  if(!tiers.length)return pack.cards[randomInt(pack.cards.length)];
  let roll=randomInt(tiers.reduce((sum,[,weight])=>sum+weight,0)),grade=tiers[tiers.length-1][0];
  for(const [name,weight] of tiers){if(roll<weight){grade=name;break;}roll-=weight;}
  const pool=pack.cards.filter((card)=>gradeOf(card)===grade);
  return pool[randomInt(pool.length)];
}
function loadCard(card) {
  return new Promise((resolve,reject)=>{
    let image=new Image(),retried=false;
    const timeout=setTimeout(()=>finish(new Error('image timeout')),12000);
    function finish(error){clearTimeout(timeout);image.onload=image.onerror=null;error?reject(error):resolve(image);}
    function attempt(){
      image=new Image();image.onload=()=>finish();
      image.onerror=()=>{if(retried)return finish(new Error('image load failed'));retried=true;image.onload=image.onerror=null;setTimeout(attempt,350);};
      image.src=card.image;
    }
    attempt();
  });
}

// The box screen shows one box: the pack picked on the pack list.
function renderBundles(pack=activePack) {
  $('#bundle-stage').innerHTML=`<button class="bundle-choice" data-pack="${escapeHTML(pack.id)}" aria-label="${escapeHTML(pack.label)} 꾸러미 열기"><span class="bundle-float"><span class="bundle-tilt" data-magnetic data-base="-2">${boxMarkup(pack,escapeHTML)}</span></span></button>`;
  refreshMagnetic();
}
// Bundle -> pack: the box turns toward you, its lid swings up, the foil pack rises out and is handed over (FLIP) to the
// real #pack-position while the box sinks away. CSS timeline lives in box3d.css (.is-opening); keep the numbers in sync.
const BOX_HANDOFF=1280,BOX_TOTAL=1850,BOX_LAND=BOX_TOTAL-BOX_HANDOFF-20;
const boxAnimations=[];
function setPackImage(pack) {
  document.querySelectorAll('.packet-layer img').forEach((image)=>image.src=pack.wrapperImage);
  packPosition.style.setProperty('--pack-img',`url("${pack.wrapperImage}")`);
  packButton.setAttribute('aria-label',`${pack.label} 밀봉 카드팩 뜯기`);
}
function resetBoxes() {
  boxAnimations.splice(0).forEach((animation)=>{try{animation.cancel();}catch{/* Already finished. */}});
  document.querySelectorAll('.bundle-choice.is-opening').forEach((choice)=>{choice.classList.remove('is-opening');choice.querySelector('.bx-pack')?.style.removeProperty('visibility');});
  $('#bundle-stage').classList.remove('opening');
  packPosition.classList.remove('pack-prime','pack-landing');
}
function enterSealed(stage) {
  stage.hidden=true;stage.classList.remove('departing');resetBoxes();
  packPosition.hidden=false;
  setView('pack');setPhase('sealed');packButton.disabled=false;syncNavigation();refreshMagnetic();
  packButton.focus({preventScroll:true});
}
// The pack leaves the box: swap the box's inner pack for the real one at exactly the same screen rect, then fly it to centre.
function landPack(choice) {
  const inner=choice.querySelector('.bx-pack'),from=(inner||choice).getBoundingClientRect(),to=packPosition.getBoundingClientRect();
  packPosition.classList.remove('pack-prime');packPosition.classList.add('pack-landing');
  if(inner)inner.style.visibility='hidden';
  if(typeof packPosition.animate==='function' && to.width>0){
    const dx=from.left+from.width/2-(to.left+to.width/2),dy=from.top+from.height/2-(to.top+to.height/2),scale=from.width/to.width;
    // The real pack carries a -4deg roll; start at 0deg like the pose inside the box so nothing jumps.
    boxAnimations.push(packPosition.animate([
      {transform:`translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) translate(-50%,-50%) scale(${scale.toFixed(4)}) rotate(4deg)`},
      {transform:'translate(0px,0px) translate(-50%,-50%) scale(1) rotate(0deg)'}
    ],{duration:BOX_LAND,easing:'cubic-bezier(.25,.8,.25,1)'}));
  }
}
function openBundle(stage,choice) {
  const box=choice.querySelector('.box3d');
  packButton.disabled=true;stage.classList.add('opening');
  packPosition.hidden=false;packPosition.classList.add('pack-prime');
  if(box && typeof box.animate==='function'){
    // Freeze the idle sway where it is and turn the box to the opening pose (pitch -26deg: keep in sync with box3d.css).
    let current='rotateX(-18deg) rotateY(25deg)';
    try{if(typeof getComputedStyle==='function')current=getComputedStyle(box).transform||current;}catch{/* Keep the default pose. */}
    boxAnimations.push(box.animate([{transform:current},{transform:'rotateX(-26deg) rotateY(0deg)'}],{duration:600,easing:'cubic-bezier(.3,.6,.2,1)',fill:'forwards'}));
  }
  choice.classList.add('is-opening');
  later(()=>landPack(choice),BOX_HANDOFF);
  later(()=>enterSealed(stage),BOX_TOTAL);
}
// Pack list -> box screen: the list fades away and the chosen pack's single box takes its place.
function pickPack(pack) {
  activePack=pack;collectionPackId=pack.id;cancelPending();setPhase('selecting');syncNavigation();
  document.querySelectorAll('.pack-pick').forEach((button)=>button.disabled=true);
  setPackImage(pack);$('#pack-list').classList.add('departing');
  later(()=>{
    $('#pack-list').hidden=true;$('#pack-list').classList.remove('departing');$('#pack-grid').replaceChildren();
    renderBundles(pack);$('#bundle-stage').classList.add('arriving');$('#bundle-stage').hidden=false;
    setPhase('bundles');setView('bundles');syncNavigation();
    $('#bundle-stage .bundle-choice')?.focus({preventScroll:true});
  },reducedMotion.matches?30:280);
}
// Box screen -> sealed pack (box opening), or a short fade when motion is reduced.
function selectPack(packId) {
  if(phase!=='packs' && phase!=='bundles')return;
  const pack=PACK_SETS.find((item)=>item.id===packId);if(!pack)return;
  if(phase==='packs'){pickPack(pack);return;}
  const stage=$('#bundle-stage');
  activePack=pack;collectionPackId=pack.id;cancelPending();setPhase('selecting');syncNavigation();
  document.querySelectorAll('.bundle-choice').forEach((button)=>button.disabled=true);
  setPackImage(pack);
  const choice=!reducedMotion.matches ? [...stage.querySelectorAll('.bundle-choice')].find((item)=>item.dataset.pack===pack.id) : null;
  if(choice){openBundle(stage,choice);return;}
  stage.classList.add('departing');
  later(()=>{
    stage.hidden=true;stage.classList.remove('departing');
    packPosition.hidden=false;packPosition.classList.add('pack-arriving');
    setView('pack');setPhase('sealed');packButton.disabled=false;syncNavigation();refreshMagnetic();
    packButton.focus({preventScroll:true});
    later(()=>packPosition.classList.remove('pack-arriving'),700);
  },30);
}

const HAPTIC = {C:[22],B:[30],A:[40,30,40],S:[55,35,55],SS:[70,35,70,35,110],SSS:[90,40,90,40,90,40,180]};
function haptic(grade) { if(reducedMotion.matches)return;try{navigator.vibrate?.(HAPTIC[grade]||HAPTIC.SSS);}catch{/* Haptics are optional. */} }
function buildCard(preview=false) {
  $('#reveal-zone').innerHTML=`<div class="card-entrance"><div class="card-magnetic" data-magnetic><div class="card-surface"><span class="foil" aria-hidden="true"></span><span class="specular" aria-hidden="true"></span>${preview?'':'<span class="emerge-glare" aria-hidden="true"><span class="gl-rays"></span></span>'}</div></div></div>`;
  $('#reveal-zone').hidden=false;
  // The card starts hidden behind the opened pack, narrower than it, and slides up out of the torn top (--rise-out = how far up).
  const entrance=$('#reveal-zone .card-entrance'),cardW=entrance?.offsetWidth,packW=packPosition.offsetWidth,packH=packPosition.offsetHeight;
  if(!preview && cardW && packW){
    const scale=Math.min(.86,packW*.78/cardW),cardH=cardW*1056/756*scale;
    entrance.style.setProperty('--rise-s',scale.toFixed(3));entrance.style.setProperty('--rise-out',`${(-packH*.395-cardH*.2).toFixed(1)}px`);
  }
}
function fillCardFront(card,image) {
  image.id='revealed-image';image.alt=`${card.name} ${gradeOf(card)} 카드`;image.width=756;image.height=1056;image.draggable=false;
  $('#reveal-zone .card-surface').prepend(image);
  selectedCard={packId:activePack.id,card};
  $('#save-card').href=card.image;$('#save-card').download=`${card.name}_${gradeOf(card)}.png`;
}
function finishReveal(card,isNew) {
  live=null;
  setPhase('revealed');setView('result');$('#pack-position').hidden=true;packButton.removeAttribute('aria-busy');
  syncNavigation();$('#announcement').textContent=`${card.name} ${gradeOf(card)} 카드가 나타났습니다.${isNew?' 처음 만난 카드입니다.':''}`;
  $('#card-list').focus({preventScroll:true});refreshMagnetic();
}
function revealCard(card,image,instant=false) {
  setPhase('revealing');fillCardFront(card,image);scene.classList.add('unveiling');
  const counts=syncCounts(activePack),index=activePack.cards.findIndex((item)=>item.id===card.id),isNew=counts[index]===0;
  counts[index]++;collectionUnlocked=true;
  try{localStorage.setItem(activePack.storageKey,JSON.stringify({version:1,counts}));}catch{/* Download remains available without storage. */}
  if(live){live.counted=true;live.isNew=isNew;}
  if(isNew)$('#reveal-zone .card-magnetic')?.setAttribute('data-new','');
  burstLight(instant?.5:.9);playReveal();
  if(instant)finishReveal(card,isNew);
  else later(()=>finishReveal(card,isNew),reducedMotion.matches?60:timingOf(gradeOf(card)).settle);
}
// Skip: drop whatever is left of the show and land on the finished result. The draw is counted exactly once (revealCard counts it,
// or it already did when the skip comes during the final unveil); timers, sounds and particles are cleared first.
function skipOpening() {
  if(!live || !['charging','tearing','opening','emerging','revealing'].includes(phase))return;
  const {card,image,counted,isNew}=live;
  cancelPending();stopFx();scene.classList.remove('charging','dragging');scene.classList.add('skipped');
  if(counted){finishReveal(card,isNew);return;}
  if(phase!=='emerging'){setView('result');buildCard();}
  revealCard(card,image,true);
}
function prepareDraw() {
  if(!prepared){const card=randomCard(),load=loadCard(card);load.catch(()=>{});prepared={card,load};}
  return prepared;
}
function setTear(progress,dir=1) {
  const style=packPosition.style,front=dir<0?96-progress*92:4+progress*92;
  style.setProperty('--tear',progress.toFixed(3));style.setProperty('--tear-origin',dir<0?'right':'left');style.setProperty('--tear-pos',(dir<0?1-progress:progress).toFixed(3));
  // the strip is split at the finger: --peel-clip is the torn part (behind it), --cap-clip what is still attached
  style.setProperty('--front',front.toFixed(2));style.setProperty('--peel-sign',dir<0?'-1':'1');
  style.setProperty('--peel-clip',dir<0?`inset(0 0 0 ${front.toFixed(2)}%)`:`inset(0 ${(100-front).toFixed(2)}% 0 0)`);
  style.setProperty('--cap-clip',dir<0?`inset(0 ${(100-front).toFixed(2)}% 0 0)`:`inset(0 0 0 ${front.toFixed(2)}%)`);
}
function resetTear() { ['--tear','--tear-origin','--tear-pos','--front','--peel-sign','--peel-clip','--cap-clip'].forEach((name)=>packPosition.style.removeProperty(name));scene.classList.remove('dragging','dragged'); }
async function openPack({dragged=false}={}) {
  if(phase!=='sealed')return;
  cancelPending();const token=sequence,draw=prepareDraw();prepared=null;
  if(!dragged)resetTear();
  setPhase('loading');packButton.disabled=true;packButton.setAttribute('aria-busy','true');syncNavigation();$('#message').textContent='';
  playRip(true);$('#announcement').textContent='팩을 뜯는 중입니다.';
  try{
    const card=draw.card,image=await draw.load;if(token!==sequence)return;
    $('#pack-position').classList.remove('pack-arriving');
    const T=timingOf(gradeOf(card));applyGrade(gradeOf(card));live={card,image,counted:false,isNew:false};
    const tear=()=>{
      setPhase('tearing');scene.classList.remove('charging','dragging');scene.classList.add('torn');playRip();burstLight(.18);
      // The card slides up out of the torn top while the empty pack is thrown away downwards (CSS, driven by --t-* of the grade).
      later(()=>{setPhase('opening');scene.classList.add('releasing');buildCard();burstLight(1);playImpact();playWhoosh();haptic(gradeOf(card));},reducedMotion.matches?30:T.tear);
      later(()=>{
        setPhase('emerging');setView('result');playSuspense();
        later(()=>revealCard(card,image),reducedMotion.matches?30:T.reveal);
      },reducedMotion.matches?60:T.emerge);
    };
    if(dragged){scene.classList.add('dragged');tear();}
    else{setPhase('charging');scene.classList.add('charging');playCharge();refreshMagnetic();later(tear,reducedMotion.matches?20:T.charge);}
  }catch{
    if(token!==sequence)return;
    resetTear();setPhase('sealed');packButton.disabled=false;packButton.removeAttribute('aria-busy');syncNavigation();
    $('#message').textContent='팩을 불러오지 못했어요. 다시 눌러주세요.';packButton.focus({preventScroll:true});
  }
}
// Drag sideways across the pack top to rip it by hand; a plain click / Enter still opens it.
function relaxTear(from,dir) {
  const start=performance.now(),step=(now)=>{
    if(phase!=='sealed' || drag)return;
    const t=Math.min(1,(now-start)/260);setTear(from*(1-t)*(1-t),dir);
    if(t<1)requestAnimationFrame(step);else resetTear();
  };
  requestAnimationFrame(step);
}
function finishTear(from,dir) {
  finishing=true;
  const start=performance.now(),step=(now)=>{
    const t=Math.min(1,(now-start)/(reducedMotion.matches?1:170));setTear(from+(1-from)*t*(2-t),dir);
    if(t<1)requestAnimationFrame(step);else{finishing=false;openPack({dragged:true});}
  };
  requestAnimationFrame(step);
}
function endDrag(event,cancelled) {
  if(!drag || event.pointerId!==drag.id)return;
  const {active,progress,dir}=drag;drag=null;
  if(!active)return;
  if(!cancelled){suppressClick=true;setTimeout(()=>{suppressClick=false;},60);}
  if(!cancelled && progress>=TEAR_DONE)finishTear(progress,dir);
  else relaxTear(progress,dir);
}
packButton.addEventListener('pointerdown',(event)=>{
  if(phase!=='sealed' || finishing || event.isPrimary===false || (event.pointerType==='mouse' && event.button!==0))return;
  resetTear();playRip(true);
  drag={id:event.pointerId,x:event.clientX,progress:0,dir:1,active:false};
  try{packButton.setPointerCapture(event.pointerId);}catch{/* Drag still works without capture. */}
});
packButton.addEventListener('pointermove',(event)=>{
  if(!drag || event.pointerId!==drag.id || phase!=='sealed')return;
  const dx=event.clientX-drag.x;
  if(!drag.active){
    if(Math.abs(dx)<12)return;
    drag.active=true;scene.classList.add('dragging');prepareDraw();playRip(true);
  }
  const progress=Math.min(1,Math.abs(dx)/(packButton.getBoundingClientRect().width*.75)),dir=dx<0?-1:1;
  playTearGrain(progress);drag.progress=progress;drag.dir=dir;setTear(progress,dir);
});
packButton.addEventListener('pointerup',(event)=>endDrag(event,false));
packButton.addEventListener('pointercancel',(event)=>endDrag(event,true));
packButton.addEventListener('lostpointercapture',(event)=>endDrag(event,true));

function clearStage() {
  cancelPending();collectionReturn=null;selectedCard=null;prepared=null;drag=null;resetTear();
  $('#reveal-zone').hidden=true;$('#reveal-zone').replaceChildren();
  $('#collection-panel').hidden=true;$('#collection-grid').replaceChildren();
  $('#pack-list').hidden=true;$('#pack-list').classList.remove('departing');$('#pack-grid').replaceChildren();
  $('#pack-position').hidden=true;$('#pack-position').classList.remove('pack-arriving');resetBoxes();
  $('#save-card').removeAttribute('href');$('#save-card').removeAttribute('download');
  $('#announcement').textContent='';$('#message').textContent='';
  scene.classList.remove('charging','torn','releasing','unveiling','previewing','skipped');clearGrade();live=null;
  $('#bundle-stage').hidden=true;
  document.querySelectorAll('.bundle-choice').forEach((button)=>button.disabled=false);
  packButton.disabled=false;packButton.removeAttribute('aria-busy');resetEffects();
}
function showBundles() {
  if(!stable())return;
  clearStage();setPhase('bundles');setView('bundles');renderBundles(activePack);$('#bundle-stage').hidden=false;
  syncNavigation();
  $('#bundle-stage .bundle-choice')?.focus({preventScroll:true});
}
function nextPack() {
  if(!stable())return;
  clearStage();
  setPackImage(activePack);
  $('#pack-position').hidden=false;setPhase('sealed');setView('pack');
  syncNavigation();refreshMagnetic();packButton.focus({preventScroll:true});
}

function renderPackList() {
  $('#pack-list-note').textContent=`출시 ${PACK_SETS.length} · 준비 중 ${UPCOMING_PACKS.length}`;
  $('#pack-grid').innerHTML=PACK_SETS.map((pack)=>{
    const owned=getCounts(pack).filter((n)=>n>0).length;
    return `<button class="pack-pick" data-pick-pack="${escapeHTML(pack.id)}" aria-label="${escapeHTML(pack.label)} 선택, 수집 ${owned} / ${pack.cards.length}"><span class="pack-pick-art"><img src="${escapeHTML(pack.boxImage)}" alt="" width="1254" height="1254" draggable="false"></span><span class="pack-pick-name">${escapeHTML(pack.label)}</span><span class="pack-pick-count">수집 ${owned} / ${pack.cards.length}</span><span class="pack-pick-cta">선택</span></button>`;
  }).join('')+UPCOMING_PACKS.map((soon)=>`<div class="pack-soon" role="group" aria-disabled="true" aria-label="${escapeHTML(soon.label)}, 출시 예정"><span class="pack-soon-art" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg></span><span class="pack-soon-name">COMING SOON</span><span class="pack-soon-sub">${escapeHTML(soon.label)}</span></div>`).join('');
}
function showPacks() {
  if(!stable() || phase==='packs')return;
  clearStage();setPhase('packs');setView('packs');renderPackList();
  $('#pack-list').hidden=false;$('#pack-list').scrollTop=0;syncNavigation();refreshMagnetic();
  $('#pack-list-title').focus({preventScroll:true});
}

// 카드 목록: 등급마다 별도 칸(SSS → C). 미발견 칸은 검은 카드 + ? 만 — 이름/이미지는 DOM 에 넣지 않는다(등급은 칸 머리글로 알 수 있음).
let collectionReturn=null; // {packId,top}: where the list was scrolled when a card was opened, so closing it lands back there
function renderCollection(pack) {
  const counts=getCounts(pack),owned=counts.filter((n)=>n>0).length,grades=packGrades(pack),chips=$('#grade-chips');
  $('#collection-count').textContent=`${owned} / ${pack.cards.length}`;
  $('#collection-summary').textContent=`${pack.label} · 총 ${counts.reduce((a,b)=>a+b,0).toLocaleString('ko-KR')}장 획득`;
  // 팩이 하나뿐이면 팩 탭을 숨긴다(팩이 늘면 자동으로 다시 표시).
  $('#pack-tabs').hidden=PACK_SETS.length<2;
  $('#pack-tabs').innerHTML=PACK_SETS.length<2 ? '' : PACK_SETS.map((item)=>`<button class="pack-tab" data-collection-pack="${escapeHTML(item.id)}" aria-pressed="${item.id===pack.id}">${escapeHTML(item.label)}</button>`).join('');
  const byGrade=grades.map((grade)=>{
    const entries=pack.cards.map((card,index)=>[card,index]).filter(([card])=>gradeOf(card)===grade);
    return {grade,entries,have:entries.filter(([,index])=>counts[index]>0).length};
  });
  // 등급이 둘 이상이면 점프 칩(획득/전체)으로 해당 칸으로 스크롤한다.
  chips.hidden=byGrade.length<2;
  chips.innerHTML=byGrade.length<2 ? '' : byGrade.map(({grade,entries,have})=>`<button class="grade-chip" data-jump-grade="${escapeHTML(grade)}" data-grade="${escapeHTML(grade)}" aria-label="${escapeHTML(grade)} 등급으로 이동, ${have} / ${entries.length}">${escapeHTML(grade)} <small>${have}/${entries.length}</small></button>`).join('');
  $('#collection-grid').innerHTML=byGrade.map(({grade,entries,have})=>{
    const label=gradeLabel(grade),slots=entries.map(([card,index])=>{
      const count=counts[index];
      if(!count)return '<div class="collection-slot locked"><div class="unknown-card" role="img" aria-label="아직 뽑지 않은 카드"><span aria-hidden="true">?</span></div><p class="unknown-label">미발견</p></div>';
      return `<button class="collection-slot owned" data-owned-card="${card.id}" data-owned-pack="${escapeHTML(pack.id)}" aria-label="${escapeHTML(card.name)}, ${count}장 보유, 크게 보기"><span class="collection-art"><img src="${escapeHTML(card.image)}" alt="${escapeHTML(card.name)} ${escapeHTML(gradeOf(card))} 카드" width="756" height="1056" loading="lazy" decoding="async"></span><span class="collection-card-name">${escapeHTML(card.name)}<small class="owned-qty">× ${count}</small></span></button>`;
    }).join('');
    return `<section class="grade-panel" id="grade-panel-${escapeHTML(grade)}" data-grade="${escapeHTML(grade)}" aria-labelledby="grade-panel-${escapeHTML(grade)}-title"><header class="gp-head"><h3 class="gp-title" id="grade-panel-${escapeHTML(grade)}-title"><b>${escapeHTML(grade)}</b>${label?` <span>· ${escapeHTML(label)}</span>`:''}</h3><span class="gp-fx" aria-hidden="true"></span><span class="gp-progress"><span class="gp-num">${have} / ${entries.length}</span><span class="gp-bar" aria-hidden="true"><i style="width:${(have/entries.length*100).toFixed(1)}%"></i></span></span></header><div class="gp-cards">${slots}</div></section>`;
  }).join('');
}
function showCollection(packId=activePack.id) {
  if(!collectionUnlocked || !stable())return;
  const pack=PACK_SETS.find((item)=>item.id===packId);if(!pack)return;
  cancelPending();collectionPackId=pack.id;activePack=pack;syncCounts(pack);
  $('#bundle-stage').hidden=true;$('#pack-list').hidden=true;$('#pack-position').hidden=true;$('#reveal-zone').hidden=true;$('#reveal-zone').replaceChildren();
  scene.classList.remove('charging','torn','releasing','unveiling','previewing','skipped');clearGrade();live=null;
  setPhase('collection');setView('collection');resetEffects();renderCollection(pack);
  $('#collection-panel').hidden=false;$('#collection-panel').scrollTop=collectionReturn?.packId===pack.id ? collectionReturn.top : 0;collectionReturn=null;$('#message').textContent='';syncNavigation();
  $('#collection-title').focus({preventScroll:true});refreshMagnetic();
}
async function inspectOwnedCard(packId,cardId) {
  if(phase!=='collection')return;
  const pack=PACK_SETS.find((item)=>item.id===packId),index=pack?.cards.findIndex((card)=>String(card.id)===String(cardId));
  if(!pack || index<0 || !getCounts(pack)[index])return;
  cancelPending();const token=sequence,card=pack.cards[index];
  collectionReturn={packId:pack.id,top:$('#collection-panel').scrollTop||0};
  setPhase('inspecting');$('#collection-grid').setAttribute('aria-busy','true');syncNavigation();
  try{
    const image=await loadCard(card);if(token!==sequence)return;
    activePack=pack;applyGrade(gradeOf(card));buildCard(true);fillCardFront(card,image);scene.classList.add('previewing');
    $('#collection-panel').hidden=true;$('#collection-grid').replaceChildren();
    setPhase('revealed');setView('result');syncNavigation();refreshMagnetic();
    $('#announcement').textContent=`${card.name} ${gradeOf(card)} 카드, ${getCounts(pack)[index]}장 보유.`;$('#card-list').focus({preventScroll:true});
  }catch{
    if(token!==sequence)return;setPhase('collection');syncNavigation();$('#message').textContent='카드를 불러오지 못했어요. 다시 눌러주세요.';
  }finally{$('#collection-grid').removeAttribute('aria-busy');}
}

$('#bundle-stage').addEventListener('click',(event)=>{const button=event.target.closest('[data-pack]');if(button)selectPack(button.dataset.pack);});
packButton.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}openPack();});
$('#next-pack').addEventListener('click',nextPack);
$('#choose-bundle').addEventListener('click',()=>view==='bundles' ? showPacks() : showBundles());
$('#pack-list-open').addEventListener('click',showPacks);
$('#pack-grid').addEventListener('click',(event)=>{const button=event.target.closest('[data-pick-pack]');if(button)selectPack(button.dataset.pickPack);});
$('#card-list').addEventListener('click',()=>showCollection(collectionPackId));
$('#save-card').addEventListener('click',()=>{$('#message').textContent='카드를 저장했어요.';later(()=>{$('#message').textContent='';},2400);});
$('#pack-tabs').addEventListener('click',(event)=>{const button=event.target.closest('[data-collection-pack]');if(button)showCollection(button.dataset.collectionPack);});
$('#grade-chips').addEventListener('click',(event)=>{
  const button=event.target.closest('[data-jump-grade]');if(!button || phase!=='collection')return;
  $('#grade-panel-'+button.dataset.jumpGrade)?.scrollIntoView?.({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});
});
$('#collection-grid').addEventListener('click',(event)=>{const button=event.target.closest('[data-owned-card]');if(button)inspectOwnedCard(button.dataset.ownedPack,button.dataset.ownedCard);});
$('#skip-fx')?.addEventListener('click',skipOpening);
document.addEventListener('keydown',(event)=>{if(event.key==='Escape')skipOpening();});
renderPackList();syncNavigation();refreshMagnetic();
