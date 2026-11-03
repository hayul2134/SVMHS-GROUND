// SVMHS GROUND — 등교하기!(2026-11-02 하율 "지하철 노선도로 타자연습하는 게임, 이름은 등교하기!", 미리보기 깃발 commute-game — 개발자만)
// 지도 위 열차가 학교 앞 신정역(5호선)까지 감. 다음 역 이름을 한 타씩 치면 열차가 그만큼 나아가고, 다 치면 그 역에 도착.
// 규칙·타수 계산은 commute-score.js(서버와 같음), 지도·자모는 commute-map.js. createCommute(el, O) → { start, destroy }
//   O: quick(안내 건너뜀) · onDone(v, detailHtml, rounds)
// 입력(2026-11-02 4차 하율 "잘못 누르면 안 써지고 빨갛게 흔들, 오타 +1"): 친 글자는 IME가 아니라 '맞게 친 자모(seq)'로만 그림 → 틀린 타는 아예 안 들어감.
//   ① 키보드(노트북·키보드 커버): 글자를 못 쓰는 칸(.cm-box, tabindex)에 포커스 → IME 없이 e.code를 두벌식 자모로 바꿔 한 타씩 판정(한/영 상태 상관없음)
//   ② 화면 자판(터치): 투명 입력칸 + IME → 입력칸 값을 자모로 풀어 판정, 틀리면 칸을 비우고 다시 포커스(조합 초기화)
// 노선 고르기(같은 날 하율 "노선도를 자기가 설정"): 안내 화면에서 10개 중 고르거나 무작위 — 이 기기에 기억(sg_commute_rt)
//   출발역 직접 고르기(2026-11-03 하율 "출발 지점을 마음대로 설정"): 역 이름(문자열)을 저장 → routeFrom이 신정까지 가장 빠른 길을 만듦
import { LINES, GOAL, ROUTES, PICK, EXTREMES, linesAt, stopsOfRoute, routeFrom, keysOf, tpmOf } from './commute-score.js';
import { makeSfx, sndBtnHtml, bindSnd } from './sfx.js';
import { createMap, seqOf, partial, KEYMAP, KEYMAP_S } from './commute-map.js';
import { store } from './util.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = l => `<i class="cm-ln" data-l="${l}">${l}</i>`;
const fmtS = ms => (ms / 1000).toFixed(1) + '초';
const TOUCH = matchMedia('(pointer:coarse)').matches;

export function createCommute(el, O = {}) {
  const sfx = makeSfx('commute_snd');
  let pref = store.get('commute_rt', -1); if (typeof pref !== 'string' || !routeFrom(pref)) pref = -1;   // 옛 노선 번호 저장값은 무작위로
  let ri = 0, stops = null, N = 0, map = null;
  const pickRoute = () => { ri = typeof pref === 'string' ? pref : Math.floor(Math.random() * ROUTES.length); stops = stopsOfRoute(typeof ri === 'string' ? routeFrom(ri) : ROUTES[ri]); N = stops.length - 1; map = createMap(stops); };
  pickRoute();
  el.innerHTML = `<div class="cm" id="cm">
    <div class="cm-top"><span class="cm-rt" id="cmRt"></span><span class="cm-sum" id="cmSum">0타</span>${sndBtnHtml('cmSnd')}</div>
    <div class="cm-map"><canvas id="cmCv"></canvas></div>
    <div class="cm-st" id="cmSt"></div>
  </div>`;
  bindSnd(el.querySelector('#cmSnd'), sfx);
  const $ = s => el.querySelector(s), cv = $('#cmCv'), st = $('#cmSt'), sumEl = $('#cmSum');
  const paintHead = () => { $('#cmRt').innerHTML = `${stops.filter((s, i) => !i || s.x).map(s => chip(s.x || s.l)).join('')}<b>${esc(stops[0].n)} → ${esc(GOAL)}</b><small>${N}개 역</small>`; paintChips($('#cmRt')); };
  paintHead();
  let alive = true, raf = 0, phase = 'intro', cur = 1, offs = [], t0 = 0, hidAt = 0, miss = 0, keys = 0, done = false;
  let seq = '', tgSeq = '', acc = '';   // seq = 지금 역에서 맞게 친 자모 · tgSeq = 지금 역 이름의 자모 · acc = 화면 자판: 입력칸을 비우기 전까지 맞게 친 것
  const times = [];
  const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); offs.push(() => t.removeEventListener(ev, f, o)); };

  // ---------- 지도 — 열차 위치 p = 역 번호(소수), 목표 pT로 부드럽게 ----------
  let p = 0, pT = 0, last = 0;
  const draw = now => {
    if (!alive) return;
    const r = cv.parentElement.getBoundingClientRect(), d = Math.min(2, window.SG_DPR || devicePixelRatio || 1), W = r.width, H = r.height;
    if (W && H) {
      if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
      p += (pT - p) * Math.min(1, dt * 7); if (Math.abs(pT - p) < .001) p = pT;
      const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
      map.draw(c, W, H, p, cur, now, done);
    }
    raf = requestAnimationFrame(draw);
  };

  // ---------- 안내 + 노선 고르기 ----------
  const intro = () => {
    phase = 'intro';
    const cur0 = typeof pref === 'string' ? pref : '';
    let tab = cur0 ? (PICK.find(([, G]) => G.some(([, a]) => a.includes(cur0))) || PICK[0])[0] : 5;
    const qb = (q, t, sub) => `<button type="button" class="cm-q ${q}" data-q="${q}"><b>${t}</b><small>${sub}</small></button>`;
    st.innerHTML = `<div class="cm-intro"><b>등교하기!</b><p>지하철을 타고 학교 앞 <em>신정역</em>까지!<br>다음 역 이름을 한 타씩 치면 열차가 달려요</p>
      <div class="cm-pick"><div class="cm-qs">${qb('rand', '무작위', '매번 다른 역에서')}${qb('long', '가장 긴 길', `${esc(EXTREMES.long[0])} · ${EXTREMES.long[1]}역`)}${qb('short', '가장 짧은 길', `${esc(EXTREMES.short[0])} · ${EXTREMES.short[1]}역`)}</div>
        <div class="cm-or"><span>또는 출발역 직접 고르기</span></div>
        <div class="cm-tabs" role="tablist">${PICK.map(([l]) => `<button type="button" class="cm-tab" role="tab" data-tab="${l}">${chip(l)}<span>${esc(LINES[l][0])}</span></button>`).join('')}</div>
        <div class="cm-sts" id="cmSts"></div><div class="cm-sel" id="cmSel"></div></div>
      <small>틀린 타는 안 써지고 오타로 세요 · 평균 타수가 기록</small><button type="button" class="btn big" id="cmGo">탑승하기</button></div>`;
    const sts = $('#cmSts'), sel = $('#cmSel');
    // 역 줄: 실제 노선도처럼 한 줄로 이어지게 — 줄 끝에서 U자로 꺾여 다음 줄로(지그재그), 칸 수는 폭에 맞춤
    const node = n => n === GOAL
      ? `<span class="cm-nd goal" data-col><i></i><b>${esc(n)}</b><small>학교</small></span>`
      : `<button type="button" class="cm-nd${n === pref ? ' on' : ''}${linesAt(n).length > 1 ? ' x' : ''}" data-st="${esc(n)}" data-col><i></i><b>${esc(n)}</b>${linesAt(n).length > 1 ? `<span>${linesAt(n).filter(x => x !== tab).map(chip).join('')}</span>` : ''}</button>`;
    const snake = (a, cols) => {
      const rows = []; for (let i = 0; i < a.length; i += cols) rows.push(a.slice(i, i + cols));
      return `<div class="cm-snake" data-cols="${cols}">${rows.map((r, ri) => {
        const rev = ri % 2, last = ri === rows.length - 1, pos = k => ((rev ? cols - 1 - k : k) + .5) / cols * 100;
        const x1 = ri ? (rev ? 100 : 0) : pos(0), x2 = last ? pos(r.length - 1) : (rev ? 0 : 100);
        return `<div class="cm-lr" data-a="${Math.min(x1, x2)}" data-b="${Math.max(x1, x2)}">${last ? '' : `<i class="cm-turn ${rev ? 'l' : 'r'}"></i>`}<em class="cm-bar"></em>${r.map((n, k) => node(n).replace('data-col', `data-col="${rev ? cols - k : k + 1}"`)).join('')}</div>`;
      }).join('')}</div>`;
    };
    const paintPick = () => {
      st.querySelectorAll('.cm-tab').forEach(b => { const o = +b.dataset.tab === tab; b.classList.toggle('on', o); b.setAttribute('aria-selected', o); });
      const q = typeof pref !== 'string' ? 'rand' : pref === EXTREMES.long[0] ? 'long' : pref === EXTREMES.short[0] ? 'short' : '';
      st.querySelectorAll('.cm-q').forEach(b => b.classList.toggle('on', b.dataset.q === q));
      const G = PICK.find(([l]) => l === tab)[1], cols = Math.max(3, Math.min(9, Math.floor((sts.clientWidth - 56) / 86)));
      sts.innerHTML = G.map(([t, a]) => `${t ? `<div class="cm-sub">${esc(t)}</div>` : ''}${snake(a, cols)}`).join('');
      sts.style.setProperty('--c', LINES[tab][1]);
      sts.querySelectorAll('.cm-snake').forEach(x => x.style.setProperty('--cols', x.dataset.cols));
      sts.querySelectorAll('.cm-lr').forEach(r => { const b = r.querySelector('.cm-bar'); b.style.left = r.dataset.a + '%'; b.style.width = (r.dataset.b - r.dataset.a) + '%'; });
      sts.querySelectorAll('[data-col]').forEach(x => { x.style.gridColumn = x.dataset.col; });
      paintChips(sts);
      sel.innerHTML = typeof pref === 'string'
        ? `${stops.filter((s, i) => !i || s.x).map(s => chip(s.x || s.l)).join('')}<b>${esc(stops[0].n)} → ${esc(GOAL)}</b><span>${N}개 역 · 갈아타기 ${stops.filter(s => s.x).length}번</span>`
        : '<b>무작위</b><span>탈 때마다 다른 역에서 출발해요</span>';
      paintChips(sel);
    };
    const setPref = v => { pref = v; store.set('commute_rt', pref); pickRoute(); p = pT = 0; paintHead(); paintPick(); sfx.tone(660, .05, 'triangle', .035); };
    paintChips(st); paintPick();
    on(window, 'resize', () => { if (phase === 'intro') paintPick(); });
    $('.cm-qs').onclick = e => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      const q = b.dataset.q; if (q === 'rand') return setPref(-1);
      const n = EXTREMES[q][0]; tab = (PICK.find(([, G]) => G.some(([, a]) => a.includes(n))) || PICK[0])[0]; setPref(n);
    };
    $('.cm-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = +b.dataset.tab; paintPick(); } };
    sts.onclick = e => { const b = e.target.closest('[data-st]'); if (b && routeFrom(b.dataset.st)) setPref(b.dataset.st); };
    $('#cmGo').onclick = () => ride();
  };

  // ---------- 타는 중 ----------
  const ride = () => {
    phase = 'ride';
    st.innerHTML = `<div class="cm-ride" id="cmRide">
      <p class="cm-ann" id="cmAnn"></p>
      <div class="cm-box" id="cmBox" tabindex="0" role="textbox" aria-label="다음 역 이름 입력"><div class="cm-tg" id="cmTg"></div><div class="cm-ty" id="cmTy"></div>
        ${TOUCH ? '<input class="cm-in" id="cmIn" type="text" lang="ko" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" aria-label="다음 역 이름 입력">' : ''}</div>
      <div class="cm-meta"><span id="cmLeft"></span><span id="cmMiss">오타 0</span><span id="cmTime">0.0초</span></div>
      <small class="cm-hint">${TOUCH ? '칸을 누르고' : '칸을 누른 뒤'} 역 이름을 쳐요 · 한/영 상관없이 두벌식으로 · 틀린 타는 안 써져요</small>
    </div>`;
    const box = $('#cmBox'), inp = $('#cmIn');
    if (inp) {
      on(inp, 'input', () => imeInput());
      on(inp, 'compositionend', () => setTimeout(() => alive && imeInput(), 0));
      on(box, 'pointerdown', () => setTimeout(() => inp.focus(), 0));
    } else on(box, 'pointerdown', () => setTimeout(() => box.focus(), 0));
    paintStop(); (inp || box).focus();
  };
  const startClock = () => { if (!t0) { t0 = performance.now(); tick(); } };
  const paintStop = () => {
    const s = stops[cur], prev = stops[cur - 1], L = prev.x || prev.l;
    seq = ''; acc = ''; tgSeq = seqOf(s.n);
    $('#cmTg').innerHTML = `${chip(L)}<b>${esc(s.n)}</b>`;
    $('#cmAnn').innerHTML = cur === N ? `이번 역은 <b>${esc(s.n)}</b> · 서울영상고 앞이에요!` : s.x ? `다음 역은 <b>${esc(s.n)}</b> · ${chip(s.x)} ${esc(s.x === s.l ? '신정지선' : LINES[s.x][0])}으로 갈아타요` : `다음 역은 <b>${esc(s.n)}</b>입니다`;
    $('#cmLeft').textContent = `남은 역 ${N - cur + 1}`;
    paintChips(st); paintTyped();
  };
  const paintTyped = () => { const [a, b] = partial(stops[cur].n, seq.length), box = $('#cmTy'); if (box) box.innerHTML = `<span class="ok">${esc(a)}</span>${b ? `<span class="lv">${esc(b)}</span>` : ''}<i class="cm-cr"></i>`; };
  // 맞은 만큼 반영(열차도 그만큼) → 다 쳤으면 도착
  const accept = () => {
    pT = Math.max(pT, cur - 1 + Math.min(.92, seq.length / tgSeq.length));
    if (seq === tgSeq) return arrive(performance.now());
    paintTyped();
  };
  const reject = () => {
    miss++; $('#cmMiss').textContent = '오타 ' + miss; sfx.tone(196, .12, 'square', .03);
    const b = $('#cmBox'); if (!b) return; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('bad'), 380);
  };
  // ① 키보드: 한 타씩
  on(document, 'keydown', e => {
    if (!alive || document.querySelector('.modal.open') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (phase === 'intro') { if (!e.repeat && (e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('input,textarea,select,button')) { e.preventDefault(); ride(); } return; }
    if (phase !== 'ride' || e.isComposing || e.keyCode === 229) return;   // 화면 자판(IME)은 ②에서
    const j = (e.shiftKey && KEYMAP_S[e.code]) || KEYMAP[e.code];
    if (e.code === 'Backspace') { e.preventDefault(); if (seq.length > acc.length) { seq = seq.slice(0, -1); paintTyped(); } return; }
    if (!j) return;
    e.preventDefault(); if (e.repeat) return;
    startClock();
    if (tgSeq[seq.length] === j) { seq += j; accept(); } else reject();
  }, true);
  // ② 화면 자판: 입력칸 값을 자모로 풀어 맞는지 — 틀리면 칸을 비우고 다시 포커스(조합 초기화), 맞은 것(acc)은 그대로
  // 역에 도착하면 칸은 그대로 두고 앞 역 글자 수(base)만큼 잘라 봄(매 역마다 자판이 깜빡이지 않게) — 틀렸을 때만 비우고 다시 포커스
  let base = 0;
  const reset = () => { const inp = $('#cmIn'); if (!inp) return; acc = seq; base = 0; inp.value = ''; inp.blur(); setTimeout(() => { if (alive && phase === 'ride') inp.focus(); }, 0); };
  const imeInput = () => {
    const inp = $('#cmIn'); if (phase !== 'ride' || !inp) return;
    if (base > inp.value.length) base = inp.value.length;
    const full = acc + seqOf(inp.value.slice(base).replace(/\s+/g, ''));
    if (full.length) startClock();
    if (tgSeq.startsWith(full)) { seq = full; accept(); return; }
    reject(); seq = longest(full); reset(); accept();
  };
  const longest = s => { let i = 0; while (i < s.length && s[i] === tgSeq[i]) i++; return s.slice(0, i); };
  const arrive = now => {
    const ms = Math.round(now - t0 - times.reduce((a, b) => a + b, 0));
    times.push(Math.max(0, ms)); keys += keysOf(stops[cur].n);
    pT = cur;
    sumEl.textContent = tpmOf(Math.round(times.reduce((a, b) => a + b, 0) * 100 / keys)) + '타';
    const inp = $('#cmIn'); if (inp) { base = inp.value.length; acc = ''; }
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
    $('#cmIn')?.blur(); $('#cmBox')?.blur();
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
  intro(); raf = requestAnimationFrame(draw);
  return {
    start() { if (phase === 'intro' && O.quick) ride(); },
    destroy() { alive = false; cancelAnimationFrame(raf); offs.forEach(f => f()); offs = []; },
  };
}
// 호선 동그라미 색(CSP: style="" 못 씀 → CSSOM)
export function paintChips(root) { root?.querySelectorAll('.cm-ln[data-l]').forEach(i => { i.style.background = LINES[i.dataset.l]?.[1] || '#888'; }); }
