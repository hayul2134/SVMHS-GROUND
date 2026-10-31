// SVMHS GROUND — 게퍼 10(옛 이름 필름 10, 2026-10-29 하율 "제목도 게퍼 10으로"): 사과 게임 → 멜론 → "필름으로 바꾸고 출시해도 될 정도로", 미리보기 깃발 film-game)
// 숫자 게퍼 테이프 롤을 드래그 네모로 묶어 합이 딱 10이면 잘려 나감. 지운 컷 수 = 점수, 2분. 규칙·판 생성·검사는 film-score.js(서버와 같음)
// createFilm(root, { best, sound, seed: async () => 씨앗|null, onOver(res), onSound(on) })
//   res = { n, ms, rounds: [가로 칸 수, 끝난 ms, ...묶음], why: 'time'|'clear'|'stuck' }
import { CELLS, TIME_MS, makeGrid, gridAt, enc, cellsIn, hasMove } from './film-score.js';

const INK = '#2a2846';
export function createFilm(root, opt = {}) {
  let best = opt.best || 0, sound = !!opt.sound;
  root.innerHTML = `<div class="ml-top"><span class="ml-chip">점수 <b data-m="sc">0</b></span><span class="ml-chip">최고 <b data-m="best">${best}</b></span><span class="ml-chip ml-tm">남은 시간 <b data-m="tm">${TIME_MS / 1000}</b></span>
      <button type="button" class="btn ghost hr-snd ml-snd" data-m="snd"></button></div>
    <div class="ml-board" data-m="board"><canvas data-m="cv" aria-label="게퍼 10 판"></canvas><div class="ml-bar" aria-hidden="true"><i data-m="tf"></i></div>
      <div class="ml-ov" data-m="ov"></div></div>`;
  const $ = k => root.querySelector(`[data-m="${k}"]`);
  const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), tf = $('tf'), board = $('board'), sndBtn = $('snd');
  let cols = 15, rows = 8, grid = [], score = 0, state = 'ready', cell = 40, dpr = 1, frame = null, drag = null, pops = [], floats = [], raf = 0, dead = false;
  let used = 0, lastAt = 0, lastTm = -1, moves = [], lastSum = -1, busy = false, ac = null, seed0 = 0, bk = 0, boards = 1;
  const clock = () => used + (state === 'play' ? performance.now() - lastAt : 0);   // 멈춘 시간은 뺀 판 시계

  /* ----- 소리(Web Audio 합성, 기본 꺼짐) ----- */
  function au() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
  function tone(f, d, type = 'square', vol = .06, at = 0, f2 = 0) {
    const a = sound && au(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
  }
  function bell(f, at, d, vol) {   // 마림바 같은 맑은 음(부드럽게 시작 → 빠르게 사라짐)
    const a = sound && au(); if (!a) return;
    const t = a.currentTime + at, g = a.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + d); g.connect(a.destination);
    for (const [m, v] of [[1, 1], [4, .12]]) { const o = a.createOscillator(), og = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * m, t); og.gain.value = v; o.connect(og).connect(g); o.start(t); o.stop(t + d + .02); }
  }
  function snip(n) {   // 10 맞춰 깰 때 '도로롱' = 올라가는 맑은 음 여러 개(많이 지울수록 길고 높게), 마지막 음은 길게
    const P = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637, 3136], k = Math.min(Math.max(n + 1, 3), 6), s0 = Math.min(Math.max(n - 2, 0), 3);
    for (let i = 0; i < k; i++) { const last = i === k - 1; bell(P[s0 + i], i * .045, last ? .32 : .09, last ? .09 : .06); }
  }
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
    if (!hasMove(grid, cols)) nextBoard(!grid.some(v => v));   // 막혔거나 다 지움 → 바로 새 판(서버 replay와 같은 순간, 2026-10-30)
    kick();
  };
  const cancel = e => { if (drag && (!e || e.pointerId === drag.id)) { drag = null; kick(); } };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', cancel);

  function nextBoard(all) {
    ({ g: grid, k: bk } = gridAt(seed0, bk + 1, cols)); boards++;
    const now = performance.now(); floats.push({ n: 0, txt: all ? '전부 싹둑! 새 판' : '새 판!', x: cols * cell / 2, y: rows * cell / 2, t: now, big: 1 });
    board.classList.remove('nb'); void board.offsetWidth; board.classList.add('nb');
    tone(660, .08, 'triangle', .06); tone(990, .12, 'triangle', .06, .07);
  }
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
    ov.innerHTML = `${sb('게퍼 10')}<span>드래그로 네모를 그려 숫자 테이프를 묶어요<br>숫자 합이 <em>딱 10</em>이면 싹둑! · 더 묶을 게 없으면 바로 새 판<br>2분 동안 많이 자르기</span><button type="button" class="btn big" data-m="go">시작</button>`;
    $('go').onclick = start; draw();
  }
  async function start() {
    if (busy || dead) return; busy = true;
    const go = $('go'); if (go) { go.disabled = true; go.textContent = '준비 중…'; }
    let seed = null; try { seed = await opt.seed?.(); } catch {}
    busy = false; if (dead) return;
    if (state === 'over') fit();   // 화면 방향이 바뀌었으면 판 모양도 새로(판 번호 계산이 가로 칸 수에 따라 달라서 판 만들기 전에)
    seed0 = seed == null ? Math.floor(Math.random() * 4294967296) : seed; ({ g: grid, k: bk } = gridAt(seed0, 0, cols)); boards = 1;
    score = 0; $('sc').textContent = 0; drag = null; pops = []; floats = []; moves = []; used = 0; lastTm = -1; root.classList.remove('low');
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
    ov.innerHTML = `${sb('시간 끝!')}<p class="ml-sc">${score}<small>개</small></p><span>${boards > 1 ? `${boards}번째 판까지 · ` : ''}${nb ? '최고 기록 경신!' : `내 최고 ${best}개`}</span>
      <small class="ml-msg" data-m="msg"></small><button type="button" class="btn big" data-m="go">한 번 더</button>`;
    $('go').onclick = start;
    opt.onOver?.({ n: score, ms, why, nb, rounds: [cols, ms, ...moves] });
  }
  const blur = () => pause();
  const vis = () => { if (document.hidden) pause(); };
  addEventListener('blur', blur); document.addEventListener('visibilitychange', vis);
  const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe(root);
  grid = makeGrid(Math.floor(Math.random() * 4294967296)); ready(); fit();
  if (opt.quick) start();   // 다시 시작(버튼·R)은 안내 화면 없이 바로 판 시작(2026-10-30 하율 "모든 게임")
  return {
    start, pause,
    msg(html) { const m = $('msg'); if (m) m.innerHTML = html; },
    setBest(b, force) { if (force || b > best) { best = b; $('best').textContent = b; } },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('blur', blur); document.removeEventListener('visibilitychange', vis); try { ac?.close(); } catch {} },
    get st() { return { state, score, cols, rows, cell, grid, moves }; },
    _end() { used = TIME_MS; lastAt = performance.now(); },   // 테스트용: 시간 다 씀
  };
}
