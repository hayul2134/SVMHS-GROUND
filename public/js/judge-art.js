// 복도의 심판 — 도트 그림(2026-11-02 하율 "도트로, 캐릭터는 제대로 표현").
// 그림 파일 없이 코드로 원본 해상도(화면의 1/2) 캔버스에 한 칸씩 찍고, 화면엔 2배로(번짐 없이) 그림.
// 원작 그림은 쓰지 않음 — 선도부장(체육복·완장·안경)·확성기·자·별은 전부 새로 그림.
// buildArt() → { head:{default,lookleft,wink,closed,noeyes,blue0,blue1,tired1,tired2,sleep,hurt}, torso:{default,shrug,base},
//   legs, arm(dir,frame), sweat[1..3], gb[0..5], star:{red,blue,split}, shard[0..3] }

const C = {
  ol: '#120e1c', hair: '#1c1b2b', hair2: '#33324d', hair3: '#4b4a6e',
  skin: '#ffdcbc', skin2: '#f0bf98', skin3: '#d99a74', lens: '#f6e6da', glare: '#ffffff', frame: '#16151f',
  eye: '#1d1a2b', mouth: '#6b2f35', tooth: '#ffffff', brow: '#1c1b2b',
  jk: '#2c3f86', jk2: '#22316a', jk3: '#3e57b0', stripe: '#f2f4ff', zip: '#c9cfe6',
  band: '#e3354c', band2: '#a8213a', badge: '#ffd84a',
  pant: '#26305e', pant2: '#1b2347', shoe: '#f4f4f4', shoe2: '#b9bdd0', sole: '#5a5f78',
  sweat: '#8fdcff', blue: '#2fd5ff', blue2: '#bff3ff',
  mg: '#f2f2f2', mg2: '#c7cad6', mg3: '#8e93a8', mgd: '#2a2d3d', red: '#e3354c', grip: '#3a3f55',
};

function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function painter(w, h) {
  const c = cvs(w, h), x = c.getContext('2d'), g = new Array(w * h).fill(null);
  const P = {
    c, w, h, g,
    p(px, py, col) { px |= 0; py |= 0; if (px >= 0 && py >= 0 && px < w && py < h) g[py * w + px] = col; },
    r(px, py, rw, rh, col) { for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) P.p(px + xx, py + yy, col); },
    get(px, py) { return px >= 0 && py >= 0 && px < w && py < h ? g[py * w + px] : null; },
    ell(cx, cy, rx, ry, col, y0 = -1e9, y1 = 1e9) {
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
        if (yy < y0 || yy > y1) continue;
        const d = 1 - ((yy + .5 - cy) / ry) ** 2; if (d < 0) continue;
        const half = rx * Math.sqrt(d);
        for (let xx = Math.round(cx - half); xx < Math.round(cx + half); xx++) P.p(xx, yy, col);
      }
    },
    line(x0, y0, x1, y1, col, t = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
      for (let i = 0; i <= n; i++) { const xx = x0 + (x1 - x0) * i / n, yy = y0 + (y1 - y0) * i / n; P.r(Math.round(xx - (t - 1) / 2), Math.round(yy - (t - 1) / 2), t, t, col); }
    },
    poly(pts, col) {   // 볼록·오목 다각형 채우기(짝홀 규칙)
      let mny = Infinity, mxy = -Infinity; pts.forEach(q => { mny = Math.min(mny, q[1]); mxy = Math.max(mxy, q[1]); });
      for (let yy = Math.floor(mny); yy <= Math.ceil(mxy); yy++) {
        const sy = yy + .5, xs = [];
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= sy) !== (b[1] <= sy)) xs.push(a[0] + (sy - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
        xs.sort((m, n) => m - n);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let xx = Math.round(xs[k]); xx < Math.round(xs[k + 1]); xx++) P.p(xx, yy, col);
      }
    },
    outline(col = C.ol, keep = null) {   // 빈칸과 맞닿은 칸에 테두리
      const add = [];
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        if (g[yy * w + xx]) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = P.get(xx + dx, yy + dy); return v && v !== col && (!keep || !keep.includes(v)); })) add.push([xx, yy]);
      }
      add.forEach(([xx, yy]) => { g[yy * w + xx] = col; });
    },
    done() { for (let i = 0; i < g.length; i++) if (g[i]) { x.fillStyle = g[i]; x.fillRect(i % w, (i / w) | 0, 1, 1); } return c; },
  };
  return P;
}

/* ── 머리 32×30 (밑변 가운데 기준) ── */
function head(kind) {
  const P = painter(32, 30);
  // 귀
  P.r(6, 16, 2, 5, C.skin2); P.p(6, 17, C.skin3); P.r(24, 16, 2, 5, C.skin2); P.p(25, 17, C.skin3);
  // 얼굴
  P.ell(16, 17.5, 9.2, 11, C.skin, 8, 28);
  P.r(8, 25, 16, 1, C.skin); P.r(10, 27, 12, 1, C.skin2); P.r(12, 28, 8, 1, C.skin2);
  P.r(9, 26, 14, 1, C.skin); P.p(9, 25, C.skin2); P.p(22, 25, C.skin2);
  // 머리카락(오른쪽 가르마, 옆머리)
  P.ell(16, 11, 12.2, 10.2, C.hair, 0, 13);
  P.r(5, 11, 3, 7, C.hair); P.r(24, 11, 3, 6, C.hair); P.p(7, 18, C.hair); P.p(24, 17, C.hair);
  const fr = [[7, 13], [8, 14], [9, 13], [10, 12], [11, 13], [12, 14], [13, 13], [14, 12], [15, 12], [16, 11], [17, 11], [18, 12], [19, 12], [20, 11], [21, 12], [22, 13], [23, 13], [24, 14]];
  fr.forEach(([xx, yy]) => { for (let k = 10; k <= yy; k++) P.p(xx, k, C.hair); });
  [[9, 4], [10, 3], [11, 3], [12, 2], [13, 2], [14, 2], [15, 3], [16, 3]].forEach(([xx, yy]) => P.p(xx, yy, C.hair3));
  [[8, 5], [9, 5], [8, 6], [17, 4], [18, 4], [19, 5], [11, 7], [12, 8], [20, 7], [21, 8], [22, 9]].forEach(([xx, yy]) => P.p(xx, yy, C.hair2));
  P.line(17, 2, 19, 8, C.hair2);   // 가르마 결
  // 볼 그늘
  P.r(9, 22, 1, 3, C.skin2); P.r(22, 22, 1, 3, C.skin2); P.p(16, 22, C.skin2); P.p(15, 22, C.skin3);
  // 눈썹
  const browL = kind === 'tired1' || kind === 'tired2' ? [[10, 14], [11, 14], [12, 13], [13, 13]] : kind === 'hurt' ? [[10, 13], [11, 13], [12, 14], [13, 14]] : [[10, 14], [11, 13], [12, 13], [13, 13]];
  const browR = kind === 'tired1' || kind === 'tired2' ? [[18, 13], [19, 13], [20, 14], [21, 14]] : kind === 'hurt' ? [[18, 14], [19, 14], [20, 13], [21, 13]] : [[18, 13], [19, 13], [20, 13], [21, 14]];
  browL.forEach(([xx, yy]) => P.p(xx, yy, C.brow)); browR.forEach(([xx, yy]) => P.p(xx, yy, C.brow));
  // 안경테·렌즈
  const L = [9, 15, 6, 5], R = [17, 15, 6, 5];
  for (const [lx, ly, lw, lh] of [L, R]) {
    P.r(lx, ly, lw, lh, C.frame); P.r(lx + 1, ly + 1, lw - 2, lh - 2, C.lens);
  }
  P.r(15, 16, 2, 1, C.frame); P.r(7, 16, 2, 1, C.frame); P.r(23, 16, 2, 1, C.frame);
  const lensIn = ([lx, ly]) => [lx + 1, ly + 1];   // 렌즈 안 4×3
  const eye = (side, mode) => {
    const [ex, ey] = lensIn(side === 'L' ? L : R);
    if (mode === 'open') { P.r(ex, ey, 4, 1, C.eye); P.r(ex + 1, ey + 1, 2, 2, C.eye); }
    else if (mode === 'lazy') { P.r(ex, ey + 1, 4, 1, C.eye); P.r(ex + 1, ey + 2, 2, 1, C.eye); }
    else if (mode === 'left') { P.r(ex, ey, 4, 1, C.eye); P.r(ex, ey + 1, 2, 2, C.eye); }
    else if (mode === 'closed') { P.p(ex, ey + 1, C.eye); P.r(ex + 1, ey + 2, 2, 1, C.eye); P.p(ex + 3, ey + 1, C.eye); }
    else if (mode === 'half') { P.r(ex, ey + 1, 4, 1, C.eye); P.r(ex + 1, ey + 2, 2, 1, C.eye); P.r(ex, ey, 4, 1, C.skin2); }
    else if (mode === 'droop') { P.r(ex, ey, 4, 2, C.skin2); P.r(ex, ey + 2, 4, 1, C.eye); }
    else if (mode === 'line') { P.r(ex, ey + 2, 4, 1, C.eye); }
    else if (mode === 'wide') { P.r(ex + 1, ey, 2, 3, C.eye); P.p(ex + 1, ey, C.lens); }
    else if (mode === 'none') { P.r(ex - 1, ey - 1, 6, 5, '#000000'); }
    else if (mode === 'glow0' || mode === 'glow1') { P.r(ex - 1, ey - 1, 6, 5, '#000000'); P.r(ex, ey, 4, 3, mode === 'glow0' ? C.blue : C.blue2); P.r(ex + 1, ey + 1, 2, 1, '#ffffff'); }
    if (mode !== 'none' && !mode.startsWith('glow')) P.p(ex + 3, ey, C.glare);
  };
  const E = {
    default: ['lazy', 'lazy'], lookleft: ['left', 'left'], wink: ['lazy', 'closed'], closed: ['closed', 'closed'], noeyes: ['none', 'none'],
    blue0: ['none', 'glow0'], blue1: ['none', 'glow1'], tired1: ['half', 'half'], tired2: ['droop', 'droop'], sleep: ['line', 'line'], hurt: ['wide', 'wide'],
  }[kind] || ['lazy', 'lazy'];
  eye('L', E[0]); eye('R', E[1]);
  // 입
  if (kind === 'tired2') { P.r(14, 24, 4, 2, C.mouth); P.r(15, 24, 2, 1, C.eye); }
  else if (kind === 'sleep') { P.r(15, 24, 2, 1, C.mouth); }
  else if (kind === 'hurt') { [[12, 25], [13, 24], [14, 25], [15, 24], [16, 25], [17, 24], [18, 25], [19, 24]].forEach(([xx, yy]) => P.p(xx, yy, C.mouth)); }
  else if (kind === 'tired1') { P.r(12, 24, 8, 1, C.mouth); P.p(19, 23, C.mouth); }
  else {   // 능글맞은 웃음(오른쪽 입꼬리 올라감)
    P.r(11, 24, 9, 1, C.mouth); P.p(20, 23, C.mouth); P.p(21, 22, C.mouth); P.p(10, 23, C.mouth);
    P.r(13, 25, 6, 1, C.mouth); P.r(14, 25, 4, 1, C.tooth);
  }
  P.outline();
  if (kind === 'blue0' || kind === 'blue1') { P.p(23, 14, kind === 'blue0' ? C.blue : C.blue2); P.p(24, 15, C.blue); }
  return P.done();
}

/* ── 몸통 54×25 (밑변 가운데) — base는 오른팔(화면 오른쪽) 없이 ── */
function torso(kind) {
  const W = kind === 'shrug' ? 72 : 54, P = painter(W, 25), ox = (W - 54) / 2;
  // 몸판
  P.poly([[ox + 13, 1], [ox + 41, 1], [ox + 44, 6], [ox + 42, 25], [ox + 12, 25], [ox + 10, 6]], C.jk);
  P.r(ox + 12, 21, 31, 4, C.jk2);                       // 밑단
  P.r(ox + 26, 2, 2, 22, C.zip); P.p(ox + 26, 12, C.mg3);   // 지퍼
  P.poly([[ox + 20, 0], [ox + 34, 0], [ox + 31, 5], [ox + 27, 3], [ox + 23, 5]], C.jk3);   // 깃
  P.r(ox + 24, 1, 6, 2, C.skin2);                       // 목
  P.r(ox + 15, 14, 7, 1, C.jk2); P.r(ox + 32, 14, 7, 1, C.jk2);   // 주머니 선
  const armL = () => {   // 화면 왼쪽 팔(완장) — 주머니에 손
    P.poly([[ox + 4, 5], [ox + 13, 2], [ox + 15, 8], [ox + 14, 20], [ox + 7, 21], [ox + 4, 12]], C.jk);
    P.line(ox + 6, 6, ox + 8, 20, C.stripe, 1); P.line(ox + 7, 6, ox + 9, 20, C.stripe, 1);
    P.r(ox + 4, 8, 10, 4, C.band); P.r(ox + 4, 11, 10, 1, C.band2); P.r(ox + 8, 9, 2, 2, C.badge);
  };
  const armR = () => {
    P.poly([[ox + 41, 2], [ox + 50, 5], [ox + 50, 12], [ox + 47, 21], [ox + 40, 20], [ox + 39, 8]], C.jk);
    P.line(ox + 48, 6, ox + 46, 20, C.stripe, 1); P.line(ox + 47, 6, ox + 45, 20, C.stripe, 1);
  };
  if (kind === 'shrug') {   // 양팔 벌리고 손바닥 위로
    P.poly([[ox + 13, 2], [ox + 4, 5], [ox - 6, 12], [ox - 8, 16], [ox - 4, 18], [ox + 6, 13], [ox + 13, 10]], C.jk);
    P.poly([[ox + 41, 2], [ox + 50, 5], [ox + 60, 12], [ox + 62, 16], [ox + 58, 18], [ox + 48, 13], [ox + 41, 10]], C.jk);
    P.line(ox + 11, 4, ox - 5, 15, C.stripe); P.line(ox + 43, 4, ox + 59, 15, C.stripe);
    P.r(ox + 2, 6, 8, 3, C.band); P.r(ox + 5, 6, 2, 2, C.badge);
    P.ell(ox - 9, 13, 3.5, 2.5, C.skin); P.ell(ox + 63, 13, 3.5, 2.5, C.skin);
  } else { armL(); if (kind !== 'base') armR(); }
  P.outline();
  return P.done();
}

/* ── 다리 44×23 ── */
function legs() {
  const P = painter(44, 23);
  P.poly([[9, 0], [21, 0], [20, 17], [11, 17]], C.pant); P.poly([[23, 0], [35, 0], [33, 17], [24, 17]], C.pant);
  P.r(12, 0, 20, 2, C.pant2);
  P.line(10, 1, 11, 16, C.stripe); P.line(34, 1, 33, 16, C.stripe);
  P.r(20, 2, 3, 6, C.pant2);
  // 운동화
  P.poly([[7, 17], [20, 17], [21, 21], [5, 21], [5, 19]], C.shoe); P.poly([[24, 17], [37, 17], [39, 19], [39, 21], [23, 21]], C.shoe);
  P.r(5, 21, 16, 1, C.sole); P.r(23, 21, 17, 1, C.sole); P.r(9, 18, 4, 1, C.shoe2); P.r(31, 18, 4, 1, C.shoe2);
  P.outline();
  return P.done();
}

/* ── 팔 동작(오른팔) 64×64, 어깨 = (32,32) ── dir: up/down/left/right, f 0~4 */
function arm(dir, f) {
  const P = painter(64, 64), sx = 32, sy = 32;
  const T = { right: 0, down: 90, left: 180, up: -90 }[dir];
  const S = dir === 'down' ? -100 : 80;          // 시작 각도(down은 위에서 내리침)
  const a = (S + (T - S) * Math.min(1, f / 3)) * Math.PI / 180, L1 = 11, L2 = 11;
  const ex = sx + Math.cos(a) * L1, ey = sy + Math.sin(a) * L1, hx = ex + Math.cos(a) * L2, hy = ey + Math.sin(a) * L2;
  P.line(sx, sy, ex, ey, C.jk, 7); P.line(ex, ey, hx, hy, C.jk, 6);
  const nx = -Math.sin(a), ny = Math.cos(a);
  P.line(sx + nx * 2, sy + ny * 2, hx + nx * 2, hy + ny * 2, C.stripe, 1);
  P.line(hx - Math.cos(a) * 2, hy - Math.sin(a) * 2, hx - Math.cos(a) * 1, hy - Math.sin(a) * 1, C.jk2, 6);   // 소매 끝
  P.ell(hx + Math.cos(a) * 3, hy + Math.sin(a) * 3, 3.6, 3.6, C.skin);   // 손(펼침)
  P.line(hx + Math.cos(a) * 3 + nx * 3, hy + Math.sin(a) * 3 + ny * 3, hx + Math.cos(a) * 6 + nx * 3, hy + Math.sin(a) * 6 + ny * 3, C.skin, 2);   // 엄지
  P.outline();
  return P.done();
}

/* ── 땀 32×9 (머리 오른쪽 위) ── */
function sweat(n) {
  const P = painter(32, 12);
  const drop = (xx, yy) => { P.p(xx, yy, C.sweat); P.r(xx - 1, yy + 1, 3, 2, C.sweat); P.p(xx, yy + 3, C.sweat); P.p(xx, yy + 1, '#ffffff'); };
  if (n >= 1) drop(25, 2); if (n >= 2) drop(5, 4); if (n >= 3) drop(28, 7);
  return P.done();
}

/* ── 확성기 57×44 (오른쪽을 봄, 가운데 기준) f 0 = 기본, 1~4 = 쏘기 직전 입 열림·빛 ── */
function blaster(f) {
  const P = painter(57, 44), k = f / 4;
  const mx = 49 + Math.round(k * 2);   // 입 위치(쏠 때 앞으로 튀어나옴)
  // 뒤 몸통(배터리 칸) + 손잡이
  P.r(3, 15, 15, 14, C.mg2); P.r(4, 16, 13, 4, C.mg); P.r(3, 26, 15, 3, C.mg3);
  P.r(6, 19, 2, 6, C.mgd); P.r(10, 19, 2, 6, C.mgd);   // 통풍구
  P.poly([[8, 29], [14, 29], [13, 41], [8, 41]], C.grip); P.r(9, 33, 3, 1, C.mg3); P.r(9, 36, 3, 1, C.mg3);
  P.poly([[14, 29], [17, 29], [16, 33], [14, 33]], C.red);   // 방아쇠
  // 목(빨간 띠)
  P.r(17, 14, 6, 16, C.red); P.r(17, 14, 6, 2, '#ff6b7c'); P.r(17, 28, 6, 2, '#a8213a');
  // 나팔
  P.poly([[22, 13], [mx, 1], [mx, 43], [22, 31]], C.mg);
  P.poly([[22, 25], [mx, 34], [mx, 43], [22, 31]], C.mg2);
  P.line(28, 12, mx - 2, 4, '#ffffff', 1);
  P.line(36, 13, 36, 31, C.mg2, 1);
  // 입(테두리 + 안)
  P.r(mx, 0, 4, 44, C.mg3); P.r(mx + 1, 1, 2, 42, C.mg2);
  const inner = f === 0 ? C.mgd : f === 1 ? '#3d6e8c' : f === 2 ? '#6fc6ee' : f === 3 ? '#cdf3ff' : '#ffffff';
  P.r(mx + 1, 4, 2, 36, inner);
  P.outline();
  return P.done();
}

/* ── 별(플레이어) 16×16 ── */
function star(col, split) {
  const P = painter(16, split ? 20 : 16);
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3.3 : 7.6; pts.push([8 + Math.cos(a) * rr, 8.4 + Math.sin(a) * rr]); }
  P.poly(pts, col);
  P.p(6, 5, '#ffffff'); P.p(7, 4, '#ffffff');
  if (split) {   // 가운데 금(번개 모양)으로 갈라짐
    const g2 = P.g.slice(); P.g.fill(null);
    for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) { const v = g2[yy * 16 + xx]; if (!v) continue; const cut = 8 + (yy % 4 < 2 ? -1 : 1); P.p(xx < cut ? xx - 1 : xx + 1, yy, v); }
  }
  return P.done();
}
function shard(f, col) {
  const P = painter(16, 16), sh = [[[7, 5], [10, 7], [8, 10]], [[6, 6], [10, 6], [8, 9]], [[7, 6], [9, 6], [9, 9], [7, 9]], [[6, 8], [10, 7], [8, 10]]][f];
  P.poly(sh.map(([a, b]) => [a, b]), col); return P.done();
}

export function buildArt() {
  const H = {}; ['default', 'lookleft', 'wink', 'closed', 'noeyes', 'blue0', 'blue1', 'tired1', 'tired2', 'sleep', 'hurt'].forEach(k => { H[k] = head(k); });
  const A = {}; for (const d of ['up', 'down', 'left', 'right']) A[d] = [0, 1, 2, 3, 4].map(f => arm(d, f));
  return {
    head: H, torso: { default: torso('default'), shrug: torso('shrug'), base: torso('base') }, legs: legs(), arm: A,
    sweat: [null, sweat(1), sweat(2), sweat(3)], gb: [0, 1, 2, 3, 4].map(blaster),
    star: { red: star('#ff2a2a'), blue: star('#1f56ff'), split: star('#ff2a2a', true) }, shard: [0, 1, 2, 3].map(f => shard(f, '#ff2a2a')),
  };
}
