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
// 속도 표시(2026-11-01 하율 "300km 즈음"): 화면 숫자만 — 기본 속도 약 245~335, 슬립·부스터면 400대(예전 v×0.36 = 330~790)
const kmhOf = v => v > 0 ? 180 + v * 0.07 : 0;
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
  // 2026-10-31 하율 "타격감·화려하게·효과음 만들어서": 마스터 체인(압축기 + 짧은 잔향) 위에 합성 효과음
  let ac = null, on = false, eng = null, bus = null, rev = null;
  const ctx = () => {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const cp = ac.createDynamicsCompressor(); cp.threshold.value = -16; cp.knee.value = 10; cp.ratio.value = 5; cp.attack.value = 0.003; cp.release.value = 0.18;
        const mg = ac.createGain(); mg.gain.value = 0.9; cp.connect(mg).connect(ac.destination);
        bus = ac.createGain(); bus.connect(cp);
        const n = Math.floor(ac.sampleRate * 0.9), ir = ac.createBuffer(2, n, ac.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
        const cv2 = ac.createConvolver(); cv2.buffer = ir; rev = ac.createGain(); rev.gain.value = 0.22; rev.connect(cv2).connect(cp);
      } catch { ac = null; }
    }
    if (ac?.state === 'suspended') ac.resume().catch(() => {}); return ac;
  };
  const out = (node, wet = 0) => { node.connect(bus); if (wet && rev) { const w = ac.createGain(); w.gain.value = wet; node.connect(w).connect(rev); } };
  const tone = (f, d, type = 'square', v = 0.06, f2 = 0, delay = 0, wet = 0.3) => {
    if (!on) return; const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); out(g, wet); o.start(t); o.stop(t + d + 0.03);
  };
  // 잡음: ft = 필터 종류(lowpass·bandpass·highpass), f → f2로 훑음, q = 공명
  const noise = (d, v = 0.08, f = 1200, f2 = 0, ft = 'lowpass', delay = 0, q = 0.8, wet = 0.2) => {
    if (!on) return; const a = ctx(); if (!a) return;
    const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6);
    const sr = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + delay;
    sr.buffer = b; fl.type = ft; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.value = v; sr.connect(fl).connect(g); out(g, wet); sr.start(t);
  };
  const boom = (f, d, v, delay = 0) => tone(f, d, 'sine', v, Math.max(20, f * 0.3), delay, 0.15);   // 묵직한 쿵
  const glass = (n, v, spread, delay = 0) => {   // 유리 쨍그랑: 높은 핑 여러 개 + 쉭
    noise(0.35, v * 1.4, 5200, 2600, 'highpass', delay, 0.7, 0.4);
    for (let i = 0; i < n; i++) { const f = 2400 + Math.random() * 4200; tone(f, 0.08 + Math.random() * 0.22, 'sine', v * (0.5 + Math.random() * 0.6), f * (0.97 + Math.random() * 0.05), delay + Math.random() * spread, 0.6); }
  };
  const metal = (v, delay = 0) => {   // 금속 찌그러짐: 어긋난 배음 덩어리
    [173, 241, 389, 557, 911].forEach((f, i) => tone(f, 0.18 + i * 0.05, i % 2 ? 'square' : 'sawtooth', v * (1 - i * 0.12), f * 0.55, delay + i * 0.006, 0.35));
    noise(0.25, v * 2.2, 2600, 500, 'bandpass', delay, 2.5, 0.3);
  };
  const engine = (v, boost = 0) => {   // 엔진: 톱니 + 사각 + 한 옥타브 위 웅웅, 부스터면 더 높고 거칠게
    if (!on || v <= 0) { if (eng) { try { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); } catch {} } return; }
    const a = ctx(); if (!a) return;
    if (!eng) {
      const o = a.createOscillator(), o2 = a.createOscillator(), o3 = a.createOscillator(), fl = a.createBiquadFilter(), g = a.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sawtooth'; fl.type = 'lowpass'; fl.frequency.value = 420; fl.Q.value = 3; g.gain.value = 0;
      o.connect(fl); o2.connect(fl); o3.connect(fl); fl.connect(g); g.connect(bus); o.start(); o2.start(); o3.start();
      eng = { o, o2, o3, g, fl };
    }
    const f = 38 + v * 0.085 + boost * 30, t = a.currentTime;
    eng.o.frequency.setTargetAtTime(f, t, 0.08); eng.o2.frequency.setTargetAtTime(f * 0.502, t, 0.08); eng.o3.frequency.setTargetAtTime(f * 2.01, t, 0.08);
    eng.fl.frequency.setTargetAtTime(380 + v * 0.35 + boost * 900, t, 0.1); eng.g.gain.setTargetAtTime(0.0026 - boost * 0.0004, t, 0.1);   // 크기 맞춤(2026-11-01 tools/sfx): 계속 깔리는 소리라 다른 효과음보다 8dB 작게
  };
  const stopEngine = () => { if (eng) { try { eng.o.stop(); eng.o2.stop(); eng.o3.stop(); } catch {} eng = null; } };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  return {
    get on() { return on; }, set(v) { on = v; if (!v) stopEngine(); else ctx(); }, unlock: () => { if (on) ctx(); },
    engine, stopEngine,
    // 칼치기: 휙(바람) + 콤보마다 높아지는 반짝 두 음
    near: (c, close) => {
      noise(0.28, close ? .0531 : .0783, 700, 4200, 'bandpass', 0, 1.6, 0.2);
      const st = PENTA[Math.min(c - 1, PENTA.length - 3)], b = 784 * Math.pow(2, st / 12);
      tone(b, 0.12, 'triangle', .0392, 0, 0.02, 0.5); tone(b * 1.5, 0.18, 'triangle', .0336, 0, 0.08, 0.6);
      if (close) { tone(b * 2, 0.22, 'sine', .00476, 0, 0.13, 0.7); noise(0.12, .00713, 6000, 0, 'highpass', 0.1, 0.7, 0.5); }
    },
    combo: c => { [0, 4, 7, 12, 16].forEach((st, i) => tone(523 * Math.pow(2, st / 12), 0.16, i % 2 ? 'square' : 'triangle', .0127, 0, i * 0.06, 0.5)); tone(523 * 4, 0.5, 'sine', .0127, 0, 0.32, 0.8); boom(110, 0.3, .0305); },
    coin: () => { tone(1568, 0.07, 'square', 0.035, 0, 0, 0.4); tone(2093, 0.16, 'triangle', 0.05, 0, 0.05, 0.6); },
    fuel: () => { [0, 0.07, 0.14].forEach((d, i) => tone(260 + i * 90, 0.09, 'sine', .0382, 160 + i * 60, d, 0.3)); tone(660, 0.18, 'triangle', .0255, 1320, 0.2, 0.5); },
    box: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.12, i % 2 ? 'square' : 'triangle', .00867, 0, i * 0.045, 0.6)); noise(0.4, .0116, 3000, 9000, 'highpass', 0.1, 0.7, 0.6); },
    // 부스터: 쿵 + 터보 휘이잉(잡음 훑기) + 올라가는 톱니
    boost: () => { boom(70, 0.6, .0521); noise(1.1, .0372, 300, 6500, 'bandpass', 0, 1.2, 0.3); tone(110, 0.9, 'sawtooth', .00931, 880, 0.02, 0.3); tone(220, 0.7, 'square', .00559, 1320, 0.1, 0.4); },
    ramp: () => { metal(.00847); boom(120, 0.25, .0621); noise(0.9, .0452, 400, 5000, 'bandpass', 0.05, 1.3, 0.35); tone(196, 0.8, 'sawtooth', .0113, 784, 0.05, 0.4); tone(392, 0.6, 'triangle', .0113, 1568, 0.15, 0.6); },
    slip: () => { noise(0.7, .0774, 350, 2600, 'bandpass', 0, 1.4, 0.3); tone(330, 0.5, 'sine', .0179, 660, 0.05, 0.5); },
    boostEnd: () => { noise(0.5, .054, 3000, 300, 'bandpass', 0, 1.2, 0.3); tone(600, 0.4, 'sawtooth', .0203, 150, 0, 0.3); },
    jump: () => { tone(260, 0.2, 'square', .063, 760, 0, 0.3); noise(0.15, .0945, 1500, 4000, 'bandpass', 0, 1.2, 0.1); },
    lane: () => noise(0.11, .206, 1800, 600, 'bandpass', 0, 2, 0.05),
    land: () => { boom(130, 0.16, 0.18); noise(0.12, 0.1, 700, 200, 'lowpass', 0, 0.8, 0.1); },
    // 부스터로 차 날리기: 쿵 + 금속 + 유리 몇 조각
    smash: wall => {
      boom(150, 0.3, .0574); metal(wall ? .0088 : .00897);
      if (wall) { noise(0.3, .0448, 1400, 300, 'bandpass', 0, 3, 0.3); [0, 0.05, 0.11].forEach(d => noise(0.06, .0362, 2500, 0, 'bandpass', d, 4, 0.2)); }
      else glass(5, .00718, 0.2, 0.04);
    },
    thud: v => { boom(100, 0.18, 0.14 * v); noise(0.1, 0.12 * v, 1200, 300, 'lowpass', 0, 1, 0.2); metal(0.015 * v); },
    // 충돌: 와장창 — 깊은 쿵 + 폭발 잡음 + 금속 + 유리 산산조각 + 떨어지는 파편
    crash: () => {
      boom(95, 1.1, .0167); boom(55, 1.4, .013, 0.02);
      noise(1.3, .0127, 3800, 90, 'lowpass', 0, 0.9, 0.35);
      metal(.0026); metal(.00167, 0.09);
      glass(18, .00186, 0.55, 0.03);
      for (let i = 0; i < 9; i++) noise(0.05 + Math.random() * 0.05, 0.05 + Math.random() * .00223, 1500 + Math.random() * 3000, 0, 'bandpass', 0.35 + Math.random() * 0.9, 3, 0.3);
    },
    beep: hi => tone(hi ? 880 : 440, hi ? 0.35 : 0.14, 'square', hi ? .0466 : .116, 0, 0, 0.3),
    warn: () => { tone(740, 0.08, 'square', 0.04); tone(740, 0.08, 'square', 0.04, 0, 0.14); },
    empty: () => tone(200, 0.5, 'triangle', 0.07, 90),
    stop: () => noise(0.5, .149, 600, 100),
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
// ===== 자동차 3D — 2026-10-31 23:28 하율 "시점에 비해 차가 너무 납작해 · 정말 실제처럼 · 좌우로 움직일 때 앞부분이 방향 따라" =====
// 차마다 입체 여러 개(바닥 평면도 + 윗면 높이·안쪽으로 줄어듦)로 만들어 두고 매 프레임 원근으로 그림 → 옆면·뒷면·지붕이 각도에 맞게 보임.
// 로컬 좌표: x 오른쪽 · y 뒤쪽(+) · z 위. yaw(라디안) > 0이면 앞이 오른쪽. 원점 = 차 가운데(판 좌표 c.x, c.y).
const ZK = 0.82;   // 높이 배율(폭 배율 대비)
const GLASS = '#26354d';
const oct = (W, y0, y1, cf, cr) => [[-W / 2 + cf, y0], [W / 2 - cf, y0], [W / 2, y0 + cf], [W / 2, y1 - cr], [W / 2 - cr, y1], [-W / 2 + cr, y1], [-W / 2, y1 - cr], [-W / 2, y0 + cf]];
// 입체 하나: p 평면도(시계 방향, 앞 왼쪽부터) · z0 바닥 높이 · zf/zr 윗면 앞/뒤 높이 · ix 윗면 옆으로 줄어듦 · iyf/iyr 앞/뒤로 줄어듦(유리 기울기)
// c 몸 색 · sc 옆면 색(유리) · rc 뒷면 색 · tc 윗면 색
function solid(o) {
  const ys = o.p.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), mid = (y0 + y1) / 2;
  const zAt = y => o.zf + (o.zr - o.zf) * (y - y0) / (y1 - y0 || 1);
  const ix = o.ix || 0, iyf = o.iyf || 0, iyr = o.iyr || 0;
  const t = o.p.map(([x, y]) => { const ty = y < mid ? y + iyf : y - iyr; return [Math.sign(x) * Math.max(Math.abs(x) - ix, Math.abs(x) * 0.3), ty, zAt(ty)]; });
  const b = o.p.map(([x, y]) => [x, y, o.z0]);
  const n = b.length, fc = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = b[j][0] - b[i][0], dy = b[j][1] - b[i][1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
    const base = ny > 0.7 && o.rc ? o.rc : (Math.abs(nx) > 0.5 && o.sc) ? o.sc : o.c;
    fc.push(shade(base, clamp(-0.12 + 0.08 * ny - 0.12 * nx, -0.5, 0.3)));
  }
  return { ...o, b, t, n, fc, top: o.tc || shade(o.c, 0.12), zAt, y0, y1 };
}
// 면 위의 점: 면 i(꼭짓점 i→i+1)에서 f(0~1 가로) · v(0 아래~1 위), 바깥으로 살짝 띄움
const onFace = (S, i, f, v, out = 0.3) => {
  const j = (i + 1) % S.n, B0 = S.b[i], B1 = S.b[j], T0 = S.t[i], T1 = S.t[j];
  const bx = B0[0] + (B1[0] - B0[0]) * f, by = B0[1] + (B1[1] - B0[1]) * f, tx = T0[0] + (T1[0] - T0[0]) * f, ty = T0[1] + (T1[1] - T0[1]) * f, tz = T0[2] + (T1[2] - T0[2]) * f;
  const dx = B1[0] - B0[0], dy = B1[1] - B0[1], l = Math.hypot(dx, dy) || 1;
  return [bx + (tx - bx) * v + dy / l * out, by + (ty - by) * v - dx / l * out, S.z0 + (tz - S.z0) * v];
};
const faceQuad = (S, i, f0, f1, v0, v1, c, extra) => ({ p: [onFace(S, i, f0, v0), onFace(S, i, f1, v0), onFace(S, i, f1, v1), onFace(S, i, f0, v1)], c, ...extra });
const topQuad = (S, x0, x1, y0, y1, c, up = 0.25) => ({ p: [[x0, y0, S.zAt(y0) + up], [x1, y0, S.zAt(y0) + up], [x1, y1, S.zAt(y1) + up], [x0, y1, S.zAt(y1) + up]], c });
// oct 면 번호: 0 앞 · 2 오른쪽(앞→뒤) · 4 뒤(오른쪽→왼쪽) · 6 왼쪽(뒤→앞)
const sides = (S, f0, f1, v0, v1, c, extra) => [faceQuad(S, 2, f0, f1, v0, v1, c, extra), faceQuad(S, 6, 1 - f1, 1 - f0, v0, v1, c, extra)];

const CAR_COL = { taxi: '#f2a516', police: '#f4f6f8', bus: '#2f9e5b', player: '#2f7df6', ramp: '#f2b705' };
function buildCar(kind, col, hw, hh) {
  if (CAR_COL[kind]) col = CAR_COL[kind];
  const W = hw * 2 + 2, L = hh * 2 * (kind === 'bus' || kind === 'truck' || kind === 'ramp' ? 1.12 : 1.3), y1 = hh + 1, y0 = y1 - L, at = f => y0 + L * f;
  const S = [], D = [], WH = [], M = { W, L, y0, y1, S, D, WH, kind, glow: [], col };
  const wheel = (f, front, big = 1) => {
    const ww = W * 0.17 * big, wl = L * (kind === 'bus' || kind === 'truck' || kind === 'ramp' ? 0.1 : 0.16), h = W * 0.36 * big;
    for (const sd of [-1, 1]) { const cx = sd * (W / 2 - ww * 0.3), cy = at(f); WH.push({ front, cx, cy, s: solid({ p: oct(ww, cy - wl / 2, cy + wl / 2, ww * 0.25, ww * 0.25), z0: 0, zf: h, zr: h, iyf: wl * 0.18, iyr: wl * 0.18, c: '#1b1c22', tc: '#2c2d34' }) }); }
  };
  const tail = (B, v0, v1, w = 0.26, c = '#d32a2f') => { D.push(faceQuad(B, 4, 0.03, w, v0, v1, c), faceQuad(B, 4, 1 - w, 0.97, v0, v1, c), faceQuad(B, 4, 0.06, w * 0.6, v0 + (v1 - v0) * 0.55, v1 - (v1 - v0) * 0.1, '#ff8d8d'), faceQuad(B, 4, 1 - w * 0.6, 0.94, v0 + (v1 - v0) * 0.55, v1 - (v1 - v0) * 0.1, '#ff8d8d')); };
  const plate = (B, v0, v1) => D.push(faceQuad(B, 4, 0.38, 0.62, v0, v1, '#eef0f3'), faceQuad(B, 4, 0.41, 0.59, v0 + (v1 - v0) * 0.3, v1 - (v1 - v0) * 0.3, '#3a3f52'));
  const bumper = (B, v1 = 0.18) => D.push(faceQuad(B, 4, -0.02, 1.02, 0, v1, '#2a2c33'));
  const mirrors = (f, z) => { for (const sd of [-1, 1]) S.push(solid({ p: oct(W * 0.12, at(f), at(f + 0.035), 1, 1).map(([x, y]) => [x + sd * W * 0.53, y]), z0: z, zf: z + W * 0.09, zr: z + W * 0.09, c: col })); };
  const glassHi = (C2, i = 4) => D.push(faceQuad(C2, i, 0.15, 0.32, 0.15, 0.9, 'rgba(255,255,255,.16)'), faceQuad(C2, i, 0.38, 0.44, 0.15, 0.9, 'rgba(255,255,255,.1)'));
  // 승용차 공통(세단·택시·경찰·해치·소형·SUV·스포츠·내 차)
  const car = o => {
    const B = solid({ p: oct(W, at(0), at(1), W * o.cf, W * o.cr), z0: W * o.z0, zf: W * o.hf, zr: W * o.hr, ix: W * 0.06, iyf: L * 0.04, iyr: L * (o.tr ?? 0.025), c: col });
    const C2 = solid({ p: oct(W * o.cw, at(o.c0), at(o.c1), W * 0.12, W * 0.1), z0: W * (Math.min(o.hf, o.hr) - 0.04), zf: W * o.roof, zr: W * o.roof, ix: W * o.ci, iyf: L * o.ws, iyr: L * o.rw, c: col, sc: GLASS, rc: GLASS, tc: o.rc || shade(col, 0.1) });
    M.B = B; M.C = C2;
    wheel(0.17, true, o.wb || 1); wheel(o.rwf || 0.8, false, o.wb || 1);
    S.push(B, C2); mirrors(o.c0 + 0.01, W * (o.hf + 0.02));
    // 기둥(옆 유리 가운데) · 뒷유리 반사 · 문 틈
    D.push(...sides(C2, 0.47, 0.53, 0, 1, shade(col, -0.15)));
    D.push(...sides(B, o.c0 + 0.1, o.c0 + 0.105, 0.15, 0.95, 'rgba(0,0,0,.25)'));
    glassHi(C2);
    tail(B, 0.55, 0.85, o.tw || 0.26); plate(B, 0.24, 0.44); bumper(B);
    return { B, C2 };
  };
  if (kind === 'sedan' || kind === 'taxi' || kind === 'police') {
    const { B, C2 } = car({ cf: 0.2, cr: 0.14, z0: 0.12, hf: 0.4, hr: 0.47, cw: 0.84, c0: 0.3, c1: 0.78, roof: 0.84, ci: 0.1, ws: 0.11, rw: 0.08 });
    if (kind === 'taxi') { S.push(solid({ p: oct(W * 0.36, at(0.48), at(0.58), 2, 2), z0: W * 0.84, zf: W * 0.98, zr: W * 0.98, ix: W * 0.02, c: '#fff4c2', tc: '#fffbe6' })); D.push(...sides(B, 0.28, 0.72, 0.4, 0.55, '#3b3d48')); }
    if (kind === 'police') {
      D.push(...sides(B, 0.05, 0.95, 0.15, 0.62, '#1d3f8f'), faceQuad(B, 4, 0.02, 0.98, 0.18, 0.5, '#1d3f8f'));
      const lb = solid({ p: oct(W * 0.7, at(0.5), at(0.57), 2, 2), z0: W * 0.84, zf: W * 0.93, zr: W * 0.93, c: '#30323c' }); S.push(lb);
      D.push({ ...topQuad(lb, -W * 0.33, -W * 0.02, at(0.505), at(0.565), '#ff3b3b', 0.4), blink: 0 }, { ...topQuad(lb, W * 0.02, W * 0.33, at(0.505), at(0.565), '#3b7bff', 0.4), blink: 1 });
      M.glow.push([-W * 0.18, at(0.535), W * 0.95, 0, '255,60,60'], [W * 0.18, at(0.535), W * 0.95, 1, '70,120,255']);
    }
  } else if (kind === 'compact' || kind === 'hatch') {
    const { B } = car({ cf: 0.22, cr: 0.16, z0: 0.12, hf: 0.42, hr: 0.46, cw: 0.84, c0: 0.28, c1: 0.95, roof: kind === 'compact' ? 0.9 : 0.86, ci: 0.1, ws: 0.12, rw: 0.04, tr: 0.01 });
  } else if (kind === 'suv') {
    const { C2 } = car({ cf: 0.16, cr: 0.1, z0: 0.16, hf: 0.56, hr: 0.6, cw: 0.9, c0: 0.27, c1: 0.96, roof: 1.08, ci: 0.07, ws: 0.1, rw: 0.03, tr: 0.01, wb: 1.12 });
    for (const sd of [-1, 1]) D.push(topQuad(C2, sd * W * 0.36 - 1, sd * W * 0.36 + 1, at(0.4), at(0.9), '#2b2d36', 0.9));
  } else if (kind === 'sports') {
    const { B } = car({ cf: 0.28, cr: 0.16, z0: 0.09, hf: 0.3, hr: 0.38, cw: 0.8, c0: 0.38, c1: 0.72, roof: 0.64, ci: 0.12, ws: 0.13, rw: 0.11, wb: 1.05, tw: 0.3 });
    spoiler(B, col);
  } else if (kind === 'player') {
    const { B, C2 } = car({ cf: 0.26, cr: 0.15, z0: 0.1, hf: 0.32, hr: 0.4, cw: 0.8, c0: 0.36, c1: 0.74, roof: 0.68, ci: 0.12, ws: 0.13, rw: 0.1, wb: 1.08, tw: 0.46 });
    for (const sd of [-1, 1]) { D.push(topQuad(B, sd * W * 0.05, sd * W * 0.14, at(0.01), at(0.36), '#f4f7ff'), topQuad(B, sd * W * 0.05, sd * W * 0.14, at(0.75), at(0.99), '#f4f7ff'), topQuad(C2, sd * W * 0.05, sd * W * 0.14, at(0.47), at(0.65), '#f4f7ff', 0.4)); }
    D.push(faceQuad(B, 4, 0.04, 0.96, 0.62, 0.78, '#ff3b4a'), faceQuad(B, 4, 0.08, 0.92, 0.66, 0.72, '#ffb3b8'));   // 가로로 이어진 LED 미등
    for (const u of [0.2, 0.3, 0.7, 0.8]) D.push(faceQuad(B, 4, u - 0.035, u + 0.035, 0.05, 0.16, '#c9ced8'));   // 배기구 4개
    D.push(...sides(B, 0.52, 0.66, 0.3, 0.55, '#14161d'));   // 옆 흡기구
    spoiler(B, '#1d2433');
    M.ex = [[-W * 0.25, y1 + 0.5, W * 0.11], [W * 0.25, y1 + 0.5, W * 0.11]];
  } else if (kind === 'pickup') {
    const B = solid({ p: oct(W, at(0), at(1), W * 0.16, W * 0.06), z0: W * 0.16, zf: W * 0.5, zr: W * 0.52, ix: W * 0.04, iyf: L * 0.04, iyr: L * 0.005, c: col });
    const C2 = solid({ p: oct(W * 0.9, at(0.25), at(0.55), W * 0.1, W * 0.04), z0: W * 0.48, zf: W * 1.0, zr: W * 1.0, ix: W * 0.06, iyf: L * 0.07, iyr: L * 0.01, c: col, sc: GLASS, rc: GLASS, tc: shade(col, 0.1) });
    wheel(0.15, true, 1.12); wheel(0.8, false, 1.12); S.push(B, C2); mirrors(0.26, W * 0.55);
    D.push(topQuad(B, -W * 0.4, W * 0.4, at(0.58), at(0.97), shade(col, -0.45), 0.3), topQuad(B, -W * 0.4, W * 0.4, at(0.58), at(0.62), shade(col, -0.25), 0.35));   // 짐칸
    D.push(...sides(C2, 0.45, 0.55, 0, 1, shade(col, -0.15)));
    glassHi(C2); tail(B, 0.5, 0.85, 0.12); plate(B, 0.22, 0.42); bumper(B, 0.2);
  } else if (kind === 'van') {
    const B = solid({ p: oct(W, at(0), at(1), W * 0.18, W * 0.06), z0: W * 0.14, zf: W * 0.48, zr: W * 0.5, ix: W * 0.03, iyf: L * 0.03, c: col });
    const C2 = solid({ p: oct(W * 0.96, at(0.1), at(0.995), W * 0.14, W * 0.06), z0: W * 0.46, zf: W * 1.2, zr: W * 1.2, ix: W * 0.06, iyf: L * 0.1, iyr: L * 0.005, c: col, tc: shade(col, 0.12) });
    wheel(0.15, true, 1.08); wheel(0.82, false, 1.08); S.push(B, C2); mirrors(0.12, W * 0.55);
    D.push(...sides(C2, 0.04, 0.3, 0.42, 0.85, GLASS), ...sides(C2, 0.36, 0.7, 0.42, 0.85, GLASS), faceQuad(C2, 4, 0.08, 0.47, 0.4, 0.86, GLASS), faceQuad(C2, 4, 0.53, 0.92, 0.4, 0.86, GLASS), faceQuad(C2, 4, 0.49, 0.51, 0, 1, 'rgba(0,0,0,.3)'));
    glassHi(C2); tail(B, 0.45, 0.95, 0.1); plate(B, 0.22, 0.42); bumper(B, 0.2);
  } else if (kind === 'ramp') {   // 사다리차(점프대): 노란 운전석 + 낮은 짐칸 + 뒤로 땅까지 내려온 사다리 경사판(노랑·검정 줄무늬 끝)
    const cab = solid({ p: oct(W * 0.96, at(0), at(0.22), W * 0.12, W * 0.02), z0: W * 0.16, zf: W * 1.24, zr: W * 1.28, ix: W * 0.06, iyf: L * 0.03, c: col });
    const bed = solid({ p: oct(W * 1.0, at(0.23), at(0.5), W * 0.02, W * 0.02), z0: W * 0.26, zf: W * 0.78, zr: W * 0.78, ix: W * 0.01, c: '#5d6573', tc: '#7d8696' });
    const rp = solid({ p: oct(W * 0.94, at(0.48), at(1), 0.5, 0.5), z0: W * 0.02, zf: W * 0.8, zr: W * 0.05, c: '#d99a00', tc: '#ffd23f' });   // 2026-11-01 하율 "점프대차 더 확실하게": 경사판을 노랗게
    wheel(0.12, true, 1.15); wheel(0.4, false, 1.15);
    S.push(cab, bed, rp); mirrors(0.02, W * 0.9);
    for (const sd of [-1, 1]) S.push(solid({ p: oct(W * 0.09, at(0.46), at(0.99), 0.3, 0.3).map(([x, y]) => [x + sd * W * 0.43, y]), z0: W * 0.04, zf: W * 0.96, zr: W * 0.12, c: '#f2b705', tc: '#ffd34d' }));   // 사다리 양옆 난간
    D.push(...sides(cab, 0.15, 0.7, 0.6, 0.88, GLASS));
    for (let i = 0; i < 11; i++) { const f = 0.52 + i * 0.043; D.push(topQuad(rp, -W * 0.38, W * 0.38, at(f), at(f) + 1.4, '#1c1d22', 0.35)); }   // 사다리 칸
    for (let i = 0; i < 4; i++) D.push(topQuad(rp, -W * 0.38 + i * W * 0.19, -W * 0.38 + i * W * 0.19 + W * 0.1, at(0.95), at(1) - 0.3, i % 2 ? '#1c1d22' : '#ffd34d', 0.4));   // 끝 줄무늬
    D.push(topQuad(rp, -W * 0.08, W * 0.08, at(0.64), at(0.84), 'rgba(255,255,255,.85)', 0.45));   // 가운데 화살표 띠
    M.glow.push([-W * 0.3, at(0.1), W * 1.36, 0, '255,160,20'], [W * 0.3, at(0.1), W * 1.36, 1, '255,160,20']);   // 운전석 위 경광등(번갈아 깜빡)
  } else if (kind === 'truck') {
    const box = ['#eef0f3', '#d5dbe3', '#2f6fcf', '#e8e2d4', '#c8322f'][Math.abs(Math.round(hh * 7 + col.charCodeAt(2))) % 5];
    const cab = solid({ p: oct(W * 0.96, at(0), at(0.24), W * 0.12, W * 0.02), z0: W * 0.16, zf: W * 1.3, zr: W * 1.34, ix: W * 0.06, iyf: L * 0.03, c: col });
    const ct = solid({ p: oct(W * 1.02, at(0.25), at(1), W * 0.02, W * 0.02), z0: W * 0.3, zf: W * 1.66, zr: W * 1.66, ix: W * 0.01, c: box, tc: shade(box, 0.1) });
    wheel(0.12, true, 1.18); wheel(0.7, false, 1.18); wheel(0.84, false, 1.18);
    S.push(cab, ct); mirrors(0.02, W * 0.95);
    D.push(...sides(cab, 0.15, 0.7, 0.62, 0.88, GLASS));
    for (let i = 1; i < 8; i++) D.push(topQuad(ct, -W * 0.5, W * 0.5, at(0.25 + i * 0.094) - 0.6, at(0.25 + i * 0.094) + 0.6, shade(box, -0.1), 0.3));
    D.push(faceQuad(ct, 4, 0.495, 0.505, 0.02, 0.98, 'rgba(0,0,0,.35)'), faceQuad(ct, 4, 0.3, 0.33, 0.1, 0.9, '#8a909c'), faceQuad(ct, 4, 0.67, 0.7, 0.1, 0.9, '#8a909c'), faceQuad(ct, 4, 0.03, 0.97, 0, 0.05, '#ffcf3a'));
    const bar = solid({ p: oct(W * 0.96, at(1) - 1.5, at(1) + 1, 0.5, 0.5), z0: W * 0.18, zf: W * 0.3, zr: W * 0.3, c: '#2a2c33' }); S.push(bar);
    D.push(faceQuad(bar, 4, 0.04, 0.2, 0.1, 0.9, '#e0262c'), faceQuad(bar, 4, 0.8, 0.96, 0.1, 0.9, '#e0262c'), faceQuad(bar, 4, 0.4, 0.6, 0.15, 0.85, '#eef0f3'));
  } else {   // bus
    const B = solid({ p: oct(W * 1.02, at(0), at(1), W * 0.14, W * 0.05), z0: W * 0.16, zf: W * 1.48, zr: W * 1.5, ix: W * 0.05, iyf: L * 0.012, iyr: L * 0.004, c: col, tc: '#f4f6f8' });
    wheel(0.15, true, 1.18); wheel(0.78, false, 1.18); S.push(B); mirrors(0.01, W * 1.05);
    S.push(solid({ p: oct(W * 0.6, at(0.4), at(0.58), 2, 2), z0: W * 1.48, zf: W * 1.62, zr: W * 1.62, ix: W * 0.04, c: '#d9dde4' }));
    D.push(...sides(B, 0.02, 0.97, 0.52, 0.86, GLASS), ...sides(B, 0.02, 0.97, 0.88, 0.92, '#f4f6f8'), ...sides(B, 0.02, 0.97, 0.1, 0.18, '#ffd34d'));
    for (let i = 1; i < 9; i++) D.push(...sides(B, i * 0.107 - 0.006, i * 0.107 + 0.006, 0.52, 0.86, shade(col, -0.2)));
    D.push(faceQuad(B, 4, 0.08, 0.92, 0.55, 0.88, GLASS), faceQuad(B, 4, 0.2, 0.8, 0.9, 0.97, '#1b1c22'), faceQuad(B, 4, 0.3, 0.7, 0.91, 0.96, '#ffb020'));
    glassHi(B); tail(B, 0.2, 0.42, 0.1); plate(B, 0.06, 0.16); bumper(B, 0.06);
  }
  return M;
  function spoiler(B, c) {
    const z = W * 0.5, yb = at(0.93);
    for (const sd of [-1, 1]) S.push(solid({ p: oct(W * 0.06, yb, yb + 2, 0.3, 0.3).map(([x, y]) => [x + sd * W * 0.32, y]), z0: W * 0.36, zf: z, zr: z, c: '#1b1d25' }));
    S.push(solid({ p: oct(W * 0.96, yb - 1.5, yb + 3.5, 1, 1), z0: z, zf: z + W * 0.05, zr: z + W * 0.07, c, tc: shade(c, 0.15) }));
  }
}

/* ===== 게임 ===== */
export function createChase(root, opts = {}) {
  root.innerHTML = `<div class="cs-scr" tabindex="-1"><canvas aria-label="카체이싱! 게임 화면"></canvas><div class="hr-ov cs-ov" hidden></div>
      <div class="cs-rot" aria-live="polite"><i aria-hidden="true"></i><b>화면을 가로로 돌려 주세요</b><span>카체이싱!은 가로 화면에서 해요</span></div></div>
    <div class="hr-bar cs-bar"><p class="hr-keys cs-keys"><span class="hk"><span data-ka="left"></span><span data-ka="right"></span> 차선 바꾸기</span><span class="hk-dot"> · </span><span class="hk"><span data-ka="jump"></span> 점프</span></p><button type="button" class="btn ghost hr-snd cs-snd" aria-pressed="false"></button></div>`;
  const scr = root.querySelector('.cs-scr'), cv = scr.querySelector('canvas'), ov = scr.querySelector('.cs-ov'), sndBtn = root.querySelector('.cs-snd');
  let g = cv.getContext('2d', { alpha: false });
  const sfx = makeSfx(); sfx.set(!!opts.sound);
  let best = opts.best || 0, dpr = 1, k = 1, alive = true, raf = 0;
  const art = new Map();   // 그림 캐시
  const st = { scene: 'ready', shownAt: 0 };
  let s = null, seed = null, saved = false, evs = [], lq = [], acc = 0, last = 0, countT = 0, crashT = 0, pauseFrom = '', tilt = 0;
  let msgNow = null;
  let yawP = 0, bI = 0, pScr = [CX, 440];
  const rings = [];
  let parts = [], pops = [], streaks = [], shake = 0, flash = 0, warnShown = -1, evRun = 0, tStart = 0;
  // 2026-10-31 하율 "타격감·와장창": 멈칫(hs)·느린 화면(slowT)·줌 펀치·날아가는 차(flies)·화면 금(crack)·붉은 번쩍(rflash)·저사양 감지(lowFx)
  let pAero = null, kickAt = 0, hs = 0, slowT = 0, punch = 0, punchAt = [CX, 440], flies = [], crack = null, rflash = 0, avgDt = 16, lowFx = false, wz = 0, wvz = 0, wroll = 0;

  /* --- 크기: 논리 960×540을 화면 픽셀에 맞춰 선명하게 --- */
  let resQ = 1, lagT = 0;
  const fit = () => {
    const w = cv.clientWidth; if (!w) return;
    // 2026-11-01 최적화(하율 "랙이 좀 걸린다"): 느려지는 건 거의 다 픽셀 칠하기 → 그림판 가로를 1440px(× resQ)까지만. 렉이 이어지면 resQ를 더 낮춤
    dpr = Math.min(2.5, window.devicePixelRatio || 1, 1440 * resQ / w); k = w / VW;
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
  // 3D 차 그리기 — 모델은 종류·크기·색마다 한 번 만들고, 매 프레임 꼭짓점만 원근 변환
  const models = new Map();
  const carModel = (kind, col, hw, hh) => {
    const c2 = typeof col === 'number' ? TRAFFIC[col % TRAFFIC.length] : col, key = kind + c2 + hw + ':' + hh;
    let M = models.get(key); if (!M) { M = buildCar(kind, c2, hw, hh); models.set(key, M); }
    return M;
  };
  const PX = new Float64Array(16), PYs = new Float64Array(16), QX = new Float64Array(16), QY = new Float64Array(16);
  let pcx = 0, pcy = 0, pco = 1, psi = 0, plift = 0;
  const proj = (x, y, z, ox, oy, i) => { const wx = pcx + x * pco - y * psi, wy = pcy + x * psi + y * pco, q = ps(wy); ox[i] = sxOf(wx, q); oy[i] = syOf(q) - (z + plift) * q * PK * ZK; };
  const polyArea = (X, Y, n) => { let s2 = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; s2 += X[i] * Y[j] - X[j] * Y[i]; } return s2; };
  const fillN = (X, Y, n, c, edge) => { g.beginPath(); g.moveTo(X[0], Y[0]); for (let i = 1; i < n; i++) g.lineTo(X[i], Y[i]); g.closePath(); g.fillStyle = c; g.fill(); if (edge) { g.strokeStyle = c; g.stroke(); } };
  function drawSolid(S, rot, rx, ry) {
    const n = S.n;
    for (let i = 0; i < n; i++) {
      let [x, y, z] = S.b[i]; if (rot) { const dx = x - rx, dy = y - ry; x = rx + dx * rot[0] - dy * rot[1]; y = ry + dx * rot[1] + dy * rot[0]; } proj(x, y, z, PX, PYs, i);
      [x, y, z] = S.t[i]; if (rot) { const dx = x - rx, dy = y - ry; x = rx + dx * rot[0] - dy * rot[1]; y = ry + dx * rot[1] + dy * rot[0]; } proj(x, y, z, QX, QY, i);
    }
    const FX = [0, 0, 0, 0], FY = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; FX[0] = PX[i]; FY[0] = PYs[i]; FX[1] = PX[j]; FY[1] = PYs[j]; FX[2] = QX[j]; FY[2] = QY[j]; FX[3] = QX[i]; FY[3] = QY[i];
      if (polyArea(FX, FY, 4) > 0.05) fillN(FX, FY, 4, S.fc[i], true);
    }
    if (polyArea(QX, QY, n) > 0) fillN(QX, QY, n, S.top, true);
  }
  // 차 하나: (cx, cy) 판 좌표 가운데 · yaw 앞이 오른쪽(+) · steer 앞바퀴 · lift 점프 높이 · detail false면 먼 차(간단히)
  function drawCar(M, cx, cy, yaw, steer = 0, lift = 0, detail = true, t = 0) {
    pcx = cx; pcy = cy; pco = Math.cos(yaw); psi = Math.sin(yaw); plift = 0;
    // 그림자(땅) — 점프하면 작고 옅게
    const sh = 1 - Math.min(lift / 60, 0.5), W2 = M.W / 2 * 1.08 * sh, ya = M.y0 * sh - 1, yb = M.y1 * sh + 4;
    g.lineJoin = 'round'; g.lineWidth = 0.7;
    for (const [e, al2] of [[1.22, 0.07], [1.1, 0.1], [0.98, 0.16]]) {   // 부드러운 그림자(세 겹)
      const so = oct(W2 * 2 * e, ya * e - 1, yb * e + 2, W2 * 0.5, W2 * 0.4);
      for (let i = 0; i < 8; i++) proj(so[i][0] + 2, so[i][1] + 2, 0, PX, PYs, i);
      fillN(PX, PYs, 8, `rgba(8,10,22,${(al2 * sh).toFixed(3)})`);
    }
    plift = lift;
    if (detail) { const sr = [Math.cos(steer), Math.sin(steer)]; for (const w of M.WH) drawSolid(w.s, w.front && steer ? sr : null, w.cx, w.cy); }
    for (const S of M.S) drawSolid(S);
    if (!detail) return;
    for (const d of M.D) {
      if (d.blink !== undefined && ((t >> 3) + d.blink) % 2) continue;
      for (let i = 0; i < 4; i++) proj(d.p[i][0], d.p[i][1], d.p[i][2], PX, PYs, i);
      if (polyArea(PX, PYs, 4) > 0) fillN(PX, PYs, 4, d.c);
    }
    if (M.glow.length) {   // 경광등 빛
      g.globalCompositeOperation = 'lighter';
      for (const [x, y, z, ph, rgb] of M.glow) { if (((t >> 3) + ph) % 2) continue; proj(x, y, z, PX, PYs, 0); const r = 20 * ps(cy) * PK; const gl = g.createRadialGradient(PX[0], PYs[0], 0, PX[0], PYs[0], r); gl.addColorStop(0, `rgba(${rgb},.9)`); gl.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gl; g.beginPath(); g.arc(PX[0], PYs[0], r, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    }
  }
  const projPt = (M, cx, cy, yaw, lift, x, y, z) => { pcx = cx; pcy = cy; pco = Math.cos(yaw); psi = Math.sin(yaw); plift = lift; proj(x, y, z, PX, PYs, 0); return [PX[0], PYs[0]]; };
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
      <p class="cs-stat"><span><b>${fmt(res.m)}</b>m</span><span>최고 <b>${res.top}</b>km/h</span><span>아슬아슬 <b>${res.near}</b>번</span>${res.slipPts ? `<span>슬립 점수 <b>${fmt(res.slipPts)}</b></span>` : ''}${res.ramps ? `<span>점프대 <b>${res.ramps}</b>번</span>` : ''}<span>최대 콤보 <b>x${res.maxCombo}</b></span><span>부스터 <b>${res.boosts}</b>번</span>${res.smash ? `<span>날려 버린 차 <b>${res.smash}</b>대</span>` : ''}</p>
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
  function resetFx() { nbShown = false; lastSP = 0; topK = 0; parts = []; pops = []; streaks = []; shake = 0; flash = 0; warnShown = -1; hs = 0; slowT = 0; punch = 0; flies = []; crack = null; rflash = 0; wz = 0; wvz = 0; wroll = 0; }
  function again() {
    if (st.scene !== 'over' || performance.now() - st.shownAt < 500) return;
    st.scene = 'ready'; s = null; resetFx(); opts.onReady?.(); start();
  }
  function pause() { if (st.scene !== 'play' && st.scene !== 'count') return; pauseFrom = st.scene; st.scene = 'pause'; sfx.engine(0); showPause(); }
  function resume() { if (st.scene !== 'pause' || portMQ.matches) return; ov.hidden = true; lq.length = 0; st.scene = pauseFrom === 'count' ? 'count' : 'resume'; countT = 0; last = performance.now(); }

  /* --- 효과 --- */
  // 입자 종류 k: 없음 = 네모 · sp = 불꽃 줄(빛남) · sh = 유리 조각(돌며 반짝) · db = 금속·나무 파편 · sm = 연기 · fi = 불덩이(빛남) · st = 반짝 별
  //   fl = 바닥 높이(화면 y, 닿으면 튀어 오름) · gv = 중력 · dr = 공기 저항(1초당 남는 비율)
  const addP = o => { if (lowFx && parts.length > 260) return; parts.push(o); };
  const burst = (x, y, n, cols, sp = 160, life = 0.6, sz = 4, k) => { if (RM()) n = Math.ceil(n / 3); if (lowFx) n = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.4 + Math.random() * 0.8); addP({ k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: life * (0.7 + Math.random() * 0.5), max: life, c: cols[i % cols.length], sz: sz * (0.6 + Math.random() * 0.8), r: Math.random() * 6, vr: (Math.random() - 0.5) * 18 }); } };
  const pop = (x, y, t, c = '#fff', big = 0, rot = 0) => pops.push({ x, y, t, c, big, rot, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8 });
  const bW = (x, y, lift, n, cols, sp, life, sz, k) => { const q = ps(y); burst(sxOf(x, q), syOf(q) - lift * q * PK, n, cols, sp * q * PK * 0.6, life, (sz || 4) * q * PK * 0.6, k); };
  const pW = (x, y, lift, t, c, big, rot) => { const q = ps(y); pop(sxOf(x, q), syOf(q) - lift * q * PK, t, c, big, rot); };
  const scrOf = (x, y, lift = 0) => { const q = ps(y); return [sxOf(x, q), syOf(q) - lift * q * PK, q * PK]; };
  // 큰 충격: 불꽃 줄 + 유리 조각 + 파편 + 연기 + 불덩이
  function blast(x, y, q, o = {}) {
    const n = RM() ? 0.35 : lowFx ? 0.5 : 1, fl = y + 26 * q, cols = o.cols || ['#2f7df6', '#c8322f'];
    for (let i = 0; i < 60 * n * (o.k || 1); i++) { const a = -Math.PI * Math.random(), v = (300 + Math.random() * 700) * q; addP({ k: 'sp', x, y, vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v, gv: 900, dr: 0.25, life: 0.5 + Math.random() * 0.5, max: 1, c: Math.random() < 0.6 ? '#ffe28a' : '#fff6d8', sz: 1.6 + Math.random() * 2 }); }
    for (let i = 0; i < 46 * n * (o.k || 1); i++) { const a = -Math.PI * (0.05 + Math.random() * 0.9), v = (180 + Math.random() * 520) * q; addP({ k: 'sh', x: x + (Math.random() - 0.5) * 30 * q, y: y - 10 * q, vx: Math.cos(a) * v * 1.3, vy: Math.sin(a) * v - 120 * q, gv: 1100, dr: 0.5, fl, life: 1.1 + Math.random() * 0.8, max: 1.9, c: Math.random() < 0.5 ? 'rgba(190,230,255,.9)' : 'rgba(235,250,255,.95)', sz: (3 + Math.random() * 7) * q, r: Math.random() * 6, vr: (Math.random() - 0.5) * 22 }); }
    for (let i = 0; i < 22 * n * (o.k || 1); i++) { const a = -Math.PI * (0.1 + Math.random() * 0.8), v = (160 + Math.random() * 460) * q; addP({ k: 'db', x, y, vx: Math.cos(a) * v * 1.3, vy: Math.sin(a) * v - 160 * q, gv: 1200, dr: 0.6, fl, life: 1.4 + Math.random() * 0.6, max: 2, c: Math.random() < 0.3 ? '#3a3d48' : Math.random() < 0.5 ? '#b9c0cc' : cols[i % cols.length], sz: (5 + Math.random() * 9) * q, r: Math.random() * 6, vr: (Math.random() - 0.5) * 16 }); }
    if (o.fire !== false) {
      for (let i = 0; i < 16 * n; i++) { const a = Math.random() * 6.283, v = (40 + Math.random() * 160) * q; addP({ k: 'fi', x: x + Math.cos(a) * 10 * q, y: y - 10 * q, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 70 * q, gv: -60, dr: 0.2, life: 0.45 + Math.random() * 0.4, max: 0.85, c: '', sz: (18 + Math.random() * 26) * q, gr: 40 * q }); }
      for (let i = 0; i < 14 * n; i++) addP({ k: 'sm', x: x + (Math.random() - 0.5) * 50 * q, y: y - 20 * q, vx: (Math.random() - 0.5) * 60 * q, vy: -(30 + Math.random() * 70) * q, gv: -20, dr: 0.4, life: 1.4 + Math.random() * 1.2, max: 2.6, c: '', sz: (16 + Math.random() * 20) * q, gr: 46 * q });
    }
  }
  // 차 날리기(부스터 박치기·충돌 상대): 화면 대신 판 좌표에서 포물선 + 세 축 회전 + 튕김
  function launch(c, power, side) {
    const M = carModel(c.k, c.col, c.hw, c.hh);
    c._fly = 1;
    flies.push({ M, x: c.x, y: c.y, z: 4, vx: side * (240 + Math.random() * 260) * power, w: (s.v * (1.05 + 0.25 * power) + 260 * power) * (st.scene === 'play' ? 1 : 0.4), vz: 560 * power + Math.random() * 160, yaw: 0, yv: side * (4 + Math.random() * 5) * power, roll: 0, rv: side * (5 + Math.random() * 7) * power, bounce: 0, t: 0, px: null, py: null, cols: [M.col || '#c8322f'] });
  }
  function handle(e) {
    const py = C.PY + C.P_HH;
    switch (e.t) {
      case 'near': {
        bW(e.x, e.y + 30, 14, 18, ['#fff', '#ffd25e', '#7fd4ff'], 260, 0.45, 3, 'sp');
        pW(s.p.x, py, 64, (e.close ? '아슬아슬!!' : '아슬아슬!') + (e.combo > 1 ? ` x${e.combo}` : ''), e.close ? '#ff9a3d' : '#ffd25e', 1, (Math.random() - 0.5) * 0.2); pW(s.p.x, py, 40, '+' + e.pts, '#fff');
        sfx.near(e.combo, e.close); for (let i = 0; i < (e.close ? 12 : 7); i++) streaks.push({ x: e.x + (Math.random() - 0.5) * 34, y: e.y + 20 + Math.random() * 60, life: 0.4 });
        punch = Math.max(punch, e.close ? 0.045 : 0.025); punchAt = pScr.slice();
        if (e.close) { flash = Math.max(flash, 0.12); hs = Math.max(hs, 0.035); }
        if (e.combo >= 5 && e.combo % 5 === 0) { pop(VW / 2, 190, `콤보 x${e.combo}!!`, '#ff7ad9', 2); rings.push({ t: 0, c: '255,140,230' }); sfx.combo(e.combo); shake = Math.max(shake, 0.25); }
        break;
      }
      case 'coin': bW(e.x, py, 16, 9, ['#ffd25e', '#fff', '#ffe9a8'], 140, 0.45, 5, 'st'); pW(e.x, py, 44, '+10', '#ffd25e'); sfx.coin(); break;
      case 'fuel': bW(e.x, py, 14, 16, ['#ff5a5a', '#fff', '#ffd25e'], 170, 0.6, 5, 'st'); pW(e.x, py, 52, '연료 +' + C.CAN, '#ff8a8a', 1); sfx.fuel(); punch = Math.max(punch, 0.02); break;
      case 'box': bW(e.x, py, 16, 26, ['#ff8fd0', '#a98bff', '#5ec8ff', '#fff'], 260, 0.7, 6, 'st'); sfx.box(); punch = Math.max(punch, 0.03); break;
      case 'boost': flash = 0.6; shake = Math.max(shake, 0.6); hs = Math.max(hs, 0.08); punch = Math.max(punch, 0.08); punchAt = pScr.slice(); rings.push({ t: 0 }, { t: -0.12 }, { t: -0.24 }); pop(VW / 2, 200, '부스터!', '#7fd4ff', 2); sfx.boost(); break;
      case 'boostEnd': sfx.boostEnd(); break;
      case 'ramp': {
        const [sx, sy, q] = scrOf(e.x, e.y, 6);
        burst(sx, sy, 26, ['#ffd34d', '#fff6d8', '#ff9a3d'], 420 * q, 0.5, 2.6, 'sp'); burst(sx, sy, 12, ['#cfd4df', '#fff'], 200 * q, 0.6, 6 * q);
        pW(s.p.x, C.PY + C.P_HH, 80, '점프대!! +' + C.RAMP_PTS, '#ffd34d', 2, -0.08);
        if (s.ramps === 1) pop(VW / 2, 250, '공중에서 ←→로 착지 자리 고르기!', '#fff');
        flash = Math.max(flash, 0.3); shake = Math.max(shake, 0.35); punch = Math.max(punch, 0.06); punchAt = pScr.slice(); hs = Math.max(hs, 0.05);
        rings.push({ t: 0, c: '255,210,90' }); sfx.ramp(); break;
      }
      case 'slip': sfx.slip(); pW(s.p.x, C.PY + C.P_HH, 70, '슬립스트림!', '#7ff0ff'); punch = Math.max(punch, 0.02); break;
      case 'smash': {
        const c = e.id && s.cars.find(x => x.id === e.id), [sx, sy, q] = scrOf(e.x, e.y + 20, 14);
        if (c) { launch(c, 1, c.x < s.p.x ? -1 : c.x > s.p.x ? 1 : (Math.random() < 0.5 ? -1 : 1)); blast(sx, sy, q, { k: 0.45, fire: false, cols: [carModel(c.k, c.col, c.hw, c.hh).col || '#c8322f'] }); }
        else blast(sx, sy, q, { k: 0.5, fire: false, cols: ['#ff8a3d', '#fff', '#ffd25e'] });   // 바리케이드·고깔: 나무·플라스틱 조각
        shake = Math.max(shake, 0.45); hs = Math.max(hs, 0.07); punch = Math.max(punch, 0.05); punchAt = [sx, sy]; flash = Math.max(flash, 0.25);
        rings.push({ t: 0, x: sx, y: sy, c: '255,220,140' });
        pW(e.x, e.y + 20, 60, e.wall ? '와지끈! +20' : '쾅! +50', '#fff', 1, (Math.random() - 0.5) * 0.4); sfx.smash(e.wall); break;
      }
      case 'jump': sfx.jump(); bW(s.p.x, py, 2, 10, ['#cfd4df', '#fff'], 120, 0.35, 4); break;
      case 'land': if (s.p.am > C.JUMP_F) { const [sx, sy, q] = scrOf(s.p.x, py, 2); burst(sx, sy, 30, ['#ffe28a', '#fff6d8'], 520 * q, 0.45, 2.6, 'sp'); burst(sx, sy, 22, ['#cfd4df', '#fff', '#9aa3b5'], 260 * q, 0.6, 7 * q); rings.push({ t: 0, x: sx, y: sy, c: '255,255,255' }); sfx.thud(1); sfx.land(); shake = Math.max(shake, 0.5); punch = Math.max(punch, 0.05); punchAt = [sx, sy]; } else { bW(s.p.x, py, 2, 14, ['#cfd4df', '#fff'], 140, 0.4, 4); sfx.land(); shake = Math.max(shake, 0.12); punch = Math.max(punch, 0.015); } break;
      case 'crash': {
        const [sx, sy, q] = scrOf(e.x, e.y + 10, 16);
        const hit = s.cars.filter(c => !c.dead && !c._fly && Math.abs(c.x - s.p.x) < c.hw + C.P_HW + 6 && Math.abs(c.y - C.PY) < c.hh + C.P_HH + 10)[0];
        if (hit) launch(hit, 0.75, hit.x < s.p.x ? -1 : hit.x > s.p.x ? 1 : (Math.random() < 0.5 ? -1 : 1));
        blast(sx, sy, q, { k: 1.4, cols: ['#2f7df6', '#5b9bff', hit ? (carModel(hit.k, hit.col, hit.hw, hit.hh).col || '#c8322f') : '#ff8a3d'] });
        shake = 1.3; flash = 0.9; rflash = 1; hs = 0.13; slowT = 1; punch = 0.12; punchAt = [sx, sy];
        wz = 0; wvz = 520; wroll = 0;
        rings.push({ t: 0, x: sx, y: sy, c: '255,255,255' }, { t: -0.08, x: sx, y: sy, c: '255,180,90' }, { t: -0.18, x: sx, y: sy, c: '255,90,70' });
        crack = makeCrack(sx, sy - 30);
        pop(VW / 2, 200, e.why === 'wall' ? '와장창!!' : '와장창!!', '#ff5a3d', 3, -0.12);
        sfx.crash(); sfx.engine(0); break;
      }
      case 'empty': pop(VW / 2, 230, '기름이 떨어졌어요!', '#ff8a8a', 1); sfx.empty(); break;
      case 'stop': sfx.stop(); break;
    }
  }
  // 화면 금(유리 깨짐): 맞은 곳에서 갈라져 나가는 줄 + 가지 + 동심 조각
  function makeCrack(x, y) {
    const L = [], R2 = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      let a = (i / n) * 6.283 + Math.random() * 0.4, px = x, py = y; const pts = [[px, py]], len = 160 + Math.random() * 360;
      for (let d = 0; d < len;) { const st2 = 18 + Math.random() * 34; d += st2; a += (Math.random() - 0.5) * 0.5; px += Math.cos(a) * st2; py += Math.sin(a) * st2 * 0.85; pts.push([px, py]);
        if (Math.random() < 0.18) { let b = a + (Math.random() < 0.5 ? 0.7 : -0.7), bx = px, by = py; const bp = [[bx, by]]; for (let j = 0; j < 3; j++) { const s3 = 14 + Math.random() * 22; b += (Math.random() - 0.5) * 0.5; bx += Math.cos(b) * s3; by += Math.sin(b) * s3 * 0.85; bp.push([bx, by]); } L.push({ pts: bp, d0: d }); } }
      L.push({ pts, d0: 0 });
    }
    for (const r of [26, 58, 104]) { let a0 = Math.random() * 6.283; for (let i = 0; i < 7; i++) { const a1 = a0 + 0.5 + Math.random() * 0.4; if (Math.random() < 0.75) R2.push([r * (0.9 + Math.random() * 0.2), a0, a1]); a0 = a1 + 0.2 + Math.random() * 0.3; } }
    return { x, y, L, R: R2, t: 0 };
  }

  /* --- 루프 --- */
  const STEP = 1000 / C.FPS;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, now - (last || now)); last = now;
    avgDt = avgDt * 0.97 + dt * 0.03; lowFx = avgDt > 22;   // 저사양(약 45fps 밑)이면 입자·빛 효과 줄임
    if (st.scene === 'play' && avgDt > 21 && resQ > 0.56) { lagT += dt; if (lagT > 1500) { lagT = 0; resQ *= 0.8; fit(); avgDt = 16; } } else lagT = 0;   // 계속 느리면 해상도 한 단계 낮춤
    if (st.scene === 'count' || st.scene === 'resume') {
      countT += dt;
      const total = st.scene === 'resume' ? 1000 : 3000, prevN = Math.ceil((total - (countT - dt)) / 1000), n = Math.ceil((total - countT) / 1000);
      if (n !== prevN && n > 0) sfx.beep(false);
      if (countT >= total) {
        if (st.scene === 'resume') { st.scene = 'play'; acc = 0; }
        else if (seed != null || countT >= total + 4000 || !opts.seed) { sfx.beep(true); begin(); }
      }
    }
    if (st.scene === 'play' && hs > 0) hs -= dt / 1000;   // 멈칫(히트 스톱): 판은 그대로 멈춤(입력은 쌓였다 다음 프레임에 그 프레임 번호로 기록)
    else if (st.scene === 'play') {
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
      sfx.engine(s.over ? 0 : s.v, s.boost > 0 ? 1 : 0);
      if (s.over) { st.scene = 'crash'; crashT = 0; finish(); }
    } else if (st.scene === 'crash') {
      if (hs > 0) hs -= dt / 1000; else crashT += dt;
      if (crashT > 1500 && ov.hidden) showOver(lastRes);
    }
    const ds0 = dt / 1000;
    slowT = Math.max(0, slowT - ds0 * 0.9);
    const ds = ds0 * (hs > 0 ? 0.06 : slowT > 0 ? 0.22 + 0.78 * (1 - slowT) * (1 - slowT) : 1);   // 효과 시간(멈칫·느린 화면)
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx * ds; p.y += p.vy * ds; p.vy += (p.gv ?? 220) * ds;
      const dk = Math.pow(p.dr ?? 0.05, ds); p.vx *= dk; if (p.dr != null) p.vy *= p.gv < 0 ? dk : 1;
      if (p.fl && p.y > p.fl && p.vy > 0) { p.y = p.fl; p.vy *= -0.32; p.vx *= 0.6; p.vr = (p.vr || 0) * 0.5; }
      if (p.vr) p.r += p.vr * ds; if (p.gr) p.sz += p.gr * ds;
      p.life -= ds; if (p.life <= 0) parts.splice(i, 1);
    }
    // 날아가는 차
    const sv = s && st.scene === 'play' ? s.v : 0;
    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i]; f.t += ds;
      f.x += f.vx * ds; f.y += (sv - f.w) * ds; f.z += f.vz * ds; f.vz -= 2100 * ds; f.yaw += f.yv * ds; f.roll += f.rv * ds;
      if (f.z <= 0 && f.vz < 0) {
        f.z = 0;
        if (f.vz < -220 && f.bounce < 3) {
          f.bounce++; f.vz = -f.vz * 0.38; f.w *= 0.62; f.vx *= 0.55; f.yv *= 0.6; f.rv *= 0.5;
          const [bx, by, q] = scrOf(f.x, f.y); if (by > HZ && by < VH + 80) { burst(bx, by, lowFx ? 6 : 14, ['#ffe28a', '#fff6d8'], 380 * q, 0.4, 2.4, 'sp'); burst(bx, by, 6, ['#9aa3b5', '#5b5f6b', f.cols[0]], 240 * q, 0.9, 7 * q, 'db'); if (f.bounce === 1) sfx.thud(Math.min(1, q)); shake = Math.max(shake, 0.18 * q); }
        } else { f.vz = 0; f.w *= Math.pow(0.15, ds); f.vx *= Math.pow(0.1, ds); f.yv *= Math.pow(0.1, ds); const rt = Math.round(f.roll / Math.PI) * Math.PI; f.roll += (rt - f.roll) * Math.min(1, ds * 10); f.rv = 0; }
      }
      if (f.t > 3 || f.y > C.PY + 420 || f.y < C.FAR - 600 || Math.abs(f.x - RX) > 1400) flies.splice(i, 1);
    }
    // 내 차 부서질 때 튀어 오름
    if (st.scene === 'crash' || st.scene === 'over') { wz += wvz * ds; wvz -= 1900 * ds; wroll += (wz > 0 ? 3.2 : 0) * ds * (s?.p.x < RX ? -1 : 1); if (wz < 0) { wz = 0; wvz = wvz < -200 ? -wvz * 0.35 : 0; } }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.y -= 34 * ds; p.life -= ds; if (p.life <= 0) pops.splice(i, 1); }
    for (let i = streaks.length - 1; i >= 0; i--) { streaks[i].life -= ds; if (streaks[i].life <= 0) streaks.splice(i, 1); }
    if (parts.length > (lowFx ? 300 : 700)) parts.splice(0, parts.length - (lowFx ? 300 : 700));
    shake = Math.max(0, shake - ds0 * 1.2); flash = Math.max(0, flash - ds0 * 1.6); rflash = Math.max(0, rflash - ds0 * 0.8); punch = Math.max(0, punch - ds0 * 0.35);
    if (crack) crack.t += ds0;
    draw(ds);
  }
  let lastRes = null;
  function finish() {
    const r = { score: C.scoreOf(s), m: C.metersOf(s), f: s.overF, why: s.over, near: s.near, ramps: s.ramps, slipPts: s.slipPts, maxCombo: s.maxCombo, boosts: s.boosts, smash: s.smash, coins: s.coins, cans: s.cans, top: Math.round(topK), rounds: [s.overF, ...evs], saved, realMs: performance.now() - tStart };
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
    // 부스터 중 계속 흔들림(2026-11-01 하율 "진짜 부스터처럼 화면도 계속 흔들리고 난리 부르스"): 잔떨림 + 느린 출렁임 + 기울기 + 0.18초마다 쿵 펀치
    const tn = performance.now();
    if (!RM() && bI > 0.05) {
      jx += ((Math.random() - 0.5) * 9 + Math.sin(tn / 45) * 4) * bI; jy += ((Math.random() - 0.5) * 7 + Math.sin(tn / 61) * 2.5) * bI;   // 11/1 14:28 "약간만 줄여" (예전 14·6 / 11·4)
      if (tn - kickAt > 180 && st.scene === 'play') { kickAt = tn; punch = Math.max(punch, 0.015 + Math.random() * 0.012); punchAt = pScr.slice(); }
    }
    if (jx || jy) g.translate(jx, jy);
    // 부스터: 화면이 내 차 쪽으로 살짝 당겨짐(시야 펀치)
    bI = lerp(bI, s && s.boost > 0 && st.scene === 'play' ? 1 : 0, 0.1);
    const zm = RM() ? 0 : bI * 0.07;
    if (zm > 0.001) { g.translate(CX, 470); g.scale(1 + zm, 1 + zm); g.rotate((Math.sin(tn / 37) * 0.008 + (Math.random() - 0.5) * 0.005) * bI); g.translate(-CX, -470); }
    if (punch > 0.001 && !RM()) { const z2 = punch * (1 + Math.sin(performance.now() / 18) * 0.15); g.translate(punchAt[0], punchAt[1]); g.scale(1 + z2, 1 + z2); g.translate(-punchAt[0], -punchAt[1]); }
    drawGround(dist); drawRoadside(dist);
    if (s) drawWorld(a, px); else drawIdle();
    // 바람 가르기(2026-11-01 하율 "차 앞에 바람을 엄청 빠르게 갈라서 생기는 그거" → 14:33 "훨씬 자연스럽게, 실제같이, 하지만 과장되게"):
    //   차 코 앞에 둥글게 휜 충격파 막(3겹, 가운데 진하고 끝으로 흐려짐) + 코 앞 흰 안개 + 차 몸을 따라 휘어 돌아 뒤로 빠지는 공기 흐름 줄(움직이는 결) + 가끔 떨어져 나가는 수증기
    const vk = s && st.scene === 'play' && !RM() ? Math.max(clamp((v - 1100) / 1100, 0, 1), bI, s.slip * 0.6) : 0;
    if (vk > 0.03 && pAero) aero(vk);
    if (s && bI > 0.2 && !RM() && st.scene === 'play') {   // 부스터 전기 불꽃: 내 차 둘레로 번쩍이는 번개 줄(매 프레임 새로)
      g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
      for (let i = 0, n = lowFx ? 1 : 3; i < n; i++) {
        let a0 = Math.random() * 6.283, x = pScr[0] + Math.cos(a0) * 30, y = pScr[1] - 10 + Math.sin(a0) * 18; g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 5; j++) { a0 += (Math.random() - 0.5) * 1.6; x += Math.cos(a0) * (10 + Math.random() * 14); y += Math.sin(a0) * (8 + Math.random() * 10); g.lineTo(x, y); }
        g.strokeStyle = `hsla(${(s.f * 9 + i * 120) % 360},100%,72%,${(0.85 * bI).toFixed(2)})`; g.lineWidth = 3.2; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2; g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }
    // 바람(속도선): 빠를수록 많이 — 길가 양쪽 아래
    if (s && st.scene === 'play' && !RM() && v > 600) {
      const n = Math.min(16, (v - 600) / 50) | 0; g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.8;
      for (let i = 0; i < n; i++) { const t = ((s.f * v / 16000 + i * 0.37) % 1), sd = i % 2 ? 1 : -1, x0 = CX + sd * (VW * (0.36 + t * 0.2)), y0 = HZ + 140 + t * 330, len = 30 + t * 70; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + sd * len * 0.45, y0 + len); g.stroke(); }
    }
    if (s && s.slip > 0.05 && !RM() && st.scene === 'play') {   // 슬립스트림: 앞차가 가른 바람이 내 차 양옆으로 흘러감
      const [cx0, cy0] = pScr, k3 = s.slip, n = lowFx ? 6 : 12; g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (let i = 0; i < n; i++) { const t = (s.f * 0.06 + i * 0.37) % 1, sd = i % 2 ? 1 : -1, w0 = 34 + (i % 3) * 16, x0 = cx0 + sd * (w0 + t * 30), y0 = cy0 - 150 + t * 230, len = 40 + t * 60;
        g.strokeStyle = `rgba(150,240,255,${(0.55 * k3 * (1 - Math.abs(t - 0.5) * 1.6)).toFixed(3)})`; g.lineWidth = 2 + t * 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + sd * len * 0.12, y0 + len); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
    }
    if (bI > 0.02 && !RM() && s) {   // 부스터 속도선: 소실점에서 화면 밖으로 터져 나감
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (let i = 0, n = lowFx ? 16 : 30; i < n; i++) {
        const an = (i * 2.399) % 6.283, sp = 0.6 + ((i * 37) % 10) / 12, t = (s.f * 0.035 * sp + i * 0.137) % 1, r1 = 40 + t * t * 780, r2 = r1 + 30 + t * 260, ca = Math.cos(an), sa = Math.sin(an) * 0.62;
        g.strokeStyle = i % 3 ? `rgba(255,255,255,${(0.55 * t * bI).toFixed(3)})` : `hsla(${(s.f * 6 + i * 40) % 360},100%,70%,${(0.6 * t * bI).toFixed(3)})`; g.lineWidth = 1 + t * 3.5;
        g.beginPath(); g.moveTo(CX + ca * r1, HZ + 90 + sa * r1); g.lineTo(CX + ca * r2, HZ + 90 + sa * r2); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }
    for (let i = rings.length - 1; i >= 0; i--) {   // 발동 순간 충격파 고리
      const R = rings[i]; R.t += ds || 0.016; if (R.t > 0.6) { rings.splice(i, 1); continue; } if (R.t < 0) continue;
      const k2 = R.t / 0.6, r = 30 + k2 * 420; g.strokeStyle = `rgba(${R.c || '170,220,255'},${(0.8 * (1 - k2)).toFixed(3)})`; g.lineWidth = 10 * (1 - k2) + 1; g.beginPath(); g.ellipse(R.x ?? pScr[0], R.y ?? pScr[1], r, r * 0.5, 0, 0, 7); g.stroke();
    }
    drawParts();
    for (const p of pops) {
      const t = 1 - p.life / p.max, al = t > 0.7 ? (1 - t) / 0.3 : 1, base = [19, 30, 46, 78][p.big || 0];
      const sc2 = t < 0.08 ? 0.4 + t / 0.08 * 1.0 : t < 0.18 ? 1.4 - (t - 0.08) / 0.1 * 0.4 : 1;   // 튀어나왔다 자리 잡기(오버슈트)
      g.save(); g.globalAlpha = al; g.translate(p.x + (p.big >= 3 && t < 0.3 ? (Math.random() - 0.5) * 10 : 0), p.y); if (p.rot) g.rotate(p.rot); g.scale(sc2, sc2);
      g.font = `${base}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      if (p.big >= 2) { g.lineWidth = base * 0.32; g.strokeStyle = '#fff'; g.strokeText(p.t, 0, 0); g.lineWidth = base * 0.18; g.strokeStyle = 'rgba(20,18,40,.95)'; g.strokeText(p.t, 0, 0); const gr = g.createLinearGradient(0, -base / 2, 0, base / 2); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.5, p.c); gr.addColorStop(1, shade(p.c.length === 7 ? p.c : '#ff5a3d', -0.25)); g.fillStyle = gr; }
      else { g.lineWidth = p.big ? 6 : 4; g.strokeStyle = 'rgba(20,18,40,.9)'; g.strokeText(p.t, 0, 0); g.fillStyle = p.c; }
      g.fillText(p.t, 0, 0); g.restore();
    }
    g.globalAlpha = 1;
    g.restore();
    if (!lowFx) g.drawImage(vignette().c, 0, 0, VW, VH);
    if (bI > 0.02 && !lowFx) { const hu = s ? (s.f * 5) % 360 : 200, pu = 0.22 + 0.1 * Math.sin((s?.f || 0) * 0.3), bg = g.createRadialGradient(CX, VH * 0.55, VH * 0.28, CX, VH * 0.55, VW * 0.68); bg.addColorStop(0, `hsla(${hu},100%,65%,0)`); bg.addColorStop(0.7, `hsla(${hu},100%,62%,${(pu * 0.5 * bI).toFixed(3)})`); bg.addColorStop(1, `hsla(${(hu + 60) % 360},100%,60%,${(pu * bI * 1.4).toFixed(3)})`); g.fillStyle = bg; g.fillRect(0, 0, VW, VH); }
    if (crack) drawCrack();
    if (rflash > 0) { const rg = g.createRadialGradient(CX, VH / 2, VH * 0.2, CX, VH / 2, VW * 0.7); rg.addColorStop(0, 'rgba(255,40,30,0)'); rg.addColorStop(1, `rgba(255,40,30,${(rflash * 0.55).toFixed(3)})`); g.fillStyle = rg; g.fillRect(0, 0, VW, VH); }
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.9, flash * 1.4).toFixed(3)})`; g.fillRect(0, 0, VW, VH); }
    if (s) drawHud();
    if (st.scene === 'count' || st.scene === 'resume') drawCount();
    if (touchSeen && (st.scene === 'play' || st.scene === 'count' || st.scene === 'resume')) drawPads();
  }
  // 둥근 빛·연기·불 그림을 한 번만 만들어 두고 찍음(매 프레임 그라데이션 만들기 → drawImage, 최적화)
  const blobs = new Map();
  const blob = (key, stops) => { let c = blobs.get(key); if (!c) { c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, col]) => gr.addColorStop(o, col)); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); blobs.set(key, c); } return c; };
  const FIRE = [[0, 'rgba(255,250,210,.95)'], [0.35, 'rgba(255,170,50,.8)'], [0.7, 'rgba(230,60,20,.35)'], [1, 'rgba(120,20,10,0)']];
  const SMOKE = [[0, 'rgba(70,72,86,.55)'], [1, 'rgba(70,72,86,0)']];
  const TAIL = [[0, 'rgba(255,235,225,1)'], [0.25, 'rgba(255,50,40,.85)'], [1, 'rgba(255,30,20,0)']];
  const stamp = (c, x, y, r) => g.drawImage(c, x - r, y - r, r * 2, r * 2);
  function drawParts() {
    let lit = false;
    for (let pass = 0; pass < 2; pass++) {
      if (pass) { g.globalCompositeOperation = 'lighter'; lit = true; }
      for (const p of parts) {
        const glow = p.k === 'sp' || p.k === 'fi' || p.k === 'st' || p.k === 'vp'; if (glow !== !!pass) continue;
        const a = clamp(p.life / p.max, 0, 1); g.globalAlpha = p.k === 'sh' || p.k === 'db' ? Math.min(1, a * 3) : a;
        if (p.k === 'sp') { g.strokeStyle = p.c; g.lineWidth = p.sz; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); g.stroke(); }
        else if (p.k === 'fi') stamp(blob('fi', FIRE), p.x, p.y, Math.max(1, p.sz));
        else if (p.k === 'st') { const r = p.sz * (0.6 + 0.4 * Math.sin(p.r * 2)); g.fillStyle = p.c; g.beginPath(); g.moveTo(p.x, p.y - r * 1.6); g.lineTo(p.x + r * 0.4, p.y - r * 0.4); g.lineTo(p.x + r * 1.6, p.y); g.lineTo(p.x + r * 0.4, p.y + r * 0.4); g.lineTo(p.x, p.y + r * 1.6); g.lineTo(p.x - r * 0.4, p.y + r * 0.4); g.lineTo(p.x - r * 1.6, p.y); g.lineTo(p.x - r * 0.4, p.y - r * 0.4); g.closePath(); g.fill(); }
        else if (p.k === 'vp') stamp(blob('vp', [[0, 'rgba(240,250,255,.7)'], [0.6, 'rgba(220,240,255,.18)'], [1, 'rgba(220,240,255,0)']]), p.x, p.y, Math.max(1, p.sz));
        else if (p.k === 'sm') stamp(blob('sm', SMOKE), p.x, p.y, Math.max(1, p.sz));
        else if (p.k === 'sh') { const r = p.sz, c2 = Math.cos(p.r), s2 = Math.sin(p.r), tw = Math.abs(Math.sin(p.r * 1.7));   // 유리: 돌면서 납작해졌다 넓어짐 + 반짝
          g.beginPath(); g.moveTo(p.x + c2 * r, p.y + s2 * r * tw); g.lineTo(p.x - s2 * r * 0.7, p.y + c2 * r * 0.7 * tw); g.lineTo(p.x - c2 * r * 0.8, p.y - s2 * r * 0.4 * tw); g.closePath();
          g.fillStyle = tw > 0.85 ? '#fff' : p.c; g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.8; g.stroke(); }
        else if (p.k === 'db') { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(p.r * 1.3))); g.fillStyle = p.c; g.fillRect(-p.sz / 2, -p.sz * 0.3, p.sz, p.sz * 0.6); g.strokeStyle = 'rgba(20,18,40,.7)'; g.lineWidth = 0.9; g.strokeRect(-p.sz / 2, -p.sz * 0.3, p.sz, p.sz * 0.6); g.restore(); }
        else { g.fillStyle = p.c; g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
      }
    }
    if (lit) g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  function drawCrack() {
    const C2 = crack, grow = clamp(C2.t / 0.14, 0, 1), fade = st.scene === 'over' ? 0.55 : 1;
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    const path = () => { g.beginPath(); for (const l of C2.L) { const n = Math.max(1, Math.round(l.pts.length * grow)); g.moveTo(l.pts[0][0], l.pts[0][1]); for (let i = 1; i < n; i++) g.lineTo(l.pts[i][0], l.pts[i][1]); } for (const [r, a0, a1] of C2.R) { if (grow < 0.6) continue; g.moveTo(C2.x + Math.cos(a0) * r, C2.y + Math.sin(a0) * r * 0.85); for (let a = a0; a <= a1; a += 0.12) g.lineTo(C2.x + Math.cos(a) * r, C2.y + Math.sin(a) * r * 0.85); } };
    path(); g.strokeStyle = `rgba(10,12,30,${0.45 * fade})`; g.lineWidth = 4.5; g.stroke();
    g.strokeStyle = `rgba(255,255,255,${0.9 * fade})`; g.lineWidth = 1.8; g.stroke();
    const hg = g.createRadialGradient(C2.x, C2.y, 0, C2.x, C2.y, 46); hg.addColorStop(0, `rgba(255,255,255,${0.7 * fade})`); hg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hg; g.beginPath(); g.arc(C2.x, C2.y, 46, 0, 7); g.fill();
    g.restore();
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
  function drawIdle() { drawCar(carModel('player', 0, C.P_HW + 1, C.P_HH), C.laneX(2), C.PY, 0); }
  const list = [];
  function drawWorld(a, px) {
    if (s.boost > 0 && !RM()) {   // 부스터 속도선(소실점 쪽으로)
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2.5;
      for (let i = 0; i < 22; i++) { const x = -260 + ((i * 53) % 900), y = ((i * 131 + s.f * 40) % 1500) - 900, q1 = ps(y - 120), q2 = ps(y); g.beginPath(); g.moveTo(sxOf(x, q1), syOf(q1) - 30 * q1 * PK); g.lineTo(sxOf(x, q2), syOf(q2) - 30 * q2 * PK); g.stroke(); }
    }
    list.length = 0;
    for (const it of s.items) if (!it.got) list.push([lerp(it._py ?? it.y, it.y, a) + it.hh, 0, it]);
    for (const c of s.cars) if (!c._fly) list.push([lerp(c._py ?? c.y, c.y, a) + c.hh, 1, c]);
    for (const f of flies) list.push([f.y + f.M.y1, 3, f]);
    list.push([C.PY + C.P_HH, 2, null]);
    list.sort((p, q) => p[0] - q[0]);
    for (const [y, t, o] of list) {
      const q = ps(y), sy = syOf(q); if (sy < HZ || sy > VH + 140) continue;
      const sc = q * PK * 0.95, al = clamp((y - C.FAR) / 70, 0, 1);   // 2026-10-31 하율 "바로 앞에 있는데 늦게 보임": 생기자마자 거의 바로 보이게(예전 260)
      if (t === 3) { drawFly(o); continue; }
      if (t === 0) {
        if (o.t === 'wall') put(wallArt(), sxOf(o.x, q), sy, q * PK, al);
        else if (o.t === 'box') put(itemArt('box'), sxOf(o.x, q), sy - Math.abs(Math.sin((s.f + o.id * 7) * 0.12)) * 6 * sc, sc * 0.95, al);
        else if (o.t === 'coin') { const sp = Math.abs(Math.cos((s.f + o.id * 9) * 0.09)); g.save(); g.translate(sxOf(o.x, q), sy); g.scale(0.25 + sp * 0.75, 1); put(itemArt('coin'), 0, 0, sc * 0.9, al); g.restore(); }
        else put(itemArt(o.t), sxOf(o.x, q), sy, sc * (o.t === 'cone' ? 1.05 : 0.9), al);
      } else if (t === 1) {
        const x = lerp(o._px ?? o.x, o.x, a), yc = y - o.hh, M = carModel(o.k, o.col, o.hw, o.hh), far = ps(yc) * PK * M.W < 26;
        if (o.dead) continue;   // 부스터로 날린 차는 flies가 그림
        // 차선 바꿀 때 앞이 가는 쪽으로 돌았다가 도착하면 펴짐
        const want = o.mv ? clamp((C.laneX(o.to) - x) / C.LANE_W, -1, 1) * 0.3 : 0;
        o._yaw = lerp(o._yaw || 0, want, 0.25);
        if (al < 1) g.globalAlpha = al;
        if (o.k === 'ramp') rampGlow(M, x, yc, o._yaw, false);
        drawCar(M, x, yc, o._yaw, o._yaw * 1.4, 0, !far, s.f);
        if (o.k === 'ramp') rampGlow(M, x, yc, o._yaw, true);
        tails(M, x, yc, o._yaw, Math.abs(x - px) < C.LANE_W * 0.7 && yc < C.PY && C.PY - yc < 800 ? 1 - (C.PY - yc) / 800 : 0);
        if ((o.blink || o.mv) && (s.f >> 3) % 2 === 0 && !far) {   // 깜빡이(뒤 모서리)
          const sd = o.to > o.lane ? 1 : -1, [bx, by] = projPt(M, x, yc, o._yaw, 0, sd * M.W * 0.45, M.y1 + 0.5, M.W * 0.38), r = 10 * ps(yc) * PK;
          g.globalCompositeOperation = 'lighter';
          const gl = g.createRadialGradient(bx, by, 0, bx, by, r); gl.addColorStop(0, 'rgba(255,200,60,1)'); gl.addColorStop(0.4, 'rgba(255,170,30,.7)'); gl.addColorStop(1, 'rgba(255,170,30,0)'); g.fillStyle = gl; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill();
          g.globalCompositeOperation = 'source-over';
        }
        g.globalAlpha = 1;
      } else drawPlayer(px, a);
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
  function aero(vk) {
    const A = pAero, tn = performance.now(); let fx = A.nx - A.rx, fy = A.ny - A.ry; const Lc = Math.hypot(fx, fy) || 1; fx /= Lc; fy /= Lc;
    const sx = -fy, sy = fx, W = A.hw, sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const P = (t, d) => [A.nx - fx * Lc * t + sx * d, A.ny - fy * Lc * t + sy * d];   // t: 0 = 코, 1 = 꽁무니, 음수 = 앞 · d: 옆(+/-)
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    // 코 앞 안개(압축된 공기)
    const [mx, my] = P(-0.16 - 0.08 * vk, 0), fl = 0.85 + 0.15 * Math.sin(tn / 29);
    g.globalAlpha = 0.5 * vk * fl; stamp(blob('vp', [[0, 'rgba(240,250,255,.7)'], [0.6, 'rgba(220,240,255,.18)'], [1, 'rgba(220,240,255,0)']]), mx, my, W * (1.5 + 0.8 * vk)); g.globalAlpha = 1;
    // 충격파 막 3겹: 가운데(코 앞)가 진하고 양 끝으로 흐려짐, 바깥 겹일수록 넓고 옅음
    for (let k = 0; k < 3; k++) {
      const ahead = W * (0.55 + k * 0.5) * (1 + 0.4 * vk) / Lc, spread = W * (1.35 + k * 0.6) * (1 + 0.5 * vk), back = W * (1.9 + k * 0.7) / Lc, al = vk * (0.85 - k * 0.25) * (0.8 + 0.2 * Math.sin(tn / (19 + k * 7) + k));
      g.lineWidth = (2.6 - k * 0.6) * (W / 18);
      let p0 = P(-ahead + back, -spread);
      for (let j = 1; j <= 20; j++) { const u = -1 + j / 10, um = u - 0.05, pt = P(-ahead + back * u * u, spread * u), a2 = al * Math.pow(1 - Math.abs(um), 1.4); g.strokeStyle = `rgba(${k ? '190,232,255' : '245,252,255'},${a2.toFixed(3)})`; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(pt[0], pt[1]); g.stroke(); p0 = pt; }
    }
    // 공기 흐름 줄: 앞에서 오다 코에서 옆으로 밀려나 차 몸을 따라 흐르고, 뒤에서 살짝 모이며 흩어짐(결이 뒤로 흘러감)
    const N = lowFx ? 8 : 16, spd = 0.0016 + 0.0022 * vk;
    for (let i = 0; i < N; i++) {
      const sd = i % 2 ? 1 : -1, lv = (i >> 1) / (N / 2), b0 = W * (0.15 + 1.1 * lv), push = W * (1.0 - 0.35 * lv) * (1 + 0.6 * vk);
      const dOf = t => sd * (b0 + push * sm(-W * 1.6 / Lc, 0.12, t) * (1 - 0.4 * sm(1.1, 2.3, t)));
      const u0 = (((tn * spd * (1 + lv * 0.4)) + i * 0.618) % 1) * 3.6 - 1.2, seg = 0.8 + 0.4 * vk, al = vk * (0.8 - 0.35 * lv) * (1 - sm(1.4, 2.3, u0 + seg / 2));
      if (al < 0.02) continue;
      const q1 = P(u0, dOf(u0)), q2 = P(u0 + seg, dOf(u0 + seg)), gr = g.createLinearGradient(q1[0], q1[1], q2[0], q2[1]);   // 한 줄을 한 번에(양 끝 투명) — 끊긴 점선처럼 보이지 않게
      gr.addColorStop(0, 'rgba(232,248,255,0)'); gr.addColorStop(0.45, `rgba(240,250,255,${al.toFixed(3)})`); gr.addColorStop(1, 'rgba(232,248,255,0)');
      g.strokeStyle = gr; g.lineWidth = (1.2 + 1.8 * (1 - lv)) * (W / 18); g.beginPath(); g.moveTo(q1[0], q1[1]);
      for (let j = 1; j <= 6; j++) { const t = u0 + seg * j / 6, q3 = P(t, dOf(t)); g.lineTo(q3[0], q3[1]); }
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // 떨어져 나가는 수증기: 충격파 끝에서 뒤로 빠르게
    if (!lowFx && Math.random() < 0.55 * vk) { const sd = Math.random() < 0.5 ? -1 : 1, [vx0, vy0] = P(0.25 + Math.random() * 0.3, sd * W * (1.5 + Math.random() * 0.6) * (1 + 0.4 * vk)), sp3 = Lc * (6 + 6 * vk); addP({ k: 'vp', x: vx0, y: vy0, vx: -fx * sp3 + sx * sd * 60, vy: -fy * sp3 + sy * sd * 60, gv: 0, dr: 0.3, life: 0.35, max: 0.35, c: '', sz: W * 0.5, gr: W * 2.2 }); }
  }
  // 사다리차 표시(2026-11-01 하율 "점프대차 더 확실하게"): 뒤 바닥에 깜빡이는 노란 빛 + 차 위에 떠서 통통 튀는 '점프대 ▲' 표지(멀어도 최소 크기)
  function rampGlow(M, x, yc, yaw, top) {
    const q = ps(yc), pu = 0.6 + 0.4 * Math.sin(performance.now() / 110);
    if (!top) {
      const [bx, by] = projPt(M, x, yc, yaw, 0, 0, M.y1 + 8, 0), r = Math.max(18, 60 * q * PK);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 * pu; g.save(); g.translate(bx, by); g.scale(1.3, 0.45); stamp(blob('rampG', [[0, 'rgba(255,220,60,1)'], [0.5, 'rgba(255,170,20,.5)'], [1, 'rgba(255,150,0,0)']]), 0, 0, r); g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      return;
    }
    const [tx, ty] = projPt(M, x, yc, yaw, 0, 0, M.y0 + M.L * 0.4, M.W * 1.5), sc2 = Math.max(1, q * PK * 1.1), bob = Math.sin(performance.now() / 160) * 4 * sc2, w2 = 64 * sc2, h2 = 24 * sc2, yy = ty - 20 * sc2 + bob;
    g.save(); g.translate(tx, yy);
    g.fillStyle = '#ffd23f'; rr(g, -w2 / 2, -h2 / 2, w2, h2, h2 / 2); g.fill(); g.lineWidth = 2.5 * sc2; g.strokeStyle = '#1c1d22'; g.stroke();
    g.beginPath(); g.moveTo(-6 * sc2, h2 / 2); g.lineTo(6 * sc2, h2 / 2); g.lineTo(0, h2 / 2 + 8 * sc2); g.closePath(); g.fillStyle = '#ffd23f'; g.fill(); g.stroke();
    g.font = `${(15 * sc2).toFixed(1)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1c1d22'; g.fillText('점프대 ▲', 0, 1 * sc2);
    g.restore();
  }
  // 미등: 멀리서도 차가 보이게(어두운 색 차·어두운 도로) — 내 차선 앞이면 더 크고 밝게(위험 표시)
  function tails(M, x, yc, yaw, danger) {
    const q = ps(yc), r0 = Math.max(3.2, 7 * q * PK) * (1 + danger * 0.9), on2 = danger > 0 ? 0.75 + 0.25 * Math.sin(performance.now() / 70) : 0.75, tb = blob('tail', TAIL);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = on2;
    for (const sd of [-1, 1]) { const [bx, by] = projPt(M, x, yc, yaw, 0, sd * M.W * 0.36, M.y1 + 0.6, M.W * 0.42); stamp(tb, bx, by, r0 * 1.8); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  function drawFly(f) {
    const q = ps(f.y), sx = sxOf(f.x, q), sy = syOf(q) - f.z * q * PK * ZK;
    if (sy < HZ - 40 || sy > VH + 200) return;
    if (f.px != null && !RM() && f.z > 2) {   // 지나온 자리 잔상 줄
      g.globalCompositeOperation = 'lighter'; const tg = g.createLinearGradient(f.px, f.py, sx, sy); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(255,230,170,.55)');
      g.strokeStyle = tg; g.lineWidth = 26 * q; g.lineCap = 'round'; g.beginPath(); g.moveTo(f.px, f.py); g.lineTo(sx, sy - 10 * q); g.stroke(); g.globalCompositeOperation = 'source-over';
      if (!lowFx && Math.random() < 0.7) addP({ k: 'sp', x: sx + (Math.random() - 0.5) * 30 * q, y: sy - 10 * q, vx: (Math.random() - 0.5) * 200, vy: 60 + Math.random() * 120, gv: 600, dr: 0.3, life: 0.35, max: 0.35, c: '#ffd08a', sz: 2 });
      if (!lowFx && Math.random() < 0.35) addP({ k: 'sm', x: sx, y: sy - 14 * q, vx: 0, vy: -20, gv: -10, dr: 0.4, life: 0.8, max: 0.8, c: '', sz: 10 * q, gr: 30 * q });
    }
    f.px = sx; f.py = sy - 10 * q;
    const al = f.t > 2.5 ? (3 - f.t) / 0.5 : 1;
    g.save(); if (al < 1) g.globalAlpha = Math.max(0, al);
    g.translate(sx, sy - 12 * q); g.rotate(f.roll); g.translate(-sx, -(sy - 12 * q));
    drawCar(f.M, f.x, f.y, f.yaw, 0, f.z, ps(f.y) * PK * f.M.W >= 26, s ? s.f : 0);
    g.restore();
  }
  // 부스터 불꽃(배기구 → 뒤로): 바깥 보라·파랑 → 주황 → 하얀 심, 'lighter'로 겹쳐 빛나게
  function flame(ex, ey, tx, ty, w, pal) {
    const dx = tx - ex, dy = ty - ey, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const gr = g.createLinearGradient(ex, ey, tx, ty); pal.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.beginPath(); g.moveTo(ex + nx * w, ey + ny * w);
    g.quadraticCurveTo(ex + dx * 0.45 + nx * w * 1.25, ey + dy * 0.45 + ny * w * 1.25, tx, ty);
    g.quadraticCurveTo(ex + dx * 0.45 - nx * w * 1.25, ey + dy * 0.45 - ny * w * 1.25, ex - nx * w, ey - ny * w); g.closePath(); g.fill();
  }
  let lay = null;
  const layer = () => { if (!lay) lay = document.createElement('canvas').getContext('2d'); if (lay.canvas.width !== cv.width || lay.canvas.height !== cv.height) { lay.canvas.width = cv.width; lay.canvas.height = cv.height; } lay.setTransform(1, 0, 0, 1, 0, 0); lay.clearRect(0, 0, cv.width, cv.height); return lay; };
  function drawPlayer(px, a) {
    const P = s.p, am = P.am || C.JUMP_F, air = P.air > 0 ? Math.sin((1 - (P.air - a) / am) * Math.PI) * (am > C.JUMP_F ? 2.7 : 1) : 0, M = carModel('player', 0, C.P_HW + 1, C.P_HH), q = ps(C.PY), s2 = q * PK;
    const wreck = (st.scene === 'crash' || st.scene === 'over') && (s.over === 'crash' || s.over === 'wall' || s.over === 'cone');
    const blinkOff = (s.grace > 0 || (s.boost > 0 && s.boost < 50)) && (s.f >> 2) % 2 === 0;
    const lift = wreck ? wz : air * 46, cx = sxOf(px, q), cy = syOf(q) - lift * s2 * ZK;
    if (!wreck && am > C.JUMP_F && air > 0.05 && !RM()) {   // 사다리 점프 중: 차 아래 바닥 표시(착지 자리) + 반짝 꼬리
      const gq = syOf(q), mk = 1 - air / 2.7 * 0.5; g.strokeStyle = `rgba(255,220,120,${(0.35 + 0.4 * (air / 2.7)).toFixed(2)})`; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, gq + 4, 26 * s2 * mk, 9 * s2 * mk, 0, 0, 7); g.stroke();
      if (!lowFx && Math.random() < 0.8) addP({ k: 'st', x: cx + (Math.random() - 0.5) * 40 * s2, y: cy + 10 * s2, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 80, gv: 100, life: 0.45, max: 0.45, c: Math.random() < 0.5 ? '#ffd34d' : '#fff', sz: 3 + Math.random() * 3, r: Math.random() * 6 });
    }
    if (wreck && wroll) { g.save(); g.translate(cx, cy - 14 * s2); g.rotate(wroll * 0.35); g.translate(-cx, -(cy - 14 * s2)); }
    pScr = [cx, cy];
    if (!wreck) { const [nx, ny] = projPt(M, px, C.PY, yawP, lift, 0, M.y0, M.W * 0.3), [rx2, ry2] = projPt(M, px, C.PY, yawP, lift, 0, M.y1, M.W * 0.3); pAero = { nx, ny, rx: rx2, ry: ry2, hw: M.W * 0.5 * s2 }; } else pAero = null;
    if (!wreck) yawP = lerp(yawP, clamp((C.laneX(P.lane) - px) / C.LANE_W, -1, 1) * 0.34, 0.35);
    const yaw = wreck ? (0.5 + Math.min(crashT / 600, 1) * 0.6) * (px < RX ? -1 : 1) : yawP;
    const boost = s.boost > 0 && !wreck;
    if (boost && !RM()) {   // 길에 남는 빛 꼬리(미등 두 줄) + 바닥 열기
      g.globalCompositeOperation = 'lighter';
      for (const sd of [-1, 1]) {
        const [x0, y0] = projPt(M, px, C.PY, yaw, 0, sd * M.W * 0.32, M.y1, 0), [x1, y1] = projPt(M, px, C.PY, yaw * 0.3, 0, sd * M.W * 0.32, M.y1 + 200, 0), w0 = 3.5 * s2, w1 = 9 * s2;
        const tg = g.createLinearGradient(x0, y0, x1, y1); tg.addColorStop(0, `hsla(${(s.f * 8) % 360},100%,62%,.5)`); tg.addColorStop(0.5, `hsla(${(s.f * 8 + 120) % 360},100%,58%,.2)`); tg.addColorStop(1, 'rgba(120,80,255,0)');
        g.fillStyle = tg; g.beginPath(); g.moveTo(x0 - w0, y0); g.lineTo(x0 + w0, y0); g.lineTo(x1 + w1, y1); g.lineTo(x1 - w1, y1); g.closePath(); g.fill();
      }
      const [hx, hy] = projPt(M, px, C.PY, yaw, 0, 0, M.y1 + 10, 0), hr = 70 * s2, hg = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hg.addColorStop(0, 'rgba(255,170,60,.55)'); hg.addColorStop(0.5, 'rgba(255,90,140,.2)'); hg.addColorStop(1, 'rgba(120,80,255,0)'); g.fillStyle = hg; g.save(); g.translate(hx, hy); g.scale(1.4, 0.55); g.beginPath(); g.arc(0, 0, hr, 0, 7); g.fill(); g.restore();
      g.globalCompositeOperation = 'source-over';
    }
    if (!wreck) {   // 내 차 밑 빛(어디 있는지 한눈에)
      const ug = g.createRadialGradient(cx, cy + lift * s2 * ZK, 1, cx, cy + lift * s2 * ZK, 52 * s2); ug.addColorStop(0, boost ? 'rgba(160,120,255,.4)' : 'rgba(80,200,255,.45)'); ug.addColorStop(1, 'rgba(80,200,255,0)');
      g.save(); g.translate(cx, cy + lift * s2 * ZK); g.scale(0.75, 1); g.fillStyle = ug; g.beginPath(); g.arc(0, 0, 52 * s2, 0, 7); g.fill(); g.restore();
    }
    if (blinkOff) {   // 반투명 깜빡임: 면이 비쳐 보이지 않게 따로 그린 뒤 한 장으로 흐리게 얹음
      const g0 = g, L2 = layer(); L2.setTransform(g0.getTransform()); g = L2;
      drawCar(M, px, C.PY, yaw, wreck ? 0 : yawP * 1.5, lift, true, s.f);
      g = g0; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.45; g.drawImage(L2.canvas, 0, 0); g.restore();
    } else drawCar(M, px, C.PY, yaw, wreck ? 0 : yawP * 1.5, lift, true, s.f);
    if (boost) {
      const fl = RM() ? 0.8 : 0.75 + Math.random() * 0.5, len = 30 + Math.min(1, (C.BOOST_F - s.boost) / 10) * 22;
      g.globalCompositeOperation = 'lighter';
      for (const [ex, ey, ez] of M.ex) {
        const [x0, y0] = projPt(M, px, C.PY, yaw, lift, ex, ey, ez), [x1, y1] = projPt(M, px, C.PY, yaw, lift, ex * 1.1, ey + len * fl, ez * 0.6), [x2, y2] = projPt(M, px, C.PY, yaw, lift, ex, ey + len * 0.55 * fl, ez * 0.8);
        const gl = g.createRadialGradient(x0, y0, 0, x0, y0, 15 * s2); gl.addColorStop(0, 'rgba(255,255,255,.85)'); gl.addColorStop(0.35, 'rgba(120,200,255,.45)'); gl.addColorStop(1, 'rgba(90,60,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x0, y0, 15 * s2, 0, 7); g.fill();
        flame(x0, y0, x1, y1, 6 * s2, [[0, 'rgba(110,150,255,.75)'], [0.4, 'rgba(150,70,255,.45)'], [1, 'rgba(120,40,255,0)']]);
        flame(x0, y0, x2, y2, 3.8 * s2, [[0, 'rgba(255,255,255,.95)'], [0.3, 'rgba(255,190,80,.85)'], [1, 'rgba(255,90,40,0)']]);
        flame(x0, y0, (x0 + x2) / 2, (y0 + y2) / 2, 2.6 * s2, [[0, '#fff'], [1, 'rgba(200,240,255,0)']]);
        for (let i = 1; i <= 3; i++) { const t = i / 4.2, dx = x0 + (x2 - x0) * t, dy = y0 + (y2 - y0) * t, r = (3.2 - i * 0.6) * s2; g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(dx, dy, r * 1.3, r * 0.8, 0, 0, 7); g.fill(); }   // 충격파 무늬
        if (!RM() && Math.random() < 0.8) parts.push({ x: x0 + (Math.random() - 0.5) * 8, y: y0, vx: (Math.random() - 0.5) * 140, vy: 120 + Math.random() * 260, sz: 2 + Math.random() * 2.5, c: Math.random() < 0.5 ? '#ffe9a8' : '#9fd8ff', life: 0.35, max: 0.35 });
      }
      g.globalCompositeOperation = 'source-over';
    }
    if (wreck && wroll) g.restore();
    if (wreck && !RM() && (s.f + (crashT | 0)) % 2 === 0) {   // 불길(깜빡이며 위로)
      for (let i = 0; i < 3; i++) addP({ k: 'fi', x: cx + (Math.random() - 0.5) * 40 * s2, y: cy - 16 * s2, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 80, gv: -40, dr: 0.3, life: 0.4 + Math.random() * 0.3, max: 0.7, c: '', sz: (8 + Math.random() * 10) * s2, gr: 10 * s2 });
    }
    if (wreck) { for (let i = 0; i < 5; i++) { const r = (12 + i * 5) * s2, yy = cy - 20 * s2 - i * 18 * s2 - crashT / 26; const sm = g.createRadialGradient(cx, yy, 1, cx, yy, r); sm.addColorStop(0, 'rgba(70,72,85,.5)'); sm.addColorStop(1, 'rgba(70,72,85,0)'); g.fillStyle = sm; g.beginPath(); g.arc(cx + Math.sin(crashT / 200 + i) * 14 * s2, yy, r, 0, 7); g.fill(); } }
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
  let nbShown = false, topK = 0, lastSP = 0, scoreTxt = '', scoreV = -1, mTxt = '', mV = -1, kmh = 0;
  function drawHud() {
    const scv = C.scoreOf(s), m = C.metersOf(s);
    if (scv !== scoreV) { scoreV = scv; scoreTxt = fmt(scv); }
    if (m !== mV) { mV = m; mTxt = fmt(m) + ' m'; }
    kmh = lerp(kmh, kmhOf(s.v) * (1 + 0.6 * bI), 0.2); if (st.scene === 'play') topK = Math.max(topK, kmh);   // 부스터 중엔 600km/h 안팎으로 보이게(2026-11-01 하율)
    // 점수(가운데 위)
    panel(VW / 2 - 110, 10, 220, 64, 16);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `38px ${FONT}`; g.fillStyle = best > 0 && scv > best ? '#ffe36b' : '#fff'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.fillText(scoreTxt, VW / 2, 36); g.shadowBlur = 0;
    g.font = `14px ${FONT}`; g.fillStyle = '#ffd25e'; g.fillText(mTxt, VW / 2 - 44, 61); g.fillStyle = s.slip > 0.05 ? '#7ff0ff' : '#9fe0ff'; g.fillText(Math.round(kmh) + ' km/h', VW / 2 + 44, 61);
    if (s.slip > 0.05) {   // 슬립스트림 띠(점수판 아래)
      panel(VW / 2 - 110, 80, 220, 28, 14); g.font = `15px ${FONT}`; g.fillStyle = s.slip > 0.7 ? '#ffe36b' : '#7ff0ff'; g.fillText('슬립스트림 +' + Math.round(C.SLIP_K * s.slip * 100) + '% · 점수 x' + (1 + s.slip).toFixed(1), VW / 2, 93);
      g.fillStyle = s.slip > 0.7 ? 'rgba(255,227,107,.9)' : 'rgba(127,240,255,.85)'; g.fillRect(VW / 2 - 98, 103, 196 * s.slip, 2.5);
      if (s.f % 30 === 0 && s.slipPts > lastSP) { pW(s.p.x, C.PY + C.P_HH, 52, '+' + (s.slipPts - lastSP), s.slip > 0.7 ? '#ffe36b' : '#7ff0ff'); lastSP = s.slipPts; }
    }
    // 내 최고 기록(2026-11-01 하율 "최고 점수가 플레이할 때 잘 보이게"): 연료 아래 띠 + 넘으면 금색 '신기록!'
    if (best > 0) {
      const over = scv > best, x0 = 14, y0 = 58, w0 = 220, pu = over ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 0;
      if (over) { const gg = g.createLinearGradient(x0, 0, x0 + w0, 0); gg.addColorStop(0, `rgba(255,190,40,${(0.75 + 0.2 * pu).toFixed(2)})`); gg.addColorStop(1, `rgba(255,120,60,${(0.75 + 0.2 * pu).toFixed(2)})`); g.fillStyle = gg; rr(g, x0, y0, w0, 38, 12); g.fill(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; g.stroke(); }
      else panel(x0, y0, w0, 38, 12);
      star(g, x0 + 20, y0 + 19, 9, over ? '#fff6c8' : '#ffd25e');
      g.textAlign = 'left'; g.textBaseline = 'middle';
      if (over) { g.font = `19px ${FONT}`; g.fillStyle = '#2a1a00'; g.fillText('신기록! +' + fmt(scv - best), x0 + 36, y0 + 20); }
      else {
        g.font = `12px ${FONT}`; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText('내 최고', x0 + 36, y0 + 12);
        g.font = `17px ${FONT}`; g.fillStyle = '#ffd25e'; g.fillText(fmt(best), x0 + 84, y0 + 13);
        g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, x0 + 36, y0 + 25, w0 - 48, 6, 3); g.fill(); g.fillStyle = '#ffd25e'; rr(g, x0 + 36, y0 + 25, Math.max(6, (w0 - 48) * clamp(scv / best, 0, 1)), 6, 3); g.fill();
      }
      if (over && !nbShown && st.scene === 'play') { nbShown = true; pop(VW / 2, 160, '최고 기록 돌파!!', '#ffd25e', 2); sfx.combo(10); rings.push({ t: 0, c: '255,215,90' }); flash = Math.max(flash, 0.2); }
    }
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
