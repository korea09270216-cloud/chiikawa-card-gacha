import { PACK_SETS, UPCOMING_PACKS } from './packs.js?v=40';
import { boxMarkup } from './box3d.js?v=40';
import { refreshMagnetic, burstLight, resetEffects, stopFx, playCharge, playRip, playImpact, playSuspense, playReveal, playWhoosh, playTearGrain, playTitle } from './effects.js?v=40';
import './grades.js?v=40';
import { TITLES, TITLE_UI, QUIPS, titleMet, pickQuip, cleanTitleStats, nextTitleStats, emptyTitleStats } from './titles.js?v=40';
import { encodeSave, decodeSave, mergeSnapshots, sanitizeSnapshot, summarize, diffSnapshots, foreignPacks } from './backup.js?v=40';

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
const TEAR_SWEEP = 700;
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
const stable = () => ['bundles','packs','sealed','revealed','collection','titles'].includes(phase);

function setPhase(next) { phase=next;scene.dataset.phase=next; }
function setView(next) { view=next;scene.dataset.view=next; }
function syncNavigation() {
  $('#result-actions').hidden = !stable() || ((view==='bundles' || view==='packs') && !collectionUnlocked);
  // 'Draw again' only makes sense once a card has been drawn (result) or while browsing the collection; on the box / sealed-pack screens the pack itself is the action.
  $('#next-pack').hidden = view!=='result' && view!=='collection' && view!=='titles';
  // Pack list is the first screen; its twin button is redundant there and on the box screen (whose back button leads to it).
  // The first screen lists cards per pack (a link on every pack tile), so its global button would be a duplicate.
  $('#card-list').hidden = !collectionUnlocked || view==='packs';
  // Title list link: the three entry screens only (the result bar is full; the two lists switch with their tabs).
  $('#title-list').hidden = !collectionUnlocked || !['packs','bundles','pack'].includes(view);
  $('#card-list').setAttribute('aria-expanded',String(view==='collection'));
  $('#save-card').hidden = view!=='result' || !selectedCard || phase!=='revealed';
  // Save-code link: top-right of the three list screens (pack list, card list, title list), also for a new visitor who wants to import.
  $('#backup-open').hidden = !stable() || !['packs','collection','titles'].includes(view);
  // One top-left way out of every screen: back to the pack list.
  $('#choose-bundle').hidden = view==='packs' || !stable();
  renderTicketBar();
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
// only: 이 등급들 안에서만 뽑는다(확정 뽑기권). 같은 등급 확률 비율은 그대로 유지된다.
function randomCard(pack=activePack,only=null) {
  const tiers=Object.entries(pack.rates||{}).map(([grade,rate])=>[grade,Math.round(Number(rate)*100)||0]).filter(([grade,weight])=>weight>0 && (!only || only.includes(grade)) && pack.cards.some((card)=>gradeOf(card)===grade));
  if(!tiers.length){const pool=only ? pack.cards.filter((card)=>only.includes(gradeOf(card))) : [];const cards=pool.length ? pool : pack.cards;return cards[randomInt(cards.length)];}
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
  document.querySelectorAll('#pack-grid button').forEach((button)=>button.disabled=true);
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
    // ~14% of the card is still in the mouth when the slide ends; never push its top edge off the screen.
    const out=Math.max(-packH*.395-cardH*.36,-(innerHeight/2-15-cardH/2-8));
    entrance.style.setProperty('--rise-s',scale.toFixed(3));entrance.style.setProperty('--rise-out',`${out.toFixed(1)}px`);
  }
}
function fillCardFront(card,image) {
  image.id='revealed-image';image.alt=`${card.name} ${gradeOf(card)} 카드`;image.width=756;image.height=1056;image.draggable=false;
  $('#reveal-zone .card-surface').prepend(image);
  selectedCard={packId:activePack.id,card};
  $('#save-card').href=card.image;$('#save-card').download=`${card.name}_${gradeOf(card)}.png`;
}
// ---- 칭호: 저장(chiikawa-titles-v1) · 판정(titles.js) · 획득 팝업 · 목록 ----
// 저장: {version:1,earned:{[id]:획득 시각(ms)},stats:{...}}. 읽기/쓰기는 항상 try/catch, 값은 검증하고, 다른 탭의 기록과는 합쳐서(earned 합집합) 덮어쓰지 않는다.
const TITLE_KEY='chiikawa-titles-v1',TITLE_TIERS=['common','rare','epic','legend'],toast=$('#title-toast'),toastCard=toast.querySelector('.tt-card');
const UI_DEFAULT={toastHeader:'칭호 획득!',toastLine:'새로운 칭호 [ {name} ] 를 획득했습니다!',toastGoList:'칭호 목록 ›',listTitle:'칭호 목록',listCount:'획득 {n} / {total}',lockedLabel:'미획득',lockedHiddenName:'???',titleListSubtitle:'',tabCards:'카드 목록',tabTitles:'칭호 목록',tierLabels:{common:'COMMON',rare:'RARE',epic:'EPIC',legend:'LEGEND'},earnedOn:'{date} 획득',moreNote:'외 {n}개의 칭호도 획득했어요',lockedNote:'조건은 비밀입니다. 뽑다 보면 알게 됩니다.',lockedSr:'비밀 칭호',lockedOpen:'비밀 칭호, 열어 보기'};
const ui = (key) => TITLE_UI?.[key] ?? UI_DEFAULT[key];
const fill = (text,values) => String(text).replace(/\{(\w+)\}/g,(match,key)=>key in values ? values[key] : match);
const tierOf = (title) => TITLE_TIERS.includes(title.tier) ? title.tier : 'common';
const tierLabel = (tier) => ui('tierLabels')?.[tier] ?? UI_DEFAULT.tierLabels[tier];
const pad2 = (n) => String(n).padStart(2,'0');
const titleDate = (at) => { const date=new Date(at);return `${date.getFullYear()}.${pad2(date.getMonth()+1)}.${pad2(date.getDate())}`; };
function readTitleState() {
  const state={earned:{},stats:emptyTitleStats()};
  try{
    const stored=JSON.parse(localStorage.getItem(TITLE_KEY));
    if(stored?.version===1){
      state.stats=cleanTitleStats(stored.stats);
      if(stored.earned && typeof stored.earned==='object')for(const [id,at] of Object.entries(stored.earned))if(/^[a-z][a-z0-9-]{0,39}$/.test(id) && Number.isFinite(at) && at>0 && at<8.64e15)state.earned[id]=at;
    }
  }catch{/* Titles stay usable with unavailable or invalid storage. */}
  return state;
}
// Titles only ever get earned: union of earned ids (earliest time wins); the stats of the tab that has drawn more.
function mergeTitleState(a,b) {
  const earned={...a.earned};
  for(const [id,at] of Object.entries(b.earned))earned[id]=Math.min(earned[id]??at,at);
  return {earned,stats:b.stats.draws>a.stats.draws ? b.stats : a.stats};
}
let titleState=readTitleState(),pendingDraw={won:[],quip:'',ticket:null};
// ---- 확정 뽑기권: 일반 뽑기 10번마다 1장, 쓰면 S 이상이 확정된다. 따로 저장하지 않고 통계(draws·ticketDraws)에서 계산하므로 저장 코드에도 그대로 실린다. ----
// 뽑기권으로 뽑은 횟수(ticketDraws)는 10번 세기에서 빼고, 보유 수 = 일반 뽑기 10번 묶음 수 - 쓴 수.
const TICKET_EVERY=10,TICKET_GRADES=['S','SS','SSS']; // a ticket is applied automatically to the next draw while you hold one
function ticketInfo(stats=titleState.stats) {
  const used=stats.ticketDraws||0,normal=Math.max(0,stats.draws-used),earned=Math.floor(normal/TICKET_EVERY);
  return {earned,balance:Math.max(0,earned-used),progress:normal%TICKET_EVERY};
}
const ticketReady = () => ticketInfo().balance>0 && activePack.cards.some((card)=>TICKET_GRADES.includes(gradeOf(card)));
function renderTicketBar() {
  const show=phase==='sealed' && view==='pack',bar=$('#ticket-bar');
  bar.hidden=!show;scene.dataset.ticket='';
  if(!show)return;
  const {balance,progress}=ticketInfo(),button=$('#ticket-toggle'),on=balance>0;
  button.innerHTML=on ? `<span aria-hidden="true">◆</span> S이상 뽑기권 적용됨${balance>1 ? ` <b>· ${balance}장</b>` : ''}` : `S이상 뽑기권까지 <b>${progress} / ${TICKET_EVERY}</b>`;
  if(on)scene.dataset.ticket='on';
}
function showTicketNote(info) {
  const note=$('#ticket-note');note.classList.remove('show');note.textContent='';
  if(!info)return;
  note.textContent=info.gained ? `◆ S이상 뽑기권을 받았습니다${info.balance>1 ? ` (보유 ${info.balance}장)` : ''}` : info.used ? `◆ S이상 뽑기권 적용됨${info.balance>0 ? ` · 남은 ${info.balance}장` : ''}` : `S이상 뽑기권까지 ${info.progress} / ${TICKET_EVERY}`;
  note.dataset.kind=info.gained ? 'gain' : info.used ? 'used' : 'progress';
  void note.offsetWidth;note.classList.add('show');
}

const recentQuips=[]; // the last few lines shown (this session only), so the same line never comes twice in a row
// Called once per counted draw (revealCard): updates the stats, awards newly met titles, saves, and picks this draw's one-liner. Returns {won: new titles, quip}.
function recordTitles(pack,card,counts,index,isNew,ticket=false) {
  titleState=mergeTitleState(titleState,readTitleState());
  const before=ticketInfo(titleState.stats);
  const when=new Date(),grade=gradeOf(card),stats=nextTitleStats(titleState.stats,{key:`${pack.id}:${card.id}`,grade,isNew,ticket,dayKey:`${when.getFullYear()}-${pad2(when.getMonth()+1)}-${pad2(when.getDate())}`});
  const ctx={stats,card,grade,index,isNew,pack,counts,hour:when.getHours()},earned={...titleState.earned};
  const won=TITLES.filter((title)=>!(earned[title.id]>0) && titleMet(title,ctx));
  won.forEach((title)=>{earned[title.id]=when.getTime();});
  titleState={earned,stats};
  try{localStorage.setItem(TITLE_KEY,JSON.stringify({version:1,earned,stats}));}catch{/* The titles still show this session. */}
  let quip='';
  try{quip=pickQuip(ctx,QUIPS,recentQuips);}catch{/* A broken quip table must not break the draw. */}
  if(quip)recentQuips.push(quip);if(recentQuips.length>4)recentQuips.shift();
  const after=ticketInfo(stats);
  return {won,quip,ticket:{used:ticket,gained:Math.max(0,after.earned-before.earned),balance:after.balance,progress:after.progress}};
}
// The one-liner under the result card (CSS fades it in); also read out through the live region.
function showQuip(quip) {
  $('#quip').textContent=quip;
  if(!quip)showTicketNote(null);
  if(quip){scene.setAttribute('data-quip','');$('#announcement').textContent+=` ${quip}`;}else scene.removeAttribute('data-quip');
}
function applyTitleUi() {
  document.querySelectorAll('[data-list-switch=cards]').forEach((button)=>{button.textContent=ui('tabCards');});
  document.querySelectorAll('[data-list-switch=titles]').forEach((button)=>{button.textContent=ui('tabTitles');});
  $('#title-heading').textContent=ui('listTitle');$('#title-list').innerHTML=`${escapeHTML(ui('tabTitles'))} <span aria-hidden="true">★</span>`;
  $('#title-open').textContent=ui('toastGoList');
}

// 획득 배너: 카드 위에 떠 있는 비모달 알림(role=status). 뒤 화면을 막지 않고 포커스도 가져가지 않는다.
// 한 번에 하나씩 큐(최대 3개, 나머지는 "외 N개")로 tier 별 시간만큼 보여 주고, 탭/클릭은 그 배너만 닫고(다음 배너가 이어짐), Esc 는 전부 닫는다. 호버/포커스 중에는 시간이 멈추고, 화면이 바뀌면 큐째 정리된다.
const TOAST_HOLD={common:3800,rare:4400,epic:5200,legend:6200},TOAST_OUT=400,TOAST_SOUND=320,TOAST_GAP=250,TOAST_GUARD=600,TOAST_RESUME=1500;
let toastQueue=[],toastMore=0,toastTimer=0,toastDue=0,toastSound=0,toastShownAt=0;
const toastHolds=new Set(); // 'pointer' / 'focus': while any is set the auto-close clock is stopped
const toastBusy = () => !toast.hidden || toastQueue.length>0;
function armToast(ms) { clearTimeout(toastTimer);toastDue=performance.now()+ms;toastTimer=setTimeout(leaveTitleToast,ms); }
// The name twice: whole for screen readers, per-letter (grouped by word, --i = letter number) for the staggered entrance.
function nameMarkup(name,spoken=name) {
  let i=0;
  const words=String(name).split(/\s+/).filter(Boolean).map((word)=>`<span class="tt-w">${Array.from(word).map((char)=>`<span class="tt-ch" style="--i:${i++}">${escapeHTML(char)}</span>`).join('')}</span>`).join(' ');
  return `<span class="tt-sr">${escapeHTML(spoken)}</span><span class="tt-vis" aria-hidden="true">${words}</span>`;
}
// The title typeface (assets/fonts/title-display.woff2, preloaded in index.html): make sure it is loading before a name is drawn; until it arrives the names use the fallback fonts.
const loadTitleFont = () => { try{document.fonts?.load?.('900 1em TitleDisplay')?.catch?.(()=>{});}catch{/* No Font Loading API: the fallback font is used. */} };
loadTitleFont();
function showTitleToast() {
  const title=toastQueue[0];if(!title)return;loadTitleFont();
  const tier=tierOf(title),last=toastQueue.length===1;
  clearTimeout(toastSound);toast.dataset.tier=tier;toast.classList.remove('is-in','is-out');toast.hidden=false;toastHolds.clear();
  // The live region is visible before its text is set, so screen readers announce the whole sentence.
  const [pre='',post='']=String(ui('toastLine')).split('{name}');
  const parts={'.tt-pre':pre.replace(/\s*\[\s*$/,'').trim(),'.tt-post':post.replace(/^\s*\]\s*/,'').trim()};
  for(const [selector,text] of Object.entries(parts)){const part=toast.querySelector(selector);part.textContent=text;part.hidden=!text;}
  $('#tt-eyebrow').textContent=ui('toastHeader');$('#tt-flavor').textContent=title.flavor;$('#tt-name').innerHTML=nameMarkup(title.name);
  $('#tt-sub').textContent=title.sub||'';$('#tt-sub').hidden=!title.sub;
  $('#tt-more').textContent=last && toastMore ? fill(ui('moreNote'),{n:toastMore}) : '';$('#tt-more').hidden=!(last && toastMore);
  void toast.offsetWidth;toast.classList.add('is-in'); // reflow first so a queued banner replays its entrance
  toastShownAt=performance.now();armToast(TOAST_HOLD[tier]);
  // The sound lands with the first letter of the name rising.
  if(reducedMotion.matches)playTitle(tier);else toastSound=setTimeout(()=>playTitle(tier),TOAST_SOUND);
}
function openTitleToast(won) {
  const rank = (title) => TITLE_TIERS.indexOf(tierOf(title));
  dismissTitleToast();
  // Best three win a slot, shown from the lowest to the highest tier so the climax comes last.
  toastQueue=won.slice().sort((a,b)=>rank(b)-rank(a)).slice(0,3).reverse();toastMore=won.length-toastQueue.length;
  showTitleToast();
}
// Fades the current banner out (CSS animation tt-out; a timer is the fallback), then after a short gap brings in the next one.
function leaveTitleToast() {
  if(toast.hidden || toast.classList.contains('is-out'))return;
  clearTimeout(toastTimer);toastQueue.shift();
  if(reducedMotion.matches)return finishTitleToast();
  toast.classList.remove('is-in');toast.classList.add('is-out');toastTimer=setTimeout(finishTitleToast,TOAST_OUT);
}
function finishTitleToast() { clearTimeout(toastTimer);hideTitleToast();if(toastQueue.length)toastTimer=setTimeout(showTitleToast,TOAST_GAP); }
function hideTitleToast() {
  const focused=toast.contains(document.activeElement);
  toast.hidden=true;toast.classList.remove('is-in','is-out');toastHolds.clear();
  if(focused){if($('#result-actions').hidden)document.activeElement.blur();else $('#card-list').focus({preventScroll:true});}
}
// Drops the banner and the rest of the queue at once (Esc, link, any screen change).
function dismissTitleToast() { clearTimeout(toastTimer);clearTimeout(toastSound);toastQueue=[];if(!toast.hidden)hideTitleToast(); }
function holdToast(kind) { if(toast.hidden || toast.classList.contains('is-out') || toastHolds.has(kind))return;if(!toastHolds.size){clearTimeout(toastTimer);toastDue=Math.max(toastDue-performance.now(),0);}toastHolds.add(kind); }
function releaseToast(kind) { if(!toastHolds.delete(kind) || toastHolds.size || toast.hidden || toast.classList.contains('is-out'))return;armToast(Math.max(toastDue,TOAST_RESUME)); }
toast.addEventListener('click',(event)=>{
  if(performance.now()-toastShownAt<TOAST_GUARD)return; // a stray tap while the banner is still arriving must not skip it unseen
  if(event.target.closest('#title-open')){dismissTitleToast();showTitles();}else leaveTitleToast();
});
toastCard.addEventListener('pointerenter',()=>{if(performance.now()-toastShownAt<1500)return;holdToast('pointer');}); // a pointer that was already resting where the banner appears (the click that opened the pack) must not pin it
toastCard.addEventListener('pointerleave',()=>releaseToast('pointer'));
toastCard.addEventListener('animationend',(event)=>{if(event.animationName==='tt-out' && toast.classList.contains('is-out'))finishTitleToast();});
toast.addEventListener('focusin',()=>holdToast('focus'));toast.addEventListener('focusout',()=>releaseToast('focus'));

// 칭호 목록: 티어별 섹션(legend → epic → rare → common, 칭호 없는 티어는 생략, 섹션 안은 titles.js 정의 순서). 헤더 = 티어 라벨 + 획득 n / m + 진행 바.
// 카드는 전부 <button>(누르면 상세 팝업): 획득 = 이름만(대사·조건·획득일은 팝업에서), 미획득 = 검은 카드 + ? + ???(칭호는 전부 히든: 이름·대사·조건·힌트·id 모두 DOM 에 넣지 않는다 — 어느 티어인지는 섹션이 알려 준다).
function renderTitles() {
  closeTitleDetail({instant:true,restore:false});
  titleState=mergeTitleState(titleState,readTitleState());
  const have=TITLES.filter((title)=>titleState.earned[title.id]>0).length;
  $('#title-count').textContent=fill(ui('listCount'),{n:have,total:TITLES.length});
  $('#title-summary').textContent=ui('titleListSubtitle');
  $('#title-grid').innerHTML=TITLE_TIERS.slice().reverse().map((tier)=>{
    const entries=TITLES.filter((title)=>tierOf(title)===tier);
    if(!entries.length)return '';
    const label=tierLabel(tier),owned=entries.filter((title)=>titleState.earned[title.id]>0).length,id=`tier-panel-${tier}`;
    const cards=entries.map((title)=>{
      const at=titleState.earned[title.id];
      if(!(at>0))return `<button type="button" class="title-card locked" aria-haspopup="dialog" aria-label="${escapeHTML(ui('lockedOpen'))}"><span class="tc-q" aria-hidden="true">?</span><span class="tc-hint" aria-hidden="true">${escapeHTML(ui('lockedHiddenName'))}</span></button>`;
      return `<button type="button" class="title-card owned" data-title-id="${escapeHTML(title.id)}" aria-haspopup="dialog"><span class="tc-name">${escapeHTML(title.name)}</span></button>`;
    }).join('');
    return `<section class="tier-panel" id="${id}" data-tier="${tier}" aria-labelledby="${id}-title"><header class="tp-head"><h3 class="tp-title" id="${id}-title"><b>${escapeHTML(label)}</b></h3><span class="tp-fx" aria-hidden="true"></span><span class="tp-progress"><span class="tp-num">${owned} / ${entries.length}</span><span class="tp-bar" aria-hidden="true"><i style="width:${(owned/entries.length*100).toFixed(1)}%"></i></span></span></header><div class="tp-cards">${cards}</div></section>`;
  }).join('');
}
function showTitles() {
  if(!collectionUnlocked || !stable() || phase==='titles')return;
  cancelPending();dismissTitleToast();showQuip('');
  $('#bundle-stage').hidden=true;$('#pack-list').hidden=true;$('#pack-position').hidden=true;$('#reveal-zone').hidden=true;$('#reveal-zone').replaceChildren();$('#collection-panel').hidden=true;$('#collection-grid').replaceChildren();
  scene.classList.remove('charging','torn','releasing','unveiling','previewing','skipped','card-leaving');clearGrade();live=null;
  setPhase('titles');setView('titles');resetEffects();renderTitles();
  $('#title-panel').hidden=false;$('#title-panel').scrollTop=0;$('#message').textContent='';syncNavigation();
  $('#title-heading').focus({preventScroll:true});refreshMagnetic();
}

// 칭호 상세 팝업: 목록의 칭호를 누르면 뜨는 반투명 유리 다이얼로그(모달). 뒤 화면(#scene)은 inert 로 두고 스크림(연한 딤)을 누르면 닫힌다.
// 획득 = 티어 · 이름(히어로) · 대사 · 보조 · 조건 · 획득일, 미획득 = 티어 · ??? · 비밀 안내 문구뿐(이름·조건·대사·힌트는 DOM 에 넣지 않는다).
// 닫기: Esc · 스크림 · × (200ms 역방향 후 숨김, 포커스는 눌렀던 카드로). 화면이 바뀌면(clearStage 등) 즉시 정리한다.
const detail=$('#title-detail'),DETAIL_OUT=200;
let detailReturn=null,detailTimer=0;
const detailOpen = () => !detail.hidden && !detail.classList.contains('is-out');
function openTitleDetail(card) {
  if(phase!=='titles' || !backup.hidden)return;loadTitleFont();
  const title=card.dataset.titleId ? TITLES.find((item)=>item.id===card.dataset.titleId) : null,at=title ? titleState.earned[title.id] : 0,earned=at>0;
  if(card.dataset.titleId && !earned)return;
  const tier=title ? tierOf(title) : (TITLE_TIERS.includes(card.closest('.tier-panel')?.dataset.tier) ? card.closest('.tier-panel').dataset.tier : 'common');
  clearTimeout(detailTimer);detail.classList.remove('is-out');
  detail.dataset.tier=tier;$('#td-eyebrow').textContent=tierLabel(tier);
  $('#td-name').innerHTML=earned ? nameMarkup(title.name) : nameMarkup(ui('lockedHiddenName'),ui('lockedSr'));
  $('#td-flavor').textContent=earned ? title.flavor : '';$('#td-flavor').hidden=!earned;
  $('#td-sub').textContent=earned ? title.sub||'' : '';$('#td-sub').hidden=!(earned && title.sub);
  $('#td-info').hidden=!earned;$('#td-desc').textContent=earned ? title.desc : '';
  $('#td-date').textContent=earned ? fill(ui('earnedOn'),{date:titleDate(at)}) : '';if(earned)$('#td-date').setAttribute('datetime',new Date(at).toISOString());else $('#td-date').removeAttribute('datetime');
  $('#td-note').textContent=earned ? '' : (ui('titleListSubtitle') || UI_DEFAULT.lockedNote);$('#td-note').hidden=earned;
  detailReturn=card;detail.hidden=false;scene.setAttribute('inert','');scene.setAttribute('aria-hidden','true');
  detail.querySelector('.td-body').scrollTop=0;$('#td-close').focus({preventScroll:true});
}
function finishTitleDetail() {
  clearTimeout(detailTimer);detail.hidden=true;detail.classList.remove('is-out');
  ['#td-eyebrow','#td-name','#td-flavor','#td-sub','#td-desc','#td-date','#td-note'].forEach((id)=>{$(id).textContent='';});
}
// instant: no exit animation (a screen change / re-render). restore:false: leave focus alone (the opener is gone or the caller moves it).
function closeTitleDetail({instant=false,restore=true}={}) {
  if(detail.hidden)return;
  const closing=detail.classList.contains('is-out');
  if(closing && !instant)return;
  clearTimeout(detailTimer);
  if(!closing){
    if(backup.hidden){scene.removeAttribute('inert');scene.removeAttribute('aria-hidden');}
    const back=detailReturn;detailReturn=null;
    if(restore)(back && back.isConnected!==false && !back.hidden ? back : $('#title-heading')).focus({preventScroll:true});
  }
  if(instant){finishTitleDetail();return;}
  detail.classList.add('is-out');detailTimer=setTimeout(finishTitleDetail,DETAIL_OUT);
}
$('#title-grid').addEventListener('click',(event)=>{const card=event.target.closest('.title-card');if(card)openTitleDetail(card);});
detail.addEventListener('click',(event)=>{if(event.target.closest('.td-scrim') || event.target.closest('.td-close'))closeTitleDetail();});
detail.addEventListener('keydown',(event)=>{if(event.key==='Tab'){event.preventDefault();$('#td-close').focus({preventScroll:true});}}); // the × is the only control: keep focus on it

// ---- 저장 코드: 기록(카드·칭호)을 한 줄 코드로 내보내고 불러온다. 기록은 이 브라우저(localStorage)에만 있어서, 사이트 데이터를 지우거나 기기를 바꿔도 이어 할 수 있게 한다.
// 코드 만들기/읽기/합치기는 backup.js(순수 함수), 여기는 화면·저장 반영만. 전부 기기 안에서 처리하고 서버로 보내지 않는다. 입력은 textContent/value 로만 다루고, 불러온 값은 backup.js 가 전부 재검증한다.
const backup=$('#backup-dialog'),bkPanel=backup.querySelector('.bk-panel'),bkStatus=$('#bk-status');
const BK_MSG={empty:'코드를 붙여넣어 주세요.',format:'저장 코드 형식이 아니에요. CK 로 시작하는 코드를 통째로 붙여넣어 주세요.',checksum:'코드가 잘렸거나 글자가 바뀌었어요. 처음부터 끝까지 그대로 다시 복사해 주세요.',version:'지원하지 않는 버전의 코드예요. 이 사이트에서 내보낸 최신 코드인지 확인해 주세요.',tooLarge:'코드가 너무 길어요. 저장 코드가 맞는지 확인해 주세요.',unsupported:'이 브라우저는 압축된 코드를 읽지 못해요. 최신 브라우저로 열어 주세요.',data:'코드 안의 기록이 올바르지 않아요. 다시 내보낸 코드를 사용해 주세요.'};
let bkReturn=null,bkToken=0,bkIncoming=null,bkMode='merge';
function currentSnapshot() {
  titleState=mergeTitleState(titleState,readTitleState());
  return sanitizeSnapshot({v:1,t:Date.now(),packs:Object.fromEntries(PACK_SETS.map((pack)=>[pack.storageKey,syncCounts(pack)])),titles:{earned:titleState.earned,stats:titleState.stats}});
}
function bkSum(snap) { const sum=summarize(snap,TITLES.map((title)=>title.id));return `카드 ${sum.cards} / ${sum.slots} · 칭호 ${sum.titles} / ${TITLES.length} · 뽑기 ${sum.draws.toLocaleString('ko-KR')}회`; }
// "합쳐지는 것" 한 줄(미리보기와 적용 결과가 같이 쓴다). 늘어나는 게 없으면 ''.
function bkGain(diff) {
  const more=diff.changedCards-diff.newCards-diff.lostCards,parts=[];
  if(diff.newCards)parts.push(`카드 +${diff.newCards}종 새로 합쳐짐`);
  if(more>0)parts.push(`보유 수가 늘어나는 카드 ${more}종`);
  if(diff.newTitles)parts.push(`칭호 +${diff.newTitles}개`);
  if(diff.drawsDelta>0)parts.push(`뽑기 +${diff.drawsDelta.toLocaleString('ko-KR')}회`);
  return parts.join(' · ');
}
function setBkStatus(text,error=false) { bkStatus.textContent=text;if(error)bkStatus.classList.add('err');else bkStatus.classList.remove('err'); }
const bkDisarm = () => { $('#bk-confirm').hidden=true;$('#bk-apply-row').hidden=false; };
// Forget a checked code (the pasted text stays unless clear=true) and go back to the default mode.
function resetImport(clear=false) {
  bkIncoming=null;bkMode='merge';$('#bk-preview').hidden=true;bkDisarm();$('#bk-warn').hidden=true;$('#bk-p-foreign').hidden=true;
  backup.querySelectorAll('[name=bk-mode]').forEach((radio)=>{radio.checked=radio.value==='merge';});
  if(clear)$('#bk-input').value='';
}
async function buildExport() {
  const token=++bkToken,snap=currentSnapshot(),sum=summarize(snap,TITLES.map((title)=>title.id)),empty=!sum.cards && !sum.titles && !sum.draws,area=$('#bk-code');
  $('#bk-summary').textContent=bkSum(snap);$('#bk-summary').hidden=empty;$('#bk-empty').hidden=!empty;$('#bk-export-body').hidden=empty;
  area.value='';$('#bk-copy').disabled=true;$('#bk-save').disabled=true;
  if(empty)return;
  let code='';
  try{code=await encodeSave(snap);}catch{/* Reported below. */}
  if(token!==bkToken || backup.hidden)return;
  if(!code){setBkStatus('코드를 만들지 못했어요. 새로고침한 뒤 다시 열어 주세요.',true);return;}
  area.value=code;$('#bk-copy').disabled=false;$('#bk-save').disabled=false;
}
function setBkTab(tab,focus=true) {
  bkToken++;setBkStatus('');
  backup.querySelectorAll('[data-bk-tab]').forEach((button)=>{const on=button.dataset.bkTab===tab;button.setAttribute('aria-selected',String(on));button.setAttribute('tabindex',on?'0':'-1');$('#bk-pane-'+button.dataset.bkTab).hidden=!on;});
  if(tab==='export')buildExport();
  if(focus)$('#bk-tab-'+tab).focus({preventScroll:true});
}
function openBackup() {
  if(!backup.hidden || !stable() || !toast.hidden || !detail.hidden)return;
  bkReturn=document.activeElement;resetImport(true);
  backup.hidden=false;scene.setAttribute('inert','');scene.setAttribute('aria-hidden','true');bkPanel.scrollTop=0;
  setBkTab('export');
}
function closeBackup() {
  if(backup.hidden)return;
  bkToken++;backup.hidden=true;scene.removeAttribute('inert');scene.removeAttribute('aria-hidden');resetImport(true);setBkStatus('');
  const back=bkReturn;bkReturn=null;
  (back && back!==document.body && back.isConnected!==false && !back.hidden ? back : $('#backup-open')).focus({preventScroll:true});
}
async function copyBackup() {
  const area=$('#bk-code');if(!area.value)return;
  try{await navigator.clipboard.writeText(area.value);setBkStatus('복사했어요.');return;}catch{/* Not allowed here: select the text and try the old way. */}
  area.focus({preventScroll:true});area.select?.();
  let done=false;
  try{done=document.execCommand('copy')===true;}catch{/* Selected anyway. */}
  if(done)setBkStatus('복사했어요.');else setBkStatus('복사하지 못했어요. 코드를 선택해 직접 복사해 주세요.',true);
}
function saveBackupFile() {
  const code=$('#bk-code').value;if(!code)return;
  try{
    const when=new Date(),link=document.createElement('a'),url=URL.createObjectURL(new Blob([code+'\n'],{type:'text/plain'}));
    link.href=url;link.download=`chiikawa-save-${when.getFullYear()}${pad2(when.getMonth()+1)}${pad2(when.getDate())}.txt`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    setBkStatus('파일로 저장했어요.');
  }catch{setBkStatus('파일로 저장하지 못했어요. 코드 복사를 이용해 주세요.',true);}
}
// 확인: 붙여넣은 코드를 읽어 미리보기를 보여 준다(아직 아무것도 바뀌지 않는다).
async function checkBackup() {
  resetImport();setBkStatus('');
  const token=++bkToken,result=await decodeSave($('#bk-input').value);
  if(token!==bkToken || backup.hidden)return;
  if(!result.ok){setBkStatus(BK_MSG[result.error] || BK_MSG.format,true);return;}
  bkIncoming=result.snapshot;
  const now=currentSnapshot(),foreign=foreignPacks(now,bkIncoming).length,at=bkIncoming.t;
  $('#bk-p-saved').textContent=at ? `${titleDate(at)} ${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}` : '알 수 없음';
  $('#bk-p-incoming').textContent=bkSum(mergeSnapshots(now,bkIncoming,'replace'));$('#bk-p-current').textContent=bkSum(now);
  $('#bk-p-foreign').textContent=`이 버전에서 아직 쓰지 않는 카드팩 기록 ${foreign}개는 건너뛰어요.`;$('#bk-p-foreign').hidden=!foreign;
  $('#bk-preview').hidden=false;updateBkChange();
  setBkStatus('코드를 확인했어요. 적용 방법을 고르고 ‘적용’을 눌러 주세요.');
}
function updateBkChange() {
  const now=currentSnapshot(),next=mergeSnapshots(now,bkIncoming,bkMode);
  $('#bk-p-change').textContent=bkMode==='replace' ? `${bkSum(next)} 로 바뀌어요` : (bkGain(diffSnapshots(now,next)) || '달라지는 기록이 없어요. 이미 모두 이 브라우저에 있어요');
  $('#bk-warn').hidden=bkMode!=='replace';bkDisarm();
}
// 적용: 메모리 상태 + localStorage + 화면을 한 번에 맞춘다(저장이 막혀 있어도 이번 방문 동안은 반영).
function applyBackup(mode) {
  if(!bkIncoming)return;
  const now=currentSnapshot(),next=mergeSnapshots(now,bkIncoming,mode),diff=diffSnapshots(now,next);
  let kept=true;
  for(const pack of PACK_SETS){
    const counts=next.packs[pack.storageKey] || getCounts(pack);countsByPack.set(pack.id,counts);
    let wrote=false;
    try{localStorage.setItem(pack.storageKey,JSON.stringify({version:1,counts}));wrote=true;}catch{kept=false;}
    // Overwrite means overwrite: the old per-pack records (read back as a floor on every load) would otherwise bring the replaced cards back.
    if(wrote && mode==='replace')for(const legacy of pack.legacyStorage||[])try{localStorage.removeItem(legacy.key);}catch{/* Left as it was. */}
  }
  titleState={earned:next.titles.earned,stats:cleanTitleStats(next.titles.stats)};
  try{localStorage.setItem(TITLE_KEY,JSON.stringify({version:1,earned:titleState.earned,stats:titleState.stats}));}catch{kept=false;}
  collectionUnlocked=[...countsByPack.values()].some((counts)=>counts.some((count)=>count>0));
  if(view==='packs')renderPackList();else if(view==='collection')renderCollection(activePack);else if(view==='titles')renderTitles();
  syncNavigation();
  const message=(mode==='replace' ? `덮어썼어요. 이제 ${bkSum(next)} 예요.` : (bkGain(diff) ? `합쳤어요. ${bkGain(diff)}` : '합쳤어요. 새로 더해진 기록은 없었어요.'))+(kept ? '' : ' 다만 이 브라우저가 저장을 막고 있어서, 이번 방문 동안만 유지돼요.');
  resetImport(true);setBkStatus(message,!kept);$('#announcement').textContent=message;
  $('#bk-tab-import').focus({preventScroll:true});
}
async function readBackupFile(file) {
  if(!file)return;
  if(file.size>40000){setBkStatus('파일이 너무 커요. 저장 코드 파일(.txt)이 맞는지 확인해 주세요.',true);return;}
  try{$('#bk-input').value=await file.text();}catch{setBkStatus('파일을 읽지 못했어요.',true);return;}
  checkBackup();
}
$('#backup-open').addEventListener('click',openBackup);
$('#bk-close').addEventListener('click',closeBackup);
$('#bk-copy').addEventListener('click',copyBackup);
$('#bk-save').addEventListener('click',saveBackupFile);
$('#bk-check').addEventListener('click',checkBackup);
$('#bk-pick').addEventListener('click',()=>$('#bk-file').click());
$('#bk-file').addEventListener('change',(event)=>{const input=event.target,file=input.files?.[0];try{input.value='';}catch{/* Picking the same file again may need a reload. */}readBackupFile(file);});
$('#bk-input').addEventListener('input',()=>{if(bkIncoming){resetImport();setBkStatus('');}});
$('#bk-code').addEventListener('focus',(event)=>event.target.select?.());
$('#bk-code').addEventListener('click',(event)=>event.target.select?.());
$('#bk-modes').addEventListener('change',(event)=>{if(event.target.name!=='bk-mode' || !bkIncoming)return;bkMode=event.target.value==='replace' ? 'replace' : 'merge';updateBkChange();});
$('#bk-apply').addEventListener('click',()=>{
  if(!bkIncoming)return;
  if(bkMode==='replace'){$('#bk-apply-row').hidden=true;$('#bk-confirm').hidden=false;$('#bk-yes').focus({preventScroll:true});}else applyBackup('merge');
});
$('#bk-yes').addEventListener('click',()=>applyBackup('replace'));
$('#bk-no').addEventListener('click',()=>{bkDisarm();$('#bk-apply').focus({preventScroll:true});});
backup.addEventListener('click',(event)=>{const tab=event.target.closest('[data-bk-tab]');if(tab && tab.getAttribute('aria-selected')!=='true')setBkTab(tab.dataset.bkTab);});
backup.addEventListener('keydown',(event)=>{
  if(event.key==='Tab'){
    const items=[...bkPanel.querySelectorAll('button,textarea,input,[tabindex="0"]')].filter((item)=>!item.disabled && item.getAttribute('tabindex')!=='-1' && !item.closest('[hidden]'));
    if(!items.length)return;
    const first=items[0],last=items[items.length-1],here=document.activeElement,inside=bkPanel.contains(here);
    if(event.shiftKey ? (here===first || !inside) : (here===last || !inside)){event.preventDefault();(event.shiftKey ? last : first).focus({preventScroll:true});}
  }else if((event.key==='ArrowLeft' || event.key==='ArrowRight') && event.target.closest?.('[data-bk-tab]')){
    event.preventDefault();setBkTab(event.target.dataset.bkTab==='export' ? 'import' : 'export');
  }
});

function finishReveal(card,isNew) {
  live=null;const {won,quip,ticket}=pendingDraw;pendingDraw={won:[],quip:'',ticket:null};
  setPhase('revealed');setView('result');$('#pack-position').hidden=true;packButton.removeAttribute('aria-busy');
  syncNavigation();$('#announcement').textContent=`${card.name} ${gradeOf(card)} 카드가 나타났습니다.${isNew?' 처음 만난 카드입니다.':''}`;
  $('#card-list').focus({preventScroll:true});refreshMagnetic();
  showQuip(quip);showTicketNote(ticket);
  if(won.length)openTitleToast(won);
}
function revealCard(card,image,instant=false) {
  setPhase('revealing');fillCardFront(card,image);scene.classList.add('unveiling');
  const counts=syncCounts(activePack),index=activePack.cards.findIndex((item)=>item.id===card.id),isNew=counts[index]===0;
  counts[index]++;collectionUnlocked=true;
  try{localStorage.setItem(activePack.storageKey,JSON.stringify({version:1,counts}));}catch{/* Download remains available without storage. */}
  if(live){live.counted=true;live.isNew=isNew;}
  pendingDraw=recordTitles(activePack,card,counts,index,isNew,Boolean(live?.ticket));
  if(isNew){$('#reveal-zone .card-magnetic')?.setAttribute('data-new','');$('#reveal-zone .card-entrance')?.insertAdjacentHTML('afterbegin','<div class="new-badge" aria-hidden="true"><span class="nb-rays"></span><span class="nb-rays nb-rays2"></span><span class="nb-text">NEW</span></div>');}
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
  const ticket=ticketReady();
  if(prepared && prepared.ticket!==ticket)prepared=null; // the ticket was switched on / off after the card was already picked
  if(!prepared){const card=randomCard(activePack,ticket ? TICKET_GRADES : null),load=loadCard(card);load.catch(()=>{});prepared={card,load,ticket};}
  return prepared;
}
function setTear(progress,dir=1) {
  const style=packPosition.style;
  style.setProperty('--tear',progress.toFixed(3));style.setProperty('--tear-dir',dir<0?'-1':'1');style.setProperty('--tear-origin',dir<0?'right':'left');
}
function resetTear() { ['--tear','--tear-dir','--tear-origin'].forEach((name)=>packPosition.style.removeProperty(name));scene.classList.remove('dragging','dragged','auto-tearing'); }
// Registering --tear as a number lets CSS animate it, which is how a plain click tears the strip open by itself.
let tearAnimatable = false;
try{CSS.registerProperty({name:'--tear',syntax:'<number>',inherits:true,initialValue:'0'});tearAnimatable=true;}catch{/* Unsupported or already registered: the sweep is skipped. */}
// Click / Enter: after a short build-up the strip tears left to right on its own, like a drag, then the usual tear-off follows.
function autoTear(done) {
  if(!tearAnimatable || reducedMotion.matches){setTear(1,1);scene.classList.add('dragged');done();return;}
  setTear(0,1);scene.classList.remove('charging');scene.classList.add('dragging','auto-tearing');
  for(let i=0;i<7;i++)later(()=>playTearGrain(.25+i*.1),i*90);
  later(()=>{scene.classList.remove('auto-tearing');setTear(1,1);scene.classList.add('dragged');done();},TEAR_SWEEP);
}
async function openPack({dragged=false}={}) {
  if(phase!=='sealed')return;
  cancelPending();const token=sequence,draw=prepareDraw();prepared=null;
  if(!dragged)resetTear();
  setPhase('loading');packButton.disabled=true;packButton.setAttribute('aria-busy','true');syncNavigation();$('#message').textContent='';
  playRip(true);$('#announcement').textContent='팩을 뜯는 중입니다.';
  try{
    const card=draw.card,image=await draw.load;if(token!==sequence)return;
    $('#pack-position').classList.remove('pack-arriving');
    const T=timingOf(gradeOf(card));applyGrade(gradeOf(card));live={card,image,counted:false,isNew:false,ticket:draw.ticket};
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
    else{setPhase('charging');scene.classList.add('charging');playCharge();refreshMagnetic();later(()=>autoTear(tear),reducedMotion.matches?20:Math.max(350,T.charge-350));}
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
  closeTitleDetail({instant:true,restore:false});$('#title-panel').hidden=true;$('#title-grid').replaceChildren();dismissTitleToast();showQuip('');
  $('#pack-list').hidden=true;$('#pack-list').classList.remove('departing');$('#pack-grid').replaceChildren();
  $('#pack-position').hidden=true;$('#pack-position').classList.remove('pack-arriving');resetBoxes();
  $('#save-card').removeAttribute('href');$('#save-card').removeAttribute('download');
  $('#announcement').textContent='';$('#message').textContent='';
  scene.classList.remove('charging','torn','releasing','unveiling','previewing','skipped','card-leaving');clearGrade();live=null;
  $('#bundle-stage').hidden=true;
  document.querySelectorAll('.bundle-choice').forEach((button)=>button.disabled=false);
  packButton.disabled=false;packButton.removeAttribute('aria-busy');resetEffects();
}
function nextPack() {
  if(!stable())return;
  dismissTitleToast();
  const enter=()=>{
    clearStage();
    setPackImage(activePack);
    packPosition.hidden=false;packPosition.classList.add('pack-arriving');setPhase('sealed');setView('pack');
    syncNavigation();refreshMagnetic();packButton.focus({preventScroll:true});
    later(()=>packPosition.classList.remove('pack-arriving'),700);
  };
  // The shown card slides down and away first (a non-stable phase also blocks double taps), then the new pack appears from the centre.
  const entrance=$('#reveal-zone .card-entrance');
  if(entrance && typeof entrance.animate==='function' && !reducedMotion.matches){
    setPhase('leaving');syncNavigation();scene.classList.add('card-leaving');later(enter,430);
  }else enter();
}

function renderPackList() {
  $('#pack-list-note').textContent=`출시 ${PACK_SETS.length} · 준비 중 ${UPCOMING_PACKS.length}`;
  $('#pack-grid').innerHTML=PACK_SETS.map((pack)=>{
    const owned=getCounts(pack).filter((n)=>n>0).length;
    // The tile art is a mouse shortcut; the real controls are the two buttons under it (pick the pack / open its card list).
    return `<div class="pack-tile"><button class="pack-pick" data-pick-pack="${escapeHTML(pack.id)}" tabindex="-1" aria-hidden="true"><span class="pack-pick-art"><img src="${escapeHTML(pack.boxImage)}" alt="" width="1254" height="1254" draggable="false"></span><span class="pack-pick-name">${escapeHTML(pack.label)}</span><span class="pack-pick-count">수집 ${owned} / ${pack.cards.length}</span></button><div class="pack-tile-actions"><button class="pack-pick-cta" data-pick-pack="${escapeHTML(pack.id)}" aria-label="${escapeHTML(pack.label)} 선택, 수집 ${owned} / ${pack.cards.length}">선택</button>${collectionUnlocked ? `<button class="pack-cards-link" data-pack-cards="${escapeHTML(pack.id)}" aria-label="${escapeHTML(pack.label)} 카드 목록">카드 목록 <span aria-hidden="true">▦</span></button>` : ''}</div></div>`;
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
  // 팩 탭은 팩이 하나여도 항상 표시한다(지금 보는 팩 이름이 보이고, 팩이 늘면 그대로 전환 탭이 된다).
  $('#pack-tabs').innerHTML=PACK_SETS.map((item)=>`<button class="pack-tab" data-collection-pack="${escapeHTML(item.id)}" aria-pressed="${item.id===pack.id}">${escapeHTML(item.label)}</button>`).join('');
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
  cancelPending();dismissTitleToast();showQuip('');collectionPackId=pack.id;activePack=pack;syncCounts(pack);
  closeTitleDetail({instant:true,restore:false});$('#title-panel').hidden=true;$('#title-grid').replaceChildren();
  $('#bundle-stage').hidden=true;$('#pack-list').hidden=true;$('#pack-position').hidden=true;$('#reveal-zone').hidden=true;$('#reveal-zone').replaceChildren();
  scene.classList.remove('charging','torn','releasing','unveiling','previewing','skipped','card-leaving');clearGrade();live=null;
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
$('#choose-bundle').addEventListener('click',showPacks);
$('#title-list').addEventListener('click',showTitles);
// Dragging must never start a native drag ghost or select text (the save-code boxes excepted).
for(const type of ['dragstart','selectstart'])document.addEventListener(type,(event)=>{const el=event.target.nodeType===1?event.target:event.target.parentElement;if(!el?.closest('textarea,input'))event.preventDefault();});
$('#pack-grid').addEventListener('click',(event)=>{
  const cards=event.target.closest('[data-pack-cards]');if(cards){showCollection(cards.dataset.packCards);return;}
  const button=event.target.closest('[data-pick-pack]');if(button)selectPack(button.dataset.pickPack);
});
$('#card-list').addEventListener('click',()=>showCollection(collectionPackId));
$('#save-card').addEventListener('click',()=>{$('#message').textContent='카드를 저장했어요.';later(()=>{$('#message').textContent='';},2400);});
$('#pack-tabs').addEventListener('click',(event)=>{const button=event.target.closest('[data-collection-pack]');if(button)showCollection(button.dataset.collectionPack);});
$('#grade-chips').addEventListener('click',(event)=>{
  const button=event.target.closest('[data-jump-grade]');if(!button || phase!=='collection')return;
  $('#grade-panel-'+button.dataset.jumpGrade)?.scrollIntoView?.({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});
});
$('#collection-grid').addEventListener('click',(event)=>{const button=event.target.closest('[data-owned-card]');if(button)inspectOwnedCard(button.dataset.ownedPack,button.dataset.ownedCard);});
document.querySelectorAll('.list-switch').forEach((group)=>group.addEventListener('click',(event)=>{
  const button=event.target.closest('[data-list-switch]');if(!button || button.getAttribute('aria-pressed')==='true')return;
  if(button.dataset.listSwitch==='titles')showTitles();else showCollection(collectionPackId);
}));
$('#skip-fx')?.addEventListener('click',skipOpening);
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){if(detailOpen())closeTitleDetail();else if(!backup.hidden)closeBackup();else if(!toastBusy())skipOpening();else dismissTitleToast();}});
applyTitleUi();renderPackList();syncNavigation();refreshMagnetic();
