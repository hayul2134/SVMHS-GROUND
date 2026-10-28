/* 읽기 절약 캐시(2026-10-29 DB 한도 초과 대책): isolate 메모리 + Cloudflare Cache API(같은 데이터센터의 모든 isolate가 같이 씀, 무료)
   랭킹·티어·관리자 집계처럼 여러 학생이 같은 값을 반복해서 묻는 계산만 — 몇십 초 늦어도 되는 것에만 쓸 것 */
import { today } from './meter.js';
const mem = new Map();
/* 자동 절약 모드: 오늘(UTC) 이 사이트가 읽은 행이 많아지면 캐시를 더 오래 씀 — 학생 화면은 그대로, 순위·집계만 조금 늦게 바뀜 */
const stretch = () => { const r = today().r; return r > 3.3e6 ? 10 : r > 2.5e6 ? 4 : r > 1.8e6 ? 2 : 1; };
const KEY = k => new Request('https://cache.svmhs-ground.internal/' + encodeURIComponent(k));
export async function cached(key, ttlSec, fn, ctx) {
  ttlSec *= stretch();
  const m = mem.get(key);
  if (m && m.exp > Date.now()) return m.v;
  let c = null;
  try { c = await caches.default.match(KEY(key)); } catch {}
  if (c) { try { const v = await c.json(); mem.set(key, { v, exp: Date.now() + Math.min(ttlSec, 15) * 1e3 }); return v; } catch {} }
  const v = await fn();
  mem.set(key, { v, exp: Date.now() + ttlSec * 1e3 });
  if (mem.size > 500) mem.delete(mem.keys().next().value);
  try {
    const p = caches.default.put(KEY(key), new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttlSec}` } }));
    ctx?.waitUntil ? ctx.waitUntil(p) : await p;
  } catch {}
  return v;
}
export const forget = prefix => { for (const k of mem.keys()) if (k.startsWith(prefix)) mem.delete(k); };
