// SVMHS GROUND — 색감의 신(2026-11-02 하율 "5초 동안 색깔 하나를 보여 준 다음 컬러 팔레트에서 골라 얼마나 가까운지 퍼센트로", 미리보기 깃발 color-game — 개발자만)
// 한 판 = 5번: 색 보기(5초) → 팔레트(채도·밝기 네모 + 색상 막대)에서 고르기 → 정답과 비교(%) → 다음.
// 점수 규칙은 color-score.js(서버와 같음). createColor(el, O) → { start, destroy }
//   O: quick(안내 건너뜀) · onDone(v, detailHtml, rounds)
import { ROUNDS, SHOW_MS, accOf, hsv2rgb, hex, pickTargets, pctOf } from './color-score.js';
import { makeSfx, sndBtnHtml, bindSnd } from './sfx.js';

const gradeOf = a => a >= 970 ? ['신의 눈', 'g5'] : a >= 900 ? ['거의 똑같아요', 'g4'] : a >= 800 ? ['좋아요', 'g3'] : a >= 600 ? ['조금 달라요', 'g2'] : ['완전 다른 색', 'g1'];
const pct = a => (a / 10).toFixed(1) + '%';

export function createColor(el, O = {}) {
  const sfx = makeSfx('color_snd');
  el.innerHTML = `<div class="cg" id="cg">
    <div class="cg-top"><span class="cg-rd" id="cgRd">1 / ${ROUNDS}</span><span class="cg-sum" id="cgSum">평균 -</span>${sndBtnHtml('cgSnd')}</div>
    <div class="cg-st" id="cgSt"></div>
    <ol class="cg-log" id="cgLog"></ol>
  </div>`;
  bindSnd(el.querySelector('#cgSnd'), sfx);   // 켬/끔은 이 기기에 저장(color_snd)
  const st = el.querySelector('#cgSt'), rd = el.querySelector('#cgRd'), sumEl = el.querySelector('#cgSum'), log = el.querySelector('#cgLog');
  let alive = true, raf = 0, phase = 'intro', round = 0, targets = pickTargets(), picks = [], accs = [], H = 0, Sv = .5, Vv = .5, offs = [];
  const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); offs.push(() => t.removeEventListener(ev, f, o)); };

  const intro = () => {
    phase = 'intro';
    st.innerHTML = `<div class="cg-intro"><b>색감의 신</b><p>화면에 나온 색을 <em>5초</em> 동안 기억했다가<br>팔레트에서 똑같은 색을 골라요</p><small>${ROUNDS}번 · 얼마나 가까운지 %로 · 평균이 기록</small><button type="button" class="btn big" id="cgGo">시작</button></div>`;
    st.querySelector('#cgGo').onclick = () => show();
  };

  // 1) 색 보기 — 숨은 탭에선 rAF가 멈추고 한 번에 0.1초 넘게 흐르지 않게 해서, 화면이 꺼져도 시간이 줄지 않음
  const show = () => {
    phase = 'show'; rd.textContent = `${round + 1} / ${ROUNDS}`;
    st.innerHTML = `<div class="cg-show" id="cgSw"><b id="cgCd">5</b><small>이 색을 기억하세요</small><i class="cg-bar"><i id="cgBar"></i></i></div>`;
    const sw = st.querySelector('#cgSw'), cd = st.querySelector('#cgCd'), bar = st.querySelector('#cgBar');
    sw.style.background = hex(targets[round]);
    const lt = (targets[round] >> 16 & 255) * .299 + (targets[round] >> 8 & 255) * .587 + (targets[round] & 255) * .114;
    sw.classList.toggle('lt', lt > 150);
    let left = SHOW_MS, prev = 0, lastN = 5;
    sfx.tone(520, .08, 'triangle', .05);
    const step = t => {
      if (!alive || phase !== 'show') return;
      if (prev) left -= Math.min(100, t - prev); prev = t;
      const n = Math.max(1, Math.ceil(left / 1000));
      if (n !== lastN) { lastN = n; cd.textContent = n; sfx.tone(440, .05, 'triangle', .035); }
      bar.style.transform = `scaleX(${Math.max(0, left / SHOW_MS)})`;
      if (left <= 0) return pick();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  // 2) 고르기 — 왼쪽 네모: 가로 채도·세로 밝기, 오른쪽 막대: 색상. 시작 색은 무작위 색상 · 중간 채도·밝기
  const pick = () => {
    phase = 'pick'; H = Math.random() * 360; Sv = .5; Vv = .5;
    st.innerHTML = `<div class="cg-pick">
      <div class="cg-sv" id="cgSv"><canvas id="cgSvC"></canvas><i class="cg-dot" id="cgDot"></i></div>
      <div class="cg-hue" id="cgHue"><canvas id="cgHueC"></canvas><i class="cg-hk" id="cgHk"></i></div>
      <div class="cg-side"><i class="cg-now" id="cgNow"></i><small>기억한 색을 골라요</small><button type="button" class="btn big" id="cgOk">이 색으로!</button></div>
    </div>`;
    const sv = st.querySelector('#cgSv'), hu = st.querySelector('#cgHue'), svC = st.querySelector('#cgSvC'), huC = st.querySelector('#cgHueC');
    const dot = st.querySelector('#cgDot'), hk = st.querySelector('#cgHk'), now = st.querySelector('#cgNow');
    const fit = (cv, box) => { const r = box.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); return cv.getContext('2d'); };
    const drawHue = () => { const c = fit(huC, hu), g = c.createLinearGradient(0, 0, 0, huC.height); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, hex(hsv2rgb(i * 60 % 360, 1, 1))); c.fillStyle = g; c.fillRect(0, 0, huC.width, huC.height); };
    const drawSv = () => {
      const c = fit(svC, sv), w = svC.width, h = svC.height;
      c.fillStyle = hex(hsv2rgb(H, 1, 1)); c.fillRect(0, 0, w, h);
      const gw = c.createLinearGradient(0, 0, w, 0); gw.addColorStop(0, '#fff'); gw.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gw; c.fillRect(0, 0, w, h);
      const gb = c.createLinearGradient(0, 0, 0, h); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, '#000'); c.fillStyle = gb; c.fillRect(0, 0, w, h);
    };
    const paint = () => {
      dot.style.left = Sv * 100 + '%'; dot.style.top = (1 - Vv) * 100 + '%'; hk.style.top = H / 360 * 100 + '%';
      const c = hex(hsv2rgb(H, Sv, Vv)); now.style.background = c; dot.style.background = c;
    };
    const drag = (box, f) => {
      let id = null;
      const at = e => { const r = box.getBoundingClientRect(); f(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))); paint(); };
      on(box, 'pointerdown', e => { if (e.button > 0) return; e.preventDefault(); id = e.pointerId; try { box.setPointerCapture(id); } catch {} at(e); });
      on(box, 'pointermove', e => { if (e.pointerId === id) at(e); });
      const up = e => { if (e.pointerId === id) id = null; };
      on(box, 'pointerup', up); on(box, 'pointercancel', up);
    };
    drag(sv, (x, y) => { Sv = x; Vv = 1 - y; });
    drag(hu, (x, y) => { H = Math.min(359.9, y * 360); drawSv(); });
    st.querySelector('#cgOk').onclick = () => reveal();
    drawHue(); drawSv(); paint();
  };

  // 3) 비교
  const reveal = () => {
    if (phase !== 'pick') return;
    phase = 'rev';
    const t = targets[round], p = hsv2rgb(H, Sv, Vv), a = accOf(t, p), [gn, gc] = gradeOf(a);
    picks.push(p); accs.push(a); round++;
    const avg = accs.reduce((s, x) => s + x, 0) / accs.length;
    sumEl.textContent = '평균 ' + pct(avg);
    if (a >= 900) { sfx.tone(784, .08, 'triangle', .05); sfx.tone(1046, .14, 'triangle', .05, .08); } else if (a >= 700) sfx.tone(660, .1, 'triangle', .05); else sfx.tone(220, .14, 'square', .03);
    const last = round >= ROUNDS;
    st.innerHTML = `<div class="cg-rev"><div class="cg-pair"><div><i id="cgT"></i><small>정답</small></div><div><i id="cgP"></i><small>내 색</small></div></div>
      <p class="cg-pct ${gc}"><b>${pct(a)}</b><span>${gn}</span></p><button type="button" class="btn big" id="cgNx">${last ? '결과 보기' : '다음 색'}</button></div>`;
    st.querySelector('#cgT').style.background = hex(t); st.querySelector('#cgP').style.background = hex(p);
    const li = document.createElement('li'); li.innerHTML = `<i></i><i></i><b>${pct(a)}</b>`; li.children[0].style.background = hex(t); li.children[1].style.background = hex(p); log.append(li);
    st.querySelector('#cgNx').onclick = () => next();
  };
  const next = () => {
    if (phase !== 'rev') return;
    if (round < ROUNDS) return show();
    phase = 'done';
    const v = accs.reduce((s, a) => s + 1000 - a, 0), rounds = targets.flatMap((t, i) => [t, picks[i]]);
    const det = `<p class="rdet cg-det">${accs.map((a, i) => `<span><i data-c="${hex(targets[i])}"></i><i data-c="${hex(picks[i])}"></i>${pct(a)}</span>`).join('')}</p>`;
    O.onDone?.(v, det, rounds);
  };
  // 스페이스·엔터: 시작 / 고르기 확정 / 다음
  on(document, 'keydown', e => {
    if (!alive || e.repeat || (e.key !== ' ' && e.key !== 'Enter') || document.querySelector('.modal.open') || e.target.closest?.('input,textarea,select')) return;
    if (phase === 'intro') { e.preventDefault(); show(); } else if (phase === 'pick') { e.preventDefault(); reveal(); } else if (phase === 'rev') { e.preventDefault(); next(); }
  });
  intro();
  return {
    start() { if (phase === 'intro' && O.quick) show(); },
    destroy() { alive = false; cancelAnimationFrame(raf); offs.forEach(f => f()); offs = []; },
    pctOf,
  };
}
// 결과 화면의 색 칸 칠하기(CSP: style="" 못 씀 → data-c를 CSSOM으로)
export const paintDet = root => root?.querySelectorAll('.cg-det i[data-c]').forEach(i => { i.style.background = i.dataset.c; });
