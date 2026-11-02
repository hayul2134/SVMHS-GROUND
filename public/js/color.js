// SVMHS GROUND — 색감의 신(2026-11-02 하율 "5초 동안 색깔 하나를 보여 준 다음 컬러 팔레트에서 골라 얼마나 가까운지 퍼센트로", 미리보기 깃발 color-game — 개발자만)
// 한 판 = 5번: 색 보기(5초) → 팔레트(채도·밝기 네모 + 색상 막대)에서 고르기 → 정답과 비교(%) → 다음.
// 점수 규칙은 color-score.js(서버와 같음). createColor(el, O) → { start, destroy }
//   O: quick(안내 건너뜀) · seed() → Promise<씨앗|null>(시작 티켓 — 문제 색이 정해짐, null이면 아무 판) · onDone(v, detailHtml, rounds)
// 2026-11-02 디벨롭: 문제 색 = 티켓 씨앗(서버가 확인) · 보기 끝나면 0.6초 회색 화면(잔상 지우기) · 키보드 미세 조정
//   · 비교 화면에 색상/채도/밝기 막대(정답 ▼ / 내 색 ●) + 어느 쪽으로 옮기면 되는지 · 결과에 칭호 + 5판 경향(밝기·채도를 한쪽으로 기억하는지)
import { ROUNDS, SHOW_MS, accOf, hsv2rgb, hex, pickTargets, pctOf, rng, hintOf, biasOf } from './color-score.js';
import { makeSfx, sndBtnHtml, bindSnd } from './sfx.js';

const gradeOf = a => a >= 970 ? ['신의 눈', 'g5'] : a >= 900 ? ['거의 똑같아요', 'g4'] : a >= 800 ? ['좋아요', 'g3'] : a >= 600 ? ['조금 달라요', 'g2'] : ['완전 다른 색', 'g1'];
const pct = a => (a / 10).toFixed(1) + '%';
const titleOf = a => a >= 950 ? ['색감의 신', 'g5'] : a >= 900 ? ['컬러리스트', 'g4'] : a >= 800 ? ['좋은 눈', 'g3'] : a >= 650 ? ['수련 중', 'g2'] : ['색 초보', 'g1'];
const MASK_MS = 600;

export function createColor(el, O = {}) {
  const sfx = makeSfx('color_snd');
  el.innerHTML = `<div class="cg" id="cg">
    <div class="cg-top"><span class="cg-rd" id="cgRd">1 / ${ROUNDS}</span><span class="cg-sum" id="cgSum">평균 -</span>${sndBtnHtml('cgSnd')}</div>
    <div class="cg-st" id="cgSt"></div>
    <ol class="cg-log" id="cgLog"></ol>
  </div>`;
  bindSnd(el.querySelector('#cgSnd'), sfx);   // 켬/끔은 이 기기에 저장(color_snd)
  const st = el.querySelector('#cgSt'), rd = el.querySelector('#cgRd'), sumEl = el.querySelector('#cgSum'), log = el.querySelector('#cgLog');
  let alive = true, raf = 0, tmr = 0, phase = 'intro', round = 0, targets = null, picks = [], accs = [], H = 0, Sv = .5, Vv = .5, offs = [], paintPick = null;
  // 문제 색: 시작 티켓 씨앗으로(서버가 같은 씨앗으로 다시 뽑아 확인). 티켓을 못 받으면 아무 색(기록은 저장 안 됨 — social.js가 알림)
  const ready = Promise.resolve(O.seed ? O.seed().catch(() => null) : null).then(sd => { targets = pickTargets(sd != null ? rng(sd) : Math.random); });
  const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); offs.push(() => t.removeEventListener(ev, f, o)); };

  const intro = () => {
    phase = 'intro';
    st.innerHTML = `<div class="cg-intro"><b>색감의 신</b><p>화면에 나온 색을 <em>5초</em> 동안 기억했다가<br>팔레트에서 똑같은 색을 골라요</p><small>${ROUNDS}번 · 얼마나 가까운지 %로 · 평균이 기록</small><button type="button" class="btn big" id="cgGo">시작</button></div>`;
    st.querySelector('#cgGo').onclick = () => go();
  };
  const go = () => {   // 씨앗을 받은 뒤 시작
    if (phase !== 'intro') return;
    if (targets) return show();
    phase = 'wait'; const b = st.querySelector('#cgGo'); if (b) { b.disabled = true; b.textContent = '준비 중…'; }
    ready.then(() => { if (alive && phase === 'wait') show(); });
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
      if (left <= 0) return mask();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  // 1.5) 회색 화면 0.6초 — 진한 색을 5초 본 뒤 바로 팔레트가 나오면 잔상(보색)이 남아 고르기가 흔들림
  const mask = () => {
    phase = 'mask';
    st.innerHTML = `<div class="cg-mask"><small>기억한 색을 떠올려요</small></div>`;
    tmr = setTimeout(() => { if (alive && phase === 'mask') pick(); }, MASK_MS);
  };
  // 2) 고르기 — 왼쪽 네모: 가로 채도·세로 밝기, 오른쪽 막대: 색상. 시작 색은 무작위 색상 · 중간 채도·밝기
  const pick = () => {
    phase = 'pick'; H = Math.random() * 360; Sv = .5; Vv = .5;
    st.innerHTML = `<div class="cg-pick">
      <div class="cg-sv" id="cgSv"><canvas id="cgSvC"></canvas><i class="cg-dot" id="cgDot"></i></div>
      <div class="cg-hue" id="cgHue"><canvas id="cgHueC"></canvas><i class="cg-hk" id="cgHk"></i></div>
      <div class="cg-side"><i class="cg-now" id="cgNow"></i><small>기억한 색을 골라요</small><button type="button" class="btn big" id="cgOk">이 색으로!</button><small class="cg-keys">← → 채도 · ↑ ↓ 밝기 · Q E 색상<br>Shift 누르면 크게 · Enter 확정</small></div>
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
    paintPick = (dh, ds, dv) => { if (dh) { H = (H + dh + 360) % 360; drawSv(); } Sv = Math.max(0, Math.min(1, Sv + ds)); Vv = Math.max(0, Math.min(1, Vv + dv)); paint(); };   // 키보드 미세 조정
    drawHue(); drawSv(); paint();
  };

  // 3) 비교
  const reveal = () => {
    if (phase !== 'pick') return;
    phase = 'rev';
    const t = targets[round], p = hsv2rgb(H, Sv, Vv), a = accOf(t, p), [gn, gc] = gradeOf(a), { d, out: hl } = hintOf(t, p);
    picks.push(p); accs.push(a); round++;
    const avg = accs.reduce((s, x) => s + x, 0) / accs.length;
    sumEl.textContent = '평균 ' + pct(avg);
    if (a >= 900) { sfx.tone(784, .08, 'triangle', .05); sfx.tone(1046, .14, 'triangle', .05, .08); } else if (a >= 700) sfx.tone(660, .1, 'triangle', .05); else sfx.tone(220, .14, 'square', .03);
    const last = round >= ROUNDS;
    st.innerHTML = `<div class="cg-rev"><div class="cg-pair"><div><i id="cgT"></i><small>정답</small></div><div><i id="cgP"></i><small>내 색</small></div></div>
      <p class="cg-pct ${gc}"><b>${pct(a)}</b><span>${gn}</span></p>
      <div class="cg-ax">${['색상', '채도', '밝기'].map(k => `<div class="cg-ab"><span>${k}</span><i class="cg-gr"><i class="cg-mt"></i><i class="cg-mp"></i></i></div>`).join('')}<small class="cg-lg"><i class="cg-mt"></i>정답 <i class="cg-mp"></i>내 색</small></div>
      <ul class="cg-hint">${hl.length ? hl.map(([k, s]) => `<li><b>${k}</b>${s}</li>`).join('') : '<li class="ok">팔레트로는 거의 그대로예요</li>'}</ul>
      <button type="button" class="btn big" id="cgNx">${last ? '결과 보기' : '다음 색'}</button></div>`;
    st.querySelector('#cgT').style.background = hex(t); st.querySelector('#cgP').style.background = hex(p);
    // 막대: 색상(무지개) · 채도(정답 색상·밝기에서 회색→진하게) · 밝기(검정→정답 색상·채도). 위치는 팔레트(HSV) 값
    const pos = [[d.th / 360, d.ph / 360], [d.ts, d.ps], [d.tv, d.pv]];
    const grads = [`linear-gradient(90deg,${[0, 60, 120, 180, 240, 300, 360].map(h => hex(hsv2rgb(h % 360, 1, 1))).join(',')})`,
      `linear-gradient(90deg,${hex(hsv2rgb(d.th, 0, d.tv))},${hex(hsv2rgb(d.th, 1, d.tv))})`,
      `linear-gradient(90deg,#000,${hex(hsv2rgb(d.th, d.ts, 1))})`];
    st.querySelectorAll('.cg-ab').forEach((row, i) => {
      const g = row.querySelector('.cg-gr'); g.style.background = grads[i];
      row.querySelector('.cg-mt').style.left = pos[i][0] * 100 + '%'; row.querySelector('.cg-mp').style.left = pos[i][1] * 100 + '%';
      row.querySelector('.cg-mt').style.background = hex(t); row.querySelector('.cg-mp').style.background = hex(p);
      if (i === 0 && !d.dh && (d.ts < 0.12 || d.ps < 0.08)) row.classList.add('dim');   // 회색에 가까우면 색상은 의미 없음
    });
    const li = document.createElement('li'); li.innerHTML = `<i></i><i></i><b>${pct(a)}</b>`; li.children[0].style.background = hex(t); li.children[1].style.background = hex(p); log.append(li);
    st.querySelector('#cgNx').onclick = () => next();
  };
  const next = () => {
    if (phase !== 'rev') return;
    if (round < ROUNDS) return show();
    phase = 'done';
    const v = accs.reduce((s, a) => s + 1000 - a, 0), rounds = targets.flatMap((t, i) => [t, picks[i]]);
    const avg = accs.reduce((s, a) => s + a, 0) / ROUNDS, [tn, tc] = titleOf(avg), bias = biasOf(rounds);
    const det = `<p class="cg-ttl ${tc}">${tn}</p><p class="rdet cg-det">${accs.map((a, i) => `<span><i data-c="${hex(targets[i])}"></i><i data-c="${hex(picks[i])}"></i>${pct(a)}</span>`).join('')}</p>`
      + `<ul class="cg-bias">${(bias.length ? bias : [avg >= 900 ? '한쪽으로 치우치지 않고 고르게 맞혔어요' : '판마다 다른 쪽으로 틀렸어요 — 정해진 버릇은 없어요']).map(s => `<li>${s}</li>`).join('')}</ul>`;
    O.onDone?.(v, det, rounds);
  };
  // 스페이스·엔터: 시작 / 고르기 확정 / 다음 · 고르기 중 화살표(채도·밝기 1%, Shift 5%)·Q E(색상 1°, Shift 5°)
  const NUDGE = { ArrowLeft: [0, -1, 0], ArrowRight: [0, 1, 0], ArrowUp: [0, 0, 1], ArrowDown: [0, 0, -1], q: [-1, 0, 0], e: [1, 0, 0], Q: [-1, 0, 0], E: [1, 0, 0] };
  on(document, 'keydown', e => {
    if (!alive || document.querySelector('.modal.open') || e.target.closest?.('input,textarea,select')) return;
    if (phase === 'pick' && NUDGE[e.key] && paintPick && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); const [h, s, v] = NUDGE[e.key], k = e.shiftKey ? 5 : 1; paintPick(h * k, s * k / 100, v * k / 100); return;
    }
    if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
    if (phase === 'intro') { e.preventDefault(); go(); } else if (phase === 'pick') { e.preventDefault(); reveal(); } else if (phase === 'rev') { e.preventDefault(); next(); }
  });
  intro();
  return {
    start() { if (phase === 'intro' && O.quick) go(); },
    destroy() { alive = false; cancelAnimationFrame(raf); clearTimeout(tmr); offs.forEach(f => f()); offs = []; },
    pctOf,
  };
}
// 결과 화면의 색 칸 칠하기(CSP: style="" 못 씀 → data-c를 CSSOM으로)
export { seedOf } from './color-score.js';
export const paintDet = root => root?.querySelectorAll('.cg-det i[data-c]').forEach(i => { i.style.background = i.dataset.c; });
