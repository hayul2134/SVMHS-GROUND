// SVMHS GROUND — 새로 얻은 뽑기 보상 빨간 표시 (2026-10-25 하율: "뽑기에서 얻은 건 어디서 착용하는지 명확하게, 새로 얻은 건 빨간색으로 표시해서 스스로 들어가 착용하게")
// 길: ☰ 메뉴(빨간 점) → 꾸미기(빨간 '새 N') → 스티커·효과 탭(빨간 점) → 그 칸(빨간 N 테두리) → 누르면(붙이기·켜기) 표시가 사라짐.
// '본 것' 목록은 이 기기·계정별(localStorage sg_gc_seen_아이디). 이 기기에서 처음 열 때는 이미 가진 걸 전부 본 것으로 시작(옛 보상이 한꺼번에 빨개지지 않게).
// 표시하는 법: 칸 = data-nw="값"(옵션 data-nw-t 글자, data-nw-view = 눌러도 안 사라짐) · 묶음(탭·메뉴) = data-nw-kind="stk|fx|all"(옵션 data-nw-style="pill").
import { store } from './util.js';
import { GACHA, GACHA_OLD, HIDDEN, SHN } from './att-rewards.js';

const ITEMS = new Map([...GACHA, ...GACHA_OLD, ...HIDDEN].map(x => [x.v, x]));
export const itemOf = v => ITEMS.get(String(v || '').endsWith(SHN) ? String(v).slice(0, -SHN.length) : String(v || ''));
export const kindOf = v => itemOf(v)?.fx ? 'fx' : 'stk';   // 효과(전설·시크릿·히든) / 스티커(일반·희귀·반짝이)

let getMe = () => null, who = null, seen = null;
export function init(me) { getMe = me; }
const ownKeys = own => Object.keys(own || {}).filter(k => own[k] > 0 && itemOf(k));
function ensure() {
  const me = getMe(), h = me?.handle || null, own = me?.gc?.own;
  if (h !== who) { who = h; seen = null; }
  if (seen || !who || !own) return seen;
  const s = store.get('gc_seen_' + who, null);
  seen = new Set(Array.isArray(s) ? s : ownKeys(own));
  if (!Array.isArray(s)) save();
  return seen;
}
const save = () => { if (who && seen) store.set('gc_seen_' + who, [...seen]); };
/** 아직 안 써 본(새로 얻은) 값 목록 */
export function list() { const s = ensure(); return s ? ownKeys(getMe()?.gc?.own).filter(k => !s.has(k)) : []; }
export const isNew = v => { const s = ensure(); return !!s && !s.has(v) && (getMe()?.gc?.own?.[v] > 0); };
export function count() { const L = list(); return { all: L.length, stk: L.filter(k => kindOf(k) === 'stk').length, fx: L.filter(k => kindOf(k) === 'fx').length }; }
export function seenAll(vs) { const s = ensure(); if (!s) return; let ch = false; vs.forEach(v => { if (!s.has(v)) { s.add(v); ch = true; } }); if (ch) { save(); paint(); document.dispatchEvent(new Event('sg:gcnew')); } }

// 화면에 칠하기: 붙어 있는 표시를 지금 상태에 맞춰 넣거나 뺌(여러 번 불러도 안전)
function put(el, on, cls, txt) {
  let b = el.querySelector(':scope > .' + cls);
  if (on) { if (!b) { b = document.createElement('i'); b.className = cls; b.setAttribute('aria-hidden', 'true'); el.append(b); } if (b.textContent !== txt) b.textContent = txt; }
  else b?.remove();
}
export function paint(root = document) {
  const n = count();
  root.querySelectorAll('[data-nw]').forEach(el => { const on = isNew(el.dataset.nw) && !el.dataset.lock; el.classList.toggle('is-new', on); put(el, on, 'nw-b', el.dataset.nwT || 'N'); });
  root.querySelectorAll('[data-nw-kind]').forEach(el => {
    const c = n[el.dataset.nwKind] || 0, pill = el.dataset.nwStyle === 'pill';
    el.classList.toggle('has-new', c > 0); put(el, c > 0, pill ? 'nw-p' : 'nw-d', pill ? `새 ${c}` : '');
  });
}
// 새 칸을 누르면(붙이기·켜기) 본 것으로 — 잠긴 칸·보기 전용 칸(data-nw-view)은 제외. 다른 클릭 처리보다 늦게(같은 값의 다른 칸도 같이 꺼짐)
document.addEventListener('click', e => {
  const el = e.target.closest?.('[data-nw]');
  if (!el || el.dataset.lock || el.hasAttribute('data-nw-view') || !el.classList.contains('is-new')) return;
  setTimeout(() => seenAll([el.dataset.nw]), 0);
});
