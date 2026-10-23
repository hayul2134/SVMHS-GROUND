// SVMHS GROUND — 출석 체크 (듀오링고식 연속 출석)
// 규칙
//  - 한국 시간 하루에 한 번, 로그인한 채로 사이트를 열면 출석(자동). 등교일만 셈 — 주말·휴업일·공휴일 방문은 기록 안 함(2026-10-23: 주말 출석 압박 방지).
//  - 연속 기록은 '등교일(월~금, 학사일정 휴업일·공휴일 제외)'을 빠지면 끊김 → 주말·방학·공휴일은 쉬어도 그대로.
//  - 출석 방패: 연속 5일(한 주 개근)마다 1개, 최대 2개(연속 30일 보상 후 3개). 빠진 등교일 하루를 방패 1개가 자동으로 메움.
//  - 보상: 최고 연속 기록·누적 출석일이 기준에 닿으면 스티커·프로필 사진·배경 색·칭호가 영구 해금(기록이 끊겨도 유지).
//  - 완벽한 연속(st_pf): 지금 연속 기록 동안 방패를 한 번도 안 썼으면 1 → 불꽃에 금빛 후광.
// 보상 목록은 public/js/att-rewards.js 한 곳에 (화면과 같이 씀)
export { REWARDS, MILESTONES, ATT_COLORS, unlockedOf, rwOn, decoSlots, shieldMaxOf, STK_MSG } from '../public/js/att-rewards.js';
export const SHIELD_EVERY = 5;   // 최대 개수는 shieldMaxOf(최고 기록) — 기본 2개, 연속 30일 보상으로 3개
const LOOKBACK = 120;   // 이보다 오래 쉬었으면 휴일 계산 없이 새로 시작

/* ----- 날짜 (YYYYMMDD, 한국 시간) ----- */
const dayNo = y => Math.floor(Date.UTC(+y.slice(0, 4), +y.slice(4, 6) - 1, +y.slice(6, 8)) / 86400e3);
const ymdOfNo = n => new Date(n * 86400e3).toISOString().slice(0, 10).replace(/-/g, '');
const dowNo = n => new Date(n * 86400e3).getUTCDay();
export const kstToday = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
export const addYmd = (y, k) => ymdOfNo(dayNo(y) + k);

/* ----- 학사일정 휴업일·공휴일 (나이스 SchoolSchedule) — 달마다 school_off 표에 저장, 이번 달·다음 달은 하루마다 새로 확인 -----
   나이스를 못 읽은 달은 '모름' → 그 달 평일은 빠져도 끊지 않음(학생에게 불리하지 않게) */
const SCHOOL = 'ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010795';
const memo = new Map();   // ym → { days:Set, until }
/* 여름방학처럼 나이스에 매일 '휴업일'로 안 올라오고 '방학식'·'개학식' 행사만 있는 방학이 있음(2026 여름 확인)
   → 달 저장값에 표시 'V날짜'(방학식)·'K날짜'(개학식)를 같이 넣고, 방학식 다음 날 ~ 개학식 전날을 쉬는 날로 봄 */
const VER = '#2';   // 이 표시가 없는 옛 저장값은 다시 받음
const vacMarks = rows => rows.flatMap(x => /개학/.test(x.EVENT_NM) ? ['K' + x.AA_YMD] : /방학식|종업식/.test(x.EVENT_NM) ? ['V' + x.AA_YMD] : []);
const VAC_MAX = 80;   // 개학식을 못 찾으면 방학식 뒤 이만큼만 방학으로 봄
// marks: ['V20260724', 'K20260817', …] → y가 방학 중인지
const inVac = (marks, y) => {
  let last = null;
  for (const m of marks) { const d = m.slice(1); if ((m[0] === 'V' && d < y) || (m[0] === 'K' && d <= y)) { if (!last || d >= last.slice(1)) last = m; } }
  return !!last && last[0] === 'V' && dayNo(y) - dayNo(last.slice(1)) <= VAC_MAX;
};
async function monthOff(env, db, ym, row) {
  const m = memo.get(ym);
  if (m && m.until > Date.now()) return m.days;
  const cur = kstToday().slice(0, 6), stale = ym >= cur ? 86400e3 : 30 * 86400e3;
  if (row && Date.now() - row.at < stale && row.days.includes(VER)) { const s = new Set(JSON.parse(row.days)); memo.set(ym, { days: s, until: Date.now() + 600e3 }); return s; }
  let days = null;
  try {
    const key = env.NEIS_KEY ? `&KEY=${env.NEIS_KEY}` : '';
    const r = await fetch(`https://open.neis.go.kr/hub/SchoolSchedule?Type=json&${SCHOOL}&AA_FROM_YMD=${ym}01&AA_TO_YMD=${ym}31&pIndex=1&pSize=1000${key}`, { signal: AbortSignal.timeout(4000) });
    const j = r.ok ? await r.json() : null;
    if (j?.SchoolSchedule) { const rows = j.SchoolSchedule[1]?.row || []; days = [VER, ...rows.filter(x => x.SBTR_DD_SC_NM === '휴업일' || x.SBTR_DD_SC_NM === '공휴일').map(x => x.AA_YMD), ...vacMarks(rows)]; }
    else if (j?.RESULT?.CODE === 'INFO-200') days = [VER];   // 그 달 일정 없음
  } catch {}
  if (!days) { if (row) return new Set(JSON.parse(row.days)); return null; }   // 모름
  const s = new Set(days);
  memo.set(ym, { days: s, until: Date.now() + 600e3 });
  try { await db.prepare('INSERT INTO school_off (ym, days, at) VALUES (?1, ?2, ?3) ON CONFLICT (ym) DO UPDATE SET days = excluded.days, at = excluded.at').bind(ym, JSON.stringify(days), Date.now()).run(); } catch {}
  return s;
}
// from~to(포함) 사이의 '빠지면 안 되는 등교일' 판단기: isSchool(ymd) → true/false
export async function schoolDays(env, db, from, to) {
  if (from > to) return () => false;
  const yms = [], from0 = addYmd(from, -VAC_MAX);   // 방학식이 범위 앞에 있을 수 있어서 앞쪽 달도 읽음
  for (let y = +from0.slice(0, 4), mo = +from0.slice(4, 6); `${y}${String(mo).padStart(2, '0')}` <= to.slice(0, 6); mo === 12 ? (y++, mo = 1) : mo++) yms.push(`${y}${String(mo).padStart(2, '0')}`);
  const rows = Object.fromEntries((await db.prepare(`SELECT ym, days, at FROM school_off WHERE ym IN (${yms.map((_, i) => '?' + (i + 1)).join(',')})`).bind(...yms).all()).results.map(r => [r.ym, r]));
  const off = Object.fromEntries(await Promise.all(yms.map(async ym => [ym, await monthOff(env, db, ym, rows[ym])])));
  const marks = Object.values(off).flatMap(s => s ? [...s].filter(x => x[0] === 'V' || x[0] === 'K') : []);
  return y => { const w = dowNo(dayNo(y)); if (w === 0 || w === 6) return false; const s = off[y.slice(0, 6)]; return !!s && !s.has(y) && !inVac(marks, y); };
}
// 오늘이 출석을 세지 않는 쉬는 날인지: 주말이거나 나이스 휴업일·공휴일 (나이스를 못 읽으면 평일은 등교일로 봄)
export async function restDay(env, db, y) {
  const w = dowNo(dayNo(y)); if (w === 0 || w === 6) return true;
  const s = await schoolDays(env, db, y, y), ym = y.slice(0, 6);
  if (s(y)) return false;
  // 나이스를 못 읽은 달(모름)은 등교일로 봄 — 휴업일·방학으로 확인된 날만 쉬는 날
  const known = memo.get(ym)?.days || (await db.prepare('SELECT days FROM school_off WHERE ym = ?1').bind(ym).first().then(r => r && new Set(JSON.parse(r.days))));
  return !!known;
}
// last(마지막 출석일, 그날 제외) 다음 날부터 today 전날까지 빠진 등교일 목록
export async function missedDays(env, db, last, today) {
  if (!last || last >= today) return [];
  if (dayNo(today) - dayNo(last) > LOOKBACK) return null;   // 너무 오래 쉼 → 끊김
  const from = addYmd(last, 1), to = addYmd(today, -1);
  if (from > to) return [];
  const isSchool = await schoolDays(env, db, from, to), out = [];
  for (let n = dayNo(from); n <= dayNo(to); n++) { const y = ymdOfNo(n); if (isSchool(y)) out.push(y); }
  return out;
}
// 지금 살아 있는 연속 기록 (오늘 아직 안 왔어도, 빠진 등교일을 방패로 메울 수 있으면 유지)
export function liveCur(u, missed) {
  if (!u.st_last || !u.st_cur) return 0;
  if (missed === null) return 0;
  return missed.length <= (u.st_shield || 0) ? u.st_cur : 0;
}
// 여러 사람(랭킹)용: 휴일 판단기를 한 번만 만들어 씀
export async function liveMany(env, db, rows, today = kstToday()) {
  const lasts = rows.map(r => r.st_last).filter(Boolean);
  if (!lasts.length) return rows.map(() => 0);
  const min = lasts.reduce((a, b) => a < b ? a : b), floor = addYmd(today, -LOOKBACK);
  const isSchool = await schoolDays(env, db, addYmd(min < floor ? floor : min, 1), addYmd(today, -1));
  return rows.map(u => {
    if (!u.st_last || !u.st_cur) return 0;
    if (u.st_last >= today) return u.st_cur;
    if (dayNo(today) - dayNo(u.st_last) > LOOKBACK) return 0;
    let miss = 0;
    for (let n = dayNo(u.st_last) + 1; n < dayNo(today); n++) if (isSchool(ymdOfNo(n))) miss++;
    return miss <= (u.st_shield || 0) ? u.st_cur : 0;
  });
}
// 이번 주(월~일) 출석 표시용 날짜 목록
export const weekOf = today => { const n = dayNo(today), mon = n - ((dowNo(n) + 6) % 7); return Array.from({ length: 7 }, (_, i) => ymdOfNo(mon + i)); };
