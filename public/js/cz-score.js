// SVMHS GROUND — 지뢰찾기·뱀·2048 랭크전 규칙(2026-10-29 하율 "모든 게임을 랭크에, 캐주얼이랑 랭크로 나누지 말고" — 미리보기 깃발 casual-games)
// 화면 js/casual.js(랭크전)와 서버 functions/api/s가 같이 씀 → 판은 시작 티켓 씨앗으로 정해지고, 서버가 입력을 처음부터 다시 둬 보고 기록을 계산
//   지뢰찾기 랭크전: 중급(16×16·지뢰 40) 고정 · 기록 = 첫 칸부터 마지막 칸 연 시각(ms, 작을수록 1등) · rounds = [첫 칸, ...(연 시각×1000 + 칸)]
//   뱀 랭크전: 17×15 · 별 위치가 씨앗으로 정해짐 · 기록 = SNAKE_MAX - 별 수 · rounds = [끝난 틱, ...(틱×4 + 방향)]
//   2048 랭크전: 3분 · 되돌리기 없음 · 새 칸이 씨앗으로 정해짐 · 기록 = N2_MAX - 점수 · rounds = [끝난 ms, ...(시각 ms×4 + 방향)]
export const SNAKE_MAX = 9999, N2_MAX = 99999999, N2_TIME = 180000;
export const MINE = { W: 16, H: 16, M: 40 };
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = ticket => /^[0-9a-f]{8}/.test(ticket || '') ? parseInt(ticket.slice(8, 16) || ticket.slice(0, 8), 16) : 0;

/* ----- 지뢰찾기 ----- */
export const mineNb = (i, W, H) => { const x = i % W, y = (i / W) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (a >= 0 && a < W && b >= 0 && b < H) o.push(b * W + a); } return o; };
// 첫 칸과 그 주변 8칸을 뺀 자리에 지뢰(화면 casual.js lay와 같은 순서로 섞음)
export function mineLay(rand, W, H, M, safe) {
  const ban = new Set([safe, ...(W * H - 9 >= M ? mineNb(safe, W, H) : [])]), pool = [], m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (!ban.has(i)) pool.push(i);
  for (let k = 0; k < M; k++) { const j = k + Math.floor(rand() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; m[pool[k]] = 1; }
  return m;
}
export function mineReplay(seed, r) {
  const { W, H, M } = MINE, first = r[0], ev = r.slice(1);
  if (!Number.isInteger(first) || first < 0 || first >= W * H || !ev.length) return { err: '판 기록 형식이 다름' };
  const m = mineLay(rng(seed), W, H, M, first), o = new Uint8Array(W * H), n = i => mineNb(i, W, H).reduce((s, j) => s + m[j], 0);
  let opened = 0, t = -1, fast = 0, acts = 0;   // acts = 누른 횟수(주변 열기로 같은 시각에 여러 칸 연 건 한 번)
  for (let k = 0; k < ev.length; k++) {
    const e = ev[k], at = Math.floor(e / 1000), i = e % 1000;
    if (!Number.isInteger(e) || e < 0 || i >= W * H) return { err: `${k + 1}번째 칸 기록이 이상함` };
    if (at < t) return { err: '연 시각이 거꾸로 감' };
    if (at !== t) { acts++; if (k && at - t < 60) fast++; }
    t = at;
    if (o[i]) continue;
    if (m[i]) return { err: `${k + 1}번째로 연 칸이 지뢰` };
    const st = [i];
    while (st.length) { const j = st.pop(); if (o[j]) continue; o[j] = 1; opened++; if (!n(j)) mineNb(j, W, H).forEach(q => { if (!o[q] && !m[q]) st.push(q); }); }
  }
  if (ev[0] % 1000 !== first || Math.floor(ev[0] / 1000) !== 0) return { err: '첫 칸 기록이 다름' };
  if (opened !== W * H - M) return { err: `안전한 칸 ${W * H - M - opened}개가 안 열림` };
  if (fast > acts * .6 && acts > 20) return { err: '칸을 너무 빠르게 연속으로 엶', fast: true, k: 0 };
  return { ms: t };
}

/* ----- 뱀 ----- */
export const SNAKE = { W: 17, H: 15 };
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const snakeStep = score => Math.max(78, 135 - 2.5 * score);   // 한 칸 가는 시간(ms) — 별 하나마다 2.5ms 빨라짐
export function snakeFood(rand, body, W, H) {
  const occ = new Set(body.map(([x, y]) => y * W + x)), free = [];
  for (let i = 0; i < W * H; i++) if (!occ.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[(rand() * free.length) | 0]; return [i % W, (i / W) | 0];
}
export function snakeReplay(seed, r) {
  const { W, H } = SNAKE, end = r[0], ev = r.slice(1), rand = rng(seed), y0 = (H / 2) | 0;
  if (!Number.isInteger(end) || end < 1 || end > 20000) return { err: '판 기록 형식이 다름' };
  let body = [[5, y0], [4, y0], [3, y0]], dir = 1, score = 0, food = snakeFood(rand, body, W, H), k = 0, ms = 0;
  for (let tk = 1; tk <= end; tk++) {
    while (k < ev.length && Math.floor(ev[k] / 4) === tk) { const d = ev[k] % 4; if ((d + 2) % 4 === dir) return { err: `${tk}번째 칸에서 반대로 꺾음` }; dir = d; k++; }
    if (k < ev.length && Math.floor(ev[k] / 4) < tk) return { err: '꺾은 기록 순서가 다름' };
    ms += snakeStep(score);
    const [hx, hy] = body[0], nx = hx + DV[dir][0], ny = hy + DV[dir][1], eat = food && nx === food[0] && ny === food[1];
    const hit = nx < 0 || ny < 0 || nx >= W || ny >= H || body.some(([x, y], i) => x === nx && y === ny && (eat || i < body.length - 1));
    if (hit) { if (tk !== end) return { err: `${tk}번째 칸에서 부딪혔는데 기록은 ${end}번째에 끝남` }; return { score, ms }; }
    body.unshift([nx, ny]);
    if (eat) { score++; food = snakeFood(rand, body, W, H); if (!food) return tk === end ? { score, ms } : { err: '판이 가득 찼는데 계속됨' }; } else body.pop();
  }
  return { err: `${end}번째 칸에서 끝났다는데 부딪히지 않음` };
}

/* ----- 2048 ----- */
export function n2Spawn(g, rand) {
  const fr = []; for (let i = 0; i < 16; i++) if (!g[i]) fr.push(i);
  if (!fr.length) return -1; const i = fr[(rand() * fr.length) | 0]; g[i] = rand() < .9 ? 2 : 4; return i;
}
// d: 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽 → 움직였으면 얻은 점수(0 이상), 안 움직였으면 -1
export function n2Move(g, d) {
  let moved = false, gain = 0;
  for (let k = 0; k < 4; k++) {
    const idx = []; for (let j = 0; j < 4; j++) { const [r, c] = d === 0 ? [j, k] : d === 2 ? [3 - j, k] : d === 3 ? [k, j] : [k, 3 - j]; idx.push(r * 4 + c); }
    const v = idx.map(i => g[i]).filter(Boolean), out = [];
    for (let i = 0; i < v.length; i++) { if (i + 1 < v.length && v[i] === v[i + 1]) { out.push(v[i] * 2); gain += v[i] * 2; i++; } else out.push(v[i]); }
    idx.forEach((i, j) => { const x = out[j] || 0; if (g[i] !== x) moved = true; g[i] = x; });
  }
  return moved ? gain : -1;
}
export function n2Replay(seed, r) {
  const end = r[0], ev = r.slice(1), rand = rng(seed), g = new Array(16).fill(0);
  if (!Number.isInteger(end) || end < 0 || end > N2_TIME + 1500) return { err: '판 기록 형식이 다름' };
  n2Spawn(g, rand); n2Spawn(g, rand);
  let score = 0, t = 0, fast = 0;
  for (let k = 0; k < ev.length; k++) {
    const at = Math.floor(ev[k] / 4), d = ev[k] % 4;
    if (!Number.isInteger(ev[k]) || ev[k] < 0) return { err: `${k + 1}번째 밀기 기록이 이상함` };
    if (at < t || at > end) return { err: '민 시각이 거꾸로 감' };
    if (at - t < 40 && k) fast++;
    t = at;
    const gain = n2Move(g, d); if (gain < 0) return { err: `${k + 1}번째 밀기가 판을 움직이지 않음` };
    score += gain; n2Spawn(g, rand);
  }
  if (fast > ev.length * .5 && ev.length > 30) return { err: '너무 빠르게 연속으로 밂', fast: true, k: 0 };
  return { score, max: Math.max(...g) };
}
