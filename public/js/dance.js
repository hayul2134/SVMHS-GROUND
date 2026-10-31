// SVMHS GROUND — 선생님 몰래 춤추기 화면 (2026-10-31 하율: "선생님은 전자칠판 앞에서 수업, 나무 막대기를 한 손에, 네모난 안경, 머리숱 많은 60대 남자 선생님", 미리보기 깃발 dance-game)
// 규칙·판 진행은 dance-score.js(서버와 같음) — 여기는 그리기·입력·소리만. 판에 영향을 주는 값은 전부 시뮬레이션(s)에서 읽음.
// 판서 글씨·선생님 걷기·친구들 반응·말풍선은 그림일 뿐(판과 무관). 입력(누름/뗌)은 1/60초 프레임 번호로 기록(rounds) → 서버가 같은 판을 다시 돌려 점수를 확인.
import * as D from './dance-score.js';

const W = 360, H = 640;
const K = '#2b2433';
const FONT = '"Jua", "Pretendard Variable", system-ui, sans-serif';
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
  function start() {
    if (st.scene !== 'ready') return;
    ov.hidden = true; st.scene = 'count'; countT = 0; evRun++;
    const my = evRun; seed = null; saved = false;
    Promise.resolve(opts.seed ? opts.seed() : null).catch(() => null).then(x => { if (my === evRun) { seed = x; saved = x != null; } return x; });
    s = null; resetFx(); sfx.beep(false);
  }
  function begin() {
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
      const total = st.scene === 'resume' ? 1000 : 3000, prevN = Math.ceil((total - (countT - dt)) / 1000), n = Math.ceil((total - countT) / 1000);
      if (n !== prevN && n > 0) sfx.beep(false);
      if (countT >= total) {
        if (st.scene === 'resume') { st.scene = 'play'; acc = 0; }
        else if (seed != null || countT >= total + 4000 || !opts.seed) { sfx.beep(true); begin(); }
      }
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
    let gr = x.createLinearGradient(0, 0, 0, 236); gr.addColorStop(0, '#fbf4e6'); gr.addColorStop(1, '#efe2c8'); x.fillStyle = gr; x.fillRect(0, 0, W, 236);
    x.strokeStyle = 'rgba(160,130,90,.10)'; x.lineWidth = 1; for (let i = 12; i < W; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 236); x.stroke(); }
    // 아래 벽 판자(초록)
    gr = x.createLinearGradient(0, 236, 0, 300); gr.addColorStop(0, '#b4d6ba'); gr.addColorStop(1, '#94bf9d'); x.fillStyle = gr; x.fillRect(0, 236, W, 64);
    x.fillStyle = '#7fae89'; x.fillRect(0, 236, W, 5); x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(0, 236, W, 1.5);
    x.strokeStyle = 'rgba(40,80,50,.22)'; x.lineWidth = 1.5; for (let i = 6; i < W; i += 44) { x.strokeRect(i, 247, 36, 44); }
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
    rr(16, 46, 328, 150, 12); fs('#3a404c', 3);
    gr = x.createLinearGradient(0, 46, 0, 196); gr.addColorStop(0, '#525a68'); gr.addColorStop(1, '#2e333d'); rr(18, 48, 324, 146, 11); x.fillStyle = gr; x.fill();
    rr(128, 194, 104, 8, 3); fs('#4b525f', 2); rr(150, 192, 22, 4, 2); fs('#ff6b6b', 1.4); rr(178, 192, 18, 4, 2); fs('#7dd3ff', 1.4);
    // 급훈 액자
    rr(222, 204, 82, 24, 4); fs('#fffaf0', 2); x.fillStyle = '#7c5b3f'; x.font = `11px ${FONT}`; x.textAlign = 'center'; x.fillText('급훈 · 정직과 성실', 263, 220);
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

  // 선생님: 60대, 숱 많은 은발(옆 가르마), 네모 안경, 갈색 니트 조끼·넥타이, 한 손에 나무 막대기
  function stick(x1, y1, x2, y2) {
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = 7; ctx.strokeStyle = K; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = WOOD; ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#e2b072'; ctx.beginPath(); ctx.moveTo(x1 + (x2 - x1) * 0.1, y1 + (y2 - y1) * 0.1 - 1); ctx.lineTo(x1 + (x2 - x1) * 0.8, y1 + (y2 - y1) * 0.8 - 1); ctx.stroke();
    ell(x2, y2, 3.2, 3.2); fs('#7a4f26', 1.6);
  }
  function lowerBody() {
    ell(-11, -3, 12, 5); fs('#3b2d26'); ell(12, -3, 12, 5); fs('#3b2d26');
    rr(-19, -62, 17, 58, 4); fs(PANTS); rr(2, -62, 17, 58, 4); fs(PANTS);
    rr(-21, -66, 42, 8, 3); fs('#3b3340', 2);
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
  function teacherBack(tv) {
    const warn = tv.tst === 'warn', peek = tv.tst === 'peek', tw = V.twitch > 0 && !RM() ? Math.sin(V.twitch * 60) * 1.5 : 0;
    stick(-40, -22, -24, -120);
    limb(-25, -116, -31, -72, 10, SHIRT, -31, -94); ell(-31, -70, 5.5, 5.5); fs(SKIN, 2);
    lowerBody();
    rr(-28, -126, 56, 70, 14); fs(SHIRT);
    ctx.beginPath(); ctx.moveTo(-24, -122); ctx.lineTo(24, -122); ctx.lineTo(23, -62); ctx.quadraticCurveTo(0, -56, -23, -62); ctx.closePath(); fs(VEST);
    ctx.strokeStyle = VEST2; ctx.lineWidth = 1.2; for (let y = -112; y < -64; y += 7) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(20, y); ctx.stroke(); }
    // 판서하는 손(전자펜)
    let hx = V.hx, hy = V.hy;
    if (tv.tst === 'pause') { hx += 4; hy += 6; }   // 말없이 멈춤: 펜만 칠판에서 살짝 뗌
    else if (tv.tst !== 'write') { hx = 30; hy = -88; }
    const sxp = 24, syp = -116, dx = hx - sxp, dy = hy - syp, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 78); hx = sxp + dx / d * m; hy = syp + dy / d * m;
    limb(sxp, syp, hx, hy, 10, SHIRT, sxp + dx / d * m * 0.5 + 10, syp + dy / d * m * 0.5 + 12); ell(hx, hy, 5.5, 5.5); fs(SKIN, 2);
    ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 3, hy - 9); ctx.stroke();
    // 뒤통수(경고 땐 고개가 살짝 돌아가 볼·안경다리가 보임)
    rr(-7, -134, 14, 12, 4); fs(SKIN, 2);
    // 흠… = 고개 살짝(볼·안경다리) · 곁눈질 = 어깨 너머로 크게(안경까지)
    const turn = peek ? 1 + clamp((tv.dur - tv.tm) / D.PEEK_IN, 0, 1) * 0.9 : warn ? clamp(0.35 + (tv.dur - tv.tm) / D.FPS * 1.3, 0.35, 1) : 0, o = tw;
    ell(-19 + o, -149, 4.5, 6.5); fs(SKIN, 2); ell(19 + o + turn * 3, -149, 4.5 + turn * 1.5, 6.5); fs(SKIN, 2);
    if (turn > 0) { ell(10 + o + turn * 4, -146, 12, 17); fs(SKIN, 2); ctx.strokeStyle = '#1d1d22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14 + turn * 3 + o, -151); ctx.lineTo(22 + turn * 3 + o, -151); ctx.stroke();
      if (turn > 1.3) { ctx.fillStyle = 'rgba(190,225,255,.28)'; rr(15 + turn * 3 + o, -155, 8, 10, 1.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1d1d22'; ctx.fillRect(17 + turn * 3 + o, -151, 3, 2.2); } }
    ctx.beginPath(); ctx.moveTo(-21 + o, -148); ctx.bezierCurveTo(-25 + o, -182, 25 + o - turn * 4, -182, 21 + o - turn * 4, -148);
    ctx.quadraticCurveTo(20 + o, -136, 12 + o, -134); ctx.lineTo(-12 + o, -134); ctx.quadraticCurveTo(-20 + o, -136, -21 + o, -148); ctx.closePath(); fs(HAIR, 2.4);
    ctx.strokeStyle = HAIR2; ctx.lineWidth = 1.3;
    for (const [a, b, c2, d2] of [[-12, -170, -15, -142], [-3, -174, -6, -140], [6, -173, 5, -140], [14, -166, 13, -143]]) { ctx.beginPath(); ctx.moveTo(a + o, b); ctx.quadraticCurveTo(a + o - 4, (b + d2) / 2, c2 + o, d2); ctx.stroke(); }
  }
  function teacherFront(tv) {
    const mood = tv.mood, ang = mood === 'angry';
    let hx = 31, hy = -72, tx = 38, ty = -128, bx = 26, by = -24;
    if (ang) { const w = RM() ? 0 : Math.sin(V.t * 28) * 0.18; hx = 36; hy = -132; const a = -1.05 + w; bx = hx - Math.cos(a) * 14; by = hy - Math.sin(a) * 14; tx = hx + Math.cos(a) * 78; ty = hy + Math.sin(a) * 78; }
    lowerBody();
    rr(-28, -126, 56, 70, 14); fs(SHIRT);
    ctx.beginPath(); ctx.moveTo(-24, -122); ctx.lineTo(-9, -122); ctx.lineTo(0, -96); ctx.lineTo(9, -122); ctx.lineTo(24, -122); ctx.lineTo(23, -62); ctx.quadraticCurveTo(0, -56, -23, -62); ctx.closePath(); fs(VEST);
    ctx.beginPath(); ctx.moveTo(-4, -122); ctx.lineTo(4, -122); ctx.lineTo(6, -102); ctx.lineTo(0, -96); ctx.lineTo(-6, -102); ctx.closePath(); fs('#8b2d3a', 1.8);
    ctx.beginPath(); ctx.moveTo(-9, -125); ctx.lineTo(0, -120); ctx.lineTo(-5, -114); ctx.closePath(); fs(SHIRT, 1.6); ctx.beginPath(); ctx.moveTo(9, -125); ctx.lineTo(0, -120); ctx.lineTo(5, -114); ctx.closePath(); fs(SHIRT, 1.6);
    for (const y of [-88, -78, -68]) { ell(0, y, 1.8, 1.8); ctx.fillStyle = '#3d2a1b'; ctx.fill(); }
    if (ang) { limb(-25, -116, -44, -96, 10, SHIRT, -36, -104); ell(-46, -95, 5.5, 5.5); fs(SKIN, 2); limb(-48, -97, -56, -99, 2.5, SKIN); }
    else { limb(-25, -116, -30, -72, 10, SHIRT, -31, -94); ell(-30, -70, 5.5, 5.5); fs(SKIN, 2); }
    limb(25, -116, hx, hy, 10, SHIRT, ang ? 42 : 31, ang ? -112 : -94); stick(bx, by, tx, ty); ell(hx, hy, 5.5, 5.5); fs(SKIN, 2);
    rr(-7, -134, 14, 12, 4); fs(SKIN, 2);
    ell(-19, -149, 4.5, 6.5); fs(SKIN, 2); ell(19, -149, 4.5, 6.5); fs(SKIN, 2);
    ell(0, -148, 18, 21); fs(ang ? '#f5b39a' : SKIN, 2.4);
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 1.2;
    for (const y of [-162, -158]) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.quadraticCurveTo(0, y - 2, 8, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-8, -141); ctx.quadraticCurveTo(-10, -136, -7, -132); ctx.moveTo(8, -141); ctx.quadraticCurveTo(10, -136, 7, -132); ctx.stroke();
    // 숱 많은 은발
    ctx.beginPath(); ctx.moveTo(-20, -146); ctx.bezierCurveTo(-26, -176, -4, -184, 8, -178); ctx.bezierCurveTo(20, -176, 26, -164, 20, -146);
    ctx.quadraticCurveTo(17, -158, 10, -164); ctx.quadraticCurveTo(-2, -160, -8, -168); ctx.quadraticCurveTo(-14, -160, -17, -150); ctx.closePath(); fs(HAIR, 2.4);
    ctx.strokeStyle = HAIR2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-6, -176); ctx.quadraticCurveTo(-12, -170, -14, -158); ctx.moveTo(4, -177); ctx.quadraticCurveTo(14, -172, 17, -158); ctx.moveTo(-1, -178); ctx.quadraticCurveTo(2, -172, 8, -167); ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#8c8f98'; ctx.lineWidth = 3.2; ctx.beginPath();
    if (ang) { ctx.moveTo(-14, -160); ctx.lineTo(-4, -156); ctx.moveTo(14, -160); ctx.lineTo(4, -156); }
    else if (mood === 'sus') { ctx.moveTo(-14, -158); ctx.lineTo(-4, -157); ctx.moveTo(14, -162); ctx.lineTo(4, -159); }
    else { ctx.moveTo(-14, -158); ctx.lineTo(-4, -159); ctx.moveTo(14, -158); ctx.lineTo(4, -159); }
    ctx.stroke();
    const px = mood === 'sus' && !RM() ? Math.sin(V.t * 3.2) * 2.4 : 0; ctx.fillStyle = '#1d1d22';
    if (mood === 'sus') { ctx.fillRect(-11 + px, -150, 4, 2.2); ctx.fillRect(7 + px, -150, 4, 2.2); }
    else { ell(-9 + px, -149, 2, 2.2); ctx.fill(); ell(9 + px, -149, 2, 2.2); ctx.fill(); }
    // 네모 안경
    ctx.lineWidth = 2.2; ctx.strokeStyle = '#1d1d22'; ctx.fillStyle = 'rgba(190,225,255,.28)';
    rr(-16, -154, 13, 10, 1.5); ctx.fill(); ctx.stroke(); rr(3, -154, 13, 10, 1.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -150); ctx.lineTo(3, -150); ctx.moveTo(-16, -151); ctx.lineTo(-19, -150); ctx.moveTo(16, -151); ctx.lineTo(19, -150); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-13, -152); ctx.lineTo(-10, -152); ctx.moveTo(6, -152); ctx.lineTo(9, -152); ctx.stroke();
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, -146); ctx.quadraticCurveTo(-3, -140, 1, -139); ctx.stroke();
    ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.beginPath();
    if (ang) { ell(0, -133, 5, 3.5); ctx.fillStyle = '#7a2630'; ctx.fill(); ctx.stroke(); }
    else if (mood === 'sus') { ctx.moveTo(-5, -133); ctx.lineTo(5, -134); ctx.stroke(); }
    else { ctx.moveTo(-5, -134); ctx.quadraticCurveTo(0, -132, 5, -134); ctx.stroke(); }
    if (ang) { ctx.strokeStyle = '#e0464e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22, -176); ctx.lineTo(28, -170); ctx.moveTo(28, -176); ctx.lineTo(22, -170); ctx.stroke(); }
  }

  // 학생들(뒷모습) — 2026-10-31 하율 "춤출 때는 모든 학생이 일어나서 광란의 파티": 평소엔 앉아 있고, 내가 춤추면 다 같이 일어나 저마다 다른 춤
  // o: { hc 머리색, hs 머리 모양(short·long·pony·bun·twin·buzz), cl 옷(색·종류), acc 장식, ds 춤 종류, ph 박자 어긋남, tp 빠르기 }
  const desk = () => { rr(-46, -82, 92, 10, 3); fs('#d8b07c', 2.2); ctx.fillStyle = '#b98d5a'; ctx.fillRect(-44, -73, 88, 3); };
  const chair = () => { rr(-30, -36, 60, 26, 6); fs('#5d7fa8', 2.4); ctx.strokeStyle = K; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-24, -10); ctx.lineTo(-24, 4); ctx.moveTo(24, -10); ctx.lineTo(24, 4); ctx.stroke(); };
  const torso = (dx, top, bot, cl) => {
    rr(-25 + dx, top, 50, bot - top, 15); fs(cl.c, 2.4);
    ctx.strokeStyle = cl.d; ctx.lineWidth = 1.5; ctx.beginPath();
    if (cl.k === 'hood') { ctx.moveTo(-12 + dx, top + 3); ctx.quadraticCurveTo(dx, top + 22, 12 + dx, top + 3); }   // 후드 모자
    else if (cl.k === 'pe') { ctx.moveTo(-25 + dx, top + 20); ctx.lineTo(25 + dx, top + 20); }   // 체육복 줄
    else ctx.moveTo(dx, top + 4), ctx.lineTo(dx, bot - 6);   // 등 솔기
    ctx.stroke();
  };
  function head(x, y, o, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0);
    const hc = o.hc, hs = o.hs, sw = Math.sin(V.t * 9 + o.ph) * (o.dancing ? 0.5 : 0.05);
    if (hs === 'long') { rr(-17, -2, 34, 34, 10); fs(hc, 2.2); }
    if (hs === 'pony') { ctx.save(); ctx.translate(0, 4); ctx.rotate(sw); rr(-5, 0, 10, 28, 5); fs(hc, 2); ctx.restore(); }
    if (hs === 'twin') for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * 15, -2); ctx.rotate(d * (0.3 + sw)); rr(-4, 0, 8, 22, 4); fs(hc, 2); ctx.restore(); }
    ell(-17, 0, 3.5, 5); fs(SKIN, 2); ell(17, 0, 3.5, 5); fs(SKIN, 2);
    ell(0, -2, hs === 'buzz' ? 16 : 17, hs === 'buzz' ? 16.5 : 18); fs(hc, 2.4);
    if (hs === 'bun') { ell(0, -21, 7, 6); fs(hc, 2.2); }
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-3, -6, 10, 3.6, 4.6); ctx.stroke();
    if (o.acc === 'band') { ctx.strokeStyle = K; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -2, 17, 3.5, 5.9); ctx.stroke(); ctx.strokeStyle = '#ff6fa8'; ctx.lineWidth = 3; ctx.stroke(); }
    if (o.acc === 'cap') { ctx.beginPath(); ctx.arc(0, -4, 17.5, Math.PI, 0); ctx.closePath(); fs('#e0464e', 2.2); rr(-9, -4, 18, 5, 2); fs('#c43a42', 1.8); }
    if (o.acc === 'phones') { ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -2, 19, 3.3, 6.1); ctx.stroke(); for (const d of [-1, 1]) { rr(d * 19 - 4, -6, 8, 12, 3); fs('#3b6cf6', 2); } }
    if (o.acc === 'ribbon') { ctx.save(); ctx.translate(9, -16); for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d * 9, -5); ctx.lineTo(d * 9, 5); ctx.closePath(); fs('#ffd84a', 1.8); } ctx.restore(); }
    ctx.restore();
  }
  // 춤 동작: 판 시각 b(라디안)로 몸 흔들기·팔 위치(서 있는 자세 기준 좌표)
  const lerpP = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  function pose(ds, b) {
    const S = Math.sin(b), A = Math.abs(S);
    switch (ds) {
      case 0: { const f = S > 0; return { dx: f ? 4 : -4, dy: -A * 4, tilt: f ? 0.12 : -0.12, L: f ? [-48, -150] : [-34, -62], R: f ? [34, -62] : [48, -150] }; }   // 디스코 찌르기
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
    desk();
    if (!party) {   // 앉아서 공부하는 척(또는 졸기)
      if (o.sleep) {   // 책상에 엎드려 잠: 머리가 어깨 뒤로 숨고 팔은 베개
        limb(-22, -50, -14, -76, 9, o.cl.c, -30, -66); limb(22, -50, 14, -76, 9, o.cl.c, 30, -66); head(0, -66, o, 0); torso(0, -58, -8, o.cl);
      } else {
        torso(0, -64, -8, o.cl);
        if (me) { limb(-22, -56, -8, -78, 9, o.cl.c, -26, -64); limb(22, -56, 12, -80, 9, o.cl.c, 26, -64); }
        head(0, -82 + (o.nod || 0), o, o.tilt || 0);
      }
      chair(); ctx.restore();
      if (o.sleep || o.zz) { const big = me ? 1.6 : 1; for (let i = 0; i < (me ? 2 : 1); i++) { const a = (V.t * 0.8 + o.ph + i * 0.5) % 1; ctx.globalAlpha = 1 - a; outlined(i ? 'Z' : 'z', x + 12 * sc + a * 10, y - 80 * sc - a * 18, (11 + a * 4) * big, '#e9e4ff'); } ctx.globalAlpha = 1; }
      return;
    }
    chair();
    // 격렬하게(2026-10-31 23:02 하율 "더 격렬히"): 빠른 박자 · 큰 몸짓 · 통통 튀기 · 고개 젖히기 · 발밑 색 조명
    const amp = o.amp || 1.3, b = V.t * Math.PI * 2 * o.tp * 1.7 + o.ph, P = pose(o.ds, b);
    const bounce = Math.abs(Math.sin(b * 2)) * 7 * amp, dx = P.dx * amp + Math.sin(b * 0.5) * 3 * amp, dy = P.dy * amp - bounce, lift = (P.jump ? P.jump * 16 * amp : 0) + bounce * 0.5;
    const glow = PARTY_C[(o.ci || 0) + Math.floor(V.t * 5) % PARTY_C.length] || PARTY_C[0];
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * V.pv; ell(0, 4, 40, 9); ctx.fillStyle = glow; ctx.fill(); ctx.restore();
    const legSw = Math.sin(b) * 6 * amp, kick = Math.max(0, Math.sin(b * 2)) * 8 * amp;
    limb(-9 + dx * 0.5, -40 + dy, -12 + legSw - (o.ds % 2 ? kick : 0), 2 - lift, 10, o.cl.p); limb(9 + dx * 0.5, -40 + dy, 12 - legSw + (o.ds % 2 ? 0 : kick), 2 - lift - (o.ds % 2 ? 0 : kick * 0.6), 10, o.cl.p);
    ell(-12 + legSw - (o.ds % 2 ? kick : 0), 4 - lift, 7, 3.5); fs('#2f2a33', 1.8); ell(12 - legSw + (o.ds % 2 ? 0 : kick), 4 - lift - (o.ds % 2 ? 0 : kick * 0.6), 7, 3.5); fs('#2f2a33', 1.8);
    const stretch = Math.sin(b * 2) * 3 * amp;
    torso(dx, -98 + dy - stretch, -38 + dy, o.cl);
    const sl = [-22 + dx, -90 + dy - stretch], sr = [22 + dx, -90 + dy - stretch], ea = Math.min(1.25, amp);
    const L = [sl[0] + (P.L[0] + 22) * ea, sl[1] + (P.L[1] + 90) * ea], R = [sr[0] + (P.R[0] - 22) * ea, sr[1] + (P.R[1] + 90) * ea];
    const mL = lerpP(sl, L, 0.5), mR = lerpP(sr, R, 0.5);
    head(dx, -116 + dy - stretch, { ...o, dancing: true }, P.tilt * amp + Math.sin(b * 2) * 0.12 * amp);
    limb(sl[0], sl[1], L[0], L[1], 9, o.cl.c, mL[0] - 8, mL[1]); ell(L[0], L[1], 5, 5); fs(SKIN, 2);
    limb(sr[0], sr[1], R[0], R[1], 9, o.cl.c, mR[0] + 8, mR[1]); ell(R[0], R[1], 5, 5); fs(SKIN, 2);
    ctx.restore();
  }
  // 반 친구들(자리·생김새·춤 다 다르게) + 나
  const CL = { blz: { c: '#2f3f63', d: '#22304e', p: '#3a3f52' }, hoodG: { c: '#9aa3b5', d: '#7c8496', p: '#3a3f52', k: 'hood' }, hoodP: { c: '#ff9ec4', d: '#e07fa6', p: '#3a3f52', k: 'hood' },
    hoodN: { c: '#7fd49a', d: '#5eb27a', p: '#3a3f52', k: 'hood' }, pe: { c: '#e0464e', d: '#fff', p: '#e0464e', k: 'pe' }, card: { c: '#e8d3a8', d: '#c9b07f', p: '#3a3f52' } };
  const KIDS = [
    { x: 62, y: 400, sc: 0.6, hc: '#2a2228', hs: 'short', cl: CL.blz, acc: '', ds: 3, ph: 0.4, tp: 1.1 },
    { x: 140, y: 400, sc: 0.6, hc: '#3b2a20', hs: 'bun', cl: CL.card, acc: 'ribbon', ds: 5, ph: 1.7, tp: 0.9, sleep: true },
    { x: 220, y: 400, sc: 0.6, hc: '#1f1f26', hs: 'buzz', cl: CL.pe, acc: '', ds: 7, ph: 2.6, tp: 1.2 },
    { x: 298, y: 400, sc: 0.6, hc: '#6b4a2e', hs: 'long', cl: CL.hoodP, acc: 'band', ds: 1, ph: 0.9, tp: 0.85 },
    { x: 78, y: 486, sc: 0.82, hc: '#26222e', hs: 'twin', cl: CL.blz, acc: '', ds: 6, ph: 3.1, tp: 1 },
    { x: 282, y: 486, sc: 0.82, hc: '#2a2228', hs: 'short', cl: CL.hoodG, acc: 'phones', ds: 4, ph: 1.2, tp: 1.05 },
    { x: 22, y: 604, sc: 1.12, hc: '#4a3324', hs: 'pony', cl: CL.hoodN, acc: '', ds: 2, ph: 2.2, tp: 1.15 },
    { x: 338, y: 604, sc: 1.12, hc: '#1f1f26', hs: 'short', cl: CL.blz, acc: 'cap', ds: 0, ph: 0.2, tp: 0.95 },
  ];
  const ME = { hc: '#2a2228', hs: 'short', cl: CL.blz, acc: '', ph: 0, tp: 1 };
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
  const PARTY_C = ['#ff3ea5', '#3ec9ff', '#ffe03e', '#7dff6a', '#b26bff', '#ff8a3d'];
  // 파티 조명(2026-10-31 23:02 하율 "디자인 디벨롭"): 교실이 어두워지고 칠판 양옆에서 미러볼이 내려와 레이저·빔·반짝이
  function drawDark() {   // 선생님보다 먼저 그림 → 선생님 신호는 그대로 보임
    const a = V.pv; if (a <= 0) return;
    ctx.fillStyle = `rgba(18,10,40,${0.5 * a})`; ctx.fillRect(0, 196, W, H - 196);
    ctx.fillStyle = `rgba(18,10,40,${0.22 * a})`; ctx.fillRect(0, 0, W, 196);
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
  const chip = (x, y, w, h, fill) => { rr(x + 2.5, y + 3, w, h, h / 2); ctx.fillStyle = K; ctx.fill(); rr(x, y, w, h, h / 2); fs(fill, 2.4); };
  function drawHud() {
    const sc = s ? D.scoreOf(s) : 0, m = s ? s.m2 / 2 : 1, sec = s ? Math.floor(s.f / D.FPS) : 0;
    chip(8, 8, 118, 30, '#fffdf7');
    ctx.save(); ctx.translate(26, 23); ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.6 : 8, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); fs('#ffd84a', 1.8); ctx.restore();
    text(fmt(sc), 78, 30, 18, 'center', K);
    const mc = m >= 3.5 ? '#ff4fa0' : m >= 2.5 ? '#ff9a1f' : m >= 1.5 ? '#3b6cf6' : '#8a8496';
    const pulse = s && s.dancing && m > 1 && !RM() ? 1 + Math.abs(Math.sin(V.t * 8)) * 0.06 : 1;
    ctx.save(); ctx.translate(165, 23); ctx.scale(pulse, pulse); ctx.translate(-165, -23);
    chip(134, 8, 62, 30, mc);
    ctx.beginPath(); ctx.moveTo(149, 33); ctx.bezierCurveTo(141, 31, 141, 22, 146, 14); ctx.bezierCurveTo(146, 19, 148, 21, 150, 19); ctx.bezierCurveTo(151, 15, 150, 13, 149, 11); ctx.bezierCurveTo(155, 15, 158, 22, 156, 28); ctx.bezierCurveTo(155, 31, 152, 33, 149, 33); fs(m > 1 ? '#ffd84a' : '#d9d4e2', 1.6);
    if (m > 1) { ctx.beginPath(); ctx.moveTo(149, 31); ctx.bezierCurveTo(146, 29, 147, 25, 149, 23); ctx.bezierCurveTo(151, 26, 153, 28, 149, 31); ctx.fillStyle = '#ff6b3d'; ctx.fill(); }
    text('x' + m, 174, 30, 17, 'center', '#fff'); ctx.restore();
    chip(268, 8, 84, 30, '#fffdf7');
    ell(285, 23, 8, 8); fs('#e9f3ff', 1.8); ctx.strokeStyle = K; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(285, 23); ctx.lineTo(285, 18); ctx.moveTo(285, 23); ctx.lineTo(289, 24); ctx.stroke();
    text(Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), 318, 30, 17, 'center', K);
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
    let t, ph; if (left > 0) { t = String(Math.ceil(left / 1000)); ph = 1 - (left % 1000) / 1000; } else { t = seed != null || !opts.seed ? '시작!' : '연결 중…'; ph = 0.5; }
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

  fit();
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
