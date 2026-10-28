// SVMHS GROUND — '영상고 계단 오르기' (2026-10-28 하율 "무한의 계단을 사이트에 — 이름은 영상고 계단 오르기", 미리보기 깃발 stair-game)
// 규칙(무한 계단식 — 이름·그림·소리는 전부 새로 만듦): 계단은 한 칸씩 왼쪽/오른쪽으로 꺾이며 끝없이 이어짐.
//   '오르기' = 보고 있는 쪽으로 한 칸 · '방향 바꾸기' = 몸을 돌려 반대쪽으로 한 칸. 계단이 없는 쪽으로 오르면 헛디뎌 끝.
//   위의 '종 게이지'는 계속 줄고 한 칸마다 조금 참(stair-score.js) — 다 떨어지면 종이 쳐서 지각, 끝.
// 화면 쪽 글자(시작·멈춤·결과 안내)는 social.js playStair가 그림. 여기는 캔버스·입력 처리·소리만.
import { GAIN, FLOOR, drain, floorName, zoneOf } from './stair-score.js';

const W = 360, H = 540, DX = 46, DY = 30, SW = 62, ST = 14;   // 논리 해상도 · 계단 한 칸 가로/세로 간격 · 계단 폭·두께
const INK = '#2a2846';
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`; };
// 높이(층)에 따른 배경: 학교 안(1~5층) → 옥상·하늘 → 구름 위 → 밤하늘·우주
const SKY = [[0, '#f7f0e2', '#efe4cf'], [5, '#bfe6ff', '#e9f6ff'], [12, '#7cc4ff', '#cdeaff'], [20, '#3d4f9e', '#7c8bd6'], [28, '#151a3d', '#2e3670']];
function skyAt(f) {
  for (let i = 0; i < SKY.length - 1; i++) { const [a, t1, b1] = SKY[i], [b, t2, b2] = SKY[i + 1]; if (f < b) { const t = Math.max(0, (f - a) / (b - a)); return [mix(t1, t2, t), mix(b1, b2, t)]; } }
  const l = SKY[SKY.length - 1]; return [l[1], l[2]];
}
// 씨앗 있는 난수(테스트 재현용)
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function createStair(cv, o = {}) {
  const ctx = cv.getContext('2d');
  let dpr = 1, raf = 0, last = 0, alive = true, sound = !!o.sound, ac = null, rnd = rng(o.seed ?? (Date.now() & 0xffff));
  const st = { scene: 'ready', steps: 0, turns: 0, ms: 0, gauge: 1, floor: 0, face: 1, why: '' };
  let xs = [], run = 0, runDir = 1, px = 0, py = 0, fromX = 0, fromY = 0, moveT = 1, fall = null, shake = 0, parts = [], pops = [], stars = [], bob = 0, camX = 0, camY = 0;
  for (let i = 0; i < 70; i++) stars.push([Math.random() * W, Math.random() * H * 3, .6 + Math.random() * 1.4]);

  function size() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
  }
  function more(n) {   // 앞으로 n칸 더 만듦: 같은 방향으로 1~6칸 이어지다 꺾임(처음 한 칸은 항상 오른쪽 → 첫 '오르기'가 실패하지 않게)
    while (xs.length < n) {
      const i = xs.length;
      if (i === 0) { xs.push(0); continue; }
      if (i === 1) { xs.push(1); runDir = 1; run = 1; continue; }
      const turnP = run >= 6 ? 1 : run <= 1 ? .22 : .38;
      if (rnd() < turnP) { runDir = -runDir; run = 0; }
      xs.push(xs[i - 1] + runDir); run++;
    }
  }
  function reset() {
    xs = []; more(60); Object.assign(st, { scene: 'ready', steps: 0, turns: 0, ms: 0, gauge: 1, floor: 0, face: 1, why: '' });
    px = fromX = 0; py = fromY = 0; moveT = 1; fall = null; shake = 0; parts = []; pops = []; camX = 0; camY = 0;
  }
  // ----- 소리 (첫 입력 뒤에 만듦, 기본 꺼짐) -----
  function beep(f, d = .06, type = 'square', v = .05, f2) {
    if (!sound) return;
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, g = ac.createGain(), os = ac.createOscillator();
      os.type = type; os.frequency.setValueAtTime(f, t); if (f2) os.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      os.connect(g).connect(ac.destination); os.start(t); os.stop(t + d + .02);
    } catch {}
  }
  const tune = () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .09, 'triangle', .06), i * 70)); };

  // ----- 입력: 'climb' 오르기 · 'turn' 방향 바꾸기 -----
  function input(kind) {
    if (!alive) return;
    if (st.scene === 'over') return;
    if (st.scene === 'pause') { st.scene = 'play'; last = 0; o.onPause?.(false); return; }   // 멈춤을 푸는 입력은 오르지 않음
    if (st.scene === 'ready') { st.scene = 'play'; o.onStart?.(); }
    if (kind === 'turn') { st.face = -st.face; st.turns++; }
    const i = st.steps, nx = xs[i + 1];
    fromX = lerp(fromX, px, moveT); fromY = lerp(fromY, py, moveT);
    if (nx - xs[i] !== st.face) {   // 계단이 없는 쪽 → 헛디딤
      fall = { x: xs[i] + st.face, y: i + .6, vx: st.face * 1.1, vy: -2.4, r: 0 };
      shake = 10; beep(300, .35, 'sawtooth', .05, 70); end('miss'); return;
    }
    st.steps++; px = nx; py = st.steps; moveT = 0;
    st.gauge = Math.min(1, st.gauge + GAIN);
    if (st.steps + 40 > xs.length) more(st.steps + 60);
    for (let k = 0; k < 3; k++) parts.push({ x: px * DX - st.face * 10, y: -py * DY, vx: -st.face * (20 + Math.random() * 40), vy: -10 - Math.random() * 30, t: 0 });
    const f = Math.floor(st.steps / FLOOR);
    if (f > st.floor) { const z = zoneOf(f) !== zoneOf(st.floor); st.floor = f; pops = [{ t: 0, s: f <= 5 ? floorName(f) + ' 도착!' : z ? zoneOf(f) + ' 도착!' : floorName(f, true) + '!' }]; tune(); o.onFloor?.(f); }
    else beep(392 + (st.steps % 8) * 28, .045, 'square', .035);
    o.onStep?.(st.steps);
  }
  function end(why) {
    if (st.scene === 'over') return;
    st.scene = 'over'; st.why = why;
    if (why === 'time') { shake = 6; [880, 660, 880, 660].forEach((f, i) => setTimeout(() => beep(f, .16, 'triangle', .06), i * 170)); }
    setTimeout(() => alive && o.onOver?.({ steps: st.steps, turns: st.turns, ms: Math.round(st.ms), why, floor: st.floor }), 650);
  }
  function pause() { if (st.scene === 'play') { st.scene = 'pause'; o.onPause?.(true); } }

  // ----- 그리기 -----
  let shX = 0, shY = 0;
  const sx = wx => W / 2 + wx - camX + shX;
  const sy = wy => H * .66 + wy - camY + shY;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function drawBg() {
    const f = (camY / -DY) / FLOOR, [top, bot] = skyAt(f), g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (f < 5.4) {   // 학교 안: 창문·복도 띠(느리게 따라옴)
      ctx.globalAlpha = Math.max(0, Math.min(1, 5.4 - f));
      const off = (-camY * .5) % 180;
      for (let y = -180 + off; y < H + 180; y += 180) {
        ctx.fillStyle = '#cfe6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        for (const x of [24, W - 84]) { rr(x, y, 60, 74, 8); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 30, y); ctx.lineTo(x + 30, y + 74); ctx.moveTo(x, y + 37); ctx.lineTo(x + 60, y + 37); ctx.stroke(); }
        ctx.fillStyle = '#9cc9f5'; ctx.fillRect(0, y + 120, W, 10);
      }
      ctx.globalAlpha = 1;
    }
    if (f > 4.5 && f < 22) {   // 구름
      ctx.globalAlpha = Math.min(1, (f - 4.5) * 1.5) * (f > 18 ? Math.max(0, (22 - f) / 4) : 1);
      const off = (-camY * .3) % 260;
      ctx.fillStyle = '#fff';
      for (let y = -260 + off, k = 0; y < H + 260; y += 130, k++) { const x = (k * 137) % (W - 80) + 10 - (camX * .2) % 60; cloud(x, y); }
      ctx.globalAlpha = 1;
    }
    if (f > 18) {   // 별
      ctx.globalAlpha = Math.min(1, (f - 18) / 4); ctx.fillStyle = '#fff';
      for (const [x, y, r] of stars) { const yy = ((y - camY * .15) % (H * 3) + H * 3) % (H * 3) - H; if (yy > -5 && yy < H + 5) { ctx.beginPath(); ctx.arc((x - camX * .1 + W * 9) % W, yy, r, 0, 6.3); ctx.fill(); } }
      ctx.globalAlpha = 1;
    }
  }
  function cloud(x, y) { ctx.beginPath(); ctx.arc(x + 20, y + 14, 14, 0, 6.3); ctx.arc(x + 40, y + 8, 18, 0, 6.3); ctx.arc(x + 60, y + 15, 13, 0, 6.3); ctx.rect(x + 20, y + 14, 40, 15); ctx.fill(); }
  function drawStair(i) {
    const x = sx(xs[i] * DX) - SW / 2, y = sy(-i * DY) + 2, land = i % FLOOR === 0 && i > 0;
    const school = i < FLOOR * 5;
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    ctx.fillStyle = land ? '#ffb53d' : school ? '#7fb2ec' : '#8b7fe0'; rr(x, y, SW, ST + 6, 6); ctx.fill(); ctx.stroke();   // 앞면
    ctx.fillStyle = land ? '#ffd25e' : school ? '#d8ebff' : '#c9c1ff'; rr(x, y, SW, 9, 5); ctx.fill(); ctx.stroke();       // 윗면
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 6, y + 3, SW * .45, 2);
    if (land) {   // 층 표지판
      const f = i / FLOOR, nm = floorName(f, true), tx = x + SW / 2, ty = y - 44;
      ctx.font = '700 13px Jua, sans-serif'; const w = Math.max(34, ctx.measureText(nm).width + 16);
      ctx.fillStyle = '#fff'; rr(tx - w / 2, ty, w, 22, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(nm, tx, ty + 12);
      ctx.beginPath(); ctx.moveTo(tx, ty + 22); ctx.lineTo(tx, y); ctx.stroke();
    }
  }
  function drawKid(x, y, face, t, rot = 0) {   // 교복 입은 학생(남색 재킷·하늘 넥타이·빨간 가방)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(face, 1);
    const b = Math.sin(t) * 1.5, legA = Math.sin(t * 2) * 4;
    ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = INK; rr(-8 + legA * .3, -12, 6, 12, 2); ctx.fill(); rr(2 - legA * .3, -12, 6, 12, 2); ctx.fill();   // 다리
    ctx.fillStyle = '#ff7a6b'; rr(-15, -30 + b, 9, 15, 3); ctx.fill(); ctx.stroke();       // 가방
    ctx.fillStyle = '#34428c'; rr(-9, -32 + b, 18, 21, 5); ctx.fill(); ctx.stroke();       // 재킷
    ctx.fillStyle = '#9fd4ff'; ctx.beginPath(); ctx.moveTo(0, -31 + b); ctx.lineTo(3, -24 + b); ctx.lineTo(0, -19 + b); ctx.lineTo(-3, -24 + b); ctx.closePath(); ctx.fill();   // 넥타이
    ctx.fillStyle = '#ffe0c2'; ctx.beginPath(); ctx.arc(1, -42 + b, 10, 0, 6.3); ctx.fill(); ctx.stroke();   // 얼굴
    ctx.fillStyle = '#3a2b25'; ctx.beginPath(); ctx.arc(0, -45 + b, 10.5, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(10, -42 + b); ctx.quadraticCurveTo(2, -49 + b, -9, -42 + b); ctx.closePath(); ctx.fill(); ctx.stroke();   // 머리
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(5.5, -41 + b, 1.6, 0, 6.3); ctx.fill();   // 눈
    ctx.fillStyle = '#ff9db0'; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(4, -37 + b, 2.2, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawHud() {
    // 종 게이지
    const g = st.gauge, bw = W - 92, bx = 58, by = 18;
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.fillStyle = '#fff'; rr(bx, by, bw, 18, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = g > .45 ? '#5ad17a' : g > .22 ? '#ffc23d' : '#ff5a5a';
    if (g > .01) { rr(bx + 3, by + 3, (bw - 6) * g, 12, 6); ctx.fill(); }
    bell(36, 27, g < .22 && st.scene === 'play' ? Math.sin(performance.now() / 40) * .35 : 0);
    // 오른 칸 수 + 지금 층
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 54px Jua, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(st.steps, W / 2, 96); ctx.fillStyle = '#fff'; ctx.fillText(st.steps, W / 2, 96);
    ctx.font = '400 16px Jua, sans-serif'; ctx.lineWidth = 4; ctx.strokeText(floorName(st.floor), W / 2, 120); ctx.fillStyle = '#ffd25e'; ctx.fillText(floorName(st.floor), W / 2, 120);
  }
  function bell(x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.fillStyle = '#ffd25e';
    ctx.beginPath(); ctx.moveTo(-10, 6); ctx.quadraticCurveTo(-9, -11, 0, -11); ctx.quadraticCurveTo(9, -11, 10, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 8, 2.6, 0, 6.3); ctx.fill(); ctx.restore();
  }
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
    if (st.scene === 'play') {
      st.ms += dt * 1000; st.gauge -= drain(st.steps) * dt;
      if (st.gauge <= 0) { st.gauge = 0; end('time'); }
    }
    moveT = Math.min(1, moveT + dt / .07);
    const cx = lerp(fromX, px, moveT), cy = lerp(fromY, py, moveT);
    camX = lerp(camX, cx * DX, Math.min(1, dt * 10)); camY = lerp(camY, -cy * DY, Math.min(1, dt * 12));
    if (shake) shake = Math.max(0, shake - dt * 30);
    shX = shake ? (Math.random() - .5) * shake : 0; shY = shake ? (Math.random() - .5) * shake : 0;
    bob += dt * (st.scene === 'play' ? 14 : 4);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBg();
    const top = Math.floor(cy) + 18, bot = Math.max(0, Math.floor(cy) - 10);
    for (let i = Math.min(top, xs.length - 1); i >= bot; i--) drawStair(i);
    parts = parts.filter(p => (p.t += dt) < .35);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (const p of parts) { ctx.globalAlpha = 1 - p.t / .35; ctx.beginPath(); ctx.arc(sx(p.x + p.vx * p.t), sy(p.y + p.vy * p.t), 3, 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (fall) { fall.vy += dt * 9; fall.x += fall.vx * dt; fall.y -= fall.vy * dt; fall.r += dt * 9 * Math.sign(fall.vx); drawKid(sx(fall.x * DX), sy(-fall.y * DY), st.face, 0, fall.r); }
    else drawKid(sx(cx * DX), sy(-cy * DY) + 2 - (moveT < 1 ? Math.sin(moveT * Math.PI) * 8 : 0), st.face, bob);
    pops = pops.filter(p => (p.t += dt) < 1.3);
    for (const p of pops) {
      const a = p.t < .15 ? p.t / .15 : p.t > 1 ? (1.3 - p.t) / .3 : 1, s = 1 + (p.t < .15 ? (1 - p.t / .15) * .5 : 0);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H * .36 - p.t * 14); ctx.scale(s, s);
      ctx.font = '400 30px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(p.s, 0, 0); ctx.fillStyle = '#ffd25e'; ctx.fillText(p.s, 0, 0); ctx.restore();
    }
    drawHud();
  }
  const vis = () => { if (document.hidden) pause(); };
  const blur = () => pause();
  document.addEventListener('visibilitychange', vis); window.addEventListener('blur', blur);
  size(); reset(); raf = requestAnimationFrame(frame);
  return {
    st, input, reset, pause,
    setSound(v) { sound = !!v; if (v) beep(660, .05); },
    destroy() { alive = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', blur); try { ac?.close(); } catch {} },
    get xs() { return xs; },   // 테스트용(정답 방향 확인)
    W, H,
  };
}
