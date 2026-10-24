// SVMHS GROUND — D1 테이블 정의 + 공용 설정 (functions 세 곳이 같이 씀: 소셜 · 관리자 · 급식/밸런스)
// functions/ 밖에 둬서 라우트로 잡히지 않게 함. 테이블은 첫 요청 때 자동으로 만든다.
import { RW_OLD } from '../public/js/att-rewards.js';

export const SCHEMA = [
  /* 소셜 */
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pw TEXT NOT NULL, salt TEXT NOT NULL,
    created INTEGER NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '😎', color TEXT NOT NULL DEFAULT 'sky', grade INTEGER NOT NULL DEFAULT 0,
    cls INTEGER NOT NULL DEFAULT 0, club TEXT NOT NULL DEFAULT '', mood TEXT NOT NULL DEFAULT '', stickers TEXT NOT NULL DEFAULT '[]', seen INTEGER NOT NULL DEFAULT 0,
    insta TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid INTEGER NOT NULL, exp INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_uid ON sessions (uid)`,
  `CREATE TABLE IF NOT EXISTS follows (a INTEGER NOT NULL, b INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (a, b))`,
  `CREATE INDEX IF NOT EXISTS follows_b ON follows (b)`,
  `CREATE TABLE IF NOT EXISTS blocks (a INTEGER NOT NULL, b INTEGER NOT NULL, PRIMARY KEY (a, b))`,
  `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, pair TEXT NOT NULL, a INTEGER NOT NULL, b INTEGER NOT NULL, body TEXT NOT NULL,
    at INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0, del INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS messages_pair ON messages (pair, id)`,
  `CREATE INDEX IF NOT EXISTS messages_unread ON messages (b, seen)`,
  `CREATE INDEX IF NOT EXISTS messages_a ON messages (a)`,
  `CREATE TABLE IF NOT EXISTS scores (uid INTEGER NOT NULL, game TEXT NOT NULL, day TEXT NOT NULL, best INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (uid, game, day))`,
  `CREATE INDEX IF NOT EXISTS scores_day ON scores (game, day, best)`,
  `CREATE INDEX IF NOT EXISTS scores_gub ON scores (game, uid, best)`,   // 랭킹: 게임별·사람별 최고 기록
  `CREATE INDEX IF NOT EXISTS scores_top ON scores (game, best, at)`,   // 게임별 1등
  `CREATE INDEX IF NOT EXISTS users_seen ON users (seen)`,   // 최근 접속순·접속 중
  // done: 0 대기 · 1 처리함 · 2 넘김(문제 없음)
  `CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter INTEGER NOT NULL, target INTEGER NOT NULL, msg INTEGER, reason TEXT NOT NULL, at INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS rl (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL)`,
  /* 관리자 */
  `CREATE TABLE IF NOT EXISTS bans (uid INTEGER PRIMARY KEY, until INTEGER NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL)`,   // until 0 = 영구
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, exp INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS admin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS balance_custom (ymd TEXT PRIMARY KEY, q TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL)`,
  /* 급식 인기투표 · 밸런스 게임 */
  `CREATE TABLE IF NOT EXISTS meal_votes (ymd TEXT NOT NULL, meal TEXT NOT NULL, voter TEXT NOT NULL, dish TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (ymd, meal, voter))`,
  `CREATE TABLE IF NOT EXISTS balance_votes (ymd TEXT NOT NULL, voter TEXT NOT NULL, pick TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (ymd, voter))`,
  /* v13: 밸런스 댓글(로그인 사용자, 고른 쪽 표시) · 날짜별 마지막 교시(마감 시각 계산용, 나이스에서 하루 한 번) */
  `CREATE TABLE IF NOT EXISTS balance_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, ymd TEXT NOT NULL, uid INTEGER NOT NULL, pick TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS balance_comments_ymd ON balance_comments (ymd, id)`,
  `CREATE TABLE IF NOT EXISTS balance_comment_likes (cid INTEGER NOT NULL, uid INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (cid, uid))`,
  `CREATE TABLE IF NOT EXISTS balance_days (ymd TEXT PRIMARY KEY, last INTEGER NOT NULL, at INTEGER NOT NULL)`,
  /* 모니터링: 서버 오류 기록 (관리자 '모니터링' 화면). 오류가 날 때만 쓰고 14일·500줄 넘으면 정리 */
  /* 의견 보내기(학생 → 개발자) · 공지 기록(지난 공지도 다시 볼 수 있게) */
  `CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '')`,
  /* v18: 의견에 붙인 사진(최대 5장, 브라우저에서 줄인 JPEG를 BLOB로) */
  `CREATE TABLE IF NOT EXISTS feedback_img (fid INTEGER NOT NULL, i INTEGER NOT NULL, type TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (fid, i))`,
  `CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, text TEXT NOT NULL, tone TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL, until INTEGER NOT NULL DEFAULT 0, body TEXT NOT NULL DEFAULT '')`,
  /* v14: 출석 체크(연속 출석) — kind 1 출석 · 2 방패로 메운 날. 학사일정 휴업일·공휴일은 달마다 캐시(lib/attend.js) */
  `CREATE TABLE IF NOT EXISTS attendance (uid INTEGER NOT NULL, ymd TEXT NOT NULL, kind INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (uid, ymd))`,
  `CREATE TABLE IF NOT EXISTS school_off (ym TEXT PRIMARY KEY, days TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS errs (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, src TEXT NOT NULL, route TEXT NOT NULL, msg TEXT NOT NULL)`,
];

// 표 구조를 바꾸면 SCHEMA_V를 올린다 → 다음 요청 때 한 번만 SCHEMA 전체를 다시 실행
const SCHEMA_V = '22';   // v22: 보상 그림 2차 교체(같은 RW_OLD로 다시 바꿈) · v21: 출석 보상 그림 교체(옛 이름 → 새 이름) · v20: 프로필 사진 이모지 → 캐릭터(k:) · v19: 사람이 낼 수 없는 게임 기록 정리 · v18: 의견 사진(feedback_img) · v17: 대표 스티커(st_rep)·시계 스티커(st_deco) · v16: 밸런스 댓글 좋아요 · v12: 랭킹·접속순 인덱스 · v13: 밸런스 댓글·마감 계산 표 · v14: 출석 체크 · v15: 출석 칭호·완벽한 연속
let ready = false;
export async function setup(db) {
  if (ready) return;
  try {   // 이미 최신이면 쿼리 1번으로 끝 (서버가 새로 뜰 때마다 27개 실행하던 것 줄임)
    if ((await db.prepare("SELECT v FROM settings WHERE k = 'schema_v'").first())?.v === SCHEMA_V) { ready = true; return; }
  } catch {}   // settings 표가 아직 없음 → 아래에서 만듦
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  // 예전 reports 테이블(done·note 없음) 대비: 이미 있으면 오류 → 무시
  for (const col of ["done INTEGER NOT NULL DEFAULT 0", "note TEXT NOT NULL DEFAULT ''"]) {
    try { await db.prepare(`ALTER TABLE reports ADD COLUMN ${col}`).run(); } catch {}
  }
  // v3: 프로필 인스타 아이디 칸 (예전 users 표에 추가, 이미 있으면 오류 → 무시)
  try { await db.prepare("ALTER TABLE users ADD COLUMN insta TEXT NOT NULL DEFAULT ''").run(); } catch {}
  // v4: 로그인 유지 365일 → 30일. 이미 365일로 늘어난 세션도 지금부터 30일 안에 끝나게 줄임
  try { await db.prepare('UPDATE sessions SET exp = MIN(exp, ?1)').bind(Date.now() + 30 * 86400e3).run(); } catch {}
  // v8: DM 받는 범위(dm_pref 0 맞팔만·1 나를 팔로우한 사람·2 모두) · 구글 로그인 연결(google_sub, 구글 계정 고유번호만 저장 — 이메일은 저장 안 함)
  for (const col of ["dm_pref INTEGER NOT NULL DEFAULT 0", "google_sub TEXT"]) {
    try { await db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch {}
  }
  // v14: 출석 체크 — 연속(st_cur)·최고(st_best)·마지막 출석일(st_last, YYYYMMDD)·총 출석일(st_total)·방패(st_shield)
  for (const col of ["st_cur INTEGER NOT NULL DEFAULT 0", "st_best INTEGER NOT NULL DEFAULT 0", "st_last TEXT NOT NULL DEFAULT ''", "st_total INTEGER NOT NULL DEFAULT 0", "st_shield INTEGER NOT NULL DEFAULT 0"]) {
    try { await db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch {}
  }
  try { await db.prepare('CREATE INDEX IF NOT EXISTS users_streak ON users (st_cur)').run(); } catch {}
  // v15: 완벽한 연속(st_pf: 이번 연속 동안 방패 안 씀) · 고른 칭호(st_title, 출석 보상)
  for (const col of ["st_pf INTEGER NOT NULL DEFAULT 1", "st_title TEXT NOT NULL DEFAULT ''"]) {
    try { await db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch {}
  }
  // v17: 출석 보상 스티커 쓰임새 — 대표 스티커(이름 옆, st_rep) · 첫 화면 시계 스티커(st_deco, JSON 배열)
  for (const col of ["st_rep TEXT NOT NULL DEFAULT ''", "st_deco TEXT NOT NULL DEFAULT '[]'"]) {
    try { await db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch {}
  }
  // v10: 공지 '자세한 내용'(띠엔 짧은 글, 누르면 긴 글)
  try { await db.prepare("ALTER TABLE notices ADD COLUMN body TEXT NOT NULL DEFAULT ''").run(); } catch {}
  // v9: 개발자가 학과별 화면을 볼 때 쓰는 테스트 계정 표시(is_test)
  try { await db.prepare('ALTER TABLE users ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0').run(); } catch {}
  try { await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS users_gsub ON users (google_sub) WHERE google_sub IS NOT NULL').run(); } catch {}
  // v7: 지금 걸려 있는 공지를 공지 기록에도 넣어 둠
  try {
    const n = JSON.parse((await db.prepare("SELECT v FROM settings WHERE k = 'notice'").first())?.v || 'null');
    if (n && n.id) await db.prepare('INSERT OR IGNORE INTO notices (id, text, tone, link, at, until) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(n.id, n.text, n.tone || 'info', n.link || '', n.at || Date.now(), n.until || 0).run();
  } catch {}
  // v11: 개발자 아이디 hayuldeveloper → developer. 혹시 다른 사람이 developer를 쓰고 있으면 먼저 다른 아이디로 비켜 줌(그 사람이 관리자 권한을 얻지 않게)
  try {
    const old = await db.prepare('SELECT id FROM users WHERE handle = ?1').bind(OLD_ADMIN_HANDLES[0]).first();
    if (old) await db.batch([
      db.prepare("UPDATE users SET handle = 'user_' || id WHERE handle = ?1 AND id <> ?2").bind(ADMIN_HANDLE, old.id),
      db.prepare('UPDATE users SET handle = ?1 WHERE id = ?2').bind(ADMIN_HANDLE, old.id),
    ]);
  } catch (e) { console.error('v11 개발자 아이디 변경 실패', e); }
  // v6: 개발자(관리자) 계정은 학년·반 없음 → 반 대항전·반 표시에서 빠지게
  try { await db.prepare('UPDATE users SET grade = 0, cls = 0 WHERE handle = ?1').bind(ADMIN_HANDLE).run(); } catch {}
  // v13: 질문 목록을 새로 바꾸면서 2026-10-22(목)에 이미 투표가 들어간 예전 질문을 그날 질문으로 고정
  try { await db.prepare("INSERT OR IGNORE INTO balance_custom (ymd, q, a, b) VALUES ('20261022', '평생 급식 메뉴 하나만 나온다면?', '돈까스', '떡볶이')").run(); } catch {}
  // v19 (2026-10-24): 게임 기록 하한을 사람 기준으로 올림 → 그 아래 기록(조작으로 보이는 것) 정리. 하한은 functions/api/s GAMES와 같게
  try { await db.prepare("DELETE FROM scores WHERE (game = 'reaction' AND best < 140) OR (game = 'num25' AND best < 5000) OR (game = 'cut' AND best < 15)").run(); } catch {}
  // v20 (2026-10-24): 프로필 사진 이모지 → 직접 그린 캐릭터 16종. 동물은 같은 캐릭터로, 나머지는 계정 번호로 골고루 (출석 보상 그림 r:는 그대로)
  try {
    const K = ['cat', 'dog', 'bear', 'bunny', 'frog', 'chick', 'hamster', 'penguin', 'fox', 'panda', 'dino', 'ghost', 'slime', 'sheep', 'whale', 'axolotl'];
    const MAP = { '🐱': 'cat', '🐶': 'dog', '🐻': 'bear', '🐨': 'bear', '🐰': 'bunny', '🐸': 'frog', '🐥': 'chick', '🐹': 'hamster', '🐧': 'penguin', '🦊': 'fox', '🐯': 'fox', '🐼': 'panda', '👻': 'ghost', '🦄': 'sheep' };
    await db.batch([
      ...Object.entries(MAP).map(([e, k]) => db.prepare('UPDATE users SET avatar = ?1 WHERE avatar = ?2').bind('k:' + k, e)),
      db.prepare(`UPDATE users SET avatar = 'k:' || (${K.map((k, i) => `CASE WHEN id % 16 = ${i} THEN '${k}' `).join('ELSE ')}${'END '.repeat(K.length)}) WHERE avatar NOT LIKE 'k:%' AND avatar NOT LIKE 'r:%'`),
    ]);
  } catch (e) { console.error('v20 프로필 사진 옮기기 실패', e); }
  // v21·v22 (2026-10-24): 출석 보상 그림 교체(2번) — RW_OLD에 옛 이름이 모두 있어서 같은 코드로 다시 돌면 됨 — 저장된 옛 이름(r:lion 등)을 새 이름으로 (프로필 사진·스티커·대표 스티커·시계 스티커). 표시 쪽은 RW_OLD 별칭으로도 처리됨
  try {
    const cols = ['avatar', 'stickers', 'st_rep', 'st_deco'];
    await db.batch(Object.entries(RW_OLD).flatMap(([o, n]) => cols.map(c => db.prepare(`UPDATE users SET ${c} = REPLACE(${c}, ?1, ?2) WHERE ${c} LIKE ?3`).bind('r:' + o, 'r:' + n, '%r:' + o + '%'))));
  } catch (e) { console.error('v21 보상 그림 이름 바꾸기 실패', e); }
  // v2: 예전 관리 기록에 남은 IP 원문 가리기 · 예전 횟수 제한 줄(IP 원문 키) 비우기
  try { await db.batch([db.prepare("UPDATE admin_log SET detail = '(가림)' WHERE action IN ('로그인', '로그인 실패')"), db.prepare('DELETE FROM rl')]); } catch {}
  await db.prepare("INSERT INTO settings (k, v) VALUES ('schema_v', ?1) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(SCHEMA_V).run();
  ready = true;
}

/* ----- 횟수 제한 (functions 세 곳 공용) -----
   학교 와이파이는 한 반·한 학년이 IP 하나를 같이 쓰므로 IP 기준 한도는 넉넉하게, 계정 보호는 아이디·계정 기준으로 한다.
   IP는 원문 대신 해시 앞부분만 키로 쓰고, 기간이 끝난 줄은 가끔 지운다(개인정보 최소 보관). */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const ipKey = async req => {
  let ip = req.headers.get('cf-connecting-ip') || 'local';
  // IPv6는 한 사람이 /64 안에서 주소를 계속 바꿀 수 있음 → 앞 4마디(/64)로 묶어서 횟수 제한을 피하지 못하게
  if (ip.includes(':')) { const [h] = ip.split('::'); const parts = ip.includes('::') ? [...h.split(':'), '0', '0', '0', '0'] : ip.split(':'); ip = parts.slice(0, 4).join(':') + '::/64'; }
  return hex(await crypto.subtle.digest('SHA-256', enc.encode('svmhs-rl:' + ip))).slice(0, 20);
};
// 지금까지 센 횟수만 보기 (늘리지 않음)
export const countOf = async (db, key) => (await db.prepare('SELECT n FROM rl WHERE k = ?1 AND reset > ?2').bind(key, Date.now()).first())?.n || 0;
// window초 안에 max번까지. 넘으면 true
export async function limited(db, key, max, windowSec) {
  const t = Date.now();
  if (Math.random() < 0.1) await db.prepare('DELETE FROM rl WHERE reset < ?1').bind(t).run();
  const r = await db.prepare(`INSERT INTO rl (k, n, reset) VALUES (?1, 1, ?2)
    ON CONFLICT (k) DO UPDATE SET n = CASE WHEN rl.reset < ?3 THEN 1 ELSE rl.n + 1 END, reset = CASE WHEN rl.reset < ?3 THEN ?2 ELSE rl.reset END
    RETURNING n`).bind(key, t + windowSec * 1000, t).first();
  return r.n > max;
}
// 관리 기록용: IP 뒷부분을 가림 (1.2.3.4 → 1.2.3.x, IPv6는 앞 3마디만)
export const maskIp = req => {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  return ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + ':…' : ip.replace(/\.\d+$/, '.x');
};

/* ----- 설정 (settings 테이블). 관리자 페이지에서 바꾸고, 사이트가 읽는다. 30초 메모리 캐시 ----- */
let cache = null, cacheAt = 0;
export async function getSettings(db, fresh = false) {
  if (!fresh && cache && Date.now() - cacheAt < 30e3) return cache;
  const rows = (await db.prepare('SELECT k, v FROM settings').all()).results;
  cache = Object.fromEntries(rows.map(r => [r.k, r.v]));
  cacheAt = Date.now();
  return cache;
}
export async function setSetting(db, k, v) {
  if (v == null) await db.prepare('DELETE FROM settings WHERE k = ?1').bind(k).run();
  else await db.prepare('INSERT INTO settings (k, v) VALUES (?1, ?2) ON CONFLICT (k) DO UPDATE SET v = excluded.v').bind(k, String(v)).run();
  cache = null;
}
// 가입 코드: 관리자 페이지 값 우선 → 없으면 Pages 비밀 변수 JOIN_CODE
export const joinCodeOf = (env, s) => (s.join_code ?? env.JOIN_CODE ?? '') || '';
export const signupOpen = s => s.signup_open !== '0';
export const dmOpen = s => s.dm_open !== '0';

// 관리자 계정: 이 아이디로 로그인한 사람만 비밀번호를 한 번 더 확인하고 /admin에 들어갈 수 있다 (소셜 POST admin-pass → 관리자 세션)
export const ADMIN_HANDLE = 'developer';
export const OLD_ADMIN_HANDLES = ['hayuldeveloper'];   // 예전 개발자 아이디 (가입 금지 · v11에서 새 아이디로 옮김)
// 학과별 테스트 계정 (개발자 계정에서만 바꿔 들어감 · 비밀번호는 아무도 모르는 무작위 값). 반은 나이스 기준: 콘 1·2반, 미 3·4반, 프 5·6반
export const TEST_ACCOUNTS = {
  con: { handle: 'test_con', name: '테스트 콘텐츠과', cls: 1 },
  mi: { handle: 'test_mi', name: '테스트 미디어과', cls: 3 },
  pro: { handle: 'test_pro', name: '테스트 프로듀스과', cls: 5 },
};
export const TEST_GRADE = 2;

// 서버 오류를 errs 표에 남김 (src: s|admin|api|neis). 기록 실패(한도 초과 등)는 무시 — 원래 응답을 막지 않게
export async function logErr(db, src, req, e) {
  if (!db) return;
  try {
    const u = new URL(req.url), route = `${req.method} ${u.pathname}`.slice(0, 120);
    await db.prepare('INSERT INTO errs (at, src, route, msg) VALUES (?1, ?2, ?3, ?4)').bind(Date.now(), src, route, String(e?.message || e).slice(0, 300)).run();
    if (Math.random() < 0.1) await db.prepare('DELETE FROM errs WHERE at < ?1 OR id <= (SELECT MAX(id) - 500 FROM errs)').bind(Date.now() - 14 * 86400e3).run();
  } catch {}
}

/* ----- D1 무료 한도: 쓰기는 Cloudflare 계정 전체(다른 사이트 DB 포함) 하루 10만 행, UTC 0시(한국 9시)에 초기화 ----- */
export const isWriteLimit = e => /daily row write limit|exceeded D1's free tier/i.test(String(e?.message || e));
export const LIMIT_MSG = '오늘은 저장 기능이 잠시 멈췄어요 (무료 DB 하루 한도 초과). 오전 9시에 다시 돼요';

export const kstYmd = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
