// 나이스 교육정보 개방 포털 API — 항상 우리 서버(/api/neis/*)를 거친다 (functions/api/[[path]].js)
import { ymd, addDays, store, clock } from './util.js';

export const api = { hasKey: false };   // 서버에 인증키가 있으면 한 번에 많이 받고, 없으면 5건씩 나눠 받는다
export const MEALS = { '1': '조식', '2': '중식', '3': '석식' };

const CACHE_TTL = 3 * 3600e3;           // 브라우저 캐시 3시간
const memo = new Map();

/** 서버에 키가 있는지 확인. 지난번 값이 있으면 바로 쓰고(대기 없음) 뒤에서 새로 확인한다 */
export function loadConfig() {
  const t0 = Date.now();
  const fresh = fetch('/api/config', { cache: 'no-store' }).then(r => {
    // 서버 시각(Date 헤더, 초 단위)과 기기 시각 차이가 3초 넘게 나면 보정
    const sv = Date.parse(r.headers.get('date') || ''), off = sv + 500 - (t0 + Date.now()) / 2;
    if (sv && Math.abs(off) > 3000 && Math.abs(off) < 864e5) clock.off = off;
    return r.ok ? r.json() : null;
  }).then(c => {
    if (c) { api.hasKey = !!c.hasKey; store.set('hasKey', api.hasKey); }
  }).catch(() => {});
  // 지난번에 '키 있음'이었으면 바로 쓰고, 아니면 새 값을 기다린다 (키 등록 후에도 5교시 제한이 남지 않게)
  if (store.get('hasKey', null) === true) { api.hasKey = true; return Promise.resolve(); }
  return fresh;
}

async function neis(svc, params) {
  const q = new URLSearchParams({ pSize: api.hasKey ? '1000' : '5', ...params });
  const url = `/api/neis/${svc}?${q}`;
  if (memo.has(url)) return memo.get(url);
  const ck = 'c_' + svc + '_' + q;
  const cached = store.get(ck);
  if (cached && Array.isArray(cached.v) && Date.now() - cached.t < CACHE_TTL) return cached.v;

  const p = fetch(url).then(async r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.RESULT && j.RESULT.CODE !== 'INFO-200') throw new Error(j.RESULT.CODE); // INFO-200 = 데이터 없음(정상)
    const rows = (j[svc] && j[svc][1] && j[svc][1].row) || [];
    store.set(ck, { t: Date.now(), v: rows });
    return rows;
  });
  memo.set(url, p);
  p.catch(() => memo.delete(url));     // 실패한 요청은 다음에 다시 시도
  return p;
}
const settle = p => p.catch(() => []);

export async function getMeals(date) {
  const day = ymd(date);
  if (api.hasKey) return neis('mealServiceDietInfo', { MLSV_YMD: day });
  const res = await Promise.all(Object.keys(MEALS).map(c => settle(neis('mealServiceDietInfo', { MLSV_YMD: day, MMEAL_SC_CODE: c }))));
  return res.flat();
}

// 여러 날 급식(한 주 크게 보기). 키가 있으면 한 번에, 없으면 날마다 나눠 받음
export async function getMealsRange(from, to) {
  if (api.hasKey) return neis('mealServiceDietInfo', { MLSV_FROM_YMD: ymd(from), MLSV_TO_YMD: ymd(to) });
  const days = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) if (d.getDay() % 6) days.push(new Date(d));
  return (await Promise.all(days.map(d => settle(getMeals(d))))).flat();
}

async function rawTT(cls, from, to) {
  if (api.hasKey) return neis('hisTimetable', { GRADE: cls.g, CLASS_NM: cls.c, TI_FROM_YMD: ymd(from), TI_TO_YMD: ymd(to) });
  const days = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) if (d.getDay() % 6) days.push(new Date(d));
  const res = await Promise.all(days.map(d => settle(neis('hisTimetable', { GRADE: cls.g, CLASS_NM: cls.c, ALL_TI_YMD: ymd(d) }))));
  return res.flat();
}

/** 분반 수업 (2026-10-26 하율): 두 반 학생이 섞여서 듣는데 나이스엔 반마다 한 과목만 올라감
 *  (2-5 월 1~2교시 = 시각디자인 단원, 2-6 같은 시간 = 프리프로덕션 연출). 학생이 반 설정에서 고른 분반(cls.tk)이
 *  (2026-10-26 하율: 반이 아니라 시디·프로덕션으로 나뉨 → 반 기본값 없이 학생이 직접 고름, 저장 키 tk)
 *  우리 반 나이스 과목과 다르면, 그 칸만 상대 반 나이스 과목으로 바꿔 보여 줌. re = 그 분반 과목(NCS 단원) 이름 */
export const SPLITS = [
  { g: '2', cs: ['5', '6'], tracks: [
    { id: 'vd', name: '시각디자인', c: '5', re: /시안\s*디자인|최종\s*디자인|시각\s*디자인/ },
    { id: 'pp', name: '프로덕션', c: '6', re: /프리\s*프로덕션/ },
  ] },
];
export const splitOf = cls => (cls && SPLITS.find(s => s.g === cls.g && s.cs.includes(cls.c))) || null;

export async function getTimetable(cls, from, to) {
  const rows = await rawTT(cls, from, to), sp = splitOf(cls);
  const mine = sp && sp.tracks.find(t => t.id === cls.tk), home = sp && sp.tracks.find(t => t.c === cls.c);
  if (!mine || !home || mine === home) return rows;
  const other = await rawTT({ g: cls.g, c: mine.c }, from, to).catch(() => []);
  const om = new Map(other.map(r => [r.ALL_TI_YMD + '_' + +r.PERIO, r]));
  return rows.map(r => {
    if (!home.re.test(r.ITRT_CNTNT || '')) return r;
    const o = om.get(r.ALL_TI_YMD + '_' + +r.PERIO);
    return o && mine.re.test(o.ITRT_CNTNT || '') ? { ...r, ITRT_CNTNT: o.ITRT_CNTNT } : r;
  });
}

/** 나이스 '금요일수업'·'수요일 수업' = 그날 다른 요일 시간표로 수업하는 교체일 (2026-10-25)
 *  → 이름을 '금요일 시간표로 수업'으로 바꾸고 swap 표시 (홈 '다가오는 일정'·D-day 목록에선 빼고 달력에만) */
const SWAP_RE = /^\s*([월화수목금토일])요일\s*수업\s*$/;
function swapDay(r) {
  const m = SWAP_RE.exec(r.EVENT_NM);
  return m ? { ...r, EVENT_NM: `${m[1]}요일 시간표로 수업`, swap: m[1] } : r;
}
export async function getSchedule(from, to) {
  let rows;
  if (api.hasKey) rows = await neis('SchoolSchedule', { AA_FROM_YMD: ymd(from), AA_TO_YMD: ymd(to) });
  else {
    const parts = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 4)) { const e = addDays(d, 3); parts.push([d, e > to ? to : e]); }
    rows = (await Promise.all(parts.map(([a, b]) => settle(neis('SchoolSchedule', { AA_FROM_YMD: ymd(a), AA_TO_YMD: ymd(b) }))))).flat();
  }
  const seen = new Set();
  return rows
    .filter(r => r.EVENT_NM && r.EVENT_NM !== '토요휴업일')
    .filter(r => { const k = r.AA_YMD + r.EVENT_NM; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(swapDay)
    .sort((a, b) => a.AA_YMD.localeCompare(b.AA_YMD));
}

/** 학년별 반 목록 [{ c: '1', dep: '영상콘텐츠과' }] (학년도는 3월 기준) */
export async function getClasses(g) {
  const d = new Date(), ay = d.getMonth() < 2 ? d.getFullYear() - 1 : d.getFullYear();
  const rows = await neis('classInfo', { AY: String(ay), GRADE: String(g) });
  return rows.map(r => ({ c: String(+r.CLASS_NM), dep: r.DDDEP_NM || '' })).filter(x => +x.c > 0).sort((a, b) => a.c - b.c);
}

/** '밥<br/>국(1.2.5)' → ['밥', '국'] (알레르기 번호·기호 제거) */
export const cleanDish = s => String(s || '').split(/<br\s*\/?>/i).map(x => x.replace(/\([\d.\s]*\)/g, '').replace(/[*#]/g, '').trim()).filter(Boolean);
