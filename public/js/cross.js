// SVMHS GROUND — 지각 직전!(2026-11-09 하율 "길건너 친구들 한 번 만들어보자" → 같은 날 "디벨롭, 그래픽이든 게임 플레이든 바로 출시해도 될 정도로", 미리보기 깃발 cross-game)
// 길건너 친구들 방식: 한 칸씩 폴짝 뛰어 도로(승용차·택시·트럭·학원 버스·배달 오토바이)·하천(통나무·연잎·징검다리)·철길(열차)·잔디(나무·덤불·바위)를 건너 앞으로.
// 화면이 천천히 따라 올라와서 멈춰 있거나 뒤로 가면 선생님이 나타나 '지각!'. 이름·캐릭터·그림은 원작과 무관 — 주인공은 공용 캐릭터(runner.js 꾸미기)를 블록으로.
// 시험판 — 서버·랭킹 없이 이 기기 최고 기록만(sg_cross_best). 멈춤은 한 판 30초(pauseBudget, 화면 숨김·창 벗어남 포함, 넘으면 판 끝).
// createCross(el, O) → { start, destroy, setChar, state }   O.char = runner.js loadChar() 값, O.opts = runner.js OPTS (없으면 기본 교복)
import { store, pauseBudget, pauseOutMsg } from './util.js';
import { CROSS_MAX } from './rec-score.js';
import { makeSfx, sndBtnHtml, bindSnd } from './sfx.js';

const T = 48, TD = 34, COLS = 11, W = COLS * T, H = 704;   // 칸 가로 48px · 줄 깊이 34px(눌러서 낮은 시점) · 가로 11칸(0·10번은 벽 밖, 1~9번에서 놂)
const MINC = 1, MAXC = 9, SPAN = 18, XL = -4, XR = 14;     // 차·통나무가 도는 범위(칸)
const HX = 0.2, HY = -0.9;                                 // 높이 1px이 화면에서 옮겨 가는 방향
const HOP = 0.12, ANCHOR = 4.5, LATE = 1.3, INK = 'rgba(42,40,70,.55)';
const rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const CAR_C = ['#ff6b6b', '#3d7bff', '#5fd38a', '#b07cff', '#f3f5fa', '#4ecdc4', '#ff9fc6', '#3b3b49'];
const SC = new Map();
function shade(hex, k) {   // k>0 밝게, k<0 어둡게 (#hex → #hex, 캐시)
  const key = hex + k; let v = SC.get(key); if (v) return v;
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
  v = '#' + ((1 << 24) | f(n >> 16 & 255) << 16 | f(n >> 8 & 255) << 8 | f(n & 255)).toString(16).slice(1); SC.set(key, v); return v;
}
// 공용 캐릭터 → 블록 색
function lookOf(c, opts) {
  const L = { skin: '#f7caa1', hair: '#2c2a3c', top: '#34407a', bot: '#34407a', shoe: '#f3f5fa', bag: '#ff8a5b', hs: 'short', topK: 'blazer', botK: 'pants', hat: '', face: '' };
  if (!c || typeof c !== 'object' || !Array.isArray(opts)) return L;
  const col = (k, d) => { const o = opts.find(x => x.k === k); const v = o?.colors?.[c[k]]?.[0]; return v === undefined ? d : v; };
  return { skin: col('skin', L.skin), hair: col('hc', L.hair), top: col('tc', L.top), bot: col('bc', L.bot), shoe: col('shoe', L.shoe), bag: col('bag', L.bag) || '',
    hs: c.hair || 'short', topK: c.top || 'blazer', botK: c.bot || 'pants', hat: c.hat || '', face: c.face || '' };
}

export function createCross(el, O = {}) {
  el.innerHTML = `<div class="bl cx"><div class="bl-wrap"><canvas class="bl-cv" aria-label="지각 직전! 게임 화면"></canvas><div class="bl-ov" hidden></div></div>
    <div class="bl-bar"><span class="bl-help">↑↓←→·WASD · 탭 = 앞으로 · 밀기 = 그 방향</span><button type="button" class="btn cx-dress">캐릭터 꾸미기</button><button type="button" class="btn ghost cx-pz" aria-label="멈춤">멈춤</button>${sndBtnHtml('cxSnd')}</div>
    <div class="hr-dress cx-dressbox" hidden></div></div>`;
  const cv = el.querySelector('.bl-cv'), ctx = cv.getContext('2d'), ov = el.querySelector('.bl-ov'), pzBtn = el.querySelector('.cx-pz');
  const S = makeSfx('sg_cross_snd'); bindSnd(el.querySelector('#cxSnd'), S);
  const pb = pauseBudget();
  let look = lookOf(O.char, O.opts);
  let best = +store.get('cross_best', 0) || 0;
  let lanes, genR, seg, segLeft, pathC, prevT, prevDir, cw, P, cam, score, started, over, paused, dying, queue, alive = true, raf = 0, last = 0, t0 = 0, msg = null, fx = [], shake = 0, teach = null;
  let scale = 1, dpr = 1;

  function fit() {
    const wrap = el.querySelector('.bl-wrap'); if (!wrap) return;
    const top = wrap.getBoundingClientRect().top, bar = el.querySelector('.bl-bar')?.offsetHeight || 0;
    const fs = !!document.fullscreenElement;
    const avH = Math.max(320, innerHeight - top - bar - (fs ? 24 : 90)), avW = Math.max(240, el.clientWidth || 360);
    const ns = Math.min(avW / W, avH / H, 1.6), nd = Math.min(2, window.SG_DPR || devicePixelRatio || 1);
    if (Math.abs(ns - scale) < .001 && nd === dpr && cv.width) return;
    scale = ns; dpr = nd;
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
    cv.style.width = Math.round(W * scale) + 'px'; cv.style.height = Math.round(H * scale) + 'px';
  }

  // ── 길 만들기(줄 r마다 한 번, 위로 갈수록 어려워짐) ──
  // 잔디: pathC 칸은 늘 비워 이어지는 길 보장 · 하천 다음은 꼭 잔디 · 이어진 통나무 줄은 방향을 번갈아 · 줄 0 아래는 나무 벽
  function lane(r) {
    if (lanes.has(r)) return lanes.get(r);
    while (genR <= r) { lanes.set(genR, make(genR)); genR++; }
    return lanes.get(r) || lanes.get(genR - 1);
  }
  function grass(r, dens) {
    const tree = new Set([0, 10]), kind = {}, deco = [];
    if (r < 0) { for (let c = MINC; c <= MAXC; c++) if (Math.random() < (r < -2 ? .5 : .22)) tree.add(c); }   // 출발선 뒤: 장식(뒤로는 코드에서 막음)
    else for (let c = MINC; c <= MAXC; c++) if (c !== pathC && Math.random() < dens) tree.add(c);
    if (r >= 0) { pathC = Math.max(MINC, Math.min(MAXC, pathC + irnd(-1, 1))); tree.delete(pathC); }
    for (const c of tree) { const k = Math.random(); kind[c] = c === 0 || c === 10 || r < 0 ? (k < .6 ? 'tree' : 'pine') : k < .42 ? 'tree' : k < .62 ? 'pine' : k < .85 ? 'bush' : 'rock'; }
    for (let i = irnd(0, 3); i > 0; i--) deco.push({ x: rnd(.4, 10.4), y: rnd(.15, .8), c: pick(['#fff6a8', '#ffffff', '#ff9fc6', '#ffd25e']), k: Math.random() < .5 ? 'f' : 't' });
    return { type: 'grass', tree, kind, alt: r & 1, deco };
  }
  function road(d) {
    const dir = Math.random() < .5 ? 1 : -1, objs = [], k = Math.random();
    const v = k < .42 ? 'car' : k < .55 ? 'taxi' : k < .72 ? 'truck' : k < .86 ? 'bus' : 'bike';
    const len = { car: 1.5, taxi: 1.5, truck: 2.4, bus: 3.2, bike: 1 }[v];
    const spd = rnd(1.4, 2.8) * (1 + .75 * d) * ({ bus: .8, truck: .9, bike: 1.45 }[v] || 1);
    const g0 = Math.max(1.9, 2.8 - d * .8), g1 = Math.max(g0 + 1, 5.6 - d * 1.6);
    let x = XL + rnd(0, 2);
    while (x + len + g0 <= XR) { objs.push({ x, len, v, col: v === 'taxi' ? '#ffb43d' : v === 'bus' ? '#ffcc3d' : v === 'bike' ? '#ff6b6b' : pick(CAR_C), cargo: pick(['#f3f5fa', '#7cc4ff', '#62d9b8']) }); x += len + rnd(g0, g1); }
    return { type: 'road', dir, spd, objs };
  }
  function river(d, first) {
    if (first && segLeft === 0 && Math.random() < .4) {   // 한 줄짜리 하천은 가끔 징검다리
      const st = new Set(); while (st.size < irnd(3, 5)) st.add(irnd(MINC, MAXC));
      return { type: 'river', stones: st, objs: [], dir: 1, spd: 0 };
    }
    const dir = prevT === 'river' ? -prevDir : (Math.random() < .5 ? 1 : -1), objs = [];
    const lily = !first && Math.random() < .25;   // 가운데 줄은 가끔 연잎(통나무보다 작고 따로따로)
    const spd = rnd(.9, 1.7) * (1 + .45 * d) * (lily ? .8 : 1);
    let x = XL + rnd(0, 1);
    for (;;) {
      const len = lily ? 1 : irnd(2, 4) - (d > .55 && Math.random() < .45 ? 1 : 0);
      if (x + len + 1.2 > XR) break; objs.push({ x, len, v: lily ? 'lily' : 'log' }); x += len + (lily ? rnd(.8, 1.8) : rnd(1.2, 2.4 + d * .7));
    }
    prevDir = dir; return { type: 'river', dir, spd, objs };
  }
  function make(r) {
    const d = Math.min(1, Math.max(0, r) / 260);
    if (r < 5) { const g = grass(r, r < 2 ? 0 : .12); prevT = 'grass'; return g; }
    let first = false;
    if (segLeft <= 0) {
      let t; const roll = Math.random();
      if (prevT === 'river') t = 'grass';
      else t = roll < .26 - .08 * d ? 'grass' : roll < .66 ? 'road' : roll < .86 ? 'river' : 'rail';
      if (t === prevT && t !== 'road') t = 'grass';
      seg = t; first = true; cw = Math.random() < .35 ? irnd(2, 7) : -1;   // 도로 묶음에 가끔 횡단보도
      segLeft = t === 'grass' ? irnd(1, 2) : t === 'road' ? irnd(1, 2 + Math.round(d * 2)) : t === 'river' ? irnd(1, 3) : irnd(1, 2);
    }
    segLeft--; const t = seg;
    let L;
    if (t === 'grass') L = grass(r, prevT === 'river' ? .08 : first ? .1 + .06 * d : .16 + .12 * d);   // 묶음 첫 줄은 덜 막아서 어디서 건너와도 길을 찾기 쉽게
    else if (t === 'road') { L = road(d); L.cw = cw; }
    else if (t === 'river') L = river(d, first);
    else L = { type: 'rail', dir: Math.random() < .5 ? 1 : -1, t: rnd(1.5, 5), train: null, warn: false, ding: 0 };
    prevT = t; return L;
  }

  function reset() {
    lanes = new Map(); genR = -6; seg = 'grass'; segLeft = 0; pathC = 5; prevT = 'grass'; prevDir = 1; cw = -1;
    P = { r: 0, px: 5.5, fx: 5.5, fr: 0, tx: 5.5, tr: 0, h: -1, face: 'up', log: null, sq: 0, bump: 0, dead: null, fly: null, z: 0 };
    cam = -ANCHOR; score = 0; started = false; over = false; paused = false; dying = 0; queue = null; msg = null; fx = []; last = 0; t0 = 0; shake = 0; teach = null;
    pb.reset(); ov.hidden = true; ov.innerHTML = ''; pzBtn.disabled = false; O.rk?.seed();   // 판마다 기록실 시작 티켓(2026-11-09)
    for (let r = -6; r < 26; r++) lane(r);
  }

  // ── 움직이기 ──
  const blocked = (L, c) => L.type === 'grass' && L.tree.has(c);
  function move(dc, dr) {
    if (over || paused || dying) return;
    if (P.h >= 0) { queue = [dc, dr]; return; }
    started = true;
    P.face = dr > 0 ? 'up' : dr < 0 ? 'down' : dc < 0 ? 'left' : 'right';
    const tr = P.r + dr, L = lane(tr);
    let tx;
    if (dr === 0 && P.log) tx = P.px + dc;                       // 통나무 위 옆으로: 통나무 기준 한 칸
    else { let tc = Math.round(P.px - .5) + dc; if (dc === 0) tc = Math.max(MINC, Math.min(MAXC, tc)); tx = tc + .5; }
    const tc = Math.floor(tx);
    if (tr < 0 || tx < MINC || tx > MAXC + 1 || (L.type !== 'river' && (tc < MINC || tc > MAXC)) || blocked(L, tc)) { P.bump = .14; S.tone(150, .05, 'square', .03); return; }
    P.fx = P.px; P.fr = P.r; P.tx = tx; P.tr = tr; P.h = 0; P.hopLog = dr === 0 ? P.log : null; P.log = null; P.sq = 0;
    S.tone(dr > 0 ? 560 : 470, .045, 'square', .03, 0, dr > 0 ? 820 : 640);
  }
  function land() {
    P.r = P.tr; P.px = P.tx; P.h = -1; P.sq = .1; P.hopLog = null;
    const L = lane(P.r);
    if (L.type === 'river') {
      if (L.stones) { if (!L.stones.has(Math.floor(P.px))) return die('water'); S.tone(300, .05, 'sine', .04); }
      else {
        const g = L.objs.find(o => P.px >= o.x - .18 && P.px <= o.x + o.len + .18);
        if (!g) return die('water');
        P.log = g; P.px = g.x + Math.max(.5, Math.min(g.len - .5, Math.floor(P.px - g.x) + .5)); g.bob = .25;
        S.tone(240, .07, 'sine', .05);
      }
    } else P.log = null;
    if (P.r > score) {
      score = P.r;
      if (score % 50 === 0) { msg = { text: score + '칸 돌파!', t: 1.4 }; S.tone(880, .08, 'square', .04); S.tone(1175, .08, 'square', .04, .08); S.tone(1568, .14, 'square', .04, .16); }
    }
    if (queue) { const q = queue; queue = null; move(q[0], q[1]); }
  }
  function die(kind, dir = 1) {
    if (P.dead) return; P.dead = kind; P.h = -1; queue = null; pzBtn.disabled = true;
    dying = kind === 'late' ? 1.6 : kind === 'train' ? 1.2 : 1;
    if (kind === 'water') { S.noise(.4, .08, 0, 500); P.sink = 0; for (let i = 0; i < 16; i++) fx.push({ x: P.px * T, r: P.r, z: 2, vx: rnd(-80, 80), vz: rnd(140, 280), life: .7, c: i % 3 ? '#ffffff' : '#bfe8ff', s: rnd(4, 7) }); }
    else if (kind === 'late') { teach = { t: 0, x: P.px }; S.tone(1047, .2, 'triangle', .05); S.tone(784, .2, 'triangle', .05, .22); S.tone(1047, .2, 'triangle', .05, .44); S.tone(784, .4, 'triangle', .05, .66); }
    else if (kind === 'train') { shake = .35; P.fly = { vx: dir * 16, vz: 340, z: 0, rot: 0 }; S.noise(.35, .12, 0, 90); S.tone(120, .3, 'sawtooth', .05, 0, 50); }
    else { shake = .2; S.noise(.25, .1, 0, 140); S.tone(160, .2, 'sawtooth', .045, 0, 70); for (let i = 0; i < 8; i++) fx.push({ x: P.px * T, r: P.r, z: 14, vx: rnd(-120, 120), vz: rnd(60, 200), life: .5, c: pick(['#ffd25e', '#ffffff']), s: 5 }); }
  }
  function gameOver() {
    over = true; pb.off();
    const nb = score > best && score > 0; if (nb) { best = score; store.set('cross_best', best); }
    const why = { car: '차에 치였어요', train: '열차에 치였어요', water: '물에 빠졌어요', late: '지각! 선생님한테 잡혔어요', pause: '멈춤 시간을 다 썼어요' }[P.dead] || '';
    ov.innerHTML = `<div class="bl-card"><b class="bl-t">${why}</b><p class="bl-sc">${score.toLocaleString()}칸</p>
      <p class="bl-sub">${nb ? '<em>내 최고 기록 경신!</em>' : `내 최고 ${best.toLocaleString()}칸`}</p>
      <button type="button" class="btn big" data-cx-again>다시 하기</button><p class="bl-note">Space·Enter로도 다시 · ${O.rk && score > 0 ? '기록실에 저장 중…' : '기록은 이 기기에만 저장돼요'}</p></div>`;
    ov.hidden = false;
    if (O.rk && score > 0) O.rk.done(CROSS_MAX - score, [score]).then(m => { const n = ov.querySelector('.bl-note'); if (n && m) n.textContent = 'Space·Enter로도 다시 · ' + m; });   // 사이트 기록실(2026-11-09)
    if (nb) S.tone(988, .1, 'square', .04, .1), S.tone(1319, .18, 'square', .04, .2);
  }
  function pause(on) {
    if (over || dying || !started || paused === on) return;
    paused = on; pzBtn.textContent = on ? '계속' : '멈춤';
    if (on) { pb.on(); queue = null; ov.innerHTML = `<div class="bl-card"><b class="bl-t">잠깐 멈춤</b>${pb.html()}<button type="button" class="btn big" data-cx-go>계속하기</button><p class="bl-note">Space·Enter로도 계속</p></div>`; ov.hidden = false; }
    else { pb.off(); ov.hidden = true; ov.innerHTML = ''; last = 0; }
  }

  // ── 시간 흐름 ──
  function step(dt) {
    t0 += dt; if (shake > 0) shake -= dt;
    for (const [r, L] of lanes) {
      if (r < cam - 6) { lanes.delete(r); continue; }
      if (L.objs && L.spd) for (const o of L.objs) {
        o.x += L.dir * L.spd * dt; if (o.bob > 0) o.bob -= dt;
        if (L.dir > 0 && o.x > XR) o.x -= SPAN; else if (L.dir < 0 && o.x + o.len < XL) o.x += SPAN;
      }
      if (L.type === 'rail') {
        const near = Math.abs(r - P.r) < 10 && !over;
        if (!L.train) {
          L.t -= dt; L.warn = L.t < 1.4;
          if (L.warn && near && (L.ding -= dt) <= 0) { L.ding = .32; S.tone(1480, .07, 'square', .022); }
          if (L.t <= 0) { const len = irnd(9, 13); L.train = { x: L.dir > 0 ? -len - 1 : COLS + 1, len }; if (near) S.noise(.5, .05, 0, 300); }
        } else {
          L.train.x += L.dir * 30 * dt;
          if ((L.dir > 0 && L.train.x > COLS + 2) || (L.dir < 0 && L.train.x + L.train.len < -2)) { L.train = null; L.warn = false; L.t = rnd(2.5, 6.5); }
        }
      }
    }
    if (dying) {
      dying -= dt;
      if (P.fly) { P.fly.vz -= 900 * dt; P.fly.z = Math.max(-40, P.fly.z + P.fly.vz * dt); P.px += P.fly.vx * dt; P.fly.rot += dt * 14; }
      if (P.dead === 'water') P.sink = Math.min(1, (P.sink || 0) + dt * 3);
      if (teach) teach.t += dt;
      if (dying <= 0) gameOver();
      return;
    }
    // 뛰는 중(통나무에서 옆으로 뛰면 통나무와 같이 흘러감)
    if (P.h >= 0) {
      if (P.hopLog) { const m = lane(P.r).dir * lane(P.r).spd * dt; P.fx += m; P.tx += m; }
      P.h += dt / HOP; if (P.h >= 1) land();
    }
    if (P.sq > 0) P.sq -= dt; if (P.bump > 0) P.bump -= dt;
    // 통나무 위
    if (P.h < 0 && P.log && !P.dead) {
      const L = lane(P.r); P.px += L.dir * L.spd * dt;
      if (P.px < .55 || P.px > COLS - .55) return die('water');
    }
    if (P.dead) return;
    // 부딪힘(뛰는 중엔 절반 넘으면 도착 줄 기준)
    const hr = P.h >= 0 ? (P.h > .5 ? P.tr : P.fr) : P.r, hx = P.h >= 0 ? P.fx + (P.tx - P.fx) * P.h : P.px;
    const L = lane(hr);
    if (L.type === 'road') { for (const o of L.objs) if (hx + .28 > o.x + .08 && hx - .28 < o.x + o.len - .08) { P.r = hr; P.px = hx; return die('car'); } }
    else if (L.type === 'rail' && L.train) { const o = L.train; if (hx + .3 > o.x && hx - .3 < o.x + o.len) { P.r = hr; P.px = hx; return die('train', L.dir); } }
    // 화면 따라오기: 학생을 아래에서 ANCHOR줄쯤에 두고, 출발하면 화면이 저절로 올라옴(점수 오를수록 빨라짐)
    if (started) {
      cam += (.36 + Math.min(.34, score * .0017)) * dt;   // 처음 0.36줄/초 → 200칸쯤부터 0.7줄/초(멈춰 있을 수 있는 시간 약 16초 → 8초)
      const tgt = (P.h >= 0 ? P.fr + (P.tr - P.fr) * P.h : P.r) - ANCHOR;
      if (tgt > cam) cam += (tgt - cam) * Math.min(1, dt * 5);
      if (P.h < 0 && P.r < cam - LATE) die('late');
    }
    lane(Math.ceil(cam) + 23);
  }

  // ── 그리기 도구 ──
  const yF = r => H - (r - cam + 1.6) * TD;   // 줄 r의 앞(아래) 끝 화면 y
  function quad(a, b, c, d, fill) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  // 상자: 땅 위 직사각형(x, yB~yB+d, 폭 w) · 높이 h · 바닥에서 z만큼 띄움 → 앞면·오른쪽 면·윗면
  function box(x, yB, w, d, h, z, col, line = true) {
    const x0 = x + z * HX, y0 = yB + z * HY, y1 = y0 + d, tx = h * HX, ty = h * HY;
    if (h > 0) {
      quad([x0, y1], [x0 + w, y1], [x0 + w + tx, y1 + ty], [x0 + tx, y1 + ty], col);
      quad([x0 + w, y1], [x0 + w, y0], [x0 + w + tx, y0 + ty], [x0 + w + tx, y1 + ty], shade(col, -.3));
    }
    quad([x0 + tx, y0 + ty], [x0 + w + tx, y0 + ty], [x0 + w + tx, y1 + ty], [x0 + tx, y1 + ty], shade(col, .2));
    if (line) {
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0 + w, y1); ctx.lineTo(x0 + w + tx, y1 + ty); ctx.lineTo(x0 + w + tx, y0 + ty); ctx.lineTo(x0 + tx, y0 + ty); ctx.lineTo(x0 + tx, y1 + ty); ctx.closePath();
      ctx.moveTo(x0 + tx, y1 + ty); ctx.lineTo(x0 + w + tx, y1 + ty); ctx.moveTo(x0 + w, y1); ctx.lineTo(x0 + w + tx, y1 + ty);
      ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
    }
    return { x0, y0, y1, w, d, tx, ty, h };
  }
  // 앞면 위 칸: 가로 u0~u1(0~1), 세로 v0~v1(아래 0 ~ 위 1)
  function face(b, u0, u1, v0, v1, col) { const p = (u, v) => [b.x0 + b.w * u + b.tx * v, b.y1 + b.ty * v]; quad(p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1), col); }
  // 윗면 위 칸: 가로 u0~u1, 깊이 v0~v1(뒤 0 ~ 앞 1)
  function top(b, u0, u1, v0, v1, col) { const p = (u, v) => [b.x0 + b.tx + b.w * u, b.y0 + b.ty + b.d * v]; quad(p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1), col); }
  const shadow = (x, yB, w, d, a = .16) => { ctx.fillStyle = `rgba(20,30,60,${a})`; ctx.fillRect(x + 5, yB + 3, w, d); };

  // ── 땅 ──
  function ground(r, L, y) {
    const yb = y - TD, up = lane(r + 1), dn = lane(r - 1);
    if (L.type === 'grass') {
      ctx.fillStyle = L.alt ? '#a6e36f' : '#9bdb63'; ctx.fillRect(0, yb, W, TD);
      for (const g of L.deco) {
        const x = g.x * T, yy = yb + g.y * TD;
        if (g.k === 'f') { ctx.fillStyle = '#5aa84a'; ctx.fillRect(x + 1, yy, 2, 4); ctx.fillStyle = g.c; ctx.fillRect(x - 1, yy - 3, 6, 4); }
        else { ctx.fillStyle = '#82c855'; ctx.fillRect(x, yy, 3, 3); ctx.fillRect(x + 4, yy - 1, 3, 4); ctx.fillRect(x + 8, yy + 1, 3, 2); }
      }
    } else if (L.type === 'road') {
      ctx.fillStyle = '#5d6272'; ctx.fillRect(0, yb, W, TD);
      if (up.type === 'road') { ctx.fillStyle = up.dir === L.dir ? 'rgba(255,255,255,.75)' : '#ffd25e'; if (up.dir === L.dir) for (let x = 6; x < W; x += 48) ctx.fillRect(x, yb - 1.5, 24, 3); else { ctx.fillRect(0, yb - 3, W, 2); ctx.fillRect(0, yb + 1, W, 2); } }
      else { ctx.fillStyle = '#c9ced8'; ctx.fillRect(0, yb - 2, W, 4); }
      if (dn.type !== 'road') { ctx.fillStyle = '#c9ced8'; ctx.fillRect(0, y - 3, W, 4); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(0, y - 6, W, 3); }
      if (L.cw > 0) { ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let k = 0; k < 3; k++) ctx.fillRect(L.cw * T + 4, yb + 5 + k * 9.5, T * 2 - 8, 5); }
    } else if (L.type === 'river') {
      ctx.fillStyle = '#5ac4f5'; ctx.fillRect(0, yb, W, TD);
      const off = ((t0 * 26 * (L.dir || 1)) % 96 + 96) % 96;
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let x = -96 + off + (r % 3) * 30; x < W; x += 96) { ctx.fillRect(x, yb + 9 + (r % 2) * 9, 20, 2.5); ctx.fillRect(x + 42, yb + 20 - (r % 2) * 7, 12, 2.5); }
      if (up.type !== 'river') { ctx.fillStyle = '#3d9ad4'; ctx.fillRect(0, yb, W, 6); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, yb + 6, W, 1.5); }
      if (dn.type !== 'river') { ctx.fillStyle = '#7a6a52'; ctx.fillRect(0, y - 2, W, 3); }
    } else {
      ctx.fillStyle = '#b9a690'; ctx.fillRect(0, yb, W, TD);
      ctx.fillStyle = '#a8957f'; for (let x = 3; x < W; x += 11) ctx.fillRect(x, yb + ((x * 7) % 26) + 3, 3, 2);
      ctx.fillStyle = '#7d5c41'; for (let x = 4; x < W; x += 16) ctx.fillRect(x, yb + 5, 7, TD - 10);
      ctx.fillStyle = '#9aa3b5'; ctx.fillRect(0, yb + 9, W, 3); ctx.fillRect(0, y - 12, W, 3);
      ctx.fillStyle = '#dfe4ee'; ctx.fillRect(0, yb + 9, W, 1); ctx.fillRect(0, y - 12, W, 1);
      if (L.warn && !L.train) { ctx.fillStyle = `rgba(255,59,59,${.1 + .1 * Math.sin(t0 * 20)})`; ctx.fillRect(0, yb, W, TD); }
    }
  }

  // ── 물건 ──
  function tree(c, yb, kind) {
    const x = c * T;
    if (kind === 'bush') { shadow(x + 6, yb + 5, T - 12, TD - 10); const b = box(x + 6, yb + 5, T - 12, TD - 10, 22, 0, '#4fbf5a'); top(b, .15, .35, .2, .5, '#7be07c'); return; }
    if (kind === 'rock') { shadow(x + 9, yb + 7, T - 18, TD - 14); const b = box(x + 9, yb + 7, T - 18, TD - 14, 16, 0, '#a7adbb'); top(b, .2, .5, .2, .55, '#cdd2dc'); return; }
    shadow(x + 8, yb + 4, T - 16, TD - 8, .2);
    box(x + 19, yb + 13, 10, 8, 16, 0, '#9a6a3c');
    if (kind === 'pine') {
      box(x + 6, yb + 4, T - 12, TD - 8, 18, 14, '#2f9a55');
      box(x + 11, yb + 8, T - 22, TD - 16, 16, 32, '#38ad60');
      box(x + 17, yb + 12, T - 34, TD - 24, 12, 48, '#46c06c');
    } else {
      const b = box(x + 7, yb + 5, T - 14, TD - 10, 30, 16, '#3fae5a'); face(b, .12, .3, .45, .7, '#58c56d');
      const t2 = box(x + 13, yb + 9, T - 26, TD - 18, 10, 46, '#5ccf6a'); top(t2, .1, .45, .1, .5, '#86e48a');
    }
  }
  function vehicle(o, dir, yb) {
    const x = o.x * T + 2, w = o.len * T - 4, d = TD - 10, y = yb + 5, lead = dir > 0;
    shadow(x, y, w, d);
    const wheel = u => box(x + w * u - 5, y + d - 4, 10, 4, 8, 0, '#2a2846', false);
    if (o.v === 'bike') {   // 배달 오토바이: 바퀴 2·몸통·배달 상자·헬멧 쓴 사람
      wheel(.2); wheel(.8);
      box(x + w * .15, y + 6, w * .7, d - 12, 8, 6, '#ff6b6b');
      const bx = lead ? x + 2 : x + w - 18; const bb = box(bx, y + 3, 16, d - 6, 16, 12, '#f3f5fa'); face(bb, .1, .9, .35, .65, '#ff6b6b');
      const rx = lead ? x + w * .5 : x + w * .25; box(rx, y + 6, 12, d - 12, 12, 12, '#34407a'); box(rx, y + 5, 12, d - 10, 9, 24, '#ffd25e');
      return;
    }
    wheel(.18); wheel(.82);
    const lights = b => { face(b, lead ? .9 : 0, lead ? 1 : .1, .35, .75, '#fff3a8'); face(b, lead ? 0 : .92, lead ? .08 : 1, .35, .75, '#ff4d4d'); };
    if (o.v === 'car' || o.v === 'taxi') {
      const b = box(x, y, w, d, 15, 4, o.col); lights(b);
      const c = box(x + w * (lead ? .18 : .3), y + 2, w * .52, d - 4, 13, 19, shade(o.col, .08));
      face(c, .08, .46, .18, .84, '#2c3a66'); face(c, .54, .92, .18, .84, '#2c3a66');
      if (o.v === 'taxi') { const s = box(x + w * .43, y + 8, 14, 7, 6, 32, '#ffffff'); face(s, .1, .9, .2, .8, '#ffb43d'); }
    } else if (o.v === 'truck') {
      const cwid = w * .3, cab = lead ? x + w - cwid : x;
      const c = box(cab, y, cwid, d, 27, 4, o.col); face(c, lead ? .35 : .05, lead ? .95 : .65, .5, .88, '#2c3a66'); face(c, lead ? .85 : 0, lead ? 1 : .15, .15, .35, '#fff3a8');
      const k = box(lead ? x : x + cwid + 2, y - 2, w - cwid - 2, d + 2, 34, 4, o.cargo); face(k, .05, .95, .3, .42, shade(o.cargo, -.25));
    } else {   // 학원 버스
      const b = box(x, y - 2, w, d + 2, 31, 4, '#ffcc3d');
      for (let u = lead ? .05 : .2; u < (lead ? .8 : .95); u += .15) face(b, u, u + .1, .5, .86, '#2c3a66');
      face(b, lead ? .86 : .02, lead ? .98 : .14, .45, .9, '#2c3a66');
      face(b, 0, 1, .22, .3, '#2a2846'); lights(b);
      top(b, .3, .7, .25, .75, shade('#ffcc3d', .3));
    }
  }
  function train(o, dir, yb) {
    const d = TD - 8, y = yb + 4, CAR = 4, n = Math.ceil(o.len / CAR);
    shadow(o.x * T, y, o.len * T, d, .22);
    for (let i = 0; i < n; i++) {
      const cx0 = o.x + i * CAR, len = Math.min(CAR, o.len - i * CAR), x = cx0 * T + (i ? 3 : 0), w = len * T - (i ? 3 : 0);
      const b = box(x, y, w, d, 40, 3, '#e8ecf3');
      face(b, 0, 1, .2, .3, '#8b5cd6'); face(b, 0, 1, .92, 1, '#c9cfdc');
      const isFront = dir > 0 ? i === n - 1 : i === 0;
      for (let u = .07; u < .9; u += .19) face(b, u, u + .12, .48, .84, '#2c3a66');
      if (isFront) { face(b, dir > 0 ? .9 : .02, dir > 0 ? .98 : .1, .45, .86, '#5a6a9a'); face(b, dir > 0 ? .93 : .02, dir > 0 ? 1 : .09, .06, .18, '#fff3a8'); }
      top(b, .15, .35, .3, .7, '#c9cfdc'); top(b, .62, .82, .3, .7, '#c9cfdc');
    }
  }
  function signal(L, yb) {
    const x = 10 * T + 18, on = L.warn && (t0 * 6 | 0) % 2;
    box(x, yb + 10, 5, 5, 54, 0, '#6a6f80');
    const b = box(x - 7, yb + 9, 19, 5, 13, 38, '#2a2846');
    face(b, .08, .44, .18, .82, L.warn && on ? '#ff3b3b' : '#5a2a2a'); face(b, .56, .92, .18, .82, L.warn && !on ? '#ff3b3b' : '#5a2a2a');
    const s = box(x - 9, yb + 10, 23, 3, 7, 56, '#ffffff'); face(s, .2, .8, .2, .8, '#ff4d4d');
  }
  function flat(o, yb) {
    const bob = o.bob > 0 ? Math.sin(o.bob * 12) * 2 : 0;
    if (o.v === 'lily') { const b = box(o.x * T + 6, yb + 5 + bob, T - 12, TD - 10, 3, 0, '#4fbf5a'); top(b, .45, .55, 0, .45, '#3a9a48'); return; }
    const b = box(o.x * T + 2, yb + 6 + bob, o.len * T - 4, TD - 12, 10, 0, '#a8703f');
    face(b, 0, 1, .3, .45, '#8a5a30'); top(b, 0, 1, .4, .5, '#bd8550');
    const e = b.x0 + b.w; quad([e, b.y1], [e, b.y0], [e + b.tx, b.y0 + b.ty], [e + b.tx, b.y1 + b.ty], '#e0b07a');
  }
  // 학생(공용 캐릭터를 블록으로): 신발·다리·몸·팔·머리·머리카락·소품, 보는 방향마다 앞면이 달라짐
  function student(px, yb, z, sy, sx, alpha = 1, fc = P.face, LK = look) {
    const w = 30 * sx, d = 18, x = px * T - w / 2, y = yb + (TD - d) / 2, k = sy * 1.12;
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (z > -1) shadow(x - 3, y + 1, w, d, .18 * Math.max(0, 1 - z / 40));
    box(x + 4 * sx, y + 3, 8 * sx, d - 6, 4 * k, z, LK.shoe); box(x + w - 12 * sx, y + 3, 8 * sx, d - 6, 4 * k, z, LK.shoe);
    if (LK.botK === 'skirt') { box(x + 5 * sx, y + 4, 6 * sx, d - 8, 5 * k, z + 4 * k, LK.skin, false); box(x + w - 11 * sx, y + 4, 6 * sx, d - 8, 5 * k, z + 4 * k, LK.skin, false); box(x + 2 * sx, y + 1, w - 4 * sx, d - 2, 6 * k, z + 9 * k, LK.bot); }
    else if (LK.botK === 'shorts') { box(x + 5 * sx, y + 4, w - 10 * sx, d - 8, 4 * k, z + 4 * k, LK.skin, false); box(x + 4 * sx, y + 3, w - 8 * sx, d - 6, 6 * k, z + 8 * k, LK.bot); }
    else box(x + 4 * sx, y + 3, w - 8 * sx, d - 6, 10 * k, z + 4 * k, LK.bot);
    const tz = z + 14 * k;
    box(x - 2 * sx, y + 5, 5 * sx, d - 10, 12 * k, tz - 1 * k, LK.top);                              // 왼팔
    if (LK.bag && fc !== 'down') box(x + 4 * sx, y - 4, w - 8 * sx, 6, 12 * k, tz, LK.bag, true);   // 등 가방(뒤쪽)
    const body = box(x + 2 * sx, y + 1, w - 4 * sx, d - 2, 14 * k, tz, LK.top);
    if (fc === 'down' || fc === 'left' || fc === 'right') {
      if (LK.topK === 'blazer') { face(body, .4, .6, .1, 1, '#ffffff'); face(body, .46, .54, .3, .9, '#e4594d'); }
      else if (LK.topK === 'track') face(body, .46, .54, 0, 1, '#ffffff');
      else if (LK.topK === 'hoodie') face(body, .3, .7, .15, .4, shade(LK.top, -.15));
    } else if (LK.bag) { const bg = box(x + 6 * sx, y + d - 3, w - 12 * sx, 5, 11 * k, tz + 1 * k, LK.bag); face(bg, .2, .8, .55, .7, shade(LK.bag, -.25)); }
    if (LK.topK === 'track') { face(body, 0, .08, 0, 1, '#ffffff'); face(body, .92, 1, 0, 1, '#ffffff'); }
    box(x + w - 3 * sx, y + 5, 5 * sx, d - 10, 12 * k, tz - 1 * k, LK.top);                         // 오른팔
    box(x - 2 * sx, y + 6, 5 * sx, d - 12, 3 * k, tz - 4 * k, LK.skin, false); box(x + w - 3 * sx, y + 6, 5 * sx, d - 12, 3 * k, tz - 4 * k, LK.skin, false);
    const hz = tz + 14 * k, hw = 24 * sx, hx = x + (w - hw) / 2;
    if ((LK.hs === 'long' || LK.hs === 'pony' || LK.hs === 'bob') && fc !== 'up') box(hx - 1, y - 2, hw + 2, 5, (LK.hs === 'long' ? 20 : 12) * k, hz + (LK.hs === 'long' ? -8 : 2) * k, LK.hair);
    const head = box(hx, y, hw, d, 19 * k, hz, LK.skin);
    // 머리카락
    const hh = LK.hs === 'buzz' ? 2 : 5;
    box(hx - 1, y - 1, hw + 2, fc === 'up' ? d + 2 : d * .6, hh * k, hz + 19 * k, LK.hair);
    if (LK.hs === 'spike') for (const u of [.15, .45, .75]) box(hx + hw * u, y + 3, 5, 5, 5 * k, hz + (19 + hh) * k, LK.hair, false);
    if (LK.hs === 'pony') box(hx + hw / 2 - 4, y - 7, 8, 6, 9 * k, hz + 8 * k, LK.hair);
    if (fc === 'up') {
      face(head, 0, 1, LK.hs === 'buzz' ? .6 : 0, 1, LK.hair);
      if (LK.hs === 'long') { const lb = box(hx, y + d - 1, hw, 3, 14 * k, hz - 4 * k, LK.hair, false); void lb; }
    } else if (k > .4) {
      if (LK.hs !== 'buzz') face(head, 0, 1, .74, 1, LK.hair);
      const eye = u => face(head, u, u + .11, .34, .56, '#2a2846');
      const side = fc === 'left' ? -1 : fc === 'right' ? 1 : 0;
      if (side === 0) {
        eye(.24); eye(.65);
        if (LK.face === 'blush') { face(head, .1, .24, .2, .3, '#ff9fb4'); face(head, .76, .9, .2, .3, '#ff9fb4'); }
        if (LK.face === 'glasses') { face(head, .18, .4, .3, .33, '#2a2846'); face(head, .58, .8, .3, .33, '#2a2846'); face(head, .18, .8, .56, .6, '#2a2846'); }
        if (LK.face === 'shades') face(head, .14, .86, .3, .58, '#20202a');
        if (LK.face === 'band') face(head, .62, .82, .14, .24, '#ffd9a0');
        face(head, .42, .58, .14, .2, '#c85a5a');
      } else {
        const u = side < 0 ? .1 : .79; eye(u);
        if (LK.face === 'glasses' || LK.face === 'shades') face(head, side < 0 ? 0 : .7, side < 0 ? .3 : 1, LK.face === 'shades' ? .3 : .52, .58, '#2a2846');
        face(head, side < 0 ? .55 : 0, side < 0 ? 1 : .45, .1, .74, LK.hair);   // 옆모습: 뒤통수 쪽 머리카락
      }
    }
    // 머리 소품
    const az = hz + (19 + hh) * k;
    if (LK.hat === 'cap') { box(hx - 1, y - 1, hw + 2, d + 1, 6 * k, az - 3 * k, '#3d7bff'); const bz = fc === 'up' ? y - 7 : fc === 'down' ? y + d - 2 : y + 3; const bx = fc === 'left' ? hx - 9 : fc === 'right' ? hx + hw - 1 : hx + 3; box(bx, bz, fc === 'left' || fc === 'right' ? 10 : hw - 6, fc === 'left' || fc === 'right' ? d - 6 : 8, 2 * k, az - 3 * k, '#2f62d6'); }
    else if (LK.hat === 'beanie') { box(hx - 1, y - 1, hw + 2, d + 2, 9 * k, az - 5 * k, '#ff6b6b'); box(hx + hw / 2 - 3, y + d / 2 - 3, 6, 6, 4 * k, az + 4 * k, '#ffffff', false); }
    else if (LK.hat === 'phones') { box(hx - 4, y + 4, 4, d - 8, 10 * k, hz + 6 * k, '#2a2846'); box(hx + hw, y + 4, 4, d - 8, 10 * k, hz + 6 * k, '#2a2846'); box(hx, y + d / 2 - 2, hw, 4, 2 * k, az, '#2a2846', false); }
    else if (LK.hat === 'ribbon') { box(hx + hw * .55, y + 2, 12, 6, 6 * k, az - 2 * k, '#ff6fa0'); }
    else if (LK.hat === 'band') { box(hx - 1, y + 4, hw + 2, 4, 2 * k, az - 1 * k, '#ffd25e', false); }
    ctx.globalAlpha = 1;
  }
  const TEACH = { skin: '#f7caa1', hair: '#c9cfdc', top: '#7a5a3c', bot: '#3b3b49', shoe: '#3b3b49', bag: '', hs: 'short', topK: 'blazer', botK: 'pants', hat: '', face: 'glasses' };

  function draw() {
    const s = scale * dpr; ctx.setTransform(s, 0, 0, s, 0, 0);
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 14, rnd(-1, 1) * shake * 10);
    ctx.fillStyle = '#9bdb63'; ctx.fillRect(-20, -20, W + 40, H + 40);
    const r0 = Math.floor(cam) - 2, r1 = Math.ceil(cam) + 21;
    for (let r = r1; r >= r0; r--) ground(r, lane(r), yF(r));
    const hop = P.h >= 0 ? P.h : -1;
    const pr = hop >= 0 ? (hop > .5 ? P.tr : P.fr) : P.r;
    for (let r = r1; r >= r0; r--) {
      const L = lane(r), yb = yF(r) - TD;
      if (L.type === 'river') { if (L.stones) for (const c of L.stones) { const b = box(c * T + 7, yb + 6, T - 14, TD - 12, 7, 0, '#c9ced8'); top(b, .15, .45, .2, .6, '#e4e8ef'); } else for (const o of L.objs) flat(o, yb); }
      const items = [];
      if (L.type === 'grass') for (const c of L.tree) items.push([c + .5, () => tree(c, yb, L.kind[c])]);
      else if (L.type === 'road') for (const o of L.objs) items.push([o.x + o.len / 2, () => vehicle(o, L.dir, yb)]);
      else if (L.type === 'rail') items.push([10.5, () => signal(L, yb)]);
      if (r === pr && !(P.dead === 'water' && (P.sink || 0) >= 1)) {
        const px = hop >= 0 ? P.fx + (P.tx - P.fx) * hop : P.px;
        const rowOff = hop >= 0 ? P.fr + (P.tr - P.fr) * hop - pr : 0;
        let z = hop >= 0 ? Math.sin(hop * Math.PI) * 16 : 0, sy = P.sq > 0 ? 1 - P.sq * 1.8 : hop >= 0 ? 1.06 : 1, sx = 1, a = 1;
        let ex = P.bump > 0 ? Math.sin(P.bump * 60) * 2 : 0;
        if (P.dead === 'car') { sy = .18; sx = 1.3; z = 0; }
        if (P.fly) { z = Math.max(0, P.fly.z); ex = 0; }
        if (P.dead === 'water') { z = -(P.sink || 0) * 30; a = 1 - (P.sink || 0); }
        const onLog = P.log && hop < 0 ? 10 + (P.log.bob > 0 ? Math.sin(P.log.bob * 12) * 2 : 0) : 0;
        items.push([px, () => student(px + ex / T, yb - rowOff * TD, z + onLog, sy, sx, a)]);
      }
      items.sort((a, b) => a[0] - b[0]); for (const it of items) it[1]();
      if (L.type === 'rail' && L.train) train(L.train, L.dir, yb);
    }
    // 물보라·별
    for (const p of fx) { ctx.globalAlpha = Math.max(0, p.life / .6); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2 + p.z * HX, yF(p.r) - TD / 2 + p.z * HY - p.s / 2, p.s, p.s); }
    ctx.globalAlpha = 1;
    if (P.dead === 'water' && dying > 0) { const t = 1 - dying, yy = yF(P.r) - TD / 2; ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, .9 - t)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(P.px * T, yy, 10 + t * 30, 4 + t * 10, 0, 0, 7); ctx.stroke(); }
    // 선생님(지각): 화면 아래에서 올라와 학생 옆에 섬
    if (teach) {
      const k = Math.min(1, teach.t / .55), e = 1 - (1 - k) ** 3, rr = (cam - 2.5) + (P.r - .9 - (cam - 2.5)) * e;
      student(teach.x, yF(rr) - TD, 0, 1.08, 1.05, 1, 'up', TEACH);
      if (k >= 1) { const bx = teach.x * T + 22, by = yF(rr) - TD - 92; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a2846'; ctx.lineWidth = 2.5; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, 86, 30, 12); else ctx.rect(bx, by, 86, 30); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2a2846'; ctx.font = '400 17px Jua, Pretendard, sans-serif'; ctx.fillText('지각이야!', bx + 8, by + 21); }
    }
    // 벽 밖 칸(0·10번) 어둡게
    ctx.fillStyle = 'rgba(20,24,60,.26)'; ctx.fillRect(-20, -20, T + 20, H + 40); ctx.fillRect(10 * T, -20, T + 20, H + 40);
    // 지각 경고(화면 아래가 학생에게 다가올 때)
    if (started && !P.dead) {
      const gap = P.r - cam + LATE; if (gap < 2.6) { const a = Math.min(.42, (2.6 - gap) * .22) * (.6 + .4 * Math.sin(t0 * 10)); const g = ctx.createLinearGradient(0, H - 110, 0, H); g.addColorStop(0, 'rgba(255,59,59,0)'); g.addColorStop(1, `rgba(255,59,59,${a})`); ctx.fillStyle = g; ctx.fillRect(0, H - 110, W, 110); }
    }
    hud();
  }
  function hud() {
    ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.textAlign = 'left';
    ctx.font = '400 46px Jua, Pretendard, sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#2a2846';
    ctx.strokeText(score, 62, 60); ctx.fillStyle = '#fff'; ctx.fillText(score, 62, 60);
    ctx.font = '800 13px Pretendard, sans-serif'; ctx.lineWidth = 4; const bt = '최고 ' + best.toLocaleString(); ctx.strokeText(bt, 64, 82); ctx.fillStyle = '#ffd25e'; ctx.fillText(bt, 64, 82);
    ctx.textAlign = 'center';
    if (!started && !over) {
      const bob = Math.sin(performance.now() / 380) * 4;
      ctx.font = '400 54px Jua, Pretendard, sans-serif'; ctx.lineWidth = 10; ctx.strokeText('지각 직전!', W / 2, 200 + bob); ctx.fillStyle = '#ffd25e'; ctx.fillText('지각 직전!', W / 2, 200 + bob);
      ctx.font = '800 16px Pretendard, sans-serif'; ctx.lineWidth = 5; ctx.fillStyle = '#fff';
      ctx.strokeText('길을 건너 앞으로! 멈춰 있으면 지각이에요', W / 2, 236); ctx.fillText('길을 건너 앞으로! 멈춰 있으면 지각이에요', W / 2, 236);
      ctx.globalAlpha = .55 + .45 * (Math.sin(performance.now() / 260) + 1) / 2;
      ctx.font = '800 17px Pretendard, sans-serif'; ctx.strokeText('↑ 키나 화면을 눌러 출발', W / 2, 268); ctx.fillStyle = '#ffffff'; ctx.fillText('↑ 키나 화면을 눌러 출발', W / 2, 268); ctx.globalAlpha = 1;
    }
    if (msg) { const k = Math.min(1, msg.t / .4), sc = 1 + Math.max(0, msg.t - 1.1) * 1.5; ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, 150); ctx.scale(sc, sc); ctx.font = '400 40px Jua, Pretendard, sans-serif'; ctx.lineWidth = 8; ctx.strokeText(msg.text, 0, 0); ctx.fillStyle = '#ffd25e'; ctx.fillText(msg.text, 0, 0); ctx.restore(); }
    if (P.dead === 'late' && teach && teach.t > .55) { const k = Math.min(1, (teach.t - .55) / .25); ctx.save(); ctx.translate(W / 2, H / 2 - 40); ctx.scale(.6 + .4 * k, .6 + .4 * k); ctx.font = '400 72px Jua, Pretendard, sans-serif'; ctx.lineWidth = 11; ctx.strokeText('지각!', 0, 0); ctx.fillStyle = '#ff4d4d'; ctx.fillText('지각!', 0, 0); ctx.restore(); }
    ctx.textAlign = 'left';
  }

  function frame(t) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    fit();
    const dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    if (paused) { pb.paint(); if (pb.out()) { paused = false; pzBtn.textContent = '멈춤'; P.dead = 'pause'; pauseOutMsg(); gameOver(); } return; }
    if (!over) step(dt);
    for (const p of fx) { p.life -= dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= 700 * dt; }
    fx = fx.filter(p => p.life > 0); if (msg && (msg.t -= dt) <= 0) msg = null;
    draw();
  }

  // ── 입력 ──
  const typing = e => e.target.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('.modal.open');
  const KEYS = { ArrowUp: [0, 1], KeyW: [0, 1], Space: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  const kd = e => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || !el.isConnected || el.querySelector('.cx.dressing')) return;
    if (paused) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyP')) { e.preventDefault(); pause(false); } return; }
    if (over) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); reset(); } return; }
    const k = KEYS[e.code];
    if (k) { e.preventDefault(); if (!e.repeat) move(k[0], k[1]); }
    else if (e.code === 'KeyP' || e.code === 'Escape') pause(true);
  };
  let sx = 0, sy = 0, down = false;
  const pd = e => { if (over) return; down = true; sx = e.clientX; sy = e.clientY; cv.setPointerCapture?.(e.pointerId); e.preventDefault(); };
  const pu = e => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < 22) move(0, 1);
    else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy < 0 ? 1 : -1);
  };
  cv.addEventListener('pointerdown', pd); cv.addEventListener('pointerup', pu); cv.addEventListener('pointercancel', () => { down = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const vis = () => { if (document.hidden) pause(true); };
  const blur = () => pause(true);
  pzBtn.onclick = () => { pzBtn.blur(); pause(!paused); };
  ov.addEventListener('click', e => { if (e.target.closest('[data-cx-again]')) reset(); else if (e.target.closest('[data-cx-go]')) pause(false); });
  addEventListener('keydown', kd); document.addEventListener('visibilitychange', vis); addEventListener('blur', blur);

  reset();
  return {
    start() { fit(); raf = requestAnimationFrame(frame); },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('keydown', kd); document.removeEventListener('visibilitychange', vis); removeEventListener('blur', blur);
    },
    setChar(c) { look = lookOf(c, O.opts); },
    get busy() { return started && !over; },
    get dbg() { return { lane, P, cam, move }; },   // 검사 봇용
    get state() { return { score, r: P.r, px: P.px, over, dead: P.dead, cam, started, paused }; },   // 검사용
  };
}
