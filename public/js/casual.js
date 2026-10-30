// SVMHS GROUND — 캐주얼 게임(2026-10-29 하율: "구글 플레이 게임즈 미니 게임처럼 캐주얼로 분류 — 내 화면에만", 미리보기 깃발 casual-games)
// 학교 컨셉에 맞추기 어려운 고전 게임은 규칙 그대로 가볍게. 랭킹·티어·뽑기권·업적·미션과 상관없음 — 이 기기 최고 기록만(sg_cz_*).
// 게임: 지뢰찾기(mine) · 뱀(snake) · 2048(n2048). social.js playCasual이 mount(k, el)로 붙이고 destroy()로 정리.
import { store } from './util.js';
import * as Z from './cz-score.js';   // 랭크전 규칙(2026-10-29 하율 "모든 게임을 랭크에") — 서버가 같은 규칙으로 다시 둬 봄

export const CASUAL = {
  mine: { name: '지뢰찾기', ic: 'mine', desc: '숫자를 보고 지뢰를 피해 칸을 모두 열기' },
  snake: { name: '뱀 게임', ic: 'snake', desc: '별을 먹고 길어지기 · 벽과 내 몸에 부딪히면 끝' },
  n2048: { name: '2048', ic: '2048', desc: '같은 숫자를 밀어 합쳐 2048 만들기' },
};

const modalOpen = () => !!document.querySelector('.modal.open');
const typing = e => e.target.closest?.('input,textarea,select,[contenteditable]');
const DIRS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 위·오른쪽·아래·왼쪽 [dx, dy]
// 가로 패드 + 깃발 pad-ctl(html.padin) → 뱀 방향 버튼을 판 오른쪽에(CSS '패드 조작 버튼')
const PAD_SIDE = matchMedia('(pointer:coarse) and (min-width:700px) and (min-height:600px) and (orientation:landscape)');
const padSide = () => document.documentElement.classList.contains('padin') && PAD_SIDE.matches;
const fmtS = ms => (ms / 1000).toFixed(1) + '초';
// 화면에 남은 높이(위 제목 줄·아래 다시 시작 줄을 뺀 것) — 스크롤 없이 한 화면(2026-10-28 하율 규칙)
function roomOf(root, extra = 70) {
  const top = (root.closest('.parea') || root).getBoundingClientRect().top, bar = root.querySelector('.cz-bar')?.offsetHeight || 0;
  return { w: root.clientWidth || 320, h: Math.max(200, innerHeight - top - bar - extra) };
}
// 스와이프 → 방향(0~3). 판 위에서 손가락을 떼지 않고 계속 밀어도 이어서 받음(continuous)
function swipe(el, onDir, continuous = false) {
  let x0 = 0, y0 = 0, on = false;
  const down = e => { on = true; x0 = e.clientX; y0 = e.clientY; };
  const move = e => {
    if (!on) return;
    const dx = e.clientX - x0, dy = e.clientY - y0, th = continuous ? 18 : 26;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
    onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    if (continuous) { x0 = e.clientX; y0 = e.clientY; } else on = false;
  };
  const up = () => { on = false; };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  return () => { removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
}

// rk = { seed(game) → 시작 티켓(없으면 null), done(game, 값, rounds) → 결과 문구 } — 로그인했을 때만(없으면 자유 모드만)
export function mount(k, el, rk = null) {
  el.classList.add('cz-' + k);
  return k === 'mine' ? mine(el, rk) : k === 'snake' ? snake(el, rk) : n2048(el, rk);
}
// 랭크전 / 자유 전환(랭크전 = 모두 같은 규칙 · 서버가 다시 둬 보고 순위·티어에 · 자유 = 지금처럼 이 기기 기록만)
// 2026-10-30 하율 "일반 모드와 랭크 모드는 플레이할 때 제대로 보고 고를 수 있게": 맨 위 한 줄 크게 + 지금 모드가 무엇에 반영되는지 한 줄 (모든 게임 같은 모양 .md-pick)
const RK_TXT = { mine: '중급 고정 · 클리어 시간', snake: '모은 별 수', n2048: '3분 점수' };
const modeBar = (rk, k) => rk ? `<div class="md-pick" role="group" aria-label="게임 모드"><button type="button" data-md="rk"><b><svg class="sic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-trophy"/></svg>랭크</b><small>${RK_TXT[k]} · 티어·순위·기록실</small></button><button type="button" data-md="free"><b>일반</b><small>${k === 'mine' ? '난이도 자유 · ' : k === 'n2048' ? '시간 제한·되돌리기 자유 · ' : ''}이 기기에만 기록</small></button></div>` : '';
const rkOn = (k, rk) => !!rk && store.get('cz_md_' + k, 'rk') === 'rk';
function bindMode(el, k, rk, onChange) {
  const bs = el.querySelectorAll('[data-md]'), paint = () => { bs.forEach(b => { const on = (b.dataset.md === 'rk') === rkOn(k, rk); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); el.dataset.md = rkOn(k, rk) ? 'rk' : 'free'; };
  bs.forEach(b => b.onclick = () => { store.set('cz_md_' + k, b.dataset.md); paint(); onChange(); }); paint();
}
const say = (el, h) => { const p = el.querySelector('.cz-rkmsg'); if (p) { p.innerHTML = h || ''; p.hidden = !h; } };
const RKMSG = '<p class="cz-rkmsg" hidden></p>';

/* ===================== 지뢰찾기 ===================== */
// 첫 칸은 항상 안전(그 주변 8칸까지 지뢰 없음) · 깃발 = 오른쪽 클릭 / 길게 누르기 / 깃발 모드 · 숫자 칸 누르면 주변 열기(깃발 수가 맞을 때)
const MLV = { e: ['초급', 9, 9, 10], m: ['중급', 16, 16, 40], h: ['고급', 30, 16, 99] };
const SV_FLAG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3v14" stroke="#173048" stroke-width="2.2" stroke-linecap="round"/><path d="M6.6 3.6l8.6 3.3-8.6 3.4z" fill="#ff6b6b" stroke="#173048" stroke-width="1.6" stroke-linejoin="round"/><path d="M3.6 17h5.4" stroke="#173048" stroke-width="2.2" stroke-linecap="round"/></svg>';
const SV_MINE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.4v15.2M2.4 10h15.2M4.6 4.6l10.8 10.8M15.4 4.6 4.6 15.4" stroke="#173048" stroke-width="1.9" stroke-linecap="round"/><circle cx="10" cy="10" r="5.2" fill="#2a3550" stroke="#173048" stroke-width="1.4"/><circle cx="8.3" cy="8.3" r="1.5" fill="#fff"/></svg>';
function mine(el, rk) {
  let lv = store.get('cz_mine_lv', 'e'); if (!MLV[lv]) lv = 'e';
  let W, H, M, cells, els, opened, flags, started, over, t0, tEnd, tick = 0, fmode = false, lp = 0, lpHit = false, px = 0, py = 0, rkm = false, rseed = null, rec = [], runN = 0;
  el.innerHTML = `${modeBar(rk, 'mine')}<div class="cz-bar"><div class="cz-seg cz-lv" role="group" aria-label="난이도">${Object.entries(MLV).map(([k, v]) => `<button type="button" data-lv="${k}">${v[0]}</button>`).join('')}</div>
    <span class="cz-stat"><b class="cz-cnt" id="mnC">0</b><small>남은 지뢰</small></span><span class="cz-stat"><b id="mnT">0.0초</b><small id="mnB">최고 -</small></span>
    <button type="button" class="cz-flag" id="mnF" aria-pressed="false">${SV_FLAG}<span>깃발</span></button></div>
    <div class="cz-wrap"><div class="cz-in"><div class="cz-mb" id="mnBd" role="grid" aria-label="지뢰찾기 판"></div><div class="cz-ov" id="mnOv" hidden></div></div></div>
    ${RKMSG}<p class="cz-help">오른쪽 클릭·길게 누르기·깃발 버튼으로 깃발 · 숫자 칸을 누르면 주변을 한 번에 열어요</p>`;
  const bd = el.querySelector('#mnBd'), ov = el.querySelector('#mnOv'), $c = el.querySelector('#mnC'), $t = el.querySelector('#mnT'), $b = el.querySelector('#mnB'), $f = el.querySelector('#mnF');
  const nb = i => { const x = i % W, y = (i / W) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (a >= 0 && a < W && b >= 0 && b < H) o.push(b * W + a); } return o; };
  const bestKey = () => 'cz_mine_' + lv;
  const paintBest = () => { const b = store.get(bestKey(), 0); $b.textContent = b ? '최고 ' + fmtS(b) : '최고 -'; };
  function fit() {
    const r = roomOf(el, 140);
    const cs = Math.max(18, Math.min(48, Math.floor((r.w - 12) / W), Math.floor((r.h - 12) / H)));
    bd.style.setProperty('--cs', cs + 'px'); bd.style.setProperty('--cols', W);
  }
  function setup() {
    rkm = rkOn('mine', rk); rec = []; const my = ++runN; say(el, '');
    el.querySelector('.cz-lv').hidden = rkm;
    if (rkm) { rseed = undefined; rk.seed('mine').then(t => { if (my === runN) { rseed = t ? Z.seedOf(t) : null; if (rseed == null) say(el, '이번 판은 서버에 등록되지 않아 기록이 저장되지 않아요'); } }); }
    let [, w, h, m] = MLV[rkm ? 'm' : lv];   // 랭크전은 중급 고정
    if (!rkm && lv === 'h' && el.clientWidth < 640) [w, h] = [h, w];   // 고급은 좁은 화면에서 세로로(16×30)
    W = w; H = h; M = m; cells = Array.from({ length: W * H }, () => ({ m: 0, n: 0, o: 0, f: 0 }));
    opened = flags = 0; started = over = false; t0 = tEnd = 0; ov.hidden = true;
    bd.innerHTML = cells.map((_, i) => `<i data-i="${i}" role="gridcell"></i>`).join(''); els = [...bd.children];
    el.querySelectorAll('[data-lv]').forEach(b => b.classList.toggle('on', b.dataset.lv === lv));
    fit(); paintCnt(); paintT(); paintBest();
    if (rkm) $b.textContent = '랭크 · 중급';
  }
  const paintCnt = () => { $c.textContent = M - flags; };
  const paintT = () => { $t.textContent = fmtS(started ? (tEnd || performance.now()) - t0 : 0); };
  function paint(i) {
    const c = cells[i], e = els[i];
    e.className = c.o ? 'o' + (c.m ? ' m' : '') : c.f ? 'f' : '';
    if (c.o && !c.m && c.n) { e.dataset.n = c.n; e.textContent = c.n; } else if (c.o && c.m) e.innerHTML = SV_MINE; else if (c.f) e.innerHTML = SV_FLAG; else { e.textContent = ''; delete e.dataset.n; }
  }
  function lay(safe) {
    if (rkm && rseed != null) {   // 랭크전: 이 판 티켓 씨앗 + 첫 칸으로 지뢰 배치(서버도 똑같이 만들어 봄)
      const mm = Z.mineLay(Z.rng(rseed), W, H, M, safe); cells.forEach((c, i) => { c.m = mm[i]; });
      cells.forEach((c, i) => { c.n = nb(i).reduce((s, j) => s + cells[j].m, 0); });
      started = true; t0 = performance.now(); tick = setInterval(paintT, 100); return;
    }
    const ban = new Set([safe, ...(W * H - 9 >= M ? nb(safe) : [])]), pool = [];
    for (let i = 0; i < W * H; i++) if (!ban.has(i)) pool.push(i);
    for (let k = 0; k < M; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; cells[pool[k]].m = 1; }
    cells.forEach((c, i) => { c.n = nb(i).reduce((s, j) => s + cells[j].m, 0); });
    started = true; t0 = performance.now(); tick = setInterval(paintT, 100);
  }
  function open(i) {
    const st = [i];
    while (st.length) {
      const j = st.pop(), c = cells[j]; if (c.o || c.f) continue;
      c.o = 1; paint(j);
      if (c.m) { lose(j); return; }
      opened++; if (!c.n) nb(j).forEach(q => { if (!cells[q].o && !cells[q].f) st.push(q); });
    }
    if (opened === W * H - M) win();
  }
  function act(i, flag) {
    if (over) return; const c = cells[i];
    if (flag) { if (c.o) return; c.f ^= 1; flags += c.f ? 1 : -1; paint(i); paintCnt(); return; }
    if (c.f) return;
    if (rkm && rseed === undefined) return;   // 랭크전 판 준비 중(티켓 받는 중)
    if (!started) lay(i);
    const mark = q => { if (rkm && rseed != null && !cells[q].o && !cells[q].f) rec.push((rec.length ? Math.max(1, Math.round(performance.now() - t0)) : 0) * 1000 + q); };
    if (c.o) {   // 숫자 칸 → 주변 열기
      if (!c.n) return; const ns = nb(i);
      if (ns.filter(q => cells[q].f).length !== c.n) { ns.forEach(q => { if (!cells[q].o && !cells[q].f) { els[q].classList.add('hl'); setTimeout(() => els[q]?.classList.remove('hl'), 160); } }); return; }
      ns.forEach(q => { if (!over) { mark(q); open(q); } }); return;
    }
    mark(i); open(i);
  }
  function end() { over = true; tEnd = performance.now(); clearInterval(tick); paintT(); }
  function lose(i) {
    end(); els[i].classList.add('x');
    cells.forEach((c, j) => { if (c.m && !c.o && !c.f) { c.o = 1; paint(j); } else if (c.f && !c.m) els[j].classList.add('w'); });
    bd.classList.add('boom'); setTimeout(() => bd.classList.remove('boom'), 400);
    navigator.vibrate?.(60);
    showOv('<b>펑!</b><span>지뢰를 밟았어요</span>');
  }
  function win() {
    end(); cells.forEach((c, j) => { if (c.m && !c.f) { c.f = 1; paint(j); } }); flags = M; paintCnt();
    if (rkm) {   // 랭크전: 마지막으로 연 시각 = 기록 → 서버가 다시 열어 보고 저장
      const v = Math.floor(rec[rec.length - 1] / 1000);
      showOv(`<b>성공!</b><span>${fmtS(v)} · 랭크</span>`, true);
      if (rseed != null) { say(el, '기록 저장 중…'); rk.done('mine', v, [rec[0] % 1000, ...rec]).then(h => say(el, h)); }
      return;
    }
    const t = tEnd - t0, b = store.get(bestKey(), 0), nb2 = !b || t < b; if (nb2) store.set(bestKey(), Math.round(t)); paintBest();
    showOv(`<b>성공!</b><span>${fmtS(t)}${nb2 ? ' · 최고 기록!' : ''}</span>`, true);
  }
  function showOv(h, good = false) {
    ov.innerHTML = `<div class="cz-card${good ? ' good' : ''}">${h}<button type="button" class="btn" data-again>다시 하기</button></div>`; ov.hidden = false;
    ov.querySelector('[data-again]').onclick = setup;
  }
  const cellOf = e => { const t = e.target.closest('i[data-i]'); return t && bd.contains(t) ? +t.dataset.i : -1; };
  bd.addEventListener('contextmenu', e => { e.preventDefault(); const i = cellOf(e); if (i >= 0 && e.pointerType !== 'touch') act(i, true); });
  bd.addEventListener('pointerdown', e => {
    const i = cellOf(e); if (i < 0 || e.button > 0) return;
    lpHit = false; px = e.clientX; py = e.clientY; clearTimeout(lp);
    els[i].classList.add('pr');
    if (e.pointerType !== 'mouse') lp = setTimeout(() => { lpHit = true; els[i].classList.remove('pr'); act(i, !fmode); navigator.vibrate?.(15); }, 380);   // 길게 누르기 = 깃발(깃발 모드면 열기)
  });
  bd.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - px, e.clientY - py) > 10) { clearTimeout(lp); bd.querySelectorAll('.pr').forEach(x => x.classList.remove('pr')); } });
  bd.addEventListener('pointerup', e => {
    clearTimeout(lp); bd.querySelectorAll('.pr').forEach(x => x.classList.remove('pr'));
    const i = cellOf(e); if (i < 0 || e.button > 0 || lpHit) return;
    act(i, fmode);
  });
  bd.addEventListener('pointerleave', () => { clearTimeout(lp); bd.querySelectorAll('.pr').forEach(x => x.classList.remove('pr')); });
  $f.onclick = () => { fmode = !fmode; $f.classList.toggle('on', fmode); $f.setAttribute('aria-pressed', fmode); };
  el.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { lv = b.dataset.lv; store.set('cz_mine_lv', lv); clearInterval(tick); setup(); });
  const onRs = () => fit(); addEventListener('resize', onRs);
  bindMode(el, 'mine', rk, () => { clearInterval(tick); setup(); });
  setup();
  return { destroy() { runN++; clearInterval(tick); clearTimeout(lp); removeEventListener('resize', onRs); }, restart() { clearInterval(tick); setup(); } };
}

/* ===================== 뱀 게임 ===================== */
// 17×15 판, 방향키·WASD·스와이프·화면 버튼. 별(사이트 로고 별)을 먹으면 한 칸 길어지고 조금씩 빨라짐. 창을 벗어나면 멈춤
function snake(el, rk) {
  const W = 17, H = 15;
  el.innerHTML = `${modeBar(rk, 'snake')}<div class="cz-bar"><span class="cz-stat"><b id="snS">0</b><small>점수</small></span><span class="cz-stat"><b id="snB">${store.get('cz_snake', 0)}</b><small>최고</small></span></div>
    <div class="cz-wrap"><div class="cz-in"><canvas class="cz-cv" id="snCv" aria-label="뱀 게임 판"></canvas><div class="cz-ov" id="snOv"></div></div></div>
    <div class="cz-pad" aria-label="방향 버튼"><button type="button" data-d="0" aria-label="위">▲</button><button type="button" data-d="3" aria-label="왼쪽">◀</button><button type="button" data-d="2" aria-label="아래">▼</button><button type="button" data-d="1" aria-label="오른쪽">▶</button></div>${RKMSG}`;
  const cv = el.querySelector('#snCv'), cx = cv.getContext('2d'), ov = el.querySelector('#snOv'), $s = el.querySelector('#snS'), $b = el.querySelector('#snB');
  let cs = 24, body, prev, dir, q, food, score, step, acc, last, raf = 0, state, dieT = 0, rkm = false, rseed = null, rand = Math.random, tk = 0, rec = [], runN = 0;   // state: wait(랭크전 판 준비) | ready | run | pause | dead
  function fit() {
    const side = padSide(), r = roomOf(el, matchMedia('(pointer:fine)').matches || side ? 110 : 220);   // 가로 패드(깃발 pad-ctl): 방향 버튼이 판 오른쪽이라 아래 자리를 비우지 않음
    cs = Math.max(14, Math.min(34, Math.floor(r.w / W), side ? Math.floor((innerWidth - 2 * 250) / W) : 99, Math.floor(r.h / H)));
    const d = devicePixelRatio || 1; cv.width = W * cs * d; cv.height = H * cs * d; cv.style.width = W * cs + 'px'; cv.style.height = H * cs + 'px'; el.style.setProperty('--bw', W * cs + 'px');
    cx.setTransform(d, 0, 0, d, 0, 0); draw(1);
  }
  function reset() {
    const y = (H / 2) | 0; body = [[5, y], [4, y], [3, y]]; prev = body.map(p => [...p]);
    dir = 1; q = []; score = 0; step = 135; acc = 0; $s.textContent = 0; tk = 0; rec = []; food = null; say(el, '');
    rkm = rkOn('snake', rk); const my = ++runN;
    const ready = () => { place(); state = 'ready'; showOv(`<b>뱀 게임${rkm ? ' · 랭크' : ''}</b><span>방향키 · 스와이프 · ${padSide() ? '오른쪽' : '아래'} 버튼으로 시작</span>`); draw(1); };
    if (!rkm) { rand = Math.random; rseed = null; ready(); return; }
    state = 'wait'; showOv('<b>뱀 게임 · 랭크</b><span>판 준비 중…</span>'); draw(1);
    rk.seed('snake').then(t => { if (my !== runN) return; rseed = t ? Z.seedOf(t) : null; rand = rseed != null ? Z.rng(rseed) : Math.random; if (rseed == null) say(el, '이번 판은 서버에 등록되지 않아 기록이 저장되지 않아요'); ready(); });
  }
  function place() { food = Z.snakeFood(rand, body, W, H); }   // 랭크전이면 씨앗으로(서버도 같은 자리)
  function showOv(h) { ov.innerHTML = `<div class="cz-card">${h}</div>`; ov.hidden = false; }
  function turn(d) {
    if (state === 'wait' || state === 'gone') return;
    if (state === 'dead') { if (performance.now() - dieT > 450) { reset(); if (state !== 'wait') turn(d); } return; }
    const lastD = q.length ? q[q.length - 1] : dir;
    if (d === lastD || (d + 2) % 4 === lastD) { if (state !== 'run' && (d + 2) % 4 !== dir) start(); return; }
    if (q.length < 3) q.push(d);
    if (state !== 'run') start();
  }
  function start() { if (state === 'run' || state === 'wait' || state === 'dead') return; state = 'run'; ov.hidden = true; last = performance.now(); acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  function pause() { if (state !== 'run') return; state = 'pause'; showOv('<b>멈춤</b><span>방향키나 버튼을 누르면 계속해요</span>'); }
  function tickOne() {
    tk++;
    if (q.length) { dir = q.shift(); if (rkm) rec.push(tk * 4 + dir); }
    const [hx, hy] = body[0], nx = hx + DV[dir][0], ny = hy + DV[dir][1];
    const eat = food && nx === food[0] && ny === food[1];
    const hit = nx < 0 || ny < 0 || nx >= W || ny >= H || body.some(([x, y], i) => x === nx && y === ny && (eat || i < body.length - 1));
    if (hit) { die(); return; }
    prev = body.map(p => [...p]); body.unshift([nx, ny]);
    if (eat) { score++; $s.textContent = score; step = Math.max(78, step - 2.5); place(); navigator.vibrate?.(8); if (!food) { die(true); return; } } else body.pop();
  }
  function die(full = false) {
    state = 'dead'; dieT = performance.now(); prev = body.map(p => [...p]);
    const b = store.get('cz_snake', 0), nb = !rkm && score > b; if (nb) { store.set('cz_snake', score); $b.textContent = score; }
    if (!full) navigator.vibrate?.(50);
    if (rkm && rseed != null) { if (score > 0) { say(el, '기록 저장 중…'); rk.done('snake', Z.SNAKE_MAX - score, [tk, ...rec]).then(h => say(el, h)); } else say(el, '별을 하나 이상 먹어야 기록돼요'); }
    draw(1);
    showOv(`<b>${full ? '판을 가득 채웠어요!' : '끝!'}</b><span>별 ${score}개${nb ? ' · 최고 기록!' : ''}</span><small>방향키·스와이프로 다시 시작</small>`);
  }
  function loop(t) {
    if (state !== 'run') return;
    acc += Math.min(100, t - last); last = t;
    while (acc >= step && state === 'run') { acc -= step; tickOne(); }
    draw(state === 'run' ? acc / step : 1);
    if (state === 'run') raf = requestAnimationFrame(loop);
  }
  function star(x, y, r) {
    cx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .46 : r; cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    cx.closePath(); cx.fillStyle = '#ffd24a'; cx.fill(); cx.lineWidth = Math.max(1.5, cs * .08); cx.strokeStyle = '#173048'; cx.lineJoin = 'round'; cx.stroke();
  }
  function draw(t) {
    if (!body) return;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { cx.fillStyle = (x + y) % 2 ? '#d7ecfb' : '#e6f4fd'; cx.fillRect(x * cs, y * cs, cs, cs); }
    if (food) { const p = .9 + .1 * Math.sin(performance.now() / 180); star((food[0] + .5) * cs, (food[1] + .5) * cs, cs * .46 * p); }
    const pts = body.map((p, i) => { const a = prev[i] || prev[prev.length - 1]; return [(a[0] + (p[0] - a[0]) * t + .5) * cs, (a[1] + (p[1] - a[1]) * t + .5) * cs]; });
    const path = () => { cx.beginPath(); pts.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); };
    cx.lineCap = cx.lineJoin = 'round';
    path(); cx.strokeStyle = '#173048'; cx.lineWidth = cs * .8; cx.stroke();
    path(); cx.strokeStyle = state === 'dead' ? '#8aa3b8' : '#2f8fe0'; cx.lineWidth = cs * .58; cx.stroke();
    path(); cx.strokeStyle = 'rgba(255,255,255,.28)'; cx.lineWidth = cs * .16; cx.stroke();
    const [hx, hy] = pts[0], [ex, ey] = DV[dir], sx = -ey, sy = ex;   // 눈: 보는 방향 양옆
    for (const s of [1, -1]) {
      const x = hx + ex * cs * .12 + sx * s * cs * .17, y = hy + ey * cs * .12 + sy * s * cs * .17;
      cx.beginPath(); cx.arc(x, y, cs * .13, 0, 7); cx.fillStyle = '#fff'; cx.fill();
      cx.beginPath(); cx.arc(x + ex * cs * .04, y + ey * cs * .04, cs * (state === 'dead' ? .03 : .065), 0, 7); cx.fillStyle = '#173048'; cx.fill();
    }
  }
  const onKey = e => {
    if (modalOpen() || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const d = DIRS[e.code]; if (d == null) { if ((e.code === 'Space' || e.code === 'Enter') && state !== 'run') { e.preventDefault(); if (state === 'dead') turn(dir); else if (state === 'pause' || state === 'ready') start(); } return; }
    e.preventDefault(); turn(d);
  };
  const onBlur = () => pause(), onVis = () => { if (document.hidden) pause(); };
  document.addEventListener('keydown', onKey); addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onVis);
  const unSw = swipe(el.querySelector('.cz-wrap'), turn, true);
  el.querySelector('.cz-wrap').style.touchAction = 'none';
  el.querySelectorAll('[data-d]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); turn(+b.dataset.d); }));
  const onRs = () => fit(); addEventListener('resize', onRs);
  bindMode(el, 'snake', rk, () => { cancelAnimationFrame(raf); reset(); });
  reset(); fit();
  return { restart() { cancelAnimationFrame(raf); reset(); }, destroy() { runN++; state = 'gone'; cancelAnimationFrame(raf); unSw(); document.removeEventListener('keydown', onKey); removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onRs); } };
}

/* ===================== 2048 ===================== */
// 4×4, 방향키·WASD·스와이프. 판은 이 기기에 저장돼 나갔다 와도 이어서(sg_cz_2048s) · 한 번 되돌리기
function n2048(el, rk) {
  const N = 4, ANI = 110;
  el.innerHTML = `${modeBar(rk, 'n2048')}<div class="cz-bar"><span class="cz-stat"><b id="tzS">0</b><small>점수</small></span><span class="cz-stat" id="tzTw" hidden><b id="tzT">3:00</b><small>남은 시간</small></span><span class="cz-stat" id="tzBw"><b id="tzB">${store.get('cz_2048', 0).toLocaleString('ko-KR')}</b><small>최고</small></span>
    <button type="button" class="cz-flag" id="tzU" disabled><span>되돌리기</span></button><button type="button" class="cz-flag" id="tzN"><span>새 게임</span></button></div>
    <div class="cz-wrap"><div class="cz-tb" id="tzBd"><div class="cz-tbg">${'<i></i>'.repeat(N * N)}</div><div class="cz-tl" id="tzL"></div><div class="cz-ov" id="tzOv" hidden></div></div></div>
    ${RKMSG}<p class="cz-help">방향키 · WASD · 스와이프로 밀어서 같은 숫자를 합쳐요</p>`;
  const bd = el.querySelector('#tzBd'), layer = el.querySelector('#tzL'), ov = el.querySelector('#tzOv'), $s = el.querySelector('#tzS'), $b = el.querySelector('#tzB'), $u = el.querySelector('#tzU');
  let grid, score, won, keepGoing, busy = false, undo = null, cs = 80, gap = 10, uid = 0;
  // 랭크전(2026-10-29): 3분 · 되돌리기·이어 하기 없음 · 새 칸은 티켓 씨앗으로(서버가 민 기록대로 다시 밀어 봄)
  let rkm = false, rseed = null, rand = Math.random, rec = [], t0 = 0, over = false, tmr = 0, runN = 0;
  const $tw = el.querySelector('#tzTw'), $tt = el.querySelector('#tzT'), $bw = el.querySelector('#tzBw');
  const empty = () => Array.from({ length: N }, () => Array(N).fill(null));
  const pos = (r, c) => `translate(${c * (cs + gap) + gap}px,${r * (cs + gap) + gap}px)`;
  function fit() {
    const r = roomOf(el, 70), S = Math.max(240, Math.min(460, r.w, r.h));
    gap = Math.round(S * .028); cs = (S - gap * (N + 1)) / N;
    bd.style.setProperty('--S', S + 'px'); bd.style.setProperty('--cs', cs + 'px'); bd.style.setProperty('--gap', gap + 'px');
    layer.querySelectorAll('.t').forEach(e => { e.style.transform = pos(+e.dataset.r, +e.dataset.c); });
  }
  function tileEl(t, cls = '') {
    const e = document.createElement('div'); e.className = 't ' + cls; e.dataset.r = t.r; e.dataset.c = t.c;
    e.innerHTML = '<b></b>'; setV(e, t.v); e.style.transform = pos(t.r, t.c); layer.appendChild(e); t.el = e; return e;
  }
  function setV(e, v) { e.dataset.v = v > 2048 ? 'big' : v; e.firstChild.textContent = v; e.firstChild.className = v >= 1024 ? 'l4' : v >= 128 ? 'l3' : ''; }
  function add() {
    const fr = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) fr.push([r, c]);
    if (!fr.length) return; const [r, c] = fr[(rand() * fr.length) | 0];
    const t = { id: ++uid, v: rand() < .9 ? 2 : 4, r, c }; grid[r][c] = t; tileEl(t, 'nw');
  }
  const snap = () => ({ g: grid.map(row => row.map(t => t && t.v)), s: score, w: won, k: keepGoing });
  function load(sv) {
    layer.innerHTML = ''; grid = empty(); score = sv?.s || 0; won = !!sv?.w; keepGoing = !!sv?.k; ov.hidden = true;
    if (sv?.g) sv.g.forEach((row, r) => row.forEach((v, c) => { if (v) { const t = { id: ++uid, v, r, c }; grid[r][c] = t; tileEl(t); } }));
    else { add(); add(); }
    $s.textContent = score.toLocaleString('ko-KR');
  }
  const save = () => { if (!rkm) store.set('cz_2048s', snap()); };
  const paintTm = () => { const left = Math.max(0, Z.N2_TIME - (t0 ? performance.now() - t0 : 0)), sc = Math.ceil(left / 1000); $tt.textContent = Math.floor(sc / 60) + ':' + String(sc % 60).padStart(2, '0'); if (t0 && left <= 0) finish(); };
  function finish() {
    if (over) return; over = true; clearInterval(tmr);
    const end = Math.min(Z.N2_TIME, Math.round(performance.now() - t0));
    showOv(`<b>${end >= Z.N2_TIME ? '시간 끝!' : '더 밀 수 없어요'}</b><span>랭크 ${score.toLocaleString('ko-KR')}점</span>`, [['새 게임', newGame]]);
    if (rseed == null) return;
    if (!rec.length) { say(el, '한 번 이상 밀어야 기록돼요'); return; }
    say(el, '기록 저장 중…'); rk.done('n2048', Z.N2_MAX - score, [end, ...rec]).then(h => say(el, h));
  }
  function newGame() {
    undo = null; $u.disabled = true; clearInterval(tmr); t0 = 0; over = false; rec = []; say(el, '');
    rkm = rkOn('n2048', rk); $u.hidden = rkm; $tw.hidden = !rkm; $bw.hidden = rkm; const my = ++runN;
    if (!rkm) { rand = Math.random; rseed = null; store.set('cz_2048s', null); load(null); save(); return; }
    layer.innerHTML = ''; grid = empty(); score = 0; $s.textContent = 0; paintTm(); busy = true;
    showOv('<b>2048 · 랭크</b><span>판 준비 중…</span>', []);
    rk.seed('n2048').then(t => {
      if (my !== runN) return; busy = false; rseed = t ? Z.seedOf(t) : null; rand = rseed != null ? Z.rng(rseed) : Math.random;
      if (rseed == null) say(el, '이번 판은 서버에 등록되지 않아 기록이 저장되지 않아요');
      load(null); showOv('<b>2048 · 랭크</b><span>3분 동안 최고 점수! 처음 밀면 시간이 흘러요 · 되돌리기 없음</span>', [['시작', () => { ov.hidden = true; }]], true);
    });
  }
  function canMove() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const t = grid[r][c]; if (!t) return true; if (c < N - 1 && grid[r][c + 1]?.v === t.v) return true; if (r < N - 1 && grid[r + 1][c]?.v === t.v) return true; }
    return false;
  }
  function move(d) {
    if (busy || !ov.hidden || (rkm && over)) return;
    const [dc, dr] = DV[d], before = snap(), merged = new Set(), gone = [];
    let moved = false, gain = 0;
    const rs = [...Array(N).keys()], cs2 = [...Array(N).keys()]; if (dr === 1) rs.reverse(); if (dc === 1) cs2.reverse();
    for (const r of rs) for (const c of cs2) {
      const t = grid[r][c]; if (!t) continue;
      let nr = r, nc = c;
      while (true) { const a = nr + dr, b = nc + dc; if (a < 0 || b < 0 || a >= N || b >= N) break; const o = grid[a][b]; if (!o) { nr = a; nc = b; continue; } if (o.v === t.v && !merged.has(o)) { nr = a; nc = b; } break; }
      if (nr === r && nc === c) continue;
      moved = true; grid[r][c] = null;
      const o = grid[nr][nc];
      if (o) { o.v *= 2; gain += o.v; merged.add(o); gone.push(t); }
      else grid[nr][nc] = t;
      t.r = nr; t.c = nc; t.el.dataset.r = nr; t.el.dataset.c = nc; t.el.style.transform = pos(nr, nc);
    }
    if (!moved) { bd.classList.remove('nope'); void bd.offsetWidth; bd.classList.add('nope'); return; }
    if (rkm) { if (!t0) { t0 = performance.now(); tmr = setInterval(paintTm, 200); } rec.push(Math.round(performance.now() - t0) * 4 + d); }
    else { undo = before; $u.disabled = false; }
    busy = true; score += gain;
    setTimeout(() => {
      gone.forEach(t => t.el.remove());
      merged.forEach(o => { setV(o.el, o.v); o.el.classList.remove('mg', 'nw'); void o.el.offsetWidth; o.el.classList.add('mg'); });
      add(); busy = false;
      $s.textContent = score.toLocaleString('ko-KR');
      if (gain) { const p = document.createElement('span'); p.className = 'cz-plus'; p.textContent = '+' + gain; $s.parentElement.appendChild(p); setTimeout(() => p.remove(), 700); }
      if (!rkm && score > store.get('cz_2048', 0)) { store.set('cz_2048', score); $b.textContent = score.toLocaleString('ko-KR'); }
      save();
      if (rkm) { if (!canMove()) finish(); return; }   // 랭크전: 2048 축하 창 없이 계속 · 막히면 끝
      if (!won && [...merged].some(o => o.v >= 2048)) { won = true; save(); showOv('<b>2048!</b><span>해냈어요! 더 큰 숫자에 도전할까요?</span>', [['계속하기', () => { keepGoing = true; ov.hidden = true; save(); }], ['새 게임', newGame]], true); }
      else if (!canMove()) { store.set('cz_2048s', null); showOv(`<b>더 밀 수 없어요</b><span>점수 ${score.toLocaleString('ko-KR')}</span>`, [['새 게임', newGame]]); }
    }, ANI);
  }
  function showOv(h, btns, good = false) {
    ov.innerHTML = `<div class="cz-card${good ? ' good' : ''}">${h}<div class="row">${btns.map((b, i) => `<button type="button" class="btn${i ? ' ghost' : ''}" data-i="${i}">${b[0]}</button>`).join('')}</div></div>`; ov.hidden = false;
    ov.querySelectorAll('[data-i]').forEach(x => x.onclick = btns[+x.dataset.i][1]);
  }
  $u.onclick = () => { if (!undo || busy) return; load(undo); undo = null; $u.disabled = true; save(); };
  el.querySelector('#tzN').onclick = newGame;
  const onKey = e => { if (modalOpen() || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return; const d = DIRS[e.code]; if (d == null) return; e.preventDefault(); move(d); };
  document.addEventListener('keydown', onKey);
  bd.style.touchAction = 'none'; const unSw = swipe(bd, move);
  const onRs = () => fit(); addEventListener('resize', onRs);
  bindMode(el, 'n2048', rk, newGame);
  fit(); if (rkOn('n2048', rk)) newGame(); else load(store.get('cz_2048s', null)); fit();
  return { destroy() { runN++; clearInterval(tmr); unSw(); document.removeEventListener('keydown', onKey); removeEventListener('resize', onRs); }, restart: newGame };
}
