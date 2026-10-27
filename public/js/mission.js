// 오늘의 미션(2026-10-27 하율: "게임으로 일일 미션 만들어서 티켓을 얻을 수 있게") — 화면(social.js)과 서버(functions/api/s)가 같이 씀
// 하루(KST 날짜)마다 모두 같은 미션 3개: ① 판 수 ② 게임 고르기(서로 다른 게임·특정 게임 판 수) ③ 도전(목표 기록·내 최고 기록 경신)
// 보상: 미션 하나 = 조각 MS.shard개 · 3개 모두 = 뽑기권 MS.tix장. 검사에 걸려 보류된 판은 안 셈
// 미리보기 깃발 'daily-mission' — 개발자만 먼저
import { HOME_MAX } from './home-score.js';
import { GEAR_MAX } from './gear-score.js';

export const MS = { shard: 2, tix: 1 };
// 목표 기록: v = 서버에 저장되는 값(작을수록 좋음)
const GOAL = {
  home: { t: '500m 넘게 달리기', ok: v => HOME_MAX - v >= 500 },
  reaction: { t: '평균 300ms 안에 반응하기', ok: v => v <= 300 },
  num25: { t: '20초 안에 25까지 누르기', ok: v => v <= 20000 },
  cut: { t: '오차 합 200ms 안으로 자르기', ok: v => v <= 200 },
  gear: { t: '2,000점 넘게 정리하기', ok: v => GEAR_MAX - v >= 2000 },
};
export const MS_NAME = { home: '집에 가고 싶어!', reaction: '반응속도', num25: '1 to 25', cut: '컷 타이밍', gear: '반납 5분 전!' };
// 미션에 나오는 게임: 모두가 할 수 있는 게임만(games = 미리보기 깃발이 없는 게임 키 목록)
const seed = ymd => { let h = 2166136261; for (const c of ymd) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export function missionsOf(ymd, games) {
  let s = seed(ymd);
  const rnd = n => { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s % n; };
  const gs = games.filter(g => GOAL[g]), pick = () => gs[rnd(gs.length)];
  const n1 = [3, 4, 5][rnd(3)];
  const a = { k: 'any', n: n1, t: `아무 게임이나 ${n1}판 하기` };
  let b;
  if (rnd(2)) b = { k: 'kinds', n: 3, t: '서로 다른 게임 3개 해 보기' };
  else { const g = pick(); b = { k: 'play', g, n: 2, t: `${MS_NAME[g]} 2판 하기` }; }
  let c;
  if (rnd(4) === 0) c = { k: 'best', n: 1, t: '아무 게임이나 내 최고 기록 깨기' };
  else { let g = pick(); if (b.g === g && gs.length > 1) g = gs[(gs.indexOf(g) + 1) % gs.length]; c = { k: 'goal', g, n: 1, t: `${MS_NAME[g]} · ${GOAL[g].t}` }; }
  return [a, b, c];
}
// 진행 상황 p = { n: 오늘 판 수, g: {게임: 판 수}, ok: {g: 목표 달성}, best: 최고 기록 경신, d: [미션별 끝남 0/1] }
export function progOf(m, p) {
  if (m.k === 'any') return Math.min(m.n, p.n || 0);
  if (m.k === 'kinds') return Math.min(m.n, Object.keys(p.g || {}).length);
  if (m.k === 'play') return Math.min(m.n, p.g?.[m.g] || 0);
  if (m.k === 'goal') return p.ok?.[m.g] ? 1 : 0;
  if (m.k === 'best') return p.best ? 1 : 0;
  return 0;
}
// 한 판 기록 반영: 새 p 반환(원본은 안 바꿈)
export function addPlay(p, game, v, newBest) {
  const q = { n: (p.n || 0) + 1, g: { ...(p.g || {}) }, ok: { ...(p.ok || {}) }, best: !!p.best || !!newBest, d: [...(p.d || [0, 0, 0])] };
  q.g[game] = (q.g[game] || 0) + 1;
  if (GOAL[game]?.ok(v)) q.ok[game] = 1;
  return q;
}
