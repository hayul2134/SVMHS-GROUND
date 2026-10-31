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
const HAIRS = ['#2a2228', '#3b2a20', '#1f1f26', '#4a3324', '#26222e'];
const SKIN = '#f1c9a5', SKIN2 = '#e2ad86', HAIR = '#d4d6dc', HAIR2 = '#9fa3ad', SHIRT = '#eef2f8', VEST = '#7c5b3f', VEST2 = '#6a4c33', PANTS = '#5d5a66', WOOD = '#b9813f';

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
  const V = { t: 0, tx: 150, hx: 0, hy: -150, bub: '', bubT: 0, bubAngry: false, twitch: 0, board: { page: 0, line: 0, ch: 0, acc: 0, hold: 0 }, parts: [], pops: [], shake: 0, flash: 0 };

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
    ov.innerHTML = `<b>선생님 몰래 춤추기</b><span>선생님이 판서하는 동안 몰래 춤춰요</span>${best ? `<em class="sr-best dn-best">${opts.trophy || ''}내 최고 ${fmt(best)}점</em>` : ''}
      <ul class="dn-how"><li><i class="dn-i1"></i><b>누르고 있으면 춤</b> · 떼면 공부하는 척</li><li><i class="dn-i2"></i>“흠…” 하고 판서를 멈추면 곧 <b>돌아봐요</b> — 바로 멈추기!</li><li><i class="dn-i3"></i>보고 있을 때 춤추면 <b>벌점</b> · 3점이면 끝</li><li><i class="dn-i4"></i>쉬지 않고 출수록 점수 배율 ↑ · 가만히 있으면 <b>흥 게이지</b>가 차서 저절로 춤춰요</li></ul>
      <small>${touchSeen ? '화면을 눌러 시작' : keyTxt() + ' — 아무 키나 눌러 시작'}</small>`;
  };
  const showOver = res => {
    st.scene = 'over'; st.shownAt = performance.now();
    const nb = res.score > best && res.score > 0; if (nb) best = res.score;
    ov.hidden = false; ov.className = 'hr-ov dead dn-over';
    ov.innerHTML = `<b>교무실로 따라와.</b><div class="hr-card"><p class="hr-sc"><em>${fmt(res.score)}점</em>${nb ? '<i class="hr-nb">최고 기록!</i>' : ''}</p>
      <p class="dn-stat"><span>버틴 시간 <b>${Math.floor(res.f / D.FPS)}</b>초</span><span>세이프 <b>${res.safes}</b>번</span><span>최고 배율 <b>x${res.maxMult}</b></span>${res.bursts ? `<span>흥 폭발 <b>${res.bursts}</b>번</span>` : ''}</p>
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
  function resetFx() { V.parts = []; V.pops = []; V.shake = 0; V.flash = 0; V.bub = ''; V.bubT = 0; }
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
      case 'warn': V.bub = '흠…'; V.bubT = e.w / D.FPS + 0.1; V.bubAngry = false; V.twitch = 0.25; sfx.tap(); break;
      case 'feint': V.bub = ''; break;
      case 'turn': sfx.whoosh(); break;
      case 'look': V.bub = '…'; V.bubT = 0.8; V.bubAngry = false; break;
      case 'safe': pop(180, 470, '세이프! +' + e.b, '#7dffb0', 21); sfx.safe(); break;
      case 'caught': V.bub = CAUGHT_LINES[Math.floor(Math.random() * CAUGHT_LINES.length)]; V.bubT = D.CAUGHT_F / D.FPS; V.bubAngry = true; V.shake = 0.45; V.flash = 0.6; pop(180, 470, '벌점 +1', '#ff6b6b', 23); sfx.caught(); break;
      case 'turnback': if (s && s.lives > 0 && V.bubAngry === false && Math.random() < 0.4) { V.bub = '자, 다시 보자.'; V.bubT = 1; } break;
      case 'burst': pop(180, 470, '흥 폭발!!', '#ffd84a', 23); sfx.burst(); break;
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
      V.bubT = Math.max(0, V.bubT - ds); V.twitch = Math.max(0, V.twitch - ds);
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

  function drawRoom() {
    ctx.fillStyle = '#f4ecdc'; ctx.fillRect(0, 0, W, 300);
    ctx.fillStyle = '#a9cdb0'; ctx.fillRect(0, 236, W, 64); ctx.fillStyle = '#8fb898'; ctx.fillRect(0, 236, W, 4);
    const gr = ctx.createLinearGradient(0, 300, 0, H); gr.addColorStop(0, '#c99a63'); gr.addColorStop(1, '#a8784a'); ctx.fillStyle = gr; ctx.fillRect(0, 300, W, 340);
    ctx.strokeStyle = 'rgba(80,50,25,.25)'; ctx.lineWidth = 1.5; for (let y = 318; y < H; y += Math.max(14, (y - 290) * 0.18)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, 298, W, 5);
    // 전자칠판
    rr(16, 46, 328, 150, 12); fs('#3a404c', 3);
    const sg = ctx.createLinearGradient(0, 54, 0, 186); sg.addColorStop(0, '#1d3346'); sg.addColorStop(1, '#16283a'); rr(24, 54, 312, 134, 6); ctx.fillStyle = sg; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(24, 54); ctx.lineTo(130, 54); ctx.lineTo(70, 188); ctx.lineTo(24, 188); ctx.fill();
    ctx.fillStyle = '#2a3a4c'; ctx.fillRect(24, 54, 312, 13);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff6b6b', '#ffd84a', '#7dd3ff', '#fff', '#9dff8a'][i]; ctx.beginPath(); ctx.arc(34 + i * 12, 60.5, 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#8a94a3'; ctx.fillRect(292, 58, 36, 5);
    ctx.fillStyle = '#6ef0a0'; ctx.beginPath(); ctx.arc(180, 191.5, 1.8, 0, 7); ctx.fill();
    const b = V.board, L = PAGES[b.page % PAGES.length];
    for (let i = 0; i <= Math.min(b.line, L.length - 1); i++) {
      const str = i < b.line ? L[i] : L[i].slice(0, b.ch); ctx.font = boardFont(i); ctx.textAlign = 'left'; ctx.fillStyle = i === 0 ? '#ffd84a' : i === 3 ? '#ff9b9b' : '#f2f6ff'; ctx.fillText(str, LINE_X, LINE_Y[i]);
      if (i === 0 && b.line > 0) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LINE_X, LINE_Y[0] + 5); ctx.lineTo(LINE_X + ctx.measureText(L[0]).width, LINE_Y[0] + 5); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(125,211,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(262, 170); ctx.lineTo(326, 170); ctx.moveTo(294, 180); ctx.lineTo(294, 112); ctx.stroke();
    if (b.line >= 2) { ctx.strokeStyle = '#9dff8a'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -26; x <= 26; x += 2) { const y = 150 - ((x + 4) * (x + 4)) * 0.06; x === -26 ? ctx.moveTo(294 + x, y) : ctx.lineTo(294 + x, y); } ctx.stroke(); }
    // 교탁·시계
    rr(-10, 250, 74, 56, 6); fs('#b9875a', 2.6); ctx.fillStyle = '#a3754b'; ctx.fillRect(-8, 262, 70, 4);
    rr(-14, 244, 82, 10, 4); fs('#8f6340', 2.4);
    ell(326, 222, 13, 13); fs('#fff', 2.4); ctx.strokeStyle = K; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(326, 222); ctx.lineTo(326, 214); ctx.moveTo(326, 222); ctx.lineTo(332, 224); ctx.stroke();
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
    if (tst === 'turn') { const p = 1 - tm / D.TURN_F; if (p < 0.5) sx = 1 - 2 * p; else { face = 'front'; sx = 2 * p - 1; } }
    else if (tst === 'turnback') { const p = 1 - tm / D.TURN_F; if (p < 0.5) { face = 'front'; sx = 1 - 2 * p; } else sx = 2 * p - 1; }
    else if (tst === 'look' || tst === 'caught') face = 'front';
    return { face, sx: Math.max(0.06, sx), tst, tm, mood: tst === 'caught' ? 'angry' : tst === 'look' ? 'sus' : 'neutral' };
  }
  function drawTeacher() {
    const tv = teacherView();
    ctx.save(); ctx.translate(V.tx, 318);
    ell(0, 0, 34, 6); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
    ctx.scale(tv.sx, 1);
    if (tv.face === 'back') teacherBack(tv); else teacherFront(tv);
    ctx.restore();
    if (V.bubT > 0 && V.bub) bubble(V.tx + 8, tv.tst === 'caught' ? 110 : 122, V.bub, V.bubAngry && tv.tst === 'caught');
  }
  function teacherBack(tv) {
    const warn = tv.tst === 'warn', tw = V.twitch > 0 && !RM() ? Math.sin(V.twitch * 60) * 1.5 : 0;
    stick(-40, -22, -24, -120);
    limb(-25, -116, -31, -72, 10, SHIRT, -31, -94); ell(-31, -70, 5.5, 5.5); fs(SKIN, 2);
    lowerBody();
    rr(-28, -126, 56, 70, 14); fs(SHIRT);
    ctx.beginPath(); ctx.moveTo(-24, -122); ctx.lineTo(24, -122); ctx.lineTo(23, -62); ctx.quadraticCurveTo(0, -56, -23, -62); ctx.closePath(); fs(VEST);
    ctx.strokeStyle = VEST2; ctx.lineWidth = 1.2; for (let y = -112; y < -64; y += 7) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(20, y); ctx.stroke(); }
    // 판서하는 손(전자펜)
    let hx = V.hx, hy = V.hy; if (warn || tv.tst !== 'write') { hx = 30; hy = -88; }
    const sxp = 24, syp = -116, dx = hx - sxp, dy = hy - syp, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 78); hx = sxp + dx / d * m; hy = syp + dy / d * m;
    limb(sxp, syp, hx, hy, 10, SHIRT, sxp + dx / d * m * 0.5 + 10, syp + dy / d * m * 0.5 + 12); ell(hx, hy, 5.5, 5.5); fs(SKIN, 2);
    ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 3, hy - 9); ctx.stroke();
    // 뒤통수(경고 땐 고개가 살짝 돌아가 볼·안경다리가 보임)
    rr(-7, -134, 14, 12, 4); fs(SKIN, 2);
    const turn = warn ? clamp(1.35 - tv.tm / D.FPS / 0.5, 0.35, 1) : 0, o = tw;
    ell(-19 + o, -149, 4.5, 6.5); fs(SKIN, 2); ell(19 + o + turn * 3, -149, 4.5 + turn * 1.5, 6.5); fs(SKIN, 2);
    if (turn > 0) { ell(10 + o + turn * 4, -146, 12, 17); fs(SKIN, 2); ctx.strokeStyle = '#1d1d22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14 + turn * 3 + o, -151); ctx.lineTo(22 + turn * 3 + o, -151); ctx.stroke(); }
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

  // 학생들(뒷모습)
  const desk = () => { rr(-46, -82, 92, 10, 3); fs('#d8b07c', 2.2); ctx.fillStyle = '#b98d5a'; ctx.fillRect(-44, -73, 88, 3); };
  const chair = () => { rr(-30, -36, 60, 26, 6); fs('#5d7fa8', 2.4); ctx.strokeStyle = K; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-24, -10); ctx.lineTo(-24, 4); ctx.moveTo(24, -10); ctx.lineTo(24, 4); ctx.stroke(); };
  const torso = (dx, dy) => { rr(-25 + dx, -64 + dy, 50, 56, 15); fs('#2f3f63', 2.4); ctx.strokeStyle = '#22304e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(dx, -60 + dy); ctx.lineTo(dx, -14 + dy); ctx.stroke(); };
  function head(x, y, hc, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0); ell(-17, 0, 3.5, 5); fs(SKIN, 2); ell(17, 0, 3.5, 5); fs(SKIN, 2);
    ell(0, -2, 17, 18); fs(hc, 2.4); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-3, -6, 10, 3.6, 4.6); ctx.stroke(); ctx.restore();
  }
  function student(x, y, sc, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    const gg = o.giggle && !RM() ? Math.sin(V.t * 40) * 1.2 : 0; desk(); torso(gg, 0);
    if (o.sleep) { head(gg, -62, o.hc, 0); ctx.restore(); const a = (V.t * 0.8) % 1; ctx.globalAlpha = 1 - a; text('z', x + 12 * sc + a * 8, y - 80 * sc - a * 14, 11 + a * 4, 'center', '#6b6475'); ctx.globalAlpha = 1; return; }
    head(gg, -82, o.hc, o.look ? 0.15 : 0); chair(); ctx.restore();
    if (o.giggle) text('ㅋㅋ', x + 18 * sc, y - 100 * sc, 12, 'center', K);
  }
  function player() {
    const dancing = !!(s && s.dancing && st.scene === 'play'), m = s ? s.m2 / 2 : 1, lv = m >= 3.5 ? 4 : m >= 2.5 ? 3 : m >= 1.5 ? 2 : 1, b = V.t * Math.PI * 4;
    ctx.save(); ctx.translate(180, 604); ctx.scale(1.12, 1.12);
    desk();
    let dx = 0, dy = 0, tilt = 0, L, R;
    if (!dancing) { L = [-8, -78]; R = [12, -80]; tilt = -0.08; }
    else if (lv === 1) { dx = Math.sin(b) * 5; dy = -Math.abs(Math.sin(b)) * 3; tilt = Math.sin(b) * 0.12; L = [-34 + dx, -44 + Math.sin(b) * 6]; R = [34 + dx, -44 - Math.sin(b) * 6]; }
    else if (lv === 2) { dx = Math.sin(b) * 6; dy = -Math.abs(Math.sin(b)) * 5; tilt = Math.sin(b) * 0.15; L = [-30 + dx, -100 + Math.sin(b * 2) * 12]; R = [30 + dx, -100 - Math.sin(b * 2) * 12]; }
    else if (lv === 3) { const f = Math.sin(b) > 0; dx = f ? 5 : -5; dy = -Math.abs(Math.sin(b)) * 7; tilt = f ? 0.15 : -0.15; L = f ? [-46, -112] : [-38, -30]; R = f ? [38, -30] : [46, -112]; }
    else { dx = Math.sin(b * 1.5) * 7; dy = -Math.abs(Math.sin(b * 2)) * 9; tilt = Math.sin(b) * 0.22; const a = b * 1.5; L = [-28 + Math.cos(a) * 14, -110 + Math.sin(a) * 10]; R = [28 - Math.cos(a) * 14, -110 - Math.sin(a) * 10]; }
    const sl = [-22 + dx, -56 + dy], sr = [22 + dx, -56 + dy];
    torso(dx, dy);
    if (!dancing) { limb(sl[0], sl[1], L[0], L[1], 9, '#2f3f63', -26, -64); limb(sr[0], sr[1], R[0], R[1], 9, '#2f3f63', 26, -64); }
    head(dx, -80 + dy, '#2a2228', tilt);
    if (dancing) {
      limb(sl[0], sl[1], L[0], L[1], 9, '#2f3f63', (sl[0] + L[0]) / 2 - 8, (sl[1] + L[1]) / 2); ell(L[0], L[1], 5, 5); fs(SKIN, 2);
      limb(sr[0], sr[1], R[0], R[1], 9, '#2f3f63', (sr[0] + R[0]) / 2 + 8, (sr[1] + R[1]) / 2); ell(R[0], R[1], 5, 5); fs(SKIN, 2);
    }
    chair(); ctx.restore();
    const ay = 470 + (RM() ? 0 : Math.sin(V.t * 4) * 3) + (dancing ? -8 : 0);
    ctx.beginPath(); ctx.moveTo(172, ay); ctx.lineTo(188, ay); ctx.lineTo(180, ay + 9); ctx.closePath(); fs('#ffd84a', 2); text('나', 180, ay - 4, 12, 'center', K);
  }
  function drawHud() {
    const sc = s ? D.scoreOf(s) : 0, m = s ? s.m2 / 2 : 1, lives = s ? s.lives : D.LIVES;
    rr(8, 8, 120, 30, 10); fs('#fffdf7', 2.4); text(fmt(sc) + '점', 68, 29, 17, 'center', K);
    const mc = m >= 3.5 ? '#ff5fa2' : m >= 2.5 ? '#ffb020' : m >= 1.5 ? '#3b6cf6' : '#8a8496';
    rr(134, 8, 58, 30, 10); fs(mc, 2.4); text('x' + m, 163, 29, 17, 'center', '#fff');
    rr(222, 8, 130, 30, 10); fs('#fffdf7', 2.4); text('벌점', 248, 28, 14, 'center', K);
    for (let i = 0; i < D.LIVES; i++) { ell(282 + i * 22, 23, 8, 8); fs(i < D.LIVES - lives ? '#e0464e' : '#ece7f2', 2); }
    rr(40, 620, 300, 12, 6); fs('#fffdf7', 2.2);
    const hv = s ? (s.forced > 0 ? 1 : s.hype / D.HYPE_FULL) : 0;
    if (hv > 0) { rr(42, 622, Math.max(8, 296 * hv), 8, 4); ctx.fillStyle = hv > 0.75 && Math.floor(V.t * 8) % 2 ? '#ff5fa2' : '#ffb020'; ctx.fill(); }
    outlined('흥', 22, 632, 14, '#ffd84a');
    if (s && s.f < D.FPS * 6) { ctx.globalAlpha = Math.min(1, (D.FPS * 6 - s.f) / D.FPS); outlined(touchSeen ? '화면을 꾹 누르면 춤!' : '꾹 누르면 춤!', 180, 612, 16, '#fff'); ctx.globalAlpha = 1; }
  }
  function drawCount() {
    const total = st.scene === 'resume' ? 1000 : 3000, left = total - countT;
    let t, ph; if (left > 0) { t = String(Math.ceil(left / 1000)); ph = 1 - (left % 1000) / 1000; } else { t = seed != null || !opts.seed ? '시작!' : '연결 중…'; ph = 0.5; }
    const sz = (t.length > 2 ? 40 : 84) * (ph < 0.15 ? 0.6 + ph * 3 : 1);
    ctx.fillStyle = 'rgba(42,40,70,.25)'; ctx.fillRect(0, 0, W, H);
    outlined(t, W / 2, 360, sz, '#fff');
  }
  function draw() {
    if (!cv.width) return;
    const sc = k * dpr; ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.save();
    if (V.shake > 0 && !RM()) ctx.translate((Math.random() - 0.5) * 10 * V.shake / 0.45, (Math.random() - 0.5) * 10 * V.shake / 0.45);
    drawRoom(); drawTeacher();
    const gg = !!(s && s.dancing && s.m2 >= 5 && st.scene === 'play');
    student(62, 400, 0.6, { hc: HAIRS[0] }); student(140, 400, 0.6, { hc: HAIRS[1], sleep: true }); student(220, 400, 0.6, { hc: HAIRS[2] }); student(298, 400, 0.6, { hc: HAIRS[3] });
    student(78, 486, 0.82, { hc: HAIRS[4], giggle: gg }); student(282, 486, 0.82, { hc: HAIRS[1], giggle: gg, look: gg });
    student(22, 604, 1.12, { hc: HAIRS[2] }); student(338, 604, 1.12, { hc: HAIRS[0], giggle: gg });
    player();
    for (const q of V.parts) { ctx.globalAlpha = Math.min(1, q.life * 1.5); if (q.kind === 'note') text('♪', q.x, q.y, 16, 'center', q.c); else { ctx.fillStyle = q.c; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r + q.life * 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore(); } }
    ctx.globalAlpha = 1;
    for (const q of V.pops) { ctx.globalAlpha = Math.min(1, q.life * 2); outlined(q.t, q.x, q.y, q.size, q.c); } ctx.globalAlpha = 1;
    ctx.restore();
    if (V.flash > 0) { const gr = ctx.createRadialGradient(180, 320, 120, 180, 320, 380); gr.addColorStop(0, 'rgba(255,40,40,0)'); gr.addColorStop(1, `rgba(255,40,40,${V.flash * 0.7})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
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
    safe() { tone(880, 0.1, 'sine', 0.07, 1320); tone(1320, 0.12, 'sine', 0.05, 0, 0.08); },
    caught() { tone(220, 0.4, 'sawtooth', 0.08, 90); },
    burst() { tone(520, 0.2, 'square', 0.05, 1040); },
    mult(m2) { tone(500 + m2 * 60, 0.09, 'square', 0.045, 800 + m2 * 80); },
    beat(dancing, t, m2) {   // 춤추는 동안 작은 쿵짝(배율 오르면 빨라짐)
      if (!on || !dancing) { nextBeat = 0; return; }
      const a = ctx(); if (!a) return;
      const gap = 0.5 - Math.min(0.2, (m2 - 2) * 0.035);
      if (!nextBeat || a.currentTime >= nextBeat) { tone(90, 0.12, 'sine', 0.09, 50); tone(1800, 0.03, 'square', 0.015, 0, gap / 2); nextBeat = a.currentTime + gap; }
    },
  };
}
