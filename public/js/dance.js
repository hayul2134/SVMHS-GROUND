// SVMHS GROUND — 선생님 몰래 춤추기 화면 (2026-10-31 하율: "선생님은 전자칠판 앞에서 수업, 나무 막대기를 한 손에, 네모난 안경, 머리숱 많은 60대 남자 선생님", 미리보기 깃발 dance-game)
// 규칙·판 진행은 dance-score.js(서버와 같음) — 여기는 그리기·입력·소리만. 판에 영향을 주는 값은 전부 시뮬레이션(s)에서 읽음.
// 판서 글씨·선생님 걷기·친구들 반응·말풍선은 그림일 뿐(판과 무관). 입력(누름/뗌)은 1/60초 프레임 번호로 기록(rounds) → 서버가 같은 판을 다시 돌려 점수를 확인.
import * as D from './dance-score.js';

const W = 360, H = 640;
const K = '#173048';   // 사이트 잉크색(--ink)과 같게 — 2026-10-31 하율 '교실·소품·UI까지 통일감'
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
const LINE_Y = [84, 110, 136, 160], LINE_X = 44;
const boardFont = i => i === 0 ? `17px ${FONT}` : `14px ${FONT}`;
const CAUGHT_LINES = ['거기 너!! 뭐 하냐!', '지금 춤추냐?!', '앞으로 나와!', '수업 시간에 무슨 짓이야!'];
const SLEEP_LINES = ['거기 자는 학생!!', '수업 시간에 졸아?!', '일어나! 뒤로 나가!'];
const SKIN = '#f1c9a5', SKIN2 = '#e2ad86', HAIR = '#d4d6dc', HAIR2 = '#9fa3ad', SHIRT = '#eef2f8', VEST = '#7c5b3f', VEST2 = '#6a4c33', PANTS = '#5d5a66', WOOD = '#b9813f';

export function createDance(root, opts = {}) {
  root.innerHTML = `<div class="dn-scr" tabindex="-1"><canvas aria-label="선생님 몰래 춤추기 게임 화면"></canvas><div class="hr-ov dn-ov" hidden></div></div>
    <div class="hr-bar dn-bar"><p class="hr-keys dn-keys"><span class="hk"><span data-ka="dance"></span> 누르고 있으면 춤 · 떼면 공부하는 척</span></p><button type="button" class="btn ghost hr-snd dn-snd" aria-pressed="false"></button></div>`;
  const scr = root.querySelector('.dn-scr'), cv = scr.querySelector('canvas'), ov = scr.querySelector('.dn-ov'), sndBtn = root.querySelector('.dn-snd');
  let ctx = cv.getContext('2d', { alpha: false });   // 배경 캐시를 그릴 땐 잠깐 다른 캔버스로 바뀜(bgArt)
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
  function cursorPos() {
    const b = V.board, L = PAGES[b.page % PAGES.length], li = Math.min(b.line, L.length - 1);
    ctx.font = boardFont(li); return { x: LINE_X + ctx.measureText(L[li].slice(0, b.ch)).width, y: LINE_Y[li] - 5 };
  }
  function boardStep(dt) {
    const b = V.board, L = PAGES[b.page % PAGES.length];
    if (b.hold > 0) { b.hold -= dt; if (b.hold <= 0) { b.page++; b.line = 0; b.ch = 0; } return; }
    b.acc += dt * 6;
    while (b.acc >= 1) { b.acc--; b.ch++; if (b.ch > L[b.line].length) { b.line++; b.ch = 0; if (b.line >= L.length) { b.line = L.length - 1; b.ch = L[b.line].length; b.hold = 1.2; return; } } }
  }
  function writeStep(dt) {
    boardStep(dt); const c = cursorPos();
    V.tx += clamp(clamp(c.x - 8, 70, 292) - V.tx, -46 * dt, 46 * dt); V.hx = c.x - V.tx; V.hy = c.y - 318;
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

  /* ===== 그리기 ===== */
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const fs = (f, lw = 2.4) => { ctx.fillStyle = f; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = K; ctx.stroke(); };
  const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
  const limb = (x1, y1, x2, y2, w, c, mx, my) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [lw, col] of [[w + 4.5, K], [w, c]]) { ctx.beginPath(); ctx.moveTo(x1, y1); if (mx !== undefined) ctx.lineTo(mx, my); ctx.lineTo(x2, y2); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke(); }
  };
  const text = (t, x, y, size = 16, align = 'center', color = '#fff') => { ctx.fillStyle = color; ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); };
  const outlined = (t, x, y, size, color) => { ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = K; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); };
  function bubble(x, y, t, angry) {
    ctx.font = `${angry ? 15 : 14}px ${FONT}`; const w = ctx.measureText(t).width + 20, h = 28, bx = clamp(x - w / 2, 6, W - w - 6);
    rr(bx, y - h, w, h, 12); fs(angry ? '#ffe3e3' : '#fff', 2.2);
    ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x - 2, y + 9); ctx.lineTo(x + 6, y - 1); ctx.fillStyle = angry ? '#ffe3e3' : '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 2, y + 9); ctx.lineTo(x + 6, y); ctx.strokeStyle = K; ctx.lineWidth = 2.2; ctx.stroke();
    text(t, bx + w / 2, y - 9, angry ? 15 : 14, 'center', angry ? '#c42b35' : K);
  }

  // 교실 배경(벽·바닥·칠판 틀·교탁·시계) — 안 바뀌는 부분은 한 장에 그려 두고 찍음(태블릿 부담 줄이기)
  let bg = null;
  function bgArt() {
    const sc = k * dpr; if (bg && bg.sc === sc) return bg.c;
    const c = document.createElement('canvas'); c.width = Math.ceil(W * sc); c.height = Math.ceil(H * sc);
    const keep = ctx, x = c.getContext('2d'); x.scale(sc, sc); ctx = x;   // 그리기 도우미(rr·fs…)를 잠깐 이 캔버스로
    let gr = x.createLinearGradient(0, 0, 0, 236); gr.addColorStop(0, '#f5fbff'); gr.addColorStop(1, '#e3f1fb'); x.fillStyle = gr; x.fillRect(0, 0, W, 236);
    x.strokeStyle = 'rgba(30,110,180,.07)'; x.lineWidth = 1; for (let i = 12; i < W; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 236); x.stroke(); }
    // 아래 벽 판자(초록)
    gr = x.createLinearGradient(0, 236, 0, 300); gr.addColorStop(0, '#bfe0f5'); gr.addColorStop(1, '#9fcdee'); x.fillStyle = gr; x.fillRect(0, 236, W, 64);
    x.fillStyle = '#86bde4'; x.fillRect(0, 236, W, 5); x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(0, 236, W, 1.5);
    x.strokeStyle = 'rgba(23,48,72,.16)'; x.lineWidth = 1.5; for (let i = 6; i < W; i += 44) { x.strokeRect(i, 247, 36, 44); }
    // 바닥: 원근 판자
    gr = x.createLinearGradient(0, 300, 0, H); gr.addColorStop(0, '#c99a63'); gr.addColorStop(0.5, '#bb8a55'); gr.addColorStop(1, '#a3733f'); x.fillStyle = gr; x.fillRect(0, 300, W, 340);
    x.strokeStyle = 'rgba(80,45,15,.22)'; x.lineWidth = 1.2;
    for (let i = -14; i <= 26; i++) { const x0 = 180 + i * 22, vx = 180, vy = 140, t = (H - vy) / (300 - vy); x.beginPath(); x.moveTo(x0, 300); x.lineTo(vx + (x0 - vx) * t, H); x.stroke(); }
    x.strokeStyle = 'rgba(80,45,15,.16)'; for (let y = 312, n = 0; y < H; y += 10 + n * 2.2, n++) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    // 창문 빛(왼쪽에서 비스듬히)
    x.fillStyle = 'rgba(255,248,220,.10)'; x.beginPath(); x.moveTo(0, 330); x.lineTo(120, 300); x.lineTo(260, 640); x.lineTo(0, 640); x.fill();
    x.fillStyle = 'rgba(255,248,220,.07)'; x.beginPath(); x.moveTo(0, 420); x.lineTo(70, 400); x.lineTo(150, 640); x.lineTo(0, 640); x.fill();
    x.fillStyle = '#6d4e31'; x.fillRect(0, 298, W, 5); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 298, W, 1);
    // 전자칠판 틀(두께·받침)
    rr(19, 50, 328, 150, 12); x.fillStyle = 'rgba(0,0,0,.12)'; x.fill();
    rr(16, 46, 328, 150, 12); fs('#2a3f56', 3);
    gr = x.createLinearGradient(0, 46, 0, 196); gr.addColorStop(0, '#3d5874'); gr.addColorStop(1, '#22364c'); rr(18, 48, 324, 146, 11); x.fillStyle = gr; x.fill();
    rr(128, 194, 104, 8, 3); fs('#4b525f', 2); rr(150, 192, 22, 4, 2); fs('#ff6b6b', 1.4); rr(178, 192, 18, 4, 2); fs('#7dd3ff', 1.4);
    // 급훈 액자
    rr(225, 207, 82, 24, 6); x.fillStyle = K; x.fill(); rr(222, 204, 82, 24, 6); fs('#ffffff', 2.2); x.fillStyle = K; x.font = `11px ${FONT}`; x.textAlign = 'center'; x.fillText('급훈 · 정직과 성실', 263, 220);
    // 교탁(책·머그컵)
    rr(-10, 250, 74, 56, 6); fs('#b9875a', 2.6); x.fillStyle = '#a3754b'; x.fillRect(-8, 262, 70, 4); x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(-6, 268, 66, 2);
    rr(-14, 244, 82, 10, 4); fs('#8f6340', 2.4);
    rr(4, 234, 30, 6, 2); fs('#5ec8ff', 1.8); rr(6, 228, 26, 6, 2); fs('#ff8f8f', 1.8); rr(8, 222, 22, 6, 2); fs('#ffd25e', 1.8);
    rr(44, 230, 12, 14, 3); fs('#fff', 1.8); x.strokeStyle = K; x.lineWidth = 1.8; x.beginPath(); x.arc(57, 237, 3.5, -1.3, 1.3); x.stroke();
    // 시계
    ell(336, 222, 12, 12); fs('#fff', 2.4); x.strokeStyle = K; x.lineWidth = 1.8; x.beginPath(); x.moveTo(336, 222); x.lineTo(336, 214); x.moveTo(336, 222); x.lineTo(342, 224); x.stroke();
    ctx = keep;
    bg = { sc, c }; return c;
  }
  function drawRoom() {
    ctx.drawImage(bgArt(), 0, 0, W, H);
    const sg = ctx.createLinearGradient(0, 54, 0, 186); sg.addColorStop(0, '#1d3346'); sg.addColorStop(1, '#14243a'); rr(24, 54, 312, 134, 6); ctx.fillStyle = sg; ctx.fill();
    ctx.fillStyle = '#26384c'; ctx.fillRect(24, 54, 312, 13);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff6b6b', '#ffd84a', '#7dd3ff', '#fff', '#9dff8a'][i]; ctx.beginPath(); ctx.arc(34 + i * 12, 60.5, 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#8a94a3'; ctx.fillRect(292, 58, 36, 5);
    const b = V.board, L = PAGES[b.page % PAGES.length];
    for (let i = 0; i <= Math.min(b.line, L.length - 1); i++) {
      const str = i < b.line ? L[i] : L[i].slice(0, b.ch); ctx.font = boardFont(i); ctx.textAlign = 'left'; ctx.fillStyle = i === 0 ? '#ffd84a' : i === 3 ? '#ff9b9b' : '#f2f6ff'; ctx.fillText(str, LINE_X, LINE_Y[i]);
      if (i === 0 && b.line > 0) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LINE_X, LINE_Y[0] + 5); ctx.lineTo(LINE_X + ctx.measureText(L[0]).width, LINE_Y[0] + 5); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(125,211,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(262, 170); ctx.lineTo(326, 170); ctx.moveTo(294, 180); ctx.lineTo(294, 112); ctx.stroke();
    if (b.line >= 2) { ctx.strokeStyle = '#9dff8a'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -26; x <= 26; x += 2) { const y = 150 - ((x + 4) * (x + 4)) * 0.06; x === -26 ? ctx.moveTo(294 + x, y) : ctx.lineTo(294 + x, y); } ctx.stroke(); }
    // 화면 반사광
    const gl = ctx.createLinearGradient(24, 54, 200, 188); gl.addColorStop(0, 'rgba(255,255,255,.09)'); gl.addColorStop(0.45, 'rgba(255,255,255,.02)'); gl.addColorStop(0.46, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; rr(24, 54, 312, 134, 6); ctx.fill();
    ctx.fillStyle = '#6ef0a0'; ctx.beginPath(); ctx.arc(180, 191.5, 1.8, 0, 7); ctx.fill();
  }

  // ===== 그림 도구(2026-10-31 23:16 하율 "도형으로만 만든 느낌 — 그래픽 싹 디벨롭"): 곡선 실루엣 + 왼쪽 위 빛 기준 그림자·하이라이트 =====
  const dk2 = new Map();
  const tone2 = (hex, f) => { const key = hex + f; let v = dk2.get(key); if (v) return v; const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    v = '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join(''); dk2.set(key, v); return v; };
  // 몸 한 부분: 모양(pf) 채우기 → 안쪽에 그림자(오른쪽·아래) → 하이라이트(왼쪽 위) → 잉크 테두리
  function part2(pf, col, shadeFn, lw = 2.2, hiFn) {
    pf(); ctx.fillStyle = col; ctx.fill();
    if (shadeFn || hiFn) { ctx.save(); pf(); ctx.clip(); if (shadeFn) { ctx.fillStyle = tone2(col, -0.18); shadeFn(); } if (hiFn) { ctx.fillStyle = tone2(col, 0.22); hiFn(); } ctx.restore(); }
    pf(); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.strokeStyle = K; ctx.stroke();
  }
  // 굽은 팔·다리(어깨→팔꿈치→손목, 두께가 점점 가늘어짐) + 위쪽 하이라이트
  function limb2(ax, ay, bx, by, cx, cy, w1, w2, col) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [d, c] of [[4.4, K], [0, col]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w1 + d; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.lineWidth = w2 + d; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
    }
    ctx.strokeStyle = tone2(col, -0.2); ctx.lineWidth = w2 * 0.35; ctx.beginPath(); ctx.moveTo(bx + 1.5, by + 1.5); ctx.lineTo(cx + 1.5, cy + 1); ctx.stroke();
    ctx.strokeStyle = tone2(col, 0.28); ctx.lineWidth = Math.max(1, w1 * 0.22); ctx.beginPath(); ctx.moveTo(ax - 1.5, ay - 1); ctx.lineTo(bx - 1.5, by - 1.5); ctx.stroke();
    if (w1 > 8) { const a1 = Math.atan2(by - ay, bx - ax), a2 = Math.atan2(cy - by, cx - bx); if (Math.abs(Math.sin(a2 - a1)) > 0.25) { ctx.strokeStyle = tone2(col, -0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, w1 * 0.32, a1 + 1.2, a1 + 2.2); ctx.stroke(); } }   // 팔꿈치 주름
  }
  // 손: 손바닥 + 엄지(팔 방향으로 살짝 길쭉)
  function hand2(x, y, ang, r = 5, cuff) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (cuff) { rr(-r - 1.5, -2.5 - r * 0.9, r * 2 + 3, 4, 2); fs(cuff, 1.6); }
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 1.12, 0, 0, 7); ctx.fillStyle = SKIN; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = K; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-r * 0.85, -r * 0.25, r * 0.38, r * 0.62, -0.5, 0, 7); ctx.fillStyle = SKIN; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.55); ctx.lineTo(-r * 0.3, r * 0.9); ctx.moveTo(r * 0.25, r * 0.55); ctx.lineTo(r * 0.25, r * 0.95); ctx.stroke();
    ctx.restore();
  }
  const angOf = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax) - Math.PI / 2;
  function shoe(x, y, w = 13, col = '#2f2a33') { part2(() => { ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x - w / 2 - 1, y - 7, x, y - 7.5); ctx.quadraticCurveTo(x + w / 2 + 1, y - 7, x + w / 2, y); ctx.quadraticCurveTo(x, y + 2.5, x - w / 2, y); ctx.closePath(); }, col, null, 1.8, () => ctx.fillRect(x - w / 2, y - 7.5, w * 0.4, 3)); }

  // ===== 선생님: 60대, 숱 많은 은발(물결 옆 가르마), 네모 안경, 갈색 니트 조끼·넥타이, 한 손에 나무 막대기 =====
  function stick(x1, y1, x2, y2) {
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = 7.5; ctx.strokeStyle = K; ctx.stroke();
    const gr = ctx.createLinearGradient(x1, y1, x2, y2); gr.addColorStop(0, '#8a5a2b'); gr.addColorStop(0.5, WOOD); gr.addColorStop(1, '#d9a160'); ctx.lineWidth = 4.5; ctx.strokeStyle = gr; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,230,180,.7)'; ctx.beginPath(); ctx.moveTo(x1 + (x2 - x1) * 0.12, y1 + (y2 - y1) * 0.12 - 1.2); ctx.lineTo(x1 + (x2 - x1) * 0.85, y1 + (y2 - y1) * 0.85 - 1.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,50,20,.5)'; for (const q of [0.3, 0.55, 0.75]) { const mx = x1 + (x2 - x1) * q, my = y1 + (y2 - y1) * q; ctx.beginPath(); ctx.moveTo(mx - 1.2, my - 0.5); ctx.lineTo(mx + 1.2, my + 0.5); ctx.stroke(); }
    ell(x2, y2, 3.4, 3.4); fs('#5e3b1a', 1.6);
  }
  function lowerBody(front) {
    shoe(-11, -1, 17, '#3a2a22'); shoe(11, -1, 17, '#3a2a22');
    // 바지(약간 통 넓은 정장 바지 · 앞 주름)
    part2(() => { ctx.beginPath(); ctx.moveTo(-20, -64); ctx.lineTo(-1, -64); ctx.lineTo(-2, -5); ctx.quadraticCurveTo(-11, -2, -20, -5); ctx.closePath(); }, PANTS, () => ctx.fillRect(-8, -64, 8, 60), 2.2);
    part2(() => { ctx.beginPath(); ctx.moveTo(1, -64); ctx.lineTo(20, -64); ctx.lineTo(20, -5); ctx.quadraticCurveTo(11, -2, 2, -5); ctx.closePath(); }, PANTS, () => ctx.fillRect(13, -64, 8, 60), 2.2);
    ctx.strokeStyle = tone2(PANTS, -0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-11, -58); ctx.lineTo(-11, -8); ctx.moveTo(11, -58); ctx.lineTo(11, -8); ctx.stroke();
    // 벨트
    rr(-22, -68, 44, 7, 3); fs('#3b2f2a', 2); if (front) { rr(-4, -68.5, 8, 8, 1.5); ctx.fillStyle = '#d9b45a'; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke(); }
  }
  function shirtTorso(front) {
    part2(() => { ctx.beginPath(); ctx.moveTo(-8, -131); ctx.quadraticCurveTo(-22, -130, -27, -121); ctx.quadraticCurveTo(-30, -100, -24, -64); ctx.lineTo(24, -64); ctx.quadraticCurveTo(30, -100, 27, -121); ctx.quadraticCurveTo(22, -130, 8, -131); ctx.closePath(); }, SHIRT, () => ctx.fillRect(16, -132, 16, 70), 2.4);
    // 니트 조끼(골지 결)
    part2(() => { ctx.beginPath(); if (front) { ctx.moveTo(-23, -123); ctx.lineTo(-9, -124); ctx.lineTo(0, -94); ctx.lineTo(9, -124); ctx.lineTo(23, -123); } else { ctx.moveTo(-23, -123); ctx.quadraticCurveTo(0, -128, 23, -123); } ctx.quadraticCurveTo(26, -96, 23, -66); ctx.quadraticCurveTo(0, -60, -23, -66); ctx.quadraticCurveTo(-26, -96, -23, -123); ctx.closePath(); }, VEST, () => ctx.fillRect(12, -130, 14, 70), 2.2, () => ctx.fillRect(-24, -128, 6, 66));
    ctx.save(); ctx.beginPath(); if (front) { ctx.moveTo(-23, -123); ctx.lineTo(-9, -124); ctx.lineTo(0, -94); ctx.lineTo(9, -124); ctx.lineTo(23, -123); } else { ctx.moveTo(-23, -123); ctx.quadraticCurveTo(0, -128, 23, -123); } ctx.lineTo(23, -66); ctx.quadraticCurveTo(0, -60, -23, -66); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = VEST2; ctx.lineWidth = 1; for (let x = -21; x < 23; x += 3.5) { ctx.beginPath(); ctx.moveTo(x, -128); ctx.lineTo(x, -62); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = tone2(VEST, -0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, -69); ctx.quadraticCurveTo(0, -63, 22, -69); ctx.stroke();   // 밑단 고무
  }
  function teacherHeadBack(o, turn) {
    // 목(주름) · 셔츠 깃 뒤
    part2(() => { ctx.beginPath(); ctx.moveTo(-8, -138); ctx.lineTo(8, -138); ctx.lineTo(9, -127); ctx.lineTo(-9, -127); ctx.closePath(); }, SKIN, () => ctx.fillRect(2, -140, 8, 14), 2);
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -133); ctx.quadraticCurveTo(0, -131, 5, -133); ctx.stroke();
    part2(() => { ctx.beginPath(); ctx.moveTo(-11, -129); ctx.quadraticCurveTo(0, -125, 11, -129); ctx.lineTo(10, -124); ctx.quadraticCurveTo(0, -121, -10, -124); ctx.closePath(); }, '#fff', null, 1.8);
    // 귀
    for (const d of [-1, 1]) { const ex = d * 19 + o + (d > 0 ? turn * 3 : 0); part2(() => { ctx.beginPath(); ctx.ellipse(ex, -150, 4.6 + (d > 0 ? turn * 1.5 : 0), 7, 0, 0, 7); }, SKIN, () => ctx.fillRect(ex - (d < 0 ? 5 : -1), -158, 4, 16), 2); }
    // 고개 돌릴 때 보이는 볼·안경다리·안경알
    if (turn > 0) {
      part2(() => { ctx.beginPath(); ctx.ellipse(10 + o + turn * 4, -146, 12, 17, 0, 0, 7); }, SKIN, () => ctx.fillRect(14 + turn * 4 + o, -165, 10, 40), 2);
      ctx.strokeStyle = '#1d1d22'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(13 + turn * 3 + o, -151); ctx.lineTo(23 + turn * 3 + o, -151); ctx.stroke();
      if (turn > 1.3) { ctx.fillStyle = 'rgba(190,225,255,.35)'; rr(15 + turn * 3 + o, -156, 8.5, 11, 1.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1d1d22'; ctx.fillRect(17.5 + turn * 3 + o, -151, 3, 2.4);
        ctx.strokeStyle = '#8c8f98'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(14 + turn * 3 + o, -160); ctx.lineTo(24 + turn * 3 + o, -161); ctx.stroke(); }
    }
    // 숱 많은 은발 뒤통수(물결 결 · 뒷목 선)
    const hp = () => { ctx.beginPath(); ctx.moveTo(-21 + o, -146); ctx.bezierCurveTo(-27 + o, -170, -16 + o, -186, 0 + o - turn * 2, -186); ctx.bezierCurveTo(16 + o - turn * 3, -186, 27 + o - turn * 4, -170, 21 + o - turn * 4, -146);
      ctx.quadraticCurveTo(22 + o, -139, 16 + o, -136); ctx.quadraticCurveTo(12 + o, -133, 8 + o, -136); ctx.quadraticCurveTo(4 + o, -132, 0 + o, -135); ctx.quadraticCurveTo(-4 + o, -132, -8 + o, -136); ctx.quadraticCurveTo(-12 + o, -133, -16 + o, -136); ctx.quadraticCurveTo(-22 + o, -139, -21 + o, -146); ctx.closePath(); };
    part2(hp, HAIR, () => { ctx.beginPath(); ctx.ellipse(12 + o, -150, 14, 26, 0, 0, 7); ctx.fill(); }, 2.4, () => { ctx.beginPath(); ctx.ellipse(-8 + o, -176, 12, 6, -0.3, 0, 7); ctx.fill(); });
    ctx.save(); hp(); ctx.clip(); ctx.strokeStyle = HAIR2; ctx.lineWidth = 1.2;
    ctx.strokeStyle = tone2(HAIR, -0.32); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (const x of [-12, -4, 4, 12]) { ctx.beginPath(); ctx.moveTo(x + o, -136); ctx.quadraticCurveTo(x * 0.9 + o + 2, -146, x * 0.7 + o, -156); ctx.stroke(); }   // 뒷머리 다발 사이 그늘
    ctx.strokeStyle = tone2(HAIR, 0.35); ctx.lineWidth = 1.2; for (const [x, y] of [[-12, -176], [-4, -181], [6, -180]]) { ctx.beginPath(); ctx.moveTo(x + o, y); ctx.quadraticCurveTo(x + o + 6, y + 6, x + o + 4, y + 14); ctx.stroke(); }   // 물결 결
    ctx.restore();
  }
  function teacherBack(tv) {
    const warn = tv.tst === 'warn', peek = tv.tst === 'peek', tw = V.twitch > 0 && !RM() ? Math.sin(V.twitch * 60) * 1.5 : 0;
    stick(-42, -20, -24, -122);
    limb2(-25, -118, -31, -95, -31, -74, 10, 9, SHIRT); hand2(-31, -70, angOf(-31, -95, -31, -74), 5.4, '#fff');
    lowerBody(false); shirtTorso(false);
    // 판서하는 손(전자펜)
    let hx = V.hx, hy = V.hy;
    if (tv.tst === 'pause') { hx += 4; hy += 6; } else if (tv.tst !== 'write') { hx = 30; hy = -88; }
    const sxp = 24, syp = -118, dx = hx - sxp, dy = hy - syp, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 78); hx = sxp + dx / d * m; hy = syp + dy / d * m;
    const ex = sxp + dx / d * m * 0.5 + 10, ey = syp + dy / d * m * 0.5 + 12;
    limb2(sxp, syp, ex, ey, hx, hy, 10, 9, SHIRT);
    ctx.lineCap = 'round'; ctx.lineWidth = 3.4; ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 3, hy - 11); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#7dd3ff'; ctx.beginPath(); ctx.moveTo(hx - 0.5, hy - 2); ctx.lineTo(hx - 2.5, hy - 9); ctx.stroke();
    hand2(hx, hy, angOf(ex, ey, hx, hy), 5.4, '#fff');
    const turn = peek ? 1 + clamp((tv.dur - tv.tm) / D.PEEK_IN, 0, 1) * 0.9 : warn ? clamp(0.35 + (tv.dur - tv.tm) / D.FPS * 1.3, 0.35, 1) : 0;
    teacherHeadBack(tw, turn);
  }
  function teacherFront(tv) {
    const mood = tv.mood, ang = mood === 'angry';
    let hx = 32, hy = -72, tx = 40, ty = -128, bx = 26, by = -22;
    if (ang) { const w = RM() ? 0 : Math.sin(V.t * 28) * 0.18; hx = 38; hy = -134; const a = -1.05 + w; bx = hx - Math.cos(a) * 14; by = hy - Math.sin(a) * 14; tx = hx + Math.cos(a) * 80; ty = hy + Math.sin(a) * 80; }
    lowerBody(true); shirtTorso(true);
    // 넥타이(매듭·사선 줄무늬)
    part2(() => { ctx.beginPath(); ctx.moveTo(-3.5, -121); ctx.lineTo(3.5, -121); ctx.lineTo(6, -100); ctx.lineTo(0, -93); ctx.lineTo(-6, -100); ctx.closePath(); }, '#8b2d3a', null, 1.8);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-3.5, -121); ctx.lineTo(3.5, -121); ctx.lineTo(6, -100); ctx.lineTo(0, -93); ctx.lineTo(-6, -100); ctx.closePath(); ctx.clip(); ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1.2; for (let y = -124; y < -90; y += 5) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y + 6); ctx.stroke(); } ctx.restore();
    part2(() => { ctx.beginPath(); ctx.moveTo(-4, -126); ctx.lineTo(4, -126); ctx.lineTo(3, -120); ctx.lineTo(-3, -120); ctx.closePath(); }, '#7a2532', null, 1.6);
    part2(() => { ctx.beginPath(); ctx.moveTo(-10, -130); ctx.lineTo(-1, -125); ctx.lineTo(-6, -117); ctx.closePath(); }, '#fff', null, 1.6); part2(() => { ctx.beginPath(); ctx.moveTo(10, -130); ctx.lineTo(1, -125); ctx.lineTo(6, -117); ctx.closePath(); }, '#fff', null, 1.6);
    for (const y of [-86, -77, -68]) { ell(0, y, 1.9, 1.9); ctx.fillStyle = '#3d2a1b'; ctx.fill(); }
    rr(-19, -88, 9, 2.5, 1); ctx.fillStyle = VEST2; ctx.fill(); rr(10, -88, 9, 2.5, 1); ctx.fill();   // 주머니
    // 팔
    if (ang) { limb2(-25, -118, -36, -106, -46, -98, 10, 9, SHIRT); hand2(-48, -97, -1.6, 5.4, '#fff'); limb2(-52, -98, -55, -99, -60, -100, 3, 2.6, SKIN); }
    else { limb2(-25, -118, -31, -95, -30, -74, 10, 9, SHIRT); hand2(-30, -70, 0, 5.4, '#fff'); }
    limb2(25, -118, ang ? 44 : 32, ang ? -114 : -95, hx, hy, 10, 9, SHIRT); stick(bx, by, tx, ty); hand2(hx, hy, ang ? 0.6 : 0, 5.6, '#fff');
    // 목
    part2(() => { ctx.beginPath(); ctx.moveTo(-8, -138); ctx.lineTo(8, -138); ctx.lineTo(9, -127); ctx.quadraticCurveTo(0, -122, -9, -127); ctx.closePath(); }, SKIN, () => ctx.fillRect(-10, -133, 20, 6), 2);
    // 귀
    for (const d of [-1, 1]) part2(() => { ctx.beginPath(); ctx.ellipse(d * 19, -150, 4.8, 7.2, 0, 0, 7); }, SKIN, null, 2);
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-19, -150, 2.4, 1.2, 4.6); ctx.moveTo(19, -152); ctx.arc(19, -150, 2.4, -1.5, 1.9); ctx.stroke();
    // 얼굴(살짝 처진 턱살)
    const face = () => { ctx.beginPath(); ctx.moveTo(-17, -160); ctx.quadraticCurveTo(-19, -138, -13, -131); ctx.quadraticCurveTo(-8, -126, 0, -126); ctx.quadraticCurveTo(8, -126, 13, -131); ctx.quadraticCurveTo(19, -138, 17, -160); ctx.quadraticCurveTo(16, -170, 0, -170); ctx.quadraticCurveTo(-16, -170, -17, -160); ctx.closePath(); };
    part2(face, ang ? '#f4ae96' : SKIN, () => { ctx.beginPath(); ctx.ellipse(16, -146, 7, 22, 0, 0, 7); ctx.fill(); ctx.fillRect(-20, -131, 40, 6); }, 2.4);
    if (ang) { ctx.fillStyle = 'rgba(230,60,60,.25)'; ell(-11, -139, 5, 3); ctx.fill(); ell(11, -139, 5, 3); ctx.fill(); }
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 1.2;
    for (const y of [-164, -160]) { ctx.beginPath(); ctx.moveTo(-9, y); ctx.quadraticCurveTo(0, y - 2.2, 9, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-8, -141); ctx.quadraticCurveTo(-11, -136, -7, -131); ctx.moveTo(8, -141); ctx.quadraticCurveTo(11, -136, 7, -131); ctx.stroke();   // 팔자 주름
    ctx.beginPath(); ctx.moveTo(-14, -146); ctx.quadraticCurveTo(-10, -144, -6, -146); ctx.moveTo(6, -146); ctx.quadraticCurveTo(10, -144, 14, -146); ctx.stroke();   // 눈밑
    // 숱 많은 은발(옆 가르마 · 물결 앞머리 · 구레나룻)
    const hair = () => { ctx.beginPath(); ctx.moveTo(-20, -146); ctx.bezierCurveTo(-27, -168, -14, -189, 4, -186); ctx.bezierCurveTo(20, -185, 28, -170, 21, -146);
      ctx.quadraticCurveTo(19, -156, 16, -162); ctx.quadraticCurveTo(10, -168, 3, -165); ctx.quadraticCurveTo(-4, -170, -8, -166); ctx.quadraticCurveTo(-13, -164, -15, -158); ctx.quadraticCurveTo(-17, -152, -17, -146); ctx.closePath(); };
    part2(hair, HAIR, () => { ctx.beginPath(); ctx.ellipse(14, -160, 10, 22, 0, 0, 7); ctx.fill(); }, 2.4, () => { ctx.beginPath(); ctx.ellipse(-6, -179, 11, 5, -0.25, 0, 7); ctx.fill(); });
    ctx.save(); hair(); ctx.clip(); ctx.strokeStyle = HAIR2; ctx.lineWidth = 1.2;
    for (const [a, b, c2, d2] of [[-8, -184, -16, -160], [-2, -185, 4, -168], [6, -185, 14, -166], [12, -182, 19, -158], [-14, -178, -18, -152]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c2) / 2 + 4, (b + d2) / 2, c2, d2); ctx.stroke(); }
    ctx.restore();
    // 눈썹(덥수룩)
    ctx.lineCap = 'round'; const bro = (x1, y1, x2, y2) => { ctx.strokeStyle = '#7d808a'; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = '#b9bcc6'; ctx.lineWidth = 1; for (let q = 0.15; q < 1; q += 0.25) { const mx = x1 + (x2 - x1) * q, my = y1 + (y2 - y1) * q; ctx.beginPath(); ctx.moveTo(mx, my - 1.5); ctx.lineTo(mx + 1.5, my + 1.2); ctx.stroke(); } };
    if (ang) { bro(-15, -161, -4, -156); bro(15, -161, 4, -156); } else if (mood === 'sus') { bro(-15, -158, -4, -157); bro(15, -163, 4, -159); } else { bro(-15, -158, -4, -159.5); bro(15, -158, 4, -159.5); }
    // 눈
    const px = mood === 'sus' && !RM() ? Math.sin(V.t * 3.2) * 2.4 : 0; ctx.fillStyle = '#1d1d22';
    if (mood === 'sus') { ctx.fillRect(-11.5 + px, -151, 4.5, 2.4); ctx.fillRect(7 + px, -151, 4.5, 2.4); }
    else { ell(-9 + px, -149.5, 2.1, 2.5); ctx.fill(); ell(9 + px, -149.5, 2.1, 2.5); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-9.6 + px, -151, 1, 1); ctx.fillRect(8.4 + px, -151, 1, 1); }
    // 네모 안경(굵은 위 테 · 렌즈 반사)
    ctx.lineWidth = 2.2; ctx.strokeStyle = '#1d1d22'; ctx.fillStyle = 'rgba(190,225,255,.3)';
    rr(-17, -155, 14, 11, 1.5); ctx.fill(); ctx.stroke(); rr(3, -155, 14, 11, 1.5); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(-17, -154.5); ctx.lineTo(-3, -154.5); ctx.moveTo(3, -154.5); ctx.lineTo(17, -154.5); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -151); ctx.quadraticCurveTo(0, -153, 3, -151); ctx.moveTo(-17, -152); ctx.lineTo(-20, -151); ctx.moveTo(17, -152); ctx.lineTo(20, -151); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-14, -146.5); ctx.lineTo(-10, -152.5); ctx.moveTo(6, -146.5); ctx.lineTo(10, -152.5); ctx.stroke();
    // 코(뭉툭) · 입
    part2(() => { ctx.beginPath(); ctx.moveTo(-1.5, -147); ctx.quadraticCurveTo(-5, -139, -3, -137.5); ctx.quadraticCurveTo(1, -136, 4, -138); ctx.quadraticCurveTo(4.5, -141, 1.5, -147); }, tone2(SKIN, -0.06), null, 1.4);
    ctx.strokeStyle = K; ctx.lineWidth = 2;
    if (ang) { part2(() => { ctx.beginPath(); ctx.moveTo(-6, -132); ctx.quadraticCurveTo(0, -136, 6, -132); ctx.quadraticCurveTo(0, -127, -6, -132); ctx.closePath(); }, '#7a2630', null, 1.8); ctx.fillStyle = '#fff'; ctx.fillRect(-4, -134, 8, 1.6); }
    else if (mood === 'sus') { ctx.beginPath(); ctx.moveTo(-5, -132.5); ctx.quadraticCurveTo(0, -133.5, 5, -133); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-5, -133); ctx.quadraticCurveTo(0, -131, 5, -133); ctx.stroke(); }
    if (ang) { ctx.strokeStyle = '#e0464e'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(22, -178); ctx.quadraticCurveTo(26, -176, 25, -172); ctx.moveTo(29, -178); ctx.quadraticCurveTo(25, -176, 26, -172); ctx.stroke(); }
  }

  // ===== 학생들(뒷모습) — 춤출 때는 모두 일어나 광란의 파티 =====
  // o: { hc 머리색, hs 머리 모양(short·long·pony·bun·twin·buzz·wave), cl 옷, sk 치마, acc 장식, ds 춤 종류, ph 박자 어긋남, tp 빠르기 }
  function desk(pr) {   // 책상(먼 쪽 · 나무 상판 두께 + 쇠 다리) + 책상 위 소품
    ctx.strokeStyle = '#6f7790'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, -76); ctx.lineTo(-40, -58); ctx.moveTo(40, -76); ctx.lineTo(40, -58); ctx.stroke();
    part2(() => { ctx.beginPath(); ctx.moveTo(-42, -88); ctx.lineTo(42, -88); ctx.lineTo(47, -80); ctx.lineTo(-47, -80); ctx.closePath(); }, '#e2bb86', null, 2, () => ctx.fillRect(-47, -88, 94, 2.5));
    rr(-47, -80, 94, 5, 2); fs('#b98d5a', 2);
    if (pr === 1) { rr(-36, -95, 22, 8, 2); fs('#6fc6f4', 1.6); rr(-34, -101, 18, 6, 2); fs('#ffe08a', 1.6); }   // 교과서
    else if (pr === 2) { rr(22, -94, 22, 7, 3.5); fs('#ff8f8f', 1.6); ctx.strokeStyle = K; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(26, -90.5); ctx.lineTo(40, -90.5); ctx.stroke(); }   // 필통
    else if (pr === 3) { rr(30, -104, 8, 16, 3); fs('#8fe8cf', 1.6); rr(31, -107, 6, 4, 1.5); fs('#38a5ea', 1.4); }   // 물병
  }
  function chair() {   // 의자 등받이(카메라 쪽 · 쇠 틀 + 합판)
    ctx.strokeStyle = '#59607a'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-25, -38); ctx.lineTo(-25, 6); ctx.moveTo(25, -38); ctx.lineTo(25, 6); ctx.stroke();
    ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-26, -36); ctx.lineTo(-26, 4); ctx.moveTo(24, -36); ctx.lineTo(24, 4); ctx.stroke();
    part2(() => { ctx.beginPath(); ctx.moveTo(-30, -40); ctx.quadraticCurveTo(0, -45, 30, -40); ctx.lineTo(28, -18); ctx.quadraticCurveTo(0, -15, -28, -18); ctx.closePath(); }, '#c99a63', () => ctx.fillRect(14, -46, 20, 32), 2.2, () => ctx.fillRect(-30, -46, 30, 4));
    ctx.strokeStyle = 'rgba(110,70,30,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-22, -34); ctx.quadraticCurveTo(0, -37, 22, -34); ctx.moveTo(-22, -26); ctx.quadraticCurveTo(0, -29, 22, -26); ctx.stroke();
  }
  // 몸통(교복 재킷·후드·체육복·가디건): T = 목 밑 높이
  function torso2(dx, T, B, cl) {
    part2(() => { ctx.beginPath(); ctx.moveTo(-5 + dx, T - 12); ctx.lineTo(5 + dx, T - 12); ctx.lineTo(5.5 + dx, T + 2); ctx.lineTo(-5.5 + dx, T + 2); ctx.closePath(); }, SKIN, () => ctx.fillRect(1 + dx, T - 13, 6, 16), 1.8);   // 목(깃 뒤로 들어감)
    const pf = () => { ctx.beginPath(); ctx.moveTo(-7 + dx, T); ctx.quadraticCurveTo(-19 + dx, T, -23 + dx, T + 8); ctx.quadraticCurveTo(-27 + dx, T + 22, -22 + dx, T + 34); ctx.lineTo(-20 + dx, B); ctx.quadraticCurveTo(dx, B + 4, 20 + dx, B); ctx.lineTo(22 + dx, T + 34); ctx.quadraticCurveTo(27 + dx, T + 22, 23 + dx, T + 8); ctx.quadraticCurveTo(19 + dx, T, 7 + dx, T); ctx.closePath(); };
    part2(pf, cl.c, () => { ctx.fillRect(9 + dx, T - 2, 20, B - T + 8); ctx.fillRect(-30 + dx, B - 5, 60, 8); }, 2.3, () => { ctx.beginPath(); ctx.ellipse(-13 + dx, T + 6, 9, 4, -0.4, 0, 7); ctx.fill(); });
    ctx.save(); pf(); ctx.clip(); ctx.strokeStyle = cl.d; ctx.lineWidth = 1.4; ctx.beginPath();
    if (cl.k === 'hood') { ctx.moveTo(-14 + dx, T + 1); ctx.quadraticCurveTo(dx, T + 24, 14 + dx, T + 1); ctx.moveTo(-9 + dx, T + 3); ctx.quadraticCurveTo(dx, T + 16, 9 + dx, T + 3); ctx.stroke(); ctx.fillStyle = tone2(cl.c, -0.12); ctx.beginPath(); ctx.moveTo(-14 + dx, T + 1); ctx.quadraticCurveTo(dx, T + 24, 14 + dx, T + 1); ctx.fill(); }
    else if (cl.k === 'pe') { ctx.fillStyle = cl.d; ctx.fillRect(-30 + dx, T + 15, 60, 4); ctx.fillRect(-26 + dx, T + 6, 4, B - T); ctx.fillRect(22 + dx, T + 6, 4, B - T); }
    else { ctx.moveTo(dx, T + 5); ctx.lineTo(dx, B - 8); ctx.moveTo(dx, B - 8); ctx.lineTo(dx, B + 2); ctx.stroke(); ctx.fillStyle = tone2(cl.c, -0.25); ctx.fillRect(-1 + dx, B - 9, 2, 10);   // 등 솔기·트임
      ctx.fillStyle = tone2(cl.c, -0.15); ctx.beginPath(); ctx.moveTo(-10 + dx, T); ctx.quadraticCurveTo(dx, T + 7, 10 + dx, T); ctx.lineTo(8 + dx, T - 1); ctx.closePath(); ctx.fill(); }   // 깃
    ctx.restore();
    ctx.strokeStyle = tone2(cl.c, -0.3); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-17 + dx, T + 2); ctx.quadraticCurveTo(-19 + dx, T + 12, -22 + dx, T + 22); ctx.moveTo(17 + dx, T + 2); ctx.quadraticCurveTo(19 + dx, T + 12, 22 + dx, T + 22); ctx.stroke();   // 어깨 솔기
    if (cl.k !== 'hood' && cl.k !== 'pe') { part2(() => { ctx.beginPath(); ctx.moveTo(-7 + dx, T - 1); ctx.quadraticCurveTo(dx, T + 3, 7 + dx, T - 1); ctx.lineTo(6 + dx, T - 4); ctx.quadraticCurveTo(dx, T - 1, -6 + dx, T - 4); ctx.closePath(); }, '#fff', null, 1.5); }   // 흰 셔츠 깃
  }
  // 머리 뒷모습: 머리 모양마다 실루엣·결·윤기
  function head(x, y, o, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0);
    const hc = o.hc, hs = o.hs, sw = Math.sin(V.t * 11 + o.ph) * (o.dancing ? 0.6 : 0.04);
    if (hs === 'long' || hs === 'wave') { const pf = () => { ctx.beginPath(); ctx.moveTo(-17, -2); ctx.quadraticCurveTo(-21 + sw * 6, 18, -18 + sw * 8, 34); ctx.quadraticCurveTo(-9, 30, -4, 36); ctx.quadraticCurveTo(2, 31, 7, 36); ctx.quadraticCurveTo(13, 31, 18 + sw * 8, 34); ctx.quadraticCurveTo(21 + sw * 6, 18, 17, -2); ctx.closePath(); }; part2(pf, hc, () => ctx.fillRect(6, -4, 18, 44), 2.2); ctx.save(); pf(); ctx.clip(); ctx.strokeStyle = tone2(hc, 0.18); ctx.lineWidth = 1.1; for (const a of [-11, -4, 3, 10]) { ctx.beginPath(); ctx.moveTo(a, 2); ctx.quadraticCurveTo(a + (hs === 'wave' ? 5 : 2), 18, a + sw * 6, 34); ctx.stroke(); } ctx.restore(); }
    if (hs === 'pony') { ctx.save(); ctx.translate(0, 2); ctx.rotate(sw * 1.4); part2(() => { ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-9, 16, -2, 32); ctx.quadraticCurveTo(1, 26, 3, 32); ctx.quadraticCurveTo(9, 16, 5, 0); ctx.closePath(); }, hc, () => ctx.fillRect(1, 0, 8, 34), 2); ctx.restore(); }
    if (hs === 'twin') for (const dd of [-1, 1]) { ctx.save(); ctx.translate(dd * 14, -4); ctx.rotate(dd * (0.35 + sw)); part2(() => { ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-7, 14, -1, 26); ctx.quadraticCurveTo(7, 14, 4, 0); ctx.closePath(); }, hc, null, 2); ctx.restore(); }
    for (const d of [-1, 1]) part2(() => { ctx.beginPath(); ctx.ellipse(d * 16.5, 1, 3.6, 5.4, 0, 0, 7); }, SKIN, null, 1.8);   // 귀
    // 뒤통수: 둥근 머리 + 뒷목 쪽은 머리 다발이 둥글게 갈라져 내려옴(줄무늬 대신 다발·윤기)
    const ry = hs === 'buzz' ? 16 : 18, LOCK = [-16.5, -11, -5.5, 0, 5.5, 11, 16.5];
    const pf = () => { ctx.beginPath(); ctx.moveTo(-16.5, 4); ctx.bezierCurveTo(-19.5, -16, -9, -ry - 3, 0, -ry - 3); ctx.bezierCurveTo(9, -ry - 3, 19.5, -16, 16.5, 4);
      if (hs === 'buzz') ctx.quadraticCurveTo(0, 12, -16.5, 4);
      else for (let i = LOCK.length - 1; i > 0; i--) { const x1 = LOCK[i], x0 = LOCK[i - 1], dip = 9 + ((i * 7) % 3) * 1.5 - Math.abs(x0 + x1) * 0.12; ctx.quadraticCurveTo((x0 + x1) / 2 + 1, dip + 3, x0, i === 1 ? 4 : 5 + Math.abs(x0) * 0.05); }
      ctx.closePath(); };
    part2(pf, hc, () => { ctx.beginPath(); ctx.ellipse(11, 2, 11, 20, 0, 0, 7); ctx.fill(); }, 2.3);
    ctx.save(); pf(); ctx.clip();
    if (hs === 'buzz') { ctx.fillStyle = tone2(hc, 0.22); for (let i = 0; i < 30; i++) ctx.fillRect(-14 + (i * 37) % 28, -16 + (i * 23) % 26, 1.1, 1.1); }
    else {
      ctx.strokeStyle = tone2(hc, -0.35); ctx.lineWidth = 1.3; ctx.lineCap = 'round';   // 다발 사이 그늘
      for (let i = 1; i < LOCK.length - 1; i++) { const x = LOCK[i]; ctx.beginPath(); ctx.moveTo(x, 7); ctx.quadraticCurveTo(x * 0.92 + (x > 0 ? 1 : -1), -2, x * 0.75, -8 - (i % 2) * 3); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(3, -16); ctx.quadraticCurveTo(6, -12, 4, -8); ctx.moveTo(1, -15); ctx.quadraticCurveTo(-3, -11, -2, -6); ctx.stroke();   // 가마
    }
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.quadraticCurveTo(-10, -17, 1, -18); ctx.quadraticCurveTo(-7, -13, -10, -3); ctx.closePath(); ctx.fill();   // 윤기
    ctx.restore();
    if (hs === 'bun') { part2(() => { ctx.beginPath(); ctx.ellipse(0, -22, 8, 7, 0, 0, 7); }, hc, () => ctx.fillRect(2, -30, 8, 16), 2.2); ctx.strokeStyle = tone2(hc, 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -22, 4, 0.5, 5); ctx.stroke(); rr(-5, -16.5, 10, 3, 1.5); fs('#ff6fa8', 1.4); }
    if (hs === 'pony') { rr(-4.5, 0, 9, 4, 2); fs('#ffd84a', 1.4); }
    if (o.acc === 'band') { ctx.strokeStyle = K; ctx.lineWidth = 5.2; ctx.beginPath(); ctx.arc(0, -2, 17.5, 3.55, 5.87); ctx.stroke(); ctx.strokeStyle = '#ff6fa8'; ctx.lineWidth = 3.2; ctx.stroke(); }
    if (o.acc === 'cap') { part2(() => { ctx.beginPath(); ctx.moveTo(-18, -2); ctx.bezierCurveTo(-19, -26, 19, -26, 18, -2); ctx.quadraticCurveTo(0, -6, -18, -2); ctx.closePath(); }, '#e0464e', () => ctx.fillRect(6, -26, 14, 26), 2.2); rr(-8, -8, 16, 6, 3); fs('#c43a42', 1.8); ell(0, -21, 2.4, 1.8); ctx.fillStyle = K; ctx.fill(); }
    if (o.acc === 'phones') { ctx.strokeStyle = K; ctx.lineWidth = 4.6; ctx.beginPath(); ctx.arc(0, -2, 19.5, 3.3, 6.12); ctx.stroke(); ctx.strokeStyle = '#3b6cf6'; ctx.lineWidth = 2.4; ctx.stroke(); for (const d of [-1, 1]) { rr(d * 19 - 4.5, -7, 9, 13, 4); fs('#3b6cf6', 2); } }
    if (o.acc === 'ribbon') { ctx.save(); ctx.translate(9, -15); for (const d of [-1, 1]) part2(() => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(d * 6, -8, d * 10, -4); ctx.quadraticCurveTo(d * 7, 0, d * 10, 5); ctx.quadraticCurveTo(d * 6, 7, 0, 0); ctx.closePath(); }, '#ffd84a', null, 1.6); ell(0, 0, 2.4, 2.4); fs('#ffb020', 1.4); ctx.restore(); }
    ctx.restore();
  }
  function teacherView() {
    const tst = s ? s.st : 'write', tm = s ? s.tm : 99;
    let face = 'back', sx = 1;
    if (tst === 'turn') { const p = 1 - tm / (s.tf || D.TURN_F); if (p < 0.5) sx = 1 - 2 * p; else { face = 'front'; sx = 2 * p - 1; } }
    else if (tst === 'turnback') { const p = 1 - tm / D.TURN_F; if (p < 0.5) { face = 'front'; sx = 1 - 2 * p; } else sx = 2 * p - 1; }
    else if (tst === 'look' || tst === 'caught') face = 'front';
    return { face, sx: Math.max(0.06, sx), tst, tm, dur: s ? s.dur : 99, mood: tst === 'caught' ? 'angry' : tst === 'look' ? 'sus' : 'neutral' };
  }
  function drawTeacher() {
    const tv = teacherView();
    ctx.save(); ctx.translate(V.tx, 318);
    ell(0, 0, 34, 6); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
    ctx.scale(tv.sx, 1);
    if (tv.face === 'back') teacherBack(tv); else teacherFront(tv);
    ctx.restore();
    if (V.whip > 0 && !RM()) { ctx.globalAlpha = Math.min(1, V.whip * 4); outlined('휙!', V.tx - 46, 150, 22, '#fff'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(V.tx, 168, 30 + i * 7, -2.6 + i * 0.1, -1.6 + i * 0.1); ctx.stroke(); } ctx.globalAlpha = 1; }
    if (V.bubT > 0 && V.bub) bubble(V.tx + 8, tv.tst === 'caught' ? 110 : 122, V.bub, V.bubAngry && tv.tst === 'caught');
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
  function kid(x, y, sc, o, party, me) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    desk(o.pr || 0);
    if (!party) {   // 앉아서 공부하는 척(또는 졸기) — 숨쉬기·고개 갸웃·필기 같은 작은 움직임
      if (o.sleep) {   // 책상에 엎드려 잠: 머리가 어깨 뒤로 숨고 팔은 베개
        limb2(-21, -60, -30, -70, -14, -80, 9, 8, o.cl.c); limb2(21, -60, 30, -70, 14, -80, 9, 8, o.cl.c);
        head(0, -72, o, 0); torso2(0, -66, -10, o.cl);
      } else {
        const br = RM() ? 0 : Math.sin(V.t * 1.6 + o.ph) * 0.8, look = RM() || me ? 0 : Math.max(0, Math.sin(V.t * 0.35 + o.ph * 2) - 0.85) * 1.6 * (o.ph > 1.5 ? 1 : -1);
        const wr = !me && o.wr && !RM() ? Math.sin(V.t * 9 + o.ph) * 1.6 : 0;
        limb2(-21, -66 + br, -29, -70, -10, -81, 9, 8, o.cl.c); limb2(21, -66 + br, 29, -70, 11 + wr, -82, 9, 8, o.cl.c);
        torso2(0, -72 + br, -10, o.cl);
        head(0, -90 + br + (o.nod || 0), o, (o.tilt || 0) + look * 0.25);
      }
      chair(); ctx.restore();
      if (o.sleep || o.zz) { const big = me ? 1.6 : 1; for (let i = 0; i < (me ? 2 : 1); i++) { const a = (V.t * 0.8 + o.ph + i * 0.5) % 1; ctx.globalAlpha = 1 - a; outlined(i ? 'Z' : 'z', x + 12 * sc + a * 10, y - 88 * sc - a * 18, (11 + a * 4) * big, '#e9e4ff'); } ctx.globalAlpha = 1; }
      return;
    }
    // 격렬하게: 빠른 박자 · 큰 몸짓 · 통통 튀기 · 발차기 · 고개 젖히기 · 발밑 색 조명
    const amp = o.amp || 1.3, b = V.t * Math.PI * 2 * o.tp * 1.7 + o.ph, P = pose(o.ds, b);
    const bounce = Math.abs(Math.sin(b * 2)) * 7 * amp, dx = P.dx * amp + Math.sin(b * 0.5) * 3 * amp, dy = P.dy * amp - bounce, lift = (P.jump ? P.jump * 16 * amp : 0) + bounce * 0.5;
    const glow = PARTY_C[((o.ci || 0) + Math.floor(V.t * 5)) % PARTY_C.length];
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * V.pv; ell(0, 4, 42, 10); ctx.fillStyle = glow; ctx.fill(); ctx.restore();
    ell(dx * 0.3, 4, 20, 4); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
    const legSw = Math.sin(b) * 6 * amp, kick = Math.max(0, Math.sin(b * 2)) * 9 * amp, odd = o.ds % 2;
    const fL = [-12 + legSw - (odd ? kick : 0), 2 - lift - (odd ? kick * 0.5 : 0)], fR = [12 - legSw + (odd ? 0 : kick), 2 - lift - (odd ? 0 : kick * 0.6)];
    const hipY = -46 + dy;
    if (o.sk) {   // 치마 + 무릎 양말
      for (const [hx0, f] of [[-7, fL], [7, fR]]) { const kx = (hx0 + dx * 0.5 + f[0]) / 2 + (hx0 < 0 ? -2 : 2), ky = (hipY + f[1]) / 2; limb2(hx0 + dx * 0.5, hipY + 8, kx, ky, f[0], f[1] - 6, 7.5, 6.5, SKIN); limb2(kx, ky + 6, (kx + f[0]) / 2, (ky + f[1]) / 2 + 3, f[0], f[1] - 6, 7, 6.5, '#ffffff'); }
    } else for (const [hx0, f] of [[-8, fL], [8, fR]]) { const kx = (hx0 + dx * 0.5 + f[0]) / 2 + (hx0 < 0 ? -3 : 3), ky = (hipY + f[1]) / 2; limb2(hx0 + dx * 0.5, hipY, kx, ky, f[0], f[1] - 5, 11, 9.5, o.cl.p); }
    shoe(fL[0], fL[1] + 3); shoe(fR[0], fR[1] + 3);
    chair();
    const stretch = Math.sin(b * 2) * 3 * amp, T = -102 + dy - stretch;
    if (o.sk) part2(() => { ctx.beginPath(); ctx.moveTo(-17 + dx, hipY - 8); ctx.lineTo(17 + dx, hipY - 8); ctx.lineTo(23 + dx + Math.sin(b) * 3, hipY + 14); ctx.quadraticCurveTo(dx, hipY + 18, -23 + dx + Math.sin(b) * 3, hipY + 14); ctx.closePath(); }, o.sk, () => ctx.fillRect(8 + dx, hipY - 10, 18, 30), 2.2);
    if (o.sk) { ctx.strokeStyle = tone2(o.sk, -0.3); ctx.lineWidth = 1; ctx.beginPath(); for (const q of [-12, -5, 2, 9, 16]) { ctx.moveTo(q * 0.75 + dx, hipY - 6); ctx.lineTo(q + dx + Math.sin(b) * 2, hipY + 14); } ctx.stroke(); }
    torso2(dx, T, hipY - (o.sk ? 6 : 0), o.cl);
    const sl = [-21 + dx, T + 7], sr = [21 + dx, T + 7], ea = Math.min(1.25, amp);
    const L = [sl[0] + (P.L[0] + 22) * ea, sl[1] + (P.L[1] + 90) * ea], R = [sr[0] + (P.R[0] - 22) * ea, sr[1] + (P.R[1] + 90) * ea];
    const mL = lerpP(sl, L, 0.5), mR = lerpP(sr, R, 0.5); mL[0] -= 8; mR[0] += 8;
    head(dx, T - 18, { ...o, dancing: true }, P.tilt * amp + Math.sin(b * 2) * 0.12 * amp);
    limb2(sl[0], sl[1], mL[0], mL[1], L[0], L[1], 10, 8.5, o.cl.c); hand2(L[0], L[1], angOf(mL[0], mL[1], L[0], L[1]), 5, o.cl.k === 'pe' || o.cl.k === 'hood' ? null : '#fff');
    limb2(sr[0], sr[1], mR[0], mR[1], R[0], R[1], 10, 8.5, o.cl.c); hand2(R[0], R[1], angOf(mR[0], mR[1], R[0], R[1]), 5, o.cl.k === 'pe' || o.cl.k === 'hood' ? null : '#fff');
    ctx.restore();
  }
  // 반 친구들(자리·생김새·춤 다 다르게) + 나
  const CL = { blz: { c: '#2f3f63', d: '#22304e', p: '#3a3f52' }, hoodG: { c: '#9aa3b5', d: '#7c8496', p: '#3a3f52', k: 'hood' }, hoodP: { c: '#ff9ec4', d: '#e07fa6', p: '#3a3f52', k: 'hood' },
    hoodN: { c: '#7fd49a', d: '#5eb27a', p: '#3a3f52', k: 'hood' }, pe: { c: '#e0464e', d: '#fff', p: '#e0464e', k: 'pe' }, card: { c: '#e8d3a8', d: '#c9b07f', p: '#3a3f52' } };
  const KIDS = [
    { x: 62, y: 400, sc: 0.6, hc: '#2a2228', hs: 'short', cl: CL.blz, acc: '', ds: 3, ph: 0.4, tp: 1.1, pr: 1, wr: 1 },
    { x: 140, y: 400, sc: 0.6, hc: '#3b2a20', hs: 'bun', cl: CL.card, sk: '#3a4566', acc: 'ribbon', ds: 5, ph: 1.7, tp: 0.9, sleep: true, pr: 0, wr: 0 },
    { x: 220, y: 400, sc: 0.6, hc: '#1f1f26', hs: 'buzz', cl: CL.pe, acc: '', ds: 7, ph: 2.6, tp: 1.2, pr: 2, wr: 0 },
    { x: 298, y: 400, sc: 0.6, hc: '#6b4a2e', hs: 'wave', cl: CL.hoodP, sk: '#3a4566', acc: 'band', ds: 1, ph: 0.9, tp: 0.85, pr: 3, wr: 1 },
    { x: 78, y: 486, sc: 0.82, hc: '#26222e', hs: 'twin', cl: CL.blz, sk: '#3a4566', acc: '', ds: 6, ph: 3.1, tp: 1, pr: 1, wr: 0 },
    { x: 282, y: 486, sc: 0.82, hc: '#2a2228', hs: 'short', cl: CL.hoodG, acc: 'phones', ds: 4, ph: 1.2, tp: 1.05, pr: 2, wr: 1 },
    { x: 22, y: 604, sc: 1.12, hc: '#4a3324', hs: 'pony', cl: CL.hoodN, sk: '#3a4566', acc: '', ds: 2, ph: 2.2, tp: 1.15, pr: 3, wr: 0 },
    { x: 338, y: 604, sc: 1.12, hc: '#1f1f26', hs: 'short', cl: CL.blz, acc: 'cap', ds: 0, ph: 0.2, tp: 0.95, pr: 1, wr: 0 },
  ];
  const ME = { hc: '#2a2228', hs: 'short', cl: CL.blz, acc: '', ph: 0, tp: 1, pr: 2 };
  function drawKids(party) {
    const m = s ? s.m2 / 2 : 1, lv = m >= 3.5 ? 6 : m >= 2.5 ? 0 : m >= 1.5 ? 1 : 2, amp = 1.25 + (m - 1) * 0.12;
    KIDS.forEach((o, i) => kid(o.x, o.y, o.sc, { ...o, amp, ci: i % PARTY_C.length, sleep: party ? false : o.sleep }, party, false));
    const zzz = s ? s.sleep / D.SLEEP_FULL : 0, slept = !!(s && s.st === 'caught' && s.why === 'sleep');
    const nod = !party && zzz > 0.6 ? Math.max(0, Math.sin(V.t * (2 + zzz * 3))) * (zzz - 0.6) * 40 : 0;
    kid(180, 604, 1.12, { ...ME, amp, ci: 2, ds: lv, tp: 1 + (m - 1) * 0.12, sleep: slept, nod, tilt: nod * 0.01, zz: !party && zzz > 0.75 }, party, true);
    const ay = (party ? 418 : 470) + (RM() ? 0 : Math.sin(V.t * 4) * 3);
    ctx.beginPath(); ctx.moveTo(172, ay); ctx.lineTo(188, ay); ctx.lineTo(180, ay + 9); ctx.closePath(); fs('#ffd84a', 2); text('나', 180, ay - 4, 12, 'center', K);
  }
  // 파티 조명: 천장에서 쏘는 색 빔 + 바닥 빛 웅덩이 + 교실 전체가 색색으로 번쩍(선생님 신호는 가리지 않게 학생 쪽 위주)
  const PARTY_C = ['#6fc6f4', '#ffe08a', '#8fe8cf', '#a9c4ff', '#ff8f8f', '#38a5ea'];   // 사이트 색(하늘·노랑·라임·연보라·빨강·파랑)
  // 파티 조명(2026-10-31 23:02 하율 "디자인 디벨롭"): 교실이 어두워지고 칠판 양옆에서 미러볼이 내려와 레이저·빔·반짝이
  function drawDark() {   // 선생님보다 먼저 그림 → 선생님 신호는 그대로 보임
    const a = V.pv; if (a <= 0) return;
    ctx.fillStyle = `rgba(23,48,72,${0.5 * a})`; ctx.fillRect(0, 196, W, H - 196);
    ctx.fillStyle = `rgba(23,48,72,${0.22 * a})`; ctx.fillRect(0, 0, W, 196);
  }
  const BALLS = [[46, 1], [314, -1]];
  function drawBeams(lv) {
    const a = V.pv; if (a <= 0) return;
    const rm = RM(), t = V.t;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    for (let i = 0; i < 5; i++) {   // 천장 쪽 색 빔(바닥으로)
      const ox = 20 + i * 80, ang = Math.PI / 2 + (rm ? (i - 2) * 0.25 : Math.sin(t * (1.6 + i * 0.41) + i) * 0.75), len = 700, w = 0.11;
      const c = PARTY_C[(i + Math.floor(t * 4)) % PARTY_C.length];
      const gr = ctx.createLinearGradient(ox, 205, ox + Math.cos(ang) * len, 205 + Math.sin(ang) * len); gr.addColorStop(0, c + '00'); gr.addColorStop(0.2, c + '66'); gr.addColorStop(1, c + '00');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(ox, 205); ctx.lineTo(ox + Math.cos(ang - w) * len, 205 + Math.sin(ang - w) * len); ctx.lineTo(ox + Math.cos(ang + w) * len, 205 + Math.sin(ang + w) * len); ctx.closePath(); ctx.fill();
    }
    const by = 196 + 22 * Math.min(1, a * 1.4);
    for (const [bx, d] of BALLS) {   // 레이저
      for (let i = 0; i < 6 + lv * 2; i++) {
        const ang = Math.PI / 2 + d * (rm ? i * 0.12 - 0.3 : Math.sin(t * (2.2 + i * 0.3) + i * 1.7) * 1.1), c = PARTY_C[(i + Math.floor(t * 3)) % PARTY_C.length];
        ctx.strokeStyle = c; ctx.globalAlpha = a * 0.55; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang) * 600, by + Math.sin(ang) * 600); ctx.stroke();
      }
    }
    ctx.globalAlpha = a;
    for (let i = 0; i < 5 + lv * 2; i++) {   // 바닥 빛 웅덩이
      const c = PARTY_C[(i * 3 + Math.floor(t * 6)) % PARTY_C.length], x = 30 + ((i * 97 + (rm ? 0 : Math.floor(t * 5) * 53)) % 300), y = 330 + ((i * 61 + (rm ? 0 : Math.floor(t * 5) * 37)) % 290);
      const gr = ctx.createRadialGradient(x, y, 2, x, y, 52); gr.addColorStop(0, c + '99'); gr.addColorStop(1, c + '00'); ctx.fillStyle = gr; ctx.fillRect(x - 52, y - 52, 104, 104);
    }
    ctx.restore();
    // 미러볼(실·반짝이는 면)
    for (const [bx] of BALLS) {
      ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, 196); ctx.lineTo(bx, by - 13); ctx.stroke();
      ctx.save(); ell(bx, by, 13, 13); ctx.clip();
      const gr = ctx.createRadialGradient(bx - 4, by - 5, 1, bx, by, 14); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#c9d0de'); gr.addColorStop(1, '#6f7790'); ctx.fillStyle = gr; ctx.fillRect(bx - 14, by - 14, 28, 28);
      const rot = (t * 40) % 6;
      for (let gx = -15; gx < 15; gx += 6) for (let gy = -15; gy < 15; gy += 5) { const on = (Math.floor(gx + gy + rot * 7 + t * 10) % 5 + 5) % 5 === 0; ctx.fillStyle = on ? PARTY_C[(gx + gy + 40) % PARTY_C.length] : 'rgba(255,255,255,.18)'; ctx.fillRect(bx + gx + rot, by + gy, 4.4, 3.6); }
      ctx.restore(); ell(bx, by, 13, 13); ctx.lineWidth = 2.2; ctx.strokeStyle = K; ctx.stroke();
      if (!rm) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 * a; outlined('✦', bx + Math.sin(t * 7) * 10, by - 8 + Math.cos(t * 5) * 6, 12, '#fff'); ctx.restore(); }
    }
  }
  function drawTint(lv) {
    const a = V.pv; if (a <= 0) return;
    const t = V.t, c = PARTY_C[Math.floor(t * (RM() ? 1 : 6)) % PARTY_C.length], on = Math.floor(t * 8) % 2 === 0;
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = (0.4 + lv * 0.1) * a; ctx.fillStyle = c; ctx.fillRect(0, 300, W, H - 300);
    ctx.restore();
    if (on && !RM()) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.07 + lv * 0.025) * a; ctx.fillStyle = PARTY_C[(Math.floor(t * 8) + 2) % PARTY_C.length]; ctx.fillRect(0, 300, W, H - 300); ctx.restore(); }
    if (!RM()) { ctx.globalAlpha = a; for (let i = 0; i < 14 + lv * 6; i++) { const x = (i * 71 + t * 40 * (i % 3 + 1)) % W, y = 220 + ((i * 113 + t * (60 + (i % 4) * 30)) % 420); ctx.fillStyle = PARTY_C[i % PARTY_C.length]; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4 + i); ctx.fillRect(-3, -2, 6, 4); ctx.restore(); } ctx.globalAlpha = 1; }
  }
  // 휙 돌아보는 순간·보는 동안·걸린 순간 연출
  function drawAlert() {
    const tst = s ? s.st : '', looking = tst === 'look' || (tst === 'peek' && s.dur - s.tm >= D.PEEK_IN);
    if (looking && st.scene === 'play') {   // 보는 동안: 붉은 테두리가 두근두근
      const p = 0.22 + 0.1 * (RM() ? 0 : Math.sin(V.t * 14));
      const gr = ctx.createRadialGradient(180, 330, 150, 180, 330, 400); gr.addColorStop(0, 'rgba(224,40,60,0)'); gr.addColorStop(1, `rgba(224,40,60,${p})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    if (V.alert > 0) { const k2 = V.alert > 0.5 ? (0.6 - V.alert) * 10 : 1, sz = 46 * (0.5 + 0.5 * Math.min(1, k2 * 1.6)); ctx.globalAlpha = Math.min(1, V.alert * 4); outlined('!', V.tx + 30, 120, sz, '#ff4757'); ctx.globalAlpha = 1; }
    if (V.wflash > 0) { ctx.fillStyle = `rgba(255,255,255,${V.wflash * 3})`; ctx.fillRect(0, 0, W, H); }
    if (V.stamp > 0) {   // 걸렸다 도장
      const p = Math.min(1, V.stamp / 0.16), sc2 = 1.8 - 0.8 * p;
      ctx.save(); ctx.translate(180, 400); ctx.rotate(-0.12); ctx.scale(sc2, sc2); ctx.globalAlpha = Math.min(1, p * 1.5);
      ctx.font = `34px ${FONT}`; const w = ctx.measureText(V.stampT).width + 34;
      rr(-w / 2 + 4, -28 + 5, w, 56, 12); ctx.fillStyle = K; ctx.fill();
      rr(-w / 2, -28, w, 56, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#e0283c'; ctx.stroke();
      rr(-w / 2 + 6, -22, w - 12, 44, 8); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#e0283c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(V.stampT, 0, 2); ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }
  // 화면 위 표시(사이트 스티커 느낌: 잉크 테두리 + 오른쪽 아래 그림자)
  const chip = (x, y, w, h, fill) => { rr(x + 3, y + 3, w, h, h / 2); ctx.fillStyle = K; ctx.fill(); rr(x, y, w, h, h / 2); fs(fill, 2.5); };
  function drawHud() {
    const sc = s ? D.scoreOf(s) : 0, m = s ? s.m2 / 2 : 1, sec = s ? Math.floor(s.f / D.FPS) : 0;
    chip(8, 8, 118, 30, '#fffdf7');
    ctx.save(); ctx.translate(26, 23); ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.6 : 8, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); fs('#ffd84a', 1.8); ctx.restore();
    ctx.font = `800 17px ${NUMF}`; ctx.textAlign = 'center'; ctx.fillStyle = K; ctx.fillText(fmt(sc), 78, 29.5);
    const mc = m >= 3.5 ? '#ff8f8f' : m >= 2.5 ? '#ffc83d' : m >= 1.5 ? '#38a5ea' : '#9fb3c6';
    const pulse = s && s.dancing && m > 1 && !RM() ? 1 + Math.abs(Math.sin(V.t * 8)) * 0.06 : 1;
    ctx.save(); ctx.translate(165, 23); ctx.scale(pulse, pulse); ctx.translate(-165, -23);
    chip(134, 8, 62, 30, mc);
    ctx.beginPath(); ctx.moveTo(149, 33); ctx.bezierCurveTo(141, 31, 141, 22, 146, 14); ctx.bezierCurveTo(146, 19, 148, 21, 150, 19); ctx.bezierCurveTo(151, 15, 150, 13, 149, 11); ctx.bezierCurveTo(155, 15, 158, 22, 156, 28); ctx.bezierCurveTo(155, 31, 152, 33, 149, 33); fs(m > 1 ? '#ffd84a' : '#d9d4e2', 1.6);
    if (m > 1) { ctx.beginPath(); ctx.moveTo(149, 31); ctx.bezierCurveTo(146, 29, 147, 25, 149, 23); ctx.bezierCurveTo(151, 26, 153, 28, 149, 31); ctx.fillStyle = '#ff6b3d'; ctx.fill(); }
    ctx.font = `800 16px ${NUMF}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = K; ctx.strokeText('x' + m, 174, 29.5); ctx.fillText('x' + m, 174, 29.5); ctx.restore();
    chip(268, 8, 84, 30, '#fffdf7');
    ell(285, 23, 8, 8); fs('#e9f3ff', 1.8); ctx.strokeStyle = K; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(285, 23); ctx.lineTo(285, 18); ctx.moveTo(285, 23); ctx.lineTo(289, 24); ctx.stroke();
    ctx.font = `800 16px ${NUMF}`; ctx.textAlign = 'center'; ctx.fillStyle = K; ctx.fillText(Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), 318, 29.5);
    // 졸음 게이지(춤 안 추면 차고, 다 차면 졸다 걸림)
    const zv = s ? s.sleep / D.SLEEP_FULL : 0, sh = zv > 0.75 && !RM() ? Math.sin(V.t * 40) * 1.2 : 0;
    ctx.save(); ctx.translate(sh, 0);
    chip(40, 616, 304, 18, '#fffdf7');
    if (zv > 0) { rr(44, 620, Math.max(10, 296 * zv), 10, 5); const gz = ctx.createLinearGradient(44, 0, 340, 0); gz.addColorStop(0, '#8fb4ff'); gz.addColorStop(0.55, '#9b6bff'); gz.addColorStop(1, '#ff4f6a'); ctx.fillStyle = zv > 0.75 && Math.floor(V.t * 8) % 2 ? '#ff4f6a' : gz; ctx.fill(); }
    ctx.restore();
    ell(22, 625, 13, 13); fs(zv > 0.75 ? '#ff9b9b' : '#3b3f78', 2.2);
    ctx.beginPath(); ctx.arc(22, 625, 7, 0.6, 5.7); ctx.arc(25.5, 622.5, 5.5, 5.4, 0.9, true); ctx.closePath(); ctx.fillStyle = '#ffe28a'; ctx.fill();
    if (zv > 0.4) outlined('Zz', 46 + 296 * zv, 612, 12, '#e9e4ff');
    if (s && s.f < D.FPS * 6) { ctx.globalAlpha = Math.min(1, (D.FPS * 6 - s.f) / D.FPS); outlined(touchSeen ? '화면을 꾹 누르면 춤!' : '꾹 누르면 춤!', 180, 600, 17, '#fff'); ctx.globalAlpha = 1; }
  }
  function drawCount() {
    const total = st.scene === 'resume' ? 1000 : 3000, left = total - countT;
    let t, ph; if (st.scene === 'count') { t = '연결 중…'; ph = 0.5; } else if (left > 0) { t = String(Math.ceil(left / 1000)); ph = 1 - (left % 1000) / 1000; } else { t = '시작!'; ph = 0.5; }
    const sz = (t.length > 2 ? 40 : 84) * (ph < 0.15 ? 0.6 + ph * 3 : 1);
    ctx.fillStyle = 'rgba(42,40,70,.3)'; ctx.fillRect(0, 0, W, H);
    if (t.length < 3) { ell(W / 2 + 4, 334, 52, 52); ctx.fillStyle = K; ctx.fill(); ell(W / 2, 330, 52, 52); fs('#3b6cf6', 3); }
    outlined(t, W / 2, t.length < 3 ? 330 + sz * 0.36 : 360, sz, '#fff');
  }
  function draw() {
    if (!cv.width) return;
    const sc = k * dpr; ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.save();
    if (V.shake > 0 && !RM()) ctx.translate((Math.random() - 0.5) * 10 * V.shake / 0.45, (Math.random() - 0.5) * 10 * V.shake / 0.45);
    const party = !!(s && s.dancing && st.scene === 'play'), lv = s ? (s.m2 - 2) / 2 : 0;
    drawRoom(); drawDark(); drawBeams(lv); drawTeacher();
    drawKids(party);
    drawTint(lv);
    for (const q of V.parts) { ctx.globalAlpha = Math.min(1, q.life * 1.5); if (q.kind === 'note') text('♪', q.x, q.y, 16, 'center', q.c); else { ctx.fillStyle = q.c; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r + q.life * 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore(); } }
    ctx.globalAlpha = 1;
    for (const q of V.pops) { ctx.globalAlpha = Math.min(1, q.life * 2); outlined(q.t, q.x, q.y, q.size, q.c); } ctx.globalAlpha = 1;
    ctx.restore();
    if (V.flash > 0) { const gr = ctx.createRadialGradient(180, 320, 120, 180, 320, 380); gr.addColorStop(0, 'rgba(255,40,40,0)'); gr.addColorStop(1, `rgba(255,40,40,${V.flash * 0.7})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
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
