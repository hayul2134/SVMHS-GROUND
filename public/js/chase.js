// SVMHS GROUND — 카체이싱! 화면 (2026-10-31 하율 "다함께 차차차처럼 — 플레이 방식까지 최대한 비슷하게, 바로 출시해도 될 정도로", 미리보기 깃발 chase-game)
// 규칙·판 진행은 chase-score.js(서버와 같음) — 여기는 그리기·입력·소리만. 판에 영향을 주는 값은 전부 시뮬레이션(s)에서 읽음.
// 2026-10-31 하율 "차차차 느낌으로" + "가로로 넓게, 태블릿·폰은 돌려서": 가로 16:9 화면, 차 뒤 위에서 보는 원근 시점(지평선·하늘, 앞차는 뒷모습).
//   판 좌표(가로 30~330 도로, 세로 y)는 그대로 두고 그릴 때만 바꿈 → 규칙·점수·서버 검사와 무관. 세로 화면 터치 기기는 '가로로 돌려 주세요'.
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
const PORTRAIT = '(orientation:portrait) and (pointer:coarse)';

/* ===== 화면 크기·시점 =====
   논리 화면 960×540. 깊이 배율 s(y) = PF / (PF + (PY0 - y)) · 화면 y = HZ + PB·s(지평선 HZ에서 s=0) · 화면 x = 가운데 + (x - 165)·s·PK
   내 차(판 y 512) ≈ 화면 470, 차가 생기는 곳(판 y -800) ≈ 263. 도로 폭: 내 차 근처 약 640px → 지평선에서 한 점 */
const VW = 960, VH = 540, HZ = 62;
const PF = 1100, PY0 = 700, PB = 478, PK = 2.5, CX = VW / 2, RX = (C.ROAD_L + C.ROAD_R) / 2;
const ps = y => PF / (PF + Math.max(PY0 - y, -PF * 0.6));
const sxOf = (x, s) => CX + (x - RX) * s * PK;
const syOf = s => HZ + PB * s;
const sAt = sy => (sy - HZ) / PB;
const yAt = sy => PY0 - PF * (1 / sAt(sy) - 1);
const Y_FAR = yAt(HZ + 22), Y_BOT = yAt(VH + 30);   // 그리는 범위(판 y)

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

/* ===== 그림(스티커 느낌: 흰 칼선 + 잉크 외곽) — 크게 한 번 그려 두고 줄여서 찍음 ===== */
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function shade(hex, k) {   // k < 0 어둡게 · > 0 밝게
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255;
  const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return '#' + ((1 << 24) | (f(r) << 16) | (f(gg) << 8) | f(b)).toString(16).slice(1);
}
function star(g, x, y, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
}
// 차 뒷모습(원점 = 바닥 가운데, 위로 그림). w = 폭, h = 높이
export const CAR_H = { car: 27, mini: 25, taxi: 27, van: 34, truck: 44, bus: 48 };
function rearArt(g, kind, col, w, h, opt = {}) {
  const body = kind === 'taxi' ? '#ffd43b' : kind === 'bus' ? '#4cc38a' : col, x = -w / 2, top = -h;
  g.lineJoin = 'round';
  // 그림자 + 바퀴
  g.fillStyle = 'rgba(20,18,50,.3)'; g.beginPath(); g.ellipse(2, 1, w * 0.58, 5, 0, 0, 7); g.fill();
  g.fillStyle = INK; rr(g, x + 1, -9, 9, 10, 3); g.fill(); rr(g, -x - 10, -9, 9, 10, 3); g.fill();
  // 칼선
  g.strokeStyle = '#fff'; g.lineWidth = 6;
  if (kind === 'truck') { rr(g, x - 1, top, w + 2, h - 4, 4); g.stroke(); }
  else { g.beginPath(); g.moveTo(x + 5, top + h * 0.42); g.lineTo(x + w * 0.18, top + 2); g.lineTo(-x - w * 0.18, top + 2); g.lineTo(-x - 5, top + h * 0.42); g.lineTo(-x, top + h * 0.48); g.lineTo(-x, -5); g.lineTo(x, -5); g.lineTo(x, top + h * 0.48); g.closePath(); g.stroke(); }
  if (kind === 'truck') {   // 짐칸 문
    g.fillStyle = '#eef0f4'; rr(g, x - 1, top, w + 2, h - 4, 4); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.fillStyle = shade(col, 0); rr(g, x - 1, top, w + 2, 5, 3); g.fill();
    g.strokeStyle = 'rgba(42,40,70,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, top + 6); g.lineTo(0, -8); g.stroke();
    g.fillStyle = '#9aa0b3'; rr(g, -5, top + h * 0.5, 3, 7, 1); g.fill(); rr(g, 2, top + h * 0.5, 3, 7, 1); g.fill();
    g.fillStyle = INK; rr(g, x + 1, -9, w - 2, 4, 2); g.fill();
    g.fillStyle = '#ff5a5a'; rr(g, x + 2, -16, 6, 5, 1.5); g.fill(); rr(g, -x - 8, -16, 6, 5, 1.5); g.fill();
    return;
  }
  // 몸통(아래) + 지붕·뒷유리(위)
  const waist = top + h * 0.46;
  const gr = g.createLinearGradient(x, 0, -x, 0); gr.addColorStop(0, shade(body, 0.16)); gr.addColorStop(0.55, body); gr.addColorStop(1, shade(body, -0.18));
  g.fillStyle = gr; rr(g, x, waist, w, -5 - waist, 6); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
  g.fillStyle = shade(body, 0.08);
  g.beginPath(); g.moveTo(x + 5, waist + 1); g.lineTo(x + w * 0.18, top + 2); g.lineTo(-x - w * 0.18, top + 2); g.lineTo(-x - 5, waist + 1); g.closePath(); g.fill(); g.stroke();
  // 뒷유리
  const gx = kind === 'bus' ? 4 : w * 0.22, gy = top + (kind === 'bus' ? 6 : 5), gh = (waist - gy) - 3;
  g.fillStyle = '#9fcff5'; g.beginPath(); g.moveTo(x + gx - 2, waist - 2); g.lineTo(x + gx + 2, gy); g.lineTo(-x - gx - 2, gy); g.lineTo(-x - gx + 2, waist - 2); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(x + gx + 4, waist - 4); g.lineTo(x + gx + 6, gy + 2); g.lineTo(x + gx + 10, gy + 2); g.lineTo(x + gx + 8, waist - 4); g.closePath(); g.fill();
  if (kind === 'bus') { g.fillStyle = INK; rr(g, -9, top + 8, 18, 6, 1.5); g.fill(); g.fillStyle = '#ffd25e'; g.font = 'bold 5px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2026', 0, top + 11.2); }
  if (kind === 'taxi') { g.fillStyle = '#fff'; rr(g, -9, top - 6, 18, 7, 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke(); g.fillStyle = INK; g.font = 'bold 5.5px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TAXI', 0, top - 2.3); }
  // 후미등·번호판·범퍼
  const ty = waist + 3;
  g.fillStyle = '#ff5a5a'; rr(g, x + 2.5, ty, 9, 5, 2); g.fill(); rr(g, -x - 11.5, ty, 9, 5, 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; rr(g, x + 4, ty + 1, 3, 1.5, 1); g.fill(); rr(g, -x - 10, ty + 1, 3, 1.5, 1); g.fill();
  g.fillStyle = '#fff'; rr(g, -7, -13, 14, 6, 1.5); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  g.fillStyle = shade(body, -0.35); rr(g, x + 1, -8, w - 2, 3.5, 1.5); g.fill();
  if (opt.player) {   // 내 차: 흰 줄 두 개 + 별 + 배기구
    g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, -6, top + 2, 4, -7 - top, 1); g.fill(); rr(g, 2, top + 2, 4, -7 - top, 1); g.fill();
    star(g, 0, waist + 6, 5, '#ffd25e');
    g.fillStyle = '#6b7086'; rr(g, x + 7, -6, 6, 3.5, 1.5); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  }
}

/* ===== 게임 ===== */
export function createChase(root, opts = {}) {
  root.innerHTML = `<div class="cs-scr" tabindex="-1"><canvas aria-label="카체이싱! 게임 화면"></canvas><div class="hr-ov cs-ov" hidden></div>
      <div class="cs-rot" aria-live="polite"><i aria-hidden="true"></i><b>화면을 가로로 돌려 주세요</b><span>카체이싱!은 가로 화면에서 해요</span></div></div>
    <div class="hr-bar cs-bar"><p class="hr-keys cs-keys"><span class="hk"><span data-ka="left"></span><span data-ka="right"></span> 이동</span><span class="hk-dot"> · </span><span class="hk"><span data-ka="jump"></span> 점프</span></p><button type="button" class="btn ghost hr-snd cs-snd" aria-pressed="false"></button></div>`;
  const scr = root.querySelector('.cs-scr'), cv = scr.querySelector('canvas'), ov = scr.querySelector('.cs-ov'), sndBtn = root.querySelector('.cs-snd');
  const g = cv.getContext('2d', { alpha: false });
  const sfx = makeSfx(); sfx.set(!!opts.sound);
  let best = opts.best || 0, dpr = 1, k = 1, alive = true, raf = 0;
  const art = new Map();   // 그림 캐시
  const st = { scene: 'ready', shownAt: 0 };
  let s = null, seed = null, saved = false, evs = [], held = { L: 0, R: 0 }, jq = 0, acc = 0, last = 0, countT = 0, crashT = 0, pauseFrom = '';
  let msgNow = null;
  let parts = [], pops = [], shake = 0, flash = 0, warnShown = -1, evRun = 0, tStart = 0;
  const deco = [];   // 길가 나무·덤불(그림만, 판과 무관)
  for (let i = 0; i < 24; i++) deco.push({ side: i % 2, y: i * 113, t: i % 4 === 3 ? 'bush' : 'tree', r: i * 7 % 5 });

  /* --- 크기: 논리 960×540을 화면 픽셀에 맞춰 선명하게 --- */
  const fit = () => {
    const w = cv.clientWidth; if (!w) return;
    dpr = Math.min(3, window.devicePixelRatio || 1); k = w / VW;
    const pw = Math.round(w * dpr), ph = Math.round(w * VH / VW * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; art.clear(); }
  };
  const ro = new ResizeObserver(() => { fit(); draw(); }); ro.observe(cv);
  // 세로 화면 터치 기기: 돌려 달라는 안내 + 하던 판은 멈춤
  const portMQ = matchMedia(PORTRAIT);
  const onPort = () => { root.classList.toggle('cs-port', portMQ.matches); if (portMQ.matches) blur(); };
  portMQ.addEventListener?.('change', onPort);

  // 그림 한 장: 원점 = 바닥 가운데(oy = 위로 얼마나 그리는지). 화면 배율(k·dpr)의 1.6배로 그려 두고 줄여서 찍음
  const SQ = 1.6;
  const sheet = (key, w, h, paint) => {
    let a = art.get(key);
    if (!a) {
      const sc = k * dpr * SQ, pad = 10, c = document.createElement('canvas');
      c.width = Math.ceil((w + pad * 2) * sc); c.height = Math.ceil((h + pad * 2) * sc);
      const x = c.getContext('2d'); x.scale(sc, sc); x.translate(w / 2 + pad, h + pad); paint(x);
      a = { c, W: w + pad * 2, H: h + pad * 2, pad, h }; art.set(key, a);
    }
    return a;
  };
  // 바닥 점(x, y)에 배율 sc로 세움
  const put = (a, x, y, sc, alpha = 1) => { if (alpha < 1) g.globalAlpha = alpha; g.drawImage(a.c, x - a.W / 2 * sc, y - (a.h + a.pad) * sc, a.W * sc, a.H * sc); if (alpha < 1) g.globalAlpha = 1; };
  const PLAYER_COL = '#3d7bff';
  const carArt = (kind, col, hw, player = false) => { const w = (hw + 3) * 2, h = CAR_H[kind] || 27; return sheet(`r:${kind}:${col}:${player}`, w, h + 8, x => rearArt(x, kind, TRAFFIC[col] || col, w, h, { player })); };
  const playerArt = () => carArt('car', PLAYER_COL, C.P_HW + 3, true);
  const itemArt = t => sheet('i:' + t, 30, 34, x => {
    x.lineJoin = 'round';
    x.fillStyle = 'rgba(20,18,50,.28)'; x.beginPath(); x.ellipse(2, -1, 13, 4.5, 0, 0, 7); x.fill();
    if (t === 'coin') {
      x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.arc(0, -15, 11, 0, 7); x.stroke();
      x.fillStyle = '#c98a00'; x.beginPath(); x.arc(1.5, -15, 11, 0, 7); x.fill();
      const gr = x.createRadialGradient(-4, -19, 1, 0, -15, 12); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.6, '#ffd25e'); gr.addColorStop(1, '#f0a81c');
      x.fillStyle = gr; x.beginPath(); x.arc(0, -15, 11, 0, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
      x.strokeStyle = '#c98a00'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, -15, 7, 0, 7); x.stroke(); star(x, 0, -15, 4.5, '#fff2a8');
    } else if (t === 'fuel') {
      x.strokeStyle = '#fff'; x.lineWidth = 6; rr(x, -11, -27, 22, 26, 4); x.stroke();
      x.fillStyle = '#d93c3c'; rr(x, -11, -27, 22, 26, 4); x.fill(); x.fillStyle = '#ff5a5a'; rr(x, -11, -27, 17, 26, 4); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; rr(x, -11, -27, 22, 26, 4); x.stroke();
      x.fillStyle = '#ffd25e'; rr(x, 2, -32, 7, 6, 1.5); x.fill(); x.lineWidth = 1.5; x.stroke();
      x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(-6, -27); x.lineTo(-6, -31); x.lineTo(-1, -31); x.lineTo(-1, -27); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -21); x.bezierCurveTo(5, -14, 5, -8, 0, -8); x.bezierCurveTo(-5, -8, -5, -14, 0, -21); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke();
    } else if (t === 'box') {
      x.strokeStyle = '#fff'; x.lineWidth = 6; rr(x, -13, -30, 26, 28, 5); x.stroke();
      x.fillStyle = '#7a5cff'; rr(x, -13, -30, 26, 28, 5); x.fill();
      const gr = x.createLinearGradient(-13, -30, 13, -4); gr.addColorStop(0, '#ff8fd0'); gr.addColorStop(0.5, '#a98bff'); gr.addColorStop(1, '#5ec8ff');
      x.fillStyle = gr; rr(x, -13, -30, 26, 22, 5); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; rr(x, -13, -30, 26, 28, 5); x.stroke();
      x.fillStyle = '#fff'; x.font = `20px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3; x.strokeText('?', 0, -18); x.fillText('?', 0, -18);
    } else if (t === 'cone') {
      x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(-3, -28); x.lineTo(3, -28); x.lineTo(10, -4); x.lineTo(-10, -4); x.closePath(); x.stroke();
      x.fillStyle = '#ff8a3d'; x.beginPath(); x.moveTo(-3, -28); x.lineTo(3, -28); x.lineTo(10, -4); x.lineTo(-10, -4); x.closePath(); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(-5.5, -19); x.lineTo(5.5, -19); x.lineTo(7, -14); x.lineTo(-7, -14); x.closePath(); x.fill();
      x.fillStyle = '#ff8a3d'; rr(x, -13, -5, 26, 5, 2); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
    }
  });
  const wallArt = () => sheet('w', C.ROAD_R - C.ROAD_L, 32, x => {
    const w = C.ROAD_R - C.ROAD_L, h = 17, top = -29;
    x.fillStyle = 'rgba(20,18,50,.3)'; x.beginPath(); x.ellipse(3, -1, w / 2, 5, 0, 0, 7); x.fill();
    for (const lx of [-w / 2 + 16, -w / 6, w / 6, w / 2 - 16]) { x.fillStyle = '#8b90a3'; x.fillRect(lx - 2, top + h - 2, 4, -top - h + 2); x.strokeStyle = INK; x.lineWidth = 1.4; x.strokeRect(lx - 2, top + h - 2, 4, -top - h + 2); }
    x.strokeStyle = '#fff'; x.lineWidth = 6; rr(x, -w / 2, top, w, h, 4); x.stroke();
    x.save(); rr(x, -w / 2, top, w, h, 4); x.clip(); x.fillStyle = '#fff'; x.fillRect(-w / 2, top, w, h);
    x.fillStyle = '#ff6b3d'; for (let i = -w / 2 - 20; i < w / 2; i += 22) { x.beginPath(); x.moveTo(i, top + h); x.lineTo(i + 11, top); x.lineTo(i + 22, top); x.lineTo(i + 11, top + h); x.fill(); }
    x.restore(); x.strokeStyle = INK; x.lineWidth = 2; rr(x, -w / 2, top, w, h, 4); x.stroke();
    for (const lx of [-w / 2 + 14, 0, w / 2 - 14]) { x.fillStyle = '#ffd25e'; x.beginPath(); x.arc(lx, top - 2, 4, 0, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke(); }
  });
  const treeArt = v => sheet('t' + v, 40, 60, x => {
    x.fillStyle = 'rgba(20,18,50,.22)'; x.beginPath(); x.ellipse(3, -1, 15, 4, 0, 0, 7); x.fill();
    x.fillStyle = '#9b6b43'; rr(x, -3, -18, 6, 18, 2); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.6; x.stroke();
    const c = [['#5cbf6e', '#7fd68e'], ['#4fae63', '#6fcb80'], ['#6cc96a', '#93dc84']][v % 3];
    if (v % 3 === 2) { x.fillStyle = c[0]; x.beginPath(); x.moveTo(0, -60); x.lineTo(16, -18); x.lineTo(-16, -18); x.closePath(); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke(); x.fillStyle = c[1]; x.beginPath(); x.moveTo(0, -54); x.lineTo(6, -38); x.lineTo(-4, -38); x.closePath(); x.fill(); return; }
    x.fillStyle = c[0]; x.beginPath(); x.arc(0, -34, 17, 0, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke();
    x.fillStyle = c[1]; x.beginPath(); x.arc(-6, -40, 7, 0, 7); x.fill();
  });
  const bushArt = () => sheet('b', 26, 20, x => {
    x.fillStyle = 'rgba(20,18,50,.2)'; x.beginPath(); x.ellipse(2, -1, 12, 3.5, 0, 0, 7); x.fill();
    x.fillStyle = '#7ccf6a'; x.beginPath(); x.arc(-6, -8, 7, 0, 7); x.arc(6, -8, 7, 0, 7); x.arc(0, -13, 8, 0, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.6; x.stroke();
    [['#ff8fb3', -6, -10], ['#ffd25e', 5, -13], ['#fff', 1, -6]].forEach(([c, a, b]) => { x.fillStyle = c; x.beginPath(); x.arc(a, b, 2.2, 0, 7); x.fill(); });
  });
  // 하늘(지평선 위) — 크기 바뀔 때만 다시 그림
  const skyArt = () => {
    let a = art.get('sky'); if (a) return a;
    const sc = k * dpr, c = document.createElement('canvas'); c.width = Math.ceil(VW * sc); c.height = Math.ceil((HZ + 4) * sc);
    const x = c.getContext('2d'); x.scale(sc, sc);
    const gr = x.createLinearGradient(0, 0, 0, HZ); gr.addColorStop(0, '#7fc4ff'); gr.addColorStop(1, '#d6efff'); x.fillStyle = gr; x.fillRect(0, 0, VW, HZ + 4);
    // 먼 산·건물 실루엣(지평선)
    x.fillStyle = '#b5d7ef'; x.beginPath(); x.moveTo(0, HZ + 2); for (let i = 0; i <= 12; i++) x.lineTo(i * 80, HZ - 10 - ((i * 37) % 17)); x.lineTo(VW, HZ + 2); x.fill();
    x.fillStyle = '#9cc4e4';
    for (let i = 0; i < 22; i++) { const bx = (i * 47 + (i % 3) * 13) % VW, bw = 18 + (i * 11) % 22, bh = 10 + (i * 23) % 26; if (Math.abs(bx + bw / 2 - CX) < 40) continue; x.fillRect(bx, HZ - bh, bw, bh + 2); }
    x.fillStyle = '#fff'; for (const [cx, cy, r] of [[140, 20, 12], [165, 16, 15], [190, 22, 11], [700, 14, 11], [722, 10, 14], [748, 15, 10]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    a = { c }; art.set('sky', a); return a;
  };

  /* --- 입력: 왼쪽 1/3 = 이동(왼쪽 반 ◀ · 오른쪽 반 ▶), 나머지 = 점프 --- */
  const KM = opts.keys || (() => '');
  const ptr = new Map();
  const zoneOf = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; return x < 0.16 ? 'L' : x < 0.33 ? 'R' : 'J'; };
  held.kL = 0; held.kR = 0;
  const syncHeld = () => { let L = 0, R = 0; for (const z of ptr.values()) { if (z === 'L') L = 1; if (z === 'R') R = 1; } held.L = held.kL || L ? 1 : 0; held.R = held.kR || R ? 1 : 0; };
  let touchSeen = TOUCHY();
  const onDown = e => {
    if (e.button > 0) return; e.preventDefault(); sfx.unlock(); if (e.pointerType === 'touch') touchSeen = true;
    if (portMQ.matches) return;
    if (st.scene === 'ready') { start(); return; }
    if (st.scene === 'over') { again(); return; }
    if (st.scene === 'pause') { resume(); return; }
    const z = zoneOf(e); ptr.set(e.pointerId, z); try { cv.setPointerCapture(e.pointerId); } catch {}
    if (z === 'J') jq++;
    syncHeld();
  };
  const onMove = e => { if (!ptr.has(e.pointerId)) return; const z = zoneOf(e), o = ptr.get(e.pointerId); if (z !== o && o !== 'J' && z !== 'J') { ptr.set(e.pointerId, z); syncHeld(); } };
  const onUp = e => { if (ptr.delete(e.pointerId)) syncHeld(); };
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
  function blur() { held.kL = held.kR = 0; ptr.clear(); syncHeld(); if (st.scene === 'play' || st.scene === 'count') pause(); }
  const vis = () => { if (document.hidden) blur(); };
  window.addEventListener('blur', blur); document.addEventListener('visibilitychange', vis);

  /* --- 화면 위 안내(글자는 DOM이라 또렷함) --- */
  const keyTxt = () => opts.keyText ? opts.keyText() : '← → 이동 · Space 점프';
  const showReady = () => {
    ov.hidden = false; ov.className = 'hr-ov cs-ov cs-ready';
    ov.innerHTML = `<b>카체이싱!</b><span>차 사이를 아슬아슬하게 스쳐 부스터를 모아요</span>${best ? `<em class="sr-best cs-best">${opts.trophy || ''}내 최고 ${fmt(best)}점</em>` : ''}
      <ul class="cs-how"><li><i class="cs-i1"></i>차 옆을 <b>아슬아슬</b>하게 스치면 보너스 · 연속이면 콤보</li><li><i class="cs-i2"></i>게이지가 꽉 차면 <b>부스터</b> — 앞차를 날려 버려요</li><li><i class="cs-i3"></i><b>연료통</b>을 먹어야 계속 달려요 · 바리케이드는 점프!</li></ul>
      <small>${touchSeen ? '왼쪽 = ◀ ▶ 이동 · 오른쪽 = 점프 — 화면을 눌러 출발' : keyTxt() + ' — 아무 키나 눌러 출발'}</small>`;
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
  function start() {
    if (st.scene !== 'ready' || portMQ.matches) return;
    ov.hidden = true; st.scene = 'count'; countT = 0; evRun++;
    const my = evRun; seed = null; saved = false;
    Promise.resolve(opts.seed ? opts.seed() : null).catch(() => null).then(x => { if (my === evRun) { seed = x; saved = x != null; } return x; });
    s = null; tStart = 0; resetFx();
    sfx.beep(false);
  }
  function begin() {   // 카운트다운 끝 → 판 시작
    const sd = seed != null ? seed : (Math.random() * 4294967296) >>> 0;
    s = C.newSim(sd, true); evs = []; jq = 0; acc = 0; st.scene = 'play'; tStart = performance.now();
    held.kL = held.kR = 0; ptr.clear(); syncHeld();
    opts.onStart?.(saved);
  }
  function resetFx() { parts = []; pops = []; shake = 0; flash = 0; warnShown = -1; }
  function again() {
    if (st.scene !== 'over' || performance.now() - st.shownAt < 500) return;
    st.scene = 'ready'; s = null; resetFx(); opts.onReady?.(); start();   // 끝난 뒤 누르면 바로 카운트다운
  }
  function pause() { if (st.scene !== 'play' && st.scene !== 'count') return; pauseFrom = st.scene; st.scene = 'pause'; sfx.engine(0); showPause(); }
  function resume() { if (st.scene !== 'pause' || portMQ.matches) return; ov.hidden = true; held.kL = held.kR = 0; ptr.clear(); syncHeld(); st.scene = pauseFrom === 'count' ? 'count' : 'resume'; countT = 0; last = performance.now(); }

  /* --- 효과(화면 좌표) --- */
  const burst = (x, y, n, cols, sp = 160, life = 0.6, sz = 4) => { if (RM()) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.4 + Math.random() * 0.8); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c: cols[i % cols.length], sz: sz * (0.6 + Math.random() * 0.8) }); } };
  const pop = (x, y, t, c = '#fff', big = 0) => pops.push({ x, y, t, c, big, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8 });
  // 판 좌표로 부르는 것(lift = 바닥에서 위로 띄울 높이, 화면 단위 × 깊이 배율)
  const bW = (x, y, lift, n, cols, sp, life, sz) => { const q = ps(y); burst(sxOf(x, q), syOf(q) - lift * q * PK, n, cols, sp * q * PK * 0.6, life, (sz || 4) * q * PK * 0.6); };
  const pW = (x, y, lift, t, c, big) => { const q = ps(y); pop(sxOf(x, q), syOf(q) - lift * q * PK, t, c, big); };
  function handle(e) {
    const py = C.PY + C.P_HH;
    switch (e.t) {
      case 'near': {
        const sx = e.x < s.p.x ? s.p.x - 18 : s.p.x + 18;
        bW(sx, py, 12, 12, ['#fff', '#ffd25e', '#7fd4ff'], 220, 0.4, 3);
        pW(s.p.x, py, 58, e.combo > 1 ? `아슬아슬! x${e.combo}` : '아슬아슬!', '#ffd25e', 1); pW(sx, py, 36, '+' + e.pts, '#fff');
        sfx.near(e.combo); break;
      }
      case 'coin': bW(e.x, py, 14, 6, ['#ffd25e', '#fff'], 110, 0.35, 3); pW(e.x, py, 40, '+10', '#ffd25e'); sfx.coin(); break;
      case 'fuel': bW(e.x, py, 14, 12, ['#ff5a5a', '#fff', '#ffd25e'], 150, 0.5); pW(e.x, py, 48, '연료 +' + C.CAN, '#ff8a8a', 1); sfx.fuel(); break;
      case 'box': bW(e.x, py, 14, 18, ['#ff8fd0', '#a98bff', '#5ec8ff', '#fff'], 230, 0.6); sfx.box(); break;
      case 'boost': flash = 0.35; shake = Math.max(shake, 0.15); pop(VW / 2, 200, '부스터!', '#7fd4ff', 1); sfx.boost(); break;
      case 'smash': bW(e.x, e.y + 20, 14, e.wall ? 22 : 14, ['#fff', '#ffd25e', '#ff8a3d', '#9aa3b5'], 280, 0.6); shake = Math.max(shake, 0.18); pW(e.x, e.y + 20, 44, e.wall ? '+20' : '+50', '#fff'); sfx.smash(); break;
      case 'jump': sfx.jump(); break;
      case 'land': bW(s.p.x, py, 2, 8, ['#cfd4df', '#fff'], 90, 0.35, 3); sfx.land(); break;
      case 'crash': bW(e.x, py, 14, 40, ['#ff5a5a', '#ffd25e', '#fff', '#2a2846', '#ff8a3d'], 360, 0.9, 5); shake = 0.6; flash = 0.5; sfx.crash(); sfx.engine(0); break;
      case 'empty': pop(VW / 2, 230, '기름이 떨어졌어요!', '#ff8a8a', 1); sfx.empty(); break;
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
    if (shake > 0 && !RM()) g.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 10 * shake);
    drawRoad(dist);
    drawDeco(dist);
    if (s) drawWorld(a); else drawIdle();
    for (const p of parts) { g.globalAlpha = clamp(p.life / p.max, 0, 1); g.fillStyle = p.c; g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    g.globalAlpha = 1;
    for (const p of pops) {
      const t = 1 - p.life / p.max, al = t > 0.7 ? (1 - t) / 0.3 : 1, sz = (p.big ? 28 : 18) * (t < 0.12 ? 0.7 + t * 2.5 : 1);
      g.globalAlpha = al; g.font = `${sz}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = p.big ? 5 : 4; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(p.t, p.x, p.y); g.fillStyle = p.c; g.fillText(p.t, p.x, p.y);
    }
    g.globalAlpha = 1;
    g.restore();
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${(flash * 1.4).toFixed(3)})`; g.fillRect(0, 0, VW, VH); }
    if (s) drawHud();
    if (st.scene === 'count' || st.scene === 'resume') drawCount();
    if (touchSeen && (st.scene === 'play' || st.scene === 'count' || st.scene === 'resume')) drawPads();
  }
  // 바닥에 깔린 사다리꼴(판 좌표 x1~x2, y1(먼 쪽)~y2(가까운 쪽))
  const trap = (x1, x2, y1, y2, fill) => {
    const a = ps(y1), b = ps(y2), t = syOf(a), u = syOf(b);
    g.beginPath(); g.moveTo(sxOf(x1, a), t); g.lineTo(sxOf(x2, a), t); g.lineTo(sxOf(x2, b), u); g.lineTo(sxOf(x1, b), u); g.closePath(); g.fillStyle = fill; g.fill();
  };
  const NEAR = C.PY + 30;   // 달린 거리 w인 바닥의 판 y = NEAR - (w - dist)
  const bands = (dist, period, len, from, fn) => { for (let n = Math.floor((dist + NEAR - Y_BOT) / period); n * period < dist + NEAR - from; n++) { const y2 = NEAR - (n * period - dist); fn(y2 - len, y2, n); } };
  function drawRoad(dist) {
    g.drawImage(skyArt().c, 0, 0, VW, HZ + 4);
    g.fillStyle = '#93d374'; g.fillRect(0, HZ, VW, VH - HZ);
    bands(dist, 180, 90, Y_FAR, (y1, y2) => trap(-900, 1260, Math.max(y1, Y_FAR), Math.min(y2, Y_BOT), '#9fdb80'));   // 잔디 줄무늬(속도감)
    trap(C.ROAD_L - 16, C.ROAD_L, Y_FAR, Y_BOT, '#e6dfcf'); trap(C.ROAD_R, C.ROAD_R + 16, Y_FAR, Y_BOT, '#e6dfcf');   // 보도
    bands(dist, 40, 20, -4000, (y1, y2) => { trap(C.ROAD_L - 16, C.ROAD_L, y1, y2, '#d8cfbb'); trap(C.ROAD_R, C.ROAD_R + 16, y1, y2, '#d8cfbb'); });
    trap(C.ROAD_L - 3, C.ROAD_L, Y_FAR, Y_BOT, '#9aa0b3'); trap(C.ROAD_R, C.ROAD_R + 3, Y_FAR, Y_BOT, '#9aa0b3');   // 연석
    trap(C.ROAD_L, C.ROAD_R, Y_FAR, Y_BOT, '#4a5066');   // 도로
    bands(dist, 230, 14, -5000, (y1, y2, n) => { const x = C.ROAD_L + 30 + ((n * 97) % 210 + 210) % 210; trap(x, x + 34, y1, y2, 'rgba(255,255,255,.045)'); });
    trap(C.ROAD_L + 3, C.ROAD_L + 6, Y_FAR, Y_BOT, '#fff'); trap(C.ROAD_R - 6, C.ROAD_R - 3, Y_FAR, Y_BOT, '#fff');
    bands(dist, 70, 34, -6000, (y1, y2) => { for (let l = 1; l < C.LANES; l++) { const x = C.ROAD_L + l * C.LANE_W; trap(x - 1.7, x + 1.7, y1, y2, 'rgba(255,255,255,.88)'); } });
    // 출발선 · 1km마다 바닥 글씨
    const y0 = NEAR + dist;
    if (y0 > -6000 && y0 - 16 < Y_BOT) for (let i = 0; i < 20; i++) for (let j = 0; j < 2; j++) trap(C.ROAD_L + i * 15, C.ROAD_L + i * 15 + 15, y0 - 16 + j * 8, y0 - 8 + j * 8, (i + j) % 2 ? '#fff' : INK);
    const km = Math.floor(dist / 10000) * 10000;
    for (const w of [km, km + 10000]) {
      const y = NEAR - (w - dist); if (w <= 0 || y < -3000 || y > Y_BOT) continue;
      const q = ps(y);
      g.save(); g.translate(CX, syOf(q)); g.scale(q * PK, q * PK * 0.32); g.font = `56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(fmt(w / 10) + 'm', 0, 0); g.restore();
    }
  }
  // 길가 나무·덤불(먼 것부터)
  const decoTmp = [];
  function drawDeco(dist) {
    decoTmp.length = 0;
    const span = 24 * 113 * 2;
    for (const d of deco) {
      const y = ((d.y * 2 + dist) % span) - span + Y_BOT + 40; if (y < -9000 || y > Y_BOT + 60) continue;
      const x = d.t === 'tree' ? (d.side ? C.ROAD_R + 34 + d.r * 22 : C.ROAD_L - 34 - d.r * 22) : (d.side ? C.ROAD_R + 9 : C.ROAD_L - 9);
      decoTmp.push([y, x, d]);
    }
    decoTmp.sort((p, q) => p[0] - q[0]);
    for (const [y, x, d] of decoTmp) { const q = ps(y), sy = syOf(q); if (sy < HZ) continue; put(d.t === 'tree' ? treeArt(d.r) : bushArt(), sxOf(x, q), sy, q * PK * 0.75, fade(sy)); }
  }
  const fade = sy => clamp((sy - HZ - 6) / 70, 0, 1);   // 멀리서 나타나는 것은 서서히
  function drawIdle() {   // 시작 전: 내 차만 출발선에
    const q = ps(C.PY + C.P_HH); put(playerArt(), sxOf(C.laneX(1) + C.LANE_W / 2, q), syOf(q), q * PK * 0.95);
  }
  const list = [];
  function drawWorld(a) {
    const P = s.p, px = lerp(P._px ?? P.x, P.x, a);
    // 부스터 속도선(소실점 쪽으로)
    if (s.boost > 0 && !RM()) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2.5; for (let i = 0; i < 18; i++) { const x = -120 + ((i * 53) % 540), y = ((i * 131 + s.f * 30) % 1300) - 700, q1 = ps(y - 90), q2 = ps(y); g.beginPath(); g.moveTo(sxOf(x, q1), syOf(q1)); g.lineTo(sxOf(x, q2), syOf(q2)); g.stroke(); } }
    // 깊이 순서(먼 것부터): 바닥 것들·바리케이드·차·내 차를 한 줄로 — 기준 = 뒤쪽 끝(가까운 쪽)
    list.length = 0;
    for (const it of s.items) if (!it.got) list.push([lerp(it._py ?? it.y, it.y, a) + it.hh, 0, it]);
    for (const c of s.cars) list.push([lerp(c._py ?? c.y, c.y, a) + c.hh, 1, c]);
    list.push([C.PY + C.P_HH, 2, null]);
    list.sort((p, q) => p[0] - q[0]);
    for (const [y, t, o] of list) {
      const q = ps(y), sy = syOf(q); if (sy < HZ || sy > VH + 120) continue;
      const sc = q * PK * 0.95, al = clamp((y - C.FAR) / 260, 0, 1);   // 0.95 = 판 단위 → 그림 크기 · 멀리서 생긴 것은 서서히 나타남
      if (t === 0) {
        if (o.t === 'wall') put(wallArt(), sxOf(o.x, q), sy, q * PK, al);
        else if (o.t === 'box') put(itemArt('box'), sxOf(o.x, q), sy - Math.abs(Math.sin((s.f + o.id * 7) * 0.12)) * 6 * sc, sc * 0.9, al);
        else if (o.t === 'coin') { const sp = Math.abs(Math.cos((s.f + o.id * 9) * 0.09)); g.save(); g.translate(sxOf(o.x, q), sy); g.scale(0.3 + sp * 0.7, 1); put(itemArt('coin'), 0, 0, sc, al); g.restore(); }
        else put(itemArt(o.t), sxOf(o.x, q), sy, sc * (o.t === 'cone' ? 1 : 0.85), al);
      } else if (t === 1) {
        const x = lerp(o._px ?? o.x, o.x, a), art2 = carArt(o.k, o.col, o.hw), cx = sxOf(x, q);
        if (o.dead) {   // 부스터로 날아감
          const tt = o.dead / 50, dir = o.id % 2 ? 1 : -1;
          g.save(); g.globalAlpha = clamp(1 - tt * 1.2, 0, 1); g.translate(cx + dir * tt * 260, sy - tt * 200); g.rotate(dir * tt * 7); put(art2, 0, 0, sc * (1 + tt * 0.5)); g.restore(); continue;
        }
        put(art2, cx, sy, sc, al);
        if ((o.blink || o.mv) && (s.f >> 3) % 2 === 0) {   // 깜빡이(후미등 자리)
          const side = o.to > o.lane ? 1 : -1, bx = cx + side * (o.hw + 1) * sc, by = sy - (CAR_H[o.k] || 27) * 0.42 * sc;
          g.fillStyle = '#ffb03a'; g.beginPath(); g.arc(bx, by, 5 * sc, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
        }
      } else drawPlayer(px, q, sy, sc, a);
    }
    // 바리케이드 경고
    const wall = s.items.find(it => it.t === 'wall' && !it.got && it.y > -1200 && it.y < C.PY - 40);
    if (wall) {
      if (warnShown !== wall.id) { warnShown = wall.id; sfx.warn(); }
      const now = C.PY - wall.y < s.v * 0.5 + 30, ok = !s.p.air && !s.p.cd;
      if (now || (s.f >> 3) % 2 === 0 || RM()) {
        g.save(); g.translate(VW / 2, 128);
        g.fillStyle = now ? (ok ? '#7be08a' : '#ffd25e') : '#ffd25e'; g.strokeStyle = '#fff'; g.lineWidth = 6; rr(g, -96, -26, 192, 52, 13); g.stroke(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
        g.font = `27px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText(now ? '지금 점프!' : '▲ 바리케이드!', 0, 2);
        g.restore();
      }
    }
  }
  function drawPlayer(px, q, sy, sc, a) {
    const P = s.p, air = P.air > 0 ? Math.sin((1 - (P.air - a) / C.JUMP_F) * Math.PI) : 0, cx = sxOf(px, q);
    const art2 = playerArt();
    if (air > 0) { g.fillStyle = 'rgba(20,18,50,.3)'; g.beginPath(); g.ellipse(cx + 3, sy, 22 * sc * (1 - air * 0.25), 6 * sc, 0, 0, 7); g.fill(); }
    const lift = air * 46 * sc;
    if (s.boost > 0) {   // 부스터 불꽃·빛(뒤쪽 배기구)
      g.fillStyle = 'rgba(127,212,255,.28)'; g.beginPath(); g.ellipse(cx, sy - 14 * sc - lift, 34 * sc, 24 * sc, 0, 0, 7); g.fill();
      for (const ox of [-8, 8]) { const fl = (10 + Math.random() * 12) * sc; g.fillStyle = '#ffd25e'; g.beginPath(); g.moveTo(cx + (ox - 4) * sc, sy - 6 * sc - lift); g.lineTo(cx + ox * sc, sy - 6 * sc + fl - lift); g.lineTo(cx + (ox + 4) * sc, sy - 6 * sc - lift); g.fill(); g.fillStyle = '#ff6b3d'; g.beginPath(); g.moveTo(cx + (ox - 2) * sc, sy - 6 * sc - lift); g.lineTo(cx + ox * sc, sy - 6 * sc + fl * 0.6 - lift); g.lineTo(cx + (ox + 2) * sc, sy - 6 * sc - lift); g.fill(); }
    }
    const wreck = (st.scene === 'crash' || st.scene === 'over') && (s.over === 'crash' || s.over === 'wall' || s.over === 'cone');
    const blinkOff = (s.grace > 0 || (s.boost > 0 && s.boost < 50)) && (s.f >> 2) % 2 === 0;
    const tilt = clamp(P.vx / C.SIDE_V, -1, 1) * 0.07;
    g.save(); g.translate(cx, sy - lift);
    if (wreck) g.rotate((0.25 + Math.min(crashT / 600, 1) * 0.35) * (px < RX ? -1 : 1)); else if (tilt) g.rotate(tilt);
    put(art2, 0, 0, sc * (1 + air * 0.12), blinkOff ? 0.45 : 1);
    g.restore();
    if (wreck) { g.fillStyle = 'rgba(80,80,100,.35)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + Math.sin(crashT / 200 + i) * 12 * sc, sy - 30 * sc - i * 16 * sc - crashT / 30, (10 + i * 4) * sc, 0, 7); g.fill(); } }
  }
  function bar(x, y, w, h, v, col, label, warn) {
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5; rr(g, x, y, w, h, 7); g.fill(); g.stroke();
    if (v > 0) { g.save(); rr(g, x + 2, y + 2, w - 4, h - 4, 5); g.clip(); g.fillStyle = col; g.fillRect(x + 2, y + 2, (w - 4) * clamp(v, 0, 1), h - 4); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x + 2, y + 2, (w - 4) * clamp(v, 0, 1), 3); g.restore(); }
    g.font = `15px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = INK; g.strokeText(label, x + 8, y + h / 2 + 0.5); g.fillStyle = warn ? '#ffd2d2' : '#fff'; g.fillText(label, x + 8, y + h / 2 + 0.5);
  }
  let scoreTxt = '', scoreV = -1, mTxt = '', mV = -1;
  function drawHud() {
    const scv = C.scoreOf(s), m = C.metersOf(s);
    if (scv !== scoreV) { scoreV = scv; scoreTxt = fmt(scv); }
    if (m !== mV) { mV = m; mTxt = fmt(m) + 'm'; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = `40px ${FONT}`; g.lineWidth = 7; g.strokeStyle = INK; g.strokeText(scoreTxt, VW / 2, 34); g.fillStyle = '#fff'; g.fillText(scoreTxt, VW / 2, 34);
    g.font = `17px ${FONT}`; g.lineWidth = 4; g.strokeText(mTxt, VW / 2, 64); g.fillStyle = '#ffd25e'; g.fillText(mTxt, VW / 2, 64);
    const low = s.fuel < 25 && s.fuel > 0, blink = low && (s.f >> 4) % 2 === 0;
    bar(16, 16, 190, 24, s.fuel / C.FUEL0, blink ? '#ff5a5a' : low ? '#ff8a5a' : '#ff6b6b', '연료', low);
    const bv = s.boost > 0 ? s.boost / C.BOOST_F : s.fever / 100;
    bar(VW - 206, 16, 190, 24, bv, s.boost > 0 ? `hsl(${(s.f * 6) % 360},90%,62%)` : '#5ec8ff', s.boost > 0 ? '부스터!' : '부스터', false);
    if (low && (s.f >> 4) % 2 === 0) { g.font = `16px ${FONT}`; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = INK; g.strokeText('연료 부족!', 18, 54); g.fillStyle = '#ff9a9a'; g.fillText('연료 부족!', 18, 54); }
    if (s.combo > 1) {
      const left = 1 - (s.f - s.lastNear) / C.COMBO_F;
      g.save(); g.translate(VW - 111, 60);
      g.font = `21px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = INK; g.strokeText('콤보 x' + s.combo, 0, 0); g.fillStyle = '#ffd25e'; g.fillText('콤보 x' + s.combo, 0, 0);
      g.fillStyle = 'rgba(42,40,70,.5)'; g.fillRect(-60, 14, 120, 5); g.fillStyle = '#ffd25e'; g.fillRect(-60, 14, 120 * clamp(left, 0, 1), 5);
      g.restore();
    }
  }
  function drawCount() {
    const total = st.scene === 'resume' ? 1000 : 3000, left = total - countT;
    let t, ph;
    if (left > 0) { t = String(Math.ceil(left / 1000)); ph = 1 - ((left / 1000) % 1 || 1); }
    else { t = seed != null || !opts.seed ? '출발!' : '연결 중…'; ph = 0.5; }
    const sz = (t.length > 2 ? 48 : 100) * (ph < 0.15 ? 0.6 + ph * 3 : 1);
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.font = `${sz}px ${FONT}`;
    g.lineWidth = 10; g.strokeStyle = INK; g.strokeText(t, VW / 2, 230); g.fillStyle = left > 0 ? '#fff' : '#ffd25e'; g.fillText(t, VW / 2, 230);
    if (st.scene === 'count' && !s) { g.font = `18px ${FONT}`; g.lineWidth = 4; const m = touchSeen ? '왼쪽 ◀ ▶ 이동 · 오른쪽 점프' : keyTxt(); g.strokeText(m, VW / 2, 300); g.fillStyle = '#fff'; g.fillText(m, VW / 2, 300); }
    g.restore();
  }
  function drawPads() {
    const P = s?.p, ready = !P || (!P.air && !P.cd);
    const pad = (x, y, r, on, paint) => {
      g.save(); g.globalAlpha = on ? 0.85 : 0.45; g.fillStyle = on ? '#fff' : 'rgba(255,255,255,.8)'; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.globalAlpha = on ? 1 : 0.75; paint(); g.restore();
    };
    const tri = (x, y, d) => { g.fillStyle = INK; g.beginPath(); g.moveTo(x + d * 12, y); g.lineTo(x - d * 8, y - 13); g.lineTo(x - d * 8, y + 13); g.closePath(); g.fill(); };
    pad(62, VH - 66, 40, held.L, () => tri(62, VH - 66, -1));
    pad(160, VH - 66, 40, held.R, () => tri(160, VH - 66, 1));
    pad(VW - 80, VH - 72, 46, ready, () => {
      if (!ready && P) { const f = P.air ? 0 : 1 - P.cd / C.JUMP_CD; g.strokeStyle = '#5ec8ff'; g.lineWidth = 5; g.beginPath(); g.arc(VW - 80, VH - 72, 40, -Math.PI / 2, -Math.PI / 2 + f * 6.283); g.stroke(); }
      g.font = `21px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText('점프', VW - 80, VH - 71);
    });
  }

  /* --- 소리 버튼 --- */
  const paintSnd = () => { const on = sfx.on, t = on ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${on ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', on); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', on); };
  sndBtn.onclick = () => { sfx.set(!sfx.on); paintSnd(); opts.onSound?.(sfx.on); sndBtn.blur(); };
  paintSnd();

  fit(); onPort();
  if (opts.quick && !portMQ.matches) { st.scene = 'ready'; start(); } else showReady();
  raf = requestAnimationFrame(frame);
  // 글꼴이 늦게 오면 캔버스 글자가 대체 글꼴로 그려짐 → 받으면 그림 캐시를 비움
  document.fonts?.load?.(`20px ${FONT}`, '카체이싱 점프 연료 부스터 아슬아슬 콤보 출발 연결 중 바리케이드 지금 0123456789,m+x!?…').then(() => { art.clear(); }).catch(() => {});

  return {
    st, get sim() { return s; }, get best() { return best; },
    setBest(b) { best = Math.max(best, b || 0); },
    msg(html) { msgNow = html; const m = ov.querySelector('.cs-msg'); if (m && st.scene === 'over') m.innerHTML = html; },   // 저장 응답이 결과 창보다 먼저 와도 남겨 둠
    setSound(on) { sfx.set(on); paintSnd(); },
    start, pause, resume, again: () => again(),
    _hold(l, r) { held.kL = l ? 1 : 0; held.kR = r ? 1 : 0; syncHeld(); }, _jump() { jq++; },   // 테스트용
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); sfx.set(false); evRun++;
      portMQ.removeEventListener?.('change', onPort);
      document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', vis);
    },
  };
}
