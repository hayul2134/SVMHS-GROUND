// SVMHS GROUND — 나이스 API 프록시 (Cloudflare Pages Functions, /api/* 담당)
// 인증키는 Pages 프로젝트의 비밀 변수 NEIS_KEY에 보관한다. 키가 없어도 동작하지만 한 번에 5건까지만 받는다.
import { setup, getSettings, kstYmd } from '../../lib/db.js';
import { defaultBalance } from '../../lib/balance.js';

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
  if (path === 'vote') return vote(request, env);
  if (path === 'balance') return balance(request, env);
  if (path === 'notice') return notice(env);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD', ...SECURITY_HEADERS } });
  }

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

/* ===== 급식 인기투표 (D1 바인딩 DB 필요) =====
   한 기기(브라우저에 저장된 무작위 ID)당 끼니마다 한 표. 다시 누르면 바꾸거나 취소. 투표는 '오늘(한국 시간)' 급식만. */
const MEAL_CODES = ['1', '2', '3'];
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
    return json({ enabled: true, today: kstYmd(), meals: await tally(db, ymd, okVoter ? voter : '') });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'GET, POST', ...SECURITY_HEADERS } });

  // 다른 사이트에서 대신 투표시키는 것 막기
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
  if (!okVoter) return json({ error: 'bad voter' }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const ymd = String(body?.ymd || ''), meal = String(body?.meal || ''), dish = String(body?.dish ?? '').slice(0, 60);
  if (ymd !== kstYmd()) return json({ error: '오늘 급식만 투표할 수 있어요' }, 400);
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
  return json({ enabled: true, today: ymd, meals: await tally(db, ymd, voter) });
}

/* ===== 오늘의 밸런스 게임 (D1 바인딩 DB 필요) =====
   하루에 질문 하나(한국 날짜 기준으로 돌아감). 한 기기당 하루 한 표, 다시 누르면 바꾸거나 취소.
   자유 입력은 받지 않는다 (익명 글은 친구 저격·괴롭힘으로 번지기 쉬워서 고르기만 가능). */

async function balanceState(db, ymd, voter) {
  // 관리자 페이지에서 그날 질문을 정해 뒀으면 그걸 씀
  const c = await db.prepare('SELECT q, a, b FROM balance_custom WHERE ymd = ?1').bind(ymd).first();
  const q = c ? [c.q, c.a, c.b] : defaultBalance(ymd);
  const { results } = await db.prepare('SELECT pick, COUNT(*) AS n FROM balance_votes WHERE ymd = ?1 GROUP BY pick').bind(ymd).all();
  const counts = { a: 0, b: 0 };
  for (const r of results) if (r.pick in counts) counts[r.pick] = r.n;
  const mine = voter ? (await db.prepare('SELECT pick FROM balance_votes WHERE ymd = ?1 AND voter = ?2').bind(ymd, voter).first())?.pick || '' : '';
  return { enabled: true, ymd, q: q[0], a: q[1], b: q[2], counts, mine };
}

async function balance(request, env) {
  if (!env.DB) return json({ enabled: false });
  const db = env.DB, url = new URL(request.url);
  await setup(db);
  const voter = request.headers.get('x-voter') || '', okVoter = VOTER_RE.test(voter), ymd = kstYmd();
  if (request.method === 'GET') return json(await balanceState(db, ymd, okVoter ? voter : ''));
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'GET, POST', ...SECURITY_HEADERS } });

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
  if (!okVoter) return json({ error: 'bad voter' }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  const pick = String(body?.pick ?? '');
  if (!['a', 'b', ''].includes(pick)) return json({ error: 'bad pick' }, 400);
  if (body?.ymd && body.ymd !== ymd) return json({ error: '날짜가 바뀌었어요. 새로 고침해 주세요' }, 409);
  if (!pick) await db.prepare('DELETE FROM balance_votes WHERE ymd = ?1 AND voter = ?2').bind(ymd, voter).run();
  else await db.prepare('INSERT INTO balance_votes (ymd, voter, pick, at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (ymd, voter) DO UPDATE SET pick = excluded.pick, at = excluded.at')
    .bind(ymd, voter, pick, Date.now()).run();
  return json(await balanceState(db, ymd, voter));
}

/* ===== 공지 (관리자 페이지에서 작성) ===== */
async function notice(env) {
  if (!env.DB) return json({ notice: null });
  await setup(env.DB);
  let n = null;
  try { n = JSON.parse((await getSettings(env.DB)).notice || 'null'); } catch {}
  if (n && n.until && n.until < Date.now()) n = null;
  return json({ notice: n && n.text ? { id: n.id, text: n.text, tone: n.tone, link: n.link || '' } : null }, 200, 'public, max-age=30');
}
