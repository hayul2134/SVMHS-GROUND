// SVMHS GROUND — 업데이트 공지(패치노트) 초안·게시
// 초안: settings.pn_draft — 개발자 계정에만 보이고 거기서 고침. 대기열(lib/patchqueue.js) 새 항목이 자동으로 붙음.
// 게시: 컨펌된 초안은 공개 시각(월요일 06:00 KST)이 지난 뒤 첫 요청 때 settings.pn_pub 맨 앞으로 옮겨짐 → 모두에게 보임.
// 옛 게시본 public/patchnotes.json은 그대로 두고 화면에서 뒤에 이어 붙임.
import { QUEUE, APPROVE, NOW_UNTIL } from './patchqueue.js';

const KST = 9 * 3600e3, DAY = 86400e3;
const IMG_RE = /^\/patchimg\/[\w.-]{1,80}\.(webp|png|jpg)$/;   // 공지 캡처는 public/patchimg/에만
// t 다음에 오는 첫 월요일 06:00(KST)
export function nextMon6(t) {
  const k = new Date(t + KST), add = (8 - k.getUTCDay()) % 7;
  const at = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + add, 6) - KST;
  return at > t ? at : at + 7 * DAY;
}
const ymdOf = t => new Date(t + KST).toISOString().slice(0, 10);
const md = t => { const k = new Date(t + KST); return [k.getUTCMonth() + 1, k.getUTCDate()]; };
const DOWK = ['일', '월', '화', '수', '목', '금', '토'];
const dowOf = t => DOWK[new Date(t + KST).getUTCDay()];
export const defTitle = due => { const [m, d] = md(due); return `${m}월 ${d}일 ${dowOf(due)}요일 패치 ✨`; };
// 바로 공지 기간(2026-10-25 하율: "이번 주만 공지 지금부터, 업데이트 바로 — 다음 주부터 월요일 방식"): NOW_UNTIL(그날 06:00 KST) 전까지는
// 대기열·초안에 줄이 생기는 즉시 모두에게 게시(컨펌·월요일 기다림 없음). 지나면 원래대로.
const immUntil = NOW_UNTIL ? Date.parse(NOW_UNTIL + 'T06:00:00+09:00') : 0;
const fresh = (now, taken = []) => ({ due: nextMon6(now), title: '', items: [], taken, ok: false });
const parse = v => { try { return JSON.parse(v || 'null'); } catch { return null; } };
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

async function read(db) {
  const r = (await db.prepare("SELECT k, v FROM settings WHERE k IN ('pn_draft', 'pn_pub')").all()).results;
  const o = Object.fromEntries(r.map(x => [x.k, x.v]));
  return { rawD: o.pn_draft ?? null, d: parse(o.pn_draft), pub: parse(o.pn_pub) || [] };
}
// 다른 요청이 그 사이 바꿨으면 쓰지 않음(월요일 06:00 동시 접속에 두 번 게시되지 않게)
async function save(db, rawD, d, pub) {
  const nv = JSON.stringify(d);
  const r = rawD == null
    ? await db.prepare("INSERT OR IGNORE INTO settings (k, v) VALUES ('pn_draft', ?1)").bind(nv).run()
    : await db.prepare("UPDATE settings SET v = ?1 WHERE k = 'pn_draft' AND v = ?2").bind(nv, rawD).run();
  if (!r.meta?.changes) return false;
  if (pub) await db.prepare("INSERT INTO settings (k, v) VALUES ('pn_pub', ?1) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(pub.slice(0, 40))).run();
  return true;
}
// 대기열 반영 + 때가 된 초안 게시. 바뀌었으면 저장.
function step(d, pub, now) {
  let changed = false, published = null;
  if (!d || !Array.isArray(d.items)) { d = fresh(now, d?.taken || []); changed = true; }
  const taken = new Set(d.taken);
  for (const q of QUEUE) if (!taken.has(q.id)) { d.items.push({ id: q.id, t: q.t, ff: q.ff || '', img: q.img || '' }); taken.add(q.id); changed = true; }
  // 이미 초안에 들어간 줄에 나중에 캡처가 붙으면 따라 붙임(하율이 사진을 뺀 줄은 제외)
  const qImg = Object.fromEntries(QUEUE.filter(q => q.img).map(q => [q.id, q.img]));
  for (const x of d.items) if (!x.img && !x.noimg && qImg[x.id]) { x.img = qImg[x.id]; changed = true; }
  d.taken = QUEUE.map(q => q.id).filter(id => taken.has(id));   // 대기열에서 지운 id는 기억할 필요 없음
  const ok = d.ok || APPROVE === ymdOf(d.due);
  if (now < immUntil && d.items.length) {
    const [m, dd] = md(now);
    published = { id: 'n-' + ymdOf(now) + '-' + now, date: `${m}/${dd} (${dowOf(now)})`, title: d.title || defTitle(now), items: d.items.map(x => x.img ? { t: x.t, img: x.img } : x.t), ff: [...new Set(d.items.map(x => x.ff).filter(Boolean))], at: now };
    pub = [published, ...pub];
    d = fresh(now, d.taken); changed = true;
  } else if (now >= d.due) {
    if (ok && d.items.length) {
      const [m, dd] = md(d.due);
      published = { id: 'w-' + ymdOf(d.due), date: `${m}/${dd} (월)`, title: d.title || defTitle(d.due), items: d.items.map(x => x.img ? { t: x.t, img: x.img } : x.t), ff: [...new Set(d.items.map(x => x.ff).filter(Boolean))], at: now };
      if (pub[0]?.id !== published.id) pub = [published, ...pub];
      d = fresh(now, d.taken); changed = true;
    } else if (!d.items.length) { d.due = nextMon6(now); changed = true; }   // 비어 있으면 다음 주로
    // 컨펌 안 된 초안은 그대로 둠 — 나중에 컨펌하면 그때 바로 게시
  }
  return { d, pub, changed, published };
}
export async function patchState(db, now = Date.now()) {
  for (let i = 0; i < 3; i++) {
    const { rawD, d, pub } = await read(db);
    const s = step(d, pub, now);
    if (!s.changed || await save(db, rawD, s.d, s.published ? s.pub : null)) return s;
  }
  const { d, pub } = await read(db);
  return { d, pub };
}
// 개발자가 사이트에서 고친 초안 저장
export async function patchSave(db, body, now = Date.now()) {
  const { rawD, d: old } = await read(db);
  const base = step(old, [], now).d;
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40)
    .map((x, i) => ({ id: clip(x?.id, 40) || `u-${now}-${i}`, t: clip(x?.t, 300), ff: clip(x?.ff, 40), img: IMG_RE.test(x?.img || '') ? x.img : '', noimg: !!x?.noimg })).filter(x => x.t);
  const d = { ...base, title: clip(body.title, 60), items, ok: !!body.ok };
  if (!await save(db, rawD, d, null)) throw Object.assign(new Error('다른 곳에서 먼저 바뀌었어요. 창을 다시 열어 주세요'), { status: 409 });
  return patchState(db, now);   // 공개 시각이 지났고 컨펌했으면 바로 게시
}
export const draftOut = d => d && { imm: Date.now() < immUntil, due: d.due, title: d.title, defTitle: defTitle(d.due), items: d.items, ok: !!d.ok, approved: !!d.ok || APPROVE === ymdOf(d.due) };
