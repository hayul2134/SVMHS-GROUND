// SVMHS GROUND — 화면 로직 (홈 · 급식 · 시간표 · 학사일정 · D-day · 모달)
import { $, $$, ymd, isYmd, parseYmd, addDays, today, mondayOf, diffDays, DOW, fmtDay, ddayText, pad, esc, store, skel, empty, toast } from './util.js';
import { api, MEALS, loadConfig, getMeals, getTimetable, getSchedule, cleanDish } from './neis.js';
import { QR } from './qr.js';

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

/* ===== 헤더 · 시계 ===== */
function tickClock() {
  const n = new Date(), h = n.getHours();
  $('#clock').textContent = pad(h) + ':' + pad(n.getMinutes());
  $('#todayLbl').textContent = `${n.getFullYear()}년 ${fmtDay(n)}`;
  $('#greet').textContent = h < 9 ? '좋은 아침이에요' : h < 12 ? '오늘도 힘내요' : h < 14 ? '점심 맛있게 먹어요' : h < 18 ? '조금만 더 힘내요' : '오늘도 수고했어요';
}
function renderClassChip() {
  const el = $('#classChip');
  el.hidden = !cls;
  if (cls) el.textContent = `${cls.g}학년 ${cls.c}반${cls.dep ? ' · ' + cls.dep : ''}`;
}

/* ===== 탭 이동 ===== */
const RENDER = { meal: renderMealView, tt: renderTTView, cal: renderCalView, dday: renderDdayView };
function go(v) {
  if (!VIEWS.includes(v)) v = 'home';
  $$('#nav button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  RENDER[v]?.();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (location.hash !== '#' + v) history.replaceState(null, '', v === 'home' ? location.pathname : '#' + v);
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.v); });
document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });

/* ===== 급식 ===== */
const mealHtml = r => r
  ? `<ul class="menu">${cleanDish(r.DDISH_NM).map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="kcal">${esc(r.CAL_INFO)}</div>`
  : empty('급식 정보가 없어요');
async function renderHomeMeal() {
  const box = $('#hMeal'), tabs = $('#hMealTabs');
  try {
    const rows = (await getMeals(today())).filter(r => MEALS[r.MMEAL_SC_CODE]).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
    if (!rows.length) { tabs.innerHTML = ''; box.innerHTML = empty('오늘은 급식이 없어요'); return; }
    const h = new Date().getHours(), pref = h < 9 ? '1' : h < 14 ? '2' : '3';
    const sel = S.homeMeal || (rows.find(r => r.MMEAL_SC_CODE === pref) || rows.find(r => r.MMEAL_SC_CODE === '2') || rows[0]).MMEAL_SC_CODE;
    tabs.innerHTML = rows.map(r => `<button data-m="${r.MMEAL_SC_CODE}" class="${r.MMEAL_SC_CODE === sel ? 'on' : ''}">${MEALS[r.MMEAL_SC_CODE]}</button>`).join('');
    box.innerHTML = mealHtml(rows.find(r => r.MMEAL_SC_CODE === sel));
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
const needClass = empty('반을 설정하면 시간표가 보여요 · <button class="link" data-open-class>설정하기</button>');
async function renderHomeTT() {
  const box = $('#hTT'), d = today();
  if (!cls) { box.innerHTML = needClass; return; }
  if (d.getDay() % 6 === 0) { box.innerHTML = empty('오늘은 주말이에요. 푹 쉬어요!'); return; }
  try {
    const rows = (await getTimetable(cls, d, d)).filter(r => r.ALL_TI_YMD === ymd(d)).sort((a, b) => a.PERIO - b.PERIO);
    const dep = rows[0] && rows[0].DDDEP_NM;   // 학과 이름은 시간표 응답에서 알아냄
    if (dep && cls.dep !== dep) { cls.dep = dep; store.set('class', cls); renderClassChip(); }
    box.innerHTML = rows.length
      ? `<ul class="tt">${rows.map(r => `<li><span class="p">${esc(r.PERIO)}</span><span class="s">${esc(r.ITRT_CNTNT)}</span></li>`).join('')}</ul>` + (api.hasKey ? '' : '<p class="note">5교시까지만 표시돼요</p>')
      : empty('오늘 시간표 정보가 없어요');
  } catch { box.innerHTML = empty('시간표를 불러오지 못했어요'); }
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
    const map = {}; rows.forEach(r => { map[r.ALL_TI_YMD + '_' + r.PERIO] = r.ITRT_CNTNT; });
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
async function renderHomeCal() {
  const box = $('#hCal');
  try {
    const rows = (await loadUpcoming()).slice(0, 5);
    box.innerHTML = rows.length ? evHtml(rows) : empty('60일 안에 예정된 일정이 없어요');
  } catch { box.innerHTML = empty('일정을 불러오지 못했어요'); }
}
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
async function renderHomeDday() {
  const mine = myDdays().filter(x => parseYmd(x.date) >= today());
  let school = [];
  try {
    school = (await loadUpcoming()).filter(r => r.SBTR_DD_SC_NM !== '휴업일' || /방학|시험|고사/.test(r.EVENT_NM))
      .slice(0, 3).map(r => ({ name: r.EVENT_NM, date: r.AA_YMD }));
  } catch {}
  const list = mine.concat(school).sort(byDate).slice(0, 4);
  $('#hDday').innerHTML = list.length ? ddayListHtml(list) : empty('D-day를 추가해 보세요 · <button class="link" data-go="dday">추가하기</button>');
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
$('#btnShare').onclick = () => {
  const url = shareUrl();
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
$('#openInfo').onclick = () => openModal('#mInfo');
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
  $('meta[name=theme-color]').content = t === 'dark' ? '#070c22' : '#eaf1ff';
}
applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
$('#btnTheme').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); store.set('theme', t); };

/* ===== 시작 ===== */
tickClock(); setInterval(tickClock, 10000);
renderClassChip();
store.pruneCache();
// 날짜가 바뀐 채로 다시 열면(자정 넘김) 새로 고침
document.addEventListener('visibilitychange', () => { if (!document.hidden && ymd(today()) !== startDay) location.reload(); });
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
loadConfig().finally(() => {
  renderHomeMeal(); renderHomeTT(); renderHomeCal(); renderHomeDday();
  const h = location.hash.slice(1); if (h && h !== 'home') go(h);
  if (!cls) setTimeout(openClass, 400);
});
