// SVMHS GROUND — 멜론 게임(2026-10-29 하율 "사과 게임을 멜론으로", 미리보기 깃발 melon-game — 개발자만)
// 규칙(Fruit Box 방식): 숫자 1~9 멜론 판에서 드래그로 네모를 그려 합이 딱 10인 묶음을 지움. 지운 개수 = 점수, 2분.
// 가로 화면 17×10, 세로(좁은) 화면 10×17 — 칸 수는 같음(170). 판 숫자 합은 항상 10의 배수.
// 지금은 이 기기 최고 기록만(서버 기록·랭킹·티어는 정식 출시 때 연결).
export const TIME = 120, CELLS = 170;

export function createMelon(root, { best = 0, onBest } = {}) {
  root.innerHTML = `<div class="ml-top"><span class="ml-chip">점수 <b data-m="sc">0</b></span><span class="ml-chip">최고 <b data-m="best">${best}</b></span><span class="ml-chip ml-tm">남은 시간 <b data-m="tm">${TIME}</b></span></div>
    <div class="ml-board" data-m="board"><canvas data-m="cv" aria-label="멜론 게임 판"></canvas><div class="ml-bar" aria-hidden="true"><i data-m="tf"></i></div>
      <div class="ml-ov" data-m="ov"></div></div>`;
  const $ = k => root.querySelector(`[data-m="${k}"]`);
  const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), tf = $('tf'), board = $('board');
  let cols = 17, rows = 10, grid = [], score = 0, state = 'ready', endAt = 0, cell = 40, dpr = 1, sprite = null, drag = null, pops = [], raf = 0, dead = false, lastTm = -1;

  function newGrid() {
    let s;
    do { grid = []; s = 0; for (let i = 0; i < CELLS; i++) { const v = 1 + Math.floor(Math.random() * 9); grid.push(v); s += v; } } while (s % 10);
  }
  function makeSprite() {
    const S = Math.round(cell * dpr), c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), r = S * .43, cx = S / 2, cy = S / 2 + S * .03;
    const grd = g.createRadialGradient(cx - r * .35, cy - r * .4, r * .1, cx, cy, r);
    grd.addColorStop(0, '#c6e89a'); grd.addColorStop(.6, '#8cc95a'); grd.addColorStop(1, '#5f9e36');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();   // 그물무늬
    g.strokeStyle = 'rgba(245,252,225,.55)'; g.lineWidth = Math.max(1, S * .025);
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.ellipse(cx + k * r * .32, cy, r * .18 + Math.abs(k) * r * .05, r * 1.1, 0, 0, 7); g.stroke(); }
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx - r, cy + k * r * .38 + r * .05); g.quadraticCurveTo(cx, cy + k * r * .38 - r * .12, cx + r, cy + k * r * .38 + r * .05); g.stroke(); }
    g.restore();
    g.lineWidth = Math.max(1.5, S * .04); g.strokeStyle = '#2f5a1c'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.strokeStyle = '#5a3d1e'; g.lineWidth = Math.max(2, S * .06); g.lineCap = 'round';   // 꼭지
    g.beginPath(); g.moveTo(cx, cy - r * .92); g.quadraticCurveTo(cx + S * .02, cy - r * 1.12, cx + S * .08, cy - r * 1.18); g.stroke();
    sprite = c;
  }
  function fit() {
    if (dead || !cv.isConnected) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = root.clientWidth - 34, top = board.getBoundingClientRect().top, h = Math.max(260, innerHeight - Math.max(top, 0) - 24);
    if (state !== 'play') { const port = w < 640 && h > w * 1.15; const c = port ? 10 : 17; if (c !== cols) { cols = c; rows = CELLS / c; } }
    cell = Math.max(16, Math.min(54, Math.floor(w / cols), Math.floor(h / rows)));
    cv.style.width = cell * cols + 'px'; cv.style.height = cell * rows + 'px';
    cv.width = cell * cols * dpr; cv.height = cell * rows * dpr;
    makeSprite(); draw();
  }
  const rect = () => drag && { x0: Math.min(drag.x0, drag.x1), x1: Math.max(drag.x0, drag.x1), y0: Math.min(drag.y0, drag.y1), y1: Math.max(drag.y0, drag.y1) };
  function selected() {
    const r = rect(); if (!r) return [];
    const out = [];
    for (let i = 0; i < CELLS; i++) {
      if (!grid[i]) continue;
      const x = (i % cols + .5) * cell, y = (Math.floor(i / cols) + .5) * cell;   // 멜론 가운데가 네모 안에 들면 고른 것
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) out.push(i);
    }
    return out;
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cell * cols, cell * rows);
    const sel = new Set(selected()); let sum = 0; sel.forEach(i => sum += grid[i]);
    const ok = sum === 10;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `900 ${Math.round(cell * .42)}px Outfit,Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
    for (let i = 0; i < CELLS; i++) {
      const v = grid[i]; if (!v) continue;
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell, on = sel.has(i);
      if (on) { ctx.fillStyle = ok ? 'rgba(111,191,63,.3)' : 'rgba(80,140,230,.2)'; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, cell - 2, cell - 2, cell * .2); ctx.fill(); }
      const d = cell * (on ? 1.08 : 1);
      ctx.drawImage(sprite, x + (cell - d) / 2, y + (cell - d) / 2, d, d);
      ctx.lineWidth = Math.max(2, cell * .08); ctx.strokeStyle = '#2f5a1c'; ctx.strokeText(v, x + cell / 2, y + cell * .55);
      ctx.fillStyle = '#fff'; ctx.fillText(v, x + cell / 2, y + cell * .55);
    }
    const now = performance.now();
    pops = pops.filter(p => now - p.t < 320);
    for (const p of pops) { const k = (now - p.t) / 320, d = cell * (1 + k * .6); ctx.globalAlpha = 1 - k; ctx.drawImage(sprite, p.x + (cell - d) / 2, p.y + (cell - d) / 2 - k * cell * .3, d, d); ctx.globalAlpha = 1; }
    const r = rect();
    if (r) {
      ctx.lineWidth = 2; ctx.strokeStyle = ok ? '#3f8f1f' : '#3a6fd0'; ctx.fillStyle = ok ? 'rgba(111,191,63,.12)' : 'rgba(80,140,230,.08)';
      ctx.beginPath(); ctx.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); ctx.fill(); ctx.stroke();
      if (sel.size) {
        const bx = Math.min(r.x1 + 4, cell * cols - 34), by = Math.max(r.y0 - 26, 2);
        ctx.fillStyle = ok ? '#3f8f1f' : sum > 10 ? '#d9534f' : '#3a6fd0'; ctx.beginPath(); ctx.roundRect(bx, by, 30, 22, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 13px sans-serif'; ctx.fillText(String(sum), bx + 15, by + 11.5);
      }
    }
  }
  const pos = e => { const b = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(cell * cols, e.clientX - b.left)), y: Math.max(0, Math.min(cell * rows, e.clientY - b.top)) }; };
  const down = e => { if (state !== 'play' || e.button > 0) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} const p = pos(e); drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, id: e.pointerId }; };
  const move = e => { if (!drag || e.pointerId !== drag.id) return; const p = pos(e); drag.x1 = p.x; drag.y1 = p.y; };
  const up = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const sel = selected(); let sum = 0; sel.forEach(i => sum += grid[i]);
    if (sum === 10 && state === 'play') {
      const t = performance.now();
      sel.forEach(i => { pops.push({ x: (i % cols) * cell, y: Math.floor(i / cols) * cell, t }); grid[i] = 0; });
      score += sel.length; $('sc').textContent = score;
      if (!grid.some(v => v)) end();
    }
    drag = null;
  };
  const cancel = () => { drag = null; };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', cancel);

  function loop() {
    raf = 0; if (dead) return;
    if (state === 'play') {
      const left = Math.max(0, (endAt - performance.now()) / 1000), s = Math.ceil(left);
      if (s !== lastTm) { lastTm = s; $('tm').textContent = s; root.classList.toggle('low', left <= 20); }
      tf.style.setProperty('--t', (left / TIME).toFixed(4));   // CSP: style 속성 대신 CSSOM
      if (left <= 0) end();
    }
    draw();
    if (state === 'play' || pops.length) raf = requestAnimationFrame(loop);
  }
  function ready() {
    state = 'ready'; ov.hidden = false; ov.className = 'ml-ov';
    ov.innerHTML = `<b>멜론 게임</b><span>드래그로 네모를 그려 멜론을 묶어요<br>숫자 합이 <em>딱 10</em>이면 사라져요 · 2분</span><button type="button" class="btn big" data-m="go">시작</button>`;
    $('go').onclick = start;
  }
  function start() {
    newGrid(); score = 0; $('sc').textContent = 0; drag = null; pops = []; lastTm = -1; root.classList.remove('low');
    state = 'play'; endAt = performance.now() + TIME * 1000; ov.hidden = true; fit();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function end() {
    if (state !== 'play') return;
    state = 'over'; drag = null;
    const nb = score > best; if (nb) { best = score; $('best').textContent = best; onBest?.(best); }
    ov.hidden = false; ov.className = 'ml-ov end';
    ov.innerHTML = `<b>${score === CELLS ? '전부 지웠어요!' : '시간 끝!'}</b><p class="ml-sc">${score}<small>개</small></p><span>${nb ? '최고 기록 경신!' : `내 최고 ${best}개`}</span><button type="button" class="btn big" data-m="go">한 번 더</button>`;
    $('go').onclick = start;
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe(board);
  newGrid(); ready(); fit();
  const api = {
    start, restart: start,
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); },
    get st() { return { state, score, cols, cell, grid }; },
    _end() { endAt = 0; },   // 테스트용
  };
  return api;
}
