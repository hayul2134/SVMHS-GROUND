// SVMHS GROUND — 나이스 API 프록시 (Cloudflare Pages Functions, /api/* 담당)
// 인증키는 Pages 프로젝트의 비밀 변수 NEIS_KEY에 보관한다. 키가 없어도 동작하지만 한 번에 5건까지만 받는다.

const SCHOOL = { ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '7010795' }; // 서울시교육청 · 서울영상고

// 서비스별로 넘겨줄 수 있는 파라미터 (그 외는 버림)
const COMMON = ['pIndex', 'pSize'];
const SERVICES = {
  mealServiceDietInfo: ['MLSV_YMD', 'MLSV_FROM_YMD', 'MLSV_TO_YMD', 'MMEAL_SC_CODE'],
  hisTimetable: ['AY', 'SEM', 'GRADE', 'CLASS_NM', 'ALL_TI_YMD', 'TI_FROM_YMD', 'TI_TO_YMD'],
  SchoolSchedule: ['AA_YMD', 'AA_FROM_YMD', 'AA_TO_YMD'],
  classInfo: ['AY', 'GRADE'],
};
const VALUE_RE = /^\d{1,8}$/;  // 날짜·학년·반·코드 모두 숫자 8자리 이하
const MAX_PSIZE = 1000;

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
};
const json = (obj, status = 200, cache = 'no-store') => new Response(JSON.stringify(obj), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, ...SECURITY_HEADERS },
});

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD', ...SECURITY_HEADERS } });
  }
  const path = (params.path || []).join('/');

  if (path === 'config') return json({ hasKey: Boolean(env.NEIS_KEY) }, 200, 'public, max-age=300');

  const m = path.match(/^neis\/(\w+)$/);
  const allowed = m && SERVICES[m[1]];
  if (!allowed) return json({ error: 'not found' }, 404);
  const svc = m[1];

  // 허용된 파라미터만, 숫자 값만 통과 → 캐시 키도 깔끔해진다
  const src = new URL(request.url).searchParams;
  const q = new URLSearchParams({ Type: 'json', ...SCHOOL });
  for (const name of [...COMMON, ...allowed].sort()) {
    const v = src.get(name);
    if (v == null) continue;
    if (!VALUE_RE.test(v)) return json({ error: `bad parameter: ${name}` }, 400);
    q.set(name, name === 'pSize' ? String(Math.min(+v || 1, MAX_PSIZE)) : v);
  }
  if (env.NEIS_KEY) q.set('KEY', env.NEIS_KEY);

  try {
    const res = await fetch(`https://open.neis.go.kr/hub/${svc}?${q}`, { cf: { cacheTtl: 1800, cacheEverything: true } });
    if (!res.ok) return json({ error: 'upstream error' }, 502);
    const body = await res.text();
    return new Response(body, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600', ...SECURITY_HEADERS },
    });
  } catch {
    return json({ error: 'upstream failed' }, 502);
  }
}
