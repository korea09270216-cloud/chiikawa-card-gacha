import { refreshMagnetic, burstLight, resetEffects, playRip, playReveal } from './effects.js?v=2';

// Card identities are never rendered or requested before the pack is opened.
const cards = [
  {id:1,name:'치이카와'}, {id:2,name:'하치와레'}, {id:3,name:'우사기'},
  {id:4,name:'모몽가'}, {id:5,name:'랏코'}, {id:6,name:'쿠리만쥬'}
];
const $ = (selector) => document.querySelector(selector);
const scene = $('#scene');
const packButton = $('#pack-button');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'chiikawa-awakening-v1';
let phase = 'sealed';
let counts = Array(6).fill(0);
let sequence = 0;
let timers = new Set();

try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored?.version === 1 && Array.isArray(stored.counts) && stored.counts.length === 6) {
    counts = stored.counts.map((n) => Number.isSafeInteger(n) && n >= 0 && n < 100000000 ? n : 0);
  }
} catch { /* Opening works when local storage is unavailable. */ }

function setPhase(next) {
  phase = next;
  scene.dataset.phase = next;
}

function later(callback,delay) {
  const token = sequence;
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (token === sequence) callback();
  },delay);
  timers.add(timer);
}

function randomCard() {
  const values = new Uint32Array(1);
  const limit = Math.floor(4294967296 / cards.length) * cards.length;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return cards[values[0] % cards.length];
}

function loadCard(card) {
  return new Promise((resolve,reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error('image timeout')),12000);
    function finish(error) {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      error ? reject(error) : resolve(image);
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error('image load failed'));
    image.src = `assets/cards/card-${String(card.id).padStart(2,'0')}.png`;
  });
}

function revealCard(card,image) {
  setPhase('revealing');
  // The only card image placed in the DOM is the result of this single opening.
  const zone = $('#reveal-zone');
  zone.innerHTML = '<div class="card-entrance"><div class="card-surface" data-magnetic><span class="foil" aria-hidden="true"></span><span class="specular" aria-hidden="true"></span><span class="reveal-sweep" aria-hidden="true"></span></div></div>';
  image.id = 'revealed-image';
  image.alt = `${card.name} SSS 카드`;
  image.width = 756;
  image.height = 1056;
  image.draggable = false;
  zone.querySelector('.card-surface').prepend(image);
  zone.hidden = false;
  const isNew = counts[card.id-1] === 0;
  counts[card.id-1] += 1;
  try { localStorage.setItem(storageKey,JSON.stringify({version:1,counts})); }
  catch { /* The current reveal and download remain available without storage. */ }
  $('#save-card').href = image.src;
  $('#save-card').download = `${card.name}_SSS.png`;
  burstLight(1);
  playReveal();
  later(() => {
    setPhase('revealed');
    $('#pack-position').hidden = true;
    packButton.removeAttribute('aria-busy');
    $('#result-actions').hidden = false;
    $('#announcement').textContent = `${card.name} SSS 카드가 나타났습니다.${isNew ? ' 처음 만난 카드입니다.' : ''}`;
    $('#next-pack').focus({preventScroll:true});
    refreshMagnetic();
  },reducedMotion.matches ? 80 : 1750);
}

async function openPack() {
  if (phase !== 'sealed') return;
  sequence += 1;
  const token = sequence;
  setPhase('loading');
  packButton.disabled = true;
  packButton.setAttribute('aria-busy','true');
  $('#message').textContent = '';
  // Unlock audio in the user's click gesture, before awaiting the card image.
  playRip(true);
  try {
    const card = randomCard();
    const image = await loadCard(card);
    if (token !== sequence) return;
    setPhase('tearing');
    scene.classList.add('torn');
    refreshMagnetic();
    playRip();
    burstLight(.22);
    later(() => {
      setPhase('opening');
      scene.classList.add('releasing');
      burstLight(.7);
      later(() => revealCard(card,image),reducedMotion.matches ? 30 : 260);
    },reducedMotion.matches ? 80 : 850);
  } catch {
    if (token !== sequence) return;
    setPhase('sealed');
    packButton.disabled = false;
    packButton.removeAttribute('aria-busy');
    $('#message').textContent = '팩을 불러오지 못했어요. 다시 눌러주세요.';
    packButton.focus({preventScroll:true});
  }
}

function nextPack() {
  if (phase !== 'revealed') return;
  sequence += 1;
  timers.forEach(clearTimeout);
  timers.clear();
  $('#reveal-zone').hidden = true;
  $('#reveal-zone').replaceChildren();
  $('#result-actions').hidden = true;
  $('#save-card').removeAttribute('href');
  $('#save-card').removeAttribute('download');
  $('#announcement').textContent = '';
  $('#message').textContent = '';
  scene.classList.remove('torn','releasing');
  setPhase('sealed');
  $('#pack-position').hidden = false;
  packButton.disabled = false;
  packButton.removeAttribute('aria-busy');
  resetEffects();
  refreshMagnetic();
  packButton.focus({preventScroll:true});
}

packButton.addEventListener('click',openPack);
$('#next-pack').addEventListener('click',nextPack);
refreshMagnetic();
