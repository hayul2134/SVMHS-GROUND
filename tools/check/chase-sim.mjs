// 카체이싱! 난이도 시뮬레이션 (2026-10-31) — node tools/check/chase-sim.mjs [판 수]
// 봇 실력 3단계(반응 지연·앞을 보는 거리·실수)로 판을 돌려 거리·점수·시간·끝난 이유 분포를 보고, 입력 기록을 서버 simulate로 다시 돌려 같은지·걸린 시간을 잰다.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const C = await import(pathToFileURL(resolve('public/js/chase-score.js')).href);
const N = +process.argv[2] || 30;

// 봇: 판단할 때마다 판을 복사해 몇 가지 행동(왼쪽·가만히·오른쪽 × 점프 여부)을 미리 돌려 보고 가장 오래 버티는 쪽을 고름.
// react = 판단 주기(프레임) · hz = 미리 보는 프레임 · err = 판단을 망칠 확률(그 사이 가만히)
export function bot(seed, skill) {
  const s = C.newSim(seed), evs = [];
  let L = 0, R = 0, t = 0, plan = [0, 0, 0, 1];
  const set = (l, r) => {
    if (l !== L) { evs.push(C.enc(s.f, l ? 0 : 1)); C.input(s, l ? 0 : 1); L = l; }
    if (r !== R) { evs.push(C.enc(s.f, r ? 2 : 3)); C.input(s, r ? 2 : 3); R = r; }
  };
  const A = []; for (const d of [-1, 0, 1]) for (const du of [1, 2, 3]) for (const j of [0, 1]) if (!(d === 0 && du > 1)) A.push([d < 0 ? 1 : 0, d > 0 ? 1 : 0, j, du]);
  const val = (a, j2 = -1) => {   // j2 = 나중에 점프할 프레임(바리케이드가 있을 때 '지금 말고 조금 뒤 점프'도 따져 봄)
    const c = structuredClone(s); c.fx = false;
    if (c.L !== a[0]) C.input(c, a[0] ? 0 : 1); if (c.R !== a[1]) C.input(c, a[1] ? 2 : 3); if (a[2]) C.input(c, 4);
    let k = 0;
    for (; k < skill.hz && !c.over; k++) { if (k === skill.react * a[3]) { C.input(c, 1); C.input(c, 3); } if (k === j2) C.input(c, 4); C.step(c); }
    const mid = Math.abs(c.p.x - 180) * 0.6;
    return (c.over ? k * 100 : skill.hz * 100 + 1000) + C.scoreOf(c) * 0.5 + c.fuel * (s.fuel < 45 ? 3 : 0.3) - (a[2] ? 30 : 0) - mid - (c.p.cd > 0 && !c.over ? 5 : 0);
  };
  const valW = a => { let v = val(a); if (!a[2] && s.items.some(it => it.t === 'wall' && !it.got)) for (let j = skill.react; j < skill.hz; j += skill.react) v = Math.max(v, val(a, j) - 30); return v; };
  let left = 0;
  while (!s.over && s.f < C.MAX_F) {
    if (t <= 0) {
      t = skill.react;
      if (Math.random() > skill.err) { let bv = -Infinity; for (const a of A) { const v = valW(a); if (v > bv) { bv = v; plan = a; } } }
      else plan = [0, 0, 0, 1];
      set(plan[0], plan[1]); left = skill.react * plan[3];
      if (plan[2]) { evs.push(C.enc(s.f, 4)); C.input(s, 4); plan = [plan[0], plan[1], 0]; }
    }
    t--; if (--left === 0) set(0, 0);
    C.step(s);
  }
  return { s, rounds: [s.overF, ...evs] };
}

const SK = { 잘함: { react: 8, hz: 75, err: 0.01 }, 보통: { react: 12, hz: 60, err: 0.04 }, 처음: { react: 16, hz: 50, err: 0.08 } };
for (const [nm, sk] of Object.entries(SK)) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const seed = (i * 2654435761) >>> 0, { s, rounds } = bot(seed, sk);
    C.simulate(seed, rounds); const t0 = performance.now(), x = C.simulate(seed, rounds), ms = performance.now() - t0;
    if (process.env.DBG && x.why !== 'fuel') console.log(nm, x.why, 'm', x.m, 'px', s.p.x.toFixed(0), 'air', s.p.air, 'cd', s.p.cd, 'v', s.v.toFixed(0), JSON.stringify(s.cars.filter(c => Math.abs(c.y - C.PY) < 120).map(c => [c.k, Math.round(c.x), Math.round(c.y), c.lane, c.to, c.mv, c.blink, Math.round(s.v - c.spd)])), JSON.stringify(s.items.filter(c => !c.got && Math.abs(c.y - C.PY) < 120).map(c => [c.t, Math.round(c.x), Math.round(c.y)])));
    if (x.err || x.score !== C.scoreOf(s)) { console.log('불일치!', nm, i, x, C.scoreOf(s)); process.exit(1); }
    out.push({ m: x.m, sc: x.score, sec: x.f / 60, why: x.why, near: x.near, combo: x.maxCombo, boost: x.boosts, ev: rounds.length, ms });
  }
  const q = (k, p) => { const a = out.map(o => o[k]).sort((a, b) => a - b); return a[Math.floor((a.length - 1) * p)]; };
  const why = {}; out.forEach(o => why[o.why] = (why[o.why] || 0) + 1);
  console.log(`${nm}: 거리 m 중앙 ${q('m', .5)} (10% ${q('m', .1)} · 90% ${q('m', .9)}) · 점수 중앙 ${q('sc', .5)} (90% ${q('sc', .9)} · 최대 ${q('sc', 1)}) · 시간 중앙 ${q('sec', .5).toFixed(0)}초 (최대 ${q('sec', 1).toFixed(0)}초) · 아슬 ${q('near', .5)} · 최대콤보 ${q('combo', .9)} · 부스터 ${q('boost', .5)} · 입력 ${q('ev', .9)} · 서버 다시 돌리기 ${q('ms', .5).toFixed(1)}ms(최대 ${q('ms', 1).toFixed(1)}) · 끝 ${JSON.stringify(why)}`);
}
// 서버 부담: 긴 판 하나를 여러 번 다시 돌려 프레임당 시간
{
  let best = null;
  for (let i = 0; i < 6; i++) { const seed = 777 + i, r = bot(seed, SK.잘함); if (!best || r.s.overF > best.r.s.overF) best = { seed, r }; }
  const rounds = best.r.rounds; let t = 0; const N2 = 20;
  for (let i = 0; i < N2; i++) { const t0 = performance.now(); C.simulate(best.seed, rounds); t += performance.now() - t0; }
  if (process.env.SAVE) (await import('node:fs')).writeFileSync('/tmp/long.json', JSON.stringify({ seed: best.seed, rounds }));
  console.log(`긴 판 ${(rounds[0] / 60).toFixed(0)}초: 다시 돌리기 평균 ${(t / N2).toFixed(1)}ms · 프레임당 ${(t / N2 * 1000 / rounds[0]).toFixed(2)}µs`);
}
