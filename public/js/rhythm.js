// SVMHS GROUND — 방송실 리듬 배틀(2026-11-02 하율: "프라이데이 나이트 펌킨 방식 — 내 화면에만", 미리보기 깃발 rhythm-game)
// FNF는 방식만(4방향·상대가 먼저 부르고 내가 따라 부르기). 이름·캐릭터·노래는 새로 만듦. 노래는 Web Audio로 직접 합성(외부 음원 없음).
// 시험판 — 서버·랭킹·티어 없이 이 기기 최고 정확도만(sg_rb_best). 박자 보정은 기기마다(sg_rb_off, ms).
// createRhythm(el, O) → { start, destroy }
import { store } from './util.js';

const BPM = 128, SPB = 60 / BPM, INTRO = 8, APPROACH = 1.25;
const COL = ['#8b6cff', '#1fb5ee', '#2fc56a', '#ff5468'];
const ROT = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const ROOT = [57, 53, 48, 55], MIN = [1, 0, 0, 0];   // Am F C G
const PAT = [   // 섹션 16박 패턴 [박, 칸, 길게 누르는 박]
  [[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [6, 0], [8, 0], [9, 1], [10, 3], [11, 2], [12, 1, 2]],
  [[0, 1], [0.5, 2], [1, 1], [2, 3], [2.5, 2], [3, 0], [4, 0, 1.5], [6, 3], [6.5, 2], [7, 1], [8, 2], [8.5, 1], [9, 0], [10, 3, 1], [12, 1], [12.5, 2], [13, 3], [14, 0, 1.5]],
  [[0, 0], [0.5, 1], [1, 2], [1.5, 3], [2, 2], [2.5, 1], [3, 0], [4, 3], [5, 3], [5.5, 2], [6, 0], [7, 1], [8, 0], [8.5, 0], [9, 3], [9.5, 3], [10, 1, 1], [12, 2], [12.5, 1], [13, 2], [13.5, 3], [14, 0, 1.5]],
  [[0, 0], [0, 3], [1, 1], [1.5, 2], [2, 1], [2.5, 2], [3, 0], [3, 3], [4, 1, 1], [5.5, 2], [6, 3], [6.5, 0], [7, 3], [8, 0], [8.5, 1], [9, 2], [9.5, 3], [10, 2], [10.5, 1], [11, 0], [12, 1], [12, 2], [13, 0], [13, 3], [14, 1, 1.5]],
];
const JN = ['완벽!', '좋아', '괜찮아', '놓침'], JA = [100, 70, 40, 0], JH = [.03, .02, .01, -.07], JC = ['#ffd84a', '#7ee0ff', '#b9f27c', '#ff6b7a'];
const FONT = 'Jua, system-ui, sans-serif';

function buildChart() {
  const notes = []; let b = INTRO;
  for (const p of PAT) for (const who of [0, 1]) { for (const n of p) notes.push({ beat: b + n[0], lane: n[1], hb: n[2] || 0, who }); b += 16; }
  notes.sort((x, y) => x.beat - y.beat || x.lane - y.lane);
  for (const n of notes) { n.t = n.beat * SPB; n.d = n.hb * SPB; const bar = Math.floor(n.beat / 4) % 4; n.m = ROOT[bar] + 12 + [0, MIN[bar] ? 3 : 4, 7, 12][n.lane]; }
  return { notes, end: b };
}

export function createRhythm(el, O = {}) {
  el.innerHTML = `<div class="rb"><div class="rb-wrap"><canvas class="rb-cv"></canvas><div class="rb-ov"></div>
    <button type="button" class="rb-pz" hidden aria-label="일시정지">Ⅱ</button></div>
    <div class="rb-bar">아래 4칸 터치 · 키보드 D F J K / ← ↓ ↑ → · 긴 화살표는 끝까지 누르기 · Esc 멈춤</div></div>`;
  const wrap = el.querySelector('.rb-wrap'), cv = el.querySelector('.rb-cv'), cx = cv.getContext('2d'), ov = el.querySelector('.rb-ov'), pz = el.querySelector('.rb-pz');
  const { notes, end: SONG_END } = buildChart();
  const PN = notes.filter(n => n.who === 1), ON = notes.filter(n => n.who === 0);
  const byLane = [0, 1, 2, 3].map(l => PN.filter(n => n.lane === l));
  let W = 0, H = 0, alive = true, raf = 0;

  /* ── 크기 ── */
  function fit() {
    const w = Math.min(el.clientWidth || 360, 960), top = wrap.getBoundingClientRect().top;
    const h = Math.max(440, Math.min(780, innerHeight - Math.max(0, top) - 56, w * 1.6));
    const d = Math.min(2, devicePixelRatio || 1); W = w; H = Math.round(h);
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cx.setTransform(d, 0, 0, d, 0, 0);
  }

  /* ── 소리(직접 합성) ── */
  let AC = null, NB = null, master = null, auto = 0;
  function initAudio() {
    if (AC) return; AC = new (window.AudioContext || window.webkitAudioContext)();
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function newMaster() {
    if (master) try { master.disconnect(); } catch {}
    master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
    auto = (AC.outputLatency || 0) + (AC.baseLatency || 0);
  }
  const env = (g, at, pk, dec) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(pk, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + dec); };
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function osc(type, f, at, pk, dec) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; env(g, at, pk, dec); o.connect(g).connect(master); o.start(at); o.stop(at + dec + 0.03); return o; }
  function kick(at) { const o = osc('sine', 150, at, 0.9, 0.24); o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.12); }
  function noise(at, type, f, pk, dec) { const s = AC.createBufferSource(); s.buffer = NB; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = AC.createGain(); env(g, at, pk, dec); s.connect(fl).connect(g).connect(master); s.start(at, Math.random() * 0.5); s.stop(at + dec + 0.03); }
  const snare = at => { noise(at, 'bandpass', 1800, 0.55, 0.16); osc('triangle', 190, at, 0.25, 0.08); };
  const hat = (at, v) => noise(at, 'highpass', 7500, v, 0.045);
  const click = (at, acc) => osc('sine', acc ? 1600 : 1050, at, 0.5, 0.06);
  function bass(at, m, dur) {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = mf(m); f.type = 'lowpass'; f.frequency.value = 520;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.26, at + 0.01); g.gain.setValueAtTime(0.26, at + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(master); o.start(at); o.stop(at + dur + 0.02);
  }
  const stab = (at, r, mn) => { osc('triangle', mf(r + 12 + (mn ? 3 : 4)), at, 0.05, 0.16); osc('triangle', mf(r + 19), at, 0.05, 0.16); };
  function voice(at, m, dur, kind) {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
    o.type = kind ? 'triangle' : 'square'; o.frequency.value = mf(m); lfo.frequency.value = 5.5; lg.gain.value = mf(m) * 0.012; lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = kind ? 3200 : 1700; const len = Math.max(dur, 0.17), pk = kind ? 0.34 : 0.15;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(pk, at + 0.015); g.gain.setValueAtTime(pk * 0.8, at + len - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.07);
    o.connect(f).connect(g).connect(master); o.start(at); lfo.start(at); o.stop(at + len + 0.09); lfo.stop(at + len + 0.09); return g;
  }
  const EV = [];
  for (let bt = 0; bt <= SONG_END; bt++) {
    const t = bt * SPB, bar = Math.floor(bt / 4), r = ROOT[bar % 4], mn = MIN[bar % 4], q = bt % 4;
    if (bt < 4) { EV.push({ t, f: at => click(at, q === 0) }); continue; }
    if (bt === SONG_END) { EV.push({ t, f: at => { kick(at); noise(at, 'highpass', 5000, 0.3, 1.3); bass(at, 45, SPB * 3); } }); continue; }
    EV.push({ t, f: q === 0 || q === 2 ? kick : snare });
    EV.push({ t, f: at => hat(at, 0.12) }); EV.push({ t: t + SPB / 2, f: at => hat(at, 0.07) });
    if (bt >= INTRO) { EV.push({ t, f: at => bass(at, r - 12, SPB * 0.45) }); EV.push({ t: t + SPB / 2, f: at => bass(at, r, SPB * 0.4) }); EV.push({ t: t + SPB / 2, f: at => stab(at, r, mn) }); }
  }
  for (const n of ON) EV.push({ t: n.t, f: at => voice(at, n.m, n.d, 0) });
  EV.sort((a, b) => a.t - b.t);

  /* ── 상태 ── */
  let state = 'menu', t0 = 0, evI = 0, oI = 0, off = +store.get('rb_off', 0) || 0;
  let hp = .5, combo = 0, maxCombo = 0, cnt = [0, 0, 0, 0], accSum = 0, accN = 0, pop = null, failed = false;
  let pose = [{ l: -1, end: 0 }, { l: -1, end: 0 }];
  const held = [0, 0, 0, 0], holdN = [null, null, null, null], flash = [0, 0, 0, 0];
  const songT = () => AC.currentTime - t0 - auto - off / 1000;
  const acc = () => accN ? accSum / accN : 100;

  /* ── 안내 창(칸 안) ── */
  function card(html) { ov.innerHTML = html ? `<div class="bl-card rb-card">${html}</div>` : ''; ov.hidden = !html; pz.hidden = !(state === 'play' && !html); }
  function menu() {
    state = 'menu'; const b = store.get('rb_best', 0);
    card(`<b class="bl-t">방송실 리듬 배틀</b><p class="bl-sub">시험판 · 「쉬는 시간 10분 전」 약 1분</p>
      <p class="rb-p">선배가 먼저 부른 화살표를<br>내 차례에 그대로 따라 누르세요</p>
      <button type="button" class="btn big" data-rb="start">시작</button>
      <button type="button" class="btn ghost" data-rb="cal">박자 보정 (${off > 0 ? '+' : ''}${off}ms)</button>
      ${b ? `<p class="bl-note">내 최고 정확도 ${b}%</p>` : ''}<p class="bl-note">블루투스 이어폰이면 보정을 먼저 해 주세요</p>`);
  }
  ov.addEventListener('click', e => {
    const k = e.target.closest('[data-rb]')?.dataset.rb; if (!k) return;
    if (k === 'start' || k === 'again') start(); else if (k === 'cal') openCal(); else if (k === 'menu') toMenu();
    else if (k === 'go') resume(); else if (k === 'cdone') calDone();
  });
  ov.addEventListener('pointerdown', e => { if (e.target.closest('.rb-tap')) { e.preventDefault(); calTap(); } });
  pz.onclick = pause;

  function start() {
    initAudio(); AC.resume(); newMaster();
    for (const n of notes) { n.st = 0; n.vo = null; }
    hp = .5; combo = 0; maxCombo = 0; cnt = [0, 0, 0, 0]; accSum = 0; accN = 0; pop = null; failed = false;
    pose = [{ l: -1, end: 0 }, { l: -1, end: 0 }]; holdN.fill(null); held.fill(0);
    t0 = AC.currentTime + 0.5; evI = 0; oI = 0; state = 'play'; card('');
  }
  function toMenu() { if (AC) { AC.resume(); newMaster(); } menu(); }
  function judge(j) {
    cnt[j]++; accSum += JA[j]; accN++;
    if (j < 3) { combo++; if (combo > maxCombo) maxCombo = combo; } else combo = 0;
    hp = Math.max(0, Math.min(1, hp + JH[j])); pop = { j, t: performance.now() };
    if (hp <= 0) { failed = true; finish(); }
  }
  function tailOk() { cnt[0]++; accSum += 100; accN++; combo++; if (combo > maxCombo) maxCombo = combo; }
  function down(l) {
    if (state !== 'play') return; held[l] = 1; const T = songT();
    let best = null; for (const n of byLane[l]) { if (n.st !== 0) continue; if (n.t - T > 0.135) break; if (Math.abs(T - n.t) <= 0.135) { best = n; break; } }
    if (!best) return;   // 빈 누르기는 감점 없음
    const a = Math.abs(T - best.t) * 1000, j = a <= 45 ? 0 : a <= 90 ? 1 : 2; judge(j); if (state !== 'play') return;
    flash[l] = 1; best.vo = voice(AC.currentTime, best.m, best.d > 0 ? best.t + best.d - T : 0.2, 1);
    pose[1] = { l, end: T + Math.max(best.d, 0.3) };
    if (best.d > 0) { best.st = 1; holdN[l] = best; } else best.st = 2;
  }
  function up(l) {
    held[l] = 0; const n = holdN[l]; if (!n) return; holdN[l] = null; if (state !== 'play') return; const T = songT();
    if (T >= n.t + n.d - 0.15) { n.st = 2; tailOk(); }
    else { n.st = 3; judge(3); pose[1].end = T; if (n.vo) { const now = AC.currentTime; n.vo.gain.cancelScheduledValues(now); n.vo.gain.setTargetAtTime(0.0001, now, 0.03); } }
  }
  function update(T) {
    const now = AC.currentTime;
    while (evI < EV.length && t0 + EV[evI].t < now + 0.25) { const e = EV[evI++], at = t0 + e.t; if (at >= now - 0.03) e.f(Math.max(at, now)); }
    while (oI < ON.length && T >= ON[oI].t) { const n = ON[oI++]; pose[0] = { l: n.lane, end: n.t + Math.max(n.d, SPB * 0.75) }; }
    for (const n of PN) { if (n.t - T > 0.2) break; if (n.st === 0 && T - n.t > 0.135) { n.st = 3; judge(3); if (n.d > 0) { cnt[3]++; accN++; } if (state !== 'play') return; } }
    for (let l = 0; l < 4; l++) { const n = holdN[l]; if (n && T >= n.t + n.d) { n.st = 2; holdN[l] = null; tailOk(); } }
    if (T > SONG_END * SPB + 1.2) finish();
  }
  function finish() {
    if (state !== 'play') return; state = 'result';
    if (master) master.gain.setTargetAtTime(0.0001, AC.currentTime + (failed ? 0 : 0.8), 0.3);
    const a = acc(), af = a.toFixed(2); let sub = '최대 콤보 ' + maxCombo;
    if (!failed && a > (+store.get('rb_best', 0) || 0)) { store.set('rb_best', af); sub += ' · 최고 기록 갱신!'; }
    card(`<b class="bl-t">${failed ? '체력이 다 떨어졌어요' : '완주!'}</b><p class="bl-sc">${af}%</p><p class="bl-sub">${sub}</p>
      <div class="rb-res">${JN.map((n, i) => `<span><b>${n.replace('!', '')}</b>${cnt[i]}</span>`).join('')}</div>
      <button type="button" class="btn big" data-rb="again">다시 하기</button><button type="button" class="btn ghost" data-rb="menu">처음 화면</button>`);
  }
  function pause() {
    if (state !== 'play') return; state = 'pause'; for (let l = 0; l < 4; l++) if (holdN[l]) up(l); held.fill(0); AC.suspend();
    card('<b class="bl-t">잠깐 멈춤</b><button type="button" class="btn big" data-rb="go">계속하기</button><button type="button" class="btn ghost" data-rb="again">처음부터</button><button type="button" class="btn ghost" data-rb="menu">처음 화면</button>');
  }
  function resume() { if (state !== 'pause') return; AC.resume().then(() => { if (state === 'pause') { state = 'play'; card(''); } }); }

  /* ── 박자 보정 ── */
  const cal = { c0: 0, taps: [], v: null };
  function openCal() {
    initAudio(); AC.resume(); newMaster(); state = 'calib'; cal.c0 = AC.currentTime + 0.8; cal.taps = []; cal.v = null;
    for (let i = 0; i < 24; i++) click(cal.c0 + i * 0.5, i % 4 === 0);
    card(`<b class="bl-t">박자 보정</b><p class="bl-sub">'딱' 소리에 맞춰 노란 원을 8번 이상 (키보드는 스페이스)</p>
      <div class="rb-tap">딱!</div><p class="bl-sub rb-ci"></p>
      <button type="button" class="btn ghost" data-rb="cal">다시 측정</button><button type="button" class="btn big" data-rb="cdone">저장하고 돌아가기</button>`);
    calInfo();
  }
  function calTap() {
    if (state !== 'calib') return; const now = AC.currentTime - auto, k = Math.round((now - cal.c0) / 0.5); if (k < 0 || k > 23) return;
    cal.taps.push(now - (cal.c0 + k * 0.5)); const c = ov.querySelector('.rb-tap'); c?.classList.add('hit'); setTimeout(() => c?.classList.remove('hit'), 90); calInfo();
  }
  function calInfo() {
    const n = cal.taps.length; if (n >= 4) { const s = cal.taps.slice(-8).sort((a, b) => a - b); cal.v = Math.round(s[s.length >> 1] * 1000); }
    const e = ov.querySelector('.rb-ci'); if (e) e.textContent = n < 4 ? `소리에 맞춰 눌러 주세요 (${n}/8)` : `측정값 ${cal.v > 0 ? '+' : ''}${cal.v}ms (${Math.min(n, 8)}/8)`;
  }
  function calDone() { if (cal.v !== null && cal.taps.length >= 8) { off = Math.max(-300, Math.min(400, cal.v)); store.set('rb_off', off); } toMenu(); }

  /* ── 입력 ── */
  const ptr = new Map();
  const laneAt = x => Math.max(0, Math.min(3, Math.floor(x / (W / 4))));
  const pDown = e => { e.preventDefault(); const r = cv.getBoundingClientRect(), l = laneAt(e.clientX - r.left); ptr.set(e.pointerId, l); down(l); };
  const pEnd = e => { const l = ptr.get(e.pointerId); if (l === undefined) return; ptr.delete(e.pointerId); for (const v of ptr.values()) if (v === l) return; up(l); };
  const kDown = e => {
    if (state === 'calib' && e.code === 'Space') { e.preventDefault(); if (!e.repeat) calTap(); return; }
    if (e.code === 'Escape') { if (state === 'play') pause(); else if (state === 'pause') resume(); return; }
    const l = KEYS[e.code]; if (l === undefined || state !== 'play') return; e.preventDefault(); e.stopPropagation(); if (!e.repeat) down(l);
  };
  const kUp = e => { const l = KEYS[e.code]; if (l !== undefined) up(l); };
  const vis = () => { if (document.hidden) pause(); };
  const blur = () => { if (state === 'play') for (let l = 0; l < 4; l++) if (held[l]) up(l); };
  cv.addEventListener('pointerdown', pDown); cv.addEventListener('pointerup', pEnd); cv.addEventListener('pointercancel', pEnd);
  document.addEventListener('keydown', kDown, true); document.addEventListener('keyup', kUp, true);
  document.addEventListener('visibilitychange', vis); addEventListener('blur', blur); addEventListener('resize', fit);

  /* ── 그리기 ── */
  function layout() {
    const land = W > H * 1.05, lw = Math.min((land ? Math.min(W * 0.5, 520) : W * 0.94) / 4, 110);
    const padH = Math.min(100, H * 0.14), ry = H - padH - lw * 0.6, top = land ? 64 : H * 0.34; return { land, lw, lx0: W / 2 - lw * 2, ry, top, padH };
  }
  function ink(fill, wo) { cx.lineJoin = 'round'; cx.lineCap = 'round'; cx.strokeStyle = '#fff'; cx.lineWidth = wo * 2.4; cx.stroke(); cx.strokeStyle = '#2a2846'; cx.lineWidth = wo; cx.stroke(); cx.fillStyle = fill; cx.fill(); }
  function arrow(x, y, s, rot, fill, alpha = 1) {
    cx.save(); cx.globalAlpha = alpha; cx.translate(x, y); cx.rotate(rot); cx.beginPath();
    cx.moveTo(0, -s); cx.lineTo(s * 0.92, -s * 0.04); cx.lineTo(s * 0.4, -s * 0.04); cx.lineTo(s * 0.4, s * 0.86); cx.lineTo(-s * 0.4, s * 0.86); cx.lineTo(-s * 0.4, -s * 0.04); cx.lineTo(-s * 0.92, -s * 0.04); cx.closePath();
    ink(fill, Math.max(2, s * 0.13)); cx.restore();
  }
  function rr(x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else cx.rect(x, y, w, h); }
  function drawChar(x, y, s, body, hair, face, p, T, bob, name) {
    const on = p.l >= 0 && T < p.end, dx = on ? [-1, 0, 0, 1][p.l] : 0, dy = on ? [0, 1, -1, 0][p.l] : 0;
    cx.save(); cx.translate(x + dx * s * 0.14, y + dy * s * 0.1 - bob * s * 0.06);
    rr(-s * 0.42, -s * 0.08, s * 0.84, s * 0.86, s * 0.3); ink(body, 3.5);
    cx.beginPath(); cx.arc(face * s * 0.5, -s * 0.05 + (on ? -s * 0.15 : 0), s * 0.11, 0, 7); ink('#3a3a4a', 2.5);   // 마이크
    cx.beginPath(); cx.arc(0, -s * 0.4, s * 0.38, 0, 7); ink('#ffe0c2', 3.5);
    cx.beginPath(); cx.arc(0, -s * 0.42, s * 0.39, Math.PI * 1.02, Math.PI * 1.98); cx.closePath(); cx.fillStyle = hair; cx.fill(); cx.strokeStyle = '#2a2846'; cx.lineWidth = 2.5; cx.stroke();
    const ex = dx * s * 0.07 + face * s * 0.04, ey = dy * s * 0.05; cx.fillStyle = '#2a2846';
    cx.beginPath(); cx.arc(-s * 0.13 + ex, -s * 0.36 + ey, s * 0.045, 0, 7); cx.arc(s * 0.13 + ex, -s * 0.36 + ey, s * 0.045, 0, 7); cx.fill();
    cx.beginPath(); if (on) { cx.ellipse(ex, -s * 0.2 + ey, s * 0.08, s * 0.07, 0, 0, 7); cx.fill(); } else { cx.lineWidth = 2.5; cx.moveTo(-s * 0.07 + ex, -s * 0.2); cx.lineTo(s * 0.07 + ex, -s * 0.2); cx.stroke(); }
    cx.restore();
    if (on) arrow(x, y - s * 1.05, s * 0.2, ROT[p.l], COL[p.l]);
    cx.font = Math.max(12, s * 0.18) + 'px ' + FONT; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.fillText(name, x, y + s * 1.12);
  }
  function txt(t, x, y, size, fill) {
    cx.font = size + 'px ' + FONT; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
    cx.strokeStyle = '#2a2846'; cx.lineWidth = size * 0.22; cx.strokeText(t, x, y); cx.fillStyle = fill; cx.fillText(t, x, y); cx.textBaseline = 'alphabetic';
  }
  function render(T) {
    const L = layout(), playing = T !== null;
    const bf = playing ? T / SPB : performance.now() / 1000 / SPB, pulse = playing && T > 0 ? Math.max(0, 1 - (bf % 1) * 3) : 0;
    const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#24306a'); g.addColorStop(1, '#121838'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) { cx.fillStyle = `rgba(120,160,255,${0.05 + pulse * 0.05})`; cx.beginPath(); cx.arc(W * (0.2 + i * 0.3), H * 0.05, Math.min(W, H) * 0.35, 0, 7); cx.fill(); }
    const bob = Math.abs(Math.sin(Math.PI * bf));
    let s, y, xa, xb; if (L.land) { s = Math.min(L.lx0 * 0.5, H * 0.26); y = H * 0.52; xa = L.lx0 / 2; xb = W - L.lx0 / 2; } else { s = Math.min(H * 0.1, W * 0.2); y = H * 0.17; xa = W * 0.27; xb = W * 0.73; }
    if (s > 18) { drawChar(xa, y, s, '#8b6cff', '#3b2a7a', 1, pose[0], playing ? T : 0, bob, '방송부 선배'); drawChar(xb, y, s, '#3d7bff', '#1d1d2b', -1, pose[1], playing ? T : 0, bob, '나'); }
    for (let l = 0; l < 4; l++) { cx.fillStyle = l % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.06)'; cx.fillRect(L.lx0 + l * L.lw, L.top, L.lw, L.ry - L.top + L.lw * 0.6); }
    for (let l = 0; l < 4; l++) {
      const x = L.lx0 + (l + .5) * L.lw, sc = held[l] ? 0.88 : 1; flash[l] = Math.max(0, flash[l] - 0.08);
      arrow(x, L.ry, L.lw * 0.36 * sc, ROT[l], held[l] || flash[l] > 0 ? COL[l] : '#2b3266');
      if (flash[l] > 0) { cx.globalAlpha = flash[l] * 0.5; cx.fillStyle = COL[l]; cx.beginPath(); cx.arc(x, L.ry, L.lw * 0.6 * (1.4 - flash[l] * 0.4), 0, 7); cx.fill(); cx.globalAlpha = 1; }
    }
    if (playing) {
      const spd = (L.ry - L.top) / APPROACH; cx.save(); cx.beginPath(); cx.rect(0, L.top, W, H); cx.clip();
      for (const n of PN) {
        const dt = n.t - T; if (dt > APPROACH + 0.15) break; if (n.st === 2) continue; if (n.st === 3 && -dt > 0.5 && -(dt + n.d) > 0.5) continue;
        const x = L.lx0 + (n.lane + .5) * L.lw, yh = n.st === 1 ? L.ry : L.ry - dt * spd, al = n.st === 3 ? 0.3 : 1;
        if (n.d > 0) { const ye = L.ry - (dt + n.d) * spd; if (ye < yh) { cx.globalAlpha = al * 0.85; rr(x - L.lw * 0.13, ye, L.lw * 0.26, yh - ye, L.lw * 0.13); cx.fillStyle = COL[n.lane]; cx.fill(); cx.strokeStyle = '#2a2846'; cx.lineWidth = 3; cx.stroke(); cx.globalAlpha = 1; } }
        if (n.st !== 1) arrow(x, yh, L.lw * 0.36, ROT[n.lane], COL[n.lane], al);
      }
      cx.restore();
      if (pop) { const age = (performance.now() - pop.t) / 1000; if (age < 0.6) { cx.globalAlpha = 1 - age / 0.6; txt(JN[pop.j], W / 2, L.ry - L.lw * 1.5 - age * 30, L.lw * 0.42, JC[pop.j]); cx.globalAlpha = 1; } }
      if (combo >= 5) txt(combo + ' 콤보', W / 2, L.ry - L.lw * 1.05, L.lw * 0.26, '#fff');
      const beat = T / SPB;
      if (beat >= 4 && beat < INTRO) txt(['3', '2', '1', '선배 먼저!'][Math.floor(beat) - 4], W / 2, (L.top + L.ry) / 2, L.lw * 0.7, '#fff');
      else if (beat >= INTRO && beat < SONG_END) {
        const sec = Math.floor((beat - INTRO) / 16), inS = (beat - INTRO) % 16, who = sec % 2;
        txt(who ? '내 차례!' : inS >= 12 ? '곧 내 차례 ▶' : '선배 차례 — 보고 기억하기', W / 2, L.land ? L.top - 12 : L.top - 16, Math.min(22, W * 0.05), who ? '#ffd84a' : '#cbd3ff');
      }
      const bw = L.lw * 4, by = L.land ? 10 : L.top + 8;
      rr(L.lx0, by, bw, 12, 6); cx.fillStyle = '#2b3266'; cx.fill();
      rr(L.lx0, by, Math.max(6, bw * hp), 12, 6); cx.fillStyle = hp < 0.25 ? '#ff5468' : '#3d7bff'; cx.fill();
      rr(L.lx0, by, bw, 12, 6); cx.strokeStyle = '#2a2846'; cx.lineWidth = 2.5; cx.stroke();
      cx.font = '14px ' + FONT; cx.textAlign = 'right'; cx.fillStyle = '#fff'; cx.fillText(acc().toFixed(2) + '%', L.lx0 + bw, by + 30);
    }
    const pw = W / 4;
    for (let l = 0; l < 4; l++) {
      rr(l * pw + 4, H - L.padH + 4, pw - 8, L.padH - 8, 14); cx.fillStyle = held[l] ? COL[l] + '88' : 'rgba(255,255,255,.07)'; cx.fill(); cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.lineWidth = 2; cx.stroke();
      arrow(l * pw + pw / 2, H - L.padH / 2, Math.min(L.padH * 0.24, pw * 0.2), ROT[l], COL[l], 0.9);
    }
  }
  function frame() {
    if (!alive) return; raf = requestAnimationFrame(frame); let T = null;
    if (state === 'play') { T = songT(); update(T); if (state === 'result') T = songT(); }
    else if ((state === 'pause' || state === 'result') && AC) T = songT();
    render(T);
  }

  return {
    start() { fit(); menu(); frame(); },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', kDown, true); document.removeEventListener('keyup', kUp, true);
      document.removeEventListener('visibilitychange', vis); removeEventListener('blur', blur); removeEventListener('resize', fit);
      if (AC) AC.close().catch(() => {});
    },
  };
}
