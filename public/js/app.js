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

// 화면 전환 효과가 연달아 눌려 건너뛰어지면 Promise가 거절됨 → 무시 (콘솔 오류 방지)
const skipOk = vt => { vt.ready.catch(() => {}); vt.finished.catch(() => {}); };
// 그날 마지막 교시: 오늘 시간표가 있으면 그대로 따름(요일 교체·단축 수업 대응), 없으면 월~수 7 · 목금 6.
// 인증키가 없으면 나이스가 5교시까지만 주므로 6교시 이상일 때만 믿음. 종 시계와 홈 시간표가 같은 값을 씀
function lastPeriod(d) {
  const ttMax = S.todayTT && S.todayTT.length ? Math.max(...S.todayTT.map(r => +r.PERIO || 0)) : 0;
  return ttMax && (api.hasKey || ttMax >= 6) ? Math.min(7, ttMax) : d.getDay() <= 3 ? 7 : 6;
}
// 다음 등교일(오늘 이후, 주말·휴업일 건너뜀) 1교시 시작까지 — 오늘 0시 기준 초 (하루 넘으면 86400 넘게)
function nextFirstBell(n) {
  let d = new Date(n.getFullYear(), n.getMonth(), n.getDate()), i = 0;
  do d = addDays(d, 1); while (!isSchoolDay(d) && ++i < 21);
  return diffDays(d, new Date(n.getFullYear(), n.getMonth(), n.getDate())) * 86400 + BELL.find(x => x.p === 1).start;
}
function bellInfo(n) {
  const dow = n.getDay();
  if (dow === 0 || dow === 6 || offDays.has(ymd(n))) return { state: '쉬는 날', label: '1교시 시작까지', cnt: '1교시 시작까지', target: nextFirstBell(n), away: true };
  const last = lastPeriod(n), list = BELL.filter(x => x.p === '조회' || x.p <= last);
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
  if (ymd(n) !== S.dayKey) {   // 자정이 지나면 '오늘' 기준 카드(시간표 표·급식·일정)를 새 날짜로 다시 그림
    const first = !S.dayKey; S.dayKey = ymd(n);
    if (!first) { const d = today(); S.homeWeek = mondayOf(addDays(d, d.getDay() === 6 ? 2 : d.getDay() === 0 ? 1 : 0)); S.mealManual = false; renderHomeTT(); renderHomeMeal(); renderHomeDday(); }
  } else if (!S.ttPick && S.ttShown && cls && ymd(ttTarget(n)) !== S.ttShown) renderHomeTT();   // 마지막 교시 끝에 홈 시간표 날짜 전환
  const key = `${b.state}|${pi.cur}|${pi.nxt}|${S.todayTT ? S.todayTT.length : '-'}`;
  if (key !== nextKey) {   // 교시가 바뀔 때만 다시 그림
    nextKey = key; renderNext(b, pi); renderTicker(b, pi);
    const live = S.ttShown === ymd(n);
    // 지금 교시 · (쉬는 시간이면) 다음 교시 · 끝난 교시 표시
    markWeek(n.getDay() % 6 && isSchoolDay(n) ? pi : null);
    $$('#sTT li').forEach(li => { const p = +li.dataset.p; li.classList.toggle('now', live && p === pi.cur); li.classList.toggle('next', live && !pi.cur && p === pi.nxt); li.classList.toggle('done', live && p < pi.done && p !== pi.cur); });
  }
  weekProg(secNow);
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
  const isRest = /쉬는|점심/.test(b.state);
  hero.classList.toggle('rest', isRest);
  if (isRest && S.wasRest === false) { hero.classList.add('yay'); clearTimeout(S.yayT); S.yayT = setTimeout(() => hero.classList.remove('yay'), 4000); }   // 쉬는 시간이 막 시작: 4초만 초록 두근두근 후 차분하게
  S.wasRest = isRest;
  hero.classList.toggle('go', / 수업 중$/.test(b.state) && left != null && left > 0 && left <= 60);   // 수업 마지막 1분: 초록 두근두근
  const bar = b.from != null && left != null, prog = bar ? Math.min(1, (secNow - b.from) / (b.target - b.from)) : 0;
  $('#bellBarBox').hidden = !bar;
  const restBar = /쉬는|점심/.test(b.state);   // 쉬는 시간: 100%에서 줄어듦(남은 %), 수업: 0%에서 늘어남(지난 %)
  if (bar) $('#bellBar').style.transform = `scaleX(${(restBar ? 1 - prog : prog).toFixed(4)})`;
  const restPct = Math.ceil((1 - prog) * 100);   // 배터리처럼: 40% 이하 노랑, 20% 이하 빨강
  $('#bellBarBox').classList.toggle('low', bar && restBar && restPct <= 40 && restPct > 20);
  $('#bellBarBox').classList.toggle('crit', bar && restBar && restPct <= 20);
  setText('#bellPct', bar ? (restBar ? `${Math.ceil((1 - prog) * 100)}% 남음` : `${Math.floor(prog * 100)}% 지남`) : b.state === '쉬는 날' ? '푹 쉬는 날' : b.state === '방과 후' ? '오늘 수업 끝' : b.target != null ? '곧 시작해요' : '오늘 수업 끝');
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
  if (base !== 'home') $('#v-home').classList.remove('calm');   // 다른 화면 갔다 오면 홈도 평소처럼 페이드
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
$('#goDown').onclick = () => $('#board').scrollIntoView({ behavior: 'smooth', block: 'start' });
$('#svcFab').onclick = () => $('#apps').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
// 메인 반찬 고르기: 학생들이 좋아할 만한 순서로 점수 (0 = 메인 후보 아님). 같은 점수면 원래 순서가 앞선 것
const isKimchi = n => dishEmoji(n) === '🥬';
const isSeaweed = n => /김$/.test(n) && !isKimchi(n);   // 구이김·조미김
function mainScore(n) {
  if (isExtra(n) || isSeaweed(n)) return 0;
  if (/나물|무침|샐러드|겉절|장아찌|피클|단무지/.test(n)) return 1;
  if (/돈까스|돈가스|까스|커틀릿|치킨|강정|탕수|떡볶이|피자|버거|스팸|햄|소시지|비엔나|너겟|핫도그|스테이크|함박|미트볼|불고기|갈비|제육|삼겹|목살|보쌈|족발|닭|오리|튀김|짜장|카레|파스타|스파게티|그라탕|훈제/.test(n)) return 3;
  if (/고기|돈육|돼지|소고기|쇠고기|생선|고등어|삼치|연어|오징어|새우|쭈꾸미|주꾸미|어묵|만두|떡|계란|달걀|두부|전$|볶음|구이|조림|찜/.test(n)) return 2;
  return 1;
}
const pickMain = arr => arr.reduce((bi, n, i) => { const sc = mainScore(n); return sc > 0 && (bi < 0 || sc > mainScore(arr[bi])) ? i : bi; }, -1);
// 홈 목록 순서: 메인 반찬(노란 칸) → 나머지 반찬(맛있는 순) → 국 → 김치 → 밥 → 디저트 → 음료
function orderMenu(all) {
  const drinks = all.filter(isDrink), list = all.filter(n => !isDrink(n));
  const rice = list.filter(isRice), kimchi = list.filter(n => !rice.includes(n) && isKimchi(n));
  const soup = list.filter(n => !rice.includes(n) && !kimchi.includes(n) && isSoup(n));
  const used = new Set([...rice, ...kimchi, ...soup]);
  let rest = list.filter(n => !used.has(n));
  const mi = pickMain(rest), main = mi >= 0 ? [rest[mi]] : [];
  if (mi >= 0) rest = rest.filter((_, i) => i !== mi);
  const sides = rest.filter(n => !isExtra(n)).map((n, i) => [n, i]).sort((a, b) => mainScore(b[0]) - mainScore(a[0]) || a[1] - b[1]).map(([n]) => n);   // 맛있는(점수 높은) 반찬부터
  const dessert = rest.filter(isExtra);
  return { list: [...main, ...sides, ...soup, ...kimchi, ...rice, ...dessert, ...drinks], hasMain: mi >= 0 };
}
function splitTray(all) {
  const drinks = all.filter(isDrink), list = all.filter(n => !isDrink(n));   // 우유·주스·에이드는 식판 옆에 따로
  let rice = list.find(isRice), soup = list.find(n => n !== rice && isSoup(n));
  const rest = list.filter(n => n !== rice && n !== soup);
  const mi = pickMain(rest);
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
// 홈 '오늘 급식' 카드: 큰 식판 대신 작은 그림 + 이름 목록 (식판은 첫 화면 서랍·급식 화면에 있음). 누르면 투표(식판과 같은 data-dish)
const mealListHtml = (r, d) => {
  if (!r) return empty('급식 정보가 없어요');
  const om = orderMenu(cleanDish(r.DDISH_NM)), all = om.list, v = voteOf(ymd(d), r.MMEAL_SC_CODE);
  const at = `data-meal="${r.MMEAL_SC_CODE}" data-ymd="${ymd(d)}"`;
  const info = !v ? '' : `<p class="vnote">🗳️ ${v.open ? (v.mine ? `내 픽 <b>${esc(v.mine)}</b>` : '맛있는 메뉴 눌러서 투표') : '인기투표 결과'} · ${v.total}명</p>`;
  return `<div class="tray-set mlist" ${at}><ul class="ml${om.hasMain ? '' : ' nomain'}" role="list" aria-label="급식 메뉴">${all.map(x => `<li class="${v && v.open ? 'vote' : ''}${v && v.mine === x ? ' picked' : ''}"${dishAttr(x, v)}><span class="mth">${isDrink(x) ? drinkSvg(x) : fx(x)}</span><span class="mn">${esc(x)}</span>${voteMark(x, v)}</li>`).join('')}</ul></div>`
    + `<div class="mfoot">${info}${r.CAL_INFO ? `<span class="kcal">🔥 ${esc(r.CAL_INFO)}</span>` : ''}</div>`;
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
  if (S.mealWk) { paintHeroWeek(); return; }
  const rows = d ? heroRows : homeRows;
  setLbl(lbl, `${ttLabel(day)} 급식`, !!d, false);   // 하루 보기로 돌아올 때 한 주 카드 폭(.wk)도 같이 풂 (2026-10-23: 식판이 한 주 폭으로 커져 시계를 가리던 문제)
  if (!rows) { slots.innerHTML = ''; box.innerHTML = skel(2); return; }
  if (!rows.length) { slots.innerHTML = ''; box.innerHTML = empty((d ? S.heroFail : S.mealFail) ? '급식 정보를 불러오지 못했어요' : '급식이 없는 날이에요'); return; }
  const r = (S.heroPick && rows.find(x => x.MMEAL_SC_CODE === S.heroPick)) || pickMeal(rows, d ? '2' : S.mealSlot);
  slots.innerHTML = rows.map(x => `<button type="button" data-m="${x.MMEAL_SC_CODE}" class="${x === r ? 'on' : ''}" aria-pressed="${x === r}">${MEALS[x.MMEAL_SC_CODE]}</button>`).join('');
  setTray(box, mealHtml(r, day, true));
}
async function loadHeroDay() {
  const d = S.sMealDay, seq = ++heroSeq;
  heroRows = null; S.heroFail = false; paintHeroMeal();
  if (S.mealWk) {
    const mon = S.mealWk;
    try {
      const rows = await getMealsRange(mon, addDays(mon, 4));
      if (seq !== heroSeq) return;
      heroRows = rows.filter(r => MEALS[r.MMEAL_SC_CODE]);
    } catch { if (seq !== heroSeq) return; heroRows = []; S.heroFail = true; }
    paintHeroMeal(); return;
  }
  if (!d) return;
  try {
    const rows = await getMeals(d);
    if (seq !== heroSeq) return;
    heroRows = rows.filter(r => MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
  } catch { if (seq !== heroSeq) return; heroRows = []; S.heroFail = true; }
  paintHeroMeal();
}
// 한 주 모드: 월~금 다섯 줄(날짜 + 그 끼니 메뉴, 메인 반찬 먼저). 끼니 칩은 한 주 전체에 적용
const wkName = (mon, what) => { const w = diffDays(mon, weekOf(today())) / 7; return `${w === 0 ? '이번 주' : w === 1 ? '다음 주' : w === -1 ? '지난주' : `${mon.getMonth() + 1}/${mon.getDate()} 주`} ${what}`; };
function paintHeroWeek() {
  const box = $('#sMeal'), slots = $('#sMealSlots'), mon = S.mealWk, rows = heroRows;
  setLbl($('#sMealLbl'), wkName(mon, '급식'), ymd(mon) !== ymd(weekOf(today())), true);
  if (!rows) { slots.innerHTML = ''; box.innerHTML = skel(4); wkResize(); return; }
  if (!rows.length) { slots.innerHTML = ''; box.innerHTML = empty(S.heroFail ? '급식 정보를 불러오지 못했어요' : '이 주는 급식이 없어요'); wkResize(); return; }
  const codes = [...new Set(rows.map(r => r.MMEAL_SC_CODE))].sort();
  const want = S.heroPick && codes.includes(S.heroPick) ? S.heroPick : codes.includes('2') ? '2' : codes[0];
  slots.innerHTML = codes.map(c => `<button type="button" data-m="${c}" class="${c === want ? 'on' : ''}" aria-pressed="${c === want}">${MEALS[c]}</button>`).join('');
  const t = ymd(today());
  box.innerHTML = '<ul class="wkm">' + [0, 1, 2, 3, 4].map(i => {
    const d = addDays(mon, i), k = ymd(d), r = rows.find(x => x.MLSV_YMD === k && x.MMEAL_SC_CODE === want);
    const om = r && orderMenu(cleanDish(r.DDISH_NM));
    return `<li class="${k === t ? 'today' : k < t ? 'past' : ''}"><span class="wd"><b>${d.getDate()}</b>${DOW[d.getDay()]}</span>`
      + (om ? `<span class="ds">${om.list.map((x, j) => `<i${j === 0 && om.hasMain ? ' class="wkhl"' : ''}>${esc(x)}</i>`).join('')}</span>` : '<span class="ds no">급식 없음</span>') + '</li>';
  }).join('') + '</ul>';
  wkResize();
}
$('#sMealSlots').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { e.stopPropagation(); S.heroPick = b.dataset.m; armReset(); paintHeroMeal(); } });
function paintHomeMeal() {
  if (!S.mealManual && homeRows.length) S.homeMeal = pickMeal(homeRows, S.mealSlot).MMEAL_SC_CODE;
  paintHeroMeal();
  const sel = S.homeMeal;
  $('#hMealTabs').innerHTML = homeRows.map(r => `<button data-m="${r.MMEAL_SC_CODE}" class="${r.MMEAL_SC_CODE === sel ? 'on' : ''}">${MEALS[r.MMEAL_SC_CODE]}</button>`).join('');
  setTray($('#hMeal'), mealListHtml(homeRows.find(r => r.MMEAL_SC_CODE === sel), today()));
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

/* ===== 오늘의 밸런스 게임 (시계 아래 티켓 + 크게 보기 #mBal) =====
   월~금 하루 한 문제 · 6시 공개 · 마지막 교시 끝 +10분 마감 (서버 lib/balance.js가 시각을 정함, 로그인 계정당 한 표)
   진행 중엔 골라야 결과·댓글이 보이고, 마감 뒤엔 모두에게 결과 공개 + 이긴 쪽 강조 */
let BAL = null, balBusy = false, balTimer = 0, balSkew = 0, balAuto = 0;
const balNow = () => Date.now() + balSkew;
const BAL_API = '/api/s/bal';
async function balCall(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || '잠시 후 다시 해 주세요'); e.status = r.status; throw e; }
  return j;
}
function setBal(j) {
  BAL = j && j.enabled ? j : null;
  if (BAL) balSkew = BAL.now - Date.now();
  paintBalance();
}
async function loadBalance() {
  try { setBal(await balCall(BAL_API)); } catch (e) { if (e.status === 401 || e.status === 404) setBal(null); }
}
const hhmm = t => { const d = new Date(t), h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`; };
const balDow = t => { const d = new Date(t), k = diffDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), today()); return k === 0 ? '오늘' : k === 1 ? '내일' : DOW[d.getDay()] + '요일'; };
function balStatus() {
  const n = balNow();
  if (BAL.open) {
    const left = Math.max(0, Math.round((BAL.closes - n) / 1000));
    return { cls: left <= 600 ? 'hot' : 'live', txt: `⏳ 마감까지 ${fmtLeft(left)}`, long: `${hhmm(BAL.closes)} 마감 · ${fmtLeft(left)} 남음` };
  }
  if (n < BAL.opens) return { cls: 'wait', txt: `🌅 ${hhmm(BAL.opens)} 시작`, long: `${hhmm(BAL.opens)}부터 투표 시작` };
  const w = balWinner(BAL.counts);
  return { cls: 'done', txt: w === 'tie' ? '🤝 무승부!' : w ? `🏆 '${BAL[w]}' 승리` : '🏁 투표 마감', long: `투표 마감 · 다음 질문은 ${balDow(BAL.next)} ${hhmm(BAL.next)}` };
}
// 결과: 'a' | 'b' | 'tie' | '' (투표 없음)
const balWinner = c => !(c.a + c.b) ? '' : c.a === c.b ? 'tie' : c.a > c.b ? 'a' : 'b';
function balOpt(k, big) {
  const { counts, mine, open } = BAL, total = counts.a + counts.b, show = !!mine || !open, closed = !open;
  const pct = total ? Math.round(counts[k] / total * 100) : 0, w = closed ? balWinner(counts) : '';
  const cls = ['bo', 'bo-' + k, mine === k && 'picked', show && 'shown', w === k && 'win', w && w !== k && w !== 'tie' && 'lose', w === 'tie' && 'tie'].filter(Boolean).join(' ');
  return `<button class="${cls}" type="button" data-pick="${k}" aria-pressed="${mine === k}"${closed ? ' aria-disabled="true"' : ''}>`
    + `<i class="bo-fill" aria-hidden="true" data-pct="${show ? pct : 0}"></i>${w === k ? '<i class="bo-crown" aria-hidden="true">👑</i>' : ''}`
    + `<span class="bo-t">${esc(BAL[k])}</span>${mine === k ? '<i class="bo-ck" aria-hidden="true">✔</i>' : ''}${w === k ? '<span class="bo-stamp">WIN</span>' : ''}${show ? `<b class="bo-p">${pct}%${big ? `<small>${counts[k]}표</small>` : ''}</b>` : ''}</button>`;
}
const fillBars = root => root.querySelectorAll('.bo-fill').forEach(el => { el.style.transform = `scaleX(${(+el.dataset.pct / 100).toFixed(3)})`; });
function paintBalance() {
  const box = $('#play');
  box.hidden = !BAL;
  if (!BAL) { clearInterval(balAuto); return; }
  const st = balStatus();
  box.className = 'bal-t st-' + st.cls;
  $('#plQ').textContent = BAL.q;
  $('#plSt').textContent = st.txt;
  $('#plC').textContent = BAL.ncom;
  $('#plComN').textContent = BAL.ncom;
  $('#plComT').textContent = BAL.open && !BAL.mine ? '한쪽 고르고 댓글 달기' : BAL.ncom ? '댓글 보고 한마디 남기기' : '첫 댓글 남기기';
  $('#plOpts').innerHTML = balOpt('a') + '<span class="bo-vs" aria-hidden="true">VS</span>' + balOpt('b');
  fillBars($('#plOpts'));
  if ($('#mBal').classList.contains('open')) paintBalSheet();
  clearInterval(balAuto);
  balAuto = setInterval(balTick, 1000);
}
// 1초마다 남은 시간만 바꾸고, 마감·시작 시각이 지나면 서버에서 다시 받아옴
function balTick() {
  if (!BAL || document.hidden) return;
  const n = balNow();
  if ((BAL.open && n >= BAL.closes) || (!BAL.open && n >= BAL.opens && n < BAL.closes) || (!BAL.open && n >= BAL.next)) { clearInterval(balAuto); setTimeout(loadBalance, 1500); return; }
  const st = balStatus();
  setText('#plSt', st.txt);
  if ($('#mBal').classList.contains('open')) setText('#bsSt', st.long);
  $('#play').classList.toggle('st-hot', st.cls === 'hot');
}
function paintBalSheet() {
  const st = balStatus(), { counts, open, mine } = BAL, total = counts.a + counts.b, w = !open ? balWinner(counts) : '';
  $('#mBal .bal-sheet').className = 'sheet bal-sheet st-' + st.cls;
  $('#balT').textContent = BAL.q;
  lastVal.delete('#bsSt'); setText('#bsSt', st.long);
  $('#bsOpts').innerHTML = balOpt('a', true) + '<span class="bo-vs" aria-hidden="true">VS</span>' + balOpt('b', true);
  fillBars($('#bsOpts'));
  $('#bsN').innerHTML = !open
    ? (w === 'tie' ? `🤝 <b>무승부!</b> ${total}명이 정확히 반반으로 갈렸어요` : w ? `🎉 <b>'${esc(BAL[w])}'</b> 승리! · ${total}명 참여` : '아무도 투표하지 않았어요')
    : mine ? `${total}명 참여 · 마감 전까지 바꾸거나 취소할 수 있어요` : `${total}명 참여 중 · 골라야 결과와 댓글이 보여요`;
  $('#bsCn').textContent = BAL.ncom;
  const lock = open && !mine, form = $('#bsForm');
  form.classList.toggle('lock', lock);
  $('#bsIn').disabled = lock;
  $('#bsIn').placeholder = lock ? '먼저 한쪽을 고르면 댓글을 달 수 있어요' : open ? '왜 그쪽을 골랐는지 한마디!' : '결과 보고 한마디!';
  const list = $('#bsList');
  if (!BAL.comments) { list.innerHTML = `<li class="bc-empty">🙈 한쪽을 고르면 댓글 ${BAL.ncom}개가 보여요</li>`; return; }
  if (!BAL.comments.length) { list.innerHTML = `<li class="bc-empty">${open ? '첫 댓글의 주인공이 되어 보세요 ✍️' : '댓글이 없어요'}</li>`; return; }
  list.innerHTML = BAL.comments.map(c => `<li class="bc${c.pick ? ' side-' + c.pick : ''}">`
    + `<a class="av xs c-${esc(c.color || 'sky')}${c.dev ? ' avdev' : ''}" href="#u/${esc(c.handle)}" data-close aria-label="${esc(c.name)} 프로필">${c.dev ? '<img src="/logo-mark.svg?v=4" alt="">' : esc(c.avatar || '😎')}</a>`
    + `<div class="bc-m"><p class="bc-h"><b>${esc(c.dev ? '개발자' : c.name)}</b>${c.pick ? `<span class="bc-side">${esc(BAL[c.pick])}</span>` : '<span class="bc-side none">구경</span>'}<small>${balAgo(c.at)}</small></p>`
    + `<p class="bc-b">${esc(c.body)}</p></div>`
    + (c.me ? `<button class="bc-x" type="button" data-cdel="${c.id}" aria-label="내 댓글 지우기">지우기</button>` : `<button class="bc-x" type="button" data-crep="${c.id}" aria-label="댓글 신고">신고</button>`)
    + '</li>').join('');
}
const balAgo = t => { const s = (balNow() - t) / 1000; return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : s < 86400 ? Math.floor(s / 3600) + '시간 전' : `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}`; };
async function balVote(k) {
  if (!BAL || balBusy) return;
  if (!BAL.open) { toast(balNow() < BAL.opens ? `투표는 ${hhmm(BAL.opens)}에 시작해요` : '투표가 마감됐어요 · 결과를 확인해 보세요'); return; }
  const next = BAL.mine === k ? '' : k, prev = BAL.mine;
  if (prev) BAL.counts[prev]--;   // 화면 먼저 바꾸고 서버에 저장
  if (next) BAL.counts[next]++;
  BAL.mine = next; paintBalance();
  balBusy = true;
  try {
    setBal(await balCall(BAL_API, { pick: next, ymd: BAL.ymd }));
    if (next && !prev) toast('한 표 완료! 친구들 댓글도 볼 수 있어요 💬');
  } catch (err) { toast(err.message); await loadBalance(); }
  balBusy = false;
}
const onPick = e => { const el = e.target.closest('[data-pick]'); if (el) balVote(el.dataset.pick); };
$('#plOpts').addEventListener('click', onPick);
$('#bsOpts').addEventListener('click', onPick);
$('#plMore').onclick = () => { if (!BAL) return; paintBalSheet(); openModal('#mBal'); loadBalance().then(pollBalance); };
$('#plQ').onclick = $('#plCom').onclick = $('#plMore').onclick;
// 댓글 입력: Enter = 등록, Shift+Enter = 줄바꿈 (한글 조합 중 Enter는 무시)
const bsGrow = () => { const i = $('#bsIn'); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 110) + 'px'; };
$('#bsIn').addEventListener('input', bsGrow);
$('#bsIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); $('#bsForm').requestSubmit(); } });
$('#bsForm').addEventListener('submit', async e => {
  e.preventDefault();
  const inp = $('#bsIn'), body = inp.value.trim();
  if (!BAL || !body || balBusy) return;
  balBusy = true;
  try { setBal(await balCall('/api/s/balc', { body, ymd: BAL.ymd })); inp.value = ''; bsGrow(); $('#bsList').scrollTop = 0; }
  catch (err) { toast(err.message); }
  balBusy = false;
});
$('#bsList').addEventListener('click', async e => {
  const d = e.target.closest('[data-cdel]'), r = e.target.closest('[data-crep]');
  if (d) {
    if (!confirm('내 댓글을 지울까요?')) return;
    try { setBal(await balCall('/api/s/balcdel', { id: +d.dataset.cdel })); toast('지웠어요'); } catch (err) { toast(err.message); }
  } else if (r) {
    const why = prompt('신고 사유를 적어 주세요 (선택)');
    if (why === null) return;
    try { await balCall('/api/s/balcrep', { id: +r.dataset.crep, reason: why }); toast('신고했어요. 개발자가 확인할게요'); } catch (err) { toast(err.message); }
  }
});
// 다른 친구들 표·댓글 반영: 티켓이 보이거나 크게 보기가 열려 있을 때만 (크게 보기 30초 · 티켓 90초)
new IntersectionObserver(es => { balVisible = es[0].isIntersecting; }).observe($('#play'));
function pollBalance() {
  clearTimeout(balTimer);
  const sheet = $('#mBal').classList.contains('open');
  balTimer = setTimeout(async () => {
    if (!document.hidden && !balBusy && ($('#mBal').classList.contains('open') || balVisible)) await loadBalance();
    pollBalance();
  }, sheet ? 30000 : 90000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && BAL) loadBalance(); });

/* ===== 시간표 ===== */
// 과목 이름 → 직접 그린 스티커 아이콘(index.html 스프라이트 #sj-*). 위에서부터 먼저 맞는 것. 영상고 전공 과목을 먼저, 일반 과목은 뒤에
const SUBJ_IC = [[/편집|포스트\s*프로덕션/, 'cut'], [/CG|VFX|모션|애니/i, 'cg'], [/연출|영화|시나리오|스토리/, 'clap'], [/촬영|영상|방송|미디어|콘텐츠/, 'cam'], [/사진/, 'photo'],
  [/음향|사운드|오디오/, 'audio'], [/2D|그래픽|일러스트|드로잉|미술|회화/i, 'brush'], [/디자인|시안|브랜딩|광고/, 'palette'], [/3D|모델링/i, 'cube'],
  [/인공지능|AI\b|데이터/i, 'robot'], [/정보|프로그래밍|코딩|컴퓨터|웹/, 'laptop'], [/상업|경제|회계|금융|경영|마케팅/, 'coin'],
  [/미적분|수학|확률|통계|기하/, 'ruler'], [/영어|English/i, 'en'], [/일본어|중국어|한문|외국어/, 'globe'], [/한국사|역사/, 'scroll'],
  [/화법|언어|국어|문학|독서|작문|매체/, 'ko'], [/사회|윤리|지리|정치|법/, 'globe'], [/과학|물리|화학|생명|지구/, 'flask'],
  [/스포츠|체육|운동/, 'ball'], [/음악/, 'music'], [/기술|가정/, 'tool'], [/진로/, 'compass'], [/동아리/, 'flag'], [/자율|자치|학급/, 'vote'], [/봉사/, 'heart'], [/시험|평가/, 'test']];
const subjIcon = n => `<svg class="sic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${(SUBJ_IC.find(([re]) => re.test(n)) || [, 'book'])[1]}"/></svg>`;
const subjName = s => String(s || '').replace(/^[\s*#·-]+/, '').trim();   // 나이스 원문의 '* 영상 CG작업' 같은 기호 제거
const needClass = empty('반을 설정하면 시간표가 보여요 · <button class="link" data-open-class>설정하기</button>');
// 홈 시간표에 보여 줄 날: 오늘 마지막 교시가 끝나면 다음 등교일, 다음 날 0시부터는 그날(=오늘)
const isSchoolDay = d => d.getDay() % 6 !== 0 && !offDays.has(ymd(d));
function ttTarget(n = now()) {
  let d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  const end = BELL.find(x => x.p === lastPeriod(d)).end;
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
  if (S.ttWk) setLbl($('#sTTlbl'), wkName(S.ttWk, '시간표'), ymd(S.ttWk) !== ymd(weekOf(ttTarget())), true);
  else setLbl($('#sTTlbl'), `${ttLabel(tgt)} 시간표`, !!S.ttPick, false);
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
    if (S.ttWk) { nextKey = ''; await fillWeek(box, S.ttWk, () => seq !== ttSeq || !S.ttWk); wkResize(); return; }
    box.innerHTML = rows.length
      ? `<ul class="tt">${rows.map(r => `<li data-p="${esc(r.PERIO)}"><span class="p">${esc(r.PERIO)}</span>${bellAt(r.PERIO)}<span class="s"><i class="si" aria-hidden="true">${subjIcon(subjName(r.ITRT_CNTNT))}</i>${esc(subjName(r.ITRT_CNTNT))}</span></li>`).join('')}</ul>` + (api.hasKey ? '' : '<p class="note">5교시까지만 표시돼요</p>')
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
    // 같은 과목이 이어지면 한 칸으로 합침(점심시간은 넘지 않음). skip[날짜_교시] = 위 칸에 합쳐져서 안 그림
    const skip = {}, cell = (d, p) => {
      const k = ymd(d), v = map[k + '_' + p] || '';
      if (skip[k + '_' + p]) return '';
      let n = 1;
      while (v && p + n <= maxP && map[k + '_' + (p + n)] === v && !(p + n === 5 && p + n - 1 === 4)) { skip[k + '_' + (p + n)] = 1; n++; }
      const c = [k === t ? 'today' : k < t ? 'past' : '', v ? '' : 'e', n > 1 ? 'dbl' : ''].filter(Boolean).join(' ');
      return `<td${c ? ` class="${c}"` : ''} data-d="${k}" data-p="${p}" data-p2="${p + n - 1}"${n > 1 ? ` rowspan="${n}"` : ''}>${v ? `<i class="si" aria-hidden="true">${subjIcon(v)}</i><span class="sj">${esc(v)}</span>${n > 1 ? `<i class="x2">${n}시간</i>` : ''}` : ''}</td>`;   // 수업 없는 칸(e)은 칠하지 않음
    };
    const pn = p => { const b = BELL.find(x => x.p === p); return `<td class="pn"><b>${p}</b>${b ? `<small>${String(b.start / 3600 | 0).padStart(2, '0')}:${String(b.start % 3600 / 60).padStart(2, '0')}</small>` : ''}</td>`; };
    let h = '<table class="week"><thead><tr><th></th>' + days.map(d => { const k = ymd(d); return `<th class="${k === t ? 'today' : k < t ? 'past' : ''}"><span class="wd-d">${d.getDate()}</span><span class="wd-w">${DOW[d.getDay()]}</span></th>`; }).join('') + '</tr></thead><tbody>';
    for (let p = 1; p <= maxP; p++) {
      if (p === 5) h += '<tr class="lunch"><td></td><td colspan="5"><span>점심시간 12:10 ~ 13:00</span></td></tr>';
      h += `<tr>${pn(p)}${days.map(d => cell(d, p)).join('')}</tr>`;
    }
    box.innerHTML = h + '</tbody></table>';
    markWeek();
    const th = box.querySelector('th.today');   // 좁은 화면(가로 스크롤)에선 오늘 칸이 보이게
    if (th && box.scrollWidth > box.clientWidth + 4) box.scrollLeft = Math.max(0, th.offsetLeft - 56);
  } catch { if (!stale()) box.innerHTML = empty('시간표를 불러오지 못했어요'); }
}
// 주간 시간표 표의 오늘 칸에 지금·다음·끝난 교시 표시 (교시가 바뀔 때 tickClock이 다시 부름)
let weekPI = null;
function markWeek(pi = weekPI) {
  weekPI = pi; const t = ymd(today());
  $$('.week td[data-d]').forEach(td => {
    const live = pi && td.dataset.d === t, a = +td.dataset.p, z = +td.dataset.p2, has = !td.classList.contains('e');
    const now = live && has && pi.cur >= a && pi.cur <= z;
    td.classList.toggle('now', now);
    td.classList.toggle('next', live && has && !now && !pi.cur && pi.done < 99 && pi.nxt === a);
    td.classList.toggle('done', live && has && !now && pi.done > z);
    if (!now) delete td.dataset.left;
  });
  // 지금 교시 줄의 교시 번호(왼쪽 열)도 강조 → 표 어디서 봐도 지금 줄을 따라갈 수 있게
  $$('.week td.pn').forEach(c => c.classList.remove('nowp'));
  const cur = $('.week td.now');
  if (cur) { let tr = cur.closest('tr'); for (let k = +cur.dataset.p; k <= +cur.dataset.p2 && tr; k++, tr = tr.nextElementSibling) tr.querySelector('td.pn')?.classList.add('nowp'); }
  weekProg();
  // 카드 머리 오른쪽 작은 상태 칩: 지금 수업 / 다음 수업 / 오늘 끝
  const el = $('#hwNow'); if (!el) return;
  const rs = S.todayTT || [], sj = p => { const r = rs.find(x => +x.PERIO === p); return r ? subjName(r.ITRT_CNTNT) : ''; };
  const showing = ymd(S.homeWeek) === ymd(mondayOf(today()));
  let h = '';
  if (pi && showing && rs.length) {
    if (pi.done >= 99 || pi.done > Math.max(...rs.map(r => +r.PERIO || 0))) h = '<em class="d">끝</em>오늘 수업 끝!';
    else if (pi.cur && sj(pi.cur)) h = `<em>지금</em>${subjIcon(sj(pi.cur))} ${pi.cur}교시 · ${esc(sj(pi.cur))}${sj(pi.cur + 1) && sj(pi.cur + 1) !== sj(pi.cur) ? `<span class="nx">다음 ${subjIcon(sj(pi.cur + 1))} ${esc(sj(pi.cur + 1))}</span>` : ''}`;
    else if (pi.nxt && sj(pi.nxt)) h = `<em class="n">다음</em>${subjIcon(sj(pi.nxt))} ${pi.nxt}교시 · ${esc(sj(pi.nxt))}`;
  }
  el.innerHTML = h; el.hidden = !h;
}
// 지금 칸 진행 막대(--pg)와 남은 분(data-left) — 1초마다 tickClock이 부름
function weekProg(sec) {
  const td = $('.week td.now'); if (!td) return;
  if (sec == null) { const nb = bellNow(); sec = nb.getHours() * 3600 + nb.getMinutes() * 60 + nb.getSeconds(); }
  const a = BELL.find(x => x.p === +td.dataset.p), z = BELL.find(x => x.p === +td.dataset.p2);
  if (!a || !z) return;
  const tot = z.end - a.start, pg = Math.min(1, Math.max(0, (sec - a.start) / tot)), m = Math.max(1, Math.ceil((z.end - sec) / 60));
  td.style.setProperty('--pg', (pg * 100).toFixed(1) + '%');
  const t = `${m}분 남음`; if (td.dataset.left !== t) td.dataset.left = t;
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
/* 첫 화면 '시계 묶음'(말풍선·N교시 시작까지·큰 시계·별 스티커·상태 줄)을 한 덩어리로 보고 화면 정가운데에 맞춤 (2026-10-23)
   묶음 전체의 바깥 상자를 재서 가운데가 화면 가운데(=좌우 서랍 중심)에 오도록 --hx/--hy 만큼 옮김. 위 공지·아래 밸런스 티켓과는 안 겹치게 제한 */
const HERO = $('#bigclock');
const HERO_PARTS = '.s-greet .bubble, #bellLbl, #bigTime, .clock .dk, #more';
// force=false(글자 폭 변화 등)일 땐 6px 미만 차이는 무시 → 말풍선 흔들림·별 반짝임 때문에 다시 잴 때마다 1~3px씩 튀던 문제 방지
function centerHero(force) {
  const st = HERO.style;
  if (!HERO.classList.contains('drawers')) { st.removeProperty('--hx'); st.removeProperty('--hy'); st.removeProperty('--hcy'); return; }
  if (!force && document.documentElement.classList.contains('tuck')) return;   // 첫 화면을 안 보고 있을 땐 안 잼
  if (document.documentElement.classList.contains('boot')) return;   // 등장 애니메이션 중엔 크기가 변하므로 안 잼
  const hx = parseFloat(st.getPropertyValue('--hx')) || 0, hy = parseFloat(st.getPropertyValue('--hy')) || 0;
  const bob = new DOMMatrix(getComputedStyle($('.s-greet')).transform).f;   // 말풍선 위아래 흔들림 값은 빼고 잼
  let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
  for (const el of HERO.querySelectorAll(HERO_PARTS)) {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    const oy = el.classList.contains('bubble') ? bob : 0;
    L = Math.min(L, b.left); R = Math.max(R, b.right); T = Math.min(T, b.top - oy); B = Math.max(B, b.bottom - oy);
  }
  if (!isFinite(L)) return;   // 홈이 안 보이는 중
  const sy = scrollY; L -= hx; R -= hx; T += sy - hy; B += sy - hy;   // 옮기기 전 위치(문서 기준)
  // 위 한계: 헤더 아래(헤더는 화면 고정이라 스크롤 값 안 더함, 공지는 위에 겹쳐 뜨므로 제외) / 아래 한계: 밸런스 티켓·▼ 버튼·첫 화면 끝 중 가장 위
  const hdr = $('header')?.getBoundingClientRect().bottom ?? 0, top = hdr + 14;
  let bot = Math.min(HERO.getBoundingClientRect().bottom + sy, innerHeight);
  for (const el of [$('#play'), $('#goDown')]) if (!el.hidden && el.offsetParent) bot = Math.min(bot, el.getBoundingClientRect().top + sy);
  bot -= 14;
  // 세로: 눈에 보이는 빈 공간(헤더~티켓)의 가운데 → 위아래 여백이 같아 보이게
  let dx = Math.round(innerWidth / 2 - (L + R) / 2), dy = (top + bot) / 2 - (T + B) / 2;
  if (B + dy > bot) dy = bot - B;
  if (T + dy < top) dy = Math.min(0, top - T);
  dy = Math.round(dy);
  // 작은 차이는 무시하되, 서랍 높이(--hcy)는 아래에서 항상 다시 맞춤 (2026-10-23: 첫 계산이 등장 중 값으로 굳어 서랍이 위로 떠 있던 문제)
  if (!force && Math.abs(dx - hx) < 6 && Math.abs(dy - hy) < 6) { dx = hx; dy = hy; }
  if (dx !== hx) st.setProperty('--hx', dx + 'px');
  if (dy !== hy) st.setProperty('--hy', dy + 'px');
  // 좌우 서랍도 같은 가운데 줄에. 서랍이 헤더·화면 아래에 걸리면 화면 가운데로
  // 세로 기준은 말풍선을 뺀 큰 시계 + 상태 줄의 가운데 — 서랍 가운데를 정확히 같은 높이로 (말풍선까지 넣으면 카드가 위로 떠 보임 — 2026-10-23)
  let cT = Infinity, cB = -Infinity;
  for (const el of HERO.querySelectorAll('#bigTime, #more')) { const b = el.getBoundingClientRect(); if (b.height) { cT = Math.min(cT, b.top); cB = Math.max(cB, b.bottom); } }
  const cy = Math.round(isFinite(cT) ? (cT + cB) / 2 + sy - hy + dy : (T + B) / 2 + dy), dh = Math.max(SIDE.meal.el.offsetHeight, SIDE.tt.el.offsetHeight) / 2;
  if (cy - dh >= hdr + 8 && cy + dh <= innerHeight - 8) st.setProperty('--hcy', cy + 'px'); else st.removeProperty('--hcy');
}
let heroRaf = 0, heroForce = false;
const heroLater = force => { heroForce ||= force === true; cancelAnimationFrame(heroRaf); heroRaf = requestAnimationFrame(() => { const f = heroForce; heroForce = false; centerHero(f); }); };
const heroResize = () => heroLater(true);
addEventListener('resize', heroResize); wideMQ.addEventListener('change', heroResize);
const heroRO = new ResizeObserver(() => heroLater()); for (const s of ['#bigTime', '#more', '#greet']) heroRO.observe($(s));
new MutationObserver(() => heroLater()).observe($('#play'), { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(() => heroLater()).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });   // 첫 화면으로 돌아오면 밀린 계산 반영
document.fonts?.ready.then(heroResize); heroResize();
new IntersectionObserver(([e]) => document.documentElement.classList.toggle('tuck', !e.isIntersecting), { threshold: .6 }).observe($('#bigclock'));
// 서비스들이 화면에 들어오면 왼쪽 아래 '서비스' 버튼을 숨김
new IntersectionObserver(([e]) => {
  const H = document.documentElement, was = H.classList.contains('at-svc');
  H.classList.toggle('at-svc', e.isIntersecting);
  // 서비스 버튼이 사라지면 그 위에 앉아 있던 캐릭터가 깜짝 놀라 떨어져 착지(m-drop), 버튼이 다시 나오면 같이 올라와 놀라며 휘청(m-rise)
  const m = document.getElementById('mascot');
  if (m && was !== e.isIntersecting && document.body.dataset.view === 'home' && !H.classList.contains('prelogin')) {
    m.classList.remove('m-drop', 'm-rise', 'm-hello'); void m.offsetWidth;
    m.classList.add(e.isIntersecting ? 'm-drop' : 'm-rise');
  }
}, { threshold: .25 }).observe($('#apps'));
/* ===== 첫 화면 카드에서 다른 날 넘겨 보기 (‹ ›) — 라벨을 누르면 오늘로, 3분 동안 안 만지면 자동으로 오늘로 ===== */
// 홈 카드 라벨: 지금(오늘·이번 주)이면 눌러서 하루↔한 주 전환, 다른 날·다른 주면 눌러서 지금으로
function setLbl(el, text, off, wk) {
  el.textContent = text; el.classList.toggle('off', off); el.classList.toggle('wkon', wk);
  const tip = off ? (wk ? '이번 주로 돌아가기' : '오늘로 돌아가기') : (wk ? '하루씩 보기' : '한 주씩 보기');
  el.dataset.tip = tip; el.setAttribute('aria-label', `${text} · 눌러서 ${tip}`);
  const card = el.closest('.s-tt'), what = card?.classList.contains('s-meal') ? '급식' : '시간표';
  card?.classList.toggle('wk', wk);
  card?.querySelectorAll('.s-nb').forEach(b => b.setAttribute('aria-label', `${b.dataset.d < 0 ? '이전' : '다음'} ${wk ? '주' : '날'} ${what}`));
}
function markOff(el, off) { el.classList.toggle('off', off); if (off) { el.dataset.tip = '오늘로 돌아가기'; el.setAttribute('aria-label', el.textContent + ' · 눌러서 오늘로'); } else { delete el.dataset.tip; el.removeAttribute('aria-label'); } }
const stepSchool = (d, k) => { let x = d, i = 0; do x = addDays(x, k); while (!isSchoolDay(x) && ++i < 21); return x; };
let resetT = 0;
function armReset() {
  clearTimeout(resetT);
  resetT = setTimeout(() => {
    if (S.sMealDay || S.heroPick || (S.mealWk && ymd(S.mealWk) !== ymd(weekOf(today())))) homeSide('meal');
    if (S.ttPick || (S.ttWk && ymd(S.ttWk) !== ymd(weekOf(ttTarget())))) homeSide('tt');
  }, 180e3);
}
function homeSide(k) {   // 지금(오늘·이번 주)으로 되돌림 — 하루/한 주 모드는 그대로
  if (k === 'meal') { S.sMealDay = null; S.heroPick = null; if (S.mealWk) S.mealWk = weekOf(today()); loadHeroDay(); }
  else { S.ttPick = null; if (S.ttWk) S.ttWk = weekOf(ttTarget()); renderHomeTT(); }
}
function homeMode(k) {   // 하루 ↔ 한 주 전환 (기억해 둠)
  if (k === 'meal') { S.mealWk = S.mealWk ? null : weekOf(today()); S.sMealDay = null; S.heroPick = null; store.set('wk_meal', !!S.mealWk); loadHeroDay(); }
  else { S.ttWk = S.ttWk ? null : weekOf(ttTarget()); S.ttPick = null; store.set('wk_tt', !!S.ttWk); renderHomeTT(); }
}
$$('[data-nav]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); stopPeek(); armReset();
  const k = +b.dataset.d;
  if (b.dataset.nav === 'meal' && S.mealWk) { S.mealWk = addDays(S.mealWk, 7 * k); loadHeroDay(); }
  else if (b.dataset.nav === 'tt' && S.ttWk) { S.ttWk = addDays(S.ttWk, 7 * k); renderHomeTT(); }
  else if (b.dataset.nav === 'meal') { const nd = stepSchool(S.sMealDay || today(), k); S.sMealDay = ymd(nd) === ymd(today()) ? null : nd; S.heroPick = null; loadHeroDay(); }
  else { const auto = ttTarget(), nd = stepSchool(S.ttPick || auto, k); S.ttPick = ymd(nd) === ymd(auto) ? null : nd; renderHomeTT(); }
}));
$$('[data-home]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); stopPeek(); armReset(); if (b.classList.contains('off')) homeSide(b.dataset.home); else homeMode(b.dataset.home); }));

/* ===== 주 고르기 팝업 — 'M/D ~ M/D' 라벨을 누르면 해 ‹ › · 12달 · 그 달의 주 목록으로 바로 이동 =====
   모달(.sheet는 overflow 스크롤) 안에서도 잘리지 않게 position:fixed로 라벨 아래에 띄움 */
function weekPick(sel, getMon, setMon) {
  const lbl = $(sel);
  const close = () => { $('#wPick')?.remove(); $$('#tLbl[aria-expanded="true"],#allLbl[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false')); };
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
        <div class="mp-w">${weeks().map(m => `<button type="button" data-w="${ymd(m)}" class="${ymd(m) === c ? 'on' : ''}${ymd(m) === ymd(tw) ? ' now' : ''}">${weekLbl(m)}</button>`).join('')}</div>
        <button type="button" class="mp-today" data-today="1">이번 주로</button>
        <button type="button" class="mp-ok" data-ok="1">확인</button>`;
    };
    paint();
    box.onclick = ev => {
      ev.stopPropagation();
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.y) { y += +b.dataset.y; paint(); return; }
      if (b.dataset.m) {   // 달을 누르면 그 달 첫 주로 바로 이동, 팝업은 열어 두고 주 목록만 바꿈
        mo = +b.dataset.m; setMon(weekOf(new Date(y, mo, 1))); paint(); box.querySelector('.mp-w .on, .mp-w button')?.focus(); return;
      }
      if (b.dataset.ok) { close(); lbl.focus(); return; }   // 확인을 눌러야만 닫힘
      const m = b.dataset.today ? tw : parseYmd(b.dataset.w);   // 주를 골라도 팝업은 열어 둠
      if (b.dataset.today) { y = anchorOf(tw).getFullYear(); mo = anchorOf(tw).getMonth(); }
      setMon(m); paint(); box.querySelector(b.dataset.today ? '.mp-today' : `[data-w="${ymd(m)}"]`)?.focus();
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
function weekOf(d) { return mondayOf(addDays(d, d.getDay() === 6 ? 2 : d.getDay() === 0 ? 1 : 0)); }
function wkResize() { try { heroResize(); } catch {} }   // 한 주 모드로 카드 높이가 바뀌면 서랍 세로 위치 다시 계산
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
$('#goMeal').onclick = e => { e.stopPropagation(); openAll('meal', S.mealWk || S.sMealDay || today()); };
$('#goWeek').onclick = e => { e.stopPropagation(); openAll('tt', S.ttWk || S.ttPick || ttTarget()); };
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
    const tip = ev.length ? ` data-tip="${ev.map(r => esc(r.EVENT_NM)).join(', ')}"${dow === 6 ? ' data-tip-end' : ''}` : '';
    h += `<div class="${cls}"${tip}><b class="n">${d}</b>${ev.slice(0, 2).map(r => `<span class="e${isOff(r) ? ' off' : ''}">${esc(r.EVENT_NM)}</span>`).join('')}${ev.length > 2 ? `<span class="e">+${ev.length - 2}</span>` : ''}</div>`;
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
    // 목록은 오늘(D-DAY)·다가오는 일정부터 위→아래, 지난 일정은 맨 아래에 최근 것부터
    const t = today(), up = rows.filter(r => parseYmd(r.AA_YMD) >= t), past = rows.filter(r => parseYmd(r.AA_YMD) < t).reverse();
    box.innerHTML = rows.length ? (up.length ? evHtml(up) : '') + (past.length ? `<p class="ev-sep">지난 일정</p>${evHtml(past)}` : '') : empty('이 달에는 일정이 없어요');
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
document.addEventListener('animationend', e => {
  if (e.animationName === 'm-hi') e.target.closest('.mascot')?.classList.remove('m-hello');
  if (e.animationName === 'm-fall' || e.animationName === 'm-rise') e.target.closest('.mascot')?.classList.remove('m-drop', 'm-rise');
});
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
  if (document.startViewTransition && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) skipOk(document.startViewTransition(go)); else go();
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
  if (document.startViewTransition && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) skipOk(document.startViewTransition(go)); else go();
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
  // 첫 등장 애니메이션: pre(숨김) → boot(등장). 끝나면 boot를 빼서 다른 화면 갔다 와도 다시 안 나옴
  renderHomeMeal(); renderHomeTT(); renderHomeDday(); loadOffDays(); loadNotice();
  if (S.mealWk) loadHeroDay();
  const balP = loadBalance(); balP.then(pollBalance);
  // 첫 등장: 밸런스 티켓(아래 한계)·글꼴이 준비된 뒤 최종 자리를 먼저 잡고 시작 → 엉뚱한 곳에 떴다가 자리를 찾아가지 않게 (최대 1.5초 대기)
  // 등장 중엔 다시 재지 않음(크기 변화 때문에) → 등장 후에도 위치가 안 튐
  const de = document.documentElement;
  Promise.race([Promise.all([balP, document.fonts?.ready]), new Promise(r => setTimeout(r, 1500))]).then(() => requestAnimationFrame(() => {
    centerHero(true); de.classList.remove('pre'); de.classList.add('boot');
    // 캐릭터는 첫 화면 동안 바닥에 있다가, 서비스 버튼이 올라오며 나타나는 순간(1.2초) 버튼과 같이 올라와 휘청 (스크롤로 돌아올 때와 같은 동작)
    // (캐릭터가 이 사이에 늦게 만들어져도 html.boot:not(.fab-in)에서는 바닥에 붙어 있음 → fab-in이 붙는 순간 올라감)
    setTimeout(() => { de.classList.add('fab-in'); const m = $('#mascot'); if (m && !de.classList.contains('at-svc')) { m.classList.remove('m-drop', 'm-hello'); void m.offsetWidth; m.classList.add('m-rise'); } }, 1200);
    // boot를 빼는 순간 #v-home의 화면 페이드(.view.on fade)가 다시 재생되며 첫 화면이 깜빡이고 서랍이 튀던 문제(2026-10-23) → calm으로 막음
    setTimeout(() => { $('#v-home').classList.add('calm'); de.classList.remove('boot', 'fab-in'); heroLater(); }, 2600);
  }));
  peekSides();
}
function intro(on) {
  HTML.classList.toggle('prelogin', on);
  $('#intro').inert = !on;
  if (on) { $('#intro').scrollTop = 0; introTick(); }
  else { clearTimeout(inTimer); authPage(false); onScroll(); bootHome(); }
}
// 소개 화면의 종 시계: 홈과 같은 종 시간(bellInfo)으로 실제 시각·남은 시간을 보여 줌 — 소개가 떠 있고 탭이 보일 때만 돌아감
let inTimer = 0;
function introTick() {
  clearTimeout(inTimer);
  if (!introOn() || document.hidden) return;
  const n = now(), nb = bellNow(), b = bellInfo(nb);
  const secNow = nb.getHours() * 3600 + nb.getMinutes() * 60 + nb.getSeconds();
  const left = b.target != null ? Math.max(0, b.target - secNow) : null;
  const rest = /쉬는|점심/.test(b.state);
  setText('#inSay', sayLine(b));
  setText('#inState', b.state);
  setText('#inAp', n.getHours() < 12 ? '오전' : '오후');
  setText('#inTime', `${n.getHours() % 12 || 12}:${pad(n.getMinutes())}`);
  setText('#inSec', pad(n.getSeconds()));
  $('#inCdBox').hidden = left == null;
  if (left != null) { setText('#inLbl', b.cnt || b.label); setText('#inLeft', fmtLeft(left)); setText('#inEndT', fmtLeft(left)); }
  setText('#inEndK', left == null ? '오늘 수업 끝' : (b.cnt || b.label).replace(/까지$/, '') + '까지');
  const bar = b.from != null && left != null, prog = bar ? Math.min(1, (secNow - b.from) / (b.target - b.from)) : 0;
  $('#inBarBox').hidden = !bar;
  if (bar) $('#inBar').style.transform = `scaleX(${(rest ? 1 - prog : prog).toFixed(4)})`;
  $('.in-clock').classList.toggle('rest', rest);
  showClock(n, b, left, bar ? (rest ? 1 - prog : prog) : null, rest, secNow);
  inTimer = setTimeout(introTick, 1000 - bellNow().getMilliseconds() + 5);
}
// 스크롤하면 카드가 하나씩 등장 (IntersectionObserver가 없으면 그냥 다 보임)
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { root: $('#intro'), threshold: .18 });
  $$('#intro .rv').forEach(el => io.observe(el));
  $('#intro').classList.add('rv-on');
}
// 반응속도 맛보기 (기록은 저장 안 함 — 가입하면 진짜 게임에서 랭킹에 올라감)
{
  const pad_ = $('#inRx'); let st = 'idle', t0 = 0, tm = 0, best = 0, tries = 0;
  const show = (cls, html) => { pad_.className = 'rx in-rx ' + cls; pad_.innerHTML = html; };
  const grade = ms => ms < 230 ? '이 정도면 반 대표감!' : ms < 290 ? '꽤 빠른데요?' : ms < 380 ? '평범한 반응속도' : '아직 잠이 덜 깼나 봐요';
  const hit = e => {
    e.preventDefault();
    if (st === 'wait') { clearTimeout(tm); st = 'shown'; show('early', '<b>앗, 너무 빨라요!</b><small>초록색이 될 때까지 참기 · 탭해서 다시</small>'); return; }
    if (st === 'go') {
      const ms = Math.round(performance.now() - t0); tries++;
      st = 'shown'; show('done', `<b>${ms}ms</b><small>${grade(ms)} · 탭해서 한 번 더</small>`);
      if (!best || ms < best) best = ms;
      const el = $('#inBest'); el.hidden = false;
      el.innerHTML = `내 최고 <b>${best}ms</b><button type="button" data-intro="signup">가입하고 랭킹에 올리기</button>`;
      return;
    }
    st = 'wait'; show('wait', '<b>기다려…</b><small>초록색이 되면 바로 탭!</small>');
    tm = setTimeout(() => { if (st !== 'wait') return; st = 'go'; show('go', '<b>지금!</b>'); t0 = performance.now(); }, 1000 + Math.random() * 2500);
  };
  pad_.addEventListener('pointerdown', hit);
  pad_.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) hit(e); });   // 키보드로도 할 수 있게
}
// '구경하기' 화살표: 소개 화면 안에서 부드럽게 내려감 (주소 해시는 안 바꿈)
$('#intro').addEventListener('click', e => { const a = e.target.closest('[data-intro-go]'); if (!a) return; e.preventDefault(); $('#' + a.dataset.introGo).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
// me: 로그인한 사람(없으면 null) · on: 소셜 기능이 켜져 있는지 · how: 'login' | 'signup' | undefined(처음 확인)
SOC.authed = (me, on = true, how) => {
  try { if (me) localStorage.setItem('sg_in', '1'); else localStorage.removeItem('sg_in'); } catch {}
  if (!on) return;                                   // 서버 확인 불가: 지금 상태 유지 (로그인 안 된 기기는 소개 화면 그대로)
  if (me) { if (introOn()) { intro(false); if (how === 'login' && !cls) setTimeout(openClass, 400); } }
  else intro(true);                                  // 로그인 안 했으면 사이트는 안 보이고 소개 화면만
};
$('#intro').inert = !introOn();
introTick();
// 로그인·가입 페이지(소개 화면 위 전체 화면): 열면 뒤로 가기 한 칸을 만들어, 태블릿 뒤로 가기 제스처가 사이트를 떠나지 않고 이 페이지만 닫게 함
let apTimer = 0;
function apLive() {   // 왼쪽 보드의 말풍선·상태는 소개 화면 종 시계(introTick)가 그린 값을 그대로 옮겨 씀
  [['#inSay', '#apSay'], ['#inState', '#apState'], ['#inLbl', '#apLbl'], ['#inLeft', '#apLeft']].forEach(([a, b]) => { const t = $(a)?.textContent; if (t && $(b).textContent !== t) $(b).textContent = t; });
  $('#apLeft').closest('.ap-live').hidden = !$('#inCdBox') || $('#inCdBox').hidden;
}
function authPage(k, fromPop) {
  const p = $('#introAuth'), slot = $('#authSlot');
  if (k) {
    slot.innerHTML = SOC.authForm(k);
    if (p.hidden) { p.hidden = false; p.classList.remove('out'); p.scrollTop = 0; try { history.pushState({ ap: 1 }, ''); } catch {} apLive(); apTimer = setInterval(apLive, 1000); }
    setTimeout(() => slot.querySelector('input')?.focus({ preventScroll: true }), 380);
    return;
  }
  if (p.hidden) return;
  clearInterval(apTimer);
  if (!fromPop && history.state?.ap) history.back();   // 만들어 둔 뒤로 가기 칸 정리
  if (!introOn()) { p.hidden = true; slot.innerHTML = ''; return; }   // 로그인 성공: 소개와 같이 바로 닫힘
  p.classList.add('out');
  setTimeout(() => { p.hidden = true; p.classList.remove('out'); slot.innerHTML = ''; $('.in-cta [data-intro]')?.focus({ preventScroll: true }); }, 220);
}
$('#intro').addEventListener('click', e => {
  if (e.target.closest('[data-auth-close]')) return authPage(false);
  const b = e.target.closest('[data-intro]'); if (!b) return;
  if (!SOC.authForm) { toast('잠시 후 다시 눌러 주세요'); return; }
  authPage(b.dataset.intro);
});
window.addEventListener('popstate', () => { if (!$('#introAuth').hidden) authPage(false, true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#introAuth').hidden && !$('.modal.open')) authPage(false); });

/* ===== 둘러보기 쇼케이스 (소개 화면 #inShow) =====
   화면(.sh-stage)은 sticky로 붙어 있고, 섹션을 스크롤한 양(0~1)을 진행도로 써서 오브젝트(.so)를 옮김.
   ① 로그인 후 첫 화면(급식판·종 시계·시간표·밸런스 + 헤더·버튼)이 통째로 페이드 인 → ② 헤더·버튼은 사라지고 오브젝트만 한 줄로 쭈르륵(나머지 서비스는 오른쪽에서 줄줄이 들어옴)
   → ③ 스크롤할 때마다 다음 오브젝트가 가운데로 넘어오며 아래에 설명. 급식은 오늘 실제 메뉴, 시간표는 반을 정한 기기면 실제(아니면 예시), 시계는 소개 종 시계 값. */
const SH_INFO = [
  ['오늘 급식', '조식·중식·석식이 시간 맞춰 바뀌고, 식판 그림으로 보여요. 맛있는 메뉴엔 투표도!'],
  ['진짜 종 시계', '우리 학교 종 시간 그대로. 쉬는 시간까지 남은 시간이 1초 단위로 줄어요'],
  ['우리 반 시간표', '학년·반만 고르면 끝. 지금 교시를 짚어 주고, 7교시가 끝나면 내일 시간표로'],
  ['오늘의 밸런스 게임', '평일마다 새 질문 하나. 마지막 교시가 끝나면 결과 공개, 댓글로 토론'],
  ['미니게임 랭킹', '반응속도 · 1 to 25 · 컷 타이밍. 반 대항전으로 우리 반 순위까지'],
  ['맞팔 친구랑 DM', '맞팔한 친구끼리만 주고받아요. 쉬는 시간 수다는 여기서'],
  ['프로필 꾸미기', '아바타·색·스티커·인스타 아이디까지. 친구 찾아서 팔로우'],
  ['학사일정 · D-day', '다음 시험·행사까지 남은 날이 바로 보여요. 달력으로 보는 학교 일정']];
const SH_EX_MEAL = { main: '탕수육', sides: ['잡채', '배추김치', '오이무침', '요구르트'], rice: '잡곡밥', soup: '미역국' };
const SH_EX_TT = ['국어', '영상 제작', '영어', '체육', '수학', '미술'];
let shTT = [];   // [[교시, 과목]]
const secHM = sec => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec % 3600 / 60))}`;
function showClock(n, b, left, pct, rest, sec) {
  if (!$('#shLeft')) return;
  setText('#shSay', sayLine(b)); setText('#shLbl', left == null ? '오늘 수업 끝' : b.cnt || b.label); setText('#shLeft', left == null ? `${n.getHours() % 12 || 12}:${pad(n.getMinutes())}` : fmtLeft(left));
  setText('#shTime', `${n.getHours() < 12 ? '오전' : '오후'} ${n.getHours() % 12 || 12}:${pad(n.getMinutes())}`);
  setText('#shDate', `${n.getMonth() + 1}월 ${n.getDate()}일`); setText('#shDow', DOW[n.getDay()] + '요일');
  setText('#shState', b.state); setText('#shPct', pct == null ? '' : `${Math.round(pct * 100)}% ${rest ? '남음' : '지남'}`);
  $('#shBar').parentElement.hidden = pct == null;
  if (pct != null) $('#shBar').style.transform = `scaleX(${pct.toFixed(4)})`;
  $$('#shTt li').forEach(li => { const bl = BELL.find(x => x.p === +li.dataset.p); li.classList.toggle('done', !!bl && sec >= bl.end); li.classList.toggle('cur', !!bl && sec >= bl.start && sec < bl.end); });
}
async function fillShow() {
  const day = ymd(today()), cell = (x, cls) => { if (!x) return `<span class="c ${cls}"></span>`; const k = foodImg(x); return `<span class="c ${cls}">${k ? `<img src="/food/c/${k}.webp" alt="" loading="lazy">` : '<i></i>'}<b>${esc(x)}</b></span>`; };
  const [meal, rows] = await Promise.all([
    getMeals(today()).then(r => r.filter(x => MEALS[x.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE)).catch(() => []),
    cls ? getTimetable(cls, today(), today()).then(r => r.filter(x => x.ALL_TI_YMD === day).sort((a, b) => a.PERIO - b.PERIO)).catch(() => []) : Promise.resolve([])]);
  const r = meal.length ? pickMeal(meal, mealSlot()) : null;
  let m = SH_EX_MEAL;
  if (r) { const t = splitTray(cleanDish(r.DDISH_NM)), rest = [...t.top[1], ...t.top[2], ...t.top[3]]; m = { main: t.top[0][0] || rest.shift(), sides: rest.slice(0, 4), rice: t.rice, soup: t.soup }; }
  $('#shMealK').textContent = r ? '오늘 ' + MEALS[r.MMEAL_SC_CODE] : '오늘 급식';
  $('#shTray').innerHTML = cell(m.main, 'm') + cell(m.sides[0], 'a') + cell(m.sides[1], 'a') + cell(m.sides[2], 'a') + cell(m.sides[3], 'a') + cell(m.rice, 'b') + cell(m.soup, 'r');
  $('#shKcal').hidden = !r?.CAL_INFO; if (r?.CAL_INFO) $('#shKcal').textContent = '🔥 ' + r.CAL_INFO;
  $('#shMealEx').hidden = !!r;
  shTT = rows.length ? rows.slice(0, 7).map(x => [+x.PERIO, subjName(x.ITRT_CNTNT)]) : SH_EX_TT.map((x, i) => [i + 1, x]);
  $('#shTtK').textContent = rows.length ? `${cls.g}-${cls.c} 시간표` : '오늘 시간표';
  $('#shTt').innerHTML = shTT.map(([p, nm]) => { const bl = BELL.find(x => x.p === p); return `<li data-p="${p}"><b>${p}</b><small>${bl ? secHM(bl.start) : ''}</small>${subjIcon(nm)}<span>${esc(nm)}</span></li>`; }).join('');
  $('#shTtEx').hidden = !!rows.length;
  if (introOn()) introTick();
}
{
  const sec = $('#inShow'), root = $('#intro'), objs = [...$$('#inShow .so')], N = objs.length;
  const chrome = sec.querySelector('.sh-chrome'), cap = sec.querySelector('.sh-cap'), say = sec.querySelector('.sh-say'), skip = $('#shSkip'), dots = $('#shDots');
  const T_IN = .07, T_HOLD = .15, T_ROW = .29, T_END = .96, STAG = .009;
  const HOME = {   // 첫 화면 배치(디자인 캔버스 기준 중심 좌표·배율). 가로 화면·세로 화면 두 가지
    land: { w: 1440, h: 860, at: [[225, 470, 1], [720, 440, 1], [1225, 470, 1], [720, 765, .7]] },
    port: { w: 860, h: 1180, at: [[225, 790, .95], [430, 330, 1.15], [635, 790, .95], [430, 1085, .62]] } };
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v, ease = t => t * t * (3 - 2 * t), easeO = t => 1 - Math.pow(1 - t, 3), lerp = (a, b, t) => a + (b - a) * t;
  let L = null, target = 0, cur = 0, raf = 0, last = 0, idx = -1, on = false;
  dots.innerHTML = '<i></i>'.repeat(N);
  function layout() {
    const W = sec.querySelector('.sh-stage').clientWidth, H = root.clientHeight, hm = W >= H * 1.05 ? HOME.land : HOME.port;
    const k = Math.min(W / hm.w, H / hm.h), ox = (W - hm.w * k) / 2, oy = (H - hm.h * k) / 2;
    const sz = objs.map(o => [o.offsetWidth, o.offsetHeight]);
    const home = objs.map((o, i) => { const [w, h] = sz[i]; const a = hm.at[i] || [hm.w + 260 + (i - 4) * 140, hm.h / 2, .8]; return { x: ox + k * (a[0] - w * a[2] / 2), y: oy + k * (a[1] - h * a[2] / 2), s: k * a[2], o: i < 4 ? 1 : 0 }; });
    const rowH = Math.min(H * (W < 600 ? .46 : .52), 440), gap = Math.max(26, W * .035), cy = H * (W < 600 ? .44 : .47);
    let x = 0;
    const row = objs.map((o, i) => { const [w, h] = sz[i], s = Math.min(rowH / h, W * .82 / w), r = { x, w: w * s, h: h * s, s, y: cy - h * s / 2 }; x += w * s + gap; return r; });
    chrome.style.width = hm.w + 'px'; chrome.style.height = hm.h + 'px';
    L = { W, H, k, ox, oy, home, row, range: Math.max(1, sec.offsetHeight - H) };
    // 스냅 지점: 첫 화면 감상 · 오브젝트 하나씩
    sec.querySelectorAll('.sh-snap').forEach(x => x.remove());
    [(T_IN + T_HOLD) / 2, ...Array.from({ length: N }, (_, j) => T_ROW + j * (T_END - T_ROW) / (N - 1))].forEach(p => {
      const m = document.createElement('i'); m.className = 'sh-snap'; m.style.top = Math.round(p * L.range) + 'px'; sec.appendChild(m); });
  }
  function render(p) {
    if (!L) return;
    const { W, k, ox, oy, home, row } = L;
    const fin = easeO(clamp(p / T_IN)), zoom = lerp(.9, 1, fin);
    const t = clamp((p - T_ROW) / (T_END - T_ROW)) * (N - 1), i0 = Math.floor(t), f = Math.min(N - 1, i0 + ease(clamp((t - i0 - .2) / .6)));
    const cOf = v => { const a = Math.floor(v), b = Math.min(N - 1, a + 1), r = v - a; return lerp(row[a].x + row[a].w / 2, row[b].x + row[b].w / 2, r); };
    const pan = W / 2 - cOf(f), zx = W / 2, zy = L.H / 2;
    objs.forEach((o, i) => {
      const q = ease(clamp((p - T_HOLD - i * STAG) / (T_ROW - T_HOLD - (N - 1) * STAG))), h = home[i], r = row[i];
      const d = Math.min(1, Math.abs(i - f)), mul = 1 - .16 * d;
      const rs = r.s * mul, rx = pan + r.x + r.w * (1 - mul) / 2, ry = r.y + r.h * (1 - mul) / 2;
      // 첫 화면: 가운데 기준으로 살짝 커지며 등장(zoom)
      const hx = zx + (h.x - zx) * zoom, hy = zy + (h.y - zy) * zoom, hs = h.s * zoom;
      const x = lerp(hx, rx, q), y = lerp(hy, ry, q), s = lerp(hs, rs, q);
      const op = lerp(h.o * fin, .38 + .62 * (1 - d), q);
      o.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
      o.style.opacity = op.toFixed(3);
      if (i === 1) { o.style.setProperty('--fr', q.toFixed(3)); o.style.setProperty('--sp', (1 - q).toFixed(3)); }
    });
    const gone = clamp((p - T_HOLD) / .035);
    chrome.style.transform = `translate(${(zx + (ox - zx) * zoom).toFixed(1)}px,${(zy + (oy - zy) * zoom).toFixed(1)}px) scale(${(k * zoom).toFixed(4)})`;
    chrome.style.opacity = (fin * (1 - gone)).toFixed(3);
    cap.style.opacity = (1 - gone).toFixed(3);
    const ui = clamp((p - T_ROW + .04) / .04);
    say.style.opacity = dots.style.opacity = ui.toFixed(3);
    skip.classList.toggle('on', p > T_HOLD && p < T_END);
    const ni = Math.round(f);
    if (ni !== idx) {
      idx = ni; $('#shN').textContent = `${pad(ni + 1)} / ${pad(N)}`; $('#shT').textContent = SH_INFO[ni][0]; $('#shD').textContent = SH_INFO[ni][1];
      say.classList.remove('swap'); void say.offsetWidth; say.classList.add('swap');
      [...dots.children].forEach((x, j) => x.classList.toggle('on', j === ni));
    }
  }
  const progress = () => L ? clamp(-sec.getBoundingClientRect().top / L.range) : 0;
  function loop(ts) {
    const dt = Math.min(64, ts - (last || ts)); last = ts;
    cur += (target - cur) * (1 - Math.exp(-dt / 70));   // 스크롤을 부드럽게 따라감 (휠이 툭툭 끊겨도 애니메이션은 이어지게)
    if (Math.abs(target - cur) < .0004) cur = target;
    render(cur);
    raf = cur === target ? 0 : requestAnimationFrame(loop);
  }
  const kick = () => { if (!on) return; target = progress(); if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
  function setup() {
    on = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    sec.classList.toggle('sh-on', on); root.classList.toggle('sh-snapy', on);
    if (!on) { objs.forEach(o => { o.style.transform = o.style.opacity = ''; }); sec.querySelectorAll('.sh-snap').forEach(x => x.remove()); return; }
    sec.style.setProperty('--steps', 11);
    layout(); cur = target = progress(); render(cur);
  }
  root.addEventListener('scroll', kick, { passive: true });
  new ResizeObserver(() => { if (on && introOn()) { layout(); cur = target = progress(); render(cur); } }).observe(root);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', setup);
  skip.addEventListener('click', () => root.scrollTo({ top: root.scrollTop + sec.getBoundingClientRect().bottom - L.H + 2, behavior: 'smooth' }));
  setup();
  fillShow();
}

/* ===== 시작 ===== */
if (store.get('wk_meal', false)) S.mealWk = weekOf(today());   // 홈 카드 하루/한 주 보기 기억
if (store.get('wk_tt', false)) S.ttWk = weekOf(today());
tickClock();
renderClassChip();
store.pruneCache();
// 서비스 워커: 와이파이가 끊겨도 마지막 화면·급식·시간표 보이기 (public/sw.js)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
// 날짜가 바뀐 채로 다시 열면(자정 넘김) 새로 고침
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (ymd(today()) !== startDay) location.reload(); else { tickClock(); introTick(); }
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

/* ===== 입력 안내 말풍선 (브라우저 기본 경고창 대신) ===== */
// 폼 칸이 비었거나 날짜가 덜 골라졌을 때, 기본 회색 경고 대신 사이트 스티커 느낌의 말풍선을 칸 아래에 띄움
let tipBusy = false;
function fieldMsg(el) {
  const v = el.validity;
  if (el.type === 'date') return v.valueMissing && !v.badInput ? '날짜를 골라 주세요' : '날짜를 끝까지(연·월·일) 골라 주세요';
  if (v.valueMissing) return el.tagName === 'SELECT' ? '하나를 골라 주세요' : '여기를 채워 주세요';
  if (v.tooShort) return `${el.minLength}자 이상 적어 주세요`;
  if (v.tooLong) return `${el.maxLength}자까지 적을 수 있어요`;
  if (v.typeMismatch || v.patternMismatch) return '형식을 다시 확인해 주세요';
  if (v.rangeUnderflow || v.rangeOverflow) return '범위를 벗어났어요';
  return el.validationMessage || '다시 확인해 주세요';
}
function hideFieldTip() {
  const t = $('#fTip'); if (!t) return;
  t.classList.add('out'); setTimeout(() => t.remove(), 160);
  $$('.f-bad').forEach(x => x.classList.remove('f-bad'));
}
document.addEventListener('invalid', e => {
  e.preventDefault();
  if (tipBusy) return;            // 한 번 제출에 첫 칸만 안내
  tipBusy = true; requestAnimationFrame(() => { tipBusy = false; });
  const el = e.target;
  $('#fTip')?.remove(); $$('.f-bad').forEach(x => x.classList.remove('f-bad'));
  const tip = document.createElement('div');
  tip.id = 'fTip'; tip.className = 'ftip'; tip.setAttribute('role', 'alert');
  tip.innerHTML = `<i aria-hidden="true">!</i><span>${esc(fieldMsg(el))}</span>`;
  document.body.append(tip);
  const r = el.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.top = (r.bottom + scrollY + 12) + 'px';
  tip.style.left = Math.max(12 + scrollX, Math.min(r.left + scrollX, scrollX + innerWidth - w - 12)) + 'px';
  tip.style.setProperty('--ax', Math.max(14, Math.min(w - 26, r.left + scrollX + 22 - parseFloat(tip.style.left))) + 'px');
  el.classList.add('f-bad'); el.focus({ preventScroll: true });
  clearTimeout(hideFieldTip.t); hideFieldTip.t = setTimeout(hideFieldTip, 3500);
}, true);
['input', 'change'].forEach(ev => document.addEventListener(ev, e => { if (e.target.classList?.contains('f-bad')) hideFieldTip(); }, true));
addEventListener('resize', hideFieldTip);
