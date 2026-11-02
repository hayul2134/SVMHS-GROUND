// SVMHS GROUND — 등교하기!(2026-11-02 하율 "지하철 노선도로 타자연습하는 게임, 이름은 등교하기!", 미리보기 깃발 commute-game — 개발자만)
// 노선도 위 열차가 학교 앞 신정역(5호선)까지 감. 다음 역 이름을 치면(맞으면 바로, Enter 없이) 열차가 한 역 출발.
// 규칙·타수 계산은 commute-score.js(서버와 같음). createCommute(el, O) → { start, destroy }
//   O: quick(안내 건너뜀) · onDone(v, detailHtml, rounds)
// 한글 입력(IME) 주의: 조합 중인 글자가 있는 입력칸 값을 바꾸면 글자가 깨지거나 두 번 들어감 → 값은 조합이 끝났을 때만 비우고,
//   그 전엔 앞 역에서 친 만큼(base)을 잘라 보고 지금 역 글자만 비교함. 입력칸은 투명하게 판 위에 깔고 친 글자는 직접 그림
import { LINES, GOAL, ROUTES, stopsOf, keysOf, tpmOf } from './commute-score.js';
import { makeSfx, sndBtnHtml, bindSnd } from './sfx.js';
import { createMap, keyFrac } from './commute-map.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => s.replace(/\s+/g, '');
const chip = l => `<i class="cm-ln" data-l="${l}">${l}</i>`;
const fmtS = ms => (ms / 1000).toFixed(1) + '초';

export function createCommute(el, O = {}) {
  const sfx = makeSfx('commute_snd');
  const ri = Math.floor(Math.random() * ROUTES.length), stops = stopsOf(ri), N = stops.length - 1;
  el.innerHTML = `<div class="cm" id="cm">
    <div class="cm-top"><span class="cm-rt" id="cmRt"></span><span class="cm-sum" id="cmSum">0타</span>${sndBtnHtml('cmSnd')}</div>
    <div class="cm-map"><canvas id="cmCv"></canvas></div>
    <div class="cm-st" id="cmSt"></div>
  </div>`;
  bindSnd(el.querySelector('#cmSnd'), sfx);
  const $ = s => el.querySelector(s), cv = $('#cmCv'), st = $('#cmSt'), sumEl = $('#cmSum');
  $('#cmRt').innerHTML = `${stops.filter((s, i) => !i || s.x).map(s => chip(s.x || s.l)).join('')}<b>${esc(stops[0].n)} → ${esc(GOAL)}</b><small>${N}개 역</small>`;
  paintChips(el);
  let alive = true, raf = 0, phase = 'intro', cur = 1, offs = [], base = 0, comp = false, t0 = 0, hidAt = 0, miss = 0, wrongNow = false, keys = 0;
  const times = [], ff = getComputedStyle(document.body).fontFamily;
  let done = false;
  const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); offs.push(() => t.removeEventListener(ev, f, o)); };

  // ---------- 지도(commute-map.js) — 열차 위치 p = 역 번호(소수), 목표 pT로 부드럽게 ----------
  const map = createMap(stops);
  let p = 0, pT = 0, last = 0;
  const draw = now => {
    if (!alive) return;
    const r = cv.parentElement.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), W = r.width, H = r.height;
    if (W && H) {
      if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
      p += (pT - p) * Math.min(1, dt * 7); if (Math.abs(pT - p) < .001) p = pT;
      const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
      map.draw(c, W, H, p, cur, now, done);
    }
    raf = requestAnimationFrame(draw);
  };

  // ---------- 화면 ----------
  const intro = () => {
    phase = 'intro';
    st.innerHTML = `<div class="cm-intro"><b>등교하기!</b><p>지하철을 타고 학교 앞 <em>신정역</em>까지!<br>다음 역 이름을 치면 열차가 출발해요</p>
      <small>맞게 치면 Enter 없이 바로 출발 · 평균 타수가 기록 · 오늘 노선 ${esc(stops[0].n)} → ${esc(GOAL)}(${N}개 역)</small><button type="button" class="btn big" id="cmGo">탑승하기</button></div>`;
    $('#cmGo').onclick = () => ride();
  };
  const ride = () => {
    phase = 'ride';
    st.innerHTML = `<div class="cm-ride" id="cmRide">
      <p class="cm-ann" id="cmAnn"></p>
      <div class="cm-box" id="cmBox"><div class="cm-tg" id="cmTg"></div><div class="cm-ty" id="cmTy"></div>
        <input class="cm-in" id="cmIn" type="text" lang="ko" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="다음 역 이름 입력"></div>
      <div class="cm-meta"><span id="cmLeft"></span><span id="cmMiss">오타 0</span><span id="cmTime">0.0초</span></div>
      <small class="cm-hint">칸을 누르고 역 이름을 쳐요 · 틀리면 지우고 다시 · Enter는 지금 친 글자 지우기</small>
    </div>`;
    const inp = $('#cmIn');
    on(inp, 'compositionstart', () => { comp = true; });
    on(inp, 'compositionend', () => { comp = false; setTimeout(() => { if (alive) onInput(); }, 0); });
    on(inp, 'input', e => { comp = e.isComposing || comp; onInput(); });
    on(inp, 'keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); clearTyped(); } });
    on($('#cmBox'), 'pointerdown', () => setTimeout(() => inp.focus(), 0));
    paintStop(); inp.focus();
  };
  const typedOf = () => { const v = $('#cmIn').value; if (base > v.length) base = v.length; return v.slice(base); };
  const clearTyped = () => {
    const inp = $('#cmIn'); if (!inp) return;
    if (comp) base = inp.value.length; else { inp.value = ''; base = 0; }
    wrongNow = false; paintTyped('');
  };
  const paintStop = () => {
    const s = stops[cur], prev = stops[cur - 1], L = prev.x || prev.l;
    $('#cmTg').innerHTML = `${chip(L)}<b>${esc(s.n)}</b>`;
    $('#cmAnn').innerHTML = cur === N ? `이번 역은 <b>${esc(s.n)}</b> · 서울영상고 앞이에요!` : s.x ? `다음 역은 <b>${esc(s.n)}</b> · ${chip(s.x)} ${esc(s.x === s.l ? '신정지선' : LINES[s.x][0])}으로 갈아타요` : `다음 역은 <b>${esc(s.n)}</b>입니다`;
    $('#cmLeft').textContent = `남은 역 ${N - cur + 1}`;
    paintChips(st); paintTyped('');
  };
  // 친 글자 그리기: 맞은 글자 파랑 · 틀린 글자 빨강 · 조합 중인 마지막 글자는 회색
  const paintTyped = ty => {
    const tg = norm(stops[cur].n), box = $('#cmTy'); if (!box) return;
    const ch = [...ty];
    box.innerHTML = ch.map((x, i) => { const live = comp && i === ch.length - 1; return `<span class="${live ? 'lv' : x === tg[i] ? 'ok' : 'no'}">${esc(x)}</span>`; }).join('') + '<i class="cm-cr"></i>';
    $('#cmBox').classList.toggle('bad', wrongNow);
  };
  const onInput = () => {
    if (phase !== 'ride') return;
    const now = performance.now(), raw = typedOf(), ty = norm(raw), tg = norm(stops[cur].n);
    if (!t0 && ty) { t0 = now; tick(); }   // 첫 글자부터 시간 잼
    const ok = ty === tg || ty === tg + '역';
    // 확정된 글자(조합 중인 마지막 글자 빼고) 중 틀린 게 있으면 오타 한 번
    const fixed = comp ? [...ty].slice(0, -1) : [...ty], tc = [...tg], wrong = !ok && fixed.some((x, i) => x !== tc[i]);
    if (wrong && !wrongNow) { miss++; $('#cmMiss').textContent = '오타 ' + miss; sfx.tone(196, .12, 'square', .03); }
    wrongNow = wrong;
    if (ok) return arrive(now);
    pT = Math.max(pT, cur - 1 + Math.min(.92, keyFrac(raw.replace(/\s+/g, ''), tg)));   // 한 타 칠 때마다 열차가 다음 역 쪽으로(맞은 만큼만, 뒤로는 안 감)
    paintTyped(raw.replace(/\s+/g, ''));
  };
  const arrive = now => {
    const ms = Math.round(now - t0 - (times.reduce((a, b) => a + b, 0)));
    times.push(Math.max(0, ms)); keys += keysOf(stops[cur].n);
    const inp = $('#cmIn');
    if (comp) base = inp.value.length; else { inp.value = ''; base = 0; }
    wrongNow = false;
    pT = cur;
    sumEl.textContent = tpmOf(Math.round(times.reduce((a, b) => a + b, 0) * 100 / keys)) + '타';
    if (cur >= N) return finish();
    sfx.tone(988, .09, 'triangle', .045); sfx.tone(784, .14, 'triangle', .045, .1);
    if (stops[cur].x) sfx.tone(1175, .12, 'triangle', .04, .22);
    cur++; paintStop();
  };
  const tick = () => {
    if (!alive || phase !== 'ride') return;
    const t = $('#cmTime'); if (t && !hidAt) t.textContent = fmtS(performance.now() - t0);
    setTimeout(tick, 100);
  };
  const finish = () => {
    phase = 'done'; done = true;
    sfx.tone(784, .12, 'triangle', .05); sfx.tone(988, .12, 'triangle', .05, .12); sfx.tone(1318, .3, 'triangle', .05, .24);
    const rounds = [ri, ...times, miss], sum = times.reduce((a, b) => a + b, 0), x = { v: Math.max(1, Math.round(sum * 100 / keys)), ms: sum };   // 너무 빠른 역이 있어도 그대로 보냄(서버가 보류)
    $('#cmIn')?.blur();
    st.innerHTML = `<div class="cm-end"><b>등교 완료!</b><p>${esc(GOAL)}역 도착 · 서울영상고 앞</p></div>`;
    const det = `<p class="rdet cm-det"><span>노선 ${esc(stops[0].n)} → ${esc(GOAL)}</span><span>${N}개 역 · ${keys}타</span><span>${fmtS(x.ms || 0)}</span><span>오타 ${miss}</span></p>`;
    setTimeout(() => { if (alive) O.onDone?.(x.v, det, rounds); }, 1100);
  };
  // 화면을 벗어나면 시간 멈춤(숨긴 동안은 기록에서 뺌)
  on(document, 'visibilitychange', () => {
    if (phase !== 'ride' || !t0) return;
    if (document.hidden) hidAt = performance.now();
    else if (hidAt) { t0 += performance.now() - hidAt; hidAt = 0; }
  });
  on(document, 'keydown', e => {
    if (!alive || e.repeat || phase !== 'intro' || (e.key !== ' ' && e.key !== 'Enter') || document.querySelector('.modal.open') || e.target.closest?.('input,textarea,select')) return;
    e.preventDefault(); ride();
  });
  intro(); raf = requestAnimationFrame(draw);
  return {
    start() { if (phase === 'intro' && O.quick) ride(); },
    destroy() { alive = false; cancelAnimationFrame(raf); offs.forEach(f => f()); offs = []; },
  };
}
// 호선 동그라미 색(CSP: style="" 못 씀 → CSSOM)
export function paintChips(root) { root?.querySelectorAll('.cm-ln[data-l]').forEach(i => { i.style.background = LINES[i.dataset.l]?.[1] || '#888'; }); }
