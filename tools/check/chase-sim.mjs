// 카체이싱! 난이도 시뮬레이션 (2026-10-31) — node tools/check/chase-sim.mjs [판 수]
// 봇 실력 3단계(반응 지연·앞을 보는 거리·실수)로 판을 돌려 거리·점수·시간·끝난 이유 분포를 보고, 입력 기록을 서버 simulate로 다시 돌려 같은지·걸린 시간을 잰다.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const C = await import(pathToFileURL(resolve('public/js/chase-score.js')).href);
const N = +process.argv[2] || 30;

import { bot, SK } from './chase-bot.mjs';
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
// 나눠 다시 돌리기(서버 chasechk): CHUNK_F씩 돌리고 판 상태를 JSON으로 저장했다 다시 읽어 이어 돌려도 한 번에 돌린 것과 같은지
{
  let bad = 0, maxMs = 0;
  for (let i = 0; i < 8; i++) {
    const seed = 4242 + i, { rounds } = bot(seed, SK.잘함), full = C.simulate(seed, rounds);
    let ctx = JSON.parse(JSON.stringify(C.simBegin(seed))), x = null, calls = 0;
    while (!x) { const t0 = performance.now(); x = C.simRun(ctx, rounds, C.CHUNK_F); maxMs = Math.max(maxMs, performance.now() - t0); ctx = JSON.parse(JSON.stringify(ctx)); calls++; }
    if (JSON.stringify(x) !== JSON.stringify(full)) { bad++; console.log('나눠 돌리기 불일치!', seed, x, full); }
  }
  console.log(bad ? '❌ 나눠 돌리기 불일치 ' + bad : `✅ 나눠 돌리기 8판 일치 · 한 번(${C.CHUNK_F}프레임) 최대 ${maxMs.toFixed(1)}ms`);
  if (bad) process.exit(1);
}
