// SVMHS GROUND — 방송실 리듬 배틀(2026-11-02 하율: "프라이데이 나이트 펌킨 방식", 미리보기 깃발 rhythm-game)
// 2차(같은 날 하율 "디벨롭 — 바로 출시해도 될 정도로, FNF를 많이 참고"): FNF의 구조를 따름 —
//   스토리 모드(방송부 주간 3곡 연속)·자유 플레이·난이도 3단(노트 수·속도)·상대/내 화살표 줄·카메라가 부르는 사람 쪽으로·마디마다 줌 쿵
//   아래 체력 바 + 얼굴 아이콘(박자마다 통통, 지면 울상)·판정 4단(완벽/좋아/아쉬워/별로)+콤보 숫자·완벽 판정 물보라·놓치면 내 캐릭터가 파랗게
//   카운트다운 3·2·1·가자·Enter/Esc 멈춤·게임 오버·결과 등급·설정(아래로 스크롤·가운데 보기·빈 누르기 허용·타격음·박자 보정)
// 이름·캐릭터·노래·그림은 전부 새로 만듦(FNF 에셋 안 씀). 노래는 Web Audio 합성 — 멜로디(음 단계)가 곧 채보(단계 % 4 = 화살표)
// 서버·랭킹 없음(랭크 규칙은 하율 결정 대기) → 이 기기 기록만: sg_rb_rec(곡_난이도 최고 점수·정확도) · sg_rb_week · sg_rb_opt · sg_rb_off(ms)
// createRhythm(el, O) → { start, destroy }
import { store } from './util.js';

const FONT = 'Jua, system-ui, sans-serif', INK = '#2a2846';
const COL = ['#b07cff', '#3fc4f2', '#3ed27a', '#ff5d72'];
const ROT = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, KeyA: 0, KeyS: 1, KeyW: 2 };
const DIFFS = [{ n: '쉬움', sp: 1.0, miss: .016 }, { n: '보통', sp: 1.2, miss: .021 }, { n: '어려움', sp: 1.45, miss: .025 }];
// 판정(FNF 창: 45/90/135/166ms)
const RATE = [
  { n: '완벽!', ms: 45, sc: 350, hp: .0115, w: 1, c: '#ffd84a' },
  { n: '좋아', ms: 90, sc: 200, hp: .0115, w: .7, c: '#7ee0ff' },
  { n: '아쉬워', ms: 135, sc: 100, hp: .004, w: .4, c: '#b9f27c' },
  { n: '별로', ms: 166, sc: 50, hp: 0, w: .15, c: '#ffb27a' },
];
const MAJ = [0, 2, 4, 5, 7, 9, 11], MINS = [0, 2, 3, 5, 7, 8, 10];
const CH = {
  me: { name: '나', body: '#3d7bff', body2: '#2b5fd6', pants: '#2a2f55', hair: '#1d1d2b', skin: '#ffdcbc', hs: 'short', acc: 'cap', capC: '#ffd84a', wave: 'triangle' },
  sb: { name: '방송부 선배', body: '#9a6cff', body2: '#7a4fe0', pants: '#33285a', hair: '#3b2a7a', skin: '#ffdcbc', hs: 'bob', acc: 'headset', capC: '#3a3d5c', wave: 'square' },
  bj: { name: '방송부장', body: '#e0465a', body2: '#b8323f', pants: '#2a2238', hair: '#2a1a1a', skin: '#f7d2b0', hs: 'spike', acc: 'glasses', capC: '#2a2238', wave: 'sawtooth' },
};
const GREY = { body: '#6d7fbd', body2: '#56669f', pants: '#3a4270', hair: '#2d3460', skin: '#c7cfee', capC: '#8d9ad0' };
const DRUMS = {
  basic: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', b: 'x.....x.x.......' },
  synco: { k: 'x.....x...x.....', s: '....x.......x..x', h: 'x.xxx.x.x.xxx.x.', b: 'x..x..x...x..x..' },
  drive: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', b: 'x.x.x.x.x.x.x.x.' },
};
// 곡: sec = I(전주 2마디) · O/P(선배/나 4마디) · X(1마디씩 주고받기) · E(마무리 1마디), 글자 = 프레이즈. 프레이즈 = '박,음 단계[,길게 누르는 박]'
const SONGS = [
  { id: 's1', name: '쉬는 시간 10분 전', opp: 'sb', bpm: 120, root: 69, sc: MINS, prog: [0, -4, 3, -2], q: [0, 1, 1, 1], drum: 'basic', pad: 1, arp: 0,
    sec: 'I Oa Pa Ob Pb Oc Pc Xd Od Pd E',
    ph: ['0,0 1,2 2,4 3,2 4,3 5,2 6,1 8,0 9,2 10,4 11,5 12,4,2 14,2 15,1',
      '0,4 0.5,3 1,2 2,4 2.5,5 3,4 4,2,1.5 6,0 6.5,1 7,2 8,4 9,5 10,6,1 12,5 12.5,4 13,3 14,2,1.5',
      '0,0 0.5,1 1,2 1.5,3 2,4 3,2 4,5 5,4 5.5,3 6,2 7,1 8,0 8.5,2 9,4 9.5,6 10,7,1 12,6 12.5,5 13,4 13.5,3 14,4,1.5',
      '0,7 1,6 1.5,5 2,4 3,4 3.5,5 4,6,1 6,4 6.5,2 7,0 8,1 8.5,2 9,3 10,4 10.5,5 11,6 12,7,1 14,4 15,0'] },
  { id: 's2', name: '급식 줄 서기', opp: 'sb', bpm: 140, root: 65, sc: MAJ, prog: [0, 5, -3, -5], q: [1, 1, 0, 1], drum: 'synco', pad: 1, arp: 0,
    sec: 'I Oa Pa Ob Pb Oc Pc Od Pd Xb E',
    ph: ['0,0 0.75,2 1.5,4 2.5,2 3,1 4,0 4.75,2 5.5,4 6,5,1 8,4 8.5,3 9,2 9.75,1 10.5,0 11,1 12,2,2 15,4',
      '0,5 0.5,4 1,2 1.5,4 2,5 3,7,1 4.5,5 5,4 5.5,2 6,0 7,2 8,4 8.75,5 9.5,4 10,2 10.75,1 11.5,0 12,2 12.5,3 13,4,2',
      '0,0 0,3 1,1 1.5,2 2,3 2.5,2 3,1 4,4 4,1 5,5 5.5,4 6,3 6.5,4 7,5 8,7 8.5,6 9,5 9.5,4 10,3 10.5,2 11,1 11.5,0 12,4,1 13.5,2 14,0,1.5',
      '0,2 0.5,2 1,4 1.5,4 2,5 2.75,4 3.5,2 4,0,1 6,4 6.5,5 7,7 8,6 8.5,5 9,4 9.5,3 10,2 10.5,3 11,4 11.5,5 12,7,2 15,0'] },
  { id: 's3', name: '종례 전 마지막 곡', opp: 'bj', bpm: 165, root: 62, sc: MINS, prog: [0, -4, -2, -5], q: [0, 1, 1, 1], drum: 'drive', pad: 1, arp: 1,
    sec: 'I Oa Pa Ob Pb Xc Oc Pc Od Pd Xd E',
    ph: ['0,0 0.5,0 1,2 1.5,0 2,3 2.5,0 3,4 3.5,3 4,2 4.5,0 5,2 5.5,4 6,7,1 7.5,6 8,4 8.5,4 9,5 9.5,4 10,3 10.5,2 11,1 11.5,2 12,0,2 14,4 14.5,5 15,6 15.5,7',
      '0,7 0.5,6 1,5 1.5,4 2,3 2.5,4 3,5 3.5,6 4,7,1 5.5,4 6,2 6.5,4 7,7 8,5 8.25,6 8.5,5 9,4 9.5,2 10,0 10.5,2 11,4 11.5,5 12,4 12.5,2 13,0 13.5,1 14,2,1.5',
      '0,0 0,3 1,1 1,2 2,0 2.5,1 3,2 3.5,3 4,4 4,7 5,5 5.5,6 6,4 6.5,5 7,6 7.5,7 8,0 8.5,2 8.75,3 9,4 9.5,6 10,7 10.5,6 11,4 11.5,2 12,3,1 13.5,1 14,0,1.5',
      '0,4 0.25,5 0.5,6 0.75,7 1,4 2,0 2.5,4 3,7 3.5,4 4,2 4.5,3 5,4 5.5,5 6,6 6.5,5 7,4 7.5,3 8,0 8,3 9,1 9,2 10,0 10,3 11,1 11,2 12,4,3 15,0'] },
];

// ── 채보 만들기 ──
function buildSong(S, diff) {
  const spb = 60 / S.bpm, raw = [], secs = []; let c = 0;
  const ph = S.ph.map(s => s.split(' ').map(t => t.split(',').map(Number)));
  for (const tok of S.sec.split(' ')) {
    const k = tok[0], p = ph[(tok.charCodeAt(1) || 97) - 97];
    if (k === 'I') { secs.push({ b0: c, b1: c + 8, who: 2 }); c += 8; continue; }
    if (k === 'E') { secs.push({ b0: c, b1: c + 4, who: 2 }); c += 4; continue; }
    if (k === 'O' || k === 'P') { const who = k === 'P' ? 1 : 0; for (const [b, d, l] of p) raw.push({ beat: c + b, d, l: l || 0, who }); secs.push({ b0: c, b1: c + 16, who }); }
    else for (const h of [0, 8]) {   // X: 선배 1마디 → 내가 같은 마디
      const bar = p.filter(n => n[0] >= h && n[0] < h + 4);
      for (const [b, d, l] of bar) { raw.push({ beat: c + b, d, l: Math.max(0, Math.min(l || 0, 3.5 - (b - h))), who: 0 }); raw.push({ beat: c + b + 4, d, l: Math.max(0, Math.min(l || 0, 3.5 - (b - h))), who: 1 }); }
      secs.push({ b0: c + h, b1: c + h + 4, who: 0 }, { b0: c + h + 4, b1: c + h + 8, who: 1 });
    }
    c += 16;
  }
  const lane = d => ((d % 4) + 4) % 4;
  const pitch = d => S.root + S.sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const out = [];
  for (const who of [0, 1]) {
    const list = raw.filter(n => n.who === who).sort((a, b) => a.beat - b.beat || a.d - b.d);
    const kept = []; let last = -9;
    for (const n of list) {   // 난이도: 어려움 = 전부 · 보통 = 16분 빼고 붙은 8분 하나 건너 · 쉬움 = 정박만(붙은 4분은 짝수 박만), 동시 누르기 없음
      const f = n.beat % 1;
      if (diff === 1) { if (f === .25 || f === .75) continue; if (f === .5 && n.beat - last < 1 && n.beat !== last) continue; }
      if (diff === 0) { if (f !== 0 || n.beat === last || (n.beat - last < 2 && n.beat % 2 !== 0)) continue; }
      kept.push(n); last = n.beat;
    }
    const prev = [null, null, null, null];
    for (const n of kept) {
      const o = { who, lane: lane(n.d), t: n.beat * spb, d: n.l * spb, m: pitch(n.d), beat: n.beat }, p = prev[o.lane];
      if (p) { if (o.t <= p.t + 0.01) continue; if (p.d > 0 && p.t + p.d > o.t - 0.12) { p.d = Math.max(0, o.t - 0.12 - p.t); if (p.d < 0.2) p.d = 0; } }
      out.push(o); prev[o.lane] = o;
    }
  }
  out.sort((a, b) => a.t - b.t || a.lane - b.lane);
  return { notes: out, secs, beats: c, spb };
}

export function createRhythm(el, O = {}) {
  const svgP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
  const svgF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  el.innerHTML = `<div class="rb"><div class="rb-wrap"><canvas class="rb-cv"></canvas><div class="rb-ov" hidden></div>
    <button type="button" class="rb-ib rb-pz" hidden aria-label="일시정지">${svgP}</button><button type="button" class="rb-ib rb-fs" aria-label="전체 화면">${svgF}</button></div>
    <div class="rb-bar">키보드 D F J K / ← ↓ ↑ → · 터치는 화면을 세로 4칸으로 나눠 누르기 · Enter·Esc 멈춤</div></div>`;
  const wrap = el.querySelector('.rb-wrap'), cv = el.querySelector('.rb-cv'), cx = cv.getContext('2d'), ov = el.querySelector('.rb-ov');
  const pz = el.querySelector('.rb-pz'), fsb = el.querySelector('.rb-fs');
  let W = 0, H = 0, DPR = 1, alive = true, raf = 0, lastF = 0, touchUI = false, bgC = null, bgK = 0;
  const opt = Object.assign({ down: false, mid: false, ghost: true, hits: false }, store.get('rb_opt', {}) || {});
  let off = +store.get('rb_off', 0) || 0, diff = +store.get('rb_diff', 1);
  if (!(diff >= 0 && diff <= 2)) diff = 1;
  const rec = store.get('rb_rec', {}) || {}, week = store.get('rb_week', {}) || {};

  /* ── 크기 ── */
  const isFs = () => (document.fullscreenElement || document.webkitFullscreenElement) === wrap;
  function fit() {
    let w, h;
    if (isFs()) { w = innerWidth; h = innerHeight; }
    else {
      w = Math.min(el.clientWidth || 360, 1400); const top = Math.max(8, wrap.getBoundingClientRect().top);
      h = Math.max(360, Math.min(1000, innerHeight - top - 34));
      if (w >= h * 1.05) { if (w / h > 16 / 9) w = h * 16 / 9; else h = Math.min(h, w * 10 / 16 > 360 ? w * 10 / 16 : h); }
      else h = Math.min(h, w * 1.75);
    }
    DPR = Math.min(2, devicePixelRatio || 1); W = Math.round(w); H = Math.round(h);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    bgC = null;
  }
  fsb.onclick = () => {
    try {
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap)?.catch?.(() => {});
    } catch {}
  };
  const onFs = () => setTimeout(fit, 60);

  /* ── 소리(직접 합성) ── */
  let AC = null, NB = null, master = null, auto = 0;
  function initAudio() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume().catch(() => {});
  }
  function newMaster() {
    if (master) try { master.disconnect(); } catch {}
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
    master = AC.createGain(); master.gain.value = 0.75; master.connect(comp);
    auto = (AC.outputLatency || 0) + (AC.baseLatency || 0);
  }
  const env = (g, at, pk, dec) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(pk, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + dec); };
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function osc(type, f, at, pk, dec) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; env(g, at, pk, dec); o.connect(g).connect(master); o.start(at); o.stop(at + dec + 0.03); return o; }
  function noise(at, type, f, pk, dec) { const s = AC.createBufferSource(); s.buffer = NB; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = AC.createGain(); env(g, at, pk, dec); s.connect(fl).connect(g).connect(master); s.start(at, Math.random() * 0.5); s.stop(at + dec + 0.03); }
  const kick = at => { const o = osc('sine', 150, at, 0.95, 0.26); o.frequency.setValueAtTime(155, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.12); };
  const snare = (at, v = .55) => { noise(at, 'bandpass', 1900, v, 0.16); osc('triangle', 190, at, v * .45, 0.08); };
  const hat = (at, v) => noise(at, 'highpass', 7600, v, 0.04);
  const crash = at => noise(at, 'highpass', 4800, 0.28, 1.4);
  const beep = (at, f) => { osc('square', f, at, 0.16, 0.16); osc('sine', f / 2, at, 0.25, 0.2); };
  function bassN(at, m, dur) {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = mf(m); f.type = 'lowpass'; f.frequency.value = 480;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3, at + 0.01); g.gain.setValueAtTime(0.3, at + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(master); o.start(at); o.stop(at + dur + 0.02);
  }
  function pad(at, r, q, dur) {
    const f = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.06, at + 0.12); g.gain.setValueAtTime(0.06, at + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    f.connect(g).connect(master);
    for (const s of [0, q ? 4 : 3, 7]) { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = mf(r + s); o.connect(f); o.start(at); o.stop(at + dur + 0.02); }
  }
  function pluck(at, m, dur) {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'square'; o.frequency.value = mf(m); f.type = 'lowpass'; f.frequency.setValueAtTime(2600, at); f.frequency.exponentialRampToValueAtTime(500, at + dur);
    env(g, at, 0.045, dur); o.connect(f).connect(g).connect(master); o.start(at); o.stop(at + dur + 0.03);
  }
  function voice(at, m, dur, wave) {   // 노래하는 목소리: 살짝 아래에서 올라가는 음 + 비브라토
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain(), fr = mf(m);
    o.type = wave; o.frequency.setValueAtTime(fr * 0.94, at); o.frequency.linearRampToValueAtTime(fr, at + 0.04);
    lfo.frequency.value = 5.6; lg.gain.value = fr * 0.013; lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = wave === 'triangle' ? 3400 : wave === 'square' ? 1800 : 1500;
    const len = Math.max(dur, 0.17), pk = wave === 'triangle' ? 0.34 : wave === 'square' ? 0.14 : 0.12;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(pk, at + 0.015); g.gain.setValueAtTime(pk * 0.8, at + len - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.07);
    o.connect(f).connect(g).connect(master); o.start(at); lfo.start(at); o.stop(at + len + 0.09); lfo.stop(at + len + 0.09); return g;
  }
  function missSnd() { if (!AC) return; const at = AC.currentTime; const o = osc('sawtooth', 160, at, 0.13, 0.2); o.frequency.exponentialRampToValueAtTime(70, at + 0.18); noise(at, 'lowpass', 600, 0.15, 0.1); }
  const hitSnd = () => { if (AC && opt.hits) osc('sine', 1800, AC.currentTime, 0.12, 0.05); };

  function arrange(S, B) {
    const ev = [], spb = B.spb, st = spb / 4, D = DRUMS[S.drum], bars = Math.ceil(B.beats / 4);
    for (let k = 0; k < 4; k++) ev.push({ t: (k - 4) * spb, f: at => beep(at, k === 3 ? 880 : 520) });
    for (let bar = 0; bar < bars; bar++) {
      const b0 = bar * 4 * spb, ci = bar % S.prog.length, r = S.root - 12 + S.prog[ci], q = S.q[ci];
      if (bar === bars - 1) { ev.push({ t: b0, f: at => { kick(at); crash(at); bassN(at, r - 12, spb * 3.5); pad(at, r, q, spb * 4); } }); continue; }
      const intro = bar < 2, fill = bar % 4 === 1 && bar > 2;
      if (bar >= 2 && bar % 4 === 2) ev.push({ t: b0, f: crash });
      for (let s = 0; s < 16; s++) {
        const t = b0 + s * st;
        if (D.k[s] === 'x' && (!intro || s % 8 === 0)) ev.push({ t, f: kick });
        if (fill && s >= 12) ev.push({ t, f: at => snare(at, 0.3 + 0.07 * (s - 12)) });
        else if (D.s[s] === 'x' && (!intro || bar === 1)) ev.push({ t, f: snare });
        if (D.h[s] === 'x') { const v = s % 4 === 0 ? 0.1 : 0.05; ev.push({ t, f: at => hat(at, v) }); }
        if (!intro && D.b[s] === 'x') { const m = r - 12 + (S.drum === 'drive' && s % 4 === 2 ? 12 : 0); ev.push({ t, f: at => bassN(at, m, st * 1.8) }); }
        if (S.arp && !intro && s % 2 === 0) { const m = r + 12 + [0, q ? 4 : 3, 7, 12][(s / 2) % 4]; ev.push({ t, f: at => pluck(at, m, st * 1.6) }); }
      }
      if (S.pad) ev.push({ t: b0, f: at => pad(at, r, q, spb * 4) });
    }
    const wave = CH[S.opp].wave;
    for (const n of B.notes) if (n.who === 0) ev.push({ t: n.t, f: at => voice(at, n.m, n.d, wave) });
    return ev.sort((a, b) => a.t - b.t);
  }

  /* ── 상태 ── */
  let state = 'title', G = null, story = null, M = null, menuStack = [];
  const cam = { x: 640, z: 0, hz: 0 };
  const songT = () => AC.currentTime - G.t0 - auto - off / 1000;
  const accP = g => g.wN ? g.wSum / g.wN * 100 : 100;
  const rk = (s, d) => s.id + '_' + d;

  function loadSong(idx, d) {
    initAudio(); newMaster();
    const S = SONGS[idx], B = buildSong(S, d);
    const PN = B.notes.filter(n => n.who === 1), ON = B.notes.filter(n => n.who === 0);
    for (const n of B.notes) { n.st = 0; n.vo = null; }
    G = {
      idx, S, d, spb: B.spb, secs: B.secs, end: B.beats * B.spb, PN, ON, byLane: [0, 1, 2, 3].map(l => PN.filter(n => n.lane === l)),
      EV: arrange(S, B), evI: 0, oI: 0, appr: 1.55 / DIFFS[d].sp, opp: CH[S.opp],
      hp: .5, score: 0, combo: 0, maxCombo: 0, cnt: [0, 0, 0, 0, 0], wSum: 0, wN: 0, pops: [], spl: [],
      pose: [{ l: -1, end: 0, miss: 0 }, { l: -1, end: 0, miss: 0 }], held: [0, 0, 0, 0], holdN: [null, null, null, null],
      conf: [-9, -9, -9, -9], oconf: [-9, -9, -9, -9], lastBar: -1, failed: false, firstP: PN.length ? PN[0].t : 0,
    };
    G.t0 = AC.currentTime + 0.35 + 4 * G.spb;
    state = 'play'; closeMenu(); pz.hidden = false; cam.x = 640;
  }
  function judgeHit(n, i, T) {
    const R = RATE[i]; G.cnt[i]++; G.score += R.sc; G.wSum += R.w; G.wN++; G.combo++; if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    G.hp = Math.min(1, G.hp + R.hp); G.conf[n.lane] = T; G.pose[1] = { l: n.lane, end: T + Math.max(n.d, 0.35), miss: 0 };
    G.pops.push({ i, t: performance.now(), vy: -170, y: 0, c: G.combo }); if (G.pops.length > 4) G.pops.shift();
    if (i === 0) G.spl.push({ l: n.lane, t: performance.now() });
    hitSnd();
  }
  function judgeMiss(T, lane) {
    G.cnt[4]++; G.score -= 10; G.wN++; G.combo = 0; G.hp -= DIFFS[G.d].miss;
    G.pose[1] = { l: lane, end: T + 0.4, miss: T + 0.4 }; missSnd();
    G.pops.push({ i: 4, t: performance.now(), vy: -120, y: 0, c: 0 }); if (G.pops.length > 4) G.pops.shift();
    if (G.hp <= 0) { G.hp = 0; gameOver(); }
  }
  function down(l) {
    if (state !== 'play') return; G.held[l] = 1; const T = songT();
    let best = null; for (const n of G.byLane[l]) { if (n.st !== 0) continue; if (n.t - T > 0.166) break; if (Math.abs(T - n.t) <= 0.166) { best = n; break; } }
    if (!best) { if (!opt.ghost && T > -0.2) judgeMiss(T, l); return; }
    const ms = Math.abs(T - best.t) * 1000; let i = 0; while (ms > RATE[i].ms) i++;
    judgeHit(best, i, T); if (state !== 'play') return;
    best.vo = voice(AC.currentTime, best.m, best.d > 0 ? best.t + best.d - T : 0.2, 'triangle');
    if (best.d > 0) { best.st = 1; G.holdN[l] = best; } else best.st = 2;
  }
  function up(l) {
    if (!G) return; G.held[l] = 0; const n = G.holdN[l]; if (!n) return; G.holdN[l] = null; if (state !== 'play') return; const T = songT();
    if (T >= n.t + n.d - 0.15) { n.st = 2; G.wSum += 1; G.wN++; G.score += 50; }
    else { n.st = 3; if (n.vo) { const now = AC.currentTime; n.vo.gain.cancelScheduledValues(now); n.vo.gain.setTargetAtTime(0.0001, now, 0.03); } judgeMiss(T, l); }
  }
  function update(T, dt) {
    const now = AC.currentTime;
    while (G.evI < G.EV.length && G.t0 + G.EV[G.evI].t < now + 0.25) { const e = G.EV[G.evI++], at = G.t0 + e.t; if (at >= now - 0.03) e.f(Math.max(at, now)); }
    while (G.oI < G.ON.length && T >= G.ON[G.oI].t) { const n = G.ON[G.oI++]; n.st = n.d > 0 ? 1 : 2; G.oconf[n.lane] = T + n.d; G.pose[0] = { l: n.lane, end: n.t + Math.max(n.d, G.spb * 0.9), miss: 0 }; }
    for (const n of G.ON) { if (n.t > T) break; if (n.st === 1 && T >= n.t + n.d) n.st = 2; }
    for (const n of G.PN) {
      if (n.t - T > 0.2) break;
      if (n.st === 0 && T - n.t > 0.166) { n.st = 3; judgeMiss(T, n.lane); if (n.d > 0) G.wN++; if (state !== 'play') return; }
    }
    for (let l = 0; l < 4; l++) { const n = G.holdN[l]; if (!n) continue; G.score += 120 * dt; G.hp = Math.min(1, G.hp + 0.04 * dt); G.conf[l] = T; if (T >= n.t + n.d) { n.st = 2; G.holdN[l] = null; G.wSum += 1; G.wN++; G.score += 50; } }
    const bar = Math.floor(T / G.spb / 4); if (bar !== G.lastBar && T >= 0) { G.lastBar = bar; if (bar >= 2) { cam.z = 0.03; cam.hz = 0.03; } }
    if (T > G.end + 0.6) finish();
  }

  /* ── 메뉴(칸 안 DOM) ── */
  function showMenu(build, keepSel) { const sel = keepSel && M ? M.sel : 0; M = { build, sel }; paintMenu(); }
  function pushMenu(build) { if (M) menuStack.push(M); showMenu(build); }
  function popMenu() { M = menuStack.pop() || null; if (M) paintMenu(); else closeMenu(); }
  function closeMenu() { M = null; menuStack = []; ov.hidden = true; ov.innerHTML = ''; }
  function paintMenu() {
    const m = M.build(); M.cfg = m; if (M.sel >= m.items.length) M.sel = 0;
    let h = `<div class="rb-m${m.cls ? ' ' + m.cls : ''}">`;
    if (m.logo) h += '<b class="rb-logo">방송실<br>리듬 배틀</b><p class="rb-ms">쉬는 시간, 방송실에서 한 판!</p>';
    if (m.title) h += `<b class="rb-mt">${m.title}</b>`;
    if (m.sub) h += `<p class="rb-ms">${m.sub}</p>`;
    if (m.extra) h += m.extra;
    if (m.diff) h += `<div class="rb-df"><button type="button" class="rb-da" data-d="-1" aria-label="쉽게">◀</button><b class="rb-dn d${diff}">${DIFFS[diff].n}</b><button type="button" class="rb-da" data-d="1" aria-label="어렵게">▶</button></div>`;
    h += '<div class="rb-mi">' + m.items.map((it, i) => `<button type="button" class="rb-it${i === M.sel ? ' on' : ''}" data-i="${i}"><span>${it.lbl}</span>${it.sub ? `<small>${it.sub}</small>` : ''}</button>`).join('') + '</div>';
    if (m.foot) h += `<p class="rb-mf">${m.foot}</p>`;
    ov.innerHTML = h + '</div>'; ov.hidden = false; pz.hidden = true;
    ov.querySelector('.rb-it.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  function menuGo(i) { const it = M?.cfg?.items[i]; if (!it) return; M.sel = i; document.activeElement?.blur?.(); initAudio(); it.go(); }
  function setDiff(dd) { diff = (diff + dd + 3) % 3; store.set('rb_diff', diff); paintMenu(); }
  ov.addEventListener('click', e => {
    const d = e.target.closest('[data-d]'); if (d) { setDiff(+d.dataset.d); return; }
    const b = e.target.closest('.rb-it'); if (b) menuGo(+b.dataset.i);
  });
  ov.addEventListener('pointerdown', e => { if (e.target.closest('.rb-tap')) { e.preventDefault(); calTap(); } });
  const fmt = n => Math.max(0, Math.round(n)).toLocaleString('ko-KR');
  const bestTxt = (S, d) => { const r = rec[rk(S, d)]; return r ? `최고 ${fmt(r.s)}점 · ${r.a.toFixed(2)}%${r.fc ? ' · 풀 콤보' : ''}` : '아직 기록 없음'; };

  const mTitle = () => ({ logo: 1, items: [
    { lbl: '스토리 모드', sub: '방송부 주간 · 3곡 연속', go: () => pushMenu(mStory) },
    { lbl: '자유 플레이', sub: '곡 하나 골라서', go: () => pushMenu(mFree) },
    { lbl: '설정', sub: '스크롤 방향·박자 보정 등', go: () => pushMenu(mOpt) },
  ], foot: '↑↓ 고르기 · Enter 선택 · Esc 뒤로' });
  const mStory = () => ({ title: '방송부 주간', sub: '방송부 선배와 방송부장에게 차례로 도전!', diff: 1,
    extra: `<ol class="rb-wk">${SONGS.map(s => `<li><b>${s.name}</b><small>${CH[s.opp].name}</small></li>`).join('')}</ol><p class="rb-ms">${week[diff] ? '이 난이도 최고 ' + fmt(week[diff]) + '점' : '아직 완주 기록 없음'}</p>`,
    items: [{ lbl: '시작', go: () => { story = { i: 0, d: diff, score: 0, wSum: 0, wN: 0, miss: 0 }; loadSong(0, diff); } }, { lbl: '뒤로', go: popMenu }], back: popMenu });
  const mFree = () => ({ title: '자유 플레이', diff: 1, cls: 'free',
    items: SONGS.map((s, i) => ({ lbl: s.name, sub: `${CH[s.opp].name} · BPM ${s.bpm} · ${bestTxt(s, diff)}`, go: () => { story = null; loadSong(i, diff); } })).concat([{ lbl: '뒤로', go: popMenu }]), back: popMenu });
  const onOff = v => v ? '<em>켬</em>' : '끔';
  const setOpt = k => { opt[k] = !opt[k]; store.set('rb_opt', opt); paintMenu(); };
  const mOpt = () => ({ title: '설정', items: [
    { lbl: '아래로 스크롤 ' + onOff(opt.down), sub: '화살표가 위에서 내려와요', go: () => setOpt('down') },
    { lbl: '가운데 보기 ' + onOff(opt.mid), sub: '내 화살표 줄만 가운데에(세로 화면은 항상)', go: () => setOpt('mid') },
    { lbl: '빈 누르기 허용 ' + onOff(opt.ghost), sub: '끄면 화살표 없을 때 눌러도 놓침', go: () => setOpt('ghost') },
    { lbl: '타격음 ' + onOff(opt.hits), sub: '맞힐 때마다 딸깍', go: () => setOpt('hits') },
    ...(state === 'pause' ? [] : [{ lbl: `박자 보정 (${off > 0 ? '+' : ''}${off}ms)`, sub: '소리와 화살표가 어긋날 때 · 블루투스 이어폰은 꼭', go: openCal }]),
    { lbl: '뒤로', go: popMenu },
  ], back: popMenu });
  const quitTxt = () => story ? '주간 그만두기' : '곡 고르기';
  const toSelect = () => { const s = story; story = null; G = null; state = 'title'; pz.hidden = true; menuStack = []; M = null; showMenu(mTitle); if (s) pushMenu(mStory); else pushMenu(mFree); };
  const mPause = () => ({ title: '잠깐 멈춤', sub: G.S.name + ' · ' + DIFFS[G.d].n, items: [
    { lbl: '계속하기', go: resume }, { lbl: '처음부터', go: () => loadSong(G.idx, G.d) }, { lbl: '설정', go: () => pushMenu(mOpt) }, { lbl: quitTxt(), go: toSelect },
  ], back: resume });
  const mOver = () => ({ title: '체력이 바닥났어요', sub: G.S.name + ' · ' + DIFFS[G.d].n, cls: 'over', items: [{ lbl: '다시 하기', go: () => loadSong(G.idx, G.d) }, { lbl: quitTxt(), go: toSelect }] });

  function pause() {
    if (state !== 'play') return; state = 'pause'; for (let l = 0; l < 4; l++) { const n = G.holdN[l]; if (n) { n.st = 2; G.holdN[l] = null; } } G.held.fill(0); ptr.clear(); AC.suspend(); showMenu(mPause);
  }
  function resume() { if (state !== 'pause') return; closeMenu(); AC.resume().then(() => { if (state === 'pause') { state = 'play'; pz.hidden = false; } }); }
  function gameOver() {
    state = 'over'; G.failed = true; pz.hidden = true; for (let l = 0; l < 4; l++) G.holdN[l] = null;
    const now = AC.currentTime; master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0.0001, now, 0.08);
    const g2 = AC.createGain(); g2.gain.value = 0.7; g2.connect(AC.destination);
    [392, 330, 262, 196].forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; env(g, now + i * 0.18, 0.25, 0.3); o.connect(g).connect(g2); o.start(now + i * 0.18); o.stop(now + i * 0.18 + 0.35); });
    setTimeout(() => { if (state === 'over' && alive) showMenu(mOver); }, 900);
  }
  function grade(a, miss, allSick) {
    if (!miss && allSick) return ['완벽', 'g5']; if (a >= 95) return ['훌륭', 'g4']; if (a >= 85) return ['좋음', 'g3']; if (a >= 70) return ['보통', 'g2']; return ['아쉬움', 'g1'];
  }
  function finish() {
    if (state !== 'play') return; state = 'result'; pz.hidden = true;
    master.gain.setTargetAtTime(0.0001, AC.currentTime + 1.2, 0.4);
    const g = G, a = accP(g), miss = g.cnt[4], allSick = !miss && g.cnt[1] + g.cnt[2] + g.cnt[3] === 0, [gn, gc] = grade(a, miss, allSick);
    const key = rk(g.S, g.d), old = rec[key]; let newB = false;
    if (!old || g.score > old.s) { rec[key] = { s: Math.round(g.score), a: Math.max(a, old?.a || 0), fc: !miss || !!old?.fc }; newB = true; }
    else { old.a = Math.max(old.a, a); old.fc = old.fc || !miss; }
    store.set('rb_rec', rec);
    if (story) { story.score += g.score; story.wSum += g.wSum; story.wN += g.wN; story.miss += miss; }
    const tag = allSick ? '올 퍼펙트' : !miss ? '풀 콤보' : '';
    const extra = `<div class="rb-gr ${gc}">${gn}</div>${tag ? `<p class="rb-tag">${tag}</p>` : ''}
      <p class="rb-sc">${fmt(g.score)}점${newB ? ' <em>최고 기록!</em>' : ''}</p><p class="rb-ms">정확도 ${a.toFixed(2)}% · 최대 콤보 ${g.maxCombo}</p>
      <div class="rb-res">${['완벽', '좋아', '아쉬워', '별로', '놓침'].map((n, i) => `<span class="j${i}"><b>${n}</b>${g.cnt[i]}</span>`).join('')}</div>`;
    let items;
    if (story && story.i < SONGS.length - 1) items = [{ lbl: '다음 곡 ▶', sub: SONGS[story.i + 1].name, go: () => { story.i++; loadSong(story.i, story.d); } }, { lbl: '이 곡 다시', go: () => { story.score -= g.score; story.wSum -= g.wSum; story.wN -= g.wN; story.miss -= miss; loadSong(g.idx, g.d); } }, { lbl: '주간 그만두기', go: toSelect }];
    else if (story) items = [{ lbl: '주간 결과 보기', go: weekDone }];
    else items = [{ lbl: '다시 하기', go: () => loadSong(g.idx, g.d) }, { lbl: '곡 고르기', go: toSelect }];
    setTimeout(() => { if (state === 'result' && alive) showMenu(() => ({ title: g.S.name, sub: DIFFS[g.d].n, cls: 'res', extra, items })); }, 700);
  }
  function weekDone() {
    const s = story, a = s.wN ? s.wSum / s.wN * 100 : 100, nb = !week[s.d] || s.score > week[s.d];
    if (nb) { week[s.d] = Math.round(s.score); store.set('rb_week', week); }
    const extra = `<p class="rb-sc">${fmt(s.score)}점${nb ? ' <em>최고 기록!</em>' : ''}</p><p class="rb-ms">${DIFFS[s.d].n} · 평균 정확도 ${a.toFixed(2)}% · 놓침 ${s.miss}</p>`;
    story = null; G = null; state = 'title';
    showMenu(() => ({ title: '방송부 주간 완주!', cls: 'res', extra, items: [{ lbl: '처음 화면', go: () => { menuStack = []; showMenu(mTitle); } }] }));
  }

  /* ── 박자 보정 ── */
  const cal = { c0: 0, taps: [], v: null };
  function openCal() {
    initAudio(); newMaster(); state = 'calib'; cal.c0 = AC.currentTime + 0.8; cal.taps = []; cal.v = null;
    for (let i = 0; i < 24; i++) beep(cal.c0 + i * 0.5, i % 4 === 0 ? 880 : 620);
    pushMenu(() => ({ title: '박자 보정', sub: "'삑' 소리에 맞춰 노란 원을 8번 이상 (키보드는 스페이스)", extra: '<div class="rb-tap">삑!</div><p class="rb-ms rb-ci"></p>',
      items: [{ lbl: '저장하고 돌아가기', go: calDone }, { lbl: '다시 측정', go: () => { popMenu(); openCal(); } }], back: calDone }));
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
  function calDone() { if (cal.v !== null && cal.taps.length >= 8) { off = Math.max(-300, Math.min(400, cal.v)); store.set('rb_off', off); } newMaster(); state = 'title'; popMenu(); }

  /* ── 입력 ── */
  const ptr = new Map();
  const pDown = e => {
    if (state !== 'play') return; e.preventDefault(); if (e.pointerType === 'touch') touchUI = true;
    const r = cv.getBoundingClientRect(), l = Math.max(0, Math.min(3, Math.floor((e.clientX - r.left) / (r.width / 4)))); ptr.set(e.pointerId, l); down(l);
  };
  const pEnd = e => { const l = ptr.get(e.pointerId); if (l === undefined) return; ptr.delete(e.pointerId); for (const v of ptr.values()) if (v === l) return; up(l); };
  const NAV = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Enter: 1, Space: 1, Escape: 1, Backspace: 1, KeyW: 1, KeyS: 1 };
  const kDown = e => {
    if (!alive || !el.isConnected) return; const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (state === 'play') {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyP') { e.preventDefault(); e.stopPropagation(); pause(); return; }
      const l = KEYS[e.code]; if (l === undefined) return; e.preventDefault(); e.stopPropagation(); if (!e.repeat) down(l); return;
    }
    if (state === 'calib' && e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) calTap(); return; }
    if (!M || !NAV[e.code]) return;
    const m = M.cfg; if ((e.code === 'Escape' || e.code === 'Backspace') && !m.back) return;   // 첫 화면 Esc는 사이트(나가기)에 넘김
    e.preventDefault(); e.stopPropagation(); if (e.repeat && (e.code === 'Enter' || e.code === 'Space')) return;
    const n = m.items.length;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { M.sel = (M.sel - 1 + n) % n; paintMenu(); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { M.sel = (M.sel + 1) % n; paintMenu(); }
    else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && m.diff) setDiff(e.code === 'ArrowLeft' ? -1 : 1);
    else if (e.code === 'Enter' || e.code === 'Space') menuGo(M.sel);
    else if (e.code === 'Escape' || e.code === 'Backspace') m.back();
  };
  const kUp = e => { const l = KEYS[e.code]; if (l !== undefined && state === 'play') up(l); };
  const vis = () => { if (document.hidden) pause(); };
  const blur = () => pause();
  cv.addEventListener('pointerdown', pDown); cv.addEventListener('pointerup', pEnd); cv.addEventListener('pointercancel', pEnd);
  pz.onclick = pause;
  document.addEventListener('keydown', kDown, true); document.addEventListener('keyup', kUp, true);
  document.addEventListener('visibilitychange', vis); addEventListener('blur', blur); addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

  /* ── 그리기 도구 ── */
  function rr(x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else cx.rect(x, y, w, h); }
  function inkFill(fill, w = 5) { cx.lineJoin = 'round'; cx.lineCap = 'round'; if (fill) { cx.fillStyle = fill; cx.fill(); } cx.strokeStyle = INK; cx.lineWidth = w; cx.stroke(); }
  function lim(x1, y1, x2, y2, w, c) { cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.strokeStyle = INK; cx.lineWidth = w + 9; cx.stroke(); cx.strokeStyle = c; cx.lineWidth = w; cx.stroke(); }
  function dot(x, y, r, c, w = 4) { cx.beginPath(); cx.arc(x, y, r, 0, 7); inkFill(c, w); }
  function arrow(x, y, s, l, fill, alpha = 1, outline = true) {
    cx.save(); cx.globalAlpha = alpha; cx.translate(x, y); cx.rotate(ROT[l]); cx.beginPath();
    cx.moveTo(0, -s); cx.lineTo(s * 0.92, -s * 0.04); cx.lineTo(s * 0.4, -s * 0.04); cx.lineTo(s * 0.4, s * 0.86); cx.lineTo(-s * 0.4, s * 0.86); cx.lineTo(-s * 0.4, -s * 0.04); cx.lineTo(-s * 0.92, -s * 0.04); cx.closePath();
    cx.lineJoin = 'round'; const w = Math.max(2, s * 0.13);
    if (outline) { cx.strokeStyle = '#fff'; cx.lineWidth = w * 2.5; cx.stroke(); }
    cx.strokeStyle = INK; cx.lineWidth = w; cx.stroke(); cx.fillStyle = fill; cx.fill();
    if (outline) { cx.beginPath(); cx.moveTo(-s * 0.5, -s * 0.2); cx.lineTo(0, -s * 0.7); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = w * 0.9; cx.stroke(); }
    cx.restore();
  }
  function txt(t, x, y, size, fill, al = 'center') {
    cx.font = size + 'px ' + FONT; cx.textAlign = al; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
    cx.strokeStyle = INK; cx.lineWidth = Math.max(3, size * 0.2); cx.strokeText(t, x, y); cx.fillStyle = fill; cx.fillText(t, x, y); cx.textBaseline = 'alphabetic';
  }

  /* ── 캐릭터(머리 = 체력 아이콘과 공용) ── */
  function head(c, pal, face, lx, ly, mood) {
    if (c.hs === 'bob') { rr(-78, -60, 156, 112, 46); inkFill(pal.hair); }
    cx.beginPath(); cx.arc(0, 0, 66, 0, 7); inkFill(pal.skin);
    cx.beginPath();
    if (c.hs === 'spike') {
      cx.moveTo(-67, -2); for (let i = 1; i < 8; i++) { const a = Math.PI + i * Math.PI / 8, r = i % 2 ? 90 : 62; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 4); }
      cx.lineTo(67, -2); cx.lineTo(50, -18); cx.quadraticCurveTo(0, -36, -50, -18); cx.closePath();
    } else { const a0 = Math.PI * 1.04, a1 = Math.PI * 1.96; cx.arc(0, -2, 69, a0, a1); cx.quadraticCurveTo(face * 14, -42, Math.cos(a0) * 69, Math.sin(a0) * 69 - 2); cx.closePath(); }
    inkFill(pal.hair);
    const ex = face * 12 + lx, ey = 2 + ly;
    if (mood === 3) { cx.strokeStyle = INK; cx.lineWidth = 5; for (const s of [-1, 1]) { const x = ex + s * 22; cx.beginPath(); cx.moveTo(x - 7, ey - 7); cx.lineTo(x + 7, ey + 7); cx.moveTo(x + 7, ey - 7); cx.lineTo(x - 7, ey + 7); cx.stroke(); } }
    else for (const s of [-1, 1]) { cx.beginPath(); cx.ellipse(ex + s * 22, ey, 7.5, mood === 2 ? 5 : 10, 0, 0, 7); cx.fillStyle = INK; cx.fill(); cx.beginPath(); cx.arc(ex + s * 22 + 2.5, ey - 3.5, 2.6, 0, 7); cx.fillStyle = '#fff'; cx.fill(); }
    if (c.acc === 'glasses') { for (const s of [-1, 1]) { rr(ex + s * 22 - 18, ey - 14, 36, 28, 9); cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = 4.5; cx.stroke(); } cx.beginPath(); cx.moveTo(ex - 4, ey - 3); cx.lineTo(ex + 4, ey - 3); cx.stroke(); }
    cx.fillStyle = 'rgba(255,120,140,.35)'; for (const s of [-1, 1]) { cx.beginPath(); cx.ellipse(ex + s * 38, ey + 22, 10, 6, 0, 0, 7); cx.fill(); }
    const mx = ex * 0.8, my = 32 + ly * 0.5;
    cx.strokeStyle = INK; cx.lineWidth = 4.5;
    if (mood === 1) { cx.beginPath(); cx.ellipse(mx, my, 14, 12, 0, 0, 7); inkFill('#7a1f35', 4.5); cx.beginPath(); cx.ellipse(mx, my + 6, 7, 4, 0, 0, 7); cx.fillStyle = '#ff8fa3'; cx.fill(); }
    else if (mood === 2) { cx.beginPath(); cx.ellipse(mx, my + 2, 6, 7, 0, 0, 7); inkFill('#7a1f35', 4); cx.beginPath(); cx.moveTo(-face * 62, -24); cx.quadraticCurveTo(-face * 70, -6, -face * 62, -2); cx.quadraticCurveTo(-face * 54, -6, -face * 62, -24); inkFill('#9fd8ff', 3); }
    else if (mood === 3) { cx.beginPath(); cx.moveTo(mx - 10, my + 2); cx.lineTo(mx + 10, my + 2); cx.stroke(); }
    else { cx.beginPath(); cx.arc(mx, my - 6, 12, 0.2 * Math.PI, 0.8 * Math.PI); cx.stroke(); }
    if (c.acc === 'cap') {
      cx.beginPath(); cx.arc(0, -8, 70, Math.PI * 1.03, Math.PI * 1.97); cx.closePath(); inkFill(pal.capC);
      cx.beginPath(); cx.ellipse(face * 62, -14, 42, 11, 0, 0, 7); inkFill(pal.capC); dot(0, -76, 6, pal.capC, 3.5);
    } else if (c.acc === 'headset') {
      cx.beginPath(); cx.arc(0, -4, 77, Math.PI * 1.08, Math.PI * 1.92); cx.strokeStyle = INK; cx.lineWidth = 15; cx.stroke(); cx.strokeStyle = '#4a4e6e'; cx.lineWidth = 8; cx.stroke();
      for (const s of [-1, 1]) { rr(s * 72 - 12, -24, 24, 46, 10); inkFill('#4a4e6e', 4); }
      dot(face * 72, -2, 5, '#ff5d72', 2.5);
    }
  }
  function drawChar(c, x, fy, face, p, T, bop, dead) {
    const sing = !dead && p.l >= 0 && T < p.end, miss = !dead && p.miss > 0 && T < p.miss, l = sing || miss ? p.l : -1;
    const pal = miss || dead ? GREY : c;
    const lx = l === 0 ? -18 : l === 3 ? 18 : 0, ly = l === 1 ? 12 : l === 2 ? -14 : 0;
    const sq = dead ? 0.93 : 1 - bop * 0.04 + (l === 2 ? 0.04 : l === 1 ? -0.04 : 0);
    cx.save(); cx.translate(x, fy);
    cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(0, 2, 100, 17, 0, 0, 7); cx.fill();
    lim(-26, -100, -30, -16, 30, pal.pants); lim(26, -100, 30, -16, 30, pal.pants);
    for (const s of [-1, 1]) { rr(s * 30 - 28, -24, 56, 24, 12); inkFill('#f3f3f7', 4); }
    cx.scale(1, sq); cx.translate(lx * 0.6, ly * 0.5);
    const bs = [-face * 50, -188];
    const hb = dead ? [-face * 84, -96] : l === 0 ? [-150, -225] : l === 3 ? [150, -225] : l === 2 ? [-face * 55, -345] : l === 1 ? [-face * 105, -112] : [-face * 72, -108 + bop * 5];
    lim(bs[0], bs[1], hb[0], hb[1], 24, pal.body2); dot(hb[0], hb[1], 13, pal.skin);
    rr(-64, -212, 128, 128, 42); inkFill(pal.body);
    rr(-58, -110, 116, 20, 10); cx.fillStyle = pal.body2; cx.fill();
    cx.save(); cx.translate(face * 26, -168); cx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 14; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } cx.closePath(); inkFill('#ffd84a', 3); cx.restore();
    cx.save(); cx.translate(lx * 0.4, -276 + ly * 0.3); head(c, pal, face, lx * 0.5, ly * 0.4, dead ? 3 : miss ? 2 : sing ? 1 : 0); cx.restore();
    const fsh = [face * 50, -188], hf = dead ? [face * 84, -96] : sing ? [face * 52 + lx * 0.4, -236] : [face * 72, -150];
    lim(fsh[0], fsh[1], hf[0], hf[1], 24, pal.body);
    cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(hf[0], hf[1]); cx.lineTo(hf[0] - face * 6, hf[1] - 30); cx.strokeStyle = INK; cx.lineWidth = 14; cx.stroke(); cx.strokeStyle = '#6a6f8e'; cx.lineWidth = 7; cx.stroke();
    dot(hf[0] - face * 7, hf[1] - 36, 12, '#555a72', 4); dot(hf[0], hf[1], 13, pal.skin);
    cx.restore();
  }

  /* ── 방송실 배경(한 번 그려 캐시) ── */
  const BX = -260, BY = -360, BW = 1800, BH = 1360;
  function buildBg(k) {
    const c = document.createElement('canvas'); c.width = Math.ceil(BW * k); c.height = Math.ceil(BH * k);
    const g = c.getContext('2d'), sv = cx; g.scale(k, k); g.translate(-BX, -BY);
    const gr = g.createLinearGradient(0, -360, 0, 560); gr.addColorStop(0, '#141a3e'); gr.addColorStop(1, '#27306a'); g.fillStyle = gr; g.fillRect(BX, BY, BW, 920);
    for (let y = 40; y < 520; y += 64) for (let x = 40; x < 1240; x += 64) {   // 흡음재
      if (x > 440 && x < 840 && y < 330) continue;
      g.fillStyle = '#262f66'; g.fillRect(x, y, 60, 60);
      g.fillStyle = '#2f3a7a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60, y); g.lineTo(x + 30, y + 30); g.closePath(); g.fill();
      g.fillStyle = '#1f2758'; g.beginPath(); g.moveTo(x, y + 60); g.lineTo(x + 60, y + 60); g.lineTo(x + 30, y + 30); g.closePath(); g.fill();
    }
    g.fillStyle = '#10142c'; g.fillRect(450, 92, 380, 228);   // 조정실 창
    const wg = g.createLinearGradient(0, 100, 0, 312); wg.addColorStop(0, '#2f6f8f'); wg.addColorStop(1, '#173a55'); g.fillStyle = wg; g.fillRect(462, 104, 356, 204);
    g.fillStyle = '#0f1a2c'; g.fillRect(462, 250, 356, 58);
    const lights = ['#ff5d72', '#3ed27a', '#ffd84a', '#3fc4f2'];
    for (let i = 0; i < 28; i++) { g.fillStyle = lights[i % 4]; g.fillRect(478 + i * 12, 262 + (i % 3) * 12, 6, 4); }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(480, 104); g.lineTo(560, 104); g.lineTo(500, 248); g.lineTo(462, 248); g.closePath(); g.fill();
    g.fillStyle = '#3a3256'; g.fillRect(BX, 540, BW, 20);   // 걸레받이
    const fg = g.createLinearGradient(0, 560, 0, 1000); fg.addColorStop(0, '#463a63'); fg.addColorStop(1, '#2a2240'); g.fillStyle = fg; g.fillRect(BX, 560, BW, BH);
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2; for (let x = -200; x < 1600; x += 90) { g.beginPath(); g.moveTo(x, 560); g.lineTo(640 + (x - 640) * 1.8, 1000); g.stroke(); }
    g.fillStyle = 'rgba(160,140,255,.12)'; g.beginPath(); g.ellipse(640, 640, 560, 70, 0, 0, 7); g.fill();
    void sv; return c;
  }
  function speaker(x, fy, pulse) {
    rr(x - 88, fy - 262, 176, 262, 18); inkFill('#20223a', 6);
    for (const [y, r] of [[fy - 200, 40], [fy - 92, 54]]) { const rr2 = r * (1 + pulse * 0.07); dot(x, y, rr2, '#3a3d5c', 5); dot(x, y, rr2 * 0.62, '#14162a', 3); dot(x, y, rr2 * 0.2, '#5a5e80', 3); }
    dot(x + 66, fy - 248, 5, pulse > 0.3 ? '#3ed27a' : '#1d5a36', 2);
  }

  /* ── 화면 그리기 ── */
  function layout() {
    const land = W >= H * 1.05, mid = opt.mid || !land;
    const lw = mid ? Math.min(W * 0.2, 112, H * 0.15) : Math.min(W * 0.105, 104, H * 0.15);
    return { land, mid, lw, pcx: mid ? W / 2 : W * 0.75, ocx: W * 0.25, ry: opt.down ? H - lw * 0.95 : lw * 0.9, dir: opt.down ? -1 : 1 };
  }
  function render(T, dt) {
    const L = layout(), playing = !!G && T !== null, spb = G ? G.spb : 0.6, now = performance.now();
    const bf = playing ? T / spb : now / 1000 / 0.6, beatPulse = Math.max(0, 1 - ((bf % 1) + 1) % 1 * 4);
    // 카메라: 부르는 사람 쪽으로
    let tx = 640;
    if (playing && T >= 0) { const b = T / spb, s = G.secs.find(q => b >= q.b0 && b < q.b1); if (s && s.who !== 2) tx = s.who === 0 ? 520 : 760; }
    if (!L.land) tx = Math.max(580, Math.min(700, tx));
    cam.x += (tx - cam.x) * Math.min(1, dt * 3); cam.z *= Math.exp(-dt * 5); cam.hz *= Math.exp(-dt * 6);
    const s = (L.land ? Math.max(W / 1280, H / 720) : W / 980) * (1 + cam.z);
    const k = Math.min(1.5, Math.max(0.6, s * DPR)); if (!bgC || Math.abs(k - bgK) > 0.25) { bgK = k; bgC = buildBg(k); }
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.fillStyle = '#1a2150'; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(W / 2, L.land ? H * 0.5 : H * 0.47); cx.scale(s, s); cx.translate(-cam.x, -380);
    cx.fillStyle = '#141a3e'; cx.fillRect(BX - 3000, BY - 3000, BW + 6000, 3000); cx.fillStyle = '#2a2240'; cx.fillRect(BX - 3000, BY + BH - 2, BW + 6000, 3000);
    cx.fillStyle = '#1a2150'; cx.fillRect(BX - 3000, BY, 3000, 920); cx.fillRect(BX + BW, BY, 3000, 920); cx.fillStyle = '#2a2240'; cx.fillRect(BX - 3000, 560, 3000, BH); cx.fillRect(BX + BW, 560, 3000, BH);
    cx.drawImage(bgC, BX, BY, BW, BH);
    const singing = playing && (T < G.pose[0].end || T < G.pose[1].end);
    rr(560, 30, 160, 46, 12); inkFill(singing ? '#e0293f' : '#4a2030', 5);   // ON AIR
    if (singing) { cx.save(); cx.globalAlpha = 0.25; cx.fillStyle = '#ff3a50'; cx.beginPath(); cx.ellipse(640, 53, 130, 50, 0, 0, 7); cx.fill(); cx.restore(); }
    cx.font = '30px ' + FONT; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = singing ? '#fff' : '#a07080'; cx.fillText('ON AIR', 640, 55); cx.textBaseline = 'alphabetic';
    for (const [x, who] of [[300, 0], [980, 1]]) {   // 조명
      const on = playing && T < G.pose[who].end; cx.fillStyle = `rgba(255,240,180,${on ? 0.1 : 0.035})`;
      cx.beginPath(); cx.moveTo(x - 30, -360); cx.lineTo(x + 30, -360); cx.lineTo(x + 170, 610); cx.lineTo(x - 170, 610); cx.closePath(); cx.fill();
    }
    speaker(640, 600, playing && T >= 0 ? beatPulse : 0);
    const bop = Math.pow(beatPulse, 2), dead = state === 'over';
    const tt = playing ? T : 0, opp = G ? G.opp : CH.sb;
    drawChar(opp, 300, 610, 1, G ? G.pose[0] : { l: -1, end: 0, miss: 0 }, tt, bop, false);
    drawChar(CH.me, 980, 610, -1, G ? G.pose[1] : { l: -1, end: 0, miss: 0 }, tt, bop, dead);
    cx.restore();
    if (!playing || state === 'over' || state === 'result') return;
    // HUD(마디마다 쿵)
    const hz = 1 + cam.hz; cx.save(); cx.translate(W / 2, H / 2); cx.scale(hz, hz); cx.translate(-W / 2, -H / 2);
    const spd = (H * 0.82) / G.appr, lw = L.lw;
    const strum = (ccx, who) => {
      for (let l = 0; l < 4; l++) {
        const x = ccx + (l - 1.5) * lw;
        if (who === 1) { const c = T - G.conf[l] < 0.12 || G.holdN[l]; arrow(x, L.ry, lw * 0.4 * (G.held[l] && !c ? 0.88 : c ? 1.06 : 1), l, c ? COL[l] : G.held[l] ? '#6a73b0' : '#3a4170', 1); }
        else { const c = T < G.oconf[l] + 0.12; arrow(x, L.ry, lw * 0.4 * (c ? 1.05 : 1), l, c ? COL[l] : '#3a4170', 1); }
      }
      const list = who ? G.PN : G.ON;
      for (const n of list) {
        const dtn = n.t - T; if (dtn > G.appr + 0.2) break; if (n.st === 2) continue;
        if (n.st === 3 && -(dtn + n.d) > 0.4) continue;
        const x = ccx + (n.lane - 1.5) * lw, yh = n.st === 1 ? L.ry : L.ry + L.dir * dtn * spd, al = n.st === 3 ? 0.3 : 1;
        if (n.d > 0) { const ye = L.ry + L.dir * (dtn + n.d) * spd; const y0 = Math.min(yh, ye), y1 = Math.max(yh, ye); if (y1 - y0 > 2) { cx.globalAlpha = al * 0.85; rr(x - lw * 0.12, y0, lw * 0.24, y1 - y0, lw * 0.12); inkFill(COL[n.lane], 3); cx.globalAlpha = 1; } }
        if (n.st !== 1) arrow(x, yh, lw * 0.4, n.lane, COL[n.lane], al);
      }
    };
    if (!L.mid) strum(L.ocx, 0);
    strum(L.pcx, 1);
    for (let i = G.spl.length - 1; i >= 0; i--) {   // 완벽 물보라
      const sp = G.spl[i], a = (now - sp.t) / 320; if (a >= 1) { G.spl.splice(i, 1); continue; }
      const x = L.pcx + (sp.l - 1.5) * lw; cx.globalAlpha = 1 - a; cx.strokeStyle = COL[sp.l]; cx.lineWidth = 5 * (1 - a) + 1;
      for (let j = 0; j < 8; j++) { const an = j * Math.PI / 4 + sp.l, r0 = lw * (0.35 + a * 0.5), r1 = r0 + lw * 0.18 * (1 - a); cx.beginPath(); cx.moveTo(x + Math.cos(an) * r0, L.ry + Math.sin(an) * r0); cx.lineTo(x + Math.cos(an) * r1, L.ry + Math.sin(an) * r1); cx.stroke(); }
      cx.globalAlpha = 1;
    }
    // 판정·콤보
    const px = L.mid ? (L.land ? L.pcx - lw * 3.3 : L.pcx) : W / 2, py = L.mid && !L.land ? H * 0.55 : H * 0.42;
    for (const p of G.pops) {
      const a = (now - p.t) / 1000; if (a > 0.8) continue; p.y = p.vy * a + 380 * a * a;
      cx.globalAlpha = a < 0.45 ? 1 : 1 - (a - 0.45) / 0.35;
      txt(p.i < 4 ? RATE[p.i].n : '놓침', px, py + p.y, Math.min(46, lw * 0.5), p.i < 4 ? RATE[p.i].c : '#ff6b7a');
      if (p.c >= 5) txt(String(p.c), px, py + p.y + lw * 0.48, Math.min(34, lw * 0.36), '#fff');
      cx.globalAlpha = 1;
    }
    // 카운트다운·안내
    const beat = T / spb;
    if (beat >= -4 && beat < 0) { const i = Math.floor(beat + 4), a = (beat + 4) % 1; cx.globalAlpha = 1 - a * 0.7; txt(['3', '2', '1', '가자!'][i], W / 2, H * 0.45, Math.min(90, H * 0.14) * (1 + (1 - a) * 0.15), i === 3 ? '#ffd84a' : '#fff'); cx.globalAlpha = 1; }
    if (story && story.i === 0 && G.d === 0 || (!story && rec[rk(G.S, G.d)] === undefined && G.idx === 0)) {
      if (T >= 0 && T < G.firstP - spb * 0.5) txt('선배가 부른 화살표를 보고, 내 차례에 똑같이!', W / 2, opt.down ? H * 0.2 : H * 0.8 - 40, Math.min(22, W * 0.04), '#ffd84a');
    }
    // 체력 바 + 아이콘
    const bw = Math.min(W * (L.land ? 0.48 : 0.8), 600), bx = (W - bw) / 2, by = opt.down ? 46 : H - 58, split = bx + bw * (1 - G.hp);
    rr(bx - 4, by - 4, bw + 8, 22, 11); cx.fillStyle = INK; cx.fill();
    cx.fillStyle = G.opp.body; cx.fillRect(bx, by, Math.max(0, split - bx), 14); cx.fillStyle = CH.me.body; cx.fillRect(split, by, bx + bw - split, 14);
    const ib = 1 + Math.pow(beatPulse, 3) * 0.15, ic = (c, x, mood, face) => { cx.save(); cx.translate(x, by + 7); cx.scale(0.36 * ib, 0.36 * ib); head(c, mood === 2 ? Object.assign({}, c, { skin: '#e6d0d8' }) : c, face, 0, 0, mood); cx.restore(); };
    ic(G.opp, split - 26, G.hp > 0.8 ? 2 : 0, 1); ic(CH.me, split + 26, G.hp < 0.2 ? 2 : 0, -1);
    const a = accP(G), [gn] = grade(a, G.cnt[4], !G.cnt[4] && !G.cnt[1] && !G.cnt[2] && !G.cnt[3]);
    txt(`점수 ${fmt(G.score)}  ·  놓침 ${G.cnt[4]}  ·  ${G.wN ? a.toFixed(2) + '% (' + gn + ')' : '-'}`, W / 2, opt.down ? by + 36 : by - 22, Math.min(18, W * 0.032), '#fff');
    txt(G.S.name + ' · ' + DIFFS[G.d].n, opt.down ? 60 : 22, opt.down ? 24 : H - 16, 14, 'rgba(255,255,255,.75)', 'left');
    cx.restore();
    if (touchUI) {   // 터치 칸 표시(FNF 모바일 히트박스처럼)
      for (let l = 0; l < 4; l++) { const x = l * W / 4; cx.fillStyle = G.held[l] ? COL[l] + '30' : 'rgba(255,255,255,.025)'; cx.fillRect(x + 1, 0, W / 4 - 2, H); cx.fillStyle = COL[l] + (G.held[l] ? 'cc' : '55'); cx.fillRect(x + 6, opt.down ? 0 : H - 5, W / 4 - 12, 5); }
    }
  }
  function frame(ts) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, lastF ? (ts - lastF) / 1000 : 0.016); lastF = ts;
    let T = null;
    if (G && AC) { T = songT(); if (state === 'play') { update(T, dt); if (G) T = songT(); } }
    render(G ? T : null, dt);
  }

  return {
    start() { fit(); showMenu(mTitle); raf = requestAnimationFrame(frame); },
    get _g() { return { G, state, AC, songT: () => G && AC ? songT() : null }; },   // 검사용
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', kDown, true); document.removeEventListener('keyup', kUp, true);
      document.removeEventListener('visibilitychange', vis); removeEventListener('blur', blur); removeEventListener('resize', fit);
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
      if (isFs()) try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
      if (AC) AC.close().catch(() => {});
    },
  };
}
export const __test = { SONGS, buildSong };
