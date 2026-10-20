// SVMHS GROUND — 화면 로직 (홈 · 급식 · 시간표 · 학사일정 · D-day · 모달)
import { $, $$, ymd, isYmd, parseYmd, addDays, today, mondayOf, diffDays, DOW, fmtDay, ddayText, pad, esc, store, skel, empty, toast } from './util.js';
import { api, MEALS, loadConfig, getMeals, getTimetable, getSchedule, cleanDish } from './neis.js';

/* ===== 설정 ===== */
const SITE_URL = 'https://svmhs-ground.pages.dev/';
const MAX_GRADE = 3, MAX_CLASS = 8, MAX_DDAY = 20;
const VIEWS = ['home', 'meal', 'tt', 'cal', 'dday'];

/* ===== 저장된 값 불러오기 (손상·조작된 값은 버림) ===== */
const validClass = c => c && +c.g >= 1 && +c.g <= MAX_GRADE && +c.c >= 1 && +c.c <= MAX_CLASS
  ? { g: String(+c.g), c: String(+c.c), dep: typeof c.dep === 'string' ? c.dep.slice(0, 30) : '' } : null;
const myDdays = () => {
  const l = store.get('ddays', []);
  return Array.isArray(l) ? l.filter(x => x && typeof x.name === 'string' && isYmd(x.date)).slice(0, MAX_DDAY) : [];
};

/* ===== 상태 ===== */
let cls = validClass(store.get('class', null));
const S = { mealDate: today(), ttWeek: mondayOf(today()), calMonth: new Date(today().getFullYear(), today().getMonth(), 1), homeMeal: null };
const startDay = ymd(today());

/* ===== 헤더 · 시계 · 종 시간 ===== */
// 학교 공지 시정표(2025 기준). 월·화·수 7교시, 목·금 6교시. 시험 기간 등 특별 일과는 반영 안 됨
const BELL = [['조회', '08:00', '08:10'], [1, '08:20', '09:10'], [2, '09:20', '10:10'], [3, '10:20', '11:10'], [4, '11:20', '12:10'],
  [5, '13:00', '13:50'], [6, '14:00', '14:50'], [7, '15:00', '15:50']]
  .map(([p, a, b]) => { const s = t => +t.slice(0, 2) * 3600 + +t.slice(3) * 60; return { p, start: s(a), end: s(b) }; });
const offDays = new Set();   // 학사일정상 휴업일(YYYYMMDD)
const fmtLeft = sec => { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); };
const pName = p => p === '조회' ? '조회' : p + '교시';

function bellInfo(n) {
  const dow = n.getDay();
  if (dow === 0 || dow === 6 || offDays.has(ymd(n))) return { state: '쉬는 날', label: '오늘은 수업이 없어요' };
  const last = dow <= 3 ? 7 : 6, list = BELL.filter(x => x.p === '조회' || x.p <= last);
  const now = (n - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 1000;
  for (let i = 0; i < list.length; i++) {
    const cur = list[i], prev = list[i - 1];
    if (now >= cur.end) continue;
    if (now >= cur.start) {   // 수업(또는 조회) 중
      if (cur.p === '조회') return { state: '조회 중', label: '1교시 시작까지', target: list[1].start, from: cur.start };
      const next = list[i + 1];
      return { state: `${pName(cur.p)} 수업 중`, label: !next ? '수업 끝까지' : cur.p === 4 ? '점심시간까지' : '쉬는 시간까지', target: cur.end, from: cur.start };
    }
    // 수업 전 쉬는 시간
    const state = !prev ? '등교 전' : prev.p === 4 ? '점심시간' : '쉬는 시간';
    return { state, label: `${pName(cur.p)} 시작까지`, target: cur.start, from: prev ? prev.end : null, brk: !!prev };
  }
  return { state: '방과 후', label: '오늘 수업이 끝났어요' };
}

// 지금 상태에 맞춘 G의 한마디 (시간대가 아니라 종 시간 기준이라 '수업 중인데 점심 인사' 같은 어긋남이 없음)
function sayLine(b) {
  const p = +((b.state.match(/^(\d)교시/) || [])[1] || 0);
  if (b.state === '쉬는 날') return '오늘은 쉬는 날! 푹 쉬자 😴';
  if (b.state === '방과 후') return '오늘도 수고했어 👋';
  if (b.state === '등교 전') return '좋은 아침! 오늘도 가보자 ☀️';
  if (b.state === '조회 중') return '조회 시간, 정신 차려~ 🫡';
  if (b.state === '점심시간') return '점심시간! 맛있게 먹고 와 🍚';
  if (b.state === '쉬는 시간') return '쉬는 시간! 잠깐 숨 돌리자 🙌';
  if (p === 4) return '배고프다… 점심까지 조금만 🤤';
  if (p >= 6) return '거의 다 왔어, 조금만 더 💪';
  return `${p}교시 버티는 중… 화이팅 ✊`;
}
// 오늘 시간표에서 지금/다음/끝난 교시 계산
function periodInfo(b) {
  const cur = +((b.state.match(/^(\d)교시/) || [])[1] || 0);
  const nxt = +((b.label.match(/^(\d)교시 시작/) || [])[1] || 0) || (cur ? cur + 1 : 0);
  const done = b.state === '방과 후' ? 99 : cur || nxt || 0;   // 이 교시 '전'까지는 끝남
  return { cur, nxt, done };
}
let nextKey = '', tickTimer = 0, heroVisible = true;
// 화면 밖으로 스크롤된 전광판·종 시간 타일은 애니메이션을 멈춘다 (스크롤 렉 방지)
const offscreen = new IntersectionObserver(es => es.forEach(e => {
  e.target.classList.toggle('paused', !e.isIntersecting);
  if (e.target.id === 'bigclock') { const was = heroVisible; heroVisible = e.isIntersecting; if (heroVisible && !was) tickClock(); }
}));
document.querySelectorAll('.ticker, #bigclock').forEach(el => offscreen.observe(el));
const lastVal = new Map();
const setText = (sel, v) => { if (lastVal.get(sel) !== v) { lastVal.set(sel, v); $(sel).textContent = v; } };
const setHtml = (sel, v) => { if (lastVal.get(sel) !== v) { lastVal.set(sel, v); $(sel).innerHTML = v; } };
function tickClock() {
  clearTimeout(tickTimer);
  if (document.hidden) return;   // 안 보일 땐 멈춤 (다시 보이면 visibilitychange에서 재시작)
  const n = new Date();
  setText('#cH', pad(n.getHours())); setText('#cM', pad(n.getMinutes())); setText('#cS', pad(n.getSeconds()));
  setText('#todayLbl', fmtDay(n));

  const b = bellInfo(n), secNow = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  const left = b.target != null ? b.target - secNow : null;
  const pi = periodInfo(b);
  const key = `${b.state}|${pi.cur}|${pi.nxt}|${S.todayTT ? S.todayTT.length : '-'}`;
  if (key !== nextKey) {   // 교시가 바뀔 때만 다시 그림
    nextKey = key; renderNext(b, pi); renderTicker(b, pi);
    $$('#hTT li').forEach(li => { const p = +li.dataset.p; li.classList.toggle('now', p === pi.cur); li.classList.toggle('done', p < pi.done && p !== pi.cur); });
  }
  if (!heroVisible) { tickTimer = setTimeout(tickClock, 1000 - new Date().getMilliseconds() + 5); return; }   // 스크롤로 안 보이면 큰 시계는 안 그림
  setText('#greet', sayLine(b));
  setText('#bellState', b.state);
  setText('#bellLbl', b.label);
  setHtml('#bellCnt', [...(left != null ? fmtLeft(left) : `${pad(n.getHours())}:${pad(n.getMinutes())}`)].map(ch => `<span class="${ch === ':' ? 'c' : 'n'}">${ch}</span>`).join(''));   // 글자 폭 고정(숫자가 바뀌어도 안 흔들림)
  const hero = $('#bigclock');
  hero.classList.toggle('soon', left != null && left <= 60);
  hero.classList.toggle('rest', /쉬는|점심/.test(b.state));
  const bar = b.from != null && left != null, prog = bar ? Math.min(1, (secNow - b.from) / (b.target - b.from)) : 0;
  $('#bellBarBox').hidden = !bar;
  if (bar) $('#bellBar').style.transform = `scaleX(${prog.toFixed(4)})`;
  setText('#bellPct', bar ? `${Math.floor(prog * 100)}% 지남` : b.target != null ? '곧 시작해요' : b.state === '쉬는 날' ? '푹 쉬는 날' : '오늘 수업 끝');
  tickTimer = setTimeout(tickClock, 1000 - new Date().getMilliseconds() + 5);   // 초가 바뀌는 순간에 맞춰 갱신
}
// 다음 수업 카드 (첫 화면 오른쪽 작은 카드)
function renderNext(b, pi) {
  const box = $('#hNext'), rows = S.todayTT;
  const subj = p => { const r = rows && rows.find(x => +x.PERIO === p); return r ? subjName(r.ITRT_CNTNT) : ''; };
  const card = (lbl, val, sub = '') => `<span class="m-lbl">${lbl}</span><b class="m-val">${val}</b>${sub}`;
  let h;
  if (!cls) h = card('다음 수업', '반을 골라 주세요', '<button class="link" data-open-class>반 설정하기</button>');
  else if (b.state === '쉬는 날') h = card('오늘', 'OFF', '<span class="m-sub">수업 없는 날이에요</span>');
  else if (rows && !rows.length) h = card('다음 수업', '정보가 아직 없어요');
  else if (b.state === '방과 후' || (rows && pi.nxt && !subj(pi.nxt) && !subj(pi.cur))) h = card('오늘 수업', '끝!', '<span class="m-sub">내일 또 봐요</span>');
  else if (rows === undefined) h = '<div class="skel"></div><div class="skel"></div>';
  else {
    const np = subj(pi.nxt) ? pi.nxt : 0;
    const sub = np && pi.cur && subj(pi.cur) ? `지금 · ${esc(subj(pi.cur))}` : np ? (b.state === '등교 전' ? '오늘 첫 수업' : '곧 시작해요') : '';
    h = np ? card('다음 수업', `${np}교시 · ${esc(subj(np))}`, sub ? `<span class="m-sub">${sub}</span>` : '')
           : card('지금 수업', `${pi.cur}교시 · ${esc(subj(pi.cur))}`);
  }
  box.innerHTML = h;
}
// 전광판: 오늘 정보를 한 줄로 흘려보냄
const TK = { meal: '', up: '' };
function renderTicker(b, pi) {
  b = b || bellInfo(new Date()); pi = pi || periodInfo(b);
  const rows = S.todayTT, subj = p => { const r = rows && rows.find(x => +x.PERIO === p); return r ? subjName(r.ITRT_CNTNT) : ''; };
  const items = [`${fmtDay(new Date())}`, b.state];
  if (pi.cur && subj(pi.cur)) items.push(`지금 ${pi.cur}교시 ${subj(pi.cur)}`);
  if (pi.nxt && subj(pi.nxt)) items.push(`다음 ${pi.nxt}교시 ${subj(pi.nxt)}`);
  if (TK.meal) items.push(`오늘 메인 ${TK.meal}`);
  if (TK.up) items.push(TK.up);
  items.push('SVMHS GROUND');
  const one = items.map(x => `<span>${esc(x)}</span><i>★</i>`).join('');
  $('#ticker').innerHTML = one + one;   // 두 번 이어 붙여서 끊김 없이 반복
}
async function loadOffDays() {
  try {
    (await loadUpcoming()).filter(r => r.SBTR_DD_SC_NM === '휴업일').forEach(r => offDays.add(r.AA_YMD));
  } catch {}
}
function renderClassChip() {
  const el = $('#classChip');
  el.hidden = !cls;
  if (cls) el.textContent = `${cls.g}학년 ${cls.c}반${cls.dep ? ' · ' + cls.dep : ''}`;
}

/* ===== 화면 이동 ===== */
const RENDER = { meal: renderMealView, tt: renderTTView, cal: renderCalView, dday: renderDdayView };
function go(v) {
  if (!VIEWS.includes(v)) v = 'home';
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  RENDER[v]?.();
  window.scrollTo(0, 0);
  onScroll();
  if (location.hash !== '#' + v) history.replaceState(null, '', v === 'home' ? location.pathname : '#' + v);
}
// 첫 화면에서 내려가거나 다른 화면이면 왼쪽 위 로고 대신 '처음으로' 버튼
function onScroll() { $('#hdr').classList.toggle('away', !$('#v-home').classList.contains('on') || scrollY > innerHeight * .5); }
addEventListener('scroll', onScroll, { passive: true });
$('#goDown').onclick = () => $('#apps').scrollIntoView({ behavior: 'smooth' });
// 바로가기 아이콘 → 위쪽 버튼과 같은 동작
const ACT = { share: '#btnShare', theme: '#btnTheme', info: '#btnInfo' };
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a && ACT[a.dataset.act]) $(ACT[a.dataset.act]).click(); });
document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });

/* ===== 급식 ===== */
// 메뉴 이름으로 이모지 고르기 (위에서부터 먼저 맞는 것)
const EMOJI = [[/우유|요구르트|요거트|주스|에이드|스무디|라떼/, '🥤'], [/김치|깍두기|겉절이|섞박지/, '🥬'], [/치킨|닭|윙|봉/, '🍗'],
  [/돈까스|돈가스|까스|가스|커틀릿|튀김|강정|탕수/, '🍤'], [/피자/, '🍕'], [/버거|햄버거/, '🍔'], [/떡볶이|떡/, '🍡'],
  [/면|국수|우동|짜장|짬뽕|파스타|스파게티|라면|쫄면|냉면/, '🍜'], [/카레|커리/, '🍛'], [/볶음밥|덮밥|비빔밥|주먹밥|김밥|밥/, '🍚'],
  [/국|탕|찌개|수프|스프/, '🍲'], [/생선|고등어|삼치|연어|가자미|동태|임연수|오징어|새우|쭈꾸미|주꾸미/, '🐟'],
  [/불고기|갈비|제육|고기|삼겹|목살|스테이크|보쌈|족발|함박|미트/, '🍖'], [/계란|달걀|에그|오믈렛|스크램블/, '🥚'],
  [/샐러드|무침|나물|겉절/, '🥗'], [/빵|파이|케이크|머핀|와플|토스트|도넛|츄러스|쿠키/, '🥐'],
  [/멜론|수박|사과|배|귤|오렌지|포도|딸기|바나나|파인애플|키위|과일|망고|복숭아/, '🍉'], [/아이스|빙수|젤리|푸딩/, '🍨']];
const dishEmoji = n => (EMOJI.find(([re]) => re.test(n)) || [, '🍽️'])[1];
// 메인 메뉴: 밥·국·김치·음료를 뺀 첫 반찬 (없으면 첫 메뉴)
const isSide = n => /^(흑미|잡곡|현미|보리|백미|쌀)?밥$|김치|깍두기|우유|요구르트|주스|국$|탕$|찌개$/.test(n);
const mealHtml = r => {
  if (!r) return empty('급식 정보가 없어요');
  const list = cleanDish(r.DDISH_NM);
  const mi = Math.max(0, list.findIndex(n => !isSide(n))), main = list[mi];
  const rest = list.filter((_, i) => i !== mi);
  return `<div class="dish-main"><span class="em" aria-hidden="true">${dishEmoji(main)}</span><span><small>오늘의 메인</small><b>${esc(main)}</b></span></div>`
    + `<ul class="dishes">${rest.map(x => `<li><span aria-hidden="true">${dishEmoji(x)}</span>${esc(x)}</li>`).join('')}</ul>`
    + (r.CAL_INFO ? `<div class="kcal">🔥 ${esc(r.CAL_INFO)}</div>` : '');
};
async function renderHomeMeal() {
  const box = $('#hMeal'), tabs = $('#hMealTabs');
  try {
    const rows = (await getMeals(today())).filter(r => MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
    if (!rows.length) { tabs.innerHTML = ''; box.innerHTML = empty('오늘은 급식이 없어요'); return; }
    const h = new Date().getHours(), pref = h < 9 ? '1' : h < 14 ? '2' : '3';
    const sel = S.homeMeal || (rows.find(r => r.MMEAL_SC_CODE === pref) || rows.find(r => r.MMEAL_SC_CODE === '2') || rows[0]).MMEAL_SC_CODE;
    tabs.innerHTML = rows.map(r => `<button data-m="${r.MMEAL_SC_CODE}" class="${r.MMEAL_SC_CODE === sel ? 'on' : ''}">${MEALS[r.MMEAL_SC_CODE]}</button>`).join('');
    box.innerHTML = mealHtml(rows.find(r => r.MMEAL_SC_CODE === sel));
    const lunch = rows.find(r => r.MMEAL_SC_CODE === '2') || rows[0], ll = cleanDish(lunch.DDISH_NM);
    TK.meal = ll[Math.max(0, ll.findIndex(n => !isSide(n)))] || ''; renderTicker();
  } catch { box.innerHTML = empty('급식 정보를 불러오지 못했어요'); }
}
$('#hMealTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.homeMeal = b.dataset.m; renderHomeMeal(); } });
async function renderMealView() {
  const d = S.mealDate, cols = $('#mCols');
  $('#mLbl').textContent = fmtDay(d);
  cols.innerHTML = Object.values(MEALS).map(n => `<div class="card k-meal"><h3>${n}</h3>${skel(4)}</div>`).join('');
  try {
    const rows = await getMeals(d);
    if (d !== S.mealDate) return;   // 그사이 날짜를 넘겼으면 버림
    cols.innerHTML = Object.entries(MEALS).map(([c, n]) => `<div class="card k-meal"><h3>${n}</h3>${mealHtml(rows.find(r => r.MMEAL_SC_CODE === c))}</div>`).join('');
  } catch { cols.innerHTML = `<div class="card k-meal">${empty('급식 정보를 불러오지 못했어요')}</div>`; }
}
$('#mPrev').onclick = () => { S.mealDate = addDays(S.mealDate, -1); renderMealView(); };
$('#mNext').onclick = () => { S.mealDate = addDays(S.mealDate, 1); renderMealView(); };

/* ===== 시간표 ===== */
const subjName = s => String(s || '').replace(/^[\s*#·-]+/, '').trim();   // 나이스 원문의 '* 영상 CG작업' 같은 기호 제거
const needClass = empty('반을 설정하면 시간표가 보여요 · <button class="link" data-open-class>설정하기</button>');
async function renderHomeTT() {
  const box = $('#hTT'), d = today();
  if (!cls) { box.innerHTML = needClass; return; }
  if (d.getDay() % 6 === 0) { S.todayTT = []; box.innerHTML = empty('오늘은 주말이에요. 푹 쉬어요!'); return; }
  try {
    const rows = (await getTimetable(cls, mondayOf(d), addDays(mondayOf(d), 4))).filter(r => r.ALL_TI_YMD === ymd(d)).sort((a, b) => a.PERIO - b.PERIO);
    S.todayTT = rows;
    const dep = rows[0] && rows[0].DDDEP_NM;   // 학과 이름은 시간표 응답에서 알아냄
    if (dep && cls.dep !== dep) { cls.dep = dep; store.set('class', cls); renderClassChip(); }
    box.innerHTML = rows.length
      ? `<ul class="tt">${rows.map(r => `<li data-p="${esc(r.PERIO)}"><span class="p">${esc(r.PERIO)}</span><span class="s">${esc(subjName(r.ITRT_CNTNT))}</span></li>`).join('')}</ul>` + (api.hasKey ? '' : '<p class="note">5교시까지만 표시돼요</p>')
      : empty('오늘 시간표 정보가 없어요');
  } catch { S.todayTT = []; box.innerHTML = empty('시간표를 불러오지 못했어요'); }
  nextKey = '';   // 다음 수업 타일 다시 그리기
}
async function renderTTView() {
  const mon = S.ttWeek, fri = addDays(mon, 4), box = $('#tWeek');
  $('#tLbl').textContent = `${mon.getMonth() + 1}/${mon.getDate()} ~ ${fri.getMonth() + 1}/${fri.getDate()}`;
  $('#ttTitle').textContent = cls ? `${cls.g}학년 ${cls.c}반 시간표` : '주간 시간표';
  $('#ttNote').textContent = api.hasKey ? '' : '지금은 하루 5교시까지만 표시돼요. (인증키 등록 전)';
  if (!cls) { box.innerHTML = needClass; return; }
  box.innerHTML = skel(5);
  try {
    const rows = await getTimetable(cls, mon, fri);
    if (mon !== S.ttWeek) return;
    if (!rows.length) { box.innerHTML = empty('이 주의 시간표 정보가 없어요'); return; }
    const days = [0, 1, 2, 3, 4].map(i => addDays(mon, i)), t = ymd(today());
    const maxP = Math.min(10, Math.max(6, ...rows.map(r => +r.PERIO || 0)));
    const map = {}; rows.forEach(r => { map[r.ALL_TI_YMD + '_' + r.PERIO] = subjName(r.ITRT_CNTNT); });
    const td = (d, p) => `<td class="${ymd(d) === t ? 'today' : ''}">${esc(map[ymd(d) + '_' + p] || '')}</td>`;
    let h = '<table class="week"><thead><tr><th></th>' + days.map(d => `<th class="${ymd(d) === t ? 'today' : ''}">${DOW[d.getDay()]} ${d.getDate()}</th>`).join('') + '</tr></thead><tbody>';
    for (let p = 1; p <= maxP; p++) h += `<tr><td class="pn">${p}</td>${days.map(d => td(d, p)).join('')}</tr>`;
    box.innerHTML = h + '</tbody></table>';
  } catch { box.innerHTML = empty('시간표를 불러오지 못했어요'); }
}
$('#tPrev').onclick = () => { S.ttWeek = addDays(S.ttWeek, -7); renderTTView(); };
$('#tNext').onclick = () => { S.ttWeek = addDays(S.ttWeek, 7); renderTTView(); };

/* ===== 학사일정 ===== */
const evHtml = rows => {
  const t = today();
  return `<ul class="ev">${rows.map(r => {
    const d = parseYmd(r.AA_YMD), off = r.SBTR_DD_SC_NM === '휴업일';
    const tag = off ? '<span class="tag off">휴업</span>' : `<span class="tag">${ddayText(diffDays(d, t))}</span>`;
    return `<li class="${d < t ? 'past' : ''}"><div class="d"><b>${d.getDate()}</b><span>${d.getMonth() + 1}월 ${DOW[d.getDay()]}</span></div><div class="n">${esc(r.EVENT_NM)}</div>${tag}</li>`;
  }).join('')}</ul>`;
};
let upcoming = null;   // 앞으로 60일 일정 (홈 · D-day가 같이 씀)
const loadUpcoming = () => {
  if (!upcoming) upcoming = getSchedule(today(), addDays(today(), 60)).catch(e => { upcoming = null; throw e; });
  return upcoming;
};
async function renderCalView() {
  const m = S.calMonth, end = new Date(m.getFullYear(), m.getMonth() + 1, 0), box = $('#cList');
  $('#cLbl').textContent = `${m.getFullYear()}년 ${m.getMonth() + 1}월`;
  box.innerHTML = skel(4);
  try {
    const rows = await getSchedule(m, end);
    if (m !== S.calMonth) return;
    box.innerHTML = rows.length ? evHtml(rows) : empty('이 달에는 일정이 없어요');
  } catch { box.innerHTML = empty('일정을 불러오지 못했어요'); }
}
$('#cPrev').onclick = () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() - 1, 1); renderCalView(); };
$('#cNext').onclick = () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + 1, 1); renderCalView(); };

/* ===== D-day ===== */
const byDate = (a, b) => a.date.localeCompare(b.date);
function ddayListHtml(list) {   // list: [{ name, date, i? }] — i가 있으면 삭제 버튼 표시
  const t = today();
  if (!list.length) return empty('아직 D-day가 없어요');
  return `<ul class="dlist">${list.map(x => {
    const d = parseYmd(x.date);
    const del = x.i == null ? '' : `<button class="x" data-del="${x.i}" aria-label="${esc(x.name)} 삭제">✕</button>`;
    return `<li><span class="num">${ddayText(diffDays(d, t))}</span><span class="nm">${esc(x.name)}<br><span class="dt">${fmtDay(d)}</span></span>${del}</li>`;
  }).join('')}</ul>`;
}
// 홈 '다가오는 일정': 학교 일정 + 내 D-day를 날짜순으로 한 줄에 (큰 D-숫자 타일)
async function renderHomeDday() {
  const box = $('#hUp'), t = today();
  const mine = myDdays().filter(x => parseYmd(x.date) >= t).map(x => ({ ...x, mine: true }));
  let school = [], fail = false;
  try {
    school = (await loadUpcoming()).map(r => ({ name: r.EVENT_NM, date: r.AA_YMD, off: r.SBTR_DD_SC_NM === '휴업일' }));
  } catch { fail = true; }
  const list = mine.concat(school).sort(byDate).slice(0, 10);
  if (!list.length) { box.innerHTML = empty(fail ? '일정을 불러오지 못했어요' : '60일 안에 예정된 일정이 없어요 · <button class="link" data-go="dday">D-day 추가</button>'); return; }
  { const f = list[0]; TK.up = `${f.name} ${ddayText(diffDays(parseYmd(f.date), t))}`; renderTicker(); }
  box.innerHTML = list.map((x, i) => {
    const d = parseYmd(x.date), n = diffDays(d, t);
    const tag = x.mine ? '<em class="tag me">내 D-day</em>' : x.off ? '<em class="tag off">쉬는 날</em>' : '';
    return `<div class="up${i === 0 ? ' first' : ''}${x.mine ? ' mine' : ''}"><b class="num">${ddayText(n)}</b><p class="nm">${esc(x.name)}</p><span class="dt">${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})</span>${tag}</div>`;
  }).join('');
}
async function renderDdayView() {
  $('#dMine').innerHTML = ddayListHtml(myDdays().map((x, i) => ({ ...x, i })).sort(byDate));
  $('#dSchool').innerHTML = skel(3);
  try {
    $('#dSchool').innerHTML = ddayListHtml((await loadUpcoming()).slice(0, 8).map(r => ({ name: r.EVENT_NM, date: r.AA_YMD })));
  } catch { $('#dSchool').innerHTML = empty('일정을 불러오지 못했어요'); }
}
$('#dForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#dName').value.trim().slice(0, 30), date = $('#dDate').value.replace(/-/g, '');
  if (!name || !isYmd(date)) { toast('이름과 날짜를 입력해 주세요'); return; }
  const l = myDdays(); if (l.length >= MAX_DDAY) { toast(`D-day는 ${MAX_DDAY}개까지 저장할 수 있어요`); return; }
  l.push({ name, date }); store.set('ddays', l);
  e.target.reset();
  renderDdayView(); renderHomeDday(); toast('추가했어요');
});
$('#dMine').addEventListener('click', e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  const l = myDdays(); l.splice(+b.dataset.del, 1); store.set('ddays', l);
  renderDdayView(); renderHomeDday();
});

/* ===== 모달 공통 ===== */
let lastFocus = null;
const openModal = id => { lastFocus = document.activeElement; const m = $(id); m.classList.add('open'); [...m.querySelectorAll('button, select')].find(el => !el.hidden)?.focus(); };
const closeModal = m => { m.classList.remove('open'); lastFocus?.focus?.(); };
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal.open').forEach(closeModal); });

/* ===== 공유 ===== */
const shareUrl = () => location.protocol.startsWith('http') ? location.origin + '/' : SITE_URL;
$('#btnShare').onclick = async () => {
  const url = shareUrl();
  const { QR } = await import('./qr.js');   // 공유할 때만 받음
  $('#qr').innerHTML = QR.toSvg(url);
  $('#shareUrl').textContent = url;
  $('#nativeShare').hidden = !navigator.share;
  openModal('#mShare');
};
$('#nativeShare').onclick = async () => {
  try { await navigator.share({ title: 'SVMHS GROUND', text: '서울영상고 급식·시간표·학사일정 한눈에 보기', url: shareUrl() }); } catch {}
};
$('#copyUrl').onclick = async () => {
  const url = $('#shareUrl').textContent;
  try { await navigator.clipboard.writeText(url); }
  catch { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
  toast('주소를 복사했어요');
};

/* ===== 반 설정 ===== */
$('#selC').innerHTML = Array.from({ length: MAX_CLASS }, (_, i) => `<option value="${i + 1}">${i + 1}반</option>`).join('');
function openClass() { if (cls) { $('#selG').value = cls.g; $('#selC').value = cls.c; } openModal('#mClass'); }
$('#btnClass').onclick = openClass;
document.addEventListener('click', e => { if (e.target.closest('[data-open-class]')) openClass(); });
$('#saveClass').onclick = () => {
  const next = validClass({ g: $('#selG').value, c: $('#selC').value });
  if (!next) return;
  if (cls && cls.g === next.g && cls.c === next.c) next.dep = cls.dep;
  cls = next; store.set('class', cls);
  closeModal($('#mClass')); renderClassChip(); renderHomeTT();
  if ($('#v-tt').classList.contains('on')) renderTTView();
  toast(`${cls.g}학년 ${cls.c}반으로 설정했어요`);
};

/* ===== 이용 안내 · 홈 화면에 추가 ===== */
$('#btnInfo').onclick = () => openModal('#mInfo');
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
$('#installBtn').onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $('#installBtn').hidden = true;
};
$('#clearData').onclick = () => {
  if (!confirm('이 기기에 저장된 반 설정·D-day·테마를 모두 지울까요?')) return;
  store.clearAll(); location.reload();
};

/* ===== 테마 (첫 적용은 js/theme.js가 깜빡임 없이 처리) ===== */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('meta[name=theme-color]').content = t === 'dark' ? '#0e2236' : '#eaf5fd';
}
applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
$('#btnTheme').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); store.set('theme', t); };

/* ===== 시작 ===== */
tickClock();
renderClassChip();
store.pruneCache();
// 날짜가 바뀐 채로 다시 열면(자정 넘김) 새로 고침
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (ymd(today()) !== startDay) location.reload(); else tickClock();
});
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
loadConfig().finally(() => {
  renderHomeMeal(); renderHomeTT(); renderHomeDday(); loadOffDays();
  const h = location.hash.slice(1); if (h && h !== 'home') go(h);
  if (!cls) setTimeout(openClass, 400);
});
