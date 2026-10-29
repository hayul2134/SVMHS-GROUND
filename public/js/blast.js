// SVMHS GROUND — 카메라 가방 정리!(블록 블라스트 방식, 2026-10-29 하율, 미리보기 깃발 blast-game)
// 8×8 카메라 가방에 장비 3개를(2026-10-29 하율 "카메라 가방 안에 장비들을 넣는 컨셉") 끌어다 놓기 → 가로·세로 줄이 꽉 차면 정리. 놓을 곳이 없으면 끝. 규칙·검사는 blast-score.js(서버와 같음)
// createBlast(root, { best, sound, seed: async () => 씨앗|null, onOver(res), onSound(on) })
//   res = { score, n, lines, ms, rounds: [끝난 ms, ...놓기], why: 'stuck'|'max'|'quit' }
// 조작(2026-10-29 출시 준비): ① 끌어다 놓기 ② 눌러서 집기 → 판을 눌러 놓기(트랙패드·터치에서 끌기 어려울 때) · 다시 누르면 내려놓기
//   '그만하기'(두 번 눌러 확인) = 쉬는 시간이 끝날 때 지금 점수로 기록 남기기
import { N, PIECES, MAX_MOVES, MIN_GAP, rng, newBoard, fits, canPlace, nextSet, place, enc } from './blast-score.js';

const KINDS = {
  bat: ['배터리', '#ffd25e'], lens: ['렌즈', '#8fb8ff'], sd: ['SD 카드', '#5fd0b5'], led: ['LED 바', '#ffb347'], boom: ['붐 마이크', '#ff8f5a'],
  cam: ['카메라', '#6aa7ff'], case: ['하드 케이스', '#9d8cff'], mon: ['모니터', '#4fc3f7'], slide: ['슬라이더', '#ff7aa8'], tri: ['삼각대', '#ffa94d'],
  cst: ['C스탠드', '#ff5a6e'], cab: ['케이블', '#b48cff'], light: ['조명 스탠드', '#7bd88f'],
};
const KEYS = Object.keys(KINDS);
const INK = '#2a2846', FONT = 'Outfit,Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
const CLEAR_NAME = ['쏙!', '딱 맞게 쏙!', '빈틈없이 챙김!', '완벽한 가방!'];   // 2026-10-29 카메라 가방 컨셉
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

export function createBlast(root, opt = {}) {
  let best = opt.best || 0, sound = !!opt.sound;
  // 점수판(2026-10-29 하율 "블록 블라스트처럼 — 올라가는 점수가 잘 안 보여 재미없어"): 왼쪽 위 작게 최고 기록, 가운데 큰 점수(올라갈 때 숫자가 굴러 올라감 + 얻은 점수 팝), 오른쪽 버튼
  root.innerHTML = `<div class="ml-top bl-top" data-m="top"><span class="bl-best" title="최고 기록"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#fff3b0" stroke="#5a3a00" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 6H4.5a3 3 0 0 0 3 4.2M17 6h2.5a3 3 0 0 1-3 4.2" fill="none" stroke="#5a3a00" stroke-width="1.8" stroke-linecap="round"/><path d="M12 14v3.4M8.5 20h7l-.8-2.6H9.3z" fill="#fff3b0" stroke="#5a3a00" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.6 6.4v2.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg><small>최고</small><b data-m="best">${best.toLocaleString('ko-KR')}</b></span>
      <div class="bl-score" aria-live="polite"><b data-m="sc">0</b><em class="bl-gain" data-m="gain"></em><span class="bl-cb" data-m="cbw">연속 <i data-m="cb">0</i></span></div>
      <span class="bl-tools"><button type="button" class="btn ghost bl-stop" data-m="stop" hidden>그만하기</button><button type="button" class="btn ghost hr-snd ml-snd" data-m="snd"></button></span></div>
    <div class="ml-board bl-board" data-m="board"><canvas data-m="cv" aria-label="카메라 가방 정리! — 카메라 가방"></canvas><div class="ml-ov" data-m="ov"></div></div>`;
  const $ = k => root.querySelector(`[data-m="${k}"]`);
  const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), board = $('board'), sndBtn = $('snd'), stopBtn = $('stop');
  let b = newBoard(), st = { score: 0, combo: 0, miss: 0 }, rand = null, set = [0, 1, 2], used = [true, true, true], moves = [], lines = 0;
  let state = 'ready', cs = 40, pad = 10, W = 0, H = 0, horiz = false, dpr = 1, drag = null, arts = new Map(), cellArt = [], fx = [], floats = [], raf = 0, dead = false, busy = false, t0 = 0, ac = null, born = [], endT = 0, held = -1, setAt = 0, stopT = 0;

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

  /* ----- 그림(2026-10-29 하율 "카메라 가방 안에 장비들을 넣는 컨셉"): 조각 하나 = 장비 한 개 그림
     칸을 이은 한 덩어리 몸통(잉크 외곽 + 아래 그림자 + 위 반사광) + 장비 세부. 판에 놓인 칸은 그 그림의 해당 칸만 잘라 그림 → 줄이 정리되면 장비가 잘려 나감 ----- */
  function art(pi, s) {
    const key = pi + ':' + s; let A = arts.get(key); if (A) return A;
    const sh = PIECES[pi].s, k = PIECES[pi].k, [h, w] = dims(sh), S = Math.max(4, Math.round(s * dpr));
    const c = document.createElement('canvas'); c.width = w * S; c.height = h * S;
    const g = c.getContext('2d'), col = KINDS[k][1], dk = mix(col, INK, .6), D = '#2a2846', SIL = '#e6eaf4';
    const on = (r, q) => sh.some(([y, x]) => y === r && x === q);
    const blob = (ins, rad, bi = 0) => { g.beginPath(); for (const [r, q] of sh) { const T = !on(r - 1, q), B = !on(r + 1, q), Lf = !on(r, q - 1), Rt = !on(r, q + 1); const x0 = q * S + (Lf ? ins : 0), x1 = (q + 1) * S - (Rt ? ins : 0), y0 = r * S + (T ? ins : 0), y1 = (r + 1) * S - (B ? ins + bi : 0); g.roundRect(x0, y0, x1 - x0, y1 - y0, [T && Lf ? rad : 0, T && Rt ? rad : 0, B && Rt ? rad : 0, B && Lf ? rad : 0]); } };
    const m = S * .05, lw = Math.max(1, S * .05), rad = S * .2;
    g.fillStyle = dk; blob(m, rad); g.fill();                                     // 잉크 외곽
    g.fillStyle = mix(col, '#151933', .42); blob(m + lw, rad * .85); g.fill();      // 아래 그림자 면
    g.fillStyle = col; blob(m + lw, rad * .85, S * .08); g.fill();                  // 몸통
    g.save(); blob(m + lw, rad * .85, S * .08); g.clip();                           // 위 반사광(맨 윗줄 칸만)
    for (const [r, q] of sh) if (!on(r - 1, q)) { const gr = g.createLinearGradient(0, r * S, 0, r * S + S * .45); gr.addColorStop(0, 'rgba(255,255,255,.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(q * S, r * S, S, S * .45); }
    g.restore();
    const cc = ([r, q]) => [(q + .5) * S, (r + .5) * S - S * .04];
    const nb = p => sh.filter(([y, x]) => Math.abs(y - p[0]) + Math.abs(x - p[1]) === 1);
    const walk = () => { let cur = sh.find(p => nb(p).length === 1) || sh[0], prev = null; const out = [cur]; for (;;) { const n = nb(cur).filter(p => p !== prev); if (!n.length) break; prev = cur; cur = n[0]; out.push(cur); } return out; };
    const rod = (pts, w1, w2, c2 = SIL) => { g.lineCap = g.lineJoin = 'round'; [[w1, D], [w2, c2]].forEach(([lw2, cl]) => { g.lineWidth = lw2; g.strokeStyle = cl; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(...cc(p)) : g.moveTo(...cc(p))); g.stroke(); }); };
    const dot = (x, y, r, f, st) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = f; g.fill(); if (st) { g.lineWidth = Math.max(1, S * .04); g.strokeStyle = st; g.stroke(); } };
    const rr = (x, y, ww, hh, r, f) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); g.fillStyle = f; g.fill(); };
    // 막대 모양 장비(렌즈·SD·LED 바·붐 마이크)는 가로로 그린 뒤 세로면 돌림 — X = 길이 방향, Y = 폭 방향(0~S)
    const L = Math.max(w, h); if (['lens', 'led', 'boom'].includes(k) && h > w) g.setTransform(0, 1, -1, 0, w * S, 0);
    const Y = S * .46;   // 몸통 가운데(아래 그림자 면 뺀 높이)
    if (k === 'bat') {
      rr(S * .36, S * .03, S * .28, S * .12, S * .04, D);
      [.3, .445, .59].forEach(x => rr(S * x, S * .32, S * .11, S * .3, S * .03, '#fff'));
    } else if (k === 'lens') {
      g.fillStyle = 'rgba(30,30,60,.5)'; for (let i = 0; i < 4; i++) g.fillRect(S * (.32 + i * .24), S * .2, S * .09, S * .54);
      const gx = L * S - S * .34, gr = g.createRadialGradient(gx - S * .05, Y - S * .1, S * .02, gx, Y, S * .32); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, '#cfe8ff'); gr.addColorStop(1, '#3d6fc4');
      g.beginPath(); g.ellipse(gx, Y, S * .17, S * .33, 0, 0, 7); g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(1, S * .05); g.strokeStyle = D; g.stroke();
    } else if (k === 'sd') {   // SD 카드 1칸(2026-10-29 하율 "SD를 1X1로"): 오른쪽 위 모서리 깎임 + 금색 단자 + 라벨
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(S * .64, 0); g.lineTo(S, 0); g.lineTo(S, S * .36); g.closePath(); g.fill(); g.restore();
      g.lineWidth = Math.max(1, S * .05); g.strokeStyle = dk; g.beginPath(); g.moveTo(S * .62, m + lw * .5); g.lineTo(S - m - lw * .5, S * .38); g.stroke();
      [.2, .33, .46].forEach(x => rr(S * x, S * .14, S * .09, S * .2, S * .02, '#ffd25e'));
      rr(S * .2, S * .44, S * .6, S * .3, S * .05, '#fff'); g.fillStyle = D; g.font = `900 ${S * .2}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SD', S * .5, S * .6);
    } else if (k === 'led') {
      rr(S * .22, S * .18, L * S - S * .44, S * .56, S * .08, D);
      g.fillStyle = '#fff6c2'; g.shadowColor = '#ffe27a'; g.shadowBlur = S * .12;
      for (let x = S * .4; x < L * S - S * .3; x += S * .3) for (const y of [.33, .59]) { g.beginPath(); g.arc(x, S * y, S * .07, 0, 7); g.fill(); }
      g.shadowBlur = 0;
    } else if (k === 'boom') {
      rr(S * .12, S * .26, S * .85, S * .42, S * .1, D); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, S * .04); for (let x = S * .22; x < S * .9; x += S * .16) { g.beginPath(); g.moveTo(x, S * .28); g.lineTo(x + S * .1, S * .66); g.stroke(); }
      g.fillStyle = 'rgba(30,30,60,.55)'; [1.55, 2.5, 3.35].forEach(x => g.fillRect(S * x, S * .22, S * .08, S * .5));
      const fx = L * S - S * .88; g.fillStyle = '#cfc8bb'; g.beginPath(); g.ellipse(fx, Y, S * .7, S * .36, 0, 0, 7); g.fill();
      g.strokeStyle = '#9d9585'; g.lineWidth = Math.max(1, S * .05); g.lineCap = 'round';
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, x = fx + Math.cos(a) * S * .68, y = Y + Math.sin(a) * S * .34; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + .5) * S * .1, y + Math.sin(a + .5) * S * .08); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 9; i++) { const x = fx - S * .55 + i * S * .14; g.beginPath(); g.moveTo(x, Y - S * .16); g.lineTo(x + S * .06, Y + S * .02); g.stroke(); }
    } else if (k === 'cam') {
      rr(S * .22, S * .14, S * .56, S * .3, S * .08, D); rr(S * .32, S * .2, S * .36, S * .16, S * .04, '#8fd3ff');
      dot(S * 1.6, S * .36, S * .11, '#ff4d5e', D);
      dot(S * 1.04, S * 1.08, S * .64, D); const gr = g.createRadialGradient(S * .9, S * .92, S * .04, S * 1.04, S * 1.08, S * .5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.3, '#bfe0ff'); gr.addColorStop(1, '#2f5fb3');
      dot(S * 1.04, S * 1.08, S * .48, gr); dot(S * 1.04, S * 1.08, S * .2, D); dot(S * .9, S * .93, S * .08, 'rgba(255,255,255,.9)');
    } else if (k === 'case') {
      g.lineWidth = S * .1; g.strokeStyle = D; g.beginPath(); g.roundRect(S * 1.05, S * .18, S * .9, S * .36, S * .14); g.stroke();
      rr(S * .42, S * .6, S * .34, S * .44, S * .06, D); rr(S * 2.24, S * .6, S * .34, S * .44, S * .06, D);
      rr(S * .49, S * .68, S * .2, S * .12, S * .03, SIL); rr(S * 2.31, S * .68, S * .2, S * .12, S * .03, SIL);
      g.strokeStyle = 'rgba(30,30,60,.28)'; g.lineWidth = Math.max(1, S * .06); [1.35, 2.45].forEach(y => { g.beginPath(); g.moveTo(S * .3, S * y); g.lineTo(S * 2.7, S * y); g.stroke(); });
      rr(S * .85, S * 1.62, S * 1.3, S * .56, S * .08, '#fff'); g.fillStyle = D; g.font = `900 ${S * .2}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SVMHS', S * 1.5, S * 1.9);
    } else if (k === 'mon') {
      const x0 = S * .22, y0 = S * .2, ww = w * S - S * .44, hh = h * S - S * .58;
      rr(x0, y0, ww, hh, S * .1, D);
      const gr = g.createLinearGradient(0, y0, 0, y0 + hh); gr.addColorStop(0, '#8fd3ff'); gr.addColorStop(1, '#c6a8ff');
      g.save(); g.beginPath(); g.roundRect(x0 + S * .1, y0 + S * .1, ww - S * .2, hh - S * .2, S * .05); g.clip(); g.fillStyle = gr; g.fillRect(x0, y0, ww, hh);
      dot(x0 + ww * .72, y0 + hh * .3, S * .16, '#fff6c2'); g.fillStyle = '#5a7fd6'; g.beginPath(); g.moveTo(x0, y0 + hh); g.lineTo(x0 + ww * .35, y0 + hh * .45); g.lineTo(x0 + ww * .6, y0 + hh * .75); g.lineTo(x0 + ww * .8, y0 + hh * .55); g.lineTo(x0 + ww, y0 + hh * .8); g.lineTo(x0 + ww, y0 + hh); g.fill(); g.restore();
      dot(w * S - S * .4, h * S - S * .26, S * .06, '#ff4d5e'); dot(w * S - S * .62, h * S - S * .26, S * .06, '#7bd88f');
    } else if (k === 'slide') {
      const p = walk(); rod(p, S * .4, S * .24); g.strokeStyle = D; g.lineWidth = Math.max(1, S * .04); g.setLineDash([S * .06, S * .08]); g.beginPath(); p.forEach((q, i) => i ? g.lineTo(...cc(q)) : g.moveTo(...cc(q))); g.stroke(); g.setLineDash([]);
      p.filter(q => nb(q).length === 1).forEach(q => { const [x, y] = cc(q); rr(x - S * .18, y - S * .18, S * .36, S * .36, S * .07, D); });
      const [x, y] = cc(p[1]); rr(x - S * .25, y - S * .25, S * .5, S * .5, S * .1, D); dot(x, y, S * .13, '#ffd25e');
    } else if (k === 'tri') {
      const j = sh.find(p => nb(p).length === 3), [jx, jy] = cc(j);
      for (const q of nb(j)) { const [x, y] = cc(q); [[S * .2, D], [S * .08, SIL]].forEach(([lw2, cl]) => { g.lineWidth = lw2; g.strokeStyle = cl; g.lineCap = 'round'; g.beginPath(); g.moveTo(jx, jy); g.lineTo(x, y); g.stroke(); }); dot(x, y, S * .12, D); }
      rr(jx - S * .26, jy - S * .2, S * .52, S * .4, S * .1, D); dot(jx, jy, S * .1, SIL);
    } else if (k === 'cst') {
      const p = walk(); rod(p, S * .22, S * .09);
      const kn = p.find((q, i) => i > 0 && i < p.length - 1 && (p[i - 1][0] - q[0]) * (p[i + 1][1] - q[1]) !== (p[i - 1][1] - q[1]) * (p[i + 1][0] - q[0]));
      if (kn) { const [x, y] = cc(kn); dot(x, y, S * .2, SIL, D); dot(x, y, S * .07, D); }
      const [ex, ey] = cc(p[0]); rr(ex - S * .2, ey - S * .2, S * .4, S * .4, S * .08, D); const [fx, fy] = cc(p[p.length - 1]); dot(fx, fy, S * .14, D);
    } else if (k === 'cab') {
      const p = walk().map(cc); g.lineCap = g.lineJoin = 'round';
      [[S * .26, D], [S * .12, '#fff']].forEach(([lw2, cl]) => { g.lineWidth = lw2; g.strokeStyle = cl; g.beginPath(); g.moveTo(...p[0]); for (let i = 1; i < p.length - 1; i++) g.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2); g.lineTo(...p[p.length - 1]); g.stroke(); });
      [p[0], p[p.length - 1]].forEach(([x, y]) => { rr(x - S * .2, y - S * .2, S * .4, S * .4, S * .08, D); rr(x - S * .09, y - S * .09, S * .18, S * .18, S * .03, '#ffd25e'); });
    } else if (k === 'light') {
      const p = walk(); rod(p, S * .2, S * .08);
      const [bx2, by2] = cc(p[p.length - 1]); dot(bx2, by2, S * .16, D);
      const [lx, ly] = cc(p[0]); dot(lx, ly, S * .4, D); g.shadowColor = '#ffe27a'; g.shadowBlur = S * .25; dot(lx, ly, S * .28, '#fff6c2'); g.shadowBlur = 0; dot(lx - S * .08, ly - S * .08, S * .08, '#fff');
    }
    A = { c, S }; arts.set(key, A); return A;
  }
  // 판 칸 하나 = 그 칸에 놓인 장비 그림의 해당 칸(a = {pi, dr, dc})
  function cell(a, x, y, d) { const A = art(a.pi, cs); ctx.drawImage(A.c, a.dc * A.S, a.dr * A.S, A.S, A.S, x, y, d, d); }
  function whole(pi, x, y, s) { const A = art(pi, s), [h, w] = dims(PIECES[pi].s); ctx.drawImage(A.c, x, y, w * s, h * s); }
  const kindOf = i => PIECES[i].k;
  const dims = s => [Math.max(...s.map(x => x[0])) + 1, Math.max(...s.map(x => x[1])) + 1];

  /* ----- 배치: 판(8칸) + 장비 받침 — 검은 판이 항상 화면 가운데(2026-10-29 하율 "검정 화면이 중앙에 들어와야 보기 편해")
     아래 배치가 기본, 세로가 아주 짧을 때만 옆 배치(받침 반대쪽에 같은 폭 빈자리를 둬서 판이 가운데) ----- */
  function fit() {
    if (dead || !cv.isConnected) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    // 버튼 자리(2026-10-29 하율 "위에 버튼을 옆으로 빼"): 판 왼쪽에 150px 넘게 빈 곳이 있으면 버튼을 판 왼쪽에 세로로, 없으면 점수판 오른쪽 위
    const wide = innerWidth >= 901, top0 = root.querySelector('.bl-top'), tools = root.querySelector('.bl-tools');
    const sideOk = cw => (root.clientWidth - cw) / 2 + (wide ? 254 : 0) >= 150;
    // 판 크기(2026-10-29 하율 "아래 부분 스크롤 안 해도 되게 안 잘리게"): 판 틀(안쪽 여백·테두리·그림자)까지 뺀 높이 안에 캔버스가 다 들어가도록, 맞을 때까지 칸 크기를 줄임
    const dims2 = (c, hz) => { const p = Math.round(Math.max(8, c * .25)); return hz ? [p * 4 + c * 14.8, p * 2 + c * 8, p] : [p * 2 + c * 8, p * 3 + c * 10.75, p]; };
    const lay = () => {
      const aw = Math.max(240, root.clientWidth - 24), top = board.getBoundingClientRect().top, ah = Math.max(260, innerHeight - Math.max(top, 0) - 40);
      const best = hz => { let c = 64; while (c > 22) { const [w, h] = dims2(c, hz); if (w <= aw && h <= ah) break; c--; } return c; };
      const cH = best(true), cV = best(false);
      return cH > cV * 1.08 ? [cH, true] : [cV, false];
    };
    let [c1, hz1] = lay();
    const side = sideOk(dims2(c1, hz1)[0] + 16);
    if (top0.classList.contains('side') !== side) { top0.classList.toggle('side', side); tools.classList.toggle('side', side); [c1, hz1] = lay(); }   // 점수판 높이가 바뀌니 다시 잼
    cs = c1; horiz = hz1; [W, H, pad] = dims2(cs, horiz).map(Math.round);
    $('top').style.width = Math.max(300, W + 16) + 'px';   // 점수판 폭 = 판 폭(최고 기록·버튼이 판 양 끝에 맞춰짐)
    // 옆 버튼은 화면(게임 칸) 왼쪽 끝에 — 오른쪽 '내 기록' 칸과 좌우 짝(2026-10-29 하율 "그만하기부터 쭉 화면 옆으로")
    if (side) { const fl = root.closest('.fl') || root.parentElement; const dx = Math.round(fl.getBoundingClientRect().left - top0.getBoundingClientRect().left); tools.style.right = 'auto'; tools.style.left = dx + 'px'; tools.style.width = Math.max(130, Math.min(200, -dx - 16)) + 'px'; }
    else { tools.style.left = ''; tools.style.right = ''; tools.style.width = ''; }
    arts.clear();
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr;
    // 옆 버튼·오른쪽 '내 기록' 칸은 판 위쪽 선에 맞춤(2026-10-29 하율 "화면 위 기준으로 벗어나지 않게")
    const bt = board.getBoundingClientRect().top, fl2 = root.closest('.fl'), aside = fl2?.querySelector(':scope > .fl-side');
    tools.style.top = side ? Math.round(bt - top0.getBoundingClientRect().top) + 'px' : '';
    if (aside) aside.style.marginTop = wide && fl2 ? Math.max(0, Math.round(bt - fl2.getBoundingClientRect().top)) + 'px' : '';
    draw();
  }
  const BX = () => horiz ? pad * 2 + cs * 3.4 : pad, BY = () => pad;
  function slotRect(i) {   // 받침 칸 i의 [x, y, w, h]
    if (horiz) { const x = BX() + cs * 8 + pad, h = cs * 8 / 3; return [x, pad + h * i, cs * 3.4, h]; }
    const y = pad * 2 + cs * 8, w = cs * 8 / 3; return [pad + w * i, y, w, cs * 2.75];   // 받침 높이 3.3 → 2.75칸(아래 빈 곳 줄여 판이 안 잘리게)
  }
  const mini = () => cs * (horiz ? .5 : .42);   // 아래 받침: 5칸짜리 세로 장비도 2.1칸 + 이름이 2.75칸 안에

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

  /* ----- 타격감(2026-10-29 하율 "더 타격감 있게, 화려하게"): 화면 흔들림 · 줄 빛줄기 · 파편 · 번쩍 · 놓을 때 꾹 눌림 · 연속 테두리 ----- */
  let shake = { t: 0, a: 0 }, parts = [], beams = [], flash = { t: 0, a: 0 }, rings = [];
  const bump = a => { const now = performance.now(), left = Math.max(0, shake.a * (1 - (now - shake.t) / 280)); shake = { t: now, a: Math.min(16, Math.max(left, a)) }; };
  const busyFx = now => parts.length || beams.length || rings.length || now - shake.t < 280 || now - flash.t < 260;
  function noise(d, vol, f = 1200, type = 'bandpass', at = 0) {   // 짧은 잡음(쾅·쉭)
    const a = sound && au(); if (!a) return;
    const len = Math.floor(a.sampleRate * d), bf = a.createBuffer(1, len, a.sampleRate), x = bf.getChannelData(0);
    for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.2;
    const src = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); src.buffer = bf; fl.type = type; fl.frequency.value = f; g.gain.value = vol;
    src.connect(fl).connect(g).connect(a.destination); src.start(a.currentTime + at);
  }
  const ease = k => 1 - (1 - k) ** 3;
  function draw() {
    const now = performance.now(), bx = BX(), by = BY();
    const sk = Math.max(0, 1 - (now - shake.t) / 280) ** 2 * shake.a, sx0 = sk ? (Math.random() * 2 - 1) * sk : 0, sy0 = sk ? (Math.random() * 2 - 1) * sk : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, sx0 * dpr, sy0 * dpr);
    // 판(2026-10-29 하율: 지퍼 가방 그림은 "오히려 이상하다" → 예전 판으로)
    if (st.combo > 1 && state !== 'ready') {   // 연속 정리 중: 판 둘레가 색을 바꾸며 빛남(연속이 길수록 굵고 밝게)
      const hu = (now / 6) % 360, lw = Math.min(3 + st.combo, 9);
      ctx.save(); ctx.shadowColor = `hsl(${hu},95%,65%)`; ctx.shadowBlur = 10 + st.combo * 2; ctx.strokeStyle = `hsl(${hu},95%,68%)`; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.roundRect(bx - pad * .5 - lw / 2, by - pad * .5 - lw / 2, cs * 8 + pad + lw, cs * 8 + pad + lw, pad + lw / 2); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#26315c'; ctx.beginPath(); ctx.roundRect(bx - pad * .5, by - pad * .5, cs * 8 + pad, cs * 8 + pad, pad); ctx.fill();
    for (let i = 0; i < N * N; i++) { const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs; ctx.fillStyle = (i + Math.floor(i / N)) % 2 ? '#2f3b6c' : '#2c3866'; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, cs - 3, cs - 3, cs * .16); ctx.fill(); }
    const pv = drag && drag.x != null && state === 'play' ? preview(drag) : null;
    for (let i = 0; i < N * N; i++) {
      if (!b[i]) continue;
      const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs, ba = born[i] ? now - born[i] : 999, bk = Math.min(1, ba / 220), bn = ba < 220 ? 1 + .22 * Math.sin(bk * Math.PI) * (1 - bk) - .1 * (bk < .25 ? 1 - bk * 4 : 0) : 1, d = cs * bn;
      cellArt[i] ? cell(cellArt[i], x + (cs - d) / 2, y + (cs - d) / 2, d) : 0;
      if (ba < 180) { ctx.fillStyle = `rgba(255,255,255,${.55 * (1 - ba / 180)})`; ctx.beginPath(); ctx.roundRect(x + (cs - d) / 2, y + (cs - d) / 2, d, d, d * .2); ctx.fill(); }
      if (pv?.hit.has(i)) { ctx.fillStyle = `rgba(255,255,255,${.28 + .18 * Math.sin(now / 80)})`; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * .18); ctx.fill(); }
    }
    if (pv) {   // 놓일 자리(반투명) + 정리될 줄의 빈칸도 빛나게
      const s = PIECES[set[drag.slot]].s, k = kindOf(set[drag.slot]);
      ctx.globalAlpha = .5; whole(set[drag.slot], bx + pv.sn.c * cs, by + pv.sn.r * cs, cs); ctx.globalAlpha = 1;
      pv.hit.forEach(i => { if (b[i]) return; const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * .18); ctx.fill(); });
    }
    // 정리된 칸: 하얗게 번쩍 → 작아지며 사라짐 + 반짝이
    fx = fx.filter(f => now - f.t < 420);
    for (const f of fx) {
      const k = Math.max(0, (now - f.t - f.dl) / 360); if (k > 1) continue;
      const x = bx + (f.i % N) * cs + cs / 2, y = by + Math.floor(f.i / N) * cs + cs / 2, d = cs * (1 - k * .9);
      ctx.globalAlpha = 1 - k * .6; if (f.a2) cell(f.a2, x - d / 2, y - d / 2, d);
      ctx.fillStyle = `rgba(255,255,255,${(1 - k) * .7})`; ctx.beginPath(); ctx.roundRect(x - d / 2, y - d / 2, d, d, d * .2); ctx.fill();
      ctx.fillStyle = '#fff6c2'; for (let j = 0; j < 3; j++) { const a = f.a + j * 2.1, rr = k * cs * .9; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(1, cs * .06 * (1 - k)), 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // 줄 빛줄기: 놓은 자리에서 양쪽으로 쭉 뻗은 뒤 사라짐
    beams = beams.filter(m => now - m.t < 380);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of beams) {
      const e = now - m.t, g = ease(Math.min(1, e / 110)), al = e < 110 ? 1 : 1 - (e - 110) / 270, th = cs * (1.15 - .5 * Math.max(0, (e - 110) / 270));
      const len = cs * 8 * g, c0 = m.from * cs;
      ctx.globalAlpha = al; ctx.fillStyle = m.c; ctx.shadowColor = m.c; ctx.shadowBlur = cs * .6;
      if (m.row != null) { const y = by + (m.row + .5) * cs; ctx.fillRect(bx + Math.max(0, c0 - len), y - th / 2, Math.min(cs * 8, c0 + len) - Math.max(0, c0 - len), th); ctx.fillStyle = '#fff'; ctx.fillRect(bx + Math.max(0, c0 - len), y - th * .18, Math.min(cs * 8, c0 + len) - Math.max(0, c0 - len), th * .36); }
      else { const x = bx + (m.col + .5) * cs; ctx.fillRect(x - th / 2, by + Math.max(0, c0 - len), th, Math.min(cs * 8, c0 + len) - Math.max(0, c0 - len)); ctx.fillStyle = '#fff'; ctx.fillRect(x - th * .18, by + Math.max(0, c0 - len), th * .36, Math.min(cs * 8, c0 + len) - Math.max(0, c0 - len)); }
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // 판 전체 번쩍(여러 줄일수록 세게)
    if (now - flash.t < 260) { ctx.fillStyle = `rgba(255,255,255,${flash.a * (1 - (now - flash.t) / 260)})`; ctx.beginPath(); ctx.roundRect(bx - pad * .5, by - pad * .5, cs * 8 + pad, cs * 8 + pad, pad); ctx.fill(); }
    // 놓을 때 퍼지는 고리
    rings = rings.filter(o => now - o.t < 320);
    for (const o of rings) { const k = (now - o.t) / 320; ctx.strokeStyle = `rgba(255,255,255,${.7 * (1 - k)})`; ctx.lineWidth = Math.max(1, cs * .12 * (1 - k)); ctx.beginPath(); ctx.roundRect(o.x - o.w / 2 - k * cs * .5, o.y - o.h / 2 - k * cs * .5, o.w + k * cs, o.h + k * cs, cs * .3); ctx.stroke(); }
    // 파편: 장비 조각이 튀어 올랐다 떨어짐 + 별 반짝이
    const dt = Math.min(40, now - (draw.last || now)) / 16.67; draw.last = now;
    parts = parts.filter(q => now - q.t < q.life);
    for (const q of parts) {
      q.vy += .35 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt;
      const k = (now - q.t) / q.life; ctx.globalAlpha = k < .6 ? 1 : 1 - (k - .6) / .4;
      if (q.star) { ctx.fillStyle = '#fff6c2'; const z = q.s * (1 - k); ctx.beginPath(); ctx.moveTo(q.x, q.y - z); ctx.lineTo(q.x + z * .3, q.y - z * .3); ctx.lineTo(q.x + z, q.y); ctx.lineTo(q.x + z * .3, q.y + z * .3); ctx.lineTo(q.x, q.y + z); ctx.lineTo(q.x - z * .3, q.y + z * .3); ctx.lineTo(q.x - z, q.y); ctx.lineTo(q.x - z * .3, q.y - z * .3); ctx.fill(); }
      else { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.c; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s * .3); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
    // 받침: 남은 장비 3개(작게) + 이름
    for (let i = 0; i < 3; i++) {
      const [sx, sy, sw, sh] = slotRect(i);
      if (used[i] || (drag && drag.slot === i && !drag.held)) continue;
      const s = PIECES[set[i]].s, k = kindOf(set[i]), [h, w] = dims(s), ok = canPlace(b, s), lab = Math.max(10, Math.round(cs * .28));
      const ap = Math.min(1, (now - setAt - i * 60) / 220), m = mini() * (ap < 0 ? .6 : .6 + .4 * (1 - (1 - ap) ** 3));   // 새 묶음은 하나씩 톡톡 커지며 등장
      if (ap < 0) continue;
      const ox = sx + (sw - w * m) / 2, oy = sy + (sh - lab * 1.4 - h * m) / 2;
      if (held === i) { ctx.fillStyle = 'rgba(255,226,122,.22)'; ctx.strokeStyle = '#e0a21a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(sx + 4, sy + 4, sw - 8, sh - 8, cs * .3); ctx.fill(); ctx.stroke(); }   // 집은 장비
      ctx.globalAlpha = (ok || state !== 'play' ? 1 : .32) * Math.max(0, Math.min(1, ap * 1.6));
      whole(set[i], ox, oy, m);
      ctx.globalAlpha = 1;
      ctx.font = `800 ${lab}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = ok ? '#8d93b8' : '#c0c4d8';
      ctx.fillText(KINDS[k][0], sx + sw / 2, Math.min(sy + sh - 4, oy + h * m + lab * 1.25));
    }
    // 끌고 있는 장비(원래 크기)
    if (drag && drag.x != null && !(drag.held && slotAt(drag) >= 0)) {
      const s = PIECES[set[drag.slot]].s, k = kindOf(set[drag.slot]), [h, w] = dims(s);
      const ox = drag.x - w * cs / 2, oy = drag.y - drag.lift - h * cs / 2;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
      whole(set[drag.slot], ox, oy, cs);
      ctx.restore();
    }
    // 점수·정리 글자
    floats = floats.filter(f => now - f.t < 900);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of floats) {
      const k = (now - f.t) / 900, y = f.y - k * cs * 1.1; ctx.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
      const sz = Math.round(f.big ? Math.max(20, cs * .62) : Math.max(15, cs * .42)) * (k < .1 ? .5 + k * 9 : k < .22 ? 1.4 - (k - .1) * 3.3 : 1) * (f.sc || 1);
      ctx.font = `900 ${sz}px ${FONT}`; ctx.lineWidth = Math.max(3, sz * .18); ctx.strokeStyle = INK; ctx.strokeText(f.s, f.x, y); ctx.fillStyle = f.rb ? `hsl(${(now / 4) % 360},95%,70%)` : f.c || '#fff'; ctx.fillText(f.s, f.x, y);
      ctx.globalAlpha = 1;
    }
  }

  /* ----- 입력: 받침에서 장비를 눌러 끌기 → 판 위에서 놓기 ----- */
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function slotAt(p) { for (let i = 0; i < 3; i++) { const [x, y, w, h] = slotRect(i); if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) return i; } return -1; }
  const tryPut = d => {   // 놓기 시도 → 놓았으면 true
    const sn = snapOf(d), t = Math.round(performance.now() - t0);
    if (!sn) { tone(180, .08, 'triangle', .04); return false; }
    if (moves.length && t - Math.floor(moves[moves.length - 1] / 1024) < MIN_GAP) return false;
    put(d.slot, sn.r, sn.c, t); return true;
  };
  const down = e => {
    if (state !== 'play' || e.button > 0 || (drag && !drag.held)) return;
    const p = pos(e), i = slotAt(p), touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    e.preventDefault();
    if (drag?.held) {   // 집은 상태: 같은 장비 = 내려놓기 · 다른 장비 = 바꿔 집기 · 판 = 그 자리에 놓기
      if (i === drag.slot) { drag = null; held = -1; kick(); return; }
      if (i >= 0 && !used[i]) { held = -1; drag = null; }
      else if (i < 0) { const d = { ...drag, x: p.x, y: p.y, lift: 0 }; if (tryPut(d)) { drag = null; held = -1; } kick(); return; }
      else return;
    }
    if (i < 0 || used[i]) return;
    try { cv.setPointerCapture(e.pointerId); } catch {}
    drag = { slot: i, x: p.x, y: p.y, x0: p.x, y0: p.y, at: performance.now(), id: e.pointerId, moved: false, lift: touch ? cs * 1.6 : 0 };
    tone(440, .04, 'triangle', .04); kick();
  };
  const move = e => {
    if (!drag) return;
    const p = pos(e);
    if (drag.held) { if (e.pointerType === 'mouse') { drag.x = p.x; drag.y = p.y; kick(); } return; }   // 집은 장비는 마우스를 따라다님(터치는 판을 누른 자리)
    if (e.pointerId !== drag.id) return;
    drag.x = p.x; drag.y = p.y; if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > cs * .3) drag.moved = true; kick();
  };
  const up = e => {
    if (!drag || drag.held || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (state !== 'play') { kick(); return; }
    if (!d.moved && slotAt(d) === d.slot) { held = d.slot; drag = { slot: d.slot, held: true, x: null, y: null, lift: 0 }; kick(); return; }   // 끌지 않고 눌렀다 뗌 → 집기
    tryPut(d); kick();
  };
  const cancel = e => { if (drag && !drag.held && (!e || e.pointerId === drag.id)) { drag = null; kick(); } };
  const leave = () => { if (drag?.held) { drag.x = drag.y = null; kick(); } };
  cv.addEventListener('pointerleave', leave);
  stopBtn.onclick = () => {   // 두 번 눌러 확인
    if (state !== 'play') return;
    if (!stopBtn.classList.contains('ask')) { stopBtn.classList.add('ask'); stopBtn.textContent = '한 번 더 누르면 끝'; clearTimeout(stopT); stopT = setTimeout(() => { stopBtn.classList.remove('ask'); stopBtn.textContent = '그만하기'; }, 2500); return; }
    clearTimeout(stopT); stopBtn.classList.remove('ask'); stopBtn.textContent = '그만하기'; stopBtn.blur(); end('quit');
  };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', cancel);

  // 점수 굴러 올라가기: 화면 숫자가 실제 점수를 0.45초 동안 따라잡음(큰 점수일수록 빠르게 돌아감) + 얻은 점수 '+N' 팝
  let shown = 0, rollRaf = 0, rollFrom = 0, rollAt = 0;
  function showScore(pts) {
    const sc = $('sc'), g = $('gain');
    rollFrom = shown; rollAt = performance.now();
    if (!rollRaf) rollRaf = requestAnimationFrame(roll);
    sc.classList.remove('bump', 'big'); void sc.offsetWidth; sc.classList.add(pts >= 100 ? 'big' : 'bump');
    g.textContent = '+' + pts.toLocaleString('ko-KR'); g.className = 'bl-gain'; void g.offsetWidth; g.className = 'bl-gain on' + (pts >= 100 ? ' hot' : '');
  }
  function roll() {
    const k = Math.min(1, (performance.now() - rollAt) / 450), e = 1 - (1 - k) ** 3;
    shown = Math.round(rollFrom + (st.score - rollFrom) * e); $('sc').textContent = shown.toLocaleString('ko-KR');
    rollRaf = k < 1 && !dead ? requestAnimationFrame(roll) : 0;
  }
  function put(slot, r, c, t) {
    const pi = set[slot], s = PIECES[pi].s, k = kindOf(pi), now = performance.now(), prevB = b.slice();
    moves.push(enc(t, slot, r, c));
    const res = place(b, st, s, r, c, KEYS.indexOf(k) + 1);
    used[slot] = true; lines += res.n;
    for (const [dr, dc] of s) { born[(r + dr) * N + c + dc] = now; cellArt[(r + dr) * N + c + dc] = { pi, dr, dc }; }
    const bx = BX(), by = BY(), [h, w] = dims(s), cx = bx + (c + w / 2) * cs, cy = by + (r + h / 2) * cs;
    if (res.n) {
      const ox = res.rows.length ? bx + cs * 4 : cx, oy = res.cols.length && !res.rows.length ? by + cs * 4 : res.rows.length ? by + (res.rows.reduce((a, y) => a + y, 0) / res.rows.length + .5) * cs : cy;
      res.cells.forEach(i => { const dist = res.rows.includes(Math.floor(i / N)) ? Math.abs(i % N - (c + w / 2)) : Math.abs(Math.floor(i / N) - (r + h / 2)); fx.push({ i, a2: cellArt[i], t: now, dl: dist * 28, a: Math.random() * 6 }); });
      const cb = Math.min(st.combo, 10), from = (res.rows.length ? c + w / 2 : r + h / 2) - .5;
      res.rows.forEach(y => beams.push({ row: y, from: c + w / 2 - .5, t: now, c: KINDS[k][1] }));
      res.cols.forEach(x => beams.push({ col: x, from: r + h / 2 - .5, t: now, c: KINDS[k][1] }));
      res.cells.forEach(i => {   // 칸마다 조각 4개 + 별 1개(많이 지우면 조금 줄여 느린 기기 보호)
        const x = bx + (i % N + .5) * cs, y = by + (Math.floor(i / N) + .5) * cs, col = KINDS[KEYS[prevB[i] ? prevB[i] - 1 : KEYS.indexOf(k)] || k][1], nn = res.cells.length > 24 ? 2 : 4;
        for (let j = 0; j < nn; j++) parts.push({ x, y, vx: (Math.random() - .5) * cs * .3, vy: -cs * (.08 + Math.random() * .22), r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: cs * (.16 + Math.random() * .16), c: col, t: now + Math.random() * 60, life: 650 + Math.random() * 300 });
        parts.push({ star: true, x, y, vx: (Math.random() - .5) * cs * .2, vy: -cs * (.15 + Math.random() * .15), r: 0, vr: 0, s: cs * (.18 + Math.random() * .14), t: now, life: 600 });
      });
      flash = { t: now, a: Math.min(.5, .14 + .12 * res.n) }; bump(3 + res.n * 3 + cb);
      floats.push({ s: res.clear ? '가방 싹 비움!' : CLEAR_NAME[Math.min(res.n, 4) - 1], x: ox, y: oy - cs * .45, t: now, big: true, c: '#ffe27a', sc: 1 + Math.min(res.n - 1, 3) * .18, rb: res.clear || res.n >= 3 });
      if (st.combo > 1) floats.push({ s: `콤보 ×${cb}`, x: bx + cs * 4, y: by + cs * 1.2, t: now + 90, big: true, rb: true, sc: 1 + cb * .05 });
      floats.push({ s: '+' + res.pts.toLocaleString('ko-KR') + (st.combo > 1 ? `  연속 ×${Math.min(st.combo, 10)}` : ''), x: ox, y: oy + cs * .35, t: now + 60, c: '#9ff0a8' });
      noise(.22, .5, 2600, 'highpass'); tone(110, .28, 'sine', .22, 0, 45); if (res.n >= 2) { noise(.35, .35, 500, 'lowpass', .02); tone(70, .4, 'sine', .25, .03, 35); }
      [0, 4, 7, 12, 16].slice(0, Math.min(5, res.n + 2)).forEach((n, j) => tone(523 * 2 ** ((n + Math.min(st.combo, 8)) / 12), .14, 'square', .045, .03 + j * .055));
      if (navigator.vibrate) try { navigator.vibrate(res.n >= 2 ? [22, 30, 30] : 24); } catch {}
    } else {
      floats.push({ s: '+' + res.pts, x: cx, y: cy, t: now, c: '#fff' }); bump(2.2);
      tone(150, .1, 'sine', .16, 0, 60); noise(.05, .3, 900); tone(240, .05, 'triangle', .04, .02);
      if (navigator.vibrate) try { navigator.vibrate(8); } catch {}
    }
    rings.push({ x: cx, y: cy, w: w * cs, h: h * cs, t: now });
    showScore(res.pts);
    $('cb').textContent = st.combo; $('cbw').classList.toggle('on', st.combo > 1); if (res.n && st.combo > 1) { $('cbw').classList.remove('pop'); void $('cbw').offsetWidth; $('cbw').classList.add('pop'); }
    if (used.every(Boolean)) { set = nextSet(rand, b, moves.length); used = [false, false, false]; setAt = now + 120; tone(660, .05, 'sine', .035, .1); }
    if (moves.length >= MAX_MOVES) end('max');
    else if (!set.some((pi2, i) => !used[i] && canPlace(b, PIECES[pi2].s))) { state = 'ending'; endT = setTimeout(() => end('stuck'), 650); }
    kick();
  }

  function kick() { if (!raf && !dead) raf = requestAnimationFrame(loop); }
  function loop() { raf = 0; if (dead) return; draw(); const now = performance.now(); if ((drag && !drag.held) || busyFx(now) || fx.length || floats.length || now - setAt < 400 || born.some(x => x && now - x < 170)) raf = requestAnimationFrame(loop); }

  /* ----- 판 흐름 ----- */
  function ready() {
    state = 'ready'; ov.hidden = false; ov.className = 'ml-ov';
    ov.innerHTML = `<b>카메라 가방 정리!</b><span>장비를 끌어다 카메라 가방에 넣어요 <small>(눌러서 집고 가방 칸을 눌러도 돼요)</small><br>가로·세로 한 줄이 꽉 차면 <em>쏙!</em> · 놓을 곳이 없으면 끝<br>연속으로 정리하면 점수가 몇 배로!</span><button type="button" class="btn big" data-m="go">시작</button>`;
    $('go').onclick = start; draw();
  }
  async function start() {
    if (busy || dead) return; busy = true;
    const go = $('go'); if (go) { go.disabled = true; go.textContent = '준비 중…'; }
    let seed = null; try { seed = await opt.seed?.(); } catch {}
    busy = false; if (dead) return;
    clearTimeout(endT);
    rand = rng(seed == null ? Math.floor(Math.random() * 4294967296) : seed);
    b = newBoard(); cellArt = []; st = { score: 0, combo: 0, miss: 0 }; moves = []; lines = 0; fx = []; floats = []; born = []; parts = []; beams = []; rings = []; drag = null; held = -1;
    set = nextSet(rand, b, 0); used = [false, false, false]; setAt = performance.now() + 150;
    shown = 0; cancelAnimationFrame(rollRaf); rollRaf = 0; $('sc').textContent = 0; $('gain').className = 'bl-gain'; $('cb').textContent = 0; $('cbw').classList.remove('on');
    state = 'play'; t0 = performance.now(); ov.hidden = true; stopBtn.hidden = false; tone(523, .08, 'triangle', .06); tone(784, .12, 'triangle', .06, .08);
    fit(); kick();
  }
  function end(why) {
    if (state !== 'play' && state !== 'ending') return;
    const ms = Math.round(performance.now() - t0); state = 'over'; drag = null; held = -1; stopBtn.hidden = true; clearTimeout(stopT); stopBtn.classList.remove('ask'); stopBtn.textContent = '그만하기';
    const nb = st.score > best; if (nb) { best = st.score; $('best').textContent = best.toLocaleString('ko-KR'); }
    tone(nb ? 784 : 392, .14, 'triangle', .07); tone(nb ? 1047 : 330, .22, 'triangle', .07, .14);
    ov.hidden = false; ov.className = 'ml-ov end';
    ov.innerHTML = `<b>${why === 'max' ? '오늘 정리는 여기까지!' : why === 'quit' ? '여기까지 정리!' : '가방이 꽉 찼어요!'}</b><p class="ml-sc">${st.score.toLocaleString('ko-KR')}<small>점</small></p><span>${lines}줄 정리 · 장비 ${moves.length}개${nb ? ' · 최고 기록 경신!' : ''}</span>
      <small class="ml-msg" data-m="msg"></small><button type="button" class="btn big" data-m="go">한 번 더</button>`;
    $('go').onclick = start; draw();
    opt.onOver?.({ score: st.score, n: moves.length, lines, ms, why, nb, rounds: [ms, ...moves] });
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe(root);
  rand = rng(1); set = nextSet(rand, b, 0); used = [false, false, false]; ready(); fit();
  return {
    start,
    msg(html) { const m = $('msg'); if (m) m.innerHTML = html; },
    setBest(v, force) { if (force || v > best) { best = v; $('best').textContent = v.toLocaleString('ko-KR'); } },
    destroy() { dead = true; const as = root.closest('.fl')?.querySelector(':scope > .fl-side'); if (as) as.style.marginTop = ''; cancelAnimationFrame(rollRaf); clearTimeout(endT); clearTimeout(stopT); cancelAnimationFrame(raf); ro.disconnect(); try { ac?.close(); } catch {} },
    get st() { return { state, score: st.score, combo: st.combo, board: b, set, used, moves, cs, pad, horiz, held }; },
    slotRect, end, _art: (pi, s) => art(pi, s).c,   // 테스트용
    _put(slot, r, c) { if (state === 'play' && !used[slot] && fits(b, PIECES[set[slot]].s, r, c)) { put(slot, r, c, Math.round(performance.now() - t0)); return true; } return false; },   // 테스트용
  };
}
