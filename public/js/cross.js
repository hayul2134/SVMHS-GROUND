// SVMHS GROUND — 지각 직전!(2026-11-09 하율 "길건너 친구들 한 번 만들어보자", 미리보기 깃발 cross-game — 개발자만)
// 길건너 친구들 방식: 한 칸씩 폴짝 뛰어 도로(차·버스·트럭)·하천(통나무·징검다리)·철길(열차)·잔디(나무)를 건너 앞으로.
// 화면이 천천히 따라 올라와서 멈춰 있거나 뒤로 가면 '지각!'. 이름·캐릭터·그림은 원작과 무관하게 등굣길 학생으로.
// 시험판 — 서버·랭킹 없이 이 기기 최고 기록만(sg_cross_best). 멈춤은 한 판 30초(pauseBudget, 화면 숨김 포함).
// createCross(el, O) → { start, destroy, state }
import { store, pauseBudget, pauseOutMsg } from './util.js';
import { makeSfx, sndBtnHtml, bindSnd } from './sfx.js';

const T = 48, COLS = 11, W = COLS * T, H = 704;   // 칸 48px · 가로 11칸(0·10번 칸은 벽 밖, 1~9번 칸에서 놂)
const MINC = 1, MAXC = 9, SPAN = 18, XL = -4, XR = 14;   // 차·통나무가 도는 범위(칸)
const HX = 0.2, HY = -0.9, TD = 34;   // TD: 줄 하나의 화면 깊이(가로 48보다 짧게 눌러 앞면이 잘 보이는 낮은 시점)                       // 높이 1px이 화면에서 옮겨 가는 방향(위·오른쪽으로 비스듬히 내려다봄)
const HOP = 0.12, INK = 'rgba(42,40,70,.55)';
const rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1));
const CAR_COLORS = ['#ff6b6b', '#3d7bff', '#ffd25e', '#5fd38a', '#b07cff', '#ff9f43', '#ffffff', '#4ecdc4'];

function shade(hex, k) {   // k>0 밝게, k<0 어둡게
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
  return '#' + ((1 << 24) | f(n >> 16 & 255) << 16 | f(n >> 8 & 255) << 8 | f(n & 255)).toString(16).slice(1);   // 다시 shade에 넣을 수 있게 #hex로
}

export function createCross(el, O = {}) {
  el.innerHTML = `<div class="bl"><div class="bl-wrap"><canvas class="bl-cv"></canvas><div class="bl-ov" hidden></div></div>
    <div class="bl-bar"><span class="bl-help">↑↓←→ / WASD · 화면 누르기 = 앞으로 · 밀기 = 그 방향</span>${sndBtnHtml('cxSnd')}</div></div>`;
  const cv = el.querySelector('.bl-cv'), ctx = cv.getContext('2d'), ov = el.querySelector('.bl-ov');
  const S = makeSfx('sg_cross_snd'); bindSnd(el.querySelector('#cxSnd'), S);
  const pb = pauseBudget();
  let best = +store.get('cross_best', 0) || 0;
  let lanes, genR, seg, segLeft, pathC, prevT, P, cam, score, started, over, paused, dying, queue, alive = true, raf = 0, last = 0, t0 = 0, msg = null, fx = [];
  let scale = 1, dpr = 1;

  function fit() {
    const wrap = el.querySelector('.bl-wrap'); if (!wrap) return;
    const top = wrap.getBoundingClientRect().top, bar = el.querySelector('.bl-bar')?.offsetHeight || 0;
    const avH = Math.max(320, innerHeight - top - bar - 90), avW = Math.max(240, el.clientWidth || 360);
    const ns = Math.min(avW / W, avH / H, 1.6), nd = Math.min(2, window.SG_DPR || devicePixelRatio || 1);
    if (Math.abs(ns - scale) < .001 && nd === dpr && cv.width) return;
    scale = ns; dpr = nd;
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
    cv.style.width = Math.round(W * scale) + 'px'; cv.style.height = Math.round(H * scale) + 'px';
  }

  // ── 길 만들기(줄 r마다 한 번) ──
  // 잔디: 나무로 막되 pathC 칸은 늘 비워 이어지는 길을 보장 · 하천 다음은 꼭 잔디 · 뒤(줄 0 아래)는 나무 벽
  function lane(r) {
    if (lanes.has(r)) return lanes.get(r);
    while (genR <= r) { lanes.set(genR, make(genR)); genR++; }
    return lanes.get(r);
  }
  function grass(r, dens) {
    const tree = new Set([0, 10]), kind = {};
    if (r < 0) for (let c = 0; c < COLS; c++) tree.add(c);
    else for (let c = MINC; c <= MAXC; c++) if (c !== pathC && Math.random() < dens) tree.add(c);
    if (r >= 0) { pathC = Math.max(MINC, Math.min(MAXC, pathC + irnd(-1, 1))); tree.delete(pathC); }
    for (const c of tree) kind[c] = Math.random() < .7 ? 'tree' : 'bush';
    return { type: 'grass', tree, kind, alt: r & 1 };
  }
  function movers(r, kind, d) {
    const dir = Math.random() < .5 ? 1 : -1, objs = [];
    let spd, len, gap;
    if (kind === 'road') {
      const k = Math.random(), v = k < .55 ? 'car' : k < .8 ? 'truck' : 'bus';
      len = v === 'car' ? 1.5 : v === 'truck' ? 2.3 : 3.2; gap = [2.6 - d * .6, 5.5 - d * 1.2];
      spd = rnd(1.3, 2.9) * (1 + .7 * d) * (v === 'bus' ? .8 : 1);
      let x = XL + rnd(0, 2);
      while (x + len + gap[0] <= XR) { objs.push({ x, len, v, col: CAR_COLORS[irnd(0, CAR_COLORS.length - 1)] }); x += len + rnd(gap[0], gap[1]); }
    } else {
      spd = rnd(.9, 1.8) * (1 + .4 * d);
      let x = XL + rnd(0, 1);
      for (;;) { len = irnd(2, 4) - (d > .6 && Math.random() < .4 ? 1 : 0); if (x + len + 1.2 > XR) break; objs.push({ x, len, v: 'log' }); x += len + rnd(1.2, 2.6 + d * .6); }
    }
    return { dir, spd, objs };
  }
  function make(r) {
    const d = Math.min(1, Math.max(0, r) / 260);
    if (r < 5) { const g = grass(r, r < 0 ? 1 : r < 2 ? 0 : .12); prevT = 'grass'; return g; }
    if (segLeft <= 0) {
      let t; const roll = Math.random();
      if (prevT === 'river') t = 'grass';
      else t = roll < .27 - .07 * d ? 'grass' : roll < .66 ? 'road' : roll < .86 ? 'river' : 'rail';
      if (t === prevT && t !== 'road') t = 'grass';
      seg = t; segLeft = t === 'grass' ? irnd(1, 2) : t === 'road' ? irnd(1, 2 + Math.round(d * 2)) : t === 'river' ? irnd(1, 3) : irnd(1, 2);
    }
    segLeft--; const t = seg;
    let L;
    if (t === 'grass') L = grass(r, prevT === 'river' ? .08 : .16 + .12 * d);
    else if (t === 'road') L = { type: 'road', ...movers(r, 'road', d) };
    else if (t === 'river') {
      if (prevT !== 'river' && segLeft === 0 && Math.random() < .35) {   // 한 줄짜리 하천은 가끔 징검다리
        const st = new Set(); while (st.size < irnd(3, 5)) st.add(irnd(MINC, MAXC));
        L = { type: 'river', stones: st, objs: [], dir: 1, spd: 0 };
      } else L = { type: 'river', ...movers(r, 'river', d) };
    } else L = { type: 'rail', dir: Math.random() < .5 ? 1 : -1, t: rnd(1.5, 5), train: null, warn: false };
    prevT = t; return L;
  }

  function reset() {
    lanes = new Map(); genR = -6; seg = 'grass'; segLeft = 0; pathC = 5; prevT = 'grass';
    P = { r: 0, px: 5.5, fx: 5.5, fr: 0, tx: 5.5, tr: 0, h: -1, face: 'up', log: null, sq: 0, bump: 0, dead: null };
    cam = -1.2; score = 0; started = false; over = false; paused = false; dying = 0; queue = null; msg = null; fx = []; last = 0; t0 = 0;
    pb.reset(); ov.hidden = true; ov.innerHTML = '';
    for (let r = -6; r < 26; r++) lane(r);
  }

  // ── 움직이기 ──
  const blocked = (L, c) => L.type === 'grass' && L.tree.has(c);
  function move(dc, dr) {
    if (over || paused || dying) return;
    if (P.h >= 0) { queue = [dc, dr]; return; }
    started = true;
    const face = dr > 0 ? 'up' : dr < 0 ? 'down' : dc < 0 ? 'left' : 'right';
    P.face = face;
    let tc = Math.floor(P.px) + dc; const tr = P.r + dr;
    if (dc === 0) tc = Math.max(MINC, Math.min(MAXC, tc));
    const L = lane(tr);
    if (tc < MINC || tc > MAXC || blocked(L, tc)) { P.bump = .12; S.tone(160, .05, 'square', .03); return; }
    P.fx = P.px; P.fr = P.r; P.tx = tc + .5; P.tr = tr; P.h = 0; P.log = null; P.sq = 0;
    S.tone(520 + (dr > 0 ? 80 : 0), .05, 'square', .035, 0, 760);
  }
  function land() {
    P.r = P.tr; P.px = P.tx; P.h = -1; P.sq = .1;
    const L = lane(P.r);
    if (L.type === 'river') {
      if (L.stones) { if (!L.stones.has(Math.floor(P.px))) return die('water'); }
      else {
        const g = L.objs.find(o => P.px >= o.x - .15 && P.px <= o.x + o.len + .15);
        if (!g) return die('water');
        P.log = g; P.px = g.x + Math.max(.5, Math.min(g.len - .5, Math.floor(P.px - g.x) + .5));
        S.tone(260, .06, 'sine', .04);
      }
    }
    if (P.r > score) { score = P.r; if (score % 50 === 0) { msg = { text: score + '칸!', t: 1.2 }; S.tone(880, .08, 'square', .04); S.tone(1175, .1, 'square', .04, .08); } }
    if (queue) { const q = queue; queue = null; move(q[0], q[1]); }
  }
  function die(kind) {
    if (P.dead) return; P.dead = kind; dying = kind === 'late' ? .9 : .8; P.h = -1; queue = null;
    if (kind === 'water') { S.noise(.35, .07, 0, 600); for (let i = 0; i < 14; i++) fx.push({ x: P.px * T, r: P.r, z: 0, vx: rnd(-90, 90), vz: rnd(120, 260), life: .6, c: i % 2 ? '#ffffff' : '#bfe8ff' }); }
    else if (kind === 'late') { S.tone(988, .25, 'triangle', .05); S.tone(784, .35, 'triangle', .05, .25); }
    else { S.noise(.25, .09, 0, 120); S.tone(140, .2, 'sawtooth', .04, 0, 60); }
  }
  function gameOver() {
    over = true; pb.off();
    const nb = score > best; if (nb) { best = score; store.set('cross_best', best); }
    const why = { car: '차에 치였어요', train: '열차에 치였어요', water: '물에 빠졌어요', late: '지각! 선생님이 기다리고 있어요', pause: '멈춤 시간을 다 썼어요' }[P.dead] || '';
    ov.innerHTML = `<div class="bl-card"><b class="bl-t">${why}</b><p class="bl-sc">${score.toLocaleString()}칸</p>
      <p class="bl-sub">${nb ? '<em>내 최고 기록 경신!</em>' : `내 최고 ${best.toLocaleString()}칸`}</p>
      <button type="button" class="btn big" data-cx-again>다시 하기</button><p class="bl-note">시험판 · 기록은 이 기기에만 저장돼요</p></div>`;
    ov.hidden = false;
  }
  function pause(on) {
    if (over || dying || !started || paused === on) return;
    paused = on;
    if (on) { pb.on(); ov.innerHTML = `<div class="bl-card"><b class="bl-t">잠깐 멈춤</b>${pb.html()}<button type="button" class="btn big" data-cx-go>계속하기</button></div>`; ov.hidden = false; }
    else { pb.off(); ov.hidden = true; ov.innerHTML = ''; last = 0; }
  }

  // ── 시간 흐름 ──
  function step(dt) {
    t0 += dt;
    for (const [r, L] of lanes) {
      if (r < cam - 6) { lanes.delete(r); continue; }
      if (L.objs && L.spd) for (const o of L.objs) {
        o.x += L.dir * L.spd * dt;
        if (L.dir > 0 && o.x > XR) o.x -= SPAN; else if (L.dir < 0 && o.x + o.len < XL) o.x += SPAN;
      }
      if (L.type === 'rail') {
        if (!L.train) { L.t -= dt; L.warn = L.t < 1.3; if (L.warn && L.t + dt >= 1.3 && Math.abs(r - P.r) < 9) S.tone(1320, .12, 'square', .025); if (L.t <= 0) { const len = irnd(9, 13); L.train = { x: L.dir > 0 ? -len - 2 : COLS + 2, len }; } }
        else { L.train.x += L.dir * 30 * dt; if ((L.dir > 0 && L.train.x > COLS + 2) || (L.dir < 0 && L.train.x + L.train.len < -2)) { L.train = null; L.warn = false; L.t = rnd(2.5, 6.5); } }
      }
    }
    if (dying) { dying -= dt; if (dying <= 0) gameOver(); return; }
    // 뛰는 중
    if (P.h >= 0) { P.h += dt / HOP; if (P.h >= 1) land(); }
    if (P.sq > 0) P.sq -= dt; if (P.bump > 0) P.bump -= dt;
    // 통나무 위
    if (P.h < 0 && P.log) {
      const L = lane(P.r); P.px += L.dir * L.spd * dt;
      if (P.px < .7 || P.px > COLS - .7) return die('water');
    }
    // 부딪힘(뛰는 중엔 절반 넘으면 도착 줄 기준)
    const hr = P.h >= 0 ? (P.h > .5 ? P.tr : P.fr) : P.r, hx = P.h >= 0 ? P.fx + (P.tx - P.fx) * P.h : P.px;
    const L = lane(hr);
    if (L.type === 'road') { for (const o of L.objs) if (hx + .28 > o.x + .06 && hx - .28 < o.x + o.len - .06) { P.r = hr; P.px = hx; return die('car'); } }
    else if (L.type === 'rail' && L.train) { const o = L.train; if (hx + .3 > o.x && hx - .3 < o.x + o.len) { P.r = hr; P.px = hx; return die('train'); } }
    // 화면 따라오기: 학생을 아래에서 4줄쯤에 두고, 출발하면 화면이 천천히 저절로 올라옴
    if (started) {
      const auto = .3 + Math.min(.5, score * .0024);
      cam += auto * dt;
      const tgt = (P.h >= 0 ? P.fr + (P.tr - P.fr) * P.h : P.r) - 4.5;
      if (tgt > cam) cam += (tgt - cam) * Math.min(1, dt * 5);
      if (P.h < 0 && P.r < cam - 1.3) die('late');
    }
    lane(Math.ceil(cam) + 23);
  }

  // ── 그리기 ──
  const yF = r => H - (r - cam + 1.6) * TD;   // 줄 r의 앞(아래) 끝 화면 y
  function quad(a, b, c, d, fill) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  // 상자: 땅 위 직사각형(x, yB~yB+d, 폭 w) · 높이 h · 바닥에서 z만큼 띄움 → 앞면·오른쪽 면·윗면
  function box(x, yB, w, d, h, z, col, line = true) {
    const x0 = x + z * HX, y0 = yB + z * HY, y1 = y0 + d, tx = h * HX, ty = h * HY;
    quad([x0, y1], [x0 + w, y1], [x0 + w + tx, y1 + ty], [x0 + tx, y1 + ty], col);
    quad([x0 + w, y1], [x0 + w, y0], [x0 + w + tx, y0 + ty], [x0 + w + tx, y1 + ty], shade(col, -.28));
    quad([x0 + tx, y0 + ty], [x0 + w + tx, y0 + ty], [x0 + w + tx, y1 + ty], [x0 + tx, y1 + ty], shade(col, .22));
    if (line) {
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0 + w, y1); ctx.lineTo(x0 + w + tx, y1 + ty); ctx.lineTo(x0 + w + tx, y0 + ty); ctx.lineTo(x0 + tx, y0 + ty); ctx.lineTo(x0 + tx, y1 + ty); ctx.closePath();
      ctx.moveTo(x0 + tx, y1 + ty); ctx.lineTo(x0 + w + tx, y1 + ty); ctx.moveTo(x0 + w, y1); ctx.lineTo(x0 + w + tx, y1 + ty);
      ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    }
    return { x0, y1, w, tx, ty, h };
  }
  // 앞면 위 작은 칸(창문·눈 등): 가로 u0~u1(0~1), 세로 v0~v1(아래 0 ~ 위 1)
  function face(b, u0, u1, v0, v1, col) {
    const p = (u, v) => [b.x0 + b.w * u + b.tx * v, b.y1 + b.ty * v];
    quad(p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1), col);
  }
  const shadow = (x, yB, w, d) => { ctx.fillStyle = 'rgba(20,30,60,.16)'; ctx.fillRect(x + 5, yB + 4, w, d); };

  function ground(r, L, y) {
    const yb = y - TD;
    if (L.type === 'grass') {
      ctx.fillStyle = L.alt ? '#a6e36f' : '#9bdb63'; ctx.fillRect(0, yb, W, TD);
    } else if (L.type === 'road') {
      ctx.fillStyle = '#5d6272'; ctx.fillRect(0, yb, W, TD);
      if (lane(r + 1).type === 'road') { ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let x = 6; x < W; x += 48) ctx.fillRect(x, yb - 2, 24, 4); }
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, y - 3, W, 3);
    } else if (L.type === 'river') {
      ctx.fillStyle = '#5ac4f5'; ctx.fillRect(0, yb, W, TD);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      const off = ((t0 * 30 * (L.dir || 1)) % 96 + 96) % 96;
      for (let x = -96 + off + (r % 3) * 30; x < W; x += 96) ctx.fillRect(x, yb + 10 + (r % 2) * 9, 22, 3);
      ctx.fillStyle = 'rgba(20,60,120,.18)'; ctx.fillRect(0, yb, W, 5);
    } else {
      ctx.fillStyle = '#b9a690'; ctx.fillRect(0, yb, W, TD);
      ctx.fillStyle = '#8a6a4f'; for (let x = 4; x < W; x += 16) ctx.fillRect(x, yb + 5, 7, TD - 10);
      ctx.fillStyle = '#9aa3b5'; ctx.fillRect(0, yb + 9, W, 3); ctx.fillRect(0, y - 12, W, 3);
    }
  }
  function tree(c, yb, kind) {
    const x = c * T;
    if (kind === 'bush') { shadow(x + 6, yb + 5, T - 12, TD - 10); box(x + 6, yb + 5, T - 12, TD - 10, 24, 0, '#4fbf5a'); return; }
    shadow(x + 8, yb + 4, T - 16, TD - 8);
    box(x + 19, yb + 13, 10, 8, 16, 0, '#9a6a3c');
    box(x + 7, yb + 5, T - 14, TD - 10, 32, 16, '#3fae5a');
    box(x + 13, yb + 9, T - 26, TD - 18, 12, 48, '#5ccf6a');
  }
  function vehicle(o, yb) {
    const x = o.x * T + 2, w = o.len * T - 4, d = TD - 10, y = yb + 5;
    shadow(x, y, w, d);
    for (const u of [.18, .78]) box(x + w * u - 5, y + d - 4, 10, 4, 7, 0, '#2a2846', false);
    if (o.v === 'car') {
      const b = box(x, y, w, d, 15, 4, o.col);
      const cx = o.x * T + 2 + w * .22, c = box(cx, y + 2, w * .52, d - 4, 15, 19, shade(o.col, .1));
      face(c, .08, .46, .2, .82, '#2c3a66'); face(c, .54, .92, .2, .82, '#2c3a66');
      void b;
    } else if (o.v === 'truck') {
      const front = o.dir > 0;
      const cw = w * .3, cab = front ? x + w - cw : x;
      const c = box(cab, y, cw, d, 26, 4, o.col); face(c, .15, .85, .45, .85, '#2c3a66');
      box(front ? x : x + cw + 2, y - 2, w - cw - 2, d + 2, 32, 4, '#f4f4f8');
    } else {
      const b = box(x, y - 2, w, d + 2, 30, 4, '#ffcc3d');
      for (let u = .06; u < .92; u += .16) face(b, u, u + .11, .48, .86, '#2c3a66');
      face(b, 0, 1, .2, .3, '#2a2846');
    }
  }
  function train(o, yb) {
    const x0 = o.x * T, d = TD - 8, y = yb + 4, car = 4;
    shadow(x0, y, o.len * T, d);
    for (let i = 0; i * car < o.len; i++) {
      const x = x0 + i * car * T + (i ? 3 : 0), w = Math.min(car, o.len - i * car) * T - (i ? 3 : 0);
      const b = box(x, y, w, d, 38, 3, '#e8ecf3');
      face(b, 0, 1, .18, .3, '#8b5cd6');
      for (let u = .06; u < .9; u += .2) face(b, u, u + .13, .5, .86, '#2c3a66');
    }
  }
  function signal(L, yb) {
    const x = 10 * T + 14, on = L.warn && (t0 * 6 | 0) % 2;
    box(x, yb + 10, 6, 5, 52, 0, '#6a6f80');
    const b = box(x - 6, yb + 9, 18, 5, 14, 40, '#2a2846');
    face(b, .1, .45, .2, .8, on ? '#ff3b3b' : '#5a2a2a'); face(b, .55, .9, .2, .8, !on && L.warn ? '#ff3b3b' : '#5a2a2a');
  }
  function student(yb) {
    const hop = P.h >= 0 ? P.h : -1, px = hop >= 0 ? P.fx + (P.tx - P.fx) * hop : P.px;
    const rowOff = hop >= 0 ? P.fr + (P.tr - P.fr) * hop - (hop > .5 ? P.tr : P.fr) : 0;   // 그리는 줄(가까운 쪽 반) 기준 앞뒤 이동
    let z = hop >= 0 ? Math.sin(hop * Math.PI) * 18 : 0;
    const K = 1.18;   // 키(높이) 배율
    let sy = P.sq > 0 ? 1 - P.sq * 1.6 : hop >= 0 ? 1.08 : 1, bx = 0;
    if (P.bump > 0) bx = Math.sin(P.bump * 50) * 2;
    if (P.dead === 'car' || P.dead === 'train') { sy = .25; z = 0; }
    if (P.dead === 'water') return;
    const w = 34, d = 20, x = px * T - w / 2 + bx, y = yb + (TD - d) / 2 - rowOff * TD, k = sy;
    shadow(x - 2, y + 2, w, d);
    box(x + 4, y + 3, w - 8, d - 6, 10 * k * K, z, '#2c3566');                 // 다리(남색 바지)
    const body = box(x + 2, y + 2, w - 4, d - 4, 15 * k * K, z + 10 * k * K, '#3d7bff');   // 교복 상의
    face(body, .42, .58, .2, 1, '#ffffff');
    if (P.face === 'up') box(x + 6, y + d - 3, w - 12, 6, 13 * k * K, z + 11 * k * K, '#ff7a59');   // 뒤돌면 가방이 보임
    const head = box(x + 2, y, w - 4, d, 17 * k * K, z + 25 * k * K, '#ffd9b8');
    box(x + 1, y - 1, w - 2, P.face === 'up' ? d + 1 : d * .55, 6 * k * K, z + 41 * k * K, '#2a2236');        // 머리카락(앞을 보면 뒤쪽 반만 덮어 얼굴이 보임)
    if (P.face === 'up') face(head, 0, 1, 0, 1, '#2a2236');
    else if (k > .5) {
      face(head, 0, 1, .7, 1, '#2a2236');
      const eye = (u) => face(head, u, u + .12, .32, .56, '#2a2846');
      if (P.face === 'down') { eye(.24); eye(.64); face(head, .38, .62, .12, .2, '#ff8a8a'); }
      else if (P.face === 'left') { eye(.12); face(head, .55, 1, .15, .7, '#2a2236'); }
      else { eye(.76); face(head, 0, .45, .15, .7, '#2a2236'); }
    }
  }
  function draw() {
    const s = scale * dpr; ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = '#9bdb63'; ctx.fillRect(0, 0, W, H);
    const r0 = Math.floor(cam) - 2, r1 = Math.ceil(cam) + 21;
    for (let r = r1; r >= r0; r--) ground(r, lane(r), yF(r));
    const pr = P.h >= 0 ? (P.h > .5 ? P.tr : P.fr) : P.r;
    for (let r = r1; r >= r0; r--) {
      const L = lane(r), yb = yF(r) - T;
      if (L.type === 'grass') { for (const c of [...L.tree].sort((a, b) => a - b)) tree(c, yb, L.kind[c]); }
      else if (L.type === 'river') {
        if (L.stones) for (const c of L.stones) box(c * T + 7, yb + 6, T - 14, TD - 12, 7, 0, '#c9ced8');
        else for (const o of L.objs) { const b = box(o.x * T + 2, yb + 6, o.len * T - 4, TD - 12, 10, 0, '#a8703f'); face(b, 0, 1, .3, .45, '#8a5a30'); }
      } else if (L.type === 'road') for (const o of L.objs) vehicle({ ...o, dir: L.dir }, yb);
      else if (L.type === 'rail') { signal(L, yb); if (L.train) train(L.train, yb); }
      if (r === pr) student(yb);
    }
    // 물보라
    for (const p of fx) { ctx.globalAlpha = Math.max(0, p.life / .6); ctx.fillStyle = p.c; ctx.fillRect(p.x - 3 + p.z * HX, yF(p.r) - TD / 2 + p.z * HY - 3, 6, 6); }
    ctx.globalAlpha = 1;
    // 벽 밖 칸(0·10번) 어둡게
    ctx.fillStyle = 'rgba(20,24,60,.28)'; ctx.fillRect(0, 0, T, H); ctx.fillRect(10 * T, 0, T, H);
    // 지각 빨간 띠(화면 아래가 학생에게 다가올 때)
    if (started && !over) {
      const gap = P.r - cam + 1.3; if (gap < 2.6) { ctx.fillStyle = `rgba(255,59,59,${Math.min(.35, (2.6 - gap) * .2) * (.6 + .4 * Math.sin(t0 * 10))})`; ctx.fillRect(0, H - 70, W, 70); }
    }
    // 점수
    ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = '400 44px Jua, Pretendard, sans-serif'; ctx.lineWidth = 7; ctx.strokeStyle = '#2a2846';
    ctx.strokeText(score, 64, 58); ctx.fillStyle = '#fff'; ctx.fillText(score, 64, 58);
    ctx.font = '700 13px Pretendard, sans-serif'; ctx.lineWidth = 4; ctx.strokeText('최고 ' + best.toLocaleString(), 66, 80); ctx.fillText('최고 ' + best.toLocaleString(), 66, 80);
    if (!started) {
      ctx.textAlign = 'center'; ctx.font = '400 46px Jua, Pretendard, sans-serif'; ctx.lineWidth = 8;
      ctx.strokeText('지각 직전!', W / 2, 220); ctx.fillStyle = '#ffd25e'; ctx.fillText('지각 직전!', W / 2, 220);
      ctx.font = '700 16px Pretendard, sans-serif'; ctx.lineWidth = 5; ctx.fillStyle = '#fff';
      const a = (Math.sin(performance.now() / 300) + 1) / 2 * .5 + .5; ctx.globalAlpha = a;
      ctx.strokeText('↑ 키나 화면을 눌러 출발', W / 2, 254); ctx.fillText('↑ 키나 화면을 눌러 출발', W / 2, 254); ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
    if (msg) { ctx.globalAlpha = Math.min(1, msg.t / .4); ctx.textAlign = 'center'; ctx.font = '400 38px Jua, Pretendard, sans-serif'; ctx.lineWidth = 7;
      ctx.strokeText(msg.text, W / 2, 150); ctx.fillStyle = '#ffd25e'; ctx.fillText(msg.text, W / 2, 150); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
    if (P.dead === 'late' && dying > 0) { ctx.textAlign = 'center'; ctx.font = '400 64px Jua, Pretendard, sans-serif'; ctx.lineWidth = 9; ctx.strokeText('지각!', W / 2, H / 2); ctx.fillStyle = '#ff4d4d'; ctx.fillText('지각!', W / 2, H / 2); ctx.textAlign = 'left'; }
  }

  function frame(t) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    fit();
    const dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    if (paused) { pb.paint(); if (pb.out()) { paused = false; ov.hidden = true; P.dead = 'pause'; pauseOutMsg(); gameOver(); } return; }
    if (!over) step(dt);
    for (const p of fx) { p.life -= dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= 700 * dt; }
    fx = fx.filter(p => p.life > 0); if (msg && (msg.t -= dt) <= 0) msg = null;
    draw();
  }

  // ── 입력 ──
  const typing = e => e.target.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('.modal.open');
  const KEYS = { ArrowUp: [0, 1], KeyW: [0, 1], Space: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  const kd = e => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (paused) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); pause(false); } return; }
    if (over) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); reset(); } return; }
    const k = KEYS[e.code];
    if (k) { e.preventDefault(); if (!e.repeat) move(k[0], k[1]); }
    else if (e.code === 'KeyP' || e.code === 'Escape') pause(true);
  };
  let sx = 0, sy = 0, down = false;
  const pd = e => { down = true; sx = e.clientX; sy = e.clientY; cv.setPointerCapture?.(e.pointerId); e.preventDefault(); };
  const pu = e => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < 22) move(0, 1);
    else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy < 0 ? 1 : -1);
  };
  cv.addEventListener('pointerdown', pd); cv.addEventListener('pointerup', pu); cv.addEventListener('pointercancel', () => { down = false; });
  const vis = () => { if (document.hidden) pause(true); };
  const blur = () => pause(true);
  ov.addEventListener('click', e => { if (e.target.closest('[data-cx-again]')) reset(); else if (e.target.closest('[data-cx-go]')) pause(false); });
  addEventListener('keydown', kd); document.addEventListener('visibilitychange', vis); addEventListener('blur', blur);

  reset();
  return {
    start() { fit(); raf = requestAnimationFrame(frame); },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('keydown', kd); document.removeEventListener('visibilitychange', vis); removeEventListener('blur', blur);
    },
    get state() { return { score, r: P.r, px: P.px, over, dead: P.dead, cam, started }; },   // 검사용
  };
}
