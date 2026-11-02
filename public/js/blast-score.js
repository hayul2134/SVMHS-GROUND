// SVMHS GROUND — LED 월 켜기!(옛 카메라 가방 정리!) 규칙(블록 블라스트 방식, 2026-10-29 하율 "기자재 정리!를 블록블라스트 버전도") — 화면 js/blast.js · 서버 functions/api/s 같이 씀
// 판 8×8, 장비 케이스 3개씩 받아 아무 데나 놓기(중력 없음) → 가로줄·세로줄이 꽉 차면 정리(지워짐). 놓을 곳이 없으면 끝. 시간 제한 없음.
// 장비 순서 = 시작 티켓 씨앗(서버가 줌) + 지금 판 모양(3개 중 하나도 못 놓는 묶음은 다시 뽑음 — 판 모양에 따라 정해지니 서버도 똑같이 재현)
// 난이도(2026-10-29 출시 준비): 놓은 장비 50개까지는 그대로, 그 뒤 300개까지 큰 장비(하드 케이스·붐 마이크·조명 스탠드 등)가 점점 많이 나옴
//   — 시뮬레이션(묶음 3개를 미리 보고 두는 봇): 잘하는 학생 중앙 약 240개(10분 안팎)·보통 약 100개(약 5분)에서 끝남. 램프 없을 땐 잘하는 봇이 2,400개 상한까지 안 끝났음
// 저장값 = BLAST_MAX - 점수(다른 게임처럼 작을수록 1등). 판 기록 rounds = [끝난 ms, ...놓기] → 서버가 처음부터 다시 둬 보고 점수를 계산
export const BLAST_MAX = 99999999, N = 8, MIN_GAP = 120, MAX_MOVES = 2400;

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = ticket => /^[0-9a-f]{8}/.test(ticket || '') ? parseInt(ticket.slice(8, 16) || ticket.slice(0, 8), 16) : 0;

// 장비 케이스: k = 그림 종류(blast.js), w = 나오는 비율, s = 칸 [줄, 칸]
const L = (n, v) => Array.from({ length: n }, (_, i) => v ? [i, 0] : [0, i]);
const R = (h, w) => { const o = []; for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) o.push([r, c]); return o; };
const rot = s => { const m = Math.max(...s.map(x => x[0])); return s.map(([r, c]) => [c, m - r]); };   // 시계 방향 90°
const rots = (s, n = 4) => { const o = [s]; for (let i = 1; i < n; i++) o.push(rot(o[i - 1])); return o; };
const norm = s => { const r0 = Math.min(...s.map(x => x[0])), c0 = Math.min(...s.map(x => x[1])); return s.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const P = [];
const add = (k, w, shapes) => shapes.forEach(s => P.push({ k, w, s: norm(s), d: HARD[k] || 0 }));
// 난이도 묶음: 0 작은 것(갈수록 덜 나옴) · 1 중간(조금 더) · 2 큰 것(많이 더)
const HARD = { led: 1, tri: 1, mon: 1, cab: 1, cst: 1, boom: 2, case: 2, light: 2 };
export const RAMP = { from: 50, to: 300, mul: [-.7, .7, 2.2] };
export const rampOf = n => Math.max(0, Math.min(1, (n - RAMP.from) / (RAMP.to - RAMP.from)));   // 0 = 처음 난이도 · 1 = 가장 어려움
add('bat', 2.5, [[[0, 0]]]);                                  // 배터리 1칸
add('lens', 2.5, [L(2), L(2, 1)]);                            // 렌즈 2칸
add('sd', 2.5, [[[0, 0]]]);                                   // SD 카드 1칸(2026-10-29 하율 "SD를 1X1로" — 이전 3칸 직선)
add('led', 1.6, [L(4), L(4, 1)]);                             // LED 바 4칸
add('boom', 1, [L(5), L(5, 1)]);                              // 붐 마이크 5칸
add('cam', 3.5, [R(2, 2)]);                                   // 카메라 2×2
add('case', 1.1, [R(3, 3)]);                                  // 하드 케이스 3×3
add('mon', 1.3, [R(2, 3), R(3, 2)]);                          // 모니터 2×3
add('slide', 1.6, rots([[0, 0], [1, 0], [1, 1]]));            // 슬라이더 ㄴ 3칸
add('tri', 1.1, rots([[0, 0], [0, 1], [0, 2], [1, 1]]));      // 삼각대 ㅜ
add('cst', .8, [...rots([[0, 0], [1, 0], [2, 0], [2, 1]]), ...rots([[0, 1], [1, 1], [2, 1], [2, 0]])]);   // C스탠드 ㄴ 4칸
add('cab', .9, [[[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 1], [1, 1], [1, 0], [2, 0]]]);   // 케이블 ㄹ
add('light', .8, rots([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]));   // 조명 스탠드 큰 ㄴ 5칸
export const PIECES = P;
// 장면(종류) 번호: 판 칸에 들어가는 값(1~). 같은 장면 보너스 판정에 씀 — 화면·서버가 같은 번호를 쓰도록 여기서 정함(PIECES 등장 순서)
export const KIND_ORDER = [...new Set(P.map(x => x.k))];
export const kindV = pi => KIND_ORDER.indexOf(P[pi].k) + 1;
export const SAME_MULT = 2;
// 2026-10-31 하율 "원래 블록블라스트처럼 점수 올라가게, 원래 점수도 그 기준에 맞춰 상향": 모든 점수 ×10(놓은 칸 10점 · 1줄 100 · 2줄 300 … · 싹 비움 3,000).
//   전부 똑같이 10배라 예전 기록은 정확히 ×10으로 바뀜(lib/db.js v50) · 예전 화면이 보낸 1배 점수는 서버가 다시 둬 보고 10배로 고쳐 받음(OLD_SCALE)
export const SCALE = 10, OLD_SCALE = 1;   // 2026-10-30 하율(디벨롭 1번): 정리된 줄 중 한 장면으로만 꽉 찬 줄이 있으면 그 판의 정리 점수 ×2 (2줄 이상이면 ×3)

export const newBoard = () => new Array(N * N).fill(0);
export function fits(b, s, r, c) {
  for (const [dr, dc] of s) { const y = r + dr, x = c + dc; if (y < 0 || x < 0 || y >= N || x >= N || b[y * N + x]) return false; }
  return true;
}
export function canPlace(b, s) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(b, s, r, c)) return true; return false; }
// 다음 묶음 3개(조각 번호). n = 지금까지 놓은 장비 수(난이도). ver 1 = 2026-11-02 전 방식(옛 판 다시 두기용), 2 = 상황 맞춤(기본)
export const GEN_VER = 2;
export function nextSet(rand, b, n = 0, ver = GEN_VER) { return ver === 1 ? nextSet1(rand, b, n) : nextSet2(rand, b, n); }
// 2026-11-02 하율 "블럭을 더 잘 깰 수 있게 상황마다 확률 좋게": 판 상황을 보고 칸마다 후보를 1~3개 뽑아 가장 쓸모 있는 것을 줌
//   - 평소(판이 비어 있고 거의 찬 줄 없음): 후보 1개 = 예전과 같은 순수 무작위
//   - 기회(6칸 이상 찬 줄이 있음): 후보 2개 중 줄을 더 많이 지울 수 있는 것
//   - 위기(판 55% 이상 참): 후보 3개 중 놓을 수 있고 줄을 지우는 것, 같으면 작은 것
//   - 묶음 3개는 앞 장비를 가장 좋은 자리에 놓았다고 치고 다음 장비를 고름 → 셋이 서로 이어지게(같은 줄을 두고 겹치지 않게)
//   - 도움은 처음에 가장 크고 놓은 50→300개 사이에 점점 줄어듦(못하는 학생은 더 오래, 잘하는 학생 판 길이는 크게 안 늘게)
//   난이도 램프(큰 장비 비율)는 그대로라 판은 반드시 끝남. 계산은 후보 × 64칸뿐이라 서버 다시 두기도 가벼움
function weights(n) {
  const p = rampOf(n), x2 = Math.max(0, n - RAMP.to) / RAMP.to;
  return P.map(x => x.w * (1 + RAMP.mul[x.d] * (p + (x.d === 2 ? x2 : 0))));
}
function pick(rand, w, T) { let x = rand() * T, i = 0; while (i < P.length - 1 && (x -= w[i]) >= 0) i++; return i; }
// 빠른 계산용 비트판: 줄마다 8비트(칸) · 칸마다 8비트(줄). 장비도 줄 비트·칸 비트로 미리 만들어 둠
const BIT = P.map(({ s }) => { const h = Math.max(...s.map(x => x[0])) + 1, w = Math.max(...s.map(x => x[1])) + 1, sr = new Array(h).fill(0), sc = new Array(w).fill(0); for (const [r, c] of s) { sr[r] |= 1 << c; sc[c] |= 1 << r; } return { h, w, sr, sc }; });
function bits(b) { const R = new Array(N).fill(0), C = new Array(N).fill(0); for (let i = 0; i < N * N; i++) if (b[i]) { R[i / N | 0] |= 1 << i % N; C[i % N] |= 1 << (i / N | 0); } return [R, C]; }
// 이 장비를 놓을 수 있는 자리 중 줄을 가장 많이 지우는 자리 → [지우는 줄 수, 줄, 칸] (못 놓으면 null)
function best(pi, R, C) {
  const { h, w, sr, sc } = BIT[pi]; let top = null;
  for (let r = 0; r + h <= N; r++) for (let c = 0; c + w <= N; c++) {
    let ok = true; for (let i = 0; i < h; i++) if (R[r + i] & sr[i] << c) { ok = false; break; }
    if (!ok) continue;
    let k = 0; for (let i = 0; i < h; i++) if ((R[r + i] | sr[i] << c) === 255) k++; for (let j = 0; j < w; j++) if ((C[c + j] | sc[j] << r) === 255) k++;
    if (!top || k > top[0]) top = [k, r, c];
  }
  return top;
}
function nextSet2(rand, b0, n) {
  const w = weights(n), T = w.reduce((a, x) => a + x, 0), fade = rampOf(n) * .8;   // 도움은 놓은 50개부터 300개까지 점점 줄어 20%만 남음 → 잘하는 학생 판이 쉬는 시간보다 길어지지 않게
  let set;
  for (let t = 0; t < 30; t++) {
    const b = b0.slice(); set = [];
    for (let slot = 0; slot < 3; slot++) {
      const [R, C] = bits(b); let full = 0, near = false;
      for (let i = 0; i < N; i++) { const a = popc(R[i]), c = popc(C[i]); full += a; if ((a >= N - 2 && a < N) || (c >= N - 2 && c < N)) near = true; }
      const fill = full / (N * N), k = rand() < fade ? 1 : fill >= .55 ? 3 : near ? 2 : 1;
      let pi = -1, top = null, sc = -Infinity;
      for (let j = 0; j < k; j++) {
        const q = pick(rand, w, T), bt = best(q, R, C);
        const v = bt ? bt[0] * 10 + (fill >= .55 ? 6 - P[q].s.length : 0) : -100;
        if (v > sc) { sc = v; pi = q; top = bt; }
      }
      set.push(pi);
      if (top && slot < 2) place(b, { score: 0, combo: 0, miss: 0 }, P[pi].s, top[1], top[2]);
    }
    if (set.some(i => canPlace(b0, P[i].s))) break;
  }
  return set;
}
const popc = x => { let k = 0; while (x) { x &= x - 1; k++; } return k; };
function nextSet1(rand, b, n = 0) {
  // 2026-10-30(하율 '끝이 정해진 기록만' 원칙): 300개 뒤에도 큰 장비 비율이 계속 늘어남(300개마다 +100%) → 판이 반드시 끝남. 300개 전 판은 전과 똑같음
  const p = rampOf(n), x2 = Math.max(0, n - RAMP.to) / RAMP.to, w = P.map(x => x.w * (1 + RAMP.mul[x.d] * (p + (x.d === 2 ? x2 : 0)))), T = w.reduce((a, x) => a + x, 0);
  let set;
  for (let t = 0; t < 30; t++) {
    set = [0, 1, 2].map(() => { let x = rand() * T, i = 0; while (i < P.length - 1 && (x -= w[i]) >= 0) i++; return i; });
    if (set.some(i => canPlace(b, P[i].s))) break;
  }
  return set;
}
// 놓기 → { cells, rows, cols, pts } (b를 바꿈). v = 칸에 넣을 값(그림 번호, 0이 아니면 됨)
export function place(b, st, s, r, c, v = 1) {
  for (const [dr, dc] of s) b[(r + dr) * N + c + dc] = v;
  const rows = [], cols = [];
  for (let y = 0; y < N; y++) { let f = true; for (let x = 0; x < N; x++) if (!b[y * N + x]) { f = false; break; } if (f) rows.push(y); }
  for (let x = 0; x < N; x++) { let f = true; for (let y = 0; y < N; y++) if (!b[y * N + x]) { f = false; break; } if (f) cols.push(x); }
  const cells = new Set();
  rows.forEach(y => { for (let x = 0; x < N; x++) cells.add(y * N + x); });
  cols.forEach(x => { for (let y = 0; y < N; y++) cells.add(y * N + x); });
  // 같은 장면 줄: 지우기 전 값으로 판정(줄 8칸이 모두 같은 장면 번호)
  const same = [...rows.map(y => b.slice(y * N, y * N + N)), ...cols.map(x => Array.from({ length: N }, (_, y) => b[y * N + x]))].filter(l => l.every(v2 => v2 === l[0])).length;
  cells.forEach(i => { b[i] = 0; });
  const n = rows.length + cols.length;
  let pts = s.length * SCALE;   // 놓은 칸마다 10점
  if (n) {
    st.combo++; st.miss = 0;
    pts += 10 * SCALE * n * (n + 1) / 2 * Math.min(st.combo, 10) * (same ? SAME_MULT + Math.min(same, 2) - 1 : 1);   // 1줄 100 · 2줄 300 · 3줄 600 … × 연속 정리(최대 ×10) × 같은 장면(×2, 2줄↑ ×3)
    if (b.every(v => !v)) pts += 300 * SCALE;   // 선반 싹 비움
  } else if (++st.miss >= 3) { st.combo = 0; st.miss = 0; }   // 3번 연속 정리 못 하면 연속 끊김
  st.score += pts;
  return { cells: [...cells], rows, cols, n, pts, same, clear: n > 0 && b.every(v => !v) };
}
// 놓기 하나 = 정수: 판 시작부터 ms · 묶음 안 자리(0~2) · 줄 · 칸
export const enc = (t, slot, r, c) => Math.round(t) * 1024 + slot * 64 + r * 8 + c;
export const dec = x => { const t = Math.floor(x / 1024), b = x - t * 1024; return { t, slot: b >> 6 & 3, r: b >> 3 & 7, c: b & 7 }; };

// 판 기록 [끝난 ms, ...놓기]를 처음부터 다시 둬 봄 → { score, n: 놓은 수, lines, combo: 가장 높은 연속, wipe: 싹 비운 횟수 } 또는 { err, k, fast }
// 2026-11-02 묶음 방식 2로 바뀜: 바뀌기 전에 시작한 판(옛 화면)은 방식 1로 맞음 → 지금 방식으로 안 맞으면 옛 방식으로 한 번 더
export function replay(seed, rounds) {
  const x = replayV(seed, rounds, GEN_VER);
  if (!x.err || x.fast) return x;
  const y = replayV(seed, rounds, 1);
  return y.err ? x : y;
}
function replayV(seed, rounds, ver) {
  const end = rounds[0], mv = rounds.slice(1);
  if (!(end >= 0 && end < 6 * 3600e3)) return { err: '끝난 시각이 이상해요' };
  if (mv.length > MAX_MOVES) return { err: '놓은 수가 너무 많아요' };
  const rand = rng(seed), b = newBoard(), st = { score: 0, combo: 0, miss: 0 };
  let set = nextSet(rand, b, 0, ver), used = [false, false, false], prev = -Infinity, lines = 0, combo = 0, wipe = 0;
  for (let k = 0; k < mv.length; k++) {
    const m = dec(mv[k]);
    if (m.t < prev || m.t > end + 50) return { err: `${k + 1}번째 놓기의 시각이 맞지 않아요`, k };
    if (m.t - prev < MIN_GAP) return { err: `${k + 1}번째 놓기가 바로 앞과 ${m.t - prev}ms 차이 — 사람이 끌어 놓기엔 너무 빨라요`, k, fast: true };
    prev = m.t;
    if (m.slot > 2 || used[m.slot]) return { err: `${k + 1}번째 놓기의 장비가 없어요`, k };
    const s = P[set[m.slot]].s;
    if (!fits(b, s, m.r, m.c)) return { err: `${k + 1}번째 장비를 놓을 수 없는 자리예요`, k };
    const x = place(b, st, s, m.r, m.c, kindV(set[m.slot])); lines += x.n; used[m.slot] = true; combo = Math.max(combo, st.combo); if (x.clear) wipe++;
    if (used.every(Boolean)) { set = nextSet(rand, b, k + 1, ver); used = [false, false, false]; }
  }
  return { score: st.score, n: mv.length, lines, combo, wipe };
}
