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
    const handX = T_H * RECT.t[0][2] / RECT.t[0][3] * (T_HAND - 0.5);   // 펜 든 손이 칠판 글씨 끝에 오게
    V.tx += clamp(clamp(c.x - handX, 64, 300) - V.tx, -46 * dt, 46 * dt);
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

  /* ===== 그리기: 2D 일러스트 — 2026-11-01 00:05 하율 "2D 그림 느낌으로"(도트 대신) =====
     교실 배경·선생님(뒤·멈춤·곁눈질·의심·화남)·친구 9명(앉음·춤 2프레임)·빈 책상은 그림 파일(public/dance/*.webp, Higgsfield로 그린 웹툰풍 일러스트)을 잘라 둔 것.
     여기서는 위치·크기·움직임(숨쉬기·통통·흔들림·휙 돌아서기)만 붙임. 글자·말풍선·점수 칩은 사이트 스티커 UI. */
  const RECT = {"sit": [[0, 0, 166, 192], [168, 0, 173, 164], [343, 0, 172, 190], [517, 0, 164, 190], [683, 0, 169, 191], [854, 0, 172, 197], [1028, 0, 166, 193], [1196, 0, 169, 194], [1367, 0, 172, 197]], "d1": [[0, 0, 130, 203], [132, 0, 122, 210], [256, 0, 122, 194], [380, 0, 119, 193], [501, 0, 141, 192], [644, 0, 139, 192], [785, 0, 114, 201], [901, 0, 126, 207], [1029, 0, 155, 213]], "d2": [[0, 0, 126, 200], [128, 0, 128, 195], [258, 0, 123, 191], [383, 0, 110, 189], [495, 0, 135, 189], [632, 0, 131, 191], [765, 0, 108, 198], [875, 0, 124, 200], [1001, 0, 128, 192]], "t": [[0, 0, 140, 321], [142, 0, 122, 321], [266, 0, 110, 319], [378, 0, 120, 322], [500, 0, 127, 332]], "desk": [[0, 0, 342, 350]]};
  const IMG = {}; let imgReady = false;
  { const names = ['bg', 't', 'sit', 'd1', 'd2', 'desk']; let left = names.length;
    for (const n of names) { const im = new Image(); im.decoding = 'async'; im.onload = im.onerror = () => { if (--left === 0) { imgReady = true; draw(); } }; im.src = '/dance/' + n + '.webp?v=1'; IMG[n] = im; } }
  // 아틀라스의 i번째 그림을 바닥 가운데(x, y) 기준으로 높이 h에 맞춰 그림(sx: 가로 배율 — 휙 돌 때 납작해짐)
  function sprite(sheet, i, x, y, h, sx = 1, rot = 0) {
    const r = RECT[sheet][i], w = h * r[2] / r[3];
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx, 1);
    ctx.drawImage(IMG[sheet], r[0], r[1], r[2], r[3], -w / 2, -h, w, h); ctx.restore(); return w;
  }
  // 칠판(배경 그림의 화면 영역: 가로 44~296, 세로 70~191)
  const LINE_Y = [96, 122, 148, 172], LINE_X = 58;
  const boardFont = i => i === 0 ? `18px ${FONT}` : `15px ${FONT}`;
  function boardInk() {
    const b = V.board, L = PAGES[b.page % PAGES.length];
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (let i = 0; i <= Math.min(b.line, L.length - 1); i++) {
      const str = i < b.line ? L[i] : L[i].slice(0, b.ch); ctx.font = boardFont(i); ctx.fillStyle = i === 0 ? '#ffe08a' : i === 3 ? '#ff9b9b' : '#f2f6ff'; ctx.fillText(str, LINE_X, LINE_Y[i]);
      if (i === 0 && b.line > 0) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LINE_X, LINE_Y[0] + 5); ctx.lineTo(LINE_X + ctx.measureText(L[0]).width, LINE_Y[0] + 5); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(125,211,255,.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(236, 170); ctx.lineTo(288, 170); ctx.moveTo(262, 180); ctx.lineTo(262, 116); ctx.stroke();
    if (b.line >= 2) { ctx.strokeStyle = '#8fe8cf'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -22; x <= 22; x += 2) { const y = 152 - ((x + 3) * (x + 3)) * 0.07; x === -22 ? ctx.moveTo(262 + x, y) : ctx.lineTo(262 + x, y); } ctx.stroke(); }
  }
  function cursorPos() {
    const b = V.board, L = PAGES[b.page % PAGES.length], li = Math.min(b.line, L.length - 1);
    ctx.font = boardFont(li); return { x: LINE_X + ctx.measureText(L[li].slice(0, b.ch)).width, y: LINE_Y[li] - 6 };
  }
  const T_H = 236, T_FEET = 348, T_HAND = 0.37;   // 선생님 키·발 높이 · 펜 든 손의 가로 위치(그림 폭 대비)

  // ----- 선생님 -----
  function drawTeacher() {
    const tst = s ? s.st : 'write', tm = s ? s.tm : 99;
    // 그림: 0 뒤(판서) · 1 뒤(멈춤·흠) · 2 곁눈질 · 3 앞(의심) · 4 앞(화남)
    let fr = tst === 'write' ? 0 : tst === 'warn' || tst === 'pause' ? 1 : tst === 'peek' ? 2 : tst === 'caught' ? 4 : 3, sx = 1;
    if (tst === 'turn') { const p = 1 - tm / (s.tf || D.TURN_F); if (p < 0.5) { fr = 2; sx = 1 - p * 1.6; } else { fr = 3; sx = 0.2 + (p - 0.5) * 1.6; } }
    else if (tst === 'turnback') { const p = 1 - tm / D.TURN_F; if (p < 0.5) { fr = 3; sx = 1 - p * 1.6; } else { fr = 1; sx = 0.2 + (p - 0.5) * 1.6; } }
    const wr = tst === 'write' && !RM() ? Math.sin(V.t * 18) * 0.6 : 0, tw = V.twitch > 0 && !RM() ? Math.sin(V.twitch * 60) * 1.2 : 0;
    const shake = tst === 'caught' && !RM() ? Math.sin(V.t * 40) * 1.2 : 0;
    ctx.fillStyle = 'rgba(23,48,72,.18)'; ctx.beginPath(); ctx.ellipse(V.tx, T_FEET - 2, 40, 7, 0, 0, 7); ctx.fill();
    sprite('t', fr, V.tx + wr + tw + shake, T_FEET, fr === 4 ? T_H * 1.03 : T_H, Math.max(0.08, sx));
  }

  // ----- 반 친구들(앉음 ↔ 일어나 춤) -----
  // 자리: [그림 번호, x, 바닥 y, 높이] — 뒷줄 작게 · 앞줄 크게(멀고 가까움). 8번 = 나(맨 앞 가운데)
  const SEATS = [[0, 72, 432, 78], [1, 180, 432, 78], [2, 288, 432, 78], [3, 58, 532, 98], [4, 180, 532, 98], [5, 302, 532, 98], [6, 44, 662, 132], [7, 316, 662, 132], [8, 180, 662, 132]];
  const PH = [0.4, 1.7, 2.6, 0.9, 3.1, 1.2, 2.2, 0.2, 0], TP = [1.1, 0.9, 1.2, 0.85, 1, 1.05, 1.15, 0.95, 1];
  function drawKids(party) {
    const m = s ? s.m2 / 2 : 1, amp = 1 + (m - 1) * 0.25, zzz = s ? s.sleep / D.SLEEP_FULL : 0, slept = !!(s && s.st === 'caught' && s.why === 'sleep');
    for (const [i, x, y, h] of SEATS) {
      const me = i === 8;
      if (!party) {
        let dy = RM() ? 0 : Math.sin(V.t * 1.6 + PH[i]) * 0.8, rot = 0;
        if (me && (slept || zzz > 0.6)) { const nod = slept ? 1 : Math.max(0, Math.sin(V.t * (2 + zzz * 3))) * (zzz - 0.6) * 2.5; dy += nod * 10; rot = nod * 0.05; }
        sprite('sit', i, x, y + dy, h, 1, rot);
        continue;
      }
      // 일어나서 춤: 빈 책상·의자 + 2장 번갈아(박자) + 통통·좌우 흔들림, 배율이 오를수록 빠르고 크게
      sprite('desk', 0, x, y, h * 0.92);
      const t = V.t * (2.2 + (m - 1) * 0.7) * TP[i] + PH[i], f = Math.floor(t * 2) % 2 ? 'd2' : 'd1';
      const bounce = RM() ? 0 : Math.abs(Math.sin(t * Math.PI)) * 7 * amp * h / 100, sway = RM() ? 0 : Math.sin(t * Math.PI) * 0.06 * amp;
      const fy = y + h * 0.1;   // 의자 밖 통로로 나와서(책상 앞이 아니라 카메라 쪽) 춤
      ctx.fillStyle = 'rgba(23,48,72,.22)'; ctx.beginPath(); ctx.ellipse(x, fy, h * 0.3, h * 0.06, 0, 0, 7); ctx.fill();
      sprite(f, i, x, fy - bounce, h * 1.18, 1, sway);
    }
    // '나' 표시
    const ay = (party ? 500 : 520) + (RM() ? 0 : Math.sin(V.t * 4) * 3);
    ctx.beginPath(); ctx.moveTo(171, ay); ctx.lineTo(189, ay); ctx.lineTo(180, ay + 10); ctx.closePath(); ctx.fillStyle = '#ffe08a'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = K; ctx.stroke();
    ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = K; ctx.fillText('나', 180, ay - 4);
    return { zzz, slept };
  }
  // 파티: 교실이 살짝 어두워지고 친구들 발밑에 색 조명(번쩍임 없이 은은하게)
  const GLOW = ['#6fc6f4', '#ffe08a', '#8fe8cf', '#a9c4ff', '#ff8f8f'];
  function drawPartyLight() {
    const a = V.pv; if (a <= 0) return;
    ctx.fillStyle = `rgba(23,48,72,${0.28 * a})`; ctx.fillRect(0, 300, W, H - 300);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    SEATS.forEach(([i, x, y, h], n) => { const c = GLOW[(n + Math.floor(V.t * 2)) % GLOW.length], gr = ctx.createRadialGradient(x, y + h * 0.1, 2, x, y + h * 0.1, h * 0.55); gr.addColorStop(0, c + '66'); gr.addColorStop(1, c + '00'); ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(x - h * 0.6, y + h * 0.1 - h * 0.6, h * 1.2, h * 1.2); });
    ctx.restore();
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
    const sc = k * dpr; ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (!imgReady) { ctx.fillStyle = '#eaf5fd'; ctx.fillRect(0, 0, W, H); text('그림 불러오는 중…', W / 2, H / 2, 16, 'center', K); return; }
    const party = !!(s && s.dancing && st.scene === 'play');
    ctx.save();
    if (V.shake > 0 && !RM()) ctx.translate((Math.random() - 0.5) * 8 * V.shake / 0.45, (Math.random() - 0.5) * 6 * V.shake / 0.45);
    ctx.drawImage(IMG.bg, 0, 0, W, H);
    boardInk();
    drawTeacher();
    drawPartyLight();
    const kd2 = drawKids(party);
    for (const q of V.parts) { ctx.globalAlpha = Math.min(1, q.life * 1.5); if (q.kind === 'note') outlined('♪', q.x, q.y, 18, q.c); else { ctx.fillStyle = q.c; ctx.fillRect(q.x - 2.5, q.y - 2.5, 5, 5); } } ctx.globalAlpha = 1;
    ctx.restore();
    if (kd2.slept || (!party && kd2.zzz > 0.75)) for (let i = 0; i < 2; i++) { const a = (V.t * 0.8 + i * 0.5) % 1; ctx.globalAlpha = 1 - a; outlined(i ? 'Z' : 'z', 206 + a * 10, 540 - a * 22, 16 + a * 6, '#e9e4ff'); } ctx.globalAlpha = 1;
    for (const q of V.pops) { ctx.globalAlpha = Math.min(1, q.life * 2); outlined(q.t, q.x, q.y, q.size, q.c); } ctx.globalAlpha = 1;
    if (V.bubT > 0 && V.bub) bubble(V.tx + 10, s && s.st === 'caught' ? 104 : 116, V.bub, V.bubAngry && s && s.st === 'caught');
    if (V.flash > 0) { ctx.fillStyle = `rgba(255,95,110,${V.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    drawAlert();
    if (st.scene !== 'ready') drawHud();
    if (st.scene === 'count' || st.scene === 'resume') drawCount();
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
