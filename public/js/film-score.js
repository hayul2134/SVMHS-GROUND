// SVMHS GROUND — 필름 10 규칙(화면 js/film.js · 서버 functions/api/s 같이 씀, 2026-10-29)
// 판: 숫자 1~9 필름 컷 120개(가로 15×8 / 세로 화면 8×15 — 2026-10-29 하율 "눈 아프다"로 170→120 — 같은 배열을 줄 바꿈만 다르게). 숫자 합은 항상 10의 배수.
// 판 씨앗 = 시작 티켓(서버가 줌) → 서버가 같은 판을 다시 만들어 보낸 묶음을 처음부터 다시 둬 봄(점수·순서 조작 방지)
// 저장값 = FILM_MAX - 지운 컷 수(다른 게임처럼 작을수록 1등)
export const FILM_MAX = 9999999, CELLS = 120, TIME_MS = 120000, MIN_GAP = 100;

// 씨앗 → 0~1 난수(mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = ticket => /^[0-9a-f]{8}/.test(ticket || '') ? parseInt(ticket.slice(0, 8), 16) : 0;
export function makeGrid(seed) {
  const r = rng(seed); let g, s;
  do { g = []; s = 0; for (let i = 0; i < CELLS; i++) { const v = 1 + Math.floor(r() * 9); g.push(v); s += v; } } while (s % 10);
  return g;
}
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
// 판 기록 rounds = [가로 칸 수, 끝난 시각 ms, ...묶음] 을 처음부터 다시 둬 봄 → { n: 지운 수 } 또는 { err: 이유 }
export function replay(seed, rounds) {
  const cols = rounds[0], end = rounds[1], mv = rounds.slice(2);
  if (cols !== 8 && cols !== 15) return { err: '판 모양이 이상해요' };
  if (!(end >= 0 && end <= TIME_MS + 500)) return { err: `끝난 시각(${end}ms)이 2분을 넘었어요` };
  if (mv.length > CELLS / 2) return { err: '묶음 수가 너무 많아요' };
  const rows = CELLS / cols, g = makeGrid(seed);
  let n = 0, prev = -Infinity;
  for (let k = 0; k < mv.length; k++) {
    const m = dec(mv[k]);
    if (m.t < prev || m.t > end + 50) return { err: `${k + 1}번째 묶음의 시각이 맞지 않아요`, k };
    if (m.t - prev < MIN_GAP) return { err: `${k + 1}번째 묶음이 바로 앞 묶음과 ${m.t - prev}ms 차이 — 사람이 드래그하기엔 너무 빨라요`, k, fast: true };
    prev = m.t;
    if (m.r0 > m.r1 || m.c0 > m.c1 || m.r1 >= rows || m.c1 >= cols) return { err: `${k + 1}번째 묶음이 판 밖이에요`, k };
    const cs = cellsIn(g, cols, m.r0, m.c0, m.r1, m.c1);
    if (cs.reduce((a, i) => a + g[i], 0) !== 10) return { err: `${k + 1}번째 묶음의 합이 10이 아니에요`, k };
    cs.forEach(i => { g[i] = 0; }); n += cs.length;
  }
  return { n };
}
