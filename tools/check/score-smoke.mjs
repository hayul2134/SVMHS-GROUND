// 게임 기록 저장 연기 검사 (2026-10-29: 그 게임 첫 기록에서 서버 오류 → 약 150판 유실 뒤 추가)
// 실행: node tools/check/score-smoke.mjs   (저장소 맨 위에서, Node 22 이상)
// 빈 DB(node:sqlite로 D1 흉내)에 새 학생을 가입시키고, 모든 게임에서 '첫 기록 → 더 좋은 기록 → 더 나쁜 기록 → 보류될 기록'을 저장해 본 뒤
// 랭킹·게임 목록·내 기록·티어까지 불러 본다. 5xx 응답이나 errs 표에 오류가 하나라도 생기면 실패(종료 코드 1).
// 서버 코드(functions/api/s)를 고친 뒤 push 전에 반드시 돌릴 것.
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const sq = new DatabaseSync(':memory:');
const norm = a => a.map(x => x === undefined ? null : typeof x === 'boolean' ? +x : x);
class Stmt {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.sql, norm(a)); }
  _p() { return sq.prepare(this.sql); }
  async first(col) { const r = this._p().get(...this.args); return r == null ? null : col ? r[col] : { ...r }; }
  async all() { return { results: this._p().all(...this.args).map(r => ({ ...r })), success: true, meta: {} }; }
  async run() { const i = this._p().run(...this.args); return { success: true, meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } }; }
  async raw() { return this._p().all(...this.args).map(r => Object.values(r)); }
}
const DB = {
  prepare: sql => new Stmt(sql),
  async batch(list) { const out = []; for (const s of list) out.push(/^\s*(SELECT|WITH)|RETURNING/i.test(s.sql) ? await s.all() : await s.run()); return out; },
  async exec(sql) { sq.exec(sql); return { count: 1 }; },
};

// 시간 앞당기기(게임별 최소 플레이 시간 통과용)
let skew = 0; const realNow = Date.now; Date.now = () => realNow() + skew;

const api = await import(pathToFileURL(resolve('functions/api/s/[[path]].js')).href);
const ST = await import(pathToFileURL(resolve('public/js/stair-score.js')).href);
const ORIGIN = 'https://svmhs-ground.pages.dev';
let cookie = '';
const fails = [];
async function call(method, path, body) {
  const headers = { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': '10.0.0.1' };
  if (cookie) headers.cookie = cookie;
  const req = new Request(`${ORIGIN}/api/s/${path}`, { method, headers, body: method === 'POST' ? JSON.stringify(body || {}) : undefined });
  const res = await api.onRequest({ request: req, env: { DB }, params: { path: path.split('?')[0].split('/') } });
  const sc = res.headers.get('set-cookie'); if (sc) { const m = sc.match(/^[^;]+/); if (m && !/=;|=$/.test(m[0])) cookie = m[0]; }
  let j = null; try { j = await res.clone().json(); } catch {}
  if (res.status >= 500) fails.push(`${method} ${path} → ${res.status} ${JSON.stringify(j)}`);
  return { s: res.status, j };
}

// 게임별 '그럴듯한 판 기록' — 통과 못 해도 보류(200)로 끝나야 하고, 5xx만 아니면 됨
const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
const PLAY = {
  reaction: v => ({ value: v, rounds: [v - 10, v + 10, v - 5, v + 5, v, 0] }),
  num25: v => ({ value: v, rounds: Array.from({ length: 25 }, (_, i) => Math.round(i * v / 24)) }),
  cut: v => ({ value: v, rounds: [v / 5, v / 5, v / 5, v / 5, v / 5].map(Math.round) }),
  // 계단 오르기: 250·350칸 판은 200칸 시간(4번째 값)까지 → stair200(기록실 200칸 타임어택)도 같이 저장되는지 아래에서 확인. 150칸은 200칸 시간 없음
  stair: v => { if (v === 1) return { value: 1, rounds: [] }; const st = 650 - v; return { value: ST.STAIR_MAX - st, rounds: st >= ST.T200 ? [st, st * 60, 3, ST.T200 * 60] : [st, st * 60, 3] }; },
  // 카메라 가방 정리!: 티켓 씨앗으로 진짜 판을 둬서(첫 자리부터 채우기, 400ms마다 최대 40개) 정상 기록 → 업적(live.x 다시 두기)까지 탐. v = 1이면 하한 밑 그대로
  blast: (v, tk) => {
    if (v === 1) return { value: 1, rounds: [] };
    const B = BL, rand = B.rng(B.seedOf(tk)), b = B.newBoard(), st = { score: 0, combo: 0, miss: 0 }, mv = [];
    let set = B.nextSet(rand, b, 0), used = [0, 0, 0];
    out: while (mv.length < 40) {
      for (let s = 0; s < 3; s++) { if (used[s]) continue; const sh = B.PIECES[set[s]].s;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (B.fits(b, sh, r, c)) { B.place(b, st, sh, r, c, B.kindV(set[s])); mv.push(B.enc((mv.length + 1) * 400, s, r, c)); used[s] = 1; if (used.every(Boolean)) { set = B.nextSet(rand, b, mv.length); used = [0, 0, 0]; } continue out; } }
      break;
    }
    return { value: B.BLAST_MAX - st.score, rounds: [(mv.length + 1) * 400, ...mv] };
  },
};
// 색감의 신(2026-11-02): v = 놓친 합 → 판마다 그만큼 다른 색을 찾아 [목표, 고른 색]×5 (값이 다시 계산과 안 맞으면 보류 200이어야 함)
const CO = await import(pathToFileURL(resolve('public/js/color-score.js')).href);
PLAY.color = (v, tk) => {   // 문제 색은 티켓 씨앗으로(2026-11-02 디벨롭)
  const t = CO.pickTargets(CO.rng(CO.seedOf(tk) ?? 0)), r = [];
  for (const c of t) { let best = c, bd = 1e9; for (let k = 0; k < 4000; k++) { const q = (c + k * 0x010203) & 0xffffff, d = Math.abs(1000 - CO.accOf(c, q) - v / 5); if (d < bd) { bd = d; best = q; } } r.push(c, best); }
  return { value: CO.scoreOf(r).v, rounds: r };
};
const BL = await import(pathToFileURL(resolve('public/js/blast-score.js')).href);
// 카체이싱!(2026-10-31): 티켓 씨앗으로 진짜 판을 돌림 — 왼쪽·오른쪽을 번갈아 누르다 부딪히거나 연료가 떨어질 때까지(입력 기록 = 서버가 다시 돌릴 것). v = 1이면 하한 밑 그대로
const CH = await import(pathToFileURL(resolve('public/js/chase-score.js')).href);
PLAY.chase = (v, tk) => {
  if (v === 1) return { value: 1, rounds: [] };
  const s = CH.newSim(CH.seedOf(tk)), ev = [];
  while (!s.over) { if (s.f % 45 === 0) { const c = (s.f / 45) % 4; ev.push(CH.enc(s.f, c)); CH.input(s, c); } if (s.f % 200 === 100) { ev.push(CH.enc(s.f, 4)); CH.input(s, 4); } CH.step(s); }
  return { value: CH.CHASE_MAX - CH.scoreOf(s), rounds: [s.overF, ...ev] };
};

// 선생님 몰래 춤추기(2026-10-31): 티켓 씨앗으로 진짜 판을 돌림 — 처음부터 계속 누르고 있다가 세 번 걸려 끝날 때까지(약 15초)(입력 기록 = 서버가 다시 돌릴 것). v = 1이면 하한 밑 그대로
const DC = await import(pathToFileURL(resolve('public/js/dance-score.js')).href);
PLAY.dance = (v, tk) => {
  if (v === 1) return { value: 1, rounds: [] };
  const s = DC.newSim(DC.seedOf(tk)), ev = [];
  ev.push(DC.enc(0, 0)); DC.input(s, 0);
  while (!s.over) DC.step(s);
  return { value: DC.DANCE_MAX - DC.scoreOf(s), rounds: [s.overF, ...ev] };
};

// 기록실 전용 게임(2026-11-09): 형식·시간 검사만 → 그럴듯한 판 기록. 복도의 심판은 3분 넘게 걸리는 판이라 시계를 더 앞당김. v = 1이면 하한 밑·형식 틀림(보류)
const RS = await import(pathToFileURL(resolve('public/js/rec-score.js')).href);
PLAY.judge = v => { if (v === 1) return { value: 1, rounds: [1, 50, 23] }; skew += 600000; const ms = RS.JUDGE_MIN + v * 100; return { value: ms, rounds: [ms, 40, 23] }; };
PLAY.ball = v => v === 1 ? { value: RS.BALL_MAX - 9999, rounds: [9999, 3, 4] } : { value: RS.BALL_MAX - v, rounds: [v, Math.ceil(v / 10), 6] };
PLAY.cross = v => v === 1 ? { value: RS.CROSS_MAX - 5000, rounds: [5000] } : { value: RS.CROSS_MAX - v / 4, rounds: [v / 4] };
PLAY.rhythm = v => { skew += 60000; return v === 1 ? { value: RS.RHY_MAX - 10, rounds: [10, 5, 0, 9000] } : { value: RS.RHY_MAX - v * 100, rounds: [v * 100, 1, 3, 9000] }; };

// 두 번 돈다: ① 지금 학생 화면(미리보기 깃발 꺼짐) ② 미리보기 깃발이 전부 공개된 뒤의 학생 화면
//   (2026-10-29 버그는 깃발 rx-season이 공개된 뒤에만 타는 길이라 ①만으로는 못 잡았음)
const { PREVIEW, RELEASED } = await import(pathToFileURL(resolve('public/js/flags.js')).href);
const list = ['reaction', 'num25', 'cut', 'home', 'gear', 'gearn', 'film', 'stair', 'stair200', 'blast', 'chase', 'dance', 'color', 'mine', 'snake', 'n2048', 'judge', 'ball', 'cross', 'rhythm'];
let opened = 0;
for (const [mode, handle] of [['깃발 꺼짐', 'smoke_a1'], ['깃발 전부 공개', 'smoke_b1']]) {
  if (mode === '깃발 전부 공개') for (const f of PREVIEW) RELEASED.add(f);
  cookie = '';
  const r0 = await call('POST', 'signup', { handle, name: '연기검사' + handle.slice(-2), pw: 'zq8!kd02xa', grade: 2, cls: 3, club: '' });
  if (!cookie) { fails.push(`[${mode}] 가입 실패: ${JSON.stringify(r0.j)}`); continue; }
  for (const g of list) {
    for (const v of [400, 300, 500, 1]) {   // 첫 기록 → 더 좋음 → 더 나쁨 → 하한 밑(보류)
      const st = await call('POST', 'start', { game: g });
      if (!st.j?.ticket) continue;   // 아직 안 열린 미리보기 게임 — 정상
      opened++; skew += 20000;
      const body = (PLAY[g] || (x => ({ value: x, rounds: [] })))(v, st.j.ticket);
      const r = await call('POST', 'score', { game: g, ticket: st.j.ticket, ...body });
      if (process.env.DBG && g === process.env.DBG) console.log(mode, v, body.value, body.rounds.length, r.s, JSON.stringify(r.j).slice(0, 300));
      if (r.s >= 500 || r.j?.rescued) fails.push(`[${mode}] ${g} ${v}${r.j?.rescued ? ' (서버 오류 → 보관됨)' : ''}`);
    }
    await call('GET', `rank?game=${g}&scope=all`);
    await call('GET', `rank?game=${g}&scope=class`);
    await call('GET', `myrec?game=${g}`);
  }
  for (const p of ['games', 'tier', 'mission', 'me', 'user/' + handle, 'att', 'ach', 'mastery', 'hall']) await call('GET', p);
  { const h = (await call('GET', 'hall')).j, x = h?.games?.find(y => y.g === 'stair200');   // 200칸 타임어택(2026-11-04): 계단 오르기 판에서 같이 저장됐는지
    if (h?.games?.some(y => y.g === 'stair') && x?.me?.v !== ST.T200 * 60) fails.push(`[${mode}] 기록실 200칸 타임어택이 안 쌓임 → ${JSON.stringify(x).slice(0, 200)}`);
    if ((await call('POST', 'start', { game: 'stair200' })).j?.ticket) fails.push(`[${mode}] stair200을 직접 시작할 수 있음`); }
  { const h = (await call('GET', 'hall')).j;   // 기록실 전용 게임(2026-11-09): 열린 게임은 기록실에 내 기록이 쌓여야 함
    for (const g of ['judge', 'ball', 'cross', 'rhythm']) { const x = h?.games?.find(y => y.g === g); if (x && x.me?.v == null) fails.push(`[${mode}] 기록실 ${g} 기록이 안 쌓임 → ${JSON.stringify(x).slice(0, 200)}`); }
    if (mode === '깃발 꺼짐' && !h?.games?.some(y => y.g === 'judge')) fails.push(`[${mode}] 기록실에 복도의 심판 없음`); }
  // 숙련도(깃발 mastery, 2026-10-30): 공개 상태에선 판을 한 게임에 XP·등급이 쌓여야 함
  if (mode === '깃발 전부 공개') {
    const m = (await call('GET', 'mastery')).j, u = (await call('GET', 'user/' + handle)).j;
    if (process.env.DBG === 'mst') console.log(JSON.stringify(m), JSON.stringify(u?.mst));
    if (!m?.games || !Object.values(m.games).some(x => x.x > 0 && x.gr) || !(m.score > 0)) fails.push(`[${mode}] 숙련도가 안 쌓임 → ${JSON.stringify(m).slice(0, 300)}`);
    if (!u?.mst?.top?.length) fails.push(`[${mode}] 프로필 숙련도 대표 게임 없음 → ${JSON.stringify(u?.mst)}`);
  }
}
// 서버 오류 보관 → 자동 반영 검사(2026-10-29): 저장 중 쿼리 하나를 일부러 터뜨려 '보관'되는지, 고친 뒤 게임 시작 때 반영되는지
{
  cookie = '';
  await call('POST', 'signup', { handle: 'smoke_r1', name: '연기검사r1', pw: 'zq8!kd02xa', grade: 2, cls: 3, club: '' });
  const st = await call('POST', 'start', { game: 'reaction' }); skew += 20000;
  const orig = DB.prepare; let boom = true;
  DB.prepare = sql => { if (boom && /INSERT INTO scores/.test(sql)) { boom = false; throw new Error('연기검사: 일부러 낸 오류'); } return orig(sql); };
  const r = await call('POST', 'score', { game: 'reaction', ticket: st.j?.ticket, ...PLAY.reaction(300) });
  DB.prepare = orig;
  if (!r.j?.rescued) fails.push(`보관 검사: 서버 오류인데 보관 안 됨 → ${r.s} ${JSON.stringify(r.j)}`);
  await call('POST', 'start', { game: 'reaction' });
  const h = sq.prepare("SELECT st FROM held_scores WHERE reason LIKE '서버 오류로 보관%'").get();
  const ok = sq.prepare("SELECT COUNT(*) AS n FROM scores s JOIN users u ON u.id = s.uid WHERE u.handle = 'smoke_r1' AND s.game = 'reaction'").get().n;
  if (h?.st !== 4 || !ok) fails.push(`보관 검사: 게임 시작 때 자동 반영 안 됨 (st ${h?.st}, 기록 ${ok})`);
  sq.prepare("DELETE FROM errs WHERE msg LIKE '연기검사:%'").run();
}
// 카체이싱! 긴 판 나눠 다시 돌리기 검사(2026-11-02): 긴 판은 chasechk로 나눠 돌린 뒤 저장 → 바로 반영 · 미리 안 돌린 긴 판은 보류(5xx 아님) · 규칙 판 번호 다르면 보류
{
  RELEASED.add('chase-game');
  cookie = '';
  await call('POST', 'signup', { handle: 'smoke_c1', name: '연기검사c1', pw: 'zq8!kd02xa', grade: 2, cls: 3, club: '' });
  const { bot } = await import(pathToFileURL(resolve('tools/check/chase-bot.mjs')).href);
  const longRun = tk => { const { s, rounds } = bot(CH.seedOf(tk), { react: 8, hz: 75, err: 0 }); return s.overF > CH.CHUNK_F * 2 ? { value: CH.CHASE_MAX - CH.scoreOf(s), rounds } : null; };
  const go = async (pre, rv) => {
    let tk = null, b = null;
    for (let i = 0; i < 8 && !b; i++) { const st = await call('POST', 'start', { game: 'chase' }); tk = st.j?.ticket; if (!tk) return { err: 'no ticket ' + JSON.stringify(st.j) }; b = longRun(tk); }   // 씨앗마다 봇 결과가 정해져 있어 짧게 끝나면 새 판
    if (!b) return { err: 'long run 못 만듦' };
    skew += b.rounds[0] * 1000 / 60 + 5000;
    let calls = 0;
    if (pre) for (;;) { const r = await call('POST', 'chasechk', { ticket: tk, rounds: b.rounds }); calls++; if (r.s !== 200) return { err: 'chasechk ' + r.s + JSON.stringify(r.j) }; if (r.j.done) break; if (calls > 400) return { err: 'chasechk 안 끝남' }; }
    const r = await call('POST', 'score', { game: 'chase', ticket: tk, ...b, rv });
    return { r, calls, f: b.rounds[0] };
  };
  const a = await go(true, CH.RULE_V);
  if (a.err || a.r.s !== 200 || a.r.j?.held) fails.push(`카체이싱! 긴 판(나눠 돌림) 저장 실패 → ${a.err || a.r.s + ' ' + JSON.stringify(a.r.j).slice(0, 200)}`);
  else if (sq.prepare("SELECT COUNT(*) AS n FROM replay_chk").get().n) fails.push('카체이싱! 저장 뒤 replay_chk가 안 지워짐');
  const b2 = await go(false, CH.RULE_V);
  if (b2.err || b2.r.s !== 200 || !b2.r.j?.held) fails.push(`카체이싱! 미리 안 돌린 긴 판이 보류 안 됨 → ${b2.err || b2.r.s + ' ' + JSON.stringify(b2.r.j).slice(0, 200)}`);
  const c3 = await go(true, CH.RULE_V + 1);
  if (c3.err || c3.r.s !== 200 || !c3.r.j?.held) fails.push(`카체이싱! 규칙 판 번호 다른 판이 보류 안 됨 → ${c3.err || c3.r.s + ' ' + JSON.stringify(c3.r.j).slice(0, 200)}`);
  if (!a.err) console.log(`카체이싱! 긴 판 ${(a.f / 60).toFixed(0)}초 → chasechk ${a.calls}번 나눠 확인 후 저장`);
}
// LED 월 점수 ×10 검사(2026-10-31): 새로 고침 전 예전 화면이 보낸 1배 점수도 보류 없이 10배로 저장돼야 함
{
  cookie = '';
  await call('POST', 'signup', { handle: 'smoke_x1', name: '연기검사x1', pw: 'zq8!kd02xa', grade: 2, cls: 3, club: '' });
  const st = await call('POST', 'start', { game: 'blast' }); skew += 20000;
  const body = PLAY.blast(400, st.j?.ticket), sc = BL.BLAST_MAX - body.value;
  const r = await call('POST', 'score', { game: 'blast', ticket: st.j?.ticket, rounds: body.rounds, value: BL.BLAST_MAX - sc / BL.SCALE });
  const got = sq.prepare("SELECT s.best FROM scores s JOIN users u ON u.id = s.uid WHERE u.handle = 'smoke_x1' AND s.game = 'blast'").get()?.best;
  if (!r.j?.ok || r.j?.held || got !== body.value) fails.push(`LED 월 1배 점수 검사: ${sc / BL.SCALE}점(예전 화면) → 저장 ${got != null ? BL.BLAST_MAX - got : '없음'} (기대 ${sc}) ${JSON.stringify(r.j).slice(0, 200)}`);
}
// 오래 한 판 검사(2026-10-29 기자재 정리! 일반 100만 점 유실): 티켓이 만료된 뒤(2시간 뒤)에 끝난 판도 저장돼야 함
{
  cookie = '';
  await call('POST', 'signup', { handle: 'smoke_l1', name: '연기검사l1', pw: 'zq8!kd02xa', grade: 2, cls: 3, club: '' });
  const st = await call('POST', 'start', { game: 'reaction' }); skew += 2 * 3600e3;
  const r = await call('POST', 'score', { game: 'reaction', ticket: st.j?.ticket, ...PLAY.reaction(300) });
  if (!r.j?.ok) fails.push(`오래 한 판 검사: 티켓 만료 뒤 저장 거절 → ${r.s} ${JSON.stringify(r.j)}`);
}
// 티켓 늦게 받은 판(2026-11-11 보류 35건): 화면 시계는 판 시작부터, 티켓은 재시도로 3~4초 늦게 → tw(티켓 받기까지 걸린 시간)만큼 봐줘야 함. tw 상한(20초)은 지킴
{
  const tryStair = async (st, ms, late, tw) => {
    const s0 = await call('POST', 'start', { game: 'stair' }); skew += late;
    return (await call('POST', 'score', { game: 'stair', ticket: s0.j?.ticket, value: ST.STAIR_MAX - st, rounds: [st, ms, 12], ...(tw != null ? { tw } : {}) })).j;
  };
  const a = await tryStair(61, 8200, 5000), b = await tryStair(62, 8200, 5000, 3600), c = await tryStair(300, 30000, 5000, 999999);
  if (!a?.held) fails.push(`티켓 늦은 판: tw 없이 3초 넘게 초과했는데 보류 안 됨 → ${JSON.stringify(a)}`);
  if (!b?.ok || b?.held) fails.push(`티켓 늦은 판: tw 3.6초면 받아야 하는데 → ${JSON.stringify(b)}`);
  if (!c?.held || !/더 오래/.test(c?.why || '')) fails.push(`티켓 늦은 판: tw 상한(20초)을 넘겨 봐줌 → ${JSON.stringify(c)}`);
  if (!/더 오래/.test(a?.why || '')) fails.push(`티켓 늦은 판: 다른 이유로 보류됨 → ${JSON.stringify(a)}`);
}
// 정지 계정 검사(2026-11-03 하율 "정지 먹은 계정은 기록실이랑 티어에 표기되지 않게"): 정지 전엔 보이고, 정지 뒤엔 기록실·티어에서 빠져야 함
{
  skew += 3600e3;
  const see = async () => { const h = JSON.stringify((await call('GET', 'hall')).j), t = JSON.stringify((await call('GET', 'tier')).j); return { h: h.includes('연기검사r1'), t: t.includes('연기검사r1') }; };
  const a = await see();
  const uid = sq.prepare("SELECT id FROM users WHERE handle = 'smoke_r1'").get().id;
  sq.prepare('INSERT OR REPLACE INTO bans (uid, until, reason, at) VALUES (?, 0, ?, ?)').run(uid, '연기검사 정지', realNow());
  skew += 3600e3;
  const b = await see();
  if (!a.h) fails.push('정지 검사: 정지 전인데 기록실에 안 보임(검사 데이터 확인)');
  if (b.h) fails.push('정지 검사: 정지된 계정이 기록실에 보임');
  if (b.t) fails.push('정지 검사: 정지된 계정이 티어에 보임');
  if (a.t) console.log('정지 검사: 티어 정지 전 보임 → 정지 뒤 ' + (b.t ? '보임' : '빠짐'));
  sq.prepare('DELETE FROM bans WHERE uid = ?').run(uid);
}
const saved = sq.prepare('SELECT COUNT(*) AS n FROM scores').get().n;
if (!saved) fails.push('정상 기록이 하나도 저장되지 않음 — 검사 데이터(PLAY)를 확인할 것');
const errs = sq.prepare('SELECT route, msg FROM errs').all();
for (const e of errs) fails.push(`errs: ${e.route} | ${e.msg}`);
Date.now = realNow;
if (fails.length) { console.error('❌ 기록 저장 연기 검사 실패\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log(`✅ 기록 저장 연기 검사 통과 (판 ${opened}개 · 저장 ${saved}개)`);
