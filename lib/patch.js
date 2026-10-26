// SVMHS GROUND — 업데이트 공지(패치노트) 초안·게시
// 초안: settings.pn_draft — 개발자 계정에만 보이고 거기서 고침. 대기열(lib/patchqueue.js) 새 항목이 자동으로 붙음.
// 게시: 컨펌된 초안은 공개 시각(월요일 06:00 KST)이 지난 뒤 첫 요청 때 settings.pn_pub 맨 앞으로 옮겨짐 → 모두에게 보임.
// 옛 게시본 public/patchnotes.json은 그대로 두고 화면에서 뒤에 이어 붙임.
import { QUEUE, APPROVE, NOW_UNTIL, PUB_EDIT, PUB_NOW, UNPUB } from './patchqueue.js';

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
// 하율이 초안 창에서 저장하는 즉시 모두에게 게시(컨펌·월요일 기다림 없음). 대기열 줄은 자동 게시하지 않고 초안에만 쌓임
// (같은 날 하율: "이번 주 공지는 업데이트가 아니라 소개 느낌"). 지나면 원래대로.
const hotTitle = h => { const t = Date.parse(h + 'T06:00:00+09:00') + DAY, [m, d] = md(t); return `${m}월 ${d}일 ${dowOf(t)}요일 패치 ✨`; };
const immUntil = NOW_UNTIL ? Date.parse(NOW_UNTIL + 'T06:00:00+09:00') : 0;
const fresh = (now, taken = [], hot = {}) => ({ due: nextMon6(now), title: '', items: [], taken, ok: false, hot });
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
function step(d, pub, now, manual = false) {
  let changed = false, published = null;
  // 이미 게시된 공지 고치기(PUB_EDIT): 그 공지에서 drop 문구가 든 줄을 뺌 — 한 번 고치면 ed 표시로 다시 안 함
  // rep: [[이 문구가 든 줄, 바꿀 문구]] — 줄을 통째로 바꿈. 적용한 key는 eds에 모아 다시 안 함
  for (const e of PUB_EDIT || []) {
    const done = x => (x.eds || (x.ed ? [x.ed] : [])).includes(e.key);
    const i = pub.findIndex(x => x.id?.startsWith(e.id) && !done(x));
    if (i < 0) continue;
    const x = pub[i], txt = t => typeof t === 'string' ? t : t.t || '';
    const items = x.items.filter(t => !(e.drop || []).some(s => txt(t).includes(s)))
      .map(t => { const r = (e.rep || []).find(([f]) => txt(t).includes(f)); return !r ? t : typeof t === 'string' ? r[1] : { ...t, t: r[1] }; });
    pub = pub.slice(); pub[i] = { ...x, items, eds: [...(x.eds || (x.ed ? [x.ed] : [])), e.key] }; published = published || pub[i]; changed = true;
  }
  if (!d || !Array.isArray(d.items)) { d = fresh(now, d?.taken || [], d?.hot || {}); changed = true; }
  // 게시 회수(UNPUB, 2026-10-26 하율 "공지 다시 회수해"): 게시본에서 빼고, 하율이 고친 문구 그대로 그날 초안(컨펌 전)으로 되돌림
  for (const uid of UNPUB || []) {
    const i = pub.findIndex(x => x.id === uid);
    if (i < 0) continue;
    const x = pub[i], h = uid.replace(/^h-/, '');
    pub = pub.filter((_, j) => j !== i); published = published || { id: 'unpub-' + uid }; changed = true;
    if (!/^\d{4}-\d\d-\d\d$/.test(h)) continue;
    const qids = x.qids || [];
    const items = x.items.map((t, j) => { const id = qids[j] || `u-${now}-${j}`, q = QUEUE.find(q => q.id === id);
      return { id, t: typeof t === 'string' ? t : t.t, ff: q?.ff || '', img: typeof t === 'string' ? '' : t.img || '' }; });
    if (!d.hot || typeof d.hot !== 'object') d.hot = {};
    const H = d.hot[h] || (d.hot[h] = { title: '', items: [], taken: [], ok: false });
    H.items = [...items, ...H.items.filter(y => !qids.includes(y.id))]; H.taken = [...new Set([...qids, ...H.taken])]; H.ok = false;
  }
  const taken = new Set(d.taken);
  // 하루 패치(2026-10-26 하율: "패치 월요일 고정 말고 하루하루 패치인데 패치가 있는 날만 공지"):
  // 대기열 줄은 고친 날(day, 옛 hot, 없으면 id의 날짜)별 초안 d.hot[날짜]로 묶여 개발자 화면에서 고침.
  // 하율이 컨펌(ok 또는 APPROVE에 그 날짜)한 날만 다음 날 06:00 KST에 'M월 D일 O요일 패치'로 게시 — 컨펌 전엔 시각이 지나도 기다리고,
  // 나중에 컨펌하면 그때 바로. 고친 게 없는 날은 공지도 없음. 게시된 줄의 ff(새 기능 깃발)는 그때 모두에게 열림(flags.js RELEASED).
  const dueOf = h => Date.parse(h + 'T06:00:00+09:00') + DAY;
  const dayOfQ = q => q.day || q.hot || (/^q-(\d{4})(\d\d)(\d\d)/.exec(q.id) || []).slice(1).join('-');
  const apv = new Set(String(APPROVE || '').split(',').map(x => x.trim()).filter(Boolean));
  if (!d.hot || typeof d.hot !== 'object') { d.hot = {}; changed = true; }
  // 예전 월요일 초안에 남은 줄은 오늘 패치 초안으로 옮김(하율이 고친 문구·뺀 사진 그대로)
  if (d.items.length) {
    const h = ymdOf(now), H = d.hot[h] || (d.hot[h] = { title: '', items: [], taken: [], ok: false });
    H.items.push(...d.items); H.taken.push(...d.items.map(x => x.id)); d.items = []; changed = true;
  }
  // 2026-10-26 하율 "지금 패치 진행해": PUB_NOW에 적은 날은 다음 날 06:00을 기다리지 않고 바로 게시(제목·날짜는 게시한 날).
  //   그날이 이미 게시됐는데 같은 날 고친 줄이 더 생기면 버리지 않고 다음 날 초안으로 넘김(게시된 줄은 qids로 다시 안 넣음)
  const pubNow = new Set(String(PUB_NOW || '').split(',').map(x => x.trim()).filter(Boolean));
  const pubIds = new Set(pub.flatMap(x => x.qids || []));
  for (const q of QUEUE) {
    let h = dayOfQ(q);
    if (!h || taken.has(q.id) || pubIds.has(q.id)) continue;
    for (let i = 0; i < 7 && pub.some(x => x.id === 'h-' + h); i++) h = ymdOf(dueOf(h));
    if (pub.some(x => x.id === 'h-' + h)) continue;
    const H = d.hot[h] || (d.hot[h] = { title: '', items: [], taken: [], ok: false });
    if (H.taken.includes(q.id)) continue;
    H.items.push({ id: q.id, t: q.t, ff: q.ff || '', img: q.img || '' }); H.taken.push(q.id); changed = true;
  }
  for (const [h, H] of Object.entries(d.hot)) {
    for (const x of H.items) { const q = QUEUE.find(q => q.id === x.id && q.img); if (q && !x.img && !x.noimg) { x.img = q.img; changed = true; } }
    const now1 = pubNow.has(h), due = now1 ? Math.min(dueOf(h), now) : dueOf(h), id = 'h-' + h;
    if (pub.some(x => x.id === id)) { delete d.hot[h]; changed = true; continue; }
    if (now < due) continue;
    if (!H.items.length) { delete d.hot[h]; changed = true; continue; }
    if (!H.ok && !apv.has(h)) continue;
    const [m, dd] = md(due);
    const x = { id, qids: H.items.map(q => q.id), date: `${m}/${dd} (${dowOf(due)})`, title: H.title || (now1 ? defTitle(due) : hotTitle(h)), items: H.items.map(q => q.img ? { t: q.t, img: q.img } : q.t), ff: [...new Set(H.items.map(q => q.ff).filter(Boolean))], at: now };
    pub = [x, ...pub]; published = published || x; delete d.hot[h]; changed = true;
  }
  d.taken = QUEUE.map(q => q.id).filter(id => taken.has(id));   // 예전 월요일 초안에 이미 들어갔던 줄(다시 안 넣게). 새 줄은 전부 하루 초안으로
  const ok = d.ok || APPROVE === ymdOf(d.due);
  if (manual && now < immUntil && d.items.length) {
    const [m, dd] = md(now);
    published = { id: 'n-' + ymdOf(now) + '-' + now, date: `${m}/${dd} (${dowOf(now)})`, title: d.title || defTitle(now), items: d.items.map(x => x.img ? { t: x.t, img: x.img } : x.t), ff: [...new Set(d.items.map(x => x.ff).filter(Boolean))], at: now };
    pub = [published, ...pub];
    d = fresh(now, d.taken, d.hot); changed = true;
  } else if (now >= d.due) {
    if (ok && d.items.length) {
      const [m, dd] = md(d.due);
      published = { id: 'w-' + ymdOf(d.due), date: `${m}/${dd} (월)`, title: d.title || defTitle(d.due), items: d.items.map(x => x.img ? { t: x.t, img: x.img } : x.t), ff: [...new Set(d.items.map(x => x.ff).filter(Boolean))], at: now };
      if (pub[0]?.id !== published.id) pub = [published, ...pub];
      d = fresh(now, d.taken, d.hot); changed = true;
    } else if (!d.items.length) { d.due = nextMon6(now); changed = true; }   // 비어 있으면 다음 주로
    // 컨펌 안 된 초안은 그대로 둠 — 나중에 컨펌하면 그때 바로 게시
  }
  return { d, pub, changed, published };
}
export async function patchState(db, now = Date.now(), manual = false) {
  for (let i = 0; i < 3; i++) {
    const { rawD, d, pub } = await read(db);
    const s = step(d, pub, now, manual);
    if (!s.changed || await save(db, rawD, s.d, s.published ? s.pub : null)) return s;
  }
  const { d, pub } = await read(db);
  return { d, pub };
}
// 개발자가 사이트에서 고친 초안 저장
export async function patchSave(db, body, now = Date.now()) {
  await patchState(db, now);   // 때가 된 게시부터 먼저 끝내 둠(아래 step이 빈 게시 목록으로 돌아 게시분을 잃지 않게)
  const { rawD, d: old, pub } = await read(db);
  const base = step(old, pub, now).d;
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40)
    .map((x, i) => ({ id: clip(x?.id, 40) || `u-${now}-${i}`, t: clip(x?.t, 300), ff: clip(x?.ff, 40), img: IMG_RE.test(x?.img || '') ? x.img : '', noimg: !!x?.noimg })).filter(x => x.t);
  let d;
  if (body.hot) {   // 핫픽스 초안 하나만 저장(월요일 초안은 그대로)
    const H = base.hot?.[body.hot];
    if (!H) throw Object.assign(new Error('이미 게시됐거나 없는 핫픽스 초안이에요. 창을 다시 열어 주세요'), { status: 409 });
    d = { ...base, hot: { ...base.hot, [body.hot]: { ...H, title: clip(body.title, 60), items, ok: !!body.ok } } };
  } else d = { ...base, title: clip(body.title, 60), items, ok: !!body.ok };
  if (!await save(db, rawD, d, null)) throw Object.assign(new Error('다른 곳에서 먼저 바뀌었어요. 창을 다시 열어 주세요'), { status: 409 });
  return patchState(db, now, !body.hot);   // 핫픽스 저장은 월요일 초안을 건드리지 않음. 공개 시각이 지났고 컨펌했으면 바로 게시 (바로 공지 기간엔 저장 즉시)
}
export const draftOut = d => d && { hot: Object.entries(d.hot || {}).sort().map(([day, H]) => ({ day, due: Date.parse(day + 'T06:00:00+09:00') + DAY, title: H.title, defTitle: hotTitle(day), items: H.items, ok: !!H.ok || String(APPROVE || '').split(',').map(x => x.trim()).includes(day) })), imm: Date.now() < immUntil, due: d.due, title: d.title, defTitle: defTitle(d.due), items: d.items, ok: !!d.ok, approved: !!d.ok || APPROVE === ymdOf(d.due) };
