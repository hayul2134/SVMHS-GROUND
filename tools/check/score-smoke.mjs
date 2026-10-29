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
};

// 두 번 돈다: ① 지금 학생 화면(미리보기 깃발 꺼짐) ② 미리보기 깃발이 전부 공개된 뒤의 학생 화면
//   (2026-10-29 버그는 깃발 rx-season이 공개된 뒤에만 타는 길이라 ①만으로는 못 잡았음)
const { PREVIEW, RELEASED } = await import(pathToFileURL(resolve('public/js/flags.js')).href);
const list = ['reaction', 'num25', 'cut', 'home', 'gear', 'gearn', 'film', 'stair'];
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
      const body = (PLAY[g] || (x => ({ value: x, rounds: [] })))(v);
      const r = await call('POST', 'score', { game: g, ticket: st.j.ticket, ...body });
      if (r.s >= 500) fails.push(`[${mode}] ${g} ${v}`);
    }
    await call('GET', `rank?game=${g}&scope=all`);
    await call('GET', `rank?game=${g}&scope=class`);
    await call('GET', `myrec?game=${g}`);
  }
  for (const p of ['games', 'tier', 'mission', 'me', 'user/' + handle, 'att', 'ach']) await call('GET', p);
}
const saved = sq.prepare('SELECT COUNT(*) AS n FROM scores').get().n;
if (!saved) fails.push('정상 기록이 하나도 저장되지 않음 — 검사 데이터(PLAY)를 확인할 것');
const errs = sq.prepare('SELECT route, msg FROM errs').all();
for (const e of errs) fails.push(`errs: ${e.route} | ${e.msg}`);
Date.now = realNow;
if (fails.length) { console.error('❌ 기록 저장 연기 검사 실패\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log(`✅ 기록 저장 연기 검사 통과 (판 ${opened}개 · 저장 ${saved}개)`);
