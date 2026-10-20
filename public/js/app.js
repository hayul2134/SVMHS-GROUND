// SVMHS GROUND — 화면 로직 (홈 · 급식 · 시간표 · 학사일정 · D-day · 모달)
import { $, $$, now, ymd, isYmd, parseYmd, addDays, today, mondayOf, diffDays, DOW, fmtDay, ddayText, pad, esc, store, skel, empty, toast } from './util.js';
import { api, MEALS, loadConfig, getClasses, getMeals, getTimetable, getSchedule, cleanDish } from './neis.js';

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
const S = { mealSlot: '', mealManual: false, mealDate: today(), ttWeek: mondayOf(today()), calMonth: new Date(today().getFullYear(), today().getMonth(), 1), homeMeal: null, homeWeek: mondayOf(addDays(today(), today().getDay() === 6 ? 2 : today().getDay() === 0 ? 1 : 0)) };
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

function bellInfo(n) {
  const dow = n.getDay();
  if (dow === 0 || dow === 6 || offDays.has(ymd(n))) return { state: '쉬는 날', label: '오늘은 수업이 없어요' };
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
    // 수업 전 쉬는 시간
    const state = !prev ? '등교 전' : prev.p === 4 ? '점심시간' : '쉬는 시간';
    return { state, label: `${pName(cur.p)} 시작까지`, cnt: '수업 시간까지', target: cur.start, from: prev ? prev.end : null, brk: !!prev };
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
const seen = new Set();   // 지금 화면에 보이는 첫 화면 구역(큰 시계 · 아래 상태 카드)
const offscreen = new IntersectionObserver(es => es.forEach(e => {
  e.target.classList.toggle('paused', !e.isIntersecting);
  if (e.target.classList.contains('ticker')) return;
  e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
  const was = heroVisible; heroVisible = seen.size > 0; if (heroVisible && !was) tickClock();
}));
document.querySelectorAll('.ticker, #bigclock, #more').forEach(el => offscreen.observe(el));
const lastVal = new Map();
const setText = (sel, v) => { if (lastVal.get(sel) !== v) { lastVal.set(sel, v); $(sel).textContent = v; } };
const setHtml = (sel, v) => { if (lastVal.get(sel) !== v) { lastVal.set(sel, v); $(sel).innerHTML = v; } };
function tickClock() {
  clearTimeout(tickTimer);
  if (document.hidden) return;   // 안 보일 땐 멈춤 (다시 보이면 visibilitychange에서 재시작)
  const n = now();
  const dow = n.getDay();
  setHtml('#todayLbl', `<span class="d-md"><b>${n.getMonth() + 1}</b>월 <b>${n.getDate()}</b>일</span><span class="d-dow${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}">${DOW[dow]}요일</span>`);

  const slot = mealSlot(n);
  if (slot !== S.mealSlot) { S.mealSlot = slot; S.mealManual = false; if (homeRows.length) paintHomeMeal(); }
  const b = bellInfo(n), secNow = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  const left = b.target != null ? b.target - secNow : null;
  const pi = periodInfo(b);
  const key = `${b.state}|${pi.cur}|${pi.nxt}|${S.todayTT ? S.todayTT.length : '-'}`;
  if (key !== nextKey) {   // 교시가 바뀔 때만 다시 그림
    nextKey = key; renderNext(b, pi); renderTicker(b, pi);
    $$('#sTT li').forEach(li => { const p = +li.dataset.p; li.classList.toggle('now', p === pi.cur); li.classList.toggle('done', p < pi.done && p !== pi.cur); });
  }
  if (!heroVisible) { tickTimer = setTimeout(tickClock, 1000 - now().getMilliseconds() + 5); return; }   // 스크롤로 안 보이면 큰 시계는 안 그림
  setText('#greet', sayLine(b));
  setText('#bellState', b.state);
  setText('#bellLbl', b.cnt || b.label);
  const dg = t => [...t].map(ch => `<span class="${ch === ':' ? 'c' : 'n'}">${ch}</span>`).join('');   // 글자 폭 고정(숫자가 바뀌어도 안 흔들림)
  const ap = n.getHours() < 12 ? '오전' : '오후', h12 = n.getHours() % 12 || 12;
  const hm = `${h12}:${pad(n.getMinutes())}`;
  // 큰 숫자 = 남은 시간, 아래 작은 칩 = 현재 시각 (수업 없는 때엔 큰 숫자가 현재 시각)
  setHtml('#bigTime', left != null ? dg(fmtLeft(left)) : `<span class="ap">${ap}</span>` + dg(hm));
  setText('#bellCnt', `${ap} ${hm}`);
  $('#nowBox').hidden = left == null;
  const hero = $('#bigclock');
  hero.classList.toggle('soon', left != null && left <= 60);
  hero.classList.toggle('rest', /쉬는|점심/.test(b.state));
  const bar = b.from != null && left != null, prog = bar ? Math.min(1, (secNow - b.from) / (b.target - b.from)) : 0;
  $('#bellBarBox').hidden = !bar;
  if (bar) $('#bellBar').style.transform = `scaleX(${prog.toFixed(4)})`;
  setText('#bellPct', bar ? `${Math.floor(prog * 100)}% 지남` : b.target != null ? '곧 시작해요' : b.state === '쉬는 날' ? '푹 쉬는 날' : '오늘 수업 끝');
  tickTimer = setTimeout(tickClock, 1000 - now().getMilliseconds() + 5);   // 초가 바뀌는 순간에 맞춰 갱신
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
// 전광판: 오늘 정보를 한 줄로 흘려보냄
const TK = { meal: '', up: '' };
function renderTicker(b, pi) {
  b = b || bellInfo(now()); pi = pi || periodInfo(b);
  const rows = S.todayTT, subj = p => { const r = rows && rows.find(x => +x.PERIO === p); return r ? subjName(r.ITRT_CNTNT) : ''; };
  const items = [`${fmtDay(now())}`, b.state];
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
    const rows = await loadUpcoming(), t = ymd(today());
    rows.filter(isOff).forEach(r => offDays.add(r.AA_YMD));
    // 오늘 학교 행사·시험이 있으면 시계 아래에 알림 (그런 날은 종 시간이 평소와 다를 수 있음)
    const ev = rows.filter(r => r.AA_YMD === t && !isOff(r)).map(r => r.EVENT_NM);
    if (ev.length) { const el = $('#todayNote'); el.textContent = `오늘 일정 · ${ev.slice(0, 2).join(', ')}${ev.length > 2 ? ' 외' : ''} — 종 시간이 평소와 다를 수 있어요`; el.hidden = false; }
  } catch {}
  nextKey = '';
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
// 첫 화면에서 내려가거나 다른 화면이면 왼쪽 위 로고 대신 '처음으로' 버튼
function onScroll() { $('#hdr').classList.toggle('away', !$('#v-home').classList.contains('on') || scrollY > innerHeight * .5); }
addEventListener('scroll', onScroll, { passive: true });
$('#goDown').onclick = () => $('#more').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
function splitTray(list) {
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
  return { main: mi >= 0 ? rest[0] : (rest[0] || rice || ''), top, rice, soup, hasMain: mi >= 0 };
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
// 메뉴 이름: 단어 중간에서 줄이 끊기지 않게 '+'·'(' 앞뒤에서만 줄바꿈, 긴 이름은 글자를 조금 줄임
const nm = x => {
  const n = x.replace(/\s/g, '').length, sz = n >= 10 ? ' xl' : n >= 7 ? ' lg' : '';
  return { cls: sz, html: esc(x).replace(/\+/g, '+<wbr>').replace(/\(/g, '<wbr>(').replace(/&amp;/g, '&amp;<wbr>') };
};
const cellHtml = (items, cls = '', v = null, em = '') => {
  if (!items.length) return `<div class="cell empty ${cls}"></div>`;
  if (items.length === 1) {
    const x = items[0], pick = v && v.mine === x ? ' picked' : '';
    const t = nm(x);
    return `<div class="cell ${cls}${v && v.open ? ' vote' : ''}${pick}"${dishAttr(x, v)}>${voteMark(x, v)}<span class="em" aria-hidden="true">${em || dishEmoji(x)}</span><b><span class="nm${t.cls}">${t.html}</span></b></div>`;
  }
  return `<div class="cell multi ${cls}">${items.map(x => `<span class="it${v && v.open ? ' vote' : ''}${v && v.mine === x ? ' picked' : ''}"${dishAttr(x, v)}><span aria-hidden="true">${dishEmoji(x)}</span><em><span class="nm${nm(x).cls}">${nm(x).html}</span></em>${voteMark(x, v)}</span>`).join('')}</div>`;
};
const mealHtml = (r, d, mini = false) => {
  if (!r) return empty('급식 정보가 없어요');
  const t = splitTray(cleanDish(r.DDISH_NM)), v = d ? voteOf(ymd(d), r.MMEAL_SC_CODE) : null;
  const info = !v ? '' : mini
    ? `<p class="vnote">🗳️ ${v.open ? (v.mine ? `내 픽 <b>${esc(v.mine)}</b>` : '맛있는 메뉴 눌러서 투표') : '인기투표 결과'} · ${v.total}명</p>`
    : v.open
    ? `<p class="vnote">🗳️ ${v.mine ? `내 픽 <b>${esc(v.mine)}</b> · 다시 누르면 취소` : '제일 맛있는 메뉴를 눌러 투표!'} · ${v.total}명 참여</p>`
    : `<p class="vnote">🗳️ 인기투표 결과 · ${v.total}명 참여</p>`;
  return `<div class="tray${mini ? ' mini' : ''}" role="list" aria-label="급식 식판" data-meal="${r.MMEAL_SC_CODE}" data-ymd="${ymd(d || today())}">`
    + cellHtml(t.top[0], '', v)
    + `<div class="mid">${cellHtml(t.top[1], 'half', v)}${cellHtml(t.top[2], 'half', v)}</div>`
    + cellHtml(t.top[3], '', v)
    + cellHtml(t.rice ? [t.rice] : [], 'big', v) + cellHtml(t.soup ? [t.soup] : [], 'big soup', v, t.soup && isSoup(t.soup) ? '🍲' : '')
    + `</div>` + info + (r.CAL_INFO && !mini ? `<div class="kcal">🔥 ${esc(r.CAL_INFO)}</div>` : '');
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
function paintHeroMeal() {
  const box = $('#sMeal'), lbl = $('#sMealLbl');
  if (!homeRows.length) { lbl.textContent = '오늘 급식'; box.innerHTML = empty(S.mealFail ? '급식 정보를 불러오지 못했어요' : '오늘은 급식이 없어요'); return; }
  const r = pickMeal(homeRows, S.mealSlot);
  lbl.textContent = `오늘 급식 · ${MEALS[r.MMEAL_SC_CODE]}`;
  box.innerHTML = mealHtml(r, today(), true);
}
function paintHomeMeal() {
  if (!S.mealManual && homeRows.length) S.homeMeal = pickMeal(homeRows, S.mealSlot).MMEAL_SC_CODE;
  paintHeroMeal();
  const sel = S.homeMeal;
  $('#hMealTabs').innerHTML = homeRows.map(r => `<button data-m="${r.MMEAL_SC_CODE}" class="${r.MMEAL_SC_CODE === sel ? 'on' : ''}">${MEALS[r.MMEAL_SC_CODE]}</button>`).join('');
  $('#hMeal').innerHTML = mealHtml(homeRows.find(r => r.MMEAL_SC_CODE === sel), today());
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
  const tray = el.closest('.tray'); if (!tray || voting) return;
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
  $('#mCols').innerHTML = Object.entries(MEALS).map(([c, n]) => `<div class="card k-meal"><h3>${n}</h3>${mealHtml(rows.find(r => r.MMEAL_SC_CODE === c), d)}</div>`).join('');
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
// 다른 친구들 표 반영: 화면이 보이는 동안 40초마다, 다시 돌아왔을 때 바로
function pollBalance() {
  clearTimeout(balTimer);
  balTimer = setTimeout(async () => { if (!document.hidden && heroVisible && !balBusy) await loadBalance(); pollBalance(); }, 40000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && BAL) loadBalance(); });

/* ===== 시간표 ===== */
const subjName = s => String(s || '').replace(/^[\s*#·-]+/, '').trim();   // 나이스 원문의 '* 영상 CG작업' 같은 기호 제거
const needClass = empty('반을 설정하면 시간표가 보여요 · <button class="link" data-open-class>설정하기</button>');
async function renderHomeTT() {
  const box = $('#sTT'), d = today();
  renderHomeWeek();
  if (!cls) { S.todayTT = []; box.innerHTML = needClass; nextKey = ''; return; }
  if (d.getDay() % 6 === 0) { S.todayTT = []; box.innerHTML = empty('오늘은 주말이에요. 푹 쉬어요!'); nextKey = ''; return; }
  try {
    const rows = (await getTimetable(cls, mondayOf(d), addDays(mondayOf(d), 4))).filter(r => r.ALL_TI_YMD === ymd(d)).sort((a, b) => a.PERIO - b.PERIO);
    S.todayTT = rows;
    const dep = rows[0] && rows[0].DDDEP_NM;   // 학과 이름은 시간표 응답에서 알아냄
    if (dep && cls.dep !== dep) { cls.dep = dep; store.set('class', cls); renderClassChip(); }
    box.innerHTML = rows.length
      ? `<ul class="tt">${rows.map(r => `<li data-p="${esc(r.PERIO)}"><span class="p">${esc(r.PERIO)}</span><span class="s">${esc(subjName(r.ITRT_CNTNT))}</span></li>`).join('')}</ul>` + (api.hasKey ? '' : '<p class="note">5교시까지만 표시돼요</p>')
      : empty('오늘 시간표 정보가 없어요');
  } catch { S.todayTT = []; box.innerHTML = empty('시간표를 불러오지 못했어요'); }
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
    const td = (d, p) => `<td class="${ymd(d) === t ? 'today' : ''}">${esc(map[ymd(d) + '_' + p] || '')}</td>`;
    let h = '<table class="week"><thead><tr><th></th>' + days.map(d => `<th class="${ymd(d) === t ? 'today' : ''}"><span class="wd-d">${d.getDate()}</span><span class="wd-w">${DOW[d.getDay()]}</span></th>`).join('') + '</tr></thead><tbody>';
    for (let p = 1; p <= maxP; p++) h += `<tr><td class="pn">${p}</td>${days.map(d => td(d, p)).join('')}</tr>`;
    box.innerHTML = h + '</tbody></table>';
  } catch { if (!stale()) box.innerHTML = empty('시간표를 불러오지 못했어요'); }
}
function renderHomeWeek() {
  const mon = S.homeWeek;
  $('#hwLbl').textContent = weekLbl(mon);
  const w = Math.round(diffDays(mon, mondayOf(today())) / 7), tag = { '-1': '지난주 ', 0: '이번 주 ', 1: '다음 주 ' }[w] || '';
  $('#hwTitle').textContent = tag + (cls ? `${cls.g}학년 ${cls.c}반 시간표` : '시간표');
  $('#hwNote').textContent = cls && !api.hasKey ? '지금은 하루 5교시까지만 표시돼요. (인증키 등록 전)' : '';
  fillWeek($('#hWeek'), mon, () => mon !== S.homeWeek);
}
$('#goMeal').onclick = e => { e.preventDefault(); $('#mealCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
$('#goWeek').onclick = e => { e.preventDefault(); $('#weekTT').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
async function renderTTView() {
  const mon = S.ttWeek;
  $('#tLbl').textContent = weekLbl(mon);
  $('#ttTitle').textContent = cls ? `${cls.g}학년 ${cls.c}반 시간표` : '주간 시간표';
  $('#ttNote').textContent = api.hasKey ? '' : '지금은 하루 5교시까지만 표시돼요. (인증키 등록 전)';
  fillWeek($('#tWeek'), mon, () => mon !== S.ttWeek);
}
$('#tPrev').onclick = () => { S.ttWeek = addDays(S.ttWeek, -7); renderTTView(); };
$('#tNext').onclick = () => { S.ttWeek = addDays(S.ttWeek, 7); renderTTView(); };

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
    school = (await loadUpcoming()).map(r => ({ name: r.EVENT_NM, date: r.AA_YMD, off: isOff(r) }));
  } catch { fail = true; }
  const list = mine.concat(school).sort(byDate).slice(0, 10);
  if (!list.length) { box.innerHTML = empty(fail ? '일정을 불러오지 못했어요' : '60일 안에 예정된 일정이 없어요 · <button class="link" data-go="dday">D-day 추가</button>'); return; }
  { const f = list[0]; TK.up = `${f.name} ${ddayText(diffDays(parseYmd(f.date), t))}`; renderTicker(); }
  box.innerHTML = list.map((x, i) => {
    const d = parseYmd(x.date), n = diffDays(d, t);
    const tag = x.mine ? '<em class="tag me">내 D-day</em>' : x.off ? '<em class="tag off">쉬는 날</em>' : '';
    return `<div class="up${i === 0 ? ' first' : ''}${x.mine ? ' mine' : ''}"><b class="num">${ddayText(n)}</b><p class="nm">${esc(x.name)}</p><span class="dt">${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})</span>${tag}</div>`;
  }).join('');
  fitUp();
}
// 다가오는 일정: 화면 폭에 맞춰 딱 2줄까지만 보이기
function fitUp() {
  const box = $('#hUp'), cols = getComputedStyle(box).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  $$('.up', box).forEach((el, i) => { el.hidden = i >= cols * 2; });
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
const openModal = SOC.openModal = id => { lastFocus = document.activeElement; const m = $(id); m.classList.add('open'); [...m.querySelectorAll('button, select')].find(el => !el.hidden)?.focus(); };
const closeModal = SOC.closeModal = m => { m.classList.remove('open'); lastFocus?.focus?.(); };
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
  if (n.link) { a.href = n.link; a.dataset.go = n.link.slice(1); a.removeAttribute('aria-disabled'); } else { a.removeAttribute('href'); delete a.dataset.go; }
  $('#noticeX').onclick = () => { store.set('notice_x', n.id); box.hidden = true; };
  box.hidden = false;
}

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
// 소셜 화면의 링크(#u/…, #dm/…)도 hashchange로 처리됨
SOC.getClass = () => cls;
const socReady = import('./social.js').then(m => m.init(SOC)).catch(() => {});
loadConfig().finally(async () => {
  renderHomeMeal(); renderHomeTT(); renderHomeDday(); loadOffDays(); loadBalance().then(pollBalance); loadNotice();
  const h = location.hash.slice(1);
  if (h && h !== 'home') { if (/^(me|u|dm|game)\b/.test(h)) await socReady; go(h); }
  if (!cls) setTimeout(openClass, 400);
});
