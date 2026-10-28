/* D1 사용량 계량(2026-10-29) — 무료 한도(읽기 하루 500만·쓰기 10만 행)는 Cloudflare 계정 전체 공용.
   같은 계정의 hayul-analyze가 이 표(usage)를 읽고 SVMHS GROUND가 쓴 만큼 자기 몫을 줄인다(학생 사이트 우선).
   요청마다 D1 응답의 meta.rows_read/rows_written을 모아 isolate마다 60초에 한 번 usage에 더함(쓰기 1행).
   today()는 이 isolate가 마지막으로 본 오늘(UTC) 합계 — 절약 모드 판단용 */
const FLUSH_MS = 60e3;
let pr = 0, pw = 0, lastFlush = 0, made = false, seen = { day: '', r: 0, w: 0 };
const utcDay = () => new Date().toISOString().slice(0, 10);
const add = r => { const m = r?.meta; if (m) { pr += m.rows_read || 0; pw += m.rows_written || 0; } return r; };
function stmt(st) {
  return new Proxy(st, { get(t, k) {
    if (k === '_s') return t;
    if (k === 'bind') return (...a) => stmt(t.bind(...a));
    if (k === 'run' || k === 'all') return async (...a) => add(await t[k](...a));
    if (k === 'first') return async c => { const r = add(await t.all()); const row = r?.results?.[0]; return row == null ? null : c ? (row[c] ?? null) : row; };
    const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
  } });
}
export function meterDB(db) {
  if (!db || db._metered) return db;
  return new Proxy(db, { get(t, k) {
    if (k === '_metered') return true;
    if (k === '_raw') return t;
    if (k === 'prepare') return q => stmt(t.prepare(q));
    if (k === 'batch') return async sts => { const r = await t.batch(sts.map(x => x?._s || x)); r.forEach(add); return r; };
    const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
  } });
}
export async function flushUsage(db, force = false) {
  const raw = db?._raw || db; if (!raw || (!pr && !pw)) return;
  if (!force && Date.now() - lastFlush < FLUSH_MS) return;
  lastFlush = Date.now();
  const r = pr, w = pw + 1; pr = 0; pw = 0;   // +1 = 이 기록 자체
  try {
    if (!made) { await raw.prepare('CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, r INTEGER NOT NULL DEFAULT 0, w INTEGER NOT NULL DEFAULT 0)').run(); made = true; }
    const day = utcDay();
    const x = await raw.prepare('INSERT INTO usage (day, r, w) VALUES (?1, ?2, ?3) ON CONFLICT (day) DO UPDATE SET r = r + ?2, w = w + ?3 RETURNING r, w').bind(day, r, w).first();
    if (x) seen = { day, r: x.r, w: x.w };
  } catch { pr += r; pw += w - 1; }   // 한도 초과 등 — 다음에 다시
}
export const today = () => seen.day === utcDay() ? { r: seen.r + pr, w: seen.w + pw } : { r: pr, w: pw };
