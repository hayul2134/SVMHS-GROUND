// SVMHS GROUND — 카체이싱! 규칙·시뮬레이션 (2026-10-31 하율 "다함께 차차차처럼 — 플레이 방식까지 최대한 비슷하게", 미리보기 깃발 chase-game)
// 화면(js/chase.js)과 서버(functions/api/s)가 같이 쓴다 — document 등 브라우저 전용 코드 금지, 판에 영향을 주는 계산에 Math.sin·Math.random 금지(서버와 결과가 달라질 수 있음).
// 5차선 도로를 끝없이 달림(2026-10-31 하율 "5차선 · 화살표를 누르면 한 차선씩"): ←→ 한 번에 한 차선 이동, 점프로 차·바리케이드를 뛰어넘고, 연료통을 먹어 기름을 채움.
//   앞차에 바짝 붙었다가 옆 차선으로 빠지면(칼치기) '아슬아슬!' 보너스(연속이면 콤보) + 부스터 게이지 → 꽉 차면 부스터(무적, 앞차를 날려 버림).
//   부딪히면 끝 · 연료가 떨어지면 서서히 멈추며 끝. 점수 = 달린 거리(m) + 보너스.
// 판 = 시작 티켓 씨앗(서버가 줌) + 입력 기록 → 서버가 같은 판을 처음부터 다시 돌려 점수를 계산(simulate). 1프레임 = 1/60초 고정.
// 끝이 정해진 기록(CLAUDE.md 2026-10-30): 속도·차량 밀도·연료 소모가 계속 올라가 판이 반드시 끝남(시뮬레이션: 잘하는 봇도 몇 분 안).
// 저장값 = CHASE_MAX - 점수(다른 게임처럼 작을수록 1등). 판 기록 rounds = [끝난 프레임, ...입력] (입력 = 프레임 * 8 + 코드)
export const CHASE_MAX = 99999999;
export const FPS = 60, DT = 1 / 60;
export const W = 375, H = 640, ROAD_L = 0, ROAD_R = 375, LANES = 5, LANE_W = 75, PY = 512;
export const laneX = i => ROAD_L + LANE_W * (i + 0.5);
export const FAR = -1100;   // 차·아이템이 생기는 곳(멀리 앞) — 2026-10-31 차 뒤에서 보는 원근 시점으로 바꾸며 멀리서부터 보이게(예전 -40 근처)
export const MAX_F = FPS * 60 * 30;   // 30분 — 안전 상한(실제로는 훨씬 전에 끝남)
export const MAX_EV = 7000;   // 입력 상한(기록 저장 요청 64KB 안 — 10분 판도 보통 2,000개 안팎)
// 입력 코드: 0 왼쪽 한 차선 · 2 오른쪽 한 차선 · 4 점프 (1·3은 예전 '뗌' — 지금은 무시)
export const enc = (f, c) => f * 8 + c;
export const dec = x => ({ f: Math.floor(x / 8), c: x - Math.floor(x / 8) * 8 });

// 판 난수(mulberry32) — 상태를 판(s.a)에 숫자로 둬서 판을 통째로 복사할 수 있게(structuredClone)
export function rnd(s) { s.a = (s.a + 0x6d2b79f5) >>> 0; let t = s.a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const seedOf = ticket => /^[0-9a-f]{16}/.test(ticket || '') ? parseInt(ticket.slice(8, 16), 16) : 0;

// ===== 수치 (바꾸면 이미 쌓인 기록을 다시 검사할 때 결과가 달라짐 — 신중히) =====
export const P_HW = 12, P_HH = 24;          // 내 차 판정 반폭·반높이(그림은 조금 더 큼)
export const NEAR = 110, NEAR2 = 50;         // 아슬아슬(칼치기): 앞차 꽁무니와 내 차 앞 사이가 이 px 안일 때 옆 차선으로 빠지면 · NEAR2 안이면 두 배
export const JUMP_F = 40, JUMP_CD = 54;      // 점프 체공 0.67초 · 착지 뒤 다시 뛰기까지 0.9초
export const BOOST_F = 270, BOX_F = 180, GRACE_F = 70;   // 부스터 4.5초 · 아이템 상자 부스터 3초 · 부스터 끝난 뒤 무적 1.2초
export const FUEL0 = 100, CAN = 32;
export const COMBO_F = 180;                  // 아슬아슬 콤보가 이어지는 시간(3초)
export const LANE_V = 900;                   // 차선 바꾸는 속도 px/s (한 차선 약 0.08초)
export const SIDE_V = LANE_V;
const D_M = 8000;                            // 이 거리(m)까지 난이도가 빠르게 오르고, 그 뒤로도 천천히 계속 오름
export const diffOf = m => Math.min(1, m / D_M);
export const baseV = m => Math.min(1600, 720 + 620 * diffOf(m) + Math.max(0, m - D_M) * 0.04);   // 2026-10-31 하율 "훨씬 더 빨라도 돼" (예전 460~860)   // px/s (10px = 1m → 0.36배 하면 km/h)
export const drainOf = m => 3.3 + 3.6 * diffOf(m) + Math.max(0, m - D_M) * 0.0012;            // 연료 소모 /초
export const rowGap = m => Math.max(190, 520 - 260 * diffOf(m) - Math.max(0, m - D_M) * 0.018); // 차 줄 사이 거리(px, 내가 달린 거리 기준)

// 차 종류: hw·hh = 판정 반폭·반높이, w = 나오는 비율, from = 이 거리(m)부터
export const KINDS = [
  { k: 'sedan', hw: 14, hh: 23, w: 4 },
  { k: 'compact', hw: 13, hh: 19, w: 2.2 },
  { k: 'hatch', hw: 13, hh: 20, w: 2 },
  { k: 'suv', hw: 15, hh: 25, w: 2.4, from: 100 },
  { k: 'van', hw: 15, hh: 28, w: 1.6, from: 150 },
  { k: 'sports', hw: 14, hh: 21, w: 0.9, from: 200 },
  { k: 'taxi', hw: 14, hh: 23, w: 1.4, from: 300 },
  { k: 'pickup', hw: 15, hh: 27, w: 1.1, from: 400 },
  { k: 'truck', hw: 16, hh: 42, w: 1.3, from: 700 },
  { k: 'police', hw: 14, hh: 23, w: 0.35, from: 900 },
  { k: 'bus', hw: 17, hh: 56, w: 0.9, from: 1500 },
];
const kindPick = (r, m) => {
  const ks = KINDS.filter(k => !k.from || m >= k.from), T = ks.reduce((a, k) => a + k.w, 0);
  let x = r * T, i = 0; while (i < ks.length - 1 && (x -= ks[i].w) >= 0) i++;
  return ks[i];
};

const LQ = [null, null, null, null, null];   // 차선별 바로 위 차(판마다 새로 만들지 않음)
export function newSim(seed, fx = false) {
  return {
    a: seed >>> 0, fx, evs: [], f: 0, over: '', overF: -1,
    dist: 0, v: 0, fuel: FUEL0, fever: 0, boost: 0, grace: 0, combo: 0, lastNear: -9999, maxCombo: 0,
    bonus: 0, near: 0, boosts: 0, smash: 0, coins: 0, cans: 0, jumps: 0, boxes: 0,
    p: { lane: 2, x: laneX(2), vx: 0, air: 0, cd: 0, buf: 0 },
    cars: [], items: [], id: 0,
    nextRow: 520, nextFuel: 2200, nextCoin: 900, nextBox: 5200, nextWall: 14000, calm: 0,
  };
}
export const scoreOf = s => Math.floor(s.dist / 10) + s.bonus;
export const metersOf = s => Math.floor(s.dist / 10);
const ev = (s, t, x) => { if (s.fx) s.evs.push({ t, ...x }); };

export function input(s, c) {
  const p = s.p;
  if (c === 0 || c === 2) {
    const to = Math.max(0, Math.min(LANES - 1, p.lane + (c === 0 ? -1 : 1)));
    if (to === p.lane || s.over) return;
    // 칼치기: 지금 차선 바로 앞차에 바짝 붙어 있다가 빠지면 아슬아슬(땅에 있을 때·부스터 아닐 때, 차마다 한 번)
    if (!p.air && s.boost <= 0 && s.fuel > 0) {
      let best = null, gap = 1e9;
      for (const c2 of s.cars) {
        if (c2.dead || c2.near || Math.abs(c2.x - p.x) > LANE_W * 0.6) continue;
        const g = (PY - P_HH) - (c2.y + c2.hh);
        if (g >= -8 && g < NEAR && g < gap) { gap = g; best = c2; }
      }
      if (best) {
        best.near = 1;
        s.combo = s.f - s.lastNear <= COMBO_F ? s.combo + 1 : 1; s.lastNear = s.f; s.near++;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;
        const close = gap < NEAR2, pts = 20 * Math.min(s.combo, 10) * (close ? 2 : 1); s.bonus += pts;
        s.fever += (11 + 2 * Math.min(s.combo, 5)) * (close ? 1.5 : 1);
        ev(s, 'near', { x: best.x, y: best.y, combo: s.combo, pts, close });
        if (s.fever >= 100) { s.fever = 0; addBoost(s, BOOST_F); }
      }
    }
    p.lane = to;
  } else if (c === 4) p.buf = 8;
}

function laneFree(s, lane, y, hh, skip) {
  for (const c of s.cars) if (c !== skip && !c.dead && (c.lane === lane || c.to === lane) && Math.abs(c.y - y) < c.hh + hh + 46) return false;
  return true;
}
function spawnRow(s, m) {
  const r = () => rnd(s), d = diffOf(m);
  let n = 1 + (r() < 0.38 + 0.37 * d ? 1 : 0) + (r() < 0.12 + 0.33 * d ? 1 : 0) + (r() < 0.03 + 0.2 * d + Math.min(0.25, Math.max(0, m - D_M) / 16000) ? 1 : 0);
  if (n > LANES - 1) n = LANES - 1;   // 한 줄에 적어도 한 차선은 비움
  const lanes = [0, 1, 2, 3, 4];
  for (let i = LANES - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = lanes[i]; lanes[i] = lanes[j]; lanes[j] = t; }
  for (let i = 0; i < n; i++) {
    const lane = lanes[i];
    if (m > 400 && r() < 0.06 + 0.06 * d) {   // 콘(멈춰 있는 장애물 — 피하거나 뛰어넘기)
      s.items.push({ id: ++s.id, t: 'cone', x: laneX(lane), y: FAR, hw: 9, hh: 9 });
      continue;
    }
    const K = kindPick(r(), m), y = FAR - K.hh - r() * 40;
    if (!laneFree(s, lane, y, K.hh)) continue;
    const c = { id: ++s.id, k: K.k, hw: K.hw, hh: K.hh, lane, to: lane, x: laneX(lane), y, spd: s.v * (0.3 + r() * 0.25) + 60, near: 0, done: 0, dead: 0, chg: 0, blink: 0, mv: 0, col: Math.floor(r() * 10) };
    if (m > 250 && r() < 0.08 + 0.17 * d) c.chg = -200 + r() * 330;   // 이 높이(내 차 앞 약 380~700px)에 오면 깜빡이 켜고 옆 차선으로
    s.cars.push(c);
  }
}
function crash(s, why, x, y) { if (s.over) return; s.over = why; s.overF = s.f; ev(s, 'crash', { x, y }); }
function addBoost(s, f) { if (s.boost <= 0) s.boosts++; s.boost = Math.max(s.boost, f); s.grace = 0; ev(s, 'boost', {}); }

// 1프레임 진행
export function step(s) {
  if (s.over) return;
  s.f++;
  const dt = DT, p = s.p, m = s.dist / 10, d = diffOf(m);
  // 속도
  let tv = s.fuel > 0 ? baseV(m) : 0; if (s.boost > 0) tv *= 1.6;
  if (s.v < tv) s.v = Math.min(tv, s.v + (s.boost > 0 ? 1100 : 300) * dt); else s.v = Math.max(tv, s.v - (s.fuel > 0 ? 700 : 260) * dt);
  s.dist += s.v * dt;
  // 연료(부스터 중엔 안 닳음)
  if (s.boost <= 0 && s.fuel > 0) { s.fuel -= drainOf(m) * dt; if (s.fuel <= 0) { s.fuel = 0; ev(s, 'empty', {}); } }
  // 내 차: 정한 차선 가운데로(한 차선씩)
  const tx = laneX(p.lane), sp = LANE_V * dt;
  if (Math.abs(tx - p.x) <= sp) { p.x = tx; p.vx = 0; } else { p.vx = tx > p.x ? LANE_V : -LANE_V; p.x += tx > p.x ? sp : -sp; }
  // 점프(누른 뒤 8프레임 안에 뛸 수 있게 되면 뜀)
  let landed = false;
  if (p.air > 0) { p.air--; if (!p.air) { landed = true; p.cd = JUMP_CD; ev(s, 'land', {}); } }
  else if (p.cd > 0) p.cd--;
  if (p.buf > 0) { if (!p.air && !p.cd && s.fuel > 0) { p.air = JUMP_F; p.buf = 0; s.jumps++; ev(s, 'jump', {}); } else p.buf--; }
  // 생성(내가 달린 거리 기준)
  if (s.dist >= s.nextRow) {
    if (s.dist >= s.calm) spawnRow(s, m);
    s.nextRow = s.dist + rowGap(m) * (0.8 + rnd(s) * 0.45);
  }
  if (s.dist >= s.nextFuel) {
    const lane = Math.floor(rnd(s) * LANES);
    s.items.push({ id: ++s.id, t: 'fuel', x: laneX(lane), y: FAR, hw: 13, hh: 15 });
    s.nextFuel = s.dist + 4000 + 2400 * d + Math.max(0, m - D_M) * 0.6 + rnd(s) * 1100;
  }
  if (s.dist >= s.nextCoin) {
    const lane = Math.floor(rnd(s) * LANES), n = 4 + Math.floor(rnd(s) * 3);
    for (let i = 0; i < n; i++) s.items.push({ id: ++s.id, t: 'coin', x: laneX(lane), y: FAR - i * 44, hw: 11, hh: 11 });
    s.nextCoin = s.dist + 1400 + rnd(s) * 1400;
  }
  if (s.dist >= s.nextBox) {
    const lane = Math.floor(rnd(s) * LANES);
    s.items.push({ id: ++s.id, t: 'box', x: laneX(lane), y: FAR, hw: 14, hh: 14 });
    s.nextBox = s.dist + 10500 + rnd(s) * 5500;
  }
  if (m >= 1900 && s.dist >= s.nextWall) {   // 공사 바리케이드(도로 전체) — 점프로만 넘음
    // 바리케이드는 멈춰 있고 차는 앞으로 달리니 바리케이드가 앞차를 따라잡을 수 있음 → 모든 차가 내 차를 지나간 뒤에야 따라잡히는 먼 곳에 세움
    //   (차 c가 내 차 뒤(PY+60)까지 오는 시간 tc 동안 바리케이드가 c에 못 닿게: Yw ≤ c.y - c.spd·tc - 여유)
    let yw = FAR - 300;
    for (const c of s.cars) {
      if (c.dead || c.y - c.hh > PY + P_HH + 40) continue;
      const rel = Math.max(40, s.v - c.spd), tc = (PY + P_HH + 60 + c.hh - c.y) / rel;
      yw = Math.min(yw, c.y - c.hh - c.spd * tc - 200);
    }
    if (yw > -6000) {   // 너무 멀면 다음 줄에서 다시(그동안 차는 안 생김)
      s.items.push({ id: ++s.id, t: 'wall', x: (ROAD_L + ROAD_R) / 2, y: yw, hw: (ROAD_R - ROAD_L) / 2, hh: 9 });
      s.calm = s.dist + (PY - yw) + 400; s.nextRow = s.calm;   // 바리케이드가 내 차를 지날 때까지 새 차 없음
      s.nextWall = s.dist + (PY - yw) + 14500 + rnd(s) * 8000 - 3200 * d;
    } else { s.calm = s.dist + 1e9; s.nextRow = Math.max(s.nextRow, s.calm); }
  }
  // 차 움직임
  const cars = s.cars;
  for (const c of cars) {
    if (c.dead) { c.dead++; continue; }
    c.y += (s.v - c.spd) * dt;
    if (c.chg && !c.mv && !c.blink && c.y >= c.chg - 300) {
      const opts = [c.lane - 1, c.lane + 1].filter(l => l >= 0 && l < LANES);
      const to = opts[Math.floor(rnd(s) * opts.length)];
      if (laneFree(s, to, c.y, c.hh, c)) { c.to = to; c.blink = 40; } else c.chg = 0;
    }
    if (c.blink) { c.blink--; if (!c.blink) c.mv = 1; }
    else if (c.mv) {
      const tx = laneX(c.to), sp = 95 * dt;
      if (Math.abs(tx - c.x) <= sp) { c.x = tx; c.lane = c.to; c.mv = 0; c.chg = 0; } else c.x += tx > c.x ? sp : -sp;
    }
  }
  // 같은 차선 앞뒤 차가 겹치지 않게(뒤차가 앞차 속도에 맞춤)
  //   차 목록을 위(앞)부터 y순으로 유지(거의 정렬된 상태라 삽입 정렬이 한 번 훑기 수준) → 한 번 훑으며 차선마다 바로 위 차와 비교(서버에서 다시 돌릴 때 가볍게)
  for (let i = 1; i < cars.length; i++) {
    const c = cars[i]; let j = i - 1;
    while (j >= 0 && (cars[j].y > c.y || (cars[j].y === c.y && cars[j].id > c.id))) { cars[j + 1] = cars[j]; j--; }
    cars[j + 1] = c;
  }
  LQ[0] = LQ[1] = LQ[2] = LQ[3] = LQ[4] = null;
  for (let i = 0; i < cars.length; i++) {
    const b = cars[i]; if (b.dead) continue;
    const a = LQ[b.lane];
    if (a && a.y < b.y && b.y - a.y < a.hh + b.hh + 14 && b.spd > a.spd) b.spd = a.spd;
    LQ[b.lane] = b;
  }
  for (const it of s.items) it.y += s.v * dt;
  // 판정
  const ghost = s.boost > 0 || s.grace > 0, ground = p.air === 0;
  for (const c of cars) {
    if (c.dead) continue;
    const dx = Math.abs(c.x - p.x), dy = Math.abs(c.y - PY), hit = dx < c.hw + P_HW && dy < c.hh + P_HH;
    if (hit && (ground || landed)) {
      if (s.boost > 0) { c.dead = 1; s.smash++; s.bonus += 50; ev(s, 'smash', { id: c.id, x: c.x, y: c.y }); continue; }
      if (!ghost) { crash(s, 'crash', (c.x + p.x) / 2, (c.y + PY) / 2); return; }
    }
    if (!c.done && c.y - c.hh > PY + P_HH) c.done = 1;
  }
  for (const it of s.items) {
    if (it.got) continue;
    const dx = Math.abs(it.x - p.x), dy = Math.abs(it.y - PY);
    if (dx >= it.hw + P_HW || dy >= it.hh + P_HH) continue;
    if (it.t === 'wall' || it.t === 'cone') {
      if (!ground && !landed) continue;
      if (s.boost > 0 || (it.t === 'cone' && ghost)) { it.got = 1; s.bonus += 20; ev(s, 'smash', { x: it.t === 'wall' ? p.x : it.x, y: it.y, wall: it.t === 'wall' }); continue; }
      if (ghost && it.t === 'wall') continue;
      crash(s, it.t, p.x, it.y); return;
    }
    if (!ground) continue;   // 먹을 것은 바닥에서만
    it.got = 1;
    if (it.t === 'coin') { s.coins++; s.bonus += 10; s.fever = Math.min(99, s.fever + 2); ev(s, 'coin', { x: it.x, y: it.y }); }
    else if (it.t === 'fuel') { s.cans++; s.fuel = Math.min(FUEL0, s.fuel + CAN); s.bonus += 20; ev(s, 'fuel', { x: it.x, y: it.y }); }
    else if (it.t === 'box') { s.boxes++; s.bonus += 30; addBoost(s, BOX_F); ev(s, 'box', { x: it.x, y: it.y }); }
  }
  // 정리
  if (s.f % 30 === 0) {
    s.cars = cars.filter(c => c.y - c.hh < H + 140 && c.y + c.hh > FAR - 7000 && c.dead < 50);
    s.items = s.items.filter(it => it.y - it.hh < H + 60 && !it.got);
  }
  // 타이머
  if (s.boost > 0) { s.boost--; if (!s.boost) { s.grace = GRACE_F; ev(s, 'boostEnd', {}); } }
  else if (s.grace > 0) s.grace--;
  if (s.combo && s.f - s.lastNear > COMBO_F) { s.combo = 0; ev(s, 'comboEnd', {}); }
  if (s.fuel <= 0 && s.v < 12) { s.over = 'fuel'; s.overF = s.f; ev(s, 'stop', {}); }
  else if (s.f >= MAX_F) { s.over = 'cap'; s.overF = s.f; }
}

// 서버·검사용: 판 기록 [끝난 프레임, ...입력]을 처음부터 다시 돌림 → { score, m, f, why, near, maxCombo, boosts, smash, coins, cans, jumps, boxes } 또는 { err }
export function simulate(seed, rounds) {
  const end = rounds[0], evs = rounds.slice(1);
  if (!(end >= 1 && end <= MAX_F)) return { err: '끝난 시각이 이상해요' };
  if (evs.length > MAX_EV) return { err: '입력이 너무 많아요' };
  const s = newSim(seed);
  let k = 0, prev = 0;
  for (const x of evs) { const e = dec(x); if (!(e.f >= 0) || e.f < prev || e.c > 4 || e.f > end) return { err: `${k + 1}번째 입력이 맞지 않아요`, k }; prev = e.f; k++; }
  k = 0;
  while (!s.over && s.f < end + 2) {
    while (k < evs.length && dec(evs[k]).f <= s.f) input(s, dec(evs[k++]).c);
    step(s);
  }
  if (!s.over) return { err: '판이 끝나지 않았어요' };
  if (s.overF !== end) return { err: `판이 끝난 시각이 달라요(${end} → ${s.overF})` };
  return { score: scoreOf(s), m: metersOf(s), f: s.overF, why: s.over, near: s.near, maxCombo: s.maxCombo, boosts: s.boosts, smash: s.smash, coins: s.coins, cans: s.cans, jumps: s.jumps, boxes: s.boxes };
}
