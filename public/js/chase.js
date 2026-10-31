// SVMHS GROUND — 카체이싱! 화면 (2026-10-31 하율 "다함께 차차차처럼 — 플레이 방식까지 최대한 비슷하게, 바로 출시해도 될 정도로", 미리보기 깃발 chase-game)
// 규칙·판 진행은 chase-score.js(서버와 같음) — 여기는 그리기·입력·소리만. 판에 영향을 주는 값은 전부 시뮬레이션(s)에서 읽음.
// 위에서 본 도로: ←→로 차선 사이를 누비고(칼치기) Space로 점프. 차 옆을 아슬아슬하게 스치면 콤보·부스터 게이지, 연료통으로 기름 보충.
// 입력은 1/60초 프레임마다 시뮬레이션에 넣으며 그대로 기록(rounds) → 서버가 같은 판을 다시 돌려 점수를 확인.
import * as C from './chase-score.js';

const INK = '#2a2846';
const TRAFFIC = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa', '#f783ac', '#f1f3f5'];
const FONT = '"Jua", "Pretendard Variable", system-ui, sans-serif';
const fmt = n => Math.floor(n).toLocaleString('ko-KR');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TOUCHY = () => matchMedia('(pointer:coarse)').matches;
const RM = () => matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ===== 소리(Web Audio 합성, 기본 꺼짐) ===== */
function makeSfx() {
  let ac = null, on = false, eng = null;
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } if (ac?.state === 'suspended') ac.resume().catch(() => {}); return ac; };
  const tone = (f, d, type = 'square', v = 0.06, f2 = 0, delay = 0) => {
    if (!on) return; const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  };
  const noise = (d, v = 0.08, f = 1200, f2 = 0) => {
    if (!on) return; const a = ctx(); if (!a) return;
    const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
    s.buffer = b; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.value = v; s.connect(fl).connect(g).connect(a.destination); s.start();
  };
  const engine = v => {   // 엔진 소리: 속도에 따라 낮게 웅웅
    if (!on || v <= 0) { if (eng) { try { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); } catch {} } return; }
    const a = ctx(); if (!a) return;
    if (!eng) {
      const o = a.createOscillator(), o2 = a.createOscillator(), fl = a.createBiquadFilter(), g = a.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; fl.type = 'lowpass'; fl.frequency.value = 420; g.gain.value = 0;
      o.connect(fl); o2.connect(fl); fl.connect(g).connect(a.destination); o.start(); o2.start();
      eng = { o, o2, g };
    }
    const f = 38 + v * 0.085, t = a.currentTime;
    eng.o.frequency.setTargetAtTime(f, t, 0.08); eng.o2.frequency.setTargetAtTime(f * 0.502, t, 0.08); eng.g.gain.setTargetAtTime(0.022, t, 0.1);
  };
  const stopEngine = () => { if (eng) { try { eng.o.stop(); eng.o2.stop(); } catch {} eng = null; } };
  return {
    get on() { return on; }, set(v) { on = v; if (!v) stopEngine(); else ctx(); }, unlock: () => { if (on) ctx(); },
    engine, stopEngine,
    near: c => { const p = Math.min(c, 10); tone(660 + p * 60, 0.06, 'square', 0.05); tone(990 + p * 80, 0.09, 'square', 0.05, 0, 0.07); },
    coin: () => { tone(1320, 0.05, 'square', 0.035); tone(1760, 0.08, 'square', 0.035, 0, 0.04); },
    fuel: () => { tone(330, 0.12, 'triangle', 0.08, 660); tone(500, 0.12, 'triangle', 0.06, 990, 0.08); },
    box: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, 'square', 0.04, 0, i * 0.05)); },
    boost: () => { noise(0.6, 0.12, 400, 4000); tone(220, 0.5, 'sawtooth', 0.04, 880); },
    jump: () => tone(300, 0.18, 'square', 0.04, 720),
    land: () => noise(0.08, 0.08, 500),
    smash: () => { noise(0.18, 0.14, 2200, 300); tone(160, 0.12, 'square', 0.05, 60); },
    crash: () => { noise(0.7, 0.22, 3000, 120); tone(110, 0.4, 'sawtooth', 0.08, 40); },
    beep: hi => tone(hi ? 880 : 440, hi ? 0.35 : 0.14, 'square', 0.06),
    warn: () => { tone(740, 0.08, 'square', 0.04); tone(740, 0.08, 'square', 0.04, 0, 0.14); },
    empty: () => tone(200, 0.5, 'triangle', 0.07, 90),
    stop: () => noise(0.5, 0.05, 600, 100),
  };
}

/* ===== 그림(스티커 느낌: 흰 칼선 + 잉크 외곽) — 크기별로 한 번 그려 두고 찍음 ===== */
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function shade(hex, k) {   // k < 0 어둡게 · > 0 밝게
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255;
  const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return '#' + ((1 << 24) | (f(r) << 16) | (f(gg) << 8) | f(b)).toString(16).slice(1);
}
// 차 한 대(가운데 기준, 위가 앞). w·h = 그림 크기
function carArt(g, kind, col, w, h, opt = {}) {
  const x = -w / 2, y = -h / 2;
  g.lineJoin = 'round';
  // 칼선(흰색) + 그림자
  g.fillStyle = 'rgba(20,18,50,.28)'; rr(g, x + 3, y + 5, w, h, 9); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 6; rr(g, x, y, w, h, kind === 'bus' || kind === 'truck' ? 7 : 10); g.stroke();
  const body = kind === 'taxi' ? '#ffd43b' : kind === 'bus' ? '#4cc38a' : col;
  // 바퀴
  g.fillStyle = INK;
  const wy = [y + h * 0.17, y + h * 0.72], wh = Math.max(7, h * 0.13);
  for (const yy of wy) { rr(g, x - 3, yy, 5, wh, 2); g.fill(); rr(g, x + w - 2, yy, 5, wh, 2); g.fill(); }
  if (kind === 'truck') {
    // 짐칸 + 운전석
    const cab = h * 0.3;
    g.fillStyle = '#e9ecef'; rr(g, x, y + cab + 3, w, h - cab - 3, 5); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(42,40,70,.25)'; g.lineWidth = 1.5; for (let i = 1; i < 4; i++) { const yy = y + cab + 3 + (h - cab - 3) * i / 4; g.beginPath(); g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); g.stroke(); }
    g.fillStyle = body; rr(g, x + 1, y, w - 2, cab, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#bfe3ff'; rr(g, x + 4, y + 4, w - 8, cab * 0.42, 3); g.fill(); g.lineWidth = 1.4; g.stroke();
  } else {
    const grd = g.createLinearGradient(x, 0, x + w, 0); grd.addColorStop(0, shade(body, 0.18)); grd.addColorStop(0.5, body); grd.addColorStop(1, shade(body, -0.16));
    g.fillStyle = grd; rr(g, x, y, w, h, kind === 'bus' ? 7 : 10); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    if (kind === 'bus') {
      g.fillStyle = '#bfe3ff'; rr(g, x + 4, y + 5, w - 8, 12, 3); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = shade(body, -0.25); for (let i = 0; i < 4; i++) { rr(g, x + 5, y + 24 + i * ((h - 34) / 4), w - 10, (h - 34) / 4 - 4, 2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, x + 7, y + 26, 4, h - 40, 2); g.fill();
    } else {
      const ws = kind === 'van' ? 0.16 : 0.24, wsY = y + h * (kind === 'van' ? 0.1 : 0.2);
      g.fillStyle = '#bfe3ff'; rr(g, x + 4, wsY, w - 8, h * ws, 4); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(x + 7, wsY + 2); g.lineTo(x + 12, wsY + 2); g.lineTo(x + 8, wsY + h * ws - 2); g.lineTo(x + 6, wsY + h * ws - 2); g.closePath(); g.fill();
      // 지붕
      const ry = wsY + h * ws + 2, rh = h * (kind === 'van' ? 0.5 : kind === 'mini' ? 0.26 : 0.3);
      g.fillStyle = shade(body, 0.12); rr(g, x + 5, ry, w - 10, rh, 5); g.fill(); g.strokeStyle = 'rgba(42,40,70,.35)'; g.lineWidth = 1.2; g.stroke();
      // 뒷유리
      g.fillStyle = '#9fcff5'; rr(g, x + 5, ry + rh + 2, w - 10, h * 0.11, 3); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      if (kind === 'taxi') { g.fillStyle = '#fff'; rr(g, -8, ry + rh / 2 - 4, 16, 8, 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke(); g.fillStyle = INK; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TAXI', 0, ry + rh / 2 + 0.3); }
      if (opt.player) {   // 내 차: 가운데 흰 줄 두 개 + 별
        g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, -6, y + 1, 4, h - 2, 1); g.fill(); rr(g, 2, y + 1, 4, h - 2, 1); g.fill();
        star(g, 0, ry + rh / 2, 6.5, '#ffd25e');
      }
    }
  }
  // 전조등·후미등
  g.fillStyle = '#fff6c2'; rr(g, x + 3, y + 1, 7, 4, 2); g.fill(); rr(g, x + w - 10, y + 1, 7, 4, 2); g.fill();
  g.fillStyle = '#ff5a5a'; rr(g, x + 3, y + h - 5, 7, 4, 2); g.fill(); rr(g, x + w - 10, y + h - 5, 7, 4, 2); g.fill();
}
function star(g, x, y, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
}

/* ===== 게임 ===== */
export function createChase(root, opts = {}) {
  root.innerHTML = `<div class="cs-scr" tabindex="-1"><canvas aria-label="카체이싱! 게임 화면"></canvas><div class="hr-ov cs-ov" hidden></div></div>
    <div class="hr-bar cs-bar"><p class="hr-keys cs-keys"><span class="hk"><span data-ka="left"></span><span data-ka="right"></span> 이동</span><span class="hk-dot"> · </span><span class="hk"><span data-ka="jump"></span> 점프</span></p><button type="button" class="btn ghost hr-snd cs-snd" aria-pressed="false"></button></div>`;
  const scr = root.querySelector('.cs-scr'), cv = scr.querySelector('canvas'), ov = scr.querySelector('.cs-ov'), sndBtn = root.querySelector('.cs-snd');
  const g = cv.getContext('2d', { alpha: false });
  const sfx = makeSfx(); sfx.set(!!opts.sound);
  let best = opts.best || 0, dpr = 1, k = 1, alive = true, raf = 0;
  const art = new Map();   // 그림 캐시: 키 → { c: canvas, w, h }
  const st = { scene: 'ready', shownAt: 0 };
  let s = null, seed = null, saved = false, evs = [], held = { L: 0, R: 0 }, jq = 0, acc = 0, last = 0, countT = 0, crashT = 0, pauseFrom = '';
  let msgNow = null;
  let parts = [], pops = [], shake = 0, flash = 0, warnShown = -1, lowT = 0, evRun = 0, tStart = 0;
  const deco = [];   // 길가 나무·가로등 (그림만, 판과 무관)
  for (let i = 0; i < 14; i++) deco.push({ side: i % 2, y: i * 70, t: i % 3 === 0 ? 'lamp' : 'tree', r: 12 + (i * 7) % 6 });

  /* --- 크기: 논리 360×640, 화면 픽셀에 맞춰 선명하게 --- */
  const fit = () => {
    const w = cv.clientWidth; if (!w) return;
    dpr = Math.min(3, window.devicePixelRatio || 1); k = w / C.W;
    const pw = Math.round(w * dpr), ph = Math.round(w * C.H / C.W * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; art.clear(); }
  };
  const ro = new ResizeObserver(() => { fit(); draw(); }); ro.observe(cv);

  const sprite = (key, w, h, paint) => {
    let a = art.get(key);
    if (!a) {
      const sc = k * dpr, pad = 8, c = document.createElement('canvas');
      c.width = Math.ceil((w + pad * 2) * sc); c.height = Math.ceil((h + pad * 2) * sc);
      const x = c.getContext('2d'); x.scale(sc, sc); x.translate(w / 2 + pad, h / 2 + pad); paint(x);
      a = { c, w: w + pad * 2, h: h + pad * 2 }; art.set(key, a);
    }
    return a;
  };
  const stamp = (a, x, y, rot = 0, sc = 1, alpha = 1) => {
    if (!rot && sc === 1 && alpha === 1) { g.drawImage(a.c, x - a.w / 2, y - a.h / 2, a.w, a.h); return; }
    g.save(); g.globalAlpha = alpha; g.translate(x, y); if (rot) g.rotate(rot); if (sc !== 1) g.scale(sc, sc); g.drawImage(a.c, -a.w / 2, -a.h / 2, a.w, a.h); g.restore();
  };
  const carSprite = (kind, col, hw, hh, player = false) => sprite(`car:${kind}:${col}:${player}`, (hw + 3) * 2, (hh + 3) * 2, x => carArt(x, kind, TRAFFIC[col] || col, (hw + 3) * 2, (hh + 3) * 2, { player }));
  const PLAYER_COL = '#3d7bff';
  const playerSprite = () => sprite('player', (C.P_HW + 5) * 2, (C.P_HH + 4) * 2, x => carArt(x, 'car', PLAYER_COL, (C.P_HW + 5) * 2, (C.P_HH + 4) * 2, { player: true }));
  const itemSprite = t => sprite('it:' + t, 34, 34, x => {
    x.lineJoin = 'round';
    if (t === 'coin') {
      x.fillStyle = 'rgba(20,18,50,.25)'; x.beginPath(); x.arc(2, 3, 11, 0, 7); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 11, 0, 7); x.stroke();
      const gr = x.createRadialGradient(-4, -4, 1, 0, 0, 12); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.6, '#ffd25e'); gr.addColorStop(1, '#f0a81c');
      x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 11, 0, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
      x.strokeStyle = '#c98a00'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 7, 0, 7); x.stroke();
      star(x, 0, 0, 4.5, '#fff2a8');
    } else if (t === 'fuel') {
      x.fillStyle = 'rgba(20,18,50,.28)'; rr(x, -9, -10, 22, 26, 4); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 6; rr(x, -11, -13, 22, 26, 4); x.stroke();
      x.fillStyle = '#ff5a5a'; rr(x, -11, -13, 22, 26, 4); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#ffd25e'; rr(x, 3, -17, 6, 6, 1.5); x.fill(); x.lineWidth = 1.5; x.stroke();   // 주둥이
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -6); x.bezierCurveTo(5, 1, 5, 7, 0, 7); x.bezierCurveTo(-5, 7, -5, 1, 0, -6); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke();
    } else if (t === 'box') {
      x.fillStyle = 'rgba(20,18,50,.28)'; rr(x, -11, -10, 26, 26, 6); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 6; rr(x, -13, -13, 26, 26, 6); x.stroke();
      const gr = x.createLinearGradient(-13, -13, 13, 13); gr.addColorStop(0, '#ff8fd0'); gr.addColorStop(0.5, '#a98bff'); gr.addColorStop(1, '#5ec8ff');
      x.fillStyle = gr; rr(x, -13, -13, 26, 26, 6); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#fff'; x.font = `22px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3; x.strokeText('?', 0, 1.5); x.fillText('?', 0, 1.5);
    } else if (t === 'cone') {
      x.fillStyle = 'rgba(20,18,50,.28)'; x.beginPath(); x.arc(2, 3, 11, 0, 7); x.fill();
      x.fillStyle = '#ff8a3d'; x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); rr(x, -12, -12, 24, 24, 4); x.stroke(); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 7.5, 0, 7); x.fill(); x.fillStyle = '#ff8a3d'; x.beginPath(); x.arc(0, 0, 4.5, 0, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 4.5, 0, 7); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 1.8, 0, 7); x.fill();
    }
  });
  const wallSprite = () => sprite('wall', C.ROAD_R - C.ROAD_L, 24, x => {
    const w = C.ROAD_R - C.ROAD_L, h = 18;
    x.fillStyle = 'rgba(20,18,50,.3)'; rr(x, -w / 2 + 3, -h / 2 + 5, w, h, 4); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 6; rr(x, -w / 2, -h / 2, w, h, 4); x.stroke();
    x.save(); rr(x, -w / 2, -h / 2, w, h, 4); x.clip();
    x.fillStyle = '#fff'; x.fillRect(-w / 2, -h / 2, w, h);
    x.fillStyle = '#ff6b3d'; for (let i = -w / 2 - 20; i < w / 2; i += 22) { x.beginPath(); x.moveTo(i, h / 2); x.lineTo(i + 11, -h / 2); x.lineTo(i + 22, -h / 2); x.lineTo(i + 11, h / 2); x.fill(); }
    x.restore(); x.strokeStyle = INK; x.lineWidth = 2; rr(x, -w / 2, -h / 2, w, h, 4); x.stroke();
    for (const lx of [-w / 2 + 14, 0, w / 2 - 14]) { x.fillStyle = '#ffd25e'; x.beginPath(); x.arc(lx, -h / 2 - 1, 4, 0, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke(); }
  });

  /* --- 입력 --- */
  const KM = opts.keys || (() => '');
  const ptr = new Map();
  const zoneOf = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; return x < 0.34 ? 'L' : x > 0.66 ? 'R' : 'J'; };
  const syncHeld = () => { let L = 0, R = 0; for (const z of ptr.values()) { if (z === 'L') L = 1; if (z === 'R') R = 1; } held.tL = L; held.tR = R; held.L = held.kL || L ? 1 : 0; held.R = held.kR || R ? 1 : 0; };
  held.kL = 0; held.kR = 0; held.tL = 0; held.tR = 0;
  const onDown = e => {
    if (e.button > 0) return; e.preventDefault(); sfx.unlock(); if (e.pointerType === 'touch') touchSeen = true;
    if (st.scene === 'ready') { start(); return; }
    if (st.scene === 'over') { again(); return; }
    if (st.scene === 'pause') { resume(); return; }
    const z = zoneOf(e); ptr.set(e.pointerId, z); try { cv.setPointerCapture(e.pointerId); } catch {}
    if (z === 'J') jq++;
    syncHeld();
  };
  const onMove = e => { if (!ptr.has(e.pointerId)) return; const z = zoneOf(e), o = ptr.get(e.pointerId); if (z !== o && z !== 'J') { ptr.set(e.pointerId, z); syncHeld(); } else if (z === 'J' && o !== 'J') { ptr.set(e.pointerId, 'J'); syncHeld(); } };
  const onUp = e => { if (ptr.delete(e.pointerId)) syncHeld(); };
  let touchSeen = TOUCHY();
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('lostpointercapture', onUp);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  ov.addEventListener('pointerdown', e => { if (e.target.closest('button,a')) return; onDown(e); });
  const busy = e => e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal.open') || e.target.closest?.('input,textarea,select,[contenteditable]');
  const kd = e => {
    if (busy(e) || root.closest('[hidden]')) return;
    const a = KM(e); sfx.unlock();
    if (st.scene === 'ready') { if (a || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) start(); } return; }
    if (st.scene === 'over') { if ((a === 'jump' || a === 'left' || a === 'right' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); again(); } return; }
    if (st.scene === 'pause') { if (e.code !== 'Escape' && e.code !== 'KeyR' && !e.repeat) { e.preventDefault(); resume(); } return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (st.scene === 'play' || st.scene === 'count') { e.preventDefault(); pause(); } return; }
    if (a === 'left') { e.preventDefault(); held.kL = 1; syncHeld(); }
    else if (a === 'right') { e.preventDefault(); held.kR = 1; syncHeld(); }
    else if (a === 'jump') { e.preventDefault(); if (!e.repeat) jq++; }
  };
  const ku = e => { const a = KM(e); if (a === 'left') { held.kL = 0; syncHeld(); } else if (a === 'right') { held.kR = 0; syncHeld(); } };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  const blur = () => { held.kL = held.kR = 0; ptr.clear(); syncHeld(); if (st.scene === 'play' || st.scene === 'count') pause(); };
  const vis = () => { if (document.hidden) blur(); };
  window.addEventListener('blur', blur); document.addEventListener('visibilitychange', vis);

  /* --- 화면 위 안내(글자는 DOM이라 또렷함) --- */
  const keyTxt = () => opts.keyText ? opts.keyText() : '← → 이동 · Space 점프';
  const showReady = () => {
    ov.hidden = false; ov.className = 'hr-ov cs-ov cs-ready';
    ov.innerHTML = `<b>카체이싱!</b><span>차 사이를 아슬아슬하게 스쳐 부스터를 모아요</span>${best ? `<em class="sr-best cs-best">${opts.trophy || ''}내 최고 ${fmt(best)}점</em>` : ''}
      <ul class="cs-how"><li><i class="cs-i1"></i>차 옆을 <b>아슬아슬</b>하게 스치면 보너스 · 연속이면 콤보</li><li><i class="cs-i2"></i>게이지가 꽉 차면 <b>부스터</b> — 앞차를 날려 버려요</li><li><i class="cs-i3"></i><b>연료통</b>을 먹어야 계속 달려요 · 바리케이드는 점프!</li></ul>
      <small>${touchSeen ? '왼쪽·오른쪽 = 이동 · 가운데 = 점프 — 화면을 눌러 출발' : keyTxt() + ' — 아무 키나 눌러 출발'}</small>`;
  };
  const WHY = { crash: '쾅! 부딪혔어요', wall: '바리케이드에 쾅!', cone: '고깔에 걸렸어요!', fuel: '기름이 다 떨어졌어요…', cap: '끝까지 달렸어요!' };
  const showOver = res => {
    st.scene = 'over'; st.shownAt = performance.now();
    const nb = res.score > best && res.score > 0; if (nb) best = res.score;
    ov.hidden = false; ov.className = 'hr-ov dead cs-over';
    ov.innerHTML = `<b>${WHY[res.why] || '끝!'}</b><div class="hr-card"><p class="hr-sc"><em>${fmt(res.score)}점</em>${nb ? '<i class="hr-nb">최고 기록!</i>' : ''}</p>
      <p class="cs-stat"><span><b>${fmt(res.m)}</b>m</span><span>아슬아슬 <b>${res.near}</b>번</span><span>최대 콤보 <b>x${res.maxCombo}</b></span><span>부스터 <b>${res.boosts}</b>번</span>${res.smash ? `<span>날려 버린 차 <b>${res.smash}</b>대</span>` : ''}</p>
      <small class="hr-msg cs-msg">${msgNow ?? (opts.saveLine ? opts.saveLine(res) : '')}</small></div><small class="hr-go">${touchSeen ? '화면을 눌러 다시' : '스페이스 · 엔터 · 클릭으로 다시'}</small>`;
  };
  const showPause = () => { ov.hidden = false; ov.className = 'hr-ov cs-ov'; ov.innerHTML = `<b>잠깐 멈춤</b><span>차도 연료도 같이 멈췄어요</span><small>${touchSeen ? '화면을 누르면 계속' : '아무 키나 누르면 계속'}</small>`; };

  /* --- 판 흐름 --- */
  let seedP = null;
  function start() {
    if (st.scene !== 'ready') return;
    ov.hidden = true; st.scene = 'count'; countT = 0; evRun++;
    const my = evRun; seed = null; saved = false;
    seedP = Promise.resolve(opts.seed ? opts.seed() : null).catch(() => null).then(x => { if (my === evRun) { seed = x; saved = x != null; } return x; });
    s = null; tStart = 0; resetFx();
    sfx.beep(false);
  }
  function begin() {   // 카운트다운 끝 → 판 시작
    const sd = seed != null ? seed : (Math.random() * 4294967296) >>> 0;
    s = C.newSim(sd, true); evs = []; jq = 0; acc = 0; st.scene = 'play'; tStart = performance.now();
    held.kL = held.kR = 0; ptr.clear(); syncHeld();
    opts.onStart?.(saved);
  }
  function resetFx() { parts = []; pops = []; shake = 0; flash = 0; warnShown = -1; lowT = 0; }
  function again() {
    if (st.scene !== 'over' || performance.now() - st.shownAt < 500) return;
    st.scene = 'ready'; s = null; resetFx(); opts.onReady?.(); start();   // 끝난 뒤 누르면 바로 카운트다운
  }
  function pause() { if (st.scene !== 'play' && st.scene !== 'count') return; pauseFrom = st.scene; st.scene = 'pause'; sfx.engine(0); showPause(); }
  function resume() { if (st.scene !== 'pause') return; ov.hidden = true; held.kL = held.kR = 0; ptr.clear(); syncHeld(); st.scene = pauseFrom === 'count' ? 'count' : 'resume'; countT = 0; last = performance.now(); }

  /* --- 효과 --- */
  const burst = (x, y, n, cols, sp = 160, life = 0.6, sz = 4) => { if (RM()) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.4 + Math.random() * 0.8); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c: cols[i % cols.length], sz: sz * (0.6 + Math.random() * 0.8) }); } };
  const pop = (x, y, t, c = '#fff', big = 0) => pops.push({ x, y, t, c, big, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8 });
  function handle(e) {
    switch (e.t) {
      case 'near': {
        const sx = e.x < s.p.x ? s.p.x - 22 : s.p.x + 22;
        burst(sx, C.PY - 10, 10, ['#fff', '#ffd25e', '#7fd4ff'], 180, 0.4, 3);
        pop(s.p.x, C.PY - 64, e.combo > 1 ? `아슬아슬! x${e.combo}` : '아슬아슬!', '#ffd25e', 1); pop(sx, C.PY - 30, '+' + e.pts, '#fff');
        sfx.near(e.combo); break;
      }
      case 'coin': burst(e.x, e.y, 6, ['#ffd25e', '#fff'], 90, 0.35, 3); pop(e.x, e.y - 18, '+10', '#ffd25e'); sfx.coin(); break;
      case 'fuel': burst(e.x, e.y, 12, ['#ff5a5a', '#fff', '#ffd25e'], 130, 0.5); pop(e.x, e.y - 22, '연료 +' + C.CAN, '#ff8a8a', 1); sfx.fuel(); break;
      case 'box': burst(e.x, e.y, 18, ['#ff8fd0', '#a98bff', '#5ec8ff', '#fff'], 200, 0.6); sfx.box(); break;
      case 'boost': flash = 0.35; shake = Math.max(shake, 0.15); pop(C.W / 2, 250, '부스터!', '#7fd4ff', 1); sfx.boost(); break;
      case 'smash': burst(e.x, e.y, e.wall ? 22 : 14, ['#fff', '#ffd25e', '#ff8a3d', '#9aa3b5'], 240, 0.6); shake = Math.max(shake, 0.18); pop(e.x, e.y - 20, e.wall ? '+20' : '+50', '#fff'); sfx.smash(); break;
      case 'jump': sfx.jump(); break;
      case 'land': burst(s.p.x, C.PY + 20, 8, ['#cfd4df', '#fff'], 70, 0.35, 3); sfx.land(); break;
      case 'crash': burst(e.x, e.y, 40, ['#ff5a5a', '#ffd25e', '#fff', '#2a2846', '#ff8a3d'], 300, 0.9, 5); shake = 0.6; flash = 0.5; sfx.crash(); sfx.engine(0); break;
      case 'empty': pop(C.W / 2, 300, '기름이 떨어졌어요!', '#ff8a8a', 1); sfx.empty(); break;
      case 'stop': sfx.stop(); break;
    }
  }

  /* --- 루프 --- */
  const STEP = 1000 / C.FPS;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, now - (last || now)); last = now;
    if (st.scene === 'count' || st.scene === 'resume') {
      countT += dt;
      const total = st.scene === 'resume' ? 1000 : 3000, prevN = Math.ceil((total - (countT - dt)) / 1000), n = Math.ceil((total - countT) / 1000);
      if (n !== prevN && n > 0) sfx.beep(false);
      if (countT >= total) {
        if (st.scene === 'resume') { st.scene = 'play'; acc = 0; }
        else if (seed != null || countT >= total + 4000 || !opts.seed) { sfx.beep(true); begin(); }
      }
    }
    if (st.scene === 'play') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6 && !s.over) {
        // 입력: 바뀐 것만 이 프레임 번호로 기록
        if (held.L !== s.L) { const c = held.L ? 0 : 1; evs.push(C.enc(s.f, c)); C.input(s, c); }
        if (held.R !== s.R) { const c = held.R ? 2 : 3; evs.push(C.enc(s.f, c)); C.input(s, c); }
        if (jq) { jq = 0; evs.push(C.enc(s.f, 4)); C.input(s, 4); }
        for (const c of s.cars) { c._py = c.y; c._px = c.x; } for (const it of s.items) it._py = it.y; s.p._px = s.p.x; s._pd = s.dist;
        C.step(s);
        for (const e of s.evs) handle(e); s.evs.length = 0;
        acc -= STEP; n++;
      }
      if (n >= 6) acc = 0;
      sfx.engine(s.over ? 0 : s.v);
      if (s.over) { st.scene = 'crash'; crashT = 0; finish(); }
    } else if (st.scene === 'crash') {
      crashT += dt;
      if (crashT > 1100 && ov.hidden) showOver(lastRes);
    }
    // 효과 진행
    const ds = dt / 1000;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * ds; p.y += p.vy * ds; p.vx *= 0.94; p.vy *= 0.94; p.life -= ds; if (p.life <= 0) parts.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.y -= 30 * ds; p.life -= ds; if (p.life <= 0) pops.splice(i, 1); }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
    shake = Math.max(0, shake - ds); flash = Math.max(0, flash - ds);
    draw();
  }
  let lastRes = null;
  function finish() {
    const r = { score: C.scoreOf(s), m: C.metersOf(s), f: s.overF, why: s.over, near: s.near, maxCombo: s.maxCombo, boosts: s.boosts, smash: s.smash, coins: s.coins, cans: s.cans, rounds: [s.overF, ...evs], saved, realMs: performance.now() - tStart };
    lastRes = r; msgNow = null;
    opts.onOver?.(r);
  }

  /* --- 그리기 --- */
  const alpha = () => st.scene === 'play' ? clamp(acc / STEP, 0, 1) : 1;
  function draw() {
    if (!cv.width) return;
    const a = alpha(), sc = k * dpr;
    g.setTransform(sc, 0, 0, sc, 0, 0);
    const dist = s ? lerp(s._pd ?? s.dist, s.dist, a) : 0;
    g.save();
    if (shake > 0 && !RM()) g.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
    drawRoad(dist);
    if (s) drawWorld(a);
    else drawIdle();
    for (const p of parts) { g.globalAlpha = clamp(p.life / p.max, 0, 1); g.fillStyle = p.c; g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    g.globalAlpha = 1;
    for (const p of pops) {
      const t = 1 - p.life / p.max, al = t > 0.7 ? (1 - t) / 0.3 : 1, sz = (p.big ? 24 : 16) * (t < 0.12 ? 0.7 + t * 2.5 : 1);
      g.globalAlpha = al; g.font = `${sz}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = p.big ? 5 : 4; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(p.t, p.x, p.y); g.fillStyle = p.c; g.fillText(p.t, p.x, p.y);
    }
    g.globalAlpha = 1;
    g.restore();
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${(flash * 1.4).toFixed(3)})`; g.fillRect(0, 0, C.W, C.H); }
    if (s) drawHud();
    if (st.scene === 'count' || st.scene === 'resume') drawCount();
    if (touchSeen && (st.scene === 'play' || st.scene === 'count' || st.scene === 'resume')) drawPads();
  }
  function drawRoad(dist) {
    const off = dist % 140;
    // 길가(보도) + 잔디 띠
    g.fillStyle = '#9ad67a'; g.fillRect(0, 0, C.ROAD_L, C.H); g.fillRect(C.ROAD_R, 0, C.W - C.ROAD_R, C.H);
    g.fillStyle = '#e6dfcf'; g.fillRect(C.ROAD_L - 14, 0, 14, C.H); g.fillRect(C.ROAD_R, 0, 14, C.H);
    g.strokeStyle = 'rgba(42,40,70,.18)'; g.lineWidth = 1;
    for (let y = -40 + (dist % 40); y < C.H; y += 40) { g.beginPath(); g.moveTo(C.ROAD_L - 14, y); g.lineTo(C.ROAD_L, y); g.moveTo(C.ROAD_R, y); g.lineTo(C.ROAD_R + 14, y); g.stroke(); }
    // 도로
    g.fillStyle = '#4a5066'; g.fillRect(C.ROAD_L, 0, C.ROAD_R - C.ROAD_L, C.H);
    g.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 7; i++) { const y = ((i * 211 + dist * 1) % (C.H + 120)) - 60; g.fillRect(C.ROAD_L + 20 + (i * 97) % 240, y, 26 + (i * 13) % 30, 10); }
    // 차선
    g.fillStyle = '#fff'; g.fillRect(C.ROAD_L + 3, 0, 3, C.H); g.fillRect(C.ROAD_R - 6, 0, 3, C.H);
    g.fillStyle = 'rgba(255,255,255,.85)';
    const dOff = dist % 70;
    for (let l = 1; l < C.LANES; l++) { const x = C.ROAD_L + l * C.LANE_W - 1.5; for (let y = -70 + dOff; y < C.H; y += 70) g.fillRect(x, y, 3, 34); }
    // 출발선·1km마다 바닥 글씨
    const mark = (wy, kind) => {
      const y = C.PY + 30 - (wy - dist);
      if (y < -40 || y > C.H + 40) return;
      if (kind === 'start') { for (let i = 0; i < 20; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : INK; g.fillRect(C.ROAD_L + i * 15, y + j * 8, 15, 8); } }
      else { g.save(); g.font = `30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText(kind, C.W / 2, y); g.restore(); }
    };
    mark(0, 'start');
    const km = Math.floor(dist / 10000) * 10000; for (const w of [km, km + 10000]) if (w > 0) mark(w, fmt(w / 10) + 'm');
    // 나무·가로등(길가)
    for (const d of deco) {
      const y = ((d.y + dist * 1) % (C.H + 140)) - 70, x = d.side ? C.W - 7 : 7;
      if (d.t === 'tree') { g.fillStyle = 'rgba(20,18,50,.2)'; g.beginPath(); g.arc(x + 3, y + 4, d.r, 0, 7); g.fill(); g.fillStyle = '#5cbf6e'; g.beginPath(); g.arc(x, y, d.r, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.fillStyle = '#7fd68e'; g.beginPath(); g.arc(x - 3, y - 3, d.r * 0.45, 0, 7); g.fill(); }
      else {   // 꽃 덤불
        g.fillStyle = 'rgba(20,18,50,.18)'; g.beginPath(); g.arc(x + 2, y + 3, 8, 0, 7); g.fill();
        g.fillStyle = '#7ccf6a'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
        for (let j = 0; j < 3; j++) { g.fillStyle = ['#ff8fb3', '#ffd25e', '#fff'][(j + d.r) % 3]; g.beginPath(); g.arc(x + [-3, 3, 0][j], y + [-2, -1, 3][j], 2.2, 0, 7); g.fill(); }
      }
    }
  }
  function drawIdle() {   // 시작 전: 내 차만 출발선에
    const p = playerSprite(); stamp(p, C.laneX(1) + C.LANE_W / 2, C.PY);
  }
  function drawWorld(a) {
    const P = s.p, px = lerp(P._px ?? P.x, P.x, a);
    // 부스터 속도선
    if (s.boost > 0 && !RM()) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const x = C.ROAD_L + ((i * 53 + s.f * 7) % 300), y = ((i * 97 + s.f * 31) % (C.H + 100)) - 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 40 + (i % 3) * 20); g.stroke(); } }
    // 바닥 것들(벽·고깔·코인·연료·상자)
    for (const it of s.items) {
      if (it.got) continue;
      const y = lerp(it._py ?? it.y, it.y, a);
      if (it.t === 'wall') stamp(wallSprite(), it.x, y);
      else if (it.t === 'box') stamp(itemSprite('box'), it.x, y + Math.sin((s.f + it.id * 7) * 0.12) * 2, 0, 1 + Math.sin((s.f + it.id) * 0.2) * 0.05);
      else if (it.t === 'coin') { const w = Math.abs(Math.cos((s.f + it.id * 9) * 0.09)); stamp(itemSprite('coin'), it.x, y, 0, 1); if (w < 0.3) { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(it.x - 1, y - 9, 2, 18); } }
      else stamp(itemSprite(it.t), it.x, y);
    }
    // 차(위에서부터)
    for (const c of s.cars) {
      const y = lerp(c._py ?? c.y, c.y, a), x = lerp(c._px ?? c.x, c.x, a), sp = carSprite(c.k, c.col, c.hw, c.hh);
      if (c.dead) {   // 부스터로 날아감
        const t = c.dead / 50, dir = c.id % 2 ? 1 : -1;
        stamp(sp, x + dir * t * 160, y - t * 120, dir * t * 7, 1 + t * 0.4, clamp(1 - t * 1.2, 0, 1)); continue;
      }
      if (y < -80 || y > C.H + 80) continue;
      stamp(sp, x, y);
      if ((c.blink || c.mv) && (s.f >> 3) % 2 === 0) {   // 깜빡이
        const side = c.to > c.lane ? 1 : -1, bx = x + side * (c.hw + 2);
        g.fillStyle = '#ffb03a'; g.beginPath(); g.arc(bx, y - c.hh + 4, 3.2, 0, 7); g.arc(bx, y + c.hh - 4, 3.2, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      }
    }
    // 내 차
    const air = P.air > 0 ? Math.sin((1 - (P.air - a) / C.JUMP_F) * Math.PI) : 0, sc = 1 + air * 0.32, tilt = clamp(P.vx / C.SIDE_V, -1, 1) * 0.12;
    if (air > 0) { g.fillStyle = 'rgba(20,18,50,.28)'; g.beginPath(); g.ellipse(px + 4, C.PY + 6, 16 * (1 - air * 0.25), 26 * (1 - air * 0.25), 0, 0, 7); g.fill(); }
    if (s.boost > 0) {   // 부스터 불꽃·빛
      const fl = 18 + Math.random() * 14;
      g.fillStyle = 'rgba(127,212,255,.25)'; g.beginPath(); g.ellipse(px, C.PY, 30, 46, 0, 0, 7); g.fill();
      g.fillStyle = '#ffd25e'; g.beginPath(); g.moveTo(px - 8, C.PY + 26); g.lineTo(px, C.PY + 26 + fl); g.lineTo(px + 8, C.PY + 26); g.fill();
      g.fillStyle = '#ff6b3d'; g.beginPath(); g.moveTo(px - 4, C.PY + 26); g.lineTo(px, C.PY + 20 + fl * 0.6); g.lineTo(px + 4, C.PY + 26); g.fill();
    }
    const blinkOff = (s.grace > 0 || (s.boost > 0 && s.boost < 50)) && (s.f >> 2) % 2 === 0;
    const wreck = (st.scene === 'crash' || st.scene === 'over') && (s.over === 'crash' || s.over === 'wall' || s.over === 'cone');
    if (!wreck) stamp(playerSprite(), px, C.PY - air * 10, tilt, sc, blinkOff ? 0.45 : 1);
    else {   // 부딪힌 뒤: 차가 돌고 연기
      stamp(playerSprite(), px, C.PY, 0.35 + Math.min(crashT / 600, 1) * 0.6, 1, 1);
      g.fillStyle = 'rgba(80,80,100,.35)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(px + Math.sin(crashT / 200 + i) * 10, C.PY - 10 - i * 12 - crashT / 40, 10 + i * 3, 0, 7); g.fill(); }
    }
    // 바리케이드 경고
    const wall = s.items.find(it => it.t === 'wall' && !it.got && it.y > -420 && it.y < C.PY - 40);
    if (wall) {
      if (warnShown !== wall.id) { warnShown = wall.id; sfx.warn(); }
      const now = C.PY - wall.y < s.v * 0.5 + 30, ok = !s.p.air && !s.p.cd;
      if (now || (s.f >> 3) % 2 === 0 || RM()) {
        g.save(); g.translate(C.W / 2, 150);
        g.fillStyle = now ? (ok ? '#7be08a' : '#ffd25e') : '#ffd25e'; g.strokeStyle = '#fff'; g.lineWidth = 6; rr(g, -84, -24, 168, 48, 12); g.stroke(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
        g.font = `24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText(now ? '지금 점프!' : '▲ 바리케이드!', 0, 2);
        g.restore();
      }
    }
  }
  function bar(x, y, w, h, v, col, label, warn) {
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5; rr(g, x, y, w, h, 6); g.fill(); g.stroke();
    if (v > 0) { g.save(); rr(g, x + 2, y + 2, w - 4, h - 4, 4); g.clip(); g.fillStyle = col; g.fillRect(x + 2, y + 2, (w - 4) * clamp(v, 0, 1), h - 4); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x + 2, y + 2, (w - 4) * clamp(v, 0, 1), 3); g.restore(); }
    g.font = `13px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = INK; g.strokeText(label, x + 6, y + h / 2 + 0.5); g.fillStyle = warn ? '#ffd2d2' : '#fff'; g.fillText(label, x + 6, y + h / 2 + 0.5);
  }
  let scoreTxt = '', scoreV = -1, mTxt = '', mV = -1;
  function drawHud() {
    const sc = C.scoreOf(s), m = C.metersOf(s);
    if (sc !== scoreV) { scoreV = sc; scoreTxt = fmt(sc); }
    if (m !== mV) { mV = m; mTxt = fmt(m) + 'm'; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = `34px ${FONT}`; g.lineWidth = 6; g.strokeStyle = INK; g.strokeText(scoreTxt, C.W / 2, 34); g.fillStyle = '#fff'; g.fillText(scoreTxt, C.W / 2, 34);
    g.font = `15px ${FONT}`; g.lineWidth = 4; g.strokeText(mTxt, C.W / 2, 60); g.fillStyle = '#ffd25e'; g.fillText(mTxt, C.W / 2, 60);
    // 연료(왼쪽 위) · 부스터(오른쪽 위)
    const low = s.fuel < 25 && s.fuel > 0, blink = low && (s.f >> 4) % 2 === 0;
    bar(10, 14, 92, 20, s.fuel / C.FUEL0, blink ? '#ff5a5a' : s.fuel < 25 ? '#ff8a5a' : '#ff6b6b', '연료', low);
    const bv = s.boost > 0 ? s.boost / C.BOOST_F : s.fever / 100;
    bar(C.W - 102, 14, 92, 20, bv, s.boost > 0 ? `hsl(${(s.f * 6) % 360},90%,62%)` : '#5ec8ff', s.boost > 0 ? '부스터!' : '부스터', false);
    if (low) { lowT += 1; if ((s.f >> 4) % 2 === 0) { g.font = `14px ${FONT}`; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = INK; g.strokeText('연료 부족!', 12, 46); g.fillStyle = '#ff9a9a'; g.fillText('연료 부족!', 12, 46); } }
    // 콤보
    if (s.combo > 1) {
      const left = 1 - (s.f - s.lastNear) / C.COMBO_F;
      g.save(); g.translate(C.W - 56, 58);
      g.font = `18px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = INK; g.strokeText('콤보 x' + s.combo, 0, 0); g.fillStyle = '#ffd25e'; g.fillText('콤보 x' + s.combo, 0, 0);
      g.fillStyle = 'rgba(42,40,70,.5)'; g.fillRect(-34, 12, 68, 4); g.fillStyle = '#ffd25e'; g.fillRect(-34, 12, 68 * clamp(left, 0, 1), 4);
      g.restore();
    }
  }
  function drawCount() {
    const total = st.scene === 'resume' ? 1000 : 3000, left = total - countT;
    let t, ph;
    if (left > 0) { t = String(Math.ceil(left / 1000)); ph = 1 - ((left / 1000) % 1 || 1); }
    else { t = seed != null || !opts.seed ? '출발!' : '연결 중…'; ph = 0.5; }
    const sz = (t.length > 2 ? 40 : 86) * (ph < 0.15 ? 0.6 + ph * 3 : 1);
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.font = `${sz}px ${FONT}`;
    g.lineWidth = 9; g.strokeStyle = INK; g.strokeText(t, C.W / 2, 290); g.fillStyle = left > 0 ? '#fff' : '#ffd25e'; g.fillText(t, C.W / 2, 290);
    if (st.scene === 'count' && !s) { g.font = `15px ${FONT}`; g.lineWidth = 4; const m = touchSeen ? '왼쪽·오른쪽 이동 · 가운데 점프' : keyTxt(); g.strokeText(m, C.W / 2, 350); g.fillStyle = '#fff'; g.fillText(m, C.W / 2, 350); }
    g.restore();
  }
  function drawPads() {
    const P = s?.p, ready = !P || (!P.air && !P.cd);
    const pad = (x, y, r, on, paint) => {
      g.save(); g.globalAlpha = on ? 0.82 : 0.42; g.fillStyle = on ? '#fff' : 'rgba(255,255,255,.75)'; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.globalAlpha = on ? 1 : 0.7; paint(); g.restore();
    };
    const tri = (x, y, d) => { g.fillStyle = INK; g.beginPath(); g.moveTo(x + d * 10, y); g.lineTo(x - d * 7, y - 11); g.lineTo(x - d * 7, y + 11); g.closePath(); g.fill(); };
    pad(46, 594, 30, held.L, () => tri(46, 594, -1));
    pad(C.W - 46, 594, 30, held.R, () => tri(C.W - 46, 594, 1));
    pad(C.W / 2, 600, 26, ready, () => {
      if (!ready && P) { const f = P.air ? 0 : 1 - P.cd / C.JUMP_CD; g.strokeStyle = '#5ec8ff'; g.lineWidth = 4; g.beginPath(); g.arc(C.W / 2, 600, 22, -Math.PI / 2, -Math.PI / 2 + f * 6.283); g.stroke(); }
      g.font = `14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText('점프', C.W / 2, 601);
    });
  }

  /* --- 소리 버튼 --- */
  const paintSnd = () => { const on = sfx.on, t = on ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${on ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', on); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', on); };
  sndBtn.onclick = () => { sfx.set(!sfx.on); paintSnd(); opts.onSound?.(sfx.on); sndBtn.blur(); };
  paintSnd();

  fit();
  if (opts.quick) { st.scene = 'ready'; start(); } else showReady();
  raf = requestAnimationFrame(frame);
  // 글꼴이 늦게 오면 캔버스 글자가 대체 글꼴로 그려짐 → 받으면 그림 캐시를 비움
  document.fonts?.load?.(`20px ${FONT}`, '카체이싱 점프 연료 부스터 아슬아슬 콤보 출발 연결 중 0123456789,m+x!?…').then(() => { art.clear(); }).catch(() => {});

  return {
    st, get sim() { return s; }, get best() { return best; },
    setBest(b) { best = Math.max(best, b || 0); },
    msg(html) { msgNow = html; const m = ov.querySelector('.cs-msg'); if (m && st.scene === 'over') m.innerHTML = html; },   // 저장 응답이 결과 창보다 먼저 와도 남겨 둠
    setSound(on) { sfx.set(on); paintSnd(); },
    start, pause, resume, again: () => again(),
    // 테스트용: 판을 강제로 진행
    _step(n = 1) { for (let i = 0; i < n && s && !s.over; i++) { if (held.L !== s.L) { const c = held.L ? 0 : 1; evs.push(C.enc(s.f, c)); C.input(s, c); } if (held.R !== s.R) { const c = held.R ? 2 : 3; evs.push(C.enc(s.f, c)); C.input(s, c); } if (jq) { jq = 0; evs.push(C.enc(s.f, 4)); C.input(s, 4); } C.step(s); for (const e of s.evs) handle(e); s.evs.length = 0; } },
    _hold(l, r) { held.kL = l ? 1 : 0; held.kR = r ? 1 : 0; syncHeld(); }, _jump() { jq++; },
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); sfx.set(false); evRun++;
      document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', vis);
    },
  };
}
