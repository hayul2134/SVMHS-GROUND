// SVMHS GROUND — 선생님 몰래 춤추기 화면 (2026-10-31 하율: "선생님은 전자칠판 앞에서 수업, 나무 막대기를 한 손에, 네모난 안경, 머리숱 많은 60대 남자 선생님", 미리보기 깃발 dance-game)
// 규칙·판 진행은 dance-score.js(서버와 같음) — 여기는 그리기·입력·소리만. 판에 영향을 주는 값은 전부 시뮬레이션(s)에서 읽음.
// 판서 글씨·선생님 걷기·친구들 반응·말풍선은 그림일 뿐(판과 무관). 입력(누름/뗌)은 1/60초 프레임 번호로 기록(rounds) → 서버가 같은 판을 다시 돌려 점수를 확인.
import * as D from './dance-score.js';

const W = 360, H = 640;
const K = '#173048';   // 사이트 잉크색(--ink) — 화면 위 UI(말풍선·점수 칩)
const FONT = '"Jua", "Pretendard Variable", system-ui, sans-serif';
const NUMF = '"Outfit", "Pretendard Variable", system-ui, sans-serif';   // 사이트 숫자 글꼴(--num)
const fmt = n => Math.floor(n).toLocaleString('ko-KR');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const RM = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const TOUCHY = () => matchMedia('(pointer:coarse)').matches;

// 칠판 내용(그림만) — 수학 시간
const PAGES = [
  ['이차함수의 그래프', 'y = ax² + bx + c', 'a > 0 → 아래로 볼록', '꼭짓점에서 최솟값'],
  ['판별식', 'D = b² − 4ac', 'D > 0 : 서로 다른 두 실근', 'D = 0 : 중근'],
  ['삼각비', 'sin θ = 높이 / 빗변', 'cos θ = 밑변 / 빗변', 'tan θ = 높이 / 밑변'],
  ['등차수열', 'an = a + (n − 1)d', 'Sn = n(a + l) / 2', '시험에 꼭 나온다!!']];
const CAUGHT_LINES = ['거기 너!! 뭐 하냐!', '지금 춤추냐?!', '앞으로 나와!', '수업 시간에 무슨 짓이야!'];
const SLEEP_LINES = ['거기 자는 학생!!', '수업 시간에 졸아?!', '일어나! 뒤로 나가!'];

export function createDance(root, opts = {}) {
  root.innerHTML = `<div class="dn-scr" tabindex="-1"><canvas aria-label="선생님 몰래 춤추기 게임 화면"></canvas><div class="hr-ov dn-ov" hidden></div></div>
    <div class="hr-bar dn-bar"><p class="hr-keys dn-keys"><span class="hk"><span data-ka="dance"></span> 누르고 있으면 춤 · 떼면 공부하는 척</span></p><button type="button" class="btn ghost hr-snd dn-snd" aria-pressed="false"></button></div>`;
  const scr = root.querySelector('.dn-scr'), cv = scr.querySelector('canvas'), ov = scr.querySelector('.dn-ov'), sndBtn = root.querySelector('.dn-snd');
  const ctx = cv.getContext('2d', { alpha: false });
  const sfx = makeSfx(); sfx.set(!!opts.sound);
  let best = opts.best || 0, dpr = 1, k = 1, alive = true, raf = 0;
  const st = { scene: 'ready', shownAt: 0 };
  let s = null, seed = null, saved = false, evs = [], held = 0, acc = 0, last = 0, countT = 0, endT = 0, pauseFrom = '', tStart = 0, msgNow = null, lastRes = null, evRun = 0;
  // 그림만 쓰는 값
  const V = { t: 0, whip: 0, alert: 0, wflash: 0, stamp: 0, stampT: '', pv: 0, tx: 150, hx: 0, hy: -150, bub: '', bubT: 0, bubAngry: false, twitch: 0, board: { page: 0, line: 0, ch: 0, acc: 0, hold: 0 }, parts: [], pops: [], shake: 0, flash: 0 };

  /* --- 크기: 논리 360×640을 화면 픽셀에 맞춰 선명하게 --- */
  const fit = () => {
    const w = cv.clientWidth; if (!w) return;
    dpr = Math.min(3, window.devicePixelRatio || 1); k = w / W;
    const pw = Math.round(w * dpr), ph = Math.round(w * H / W * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  };
  const ro = new ResizeObserver(() => { fit(); draw(); }); ro.observe(cv);

  /* --- 입력: 화면 아무 곳이나 누르고 있으면 춤 --- */
  const KM = opts.keys || (() => '');
  const ptr = new Set();
  let kHeld = 0, touchSeen = TOUCHY();
  const sync = () => { held = kHeld || ptr.size ? 1 : 0; };
  const onDown = e => {
    if (e.button > 0) return; e.preventDefault(); sfx.unlock(); if (e.pointerType === 'touch') touchSeen = true;
    if (st.scene === 'ready') { start(); return; }
    if (st.scene === 'over') { again(); return; }
    if (st.scene === 'pause') { resume(); return; }
    ptr.add(e.pointerId); try { cv.setPointerCapture(e.pointerId); } catch {}
    sync();
  };
  const onUp = e => { if (ptr.delete(e.pointerId)) sync(); };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('lostpointercapture', onUp);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  ov.addEventListener('pointerdown', e => { if (e.target.closest('button,a')) return; onDown(e); });
  const busy = e => e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal.open') || e.target.closest?.('input,textarea,select,[contenteditable]');
  const kd = e => {
    if (busy(e) || root.closest('[hidden]')) return;
    const a = KM(e); sfx.unlock();
    if (st.scene === 'ready') { if (a || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) start(); } return; }
    if (st.scene === 'over') { if ((a === 'dance' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); again(); } return; }
    if (st.scene === 'pause') { if (e.code !== 'Escape' && e.code !== 'KeyR' && !e.repeat) { e.preventDefault(); resume(); } return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (st.scene === 'play' || st.scene === 'count') { e.preventDefault(); pause(); } return; }
    if (a === 'dance') { e.preventDefault(); kHeld = 1; sync(); }
  };
  const ku = e => { if (KM(e) === 'dance') { kHeld = 0; sync(); } };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  function blur() { kHeld = 0; ptr.clear(); sync(); if (st.scene === 'play' || st.scene === 'count') pause(); }
  const vis = () => { if (document.hidden) blur(); };
  window.addEventListener('blur', blur); document.addEventListener('visibilitychange', vis);

  /* --- 화면 위 안내(DOM) --- */
  const keyTxt = () => opts.keyText ? opts.keyText() : 'Space 꾹 누르기';
  const showReady = () => {
    ov.hidden = false; ov.className = 'hr-ov dn-ov dn-ready';
    ov.innerHTML = `<b>선생님 몰래 춤추기</b><span>판서하는 동안 반 전체가 몰래 광란의 파티!</span>${best ? `<em class="sr-best dn-best">${opts.trophy || ''}내 최고 ${fmt(best)}점</em>` : ''}
      <ul class="dn-how"><li><i class="dn-i1"></i><b>누르고 있으면 춤</b> · 떼면 공부하는 척</li><li><i class="dn-i2"></i>판서를 멈추거나 “흠…” 하면 <b>돌아볼지도</b> — 바로 멈추기!</li><li><i class="dn-i3"></i>선생님은 <b>예측 불가</b> — 멈췄다 다시 쓰기도, 갑자기 휙 돌아보기도 · 한 번 걸리면 끝</li><li><i class="dn-i4"></i>쉬지 않고 출수록 배율 ↑ · 춤을 안 추면 <b>졸음</b>이 차서 졸다 걸려요</li></ul>
      <small>${touchSeen ? '화면을 눌러 시작' : keyTxt() + ' — 아무 키나 눌러 시작'}</small>`;
  };
  const showOver = res => {
    st.scene = 'over'; st.shownAt = performance.now();
    const nb = res.score > best && res.score > 0; if (nb) best = res.score;
    ov.hidden = false; ov.className = 'hr-ov dead dn-over';
    ov.innerHTML = `<b>${res.why === 'sleep' ? '수업 시간에 졸아?!' : '교무실로 따라와.'}</b><div class="hr-card"><p class="hr-sc"><em>${fmt(res.score)}점</em>${nb ? '<i class="hr-nb">최고 기록!</i>' : ''}</p>
      <p class="dn-stat"><span>버틴 시간 <b>${Math.floor(res.f / D.FPS)}</b>초</span><span>세이프 <b>${res.safes}</b>번</span><span>최고 배율 <b>x${res.maxMult}</b></span></p>
      <small class="hr-msg dn-msg">${msgNow ?? (opts.saveLine ? opts.saveLine(res) : '')}</small></div><small class="hr-go">${touchSeen ? '화면을 눌러 다시' : '스페이스 · 엔터 · 클릭으로 다시'}</small>`;
  };
  const showPause = () => { ov.hidden = false; ov.className = 'hr-ov dn-ov'; ov.innerHTML = `<b>잠깐 멈춤</b><span>선생님도 같이 멈췄어요</span><small>${touchSeen ? '화면을 누르면 계속' : '아무 키나 누르면 계속'}</small>`; };

  /* --- 판 흐름 --- */
  // 카운트다운 없이 바로 시작(2026-10-31 23:16 하율): 시작 티켓을 미리 받아 둠(처음 열 때·판이 끝난 뒤) → 누르면 그 자리에서 시작.
  //   아직 못 받았으면 받을 때까지만 잠깐 기다리고(최대 4초, 그 뒤엔 연습 판), 너무 오래된 티켓(40분↑)은 새로 받음
  let pre = null;   // { p: Promise, v: 씨앗|null, done, at }
  function prefetch() {
    if (!opts.seed) { pre = { done: true, v: null, at: performance.now() }; return; }
    const me = { done: false, v: null, at: performance.now() };
    me.p = Promise.resolve(opts.seed()).catch(() => null).then(x => { me.v = x; me.done = true; return x; });
    pre = me;
  }
  function start() {
    if (st.scene !== 'ready') return;
    if (!pre || (pre.done && pre.v != null && performance.now() - pre.at > 40 * 60e3)) prefetch();
    ov.hidden = true; s = null; resetFx(); evRun++;
    const my = evRun, p = pre;
    if (p.done) { seed = p.v; saved = p.v != null; pre = null; begin(); return; }
    st.scene = 'count'; countT = 0; seed = null; saved = false;   // 티켓 기다리는 중(보통 아주 짧음)
    p.p.then(x => { if (my !== evRun || st.scene !== 'count') return; seed = x; saved = x != null; pre = null; begin(); });
  }
  function begin() {
    sfx.beep(true);
    const sd = seed != null ? seed : (Math.random() * 4294967296) >>> 0;
    s = D.newSim(sd, true); evs = []; acc = 0; st.scene = 'play'; tStart = performance.now();
    kHeld = 0; ptr.clear(); sync();
    opts.onStart?.(saved);
  }
  function resetFx() { V.parts = []; V.pops = []; V.shake = 0; V.flash = 0; V.bub = ''; V.bubT = 0; V.stamp = 0; V.alert = 0; V.wflash = 0; V.pv = 0; }
  function again() {
    if (st.scene !== 'over' || performance.now() - st.shownAt < 600) return;
    st.scene = 'ready'; s = null; resetFx(); opts.onReady?.(); start();
  }
  function pause() { if (st.scene !== 'play' && st.scene !== 'count') return; pauseFrom = st.scene; st.scene = 'pause'; showPause(); }
  function resume() { if (st.scene !== 'pause') return; ov.hidden = true; kHeld = 0; ptr.clear(); sync(); st.scene = pauseFrom === 'count' ? 'count' : 'resume'; countT = 0; last = performance.now(); }
  function finish() {
    const r = { ...D.resultOf(s), rounds: [s.overF, ...evs], saved, realMs: performance.now() - tStart };
    lastRes = r; msgNow = null; opts.onOver?.(r);
    prefetch();   // 다음 판 티켓 미리
  }

  /* --- 효과 --- */
  const pop = (x, y, t, c = '#fff', size = 20) => V.pops.push({ x, y, t, c, size, life: 1.1 });
  const part = (x, y, kind, c) => { if (V.parts.length > 90 || RM()) return; V.parts.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50, life: 1.1, kind, c, r: Math.random() * 6 }); };
  function handle(e) {
    switch (e.t) {
      case 'warn': V.bub = e.w > 80 ? '흐음…' : '흠…'; V.bubT = e.w / D.FPS + 0.1; V.bubAngry = false; V.twitch = 0.25; sfx.tap(); break;
      case 'pause': V.bub = ''; break;   // 말없이 펜만 멈춤(소리·말풍선 없음)
      case 'peek': V.bub = ''; V.alert = 0.4; sfx.peek(); break;
      case 'resume': V.bub = Math.random() < 0.3 ? ['자, 그래서…', '어디까지 했더라', '음, 그렇지'][Math.floor(Math.random() * 3)] : ''; V.bubT = 0.9; V.bubAngry = false; break;
      case 'turn': sfx.whip(); V.whip = 0.35; V.wflash = 0.12; V.shake = Math.max(V.shake, 0.12); V.bub = ''; break;   // 돌아보는 건 전부 휙
      case 'look': V.alert = 0.6; V.bub = ''; break;
      case 'safe': pop(180, 470, '세이프! +' + e.b, '#7dffb0', 21); sfx.safe(); break;
      case 'caught': V.bub = e.why === 'sleep' ? SLEEP_LINES[Math.floor(Math.random() * SLEEP_LINES.length)] : CAUGHT_LINES[Math.floor(Math.random() * CAUGHT_LINES.length)]; V.bubT = D.CAUGHT_F / D.FPS; V.bubAngry = true; V.shake = 0.45; V.flash = 0.6; V.stamp = 0.001; V.stampT = e.why === 'sleep' ? '졸다 걸렸다!' : '딱 걸렸다!'; sfx.caught(); break;
      case 'turnback': if (s && s.lives > 0 && V.bubAngry === false && Math.random() < 0.4) { V.bub = '자, 다시 보자.'; V.bubT = 1; } break;
      case 'mult': pop(180, 452, 'x' + e.m2 / 2, '#ffd84a', 21); sfx.mult(e.m2); break;
    }
  }

  /* --- 칠판·선생님 걷기(그림만) --- */
  function boardStep(dt) {
    const b = V.board, L = PAGES[b.page % PAGES.length];
    if (b.hold > 0) { b.hold -= dt; if (b.hold <= 0) { b.page++; b.line = 0; b.ch = 0; } return; }
    b.acc += dt * 6;
    while (b.acc >= 1) { b.acc--; b.ch++; if (b.ch > L[b.line].length) { b.line++; b.ch = 0; if (b.line >= L.length) { b.line = L.length - 1; b.ch = L[b.line].length; b.hold = 1.2; return; } } }
  }
  function writeStep(dt) {
    boardStep(dt); const c = cursorPos();
    V.tx += clamp(clamp(c.x + 6, 70, 292) - V.tx, -46 * dt, 46 * dt); V.hx = c.x - V.tx; V.hy = c.y - 318;
  }

  /* --- 루프 --- */
  const STEP = 1000 / D.FPS;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, now - (last || now)); last = now; const ds = dt / 1000;
    if (st.scene !== 'pause') V.t += ds;
    if (st.scene === 'count' || st.scene === 'resume') {
      countT += dt;
      if (st.scene === 'resume') { const prevN = Math.ceil((1000 - (countT - dt)) / 1000), n = Math.ceil((1000 - countT) / 1000); if (n !== prevN && n > 0) sfx.beep(false); if (countT >= 1000) { st.scene = 'play'; acc = 0; } }
      else if (countT >= 4000) { pre = null; seed = null; saved = false; begin(); }   // 티켓이 끝내 안 오면 연습 판
    }
    if (st.scene === 'play') {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 6 && !s.over) {
        if (held !== s.held) { const c = held ? 0 : 1; evs.push(D.enc(s.f, c)); D.input(s, c); }
        D.step(s);
        for (const e of s.evs) handle(e); s.evs.length = 0;
        acc -= STEP; n++;
      }
      if (n >= 6) acc = 0;
      if (s.dancing && Math.random() < ds * (1 + s.m2 / 2)) part(180 + (Math.random() - 0.5) * 60, 500, Math.random() < 0.5 ? 'note' : 'spark', ['#ffd84a', '#7dd3ff', '#ff8fc7', '#9dff8a'][Math.floor(Math.random() * 4)]);
      sfx.beat(s.dancing, V.t, s.m2);
      if (s.over) { st.scene = 'end'; endT = 0; sfx.beat(false); finish(); }
    } else if (st.scene === 'end') { endT += dt; if (endT > 500 && ov.hidden) showOver(lastRes); }
    else sfx.beat(false);
    // 그림만: 판서·말풍선·효과
    if (st.scene !== 'pause') {
      const tst = s ? s.st : 'write';
      if (tst === 'write' || !s) writeStep(ds);
      V.bubT = Math.max(0, V.bubT - ds); V.twitch = Math.max(0, V.twitch - ds); V.whip = Math.max(0, V.whip - ds); V.alert = Math.max(0, V.alert - ds); V.wflash = Math.max(0, V.wflash - ds); if (V.stamp > 0) V.stamp += ds;
      { const want = s && s.dancing && st.scene === 'play' ? 1 : 0; V.pv += clamp(want - V.pv, -ds / 0.15, ds / 0.08); }
      for (let i = V.parts.length - 1; i >= 0; i--) { const q = V.parts[i]; q.x += q.vx * ds; q.y += q.vy * ds; q.vy += 20 * ds; q.life -= ds; if (q.life <= 0) V.parts.splice(i, 1); }
      for (let i = V.pops.length - 1; i >= 0; i--) { const q = V.pops[i]; q.y -= 28 * ds; q.life -= ds; if (q.life <= 0) V.pops.splice(i, 1); }
      V.shake = Math.max(0, V.shake - ds); V.flash = Math.max(0, V.flash - ds);
    }
    draw();
  }

  /* ===== 그리기: 도트(픽셀) 아트 — 2026-10-31 23:48 하율 "디자인 싹다 바꿔"(도트 선택) =====
     교실·선생님·학생은 120×214 작은 캔버스(lo)에 한 칸 = 화면 3px로 찍고 그대로 키움(번짐 없이). 글자·말풍선·화면 위 표시는 사이트 UI(스티커)로 또렷하게. */
  const G = 3, LW = 120, LH = 214;
  const lo = document.createElement('canvas'); lo.width = LW; lo.height = LH;
  const g = lo.getContext('2d');
  const OL = '#2a2846';   // 도트 외곽선(사이트 도트 게임 runner.js와 같은 색)
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  // 그림 틀(글자 = 색 칸, '.' = 빈칸) → 외곽선을 자동으로 두른 작은 캔버스로 한 번만 만들어 둠
  const sprC = new Map();
  function spr(key, rows, pal, flip = false) {
    const id = key + (flip ? ':f' : ''); let c = sprC.get(id); if (c) return c;
    const h = rows.length, w = rows[0].length; c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
    const x = c.getContext('2d'), at = (i, j) => j >= 0 && j < h && i >= 0 && i < w && rows[j][flip ? w - 1 - i : i] !== '.';
    x.fillStyle = OL;
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (!at(i, j) && (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1))) x.fillRect(i + 1, j + 1, 1, 1);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][flip ? w - 1 - i : i]; if (ch === '.') continue; x.fillStyle = pal[ch] || '#f0f'; x.fillRect(i + 1, j + 1, 1, 1); }
    sprC.set(id, c); return c;
  }
  const put = (c, x, y) => g.drawImage(c, Math.round(x) - 1, Math.round(y) - 1);
  // 굵은 도트 선(팔·다리·막대기): 외곽선 먼저, 그다음 색
  function pline(x0, y0, x1, y1, w, c, ol = true) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1), o = Math.floor(w / 2);
    for (const [pad, col] of ol ? [[1, OL], [0, c]] : [[0, c]]) { g.fillStyle = col; for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); g.fillRect(x - o - pad, y - o - pad, w + pad * 2, w + pad * 2); } }
  }
  const blk = (x, y, w, h, c) => { px(x - 1, y - 1, w + 2, h + 2, OL); px(x, y, w, h, c); };

  // ----- 그림 틀 -----
  const T_HEAD_F = ['....HHHHHH....', '..HHlHHHHHHH..', '.HHllHHHHHHHH.', '.HHHHHHHhhHHH.', 'HHHSSSSSSShHHH', 'HHSSSSSSSSSSHH', 'HSBBBSSSSBBBSH', 'SGGGGGGGGGGGGS', 'SGLELGSSGLELGS', 'SGLLLGNSGLLLGS', 'SGGGGGNNGGGGGS', '.SSSSSSNSSSSS.', '.SsSSSSSSSSsS.', '..SsSMMMMSsS..', '..SSSSSSSSSS..', '...ssSSSSss...'];
  const T_HEAD_SUS = T_HEAD_F.map((r, j) => j === 5 ? 'HHSSSSSSSSSBHH' : j === 6 ? 'HSBBBSSSSSBBSH' : j === 8 ? 'SGEEEGSSGEEEGS' : j === 13 ? '..SsSSMMMSsS..' : r);
  const T_HEAD_ANG = T_HEAD_F.map((r, j) => j === 5 ? 'HHBSSSSSSSSBHH' : j === 6 ? 'HSSBBSSSSBBSSH' : j === 12 ? '.SrSSSSSSSSrS.' : j === 13 ? '..SsRRRRRRsS..' : j === 14 ? '..SSRRRRRRSS..' : r);
  const T_HEAD_B = ['....HHHHHH....', '..HHlHHHHHHH..', '.HHllHHHHHHHH.', '.HHlHHHHHHHHh.', 'HHHHHHHHHHHHhH', 'HHHHhHHHHHHHhH', 'SHHHHhHHHHHhHS', 'SHHHHhHHHHhHHS', 'SHHHHHhHHhHHHS', 'SHHHHHHhhHHHHS', '.HHHHHHHHHHHh.', '.hHHHHHHHHHHh.', '..HHHhHHhHHH..', '..hHhHhHhHhH..', '...SSSSSSSS...', '....SSSSSS....'];
  const T_HEAD_TURN = T_HEAD_B.map((r, j) => ({ 6: 'SHHHhHHHHHHSSS', 7: 'SHHHHHHhHHHSSS', 8: 'SHHhHHHHHHGGGG', 9: 'SHHHHHHHHHHSSS', 10: '.HHhHHHHHHSSs.', 11: '.HHHHHhHHHSSs.', 12: '..HhHHHHHHSS..' })[j] || r);
  const T_HEAD_PEEK = T_HEAD_B.map((r, j) => ({ 5: 'HHHHHHhHHHSBBH', 6: 'SHHHhHHHHSSSSS', 7: 'SHHHHHHhHGGGGS', 8: 'SHHhHHHHHGLELS', 9: 'SHHHHHHHHGLLLN', 10: '.HHhHHHHHGGGGS', 11: '.HHHHHhHHSSSS.', 12: '..HhHHHHSSMS..', 13: '..hHhHhHSSSS..' })[j] || r);
  const T_BODY_B = ['......SSSSSS......', '....WWWWWWWWWW....', '..WWWVVVVVVVVVWW..', '.WWWVVVVVVVVVVVWW.', 'WWWVVvVVvVVvVVvVWW', 'wWWVVvVVvVVvVVvVWw', 'wWWVVvVVvVVvVVvvWw', '.wWVVvVVvVVvVVvvw.', '..VVVvVVvVVvVVvv..', '..VVVvVVvVVvVVvv..', '..VVVvVVvVVvVVvv..', '..vvvvvvvvvvvvvv..', '..WWWWWWWWWWWWww..', '..bbbbbbbbbbbbbb..'];
  const T_BODY_F = ['......SSSSSS......', '....WWWWTTWWWW....', '..WWWVVWTTWVVVWW..', '.WWWVVVVTTVVVVVWW.', 'WWWVVVVVTtVVVVVWWW', 'wWWVVVVVTTVVVVVWWw', 'wWWVVVVVtTVVVVvWWw', '.wWVVVVVTTVVVVvWw.', '..VVVVVVoTVVVVvv..', '..VVVVVVVoVVVVvv..', '..VVVVVVVVVVVVvv..', '..vvvvvvvvvvvvvv..', '..WWWWWWWWWWWWww..', '..bbbbbbbyybbbbb..'];
  const T_LEGS = [...Array(16).fill('..PPPpPP..PPpPPP..'), '.PPPpPPP..PPPpPPP.', '.DDDDDDd..DDDDDDd.', 'DDDDDDDD..DDDDDDDD'];
  const TP = { H: '#dfe2e8', h: '#a9adb8', l: '#ffffff', S: '#f7caa1', s: '#dca274', G: '#1d1b2e', L: '#cfefff', E: '#1d1b2e', B: '#7d808a', M: '#9a3b46', N: '#dca274', W: '#f3f5fa', w: '#cfd6e2', V: '#8a6240', v: '#6c4a2f', T: '#c2364a', t: '#ffd25e', o: '#3b2414', b: '#3b2f2a', y: '#e8c25a', P: '#5d5a72', p: '#45425a', D: '#2a2028', d: '#6a5a58', R: '#c2405a', r: '#ff9a9a' };
  // 학생 머리(뒷모습) 10×10 — 모양별
  const K_HEAD = {
    short: ['..HHHHHH..', '.HHlHHHHH.', 'HHllHHHHHH', 'HHHHHHHhHH', 'SHHHHHHHhS', 'SHHhHHHHHS', '.HHHHHhHH.', '.HhHHHHHh.', '..HhHHhH..', '...SSSS...'],
    long: ['..HHHHHH..', '.HHlHHHHH.', 'HHllHHHHHH', 'HHHHHHHhHH', 'HHHHHHHHhH', 'HHHhHHHHHH', 'HHHHHhHHHH', 'HhHHHHHHhH', 'HHHhHHhHHH', 'HhHHHHHHhH', '.hHhHhHhH.'],
    buzz: ['..HHHHHH..', '.HHHlHHHH.', 'HHHHHHHHHH', 'HHHHHHHHHH', 'SHHHHHHHHS', 'SHHHHHHHHS', '.SHHHHHHS.', '..SSSSSS..', '...SSSS...', '...SSSS...'],
  };
  const K_BUN = ['...HHHH...', '..HlHHhH..', '...AAAA...'], K_TAIL = ['.HH.', '.Hh.', 'HHh.', 'HhH.', '.HH.'], K_TWIN = ['HH', 'Hh', 'hH', 'HH', '.H'];
  const K_CAP = ['..AAAAAA..', '.AAAAAAAA.', 'AAAAaAAAAA', 'AAAAAAAAAA', '.aaaaaaaa.'];
  const K_BODY = ['....WWWW....', '..BBBWWBBB..', '.BBBBBBBBBB.', 'BBBBBbBBBBBb', 'BBBBBbBBBBBb', 'BBBBBbBBBBbb', 'BBBBBbBBBBbb', 'BBBBBbBBBBbb', 'BBBBBbBBBBbb', '.bbbbbbbbbb.'];
  const K_SKIRT = ['.KKKKKKKKKK.', 'KKkKKkKKkKKk', 'KKkKKkKKkKKk', 'kKkKkKkKkKkK'];
  const DESK = ['.llllllllllllllllllll.', 'dddddddddddddddddddddd', 'DDDDDDDDDDDDDDDDDDDDDD', '.m..................m.', '.m..................m.'];
  const CHAIR = ['.cccccccccccccc.', 'cCCCCCCCCCCCCCCc', 'cCCCCCCCCCCCCCCc', '.cccccccccccccc.', '.m............m.', '.m............m.'];
  const FP = { l: '#f6d7a6', d: '#e2b47c', D: '#b8874f', m: '#7d879e', c: '#c99a63', C: '#e0b27a' };
  const shadeHex = (hex, f) => { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f).toString(16).padStart(2, '0')).join(''); };
  const kidPal = o => ({ H: o.hc, h: shadeHex(o.hc, -0.35), l: shadeHex(o.hc, 0.45), S: '#f7caa1', s: '#dca274', A: o.ac || '#ff6f9a', a: shadeHex(o.ac || '#ff6f9a', -0.3), B: o.cl.c, b: shadeHex(o.cl.c, -0.25), W: o.cl.w || '#f3f5fa', K: o.sk || '#3a4566', k: shadeHex(o.sk || '#3a4566', -0.3) });

  // ----- 교실 배경(한 번만) -----
  let bgC = null;
  function bg() {
    if (bgC) return bgC;
    bgC = document.createElement('canvas'); bgC.width = LW; bgC.height = LH;
    const x = bgC.getContext('2d'), P = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
    P(0, 0, LW, 79, '#eaf5fd'); for (let i = 3; i < LW; i += 8) P(i, 0, 1, 79, '#dcedfa');   // 벽(사이트 바탕색) + 세로 결
    P(0, 79, LW, 22, '#bfe0f5'); P(0, 79, LW, 1, '#ffffff'); P(0, 80, LW, 2, '#86bde4'); for (let i = 2; i < LW; i += 15) { P(i, 85, 12, 13, '#aed6f1'); P(i, 85, 12, 1, '#94c6ea'); P(i, 85, 1, 13, '#94c6ea'); }   // 아래 판자
    P(0, 100, LW, 2, '#6d4e31');
    for (let y = 102; y < LH; y++) P(0, y, LW, 1, (Math.floor((y - 102) / 7) % 2) ? '#c99a63' : '#c3935c');   // 바닥 판자 줄
    for (let y = 102, r = 0; y < LH; y += 7, r++) for (let i = (r % 3) * 13; i < LW; i += 38) P(i, y, 1, 7, '#a8784a');   // 판자 이음매
    // 전자칠판
    P(5, 15, 110, 51, OL); P(6, 16, 108, 49, '#2a3f56'); P(8, 18, 104, 44, '#173048'); P(8, 18, 104, 4, '#1f3b58');
    [['#ff8f8f', 11], ['#ffe08a', 15], ['#6fc6f4', 19], ['#ffffff', 23], ['#8fe8cf', 27]].forEach(([c, i]) => P(i, 19, 2, 2, c));
    P(98, 19, 11, 1, '#5d7a96'); P(59, 63, 2, 1, '#8fe8cf');
    for (let i = 0; i < 6; i++) P(10 + i * 3, 26 + i * 2, 1, 1, 'rgba(255,255,255,.08)');
    P(42, 66, 36, 3, OL); P(43, 66, 34, 2, '#4b5a70'); P(50, 65, 6, 1, '#ff8f8f'); P(58, 65, 5, 1, '#6fc6f4');   // 펜 받침
    // 급훈·시계
    P(74, 69, 28, 8, OL); P(75, 70, 26, 6, '#ffffff'); for (let i = 0; i < 9; i++) P(77 + i * 2.6, 72, 1, 2, '#173048');
    P(108, 69, 8, 8, OL); P(109, 70, 6, 6, '#ffffff'); P(111, 71, 1, 3, OL); P(112, 73, 2, 1, OL);
    // 교탁
    P(0, 80, 24, 22, OL); P(0, 81, 23, 20, '#b9875a'); P(0, 81, 23, 2, '#d9a873'); P(1, 87, 21, 1, '#a3754b'); P(1, 93, 21, 1, '#a3754b');
    P(2, 73, 11, 8, OL); P(3, 74, 9, 2, '#6fc6f4'); P(3, 76, 9, 2, '#ff8f8f'); P(3, 78, 9, 2, '#ffe08a'); P(15, 75, 5, 6, OL); P(16, 76, 3, 4, '#ffffff');
    return bgC;
  }
  // 판서: 글자 대신 도트 낙서(줄마다 색) — 진행은 V.board(글자 수)
  const BX = 12, BY = [26, 34, 42, 50];
  function boardInk() {
    const b = V.board, L = PAGES[b.page % PAGES.length];
    for (let i = 0; i <= Math.min(b.line, L.length - 1); i++) {
      const str = i < b.line ? L[i] : L[i].slice(0, b.ch), col = i === 0 ? '#ffe08a' : i === 3 ? '#ff8f8f' : '#f3f5fa';
      for (let c = 0; c < str.length && c < 26; c++) { const code = str.charCodeAt(c); if (code === 32) continue; const v = code % 7, x = BX + c * 3, y = BY[i];
        g.fillStyle = col; g.fillRect(x, y + (v % 2), 2, 1); g.fillRect(x + (v % 3 === 0 ? 1 : 0), y + 1, 1, 2 + (v % 2)); if (v > 2) g.fillRect(x, y + 3, 2, 1); if (code > 0xac00) g.fillRect(x + 1, y + (v % 2 ? 2 : 0), 1, 1); }
      if (i === 0 && b.line > 0) { g.fillStyle = '#ffe08a'; g.fillRect(BX, BY[0] + 5, Math.min(L[0].length, 26) * 3 - 1, 1); }
    }
    g.fillStyle = '#4a7aa8'; g.fillRect(88, 54, 20, 1); g.fillRect(98, 30, 1, 27);   // 그래프 축
    if (b.line >= 2) { g.fillStyle = '#8fe8cf'; for (let x = -9; x <= 9; x++) g.fillRect(98 + x, 50 - Math.round((x + 1) * (x + 1) * 0.22), 1, 1); }
  }
  function cursorPos() { const b = V.board, L = PAGES[b.page % PAGES.length], li = Math.min(b.line, L.length - 1); return { x: (BX + Math.min(b.ch, 26) * 3) * G, y: (BY[li] + 1) * G }; }

  // ----- 선생님 -----
  function drawTeacher() {
    const tst = s ? s.st : 'write', tm = s ? s.tm : 99, dur = s ? s.dur : 99;
    let face = 'back';
    if (tst === 'turn') face = (1 - tm / (s.tf || D.TURN_F)) < 0.5 ? 'peek' : 'front';
    else if (tst === 'turnback') face = (1 - tm / D.TURN_F) < 0.5 ? 'front' : 'peek';
    else if (tst === 'look' || tst === 'caught') face = 'front';
    const fx = Math.round(V.tx / G), fy = 106, ang = tst === 'caught', mood = ang ? 'ang' : tst === 'look' ? 'sus' : '';
    px(fx - 12, fy - 1, 24, 2, 'rgba(23,48,72,.22)');   // 발밑 그림자
    put(spr('t-legs', T_LEGS, TP), fx - 9, fy - 19);
    const bx = fx - 9, by = fy - 33;
    if (face === 'front') {
      put(spr('t-bf', T_BODY_F, TP), bx, by);
      // 팔·손·막대기
      if (ang) { pline(bx + 2, by + 4, bx - 7, by + 6, 3, TP.W); pline(bx - 7, by + 6, bx - 12, by + 4, 2, TP.S);   // 손가락질
        const w = RM() ? 0 : Math.round(Math.sin(V.t * 28) * 1.5); pline(bx + 15, by + 4, bx + 21, by - 2, 3, TP.W); pline(bx + 18, by + 3 + w, bx + 30, by - 18 + w, 2, '#b9813f'); blk(bx + 20, by - 4, 3, 3, TP.S); }
      else { pline(bx + 2, by + 4, bx + 1, by + 16, 3, TP.W); blk(bx, by + 16, 3, 3, TP.S); pline(bx + 15, by + 4, bx + 17, by + 16, 3, TP.W); pline(bx + 15, by + 25, bx + 20, by - 3, 2, '#b9813f'); blk(bx + 16, by + 16, 3, 3, TP.S); }
      put(spr('t-h' + mood, mood === 'ang' ? T_HEAD_ANG : mood === 'sus' ? T_HEAD_SUS : T_HEAD_F, TP), fx - 7, by - 15);
      if (mood === 'sus' && !RM()) { const e = Math.round(Math.sin(V.t * 3.2)); px(fx - 4 + e, by - 7, 1, 1, '#1d1b2e'); px(fx + 4 + e, by - 7, 1, 1, '#1d1b2e'); }
      if (ang) { px(fx + 7, by - 15, 1, 1, '#e0464e'); px(fx + 9, by - 15, 1, 1, '#e0464e'); px(fx + 8, by - 14, 1, 1, '#e0464e'); px(fx + 7, by - 13, 1, 1, '#e0464e'); px(fx + 9, by - 13, 1, 1, '#e0464e'); }
    } else {
      pline(bx - 2, by + 33, bx + 2, by - 1, 2, '#b9813f');   // 왼손 막대기(몸 뒤로 세워 듦)
      put(spr('t-bb', T_BODY_B, TP), bx, by);
      pline(bx + 2, by + 4, bx + 0, by + 15, 3, TP.W); blk(bx - 1, by + 15, 3, 3, TP.S);
      // 판서하는 손: 칠판 커서 쪽으로(펜 멈추면 살짝 뗌, 그 밖엔 내림)
      let hx = V.hx / G, hy = V.hy / G;
      if (tst === 'pause') { hx += 1; hy += 2; } else if (tst !== 'write') { hx = 9; hy = -28; }
      const sx0 = bx + 15, sy0 = by + 4, ddx = fx + hx - sx0, ddy = fy + hy - sy0, d = Math.hypot(ddx, ddy) || 1, m = Math.min(d, 26), ex = sx0 + ddx / d * m, ey = sy0 + ddy / d * m;
      pline(sx0, sy0, (sx0 + ex) / 2 + 3, (sy0 + ey) / 2 + 3, 3, TP.W); pline((sx0 + ex) / 2 + 3, (sy0 + ey) / 2 + 3, ex, ey, 3, TP.W); blk(ex - 1, ey - 1, 3, 3, TP.S); px(ex - 1, ey - 4, 1, 3, '#1d1b2e');
      const tw = V.twitch > 0 && !RM() ? Math.round(Math.sin(V.twitch * 60)) : 0;
      const head = face === 'peek' || tst === 'peek' ? ['t-hp', T_HEAD_PEEK] : tst === 'warn' ? ['t-ht', T_HEAD_TURN] : ['t-hb', T_HEAD_B];
      put(spr(head[0], head[1], TP), fx - 7 + tw, by - 15);
    }
  }

  // ----- 학생 -----
  const LIFE = (o, me) => RM() || me ? 0 : Math.round(Math.sin(V.t * 1.6 + o.ph) * 0.6);
  function kidHead(o, x, y, sway) {
    const pal = kidPal(o), hs = o.hs === 'wave' ? 'long' : o.hs, base = K_HEAD[hs] || K_HEAD.short;
    if (o.hs === 'pony') put(spr('tail' + o.hc, K_TAIL, pal), x + 3 + sway, y + 8);
    if (o.hs === 'twin') { put(spr('twin' + o.hc, K_TWIN, pal), x - 2 + sway, y + 3); put(spr('twin' + o.hc, K_TWIN, pal, true), x + 10 + sway, y + 3); }
    put(spr('h' + hs + o.hc, base, pal), x, y);
    if (o.hs === 'bun') put(spr('bun' + o.hc, K_BUN, { ...pal, A: '#ff6fa8' }), x, y - 3);
    if (o.acc === 'cap') put(spr('cap', K_CAP, { A: '#e0464e', a: '#a8323a' }), x, y - 1);
    if (o.acc === 'band') px(x, y + 2, 10, 1, '#ff6fa8');
    if (o.acc === 'phones') { px(x - 1, y + 1, 12, 1, '#3b6cf6'); blk(x - 1, y + 3, 2, 3, '#3b6cf6'); blk(x + 9, y + 3, 2, 3, '#3b6cf6'); }
    if (o.acc === 'ribbon') { px(x + 6, y - 1, 2, 2, '#ffd25e'); px(x + 9, y - 1, 2, 2, '#ffd25e'); px(x + 8, y, 1, 1, '#ffb020'); }
  }
  function kid(o, cx, by, party, me) {
    const pal = kidPal(o);
    put(spr('desk', DESK, FP), cx - 11, by - 21);
    if (o.pr === 1) { blk(cx - 8, by - 23, 5, 2, '#6fc6f4'); px(cx - 8, by - 24, 5, 1, '#ffe08a'); } else if (o.pr === 2) blk(cx + 4, by - 23, 5, 2, '#ff8f8f'); else if (o.pr === 3) blk(cx + 7, by - 25, 2, 4, '#8fe8cf');
    if (!party) {
      const b = LIFE(o, me), z = o.sleep;
      const nod = o.nod ? Math.round(o.nod / 6) : 0;
      put(spr('kb' + o.cl.c + (o.cl.w || ''), K_BODY.slice(0, 8), pal), cx - 6, by - 14 + b + (z ? 2 : 0));
      // 팔: 책상에 올림(필기하는 친구는 손이 움직임)
      const wr = !me && o.wr && !RM() ? Math.round(Math.sin(V.t * 9 + o.ph)) : 0;
      pline(cx - 6, by - 12 + b, cx - 3, by - 17, 2, o.cl.c); pline(cx + 5, by - 12 + b, cx + 2 + wr, by - 17, 2, o.cl.c);
      if (!z) kidHead(o, cx - 5, by - 23 + b + nod, 0); else kidHead(o, cx - 5, by - 19, 0);
      put(spr('chair', CHAIR, FP), cx - 8, by - 6);
      return;
    }
    // 파티: 일어나서 저마다 다른 춤(도트 프레임처럼 0.125초마다 자세가 바뀜)
    const q = Math.floor(V.t * 8 * o.tp) / 8, bb = q * Math.PI * 2 * o.tp * 1.2 + o.ph, P = pose(o.ds, bb), amp = o.amp || 1.2;
    const dy = Math.round((P.dy * amp - Math.abs(Math.sin(bb * 2)) * 5 * amp) / 4), dx = Math.round(P.dx * amp / 4);
    const lift = P.jump ? Math.round(P.jump * 4 * amp) : 0, ls = Math.round(Math.sin(bb) * 2);
    const hipY = by - 10 + dy;
    if (o.sk) { pline(cx - 2 + dx, hipY + 2, cx - 3 + ls, by - 2 - lift, 2, '#f7caa1'); pline(cx + 2 + dx, hipY + 2, cx + 3 - ls, by - 2 - lift, 2, '#f7caa1'); px(cx - 4 + ls, by - 4 - lift, 2, 2, '#ffffff'); px(cx + 2 - ls, by - 4 - lift, 2, 2, '#ffffff'); }
    else { pline(cx - 2 + dx, hipY, cx - 3 + ls, by - 2 - lift, 3, o.cl.p); pline(cx + 2 + dx, hipY, cx + 3 - ls, by - 2 - lift, 3, o.cl.p); }
    blk(cx - 5 + ls, by - 2 - lift, 3, 2, '#2f2a33'); blk(cx + 2 - ls, by - 2 - lift, 3, 2, '#2f2a33');
    put(spr('chair', CHAIR, FP), cx - 8, by - 6);
    if (o.sk) put(spr('sk' + o.sk, K_SKIRT, pal), cx - 6 + dx, hipY - 2);
    const top = hipY - 10 - (o.sk ? 1 : 0);
    put(spr('kbs' + o.cl.c + (o.cl.w || ''), K_BODY, pal), cx - 6 + dx, top);
    const f = 0.17, sl = [cx - 6 + dx, top + 2], sr = [cx + 5 + dx, top + 2];
    const L = [sl[0] + (P.L[0] + 22) * f, sl[1] + (P.L[1] + 90) * f], R = [sr[0] + (P.R[0] - 22) * f, sr[1] + (P.R[1] + 90) * f];
    pline(sl[0], sl[1], L[0], L[1], 2, o.cl.c); pline(sr[0], sr[1], R[0], R[1], 2, o.cl.c); blk(L[0] - 1, L[1] - 1, 2, 2, '#f7caa1'); blk(R[0] - 1, R[1] - 1, 2, 2, '#f7caa1');
    kidHead(o, cx - 5 + dx + Math.round(P.tilt * 4), top - 9, Math.round(Math.sin(bb * 2) * 1));
  }
  const CL = { blz: { c: '#34407a', p: '#3b3b49' }, hoodG: { c: '#9aa3b5', p: '#3b3b49', w: '#7d879e' }, hoodP: { c: '#ffa9cf', p: '#3b3b49', w: '#e88bb4' },
    hoodN: { c: '#62d9b8', p: '#3b3b49', w: '#45b897' }, pe: { c: '#ff6f6f', p: '#ff6f6f', w: '#ffffff' }, card: { c: '#f6e3c4', p: '#3b3b49' } };
  const KIDS = [
    { x: 16, y: 136, hc: '#2c2a3c', hs: 'short', cl: CL.blz, ds: 3, ph: 0.4, tp: 1.1, pr: 1, wr: 1 },
    { x: 46, y: 136, hc: '#5f3d26', hs: 'bun', cl: CL.card, sk: '#3a4566', ds: 5, ph: 1.7, tp: 0.9, sleep: true, pr: 0 },
    { x: 74, y: 136, hc: '#2c2a3c', hs: 'buzz', cl: CL.pe, ds: 7, ph: 2.6, tp: 1.2, pr: 2 },
    { x: 104, y: 136, hc: '#9a5a34', hs: 'wave', cl: CL.hoodP, sk: '#3a4566', acc: 'band', ds: 1, ph: 0.9, tp: 0.85, pr: 3, wr: 1 },
    { x: 18, y: 168, hc: '#2c2a3c', hs: 'twin', cl: CL.blz, sk: '#3a4566', ds: 6, ph: 3.1, tp: 1, pr: 1 },
    { x: 102, y: 168, hc: '#3b2a20', hs: 'short', cl: CL.hoodG, acc: 'phones', ds: 4, ph: 1.2, tp: 1.05, pr: 2, wr: 1 },
    { x: 13, y: 204, hc: '#5f3d26', hs: 'pony', cl: CL.hoodN, sk: '#3a4566', ds: 2, ph: 2.2, tp: 1.15, pr: 3 },
    { x: 107, y: 204, hc: '#2c2a3c', hs: 'short', cl: CL.blz, acc: 'cap', ds: 0, ph: 0.2, tp: 0.95, pr: 1 },
  ];
  const ME = { x: 60, y: 204, hc: '#2c2a3c', hs: 'short', cl: CL.blz, ph: 0, tp: 1, pr: 2 };
  function drawKids(party) {
    const m = s ? s.m2 / 2 : 1, lv = m >= 3.5 ? 6 : m >= 2.5 ? 0 : m >= 1.5 ? 1 : 2, amp = 1.1 + (m - 1) * 0.15;
    for (const o of KIDS) kid({ ...o, amp, sleep: party ? false : o.sleep }, o.x, o.y, party, false);
    const zzz = s ? s.sleep / D.SLEEP_FULL : 0, slept = !!(s && s.st === 'caught' && s.why === 'sleep');
    const nod = !party && zzz > 0.6 ? Math.max(0, Math.sin(V.t * (2 + zzz * 3))) * (zzz - 0.6) * 40 : 0;
    kid({ ...ME, amp, ds: lv, tp: 1 + (m - 1) * 0.12, sleep: slept, nod }, ME.x, ME.y, party, true);
    // '나' 화살표
    const ay = (party ? 168 : 174) + (RM() ? 0 : Math.round(Math.sin(V.t * 4)));
    put(spr('arrow', ['YYYYY', '.YYY.', '..Y..'], { Y: '#ffe08a' }), ME.x - 2, ay);
    return { zzz, party, slept };
  }
  // 파티: 바닥 타일이 박자에 맞춰 사이트 색으로 바뀌고, 도트 음표가 올라감(번쩍이는 효과는 쓰지 않음)
  const FLOOR_C = ['#6fc6f4', '#ffe08a', '#8fe8cf', '#a9c4ff', '#ff8f8f'];
  function drawFloorParty(lv) {
    const a = V.pv; if (a <= 0) return;
    const beat = Math.floor(V.t * 4);
    g.globalAlpha = 0.28 * a;
    for (let y = 108; y < LH; y += 9) for (let x = 0; x < LW; x += 9) { if (((x / 9 + y / 9 + beat) % 3) !== 0) continue; g.fillStyle = FLOOR_C[(x / 9 + y / 9 * 2 + beat) % FLOOR_C.length]; g.fillRect(x, y, 9, 9); }
    g.globalAlpha = 1;
    g.fillStyle = `rgba(23,48,72,${0.12 * a})`; g.fillRect(0, 0, LW, LH);
  }

  // ----- 화면 위(또렷한 UI): 말풍선·점수 팝업·경고·도장·HUD -----
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const fs = (f, lw = 2.4) => { ctx.fillStyle = f; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = K; ctx.stroke(); };
  const text = (t, x, y, size = 16, align = 'center', color = '#fff') => { ctx.fillStyle = color; ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); };
  const outlined = (t, x, y, size, color) => { ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = K; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); };
  function bubble(x, y, t, angry) {
    ctx.font = `${angry ? 15 : 14}px ${FONT}`; const w = ctx.measureText(t).width + 20, h = 28, bx = clamp(x - w / 2, 6, W - w - 6);
    rr(bx + 3, y - h + 3, w, h, 10); ctx.fillStyle = K; ctx.fill();
    rr(bx, y - h, w, h, 10); fs(angry ? '#ffe3e3' : '#fff', 2.5);
    ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x - 2, y + 9); ctx.lineTo(x + 6, y - 1); ctx.fillStyle = angry ? '#ffe3e3' : '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 2, y + 9); ctx.lineTo(x + 6, y); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
    text(t, bx + w / 2, y - 9, angry ? 15 : 14, 'center', angry ? '#c42b35' : K);
  }
  function drawAlert() {
    const tst = s ? s.st : '', looking = tst === 'look' || (tst === 'peek' && s.dur - s.tm >= D.PEEK_IN);
    if (looking && st.scene === 'play') { ctx.strokeStyle = `rgba(255,95,110,${0.55 + (RM() ? 0 : 0.25 * Math.sin(V.t * 14))})`; ctx.lineWidth = 9; ctx.strokeRect(4.5, 4.5, W - 9, H - 9); }   // 보는 동안: 화면 테두리
    if (V.alert > 0) { const sz = 44 * (V.alert > 0.5 ? 0.6 + (0.6 - V.alert) * 4 : 1); ctx.globalAlpha = Math.min(1, V.alert * 4); outlined('!', V.tx + 30, 126, sz, '#ff5f6e'); ctx.globalAlpha = 1; }
    if (V.whip > 0 && !RM()) { ctx.globalAlpha = Math.min(1, V.whip * 4); outlined('휙!', V.tx - 44, 150, 22, '#fff'); ctx.globalAlpha = 1; }
    if (V.wflash > 0) { ctx.fillStyle = `rgba(255,255,255,${V.wflash * 2.5})`; ctx.fillRect(0, 0, W, H); }
    if (V.stamp > 0) {
      const p = Math.min(1, V.stamp / 0.16), sc2 = 1.8 - 0.8 * p;
      ctx.save(); ctx.translate(180, 400); ctx.rotate(-0.1); ctx.scale(sc2, sc2); ctx.globalAlpha = Math.min(1, p * 1.5);
      ctx.font = `32px ${FONT}`; const w = ctx.measureText(V.stampT).width + 34;
      rr(-w / 2 + 4, -26 + 4, w, 52, 12); ctx.fillStyle = K; ctx.fill(); rr(-w / 2, -26, w, 52, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = K; ctx.stroke();
      ctx.fillStyle = '#e0283c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(V.stampT, 0, 2); ctx.textBaseline = 'alphabetic'; ctx.restore();
    }
  }
  const chip = (x, y, w, h, fill) => { rr(x + 3, y + 3, w, h, h / 2); ctx.fillStyle = K; ctx.fill(); rr(x, y, w, h, h / 2); fs(fill, 2.5); };
  function drawHud() {
    const sc = s ? D.scoreOf(s) : 0, m = s ? s.m2 / 2 : 1, sec = s ? Math.floor(s.f / D.FPS) : 0;
    const num = (t, x, y, c = K, sz = 16) => { ctx.font = `800 ${sz}px ${NUMF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = c; ctx.fillText(t, x, y); };
    chip(8, 8, 112, 30, '#ffffff'); text('점수', 30, 28, 13, 'center', '#4a5f74'); num(fmt(sc), 80, 29.5);
    const mc = m >= 3.5 ? '#ff8f8f' : m >= 2.5 ? '#ffe08a' : m >= 1.5 ? '#6fc6f4' : '#e6f3fc';
    chip(128, 8, 56, 30, mc); num('x' + m, 156, 29.5);
    chip(272, 8, 80, 30, '#ffffff'); num(Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), 312, 29.5);
    const zv = s ? s.sleep / D.SLEEP_FULL : 0;
    chip(52, 614, 296, 18, '#ffffff');
    if (zv > 0) { rr(56, 618, Math.max(10, 288 * zv), 10, 5); ctx.fillStyle = zv > 0.75 ? (Math.floor(V.t * 6) % 2 ? '#ff8f8f' : '#ff6b6b') : zv > 0.5 ? '#9bb8ff' : '#6fc6f4'; ctx.fill(); }
    chip(8, 610, 40, 26, zv > 0.75 ? '#ff8f8f' : '#ffe08a'); text('졸음', 28, 628, 13, 'center', K);
    if (s && s.f < D.FPS * 6) { ctx.globalAlpha = Math.min(1, (D.FPS * 6 - s.f) / D.FPS); outlined(touchSeen ? '화면을 꾹 누르면 춤!' : '꾹 누르면 춤!', 180, 598, 17, '#fff'); ctx.globalAlpha = 1; }
  }
  function drawCount() {
    ctx.fillStyle = 'rgba(23,48,72,.3)'; ctx.fillRect(0, 0, W, H);
    const t = st.scene === 'count' ? '연결 중…' : String(Math.max(1, Math.ceil((1000 - countT) / 1000)));
    outlined(t, W / 2, 340, t.length > 2 ? 34 : 70, '#fff');
  }
  function draw() {
    if (!cv.width) return;
    // 1) 도트 장면
    g.drawImage(bg(), 0, 0); boardInk();
    const lv = s ? (s.m2 - 2) / 2 : 0, party = !!(s && s.dancing && st.scene === 'play');
    drawFloorParty(lv);
    drawTeacher();
    const kd2 = drawKids(party);
    for (const q of V.parts) { g.globalAlpha = Math.min(1, q.life * 1.5); const x = Math.round(q.x / G), y = Math.round(q.y / G); if (q.kind === 'note') { put(spr('note' + q.c, ['..XX', '..X.', '..X.', 'XXX.', 'XX..'], { X: q.c }), x, y); } else px(x, y, 2, 2, q.c); } g.globalAlpha = 1;
    // 2) 키워서 찍기(흔들림은 도트 한 칸 단위)
    const sc = k * dpr; ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.imageSmoothingEnabled = false;
    const sh = V.shake > 0 && !RM() ? G * Math.round((Math.random() - 0.5) * 3 * V.shake / 0.45) : 0;
    ctx.fillStyle = '#eaf5fd'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(lo, sh, 0, LW * G, LH * G);
    // 3) 또렷한 UI
    if (kd2.slept || (!kd2.party && kd2.zzz > 0.75)) for (let i = 0; i < 2; i++) { const a = (V.t * 0.8 + i * 0.5) % 1; ctx.globalAlpha = 1 - a; outlined(i ? 'Z' : 'z', 200 + a * 10, 520 - a * 22, 15 + a * 6, '#e9e4ff'); } ctx.globalAlpha = 1;
    text('나', ME.x * G, (party ? 168 : 174) * G - 4, 13, 'center', K);
    for (const q of V.pops) { ctx.globalAlpha = Math.min(1, q.life * 2); outlined(q.t, q.x, q.y, q.size, q.c); } ctx.globalAlpha = 1;
    if (V.bubT > 0 && V.bub) bubble(V.tx + 8, s && s.st === 'caught' ? 112 : 124, V.bub, V.bubAngry && s && s.st === 'caught');
    if (V.flash > 0) { ctx.fillStyle = `rgba(255,95,110,${V.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    drawAlert();
    if (st.scene !== 'ready') drawHud();
    if (st.scene === 'count' || st.scene === 'resume') drawCount();
  }

  // 춤 동작: 판 시각 b(라디안)로 몸 흔들기·팔 위치(서 있는 자세 기준 좌표)
  const lerpP = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  function pose(ds, b) {
    const S = Math.sin(b), A = Math.abs(S);
    switch (ds) {
      case 0: { const f = clamp(S * 2.5, -1, 1), u = (f + 1) / 2; return { dx: f * 4, dy: -A * 4, tilt: f * 0.12, L: lerpP([-34, -62], [-48, -150], u), R: lerpP([48, -150], [34, -62], u) }; }   // 디스코 찌르기(부드럽게 넘어감)
      case 1: return { dx: S * 6, dy: -A * 3, tilt: S * 0.15, L: [-30 + S * 14, -142], R: [30 + S * 14, -142] };   // 두 팔 흔들기
      case 2: { const up = Math.sin(b * 2) > 0; return { dx: 0, dy: up ? -6 : 0, tilt: up ? -0.08 : 0.04, L: [-30, -74], R: up ? [24, -154] : [32, -112] }; }   // 주먹 위로
      case 3: { const n = Math.floor((b / 1.5708) % 4 + 4) % 4, P = [[[-48, -92], [48, -92]], [[-42, -134], [48, -92]], [[-48, -92], [42, -134]], [[-26, -62], [26, -62]]]; return { dx: [0, -3, 3, 0][n], dy: 0, tilt: 0, L: P[n][0], R: P[n][1] }; }   // 로봇
      case 4: return { dx: 0, dy: -Math.abs(Math.sin(b * 2)) * 3, tilt: Math.sin(b * 2) * 0.35, L: [-14, -76], R: [18 + Math.sin(b * 4) * 7, -62] };   // 헤드뱅 + 에어 기타
      case 5: { const c = Math.abs(S); return { dx: 0, dy: -c * 3, tilt: 0, L: [-4 - c * 16, -152], R: [4 + c * 16, -152] }; }   // 머리 위 박수
      case 6: { const a = b * 1.4; return { dx: S * 4, dy: -Math.abs(Math.sin(b * 2)) * 4, tilt: S * 0.2, L: [-22 + Math.cos(a) * 30, -94 + Math.sin(a) * 30], R: [22 - Math.cos(a) * 30, -94 - Math.sin(a) * 30] }; }   // 풍차
      default: { const j = A; return { dx: 0, dy: -j * 16, tilt: 0, L: [-40, -142 - j * 6], R: [40, -142 - j * 6], jump: j }; }   // 점프
    }
  }
  /* --- 소리 버튼 --- */
  const paintSnd = () => { const on = sfx.on, t = on ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${on ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', on); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; sndBtn.classList.toggle('on', on); };
  sndBtn.onclick = () => { sfx.set(!sfx.on); paintSnd(); opts.onSound?.(sfx.on); sndBtn.blur(); };
  paintSnd();

  fit(); prefetch();
  if (opts.quick) { st.scene = 'ready'; start(); } else showReady();
  raf = requestAnimationFrame(frame);

  return {
    st, get sim() { return s; }, get best() { return best; },
    setBest(b) { best = Math.max(best, b || 0); },
    msg(html) { msgNow = html; const m = ov.querySelector('.dn-msg'); if (m && st.scene === 'over') m.innerHTML = html; },
    setSound(on) { sfx.set(on); paintSnd(); },
    start, pause, resume, again: () => again(),
    _hold(on) { kHeld = on ? 1 : 0; sync(); },   // 테스트용
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); sfx.beat(false); sfx.set(false); evRun++;
      document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', vis);
    },
  };
}

/* ===== 소리(Web Audio 합성, 기본 꺼짐) ===== */
function makeSfx() {
  let ac = null, on = false, nextBeat = 0;
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } if (ac?.state === 'suspended') ac.resume().catch(() => {}); return ac; };
  const tone = (f, d, type = 'square', v = 0.06, f2 = 0, delay = 0) => {
    if (!on) return; const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  };
  return {
    get on() { return on; },
    set(x) { on = !!x; if (on) ctx(); },
    unlock() { if (on) ctx(); },
    beep(go) { tone(go ? 880 : 520, go ? 0.25 : 0.12, 'square', 0.05); },
    tap() { tone(300, 0.05, 'triangle', 0.1); tone(300, 0.05, 'triangle', 0.09, 0, 0.14); },   // 막대기로 교탁 톡톡
    whoosh() { tone(500, 0.15, 'sine', 0.04, 200); },
    whip() { tone(1400, 0.09, 'sawtooth', 0.04, 300); },
    peek() { tone(420, 0.06, 'sine', 0.03, 520); },
    safe() { tone(880, 0.1, 'sine', 0.07, 1320); tone(1320, 0.12, 'sine', 0.05, 0, 0.08); },
    caught() { tone(220, 0.4, 'sawtooth', 0.08, 90); },
    mult(m2) { tone(500 + m2 * 60, 0.09, 'square', 0.045, 800 + m2 * 80); },
    beat(dancing, t, m2) {   // 춤추는 동안 작은 쿵짝(배율 오르면 빨라짐)
      if (!on || !dancing) { nextBeat = 0; return; }
      const a = ctx(); if (!a) return;
      const gap = 0.5 - Math.min(0.2, (m2 - 2) * 0.035);
      if (!nextBeat || a.currentTime >= nextBeat) { tone(90, 0.12, 'sine', 0.09, 50); tone(1800, 0.03, 'square', 0.015, 0, gap / 2); nextBeat = a.currentTime + gap; }
    },
  };
}
