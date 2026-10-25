// SVMHS GROUND — 화면 로직 (홈 · 급식 · 시간표 · 학사일정 · D-day · 모달)
import { $, $$, now, ymd, isYmd, parseYmd, addDays, today, mondayOf, diffDays, DOW, fmtDay, ddayText, pad, esc, store, skel, empty, toast, idle, onWake } from './util.js';
import { api, MEALS, loadConfig, getClasses, getMeals, getMealsRange, getTimetable, getSchedule, cleanDish } from './neis.js';
import { foodSvg, arBucket, drinkSvg, isDrink, foodImg } from './food.js';
import { emo, ui, stkMsg, repTag } from './att-art.js';
import './tip.js';
import './seg.js';   // 전환 버튼 묶음 → 스위치처럼 미끄러지는 알약 (2026-10-25)
import { initInstall } from './install.js';   // 앱으로 설치하기 (2026-10-25)
import { wearG, wearSvg, spotPref, resolveSpot, anchorOf } from './wear.js';

/* ===== 설정 ===== */
const SITE_URL = 'https://svmhs-ground.pages.dev/';
const MAX_GRADE = 3, MAX_CLASS = 10, BASE_CLASS = 6, MAX_DDAY = 20;   // 2026년 학년별 6개 반 (반 목록은 나이스에서 받아옴, 실패 시 BASE_CLASS)
const VIEWS = ['home', 'meal', 'tt', 'cal', 'dday', 'me', 'u', 'dm', 'game', 'gacha'];   // me·u·dm·game·gacha는 social.js가 그림

/* ===== 저장된 값 불러오기 (손상·조작된 값은 버림) ===== */
const validClass = c => c && +c.g >= 1 && +c.g <= MAX_GRADE && +c.c >= 1 && +c.c <= MAX_CLASS
  ? { g: String(+c.g), c: String(+c.c), dep: typeof c.dep === 'string' ? c.dep.slice(0, 30) : '' } : null;
const myDdays = () => {
  const l = store.get('ddays', []);
  return Array.isArray(l) ? l.filter(x => x && typeof x.name === 'string' && isYmd(x.date)).slice(0, MAX_DDAY) : [];
};

const sji = k => `<svg class="sic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${k}"/></svg>`;   // 직접 그린 아이콘(이모지 대신, 2026-10-24)
/* ===== 상태 ===== */
let cls = validClass(store.get('class', null));
let shReclock = null;   // 소개 쇼케이스: 진짜 시계를 복제해 둔 카드도 1초마다 다시 복제 (introTick → showClock에서 부름)
const S = { mealSlot: '', mealManual: false, sMealDay: null, heroPick: null, ttPick: null, mealDate: today(), ttWeek: mondayOf(today()), calMonth: new Date(today().getFullYear(), today().getMonth(), 1), homeMeal: null, homeWeek: mondayOf(addDays(today(), today().getDay() === 6 ? 2 : today().getDay() === 0 ? 1 : 0)) };
const startDay = ymd(today());

/* ===== 헤더 · 시계 · 종 시간 ===== */
// 학교 공지 시정표(2025 기준). 월·화·수 7교시, 목·금 6교시. 시험 기간 등 특별 일과는 반영 안 됨
const BELL = [['조회', '08:00', '08:10'], [1, '08:20', '09:10'], [2, '09:20', '10:10'], [3, '10:20', '11:10'], [4, '11:20', '12:10'],
  [5, '13:00', '13:50'], [6, '14:00', '14:50'], [7, '15:00', '15:50']]
  .map(([p, a, b]) => { const s = t => +t.slice(0, 2) * 3600 + +t.slice(3) * 60; return { p, start: s(a), end: s(b) }; });
const offDays = new Set();   // 학사일정상 휴업일·공휴일(YYYYMMDD)
const isOff = r => r.SBTR_DD_SC_NM === '휴업일' || r.SBTR_DD_SC_NM === '공휴일';
const isSchoolDay = d => d.getDay() % 6 !== 0 && !offDays.has(ymd(d));
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
// 쉬는 날(주말·휴업일)은 그냥 시계. 다음 등교일 전날 17시부터만 '1교시 시작까지' 카운트다운 (예: 일요일 17시 → 월요일 1교시)
const COUNT_FROM = 17 * 3600;
const tomorrowSchool = n => isSchoolDay(addDays(new Date(n.getFullYear(), n.getMonth(), n.getDate()), 1));
function bellInfo(n) {
  const dow = n.getDay(), wk = dow === 0 || dow === 6;
  if (wk || offDays.has(ymd(n))) {
    const st = wk ? '주말' : '쉬는 날', sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
    if (tomorrowSchool(n) && sec >= COUNT_FROM) return { state: st, label: '1교시 시작까지', cnt: '1교시 시작까지', target: nextFirstBell(n), away: true, eve: true };
    return { state: st, label: wk ? '주말이다! 🎉' : '오늘은 쉬는 날', cnt: wk ? '주말이다! 🎉' : '오늘은 쉬는 날', target: null, away: true, free: true };
  }
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
  // 학교 끝나면 다음 1교시까지 — 내일이 쉬는 날이면(금요일 등) 카운트다운 대신 '주말이다!' + 그냥 시계
  if (!tomorrowSchool(n)) { const wkNext = (dow + 1) % 7 === 6; return { state: '방과 후', label: wkNext ? '주말이다! 🎉' : '내일은 쉬는 날', cnt: wkNext ? '주말이다! 🎉' : '내일은 쉬는 날', target: null, away: true, free: true, wkNext }; }
  return { state: '방과 후', label: '1교시 시작까지', cnt: '1교시 시작까지', target: nextFirstBell(n), away: true };
}

// 지금 상태에 맞춘 G의 한마디 (시간대가 아니라 종 시간 기준이라 '수업 중인데 점심 인사' 같은 어긋남이 없음)
const SAY = { today: '', tmr: '' };   // 학사일정 알림(loadOffDays가 채움)
function sayLine(b) {
  const p = +((b.state.match(/^(\d)교시/) || [])[1] || 0);
  const hr = bellNow().getHours();
  // 새벽(23시~5시)에 들어온 건 공부·작업하다 등교까지 얼마나 남았나 보려는 것 → 응원 문구 (2026-10-24 하율 요청). 10분마다 바뀜
  if ((hr >= 23 || hr < 5) && b.target != null && (b.eve || b.state === '등교 전' || b.state === '방과 후')) {
    const L = ['새벽 공부 중? 등교 전까지 시간 아껴 쓰자 📚', '작업 중이구나! 지금 집중력 최고일 때야 🔥', '조금만 더 하고 꼭 눈 붙이자 😴', '이 시간까지 깨어 있는 너, 진짜 대단해 ✨', '끝내고 몇 시간 잘 수 있는지 시계 한번 보자 ⏰', '새벽 집중 모드 ON 💪 마무리까지 화이팅', '물 한 잔 마시고 다시 달려 보자 💧', '오늘 한 만큼 내일이 편해질 거야 🌙'];
    return L[Math.floor(bellNow().getMinutes() / 10 + hr * 6) % L.length];
  }
  if (b.eve) return SAY.tmr || '내일 학교… 마음의 준비 하자 🙃';
  if (SAY.today && ['등교 전', '조회 중', '쉬는 시간', '점심시간'].includes(b.state)) return SAY.today;
  if (b.state === '주말') return '주말이다! 푹 쉬자 😴';
  if (b.state === '쉬는 날') return '오늘은 쉬는 날! 푹 쉬자 😴';
  if (b.state === '방과 후' && b.free) return b.wkNext ? '주말이다!!! 🎉 일주일 고생했어' : '내일은 쉬는 날! 🎉';
  if (b.state === '방과 후') return SAY.tmr || '오늘도 수고했어 👋';
  if (b.state === '등교 전') return hr < 7 ? '일찍 일어났네! 오늘도 가보자 ☀️' : '좋은 아침! 오늘도 가보자 ☀️';
  if (b.state === '조회 중') return '조회 시간, 정신 차려~ 👀';
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
    setHtml('#bigTime', dg(l.toFixed(2)) + '<span class="u">초</span>');   // '7.39'가 7분 39초로 읽히지 않게 '초'를 붙임
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
    if (!first) { S.mealManual = false; renderHomeTT(); renderHomeMeal(); renderHomeDday(); longSched = null; renderCountdown(); }
  } else if (!S.ttPick && S.ttShown && cls && ymd(ttTarget(n)) !== S.ttShown) renderHomeTT();   // 마지막 교시 끝에 홈 시간표 날짜 전환
  const key = `${b.state}|${pi.cur}|${pi.nxt}|${S.todayTT ? S.todayTT.length : '-'}`;
  if (key !== nextKey) {   // 교시가 바뀔 때만 다시 그림
    nextKey = key; renderNext(b, pi); renderTicker(b, pi);
    const live = S.ttShown === ymd(n);
    // 지금 교시 · (쉬는 시간이면) 다음 교시 · 끝난 교시 표시
    markWeek(n.getDay() % 6 && isSchoolDay(n) ? pi : null);
    $$('#sTT li').forEach(li => { const p = +li.dataset.p, z = +li.dataset.p2 || p, inn = x => x >= p && x <= z; li.classList.toggle('now', live && inn(pi.cur)); li.classList.toggle('next', live && !pi.cur && inn(pi.nxt)); li.classList.toggle('done', live && z < pi.done && !inn(pi.cur)); });
  }
  weekProg(secNow);
  cdTick(n);
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
  if (isRest && S.wasRest === false) { hero.classList.add('yay'); clearTimeout(S.yayT); S.yayT = setTimeout(() => calmDown(hero), 4000); }   // 쉬는 시간이 막 시작: 4초만 초록 두근두근 후 차분하게
  S.wasRest = isRest;
  const hadGo = hero.classList.contains('go');   // ※ 반드시 아래 toggle·사용보다 먼저 선언 (순서가 바뀌면 app.js 전체가 멈춤)
  hero.classList.toggle('go', / 수업 중$/.test(b.state) && left != null && left > 0 && left <= 60);   // 수업 마지막 1분: 초록 두근두근
  if (hadGo && !hero.classList.contains('go') && !hero.classList.contains('yay')) calmDown(hero);   // 쉬는 시간 아닌 상태로 끝나도 부드럽게
  if (hero.classList.contains('go') || hero.classList.contains('yay')) { const ms = bellNow().getMilliseconds(); $('#bigTime').getAnimations().forEach(a => { a.currentTime = ms; }); }   // 두근 박자를 종 기준 초가 바뀌는 순간에 맞춤
  const bar = b.from != null && left != null, prog = bar ? Math.min(1, (secNow - b.from) / (b.target - b.from)) : 0;
  $('#bellBarBox').hidden = !bar;
  const restBar = /쉬는|점심/.test(b.state);   // 쉬는 시간: 100%에서 줄어듦(남은 %), 수업: 0%에서 늘어남(지난 %)
  if (bar) $('#bellBar').style.transform = `scaleX(${(restBar ? 1 - prog : prog).toFixed(4)})`;
  const restPct = Math.ceil((1 - prog) * 100);   // 배터리처럼: 40% 이하 노랑, 20% 이하 빨강
  $('#bellBarBox').classList.toggle('low', bar && restBar && restPct <= 40 && restPct > 20);
  $('#bellBarBox').classList.toggle('crit', bar && restBar && restPct <= 20);
  setText('#bellPct', bar ? (restBar ? `${Math.ceil((1 - prog) * 100)}% 남음` : `${Math.floor(prog * 100)}% 지남`) : b.eve ? '내일 학교 가는 날' : b.state === '주말' ? '즐거운 주말' : b.state === '쉬는 날' ? '푹 쉬는 날' : b.free ? (b.wkNext ? '주말 시작!' : '내일 쉬는 날') : b.state === '방과 후' ? '오늘 수업 끝' : b.state === '등교 전' && n.getHours() < 5 ? '새벽 집중 중' : b.target != null && left > 3600 ? '아직 여유 있어요' : b.target != null ? '곧 시작해요' : '오늘 수업 끝');
  tickTimer = setTimeout(tickClock, 1000 - bellNow().getMilliseconds() + 5);   // 초가 바뀌는 순간에 맞춰 갱신
}
// 초록 두근두근이 끝날 때: 한 번 작게 뛰며 색이 원래대로 서서히 돌아감(페이드 아웃)
function calmDown(hero) { hero.classList.remove('yay'); hero.classList.add('calm'); clearTimeout(S.calmT); S.calmT = setTimeout(() => hero.classList.remove('calm'), 1400); }
// 다음 수업 카드 (첫 화면 오른쪽 작은 카드)
function renderNext(b, pi) {
  const box = $('#hNext'), rows = S.todayTT;
  if (!box) return;
  const subj = p => { const r = rows && rows.find(x => +x.PERIO === p); return r ? subjName(r.ITRT_CNTNT) : ''; };
  const card = (lbl, val, sub = '') => `<span class="m-lbl">${lbl}</span><b class="m-val">${val}</b>${sub}`;
  let h;
  if (!cls) h = card('다음 수업', '반을 골라 주세요', '<button class="link" data-open-class>반 설정하기</button>');
  else if (b.state === '쉬는 날' || b.state === '주말') h = card('오늘', 'OFF', '<span class="m-sub">수업 없는 날이에요</span>');
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
    // 여름방학처럼 '방학식'·'개학식' 행사만 있고 매일 휴업일로 안 올라오는 방학: 방학식 다음 날 ~ 개학식 전날도 쉬는 날 (lib/attend.js와 같은 규칙)
    const past = api.hasKey ? await getSchedule(addDays(today(), -80), addDays(today(), -1)).catch(() => []) : [];
    const ev = [...past, ...rows].filter(r => /방학식|종업식|개학/.test(r.EVENT_NM)).sort((x, y) => x.AA_YMD < y.AA_YMD ? -1 : 1);
    ev.forEach((r, i) => {
      if (/개학/.test(r.EVENT_NM)) return;
      const k = ev.slice(i + 1).find(x => /개학/.test(x.EVENT_NM));
      for (let d = addDays(parseYmd(r.AA_YMD), 1), j = 0; j < 80 && (!k || ymd(d) < k.AA_YMD); d = addDays(d, 1), j++) offDays.add(ymd(d));
    });
    // 오늘 학교 행사·시험 / 요일 교체일(나이스 '금요일수업')은 G의 말풍선으로 알려 줌 (2026-10-25: 예전 '#todayNote' 칸이 화면에서 빠져 있어 안 보이던 것 고침)
    const tk = ymd(addDays(today(), 1)), sw = rows.find(r => r.AA_YMD === t && r.swap), swT = rows.find(r => r.AA_YMD === tk && r.swap);
    const evT = rows.filter(r => r.AA_YMD === t && !isOff(r) && !r.swap).map(r => r.EVENT_NM.replace(/대수능 모의학력평가|대학수학능력시험 모의평가/, '수능 모의평가').replace(/대학수학능력시험/, '수능').replace(/\(.*?\)/g, '').trim());
    SAY.today = sw ? `오늘은 ${sw.swap}요일 시간표로 수업해요 📚` : evT.length ? `오늘은 ${evT[0]}! 종 시간이 다를 수 있어요 🔔` : '';
    SAY.tmr = swT ? `내일은 ${swT.swap}요일 시간표! 준비물 챙기자 🎒` : '';
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
// 맨 위·맨 아래로 (2026-10-23): 첫 화면 아래 화살표 = 페이지 맨 아래로, 맨 아래 화살표 = 맨 위로
// ▼ → 바로 아래 '한눈에 보기' (2026-10-24 2차, 하율 요청): '한눈에 보기' 제목이 화면 맨 위 헤더 줄 바로 아래(48px)에 오는 자리까지 올림
const BOARD_TOP = 48;
const boardY = () => Math.max(0, $('#boardT').getBoundingClientRect().top + scrollY - BOARD_TOP);
$('#goDown').onclick = () => scrollTo({ top: boardY(), behavior: 'smooth' });
{
  // 2026-10-25 하율: '한눈에 보기' 아래로 밀어 두던 여백(화면 밖까지 내림)은 간격이 너무 넓다고 해서 없앰.
  // 카운트다운·친구 나란히 · 친구 카드가 숨으면 카운트다운 혼자 한 줄(.solo) — CSS :has는 hidden 바뀔 때 일부만 다시 그려져서 JS로
  const cd = $('#cdCard'), bd = $('#bdCard');
  const solo = () => cd.classList.toggle('solo', !bd || bd.hidden);
  if (bd) new MutationObserver(solo).observe(bd, { attributes: true, attributeFilter: ['hidden'] });
  solo();
}
$('#goTop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
// 짧은 화면(게임 등)엔 '맨 위로'가 필요 없음 → 페이지가 화면 1.5배보다 짧으면 숨김 (2026-10-24)
{ const f = () => { $('#goTop').hidden = document.documentElement.scrollHeight < innerHeight * 1.5; }; if (typeof ResizeObserver === 'function') new ResizeObserver(f).observe(document.body); addEventListener('resize', f); f(); }
// 2026-10-25: 섹션 시작(위 여백 170px)이 아니라 '서비스' 제목이 헤더 버튼 바로 아래에 오게 — 게임·학교생활·보상이 한 화면에
$('#svcFab').onclick = () => $('#appsT').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
const isSeaweed = n => n === '김' || /(구이|조미|맨|돌|파래|재래|전장|도시락|곱창)김$/.test(n);   // 구이김·조미김 ('고기튀김'처럼 '김'으로 끝나는 튀김은 아님 — 2026-10-24 메인 반찬에서 빠지던 문제)
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
  const top = [[], [], [], []], others = (mi >= 0 ? rest.slice(1) : rest.slice()).map((n, i) => [n, i]).sort((a, b) => mainScore(b[0]) - mainScore(a[0]) || a[1] - b[1]).map(([n]) => n);   // 맛있는(점수 높은) 반찬부터 넓은 칸에
  if (mi >= 0) top[0].push(rest[0]);
  // 위아래로 나뉜 가운데 칸은 하나씩만, 남는 메뉴는 넓은 오른쪽 칸에 모아 담음 (작은 칸에 두 개씩 넣으면 글자가 잘림)
  // 메뉴가 적은 날 빈 칸이 생기지 않게 채우는 순서를 개수에 따라 바꿈 (2026-10-24): 넓은 오른쪽 칸 먼저, 가운데는 그다음
  // (가운데 칸이 하나만 차면 CSS가 그 칸을 위아래로 늘리고, 위 칸 하나가 통째로 비면 tray 클래스로 남은 칸을 넓힘)
  const k = others.length;
  const slots = mi >= 0 ? (k === 1 ? [3] : k === 2 ? [3, 1] : [3, 1, 2]) : (k === 1 ? [0] : k === 2 ? [0, 3] : k === 3 ? [0, 3, 1] : [0, 3, 1, 2]);
  others.forEach((n, i) => top[i < slots.length ? slots[i] : 3].push(n));   // 칸보다 많으면 넓은 오른쪽 칸에 모음
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
  return `<i class="vc${n && n === v.top ? ' best' : ''}">${n && n === v.top ? sji('crown') : '♥ '}${n}</i>`;
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
    ? `<p class="vnote">${sji('vote')}${v.open ? (v.mine ? `내 픽 <b>${esc(v.mine)}</b>` : '맛있는 메뉴 눌러서 투표') : '인기투표 결과'} · ${v.total}명</p>`
    : v.open
    ? `<p class="vnote">${sji('vote')}${v.mine ? `내 픽 <b>${esc(v.mine)}</b> · 다시 누르면 취소` : '제일 맛있는 메뉴를 눌러 투표!'} · ${v.total}명 참여</p>`
    : `<p class="vnote">${sji('vote')}인기투표 결과 · ${v.total}명 참여</p>`;
  const at = `data-meal="${r.MMEAL_SC_CODE}" data-ymd="${ymd(d || today())}"`;
  const fill = [!!t.top[0].length, !!(t.top[1].length || t.top[2].length), !!t.top[3].length];
  const lay = (fill[1] ? '' : ' nomid') + (fill.filter(Boolean).length === 1 ? ' one' : '') + (!t.rice !== !t.soup ? ' onebig' : '');
  return `<div class="tray-set${mini ? ' sm' : ''}${t.drinks.length ? ' has-drink' : ''}" ${at}><div class="tray${mini ? ' mini' : ''}${lay}" role="list" aria-label="급식 식판" ${at}>`
    + cellHtml(t.top[0], '', v)
    + `<div class="mid">${cellHtml(t.top[1], 'half', v)}${cellHtml(t.top[2], 'half', v)}</div>`
    + cellHtml(t.top[3], '', v)
    + cellHtml(t.rice ? [t.rice] : [], 'big', v) + cellHtml(t.soup ? [t.soup] : [], 'big soup', v)
    + `</div>${drinksHtml(t.drinks, v)}</div>` + info + (r.CAL_INFO ? `<div class="kcal">${sji('fire')}${esc(r.CAL_INFO)}</div>` : '');   // 홈 작은 식판도 아래 카드와 같게 칼로리 표시
};
// 홈 '오늘 급식' 카드: 큰 식판 대신 작은 그림 + 이름 목록 (식판은 첫 화면 서랍·급식 화면에 있음). 누르면 투표(식판과 같은 data-dish)
const mealListHtml = (r, d) => {
  if (!r) return empty('급식 정보가 없어요');
  const om = orderMenu(cleanDish(r.DDISH_NM)), all = om.list, v = voteOf(ymd(d), r.MMEAL_SC_CODE);
  const at = `data-meal="${r.MMEAL_SC_CODE}" data-ymd="${ymd(d)}"`;
  const info = !v ? '' : `<p class="vnote">${sji('vote')}${v.open ? (v.mine ? `내 픽 <b>${esc(v.mine)}</b>` : '맛있는 메뉴 눌러서 투표') : '인기투표 결과'} · ${v.total}명</p>`;
  return `<div class="tray-set mlist" ${at}><ul class="ml${om.hasMain ? '' : ' nomain'}" role="list" aria-label="급식 메뉴">${all.map(x => `<li class="${v && v.open ? 'vote' : ''}${v && v.mine === x ? ' picked' : ''}"${dishAttr(x, v)}><span class="mth">${isDrink(x) ? drinkSvg(x) : fx(x)}</span><span class="mn">${esc(x)}</span>${voteMark(x, v)}</li>`).join('')}</ul></div>`
    + `<div class="mfoot">${info}${r.CAL_INFO ? `<span class="kcal">${sji('fire')}${esc(r.CAL_INFO)}</span>` : ''}</div>`;
};
let homeRows = [];
// 지금 보여 줄 끼니: 7시 50분까지 조식 → 5교시 시작(점심 끝)까지 중식 → 그 뒤로 석식
// 끼니가 끝나는 시각: 조식 7:50 · 중식 = 5교시 시작 · 석식 18:00 (석식 끝나는 시각이 바뀌면 e만 고칠 것)
// 끝난 끼니는 바로 다음 끼니로: 조식 → 중식 → 석식 → (다음 급식 날) 조식. 석식이 없는 날은 중식이 끝나면 바로 다음 조식 (2026-10-24 하율 요청)
const MEAL_AT = { b: 7 * 3600 + 50 * 60, d: BELL.find(x => x.p === 5).start, e: 18 * 3600 };
function mealSlot(n = now()) {
  const sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  return sec < MEAL_AT.b ? '1' : sec < MEAL_AT.d ? '2' : sec < MEAL_AT.e ? '3' : '4';   // '4' = 오늘 끼니 다 끝남 → mealsOver
}
// 그 끼니가 없는 날(석식 없는 날 등)은 다음 끼니 → 중식 → 아무거나 순서로 대신 보여 줌
function pickMeal(rows, want) {
  return rows.find(r => r.MMEAL_SC_CODE === want) || rows.find(r => r.MMEAL_SC_CODE > want)
    || rows.find(r => r.MMEAL_SC_CODE === '2') || rows[rows.length - 1];
}
// 오늘 끼니가 다 끝났으면(석식 없는 날의 점심 뒤·석식 시간 뒤 석식 없음·급식 없는 날) 다음 급식 날의 첫 끼니를 보여 줌 (2026-10-23)
let nextMeal = null, nextSeq = 0;   // { day, rows } — 다음 급식 날
const mealsOver = () => S.homeLoaded && !S.mealFail && !homeRows.some(r => r.MMEAL_SC_CODE >= S.mealSlot);
async function loadNextMeal() {
  const seq = ++nextSeq, from = addDays(today(), 1);
  nextMeal = { day: null, rows: null };
  try {
    const rows = (await getMealsRange(from, addDays(from, 20))).filter(r => MEALS[r.MMEAL_SC_CODE]);
    if (seq !== nextSeq) return;
    const k = rows.map(r => r.MLSV_YMD).sort()[0];
    nextMeal = k ? { day: parseYmd(k), rows: rows.filter(r => r.MLSV_YMD === k).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE) } : { day: null, rows: [] };
  } catch { if (seq !== nextSeq) return; nextMeal = { day: null, rows: [] }; }
  if (homeRows.length) paintHeroMeal(); else paintHomeMeal();   // 오늘 급식 없는 날은 '한눈에 보기' 카드도 다음 급식 날로
}
const autoMealDay = () => (!S.mealWk && mealsOver() && nextMeal?.day) || null;   // ‹ › 기준이 되는 '지금' 급식 날
// 첫 화면 급식 카드: 기본은 오늘(끼니 자동), ‹ › 로 다른 날(S.sMealDay)을 넘겨 봄. 끼니 칩으로 조식·중식·석식 바꿔 보기(S.heroPick)
let heroRows = null, heroSeq = 0;
function paintHeroMeal() {
  const box = $('#sMeal'), lbl = $('#sMealLbl'), slots = $('#sMealSlots'), d = S.sMealDay;
  if (S.mealWk) { paintHeroWeek(); return; }
  let rows = d ? heroRows : homeRows, day = d || today(), want = d ? '2' : S.mealSlot;
  if (!d && mealsOver()) {   // 오늘 급식 끝 → 다음 급식 날 첫 끼니
    if (!nextMeal) { loadNextMeal(); rows = null; }
    else if (!nextMeal.rows) rows = null;
    else if (nextMeal.day) { rows = nextMeal.rows; day = nextMeal.day; want = '1'; }
  }
  setLbl(lbl, `${ttLabel(day)} 급식`, !!d, false);   // 하루 보기로 돌아올 때 한 주 카드 폭(.wk)도 같이 풂 (2026-10-23: 식판이 한 주 폭으로 커져 시계를 가리던 문제)
  if (!rows) { slots.innerHTML = ''; box.innerHTML = skel(2); return; }
  if (!rows.length) { slots.innerHTML = ''; box.innerHTML = empty((d ? S.heroFail : S.mealFail) ? '급식 정보를 불러오지 못했어요' : '급식이 없는 날이에요'); return; }
  const r = (S.heroPick && rows.find(x => x.MMEAL_SC_CODE === S.heroPick)) || pickMeal(rows, want);
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
// '한눈에 보기' 급식 카드: 오늘 급식이 없는 날(주말·휴업일)엔 위 식판처럼 다음 급식 날을 보여 줌 (2026-10-25 — 두 카드가 어긋나지 않게)
function paintHomeMeal() {
  if (!S.mealManual && homeRows.length) S.homeMeal = (S.mealSlot === '4' ? homeRows[homeRows.length - 1] : pickMeal(homeRows, S.mealSlot)).MMEAL_SC_CODE;   // '한눈에 보기' 오늘 급식: 다 끝났으면 마지막 끼니
  paintHeroMeal();
  const today0 = !!homeRows.length, rows = today0 ? homeRows : nextMeal?.rows, day = today0 ? today() : nextMeal?.day;
  const ttl = $('#mealCard h2').lastChild, tabs = $('#hMealTabs'), box = $('#hMeal');
  ttl.nodeValue = !today0 && day ? `${ttLabel(day)} 급식` : '오늘 급식';
  if (!today0 && !rows) { tabs.innerHTML = ''; box.innerHTML = skel(3); return; }   // 다음 급식 날 찾는 중
  if (!today0 && !day) { tabs.innerHTML = ''; box.innerHTML = empty(S.mealFail ? '급식 정보를 불러오지 못했어요' : '다음 급식 정보가 아직 안 올라왔어요'); return; }
  const sel = rows.some(r => r.MMEAL_SC_CODE === S.homeMeal) && (today0 || S.mealManual) ? S.homeMeal : (rows.find(r => r.MMEAL_SC_CODE === '2') || rows[0]).MMEAL_SC_CODE;
  tabs.innerHTML = rows.map(r => `<button data-m="${r.MMEAL_SC_CODE}" class="${r.MMEAL_SC_CODE === sel ? 'on' : ''}">${MEALS[r.MMEAL_SC_CODE]}</button>`).join('');
  setTray(box, mealListHtml(rows.find(r => r.MMEAL_SC_CODE === sel), day));
}
async function renderHomeMeal() {
  const box = $('#hMeal'), tabs = $('#hMealTabs');
  try {
    const [rows] = await Promise.all([getMeals(today()), loadVotes(today())]);
    homeRows = rows.filter(r => MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
    S.homeLoaded = true; S.mealFail = false; nextMeal = null; nextSeq++;   // 날짜가 바뀌면 다음 급식도 새로 찾음
    if (!homeRows.length) { paintHomeMeal(); return; }
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
const balDayOn = () => isSchoolDay(new Date(now()));   // 오늘이 등교일일 때만 밸런스 게임 표시
async function balCall(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || '잠시 후 다시 해 주세요'); e.status = r.status; throw e; }
  return j;
}
function setBal(j) {
  BAL = j && j.enabled ? j : null;
  // 좋아요를 저장하는 중에 새 상태가 오면, 누른 결과가 되돌아가 보이지 않게 내 쪽 값을 유지
  if (BAL?.comments && likeWant.size) for (const c of BAL.comments) if (likeWant.has(c.id)) { const w = likeWant.get(c.id); if (c.liked !== w) { c.liked = w; c.likes = Math.max(0, c.likes + (w ? 1 : -1)); } }
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
    return { cls: left <= 600 ? 'hot' : 'live', txt: `마감까지 ${fmtLeft(left)}`, ic: 'clock', long: `${hhmm(BAL.closes)} 마감 · ${fmtLeft(left)} 남음` };
  }
  if (n < BAL.opens) return { cls: 'wait', txt: `${hhmm(BAL.opens)} 시작`, long: `${hhmm(BAL.opens)}부터 투표 시작` };
  const w = balWinner(BAL.counts);
  return { cls: 'done', txt: w === 'tie' ? '무승부!' : w ? `'${BAL[w]}' 승리` : '투표 마감', ic: w && w !== 'tie' ? 'trophy' : '', long: `투표 마감 · 다음 질문은 ${balDow(BAL.next)} ${hhmm(BAL.next)}` };
}
// 결과: 'a' | 'b' | 'tie' | '' (투표 없음)
const balWinner = c => !(c.a + c.b) ? '' : c.a === c.b ? 'tie' : c.a > c.b ? 'a' : 'b';
function balOpt(k, big) {
  const { counts, mine, open } = BAL, total = counts.a + counts.b, show = !!mine || !open || !!BAL.dev, closed = !open;
  const pct = total ? Math.round(counts[k] / total * 100) : 0, w = closed ? balWinner(counts) : '';
  const cls = ['bo', 'bo-' + k, mine === k && 'picked', show && 'shown', w === k && 'win', w && w !== k && w !== 'tie' && 'lose', w === 'tie' && 'tie'].filter(Boolean).join(' ');
  return `<button class="${cls}" type="button" data-pick="${k}" aria-pressed="${mine === k}"${closed ? ' aria-disabled="true"' : ''}>`
    + `<i class="bo-fill" aria-hidden="true" data-pct="${show ? pct : 0}"></i>${w === k ? `<i class="bo-crown" aria-hidden="true">${sji('crown')}</i>` : ''}`
    + `<span class="bo-t">${esc(BAL[k])}</span>${mine === k ? '<i class="bo-ck" aria-hidden="true">✔</i>' : ''}${w === k ? '<span class="bo-stamp">WIN</span>' : ''}${show ? `<b class="bo-p">${pct}%${big ? `<small>${counts[k]}표</small>` : ''}</b>` : ''}</button>`;
}
const fillBars = root => root.querySelectorAll('.bo-fill').forEach(el => { el.style.transform = `scaleX(${(+el.dataset.pct / 100).toFixed(3)})`; });
function paintBalance() {
  const box = $('#play');
  box.hidden = !BAL || !balDayOn();   // 학교 안 가는 날(주말·휴업일·공휴일)엔 밸런스 티켓을 아예 안 보임 (2026-10-23)
  if (!BAL) { clearInterval(balAuto); return; }
  const st = balStatus();
  box.className = 'bal-t st-' + st.cls;
  $('#plQ').textContent = BAL.q;
  $('#plSt').innerHTML = (st.ic ? sji(st.ic) : '') + esc(st.txt);
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
  if ($('#play').hidden === balDayOn()) { paintBalance(); return; }   // 자정이 지나 쉬는 날이 되거나(금→토) 등교일이 되면 바로 숨김/표시
  const n = balNow();
  if ((BAL.open && n >= BAL.closes) || (!BAL.open && n >= BAL.opens && n < BAL.closes) || (!BAL.open && n >= BAL.next)) { clearInterval(balAuto); setTimeout(loadBalance, 1500); return; }
  const st = balStatus();
  setHtml('#plSt', (st.ic ? sji(st.ic) : '') + esc(st.txt));
  if ($('#mBal').classList.contains('open')) setText('#bsSt', st.long);
  $('#play').classList.toggle('st-hot', st.cls === 'hot');
}
/* ----- 댓글 좋아요 ----- */
// 버튼 하나만 바꾸고(목록 전체를 다시 그리지 않음 → 깜빡임·애니메이션 끊김 없음),
// 연타해도 마지막으로 원한 상태 하나만 서버에 맞춤 (요청은 댓글마다 한 번에 하나)
const likeWant = new Map(), likeBusy = new Set();
const likeBtn = c => `<button class="bc-like${c.liked ? ' on' : ''}" type="button" data-clike="${c.id}" aria-pressed="${c.liked}" aria-label="좋아요 ${c.likes}개">`
  + `<span class="bl-h" aria-hidden="true">${c.liked ? '♥' : '♡'}</span><b class="bl-n">${c.likes || ''}</b></button>`;
function paintLike(btn, c, burst) {
  btn.classList.toggle('on', c.liked);
  btn.setAttribute('aria-pressed', c.liked);
  btn.setAttribute('aria-label', `좋아요 ${c.likes}개`);
  btn.querySelector('.bl-h').textContent = c.liked ? '♥' : '♡';
  const n = btn.querySelector('.bl-n'), txt = c.likes ? String(c.likes) : '';
  if (n.textContent !== txt) { n.textContent = txt; n.classList.remove('roll'); void n.offsetWidth; n.classList.add('roll'); }
  if (burst === undefined) return;
  btn.classList.remove('pop', 'unpop'); void btn.offsetWidth;
  btn.classList.add(burst ? 'pop' : 'unpop');
  if (burst && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    btn.querySelectorAll('.bl-p').forEach(p => p.remove());
    for (let i = 0; i < 7; i++) {   // 작은 하트가 사방으로 톡 튀어나감
      const p = document.createElement('i'), a = (i / 7) * Math.PI * 2 - Math.PI / 2, r = 24 + (i % 2) * 8;
      p.className = 'bl-p'; p.textContent = i % 3 ? '♥' : '✦';
      p.style.setProperty('--x', (Math.cos(a) * r).toFixed(1) + 'px');
      p.style.setProperty('--y', (Math.sin(a) * r).toFixed(1) + 'px');
      p.style.animationDelay = (i % 3) * 25 + 'ms';
      btn.appendChild(p); setTimeout(() => p.remove(), 750);
    }
  }
}
function toggleLike(btn) {
  const id = +btn.dataset.clike, c = BAL?.comments?.find(x => x.id === id);
  if (!c) return;
  c.liked = !c.liked; c.likes = Math.max(0, c.likes + (c.liked ? 1 : -1));
  likeWant.set(id, c.liked);
  paintLike(btn, c, c.liked);
  syncLike(id);
}
async function syncLike(id) {
  if (likeBusy.has(id)) return;   // 진행 중인 요청이 끝나면 아래에서 마지막 상태로 다시 맞춤
  likeBusy.add(id);
  let want, res = null;
  try {
    do { want = likeWant.get(id); res = await balCall('/api/s/balclike', { id, on: want }); } while (likeWant.get(id) !== want);
  } catch (err) { toast(err.message); res = null; }
  likeBusy.delete(id); likeWant.delete(id);
  const c = BAL?.comments?.find(x => x.id === id), btn = $('#bsList').querySelector(`[data-clike="${id}"]`);
  if (!c) return;
  if (res) { c.liked = res.liked; c.likes = res.likes; } else { await loadBalance(); return; }   // 실패하면 서버 값으로 되돌림
  if (btn) paintLike(btn, c);
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
  const lock = open && !mine && !BAL.dev, form = $('#bsForm');
  form.classList.toggle('lock', lock);
  $('#bsIn').disabled = lock;
  $('#bsIn').placeholder = lock ? '먼저 한쪽을 고르면 댓글을 달 수 있어요' : open ? '왜 그쪽을 골랐는지 한마디!' : '결과 보고 한마디!';
  const list = $('#bsList');
  if (!BAL.comments) { list.innerHTML = `<li class="bc-empty">🙈 한쪽을 고르면 댓글 ${BAL.ncom}개가 보여요</li>`; return; }
  if (!BAL.comments.length) { list.innerHTML = `<li class="bc-empty">${open ? '첫 댓글의 주인공이 되어 보세요 ✍️' : '댓글이 없어요'}</li>`; return; }
  list.innerHTML = BAL.comments.map(c => `<li class="bc${c.pick ? ' side-' + c.pick : ''}">`
    + `<a class="av xs c-${esc(c.color || 'sky')}${c.dev ? ' avdev' : ''}" href="#u/${esc(c.handle)}" data-close aria-label="${esc(c.name)} 프로필">${c.dev ? '<img src="/logo-mark.svg?v=4" alt="">' : emo(c.avatar || 'k:cat', 'ava')}</a>`
    + `<div class="bc-m"><p class="bc-h"><b>${esc(c.dev ? '개발자' : c.name)}</b>${c.dev ? '' : repTag(c)}${c.pick ? `<span class="bc-side">${esc(BAL[c.pick])}</span>` : '<span class="bc-side none">구경</span>'}<small>${balAgo(c.at)}</small></p>`
    + (stkMsg(c.body) ? `<p class="bc-b bc-stk">${stkMsg(c.body)}</p></div>` : `<p class="bc-b">${esc(c.body)}</p></div>`)
    + likeBtn(c)
    + (c.me ? `<button class="bc-x bc-del" type="button" data-cdel="${c.id}" aria-label="내 댓글 지우기" data-tip="지우기"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-trash"/></svg></button>` : `<button class="bc-x" type="button" data-crep="${c.id}" aria-label="댓글 신고">신고</button>`)
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
const bsGrow = () => { const i = $('#bsIn'); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight + i.offsetHeight - i.clientHeight, 110) + 'px'; };   // 테두리 포함
$('#bsIn').addEventListener('input', bsGrow);
$('#bsIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); $('#bsForm').requestSubmit(); } });
async function balSend(body, typed) {
  if (!BAL || !body || balBusy) return;
  balBusy = true;
  try { setBal(await balCall('/api/s/balc', { body, ymd: BAL.ymd })); if (typed) { $('#bsIn').value = ''; bsGrow(); } $('#bsList').scrollTop = 0; }
  catch (err) { toast(err.message); }
  balBusy = false;
}
$('#bsForm').addEventListener('submit', e => { e.preventDefault(); balSend($('#bsIn').value.trim(), true); });
// 출석 보상 스티커로 댓글 달기 (고르는 창은 social.js stkTray)
$('#bsStk').innerHTML = ui('sparkle', 'ic');
$('#bsStk').onclick = e => { if ($('#bsForm').classList.contains('lock')) { toast('먼저 한쪽을 골라 주세요'); return; } if (SOC.stkTray) SOC.stkTray(e.currentTarget, v => balSend('::' + v)); else toast('잠시 후 다시 눌러 주세요'); };
$('#bsList').addEventListener('click', async e => {
  const d = e.target.closest('[data-cdel]'), r = e.target.closest('[data-crep]'), lk = e.target.closest('[data-clike]');
  if (lk) { toggleLike(lk); return; }
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
    if (!document.hidden && !idle() && !balBusy && ($('#mBal').classList.contains('open') || balVisible)) await loadBalance();
    pollBalance();
  }, sheet ? 30000 : 90000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && BAL) loadBalance(); });
onWake(() => { if (BAL && !balBusy && ($('#mBal').classList.contains('open') || balVisible)) loadBalance(); });   // 자리 비움에서 돌아오면 바로

/* ===== 시간표 ===== */
// 과목 이름 → 직접 그린 스티커 아이콘(index.html 스프라이트 #sj-*). 위에서부터 먼저 맞는 것. 영상고 전공 과목을 먼저, 일반 과목은 뒤에
const SUBJ_IC = [[/편집|포스트\s*프로덕션/, 'cut'], [/CG|VFX|모션|애니/i, 'cg'], [/연출|영화|시나리오|스토리/, 'clap'], [/촬영|영상|방송|미디어|콘텐츠/, 'cam'], [/사진/, 'photo'],
  [/음향|사운드|오디오/, 'audio'], [/2D|그래픽|일러스트|드로잉|미술|회화/i, 'brush'], [/디자인|시안|브랜딩|광고/, 'palette'], [/3D|모델링/i, 'cube'],
  [/인공지능|AI\b|데이터/i, 'robot'], [/정보|프로그래밍|코딩|컴퓨터|웹/, 'laptop'], [/상업|경제|회계|금융|경영|마케팅/, 'coin'],
  [/미적분|수학|확률|통계|기하/, 'ruler'], [/영어|English/i, 'en'], [/일본어|중국어|한문|외국어/, 'globe'], [/한국사|역사/, 'scroll'],
  [/화법|언어|국어|문학|독서|작문|매체/, 'ko'], [/사회|윤리|지리|정치|법/, 'globe'], [/과학|물리|화학|생명|지구/, 'flask'],
  [/스포츠|체육|운동/, 'ball'], [/음악/, 'music'], [/기술|가정/, 'tool'], [/진로/, 'compass'], [/동아리/, 'flag'], [/자율|자치|학급/, 'vote'], [/봉사/, 'heart'], [/시험|평가/, 'test']];
const subjIcon = n => `<svg class="sic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${(SUBJ_IC.find(([re]) => re.test(n)) || [, 'book'])[1]}"/></svg>`;
// 나이스 원문 정리: '* 영상 CG작업' 같은 앞 기호·'[보강]' 꼬리표 제거, 끝의 '(3학년)' 제거,
// '대수능 모의학력평가' → '수능 모의평가'(수능 모의고사라는 뜻은 살리고 짧게, 2026-10-24)
const subjName = s => String(s || '').replace(/^\s*\[[^\]]*\]/, '').replace(/^[\s*#·-]+/, '').replace(/\s*\(\d학년\)\s*$/, '')
  .replace(/^대(?:학)?수(?:학)?능(?:력시험)?\s*모의\s*(?:학력)?평가$/, '수능 모의평가').trim();
const needClass = empty('반을 설정하면 시간표가 보여요 · <button class="link" data-open-class>설정하기</button>');
// 홈 시간표에 보여 줄 날: 오늘 마지막 교시가 끝나면 다음 등교일, 다음 날 0시부터는 그날(=오늘)
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
// 주간 시간표가 보여 줄 주 = 홈 시간표가 보여 주는 날(ttTarget)의 주 — 금요일 마지막 교시가 끝나면 바로 다음 주(쉬는 주면 그다음 등교 주)
// 자동으로 따라가던 표만 옮김(사용자가 ‹ ›로 다른 주를 보고 있으면 그대로 둠)
function syncAutoWeek() {
  const w = weekOf(ttTarget()), old = S.autoWk; S.autoWk = w;
  if (old && ymd(old) === ymd(w)) return;
  const was = d => !old || (d && ymd(d) === ymd(old));
  S.homeWeek = w;
  if (S.ttWk && was(S.ttWk)) S.ttWk = w;
  if (was(S.ttWeek)) { S.ttWeek = w; if (old) renderTTView(); }
}
async function renderHomeTT() {
  syncAutoWeek();
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
      ? `<ul class="tt">${ttBlocks(rows).map(([a, z, nm]) => `<li data-p="${a}" data-p2="${z}"${z > a ? ' class="multi"' : ''}><span class="p">${a}${z > a ? `<small>~${z}</small>` : ''}</span>${bellAt(a)}<span class="s"><i class="si" aria-hidden="true">${subjIcon(nm)}</i><span class="sn">${esc(nm)}</span>${z > a ? `<i class="x2">${z - a + 1}시간</i>` : ''}</span></li>`).join('')}</ul>` + (api.hasKey ? '' : '<p class="note">5교시까지만 표시돼요</p>')
      : empty(`${ttLabel(tgt)} 시간표 정보가 아직 없어요`);
  } catch { if (seq === ttSeq) { S.todayTT = []; box.innerHTML = empty('시간표를 불러오지 못했어요'); } }
  nextKey = '';   // 지금/끝난 교시 표시 다시 그리기
}
// 같은 과목이 이어지면 한 줄로 묶음 (점심 앞뒤 4·5교시는 안 묶음) — 주간 표와 같은 규칙. [시작 교시, 끝 교시, 과목]
function ttBlocks(rows) {
  const out = [];
  for (const r of rows) {
    const p = +r.PERIO, nm = subjName(r.ITRT_CNTNT), last = out[out.length - 1];
    if (last && last[2] === nm && last[1] === p - 1 && p !== 5) last[1] = p; else out.push([p, p, nm]);
  }
  return out;
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
/* ===== 첫 화면 급식판·시간표: 가장자리 서랍 (가로 화면 1000px 이상) =====
   2026-10-24: 세로 태블릿(800×1280)·좁은 창에서 서랍 카드가 시계 상태 줄을 덮던 문제 → 시계 양옆 자리가 넉넉한 가로 화면에서만 서랍,
   그 밖(세로 태블릿 등)은 시계 아래 2단(700~1279px CSS) · 700px 미만은 세로 한 줄 */
// 핀 = 꺼낸 그 자리에 고정(기기별 저장). 핀이 없으면 탭으로 꺼내고, 바깥을 누르면 들어감. 첫 화면 아래로 내려가면 잠시 접힘.
const SIDE = { meal: { el: $('.s-meal'), name: '급식판' }, tt: { el: $('.s-ttc'), name: '시간표' } };
const wideMQ = matchMedia('(min-width:1000px) and (min-aspect-ratio:1/1)');
function paintSide(k) {
  const { el, name } = SIDE[k], open = el.classList.contains('open');
  const t = el.querySelector('.s-tab'); t.setAttribute('aria-expanded', String(open));
  t.setAttribute('aria-label', open ? `${name} 넣기` : `${name} 꺼내기`);
  const b = el.querySelector('.s-put'); b.dataset.tip = '옆으로 넣기'; b.setAttribute('aria-label', `${name} 옆으로 넣기`);
}
// 꺼낸 서랍은 '옆으로 넣기' 버튼(또는 포스트잇 탭)을 누를 때까지 그대로 둠. 상태는 기기에 기억(side_meal·side_tt: open/closed)
var heroReady;
function setSide(k, open) {
  SIDE[k].el.classList.toggle('open', open);
  store.set('side_' + k, open ? 'open' : 'closed'); paintSide(k);
  if (heroReady) heroLater(true);   // 카드를 꺼내고 넣으면 덩어리 크기가 바뀌므로 다시 가운데로
}
function openSide(k, on) { const el = SIDE[k].el; if (el.classList.contains('stow')) { el.classList.toggle('open', on); paintSide(k); if (heroReady) heroLater(true); } }
function applyDrawers() {
  const on = wideMQ.matches;
  $('#bigclock').classList.toggle('drawers', on);
  // 전체 랭킹은 시간표와 따로 떨어진 카드 (2026-10-25 하율): 서랍 화면에선 시간표 카드 안에 두되 아래로 띄워(absolute) 서랍과 함께 움직이고,
  // 좁은 화면에선 시간표 카드 바로 다음 칸으로 꺼냄
  const rk = $('#sRk'), tt = SIDE.tt.el;
  if (rk) { if (on) { if (rk.parentNode !== tt) tt.appendChild(rk); } else if (rk.previousElementSibling !== tt) tt.after(rk); }
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
const HERO_PARTS = '.s-greet .bubble, #bellLbl, #bigTime, .clock .dk, #more, #hFr';   // #hFr: 첫 화면 친구 띠(2026-10-25)
// force=false(글자 폭 변화 등)일 땐 6px 미만 차이는 무시 → 말풍선 흔들림·별 반짝임 때문에 다시 잴 때마다 1~3px씩 튀던 문제 방지
function centerHero(force) {
  const st = HERO.style;
  if (!HERO.classList.contains('drawers')) { st.removeProperty('--hx'); st.removeProperty('--hy'); st.removeProperty('--hcy'); return; }
  if (!force && document.documentElement.classList.contains('tuck')) return;   // 첫 화면을 안 보고 있을 땐 안 잼
  if (document.documentElement.classList.contains('boot')) return;   // 등장 애니메이션 중엔 크기가 변하므로 안 잼
  const hx = parseFloat(st.getPropertyValue('--hx')) || 0, hy = parseFloat(st.getPropertyValue('--hy')) || 0;
  const bob = new DOMMatrix(getComputedStyle($('.s-greet')).transform).f;   // 말풍선 위아래 흔들림 값은 빼고 잼
  // 옮기기 전(정렬값 빼고) 위치로 잼 — --hx/--hy 대신 '지금 실제로 적용 중인' translate를 뺌.
  // translate가 전환 애니메이션 중일 때 재면 서랍 높이(--hcy)가 엉뚱하게 굳던 문제 (2026-10-24)
  const offOf = el => { const p = el.closest('.s-greet,.s-what,.clock,.s-info,.s-fr'); const t = p ? getComputedStyle(p).translate : 'none';
    if (!t || t === 'none') return [0, 0]; const [x, y] = t.split(' '); return [parseFloat(x) || 0, parseFloat(y) || 0]; };
  let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
  for (const el of HERO.querySelectorAll(HERO_PARTS)) {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    const [ox, oy0] = offOf(el), oy = oy0 + (el.classList.contains('bubble') ? bob : 0);
    L = Math.min(L, b.left - ox); R = Math.max(R, b.right - ox); T = Math.min(T, b.top - oy); B = Math.max(B, b.bottom - oy);
  }
  if (!isFinite(L)) return;   // 홈이 안 보이는 중
  const sy = scrollY; T += sy; B += sy;   // 옮기기 전 위치(문서 기준)
  // 위 한계: 헤더 아래(헤더는 화면 고정이라 스크롤 값 안 더함, 공지는 위에 겹쳐 뜨므로 제외) / 아래 한계: 밸런스 티켓·▼ 버튼·첫 화면 끝 중 가장 위
  const hdr = $('header')?.getBoundingClientRect().bottom ?? 0, top = hdr + 14;
  let bot = Math.min(HERO.getBoundingClientRect().bottom + sy, innerHeight);
  // 밸런스 티켓 자리는 티켓이 숨어 있어도(주말·휴업일) 항상 비워 둔 것으로 계산 → 평일·주말 모두 '원래 위치'에 고정 (2026-10-24 하율 요청)
  // 숨은 요소는 잴 수 없으므로(전역 [hidden]{display:none!important}) 티켓 자리를 '첫 화면 아래 끝 - 티켓 아래 여백 - 티켓 키'로 계산.
  // 티켓 키는 보였을 때 잰 값을 기억(localStorage), 한 번도 못 쟀으면 기본값 146px(1512×862에서 실측)
  const tk = $('#play');
  if (!tk.hidden && tk.offsetHeight) { TK_H = tk.offsetHeight; store.set('tk_h', TK_H); }
  if (!TK_H) TK_H = +store.get('tk_h', 0) || 146;
  const tkGap = parseFloat(getComputedStyle(tk).bottom) || 60;
  bot = Math.min(bot, HERO.getBoundingClientRect().bottom + sy - tkGap - TK_H);
  const dn = $('#goDown'); if (dn.offsetParent) bot = Math.min(bot, dn.getBoundingClientRect().top + sy);
  bot -= 14;
  // 세로: 헤더 아래 ~ 티켓 위 빈 공간의 가운데에 시계 묶음(말풍선~상태 줄)의 가운데 — 원래 규칙 그대로
  let cT = Infinity, cB = -Infinity;
  for (const el of HERO.querySelectorAll('#bigTime, #more')) { const b = el.getBoundingClientRect(), oy = offOf(el)[1]; if (b.height) { cT = Math.min(cT, b.top - oy); cB = Math.max(cB, b.bottom - oy); } }
  const cMid = isFinite(cT) ? (cT + cB) / 2 + sy : (T + B) / 2;   // 카드 가운데가 맞춰질 높이(옮기기 전, 문서 기준)
  const dh = Math.max(SIDE.meal.el.offsetHeight, SIDE.tt.el.offsetHeight) / 2;
  let dx = Math.round(innerWidth / 2 - (L + R) / 2), dy = (top + bot) / 2 - (T + B) / 2;
  if (B + dy > bot) dy = bot - B;
  if (T + dy < top) dy = Math.min(0, top - T);
  dy = Math.round(dy);
  // 작은 차이는 무시하되, 서랍 높이(--hcy)는 아래에서 항상 다시 맞춤 (2026-10-23: 첫 계산이 등장 중 값으로 굳어 서랍이 위로 떠 있던 문제)
  if (!force && Math.abs(dx - hx) < 6 && Math.abs(dy - hy) < 6) { dx = hx; dy = hy; }
  if (dx !== hx) st.setProperty('--hx', dx + 'px');
  if (dy !== hy) st.setProperty('--hy', dy + 'px');
  // 좌우 서랍은 큰 시계 + 상태 줄의 가운데와 같은 높이 (말풍선까지 넣으면 카드가 위로 떠 보임 — 2026-10-23). 헤더·화면 아래에 걸리면 화면 가운데로
  const cy = Math.round(cMid + dy);
  if (cy - dh >= hdr + 8 && cy + dh <= innerHeight - 8) st.setProperty('--hcy', cy + 'px'); else st.removeProperty('--hcy');
  // 시간표는 시계와 같은 높이 가운데. 아래 랭킹 카드가 메시지 버튼·화면 아래에 걸릴 때만 그만큼 시간표째 위로 올림(--rkup)
  const rk = $('#sRk'), tt = SIDE.tt.el; let up = 0;
  if (rk && !rk.hidden && tt.classList.contains('open') && st.getPropertyValue('--hcy')) {
    const dock = $('#dmDock'), lim = (dock && dock.offsetParent ? dock.getBoundingClientRect().top : innerHeight) - 10;
    const th = tt.offsetHeight, over = cy + th / 2 + 16 + rk.offsetHeight - lim;
    if (over > 0) up = Math.min(over, Math.max(0, cy - th / 2 - (hdr + 10)));
  }
  st.setProperty('--rkup', Math.round(up) + 'px');
}
let heroRaf = 0, heroForce = false, TK_H = 0;
heroReady = true;   // var(호이스팅) — 이 줄 전에 setSide가 불려도 오류 없이 건너뜀
const heroLater = force => { heroForce ||= force === true; cancelAnimationFrame(heroRaf); heroRaf = requestAnimationFrame(() => { const f = heroForce; heroForce = false; centerHero(f); }); };
const heroResize = () => heroLater(true);
addEventListener('resize', heroResize); wideMQ.addEventListener('change', heroResize);
const heroRO = new ResizeObserver(() => heroLater()); for (const s of ['#bigTime', '#more', '#greet', '#play', '#hFr', '#sRk']) heroRO.observe($(s));
new MutationObserver(() => heroLater()).observe($('#play'), { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(() => heroLater()).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });   // 첫 화면으로 돌아오면 밀린 계산 반영
document.fonts?.ready.then(heroResize); heroResize();
new IntersectionObserver(([e]) => document.documentElement.classList.toggle('tuck', !e.isIntersecting), { threshold: .6 }).observe($('#bigclock'));
// 조금이라도 내려가면 헤더에 바탕을 깔아 아래 내용과 겹쳐 보이지 않게 (2026-10-24)
// 휴대폰 폭에선 아래로 내리는 동안 아래 고정 버튼(서비스·메시지)을 숨겨 내용을 가리지 않게, 올리면 다시 보임
{ let q = 0, lastY = scrollY; const de = document.documentElement, narrow = matchMedia('(max-width:699px)');
  const f = () => { q = 0; const y = scrollY; de.classList.toggle('hbg', y > 24); if (Math.abs(y - lastY) > 6) { de.classList.toggle('fabhide', narrow.matches && y > lastY && y > 80); lastY = y; } };
  addEventListener('scroll', () => { if (!q) q = requestAnimationFrame(f); }, { passive: true }); f(); }
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
  // 끝 낱말(' 시간표'·' 급식')은 따로 감싸서, 서랍이 좁으면 CSS가 숨김 → 라벨이 넘쳐 '다음 ›' 버튼을 덮던 문제(2026-10-24) 방지
  const m = /^(.*?)( (?:시간표|급식))$/.exec(text);
  el.textContent = '';
  const a = document.createElement('span'); a.className = 'lt'; a.textContent = m ? m[1] : text; el.append(a);
  if (m) { const b = document.createElement('span'); b.className = 'lw'; b.textContent = m[2]; el.append(b); }
  el.classList.toggle('off', off); el.classList.toggle('wkon', wk);
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
  else if (b.dataset.nav === 'meal') { const base = autoMealDay() || today(), nd = stepSchool(S.sMealDay || base, k); S.sMealDay = ymd(nd) === ymd(base) ? null : nd; S.heroPick = null; loadHeroDay(); }
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
// 급식·시간표는 각자 칸(pane)을 따로 두고 보이기만 바꿈 → 탭을 오가도 다시 불러오지 않고, 창 크기·위치가 그대로(2026-10-24 전환 버그 수정)
const ALL = { tab: 'meal', mon: null, key: { meal: '', tt: '' } };
function weekOf(d) { return mondayOf(addDays(d, d.getDay() === 6 ? 2 : d.getDay() === 0 ? 1 : 0)); }
function wkResize() { try { heroResize(); } catch {} }   // 한 주 모드로 카드 높이가 바뀌면 서랍 세로 위치 다시 계산
function openAll(tab, day) { ALL.tab = tab; ALL.mon = weekOf(day); openModal('#mAll'); renderAll(); }
function allPane(tab) {
  let p = $(`#allBody > [data-pane="${tab}"]`);
  if (!p) { p = document.createElement('div'); p.dataset.pane = tab; p.className = 'all-pane'; p.setAttribute('role', 'tabpanel'); $('#allBody').append(p); }
  return p;
}
function allKey(tab) { return ymd(ALL.mon) + '|' + ymd(today()) + (tab === 'tt' ? '|' + (cls ? cls.g + '-' + cls.c : '') : ''); }
function renderAll() {
  const mon = ALL.mon, tab = ALL.tab, w = diffDays(mon, weekOf(today())) / 7;
  $$('#mAll [data-all]').forEach(b => { const on = b.dataset.all === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $('#allLbl').innerHTML = `${weekLbl(mon)}<small>${w === 0 ? '이번 주' : w === 1 ? '다음 주' : w === -1 ? '지난주' : w > 0 ? w + '주 뒤' : -w + '주 전'}</small>`;
  $('#allT').textContent = tab === 'tt' ? (cls ? `${cls.g}학년 ${cls.c}반 시간표` : '시간표') : '한 주 급식';
  ['meal', 'tt'].forEach(t => { allPane(t).hidden = t !== tab; });
  const p = allPane(tab), key = allKey(tab);
  if (ALL.key[tab] === key && !p.dataset.fail) return;   // 이미 그린 주면 보이기만
  ALL.key[tab] = key; delete p.dataset.fail; p.scrollTop = 0; p.scrollLeft = 0;
  const stale = () => ALL.key[tab] !== key;
  if (tab === 'tt') fillWeek(p, mon, stale).then(() => { if (!stale() && !p.querySelector('table')) p.dataset.fail = '1'; });   // 못 불러왔으면 다음에 다시 시도
  else paintAllMeal(p, mon, stale);
}
async function paintAllMeal(box, mon, stale) {
  box.innerHTML = `<div class="mw">${skel(5)}</div>`;
  try {
    const rows = await getMealsRange(mon, addDays(mon, 4));
    if (stale()) return;
    const t = ymd(today());
    box.innerHTML = '<div class="mw">' + [0, 1, 2, 3, 4].map(i => {
      const d = addDays(mon, i), k = ymd(d);
      const ms = rows.filter(r => r.MLSV_YMD === k && MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
      return `<section class="mw-d${k === t ? ' today' : ''}"><h4><b>${d.getMonth() + 1}/${d.getDate()}</b>${DOW[d.getDay()]}${k === t ? '<em>오늘</em>' : ''}</h4>`
        + (ms.length ? ms.map(r => `<div class="mw-m"><h5>${MEALS[r.MMEAL_SC_CODE]}${r.CAL_INFO ? `<span>${esc(r.CAL_INFO)}</span>` : ''}</h5><ul>${cleanDish(r.DDISH_NM).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') : '<p class="mw-no">급식 없음</p>')
        + '</section>';
    }).join('') + '</div>';
  } catch { if (!stale()) { box.innerHTML = empty('급식 정보를 불러오지 못했어요'); box.dataset.fail = '1'; } }
}
$$('#mAll [data-all]').forEach(b => b.onclick = () => { if (ALL.tab === b.dataset.all) return; ALL.tab = b.dataset.all; renderAll(); });
$('#allPrev').onclick = () => { ALL.mon = addDays(ALL.mon, -7); renderAll(); };
$('#allNext').onclick = () => { ALL.mon = addDays(ALL.mon, 7); renderAll(); };
weekPick('#allLbl', () => ALL.mon, m => { ALL.mon = m; renderAll(); });
$('#goMeal').onclick = e => { e.stopPropagation(); openAll('meal', S.mealWk || S.sMealDay || autoMealDay() || today()); };
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
// 달 넘김 애니메이션(2026-10-25): 칸들이 넘기는 방향으로 빠지고 → 새 달 칸들이 반대쪽에서 줄마다 살짝 늦게 들어옴. 요일 머리(.dh)는 고정
const calRM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let calSeq = 0, calOut = null;
const calCells = g => [...g.querySelectorAll('.dy')];
// 이미 있는 칸은 그대로 두고 내용·속성만 바꿈 → 들어오는 애니메이션이 끊기지 않음
function calPatch(grid, html) {
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  if (tmp.children.length !== grid.children.length) { grid.innerHTML = html; return; }
  [...grid.children].forEach((el, i) => {
    const n = tmp.children[i];
    [...el.attributes].forEach(a => { if (!n.hasAttribute(a.name)) el.removeAttribute(a.name); });
    [...n.attributes].forEach(a => { if (el.getAttribute(a.name) !== a.value) el.setAttribute(a.name, a.value); });
    if (el.innerHTML !== n.innerHTML) el.innerHTML = n.innerHTML;
  });
}
async function calSwap(grid, getHtml, dir) {
  const seq = ++calSeq, anim = dir && !calRM() && !document.hidden;
  if (anim) {
    if (!calOut) {   // 빠지는 중에 또 누르면 다시 빼지 않고 이어서 새 달로
      calOut = Promise.all(calCells(grid).filter(c => !c.classList.contains('pad')).map(c =>
        c.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 26}px)`, opacity: 0 }],
          { duration: 140, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.catch(() => {})));
    }
    await calOut; calOut = null;
    if (seq !== calSeq) return;
  }
  grid.innerHTML = getHtml();
  if (!anim) return;
  calCells(grid).forEach((c, i) => {
    if (c.classList.contains('pad')) return;
    c.animate([{ transform: `translateX(${dir * 34}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 320, delay: Math.floor(i / 7) * 24, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
  });
}
async function renderCalView(dir) {
  dir = typeof dir === 'number' ? dir : 0;   // 화면 이동(go)에선 문자열 인자가 옴 → 애니메이션 없음
  const m = S.calMonth, end = new Date(m.getFullYear(), m.getMonth() + 1, 0), box = $('#cList'), grid = $('#cGrid');
  $('#cLbl').textContent = `${m.getFullYear()}년 ${m.getMonth() + 1}월`;
  if (dir && !calRM()) $('#cLbl').animate([{ transform: `translateX(${dir * 10}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,.9,.25,1)' });
  let rows = null;
  const req = getSchedule(m, end).then(r => (rows = r));
  req.catch(() => {});
  const swap = calSwap(grid, () => calHtml(m, rows || []), dir);
  box.innerHTML = skel(4);
  try {
    await req;
    await swap;
    if (m !== S.calMonth) return;
    calPatch(grid, calHtml(m, rows));
    // 목록은 오늘(D-DAY)·다가오는 일정부터 위→아래, 지난 일정은 맨 아래에 최근 것부터
    const t = today(), up = rows.filter(r => parseYmd(r.AA_YMD) >= t), past = rows.filter(r => parseYmd(r.AA_YMD) < t).reverse();
    box.innerHTML = rows.length ? (up.length ? evHtml(up) : '') + (past.length ? `<p class="ev-sep">지난 일정</p>${evHtml(past)}` : '') : empty('이 달에는 일정이 없어요');
  } catch { if (m === S.calMonth) box.innerHTML = empty('일정을 불러오지 못했어요'); }
}
const calGo = n => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + n, 1); renderCalView(Math.sign(n)); };
$('#cPrev').onclick = () => calGo(-1);
$('#cNext').onclick = () => calGo(1);
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
    const prev = S.calMonth;
    S.calMonth = b.dataset.today ? new Date(t.getFullYear(), t.getMonth(), 1) : new Date(y, +b.dataset.m, 1);
    closeMonthPick(); renderCalView(Math.sign(S.calMonth - prev));
  };
  $('#cLbl').after(box); $('#cLbl').setAttribute('aria-expanded', 'true');
  box.querySelector('.on, .now, [data-m]').focus();
};
document.addEventListener('click', () => { if ($('#cPick')) closeMonthPick(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#cPick')) { closeMonthPick(); $('#cLbl').focus(); } });

/* ===== D-day ===== */
const byDate = (a, b) => a.date.localeCompare(b.date);
function ddayListHtml(list) {   // list: [{ name, date, i?, off? }] — 홈 '다가오는 일정'과 같은 스티커 카드(첫 개만 큰 카드), i가 있으면 삭제 버튼
  const t = today();
  if (!list.length) return empty('아직 D-day가 없어요');
  return `<div class="uprow dd">${list.map((x, k) => {
    const d = parseYmd(x.date);
    const del = x.i == null ? '' : `<button class="x" data-del="${x.i}" aria-label="${esc(x.name)} 삭제">✕</button>`;
    const tag = x.off ? '<em class="tag off">쉬는 날</em>' : '';
    return `<div class="up${k === 0 ? ' first' : ''}"><b class="num">${ddayText(diffDays(d, t))}</b><div class="txt"><p class="nm">${esc(x.name)}</p><span class="dt">${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})</span></div>${tag}${del}</div>`;
  }).join('')}</div>`;
}
// 홈 '다가오는 일정': 학교 일정 + 내 D-day를 날짜순으로 한 줄에 (큰 D-숫자 타일)
async function renderHomeDday() {
  const box = $('#hUp'), t = today();
  const mine = myDdays().filter(x => parseYmd(x.date) >= t).map(x => ({ ...x, mine: true }));
  let school = [], fail = false;
  try {
    school = (await loadUpcoming()).filter(r => !r.swap).map(r => ({ name: r.EVENT_NM, date: r.AA_YMD, off: isOff(r) }));
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
  $$('#hUp .up').forEach((el, i) => { el.hidden = i >= 5; });
}
addEventListener('resize', fitUp);
async function renderDdayView() {
  $('#dMine').innerHTML = ddayListHtml(myDdays().map((x, i) => ({ ...x, i })).sort(byDate));
  $('#dSchool').innerHTML = skel(3);
  try {
    $('#dSchool').innerHTML = ddayListHtml((await loadUpcoming()).filter(r => !r.swap).slice(0, 8).map(r => ({ name: r.EVENT_NM, date: r.AA_YMD, off: isOff(r) })));
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

/* ===== 카운트다운: 방학까지 · 성인까지 (2026-10-24) ===== */
// 방학: 나이스 학사일정의 '방학식'·'종업식'(방학 시작)과 '개학'·'시업식'·'입학식'(학기 시작)으로 계산 — 앞뒤 200일을 한 번에 받음(키 없으면 60일)
// 성인: 기본은 학년으로 태어난 해를 추정(학년도 − 15 − 학년) → 19살 되는 해 1월 1일 0시(청소년보호법 기준 연 나이).
//       생일을 넣으면(이 기기에만 저장 'birth') 그 해로 계산하고 만 19세 생일(민법상 성년)도 같이 보여 줌
let longSched = null;
const loadLong = () => {
  if (!longSched) longSched = (api.hasKey ? getSchedule(addDays(today(), -200), addDays(today(), 200)) : loadUpcoming()).catch(e => { longSched = null; throw e; });
  return longSched;
};
const VAC_RE = /방학식|종업식/, OPEN_RE = /개학|시업식|입학식/;
const CD = { vac: null, adult: null, man: null };   // 1초마다 줄어드는 목표 시각(Date)
const fmtD = d => `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
const vacName = (d, nm) => /종업식/.test(nm) && d.getMonth() === 1 ? '봄방학' : d.getMonth() >= 4 && d.getMonth() <= 8 ? '여름방학' : '겨울방학';
const cdLeft = (at, n) => {   // '59일 08:12:33'
  const ms = at - n; if (ms <= 0) return '';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  return `${d ? d + '일 ' : ''}${pad(Math.floor(s % 86400 / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
};
const vacIc = v => v && v.name === '여름방학' ? 'beach' : 'snow';   // 여름은 해·파라솔, 겨울·봄방학(2월)은 눈사람 (2026-10-24)
function vacInfo(rows) {
  const t = today(), tk = ymd(t);
  const ev = rows.filter(r => VAC_RE.test(r.EVENT_NM) || OPEN_RE.test(r.EVENT_NM)).sort((a, b) => a.AA_YMD < b.AA_YMD ? -1 : 1);
  const lastV = [...ev].reverse().find(r => VAC_RE.test(r.EVENT_NM) && r.AA_YMD < tk);
  if (lastV && diffDays(t, parseYmd(lastV.AA_YMD)) <= 80) {   // 방학식이 지났고 개학 전이면 방학 중 (출석 inVac과 같은 최대 80일)
    const k = ev.find(r => /개학/.test(r.EVENT_NM) && r.AA_YMD > lastV.AA_YMD);
    if (!k || k.AA_YMD > tk) return { on: true, name: vacName(parseYmd(lastV.AA_YMD), lastV.EVENT_NM), k: k ? parseYmd(k.AA_YMD) : null };
  }
  const v = ev.find(r => VAC_RE.test(r.EVENT_NM) && r.AA_YMD >= tk);
  if (!v) return null;
  const vd = parseYmd(v.AA_YMD), st = [...ev].reverse().find(r => OPEN_RE.test(r.EVENT_NM) && r.AA_YMD <= tk);
  // 남은 등교일: 오늘(마지막 교시 전이면)부터 방학식 날까지 평일 중 휴업일·공휴일 빼고
  const off = new Set(rows.filter(isOff).map(r => r.AA_YMD));
  const n = now(), sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  const endT = (BELL.find(x => x.p === lastPeriod(t)) || BELL[BELL.length - 1]).end;
  let left = 0;
  for (let d = new Date(t); d <= vd; d = addDays(d, 1)) {
    if (!(d.getDay() % 6) || off.has(ymd(d)) || offDays.has(ymd(d))) continue;
    if (ymd(d) === tk && sec >= endT) continue;
    left++;
  }
  const s = st ? parseYmd(st.AA_YMD) : null, span = s ? diffDays(vd, s) : 0;
  return { on: false, name: vacName(vd, v.EVENT_NM), ev: /종업식/.test(v.EVENT_NM) ? '종업식' : '방학식', d: vd, left, pct: span > 0 ? Math.min(100, Math.max(0, Math.round(diffDays(t, s) / span * 100))) : null };
}
function adultInfo() {
  const b = store.get('birth', ''), t = today();
  let by, est = false;
  if (isYmd(b)) by = +b.slice(0, 4);
  else if (cls && +cls.g >= 1 && +cls.g <= 3) { by = (t.getMonth() < 2 ? t.getFullYear() - 1 : t.getFullYear()) - 15 - +cls.g; est = true; }   // 학년도는 3월에 바뀜
  else return null;
  return { yeon: new Date(by + 19, 0, 1), man: isYmd(b) ? new Date(by + 19, +b.slice(4, 6) - 1, +b.slice(6, 8)) : null, est, g: cls?.g };
}
async function renderCountdown() {
  const vb = $('#cdVac'), ab = $('#cdAdult'); if (!vb) return;
  const t = today();
  // ── 성인까지
  const a = adultInfo();
  CD.adult = CD.man = null;
  if (!a) ab.innerHTML = `<svg class="cdic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-cake"/></svg><div class="cdm"><p class="cdk">성인까지</p><p class="cds">반을 설정하거나 생일을 넣으면 계산해요</p><span class="cdb"><button class="link" type="button" data-open-class>반 설정</button><button class="link" type="button" data-birth>생일 넣기</button></span></div>`;
  else {
    const n1 = diffDays(a.yeon, t), done = n1 <= 0, n2 = a.man ? diffDays(a.man, t) : null;
    if (!done) CD.adult = a.yeon; else if (n2 > 0) CD.man = a.man;
    const big = !done ? ddayText(n1) : n2 > 0 ? ddayText(n2) : '성인!';
    const sub = !done ? `${a.yeon.getFullYear()}년 1월 1일 0시 · 19살 되는 해`
      : n2 > 0 ? `만 19세 생일 ${a.man.getFullYear()}년 ${fmtD(a.man)} · 민법상 성년` : `${a.yeon.getFullYear()}년부터 성인이에요`;
    const man = !done && a.man ? `<p class="cdx">만 19세 생일(민법상 성년) <b>${ddayText(n2)}</b> · ${a.man.getFullYear()}.${a.man.getMonth() + 1}.${a.man.getDate()}</p>` : '';
    ab.innerHTML = `<svg class="cdic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-cake"/></svg><div class="cdm"><p class="cdk">${done && !(n2 > 0) ? '성인 됐어요' : '성인까지'}</p><b class="cdn">${big}</b><span class="cdl" id="cdAL"></span></div>`
      + `<div class="cdsub"><p class="cds">${sub}</p>${man}<span class="cdb"><em>${a.est ? `${a.g}학년 기준` : '내 생일 기준'}</em><button class="link" type="button" data-birth>${a.est ? '생일 넣기' : '생일 바꾸기'}</button></span></div>`;
  }
  ab.insertAdjacentHTML('beforeend', `<form class="cdform" id="cdForm" hidden><input type="date" id="cdBirth" aria-label="생일" min="1990-01-01" max="2020-12-31" value="${isYmd(store.get('birth', '')) ? store.get('birth').replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3') : ''}"><button class="btn" type="submit">저장</button>${isYmd(store.get('birth', '')) ? '<button class="link" type="button" data-birth-clear>지우기</button>' : ''}<span class="note">이 기기에만 저장돼요</span></form>`);
  // ── 방학까지
  let v = null, fail = false;
  try { v = vacInfo(await loadLong()); } catch { fail = true; }
  CD.vac = null;
  if (!v) vb.innerHTML = `<svg class="cdic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${vacIc(v)}"/></svg><div class="cdm"><p class="cdk">방학까지</p><p class="cds">${fail ? '일정을 불러오지 못했어요' : '학사일정에 아직 방학식이 안 올라왔어요'}</p></div>`;
  else if (v.on) {
    if (v.k) CD.vac = v.k;
    vb.innerHTML = `<svg class="cdic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${vacIc(v)}"/></svg><div class="cdm"><p class="cdk">${v.name} 중 · 개학까지</p><b class="cdn">${v.k ? ddayText(diffDays(v.k, t)) : '방학!'}</b><span class="cdl" id="cdVL"></span></div>`
      + `<div class="cdsub"><p class="cds">${v.k ? `개학 ${fmtD(v.k)}` : '개학 날짜가 아직 안 올라왔어요'}</p><p class="cdx">푹 쉬어요</p></div>`;
  } else {
    const n = diffDays(v.d, t);
    if (n > 0) CD.vac = v.d;
    const bar = v.pct == null ? '' : `<div class="cdbar" role="img" aria-label="이번 학기 ${v.pct}% 지남"><i></i></div><p class="cdx">이번 학기 <b>${v.pct}%</b> 지남</p>`;
    vb.innerHTML = `<svg class="cdic" viewBox="0 0 24 24" aria-hidden="true"><use href="#sj-${vacIc(v)}"/></svg><div class="cdm"><p class="cdk">${n ? v.name + '까지' : '오늘 ' + v.ev + '!'}</p><b class="cdn">${ddayText(n)}</b><span class="cdl" id="cdVL"></span></div>`
      + `<div class="cdsub"><p class="cds">${v.ev} ${fmtD(v.d)} · 학교 갈 날 <b>${v.left}일</b></p>${bar}</div>`;
    const i = vb.querySelector('.cdbar i'); if (i) i.style.width = v.pct + '%';   // CSP: style 속성 대신 JS로
  }
  cdTick(now());
}
function cdTick(n) {
  const a = $('#cdAL'), v = $('#cdVL');
  if (a) a.textContent = cdLeft(CD.adult || CD.man, n);
  if (v) v.textContent = cdLeft(CD.vac, n);
  if ((CD.vac && CD.vac <= n) || (CD.adult && CD.adult <= n) || (CD.man && CD.man <= n)) { CD.vac = CD.adult = CD.man = null; renderCountdown(); }   // 0시가 되는 순간 다시 그림
}
$('#cdCard')?.addEventListener('click', e => {
  if (e.target.closest('[data-birth]')) { const f = $('#cdForm'); f.hidden = !f.hidden; if (!f.hidden) $('#cdBirth').focus(); }
  else if (e.target.closest('[data-birth-clear]')) { store.set('birth', ''); renderCountdown(); toast('생일을 지웠어요'); }
});
$('#cdCard')?.addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#cdBirth').value.replace(/-/g, '');
  if (!isYmd(v) || +v.slice(0, 4) < 1990 || +v.slice(0, 4) > 2020) { toast('생일을 확인해 주세요'); return; }
  store.set('birth', v); renderCountdown(); toast('저장했어요');
});

/* ===== 모달 공통 ===== */
let lastFocus = null;
// 창이 하나라도 열려 있으면 뒤 화면 스크롤을 잠금(html.modal-lock) — 창 안(.sheet)만 스크롤됨
const syncModalLock = () => document.documentElement.classList.toggle('modal-lock', !!document.querySelector('.modal.open'));
// 닫을 때: 창(.sheet)이 아래로 내려가며 사라진 뒤 닫힘(.out, 0.26초). 그 사이 다시 열면 닫기를 취소
const openModal = SOC.openModal = id => { lastFocus = document.activeElement; const m = $(id); clearTimeout(m._out); m.classList.remove('out'); m.classList.add('open'); syncModalLock(); [...m.querySelectorAll('button, select')].find(el => !el.hidden)?.focus(); };
const closeModal = SOC.closeModal = m => {
  if (!m.classList.contains('open') || m.classList.contains('out')) return;
  const done = () => { m.classList.remove('open', 'out'); syncModalLock(); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !m.querySelector('.sheet')) done();
  else { m.classList.add('out'); m._out = setTimeout(done, 260); }
  lastFocus?.focus?.();
};
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
/* 가입·로그인한 계정에 학년·반이 있으면 이 기기 반 설정으로 그대로 씀 (2026-10-24: 가입 때 고른 반이 시간표에 안 들어가고
   다음 접속 때 반 설정 창이 1학년 1반으로 뜨던 문제). 기기에 이미 반이 있으면 건드리지 않음. 프로필에서 학년·반을 바꾸면 force로 따라감 */
function adoptClass(me, force) {
  if (!me || (cls && !force)) return;
  const next = validClass({ g: String(me.grade || ''), c: String(me.cls || '') });
  if (!next || (cls && cls.g === next.g && cls.c === next.c)) return;
  cls = next; store.set('class', cls);
  if ($('#mClass').classList.contains('open')) closeModal($('#mClass'));
  renderClassChip(); renderHomeTT(); renderCountdown();
  if ($('#v-tt').classList.contains('on')) renderTTView();
}
SOC.adoptClass = adoptClass;
$('#btnClass').onclick = openClass;
document.addEventListener('click', e => { if (e.target.closest('[data-open-class]')) openClass(); });
$('#saveClass').onclick = () => {
  const next = validClass({ g: $('#selG').value, c: $('#selC').value });
  if (!next) return;
  if (cls && cls.g === next.g && cls.c === next.c) next.dep = cls.dep;
  cls = next; store.set('class', cls);
  closeModal($('#mClass')); renderClassChip(); renderHomeTT(); renderCountdown();
  if ($('#v-tt').classList.contains('on')) renderTTView();
  toast(`${cls.g}학년 ${cls.c}반으로 설정했어요`);
};

/* ===== 이용 안내 · 홈 화면에 추가 ===== */
$('#btnInfo').onclick = () => openModal('#mInfo');
$('#btnReport').onclick = () => { if (SOC.report) SOC.report(); else toast('잠시 후 다시 눌러 주세요'); };
initInstall({ openModal });   // 앱으로 설치하기(install.js) — 메뉴 '앱 설치'·소개 화면·이용 안내·한 번 뜨는 권유 카드
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
// 착용 소품(뽑기 전설 '떠 있는 왕관' 등, wear.js): 소품과 부착 지점을 나눔 — 캐릭터 머리 · 큰 시계 첫 숫자 · 로고 G.
// '자동'이면 캐릭터(테마 캐릭터·내 그림)가 있으면 머리, 없으면 시계. html[data-mfx]=켠 소품 값(social.js applyFx), html[data-wear-spot]=실제 지점(버튼 data-wear-at과 이름이 겹치면 클릭 위임이 html까지 잡으므로 다르게).
const mfxV = () => document.documentElement.dataset.mfx || '';
const hasChar = () => !!lsGet(MYART) || CHAR_SET.has(document.documentElement.dataset.skin || '');
const wearSpot = () => mfxV() ? resolveSpot(spotPref(), hasChar()) : '';
document.addEventListener('sg:mfx', () => syncMascot());
function syncWear(spot) {
  const v = mfxV(), h = document.documentElement;
  if (spot) h.dataset.wearSpot = spot; else delete h.dataset.wearSpot;
  for (const [host, at, cls] of [[$('#bigclock .clock'), 'clock', 'wear-ck'], [$('.logo'), 'logo', 'wear-lg']]) {
    if (!host) continue;
    let w = host.querySelector(':scope > .' + cls);
    if (spot !== at) { w?.remove(); continue; }
    if (!w || w.dataset.v !== v) { w?.remove(); host.insertAdjacentHTML('beforeend', `<i class="${cls}" data-v="${esc(v)}" aria-hidden="true">${wearSvg(v)}</i>`); }
  }
  if (spot === 'clock') placeClockWear();
}
// 시계: 첫 숫자 위에 비스듬히 얹음. 숫자 자리는 '오후' 글자·카운트다운 형식·글씨 크기에 따라 바뀌어서 잼(offset 계산 = 흔들림 애니메이션 영향 없음)
let ckRaf = 0;
function placeClockWear() {
  cancelAnimationFrame(ckRaf);
  ckRaf = requestAnimationFrame(() => {
    const c = $('#bigclock .clock'), w = c?.querySelector(':scope > .wear-ck'), n = $('#bigTime .n');
    if (!w || !n || !n.offsetWidth) return;
    let x = 0, y = 0;
    for (let e = n; e && e !== c; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; if (!c.contains(e.offsetParent)) break; }
    const fs = parseFloat(getComputedStyle(n).fontSize) || 100;
    w.style.setProperty('--cx', x + n.offsetWidth / 2 + 'px');
    w.style.setProperty('--cy', y + 'px');
    w.style.setProperty('--cf', fs + 'px');
  });
}
{ const bt = $('#bigTime');
  if (bt) { new MutationObserver(() => { if (wearSpot() === 'clock') placeClockWear(); }).observe(bt, { childList: true });
    new ResizeObserver(() => { if (wearSpot() === 'clock') placeClockWear(); }).observe(bt); }
  document.fonts?.ready?.then(() => { if (wearSpot() === 'clock') placeClockWear(); }); }
// 내 그림 캐릭터: 머리 자리(자동 감지 또는 손으로 맞춘 위치)에 소품을 겹쳐 둠
async function placeArtWear(el, art) {
  const w = el.querySelector(':scope > .m-wear'); if (!w) return;
  const p = await anchorOf(art);
  w.style.setProperty('--wx', p.x * 100 + '%'); w.style.setProperty('--wy', p.y * 100 + '%');
}
async function syncMascot(hi) {
  const k = document.documentElement.dataset.skin || '', art = lsGet(MYART);
  let el = document.getElementById('mascot');
  const spot = wearSpot(), mfx = spot === 'mascot' ? mfxV() : '';
  syncWear(spot);
  const key = art ? 'mine:' + art.length + ':' + art.slice(-24) + (mfx ? ':' + mfx : '') : CHAR_SET.has(k) ? k + (mfx ? ':' + mfx : '') : '';
  if (!key) { if (el) el.remove(); return; }
  if (!art) {
    try { mascotMod = mascotMod || await import('./mascots.js'); } catch { return; }
    if ((document.documentElement.dataset.skin || '') !== k || lsGet(MYART)) return;  // 불러오는 사이 바뀜
  }
  if (!el) { el = document.createElement('div'); el.id = 'mascot'; el.className = 'mascot'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
  if (el.dataset.key !== key) {
    el.dataset.key = key; el.dataset.k = art ? '' : k;
    if (art) { const im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = art; el.replaceChildren(im); if (mfx) el.insertAdjacentHTML('beforeend', `<i class="m-wear">${wearSvg(mfx)}</i>`); }
    else { el.innerHTML = mascotMod.MASCOT[k] || ''; if (mfx) (el.querySelector('.mh') || el.querySelector('.mb'))?.insertAdjacentHTML('beforeend', wearG(mfx)); }   // 머리(.mh)에 넣어 고개 짓을 같이 탐(머리 묶음이 없는 캐릭터는 몸)
  }
  if (art && mfx) placeArtWear(el, art);   // 손으로 맞춘 위치가 바뀌어도 다시 그리지 않고 자리만
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
// 띠 공지는 새 공지가 올라오면 한 번 뜨고, ✕를 누르기 전까지 계속 유지. ✕를 누르면 그 공지는 다시 안 뜸.
// 학교 태블릿을 여럿이 같이 쓰니 '닫음'은 계정마다 따로 기억(sg_notice_x:아이디). 다른 공지가 올라오면 다시 뜸.
let noticeWho = '';
const noticeKey = () => 'notice_x' + (noticeWho ? ':' + noticeWho : '');
const noticeClosed = id => store.get(noticeKey()) === id;
async function loadNotice() {
  const box0 = $('#notice');
  if (!noticeWho) { box0.hidden = true; return; }   // 누가 로그인했는지 확인되기 전엔 안 띄움 — 기기 공통 기록으로 먼저 띄웠다가 계정 기록 보고 사라지던 깜빡임 방지
  const who0 = noticeWho;
  let n = null;
  try { const r = await fetch('/api/notice'); if (r.ok) n = (await r.json()).notice; } catch {}
  const box = $('#notice');
  if (who0 !== noticeWho) return;   // 받아 오는 사이 계정이 바뀌었으면 새 호출에 맡김
  if (!n || noticeClosed(n.id)) { box.hidden = true; return; }
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
  $('#noticeX').onclick = () => { store.set(noticeKey(), n.id); box.hidden = true; };
  box.hidden = false;
}

/* ===== 소개 (로그인 전) ===== */
// theme.js가 첫 화면부터 html.prelogin을 붙여 둠 → 로그인 상태가 확인되면 social.js가 SOC.authed()로 알려 줌
const HTML = document.documentElement;
const introOn = () => HTML.classList.contains('prelogin');
// 홈 데이터(급식·시간표·일정·투표·공지)는 사이트가 실제로 보일 때 한 번만 불러옴 — 로그인 전 소개 화면에서는 안 받음(요청·그리기 절약)
let homeBooted = false, cfgReady = false;
// 로그인 전(소개 화면)에도 첫 화면을 미리 그려 둠: 소개의 둘러보기 쇼케이스가 소개 화면을 투명하게 해서 '진짜 첫 화면'을 그대로 보여 주기 때문.
// 이때는 등장 애니메이션 없이 최종 모습으로 두고(quiet), 로그인하는 순간 등장 애니메이션을 처음부터 재생
let homeEntered = false;
function bootHome() {
  if (!cfgReady) return;
  const de = document.documentElement;
  if (!homeBooted) { homeBooted = true; renderHomeMeal(); renderHomeTT(); renderHomeDday(); renderCountdown(); loadOffDays(); loadNotice(); if (S.mealWk) loadHeroDay(); }
  if (introOn()) {   // 소개 화면 뒤: 조용히 최종 모습
    Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 1500))]).then(() => requestAnimationFrame(() => {
      if (!introOn() || homeEntered) return;
      centerHero(true); de.classList.remove('pre'); $('#v-home').classList.add('calm');
      setTimeout(() => SOC.showPrep?.(), 300);   // 소개 쇼케이스가 이 화면을 복제해 둠
    }));
    return;
  }
  if (homeEntered) return;
  homeEntered = true;
  de.classList.add('pre'); $('#v-home').classList.remove('calm');
  // 첫 등장 애니메이션: pre(숨김) → boot(등장). 끝나면 boot를 빼서 다른 화면 갔다 와도 다시 안 나옴
  const balP = loadBalance(); balP.then(pollBalance);
  // 첫 등장: 밸런스 티켓(아래 한계)·글꼴이 준비된 뒤 최종 자리를 먼저 잡고 시작 → 엉뚱한 곳에 떴다가 자리를 찾아가지 않게 (최대 1.5초 대기)
  // 등장 중엔 다시 재지 않음(크기 변화 때문에) → 등장 후에도 위치가 안 튐
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
  else { clearTimeout(inTimer); authPage(false); SOC.showOff?.(); SOC.inPlayOff?.(); onScroll(); bootHome(); }
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
const inBestTx = {};
function inBest(k, html) {   // 맛보기 게임마다 최고 기록 띠 (지금 고른 게임 것만 보임)
  if (html) inBestTx[k] = html;
  const el = $('#inBest'), t = inBestTx[inPk];
  el.hidden = !t; if (t) el.innerHTML = t + '<button type="button" data-intro="signup">가입하고 랭킹에 올리기</button>';
}
let inPk = 'home';
/* ===== 소개 맛보기 (2026-10-25): 집에 가고 싶어!(기본) · 반응속도 — 기록은 저장 안 함, 가입하면 진짜 게임에서 랭킹에 올라감 ===== */
// 반응속도
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
      inBest('rx', `내 최고 <b>${best}ms</b>`);
      return;
    }
    st = 'wait'; show('wait', '<b>기다려…</b><small>초록색이 되면 바로 탭!</small>');
    tm = setTimeout(() => { if (st !== 'wait') return; st = 'go'; show('go', '<b>지금!</b>'); t0 = performance.now(); }, 1000 + Math.random() * 2500);
  };
  pad_.addEventListener('pointerdown', hit);
  pad_.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) hit(e); });   // 키보드로도 할 수 있게
}
// 집에 가고 싶어! 맛보기: runner.js를 그대로 씀 (화면에 보일 때만 불러와 돌리고, 지나가면 멈춤). 키보드는 게임 칸에 포커스가 있을 때만(소개 스크롤·쇼케이스 ↓↑와 안 겹치게)
{
  const box = $('#inHr'), cv = $('#inHrCv'), ov = $('#inHrOv'), scr = $('#inHrScr');
  let RUN = null, R = null, char = null, over = false, deadAt = 0, best = 0, seen = false, loading = false;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const fit = () => {   // 한 도트 = 기기 픽셀 정수배 (도트가 고르게)
    if (!RUN) return;
    const cs = getComputedStyle(box), w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), dpr = devicePixelRatio || 1, k = w / RUN.W, snap = Math.floor(k * dpr) / dpr;
    scr.style.width = Math.min(w, (snap >= k * .85 ? snap : k) * RUN.W) + 'px';   // 정수배로 맞추면 너무 작아질 땐(작은 칸) 칸에 맞춤
  };
  const grade = m => m >= 1500 ? '이 정도면 라운드 1등 노려볼 만해요' : m >= 800 ? '꽤 멀리 왔는데요?' : m >= 300 ? '이제 감 잡았다!' : '한 번만 더…';
  async function start() {
    if (R || loading || inPk !== 'home' || !introOn()) return R;
    loading = true;
    try { RUN ||= await import('./runner.js'); } catch { loading = false; ov.innerHTML = '<b>게임을 못 불러왔어요</b><small>새로 고침해 주세요</small>'; return; }
    loading = false;
    if (R || inPk !== 'home' || !seen || !introOn()) return;
    char ||= RUN.loadChar();
    R = RUN.createRunner(cv, char, {
      best: () => best,
      onStart() { ov.hidden = true; box.classList.add('on'); },
      onOver(score, ms) {
        over = true; deadAt = performance.now(); box.classList.remove('on');
        const nb = score > best; if (nb) best = score;
        ov.hidden = false; ov.classList.add('dead');
        ov.innerHTML = `<b>앗, 집에 못 갔다…</b><span><em>${score.toLocaleString('ko-KR')}m</em> · ${(ms / 1000).toFixed(1)}초${nb ? ' · <i>최고 기록!</i>' : ''}</span><small>${grade(score)} · ${coarse ? '눌러서 다시' : '스페이스 · 클릭으로 다시'}</small>`;
        inBest('home', `내 최고 <b>${best.toLocaleString('ko-KR')}m</b>`);
      },
    });
    fit();
  }
  const stop = () => { if (!R) return; R.destroy(); R = null; over = false; ov.hidden = false; ov.classList.remove('dead'); ov.innerHTML = '<b>집에 가고 싶어!</b><small>눌러서 출발</small>'; box.classList.remove('on'); };
  const restart = () => { if (performance.now() - deadAt < 400) return; over = false; ov.classList.remove('dead'); R.reset(); R.jump(); };
  const act = (a, down) => { if (!R) { if (down) { seen = true; start().then(() => { if (a === 'jump' && R?.st.scene === 'ready') R.jump(); }); } return; } if (over) { if (down && a === 'jump') restart(); return; } R.input(a, down); };
  const hold = (el, a) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); box.focus({ preventScroll: true }); act(a, true); try { el.setPointerCapture(e.pointerId); } catch {} });
    const up = () => R?.input(a, false);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  hold(cv, 'jump'); hold(ov, 'jump'); hold($('#inHrJ'), 'jump'); hold($('#inHrD'), 'duck');
  const KEY = { ' ': 'jump', ArrowUp: 'jump', w: 'jump', W: 'jump', ArrowDown: 'duck', s: 'duck', S: 'duck' };
  box.addEventListener('keydown', e => { const a = KEY[e.key]; if (!a || e.target !== box) return; e.preventDefault(); e.stopPropagation(); if (!e.repeat) act(a, true); });
  box.addEventListener('keyup', e => { const a = KEY[e.key]; if (a) R?.input(a, false); });
  box.addEventListener('blur', () => { R?.input('jump', false); R?.input('duck', false); });
  $('#inHrRnd').addEventListener('click', () => { if (!RUN) return; char = RUN.randomChar(); R?.setChar(char); if (R && R.st.scene !== 'play') R.draw(); });
  if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(box);
  // 화면에 보이면 시작(대기 화면), 안 보이면 멈춤 — 달리는 중이 아니면 바로 정리
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { seen = e.isIntersecting; if (seen) start(); else if (!R || R.st.scene !== 'play') stop(); }), { root: $('#intro'), threshold: 0 }).observe(box);
  else { seen = true; start(); }
  // 탭 바꾸기
  $('#inPlay').addEventListener('click', e => {
    const b = e.target.closest('[data-pk]'); if (!b || b.dataset.pk === inPk) return;
    inPk = b.dataset.pk;
    $$('#inPlay [data-pk]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    $$('#inPlay [data-pk-txt]').forEach(x => { x.hidden = x.dataset.pkTxt !== inPk; });
    $$('#inPlay [data-pk-box]').forEach(x => { x.hidden = x.dataset.pkBox !== inPk; });
    if (inPk === 'home') start(); else stop();
    inBest(inPk);
  });
  SOC.inPlayOff = stop;   // 로그인해서 소개가 닫히면 멈춤
}
// '구경하기' 화살표: 소개 화면 안에서 부드럽게 내려감 (주소 해시는 안 바꿈)
$('#intro').addEventListener('click', e => { const a = e.target.closest('[data-intro-go]'); if (!a) return; e.preventDefault(); $('#' + a.dataset.introGo).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
// me: 로그인한 사람(없으면 null) · on: 소셜 기능이 켜져 있는지 · how: 'login' | 'signup' | undefined(처음 확인)
SOC.authed = (me, on = true, how) => {
  try { if (me) localStorage.setItem('sg_in', '1'); else localStorage.removeItem('sg_in'); } catch {}
  const who = me?.handle || '';
  if (who !== noticeWho) { noticeWho = who; if (homeBooted) loadNotice(); }   // 계정이 바뀌면 그 계정이 닫은 공지 기준으로 다시
  if (!on) return;                                   // 서버 확인 불가: 지금 상태 유지 (로그인 안 된 기기는 소개 화면 그대로)
  if (me) { adoptClass(me); if (introOn()) { intro(false); if (how === 'login' && !cls) setTimeout(openClass, 400); } }
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
  ['우리 반 시간표', '학년·반만 고르면 끝. 지금 교시를 짚어 주고, 마지막 교시가 끝나면 다음 날 시간표로'],
  ['오늘의 밸런스 게임', '평일마다 새 질문 하나. 마지막 교시가 끝나면 결과 공개, 댓글로 토론'],
  ['출석 체크', '등교일마다 들어오기만 하면 도장 쾅. 불꽃이 커질수록 스티커·프로필 사진·칭호가 열려요'],
  ['게임 · 2주 라운드', '집에 가고 싶어! · 반응속도 · 1 to 25 · 컷 타이밍. 2주마다 새로 겨뤄서 티어를 받고, 1~3등은 뽑기권'],
  ['뽑기 시즌 1', '일반은 스티커, 희귀는 움직이는 스티커, 전설은 네온 시계·홀로그램 닉네임 같은 효과. 돈으로 사는 건 없어요'],
  ['친구 · DM', '맞팔 친구가 지금 접속 중인지 첫 화면에서 바로. DM은 맞팔끼리만 주고받아요'],
  ['프로필 꾸미기', '캐릭터 사진·배경·스티커·칭호·동아리 로고까지. 뽑기 효과로 이름이 반짝여요'],
  ['일정 · 카운트다운', '다음 시험·행사까지 D-day, 방학까지 남은 등교일, 성인 되는 날까지 1초 단위로']];
const SH_EX_MEAL = { main: '탕수육', sides: ['잡채', '배추김치', '오이무침', '요구르트'], rice: '잡곡밥', soup: '미역국' };
var shTT = [];   // [[교시, 과목]] (var: 시계가 먼저 돌 때도 읽을 수 있게)
const SH_EX_TT = ['국어', '영상 제작', '영어', '체육', '수학', '미술', '한국사'];   // 7교시까지 채워 카드 아래가 비지 않게
const secHM = sec => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec % 3600 / 60))}`;
function showClock(n, b, left, pct, rest, sec) {
  shReclock?.();
  if (!$('#shLeft')) return;
  setText('#shSay', sayLine(b)); setText('#shLbl', left == null ? '오늘 수업 끝' : b.cnt || b.label); setText('#shLeft', left == null ? `${n.getHours() % 12 || 12}:${pad(n.getMinutes())}` : fmtLeft(left));
  setText('#shTime', `${n.getHours() < 12 ? '오전' : '오후'} ${n.getHours() % 12 || 12}:${pad(n.getMinutes())}`);
  setText('#shDate', `${n.getMonth() + 1}월 ${n.getDate()}일`); setText('#shDow', DOW[n.getDay()] + '요일');
  setText('#shState', b.state); setText('#shPct', pct == null ? '' : `${Math.round(pct * 100)}% ${rest ? '남음' : '지남'}`);
  $('#shBar').parentElement.hidden = pct == null;
  if (pct != null) $('#shBar').style.transform = `scaleX(${pct.toFixed(4)})`;
  // 예시 시간표: 학교 가는 날 수업 시간(1교시 시작~마지막 교시 끝)에만 실제 시각을 따르고, 그 밖(주말·방과 후·아침)엔
  // 전부 지운 줄처럼 보이지 않게 '3교시 진행 중' 예시 모습으로 고정 (2026-10-23 — 주말에 전부 취소선이라 깨져 보였음)
  const ps = (shTT || []).map(([p]) => BELL.find(x => x.p === p)).filter(Boolean), live = ps.length && isSchoolDay(n) && sec >= ps[0].start && sec < ps[ps.length - 1].end;
  $$('#shTt li').forEach(li => { const p = +li.dataset.p, bl = BELL.find(x => x.p === p); li.classList.toggle('done', live ? !!bl && sec >= bl.end : p < 3); li.classList.toggle('cur', live ? !!bl && sec >= bl.start && sec < bl.end : p === 3); });
}
// 쇼케이스 카드의 그림을 사이트에서 실제로 쓰는 그림으로 채움 (attend.js 불꽃 · att-art.js 스티커 · 캐릭터 · 동아리 로고) — 한 번만
let shArt = false;
async function fillShowArt() {
  if (shArt) return; shArt = true;
  try {
    const [{ flame }, { CLUBS }] = await Promise.all([import('./attend.js'), import('./clubs.js')]);
    $('#shaFire').innerHTML = flame('big', { tier: 1 });
    $('#shaNext').innerHTML = emo('r:bell', 'sha-a');
    $('#shcHit').innerHTML = emo('r:camrec', 'shc-a');
    $('#shcRow').innerHTML = [['r:eraser', 1], ['r:earbud', 1], ['r:test100', 2], ['r:fxneon', 3]].map(([v, r]) => `<li class="r${r}">${emo(v, 'shc-s')}</li>`).join('');
    $('#shfAvs').innerHTML = ['cat', 'frog', 'penguin', 'dino'].map(k => `<i class="shf-av">${emo('k:' + k)}</i>`).join('');
    $('#shpAv').innerHTML = emo('k:bunny', 'shp-k');
    $('#shpBan').innerHTML = ['r:camrec', 'r:schoolcat'].map(v => `<i>${emo(v, 'shp-s')}</i>`).join('');
    const c = CLUBS[Math.floor(Math.random() * CLUBS.length)];   // 동아리는 매번 무작위 (특정 동아리만 보이지 않게)
    $('#shpClub').innerHTML = `<img src="/clubs/${c[0]}.webp" alt="" width="128" height="128">${esc(c[1])}`;
  } catch { shArt = false; }
}
async function fillShow() {
  fillShowArt();
  const day = ymd(today()), cell = (x, cls) => { if (!x) return `<span class="c ${cls}"></span>`; const k = foodImg(x); return `<span class="c ${cls}">${k ? `<img src="/food/c/${k}.webp" alt="" loading="lazy">` : '<i></i>'}<b>${esc(x)}</b></span>`; };
  const [meal, rows] = await Promise.all([
    getMeals(today()).then(r => r.filter(x => MEALS[x.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE)).catch(() => []),
    Promise.resolve([])]);
  const r = meal.length ? pickMeal(meal, mealSlot()) : null;
  let m = SH_EX_MEAL;
  if (r) { const t = splitTray(cleanDish(r.DDISH_NM)), rest = [...t.top[1], ...t.top[2], ...t.top[3]]; m = { main: t.top[0][0] || rest.shift(), sides: rest.slice(0, 4), rice: t.rice, soup: t.soup }; }
  if ($('#shTray')) {   // (급식은 진짜 첫 화면을 복제해 쓰는 중이면 직접 그린 카드가 없음 — 시간표는 항상 예시라 따로 채움)
  $('#shMealK').textContent = r ? '오늘 ' + MEALS[r.MMEAL_SC_CODE] : '오늘 급식';
  $('#shTray').innerHTML = cell(m.main, 'm') + cell(m.sides[0], 'a') + cell(m.sides[1], 'a') + cell(m.sides[2], 'a') + cell(m.sides[3], 'a') + cell(m.rice, 'b') + cell(m.soup, 'r');
  $('#shKcal').hidden = !r?.CAL_INFO; if (r?.CAL_INFO) $('#shKcal').textContent = '🔥 ' + r.CAL_INFO;
  $('#shMealEx').hidden = !!r;
  }
  shTT = SH_EX_TT.map((x, i) => [i + 1, x]);   // 쇼케이스 시간표는 항상 예시 (반 설정과 무관하게 똑같이 보이게)
  $('#shTtK').textContent = '오늘 시간표';
  $('#shTt').innerHTML = shTT.map(([p, nm]) => { const bl = BELL.find(x => x.p === p); return `<li data-p="${p}"><b>${p}</b><small>${bl ? secHM(bl.start) : ''}</small>${subjIcon(nm)}<span>${esc(nm)}</span></li>`; }).join('');
  $('#shTtEx').hidden = false;
  if (introOn()) introTick();
}
{
  const sec = $('#inShow'), root = $('#intro'), stage = sec.querySelector('.sh-stage'), objs = [...$$('#inShow .so')], N = objs.length;
  const cover = sec.querySelector('.sh-cover'), cap = sec.querySelector('.sh-cap'), say = sec.querySelector('.sh-say'), skip = $('#shSkip'), dots = $('#shDots'), de = document.documentElement;
  const frame = sec.querySelector('.so-fr'), wrapEl = root.querySelector('.in-wrap');
  // 진행도 구간: 문구만(0~T_IN) → 진짜 첫 화면이 드러남(~T_SHOW) → 감상 → 줄 서기(T_HOLD~T_ROW) → 하나씩 넘김(~T_END)
  const T_IN = .03, T_SHOW = .1, T_HOLD = .17, T_ROW = .3, T_END = .96, STAG = .008;
  // 진짜 첫 화면에서 각 오브젝트가 있는 자리 (밸런스 티켓은 로그인해야 보여서 로그인 전엔 없음 → 줄 자리에서 그냥 나타남)
  const REAL = [[() => $('#sMeal')?.closest('.s-tt')], ['#bigclock .s-greet', '#bigclock .s-what', '#bigclock .clock', '#bigclock .s-info'], [() => $('#sTT')?.closest('.s-tt')], ['#play']];   // 급식·시간표는 진짜 내용(#sMeal·#sTT)이 들어 있는 카드
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v, ease = t => t * t * (3 - 2 * t), easeO = t => 1 - Math.pow(1 - t, 3), lerp = (a, b, t) => a + (b - a) * t;
  let L = null, real = [], target = 0, cur = 0, raf = 0, last = 0, idx = -1, on = false, vel = 0, secTop = 0, ticking = [], flags = {};
  dots.innerHTML = '<i></i>'.repeat(N);
  /* ── 성능 메모 (2026-10-23 렉 개선) ──
     · 매 프레임 바꾸는 건 transform·opacity만, 그것도 값이 바뀔 때만 씀(put). html에 CSS 변수를 매 프레임 쓰면 사이트 전체 스타일을 다시 계산해서 뺐음
     · 스크롤 위치는 레이아웃을 읽지 않고 scrollTop − 미리 재 둔 위치로 계산
     · 진짜 첫 화면 복제(무거움)는 스크롤 중이 아니라 한가할 때 미리 해 둠. 시계 복제본은 1초마다 글자만 옮겨 씀 */
  const put = (el, k, v) => { if (el && el['_' + k] !== v) { el['_' + k] = v; el.style[k] = v; } };
  const flag = (el, c, v) => { const key = c + (el === de ? 'd' : el === root ? 'r' : ''); if (flags[key] !== v) { flags[key] = v; el.classList.toggle(c.replace(/\d+$/, ''), v); } };
  const idle = fn => (window.requestIdleCallback || (f => setTimeout(f, 60)))(fn, { timeout: 300 });
  // 진짜 첫 화면의 급식판·시계 묶음·시간표를 그대로 복제해 같은 자리·같은 크기로 겹쳐 둠 → 줄 서기로 넘어갈 때 바뀌는 티가 안 남
  // (복제본은 id를 지우고, 서랍 위치 이동(translate)만 빼고 회전 등은 그대로. 진짜가 없으면 직접 그린 카드를 씀)
  function cloneGroup(i) {
    const o = objs[i], box = o.querySelector('.so-in');
    const els = (REAL[i] || []).map(q => typeof q === 'function' ? q() : $(q)).filter(e => e && !e.hidden && e.getClientRects().length);
    const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
    if (o._fb == null) o._fb = box.innerHTML;
    if (i === 1) ticking = [];
    const stowed = els.length === 1 && els[0].classList.contains('stow') && !els[0].classList.contains('open');   // 서랍이 들어가 있음(세로 화면 등): 포스트잇 탭만 보임
    if (i === 2 && rs.length && !stowed) {   // 진짜 시간표 칸 자리에, 그 칸 너비·아래 버튼 위까지의 높이 안에 맞춰 예시 카드
      const r = rs[0], dock = [$('#dmDock'), $('#svcFab')].map(e => e && e.getClientRects().length ? e.getBoundingClientRect() : null).filter(b => b && b.right > r.left && b.left < r.right);
      // 진짜 첫 화면에서 급식판·시간표는 시계 줄 가운데에 세로로 맞춰져 있음 → 예시 카드도 진짜 시간표 칸의 '가운데'에 맞춤
      // (전엔 위쪽 끝에 맞춰서, 반을 안 정해 짧은 진짜 칸 위에 긴 예시 카드가 아래로 늘어져 급식판보다 한참 내려가 보였음 — 2026-10-23)
      const hd = $('#hdr'), ceil = Math.max(16, hd && hd.getClientRects().length ? hd.getBoundingClientRect().bottom + 8 : 70);
      const floor = Math.min(L.H - 16, ...dock.map(b => b.top - 14)), cy = Math.min(Math.max((r.top + r.bottom) / 2, ceil + 40), floor - 40);
      const sc = Math.min(r.width / o.offsetWidth, Math.max(80, 2 * Math.min(cy - ceil, floor - cy)) / o.offsetHeight);
      real[2] = { x: (r.left + r.right) / 2 - o.offsetWidth * sc / 2, y: cy - o.offsetHeight * sc / 2, s: sc, ex: 1 }; return;
    }   // 시간표는 항상 예시 카드(2026-10-23) — 진짜 시간표 카드 자리에서 겹쳐 나타나며 출발
    if (!rs.length || rs.length !== els.length || stowed) {
      if (box.classList.contains('cl')) { box.classList.remove('cl'); box.innerHTML = o._fb; o.style.removeProperty('--w'); o.style.removeProperty('--h'); }
      const tab = stowed && els[0].querySelector('.s-tab'), tr = tab && tab.getBoundingClientRect();   // 직접 그린 카드가 그 포스트잇 자리에서 커지며 나옴
      real[i] = tr && tr.width ? { x: tr.left, y: tr.top, s: tr.height / o.offsetHeight, tab: 1 } : null;
      return;
    }
    let x0 = Math.min(...rs.map(v => v.left)), y0 = Math.min(...rs.map(v => v.top)), x1 = Math.max(...rs.map(v => v.right)), y1 = Math.max(...rs.map(v => v.bottom));
    if (i === 1) {   // 시계 묶음: 테두리를 큰 시계 숫자 가운데 기준으로 좌우 대칭이 되게 넓힘 (말풍선이 왼쪽으로 삐져나와 있어도 카드 안 내용이 한쪽으로 쏠려 보이지 않게)
      const ci = els.findIndex(e => e.classList.contains('clock')), cx = ci >= 0 ? (rs[ci].left + rs[ci].right) / 2 : (x0 + x1) / 2, half = Math.max(cx - x0, x1 - cx);
      x0 = cx - half; x1 = cx + half;
    }
    const wrap = document.createElement('div'); wrap.className = 'stage sh-cl';
    els.forEach((e, j) => {
      const r = rs[j], cs = getComputedStyle(e), w = parseFloat(cs.width) + (cs.boxSizing === 'border-box' ? 0 : parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)) + .5, h = e.offsetHeight, c = e.cloneNode(true);
      // 시계 묶음: id 붙은 칸(시각·남은 시간·상태 줄)은 짝을 기억해 두고 1초마다 글자만 옮김 (통째로 다시 복제하면 매초 버벅임)
      if (i === 1) { const a = [e, ...e.querySelectorAll('[id]')].filter(x => x.id), b = [c, ...c.querySelectorAll('[id]')].filter(x => x.id); a.forEach((x, k) => { if (b[k] && !x.querySelector('[id]')) ticking.push([x, b[k]]); }); }
      [c, ...c.querySelectorAll('[id]')].forEach(x => x.removeAttribute('id'));
      c.removeAttribute('hidden');
      const big = e.id === 'bigTime' ? e : e.querySelector('#bigTime'), cbig = big && (e.id === 'bigTime' ? c : c.querySelector('.s-big'));
      if (cbig) cbig.style.fontSize = getComputedStyle(big).fontSize;
      const m = cs.transform && cs.transform !== 'none' ? new DOMMatrix(cs.transform) : new DOMMatrix(); m.e = 0; m.f = 0;
      Object.assign(c.style, { position: 'absolute', left: ((r.left + r.right) / 2 - x0 - w / 2) + 'px', top: ((r.top + r.bottom) / 2 - y0 - h / 2) + 'px', right: 'auto', bottom: 'auto',
        width: w + 'px', height: h + 'px', maxWidth: 'none', maxHeight: 'none', minWidth: '0', margin: '0', boxSizing: 'border-box', translate: 'none', transform: m.toString(), animation: 'none', transition: 'none', opacity: '1', visibility: 'visible' });
      wrap.appendChild(c);
    });
    box.classList.add('cl'); box.replaceChildren(wrap);
    o.style.setProperty('--w', (x1 - x0) + 'px'); o.style.setProperty('--h', (y1 - y0) + 'px');
    real[i] = { x: x0, y: y0, s: 1 };
  }
  // 시계 복제본: 진짜 칸의 글자·클래스·막대 길이만 옮겨 씀 (introTick에서 1초마다)
  shReclock = () => { if (!on || !ticking.length || document.hidden) return; for (const [a, b] of ticking) { if (b._h !== a.innerHTML) { b._h = a.innerHTML; b.innerHTML = a.innerHTML; } if (b.className !== a.className) b.className = a.className; if (a.style.transform !== b.style.transform && !a.classList.contains('s-big')) b.style.transform = a.style.transform; } };
  let preparing = false;
  function prep() {   // 복제 + 줄 자리 계산: 무거워서 한가할 때, 그리고 복제본이 안 보일 때만
    if (preparing || !on || !L) return; preparing = true;
    idle(() => { preparing = false; if (!on || !L || (cur > T_HOLD - .01 && cur < 1)) return; const tmp = !de.classList.contains('sh-real'); if (tmp) de.classList.add('sh-real'); try { [0, 1, 2].forEach(cloneGroup); } finally { if (tmp) de.classList.remove('sh-real'); } rowLayout(); capSlot(); L.cloned = true; L.stale = false; });   // (드러났을 때만 보이는 버튼 위치까지 재려고 잠깐 sh-real)
  }
  function rowLayout() {
    const { W, H } = L, sz = objs.map(o => [o.offsetWidth, o.offsetHeight]);
    const rowH = Math.min(H * (W < 600 ? .46 : .52), W >= 600 && H > W * 1.2 ? 580 : 440),   // 세로 태블릿(800×1280 등)은 카드가 작고 아래가 비어 보여서 더 크게 (2026-10-25)
      gap = Math.max(26, W * .035), cy = H * (W < 600 ? .44 : .47);
    let x = 0;
    L.sz = sz;
    // 시계 복제본은 테두리가 바깥으로 넉넉히(좌우 54·위 30·아래 26px) 커지므로 그만큼 크기를 줄이고 양옆 간격을 더 둠
    const pad = i => i === 1 && real[1] && !real[1].tab ? [108, 56] : [0, 0];
    L.row = sz.map(([w, h], i) => { const [pw, ph] = pad(i), s = Math.min(rowH / (h + ph), W * .82 / (w + pw), 1.5); x += pw / 2 * s; const r = { x, w: w * s, h: h * s, s, y: cy - h * s / 2 + 2 * s }; x += w * s + pw / 2 * s + gap; return r; });
  }
  // 스티커가 들어갈 빈자리 찾기: 진짜 첫 화면에서 헤더·공지 띠 아래 ~ 말풍선 위(위쪽 틈) 또는 상태 줄 아래 ~ 바닥 버튼 위(아래쪽 틈) 중
  // 스티커가 더 크게 들어가는 곳. 테이프·👀가 위로 삐져나온 만큼(OV)까지 계산해서 어떤 화면 크기에서도 잘리거나 겹치지 않게
  const OV_T = 26, OV_B = 8, OV_X = 26;
  function capSlot() {
    const { W, H, capW, capH } = L, vis = e => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const tmp = !de.classList.contains('sh-real'); if (tmp) de.classList.add('sh-real');   // 첫 화면이 드러났을 때 보이는 버튼(서비스·메시지)까지 넣고 재야 함
    try { capSlotIn(W, H, capW, capH, vis); } finally { if (tmp) de.classList.remove('sh-real'); }
  }
  function capSlotIn(W, H, capW, capH, vis) {
    const rect = e => e.getBoundingClientRect(), smax = Math.min(.74, (W - 32) / (capW + OV_X * 2));
    const obs = [...$$('#hdr .hd > *'), $('#notice'), $('#bigclock .s-greet'), $('#bigclock .s-what'), $('#bigclock .clock'), $('#bigclock .s-info'), $('#svcFab'), $('#dmDock'), $('.s-meal'), $('.s-ttc')].filter(vis).map(rect).filter(r => r.width);
    const fit = (y0, y1) => {   // y0~y1 사이, 가운데 가로 범위를 막는 것들을 피해 가장 큰 배율
      let best = null;
      for (let s = smax; s >= .3; s -= .02) {
        const w = (capW + OV_X * 2) * s, x0 = W / 2 - w / 2, x1 = W / 2 + w / 2, h = (capH + OV_T + OV_B) * s;
        const hit = obs.filter(r => r.right > x0 && r.left < x1 && r.bottom > y0 && r.top < y1);
        const top = Math.max(y0, ...hit.filter(r => r.top < (y0 + y1) / 2).map(r => r.bottom + 8)), bot = Math.min(y1, ...hit.filter(r => r.top >= (y0 + y1) / 2).map(r => r.top - 8));
        // 틈 안에 다른 게 걸치면(가운데에 낀 것) 그 위·아래 중 큰 쪽만
        const mid = hit.filter(r => r.top < bot && r.bottom > top && !(r.bottom + 8 <= top) && !(r.top - 8 >= bot));
        let t = top, b = bot;
        if (mid.length) { const m = mid.reduce((a, r) => ({ top: Math.min(a.top, r.top), bottom: Math.max(a.bottom, r.bottom) }), { top: 1e9, bottom: -1e9 }); if (m.top - t >= b - m.bottom) b = m.top - 8; else t = m.bottom + 8; }
        if (b - t >= h) { best = { s, y: t + (b - t - h) / 2 + OV_T * s }; break; }
      }
      return best;
    };
    const greet = obs.length ? Math.min(...[$('#bigclock .s-greet'), $('#bigclock .s-what'), $('#bigclock .clock')].filter(vis).map(e => rect(e).top)) : H * .3;
    const info = [$('#bigclock .s-info'), $('#play')].filter(vis).map(e => rect(e).bottom);
    const a = fit(10, greet), b = info.length ? fit(Math.max(...info), H - 10) : null;
    L.slot = !a ? b : !b ? a : (b.s > a.s + .06 ? b : a);
  }
  function measureTop() { let t = 0, e = sec; while (e && e !== root) { t += e.offsetTop; e = e.offsetParent; } secTop = t; }
  function layout() {
    const was = L;
    L = { W: stage.clientWidth, H: root.clientHeight, range: Math.max(1, sec.offsetHeight - root.clientHeight), capH: cap.offsetHeight, capW: cap.offsetWidth };
    if (was) { L.cloned = was.cloned; L.slot = was.slot; L.forced = was.forced; }
    measureTop(); rowLayout(); L.stale = true; prep();
  }
  let fixedBtns = null;
  function render(p, pinned) {
    if (!L) return;
    const { W, H, row } = L;
    // ① 진짜 첫 화면 드러내기: 덮개(.sh-cover)가 걷히면 소개 화면이 투명해져서 뒤의 실제 첫 화면이 보임
    const show = pinned ? easeO(clamp((p - T_IN) / (T_SHOW - T_IN))) * (1 - ease(clamp((p - T_HOLD) / .05))) : 0;
    put(cover, 'opacity', (1 - show).toFixed(3));
    flag(root, 'sh-see', show > 0); flag(de, 'sh-real', show > 0);
    flag(de, 'sh-hand', show > 0 && p > T_HOLD);
    flag(de, 'sh-ttx', show > 0 && !!real[2]?.ex);   // 첫 화면의 진짜 시간표 카드 대신 예시 카드를 보여 줌   // 줄 서기 시작: 진짜 급식판·시계·시간표는 바로 숨기고 똑같은 복제본이 이어받아 움직임
    if (show > 0 && (!L.cloned || L.stale)) prep();   // 아직 복제 전이면(아주 빨리 내렸을 때) 지금 한가할 때 준비
    if (p > T_HOLD && !L.cloned && !L.forced) { L.forced = true; [0, 1, 2].forEach(cloneGroup); rowLayout(); L.cloned = true; }   // 줄 서기까지 왔는데도 없으면 그 자리에서 한 번만 바로
    if (show > 0) { fixedBtns ||= [$('#svcFab'), $('#dmDock'), $('#mascot')]; if (!fixedBtns[2]) fixedBtns[2] = $('#mascot'); fixedBtns.forEach(e => put(e, 'opacity', show.toFixed(3))); }
    // 문구: 처음엔 화면 가운데 크게 → 첫 화면이 드러나며 위로 올라가 작아짐 → 줄 서기 시작하면 사라짐
    const up = easeO(clamp((p - T_IN) / (T_SHOW - T_IN))), s0 = Math.min(1.15, (W - 32) / (L.capW + OV_X * 2), (H * .6) / L.capH);
    const slot = L.slot, s1 = slot ? slot.s : s0 * .5, cs = lerp(s0, s1, up);
    const cyY = lerp(H / 2 - L.capH * s0 / 2, slot ? slot.y : H * .7, up);
    put(cap, 'transform', `translate3d(${(W / 2 - L.capW * cs / 2).toFixed(1)}px,${cyY.toFixed(1)}px,0) scale(${cs.toFixed(4)})`);
    put(cap, 'opacity', ((1 - clamp((p - T_HOLD) / .03)) * (slot ? 1 : 1 - clamp((up - .55) / .45))).toFixed(3));   // 들어갈 빈자리가 없는 화면(좁은 폰 등)이면 첫 화면을 가리지 않게 드러나는 동안 사라짐
    // ②③ 줄 서기 · 넘기기
    const t = clamp((p - T_ROW) / (T_END - T_ROW)) * (N - 1), i0 = Math.floor(t), f = Math.min(N - 1, i0 + ease(clamp((t - i0 - .2) / .6)));
    const cOf = v => { const a = Math.floor(v), b = Math.min(N - 1, a + 1), r = v - a; return lerp(row[a].x + row[a].w / 2, row[b].x + row[b].w / 2, r); };
    const pan = W / 2 - cOf(f);
    for (let i = 0; i < N; i++) {
      const o = objs[i], q = ease(clamp((p - T_HOLD - i * STAG) / (T_ROW - T_HOLD - (N - 1) * STAG))), r = row[i];
      const d = Math.min(1, Math.abs(i - f)), mul = 1 - .16 * d;
      const rs = r.s * mul, rx = pan + r.x + r.w * (1 - mul) / 2, ry = r.y + r.h * (1 - mul) / 2;
      const h = real[i] || (i < 4 ? { x: rx, y: ry + 40, s: rs } : { x: W + 120 + (i - 4) * 160, y: ry, s: rs });   // 진짜 화면에 없는 건 오른쪽에서 줄줄이 들어옴
      const op = (i === 2 && real[2]?.ex ? (p > T_HOLD ? 1 : show) : real[i] && !real[i].tab ? (p > T_HOLD ? 1 : 0) : clamp(q * 4)) * lerp(1, .38 + .62 * (1 - d), q);   // 시간표 예시 카드는 첫 화면이 드러날 때부터 진짜 시간표 자리에 같이 보임   // 복제본은 진짜와 똑같아서 바로 겹쳐 나타나 움직이기 시작, 나머지는 서서히
      if (op < .002 && o._opacity === '0.000') continue;   // 안 보이는 건 위치 계산·쓰기 생략
      put(o, 'transform', `translate3d(${lerp(h.x, rx, q).toFixed(1)}px,${lerp(h.y, ry, q).toFixed(1)}px,0) scale(${lerp(h.s, rs, q).toFixed(4)})`);
      put(o, 'opacity', op.toFixed(3));
      flag(o, 'zz' + i, op < .002);
      if (i === 1) { put(frame, 'opacity', clamp(q * 1.6 - .3).toFixed(2)); }
    }
    const ui = clamp((p - T_ROW + .04) / .04).toFixed(2);
    put(say, 'opacity', ui); put(dots, 'opacity', ui);
    flag(skip, 'on', p > T_HOLD && p < T_END);   // 진짜 첫 화면이 보일 땐 메시지 버튼과 겹치지 않게 숨김
    const ni = Math.round(f);
    if (ni !== idx) {
      idx = ni; $('#shN').textContent = `${pad(ni + 1)} / ${pad(N)}`; $('#shT').textContent = SH_INFO[ni][0]; $('#shD').textContent = SH_INFO[ni][1];
      say.classList.remove('swap'); requestAnimationFrame(() => say.classList.add('swap'));   // (강제 레이아웃 없이 다음 프레임에 다시 붙여 애니메이션 재생)
      [...dots.children].forEach((x, j) => x.classList.toggle('on', j === ni));
    }
  }
  const rawP = () => L ? (root.scrollTop - secTop) / L.range : 0;
  // 스크롤을 따라가는 방식: 목표(스크롤 위치)를 '부드러운 감쇠(SmoothDamp)'로 쫓아감 — 출발·멈춤이 매끈하고 튕김(오버슛) 없음.
  // 확확 내려도 장면을 건너뛰지 않게 최고 속도만 제한(VMAX: 1초에 진행도 0.42 ≈ 한 장면 0.22초). 스크롤 스냅은 안 씀(되돌림 때문에 앞뒤로 흔들림)
  const SMOOTH = .16, VMAX = .6;
  function loop(ts) {
    const dt = Math.min(1 / 20, (ts - (last || ts - 16.7)) / 1000); last = ts;
    // SmoothDamp (Game Programming Gems 4) — 시간 상수 SMOOTH초, 최고 속도 VMAX
    const w = 2 / SMOOTH, x = w * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
    let ch = cur - target; const mx = VMAX * SMOOTH; ch = Math.max(-mx, Math.min(mx, ch));
    const to = cur - ch, tmp = (vel + w * ch) * dt;
    vel = (vel - w * tmp) * e; let nx = to + (ch + tmp) * e;
    if ((target - cur > 0) === (nx > target)) { nx = target; vel = 0; }
    cur = nx;
    if (Math.abs(target - cur) < .00025 && Math.abs(vel) < .002) { cur = target; vel = 0; }
    const rp = rawP();
    render(clamp(cur), rp >= -.002 && rp <= 1.002);
    raf = cur === target ? 0 : requestAnimationFrame(loop);
  }
  const kick = () => {
    if (!on || !L) return;
    const rp = rawP(); target = clamp(rp);
    if (rp < -.002 || rp > 1.002) { if (!raf) render(clamp(cur), false); }   // 붙어 있지 않을 땐 소개 화면을 바로 불투명하게
    if (rp < -.6) { cur = target; vel = 0; return; }   // 화면에서 한참 멀면 계산 안 함
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  };
  function setup() {
    on = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    sec.classList.toggle('sh-on', on);
    if (!on) { objs.forEach(o => { o.style.transform = o.style.opacity = ''; o._transform = o._opacity = undefined; }); cap.style.transform = cap.style.opacity = ''; root.classList.remove('sh-see'); de.classList.remove('sh-real', 'sh-hand', 'sh-ttx'); flags = {}; return; }
    layout(); cur = target = clamp(rawP()); render(cur, false);
  }
  root.addEventListener('scroll', kick, { passive: true });
  // 소개 화면에서 안 보이는 구역의 반복 애니메이션(둥실·반짝·전광판 등)은 멈춰 둠
  if ('IntersectionObserver' in window) {
    const pio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('ip', !e.isIntersecting)), { root, rootMargin: '80px 0px' });
    [...(wrapEl?.children || [])].filter(x => x !== sec).forEach(x => pio.observe(x));
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => { if (on && introOn()) { layout(); target = clamp(rawP()); render(cur, false); kick(); } }, 120); };
  const ro = new ResizeObserver(onResize); ro.observe(root); if (wrapEl) ro.observe(wrapEl);
  // 급식·시간표가 늦게 도착하면 복제본도 다시 (안 보일 때만)
  let mT = 0; const mo = new MutationObserver(() => { clearTimeout(mT); mT = setTimeout(prep, 400); });
  ['#sMeal', '#sTT'].forEach(q => $(q) && mo.observe($(q), { childList: true, subtree: true }));
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', setup);
  /* ── 한 번에 한 장면씩 (2026-10-23) ──
     쇼케이스 안에서는 스크롤 양을 쓰지 않고 '몇 번 내렸나'만 셈: 휠을 길게 굴리든 짧게 굴리든, 트랙패드로 확 밀든 한 번 = 한 장면.
     장면(STOPS): 스티커만 → 첫 화면 → 급식 → 시계 → … → 일정. 마지막 장면에서 한 번 더 내리면 쇼케이스를 빠져나가 그 아래는 평소처럼 스크롤.
     맨 처음 장면에서 올리면 위(첫 화면)로 평소처럼 돌아감. 휠·트랙패드·터치·키보드(↓↑ PageDown/Up 스페이스) 모두 같은 규칙 */
  const STOPS = [0, (T_SHOW + T_HOLD) / 2, ...Array.from({ length: N }, (_, j) => T_ROW + j * (T_END - T_ROW) / (N - 1))];
  let stopI = -1, lockUntil = 0, lastWheel = 0, wheelMag = 0, leaving = 0, touchY = null, touchMoved = false;
  const inShow = () => { const rp = rawP(); return rp > -.0005 && rp < 1.0005; };
  const goStop = k => { stopI = k; root.scrollTop = secTop + STOPS[k] * L.range; kick(); };   // 화면은 붙어 있으니 스크롤 위치는 바로 옮기고, 움직임은 render가 부드럽게
  const leave = dir => {   // 쇼케이스 밖으로: 아래면 다음 내용이 보이게, 위면 첫 화면으로 부드럽게
    leaving = performance.now() + 900; stopI = -1;
    root.scrollTo({ top: dir > 0 ? secTop + L.range + L.H * .55 : Math.max(0, secTop - L.H), behavior: 'smooth' });
  };
  function step(dir) {
    if (!L) return;
    const now = performance.now();
    if (now < lockUntil) return;
    lockUntil = now + 260;   // 넘어간 직후 잠깐만 다음 입력 무시 (연달아 밀면 바로바로 다음 장면)
    if (stopI < 0) stopI = nearestStop();
    const k = stopI + dir;
    if (k < 0 || k >= STOPS.length) return leave(dir);
    goStop(k);
  }
  const nearestStop = () => { const p = clamp(rawP()); let b = 0; STOPS.forEach((v, i) => { if (Math.abs(v - p) < Math.abs(STOPS[b] - p)) b = i; }); return b; };
  // 위에서 평소처럼 내려오다(또는 아래에서 올라오다) 쇼케이스에 들어오는 순간 첫(마지막) 장면에 딱 붙임
  let wasIn = false;
  root.addEventListener('scroll', () => {
    if (!on || !L || !introOn()) return;
    const inside = inShow();
    if (inside && !wasIn && performance.now() > leaving) {
      const fromBelow = rawP() > .5;
      goStop(fromBelow ? STOPS.length - 1 : 0); lockUntil = performance.now() + 420;
    }
    if (!inside) stopI = -1;
    wasIn = inside;
    settle();
  }, { passive: true });
  // 안전장치(2026-10-23): 어떤 경로로 스크롤됐든(빠져나가는 중 다시 굴림·스크롤바 끌기·관성 등) 움직임이 멈췄을 때
  // 쇼케이스 안인데 장면 사이에 걸쳐 있으면 가장 가까운 장면으로 딱 붙임 → 스티커와 반쯤 걷힌 화면이 겹친 채 애매하게 멈추지 않게
  let settleT = 0;
  function settle() {
    clearTimeout(settleT);
    settleT = setTimeout(() => {
      if (!on || !L || !introOn() || !inShow()) return;
      const wait = leaving - performance.now();
      if (wait > 0) return settle();
      const k = nearestStop();
      if (Math.abs(rawP() - STOPS[k]) * L.range > 2) goStop(k); else stopI = k;
    }, Math.max(180, leaving - performance.now() + 80));
  }
  // 휠·트랙패드: 한 번 미는 동작의 '시작'만 잡음 (2026-10-23 맥북 트랙패드 대응)
  //  · 새로 민 것으로 보는 경우: 입력이 잠깐(120ms) 끊겼다 다시 옴 / 방향이 바뀜 / 관성으로 줄어들던 값이 두 번 연속 다시 커짐(관성 중에 또 민 것)
  //  · 관성 꼬리(점점 작아지는 값)는 무시. 장면이 넘어간 직후 0.26초만 다음 입력을 막음 (예전엔 관성이 이어지는 내내 막혀서 맥북에서 잘 안 먹었음)
  let wDir = 0, wLast = 0, wMin = 0, wRise = 0;
  root.addEventListener('wheel', e => {
    if (!on || !L || !inShow() || performance.now() < leaving || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = performance.now(), mag = Math.abs(e.deltaY) * (e.deltaMode ? 30 : 1), dir = Math.sign(e.deltaY), gap = now - lastWheel;
    if (!dir) return;
    wRise = mag > wLast + 1 ? wRise + 1 : 0;
    const fresh = gap > 120 || dir !== wDir || (wRise >= 2 && mag > wMin * 2 + 3);
    if (mag < wLast) wMin = Math.min(wMin, mag);   // 줄어드는 구간(관성)에서만 최저값을 잼 → 처음 밀 때 점점 커지는 구간은 '새로 밂'으로 착각하지 않음
    lastWheel = now; wDir = dir; wLast = mag;
    if (fresh && now >= lockUntil) { wMin = Infinity; wRise = 0; step(dir); }
  }, { passive: false });
  // 터치: 손가락을 떼는 순간 위·아래 중 어느 쪽으로 밀었는지만 봄
  root.addEventListener('touchstart', e => { touchY = inShow() ? e.touches[0].clientY : null; touchMoved = false; }, { passive: true });
  root.addEventListener('touchmove', e => { if (touchY == null || !inShow() || performance.now() < leaving) return; e.preventDefault(); touchMoved = true; }, { passive: false });
  root.addEventListener('touchend', e => {
    if (touchY == null || !touchMoved) { touchY = null; return; }
    const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY); touchY = null;
    if (Math.abs(dy) > 24) { lockUntil = 0; step(Math.sign(dy)); }
  }, { passive: true });
  // 키보드
  document.addEventListener('keydown', e => {
    if (!on || !L || !introOn() || !$('#introAuth').hidden || $('.modal.open') || !inShow() || e.target.closest?.('input,textarea,select,button,a')) return;
    const d = { ArrowDown: 1, PageDown: 1, ' ': e.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault(); lockUntil = 0; step(d);
  });
  skip.addEventListener('click', () => leave(1));
  // 소개 화면 맨 위·맨 아래로: 쇼케이스를 그냥 지나가야 하니 이동하는 동안엔 장면 붙이기를 끔 (leaving), 다 가면 다시 켬
  const travel = top => { stopI = -1; leaving = performance.now() + 4000; root.scrollTo({ top, behavior: 'smooth' });
    const done = () => { leaving = performance.now() + 60; root.removeEventListener('scrollend', done); };
    root.addEventListener('scrollend', done); };
  $('#inGoBot').addEventListener('click', () => travel(root.scrollHeight));
  $('#inGoTop').addEventListener('click', () => travel(0));
  SOC.showOff = () => { root.classList.remove('sh-see'); de.classList.remove('sh-real', 'sh-hand', 'sh-ttx'); flags = {}; (fixedBtns || []).forEach(e => { if (e) { e.style.opacity = ''; e._opacity = undefined; } }); };   // 로그인하면 소개와 함께 정리
  SOC.showPrep = () => { if (on && introOn()) { layout(); render(cur, false); } };   // 첫 화면을 미리 다 그린 뒤(bootHome) 복제 준비
  setup();
  fillShow();
}

/* ===== 첫 화면 시계 스티커 (출석 보상) =====
   프로필 꾸미기에서 고른 보상 스티커가 시계의 별 자리를 차례로 대신함: 1칸 왼쪽 위(k1) · 2칸 오른쪽 아래(k4) · 3칸 오른쪽 위(k2).
   개발자는 5칸까지: 4칸 왼쪽 아래(k3 자리) · 5칸 왼쪽 가운데(k5 자리). 나만 보임 */
SOC.setDeco = list => {
  const clk = $('#bigclock .clock'); if (!clk) return;
  const key = (list || []).join(','); if (clk.dataset.deco === key) return; clk.dataset.deco = key;
  [1, 2, 3, 4, 5].forEach(i => {
    const el = clk.querySelector('.du' + i), v = (list || [])[i - 1];
    el.innerHTML = v ? emo(v, 'dua') : ''; el.classList.toggle('on', !!v); clk.classList.toggle('d' + i, !!v);
  });
};

/* ===== 시작 ===== */
if (store.get('wk_meal', false)) S.mealWk = weekOf(today());   // 홈 카드 하루/한 주 보기 기억
if (store.get('wk_tt', false)) S.ttWk = weekOf(ttTarget());
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
  if (h && h !== 'home') { if (/^(me|u|dm|game|gacha)\b/.test(h)) await socReady; go(h); }
  if (!cls && !introOn()) setTimeout(() => { if (!cls) openClass(); }, 1500);   // 소개 화면이면 닫힐 때 띄움 · 로그인 확인(adoptClass)을 기다렸다가 그래도 반이 없을 때만
});

/* ===== 입력 안내 말풍선 (브라우저 기본 경고창 대신) ===== */
// 폼 칸이 비었거나 날짜가 덜 골라졌을 때, 기본 회색 경고 대신 사이트 스티커 느낌의 말풍선을 칸 아래에 띄움
let tipBusy = false;
function fieldMsg(el) {
  const v = el.validity;
  if (el.type === 'date') {
    if (v.rangeUnderflow || v.rangeOverflow) return `${(el.min || '').slice(0, 4)}~${(el.max || '').slice(0, 4)}년 사이 날짜로 골라 주세요`;
    return v.badInput ? '없는 날짜예요. 연·월·일을 다시 확인해 주세요' : '날짜를 골라 주세요';
  }
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
  showFieldTip(e.target);
}, true);
// 날짜 칸은 '추가'를 누르기 전에도, 칸을 벗어날 때 말이 안 되는 날짜면 바로 안내
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.type !== 'date' || !el.form) return;
  const v = el.validity;
  if (v.badInput || v.rangeOverflow || v.rangeUnderflow) setTimeout(() => showFieldTip(el, false), 0);
});
function showFieldTip(el, focus = true) {
  $('#fTip')?.remove(); $$('.f-bad').forEach(x => x.classList.remove('f-bad'));
  const tip = document.createElement('div');
  tip.id = 'fTip'; tip.className = 'ftip'; tip.setAttribute('role', 'alert');
  tip.innerHTML = `<i aria-hidden="true">!</i><span>${esc(fieldMsg(el))}</span>`;
  document.body.append(tip);
  const r = el.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.top = (r.bottom + scrollY + 12) + 'px';
  tip.style.left = Math.max(12 + scrollX, Math.min(r.left + scrollX, scrollX + innerWidth - w - 12)) + 'px';
  tip.style.setProperty('--ax', Math.max(14, Math.min(w - 26, r.left + scrollX + 22 - parseFloat(tip.style.left))) + 'px');
  el.classList.add('f-bad'); if (focus) el.focus({ preventScroll: true });
  clearTimeout(hideFieldTip.t); hideFieldTip.t = setTimeout(hideFieldTip, 3500);
}
['input', 'change'].forEach(ev => document.addEventListener(ev, e => { if (e.target.classList?.contains('f-bad')) hideFieldTip(); }, true));
addEventListener('resize', hideFieldTip);
