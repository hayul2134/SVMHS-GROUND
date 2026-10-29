// SVMHS GROUND — 기자재 정리! 블록(블록 블라스트 방식, 2026-10-29 하율, 미리보기 깃발 blast-game)
// 8×8 장비 선반에 장비 케이스 3개를 끌어다 놓기 → 가로·세로 줄이 꽉 차면 정리. 놓을 곳이 없으면 끝. 규칙·검사는 blast-score.js(서버와 같음)
// createBlast(root, { best, sound, seed: async () => 씨앗|null, onOver(res), onSound(on) })
//   res = { score, n, lines, ms, rounds: [끝난 ms, ...놓기], why: 'stuck'|'max' }
import { N, PIECES, MAX_MOVES, MIN_GAP, rng, newBoard, fits, canPlace, nextSet, place, enc } from './blast-score.js';

const KINDS = {
  bat: ['배터리', '#ffd25e'], lens: ['렌즈', '#8fb8ff'], sd: ['SD 카드', '#5fd0b5'], led: ['LED 바', '#ffb347'], boom: ['붐 마이크', '#ff8f5a'],
  cam: ['카메라', '#6aa7ff'], case: ['하드 케이스', '#9d8cff'], mon: ['모니터', '#4fc3f7'], slide: ['슬라이더', '#ff7aa8'], tri: ['삼각대', '#ffa94d'],
  cst: ['C스탠드', '#ff5a6e'], cab: ['케이블', '#b48cff'], light: ['조명 스탠드', '#7bd88f'],
};
const KEYS = Object.keys(KINDS);
const INK = '#2a2846', FONT = 'Outfit,Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
const CLEAR_NAME = ['정리!', '깔끔하게 정리!', '칼각 정리!', '기자재실 완벽!'];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

export function createBlast(root, opt = {}) {
  let best = opt.best || 0, sound = !!opt.sound;
  root.innerHTML = `<div class="ml-top"><span class="ml-chip">점수 <b data-m="sc">0</b></span><span class="ml-chip">최고 <b data-m="best">${best.toLocaleString('ko-KR')}</b></span><span class="ml-chip bl-cb" data-m="cbw">연속 <b data-m="cb">0</b></span>
      <button type="button" class="btn ghost hr-snd ml-snd" data-m="snd"></button></div>
    <div class="ml-board bl-board" data-m="board"><canvas data-m="cv" aria-label="기자재 정리! 블록 판"></canvas><div class="ml-ov" data-m="ov"></div></div>`;
  const $ = k => root.querySelector(`[data-m="${k}"]`);
  const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), board = $('board'), sndBtn = $('snd');
  let b = newBoard(), st = { score: 0, combo: 0, miss: 0 }, rand = null, set = [0, 1, 2], used = [true, true, true], moves = [], lines = 0;
  let state = 'ready', cs = 40, pad = 10, W = 0, H = 0, horiz = false, dpr = 1, tiles = new Map(), drag = null, fx = [], floats = [], raf = 0, dead = false, busy = false, t0 = 0, ac = null, born = [], endT = 0;

  /* ----- 소리(기본 꺼짐) ----- */
  function au() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
  function tone(f, d, type = 'square', vol = .06, at = 0, f2 = 0) {
    const a = sound && au(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
  }
  const paintSnd = () => { const t = sound ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; };
  sndBtn.onclick = () => { sound = !sound; if (sound) au(); paintSnd(); opt.onSound?.(sound); sndBtn.blur(); };
  paintSnd();

  /* ----- 그림: 장비 케이스 한 칸(둥근 젤리 블록 + 위 반사광 + 아래·오른쪽 그림자 + 장비 무늬) ----- */
  function tile(kind, s) {
    const key = kind + ':' + s; if (tiles.has(key)) return tiles.get(key);
    const S = Math.max(4, Math.round(s * dpr)), c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), col = KINDS[kind]?.[1] || '#9aa6c6', m = S * .045, r = S * .2, w = S - m * 2;
    g.fillStyle = mix(col, '#1c1d33', .45); g.beginPath(); g.roundRect(m, m, w, w, r); g.fill();                       // 아래 그림자 면
    g.fillStyle = col; g.beginPath(); g.roundRect(m, m, w, w - S * .09, r); g.fill();                                    // 몸통
    const gr = g.createLinearGradient(0, m, 0, m + w * .5); gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.roundRect(m + S * .08, m + S * .06, w - S * .16, w * .38, r * .7); g.fill();     // 위 반사광
    g.lineWidth = Math.max(1, S * .05); g.strokeStyle = mix(col, INK, .55); g.beginPath(); g.roundRect(m, m, w, w, r); g.stroke();
    // 장비 무늬(아주 연하게) — 케이스마다 다른 작은 표시
    const cx = S / 2, cy = S * .47, u = S * .12; g.fillStyle = g.strokeStyle = 'rgba(30,30,60,.22)'; g.lineWidth = Math.max(1, S * .05);
    if (kind === 'lens' || kind === 'cam') { g.beginPath(); g.arc(cx, cy, u * 1.5, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, u * .6, 0, 7); g.fill(); }
    else if (kind === 'bat' || kind === 'led') { for (let i = -1; i <= 1; i++) { g.beginPath(); g.roundRect(cx + i * u * 1.25 - u * .4, cy - u, u * .8, u * 2, u * .3); g.fill(); } }
    else if (kind === 'sd') { g.beginPath(); g.moveTo(cx - u * 1.3, cy - u * 1.4); g.lineTo(cx + u * .6, cy - u * 1.4); g.lineTo(cx + u * 1.3, cy - u * .7); g.lineTo(cx + u * 1.3, cy + u * 1.4); g.lineTo(cx - u * 1.3, cy + u * 1.4); g.closePath(); g.stroke(); }
    else if (kind === 'case' || kind === 'mon') { g.beginPath(); g.roundRect(cx - u * 1.5, cy - u, u * 3, u * 2, u * .4); g.stroke(); }
    else { g.beginPath(); g.arc(cx, cy, u * .7, 0, 7); g.fill(); }
    tiles.set(key, c); return c;
  }
  const kindOf = i => PIECES[i].k;
  const dims = s => [Math.max(...s.map(x => x[0])) + 1, Math.max(...s.map(x => x[1])) + 1];

  /* ----- 배치: 판(8칸) + 장비 받침(3칸) — 넓으면 옆, 좁으면 아래 ----- */
  function fit() {
    if (dead || !cv.isConnected) return;
    dpr = Math.min(devicePixelRatio || 1, 2); tiles.clear();
    const aw = Math.max(240, root.clientWidth - 30), top = board.getBoundingClientRect().top, ah = Math.max(300, innerHeight - Math.max(top, 0) - 26);
    // 옆 배치: 가로 = 8칸+받침 3.4칸, 세로 = 8칸 / 아래 배치: 가로 = 8칸, 세로 = 8칸+받침 3.3칸
    const sH = Math.min((aw - 3 * pad) / 11.4, (ah - 2 * pad) / 8), sV = Math.min((aw - 2 * pad) / 8, (ah - 3 * pad) / 11.3);
    horiz = sH > sV * 1.08;
    cs = Math.floor(Math.max(22, Math.min(64, horiz ? sH : sV)));
    pad = Math.round(Math.max(8, cs * .25));
    W = horiz ? pad * 3 + cs * 11.4 : pad * 2 + cs * 8; H = horiz ? pad * 2 + cs * 8 : pad * 3 + cs * 11.3;
    W = Math.round(W); H = Math.round(H);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr;
    draw();
  }
  const BX = () => pad, BY = () => pad;
  function slotRect(i) {   // 받침 칸 i의 [x, y, w, h]
    if (horiz) { const x = pad * 2 + cs * 8, h = cs * 8 / 3; return [x, pad + h * i, cs * 3.4, h]; }
    const y = pad * 2 + cs * 8, w = cs * 8 / 3; return [pad + w * i, y, w, cs * 3.3];
  }
  const mini = () => cs * (horiz ? .5 : .52);

  // 끌고 있는 장비가 놓일 자리(맞으면 {r, c}) — 장비 가운데 = 손가락(터치는 손가락보다 위로 띄움)
  function snapOf(d) {
    const s = PIECES[set[d.slot]].s, [h, w] = dims(s);
    const x = d.x - w * cs / 2 - BX(), y = d.y - d.lift - h * cs / 2 - BY();
    const r = Math.round(y / cs), c = Math.round(x / cs);
    return fits(b, s, r, c) ? { r, c } : null;
  }
  function preview(d) {   // 놓으면 정리될 줄 칸들
    const sn = snapOf(d); if (!sn) return null;
    const t = b.slice(), s = PIECES[set[d.slot]].s; for (const [dr, dc] of s) t[(sn.r + dr) * N + sn.c + dc] = 1;
    const hit = new Set();
    for (let y = 0; y < N; y++) if (t.slice(y * N, y * N + N).every(Boolean)) for (let x = 0; x < N; x++) hit.add(y * N + x);
    for (let x = 0; x < N; x++) { let f = true; for (let y = 0; y < N; y++) if (!t[y * N + x]) f = false; if (f) for (let y = 0; y < N; y++) hit.add(y * N + x); }
    return { sn, hit };
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const now = performance.now(), bx = BX(), by = BY();
    // 선반(판)
    ctx.fillStyle = '#26315c'; ctx.beginPath(); ctx.roundRect(bx - pad * .5, by - pad * .5, cs * 8 + pad, cs * 8 + pad, pad); ctx.fill();
    for (let i = 0; i < N * N; i++) { const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs; ctx.fillStyle = (i + Math.floor(i / N)) % 2 ? '#2f3b6c' : '#2c3866'; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, cs - 3, cs - 3, cs * .16); ctx.fill(); }
    const pv = drag && state === 'play' ? preview(drag) : null;
    for (let i = 0; i < N * N; i++) {
      if (!b[i]) continue;
      const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs, bn = born[i] && now - born[i] < 160 ? .82 + .18 * (now - born[i]) / 160 : 1, d = cs * bn;
      ctx.drawImage(tile(KEYS[b[i] - 1], cs), x + (cs - d) / 2, y + (cs - d) / 2, d, d);
      if (pv?.hit.has(i)) { ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * .18); ctx.fill(); }
    }
    if (pv) {   // 놓일 자리(반투명) + 정리될 줄의 빈칸도 빛나게
      const s = PIECES[set[drag.slot]].s, k = kindOf(set[drag.slot]);
      ctx.globalAlpha = .45; for (const [dr, dc] of s) ctx.drawImage(tile(k, cs), bx + (pv.sn.c + dc) * cs, by + (pv.sn.r + dr) * cs, cs, cs); ctx.globalAlpha = 1;
      pv.hit.forEach(i => { if (b[i]) return; const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * .18); ctx.fill(); });
    }
    // 정리된 칸: 하얗게 번쩍 → 작아지며 사라짐 + 반짝이
    fx = fx.filter(f => now - f.t < 420);
    for (const f of fx) {
      const k = Math.max(0, (now - f.t - f.dl) / 360); if (k > 1) continue;
      const x = bx + (f.i % N) * cs + cs / 2, y = by + Math.floor(f.i / N) * cs + cs / 2, d = cs * (1 - k * .9);
      ctx.globalAlpha = 1 - k * .6; ctx.drawImage(tile(f.k, cs), x - d / 2, y - d / 2, d, d);
      ctx.fillStyle = `rgba(255,255,255,${(1 - k) * .7})`; ctx.beginPath(); ctx.roundRect(x - d / 2, y - d / 2, d, d, d * .2); ctx.fill();
      ctx.fillStyle = '#fff6c2'; for (let j = 0; j < 3; j++) { const a = f.a + j * 2.1, rr = k * cs * .9; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(1, cs * .06 * (1 - k)), 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // 받침: 남은 장비 3개(작게) + 이름
    for (let i = 0; i < 3; i++) {
      const [sx, sy, sw, sh] = slotRect(i);
      if (used[i] || (drag && drag.slot === i)) continue;
      const s = PIECES[set[i]].s, k = kindOf(set[i]), [h, w] = dims(s), m = mini(), ok = canPlace(b, s), lab = Math.max(10, Math.round(cs * .28));
      const ox = sx + (sw - w * m) / 2, oy = sy + (sh - lab * 1.4 - h * m) / 2;
      ctx.globalAlpha = ok || state !== 'play' ? 1 : .32;
      for (const [dr, dc] of s) ctx.drawImage(tile(k, m), ox + dc * m, oy + dr * m, m, m);
      ctx.globalAlpha = 1;
      ctx.font = `800 ${lab}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = ok ? '#8d93b8' : '#c0c4d8';
      ctx.fillText(KINDS[k][0], sx + sw / 2, Math.min(sy + sh - 4, oy + h * m + lab * 1.25));
    }
    // 끌고 있는 장비(원래 크기)
    if (drag) {
      const s = PIECES[set[drag.slot]].s, k = kindOf(set[drag.slot]), [h, w] = dims(s);
      const ox = drag.x - w * cs / 2, oy = drag.y - drag.lift - h * cs / 2;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
      for (const [dr, dc] of s) ctx.drawImage(tile(k, cs), ox + dc * cs, oy + dr * cs, cs, cs);
      ctx.restore();
    }
    // 점수·정리 글자
    floats = floats.filter(f => now - f.t < 900);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of floats) {
      const k = (now - f.t) / 900, y = f.y - k * cs * 1.1; ctx.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
      const sz = Math.round(f.big ? Math.max(20, cs * .62) : Math.max(15, cs * .42)) * (k < .12 ? .7 + k * 2.5 : 1);
      ctx.font = `900 ${sz}px ${FONT}`; ctx.lineWidth = Math.max(3, sz * .18); ctx.strokeStyle = INK; ctx.strokeText(f.s, f.x, y); ctx.fillStyle = f.c || '#fff'; ctx.fillText(f.s, f.x, y);
      ctx.globalAlpha = 1;
    }
  }

  /* ----- 입력: 받침에서 장비를 눌러 끌기 → 판 위에서 놓기 ----- */
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function slotAt(p) { for (let i = 0; i < 3; i++) { const [x, y, w, h] = slotRect(i); if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) return i; } return -1; }
  const down = e => {
    if (state !== 'play' || drag || e.button > 0) return;
    const p = pos(e), i = slotAt(p); if (i < 0 || used[i]) return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
    drag = { slot: i, x: p.x, y: p.y, id: e.pointerId, lift: e.pointerType === 'touch' || e.pointerType === 'pen' ? cs * 1.6 : 0 };
    tone(440, .04, 'triangle', .04); kick();
  };
  const move = e => { if (!drag || e.pointerId !== drag.id) return; const p = pos(e); drag.x = p.x; drag.y = p.y; kick(); };
  const up = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (state !== 'play') { kick(); return; }
    const sn = snapOf(d), t = Math.round(performance.now() - t0);
    if (!sn || (moves.length && t - Math.floor(moves[moves.length - 1] / 1024) < MIN_GAP)) { if (!sn) tone(180, .08, 'triangle', .04); kick(); return; }
    put(d.slot, sn.r, sn.c, t);
  };
  const cancel = e => { if (drag && (!e || e.pointerId === drag.id)) { drag = null; kick(); } };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', cancel);

  function put(slot, r, c, t) {
    const pi = set[slot], s = PIECES[pi].s, k = kindOf(pi), now = performance.now(), prevB = b.slice();
    moves.push(enc(t, slot, r, c));
    const res = place(b, st, s, r, c, KEYS.indexOf(k) + 1);
    used[slot] = true; lines += res.n;
    for (const [dr, dc] of s) born[(r + dr) * N + c + dc] = now;
    const bx = BX(), by = BY(), [h, w] = dims(s), cx = bx + (c + w / 2) * cs, cy = by + (r + h / 2) * cs;
    if (res.n) {
      const ox = res.rows.length ? bx + cs * 4 : cx, oy = res.cols.length && !res.rows.length ? by + cs * 4 : res.rows.length ? by + (res.rows.reduce((a, y) => a + y, 0) / res.rows.length + .5) * cs : cy;
      res.cells.forEach(i => { const dist = res.rows.includes(Math.floor(i / N)) ? Math.abs(i % N - (c + w / 2)) : Math.abs(Math.floor(i / N) - (r + h / 2)); fx.push({ i, k: KEYS[prevB[i] ? prevB[i] - 1 : KEYS.indexOf(k)] || k, t: now, dl: dist * 28, a: Math.random() * 6 }); });
      floats.push({ s: res.clear ? '선반 싹 비움!' : CLEAR_NAME[Math.min(res.n, 4) - 1], x: ox, y: oy - cs * .45, t: now, big: true, c: '#ffe27a' });
      floats.push({ s: '+' + res.pts.toLocaleString('ko-KR') + (st.combo > 1 ? `  연속 ×${Math.min(st.combo, 10)}` : ''), x: ox, y: oy + cs * .35, t: now + 60, c: '#9ff0a8' });
      [0, 4, 7, 12].slice(0, Math.min(4, res.n + 1)).forEach((n, j) => tone(523 * 2 ** ((n + Math.min(st.combo, 8)) / 12), .12, 'triangle', .06, j * .06));
      if (navigator.vibrate) try { navigator.vibrate(18); } catch {}
    } else { floats.push({ s: '+' + res.pts, x: cx, y: cy, t: now, c: '#fff' }); tone(300, .05, 'square', .035); tone(220, .06, 'triangle', .04, .03); }
    $('sc').textContent = st.score.toLocaleString('ko-KR'); $('sc').classList.remove('bump'); void $('sc').offsetWidth; $('sc').classList.add('bump');
    $('cb').textContent = st.combo; $('cbw').classList.toggle('on', st.combo > 1);
    if (used.every(Boolean)) { set = nextSet(rand, b); used = [false, false, false]; tone(660, .05, 'sine', .035, .1); }
    if (moves.length >= MAX_MOVES) end('max');
    else if (!set.some((pi2, i) => !used[i] && canPlace(b, PIECES[pi2].s))) { state = 'ending'; endT = setTimeout(() => end('stuck'), 650); }
    kick();
  }

  function kick() { if (!raf && !dead) raf = requestAnimationFrame(loop); }
  function loop() { raf = 0; if (dead) return; draw(); if (drag || fx.length || floats.length || born.some(x => x && performance.now() - x < 170)) raf = requestAnimationFrame(loop); }

  /* ----- 판 흐름 ----- */
  function ready() {
    state = 'ready'; ov.hidden = false; ov.className = 'ml-ov';
    ov.innerHTML = `<b>기자재 정리! 블록</b><span>장비 케이스를 끌어다 선반에 놓아요<br>가로·세로 한 줄이 꽉 차면 <em>정리!</em> · 놓을 곳이 없으면 끝</span><button type="button" class="btn big" data-m="go">시작</button>`;
    $('go').onclick = start; draw();
  }
  async function start() {
    if (busy || dead) return; busy = true;
    const go = $('go'); if (go) { go.disabled = true; go.textContent = '준비 중…'; }
    let seed = null; try { seed = await opt.seed?.(); } catch {}
    busy = false; if (dead) return;
    clearTimeout(endT);
    rand = rng(seed == null ? Math.floor(Math.random() * 4294967296) : seed);
    b = newBoard(); st = { score: 0, combo: 0, miss: 0 }; moves = []; lines = 0; fx = []; floats = []; born = []; drag = null;
    set = nextSet(rand, b); used = [false, false, false];
    $('sc').textContent = 0; $('cb').textContent = 0; $('cbw').classList.remove('on');
    state = 'play'; t0 = performance.now(); ov.hidden = true; tone(523, .08, 'triangle', .06); tone(784, .12, 'triangle', .06, .08);
    fit(); kick();
  }
  function end(why) {
    if (state !== 'play' && state !== 'ending') return;
    const ms = Math.round(performance.now() - t0); state = 'over'; drag = null;
    const nb = st.score > best; if (nb) { best = st.score; $('best').textContent = best.toLocaleString('ko-KR'); }
    tone(nb ? 784 : 392, .14, 'triangle', .07); tone(nb ? 1047 : 330, .22, 'triangle', .07, .14);
    ov.hidden = false; ov.className = 'ml-ov end';
    ov.innerHTML = `<b>${why === 'max' ? '오늘 정리는 여기까지!' : '선반이 꽉 찼어요!'}</b><p class="ml-sc">${st.score.toLocaleString('ko-KR')}<small>점</small></p><span>${lines}줄 정리 · 장비 ${moves.length}개${nb ? ' · 최고 기록 경신!' : ''}</span>
      <small class="ml-msg" data-m="msg"></small><button type="button" class="btn big" data-m="go">한 번 더</button>`;
    $('go').onclick = start; draw();
    opt.onOver?.({ score: st.score, n: moves.length, lines, ms, why, nb, rounds: [ms, ...moves] });
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe(root);
  rand = rng(1); set = nextSet(rand, b); used = [false, false, false]; ready(); fit();
  return {
    start,
    msg(html) { const m = $('msg'); if (m) m.innerHTML = html; },
    setBest(v, force) { if (force || v > best) { best = v; $('best').textContent = v.toLocaleString('ko-KR'); } },
    destroy() { dead = true; clearTimeout(endT); cancelAnimationFrame(raf); ro.disconnect(); try { ac?.close(); } catch {} },
    get st() { return { state, score: st.score, combo: st.combo, board: b, set, used, moves, cs, pad, horiz }; },
    _put(slot, r, c) { if (state === 'play' && !used[slot] && fits(b, PIECES[set[slot]].s, r, c)) { put(slot, r, c, Math.round(performance.now() - t0)); return true; } return false; },   // 테스트용
  };
}
