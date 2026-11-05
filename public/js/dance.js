// SVMHS GROUND — 선생님 몰래 춤추기 화면 (2026-10-31 하율: "선생님은 전자칠판 앞에서 수업, 나무 막대기를 한 손에, 네모난 안경, 머리숱 많은 60대 남자 선생님 → 2026-11-02 사회 선생님·약간 곱슬", 미리보기 깃발 dance-game)
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

// 칠판 내용(그림만) — 사회 시간(2026-11-02 하율 "사회 선생님으로", 전엔 수학). 오른쪽 그래프 자리를 피해 줄당 14자 안팎
const PAGES = [
  ['수요와 공급', '가격↑ → 수요량↓', '가격↑ → 공급량↑', '만나는 점 = 균형 가격'],
  ['인권의 의미', '모든 사람의 기본 권리', '천부성·보편성·불가침성', '시험에 꼭 나온다!!'],
  ['민주 정치의 원리', '국민 주권 · 입헌주의', '입법·행정·사법 분립', '삼권 분립 꼭 외우기'],
  ['기후와 생활', '열대 : 고상 가옥', '건조 : 흙벽돌집', '한대 : 이글루']];
const CAUGHT_LINES = ['거기 너!! 뭐 하냐!', '지금 춤추냐?!', '앞으로 나와!', '수업 시간에 무슨 짓이야!'];
const SLEEP_LINES = ['거기 자는 학생!!', '수업 시간에 졸아?!', '일어나! 뒤로 나가!'];

export function createDance(root, opts = {}) {
  root.innerHTML = `<div class="dn-scr" tabindex="-1"><canvas aria-label="선생님 몰래 춤추기 게임 화면"></canvas><div class="hr-ov dn-ov" hidden></div></div>
    <div class="hr-bar dn-bar"><p class="hr-keys dn-keys"><span class="hk"><span data-ka="dance"></span> 누르고 있으면 춤 · 떼면 공부하는 척</span></p><button type="button" class="btn ghost hr-snd dn-snd" aria-pressed="false"></button></div>`;
  const scr = root.querySelector('.dn-scr'), cv = scr.querySelector('canvas'), ov = scr.querySelector('.dn-ov'), sndBtn = root.querySelector('.dn-snd');
  let ctx = cv.getContext('2d', { alpha: false });   // 교실 배경 캐시를 그릴 땐 잠깐 다른 캔버스로 바뀜(bgArt)
  const sfx = makeSfx(); sfx.set(!!opts.sound);
  let best = opts.best || 0, dpr = 1, k = 1, alive = true, raf = 0;
  const st = { scene: 'ready', shownAt: 0 };
  let s = null, seed = null, saved = false, evs = [], held = 0, acc = 0, last = 0, countT = 0, endT = 0, pauseFrom = '', tStart = 0, msgNow = null, lastRes = null, evRun = 0;
  // 그림만 쓰는 값
  const V = { cx: 60, cy: 80, walk: 0, headX: 180, headY: 120, t: 0, whip: 0, alert: 0, wflash: 0, stamp: 0, stampT: '', pv: 0, tx: 150, hx: 0, hy: -150, bub: '', bubT: 0, bubAngry: false, twitch: 0, board: { page: 0, line: 0, ch: 0, acc: 0, hold: 0 }, parts: [], pops: [], shake: 0, flash: 0 };

  /* --- 크기: 논리 360×640을 화면 픽셀에 맞춰 선명하게 --- */
  const fit = () => {
    const w = cv.clientWidth; if (!w) return;
    dpr = Math.min(3, window.SG_DPR || devicePixelRatio || 1); k = w / W;
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
    const nb = res.score > best && res.score > 0 && (res.saved || !opts.savedOnly?.()); if (nb) best = res.score;   // 로그인 중 저장 안 된 판은 '내 최고'에 안 넣음(2026-11-05 — 화면엔 1,288점인데 기록은 906점이던 일)
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
    if (!pre || (pre.done && (pre.v == null || performance.now() - pre.at > 40 * 60e3))) prefetch();   // 못 받은 티켓은 판 시작 때 다시 받기(2026-11-05 — 예전엔 그대로 연습 판)
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
  const part = (x, y, kind, c) => { if (V.parts.length > 90 || RM()) return; const heavy = kind === 'book' || kind === 'pencil';
    V.parts.push({ x, y, vx: (Math.random() - 0.5) * (heavy ? 150 : 110), vy: heavy ? -150 - Math.random() * 90 : -70 - Math.random() * 70, g: kind === 'note' ? 20 : kind === 'paper' ? 70 : 330, life: kind === 'note' ? 1.1 : 1.4, kind, c, rot: Math.random() * 6, vr: (Math.random() - 0.5) * (heavy ? 14 : 6) }); };
  const SHOUT = ['예~!', '파티다!', '흔들어!', '와아아!', '둠칫!', '가즈아!', '소리 질러!', '오예!'];
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
  function writeStep(dt) {   // 판서 진행 + 선생님이 글씨 끝 왼쪽에 서서 오른손을 고무줄처럼 뻗어 씀
    boardStep(dt); const c = cursorPos(); V.cx = c.x; V.cy = c.y;
    const target = clamp(c.x - 34, 64, 296), mv = clamp(target - V.tx, -60 * dt, 60 * dt); V.tx += mv; V.walk = Math.abs(target - V.tx) > 1.5 ? 1 : 0;
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
      if (s.dancing) {   // 2026-11-02 하율 "반짝 거리는 느낌 없이 · 광란의 파티처럼 난리나게": 책상 위 공책·책·연필이 날아다니고 친구들이 소리 지름
        if (Math.random() < ds * (3 + s.m2 * 1.5)) { const i = Math.floor(Math.random() * 8), [sx0, sy0, sc0] = SEATS[i], r = Math.random();
          part(sx0 + (Math.random() - 0.5) * 50 * sc0, sy0 - 86 * sc0, r < 0.4 ? 'paper' : r < 0.6 ? 'book' : r < 0.8 ? 'pencil' : 'note', ['#6fc6f4', '#ff8f8f', '#8fe8cf', '#ffe08a', '#a9c4ff'][Math.floor(Math.random() * 5)]); }
        if (!RM() && Math.random() < ds * (0.6 + s.m2 * 0.25) && V.pops.length < 4) { const i = Math.floor(Math.random() * 8), [sx0, sy0, sc0] = SEATS[i]; if (!V.pops.some(q => Math.abs(q.x - clamp(sx0, 40, 320)) < 70 && Math.abs(q.y - (sy0 - 175 * sc0)) < 60)) pop(clamp(sx0, 40, 320), sy0 - 175 * sc0, SHOUT[Math.floor(Math.random() * SHOUT.length)], ['#ffe08a', '#ffffff', '#8fe8cf', '#ffb3c7'][i % 4], 15 + sc0 * 5); }
      }
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
      for (let i = V.parts.length - 1; i >= 0; i--) { const q = V.parts[i]; q.x += q.vx * ds; q.y += q.vy * ds; q.vy += q.g * ds; q.rot += q.vr * ds; if (q.kind === 'paper') q.vx *= 1 - ds * 1.5; q.life -= ds; if (q.life <= 0) V.parts.splice(i, 1); }
      for (let i = V.pops.length - 1; i >= 0; i--) { const q = V.pops[i]; q.y -= 28 * ds; q.life -= ds; if (q.life <= 0) V.pops.splice(i, 1); }
      V.shake = Math.max(0, V.shake - ds); V.flash = Math.max(0, V.flash - ds);
    }
    draw();
  }

  /* ===== 그리기: 고무호스 만화 2D — 2026-11-01 14:21 하율 "2D로 — 학생들이 춤출 때 더 격렬하고 빠르고 난리나게" (고무호스 스타일 선택) =====
     팔다리 = 휘는 고무줄(곡선 하나), 장갑 낀 큰 손·큰 신발, 몸은 콩 모양으로 찌그러졌다 늘어남(스쿼시·스트레치), 빠른 동작엔 잔상·속도선.
     굵은 잉크 선 + 단색 + 그림자 한 단. 교실 배경은 한 장으로 캐시. 글자·말풍선·점수 칩은 사이트 스티커 UI. */
  const LW = 3;   // 잉크 선 굵기
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f).toString(16).padStart(2, '0')).join(''); };
  const ink = (lw = LW) => { ctx.lineWidth = lw; ctx.strokeStyle = K; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); };
  const fillInk = (c, lw = LW) => { ctx.fillStyle = c; ctx.fill(); ink(lw); };
  const ell = (x, y, rx, ry, r = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), r, 0, Math.PI * 2); };
  // 고무호스 팔다리: 시작→끝을 한 번 휘는 곡선(bend = 휘는 정도, + 면 오른쪽으로)
  function hose(x1, y1, x2, y2, w, c, bend = 0) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, cx = mx - dy / d * bend, cy = my + dx / d * bend;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.lineWidth = w + LW * 2; ctx.strokeStyle = K; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + 1.5, y1 + 1); ctx.quadraticCurveTo(cx + 2, cy + 1.5, x2 + 1.5, y2 + 1); ctx.lineWidth = w * 0.3; ctx.strokeStyle = shade(c, -0.18); ctx.stroke();   // 안쪽 그늘
    return { cx, cy };
  }
  // 하얀 장갑(손가락 셋 + 엄지, 손목 띠)
  function glove(x, y, r, ang = 0, open = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    for (let i = -1; i <= 1; i++) { ell(i * r * 0.42, -r * 0.75 * open, r * 0.3, r * 0.5); fillInk('#ffffff', LW * 0.75); }
    ell(-r * 0.85, -r * 0.1, r * 0.3, r * 0.45, -0.6); fillInk('#ffffff', LW * 0.75);
    ell(0, 0, r * 0.85, r * 0.75); fillInk('#ffffff', LW * 0.8);
    ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.55); ctx.quadraticCurveTo(0, r * 0.9, r * 0.7, r * 0.55); ink(LW * 0.7);
    ctx.restore();
  }
  function shoeH(x, y, r, c = '#2f2a33', dir = 1) { ell(x + dir * r * 0.2, y - r * 0.35, r * 1.15, r * 0.62); fillInk(c, LW * 0.85); ell(x - dir * r * 0.25, y - r * 0.6, r * 0.35, r * 0.16); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill(); }
  // 콩 모양 몸통: 가운데(cx), 위(top)·아래(bot), 반폭(w) — 아래가 조금 더 넓은 물방울
  function bean(cx, top, bot, w, c, lean = 0) {
    const h = bot - top;
    ctx.beginPath(); ctx.moveTo(cx + lean, top);
    ctx.bezierCurveTo(cx + lean + w * 0.95, top, cx + w * 1.12, top + h * 0.55, cx + w * 0.95, bot - h * 0.08);
    ctx.quadraticCurveTo(cx, bot + h * 0.08, cx - w * 0.95, bot - h * 0.08);
    ctx.bezierCurveTo(cx - w * 1.12, top + h * 0.55, cx + lean - w * 0.95, top, cx + lean, top); ctx.closePath();
  }

  /* --- 교실 배경(한 장 캐시) --- */
  let bgC = null, bgS = 0, fontWait = false;
  function bgArt() {
    const sc = k * dpr; if (bgC && bgS === sc) return bgC;
    const c = document.createElement('canvas'); c.width = Math.ceil(W * sc); c.height = Math.ceil(H * sc);
    const keep = ctx; ctx = c.getContext('2d'); ctx.scale(sc, sc);
    let g = ctx.createLinearGradient(0, 0, 0, 236); g.addColorStop(0, '#f2f9ff'); g.addColorStop(1, '#ddeefa'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
    ctx.fillStyle = 'rgba(56,165,234,.06)'; for (let x = 0; x < W; x += 30) ctx.fillRect(x, 0, 15, 236);
    ctx.fillStyle = '#b3d8f1'; ctx.fillRect(0, 236, W, 64); ctx.fillStyle = '#8cc3e8'; ctx.fillRect(0, 236, W, 6);
    ctx.beginPath(); ctx.moveTo(0, 239); ctx.lineTo(W, 239); ink(2.5);
    for (let x = 8; x < W; x += 50) { rr(x, 250, 40, 40, 6); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(23,48,72,.22)'; ctx.stroke(); }
    // 바닥(원근 판자)
    g = ctx.createLinearGradient(0, 300, 0, H); g.addColorStop(0, '#e2b27a'); g.addColorStop(1, '#c98f55'); ctx.fillStyle = g; ctx.fillRect(0, 300, W, H - 300);
    ctx.strokeStyle = 'rgba(120,70,30,.28)'; ctx.lineWidth = 1.6;
    for (let i = -12; i <= 24; i++) { const x0 = 180 + i * 24, t = (H - 150) / (300 - 150); ctx.beginPath(); ctx.moveTo(x0, 300); ctx.lineTo(180 + (x0 - 180) * t, H); ctx.stroke(); }
    for (let y = 316, n = 0; y < H; y += 12 + n * 3, n++) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.strokeStyle = 'rgba(120,70,30,.14)'; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(W, 300); ink(3);
    // 전자칠판
    rr(16, 44, 328, 154, 16); fillInk('#2a3f56', 3.5);
    g = ctx.createLinearGradient(0, 54, 0, 186); g.addColorStop(0, '#1f3b58'); g.addColorStop(1, '#152b42'); rr(25, 53, 310, 136, 9); ctx.fillStyle = g; ctx.fill(); ink(2);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(25, 53); ctx.lineTo(120, 53); ctx.lineTo(66, 189); ctx.lineTo(25, 189); ctx.fill();
    ['#ff8f8f', '#ffe08a', '#6fc6f4', '#ffffff', '#8fe8cf'].forEach((cc, i) => { ell(36 + i * 11, 62, 3.2, 3.2); ctx.fillStyle = cc; ctx.fill(); });
    rr(120, 196, 120, 9, 4); fillInk('#4b5a70', 2.5); rr(140, 193, 22, 5, 2.5); fillInk('#ff8f8f', 2); rr(170, 193, 18, 5, 2.5); fillInk('#6fc6f4', 2);
    // 교탁(살짝 기울어진 만화풍) · 책 · 머그
    ctx.beginPath(); ctx.moveTo(-6, 252); ctx.lineTo(70, 248); ctx.lineTo(66, 312); ctx.lineTo(-6, 314); ctx.closePath(); fillInk('#c98f55', 3);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, 258, 62, 4);
    ctx.beginPath(); ctx.moveTo(-10, 244); ctx.lineTo(76, 240); ctx.lineTo(74, 252); ctx.lineTo(-10, 255); ctx.closePath(); fillInk('#a56f3d', 3);
    rr(6, 232, 32, 8, 3); fillInk('#6fc6f4', 2.2); rr(9, 224, 28, 8, 3); fillInk('#ff8f8f', 2.2);
    ctx.beginPath(); ctx.moveTo(48, 226); ctx.lineTo(60, 226); ctx.lineTo(59, 240); ctx.lineTo(49, 240); ctx.closePath(); fillInk('#ffffff', 2.2); ctx.beginPath(); ctx.arc(61, 232, 4, -1.2, 1.2); ink(2.2);
    // 시계 · 급훈
    ell(332, 222, 16, 16); fillInk('#ffffff', 3); ctx.beginPath(); ctx.moveTo(332, 222); ctx.lineTo(332, 212); ctx.moveTo(332, 222); ctx.lineTo(339, 225); ink(2.5);
    rr(220, 207, 92, 24, 8); fillInk('#ffffff', 2.5); ctx.fillStyle = K; ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('급훈 · 정직과 성실', 266, 223, 80);
    // 글꼴(Jua)이 아직 안 받아진 채 그려졌으면, 받아진 뒤 배경을 한 번 다시 그림(대체 글꼴로 굳어 글자 깨짐 방지)
    if (!fontWait && document.fonts && !document.fonts.check(`11px "Jua"`)) { fontWait = true; document.fonts.load(`11px "Jua"`).then(() => { bgS = 0; }, () => {}); }
    ctx = keep; bgC = c; bgS = sc; return c;
  }
  const LINE_Y = [86, 112, 138, 162], LINE_X = 42;
  const boardFont = i => i === 0 ? `18px ${FONT}` : `15px ${FONT}`;
  function boardInk() {
    const b = V.board, L = PAGES[b.page % PAGES.length];
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (let i = 0; i <= Math.min(b.line, L.length - 1); i++) {
      const str = i < b.line ? L[i] : L[i].slice(0, b.ch); ctx.font = boardFont(i); ctx.fillStyle = i === 0 ? '#ffe08a' : i === 3 ? '#ff9b9b' : '#f2f6ff'; ctx.fillText(str, LINE_X, LINE_Y[i]);
      if (i === 0 && b.line > 0) { ctx.fillStyle = '#ffe08a'; ctx.fillRect(LINE_X, LINE_Y[0] + 5, ctx.measureText(L[0]).width, 2); }
    }
    ctx.strokeStyle = 'rgba(125,211,255,.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(262, 172); ctx.lineTo(326, 172); ctx.moveTo(294, 182); ctx.lineTo(294, 116); ctx.stroke();
    // 수요·공급 곡선(사회): 수요 ↘ 하늘색, 공급 ↗ 분홍, 만나는 점
    if (b.line >= 1) { ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(268, 124); ctx.quadraticCurveTo(288, 152, 322, 166); ctx.stroke(); }
    if (b.line >= 2) { ctx.strokeStyle = '#ff9bb0'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(268, 166); ctx.quadraticCurveTo(300, 150, 322, 122); ctx.stroke(); }
    if (b.line >= 3) { ell(294, 151, 3.2, 3.2); ctx.fillStyle = '#ffe08a'; ctx.fill(); }
  }
  function cursorPos() { const b = V.board, L = PAGES[b.page % PAGES.length], li = Math.min(b.line, L.length - 1); ctx.font = boardFont(li); return { x: LINE_X + ctx.measureText(L[li].slice(0, b.ch)).width, y: LINE_Y[li] - 6 }; }

  /* --- 선생님(고무호스): 60대, 숱 많은 은발, 네모 안경, 니트 조끼·넥타이, 나무 막대기 --- */
  const TS = 1.0, TF = 334;   // 크기 · 발 높이
  function teacherHair(x, y, r, back, turn = 0) {
    // 반곱슬 은발(2026-11-02 하율 "동글동글 말고 아예 모양을 바꿔"): 동그란 덩어리 대신 한 덩어리 머리 + 낮은 물결 윤곽 + 길게 흐르는 S자 결
    ctx.save(); ctx.translate(x - turn * r * 0.15, y);
    const wav = (a, rx, ry, cy, amp = 0.045, n = 9) => { const q = 1 + amp * Math.sin(a * n); return [Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]; };
    ctx.beginPath();
    if (back) {   // 뒤통수 전체를 덮고 목덜미에서 물결치며 끝남
      for (let a = Math.PI * 0.82; a <= Math.PI * 2.18; a += 0.05) { const [px, py] = wav(a, r * 1.1, r * 1.02, -r * 0.12); a <= Math.PI * 0.83 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.quadraticCurveTo(r * 0.55, r * 0.95, r * 0.15, r * 0.78); ctx.quadraticCurveTo(-r * 0.2, r * 0.98, -r * 0.6, r * 0.82); ctx.closePath();
    } else {   // 정수리·옆머리, 이마 위 가르마와 살짝 내려온 앞머리 물결
      for (let a = Math.PI * 0.94; a <= Math.PI * 2.06; a += 0.05) { const [px, py] = wav(a, r * 1.12, r * 0.98, -r * 0.08); a <= Math.PI * 0.95 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.quadraticCurveTo(r * 0.98, r * 0.3, r * 0.82, r * 0.05);
      ctx.quadraticCurveTo(r * 0.78, -r * 0.42, r * 0.3, -r * 0.5); ctx.quadraticCurveTo(r * 0.05, -r * 0.38, -r * 0.2, -r * 0.55);
      ctx.quadraticCurveTo(-r * 0.62, -r * 0.62, -r * 0.8, -r * 0.3); ctx.quadraticCurveTo(-r * 0.9, r * 0.05, -r * 0.85, r * 0.25); ctx.closePath();
    }
    ctx.fillStyle = '#e3e6ec'; ctx.fill(); ctx.lineWidth = LW * 1.6; ctx.strokeStyle = K; ctx.lineJoin = 'round'; ctx.stroke();
    // 그늘(아래쪽) · 결(S자) · 윤기
    ctx.save(); ctx.clip(); ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.ellipse(r * 0.25, back ? r * 0.55 : r * 0.1, r * 1.1, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#a9afbc'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    const strands = back ? [[-0.6, -0.75, -0.7, 0.55], [-0.15, -0.95, -0.2, 0.7], [0.3, -0.9, 0.35, 0.65], [0.7, -0.6, 0.75, 0.45]] : [[-0.55, -0.85, -0.85, -0.05], [0.1, -1.0, -0.15, -0.55], [0.55, -0.85, 0.85, -0.05]];
    for (const [x0, y0, x1, y1] of strands) { const mx = (x0 + x1) / 2 * r, my = (y0 + y1) / 2 * r; ctx.beginPath(); ctx.moveTo(x0 * r, y0 * r); ctx.quadraticCurveTo(mx + r * 0.16, (y0 * r + my) / 2, mx, my); ctx.quadraticCurveTo(mx - r * 0.16, (my + y1 * r) / 2, x1 * r, y1 * r); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.2, r * 0.75, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();
    ctx.restore();
  }
  function drawTeacher() {
    const tst = s ? s.st : 'idle', tm = s ? s.tm : 99, dur = s ? s.dur : 99;
    let face = 'back', sx = 1;
    if (tst === 'turn') { const p = 1 - tm / (s.tf || D.TURN_F); if (p < 0.5) sx = 1 - 2 * p; else { face = 'front'; sx = 2 * p - 1; } }
    else if (tst === 'turnback') { const p = 1 - tm / D.TURN_F; if (p < 0.5) { face = 'front'; sx = 1 - 2 * p; } else sx = 2 * p - 1; }
    else if (tst === 'look' || tst === 'caught') face = 'front';
    sx = Math.max(0.08, sx);
    const ang = tst === 'caught', sus = tst === 'look', t = V.t, x = V.tx;
    const walk = V.walk || 0, bob = Math.abs(Math.sin(t * 9)) * 3 * walk, shake = ang && !RM() ? Math.sin(t * 45) * 2 : 0;
    ctx.save(); ctx.translate(x + shake, TF); ctx.scale(sx * TS, TS);
    ell(0, 0, 40, 7); ctx.fillStyle = 'rgba(23,48,72,.2)'; ctx.fill();
    // 다리(바지) · 신발
    const st2 = walk ? Math.sin(t * 9) * 8 : 0;
    hose(-11, -64 - bob, -14 + st2, -6, 15, '#5d5a66', face === 'back' ? 3 : -3); hose(11, -64 - bob, 14 - st2, -6, 15, '#5d5a66', face === 'back' ? -3 : 3);
    shoeH(-15 + st2, 0, 11, '#5a3a26', -1); shoeH(15 - st2, 0, 11, '#5a3a26', 1);
    const top = -150 - bob, bot = -58 - bob;
    // 셔츠(어깨·소매) → 조끼(골지) → 넥타이
    bean(0, top, bot, 32, '#f3f5fa'); fillInk('#f3f5fa');
    ctx.save(); bean(0, top + 8, bot, 30, '#7a5236'); ctx.clip();
    ctx.fillStyle = '#7a5236'; ctx.fillRect(-40, top, 80, bot - top + 10); ctx.strokeStyle = '#664329'; ctx.lineWidth = 1.4; for (let i = -28; i < 30; i += 5) { ctx.beginPath(); ctx.moveTo(i, top); ctx.lineTo(i, bot + 6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(12, top, 30, bot - top + 10);
    if (face === 'front') { ctx.fillStyle = '#f3f5fa'; ctx.beginPath(); ctx.moveTo(-12, top + 6); ctx.lineTo(0, top + 40); ctx.lineTo(12, top + 6); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    bean(0, top + 8, bot, 30, '#7a5236'); ink(LW);
    ctx.beginPath(); ctx.moveTo(-26, bot - 10); ctx.quadraticCurveTo(0, bot - 4, 26, bot - 10); ctx.strokeStyle = '#5e3e25'; ctx.lineWidth = 4; ctx.stroke();
    if (face === 'front') { ctx.beginPath(); ctx.moveTo(-12, top + 6); ctx.lineTo(0, top + 40); ctx.lineTo(12, top + 6); ink(2.5);
      ctx.beginPath(); ctx.moveTo(-5, top + 8); ctx.lineTo(5, top + 8); ctx.lineTo(7, top + 40); ctx.lineTo(0, top + 48); ctx.lineTo(-7, top + 40); ctx.closePath(); fillInk('#c2364a', 2.2);
      ctx.strokeStyle = '#ffd25e'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-5, top + 18 + i * 9); ctx.lineTo(5, top + 23 + i * 9); ctx.stroke(); } }
    // 팔: 뒤 = 오른손(화면 오른쪽) 칠판에 판서 · 왼손 막대기 / 앞 = 표정에 따라
    const shL = [-28, top + 16], shR = [28, top + 16];
    const stick = (hx, hy, a, len = 120) => { ctx.beginPath(); ctx.moveTo(hx - Math.cos(a) * 14, hy - Math.sin(a) * 14); ctx.lineTo(hx + Math.cos(a) * len, hy + Math.sin(a) * len); ctx.lineWidth = 9; ctx.strokeStyle = K; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#c98f45'; ctx.stroke(); ell(hx + Math.cos(a) * len, hy + Math.sin(a) * len, 4, 4); fillInk('#6a4520', 2); };
    if (face === 'back') {
      // 판서 손: 칠판 커서까지 고무줄처럼 쭉(멈추면 살짝 떼고, 흠·곁눈질이면 내림)
      let hx, hy;
      if (tst === 'idle' || tst === 'write') { hx = (V.cx - x) / TS + Math.sin(t * 22) * 1.5; hy = (V.cy - TF) / TS + Math.cos(t * 19) * 1; }
      else if (tst === 'pause') { hx = (V.cx - x) / TS + 6; hy = (V.cy - TF) / TS + 10; }
      else { hx = 34; hy = -64 - bob; }
      // 커서가 몸 가운데보다 왼쪽이면 왼손으로 판서·막대기는 오른손(팔이 목을 가로지르지 않게, 2026-11-02 하율)
      const lw = hx < 4, sh = lw ? shL : shR, sd = lw ? 1 : -1;
      if (lw) { stick(34, -62 - bob, Math.PI - 1.9, 70); hose(shR[0], shR[1], 34, -64 - bob, 12, '#f3f5fa', -6); glove(34, -62 - bob, 9, Math.PI); }
      else { stick(-34, -62 - bob, 1.9, 70); hose(shL[0], shL[1], -34, -64 - bob, 12, '#f3f5fa', 6); glove(-34, -62 - bob, 9, Math.PI); }
      hose(sh[0], sh[1], hx, hy, 12, '#f3f5fa', 10 * sd); glove(hx, hy, 9, Math.atan2(hy - sh[1], hx - sh[0]) - Math.PI / 2);
      if (tst === 'write' || tst === 'idle') { ctx.beginPath(); ctx.moveTo(hx, hy - 4); ctx.lineTo(hx - 4, hy - 16); ctx.lineWidth = 4; ctx.strokeStyle = K; ctx.stroke(); }
    } else if (ang) {
      const w = RM() ? 0 : Math.sin(t * 28) * 0.15;
      hose(shL[0], shL[1], -58, top + 40, 12, '#f3f5fa', -10); glove(-58, top + 40, 10, -1.4, 1.2);   // 손가락질
      ctx.beginPath(); ctx.moveTo(-64, top + 38); ctx.lineTo(-80, top + 34); ctx.lineWidth = 11; ctx.strokeStyle = K; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
      stick(46, top - 16, -1.15 + w, 110); hose(shR[0], shR[1], 46, top - 16, 12, '#f3f5fa', 8); glove(46, top - 16, 10, 0.4);
    } else {
      stick(36, -66 - bob, -1.45, 110); hose(shL[0], shL[1], -34, -64 - bob, 12, '#f3f5fa', -5); glove(-34, -62 - bob, 9, 0);
      hose(shR[0], shR[1], 36, -66 - bob, 12, '#f3f5fa', 5); glove(36, -64 - bob, 9, 0);
    }
    // 머리
    const hx = 0, hy = top - 26, r = 25;
    ctx.beginPath(); ctx.rect(-7, top - 10, 14, 14); fillInk(SKIN0, 2.5);
    if (face === 'back') {
      const turn = tst === 'peek' ? clamp((dur - tm) / D.PEEK_IN, 0, 1) : tst === 'warn' ? clamp(0.3 + (dur - tm) / 40, 0.3, 0.7) : 0;
      const tw = V.twitch > 0 && !RM() ? Math.sin(V.twitch * 60) * 1.5 : 0;
      ctx.save(); ctx.translate(tw, 0);
      ell(hx + r * 0.95, hy + 4, 6, 9); fillInk(SKIN0, 2.5); ell(hx - r * 0.95, hy + 4, 6, 9); fillInk(SKIN0, 2.5);
      if (turn > 0) {   // 고개 돌림: 볼·안경 옆·눈 하나가 보임
        ell(hx + r * (0.35 + turn * 0.35), hy + 4, r * 0.75, r * 0.95); fillInk(SKIN0);
        ctx.beginPath(); ctx.moveTo(hx + r * (0.3 + turn * 0.4), hy - 2); ctx.lineTo(hx + r * (1.05 + turn * 0.25), hy - 4); ink(3);
        if (turn > 0.5) { rr(hx + r * (0.65 + turn * 0.25), hy - 10, 14, 12, 2); ctx.fillStyle = 'rgba(200,235,255,.6)'; ctx.fill(); ink(3); ell(hx + r * (0.8 + turn * 0.25), hy - 4, 2.2, 3); ctx.fillStyle = K; ctx.fill(); }
      }
      teacherHair(hx, hy, r, true, turn);
      ctx.restore();
    } else {
      ell(hx - r * 0.95, hy + 4, 6, 9); fillInk(SKIN0, 2.5); ell(hx + r * 0.95, hy + 4, 6, 9); fillInk(SKIN0, 2.5);
      ell(hx, hy + 3, r * 0.92, r * 1.02); fillInk(ang ? '#f6b29b' : SKIN0);
      teacherHair(hx, hy - 10, r * 0.95, false);
      // 덥수룩한 눈썹 · 네모 안경 · 눈 · 코 · 입 · 팔자 주름
      const browY = ang ? -4 : sus ? -7 : -8;
      for (const d of [-1, 1]) { ctx.beginPath(); const a = ang ? 0.35 : sus && d > 0 ? -0.2 : 0; ctx.moveTo(hx + d * 4, hy + browY - a * d * 4); ctx.lineTo(hx + d * 17, hy + browY - 3 + a * d * 4 * -1); ctx.lineWidth = 6; ctx.strokeStyle = '#9ba0ab'; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = K; ctx.stroke(); }
      const ex = sus && !RM() ? Math.sin(t * 3.4) * 2.5 : 0;
      for (const d of [-1, 1]) { rr(hx + d * 11 - 8, hy - 3, 16, 12, 2.5); ctx.fillStyle = 'rgba(200,235,255,.55)'; ctx.fill(); ink(3.2);
        if (sus) { ctx.fillStyle = K; ctx.fillRect(hx + d * 11 - 4 + ex, hy + 2, 8, 2.5); } else { ell(hx + d * 11 + ex, hy + 3, ang ? 2 : 2.4, ang ? 2 : 3); ctx.fillStyle = K; ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx + d * 11 - 5, hy + 7); ctx.lineTo(hx + d * 11 - 1, hy); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(hx - 3, hy + 3); ctx.lineTo(hx + 3, hy + 3); ink(3);
      ell(hx, hy + 13, 5, 4); fillInk(shade(SKIN0, -0.08), 2.2);
      ctx.beginPath(); ctx.moveTo(hx - 13, hy + 13); ctx.quadraticCurveTo(hx - 15, hy + 19, hx - 11, hy + 23); ctx.moveTo(hx + 13, hy + 13); ctx.quadraticCurveTo(hx + 15, hy + 19, hx + 11, hy + 23); ctx.lineWidth = 1.5; ctx.strokeStyle = shade(SKIN0, -0.25); ctx.stroke();
      if (ang) { ell(hx, hy + 23, 8, 6); fillInk('#7a2630', 2.5); ctx.fillStyle = '#fff'; ctx.fillRect(hx - 5, hy + 18, 10, 2.5);
        ctx.beginPath(); ctx.moveTo(hx + 22, hy - 26); ctx.quadraticCurveTo(hx + 27, hy - 22, hx + 25, hy - 17); ctx.moveTo(hx + 31, hy - 26); ctx.quadraticCurveTo(hx + 26, hy - 22, hx + 28, hy - 17); ctx.lineWidth = 3; ctx.strokeStyle = '#e0464e'; ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(hx - 6, hy + 22); ctx.quadraticCurveTo(hx, hy + (sus ? 21 : 24), hx + 6, hy + 22); ink(2.6); }
    }
    ctx.restore();
    V.headX = x; V.headY = TF + (hy - 30) * TS;
  }

  /* --- 반 친구들(고무호스, 뒷모습) --- */
  const SKIN0 = '#f7caa1';
  const KIDS = [
    { hc: '#2c2a3c', hs: 'short', c: '#34407a', p: '#2f3550', ds: 0 },
    { hc: '#6b4226', hs: 'bun', c: '#f0dcbc', sk: '#3a4566', ds: 5, sleep: true, acc: 'ribbon' },
    { hc: '#2c2a3c', hs: 'buzz', c: '#e05252', p: '#e05252', ds: 7, stripe: true },
    { hc: '#9a5530', hs: 'long', c: '#ffa9cf', sk: '#3a4566', ds: 1, acc: 'band', hood: true },
    { hc: '#26222e', hs: 'twin', c: '#34407a', sk: '#3a4566', ds: 6 },
    { hc: '#4a3324', hs: 'short', c: '#a4adbf', p: '#2f3550', ds: 4, acc: 'phones', hood: true },
    { hc: '#6b4226', hs: 'pony', c: '#7fd8b9', sk: '#3a4566', ds: 2, hood: true },
    { hc: '#1f1f26', hs: 'short', c: '#34407a', p: '#2f3550', ds: 3, acc: 'cap' },
    { hc: '#2c2a3c', hs: 'short', c: '#34407a', p: '#2f3550', ds: 8, me: true },
  ];
  // 자리: [x, 바닥 y, 크기]
  const SEATS = [[70, 410, 0.58], [180, 410, 0.58], [290, 410, 0.58], [56, 506, 0.76], [180, 506, 0.76], [304, 506, 0.76], [40, 630, 0.98], [320, 630, 0.98], [180, 652, 1.24]];   // 마지막 = '나': 카메라에 더 가까이 → 더 크게(2026-11-02 하율 "나 표시가 잘 안 보여", 전엔 [180, 630, 0.98])
  function deskArt() {   // 책상(먼 쪽) — 나무 상판·쇠 다리
    ctx.beginPath(); ctx.moveTo(-42, -86); ctx.lineTo(42, -86); ctx.lineTo(48, -76); ctx.lineTo(-48, -76); ctx.closePath(); fillInk('#e7b97f', 2.6);
    ctx.fillStyle = '#c99358'; ctx.fillRect(-46, -76, 92, 6); ctx.beginPath(); ctx.rect(-46, -76, 92, 6); ink(2.2);
    ctx.beginPath(); ctx.moveTo(-40, -70); ctx.lineTo(-40, -50); ctx.moveTo(40, -70); ctx.lineTo(40, -50); ctx.lineWidth = 5; ctx.strokeStyle = K; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#9aa3b5'; ctx.stroke();
  }
  function chairArt(dx = 0) {   // 의자 등받이(카메라 쪽)
    ctx.beginPath(); ctx.moveTo(-24 + dx, -30); ctx.lineTo(-24 + dx, 6); ctx.moveTo(24 + dx, -30); ctx.lineTo(24 + dx, 6); ctx.lineWidth = 6; ctx.strokeStyle = K; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#9aa3b5'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30 + dx, -42); ctx.quadraticCurveTo(dx, -48, 30 + dx, -42); ctx.lineTo(28 + dx, -20); ctx.quadraticCurveTo(dx, -16, -28 + dx, -20); ctx.closePath(); fillInk('#d9a466', 2.6);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-26 + dx, -40, 20, 3);
  }
  // 머리 뒷모습(모양별) — 춤출 땐 머리카락이 크게 휘날림(fly)
  function kidHead(o, x, y, r, fly, tilt) {
    if (o.me) { const m = ctx.getTransform(), S0 = k * dpr || 1, py = y - r; V.meHead = { x: (m.a * x + m.c * py + m.e) / S0, y: (m.b * x + m.d * py + m.f) / S0 }; }   // '나' 표시가 내 머리 위를 따라다니게
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    const hc = o.hc, hd = shade(hc, -0.3);
    if (o.hs === 'long') { ctx.beginPath(); ctx.moveTo(-r * 0.95, 0); ctx.quadraticCurveTo(-r * 1.15 - fly * 8, r * 1.1, -r * 0.8 - fly * 12, r * 1.9); ctx.quadraticCurveTo(0, r * 2.1 + Math.abs(fly) * 4, r * 0.8 - fly * 12, r * 1.9); ctx.quadraticCurveTo(r * 1.15 - fly * 8, r * 1.1, r * 0.95, 0); ctx.closePath(); fillInk(hc); }
    if (o.hs === 'pony') { ctx.save(); ctx.translate(0, r * 0.3); ctx.rotate(fly * 0.9); ctx.beginPath(); ctx.moveTo(-r * 0.25, 0); ctx.quadraticCurveTo(-r * 0.55, r * 0.9, r * 0.05, r * 1.6); ctx.quadraticCurveTo(r * 0.5, r * 0.8, r * 0.25, 0); ctx.closePath(); fillInk(hc); ctx.restore(); }
    if (o.hs === 'twin') for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * r * 0.85, -r * 0.1); ctx.rotate(d * (0.4 + fly * 0.8)); ctx.beginPath(); ctx.moveTo(-r * 0.2, 0); ctx.quadraticCurveTo(-r * 0.45, r * 0.8, 0, r * 1.35); ctx.quadraticCurveTo(r * 0.45, r * 0.8, r * 0.2, 0); ctx.closePath(); fillInk(hc); ctx.restore(); }
    for (const d of [-1, 1]) { ell(d * r * 0.98, r * 0.12, r * 0.2, r * 0.3); fillInk(SKIN0, 2.2); }
    // 둥근 뒤통수 + 뒷머리 끝(둥근 다발 세 개)
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.95, Math.PI * 2.05);
    if (o.hs === 'buzz') ctx.quadraticCurveTo(0, r * 1.25, -r * 0.98, r * 0.15);
    else { ctx.quadraticCurveTo(r * 0.95, r * 0.75, r * 0.6, r * 0.85); ctx.quadraticCurveTo(r * 0.35, r * 1.1, 0, r * 0.88); ctx.quadraticCurveTo(-r * 0.35, r * 1.1, -r * 0.6, r * 0.85); ctx.quadraticCurveTo(-r * 0.95, r * 0.75, -r * 0.98, r * 0.15); }
    ctx.closePath(); fillInk(hc);
    if (o.hs !== 'buzz') { ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.82); ctx.quadraticCurveTo(-r * 0.25, r * 0.4, -r * 0.1, r * 0.15); ctx.moveTo(r * 0.3, r * 0.82); ctx.quadraticCurveTo(r * 0.25, r * 0.4, r * 0.1, r * 0.15); ctx.lineWidth = 2; ctx.strokeStyle = hd; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.15, r * 0.62, Math.PI * 1.1, Math.PI * 1.5); ctx.lineWidth = r * 0.16; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.stroke();   // 윤기
    if (o.hs === 'bun') { ell(0, -r * 1.02, r * 0.42, r * 0.36); fillInk(hc); }
    if (o.acc === 'ribbon') { ctx.save(); ctx.translate(0, -r * 0.7); for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(d * r * 0.4, -r * 0.4, d * r * 0.55, -r * 0.1); ctx.quadraticCurveTo(d * r * 0.4, r * 0.25, 0, 0); ctx.closePath(); fillInk('#ffd25e', 2.2); } ell(0, 0, r * 0.12, r * 0.12); fillInk('#ffb020', 2); ctx.restore(); }
    if (o.acc === 'band') { ctx.beginPath(); ctx.arc(0, 0, r * 1.02, Math.PI * 1.08, Math.PI * 1.92); ctx.lineWidth = r * 0.24 + LW * 2; ctx.strokeStyle = K; ctx.stroke(); ctx.lineWidth = r * 0.24; ctx.strokeStyle = '#ff6fa8'; ctx.stroke(); }
    if (o.acc === 'cap') { ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.03, Math.PI, 0); ctx.closePath(); fillInk('#e0464e'); rr(-r * 0.5, -r * 0.1, r, r * 0.3, r * 0.15); fillInk('#b8343c', 2.2); ell(0, -r * 0.95, r * 0.12, r * 0.08); ctx.fillStyle = K; ctx.fill(); }
    if (o.acc === 'phones') { ctx.beginPath(); ctx.arc(0, 0, r * 1.12, Math.PI * 1.02, Math.PI * 1.98); ctx.lineWidth = 7; ctx.strokeStyle = K; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#3b6cf6'; ctx.stroke(); for (const d of [-1, 1]) { rr(d * r * 1.05 - 6, -2, 12, 16, 5); fillInk('#3b6cf6', 2.5); } }
    ctx.restore();
  }
  // 춤 동작(박자 b): 몸 이동·점프·찌그러짐·기울기, 손·발 위치(서 있는 자세 기준), 팔 휘는 정도
  function hosePose(ds, b) {
    const S = Math.sin(b), C = Math.cos(b), A = Math.abs(S), S2 = Math.sin(b * 2), A2 = Math.abs(S2);
    switch (ds) {
      case 0: { const f = Math.tanh(S * 3); return { dx: f * 8, up: A2 * 10, tilt: f * 0.18, L: f > 0 ? [-58, -160, -14] : [-36, -48, 10], R: f > 0 ? [38, -46, -10] : [58, -160, 14], fL: [-14 - f * 6, 0], fR: [14 - f * 6, 0] }; }   // 디스코 찌르기
      case 1: return { dx: S * 10, up: A2 * 8, tilt: S * 0.2, L: [-34 + S * 26, -160, 18 * C], R: [34 + S * 26, -160, -18 * C], fL: [-16, 0], fR: [16, -A * 10] };   // 두 팔 크게 흔들기
      case 2: { const up = S2 > 0; return { dx: 0, up: up ? 14 : 0, tilt: up ? -0.12 : 0.08, L: [-46, -70, 16], R: up ? [26, -172, -8] : [44, -112, -20], fL: [-18, 0], fR: [18, up ? -14 : 0] }; }   // 주먹 위로 쾅
      case 3: { const n = Math.floor(((b / 1.2) % 4 + 4) % 4), P = [[[-62, -104, 0], [62, -104, 0]], [[-50, -150, 0], [62, -104, 0]], [[-62, -104, 0], [50, -150, 0]], [[-30, -66, 0], [30, -66, 0]]]; return { dx: [0, -6, 6, 0][n], up: 0, tilt: [0, -0.08, 0.08, 0][n], L: P[n][0], R: P[n][1], fL: [-16, 0], fR: [16, 0], robot: 1 }; }   // 로봇
      case 4: return { dx: 0, up: A2 * 6, tilt: S2 * 0.4, L: [-20, -86, -18], R: [26 + Math.sin(b * 4) * 10, -70, 14], fL: [-20, 0], fR: [22, -A2 * 8] };   // 헤드뱅 + 에어 기타
      case 5: { const c = A; return { dx: 0, up: c * 8, tilt: 0, L: [-6 - c * 20, -176, 14], R: [6 + c * 20, -176, -14], fL: [-14, 0], fR: [14, 0] }; }   // 머리 위 박수
      case 6: { const a = b * 1.6; return { dx: S * 8, up: A2 * 8, tilt: S * 0.25, L: [-30 + Math.cos(a) * 40, -110 + Math.sin(a) * 40, 20], R: [30 - Math.cos(a) * 40, -110 - Math.sin(a) * 40, -20], fL: [-16, 0], fR: [16, 0] }; }   // 풍차
      case 7: { const j = A; return { dx: 0, up: j * 34, tilt: 0, L: [-52, -168 - j * 8, -10], R: [52, -168 - j * 8, 10], fL: [-22 + j * 8, -j * 14], fR: [22 - j * 8, -j * 14] }; }   // 개구리 점프
      // 2026-11-02 하율 "책상 위에 올라가는 놈, 책상 짚고 머리 흔드는 애처럼 다양하게" — lift: 몸 전체를 위로(책상 위), fixH: 손을 그 자리 그대로(책상 짚기), hy: 머리 위아래
      case 9: { const f = Math.tanh(S * 3); return { dx: f * 6, up: A2 * 6, tilt: f * 0.15, lift: -100, L: [-30, -60 - Math.max(0, f) * 110, 10], R: [30, -60 - Math.max(0, -f) * 110, -10], fL: [-14, 0], fR: [14, -A * 6] }; }   // 책상 위로 올라가 번갈아 주먹 쾅
      case 10: return { dx: 0, up: A2 * 4, tilt: S2 * 0.55, hy: A2 * 12, fixH: 1, L: [-36, -98, 8], R: [36, -98, -8], fL: [-22, 0], fR: [22, 0] };   // 책상 짚고 헤드뱅
      case 11: { const k3 = A2; return { dx: -10, up: 0, tilt: -0.25 + k3 * 0.1, lift: 0, L: [-50, -150 - k3 * 20, -12], R: [40, -60, -10], fL: [-24, 0], fR: [26, -46], legUp: 1 }; }   // 의자에 한 발 올리고 손가락 하늘로
      default: { const f = Math.tanh(S * 2.5); return { dx: f * 12, up: A2 * 16, tilt: f * 0.3, L: [-48 - Math.max(0, f) * 14, -110 - Math.max(0, f) * 60, 20], R: [48 + Math.max(0, -f) * 14, -110 - Math.max(0, -f) * 60, -20], fL: [-18 + f * 8, -Math.max(0, f) * 16], fR: [18 + f * 8, -Math.max(0, -f) * 16] }; }   // 나: 미친 듯이 흔들기
    }
  }
  const mixP = (A, B, w) => { if (w <= 0) return A; if (w >= 1) return B; const o = { robot: w < 0.5 ? A.robot : B.robot };
    for (const k2 of ['dx', 'up', 'tilt']) o[k2] = A[k2] + (B[k2] - A[k2]) * w;
    for (const k2 of ['lift', 'hy', 'fixH']) o[k2] = (A[k2] || 0) + ((B[k2] || 0) - (A[k2] || 0)) * w;
    o.lift -= Math.sin(w * Math.PI) * 30;   // 자세가 바뀔 때 폴짝(책상 위로 뛰어오르기·내려오기)
    for (const k2 of ['L', 'R', 'fL', 'fR']) o[k2] = A[k2].map((v, i) => v + (B[k2][i] - v) * w); return o; };
  // 친구들은 4박마다 다른 춤으로 바뀜(0.6박 동안 부드럽게 섞어서 — 팔다리가 툭 끊기지 않게), '나'는 미친 듯이 흔들기 그대로
  function kidPose(o, T, b) { if (o.me) return hosePose(o.ds, b); const seg = Math.floor(T / 4), fr = T / 4 - seg, w = clamp((fr - 0.85) / 0.15, 0, 1), d0 = DANCES[(o.ds + seg * 3) % DANCES.length], d1 = DANCES[(o.ds + seg * 3 + 3) % DANCES.length]; return mixP(hosePose(d0, b), hosePose(d1, b), w); }
  const DANCES = [0, 1, 9, 2, 3, 10, 4, 5, 11, 6, 7];   // 친구들이 돌아가며 추는 춤(8 = '나' 전용)
  function drawKid(o, x, y, sc, party, extra) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (party && !RM()) { const bt = V.t * extra.tempo * o.tp * Math.PI + o.ph; ctx.save(); ctx.translate(0, -Math.abs(Math.sin(bt)) * 6 * Math.min(extra.amp, 1.6)); ctx.rotate(Math.sin(bt * 0.5) * 0.06); deskArt(); ctx.restore(); }   // 책상도 들썩
    else deskArt();
    if (!party) {   // 앉아서 공부하는 척(숨쉬기·가끔 고개 갸웃·필기) / 졸기 / 엎드려 자기
      const br = RM() ? 0 : Math.sin(V.t * 1.6 + o.ph) * 1.2, sleep = o.sleep || extra.slept;
      const nod = extra.nod || 0, look = RM() || o.me ? 0 : Math.max(0, Math.sin(V.t * 0.4 + o.ph * 2) - 0.85) * 2 * (o.ph > 2 ? 1 : -1);
      if (sleep) { hose(-22, -52, -16, -80, 12, o.c, 8); hose(22, -52, 16, -80, 12, o.c, -8); glove(-12, -82, 8, 0.6); glove(12, -82, 8, -0.6); kidHead(o, 0, -66, 24, 0, 0); bean(0, -60, -6, 30, o.c); fillInk(o.c); }
      else {
        const wr = o.wr && !RM() ? Math.sin(V.t * 11 + o.ph) * 2 : 0;
        hose(-24, -50 + br, -12, -84, 12, o.c, 10); hose(24, -50 + br, 12 + wr, -86, 12, o.c, -10); glove(-12, -86, 8, 0.4); glove(12 + wr, -88, 8, -0.4);
        bean(0, -62 + br, -6, 30, o.c); fillInk(o.c); kidCloth(o, 0, -62 + br, -6);
        kidHead(o, look * 3, -84 + br + nod, 25, 0, look * 0.15 + nod * 0.012);
      }
      chairArt(); ctx.restore();
      return;
    }
    // 춤: 일어나 의자 앞(카메라 쪽)으로 나와 미친 듯이
    const T = V.t * extra.tempo * o.tp + o.ph, b = T * Math.PI, P = kidPose(o, T, b), amp = extra.amp;
    const P0 = kidPose(o, T - 0.5 / Math.PI, b - 0.5);   // 잔상용(조금 전 자세)
    const up = P.up * Math.min(amp, 1.7), sq = (RM() ? 0 : Math.sin(b * 2) * 0.12 * amp), sx2 = 1 + sq, sy2 = 1 - sq;
    const fy = 22, dx = P.dx * amp;
    ell(dx * 0.4, fy, 34, 7); ctx.fillStyle = 'rgba(23,48,72,.25)'; ctx.fill();
    // 발밑 색 조명
    ctx.save(); ctx.globalAlpha = 0.35 * V.pv; ell(0, fy, 52, 13); ctx.fillStyle = GLOW[o.ci % GLOW.length]; ctx.fill(); ctx.restore();
    chairArt();
    ctx.save(); ctx.translate(0, fy + (P.lift || 0));
    { const sp = (T + o.ph * 3) % 14; if (sp < 1 && !RM()) { const c = Math.cos(sp * Math.PI * 2); ctx.scale(Math.sign(c || 1) * Math.max(0.45, Math.abs(c)), 1); } }   // 가끔 제자리 한 바퀴(친구마다 다른 때)
    const hipY = -46 - up, top = hipY - 54 * sy2, cx = dx;
    // 다리(고무호스) · 큰 신발
    const legC = o.sk ? SKIN0 : o.p, sockC = '#ffffff';
    for (const [hx, f, side] of [[-10, P.fL, -1], [10, P.fR, 1]]) {
      const fx = f[0] * amp * 0.9 + dx * 0.3, fyy = P.legUp && side > 0 ? f[1] : f[1] * amp - up * 0.15;
      hose(cx + hx, hipY + 6, fx, fyy - 6, 13, legC, side * (8 + up * 0.3));
      if (o.sk) hose((cx + hx + fx) / 2 + side * 3, (hipY + fyy) / 2 + 8, fx, fyy - 6, 13, sockC, side * 3);
      shoeH(fx, fyy + 2, 10, '#2f2a33', side);
    }
    if (o.sk) { ctx.beginPath(); ctx.moveTo(cx - 24 * sx2, hipY - 10); ctx.lineTo(cx + 24 * sx2, hipY - 10); ctx.lineTo(cx + 34 * sx2 + Math.sin(b) * 5, hipY + 16); ctx.quadraticCurveTo(cx, hipY + 22, cx - 34 * sx2 + Math.sin(b) * 5, hipY + 16); ctx.closePath(); fillInk(o.sk);
      ctx.beginPath(); for (const q of [-18, -6, 6, 18]) { ctx.moveTo(cx + q * 0.75, hipY - 8); ctx.lineTo(cx + q + Math.sin(b) * 4, hipY + 16); } ctx.lineWidth = 1.8; ctx.strokeStyle = shade(o.sk, -0.35); ctx.stroke(); }
    // 몸(찌그러짐·늘어남) · 옷 무늬
    ctx.save(); ctx.translate(cx, hipY); ctx.rotate(P.tilt * amp * 0.6); ctx.scale(sx2, sy2);
    bean(0, -60, 2, 31, o.c); fillInk(o.c); kidCloth(o, 0, -60, 2);
    ctx.restore();
    const shY = hipY - 50 * sy2, shL = [cx - 26 * sx2, shY], shR = [cx + 26 * sx2, shY];
    // 잔상(빠른 팔)
    if (!RM() && !P.robot) { ctx.globalAlpha = 0.22; for (const [sh, p] of [[shL, P0.L], [shR, P0.R]]) { const ea = Math.min(amp, 1.2), hx = cx + p[0] * ea * 0.9, hy = p[1] * ea * 0.9 - up * 0.9 + 8; hose(sh[0], sh[1], hx, hy, 11, o.c, p[2]); } ctx.globalAlpha = 1; }
    // 팔(고무호스) + 장갑
    const hands = [];
    for (const [sh, p] of [[shL, P.L], [shR, P.R]]) { const ea = Math.min(amp, 1.2), fh = P.fixH || 0, hx = (cx + p[0] * ea * 0.9) * (1 - fh) + p[0] * fh, hy = (p[1] * ea * 0.9 - up * 0.9 + 8) * (1 - fh) + (p[1] - (P.lift || 0)) * fh; hose(sh[0], sh[1], hx, hy, 12, o.c, p[2] * Math.min(amp, 1.4)); hands.push([hx, hy, Math.atan2(hy - sh[1], hx - sh[0]) - Math.PI / 2]); }
    // 머리(휘날림)
    kidHead(o, cx + P.tilt * 10, shY - 30 + (P.hy || 0), 27, Math.sin(b * 2 + 1) * amp, P.tilt * amp);
    for (const [hx, hy, a] of hands) glove(hx, hy, 10, a, 1.1);
    // 속도선 · 땀방울
    if (!RM() && amp > 1.2) { ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; for (const d of [-1, 1]) { const sx = cx + d * 48, sy = shY - 10 + Math.sin(b * 3 + d) * 8; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + d * 10, sy - 4); ctx.moveTo(sx + d * 2, sy + 10); ctx.lineTo(sx + d * 12, sy + 8); ctx.stroke(); } }
    if (!RM() && Math.sin(b * 0.5 + o.ph) > 0.6) { const dx2 = cx + 30, dy2 = shY - 58 - ((V.t * 60) % 20); ctx.beginPath(); ctx.moveTo(dx2, dy2 - 7); ctx.quadraticCurveTo(dx2 + 6, dy2 + 2, dx2, dy2 + 4); ctx.quadraticCurveTo(dx2 - 6, dy2 + 2, dx2, dy2 - 7); fillInk('#bfe8ff', 2); }
    ctx.restore(); ctx.restore();
  }
  function kidCloth(o, cx, top, bot) {
    if (o.hood) { ctx.beginPath(); ctx.moveTo(cx - 18, top + 4); ctx.quadraticCurveTo(cx, top + 34, cx + 18, top + 4); fillInk(shade(o.c, -0.12), 2.4); }
    else if (o.stripe) { ctx.beginPath(); ctx.moveTo(cx - 30, top + 22); ctx.lineTo(cx + 30, top + 22); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(cx, top + 8); ctx.lineTo(cx, bot - 4); ctx.lineWidth = 2; ctx.strokeStyle = shade(o.c, -0.35); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 9, top + 1); ctx.quadraticCurveTo(cx, top + 8, cx + 9, top + 1); fillInk('#ffffff', 2.2); }
  }
  const GLOW = ['#6fc6f4', '#ffe08a', '#8fe8cf', '#a9c4ff', '#ff8f8f'];
  function partArt(q) {   // 날아다니는 공책 종이·책·연필(반짝이 대신)
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
    if (q.kind === 'paper') { const fl = Math.cos(q.rot * 1.7); ctx.scale(Math.max(0.2, Math.abs(fl)), 1); rr(-8, -10, 16, 20, 2); fs('#ffffff', 1.8); ctx.strokeStyle = '#9cc8ea'; ctx.lineWidth = 1.2; ctx.beginPath(); for (const y of [-4, 1, 6]) { ctx.moveTo(-5, y); ctx.lineTo(5, y); } ctx.stroke(); }
    else if (q.kind === 'book') { rr(-11, -8, 22, 16, 2.5); fs(q.c, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(7, -6, 3, 12); ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-6, 8); ctx.lineWidth = 1.6; ctx.strokeStyle = K; ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-12, -2.5); ctx.lineTo(8, -2.5); ctx.lineTo(13, 0); ctx.lineTo(8, 2.5); ctx.lineTo(-12, 2.5); ctx.closePath(); fs('#ffd25e', 1.8); ctx.fillStyle = '#ff8f8f'; ctx.fillRect(-12, -2.5, 4, 5); }
    ctx.restore();
  }
  function drawKids(party) {
    const m = s ? s.m2 / 2 : 1, amp = 1.35 + (m - 1) * 0.35, tempo = 4 + (m - 1) * 1.4;   // 박자/초 — 배율 오를수록 더 빠르고 크게(11-02 더 난리나게: 1.15→1.35, 3.2→4)
    const zzz = s ? s.sleep / D.SLEEP_FULL : 0, slept = !!(s && s.st === 'caught' && s.why === 'sleep');
    KIDS.forEach((o, i) => {
      const [x, y, sc] = SEATS[i], me = !!o.me;
      const nod = me && !party && zzz > 0.6 ? Math.max(0, Math.sin(V.t * (2 + zzz * 3))) * (zzz - 0.6) * 30 : 0;
      drawKid({ ...o, ph: i * 1.37, tp: 0.88 + (i % 4) * 0.09, ci: i, wr: i % 3 === 0 }, x, y, sc, party, { tempo, amp, slept: me && slept, nod });
    });
    return { zzz, slept, me: SEATS[8] };
  }
  // 파티: 바닥만 따뜻하게 살짝 밝아짐(선생님은 그대로)
  function drawPartyDim() { if (V.pv <= 0) return; ctx.fillStyle = `rgba(255,214,150,${0.12 * V.pv})`; ctx.fillRect(0, 300, W, H - 300); }   // 2026-11-02 하율 "바닥이 까매짐" → 어둡게 대신 따뜻하게 살짝 밝힘

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
    if (looking && st.scene === 'play') { ctx.strokeStyle = 'rgba(255,95,110,.75)'; ctx.lineWidth = 9; ctx.strokeRect(4.5, 4.5, W - 9, H - 9); }   // 보는 동안: 화면 테두리
    if (V.alert > 0) { const sz = 44 * (V.alert > 0.5 ? 0.6 + (0.6 - V.alert) * 4 : 1); ctx.globalAlpha = Math.min(1, V.alert * 4); outlined('!', V.tx + 30, 126, sz, '#ff5f6e'); ctx.globalAlpha = 1; }
    if (V.whip > 0 && !RM()) { ctx.globalAlpha = Math.min(1, V.whip * 4); outlined('휙!', V.tx - 44, 150, 22, '#fff'); ctx.globalAlpha = 1; }
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
    if (zv > 0) { rr(56, 618, Math.max(10, 288 * zv), 10, 5); ctx.fillStyle = zv > 0.75 ? '#ff6b6b' : zv > 0.5 ? '#9bb8ff' : '#6fc6f4'; ctx.fill(); }
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
    const sc = k * dpr; ctx.setTransform(sc, 0, 0, sc, 0, 0);
    const party = !!(s && s.dancing && st.scene === 'play');
    ctx.save();
    if (V.shake > 0 && !RM()) ctx.translate((Math.random() - 0.5) * 9 * V.shake / 0.45, (Math.random() - 0.5) * 7 * V.shake / 0.45);
    ctx.drawImage(bgArt(), 0, 0, W, H);
    boardInk();
    drawTeacher();
    drawPartyDim();
    if (party && !RM()) { ctx.translate(0, Math.abs(Math.sin(V.t * Math.PI * (4 + (s.m2 / 2 - 1) * 1.4))) * 2.5 * V.pv); }   // 박자에 맞춰 교실 아래쪽이 쿵쿵
    const kd2 = drawKids(party);
    for (const q of V.parts) { ctx.globalAlpha = Math.min(1, q.life * 2); if (q.kind === 'note') outlined('♪', q.x, q.y, 18, q.c); else partArt(q); } ctx.globalAlpha = 1;
    ctx.restore();
    // '나' 표시 · 졸음 Zz
    { const h = V.meHead || { x: 180, y: 520 }, f = V.meM ? 0.25 : 1; V.meM = { x: (V.meM?.x ?? h.x) + (h.x - (V.meM?.x ?? h.x)) * f, y: (V.meM?.y ?? h.y) + (h.y - (V.meM?.y ?? h.y)) * f }; }   // 춤으로 출렁여도 부드럽게 따라감
    const ax = clamp(V.meM.x, 30, W - 30), ay = V.meM.y - 8 + (RM() ? 0 : Math.sin(V.t * 4) * 3);   // 커진 '나' 머리 바로 위
    ctx.beginPath(); ctx.moveTo(ax - 13, ay); ctx.lineTo(ax + 13, ay); ctx.lineTo(ax, ay + 14); ctx.closePath(); ctx.fillStyle = '#ffe08a'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = K; ctx.stroke();
    outlined('나', ax, ay - 5, 19, '#ffe08a');
    if (kd2.slept || (!party && kd2.zzz > 0.75)) for (let i = 0; i < 2; i++) { const a = (V.t * 0.8 + i * 0.5) % 1; ctx.globalAlpha = 1 - a; outlined(i ? 'Z' : 'z', ax + 26 + a * 10, ay + 30 - a * 22, 16 + a * 6, '#e9e4ff'); } ctx.globalAlpha = 1;
    for (const q of V.pops) { ctx.globalAlpha = Math.min(1, q.life * 2); outlined(q.t, q.x, q.y, q.size, q.c); } ctx.globalAlpha = 1;
    if (V.bubT > 0 && V.bub) bubble(V.headX + 8, V.headY, V.bub, V.bubAngry && s && s.st === 'caught');
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
    beep(go) { tone(go ? 880 : 520, go ? 0.25 : 0.12, 'square', go ? 0.05 : 0.0675); },
    tap() { tone(300, 0.05, 'triangle', .132); tone(300, 0.05, 'triangle', .119, 0, 0.14); },   // 막대기로 교탁 톡톡
    whoosh() { tone(500, 0.15, 'sine', 0.04, 200); },
    whip() { tone(1400, 0.09, 'sawtooth', .111, 300); },
    peek() { tone(420, 0.06, 'sine', .119, 520); },
    safe() { tone(880, 0.1, 'sine', 0.07, 1320); tone(1320, 0.12, 'sine', 0.05, 0, 0.08); },
    caught() { tone(220, 0.4, 'sawtooth', 0.08, 90); },
    mult(m2) { tone(500 + m2 * 60, 0.09, 'square', .0745, 800 + m2 * 80); },
    beat(dancing, t, m2) {   // 춤추는 동안 작은 쿵짝(배율 오르면 빨라짐)
      if (!on || !dancing) { nextBeat = 0; return; }
      const a = ctx(); if (!a) return;
      const gap = 0.5 - Math.min(0.2, (m2 - 2) * 0.035);
      if (!nextBeat || a.currentTime >= nextBeat) { tone(90, 0.12, 'sine', .0637, 50); tone(1800, 0.03, 'square', .0106, 0, gap / 2); nextBeat = a.currentTime + gap; }
    },
  };
}
