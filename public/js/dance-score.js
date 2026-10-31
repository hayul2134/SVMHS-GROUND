// SVMHS GROUND — 선생님 몰래 춤추기 규칙(화면 dance.js와 서버가 같이 씀) — 2026-10-31 하율 "선생님 몰래 춤추기 게임", 미리보기 깃발 dance-game
// 판은 1/60초 프레임 단위 정수로만 진행(기기·서버 결과가 같게). 선생님이 돌아보는 때·페이크·보는 시간은 시작 티켓 씨앗으로 정해짐.
// 입력은 '누름(춤) / 뗌' 두 가지뿐 → 기록 [끝난 프레임, ...enc(프레임, c)] 로 서버가 판을 처음부터 다시 돌려 점수를 확인.
// 점수: 춤추는 동안 초당 10점 × 배율(쉬지 않고 출수록 3초마다 +0.5, 최대 x4) + '세이프' 보너스(돌아보기 직전에 멈춤).
// 판이 끝나는 조건(2026-10-31 하율: 목숨 1개): 선생님이 보고 있을 때 춤추다 걸리거나, 춤을 안 춰서 졸음 게이지가 다 차 졸다가 걸리면 끝.
//   60초 뒤에도 난이도가 계속 올라감(판서 시간 짧아짐·예고 짧아짐·갑자기 돌아보기 늘어남) → 오래 버틸수록 끝나게(티어 규칙: 끝이 정해진 기록).
export const DANCE_MAX = 99999999;
export const FPS = 60;
export const LIVES = 1;   // 2026-10-31 하율: 목숨 1개 — 한 번 걸리면 끝
export const MAX_F = FPS * 60 * 40;   // 40분 — 안전 상한(실제로는 훨씬 전에 끝남)
export const MAX_EV = 6000;           // 입력 상한(누름·뗌 — 10분 판도 보통 1,000개 안팎, 보류 기록 판 기록 7,000칸 안)
export const enc = (f, c) => f * 2 + c;   // c: 0 누름(춤) · 1 뗌
export const dec = x => ({ f: Math.floor(x / 2), c: x % 2 });
export function rnd(s) { s.a = (s.a + 0x6d2b79f5) >>> 0; let t = s.a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const seedOf = ticket => /^[0-9a-f]{16}/.test(ticket || '') ? parseInt(ticket.slice(8, 16), 16) : 0;

export const TURN_F = 12;        // 보통 돌아서기 0.2초(이 사이에 멈추면 안 걸림)
export const WHIP_F = 7;         // 휙 돌아서기 0.12초
export const PEEK_IN = 8;        // 곁눈질: 고개 돌리는 0.13초 뒤부터는 보고 있는 것
export const CAUGHT_F = 96;      // 걸린 뒤 1.6초 혼남
export const SAFE_F = 27;        // 멈추고 0.45초 안에 선생님이 돌아보면 '세이프'
const COMBO_UP = 10, COMBO_DN = 7, COMBO_STEP = 10 * FPS * 3;   // 콤보(1/10프레임 단위): 춤 +10 · 쉼 -7 · 3초마다 배율 +0.5
export const SLEEP_FULL = 1440, SLEEP_UP = 3, SLEEP_DN = 8;   // 졸음 게이지(2026-10-31 하율 '흥' 대신): 춤 안 추면 8초에 꽉 참 → 졸다가 걸려서 끝 · 춤추면 3초에 다 깸
const lerp = (a, b, k) => a + (b - a) * k;
export const m2Of = s => Math.min(8, 2 + Math.floor(s.combo / COMBO_STEP));   // 배율 × 2 (2 = x1 … 8 = x4)
export const scoreOf = s => Math.floor(s.sc12 / 12) + s.bonus;

export function newSim(seed, fx = false) {
  const s = { a: seed >>> 0, f: 0, st: 'write', tm: 150, dur: 150, tf: TURN_F, plan: [], pat: '', warnStart: -999, lives: LIVES,
    held: 0, dancing: false, combo: 0, m2: 2, sleep: 0, deep: false, lastStop: -999, lastM2: 2,
    sc12: 0, bonus: 0, over: '', overF: 0,
    safes: 0, wakes: 0, caught: 0, why: '', firstCaught: -1, maxM2: 2, danceF: 0, looks: 0,
    fx, evs: [] };
  return s;
}
const ev = (s, t, x) => { if (s.fx) s.evs.push({ t, ...x }); };
export function input(s, c) { s.held = c === 0 ? 1 : 0; }
const dk = s => Math.min(1, s.f / (FPS * 60));
const late = s => Math.max(0, s.f - FPS * 60) / (FPS * 60);

function caught(s, why = 'caught') {
  s.lives--; s.caught++; s.why = why; if (s.firstCaught < 0) s.firstCaught = s.f;
  s.combo = 0; s.m2 = 2; s.dancing = false;
  s.plan = []; s.st = 'caught'; s.tm = s.dur = CAUGHT_F; ev(s, 'caught', { lives: s.lives, why });
}

// 선생님 움직임(2026-10-31 하율 "엄청 변칙적이고 예상하지 못하게"): 판서가 끝날 때마다 패턴 하나를 골라 단계(plan)를 차례로 진행.
//   단계: write(판서) · warn('흠…' 멈춤) · pause(말없이 펜만 멈춤) · peek(어깨 너머 곁눈질 — 보는 것과 같음) · turn(돌아서기, 보통 0.2초 / 휙 0.12초)
function setT(s, st, f) {
  const prev = s.st; s.st = st; s.tm = s.dur = Math.max(1, f);
  if (prev === 'write' && (st === 'warn' || st === 'pause' || st === 'peek')) s.warnStart = s.f;   // 신호가 시작된 때(세이프 판정)
  if (st === 'turn') { s.tf = s.dur; ev(s, 'turn', { fast: s.dur < TURN_F }); }
  else if (st === 'write') { if (prev === 'warn' || prev === 'pause' || prev === 'peek') ev(s, 'resume', {}); }
  else ev(s, st, { w: s.dur, pat: s.pat });
}
const humF = s => Math.max(16, Math.round(FPS * lerp(1.1, 0.45, dk(s)) * (0.9 + 0.2 * rnd(s)) - 10 * late(s)));
const whipCue = s => Math.max(9, Math.round(lerp(26, 12, dk(s)) - 3 * late(s) + rnd(s) * 4));
const whipF = s => Math.round(lerp(10, WHIP_F, dk(s)));   // 휙 돌아서기: 처음엔 0.17초 → 60초쯤 0.12초
const longF = s => Math.round(FPS * (1.4 + 2.2 * rnd(s)));
const pauseF = s => Math.round(FPS * (0.45 + 1.1 * rnd(s)));
const writeF = s => Math.max(30, Math.round(FPS * (lerp(2.6, 1, dk(s)) + rnd(s) * lerp(2.4, 1.4, dk(s))) / (1 + 0.5 * late(s))));
function pickPlan(s) {
  const k = dk(s), L = late(s), W = [
    ['normal', lerp(0.4, 0.2, k)],            // 흠… → 돌아봄
    ['humResume', 0.13],                       // 흠… → 그냥 다시 판서
    ['pauseResume', lerp(0.12, 0.14, k)],      // 말없이 멈췄다가 자연스럽게 다시 판서
    ['whip', lerp(0.05, 0.16, k) + 0.05 * L],  // 펜만 살짝 멈추고 휙
    ['longWhip', lerp(0.06, 0.12, k)],         // 흠… 하고 한참 멈춰 있다가 휙
    ['longResume', 0.08],                      // 흠… 하고 한참 멈춰 있다가 다시 판서
    ['peek', lerp(0.08, 0.12, k)],             // 어깨 너머 곁눈질(→ 다시 판서 또는 휙)
    ['pauseHum', 0.06],                        // 말없이 멈춤 → 흠… → 돌아봄
  ];
  if (s.f < FPS * 10) W.length = 3;   // 처음 10초는 '흠… → 돌아봄 / 다시 판서'만(익숙해질 시간)
  let sum = 0; for (const w of W) sum += w[1];
  let r = rnd(s) * sum, pat = W[0][0]; for (const w of W) { if (r < w[1]) { pat = w[0]; break; } r -= w[1]; }
  s.pat = pat;
  s.plan = pat === 'normal' ? [['warn', humF(s)], ['turn', TURN_F]]
    : pat === 'humResume' ? [['warn', humF(s) + 6]]
    : pat === 'pauseResume' ? [['pause', pauseF(s)]]
    : pat === 'whip' ? [['pause', whipCue(s)], ['turn', whipF(s)]]
    : pat === 'longWhip' ? [['warn', longF(s)], ['turn', whipF(s)]]
    : pat === 'longResume' ? [['warn', longF(s)]]
    : pat === 'peek' ? [['pause', Math.round(lerp(26, 13, dk(s)))], ['peek', PEEK_IN + 18 + Math.floor(rnd(s) * 30)], ...(rnd(s) < 0.4 ? [['pause', 8], ['turn', whipF(s)]] : [])]
    : [['pause', pauseF(s)], ['warn', Math.round(humF(s) * 0.7)], ['turn', TURN_F]];
}
function nextT(s) {
  if (!s.plan.length) { if (s.st === 'write') pickPlan(s); else { s.pat = ''; setT(s, 'write', writeF(s)); return; } }
  const [st, f] = s.plan.shift(); setT(s, st, f);
}

export function step(s) {
  if (s.over) return;
  // --- 나 ---
  const was = s.dancing;
  s.dancing = s.st !== 'caught' && s.held === 1;
  if (was && !s.dancing) { s.lastStop = s.f; s.lastM2 = s.m2; }
  if (s.dancing) { s.combo += COMBO_UP; s.sleep = Math.max(0, s.sleep - SLEEP_DN); if (s.deep && s.sleep < SLEEP_FULL / 2) { s.deep = false; s.wakes++; } s.sc12 += s.m2; s.danceF++; }
  else {
    s.combo = Math.max(0, s.combo - COMBO_DN);
    if (s.st !== 'caught') {
      s.sleep += SLEEP_UP; if (s.sleep >= SLEEP_FULL * 0.95) s.deep = true;
      if (s.sleep >= SLEEP_FULL) { s.sleep = SLEEP_FULL; caught(s, 'sleep'); s.f++; return; }   // 꾸벅 → 선생님이 휙 돌아봄 → 끝
    }
  }
  const m = m2Of(s);
  if (m > s.m2 && s.dancing) ev(s, 'mult', { m2: m });
  s.m2 = m; if (m > s.maxM2) s.maxM2 = m;
  // --- 선생님 ---
  s.tm--;
  if (s.st === 'look') {
    if (s.dancing) { caught(s); s.f++; return; }
    if (s.tm <= 0) setT(s, 'turnback', TURN_F);
  } else if (s.st === 'peek') {
    if (s.dur - s.tm >= PEEK_IN && s.dancing) { caught(s); s.f++; return; }
    if (s.tm <= 0) nextT(s);
  } else if (s.st === 'turn') {
    if (s.tm <= 0) {
      const k = dk(s), L = late(s);
      setT(s, 'look', Math.round(FPS * (0.9 + rnd(s) * lerp(1, 1.7, k))) + Math.round(30 * Math.min(L, 2)) - (rnd(s) < 0.2 ? 30 : 0));   // 가끔 짧게 보고 마는 것도
      s.looks++;
      if (!s.dancing && s.lastStop >= s.warnStart && s.f - s.lastStop < SAFE_F) { const b = Math.round(25 * s.lastM2 / 2); s.bonus += b; s.safes++; ev(s, 'safe', { b }); }
    }
  } else if (s.st === 'caught') {
    if (s.tm <= 0) {
      if (s.lives <= 0) { s.over = s.why || 'caught'; s.overF = s.f; ev(s, 'over', {}); s.f++; return; }
      setT(s, 'turnback', TURN_F);
    }
  } else if (s.st === 'turnback') {
    if (s.tm <= 0) {
      // 다시 판서하는 척하다가 휙 다시 돌아보기(재확인)
      const k = dk(s);
      if (s.lives > 0 && rnd(s) < lerp(0.08, 0.25, k)) { s.pat = 'recheck'; s.plan = [['write', 20 + Math.floor(rnd(s) * 40)], ['pause', whipCue(s)], ['turn', whipF(s)]]; }
      nextT(s);
    }
  } else if (s.tm <= 0) nextT(s);   // write · warn · pause
  s.f++;
  if (s.f >= MAX_F && !s.over) { s.over = 'cap'; s.overF = s.f; }
}

// 서버 검사: 입력 기록대로 판을 처음부터 다시 돌림
export function simulate(seed, rounds) {
  const end = rounds[0], evs = rounds.slice(1);
  if (!(end >= 1 && end <= MAX_F)) return { err: '끝난 시각이 이상해요' };
  if (evs.length > MAX_EV) return { err: '입력이 너무 많아요' };
  let k = 0, prev = 0;
  for (const x of evs) { const e = dec(x); if (!(e.f >= 0) || e.f < prev || e.f > end) return { err: `${k + 1}번째 입력이 맞지 않아요`, k }; prev = e.f; k++; }
  const s = newSim(seed);
  k = 0;
  while (!s.over && s.f < end + 2) {
    while (k < evs.length && dec(evs[k]).f <= s.f) input(s, dec(evs[k++]).c);
    step(s);
  }
  if (!s.over) return { err: '판이 끝나지 않았어요' };
  if (s.overF !== end) return { err: `판이 끝난 시각이 달라요(${end} → ${s.overF})` };
  return resultOf(s);
}
export const resultOf = s => ({  score: scoreOf(s), f: s.overF, why: s.over, safes: s.safes, wakes: s.wakes, firstCaught: s.firstCaught, maxMult: s.maxM2 / 2, danceF: s.danceF, looks: s.looks });
