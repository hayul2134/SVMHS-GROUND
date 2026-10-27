// SVMHS GROUND — 나이스 API 프록시 (Cloudflare Pages Functions, /api/* 담당)
// 인증키는 Pages 프로젝트의 비밀 변수 NEIS_KEY에 보관한다. 키가 없어도 동작하지만 한 번에 5건까지만 받는다.
import { setup, getSettings, kstYmd, limited, ipKey, isWriteLimit, LIMIT_MSG, logErr } from '../../lib/db.js';

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
  const path = (params.path || []).join('/');
  if (path === 'vote' || path === 'notice' || path === 'notices') {
    try { return await { vote, notice: (_, e) => notice(e), notices: (_, e) => notices(e) }[path](request, env); }
    catch (e) {
      console.error(e);
      if (!isWriteLimit(e)) await logErr(env.DB, 'api', request, e);
      return json(isWriteLimit(e) ? { error: LIMIT_MSG, limit: true } : { error: '잠시 후 다시 시도해 주세요' }, isWriteLimit(e) ? 503 : 500);
    }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD', ...SECURITY_HEADERS } });
  }

  if (path === 'config') return json({ hasKey: Boolean(env.NEIS_KEY) }, 200, 'public, max-age=300');

  // 나이스 프록시는 이 사이트 화면에서만 (다른 사이트가 우리 인증키로 대량 조회하지 못하게)
  if (request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'forbidden' }, 403);
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

  // 나이스는 가끔 몇 초씩 530·502 같은 일시 오류를 냄 → 최대 3번(0.4초·1.2초 간격) 시도하고, 끝내 실패할 때만 오류 기록
  // 실패 응답은 캐시하지 않음(cacheTtlByStatus) → 한 번 실패가 30분 동안 남지 않게
  const url = `https://open.neis.go.kr/hub/${svc}?${q}`;
  let last = '';
  for (let i = 0; i < 3; i++) {
    if (i) await new Promise(r => setTimeout(r, i === 1 ? 400 : 1200));
    try {
      const res = await fetch(url, { cf: { cacheTtlByStatus: { '200-299': 1800, '300-599': 0 }, cacheEverything: true }, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const body = await res.text();
        return new Response(body, {
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600', ...SECURITY_HEADERS },
        });
      }
      last = `나이스 응답 ${res.status}`;
      if (res.status < 500 && res.status !== 429) break; // 요청 자체가 잘못된 경우는 다시 해도 같음
    } catch (e) {
      last = `나이스 연결 실패: ${e?.message || e}`;
    }
  }
  await logErr(env.DB, 'neis', request, `${last} (3번 시도)`);
  return json({ error: 'upstream error' }, 502);
}

/* ===== 급식 인기투표 (D1 바인딩 DB 필요) =====
   한 기기(브라우저에 저장된 무작위 ID)당 끼니마다 한 표. 다시 누르면 바꾸거나 취소. 투표는 '오늘(한국 시간)' 급식만. */
const MEAL_CODES = ['1', '2', '3'];
// 급식 투표 마감: 그날 밤 11시 50분(KST) — 하교 후 집에서도 그날 급식에 투표 (2026-10-27 하율)
const MEAL_CLOSE_MIN = 23 * 60 + 50;
const mealCloses = (t = Date.now()) => { const y = kstYmd(t); return Date.UTC(+y.slice(0, 4), +y.slice(4, 6) - 1, +y.slice(6, 8)) - 9 * 3600e3 + MEAL_CLOSE_MIN * 60e3; };
const VOTER_RE = /^[a-z0-9]{20,40}$/;
const cleanDish = s => String(s || '').split(/<br\s*\/?>/i).map(x => x.replace(/\([\d.\s]*\)/g, '').replace(/[*#]/g, '').trim()).filter(Boolean);

async function tally(db, ymd, voter) {
  const { results } = await db.prepare('SELECT meal, dish, COUNT(*) AS n FROM meal_votes WHERE ymd = ?1 GROUP BY meal, dish').bind(ymd).all();
  const mine = voter ? (await db.prepare('SELECT meal, dish FROM meal_votes WHERE ymd = ?1 AND voter = ?2').bind(ymd, voter).all()).results : [];
  const meals = {};
  for (const r of results) { const m = meals[r.meal] ||= { counts: {}, total: 0, mine: '' }; m.counts[r.dish] = r.n; m.total += r.n; }
  for (const r of mine) (meals[r.meal] ||= { counts: {}, total: 0, mine: '' }).mine = r.dish;
  return meals;
}

async function menuOf(env, ymd, meal) {
  const q = new URLSearchParams({ Type: 'json', ...SCHOOL, MLSV_YMD: ymd, MMEAL_SC_CODE: meal });
  if (env.NEIS_KEY) q.set('KEY', env.NEIS_KEY);
  const res = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?${q}`, { cf: { cacheTtl: 1800, cacheEverything: true } });
  if (!res.ok) throw new Error('upstream');
  const row = (await res.json()).mealServiceDietInfo?.[1]?.row?.[0];
  return row ? cleanDish(row.DDISH_NM) : [];
}

async function vote(request, env) {
  if (!env.DB) return json({ enabled: false });
  const db = env.DB, url = new URL(request.url);
  await setup(db);
  const voter = request.headers.get('x-voter') || '';
  const okVoter = VOTER_RE.test(voter);

  if (request.method === 'GET') {
    const ymd = url.searchParams.get('ymd') || '';
    if (!/^\d{8}$/.test(ymd)) return json({ error: 'bad ymd' }, 400);
    return json({ enabled: true, today: kstYmd(), closes: mealCloses(), meals: await tally(db, ymd, okVoter ? voter : '') });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'GET, POST', ...SECURITY_HEADERS } });

  // 다른 사이트에서 대신 투표시키는 것 막기
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site' || +(request.headers.get('content-length') || 0) > 2048 || !(request.headers.get('content-type') || '').includes('application/json')) return json({ error: 'bad request' }, 400);
  if (!okVoter) return json({ error: 'bad voter' }, 400);
  if (await limited(db, 'mv:' + await ipKey(request), 400, 600)) return json({ error: '너무 많이 눌렀어요. 잠시 후에 해 주세요' }, 429);   // 기기 ID를 바꿔 가며 몰표 넣기 방지
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const ymd = String(body?.ymd || ''), meal = String(body?.meal || ''), dish = String(body?.dish ?? '').slice(0, 60);
  if (ymd !== kstYmd()) return json({ error: '오늘 급식만 투표할 수 있어요' }, 400);
  if (Date.now() >= mealCloses()) return json({ error: '오늘 급식 투표는 밤 11시 50분에 마감됐어요' }, 400);
  if (!MEAL_CODES.includes(meal)) return json({ error: 'bad meal' }, 400);

  if (!dish) {
    await db.prepare('DELETE FROM meal_votes WHERE ymd = ?1 AND meal = ?2 AND voter = ?3').bind(ymd, meal, voter).run();
  } else {
    let menu;
    try { menu = await menuOf(env, ymd, meal); } catch { return json({ error: '급식 정보를 확인하지 못했어요' }, 502); }
    if (!menu.includes(dish)) return json({ error: '메뉴에 없는 음식이에요' }, 400);
    await db.prepare('INSERT INTO meal_votes (ymd, meal, voter, dish, at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT (ymd, meal, voter) DO UPDATE SET dish = excluded.dish, at = excluded.at')
      .bind(ymd, meal, voter, dish, Date.now()).run();
  }
  return json({ enabled: true, today: ymd, closes: mealCloses(), meals: await tally(db, ymd, voter) });
}

/* ===== 공지 기록: 헤더 📢 버튼에서 지난 공지까지 최근 20개 ===== */
async function notices(env) {
  if (!env.DB) return json({ list: [] });
  await setup(env.DB);
  const now = Date.now();
  const rows = (await env.DB.prepare('SELECT id, text, tone, link, at, until, body FROM notices ORDER BY at DESC LIMIT 20').all()).results;
  return json({ list: rows.map(r => ({ id: r.id, text: r.text, body: r.body || '', tone: r.tone, link: r.link, at: r.at, live: !r.until || r.until > now })) }, 200, 'public, max-age=30');
}

/* ===== 공지 (관리자 페이지에서 작성) ===== */
async function notice(env) {
  if (!env.DB) return json({ notice: null });
  await setup(env.DB);
  let n = null;
  try { n = JSON.parse((await getSettings(env.DB)).notice || 'null'); } catch {}
  if (n && n.until && n.until < Date.now()) n = null;
  return json({ notice: n && n.text ? { id: n.id, text: n.text, more: !!n.body, tone: n.tone, link: n.link || '', at: n.at || 0 } : null }, 200, 'public, max-age=30');
}
