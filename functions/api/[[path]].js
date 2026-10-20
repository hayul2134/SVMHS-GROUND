// SVMHS GROUND — 나이스 API 프록시 (Cloudflare Pages Functions)
// 인증키는 Pages 프로젝트의 환경 변수(비밀) NEIS_KEY에 보관합니다.
const ALLOWED = new Set(['mealServiceDietInfo', 'hisTimetable', 'SchoolSchedule', 'classInfo']);
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (url.pathname === '/api/config') return json({ hasKey: Boolean(env.NEIS_KEY) });
  if (url.pathname.startsWith('/api/neis/')) {
    const svc = url.pathname.slice('/api/neis/'.length);
    if (!ALLOWED.has(svc)) return json({ error: 'not allowed' }, 404);
    const q = new URLSearchParams(url.search);
    q.delete('KEY');
    q.set('Type', 'json');
    q.set('ATPT_OFCDC_SC_CODE', 'B10');
    q.set('SD_SCHUL_CODE', '7010795');
    if (env.NEIS_KEY) q.set('KEY', env.NEIS_KEY);
    try {
      const res = await fetch(`https://open.neis.go.kr/hub/${svc}?${q}`, { cf: { cacheTtl: 1800, cacheEverything: true } });
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600' },
      });
    } catch {
      return json({ error: 'upstream failed' }, 502);
    }
  }
  return json({ error: 'not found' }, 404);
}
