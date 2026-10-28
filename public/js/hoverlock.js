// 마우스를 오브젝트 가장자리에 애매하게 대면 미친 듯이 흔들리던 문제 (2026-10-25 하율)
// 원인: :hover 때 오브젝트가 움직이면(translate·rotate·scale) 가장자리가 커서 밖으로 빠져 hover가 풀리고,
//       제자리로 돌아오면 다시 hover → 1초에 수십 번 반복.
// 해결: 스타일시트의 ':hover' 규칙을 '.is-hv' 사본으로 복제하고, 오브젝트가 움직이기 전 원래 자리(사각형)를
//       기준으로 hover를 유지한다(원래 자리 안이거나 실제 :hover면 유지, 둘 다 아니면 해제). CSS는 그대로 둠.
// 최적화(2026-10-28): 큰 스타일시트를 훑으며 규칙을 하나씩 끼워 넣는 작업이라 첫 화면 그리기를 막지 않게 한가할 때 실행
const hlInit = () => {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;   // 터치 기기는 필요 없음
  const targets = new Set();   // hover 때 자기 자신이 움직이는 오브젝트 선택자

  function walk(list) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.cssRules && !(r instanceof CSSStyleRule)) { walk(r.cssRules); continue; }   // @media·@supports 안쪽
      if (!(r instanceof CSSStyleRule) || !r.selectorText.includes(':hover')) continue;
      const parts = r.selectorText.split(/,(?![^()]*\))/).map(s => s.trim());
      // hover되는 요소 자신(':hover' 앞부분)을 전부 잠금 대상으로 — 자식만 움직여도(로고 그림·아이콘 등) 그 자식이 마우스가 닿는 자리라 떨림이 생김
      parts.forEach(p => { const k = p.indexOf(':hover'); if (k > 0) targets.add(p.slice(0, k).trim()); });
      const sel = parts.filter(p => p.includes(':hover')).map(p => p.replaceAll(':hover', '.is-hv')).join(', ');
      try { (r.parentRule || r.parentStyleSheet).insertRule(`${sel}{${r.style.cssText}}`, i + 1); i++; } catch { /* 해석 못 하는 선택자는 건너뜀 */ }
    }
  }
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch { /* 다른 출처 스타일시트(글꼴) */ } }
  if (!targets.size) return;
  const TSEL = [...targets].filter(t => { try { document.querySelector(t); return true; } catch { return false; } }).join(',');   // 잘못된 선택자 하나가 전체를 깨지 않게
  if (!TSEL) return;

  const locked = new Map();   // 요소 → 원래 자리 + 움직인 자리를 합친 사각형
  // 요소 + 안쪽 요소(최대 40개)의 사각형 합: 로고처럼 안쪽 그림이 밖으로 삐져나와 마우스가 닿는 경우까지
  const add = (u, b) => { if (!b.width && !b.height) return; u.left = Math.min(u.left, b.left); u.top = Math.min(u.top, b.top); u.right = Math.max(u.right, b.right); u.bottom = Math.max(u.bottom, b.bottom); };
  const box = el => { const b = el.getBoundingClientRect(), u = { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; [...el.querySelectorAll('*')].slice(0, 40).forEach(c => add(u, c.getBoundingClientRect())); return u; };
  // 들어온 뒤 0.6초 동안(전환 애니메이션 시간) 움직이는 자리를 계속 합침 → 원래 자리든 움직인 자리든 그 안이면 hover 유지
  // (돌아가는 중간에 다시 들어와도 사각형이 넓어지기만 하니 안전)
  function grow(el) {
    const end = performance.now() + 600;
    const step = () => {
      const u = locked.get(el); if (!u) return;
      const b = box(el); add(u, { width: 1, height: 1, ...b });
      if (performance.now() < end) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const inside = (b, x, y) => x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 1 && y <= b.bottom + 1;
  function release(el) { el.classList.remove('is-hv'); locked.delete(el); }

  function grab(e) {
    let el = e.target.closest?.(TSEL);
    while (el) {
      if (!locked.has(el)) { locked.set(el, box(el)); el.classList.add('is-hv'); grow(el); }
      el = el.parentElement?.closest(TSEL);
    }
  }
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') grab(e); }, true);
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (!locked.size || !e.target.closest?.('.is-hv')) grab(e);   // 스크롤로 풀린 뒤 같은 오브젝트 위에서 다시 움직일 때
    for (const [el, b] of locked) {
      if (!el.isConnected || el.disabled) { release(el); continue; }
      if (!inside(b, e.clientX, e.clientY) && !el.matches(':hover')) release(el);
    }
  }, { passive: true });
  const clearAll = () => { for (const el of [...locked.keys()]) release(el); };   // 스크롤·창 크기 변경: 자리가 바뀌니 풀고 다음 움직임에서 다시 잡음
  addEventListener('scroll', clearAll, { passive: true, capture: true });
  addEventListener('resize', clearAll);
  document.addEventListener('mouseleave', () => { for (const el of [...locked.keys()]) release(el); });
};
(window.requestIdleCallback || (f => setTimeout(f, 300)))(hlInit, { timeout: 2500 });
