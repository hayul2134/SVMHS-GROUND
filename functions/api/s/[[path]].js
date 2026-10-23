// SVMHS GROUND — 소셜 API (/api/s/*): 계정 · 프로필 · 팔로우 · DM · 미니게임 랭킹
// D1 바인딩 이름 DB가 필요하다(없으면 { enabled:false }). 테이블은 첫 요청 때 자동으로 만든다.
// 선택: 가입 코드는 관리자 페이지(/admin) 설정 → 없으면 비밀 변수 JOIN_CODE. 정지된 계정은 로그인 불가.
import { defaultBalance, balDay, openAt, closeAt, nextOpen, lastPeriod } from '../../../lib/balance.js';
import { REWARDS, SHIELD_EVERY, SHIELD_MAX, unlockedOf, kstToday, missedDays, liveCur, liveMany, weekOf } from '../../../lib/attend.js';
import { setup, getSettings, joinCodeOf, signupOpen, dmOpen, kstYmd, limited, countOf, ipKey, isWriteLimit, LIMIT_MSG, ADMIN_HANDLE, OLD_ADMIN_HANDLES, TEST_ACCOUNTS, TEST_GRADE, maskIp, logErr } from '../../../lib/db.js';

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
const RESERVED = h => h.startsWith('test_') || h === ADMIN_HANDLE || OLD_ADMIN_HANDLES.includes(h);   // 테스트 계정·개발자(예전 아이디 포함) 아이디는 가입 불가
// 너무 쉬운 비밀번호 (가장 먼저 시도되는 것들) · 아이디와 같은 비밀번호는 거절
const WEAK = new Set(['123456', '1234567', '12345678', '123456789', '1234567890', '000000', '111111', '123123', '654321', 'password', 'qwerty', 'qwerty123', 'abc123', 'asdf1234', 'qwer1234', 'a12345', 'aa1234', '1q2w3e4r', '1q2w3e', 'iloveyou', 'svmhs', 'svmhs123']);
const weakPw = (pw, handle) => WEAK.has(pw.toLowerCase()) || pw.toLowerCase() === handle || /^(.)\1+$/.test(pw);
// 닉네임: 다른 사람과 같으면 안 됨(띄어쓰기·대소문자 무시) + 개발자·관리자로 보이는 이름 금지
const nameKey = n => String(n || '').replace(/\s+/g, '').toLowerCase();
const RESERVED_NAMES = new Set(['개발자', '관리자', '운영자', '운영진', 'developer', 'admin', 'administrator', 'svmhsground']);
async function nameIssue(db, name, selfId = 0) {
  const k = nameKey(name);
  if (RESERVED_NAMES.has(k)) return '쓸 수 없는 닉네임이에요';
  const r = await db.prepare("SELECT 1 FROM users WHERE lower(replace(name, ' ', '')) = ?1 AND id <> ?2 AND is_test = 0 LIMIT 1").bind(k, selfId).first();
  return r ? '이미 다른 친구가 쓰는 닉네임이에요. 다른 걸로 해 주세요' : '';
}
// 구글 연결·구글 로그인·구글로 비밀번호 재설정을 쓸 수 없는 계정 (개발자 계정은 구글이 털려도 관리자 권한이 넘어가지 않게)
const noGoogle = u => !u || u.handle === ADMIN_HANDLE || !!u.is_test;
const SESSION_DAYS = 30;   // 로그인 후 30일이 지나면 다시 로그인 (연장 없음 — 공용 태블릿에 로그인이 무한히 남지 않게)
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

/* ===== 욕설 기본 필터 (프로필에 공개되는 글: 아이디·닉네임·소개·상태·동아리) =====
   띄어쓰기·특수문자·숫자를 빼고 검사 ('시 발', '씨1발' 등). 완벽하진 않음 → 나머지는 신고로 처리. DM은 사적인 대화라 검사하지 않음 */
const BAD = /씨발|시발|씨빨|씌발|ㅅㅂ|ㅆㅂ|병신|븅신|ㅂㅅ|좆|좃|존나|졸라|개새|개색|개세끼|새끼|쌔끼|썅|니애미|느금|니미|애미|애비|지랄|ㅈㄹ|미친놈|미친년|닥쳐|꺼져|엠창|창녀|걸레|섹스|fuck|shit|bitch/i;
const isBad = (...xs) => xs.some(x => BAD.test(String(x || '').replace(/[\s\d_.\-~!@#$%^&*()+=|\\/?,'"`:;<>[\]{}·ㆍ]/g, '')));

/* ===== 구글 ID 토큰 확인: 구글 tokeninfo로 서명·만료를 확인하고 우리 사이트용(aud)인지 검사 ===== */
async function verifyGoogle(env, cred) {
  if (!env.GOOGLE_CLIENT_ID || typeof cred !== 'string' || cred.length > 4096) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    if (!r.ok) return null;
    const t = await r.json();
    if (t.aud !== env.GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || +t.exp * 1000 < Date.now() || !t.sub) return null;
    return { sub: String(t.sub), name: t.given_name || t.name || '' };
  } catch { return null; }
}

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

// 관리자 계정이 로그아웃·비밀번호 변경·탈퇴하면 관리자 세션도 모두 끝냄 (쿠키도 지움)
const ADMIN_OUT = req => `sg_a=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
const endAdmin = (db, req, me, res) => {
  if (!me || me.handle !== ADMIN_HANDLE) return res;
  res.headers.append('set-cookie', ADMIN_OUT(req));
  return db.prepare('DELETE FROM admin_sessions').run().then(() => res);
};

// 테스트 계정으로 바꿔 들어간 동안 원래 개발자 세션 토큰을 보관하는 쿠키 (HttpOnly, 개발자 세션이 끝나는 때까지)
const DEV_COOKIE = 'sg_d';
const devCookie = (req, token, maxAge) => `${DEV_COOKIE}=${token}; Path=/api/s; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
async function devSession(req, db) {   // 보관된 개발자 세션이 아직 유효하면 { token, exp }
  const token = cookieOf(req, DEV_COOKIE);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await db.prepare('SELECT s.exp FROM sessions s JOIN users u ON u.id = s.uid WHERE s.token = ?1 AND u.handle = ?2 AND s.exp > ?3')
    .bind(await sha256(token), ADMIN_HANDLE, Date.now()).first();
  return r ? { token, exp: r.exp } : null;
}

/* ===== 사용자 ===== */
const PUB = 'id, handle, name, bio, avatar, color, grade, cls, club, mood, stickers, seen, insta, dm_pref, st_cur, st_best, st_last, st_total, st_shield';
const pub = u => u && ({
  handle: u.handle, name: u.name, bio: u.bio, avatar: u.avatar, color: u.color, grade: u.grade, cls: u.cls, club: u.club, mood: u.mood, insta: u.insta || '',
  stickers: (() => { try { return JSON.parse(u.stickers); } catch { return []; } })(), online: Date.now() - (u.seen || 0) < 150e3,
});
const card = u => u && ({ handle: u.handle, name: u.name, avatar: u.avatar, color: u.color, mood: u.mood, online: Date.now() - (u.seen || 0) < 150e3 });
const byHandle = (db, h) => db.prepare(`SELECT ${PUB} FROM users WHERE handle = ?1`).bind(String(h || '').toLowerCase()).first();

async function auth(req, db) {
  const token = cookieOf(req, COOKIE);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await db.prepare(`SELECT u.id, u.handle, u.name, u.bio, u.avatar, u.color, u.grade, u.cls, u.club, u.mood, u.stickers, u.seen, u.insta, u.dm_pref, u.google_sub, u.is_test, u.st_cur, u.st_best, u.st_last, u.st_total, u.st_shield, s.exp
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
// DM 보내도 되는지: 받는 사람(u)의 설정 — 0 서로 팔로우 · 1 받는 사람이 나를 팔로우 · 2 누구나. 차단은 항상 막음
const dmAllowed = (u, r) => !r.blocked && !r.blockedMe && ((u.dm_pref || 0) === 2 || ((u.dm_pref || 0) === 1 && r.followsMe) || (r.following && r.followsMe));
const pairOf = (x, y) => x < y ? `${x}:${y}` : `${y}:${x}`;

/* ===== 라우터 ===== */
export async function onRequest({ request: req, env, params }) {
  const path = (params.path || []).join('/');
  if (!env.DB) return json({ enabled: false });
  const db = env.DB;
  try { await setup(db); } catch (e) { console.error(e); return isWriteLimit(e) ? json({ error: LIMIT_MSG, limit: true }, 503) : err('잠시 후 다시 시도해 주세요', 500); }
  const method = req.method;
  let body = {};
  if (method === 'POST') {
    // 다른 사이트에서 대신 요청 보내는 것 막기 (JSON만 받음 → 교차 출처는 사전 확인에서 막힘)
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return err('forbidden', 403);
    if (req.headers.get('sec-fetch-site') === 'cross-site') return err('forbidden', 403);
    if (+(req.headers.get('content-length') || 0) > 32768) return err('too large', 413);   // 이 API에 32KB 넘는 요청은 없음
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
    if (isWriteLimit(e)) return json({ error: LIMIT_MSG, limit: true }, 503);
    await logErr(db, 's', req, e);
    return err('잠시 후 다시 시도해 주세요', 500);
  }
}

/* ===== 밸런스 게임 상태 (투표 전엔 결과·댓글을 숨김 — 마감 뒤엔 모두에게 공개) ===== */
async function balState(env, db, me) {
  const ymd = balDay(), now = Date.now();
  const c = await db.prepare('SELECT q, a, b FROM balance_custom WHERE ymd = ?1').bind(ymd).first();
  const [q, a, b] = c ? [c.q, c.a, c.b] : defaultBalance(ymd);
  const last = await lastPeriod(env, db, ymd), opens = openAt(ymd), closes = closeAt(ymd, last), open = now >= opens && now < closes;
  const [votes, mineRow, ncom] = await db.batch([
    db.prepare('SELECT pick, COUNT(*) AS n FROM balance_votes WHERE ymd = ?1 GROUP BY pick').bind(ymd),
    db.prepare('SELECT pick FROM balance_votes WHERE ymd = ?1 AND voter = ?2').bind(ymd, 'u' + me.id),
    db.prepare('SELECT COUNT(*) AS n FROM balance_comments WHERE ymd = ?1').bind(ymd),
  ]);
  const counts = { a: 0, b: 0 };
  for (const r of votes.results) if (r.pick in counts) counts[r.pick] = r.n;
  const mine = mineRow.results[0]?.pick || '';
  let comments = null;
  if (mine || !open) {
    comments = (await db.prepare(`SELECT c.id, c.uid, c.body, c.at, COALESCE(v.pick, c.pick) AS pick, u.handle, u.name, u.avatar, u.color
      FROM balance_comments c JOIN users u ON u.id = c.uid LEFT JOIN balance_votes v ON v.ymd = c.ymd AND v.voter = 'u' || c.uid
      WHERE c.ymd = ?1 AND NOT EXISTS (SELECT 1 FROM blocks k WHERE (k.a = ?2 AND k.b = c.uid) OR (k.a = c.uid AND k.b = ?2))
      AND NOT EXISTS (SELECT 1 FROM bans x WHERE x.uid = c.uid AND (x.until = 0 OR x.until > ?3))
      ORDER BY (u.handle = ?4) DESC, c.id DESC LIMIT 100`).bind(ymd, me.id, now, ADMIN_HANDLE).all()).results
      .map(r => ({ id: r.id, body: r.body, at: r.at, pick: r.pick, me: r.uid === me.id, dev: r.handle === ADMIN_HANDLE, handle: r.handle, name: r.name, avatar: r.avatar, color: r.color }));
  }
  return { enabled: true, ymd, q, a, b, last, opens, closes, next: nextOpen(ymd), now, open, counts, mine, ncom: ncom.results[0].n, comments };
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
    return json({ enabled: true, google: env.GOOGLE_CLIENT_ID || '', needCode: Boolean(joinCodeOf(env, st)), signup: signupOpen(st), dm: dmOpen(st) });
  },

  'POST signup': async ({ req, env, db, body }) => {
    const handle = String(body.handle || '').trim().toLowerCase(), name = clean(body.name, 20), pw = String(body.pw || '');
    if (!HANDLE_RE.test(handle)) return err('아이디는 영어 소문자·숫자·_·. 로 3~16자예요');
    if (RESERVED(handle)) return err('쓸 수 없는 아이디예요');
    if (!name) return err('이름(닉네임)을 적어 주세요');
    if (isBad(handle, name)) return err('욕설이나 나쁜 말은 아이디·닉네임에 쓸 수 없어요');
    if (pw.length < 6 || pw.length > 64) return err('비밀번호는 6~64자로 해 주세요');
    { const ni = await nameIssue(db, name); if (ni) return err(ni); }
    if (weakPw(pw, handle)) return err('너무 쉬운 비밀번호예요. 다른 걸로 해 주세요');
    const st = await getSettings(db), code = joinCodeOf(env, st);
    if (!signupOpen(st)) return err('지금은 새로 가입할 수 없어요', 403);
    // 학교 와이파이는 한 반·한 학년이 IP 하나를 같이 씀 → 가입 자체는 IP당 넉넉하게(1시간 300번),
    // 가입 코드 대입 방지는 '코드를 틀린 횟수'만 따로 IP당 1시간 30번으로 제한
    const ik = await ipKey(req);
    if (await limited(db, 'su:' + ik, 300, 3600)) return err('가입 시도가 너무 많아요. 나중에 다시 해 주세요', 429);
    if (code) {
      if (await countOf(db, 'cw:' + ik) >= 30) return err('가입 코드를 너무 많이 틀렸어요. 1시간 뒤에 다시 해 주세요', 429);
      if (!sameStr(String(body.code || '').trim(), code)) { await limited(db, 'cw:' + ik, 30, 3600); return err('가입 코드가 달라요'); }
    }
    if (await db.prepare('SELECT 1 FROM users WHERE handle = ?1').bind(handle).first()) return err('이미 있는 아이디예요');
    const salt = randHex(16);
    const g = +body.grade, c = +body.cls;
    const u = await db.prepare(`INSERT INTO users (handle, name, pw, salt, created, avatar, grade, cls, seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?5) RETURNING id`)
      .bind(handle, name, await hashPw(pw, salt), salt, Date.now(), AVATARS[Math.floor(Math.random() * 16)],
        g >= 1 && g <= 3 ? g : 0, c >= 1 && c <= 6 ? c : 0).first();
    return json({ ok: true }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },

  'POST login': async ({ req, db, body }) => {
    const handle = String(body.handle || '').trim().toLowerCase(), pw = String(body.pw || '');
    // 아이디+IP 기준으로 막아서, 다른 사람이 일부러 틀려도 내 기기에서는 계속 로그인할 수 있게 함. 아이디 전체 한도는 여러 IP로 대입하는 것 대비
    const ik = await ipKey(req), h = handle.slice(0, 16);
    if (await limited(db, 'li:' + ik, 600, 600) ||   /* IP당 10분 600번: 반 전체가 같은 IP로 동시에 로그인해도 안 막힘 */ await limited(db, 'lh:' + h + ':' + ik, 10, 600) || await countOf(db, 'lg:' + h) >= 60) return err('로그인 시도가 너무 많아요. 잠시 뒤에 다시 해 주세요', 429);
    const u = HANDLE_RE.test(handle) && await db.prepare('SELECT id, pw, salt FROM users WHERE handle = ?1').bind(handle).first();
    const ok = sameStr(await hashPw(pw, (u || DUMMY).salt), (u || DUMMY).pw);   // 없는 아이디도 똑같이 해시 계산
    if (!u || !ok) { await limited(db, 'lg:' + h, 60, 3600); return err('아이디나 비밀번호가 맞지 않아요', 401); }   // 아이디 전체로는 '틀린 횟수'만 셈(여러 IP로 대입하는 것 대비)
    const ban = await db.prepare('SELECT until, reason FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(u.id, Date.now()).first();
    if (ban) {
      const when = ban.until ? new Date(ban.until + 9 * 3600e3).toISOString().slice(5, 16).replace('-', '/').replace('T', ' ') + '까지' : '무기한';
      return err(`이용이 정지된 계정이에요 (${when}${ban.reason ? ' · ' + ban.reason : ''})`, 403);
    }
    return json({ ok: true }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },

  'POST logout': async ({ req, db }) => {
    const token = cookieOf(req, COOKIE), me = await auth(req, db), dev = me?.is_test ? await devSession(req, db) : null;
    if (/^[0-9a-f]{64}$/.test(token)) await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha256(token)).run();
    if (dev) await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha256(dev.token)).run();   // 테스트 계정에서 로그아웃하면 개발자 로그인도 끝
    const res = json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) });
    if (cookieOf(req, DEV_COOKIE)) res.headers.append('set-cookie', devCookie(req, '', 0));
    return endAdmin(db, req, me, res);
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
    const sw = me.handle === ADMIN_HANDLE ? 'dev' : me.is_test && await devSession(req, db) ? Object.keys(TEST_ACCOUNTS).find(k => TEST_ACCOUNTS[k].handle === me.handle) : '';
    return json({ me: { ...pub(me), online: true, dmPref: me.dm_pref || 0, google: !!me.google_sub, sw, attBest: me.st_best || 0 }, unread: unread.n, counts: { following: fo.n, followers: fb.n, friends: fr.length } });
  },

  'POST me': needMe(async ({ db, me, body }) => {
    const name = clean(body.name, 20);
    if (!name) return err('이름(닉네임)을 적어 주세요');
    if (isBad(name, body.bio, body.mood, body.club)) return err('욕설이나 나쁜 말은 쓸 수 없어요');
    if (nameKey(name) !== nameKey(me.name) && me.handle !== ADMIN_HANDLE) { const ni = await nameIssue(db, name, me.id); if (ni) return err(ni); }
    // 출석 보상으로 해금한 프로필 사진·스티커도 허용 (최고 연속 기록 기준)
    const avOk = [...AVATARS, ...unlockedOf(me.st_best, 'avatar')], stOk = [...STICKERS, ...unlockedOf(me.st_best, 'sticker')];
    const avatar = avOk.includes(body.avatar) ? body.avatar : me.avatar;
    const color = COLORS.includes(body.color) ? body.color : me.color;
    const stickers = (Array.isArray(body.stickers) ? body.stickers : []).filter(s => stOk.includes(s)).slice(0, 6);
    const dev = me.handle === ADMIN_HANDLE, g = dev ? 0 : +body.grade, c = dev ? 0 : +body.cls;   // 개발자 계정은 학년·반 없음
    // 인스타 아이디: @·주소를 붙여 넣어도 아이디만 남김. 인스타 규칙(영문·숫자·._, 30자)에 안 맞으면 거절
    const insta = String(body.insta || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();
    if (insta && !/^(?!.*\.\.)(?!\.)[a-z0-9._]{1,30}(?<!\.)$/.test(insta)) return err('인스타 아이디는 영문·숫자·밑줄(_)·마침표(.)만 쓸 수 있어요');
    await db.prepare('UPDATE users SET name = ?1, bio = ?2, avatar = ?3, color = ?4, grade = ?5, cls = ?6, club = ?7, mood = ?8, stickers = ?9, insta = ?11 WHERE id = ?10')
      .bind(name, clean(body.bio, 80, true), avatar, color, g >= 1 && g <= 3 ? g : 0, c >= 1 && c <= 6 ? c : 0, clean(body.club, 16), clean(body.mood, 24),
        JSON.stringify([...new Set(stickers)]), me.id, insta).run();
    return json({ ok: true });
  }),

  'POST password': needMe(async ({ req, db, me, body }) => {
    if (await limited(db, 'pw:' + me.id, 10, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);   // 로그인된 기기를 잠깐 빌린 사람이 비밀번호를 대입하지 못하게
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    if (!sameStr(await hashPw(String(body.old || ''), u.salt), u.pw)) return err('지금 비밀번호가 맞지 않아요', 401);
    const pw = String(body.pw || '');
    if (pw.length < 6 || pw.length > 64) return err('새 비밀번호는 6~64자로 해 주세요');
    if (weakPw(pw, me.handle)) return err('너무 쉬운 비밀번호예요. 다른 걸로 해 주세요');
    const salt = randHex(16);
    const cur = await sha256(cookieOf(req, COOKIE));
    await db.batch([
      db.prepare('UPDATE users SET pw = ?1, salt = ?2 WHERE id = ?3').bind(await hashPw(pw, salt), salt, me.id),
      db.prepare('DELETE FROM sessions WHERE uid = ?1 AND token != ?2').bind(me.id, cur),   // 다른 기기는 로그아웃
    ]);
    return endAdmin(db, req, me, json({ ok: true }));
  }),

  // 관리자 입장: ADMIN_HANDLE 계정만, 비밀번호를 한 번 더 확인 → 12시간 관리자 세션(쿠키 경로 /api/admin, 관리자 API에서 검사)
  'POST admin-pass': needMe(async ({ req, db, me, body }) => {
    if (me.handle !== ADMIN_HANDLE) return err('관리자 계정이 아니에요', 403);
    if (await limited(db, 'ap:' + me.id, 8, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    if (!sameStr(await hashPw(String(body.pw || ''), u.salt), u.pw)) {
      await db.prepare('INSERT INTO admin_log (at, action, detail) VALUES (?1, ?2, ?3)').bind(Date.now(), '로그인 실패', maskIp(req)).run();
      return err('비밀번호가 맞지 않아요', 401);
    }
    const token = randHex(32), H = 12;
    await db.batch([
      db.prepare('DELETE FROM admin_sessions WHERE exp < ?1').bind(Date.now()),
      db.prepare('INSERT INTO admin_sessions (token, exp) VALUES (?1, ?2)').bind(await sha256(token), Date.now() + H * 3600e3),
      db.prepare('INSERT INTO admin_log (at, action, detail) VALUES (?1, ?2, ?3)').bind(Date.now(), '로그인', maskIp(req)),
    ]);
    const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
    return json({ ok: true }, 200, { 'set-cookie': `sg_a=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${H * 3600}${secure}` });
  }),

  'POST withdraw': needMe(async ({ req, env, db, me, body }) => {
    if (await limited(db, 'pw:' + me.id, 10, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);
    // 본인 확인: 비밀번호, 또는 구글로 가입한 계정이면 연결된 구글 로그인
    if (body.credential) {
      const g = await verifyGoogle(env, body.credential);
      if (!g || g.sub !== me.google_sub) return err('연결된 구글 계정으로 확인해 주세요', 401);
    } else {
      const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
      if (!sameStr(await hashPw(String(body.pw || ''), u.salt), u.pw)) return err('비밀번호가 맞지 않아요', 401);
    }
    await db.batch([
      'DELETE FROM sessions WHERE uid = ?1', 'DELETE FROM follows WHERE a = ?1 OR b = ?1', 'DELETE FROM blocks WHERE a = ?1 OR b = ?1',
      'DELETE FROM messages WHERE a = ?1 OR b = ?1', 'DELETE FROM scores WHERE uid = ?1', 'DELETE FROM bans WHERE uid = ?1', 'DELETE FROM reports WHERE reporter = ?1', 'DELETE FROM feedback WHERE uid = ?1', 'DELETE FROM attendance WHERE uid = ?1',
      'DELETE FROM users WHERE id = ?1',
    ].map(s => db.prepare(s).bind(me.id)));
    return endAdmin(db, req, me, json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) }));
  }),

  // 개발자 → 학과별 테스트 계정(콘·미·프)으로 바꿔 보기 / 개발자로 돌아가기. 개발자 세션은 sg_d 쿠키에 보관
  'POST dev-switch': async ({ req, db, body }) => {
    const me = await auth(req, db);
    if (!me) return err('로그인이 필요해요', 401);
    const cur = cookieOf(req, COOKIE);
    const dev = me.handle === ADMIN_HANDLE ? { token: cur, exp: me.exp } : me.is_test ? await devSession(req, db) : null;
    if (!dev) return err('개발자 계정만 쓸 수 있어요', 403);
    const dropCur = async () => { if (me.is_test) await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(await sha256(cur)).run(); };   // 쓰던 테스트 세션은 지움
    const left = Math.max(0, Math.floor((dev.exp - Date.now()) / 1000));
    if (body.to === 'back') {
      if (!me.is_test) return json({ ok: true });
      await dropCur();
      const res = json({ ok: true }, 200, { 'set-cookie': setCookie(req, dev.token, left) });
      res.headers.append('set-cookie', devCookie(req, '', 0));
      return res;
    }
    const t = Object.hasOwn(TEST_ACCOUNTS, body.to) ? TEST_ACCOUNTS[body.to] : null;
    if (!t) return err('없는 테스트 계정이에요');
    let u = await db.prepare('SELECT id, is_test FROM users WHERE handle = ?1').bind(t.handle).first();
    if (u && !u.is_test) return err('그 아이디는 이미 다른 사람이 쓰고 있어요', 409);
    if (!u) {
      const salt = randHex(16);
      u = await db.prepare(`INSERT INTO users (handle, name, pw, salt, created, avatar, grade, cls, seen, is_test) VALUES (?1, ?2, ?3, ?4, ?5, '🤖', ?6, ?7, ?5, 1) RETURNING id`)
        .bind(t.handle, t.name, await hashPw(randHex(24), salt), salt, Date.now(), TEST_GRADE, t.cls).first();
    }
    await dropCur();
    const res = json({ ok: true, grade: TEST_GRADE, cls: t.cls }, 200, { 'set-cookie': await newSession(req, db, u.id) });
    res.headers.append('set-cookie', devCookie(req, dev.token, left));
    return res;
  },

  /* ----- 사람 ----- */
  'GET user': needMe(async ({ env, db, me, arg }) => {
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
      user: pub(u), me: u.id === me.id, rel: r, canDm: dmAllowed(u, r), counts: { following: fo.n, followers: fb.n },
      bests: Object.fromEntries(bests.results.map(x => [x.game, x.best])), crowns,
      streak: { cur: (await liveMany(env, db, [u]))[0], best: u.st_best || 0, total: u.st_total || 0 },
    });
  }),

  'GET search': needMe(async ({ db, me, url }) => {
    const q = clean(url.searchParams.get('q'), 16).toLowerCase().replace(/[%_\\]/g, '');
    let rows;
    if (q) {
      rows = (await db.prepare(`SELECT ${PUB} FROM users WHERE (handle LIKE ?1 OR name LIKE ?1) AND id != ?2 AND is_test = 0
        AND id NOT IN (SELECT a FROM blocks WHERE b = ?2) ORDER BY seen DESC LIMIT 30`).bind(`%${q}%`, me.id).all()).results;
    } else {   // 검색어 없으면: 최근에 들어온 사람
      rows = (await db.prepare(`SELECT ${PUB} FROM users WHERE id != ?1 AND is_test = 0 AND id NOT IN (SELECT a FROM blocks WHERE b = ?1) ORDER BY seen DESC LIMIT 30`).bind(me.id).all()).results;
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
    if (await limited(db, 'bk:' + me.id, 60, 600)) return err('너무 빨라요. 잠시 후에 해 주세요', 429);
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
      user: card(u), rel: r, canSend: dmAllowed(u, r), readUpTo: read?.id || 0,
      messages: rows.map(m => ({ id: m.id, mine: m.a === me.id, body: m.del ? '' : m.body, del: !!m.del, at: m.at })),
    });
  }),

  'POST dm': needMe(async ({ db, me, arg, body }) => {
    const u = await byHandle(db, arg);
    if (!u || u.id === me.id) return err('없는 사용자예요', 404);
    const r = await rel(db, me.id, u.id);
    if (r.blocked || r.blockedMe) return err('메시지를 보낼 수 없어요', 403);
    if (!dmAllowed(u, r)) return err(['서로 팔로우한 친구에게만', '나를 팔로우하는 사람에게만', ''][u.dm_pref || 0] + ' 보낼 수 있어요', 403);
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
    if (!(id > 0)) return err('지울 수 없어요');
    const r = await db.prepare("UPDATE messages SET del = 1, body = '' WHERE id = ?1 AND a = ?2").bind(id, me.id).run();
    return r.meta.changes ? json({ ok: true }) : err('지울 수 없어요');
  }),

  // DM 받는 범위 설정
  'POST dmpref': needMe(async ({ db, me, body }) => {
    const v = [0, 1, 2].includes(body.pref) ? body.pref : 0;
    await db.prepare('UPDATE users SET dm_pref = ?1 WHERE id = ?2').bind(v, me.id).run();
    return json({ ok: true, dmPref: v });
  }),

  /* ----- 구글 로그인 (Google Identity Services ID 토큰). 비밀 변수 없이 공개 값 GOOGLE_CLIENT_ID만 필요 ----- */
  // 처음이면 { need: 'signup' } → 같은 토큰 + 아이디·닉네임으로 다시 보내면 가입
  'POST google': async ({ req, env, db, body }) => {
    const ik = await ipKey(req);
    if (await limited(db, 'gl:' + ik, 600, 600)) return err('로그인 시도가 너무 많아요. 잠시 뒤에 다시 해 주세요', 429);   // 구글 확인(바깥 요청) 전에 막음
    const g = await verifyGoogle(env, body.credential);
    if (!g) return err('구글 로그인을 확인하지 못했어요. 다시 해 주세요', 401);
    const u = await db.prepare('SELECT id, handle, is_test FROM users WHERE google_sub = ?1').bind(g.sub).first();
    if (u) {
      if (noGoogle(u)) return err('이 계정은 구글로 로그인할 수 없어요. 아이디·비밀번호로 로그인해 주세요', 403);
      const ban = await db.prepare('SELECT until, reason FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(u.id, Date.now()).first();
      if (ban) return err('이용이 정지된 계정이에요' + (ban.reason ? ' · ' + ban.reason : ''), 403);
      return json({ ok: true, handle: u.handle }, 200, { 'set-cookie': await newSession(req, db, u.id) });
    }
    if (body.find) return err('이 구글 계정에 연결된 아이디가 없어요. 아이디·비밀번호로 로그인한 뒤 프로필 → ⚙️에서 연결해 주세요', 404);
    if (!body.handle) return json({ need: 'signup', name: clean(g.name, 20) });
    const handle = String(body.handle).trim().toLowerCase(), name = clean(body.name, 20);
    if (!HANDLE_RE.test(handle)) return err('아이디는 영어 소문자·숫자·_·. 로 3~16자예요');
    if (RESERVED(handle)) return err('쓸 수 없는 아이디예요');
    if (!name) return err('이름(닉네임)을 적어 주세요');
    if (isBad(handle, name)) return err('욕설이나 나쁜 말은 아이디·닉네임에 쓸 수 없어요');
    { const ni = await nameIssue(db, name); if (ni) return err(ni); }
    const st = await getSettings(db), code = joinCodeOf(env, st);
    if (!signupOpen(st)) return err('지금은 새로 가입할 수 없어요', 403);
    if (await limited(db, 'su:' + ik, 300, 3600)) return err('가입 시도가 너무 많아요. 나중에 다시 해 주세요', 429);
    if (code) {
      if (await countOf(db, 'cw:' + ik) >= 30) return err('가입 코드를 너무 많이 틀렸어요. 1시간 뒤에 다시 해 주세요', 429);
      if (!sameStr(String(body.code || '').trim(), code)) { await limited(db, 'cw:' + ik, 30, 3600); return err('가입 코드가 달라요'); }
    }
    if (await db.prepare('SELECT 1 FROM users WHERE handle = ?1').bind(handle).first()) return err('이미 있는 아이디예요');
    const salt = randHex(16), g2 = +body.grade, c2 = +body.cls;
    const nu = await db.prepare(`INSERT INTO users (handle, name, pw, salt, created, avatar, grade, cls, seen, google_sub) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?5, ?9) RETURNING id`)
      .bind(handle, name, await hashPw(randHex(24), salt), salt, Date.now(), AVATARS[Math.floor(Math.random() * 16)], g2 >= 1 && g2 <= 3 ? g2 : 0, c2 >= 1 && c2 <= 6 ? c2 : 0, g.sub).first();   // 비밀번호는 아무도 모르는 무작위 값(구글로만 로그인)
    return json({ ok: true, created: true }, 200, { 'set-cookie': await newSession(req, db, nu.id) });
  },
  // 이미 있는 계정에 구글 연결 / 해제
  // 연결·해제 모두 지금 비밀번호 확인 (로그인된 기기를 잠깐 빌린 사람이 자기 구글을 몰래 연결해 계정을 가져가지 못하게)
  'POST google-link': needMe(async ({ env, db, me, body }) => {
    if (noGoogle(me) && !body.off) return err('개발자·테스트 계정은 구글을 연결할 수 없어요', 403);
    if (await limited(db, 'pw:' + me.id, 10, 900)) return err('시도가 너무 많아요. 15분 뒤에 다시 해 주세요', 429);
    const u = await db.prepare('SELECT pw, salt FROM users WHERE id = ?1').bind(me.id).first();
    if (!sameStr(await hashPw(String(body.pw || ''), u.salt), u.pw)) return err('지금 비밀번호가 맞지 않아요', 401);
    if (body.off) { await db.prepare('UPDATE users SET google_sub = NULL WHERE id = ?1').bind(me.id).run(); return json({ ok: true }); }
    const g = await verifyGoogle(env, body.credential);
    if (!g) return err('구글 로그인을 확인하지 못했어요', 401);
    const other = await db.prepare('SELECT id FROM users WHERE google_sub = ?1').bind(g.sub).first();
    if (other && other.id !== me.id) return err('이 구글 계정은 이미 다른 아이디에 연결돼 있어요');
    await db.prepare('UPDATE users SET google_sub = ?1 WHERE id = ?2').bind(g.sub, me.id).run();
    return json({ ok: true });
  }),

  // 비밀번호를 잊었을 때: 연결된 구글로 본인 확인 → (pw 없으면) 아이디만 알려 줌 / (pw 있으면) 새 비밀번호로 바꾸고 모든 기기 로그아웃 후 이 기기만 로그인
  'POST google-reset': async ({ req, env, db, body }) => {
    const ik = await ipKey(req);
    if (await limited(db, 'gr:' + ik, 60, 3600)) return err('시도가 너무 많아요. 나중에 다시 해 주세요', 429);
    const g = await verifyGoogle(env, body.credential);
    if (!g) return err('구글 로그인을 확인하지 못했어요. 다시 해 주세요', 401);
    const u = await db.prepare('SELECT id, handle, is_test FROM users WHERE google_sub = ?1').bind(g.sub).first();
    if (!u) return err('이 구글 계정에 연결된 아이디가 없어요. 구글을 미리 연결해 둔 계정만 찾을 수 있어요', 404);
    if (noGoogle(u)) return err('이 계정은 구글로 찾을 수 없어요', 403);
    if (body.pw === undefined) return json({ handle: u.handle });
    if (await limited(db, 'grp:' + u.id, 5, 3600)) return err('비밀번호를 너무 자주 바꿨어요. 1시간 뒤에 다시 해 주세요', 429);
    const pw = String(body.pw || '');
    if (pw.length < 6 || pw.length > 64) return err('새 비밀번호는 6~64자로 해 주세요');
    if (weakPw(pw, u.handle)) return err('너무 쉬운 비밀번호예요. 다른 걸로 해 주세요');
    const ban = await db.prepare('SELECT 1 FROM bans WHERE uid = ?1 AND (until = 0 OR until > ?2)').bind(u.id, Date.now()).first();
    const salt = randHex(16);
    await db.batch([
      db.prepare('UPDATE users SET pw = ?1, salt = ?2 WHERE id = ?3').bind(await hashPw(pw, salt), salt, u.id),
      db.prepare('DELETE FROM sessions WHERE uid = ?1').bind(u.id),   // 혹시 남이 로그인해 둔 기기도 모두 끊김
    ]);
    if (ban) return json({ ok: true, handle: u.handle, banned: true });
    return json({ ok: true, handle: u.handle }, 200, { 'set-cookie': await newSession(req, db, u.id) });
  },
  // 모든 기기에서 로그아웃 (학교 태블릿에 로그인을 두고 왔을 때) — 이 기기 포함
  'POST logout-all': needMe(async ({ req, db, me }) => {
    await db.prepare('DELETE FROM sessions WHERE uid = ?1').bind(me.id).run();
    const res = json({ ok: true }, 200, { 'set-cookie': setCookie(req, '', 0) });
    if (cookieOf(req, DEV_COOKIE)) res.headers.append('set-cookie', devCookie(req, '', 0));
    return endAdmin(db, req, me, res);
  }),

  /* ----- 오늘의 밸런스 게임: 월~금 하루 한 문제, 6시 공개 · 마지막 교시 끝 +10분 마감. 한 사람 한 표(로그인 계정 기준), 댓글은 고른 쪽이 같이 보임 ----- */
  'GET bal': needMe(async ({ env, db, me }) => json(await balState(env, db, me))),
  'POST bal': needMe(async ({ env, db, me, body }) => {
    const pick = String(body.pick ?? '');
    if (!['a', 'b', ''].includes(pick)) return err('bad pick');
    const st = await balState(env, db, me);
    if (body.ymd && body.ymd !== st.ymd) return err('질문이 바뀌었어요. 새로 고침해 주세요', 409);
    if (!st.open) return err(Date.now() < st.opens ? '아직 투표 시작 전이에요 (6시 시작)' : '투표가 마감됐어요');
    if (await limited(db, 'bv:' + me.id, 40, 600)) return err('너무 많이 눌렀어요. 잠시 후에 해 주세요', 429);
    if (!pick) await db.prepare('DELETE FROM balance_votes WHERE ymd = ?1 AND voter = ?2').bind(st.ymd, 'u' + me.id).run();
    else await db.prepare('INSERT INTO balance_votes (ymd, voter, pick, at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (ymd, voter) DO UPDATE SET pick = excluded.pick, at = excluded.at')
      .bind(st.ymd, 'u' + me.id, pick, Date.now()).run();
    return json(await balState(env, db, me));
  }),
  'POST balc': needMe(async ({ env, db, me, body }) => {
    const text = clean(body.body, 100, true);
    if (!text) return err('내용을 적어 주세요');
    if (isBad(text)) return err('욕설·비속어는 쓸 수 없어요');
    const st = await balState(env, db, me);
    if (body.ymd && body.ymd !== st.ymd) return err('질문이 바뀌었어요. 새로 고침해 주세요', 409);
    if (st.open && !st.mine) return err('먼저 한쪽을 골라야 댓글을 달 수 있어요');
    if (await limited(db, 'bc:' + me.id, 6, 300)) return err('댓글은 5분에 6개까지 달 수 있어요', 429);
    await db.prepare('INSERT INTO balance_comments (ymd, uid, pick, body, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(st.ymd, me.id, st.mine || '', text, Date.now()).run();
    return json(await balState(env, db, me));
  }),
  'POST balcdel': needMe(async ({ env, db, me, body }) => {
    const r = await db.prepare('DELETE FROM balance_comments WHERE id = ?1 AND uid = ?2').bind(+body.id || 0, me.id).run();
    if (!r.meta.changes) return err('지울 수 없는 댓글이에요');
    return json(await balState(env, db, me));
  }),
  'POST balcrep': needMe(async ({ db, me, body }) => {
    const c = await db.prepare('SELECT uid, ymd, body FROM balance_comments WHERE id = ?1').bind(+body.id || 0).first();
    if (!c) return err('없는 댓글이에요');
    if (c.uid === me.id) return err('내 댓글은 신고할 수 없어요');
    if (await limited(db, 'rp:' + me.id, 10, 3600)) return err('신고가 너무 많아요', 429);
    await db.prepare('INSERT INTO reports (reporter, target, msg, reason, at) VALUES (?1, ?2, NULL, ?3, ?4)')
      .bind(me.id, c.uid, `[밸런스 댓글 #${+body.id} · ${c.ymd}] ${c.body}` + (body.reason ? ` / 사유: ${clean(body.reason, 100)}` : ''), Date.now()).run();
    return json({ ok: true });
  }),

  /* ----- 의견 보내기 (개발자에게, 로그인 필요) ----- */
  'POST feedback': needMe(async ({ db, me, body }) => {
    const kind = ['idea', 'bug', 'etc'].includes(body.kind) ? body.kind : 'etc';
    const text = clean(body.body, 500, true);
    if (text.length < 2) return err('내용을 조금 더 적어 주세요');
    if (await limited(db, 'fb:' + me.id, 6, 3600)) return err('의견은 1시간에 6번까지 보낼 수 있어요', 429);
    await db.prepare('INSERT INTO feedback (uid, kind, body, at) VALUES (?1, ?2, ?3, ?4)').bind(me.id, kind, text, Date.now()).run();
    return json({ ok: true });
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
    const [prev, allPrev] = await Promise.all([
      db.prepare('SELECT best FROM scores WHERE uid = ?1 AND game = ?2 AND day = ?3').bind(me.id, game, day).first(),
      db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first(),
    ]);
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
      rows = (await db.prepare(`SELECT ${U}, t.best AS value, t.uid FROM (${BEST}) t JOIN users u ON u.id = t.uid
        WHERE t.uid = ?2 OR t.uid IN (SELECT f.b FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a WHERE f.a = ?2) ORDER BY t.best, t.at LIMIT 50`)
        .bind(game, me.id).all()).results;
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

  /* ----- 출석 체크 (lib/attend.js) ----- */
  // 오늘 출석: 하루 한 번만 기록(두 탭이 동시에 보내도 st_last 조건으로 한 번만). 이미 했으면 지금 상태만 돌려줌
  'POST att': needMe(async ({ env, db, me }) => attState(env, db, me, true)),
  'GET att': needMe(async ({ env, db, me, url }) => {
    const m = url.searchParams.get('m') || kstToday().slice(0, 6);
    if (!/^\d{6}$/.test(m)) return err('bad month');
    const [st, days] = await Promise.all([attState(env, db, me, false, true),
      db.prepare("SELECT ymd, kind FROM attendance WHERE uid = ?1 AND ymd LIKE ?2 ORDER BY ymd").bind(me.id, m + '%').all()]);
    const body = await st.json();
    return json({ ...body, month: m, days: days.results });
  }),
  // 연속 출석 랭킹: 친구(맞팔 + 나) · 전체 (지금 살아 있는 기록 기준, 같으면 최고 기록 순)
  'GET attrank': needMe(async ({ env, db, me, url }) => {
    const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'friends';
    const U = 'u.id, u.handle, u.name, u.avatar, u.color, u.grade, u.cls, u.seen, u.mood, u.st_cur, u.st_best, u.st_last, u.st_shield';
    const since = (() => { const d = new Date(Date.now() + 9 * 3600e3 - 120 * 86400e3); return d.toISOString().slice(0, 10).replace(/-/g, ''); })();
    const rows = (scope === 'friends'
      ? await db.prepare(`SELECT ${U} FROM users u WHERE u.st_cur > 0 AND u.st_last >= ?3 AND (u.id = ?1 OR u.id IN (SELECT f.b FROM follows f JOIN follows g ON g.a = f.b AND g.b = f.a WHERE f.a = ?1)) ORDER BY u.st_cur DESC LIMIT ?2`).bind(me.id, 200, since).all()
      : await db.prepare(`SELECT ${U} FROM users u WHERE u.st_cur > 0 AND u.st_last >= ?3 AND u.is_test = 0 AND u.handle <> ?1 ORDER BY u.st_cur DESC LIMIT ?2`).bind(ADMIN_HANDLE, 300, since).all()).results;
    const live = await liveMany(env, db, rows);
    const list = rows.map((r, i) => ({ ...card(r), grade: r.grade, cls: r.cls, value: live[i], best: r.st_best, isMe: r.id === me.id, uid: r.id }))
      .filter(x => x.value > 0).sort((a, b) => b.value - a.value || b.best - a.best).slice(0, 50);
    return json({ scope, list: list.map(({ uid, ...x }) => x) });
  }),

  'GET games': needMe(async ({ db, me }) => {   // 게임 첫 화면: 게임별 1등 · 내 최고 기록 · 내 순위
    const out = {};
    await Promise.all(Object.keys(GAMES).map(async game => {
      const [top, ma] = await Promise.all([
        db.prepare('SELECT u.handle, u.name, u.avatar, u.color, u.seen, u.mood, s.best FROM scores s JOIN users u ON u.id = s.uid WHERE s.game = ?1 ORDER BY s.best, s.at LIMIT 1').bind(game).first(),
        db.prepare('SELECT MIN(best) AS b FROM scores WHERE uid = ?1 AND game = ?2').bind(me.id, game).first(),
      ]);
      const best = ma?.b ?? null;
      out[game] = { top: top ? { ...card(top), value: top.best } : null, best, rank: best != null ? await rankOf(db, game, best) : null };
    }));
    return json({ games: out });
  }),
};

/* ===== 출석 상태 계산 · 오늘 출석 기록 ===== */
async function attState(env, db, me, doCheck, quiet = false) {
  const today = kstToday();
  let u = { st_cur: me.st_cur || 0, st_best: me.st_best || 0, st_last: me.st_last || '', st_total: me.st_total || 0, st_shield: me.st_shield || 0 };
  const week = weekOf(today);
  const weekRows = async () => (await db.prepare(`SELECT ymd, kind FROM attendance WHERE uid = ?1 AND ymd >= ?2 AND ymd <= ?3`).bind(me.id, week[0], week[6]).all()).results;
  const out = (extra = {}) => ({ today, done: u.st_last === today, cur: u.st_last === today ? u.st_cur : liveCur(u, extra.missed ?? []), best: u.st_best, total: u.st_total, shield: u.st_shield,
    shieldMax: SHIELD_MAX, shieldEvery: SHIELD_EVERY, rewards: REWARDS.map(r => ({ ...r, on: u.st_best >= r.d })), week, ...extra, missed: undefined });
  if (u.st_last === today) return json(out({ new: false, weekDays: quiet ? undefined : await weekRows() }));
  const missed = await missedDays(env, db, u.st_last, today);
  if (!doCheck) return json(out({ new: false, missed }));
  const prevLive = liveCur(u, missed);
  let cur, used = 0;
  if (prevLive > 0) { used = missed.length; cur = u.st_cur + 1; } else cur = 1;
  let shield = (prevLive > 0 ? u.st_shield - used : u.st_shield);
  const gotShield = cur % SHIELD_EVERY === 0 && shield < SHIELD_MAX;
  if (gotShield) shield++;
  const best = Math.max(u.st_best, cur), oldBest = u.st_best;
  const r = await db.prepare(`UPDATE users SET st_cur = ?1, st_best = ?2, st_last = ?3, st_total = st_total + 1, st_shield = ?4 WHERE id = ?5 AND st_last = ?6 RETURNING st_total`)
    .bind(cur, best, today, shield, me.id, u.st_last).first();
  if (!r) {   // 다른 탭이 먼저 기록함 → 새로 읽어서 상태만
    const f = await db.prepare('SELECT st_cur, st_best, st_last, st_total, st_shield FROM users WHERE id = ?1').bind(me.id).first();
    u = f; return json(out({ new: false, weekDays: await weekRows() }));
  }
  const stmts = [db.prepare('INSERT OR IGNORE INTO attendance (uid, ymd, kind) VALUES (?1, ?2, 1)').bind(me.id, today)];
  if (used) for (const y of missed) stmts.push(db.prepare('INSERT OR IGNORE INTO attendance (uid, ymd, kind) VALUES (?1, ?2, 2)').bind(me.id, y));
  await db.batch(stmts);
  const lost = prevLive === 0 && u.st_cur > 0 ? u.st_cur : 0;   // 끊긴 기록(있었다면)
  u = { st_cur: cur, st_best: best, st_last: today, st_total: r.st_total, st_shield: shield };
  return json(out({ new: true, prev: prevLive, lost, used, gotShield, unlocked: REWARDS.filter(x => x.d > oldBest && x.d <= best), weekDays: await weekRows() }));
}

async function rankOf(db, game, best) {   // 나보다 최고 기록이 좋은 사람 수 + 1
  return (await db.prepare('SELECT COUNT(*) + 1 AS r FROM (SELECT MIN(best) AS b FROM scores WHERE game = ?1 GROUP BY uid) WHERE b < ?2').bind(game, best).first()).r;
}

async function topCrowns(db, uid) {   // 역대 1등인 게임 목록
  const games = Object.keys(GAMES);
  const tops = await Promise.all(games.map(game => db.prepare('SELECT uid FROM scores WHERE game = ?1 ORDER BY best, at LIMIT 1').bind(game).first()));
  return games.filter((_, i) => tops[i]?.uid === uid);
}
