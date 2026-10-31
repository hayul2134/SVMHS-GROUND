// SVMHS GROUND — 선생님 몰래 춤추기 규칙(화면 dance.js와 서버가 같이 씀) — 2026-10-31 하율 "선생님 몰래 춤추기 게임", 미리보기 깃발 dance-game
// 판은 1/60초 프레임 단위 정수로만 진행(기기·서버 결과가 같게). 선생님이 돌아보는 때·페이크·보는 시간은 시작 티켓 씨앗으로 정해짐.
// 입력은 '누름(춤) / 뗌' 두 가지뿐 → 기록 [끝난 프레임, ...enc(프레임, c)] 로 서버가 판을 처음부터 다시 돌려 점수를 확인.
// 점수: 춤추는 동안 초당 10점 × 배율(쉬지 않고 출수록 3초마다 +0.5, 최대 x4) + '세이프' 보너스(돌아보기 직전에 멈춤).
// 판이 끝나는 조건: 선생님이 보고 있을 때 춤추다 걸리기 3번(벌점 3점). 가만히 있으면 흥 게이지가 차서 저절로 춤추고,
//   60초 뒤에도 난이도가 계속 올라감(판서 시간 짧아짐·예고 짧아짐·갑자기 돌아보기 늘어남) → 오래 버틸수록 끝나게(티어 규칙: 끝이 정해진 기록).
export const DANCE_MAX = 99999999;
export const FPS = 60;
export const LIVES = 3;
export const MAX_F = FPS * 60 * 40;   // 40분 — 안전 상한(실제로는 훨씬 전에 끝남)
export const MAX_EV = 6000;           // 입력 상한(누름·뗌 — 10분 판도 보통 1,000개 안팎, 보류 기록 판 기록 7,000칸 안)
export const enc = (f, c) => f * 2 + c;   // c: 0 누름(춤) · 1 뗌
export const dec = x => ({ f: Math.floor(x / 2), c: x % 2 });
export function rnd(s) { s.a = (s.a + 0x6d2b79f5) >>> 0; let t = s.a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const seedOf = ticket => /^[0-9a-f]{16}/.test(ticket || '') ? parseInt(ticket.slice(8, 16), 16) : 0;

export const TURN_F = 12;        // 돌아서는 데 0.2초(이 사이에 멈추면 안 걸림)
export const CAUGHT_F = 96;      // 걸린 뒤 1.6초 혼남
export const SAFE_F = 27;        // 멈추고 0.45초 안에 선생님이 돌아보면 '세이프'
const COMBO_UP = 10, COMBO_DN = 7, COMBO_STEP = 10 * FPS * 3;   // 콤보(1/10프레임 단위): 춤 +10 · 쉼 -7 · 3초마다 배율 +0.5
export const HYPE_FULL = 1260, HYPE_UP = 3, HYPE_DN = 7, BURST_F = 78;   // 흥 게이지: 쉬면 7초에 꽉 참 · 춤추면 3초에 비움 · 꽉 차면 1.3초 저절로 춤
const lerp = (a, b, k) => a + (b - a) * k;
export const m2Of = s => Math.min(8, 2 + Math.floor(s.combo / COMBO_STEP));   // 배율 × 2 (2 = x1 … 8 = x4)
export const scoreOf = s => Math.floor(s.sc12 / 12) + s.bonus;

export function newSim(seed, fx = false) {
  const s = { a: seed >>> 0, f: 0, st: 'write', tm: 150, feint: false, sudden: false, warnStart: -999, lives: LIVES,
    held: 0, dancing: false, combo: 0, m2: 2, hype: 0, forced: 0, lastStop: -999, lastM2: 2,
    sc12: 0, bonus: 0, over: '', overF: 0,
    safes: 0, bursts: 0, caught: 0, byBurst: 0, firstCaught: -1, maxM2: 2, danceF: 0, looks: 0,
    fx, evs: [] };
  return s;
}
const ev = (s, t, x) => { if (s.fx) s.evs.push({ t, ...x }); };
export function input(s, c) { s.held = c === 0 ? 1 : 0; }
const dk = s => Math.min(1, s.f / (FPS * 60));
const late = s => Math.max(0, s.f - FPS * 60) / (FPS * 60);

function caught(s) {
  s.lives--; s.caught++; if (s.forced > 0) s.byBurst++; if (s.firstCaught < 0) s.firstCaught = s.f;
  s.combo = 0; s.m2 = 2; s.forced = 0; s.dancing = false; s.hype = Math.min(s.hype, 378);
  s.st = 'caught'; s.tm = CAUGHT_F; ev(s, 'caught', { lives: s.lives });
}

export function step(s) {
  if (s.over) return;
  // --- 나 ---
  const was = s.dancing;
  if (s.forced > 0) s.forced--;
  s.dancing = s.st !== 'caught' && (s.held === 1 || s.forced > 0);
  if (was && !s.dancing) { s.lastStop = s.f; s.lastM2 = s.m2; }
  if (s.dancing) { s.combo += COMBO_UP; s.hype = Math.max(0, s.hype - HYPE_DN); s.sc12 += s.m2; s.danceF++; }
  else {
    s.combo = Math.max(0, s.combo - COMBO_DN);
    if (s.st !== 'caught') { s.hype += HYPE_UP; if (s.hype >= HYPE_FULL) { s.hype = 0; s.forced = BURST_F; s.bursts++; ev(s, 'burst', {}); } }
  }
  const m = m2Of(s);
  if (m > s.m2 && s.dancing) ev(s, 'mult', { m2: m });
  s.m2 = m; if (m > s.maxM2) s.maxM2 = m;
  // --- 선생님 ---
  s.tm--;
  const k = dk(s), L = late(s);
  if (s.st === 'write') {
    if (s.tm <= 0) {
      s.sudden = rnd(s) < Math.min(0.6, (k > 0.4 ? 0.12 : 0) + 0.15 * L);
      const w = s.sudden ? Math.max(8, Math.round(19 - 6 * L)) : Math.max(18, Math.round(FPS * lerp(0.95, 0.4, k) * (0.9 + 0.2 * rnd(s)) - 10 * L));
      s.feint = rnd(s) < Math.min(0.4, lerp(0.1, 0.3, k) + 0.05 * L);
      s.warnStart = s.f; s.st = 'warn'; s.tm = w; ev(s, 'warn', { w });
    }
  } else if (s.st === 'warn') {
    if (s.tm <= 0) {
      if (s.feint) { s.st = 'write'; s.tm = Math.max(30, Math.round(FPS * (lerp(1.4, 0.7, k) + 1.2 * rnd(s)))); ev(s, 'feint', {}); }
      else { s.st = 'turn'; s.tm = TURN_F; ev(s, 'turn', {}); }
    }
  } else if (s.st === 'turn') {
    if (s.tm <= 0) {
      s.st = 'look'; s.looks++; s.tm = Math.round(FPS * (0.9 + rnd(s) * lerp(1, 1.7, k))) + Math.round(30 * Math.min(L, 2));
      ev(s, 'look', {});
      if (!s.dancing && s.lastStop >= s.warnStart && s.f - s.lastStop < SAFE_F) { const b = Math.round(25 * s.lastM2 / 2); s.bonus += b; s.safes++; ev(s, 'safe', { b }); }
    }
  } else if (s.st === 'look') {
    if (s.dancing) caught(s);
    else if (s.tm <= 0) { s.st = 'turnback'; s.tm = TURN_F; ev(s, 'turnback', {}); }
  } else if (s.st === 'caught') {
    if (s.tm <= 0) {
      if (s.lives <= 0) { s.over = 'caught'; s.overF = s.f; ev(s, 'over', {}); s.f++; return; }
      s.st = 'turnback'; s.tm = TURN_F; ev(s, 'turnback', {});
    }
  } else if (s.st === 'turnback') {
    if (s.tm <= 0) { s.st = 'write'; s.tm = Math.max(30, Math.round(FPS * (lerp(2.6, 1, k) + rnd(s) * lerp(2.4, 1.4, k)) / (1 + 0.5 * L))); }
  }
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
export const resultOf = s => ({ score: scoreOf(s), f: s.overF, why: s.over, safes: s.safes, bursts: s.bursts, byBurst: s.byBurst, firstCaught: s.firstCaught, maxMult: s.maxM2 / 2, danceF: s.danceF, looks: s.looks });
