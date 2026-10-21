// SVMHS GROUND — 소셜 API (/api/s/*): 계정 · 프로필 · 팔로우 · DM · 미니게임 랭킹
// D1 바인딩 이름 DB가 필요하다(없으면 { enabled:false }). 테이블은 첫 요청 때 자동으로 만든다.
// 선택: 가입 코드는 관리자 페이지(/admin) 설정 → 없으면 비밀 변수 JOIN_CODE. 정지된 계정은 로그인 불가.
import { setup, getSettings, joinCodeOf, signupOpen, dmOpen, kstYmd, limited, ipKey } from '../../../lib/db.js';

/* ===== 공용 목록 (public/js/social.js와 같게 유지) ===== */
const AVATARS = ['😎','🐶','🐱','🐰','🦊','🐻','🐼','🐸','🐥','🐧','🦄','🐯','🐨','🐹','👽','🤖','👻','🎃','🌝','🍀','🔥','⚡','🌈','🎬','🎥','🎧','🎮','🏀','⚽','🎸','🍓','🍩','🧋','🍕','💜','⭐'];
const COLORS = ['sky','blue','mint','lime','yellow','peach','pink','violet','ink'];
const STICKERS = ['⭐','✨','💖','💙','🔥','🎬','🎥','📸','🎧','🎮','🍀','🌈','☁️','🌙','🍓','🧋','🐾','👑','💯','🎀','🫧','🪐','🦋','🌷','🍒','🎵','⚡','🌊'];
const GAMES = {   // 모두 '작을수록 좋음' (ms). play: 시작 티켓을 받은 뒤 기록을 내기까지 최소 걸리는 시간
  reaction: { min: 100, max: 1500, play: 5000 },      // 반응속도 5번 평균 (매번 1초 이상 기다림)
  num25: { min: 2500, max: 600000, play: 2000 },      // 1→25 순서대로 누르기
  cut: { min: 0, max: 6000, play: 5000 },             // 컷 타이밍 5번 오차 합 (매번 0.5초 대기 + 이동)
};
const TICKET_RE = /^[0-9a-f]{32}$/;
const TICKET_TTL = 3600e3;

const HANDLE_RE = /^[a-z0-9_.]{3,16}$/;
const SESSION_DAYS = 365;   // 로그아웃하지 않으면 유지: 접속할 때마다 만료를 다시 365일로 연장(GET me)
const COOKIE = 'sg_s';
const SECURITY_HEADERS = { 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin', 'referrer-policy': 'no-referrer' };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS, ...extra },
});
const err = (msg, status = 400) => json({ error: msg }, status);
// 사용자 글: 제어문자 제거 · 공백 정리 · 길이 제한
const clean = (s, max, multiline = false) => {
  let t = String(s ?? '').replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g : /[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  t = multiline ? t.replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ');
  return [...t.trim()].slice(0, max).join('');
};

/* ===== 보안 도구 ===== */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256));
}
const sameStr = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
// 없는 아이디로 로그인할 때도 같은 시간이 걸리게 하는 가짜 해시 (응답 시간으로 아이디 존재 여부를 알 수 없게)
const DUMMY = { pw: '0'.repeat(64), salt: '00000000000000000000000000000000' };
const cookieOf = (req, name) => (req.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(name + '='))?.slice(name.length + 1) || '';
const setCookie = (req, token, maxAge) => {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/api/s; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

/* ===== 사용자 ===== */
const PUB = 'id, handle, name, bio, avatar, color, grade, cls, club, mood, stickers, seen, insta';
const pub = u => u && ({
  handle: u.handle, name: u.name, bio: u.bio, avatar: u.avatar, color: u.color, grade: u.grade, cls: u.cls, club: u.club, mood: u.mood, insta: u.insta || '',
  stickers: (() => { try { return JSON.parse(u.stickers); } catch { return []; } })(), online: Date.now() - (u.seen || 0) < 150e3,
});
const card = u => u && ({ handle: u.handle, name: u.name, avatar: u.avatar, color: u.color, mood: u.mood, online: Date.now() - (u.seen || 0) < 150e3 });
const byHandle = (db, h) => db.prepare(`SELECT ${PUB} FROM users WHERE handle = ?1`).bind(String(h || '').toLowerCase()).first();

async function auth(req, db) {
  const token = cookieOf(req, COOKIE);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await db.prepare(`SELECT u.id, u.handle, u.name, u.bio, u.avatar, u.color, u.grade, u.cls, u.club, u.mood, u.stickers, u.seen, u.insta, s.exp
    FROM sessions s JOIN users u ON u.id = s.uid WHERE s.token = ?1
    AND NOT EXISTS (SELECT 1 FROM bans b WHERE b.uid = u.id AND (b.until = 0 OR b.until > ?2))`).bind(await sha256(token), Date.now()).first();
  if (!row || row.exp < Date.now()) return null;
  if (Date.now() - row.seen > 60e3) await db.prepare('UPDATE users SET seen = ?1 WHERE id = ?2').bind(Date.now(), row.id).run();
  return row;
}
async function newSession(req, db, uid) {
  const token = randHex(32);
  await db.prepare('INSERT INTO sessions (token, uid, exp) VALUES (?1, ?2, ?3)').bind(await sha256(token), uid, Date.now() + SESSION_DAYS * 86400e3).run();
  await db.prepare('DELETE FROM sessions WHERE exp < ?1').bind(Date.now()).run();
  return setCookie(req, token, SESSION_DAYS * 86400);
}
// 관계: 내가 팔로우 · 나를 팔로우 · 내가 차단 · 나를 차단
async function rel(db, me, other) {
  const r = await db.prepare(`SELECT
      EXISTS(SELECT 1 FROM follows WHERE a = ?1 AND b = ?2) AS fo, EXISTS(SELECT 1 FROM follows WHERE a = ?2 AND b = ?1) AS fb,
      EXISTS(SELECT 1 FROM blocks WHERE a = ?1 AND b = ?2) AS bl, EXISTS(SELECT 1 FROM blocks WHERE a = ?2 AND b = ?1) AS bb`).bind(me, other).first();
  return { following: !!r.fo, followsMe: !!r.fb, blocked: !!r.bl, blockedMe: !!r.bb };
}
const friendIds = async (db, me) => (await db.prepare('SELECT f.b AS id FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a WHERE f.a = ?1').bind(me).all()).results.map(r => r.id);
const pairOf = (x, y) => x < y ? `${x}:${y}` : `${y}:${x}`;

/* ===== 라우터 ===== */
export async function onRequest({ request: req, env, params }) {
  const path = (params.path || []).join('/');
  if (!env.DB) return json({ enabled: false });
  const db = env.DB;
  await setup(db);
  const method = req.method;
  let body = {};
  if (method === 'POST') {
    // 다른 사이트에서 대신 요청 보내는 것 막기 (JSON만 받음 → 교차 출처는 사전 확인에서 막힘)
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return err('forbidden', 403);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return err('bad content type', 415);
    try { body = await req.json(); } catch { return err('bad body'); }
    if (!body || typeof body !== 'object') return err('bad body');
  } else if (method !== 'GET') return err('method not allowed', 405);

  try {
    const route = ROUTES[`${method} ${path.split('/')[0]}`];
    if (!route) return err('not found', 404);
    return await route({ req, env, db, body, arg: decodeURIComponent(path.split('/')[1] || ''), url: new URL(req.url) });
  } catch (e) {
    console.error(e);
    return err('잠시 후 다시 시도해 주세요', 500);
  }
}

const needMe = fn => async ctx => {
  const me = await auth(ctx.req, ctx.db);
  if (!me) return err('로그인이 필요해요', 401);
  return fn({ ...ctx, me });
};

const ROUTES = {
  /* ----- 계정 ----- */
  'GET config': async ({ env, db }) => {
    const st = await getSettings(db);
    return json({ enabled: true, needCode: Boolean(joinCodeOf(env, st)), signup: signupOpen(st), dm: dmOpen(st) });
  },

  'POST signup': async ({ req, env, db, body }) => {
    const handle = String(body.handle || '').trim().toLowerCase(), name = clean(body.name, 12), pw = String(body.pw || '');
    if (!HANDLE_RE.test(handle)) return err('아이디는 영어 소문자·숫자·_·. 로 3~16자예요');
    if (!name) return err('이름(닉네임)을 적어 주세요');
    if (pw.length < 6 || pw.length > 64) return err('비밀번호는 6~64자로 해 주세요');
    const st = await getSettings(db), code = joinCodeOf(env, st);
    if (!signupOpen(st)) return err('지금은 새로 가입할 수 없어요', 403);
    if (await limited(db, 'su:' + await ipKey(req), 40, 3600)) return err('가입 시도가 너무 많아요. 나중에 다시 해 주세요', 429);   // 코드 대입 막으려고 코드 확인보다 먼저
    if (code && !sameStr(String(body.code || '').trim(), code)) return err('가입 코드가 달라요');
    if (await db.prepare('SELECT 1 FROM users WHERE handle = ?1').bind(handle).first()) return err('이미 있는 아이디예요');
    const salt = randHex(16);
    const g = +body.grade, c = +body.cls;
    const u = await db.prepare(`INSERT INTO users (handle, name, pw, salt, created, avatar, grade, cls, seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?5) RETURNING id`)
      .bind(handle, name, await hashPw(pw, salt), salt, Date.now(), AVATARS[Math.floor(Math.random() * 16)],
        g >= 1 && g <= 3 ? g : 0, c >= 1 && c <= 10 ? c : 0).first();
    return json({ ok: true }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },

  'POST login': async ({ req, db, body }) => {
    const handle = String(body.handle || '').trim().toLowerCase(), pw = String(body.pw || '');
    // 아이디+IP 기준으로 막아서, 다른 사람이 일부러 틀려도 내 기기에서는 계속 로그인할 수 있게 함. 아이디 전체 한도는 여러 IP로 대입하는 것 대비
    const ik = await ipKey(req), h = handle.slice(0, 16);
    if (await limited(db, 'li:' + ik, 100, 600) || await limited(db, 'lh:' + h + ':' + ik, 10, 600) || await limited(db, 'lg:' + h, 60, 3600)) return err('로그인 시도가 너무 많아요. 잠시 뒤에 다시 해 주세요', 429);
    const u = HANDLE_RE.test(handle) && await db.prepare('SELECT id, pw, salt FROM users WHERE handle = ?1').bind(handle).first();
    const ok = sameStr(await hashPw(pw, (u || DUMMY).salt), (u || DUMMY).pw);   // 없는 아이디도 똑같이 해시 계산
    if (!u || !ok) return err('아이디나 비밀번호가 맞지 않아요', 401);
    const ban = await db.prepare('SELECT until, reason FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(u.id, Date.now()).first();
    if (ban) {
      const when = ban.until ? new Date(ban.until + 9 * 3600e3).toISOString().slice(5, 16).replace('-', '/').replace('T', ' ') + '까지' : '무기한';
      return err(`이용이 정지된 계정이에요 (${when}${ban.reason ? ' · ' + ban.reason : ''})`, 403);
    }
    return json({ ok: true }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },

  'POST logout': async ({ req, db }) => {
    const token = cookieOf(req, COOKIE);
    if (/^[0-9a-f]{64}$/.test(token)) await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) });
  },

  'GET me': async ({ req, db }) => {
    const me = await auth(req, db);
    if (!me) return json({ me: null });
    const [unread, fo, fb, fr] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE b = ?1 AND seen = 0 AND del = 0').bind(me.id).first(),
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE a = ?1').bind(me.id).first(),
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE b = ?1').bind(me.id).first(),
      friendIds(db, me.id),
    ]);
    // 로그인 유지: 하루 넘게 지났으면 세션·쿠키 만료를 다시 SESSION_DAYS로 늘림 (로그아웃·비번 변경 전까지 계속 로그인)
    let hdr;
    if (me.exp - Date.now() < (SESSION_DAYS - 1) * 86400e3) {
      const token = cookieOf(req, COOKIE);
      await db.prepare('UPDATE sessions SET exp = ?1 WHERE token = ?2').bind(Date.now() + SESSION_DAYS * 86400e3, await sha256(token)).run();
      hdr = { 'set-cookie': setCookie(req, token, SESSION_DAYS * 86400) };
    }
    return json({ me: { ...pub(me), online: true }, unread: unread.n, counts: { following: fo.n, followers: fb.n, friends: fr.length } }, 200, hdr);
  },

  'POST me': needMe(async ({ db, me, body }) => {
    const name = clean(body.name, 12);
    if (!name) return err('이름(닉네임)을 적어 주세요');
    const avatar = AVATARS.includes(body.avatar) ? body.avatar : me.avatar;
    const color = COLORS.includes(body.color) ? body.color : me.color;
    const stickers = (Array.isArray(body.stickers) ? body.stickers : []).filter(s => STICKERS.includes(s)).slice(0, 6);
    const g = +body.grade, c = +body.cls;
    // 인스타 아이디: @·주소를 붙여 넣어도 아이디만 남김. 인스타 규칙(영문·숫자·._, 30자)에 안 맞으면 거절
    const insta = String(body.insta || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();
    if (insta && !/^(?!.*\.\.)(?!\.)[a-z0-9._]{1,30}(?<!\.)$/.test(insta)) return err('인스타 아이디는 영문·숫자·밑줄(_)·마침표(.)만 쓸 수 있어요');
    await db.prepare('UPDATE users SET name = ?1, bio = ?2, avatar = ?3, color = ?4, grade = ?5, cls = ?6, club = ?7, mood = ?8, stickers = ?9, insta = ?11 WHERE id = ?10')
      .bind(name, clean(body.bio, 80, true), avatar, color, g >= 1 && g <= 3 ? g : 0, c >= 1 && c <= 10 ? c : 0, clean(body.club, 16), clean(body.mood, 24),
        JSON.stringify([...new Set(stickers)]), me.id, insta).run();
    return json({ ok: true });
  }),

  'POST password': needMe(async ({ req, db, me, body }) => {
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    if (!sameStr(await hashPw(String(body.old || ''), u.salt), u.pw)) return err('지금 비밀번호가 맞지 않아요', 401);
    const pw = String(body.pw || '');
    if (pw.length < 6 || pw.length > 64) return err('새 비밀번호는 6~64자로 해 주세요');
    const salt = randHex(16);
    const cur = await sha256(cookieOf(req, COOKIE));
    await db.batch([
      db.prepare('UPDATE users SET pw = ?1, salt = ?2 WHERE id = ?3').bind(await hashPw(pw, salt), salt, me.id),
      db.prepare('DELETE FROM sessions WHERE uid = ?1 AND token != ?2').bind(me.id, cur),   // 다른 기기는 로그아웃
    ]);
    return json({ ok: true });
  }),

  'POST withdraw': needMe(async ({ req, db, me, body }) => {
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    if (!sameStr(await hashPw(String(body.pw || ''), u.salt), u.pw)) return err('비밀번호가 맞지 않아요', 401);
    await db.batch([
      'DELETE FROM sessions WHERE uid = ?1', 'DELETE FROM follows WHERE a = ?1 OR b = ?1', 'DELETE FROM blocks WHERE a = ?1 OR b = ?1',
      'DELETE FROM messages WHERE a = ?1 OR b = ?1', 'DELETE FROM scores WHERE uid = ?1', 'DELETE FROM bans WHERE uid = ?1', 'DELETE FROM reports WHERE reporter = ?1',
      'DELETE FROM users WHERE id = ?1',
    ].map(s => db.prepare(s).bind(me.id)));
    return json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) });
  }),

  /* ----- 사람 ----- */
  'GET user': needMe(async ({ db, me, arg }) => {
    const u = await byHandle(db, arg);
    if (!u) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blockedMe) return err('없는 사용자예요', 404);
    const [fo, fb, bests, crowns] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE a = ?1').bind(u.id).first(),
      db.prepare('SELECT COUNT(*) AS n FROM follows WHERE b = ?1').bind(u.id).first(),
      db.prepare('SELECT game, MIN(best) AS best FROM scores WHERE uid = ?1 GROUP BY game').bind(u.id).all(),
      topCrowns(db, u.id),
    ]);
    return json({
      user: pub(u), me: u.id === me.id, rel: r, counts: { following: fo.n, followers: fb.n },
      bests: Object.fromEntries(bests.results.map(x => [x.game, x.best])), crowns,
    });
  }),

  'GET search': needMe(async ({ db, me, url }) => {
    const q = clean(url.searchParams.get('q'), 16).toLowerCase().replace(/[%_\\]/g, '');
    let rows;
    if (q) {
      rows = (await db.prepare(`SELECT ${PUB} FROM users WHERE (handle LIKE ?1 OR name LIKE ?1) AND id != ?2
        AND id NOT IN (SELECT a FROM blocks WHERE b = ?2) ORDER BY seen DESC LIMIT 30`).bind(`%${q}%`, me.id).all()).results;
    } else {   // 검색어 없으면: 최근에 들어온 사람
      rows = (await db.prepare(`SELECT ${PUB} FROM users WHERE id != ?1 AND id NOT IN (SELECT a FROM blocks WHERE b = ?1) ORDER BY seen DESC LIMIT 30`).bind(me.id).all()).results;
    }
    const mine = new Set((await db.prepare('SELECT b FROM follows WHERE a = ?1').bind(me.id).all()).results.map(r => r.b));
    return json({ users: rows.map(u => ({ ...card(u), following: mine.has(u.id), grade: u.grade, cls: u.cls })) });
  }),

  'GET people': needMe(async ({ db, me, url }) => {   // ?who=handle&kind=following|followers|friends
    const who = url.searchParams.get('who') ? await byHandle(db, url.searchParams.get('who')) : me;
    if (!who || (who.id !== me.id && (await rel(db, me.id, who.id)).blockedMe)) return err('없는 사용자예요', 404);
    const kind = url.searchParams.get('kind');
    const sql = {
      following: `SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM follows f JOIN users u ON u.id = f.b WHERE f.a = ?1 ORDER BY f.at DESC LIMIT 200`,
      followers: `SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM follows f JOIN users u ON u.id = f.a WHERE f.b = ?1 ORDER BY f.at DESC LIMIT 200`,
      friends: `SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a JOIN users u ON u.id = f.b WHERE f.a = ?1 ORDER BY u.seen DESC LIMIT 200`,
    }[kind];
    if (!sql) return err('bad kind');
    const rows = (await db.prepare(sql).bind(who.id).all()).results;
    const mine = new Set((await db.prepare('SELECT b FROM follows WHERE a = ?1').bind(me.id).all()).results.map(r => r.b));
    return json({ users: rows.map(u => ({ ...card(u), following: mine.has(u.id), isMe: u.id === me.id })) });
  }),

  'POST follow': needMe(async ({ db, me, body }) => {
    const u = await byHandle(db, body.handle);
    if (!u || u.id === me.id) return err('팔로우할 수 없어요');
    if (await limited(db, 'fo:' + me.id, 60, 600)) return err('너무 빨라요. 잠시 후에 해 주세요', 429);
    const r = await rel(db, me.id, u.id);
    if (body.on && (r.blocked || r.blockedMe)) return err('팔로우할 수 없어요');
    if (body.on) await db.prepare('INSERT OR IGNORE INTO follows (a, b, at) VALUES (?1, ?2, ?3)').bind(me.id, u.id, Date.now()).run();
    else await db.prepare('DELETE FROM follows WHERE a = ?1 AND b = ?2').bind(me.id, u.id).run();
    return json({ ok: true, rel: await rel(db, me.id, u.id) });
  }),

  'POST block': needMe(async ({ db, me, body }) => {
    const u = await byHandle(db, body.handle);
    if (!u || u.id === me.id) return err('차단할 수 없어요');
    if (body.on) {
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO blocks (a, b) VALUES (?1, ?2)').bind(me.id, u.id),
        db.prepare('DELETE FROM follows WHERE (a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)').bind(me.id, u.id),
      ]);
    } else await db.prepare('DELETE FROM blocks WHERE a = ?1 AND b = ?2').bind(me.id, u.id).run();
    return json({ ok: true, rel: await rel(db, me.id, u.id) });
  }),

  'GET blocked': needMe(async ({ db, me }) => {
    const rows = (await db.prepare(`SELECT ${PUB.replace(/(\w+)/g, 'u.$1')} FROM blocks b JOIN users u ON u.id = b.b WHERE b.a = ?1`).bind(me.id).all()).results;
    return json({ users: rows.map(card) });
  }),

  'POST report': needMe(async ({ db, me, body }) => {
    const u = await byHandle(db, body.handle);
    if (!u) return err('없는 사용자예요');
    if (await limited(db, 'rp:' + me.id, 10, 3600)) return err('신고가 너무 많아요', 429);
    // 메시지 신고는 '나와 그 사람의 대화'에 있는 그 사람의 메시지만 (남의 대화를 관리자 화면에 끌어오지 못하게)
    let msg = null;
    if (Number.isInteger(body.msg)) {
      const m = await db.prepare('SELECT id FROM messages WHERE id = ?1 AND pair = ?2 AND a = ?3').bind(body.msg, pairOf(me.id, u.id), u.id).first();
      if (!m) return err('신고할 수 없는 메시지예요');
      msg = m.id;
    }
    await db.prepare('INSERT INTO reports (reporter, target, msg, reason, at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(me.id, u.id, msg, clean(body.reason, 200, true) || '(사유 없음)', Date.now()).run();
    return json({ ok: true });
  }),

  /* ----- DM (서로 팔로우한 친구끼리만) ----- */
  'GET poll': needMe(async ({ db, me }) => {
    const r = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE b = ?1 AND seen = 0 AND del = 0').bind(me.id).first();
    return json({ unread: r.n });
  }),

  'GET inbox': needMe(async ({ db, me }) => {
    const last = (await db.prepare(`SELECT m.id, m.a, m.b, m.body, m.at, m.del FROM messages m
      JOIN (SELECT pair, MAX(id) AS mid FROM messages WHERE a = ?1 OR b = ?1 GROUP BY pair) t ON m.id = t.mid ORDER BY m.id DESC LIMIT 60`).bind(me.id).all()).results;
    const unread = Object.fromEntries((await db.prepare('SELECT a, COUNT(*) AS n FROM messages WHERE b = ?1 AND seen = 0 AND del = 0 GROUP BY a').bind(me.id).all()).results.map(r => [r.a, r.n]));
    const ids = [...new Set([...last.map(m => m.a === me.id ? m.b : m.a), ...await friendIds(db, me.id)])];
    const users = ids.length ? (await db.prepare(`SELECT ${PUB} FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results : [];
    const byId = new Map(users.map(u => [u.id, u]));
    const threads = last.filter(m => byId.has(m.a === me.id ? m.b : m.a)).map(m => {
      const other = m.a === me.id ? m.b : m.a;
      return { user: card(byId.get(other)), last: m.del ? '삭제된 메시지' : m.body, at: m.at, mine: m.a === me.id, unread: unread[other] || 0 };
    });
    const talked = new Set(last.map(m => m.a === me.id ? m.b : m.a));
    const friends = users.filter(u => !talked.has(u.id)).map(card);   // 아직 대화 안 한 친구
    return json({ threads, friends });
  }),

  'GET dm': needMe(async ({ db, me, arg, url }) => {
    const u = await byHandle(db, arg);
    if (!u || u.id === me.id) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blockedMe) return err('없는 사용자예요', 404);
    const after = Math.max(0, parseInt(url.searchParams.get('after')) || 0), before = parseInt(url.searchParams.get('before')) || 0;
    const pair = pairOf(me.id, u.id);
    let rows;
    if (after) rows = (await db.prepare('SELECT id, a, body, at, seen, del FROM messages WHERE pair = ?1 AND id > ?2 ORDER BY id LIMIT 100').bind(pair, after).all()).results;
    else rows = (await db.prepare(`SELECT * FROM (SELECT id, a, body, at, seen, del FROM messages WHERE pair = ?1 ${before ? 'AND id < ?2' : ''} ORDER BY id DESC LIMIT 40) ORDER BY id`)
      .bind(...(before ? [pair, before] : [pair])).all()).results;
    await db.prepare('UPDATE messages SET seen = 1 WHERE pair = ?1 AND b = ?2 AND seen = 0').bind(pair, me.id).run();
    // 상대가 읽은 내 마지막 메시지 (읽음 표시용)
    const read = await db.prepare('SELECT MAX(id) AS id FROM messages WHERE pair = ?1 AND a = ?2 AND seen = 1').bind(pair, me.id).first();
    return json({
      user: card(u), rel: r, canSend: r.following && r.followsMe && !r.blocked, readUpTo: read?.id || 0,
      messages: rows.map(m => ({ id: m.id, mine: m.a === me.id, body: m.del ? '' : m.body, del: !!m.del, at: m.at })),
    });
  }),

  'POST dm': needMe(async ({ db, me, arg, body }) => {
    const u = await byHandle(db, arg);
    if (!u || u.id === me.id) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blocked || r.blockedMe) return err('메시지를 보낼 수 없어요', 403);
    if (!(r.following && r.followsMe)) return err('서로 팔로우한 친구에게만 보낼 수 있어요', 403);
    if (!dmOpen(await getSettings(db))) return err('지금은 DM이 잠시 꺼져 있어요', 403);
    const text = clean(body.body, 500, true);
    if (!text) return err('내용을 적어 주세요');
    if (await limited(db, 'dm:' + me.id, 40, 60)) return err('너무 빨리 보내고 있어요. 잠깐만요!', 429);
    const m = await db.prepare('INSERT INTO messages (pair, a, b, body, at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id, at')
      .bind(pairOf(me.id, u.id), me.id, u.id, text, Date.now()).first();
    return json({ ok: true, message: { id: m.id, mine: true, body: text, del: false, at: m.at } });
  }),

  'POST unsend': needMe(async ({ db, me, body }) => {
    const id = parseInt(body.id);
    const r = await db.prepare("UPDATE messages SET del = 1, body = '' WHERE id = ?1 AND a = ?2").bind(id, me.id).run();
    return r.meta.changes ? json({ ok: true }) : err('지울 수 없어요');
  }),

  /* ----- 미니게임 ----- */
  // 게임 시작 티켓: 서버가 시작 시각을 기억해 두고(rl 표, 1시간 뒤 만료), 기록은 티켓 하나당 한 번만 받는다
  // → 게임을 안 하고 기록만 바로 보내거나, 같은 기록을 여러 번 보내는 것을 막음 (완전한 조작 방지는 아님)
  'POST start': needMe(async ({ db, me, body }) => {
    const game = String(body.game || '');
    if (!GAMES[game]) return err('bad game');
    if (await limited(db, 'gs:' + me.id, 60, 600)) return err('잠깐 쉬었다가 해요', 429);
    const ticket = randHex(16);
    await db.prepare('INSERT INTO rl (k, n, reset) VALUES (?1, 0, ?2)').bind(`tk:${me.id}:${game}:${ticket}`, Date.now() + TICKET_TTL).run();
    return json({ ticket });
  }),

  'POST score': needMe(async ({ db, me, body }) => {
    const game = String(body.game || ''), v = Math.round(+body.value), ticket = String(body.ticket || '');
    const g = GAMES[game];
    if (!g || !Number.isFinite(v) || v < g.min || v > g.max) return err('기록이 이상해요');
    if (await limited(db, 'sc:' + me.id, 40, 60)) return err('잠깐 쉬었다가 해요', 429);
    const tk = TICKET_RE.test(ticket) && await db.prepare('DELETE FROM rl WHERE k = ?1 AND reset > ?2 RETURNING reset').bind(`tk:${me.id}:${game}:${ticket}`, Date.now()).first();
    if (!tk) return err('게임을 다시 시작해 주세요');
    if (Date.now() - (tk.reset - TICKET_TTL) < g.play) return err('기록이 이상해요');
    const day = kstYmd();   // 기록은 날짜별로 쌓되(관리용), 랭킹은 개인 최고 기록 하나로만 매김
    const prev = await db.prepare('SELECT best FROM scores WHERE uid = ?1 AND game = ?2 AND day = ?3').bind(me.id, game, day).first();
    const allPrev = await db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first();
    if (!prev || v < prev.best) {
      await db.prepare(`INSERT INTO scores (uid, game, day, best, at) VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT (uid, game, day) DO UPDATE SET best = excluded.best, at = excluded.at`).bind(me.id, game, day, v, Date.now()).run();
    }
    const best = allPrev.b == null ? v : Math.min(allPrev.b, v);
    const rank = await rankOf(db, game, best);
    return json({ ok: true, best, newBest: allPrev.b == null || v < allPrev.b, rank });
  }),

  'GET rank': needMe(async ({ db, me, url }) => {
    const game = url.searchParams.get('game'), scope = url.searchParams.get('scope') || 'all';
    if (!GAMES[game]) return err('bad game');
    const U = 'u.handle, u.name, u.avatar, u.color, u.grade, u.cls, u.seen';
    const BEST = 'SELECT uid, MIN(best) AS best, at FROM scores WHERE game = ?1 GROUP BY uid';
    if (scope === 'class') {   // 반 대항전: 반마다 최고 기록 상위 3명 평균
      const rows = (await db.prepare(`SELECT t.best, u.grade, u.cls FROM (${BEST}) t JOIN users u ON u.id = t.uid WHERE u.grade > 0 AND u.cls > 0 ORDER BY t.best`).bind(game).all()).results;
      const by = new Map();
      for (const r of rows) { const k = r.grade + '-' + r.cls; const l = by.get(k) || []; l.push(r.best); by.set(k, l); }
      const list = [...by].map(([k, l]) => { const top = l.slice(0, 3); return { grade: +k.split('-')[0], cls: +k.split('-')[1], value: Math.round(top.reduce((a, b) => a + b, 0) / top.length), players: l.length }; })
        .sort((a, b) => a.value - b.value);
      return json({ scope, list, mine: me.grade && me.cls ? { grade: me.grade, cls: me.cls } : null });
    }
    let rows;
    if (scope === 'friends') {
      const ids = [me.id, ...await friendIds(db, me.id)];
      rows = (await db.prepare(`SELECT ${U}, t.best AS value, t.uid FROM (${BEST}) t JOIN users u ON u.id = t.uid WHERE t.uid IN (${ids.map((_, i) => '?' + (i + 2)).join(',')}) ORDER BY t.best, t.at LIMIT 50`)
        .bind(game, ...ids).all()).results;
    } else {
      rows = (await db.prepare(`SELECT ${U}, t.best AS value, t.uid FROM (${BEST}) t JOIN users u ON u.id = t.uid ORDER BY t.best, t.at LIMIT 50`).bind(game).all()).results;
    }
    const list = rows.map(r => ({ ...card(r), grade: r.grade, cls: r.cls, value: r.value, isMe: r.uid === me.id }));
    let mine = list.findIndex(x => x.isMe) + 1 || null;
    let myValue = list.find(x => x.isMe)?.value ?? null;
    if (!mine && scope === 'all') {
      const s = await db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first();
      if (s?.b != null) { myValue = s.b; mine = await rankOf(db, game, s.b); }
    }
    return json({ scope, list, mine, myValue });
  }),

  'GET games': needMe(async ({ db, me }) => {   // 게임 첫 화면: 게임별 1등 · 내 최고 기록 · 내 순위
    const out = {};
    for (const game of Object.keys(GAMES)) {
      const [top, ma] = await Promise.all([
        db.prepare('SELECT u.handle, u.name, u.avatar, u.color, u.seen, u.mood, s.best FROM scores s JOIN users u ON u.id = s.uid WHERE s.game = ?1 ORDER BY s.best, s.at LIMIT 1').bind(game).first(),
        db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first(),
      ]);
      const best = ma?.b ?? null;
      out[game] = { top: top ? { ...card(top), value: top.best } : null, best, rank: best != null ? await rankOf(db, game, best) : null };
    }
    return json({ games: out });
  }),
};

async function rankOf(db, game, best) {   // 나보다 최고 기록이 좋은 사람 수 + 1
  return (await db.prepare('SELECT COUNT(*) + 1 AS r FROM (SELECT MIN(best) AS b FROM scores WHERE game = ?1 GROUP BY uid) WHERE b < ?2').bind(game, best).first()).r;
}

async function topCrowns(db, uid) {   // 역대 1등인 게임 목록
  const out = [];
  for (const game of Object.keys(GAMES)) {
    const top = await db.prepare('SELECT uid FROM scores WHERE game = ?1 ORDER BY best, at LIMIT 1').bind(game).first();
    if (top?.uid === uid) out.push(game);
  }
  return out;
}
