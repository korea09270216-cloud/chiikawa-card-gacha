// 저장 코드(백업) 순수 로직 — 서버·계정 없이 브라우저 기록(카드 수·칭호·통계)을 한 줄 문자열로 옮긴다. 외부 의존성 없음, DOM 없음.
//
// 스냅샷(앱 안에서 쓰는 형태): {v:1, t:저장시각(ms), packs:{[팩 storageKey]:[칸별 보유 수]}, titles:{earned:{[칭호 id]:획득 시각(ms)}, stats:{titles.js 의 통계 그대로}}}
//   팩이 늘어도 packs 에 storageKey 별로 담긴다. 칸 순서는 PACK_SETS[n].cards 순서(출시 후 불변).
// 코드 형식: `CK1-<payload>-<crc32 8hex>` (압축 가능한 브라우저에서는 `CK1z-<payload>-<crc32>`).
//   payload = JSON(짧은 키) → [deflate-raw] → base64url. 체크섬은 payload 앞까지("CK1z-xxxx") 전체 글자에 대한 CRC32 라서 오타·잘림·접두 변조를 잡는다.
//   공백·줄바꿈·보이지 않는 글자는 무시한다. 코드 길이 20000자·압축 해제 64KB 초과는 거부(압축 폭탄 방지).
// 병합 규칙(mergeSnapshots), 앱에 이미 있는 "탭끼리 합치기"와 같은 방향:
//   merge   카드: 칸별 max(현재, 불러온 값). 칭호: earned 합집합(같은 id 면 더 이른 시각), 모르는 id 도 그대로 보존.
//           통계: 뽑기 횟수(draws)가 더 큰 쪽의 통계 한 벌을 통째로 쓴다(연속 기록 등이 서로 섞여 모순되지 않게, 같으면 현재 것).
//   replace 카드: 불러온 값으로 교체(코드에 없는 팩은 0). 칭호·통계: 불러온 것으로 교체. 현재 앱이 모르는 팩(foreignPacks)은 어느 모드에서도 버린다.
// 불러온 값은 전부 엄격하게 재검증한다: 타입·범위(안전한 정수 0~1e8)·id 모양·배열 길이. 하나라도 틀리면 코드를 통째로 거부한다.
// (이 파일은 .qa/verify.mjs 의 vm 하네스에 스크립트로도 실려서, 내부 이름은 bk 로 시작하고 import / export default 는 쓰지 않는다.)

export const BACKUP_VERSION = 1;
export const BACKUP_MAX_CODE = 20000;
const BK_MAX_JSON = 65536;
const BK_GRADES = ['C', 'B', 'A', 'S', 'SS', 'SSS'];
const BK_RECENT_MAX = 120;
const BK_INT_STATS = ['draws', 'ticketDraws', 'repeatStreak', 'dupStreak', 'dupTotal', 'newStreak', 'dayDraws'];
const BK_ID = /^[a-z][a-z0-9-]{0,39}$/, BK_PACK = /^[a-z][a-z0-9-]{0,63}$/, BK_KEY = /^[\w:.-]{0,80}$/, BK_DAY = /^\d{4}-\d{2}-\d{2}$/;
const bkInt = (v) => Number.isSafeInteger(v) && v >= 0 && v < 100000000;
const bkTime = (v) => Number.isSafeInteger(v) && v > 0 && v < 8.64e15;
const bkHas = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const bkObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const bkBad = (strict, fallback) => { if (strict) throw new Error('data'); return fallback; };

function bkCleanStats(raw, strict) {
  const out = {draws: 0, ticketDraws: 0, lastCardKey: '', repeatStreak: 0, dupStreak: 0, dupTotal: 0, newStreak: 0, recent: [], drawn: {C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0}, dayKey: '', dayDraws: 0};
  if (raw == null) return out;
  if (!bkObj(raw)) return bkBad(strict, out);
  for (const name of BK_INT_STATS) if (raw[name] !== undefined) out[name] = bkInt(raw[name]) ? raw[name] : bkBad(strict, 0);
  if (raw.lastCardKey !== undefined) out.lastCardKey = typeof raw.lastCardKey === 'string' && BK_KEY.test(raw.lastCardKey) ? raw.lastCardKey : bkBad(strict, '');
  if (raw.dayKey !== undefined) out.dayKey = typeof raw.dayKey === 'string' && (raw.dayKey === '' || BK_DAY.test(raw.dayKey)) ? raw.dayKey : bkBad(strict, '');
  if (raw.recent !== undefined) {
    if (!Array.isArray(raw.recent) || (strict && raw.recent.length > BK_RECENT_MAX)) bkBad(strict, 0);
    else {
      if (strict && !raw.recent.every((g) => BK_GRADES.includes(g))) bkBad(strict, 0);
      out.recent = raw.recent.filter((g) => BK_GRADES.includes(g)).slice(-BK_RECENT_MAX);
    }
  }
  if (raw.drawn !== undefined) {
    if (!bkObj(raw.drawn)) bkBad(strict, 0);
    else for (const grade of BK_GRADES) if (raw.drawn[grade] !== undefined) out.drawn[grade] = bkInt(raw.drawn[grade]) ? raw.drawn[grade] : bkBad(strict, 0);
  }
  return out;
}

// 스냅샷 검증: strict 면 하나라도 틀릴 때 throw(코드 불러오기), 아니면 틀린 칸을 0/빈 값으로 고친다(내보내기 직전·앱 상태 정리).
function bkClean(raw, strict) {
  if (!bkObj(raw)) return bkBad(strict, {v: 1, t: 0, packs: {}, titles: {earned: {}, stats: bkCleanStats(null)}});
  if (raw.titles != null && !bkObj(raw.titles)) bkBad(strict, 0);
  const titles = bkObj(raw.titles) ? raw.titles : {};
  const snap = {v: 1, t: raw.t === undefined ? 0 : (bkTime(raw.t) ? raw.t : bkBad(strict, 0)), packs: {}, titles: {earned: {}, stats: bkCleanStats(titles.stats, strict)}};
  if (raw.packs != null) {
    if (!bkObj(raw.packs) || (strict && Object.keys(raw.packs).length > 16)) bkBad(strict, 0);
    else for (const key of Object.keys(raw.packs).slice(0, 16)) {
      const list = raw.packs[key];
      if (!BK_PACK.test(key) || !Array.isArray(list) || list.length < 1 || list.length > 2048) { bkBad(strict, 0); continue; }
      snap.packs[key] = list.map((n) => bkInt(n) ? n : bkBad(strict, 0));
    }
  }
  if (titles.earned != null) {
    if (!bkObj(titles.earned) || (strict && Object.keys(titles.earned).length > 500)) bkBad(strict, 0);
    else for (const id of Object.keys(titles.earned).slice(0, 500)) {
      if (!BK_ID.test(id) || !bkTime(titles.earned[id])) { bkBad(strict, 0); continue; }
      snap.titles.earned[id] = titles.earned[id];
    }
  }
  return snap;
}
// 어떤 입력이든 올바른 스냅샷으로(틀린 부분은 0/제외). 앱이 현재 기록을 내보내기 전에 쓴다.
export function sanitizeSnapshot(raw) { return bkClean(raw, false); }

// ---- 전송 형태(짧은 키) ----
function bkWire(snap) {
  const s = snap.titles.stats;
  return {v: BACKUP_VERSION, t: snap.t, p: snap.packs, e: snap.titles.earned,
    s: {d: s.draws, q: s.ticketDraws, r: s.repeatStreak, u: s.dupStreak, o: s.dupTotal, n: s.newStreak, y: s.dayDraws, k: s.lastCardKey, a: s.dayKey, g: s.recent.map((g) => BK_GRADES.indexOf(g)).join(''), w: BK_GRADES.map((g) => s.drawn[g] || 0)}};
}
function bkUnwire(w) {
  const s = bkObj(w.s) ? w.s : {};
  const recent = typeof s.g === 'string' ? [...s.g].map((c) => BK_GRADES[c]) : s.g;
  const drawn = Array.isArray(s.w) ? (s.w.length === BK_GRADES.length ? Object.fromEntries(BK_GRADES.map((g, i) => [g, s.w[i]])) : null) : s.w;
  return {v: w.v, t: w.t, packs: w.p, titles: {earned: w.e, stats: bkObj(w.s) ? {draws: s.d, ticketDraws: s.q, repeatStreak: s.r, dupStreak: s.u, dupTotal: s.o, newStreak: s.n, dayDraws: s.y, lastCardKey: s.k, dayKey: s.a, recent, drawn} : w.s}};
}

const bkText = (bytes) => { let out = ''; for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192)); return out; };
// ---- CRC32 · base64url · (de)flate ----
let bkTable = null;
export function backupChecksum(text) {
  if (!bkTable) { bkTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; bkTable.push(c >>> 0); } }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < text.length; i++) crc = bkTable[(crc ^ text.charCodeAt(i)) & 255] ^ (crc >>> 8);
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}
const BK_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function bkToB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0), left = bytes.length - i;
    out += BK_B64[n >> 18] + BK_B64[(n >> 12) & 63] + (left > 1 ? BK_B64[(n >> 6) & 63] : '') + (left > 2 ? BK_B64[n & 63] : '');
  }
  return out;
}
function bkFromB64(text) {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor(text.length * 3 / 4));
  let acc = 0, bits = 0, at = 0;
  for (let i = 0; i < text.length; i++) {
    const v = BK_B64.indexOf(text[i]);
    if (v < 0) return null;
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[at++] = (acc >> bits) & 255; acc &= (1 << bits) - 1; }
  }
  return out;
}
// 바이트를 압축/해제 스트림에 통과시킨다. 결과가 limit 바이트를 넘으면 중단(압축 폭탄).
async function bkPipe(bytes, stream, limit) {
  const writer = stream.writable.getWriter(), reader = stream.readable.getReader(), parts = [];
  let size = 0;
  writer.write(bytes).then(() => writer.close()).catch(() => {});
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { reader.cancel().catch(() => {}); throw new Error('size'); }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

// 스냅샷 → 코드 문자열. compress=false 면 압축 없이(`CK1-`). 압축 API 가 없거나 이득이 없으면 자동으로 무압축.
export async function encodeSave(snapshot, {compress = true} = {}) {
  const json = JSON.stringify(bkWire(bkClean(snapshot, false)));
  let bytes = Uint8Array.from(json, (c) => c.charCodeAt(0)), tag = '';
  if (compress && typeof CompressionStream === 'function') {
    try { const packed = await bkPipe(bytes, new CompressionStream('deflate-raw'), BK_MAX_JSON); if (packed.length < bytes.length) { bytes = packed; tag = 'z'; } } catch { /* Plain code instead. */ }
  }
  const head = `CK${BACKUP_VERSION}${tag}-${bkToB64(bytes)}`;
  return `${head}-${backupChecksum(head)}`;
}

// 코드 → {ok:true,snapshot} | {ok:false,error}. error: empty(빈 입력) format(코드가 아님/깨짐) version(지원하지 않는 버전) checksum(잘림·글자 바뀜) tooLarge unsupported(이 브라우저는 압축 해제 불가) data(내용이 올바르지 않음)
export async function decodeSave(code) {
  try {
    if (typeof code !== 'string') return {ok: false, error: 'format'};
    if (code.length > BACKUP_MAX_CODE * 3) return {ok: false, error: 'tooLarge'};
    const text = code.replace(/[\s​-‍⁠﻿]+/g, '');
    if (!text) return {ok: false, error: 'empty'};
    if (text.length > BACKUP_MAX_CODE) return {ok: false, error: 'tooLarge'};
    const m = /^CK(\d{1,3})(z?)-([A-Za-z0-9_-]*)-([0-9a-fA-F]{8})$/.exec(text);
    if (!m) return {ok: false, error: /^CK\d{1,3}z?-/.test(text) ? 'checksum' : 'format'};
    if (m[1] !== String(BACKUP_VERSION)) return {ok: false, error: 'version'};
    if (backupChecksum(text.slice(0, text.length - 9)) !== m[4].toLowerCase()) return {ok: false, error: 'checksum'};
    let bytes = bkFromB64(m[3]);
    if (!bytes) return {ok: false, error: 'format'};
    if (m[2]) {
      let stream = null;
      try { stream = new DecompressionStream('deflate-raw'); } catch { return {ok: false, error: 'unsupported'}; } // no API, or no deflate-raw in this browser
      try { bytes = await bkPipe(bytes, stream, BK_MAX_JSON); } catch { return {ok: false, error: 'format'}; }
    }
    let wire;
    try { wire = JSON.parse(bkText(bytes)); } catch { return {ok: false, error: 'format'}; }
    if (!bkObj(wire)) return {ok: false, error: 'format'};
    if (wire.v !== BACKUP_VERSION) return {ok: false, error: 'version'};
    return {ok: true, snapshot: bkClean(bkUnwire(wire), true)};
  } catch { return {ok: false, error: 'data'}; }
}

// ---- 합치기 · 비교 · 요약 (모두 순수 함수, 입력을 바꾸지 않는다) ----
const bkFit = (list, length) => Array.from({length}, (_, i) => bkInt(list?.[i]) ? list[i] : 0);
// current 가 가진 팩(과 그 칸 수)만 결과에 남는다. 코드에만 있는 팩은 버린다. 길이가 다르면 앞에서부터 맞추고 모자란 칸은 0, 남는 칸은 버린다.
export function mergeSnapshots(current, incoming, mode = 'merge') {
  const replace = mode === 'replace', packs = {};
  for (const key of Object.keys(current.packs)) {
    const now = current.packs[key], next = bkFit(bkHas(incoming.packs, key) ? incoming.packs[key] : null, now.length);
    packs[key] = replace ? next : now.map((n, i) => Math.max(n, next[i]));
  }
  const earned = replace ? {...incoming.titles.earned} : {...current.titles.earned};
  if (!replace) for (const id of Object.keys(incoming.titles.earned)) earned[id] = bkHas(earned, id) ? Math.min(earned[id], incoming.titles.earned[id]) : incoming.titles.earned[id];
  const pickIncoming = replace || incoming.titles.stats.draws > current.titles.stats.draws;
  return {v: BACKUP_VERSION, t: Math.max(current.t || 0, incoming.t || 0), packs, titles: {earned, stats: bkCleanStats(pickIncoming ? incoming.titles.stats : current.titles.stats, false)}};
}
// 코드에는 있지만 현재 앱에는 없는 팩의 키들(새 팩이 나오기 전 앱에서 새 코드를 열었을 때).
export function foreignPacks(current, incoming) { return Object.keys(incoming.packs).filter((key) => !bkHas(current.packs, key)); }
// 요약: cards = 가진 종류 수, slots = 전체 칸 수, titles = 획득 칭호 수(titleIds 를 주면 그중 아는 것만, 나머지는 extraTitles), draws = 뽑기 횟수.
export function summarize(snapshot, titleIds) {
  const lists = Object.values(snapshot.packs), ids = Object.keys(snapshot.titles.earned), known = titleIds ? ids.filter((id) => titleIds.includes(id)) : ids;
  return {cards: lists.reduce((sum, list) => sum + list.filter((n) => n > 0).length, 0), slots: lists.reduce((sum, list) => sum + list.length, 0), titles: known.length, extraTitles: ids.length - known.length, draws: snapshot.titles.stats.draws};
}
// before → after 변화: newCards(0→1+ 칸) lostCards(1+→0 칸) changedCards(수량이 달라진 칸) newTitles lostTitles drawsDelta
export function diffSnapshots(before, after) {
  const out = {newCards: 0, lostCards: 0, changedCards: 0, newTitles: 0, lostTitles: 0, drawsDelta: after.titles.stats.draws - before.titles.stats.draws};
  for (const key of Object.keys(after.packs)) (after.packs[key]).forEach((n, i) => {
    const was = bkHas(before.packs, key) ? before.packs[key][i] || 0 : 0;
    if (n !== was) out.changedCards++;
    if (!was && n) out.newCards++;
    if (was && !n) out.lostCards++;
  });
  for (const id of Object.keys(after.titles.earned)) if (!bkHas(before.titles.earned, id)) out.newTitles++;
  for (const id of Object.keys(before.titles.earned)) if (!bkHas(after.titles.earned, id)) out.lostTitles++;
  return out;
}
