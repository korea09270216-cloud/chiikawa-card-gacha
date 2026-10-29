import { PACK_SETS, UPCOMING_PACKS } from './packs.js?v=4';
import { boxMarkup } from './box3d.js?v=4';
import { refreshMagnetic, burstLight, resetEffects, playCharge, playRip, playImpact, playSuspense, playReveal } from './effects.js?v=4';

const $ = (selector) => document.querySelector(selector);
const scene = $('#scene');
const packButton = $('#pack-button');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const escapeHTML = (value) => String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const countsByPack = new Map();
let activePack = PACK_SETS[0];
let phase = 'bundles';
let view = 'bundles';
let selectedCard = null;
let collectionPackId = activePack.id;
let sequence = 0;
const timers = new Set();

for (const pack of PACK_SETS) {
  let counts = Array(pack.cards.length).fill(0);
  try {
    const stored = JSON.parse(localStorage.getItem(pack.storageKey));
    if (stored?.version === 1 && Array.isArray(stored.counts)) {
      counts = counts.map((_,index) => Number.isSafeInteger(stored.counts[index]) && stored.counts[index]>=0 && stored.counts[index]<100000000 ? stored.counts[index] : 0);
    }
  } catch { /* Opening remains usable with unavailable or invalid storage. */ }
  countsByPack.set(pack.id,counts);
}
let collectionUnlocked = [...countsByPack.values()].some((counts)=>counts.some((count)=>count>0));
const getCounts = (pack=activePack) => countsByPack.get(pack.id);
const stable = () => ['bundles','packs','sealed','revealed','collection'].includes(phase);

function setPhase(next) { phase=next;scene.dataset.phase=next; }
function setView(next) { view=next;scene.dataset.view=next; }
function syncNavigation() {
  $('#result-actions').hidden = !stable() || view==='packs' || (view==='bundles' && !collectionUnlocked);
  $('#pack-list-open').hidden = !stable() || view==='packs';
  $('#card-list').hidden = !collectionUnlocked;
  $('#card-list').setAttribute('aria-expanded',String(view==='collection'));
  $('#save-card').hidden = view!=='result' || !selectedCard || phase!=='revealed';
  $('#choose-bundle').hidden = view==='bundles' || !stable();
}
function later(callback,delay) {
  const token=sequence;
  const timer=setTimeout(()=>{timers.delete(timer);if(token===sequence)callback();},delay);
  timers.add(timer);
}
function cancelPending() { sequence++;timers.forEach(clearTimeout);timers.clear(); }
function randomCard(pack=activePack) {
  const values=new Uint32Array(1),limit=Math.floor(4294967296/pack.cards.length)*pack.cards.length;
  do{crypto.getRandomValues(values);}while(values[0]>=limit);
  return pack.cards[values[0]%pack.cards.length];
}
function loadCard(card) {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const timeout=setTimeout(()=>finish(new Error('image timeout')),12000);
    function finish(error){clearTimeout(timeout);image.onload=image.onerror=null;error?reject(error):resolve(image);}
    image.onload=()=>finish();image.onerror=()=>finish(new Error('image load failed'));image.src=card.image;
  });
}

function renderBundles() {
  $('#bundle-stage').innerHTML=PACK_SETS.map((pack)=>`<button class="bundle-choice" data-pack="${escapeHTML(pack.id)}" aria-label="${escapeHTML(pack.label)} 꾸러미 선택"><span class="bundle-float"><span class="bundle-tilt" data-magnetic data-base="-2">${boxMarkup(pack,escapeHTML)}</span></span>${PACK_SETS.length>1?`<span class="bundle-label">${escapeHTML(pack.label)}</span>`:''}</button>`).join('');
  refreshMagnetic();
}
function selectPack(packId) {
  if(phase!=='bundles' && phase!=='packs')return;
  const pack=PACK_SETS.find((item)=>item.id===packId);if(!pack)return;
  const fromList=phase==='packs',stage=fromList ? $('#pack-list') : $('#bundle-stage');
  activePack=pack;collectionPackId=pack.id;cancelPending();setPhase('selecting');syncNavigation();
  document.querySelectorAll('.bundle-choice,.pack-pick').forEach((button)=>button.disabled=true);
  stage.classList.add('departing');
  document.querySelectorAll('.packet-layer img').forEach((image)=>image.src=pack.wrapperImage);
  packButton.setAttribute('aria-label',`${pack.label} 밀봉 카드팩 뜯기`);
  later(()=>{
    stage.hidden=true;stage.classList.remove('departing');
    $('#pack-position').hidden=false;$('#pack-position').classList.add('pack-arriving');
    setView('pack');setPhase('sealed');packButton.disabled=false;syncNavigation();refreshMagnetic();
    packButton.focus({preventScroll:true});
    later(()=>$('#pack-position').classList.remove('pack-arriving'),700);
  },reducedMotion.matches?30:fromList?280:650);
}

function buildCard(preview=false) {
  $('#reveal-zone').innerHTML=`<div class="card-entrance"><div class="card-magnetic" data-magnetic><div class="card-surface"><span class="foil" aria-hidden="true"></span><span class="specular" aria-hidden="true"></span>${preview?'':'<span class="emerge-glare" aria-hidden="true"></span>'}</div></div></div>`;
  $('#reveal-zone').hidden=false;
}
function fillCardFront(card,image) {
  image.id='revealed-image';image.alt=`${card.name} SSS 카드`;image.width=756;image.height=1056;image.draggable=false;
  $('#reveal-zone .card-surface').prepend(image);
  selectedCard={packId:activePack.id,card};
  $('#save-card').href=card.image;$('#save-card').download=`${card.name}_SSS.png`;
}
function revealCard(card,image) {
  setPhase('revealing');fillCardFront(card,image);scene.classList.add('unveiling');
  const counts=getCounts(),index=activePack.cards.findIndex((item)=>item.id===card.id),isNew=counts[index]===0;
  counts[index]++;collectionUnlocked=true;
  try{localStorage.setItem(activePack.storageKey,JSON.stringify({version:1,counts}));}catch{/* Download remains available without storage. */}
  burstLight(.7);playReveal();
  later(()=>{
    setPhase('revealed');setView('result');$('#pack-position').hidden=true;packButton.removeAttribute('aria-busy');
    syncNavigation();$('#announcement').textContent=`${card.name} SSS 카드가 나타났습니다.${isNew?' 처음 만난 카드입니다.':''}`;
    $('#card-list').focus({preventScroll:true});refreshMagnetic();
  },reducedMotion.matches?60:1500);
}
async function openPack() {
  if(phase!=='sealed')return;
  cancelPending();const token=sequence;
  setPhase('loading');packButton.disabled=true;packButton.setAttribute('aria-busy','true');syncNavigation();$('#message').textContent='';
  playRip(true);
  try{
    const card=randomCard(),image=await loadCard(card);if(token!==sequence)return;
    $('#pack-position').classList.remove('pack-arriving');
    setPhase('charging');scene.classList.add('charging');playCharge();refreshMagnetic();
    later(()=>{setPhase('tearing');scene.classList.remove('charging');scene.classList.add('torn');playRip();burstLight(.18);},reducedMotion.matches?20:900);
    later(()=>{setPhase('opening');scene.classList.add('releasing');burstLight(.6);playImpact();},reducedMotion.matches?50:2500);
    later(()=>{
      setPhase('emerging');setView('result');buildCard();playSuspense();
      later(()=>revealCard(card,image),reducedMotion.matches?30:1000);
    },reducedMotion.matches?80:2950);
  }catch{
    if(token!==sequence)return;
    setPhase('sealed');packButton.disabled=false;packButton.removeAttribute('aria-busy');syncNavigation();
    $('#message').textContent='팩을 불러오지 못했어요. 다시 눌러주세요.';packButton.focus({preventScroll:true});
  }
}

function clearStage() {
  cancelPending();selectedCard=null;
  $('#reveal-zone').hidden=true;$('#reveal-zone').replaceChildren();
  $('#collection-panel').hidden=true;$('#collection-grid').replaceChildren();
  $('#pack-list').hidden=true;$('#pack-list').classList.remove('departing');$('#pack-grid').replaceChildren();
  $('#pack-position').hidden=true;$('#pack-position').classList.remove('pack-arriving');
  $('#save-card').removeAttribute('href');$('#save-card').removeAttribute('download');
  $('#announcement').textContent='';$('#message').textContent='';
  scene.classList.remove('charging','torn','releasing','unveiling','previewing');
  $('#bundle-stage').hidden=true;
  document.querySelectorAll('.bundle-choice').forEach((button)=>button.disabled=false);
  packButton.disabled=false;packButton.removeAttribute('aria-busy');resetEffects();
}
function showBundles() {
  if(!stable())return;
  clearStage();setPhase('bundles');setView('bundles');$('#bundle-stage').hidden=false;
  syncNavigation();refreshMagnetic();
  $('#bundle-stage .bundle-choice')?.focus({preventScroll:true});
}
function nextPack() {
  if(!stable())return;
  clearStage();
  document.querySelectorAll('.packet-layer img').forEach((image)=>image.src=activePack.wrapperImage);
  packButton.setAttribute('aria-label',`${activePack.label} 밀봉 카드팩 뜯기`);
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

function renderCollection(pack) {
  const counts=getCounts(pack),owned=counts.filter((n)=>n>0).length;
  $('#collection-count').textContent=`${owned} / ${pack.cards.length}`;
  $('#collection-summary').textContent=`${pack.label} · 총 ${counts.reduce((a,b)=>a+b,0).toLocaleString('ko-KR')}장 획득`;
  $('#pack-tabs').innerHTML=PACK_SETS.map((item)=>`<button class="pack-tab" data-collection-pack="${escapeHTML(item.id)}" aria-pressed="${item.id===pack.id}">${escapeHTML(item.label)}</button>`).join('');
  $('#collection-grid').innerHTML=pack.cards.map((card,index)=>{
    const count=counts[index];
    if(!count)return '<div class="collection-slot locked"><div class="unknown-card" role="img" aria-label="아직 뽑지 않은 카드"><span aria-hidden="true">?</span></div><p class="unknown-label">미발견</p></div>';
    return `<button class="collection-slot owned" data-owned-card="${card.id}" data-owned-pack="${escapeHTML(pack.id)}" aria-label="${escapeHTML(card.name)}, ${count}장 보유, 크게 보기"><span class="collection-art"><img src="${escapeHTML(card.image)}" alt="${escapeHTML(card.name)} SSS 카드" width="756" height="1056" loading="lazy"><span class="owned-count">× ${count}</span></span><span class="collection-card-name">${escapeHTML(card.name)}<small>SSS</small></span></button>`;
  }).join('');
}
function showCollection(packId=activePack.id) {
  if(!collectionUnlocked || !stable())return;
  const pack=PACK_SETS.find((item)=>item.id===packId);if(!pack)return;
  cancelPending();collectionPackId=pack.id;activePack=pack;
  $('#bundle-stage').hidden=true;$('#pack-list').hidden=true;$('#pack-position').hidden=true;$('#reveal-zone').hidden=true;$('#reveal-zone').replaceChildren();
  scene.classList.remove('charging','torn','releasing','unveiling','previewing');
  setPhase('collection');setView('collection');resetEffects();renderCollection(pack);
  $('#collection-panel').hidden=false;$('#collection-panel').scrollTop=0;$('#message').textContent='';syncNavigation();
  $('#collection-title').focus({preventScroll:true});refreshMagnetic();
}
async function inspectOwnedCard(packId,cardId) {
  if(phase!=='collection')return;
  const pack=PACK_SETS.find((item)=>item.id===packId),index=pack?.cards.findIndex((card)=>String(card.id)===String(cardId));
  if(!pack || index<0 || !getCounts(pack)[index])return;
  cancelPending();const token=sequence,card=pack.cards[index];
  setPhase('inspecting');$('#collection-grid').setAttribute('aria-busy','true');syncNavigation();
  try{
    const image=await loadCard(card);if(token!==sequence)return;
    activePack=pack;buildCard(true);fillCardFront(card,image);scene.classList.add('previewing');
    $('#collection-panel').hidden=true;$('#collection-grid').replaceChildren();
    setPhase('revealed');setView('result');syncNavigation();refreshMagnetic();
    $('#announcement').textContent=`${card.name} SSS 카드, ${getCounts(pack)[index]}장 보유.`;$('#card-list').focus({preventScroll:true});
  }catch{
    if(token!==sequence)return;setPhase('collection');syncNavigation();$('#message').textContent='카드를 불러오지 못했어요. 다시 눌러주세요.';
  }finally{$('#collection-grid').removeAttribute('aria-busy');}
}

$('#bundle-stage').addEventListener('click',(event)=>{const button=event.target.closest('[data-pack]');if(button)selectPack(button.dataset.pack);});
packButton.addEventListener('click',openPack);
$('#next-pack').addEventListener('click',nextPack);
$('#choose-bundle').addEventListener('click',showBundles);
$('#pack-list-open').addEventListener('click',showPacks);
$('#pack-grid').addEventListener('click',(event)=>{const button=event.target.closest('[data-pick-pack]');if(button)selectPack(button.dataset.pickPack);});
$('#card-list').addEventListener('click',()=>showCollection(collectionPackId));
$('#pack-tabs').addEventListener('click',(event)=>{const button=event.target.closest('[data-collection-pack]');if(button)showCollection(button.dataset.collectionPack);});
$('#collection-grid').addEventListener('click',(event)=>{const button=event.target.closest('[data-owned-card]');if(button)inspectOwnedCard(button.dataset.ownedPack,button.dataset.ownedCard);});
renderBundles();syncNavigation();
