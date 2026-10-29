import { refreshMagnetic, setEffectsEnabled } from './effects.js';

const cards = [
  {id:1,name:'치이카와',role:'종결급 황금 기사',element:'빛',color:'#ffd567'},
  {id:2,name:'하치와레',role:'초레어 신화 소환사',element:'무지개',color:'#7feeff'},
  {id:3,name:'우사기',role:'풀강 봉인 광전사',element:'암흑',color:'#efa1ff'},
  {id:4,name:'모몽가',role:'천하무쌍 마수 군주',element:'마수',color:'#ff9b94'},
  {id:5,name:'랏코',role:'신화급 종결 검성',element:'검',color:'#a7f7b7'},
  {id:6,name:'쿠리만쥬',role:'현시점원탑 차원 군주',element:'차원',color:'#80f9df'}
];
const $ = (selector) => document.querySelector(selector);
const imagePath = (id) => `assets/cards/card-${String(id).padStart(2,'0')}.png`;
const storageKey = 'chiikawa-awakening-v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let counts = Array(6).fill(0);
let ownedOnly = false;
let busy = false;
let lastDrawCount = 1;
let soundEnabled = false;
let effectsEnabled = !reducedMotion.matches;
let audioContext;
let toastTimer;
let revealTimer;
let storageWarning = false;

try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored && stored.version === 1 && Array.isArray(stored.counts) && stored.counts.length === 6) {
    counts = stored.counts.map((n) => Number.isSafeInteger(n) && n >= 0 && n <= 100000000 ? n : 0);
  }
} catch { /* Unavailable or malformed storage leaves a usable in-memory collection. */ }

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({version:1, counts})); }
  catch {
    if (!storageWarning) toast('이 브라우저에서는 저장할 수 없어요. 현재 화면에서만 수집 기록이 유지돼요.');
    storageWarning = true;
  }
}

function renderCollection() {
  const unique = counts.filter((n) => n > 0).length;
  $('#collection-count').innerHTML = `${unique} <small>/ 6</small>`;
  $('#nav-count').textContent = unique;
  $('#total-count').textContent = `총 ${counts.reduce((a,b) => a+b,0).toLocaleString('ko-KR')}장 뽑음`;
  $('#collection-progress').style.width = `${unique / 6 * 100}%`;
  $('.progress-track').setAttribute('aria-valuenow',unique);
  $('#collection-hint').textContent = unique === 6 ? '컬렉션 완성! 여섯 친구들의 눈부신 각성이 모두 모였어요.' : '6명의 작은 친구들, 하나의 눈부신 컬렉션.';
  $('#collection-grid').innerHTML = cards.filter((card) => !ownedOnly || counts[card.id-1]).map((card) => {
    const count = counts[card.id-1];
    return `<button class="collection-item ${count ? 'owned' : ''}" data-card="${card.id}" data-magnetic aria-label="${card.name}, ${count ? `${count}장 보유` : '미수집'}, 카드 자세히 보기"><div class="card-number"><span>NO. ${String(card.id).padStart(3,'0')}</span><span>${count ? 'COLLECTED' : 'UNDISCOVERED'}</span></div><div class="collection-art"><div class="card-surface"><img src="${imagePath(card.id)}" alt="${card.name} SSS 카드" width="756" height="1056" loading="lazy"><div class="foil"></div></div><span class="locked-badge" aria-hidden="true">✧</span>${count ? `<span class="count-badge">× ${count}</span>` : ''}</div><div class="card-meta"><h3>${card.name}</h3><span>SSS</span></div><p class="card-role">${card.role}</p></button>`;
  }).join('');
  $('#empty-state').hidden = !(ownedOnly && unique === 0);
  refreshMagnetic();
}

// Rejection sampling keeps all six outcomes exactly equiprobable.
function randomCard() {
  const values = new Uint32Array(1);
  const limit = Math.floor(4294967296 / cards.length) * cards.length;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return cards[values[0] % cards.length];
}

function playChime() {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    [523.25,659.25,783.99,1046.5].forEach((frequency,index) => {
      const at = audioContext.currentTime + index * .13;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0,at);
      gain.gain.linearRampToValueAtTime(.045,at+.025);
      gain.gain.exponentialRampToValueAtTime(.001,at+1.1);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at+1.2);
    });
  } catch { toast('이 브라우저에서는 효과음을 재생할 수 없어요.'); }
}

function renderResult(results, preview = false) {
  const multi = results.length > 1;
  $('#result-eyebrow').textContent = preview ? 'CARD ARCHIVE · MA01' : 'A LITTLE MIRACLE';
  $('#result-title').textContent = preview ? results[0].card.name : multi ? '여섯 번의 눈부신 만남' : `${results[0].card.name}, 각성!`;
  $('#result-subtitle').textContent = preview ? `${results[0].card.role} · ${counts[results[0].card.id-1] ? `${counts[results[0].card.id-1]}장 보유` : '아직 만나지 못한 친구예요'}` : multi ? `새로운 친구 ${results.filter((r) => r.isNew).length}명 · 모든 카드 SSS 확정` : `${results[0].card.role} · ${results[0].card.element} 속성`;
  $('#result-cards').className = multi ? 'result-grid' : 'result-single';
  $('#result-cards').innerHTML = results.map(({card,isNew},index) => `<div class="result-card" data-magnetic style="--i:${index};--card-color:${card.color}"><div class="card-surface"><img src="${imagePath(card.id)}" alt="${card.name} SSS 카드 원본" width="756" height="1056"><div class="foil"></div><div class="specular"></div></div><p class="result-card-label">${!preview ? `${isNew ? '<span class="new-badge">NEW</span>' : '<span class="duplicate-badge">중복</span>'}` : ''}<span>${card.name}</span><span class="duplicate-badge">× ${counts[card.id-1]}</span></p><a class="download-link" href="${imagePath(card.id)}" download="${card.name}_SSS.png">원본 저장 ↓</a></div>`).join('');
  $('#draw-again').innerHTML = preview ? '카드 뽑기 <span>✧</span>' : `${multi ? '6장 다시 뽑기' : '한 번 더 뽑기'} <span>✧</span>`;
  if (!$('#result-dialog').open) $('#result-dialog').showModal();
  refreshMagnetic();
}

function setBusy(value) {
  busy = value;
  ['#draw-one','#draw-six','#draw-again'].forEach((id) => $(id).disabled = value);
}

function finishReveal() {
  clearTimeout(revealTimer);
  $('#result-dialog').classList.remove('revealing');
  setBusy(false);
  refreshMagnetic();
}

function draw(amount) {
  if (busy) return;
  setBusy(true);
  lastDrawCount = amount;
  const results = Array.from({length:amount}, () => {
    const card = randomCard();
    const isNew = counts[card.id-1] === 0;
    counts[card.id-1] += 1;
    return {card,isNew};
  });
  // Persist the whole batch before animation; closing the dialog never loses cards.
  save();
  renderCollection();
  renderResult(results);
  $('#result-dialog').classList.remove('revealing');
  void $('#result-dialog').offsetWidth;
  $('#result-dialog').classList.add('revealing');
  playChime();
  $('#announcement').textContent = `${results.map((r) => r.card.name).join(', ')} 획득. 새로운 카드 ${results.filter((r) => r.isNew).length}장.`;
  revealTimer = setTimeout(finishReveal,reducedMotion.matches || !effectsEnabled ? 50 : 1800 + amount*100);
}

$('#draw-one').addEventListener('click',() => draw(1));
$('#draw-six').addEventListener('click',() => draw(6));
$('#draw-again').addEventListener('click',() => draw(lastDrawCount));
$('#close-result').addEventListener('click',() => $('#result-dialog').close());
$('#result-dialog').addEventListener('close',finishReveal);
$('#view-collection').addEventListener('click',() => {
  $('#result-dialog').close();
  $('#collection').scrollIntoView({behavior:reducedMotion.matches ? 'instant' : 'smooth'});
  $('#owned-filter').focus({preventScroll:true});
});
$('#collection-grid').addEventListener('click',(event) => {
  const button = event.target.closest('[data-card]');
  if (!button) return;
  lastDrawCount = 1;
  renderResult([{card:cards[Number(button.dataset.card)-1],isNew:false}],true);
});
$('#owned-filter').addEventListener('click',() => {
  ownedOnly = !ownedOnly;
  $('#owned-filter').setAttribute('aria-pressed',String(ownedOnly));
  $('#owned-filter').innerHTML = `보유 카드만 <span>${ownedOnly ? '●' : '○'}</span>`;
  renderCollection();
});
$('#sound-toggle').addEventListener('click',() => {
  soundEnabled = !soundEnabled;
  $('#sound-toggle').setAttribute('aria-pressed',String(soundEnabled));
  $('#sound-toggle').setAttribute('aria-label',soundEnabled ? '소리 끄기' : '소리 켜기');
  $('#sound-toggle svg').innerHTML = soundEnabled ? '<path d="M11 4 5 9H2v6h3l6 5V4ZM16 7c3 3 3 7 0 10M19 4c5 5 5 11 0 16"/>' : '<path d="M11 4 5 9H2v6h3l6 5V4ZM16 9l6 6m0-6-6 6"/>';
  toast(soundEnabled ? '효과음이 켜졌어요.' : '효과음이 꺼졌어요.');
  if (soundEnabled) playChime();
});
function applyEffects() {
  document.body.classList.toggle('effects-off',!effectsEnabled);
  $('#effects-toggle').setAttribute('aria-pressed',String(effectsEnabled));
  $('#effects-label').textContent = effectsEnabled ? 'ON' : 'OFF';
  setEffectsEnabled(effectsEnabled);
}
$('#effects-toggle').addEventListener('click',() => {effectsEnabled = !effectsEnabled;applyEffects();});
reducedMotion.addEventListener('change',(event) => {effectsEnabled = !event.matches;applyEffects();});
$('#probability-list').innerHTML = cards.map((card) => `<div class="probability-row"><span>${card.name} <small>SSS</small></span><span>1/6 · 약 16.67%</span></div>`).join('');
document.querySelectorAll('.probability-trigger').forEach((button) => button.addEventListener('click',() => $('#info-dialog').showModal()));
['#close-info','#info-confirm'].forEach((selector) => $(selector).addEventListener('click',() => $('#info-dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click',(event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
}));
window.addEventListener('storage',(event) => {
  if (event.key !== storageKey) return;
  try {
    const stored = JSON.parse(event.newValue);
    if (stored?.version === 1 && stored.counts?.length === 6 && stored.counts.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 100000000)) { counts = stored.counts; renderCollection(); }
  } catch { /* Ignore invalid cross-tab data. */ }
});
renderCollection();
applyEffects();
