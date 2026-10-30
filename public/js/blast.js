// SVMHS GROUND — LED 월 켜기!(2026-10-29 출시 준비 '카메라 가방 정리!' → 2026-10-30 하율 컨셉 변경, 미리보기 깃발 blast-game)
// 8×8 LED 월에 패널 묶음(장면) 3개를 끌어다 놓기 → 가로·세로 줄이 꽉 차면 정리. 놓을 곳이 없으면 끝. 규칙·검사는 blast-score.js(서버와 같음)
// createBlast(root, { best, sound, seed: async () => 씨앗|null, onOver(res), onSound(on) })
//   res = { score, n, lines, ms, rounds: [끝난 ms, ...놓기], why: 'stuck'|'max'|'quit' }
// 조작(2026-10-29 출시 준비): ① 끌어다 놓기 ② 눌러서 집기 → 판을 눌러 놓기(트랙패드·터치에서 끌기 어려울 때) · 다시 누르면 내려놓기
//   '그만하기'(두 번 눌러 확인) = 쉬는 시간이 끝날 때 지금 점수로 기록 남기기
import { N, PIECES, MAX_MOVES, MIN_GAP, rng, newBoard, fits, canPlace, nextSet, place, enc, kindV, KIND_ORDER } from './blast-score.js';

const KINDS = {   // 2026-10-30 LED 월 컨셉: 장비 종류 키는 규칙(blast-score.js)과 같고, 화면에서는 장면 이름 + 장면 색 두 개(첫 색 = 파편·빛줄기 색)
  bat: ['노을', '#ff9a5a', '#ff4f8b'], sd: ['하늘', '#6fcaff', '#c8efff'], lens: ['바다', '#33b8ff', '#1749c9'], slide: ['숲', '#7be08a', '#1c8f63'],
  cam: ['밤하늘', '#4b4fc2', '#141640'], led: ['네온', '#ff4fd8', '#6f55ff'], tri: ['사막', '#ffd27a', '#ff8f45'], cst: ['벚꽃', '#ffb3d4', '#ff6fa6'],
  cab: ['오로라', '#2fe8bb', '#5a4cf0'], boom: ['용암', '#ffc93a', '#ff3b2c'], light: ['들판', '#e4fa6a', '#6cc23a'], mon: ['도시 야경', '#3a4fae', '#0b1030'],
  case: ['컬러 바', '#e8e23a', '#3a46e0'],
};
const KEYS = Object.keys(KINDS);
const INK = '#2a2846', FONT = 'Outfit,Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
const CLEAR_NAME = ['송출!', '화면 ON!', '풀 스크린!', '완벽한 송출!'];   // 2026-10-30 LED 월 컨셉
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

export function createBlast(root, opt = {}) {
  let best = opt.best || 0, sound = !!opt.sound;
  // 점수판(2026-10-29 하율 "블록 블라스트처럼 — 올라가는 점수가 잘 안 보여 재미없어"): 왼쪽 위 작게 최고 기록, 가운데 큰 점수(올라갈 때 숫자가 굴러 올라감 + 얻은 점수 팝), 오른쪽 버튼
  root.innerHTML = `<div class="ml-top bl-top" data-m="top"><span class="bl-best" title="최고 기록"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#fff3b0" stroke="#5a3a00" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 6H4.5a3 3 0 0 0 3 4.2M17 6h2.5a3 3 0 0 1-3 4.2" fill="none" stroke="#5a3a00" stroke-width="1.8" stroke-linecap="round"/><path d="M12 14v3.4M8.5 20h7l-.8-2.6H9.3z" fill="#fff3b0" stroke="#5a3a00" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.6 6.4v2.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg><small>최고</small><b data-m="best">${best.toLocaleString('ko-KR')}</b></span>
      <div class="bl-score" aria-live="polite"><b data-m="sc">0</b><em class="bl-gain" data-m="gain"></em><span class="bl-cb" data-m="cbw">연속 <i data-m="cb">0</i></span></div>
      <span class="bl-tools"><button type="button" class="btn ghost bl-stop" data-m="stop" hidden>그만하기</button><button type="button" class="btn ghost hr-snd ml-snd" data-m="snd"></button></span></div>
    <div class="ml-board bl-board" data-m="board"><canvas data-m="cv" aria-label="LED 월 켜기! — LED 월"></canvas><div class="ml-ov" data-m="ov"></div></div>`;
  const $ = k => root.querySelector(`[data-m="${k}"]`);
  const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), board = $('board'), sndBtn = $('snd'), stopBtn = $('stop');
  let b = newBoard(), st = { score: 0, combo: 0, miss: 0 }, rand = null, set = [0, 1, 2], used = [true, true, true], moves = [], lines = 0;
  let state = 'ready', cs = 40, pad = 10, W = 0, H = 0, horiz = false, dpr = 1, drag = null, arts = new Map(), cellArt = [], fx = [], floats = [], raf = 0, dead = false, busy = false, t0 = 0, ac = null, born = [], endT = 0, held = -1, setAt = 0, stopT = 0;

  /* ----- 소리(기본 꺼짐) ----- */
  // 2026-10-30 LED 월 디벨롭: 소리는 모두 마스터(압축기 + 짧은 잔향 섞기)로 → 여러 소리가 겹쳐도 찢어지지 않고 공간감
  let master = null;
  function au() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    if (!master) {
      const cp = ac.createDynamicsCompressor(); cp.threshold.value = -16; cp.knee.value = 10; cp.ratio.value = 5; cp.attack.value = .002; cp.release.value = .16;
      const out = ac.createGain(); out.gain.value = .9; cp.connect(out).connect(ac.destination);
      const dry = ac.createGain(), cv2 = ac.createConvolver(), wet = ac.createGain(); wet.gain.value = .22;
      const len = Math.floor(ac.sampleRate * .9), ir = ac.createBuffer(2, len, ac.sampleRate);   // 잔향: 지수로 줄어드는 잡음
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len) ** 3.2; }
      cv2.buffer = ir; dry.connect(cp); dry.connect(cv2).connect(wet).connect(cp); master = dry;
    }
    return ac;
  }
  function tone(f, d, type = 'square', vol = .06, at = 0, f2 = 0) {
    const a = sound && au(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + .02);
  }
  const paintSnd = () => { const t = sound ? '소리 끄기' : '소리 켜기'; sndBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-snd-${sound ? 'on' : 'off'}"/></svg>`; sndBtn.setAttribute('aria-pressed', sound); sndBtn.setAttribute('aria-label', t); sndBtn.dataset.tip = t; };
  sndBtn.onclick = () => { sound = !sound; if (sound) au(); paintSnd(); opt.onSound?.(sound); sndBtn.blur(); };
  paintSnd();

  /* ----- 그림(2026-10-30 하율 "카메라 가방은 블록 안에 물체 넣기가 힘들어 → 다른 컨셉", 추천안 A 'LED 월 켜기'):
     칸 하나 = LED 패널 한 장(원래 네모라 블록 모양과 상관없이 안 깨짐). 조각 하나 = 장면 하나 — 조각 전체 크기로 장면을 그리고 칸(패널) 모양으로만 보이게 자름.
     패널 = 검은 캐비닛 테 + 빛나는 화면 + LED 점 격자 + 위 반사광. 판에 놓인 칸은 그 그림의 해당 칸만 잘라 그림 → 줄이 정리되면 그 줄 패널이 꺼짐 ----- */
  function art(pi, s) {
    const key = pi + ':' + s; let A = arts.get(key); if (A) return A;
    const sh = PIECES[pi].s, k = PIECES[pi].k, [h, w] = dims(sh), S = Math.max(4, Math.round(s * dpr));
    const c = document.createElement('canvas'); c.width = w * S; c.height = h * S;
    const g = c.getContext('2d'), [, c1, c2] = KINDS[k], W0 = w * S, H0 = h * S;
    let sd0 = pi * 7919 + 13; const rnd = () => (sd0 = (sd0 * 16807) % 2147483647) / 2147483647;   // 별·창문용 고정 난수(판마다 같은 그림)
    const ins = S * .045, rad = S * .07;
    for (const [r, q] of sh) { g.fillStyle = '#0a0d1c'; g.beginPath(); g.roundRect(q * S + S * .01, r * S + S * .01, S * .98, S * .98, S * .1); g.fill(); }   // 캐비닛 테(얇게 — 이웃 패널과 이어진 한 화면처럼)
    g.save(); g.beginPath(); for (const [r, q] of sh) g.roundRect(q * S + ins, r * S + ins, S - ins * 2, S - ins * 2, rad); g.clip();
    const gr = g.createLinearGradient(0, 0, W0 * .35, H0); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, W0, H0);
    const L = Math.max(W0, H0), dot = (x, y, r0, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r0, 0, 7); g.fill(); };
    if (k === 'bat') { dot(W0 * .5, H0 * .62, S * .26, '#fff1b8'); g.fillStyle = 'rgba(120,30,70,.55)'; g.fillRect(0, H0 * .7, W0, H0); }                                 // 노을: 해 + 수평선
    else if (k === 'sd') { g.fillStyle = 'rgba(255,255,255,.85)'; [[.35, .55, .2], [.58, .5, .24], [.75, .6, .16]].forEach(([x, y, r0]) => { g.beginPath(); g.arc(W0 * x, H0 * y, S * r0, 0, 7); g.fill(); }); }   // 하늘: 구름
    else if (k === 'lens' || k === 'cab') {   // 바다: 물결 / 오로라: 빛 띠
      g.strokeStyle = k === 'lens' ? 'rgba(255,255,255,.5)' : 'rgba(190,255,230,.55)'; g.lineWidth = S * (k === 'lens' ? .07 : .16); g.lineCap = 'round';
      for (let j = 0; j < (k === 'lens' ? 3 : 2); j++) { g.beginPath(); const y0 = H0 * (.3 + j * .25); for (let x = 0; x <= W0; x += S * .1) g.lineTo(x, y0 + Math.sin(x / S * 3 + j * 2) * S * .12); g.stroke(); }
    } else if (k === 'slide') { g.fillStyle = 'rgba(10,70,45,.5)'; for (let x = 0; x < W0; x += S * .5) { g.beginPath(); g.moveTo(x, H0); g.lineTo(x + S * .25, H0 - S * (.8 + rnd() * .6)); g.lineTo(x + S * .5, H0); g.fill(); } }   // 숲: 나무
    else if (k === 'cam') { for (let j = 0; j < 22; j++) dot(rnd() * W0, rnd() * H0, S * (.025 + rnd() * .04), '#fffbe0'); dot(W0 * .72, H0 * .28, S * .2, '#fff6cc'); dot(W0 * .79, H0 * .23, S * .17, c1); }   // 밤하늘: 별 + 초승달
    else if (k === 'led') { g.fillStyle = 'rgba(255,255,255,.22)'; for (let x = -L; x < L * 2; x += S * .7) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + S * .3, 0); g.lineTo(x + S * .3 - H0, H0); g.lineTo(x - H0, H0); g.fill(); } }   // 네온: 사선 빛
    else if (k === 'tri') { g.fillStyle = 'rgba(200,90,30,.45)'; for (let j = 0; j < 2; j++) { g.beginPath(); g.moveTo(0, H0); for (let x = 0; x <= W0; x += S * .1) g.lineTo(x, H0 * (.62 + j * .2) + Math.sin(x / S * 1.8 + j) * S * .14); g.lineTo(W0, H0); g.fill(); } }   // 사막: 모래 언덕
    else if (k === 'cst') { for (let j = 0; j < 16; j++) { g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(rnd() * W0, rnd() * H0, S * .07, S * .045, rnd() * 3, 0, 7); g.fill(); } }   // 벚꽃: 꽃잎
    else if (k === 'light') { g.fillStyle = 'rgba(40,110,30,.4)'; for (let x = 0; x < W0; x += S * .09) { const hh = S * (.15 + rnd() * .25); g.fillRect(x, H0 - hh, S * .035, hh); } dot(W0 * .8, H0 * .2, S * .16, 'rgba(255,255,230,.8)'); }   // 들판: 풀 + 햇빛
    else if (k === 'boom') { g.fillStyle = 'rgba(255,240,150,.55)'; for (let j = 0; j < 7; j++) dot(rnd() * W0, H0 * (.3 + rnd() * .6), S * (.06 + rnd() * .1), 'rgba(255,240,150,.6)'); }   // 용암: 기포
    else if (k === 'mon') {   // 도시 야경: 건물 + 켜진 창문
      let x = 0; while (x < W0) { const bw = S * (.35 + rnd() * .35), bh = H0 * (.35 + rnd() * .5); g.fillStyle = '#0b1235'; g.fillRect(x, H0 - bh, bw - S * .04, bh);
        for (let yy = H0 - bh + S * .1; yy < H0 - S * .08; yy += S * .16) for (let xx = x + S * .06; xx < x + bw - S * .1; xx += S * .12) if (rnd() > .45) { g.fillStyle = rnd() > .3 ? '#ffd76a' : '#8fe3ff'; g.fillRect(xx, yy, S * .05, S * .07); }
        x += bw; }
    } else if (k === 'case') { ['#d9d9d9', '#e8e23a', '#36d6dc', '#3ccf4e', '#d43cd4', '#e03a3a', '#3a46e0'].forEach((cc, j) => { g.fillStyle = cc; g.fillRect(W0 * j / 7, 0, W0 / 7 + 1, H0 * .72); }); ['#3a46e0', '#151515', '#d43cd4', '#151515', '#36d6dc', '#151515', '#d9d9d9'].forEach((cc, j) => { g.fillStyle = cc; g.fillRect(W0 * j / 7, H0 * .72, W0 / 7 + 1, H0 * .08); }); g.fillStyle = '#0e1430'; g.fillRect(0, H0 * .8, W0, H0); g.fillStyle = '#fff'; g.fillRect(W0 * .3, H0 * .84, W0 * .14, H0 * .12); }   // 컬러 바(방송 시험 화면)
    // LED 점 격자: 패널 한 장에 5×5 점(은은하게) → 점 사이를 어둡게
    g.fillStyle = 'rgba(0,0,10,.13)'; const st2 = S / 5, lw = Math.max(.5, S * .02);
    for (let x = 0; x <= W0; x += st2) g.fillRect(Math.round(x - lw / 2), 0, lw, H0);
    for (let y = 0; y <= H0; y += st2) g.fillRect(0, Math.round(y - lw / 2), W0, lw);
    for (const [r, q] of sh) { const gl = g.createLinearGradient(0, r * S, 0, r * S + S * .5); gl.addColorStop(0, 'rgba(255,255,255,.3)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(q * S, r * S, S, S * .5); }   // 위 반사광
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = Math.max(1, S * .025); for (const [r, q] of sh) { g.beginPath(); g.roundRect(q * S + ins, r * S + ins, S - ins * 2, S - ins * 2, rad); g.stroke(); }   // 화면 가장자리 빛
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
  const SWEEP_MS = 1100; let sweep = { t: -1e9 }, sweepT = 0;   // 2026-10-30 디벨롭 2번: 켜진 패널 위로 6초마다 빛이 한 번 쓸고 지나감(그 1.1초만 다시 그림 → 가만히 있을 땐 그리기 0)
  let airT = 0; function airTick() { clearTimeout(airT); if (dead) return; if (st.combo > 1 && state === 'play' && !document.hidden) kick(); airT = setTimeout(airTick, 500); }
  function sweepLoop() { clearTimeout(sweepT); if (dead) return; sweepT = setTimeout(() => { if (!dead && state === 'play' && !document.hidden && b.some(Boolean)) { sweep = { t: performance.now() }; kick(); } sweepLoop(); }, 6000); }
  let shake = { t: 0, a: 0 }, parts = [], beams = [], flash = { t: 0, a: 0 }, rings = [], waves = [], glitch = { t: 0, a: 0 }, punch = { t: 0, a: 0 };
  const bump = a => { const now = performance.now(), left = Math.max(0, shake.a * (1 - (now - shake.t) / 280)); shake = { t: now, a: Math.min(16, Math.max(left, a)) }; };
  const busyFx = now => now - sweep.t < SWEEP_MS || parts.length || beams.length || rings.length || waves.length || now - shake.t < 280 || now - flash.t < 260 || now - glitch.t < 220 || now - punch.t < 260;
  function noise(d, vol, f = 1200, type = 'bandpass', at = 0) {   // 짧은 잡음(쾅·쉭)
    const a = sound && au(); if (!a) return;
    const len = Math.floor(a.sampleRate * d), bf = a.createBuffer(1, len, a.sampleRate), x = bf.getChannelData(0);
    for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.2;
    const src = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); src.buffer = bf; fl.type = type; fl.frequency.value = f; g.gain.value = vol;
    src.connect(fl).connect(g).connect(master); src.start(a.currentTime + at);
  }
  // 도로롱(2026-10-30 하율 "챙 하는 느낌이라 안 어울려 → 도로롱"): 동글동글한 음(사인 + 아주 짧게 아래로 휘는 음정)이 빠르게 굴러 올라감 — 마림바·물방울 느낌
  function blip(f, at, vol = .09) {
    const a = sound && au(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f, t + .03); o2.frequency.setValueAtTime(f * 2, t);
    const g2 = a.createGain(); g2.gain.value = .18; o2.connect(g2).connect(g);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g).connect(master); o.start(t); o.stop(t + .18); o2.start(t); o2.stop(t + .18);
  }
  function sndClear(n, cb, all) {   // 줄 송출: 부드러운 '퉁' → 도로롱(줄이 많을수록 길게, 연속일수록 높게) → 맑은 마무리 음
    const up = Math.min(cb, 8), PENT = [0, 2, 4, 7, 9];
    tone(130, .22, 'sine', .3, 0, 60);   // 퉁
    const cnt = Math.min(6 + n * 3, 16), base = 523 * 2 ** (up / 12);
    for (let j = 0; j < cnt; j++) { const st2 = PENT[j % 5] + 12 * Math.floor(j / 5); blip(base * 2 ** (st2 / 12), .02 + j * .032, .085); }
    const end = .02 + cnt * .032;
    [0, 7, 12].forEach(x => tone(base * 2 * 2 ** (x / 12), .45, 'sine', .045, end));   // 마무리 화음(부드럽게)
    if (n >= 2) tone(65, .45, 'sine', .22, 0, 40);   // 여러 줄: 낮은 울림
    if (all) { for (let j = 0; j < 12; j++) blip(base * 2 * 2 ** ((PENT[j % 5] + 12 * Math.floor(j / 5)) / 12), end + .1 + j * .04, .08); }   // 전체 화면 송출: 한 번 더 길게 굴러 올라감
  }
  const ease = k => 1 - (1 - k) ** 3;
  function draw() {
    const now = performance.now(), bx = BX(), by = BY();
    const sk = Math.max(0, 1 - (now - shake.t) / 280) ** 2 * shake.a, sx0 = sk ? (Math.random() * 2 - 1) * sk : 0, sy0 = sk ? (Math.random() * 2 - 1) * sk : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, sx0 * dpr, sy0 * dpr);
    const pk = now - punch.t < 260 ? punch.a * Math.sin(Math.PI * Math.min(1, (now - punch.t) / 260)) * (1 - (now - punch.t) / 260) : 0;   // 줌 펀치: 판 가운데 기준으로 살짝 커졌다 돌아옴
    if (pk) { const pcx = bx + cs * 4, pcy = by + cs * 4; ctx.translate(pcx, pcy); ctx.scale(1 + pk, 1 + pk); ctx.translate(-pcx, -pcy); }
    // 판(2026-10-29 하율: 지퍼 가방 그림은 "오히려 이상하다" → 예전 판으로)
    if (st.combo > 1 && state !== 'ready') {   // 연속 정리 중: 판 둘레가 색을 바꾸며 빛남(연속이 길수록 굵고 밝게)
      const hu = (now / 6) % 360, lw = Math.min(3 + st.combo, 9);
      ctx.save(); ctx.shadowColor = `hsl(${hu},95%,65%)`; ctx.shadowBlur = 10 + st.combo * 2; ctx.strokeStyle = `hsl(${hu},95%,68%)`; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.roundRect(bx - pad * .5 - lw / 2, by - pad * .5 - lw / 2, cs * 8 + pad + lw, cs * 8 + pad + lw, pad + lw / 2); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#0b0f22'; ctx.beginPath(); ctx.roundRect(bx - pad * .5, by - pad * .5, cs * 8 + pad, cs * 8 + pad, pad); ctx.fill();
    for (let i = 0; i < N * N; i++) { const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs; ctx.fillStyle = '#151a33'; ctx.beginPath(); ctx.roundRect(x + cs * .045, y + cs * .045, cs * .91, cs * .91, cs * .07); ctx.fill(); ctx.fillStyle = '#1b2140'; for (let j = 1; j < 3; j++) { ctx.fillRect(x + cs * j / 3 - .5, y + cs * .12, 1, cs * .76); ctx.fillRect(x + cs * .12, y + cs * j / 3 - .5, cs * .76, 1); } }   // 꺼진 LED 패널
    if (!b.some(Boolean)) {   // 판이 비면 꺼진 화면 'NO SIGNAL'(LED 월 컨셉)
      ctx.save(); ctx.globalAlpha = .5 + .12 * Math.sin(now / 500); ctx.font = `900 ${Math.round(cs * .62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#39406a'; ctx.fillText('NO SIGNAL', bx + cs * 4, by + cs * 4); ctx.restore();
    }
    const pv = drag && drag.x != null && state === 'play' ? preview(drag) : null;
    const swK = now - sweep.t < SWEEP_MS ? (now - sweep.t) / SWEEP_MS : -1, swD = swK < 0 ? 0 : -3 + swK * 22;   // 빛 쓸기: 대각선(줄+칸) 위치
    for (let i = 0; i < N * N; i++) {
      if (!b[i]) continue;
      const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs, ba = born[i] ? now - born[i] : 999, bk = Math.min(1, ba / 220), bn = ba < 220 ? 1 + .22 * Math.sin(bk * Math.PI) * (1 - bk) - .1 * (bk < .25 ? 1 - bk * 4 : 0) : 1, d = cs * bn;
      cellArt[i] ? cell(cellArt[i], x + (cs - d) / 2, y + (cs - d) / 2, d) : 0;
      if (swK >= 0) { const dd = Math.abs(i % N + Math.floor(i / N) - swD); if (dd < 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${.22 * (1 - dd / 2)})`; ctx.fillRect(x + cs * .05, y + cs * .05, cs * .9, cs * .9); ctx.restore(); } }
      if (ba < 180) { ctx.fillStyle = `rgba(255,255,255,${.55 * (1 - ba / 180)})`; ctx.beginPath(); ctx.roundRect(x + (cs - d) / 2, y + (cs - d) / 2, d, d, d * .2); ctx.fill(); }
      if (pv?.hit.has(i)) { ctx.fillStyle = `rgba(255,255,255,${.28 + .18 * Math.sin(now / 80)})`; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * .18); ctx.fill(); }
    }
    if (!pv && drag && drag.x != null && state === 'play') {   // 못 놓는 자리: 판 안이면 가장 가까운 자리에 빨간 테두리(왜 안 놓이는지 바로 보이게)
      const s = PIECES[set[drag.slot]].s, [h, w] = dims(s), r = Math.round((drag.y - drag.lift - h * cs / 2 - by) / cs), c = Math.round((drag.x - w * cs / 2 - bx) / cs);
      if (r > -1 && c > -1 && r + h < N + 1 && c + w < N + 1) { ctx.save(); ctx.strokeStyle = 'rgba(255,70,90,.85)'; ctx.fillStyle = 'rgba(255,70,90,.14)'; ctx.lineWidth = 2; for (const [dr, dc] of s) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue; ctx.beginPath(); ctx.roundRect(bx + cc * cs + 3, by + rr * cs + 3, cs - 6, cs - 6, cs * .12); ctx.fill(); ctx.stroke(); } ctx.restore(); }
    }
    if (pv) {   // 놓일 자리(반투명) + 정리될 줄의 빈칸도 빛나게
      const s = PIECES[set[drag.slot]].s, k = kindOf(set[drag.slot]);
      ctx.globalAlpha = .5; whole(set[drag.slot], bx + pv.sn.c * cs, by + pv.sn.r * cs, cs); ctx.globalAlpha = 1;
      pv.hit.forEach(i => { if (b[i]) return; const x = bx + (i % N) * cs, y = by + Math.floor(i / N) * cs; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cs - 4, cs - 4, cs * .18); ctx.fill(); });
    }
    if (st.combo > 1 && state !== 'ready') {   // 2026-10-30 디벨롭 3번: 연속 송출 중 ON AIR 불빛(판 위 테두리 왼쪽에 걸침, 빨간 점이 깜빡임)
      const fh = Math.max(14, Math.round(cs * .42)), fw = fh * 3.9, ax = bx + cs * .1, ay = Math.max(1, by - pad * .5 - fh * .5), on = Math.floor(now / 500) % 2 === 0;
      ctx.save(); ctx.fillStyle = '#e8243c'; ctx.beginPath(); ctx.roundRect(ax, ay, fw, fh, fh * .3); ctx.fill(); ctx.strokeStyle = '#0b0f22'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(ax + fh * .55, ay + fh / 2, fh * .2, 0, 7); ctx.fill();
      ctx.font = `900 ${Math.round(fh * .62)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('ON AIR', ax + fh * .95, ay + fh * .54); ctx.restore();
    }
    // 정리된 칸: 하얗게 번쩍 → 작아지며 사라짐 + 반짝이
    fx = fx.filter(f => now - f.t < 420);
    for (const f of fx) {
      const k = Math.max(0, (now - f.t - f.dl) / 360); if (k > 1) continue;
      const x = bx + (f.i % N) * cs + cs / 2, y = by + Math.floor(f.i / N) * cs + cs / 2, d = cs * (1 - k * .9);
      ctx.globalAlpha = 1 - k * .6; if (f.a2) cell(f.a2, x - d / 2, y - d / 2, d);
      ctx.fillStyle = `rgba(255,255,255,${(1 - k) * .85})`; ctx.beginPath(); ctx.roundRect(x - d / 2, y - d / 2, d, d, d * .1); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${(1 - k) * .9})`; const sh2 = d * .12; ctx.fillRect(x - d * .6, y - sh2 / 2 + (k - .5) * d, d * 1.2, sh2);   // 꺼질 때 지나가는 주사선
      ctx.fillStyle = '#fff6c2'; for (let j = 0; j < 3; j++) { const a = f.a + j * 2.1, rr = k * cs * .9; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(1, cs * .06 * (1 - k)), 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // 줄 빛줄기: 놓은 자리에서 양쪽으로 쭉 뻗은 뒤 사라짐
    beams = beams.filter(m => now - m.t < 380);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of beams) {
      const e = now - m.t, g = ease(Math.min(1, e / 110)), al = e < 110 ? 1 : 1 - (e - 110) / 270, th = cs * (1.15 - .5 * Math.max(0, (e - 110) / 270));
      const len = cs * 8 * g, c0 = m.from * cs;
      ctx.globalAlpha = al * .35; ctx.fillStyle = m.c;   // 번짐 대신 넓고 옅은 띠(shadowBlur는 학교 태블릿에서 무거움)
      if (m.row != null) { const y = by + (m.row + .5) * cs; ctx.fillRect(bx + Math.max(0, c0 - len), y - th, Math.min(cs * 8, c0 + len) - Math.max(0, c0 - len), th * 2); } else { const x = bx + (m.col + .5) * cs; ctx.fillRect(x - th, by + Math.max(0, c0 - len), th * 2, Math.min(cs * 8, c0 + len) - Math.max(0, c0 - len)); }
      ctx.globalAlpha = al;
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
      else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(q.x, q.y); ctx.rotate(q.r); if (parts.length < 40) { ctx.shadowColor = q.c; ctx.shadowBlur = q.s * 1.2; /* 파편이 많으면 번짐 생략(학교 태블릿 보호) */ } ctx.fillStyle = q.c; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-q.s * .22, -q.s * .22, q.s * .44, q.s * .44); ctx.restore(); }   // 빛나는 LED 픽셀
    }
    ctx.globalAlpha = 1;
    // 충격파: 정리된 자리에서 퍼지는 빛 고리(여러 줄·연속일수록 크게)
    waves = waves.filter(o => now - o.t < 520);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const o of waves) { const k = Math.max(0, (now - o.t) / 520); if (now < o.t) continue; const e2 = ease(k); ctx.strokeStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, cs * (.4 + o.r * e2), 0, 7); ctx.globalAlpha = (1 - k) * .3; ctx.lineWidth = Math.max(3, cs * .6 * (1 - k)); ctx.stroke(); ctx.globalAlpha = 1 - k; ctx.lineWidth = Math.max(1.5, cs * .28 * (1 - k)); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, cs * .08 * (1 - k)); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
    // 화면 글리치: 판의 가로 띠를 좌우로 어긋나게 + 빨강/파랑 잔상(방송 신호가 튀는 느낌) — 여러 줄 정리 때만
    if (now - glitch.t < 220) {
      const k = 1 - (now - glitch.t) / 220, gx = Math.round((bx - pad * .5) * dpr), gy = Math.round((by - pad * .5) * dpr), gw = Math.round((cs * 8 + pad) * dpr);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let j = 0; j < 5; j++) { const hh = Math.round(gw * (.03 + Math.random() * .07)), yy = gy + Math.floor(Math.random() * (gw - hh)), off = Math.round((Math.random() * 2 - 1) * cs * .5 * glitch.a * k * dpr); ctx.drawImage(cv, gx, yy, gw, hh, gx + off, yy, gw, hh); }
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .18 * k * glitch.a; const o2 = Math.round(cs * .12 * dpr * glitch.a);
      ctx.drawImage(cv, gx, gy, gw, gw, gx + o2, gy, gw, gw); ctx.drawImage(cv, gx, gy, gw, gw, gx - o2, gy, gw, gw);
      ctx.restore(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.setTransform(dpr, 0, 0, dpr, sx0 * dpr, sy0 * dpr);   // 줌 펀치 해제: 받침·끌고 있는 블록은 커서·손가락 자리 그대로
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
      if (!ok && state === 'play') { ctx.fillStyle = '#e8243c'; ctx.fillText('놓을 곳 없음', sx + sw / 2, Math.min(sy + sh - 4, oy + h * m + lab * 1.25)); ctx.save(); ctx.strokeStyle = 'rgba(232,36,60,.55)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(sx + 6, sy + 6, sw - 12, sh - 12, cs * .3); ctx.stroke(); ctx.restore(); }   // 2026-10-30 디벨롭 5번
      else ctx.fillText(KINDS[k][0], sx + sw / 2, Math.min(sy + sh - 4, oy + h * m + lab * 1.25));
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
  // 마우스 감도(2026-10-30 하율 "블럭을 잡았을 때만 마우스 감도 확 올려서 옮기기 편하게"): 잡은 동안만 블록이 마우스 이동량의 MOUSE_GAIN배로 움직임
  //   기준점 = 잡은 자리, 블록은 캔버스 밖으로 안 나가게, 잡은 동안 커서는 숨김(블록이 커서 역할). 터치·펜은 그대로(손가락 위로 띄우기만)
  const MOUSE_GAIN = 1.5;   // 1.9 → 1.5(2026-10-30 하율 "지금이 좋다")
  const gainPos = (d, p) => ({ x: Math.max(0, Math.min(W, d.x0 + (p.x - d.x0) * MOUSE_GAIN)), y: Math.max(0, Math.min(H, d.y0 + (p.y - d.y0) * MOUSE_GAIN)) });
  const cur = on => { cv.style.cursor = on ? 'none' : ''; };
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
      if (i === drag.slot) { drag = null; held = -1; cur(false); kick(); return; }
      if (i >= 0 && !used[i]) { held = -1; drag = null; cur(false); }
      else if (i < 0) { const mp = e.pointerType === 'mouse' && drag.x0 != null ? gainPos(drag, p) : p, d = { ...drag, x: mp.x, y: mp.y, lift: 0 }; if (tryPut(d)) { drag = null; held = -1; cur(false); } kick(); return; }   // 마우스는 감도 적용된 블록 자리에 놓음
      else return;
    }
    if (i < 0 || used[i]) return;
    try { cv.setPointerCapture(e.pointerId); } catch {}
    drag = { slot: i, x: p.x, y: p.y, x0: p.x, y0: p.y, at: performance.now(), id: e.pointerId, moved: false, lift: touch ? cs * 1.6 : 0, mouse: e.pointerType === 'mouse' };
    if (drag.mouse) cur(true);
    tone(440, .04, 'triangle', .04); kick();
  };
  const move = e => {
    if (!drag) return;
    const p = pos(e);
    if (drag.held) { if (e.pointerType === 'mouse') { if (drag.x0 == null) { drag.x0 = p.x; drag.y0 = p.y; cur(true); } const g = gainPos(drag, p); drag.x = g.x; drag.y = g.y; kick(); } return; }   // 집은 장비는 마우스를 따라다님(터치는 판을 누른 자리)
    if (e.pointerId !== drag.id) return;
    const g = drag.mouse ? gainPos(drag, p) : p; drag.x = g.x; drag.y = g.y; if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > cs * .3) drag.moved = true; kick();
  };
  const up = e => {
    if (!drag || drag.held || e.pointerId !== drag.id) return;
    const d = drag; drag = null; cur(false);
    if (state !== 'play') { kick(); return; }
    if (!d.moved && slotAt(d) === d.slot) { held = d.slot; drag = { slot: d.slot, held: true, x: null, y: null, x0: e.pointerType === 'mouse' ? d.x0 : null, y0: e.pointerType === 'mouse' ? d.y0 : null, lift: 0 }; kick(); return; }   // 끌지 않고 눌렀다 뗌 → 집기
    tryPut(d); kick();
  };
  const cancel = e => { if (drag && !drag.held && (!e || e.pointerId === drag.id)) { drag = null; cur(false); kick(); } };
  const leave = () => { if (drag?.held) { drag.x = drag.y = null; drag.x0 = drag.y0 = null; cur(false); kick(); } };
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
    const res = place(b, st, s, r, c, kindV(pi));
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
        const x = bx + (i % N + .5) * cs, y = by + (Math.floor(i / N) + .5) * cs, col = KINDS[(prevB[i] && KIND_ORDER[prevB[i] - 1]) || k][1], nn = res.cells.length > 24 ? 3 : 6;
        for (let j = 0; j < nn; j++) parts.push({ x, y, vx: (Math.random() - .5) * cs * .42, vy: -cs * (.1 + Math.random() * .28), r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: cs * (.1 + Math.random() * .14), c: col, t: now + Math.random() * 60, life: 650 + Math.random() * 300 });
        parts.push({ star: true, x, y, vx: (Math.random() - .5) * cs * .2, vy: -cs * (.15 + Math.random() * .15), r: 0, vr: 0, s: cs * (.18 + Math.random() * .14), t: now, life: 600 });
      });
      flash = { t: now, a: Math.min(.6, .18 + .14 * res.n) }; bump(4 + res.n * 3.5 + cb);
      punch = { t: now, a: Math.min(.06, .018 + .012 * res.n + cb * .003) };
      waves.push({ x: ox, y: oy, t: now, r: 3 + res.n * 1.6 + cb * .25, c: KINDS[k][1] }); if (res.n >= 2) waves.push({ x: ox, y: oy, t: now + 90, r: 5 + res.n * 1.8, c: '#ffffff' });
      if (res.n >= 2 || res.clear) glitch = { t: now + 40, a: Math.min(1.6, .7 + res.n * .25) };
      if (res.same) { floats.push({ s: `같은 장면 ×${res.same > 1 ? 3 : 2}!`, x: ox, y: oy - cs * 1.3, t: now + 140, big: true, rb: true, sc: 1.25 }); waves.push({ x: ox, y: oy, t: now + 140, r: 9, c: '#ffe27a' }); for (let j = 0; j < 10; j++) blip(1046 * 2 ** ([0, 4, 7, 12, 16][j % 5] / 12 + Math.floor(j / 5)), .5 + j * .035, .07); }   // 2026-10-30 디벨롭 1번
      floats.push({ s: res.clear ? '전체 화면 송출!' : CLEAR_NAME[Math.min(res.n, 4) - 1], x: ox, y: oy - cs * .45, t: now, big: true, c: '#ffe27a', sc: 1 + Math.min(res.n - 1, 3) * .18, rb: res.clear || res.n >= 3 });
      if (st.combo > 1) floats.push({ s: `콤보 ×${cb}`, x: bx + cs * 4, y: by + cs * 1.2, t: now + 90, big: true, rb: true, sc: 1 + cb * .05 });
      floats.push({ s: '+' + res.pts.toLocaleString('ko-KR') + (st.combo > 1 ? `  연속 ×${Math.min(st.combo, 10)}` : ''), x: ox, y: oy + cs * .35, t: now + 60, c: '#9ff0a8' });
      sndClear(res.n, st.combo, res.clear);
      if (navigator.vibrate) try { navigator.vibrate(res.n >= 2 ? [22, 30, 30] : 24); } catch {}
    } else {
      floats.push({ s: '+' + res.pts, x: cx, y: cy, t: now, c: '#fff' }); bump(2.2);
      tone(170, .12, 'sine', .22, 0, 55); noise(.03, .35, 2400, 'bandpass'); tone(1320, .035, 'square', .03, .015); tone(880 + s.length * 60, .09, 'triangle', .05, .03);   // 패널 '철컥' + 켜짐 '삐'
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
    ov.innerHTML = `<b>LED 월 켜기!</b><span>LED 패널을 끌어다 벽에 붙여요 <small>(눌러서 집고 벽 칸을 눌러도 돼요)</small><br>가로·세로 한 줄이 꽉 차면 <em>송출!</em> · 놓을 곳이 없으면 끝<br>연속으로 정리하면 점수가 몇 배로! · 한 줄을 <em>같은 장면</em>으로 채우면 ×2</span><button type="button" class="btn big" data-m="go">시작</button>`;
    $('go').onclick = start; draw();
  }
  async function start() {
    if (busy || dead) return; busy = true;
    const go = $('go'); if (go) { go.disabled = true; go.textContent = '준비 중…'; }
    let seed = null; try { seed = await opt.seed?.(); } catch {}
    busy = false; if (dead) return;
    clearTimeout(endT);
    rand = rng(seed == null ? Math.floor(Math.random() * 4294967296) : seed);
    b = newBoard(); cellArt = []; st = { score: 0, combo: 0, miss: 0 }; moves = []; lines = 0; fx = []; floats = []; born = []; parts = []; beams = []; rings = []; waves = []; drag = null; held = -1;
    set = nextSet(rand, b, 0); used = [false, false, false]; setAt = performance.now() + 150; sweepLoop(); airTick();
    shown = 0; cancelAnimationFrame(rollRaf); rollRaf = 0; $('sc').textContent = 0; $('gain').className = 'bl-gain'; $('cb').textContent = 0; $('cbw').classList.remove('on');
    state = 'play'; t0 = performance.now(); ov.hidden = true; stopBtn.hidden = false; tone(523, .08, 'triangle', .06); tone(784, .12, 'triangle', .06, .08);
    fit(); kick();
  }
  function end(why) {
    if (state !== 'play' && state !== 'ending') return;
    const ms = Math.round(performance.now() - t0); state = 'over'; drag = null; held = -1; cur(false); stopBtn.hidden = true; clearTimeout(stopT); stopBtn.classList.remove('ask'); stopBtn.textContent = '그만하기';
    const nb = st.score > best; if (nb) { best = st.score; $('best').textContent = best.toLocaleString('ko-KR'); }
    tone(nb ? 784 : 392, .14, 'triangle', .07); tone(nb ? 1047 : 330, .22, 'triangle', .07, .14);
    ov.hidden = false; ov.className = 'ml-ov end';
    ov.innerHTML = `<b>${why === 'max' ? '오늘 정리는 여기까지!' : why === 'quit' ? '여기까지 정리!' : '벽이 꽉 찼어요!'}</b><p class="ml-sc">${st.score.toLocaleString('ko-KR')}<small>점</small></p><span>${lines}줄 정리 · 장비 ${moves.length}개${nb ? ' · 최고 기록 경신!' : ''}</span>
      <small class="ml-msg" data-m="msg"></small><button type="button" class="btn big" data-m="go">한 번 더</button>`;
    $('go').onclick = start; draw();
    opt.onOver?.({ score: st.score, n: moves.length, lines, ms, why, nb, rounds: [ms, ...moves] });
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe(root);
  rand = rng(1); set = nextSet(rand, b, 0); used = [false, false, false]; ready(); fit();
  if (opt.quick) start();   // 다시 시작(버튼·R)은 안내 화면 없이 바로(2026-10-30 하율)
  return {
    start,
    msg(html) { const m = $('msg'); if (m) m.innerHTML = html; },
    setBest(v, force) { if (force || v > best) { best = v; $('best').textContent = v.toLocaleString('ko-KR'); } },
    destroy() { dead = true; const as = root.closest('.fl')?.querySelector(':scope > .fl-side'); if (as) as.style.marginTop = ''; cancelAnimationFrame(rollRaf); clearTimeout(endT); clearTimeout(stopT); clearTimeout(sweepT); clearTimeout(airT); cancelAnimationFrame(raf); ro.disconnect(); try { ac?.close(); } catch {} },
    get st() { return { state, score: st.score, combo: st.combo, board: b, set, used, moves, cs, pad, horiz, held }; },
    slotRect, end, _art: (pi, s) => art(pi, s).c,   // 테스트용
    _put(slot, r, c) { if (state === 'play' && !used[slot] && fits(b, PIECES[set[slot]].s, r, c)) { put(slot, r, c, Math.round(performance.now() - t0)); return true; } return false; },   // 테스트용
  };
}
