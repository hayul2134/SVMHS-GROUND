// 주간 미션(2026-10-27 하율: "주간 미션만, 종류를 늘려서 주마다 다르게, 클리어하면 뽑기권 총 5장, 게임·투표 같은 다른 기능을 쓰는 미션도")
// 화면(social.js)과 서버(functions/api/s)가 같이 씀. 미리보기 깃발 'week-mission' — 개발자만 먼저
// 주 = 월요일 0시(KST)부터 일요일 밤 12시까지(게임 주간 랭킹과 같은 주). 주(월요일 날짜)를 씨앗으로 모두 같은 미션 5개, 칸마다 후보 중 하나:
//   ① 게임 판 수 ② 게임 고르기 ③ 게임 도전 ④ 밸런스 게임 ⑤ 가벼운 기능(급식 투표·출석·뽑기·프로필)
// 2026-10-27 하율: 남에게 달린 미션(댓글 좋아요·팔로우)·부담되는 미션(DM)은 빼고 '전혀 부담 없는' 것만. 게임은 PLAY_MIN 기준을 넘은 판만 1판
// 미션 하나 = 뽑기권 MS.tix장(5개 = 5장). 검사에 걸려 보류된 게임 기록은 안 셈
import { HOME_MAX } from './home-score.js';
import { GEAR_MAX } from './gear-score.js';
import { STAIR_MAX } from './stair-score.js';
import { FILM_MAX } from './film-score.js';
import { BLAST_MAX } from './blast-score.js';

export const MS = { tix: 1, n: 5 };
// '1판'으로 쳐 주는 기준(2026-10-27 하율): 끝까지 해서 기록이 저장된 판(검사에 걸려 보류된 판은 제외) +
// 바로 죽어도 기록이 나는 게임은 최소 기록을 넘어야 함 — 2026-10-27 하율: '3분쯤 해야 나오는 점수'로
//   집에 가고 싶어! 6,000m(쉬지 않고 약 2분 55초 생존) · 기자재 정리! 3,000점(2026-10-27 하율: 1,500 → 3,000, 랭킹전 2분 안에)
// 반응속도·1 to 25·컷 타이밍은 5번(25칸)을 다 끝내야 기록이 나므로 끝까지 하면 1판
export const PLAY_MIN = { home: 6000, gear: 3000, stair: 50, film: 20, blast: 800 };   // 카메라 가방 정리!: 800점 넘게(2026-10-29 — 보통 실력 시뮬레이션으로 약 3분, 정식 공개 때 하율 확인)   // 필름 10: 20컷 넘게(2026-10-29 170→120칸에 맞춰 30→20, 정식 공개 때 하율 확인)   // 영상고 계단 오르기: 50칸 넘게 — 2026-10-28, 정식 공개 때 하율 확인   // 2026-10-27 하율: 기자재 정리! 1판 기준 1,500 → 3,000점("초보인데도 어렵지 않았어")
export const PLAY_RULE = '게임은 끝까지 해서 기록이 저장된 판만 1판으로 세요 · 집에 가고 싶어!는 6,000m, 기자재 정리!는 3,000점 넘게';
export function playCounts(game, v) {
  if (game === 'home') return HOME_MAX - v >= PLAY_MIN.home;
  if (game === 'gear') return GEAR_MAX - v >= PLAY_MIN.gear;
  if (game === 'stair') return STAIR_MAX - v >= PLAY_MIN.stair;
  if (game === 'film') return FILM_MAX - v >= PLAY_MIN.film;
  if (game === 'blast') return BLAST_MAX - v >= PLAY_MIN.blast;
  return true;
}
export const MS_NAME = { home: '집에 가고 싶어!', reaction: '반응속도', num25: '1 to 25', cut: '컷 타이밍', gear: '기자재 정리!', stair: '영상고 계단 오르기', film: '게퍼 10', blast: 'LED 월 켜기!', mine: '지뢰찾기', snake: '뱀 게임', n2048: '2048' };
// 목표 기록: v = 서버에 저장되는 값(작을수록 좋음)
const GOAL = {
  home: { t: '8,000m 넘게 달리기', ok: v => HOME_MAX - v >= 8000 },
  reaction: { t: '평균 280ms 안에 반응하기', ok: v => v <= 280 },
  num25: { t: '15초 안에 25까지 누르기', ok: v => v <= 15000 },
  cut: { t: '오차 합 150ms 안으로 자르기', ok: v => v <= 150 },
  gear: { t: '3,000점 넘게 정리하기', ok: v => GEAR_MAX - v >= 3000 },
  stair: { t: '150칸 넘게 오르기', ok: v => STAIR_MAX - v >= 150 },
  film: { t: '한 판에 65컷 넘게 자르기', ok: v => FILM_MAX - v >= 65 },
  blast: { t: '한 판에 3,000점 넘게 송출하기', ok: v => BLAST_MAX - v >= 3000 },
};
// 누적 미션(2026-10-27 하율: "주간 미션에 누적 점수 추가, 다른 게임들도"): 이번 주에 1판으로 친 판들을 더함
//   점수·거리가 있는 게임 = 점수·거리 합 · 시간 기록 게임(작을수록 좋음) = 기준 안에 든 '좋은 판' 횟수
const SUM = {
  blast: { amt: v => BLAST_MAX - v, n: [8000, 12000], u: '점', t: n => `이번 주 누적 ${n.toLocaleString('ko-KR')}점 송출하기` },
  film: { amt: v => FILM_MAX - v, n: [280, 420], u: '컷', t: n => `이번 주 누적 ${n.toLocaleString('ko-KR')}컷 자르기` },
  stair: { amt: v => STAIR_MAX - v, n: [1000, 1500], u: '칸', t: n => `이번 주 누적 ${n.toLocaleString('ko-KR')}칸 오르기` },
  gear: { amt: v => GEAR_MAX - v, n: [10000, 15000], u: '점', t: n => `이번 주 누적 ${n.toLocaleString('ko-KR')}점 송출하기` },
  home: { amt: v => HOME_MAX - v, n: [20000, 30000], u: 'm', t: n => `이번 주 누적 ${n.toLocaleString('ko-KR')}m 달리기` },
  reaction: { amt: v => v <= 300 ? 1 : 0, n: [5], u: '번', t: n => `평균 300ms 안에 든 판 ${n}번 모으기` },
  num25: { amt: v => v <= 20000 ? 1 : 0, n: [5], u: '번', t: n => `20초 안에 끝낸 판 ${n}번 모으기` },
  cut: { amt: v => v <= 200 ? 1 : 0, n: [5], u: '번', t: n => `오차 합 200ms 안에 든 판 ${n}번 모으기` },
};
// 미션 종류 → 진행을 올리는 행동(ev) · 화면 '하러 가기' 목적지(go, 없으면 그 게임)
export const KIND = {
  any: { ev: 'play', go: 'game' }, kinds: { ev: 'play', go: 'game' }, play: { ev: 'play' }, days: { ev: 'play', go: 'game' },
  goal: { ev: 'play' }, sum: { ev: 'play' }, best: { ev: 'play', go: 'game' },
  bal: { ev: 'bal', go: 'bal' }, balc: { ev: 'balc', go: 'bal' }, like: { ev: 'like', go: 'bal' }, meal: { ev: 'meal', go: 'meal' },
  att: { ev: 'att', go: 'att' }, dm: { ev: 'dm', go: 'friends' }, fol: { ev: 'fol', go: 'friends' }, gacha: { ev: 'gacha', go: 'gacha' }, prof: { ev: 'prof', go: 'edit' },
};
// 주 열쇠: 그 주 월요일 'YYYYMMDD'(KST)
export function weekKey(t = Date.now()) {
  const d = new Date(t + 9 * 3600e3), dow = (d.getUTCDay() + 6) % 7;   // 월 0 … 일 6
  return new Date(d.getTime() - dow * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
}
// 다음 주 미션까지 남은 시간(ms)
export const weekLeft = (t = Date.now()) => { const k = weekKey(t); return Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8) + 7) - 9 * 3600e3 - t; };

const seed = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// games = 모두가 할 수 있는 게임 키(미리보기 깃발 없는 것)
export function missionsOf(wk, games) {
  let s = seed('wk' + wk);
  const rnd = n => { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s % n; };
  const one = a => a[rnd(a.length)];
  const gs = games.filter(g => GOAL[g]), G = gs.length;
  const a = one([10, 15, 20]);
  const g2 = one(gs);
  const slot2 = one([
    { k: 'kinds', n: G, t: `게임 ${G}종류 모두 한 판씩 해 보기` },
    { k: 'play', g: g2, n: 5, t: `${MS_NAME[g2]} 5판 하기` },
    { k: 'days', n: 3, t: '서로 다른 3일 동안 게임하기' },
  ]);
  let g3 = one(gs); if (g3 === slot2.g && G > 1) g3 = gs[(gs.indexOf(g3) + 1) % G];
  const slot3 = one([
    { k: 'goal', g: g3, n: 1, t: `${MS_NAME[g3]} · ${GOAL[g3].t}` },
    { k: 'goal', g: g3, n: 1, t: `${MS_NAME[g3]} · ${GOAL[g3].t}` },
    { k: 'play', g: g3, n: 3, t: `${MS_NAME[g3]} 3판 하기` },   // 2026-10-27 하율: '최고 기록 2번 깨기'는 기록이 높으면 너무 어려워 뺌
    (() => { const sn = one(SUM[g3].n); return { k: 'sum', g: g3, n: sn, u: SUM[g3].u, t: `${MS_NAME[g3]} · ${SUM[g3].t(sn)}` }; })(),
  ]);
  const slot4 = one([
    { k: 'bal', n: 3, t: '밸런스 게임 3번 참여하기 (하루 한 번)' },
    { k: 'balc', n: 3, t: '밸런스 게임에 3일 동안 댓글 달기' },
  ]);
  const slot5 = one([
    { k: 'meal', n: 3, t: '하루에 한 번씩 3일 동안 급식 투표하기' },
    { k: 'att', n: 3, t: '이번 주 3일 출석하기' },
    { k: 'gacha', n: 3, t: '캡슐 뽑기 3번 하기' },
    { k: 'prof', n: 1, t: '프로필 꾸미고 저장하기' },
  ]);
  return [{ k: 'any', n: a, t: `아무 게임이나 ${a}판 하기` }, slot2, slot3, slot4, slot5];
}
// 진행 상황 p = { c: {play, best, att, gacha, prof}, g: {게임: 판 수}, ok: {게임: 1}, s: {days, bal, balc, meal, like, dm, fol: [중복 없는 값]}, d: [미션별 끝남] }
const len = (p, k) => (p.s?.[k] || []).length;
export function progOf(m, p) {
  const c = p.c || {}, v = {
    any: c.play, kinds: Object.keys(p.g || {}).length, play: p.g?.[m.g], days: len(p, 'days'), goal: p.ok?.[m.g] ? 1 : 0, best: c.best, sum: p.sm?.[m.g] || 0,
    bal: len(p, 'bal'), balc: len(p, 'balc'), meal: len(p, 'meal'), like: len(p, 'like'), att: c.att, dm: len(p, 'dm'), fol: len(p, 'fol'), gacha: c.gacha, prof: c.prof,
  }[m.k] || 0;
  return Math.min(m.n, v);
}
// 행동 하나 반영 → 새 p(원본은 안 바꿈). ev: play {game, v, best, day} · bal·balc·meal {day} · like {id} · att · dm {to} · fol {to} · gacha {n} · prof
export function applyEv(p, ev, x = {}) {
  const q = { c: { ...(p.c || {}) }, g: { ...(p.g || {}) }, ok: { ...(p.ok || {}) }, sm: { ...(p.sm || {}) }, s: { ...(p.s || {}) }, d: [...(p.d || [])] };
  const inc = (k, n = 1) => { q.c[k] = (q.c[k] || 0) + n; };
  const add = (k, v) => { const a = q.s[k] || []; if (!a.includes(v) && a.length < 20) q.s[k] = [...a, v]; };
  if (ev === 'play') {
    inc('play'); q.g[x.game] = (q.g[x.game] || 0) + 1; add('days', x.day);
    if (GOAL[x.game]?.ok(x.v)) q.ok[x.game] = 1;
    if (SUM[x.game]) q.sm[x.game] = (q.sm[x.game] || 0) + Math.max(0, SUM[x.game].amt(x.v));   // 누적
    if (x.best) inc('best');
  } else if (ev === 'bal' || ev === 'balc' || ev === 'meal') add(ev, x.day);   // 날짜 수로 셈(하루 여러 번 해도 1)
  else if (ev === 'like') add('like', x.id);
  else if (ev === 'dm') add('dm', x.to);
  else if (ev === 'fol') add('fol', x.to);
  else if (ev === 'gacha') inc('gacha', x.n || 1);
  else inc(ev);   // att · prof
  return q;
}
