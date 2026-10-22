// SVMHS GROUND — 화면 로직 (홈 · 급식 · 시간표 · 학사일정 · D-day · 모달)
import { $, $$, now, ymd, isYmd, parseYmd, addDays, today, mondayOf, diffDays, DOW, fmtDay, ddayText, pad, esc, store, skel, empty, toast } from './util.js';
import { api, MEALS, loadConfig, getClasses, getMeals, getMealsRange, getTimetable, getSchedule, cleanDish } from './neis.js';
import { foodSvg, arBucket, drinkSvg, isDrink, foodImg } from './food.js';

/* ===== 설정 ===== */
const SITE_URL = 'https://svmhs-ground.pages.dev/';
const MAX_GRADE = 3, MAX_CLASS = 10, BASE_CLASS = 6, MAX_DDAY = 20;   // 2026년 학년별 6개 반 (반 목록은 나이스에서 받아옴, 실패 시 BASE_CLASS)
const VIEWS = ['home', 'meal', 'tt', 'cal', 'dday', 'me', 'u', 'dm', 'game'];   // me·u·dm·game은 social.js가 그림

/* ===== 저장된 값 불러오기 (손상·조작된 값은 버림) ===== */
const validClass = c => c && +c.g >= 1 && +c.g <= MAX_GRADE && +c.c >= 1 && +c.c <= MAX_CLASS
  ? { g: String(+c.g), c: String(+c.c), dep: typeof c.dep === 'string' ? c.dep.slice(0, 30) : '' } : null;
const myDdays = () => {
  const l = store.get('ddays', []);
  return Array.isArray(l) ? l.filter(x => x && typeof x.name === 'string' && isYmd(x.date)).slice(0, MAX_DDAY) : [];
};

/* ===== 상태 ===== */
let cls = validClass(store.get('class', null));
const S = { mealSlot: '', mealManual: false, sMealDay: null, heroPick: null, ttPick: null, mealDate: today(), ttWeek: mondayOf(today()), calMonth: new Date(today().getFullYear(), today().getMonth(), 1), homeMeal: null, homeWeek: mondayOf(addDays(today(), today().getDay() === 6 ? 2 : today().getDay() === 0 ? 1 : 0)) };
const startDay = ymd(today());

/* ===== 헤더 · 시계 · 종 시간 ===== */
// 학교 공지 시정표(2025 기준). 월·화·수 7교시, 목·금 6교시. 시험 기간 등 특별 일과는 반영 안 됨
const BELL = [['조회', '08:00', '08:10'], [1, '08:20', '09:10'], [2, '09:20', '10:10'], [3, '10:20', '11:10'], [4, '11:20', '12:10'],
  [5, '13:00', '13:50'], [6, '14:00', '14:50'], [7, '15:00', '15:50']]
  .map(([p, a, b]) => { const s = t => +t.slice(0, 2) * 3600 + +t.slice(3) * 60; return { p, start: s(a), end: s(b) }; });
const offDays = new Set();   // 학사일정상 휴업일·공휴일(YYYYMMDD)
const isOff = r => r.SBTR_DD_SC_NM === '휴업일' || r.SBTR_DD_SC_NM === '공휴일';
const fmtLeft = sec => { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); };
const pName = p => p === '조회' ? '조회' : p + '교시';
/* 실제 종소리가 시계보다 늦게 울리는 만큼(ms) 카운트다운을 늦춘다. 종이 타이머보다 빠르면 음수로 */
const BELL_LAG = 850;   // 0.5초 → 0.85초 (2026-10-22 학생 의견: 아직 조금 빠름)
const bellNow = () => new Date(now() - BELL_LAG);

// 다음 등교일(오늘 이후, 주말·휴업일 건너뜀) 1교시 시작까지 — 오늘 0시 기준 초 (하루 넘으면 86400 넘게)
function nextFirstBell(n) {
  let d = new Date(n.getFullYear(), n.getMonth(), n.getDate()), i = 0;
  do d = addDays(d, 1); while (!isSchoolDay(d) && ++i < 21);
  return diffDays(d, new Date(n.getFullYear(), n.getMonth(), n.getDate())) * 86400 + BELL.find(x => x.p === 1).start;
}
function bellInfo(n) {
  const dow = n.getDay();
  if (dow === 0 || dow === 6 || offDays.has(ymd(n))) return { state: '쉬는 날', label: '1교시 시작까지', cnt: '1교시 시작까지', target: nextFirstBell(n), away: true };
  // 마지막 교시: 오늘 시간표가 있으면 그대로 따름(요일 교체 수업 대응), 없으면 월~수 7 · 목금 6
  const ttMax = S.todayTT && S.todayTT.length ? Math.max(...S.todayTT.map(r => +r.PERIO || 0)) : 0;
  const last = ttMax >= 6 ? Math.min(7, ttMax) : dow <= 3 ? 7 : 6, list = BELL.filter(x => x.p === '조회' || x.p <= last);
  const now = (n - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 1000;
  for (let i = 0; i < list.length; i++) {
    const cur = list[i], prev = list[i - 1];
    if (now >= cur.end) continue;
    if (now >= cur.start) {   // 수업(또는 조회) 중
      if (cur.p === '조회') return { state: '조회 중', label: '1교시 시작까지', cnt: '수업 시간까지', target: list[1].start, from: cur.start };
      const next = list[i + 1];
      return { state: `${pName(cur.p)} 수업 중`, label: !next ? '수업 끝까지' : cur.p === 4 ? '점심시간까지' : '쉬는 시간까지', cnt: !next ? '수업 끝까지' : cur.p === 4 ? '점심시간까지' : '쉬는 시간까지', target: cur.end, from: cur.start };
    }
    // 등교 전(조회 전): 1교시 시작까지
    if (!prev) return { state: '등교 전', label: '1교시 시작까지', cnt: '1교시 시작까지', target: list[1].start, away: true };
    // 수업 전 쉬는 시간
    const state = prev.p === 4 ? '점심시간' : '쉬는 시간';
    return { state, label: `${pName(cur.p)} 시작까지`, cnt: '수업 시간까지', target: cur.start, from: prev ? prev.end : null, brk: !!prev };
  }
  return { state: '방과 후', label: '1교시 시작까지', cnt: '1교시 시작까지', target: nextFirstBell(n), away: true };   // 학교 끝나면 다음 1교시까지
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
let nextKey = '', tickTimer = 0, heroVisible = true, balVisible = true;
// 화면 밖으로 스크롤된 전광판·종 시간 타일은 애니메이션을 멈춘다 (스크롤 렉 방지)
const seen = new Set();   // 지금 화면에 보이는 첫 화면 구역(큰 시계 · 아래 상태 카드)
const offscreen = new IntersectionObserver(es => es.forEach(e => {
  e.target.classList.toggle('paused', !e.isIntersecting);
  if (e.target.classList.contains('ticker')) return;
  e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
  const was = heroVisible; heroVisible = seen.size > 0; if (heroVisible && !was) tickClock();
}));
document.querySelectorAll('.ticker, #bigclock').forEach(el => offscreen.observe(el));
const lastVal = new Map();
const setText = (sel, v) => { if (lastVal.get(sel) !== v) { lastVal.set(sel, v); $(sel).textContent = v; } };
const setHtml = (sel, v) => { if (lastVal.get(sel) !== v) { lastVal.set(sel, v); $(sel).innerHTML = v; } };
// 남은 10초: 화면 새로 그릴 때마다(약 60번/초) 1/100초까지 표시. 0이 되면 멈추고 1초 타이머가 이어받음
let msRaf = 0, msTarget = null;
function startMs(target) {
  msTarget = target;
  if (msRaf) return;
  const dg = t => [...t].map(ch => `<span class="${ch === '.' ? 'c' : 'n'}">${ch}</span>`).join('');
  const step = () => {
    const nb = bellNow(), sec = nb.getHours() * 3600 + nb.getMinutes() * 60 + nb.getSeconds() + nb.getMilliseconds() / 1000;
    const l = msTarget - sec;
    if (document.hidden || !heroVisible || l <= 0 || l > 10) { msRaf = 0; return; }
    setHtml('#bigTime', dg(l.toFixed(2)));
    msRaf = requestAnimationFrame(step);
  };
  msRaf = requestAnimationFrame(step);
}
function tickClock() {
  clearTimeout(tickTimer);
  if (document.hidden) return;   // 안 보일 땐 멈춤 (다시 보이면 visibilitychange에서 재시작)
  const n = now();
  const dow = n.getDay();
  setHtml('#todayLbl', `<span class="d-md"><b>${n.getMonth() + 1}</b>월 <b>${n.getDate()}</b>일</span><span class="d-dow${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}">${DOW[dow]}요일</span>`);

  const slot = mealSlot(n);
  if (slot !== S.mealSlot) { S.mealSlot = slot; S.mealManual = false; if (!S.sMealDay) S.heroPick = null; if (homeRows.length) paintHomeMeal(); }
  const nb = bellNow();   // 종 기준 시각(종소리 지연 반영)
  const b = bellInfo(nb), secNow = nb.getHours() * 3600 + nb.getMinutes() * 60 + nb.getSeconds();
  const left = b.target != null ? b.target - secNow : null;
  const pi = periodInfo(b);
  if (!S.ttPick && S.ttShown && cls && ymd(ttTarget(n)) !== S.ttShown) renderHomeTT();   // 마지막 교시 끝·자정에 홈 시간표 날짜 전환
  const key = `${b.state}|${pi.cur}|${pi.nxt}|${S.todayTT ? S.todayTT.length : '-'}`;
  if (key !== nextKey) {   // 교시가 바뀔 때만 다시 그림
    nextKey = key; renderNext(b, pi); renderTicker(b, pi);
    const live = S.ttShown === ymd(n);
    // 지금 교시 · (쉬는 시간이면) 다음 교시 · 끝난 교시 표시
    $$('#sTT li').forEach(li => { const p = +li.dataset.p; li.classList.toggle('now', live && p === pi.cur); li.classList.toggle('next', live && !pi.cur && p === pi.nxt); li.classList.toggle('done', live && p < pi.done && p !== pi.cur); });
  }
  if (!heroVisible) { tickTimer = setTimeout(tickClock, 1000 - bellNow().getMilliseconds() + 5); return; }   // 스크롤로 안 보이면 큰 시계는 안 그림
  setText('#greet', sayLine(b));
  setText('#bellState', b.state);
  setText('#bellLbl', b.cnt || b.label);
  const dg = t => [...t].map(ch => `<span class="${ch === ':' || ch === '.' ? 'c' : 'n'}">${ch}</span>`).join('');   // 글자 폭 고정(숫자가 바뀌어도 안 흔들림)
  const ap = n.getHours() < 12 ? '오전' : '오후', h12 = n.getHours() % 12 || 12;
  const hm = `${h12}:${pad(n.getMinutes())}`;
  // 큰 숫자 = 남은 시간, 아래 작은 칩 = 현재 시각 (수업 없는 때엔 큰 숫자가 현재 시각)
  if (!(left != null && left > 0 && left <= 10)) setHtml('#bigTime', left != null ? dg(fmtLeft(left)) : `<span class="ap">${ap}</span>` + dg(hm));
  $('#bigTime').classList.toggle('long', left != null && left >= 3600);     // 1시간 넘게 남으면(밤·주말) 글씨 작게
  $('#bigTime').classList.toggle('long2', left != null && left >= 36000);   // 10시간 넘으면(시가 두 자리) 더 작게
  if (left != null && left > 0 && left <= 10) startMs(b.target);   // 10초 이하: 1/100초까지
  setText('#bellCnt', `${ap} ${hm}`);
  $('#nowBox').hidden = left == null;
  const hero = $('#bigclock');
  hero.classList.toggle('soon', left != null && left <= 60);    // 1분: 숫자만 흔들림
  hero.classList.toggle('soon2', left != null && left <= 30);  // 30초: 더 크게
  hero.classList.toggle('soon3', left != null && left <= 10);  // 10초: 가장 크게 + 1/100초
  hero.classList.toggle('rest', /쉬는|점심/.test(b.state));
  const bar = b.from != null && left != null, prog = bar ? Math.min(1, (secNow - b.from) / (b.target - b.from)) : 0;
  $('#bellBarBox').hidden = !bar;
  if (bar) $('#bellBar').style.transform = `scaleX(${prog.toFixed(4)})`;
  setText('#bellPct', bar ? `${Math.floor(prog * 100)}% 지남` : b.state === '쉬는 날' ? '푹 쉬는 날' : b.state === '방과 후' ? '오늘 수업 끝' : b.target != null ? '곧 시작해요' : '오늘 수업 끝');
  tickTimer = setTimeout(tickClock, 1000 - bellNow().getMilliseconds() + 5);   // 초가 바뀌는 순간에 맞춰 갱신
}
// 다음 수업 카드 (첫 화면 오른쪽 작은 카드)
function renderNext(b, pi) {
  const box = $('#hNext'), rows = S.todayTT;
  if (!box) return;
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
// 전광판: 사이트 이름만 반복해서 꽉 채움 (화면 폭이 넓어도 빈틈 없게 넉넉히 반복)
const TK = { meal: '', up: '' };
function renderTicker() {
  const el = $('#ticker'); if (!el || el.dataset.done) return;
  const one = '<span>SVMHS GROUND</span><i>★</i>'.repeat(16);
  el.innerHTML = one + one;   // 두 번 이어 붙여서 끊김 없이 반복
  el.dataset.done = '1';
}
async function loadOffDays() {
  try {
    const rows = await loadUpcoming(), t = ymd(today());
    rows.filter(isOff).forEach(r => offDays.add(r.AA_YMD));
    // 오늘 학교 행사·시험이 있으면 시계 아래에 알림 (그런 날은 종 시간이 평소와 다를 수 있음)
    const ev = rows.filter(r => r.AA_YMD === t && !isOff(r)).map(r => r.EVENT_NM);
    if (ev.length) { const el = $('#todayNote'); el.textContent = `오늘 일정 · ${ev.slice(0, 2).join(', ')}${ev.length > 2 ? ' 외' : ''} — 종 시간이 평소와 다를 수 있어요`; el.hidden = false; }
  } catch {}
  nextKey = '';
  if (!S.ttPick && cls && S.ttShown && ymd(ttTarget()) !== S.ttShown) renderHomeTT();
}
function renderClassChip() {
  const el = $('#classChip');
  if (!el) return;
  el.hidden = !cls;
  if (cls) el.textContent = `${cls.g}학년 ${cls.c}반${cls.dep ? ' · ' + cls.dep : ''}`;
}

/* ===== 화면 이동 ===== */
const RENDER = { meal: renderMealView, tt: renderTTView, cal: renderCalView, dday: renderDdayView };
const SOC = { RENDER, go: (...a) => go(...a), onLeave: null };
function go(v) {
  let [base, ...rest] = String(v || '').split('/');   // 예: 'u/아이디', 'dm/아이디'
  if (!VIEWS.includes(base)) { base = 'home'; rest = []; v = 'home'; }
  const arg = decodeURIComponent(rest.join('/'));
  SOC.onLeave?.(base);
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + base));
  RENDER[base]?.(arg);
  window.scrollTo(0, 0);
  onScroll();
  if (location.hash !== '#' + v) history.replaceState(null, '', v === 'home' ? location.pathname : '#' + v);
}
// 오른쪽 목록 버튼: ☰ 누르면 서랍처럼 목록(프로필·설정·QR·신고)이 펼쳐지고 ✕로, 다시 누르면 닫히며 ☰로. 테마 버튼은 목록 옆에 따로
function menu(on) {
  const m = $('#hMenu'), b = $('#btnMenu');
  if (on === m.classList.contains('open')) return;
  m.classList.toggle('open', on);
  $('#hList').inert = !on;
  b.setAttribute('aria-expanded', on);
  b.setAttribute('aria-label', on ? '메뉴 닫기' : '메뉴 열기');
}
$('#btnMenu').onclick = () => menu(!$('#hMenu').classList.contains('open'));
// 항목을 누르면 닫힘 · 바깥을 누르거나 Esc면 닫힘
$('#hList').addEventListener('click', e => { if (e.target.closest('button')) menu(false); });
document.addEventListener('click', e => { if (!e.target.closest('#hMenu')) menu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#hMenu').classList.contains('open')) { menu(false); $('#btnMenu').focus(); } });
// 첫 화면에서 내려가거나 다른 화면이면 왼쪽 위 로고 대신 '처음으로' 버튼
function onScroll() { $('#hdr').classList.toggle('away', !$('#v-home').classList.contains('on') || scrollY > innerHeight * .5); }
addEventListener('scroll', onScroll, { passive: true });
$('#goDown').onclick = () => $('#apps').scrollIntoView({ behavior: 'smooth', block: 'start' });
// 바로가기 아이콘 → 위쪽 버튼과 같은 동작
const ACT = { share: '#btnShare', theme: '#btnTheme', info: '#btnInfo' };
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a && ACT[a.dataset.act]) $(ACT[a.dataset.act]).click(); });
document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });

/* ===== 급식 ===== */
// 메뉴 이름으로 이모지 고르기 (위에서부터 먼저 맞는 것)
const EMOJI = [[/우유|요구르트|요거트|주스|에이드|스무디|라떼/, '🥤'], [/김치|깍두기|겉절이|섞박지/, '🥬'], [/치킨|닭|윙|봉/, '🍗'],
  [/돈까스|돈가스|까스|가스|커틀릿|튀김|강정|탕수/, '🍤'], [/피자/, '🍕'], [/버거|햄버거/, '🍔'], [/떡볶이|떡/, '🍡'],
  [/파스타|스파게티|올리오|까르보|로제|봉골레|리조또|그라탕/, '🍝'], [/면|국수|우동|짜장|짬뽕|라면|쫄면|냉면/, '🍜'], [/카레|커리/, '🍛'], [/볶음밥|덮밥|비빔밥|주먹밥|김밥|밥/, '🍚'],
  [/국|탕|찌개|수프|스프/, '🍲'], [/생선|고등어|삼치|연어|가자미|동태|임연수|오징어|새우|쭈꾸미|주꾸미/, '🐟'],
  [/불고기|갈비|제육|고기|삼겹|목살|스테이크|보쌈|족발|함박|미트/, '🍖'], [/계란|달걀|에그|오믈렛|스크램블/, '🥚'],
  [/샐러드|무침|나물|겉절/, '🥗'], [/빵|파이|케이크|머핀|와플|토스트|도넛|츄러스|쿠키/, '🥐'],
  [/멜론|수박|사과|배|귤|오렌지|포도|딸기|바나나|파인애플|키위|과일|망고|복숭아/, '🍉'], [/아이스|빙수|젤리|푸딩/, '🍨']];
const dishEmoji = n => (EMOJI.find(([re]) => re.test(n)) || [, '🍽️'])[1];
// 식판 칸 나누기: 밥 → 왼쪽 아래, 국 → 오른쪽 아래, 메인 반찬 + 나머지 → 위 3칸
const isRice = n => /밥$/.test(n);
const isSoup = n => /(국|탕|찌개|수프|스프|개장)$/.test(n);
const isExtra = n => /타르트|케이크|쿠키|머핀|마카롱|브라우니|잼|시럽|소스/.test(n) || ['🥬', '🥤', '🥐', '🍉', '🍨'].includes(dishEmoji(n));   // 김치·음료·빵·과일·디저트는 메인 후보에서 뺌
function splitTray(all) {
  const drinks = all.filter(isDrink), list = all.filter(n => !isDrink(n));   // 우유·주스·에이드는 식판 옆에 따로
  let rice = list.find(isRice), soup = list.find(n => n !== rice && isSoup(n));
  const rest = list.filter(n => n !== rice && n !== soup);
  const mi = rest.findIndex(n => !isExtra(n));
  if (mi > 0) rest.unshift(rest.splice(mi, 1)[0]);   // 메인을 맨 앞으로
  if (!rice && rest.length > 3) rice = rest.pop();     // 밥·국이 없는 날은 남는 메뉴로 아래 칸 채움
  if (!soup && rest.length > 3) soup = rest.pop();
  // 위 칸: [왼쪽(메인), 가운데 위, 가운데 아래, 오른쪽] — 메인은 첫 칸에 혼자, 나머지는 남은 칸에 나눠 담기
  const top = [[], [], [], []], others = mi >= 0 ? rest.slice(1) : rest.slice();
  if (mi >= 0) top[0].push(rest[0]);
  // 위아래로 나뉜 가운데 칸은 하나씩만, 남는 메뉴는 넓은 오른쪽 칸에 모아 담음 (작은 칸에 두 개씩 넣으면 글자가 잘림)
  const slots = mi >= 0 ? [1, 2, 3] : [0, 1, 2, 3];
  others.forEach((n, i) => top[slots[Math.min(i, slots.length - 1)]].push(n));
  return { main: mi >= 0 ? rest[0] : (rest[0] || rice || ''), top, rice, soup, drinks, hasMain: mi >= 0 };
}
/* 급식 인기투표: 음식을 누르면 한 표 (끼니마다 한 표, 다시 누르면 취소) */
const voterId = (() => {
  let v = store.get('voter', '');
  if (!/^[a-z0-9]{20,40}$/.test(v)) {
    v = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
    store.set('voter', v);
  }
  return v;
})();
const VOTES = {};   // ymd → { enabled, today, meals }
async function loadVotes(d) {
  const k = ymd(d);
  try {
    const r = await fetch('/api/vote?ymd=' + k, { headers: { 'x-voter': voterId } });
    VOTES[k] = r.ok ? await r.json() : { enabled: false };
  } catch { VOTES[k] = VOTES[k] || { enabled: false }; }
  return VOTES[k];
}
const voteOf = (k, meal) => {
  const v = VOTES[k];
  if (!v || !v.enabled) return null;
  const m = (v.meals && v.meals[meal]) || { counts: {}, total: 0, mine: '' };
  const top = Math.max(0, ...Object.values(m.counts));
  return { ...m, top, open: v.today === k };
};
const voteMark = (name, v) => {
  if (!v) return '';
  const n = v.counts[name] || 0;
  if (!n) return '';   // 표 없는 메뉴는 숫자 숨김 (화면이 덜 복잡하게)
  return `<i class="vc${n && n === v.top ? ' best' : ''}">${n && n === v.top ? '👑 ' : '♥ '}${n}</i>`;
};
const dishAttr = (name, v) => v && v.open ? ` data-dish="${esc(name)}" role="button" tabindex="0" aria-label="${esc(name)}에 투표"` : '';
// 메뉴 이름: 6글자 이상이면 두 줄로. 재료·조리법 단어(고추장|조림…) 경계 중 가운데에 가장 가까운 곳에서 나눔
const CUT = /볶음밥|비빔밥|덮밥|샤브샤브|떡볶이|돈까스|불고기|겉절이|샐러드|스파게티|파스타|소시지|고추장|쇠고기|소고기|오징어|콩나물|시금치|에이드|볶음|무침|조림|구이|튀김|강정|나물|갈비|찌개|김치|간장|된장|돼지|돈육|버섯|계란|두부|어묵|감자|채소|야채|치즈|크림|스프|주스|우유|라떼|소스|만두|까스|미역|매콤|달콤|허니|양념|훈제|직화|석쇠|우동|국수|짬뽕|떡국|볼|전|찜|탕|국|밥|떡/g;
function nameLines(x) {
  const s = x.trim(), n = [...s].length;
  if (n < 6) return [s];
  const plus = s.indexOf('+'), par = s.indexOf('(');
  if (plus > 1 && plus < s.length - 2) return [s.slice(0, plus + 1), s.slice(plus + 1)];
  if (par > 1) return [s.slice(0, par), s.slice(par)];
  let best = -1;
  for (const m of s.matchAll(CUT)) for (const at of [m.index, m.index + m[0].length]) {
    if (at < 2 || s.length - at < 2) continue;
    if (best < 0 || Math.abs(at - s.length / 2) < Math.abs(best - s.length / 2)) best = at;
  }
  if (best < 0 || Math.abs(best - s.length / 2) > s.length * .3) best = Math.ceil(s.length / 2);
  return [s.slice(0, best), s.slice(best)];
}
const nm = x => {
  const ls = nameLines(x), w = Math.min(10, Math.max(...ls.map(l => [...l.replace(/\s/g, '')].length)));
  return { cls: ` c${w}`, html: ls.map(l => `<span class="ln">${esc(l)}</span>`).join('') };
};
// 칸마다 메뉴 이름에 맞는 음식 그림(food.js)을 깔고, 그 위에 이름표를 얹음
// 그림은 칸 크기를 잰 뒤 그 비율에 맞춰 넣음 (paintFood) — 칸이 길쭉하든 넓든 꽉 차게
// 실제 음식 이미지가 있는 메뉴는 이미지(칸에 꽉 차게, 이름표는 아래쪽), 없으면 그림. 이미지가 안 열리면 그림으로 바꿈
const fx = x => { const im = foodImg(x); return `<i class="fx${im ? ' fximg' : ''}" data-food="${esc(x)}"${im ? ` data-img="${im}"` : ''}></i>`; };
function paintFood(root) {
  root.querySelectorAll('.fx[data-img]').forEach(el => {
    if (el.firstChild) return;
    const img = new Image();
    img.alt = ''; img.decoding = 'async'; img.src = `/food/c/${el.dataset.img}.webp`;
    img.addEventListener('error', () => { delete el.dataset.img; el.classList.remove('fximg'); el.closest('.cell,.it')?.classList.remove('hasimg'); el.innerHTML = ''; paintFood(root); }, { once: true });
    el.appendChild(img);
    el.closest('.cell,.it')?.classList.add('hasimg');
  });
  root.querySelectorAll('.fx:not([data-img])').forEach(el => {
    const c = el.parentElement, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const ar = arBucket(w / h);
    if (el.dataset.ar !== String(ar)) { el.dataset.ar = ar; el.innerHTML = foodSvg(el.dataset.food, ar); }
  });
}
const foodRO = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => paintFood(e.target))) : null;
const setTray = (box, html) => { box.innerHTML = html; paintFood(box); if (foodRO) foodRO.observe(box); };
const cellHtml = (items, cls = '', v = null) => {
  if (!items.length) return `<div class="cell empty ${cls}"></div>`;
  if (items.length === 1) {
    const x = items[0], pick = v && v.mine === x ? ' picked' : '';
    const t = nm(x);
    return `<div class="cell ${cls}${v && v.open ? ' vote' : ''}${pick}"${dishAttr(x, v)}>${fx(x)}${voteMark(x, v)}<b class="lbl${t.cls}">${t.html}</b></div>`;
  }
  return `<div class="cell multi ${cls}">${items.map(x => `<span class="it${v && v.open ? ' vote' : ''}${v && v.mine === x ? ' picked' : ''}"${dishAttr(x, v)}>${fx(x)}<em class="lbl${nm(x).cls}">${nm(x).html}</em>${voteMark(x, v)}</span>`).join('')}</div>`;
};
// 음료: 식판 오른쪽에 따로 세워 둠 (우유팩·컵)
const drinksHtml = (list, v) => !list.length ? '' : `<div class="drinks" role="list" aria-label="음료">${list.map(x => `<div class="drink${v && v.open ? ' vote' : ''}${v && v.mine === x ? ' picked' : ''}" role="listitem"${dishAttr(x, v)}>${voteMark(x, v)}${drinkSvg(x)}<b class="lbl${nm(x).cls}">${nm(x).html}</b></div>`).join('')}</div>`;
const mealHtml = (r, d, mini = false) => {
  if (!r) return empty('급식 정보가 없어요');
  const t = splitTray(cleanDish(r.DDISH_NM)), v = d ? voteOf(ymd(d), r.MMEAL_SC_CODE) : null;
  const info = !v ? '' : mini
    ? `<p class="vnote">🗳️ ${v.open ? (v.mine ? `내 픽 <b>${esc(v.mine)}</b>` : '맛있는 메뉴 눌러서 투표') : '인기투표 결과'} · ${v.total}명</p>`
    : v.open
    ? `<p class="vnote">🗳️ ${v.mine ? `내 픽 <b>${esc(v.mine)}</b> · 다시 누르면 취소` : '제일 맛있는 메뉴를 눌러 투표!'} · ${v.total}명 참여</p>`
    : `<p class="vnote">🗳️ 인기투표 결과 · ${v.total}명 참여</p>`;
  const at = `data-meal="${r.MMEAL_SC_CODE}" data-ymd="${ymd(d || today())}"`;
  return `<div class="tray-set${mini ? ' sm' : ''}${t.drinks.length ? ' has-drink' : ''}" ${at}><div class="tray${mini ? ' mini' : ''}" role="list" aria-label="급식 식판" ${at}>`
    + cellHtml(t.top[0], '', v)
    + `<div class="mid">${cellHtml(t.top[1], 'half', v)}${cellHtml(t.top[2], 'half', v)}</div>`
    + cellHtml(t.top[3], '', v)
    + cellHtml(t.rice ? [t.rice] : [], 'big', v) + cellHtml(t.soup ? [t.soup] : [], 'big soup', v)
    + `</div>${drinksHtml(t.drinks, v)}</div>` + info + (r.CAL_INFO ? `<div class="kcal">🔥 ${esc(r.CAL_INFO)}</div>` : '');   // 홈 작은 식판도 아래 카드와 같게 칼로리 표시
};
let homeRows = [];
// 지금 보여 줄 끼니: 7시 50분까지 조식 → 5교시 시작(점심 끝)까지 중식 → 그 뒤로 석식
const MEAL_AT = { b: 7 * 3600 + 50 * 60, d: BELL.find(x => x.p === 5).start };
function mealSlot(n = now()) {
  const sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  return sec < MEAL_AT.b ? '1' : sec < MEAL_AT.d ? '2' : '3';
}
// 그 끼니가 없는 날(석식 없는 날 등)은 다음 끼니 → 중식 → 아무거나 순서로 대신 보여 줌
function pickMeal(rows, want) {
  return rows.find(r => r.MMEAL_SC_CODE === want) || rows.find(r => r.MMEAL_SC_CODE > want)
    || rows.find(r => r.MMEAL_SC_CODE === '2') || rows[rows.length - 1];
}
// 첫 화면 급식 카드: 기본은 오늘(끼니 자동), ‹ › 로 다른 날(S.sMealDay)을 넘겨 봄. 끼니 칩으로 조식·중식·석식 바꿔 보기(S.heroPick)
let heroRows = null, heroSeq = 0;
function paintHeroMeal() {
  const box = $('#sMeal'), lbl = $('#sMealLbl'), slots = $('#sMealSlots'), d = S.sMealDay, day = d || today();
  const rows = d ? heroRows : homeRows;
  lbl.textContent = `${ttLabel(day)} 급식`; markOff(lbl, !!d);
  if (!rows) { slots.innerHTML = ''; box.innerHTML = skel(2); return; }
  if (!rows.length) { slots.innerHTML = ''; box.innerHTML = empty((d ? S.heroFail : S.mealFail) ? '급식 정보를 불러오지 못했어요' : '급식이 없는 날이에요'); return; }
  const r = (S.heroPick && rows.find(x => x.MMEAL_SC_CODE === S.heroPick)) || pickMeal(rows, d ? '2' : S.mealSlot);
  slots.innerHTML = rows.map(x => `<button type="button" data-m="${x.MMEAL_SC_CODE}" class="${x === r ? 'on' : ''}" aria-pressed="${x === r}">${MEALS[x.MMEAL_SC_CODE]}</button>`).join('');
  setTray(box, mealHtml(r, day, true));
}
async function loadHeroDay() {
  const d = S.sMealDay, seq = ++heroSeq;
  heroRows = null; S.heroFail = false; paintHeroMeal();
  if (!d) return;
  try {
    const rows = await getMeals(d);
    if (seq !== heroSeq) return;
    heroRows = rows.filter(r => MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
  } catch { if (seq !== heroSeq) return; heroRows = []; S.heroFail = true; }
  paintHeroMeal();
}
$('#sMealSlots').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { e.stopPropagation(); S.heroPick = b.dataset.m; armReset(); paintHeroMeal(); } });
function paintHomeMeal() {
  if (!S.mealManual && homeRows.length) S.homeMeal = pickMeal(homeRows, S.mealSlot).MMEAL_SC_CODE;
  paintHeroMeal();
  const sel = S.homeMeal;
  $('#hMealTabs').innerHTML = homeRows.map(r => `<button data-m="${r.MMEAL_SC_CODE}" class="${r.MMEAL_SC_CODE === sel ? 'on' : ''}">${MEALS[r.MMEAL_SC_CODE]}</button>`).join('');
  setTray($('#hMeal'), mealHtml(homeRows.find(r => r.MMEAL_SC_CODE === sel), today()));
}
async function renderHomeMeal() {
  const box = $('#hMeal'), tabs = $('#hMealTabs');
  try {
    const [rows] = await Promise.all([getMeals(today()), loadVotes(today())]);
    homeRows = rows.filter(r => MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
    if (!homeRows.length) { tabs.innerHTML = ''; box.innerHTML = empty('오늘은 급식이 없어요'); paintHeroMeal(); return; }
    paintHomeMeal();
    const lunch = homeRows.find(r => r.MMEAL_SC_CODE === '2') || homeRows[0], ll = cleanDish(lunch.DDISH_NM);
    TK.meal = splitTray(ll).main; renderTicker();
  } catch { box.innerHTML = empty('급식 정보를 불러오지 못했어요'); S.mealFail = true; paintHeroMeal(); }
}
let voting = false;
async function castVote(el) {
  const tray = el.closest('.tray-set'); if (!tray || voting) return;
  const k = tray.dataset.ymd, meal = tray.dataset.meal, v = voteOf(k, meal);
  if (!v || !v.open) return;
  const dish = el.dataset.dish, next = v.mine === dish ? '' : dish;
  // 화면 먼저 바꾸고 서버에 저장
  const m = (VOTES[k].meals[meal] ||= { counts: {}, total: 0, mine: '' });
  if (m.mine) { m.counts[m.mine]--; m.total--; }
  if (next) { m.counts[next] = (m.counts[next] || 0) + 1; m.total++; }
  m.mine = next; repaintMeals();
  voting = true;
  try {
    const r = await fetch('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json', 'x-voter': voterId }, body: JSON.stringify({ ymd: k, meal, dish: next }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '투표하지 못했어요');
    VOTES[k] = j; toast(next ? `${next}에 한 표! 🗳️` : '투표를 취소했어요');
  } catch (e) { toast(e.message || '투표하지 못했어요'); await loadVotes(parseYmd(k)); }
  voting = false; repaintMeals();
}
function repaintMeals() {
  if (homeRows.length) paintHomeMeal();
  if (S.mealRows && ymd(S.mealDate) in VOTES) paintMealView();
}
const onVoteClick = e => { const el = e.target.closest('[data-dish]'); if (el) castVote(el); };
const onVoteKey = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-dish]')) { e.preventDefault(); castVote(e.target); } };
document.addEventListener('visibilitychange', async () => {   // 다른 친구들 표 반영
  if (document.hidden || !homeRows.length) return;
  await loadVotes(today()); repaintMeals();
});
['#hMeal', '#mCols', '#sMeal'].forEach(id => { $(id).addEventListener('click', onVoteClick); $(id).addEventListener('keydown', onVoteKey); });
$('#hMealTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.homeMeal = b.dataset.m; S.mealManual = true; paintHomeMeal(); } });
async function renderMealView() {
  const d = S.mealDate, cols = $('#mCols');
  $('#mLbl').textContent = fmtDay(d);
  S.mealRows = null;
  cols.innerHTML = Object.values(MEALS).map(n => `<div class="card k-meal"><h3>${n}</h3>${skel(4)}</div>`).join('');
  try {
    const [rows] = await Promise.all([getMeals(d), loadVotes(d)]);
    if (d !== S.mealDate) return;   // 그사이 날짜를 넘겼으면 버림
    S.mealRows = rows; paintMealView();
  } catch { cols.innerHTML = `<div class="card k-meal">${empty('급식 정보를 불러오지 못했어요')}</div>`; }
}
function paintMealView() {
  const d = S.mealDate, rows = S.mealRows || [];
  setTray($('#mCols'), Object.entries(MEALS).map(([c, n]) => `<div class="card k-meal"><h3>${n}</h3>${mealHtml(rows.find(r => r.MMEAL_SC_CODE === c), d)}</div>`).join(''));
}
$('#mPrev').onclick = () => { S.mealDate = addDays(S.mealDate, -1); renderMealView(); };
$('#mNext').onclick = () => { S.mealDate = addDays(S.mealDate, 1); renderMealView(); };

/* ===== 오늘의 밸런스 게임 (첫 화면 왼쪽) — 친구들 전체가 같은 질문에 투표 ===== */
let BAL = null, balBusy = false, balTimer = 0;
async function loadBalance() {
  try {
    const r = await fetch('/api/balance', { headers: { 'x-voter': voterId } });
    const j = r.ok ? await r.json() : null;
    BAL = j && j.enabled ? j : null;
  } catch {}
  paintBalance();
}
function paintBalance() {
  const box = $('#play');
  box.hidden = !BAL;
  if (!BAL) return;
  const { a, b, counts, mine } = BAL, total = counts.a + counts.b, show = !!mine;
  const pct = k => total ? Math.round(counts[k] / total * 100) : 0;
  setText('#plQ', BAL.q);
  setText('#plN', `${total}명 참여`);
  const opt = (k, name) => `<button class="pl-o pl-${k}${mine === k ? ' picked' : ''}${show ? ' shown' : ''}" data-pick="${k}" aria-pressed="${mine === k}">`
    + `<i class="pl-fill" aria-hidden="true"></i><span class="pl-t">${esc(name)}</span>${show ? `<b class="pl-p">${pct(k)}%</b>` : ''}</button>`;
  $('#plOpts').innerHTML = opt('a', a) + '<span class="pl-vs" aria-hidden="true">VS</span>' + opt('b', b);
  if (show) $$('#plOpts .pl-fill').forEach(el => { el.style.transform = `scaleX(${(pct(el.parentNode.dataset.pick) / 100).toFixed(3)})`; });
  const lead = counts.a === counts.b ? '' : counts.a > counts.b ? a : b;
  setText('#plNote', !show ? '골라야 결과가 보여요 · 익명 · 내일 새 질문'
    : `${lead ? `지금은 '${lead}' 우세` : '지금은 막상막하'} · 다시 누르면 취소`);
}
$('#plOpts').addEventListener('click', async e => {
  const el = e.target.closest('[data-pick]');
  if (!el || !BAL || balBusy) return;
  const k = el.dataset.pick, next = BAL.mine === k ? '' : k;
  if (BAL.mine) BAL.counts[BAL.mine]--;   // 화면 먼저 바꾸고 서버에 저장
  if (next) BAL.counts[next]++;
  BAL.mine = next; paintBalance();
  balBusy = true;
  try {
    const r = await fetch('/api/balance', { method: 'POST', headers: { 'content-type': 'application/json', 'x-voter': voterId }, body: JSON.stringify({ pick: next, ymd: BAL.ymd }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '투표하지 못했어요');
    BAL = j; paintBalance();
    if (next) toast('한 표 완료! 친구들은 뭘 골랐을까 👀');
  } catch (err) { toast(err.message || '투표하지 못했어요'); await loadBalance(); }
  balBusy = false;
});
// 다른 친구들 표 반영: 투표 카드가 보이는 동안 40초마다, 다시 돌아왔을 때 바로
new IntersectionObserver(es => { balVisible = es[0].isIntersecting; }).observe($('#play'));
function pollBalance() {
  clearTimeout(balTimer);
  balTimer = setTimeout(async () => { if (!document.hidden && balVisible && !balBusy) await loadBalance(); pollBalance(); }, 90000);   // 90초마다 (무료 요청 수 절약)
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && BAL) loadBalance(); });

/* ===== 시간표 ===== */
const subjName = s => String(s || '').replace(/^[\s*#·-]+/, '').trim();   // 나이스 원문의 '* 영상 CG작업' 같은 기호 제거
const needClass = empty('반을 설정하면 시간표가 보여요 · <button class="link" data-open-class>설정하기</button>');
// 홈 시간표에 보여 줄 날: 오늘 마지막 교시가 끝나면 다음 등교일, 다음 날 0시부터는 그날(=오늘)
const isSchoolDay = d => d.getDay() % 6 !== 0 && !offDays.has(ymd(d));
function ttTarget(n = now()) {
  let d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  const ttMax = S.todayTT && S.todayTT.length ? Math.max(...S.todayTT.map(r => +r.PERIO || 0)) : 0;
  const last = ttMax ? Math.min(7, ttMax) : d.getDay() <= 3 ? 7 : 6, end = BELL.find(x => x.p === last).end;
  if (!isSchoolDay(d) || sec >= end) { let i = 0; do d = addDays(d, 1); while (!isSchoolDay(d) && ++i < 21); }
  return d;
}
// 교시 시작 시각 (홈 시간표 오른쪽 작은 글씨)
const bellAt = p => { const b = BELL.find(x => x.p === +p); return b ? `<span class="tm">${String(b.start / 3600 | 0).padStart(2, '0')}:${String(b.start % 3600 / 60).padStart(2, '0')}</span>` : ''; };
const ttLabel = (d, base = today()) => { const k = diffDays(d, base); return k === 0 ? '오늘' : k === 1 ? '내일' : k === -1 ? '어제' : k > 1 && k < 7 ? DOW[d.getDay()] + '요일' : `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`; };
let ttSeq = 0;
async function renderHomeTT() {
  const box = $('#sTT'), d = today(), tgt = S.ttPick || ttTarget(), seq = ++ttSeq, isToday = ymd(tgt) === ymd(d);
  S.ttShown = ymd(tgt);
  renderHomeWeek();
  $('#sTTlbl').textContent = `${ttLabel(tgt)} 시간표`; markOff($('#sTTlbl'), !!S.ttPick);
  if (!cls) { S.todayTT = []; box.innerHTML = needClass; nextKey = ''; return; }
  try {
    const wk = d.getDay() % 6 ? await getTimetable(cls, mondayOf(d), addDays(mondayOf(d), 4)) : [];
    const pick = (rs, day) => rs.filter(r => r.ALL_TI_YMD === ymd(day)).sort((a, b) => a.PERIO - b.PERIO);
    const todayRows = pick(wk, d);
    const rows = isToday ? todayRows : ymd(mondayOf(tgt)) === ymd(mondayOf(d)) && wk.length ? pick(wk, tgt)
      : pick(await getTimetable(cls, mondayOf(tgt), addDays(mondayOf(tgt), 4)), tgt);
    if (seq !== ttSeq) return;
    S.todayTT = todayRows;
    const dep = (rows[0] || todayRows[0] || {}).DDDEP_NM;   // 학과 이름은 시간표 응답에서 알아냄
    if (dep && cls.dep !== dep) { cls.dep = dep; store.set('class', cls); renderClassChip(); }
    box.innerHTML = rows.length
      ? `<ul class="tt">${rows.map(r => `<li data-p="${esc(r.PERIO)}"><span class="p">${esc(r.PERIO)}</span>${bellAt(r.PERIO)}<span class="s">${esc(subjName(r.ITRT_CNTNT))}</span></li>`).join('')}</ul>` + (api.hasKey ? '' : '<p class="note">5교시까지만 표시돼요</p>')
      : empty(`${ttLabel(tgt)} 시간표 정보가 아직 없어요`);
  } catch { if (seq === ttSeq) { S.todayTT = []; box.innerHTML = empty('시간표를 불러오지 못했어요'); } }
  nextKey = '';   // 지금/끝난 교시 표시 다시 그리기
}
// 월~금 시간표 표 (홈 아래쪽 카드와 시간표 화면이 같이 씀)
const weekLbl = mon => { const fri = addDays(mon, 4); return `${mon.getMonth() + 1}/${mon.getDate()} ~ ${fri.getMonth() + 1}/${fri.getDate()}`; };
async function fillWeek(box, mon, stale) {
  if (!cls) { box.innerHTML = needClass; return; }
  box.innerHTML = skel(5);
  try {
    const rows = await getTimetable(cls, mon, addDays(mon, 4));
    if (stale()) return;
    if (!rows.length) { box.innerHTML = empty('이 주의 시간표 정보가 없어요'); return; }
    const days = [0, 1, 2, 3, 4].map(i => addDays(mon, i)), t = ymd(today());
    const maxP = Math.min(10, Math.max(6, ...rows.map(r => +r.PERIO || 0)));
    const map = {}; rows.forEach(r => { map[r.ALL_TI_YMD + '_' + r.PERIO] = subjName(r.ITRT_CNTNT); });
    const td = (d, p) => { const v = map[ymd(d) + '_' + p] || ''; return `<td class="${ymd(d) === t ? 'today' : ''}${v ? '' : ' e'}">${esc(v)}</td>`; };   // 수업 없는 칸(e)은 칠하지 않음
    let h = '<table class="week"><thead><tr><th></th>' + days.map(d => `<th class="${ymd(d) === t ? 'today' : ''}"><span class="wd-d">${d.getDate()}</span><span class="wd-w">${DOW[d.getDay()]}</span></th>`).join('') + '</tr></thead><tbody>';
    for (let p = 1; p <= maxP; p++) h += `<tr><td class="pn">${p}</td>${days.map(d => td(d, p)).join('')}</tr>`;
    box.innerHTML = h + '</tbody></table>';
  } catch { if (!stale()) box.innerHTML = empty('시간표를 불러오지 못했어요'); }
}
function renderHomeWeek() {
  const mon = S.homeWeek;
  $('#hwTitle').innerHTML = cls ? `<b class="hw-cls">${esc(cls.g)}학년 ${esc(cls.c)}반</b>시간표` : '시간표';
  $('#hwNote').textContent = cls && !api.hasKey ? '지금은 하루 5교시까지만 표시돼요. (인증키 등록 전)' : '';
  fillWeek($('#hWeek'), mon, () => mon !== S.homeWeek);
}
/* ===== 첫 화면 급식판·시간표: 가장자리 서랍 (700px 이상) ===== */
// 핀 = 꺼낸 그 자리에 고정(기기별 저장). 핀이 없으면 탭으로 꺼내고, 바깥을 누르면 들어감. 첫 화면 아래로 내려가면 잠시 접힘.
const SIDE = { meal: { el: $('.s-meal'), name: '급식판' }, tt: { el: $('.s-ttc'), name: '시간표' } };
const wideMQ = matchMedia('(min-width:700px)');
function paintSide(k) {
  const { el, name } = SIDE[k], open = el.classList.contains('open');
  const t = el.querySelector('.s-tab'); t.setAttribute('aria-expanded', String(open));
  t.setAttribute('aria-label', open ? `${name} 넣기` : `${name} 꺼내기`);
  const b = el.querySelector('.s-put'); b.dataset.tip = '옆으로 넣기'; b.setAttribute('aria-label', `${name} 옆으로 넣기`);
}
// 꺼낸 서랍은 '옆으로 넣기' 버튼(또는 포스트잇 탭)을 누를 때까지 그대로 둠. 상태는 기기에 기억(side_meal·side_tt: open/closed)
function setSide(k, open) {
  SIDE[k].el.classList.toggle('open', open);
  store.set('side_' + k, open ? 'open' : 'closed'); paintSide(k);
}
function openSide(k, on) { const el = SIDE[k].el; if (el.classList.contains('stow')) { el.classList.toggle('open', on); paintSide(k); } }
function applyDrawers() {
  const on = wideMQ.matches;
  $('#bigclock').classList.toggle('drawers', on);
  for (const k in SIDE) {
    const el = SIDE[k].el;
    el.classList.toggle('stow', on);
    if (!on) { el.classList.remove('open'); continue; }
    const v = store.get('side_' + k, innerWidth >= 1100 ? 'open' : 'closed');   // 처음엔 넓은 화면만 꺼내 둠 (예전 값 pin/free도 인식)
    el.classList.toggle('open', v === 'open' || v === 'pin');
    paintSide(k);
  }
}
// 사이트를 처음 켜면 넣어 둔 서랍도 1분 동안 꺼내 보여 주고 다시 넣음. 그사이 탭·넣기 버튼을 직접 누르면 자동으로 넣지 않음
let peekT = 0;
function peekSides() {
  if (!wideMQ.matches) return;
  const ks = Object.keys(SIDE).filter(k => !SIDE[k].el.classList.contains('open'));
  if (!ks.length) return;
  ks.forEach(k => openSide(k, true));
  peekT = setTimeout(() => { peekT = 0; ks.forEach(k => openSide(k, false)); }, 60e3);
}
const stopPeek = () => { clearTimeout(peekT); peekT = 0; };
for (const k in SIDE) {
  const el = SIDE[k].el;
  el.querySelector('.s-put').onclick = e => { e.stopPropagation(); stopPeek(); setSide(k, false); };
  el.querySelector('.s-tab').onclick = e => {
    e.stopPropagation(); stopPeek();
    if (document.documentElement.classList.contains('tuck')) { scrollTo({ top: 0, behavior: 'smooth' }); setSide(k, true); return; }
    setSide(k, !el.classList.contains('open'));
  };
}
wideMQ.addEventListener('change', applyDrawers); applyDrawers();
new IntersectionObserver(([e]) => document.documentElement.classList.toggle('tuck', !e.isIntersecting), { threshold: .6 }).observe($('#bigclock'));
/* ===== 첫 화면 카드에서 다른 날 넘겨 보기 (‹ ›) — 라벨을 누르면 오늘로, 3분 동안 안 만지면 자동으로 오늘로 ===== */
function markOff(el, off) { el.classList.toggle('off', off); if (off) { el.dataset.tip = '오늘로 돌아가기'; el.setAttribute('aria-label', el.textContent + ' · 눌러서 오늘로'); } else { delete el.dataset.tip; el.removeAttribute('aria-label'); } }
const stepSchool = (d, k) => { let x = d, i = 0; do x = addDays(x, k); while (!isSchoolDay(x) && ++i < 21); return x; };
let resetT = 0;
function armReset() {
  clearTimeout(resetT);
  resetT = setTimeout(() => { if (S.sMealDay || S.heroPick) homeSide('meal'); if (S.ttPick) homeSide('tt'); }, 180e3);
}
function homeSide(k) {
  if (k === 'meal') { S.sMealDay = null; S.heroPick = null; loadHeroDay(); } else { S.ttPick = null; renderHomeTT(); }
}
$$('[data-nav]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); stopPeek(); armReset();
  const k = +b.dataset.d;
  if (b.dataset.nav === 'meal') { const nd = stepSchool(S.sMealDay || today(), k); S.sMealDay = ymd(nd) === ymd(today()) ? null : nd; S.heroPick = null; loadHeroDay(); }
  else { const auto = ttTarget(), nd = stepSchool(S.ttPick || auto, k); S.ttPick = ymd(nd) === ymd(auto) ? null : nd; renderHomeTT(); }
}));
$$('[data-home]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (b.classList.contains('off')) homeSide(b.dataset.home); }));

/* ===== 주 고르기 팝업 — 'M/D ~ M/D' 라벨을 누르면 해 ‹ › · 12달 · 그 달의 주 목록으로 바로 이동 =====
   모달(.sheet는 overflow 스크롤) 안에서도 잘리지 않게 position:fixed로 라벨 아래에 띄움 */
function weekPick(sel, getMon, setMon) {
  const lbl = $(sel);
  const close = () => { $('#wPick')?.remove(); $$('[aria-expanded="true"][data-tip="달·해 골라 이동"]').forEach(b => b.setAttribute('aria-expanded', 'false')); };
  lbl.onclick = e => {
    e.stopPropagation();
    if ($('#wPick')) { const mine = $('#wPick').dataset.for === sel; close(); if (mine) return; }
    const t = today(), tw = weekOf(t), arrow = (k, d, l) => `<button type="button" data-y="${d}" aria-label="${l}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${k}"/></svg></button>`;
    const cur = () => getMon(), anchorOf = m => addDays(m, 2);   // 주의 '소속 달'은 수요일 기준
    let y = anchorOf(cur()).getFullYear(), mo = anchorOf(cur()).getMonth();
    const box = document.createElement('div');
    box.id = 'wPick'; box.className = 'mpick wpick'; box.dataset.for = sel;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '주 고르기');
    const weeks = () => {   // 그 달에 평일(월~금)이 하루라도 걸친 주
      const out = []; let m = mondayOf(new Date(y, mo, 1));
      while (m <= new Date(y, mo + 1, 0)) { if (addDays(m, 4).getMonth() === mo || m.getMonth() === mo) out.push(m); m = addDays(m, 7); }
      return out.filter(m => addDays(m, 4) >= new Date(y, mo, 1));
    };
    const paint = () => {
      const c = ymd(cur());
      box.innerHTML = `<div class="mp-y">${arrow('prev', -1, '이전 해')}<b>${y}년</b>${arrow('next', 1, '다음 해')}</div>
        <div class="mp-m">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-m="${i}" class="${i === mo ? 'on' : ''}${y === t.getFullYear() && i === t.getMonth() ? ' now' : ''}">${i + 1}월</button>`).join('')}</div>
        <div class="mp-w">${weeks().map(m => `<button type="button" data-w="${ymd(m)}" class="${ymd(m) === c ? 'on' : ''}${ymd(m) === ymd(tw) ? ' now' : ''}">${weekLbl(m)}${ymd(m) === ymd(tw) ? '<small>이번 주</small>' : ''}</button>`).join('')}</div>
        <button type="button" class="mp-today" data-today="1">이번 주로</button>`;
    };
    paint();
    box.onclick = ev => {
      ev.stopPropagation();
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.y) { y += +b.dataset.y; paint(); return; }
      if (b.dataset.m) {   // 달을 누르면 그 달 첫 주로 바로 이동, 팝업은 열어 두고 주 목록만 바꿈
        mo = +b.dataset.m; setMon(weekOf(new Date(y, mo, 1))); paint(); box.querySelector('.mp-w .on, .mp-w button')?.focus(); return;
      }
      setMon(b.dataset.today ? tw : parseYmd(b.dataset.w)); close(); lbl.focus();
    };
    document.body.append(box);
    const r = lbl.getBoundingClientRect(), w = box.offsetWidth, vw = document.documentElement.clientWidth;
    box.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8)) + 'px';
    box.style.top = (r.bottom + 10) + 'px';
    lbl.setAttribute('aria-expanded', 'true');
    box.querySelector('.mp-w .on, .mp-m .on').focus();
  };
  if (!weekPick.on) {   // 바깥 클릭·Esc·스크롤로 닫기 (Esc는 뒤의 모달보다 먼저 받음)
    weekPick.on = true;
    document.addEventListener('click', () => $('#wPick') && close());
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#wPick')) { const f = $($('#wPick').dataset.for); close(); f?.focus(); e.stopImmediatePropagation(); } }, true);
    window.addEventListener('resize', () => $('#wPick') && close());
    document.addEventListener('scroll', e => { if ($('#wPick') && !$('#wPick').contains(e.target)) close(); }, true);
  }
}
/* ===== 한 주 크게 보기 (첫 화면 카드 '전체' 버튼 → #mAll) — 아래로 내려가지 않고 바로 급식·시간표 한 주 ===== */
const ALL = { tab: 'meal', mon: null, seq: 0 };
const weekOf = d => mondayOf(addDays(d, d.getDay() === 6 ? 2 : d.getDay() === 0 ? 1 : 0));
function openAll(tab, day) { ALL.tab = tab; ALL.mon = weekOf(day); openModal('#mAll'); renderAll(); }
async function renderAll() {
  const mon = ALL.mon, box = $('#allBody'), seq = ++ALL.seq, w = diffDays(mon, weekOf(today())) / 7;
  $$('#mAll [data-all]').forEach(b => { const on = b.dataset.all === ALL.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $('#allLbl').innerHTML = `${weekLbl(mon)}<small>${w === 0 ? '이번 주' : w === 1 ? '다음 주' : w === -1 ? '지난주' : w > 0 ? w + '주 뒤' : -w + '주 전'}</small>`;
  if (ALL.tab === 'tt') {
    $('#allT').textContent = cls ? `${cls.g}학년 ${cls.c}반 시간표` : '시간표';
    box.className = 'all-body scrollx'; fillWeek(box, mon, () => seq !== ALL.seq); return;
  }
  $('#allT').textContent = '한 주 급식';
  box.className = 'all-body'; box.innerHTML = `<div class="mw">${skel(5)}</div>`;
  try {
    const rows = await getMealsRange(mon, addDays(mon, 4));
    if (seq !== ALL.seq) return;
    const t = ymd(today());
    box.innerHTML = '<div class="mw">' + [0, 1, 2, 3, 4].map(i => {
      const d = addDays(mon, i), k = ymd(d);
      const ms = rows.filter(r => r.MLSV_YMD === k && MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
      return `<section class="mw-d${k === t ? ' today' : ''}"><h4><b>${d.getMonth() + 1}/${d.getDate()}</b>${DOW[d.getDay()]}${k === t ? '<em>오늘</em>' : ''}</h4>`
        + (ms.length ? ms.map(r => `<div class="mw-m"><h5>${MEALS[r.MMEAL_SC_CODE]}${r.CAL_INFO ? `<span>${esc(r.CAL_INFO)}</span>` : ''}</h5><ul>${cleanDish(r.DDISH_NM).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') : '<p class="mw-no">급식 없음</p>')
        + '</section>';
    }).join('') + '</div>';
  } catch { if (seq === ALL.seq) box.innerHTML = empty('급식 정보를 불러오지 못했어요'); }
}
$$('#mAll [data-all]').forEach(b => b.onclick = () => { ALL.tab = b.dataset.all; renderAll(); });
$('#allPrev').onclick = () => { ALL.mon = addDays(ALL.mon, -7); renderAll(); };
$('#allNext').onclick = () => { ALL.mon = addDays(ALL.mon, 7); renderAll(); };
weekPick('#allLbl', () => ALL.mon, m => { ALL.mon = m; renderAll(); });
$('#goMeal').onclick = e => { e.stopPropagation(); openAll('meal', S.sMealDay || today()); };
$('#goWeek').onclick = e => { e.stopPropagation(); openAll('tt', S.ttPick || ttTarget()); };
async function renderTTView() {
  const mon = S.ttWeek;
  $('#tLbl').textContent = weekLbl(mon);
  $('#ttTitle').textContent = cls ? `${cls.g}학년 ${cls.c}반 시간표` : '주간 시간표';
  $('#ttNote').textContent = api.hasKey ? '' : '지금은 하루 5교시까지만 표시돼요. (인증키 등록 전)';
  fillWeek($('#tWeek'), mon, () => mon !== S.ttWeek);
}
$('#tPrev').onclick = () => { S.ttWeek = addDays(S.ttWeek, -7); renderTTView(); };
$('#tNext').onclick = () => { S.ttWeek = addDays(S.ttWeek, 7); renderTTView(); };
weekPick('#tLbl', () => S.ttWeek, m => { S.ttWeek = m; renderTTView(); });

/* ===== 학사일정 ===== */
const evHtml = rows => {
  const t = today();
  return `<ul class="ev">${rows.map(r => {
    const d = parseYmd(r.AA_YMD), off = isOff(r);
    const tag = off ? `<span class="tag off">${r.SBTR_DD_SC_NM === '공휴일' ? '공휴일' : '휴업'}</span>` : `<span class="tag">${ddayText(diffDays(d, t))}</span>`;
    return `<li class="${d < t ? 'past' : ''}"><div class="d"><b>${d.getDate()}</b><span>${d.getMonth() + 1}월 ${DOW[d.getDay()]}</span></div><div class="n">${esc(r.EVENT_NM)}</div>${tag}</li>`;
  }).join('')}</ul>`;
};
let upcoming = null;   // 앞으로 60일 일정 (홈 · D-day가 같이 씀)
const loadUpcoming = () => {
  if (!upcoming) upcoming = getSchedule(today(), addDays(today(), 60)).catch(e => { upcoming = null; throw e; });
  return upcoming;
};
// 학사일정: 달력(월간 그리드) + 아래 목록
const calHtml = (m, rows) => {
  const t = today(), y = m.getFullYear(), mo = m.getMonth(), last = new Date(y, mo + 1, 0).getDate(), first = new Date(y, mo, 1).getDay();
  const by = {};
  rows.forEach(r => (by[r.AA_YMD] = by[r.AA_YMD] || []).push(r));
  let h = DOW.map(d => `<div class="dh">${d}</div>`).join('');
  for (let i = 0; i < first; i++) h += '<div class="dy pad"></div>';
  for (let d = 1; d <= last; d++) {
    const dt = new Date(y, mo, d), k = ymd(dt), ev = by[k] || [], dow = dt.getDay();
    const cls = ['dy', dow === 0 ? 'sun' : dow === 6 ? 'sat' : '', ev.length ? 'has' : '', ev.some(isOff) ? 'off' : '', dt < t ? 'past' : '', k === ymd(t) ? 'today' : ''].filter(Boolean).join(' ');
    h += `<div class="${cls}" title="${ev.map(r => esc(r.EVENT_NM)).join(', ')}"><b class="n">${d}</b>${ev.slice(0, 2).map(r => `<span class="e${isOff(r) ? ' off' : ''}">${esc(r.EVENT_NM)}</span>`).join('')}${ev.length > 2 ? `<span class="e">+${ev.length - 2}</span>` : ''}</div>`;
  }
  return h;
};
async function renderCalView() {
  const m = S.calMonth, end = new Date(m.getFullYear(), m.getMonth() + 1, 0), box = $('#cList'), grid = $('#cGrid');
  $('#cLbl').textContent = `${m.getFullYear()}년 ${m.getMonth() + 1}월`;
  grid.innerHTML = calHtml(m, []);
  box.innerHTML = skel(4);
  try {
    const rows = await getSchedule(m, end);
    if (m !== S.calMonth) return;
    grid.innerHTML = calHtml(m, rows);
    box.innerHTML = rows.length ? evHtml(rows) : empty('이 달에는 일정이 없어요');
  } catch { box.innerHTML = empty('일정을 불러오지 못했어요'); }
}
$('#cPrev').onclick = () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() - 1, 1); renderCalView(); };
$('#cNext').onclick = () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + 1, 1); renderCalView(); };
// 'YYYY년 M월'을 누르면 해를 넘기며 달을 골라 바로 이동
function closeMonthPick() { $('#cPick')?.remove(); $('#cLbl').setAttribute('aria-expanded', 'false'); }
$('#cLbl').onclick = e => {
  e.stopPropagation();
  if ($('#cPick')) return closeMonthPick();
  const t = today(), arrow = (k, d, l) => `<button type="button" data-y="${d}" aria-label="${l}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${k}"/></svg></button>`;
  let y = S.calMonth.getFullYear();
  const box = document.createElement('div');
  box.id = 'cPick'; box.className = 'mpick'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '달 고르기');
  const paint = () => {
    box.innerHTML = `<div class="mp-y">${arrow('prev', -1, '이전 해')}<b>${y}년</b>${arrow('next', 1, '다음 해')}</div>
      <div class="mp-m">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-m="${i}" class="${y === S.calMonth.getFullYear() && i === S.calMonth.getMonth() ? 'on' : ''}${y === t.getFullYear() && i === t.getMonth() ? ' now' : ''}">${i + 1}월</button>`).join('')}</div>
      <button type="button" class="mp-today" data-today="1">이번 달로</button>`;
  };
  paint();
  box.onclick = ev => {
    ev.stopPropagation();
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.y) { y += +b.dataset.y; paint(); return; }
    S.calMonth = b.dataset.today ? new Date(t.getFullYear(), t.getMonth(), 1) : new Date(y, +b.dataset.m, 1);
    closeMonthPick(); renderCalView();
  };
  $('#cLbl').after(box); $('#cLbl').setAttribute('aria-expanded', 'true');
  box.querySelector('.on, .now, [data-m]').focus();
};
document.addEventListener('click', () => { if ($('#cPick')) closeMonthPick(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#cPick')) { closeMonthPick(); $('#cLbl').focus(); } });

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
    school = (await loadUpcoming()).map(r => ({ name: r.EVENT_NM, date: r.AA_YMD, off: isOff(r) }));
  } catch { fail = true; }
  const list = mine.concat(school).sort(byDate).slice(0, 10);
  if (!list.length) { box.innerHTML = empty(fail ? '일정을 불러오지 못했어요' : '60일 안에 예정된 일정이 없어요 · <button class="link" data-go="dday">D-day 추가</button>'); return; }
  { const f = list[0]; TK.up = `${f.name} ${ddayText(diffDays(parseYmd(f.date), t))}`; renderTicker(); }
  box.innerHTML = list.map((x, i) => {
    const d = parseYmd(x.date), n = diffDays(d, t);
    const tag = x.mine ? '<em class="tag me">내 D-day</em>' : x.off ? '<em class="tag off">쉬는 날</em>' : '';
    return `<div class="up${i === 0 ? ' first' : ''}${x.mine ? ' mine' : ''}"><b class="num">${ddayText(n)}</b><div class="txt"><p class="nm">${esc(x.name)}</p><span class="dt">${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})</span></div>${tag}</div>`;
  }).join('');
  fitUp();
}
// 다가오는 일정: 5개만 보이기 (첫 번째는 큰 카드, 나머지는 작은 줄)
function fitUp() {
  $$('.up', $('#hUp')).forEach((el, i) => { el.hidden = i >= 5; });
}
addEventListener('resize', fitUp);
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
// 창이 하나라도 열려 있으면 뒤 화면 스크롤을 잠금(html.modal-lock) — 창 안(.sheet)만 스크롤됨
const syncModalLock = () => document.documentElement.classList.toggle('modal-lock', !!document.querySelector('.modal.open'));
const openModal = SOC.openModal = id => { lastFocus = document.activeElement; const m = $(id); m.classList.add('open'); syncModalLock(); [...m.querySelectorAll('button, select')].find(el => !el.hidden)?.focus(); };
const closeModal = SOC.closeModal = m => { m.classList.remove('open'); syncModalLock(); lastFocus?.focus?.(); };
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
// 반 목록: 나이스 반 정보(학과 이름 포함)로 채우고, 못 받으면 1~BASE_CLASS반
const classOpts = list => list.map(x => `<option value="${esc(x.c)}">${esc(x.c)}반${x.dep ? ' · ' + esc(x.dep) : ''}</option>`).join('');
const baseClasses = () => Array.from({ length: BASE_CLASS }, (_, i) => ({ c: String(i + 1), dep: '' }));
async function fillClasses(g, keep) {
  const sel = $('#selC'), want = keep || sel.value;
  let list = baseClasses();
  try {   // 키가 없으면 5개만 오므로 기본 목록에 학과 이름만 합침
    const l = await getClasses(g), by = new Map(l.map(x => [x.c, x]));
    list = list.map(x => by.get(x.c) || x).concat(l.filter(x => +x.c > BASE_CLASS));
  } catch {}
  if ($('#selG').value !== String(g)) return;   // 그사이 학년을 바꿨으면 버림
  sel.innerHTML = classOpts(list);
  if (list.some(x => x.c === want)) sel.value = want;
}
$('#selC').innerHTML = classOpts(baseClasses());
$('#selG').addEventListener('change', () => fillClasses($('#selG').value));
function openClass() {
  if (cls) $('#selG').value = cls.g;
  fillClasses($('#selG').value, cls ? cls.c : '');
  openModal('#mClass');
}
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
$('#btnReport').onclick = () => { if (SOC.report) SOC.report(); else toast('잠시 후 다시 눌러 주세요'); };
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
  syncBarColor();
}
// 주소창 색 = 지금 배경색(스킨·밝기 반영)
function syncBarColor() { $('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#eaf5fd'; }

/* ===== 색깔·캐릭터 테마(스킨) — 밝음/어두움과 따로 조합. 색은 style.css 스킨 구간(tools/skins/gen.py가 생성) ===== */
const SKINS = {
  color: [['', '기본 파랑'], ['pink', '핑크'], ['mint', '민트'], ['purple', '라벤더'], ['peach', '피치'], ['lemon', '레몬'], ['mono', '모노']],
  char: [['cat', '고양이'], ['dog', '강아지'], ['bear', '곰돌이'], ['bunny', '토끼'], ['frog', '개구리'], ['chick', '병아리'],
    ['hamster', '햄찌'], ['penguin', '펭귄'], ['fox', '여우'], ['panda', '판다'], ['dino', '공룡'], ['ghost', '유령'], ['slime', '슬라임'], ['sheep', '양'], ['whale', '고래'], ['axolotl', '우파루파']],
};
function applySkin(k) {
  const h = document.documentElement;
  if (k) h.dataset.skin = k; else delete h.dataset.skin;
  syncBarColor();
  document.querySelectorAll('#mSkin .sk').forEach(b => b.setAttribute('aria-pressed', b.dataset.skin === k));
}
// 왼쪽 아래 캐릭터(#mascot): '내 캐릭터' 그림이 있으면 그 그림을 가만히, 없고 캐릭터 테마면 움직이는 마스코트(인라인 SVG, CSS 애니메이션).
// 마스코트 그림은 js/mascots.js(tools/skins/gen.py가 생성)를 캐릭터 테마일 때만 불러옴. hi=true면 고른 순간 깡충 인사 한 번.
const CHAR_SET = new Set(SKINS.char.map(c => c[0]));
let mascotMod = null;
async function syncMascot(hi) {
  const k = document.documentElement.dataset.skin || '', art = lsGet(MYART);
  let el = document.getElementById('mascot');
  const key = art ? 'mine:' + art.length + ':' + art.slice(-24) : CHAR_SET.has(k) ? k : '';
  if (!key) { if (el) el.remove(); return; }
  if (!art) {
    try { mascotMod = mascotMod || await import('./mascots.js'); } catch { return; }
    if ((document.documentElement.dataset.skin || '') !== k || lsGet(MYART)) return;  // 불러오는 사이 바뀜
  }
  if (!el) { el = document.createElement('div'); el.id = 'mascot'; el.className = 'mascot'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
  if (el.dataset.key !== key) {
    el.dataset.key = key; el.dataset.k = art ? '' : k;
    if (art) { const im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = art; el.replaceChildren(im); }
    else el.innerHTML = mascotMod.MASCOT[k] || '';
  }
  if (hi && !art) { el.classList.remove('m-hello'); void el.offsetWidth; el.classList.add('m-hello'); }  // .hi는 메뉴 항목 클래스라 쓰면 안 됨
}
document.addEventListener('animationend', e => { if (e.animationName === 'm-hi') e.target.closest('.mascot')?.classList.remove('m-hello'); });
// 다른 탭·앱을 보고 있을 땐 캐릭터 애니메이션 멈춤(배터리·CPU 절약)
const syncAway = () => document.documentElement.classList.toggle('away', document.hidden);
document.addEventListener('visibilitychange', syncAway); syncAway();
function skinBtns(list, face) {
  return list.map(([k, n]) => `<button class="sk sk-${k || 'base'}" type="button" data-skin="${k}" aria-pressed="false">`
    + (face ? '<i class="sk-face" aria-hidden="true"></i>' : '<i class="sk-sw" aria-hidden="true"><b></b><b></b><b></b></i>')
    + `<span>${n}</span></button>`).join('');
}
$('#skColors').innerHTML = skinBtns(SKINS.color, false);
$('#skChars').innerHTML = skinBtns(SKINS.char, true);
$('#mSkin').addEventListener('click', e => {
  const b = e.target.closest('.sk'); if (!b) return;
  const k = b.dataset.skin;
  const go = () => { applySkin(k); store.set('skin', k || null); syncMascot(true); };
  if (document.startViewTransition && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go();
});
$('#btnSkin').onclick = () => { applySkin(document.documentElement.dataset.skin || ''); myArtUi(); openModal('#mSkin'); };

// 내 캐릭터: 사용자가 고른 그림을 이 기기 안에서만 줄여(최대 320px) localStorage에 저장 → 왼쪽 아래 스티커(--art) + 옅은 배경 무늬(--pat)
// 서버로 올리지 않음. 첫 화면 적용은 theme.js. (CSP img-src에 data: 허용돼 있음)
const MYART = 'sg_myart', MYPAT = 'sg_mypat';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
function setMyArt(art, pat) {
  const rs = document.documentElement.style;
  if (art && pat) { rs.setProperty('--pat', `url("${pat}")`); rs.setProperty('--pat-size', '90px 90px'); }
  else { rs.removeProperty('--pat'); rs.removeProperty('--pat-size'); }
  syncMascot();
}
syncMascot();

function myArtUi() {
  const a = lsGet(MYART), f = $('#skMyFace');
  f.classList.toggle('on', !!a);
  if (a) f.style.setProperty('background-image', `url("${a}")`); else f.style.removeProperty('background-image');
  $('#skMyOff').hidden = !a; $('#skPatRow').hidden = !a;
  $('#skPat').checked = !a || !!lsGet(MYPAT);
}
function loadImg(file) {
  return new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); no(); }; im.src = u; });
}
function toUrl(c) { const w = c.toDataURL('image/webp', .85); return w.startsWith('data:image/webp') ? w : c.toDataURL('image/png'); }
function makeArt(im) {
  const k = Math.min(1, 320 / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return c;
}
function makePat(src) {
  // 90×90 칸에 작은 그림 두 개를 엇갈려 옅게(캐릭터 테마 무늬와 같은 배치)
  const c = document.createElement('canvas'); c.width = c.height = 90;
  const g = c.getContext('2d'), s = 30 / Math.max(src.width, src.height), w = src.width * s, h = src.height * s;
  g.globalAlpha = .13;
  g.drawImage(src, 6 + (30 - w) / 2, 6 + (30 - h) / 2, w, h);
  g.drawImage(src, 51 + (30 - w) / 2, 51 + (30 - h) / 2, w, h);
  return toUrl(c);
}
let myCanvas = null;
$('#skFile').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('그림 파일만 넣을 수 있어요'); return; }
  let im; try { im = await loadImg(file); } catch { toast('그림을 열 수 없어요'); return; }
  myCanvas = makeArt(im);
  const art = toUrl(myCanvas), pat = $('#skPat').checked ? makePat(myCanvas) : null;
  try { localStorage.setItem(MYART, art); if (pat) localStorage.setItem(MYPAT, pat); else localStorage.removeItem(MYPAT); }
  catch { toast('저장 공간이 부족해요 — 더 작은 그림으로 넣어 주세요'); return; }
  setMyArt(art, pat); myArtUi(); toast('내 캐릭터를 넣었어요');
};
$('#skMyOff').onclick = () => {
  try { localStorage.removeItem(MYART); localStorage.removeItem(MYPAT); } catch {}
  myCanvas = null; setMyArt(null, null); myArtUi();
};
$('#skPat').onchange = async () => {
  const a = lsGet(MYART); if (!a) return;
  let pat = null;
  if ($('#skPat').checked) {
    if (!myCanvas) { const im = new Image(); im.src = a; await im.decode().catch(() => {}); myCanvas = im; }
    pat = makePat(myCanvas);
  }
  try { if (pat) localStorage.setItem(MYPAT, pat); else localStorage.removeItem(MYPAT); } catch {}
  setMyArt(a, pat);
};
applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
let themeWant = null;   // 전환이 끝나기 전에 또 눌러도 바뀔 방향이 꼬이지 않게, 마지막으로 고른 테마를 기억
$('#btnTheme').onclick = () => {
  const t = (themeWant || document.documentElement.dataset.theme) === 'dark' ? 'light' : 'dark';
  themeWant = t;
  const h = document.documentElement; h.classList.add('tt'); clearTimeout(h._tt); h._tt = setTimeout(() => h.classList.remove('tt'), 600);
  const go = () => { applyTheme(t); store.set('theme', t); if (themeWant === t) themeWant = null; };
  // 화면 전체를 한 장으로 찍어 부드럽게 겹쳐 바꿈(View Transition, GPU) — 예전처럼 모든 요소의 색을 하나하나 애니메이션하면 태블릿에서 끊김.
  // 지원 안 하는 브라우저나 '동작 줄이기' 설정이면 바로 바꿈
  if (document.startViewTransition && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go();
};

/* ===== 관리자 공지 ===== */
async function loadNotice() {
  let n = null;
  try { const r = await fetch('/api/notice'); if (r.ok) n = (await r.json()).notice; } catch {}
  const box = $('#notice');
  if (!n || store.get('notice_x') === n.id) { box.hidden = true; return; }
  $('#noticeIc').textContent = { warn: '⚠️', fun: '🎉' }[n.tone] || '📢';
  box.className = 'notice ' + ({ warn: 'warn', fun: 'fun' }[n.tone] || '');
  const a = $('#noticeTx');
  a.textContent = n.text;
  a.onclick = null; a.classList.toggle('more', !!n.more && !n.link);
  if (n.link) { a.href = n.link; a.dataset.go = n.link.slice(1); a.removeAttribute('aria-disabled'); }
  else if (n.more) {   // 자세한 내용이 있으면 띠를 눌러 긴 공지로
    a.href = '#'; delete a.dataset.go;
    a.onclick = e => { e.preventDefault(); if (SOC.openNotices) SOC.openNotices(n.id); else toast('잠시 후 다시 눌러 주세요'); };
  } else { a.removeAttribute('href'); delete a.dataset.go; }
  $('#noticeX').onclick = () => { store.set('notice_x', n.id); box.hidden = true; };
  box.hidden = false;
}

/* ===== 소개 (로그인 전) ===== */
// theme.js가 첫 화면부터 html.prelogin을 붙여 둠 → 로그인 상태가 확인되면 social.js가 SOC.authed()로 알려 줌
const HTML = document.documentElement;
const introOn = () => HTML.classList.contains('prelogin');
// 홈 데이터(급식·시간표·일정·투표·공지)는 사이트가 실제로 보일 때 한 번만 불러옴 — 로그인 전 소개 화면에서는 안 받음(요청·그리기 절약)
let homeBooted = false, cfgReady = false;
function bootHome() {
  if (homeBooted || !cfgReady || introOn()) return;
  homeBooted = true;
  renderHomeMeal(); renderHomeTT(); renderHomeDday(); loadOffDays(); loadBalance().then(pollBalance); loadNotice();
  peekSides();
}
function intro(on) {
  HTML.classList.toggle('prelogin', on);
  $('#intro').inert = !on;
  if (on) $('#intro').scrollTop = 0;
  else { $('#introAuth').hidden = true; $('#introAuth').innerHTML = ''; onScroll(); bootHome(); }
}
// me: 로그인한 사람(없으면 null) · on: 소셜 기능이 켜져 있는지 · how: 'login' | 'signup' | undefined(처음 확인)
SOC.authed = (me, on = true, how) => {
  try { if (me) localStorage.setItem('sg_in', '1'); else localStorage.removeItem('sg_in'); } catch {}
  if (!on) return;                                   // 서버 확인 불가: 지금 상태 유지 (로그인 안 된 기기는 소개 화면 그대로)
  if (me) { if (introOn()) { intro(false); if (how === 'login' && !cls) setTimeout(openClass, 400); } }
  else intro(true);                                  // 로그인 안 했으면 사이트는 안 보이고 소개 화면만
};
$('#intro').inert = !introOn();
$('#intro').addEventListener('click', e => {
  const b = e.target.closest('[data-intro]'); if (!b) return;
  const k = b.dataset.intro;
  if (!SOC.authForm) { toast('잠시 후 다시 눌러 주세요'); return; }
  const box = $('#introAuth');
  box.innerHTML = SOC.authForm(k); box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => box.querySelector('input')?.focus({ preventScroll: true }), 350);
});

/* ===== 시작 ===== */
tickClock();
renderClassChip();
store.pruneCache();
// 서비스 워커: 와이파이가 끊겨도 마지막 화면·급식·시간표 보이기 (public/sw.js)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
// 날짜가 바뀐 채로 다시 열면(자정 넘김) 새로 고침
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (ymd(today()) !== startDay) location.reload(); else tickClock();
});
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
// 소셜 화면의 링크(#u/…, #dm/…)도 hashchange로 처리됨
SOC.getClass = () => cls;
const socReady = import('./social.js').then(m => m.init(SOC)).catch(() => { if (introOn()) toast('불러오지 못했어요. 새로 고침해 주세요'); });
loadConfig().finally(async () => {
  cfgReady = true; bootHome();
  const h = location.hash.slice(1);
  if (h && h !== 'home') { if (/^(me|u|dm|game)\b/.test(h)) await socReady; go(h); }
  if (!cls && !introOn()) setTimeout(openClass, 400);   // 소개 화면이면 닫힐 때 띄움
});
