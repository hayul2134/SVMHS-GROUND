// SVMHS GROUND — 필름 10(2026-10-29 하율: 사과 게임 → 멜론 → "필름으로 바꾸고 출시해도 될 정도로", 미리보기 깃발 film-game)
// 숫자 필름 컷을 드래그 네모로 묶어 합이 딱 10이면 잘려 나감. 지운 컷 수 = 점수, 2분. 규칙·판 생성·검사는 film-score.js(서버와 같음)
// createFilm(root, { best, sound, seed: async () => 씨앗|null, onOver(res), onSound(on) })
//   res = { n, ms, rounds: [가로 칸 수, 끝난 ms, ...묶음], why: 'time'|'clear'|'stuck' }
import { CELLS, TIME_MS, makeGrid, enc, cellsIn, hasMove } from './film-score.js';

const INK = '#2a2846';
export function createFilm(root, opt = {}) {
  let best = opt.best || 0, sound = !!opt.sound;
  root.innerHTML = `<div class="ml-top"><span class="ml-chip">점수 <b data-m="sc">0</b></span><span class="ml-chip">최고 <b data-m="best">${best}</b></span><span class="ml-chip ml-tm">남은 시간 <b data-m="tm">${TIME_MS / 1000}</b></span>
      <button type="button" class="btn ghost hr-snd ml-snd" data-m="snd"></button></div>
    <div class="ml-board" data-m="board"><canvas data-m="cv" aria-label="필름 10 판"></canvas><div class="ml-bar" aria-hidden="true"><i data-m="tf"></i></div>
      <div class="ml-ov" data-m="ov"></div></div>`;
  const $ = k => root.querySelector(`[data-m="${k}"]`);
  const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), tf = $('tf'), board = $('board'), sndBtn = $('snd');
  let cols = 15, rows = 8, grid = [], score = 0, state = 'ready', cell = 40, dpr = 1, frame = null, drag = null, pops = [], floats = [], raf = 0, dead = false;
  let used = 0, lastAt = 0, lastTm = -1, moves = [], lastSum = -1, busy = false, ac = null;
  const clock = () => used + (state === 'play' ? performance.now() - lastAt : 0);   // 멈춘 시간은 뺀 판 시계

  /* ----- 소리(Web Audio 합성, 기본 꺼짐) ----- */
  function au() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
  function tone(f, d, type = 'square', vol = .06, at = 0, f2 = 0) {
    const a = sound && au(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
  }
  function snip(n) {   // 가위 '싹둑' = 짧은 잡음 두 번 + 높은 음(많이 지울수록 높게)
    const a = sound && au(); if (!a) return;
    for (const at of [0, .07]) {
      const len = Math.floor(a.sampleRate * .045), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = 2500; g.gain.value = .35;
      s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + at);
    }
    tone(660 + Math.min(n, 8) * 70, .12, 'triangle', .07, .1);
  }
  const paintSnd = () => { const t = sound ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; };
  sndBtn.onclick = () => { sound = !sound; if (sound) au(); paintSnd(); opt.onSound?.(sound); sndBtn.blur(); };
  paintSnd();

  /* ----- 그림(2026-10-29 하율 "특색이 사라졌다" → 줄마다 필름 띠 + 구멍은 띠 가장자리에만, 숫자 칸은 밝은 가로 컷) -----
     눈 피로 원인이었던 것: 칸마다 검은 테두리·구멍 반복, 진한 노랑. → 띠는 차분한 필름 베이스색, 구멍은 띠에만 작게, 컷은 크림색 */
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const TX = .07, TY = .25;   // 컷 안쪽 여백(가로 = 컷 사이 선, 세로 = 구멍 자리)
  let seg = null, tiles = null;
  function makeFrame() {
    const S = Math.round(cell * dpr), dk = isDark(), mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
    seg = mk(); const g = seg.getContext('2d');   // 띠 한 칸: 위아래 구멍 2개씩 + 빈 컷 자리
    g.fillStyle = dk ? '#232842' : '#fbf8f1';
    for (const y of [S * .095, S * .905 - S * .09]) for (const x of [S * .2, S * .62]) { g.beginPath(); g.roundRect(x, y, S * .18, S * .09, S * .025); g.fill(); }
    g.fillStyle = dk ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.28)'; g.beginPath(); g.roundRect(S * TX, S * TY, S * (1 - TX * 2), S * (1 - TY * 2), S * .06); g.fill();
    const tile = (top, bot, line, lw) => {   // 숫자 컷
      const c = mk(), t = c.getContext('2d'), x = S * TX, y = S * TY, w = S * (1 - TX * 2), h = S * (1 - TY * 2);
      const grd = t.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, top); grd.addColorStop(1, bot);
      t.fillStyle = grd; t.beginPath(); t.roundRect(x, y, w, h, S * .06); t.fill();
      t.lineWidth = S * lw; t.strokeStyle = line; t.stroke(); return c;
    };
    tiles = dk ? { n: tile('#3b4269', '#333a5e', '#59618f', .02), s: tile('#2f4f86', '#2a4778', '#8fb1ff', .045), k: tile('#2e6040', '#285638', '#8fe39a', .045) }
               : { n: tile('#fffdf7', '#fff4de', '#b99a6a', .02), s: tile('#e6efff', '#d6e5ff', '#3a6fd0', .045), k: tile('#e3f6e5', '#cfeed3', '#2f9a3a', .045) };
    tiles.dk = dk; frame = tiles.n;
  }
  function fit() {
    if (dead || !cv.isConnected) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = root.clientWidth - 34, top = board.getBoundingClientRect().top, h = Math.max(260, innerHeight - Math.max(top, 0) - 24);
    if (state === 'ready' || state === 'over') { const c = w < 640 && h > w * 1.15 ? 8 : 15; if (c !== cols) { cols = c; rows = CELLS / c; } }
    cell = Math.max(20, Math.min(72, Math.floor(w / cols), Math.floor(h / rows)));
    cv.style.width = cell * cols + 'px'; cv.style.height = cell * rows + 'px';
    cv.width = cell * cols * dpr; cv.height = cell * rows * dpr;
    makeFrame(); draw();
  }
  // 드래그 네모가 컷(버튼) 자체에 닿은 칸 → 줄·칸 범위(2026-10-29 하율 "숫자 말고 버튼 자체가 선택되게")
  // 컷과 겹친 길이가 컷 크기의 15% 이상이면 선택(스치는 정도는 제외), 탭·짧은 드래그는 컷 안에만 있으면 선택
  function span(lo, hi, n, a, b) {
    const t = cell * (b - a) * .15, need = Math.min(t, hi - lo); let k0 = -1, k1 = -2;
    for (let k = 0; k < n; k++) { const ov = Math.min(hi, (k + b) * cell) - Math.max(lo, (k + a) * cell); if (ov >= 0 && ov >= need) { if (k0 < 0) k0 = k; k1 = k; } }
    return [k0, k1];
  }
  function range() {
    if (!drag) return null;
    const x0 = Math.min(drag.x0, drag.x1), x1 = Math.max(drag.x0, drag.x1), y0 = Math.min(drag.y0, drag.y1), y1 = Math.max(drag.y0, drag.y1);
    const [c0, c1] = span(x0, x1, cols, TX, 1 - TX), [r0, r1] = span(y0, y1, rows, TY, 1 - TY);
    return { x0, x1, y0, y1, r0, r1, c0, c1, ok: c0 >= 0 && r0 >= 0 };
  }
  const selOf = R => R && R.ok ? cellsIn(grid, cols, R.r0, R.c0, R.r1, R.c1) : [];
  function draw() {
    if (tiles && tiles.dk !== isDark()) makeFrame();   // 화이트/다크 바꾸면 색도 새로
    if (!frame) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cell * cols, cell * rows);
    const R = range(), sel = new Set(selOf(R)); let sum = 0; sel.forEach(i => sum += grid[i]);
    const ok = sum === 10, hide = state === 'ready' || state === 'pause';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(cell * .36)}px Outfit,Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
    const dk = isDark();
    ctx.fillStyle = dk ? '#5b4b38' : '#d6bb8e';   // 줄마다 필름 띠
    for (let r = 0; r < rows; r++) { ctx.beginPath(); ctx.roundRect(1, r * cell + cell * .03, cell * cols - 2, cell * .94, cell * .1); ctx.fill(); }
    for (let i = 0; i < CELLS; i++) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell, v = grid[i], on = sel.has(i);
      ctx.drawImage(seg, x, y, cell, cell);
      if (!v) continue;
      const d = cell * (on ? 1.05 : 1);
      ctx.drawImage(on ? (ok ? tiles.k : tiles.s) : tiles.n, x + (cell - d) / 2, y + (cell - d) / 2, d, d);
      if (!hide) { ctx.fillStyle = on ? (dk ? '#fff' : ok ? '#1f7a2a' : '#2457b8') : dk ? '#eef0ff' : INK; ctx.fillText(v, x + cell / 2, y + cell * .52); }
    }
    const now = performance.now();
    pops = pops.filter(p => now - p.t < 360);
    for (const p of pops) {   // 잘린 컷: 반으로 갈라지며 떨어짐
      const k = (now - p.t) / 360, e = k * k;
      ctx.globalAlpha = 1 - k;
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(p.x + cell / 2 + s * k * cell * .35, p.y + cell / 2 + e * cell * .9); ctx.rotate(s * k * .6);
        ctx.beginPath(); ctx.rect(s < 0 ? -cell / 2 : 0, -cell / 2, cell / 2, cell); ctx.clip();
        ctx.drawImage(frame, -cell / 2, -cell / 2, cell, cell); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    floats = floats.filter(f => now - f.t < 700);
    for (const f of floats) {
      const k = (now - f.t) / 700; ctx.globalAlpha = 1 - k * k;
      ctx.font = `900 ${Math.round(Math.max(16, cell * .5))}px Outfit,sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round';
      ctx.strokeText('+' + f.n, f.x, f.y - k * cell * .8); ctx.fillStyle = '#2f9a3a'; ctx.fillText('+' + f.n, f.x, f.y - k * cell * .8); ctx.globalAlpha = 1;
    }
    if (R) {   // 편집 프로그램 선택 상자처럼 점선
      ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -(now / 40) % 10;
      ctx.strokeStyle = ok ? '#2f9a3a' : '#3a6fd0'; ctx.fillStyle = ok ? 'rgba(76,175,80,.1)' : 'rgba(80,140,230,.07)';
      ctx.beginPath(); ctx.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      if (sel.size) {
        const bw = 34, bx = Math.min(R.x1 + 4, cell * cols - bw - 2), by = Math.max(R.r0 * cell - 11, 1);   // 합 표시는 띠 구멍 줄 위에(숫자 안 가림)
        ctx.fillStyle = ok ? '#2f9a3a' : sum > 10 ? '#d9534f' : '#3a6fd0'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 22, 8); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '800 13px Outfit,sans-serif'; ctx.fillText(String(sum), bx + bw / 2, by + 11.5);
      }
      if (sum !== lastSum) { if (sel.size && lastSum !== -1) tone(ok ? 990 : 520 + Math.min(sum, 12) * 25, .035, 'square', .025); lastSum = sum; }
    } else lastSum = -1;
  }

  /* ----- 입력 ----- */
  const pos = e => { const b = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(cell * cols, e.clientX - b.left)), y: Math.max(0, Math.min(cell * rows, e.clientY - b.top)) }; };
  const down = e => { if (state !== 'play' || e.button > 0 || drag) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} const p = pos(e); drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, id: e.pointerId }; kick(); };
  const move = e => { if (!drag || e.pointerId !== drag.id) return; const p = pos(e); drag.x1 = p.x; drag.y1 = p.y; kick(); };
  const up = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const R = range(), sel = selOf(R); let sum = 0; sel.forEach(i => sum += grid[i]);
    drag = null;
    if (state !== 'play' || !sel.length) { kick(); return; }
    if (sum !== 10) { tone(180, .09, 'triangle', .05); kick(); return; }
    // 실제로 묶인 컷들의 범위로 저장(서버가 같은 범위로 다시 둬 봄)
    let r0 = 99, r1 = -1, c0 = 99, c1 = -1;
    sel.forEach(i => { const r = Math.floor(i / cols), c = i % cols; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); });
    const t = Math.round(clock());
    if (moves.length && t - Math.floor(moves[moves.length - 1] / 1048576) < 100) { kick(); return; }   // 0.1초 안 연속 묶음은 무시(서버 MIN_GAP)
    moves.push(enc(t, r0, c0, r1, c1));
    const now = performance.now();
    sel.forEach(i => { pops.push({ x: (i % cols) * cell, y: Math.floor(i / cols) * cell, t: now }); grid[i] = 0; });
    floats.push({ n: sel.length, x: (c0 + c1 + 1) / 2 * cell, y: (r0 + r1 + 1) / 2 * cell, t: now });
    score += sel.length; $('sc').textContent = score;
    $('sc').classList.remove('bump'); void $('sc').offsetWidth; $('sc').classList.add('bump');
    snip(sel.length);
    if (!grid.some(v => v)) end('clear');
    else if (!hasMove(grid, cols)) end('stuck');
    kick();
  };
  const cancel = e => { if (drag && (!e || e.pointerId === drag.id)) { drag = null; kick(); } };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', cancel);

  function kick() { if (!raf && !dead) raf = requestAnimationFrame(loop); }
  function loop() {
    raf = 0; if (dead) return;
    if (state === 'play') {
      const left = Math.max(0, TIME_MS - clock()), s = Math.ceil(left / 1000);
      if (s !== lastTm) { lastTm = s; $('tm').textContent = s; root.classList.toggle('low', left <= 20000); if (s <= 10 && s > 0) tone(s <= 3 ? 1200 : 900, .05, 'sine', .05); }
      tf.style.setProperty('--t', (left / TIME_MS).toFixed(4));   // CSP: style 속성 대신 CSSOM
      if (left <= 0) end('time');
    }
    draw();
    if (state === 'play' || pops.length || floats.length || drag) raf = requestAnimationFrame(loop);
  }

  /* ----- 판 흐름 ----- */
  const sb = s => `<b>${s}</b>`;
  function ready() {
    state = 'ready'; ov.hidden = false; ov.className = 'ml-ov';
    ov.innerHTML = `${sb('필름 10')}<span>드래그로 네모를 그려 필름 컷을 묶어요<br>숫자 합이 <em>딱 10</em>이면 싹둑! · 2분 동안 많이 자르기</span><button type="button" class="btn big" data-m="go">시작</button>`;
    $('go').onclick = start; draw();
  }
  async function start() {
    if (busy || dead) return; busy = true;
    const go = $('go'); if (go) { go.disabled = true; go.textContent = '준비 중…'; }
    let seed = null; try { seed = await opt.seed?.(); } catch {}
    busy = false; if (dead) return;
    grid = makeGrid(seed == null ? Math.floor(Math.random() * 4294967296) : seed);
    score = 0; $('sc').textContent = 0; drag = null; pops = []; floats = []; moves = []; used = 0; lastTm = -1; root.classList.remove('low');
    if (state === 'over') fit();   // 화면 방향이 바뀌었으면 판 모양도 새로
    if (!hasMove(grid, cols)) { start(); return; }   // (거의 없음) 처음부터 묶을 게 없는 판
    state = 'play'; lastAt = performance.now(); ov.hidden = true; tone(523, .08, 'triangle', .06); tone(784, .12, 'triangle', .06, .08);
    kick();
  }
  function pause() {
    if (state !== 'play') return;
    used = clock(); state = 'pause'; drag = null;
    ov.hidden = false; ov.className = 'ml-ov solid';
    ov.innerHTML = `${sb('잠깐 멈춤')}<span>시간도 같이 멈췄어요</span><button type="button" class="btn big" data-m="go">계속하기</button>`;
    $('go').onclick = resume; draw();
  }
  function resume() { if (state !== 'pause') return; state = 'play'; lastAt = performance.now(); ov.hidden = true; kick(); }
  function end(why) {
    if (state !== 'play') return;
    const ms = Math.min(TIME_MS, Math.round(clock()));
    used = ms; state = 'over'; drag = null;
    const nb = score > best; if (nb) { best = score; $('best').textContent = best; }
    tone(nb ? 784 : 523, .14, 'triangle', .07); tone(nb ? 1047 : 392, .22, 'triangle', .07, .14);
    ov.hidden = false; ov.className = 'ml-ov end';
    const head = why === 'clear' ? '전부 잘라냈어요!' : why === 'stuck' ? '더 묶을 컷이 없어요' : '시간 끝!';
    ov.innerHTML = `${sb(head)}<p class="ml-sc">${score}<small>컷</small></p><span>${why === 'clear' ? `${(ms / 1000).toFixed(1)}초 만에 ${CELLS}컷 전부` : nb ? '최고 기록 경신!' : `내 최고 ${best}컷`}</span>
      <small class="ml-msg" data-m="msg"></small><button type="button" class="btn big" data-m="go">한 번 더</button>`;
    $('go').onclick = start;
    opt.onOver?.({ n: score, ms, why, nb, rounds: [cols, ms, ...moves] });
  }
  const blur = () => pause();
  const vis = () => { if (document.hidden) pause(); };
  addEventListener('blur', blur); document.addEventListener('visibilitychange', vis);
  const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe(root);
  grid = makeGrid(Math.floor(Math.random() * 4294967296)); ready(); fit();
  return {
    start, pause,
    msg(html) { const m = $('msg'); if (m) m.innerHTML = html; },
    setBest(b, force) { if (force || b > best) { best = b; $('best').textContent = b; } },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('blur', blur); document.removeEventListener('visibilitychange', vis); try { ac?.close(); } catch {} },
    get st() { return { state, score, cols, rows, cell, grid, moves }; },
    _end() { used = TIME_MS; lastAt = performance.now(); },   // 테스트용: 시간 다 씀
  };
}
