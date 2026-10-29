// /api/* 요청(정적 파일엔 안 돎 — 요청 수 한도 보호): D1 사용량 계량(lib/meter.js) — 학생 사이트 우선권(hayul-analyze가 usage 표를 보고 양보)
import { meterDB, flushUsage } from '../../lib/meter.js';
export async function onRequest(ctx) {
  try { if (ctx.env.DB) { const u = new URL(ctx.request.url).pathname.split('/').slice(2, 4).join('/'); ctx.env.DB = meterDB(ctx.env.DB, ctx.request.method + ' ' + u.slice(0, 40)); } } catch {}   // env를 못 바꾸는 환경이면 계량만 빠지고 사이트는 그대로
  const res = await ctx.next();
  try { if (ctx.env.DB?._metered) ctx.waitUntil(flushUsage(ctx.env.DB)); } catch {}
  return res;
}
