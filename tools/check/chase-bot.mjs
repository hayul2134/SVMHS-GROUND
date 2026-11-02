// 카체이싱! 봇(chase-sim.mjs 난이도 시뮬레이션·score-smoke.mjs 긴 판 검사에서 같이 씀)
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const C = await import(pathToFileURL(resolve('public/js/chase-score.js')).href);
// 봇: 판단할 때마다 판을 복사해 몇 가지 행동(왼쪽·가만히·오른쪽 × 점프 여부)을 미리 돌려 보고 가장 오래 버티는 쪽을 고름.
// react = 판단 주기(프레임) · hz = 미리 보는 프레임 · err = 판단을 망칠 확률(그 사이 가만히)
export function bot(seed, skill) {
  const s = C.newSim(seed), evs = [];
  let t = 0;
  const A = [[0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [-2, 0], [2, 0]];   // [차선 이동, 점프]
  const act = (c, a, rec) => {
    for (let i = 0; i < Math.abs(a[0]); i++) { const code = a[0] < 0 ? 0 : 2; if (rec) evs.push(C.enc(c.f, code)); C.input(c, code); }
    if (a[1]) { if (rec) evs.push(C.enc(c.f, 4)); C.input(c, 4); }
  };
  const val = (a, j2 = -1) => {
    const c = structuredClone(s); c.fx = false; act(c, a, false);
    let k = 0;
    for (; k < skill.hz && !c.over; k++) { if (k === j2) C.input(c, 4); C.step(c); }
    return (c.over ? k * 100 : skill.hz * 100 + 1000) + C.scoreOf(c) * 0.5 + c.fuel * (s.fuel < 45 ? 3 : 0.3) - (a[1] ? 30 : 0) - Math.abs(a[0]) * 4 - Math.abs(c.p.lane - 2) * 3;
  };
  const valW = a => { let v = val(a); if (!a[1] && s.items.some(it => it.t === 'wall' && !it.got)) for (let j = skill.react; j < skill.hz; j += skill.react) v = Math.max(v, val(a, j) - 30); return v; };
  while (!s.over && s.f < C.MAX_F) {
    if (t <= 0) {
      t = skill.react;
      if (Math.random() > skill.err) { let bv = -Infinity, best = A[0]; for (const a of A) { const v = valW(a); if (v > bv) { bv = v; best = a; } } act(s, best, true); }
    }
    t--;
    C.step(s);
  }
  return { s, rounds: [s.overF, ...evs] };
}

export const SK = { 잘함: { react: 8, hz: 75, err: 0.01 }, 보통: { react: 12, hz: 60, err: 0.04 }, 처음: { react: 16, hz: 50, err: 0.08 } };
