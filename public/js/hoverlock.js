// 마우스를 오브젝트 가장자리에 애매하게 대면 미친 듯이 흔들리던 문제 (2026-10-25 하율)
// 원인: :hover 때 오브젝트가 움직이면(translate·rotate·scale) 가장자리가 커서 밖으로 빠져 hover가 풀리고,
//       제자리로 돌아오면 다시 hover → 1초에 수십 번 반복.
// 해결: 스타일시트의 ':hover' 규칙을 '.is-hv' 사본으로 복제하고, 오브젝트가 움직이기 전 원래 자리(사각형)를
//       기준으로 hover를 유지한다(원래 자리 안이거나 실제 :hover면 유지, 둘 다 아니면 해제). CSS는 그대로 둠.
(() => {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;   // 터치 기기는 필요 없음
  const targets = new Set();   // hover 때 자기 자신이 움직이는 오브젝트 선택자
  const moves = st => /transform|translate|rotate|scale/.test(st.cssText);

  function walk(list) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.cssRules && !(r instanceof CSSStyleRule)) { walk(r.cssRules); continue; }   // @media·@supports 안쪽
      if (!(r instanceof CSSStyleRule) || !r.selectorText.includes(':hover')) continue;
      const parts = r.selectorText.split(/,(?![^()]*\))/).map(s => s.trim());
      const own = moves(r.style) || /\b(animation)\b/.test(r.style.cssText);
      parts.forEach(p => {
        if (own && /:hover$/.test(p)) targets.add(p.replace(/:hover$/, ''));
      });
      const sel = parts.filter(p => p.includes(':hover')).map(p => p.replaceAll(':hover', '.is-hv')).join(', ');
      try { (r.parentRule || r.parentStyleSheet).insertRule(`${sel}{${r.style.cssText}}`, i + 1); i++; } catch { /* 해석 못 하는 선택자는 건너뜀 */ }
    }
  }
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch { /* 다른 출처 스타일시트(글꼴) */ } }
  if (!targets.size) return;
  const TSEL = [...targets].join(',');

  const locked = new Map();   // 요소 → 처음 들어올 때의 사각형(움직이기 전)
  const inside = (b, x, y) => x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 1 && y <= b.bottom + 1;
  function release(el) { el.classList.remove('is-hv'); locked.delete(el); }

  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    let el = e.target.closest?.(TSEL);
    while (el) {
      if (!locked.has(el)) { locked.set(el, el.getBoundingClientRect()); el.classList.add('is-hv'); }
      el = el.parentElement?.closest(TSEL);
    }
  }, true);
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    for (const [el, b] of locked) {
      if (!el.isConnected || el.disabled) { release(el); continue; }
      if (!inside(b, e.clientX, e.clientY) && !el.matches(':hover')) release(el);
    }
  }, { passive: true });
  const clearAll = () => { for (const el of [...locked.keys()]) if (!el.matches(':hover')) release(el); else locked.set(el, el.getBoundingClientRect()); };
  addEventListener('scroll', clearAll, { passive: true, capture: true });
  addEventListener('resize', clearAll);
  document.addEventListener('mouseleave', () => { for (const el of [...locked.keys()]) release(el); });
})();
