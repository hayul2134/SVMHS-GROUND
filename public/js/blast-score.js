// SVMHS GROUND — 기자재 정리! 블록 규칙(블록 블라스트 방식, 2026-10-29 하율 "기자재 정리!를 블록블라스트 버전도") — 화면 js/blast.js · 서버 functions/api/s 같이 씀
// 판 8×8, 장비 케이스 3개씩 받아 아무 데나 놓기(중력 없음) → 가로줄·세로줄이 꽉 차면 정리(지워짐). 놓을 곳이 없으면 끝. 시간 제한 없음.
// 장비 순서 = 시작 티켓 씨앗(서버가 줌) + 지금 판 모양(3개 중 하나도 못 놓는 묶음은 다시 뽑음 — 판 모양에 따라 정해지니 서버도 똑같이 재현)
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
const add = (k, w, shapes) => shapes.forEach(s => P.push({ k, w, s: norm(s) }));
add('bat', 2.5, [[[0, 0]]]);                                  // 배터리 1칸
add('lens', 2.5, [L(2), L(2, 1)]);                            // 렌즈 2칸
add('sd', 2.5, [L(3), L(3, 1)]);                              // SD 카드 3칸
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
const TOTAL = P.reduce((a, p) => a + p.w, 0);

export const newBoard = () => new Array(N * N).fill(0);
export function fits(b, s, r, c) {
  for (const [dr, dc] of s) { const y = r + dr, x = c + dc; if (y < 0 || x < 0 || y >= N || x >= N || b[y * N + x]) return false; }
  return true;
}
export function canPlace(b, s) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(b, s, r, c)) return true; return false; }
// 다음 묶음 3개(조각 번호). 셋 다 못 놓는 묶음은 최대 30번 다시 뽑음
export function nextSet(rand, b) {
  let set;
  for (let t = 0; t < 30; t++) {
    set = [0, 1, 2].map(() => { let x = rand() * TOTAL, i = 0; while (i < P.length - 1 && (x -= P[i].w) >= 0) i++; return i; });
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
  cells.forEach(i => { b[i] = 0; });
  const n = rows.length + cols.length;
  let pts = s.length;   // 놓은 칸마다 1점
  if (n) {
    st.combo++; st.miss = 0;
    pts += 10 * n * (n + 1) / 2 * Math.min(st.combo, 10);   // 1줄 10 · 2줄 30 · 3줄 60 … × 연속 정리(최대 ×10)
    if (b.every(v => !v)) pts += 300;   // 선반 싹 비움
  } else if (++st.miss >= 3) { st.combo = 0; st.miss = 0; }   // 3번 연속 정리 못 하면 연속 끊김
  st.score += pts;
  return { cells: [...cells], rows, cols, n, pts, clear: n > 0 && b.every(v => !v) };
}
// 놓기 하나 = 정수: 판 시작부터 ms · 묶음 안 자리(0~2) · 줄 · 칸
export const enc = (t, slot, r, c) => Math.round(t) * 1024 + slot * 64 + r * 8 + c;
export const dec = x => { const t = Math.floor(x / 1024), b = x - t * 1024; return { t, slot: b >> 6 & 3, r: b >> 3 & 7, c: b & 7 }; };

// 판 기록 [끝난 ms, ...놓기]를 처음부터 다시 둬 봄 → { score, n: 놓은 수, lines } 또는 { err, k, fast }
export function replay(seed, rounds) {
  const end = rounds[0], mv = rounds.slice(1);
  if (!(end >= 0 && end < 6 * 3600e3)) return { err: '끝난 시각이 이상해요' };
  if (mv.length > MAX_MOVES) return { err: '놓은 수가 너무 많아요' };
  const rand = rng(seed), b = newBoard(), st = { score: 0, combo: 0, miss: 0 };
  let set = nextSet(rand, b), used = [false, false, false], prev = -Infinity, lines = 0;
  for (let k = 0; k < mv.length; k++) {
    const m = dec(mv[k]);
    if (m.t < prev || m.t > end + 50) return { err: `${k + 1}번째 놓기의 시각이 맞지 않아요`, k };
    if (m.t - prev < MIN_GAP) return { err: `${k + 1}번째 놓기가 바로 앞과 ${m.t - prev}ms 차이 — 사람이 끌어 놓기엔 너무 빨라요`, k, fast: true };
    prev = m.t;
    if (m.slot > 2 || used[m.slot]) return { err: `${k + 1}번째 놓기의 장비가 없어요`, k };
    const s = P[set[m.slot]].s;
    if (!fits(b, s, m.r, m.c)) return { err: `${k + 1}번째 장비를 놓을 수 없는 자리예요`, k };
    lines += place(b, st, s, m.r, m.c).n; used[m.slot] = true;
    if (used.every(Boolean)) { set = nextSet(rand, b); used = [false, false, false]; }
  }
  return { score: st.score, n: mv.length, lines };
}
