// SVMHS GROUND — 뽑기 연출 2차 (2026-10-25 하율: "뽑기 애니메이션 더 화려하고 긴장감 있게")
// 화면 전체를 어둡게 덮는 무대에서 진행. gacha.js draw()가 play()를 부르고, 끝나면 결과를 페이지에 남김.
// 긴장감 설계(레퍼런스: 포켓몬 카드 팩 개봉 · 가챠 등급 '승급' 연출 · 슬롯머신 멈춤):
//   ① 손잡이를 뒤로 감았다가(예비 동작) 두 바퀴 — 딸깍 소리, 갈수록 기계가 세게 흔들림. 서버 응답이 늦으면 계속 돌림(로딩을 연출로 가림)
//   ② 캡슐은 전부 '은색'으로 나옴 → 등급이 안 보임. 5번 뽑기는 낮은 등급부터 놓아 마지막이 제일 좋음.
//      희귀 이상 캡슐은 가만있다가 혼자 '움찔'(전설은 금가루도 샘) — 눌러 보고 싶게 만드는 신호
//   ③ 열기 = 금이 가며 빛이 샘 → 등급만큼 '승급': 하늘 → (멈칫) 보라 → (멈칫·화면 흔들림) 금빛 → 시크릿은 불이 꺼지고 심장 두 번 뛴 뒤 폭발
//      멈칫하는 0.2~0.3초 정적이 핵심(소리·흔들림 모두 멈춤) — 거기서 끝나면 그 등급, 더 가면 한 단계 위
//   ④ 터지면 빛살·빛 고리·파티클, 등급 도장이 쾅 찍히고 이름 → 누르면 칸으로 돌아가고 다음 캡슐
// 성능: 움직임은 transform·opacity(Web Animations)만, 파티클은 캔버스 하나(최대 220개), 필터·backdrop-filter 없음.
//   무대가 떠 있는 동안 뒤 화면(.view)은 visibility:hidden — 뒤의 움직이는 스티커가 다시 그려지지 않게(2026-10-25 렉 교훈).
// CSP: style 속성 금지 → 위치·크기는 el.style.setProperty(CSSOM)·element.animate로만.
// 소리: 기본 꺼짐(학교 쉬는 시간), 무대 오른쪽 위 버튼, 이 기기 sg_gc_snd. 진동은 되는 기기에서만(전설 이상).
import { esc } from './util.js';
import { RAR, objName } from './att-rewards.js';
import { artOf } from './att-art.js';

const RC = { 1: 'r1', 2: 'r2', 3: 'r3', 4: 'r4' };
const LV = ['', '#9fdcff', '#c4b2ff', '#ffe27a', '#fff3c4'];   // 등급별 새는 빛 색
const PC = { 1: ['#bfe7ff', '#7cc8ff', '#ffffff'], 2: ['#d9ceff', '#a891ff', '#ffffff', '#7cc8ff'], 3: ['#ffe98a', '#ffb3e6', '#94d8ff', '#ffffff', '#b39cff'], 4: ['#fff3b0', '#ffc53d', '#ffffff', '#ffe27a'] };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = { out: 'cubic-bezier(.2,.8,.3,1)', back: 'cubic-bezier(.3,1.6,.5,1)', in: 'cubic-bezier(.5,0,.8,.4)', io: 'cubic-bezier(.6,0,.4,1)' };
const anim = (el, kf, o) => el ? el.animate(kf, typeof o === 'number' ? { duration: o, fill: 'forwards' } : { fill: 'forwards', ...o }) : null;
const done = a => a ? a.finished.catch(() => {}) : Promise.resolve();
const getSnd = () => { try { return localStorage.getItem('sg_gc_snd') === '1'; } catch { return false; } };
const setSnd = v => { try { localStorage.setItem('sg_gc_snd', v ? '1' : '0'); } catch {} };
const buzz = p => { try { navigator.vibrate?.(p); } catch {} };

/* ---------- 소리 (Web Audio로 합성 — 파일 없음) ---------- */
let ac = null, mg = null;
function audio() {
  if (!getSnd()) return null;
  try {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); mg = ac.createGain(); mg.gain.value = .45; mg.connect(ac.destination); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch { return null; }
}
function tone(f, d, { type = 'sine', g = .2, f2, at = 0, a = .005 } = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), v = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(v); v.connect(mg); o.start(t); o.stop(t + d + .02);
}
function noise(d, { g = .2, lp = 8000, hp = 40, at = 0 } = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + at, n = Math.ceil(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), l = c.createBiquadFilter(), h = c.createBiquadFilter(), v = c.createGain();
  s.buffer = b; l.type = 'lowpass'; l.frequency.value = lp; h.type = 'highpass'; h.frequency.value = hp;
  v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d);
  s.connect(l); l.connect(h); h.connect(v); v.connect(mg); s.start(t);
}
const SFX = {
  tick: () => { tone(2200, .035, { type: 'square', g: .05 }); noise(.02, { g: .06, hp: 3000 }); },
  clunk: () => { tone(140, .18, { type: 'triangle', g: .3, f2: 60 }); noise(.12, { g: .15, lp: 900 }); },
  roll: () => { for (let i = 0; i < 5; i++) tone(500 + i * 40, .05, { type: 'triangle', g: .08, at: i * .07 }); },
  land: i => tone(660 + i * 60, .09, { type: 'triangle', g: .1 }),
  riser: (d, lv) => { tone(180 * lv, d, { type: 'sawtooth', g: .05, f2: 520 * lv, a: d * .8 }); noise(d, { g: .04, hp: 2000 }); },
  up: lv => [0, 4, 7, 12].forEach((s, i) => tone(392 * 2 ** ((s + lv * 2) / 12), .32, { type: 'triangle', g: .14, at: i * .06 })),
  hush: () => tone(90, .5, { g: .12, f2: 40 }),
  thump: () => { tone(62, .28, { g: .5, f2: 40 }); tone(124, .12, { type: 'triangle', g: .15 }); },
  pop: r => { noise(.25, { g: .3, hp: 600 }); tone(880, .25, { g: .12, f2: 220 }); if (r >= 2) tone(1320, .5, { type: 'triangle', g: .1, at: .05 }); },
  fan: r => { const base = r >= 3 ? 523 : 440; [0, 4, 7, 11, 14].slice(0, r + 1).forEach((s, i) => tone(base * 2 ** (s / 12), r >= 3 ? 1.6 : .9, { type: 'triangle', g: .1, at: i * .05, a: .02 })); if (r >= 3) noise(1.2, { g: .05, hp: 5000, at: .1 }); },
  stamp: () => { tone(110, .16, { type: 'square', g: .12, f2: 70 }); noise(.08, { g: .2, lp: 1200 }); },
};

/* ---------- 파티클 (캔버스 하나) ---------- */
function particles(cv) {
  const cx = cv.getContext('2d'), list = [], cache = new Map();
  let raf = 0, W = 0, H = 0, dpr = 1, motes = false, alive = true;
  const fit = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  fit(); addEventListener('resize', fit);
  const glow = c => {   // 색마다 빛 방울 한 장을 미리 그려 두고 drawImage
    if (cache.has(c)) return cache.get(c);
    const s = 64, o = document.createElement('canvas'); o.width = o.height = s; const g = o.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.25, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); cache.set(c, o); return o;
  };
  const star = (x, y, r, rot) => { cx.save(); cx.translate(x, y); cx.rotate(rot); cx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .32 : r; cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } cx.closePath(); cx.fill(); cx.restore(); };
  const add = p => { if (list.length < 220) list.push({ rot: 0, vr: 0, g: 0, drag: .985, ...p, t: 0 }); kick(); };
  function frame() {
    raf = 0; if (!alive) return;
    cx.clearRect(0, 0, W, H);
    if (motes && list.filter(p => p.k === 'mote').length < 26) add({ k: 'mote', x: rnd(0, W), y: H + 10, vx: rnd(-.15, .15), vy: rnd(-.5, -.2), life: rnd(400, 700), s: rnd(6, 14), c: '#7cc8ff', drag: 1 });
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.t++;
      if (p.t > p.life) { list.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const k = 1 - p.t / p.life, a = p.k === 'mote' ? Math.min(1, p.t / 60) * k * .35 : k;
      cx.globalAlpha = a;
      if (p.k === 'conf') { cx.fillStyle = p.c; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.cos(p.t * .2 + p.s)); cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); }
      else if (p.k === 'star') { cx.fillStyle = p.c; star(p.x, p.y, p.s * (.6 + .4 * k), p.rot); }
      else { cx.globalCompositeOperation = 'lighter'; const s = p.s * (p.k === 'mote' ? 1 : .5 + k); cx.drawImage(glow(p.c), p.x - s, p.y - s, s * 2, s * 2); cx.globalCompositeOperation = 'source-over'; }
    }
    cx.globalAlpha = 1;
    if (list.length || motes) kick();
  }
  function kick() { if (!raf && alive) raf = requestAnimationFrame(frame); }
  return {
    motes(on) { motes = on; kick(); },
    burst(x, y, r, n = 40) {   // 터짐: 빛 방울 + 별 (+ 전설 이상 색종이)
      const cs = PC[r];
      for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(2, 6 + r * 2.4); add({ k: i % 3 ? 'dot' : 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .06, drag: .955, life: rnd(40, 80 + r * 15), s: rnd(5, 9 + r * 2), c: cs[i % cs.length], vr: rnd(-.2, .2) }); }
      if (r >= 3) for (let i = 0; i < 70; i++) add({ k: 'conf', x: rnd(0, W), y: rnd(-H * .3, -10), vx: rnd(-1, 1), vy: rnd(1.5, 4), g: .03, drag: .995, life: rnd(150, 240), s: rnd(8, 13), c: cs[i % cs.length], vr: rnd(-.15, .15) });
    },
    leak(x, y, c, n = 3, sp = 2) { for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(.5, sp); add({ k: 'dot', x: x + rnd(-14, 14), y: y + rnd(-14, 14), vx: Math.cos(a) * v, vy: Math.sin(a) * v - .6, g: -.01, drag: .97, life: rnd(30, 55), s: rnd(4, 8), c }); } },
    ring(x, y, c, n = 28) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, v = 7; add({ k: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .9, life: 34, s: 9, c }); } },
    stop() { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', fit); },
  };
}

/* ---------- 그림 ---------- */
// 은색 캡슐(등급 숨김) + 금 간 자국(k1~k3, 단계마다 하나씩 그어짐) — 빛 색은 currentColor
const capSvg = () => `<svg viewBox="-40 -40 80 80" aria-hidden="true"><defs><linearGradient id="gfxNeu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f9fc"/><stop offset=".55" stop-color="#d5dde8"/><stop offset="1" stop-color="#aeb9c9"/></linearGradient></defs>
  <circle r="30" fill="#0d1a2c" transform="translate(2.5 3.5)"/>
  <g class="bot"><circle r="30" fill="#fff" stroke="#173048" stroke-width="4"/></g>
  <g class="top"><path d="M-30 0A30 30 0 0 1 30 0Z" class="ct" stroke="#173048" stroke-width="4" stroke-linejoin="round"/><path d="M-21 -10Q-14 -23 0 -24" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".9"/></g>
  <path d="M-30 0H30" stroke="#173048" stroke-width="4"/>
  <g class="crk" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <g class="k1"><path pathLength="1" d="M-4 2L-1 -7L5 -4L9 -15" stroke-width="7" opacity=".35"/><path pathLength="1" d="M-4 2L-1 -7L5 -4L9 -15" stroke-width="2.6"/></g>
    <g class="k2"><path pathLength="1" d="M12 3L17 -5L24 -3M-14 -2L-10 -11L-16 -19" stroke-width="7" opacity=".35"/><path pathLength="1" d="M12 3L17 -5L24 -3M-14 -2L-10 -11L-16 -19" stroke-width="2.6"/></g>
    <g class="k3"><path pathLength="1" d="M-3 4L4 11L0 20M18 -15L11 -23M-22 6L-15 12" stroke-width="7" opacity=".35"/><path pathLength="1" d="M-3 4L4 11L0 20M18 -15L11 -23M-22 6L-15 12" stroke-width="2.6"/></g>
  </g></svg>`;

/* ---------- 무대 ---------- */
// req: 서버 응답 Promise({ out, tix }) · machine: 기계 SVG 문자열 · tix(): 지금 뽑기권 수 · n: 뽑는 수
// 결과: { again: 1|5|null } — '한 번 더'를 누르면 그 수
export async function play({ req, machine, n, tix }) {
  const root = document.createElement('div');
  root.className = 'gfx'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '뽑기');
  root.innerHTML = `<i class="gfx-t t2"></i><i class="gfx-t t3"></i><i class="gfx-t t4"></i><canvas class="gfx-cv" aria-hidden="true"></canvas>
    <div class="gfx-sc"><i class="gfx-rays" aria-hidden="true"></i>
      <div class="gfx-mc">${machine}<i class="gfx-halo" aria-hidden="true"></i></div>
      <div class="gfx-row" aria-live="polite"></div>
      <div class="gfx-fc"></div>
      <p class="gfx-hint"></p>
      <div class="gfx-end"></div></div>
    <i class="gfx-blk" aria-hidden="true"></i><i class="gfx-fl" aria-hidden="true"></i>
    <div class="gfx-bar"><button type="button" class="gfx-snd" aria-pressed="${getSnd()}" aria-label="소리"><svg viewBox="0 0 24 24"><use href="#i-snd-${getSnd() ? 'on' : 'off'}"/></svg></button><button type="button" class="gfx-skip" aria-label="애니메이션 스킵"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5v13l8.5-6.5zM12.5 5.5v13l8.5-6.5z" fill="currentColor"/><path d="M21 5v14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>스킵</span></button></div>`;
  document.body.append(root);
  document.documentElement.classList.add('gfx-on');
  const $ = s => root.querySelector(s);
  const P = particles($('.gfx-cv')), sc = $('.gfx-sc'), mcw = $('.gfx-mc'), mc = mcw.querySelector('svg'), row = $('.gfx-row'), fc = $('.gfx-fc'), hint = $('.gfx-hint'), end = $('.gfx-end');
  let skip = false, closed = false, again = null, out = null, auto = false;
  const S = (k, ...a) => { if (!skip) SFX[k]?.(...a); };
  const shake = (amp, d = 420) => !skip && anim(sc, [0, 1, 2, 3, 4, 5, 6].map(i => ({ transform: i === 6 ? 'none' : `translate(${rnd(-amp, amp)}px,${rnd(-amp, amp)}px) rotate(${rnd(-amp, amp) * .08}deg)` })), { duration: d, easing: 'linear', fill: 'none' });
  const flashOut = (op, d = 700) => anim($('.gfx-fl'), [{ opacity: op }, { opacity: 0 }], { duration: d, easing: 'ease-out', fill: 'none' });
  const tint = r => root.querySelectorAll('.gfx-t').forEach(t => t.classList.toggle('on', t.classList.contains('t' + r)));
  const ctr = el => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; };
  P.motes(true);
  anim(root, [{ opacity: 0 }, { opacity: 1 }], 260);
  root.querySelector('.gfx-snd').onclick = e => { const on = !getSnd(); setSnd(on); const b = e.currentTarget; b.setAttribute('aria-pressed', on); b.querySelector('use').setAttribute('href', '#i-snd-' + (on ? 'on' : 'off')); if (on) SFX.tick(); };
  let resolveClose;
  const closedP = new Promise(r => { resolveClose = r; });
  const close = async () => {
    if (closed) return; closed = true; removeEventListener('keydown', onKey);
    await done(anim(root, [{ opacity: 1 }, { opacity: 0 }], 220));
    P.stop(); root.remove(); document.documentElement.classList.remove('gfx-on'); resolveClose({ again });
  };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); doSkip(); } else if ((e.key === ' ' || e.key === 'Enter') && out && row.childElementCount && !root.classList.contains('fin')) { e.preventDefault(); next(); } };
  addEventListener('keydown', onKey);
  root.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('.gfx-snd')) return;
    if (t.closest('.gfx-skip')) return doSkip();
    if (!out || !row.childElementCount) return;   // 기계 단계: 스킵·소리 버튼만
    if (t.closest('.gfx-x')) return close();
    const ag = t.closest('.gfx-again'); if (ag) { again = +ag.dataset.n; return close(); }
    if (t.closest('.gfx-auto')) { auto = true; end.innerHTML = ''; return next(); }
    if (root.classList.contains('fin')) return;
    const sl = t.closest('.gfx-sl');
    if (sl && !opening) return openOne(+sl.dataset.k);
    next();   // 빈 곳을 눌러도 다음으로
  });

  /* ① 손잡이: 뒤로 감기 → 두 바퀴(딸깍) → 기계 덜컹. 응답이 오기 전이면 계속 돌림 */
  const knob = mc.querySelector('.gc-knob'), inner = mc.querySelector('.gc-in');
  if (!skip) await done(anim(mcw, [{ transform: 'translateY(30px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: ease.back }));
  if (!skip) { await done(anim(knob, [{ transform: 'rotate(0)' }, { transform: 'rotate(-40deg)' }], { duration: 260, easing: ease.out })); await sleep(110); }
  let got = null, err = null;
  req.then(r => { got = r; }, e => { err = e; });
  let turns = 0;
  while (((turns < 2 && !skip) || (!got && !err)) && turns < 40) {
    const sp = turns < 2 ? 520 - turns * 90 : 360;
    const k = anim(knob, [{ transform: `rotate(${turns ? 0 : -40}deg)` }, { transform: 'rotate(360deg)' }], { duration: sp, easing: turns ? 'linear' : 'cubic-bezier(.4,0,1,1)', fill: 'none' });
    for (let q = 0; q < 4; q++) setTimeout(() => S('tick'), sp * q / 4);
    anim(inner, [{ transform: 'none' }, { transform: `translate(${rnd(-5, 5)}px,${rnd(-4, 4)}px) rotate(${rnd(-8, 8)}deg)` }, { transform: 'none' }], { duration: sp, fill: 'none' });
    anim(mc, [{ transform: 'none' }, { transform: `rotate(${(turns % 2 ? 1 : -1) * (1.5 + Math.min(turns, 3))}deg)` }, { transform: 'none' }], { duration: sp, easing: ease.io, fill: 'none' });
    await done(k); turns++;
  }
  if (err || !got) { P.stop(); root.remove(); document.documentElement.classList.remove('gfx-on'); removeEventListener('keydown', onKey); throw err || new Error('뽑기를 못 했어요'); }
  out = got.out.map((x, i) => ({ ...x, i })).sort((a, b) => a.rar - b.rar);   // 낮은 등급부터 → 마지막이 하이라이트
  const top = out[out.length - 1].rar;
  S('clunk'); shake(5, 300);
  if (!skip) await done(anim(mc, [{ transform: 'none' }, { transform: 'translateY(6px) scaleY(.96)' }, { transform: 'none' }], { duration: 260, easing: ease.back, fill: 'none' }));

  /* 5번 뽑기에 전설 이상이 있으면 배출구에서 금가루가 샘 — '어? 금빛?' (1번 뽑기는 캡슐 열 때까지 비밀) */
  const chute = mc.querySelector('.gc-out'), cc = ctr(chute.parentNode);
  if (out.length > 1 && top >= 3 && !skip) {
    S('hush'); await sleep(240);
    const halo = $('.gfx-halo'); halo.classList.add('gold');
    anim(halo, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.1)' }, { opacity: .8, transform: 'scale(1)' }], { duration: 600, easing: ease.out });
    for (let i = 0; i < 6; i++) setTimeout(() => P.leak(cc.x, cc.y, i % 2 ? '#ffe27a' : '#fff3b0', 5, 3), i * 90);
    shake(7, 500); S('up', 3); buzz(40);
    await sleep(620);
  }

  /* ② 캡슐이 굴러 나와 줄에 섬 (전부 은색) */
  S('roll');
  if (skip) mcw.hidden = true;
  row.className = `gfx-row n${out.length}`;
  row.innerHTML = out.map((x, k) => `<button type="button" class="gfx-sl" data-k="${k}" aria-label="캡슐 ${k + 1} 열기"><span class="gfx-cap">${capSvg()}</span></button>`).join('');
  anim(mcw, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-34vh) scale(.5)', opacity: 0 }], { duration: 620, easing: ease.in, delay: 120 });
  if (!skip) await Promise.all([...row.children].map((sl, k) => {
    const c = sl.querySelector('.gfx-cap'), b = ctr(c);
    const dx = cc.x - b.x, dy = cc.y - b.y, s = 18 / b.w;
    return sleep(k * 110).then(() => { S('land', k); return done(anim(c, [
      { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0 },
      { transform: `translate(${dx * .5}px,${Math.min(dy, 0) * .5 - 90}px) scale(.8) rotate(-200deg)`, opacity: 1, offset: .45 },
      { transform: 'translate(0,0) scale(1.08,.88) rotate(-10deg)', offset: .82 },
      { transform: 'none' }], { duration: 720, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'none' })); });
  }));
  mcw.hidden = true;

  // 대기: 희귀 이상은 혼자 움찔 · 전설 이상은 금가루 — 눌러 보고 싶게
  const opened = new Set();
  const tell = setInterval(() => {
    if (skip || closed) return;
    [...row.children].forEach((sl, k) => {
      const x = out[k]; if (opened.has(k) || x.rar < 2 || fc.childElementCount || Math.random() > (x.rar >= 3 ? .55 : .35)) return;
      anim(sl.querySelector('.gfx-cap'), [{ transform: 'none' }, { transform: 'rotate(-9deg) translateY(-3px)' }, { transform: 'rotate(7deg)' }, { transform: 'none' }], { duration: 420, easing: ease.io, fill: 'none' });
      if (x.rar >= 3) { const c = ctr(sl); P.leak(c.x, c.y, '#ffe27a', 3, 1.4); }
    });
  }, 1300);
  const pickHint = () => { hint.textContent = out.length > 1 ? '캡슐을 눌러 하나씩 열어 보세요' : '캡슐을 눌러 열어 보세요'; end.innerHTML = out.length > 1 ? '<button type="button" class="btn ghost gfx-auto">차례로 자동 열기</button>' : ''; };
  const nextIdx = () => out.findIndex((_, k) => !opened.has(k));
  const pulseNext = () => { row.querySelectorAll('.gfx-sl').forEach((s, k) => s.classList.toggle('nx', k === nextIdx())); };

  /* ③ 열기 */
  let opening = null, waitTap = null;
  setTimeout(() => { if (skip) runSkip(); else { pickHint(); pulseNext(); } });
  async function openOne(k) {
    if (opened.has(k) || opening || closed) return;
    opened.add(k);
    const x = out[k], sl = row.children[k], small = sl.querySelector('.gfx-cap');
    hint.textContent = ''; end.innerHTML = ''; row.querySelectorAll('.nx').forEach(s => s.classList.remove('nx'));
    opening = (async () => {
      const from = ctr(small);
      fc.innerHTML = `<div class="gfx-big"><i class="gfx-glow" aria-hidden="true"></i><i class="gfx-ring" aria-hidden="true"></i><span class="gfx-cap">${capSvg()}</span></div>`;
      const big = fc.querySelector('.gfx-big'), cap = big.querySelector('.gfx-cap'), glow = big.querySelector('.gfx-glow'), ringEl = big.querySelector('.gfx-ring');
      small.classList.add('gone'); row.classList.add('dim');
      const to = ctr(cap);
      if (!skip) await done(anim(cap, [{ transform: `translate(${from.x - to.x}px,${from.y - to.y}px) scale(${from.w / to.w})` }, { transform: 'none' }], { duration: 480, easing: ease.back }));
      const lvUp = lv => {   // 한 단계 승급: 빛 색 바뀜 + 금 하나 더 + 빛 고리
        big.className = `gfx-big lv${lv}`;
        anim(cap.querySelector('.k' + Math.min(3, lv) + ' path:last-child'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, easing: ease.out });
        anim(cap.querySelector('.k' + Math.min(3, lv) + ' path:first-child'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, easing: ease.out });
        anim(glow, [{ opacity: .3, transform: 'scale(.6)' }, { opacity: 1, transform: `scale(${.9 + lv * .18})` }], { duration: 380, easing: ease.out });
        if (lv > 1) { const c = ctr(cap); anim(ringEl, [{ opacity: .9, transform: 'scale(.5)' }, { opacity: 0, transform: `scale(${2.4 + lv * .4})` }], { duration: 600, easing: ease.out, fill: 'none' }); P.ring(c.x, c.y, LV[lv]); }
      };
      const jitter = (amp, d) => { const L = Math.max(4, Math.round(d / 45)); return anim(cap, Array.from({ length: L }, (_, i) => ({ transform: i === L - 1 ? 'none' : `translate(${rnd(-amp, amp)}px,${rnd(-amp * .6, amp * .6)}px) rotate(${rnd(-amp, amp) * 1.4}deg)` })), { duration: d, easing: 'linear', fill: 'none' }); };
      const leakLoop = (d, lv) => { const c = ctr(cap), id = setInterval(() => P.leak(c.x, c.y - 10, LV[lv], 2, 1.2 + lv * .4), 70); return sleep(d).then(() => clearInterval(id)); };
      if (!skip) {
        // 1단계: 금 가고 하늘빛 샘
        lvUp(1); S('riser', x.rar >= 2 ? .9 : .45, 1);
        await Promise.all([done(jitter(3, x.rar >= 2 ? 760 : 380)), leakLoop(x.rar >= 2 ? 760 : 380, 1)]);
        for (let lv = 2; lv <= Math.min(3, x.rar) && !skip; lv++) {
          // 멈칫(정적) → 승급
          S('hush'); await sleep(lv === 2 ? 230 : 330);
          lvUp(lv); S('up', lv); shake(lv * 3.5, 360); if (lv >= 3) { buzz([30, 40, 60]); flashOut(.35, 420); tint(3); }
          else tint(2);
          S('riser', lv >= 3 ? 1.1 : .8, lv);
          await Promise.all([done(jitter(3 + lv * 1.5, lv >= 3 ? 1000 : 720)), leakLoop(lv >= 3 ? 1000 : 720, lv)]);
        }
        if (x.rar === 4 && !skip) {
          // 시크릿: 불이 꺼지고 심장 두 번 → 폭발
          S('hush');
          const blk = $('.gfx-blk');
          await done(anim(blk, [{ opacity: 0 }, { opacity: .96 }], { duration: 260, easing: ease.out }));
          big.className = 'gfx-big lv4 dark';
          for (let h = 0; h < 2 && !skip; h++) {
            await sleep(h ? 340 : 420); S('thump'); buzz(60);
            anim(cap, [{ transform: 'none' }, { transform: 'scale(1.16)' }, { transform: 'none' }], { duration: 300, easing: ease.out, fill: 'none' });
          }
          await sleep(520);
          anim(blk, [{ opacity: .96 }, { opacity: 0 }], { duration: 500, easing: ease.out });
          lvUp(4); tint(4); shake(14, 600); buzz([60, 40, 120]);
        }
      }
      // 터짐
      const c = ctr(cap);
      S('pop', x.rar); S('fan', x.rar);
      flashOut(x.rar >= 3 ? 1 : x.rar === 2 ? .55 : .25, x.rar >= 3 ? 900 : 500);
      if (!skip) {
        P.burst(c.x, c.y, x.rar, 20 + x.rar * 18);
        const tp = cap.querySelector('.top');
        anim(tp, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-40px,-90px) rotate(-70deg)', opacity: 0 }], { duration: 420, easing: ease.out });
        await done(anim(cap, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0 }], { duration: 260, easing: ease.out }));
      }
      const it = document.createElement('div');
      it.className = `gfx-it ${RC[x.rar]}`;
      it.innerHTML = `${x.rar >= 2 ? '<i class="gfx-rays2" aria-hidden="true"></i>' : ''}<span class="gfx-ic">${artOf(x.v)}</span>
        <b class="gfx-st">${RAR[x.rar].n}</b><strong class="gfx-nm">${esc(objName(x.v))}</strong>
        ${x.new ? '<em class="gfx-new">NEW</em>' : `<em class="gfx-dup">조각 +${x.shard}</em>`}${x.fx && x.new ? '<em class="gfx-fxk">내 효과에서 켜기</em>' : ''}`;
      big.replaceWith(it);
      if (x.rar >= 2) $('.gfx-rays').className = `gfx-rays on ${RC[x.rar]}`;
      if (!skip) {
        anim(it.querySelector('.gfx-ic'), [{ transform: 'scale(.2) translateY(40px)', opacity: 0 }, { transform: 'scale(1.18)', opacity: 1, offset: .6 }, { transform: 'none' }], { duration: 560, easing: ease.out });
        anim(it.querySelector('.gfx-nm'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 420 });
        anim(it.querySelector('em'), [{ opacity: 0, transform: 'scale(2)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 560, easing: ease.back });
        setTimeout(() => S('stamp'), 300);
        await done(anim(it.querySelector('.gfx-st'), [{ opacity: 0, transform: 'scale(2.6) rotate(-12deg)' }, { opacity: 1, transform: 'scale(.92) rotate(-4deg)', offset: .7 }, { opacity: 1, transform: 'rotate(-4deg)' }], { duration: 380, delay: 300, easing: ease.in }));
        if (x.rar >= 3) { const cc2 = ctr(it); P.burst(cc2.x, cc2.y, x.rar, 20); }
        // 누르면 다음(자동 열기면 잠깐 보여 주고 넘어감)
        hint.textContent = nextIdx() < 0 ? '누르면 결과 보기' : '누르면 다음 캡슐';
        await new Promise(r => { waitTap = r; if (auto) setTimeout(r, x.rar >= 3 ? 2300 : x.rar === 2 ? 1500 : 1000); });
        waitTap = null; hint.textContent = '';
      }
      // 칸으로 돌아감
      tint(0); $('.gfx-rays').className = 'gfx-rays';
      sl.innerHTML = `<span class="gfx-mini ${RC[x.rar]}">${artOf(x.v)}${x.new ? '<em>N</em>' : ''}</span>`;
      sl.classList.add('op', RC[x.rar]); sl.setAttribute('aria-label', `${RAR[x.rar].n} ${objName(x.v)}`);
      if (!skip) {
        const a = ctr(it), b = ctr(sl);
        anim(sl.firstChild, [{ transform: `translate(${a.x - b.x}px,${a.y - b.y}px) scale(${a.w / b.w * .7})`, opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: ease.out });
        await done(anim(it, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
      }
      fc.innerHTML = ''; row.classList.remove('dim');
    })();
    await opening; opening = null;
    if (closed) return;
    if (nextIdx() < 0) return finish();
    pulseNext();
    if (auto && !skip) openOne(nextIdx()); else if (!skip) pickHint();
  }
  function next() {
    if (waitTap) return waitTap();
    if (opening) return;
    const k = nextIdx(); if (k >= 0) openOne(k);
  }
  async function doSkip() {
    if (root.classList.contains('fin')) return close();
    if (skip) return;
    skip = true; auto = true;
    root.querySelector('.gfx-skip').disabled = true;
    if (!out || !row.childElementCount) return;   // 기계 단계면 본 흐름이 이어서 바로 결과로
    runSkip();
  }
  async function runSkip() {
    clearInterval(tell);
    waitTap?.();
    await opening;
    for (let g = 0; nextIdx() >= 0 && !closed && g < 50; g++) { if (opening) await opening; else await openOne(nextIdx()); await sleep(0); }
    if (out.some(x => x.rar >= 3)) { const fl = $('.gfx-fl'); fl.classList.add('gold'); flashOut(.8, 700); }
  }
  function finish() {
    clearInterval(tell); root.classList.add('fin');
    const nNew = out.filter(x => x.new).length, sh = out.reduce((s, x) => s + (x.new ? 0 : x.shard || 0), 0), t = tix();
    hint.innerHTML = `<b>${out.length > 1 ? `${out.length}개를 뽑았어요` : '뽑았어요'}</b>${nNew ? ` · 새로 ${nNew}개` : ''}${sh ? ` · 조각 +${sh}` : ''}`;
    end.innerHTML = `<button type="button" class="btn ghost gfx-x">닫기</button>${t >= n ? `<button type="button" class="btn gfx-again" data-n="${n}">한 번 더 <small>뽑기권 ${n}장 · 남은 ${t >= 1e6 ? '∞' : t}장</small></button>` : ''}`;
    root.querySelector('.gfx-skip').hidden = true;
    row.querySelectorAll('.gfx-sl').forEach(s => s.setAttribute('data-tip', s.getAttribute('aria-label')));
    if (!skip) anim(end, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 300);
    end.querySelector('.gfx-again, .gfx-x')?.focus();
  }

  root.querySelector('.gfx-skip').focus({ preventScroll: true });
  return closedP;
}
