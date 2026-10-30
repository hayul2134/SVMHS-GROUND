// SVMHS GROUND — 필름 10 규칙(화면 js/film.js · 서버 functions/api/s 같이 씀, 2026-10-29)
// 판: 숫자 1~9 필름 컷 120개(가로 15×8 / 세로 화면 8×15 — 2026-10-29 하율 "눈 아프다"로 170→120 — 같은 배열을 줄 바꿈만 다르게). 숫자 합은 항상 10의 배수.
// 판 씨앗 = 시작 티켓(서버가 줌) → 서버가 같은 판을 다시 만들어 보낸 묶음을 처음부터 다시 둬 봄(점수·순서 조작 방지)
// 저장값 = FILM_MAX - 지운 컷 수(다른 게임처럼 작을수록 1등)
// 2026-10-30 시뮬레이션(하율 "미출시 게임 게임성 시뮬레이션"): 120칸은 잘하는 사람도 약 35묶음(80초 안팎)에 '더 묶을 게 없음'으로 끝나
//   2분 제한이 거의 안 걸리고 점수가 판 운(62~92컷)으로 갈림 → 판이 막히거나 다 지우면 바로 '새 판'(같은 씨앗의 다음 판)이 이어짐. 끝은 2분뿐.
//   봇(묶음당 1.5초/2.4초/4초): 잘함 약 158컷 · 보통 약 101컷 · 처음 약 67컷 — 실력 차가 뚜렷하고 같은 실력 안 흔들림 ±6컷
export const FILM_MAX = 9999999, CELLS = 120, TIME_MS = 120000, MIN_GAP = 100, MAX_MOVES = 600;

// 씨앗 → 0~1 난수(mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = ticket => /^[0-9a-f]{8}/.test(ticket || '') ? parseInt(ticket.slice(0, 8), 16) : 0;
export function makeGrid0(seed) {
  const r = rng(seed); let g, s;
  do { g = []; s = 0; for (let i = 0; i < CELLS; i++) { const v = 1 + Math.floor(r() * 9); g.push(v); s += v; } } while (s % 10);
  return g;
}
// k번째 판(0부터). 처음부터 묶을 게 없는 판은 건너뜀 → { g, k: 실제로 쓴 판 번호 }
export const boardSeed = (seed, k) => (seed + Math.imul(k, 0x9e3779b1)) >>> 0;
export function gridAt(seed, k, cols) { for (let t = 0; t < 50; t++, k++) { const g = makeGrid0(boardSeed(seed, k)); if (hasMove(g, cols)) return { g, k }; } return { g: makeGrid0(boardSeed(seed, k)), k }; }
export const makeGrid = seed => makeGrid0(seed);
// 묶음 하나 = 정수 하나: 판 시작부터 ms · 위 줄 · 왼쪽 칸 · 아래 줄 · 오른쪽 칸(각 5비트)
export const enc = (t, r0, c0, r1, c1) => Math.round(t) * 1048576 + r0 * 32768 + c0 * 1024 + r1 * 32 + c1;
export const dec = x => { const t = Math.floor(x / 1048576), b = x - t * 1048576; return { t, r0: b >> 15 & 31, c0: b >> 10 & 31, r1: b >> 5 & 31, c1: b & 31 }; };

// 네모 안의 남은 컷 [칸 번호]
export function cellsIn(grid, cols, r0, c0, r1, c1) {
  const out = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const i = r * cols + c; if (grid[i]) out.push(i); }
  return out;
}
// 아직 묶을 수 있는 네모가 있는지(합 10) — 누적합으로 모든 네모를 봄(120칸이라 4천 개 남짓)
export function hasMove(grid, cols) {
  const rows = CELLS / cols, P = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) P[r + 1][c + 1] = grid[r * cols + c] + P[r][c + 1] + P[r + 1][c] - P[r][c];
  for (let r0 = 0; r0 < rows; r0++) for (let r1 = r0; r1 < rows; r1++) for (let c0 = 0; c0 < cols; c0++) for (let c1 = c0; c1 < cols; c1++) {
    const s = P[r1 + 1][c1 + 1] - P[r0][c1 + 1] - P[r1 + 1][c0] + P[r0][c0];
    if (s === 10) return true; if (s > 10) break;
  }
  return false;
}
// 판 기록 rounds = [가로 칸 수, 끝난 시각 ms, ...묶음] 을 처음부터 다시 둬 봄 → { n: 지운 수, boards: 판 수 } 또는 { err: 이유 }
export function replay(seed, rounds) {
  const cols = rounds[0], end = rounds[1], mv = rounds.slice(2);
  if (cols !== 8 && cols !== 15) return { err: '판 모양이 이상해요' };
  if (!(end >= 0 && end <= TIME_MS + 500)) return { err: `끝난 시각(${end}ms)이 2분을 넘었어요` };
  if (mv.length > MAX_MOVES) return { err: '묶음 수가 너무 많아요' };
  const rows = CELLS / cols;
  let { g, k: bk } = gridAt(seed, 0, cols), n = 0, prev = -Infinity, boards = 1;
  for (let k = 0; k < mv.length; k++) {
    const m = dec(mv[k]);
    if (m.t < prev || m.t > end + 50) return { err: `${k + 1}번째 묶음의 시각이 맞지 않아요`, k };
    if (m.t - prev < MIN_GAP) return { err: `${k + 1}번째 묶음이 바로 앞 묶음과 ${m.t - prev}ms 차이 — 사람이 드래그하기엔 너무 빨라요`, k, fast: true };
    prev = m.t;
    if (m.r0 > m.r1 || m.c0 > m.c1 || m.r1 >= rows || m.c1 >= cols) return { err: `${k + 1}번째 묶음이 판 밖이에요`, k };
    const cs = cellsIn(g, cols, m.r0, m.c0, m.r1, m.c1);
    if (cs.reduce((a, i) => a + g[i], 0) !== 10) return { err: `${k + 1}번째 묶음의 합이 10이 아니에요`, k };
    cs.forEach(i => { g[i] = 0; }); n += cs.length;
    if (!hasMove(g, cols)) { ({ g, k: bk } = gridAt(seed, bk + 1, cols)); boards++; }   // 막혔거나 다 지움 → 다음 판(화면 film.js와 같은 순간)
  }
  // 2026-10-30: 막히면 새 판이라 판 수 제한이 없어짐 → 사람 손으로는 못 낼 속도(30묶음 넘게, 묶음 간격 중앙값 0.3초 밑)는 매크로로 보류
  if (mv.length >= 30) { const gs = []; for (let k = 1; k < mv.length; k++) gs.push(dec(mv[k]).t - dec(mv[k - 1]).t); gs.sort((a, b) => a - b); const md = gs[gs.length >> 1]; if (md < 300) return { err: `묶음 ${mv.length}개의 간격이 대부분 ${md}ms — 사람이 드래그하기엔 너무 빨라요`, k: 0, fast: true }; }
  return { n, boards };
}
