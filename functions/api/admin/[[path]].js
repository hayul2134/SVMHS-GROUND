// SVMHS GROUND — 관리자 API (/api/admin/*). 화면은 public/admin/
// 로그인: Pages 비밀 변수 ADMIN_KEY(관리자 비밀번호)와 같으면 12시간짜리 관리자 세션(HttpOnly 쿠키, 경로 /api/admin만)을 준다.
// DM 내용은 '신고된 메시지와 그 앞뒤'만 볼 수 있다(학생 사생활 보호). 모든 조치는 admin_log에 남는다.
import { setup, getSettings, setSetting, joinCodeOf, signupOpen, dmOpen, kstYmd, limited, ipKey, maskIp } from '../../../lib/db.js';
import { defaultBalance } from '../../../lib/balance.js';

const COOKIE = 'sg_a';
const SESSION_H = 12;
const GAMES = ['reaction', 'num25', 'cut'];
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...HEADERS, ...extra } });
const err = (msg, status = 400) => json({ error: msg }, status);
const DAY = 86400e3;
const kstStart = (t = Date.now()) => { const k = t + 9 * 3600e3; return k - (k % DAY) - 9 * 3600e3; };   // 오늘 0시(한국)의 UTC ms
const clean = (s, max, multiline = false) => {
  let t = String(s ?? '').replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  t = multiline ? t.replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ');
  return [...t.trim()].slice(0, max).join('');
};

/* ----- 보안 도구 ----- */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const sameStr = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function hashPw(pw, salt) {   // 소셜 API와 같은 방식 (비밀번호 초기화용)
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256));
}
const cookieOf = req => (req.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
const setCookie = (req, token, maxAge) => `${COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
async function isAdmin(req, db) {
  const t = cookieOf(req);
  if (!/^[0-9a-f]{64}$/.test(t)) return false;
  const r = await db.prepare('SELECT exp FROM admin_sessions WHERE token = ?1').bind(await sha256(t)).first();
  return !!r && r.exp > Date.now();
}
const log = (db, action, detail = '') => db.prepare('INSERT INTO admin_log (at, action, detail) VALUES (?1, ?2, ?3)').bind(Date.now(), action, String(detail).slice(0, 300)).run();

/* ----- 사용자 찾기 ----- */
const U = 'id, handle, name, bio, avatar, color, grade, cls, club, mood, created, seen';
const userOf = (db, h) => db.prepare(`SELECT ${U} FROM users WHERE handle = ?1`).bind(String(h || '').trim().toLowerCase()).first();
const banOf = (db, uid) => db.prepare('SELECT until, reason, at FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(uid, Date.now()).first();
const row = u => u && ({ handle: u.handle, name: u.name, avatar: u.avatar, color: u.color, grade: u.grade, cls: u.cls, created: u.created, seen: u.seen, online: Date.now() - (u.seen || 0) < 150e3 });

/* ===== 라우터 ===== */
export async function onRequest({ request: req, env, params }) {
  const path = (params.path || []).join('/');
  const method = req.method;
  if (!env.DB) return path === 'status' ? json({ db: false, adminKey: Boolean(env.ADMIN_KEY), authed: false }) : err('D1 데이터베이스가 연결되지 않았어요', 503);
  const db = env.DB;
  await setup(db);

  let body = {};
  if (method === 'POST') {
    const origin = req.headers.get('origin');
    if (!origin || origin !== new URL(req.url).origin) return err('forbidden', 403);   // 관리자 요청은 같은 사이트에서만
    if (!(req.headers.get('content-type') || '').includes('application/json')) return err('bad content type', 415);
    try { body = await req.json(); } catch { return err('bad body'); }
    if (!body || typeof body !== 'object') return err('bad body');
  } else if (method !== 'GET') return err('method not allowed', 405);

  try {
    const name = `${method} ${path.split('/')[0]}`;
    const arg = decodeURIComponent(path.split('/').slice(1).join('/'));
    const url = new URL(req.url);
    if (OPEN[name]) return await OPEN[name]({ req, env, db, body });
    const route = ROUTES[name];
    if (!route) return err('not found', 404);
    if (!(await isAdmin(req, db))) return err('관리자 로그인이 필요해요', 401);
    return await route({ req, env, db, body, arg, url });
  } catch (e) {
    console.error(e);
    return err('처리 중 오류가 났어요: ' + (e.message || e), 500);
  }
}

/* 로그인 없이 되는 것 */
const OPEN = {
  'GET status': async ({ req, env, db }) => json({ db: true, adminKey: Boolean(env.ADMIN_KEY), authed: await isAdmin(req, db) }),

  'POST login': async ({ req, env, db, body }) => {
    if (!env.ADMIN_KEY) return err('ADMIN_KEY가 설정되지 않았어요', 503);
    const ip = maskIp(req);   // 기록에는 뒷자리를 가린 IP만
    if (await limited(db, 'ad:' + await ipKey(req), 8, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);
    if (!sameStr(await sha256(String(body.key || '')), await sha256(env.ADMIN_KEY))) {
      await log(db, '로그인 실패', ip);
      return err('관리자 비밀번호가 맞지 않아요', 401);
    }
    const token = randHex(32);
    await db.batch([
      db.prepare('DELETE FROM admin_sessions WHERE exp < ?1').bind(Date.now()),
      db.prepare('INSERT INTO admin_sessions (token, exp) VALUES (?1, ?2)').bind(await sha256(token), Date.now() + SESSION_H * 3600e3),
    ]);
    await log(db, '로그인', ip);
    return json({ ok: true }, 200, { 'set-cookie': setCookie(req, token, SESSION_H * 3600) });
  },

  'POST logout': async ({ req, db }) => {
    const t = cookieOf(req);
    if (/^[0-9a-f]{64}$/.test(t)) await db.prepare('DELETE FROM admin_sessions WHERE token = ?1').bind(await sha256(t)).run();
    return json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) });
  },
};

const ROUTES = {
  /* ----- 대시보드 ----- */
  'GET dash': async ({ env, db }) => {
    const t0 = kstStart(), day = kstYmd(), now = Date.now();
    const one = sql => db.prepare(sql);
    const r = await db.batch([
      one('SELECT COUNT(*) AS n FROM users'),
      one('SELECT COUNT(*) AS n FROM users WHERE seen >= ?1').bind(t0),
      one('SELECT COUNT(*) AS n FROM users WHERE seen >= ?1').bind(now - 150e3),
      one('SELECT COUNT(*) AS n FROM users WHERE created >= ?1').bind(t0),
      one('SELECT COUNT(*) AS n FROM messages WHERE at >= ?1').bind(t0),
      one('SELECT COUNT(*) AS n FROM scores WHERE day = ?1').bind(day),
      one('SELECT COUNT(*) AS n FROM reports WHERE done = 0'),
      one('SELECT COUNT(*) AS n FROM meal_votes WHERE ymd = ?1').bind(day),
      one('SELECT COUNT(*) AS n FROM balance_votes WHERE ymd = ?1').bind(day),
      one('SELECT COUNT(*) AS n FROM bans WHERE until = 0 OR until > ?1').bind(now),
      one('SELECT COUNT(*) AS n FROM follows'),
      // 최근 14일: 날마다 가입 수 · 게임한 사람 수 · DM 수
      one(`SELECT ((created + 32400000) / 86400000) AS d, COUNT(*) AS n FROM users WHERE created >= ?1 GROUP BY d`).bind(t0 - 13 * DAY),
      one(`SELECT day AS d, COUNT(DISTINCT uid) AS n FROM scores WHERE day >= ?1 GROUP BY day`).bind(kstYmd(now - 13 * DAY)),
      one(`SELECT ((at + 32400000) / 86400000) AS d, COUNT(*) AS n FROM messages WHERE at >= ?1 GROUP BY d`).bind(t0 - 13 * DAY),
      one('SELECT grade, cls, COUNT(*) AS n FROM users WHERE grade > 0 AND cls > 0 GROUP BY grade, cls ORDER BY grade, cls'),
    ]);
    const n = i => r[i].results[0].n;
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const t = now - i * DAY, ymd = kstYmd(t), dn = Math.floor((t + 9 * 3600e3) / DAY);
      days.push({
        ymd,
        signups: r[11].results.find(x => x.d === dn)?.n || 0,
        players: r[12].results.find(x => x.d === ymd)?.n || 0,
        dms: r[13].results.find(x => x.d === dn)?.n || 0,
      });
    }
    const st = await getSettings(db, true);
    let notice = null; try { notice = JSON.parse(st.notice || 'null'); } catch {}
    return json({
      counts: { users: n(0), activeToday: n(1), online: n(2), newToday: n(3), dmsToday: n(4), playsToday: n(5), openReports: n(6), mealVotes: n(7), balanceVotes: n(8), banned: n(9), follows: n(10) },
      days, classes: r[14].results,
      status: { neisKey: Boolean(env.NEIS_KEY), joinCode: Boolean(joinCodeOf(env, st)), signup: signupOpen(st), dm: dmOpen(st), notice: !!(notice && notice.text && !(notice.until && notice.until < now)) },
    });
  },

  /* ----- 신고 ----- */
  'GET reports': async ({ db, url }) => {
    const open = url.searchParams.get('state') !== 'done';
    const rows = (await db.prepare(`SELECT r.id, r.msg, r.reason, r.at, r.done, r.note,
        a.handle AS rh, a.name AS rn, a.avatar AS ra, t.handle AS th, t.name AS tn, t.avatar AS ta, t.id AS tid
      FROM reports r LEFT JOIN users a ON a.id = r.reporter LEFT JOIN users t ON t.id = r.target
      WHERE ${open ? 'r.done = 0' : 'r.done > 0'} ORDER BY r.id DESC LIMIT 100`).all()).results;
    // 대상별 누적 신고 수
    const tids = [...new Set(rows.map(x => x.tid).filter(Boolean))];
    const counts = tids.length ? Object.fromEntries((await db.prepare(`SELECT target, COUNT(*) AS n FROM reports WHERE target IN (${tids.map(() => '?').join(',')}) GROUP BY target`).bind(...tids).all()).results.map(x => [x.target, x.n])) : {};
    const bans = tids.length ? new Set((await db.prepare(`SELECT uid FROM bans WHERE (until = 0 OR until > ?1) AND uid IN (${tids.map(() => '?').join(',')})`).bind(Date.now(), ...tids).all()).results.map(x => x.uid)) : new Set();
    return json({
      reports: rows.map(x => ({
        id: x.id, msg: x.msg, reason: x.reason, at: x.at, done: x.done, note: x.note,
        reporter: x.rh ? { handle: x.rh, name: x.rn, avatar: x.ra } : null,
        target: x.th ? { handle: x.th, name: x.tn, avatar: x.ta, total: counts[x.tid] || 1, banned: bans.has(x.tid) } : null,
      })),
    });
  },

  // 신고된 메시지 + 그 대화의 앞뒤 5개 (신고와 연결된 메시지만 열람 가능)
  'GET context': async ({ db, arg }) => {
    const rep = await db.prepare('SELECT msg FROM reports WHERE id = ?1').bind(parseInt(arg)).first();
    if (!rep || !rep.msg) return json({ messages: [] });
    const m = await db.prepare('SELECT id, pair FROM messages WHERE id = ?1').bind(rep.msg).first();
    if (!m) return json({ messages: [], gone: true });
    const rows = (await db.prepare(`SELECT * FROM (SELECT x.id, x.body, x.at, x.del, u.handle, u.name, u.avatar FROM messages x JOIN users u ON u.id = x.a WHERE x.pair = ?1 AND x.id < ?2 ORDER BY x.id DESC LIMIT 5)
      UNION ALL SELECT * FROM (SELECT x.id, x.body, x.at, x.del, u.handle, u.name, u.avatar FROM messages x JOIN users u ON u.id = x.a WHERE x.pair = ?1 AND x.id >= ?2 ORDER BY x.id LIMIT 6)
      ORDER BY id`).bind(m.pair, m.id).all()).results;
    return json({ messages: rows.map(x => ({ id: x.id, body: x.del ? '' : x.body, del: !!x.del, at: x.at, handle: x.handle, name: x.name, avatar: x.avatar, reported: x.id === m.id })) });
  },

  'POST report': async ({ db, body }) => {
    const id = parseInt(body.id), done = [0, 1, 2].includes(body.done) ? body.done : 1;
    const r = await db.prepare('UPDATE reports SET done = ?1, note = ?2 WHERE id = ?3').bind(done, clean(body.note, 200), id).run();
    if (!r.meta.changes) return err('없는 신고예요', 404);
    await log(db, done ? (done === 1 ? '신고 처리' : '신고 넘김') : '신고 되돌림', `#${id}${body.note ? ' · ' + clean(body.note, 100) : ''}`);
    return json({ ok: true });
  },

  'POST delmsg': async ({ db, body }) => {
    const id = parseInt(body.id);
    const m = await db.prepare('SELECT x.id, u.handle FROM messages x JOIN users u ON u.id = x.a WHERE x.id = ?1').bind(id).first();
    if (!m) return err('없는 메시지예요', 404);
    await db.prepare("UPDATE messages SET del = 1, body = '' WHERE id = ?1").bind(id).run();
    await log(db, '메시지 삭제', `#${id} (@${m.handle})`);
    return json({ ok: true });
  },

  /* ----- 사용자 ----- */
  'GET users': async ({ db, url }) => {
    const q = clean(url.searchParams.get('q'), 20).toLowerCase().replace(/[%_\\]/g, '');
    const sort = { recent: 'u.seen DESC', new: 'u.created DESC', reports: 'reps DESC, u.seen DESC', name: 'u.handle' }[url.searchParams.get('sort')] || 'u.seen DESC';
    const filter = url.searchParams.get('filter');
    const where = ['(u.handle LIKE ?1 OR u.name LIKE ?1)', filter === 'banned' ? 'b.uid IS NOT NULL' : filter === 'reported' ? 'reps > 0' : '1'].join(' AND ');
    const rows = (await db.prepare(`SELECT ${U.replace(/(\w+)/g, 'u.$1')}, (SELECT COUNT(*) FROM reports r WHERE r.target = u.id) AS reps,
        (SELECT COUNT(*) FROM reports r WHERE r.target = u.id AND r.done = 0) AS openReps, b.until AS banUntil
      FROM users u LEFT JOIN bans b ON b.uid = u.id AND (b.until = 0 OR b.until > ?2)
      WHERE ${where} ORDER BY ${sort} LIMIT 300`).bind(`%${q}%`, Date.now()).all()).results;
    return json({ users: rows.map(u => ({ ...row(u), reps: u.reps, openReps: u.openReps, banned: u.banUntil != null, banUntil: u.banUntil })) });
  },

  'GET user': async ({ db, arg }) => {
    const u = await userOf(db, arg);
    if (!u) return err('없는 사용자예요', 404);
    const r = await db.batch([
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE a = ?1').bind(u.id),
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE b = ?1').bind(u.id),
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE a = ?1').bind(u.id),
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE a = ?1 AND at >= ?2').bind(u.id, kstStart()),
      db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE uid = ?1 AND exp > ?2').bind(u.id, Date.now()),
      db.prepare('SELECT COUNT(*) AS n FROM blocks WHERE b = ?1').bind(u.id),
      db.prepare('SELECT game, MIN(best) AS best, COUNT(*) AS days FROM scores WHERE uid = ?1 GROUP BY game').bind(u.id),
      db.prepare(`SELECT r.id, r.reason, r.at, r.done, a.handle AS rh FROM reports r LEFT JOIN users a ON a.id = r.reporter WHERE r.target = ?1 ORDER BY r.id DESC LIMIT 20`).bind(u.id),
      db.prepare(`SELECT r.id, r.reason, r.at, t.handle AS th FROM reports r LEFT JOIN users t ON t.id = r.target WHERE r.reporter = ?1 ORDER BY r.id DESC LIMIT 20`).bind(u.id),
    ]);
    const n = i => r[i].results[0].n;
    return json({
      user: { ...row(u), bio: u.bio, club: u.club, mood: u.mood },
      ban: await banOf(db, u.id),
      stats: { following: n(0), followers: n(1), sent: n(2), sentToday: n(3), sessions: n(4), blockedBy: n(5) },
      bests: r[6].results, reportsAgainst: r[7].results, reportsBy: r[8].results,
    });
  },

  'POST ban': async ({ db, body }) => {
    const u = await userOf(db, body.handle);
    if (!u) return err('없는 사용자예요', 404);
    const days = Math.max(0, Math.min(3650, +body.days || 0)), reason = clean(body.reason, 60);
    const until = days ? Date.now() + days * DAY : 0;
    await db.batch([
      db.prepare('INSERT INTO bans (uid, until, reason, at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (uid) DO UPDATE SET until = excluded.until, reason = excluded.reason, at = excluded.at').bind(u.id, until, reason, Date.now()),
      db.prepare('DELETE FROM sessions WHERE uid = ?1').bind(u.id),   // 바로 로그아웃
    ]);
    await log(db, '이용 정지', `@${u.handle} · ${days ? days + '일' : '무기한'}${reason ? ' · ' + reason : ''}`);
    return json({ ok: true });
  },

  'POST unban': async ({ db, body }) => {
    const u = await userOf(db, body.handle);
    if (!u) return err('없는 사용자예요', 404);
    await db.prepare('DELETE FROM bans WHERE uid = ?1').bind(u.id).run();
    await log(db, '정지 해제', `@${u.handle}`);
    return json({ ok: true });
  },

  'POST kick': async ({ db, body }) => {
    const u = await userOf(db, body.handle);
    if (!u) return err('없는 사용자예요', 404);
    const r = await db.prepare('DELETE FROM sessions WHERE uid = ?1').bind(u.id).run();
    await log(db, '강제 로그아웃', `@${u.handle} (${r.meta.changes}개 기기)`);
    return json({ ok: true, n: r.meta.changes });
  },

  // 비밀번호를 잊은 친구용: 임시 비밀번호를 만들어 관리자 화면에만 한 번 보여 줌
  'POST resetpw': async ({ db, body }) => {
    const u = await userOf(db, body.handle);
    if (!u) return err('없는 사용자예요', 404);
    const A = 'abcdefghjkmnpqrstuvwxyz23456789', bytes = crypto.getRandomValues(new Uint8Array(10));
    const pw = [...bytes].map(b => A[b % A.length]).join('');
    const salt = randHex(16);
    await db.batch([
      db.prepare('UPDATE users SET pw = ?1, salt = ?2 WHERE id = ?3').bind(await hashPw(pw, salt), salt, u.id),
      db.prepare('DELETE FROM sessions WHERE uid = ?1').bind(u.id),
    ]);
    await log(db, '비밀번호 초기화', `@${u.handle}`);
    return json({ ok: true, pw });
  },

  // 부적절한 닉네임·소개·상태 메시지·동아리 지우기
  'POST clearprofile': async ({ db, body }) => {
    const u = await userOf(db, body.handle);
    if (!u) return err('없는 사용자예요', 404);
    const f = new Set(Array.isArray(body.fields) ? body.fields : []);
    const sets = [];
    if (f.has('name')) sets.push('name = handle');   // 닉네임은 아이디로 바꿈
    if (f.has('bio')) sets.push("bio = ''");
    if (f.has('mood')) sets.push("mood = ''");
    if (f.has('club')) sets.push("club = ''");
    if (f.has('stickers')) sets.push("stickers = '[]'");
    if (!sets.length) return err('지울 항목을 골라 주세요');
    await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?1`).bind(u.id).run();
    await log(db, '프로필 정리', `@${u.handle} · ${[...f].join(', ')}`);
    return json({ ok: true });
  },

  'POST deluser': async ({ db, body }) => {
    const u = await userOf(db, body.handle);
    if (!u) return err('없는 사용자예요', 404);
    if (String(body.confirm || '').toLowerCase() !== u.handle) return err('확인용 아이디가 달라요');
    await db.batch([
      'DELETE FROM sessions WHERE uid = ?1', 'DELETE FROM follows WHERE a = ?1 OR b = ?1', 'DELETE FROM blocks WHERE a = ?1 OR b = ?1',
      'DELETE FROM messages WHERE a = ?1 OR b = ?1', 'DELETE FROM scores WHERE uid = ?1', 'DELETE FROM bans WHERE uid = ?1', 'DELETE FROM reports WHERE reporter = ?1',
      'DELETE FROM users WHERE id = ?1',
    ].map(s => db.prepare(s).bind(u.id)));
    await log(db, '계정 삭제', `@${u.handle} (${u.name})`);
    return json({ ok: true });
  },

  /* ----- 게임 기록 ----- */
  'GET scores': async ({ db, url }) => {
    const game = GAMES.includes(url.searchParams.get('game')) ? url.searchParams.get('game') : GAMES[0];
    const day = /^\d{8}$/.test(url.searchParams.get('day') || '') ? url.searchParams.get('day') : kstYmd();
    const rows = (await db.prepare(`SELECT s.best, s.at, u.handle, u.name, u.avatar, u.grade, u.cls FROM scores s JOIN users u ON u.id = s.uid WHERE s.game = ?1 AND s.day = ?2 ORDER BY s.best, s.at LIMIT 100`).bind(game, day).all()).results;
    return json({ game, day, list: rows });
  },

  'POST delscore': async ({ db, body }) => {
    const u = await userOf(db, body.handle);
    if (!u || !GAMES.includes(body.game) || !/^\d{8}$/.test(body.day || '')) return err('잘못된 요청이에요');
    await db.prepare('DELETE FROM scores WHERE uid = ?1 AND game = ?2 AND day = ?3').bind(u.id, body.game, body.day).run();
    await log(db, '게임 기록 삭제', `@${u.handle} · ${body.game} · ${body.day}`);
    return json({ ok: true });
  },

  'POST resetday': async ({ db, body }) => {
    if (!GAMES.includes(body.game) || !/^\d{8}$/.test(body.day || '')) return err('잘못된 요청이에요');
    const r = await db.prepare('DELETE FROM scores WHERE game = ?1 AND day = ?2').bind(body.game, body.day).run();
    await log(db, '랭킹 초기화', `${body.game} · ${body.day} (${r.meta.changes}건)`);
    return json({ ok: true, n: r.meta.changes });
  },

  /* ----- 공지 ----- */
  'GET notice': async ({ db }) => {
    let n = null; try { n = JSON.parse((await getSettings(db, true)).notice || 'null'); } catch {}
    return json({ notice: n });
  },
  'POST notice': async ({ db, body }) => {
    const text = clean(body.text, 120);
    if (!text) { await setSetting(db, 'notice', null); await log(db, '공지 내림'); return json({ ok: true }); }
    const tone = ['info', 'warn', 'fun'].includes(body.tone) ? body.tone : 'info';
    const link = /^#[a-z0-9/_.-]{0,40}$/i.test(body.link || '') ? body.link : '';
    const hours = Math.max(0, Math.min(24 * 60, +body.hours || 0));
    const n = { id: randHex(4), text, tone, link, at: Date.now(), until: hours ? Date.now() + hours * 3600e3 : 0 };
    await setSetting(db, 'notice', JSON.stringify(n));
    await log(db, '공지 올림', text);
    return json({ ok: true, notice: n });
  },

  /* ----- 밸런스 게임 ----- */
  'GET balance': async ({ db }) => {
    const custom = (await db.prepare('SELECT ymd, q, a, b FROM balance_custom WHERE ymd >= ?1 ORDER BY ymd').bind(kstYmd(Date.now() - 7 * DAY)).all()).results;
    const byDay = new Map(custom.map(c => [c.ymd, c]));
    const today = kstYmd(), days = [];
    for (let i = 0; i < 14; i++) {
      const ymd = kstYmd(Date.now() + i * DAY), c = byDay.get(ymd), d = defaultBalance(ymd);
      days.push({ ymd, custom: !!c, q: c ? c.q : d[0], a: c ? c.a : d[1], b: c ? c.b : d[2] });
    }
    const votes = (await db.prepare('SELECT pick, COUNT(*) AS n FROM balance_votes WHERE ymd = ?1 GROUP BY pick').bind(today).all()).results;
    return json({ days, today: { a: votes.find(v => v.pick === 'a')?.n || 0, b: votes.find(v => v.pick === 'b')?.n || 0 } });
  },
  'POST balance': async ({ db, body }) => {
    const ymd = String(body.ymd || ''), q = clean(body.q, 40), a = clean(body.a, 20), b = clean(body.b, 20);
    if (!/^\d{8}$/.test(ymd) || ymd < kstYmd()) return err('오늘이나 그 뒤 날짜만 정할 수 있어요');
    if (!q || !a || !b) return err('질문과 두 선택지를 모두 적어 주세요');
    await db.prepare('INSERT INTO balance_custom (ymd, q, a, b) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (ymd) DO UPDATE SET q = excluded.q, a = excluded.a, b = excluded.b').bind(ymd, q, a, b).run();
    // 오늘 질문을 바꾸면 이전 질문에 들어간 표는 의미가 없으므로 비움
    if (ymd === kstYmd()) await db.prepare('DELETE FROM balance_votes WHERE ymd = ?1').bind(ymd).run();
    await log(db, '밸런스 질문 지정', `${ymd} · ${q} (${a} vs ${b})`);
    return json({ ok: true });
  },
  'POST balancedel': async ({ db, body }) => {
    const ymd = String(body.ymd || '');
    const r = await db.prepare('DELETE FROM balance_custom WHERE ymd = ?1').bind(ymd).run();
    if (r.meta.changes && ymd === kstYmd()) await db.prepare('DELETE FROM balance_votes WHERE ymd = ?1').bind(ymd).run();
    await log(db, '밸런스 질문 기본값으로', ymd);
    return json({ ok: true });
  },

  /* ----- 설정 ----- */
  'GET settings': async ({ env, db }) => {
    const st = await getSettings(db, true);
    return json({
      joinCode: st.join_code ?? null, envJoinCode: Boolean(env.JOIN_CODE), signup: signupOpen(st), dm: dmOpen(st),
      neisKey: Boolean(env.NEIS_KEY),
    });
  },
  'POST settings': async ({ db, body }) => {
    const changed = [];
    if ('joinCode' in body) {
      const v = body.joinCode == null ? null : clean(body.joinCode, 40);
      await setSetting(db, 'join_code', v);   // null: 관리자 설정 지움(비밀 변수 JOIN_CODE로 돌아감) · '': 코드 없이 가입
      changed.push(v == null ? '가입 코드 설정 해제' : v ? '가입 코드 변경' : '가입 코드 없앰');
    }
    if ('signup' in body) { await setSetting(db, 'signup_open', body.signup ? '1' : '0'); changed.push(body.signup ? '가입 열기' : '가입 닫기'); }
    if ('dm' in body) { await setSetting(db, 'dm_open', body.dm ? '1' : '0'); changed.push(body.dm ? 'DM 켜기' : 'DM 끄기'); }
    if (body.logoutAll) {
      const r = await db.prepare('DELETE FROM sessions').run();
      changed.push(`전체 로그아웃 (${r.meta.changes}개 세션)`);
    }
    if (!changed.length) return err('바뀐 게 없어요');
    await log(db, '설정', changed.join(' · '));
    return json({ ok: true });
  },

  /* ----- 관리 기록 ----- */
  'GET log': async ({ db }) => json({ log: (await db.prepare('SELECT at, action, detail FROM admin_log ORDER BY id DESC LIMIT 200').all()).results }),
};
