// SVMHS GROUND — 카체이싱! 화면 (2026-10-31 하율 "다함께 차차차처럼 — 플레이 방식까지 최대한 비슷하게, 바로 출시해도 될 정도로", 미리보기 깃발 chase-game)
// 규칙·판 진행은 chase-score.js(서버와 같음) — 여기는 그리기·입력·소리만. 판에 영향을 주는 값은 전부 시뮬레이션(s)에서 읽음.
// 2026-10-31 하율: "차차차 느낌으로" → 차 뒤에서 보는 원근 시점 · "가로로 넓게, 태블릿·폰은 돌려서" → 16:9 · "속도감 + 5차선 + 한 차선씩 + 실제 자동차처럼"
//   + "디자인 싹다 디벨롭 — 도형 느낌 없게": 하늘(해·구름·산·도시)·대기 원근·가드레일·가로등·아스팔트 결·차 그림자·반사, 유리 느낌 HUD.
// 판 좌표(도로 x 0~375, 세로 y)는 그대로 두고 그릴 때만 바꿈 → 규칙·점수·서버 검사와 무관. 세로 화면 터치 기기는 '가로로 돌려 주세요'.
import * as C from './chase-score.js';

const INK = '#2a2846';
const TRAFFIC = ['#eef0f3', '#2a2d36', '#a7afba', '#646d7a', '#c8322f', '#2d5bb0', '#3b6e52', '#d9c9a3', '#7c2a36', '#e2e5ea'];   // 실제 도로에 많은 색(흰색·검정·은색·회색 많이)
const FONT = '"Jua", "Pretendard Variable", system-ui, sans-serif';
const fmt = n => Math.floor(n).toLocaleString('ko-KR');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TOUCHY = () => matchMedia('(pointer:coarse)').matches;
const RM = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const PORTRAIT = '(orientation:portrait) and (pointer:coarse)';

/* ===== 화면 크기·시점 =====
   논리 화면 960×540. 깊이 배율 s(y) = PF / (PF + (PY0 - y)) · 화면 y = HZ + PB·s(지평선 HZ에서 s=0) · 화면 x = 가운데 + (x - 도로 가운데 - 카메라)·s·PK
   PF가 작을수록 원근이 세서 가까운 곳이 빨리 지나감(속도감). 내 차(판 y 512) ≈ 화면 450, 차가 생기는 곳(-1100) ≈ 120. 도로 폭: 내 차 근처 약 640px.
   위에서 내려다보는 각도라 차는 지붕·유리·보닛(위 모습) + 뒷면을 같이 그림
   카메라는 내 차를 40% 따라감(차선 바꿀 때 도로가 같이 흔들려 역동적) */
const VW = 960, VH = 540, HZ = 20;
const PF = 270, PY0 = 700, PB = 729.4, PK = 2.895, CX = VW / 2, RX = (C.ROAD_L + C.ROAD_R) / 2;   // 2026-10-31 23시 하율 "좀 더 위에서": 지평선을 화면 맨 위로, 원근을 세게(가까운 곳이 휙휙)
let CAM = 0;
const ps = y => PF / (PF + Math.max(PY0 - y, -PF * 0.6));
const sxOf = (x, s) => CX + (x - RX - CAM) * s * PK;
const syOf = s => HZ + PB * s;
const sAt = sy => (sy - HZ) / PB;
const yAt = sy => PY0 - PF * (1 / sAt(sy) - 1);
const Y_FAR = Math.max(yAt(HZ + 3), -30000), Y_BOT = yAt(VH + 40);   // 그리는 범위(판 y)
const SH = 22;   // 갓길 폭(판 단위)

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
    lane: () => noise(0.09, 0.05, 2600, 700),
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
// 차 뒷모습(원점 = 바닥 가운데, 위로 그림). w = 폭, h = 높이 — 2026-10-31 하율 "실제 자동차처럼, 종류 여러 가지"
// ===== 자동차(위에서 비스듬히 본 모습: 지붕·유리·보닛 + 뒷면) — 2026-10-31 하율 "좀 더 위에서 보는 시점" =====
// 한 장 안에 위 모습(앞이 위쪽, 길이 L)과 그 아래 뒷면(높이 B)을 같이 그림. 원점 = 위 모습 앞쪽 가운데.
export const CAR_B = { sedan: 13, compact: 13, hatch: 14, suv: 18, van: 21, sports: 10, taxi: 13, pickup: 15, truck: 26, police: 13, bus: 28, player: 12 };
const OL = '#1c1d2b';
const glass = (g, y1, y2) => { const gr = g.createLinearGradient(0, y1, 0, y2); gr.addColorStop(0, '#6b88a8'); gr.addColorStop(0.5, '#31425c'); gr.addColorStop(1, '#1d283a'); return gr; };
function plate(g, y, wide = 13) {
  g.fillStyle = '#f4f6f8'; rr(g, -wide / 2, y, wide, 5, 1); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = '#23263a'; for (let i = 0; i < 6; i++) g.fillRect(-wide / 2 + 1.5 + i * (wide - 3) / 6, y + 1.3, (wide - 3) / 6 - 0.7, 2.4);
}
function lamp(g, x, y, w2, h2, col = '#e8343a') {
  const gr = g.createLinearGradient(0, y, 0, y + h2); gr.addColorStop(0, '#ff9a9a'); gr.addColorStop(0.5, col); gr.addColorStop(1, '#9e1d22');
  g.fillStyle = gr; rr(g, x, y, w2, h2, Math.min(1.8, h2 / 2)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.5)'; rr(g, x + 0.8, y + 0.7, Math.max(1.2, w2 * 0.35), Math.max(0.8, h2 * 0.25), 0.8); g.fill();
}
// 위 모습 비율: hood(보닛 끝) · ws(앞유리 끝) · roof(지붕 끝) · rw(뒷유리 끝) · 종류마다
const TOP = {
  sedan: [0.27, 0.41, 0.66, 0.79], compact: [0.2, 0.36, 0.72, 0.9], hatch: [0.22, 0.37, 0.74, 0.93], suv: [0.22, 0.34, 0.86, 0.94],
  van: [0.1, 0.22, 0.96, 0.99], sports: [0.38, 0.5, 0.64, 0.75], taxi: [0.27, 0.41, 0.66, 0.79], police: [0.27, 0.41, 0.66, 0.79],
  pickup: [0.2, 0.3, 0.5, 0.53], player: [0.32, 0.45, 0.64, 0.76],
};
function carSheetArt(g, kind, col, w, L, B) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  const x = -w / 2, H = L + B;
  // 그림자(차 아래 전체)
  { const sg = g.createRadialGradient(0, H * 0.55, 2, 0, H * 0.55, H * 0.62); sg.addColorStop(0, 'rgba(8,10,22,.42)'); sg.addColorStop(0.7, 'rgba(8,10,22,.16)'); sg.addColorStop(1, 'rgba(8,10,22,0)');
    g.save(); g.translate(3, 4); g.scale(w * 0.62 / (H * 0.62), 1); g.fillStyle = sg; g.beginPath(); g.arc(0, H * 0.55, H * 0.62, 0, 7); g.fill(); g.restore(); }
  const tire = (ty, th) => { g.fillStyle = '#16171d'; rr(g, x - 2, ty, 5, th, 1.8); g.fill(); rr(g, -x - 3, ty, 5, th, 1.8); g.fill(); };
  if (kind === 'truck') {
    const box = shade(col, 0.3), cab = col;
    tire(L * 0.05, L * 0.1); tire(L * 0.72, L * 0.1); tire(L * 0.86, L * 0.1);
    // 운전석
    const cg = g.createLinearGradient(x, 0, -x, 0); cg.addColorStop(0, shade(cab, -0.15)); cg.addColorStop(0.5, shade(cab, 0.18)); cg.addColorStop(1, shade(cab, -0.2));
    g.fillStyle = cg; rr(g, x + 1, 0, w - 2, L * 0.22, [6, 6, 2, 2]); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke();
    g.fillStyle = glass(g, 1, L * 0.08); rr(g, x + 3, 1.5, w - 6, L * 0.06, 2); g.fill();
    // 짐칸(지붕 위 골)
    const bg = g.createLinearGradient(x, 0, -x, 0); bg.addColorStop(0, shade(box, -0.08)); bg.addColorStop(0.5, shade(box, 0.12)); bg.addColorStop(1, shade(box, -0.14));
    g.fillStyle = bg; rr(g, x - 1, L * 0.25, w + 2, L * 0.75, 2); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = 'rgba(28,29,43,.16)'; g.lineWidth = 0.9; for (let i = 1; i < 10; i++) { const yy = L * 0.25 + L * 0.75 * i / 10; g.beginPath(); g.moveTo(x + 1, yy); g.lineTo(-x - 1, yy); g.stroke(); }
    // 뒷면(짐칸 문)
    g.fillStyle = shade(box, -0.12); rr(g, x - 1, L - 1, w + 2, B - 4, 2); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = 'rgba(28,29,43,.45)'; g.beginPath(); g.moveTo(0, L); g.lineTo(0, L + B - 6); g.stroke();
    g.fillStyle = '#8b93a3'; g.fillRect(-4, L + 2, 1.6, B - 9); g.fillRect(2.4, L + 2, 1.6, B - 9);
    g.fillStyle = '#2b2d38'; rr(g, x, L + B - 6, w, 3.5, 1); g.fill(); lamp(g, x + 1, L + B - 9, 5, 3); lamp(g, -x - 6, L + B - 9, 5, 3); plate(g, L + B - 9.5, 11);
    g.fillStyle = '#16171d'; rr(g, x + 1, L + B - 3, 7, 3, 1); g.fill(); rr(g, -x - 8, L + B - 3, 7, 3, 1); g.fill();
    return;
  }
  if (kind === 'bus') {
    const body = ['#3fa66b', '#2f7fd1', '#e0a72a', '#4aa3c7'][parseInt(col.slice(1, 3), 16) % 4];
    tire(L * 0.08, L * 0.08); tire(L * 0.78, L * 0.08);
    const bg = g.createLinearGradient(x, 0, -x, 0); bg.addColorStop(0, shade(body, -0.12)); bg.addColorStop(0.5, shade(body, 0.2)); bg.addColorStop(1, shade(body, -0.18));
    g.fillStyle = bg; rr(g, x - 1, 0, w + 2, L, [7, 7, 3, 3]); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.75)'; rr(g, x + 2, L * 0.04, w - 4, L * 0.88, 3); g.fill();   // 흰 지붕
    g.fillStyle = '#c4cad4'; rr(g, -7, L * 0.2, 14, L * 0.14, 2); g.fill(); rr(g, -7, L * 0.55, 14, L * 0.14, 2); g.fill();   // 에어컨
    g.strokeStyle = 'rgba(28,29,43,.2)'; g.lineWidth = 0.8; for (const yy of [0.2, 0.55]) for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-6, L * yy + i * L * 0.035); g.lineTo(6, L * yy + i * L * 0.035); g.stroke(); }
    // 뒷면
    g.fillStyle = shade(body, -0.05); rr(g, x - 1, L - 2, w + 2, B - 3, 3); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke();
    g.fillStyle = glass(g, L, L + B * 0.45); rr(g, x + 2, L, w - 4, B * 0.42, 2); g.fill();
    g.fillStyle = '#1d2030'; rr(g, -7, L + 1.5, 14, 4, 1); g.fill(); g.fillStyle = '#ffb02e'; for (let i = 0; i < 3; i++) g.fillRect(-5.5 + i * 4, L + 2.4, 2.8, 2.2);
    lamp(g, x + 1.5, L + B * 0.55, 4, 7); lamp(g, -x - 5.5, L + B * 0.55, 4, 7); plate(g, L + B - 9, 12);
    g.fillStyle = '#2b2d38'; rr(g, x, L + B - 4, w, 3, 1); g.fill();
    return;
  }
  const T = TOP[kind] || TOP.sedan;
  const body = kind === 'taxi' ? '#f2b33d' : kind === 'police' ? '#f4f6fa' : col;
  // 바퀴(옆으로 살짝 보임)
  tire(L * 0.1, L * 0.17); tire(L * 0.7, L * 0.17);
  // 몸통(위 모습): 앞 모서리 둥글게
  const nose = kind === 'sports' || kind === 'player' ? w * 0.42 : kind === 'van' || kind === 'suv' ? w * 0.22 : w * 0.32;
  const bg = g.createLinearGradient(x, 0, -x, 0); bg.addColorStop(0, shade(body, -0.18)); bg.addColorStop(0.3, shade(body, 0.12)); bg.addColorStop(0.55, shade(body, 0.2)); bg.addColorStop(1, shade(body, -0.22));
  g.fillStyle = bg; rr(g, x, 0, w, L, [nose, nose, 5, 5]); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke();
  // 보닛 선·전조등
  g.strokeStyle = 'rgba(28,29,43,.25)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + w * 0.28, L * 0.04); g.lineTo(x + w * 0.3, L * T[0]); g.moveTo(-x - w * 0.28, L * 0.04); g.lineTo(-x - w * 0.3, L * T[0]); g.stroke();
  g.fillStyle = '#fff4c6'; g.beginPath(); g.ellipse(x + w * 0.2, L * 0.03 + 1.2, w * 0.13, 1.5, -0.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(-x - w * 0.2, L * 0.03 + 1.2, w * 0.13, 1.5, 0.2, 0, 7); g.fill();
  // 앞유리
  const in1 = w * 0.12, in2 = w * (kind === 'van' || kind === 'suv' ? 0.1 : 0.16);
  g.fillStyle = glass(g, L * T[0], L * T[1]); g.beginPath(); g.moveTo(x + in1, L * T[0]); g.lineTo(-x - in1, L * T[0]); g.lineTo(-x - in2, L * T[1]); g.lineTo(x + in2, L * T[1]); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(x + in1 + 3, L * T[0] + 1); g.lineTo(x + in1 + 8, L * T[0] + 1); g.lineTo(x + in2 + 4, L * T[1] - 1); g.lineTo(x + in2 + 1, L * T[1] - 1); g.closePath(); g.fill();
  // 옆거울
  g.fillStyle = shade(body, -0.1); rr(g, x - 3, L * T[0] + 1, 4, 3, 1); g.fill(); rr(g, -x - 1, L * T[0] + 1, 4, 3, 1); g.fill();
  // 지붕
  if (kind === 'pickup') {
    g.fillStyle = shade(body, 0.15); rr(g, x + in2, L * T[1], w - in2 * 2, L * (T[2] - T[1]), 3); g.fill();
    g.fillStyle = glass(g, L * T[2], L * T[3]); rr(g, x + in2 + 1, L * T[2] - 1, w - in2 * 2 - 2, L * (T[3] - T[2]) + 1, 1); g.fill();
    g.fillStyle = '#2b2d38'; rr(g, x + 2.5, L * 0.56, w - 5, L * 0.41, 2); g.fill();   // 짐칸
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 0.8; for (let i = 1; i < 5; i++) { const yy = L * 0.56 + L * 0.41 * i / 5; g.beginPath(); g.moveTo(x + 3, yy); g.lineTo(-x - 3, yy); g.stroke(); }
  } else {
    const rg = g.createLinearGradient(x, 0, -x, 0); rg.addColorStop(0, shade(body, -0.05)); rg.addColorStop(0.5, shade(body, 0.28)); rg.addColorStop(1, shade(body, -0.1));
    g.fillStyle = rg; rr(g, x + in2, L * T[1], w - in2 * 2, L * (T[2] - T[1]), 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; rr(g, x + in2 + 2, L * T[1] + 2, (w - in2 * 2) * 0.32, L * (T[2] - T[1]) - 4, 2); g.fill();
    // 뒷유리
    g.fillStyle = glass(g, L * T[2], L * T[3]); g.beginPath(); g.moveTo(x + in2, L * T[2]); g.lineTo(-x - in2, L * T[2]); g.lineTo(-x - in1 - 1, L * T[3]); g.lineTo(x + in1 + 1, L * T[3]); g.closePath(); g.fill();
    if (kind === 'suv') { g.fillStyle = '#2f323d'; g.fillRect(x + in2 + 1, L * T[1] + 2, 1.6, L * (T[2] - T[1]) - 4); g.fillRect(-x - in2 - 2.6, L * T[1] + 2, 1.6, L * (T[2] - T[1]) - 4); }
    if (kind === 'van') { g.strokeStyle = 'rgba(28,29,43,.25)'; g.lineWidth = 0.8; for (let i = 1; i < 4; i++) { const yy = L * (T[1] + (T[2] - T[1]) * i / 4); g.beginPath(); g.moveTo(x + in2 + 1, yy); g.lineTo(-x - in2 - 1, yy); g.stroke(); } }
    if (kind === 'taxi') { g.fillStyle = '#fff'; rr(g, -7, L * (T[1] + T[2]) / 2 - 3, 14, 6, 1.5); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke(); g.fillStyle = OL; g.font = 'bold 4px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TAXI', 0, L * (T[1] + T[2]) / 2); }
    if (kind === 'police') { const yy = L * (T[1] + 0.03); g.fillStyle = '#2b2d38'; rr(g, x + in2, yy, w - in2 * 2, 4, 1.5); g.fill(); g.fillStyle = '#ff3b3b'; rr(g, x + in2 + 1, yy + 0.8, (w - in2 * 2) / 2 - 1.5, 2.4, 1); g.fill(); g.fillStyle = '#3b7bff'; rr(g, 0.5, yy + 0.8, (w - in2 * 2) / 2 - 1.5, 2.4, 1); g.fill(); g.fillStyle = '#2f5fd1'; g.fillRect(x + 0.5, L * 0.5, 2, L * 0.3); g.fillRect(-x - 2.5, L * 0.5, 2, L * 0.3); }
    if (kind === 'sports' || kind === 'player') { g.fillStyle = shade(body, -0.35); rr(g, x - 1, L * 0.9, w + 2, 3, 1); g.fill(); }
  }
  if (kind === 'player') { g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(-5, 1, 3.2, L - 2); g.fillRect(1.8, 1, 3.2, L - 2); star(g, 0, L * (T[1] + T[2]) / 2, 3.4, '#ffd25e'); }
  // 뒷면
  const by = L - 2, bh = B;
  const fg = g.createLinearGradient(0, by, 0, by + bh); fg.addColorStop(0, shade(body, 0.05)); fg.addColorStop(1, shade(body, -0.3));
  g.fillStyle = fg; rr(g, x, by, w, bh, [2, 2, 4, 4]); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke();
  if (kind === 'sedan' || kind === 'taxi' || kind === 'police' || kind === 'sports' || kind === 'player') { lamp(g, x + 1.2, by + 2, w * 0.3, 3); lamp(g, -x - 1.2 - w * 0.3, by + 2, w * 0.3, 3); }
  else { lamp(g, x + 1, by + 1.5, 3.6, bh * 0.45); lamp(g, -x - 4.6, by + 1.5, 3.6, bh * 0.45); }
  plate(g, by + bh * 0.42, 12);
  g.fillStyle = '#2a2d38'; rr(g, x + 0.5, by + bh - 3.6, w - 1, 3, 1.2); g.fill();
  g.fillStyle = '#16171d'; rr(g, x + 1, by + bh - 1.5, 6, 2.5, 1); g.fill(); rr(g, -x - 7, by + bh - 1.5, 6, 2.5, 1); g.fill();
}

/* ===== 게임 ===== */
export function createChase(root, opts = {}) {
  root.innerHTML = `<div class="cs-scr" tabindex="-1"><canvas aria-label="카체이싱! 게임 화면"></canvas><div class="hr-ov cs-ov" hidden></div>
      <div class="cs-rot" aria-live="polite"><i aria-hidden="true"></i><b>화면을 가로로 돌려 주세요</b><span>카체이싱!은 가로 화면에서 해요</span></div></div>
    <div class="hr-bar cs-bar"><p class="hr-keys cs-keys"><span class="hk"><span data-ka="left"></span><span data-ka="right"></span> 차선 바꾸기</span><span class="hk-dot"> · </span><span class="hk"><span data-ka="jump"></span> 점프</span></p><button type="button" class="btn ghost hr-snd cs-snd" aria-pressed="false"></button></div>`;
  const scr = root.querySelector('.cs-scr'), cv = scr.querySelector('canvas'), ov = scr.querySelector('.cs-ov'), sndBtn = root.querySelector('.cs-snd');
  const g = cv.getContext('2d', { alpha: false });
  const sfx = makeSfx(); sfx.set(!!opts.sound);
  let best = opts.best || 0, dpr = 1, k = 1, alive = true, raf = 0;
  const art = new Map();   // 그림 캐시
  const st = { scene: 'ready', shownAt: 0 };
  let s = null, seed = null, saved = false, evs = [], lq = [], acc = 0, last = 0, countT = 0, crashT = 0, pauseFrom = '', tilt = 0;
  let msgNow = null;
  let parts = [], pops = [], streaks = [], shake = 0, flash = 0, warnShown = -1, evRun = 0, tStart = 0;

  /* --- 크기: 논리 960×540을 화면 픽셀에 맞춰 선명하게 --- */
  const fit = () => {
    const w = cv.clientWidth; if (!w) return;
    dpr = Math.min(2.5, window.devicePixelRatio || 1); k = w / VW;
    const pw = Math.round(w * dpr), ph = Math.round(w * VH / VW * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; art.clear(); }
  };
  const ro = new ResizeObserver(() => { fit(); draw(); }); ro.observe(cv);
  const portMQ = matchMedia(PORTRAIT);
  const onPort = () => { root.classList.toggle('cs-port', portMQ.matches); if (portMQ.matches) blur(); };
  portMQ.addEventListener?.('change', onPort);

  /* --- 그림 캐시 --- */
  const SQ = 1.6;
  // 바닥에 선 것(원점 = 바닥 가운데)
  const sheet = (key, w, h, paint) => {
    let a = art.get(key);
    if (!a) {
      const sc = k * dpr * SQ, pad = 10, c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil((w + pad * 2) * sc)); c.height = Math.max(1, Math.ceil((h + pad * 2) * sc));
      const x = c.getContext('2d'); x.scale(sc, sc); x.translate(w / 2 + pad, h + pad); paint(x);
      a = { c, W: w + pad * 2, H: h + pad * 2, pad, h }; art.set(key, a);
    }
    return a;
  };
  const put = (a, x, y, sc, alpha = 1) => { if (alpha <= 0.01) return; if (alpha < 1) g.globalAlpha = alpha; g.drawImage(a.c, x - a.W / 2 * sc, y - (a.h + a.pad) * sc, a.W * sc, a.H * sc); if (alpha < 1) g.globalAlpha = 1; };
  // 차 한 장: 위 모습(길이 L) + 뒷면(B) — 원점 = 앞쪽 가운데
  const carArt = (kind, col, hw, hh) => {
    const c2 = typeof col === 'number' ? TRAFFIC[col % TRAFFIC.length] : col, key = `c:${kind}:${c2}:${hw}:${hh}`;
    let a = art.get(key);
    if (!a) {
      const w = (hw + 2) * 2, L = (hh + 2) * 2, B = CAR_B[kind] || 13, pad = 8, q = k * dpr * SQ, c = document.createElement('canvas');
      c.width = Math.ceil((w + pad * 2) * q); c.height = Math.ceil((L + B + pad * 2) * q);
      const x = c.getContext('2d'); x.scale(q, q); x.translate(w / 2 + pad, pad); carSheetArt(x, kind, c2, w, L, B);
      a = { c, W: w + pad * 2, L, B, pad, q }; art.set(key, a);
    }
    return a;
  };
  const playerArt = () => carArt('player', '#3b9bff', C.P_HW + 1, C.P_HH);
  // 차 그리기: 위 모습을 앞 끝(yF)~뒤 끝(yR) 화면 자리에, 뒷면은 그 아래(폭 배율 × 0.72 — 비스듬히 본 세로면)
  const putCar = (a, cx, yF, yR, sc, alpha = 1) => {
    if (alpha <= 0.01) return;
    yF = yR - (yR - yF) * 1.5;   // 원근으로 납작해 보이는 길이를 1.5배(그림만 · 판정과 무관)
    const v = (yR - yF) / a.L, dw = a.W * sc, sx = cx - dw / 2, cut = Math.round((a.pad + a.L) * a.q);
    if (alpha < 1) g.globalAlpha = alpha;
    g.drawImage(a.c, 0, 0, a.c.width, cut, sx, yF - a.pad * v, dw, (a.pad + a.L) * v + 0.6);
    g.drawImage(a.c, 0, cut, a.c.width, a.c.height - cut, sx, yR, dw, (a.B + a.pad) * sc * 0.72);
    if (alpha < 1) g.globalAlpha = 1;
  };
  const itemArt = t => sheet('i:' + t, 34, 38, x => {
    x.lineJoin = 'round';
    const sg = x.createRadialGradient(0, 0, 1, 0, 0, 16); sg.addColorStop(0, 'rgba(10,10,25,.4)'); sg.addColorStop(1, 'rgba(10,10,25,0)');
    x.save(); x.scale(1, 0.25); x.fillStyle = sg; x.beginPath(); x.arc(0, 0, 16, 0, 7); x.fill(); x.restore();
    if (t === 'coin') {
      x.fillStyle = '#b87800'; x.beginPath(); x.ellipse(1.8, -16, 12, 12, 0, 0, 7); x.fill();
      const gr = x.createLinearGradient(-12, -28, 12, -4); gr.addColorStop(0, '#fff6c4'); gr.addColorStop(0.35, '#ffd451'); gr.addColorStop(1, '#e09412');
      x.fillStyle = gr; x.beginPath(); x.arc(0, -16, 12, 0, 7); x.fill(); x.strokeStyle = '#a86a00'; x.lineWidth = 1.2; x.stroke();
      x.strokeStyle = 'rgba(168,106,0,.6)'; x.lineWidth = 1.4; x.beginPath(); x.arc(0, -16, 8.5, 0, 7); x.stroke();
      x.fillStyle = '#c98a00'; x.font = 'bold 11px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('₩', 0, -15.5);
      x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(-4.5, -21, 3, 1.6, -0.6, 0, 7); x.fill();
    } else if (t === 'fuel') {
      const gr = x.createLinearGradient(-12, 0, 12, 0); gr.addColorStop(0, '#ff6b5e'); gr.addColorStop(0.5, '#e2322b'); gr.addColorStop(1, '#a61d1b');
      x.fillStyle = gr; rr(x, -11, -28, 22, 27, 3.5); x.fill(); x.strokeStyle = '#6e1212'; x.lineWidth = 1.2; x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-7, -23); x.lineTo(7, -7); x.moveTo(7, -23); x.lineTo(-7, -7); x.stroke();
      x.fillStyle = '#2b2d38'; rr(x, -8, -33, 7, 5, 1.5); x.fill(); x.strokeStyle = '#2b2d38'; x.lineWidth = 2; x.beginPath(); x.moveTo(1, -28); x.lineTo(2, -32); x.lineTo(8, -32); x.lineTo(8, -28); x.stroke();
      x.fillStyle = '#ffd34d'; rr(x, -6, -20, 12, 8, 2); x.fill(); x.fillStyle = '#6e1212'; x.font = 'bold 6px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FUEL', 0, -15.7);
      x.fillStyle = 'rgba(255,255,255,.4)'; rr(x, -9, -26, 3, 20, 1.5); x.fill();
    } else if (t === 'box') {
      const gl = x.createRadialGradient(0, -16, 2, 0, -16, 22); gl.addColorStop(0, 'rgba(180,140,255,.55)'); gl.addColorStop(1, 'rgba(180,140,255,0)');
      x.fillStyle = gl; x.beginPath(); x.arc(0, -16, 22, 0, 7); x.fill();
      const gr = x.createLinearGradient(-13, -30, 13, -2); gr.addColorStop(0, '#ff9ad6'); gr.addColorStop(0.5, '#9d7bff'); gr.addColorStop(1, '#4fb8ff');
      x.fillStyle = gr; rr(x, -13, -29, 26, 27, 5); x.fill(); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.6; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.3)'; rr(x, -11, -27, 22, 9, 4); x.fill();
      x.fillStyle = '#fff'; x.font = `21px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(60,20,120,.6)'; x.shadowBlur = 3; x.fillText('?', 0, -14.5); x.shadowBlur = 0;
    } else if (t === 'cone') {
      const gr = x.createLinearGradient(-10, 0, 10, 0); gr.addColorStop(0, '#ffa055'); gr.addColorStop(0.55, '#ff7a1f'); gr.addColorStop(1, '#c4520c');
      x.fillStyle = gr; x.beginPath(); x.moveTo(-2.5, -30); x.lineTo(2.5, -30); x.lineTo(10, -5); x.lineTo(-10, -5); x.closePath(); x.fill();
      x.fillStyle = '#f4f6f8'; x.beginPath(); x.moveTo(-5.2, -21); x.lineTo(5.2, -21); x.lineTo(6.6, -16); x.lineTo(-6.6, -16); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(-3.6, -26.5); x.lineTo(3.6, -26.5); x.lineTo(4.4, -24); x.lineTo(-4.4, -24); x.closePath(); x.fill();
      x.fillStyle = '#2b2d38'; rr(x, -13, -6, 26, 5, 1.5); x.fill();
    }
  });
  const wallArt = () => sheet('w', C.ROAD_R - C.ROAD_L, 40, x => {
    const w = C.ROAD_R - C.ROAD_L, h = 15, top = -26;
    const sg = x.createLinearGradient(0, -4, 0, 4); sg.addColorStop(0, 'rgba(10,10,25,0)'); sg.addColorStop(0.5, 'rgba(10,10,25,.35)'); sg.addColorStop(1, 'rgba(10,10,25,0)');
    x.fillStyle = sg; x.fillRect(-w / 2, -4, w, 8);
    for (const lx of [-w / 2 + 14, -w / 4, 0, w / 4, w / 2 - 14]) { const gr = x.createLinearGradient(lx - 3, 0, lx + 3, 0); gr.addColorStop(0, '#c7ccd6'); gr.addColorStop(1, '#6b7183'); x.fillStyle = gr; x.fillRect(lx - 2.5, top + h - 1, 5, -top - h + 1); x.fillStyle = '#3a3e4c'; x.fillRect(lx - 6, -2.5, 12, 2.5); }
    x.save(); rr(x, -w / 2, top, w, h, 3); x.clip(); x.fillStyle = '#fbfbfb'; x.fillRect(-w / 2, top, w, h);
    x.fillStyle = '#ff5b1f'; for (let i = -w / 2 - 22; i < w / 2; i += 24) { x.beginPath(); x.moveTo(i, top + h); x.lineTo(i + 12, top); x.lineTo(i + 24, top); x.lineTo(i + 12, top + h); x.fill(); }
    const sh = x.createLinearGradient(0, top, 0, top + h); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = sh; x.fillRect(-w / 2, top, w, h);
    x.restore(); x.strokeStyle = '#3a3e4c'; x.lineWidth = 1.2; rr(x, -w / 2, top, w, h, 3); x.stroke();
    x.fillStyle = '#2b2d38'; rr(x, -26, top - 13, 52, 12, 3); x.fill(); x.fillStyle = '#ffd34d'; x.font = 'bold 8px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('공사중', 0, top - 6.8);
    for (const lx of [-w / 2 + 14, -w / 4, w / 4, w / 2 - 14]) { const gl = x.createRadialGradient(lx, top - 4, 0, lx, top - 4, 9); gl.addColorStop(0, 'rgba(255,214,77,.95)'); gl.addColorStop(0.35, 'rgba(255,170,40,.55)'); gl.addColorStop(1, 'rgba(255,170,40,0)'); x.fillStyle = gl; x.beginPath(); x.arc(lx, top - 4, 9, 0, 7); x.fill(); }
  });
  const treeArt = v => sheet('t' + v, 50, 74, x => {
    const sg = x.createRadialGradient(0, 0, 1, 0, 0, 20); sg.addColorStop(0, 'rgba(10,20,10,.35)'); sg.addColorStop(1, 'rgba(10,20,10,0)'); x.save(); x.scale(1, 0.25); x.fillStyle = sg; x.beginPath(); x.arc(0, 0, 20, 0, 7); x.fill(); x.restore();
    const tr = x.createLinearGradient(-3, 0, 3, 0); tr.addColorStop(0, '#8a5a36'); tr.addColorStop(1, '#5a3a22'); x.fillStyle = tr; x.fillRect(-2.5, -22, 5, 22);
    const pal = [['#3f9a4c', '#57b862', '#7ccf7d'], ['#2f7f45', '#469c56', '#66b96d'], ['#4b9e3e', '#67b955', '#8fd06f'], ['#2c6e3f', '#3e8a50', '#5ea867']][v % 4];
    if (v % 3 === 2) {   // 침엽수
      for (let i = 0; i < 3; i++) { const y0 = -20 - i * 15, wd = 19 - i * 4.5; const gr = x.createLinearGradient(-wd, 0, wd, 0); gr.addColorStop(0, pal[2]); gr.addColorStop(0.5, pal[1]); gr.addColorStop(1, pal[0]); x.fillStyle = gr; x.beginPath(); x.moveTo(0, y0 - 24); x.lineTo(wd, y0); x.lineTo(-wd, y0); x.closePath(); x.fill(); }
      return;
    }
    const blobs = [[-9, -36, 13], [9, -38, 13], [0, -50, 14], [-4, -28, 11], [7, -28, 10]];
    for (const [bx, by, r] of blobs) { const gr = x.createRadialGradient(bx - r * 0.4, by - r * 0.5, 1, bx, by, r); gr.addColorStop(0, pal[2]); gr.addColorStop(0.6, pal[1]); gr.addColorStop(1, pal[0]); x.fillStyle = gr; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); }
  });
  const lampArt = side => sheet('l' + side, 70, 150, x => {   // 가로등(도로 쪽으로 팔)
    const d = side ? -1 : 1, gr = x.createLinearGradient(-3, 0, 3, 0); gr.addColorStop(0, '#d4d8e0'); gr.addColorStop(1, '#7b8192');
    x.fillStyle = gr; x.fillRect(-2.5, -140, 5, 140); x.fillStyle = '#5b6070'; x.fillRect(-5, -8, 10, 8);
    x.strokeStyle = '#8f95a5'; x.lineWidth = 3.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, -136); x.quadraticCurveTo(d * 4, -146, d * 26, -146); x.stroke();
    x.fillStyle = '#4a4f5f'; rr(x, d * 22 - 9, -150, 18, 6, 2); x.fill(); x.fillStyle = '#fff7d6'; rr(x, d * 22 - 7, -145, 14, 2.5, 1); x.fill();
  });
  const postArt = () => sheet('gp', 8, 26, x => { const gr = x.createLinearGradient(-3, 0, 3, 0); gr.addColorStop(0, '#b9bec9'); gr.addColorStop(1, '#6b7183'); x.fillStyle = gr; x.fillRect(-2.5, -24, 5, 24); x.fillStyle = '#fff'; x.fillRect(-2.5, -24, 5, 3); x.fillStyle = '#ff5b4a'; x.fillRect(-1.5, -18, 3, 2); });
  // 길 종류별 길가 그림(바닥에 선 것)
  const mapleArt = v => sheet('m' + v, 50, 70, x => {
    const sg = x.createRadialGradient(0, 0, 1, 0, 0, 20); sg.addColorStop(0, 'rgba(30,15,5,.35)'); sg.addColorStop(1, 'rgba(30,15,5,0)'); x.save(); x.scale(1, 0.3); x.fillStyle = sg; x.beginPath(); x.arc(0, 0, 20, 0, 7); x.fill(); x.restore();
    x.fillStyle = '#6b4128'; x.fillRect(-2.5, -20, 5, 20);
    const pal = [['#c2361f', '#e2522d', '#f58a4a'], ['#d9691c', '#f08a2a', '#ffb24d'], ['#c99a18', '#e6b52b', '#ffd45a'], ['#a8261c', '#cc3d2b', '#e9694a']][v % 4];
    for (const [bx, by, r] of [[-9, -34, 13], [9, -36, 13], [0, -48, 14], [-3, -26, 11], [7, -26, 10]]) { const gr = x.createRadialGradient(bx - r * 0.4, by - r * 0.5, 1, bx, by, r); gr.addColorStop(0, pal[2]); gr.addColorStop(0.6, pal[1]); gr.addColorStop(1, pal[0]); x.fillStyle = gr; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); }
  });
  const palmArt = v => sheet('p' + v, 60, 86, x => {
    const sg = x.createRadialGradient(0, 0, 1, 0, 0, 18); sg.addColorStop(0, 'rgba(60,40,10,.3)'); sg.addColorStop(1, 'rgba(60,40,10,0)'); x.save(); x.scale(1, 0.3); x.fillStyle = sg; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill(); x.restore();
    const d = v % 2 ? 1 : -1; x.strokeStyle = '#8a6438'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(d * 4, -40, d * 10, -70); x.stroke();
    const tx = d * 10, ty = -70;
    for (let i = 0; i < 7; i++) { const an = -Math.PI / 2 + (i - 3) * 0.55, len = 26; const gr = x.createLinearGradient(tx, ty, tx + Math.cos(an) * len, ty + Math.sin(an) * len); gr.addColorStop(0, '#2f8a3e'); gr.addColorStop(1, '#6cc25a'); x.strokeStyle = gr; x.lineWidth = 6; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + Math.cos(an) * len * 0.6, ty + Math.sin(an) * len * 0.6 - 6, tx + Math.cos(an) * len, ty + Math.sin(an) * len + 8); x.stroke(); }
    x.fillStyle = '#6b4a22'; x.beginPath(); x.arc(tx - 2, ty + 3, 2.6, 0, 7); x.arc(tx + 2, ty + 4, 2.6, 0, 7); x.fill();
  });
  // 건물: 위에서 본 각도라 옥상이 넓게 보임
  const bldgArt = v => {
    const bw = 64 + (v % 3) * 20, bh = 70 + ((v * 37) % 5) * 26, rf = 26, pal = [['#c9d3e0', '#8e9bb0'], ['#e3d3c0', '#a89580'], ['#b8c9d6', '#7d93a6'], ['#d8c3c3', '#9c8585'], ['#cfd8cc', '#8fa08b']][v % 5];
    return sheet('B' + v, bw + 4, bh + rf + 4, x => {
      x.fillStyle = 'rgba(10,10,25,.25)'; x.fillRect(-bw / 2 - 3, -4, bw + 8, 7);
      const gr = x.createLinearGradient(-bw / 2, 0, bw / 2, 0); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); x.fillStyle = gr; x.fillRect(-bw / 2, -bh, bw, bh);
      x.fillStyle = shade(pal[0], 0.2); x.fillRect(-bw / 2, -bh - rf, bw, rf);   // 옥상
      x.strokeStyle = shade(pal[1], -0.15); x.lineWidth = 2; x.strokeRect(-bw / 2 + 1, -bh - rf + 1, bw - 2, rf - 2);
      x.fillStyle = '#9aa3b2'; x.fillRect(-bw / 2 + 8, -bh - rf + 6, 12, 9); x.fillRect(bw / 2 - 22, -bh - rf + 9, 10, 8);
      for (let wy = -bh + 7; wy < -16; wy += 13) for (let wx = -bw / 2 + 6; wx < bw / 2 - 8; wx += 12) { const lit = ((wx * 3 + wy * 7 + v) % 9 + 9) % 9 === 0; const wg = x.createLinearGradient(0, wy, 0, wy + 8); wg.addColorStop(0, lit ? '#fff1b8' : '#8fb5da'); wg.addColorStop(1, lit ? '#ffd56b' : '#45678f'); x.fillStyle = wg; x.fillRect(wx, wy, 8, 8); }
      x.fillStyle = '#4a4f5f'; x.fillRect(-9, -15, 18, 15); x.fillStyle = '#9fd0ff'; x.fillRect(-7, -13, 6, 11); x.fillRect(1, -13, 6, 11);
    });
  };
  const umbArt = v => sheet('u' + v, 40, 40, x => {
    const c = ['#ff5a5a', '#3fa9f5', '#ffd34d', '#5ccf7a'][v % 4];
    x.fillStyle = 'rgba(40,30,10,.25)'; x.beginPath(); x.ellipse(4, 0, 15, 4, 0, 0, 7); x.fill();
    x.strokeStyle = '#ddd'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -26); x.stroke();
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff' : c; x.beginPath(); x.moveTo(0, -30); x.ellipse(0, -30, 17, 8, 0, i * Math.PI / 4, (i + 1) * Math.PI / 4); x.closePath(); x.fill(); }
  });
  const bushArt = () => sheet('bu', 40, 26, x => {
    for (const [bx, by, r] of [[-9, -8, 9], [8, -8, 9], [0, -13, 10]]) { const gr = x.createRadialGradient(bx - 3, by - 4, 1, bx, by, r); gr.addColorStop(0, '#8fd06f'); gr.addColorStop(1, '#3e8a50'); x.fillStyle = gr; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); }
  });
  const bpostArt = () => sheet('bp', 14, 64, x => {   // 다리 주탑 기둥
    const gr = x.createLinearGradient(-6, 0, 6, 0); gr.addColorStop(0, '#f0f2f6'); gr.addColorStop(1, '#8c93a3'); x.fillStyle = gr; x.fillRect(-5, -60, 10, 60); x.fillStyle = '#ff5b4a'; x.fillRect(-5, -60, 10, 5);
  });
  const vignette = () => {
    let a = art.get('vig'); if (a) return a;
    const sc = k * dpr, c = document.createElement('canvas'); c.width = Math.ceil(VW * sc); c.height = Math.ceil(VH * sc);
    const x = c.getContext('2d'); x.scale(sc, sc);
    const vg = x.createRadialGradient(VW / 2, VH * 0.55, VH * 0.45, VW / 2, VH * 0.55, VW * 0.72); vg.addColorStop(0, 'rgba(0,0,20,0)'); vg.addColorStop(1, 'rgba(0,0,20,.28)'); x.fillStyle = vg; x.fillRect(0, 0, VW, VH);
    a = { c }; art.set('vig', a); return a;
  };

  /* --- 입력: ←→ 한 번 누를 때마다 한 차선 · 화면 왼쪽 1/4 ◀ · 오른쪽 1/4 ▶ · 가운데 점프 --- */
  const KM = opts.keys || (() => '');
  let touchSeen = TOUCHY(), padHit = { L: 0, R: 0, J: 0 };
  const zoneOf = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; return x < 0.25 ? 'L' : x > 0.75 ? 'R' : 'J'; };
  const press = z => { if (z === 'J') lq.push(4); else lq.push(z === 'L' ? 0 : 2); padHit[z] = performance.now(); };
  const onDown = e => {
    if (e.button > 0) return; e.preventDefault(); sfx.unlock(); if (e.pointerType === 'touch') touchSeen = true;
    if (portMQ.matches) return;
    if (st.scene === 'ready') { start(); return; }
    if (st.scene === 'over') { again(); return; }
    if (st.scene === 'pause') { resume(); return; }
    if (st.scene === 'play' || st.scene === 'count') press(zoneOf(e));
  };
  cv.addEventListener('pointerdown', onDown);
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
    if (!a) return;
    e.preventDefault(); if (e.repeat || st.scene !== 'play') return;   // 꾹 눌러도 한 차선만(누를 때마다 한 칸)
    press(a === 'left' ? 'L' : a === 'right' ? 'R' : 'J');
  };
  document.addEventListener('keydown', kd);
  function blur() { lq.length = 0; if (st.scene === 'play' || st.scene === 'count') pause(); }
  const vis = () => { if (document.hidden) blur(); };
  window.addEventListener('blur', blur); document.addEventListener('visibilitychange', vis);

  /* --- 화면 위 안내(DOM) --- */
  const keyTxt = () => opts.keyText ? opts.keyText() : '← → 차선 바꾸기 · Space 점프';
  const showReady = () => {
    ov.hidden = false; ov.className = 'hr-ov cs-ov cs-ready';
    ov.innerHTML = `<b>카체이싱!</b><span>앞차에 바짝 붙었다가 옆 차선으로 쏙! 아슬아슬 칼치기로 부스터를 모아요</span>${best ? `<em class="sr-best cs-best">${opts.trophy || ''}내 최고 ${fmt(best)}점</em>` : ''}
      <ul class="cs-how"><li><i class="cs-i1"></i>←→를 누를 때마다 <b>한 차선씩</b> · 앞차 꽁무니에서 빠질수록 점수 두 배</li><li><i class="cs-i2"></i>게이지가 꽉 차면 <b>부스터</b> — 앞차를 날려 버려요</li><li><i class="cs-i3"></i><b>연료통</b>을 먹어야 계속 달려요 · 바리케이드는 점프!</li></ul>
      <small>${touchSeen ? '왼쪽 ◀ · 오른쪽 ▶ · 가운데 점프 — 화면을 눌러 출발' : keyTxt() + ' — 아무 키나 눌러 출발'}</small>`;
  };
  const WHY = { crash: '쾅! 부딪혔어요', wall: '바리케이드에 쾅!', cone: '고깔에 걸렸어요!', fuel: '기름이 다 떨어졌어요…', cap: '끝까지 달렸어요!' };
  const showOver = res => {
    st.scene = 'over'; st.shownAt = performance.now();
    const nb = res.score > best && res.score > 0; if (nb) best = res.score;
    ov.hidden = false; ov.className = 'hr-ov dead cs-over';
    ov.innerHTML = `<b>${WHY[res.why] || '끝!'}</b><div class="hr-card"><p class="hr-sc"><em>${fmt(res.score)}점</em>${nb ? '<i class="hr-nb">최고 기록!</i>' : ''}</p>
      <p class="cs-stat"><span><b>${fmt(res.m)}</b>m</span><span>최고 <b>${res.top}</b>km/h</span><span>아슬아슬 <b>${res.near}</b>번</span><span>최대 콤보 <b>x${res.maxCombo}</b></span><span>부스터 <b>${res.boosts}</b>번</span>${res.smash ? `<span>날려 버린 차 <b>${res.smash}</b>대</span>` : ''}</p>
      <small class="hr-msg cs-msg">${msgNow ?? (opts.saveLine ? opts.saveLine(res) : '')}</small></div><small class="hr-go">${touchSeen ? '화면을 눌러 다시' : '스페이스 · 엔터 · 클릭으로 다시'}</small>`;
  };
  const showPause = () => { ov.hidden = false; ov.className = 'hr-ov cs-ov'; ov.innerHTML = `<b>잠깐 멈춤</b><span>차도 연료도 같이 멈췄어요</span><small>${touchSeen ? '화면을 누르면 계속' : '아무 키나 누르면 계속'}</small>`; };

  /* --- 판 흐름 --- */
  let topV = 0;
  function start() {
    if (st.scene !== 'ready' || portMQ.matches) return;
    ov.hidden = true; st.scene = 'count'; countT = 0; evRun++;
    const my = evRun; seed = null; saved = false;
    Promise.resolve(opts.seed ? opts.seed() : null).catch(() => null).then(x => { if (my === evRun) { seed = x; saved = x != null; } return x; });
    s = null; tStart = 0; resetFx(); lq.length = 0;
    sfx.beep(false);
  }
  function begin() {
    const sd = seed != null ? seed : (Math.random() * 4294967296) >>> 0;
    s = C.newSim(sd, true); evs = []; lq.length = 0; acc = 0; st.scene = 'play'; tStart = performance.now(); topV = 0;
    opts.onStart?.(saved);
  }
  function resetFx() { parts = []; pops = []; streaks = []; shake = 0; flash = 0; warnShown = -1; }
  function again() {
    if (st.scene !== 'over' || performance.now() - st.shownAt < 500) return;
    st.scene = 'ready'; s = null; resetFx(); opts.onReady?.(); start();
  }
  function pause() { if (st.scene !== 'play' && st.scene !== 'count') return; pauseFrom = st.scene; st.scene = 'pause'; sfx.engine(0); showPause(); }
  function resume() { if (st.scene !== 'pause' || portMQ.matches) return; ov.hidden = true; lq.length = 0; st.scene = pauseFrom === 'count' ? 'count' : 'resume'; countT = 0; last = performance.now(); }

  /* --- 효과 --- */
  const burst = (x, y, n, cols, sp = 160, life = 0.6, sz = 4) => { if (RM()) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.4 + Math.random() * 0.8); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life, max: life, c: cols[i % cols.length], sz: sz * (0.6 + Math.random() * 0.8) }); } };
  const pop = (x, y, t, c = '#fff', big = 0) => pops.push({ x, y, t, c, big, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8 });
  const bW = (x, y, lift, n, cols, sp, life, sz) => { const q = ps(y); burst(sxOf(x, q), syOf(q) - lift * q * PK, n, cols, sp * q * PK * 0.6, life, (sz || 4) * q * PK * 0.6); };
  const pW = (x, y, lift, t, c, big) => { const q = ps(y); pop(sxOf(x, q), syOf(q) - lift * q * PK, t, c, big); };
  function handle(e) {
    const py = C.PY + C.P_HH;
    switch (e.t) {
      case 'near': {
        bW(e.x, e.y + 30, 14, 14, ['#fff', '#ffd25e', '#7fd4ff'], 240, 0.45, 3);
        pW(s.p.x, py, 64, (e.close ? '아슬아슬!!' : '아슬아슬!') + (e.combo > 1 ? ` x${e.combo}` : ''), e.close ? '#ff9a3d' : '#ffd25e', 1); pW(s.p.x, py, 40, '+' + e.pts, '#fff');
        sfx.near(e.combo); for (let i = 0; i < 6; i++) streaks.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y + 30 + Math.random() * 40, life: 0.35 }); break;
      }
      case 'coin': bW(e.x, py, 16, 6, ['#ffd25e', '#fff'], 110, 0.35, 3); pW(e.x, py, 44, '+10', '#ffd25e'); sfx.coin(); break;
      case 'fuel': bW(e.x, py, 14, 12, ['#ff5a5a', '#fff', '#ffd25e'], 150, 0.5); pW(e.x, py, 52, '연료 +' + C.CAN, '#ff8a8a', 1); sfx.fuel(); break;
      case 'box': bW(e.x, py, 16, 18, ['#ff8fd0', '#a98bff', '#5ec8ff', '#fff'], 230, 0.6); sfx.box(); break;
      case 'boost': flash = 0.35; shake = Math.max(shake, 0.15); pop(VW / 2, 200, '부스터!', '#7fd4ff', 1); sfx.boost(); break;
      case 'smash': bW(e.x, e.y + 20, 14, e.wall ? 22 : 16, ['#fff', '#ffd25e', '#ff8a3d', '#9aa3b5'], 300, 0.6); shake = Math.max(shake, 0.2); pW(e.x, e.y + 20, 50, e.wall ? '+20' : '+50', '#fff'); sfx.smash(); break;
      case 'jump': sfx.jump(); break;
      case 'land': bW(s.p.x, py, 2, 10, ['#cfd4df', '#fff'], 100, 0.35, 3); sfx.land(); break;
      case 'crash': bW(e.x, py, 14, 46, ['#ff5a5a', '#ffd25e', '#fff', '#2a2846', '#ff8a3d'], 380, 0.9, 5); shake = 0.7; flash = 0.5; sfx.crash(); sfx.engine(0); break;
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
        // 입력: 누른 것을 이 프레임 번호로 기록
        while (lq.length) { const c = lq.shift(); const was = s.p.lane; evs.push(C.enc(s.f, c)); C.input(s, c); if (c !== 4 && s.p.lane !== was) sfx.lane(); }
        for (const c of s.cars) { c._py = c.y; c._px = c.x; } for (const it of s.items) it._py = it.y; s.p._px = s.p.x; s._pd = s.dist;
        C.step(s);
        for (const e of s.evs) handle(e); s.evs.length = 0;
        acc -= STEP; n++;
      }
      if (n >= 6) acc = 0;
      topV = Math.max(topV, s.v);
      sfx.engine(s.over ? 0 : s.v);
      if (s.over) { st.scene = 'crash'; crashT = 0; finish(); }
    } else if (st.scene === 'crash') {
      crashT += dt;
      if (crashT > 1100 && ov.hidden) showOver(lastRes);
    }
    const ds = dt / 1000;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * ds; p.y += p.vy * ds; p.vy += 220 * ds; p.vx *= 0.95; p.life -= ds; if (p.life <= 0) parts.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.y -= 34 * ds; p.life -= ds; if (p.life <= 0) pops.splice(i, 1); }
    for (let i = streaks.length - 1; i >= 0; i--) { streaks[i].life -= ds; if (streaks[i].life <= 0) streaks.splice(i, 1); }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
    shake = Math.max(0, shake - ds); flash = Math.max(0, flash - ds);
    draw(ds);
  }
  let lastRes = null;
  function finish() {
    const r = { score: C.scoreOf(s), m: C.metersOf(s), f: s.overF, why: s.over, near: s.near, maxCombo: s.maxCombo, boosts: s.boosts, smash: s.smash, coins: s.coins, cans: s.cans, top: Math.round(topV * 0.36), rounds: [s.overF, ...evs], saved, realMs: performance.now() - tStart };
    lastRes = r; msgNow = null;
    opts.onOver?.(r);
  }

  /* --- 그리기 --- */
  const alpha = () => st.scene === 'play' ? clamp(acc / STEP, 0, 1) : 1;
  function draw(ds = 0) {
    if (!cv.width) return;
    const a = alpha(), sc = k * dpr;
    g.setTransform(sc, 0, 0, sc, 0, 0);
    const dist = s ? lerp(s._pd ?? s.dist, s.dist, a) : 0, px = s ? lerp(s.p._px ?? s.p.x, s.p.x, a) : C.laneX(2);
    CAM = (px - RX) * 0.42;
    const v = s ? s.v : 0;
    g.save();
    let jx = 0, jy = 0;
    if (!RM()) { if (shake > 0) { jx = (Math.random() - 0.5) * 16 * shake; jy = (Math.random() - 0.5) * 12 * shake; } if (v > 650 && st.scene === 'play') { jy += (Math.random() - 0.5) * (v - 650) / 260; } }
    if (jx || jy) g.translate(jx, jy);
    drawGround(dist); drawRoadside(dist);
    if (s) drawWorld(a, px); else drawIdle();
    // 바람(속도선): 빠를수록 많이 — 길가 양쪽 아래
    if (s && st.scene === 'play' && !RM() && v > 600) {
      const n = Math.min(16, (v - 600) / 50) | 0; g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.8;
      for (let i = 0; i < n; i++) { const t = ((s.f * v / 16000 + i * 0.37) % 1), sd = i % 2 ? 1 : -1, x0 = CX + sd * (VW * (0.36 + t * 0.2)), y0 = HZ + 140 + t * 330, len = 30 + t * 70; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + sd * len * 0.45, y0 + len); g.stroke(); }
    }
    for (const p of parts) { g.globalAlpha = clamp(p.life / p.max, 0, 1); g.fillStyle = p.c; g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    g.globalAlpha = 1;
    for (const p of pops) {
      const t = 1 - p.life / p.max, al = t > 0.7 ? (1 - t) / 0.3 : 1, sz = (p.big ? 30 : 19) * (t < 0.12 ? 0.7 + t * 2.5 : 1);
      g.globalAlpha = al; g.font = `${sz}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = p.big ? 6 : 4; g.strokeStyle = 'rgba(20,18,40,.9)'; g.lineJoin = 'round'; g.strokeText(p.t, p.x, p.y); g.fillStyle = p.c; g.fillText(p.t, p.x, p.y);
    }
    g.globalAlpha = 1;
    g.restore();
    g.drawImage(vignette().c, 0, 0, VW, VH);
    if (s && s.boost > 0) { const bg = g.createRadialGradient(CX, VH * 0.55, VH * 0.3, CX, VH * 0.55, VW * 0.7); bg.addColorStop(0, 'rgba(90,190,255,0)'); bg.addColorStop(1, 'rgba(90,190,255,.22)'); g.fillStyle = bg; g.fillRect(0, 0, VW, VH); }
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${(flash * 1.4).toFixed(3)})`; g.fillRect(0, 0, VW, VH); }
    if (s) drawHud();
    if (st.scene === 'count' || st.scene === 'resume') drawCount();
    if (touchSeen && (st.scene === 'play' || st.scene === 'count' || st.scene === 'resume')) drawPads();
  }
  // 바닥 사다리꼴(판 x1~x2, y1(먼)~y2(가까운))
  const trap = (x1, x2, y1, y2, fill) => {
    const a = ps(y1), b = ps(y2), t = syOf(a), u = syOf(b);
    g.beginPath(); g.moveTo(sxOf(x1, a), t); g.lineTo(sxOf(x2, a), t); g.lineTo(sxOf(x2, b), u); g.lineTo(sxOf(x1, b), u); g.closePath(); g.fillStyle = fill; g.fill();
  };
  // 길 따라 선 띠(가드레일 등): 바닥에서 h1~h2 높이
  const ribbon = (x, h1, h2, y1, y2, fill) => {
    const a = ps(y1), b = ps(y2), ta = syOf(a), tb = syOf(b), xa = sxOf(x, a), xb = sxOf(x, b);
    g.beginPath(); g.moveTo(xa, ta - h2 * a * PK); g.lineTo(xb, tb - h2 * b * PK); g.lineTo(xb, tb - h1 * b * PK); g.lineTo(xa, ta - h1 * a * PK); g.closePath(); g.fillStyle = fill; g.fill();
  };
  const NEARY = C.PY + 30;   // 달린 거리 w인 바닥의 판 y = NEARY - (w - dist)
  const bands = (dist, period, len, from, fn) => { for (let n = Math.floor((dist + NEARY - Y_BOT) / period); n * period < dist + NEARY - from; n++) { const y2 = NEARY - (n * period - dist); fn(Math.max(y2 - len, Y_FAR), Math.min(y2, Y_BOT), n); } };
  /* --- 길 종류(2026-10-31 하율 "도로도 여러 가지"): 1,600m마다 들판 → 도시 → 해안 → 다리 → 단풍 숲 → 다시 들판 …
     바닥·난간·길가 물건을 '그 땅의 달린 거리'로 고르므로 다음 길이 멀리서부터 다가옴 --- */
  const ZL = 16000;
  const ZONES = [
    { k: 'field', g: ['#8fcb6a', '#5aa344'], st: 'rgba(255,255,255,.09)', sh: '#80858f', rail: 'guard', lamp: 1, deco: ['tree', 'tree', 'pine', 'bush'] },
    { k: 'city', g: ['#c4beb2', '#a49e92'], st: 'rgba(0,0,0,.06)', sh: '#8a8f99', rail: 'wall', lamp: 1, deco: ['bldg'] },
    { k: 'coast', gl: ['#4cb8e8', '#2a86c4'], g: ['#f1dfae', '#ddc584'], st: 'rgba(255,255,255,.28)', sh: '#c9b98e', rail: 'guard', lamp: 0, deco: ['palm', 'palm', 'bush'] },
    { k: 'bridge', gl: ['#3fa4da', '#1f6fa8'], g: ['#3fa4da', '#1f6fa8'], st: 'rgba(255,255,255,.24)', sh: '#9aa0ab', rail: 'bridge', lamp: 1, deco: [] },
    { k: 'autumn', g: ['#cfab5c', '#a5843c'], st: 'rgba(255,240,200,.12)', sh: '#80858f', rail: 'guard', lamp: 0, deco: ['maple', 'maple', 'maple', 'pine'] },
  ];
  const zoneAt = w => w < 0 ? ZONES[0] : ZONES[Math.floor(w / ZL) % ZONES.length];
  const yOfW = (w, dist) => NEARY - (w - dist), wOfY = (y, dist) => dist + NEARY - y;
  const LG = C.ROAD_L - SH, RG = C.ROAD_R + SH;
  const segs = [];
  function zoneSegs(dist) {   // 보이는 바닥을 길 종류별로 자름
    segs.length = 0;
    const wn = wOfY(Y_BOT, dist), wf = wOfY(Y_FAR, dist);
    for (let w = Math.floor(wn / ZL) * ZL; w < wf; w += ZL) segs.push({ z: zoneAt(w), y2: Math.min(Y_BOT, yOfW(Math.max(w, wn), dist)), y1: Math.max(Y_FAR, yOfW(Math.min(w + ZL, wf), dist)) });
    return segs;
  }
  const vgrad = (c0, c1) => { const x = g.createLinearGradient(0, HZ, 0, VH); x.addColorStop(0, shade(c0, 0.18)); x.addColorStop(0.35, c0); x.addColorStop(1, c1); return x; };
  function drawGround(dist) {
    g.fillStyle = '#dcefff'; g.fillRect(0, 0, VW, HZ + 2);
    for (const sg of zoneSegs(dist)) {
      const z = sg.z, gL = vgrad(...(z.gl || z.g)), gR = z.gl ? vgrad(...z.g) : gL, water = z.k === 'bridge' || z.k === 'coast';
      trap(-6000, LG, sg.y1, sg.y2, gL); trap(RG, 6375, sg.y1, sg.y2, gR);
      bands(dist, water ? 110 : 240, water ? 10 : 120, Math.max(sg.y1, -14000), (y1, y2, n) => {   // 잔디 줄무늬 · 물결
        const a1 = Math.max(y1, sg.y1), a2 = Math.min(y2, sg.y2); if (a1 >= a2) return;
        if (water) { const o = (n * 97) % 180; trap(-900 + o, -500 + o, a1, a2, z.st); trap(-420 + o * 0.6, -180 + o * 0.6, a1, a2, z.st); if (z.k === 'bridge') { trap(560 - o * 0.6, 820 - o * 0.6, a1, a2, z.st); trap(900 - o, 1300 - o, a1, a2, z.st); } }
        else { trap(-6000, LG, a1, a2, z.st); trap(RG, 6375, a1, a2, z.st); }
      });
      if (z.k === 'coast') { trap(LG - 70, LG, sg.y1, sg.y2, '#f1dfae'); trap(LG - 82, LG - 70, sg.y1, sg.y2, 'rgba(255,255,255,.7)'); }   // 모래사장·파도 거품
      if (z.k === 'city') { trap(LG - 46, LG, sg.y1, sg.y2, '#d6d2ca'); trap(RG, RG + 46, sg.y1, sg.y2, '#d6d2ca'); }   // 인도
      trap(LG, C.ROAD_L, sg.y1, sg.y2, z.sh); trap(C.ROAD_R, RG, sg.y1, sg.y2, z.sh);
    }
    const rg = g.createLinearGradient(0, HZ, 0, VH); rg.addColorStop(0, '#8d93a0'); rg.addColorStop(0.15, '#5d6270'); rg.addColorStop(1, '#3a3e4a');
    trap(C.ROAD_L, C.ROAD_R, Y_FAR, Y_BOT, rg);
    // 아스팔트 결(보수 자국·얼룩)이 흘러감 — 속도감의 핵심
    bands(dist, 150, 26, -9000, (y1, y2, n) => { const x = ((n * 131) % 330 + 330) % 330; trap(x, x + 40 + (n % 3) * 20, y1, y2, n % 2 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.05)'); });
    for (let l = 0; l < C.LANES; l++) { const cx = C.laneX(l); trap(cx - 22, cx - 13, Y_FAR, Y_BOT, 'rgba(0,0,0,.09)'); trap(cx + 13, cx + 22, Y_FAR, Y_BOT, 'rgba(0,0,0,.09)'); }
    trap(C.ROAD_L + 3, C.ROAD_L + 6.5, Y_FAR, Y_BOT, '#f2f2ec'); trap(C.ROAD_R - 6.5, C.ROAD_R - 3, Y_FAR, Y_BOT, '#f2f2ec');
    bands(dist, 80, 40, -16000, (y1, y2) => { for (let l = 1; l < C.LANES; l++) { const x = C.ROAD_L + l * C.LANE_W; trap(x - 1.8, x + 1.8, y1, y2, 'rgba(245,245,238,.94)'); } });
    bands(dist, 100, 5, -6000, (y1, y2) => { trap(C.ROAD_L + 1, C.ROAD_L + 3, y1, y2, '#ffd34d'); trap(C.ROAD_R - 3, C.ROAD_R - 1, y1, y2, '#ffd34d'); });
    const y0 = NEARY + dist;   // 출발선
    if (y0 > -9000 && y0 - 18 < Y_BOT) for (let i = 0; i < 25; i++) for (let j = 0; j < 2; j++) trap(C.ROAD_L + i * 15, C.ROAD_L + i * 15 + 15, y0 - 18 + j * 9, y0 - 9 + j * 9, (i + j) % 2 ? '#f4f4f4' : '#22242c');
    const km = Math.floor(dist / 10000) * 10000;   // 1km마다 바닥 글씨
    for (const w of [km, km + 10000]) {
      const y = yOfW(w, dist); if (w <= 0 || y < -6000 || y > Y_BOT) continue;
      const q = ps(y);
      g.save(); g.translate(sxOf(RX, q), syOf(q)); g.scale(q * PK, q * PK * 0.6); g.font = `64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(fmt(w / 10) + 'm', 0, 0); g.restore();
    }
  }
  const hsh = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; };
  const side = [];
  function drawRoadside(dist) {
    for (const sg of segs) {   // 가장자리 시설: 가드레일 · 방음벽 · 다리 난간
      const z = sg.z;
      for (const x of [LG + 2, RG - 2]) {
        if (z.rail === 'guard') { ribbon(x, 12, 20, sg.y1, sg.y2, '#c3c8d2'); ribbon(x, 15, 17, sg.y1, sg.y2, 'rgba(255,255,255,.6)'); ribbon(x, 12, 13.2, sg.y1, sg.y2, 'rgba(60,64,80,.4)'); }
        else if (z.rail === 'wall') { ribbon(x, 0, 40, sg.y1, sg.y2, '#aab4c0'); ribbon(x, 32, 40, sg.y1, sg.y2, '#8fd0c8'); ribbon(x, 0, 4, sg.y1, sg.y2, '#7d8592'); }
        else if (z.rail === 'bridge') { ribbon(x, 0, 18, sg.y1, sg.y2, 'rgba(240,243,248,.95)'); ribbon(x, 6, 8, sg.y1, sg.y2, '#aab2c0'); ribbon(x, 16, 18, sg.y1, sg.y2, '#e05050'); }
      }
    }
    side.length = 0;
    const wn = wOfY(Y_BOT + 120, dist), wf = wOfY(-9000, dist);
    for (let i = Math.floor(wn / 80); i * 80 < wf; i++) {   // 길가 물건(80칸마다 · 양쪽)
      const w = i * 80, z = zoneAt(w); if (!z.deco.length) continue;
      for (let sd = 0; sd < 2; sd++) {
        const h = hsh(i * 2 + sd); if (h % 7 === 0) continue;
        let t = z.deco[h % z.deco.length], off = 46 + ((h >>> 4) % 6) * 34;
        if (z.k === 'coast' && sd === 0) { if (h % 3) continue; t = 'umb'; off = 50 + (h >>> 5) % 3 * 16; }   // 바다 쪽은 모래사장 파라솔
        if (t === 'bldg') { if ((i + sd) % 2) continue; off = 120 + (h >>> 4) % 3 * 34; }
        side.push([yOfW(w, dist), sd ? RG + off : LG - off, t, h]);
      }
    }
    for (let i = Math.floor(wn / 300); i * 300 < wf; i++) { const w = i * 300; if (!zoneAt(w).lamp) continue; side.push([yOfW(w, dist), LG - 6, 'lamp', 0]); side.push([yOfW(w, dist), RG + 6, 'lamp', 1]); }
    for (let i = Math.floor(wn / 40); i * 40 < wOfY(-3200, dist); i++) { const w = i * 40; if (zoneAt(w).rail !== 'guard') continue; side.push([yOfW(w, dist), LG + 2, 'post', 0]); side.push([yOfW(w, dist), RG - 2, 'post', 0]); }
    for (let i = Math.floor(wn / 500); i * 500 < wf; i++) { const w = i * 500; if (zoneAt(w).k !== 'bridge') continue; side.push([yOfW(w, dist), LG + 2, 'bpost', 0]); side.push([yOfW(w, dist), RG - 2, 'bpost', 0]); }
    side.sort((p, q) => p[0] - q[0]);
    for (const [y, x, t, h] of side) {
      const q = ps(y), sy = syOf(q); if (sy < HZ + 1) continue;
      const sc = q * PK, al = fadeY(y), X = sxOf(x, q);
      if (X < -200 || X > VW + 200) continue;
      if (t === 'tree') put(treeArt(h % 6), X, sy, sc * (1 + (h % 5) * 0.1), al);
      else if (t === 'pine') put(treeArt(2 + (h % 2) * 3), X, sy, sc * (1 + (h % 4) * 0.1), al);
      else if (t === 'bush') put(bushArt(), X, sy, sc * 1.2, al);
      else if (t === 'maple') put(mapleArt(h % 4), X, sy, sc * (1 + (h % 4) * 0.1), al);
      else if (t === 'palm') put(palmArt(h % 2), X, sy, sc * (0.95 + (h % 3) * 0.12), al);
      else if (t === 'umb') put(umbArt(h % 4), X, sy, sc, al);
      else if (t === 'bldg') put(bldgArt(h % 15), X, sy, sc, al);
      else if (t === 'lamp') put(lampArt(h), X, sy, sc, al);
      else if (t === 'post') put(postArt(), X, sy, sc, al);
      else put(bpostArt(), X, sy, sc, al);
    }
    // 먼 곳은 하늘빛으로 흐릿하게(대기 원근)
    const hz = g.createLinearGradient(0, HZ, 0, HZ + 110); hz.addColorStop(0, 'rgba(220,239,255,.95)'); hz.addColorStop(1, 'rgba(220,239,255,0)'); g.fillStyle = hz; g.fillRect(0, 0, VW, HZ + 110);
  }
  const fadeY = y => clamp((y + 9000) / 3000, 0, 1);
  function drawIdle() { const f = ps(C.PY - C.P_HH), r = ps(C.PY + C.P_HH); putCar(playerArt(), sxOf(C.laneX(2), ps(C.PY)), syOf(f), syOf(r), ps(C.PY) * PK); }
  const list = [];
  function drawWorld(a, px) {
    if (s.boost > 0 && !RM()) {   // 부스터 속도선(소실점 쪽으로)
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2.5;
      for (let i = 0; i < 22; i++) { const x = -260 + ((i * 53) % 900), y = ((i * 131 + s.f * 40) % 1500) - 900, q1 = ps(y - 120), q2 = ps(y); g.beginPath(); g.moveTo(sxOf(x, q1), syOf(q1) - 30 * q1 * PK); g.lineTo(sxOf(x, q2), syOf(q2) - 30 * q2 * PK); g.stroke(); }
    }
    list.length = 0;
    for (const it of s.items) if (!it.got) list.push([lerp(it._py ?? it.y, it.y, a) + it.hh, 0, it]);
    for (const c of s.cars) list.push([lerp(c._py ?? c.y, c.y, a) + c.hh, 1, c]);
    list.push([C.PY + C.P_HH, 2, null]);
    list.sort((p, q) => p[0] - q[0]);
    for (const [y, t, o] of list) {
      const q = ps(y), sy = syOf(q); if (sy < HZ || sy > VH + 140) continue;
      const sc = q * PK * 0.95, al = clamp((y - C.FAR) / 260, 0, 1);
      if (t === 0) {
        if (o.t === 'wall') put(wallArt(), sxOf(o.x, q), sy, q * PK, al);
        else if (o.t === 'box') put(itemArt('box'), sxOf(o.x, q), sy - Math.abs(Math.sin((s.f + o.id * 7) * 0.12)) * 6 * sc, sc * 0.95, al);
        else if (o.t === 'coin') { const sp = Math.abs(Math.cos((s.f + o.id * 9) * 0.09)); g.save(); g.translate(sxOf(o.x, q), sy); g.scale(0.25 + sp * 0.75, 1); put(itemArt('coin'), 0, 0, sc * 0.9, al); g.restore(); }
        else put(itemArt(o.t), sxOf(o.x, q), sy, sc * (o.t === 'cone' ? 1.05 : 0.9), al);
      } else if (t === 1) {
        const x = lerp(o._px ?? o.x, o.x, a), art2 = carArt(o.k, o.col, o.hw, o.hh), yc = y - o.hh, qc = ps(yc), cx = sxOf(x, qc), yF = syOf(ps(yc - o.hh)), sc2 = qc * PK;
        if (o.dead) {
          const tt = o.dead / 50, dir = o.id % 2 ? 1 : -1, my = (yF + sy) / 2;
          g.save(); g.translate(cx + dir * tt * 300, my - tt * 230); g.rotate(dir * tt * 7); g.scale(1 + tt * 0.5, 1 + tt * 0.5); putCar(art2, 0, yF - my, sy - my, sc2, clamp(1 - tt * 1.2, 0, 1)); g.restore(); continue;
        }
        const lean = o.mv ? (C.laneX(o.to) > o.x ? 0.06 : -0.06) : 0;
        if (lean) { g.save(); g.translate(cx, sy); g.rotate(lean); putCar(art2, 0, yF - sy, 0, sc2, al); g.restore(); } else putCar(art2, cx, yF, sy, sc2, al);
        if ((o.blink || o.mv) && (s.f >> 3) % 2 === 0) {   // 깜빡이(뒤 모서리)
          const sd = o.to > o.lane ? 1 : -1, bx = cx + sd * (o.hw + 1) * sc2, by = sy + 3 * sc2;
          const gl = g.createRadialGradient(bx, by, 0, bx, by, 9 * sc2); gl.addColorStop(0, 'rgba(255,200,60,1)'); gl.addColorStop(0.4, 'rgba(255,170,30,.7)'); gl.addColorStop(1, 'rgba(255,170,30,0)'); g.fillStyle = gl; g.beginPath(); g.arc(bx, by, 9 * sc2, 0, 7); g.fill();
        }
      } else drawPlayer(px, q, sy, sc, a);
    }
    for (const k2 of streaks) { const q = ps(k2.y), x0 = sxOf(k2.x, q), y0 = syOf(q) - 20 * q * PK; g.strokeStyle = `rgba(255,255,255,${(k2.life * 2).toFixed(2)})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y0 + 40 * q * PK); g.stroke(); }
    // 바리케이드 경고
    const wall = s.items.find(it => it.t === 'wall' && !it.got && it.y > -1200 && it.y < C.PY - 40);
    if (wall) {
      if (warnShown !== wall.id) { warnShown = wall.id; sfx.warn(); }
      const now = C.PY - wall.y < s.v * 0.5 + 30, ok = !s.p.air && !s.p.cd;
      if (now || (s.f >> 3) % 2 === 0 || RM()) {
        g.save(); g.translate(VW / 2, 112);
        g.fillStyle = now ? (ok ? 'rgba(60,200,110,.92)' : 'rgba(255,190,40,.92)') : 'rgba(255,190,40,.92)'; rr(g, -110, -26, 220, 52, 14); g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.stroke();
        g.font = `28px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1c1d2b'; g.fillText(now ? '지금 점프!' : '⚠ 바리케이드', 0, 2);
        g.restore();
      }
    }
  }
  function drawPlayer(px, q, sy, sc, a) {
    const P = s.p, air = P.air > 0 ? Math.sin((1 - (P.air - a) / C.JUMP_F) * Math.PI) : 0, qc = ps(C.PY), cx = sxOf(px, qc), yF = syOf(ps(C.PY - C.P_HH)), s2 = qc * PK, rb = 12 * s2 * 0.72;
    const my = (yF + sy + rb) / 2;   // 차 가운데(그림자·빛 자리)
    if (air > 0) { const sg = g.createRadialGradient(cx, my, 1, cx, my, 34 * s2); sg.addColorStop(0, 'rgba(10,10,25,.42)'); sg.addColorStop(1, 'rgba(10,10,25,0)'); g.save(); g.translate(cx, my); g.scale(1, 0.75); g.fillStyle = sg; g.beginPath(); g.arc(0, 0, 34 * s2 * (1 - air * 0.25), 0, 7); g.fill(); g.restore(); }
    const lift = air * 70 * s2, gs = 1 + air * 0.16;
    if (s.boost > 0) {
      const gl = g.createRadialGradient(cx, my - lift, 2, cx, my - lift, 56 * s2); gl.addColorStop(0, 'rgba(140,220,255,.5)'); gl.addColorStop(1, 'rgba(140,220,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(cx, my - lift, 56 * s2, 0, 7); g.fill();
      for (const ox of [-7, 7]) { const fl = (16 + Math.random() * 20) * s2, fx = cx + ox * s2, fy = sy + rb * 0.6 - lift; const fg = g.createLinearGradient(fx, fy, fx, fy + fl); fg.addColorStop(0, '#fff7c2'); fg.addColorStop(0.4, '#ffb52e'); fg.addColorStop(1, 'rgba(255,80,30,0)'); g.fillStyle = fg; g.beginPath(); g.moveTo(fx - 4 * s2, fy); g.quadraticCurveTo(fx, fy + fl * 1.2, fx + 4 * s2, fy); g.fill(); }
    }
    const wreck = (st.scene === 'crash' || st.scene === 'over') && (s.over === 'crash' || s.over === 'wall' || s.over === 'cone');
    const blinkOff = (s.grace > 0 || (s.boost > 0 && s.boost < 50)) && (s.f >> 2) % 2 === 0;
    tilt = lerp(tilt, clamp(P.vx / C.SIDE_V, -1, 1) * 0.12, 0.3);
    if (!wreck) { const ug = g.createRadialGradient(cx, my, 1, cx, my, 46 * s2); ug.addColorStop(0, 'rgba(80,200,255,.5)'); ug.addColorStop(1, 'rgba(80,200,255,0)'); g.save(); g.translate(cx, my); g.scale(0.8, 1); g.fillStyle = ug; g.beginPath(); g.arc(0, 0, 46 * s2, 0, 7); g.fill(); g.restore(); }   // 내 차 밑 빛(어디 있는지 한눈에)
    g.save(); g.translate(cx, my - lift);
    if (wreck) g.rotate((0.35 + Math.min(crashT / 600, 1) * 0.5) * (px < RX ? -1 : 1)); else if (tilt) g.rotate(tilt);
    if (gs !== 1) g.scale(gs, gs);
    putCar(playerArt(), 0, yF - my, sy - my, s2, blinkOff ? 0.45 : 1);
    g.restore();
    if (wreck) { for (let i = 0; i < 5; i++) { const r = (12 + i * 5) * s2, yy = my - 20 * s2 - i * 18 * s2 - crashT / 26; const sm = g.createRadialGradient(cx, yy, 1, cx, yy, r); sm.addColorStop(0, 'rgba(70,72,85,.5)'); sm.addColorStop(1, 'rgba(70,72,85,0)'); g.fillStyle = sm; g.beginPath(); g.arc(cx + Math.sin(crashT / 200 + i) * 14 * s2, yy, r, 0, 7); g.fill(); } }
  }
  // 유리 패널 HUD
  const panel = (x, y, w, h, r = 12) => { g.fillStyle = 'rgba(16,18,34,.48)'; rr(g, x, y, w, h, r); g.fill(); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.2; g.stroke(); };
  function gauge(x, y, w, v, cols, label, icon, warn) {
    panel(x, y, w, 40);
    icon(x + 20, y + 20);
    g.font = `13px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = warn ? '#ffb4b4' : 'rgba(255,255,255,.85)'; g.fillText(label, x + 38, y + 12);
    const bx = x + 38, by = y + 21, bw = w - 50, bh = 10;
    g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, bx, by, bw, bh, 5); g.fill();
    if (v > 0) { const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); g.fillStyle = gr; rr(g, bx, by, Math.max(bh, bw * clamp(v, 0, 1)), bh, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, bx + 2, by + 1.5, Math.max(4, bw * clamp(v, 0, 1) - 4), 2.5, 1.5); g.fill(); }
  }
  const pumpIcon = (x, y) => { g.fillStyle = '#ff7a6b'; rr(g, x - 8, y - 9, 11, 18, 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x - 6, y - 7, 7, 5); g.strokeStyle = '#ff7a6b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 3, y - 5); g.lineTo(x + 7, y - 2); g.lineTo(x + 7, y + 6); g.stroke(); };
  const boltIcon = (x, y) => { g.fillStyle = '#7fd4ff'; g.beginPath(); g.moveTo(x + 2, y - 10); g.lineTo(x - 6, y + 2); g.lineTo(x - 1, y + 2); g.lineTo(x - 3, y + 10); g.lineTo(x + 6, y - 2); g.lineTo(x + 1, y - 2); g.closePath(); g.fill(); };
  let scoreTxt = '', scoreV = -1, mTxt = '', mV = -1, kmh = 0;
  function drawHud() {
    const scv = C.scoreOf(s), m = C.metersOf(s);
    if (scv !== scoreV) { scoreV = scv; scoreTxt = fmt(scv); }
    if (m !== mV) { mV = m; mTxt = fmt(m) + ' m'; }
    kmh = lerp(kmh, s.v * 0.36, 0.2);
    // 점수(가운데 위)
    panel(VW / 2 - 110, 10, 220, 64, 16);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `38px ${FONT}`; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.fillText(scoreTxt, VW / 2, 36); g.shadowBlur = 0;
    g.font = `14px ${FONT}`; g.fillStyle = '#ffd25e'; g.fillText(mTxt, VW / 2 - 44, 61); g.fillStyle = '#9fe0ff'; g.fillText(Math.round(kmh) + ' km/h', VW / 2 + 44, 61);
    const low = s.fuel < 25 && s.fuel > 0, blink = low && (s.f >> 4) % 2 === 0;
    gauge(14, 12, 220, s.fuel / C.FUEL0, blink ? ['#ff3b3b', '#ff7a6b'] : ['#ff6b5e', '#ffb36b'], low ? '연료 부족!' : '연료', pumpIcon, low);
    const bv = s.boost > 0 ? s.boost / C.BOOST_F : s.fever / 100;
    gauge(VW - 234, 12, 220, bv, s.boost > 0 ? [`hsl(${(s.f * 6) % 360},95%,62%)`, `hsl(${(s.f * 6 + 90) % 360},95%,62%)`] : ['#3da8ff', '#7fe3ff'], s.boost > 0 ? '부스터 발동!' : '부스터', boltIcon, false);
    if (s.combo > 1) {
      const left = 1 - (s.f - s.lastNear) / C.COMBO_F;
      panel(VW - 150, 60, 136, 38, 12);
      g.font = `20px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#ffd25e'; g.fillText('콤보 x' + s.combo, VW - 82, 76);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(VW - 136, 89, 108, 4); g.fillStyle = '#ffd25e'; g.fillRect(VW - 136, 89, 108 * clamp(left, 0, 1), 4);
    }
  }
  function drawCount() {
    const total = st.scene === 'resume' ? 1000 : 3000, left = total - countT;
    let t, ph;
    if (left > 0) { t = String(Math.ceil(left / 1000)); ph = 1 - ((left / 1000) % 1 || 1); }
    else { t = seed != null || !opts.seed ? '출발!' : '연결 중…'; ph = 0.5; }
    const sz = (t.length > 2 ? 52 : 110) * (ph < 0.15 ? 0.6 + ph * 3 : 1);
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.font = `${sz}px ${FONT}`;
    g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 14; g.lineWidth = 9; g.strokeStyle = 'rgba(20,18,40,.85)'; g.strokeText(t, VW / 2, 250); g.shadowBlur = 0; g.fillStyle = left > 0 ? '#fff' : '#ffd25e'; g.fillText(t, VW / 2, 250);
    if (st.scene === 'count' && !s) { g.font = `19px ${FONT}`; g.lineWidth = 4; const m = touchSeen ? '왼쪽 ◀ · 오른쪽 ▶ 한 차선씩 · 가운데 점프' : keyTxt(); g.strokeText(m, VW / 2, 322); g.fillStyle = '#fff'; g.fillText(m, VW / 2, 322); }
    g.restore();
  }
  function drawPads() {
    const P = s?.p, ready = !P || (!P.air && !P.cd), now = performance.now();
    const pad = (x, y, r, z, paint) => {
      const on = now - padHit[z] < 140;
      g.save(); g.fillStyle = on ? 'rgba(255,255,255,.5)' : 'rgba(16,18,34,.32)'; g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r * (on ? 0.94 : 1), 0, 7); g.fill(); g.stroke(); paint(); g.restore();
    };
    const tri = (x, y, d) => { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.moveTo(x + d * 13, y); g.lineTo(x - d * 9, y - 15); g.lineTo(x - d * 9, y + 15); g.closePath(); g.fill(); };
    pad(70, VH - 76, 44, 'L', () => tri(70, VH - 76, -1));
    pad(VW - 70, VH - 76, 44, 'R', () => tri(VW - 70, VH - 76, 1));
    pad(VW / 2, VH - 30, 26, 'J', () => {
      if (!ready && P) { const f = P.air ? 0 : 1 - P.cd / C.JUMP_CD; g.strokeStyle = '#7fd4ff'; g.lineWidth = 3.5; g.beginPath(); g.arc(VW / 2, VH - 30, 22, -Math.PI / 2, -Math.PI / 2 + f * 6.283); g.stroke(); }
      g.font = `15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('점프', VW / 2, VH - 29);
    });
  }

  /* --- 소리 버튼 --- */
  const paintSnd = () => { const on = sfx.on, t = on ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${on ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', on); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', on); };
  sndBtn.onclick = () => { sfx.set(!sfx.on); paintSnd(); opts.onSound?.(sfx.on); sndBtn.blur(); };
  paintSnd();

  fit(); onPort();
  if (opts.quick && !portMQ.matches) { st.scene = 'ready'; start(); } else showReady();
  raf = requestAnimationFrame(frame);
  document.fonts?.load?.(`20px ${FONT}`, '카체이싱 점프 연료 부스터 발동 아슬아슬 콤보 출발 연결 중 바리케이드 지금 공사중 부족 0123456789,m+x!?…km/h').then(() => { art.clear(); }).catch(() => {});

  return {
    st, get sim() { return s; }, get best() { return best; },
    setBest(b) { best = Math.max(best, b || 0); },
    msg(html) { msgNow = html; const m = ov.querySelector('.cs-msg'); if (m && st.scene === 'over') m.innerHTML = html; },
    setSound(on) { sfx.set(on); paintSnd(); },
    start, pause, resume, again: () => again(),
    _press(z) { press(z); },   // 테스트용: 'L' · 'R' · 'J'
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); sfx.set(false); evRun++;
      portMQ.removeEventListener?.('change', onPort);
      document.removeEventListener('keydown', kd);
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', vis);
    },
  };
}
