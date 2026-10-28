// SVMHS GROUND — 전환 버튼 묶음(전체/친구/반 대항전, 조식/중식/석식 등)을 스위치처럼 (2026-10-25 하율 요청)
// 고른 버튼 뒤에 알약(.sw-pill) 하나를 두고, 고른 게 바뀌면 그 자리로 미끄러지게.
// 화면이 다시 그려져(innerHTML) 묶음이 새로 생겨도, 같은 묶음(버튼 글자 같음)이면 이전 위치에서 출발해 미끄러짐.
// 대상은 SEG 선택자 · 고른 버튼은 .on / aria-selected=true / aria-pressed=true. 색은 묶음마다 CSS 변수(--pl-bg 등).
const SEG = '.segs:not(.authcard .segs), .mealtabs, .s-slots, .pk-seg, .ed-sub, .ed-tabs, .hd-frs, .rk-tabs';
const ACT = ':scope > button.on, :scope > button[aria-selected="true"], :scope > button[aria-pressed="true"]';
const last = new Map();   // 묶음 이름 → 마지막 알약 위치 {x, y, w, h}
const seen = new WeakSet();
const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(es => placeAll(es.map(e => e.target), false)) : null;
const keyOf = el => el.className.split(' ')[0] + '|' + [...el.children].filter(b => b.tagName === 'BUTTON').map(b => (b.textContent || b.getAttribute('aria-label') || '').trim()).join('/');

// 최적화(2026-10-28): 여러 묶음을 한꺼번에 놓을 때 '전부 재기 → 전부 쓰기' 순서로(재고 쓰고를 번갈아 하면 묶음마다 레이아웃을 다시 계산함).
// 전환 끄기(.no-tr)를 풀 때도 offsetWidth로 강제 계산하지 않고 다음 프레임에 풂
function measure(el) {
  const pill = el.querySelector(':scope > .sw-pill'); if (!pill) return null;
  const b = el.querySelector(ACT);
  if (!b || !b.offsetWidth) return { el, pill, r: null };
  return { el, pill, r: { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight } };
}
const unTr = new Set(); let trRaf = 0;
const noTr = pill => { pill.classList.add('no-tr'); unTr.add(pill); if (!trRaf) trRaf = requestAnimationFrame(() => requestAnimationFrame(() => { trRaf = 0; unTr.forEach(p => p.classList.remove('no-tr')); unTr.clear(); })); };
function apply(m, animate) {
  const { el, pill, r } = m;
  // 숨겨진 동안(서랍 넣기·display:none)엔 위치 기록도 지움 → 다시 보일 때 같은 자리라도 알약을 다시 켬 (2026-10-25 급식 칩 알약 안 보이던 버그)
  if (!r) { pill.style.opacity = '0'; delete pill.dataset.at; return; }
  const k = keyOf(el), prev = last.get(k), cur = pill.dataset.at;
  const at = `${r.x},${r.y},${r.w},${r.h}`;
  if (cur === at && pill.style.opacity === '1') return;
  const set = p => { pill.style.transform = `translate(${p.x}px,${p.y}px)`; pill.style.width = p.w + 'px'; pill.style.height = p.h + 'px'; };
  if (!cur) {   // 새로 생긴 묶음: 같은 묶음의 이전 위치가 있으면 거기서 출발
    noTr(pill);
    set(prev && animate ? prev : r); pill.style.opacity = '1';
    if (prev && animate && (prev.x !== r.x || prev.y !== r.y || prev.w !== r.w)) requestAnimationFrame(() => requestAnimationFrame(() => set(r)));   // 출발 자리가 먼저 그려진 뒤(.no-tr 풀린 뒤) 미끄러짐
  } else {
    if (!animate) noTr(pill);
    set(r); pill.style.opacity = '1';
  }
  pill.dataset.at = at; last.set(k, r);
}
const placeAll = (els, animate) => { const ms = els.map(measure).filter(Boolean); ms.forEach(m => apply(m, animate)); };
const place = (el, animate = true) => placeAll([el], animate);
function wire(el) {
  if (!seen.has(el)) { seen.add(el); el.classList.add('sw'); ro?.observe(el); }
  // 묶음 안을 innerHTML로 다시 그리면 알약도 같이 지워짐 → 매번 확인해 다시 넣음(2026-10-25 급식 칩 알약 사라짐 버그)
  if (!el.querySelector(':scope > .sw-pill')) el.insertAdjacentHTML('afterbegin', '<i class="sw-pill" aria-hidden="true"></i>');
}
let raf = 0; const dirty = new Set();
const flush = () => { raf = 0; const els = [...dirty].filter(el => el.isConnected); dirty.clear(); els.forEach(wire); placeAll(els, true); };
const mark = el => { dirty.add(el); if (!raf) raf = requestAnimationFrame(flush); };
new MutationObserver(ms => {
  for (const m of ms) {
    if (m.type === 'attributes') { const s = m.target.parentElement; if (s && s.matches?.(SEG)) mark(s); continue; }
    if (m.target.matches?.(SEG)) mark(m.target);
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches(SEG)) mark(n);
      n.querySelectorAll?.(SEG).forEach(mark);
    }
  }
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'aria-pressed'] });
document.querySelectorAll(SEG).forEach(mark);
addEventListener('resize', () => placeAll([...document.querySelectorAll('.sw')], false));
