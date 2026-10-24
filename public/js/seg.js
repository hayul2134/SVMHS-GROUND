// SVMHS GROUND — 전환 버튼 묶음(전체/친구/반 대항전, 조식/중식/석식 등)을 스위치처럼 (2026-10-25 하율 요청)
// 고른 버튼 뒤에 알약(.sw-pill) 하나를 두고, 고른 게 바뀌면 그 자리로 미끄러지게.
// 화면이 다시 그려져(innerHTML) 묶음이 새로 생겨도, 같은 묶음(버튼 글자 같음)이면 이전 위치에서 출발해 미끄러짐.
// 대상은 SEG 선택자 · 고른 버튼은 .on / aria-selected=true / aria-pressed=true. 색은 묶음마다 CSS 변수(--pl-bg 등).
const SEG = '.segs:not(.authcard .segs), .mealtabs, .s-slots, .pk-seg, .ed-sub, .ed-tabs, .hd-frs, .rk-tabs';
const ACT = ':scope > button.on, :scope > button[aria-selected="true"], :scope > button[aria-pressed="true"]';
const last = new Map();   // 묶음 이름 → 마지막 알약 위치 {x, y, w, h}
const seen = new WeakSet();
const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => place(e.target, false))) : null;
const keyOf = el => el.className.split(' ')[0] + '|' + [...el.children].filter(b => b.tagName === 'BUTTON').map(b => (b.textContent || b.getAttribute('aria-label') || '').trim()).join('/');

function place(el, animate = true) {
  const pill = el.querySelector(':scope > .sw-pill'); if (!pill) return;
  const b = el.querySelector(ACT);
  if (!b || !b.offsetWidth) { pill.style.opacity = '0'; return; }
  const r = { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
  const k = keyOf(el), prev = last.get(k), cur = pill.dataset.at;
  const at = `${r.x},${r.y},${r.w},${r.h}`;
  if (cur === at) return;
  const set = p => { pill.style.transform = `translate(${p.x}px,${p.y}px)`; pill.style.width = p.w + 'px'; pill.style.height = p.h + 'px'; };
  if (!cur) {   // 새로 생긴 묶음: 같은 묶음의 이전 위치가 있으면 거기서 출발
    pill.classList.add('no-tr');
    set(prev && animate ? prev : r); pill.style.opacity = '1';
    void pill.offsetWidth; pill.classList.remove('no-tr');
    if (prev && animate && (prev.x !== r.x || prev.y !== r.y || prev.w !== r.w)) requestAnimationFrame(() => set(r));
  } else {
    if (!animate) pill.classList.add('no-tr');
    set(r); pill.style.opacity = '1';
    if (!animate) { void pill.offsetWidth; pill.classList.remove('no-tr'); }
  }
  pill.dataset.at = at; last.set(k, r);
}
function wire(el) {
  if (!seen.has(el)) { seen.add(el); el.classList.add('sw'); ro?.observe(el); }
  // 묶음 안을 innerHTML로 다시 그리면 알약도 같이 지워짐 → 매번 확인해 다시 넣음(2026-10-25 급식 칩 알약 사라짐 버그)
  if (!el.querySelector(':scope > .sw-pill')) el.insertAdjacentHTML('afterbegin', '<i class="sw-pill" aria-hidden="true"></i>');
  place(el);
}
let raf = 0; const dirty = new Set();
const flush = () => { raf = 0; for (const el of dirty) if (el.isConnected) wire(el); dirty.clear(); };
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
addEventListener('resize', () => document.querySelectorAll('.sw').forEach(el => place(el, false)));
