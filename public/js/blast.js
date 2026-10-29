// SVMHS GROUND — 카메라 가방 정리!(블록 블라스트 방식, 2026-10-29 하율, 미리보기 깃발 blast-game)
// 8×8 카메라 가방에 장비 3개를(2026-10-29 하율 "카메라 가방 안에 장비들을 넣는 컨셉") 끌어다 놓기 → 가로·세로 줄이 꽉 차면 정리. 놓을 곳이 없으면 끝. 규칙·검사는 blast-score.js(서버와 같음)
// createBlast(root, { best, sound, seed: async () => 씨앗|null, onOver(res), onSound(on) })
//   res = { score, n, lines, ms, rounds: [끝난 ms, ...놓기], why: 'stuck'|'max'|'quit' }
// 조작(2026-10-29 출시 준비): ① 끌어다 놓기 ② 눌러서 집기 → 판을 눌러 놓기(트랙패드·터치에서 끌기 어려울 때) · 다시 누르면 내려놓기
//   '그만하기'(두 번 눌러 확인) = 쉬는 시간이 끝날 때 지금 점수로 기록 남기기
import { N, PIECES, MAX_MOVES, MIN_GAP, rng, newBoard, fits, canPlace, nextSet, place, enc } from './blast-score.js';

const KINDS = {
  bat: ['배터리', '#ffd25e'], lens: ['렌즈', '#8fb8ff'], sd: ['SD 카드', '#5fd0b5'], led: ['LED 패널', '#ffb347'], boom: ['붐 마이크', '#ff8f5a'],
  cam: ['카메라', '#6aa7ff'], case: ['하드 케이스', '#9d8cff'], mon: ['모니터', '#4fc3f7'], slide: ['슬라이더', '#ff7aa8'], tri: ['삼각대', '#ffa94d'],
  cst: ['C스탠드', '#ff5a6e'], cab: ['XLR 케이블', '#b48cff'], light: ['조명 스탠드', '#7bd88f'],
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
    // 2026-10-29 하율 "싹다 실제 물건처럼 디벨롭": 장비마다 실제 모양(링·단자·걸쇠·털 바람막이 등)과 재질(금속·고무·유리) 음영
    const L = Math.max(w, h); if (['lens', 'led', 'boom'].includes(k) && h > w) g.setTransform(0, 1, -1, 0, w * S, 0);
    const Y = S * .46, RUB = '#2c2e3d', RUB2 = '#3b3e52';
    let sd0 = pi * 7919 + 13; const rnd = () => (sd0 = (sd0 * 16807) % 2147483647) / 2147483647;   // 털·질감용 고정 난수(판마다 같은 그림)
    const metalG = (x, y, ww, hh, vert = true) => { const gr = vert ? g.createLinearGradient(0, y, 0, y + hh) : g.createLinearGradient(x, 0, x + ww, 0); gr.addColorStop(0, '#f4f6fb'); gr.addColorStop(.45, '#b9c0cf'); gr.addColorStop(.55, '#9aa2b4'); gr.addColorStop(1, '#dfe4ee'); return gr; };
    const metal = (x, y, ww, hh, r, vert = true) => { rr(x, y, ww, hh, r, D); rr(x + S * .025, y + S * .025, ww - S * .05, hh - S * .05, r * .7, metalG(x, y, ww, hh, vert)); };
    const ribs = (x, y, ww, hh, step, cl, vert = true) => { g.fillStyle = cl; if (vert) for (let q = x + step / 2; q < x + ww - step / 3; q += step) g.fillRect(q, y, Math.max(1, step * .38), hh); else for (let q = y + step / 2; q < y + hh - step / 3; q += step) g.fillRect(x, q, ww, Math.max(1, step * .38)); };
    const txt = (t, x, y, sz, cl = '#fff', wt = 900) => { g.fillStyle = cl; g.font = `${wt} ${sz}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); };
    const pole = (pts, ww) => { g.lineCap = g.lineJoin = 'round'; [[ww, D], [ww * .64, '#8e97aa'], [ww * .26, '#f1f4fa']].forEach(([lw2, cl]) => { g.lineWidth = lw2; g.strokeStyle = cl; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(...cc(p)) : g.moveTo(...cc(p))); g.stroke(); }); };
    const seg = (x0, y0, x1, y1, ww, cl = '#8e97aa') => { g.lineCap = 'round'; [[ww, D], [ww * .6, cl], [ww * .22, '#f1f4fa']].forEach(([lw2, c2]) => { g.lineWidth = lw2; g.strokeStyle = c2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }); };
    const knob = (x, y, r) => { dot(x, y, r, D); dot(x, y, r * .72, RUB2); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(1, r * .18); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .35, y + Math.sin(a) * r * .35); g.lineTo(x + Math.cos(a) * r * .66, y + Math.sin(a) * r * .66); g.stroke(); } };
    const glass = (x, y, rx, ry = rx) => { const gr = g.createRadialGradient(x - rx * .3, y - ry * .35, rx * .05, x, y, Math.max(rx, ry)); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.25, '#c9e6ff'); gr.addColorStop(.6, '#5a7fe0'); gr.addColorStop(1, '#2a2f6b'); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(255,190,255,.55)'; g.lineWidth = Math.max(1, rx * .08); g.beginPath(); g.ellipse(x, y, rx * .7, ry * .7, 0, Math.PI * .9, Math.PI * 1.35); g.stroke(); dot(x - rx * .35, y - ry * .4, Math.min(rx, ry) * .14, 'rgba(255,255,255,.95)'); };
    const fan = (end, prev, len, ww) => {   // 끝 칸에서 바깥쪽으로 퍼지는 다리 3개(삼각대 받침)
      const [ex, ey] = cc(end), [px2, py2] = cc(prev), a0 = Math.atan2(ey - py2, ex - px2);
      [-.75, 0, .75].forEach(da => seg(ex, ey, ex + Math.cos(a0 + da) * len, ey + Math.sin(a0 + da) * len, ww, RUB2));
      [-.75, 0, .75].forEach(da => dot(ex + Math.cos(a0 + da) * len, ey + Math.sin(a0 + da) * len, ww * .55, D));
      dot(ex, ey, ww * .85, D); dot(ex, ey, ww * .5, '#8e97aa');
    };
    if (k === 'bat') {   // 캠코더 배터리: 위 단자 + 검은 라벨 + 잔량 칸 + 전압
      rr(S * .22, S * .1, S * .56, S * .16, S * .04, RUB); [.31, .45, .59].forEach(x => rr(S * x, S * .14, S * .09, S * .08, S * .015, '#ffd25e'));
      rr(S * .17, S * .32, S * .66, S * .42, S * .07, RUB); rr(S * .17, S * .32, S * .66, S * .07, [S * .07, S * .07, 0, 0], mix(col, '#ffffff', .25));
      [0, 1, 2, 3].forEach(i => rr(S * (.24 + i * .135), S * .46, S * .1, S * .11, S * .02, i < 3 ? '#7bd88f' : 'rgba(255,255,255,.15)'));
      txt('7.4V', S * .5, S * .65, S * .1);
    } else if (k === 'lens') {   // 줌 렌즈 옆모습: 마운트(금속) → 초점 링(고무 홈) → 거리 창 → 줌 링 → 빨간 띠 → 후드 → 앞 유리
      metal(S * .1, S * .2, S * .2, S * .52, S * .04, false); g.fillStyle = 'rgba(30,30,60,.35)'; g.fillRect(S * .19, S * .22, S * .02, S * .48);
      rr(S * .38, S * .13, S * .46, S * .66, S * .05, RUB); ribs(S * .39, S * .15, S * .44, S * .62, S * .06, 'rgba(255,255,255,.15)');
      rr(S * .92, S * .3, S * .26, S * .14, S * .03, '#1d1f2b'); g.fillStyle = '#fff'; [0, 1, 2, 3].forEach(i => g.fillRect(S * (.95 + i * .055), S * .33, Math.max(1, S * .015), S * .06)); g.fillStyle = '#ffb347'; g.fillRect(S * 1.04, S * .4, Math.max(1, S * .02), S * .03);
      rr(S * 1.2, S * .13, S * .26, S * .66, S * .05, RUB2); ribs(S * 1.21, S * .15, S * .24, S * .62, S * .07, 'rgba(255,255,255,.12)');
      g.fillStyle = '#e8384f'; g.fillRect(S * 1.5, S * .16, S * .05, S * .6);
      rr(S * 1.58, S * .07, S * .3, S * .78, S * .07, RUB); glass(S * 1.83, Y, S * .11, S * .32);
    } else if (k === 'sd') {   // SD 카드: 오른쪽 위 깎임 + 쓰기 방지 스위치 + 라벨
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(S * .64, 0); g.lineTo(S, 0); g.lineTo(S, S * .36); g.closePath(); g.fill(); g.restore();
      g.lineWidth = Math.max(1, S * .05); g.strokeStyle = dk; g.beginPath(); g.moveTo(S * .62, m + lw * .5); g.lineTo(S - m - lw * .5, S * .38); g.stroke();
      rr(S * .2, S * .16, S * .4, S * .1, S * .02, mix(col, INK, .35));
      rr(S * .2, S * .32, S * .6, S * .42, S * .05, RUB); rr(S * .2, S * .32, S * .6, S * .06, [S * .05, S * .05, 0, 0], '#ffd25e');
      txt('SD', S * .5, S * .5, S * .17); txt('64GB', S * .5, S * .65, S * .08, '#cfd6e6', 800);
      rr(m + lw * .2, S * .44, S * .08, S * .16, S * .02, '#fff'); rr(m + lw * .2, S * .44, S * .08, S * .06, S * .02, '#8e97aa');
    } else if (k === 'led') {   // LED 패널: 검은 테 + 반투명 확산판 + 흰·주황 LED 칩 줄 + 끝 조절 다이얼 2개·표시창
      const x1 = L * S - S * .62;
      rr(S * .13, S * .13, L * S - S * .26, S * .66, S * .08, RUB);
      const gr = g.createLinearGradient(0, S * .2, 0, S * .72); gr.addColorStop(0, '#fffdf0'); gr.addColorStop(1, '#ffe7a3'); rr(S * .2, S * .2, x1 - S * .2, S * .52, S * .05, gr);
      g.shadowColor = '#ffe27a'; g.shadowBlur = S * .1; let n = 0;
      for (let x = S * .3; x < x1 - S * .08; x += S * .17) for (const y of [.3, .46, .62]) rr(x, S * y - S * .04, S * .08, S * .08, S * .015, n++ % 2 ? '#ffc35a' : '#ffffff');
      g.shadowBlur = 0;
      rr(x1 + S * .06, S * .2, S * .2, S * .12, S * .02, '#1d1f2b'); txt('56', x1 + S * .16, S * .26, S * .08, '#7bd88f');
      knob(x1 + S * .16, S * .48, S * .09); knob(x1 + S * .16, S * .66, S * .07);
    } else if (k === 'boom') {   // 샷건 마이크 + 털 바람막이(데드캣): 왼쪽 XLR 단자(금속) → 슬롯 있는 몸통 → 오른쪽 털
      metal(S * .1, S * .28, S * .36, S * .36, S * .06, true); g.fillStyle = 'rgba(30,30,60,.4)'; [.2, .3].forEach(x => g.fillRect(S * x, S * .3, Math.max(1, S * .02), S * .32));
      const tg = g.createLinearGradient(0, S * .24, 0, S * .68); tg.addColorStop(0, '#5a5e74'); tg.addColorStop(.4, '#2c2e3d'); tg.addColorStop(1, '#1b1d29');
      rr(S * .44, S * .24, S * 1.9, S * .44, S * .12, tg);
      g.fillStyle = 'rgba(0,0,0,.55)'; for (let x = S * 1.1; x < S * 2.2; x += S * .14) { rr(x, S * .32, S * .08, S * .07, S * .02, 'rgba(0,0,0,.6)'); rr(x, S * .53, S * .08, S * .07, S * .02, 'rgba(0,0,0,.6)'); }
      rr(S * .6, S * .37, S * .34, S * .18, S * .03, '#e6eaf4'); txt('MIC', S * .77, S * .465, S * .1, RUB, 900);
      const fx0 = S * 2.2, fx1 = L * S - S * .1, fc = (fx0 + fx1) / 2, frx = (fx1 - fx0) / 2;
      g.save(); g.beginPath(); g.ellipse(fc, Y, frx, S * .38, 0, 0, 7); g.clip();   // 털이 장비 밖으로 삐져나가지 않게
      g.fillStyle = '#a99e89'; g.fillRect(fx0 - S, 0, frx * 2 + S * 2, S);
      g.lineCap = 'round'; const FUR = ['#7f7564', '#c9bfab', '#e3dccd', '#968b77'];
      for (let i = 0; i < 260; i++) { const a = rnd() * Math.PI * 2, rr2 = Math.sqrt(rnd()), x = fc + Math.cos(a) * frx * rr2, y = Y + Math.sin(a) * S * .34 * rr2, d = .1 + rnd() * .12; g.strokeStyle = FUR[i % 4]; g.lineWidth = Math.max(1, S * .035); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + .4) * S * d, y + Math.sin(a + .4) * S * d * .8); g.stroke(); }
      g.restore();
    } else if (k === 'cam') {   // 미러리스 카메라 앞모습: 모드 다이얼·핫슈·셔터 버튼 / 왼쪽 고무 그립 / 가운데 렌즈(초점 링·유리)
      rr(S * .24, S * .06, S * .38, S * .16, S * .05, RUB2); ribs(S * .26, S * .07, S * .34, S * .14, S * .06, 'rgba(255,255,255,.2)');
      rr(S * .86, S * .08, S * .4, S * .14, S * .03, RUB); rr(S * .92, S * .11, S * .28, S * .05, S * .01, '#8e97aa');
      dot(S * 1.62, S * .17, S * .11, metalG(S * 1.5, S * .06, S * .24, S * .22), D);
      rr(S * .12, S * .3, S * .44, S * 1.42, S * .14, RUB); g.fillStyle = 'rgba(255,255,255,.08)'; for (let y = S * .4; y < S * 1.66; y += S * .09) for (let x = S * .2; x < S * .5; x += S * .09) g.fillRect(x, y, Math.max(1, S * .03), Math.max(1, S * .03));
      txt('SVMHS', S * 1.12, S * .4, S * .13, '#fff');
      dot(S * 1.74, S * .48, S * .06, '#ffb347', D);
      const lx = S * 1.14, ly = S * 1.1;
      dot(lx, ly, S * .68, D); dot(lx, ly, S * .6, metalG(lx - S * .6, ly - S * .6, S * 1.2, S * 1.2));
      dot(lx, ly, S * .52, RUB); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = Math.max(1, S * .03); for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; g.beginPath(); g.moveTo(lx + Math.cos(a) * S * .42, ly + Math.sin(a) * S * .42); g.lineTo(lx + Math.cos(a) * S * .51, ly + Math.sin(a) * S * .51); g.stroke(); }
      dot(lx, ly, S * .4, '#15171f'); glass(lx, ly, S * .32); dot(lx, ly, S * .1, 'rgba(20,20,50,.55)');
    } else if (k === 'case') {   // 하드 케이스(펠리컨식): 손잡이 · 뚜껑 이음선 · 걸쇠 2개 · 자물쇠 고리 · 세로 보강 홈 · 라벨 · 발
      g.lineWidth = S * .13; g.strokeStyle = D; g.beginPath(); g.roundRect(S * 1.08, S * .2, S * .84, S * .34, S * .14); g.stroke();
      g.lineWidth = S * .06; g.strokeStyle = RUB2; g.beginPath(); g.moveTo(S * 1.2, S * .2); g.lineTo(S * 1.8, S * .2); g.stroke();
      g.fillStyle = 'rgba(20,20,50,.35)'; g.fillRect(S * .2, S * .98, S * 2.6, S * .05); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(S * .2, S * 1.03, S * 2.6, S * .025);
      for (let x = S * .45; x < S * 2.7; x += S * .3) { if (x > S * .9 && x < S * 2.1) continue; g.fillStyle = 'rgba(20,20,50,.16)'; g.fillRect(x, S * 1.2, S * .07, S * 1.3); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + S * .07, S * 1.2, S * .025, S * 1.3); }
      [S * .5, S * 2.14].forEach(x => { rr(x, S * .7, S * .36, S * .56, S * .07, RUB); rr(x + S * .06, S * .76, S * .24, S * .3, S * .04, metalG(x, S * .76, S * .24, S * .3)); dot(x + S * .18, S * 1.15, S * .04, '#8e97aa'); });
      rr(S * 1.36, S * .78, S * .28, S * .34, S * .05, RUB); dot(S * 1.5, S * .95, S * .06, mix(col, INK, .2));
      rr(S * .95, S * 1.42, S * 1.1, S * .52, S * .08, '#fff'); txt('SVMHS', S * 1.5, S * 1.6, S * .2, D); txt('MEDIA GEAR', S * 1.5, S * 1.8, S * .1, '#8e97aa', 800);
      rr(S * .38, S * 2.68, S * .44, S * .12, S * .04, D); rr(S * 2.18, S * 2.68, S * .44, S * .12, S * .04, D);
    } else if (k === 'mon') {   // 촬영 모니터: 두꺼운 고무 테 · 화면(장면 + REC·안전 프레임 모서리·히스토그램) · 아래 버튼 줄
      const x0 = S * .18, y0 = S * .16, ww = w * S - S * .36, hh = h * S - S * .62;
      rr(x0, y0, ww, hh, S * .12, RUB);
      const sx0 = x0 + S * .1, sy0 = y0 + S * .1, sw = ww - S * .2, shh = hh - S * .2;
      const gr = g.createLinearGradient(0, sy0, 0, sy0 + shh); gr.addColorStop(0, '#8fd3ff'); gr.addColorStop(1, '#ffd6a8');
      g.save(); g.beginPath(); g.roundRect(sx0, sy0, sw, shh, S * .04); g.clip(); g.fillStyle = gr; g.fillRect(sx0, sy0, sw, shh);
      dot(sx0 + sw * .72, sy0 + shh * .32, S * .14, '#fff6c2');
      g.fillStyle = '#6a86d9'; g.beginPath(); g.moveTo(sx0, sy0 + shh); g.lineTo(sx0 + sw * .3, sy0 + shh * .5); g.lineTo(sx0 + sw * .55, sy0 + shh * .78); g.lineTo(sx0 + sw * .78, sy0 + shh * .58); g.lineTo(sx0 + sw, sy0 + shh * .82); g.lineTo(sx0 + sw, sy0 + shh); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1, S * .03); const bi = S * .12, bl = S * .16;
      [[sx0 + bi, sy0 + bi, 1, 1], [sx0 + sw - bi, sy0 + bi, -1, 1], [sx0 + bi, sy0 + shh - bi, 1, -1], [sx0 + sw - bi, sy0 + shh - bi, -1, -1]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x, y + b * bl); g.lineTo(x, y); g.lineTo(x + a * bl, y); g.stroke(); });
      dot(sx0 + S * .2, sy0 + S * .2, S * .05, '#ff3b4e'); txt('REC', sx0 + S * .38, sy0 + S * .2, S * .09, '#fff');
      g.fillStyle = 'rgba(255,255,255,.75)'; [3, 6, 9, 7, 4, 5, 2].forEach((v, i) => g.fillRect(sx0 + sw - S * .55 + i * S * .055, sy0 + shh - S * .14 - v * S * .018, Math.max(1, S * .035), v * S * .018));
      g.restore();
      const by = y0 + hh + S * .1; [0, 1, 2, 3].forEach(i => rr(x0 + S * .15 + i * S * .26, by, S * .18, S * .1, S * .03, RUB));
      dot(x0 + ww - S * .15, by + S * .05, S * .05, '#7bd88f');
    } else if (k === 'slide') {   // 카메라 슬라이더: 금속 레일 2줄 · 양 끝 고정 블록 · 가운데 캐리지 + 볼 헤드
      const p = walk(); g.lineCap = g.lineJoin = 'round';
      [[S * .42, D], [S * .32, '#8e97aa'], [S * .1, D], [S * .04, '#5a6178']].forEach(([lw2, cl]) => { g.lineWidth = lw2; g.strokeStyle = cl; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(...cc(q)) : g.moveTo(...cc(q))); g.stroke(); });
      p.filter(q => nb(q).length === 1).forEach(q => { const [x, y] = cc(q); rr(x - S * .24, y - S * .24, S * .48, S * .48, S * .08, RUB); dot(x, y, S * .07, '#8e97aa'); });
      const [x, y] = cc(p[1]); rr(x - S * .27, y - S * .27, S * .54, S * .54, S * .1, D); rr(x - S * .22, y - S * .22, S * .44, S * .44, S * .07, mix(col, INK, .25));
      dot(x, y, S * .15, metalG(x - S * .15, y - S * .15, S * .3, S * .3), D); dot(x - S * .04, y - S * .05, S * .04, '#fff');
    } else if (k === 'tri') {   // 삼각대: 가운데 팬 헤드(수평계) · 다리 3개는 굵은 윗단 → 가는 아랫단 + 다리 잠금 레버 + 고무 발
      const j = sh.find(p => nb(p).length === 3), [jx, jy] = cc(j);
      for (const q of nb(j)) {
        const [x, y] = cc(q), mx = jx + (x - jx) * .55, my = jy + (y - jy) * .55, ex = jx + (x - jx) * 1.3, ey = jy + (y - jy) * 1.3;
        seg(mx, my, ex, ey, S * .14); seg(jx, jy, mx, my, S * .22);
        g.save(); g.translate(mx, my); g.rotate(Math.atan2(y - jy, x - jx)); rr(-S * .07, -S * .16, S * .14, S * .32, S * .03, RUB); g.restore();
        dot(ex, ey, S * .1, D);
      }
      rr(jx - S * .3, jy - S * .24, S * .6, S * .48, S * .12, D); rr(jx - S * .24, jy - S * .18, S * .48, S * .36, S * .08, RUB2);
      dot(jx, jy, S * .12, '#9be3a4', D); dot(jx - S * .03, jy - S * .03, S * .03, '#fff');
    } else if (k === 'cst') {   // C스탠드: 은색 기둥 · 꺾이는 곳 그립 헤드(원판 + T 손잡이) · 한쪽 끝 받침 다리 · 다른 끝 고무 마개
      const p = walk(); pole(p, S * .2);
      const kn = p.find((q, i) => i > 0 && i < p.length - 1 && (p[i - 1][0] - q[0]) * (p[i + 1][1] - q[1]) !== (p[i - 1][1] - q[1]) * (p[i + 1][0] - q[0]));
      if (kn) { const [x, y] = cc(kn); dot(x, y, S * .24, D); dot(x, y, S * .19, metalG(x - S * .2, y - S * .2, S * .4, S * .4)); dot(x, y, S * .07, D); seg(x, y, x + S * .22, y - S * .22, S * .09, RUB2); dot(x + S * .22, y - S * .22, S * .07, RUB); }
      fan(p[0], p[1], S * .3, S * .12);   // 경로 첫 끝 = 받침, 마지막 끝 = 고무 마개
      const [fx2, fy2] = cc(p[p.length - 1]); rr(fx2 - S * .14, fy2 - S * .14, S * .28, S * .28, S * .06, RUB);
    } else if (k === 'cab') {   // XLR 케이블: 굵은 검은 선(광택) · 양 끝 금속 커넥터 + 색 부츠 + 핀 3개
      const p = walk().map(cc); g.lineCap = g.lineJoin = 'round';
      [[S * .3, D], [S * .2, RUB2], [S * .05, 'rgba(255,255,255,.35)']].forEach(([lw2, cl]) => { g.lineWidth = lw2; g.strokeStyle = cl; g.beginPath(); g.moveTo(...p[0]); for (let i = 1; i < p.length - 1; i++) g.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2); g.lineTo(...p[p.length - 1]); g.stroke(); });
      [p[0], p[p.length - 1]].forEach(([x, y]) => { dot(x, y, S * .27, D); dot(x, y, S * .22, metalG(x - S * .22, y - S * .22, S * .44, S * .44)); dot(x, y, S * .14, RUB); [0, 1, 2].forEach(i => { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; dot(x + Math.cos(a) * S * .07, y + Math.sin(a) * S * .07, S * .028, '#ffd25e'); }); });
    } else if (k === 'light') {   // 조명 스탠드: 끝 칸 프레넬 조명(동심원 렌즈·반도어) · 은색 기둥 · 잠금 노브 · 반대 끝 받침 다리
      const p = walk(); pole(p, S * .18);
      p.slice(1, -1).forEach(q => { if (nb(q).length === 2) { const [x, y] = cc(q); dot(x, y, S * .09, RUB); } });
      fan(p[p.length - 1], p[p.length - 2], S * .38, S * .12);
      const [lx, ly] = cc(p[0]);
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => rr(lx + a * S * .31 - (a ? S * .04 : S * .1), ly + b * S * .31 - (b ? S * .04 : S * .1), a ? S * .08 : S * .2, a ? S * .2 : S * .08, S * .02, RUB));   // 반도어
      dot(lx, ly, S * .3, D); dot(lx, ly, S * .26, RUB2);
      g.shadowColor = '#ffe27a'; g.shadowBlur = S * .25; dot(lx, ly, S * .2, '#fff6c2'); g.shadowBlur = 0;
      g.strokeStyle = 'rgba(230,170,40,.55)'; g.lineWidth = Math.max(1, S * .025); [.06, .11, .16].forEach(r2 => { g.beginPath(); g.arc(lx, ly, S * r2, 0, 7); g.stroke(); });
      dot(lx - S * .06, ly - S * .06, S * .04, '#fff');
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
