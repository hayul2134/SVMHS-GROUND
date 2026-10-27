// 주간 미션(2026-10-27 하율: "주간 미션만, 종류를 늘려서 주마다 다르게, 클리어하면 뽑기권 총 5장, 게임·투표 같은 다른 기능을 쓰는 미션도")
// 화면(social.js)과 서버(functions/api/s)가 같이 씀. 미리보기 깃발 'week-mission' — 개발자만 먼저
// 주 = 월요일 0시(KST)부터 일요일 밤 12시까지(게임 주간 랭킹과 같은 주). 주(월요일 날짜)를 씨앗으로 모두 같은 미션 5개, 칸마다 후보 중 하나:
//   ① 게임 판 수 ② 게임 고르기 ③ 게임 도전 ④ 밸런스 게임 ⑤ 사이트 기능(출석·DM·팔로우·뽑기·프로필)
// 미션 하나 = 뽑기권 MS.tix장(5개 = 5장). 검사에 걸려 보류된 게임 기록은 안 셈
import { HOME_MAX } from './home-score.js';
import { GEAR_MAX } from './gear-score.js';

export const MS = { tix: 1, n: 5 };
export const MS_NAME = { home: '집에 가고 싶어!', reaction: '반응속도', num25: '1 to 25', cut: '컷 타이밍', gear: '기자재 정리!' };
// 목표 기록: v = 서버에 저장되는 값(작을수록 좋음)
const GOAL = {
  home: { t: '1,000m 넘게 달리기', ok: v => HOME_MAX - v >= 1000 },
  reaction: { t: '평균 280ms 안에 반응하기', ok: v => v <= 280 },
  num25: { t: '15초 안에 25까지 누르기', ok: v => v <= 15000 },
  cut: { t: '오차 합 150ms 안으로 자르기', ok: v => v <= 150 },
  gear: { t: '3,000점 넘게 정리하기', ok: v => GEAR_MAX - v >= 3000 },
};
// 미션 종류 → 진행을 올리는 행동(ev) · 화면 '하러 가기' 목적지(go, 없으면 그 게임)
export const KIND = {
  any: { ev: 'play', go: 'game' }, kinds: { ev: 'play', go: 'game' }, play: { ev: 'play' }, days: { ev: 'play', go: 'game' },
  goal: { ev: 'play' }, best: { ev: 'play', go: 'game' },
  bal: { ev: 'bal', go: 'bal' }, balc: { ev: 'balc', go: 'bal' }, like: { ev: 'like', go: 'bal' },
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
    { k: 'best', n: 2, t: '내 최고 기록 2번 깨기' },
  ]);
  const slot4 = one([
    { k: 'bal', n: 3, t: '밸런스 게임 3일 투표하기' },
    { k: 'balc', n: 2, t: '밸런스 게임에 댓글 2개 남기기' },
    { k: 'like', n: 3, t: '밸런스 댓글 3개에 좋아요 누르기' },
  ]);
  const slot5 = one([
    { k: 'att', n: 3, t: '이번 주 3일 출석하기' },
    { k: 'dm', n: 2, t: '친구 2명에게 DM 보내기' },
    { k: 'fol', n: 1, t: '새 친구 1명 팔로우하기' },
    { k: 'gacha', n: 3, t: '캡슐 뽑기 3번 하기' },
    { k: 'prof', n: 1, t: '프로필 꾸미고 저장하기' },
  ]);
  return [{ k: 'any', n: a, t: `아무 게임이나 ${a}판 하기` }, slot2, slot3, slot4, slot5];
}
// 진행 상황 p = { c: {play, best, balc, att, gacha, prof}, g: {게임: 판 수}, ok: {게임: 1}, s: {days, bal, like, dm, fol: [중복 없는 값]}, d: [미션별 끝남] }
const len = (p, k) => (p.s?.[k] || []).length;
export function progOf(m, p) {
  const c = p.c || {}, v = {
    any: c.play, kinds: Object.keys(p.g || {}).length, play: p.g?.[m.g], days: len(p, 'days'), goal: p.ok?.[m.g] ? 1 : 0, best: c.best,
    bal: len(p, 'bal'), balc: c.balc, like: len(p, 'like'), att: c.att, dm: len(p, 'dm'), fol: len(p, 'fol'), gacha: c.gacha, prof: c.prof,
  }[m.k] || 0;
  return Math.min(m.n, v);
}
// 행동 하나 반영 → 새 p(원본은 안 바꿈). ev: play {game, v, best, day} · bal {day} · balc · like {id} · att · dm {to} · fol {to} · gacha {n} · prof
export function applyEv(p, ev, x = {}) {
  const q = { c: { ...(p.c || {}) }, g: { ...(p.g || {}) }, ok: { ...(p.ok || {}) }, s: { ...(p.s || {}) }, d: [...(p.d || [])] };
  const inc = (k, n = 1) => { q.c[k] = (q.c[k] || 0) + n; };
  const add = (k, v) => { const a = q.s[k] || []; if (!a.includes(v) && a.length < 20) q.s[k] = [...a, v]; };
  if (ev === 'play') {
    inc('play'); q.g[x.game] = (q.g[x.game] || 0) + 1; add('days', x.day);
    if (GOAL[x.game]?.ok(x.v)) q.ok[x.game] = 1;
    if (x.best) inc('best');
  } else if (ev === 'bal') add('bal', x.day);
  else if (ev === 'like') add('like', x.id);
  else if (ev === 'dm') add('dm', x.to);
  else if (ev === 'fol') add('fol', x.to);
  else if (ev === 'gacha') inc('gacha', x.n || 1);
  else inc(ev);   // balc · att · prof
  return q;
}
