// SVMHS GROUND — D1 테이블 정의 + 공용 설정 (functions 세 곳이 같이 씀: 소셜 · 관리자 · 급식/밸런스)
// functions/ 밖에 둬서 라우트로 잡히지 않게 함. 테이블은 첫 요청 때 자동으로 만든다.

export const SCHEMA = [
  /* 소셜 */
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pw TEXT NOT NULL, salt TEXT NOT NULL,
    created INTEGER NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '😎', color TEXT NOT NULL DEFAULT 'sky', grade INTEGER NOT NULL DEFAULT 0,
    cls INTEGER NOT NULL DEFAULT 0, club TEXT NOT NULL DEFAULT '', mood TEXT NOT NULL DEFAULT '', stickers TEXT NOT NULL DEFAULT '[]', seen INTEGER NOT NULL DEFAULT 0)`,
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
];

// 표 구조를 바꾸면 SCHEMA_V를 올린다 → 다음 요청 때 한 번만 SCHEMA 전체를 다시 실행
const SCHEMA_V = '2';
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
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  return hex(await crypto.subtle.digest('SHA-256', enc.encode('svmhs-rl:' + ip))).slice(0, 20);
};
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

export const kstYmd = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
